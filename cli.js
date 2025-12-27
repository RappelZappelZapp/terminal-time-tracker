import fs from 'fs';
import readline from 'readline';
import path from 'path';
import { fileURLToPath } from 'url';

// Replicate __dirname in ESM
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const DATA_FILE = path.join(__dirname, 'data.json');

// --- Storage Service ---

function getEntries() {
  if (!fs.existsSync(DATA_FILE)) {
    return [];
  }
  try {
    const data = fs.readFileSync(DATA_FILE, 'utf8');
    return JSON.parse(data);
  } catch (err) {
    console.error("Error reading data file:", err.message);
    return [];
  }
}

function saveEntry(entry) {
  const entries = getEntries();
  const newEntry = {
    id: Math.random().toString(36).substring(2, 9),
    project: entry.project,
    durationMinutes: entry.durationMinutes,
    date: entry.date,
    description: entry.description,
    timestamp: Date.now()
  };
  entries.push(newEntry);
  fs.writeFileSync(DATA_FILE, JSON.stringify(entries, null, 2));
  return newEntry;
}

function generateReport(month) {
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

  const projectStats = {};
  let totalMinutes = 0;

  filtered.forEach(e => {
    projectStats[e.project] = (projectStats[e.project] || 0) + e.durationMinutes;
    totalMinutes += e.durationMinutes;
  });

  let output = `\n--- ${title} ---\n`;
  output += `Total Time: ${(totalMinutes / 60).toFixed(2)} hours (${totalMinutes} mins)\n\n`;
  output += `By Project:\n`;
  
  Object.entries(projectStats).forEach(([project, mins]) => {
    output += ` - ${project.padEnd(20)}: ${(mins / 60).toFixed(2)}h (${mins}m)\n`;
  });

  output += `\nBy Day:\n`;

  const dayStats = {};
  filtered.forEach(e => {
    dayStats[e.date] = (dayStats[e.date] || 0) + e.durationMinutes;
  });

  Object.entries(dayStats).sort().forEach(([date, mins]) => {
    const weekdays = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
    const dateObj = new Date(date + 'T00:00:00');
    const dayName = weekdays[dateObj.getDay()];
    const hours = (mins / 60).toFixed(2);
    const hoursStr = hours.padStart(6);
    const minsStr = mins.toString().padStart(3);
    output += ` - ${date} (${dayName.padEnd(9)}): ${hoursStr}h (${minsStr}m)\n`;
  });

  output += `---------------------\n`;
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
  
Usage:
  $ add project-alpha 1.5 "Initial setup"
  $ add design 1 2023-01-01 "Homepage wireframe"
  $ report
  $ report 2023-01
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
            const entry = saveEntry({ project, durationMinutes: minutes, date, description });
            console.log(`Entry added: ${entry.project} - ${hours}h (${minutes}m) on ${entry.date} - "${entry.description}"`);
          }
        }
      }
      break;

    case 'report':
      console.log(generateReport(args[0]));
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
