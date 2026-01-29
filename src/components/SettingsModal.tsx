import { useState, useEffect } from 'react';
import { invoke } from '@tauri-apps/api/core';
import { useAppStore } from '../stores/appStore';
import type { Settings } from '../types';

interface SettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export function SettingsModal({ isOpen, onClose }: SettingsModalProps) {
  const { settings, setSettings, updateSettings, zoomLevel, incrementZoom, decrementZoom, resetZoom } = useAppStore();
  const [localSettings, setLocalSettings] = useState<Settings>(settings);
  const [saving, setSaving] = useState(false);

  // Sync local state when settings change
  useEffect(() => {
    setLocalSettings(settings);
  }, [settings]);

  // Load settings from backend on mount (but preserve current zoomLevel)
  useEffect(() => {
    if (isOpen) {
      const currentZoom = useAppStore.getState().zoomLevel;
      invoke<Settings>('get_settings')
        .then((loadedSettings) => {
          // Preserve the current zoom level - it's managed by the status bar, not settings
          const settingsWithCurrentZoom = { ...loadedSettings, zoomLevel: currentZoom };
          setSettings(settingsWithCurrentZoom);
          setLocalSettings(settingsWithCurrentZoom);
        })
        .catch((err) => {
          console.error('Failed to load settings:', err);
        });
    }
  }, [isOpen, setSettings]);

  const handleSave = async () => {
    setSaving(true);
    try {
      // Preserve current zoom level when saving
      const currentZoom = useAppStore.getState().zoomLevel;
      const settingsToSave = { ...localSettings, zoomLevel: currentZoom };
      await invoke('save_settings', { settings: settingsToSave });
      updateSettings({
        autoStartClaude: localSettings.autoStartClaude,
        autoStartCommand: localSettings.autoStartCommand,
        enableNotifications: localSettings.enableNotifications,
        enableSound: localSettings.enableSound,
        notificationSound: localSettings.notificationSound,
        notifyOnlyWhenUnfocused: localSettings.notifyOnlyWhenUnfocused,
      });
      onClose();
    } catch (err) {
      console.error('Failed to save settings:', err);
    } finally {
      setSaving(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
      <div className="bg-zinc-800 rounded-lg shadow-xl w-[480px] max-w-[90vw]">
        {/* Header */}
        <div className="px-4 py-3 border-b border-zinc-700 flex items-center justify-between">
          <h2 className="text-lg font-semibold text-zinc-100">Settings</h2>
          <button
            onClick={onClose}
            className="text-zinc-400 hover:text-zinc-200 p-1"
          >
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Content */}
        <div className="p-4 space-y-6">
          {/* Auto-start Claude section */}
          <div>
            <h3 className="text-sm font-medium text-zinc-300 mb-3">Terminal</h3>
            <div className="space-y-4">
              {/* Toggle */}
              <label className="flex items-center gap-3 cursor-pointer">
                <input
                  type="checkbox"
                  checked={localSettings.autoStartClaude}
                  onChange={(e) =>
                    setLocalSettings({ ...localSettings, autoStartClaude: e.target.checked })
                  }
                  className="w-4 h-4 rounded border-zinc-600 bg-zinc-700 text-blue-500 focus:ring-blue-500 focus:ring-offset-zinc-800"
                />
                <span className="text-sm text-zinc-200">
                  Auto-start Claude when opening a new terminal
                </span>
              </label>

              {/* Command input */}
              {localSettings.autoStartClaude && (
                <div className="ml-7">
                  <label className="block text-xs text-zinc-400 mb-1">
                    Command to run:
                  </label>
                  <input
                    type="text"
                    value={localSettings.autoStartCommand}
                    onChange={(e) =>
                      setLocalSettings({ ...localSettings, autoStartCommand: e.target.value })
                    }
                    className="w-full px-3 py-2 bg-zinc-700 border border-zinc-600 rounded text-sm text-zinc-200 focus:outline-none focus:border-blue-500"
                    placeholder="claude --dangerously-skip-permissions"
                  />
                </div>
              )}
            </div>
          </div>

          {/* Notifications section */}
          <div>
            <h3 className="text-sm font-medium text-zinc-300 mb-3">Notifications</h3>
            <div className="space-y-4">
              <label className="flex items-center gap-3 cursor-pointer">
                <input
                  type="checkbox"
                  checked={localSettings.enableNotifications}
                  onChange={(e) =>
                    setLocalSettings({ ...localSettings, enableNotifications: e.target.checked })
                  }
                  className="w-4 h-4 rounded border-zinc-600 bg-zinc-700 text-blue-500 focus:ring-blue-500 focus:ring-offset-zinc-800"
                />
                <span className="text-sm text-zinc-200">
                  Show notification when Claude stops
                </span>
              </label>

              <label className="flex items-center gap-3 cursor-pointer">
                <input
                  type="checkbox"
                  checked={localSettings.enableSound}
                  onChange={(e) =>
                    setLocalSettings({ ...localSettings, enableSound: e.target.checked })
                  }
                  className="w-4 h-4 rounded border-zinc-600 bg-zinc-700 text-blue-500 focus:ring-blue-500 focus:ring-offset-zinc-800"
                />
                <span className="text-sm text-zinc-200">Play sound with notification</span>
              </label>

              {localSettings.enableSound && (
                <div className="ml-7">
                  <label className="block text-xs text-zinc-400 mb-1">Sound:</label>
                  <select
                    value={localSettings.notificationSound}
                    onChange={(e) =>
                      setLocalSettings({ ...localSettings, notificationSound: e.target.value })
                    }
                    className="w-full px-3 py-2 bg-zinc-700 border border-zinc-600 rounded text-sm text-zinc-200 focus:outline-none focus:border-blue-500"
                  >
                    <option value="default">Default</option>
                    <option value="Ping">Ping</option>
                    <option value="Glass">Glass</option>
                    <option value="Pop">Pop</option>
                    <option value="Tink">Tink</option>
                  </select>
                </div>
              )}

              <label className="flex items-center gap-3 cursor-pointer">
                <input
                  type="checkbox"
                  checked={localSettings.notifyOnlyWhenUnfocused}
                  onChange={(e) =>
                    setLocalSettings({ ...localSettings, notifyOnlyWhenUnfocused: e.target.checked })
                  }
                  className="w-4 h-4 rounded border-zinc-600 bg-zinc-700 text-blue-500 focus:ring-blue-500 focus:ring-offset-zinc-800"
                />
                <span className="text-sm text-zinc-200">Only notify when window is not focused</span>
              </label>
            </div>
          </div>

          {/* Zoom section */}
          <div>
            <h3 className="text-sm font-medium text-zinc-300 mb-3">Display</h3>
            <div className="flex items-center gap-4">
              <span className="text-sm text-zinc-200">Zoom Level</span>
              <div className="flex items-center gap-2 bg-zinc-700 rounded px-2 py-1">
                <button
                  onClick={decrementZoom}
                  className="w-6 h-6 flex items-center justify-center text-zinc-400 hover:text-zinc-200 hover:bg-zinc-600 rounded transition-colors"
                  title="Zoom out (Cmd+-)"
                >
                  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M20 12H4" />
                  </svg>
                </button>
                <button
                  onClick={resetZoom}
                  className="px-2 text-zinc-200 hover:text-zinc-100 hover:bg-zinc-600 rounded transition-colors min-w-[48px] text-sm"
                  title="Reset zoom (Cmd+0)"
                >
                  {Math.round(zoomLevel * 100)}%
                </button>
                <button
                  onClick={incrementZoom}
                  className="w-6 h-6 flex items-center justify-center text-zinc-400 hover:text-zinc-200 hover:bg-zinc-600 rounded transition-colors"
                  title="Zoom in (Cmd++)"
                >
                  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" />
                  </svg>
                </button>
              </div>
              <span className="text-xs text-zinc-500">Cmd +/-/0</span>
            </div>
          </div>

        </div>

        {/* Footer */}
        <div className="px-4 py-3 border-t border-zinc-700 flex justify-end gap-2">
          <button
            onClick={onClose}
            className="px-4 py-2 text-sm text-zinc-300 hover:text-zinc-100 hover:bg-zinc-700 rounded transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={handleSave}
            disabled={saving}
            className="px-4 py-2 text-sm bg-blue-600 hover:bg-blue-500 text-white rounded transition-colors disabled:opacity-50"
          >
            {saving ? 'Saving...' : 'Save'}
          </button>
        </div>
      </div>
    </div>
  );
}
