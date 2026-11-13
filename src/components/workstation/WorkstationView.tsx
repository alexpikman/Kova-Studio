import React from 'react';
import { LeftSidebar } from './LeftSidebar';
import { CenterAgentPane } from './CenterAgentPane';
import { RightInspectorPane } from './RightInspectorPane';

export const WorkstationView: React.FC = () => {
  return (
    <div className="flex-1 min-h-0 flex flex-col lg:flex-row overflow-hidden">
      <LeftSidebar />
      <CenterAgentPane />
      <RightInspectorPane />
    </div>
  );
};
