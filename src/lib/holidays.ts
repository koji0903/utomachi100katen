// src/lib/holidays.ts

/**
 * Japanese Holiday Utility
 * Calculates holidays dynamically for any given year.
 */

export interface Holiday {
    date: string; // YYYY-MM-DD
    name: string;
    type: 'holiday' | 'event';
}

/**
 * Calculates Mother's Day (2nd Sunday of May)
 */
export function getMothersDay(year: number): string {
    const date = new Date(year, 4, 1);
    const day = date.getDay();
    const diff = (7 - day) % 7 + 7;
    date.setDate(1 + diff);
    return formatDate(date);
}

/**
 * Calculates Father's Day (3rd Sunday of June)
 */
export function getFathersDay(year: number): string {
    const date = new Date(year, 5, 1);
    const day = date.getDay();
    const diff = (7 - day) % 7 + 14;
    date.setDate(1 + diff);
    return formatDate(date);
}

/**
 * Helper to format Date to YYYY-MM-DD
 */
function formatDate(date: Date): string {
    const y = date.getFullYear();
    const m = String(date.getMonth() + 1).padStart(2, '0');
    const d = String(date.getDate()).padStart(2, '0');
    return `${y}-${m}-${d}`;
}

/**
 * Calculates the Nth Monday of a given month
 */
function getNthMonday(year: number, month: number, n: number): string {
    const date = new Date(year, month - 1, 1);
    const firstDay = date.getDay();
    // 0: Sun, 1: Mon, ...
    const firstMonday = (1 - firstDay + 7) % 7 + 1;
    const targetDay = firstMonday + (n - 1) * 7;
    date.setDate(targetDay);
    return formatDate(date);
}

/**
 * Calculates Spring Equinox (roughly)
 * Valid for 1980-2099
 */
function getSpringEquinox(year: number): string {
    const day = Math.floor(20.8431 + 0.242194 * (year - 1980) - Math.floor((year - 1980) / 4));
    return formatDate(new Date(year, 2, day));
}

/**
 * Calculates Autumnal Equinox (roughly)
 * Valid for 1980-2099
 */
function getAutumnEquinox(year: number): string {
    const day = Math.floor(23.2488 + 0.242194 * (year - 1980) - Math.floor((year - 1980) / 4));
    return formatDate(new Date(year, 8, day));
}

/**
 * Get all public holidays for a specific year
 */
export function getHolidaysForYear(year: number): Holiday[] {
    const holidays: Holiday[] = [
        { date: `${year}-01-01`, name: "元日", type: "holiday" },
        { date: getNthMonday(year, 1, 2), name: "成人の日", type: "holiday" },
        { date: `${year}-02-11`, name: "建国記念の日", type: "holiday" },
        { date: `${year}-02-23`, name: "天皇誕生日", type: "holiday" },
        { date: getSpringEquinox(year), name: "春分の日", type: "holiday" },
        { date: `${year}-04-29`, name: "昭和の日", type: "holiday" },
        { date: `${year}-05-03`, name: "憲法記念日", type: "holiday" },
        { date: `${year}-05-04`, name: "みどりの日", type: "holiday" },
        { date: `${year}-05-05`, name: "こどもの日", type: "holiday" },
        { date: getNthMonday(year, 7, 3), name: "海の日", type: "holiday" },
        { date: `${year}-08-11`, name: "山の日", type: "holiday" },
        { date: getNthMonday(year, 9, 3), name: "敬老の日", type: "holiday" },
        { date: getAutumnEquinox(year), name: "秋分の日", type: "holiday" },
        { date: getNthMonday(year, 10, 2), name: "スポーツの日", type: "holiday" },
        { date: `${year}-11-03`, name: "文化の日", type: "holiday" },
        { date: `${year}-11-23`, name: "勤労感謝の日", type: "holiday" },
    ];

    // Add Substitute Holidays (振替休日)
    const extraHolidays: Holiday[] = [];
    holidays.forEach(h => {
        const d = new Date(h.date);
        if (d.getDay() === 0) { // Sunday
            let subDate = new Date(d);
            while (true) {
                subDate.setDate(subDate.getDate() + 1);
                const subDateStr = formatDate(subDate);
                if (!holidays.some(h2 => h2.date === subDateStr) && !extraHolidays.some(h2 => h2.date === subDateStr)) {
                    extraHolidays.push({ date: subDateStr, name: "振替休日", type: "holiday" });
                    break;
                }
            }
        }
    });

    // Add Citizen's Holidays (国民の休日)
    // Between two holidays separated by one day
    const combined = [...holidays, ...extraHolidays].sort((a, b) => a.date.localeCompare(b.date));
    for (let i = 0; i < combined.length - 1; i++) {
        const d1 = new Date(combined[i].date);
        const d2 = new Date(combined[i+1].date);
        const diff = (d2.getTime() - d1.getTime()) / (1000 * 60 * 60 * 24);
        if (diff === 2) {
            const mid = new Date(d1);
            mid.setDate(mid.getDate() + 1);
            if (mid.getDay() !== 0) { // Cannot be Sunday (already handled) or already holiday
                const midStr = formatDate(mid);
                if (!combined.some(c => c.date === midStr)) {
                    extraHolidays.push({ date: midStr, name: "国民の休日", type: "holiday" });
                }
            }
        }
    }

    return [...holidays, ...extraHolidays].sort((a, b) => a.date.localeCompare(b.date));
}

/**
 * Returns the holiday name if the date is a holiday, otherwise null.
 */
export function getHolidayName(dateStr: string): string | null {
    const year = parseInt(dateStr.split('-')[0]);
    if (isNaN(year)) return null;
    const holiday = getHolidaysForYear(year).find(h => h.date === dateStr);
    return holiday ? holiday.name : null;
}

/**
 * Checks if a date is a holiday.
 */
export function isHoliday(dateStr: string): boolean {
    return getHolidayName(dateStr) !== null;
}

/**
 * Returns all holidays and events within the specified range.
 */
export function getUpcomingEvents(startDate: Date, endDate: Date): Holiday[] {
    const startStr = formatDate(startDate);
    const endStr = formatDate(endDate);

    const startYear = startDate.getFullYear();
    const endYear = endDate.getFullYear();

    const allEvents: Holiday[] = [];

    for (let y = startYear; y <= endYear; y++) {
        // Public Holidays
        allEvents.push(...getHolidaysForYear(y));
        
        // Retail Events
        allEvents.push({ date: getMothersDay(y), name: "母の日", type: "event" });
        allEvents.push({ date: getFathersDay(y), name: "父の日", type: "event" });
    }

    // De-duplicate and filter
    const uniqueMap = new Map<string, Holiday>();
    allEvents.forEach(e => {
        // If it's both a holiday and an event, keep both or combine?
        // Usually, separate is better or priority to holiday.
        // For simplicity, let's keep all but unique by date+name.
        uniqueMap.set(e.date + e.name, e);
    });

    return Array.from(uniqueMap.values())
        .filter(e => e.date >= startStr && e.date <= endStr)
        .sort((a, b) => a.date.localeCompare(b.date));
}
