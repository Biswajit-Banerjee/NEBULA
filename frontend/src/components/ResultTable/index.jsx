import React, { useState, useMemo, useEffect } from "react";
import {
  ChevronDown,
  ChevronRight,
  Settings2,
  CheckCircle2,
  XCircle,
  CircleDashed,
  Filter,
  LayoutGrid,
} from "lucide-react";
import CompoundTooltip from "../CompoundTooltip";
import ReactionTooltip from "../ReactionTooltip";
import ECDetails from "../ECDetails";
import FilterMenu from "../FilterMenu";

const ResultTable = ({
  results,
  setResults,
  filteredResults,
  setFilteredResults,
  selectedRows: externalSelectedRows = null,
  setSelectedRows: setExternalSelectedRows = null,
  combinedMode = false,
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
  });
  const [showColumnManager, setShowColumnManager] = useState(false);
  const [reactionDetails, setReactionDetails] = useState({});
  const [reactionImages, setReactionImages] = useState({});
  const [loadingDetails, setLoadingDetails] = useState({});
  const [showFilterMenu, setShowFilterMenu] = useState(false);

  // Use either external or internal state
  const selectedRows = externalSelectedRows || internalSelectedRows;
  const setSelectedRows = setExternalSelectedRows || setInternalSelectedRows;
  const setView = setResults;

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
    const newResults = filteredResults.filter((_, index) =>
      selectedRows.has(index)
    );
    setResults(newResults);
    setFilteredResults(newResults);
    setSelectedRows(new Set());
  };

  const handleRemoveSelected = () => {
    const newResults = filteredResults.filter(
      (_, index) => !selectedRows.has(index)
    );
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
        setLoadingDetails((prev) => ({ ...prev, [reaction]: true }));

        // Fetch reaction details from local API
        fetch(`/api/reaction/${reaction}`)
          .then((response) => response.json())
          .then((data) => {
            setReactionDetails((prev) => ({
              ...prev,
              [reaction]: data.data?.definition || "No definition available",
            }));
          })
          .catch((error) => {
            console.error("Error fetching reaction details:", error);
            setReactionDetails((prev) => ({
              ...prev,
              [reaction]: "Failed to load definition",
            }));
          })
          .finally(() => {
            setLoadingDetails((prev) => ({ ...prev, [reaction]: false }));
          });

        // Set image URL if we have a valid reaction ID
        if (reactionId) {
          setReactionImages((prev) => ({
            ...prev,
            [reaction]: `https://www.genome.jp/Fig/reaction/${reactionId}.gif`,
          }));
        }
      }
    }

    setExpandedRows(newExpanded);
  };

  const toggleColumnVisibility = (columnKey) => {
    setColumnVisibility((prev) => ({
      ...prev,
      [columnKey]: !prev[columnKey],
    }));
  };

  // Get row background color based on pair colors
  const getRowStyles = (row) => {
    const isDark = typeof document !== 'undefined' && document.documentElement.classList.contains('dark');

    const neutralBg = isDark ? 'rgba(255,255,255,0.05)' : 'white';

    // In combined mode, a row might have multiple colors
    if (combinedMode && row.pairColors && row.pairColors.length > 0) {
      if (row.pairColors.length > 1) {
        return {
          borderLeft: `4px solid ${row.pairColors[0]}`,
          backgroundColor: neutralBg,
        };
      } else {
        return {
          borderLeft: `4px solid ${row.pairColors[0]}`,
          backgroundColor: `${row.pairColors[0]}10`,
        };
      }
    }

    if (row.pairColor) {
      return {
        borderLeft: `4px solid ${row.pairColor}`,
        backgroundColor: `${row.pairColor}10`,
      };
    }

    return { backgroundColor: neutralBg };
  };

  const ColumnManager = () => (
    <div className="absolute right-0 top-12 bg-white dark:bg-slate-800 rounded-xl shadow-lg border border-gray-200 dark:border-slate-600 p-4 z-50 min-w-[200px] animate-fade-in">
      <h3 className="font-semibold text-slate-700 mb-3 flex items-center gap-2 text-sm">
        <LayoutGrid className="w-4 h-4 text-emerald-600" />
        Column Visibility
      </h3>
      <div className="space-y-2">
        {Object.entries(columnVisibility).map(([key, isVisible]) => (
          <label
            key={key}
            className="flex items-center gap-2 cursor-pointer group"
          >
            <div className="relative">
              <input
                type="checkbox"
                checked={isVisible}
                onChange={() => toggleColumnVisibility(key)}
                className="opacity-0 absolute"
              />
              <div
                className={`w-5 h-5 rounded-md flex items-center justify-center 
                ${
                  isVisible
                    ? "bg-emerald-500 border-emerald-500"
                    : "bg-white dark:bg-slate-700 border-2 border-slate-200 dark:border-slate-600"
                }`}
              >
                {isVisible && <CheckCircle2 className="w-3 h-3 text-white" />}
              </div>
            </div>
            <span className="text-sm text-slate-600 dark:text-slate-300 group-hover:text-emerald-700 transition-colors capitalize">
              {key.replace(/_/g, " ")}
            </span>
          </label>
        ))}
      </div>
    </div>
  );

  const SelectionActions = () => {
    return (
      <div className="flex items-center gap-4">
        {selectedRows.size > 0 ? (
          <div className="flex items-center gap-3">
            <span className="text-sm font-medium text-slate-700 px-3 py-1">
              {selectedRows.size} item{selectedRows.size !== 1 ? "s" : ""}{" "}
              selected
            </span>
            <button
              onClick={handleKeepSelected}
              className="flex items-center gap-2 px-4 py-2 bg-emerald-50 dark:bg-emerald-600/20 text-emerald-700 dark:text-emerald-300 rounded-lg hover:bg-emerald-100 dark:hover:bg-emerald-600/30 transition-all text-sm font-medium border border-emerald-100 dark:border-emerald-600/40"
            >
              <CheckCircle2 className="w-4 h-4" />
              Keep Selection
            </button>
            <button
              onClick={handleRemoveSelected}
              className="flex items-center gap-2 px-4 py-2 bg-blue-50 dark:bg-blue-600/20 text-blue-700 dark:text-blue-300 rounded-lg hover:bg-blue-100 dark:hover:bg-blue-600/30 transition-all text-sm font-medium border border-blue-100 dark:border-blue-600/40"
            >
              <XCircle className="w-4 h-4" />
              Delete Selection
            </button>
            <button
              onClick={() => setSelectedRows(new Set())} 
              className="flex items-center gap-2 px-4 py-2 bg-slate-100 dark:bg-slate-700 text-slate-700 dark:text-slate-300 rounded-lg hover:bg-slate-200 dark:hover:bg-slate-600 transition-all text-sm font-medium border border-slate-100 dark:border-slate-600"
              title="Clear selection"
            >
              <CircleDashed className="w-4 h-4" />
              Clear Selection
            </button>
          </div>
        ) : (
          <div className="flex items-center gap-2 text-slate-500">
            <Filter className="w-4 h-4" />
            <span className="text-sm font-medium">Ready to analyze</span>
          </div>
        )}
      </div>
    );
  };

  // Render multi-color indicator for combined mode
  const MultiColorIndicator = ({ colors }) => {
    if (!colors || colors.length === 0) return null;

    return (
      <div className="flex items-center h-5 gap-0.5">
        {colors.map((color, index) => (
          <div
            key={index}
            className="w-2 h-full rounded-sm"
            style={{ backgroundColor: color }}
          />
        ))}
      </div>
    );
  };

  return (
    <div className="bg-white dark:bg-slate-800 rounded-xl shadow-sm border border-slate-100 dark:border-slate-700 overflow-hidden">
      <div className="p-4 border-b border-slate-100 dark:border-slate-700 flex justify-between items-center bg-slate-50 dark:bg-slate-700/50">
        <SelectionActions />
        <div className="flex items-center gap-2">
          {/* Filter Button & Dropdown */}
          <div className="relative">
            <button
              onClick={() => setShowFilterMenu(!showFilterMenu)}
              className="p-2 hover:bg-slate-100 dark:hover:bg-slate-600 rounded-lg transition-all text-slate-600 hover:text-blue-700"
            >
              <Filter className="w-5 h-5" />
            </button>
            {showFilterMenu && (
              <div className="absolute right-0 top-12 z-50 animate-fade-in">
                <FilterMenu
                  results={filteredResults}
                  selectedRows={selectedRows}
                  setSelectedRows={setSelectedRows}
                  onClose={() => setShowFilterMenu(false)}
                />
              </div>
            )}
          </div>

          {/* Column Visibility Button & Dropdown */}
          <div className="relative">
            <button
              onClick={() => setShowColumnManager(!showColumnManager)}
              className="p-2 hover:bg-slate-100 dark:hover:bg-slate-600 rounded-lg transition-all text-slate-600 hover:text-emerald-700"
            >
              <Settings2 className="w-5 h-5" />
            </button>
            {showColumnManager && <ColumnManager />}
          </div>
        </div>
      </div>

      {/* Table */}
      <div className="overflow-x-auto">
        <table className="w-full">
          <thead className="bg-slate-50 dark:bg-slate-800 border-b border-slate-100 dark:border-slate-700">
            <tr>
              <th className="w-8 px-4 py-3">
                <div className="flex items-center justify-center">
                  <input
                    type="checkbox"
                    checked={
                      selectedRows.size === filteredResults.length &&
                      filteredResults.length > 0
                    }
                    onChange={toggleSelectAll}
                    className="opacity-0 absolute"
                  />
                  <div
                    className={`w-5 h-5 rounded-md flex items-center justify-center 
                    ${
                      selectedRows.size === filteredResults.length &&
                      filteredResults.length > 0
                        ? "bg-emerald-500"
                        : "bg-white dark:bg-slate-700 border-2 border-slate-200 dark:border-slate-600"
                    }`}
                  >
                    {selectedRows.size === filteredResults.length &&
                      filteredResults.length > 0 && (
                        <CheckCircle2 className="w-3 h-3 text-white" />
                      )}
                  </div>
                </div>
              </th>
              <th className="w-8 px-2"></th>
              {combinedMode && <th className="w-10 px-2"></th>}
              {visibleColumns.map((column) => (
                <th
                  key={column}
                  className="px-4 py-3 text-left text-sm font-semibold text-slate-700 dark:text-slate-200 capitalize"
                >
                  {column.replace(/_/g, " ")}
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100 dark:divide-slate-700">
            {filteredResults?.map((row, index) => (
              <React.Fragment key={index}>
                <tr
                  className={`
                    hover:bg-slate-50 dark:hover:bg-slate-700 transition-all
                    ${selectedRows.has(index) ? "bg-blue-50 dark:bg-blue-500/10" : ""}
                    ${expandedRows.has(index) ? "!bg-indigo-50 dark:!bg-indigo-500/10" : ""}
                  `}
                  style={getRowStyles(row)}
                >
                  <td className="w-8 px-4 py-3">
                    <div className="flex items-center justify-center">
                      <input
                        type="checkbox"
                        checked={selectedRows.has(index)}
                        onChange={() => toggleRowSelection(index)}
                        className="opacity-0 absolute"
                      />
                      <div
                        className={`w-5 h-5 rounded-md flex items-center justify-center 
                        ${
                          selectedRows.has(index)
                            ? "bg-emerald-500"
                            : "bg-white dark:bg-slate-700 border-2 border-slate-200 dark:border-slate-600"
                        }`}
                      >
                        {selectedRows.has(index) && (
                          <CheckCircle2 className="w-3 h-3 text-white" />
                        )}
                      </div>
                    </div>
                  </td>
                  <td className="w-8 px-2">
                    <button
                      onClick={() => toggleRowExpansion(index, row)}
                      className="p-1 hover:bg-slate-100 dark:hover:bg-slate-600 rounded-md transition-all text-slate-500 hover:text-emerald-700"
                    >
                      {expandedRows.has(index) ? (
                        <ChevronDown className="w-4 h-4" />
                      ) : (
                        <ChevronRight className="w-4 h-4" />
                      )}
                    </button>
                  </td>
                  {combinedMode && (
                    <td className="w-10 px-2">
                      {row.pairColors && (
                        <MultiColorIndicator colors={row.pairColors} />
                      )}
                    </td>
                  )}
                  {visibleColumns.map((col) => (
                    <TableCell key={col} column={col} row={row} />
                  ))}
                </tr>
                {expandedRows.has(index) && (
                  <tr className="bg-indigo-50 dark:bg-indigo-500/10">
                    <td
                      colSpan={
                        visibleColumns.length + 2 + (combinedMode ? 1 : 0)
                      }
                      className="px-6 py-4"
                    >
                      {loadingDetails[row.reaction] ? (
                        <div className="flex justify-center py-8">
                          <div className="animate-spin rounded-full h-8 w-8 border-2 border-emerald-500 border-t-transparent"></div>
                        </div>
                      ) : (
                        <div className="space-y-6">
                          <div className="flex items-center gap-2 text-slate-700">
                            <span className="font-medium">
                              Reaction Details
                            </span>
                            <div className="flex-1 h-px bg-indigo-200"></div>
                          </div>

                          {/* Definition */}
                          <div className="bg-white dark:bg-slate-800 p-5 rounded-lg border border-indigo-100 dark:border-slate-600 shadow-sm">
                            <span className="text-slate-400 text-sm font-medium">
                              KEGG Definition
                            </span>
                            <p className="mt-2 text-slate-500 font-medium">
                              {reactionDetails[row.reaction] ||
                                "No definition available"}
                            </p>
                          </div>

                          {/* Reaction Image */}
                          {reactionImages[row.reaction] && (
                            <div className="bg-white dark:bg-slate-800 p-5 rounded-lg border border-indigo-100 dark:border-slate-600 shadow-sm">
                              <span className="text-slate-600 text-sm font-medium">
                                KEGG Reaction Diagram
                              </span>
                              <div className="mt-3 flex justify-center bg-gray-50 p-4 rounded-lg">
                                <img
                                  src={reactionImages[row.reaction]}
                                  alt={`Reaction diagram for ${row.reaction}`}
                                  className="max-w-full"
                                  onError={(e) => {
                                    e.target.onerror = null;
                                    e.target.src =
                                      "data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iNDAwIiBoZWlnaHQ9IjEwMCIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj48cmVjdCB4PSIwIiB5PSIwIiB3aWR0aD0iNDAwIiBoZWlnaHQ9IjEwMCIgZmlsbD0iI2YxZjVmOSIvPjx0ZXh0IHg9IjIwMCIgeT0iNTAiIGZvbnQtZmFtaWx5PSJBcmlhbCIgZm9udC1zaXplPSIxNiIgdGV4dC1hbmNob3I9Im1pZGRsZSIgYWxpZ25tZW50LWJhc2VsaW5lPSJtaWRkbGUiIGZpbGw9IiM2NDc0OGIiPkltYWdlIG5vdCBhdmFpbGFibGU8L3RleHQ+PC9zdmc+";
                                    console.log(
                                      `Failed to load image for ${row.reaction}`
                                    );
                                  }}
                                />
                              </div>
                            </div>
                          )}
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
    </div>
  );
};

const TableCell = ({ column, row }) => {
  const content = {
    reaction: row.reaction,
    source: row.source,
    coenzyme: row.coenzyme,
    equation: row.equation,
    transition: row.transition,
    target: row.target,
    ec: row.ec_list?.map((ec, i) => <ECDetails key={i} ec={ec} />),
  };

  return (
    <td className="px-4 py-3 text-sm text-slate-600 dark:text-slate-200">
      <div className="max-w-full">{content[column] || "-"}</div>
    </td>
  );
};

export default ResultTable;
