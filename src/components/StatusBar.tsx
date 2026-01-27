import { useAppStore } from '../stores/appStore';

interface StatusBarProps {
  projectId: string;
}

export function StatusBar({ projectId }: StatusBarProps) {
  const tasks = useAppStore((s) => s.tasksMdTasks[projectId] ?? []);
  const total = tasks.length;
  const done = tasks.filter((t) => t.completed).length;
  const pct = total > 0 ? (done / total) * 100 : 0;

  if (total === 0) {
    return (
      <div className="h-6 bg-zinc-900 border-t border-zinc-700 flex items-center px-3 text-xs text-zinc-500">
        <span>No tasks in TASKS.md</span>
      </div>
    );
  }

  return (
    <div className="h-6 bg-zinc-900 border-t border-zinc-700 flex items-center px-3 text-xs text-zinc-400">
      <div className="w-24 h-1.5 bg-zinc-700 rounded-full overflow-hidden">
        <div
          className="h-full bg-emerald-500 transition-all duration-300"
          style={{ width: `${pct}%` }}
        />
      </div>
      <span className="ml-2">
        {done}/{total} tasks
      </span>
      {pct === 100 && (
        <span className="ml-2 text-emerald-400">All done!</span>
      )}
    </div>
  );
}
