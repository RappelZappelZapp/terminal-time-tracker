import fs from 'fs';
import readline from 'readline';
import path from 'path';
import { fileURLToPath } from 'url';
import crypto from 'crypto';

// Replicate __dirname in ESM
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const DATA_FILE = path.join(__dirname, 'data.json');
const ACTIVE_COUNTER_FILE = path.join(__dirname, 'active_counter.json');

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

  startCounter(project, description) {
    const state = {
      project,
      description,
      startTime: Date.now(),
      lastStartTime: Date.now(),
      accumulatedTime: 0,
      paused: false
    };
    fs.writeFileSync(ACTIVE_COUNTER_FILE, JSON.stringify(state, null, 2));
    return state;
  },

  pauseCounter() {
    const state = this.getActiveCounter();
    if (!state || state.paused) return null;

    state.accumulatedTime += Date.now() - state.lastStartTime;
    state.paused = true;
    state.lastStartTime = null;

    fs.writeFileSync(ACTIVE_COUNTER_FILE, JSON.stringify(state, null, 2));
    return state;
  },

  resumeCounter() {
    const state = this.getActiveCounter();
    if (!state || !state.paused) return null;

    state.lastStartTime = Date.now();
    state.paused = false;

    fs.writeFileSync(ACTIVE_COUNTER_FILE, JSON.stringify(state, null, 2));
    return state;
  },

  stopCounter() {
    const state = this.getActiveCounter();
    if (!state) return null;

    let totalElapsed = state.accumulatedTime;
    if (!state.paused) {
      totalElapsed += Date.now() - state.lastStartTime;
    }

    const durationMinutes = Math.round(totalElapsed / (1000 * 60));
    const date = new Date().toISOString().split('T')[0];

    const entry = this.saveEntry({
      project: state.project,
      durationMinutes,
      date,
      description: state.description
    });

    fs.unlinkSync(ACTIVE_COUNTER_FILE);
    return { entry, durationMinutes };
  },

  getActiveCounter() {
    if (!fs.existsSync(ACTIVE_COUNTER_FILE)) return null;
    try {
      return JSON.parse(fs.readFileSync(ACTIVE_COUNTER_FILE, 'utf8'));
    } catch (err) {
      return null;
    }
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
  start <project> <description...>               Start a background counter
  pause                                          Pause the active counter
  resume                                         Resume the paused counter
  stop                                           Stop the active counter and save the entry
  status                                         Check the status of the active counter
  add <project> <hours> [date] <description...>  Add a new time entry
                                                 Date format: YYYY-MM-DD (optional, defaults to today)
                                                 Description is mandatory.
  report [YYYY-MM]                               View aggregated report
  table [YYYY-MM]                                View table format (date + descriptions) for Excel
  readme                                         Show usage info
  clear                                          Clear screen
  exit                                           Exit the application

Examples:
  One-shot Mode:    node cli.js report
                    node cli.js add work 1.5 "Bug fixing"
                    node cli.js start project-x "Working on feature"
                    node cli.js pause
                    node cli.js resume
                    node cli.js stop
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

  Start/Stop counter:
    $ start project-x "Developing new feature"
    $ status
    $ pause
    $ resume
    $ stop

  Add time entries manually:
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
    One-shot:     $ node cli.js report
                  $ node cli.js start project-x "Task"
                  $ node cli.js pause
                  $ node cli.js stop
  
  Tip: Create an alias for quick access:
    alias tt="node ~/path/to/cli.js"
    Then use: tt start project-x "Task"
      `);
      break;

    case 'clear':
      console.clear();
      break;

    case 'start':
      if (args.length < 2) {
        console.log('\x1b[31mUsage: start <project> <description...>\x1b[0m');
      } else {
        const active = TrackerService.getActiveCounter();
        if (active) {
          console.log(`\x1b[31mError: A counter is already running for project "${active.project}". Stop it first.\x1b[0m`);
        } else {
          const project = args[0];
          const description = args.slice(1).join(' ');
          TrackerService.startCounter(project, description);
          console.log(`\x1b[32mCounter started for project "${project}"\x1b[0m`);
        }
      }
      break;

    case 'stop':
      const result = TrackerService.stopCounter();
      if (result) {
        const { entry, durationMinutes } = result;
        console.log(`\x1b[32mCounter stopped. Recorded ${durationMinutes}m for project "${entry.project}".\x1b[0m`);
      } else {
        console.log('\x1b[31mNo active counter found.\x1b[0m');
      }
      break;

    case 'pause':
      if (TrackerService.pauseCounter()) {
        console.log('\x1b[33mCounter paused.\x1b[0m');
      } else {
        const active = TrackerService.getActiveCounter();
        if (!active) {
          console.log('\x1b[31mNo active counter found.\x1b[0m');
        } else if (active.paused) {
          console.log('\x1b[31mCounter is already paused.\x1b[0m');
        }
      }
      break;

    case 'resume':
      if (TrackerService.resumeCounter()) {
        console.log('\x1b[32mCounter resumed.\x1b[0m');
      } else {
        const active = TrackerService.getActiveCounter();
        if (!active) {
          console.log('\x1b[31mNo active counter found.\x1b[0m');
        } else if (!active.paused) {
          console.log('\x1b[31mCounter is already running.\x1b[0m');
        }
      }
      break;

    case 'status':
      const active = TrackerService.getActiveCounter();
      if (active) {
        let totalElapsed = active.accumulatedTime;
        if (!active.paused) {
          totalElapsed += Date.now() - active.lastStartTime;
        }
        const elapsedMinutes = Math.round(totalElapsed / (1000 * 60));
        
        console.log(`\x1b[36mActive Counter:\x1b[0m`);
        console.log(` - Project: ${active.project}`);
        console.log(` - Description: ${active.description}`);
        console.log(` - Status: ${active.paused ? '\x1b[33mPaused\x1b[0m' : '\x1b[32mRunning\x1b[0m'}`);
        console.log(` - Started: ${new Date(active.startTime).toLocaleTimeString()}`);
        console.log(` - Elapsed: ${TrackerService.formatDuration(elapsedMinutes)}`);
      } else {
        console.log('No active counter.');
      }
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
