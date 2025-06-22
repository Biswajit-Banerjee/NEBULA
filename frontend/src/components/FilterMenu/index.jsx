import React, { useState, useMemo } from 'react';
import { Search, X, Filter as FilterIcon, CheckCircle2, XCircle, Layers } from 'lucide-react'; // Added CheckCircle2, XCircle

// Assuming these are available from a shared utils.js or defined elsewhere.
// For standalone example, I'll define them here.
const GRADIENT_COLORS_PALETTE = [
  'from-violet-500 to-purple-600', 'from-blue-500 to-cyan-500',
  'from-emerald-500 to-teal-600', 'from-amber-500 to-orange-500',
];

const getRandomGradientForUI = () => {
  return GRADIENT_COLORS_PALETTE[Math.floor(Math.random() * GRADIENT_COLORS_PALETTE.length)];
};
// ---

const FilterMenu = ({
  results,
  selectedRows, // Added: The Set of selected row indices
  setSelectedRows,
  handleKeepSelected, // Added: Function to keep selected rows
  handleRemoveSelected, // Added: Function to remove selected rows
  onClose
}) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [isRegexMode, setIsRegexMode] = useState(false);
  const [searchColumn, setSearchColumn] = useState('all');

  const handleSearch = () => {
    if (!results || !searchTerm.trim()) {
      setSelectedRows(new Set());
      return;
    }
    try {
      const matchingIndices = new Set();
      const pattern = isRegexMode ? new RegExp(searchTerm, 'i') : searchTerm.toLowerCase();

      results.forEach((row, index) => {
        let textToSearch = '';
        if (searchColumn === 'all') {
          textToSearch = Object.values(row)
            .map(value => (value !== null && value !== undefined ? String(value) : ''))
            .join(' ')
            .toLowerCase();
        } else if (row && row[searchColumn] !== null && row[searchColumn] !== undefined) {
          textToSearch = String(row[searchColumn]).toLowerCase();
        }
        const shouldMatch = isRegexMode ? pattern.test(textToSearch) : textToSearch.includes(pattern);
        if (shouldMatch) {
          matchingIndices.add(index);
        }
      });
      setSelectedRows(matchingIndices);
    } catch (e) {
      console.error('Invalid search pattern:', e);
      alert("Invalid Regular Expression pattern. Please check your input.");
    }
  };

  const handleClearSearchAndSelection = () => {
    setSearchTerm('');
    setSelectedRows(new Set());
    setSearchColumn('all'); // Reset column selection as well
  };

  const columns = useMemo(() => {
    if (results && results.length > 0) {
      const firstRowKeys = Object.keys(results[0]);
      const dynamicColumns = firstRowKeys.map(key => ({
        value: key,
        label: key.replace(/([A-Z])(?=[a-z])|[a-z](?=[A-Z])/g, '$& ').replace(/^./, str => str.toUpperCase()) // Improved label generation
      }));
      return [{ value: 'all', label: 'All Columns' }, ...dynamicColumns];
    }
    return [
      { value: 'all', label: 'All Columns' }, { value: 'reaction', label: 'Reaction' },
      { value: 'source', label: 'Source' }, { value: 'target', label: 'Target' },
      { value: 'equation', label: 'Equation' }
    ];
  }, [results]);

  const primaryButtonGradient = GRADIENT_COLORS_PALETTE[2]

  return (
    <div className="w-72 bg-white dark:bg-slate-800 rounded-2xl shadow-xl border border-slate-200 dark:border-slate-700 overflow-hidden">
      <div className="p-4 sm:p-5"> {/* Reduced padding */}
        <div className="flex justify-between items-center mb-4">
          <div className="flex items-center gap-2">
            <div className={`p-1.5 rounded-lg bg-gradient-to-br ${GRADIENT_COLORS_PALETTE[1]} opacity-20 dark:opacity-30`}> {/* Smaller icon bg */}
              <FilterIcon className="w-4 h-4 text-violet-600 dark:text-violet-400" /> {/* Smaller icon */}
            </div>
            <h3 className="text-base sm:text-md font-semibold text-slate-800 dark:text-slate-100">Filter & Select</h3> {/* Shorter title */}
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-full text-slate-500 dark:text-slate-400 hover:bg-slate-200/70 dark:hover:bg-slate-700/70 transition-colors"
            title="Close filter menu"
          >
            <X className="w-4 h-4" /> {/* Smaller icon */}
          </button>
        </div>

        <div className="space-y-3"> {/* Reduced space between elements */}
          {/* Combined Column Select and Search Term Input */}
          <div className="flex flex-col sm:flex-row gap-2 items-start sm:items-center">
             <div className="w-full sm:w-2/5"> {/* Adjusted width for select */}
                <label htmlFor="search-column-select" className="sr-only">Search In</label> {/* Visually hidden label, but good for a11y */}
                <select
                  id="search-column-select"
                  value={searchColumn}
                  onChange={(e) => setSearchColumn(e.target.value)}
                  className="w-full px-3 py-2 rounded-lg border border-slate-300/70 dark:border-slate-600/70 bg-white/60 dark:bg-slate-700/40 text-xs text-slate-700 dark:text-slate-200 focus:border-violet-500 dark:focus:border-violet-400 focus:ring-2 focus:ring-violet-500/20 dark:focus:ring-violet-400/20 transition-all duration-150"
                >
                  {columns.map(column => (
                    <option key={column.value} value={column.value}>
                      {column.label}
                    </option>
                  ))}
                </select>
            </div>
            <div className="relative flex items-center w-full sm:w-3/5"> {/* Adjusted width for input */}
              <Search className="w-3.5 h-3.5 absolute left-3 top-1/2 transform -translate-y-1/2 text-slate-400 dark:text-slate-500 pointer-events-none" />
              <input
                id="filter-search-term"
                type="text"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                onKeyPress={(e) => e.key === 'Enter' && handleSearch()}
                placeholder="Search..." // Shorter placeholder
                className="w-full pl-8 pr-10 py-2 rounded-lg border border-slate-300/70 dark:border-slate-600/70 bg-white/60 dark:bg-slate-700/40 text-xs text-slate-700 dark:text-slate-200 placeholder-slate-400 dark:placeholder-slate-500 focus:border-violet-500 dark:focus:border-violet-400 focus:ring-2 focus:ring-violet-500/20 dark:focus:ring-violet-400/20 transition-all duration-150"
              />
              <button
                onClick={() => setIsRegexMode(!isRegexMode)}
                className={`absolute right-2 top-1/2 transform -translate-y-1/2 p-0.5 rounded hover:bg-slate-200/70 dark:hover:bg-slate-600/70 transition-colors ${
                  isRegexMode ? 'text-violet-600 dark:text-violet-400' : 'text-slate-400 dark:text-slate-500'
                }`}
                title={isRegexMode ? 'Regex mode (Case Insensitive)' : 'Toggle regex mode (Case Insensitive)'}
              >
                <span className="text-xxs font-mono font-bold select-none">.*</span> {/* Smaller regex indicator */}
              </button>
            </div>
          </div>
          
          {/* Action Buttons */}
          <div className="flex gap-2 pt-1"> {/* Reduced gap and padding top */}
            <button
              onClick={handleClearSearchAndSelection}
              className="flex-1 px-3 py-2 bg-slate-100 hover:bg-slate-200 dark:bg-slate-700 dark:hover:bg-slate-600/80 text-slate-600 dark:text-slate-300 rounded-lg transition-colors text-xs font-medium shadow-sm"
            >
              Clear
            </button>
            <button
              onClick={handleSearch}
              className={`flex-1 px-3 py-2 bg-gradient-to-r ${primaryButtonGradient} text-white rounded-lg transition-all duration-200 text-xs font-semibold shadow-md hover:shadow-lg hover:opacity-95 transform hover:scale-[1.02]`}
            >
              Search & Select
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default FilterMenu;