import { useState, useEffect, useRef } from 'react';
import type { KanbanColumn } from '../types';

interface AddTaskModalProps {
  initialColumn?: KanbanColumn;
  onAdd: (task: { subject: string; description?: string; column: KanbanColumn; assignee: 'human' | 'agent' }) => void;
  onCancel: () => void;
}

export function AddTaskModal({ initialColumn = 'backlog', onAdd, onCancel }: AddTaskModalProps) {
  const [subject, setSubject] = useState('');
  const [description, setDescription] = useState('');
  const [column, setColumn] = useState<KanbanColumn>(initialColumn);
  const [assignee, setAssignee] = useState<'human' | 'agent'>('human');

  const subjectInputRef = useRef<HTMLInputElement>(null);
  const dialogRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    subjectInputRef.current?.focus();
  }, []);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onCancel();
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [onCancel]);

  useEffect(() => {
    const handleClick = (e: MouseEvent) => {
      if (dialogRef.current && !dialogRef.current.contains(e.target as Node)) {
        onCancel();
      }
    };

    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, [onCancel]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!subject.trim()) return;

    onAdd({
      subject: subject.trim(),
      description: description.trim() || undefined,
      column,
      assignee,
    });
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
      <div
        ref={dialogRef}
        className="bg-zinc-800 border border-zinc-600 rounded-lg shadow-xl p-4 max-w-md w-full mx-4"
      >
        <h3 className="text-lg font-semibold text-zinc-100 mb-4">Add Task</h3>

        <form onSubmit={handleSubmit} className="space-y-4">
          {/* Subject */}
          <div>
            <label className="block text-sm text-zinc-400 mb-1">Subject *</label>
            <input
              ref={subjectInputRef}
              type="text"
              value={subject}
              onChange={(e) => setSubject(e.target.value)}
              placeholder="Task title"
              className="w-full bg-zinc-700 text-zinc-100 text-sm px-3 py-2 rounded border border-zinc-600 focus:border-blue-500 outline-none"
            />
          </div>

          {/* Description */}
          <div>
            <label className="block text-sm text-zinc-400 mb-1">Description</label>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Optional description"
              rows={3}
              className="w-full bg-zinc-700 text-zinc-100 text-sm px-3 py-2 rounded border border-zinc-600 focus:border-blue-500 outline-none resize-none"
            />
          </div>

          {/* Column */}
          <div>
            <label className="block text-sm text-zinc-400 mb-1">Column</label>
            <select
              value={column}
              onChange={(e) => setColumn(e.target.value as KanbanColumn)}
              className="w-full bg-zinc-700 text-zinc-100 text-sm px-3 py-2 rounded border border-zinc-600 focus:border-blue-500 outline-none"
            >
              <option value="backlog">Backlog</option>
              <option value="blocked">Blocked</option>
              <option value="in_progress">In Progress</option>
              <option value="review">Under Review</option>
              <option value="done">Done</option>
            </select>
          </div>

          {/* Assignee */}
          <div>
            <label className="block text-sm text-zinc-400 mb-1">Assignee</label>
            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => setAssignee('human')}
                className={`flex-1 px-3 py-2 text-sm rounded border transition-colors ${
                  assignee === 'human'
                    ? 'bg-purple-500/20 border-purple-500 text-purple-300'
                    : 'bg-zinc-700 border-zinc-600 text-zinc-400 hover:border-zinc-500'
                }`}
              >
                Human
              </button>
              <button
                type="button"
                onClick={() => setAssignee('agent')}
                className={`flex-1 px-3 py-2 text-sm rounded border transition-colors ${
                  assignee === 'agent'
                    ? 'bg-cyan-500/20 border-cyan-500 text-cyan-300'
                    : 'bg-zinc-700 border-zinc-600 text-zinc-400 hover:border-zinc-500'
                }`}
              >
                Agent
              </button>
            </div>
          </div>

          {/* Actions */}
          <div className="flex justify-end gap-2 pt-2">
            <button
              type="button"
              onClick={onCancel}
              className="px-3 py-1.5 text-sm text-zinc-300 hover:bg-zinc-700 rounded transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={!subject.trim()}
              className="px-3 py-1.5 text-sm bg-blue-600 hover:bg-blue-700 text-white rounded transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              Add Task
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
