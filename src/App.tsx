import { useEffect } from 'react';
import { ArchitecturePortalView } from './components/architecture/ArchitecturePortalView';
import { InstallGuideView } from './components/install/InstallGuideView';
import { TopHeader } from './components/layout/TopHeader';
import { ModelHubView } from './components/models/ModelHubView';
import { OfflineIndicator } from './components/pwa/OfflineIndicator';
import { RolesAndPipelineView } from './components/roles/RolesAndPipelineView';
import { SettingsModal } from './components/settings/SettingsModal';
import { WorkstationView } from './components/workstation/WorkstationView';
import { useKovaStore } from './store/useKovaStore';

export default function App() {
  const {
    activeTab,
    setActiveTab,
    agentMode,
    setAgentMode,
    checkpoints,
    rollbackToCheckpoint,
    theme,
  } = useKovaStore();

  useEffect(() => {
    document.documentElement.classList.toggle('dark', theme === 'dark');
  }, [theme]);

  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        setActiveTab('models');
      } else if ((e.ctrlKey || e.metaKey) && e.shiftKey && e.key.toLowerCase() === 'm') {
        e.preventDefault();
        setAgentMode(agentMode === 'plan' ? 'act' : 'plan');
      } else if ((e.ctrlKey || e.metaKey) && e.altKey && e.key.toLowerCase() === 'z') {
        if (checkpoints.length > 0) {
          e.preventDefault();
          rollbackToCheckpoint(checkpoints[0].id);
        }
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [agentMode, checkpoints, rollbackToCheckpoint, setActiveTab, setAgentMode]);

  return (
    <div className="h-screen w-screen flex flex-col overflow-hidden bg-zinc-50 text-zinc-900 dark:bg-[#09090B] dark:text-zinc-100">
      <TopHeader />
      <main className="flex-1 min-h-0 flex flex-col overflow-hidden">
        {activeTab === 'workstation' && <WorkstationView />}
        {activeTab === 'models' && <ModelHubView />}
        {activeTab === 'roles' && <RolesAndPipelineView />}
        {activeTab === 'install' && <InstallGuideView />}
        {activeTab === 'architecture' && <ArchitecturePortalView />}
      </main>
      <SettingsModal />
      <OfflineIndicator />
    </div>
  );
}
