# Agent Station

A lightweight desktop application for monitoring and managing multiple Claude Code agents working simultaneously across different project folders.

## Problem Statement

When running multiple Claude Code agents in parallel across different projects, there's no unified interface to:
- Quickly switch context between projects
- See the file state of each project alongside the agent's activity
- Edit files (especially markdown like CLAUDE.md) while monitoring agent progress
- Maintain awareness of what each agent is doing without juggling terminal windows

## Solution

A four-pane desktop application built with Tauri that provides:

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

**Key behaviour**: When you click a project in the left panel, ALL other panels update to show that project's context.

## Technical Architecture

### Stack
- **Tauri 2.x** - Rust backend, minimal footprint (~10MB)
- **React 18** with TypeScript - Frontend UI
- **Tailwind CSS** - Styling
- **Monaco Editor** - VS Code's editor component for the editor pane
- **xterm.js** - Terminal emulator for the agent pane
- **Zustand** - Lightweight state management

### Project Structure
```
agent-station/
├── src-tauri/
│   ├── src/
│   │   ├── main.rs           # Tauri entry point
│   │   ├── lib.rs            # Library root
│   │   ├── commands/
│   │   │   ├── mod.rs
│   │   │   ├── filesystem.rs # File operations
│   │   │   ├── terminal.rs   # PTY management
│   │   │   └── projects.rs   # Project CRUD
│   │   └── state.rs          # App state
│   ├── Cargo.toml
│   └── tauri.conf.json
├── src/
│   ├── App.tsx
│   ├── main.tsx
│   ├── components/
│   │   ├── ProjectList.tsx
│   │   ├── FileTree.tsx
│   │   ├── EditorPane.tsx
│   │   └── TerminalPane.tsx
│   ├── stores/
│   │   └── appStore.ts
│   ├── hooks/
│   │   ├── useFileSystem.ts
│   │   └── useTerminal.ts
│   └── types/
│       └── index.ts
├── package.json
├── tsconfig.json
├── tailwind.config.js
├── vite.config.ts
└── CLAUDE.md
```

## Functional Requirements

### FR1: Project Management

#### FR1.1: Add Project
- User clicks "+ Add Project" button at bottom of project list
- Native folder picker dialog opens
- Selected folder path is added to project list
- Projects persist across app restarts (stored in app config)

#### FR1.2: Remove Project
- Right-click context menu on project shows "Remove" option
- Removes from list only (does not delete files)
- Confirmation not required (easily re-added)

#### FR1.3: Project Display
- Show folder name (not full path)
- Show indicator if terminal has active process (green dot)
- Tooltip shows full path on hover

#### FR1.4: Project Selection
- Single click selects project
- Selection triggers update of all other panes
- Visual highlight on selected project

### FR2: File Tree

#### FR2.1: Directory Listing
- Show contents of selected project folder
- Hierarchical tree with expand/collapse
- Icons for folders vs files
- Sort: folders first, then files, alphabetical

#### FR2.2: File Selection
- Single click opens file in editor pane
- Visual highlight on selected file
- Remember last selected file per project

#### FR2.3: File Filtering
- Hide common non-essential directories: node_modules, .git, __pycache__, .venv, target, dist, build
- This should be configurable but have sensible defaults

#### FR2.4: Auto-refresh
- Watch for filesystem changes in selected project
- Update tree when files are added/removed/renamed
- Debounce updates (500ms)

### FR3: Editor Pane

#### FR3.1: Monaco Integration
- Full Monaco editor with syntax highlighting
- Language detection from file extension
- Theme: match system dark/light preference

#### FR3.2: File Editing
- Load file content when selected in file tree
- Auto-save after 1 second of no typing (debounced)
- Show "saving..." indicator briefly
- Handle large files gracefully (warn if >1MB)

#### FR3.3: Default File
- When project selected, try to open in order:
  1. CLAUDE.md
  2. README.md
  3. First .md file found
  4. Show empty state with message

#### FR3.4: Editor Features
- Line numbers
- Word wrap (configurable)
- Find/replace (Cmd+F / Cmd+H)
- Standard keyboard shortcuts

### FR4: Terminal

#### FR4.1: Terminal Emulator
- xterm.js with full ANSI support
- Fits available space, resizes properly
- Scrollback buffer (10,000 lines)

#### FR4.2: Per-Project Terminal
- Each project gets its own shell session (user's default shell)
- Terminal spawns automatically when project is added/selected
- Working directory set to project folder
- User runs `claude` (or any command) manually when ready

#### FR4.3: Terminal Persistence
- Keep terminal process running when switching projects
- Resume showing output when returning to project
- Clean up processes on app quit

### FR5: Layout & UX

#### FR5.1: Resizable Panes
- Draggable dividers between all panes
- Minimum widths enforced:
  - Projects: 150px min
  - File Tree: 200px min
  - Editor: 300px min
  - Terminal: 300px min
- Remember pane sizes across restarts

#### FR5.2: Keyboard Navigation
- Cmd+1/2/3/4 to focus each pane
- Up/Down arrows in project list to select
- Cmd+O to add project
- Cmd+W to remove current project

#### FR5.3: Visual Design
- Clean, minimal interface
- Dark mode by default (follow system)
- Monospace font in terminal
- Clear visual separation between panes

## Non-Functional Requirements

### NFR1: Performance
- App startup under 2 seconds
- Project switch under 100ms
- File tree population under 200ms for typical project
- Smooth terminal output (no lag on fast output)

### NFR2: Resource Usage
- Memory under 200MB typical usage
- CPU near 0% when idle
- Minimal disk I/O (only on file operations)

### NFR3: Reliability
- Graceful handling of deleted projects
- Handle permission errors on files
- Survive terminal process crashes without app crash
- Auto-reconnect terminal if connection lost

### NFR4: Platform Support
- macOS primary (Apple Silicon + Intel)
- Linux secondary
- Windows tertiary (nice to have)

## Implementation Notes

### Tauri Commands (Rust Backend)

```rust
// Commands to expose to frontend

#[tauri::command]
async fn list_directory(path: String) -> Result<Vec<FileEntry>, String>

#[tauri::command]
async fn read_file(path: String) -> Result<String, String>

#[tauri::command]
async fn write_file(path: String, content: String) -> Result<(), String>

#[tauri::command]
async fn spawn_terminal(project_id: String, cwd: String) -> Result<TerminalId, String>

#[tauri::command]
async fn write_terminal(terminal_id: String, data: String) -> Result<(), String>

#[tauri::command]
async fn resize_terminal(terminal_id: String, cols: u16, rows: u16) -> Result<(), String>

#[tauri::command]
async fn get_projects() -> Result<Vec<Project>, String>

#[tauri::command]
async fn add_project(path: String) -> Result<Project, String>

#[tauri::command]
async fn remove_project(id: String) -> Result<(), String>
```

### State Management (Frontend)

```typescript
interface AppState {
  // Projects
  projects: Project[];
  selectedProjectId: string | null;
  
  // File tree
  fileTree: FileNode | null;
  selectedFilePath: string | null;
  
  // Editor
  editorContent: string;
  editorLanguage: string;
  isDirty: boolean;
  
  // Terminals (keyed by project ID)
  terminals: Map<string, TerminalState>;
  
  // Actions
  selectProject: (id: string) => void;
  selectFile: (path: string) => void;
  updateEditorContent: (content: string) => void;
  saveFile: () => Promise<void>;
}
```

### Terminal PTY Handling

Use the `portable-pty` crate for cross-platform PTY support:

```rust
use portable_pty::{CommandBuilder, PtySize, native_pty_system};

// Each project gets its own PTY
struct ProjectTerminal {
    pty: Box<dyn portable_pty::MasterPty>,
    child: Box<dyn portable_pty::Child>,
    reader: Box<dyn std::io::Read + Send>,
    writer: Box<dyn std::io::Write + Send>,
}
```

### File Watching

Use `notify` crate for filesystem watching:

```rust
use notify::{Watcher, RecursiveMode, watcher};

// Watch selected project directory
// Emit events to frontend via Tauri events
```

## Build & Development

### Prerequisites
- Rust (latest stable)
- Node.js 18+
- pnpm (preferred) or npm

### Development
```bash
# Install dependencies
pnpm install

# Run in development mode
pnpm tauri dev
```

### Building
```bash
# Build for production
pnpm tauri build
```

## Future Enhancements (Out of Scope for V1)

- Multiple windows for multi-monitor setups
- Git status indicators in file tree
- Terminal output search/filtering
- Project groups/folders
- Shared clipboard between panes
- Session recording/playback
- Notifications when window not focused

## Success Criteria

The application is successful when a user can:

1. Add 3-5 project folders to the app
2. Run `claude` in each project's terminal
3. Switch between projects with a single click
4. See the terminal output update immediately
5. Edit a CLAUDE.md file while watching the agent work
6. Have all terminals persist while switching between projects
7. Close and reopen the app with all projects remembered

## Development Approach

Build in this order:

1. **Phase 1**: Basic Tauri app with four-pane layout (no functionality)
2. **Phase 2**: Project list with add/remove and persistence
3. **Phase 3**: File tree with directory listing and file selection
4. **Phase 4**: Monaco editor with file loading and saving
5. **Phase 5**: Terminal with PTY spawning (shell auto-starts per project)
6. **Phase 6**: Polish - resizing, keyboard shortcuts, error handling
7. **Phase 7**: Testing and bug fixes

Each phase should result in a working (if incomplete) application.
