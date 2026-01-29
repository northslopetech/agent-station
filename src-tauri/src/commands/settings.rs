use serde::{Deserialize, Serialize};
use std::fs;
use std::path::PathBuf;

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Settings {
    #[serde(rename = "autoStartClaude", default)]
    pub auto_start_claude: bool,
    #[serde(rename = "autoStartCommand", default = "default_auto_start_command")]
    pub auto_start_command: String,
    #[serde(rename = "zoomLevel", default = "default_zoom_level")]
    pub zoom_level: f64,
    #[serde(rename = "enableNotifications", default = "default_true")]
    pub enable_notifications: bool,
    #[serde(rename = "enableSound", default = "default_true")]
    pub enable_sound: bool,
    #[serde(rename = "notificationSound", default = "default_sound")]
    pub notification_sound: String,
    #[serde(rename = "notifyOnlyWhenUnfocused", default = "default_true")]
    pub notify_only_when_unfocused: bool,
}

fn default_auto_start_command() -> String {
    "claude --dangerously-skip-permissions".to_string()
}

fn default_zoom_level() -> f64 {
    1.0
}

fn default_true() -> bool {
    true
}

fn default_sound() -> String {
    "default".to_string()
}

impl Default for Settings {
    fn default() -> Self {
        Self {
            auto_start_claude: false,
            auto_start_command: default_auto_start_command(),
            zoom_level: default_zoom_level(),
            enable_notifications: true,
            enable_sound: true,
            notification_sound: default_sound(),
            notify_only_when_unfocused: true,
        }
    }
}

fn get_settings_path() -> Result<PathBuf, String> {
    let home = dirs::home_dir().ok_or_else(|| "Could not find home directory".to_string())?;
    let config_dir = home.join(".config").join("agent-station");

    // Ensure the directory exists
    if !config_dir.exists() {
        fs::create_dir_all(&config_dir)
            .map_err(|e| format!("Failed to create config directory: {}", e))?;
    }

    Ok(config_dir.join("settings.json"))
}

#[tauri::command]
pub fn get_settings() -> Result<Settings, String> {
    let settings_path = get_settings_path()?;

    if !settings_path.exists() {
        return Ok(Settings::default());
    }

    let content =
        fs::read_to_string(&settings_path).map_err(|e| format!("Failed to read settings: {}", e))?;

    serde_json::from_str(&content).map_err(|e| format!("Failed to parse settings: {}", e))
}

#[tauri::command]
pub fn save_settings(settings: Settings) -> Result<(), String> {
    let settings_path = get_settings_path()?;

    let content = serde_json::to_string_pretty(&settings)
        .map_err(|e| format!("Failed to serialize settings: {}", e))?;

    fs::write(&settings_path, content).map_err(|e| format!("Failed to write settings: {}", e))?;

    Ok(())
}
