import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type { Project, FileNode, TaskProgress, ClaudeTaskProgress, KanbanColumn, TaskOverlay, HumanTask, TasksMdTask, Settings, ClaudeProcessState, ProjectSettings } from '../types';

interface AppState {
  // Projects
  projects: Project[];
  selectedProjectId: string | null;

  // File tree
  fileTree: FileNode | null;
  selectedFilePath: string | null;

  // Editor
  editorContent: string;
  editorLanguage: string;
  isDirty: boolean;

  // Editor view mode: 'file' shows Monaco editor, 'tasks' shows Kanban board
  editorViewMode: 'file' | 'tasks';

  // Kanban state per project (persisted)
  kanbanState: Record<string, {
    taskOverlays: Record<string, TaskOverlay>;
    humanTasks: HumanTask[];
  }>;

  // Task progress per project (markdown checkboxes)
  taskProgress: Record<string, TaskProgress>;

  // Claude Code task progress per project
  claudeTaskProgress: Record<string, ClaudeTaskProgress>;

  // TASKS.md tasks per project
  tasksMdTasks: Record<string, TasksMdTask[]>;

  // Terminal state per project (projectId -> array of terminalIds)
  // Not persisted - terminals don't survive app restart
  terminalIds: Record<string, string[]>;

  // Terminal custom names (terminalId -> custom name)
  // Persisted so names survive across sessions
  terminalNames: Record<string, string>;

  // Settings
  settings: Settings;

  // Claude process state per terminal (terminalId -> state)
  claudeProcessStates: Record<string, ClaudeProcessState>;

  // Per-project settings (projectPath -> settings)
  projectSettings: Record<string, ProjectSettings>;

  // Zoom level (1.0 = 100%, range 0.5-2.0)
  zoomLevel: number;

  // Actions
  setProjects: (projects: Project[]) => void;
  addProject: (project: Project) => void;
  removeProject: (id: string) => void;
  reorderProjects: (oldIndex: number, newIndex: number) => void;
  selectProject: (id: string | null) => void;
  updateProjectProcessStatus: (id: string, hasProcess: boolean) => void;
  addTerminalToProject: (projectId: string, terminalId: string) => void;
  removeTerminalFromProject: (projectId: string, terminalId: string) => void;
  setTerminalName: (terminalId: string, name: string) => void;

  setSettings: (settings: Settings) => void;
  updateSettings: (updates: Partial<Settings>) => void;
  updateProjectSettings: (projectPath: string, updates: Partial<ProjectSettings>) => void;
  setClaudeProcessState: (terminalId: string, state: ClaudeProcessState) => void;
  clearNeedsAttention: (terminalId: string) => void;
  setZoomLevel: (level: number) => void;
  incrementZoom: () => void;
  decrementZoom: () => void;
  resetZoom: () => void;

  setFileTree: (tree: FileNode | null) => void;
  selectFile: (path: string | null) => void;

  setEditorContent: (content: string) => void;
  setEditorLanguage: (language: string) => void;
  setIsDirty: (dirty: boolean) => void;
  setEditorViewMode: (mode: 'file' | 'tasks') => void;

  setTaskProgress: (projectId: string, progress: TaskProgress) => void;
  setClaudeTaskProgress: (projectId: string, progress: ClaudeTaskProgress) => void;
  setTasksMdTasks: (projectId: string, tasks: TasksMdTask[]) => void;

  // Kanban actions
  setTaskOverlay: (projectId: string, taskId: string, overlay: Partial<TaskOverlay>) => void;
  addHumanTask: (projectId: string, task: Omit<HumanTask, 'id' | 'createdAt'>) => void;
  updateHumanTask: (projectId: string, taskId: string, updates: Partial<HumanTask>) => void;
  deleteHumanTask: (projectId: string, taskId: string) => void;
  moveTask: (projectId: string, taskId: string, column: KanbanColumn, isHumanTask: boolean) => void;
}

export const useAppStore = create<AppState>()(
  persist(
    (set) => ({
      // Initial state
      projects: [],
      selectedProjectId: null,
      fileTree: null,
      selectedFilePath: null,
      editorContent: '',
      editorLanguage: 'markdown',
      isDirty: false,
      editorViewMode: 'file',
      kanbanState: {},
      taskProgress: {},
      claudeTaskProgress: {},
      tasksMdTasks: {},
      terminalIds: {},
      terminalNames: {},
      settings: {
        autoStartClaude: false,
        autoStartCommand: 'claude --dangerously-skip-permissions',
        zoomLevel: 1.0,
        enableNotifications: true,
        enableSound: true,
        notificationSound: 'default',
        notifyOnlyWhenUnfocused: true,
      },
      claudeProcessStates: {},
      projectSettings: {},
      zoomLevel: 1.0,

      // Project actions
      setProjects: (projects) => set({ projects }),

      addProject: (project) =>
        set((state) => ({
          projects: [...state.projects, project],
        })),

      removeProject: (id) =>
        set((state) => ({
          projects: state.projects.filter((p) => p.id !== id),
          selectedProjectId:
            state.selectedProjectId === id ? null : state.selectedProjectId,
        })),

      reorderProjects: (oldIndex, newIndex) =>
        set((state) => {
          const newProjects = [...state.projects];
          const [removed] = newProjects.splice(oldIndex, 1);
          newProjects.splice(newIndex, 0, removed);
          return { projects: newProjects };
        }),

      selectProject: (id) =>
        set({
          selectedProjectId: id,
          fileTree: null,
          selectedFilePath: null,
          editorContent: '',
          isDirty: false,
        }),

      updateProjectProcessStatus: (id, hasProcess) =>
        set((state) => ({
          projects: state.projects.map((p) =>
            p.id === id ? { ...p, hasActiveProcess: hasProcess } : p
          ),
        })),

      addTerminalToProject: (projectId, terminalId) =>
        set((state) => ({
          terminalIds: {
            ...state.terminalIds,
            [projectId]: [...(state.terminalIds[projectId] ?? []), terminalId],
          },
        })),

      removeTerminalFromProject: (projectId, terminalId) =>
        set((state) => ({
          terminalIds: {
            ...state.terminalIds,
            [projectId]: (state.terminalIds[projectId] ?? []).filter(
              (id) => id !== terminalId
            ),
          },
        })),

      setTerminalName: (terminalId, name) =>
        set((state) => ({
          terminalNames: {
            ...state.terminalNames,
            [terminalId]: name,
          },
        })),

      // Settings actions
      setSettings: (settings) => set({ settings, zoomLevel: settings.zoomLevel }),

      updateSettings: (updates) =>
        set((state) => ({
          settings: { ...state.settings, ...updates },
          zoomLevel: updates.zoomLevel ?? state.zoomLevel,
        })),

      updateProjectSettings: (projectPath, updates) =>
        set((state) => ({
          projectSettings: {
            ...state.projectSettings,
            [projectPath]: {
              showHiddenFiles: state.projectSettings[projectPath]?.showHiddenFiles ?? false,
              ...updates,
            },
          },
        })),

      // Claude process state actions
      setClaudeProcessState: (terminalId, processState) =>
        set((state) => ({
          claudeProcessStates: {
            ...state.claudeProcessStates,
            [terminalId]: processState,
          },
        })),

      clearNeedsAttention: (terminalId) =>
        set((state) => ({
          claudeProcessStates: {
            ...state.claudeProcessStates,
            [terminalId]: {
              ...state.claudeProcessStates[terminalId],
              needsAttention: false,
            },
          },
        })),

      // Zoom actions
      setZoomLevel: (level) => {
        const clampedLevel = Math.max(0.5, Math.min(2.0, level));
        set((state) => ({
          zoomLevel: clampedLevel,
          settings: { ...state.settings, zoomLevel: clampedLevel },
        }));
      },

      incrementZoom: () =>
        set((state) => {
          const newLevel = Math.min(2.0, state.zoomLevel + 0.1);
          return {
            zoomLevel: newLevel,
            settings: { ...state.settings, zoomLevel: newLevel },
          };
        }),

      decrementZoom: () =>
        set((state) => {
          const newLevel = Math.max(0.5, state.zoomLevel - 0.1);
          return {
            zoomLevel: newLevel,
            settings: { ...state.settings, zoomLevel: newLevel },
          };
        }),

      resetZoom: () =>
        set((state) => ({
          zoomLevel: 1.0,
          settings: { ...state.settings, zoomLevel: 1.0 },
        })),

      // File tree actions
      setFileTree: (tree) => set({ fileTree: tree }),

      selectFile: (path) =>
        set({
          selectedFilePath: path,
          isDirty: false,
          editorViewMode: 'file',
        }),

      // Editor actions
      setEditorContent: (content) => set({ editorContent: content }),

      setEditorLanguage: (language) => set({ editorLanguage: language }),

      setIsDirty: (dirty) => set({ isDirty: dirty }),

      setEditorViewMode: (mode) => set({ editorViewMode: mode }),

      // Task progress actions
      setTaskProgress: (projectId, progress) =>
        set((state) => ({
          taskProgress: {
            ...state.taskProgress,
            [projectId]: progress,
          },
        })),

      setClaudeTaskProgress: (projectId, progress) =>
        set((state) => ({
          claudeTaskProgress: {
            ...state.claudeTaskProgress,
            [projectId]: progress,
          },
        })),

      setTasksMdTasks: (projectId, tasks) =>
        set((state) => ({
          tasksMdTasks: {
            ...state.tasksMdTasks,
            [projectId]: tasks,
          },
        })),

      // Kanban actions
      setTaskOverlay: (projectId, taskId, overlay) =>
        set((state) => {
          const projectState = state.kanbanState[projectId] || { taskOverlays: {}, humanTasks: [] };
          return {
            kanbanState: {
              ...state.kanbanState,
              [projectId]: {
                ...projectState,
                taskOverlays: {
                  ...projectState.taskOverlays,
                  [taskId]: {
                    ...projectState.taskOverlays[taskId],
                    taskId,
                    ...overlay,
                  },
                },
              },
            },
          };
        }),

      addHumanTask: (projectId, task) =>
        set((state) => {
          const projectState = state.kanbanState[projectId] || { taskOverlays: {}, humanTasks: [] };
          const newTask: HumanTask = {
            ...task,
            id: `human-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
            createdAt: Date.now(),
          };
          return {
            kanbanState: {
              ...state.kanbanState,
              [projectId]: {
                ...projectState,
                humanTasks: [...projectState.humanTasks, newTask],
              },
            },
          };
        }),

      updateHumanTask: (projectId, taskId, updates) =>
        set((state) => {
          const projectState = state.kanbanState[projectId];
          if (!projectState) return state;
          return {
            kanbanState: {
              ...state.kanbanState,
              [projectId]: {
                ...projectState,
                humanTasks: projectState.humanTasks.map((t) =>
                  t.id === taskId ? { ...t, ...updates } : t
                ),
              },
            },
          };
        }),

      deleteHumanTask: (projectId, taskId) =>
        set((state) => {
          const projectState = state.kanbanState[projectId];
          if (!projectState) return state;
          return {
            kanbanState: {
              ...state.kanbanState,
              [projectId]: {
                ...projectState,
                humanTasks: projectState.humanTasks.filter((t) => t.id !== taskId),
              },
            },
          };
        }),

      moveTask: (projectId, taskId, column, isHumanTask) =>
        set((state) => {
          const projectState = state.kanbanState[projectId] || { taskOverlays: {}, humanTasks: [] };

          if (isHumanTask) {
            return {
              kanbanState: {
                ...state.kanbanState,
                [projectId]: {
                  ...projectState,
                  humanTasks: projectState.humanTasks.map((t) =>
                    t.id === taskId ? { ...t, column } : t
                  ),
                },
              },
            };
          } else {
            // For Claude tasks, update the overlay
            return {
              kanbanState: {
                ...state.kanbanState,
                [projectId]: {
                  ...projectState,
                  taskOverlays: {
                    ...projectState.taskOverlays,
                    [taskId]: {
                      ...projectState.taskOverlays[taskId],
                      taskId,
                      column,
                    },
                  },
                },
              },
            };
          }
        }),
    }),
    {
      name: 'agent-station-storage',
      partialize: (state) => ({
        projects: state.projects,
        selectedProjectId: state.selectedProjectId,
        terminalNames: state.terminalNames,
        kanbanState: state.kanbanState,
        settings: state.settings,
        zoomLevel: state.zoomLevel,
        projectSettings: state.projectSettings,
      }),
    }
  )
);
