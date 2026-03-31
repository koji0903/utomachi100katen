/**
 * src/lib/scanner.worker.ts
 * Off-screen image processing worker using OpenCV.js
 */

/// <reference lib="webworker" />

/* eslint-disable no-restricted-globals */

// Progress states
type ScanProgress = {
    percent: number;
    message: string;
};

const sendProgress = (percent: number, message: string) => {
    self.postMessage({ type: 'progress', progress: { percent, message } });
};

const sendError = (error: string) => {
    self.postMessage({ type: 'error', error });
};

const sendResult = (blob: Blob) => {
    self.postMessage({ type: 'result', blob });
};

// Library loading state
let cvLoaded = false;

async function loadOpenCV() {
    if (cvLoaded) return;
    
    sendProgress(10, '画像処理ライブラリを読込中...');
    
    return new Promise<void>((resolve, reject) => {
        // We use a fixed version CDNs for stability
        (self as any).Module = {
            onRuntimeInitialized: () => {
                cvLoaded = true;
                console.log("[ScannerWorker] OpenCV.js initialized.");
                resolve();
            }
        };
        
        try {
            // Using a cdnjs URL for better reliability
            importScripts('https://docs.opencv.org/4.x/opencv.js');
            
            // In case onRuntimeInitialized doesn't fire (some versions)
            const checkCV = () => {
                if ((self as any).cv && (self as any).cv.Mat) {
                    cvLoaded = true;
                    resolve();
                } else {
                    setTimeout(checkCV, 100);
                }
            };
            setTimeout(checkCV, 100);
            
        } catch (e) {
            reject(new Error("Failed to load OpenCV.js via importScripts"));
        }
    });
}

self.onmessage = async (e: MessageEvent) => {
    const { fileBlob } = e.data;
    
    try {
        await loadOpenCV();
        sendProgress(30, 'ライブラリの準備が完了しました');

        const cv = (self as any).cv;
        
        // 1. Create ImageBitmap from Blob
        sendProgress(40, '画像データを解析中...');
        const imgBitmap = await createImageBitmap(fileBlob);
        
        // 2. Offscreen Rendering to get pixel data
        const offscreen = new OffscreenCanvas(imgBitmap.width, imgBitmap.height);
        const ctx = offscreen.getContext('2d');
        if (!ctx) throw new Error("Could not get offscreen context");
        ctx.drawImage(imgBitmap, 0, 0);
        const imgData = ctx.getImageData(0, 0, offscreen.width, offscreen.height);

        // 3. Process with OpenCV
        sendProgress(50, 'レシートの形を探しています...');
        
        let src = cv.matFromImageData(imgData);
        let gray = new cv.Mat();
        let blurred = new cv.Mat();
        let edged = new cv.Mat();
        let contours = new cv.MatVector();
        let hierarchy = new cv.Mat();

        // Resize for faster contour detection
        const ratio = src.rows / 800;
        const width = Math.round(src.cols / ratio);
        const height = 800;
        let resized = new cv.Mat();
        cv.resize(src, resized, new cv.Size(width, height));

        cv.cvtColor(resized, gray, cv.COLOR_RGBA2GRAY);
        cv.GaussianBlur(gray, blurred, new cv.Size(5, 5), 0);
        cv.Canny(blurred, edged, 75, 200);

        cv.findContours(edged, contours, hierarchy, cv.RETR_LIST, cv.CHAIN_APPROX_SIMPLE);

        let receiptContour = null;
        let maxArea = 0;

        for (let i = 0; i < contours.size(); ++i) {
            let cnt = contours.get(i);
            let area = cv.contourArea(cnt);
            let peri = cv.arcLength(cnt, true);
            let approx = new cv.Mat();
            cv.approxPolyDP(cnt, approx, 0.02 * peri, true);

            if (approx.rows === 4 && area > maxArea && area > (width * height * 0.05)) {
                receiptContour = approx;
                maxArea = area;
            } else {
                approx.delete();
            }
        }

        if (!receiptContour) {
            sendProgress(90, 'レシートを検出できませんでしたが、元の画像を進めます');
            // Logic to send back original if needed, but for now we finish
            sendResult(fileBlob);
            return;
        }

        sendProgress(70, '形を正面に補正しています...');
        
        // Perspective Transform
        let points: any[] = [];
        for (let i = 0; i < 4; i++) {
            points.push({ x: receiptContour.data32S[i * 2] * ratio, y: receiptContour.data32S[i * 2 + 1] * ratio });
        }

        points.sort((a, b) => a.y - b.y);
        const top = points.slice(0, 2).sort((a, b) => a.x - b.x);
        const bottom = points.slice(2, 4).sort((a, b) => a.x - b.x);
        
        let srcPts = cv.matFromArray(4, 1, cv.CV_32FC2, [
            top[0].x, top[0].y,
            top[1].x, top[1].y,
            bottom[1].x, bottom[1].y,
            bottom[0].x, bottom[0].y
        ]);

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

        sendProgress(90, '補正結果をレンダリング中...');
        
        // Back to Blob
        const outCanvas = new OffscreenCanvas(maxWidth, maxHeight);
        // OpenCV imshow on OffscreenCanvas isn't direct, use putImageData or use a simple loop/helper
        // Actually we can use a temporary small canvas or helper
        // Simplified: put back to image data and then to blob
        // For efficiency in Worker:
        let imgDataOut = new ImageData(new Uint8ClampedArray(finalWarped.data), finalWarped.cols, finalWarped.rows);
        const outCtx = outCanvas.getContext('2d');
        if (outCtx) {
            outCtx.putImageData(imgDataOut, 0, 0);
            const blob = await outCanvas.convertToBlob({ type: 'image/jpeg', quality: 0.9 });
            sendResult(blob);
        } else {
            throw new Error("Failed to get output context");
        }

        // Cleanup
        [src, gray, blurred, edged, contours, hierarchy, resized, receiptContour, srcPts, dstPts, transform, finalWarped].forEach(m => {
            if (m && m.delete) m.delete();
        });

    } catch (error: any) {
        console.error("[ScannerWorker] Fatal error:", error);
        sendError(error.message);
    }
};
