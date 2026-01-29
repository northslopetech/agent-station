use portable_pty::{native_pty_system, CommandBuilder, MasterPty, PtySize};
use serde::{Deserialize, Serialize};
use std::collections::HashMap;
use std::io::{Read, Write};
use std::sync::{Arc, Mutex};
use std::thread;
use tauri::{AppHandle, Emitter};
use uuid::Uuid;

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct TerminalInfo {
    pub id: String,
    #[serde(rename = "projectId")]
    pub project_id: String,
    #[serde(rename = "isRunning")]
    pub is_running: bool,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct TerminalOutput {
    #[serde(rename = "terminalId")]
    pub terminal_id: String,
    pub data: String,
}

pub struct TerminalInstance {
    pub id: String,
    pub project_id: String,
    pub writer: Arc<Mutex<Box<dyn Write + Send>>>,
    pub master: Arc<Mutex<Box<dyn MasterPty + Send>>>,
    pub running: Arc<Mutex<bool>>,
}

pub struct TerminalManager {
    pub terminals: Mutex<HashMap<String, TerminalInstance>>,
}

impl TerminalManager {
    pub fn new() -> Self {
        Self {
            terminals: Mutex::new(HashMap::new()),
        }
    }
}

impl Default for TerminalManager {
    fn default() -> Self {
        Self::new()
    }
}

#[tauri::command]
pub fn spawn_terminal(
    project_id: String,
    cwd: String,
    app_handle: AppHandle,
    state: tauri::State<'_, TerminalManager>,
) -> Result<String, String> {
    let pty_system = native_pty_system();

    let pair = pty_system
        .openpty(PtySize {
            rows: 24,
            cols: 80,
            pixel_width: 0,
            pixel_height: 0,
        })
        .map_err(|e| format!("Failed to open PTY: {}", e))?;

    // Get user's default shell, fallback to bash
    let shell = std::env::var("SHELL").unwrap_or_else(|_| "/bin/bash".to_string());

    // Spawn as login shell to load user's profile (PATH, etc.)
    let mut cmd = CommandBuilder::new(&shell);
    cmd.arg("-l"); // Login shell flag
    cmd.cwd(&cwd);

    // Set environment variables for a better terminal experience
    cmd.env("TERM", "xterm-256color");
    cmd.env("COLORTERM", "truecolor");
    // Enable Claude Code multi-agent task sharing
    cmd.env("CLAUDE_CODE_TASK_LIST_ID", &project_id);

    let mut child = pair
        .slave
        .spawn_command(cmd)
        .map_err(|e| format!("Failed to spawn command: {}", e))?;

    let terminal_id = Uuid::new_v4().to_string();
    let terminal_id_clone = terminal_id.clone();

    let reader = pair
        .master
        .try_clone_reader()
        .map_err(|e| format!("Failed to clone reader: {}", e))?;

    let writer = pair
        .master
        .take_writer()
        .map_err(|e| format!("Failed to take writer: {}", e))?;

    let writer = Arc::new(Mutex::new(writer));
    let master = Arc::new(Mutex::new(pair.master));
    let running = Arc::new(Mutex::new(true));
    let running_clone = running.clone();

    // Store terminal instance
    {
        let mut terminals = state.terminals.lock().map_err(|e| e.to_string())?;
        terminals.insert(
            terminal_id.clone(),
            TerminalInstance {
                id: terminal_id.clone(),
                project_id: project_id.clone(),
                writer: writer.clone(),
                master: master.clone(),
                running: running.clone(),
            },
        );
    }

    // Spawn reader thread
    let app_handle_clone = app_handle.clone();
    thread::spawn(move || {
        let mut reader = reader;
        let mut buf = [0u8; 4096];

        loop {
            match reader.read(&mut buf) {
                Ok(0) => {
                    // EOF
                    break;
                }
                Ok(n) => {
                    let data = String::from_utf8_lossy(&buf[..n]).to_string();
                    let _ = app_handle_clone.emit(
                        "terminal-output",
                        TerminalOutput {
                            terminal_id: terminal_id_clone.clone(),
                            data,
                        },
                    );
                }
                Err(e) => {
                    eprintln!("Error reading from PTY: {}", e);
                    break;
                }
            }
        }

        // Mark as not running
        if let Ok(mut running) = running_clone.lock() {
            *running = false;
        }

        let _ = app_handle_clone.emit(
            "terminal-exit",
            TerminalOutput {
                terminal_id: terminal_id_clone,
                data: String::new(),
            },
        );
    });

    // Spawn a thread to wait for the child process
    thread::spawn(move || {
        let _ = child.wait();
    });

    Ok(terminal_id)
}

#[tauri::command]
pub fn write_terminal(
    terminal_id: String,
    data: String,
    state: tauri::State<'_, TerminalManager>,
) -> Result<(), String> {
    let terminals = state.terminals.lock().map_err(|e| e.to_string())?;

    let terminal = terminals
        .get(&terminal_id)
        .ok_or_else(|| "Terminal not found".to_string())?;

    let mut writer = terminal.writer.lock().map_err(|e| e.to_string())?;
    writer
        .write_all(data.as_bytes())
        .map_err(|e| format!("Failed to write to terminal: {}", e))?;
    writer
        .flush()
        .map_err(|e| format!("Failed to flush: {}", e))?;

    Ok(())
}

#[tauri::command]
pub fn resize_terminal(
    terminal_id: String,
    cols: u16,
    rows: u16,
    state: tauri::State<'_, TerminalManager>,
) -> Result<(), String> {
    let terminals = state.terminals.lock().map_err(|e| e.to_string())?;

    let terminal = terminals
        .get(&terminal_id)
        .ok_or_else(|| "Terminal not found".to_string())?;

    let master = terminal.master.lock().map_err(|e| e.to_string())?;
    master
        .resize(PtySize {
            rows,
            cols,
            pixel_width: 0,
            pixel_height: 0,
        })
        .map_err(|e| format!("Failed to resize terminal: {}", e))?;

    Ok(())
}

#[tauri::command]
pub fn kill_terminal(
    terminal_id: String,
    state: tauri::State<'_, TerminalManager>,
) -> Result<(), String> {
    let mut terminals = state.terminals.lock().map_err(|e| e.to_string())?;

    if let Some(terminal) = terminals.remove(&terminal_id) {
        // Mark as not running
        if let Ok(mut running) = terminal.running.lock() {
            *running = false;
        }

        // Send Ctrl+C to the terminal
        if let Ok(mut writer) = terminal.writer.lock() {
            let _ = writer.write_all(&[3]); // Ctrl+C
            let _ = writer.flush();
        }
    }

    Ok(())
}

#[tauri::command]
pub fn get_terminal_status(
    terminal_id: String,
    state: tauri::State<'_, TerminalManager>,
) -> Result<bool, String> {
    let terminals = state.terminals.lock().map_err(|e| e.to_string())?;

    if let Some(terminal) = terminals.get(&terminal_id) {
        if let Ok(running) = terminal.running.lock() {
            return Ok(*running);
        }
    }

    Ok(false)
}

#[tauri::command]
pub fn get_terminal_for_project(
    project_id: String,
    state: tauri::State<'_, TerminalManager>,
) -> Result<Option<TerminalInfo>, String> {
    let terminals = state.terminals.lock().map_err(|e| e.to_string())?;

    for terminal in terminals.values() {
        if terminal.project_id == project_id {
            let is_running = terminal
                .running
                .lock()
                .map(|r| *r)
                .unwrap_or(false);

            return Ok(Some(TerminalInfo {
                id: terminal.id.clone(),
                project_id: terminal.project_id.clone(),
                is_running,
            }));
        }
    }

    Ok(None)
}

#[tauri::command]
pub fn list_terminals(
    state: tauri::State<'_, TerminalManager>,
) -> Result<Vec<TerminalInfo>, String> {
    let terminals = state.terminals.lock().map_err(|e| e.to_string())?;

    let mut result = Vec::new();
    for terminal in terminals.values() {
        let is_running = terminal
            .running
            .lock()
            .map(|r| *r)
            .unwrap_or(false);

        result.push(TerminalInfo {
            id: terminal.id.clone(),
            project_id: terminal.project_id.clone(),
            is_running,
        });
    }

    Ok(result)
}
