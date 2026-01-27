import { useState, useMemo } from 'react';
import {
  DragDropContext,
  Droppable,
  Draggable,
  DropResult,
} from '@hello-pangea/dnd';
import { useAppStore } from '../stores/appStore';
import { TaskCard } from './TaskCard';
import { AddTaskModal } from './AddTaskModal';
import {
  mapClaudeTasksToKanban,
  mapHumanTasksToKanban,
  groupTasksByColumn,
  COLUMN_CONFIG,
  COLUMN_ORDER,
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
  } = useAppStore();

  const [addingToColumn, setAddingToColumn] = useState<KanbanColumn | null>(null);

  const projectKanban = kanbanState[projectId] || { taskOverlays: {}, humanTasks: [] };

  // Map all tasks to Kanban format
  const allTasks = useMemo(() => {
    const claudeTasks = mapClaudeTasksToKanban(tasks, projectKanban.taskOverlays);
    const humanTasks = mapHumanTasksToKanban(projectKanban.humanTasks);
    return [...claudeTasks, ...humanTasks];
  }, [tasks, projectKanban.taskOverlays, projectKanban.humanTasks]);

  // Group by column
  const columns = useMemo(() => groupTasksByColumn(allTasks), [allTasks]);

  const handleDragEnd = (result: DropResult) => {
    const { draggableId, destination } = result;

    if (!destination) return;

    const newColumn = destination.droppableId as KanbanColumn;
    const task = allTasks.find((t) => t.id === draggableId);

    if (!task) return;

    // Don't allow moving Claude tasks out of their natural state in certain ways
    // For example, a completed task shouldn't be dragged back to backlog
    if (!task.isHumanTask && task.originalStatus === 'completed' && newColumn !== 'done') {
      // Optionally show a warning, but for now just don't move
      return;
    }

    moveTask(projectId, draggableId, newColumn, task.isHumanTask);
  };

  const handleAddTask = (task: Omit<HumanTask, 'id' | 'createdAt'>) => {
    addHumanTask(projectId, task);
    setAddingToColumn(null);
  };

  const handleDeleteTask = (taskId: string) => {
    deleteHumanTask(projectId, taskId);
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
                                  task.isHumanTask
                                    ? () => handleDeleteTask(task.id)
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
    </div>
  );
}
