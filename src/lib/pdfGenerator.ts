// src/lib/pdfGenerator.ts
// ─── html2canvas + jsPDF で DOM 要素を A4 PDF に変換 ────────────────────

export async function generatePdfFromElement(el: HTMLElement, filename = "document.pdf"): Promise<void> {
    // Dynamic import to avoid SSR issues
    const [{ default: jsPDF }, { default: html2canvas }] = await Promise.all([
        import("jspdf"),
        import("html2canvas"),
    ]);

    const canvas = await html2canvas(el, {
        scale: 2, // Retina quality
        useCORS: true,
        allowTaint: true,
        backgroundColor: "#ffffff",
        windowWidth: el.scrollWidth,
        windowHeight: el.scrollHeight,
    });

    const imgData = canvas.toDataURL("image/png");

    // A4 dimensions in mm: 210 x 297
    const A4_W = 210;
    const A4_H = 297;

    const pdf = new jsPDF({ orientation: "portrait", unit: "mm", format: "a4" });

    // Compute image size to fill A4 width, splitting pages if needed
    const imgWidthMm = A4_W;
    const imgHeightMm = (canvas.height / canvas.width) * imgWidthMm;

    let posY = 0;
    let remaining = imgHeightMm;

    while (remaining > 0) {
        // Calculate source slice: how much of the image (in px) maps to one A4 page
        const slicePx = A4_H * (canvas.width / imgWidthMm);

        // Create a cropped canvas for each page
        const sliceCanvas = document.createElement("canvas");
        const scaledSlicePx = Math.min(slicePx, canvas.height - (posY * canvas.width / imgWidthMm));
        sliceCanvas.width = canvas.width;
        sliceCanvas.height = Math.min(
            slicePx,
            canvas.height - Math.round((posY / imgWidthMm) * canvas.width)
        );

        const ctx = sliceCanvas.getContext("2d")!;
        const srcY = Math.round((posY / imgWidthMm) * canvas.width);
        ctx.drawImage(canvas, 0, srcY, canvas.width, sliceCanvas.height, 0, 0, sliceCanvas.width, sliceCanvas.height);

        const sliceData = sliceCanvas.toDataURL("image/png");
        const sliceHeightMm = (sliceCanvas.height / canvas.width) * imgWidthMm;

        if (posY > 0) pdf.addPage();
        pdf.addImage(sliceData, "PNG", 0, 0, imgWidthMm, sliceHeightMm);

        posY += A4_H;
        remaining -= A4_H;
    }

    pdf.save(filename);
}
