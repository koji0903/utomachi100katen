// src/lib/holidays.ts

/**
 * Japanese Holiday Utility
 * Currently uses a static list for 2026.
 * For a production app, consider using an external API or a robust library like holiday-jp.
 */

interface Holiday {
    date: string; // YYYY-MM-DD
    name: string;
}

const HOLIDAYS_2026: Holiday[] = [
    { date: "2026-01-01", name: "元日" },
    { date: "2026-01-12", name: "成人の日" },
    { date: "2026-02-11", name: "建国記念の日" },
    { date: "2026-02-23", name: "天皇誕生日" },
    { date: "2026-03-20", name: "春分の日" },
    { date: "2026-04-29", name: "昭和の日" },
    { date: "2026-05-03", name: "憲法記念日" },
    { date: "2026-05-04", name: "みどりの日" },
    { date: "2026-05-05", name: "こどもの日" },
    { date: "2026-05-06", name: "振替休日" },
    { date: "2026-07-20", name: "海の日" },
    { date: "2026-08-11", name: "山の日" },
    { date: "2026-09-21", name: "敬老の日" },
    { date: "2026-09-22", name: "国民の休日" },
    { date: "2026-09-23", name: "秋分の日" },
    { date: "2026-10-12", name: "スポーツの日" },
    { date: "2026-11-03", name: "文化の日" },
    { date: "2026-11-23", name: "勤労感謝の日" },
];

/**
 * Returns the holiday name if the date is a holiday, otherwise null.
 * @param dateStr Date string in YYYY-MM-DD format
 */
export function getHolidayName(dateStr: string): string | null {
    const holiday = HOLIDAYS_2026.find(h => h.date === dateStr);
    return holiday ? holiday.name : null;
}

/**
 * Checks if a date is a holiday.
 */
export function isHoliday(dateStr: string): boolean {
    return HOLIDAYS_2026.some(h => h.date === dateStr);
}
