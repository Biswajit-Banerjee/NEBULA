import React, { useState, useMemo, useEffect } from "react";
import { getApiUrl } from '../../config/api';
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
  searchPairs = [],
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
        fetch(getApiUrl(`reaction/${reaction}`))
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
    const neutralBg = 'rgb(var(--surface-secondary))';

    const colorForPair = (idx) => {
      const p = searchPairs[idx];
      if (!p) return null;
      const hex = p.color || '#94a3b8';
      const alpha = p.alpha !== undefined ? p.alpha : 1;
      const aHex = Math.round(alpha*255).toString(16).padStart(2,'0');
      return `${hex}${aHex}`;
    };

    if (combinedMode && row.pairIndices && row.pairIndices.length) {
      const col0 = colorForPair(row.pairIndices[0]);
      return {
        borderLeft: `4px solid ${col0}`,
        backgroundColor: row.pairIndices.length===1 ? `${col0}20` : neutralBg,
      };
    }

    if (row.pairIndex !== undefined) {
      const col = colorForPair(row.pairIndex);
      return {
        borderLeft: `4px solid ${col}`,
        backgroundColor: `${col}20`,
      };
    }

    return { backgroundColor: neutralBg };
  };

  const ColumnManager = () => (
    <div className="absolute right-0 top-12 bg-surface-overlay/95 rounded-xl shadow-lg border border-brd/70 p-4 z-50 min-w-[200px] animate-fade-in">
      <h3 className="font-semibold text-content mb-3 flex items-center gap-2 text-sm">
        <LayoutGrid className="w-4 h-4 text-ok" />
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
                    ? "bg-ok border-ok"
                    : "bg-surface-secondary border-2 border-brd/70"
                }`}
              >
                {isVisible && <CheckCircle2 className="w-3 h-3 text-content-inverse" />}
              </div>
            </div>
            <span className="text-sm text-content group-hover:text-ok transition-colors capitalize">
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
            <span className="text-sm font-medium text-content px-3 py-1">
              {selectedRows.size} item{selectedRows.size !== 1 ? "s" : ""}{" "}
              selected
            </span>
            <button
              onClick={handleKeepSelected}
              className="flex items-center gap-2 px-4 py-2 bg-ok-subtle/80 text-ok rounded-lg hover:bg-ok-subtle transition-all text-sm font-medium border border-ok/20"
            >
              <CheckCircle2 className="w-4 h-4" />
              Keep Selection
            </button>
            <button
              onClick={handleRemoveSelected}
              className="flex items-center gap-2 px-4 py-2 bg-nfo-subtle/80 text-nfo rounded-lg hover:bg-nfo-subtle transition-all text-sm font-medium border border-nfo/20"
            >
              <XCircle className="w-4 h-4" />
              Delete Selection
            </button>
            <button
              onClick={() => setSelectedRows(new Set())} 
              className="flex items-center gap-2 px-4 py-2 bg-surface-inset/70 text-content rounded-lg hover:bg-brd/70 transition-all text-sm font-medium border border-brd/40"
              title="Clear selection"
            >
              <CircleDashed className="w-4 h-4" />
              Clear Selection
            </button>
          </div>
        ) : (
          <div className="flex items-center gap-2 text-content-secondary">
            <Filter className="w-4 h-4" />
            <span className="text-sm font-medium">Ready to analyze</span>
          </div>
        )}
      </div>
    );
  };

  // Render multi-color indicator for combined mode
  const MultiColorIndicator = ({ pairIndices }) => {
    if (!pairIndices || pairIndices.length === 0) return null;
    const cols = pairIndices.map(colorForPair);
    return (
      <div className="flex items-center h-5 gap-0.5">
        {cols.map((c,i)=>(<div key={i} className="w-2 h-full rounded-sm" style={{backgroundColor:c}}/>))}
      </div>
    );
  };

  return (
    <div className="bg-surface-secondary/90 rounded-xl shadow-sm border border-brd/40 overflow-hidden">
      <div className="p-4 border-b border-brd/40 flex justify-between items-center bg-surface-inset/60">
        <SelectionActions />
        <div className="flex items-center gap-2">
          {/* Filter Button & Dropdown */}
          <div className="relative">
            <button
              onClick={() => setShowFilterMenu(!showFilterMenu)}
              className="p-2 hover:bg-surface-inset/70 rounded-lg transition-all text-content-secondary hover:text-nfo"
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
              className="p-2 hover:bg-surface-inset/70 rounded-lg transition-all text-content-secondary hover:text-ok"
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
          <thead className="bg-surface-inset/60 border-b border-brd/40">
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
                        ? "bg-ok"
                        : "bg-surface-secondary border-2 border-brd/70"
                    }`}
                  >
                    {selectedRows.size === filteredResults.length &&
                      filteredResults.length > 0 && (
                        <CheckCircle2 className="w-3 h-3 text-content-inverse" />
                      )}
                  </div>
                </div>
              </th>
              <th className="w-8 px-2"></th>
              {combinedMode && <th className="w-10 px-2"></th>}
              {visibleColumns.map((column) => (
                <th
                  key={column}
                  className="px-4 py-3 text-left text-sm font-semibold text-content capitalize"
                >
                  {column.replace(/_/g, " ")}
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-brd/40">
            {filteredResults?.map((row, index) => (
              <React.Fragment key={index}>
                <tr
                  className={`
                    hover:bg-surface-inset/70 transition-all
                    ${selectedRows.has(index) ? "bg-nfo-subtle/60" : ""}
                    ${expandedRows.has(index) ? "!bg-brand/5" : ""}
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
                            ? "bg-ok"
                            : "bg-surface-secondary border-2 border-brd/70"
                        }`}
                      >
                        {selectedRows.has(index) && (
                          <CheckCircle2 className="w-3 h-3 text-content-inverse" />
                        )}
                      </div>
                    </div>
                  </td>
                  <td className="w-8 px-2">
                    <button
                      onClick={() => toggleRowExpansion(index, row)}
                      className="p-1 hover:bg-surface-inset/70 rounded-md transition-all text-content-secondary hover:text-ok"
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
                      {row.pairIndices && (
                        <MultiColorIndicator pairIndices={row.pairIndices} />
                      )}
                    </td>
                  )}
                  {visibleColumns.map((col) => (
                    <TableCell key={col} column={col} row={row} />
                  ))}
                </tr>
                {expandedRows.has(index) && (
                  <tr className="bg-brand/5">
                    <td
                      colSpan={
                        visibleColumns.length + 2 + (combinedMode ? 1 : 0)
                      }
                      className="px-6 py-4"
                    >
                      {loadingDetails[row.reaction] ? (
                        <div className="flex justify-center py-8">
                          <div className="animate-spin rounded-full h-8 w-8 border-2 border-ok border-t-transparent"></div>
                        </div>
                      ) : (
                        <div className="space-y-6">
                          <div className="flex items-center gap-2 text-content">
                            <span className="font-medium">
                              Reaction Details
                            </span>
                            <div className="flex-1 h-px bg-brand/20"></div>
                          </div>

                          {/* Definition */}
                          <div className="bg-surface-secondary/80 p-5 rounded-lg border border-brd/30 shadow-sm">
                            <span className="text-content-muted text-sm font-medium">
                              KEGG Definition
                            </span>
                            <p className="mt-2 text-content-secondary font-medium">
                              {reactionDetails[row.reaction] ||
                                "No definition available"}
                            </p>
                          </div>

                          {/* Reaction Image */}
                          {reactionImages[row.reaction] && (
                            <div className="bg-surface-secondary/80 p-5 rounded-lg border border-brd/30 shadow-sm">
                              <span className="text-content-secondary text-sm font-medium">
                                KEGG Reaction Diagram
                              </span>
                              <div className="mt-3 flex justify-center bg-surface-inset/70 p-4 rounded-lg">
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
    <td className="px-4 py-3 text-sm text-content">
      <div className="max-w-full">{content[column] || "-"}</div>
    </td>
  );
};

export default ResultTable;
