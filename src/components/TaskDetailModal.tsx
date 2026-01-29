import { KanbanTask, COLUMN_CONFIG } from '../utils/kanbanMapper';
import type { KanbanColumn } from '../types';

interface TaskDetailModalProps {
  task: KanbanTask;
  onClose: () => void;
  onEdit?: () => void;
  onDelete?: () => void;
}

function getColumnBadgeClasses(column: KanbanColumn): string {
  switch (column) {
    case 'blocked':
      return 'bg-red-500/20 text-red-400';
    case 'in_progress':
      return 'bg-blue-500/20 text-blue-400';
    case 'review':
      return 'bg-yellow-500/20 text-yellow-400';
    case 'done':
      return 'bg-emerald-500/20 text-emerald-400';
    default:
      return 'bg-zinc-600 text-zinc-300';
  }
}

export function TaskDetailModal({ task, onClose, onEdit, onDelete }: TaskDetailModalProps) {
  const columnConfig = COLUMN_CONFIG[task.column];

  return (
    <div
      className="fixed inset-0 bg-black/50 flex items-center justify-center z-50"
      onClick={onClose}
    >
      <div
        className="bg-zinc-800 rounded-lg shadow-xl w-[520px] max-w-[90vw] max-h-[80vh] flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="px-4 py-3 border-b border-zinc-700 flex items-start justify-between gap-4">
          <div className="flex-1 min-w-0">
            <h2 className="text-lg font-semibold text-zinc-100 break-words">
              {task.subject}
            </h2>
            <div className="mt-2 flex flex-wrap gap-2">
              {/* Status badge */}
              <span className={`px-2 py-0.5 rounded text-xs ${getColumnBadgeClasses(task.column)}`}>
                {columnConfig.title}
              </span>

              {/* Source badge */}
              <span
                className={`px-2 py-0.5 rounded text-xs ${
                  task.isHumanTask
                    ? 'bg-purple-500/20 text-purple-400'
                    : task.isTasksMdTask
                    ? 'bg-cyan-500/20 text-cyan-400'
                    : 'bg-zinc-600 text-zinc-300'
                }`}
              >
                {task.isHumanTask ? 'Human Task' : task.isTasksMdTask ? 'TASKS.md' : 'Agent Task'}
              </span>

              {/* Assignee badge */}
              {task.assignee && (
                <span className="px-2 py-0.5 rounded text-xs bg-zinc-600 text-zinc-300">
                  {task.assignee === 'human' ? 'Assigned to Human' : 'Assigned to Agent'}
                </span>
              )}
            </div>
          </div>
          <button
            onClick={onClose}
            className="text-zinc-400 hover:text-zinc-200 p-1 flex-shrink-0"
          >
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-4 space-y-4">
          {/* Description */}
          {task.description ? (
            <div>
              <h3 className="text-sm font-medium text-zinc-400 mb-2">Description</h3>
              <div className="text-sm text-zinc-200 whitespace-pre-wrap bg-zinc-900/50 rounded p-3">
                {task.description}
              </div>
            </div>
          ) : (
            <div className="text-sm text-zinc-500 italic">No description provided</div>
          )}

          {/* Owner */}
          {task.owner && (
            <div>
              <h3 className="text-sm font-medium text-zinc-400 mb-1">Owner</h3>
              <div className="text-sm text-zinc-200">{task.owner}</div>
            </div>
          )}

          {/* Dependencies */}
          {((task.blockedBy && task.blockedBy.length > 0) ||
            (task.blocks && task.blocks.length > 0)) && (
            <div className="space-y-3">
              {/* Blocked by */}
              {task.blockedBy && task.blockedBy.length > 0 && (
                <div>
                  <h3 className="text-sm font-medium text-red-400 mb-2">Blocked By</h3>
                  <div className="space-y-1">
                    {task.blockedBy.map((dep) => (
                      <div
                        key={dep}
                        className="text-sm text-zinc-300 bg-zinc-900/50 rounded px-3 py-1.5 flex items-center gap-2"
                      >
                        <svg className="w-4 h-4 text-red-400 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                          <path strokeLinecap="round" strokeLinejoin="round" d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
                        </svg>
                        <span className="truncate">{dep}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Blocks */}
              {task.blocks && task.blocks.length > 0 && (
                <div>
                  <h3 className="text-sm font-medium text-amber-400 mb-2">Blocks</h3>
                  <div className="space-y-1">
                    {task.blocks.map((dep) => (
                      <div
                        key={dep}
                        className="text-sm text-zinc-300 bg-zinc-900/50 rounded px-3 py-1.5 flex items-center gap-2"
                      >
                        <svg className="w-4 h-4 text-amber-400 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                          <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                        </svg>
                        <span className="truncate">{dep}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Footer with actions */}
        {(onEdit || onDelete) && (
          <div className="px-4 py-3 border-t border-zinc-700 flex justify-end gap-2">
            {onDelete && (
              <button
                onClick={onDelete}
                className="px-4 py-2 text-sm text-red-400 hover:text-red-300 hover:bg-red-500/10 rounded transition-colors"
              >
                Delete
              </button>
            )}
            {onEdit && (
              <button
                onClick={onEdit}
                className="px-4 py-2 text-sm bg-blue-600 hover:bg-blue-500 text-white rounded transition-colors"
              >
                Edit
              </button>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
