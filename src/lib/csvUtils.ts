// src/lib/csvUtils.ts

/**
 * Converts an array of objects to a CSV string.
 */
export function convertToCSV<T extends object>(data: T[]): string {
    if (data.length === 0) return "";

    const headers = Object.keys(data[0]) as (keyof T)[];
    const csvRows = [];

    // Header row
    csvRows.push(headers.join(","));

    // Data rows
    for (const row of data) {
        const values = headers.map(header => {
            const val = row[header];
            const escaped = String(val).replace(/"/g, '""');
            return `"${escaped}"`;
        });
        csvRows.push(values.join(","));
    }

    return csvRows.join("\n");
}

/**
 * Parses a CSV string into an array of objects.
 */
export function parseCSV(csvText: string): any[] {
    const lines = csvText.split(/\r?\n/);
    if (lines.length < 2) return [];

    const headers = lines[0].split(",");
    const result = [];

    for (let i = 1; i < lines.length; i++) {
        if (!lines[i].trim()) continue;

        const currentLine = lines[i].split(/,(?=(?:(?:[^"]*"){2})*[^"]*$)/); // Split by comma outside quotes
        const obj: any = {};

        for (let j = 0; j < headers.length; j++) {
            let val = currentLine[j] || "";
            // Remove surrounding quotes
            if (val.startsWith('"') && val.endsWith('"')) {
                val = val.substring(1, val.length - 1).replace(/""/g, '"');
            }
            obj[headers[j].trim()] = val;
        }
        result.push(obj);
    }

    return result;
}

/**
 * Triggers a file download in the browser.
 */
export function downloadCSV(csvContent: string, fileName: string) {
    const blob = new Blob(["\uFEFF" + csvContent], { type: "text/csv;charset=utf-8;" });
    const link = document.createElement("a");
    const url = URL.createObjectURL(blob);
    link.setAttribute("href", url);
    link.setAttribute("download", fileName);
    link.style.visibility = "hidden";
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
}
