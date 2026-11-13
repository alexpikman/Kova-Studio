import React, { useRef, useEffect } from 'react';
import { AnimatePresence, motion } from 'motion/react';
import { Bell, CheckCheck, Monitor, MonitorDown, Moon, Pause, Power, Settings, Sun } from 'lucide-react';
import { usePWAInstall } from '../../hooks/usePWAInstall';
import { useKovaStore } from '../../store/useKovaStore';
import type { AppTab } from '../../types/kova';
import { cn } from '../../utils/cn';

const NAV_ITEMS: { id: AppTab; label: string }[] = [
  { id: 'workstation', label: 'Рабочая станция' },
  { id: 'models', label: 'Модели GGUF' },
  { id: 'roles', label: 'Роли и пайплайн' },
  { id: 'install', label: 'Установка на ПК' },
  { id: 'architecture', label: 'Архитектура' },
];

export const TopHeader: React.FC = () => {
  const {
    activeTab,
    setActiveTab,
    theme,
    toggleTheme,
    setSettingsOpen,
    trayOpen,
    setTrayOpen,
    serverStatus,
    toggleServerPower,
    localModels,
    activeModelId,
    inferenceSettings,
    notifications,
    markAllNotificationsRead,
    togglePauseDownload,
  } = useKovaStore();

  const { isInstallable, isInstalled, install } = usePWAInstall();
  const trayRef = useRef<HTMLDivElement>(null);
  const activeModel = localModels.find((m) => m.id === activeModelId);
  const unreadCount = notifications.filter((n) => !n.read).length;
  const activeDownloads = localModels.filter((m) => m.status === 'downloading');

  useEffect(() => {
    const onOutsideClick = (e: MouseEvent) => {
      if (trayOpen && trayRef.current && !trayRef.current.contains(e.target as Node)) {
        setTrayOpen(false);
      }
    };
    document.addEventListener('mousedown', onOutsideClick);
    return () => document.removeEventListener('mousedown', onOutsideClick);
  }, [trayOpen, setTrayOpen]);

  return (
    <header className="h-14 shrink-0 border-b border-zinc-200 dark:border-zinc-800/90 bg-white/85 dark:bg-[#111114]/85 mica-panel px-5 flex items-center justify-between gap-8 relative z-30">
      {/* Zone 1: Single-element brand wordmark */}
      <button
        type="button"
        onClick={() => setActiveTab('workstation')}
        className="font-display text-base font-bold tracking-tight text-zinc-900 dark:text-zinc-100 whitespace-nowrap shrink-0 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 rounded"
      >
        Kova Studio
      </button>

      {/* Zone 2: Clean single-line navigation links */}
      <nav aria-label="Основные разделы" className="flex items-center gap-6 overflow-x-auto">
        {NAV_ITEMS.map((item) => {
          const isActive = activeTab === item.id;
          return (
            <button
              key={item.id}
              type="button"
              onClick={() => setActiveTab(item.id)}
              className={cn(
                'relative py-4 text-sm font-medium transition-colors whitespace-nowrap shrink-0 focus-visible:outline-none focus-visible:text-blue-500',
                isActive
                  ? 'text-zinc-950 dark:text-zinc-50'
                  : 'text-zinc-500 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-zinc-200',
              )}
            >
              {item.label}
              {isActive && (
                <motion.span
                  layoutId="header-active-underline"
                  transition={{ duration: 0.16, ease: [0.16, 1, 0.3, 1] }}
                  className="absolute inset-x-0 bottom-0 h-0.5 bg-blue-600 dark:bg-blue-500"
                />
              )}
            </button>
          );
        })}
      </nav>

      {/* Zone 3: Install, Theme, Windows Tray & Primary Action */}
      <div className="flex items-center gap-2 shrink-0">
        {isInstallable && !isInstalled && (
          <button
            type="button"
            onClick={install}
            className="h-9 px-3 inline-flex items-center gap-1.5 rounded-lg bg-blue-600 hover:bg-blue-500 text-white text-xs font-medium transition-colors whitespace-nowrap shrink-0"
          >
            <MonitorDown className="w-3.5 h-3.5" />
            <span>Установить</span>
          </button>
        )}

        <button
          type="button"
          onClick={toggleTheme}
          title={theme === 'dark' ? 'Включить светлую тему' : 'Включить тёмную тему'}
          aria-label="Переключить тему"
          className="h-9 w-9 inline-flex items-center justify-center rounded-lg border border-zinc-200 dark:border-zinc-800 text-zinc-600 dark:text-zinc-300 hover:bg-zinc-100 dark:hover:bg-zinc-800/70 transition-colors"
        >
          {theme === 'dark' ? <Sun className="w-4 h-4" /> : <Moon className="w-4 h-4" />}
        </button>

        <div className="relative" ref={trayRef}>
          <button
            type="button"
            onClick={() => setTrayOpen(!trayOpen)}
            title="Системный трей Windows"
            aria-label="Открыть системный трей"
            className={cn(
              'h-9 px-3 inline-flex items-center gap-2 rounded-lg border text-xs font-medium transition-colors whitespace-nowrap shrink-0',
              trayOpen
                ? 'border-blue-500/60 bg-blue-500/10 text-blue-600 dark:text-blue-400'
                : 'border-zinc-200 dark:border-zinc-800 text-zinc-700 dark:text-zinc-300 hover:bg-zinc-100 dark:hover:bg-zinc-800/70',
            )}
          >
            <Monitor className="w-3.5 h-3.5" />
            <span>Трей</span>
            {unreadCount > 0 && (
              <span className="font-mono tabular-nums text-[11px] text-blue-600 dark:text-blue-400">
                ({unreadCount})
              </span>
            )}
          </button>

          <AnimatePresence>
            {trayOpen && (
              <motion.div
                initial={{ opacity: 0, y: 6, scale: 0.98 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                exit={{ opacity: 0, y: 4, scale: 0.98 }}
                transition={{ duration: 0.15, ease: [0.16, 1, 0.3, 1] }}
                className="absolute right-0 mt-2 w-80 rounded-xl border border-zinc-200 dark:border-zinc-800 bg-white/95 dark:bg-[#141418]/95 mica-panel shadow-2xl p-4 z-50"
              >
                <div className="flex items-center justify-between pb-3 border-b border-zinc-200 dark:border-zinc-800">
                  <div>
                    <div className="text-xs font-semibold text-zinc-900 dark:text-zinc-100">
                      Системный трей Windows
                    </div>
                    <div className="text-[11px] text-zinc-500 dark:text-zinc-400 mt-0.5">
                      {serverStatus === 'stopped'
                        ? 'llama-server.exe остановлен'
                        : `${inferenceSettings.detectedBackend} · ${activeModel?.name ?? 'Без модели'}`}
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={toggleServerPower}
                    className={cn(
                      'px-2.5 py-1.5 rounded-md text-xs font-medium inline-flex items-center gap-1.5 transition-colors whitespace-nowrap shrink-0',
                      serverStatus === 'stopped'
                        ? 'bg-emerald-600 text-white hover:bg-emerald-500'
                        : 'bg-zinc-100 dark:bg-zinc-800 text-zinc-700 dark:text-zinc-200 hover:bg-rose-500/15 hover:text-rose-500',
                    )}
                  >
                    <Power className="w-3.5 h-3.5" />
                    {serverStatus === 'stopped' ? 'Запустить' : 'Стоп'}
                  </button>
                </div>

                {activeDownloads.length > 0 && (
                  <div className="py-2.5 border-b border-zinc-200 dark:border-zinc-800 space-y-2">
                    <div className="text-[11px] font-medium text-zinc-500 dark:text-zinc-400">
                      Активные загрузки GGUF
                    </div>
                    {activeDownloads.map((dl) => (
                      <div key={dl.id} className="flex items-center justify-between gap-2 text-xs">
                        <span className="truncate text-zinc-800 dark:text-zinc-200">{dl.name}</span>
                        <div className="flex items-center gap-2 shrink-0">
                          <span className="font-mono tabular-nums text-zinc-500">{dl.progressPct}%</span>
                          <button
                            type="button"
                            onClick={() => togglePauseDownload(dl.id)}
                            className="p-1 rounded hover:bg-zinc-200 dark:hover:bg-zinc-800 text-zinc-500"
                            title="Пауза"
                          >
                            <Pause className="w-3 h-3" />
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}

                <div className="pt-3">
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-[11px] font-medium text-zinc-500 dark:text-zinc-400 inline-flex items-center gap-1.5">
                      <Bell className="w-3 h-3" />
                      Уведомления агента
                    </span>
                    {unreadCount > 0 && (
                      <button
                        type="button"
                        onClick={markAllNotificationsRead}
                        className="text-[11px] text-blue-600 dark:text-blue-400 hover:underline inline-flex items-center gap-1"
                      >
                        <CheckCheck className="w-3 h-3" />
                        Прочитано
                      </button>
                    )}
                  </div>
                  <div className="space-y-2 max-h-48 overflow-y-auto">
                    {notifications.slice(0, 4).map((n) => (
                      <div
                        key={n.id}
                        className={cn(
                          'p-2 rounded-lg border text-xs',
                          n.read
                            ? 'border-zinc-200/70 dark:border-zinc-800/60 bg-zinc-50/50 dark:bg-zinc-900/40'
                            : 'border-blue-500/30 bg-blue-500/5',
                        )}
                      >
                        <div className="flex items-center justify-between gap-2">
                          <span className="font-medium text-zinc-900 dark:text-zinc-100 truncate">
                            {n.title}
                          </span>
                          <span className="font-mono text-[10px] text-zinc-400 tabular-nums shrink-0">
                            {n.timestamp}
                          </span>
                        </div>
                        <p className="text-[11px] text-zinc-500 dark:text-zinc-400 mt-0.5 leading-relaxed">
                          {n.detail}
                        </p>
                      </div>
                    ))}
                  </div>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        <button
          type="button"
          onClick={() => setSettingsOpen(true)}
          className="h-9 px-3.5 inline-flex items-center gap-2 rounded-lg bg-zinc-900 dark:bg-zinc-100 text-white dark:text-zinc-900 hover:bg-zinc-800 dark:hover:bg-zinc-200 text-xs font-medium transition-colors whitespace-nowrap shrink-0"
        >
          <Settings className="w-3.5 h-3.5" />
          <span>Настройки</span>
        </button>
      </div>
    </header>
  );
};
