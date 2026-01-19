import {TimeEntry} from '../types';

const STORAGE_KEY = 'terminal_time_tracker_data';

export const getEntries = (): TimeEntry[] => {
    const data = localStorage.getItem(STORAGE_KEY);
    return data ? JSON.parse(data) : [];
};

export const saveEntry = (entry: Omit<TimeEntry, 'id' | 'timestamp'>): TimeEntry => {
    const entries = getEntries();
    const newEntry: TimeEntry = {
        ...entry,
        id: Math.random().toString(36).substring(2, 9),
        timestamp: Date.now(),
    };
    entries.push(newEntry);
    localStorage.setItem(STORAGE_KEY, JSON.stringify(entries));
    return newEntry;
};

export const clearEntries = (): void => {
    localStorage.removeItem(STORAGE_KEY);
};

export const generateReport = (month?: string): string => {
    const entries = getEntries();
    if (entries.length === 0) return "No data found.";

    let filtered = entries;
    let title = "Total Report";

    if (month) {
        // month format YYYY-MM
        filtered = entries.filter(e => e.date.startsWith(month));
        title = `Report for ${month}`;
    }

    if (filtered.length === 0) return `No entries found for ${month || 'all time'}.`;

    // Aggregate
    const projectStats: Record<string, number> = {};
    const dailyStats: Record<string, { minutes: number; entries: TimeEntry[] }> = {};
    let totalMinutes = 0;

    filtered.forEach(e => {
        projectStats[e.project] = (projectStats[e.project] || 0) + e.durationMinutes;
        if (!dailyStats[e.date]) {
            dailyStats[e.date] = {minutes: 0, entries: []};
        }
        dailyStats[e.date].minutes += e.durationMinutes;
        dailyStats[e.date].entries.push(e);
        totalMinutes += e.durationMinutes;
    });

    // Format Output
    let output = `\n--- ${title} ---\n`;
    output += `Total Time: ${(totalMinutes / 60).toFixed(2)} hours (${totalMinutes} mins)\n\n`;
    output += `By Project:\n`;

    Object.entries(projectStats).forEach(([project, mins]) => {
        output += ` - ${project.padEnd(20)}: ${(mins / 60).toFixed(2)}h (${mins}m)\n`;
    });

    output += `\nBy Day:\n`;

    Object.entries(dailyStats)
        .sort(([dateA], [dateB]) => dateA.localeCompare(dateB))
        .forEach(([date, {minutes, entries}]) => {
            output += ` - ${date}: ${minutes} minutes\n`;
            entries.forEach(entry => {
                output += `   • ${entry.project} (${entry.durationMinutes}m)${entry.description ? `: ${entry.description}` : ''}\n`;
            });
        });

    output += `---------------------\n`;
    return output;
};