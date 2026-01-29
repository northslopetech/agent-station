import { useEffect, useState, useCallback, useRef } from "react";
import Editor, { loader } from "@monaco-editor/react";
import { invoke } from "@tauri-apps/api/core";
import { useAppStore } from "../stores/appStore";
import { KanbanBoard } from "./KanbanBoard";

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
    claudeTaskProgress,
    tasksMdTasks,
    zoomLevel,
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

  // Calculate combined task progress (TASKS.md + Claude tasks)
  const projectMdTasks = selectedProjectId ? (tasksMdTasks[selectedProjectId] || []) : [];
  const mdTasksTotal = projectMdTasks.length;
  const mdTasksCompleted = projectMdTasks.filter((t) => t.completed).length;
  const claudeTotal = currentTaskProgress?.total || 0;
  const claudeCompleted = currentTaskProgress?.completed || 0;
  const combinedTotal = mdTasksTotal + claudeTotal;
  const combinedCompleted = mdTasksCompleted + claudeCompleted;

  const headerFontSize = Math.round(12 * zoomLevel);
  const baseFontSize = Math.round(14 * zoomLevel);

  if (!selectedProject) {
    return (
      <div className="h-full flex flex-col bg-zinc-800 text-zinc-100">
        <div className="p-3 border-b border-zinc-700">
          <h2
            className="font-semibold text-zinc-400 uppercase tracking-wide"
            style={{ fontSize: `${headerFontSize}px` }}
          >
            Editor
          </h2>
        </div>
        <div className="flex-1 flex items-center justify-center">
          <div className="text-zinc-500" style={{ fontSize: `${baseFontSize}px` }}>
            Select a project to edit files
          </div>
        </div>
      </div>
    );
  }

  // Task view (Kanban board)
  if (editorViewMode === 'tasks') {
    return (
      <div className="h-full flex flex-col bg-zinc-800 text-zinc-100">
        <div className="p-3 border-b border-zinc-700 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <h2
              className="font-semibold text-zinc-400 uppercase tracking-wide"
              style={{ fontSize: `${headerFontSize}px` }}
            >
              Tasks
            </h2>
            <span className="text-zinc-300" style={{ fontSize: `${baseFontSize}px` }}>
              {selectedProject.name}
            </span>
            {combinedTotal > 0 && (
              <span className="text-zinc-500" style={{ fontSize: `${Math.round(12 * zoomLevel)}px` }}>
                ({combinedCompleted}/{combinedTotal} completed)
              </span>
            )}
          </div>
          <button
            onClick={() => setEditorViewMode('file')}
            className="text-zinc-400 hover:text-zinc-200 px-2 py-1 rounded hover:bg-zinc-700 transition-colors"
            style={{ fontSize: `${Math.round(12 * zoomLevel)}px` }}
          >
            Back to Editor
          </button>
        </div>
        <KanbanBoard projectId={selectedProjectId!} />
      </div>
    );
  }

  // File editor view
  return (
    <div className="h-full flex flex-col bg-zinc-800 text-zinc-100">
      <div className="p-3 border-b border-zinc-700 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <h2
            className="font-semibold text-zinc-400 uppercase tracking-wide"
            style={{ fontSize: `${headerFontSize}px` }}
          >
            Editor
          </h2>
          {selectedFilePath && (
            <span className="text-zinc-300" style={{ fontSize: `${baseFontSize}px` }}>
              {filename}
              {isDirty && <span className="text-zinc-500 ml-1">•</span>}
            </span>
          )}
        </div>
        {saving && (
          <span className="text-zinc-500" style={{ fontSize: `${Math.round(12 * zoomLevel)}px` }}>Saving...</span>
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
              fontSize: Math.round(13 * zoomLevel),
              lineHeight: Math.round(20 * zoomLevel),
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
