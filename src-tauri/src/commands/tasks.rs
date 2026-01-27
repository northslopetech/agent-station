use serde::{Deserialize, Serialize};
use std::fs;
use std::path::Path;
use std::sync::Mutex;
use std::collections::HashMap;
use regex::Regex;
use uuid::Uuid;
use notify::{Watcher, RecursiveMode, RecommendedWatcher, Event, EventKind};
use tauri::{AppHandle, Emitter};

// Global state for file watchers
pub struct TasksWatcherState {
    watchers: Mutex<HashMap<String, RecommendedWatcher>>,
}

impl TasksWatcherState {
    pub fn new() -> Self {
        Self {
            watchers: Mutex::new(HashMap::new()),
        }
    }
}

impl Default for TasksWatcherState {
    fn default() -> Self {
        Self::new()
    }
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct TaskProgress {
    pub total: usize,
    pub completed: usize,
    pub percentage: f64,
}

// Claude Code task structures
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ClaudeTask {
    pub id: String,
    pub subject: String,
    pub status: String,  // "pending", "in_progress", "completed"
    #[serde(default)]
    pub description: String,
    #[serde(default)]
    pub blocks: Vec<String>,
    #[serde(rename = "blockedBy", default)]
    pub blocked_by: Vec<String>,
    #[serde(default)]
    pub owner: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ClaudeTaskProgress {
    pub total: usize,
    pub pending: usize,
    #[serde(rename = "inProgress")]
    pub in_progress: usize,
    pub completed: usize,
    pub percentage: f64,
    pub tasks: Vec<ClaudeTask>,
    #[serde(rename = "isActive")]
    pub is_active: bool,
}

const TASK_FILES: &[&str] = &[
    "plan.md",
    "todo.md",
    "tasks.md",
    "TASKS.md",
    "CLAUDE.md",
];

#[tauri::command]
pub fn get_task_progress(project_path: String) -> Result<TaskProgress, String> {
    let project_dir = Path::new(&project_path);

    if !project_dir.exists() || !project_dir.is_dir() {
        return Err("Invalid project path".to_string());
    }

    let mut total = 0;
    let mut completed = 0;

    for filename in TASK_FILES {
        let file_path = project_dir.join(filename);
        if file_path.exists() && file_path.is_file() {
            if let Ok(content) = fs::read_to_string(&file_path) {
                let (file_total, file_completed) = parse_tasks(&content);
                total += file_total;
                completed += file_completed;
            }
        }
    }

    let percentage = if total > 0 {
        (completed as f64 / total as f64) * 100.0
    } else {
        0.0
    };

    Ok(TaskProgress {
        total,
        completed,
        percentage,
    })
}

fn parse_tasks(content: &str) -> (usize, usize) {
    let mut total = 0;
    let mut completed = 0;
    let mut in_code_block = false;

    // Regex for markdown checkboxes: - [ ] or - [x] or - [X]
    let checkbox_re = Regex::new(r"^\s*-\s*\[([ xX])\]").unwrap();

    for line in content.lines() {
        // Track code blocks
        if line.trim().starts_with("```") {
            in_code_block = !in_code_block;
            continue;
        }

        // Skip content inside code blocks
        if in_code_block {
            continue;
        }

        // Check for checkbox pattern
        if let Some(caps) = checkbox_re.captures(line) {
            total += 1;
            if let Some(status) = caps.get(1) {
                let status_char = status.as_str().chars().next().unwrap_or(' ');
                if status_char == 'x' || status_char == 'X' {
                    completed += 1;
                }
            }
        }
    }

    (total, completed)
}

/// Get Claude Code task progress by reading from ~/.claude/tasks/<task_list_id>/
#[tauri::command]
pub fn get_claude_task_progress(task_list_id: String) -> Result<ClaudeTaskProgress, String> {
    // Get home directory
    let home_dir = dirs::home_dir().ok_or("Could not determine home directory")?;
    let tasks_dir = home_dir.join(".claude").join("tasks").join(&task_list_id);

    // Check if the tasks directory exists
    if !tasks_dir.exists() || !tasks_dir.is_dir() {
        // Return empty progress if no tasks exist yet
        return Ok(ClaudeTaskProgress {
            total: 0,
            pending: 0,
            in_progress: 0,
            completed: 0,
            percentage: 0.0,
            tasks: vec![],
            is_active: false,
        });
    }

    // Check for .lock file to determine if tasks are active
    let lock_file = tasks_dir.join(".lock");
    let is_active = lock_file.exists();

    // Read all task JSON files (numbered: 1.json, 2.json, etc.)
    let mut tasks: Vec<ClaudeTask> = Vec::new();

    if let Ok(entries) = fs::read_dir(&tasks_dir) {
        for entry in entries.filter_map(|e| e.ok()) {
            let path = entry.path();
            if path.is_file() {
                if let Some(ext) = path.extension() {
                    if ext == "json" {
                        if let Ok(content) = fs::read_to_string(&path) {
                            // Parse the task JSON
                            if let Ok(task) = serde_json::from_str::<ClaudeTask>(&content) {
                                tasks.push(task);
                            }
                        }
                    }
                }
            }
        }
    }

    // Sort tasks by ID (numeric order)
    tasks.sort_by(|a, b| {
        let a_num: i32 = a.id.parse().unwrap_or(0);
        let b_num: i32 = b.id.parse().unwrap_or(0);
        a_num.cmp(&b_num)
    });

    // Calculate progress
    let total = tasks.len();
    let pending = tasks.iter().filter(|t| t.status == "pending").count();
    let in_progress = tasks.iter().filter(|t| t.status == "in_progress").count();
    let completed = tasks.iter().filter(|t| t.status == "completed").count();

    let percentage = if total > 0 {
        (completed as f64 / total as f64) * 100.0
    } else {
        0.0
    };

    Ok(ClaudeTaskProgress {
        total,
        pending,
        in_progress,
        completed,
        percentage,
        tasks,
        is_active,
    })
}

// TASKS.md file support
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct TasksMdTask {
    pub id: String,
    pub subject: String,
    pub description: Option<String>,
    pub column: String,  // "backlog", "in_progress", "review", "done"
    pub completed: bool,
    #[serde(rename = "lineNumber")]
    pub line_number: usize,
}

/// Column name to heading mapping
const COLUMN_HEADINGS: &[(&str, &str)] = &[
    ("backlog", "## Backlog"),
    ("in_progress", "## In Progress"),
    ("review", "## Review"),
    ("done", "## Done"),
];

fn heading_to_column(heading: &str) -> Option<&'static str> {
    let heading_lower = heading.to_lowercase();
    for (col, h) in COLUMN_HEADINGS {
        if heading_lower == h.to_lowercase() {
            return Some(*col);
        }
    }
    None
}

fn column_to_heading(column: &str) -> &'static str {
    for (col, h) in COLUMN_HEADINGS {
        if *col == column {
            return h;
        }
    }
    "## Backlog"
}

/// Read and parse TASKS.md file from a project directory
#[tauri::command]
pub fn read_tasks_md(project_path: String) -> Result<Vec<TasksMdTask>, String> {
    let tasks_md_path = Path::new(&project_path).join("TASKS.md");

    if !tasks_md_path.exists() {
        return Ok(vec![]);
    }

    let content = fs::read_to_string(&tasks_md_path)
        .map_err(|e| format!("Failed to read TASKS.md: {}", e))?;

    parse_tasks_md(&content)
}

fn parse_tasks_md(content: &str) -> Result<Vec<TasksMdTask>, String> {
    let mut tasks: Vec<TasksMdTask> = Vec::new();
    let mut current_column: Option<&str> = None;
    let mut in_code_block = false;

    // Regex for task checkbox: - [ ] or - [x] or - [X]
    let task_re = Regex::new(r"^(\s*)-\s*\[([ xX])\]\s*(.+)$").unwrap();
    // Regex for section heading: ## Backlog, ## In Progress, etc.
    let heading_re = Regex::new(r"^##\s+(.+)$").unwrap();

    let lines: Vec<&str> = content.lines().collect();
    let mut i = 0;

    while i < lines.len() {
        let line = lines[i];
        let line_number = i + 1; // 1-indexed

        // Track code blocks
        if line.trim().starts_with("```") {
            in_code_block = !in_code_block;
            i += 1;
            continue;
        }

        if in_code_block {
            i += 1;
            continue;
        }

        // Check for section heading
        if let Some(caps) = heading_re.captures(line) {
            let heading_text = caps.get(1).map(|m| m.as_str()).unwrap_or("");
            let full_heading = format!("## {}", heading_text);
            if let Some(col) = heading_to_column(&full_heading) {
                current_column = Some(col);
            }
            i += 1;
            continue;
        }

        // Check for task checkbox
        if let Some(current_col) = current_column {
            if let Some(caps) = task_re.captures(line) {
                let status_char = caps.get(2).map(|m| m.as_str()).unwrap_or(" ");
                let completed = status_char == "x" || status_char == "X";
                let subject = caps.get(3).map(|m| m.as_str().trim().to_string()).unwrap_or_default();

                // Look ahead for description (indented content on following lines)
                let mut description_lines: Vec<String> = Vec::new();
                let mut j = i + 1;
                while j < lines.len() {
                    let next_line = lines[j];
                    // If the line is indented more than the task line, it's description
                    if next_line.starts_with("  ") && !next_line.trim().is_empty()
                        && !task_re.is_match(next_line)
                        && !heading_re.is_match(next_line)
                        && !next_line.trim().starts_with("```")
                    {
                        description_lines.push(next_line.trim().to_string());
                        j += 1;
                    } else {
                        break;
                    }
                }

                let description = if description_lines.is_empty() {
                    None
                } else {
                    Some(description_lines.join("\n"))
                };

                tasks.push(TasksMdTask {
                    id: Uuid::new_v4().to_string(),
                    subject,
                    description,
                    column: current_col.to_string(),
                    completed,
                    line_number,
                });

                i = j;
                continue;
            }
        }

        i += 1;
    }

    Ok(tasks)
}

/// Write tasks back to TASKS.md file
#[tauri::command]
pub fn write_tasks_md(project_path: String, tasks: Vec<TasksMdTask>) -> Result<(), String> {
    let tasks_md_path = Path::new(&project_path).join("TASKS.md");

    let mut content = String::from("# TASKS\n\n");

    // Group tasks by column
    let columns = ["backlog", "in_progress", "review", "done"];

    for col in columns {
        let heading = column_to_heading(col);
        content.push_str(heading);
        content.push('\n');

        let col_tasks: Vec<&TasksMdTask> = tasks.iter().filter(|t| t.column == col).collect();

        for task in col_tasks {
            let checkbox = if task.completed { "[x]" } else { "[ ]" };
            content.push_str(&format!("- {} {}\n", checkbox, task.subject));

            if let Some(desc) = &task.description {
                for line in desc.lines() {
                    content.push_str(&format!("  {}\n", line));
                }
            }
        }

        content.push('\n');
    }

    fs::write(&tasks_md_path, content)
        .map_err(|e| format!("Failed to write TASKS.md: {}", e))?;

    Ok(())
}

/// Create a new TASKS.md file with default structure
#[tauri::command]
pub fn create_tasks_md(project_path: String, project_name: String) -> Result<(), String> {
    let tasks_md_path = Path::new(&project_path).join("TASKS.md");

    // Don't overwrite existing file
    if tasks_md_path.exists() {
        return Ok(());
    }

    let content = format!(r#"# TASKS

## Backlog
- [ ] Set up {} project

## In Progress

## Review

## Done

"#, project_name);

    fs::write(&tasks_md_path, content)
        .map_err(|e| format!("Failed to create TASKS.md: {}", e))?;

    Ok(())
}

/// Move a task to a different column in TASKS.md by subject (since IDs are ephemeral)
#[tauri::command]
pub fn move_task_in_tasks_md(
    project_path: String,
    task_subject: String,
    new_column: String,
) -> Result<(), String> {
    let tasks_md_path = Path::new(&project_path).join("TASKS.md");

    if !tasks_md_path.exists() {
        return Err("TASKS.md does not exist".to_string());
    }

    let content = fs::read_to_string(&tasks_md_path)
        .map_err(|e| format!("Failed to read TASKS.md: {}", e))?;

    let mut tasks = parse_tasks_md(&content)?;

    // Find the task by subject and update its column
    let task = tasks.iter_mut().find(|t| t.subject == task_subject);
    if let Some(t) = task {
        t.column = new_column.clone();
        // Update completed status based on column
        t.completed = new_column == "done";
    } else {
        return Err(format!("Task '{}' not found", task_subject));
    }

    // Write back
    write_tasks_md(project_path, tasks)
}

/// Add a new task to TASKS.md
#[tauri::command]
pub fn add_task_to_tasks_md(
    project_path: String,
    subject: String,
    description: Option<String>,
    column: String,
) -> Result<(), String> {
    let tasks_md_path = Path::new(&project_path).join("TASKS.md");

    // Read existing tasks or start with empty list
    let mut tasks = if tasks_md_path.exists() {
        let content = fs::read_to_string(&tasks_md_path)
            .map_err(|e| format!("Failed to read TASKS.md: {}", e))?;
        parse_tasks_md(&content)?
    } else {
        vec![]
    };

    // Create new task
    let new_task = TasksMdTask {
        id: Uuid::new_v4().to_string(),
        subject,
        description,
        column: column.clone(),
        completed: column == "done",
        line_number: 0, // Will be recalculated on write
    };

    tasks.push(new_task);

    // Write back (this will create the file if it doesn't exist)
    write_tasks_md(project_path, tasks)
}

/// Update a task in TASKS.md by finding it by its old subject
#[tauri::command]
pub fn update_task_in_tasks_md(
    project_path: String,
    old_subject: String,
    new_subject: String,
    new_description: Option<String>,
) -> Result<(), String> {
    let tasks_md_path = Path::new(&project_path).join("TASKS.md");

    if !tasks_md_path.exists() {
        return Err("TASKS.md does not exist".to_string());
    }

    let content = fs::read_to_string(&tasks_md_path)
        .map_err(|e| format!("Failed to read TASKS.md: {}", e))?;

    let mut tasks = parse_tasks_md(&content)?;

    // Find the task by old subject and update it
    let task = tasks.iter_mut().find(|t| t.subject == old_subject);
    if let Some(t) = task {
        t.subject = new_subject;
        t.description = new_description;
    } else {
        return Err(format!("Task '{}' not found", old_subject));
    }

    // Write back
    write_tasks_md(project_path, tasks)
}

/// Delete a task from TASKS.md by subject
#[tauri::command]
pub fn delete_task_from_tasks_md(
    project_path: String,
    task_subject: String,
) -> Result<(), String> {
    let tasks_md_path = Path::new(&project_path).join("TASKS.md");

    if !tasks_md_path.exists() {
        return Err("TASKS.md does not exist".to_string());
    }

    let content = fs::read_to_string(&tasks_md_path)
        .map_err(|e| format!("Failed to read TASKS.md: {}", e))?;

    let tasks = parse_tasks_md(&content)?;

    // Filter out the task with matching subject
    let filtered_tasks: Vec<TasksMdTask> = tasks
        .into_iter()
        .filter(|t| t.subject != task_subject)
        .collect();

    // Write back
    write_tasks_md(project_path, filtered_tasks)
}

/// Start watching a project's TASKS.md file for changes
#[tauri::command]
pub fn watch_tasks_md(
    project_id: String,
    project_path: String,
    app: AppHandle,
    state: tauri::State<'_, TasksWatcherState>,
) -> Result<(), String> {
    let project_id_clone = project_id.clone();
    let project_path_clone = project_path.clone();

    // Create the watcher
    let mut watcher = notify::recommended_watcher(move |res: Result<Event, notify::Error>| {
        match res {
            Ok(event) => {
                // Only emit for modify/create events on TASKS.md
                match event.kind {
                    EventKind::Modify(_) | EventKind::Create(_) => {
                        // Check if this event is for TASKS.md
                        let is_tasks_md = event.paths.iter().any(|p| {
                            p.file_name()
                                .map(|n| n.to_string_lossy() == "TASKS.md")
                                .unwrap_or(false)
                        });

                        if is_tasks_md {
                            // Emit event to frontend
                            let _ = app.emit("tasks-md-changed", serde_json::json!({
                                "projectId": project_id_clone,
                                "projectPath": project_path_clone,
                            }));
                        }
                    }
                    _ => {}
                }
            }
            Err(e) => {
                eprintln!("Watch error: {:?}", e);
            }
        }
    }).map_err(|e| format!("Failed to create watcher: {}", e))?;

    // Watch the project directory (not just TASKS.md, to catch file creation)
    watcher.watch(Path::new(&project_path), RecursiveMode::NonRecursive)
        .map_err(|e| format!("Failed to watch directory: {}", e))?;

    // Store the watcher
    let mut watchers = state.watchers.lock().map_err(|e| e.to_string())?;
    watchers.insert(project_id, watcher);

    Ok(())
}

/// Stop watching a project's TASKS.md file
#[tauri::command]
pub fn unwatch_tasks_md(
    project_id: String,
    state: tauri::State<'_, TasksWatcherState>,
) -> Result<(), String> {
    let mut watchers = state.watchers.lock().map_err(|e| e.to_string())?;
    watchers.remove(&project_id);
    Ok(())
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_parse_tasks_empty() {
        let (total, completed) = parse_tasks("");
        assert_eq!(total, 0);
        assert_eq!(completed, 0);
    }

    #[test]
    fn test_parse_tasks_simple() {
        let content = r#"
# Tasks
- [ ] First task
- [x] Second task
- [X] Third task
- [ ] Fourth task
"#;
        let (total, completed) = parse_tasks(content);
        assert_eq!(total, 4);
        assert_eq!(completed, 2);
    }

    #[test]
    fn test_parse_tasks_ignores_code_blocks() {
        let content = r#"
# Tasks
- [ ] Real task

```markdown
- [ ] This is in a code block
- [x] Also in code block
```

- [x] Another real task
"#;
        let (total, completed) = parse_tasks(content);
        assert_eq!(total, 2);
        assert_eq!(completed, 1);
    }

    #[test]
    fn test_parse_tasks_md_basic() {
        let content = r#"# TASKS

## Backlog
- [ ] First task
- [ ] Second task
  With a description

## In Progress
- [ ] Working on this

## Review

## Done
- [x] Completed task
"#;
        let tasks = parse_tasks_md(content).unwrap();
        assert_eq!(tasks.len(), 4);

        assert_eq!(tasks[0].subject, "First task");
        assert_eq!(tasks[0].column, "backlog");
        assert!(!tasks[0].completed);

        assert_eq!(tasks[1].subject, "Second task");
        assert_eq!(tasks[1].description, Some("With a description".to_string()));

        assert_eq!(tasks[2].subject, "Working on this");
        assert_eq!(tasks[2].column, "in_progress");

        assert_eq!(tasks[3].subject, "Completed task");
        assert_eq!(tasks[3].column, "done");
        assert!(tasks[3].completed);
    }

    #[test]
    fn test_parse_tasks_md_empty() {
        let content = r#"# TASKS

## Backlog

## In Progress

## Review

## Done
"#;
        let tasks = parse_tasks_md(content).unwrap();
        assert_eq!(tasks.len(), 0);
    }
}
