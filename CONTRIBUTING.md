# Contributing to Agent Station

Thank you for your interest in contributing to Agent Station! This document provides guidelines and instructions for contributing.

## Development Environment Setup

### Prerequisites

- [Rust](https://rustup.rs/) (latest stable)
- [Node.js](https://nodejs.org/) 18+
- [pnpm](https://pnpm.io/) (recommended) or npm
- A code editor (VS Code recommended with Tauri and rust-analyzer extensions)

### Getting Started

1. Fork the repository
2. Clone your fork:
   ```bash
   git clone https://github.com/YOUR_USERNAME/agent-station.git
   cd agent-station
   ```
3. Install dependencies:
   ```bash
   pnpm install
   ```
4. Run in development mode:
   ```bash
   pnpm tauri dev
   ```

## Project Structure

```
agent-station/
├── src-tauri/          # Rust backend
│   ├── src/
│   │   ├── main.rs     # Tauri entry point
│   │   ├── lib.rs      # Library root
│   │   └── commands/   # Tauri commands
│   └── Cargo.toml
├── src/                # React frontend
│   ├── components/     # React components
│   ├── stores/         # Zustand stores
│   ├── hooks/          # Custom React hooks
│   └── types/          # TypeScript types
├── package.json
└── CLAUDE.md           # Architecture documentation
```

## Code Style

### Rust

- Run `cargo fmt` before committing
- Run `cargo clippy` and address warnings
- Follow standard Rust naming conventions (snake_case for functions/variables, PascalCase for types)

### TypeScript/React

- Use TypeScript for all new code
- Prefer functional components with hooks
- Use Zustand for state management
- Follow existing patterns in the codebase

### Tailwind CSS

- Use Tailwind utility classes
- Prefer dark mode compatible styling
- Keep component styles consistent with existing UI

## Submitting Changes

### Issues

- Search existing issues before creating a new one
- Use issue templates when available
- Provide clear reproduction steps for bugs
- Include system information (OS, version)

### Pull Requests

1. Create a feature branch from `main`:
   ```bash
   git checkout -b feature/your-feature-name
   ```

2. Make your changes with clear, focused commits

3. Ensure your code:
   - Builds without errors (`pnpm tauri build`)
   - Follows the code style guidelines
   - Includes updates to documentation if needed

4. Push to your fork and open a Pull Request

5. Fill out the PR template with:
   - Description of changes
   - Related issue numbers
   - Testing performed

### Commit Messages

- Use clear, descriptive commit messages
- Start with a verb (Add, Fix, Update, Remove, etc.)
- Reference issues when applicable: `Fix #123: Resolve terminal resize issue`

## Testing

Currently, Agent Station relies on manual testing. When testing your changes:

1. Test on your platform (macOS, Linux, or Windows)
2. Verify the four-pane layout works correctly
3. Test project add/remove functionality
4. Verify terminal sessions persist when switching projects
5. Test file editing and auto-save
6. Check for console errors in DevTools

## Architecture Notes

See [CLAUDE.md](CLAUDE.md) for detailed architecture documentation including:
- Functional requirements
- Technical architecture
- Implementation notes
- State management patterns

## Getting Help

- Open an issue for bugs or feature requests
- Check existing issues and discussions
- Review the architecture documentation in CLAUDE.md

## License

By contributing to Agent Station, you agree that your contributions will be licensed under the MIT License.
