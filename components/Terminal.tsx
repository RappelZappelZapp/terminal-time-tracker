import React, { useState, useEffect, useRef } from 'react';
import { TerminalLine, CommandType } from '../types';
import * as Storage from '../services/storage';

const INITIAL_MESSAGE: TerminalLine = {
  id: 'init',
  type: 'system',
  content: (
    <div>
      <p className="text-green-400 mb-2">Terminal Time Tracker v1.2.0</p>
      <p>Type <span className="text-yellow-300">help</span> to see available commands.</p>
      <p className="text-gray-500 text-xs mt-2">Note: This is a web preview. For the native Mac app, see 'cli.js'.</p>
      <br />
    </div>
  ),
};

const HELP_MESSAGE = (
  <div className="space-y-1 text-gray-300">
    <p>Available commands:</p>
    <ul className="list-disc pl-5 space-y-1">
      <li>
        <span className="text-yellow-300">add &lt;project&gt; &lt;hours&gt; [date] &lt;desc...&gt;</span>
        <br/>
        <span className="text-gray-500 text-sm ml-4">e.g. add work 1.5 2023-10-27 "Fixing bugs"</span>
        <br/>
        <span className="text-gray-500 text-sm ml-4">Description is mandatory. Date is optional (default: today).</span>
      </li>
      <li><span className="text-yellow-300">report [YYYY-MM]</span> - View aggregated time report.</li>
      <li><span className="text-yellow-300">readme</span> - Show installation and usage guide.</li>
      <li><span className="text-yellow-300">clear</span> - Clear the terminal screen.</li>
      <li><span className="text-yellow-300">help</span> - Show this message.</li>
    </ul>
  </div>
);

const README_MESSAGE = (
  <div className="space-y-2 text-gray-300 border-l-2 border-gray-600 pl-4 my-2">
    <h3 className="text-lg text-white font-bold">README.md</h3>
    <p><strong>Installation:</strong></p>
    <ol className="list-decimal pl-5 space-y-1">
      <li>Ensure Node.js is installed on your Mac.</li>
      <li>Download <span className="text-green-300">cli.js</span> from this project.</li>
      <li>Run <code className="bg-gray-800 px-1">node cli.js</code> in your terminal.</li>
    </ol>
    <p><strong>Data Storage:</strong></p>
    <p>Data is stored in <code className="bg-gray-800 px-1">data.json</code> in the same directory as the script.</p>
    <p><strong>Usage:</strong></p>
    <code className="block bg-gray-900 p-2 text-sm text-green-300">
      $ add website-redesign 0.75 "Initial setup"<br/>
      $ add backend-api 2 2023-10-25 "Database migration"<br/>
      $ add meeting 0.5 "Weekly Sync"<br/>
      $ report<br/>
      $ report 2023-10
    </code>
  </div>
);

const Terminal: React.FC = () => {
  const [history, setHistory] = useState<TerminalLine[]>([INITIAL_MESSAGE]);
  const [input, setInput] = useState('');
  const bottomRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [history]);

  // Focus input on click anywhere
  const handleContainerClick = () => {
    inputRef.current?.focus();
  };

  const addToHistory = (type: TerminalLine['type'], content: React.ReactNode) => {
    setHistory(prev => [...prev, { id: Math.random().toString(36), type, content }]);
  };

  const processCommand = (cmdString: string) => {
    const trimmed = cmdString.trim();
    if (!trimmed) return;

    // Echo input
    addToHistory('input', <span className="text-white">$ {trimmed}</span>);

    const parts = trimmed.split(' ');
    const command = parts[0].toLowerCase();
    const args = parts.slice(1);

    try {
      switch (command) {
        case CommandType.HELP:
          addToHistory('output', HELP_MESSAGE);
          break;

        case CommandType.README:
          addToHistory('output', README_MESSAGE);
          break;

        case CommandType.CLEAR:
          setHistory([]);
          break;

        case CommandType.ADD: {
          // Expecting: add <project> <hours> [date] <description...>
          // Minimum args: 3 (project, hours, description)
          if (args.length < 3) {
            addToHistory('error', 'Usage: add <project> <hours> [date] <description...>');
            break;
          }
          const project = args[0];
          const hours = parseFloat(args[1]);
          
          if (isNaN(hours)) {
            addToHistory('error', 'Error: Duration must be a number (hours).');
            break;
          }

          // Convert hours to minutes for storage consistency
          const minutes = Math.round(hours * 60);

          // Parsing Strategy: Check if 3rd arg is a date
          let date = new Date().toISOString().split('T')[0];
          let description = "";
          let nextArgIndex = 2;

          if (args[nextArgIndex]) {
             // Simple regex for YYYY-MM-DD
             if (/^\d{4}-\d{2}-\d{2}$/.test(args[nextArgIndex])) {
                date = args[nextArgIndex];
                nextArgIndex++;
             }
          }

          // Check if description is present
          if (args.length <= nextArgIndex) {
            addToHistory('error', 'Error: Description is mandatory.');
            break;
          }

          description = args.slice(nextArgIndex).join(' ');

          const entry = Storage.saveEntry({ project, durationMinutes: minutes, date, description });
          addToHistory('output', `Entry added: ${entry.project} - ${hours}h on ${entry.date} ("${entry.description}")`);
          break;
        }

        case CommandType.REPORT: {
          const month = args[0]; // Optional YYYY-MM
          const report = Storage.generateReport(month);
          addToHistory('output', <pre className="whitespace-pre-wrap font-mono text-sm">{report}</pre>);
          break;
        }

        default:
          addToHistory('error', `Command not found: ${command}. Type 'help' for list.`);
      }
    } catch (err) {
      addToHistory('error', `System Error: ${(err as Error).message}`);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      processCommand(input);
      setInput('');
    }
  };

  return (
    <div 
      className="min-h-screen bg-black p-4 font-mono text-base md:text-lg flex flex-col"
      onClick={handleContainerClick}
    >
      <div className="flex-1 space-y-1">
        {history.map((line) => (
          <div key={line.id} className={`${line.type === 'error' ? 'text-red-400' : line.type === 'input' ? 'text-gray-400' : 'text-gray-200'} break-words`}>
            {line.content}
          </div>
        ))}
        <div ref={bottomRef} />
      </div>

      <div className="mt-4 flex items-center bg-gray-900/50 p-2 rounded border border-gray-800 sticky bottom-4">
        <span className="text-green-500 mr-2 font-bold">{'>'}</span>
        <input
          ref={inputRef}
          type="text"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={handleKeyDown}
          className="flex-1 bg-transparent border-none outline-none text-white placeholder-gray-600 caret-green-500"
          placeholder="Type command..."
          autoFocus
        />
        <div className="w-2 h-5 bg-green-500 cursor-blink ml-1"></div>
      </div>
    </div>
  );
};

export default Terminal;