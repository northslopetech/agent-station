import { useEffect, useState, useCallback, useRef } from "react";
import { invoke } from "@tauri-apps/api/core";
import { open } from "@tauri-apps/plugin-dialog";
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  DragEndEvent,
} from "@dnd-kit/core";
import {
  SortableContext,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { useAppStore } from "../stores/appStore";
import type { Project, TaskProgress, ClaudeTaskProgress } from "../types";

interface SortableProjectItemProps {
  project: Project;
  isSelected: boolean;
  progress: TaskProgress | undefined;
  claudeProgress: ClaudeTaskProgress | undefined;
  isShowingTasks: boolean;
  onSelect: () => void;
  onContextMenu: (e: React.MouseEvent) => void;
  onStatusBarClick: (e: React.MouseEvent) => void;
  getProgressColor: (percentage: number) => string;
}

function SortableProjectItem({
  project,
  isSelected,
  progress,
  claudeProgress,
  isShowingTasks,
  onSelect,
  onContextMenu,
  onStatusBarClick,
  getProgressColor,
}: SortableProjectItemProps) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: project.id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
  };

  const hasClaudeTasks = claudeProgress && claudeProgress.total > 0;

  return (
    <li
      ref={setNodeRef}
      style={style}
      className={`mx-2 my-1 px-2 py-2 rounded cursor-pointer transition-colors ${
        isSelected ? "bg-zinc-700" : "hover:bg-zinc-800"
      }`}
      onClick={onSelect}
      onContextMenu={onContextMenu}
      title={project.path}
      {...attributes}
      {...listeners}
    >
      <div className="flex items-center gap-2">
        {project.hasActiveProcess && (
          <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
        )}
        <span className="text-sm truncate flex-1">{project.name}</span>
      </div>

      {/* Claude Code Task Progress - clickable to show in editor */}
      {hasClaudeTasks && (
        <div
          className={`mt-1.5 cursor-pointer rounded p-1 -mx-1 transition-colors ${
            isShowingTasks ? "bg-zinc-600" : "hover:bg-zinc-600/50"
          }`}
          onClick={onStatusBarClick}
          title="Click to view tasks"
        >
          <div className="h-1.5 bg-zinc-700 rounded-full overflow-hidden">
            <div
              className={`h-full ${getProgressColor(claudeProgress.percentage)} transition-all duration-300`}
              style={{ width: `${claudeProgress.percentage}%` }}
            />
          </div>
          <div className="text-[10px] text-zinc-500 mt-0.5 flex items-center gap-2">
            <span>{Math.round(claudeProgress.percentage)}%</span>
            <span>
              ({claudeProgress.completed}/{claudeProgress.total})
            </span>
            {claudeProgress.inProgress > 0 && (
              <span className="text-blue-400">
                {claudeProgress.inProgress} active
              </span>
            )}
          </div>
        </div>
      )}

      {/* Fallback to markdown task progress if no Claude tasks */}
      {!hasClaudeTasks && progress && progress.total > 0 && (
        <div className="mt-1.5">
          <div className="h-1.5 bg-zinc-700 rounded-full overflow-hidden">
            <div
              className={`h-full ${getProgressColor(progress.percentage)} transition-all duration-300`}
              style={{ width: `${progress.percentage}%` }}
            />
          </div>
          <div className="text-[10px] text-zinc-500 mt-0.5">
            {Math.round(progress.percentage)}% ({progress.completed}/
            {progress.total})
          </div>
        </div>
      )}
    </li>
  );
}

export function ProjectList() {
  const {
    projects,
    selectedProjectId,
    setProjects,
    addProject,
    removeProject,
    reorderProjects,
    selectProject,
    taskProgress,
    setTaskProgress,
    claudeTaskProgress,
    setClaudeTaskProgress,
    editorViewMode,
    setEditorViewMode,
  } = useAppStore();

  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: {
        distance: 8,
      },
    }),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  );

  const [contextMenu, setContextMenu] = useState<{
    x: number;
    y: number;
    projectId: string;
  } | null>(null);

  // Polling interval ref for Claude tasks
  const pollingRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // Load projects from backend on mount
  useEffect(() => {
    async function loadProjects() {
      try {
        const loadedProjects = await invoke<Project[]>("get_projects");
        setProjects(loadedProjects);
      } catch (error) {
        console.error("Failed to load projects:", error);
      }
    }
    loadProjects();
  }, [setProjects]);

  // Fetch markdown task progress for all projects
  useEffect(() => {
    async function fetchTaskProgress() {
      for (const project of projects) {
        try {
          const progress = await invoke<TaskProgress>("get_task_progress", {
            projectPath: project.path,
          });
          setTaskProgress(project.id, progress);
        } catch (error) {
          console.error(`Failed to get task progress for ${project.name}:`, error);
        }
      }
    }
    if (projects.length > 0) {
      fetchTaskProgress();
    }
  }, [projects, setTaskProgress]);

  // Poll Claude Code task progress every 3 seconds
  useEffect(() => {
    async function fetchClaudeTaskProgress() {
      for (const project of projects) {
        try {
          const progress = await invoke<ClaudeTaskProgress>("get_claude_task_progress", {
            taskListId: project.id,
          });
          setClaudeTaskProgress(project.id, progress);
        } catch (error) {
          console.error(`Failed to get Claude task progress for ${project.name}:`, error);
        }
      }
    }

    // Initial fetch
    if (projects.length > 0) {
      fetchClaudeTaskProgress();
    }

    // Set up polling
    pollingRef.current = setInterval(() => {
      if (projects.length > 0) {
        fetchClaudeTaskProgress();
      }
    }, 3000);

    return () => {
      if (pollingRef.current) {
        clearInterval(pollingRef.current);
      }
    };
  }, [projects, setClaudeTaskProgress]);

  const handleAddProject = useCallback(async () => {
    try {
      const selected = await open({
        directory: true,
        multiple: false,
        title: "Select Project Folder",
      });

      if (selected && typeof selected === "string") {
        const project = await invoke<Project>("add_project", { path: selected });
        addProject(project);
        selectProject(project.id);
      }
    } catch (error) {
      console.error("Failed to add project:", error);
    }
  }, [addProject, selectProject]);

  const handleRemoveProject = useCallback(
    async (projectId: string) => {
      try {
        await invoke("remove_project", { id: projectId });
        removeProject(projectId);
        setContextMenu(null);
      } catch (error) {
        console.error("Failed to remove project:", error);
      }
    },
    [removeProject]
  );

  const handleContextMenu = useCallback(
    (e: React.MouseEvent, projectId: string) => {
      e.preventDefault();
      setContextMenu({
        x: e.clientX,
        y: e.clientY,
        projectId,
      });
    },
    []
  );

  // Close context menu on click outside
  useEffect(() => {
    const handleClick = () => setContextMenu(null);
    document.addEventListener("click", handleClick);
    return () => document.removeEventListener("click", handleClick);
  }, []);

  const getProgressColor = (percentage: number) => {
    if (percentage < 34) return "bg-red-500";
    if (percentage < 67) return "bg-yellow-500";
    return "bg-emerald-500";
  };

  const handleStatusBarClick = (e: React.MouseEvent, projectId: string) => {
    e.stopPropagation();
    // Select the project and show tasks in the editor pane
    selectProject(projectId);
    setEditorViewMode('tasks');
  };

  const handleDragEnd = useCallback(
    (event: DragEndEvent) => {
      const { active, over } = event;

      if (over && active.id !== over.id) {
        const oldIndex = projects.findIndex((p) => p.id === active.id);
        const newIndex = projects.findIndex((p) => p.id === over.id);
        reorderProjects(oldIndex, newIndex);
      }
    },
    [projects, reorderProjects]
  );

  return (
    <div className="h-full flex flex-col bg-zinc-900 text-zinc-100">
      <div className="p-3 border-b border-zinc-700 flex items-center justify-between">
        <h2 className="text-sm font-semibold text-zinc-400 uppercase tracking-wide">
          Projects
        </h2>
        <button
          onClick={handleAddProject}
          className="w-6 h-6 flex items-center justify-center text-zinc-400 hover:text-zinc-200 hover:bg-zinc-700 rounded"
          title="Add Project"
        >
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" />
          </svg>
        </button>
      </div>

      <div className="flex-1 overflow-y-auto">
        {projects.length === 0 ? (
          <div className="text-zinc-500 text-sm p-4 text-center">
            No projects added yet
          </div>
        ) : (
          <DndContext
            sensors={sensors}
            collisionDetection={closestCenter}
            onDragEnd={handleDragEnd}
          >
            <SortableContext
              items={projects.map((p) => p.id)}
              strategy={verticalListSortingStrategy}
            >
              <ul className="py-1">
                {projects.map((project) => {
                  const progress = taskProgress[project.id];
                  const claudeProgress = claudeTaskProgress[project.id];
                  const isShowingTasks =
                    selectedProjectId === project.id && editorViewMode === "tasks";

                  return (
                    <SortableProjectItem
                      key={project.id}
                      project={project}
                      isSelected={selectedProjectId === project.id}
                      progress={progress}
                      claudeProgress={claudeProgress}
                      isShowingTasks={isShowingTasks}
                      onSelect={() => selectProject(project.id)}
                      onContextMenu={(e) => handleContextMenu(e, project.id)}
                      onStatusBarClick={(e) => handleStatusBarClick(e, project.id)}
                      getProgressColor={getProgressColor}
                    />
                  );
                })}
              </ul>
            </SortableContext>
          </DndContext>
        )}
      </div>

      {/* Context Menu */}
      {contextMenu && (
        <div
          className="fixed bg-zinc-800 border border-zinc-600 rounded shadow-lg py-1 z-50"
          style={{ top: contextMenu.y, left: contextMenu.x }}
        >
          <button
            onClick={() => handleRemoveProject(contextMenu.projectId)}
            className="w-full px-4 py-2 text-sm text-left hover:bg-zinc-700 text-zinc-200"
          >
            Remove Project
          </button>
        </div>
      )}
    </div>
  );
}
