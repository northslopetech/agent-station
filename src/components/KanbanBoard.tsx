import { useState, useMemo } from 'react';
import {
  DragDropContext,
  Droppable,
  Draggable,
  DropResult,
} from '@hello-pangea/dnd';
import { invoke } from '@tauri-apps/api/core';
import { useAppStore } from '../stores/appStore';
import { TaskCard } from './TaskCard';
import { AddTaskModal } from './AddTaskModal';
import { EditTaskModal } from './EditTaskModal';
import { useTasksMdOperations } from '../hooks/useTasksMdOperations';
import {
  mapClaudeTasksToKanban,
  mapHumanTasksToKanban,
  mapTasksMdToKanban,
  groupTasksByColumn,
  COLUMN_CONFIG,
  COLUMN_ORDER,
  KanbanTask,
} from '../utils/kanbanMapper';
import type { KanbanColumn, ClaudeTask, HumanTask } from '../types';

interface KanbanBoardProps {
  projectId: string;
  tasks: ClaudeTask[];
}

export function KanbanBoard({ projectId, tasks }: KanbanBoardProps) {
  const {
    kanbanState,
    moveTask,
    addHumanTask,
    deleteHumanTask,
    tasksMdTasks,
    projects,
  } = useAppStore();

  const [addingToColumn, setAddingToColumn] = useState<KanbanColumn | null>(null);
  const [editingTask, setEditingTask] = useState<KanbanTask | null>(null);

  const projectKanban = kanbanState[projectId] || { taskOverlays: {}, humanTasks: [] };
  const projectTasksMd = tasksMdTasks[projectId] || [];
  const project = projects.find((p) => p.id === projectId);

  // TASKS.md operations
  const { addTask, updateTask, deleteTask } = useTasksMdOperations(project?.path);

  // Map all tasks to Kanban format
  const allTasks = useMemo(() => {
    const claudeTasks = mapClaudeTasksToKanban(tasks, projectKanban.taskOverlays);
    const humanTasks = mapHumanTasksToKanban(projectKanban.humanTasks);
    const mdTasks = mapTasksMdToKanban(projectTasksMd);
    return [...claudeTasks, ...humanTasks, ...mdTasks];
  }, [tasks, projectKanban.taskOverlays, projectKanban.humanTasks, projectTasksMd]);

  // Group by column
  const columns = useMemo(() => groupTasksByColumn(allTasks), [allTasks]);

  const handleDragEnd = async (result: DropResult) => {
    const { draggableId, destination } = result;

    if (!destination) return;

    const newColumn = destination.droppableId as KanbanColumn;
    const task = allTasks.find((t) => t.id === draggableId);

    if (!task) return;

    // Handle TASKS.md tasks
    if (task.isTasksMdTask && project) {
      // Extract the subject from the ID (format: tasksmd-{subject})
      const taskSubject = task.subject;
      try {
        await invoke('move_task_in_tasks_md', {
          projectPath: project.path,
          taskSubject,
          newColumn,
        });
        // The file watcher will update the state automatically
      } catch (err) {
        console.error('Failed to move TASKS.md task:', err);
      }
      return;
    }

    // Don't allow moving Claude tasks out of their natural state in certain ways
    // For example, a completed task shouldn't be dragged back to backlog
    if (!task.isHumanTask && !task.isTasksMdTask && task.originalStatus === 'completed' && newColumn !== 'done') {
      // Optionally show a warning, but for now just don't move
      return;
    }

    moveTask(projectId, draggableId, newColumn, task.isHumanTask);
  };

  const handleAddTask = async (task: Omit<HumanTask, 'id' | 'createdAt'>) => {
    // Write to TASKS.md instead of localStorage
    try {
      await addTask({
        subject: task.subject,
        description: task.description,
        column: task.column,
      });
      // The file watcher will automatically update the UI
    } catch (err) {
      console.error('Failed to add task to TASKS.md:', err);
      // Fallback to localStorage if TASKS.md fails
      addHumanTask(projectId, task);
    }
    setAddingToColumn(null);
  };

  const handleDeleteTask = async (task: KanbanTask) => {
    if (task.isTasksMdTask) {
      // Delete from TASKS.md
      try {
        await deleteTask(task.subject);
        // The file watcher will automatically update the UI
      } catch (err) {
        console.error('Failed to delete task from TASKS.md:', err);
      }
    } else if (task.isHumanTask) {
      // Delete from localStorage
      deleteHumanTask(projectId, task.id);
    }
  };

  const handleEditTask = async (oldSubject: string, newSubject: string, newDescription?: string) => {
    try {
      await updateTask(oldSubject, newSubject, newDescription);
      // The file watcher will automatically update the UI
    } catch (err) {
      console.error('Failed to update task in TASKS.md:', err);
    }
    setEditingTask(null);
  };

  const getColumnColorClasses = (column: KanbanColumn) => {
    switch (column) {
      case 'blocked':
        return 'border-red-500/30';
      case 'in_progress':
        return 'border-blue-500/30';
      case 'review':
        return 'border-yellow-500/30';
      case 'done':
        return 'border-emerald-500/30';
      default:
        return 'border-zinc-700';
    }
  };

  const getColumnHeaderColorClasses = (column: KanbanColumn) => {
    switch (column) {
      case 'blocked':
        return 'text-red-400';
      case 'in_progress':
        return 'text-blue-400';
      case 'review':
        return 'text-yellow-400';
      case 'done':
        return 'text-emerald-400';
      default:
        return 'text-zinc-400';
    }
  };

  return (
    <div className="h-full flex flex-col">
      <DragDropContext onDragEnd={handleDragEnd}>
        <div className="flex-1 flex gap-3 overflow-x-auto p-4">
          {COLUMN_ORDER.map((columnId) => {
            const config = COLUMN_CONFIG[columnId];
            const columnTasks = columns[columnId];

            return (
              <div
                key={columnId}
                className={`flex-shrink-0 w-64 flex flex-col rounded-lg border ${getColumnColorClasses(columnId)} bg-zinc-900/50`}
              >
                {/* Column header */}
                <div className="p-3 border-b border-zinc-700/50">
                  <div className="flex items-center justify-between">
                    <h3 className={`text-sm font-semibold ${getColumnHeaderColorClasses(columnId)}`}>
                      {config.title}
                    </h3>
                    <span className="text-xs text-zinc-500">
                      {columnTasks.length}
                    </span>
                  </div>
                </div>

                {/* Droppable area */}
                <Droppable droppableId={columnId}>
                  {(provided, snapshot) => (
                    <div
                      ref={provided.innerRef}
                      {...provided.droppableProps}
                      className={`flex-1 p-2 space-y-2 overflow-y-auto min-h-[100px] ${
                        snapshot.isDraggingOver ? 'bg-zinc-800/50' : ''
                      }`}
                    >
                      {columnTasks.map((task, index) => (
                        <Draggable
                          key={task.id}
                          draggableId={task.id}
                          index={index}
                        >
                          {(provided, snapshot) => (
                            <div
                              ref={provided.innerRef}
                              {...provided.draggableProps}
                              {...provided.dragHandleProps}
                            >
                              <TaskCard
                                task={task}
                                isDragging={snapshot.isDragging}
                                onDelete={
                                  (task.isHumanTask || task.isTasksMdTask)
                                    ? () => handleDeleteTask(task)
                                    : undefined
                                }
                                onEdit={
                                  task.isTasksMdTask
                                    ? () => setEditingTask(task)
                                    : undefined
                                }
                              />
                            </div>
                          )}
                        </Draggable>
                      ))}
                      {provided.placeholder}

                      {/* Empty state */}
                      {columnTasks.length === 0 && !snapshot.isDraggingOver && (
                        <div className="text-xs text-zinc-600 text-center py-4">
                          No tasks
                        </div>
                      )}
                    </div>
                  )}
                </Droppable>

                {/* Add task button for appropriate columns */}
                {(columnId === 'backlog' || columnId === 'review') && (
                  <div className="p-2 border-t border-zinc-700/50">
                    <button
                      onClick={() => setAddingToColumn(columnId)}
                      className="w-full px-2 py-1.5 text-xs text-zinc-500 hover:text-zinc-300 hover:bg-zinc-800 rounded transition-colors flex items-center justify-center gap-1"
                    >
                      <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" />
                      </svg>
                      Add Task
                    </button>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </DragDropContext>

      {/* Add task modal */}
      {addingToColumn && (
        <AddTaskModal
          initialColumn={addingToColumn}
          onAdd={handleAddTask}
          onCancel={() => setAddingToColumn(null)}
        />
      )}

      {/* Edit task modal */}
      {editingTask && (
        <EditTaskModal
          initialSubject={editingTask.subject}
          initialDescription={editingTask.description}
          onSave={handleEditTask}
          onCancel={() => setEditingTask(null)}
        />
      )}
    </div>
  );
}
