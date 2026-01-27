export interface Project {
  id: string;
  name: string;
  path: string;
  hasActiveProcess: boolean;
  taskProgress?: TaskProgress;
}

export interface TaskProgress {
  total: number;
  completed: number;
  percentage: number;
}

export interface FileNode {
  name: string;
  path: string;
  isDirectory: boolean;
  children?: FileNode[];
}

export interface TerminalState {
  id: string;
  projectId: string;
  isRunning: boolean;
}

// Claude Code task types
export interface ClaudeTask {
  id: string;
  subject: string;
  status: 'pending' | 'in_progress' | 'completed';
  description?: string;
  blocks?: string[];
  blockedBy?: string[];
  owner?: string;
}

export interface ClaudeTaskProgress {
  total: number;
  pending: number;
  inProgress: number;
  completed: number;
  percentage: number;
  tasks: ClaudeTask[];
  isActive: boolean;
}

// Kanban types
export type KanbanColumn = 'backlog' | 'blocked' | 'in_progress' | 'review' | 'done';

export interface TaskOverlay {
  taskId: string;
  column?: KanbanColumn;  // Manual override
  humanNotes?: string;
}

export interface HumanTask {
  id: string;
  subject: string;
  description?: string;
  column: KanbanColumn;
  assignee: 'human' | 'agent';
  createdAt: number;
}

export interface KanbanState {
  projectId: string;
  taskOverlays: Record<string, TaskOverlay>;
  humanTasks: HumanTask[];
}

// TASKS.md task type
export interface TasksMdTask {
  id: string;
  subject: string;
  description?: string;
  column: 'backlog' | 'blocked' | 'in_progress' | 'review' | 'done';
  completed: boolean;
  lineNumber: number;
}
