export interface TimeEntry {
  id: string;
  project: string;
  durationMinutes: number;
  date: string; // YYYY-MM-DD
  description: string;
  timestamp: number; // Created At
}

export interface TerminalLine {
  id: string;
  type: 'input' | 'output' | 'error' | 'system';
  content: React.ReactNode;
}

export enum CommandType {
  HELP = 'help',
  ADD = 'add',
  REPORT = 'report',
  CLEAR = 'clear',
  README = 'readme',
  UNKNOWN = 'unknown'
}