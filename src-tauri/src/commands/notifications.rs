use tauri::{AppHandle, Manager, UserAttentionType};

#[tauri::command]
pub fn request_attention(app_handle: AppHandle, critical: bool) -> Result<(), String> {
    let window = app_handle
        .get_webview_window("main")
        .ok_or_else(|| "Main window not found".to_string())?;

    let attention_type = if critical {
        Some(UserAttentionType::Critical)
    } else {
        Some(UserAttentionType::Informational)
    };

    window
        .request_user_attention(attention_type)
        .map_err(|e| format!("Failed to request attention: {}", e))?;

    Ok(())
}

#[tauri::command]
pub fn is_window_focused(app_handle: AppHandle) -> Result<bool, String> {
    let window = app_handle
        .get_webview_window("main")
        .ok_or_else(|| "Main window not found".to_string())?;

    window
        .is_focused()
        .map_err(|e| format!("Failed to check focus: {}", e))
}
