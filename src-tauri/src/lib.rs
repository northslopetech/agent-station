mod commands;
mod state;

use commands::{filesystem, projects, tasks, terminal};

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_opener::init())
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_fs::init())
        .manage(state::AppState::new())
        .manage(terminal::TerminalManager::new())
        .invoke_handler(tauri::generate_handler![
            // Project commands
            projects::get_projects,
            projects::add_project,
            projects::remove_project,
            // Filesystem commands
            filesystem::list_directory,
            filesystem::read_file,
            filesystem::write_file,
            filesystem::create_file,
            filesystem::create_directory,
            filesystem::rename_path,
            filesystem::delete_path,
            filesystem::move_path,
            // Task commands
            tasks::get_task_progress,
            tasks::get_claude_task_progress,
            // Terminal commands
            terminal::spawn_terminal,
            terminal::write_terminal,
            terminal::resize_terminal,
            terminal::kill_terminal,
            terminal::get_terminal_status,
            terminal::get_terminal_for_project,
            terminal::list_terminals,
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
