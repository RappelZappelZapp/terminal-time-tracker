import fs from 'fs';
import readline from 'readline';
import path from 'path';
import { fileURLToPath } from 'url';
import crypto from 'crypto';

// Replicate __dirname in ESM
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const DATA_FILE = path.join(__dirname, 'data.json');

// --- Storage & Logic Service ---

const TrackerService = {
  getEntries() {
    if (!fs.existsSync(DATA_FILE)) return [];
    try {
      return JSON.parse(fs.readFileSync(DATA_FILE, 'utf8'));
    } catch (err) {
      console.error("Error reading data file:", err.message);
      return [];
    }
  },

  saveEntry({ project, durationMinutes, date, description }) {
    const entries = this.getEntries();
    const newEntry = {
      id: crypto.randomBytes(4).toString('hex'),
      project,
      durationMinutes,
      date,
      description,
      timestamp: Date.now()
    };
    entries.push(newEntry);
    fs.writeFileSync(DATA_FILE, JSON.stringify(entries, null, 2));
    return newEntry;
  },

  formatDuration(mins) {
    return `${(mins / 60).toFixed(2)}h (${mins}m)`;
  }
};

function generateReport(month) {
    const entries = TrackerService.getEntries();
    if (entries.length === 0) return "No data found.";

    let filtered = entries;
    let title = "Total Report";

    if (month) {
        // month format YYYY-MM
        filtered = entries.filter(e => e.date.startsWith(month));
        title = `Report for ${month}`;
    }

    if (filtered.length === 0) return `No entries found for ${month || 'all time'}.`;

    const projectStats = {};
    let totalMinutes = 0;

    filtered.forEach(e => {
        projectStats[e.project] = (projectStats[e.project] || 0) + e.durationMinutes;
        totalMinutes += e.durationMinutes;
    });

    let output = `\n--- ${title} ---\n`;
    output += `Total Time: ${TrackerService.formatDuration(totalMinutes)}\n\n`;
    output += `By Project:\n`;

    Object.entries(projectStats).forEach(([project, mins]) => {
        output += ` - ${project.padEnd(20)}: ${TrackerService.formatDuration(mins)}\n`;
    });

    output += `\nBy Day:\n`;

    const dayStats = {};
    filtered.forEach(e => {
        if (!dayStats[e.date]) {
            dayStats[e.date] = {minutes: 0, entries: []};
        }
        dayStats[e.date].minutes += e.durationMinutes;
        dayStats[e.date].entries.push(e);
    });

    Object.entries(dayStats).sort().forEach(([date, data]) => {
        const dateObj = new Date(date + 'T00:00:00');
        const dayName = new Intl.DateTimeFormat('en-US', { weekday: 'long' }).format(dateObj);

        // Add spacing before Monday (start of work week)
        if (dateObj.getDay() === 1) {
            output += `---------------------\n`;
        }

        const durationStr = TrackerService.formatDuration(data.minutes).padStart(15);
        output += ` - ${date} (${dayName.padEnd(9)}): ${durationStr}\n`;

        // Add entry details with descriptions
        data.entries.forEach(entry => {
            const projectStr = entry.project.padEnd(20);
            const durationStr = `${entry.durationMinutes}m`.padEnd(6);
            output += `   • ${projectStr} ${durationStr}${entry.description ? `: ${entry.description}` : ''}\n`;
        });
    });
    output += `---------------------\n`;
    return output;
}

function generateTable(month) {
    const entries = TrackerService.getEntries();
    if (entries.length === 0) return "No data found.";

    let filtered = entries;

    if (month) {
        filtered = entries.filter(e => e.date.startsWith(month));
    }

    if (filtered.length === 0) return `No entries found for ${month || 'all time'}.`;

    const dayStats = {};
    filtered.forEach(e => {
        if (!dayStats[e.date]) {
            dayStats[e.date] = {descriptions: [], minutes: 0};
        }
        dayStats[e.date].descriptions.push(e.description);
        dayStats[e.date].minutes += e.durationMinutes;
    });

    let output = `Date\tHours\tDescription\n`;
    Object.entries(dayStats).sort().forEach(([date, data]) => {
        const hours = (data.minutes / 60).toFixed(2);
        const concatenatedDescriptions = data.descriptions.join('; ');
        output += `${date}\t${hours}\t${concatenatedDescriptions}\n`;
    });

    return output;
}


// --- Command Execution Logic ---

function executeCommand(command, args) {
  switch (command) {
    case 'exit':
    case 'quit':
      process.exit(0);
      break;

    case 'help':
      console.log(`
Available commands:
  add <project> <hours> [date] <description...>  Add a new time entry
                                                 Date format: YYYY-MM-DD (optional, defaults to today)
                                                 Description is mandatory.
  report [YYYY-MM]                               View aggregated report
  table [YYYY-MM]                                View table format (date + descriptions) for Excel
  readme                                         Show usage info
  clear                                          Clear screen
  exit                                           Exit the application

Examples:
  Interactive Mode: node cli.js
  One-shot Mode:    node cli.js report
                    node cli.js add work 1.5 "Bug fixing"
      `);
      break;

    case 'readme':
      console.log(`
--- README ---
Installation:
  1. Ensure you have Node.js installed.
  2. Run "node cli.js" (Interactive) OR "node cli.js <command>" (One-shot)
  
Data:
  Stored in data.json in the current directory.
  
Usage Examples:

  Add time entries:
    $ add project-alpha 1.5 "Initial setup"
    $ add design 2.25 "Homepage wireframe"
    $ add backend 3 2023-01-01 "API development"
  
  Generate reports:
    $ report                    # All-time aggregated report
    $ report 2023-01            # Report for January 2023
  
  Export to Excel:
    $ table                     # All entries in tab-separated format
    $ table 2023-01             # January 2023 entries only

  Modes:
    Interactive:  $ node cli.js  (then type commands)
    One-shot:     $ node cli.js report
                  $ node cli.js add work 1.5 "Bug fixing"
  
  Tip: Create an alias for quick access:
    alias tt="node ~/path/to/cli.js"
    Then use: tt add project 2 "Task description"
      `);
      break;

    case 'clear':
      console.clear();
      break;

    case 'add':
      if (args.length < 3) {
        console.log('\x1b[31mUsage: add <project> <hours> [date] <description...>\x1b[0m');
      } else {
        const project = args[0];
        const hours = parseFloat(args[1]);
        
        if (isNaN(hours)) {
          console.log('\x1b[31mError: Duration must be a number (hours).\x1b[0m');
        } else {
          // Convert hours to minutes for storage
          const minutes = Math.round(hours * 60);

          let date = new Date().toISOString().split('T')[0];
          let description = "";
          let nextArgIndex = 2;

          if (args[nextArgIndex]) {
            // Simple check for YYYY-MM-DD format
            if (/^\d{4}-\d{2}-\d{2}$/.test(args[nextArgIndex])) {
              date = args[nextArgIndex];
              nextArgIndex++;
            }
          }

          if (args.length <= nextArgIndex) {
            console.log('\x1b[31mError: Description is mandatory.\x1b[0m');
          } else {
            description = args.slice(nextArgIndex).join(' ');
            const entry =TrackerService.saveEntry({ project, durationMinutes: minutes, date, description });
            console.log(`Entry added: ${entry.project} - ${hours}h (${minutes}m) on ${entry.date} - "${entry.description}"`);
          }
        }
      }
      break;

    case 'report':
      console.log(generateReport(args[0]));
      break;

      case 'table':
          console.log(generateTable(args[0]));
          break;

      default:
      console.log(`Command not found: ${command}. Type 'help' for available commands.`);
      break;
  }
}

// --- Entry Point ---

// Check if arguments are provided (One-shot mode)
// process.argv[0] is node, [1] is script path, [2...] are args
const args = process.argv.slice(2);

if (args.length > 0) {
  const command = args[0].toLowerCase();
  const commandArgs = args.slice(1);
  executeCommand(command, commandArgs);
} else {
  // Interactive Mode
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
    prompt: '\x1b[32m> \x1b[0m' // Green arrow
  });

  console.log('\x1b[36mTerminal Time Tracker\x1b[0m');
  console.log('Type "help" for commands.');

  rl.prompt();

  rl.on('line', (line) => {
    const trimmed = line.trim();
    if (!trimmed) {
      rl.prompt();
      return;
    }

    // Split by spaces, handling multiple spaces gracefully
    const parts = trimmed.split(/\s+/);
    const command = parts[0].toLowerCase();
    const args = parts.slice(1);

    executeCommand(command, args);
    rl.prompt();
  }).on('close', () => {
    console.log('Bye!');
    process.exit(0);
  });
}
