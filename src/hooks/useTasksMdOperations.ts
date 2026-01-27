import { useCallback } from 'react';
import { invoke } from '@tauri-apps/api/core';

export function useTasksMdOperations(projectPath: string | undefined) {
  const addTask = useCallback(
    async (task: { subject: string; description?: string; column: string }) => {
      if (!projectPath) {
        throw new Error('No project path provided');
      }
      await invoke('add_task_to_tasks_md', {
        projectPath,
        subject: task.subject,
        description: task.description,
        column: task.column,
      });
    },
    [projectPath]
  );

  const updateTask = useCallback(
    async (oldSubject: string, newSubject: string, newDescription?: string) => {
      if (!projectPath) {
        throw new Error('No project path provided');
      }
      await invoke('update_task_in_tasks_md', {
        projectPath,
        oldSubject,
        newSubject,
        newDescription,
      });
    },
    [projectPath]
  );

  const deleteTask = useCallback(
    async (taskSubject: string) => {
      if (!projectPath) {
        throw new Error('No project path provided');
      }
      await invoke('delete_task_from_tasks_md', {
        projectPath,
        taskSubject,
      });
    },
    [projectPath]
  );

  return { addTask, updateTask, deleteTask };
}
