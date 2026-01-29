use serde::{Deserialize, Serialize};
use std::fs;
use std::path::Path;

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct FileEntry {
    pub name: String,
    pub path: String,
    #[serde(rename = "isDirectory")]
    pub is_directory: bool,
    pub children: Option<Vec<FileEntry>>,
}

const HIDDEN_DIRS: &[&str] = &[
    "node_modules",
    ".git",
    "__pycache__",
    ".venv",
    "target",
    "dist",
    "build",
    ".next",
    ".nuxt",
    ".svelte-kit",
    "coverage",
    ".cache",
    ".idea",
    ".vscode",
];

#[tauri::command]
pub fn list_directory(path: String, show_hidden: Option<bool>) -> Result<Vec<FileEntry>, String> {
    let path_obj = Path::new(&path);
    let show_hidden = show_hidden.unwrap_or(false);

    if !path_obj.exists() {
        return Err("Path does not exist".to_string());
    }

    if !path_obj.is_dir() {
        return Err("Path is not a directory".to_string());
    }

    let mut entries: Vec<FileEntry> = Vec::new();

    let read_dir = fs::read_dir(path_obj)
        .map_err(|e| format!("Failed to read directory: {}", e))?;

    for entry in read_dir.flatten() {
        let entry_path = entry.path();
        let name = entry
            .file_name()
            .to_string_lossy()
            .to_string();

        if !show_hidden {
            // Skip hidden files and filtered directories
            if name.starts_with('.') && name != ".env" && name != ".env.local" {
                continue;
            }

            let is_directory = entry_path.is_dir();

            // Skip hidden directories
            if is_directory && HIDDEN_DIRS.contains(&name.as_str()) {
                continue;
            }
        }

        let is_directory = entry_path.is_dir();

        entries.push(FileEntry {
            name,
            path: entry_path.to_string_lossy().to_string(),
            is_directory,
            children: None,
        });
    }

    // Sort: directories first, then alphabetically
    entries.sort_by(|a, b| {
        match (a.is_directory, b.is_directory) {
            (true, false) => std::cmp::Ordering::Less,
            (false, true) => std::cmp::Ordering::Greater,
            _ => a.name.to_lowercase().cmp(&b.name.to_lowercase()),
        }
    });

    Ok(entries)
}

#[tauri::command]
pub fn read_file(path: String) -> Result<String, String> {
    let path_obj = Path::new(&path);

    if !path_obj.exists() {
        return Err("File does not exist".to_string());
    }

    if !path_obj.is_file() {
        return Err("Path is not a file".to_string());
    }

    // Check file size (warn if > 1MB)
    let metadata = fs::metadata(&path_obj)
        .map_err(|e| format!("Failed to read file metadata: {}", e))?;

    if metadata.len() > 1_000_000 {
        return Err("File is larger than 1MB. Consider opening in an external editor.".to_string());
    }

    fs::read_to_string(path_obj)
        .map_err(|e| format!("Failed to read file: {}", e))
}

#[tauri::command]
pub fn write_file(path: String, content: String) -> Result<(), String> {
    let path_obj = Path::new(&path);

    // Ensure parent directory exists
    if let Some(parent) = path_obj.parent() {
        if !parent.exists() {
            fs::create_dir_all(parent)
                .map_err(|e| format!("Failed to create parent directory: {}", e))?;
        }
    }

    fs::write(path_obj, content)
        .map_err(|e| format!("Failed to write file: {}", e))
}

#[tauri::command]
pub fn create_file(path: String) -> Result<(), String> {
    let path_obj = Path::new(&path);

    if path_obj.exists() {
        return Err("File already exists".to_string());
    }

    // Ensure parent directory exists
    if let Some(parent) = path_obj.parent() {
        if !parent.exists() {
            fs::create_dir_all(parent)
                .map_err(|e| format!("Failed to create parent directory: {}", e))?;
        }
    }

    fs::File::create(path_obj)
        .map_err(|e| format!("Failed to create file: {}", e))?;

    Ok(())
}

#[tauri::command]
pub fn create_directory(path: String) -> Result<(), String> {
    let path_obj = Path::new(&path);

    if path_obj.exists() {
        return Err("Directory already exists".to_string());
    }

    fs::create_dir_all(path_obj)
        .map_err(|e| format!("Failed to create directory: {}", e))
}

#[tauri::command]
pub fn rename_path(old_path: String, new_path: String) -> Result<(), String> {
    let old_path_obj = Path::new(&old_path);
    let new_path_obj = Path::new(&new_path);

    if !old_path_obj.exists() {
        return Err("Source path does not exist".to_string());
    }

    if new_path_obj.exists() {
        return Err("Destination path already exists".to_string());
    }

    fs::rename(old_path_obj, new_path_obj)
        .map_err(|e| format!("Failed to rename: {}", e))
}

#[tauri::command]
pub fn delete_path(path: String) -> Result<(), String> {
    let path_obj = Path::new(&path);

    if !path_obj.exists() {
        return Err("Path does not exist".to_string());
    }

    if path_obj.is_dir() {
        fs::remove_dir_all(path_obj)
            .map_err(|e| format!("Failed to delete directory: {}", e))
    } else {
        fs::remove_file(path_obj)
            .map_err(|e| format!("Failed to delete file: {}", e))
    }
}

#[tauri::command]
pub fn move_path(source_path: String, target_directory: String) -> Result<String, String> {
    let source = Path::new(&source_path);
    let target_dir = Path::new(&target_directory);

    if !source.exists() {
        return Err("Source path does not exist".to_string());
    }

    if !target_dir.exists() {
        return Err("Target directory does not exist".to_string());
    }

    if !target_dir.is_dir() {
        return Err("Target is not a directory".to_string());
    }

    let file_name = source
        .file_name()
        .ok_or("Failed to get file name")?;

    let destination = target_dir.join(file_name);

    if destination.exists() {
        return Err("A file with that name already exists in the destination".to_string());
    }

    fs::rename(source, &destination)
        .map_err(|e| format!("Failed to move: {}", e))?;

    Ok(destination.to_string_lossy().to_string())
}
