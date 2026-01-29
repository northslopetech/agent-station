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
import { TaskDetailModal } from './TaskDetailModal';
import { useTasksMdOperations } from '../hooks/useTasksMdOperations';
import type { TasksMdTask } from '../types';
import {
  mapHumanTasksToKanban,
  mapTasksMdToKanban,
  groupTasksByColumn,
  COLUMN_CONFIG,
  COLUMN_ORDER,
  KanbanTask,
} from '../utils/kanbanMapper';
import type { KanbanColumn, HumanTask } from '../types';

interface KanbanBoardProps {
  projectId: string;
}

export function KanbanBoard({ projectId }: KanbanBoardProps) {
  const {
    kanbanState,
    moveTask,
    addHumanTask,
    deleteHumanTask,
    tasksMdTasks,
    projects,
    setTasksMdTasks,
    zoomLevel,
  } = useAppStore();

  const [addingToColumn, setAddingToColumn] = useState<KanbanColumn | null>(null);
  const [editingTask, setEditingTask] = useState<KanbanTask | null>(null);
  const [viewingTask, setViewingTask] = useState<KanbanTask | null>(null);

  const projectKanban = kanbanState[projectId] || { taskOverlays: {}, humanTasks: [] };
  const projectTasksMd = tasksMdTasks[projectId] || [];
  const project = projects.find((p) => p.id === projectId);

  // TASKS.md operations
  const { addTask, updateTask, deleteTask } = useTasksMdOperations(project?.path);

  // Manual refresh of TASKS.md (fallback when watcher doesn't trigger)
  const refreshTasksMd = async () => {
    if (!project) return;
    try {
      const tasks = await invoke<TasksMdTask[]>('read_tasks_md', {
        projectPath: project.path,
      });
      setTasksMdTasks(projectId, tasks);
    } catch (err) {
      console.error('Failed to refresh TASKS.md:', err);
    }
  };

  // Map all tasks to Kanban format (TASKS.md only, no Claude ~/.claude/tasks)
  const allTasks = useMemo(() => {
    const humanTasks = mapHumanTasksToKanban(projectKanban.humanTasks);
    const mdTasks = mapTasksMdToKanban(projectTasksMd);
    return [...humanTasks, ...mdTasks];
  }, [projectKanban.humanTasks, projectTasksMd]);

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
        // Manually refresh to ensure UI updates (watcher may not trigger immediately)
        await refreshTasksMd();
      } catch (err) {
        console.error('Failed to move TASKS.md task:', err);
      }
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
                    <h3
                      className={`font-semibold ${getColumnHeaderColorClasses(columnId)}`}
                      style={{ fontSize: `${Math.round(14 * zoomLevel)}px` }}
                    >
                      {config.title}
                    </h3>
                    <span className="text-zinc-500" style={{ fontSize: `${Math.round(12 * zoomLevel)}px` }}>
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
                                zoomLevel={zoomLevel}
                                onClick={() => setViewingTask(task)}
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
                        <div
                          className="text-zinc-600 text-center py-4"
                          style={{ fontSize: `${Math.round(12 * zoomLevel)}px` }}
                        >
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
                      className="w-full px-2 py-1.5 text-zinc-500 hover:text-zinc-300 hover:bg-zinc-800 rounded transition-colors flex items-center justify-center gap-1"
                      style={{ fontSize: `${Math.round(12 * zoomLevel)}px` }}
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

      {/* Task detail modal */}
      {viewingTask && (
        <TaskDetailModal
          task={viewingTask}
          onClose={() => setViewingTask(null)}
          onEdit={
            viewingTask.isTasksMdTask
              ? () => {
                  setEditingTask(viewingTask);
                  setViewingTask(null);
                }
              : undefined
          }
          onDelete={
            (viewingTask.isHumanTask || viewingTask.isTasksMdTask)
              ? () => {
                  handleDeleteTask(viewingTask);
                  setViewingTask(null);
                }
              : undefined
          }
        />
      )}
    </div>
  );
}
