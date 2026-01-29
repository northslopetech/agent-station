use serde::{Deserialize, Serialize};
use std::fs;
use std::path::Path;
use uuid::Uuid;

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Project {
    pub id: String,
    pub name: String,
    pub path: String,
    #[serde(rename = "hasActiveProcess", alias = "isAgentRunning")]
    pub has_active_process: bool,
}

#[tauri::command]
pub fn get_projects(state: tauri::State<'_, crate::state::AppState>) -> Result<Vec<Project>, String> {
    let projects = state.projects.lock().map_err(|e| e.to_string())?;
    Ok(projects.clone())
}

#[tauri::command]
pub fn add_project(path: String, state: tauri::State<'_, crate::state::AppState>) -> Result<Project, String> {
    let path_obj = Path::new(&path);

    if !path_obj.exists() {
        return Err("Path does not exist".to_string());
    }

    if !path_obj.is_dir() {
        return Err("Path is not a directory".to_string());
    }

    let name = path_obj
        .file_name()
        .and_then(|n| n.to_str())
        .unwrap_or("Unknown")
        .to_string();

    let project = Project {
        id: Uuid::new_v4().to_string(),
        name,
        path,
        has_active_process: false,
    };

    let mut projects = state.projects.lock().map_err(|e| e.to_string())?;

    // Check if project already exists
    if projects.iter().any(|p| p.path == project.path) {
        return Err("Project already exists".to_string());
    }

    projects.push(project.clone());

    // Save to config file
    if let Err(e) = crate::state::save_projects(&projects) {
        eprintln!("Failed to save projects: {}", e);
    }

    // Initialize Claude task directory for this project
    if let Err(e) = initialize_task_directory(&project.id, &project.name) {
        eprintln!("Failed to initialize task directory: {}", e);
    }

    // Create TASKS.md if it doesn't exist
    if let Err(e) = crate::commands::tasks::create_tasks_md(project.path.clone(), project.name.clone()) {
        eprintln!("Failed to create TASKS.md: {}", e);
    }

    // Create CLAUDE.md if it doesn't exist
    let claude_md_path = Path::new(&project.path).join("CLAUDE.md");
    if !claude_md_path.exists() {
        let template = format!("# {}\n\nProject instructions and context for Claude.\n", project.name);
        if let Err(e) = fs::write(&claude_md_path, template) {
            eprintln!("Failed to create CLAUDE.md: {}", e);
        }
    }

    Ok(project)
}

/// Initialize the Claude task directory for a new project with a starter task
fn initialize_task_directory(project_id: &str, project_name: &str) -> Result<(), String> {
    let home_dir = dirs::home_dir().ok_or("Could not determine home directory")?;
    let tasks_dir = home_dir.join(".claude").join("tasks").join(project_id);

    // Only create if it doesn't already exist
    if tasks_dir.exists() {
        return Ok(());
    }

    // Create the directory
    fs::create_dir_all(&tasks_dir).map_err(|e| format!("Failed to create tasks directory: {}", e))?;

    // Create an initial starter task
    let starter_task = serde_json::json!({
        "id": "1",
        "subject": format!("Set up {} project", project_name),
        "status": "pending",
        "description": "Initial task created by Agent Station. Update or delete as needed.",
        "blocks": [],
        "blockedBy": []
    });

    let task_file = tasks_dir.join("1.json");
    let task_content = serde_json::to_string_pretty(&starter_task)
        .map_err(|e| format!("Failed to serialize task: {}", e))?;

    fs::write(&task_file, task_content)
        .map_err(|e| format!("Failed to write task file: {}", e))?;

    Ok(())
}

#[tauri::command]
pub fn remove_project(id: String, state: tauri::State<'_, crate::state::AppState>) -> Result<(), String> {
    let mut projects = state.projects.lock().map_err(|e| e.to_string())?;

    let initial_len = projects.len();
    projects.retain(|p| p.id != id);

    if projects.len() == initial_len {
        return Err("Project not found".to_string());
    }

    // Save to config file
    if let Err(e) = crate::state::save_projects(&projects) {
        eprintln!("Failed to save projects: {}", e);
    }

    Ok(())
}
