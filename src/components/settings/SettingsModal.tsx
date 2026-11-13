import React from 'react';
import { ArrowUpRight, KeyRound, Keyboard, Shield, Sliders, X } from 'lucide-react';
import { useKovaStore } from '../../store/useKovaStore';
import type { GpuBackend } from '../../types/kova';

export const SettingsModal: React.FC = () => {
  const {
    settingsOpen,
    setSettingsOpen,
    setActiveTab,
    appSettings,
    updateAppSettings,
    inferenceSettings,
    updateInferenceSettings,
    sshKeys,
    activeSshKeyId,
    githubAccess,
  } = useKovaStore();

  if (!settingsOpen) return null;

  const activeSshKey = sshKeys.find((k) => k.id === activeSshKeyId) ?? sshKeys[0];

  return (
    <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="w-full max-w-2xl rounded-2xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-[#141418] shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">
        <div className="px-6 py-4 border-b border-zinc-200 dark:border-zinc-800 flex items-center justify-between">
          <div>
            <h2 className="font-display text-lg font-semibold text-zinc-900 dark:text-zinc-100">
              Настройки Kova Studio (Windows)
            </h2>
            <p className="text-xs text-zinc-500 dark:text-zinc-400 mt-0.5">
              Локальные пути, профиль GPU для калькулятора моделей и горячие клавиши. Телеметрия отключена.
            </p>
          </div>
          <button
            type="button"
            onClick={() => setSettingsOpen(false)}
            aria-label="Закрыть настройки"
            className="p-1.5 rounded-lg hover:bg-zinc-100 dark:hover:bg-zinc-800 text-zinc-500"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="p-6 overflow-y-auto space-y-6">
          {/* Paths */}
          <div className="space-y-3">
            <div className="text-xs font-semibold text-zinc-900 dark:text-zinc-100 flex items-center gap-1.5">
              <Sliders className="w-3.5 h-3.5 text-zinc-500" />
              Пути хранения и бинарники
            </div>

            <div>
              <label className="block text-xs text-zinc-600 dark:text-zinc-400 mb-1">
                Каталог загруженных GGUF-моделей
              </label>
              <div className="flex gap-2">
                <input
                  type="text"
                  value={appSettings.modelsDir}
                  onChange={(e) => updateAppSettings({ modelsDir: e.target.value })}
                  className="flex-1 h-9 px-3 rounded-lg border border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-900 font-mono text-xs text-zinc-900 dark:text-zinc-100 focus:outline-none focus:border-blue-500"
                />
                <button
                  type="button"
                  onClick={() => updateAppSettings({ modelsDir: '%APPDATA%\\KovaStudio\\models\\' })}
                  className="px-3 h-9 rounded-lg border border-zinc-200 dark:border-zinc-800 text-xs text-zinc-600 dark:text-zinc-300 hover:bg-zinc-100 dark:hover:bg-zinc-800 whitespace-nowrap"
                >
                  Сбросить
                </button>
              </div>
            </div>

            <div>
              <label className="block text-xs text-zinc-600 dark:text-zinc-400 mb-1">
                Путь к sidecar-бинарнику llama-server.exe
              </label>
              <input
                type="text"
                value={appSettings.llamaServerPath}
                onChange={(e) => updateAppSettings({ llamaServerPath: e.target.value })}
                className="w-full h-9 px-3 rounded-lg border border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-900 font-mono text-xs text-zinc-900 dark:text-zinc-100 focus:outline-none focus:border-blue-500"
              />
            </div>

            <label className="flex items-center gap-2.5 text-xs text-zinc-700 dark:text-zinc-300 cursor-pointer pt-1">
              <input
                type="checkbox"
                checked={appSettings.autoCheckSha256}
                onChange={(e) => updateAppSettings({ autoCheckSha256: e.target.checked })}
                className="accent-blue-600 rounded"
              />
              <span>Автоматически проверять SHA256 после завершения загрузки GGUF</span>
            </label>
          </div>

          {/* Hardware Profile */}
          <div className="pt-4 border-t border-zinc-200 dark:border-zinc-800 space-y-3">
            <div className="text-xs font-semibold text-zinc-900 dark:text-zinc-100">
              Аппаратный профиль (для расчёта совместимости VRAM/RAM)
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div>
                <label className="block text-xs text-zinc-500 mb-1">Бэкенд GPU</label>
                <select
                  value={inferenceSettings.gpuBackend}
                  onChange={(e) =>
                    updateInferenceSettings({ gpuBackend: e.target.value as GpuBackend })
                  }
                  className="w-full h-9 px-2.5 rounded-lg border border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-900 text-xs text-zinc-900 dark:text-zinc-100"
                >
                  <option value="auto">Авто (CUDA / Vulkan → CPU)</option>
                  <option value="cuda">NVIDIA CUDA</option>
                  <option value="vulkan">Vulkan 1.3</option>
                  <option value="cpu">CPU AVX2</option>
                </select>
              </div>
              <div>
                <label className="block text-xs text-zinc-500 mb-1">Доступно VRAM (GB)</label>
                <input
                  type="number"
                  min={2}
                  max={96}
                  step={2}
                  value={inferenceSettings.maxVramGb}
                  onChange={(e) =>
                    updateInferenceSettings({ maxVramGb: Math.max(2, Number(e.target.value) || 8) })
                  }
                  className="w-full h-9 px-3 rounded-lg border border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-900 font-mono text-xs text-zinc-900 dark:text-zinc-100 tabular-nums"
                />
              </div>
              <div>
                <label className="block text-xs text-zinc-500 mb-1">Системная RAM (GB)</label>
                <input
                  type="number"
                  min={8}
                  max={256}
                  step={4}
                  value={inferenceSettings.maxRamGb}
                  onChange={(e) =>
                    updateInferenceSettings({ maxRamGb: Math.max(8, Number(e.target.value) || 32) })
                  }
                  className="w-full h-9 px-3 rounded-lg border border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-900 font-mono text-xs text-zinc-900 dark:text-zinc-100 tabular-nums"
                />
              </div>
            </div>
          </div>

          {/* SSH & GitHub Quick Access */}
          <div className="pt-4 border-t border-zinc-200 dark:border-zinc-800 space-y-2.5">
            <div className="flex items-center justify-between gap-2">
              <div className="text-xs font-semibold text-zinc-900 dark:text-zinc-100 flex items-center gap-1.5">
                <KeyRound className="w-3.5 h-3.5 text-blue-500" />
                Доступ по SSH и GitHub
              </div>
              <button
                type="button"
                onClick={() => {
                  setSettingsOpen(false);
                  setActiveTab('ssh-github');
                }}
                className="text-xs font-medium text-blue-600 dark:text-blue-400 hover:underline inline-flex items-center gap-1"
              >
                <span>Открыть раздел SSH и GitHub</span>
                <ArrowUpRight className="w-3.5 h-3.5" />
              </button>
            </div>
            <div className="p-3 rounded-lg border border-zinc-200 dark:border-zinc-800 bg-zinc-50/70 dark:bg-zinc-900/40 text-xs flex flex-col sm:flex-row sm:items-center justify-between gap-2">
              <div className="space-y-0.5 min-w-0">
                <div className="font-mono text-zinc-800 dark:text-zinc-200 truncate">
                  Ключ: {activeSshKey?.privateKeyPath ?? 'не выбран'} ({activeSshKey?.algorithm})
                </div>
                <div className="font-mono text-[11px] text-zinc-500 dark:text-zinc-400 truncate">
                  GitHub: {githubAccess.repoOwnerSlashName} · метод {githubAccess.authMethod.toUpperCase()}
                </div>
              </div>
              <span className="font-mono text-[11px] text-emerald-600 dark:text-emerald-400 shrink-0">
                {activeSshKey?.addedToAgent ? 'ssh-agent активен' : 'ssh-agent выкл.'}
              </span>
            </div>
          </div>

          {/* Optional Cloud Fallback */}
          <div className="pt-4 border-t border-zinc-200 dark:border-zinc-800 space-y-3">
            <div className="text-xs font-semibold text-zinc-900 dark:text-zinc-100 flex items-center gap-1.5">
              <Shield className="w-3.5 h-3.5 text-zinc-500" />
              Облачный fallback (опционально)
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <select
                value={appSettings.cloudFallbackProvider}
                onChange={(e) =>
                  updateAppSettings({
                    cloudFallbackProvider: e.target.value as typeof appSettings.cloudFallbackProvider,
                  })
                }
                className="h-9 px-2.5 rounded-lg border border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-900 text-xs text-zinc-900 dark:text-zinc-100"
              >
                <option value="none">Отключён (100% локально)</option>
                <option value="openai">OpenAI Compatible</option>
                <option value="anthropic">Anthropic</option>
                <option value="gemini">Google Gemini</option>
              </select>
              <input
                type="password"
                disabled={appSettings.cloudFallbackProvider === 'none'}
                value={appSettings.cloudFallbackKey}
                onChange={(e) => updateAppSettings({ cloudFallbackKey: e.target.value })}
                placeholder="Хранится в Windows Credential Manager..."
                className="sm:col-span-2 h-9 px-3 rounded-lg border border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-900 font-mono text-xs text-zinc-900 dark:text-zinc-100 disabled:opacity-45"
              />
            </div>
          </div>

          {/* Hotkeys */}
          <div className="pt-4 border-t border-zinc-200 dark:border-zinc-800">
            <div className="text-xs font-semibold text-zinc-900 dark:text-zinc-100 flex items-center gap-1.5 mb-2.5">
              <Keyboard className="w-3.5 h-3.5 text-zinc-500" />
              Горячие клавиши Windows
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs">
              {[
                { key: 'Ctrl + Enter', desc: 'Отправить промпт агенту' },
                { key: 'Ctrl + Shift + M', desc: 'Переключить Plan / Act' },
                { key: 'Ctrl + K', desc: 'Открыть поиск моделей GGUF' },
                { key: 'Ctrl + Alt + Z', desc: 'Откат к последнему Checkpoint' },
              ].map((hk) => (
                <div
                  key={hk.key}
                  className="flex items-center justify-between px-3 py-2 rounded-lg border border-zinc-200/80 dark:border-zinc-800 bg-zinc-50/70 dark:bg-zinc-900/40"
                >
                  <span className="text-zinc-600 dark:text-zinc-300">{hk.desc}</span>
                  <kbd className="font-mono text-[11px] px-1.5 py-0.5 rounded bg-white dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 text-zinc-800 dark:text-zinc-200">
                    {hk.key}
                  </kbd>
                </div>
              ))}
            </div>
          </div>
        </div>

        <div className="px-6 py-3.5 border-t border-zinc-200 dark:border-zinc-800 bg-zinc-50/70 dark:bg-zinc-900/50 flex justify-end">
          <button
            type="button"
            onClick={() => setSettingsOpen(false)}
            className="h-9 px-4 rounded-lg bg-blue-600 hover:bg-blue-500 text-white text-xs font-medium transition-colors"
          >
            Сохранить и закрыть
          </button>
        </div>
      </div>
    </div>
  );
};
