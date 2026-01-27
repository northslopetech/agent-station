import { useEffect, useCallback } from 'react';
import { invoke } from '@tauri-apps/api/core';
import { listen } from '@tauri-apps/api/event';
import { useAppStore } from '../stores/appStore';
import type { TasksMdTask } from '../types';

interface TasksMdChangedPayload {
  projectId: string;
  projectPath: string;
}

export function useTasksMdWatcher() {
  const selectedProjectId = useAppStore((s) => s.selectedProjectId);
  const projects = useAppStore((s) => s.projects);
  const setTasksMdTasks = useAppStore((s) => s.setTasksMdTasks);

  const loadTasksMd = useCallback(async (projectId: string, projectPath: string) => {
    try {
      const tasks = await invoke<TasksMdTask[]>('read_tasks_md', {
        projectPath,
      });
      setTasksMdTasks(projectId, tasks);
    } catch (error) {
      console.error('Failed to load TASKS.md:', error);
      setTasksMdTasks(projectId, []);
    }
  }, [setTasksMdTasks]);

  // Load TASKS.md when project changes
  useEffect(() => {
    if (!selectedProjectId) return;

    const project = projects.find((p) => p.id === selectedProjectId);
    if (!project) return;

    // Load tasks
    loadTasksMd(selectedProjectId, project.path);

    // Start watching
    invoke('watch_tasks_md', {
      projectId: selectedProjectId,
      projectPath: project.path,
    }).catch((err) => {
      console.error('Failed to start TASKS.md watcher:', err);
    });

    // Cleanup: stop watching when project changes
    return () => {
      invoke('unwatch_tasks_md', {
        projectId: selectedProjectId,
      }).catch((err) => {
        console.error('Failed to stop TASKS.md watcher:', err);
      });
    };
  }, [selectedProjectId, projects, loadTasksMd]);

  // Listen for file change events
  useEffect(() => {
    const unlisten = listen<TasksMdChangedPayload>('tasks-md-changed', (event) => {
      const { projectId, projectPath } = event.payload;
      // Debounce by checking if this is the currently selected project
      if (projectId === selectedProjectId) {
        loadTasksMd(projectId, projectPath);
      }
    });

    return () => {
      unlisten.then((fn) => fn());
    };
  }, [selectedProjectId, loadTasksMd]);
}
