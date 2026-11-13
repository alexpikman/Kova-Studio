import { useEffect } from 'react';
import { ArchitecturePortalView } from './components/architecture/ArchitecturePortalView';
import { TopHeader } from './components/layout/TopHeader';
import { ModelHubView } from './components/models/ModelHubView';
import { OfflineIndicator } from './components/pwa/OfflineIndicator';
import { RolesAndPipelineView } from './components/roles/RolesAndPipelineView';
import { SettingsView } from './components/settings/SettingsView';
import { WorkstationView } from './components/workstation/WorkstationView';
import { useKovaStore } from './store/useKovaStore';
import { cn } from './utils/cn';
import { getUiTokens } from './utils/uiStyle';

export default function App() {
  const {
    activeTab,
    setActiveTab,
    agentMode,
    setAgentMode,
    checkpoints,
    rollbackToCheckpoint,
    theme,
    uiStyle,
  } = useKovaStore();

  const tokens = getUiTokens(uiStyle);

  useEffect(() => {
    document.documentElement.classList.toggle('dark', theme === 'dark');
  }, [theme]);

  useEffect(() => {
    document.documentElement.setAttribute('data-ui-style', uiStyle);
  }, [uiStyle]);

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
    <div
      data-ui-style={uiStyle}
      className={cn('h-screen w-screen flex flex-col overflow-hidden', tokens.shellBg)}
    >
      <TopHeader />
      <main className="flex-1 min-h-0 flex flex-col overflow-hidden">
        {activeTab === 'workstation' && <WorkstationView />}
        {activeTab === 'models' && <ModelHubView />}
        {activeTab === 'roles' && <RolesAndPipelineView />}
        {activeTab === 'architecture' && <ArchitecturePortalView />}
        {activeTab === 'settings' && <SettingsView />}
      </main>
      <OfflineIndicator />
    </div>
  );
}
