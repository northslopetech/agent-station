import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type { Project, FileNode, TaskProgress, ClaudeTaskProgress, KanbanColumn, TaskOverlay, HumanTask } from '../types';

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

  // Editor view mode: 'file' shows Monaco editor, 'tasks' shows task list
  editorViewMode: 'file' | 'tasks';

  // Task view mode within tasks: 'list' or 'board'
  taskViewMode: 'list' | 'board';

  // Kanban state per project (persisted)
  kanbanState: Record<string, {
    taskOverlays: Record<string, TaskOverlay>;
    humanTasks: HumanTask[];
  }>;

  // Task progress per project (markdown checkboxes)
  taskProgress: Record<string, TaskProgress>;

  // Claude Code task progress per project
  claudeTaskProgress: Record<string, ClaudeTaskProgress>;

  // Terminal state per project (projectId -> array of terminalIds)
  // Not persisted - terminals don't survive app restart
  terminalIds: Record<string, string[]>;

  // Terminal custom names (terminalId -> custom name)
  // Persisted so names survive across sessions
  terminalNames: Record<string, string>;

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

  setFileTree: (tree: FileNode | null) => void;
  selectFile: (path: string | null) => void;

  setEditorContent: (content: string) => void;
  setEditorLanguage: (language: string) => void;
  setIsDirty: (dirty: boolean) => void;
  setEditorViewMode: (mode: 'file' | 'tasks') => void;

  setTaskProgress: (projectId: string, progress: TaskProgress) => void;
  setClaudeTaskProgress: (projectId: string, progress: ClaudeTaskProgress) => void;

  // Kanban actions
  setTaskViewMode: (mode: 'list' | 'board') => void;
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
      taskViewMode: 'list',
      kanbanState: {},
      taskProgress: {},
      claudeTaskProgress: {},
      terminalIds: {},
      terminalNames: {},

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

      // Kanban actions
      setTaskViewMode: (mode) => set({ taskViewMode: mode }),

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
      }),
    }
  )
);
