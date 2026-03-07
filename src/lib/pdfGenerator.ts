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

        const canvas = await html2canvas(el, {
            scale: 2,
            useCORS: true,
            allowTaint: true,
            backgroundColor: "#ffffff",
            logging: false,
        });

        const imgWidth = canvas.width;
        const imgHeight = canvas.height;

        const A4_W = 210;
        const A4_H = 297;
        const pdf = new jsPDF({ orientation: "portrait", unit: "mm", format: "a4" });

        const imgWidthMm = A4_W;
        const imgHeightMm = (imgHeight / imgWidth) * imgWidthMm;

        let posY = 0;
        let remainingHeightMm = imgHeightMm;

        while (remainingHeightMm > 1) { // 1mm buffer
            const srcHeightPx = (A4_H * imgWidth) / imgWidthMm;
            const srcY = (posY * imgWidth) / imgWidthMm;
            const sliceHeightPx = Math.min(srcHeightPx, imgHeight - srcY);

            if (sliceHeightPx <= 2) break;

            const sliceCanvas = document.createElement("canvas");
            sliceCanvas.width = imgWidth;
            sliceCanvas.height = sliceHeightPx;
            const ctx = sliceCanvas.getContext("2d");
            if (!ctx) break;

            ctx.drawImage(canvas, 0, srcY, imgWidth, sliceHeightPx, 0, 0, imgWidth, sliceHeightPx);

            // Use JPEG for better compatibility and smaller size
            const sliceData = sliceCanvas.toDataURL("image/jpeg", 0.95);
            const sliceHeightMm = (sliceHeightPx / imgWidth) * imgWidthMm;

            if (posY > 0) pdf.addPage();
            pdf.addImage(sliceData, "JPEG", 0, 0, imgWidthMm, sliceHeightMm);

            posY += A4_H;
            remainingHeightMm -= A4_H;
        }

        pdf.save(filename);
    } catch (error) {
        console.error("PDF Generation Error:", error);
        alert("PDFの生成に失敗しました。画像の読み込みエラー or ライブラリの制約である可能性があります。");
        throw error;
    }
}
