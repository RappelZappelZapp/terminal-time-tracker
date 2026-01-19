# Terminal Time Tracker

A simple CLI-based time tracker for your terminal.

## Usage

1. **Install dependencies:**
   `npm install`

2. **Run the tracker:**
   `npm start`

### create terminal alias
Also create a ~/.zshrc and add an alias there, for example like this:
`alias tt="node $(pwd)/cli.js"`

## Commands
- `add <project> <hours> [date] <description...>`: Add a new time entry
- `report [YYYY-MM]`: View aggregated report
- `table [YYYY-MM]`: View table format for Excel
- `help`: Show available commands
- `exit`: Exit the application
