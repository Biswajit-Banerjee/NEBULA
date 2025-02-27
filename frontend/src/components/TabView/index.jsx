import React, { useState, useEffect } from 'react';
import { Table2, Network, Layers } from 'lucide-react';
import ResultTable from '../ResultTable';
import NetworkViewer from '../NetworkViewer';
import NetworkViewer2D from '../NetworkViewer2D';

const TabView = ({ results, setResults, selectedRows, setSelectedRows }) => {
  const [activeTab, setActiveTab] = useState('table');
  const [filteredResults, setFilteredResults] = useState(results);

  // This useEffect ensures filteredResults stays in sync with results
  useEffect(() => {
    setFilteredResults(results);
  }, [results]);

  return (
    <div className="space-y-4">
      {/* Tab Navigation */}
      <div className="flex border-b border-slate-200">
        <button
          onClick={() => setActiveTab('table')}
          className={`px-4 py-2 font-medium text-sm flex items-center gap-2 ${
            activeTab === 'table'
              ? 'text-blue-600 border-b-2 border-blue-600'
              : 'text-slate-600 hover:text-slate-900 hover:bg-slate-50'
          }`}
        >
          <Table2 className="w-4 h-4" />
          Tabular View
        </button>
        {/* <button
          onClick={() => setActiveTab('network')}
          className={`px-4 py-2 font-medium text-sm flex items-center gap-2 ${
            activeTab === 'network'
              ? 'text-blue-600 border-b-2 border-blue-600'
              : 'text-slate-600 hover:text-slate-900 hover:bg-slate-50'
          }`}
        >
          <Network className="w-4 h-4" />
          3D Network
        </button> */}
        <button
          onClick={() => setActiveTab('network2d')}
          className={`px-4 py-2 font-medium text-sm flex items-center gap-2 ${
            activeTab === 'network2d'
              ? 'text-blue-600 border-b-2 border-blue-600'
              : 'text-slate-600 hover:text-slate-900 hover:bg-slate-50'
          }`}
        >
          <Layers className="w-4 h-4" />
          2D Network
        </button>
      </div>

      {/* Tab Content */}
      <div className="tab-content">
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
        {activeTab === 'network' && (
          <NetworkViewer 
            results={filteredResults} 
            height="600px" 
          />
        )}
        {activeTab === 'network2d' && (
          <NetworkViewer2D
            results={filteredResults}
            height="600px"
          />
        )}
      </div>
    </div>
  );
};

export default TabView;