import React, { useState, useMemo, useEffect } from 'react';
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
    ec: true
  });
  const [showColumnManager, setShowColumnManager] = useState(false);
  const [reactionDetails, setReactionDetails] = useState({});
  const [reactionImages, setReactionImages] = useState({});
  const [loadingDetails, setLoadingDetails] = useState({});

  // Use either external or internal state
  const selectedRows = externalSelectedRows || internalSelectedRows;
  const setSelectedRows = setExternalSelectedRows || setInternalSelectedRows;

  const visibleColumns = useMemo(() => {
    return Object.entries(columnVisibility)
      .filter(([_, isVisible]) => isVisible)
      .map(([key]) => key);
  }, [columnVisibility]);

  // Helper function to extract KEGG reaction ID (R#####)
  const extractReactionId = (reaction) => {
    const match = reaction.match(/R\d{5}/);
    return match ? match[0] : null;
  };

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

  const toggleRowExpansion = (index, row) => {
    const newExpanded = new Set(expandedRows);
    
    if (newExpanded.has(index)) {
      newExpanded.delete(index);
    } else {
      newExpanded.add(index);
      
      // Get the reaction ID
      const reaction = row.reaction;
      const reactionId = extractReactionId(reaction);
      
      // Check if we already have details for this reaction
      if (!reactionDetails[reaction] && reactionId) {
        setLoadingDetails(prev => ({ ...prev, [reaction]: true }));
        
        // Fetch reaction details from local API
        fetch(`http://127.0.0.1:8000/api/reaction/${reaction}`)
          .then(response => response.json())
          .then(data => {
            setReactionDetails(prev => ({
              ...prev,
              [reaction]: data.data?.definition || "No definition available"
            }));
          })
          .catch(error => {
            console.error("Error fetching reaction details:", error);
            setReactionDetails(prev => ({
              ...prev,
              [reaction]: "Failed to load definition"
            }));
          })
          .finally(() => {
            setLoadingDetails(prev => ({ ...prev, [reaction]: false }));
          });
        
        // Set image URL if we have a valid reaction ID
        if (reactionId) {
          setReactionImages(prev => ({
            ...prev,
            [reaction]: `https://www.genome.jp/Fig/reaction/${reactionId}.gif`
          }));
        }
      }
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
    <div className="absolute right-0 top-12 bg-white rounded-xl shadow-lg border border-gray-200 p-4 z-50 min-w-[200px] animate-fade-in">
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
            <span className="text-sm text-slate-600 group-hover:text-emerald-700 transition-colors capitalize">
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
                      onClick={() => toggleRowExpansion(index, row)}
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
                      {loadingDetails[row.reaction] ? (
                        <div className="flex justify-center py-8">
                          <div className="animate-spin rounded-full h-8 w-8 border-2 border-emerald-500 border-t-transparent"></div>
                        </div>
                      ) : (
                        <div className="space-y-6">
                          <div className="flex items-center gap-2 text-slate-700">
                            <span className="font-medium">Reaction Details</span>
                            <div className="flex-1 h-px bg-indigo-200"></div>
                          </div>
                          
                          {/* Definition */}
                          <div className="bg-white p-5 rounded-lg border border-indigo-100 shadow-sm">
                            <span className="text-slate-600 text-sm font-medium">KEGG Definition</span>
                            <p className="mt-2 text-slate-700 font-medium">
                              {reactionDetails[row.reaction] || "No definition available"}
                            </p>
                          </div>
                          
                          {/* Reaction Image */}
                          {reactionImages[row.reaction] && (
                            <div className="bg-white p-5 rounded-lg border border-indigo-100 shadow-sm">
                              <span className="text-slate-600 text-sm font-medium">KEGG Reaction Diagram</span>
                              <div className="mt-3 flex justify-center bg-gray-50 p-4 rounded-lg">
                                <img 
                                  src={reactionImages[row.reaction]} 
                                  alt={`Reaction diagram for ${row.reaction}`}
                                  className="max-w-full"
                                  onError={(e) => {
                                    e.target.onerror = null;
                                    e.target.src = 'data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iNDAwIiBoZWlnaHQ9IjEwMCIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj48cmVjdCB4PSIwIiB5PSIwIiB3aWR0aD0iNDAwIiBoZWlnaHQ9IjEwMCIgZmlsbD0iI2YxZjVmOSIvPjx0ZXh0IHg9IjIwMCIgeT0iNTAiIGZvbnQtZmFtaWx5PSJBcmlhbCIgZm9udC1zaXplPSIxNiIgdGV4dC1hbmNob3I9Im1pZGRsZSIgYWxpZ25tZW50LWJhc2VsaW5lPSJtaWRkbGUiIGZpbGw9IiM2NDc0OGIiPkltYWdlIG5vdCBhdmFpbGFibGU8L3RleHQ+PC9zdmc+';
                                    console.log(`Failed to load image for ${row.reaction}`);
                                  }}
                                />
                              </div>
                            </div>
                          )}
                          
                          {/* EC Numbers */}
                          {/* {row.ec_list && row.ec_list.length > 0 && (
                            <div className="bg-white p-5 rounded-lg border border-indigo-100 shadow-sm">
                              <span className="text-slate-600 text-sm font-medium">EC Numbers</span>
                              <div className="mt-2 flex flex-wrap gap-2">
                                {row.ec_list.map((ec, i) => (
                                  <div key={i} className="inline-flex px-3 py-1.5 rounded-md text-blue-700 bg-blue-50 border border-blue-100 text-sm">
                                    {ec}
                                  </div>
                                ))}
                              </div>
                            </div>
                          )} */}
                        </div>
                      )}
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
    equation: row.equation,//<ReactionTooltip equation={row.equation} />,
    transition: row.transition,
    target: row.target,//<CompoundTooltip compoundId={row.target} />,
    ec: row.ec_list?.map((ec, i) => (
      <ECDetails key={i} ec={ec} />
    ))
  };

  return (
    <td className="px-4 py-3 text-sm text-slate-600">
      <div className="max-w-full">
        {content[column] || '-'}
      </div>
    </td>
  );
};

export default ResultTable;