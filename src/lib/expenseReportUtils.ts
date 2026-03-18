// src/lib/expenseReportUtils.ts
import { Expense } from "./types/expense";
import jsPDF from "jspdf";

export function generateExpensePDF(expenses: Expense[], period: string) {
    const doc = new jsPDF();
    
    // Add title
    doc.setFontSize(18);
    doc.text(`Expense Report - ${period}`, 14, 22);
    
    // Add Summary
    const total = expenses.reduce((sum, e) => sum + e.amount, 0);
    doc.setFontSize(12);
    doc.text(`Total Amount: ¥${total.toLocaleString()}`, 14, 32);
    doc.text(`Total Count: ${expenses.length} items`, 14, 38);
    
    // Table Header
    doc.setFontSize(10);
    let y = 50;
    doc.line(14, y - 5, 196, y - 5);
    doc.text("Date", 14, y);
    doc.text("Item", 40, y);
    doc.text("Category", 100, y);
    doc.text("Vendor", 140, y);
    doc.text("Amount", 180, y, { align: 'right' });
    doc.line(14, y + 2, 196, y + 2);
    
    y += 10;
    
    // Rows
    expenses.forEach((e) => {
        if (y > 280) {
            doc.addPage();
            y = 20;
        }
        doc.text(e.date, 14, y);
        doc.text(e.item, 40, y, { maxWidth: 55 });
        doc.text(e.category, 100, y);
        doc.text(e.vendor || "-", 140, y, { maxWidth: 35 });
        doc.text(`¥${e.amount.toLocaleString()}`, 190, y, { align: 'right' });
        y += 8;
    });
    
    return doc;
}
