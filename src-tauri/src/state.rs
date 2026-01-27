use std::sync::Mutex;
use std::fs;
use std::path::PathBuf;
use crate::commands::projects::Project;

pub struct AppState {
    pub projects: Mutex<Vec<Project>>,
}

impl AppState {
    pub fn new() -> Self {
        let projects = load_projects().unwrap_or_default();
        Self {
            projects: Mutex::new(projects),
        }
    }
}

impl Default for AppState {
    fn default() -> Self {
        Self::new()
    }
}

fn get_config_path() -> PathBuf {
    let config_dir = dirs::config_dir()
        .unwrap_or_else(|| PathBuf::from("."))
        .join("agent-station");

    if !config_dir.exists() {
        let _ = fs::create_dir_all(&config_dir);
    }

    config_dir.join("projects.json")
}

pub fn load_projects() -> Result<Vec<Project>, String> {
    let config_path = get_config_path();

    if !config_path.exists() {
        return Ok(Vec::new());
    }

    let content = fs::read_to_string(&config_path)
        .map_err(|e| format!("Failed to read config file: {}", e))?;

    serde_json::from_str(&content)
        .map_err(|e| format!("Failed to parse config file: {}", e))
}

pub fn save_projects(projects: &[Project]) -> Result<(), String> {
    let config_path = get_config_path();

    let content = serde_json::to_string_pretty(projects)
        .map_err(|e| format!("Failed to serialize projects: {}", e))?;

    fs::write(&config_path, content)
        .map_err(|e| format!("Failed to write config file: {}", e))
}
