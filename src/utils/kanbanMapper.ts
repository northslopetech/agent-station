import type { KanbanColumn, HumanTask, TasksMdTask } from '../types';

export interface KanbanTask {
  id: string;
  subject: string;
  description?: string;
  column: KanbanColumn;
  isHumanTask: boolean;
  isTasksMdTask?: boolean;
  assignee?: 'human' | 'agent';
  blockedBy?: string[];
  blocks?: string[];
  owner?: string;
}

/**
 * Maps human tasks to Kanban tasks
 */
export function mapHumanTasksToKanban(tasks: HumanTask[]): KanbanTask[] {
  return tasks.map((task) => ({
    id: task.id,
    subject: task.subject,
    description: task.description,
    column: task.column,
    isHumanTask: true,
    assignee: task.assignee,
  }));
}

/**
 * Maps TASKS.md tasks to Kanban tasks
 */
export function mapTasksMdToKanban(tasks: TasksMdTask[]): KanbanTask[] {
  return tasks.map((task) => ({
    id: `tasksmd-${task.subject}`, // Use subject as part of ID since task.id is ephemeral
    subject: task.subject,
    description: task.description,
    column: task.column as KanbanColumn,
    isHumanTask: false,
    isTasksMdTask: true,
    assignee: 'human', // TASKS.md tasks are human tasks by default
  }));
}

/**
 * Groups tasks by column
 */
export function groupTasksByColumn(tasks: KanbanTask[]): Record<KanbanColumn, KanbanTask[]> {
  const columns: Record<KanbanColumn, KanbanTask[]> = {
    backlog: [],
    blocked: [],
    in_progress: [],
    review: [],
    done: [],
  };

  for (const task of tasks) {
    columns[task.column].push(task);
  }

  return columns;
}

/**
 * Column display configuration
 */
export const COLUMN_CONFIG: Record<KanbanColumn, { title: string; color: string }> = {
  backlog: { title: 'Backlog', color: 'zinc' },
  blocked: { title: 'Blocked', color: 'red' },
  in_progress: { title: 'In Progress', color: 'blue' },
  review: { title: 'Under Review', color: 'yellow' },
  done: { title: 'Done', color: 'emerald' },
};

export const COLUMN_ORDER: KanbanColumn[] = ['backlog', 'blocked', 'in_progress', 'review', 'done'];
