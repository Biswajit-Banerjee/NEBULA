import React, { useState, useMemo } from 'react';
import { ChevronDown, ChevronRight, Settings2, CheckCircle2, XCircle, Filter, LayoutGrid } from 'lucide-react';
import CompoundTooltip from '../CompoundTooltip';
import ReactionTooltip from '../ReactionTooltip';
import ECDetails from '../ECDetails';

const ResultTable = ({ 
  results, 
  setResults, 
  filteredResults, 
  setFilteredResults, 
  selectedRows: externalSelectedRows = null, 
  setSelectedRows: setExternalSelectedRows = null 
}) => {
  // Use internal state if no external state is provided
  const [internalSelectedRows, setInternalSelectedRows] = useState(new Set());
  const [expandedRows, setExpandedRows] = useState(new Set());
  const [columnVisibility, setColumnVisibility] = useState({
    reaction: true,
    source: true,
    coenzyme: true,
    equation: true,
    transition: true,
    target: true,
    ec: true,
    link: true
  });
  const [showColumnManager, setShowColumnManager] = useState(false);

  // Use either external or internal state
  const selectedRows = externalSelectedRows || internalSelectedRows;
  const setSelectedRows = setExternalSelectedRows || setInternalSelectedRows;

  const visibleColumns = useMemo(() => {
    return Object.entries(columnVisibility)
      .filter(([_, isVisible]) => isVisible)
      .map(([key]) => key);
  }, [columnVisibility]);

  const toggleSelectAll = () => {
    if (selectedRows.size === filteredResults.length) {
      setSelectedRows(new Set());
    } else {
      setSelectedRows(new Set(filteredResults.map((_, index) => index)));
    }
  };

  const toggleRowSelection = (index) => {
    const newSelected = new Set(selectedRows);
    if (newSelected.has(index)) {
      newSelected.delete(index);
    } else {
      newSelected.add(index);
    }
    setSelectedRows(newSelected);
  };

  const handleKeepSelected = () => {
    const newResults = filteredResults.filter((_, index) => selectedRows.has(index));
    setResults(newResults);
    setFilteredResults(newResults);
    setSelectedRows(new Set());
  };

  const handleRemoveSelected = () => {
    const newResults = filteredResults.filter((_, index) => !selectedRows.has(index));
    setResults(newResults);
    setFilteredResults(newResults);
    setSelectedRows(new Set());
  };

  const toggleRowExpansion = (index) => {
    const newExpanded = new Set(expandedRows);
    if (newExpanded.has(index)) {
      newExpanded.delete(index);
    } else {
      newExpanded.add(index);
    }
    setExpandedRows(newExpanded);
  };

  const toggleColumnVisibility = (columnKey) => {
    setColumnVisibility(prev => ({
      ...prev,
      [columnKey]: !prev[columnKey]
    }));
  };

  const ColumnManager = () => (
    <div className="absolute right-0 top-12 bg-white rounded-xl shadow-lg border border-emerald-100 p-4 z-50 min-w-[200px] animate-fade-in">
      <h3 className="font-semibold text-slate-700 mb-3 flex items-center gap-2 text-sm">
        <LayoutGrid className="w-4 h-4 text-emerald-600" />
        Column Visibility
      </h3>
      <div className="space-y-2">
        {Object.entries(columnVisibility).map(([key, isVisible]) => (
          <label key={key} className="flex items-center gap-2 cursor-pointer group">
            <div className="relative">
              <input
                type="checkbox"
                checked={isVisible}
                onChange={() => toggleColumnVisibility(key)}
                className="opacity-0 absolute"
              />
              <div className={`w-5 h-5 rounded-md flex items-center justify-center 
                ${isVisible ? 'bg-emerald-500 border-emerald-500' : 'bg-white border-2 border-slate-200'}`}>
                {isVisible && <CheckCircle2 className="w-3 h-3 text-white" />}
              </div>
            </div>
            <span className="text-sm text-slate-600 group-hover:text-emerald-700 transition-colors">
              {key.replace(/_/g, ' ')}
            </span>
          </label>
        ))}
      </div>
    </div>
  );

  const SelectionActions = () => {
    if (selectedRows.size === 0) return null;

    return (
      <div className="fixed bottom-8 left-1/2 transform -translate-x-1/2 bg-white rounded-xl shadow-md border border-slate-100 px-6 py-3 flex items-center gap-4 z-50 animate-slide-up">
        <span className="text-sm font-medium text-slate-600">
          {selectedRows.size} selected item{selectedRows.size !== 1 ? 's' : ''}
        </span>
        <div className="h-4 w-px bg-slate-200"></div>
        <button
          onClick={handleKeepSelected}
          className="flex items-center gap-2 px-4 py-2 bg-emerald-50 text-emerald-700 rounded-lg hover:bg-emerald-100 transition-all text-sm font-medium border border-emerald-100"
        >
          <CheckCircle2 className="w-4 h-4" />
          Keep Selection
        </button>
        <button
          onClick={handleRemoveSelected}
          className="flex items-center gap-2 px-4 py-2 bg-blue-50 text-blue-700 rounded-lg hover:bg-blue-100 transition-all text-sm font-medium border border-blue-100"
        >
          <XCircle className="w-4 h-4" />
          Remove
        </button>
      </div>
    );
  };

  return (
    <div className="bg-white rounded-xl shadow-sm border border-slate-100 overflow-hidden">
      <div className="p-4 border-b border-slate-100 flex justify-between items-center bg-slate-50">
        <div className="flex items-center gap-4">
          {selectedRows.size > 0 ? (
            <div className="flex items-center gap-3">
              <span className="text-sm font-medium text-emerald-700 bg-emerald-50 px-3 py-1 rounded-md border border-emerald-100">
                {selectedRows.size} selected
              </span>
              <button
                onClick={() => setSelectedRows(new Set())}
                className="text-sm text-slate-500 hover:text-slate-700 transition-colors flex items-center gap-1"
              >
                Clear
                <XCircle className="w-4 h-4" />
              </button>
            </div>
          ) : (
            <div className="flex items-center gap-2 text-slate-500">
              <Filter className="w-4 h-4" />
              <span className="text-sm font-medium">Ready to analyze</span>
            </div>
          )}
        </div>
        <div className="relative">
          <button
            onClick={() => setShowColumnManager(!showColumnManager)}
            className="p-2 hover:bg-slate-100 rounded-lg transition-all text-slate-600 hover:text-emerald-700"
          >
            <Settings2 className="w-5 h-5" />
          </button>
          {showColumnManager && <ColumnManager />}
        </div>
      </div>

      {/* Table */}
      <div className="overflow-x-auto">
        <table className="w-full">
          <thead className="bg-slate-50 border-b border-slate-100">
            <tr>
              <th className="w-8 px-4 py-3">
                <div className="flex items-center justify-center">
                  <input
                    type="checkbox"
                    checked={selectedRows.size === results.length && results.length > 0}
                    onChange={toggleSelectAll}
                    className="opacity-0 absolute"
                  />
                  <div className={`w-5 h-5 rounded-md flex items-center justify-center 
                    ${selectedRows.size === results.length ? 'bg-emerald-500' : 'bg-white border-2 border-slate-200'}`}>
                    {selectedRows.size === results.length && <CheckCircle2 className="w-3 h-3 text-white" />}
                  </div>
                </div>
              </th>
              <th className="w-8 px-2"></th>
              {visibleColumns.map(column => (
                <th
                  key={column}
                  className="px-4 py-3 text-left text-sm font-semibold text-slate-700 capitalize"
                >
                  {column.replace(/_/g, ' ')}
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {results.map((row, index) => (
              <React.Fragment key={index}>
                <tr className={`
                  hover:bg-slate-50 transition-all
                  ${selectedRows.has(index) ? 'bg-blue-50' : ''}
                  ${expandedRows.has(index) ? '!bg-indigo-50' : ''}
                `}>
                  <td className="w-8 px-4 py-3">
                    <div className="flex items-center justify-center">
                      <input
                        type="checkbox"
                        checked={selectedRows.has(index)}
                        onChange={() => toggleRowSelection(index)}
                        className="opacity-0 absolute"
                      />
                      <div className={`w-5 h-5 rounded-md flex items-center justify-center 
                        ${selectedRows.has(index) ? 'bg-emerald-500' : 'bg-white border-2 border-slate-200'}`}>
                        {selectedRows.has(index) && <CheckCircle2 className="w-3 h-3 text-white" />}
                      </div>
                    </div>
                  </td>
                  <td className="w-8 px-2">
                    <button
                      onClick={() => toggleRowExpansion(index)}
                      className="p-1 hover:bg-slate-100 rounded-md transition-all text-slate-500 hover:text-emerald-700"
                    >
                      {expandedRows.has(index) ? (
                        <ChevronDown className="w-4 h-4" />
                      ) : (
                        <ChevronRight className="w-4 h-4" />
                      )}
                    </button>
                  </td>
                  {visibleColumns.map(col => (
                    <TableCell key={col} column={col} row={row} />
                  ))}
                </tr>
                {expandedRows.has(index) && (
                  <tr className="bg-indigo-50">
                    <td colSpan={visibleColumns.length + 2} className="px-6 py-4">
                      <div className="text-sm space-y-2">
                        <div className="flex items-center gap-2 text-slate-700 mb-2">
                          <span className="font-medium">Detailed View</span>
                          <div className="flex-1 h-px bg-slate-200"></div>
                        </div>
                        <div className="grid grid-cols-2 gap-4">
                          <div className="bg-white p-3 rounded-lg border border-slate-100">
                            <span className="text-slate-600 text-xs font-medium">Full Equation</span>
                            <p className="mt-1 font-mono text-xs text-slate-500">
                              {row.equation}
                            </p>
                          </div>
                          <div className="bg-white p-3 rounded-lg border border-slate-100">
                            <span className="text-slate-600 text-xs font-medium">EC Numbers</span>
                            <div className="mt-1 space-y-1">
                              {row.ec_list?.map((ec, i) => (
                                <div key={i} className="text-xs text-slate-600 bg-slate-50 px-2 py-1 rounded-md">
                                  {ec}
                                </div>
                              ))}
                            </div>
                          </div>
                        </div>
                      </div>
                    </td>
                  </tr>
                )}
              </React.Fragment>
            ))}
          </tbody>
        </table>
      </div>

      <SelectionActions />
    </div>
  );
};

const TableCell = ({ column, row }) => {
  const content = {
    reaction: row.reaction,
    source: row.source,
    coenzyme: row.coenzyme,
    equation: <ReactionTooltip equation={row.equation} />,
    transition: row.transition,
    target: <CompoundTooltip compoundId={row.target} />,
    ec: row.ec_list?.map((ec, i) => <ECDetails key={i} ec={ec} />),
    link: (
      <a
        href={row.reaction_link}
        target="_blank"
        rel="noopener noreferrer"
        className="text-emerald-700 hover:text-emerald-900 transition-colors inline-flex items-center gap-1"
      >
        View Details
        <ChevronRight className="w-4 h-4" />
      </a>
    )
  };

  return (
    <td className="px-4 py-3 text-sm text-slate-600">
      <div className="max-w-[200px] truncate hover:text-clip transition-all">
        {content[column] || '-'}
      </div>
    </td>
  );
};

export default ResultTable;