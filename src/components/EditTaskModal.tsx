import { useState, useEffect, useRef } from 'react';

interface EditTaskModalProps {
  initialSubject: string;
  initialDescription?: string;
  onSave: (oldSubject: string, newSubject: string, newDescription?: string) => void;
  onCancel: () => void;
}

export function EditTaskModal({
  initialSubject,
  initialDescription,
  onSave,
  onCancel,
}: EditTaskModalProps) {
  const [subject, setSubject] = useState(initialSubject);
  const [description, setDescription] = useState(initialDescription || '');

  const subjectInputRef = useRef<HTMLInputElement>(null);
  const dialogRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    subjectInputRef.current?.focus();
    subjectInputRef.current?.select();
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

    onSave(
      initialSubject,
      subject.trim(),
      description.trim() || undefined
    );
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
      <div
        ref={dialogRef}
        className="bg-zinc-800 border border-zinc-600 rounded-lg shadow-xl p-4 max-w-md w-full mx-4"
      >
        <h3 className="text-lg font-semibold text-zinc-100 mb-4">Edit Task</h3>

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
              Save
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
