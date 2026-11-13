import React from 'react';
import { useKovaStore } from '../../store/useKovaStore';
import { CenterAgentPane } from './CenterAgentPane';
import { LeftSidebar } from './LeftSidebar';
import { RightInspectorPane } from './RightInspectorPane';

export const WorkstationView: React.FC = () => {
  const { chatVisibility } = useKovaStore();

  return (
    <div className="flex-1 min-h-0 flex flex-col lg:flex-row overflow-hidden">
      {chatVisibility.showLeftSidebar && <LeftSidebar />}
      <CenterAgentPane />
      {chatVisibility.showRightInspector && <RightInspectorPane />}
    </div>
  );
};
