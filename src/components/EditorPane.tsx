import { useEffect, useState, useCallback, useRef } from "react";
import Editor, { loader } from "@monaco-editor/react";
import { invoke } from "@tauri-apps/api/core";
import { useAppStore } from "../stores/appStore";
import { KanbanBoard } from "./KanbanBoard";
import type { ClaudeTask } from "../types";

// Configure Monaco to use a dark theme by default
loader.init().then((monaco) => {
  monaco.editor.defineTheme("agent-station-dark", {
    base: "vs-dark",
    inherit: true,
    rules: [],
    colors: {
      "editor.background": "#27272a",
    },
  });
});

function getLanguageFromPath(path: string): string {
  const ext = path.split(".").pop()?.toLowerCase();

  switch (ext) {
    case "ts":
      return "typescript";
    case "tsx":
      return "typescript";
    case "js":
      return "javascript";
    case "jsx":
      return "javascript";
    case "json":
      return "json";
    case "md":
      return "markdown";
    case "css":
      return "css";
    case "html":
      return "html";
    case "rs":
      return "rust";
    case "py":
      return "python";
    case "toml":
      return "toml";
    case "yaml":
    case "yml":
      return "yaml";
    case "sh":
    case "bash":
      return "shell";
    default:
      return "plaintext";
  }
}

function getStatusIcon(status: ClaudeTask['status']) {
  switch (status) {
    case 'pending':
      return (
        <span className="w-4 h-4 rounded-full border-2 border-zinc-500 inline-block" />
      );
    case 'in_progress':
      return (
        <span className="w-4 h-4 rounded-full bg-blue-500 inline-block animate-pulse" />
      );
    case 'completed':
      return (
        <span className="w-4 h-4 text-emerald-500 inline-flex items-center justify-center">
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
          </svg>
        </span>
      );
  }
}

export function EditorPane() {
  const {
    projects,
    selectedProjectId,
    selectedFilePath,
    editorContent,
    editorLanguage,
    isDirty,
    setEditorContent,
    setEditorLanguage,
    setIsDirty,
    selectFile,
    editorViewMode,
    setEditorViewMode,
    taskViewMode,
    setTaskViewMode,
    claudeTaskProgress,
  } = useAppStore();

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const saveTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const selectedProject = projects.find((p) => p.id === selectedProjectId);

  // Load file content when file is selected
  useEffect(() => {
    if (!selectedFilePath) {
      setEditorContent("");
      return;
    }

    async function loadFile() {
      setLoading(true);
      setError(null);
      try {
        const content = await invoke<string>("read_file", {
          path: selectedFilePath,
        });
        setEditorContent(content);
        setEditorLanguage(getLanguageFromPath(selectedFilePath!));
        setIsDirty(false);
      } catch (err) {
        setError(String(err));
        setEditorContent("");
      } finally {
        setLoading(false);
      }
    }

    loadFile();
  }, [selectedFilePath, setEditorContent, setEditorLanguage, setIsDirty]);

  // Try to open default file when project is selected (but not when viewing tasks)
  useEffect(() => {
    if (!selectedProject || selectedFilePath || editorViewMode === 'tasks') return;

    async function findDefaultFile() {
      const candidates = ["CLAUDE.md", "README.md"];

      for (const filename of candidates) {
        const path = `${selectedProject!.path}/${filename}`;
        try {
          await invoke<string>("read_file", { path });
          selectFile(path);
          return;
        } catch {
          // File doesn't exist, try next
        }
      }
    }

    findDefaultFile();
  }, [selectedProject, selectedFilePath, selectFile, editorViewMode]);

  // Auto-save with debounce
  const saveFile = useCallback(async () => {
    if (!selectedFilePath || !isDirty) return;

    setSaving(true);
    try {
      await invoke("write_file", {
        path: selectedFilePath,
        content: editorContent,
      });
      setIsDirty(false);
    } catch (err) {
      console.error("Failed to save file:", err);
    } finally {
      setSaving(false);
    }
  }, [selectedFilePath, editorContent, isDirty, setIsDirty]);

  const handleEditorChange = useCallback(
    (value: string | undefined) => {
      if (value === undefined) return;

      setEditorContent(value);
      setIsDirty(true);

      // Debounced auto-save (1 second)
      if (saveTimeoutRef.current) {
        clearTimeout(saveTimeoutRef.current);
      }
      saveTimeoutRef.current = setTimeout(() => {
        saveFile();
      }, 1000);
    },
    [setEditorContent, setIsDirty, saveFile]
  );

  // Cleanup timeout on unmount
  useEffect(() => {
    return () => {
      if (saveTimeoutRef.current) {
        clearTimeout(saveTimeoutRef.current);
      }
    };
  }, []);

  // Save on Cmd+S
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === "s") {
        e.preventDefault();
        saveFile();
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [saveFile]);

  const filename = selectedFilePath?.split("/").pop() || "No file selected";
  const currentTaskProgress = selectedProjectId ? claudeTaskProgress[selectedProjectId] : null;

  if (!selectedProject) {
    return (
      <div className="h-full flex flex-col bg-zinc-800 text-zinc-100">
        <div className="p-3 border-b border-zinc-700">
          <h2 className="text-sm font-semibold text-zinc-400 uppercase tracking-wide">
            Editor
          </h2>
        </div>
        <div className="flex-1 flex items-center justify-center">
          <div className="text-zinc-500 text-sm">
            Select a project to edit files
          </div>
        </div>
      </div>
    );
  }

  // Task view (list or board)
  if (editorViewMode === 'tasks') {
    const tasks = currentTaskProgress?.tasks || [];
    const hasNoTasks = tasks.length === 0;

    return (
      <div className="h-full flex flex-col bg-zinc-800 text-zinc-100">
        <div className="p-3 border-b border-zinc-700 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <h2 className="text-sm font-semibold text-zinc-400 uppercase tracking-wide">
              Tasks
            </h2>
            <span className="text-sm text-zinc-300">
              {selectedProject.name}
            </span>
            {currentTaskProgress && (
              <span className="text-xs text-zinc-500">
                ({currentTaskProgress.completed}/{currentTaskProgress.total} completed)
              </span>
            )}
          </div>
          <div className="flex items-center gap-2">
            {/* View toggle */}
            <div className="flex items-center bg-zinc-700/50 rounded p-0.5">
              <button
                onClick={() => setTaskViewMode('list')}
                className={`px-2 py-1 text-xs rounded transition-colors ${
                  taskViewMode === 'list'
                    ? 'bg-zinc-600 text-zinc-100'
                    : 'text-zinc-400 hover:text-zinc-200'
                }`}
                title="List view"
              >
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M4 6h16M4 12h16M4 18h16" />
                </svg>
              </button>
              <button
                onClick={() => setTaskViewMode('board')}
                className={`px-2 py-1 text-xs rounded transition-colors ${
                  taskViewMode === 'board'
                    ? 'bg-zinc-600 text-zinc-100'
                    : 'text-zinc-400 hover:text-zinc-200'
                }`}
                title="Board view"
              >
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M9 17V7m0 10a2 2 0 01-2 2H5a2 2 0 01-2-2V7a2 2 0 012-2h2a2 2 0 012 2m0 10a2 2 0 002 2h2a2 2 0 002-2M9 7a2 2 0 012-2h2a2 2 0 012 2m0 10V7m0 10a2 2 0 002 2h2a2 2 0 002-2V7a2 2 0 00-2-2h-2a2 2 0 00-2 2" />
                </svg>
              </button>
            </div>
            <button
              onClick={() => setEditorViewMode('file')}
              className="text-xs text-zinc-400 hover:text-zinc-200 px-2 py-1 rounded hover:bg-zinc-700 transition-colors"
            >
              Back to Editor
            </button>
          </div>
        </div>

        {/* Board view */}
        {taskViewMode === 'board' ? (
          <KanbanBoard projectId={selectedProjectId!} tasks={tasks} />
        ) : (
          /* List view */
          <div className="flex-1 overflow-y-auto p-4">
            {hasNoTasks ? (
              <div className="flex items-center justify-center h-full text-zinc-500">
                No tasks found for this project
              </div>
            ) : (
              <div className="space-y-3">
                {tasks.map((task) => (
                  <div
                    key={task.id}
                    className={`p-3 rounded-lg border transition-colors ${
                      task.status === 'in_progress'
                        ? 'border-blue-500/50 bg-blue-500/10'
                        : task.status === 'completed'
                        ? 'border-zinc-700 bg-zinc-800/50'
                        : task.blockedBy && task.blockedBy.length > 0
                        ? 'border-zinc-700 bg-zinc-800/30'
                        : 'border-zinc-700 bg-zinc-800'
                    }`}
                  >
                    <div className="flex items-start gap-3">
                      <span className="mt-0.5 flex-shrink-0">
                        {getStatusIcon(task.status)}
                      </span>
                      <div className="flex-1 min-w-0">
                        <div
                          className={`font-medium ${
                            task.status === 'completed'
                              ? 'text-zinc-500 line-through'
                              : task.blockedBy && task.blockedBy.length > 0
                              ? 'text-zinc-500'
                              : 'text-zinc-200'
                          }`}
                        >
                          {task.subject}
                        </div>
                        {task.description && (
                          <div className="mt-1 text-sm text-zinc-400 whitespace-pre-wrap">
                            {task.description}
                          </div>
                        )}
                        <div className="mt-2 flex flex-wrap gap-2 text-xs">
                          {task.status === 'in_progress' && (
                            <span className="px-2 py-0.5 rounded bg-blue-500/20 text-blue-400">
                              In Progress
                            </span>
                          )}
                          {task.blockedBy && task.blockedBy.length > 0 && (
                            <span className="px-2 py-0.5 rounded bg-zinc-700 text-zinc-400">
                              Blocked by: {task.blockedBy.join(', ')}
                            </span>
                          )}
                          {task.blocks && task.blocks.length > 0 && (
                            <span className="px-2 py-0.5 rounded bg-zinc-700 text-zinc-400">
                              Blocks: {task.blocks.join(', ')}
                            </span>
                          )}
                          {task.owner && (
                            <span className="px-2 py-0.5 rounded bg-zinc-700 text-zinc-400">
                              Owner: {task.owner}
                            </span>
                          )}
                        </div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </div>
    );
  }

  // File editor view
  return (
    <div className="h-full flex flex-col bg-zinc-800 text-zinc-100">
      <div className="p-3 border-b border-zinc-700 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <h2 className="text-sm font-semibold text-zinc-400 uppercase tracking-wide">
            Editor
          </h2>
          {selectedFilePath && (
            <span className="text-sm text-zinc-300">
              {filename}
              {isDirty && <span className="text-zinc-500 ml-1">•</span>}
            </span>
          )}
        </div>
        {saving && (
          <span className="text-xs text-zinc-500">Saving...</span>
        )}
      </div>

      <div className="flex-1 overflow-hidden">
        {loading ? (
          <div className="flex items-center justify-center h-full text-zinc-500">
            Loading...
          </div>
        ) : error ? (
          <div className="flex items-center justify-center h-full text-red-400 p-4 text-center">
            {error}
          </div>
        ) : !selectedFilePath ? (
          <div className="flex items-center justify-center h-full text-zinc-500">
            Select a file to edit
          </div>
        ) : (
          <Editor
            height="100%"
            language={editorLanguage}
            value={editorContent}
            onChange={handleEditorChange}
            theme="agent-station-dark"
            options={{
              fontSize: 13,
              lineHeight: 20,
              minimap: { enabled: false },
              scrollBeyondLastLine: false,
              wordWrap: "on",
              tabSize: 2,
              automaticLayout: true,
              padding: { top: 8 },
            }}
          />
        )}
      </div>
    </div>
  );
}
