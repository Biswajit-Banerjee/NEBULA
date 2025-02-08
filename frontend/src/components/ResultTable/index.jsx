import React, { useState, useMemo } from 'react';
import { ChevronDown, ChevronRight, Settings2, CheckCircle2, XCircle } from 'lucide-react';
import CompoundTooltip from '../CompoundTooltip';
import ReactionTooltip from '../ReactionTooltip';
import ECDetails from '../ECDetails';

const ResultTable = ({ 
  results, 
  setResults, 
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
    if (selectedRows.size === results.length) {
      setSelectedRows(new Set());
    } else {
      setSelectedRows(new Set(results.map((_, index) => index)));
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
    const newResults = results.filter((_, index) => selectedRows.has(index));
    setResults(newResults);
    setSelectedRows(new Set());
  };

  const handleRemoveSelected = () => {
    const newResults = results.filter((_, index) => !selectedRows.has(index));
    setResults(newResults);
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
    <div className="absolute right-0 top-12 bg-white rounded-lg shadow-xl border border-gray-200 p-4 z-50 min-w-[200px]">
      <h3 className="font-semibold text-gray-700 mb-3">Show/Hide Columns</h3>
      <div className="space-y-2">
        {Object.entries(columnVisibility).map(([key, isVisible]) => (
          <label key={key} className="flex items-center gap-2 cursor-pointer">
            <input
              type="checkbox"
              checked={isVisible}
              onChange={() => toggleColumnVisibility(key)}
              className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
            />
            <span className="text-sm capitalize">{key}</span>
          </label>
        ))}
      </div>
    </div>
  );

  // Floating Action Menu for Selected Rows
  const SelectionActions = () => {
    if (selectedRows.size === 0) return null;

    return (
      <div className="fixed bottom-8 left-1/2 transform -translate-x-1/2 bg-white rounded-full shadow-lg border border-gray-200 px-6 py-3 flex items-center gap-4 z-50">
        <span className="text-sm font-medium text-gray-600">
          {selectedRows.size} row{selectedRows.size !== 1 ? 's' : ''} selected
        </span>
        <div className="h-4 w-px bg-gray-300"></div>
        <button
          onClick={handleKeepSelected}
          className="flex items-center gap-2 px-4 py-1.5 bg-blue-50 text-blue-600 rounded-full hover:bg-blue-100 transition-colors text-sm font-medium"
        >
          <CheckCircle2 className="w-4 h-4" />
          Keep Selected
        </button>
        <button
          onClick={handleRemoveSelected}
          className="flex items-center gap-2 px-4 py-1.5 bg-red-50 text-red-600 rounded-full hover:bg-red-100 transition-colors text-sm font-medium"
        >
          <XCircle className="w-4 h-4" />
          Remove Selected
        </button>
      </div>
    );
  };

  return (
    <div className="bg-white rounded-xl shadow-lg border border-gray-200 overflow-hidden">
      {/* Table Controls */}
      <div className="p-4 border-b border-gray-200 flex justify-between items-center bg-gray-50">
        <div className="flex items-center gap-4">
          <span className="text-sm font-medium text-gray-700">
            {selectedRows.size} selected
          </span>
          {selectedRows.size > 0 && (
            <button
              onClick={() => setSelectedRows(new Set())}
              className="text-sm text-blue-600 hover:text-blue-700"
            >
              Clear selection
            </button>
          )}
        </div>
        <div className="relative">
          <button
            onClick={() => setShowColumnManager(!showColumnManager)}
            className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
          >
            <Settings2 className="w-5 h-5 text-gray-600" />
          </button>
          {showColumnManager && <ColumnManager />}
        </div>
      </div>

      {/* Table */}
      <div className="overflow-x-auto">
        <table className="w-full">
          <thead className="bg-gray-50 border-b border-gray-200">
            <tr>
              <th className="w-8 px-4 py-3">
                <input
                  type="checkbox"
                  checked={selectedRows.size === results.length && results.length > 0}
                  onChange={toggleSelectAll}
                  className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                />
              </th>
              <th className="w-8 px-2"></th>
              {visibleColumns.map(column => (
                <th
                  key={column}
                  className="px-4 py-3 text-left text-sm font-semibold text-gray-700 capitalize"
                >
                  {column}
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-200">
            {results.map((row, index) => (
              <React.Fragment key={index}>
                <tr className={`
                  hover:bg-gray-50 transition-colors
                  ${selectedRows.has(index) ? 'bg-blue-50' : ''}
                `}>
                  <td className="w-8 px-4 py-3">
                    <input
                      type="checkbox"
                      checked={selectedRows.has(index)}
                      onChange={() => toggleRowSelection(index)}
                      className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                    />
                  </td>
                  <td className="w-8 px-2">
                    <button
                      onClick={() => toggleRowExpansion(index)}
                      className="p-1 hover:bg-gray-100 rounded transition-colors"
                    >
                      {expandedRows.has(index) ? (
                        <ChevronDown className="w-4 h-4 text-gray-500" />
                      ) : (
                        <ChevronRight className="w-4 h-4 text-gray-500" />
                      )}
                    </button>
                  </td>
                  {columnVisibility.reaction && (
                    <td className="px-4 py-3 text-sm">{row.reaction}</td>
                  )}
                  {columnVisibility.source && (
                    <td className="px-4 py-3 text-sm">{row.source}</td>
                  )}
                  {columnVisibility.coenzyme && (
                    <td className="px-4 py-3 text-sm">{row.coenzyme}</td>
                  )}
                  {columnVisibility.equation && (
                    <td className="px-4 py-3 text-sm">
                      <ReactionTooltip equation={row.equation} />
                    </td>
                  )}
                  {columnVisibility.transition && (
                    <td className="px-4 py-3 text-sm">{row.transition}</td>
                  )}
                  {columnVisibility.target && (
                    <td className="px-4 py-3 text-sm">
                      <CompoundTooltip compoundId={row.target} />
                    </td>
                  )}
                  {columnVisibility.ec && (
                    <td className="px-4 py-3 text-sm">
                      <div className="space-y-1">
                        {row.ec_list?.map((ec, i) => (
                          <ECDetails key={i} ec={ec} />
                        ))}
                      </div>
                    </td>
                  )}
                  {columnVisibility.link && (
                    <td className="px-4 py-3 text-sm">
                      <a
                        href={row.reaction_link}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-blue-600 hover:text-blue-700 transition-colors inline-flex items-center gap-1"
                      >
                        View
                        <ChevronRight className="w-4 h-4" />
                      </a>
                    </td>
                  )}
                </tr>
                {expandedRows.has(index) && (
                  <tr className="bg-gray-50">
                    <td colSpan={visibleColumns.length + 2} className="px-6 py-4">
                      <div className="text-sm space-y-2">
                        <h4 className="font-medium text-gray-700">Additional Details</h4>
                        <div className="grid grid-cols-2 gap-4">
                          <div>
                            <span className="text-gray-500">Full Equation:</span>
                            <p className="mt-1 font-mono text-xs">{row.equation}</p>
                          </div>
                          <div>
                            <span className="text-gray-500">EC Numbers:</span>
                            <div className="mt-1 space-y-1">
                              {row.ec_list?.map((ec, i) => (
                                <div key={i} className="text-xs">{ec}</div>
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

      {/* Floating Selection Actions */}
      <SelectionActions />
    </div>
  );
};

export default ResultTable;