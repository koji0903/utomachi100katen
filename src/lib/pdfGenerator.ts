// src/lib/pdfGenerator.ts
// ─── html2canvas + jsPDF で DOM 要素を A4 PDF に変換 ────────────────────

export async function generatePdfFromElement(el: HTMLElement, filename = "document.pdf"): Promise<void> {
    try {
        // Dynamic import to avoid SSR issues
        const [jsPDFModule, html2canvasModule] = await Promise.all([
            import("jspdf"),
            import("html2canvas"),
        ]);

        const jsPDF = (jsPDFModule as any).jsPDF || (jsPDFModule as any).default;
        const html2canvas = (html2canvasModule as any).default || html2canvasModule;

        if (!jsPDF || !html2canvas) {
            throw new Error("Failed to load PDF generation libraries");
        }

        // Wait a bit to ensure all images (like logo) are fully rendered
        await new Promise(resolve => setTimeout(resolve, 500));

        const A4_W = 210;
        const A4_H = 297;

        // 1. Capture the element once at high resolution
        const canvas = await html2canvas(el, {
            scale: 3,
            useCORS: true,
            allowTaint: true,
            backgroundColor: "#ffffff",
            logging: false,
            width: el.offsetWidth,
            height: el.offsetHeight,
        });

        const imgWidth = canvas.width;
        const imgHeight = canvas.height;
        const pdf = new jsPDF({
            orientation: "portrait",
            unit: "mm",
            format: "a4",
            compress: true
        });

        const imgWidthMm = A4_W;
        const pxToMm = imgWidthMm / el.offsetWidth;

        // 2. Intelligence: Find safe break points in the DOM
        // We look for elements that would overlap the A4 page boundary and find the gap before them.
        const findBreakPoints = () => {
            const breaks = [];
            let currentOffsetPx = 0;
            const totalHeightPx = el.offsetHeight;
            const pageHeightPx = A4_H / pxToMm;

            while (currentOffsetPx + pageHeightPx < totalHeightPx) {
                const targetBreakPx = currentOffsetPx + pageHeightPx;

                // Find all elements that cross this boundary
                const children = Array.from(el.querySelectorAll('tr, .bank-info, .memo-section, .summary-table, h2, h3'));
                let bestBreakPx = targetBreakPx;

                const containerRect = el.getBoundingClientRect();

                for (const child of children) {
                    const rect = (child as HTMLElement).getBoundingClientRect();
                    const top = rect.top - containerRect.top;
                    const bottom = rect.bottom - containerRect.top;

                    // If an element starts before the boundary but ends after it, it's being cut.
                    if (top < targetBreakPx && bottom > targetBreakPx) {
                        // Move the break to just before this element
                        bestBreakPx = Math.min(bestBreakPx, top - 2); // 2px buffer
                        break;
                    }
                }

                // Safety: if we didn't find a good break (e.g. a huge element), fall back to fixed
                if (bestBreakPx <= currentOffsetPx + (pageHeightPx * 0.5)) {
                    bestBreakPx = targetBreakPx;
                }

                breaks.push(bestBreakPx);
                currentOffsetPx = bestBreakPx;
            }
            // Add the final height
            breaks.push(totalHeightPx);
            return breaks;
        };

        const breakPointsPx = findBreakPoints();
        let lastBreakPx = 0;

        // 3. Precise Slicing Loop based on found break points
        for (let i = 0; i < breakPointsPx.length; i++) {
            const currentBreakPx = breakPointsPx[i];
            const sliceHeightPx = currentBreakPx - lastBreakPx;

            if (sliceHeightPx <= 0) continue;

            const sliceCanvas = document.createElement("canvas");
            sliceCanvas.width = imgWidth;
            sliceCanvas.height = (sliceHeightPx * imgWidth) / el.offsetWidth;
            const ctx = sliceCanvas.getContext("2d");
            if (!ctx) break;

            const srcY = (lastBreakPx * imgWidth) / el.offsetWidth;
            const srcHeight = (sliceHeightPx * imgWidth) / el.offsetWidth;

            ctx.drawImage(canvas, 0, srcY, imgWidth, srcHeight, 0, 0, imgWidth, srcHeight);

            const sliceData = sliceCanvas.toDataURL("image/png");
            const sliceHeightMm = sliceHeightPx * pxToMm;

            if (i > 0) pdf.addPage();
            pdf.addImage(sliceData, "PNG", 0, 0, imgWidthMm, sliceHeightMm);

            lastBreakPx = currentBreakPx;
        }

        pdf.save(filename);

    } catch (error) {
        console.error("PDF Generation Error:", error);
        alert("PDFの生成に失敗しました。画像の読み込みエラー or ライブラリの制約である可能性があります。");
        throw error;
    }
}
