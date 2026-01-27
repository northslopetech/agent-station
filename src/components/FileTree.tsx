import { useEffect, useState, useCallback, useRef } from "react";
import { invoke } from "@tauri-apps/api/core";
import { useAppStore } from "../stores/appStore";
import { FileContextMenu, ContextMenuAction } from "./FileContextMenu";
import { ConfirmDialog } from "./ConfirmDialog";

interface FileEntry {
  name: string;
  path: string;
  isDirectory: boolean;
  children?: FileEntry[];
}

interface TreeNodeProps {
  node: FileEntry;
  level: number;
  expandedPaths: Set<string>;
  selectedPath: string | null;
  renamingPath: string | null;
  renamingValue: string;
  creatingIn: string | null;
  creatingType: "file" | "folder" | null;
  creatingValue: string;
  onToggle: (path: string) => void;
  onSelect: (path: string) => void;
  onContextMenu: (e: React.MouseEvent, entry: FileEntry) => void;
  onRenameChange: (value: string) => void;
  onRenameSubmit: () => void;
  onRenameCancel: () => void;
  onCreateChange: (value: string) => void;
  onCreateSubmit: () => void;
  onCreateCancel: () => void;
}

function TreeNode({
  node,
  level,
  expandedPaths,
  selectedPath,
  renamingPath,
  renamingValue,
  creatingIn,
  creatingType,
  creatingValue,
  onToggle,
  onSelect,
  onContextMenu,
  onRenameChange,
  onRenameSubmit,
  onRenameCancel,
  onCreateChange,
  onCreateSubmit,
  onCreateCancel,
}: TreeNodeProps) {
  const isExpanded = expandedPaths.has(node.path);
  const isSelected = selectedPath === node.path;
  const isRenaming = renamingPath === node.path;
  const isCreatingHere = creatingIn === node.path;
  const inputRef = useRef<HTMLInputElement>(null);
  const createInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (isRenaming && inputRef.current) {
      inputRef.current.focus();
      inputRef.current.select();
    }
  }, [isRenaming]);

  useEffect(() => {
    if (isCreatingHere && createInputRef.current) {
      createInputRef.current.focus();
    }
  }, [isCreatingHere]);

  const handleClick = () => {
    if (isRenaming) return;
    if (node.isDirectory) {
      onToggle(node.path);
    } else {
      onSelect(node.path);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter") {
      onRenameSubmit();
    } else if (e.key === "Escape") {
      onRenameCancel();
    }
  };

  const handleCreateKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter") {
      onCreateSubmit();
    } else if (e.key === "Escape") {
      onCreateCancel();
    }
  };

  return (
    <div>
      <div
        className={`flex items-center gap-1 px-2 py-0.5 cursor-pointer text-sm hover:bg-zinc-700/50 ${
          isSelected ? "bg-zinc-700 text-white" : "text-zinc-300"
        }`}
        style={{ paddingLeft: `${level * 12 + 8}px` }}
        onClick={handleClick}
        onContextMenu={(e) => onContextMenu(e, node)}
      >
        {node.isDirectory ? (
          <>
            <span className="text-zinc-500 w-4 text-center">
              {isExpanded ? "▼" : "▶"}
            </span>
            <span className="text-yellow-500">📁</span>
          </>
        ) : (
          <>
            <span className="w-4" />
            <span>{getFileIcon(node.name)}</span>
          </>
        )}
        {isRenaming ? (
          <input
            ref={inputRef}
            type="text"
            value={renamingValue}
            onChange={(e) => onRenameChange(e.target.value)}
            onBlur={onRenameSubmit}
            onKeyDown={handleKeyDown}
            onClick={(e) => e.stopPropagation()}
            className="flex-1 bg-zinc-700 text-zinc-100 text-sm px-1 py-0 rounded outline-none border border-blue-500"
          />
        ) : (
          <span className="truncate">{node.name}</span>
        )}
      </div>

      {node.isDirectory && isExpanded && (
        <div>
          {/* New file/folder input */}
          {isCreatingHere && (
            <div
              className="flex items-center gap-1 px-2 py-0.5 text-sm"
              style={{ paddingLeft: `${(level + 1) * 12 + 8}px` }}
            >
              <span className="w-4" />
              <span>{creatingType === "folder" ? "📁" : "📄"}</span>
              <input
                ref={createInputRef}
                type="text"
                value={creatingValue}
                onChange={(e) => onCreateChange(e.target.value)}
                onBlur={onCreateCancel}
                onKeyDown={handleCreateKeyDown}
                placeholder={creatingType === "folder" ? "folder name" : "file name"}
                className="flex-1 bg-zinc-700 text-zinc-100 text-sm px-1 py-0 rounded outline-none border border-blue-500"
              />
            </div>
          )}
          {node.children?.map((child) => (
            <TreeNode
              key={child.path}
              node={child}
              level={level + 1}
              expandedPaths={expandedPaths}
              selectedPath={selectedPath}
              renamingPath={renamingPath}
              renamingValue={renamingValue}
              creatingIn={creatingIn}
              creatingType={creatingType}
              creatingValue={creatingValue}
              onToggle={onToggle}
              onSelect={onSelect}
              onContextMenu={onContextMenu}
              onRenameChange={onRenameChange}
              onRenameSubmit={onRenameSubmit}
              onRenameCancel={onRenameCancel}
              onCreateChange={onCreateChange}
              onCreateSubmit={onCreateSubmit}
              onCreateCancel={onCreateCancel}
            />
          ))}
        </div>
      )}
    </div>
  );
}

function getFileIcon(filename: string): string {
  const ext = filename.split(".").pop()?.toLowerCase();

  switch (ext) {
    case "md":
      return "📝";
    case "ts":
    case "tsx":
      return "🔷";
    case "js":
    case "jsx":
      return "🟨";
    case "json":
      return "📋";
    case "css":
      return "🎨";
    case "html":
      return "🌐";
    case "rs":
      return "🦀";
    case "py":
      return "🐍";
    case "toml":
    case "yaml":
    case "yml":
      return "⚙️";
    case "svg":
    case "png":
    case "jpg":
    case "jpeg":
    case "gif":
      return "🖼️";
    default:
      return "📄";
  }
}

export function FileTree() {
  const { projects, selectedProjectId, selectedFilePath, selectFile } =
    useAppStore();

  const [rootEntries, setRootEntries] = useState<FileEntry[]>([]);
  const [expandedPaths, setExpandedPaths] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Context menu state
  const [contextMenu, setContextMenu] = useState<{
    x: number;
    y: number;
    entry: FileEntry;
  } | null>(null);

  // Rename state
  const [renamingPath, setRenamingPath] = useState<string | null>(null);
  const [renamingValue, setRenamingValue] = useState("");

  // Create state
  const [creatingIn, setCreatingIn] = useState<string | null>(null);
  const [creatingType, setCreatingType] = useState<"file" | "folder" | null>(null);
  const [creatingValue, setCreatingValue] = useState("");

  // Delete confirmation state
  const [deleteConfirm, setDeleteConfirm] = useState<FileEntry | null>(null);

  const selectedProject = projects.find((p) => p.id === selectedProjectId);

  // Load directory when project changes
  useEffect(() => {
    if (!selectedProject) {
      setRootEntries([]);
      return;
    }

    loadDirectory(selectedProject.path);
    // Reset state when project changes
    setExpandedPaths(new Set());
    setRenamingPath(null);
    setCreatingIn(null);
  }, [selectedProject]);

  const loadDirectory = async (path: string) => {
    setLoading(true);
    setError(null);
    try {
      const entries = await invoke<FileEntry[]>("list_directory", { path });
      setRootEntries(entries);
    } catch (err) {
      setError(String(err));
      setRootEntries([]);
    } finally {
      setLoading(false);
    }
  };

  const refreshDirectory = useCallback(async (dirPath: string) => {
    try {
      const children = await invoke<FileEntry[]>("list_directory", { path: dirPath });
      if (dirPath === selectedProject?.path) {
        setRootEntries(children);
      } else {
        setRootEntries((prev) => updateChildren(prev, dirPath, children));
      }
    } catch (err) {
      console.error("Failed to refresh directory:", err);
    }
  }, [selectedProject?.path]);

  const handleToggle = useCallback(async (path: string) => {
    setExpandedPaths((prev) => {
      const next = new Set(prev);
      if (next.has(path)) {
        next.delete(path);
      } else {
        next.add(path);
      }
      return next;
    });

    // Load children for the expanded directory
    try {
      const children = await invoke<FileEntry[]>("list_directory", { path });
      setRootEntries((prev) => updateChildren(prev, path, children));
    } catch (err) {
      console.error("Failed to load directory:", err);
    }
  }, []);

  const updateChildren = (
    entries: FileEntry[],
    targetPath: string,
    children: FileEntry[]
  ): FileEntry[] => {
    return entries.map((entry) => {
      if (entry.path === targetPath) {
        return { ...entry, children };
      }
      if (entry.children) {
        return { ...entry, children: updateChildren(entry.children, targetPath, children) };
      }
      return entry;
    });
  };

  const handleSelect = useCallback(
    (path: string) => {
      selectFile(path);
    },
    [selectFile]
  );

  const handleContextMenu = useCallback((e: React.MouseEvent, entry: FileEntry) => {
    e.preventDefault();
    e.stopPropagation();
    setContextMenu({ x: e.clientX, y: e.clientY, entry });
  }, []);

  const handleRootContextMenu = useCallback((e: React.MouseEvent) => {
    if (!selectedProject) return;
    e.preventDefault();
    // Create a fake entry for the root directory
    setContextMenu({
      x: e.clientX,
      y: e.clientY,
      entry: {
        name: selectedProject.name,
        path: selectedProject.path,
        isDirectory: true,
      },
    });
  }, [selectedProject]);

  const closeContextMenu = useCallback(() => {
    setContextMenu(null);
  }, []);

  // Rename handlers
  const startRename = useCallback((entry: FileEntry) => {
    setRenamingPath(entry.path);
    setRenamingValue(entry.name);
  }, []);

  const handleRenameSubmit = useCallback(async () => {
    if (!renamingPath || !renamingValue.trim()) {
      setRenamingPath(null);
      setRenamingValue("");
      return;
    }

    const dir = renamingPath.substring(0, renamingPath.lastIndexOf("/"));
    const newPath = `${dir}/${renamingValue.trim()}`;

    if (newPath === renamingPath) {
      setRenamingPath(null);
      setRenamingValue("");
      return;
    }

    try {
      await invoke("rename_path", { oldPath: renamingPath, newPath });
      await refreshDirectory(dir);
    } catch (err) {
      console.error("Failed to rename:", err);
      alert(`Failed to rename: ${err}`);
    } finally {
      setRenamingPath(null);
      setRenamingValue("");
    }
  }, [renamingPath, renamingValue, refreshDirectory]);

  const handleRenameCancel = useCallback(() => {
    setRenamingPath(null);
    setRenamingValue("");
  }, []);

  // Create handlers
  const startCreate = useCallback((parentPath: string, type: "file" | "folder") => {
    setCreatingIn(parentPath);
    setCreatingType(type);
    setCreatingValue("");
    // Ensure the parent directory is expanded
    setExpandedPaths((prev) => new Set([...prev, parentPath]));
  }, []);

  const handleCreateSubmit = useCallback(async () => {
    if (!creatingIn || !creatingType || !creatingValue.trim()) {
      setCreatingIn(null);
      setCreatingType(null);
      setCreatingValue("");
      return;
    }

    const newPath = `${creatingIn}/${creatingValue.trim()}`;

    try {
      if (creatingType === "folder") {
        await invoke("create_directory", { path: newPath });
      } else {
        await invoke("create_file", { path: newPath });
      }
      await refreshDirectory(creatingIn);
    } catch (err) {
      console.error("Failed to create:", err);
      alert(`Failed to create: ${err}`);
    } finally {
      setCreatingIn(null);
      setCreatingType(null);
      setCreatingValue("");
    }
  }, [creatingIn, creatingType, creatingValue, refreshDirectory]);

  const handleCreateCancel = useCallback(() => {
    setCreatingIn(null);
    setCreatingType(null);
    setCreatingValue("");
  }, []);

  // Delete handlers
  const handleDelete = useCallback(async () => {
    if (!deleteConfirm) return;

    const dir = deleteConfirm.path.substring(0, deleteConfirm.path.lastIndexOf("/"));

    try {
      await invoke("delete_path", { path: deleteConfirm.path });
      await refreshDirectory(dir);
    } catch (err) {
      console.error("Failed to delete:", err);
      alert(`Failed to delete: ${err}`);
    } finally {
      setDeleteConfirm(null);
    }
  }, [deleteConfirm, refreshDirectory]);

  // Build context menu actions
  const getContextMenuActions = useCallback((entry: FileEntry): ContextMenuAction[] => {
    const actions: ContextMenuAction[] = [];

    if (entry.isDirectory) {
      actions.push({
        label: "New File",
        onClick: () => startCreate(entry.path, "file"),
      });
      actions.push({
        label: "New Folder",
        onClick: () => startCreate(entry.path, "folder"),
      });
    }

    // Don't allow renaming/deleting the root
    if (entry.path !== selectedProject?.path) {
      actions.push({
        label: "Rename",
        onClick: () => startRename(entry),
      });
      actions.push({
        label: "Delete",
        onClick: () => setDeleteConfirm(entry),
        danger: true,
      });
    }

    return actions;
  }, [selectedProject?.path, startCreate, startRename]);

  if (!selectedProject) {
    return (
      <div className="h-full flex flex-col bg-zinc-850 text-zinc-100">
        <div className="p-3 border-b border-zinc-700">
          <h2 className="text-sm font-semibold text-zinc-400 uppercase tracking-wide">
            Files
          </h2>
        </div>
        <div className="flex-1 flex items-center justify-center">
          <div className="text-zinc-500 text-sm p-4 text-center">
            Select a project to view files
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="h-full flex flex-col bg-zinc-850 text-zinc-100">
      <div className="p-3 border-b border-zinc-700 flex items-center justify-between">
        <div>
          <h2 className="text-sm font-semibold text-zinc-400 uppercase tracking-wide">
            Files
          </h2>
          <div className="text-xs text-zinc-500 truncate mt-1">
            {selectedProject.name}
          </div>
        </div>
        <div className="flex items-center gap-1">
          <button
            onClick={() => startCreate(selectedProject.path, "file")}
            className="w-6 h-6 flex items-center justify-center text-zinc-400 hover:text-zinc-200 hover:bg-zinc-700 rounded"
            title="New File"
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M9 12h6m-3-3v6m-6 4h12a2 2 0 002-2V8l-5-5H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
            </svg>
          </button>
          <button
            onClick={() => startCreate(selectedProject.path, "folder")}
            className="w-6 h-6 flex items-center justify-center text-zinc-400 hover:text-zinc-200 hover:bg-zinc-700 rounded"
            title="New Folder"
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 10v6m3-3H9m4-7H5a2 2 0 00-2 2v10a2 2 0 002 2h14a2 2 0 002-2V8a2 2 0 00-2-2h-6l-2-2z" />
            </svg>
          </button>
        </div>
      </div>

      <div
        className="flex-1 overflow-y-auto"
        onContextMenu={handleRootContextMenu}
      >
        {loading ? (
          <div className="p-4 text-zinc-500 text-sm">Loading...</div>
        ) : error ? (
          <div className="p-4 text-red-400 text-sm">{error}</div>
        ) : rootEntries.length === 0 ? (
          <div className="p-4 text-zinc-500 text-sm">No files found</div>
        ) : (
          <div className="py-1">
            {/* Root-level create input */}
            {creatingIn === selectedProject.path && (
              <div
                className="flex items-center gap-1 px-2 py-0.5 text-sm"
                style={{ paddingLeft: "8px" }}
              >
                <span className="w-4" />
                <span>{creatingType === "folder" ? "📁" : "📄"}</span>
                <input
                  autoFocus
                  type="text"
                  value={creatingValue}
                  onChange={(e) => setCreatingValue(e.target.value)}
                  onBlur={handleCreateCancel}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") handleCreateSubmit();
                    else if (e.key === "Escape") handleCreateCancel();
                  }}
                  placeholder={creatingType === "folder" ? "folder name" : "file name"}
                  className="flex-1 bg-zinc-700 text-zinc-100 text-sm px-1 py-0 rounded outline-none border border-blue-500"
                />
              </div>
            )}
            {rootEntries.map((entry) => (
              <TreeNode
                key={entry.path}
                node={entry}
                level={0}
                expandedPaths={expandedPaths}
                selectedPath={selectedFilePath}
                renamingPath={renamingPath}
                renamingValue={renamingValue}
                creatingIn={creatingIn}
                creatingType={creatingType}
                creatingValue={creatingValue}
                onToggle={handleToggle}
                onSelect={handleSelect}
                onContextMenu={handleContextMenu}
                onRenameChange={setRenamingValue}
                onRenameSubmit={handleRenameSubmit}
                onRenameCancel={handleRenameCancel}
                onCreateChange={setCreatingValue}
                onCreateSubmit={handleCreateSubmit}
                onCreateCancel={handleCreateCancel}
              />
            ))}
          </div>
        )}
      </div>

      {/* Context menu */}
      {contextMenu && (
        <FileContextMenu
          x={contextMenu.x}
          y={contextMenu.y}
          actions={getContextMenuActions(contextMenu.entry)}
          onClose={closeContextMenu}
        />
      )}

      {/* Delete confirmation */}
      {deleteConfirm && (
        <ConfirmDialog
          title="Delete"
          message={`Are you sure you want to delete "${deleteConfirm.name}"?${
            deleteConfirm.isDirectory ? " This will delete all contents." : ""
          }`}
          confirmLabel="Delete"
          danger
          onConfirm={handleDelete}
          onCancel={() => setDeleteConfirm(null)}
        />
      )}
    </div>
  );
}
