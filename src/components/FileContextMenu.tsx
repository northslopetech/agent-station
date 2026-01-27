import { useEffect, useRef } from "react";

export interface ContextMenuAction {
  label: string;
  onClick: () => void;
  danger?: boolean;
  disabled?: boolean;
}

interface FileContextMenuProps {
  x: number;
  y: number;
  actions: ContextMenuAction[];
  onClose: () => void;
}

export function FileContextMenu({ x, y, actions, onClose }: FileContextMenuProps) {
  const menuRef = useRef<HTMLDivElement>(null);

  // Adjust position if menu would go off screen
  useEffect(() => {
    if (menuRef.current) {
      const rect = menuRef.current.getBoundingClientRect();
      const viewportWidth = window.innerWidth;
      const viewportHeight = window.innerHeight;

      let adjustedX = x;
      let adjustedY = y;

      if (x + rect.width > viewportWidth) {
        adjustedX = viewportWidth - rect.width - 8;
      }

      if (y + rect.height > viewportHeight) {
        adjustedY = viewportHeight - rect.height - 8;
      }

      if (adjustedX !== x || adjustedY !== y) {
        menuRef.current.style.left = `${adjustedX}px`;
        menuRef.current.style.top = `${adjustedY}px`;
      }
    }
  }, [x, y]);

  // Close on click outside
  useEffect(() => {
    const handleClick = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        onClose();
      }
    };

    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        onClose();
      }
    };

    document.addEventListener("mousedown", handleClick);
    document.addEventListener("keydown", handleEscape);

    return () => {
      document.removeEventListener("mousedown", handleClick);
      document.removeEventListener("keydown", handleEscape);
    };
  }, [onClose]);

  return (
    <div
      ref={menuRef}
      className="fixed bg-zinc-800 border border-zinc-600 rounded shadow-lg py-1 z-50 min-w-[160px]"
      style={{ top: y, left: x }}
    >
      {actions.map((action, index) => (
        <button
          key={index}
          onClick={() => {
            if (!action.disabled) {
              action.onClick();
              onClose();
            }
          }}
          disabled={action.disabled}
          className={`w-full px-3 py-1.5 text-sm text-left transition-colors ${
            action.disabled
              ? "text-zinc-500 cursor-not-allowed"
              : action.danger
              ? "text-red-400 hover:bg-red-500/20"
              : "text-zinc-200 hover:bg-zinc-700"
          }`}
        >
          {action.label}
        </button>
      ))}
    </div>
  );
}
