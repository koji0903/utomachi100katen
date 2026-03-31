/**
 * src/lib/imageScanner.ts
 * OpenCV.js based receipt scanner with distortion correction (Perspective Transform).
 */

let cvPromise: Promise<any> | null = null;

/**
 * Dynamically loads OpenCV.js from CDN.
 */
export const loadOpenCV = (): Promise<any> => {
    if (cvPromise) return cvPromise;

    cvPromise = new Promise((resolve, reject) => {
        // Check if already loaded
        if (typeof window !== "undefined" && (window as any).cv) {
            resolve((window as any).cv);
            return;
        }

        const script = document.createElement("script");
        script.src = "https://docs.opencv.org/4.11.0/opencv.js";
        script.async = true;
        script.onload = () => {
            // OpenCV.js isn't ready immediately even after script loads.
            // It needs to initialize its WASM module.
            const checkCV = () => {
                if ((window as any).cv && (window as any).cv.Mat) {
                    console.log("[Scanner] OpenCV.js is ready.");
                    resolve((window as any).cv);
                } else {
                    setTimeout(checkCV, 100);
                }
            };
            checkCV();
        };
        script.onerror = () => {
            cvPromise = null;
            reject(new Error("Failed to load OpenCV.js"));
        };
        document.body.appendChild(script);
    });

    return cvPromise;
};

/**
 * Performs receipt extraction and perspective transform on a File.
 */
export const scanReceipt = async (file: File): Promise<File> => {
    console.log("[Scanner] Starting scan for:", file.name);
    
    // 1. Ensure OpenCV is loaded
    let cv: any;
    try {
        cv = await loadOpenCV();
    } catch (e) {
        console.error("[Scanner] OpenCV load failed, skipping correction:", e);
        return file;
    }

    return new Promise((resolve) => {
        const reader = new FileReader();
        reader.onload = async (e) => {
            const imgElement = new Image();
            imgElement.onload = () => {
                try {
                    const resultFile = processImage(cv, imgElement, file.name);
                    resolve(resultFile);
                } catch (err) {
                    console.error("[Scanner] Processing failed, returning original:", err);
                    resolve(file);
                }
            };
            imgElement.src = e.target?.result as string;
        };
        reader.readAsDataURL(file);
    });
};

/**
 * Image processing logic using OpenCV.js
 */
function processImage(cv: any, imgElement: HTMLImageElement, fileName: string): File {
    let src = cv.imread(imgElement);
    let blurred = new cv.Mat();
    let gray = new cv.Mat();
    let edged = new cv.Mat();
    let contours = new cv.MatVector();
    let hierarchy = new cv.Mat();

    // 1. Resize for performance (Height 800px is usually enough for contour detection)
    const ratio = src.rows / 800;
    const width = Math.round(src.cols / ratio);
    const height = 800;
    let resized = new cv.Mat();
    cv.resize(src, resized, new cv.Size(width, height));

    // 2. Pre-process
    cv.cvtColor(resized, gray, cv.COLOR_RGBA2GRAY);
    cv.GaussianBlur(gray, blurred, new cv.Size(5, 5), 0);
    cv.Canny(blurred, edged, 75, 200);

    // 3. Find contours
    cv.findContours(edged, contours, hierarchy, cv.RETR_LIST, cv.CHAIN_APPROX_SIMPLE);

    let receiptContour = null;
    let maxArea = 0;

    // Filter contours to find the largest quadrilateral
    for (let i = 0; i < contours.size(); ++i) {
        let cnt = contours.get(i);
        let area = cv.contourArea(cnt);
        let peri = cv.arcLength(cnt, true);
        let approx = new cv.Mat();
        cv.approxPolyDP(cnt, approx, 0.02 * peri, true);

        // A receipt is reasonably large and has 4 corners
        if (approx.rows === 4 && area > maxArea && area > (width * height * 0.05)) {
            receiptContour = approx;
            maxArea = area;
        } else {
            approx.delete();
        }
    }

    // If no 4-corner contour found, return processed but non-warped image (or just original)
    if (!receiptContour) {
        console.warn("[Scanner] No receipt-like contour found. Skipping perspective transform.");
        // Clean up
        src.delete(); gray.delete(); blurred.delete(); edged.delete(); contours.delete(); hierarchy.delete(); resized.delete();
        throw new Error("No receipt contour found");
    }

    // 4. Perspective Transform
    let points: any[] = [];
    for (let i = 0; i < 4; i++) {
        points.push({ x: receiptContour.data32S[i * 2] * ratio, y: receiptContour.data32S[i * 2 + 1] * ratio });
    }

    // Reorder points: top-left, top-right, bottom-right, bottom-left
    points.sort((a, b) => a.y - b.y);
    const top = points.slice(0, 2).sort((a, b) => a.x - b.x);
    const bottom = points.slice(2, 4).sort((a, b) => a.x - b.x);
    
    let srcPts = cv.matFromArray(4, 1, cv.CV_32FC2, [
        top[0].x, top[0].y,
        top[1].x, top[1].y,
        bottom[1].x, bottom[1].y,
        bottom[0].x, bottom[0].y
    ]);

    // Calculate dimensions of the new image
    const w1 = Math.hypot(top[1].x - top[0].x, top[1].y - top[0].y);
    const w2 = Math.hypot(bottom[1].x - bottom[0].x, bottom[1].y - bottom[0].y);
    const maxWidth = Math.max(w1, w2);

    const h1 = Math.hypot(top[0].x - bottom[0].x, top[0].y - bottom[0].y);
    const h2 = Math.hypot(top[1].x - bottom[1].x, top[1].y - bottom[1].y);
    const maxHeight = Math.max(h1, h2);

    let dstPts = cv.matFromArray(4, 1, cv.CV_32FC2, [
        0, 0,
        maxWidth - 1, 0,
        maxWidth - 1, maxHeight - 1,
        0, maxHeight - 1
    ]);

    let transform = cv.getPerspectiveTransform(srcPts, dstPts);
    let finalWarped = new cv.Mat();
    cv.warpPerspective(src, finalWarped, transform, new cv.Size(maxWidth, maxHeight));

    // 5. Output back to File
    const canvas = document.createElement("canvas");
    cv.imshow(canvas, finalWarped);
    const dataUrl = canvas.toDataURL("image/jpeg", 0.9);
    const blob = dataURLToBlob(dataUrl);
    const resultFile = new File([blob], fileName, { type: "image/jpeg" });

    // 6. Cleanup CV Objects
    src.delete(); gray.delete(); blurred.delete(); edged.delete(); contours.delete(); 
    hierarchy.delete(); resized.delete(); receiptContour.delete(); 
    srcPts.delete(); dstPts.delete(); transform.delete(); finalWarped.delete();

    console.log("[Scanner] Transformation complete.");
    return resultFile;
}

function dataURLToBlob(dataurl: string) {
    let arr = dataurl.split(','), mime = arr[0].match(/:(.*?);/)![1],
        bstr = atob(arr[1]), n = bstr.length, u8arr = new Uint8Array(n);
    while (n--) {
        u8arr[n] = bstr.charCodeAt(n);
    }
    return new Blob([u8arr], { type: mime });
}
