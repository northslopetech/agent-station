import { useEffect, useRef, useCallback, useState } from "react";
import { Terminal } from "@xterm/xterm";
import { FitAddon } from "@xterm/addon-fit";
import { invoke } from "@tauri-apps/api/core";
import { listen, UnlistenFn } from "@tauri-apps/api/event";
import { useAppStore } from "../stores/appStore";
import "@xterm/xterm/css/xterm.css";

interface TerminalOutput {
  terminalId: string;
  data: string;
}

interface TerminalInfo {
  id: string;
  projectId: string;
  isRunning: boolean;
}

interface TerminalInstance {
  terminal: Terminal;
  fitAddon: FitAddon;
  unlistenOutput: UnlistenFn | null;
  unlistenExit: UnlistenFn | null;
  inputDisposable: { dispose: () => void } | null;
}

const TERMINAL_THEME = {
  background: "#09090b",
  foreground: "#a1a1aa",
  cursor: "#a1a1aa",
  cursorAccent: "#09090b",
  selectionBackground: "#3f3f46",
  black: "#18181b",
  red: "#ef4444",
  green: "#22c55e",
  yellow: "#eab308",
  blue: "#3b82f6",
  magenta: "#a855f7",
  cyan: "#06b6d4",
  white: "#d4d4d8",
  brightBlack: "#52525b",
  brightRed: "#f87171",
  brightGreen: "#4ade80",
  brightYellow: "#facc15",
  brightBlue: "#60a5fa",
  brightMagenta: "#c084fc",
  brightCyan: "#22d3ee",
  brightWhite: "#fafafa",
};

export function TerminalPane() {
  const {
    projects,
    selectedProjectId,
    terminalIds,
    terminalNames,
    updateProjectProcessStatus,
    addTerminalToProject,
    removeTerminalFromProject,
    setTerminalName,
  } = useAppStore();

  const [activeTerminalIndex, setActiveTerminalIndex] = useState(0);
  const [editingTerminalId, setEditingTerminalId] = useState<string | null>(null);
  const [editingName, setEditingName] = useState("");
  const editInputRef = useRef<HTMLInputElement>(null);

  const containerRef = useRef<HTMLDivElement>(null);
  // Map of backend terminalId -> TerminalInstance
  const terminalsRef = useRef<Map<string, TerminalInstance>>(new Map());
  // Currently displayed terminal ID
  const currentTerminalIdRef = useRef<string | null>(null);
  // Track which projects have had their initial terminal spawned
  const spawnedProjectsRef = useRef<Set<string>>(new Set());

  const selectedProject = projects.find((p) => p.id === selectedProjectId);
  const projectTerminalIds = selectedProjectId ? terminalIds[selectedProjectId] ?? [] : [];
  const activeTerminalId = projectTerminalIds[activeTerminalIndex] ?? projectTerminalIds[0] ?? null;
  const hasTerminals = projectTerminalIds.length > 0;

  // Ensure activeTerminalIndex is valid when terminals change
  useEffect(() => {
    if (activeTerminalIndex >= projectTerminalIds.length && projectTerminalIds.length > 0) {
      setActiveTerminalIndex(projectTerminalIds.length - 1);
    }
  }, [projectTerminalIds.length, activeTerminalIndex]);

  // Create terminal instance for a given terminal ID
  const createTerminalInstance = useCallback((terminalId: string): TerminalInstance => {
    const terminal = new Terminal({
      theme: TERMINAL_THEME,
      fontFamily: 'Menlo, Monaco, "Courier New", monospace',
      fontSize: 13,
      lineHeight: 1.2,
      cursorBlink: true,
      scrollback: 10000,
      convertEol: true,
    });

    const fitAddon = new FitAddon();
    terminal.loadAddon(fitAddon);

    const instance: TerminalInstance = {
      terminal,
      fitAddon,
      unlistenOutput: null,
      unlistenExit: null,
      inputDisposable: null,
    };

    terminalsRef.current.set(terminalId, instance);
    return instance;
  }, []);

  // Spawn a new terminal for a project
  const spawnTerminal = useCallback(async (projectId: string, projectPath: string): Promise<string | null> => {
    try {
      const terminalId = await invoke<string>("spawn_terminal", {
        projectId: projectId,
        cwd: projectPath,
      });

      // Create the terminal instance
      createTerminalInstance(terminalId);

      // Add to project's terminal list
      addTerminalToProject(projectId, terminalId);
      updateProjectProcessStatus(projectId, true);

      return terminalId;
    } catch (err) {
      console.error("Failed to spawn terminal:", err);
      return null;
    }
  }, [createTerminalInstance, addTerminalToProject, updateProjectProcessStatus]);

  // Handle spawning additional terminal
  const handleSpawnAdditional = useCallback(async () => {
    if (!selectedProjectId || !selectedProject) return;

    const newTerminalId = await spawnTerminal(selectedProjectId, selectedProject.path);
    if (newTerminalId) {
      // Switch to the new terminal
      const newIndex = projectTerminalIds.length; // Will be at the end
      setActiveTerminalIndex(newIndex);
    }
  }, [selectedProjectId, selectedProject, spawnTerminal, projectTerminalIds.length]);

  // Handle double-click to start editing terminal name
  const handleDoubleClickTab = useCallback((terminalId: string, currentName: string) => {
    setEditingTerminalId(terminalId);
    setEditingName(currentName);
  }, []);

  // Handle saving the edited name
  const handleSaveTerminalName = useCallback(() => {
    if (editingTerminalId && editingName.trim()) {
      setTerminalName(editingTerminalId, editingName.trim());
    }
    setEditingTerminalId(null);
    setEditingName("");
  }, [editingTerminalId, editingName, setTerminalName]);

  // Handle key down in edit input
  const handleEditKeyDown = useCallback((e: React.KeyboardEvent) => {
    if (e.key === "Enter") {
      handleSaveTerminalName();
    } else if (e.key === "Escape") {
      setEditingTerminalId(null);
      setEditingName("");
    }
  }, [handleSaveTerminalName]);

  // Focus input when editing starts
  useEffect(() => {
    if (editingTerminalId && editInputRef.current) {
      editInputRef.current.focus();
      editInputRef.current.select();
    }
  }, [editingTerminalId]);

  // Handle closing a terminal
  const handleCloseTerminal = useCallback(async (terminalId: string, e: React.MouseEvent) => {
    e.stopPropagation();
    if (!selectedProjectId) return;

    // Don't allow closing the last terminal
    if (projectTerminalIds.length <= 1) return;

    try {
      await invoke("kill_terminal", { terminalId });
    } catch (err) {
      console.error("Failed to kill terminal:", err);
    }

    // Clean up the terminal instance
    const instance = terminalsRef.current.get(terminalId);
    if (instance) {
      if (instance.unlistenOutput) instance.unlistenOutput();
      if (instance.unlistenExit) instance.unlistenExit();
      if (instance.inputDisposable) instance.inputDisposable.dispose();
      instance.terminal.dispose();
      terminalsRef.current.delete(terminalId);
    }

    removeTerminalFromProject(selectedProjectId, terminalId);

    // Adjust active index if needed
    const closedIndex = projectTerminalIds.indexOf(terminalId);
    if (closedIndex <= activeTerminalIndex && activeTerminalIndex > 0) {
      setActiveTerminalIndex(activeTerminalIndex - 1);
    }
  }, [selectedProjectId, projectTerminalIds, activeTerminalIndex, removeTerminalFromProject]);

  // Initialize terminal for project when selected
  useEffect(() => {
    if (!selectedProjectId || !selectedProject) return;

    const initialize = async () => {
      // Check if this project already has terminals
      if (projectTerminalIds.length > 0) {
        spawnedProjectsRef.current.add(selectedProjectId);
        return;
      }

      // Check if we already spawned for this project
      if (spawnedProjectsRef.current.has(selectedProjectId)) {
        return;
      }

      // Check for existing backend terminals
      try {
        const infos = await invoke<TerminalInfo[]>("list_terminals");
        const projectInfos = infos.filter(info => info.projectId === selectedProjectId && info.isRunning);

        if (projectInfos.length > 0) {
          // Reconnect to existing terminals
          for (const info of projectInfos) {
            if (!terminalsRef.current.has(info.id)) {
              createTerminalInstance(info.id);
            }
            addTerminalToProject(selectedProjectId, info.id);
          }
          updateProjectProcessStatus(selectedProjectId, true);
          spawnedProjectsRef.current.add(selectedProjectId);
        } else {
          // Auto-spawn initial terminal
          spawnedProjectsRef.current.add(selectedProjectId);
          await spawnTerminal(selectedProjectId, selectedProject.path);
        }
      } catch (err) {
        console.error("Failed to initialize terminal:", err);
        // Try to spawn anyway
        spawnedProjectsRef.current.add(selectedProjectId);
        await spawnTerminal(selectedProjectId, selectedProject.path);
      }
    };

    initialize();
  }, [selectedProjectId, selectedProject?.path, projectTerminalIds.length, createTerminalInstance, addTerminalToProject, updateProjectProcessStatus, spawnTerminal]);

  // Handle displaying and hiding terminals when active terminal changes
  useEffect(() => {
    if (!containerRef.current) return;

    // Hide previous terminal
    if (currentTerminalIdRef.current && currentTerminalIdRef.current !== activeTerminalId) {
      const prevInstance = terminalsRef.current.get(currentTerminalIdRef.current);
      if (prevInstance?.terminal.element) {
        prevInstance.terminal.element.style.display = "none";
      }
    }

    if (!activeTerminalId) {
      currentTerminalIdRef.current = null;
      return;
    }

    // Get or ensure terminal instance exists
    let instance = terminalsRef.current.get(activeTerminalId);
    if (!instance) {
      instance = createTerminalInstance(activeTerminalId);
    }

    const { terminal, fitAddon } = instance;

    // Attach to DOM if not already
    if (!terminal.element || !containerRef.current.contains(terminal.element)) {
      terminal.open(containerRef.current);
    }

    // Show this terminal
    if (terminal.element) {
      terminal.element.style.display = "block";
    }

    // Fit after showing
    setTimeout(() => {
      try {
        fitAddon.fit();
      } catch {
        // Ignore fit errors
      }
    }, 0);

    currentTerminalIdRef.current = activeTerminalId;
  }, [activeTerminalId, createTerminalInstance]);

  // Set up listeners for active terminal
  useEffect(() => {
    if (!activeTerminalId || !selectedProjectId) return;

    const instance = terminalsRef.current.get(activeTerminalId);
    if (!instance) return;

    let isActive = true;

    const setup = async () => {
      const { terminal } = instance;

      // Clean up old listeners
      if (instance.unlistenOutput) {
        instance.unlistenOutput();
        instance.unlistenOutput = null;
      }
      if (instance.unlistenExit) {
        instance.unlistenExit();
        instance.unlistenExit = null;
      }
      if (instance.inputDisposable) {
        instance.inputDisposable.dispose();
        instance.inputDisposable = null;
      }

      if (!isActive) return;

      // Set up output listener
      instance.unlistenOutput = await listen<TerminalOutput>("terminal-output", (event) => {
        if (event.payload.terminalId === activeTerminalId) {
          terminal.write(event.payload.data);
        }
      });

      if (!isActive) {
        instance.unlistenOutput();
        instance.unlistenOutput = null;
        return;
      }

      // Set up exit listener
      instance.unlistenExit = await listen<TerminalOutput>("terminal-exit", (event) => {
        if (event.payload.terminalId === activeTerminalId) {
          removeTerminalFromProject(selectedProjectId, activeTerminalId);
          const remaining = (terminalIds[selectedProjectId] ?? []).filter(id => id !== activeTerminalId);
          if (remaining.length === 0) {
            updateProjectProcessStatus(selectedProjectId, false);
            spawnedProjectsRef.current.delete(selectedProjectId);
          }
          terminal.writeln("\r\n\x1b[90m[Process exited]\x1b[0m");
        }
      });

      if (!isActive) {
        instance.unlistenExit();
        instance.unlistenExit = null;
        return;
      }

      // Set up input handler
      instance.inputDisposable = terminal.onData(async (data) => {
        try {
          await invoke("write_terminal", {
            terminalId: activeTerminalId,
            data: data,
          });
        } catch (err) {
          console.error("Failed to write to terminal:", err);
        }
      });
    };

    setup();

    return () => {
      isActive = false;
      if (instance.unlistenOutput) {
        instance.unlistenOutput();
        instance.unlistenOutput = null;
      }
      if (instance.unlistenExit) {
        instance.unlistenExit();
        instance.unlistenExit = null;
      }
      if (instance.inputDisposable) {
        instance.inputDisposable.dispose();
        instance.inputDisposable = null;
      }
    };
  }, [activeTerminalId, selectedProjectId, terminalIds, removeTerminalFromProject, updateProjectProcessStatus]);

  // Handle resize
  useEffect(() => {
    if (!containerRef.current) return;

    const resizeObserver = new ResizeObserver(() => {
      if (currentTerminalIdRef.current) {
        const instance = terminalsRef.current.get(currentTerminalIdRef.current);
        if (instance) {
          try {
            instance.fitAddon.fit();
          } catch {
            // Ignore
          }
        }
      }
    });

    resizeObserver.observe(containerRef.current);

    return () => {
      resizeObserver.disconnect();
    };
  }, []);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      terminalsRef.current.forEach((instance) => {
        if (instance.unlistenOutput) instance.unlistenOutput();
        if (instance.unlistenExit) instance.unlistenExit();
        if (instance.inputDisposable) instance.inputDisposable.dispose();
        instance.terminal.dispose();
      });
      terminalsRef.current.clear();
    };
  }, []);

  if (!selectedProject) {
    return (
      <div className="h-full flex flex-col bg-zinc-950 text-zinc-100">
        <div className="p-3 border-b border-zinc-700 flex items-center justify-between">
          <h2 className="text-sm font-semibold text-zinc-400 uppercase tracking-wide">
            Terminal
          </h2>
        </div>
        <div className="flex-1 flex items-center justify-center">
          <div className="text-zinc-500 text-sm">
            Select a project to open a terminal
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="h-full flex flex-col bg-zinc-950 text-zinc-100">
      {/* Header with tabs */}
      <div className="border-b border-zinc-700">
        <div className="flex items-center justify-between px-3 py-2">
          <div className="flex items-center gap-2">
            <h2 className="text-sm font-semibold text-zinc-400 uppercase tracking-wide">
              Terminal
            </h2>
            {hasTerminals && (
              <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
            )}
          </div>
        </div>

        {/* Terminal tabs */}
        {projectTerminalIds.length > 0 && (
          <div className="flex items-center gap-1 px-2 pb-2">
            {projectTerminalIds.map((tid, index) => {
              const displayName = terminalNames[tid] || `Agent ${index + 1}`;
              const isEditing = editingTerminalId === tid;

              return (
                <div
                  key={tid}
                  onClick={() => !isEditing && setActiveTerminalIndex(index)}
                  onDoubleClick={() => handleDoubleClickTab(tid, displayName)}
                  className={`flex items-center gap-1 px-2 py-1 text-xs rounded transition-colors cursor-pointer ${
                    activeTerminalIndex === index
                      ? "bg-zinc-700 text-zinc-100"
                      : "text-zinc-400 hover:bg-zinc-800 hover:text-zinc-300"
                  }`}
                >
                  {isEditing ? (
                    <input
                      ref={editInputRef}
                      type="text"
                      value={editingName}
                      onChange={(e) => setEditingName(e.target.value)}
                      onBlur={handleSaveTerminalName}
                      onKeyDown={handleEditKeyDown}
                      className="bg-zinc-600 text-zinc-100 text-xs px-1 py-0 rounded outline-none w-20"
                      onClick={(e) => e.stopPropagation()}
                    />
                  ) : (
                    <span>{displayName}</span>
                  )}
                  {projectTerminalIds.length > 1 && !isEditing && (
                    <span
                      onClick={(e) => handleCloseTerminal(tid, e)}
                      className="ml-1 text-zinc-500 hover:text-zinc-300"
                    >
                      ×
                    </span>
                  )}
                </div>
              );
            })}
            <button
              onClick={handleSpawnAdditional}
              className="w-7 h-7 flex items-center justify-center text-zinc-400 hover:text-zinc-200 hover:bg-zinc-700 rounded ml-1"
              title="Add new terminal"
            >
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" />
              </svg>
            </button>
          </div>
        )}
      </div>

      <div ref={containerRef} className="flex-1 p-2" />
    </div>
  );
}
