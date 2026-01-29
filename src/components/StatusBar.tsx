import { useState } from 'react';
import { useAppStore } from '../stores/appStore';
import { SettingsModal } from './SettingsModal';
import type { TasksMdTask } from '../types';

const EMPTY_TASKS: TasksMdTask[] = [];

interface StatusBarProps {
  projectId: string;
}

export function StatusBar({ projectId }: StatusBarProps) {
  const tasks = useAppStore((s) => s.tasksMdTasks[projectId]) ?? EMPTY_TASKS;
  const zoomLevel = useAppStore((s) => s.zoomLevel);
  const incrementZoom = useAppStore((s) => s.incrementZoom);
  const decrementZoom = useAppStore((s) => s.decrementZoom);
  const resetZoom = useAppStore((s) => s.resetZoom);
  const [showSettings, setShowSettings] = useState(false);

  const total = tasks.length;
  const done = tasks.filter((t) => t.completed).length;
  const pct = total > 0 ? (done / total) * 100 : 0;

  return (
    <div className="h-7 bg-zinc-900 border-t border-zinc-700 flex items-center justify-between px-3 text-xs text-zinc-400">
      {/* Left side - task progress */}
      <div className="flex items-center">
        {total === 0 ? (
          <span className="text-zinc-500">No tasks in TASKS.md</span>
        ) : (
          <>
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
          </>
        )}
      </div>

      {/* Right side - zoom controls and settings */}
      <div className="flex items-center gap-2">
        {/* Zoom controls */}
        <div className="flex items-center gap-1 bg-zinc-800 rounded px-1 py-0.5">
          <button
            onClick={decrementZoom}
            className="w-5 h-5 flex items-center justify-center text-zinc-400 hover:text-zinc-200 hover:bg-zinc-700 rounded transition-colors"
            title="Zoom out (Cmd+-)"
          >
            <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M20 12H4" />
            </svg>
          </button>
          <button
            onClick={resetZoom}
            className="px-1.5 text-zinc-300 hover:text-zinc-100 hover:bg-zinc-700 rounded transition-colors min-w-[36px]"
            title="Reset zoom (Cmd+0)"
          >
            {Math.round(zoomLevel * 100)}%
          </button>
          <button
            onClick={incrementZoom}
            className="w-5 h-5 flex items-center justify-center text-zinc-400 hover:text-zinc-200 hover:bg-zinc-700 rounded transition-colors"
            title="Zoom in (Cmd++)"
          >
            <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" />
            </svg>
          </button>
        </div>

        {/* Settings button */}
        <button
          onClick={() => setShowSettings(true)}
          className="w-5 h-5 flex items-center justify-center text-zinc-400 hover:text-zinc-200 hover:bg-zinc-700 rounded transition-colors"
          title="Settings"
        >
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
            <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
          </svg>
        </button>
      </div>

      {/* Settings modal */}
      <SettingsModal
        isOpen={showSettings}
        onClose={() => setShowSettings(false)}
      />
    </div>
  );
}
