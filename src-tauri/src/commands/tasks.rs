use serde::{Deserialize, Serialize};
use std::fs;
use std::path::Path;
use regex::Regex;

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
}
