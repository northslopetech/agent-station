# Agent Station

A lightweight desktop application for monitoring and managing multiple Claude Code agents working simultaneously across different project folders.

## The Problem

When running multiple Claude Code agents in parallel across different projects, there's no unified interface to:
- Quickly switch context between projects
- See the file state of each project alongside the agent's activity
- Edit files (especially markdown like CLAUDE.md) while monitoring agent progress
- Maintain awareness of what each agent is doing without juggling terminal windows

## The Solution

A four-pane desktop application that provides unified management of multiple AI coding agents:

```
┌──────────────┬────────────────┬───────────────────┬────────────────────┐
│   Projects   │   File Tree    │   Editor Pane     │      Terminal      │
│    (200px)   │    (250px)     │    (flexible)     │      (400px)       │
├──────────────┼────────────────┼───────────────────┼────────────────────┤
│ ● project-a  │ 📁 src/        │                   │ ~/project-a $      │
│   project-b  │ 📁 docs/       │  # CLAUDE.md      │ $ claude           │
│   project-c  │ 📄 CLAUDE.md   │                   │                    │
│   project-d  │ 📄 README.md   │  Content here     │ Working on...      │
│              │ 📄 package.json│  that you can     │                    │
│  [+ Add]     │                │  edit freely      │                    │
└──────────────┴────────────────┴───────────────────┴────────────────────┘
```

When you click a project, **all panes update** to show that project's context.

## Features

- **Multi-Project Management** - Add and switch between multiple project folders instantly
- **Integrated Terminal** - Full PTY terminal per project with persistent sessions
- **Monaco Editor** - VS Code's editor with syntax highlighting and auto-save
- **File Tree** - Navigate project files with smart filtering (hides node_modules, .git, etc.)
- **Task Board** - Kanban-style board synced with TASKS.md for project tracking
- **Task Details** - Click any task to view full description, status, and dependencies
- **Settings Panel** - Configure auto-start commands, notifications, zoom level, and more
- **Notifications** - Get notified when Claude stops (with optional sound alerts)
- **Filesystem Watching** - Auto-refreshes when files change on disk
- **Dark Mode** - Follows system preference
- **Lightweight** - ~10MB binary, minimal resource usage

## Installation

### Download Release

Download the latest release for your platform from the [Releases](https://github.com/northslopetech/agent-station/releases) page.

- **macOS**: Download the `.dmg` file, open it, and drag Agent Station to Applications
- **Linux**: Download the `.AppImage` or `.deb` file
- **Windows**: Download the `.msi` installer

### Build from Source

Prerequisites:
- [Rust](https://rustup.rs/) (latest stable)
- [Node.js](https://nodejs.org/) 18+
- [pnpm](https://pnpm.io/) (recommended) or npm

```bash
# Clone the repository
git clone https://github.com/northslopetech/agent-station.git
cd agent-station

# Install dependencies
pnpm install

# Run in development mode
pnpm tauri dev

# Build for production
pnpm tauri build
```

## Usage

1. **Add a Project** - Click "+ Add Project" and select a folder
2. **Start an Agent** - In the terminal pane, run `claude` (or any command)
3. **Switch Projects** - Click any project in the left panel to switch context
4. **Edit Files** - Click files in the tree to edit them while watching the agent work
5. **Track Tasks** - Use the Kanban board (synced with TASKS.md) to manage work

## Tech Stack

- **[Tauri 2.x](https://tauri.app/)** - Rust backend, minimal footprint
- **[React 19](https://react.dev/)** - Frontend UI
- **[TypeScript](https://www.typescriptlang.org/)** - Type safety
- **[Tailwind CSS](https://tailwindcss.com/)** - Styling
- **[Monaco Editor](https://microsoft.github.io/monaco-editor/)** - VS Code's editor component
- **[xterm.js](https://xtermjs.org/)** - Terminal emulator
- **[Zustand](https://zustand-demo.pmnd.rs/)** - State management

## Contributing

Contributions are welcome! Please see [CONTRIBUTING.md](CONTRIBUTING.md) for guidelines.

## License

[MIT](LICENSE) - Alexander Howard
