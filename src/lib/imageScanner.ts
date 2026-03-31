/**
 * src/lib/imageScanner.ts
 * Worker-based receipt scanner wrapper.
 */

export type ScanProgress = {
    percent: number;
    message: string;
};

/**
 * Performs receipt extraction and perspective transform on a File using Web Worker.
 */
export const scanReceipt = async (
    file: File, 
    onProgress?: (progress: ScanProgress) => void
): Promise<File> => {
    console.log("[Scanner] Initiating worker scan for:", file.name);
    
    return new Promise((resolve) => {
        // Fallback for environments where Worker or OffscreenCanvas might not be available
        if (typeof Worker === 'undefined' || typeof OffscreenCanvas === 'undefined') {
            console.warn("[Scanner] Web Worker or OffscreenCanvas not supported, skipping.");
            resolve(file);
            return;
        }

        try {
            const worker = new Worker(new URL('./scanner.worker.ts', import.meta.url));
            
            // Set a total safety timeout (30 seconds for the whole worker process)
            const timeout = setTimeout(() => {
                console.warn("[Scanner] Overall scan timeout");
                worker.terminate();
                resolve(file);
            }, 30000);

            worker.onmessage = (e) => {
                const { type, progress, result, error, blob } = e.data;

                if (type === 'progress' && progress && onProgress) {
                    onProgress(progress);
                } else if (type === 'result' && blob) {
                    clearTimeout(timeout);
                    console.log("[Scanner] Worker success.");
                    const resultFile = new File([blob], file.name, { type: 'image/jpeg' });
                    worker.terminate();
                    resolve(resultFile);
                } else if (type === 'error') {
                    clearTimeout(timeout);
                    console.error("[Scanner] Worker error:", error);
                    worker.terminate();
                    resolve(file);
                }
            };

            worker.onerror = (err) => {
                clearTimeout(timeout);
                console.error("[Scanner] Worker fatal error:", err);
                worker.terminate();
                resolve(file);
            };

            // Send blob to worker
            worker.postMessage({ fileBlob: file });

        } catch (err) {
            console.error("[Scanner] Failed to initialize worker:", err);
            resolve(file);
        }
    });
};

/**
 * Dummy function for backward compatibility if needed, 
 * but worker handles its own loading.
 */
export const loadOpenCV = async (): Promise<void> => {
    // No-op, worker handles it
}
