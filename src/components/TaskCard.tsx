import type { KanbanTask } from '../utils/kanbanMapper';

interface TaskCardProps {
  task: KanbanTask;
  isDragging?: boolean;
  onDelete?: () => void;
}

export function TaskCard({ task, isDragging, onDelete }: TaskCardProps) {
  const isCompleted = task.column === 'done';
  const isBlocked = task.column === 'blocked';
  const isInProgress = task.column === 'in_progress';

  return (
    <div
      className={`p-2.5 rounded-md border transition-all ${
        isDragging
          ? 'opacity-50 border-blue-500 bg-blue-500/20'
          : isInProgress
          ? 'border-blue-500/50 bg-blue-500/10'
          : isCompleted
          ? 'border-zinc-700 bg-zinc-800/50'
          : isBlocked
          ? 'border-red-500/30 bg-red-500/5'
          : 'border-zinc-700 bg-zinc-800'
      }`}
    >
      <div className="flex items-start gap-2">
        {/* Status indicator */}
        <span className="mt-0.5 flex-shrink-0">
          {isCompleted ? (
            <span className="w-4 h-4 text-emerald-500 inline-flex items-center justify-center">
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
              </svg>
            </span>
          ) : isInProgress ? (
            <span className="w-4 h-4 rounded-full bg-blue-500 inline-block animate-pulse" />
          ) : isBlocked ? (
            <span className="w-4 h-4 text-red-500 inline-flex items-center justify-center">
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
              </svg>
            </span>
          ) : (
            <span className="w-4 h-4 rounded-full border-2 border-zinc-500 inline-block" />
          )}
        </span>

        <div className="flex-1 min-w-0">
          {/* Subject */}
          <div
            className={`text-sm font-medium ${
              isCompleted ? 'text-zinc-500 line-through' : 'text-zinc-200'
            }`}
          >
            {task.subject}
          </div>

          {/* Description preview */}
          {task.description && (
            <div className="mt-1 text-xs text-zinc-500 line-clamp-2">
              {task.description}
            </div>
          )}

          {/* Tags */}
          <div className="mt-1.5 flex flex-wrap gap-1">
            {/* Source tag */}
            <span
              className={`px-1.5 py-0.5 rounded text-[10px] ${
                task.isHumanTask
                  ? 'bg-purple-500/20 text-purple-400'
                  : 'bg-cyan-500/20 text-cyan-400'
              }`}
            >
              {task.isHumanTask ? 'Human' : 'Agent'}
            </span>

            {/* Blocked by */}
            {task.blockedBy && task.blockedBy.length > 0 && (
              <span className="px-1.5 py-0.5 rounded text-[10px] bg-red-500/20 text-red-400">
                Blocked
              </span>
            )}

            {/* Owner */}
            {task.owner && (
              <span className="px-1.5 py-0.5 rounded text-[10px] bg-zinc-600 text-zinc-300">
                {task.owner}
              </span>
            )}
          </div>
        </div>

        {/* Delete button for human tasks */}
        {task.isHumanTask && onDelete && (
          <button
            onClick={(e) => {
              e.stopPropagation();
              onDelete();
            }}
            className="text-zinc-500 hover:text-red-400 p-0.5"
            title="Delete task"
          >
            <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        )}
      </div>
    </div>
  );
}
