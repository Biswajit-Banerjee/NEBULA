import React, { useState, useEffect } from 'react';
import { Table2, Network, Layers } from 'lucide-react';
import ResultTable from '../ResultTable';
import NetworkViewerContainer from '../NetworkViewer';
import NetworkViewer2D from '../NetworkViewer2D';

const TabView = ({ results, setResults, selectedRows, setSelectedRows, combinedMode, network2dRef, network3dRef }) => {
  const [activeTab, setActiveTab] = useState('table');
  const [filteredResults, setFilteredResults] = useState(results);

  // This useEffect ensures filteredResults stays in sync with results
  useEffect(() => {
    setFilteredResults(results);
  }, [results]);

  // Ensure viewers recalculate layout when they become visible
  useEffect(() => {
    if (activeTab === 'network2d' || activeTab === 'network3d') {
      // Trigger global resize so each viewer's handler can update canvas/renderer sizes
      window.dispatchEvent(new Event('resize'));
    }
  }, [activeTab]);

  return (
    <div className="flex flex-col">
      {/* Tab Navigation */}
      <div className="flex border-b border-slate-200">
        <button
          onClick={() => setActiveTab('table')}
          className={`px-6 py-4 font-medium transition-colors relative ${
            activeTab === 'table'
              ? 'text-blue-600'
              : 'text-slate-600 hover:text-slate-900'
          }`}
        >
          <div className="flex items-center gap-2">
            <Table2 className="w-4 h-4" />
            <span>Tabular View</span>
          </div>
          {activeTab === 'table' && (
            <div className="absolute bottom-0 left-0 w-full h-0.5 bg-blue-600"></div>
          )}
        </button>

        <button
          onClick={() => setActiveTab('network2d')}
          className={`px-6 py-4 font-medium transition-colors relative ${
            activeTab === 'network2d'
              ? 'text-blue-600'
              : 'text-slate-600 hover:text-slate-900'
          }`}
        >
          <div className="flex items-center gap-2">
            <Layers className="w-4 h-4" />
            <span>2D Network</span>
          </div>
          {activeTab === 'network2d' && (
            <div className="absolute bottom-0 left-0 w-full h-0.5 bg-blue-600"></div>
          )}
        </button>

        <button
          onClick={() => setActiveTab('network3d')}
          className={`px-6 py-4 font-medium transition-colors relative ${
            activeTab === 'network3d'
              ? 'text-blue-600'
              : 'text-slate-600 hover:text-slate-900'
          }`}
        >
          <div className="flex items-center gap-2">
            <Network className="w-4 h-4" />
            <span>3D Network</span>
          </div>
          {activeTab === 'network3d' && (
            <div className="absolute bottom-0 left-0 w-full h-0.5 bg-blue-600"></div>
          )}
        </button>
      </div>

      {/* Tab Content */}
      <div className="tab-content">
        {/* 3D Viewer – always mounted to preserve state */}
        <div style={{ display: activeTab === 'network3d' ? 'block' : 'none' }}>
          <NetworkViewerContainer 
            ref={network3dRef}
            results={filteredResults} 
            height="600px" 
          />
        </div>

        {/* 2D Viewer – always mounted to preserve state */}
        <div style={{ display: activeTab === 'network2d' ? 'block' : 'none' }}>
          <NetworkViewer2D
            ref={network2dRef}
            results={filteredResults}
            height="600px"
          />
        </div>
        {activeTab === 'table' && (
          <ResultTable
            results={results}
            setResults={setResults}
            filteredResults={filteredResults}
            setFilteredResults={setFilteredResults}
            selectedRows={selectedRows}
            setSelectedRows={setSelectedRows}
          />
        )}
      </div>
    </div>
  );
};

export default TabView;