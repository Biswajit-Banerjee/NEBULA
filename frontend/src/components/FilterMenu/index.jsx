import React, { useState } from 'react';
import { Search, X, CheckSquare, XSquare } from 'lucide-react';

const FilterMenu = ({ results, setResults, onClose }) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [isRegexMode, setIsRegexMode] = useState(false);
  const [searchColumn, setSearchColumn] = useState('all');
  const [selectedRows, setSelectedRows] = useState([]);

  const handleSearch = () => {
    if (!searchTerm.trim()) return;

    try {
      const matchingIndices = results.reduce((indices, row, index) => {
        let shouldMatch = false;
        const pattern = isRegexMode ? new RegExp(searchTerm) : searchTerm.toLowerCase();

        if (searchColumn === 'all') {
          shouldMatch = Object.values(row).some(value => {
            const strValue = String(value).toLowerCase();
            return isRegexMode ? pattern.test(strValue) : strValue.includes(pattern);
          });
        } else {
          const value = String(row[searchColumn]).toLowerCase();
          shouldMatch = isRegexMode ? pattern.test(value) : value.includes(pattern);
        }

        if (shouldMatch) indices.push(index);
        return indices;
      }, []);

      setSelectedRows(matchingIndices);
    } catch (e) {
      console.error('Invalid search pattern:', e);
    }
  };

  const handleKeepSelected = () => {
    const newResults = results.filter((_, index) => selectedRows.includes(index));
    setResults(newResults);
    setSelectedRows([]);
    onClose();
  };

  const handleRemoveSelected = () => {
    const newResults = results.filter((_, index) => !selectedRows.includes(index));
    setResults(newResults);
    setSelectedRows([]);
    onClose();
  };

  const columns = [
    { value: 'all', label: 'All Columns' },
    { value: 'reaction', label: 'Reaction' },
    { value: 'source', label: 'Source' },
    { value: 'coenzyme', label: 'Coenzyme' },
    { value: 'equation', label: 'Equation' },
    { value: 'transition', label: 'Transition' },
    { value: 'target', label: 'Target' }
  ];

  return (
    <div className="w-80 bg-white shadow-lg rounded-lg border">
      <div className="p-4">
        <div className="flex justify-between items-center mb-4">
          <h3 className="text-lg font-semibold text-gray-800">Filter & Select</h3>
          <button 
            onClick={onClose}
            className="text-gray-500 hover:text-gray-700 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="space-y-4">
          {/* Search Section */}
          <div className="space-y-2">
            <select
              value={searchColumn}
              onChange={(e) => setSearchColumn(e.target.value)}
              className="block w-full rounded-md border border-gray-300 text-sm p-2 focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            >
              {columns.map(column => (
                <option key={column.value} value={column.value}>
                  {column.label}
                </option>
              ))}
            </select>
            <div className="relative">
              <input
                type="text"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                onKeyPress={(e) => e.key === 'Enter' && handleSearch()}
                placeholder="Search..."
                className="block w-full rounded-md border border-gray-300 pl-10 pr-12 py-2 text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              />
              <Search className="w-4 h-4 absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" />
              <button
                onClick={() => setIsRegexMode(!isRegexMode)}
                className={`absolute right-3 top-1/2 transform -translate-y-1/2 ${
                  isRegexMode ? 'text-blue-600' : 'text-gray-400'
                }`}
                title={isRegexMode ? 'Regex mode active' : 'Toggle regex mode'}
              >
                <div className="w-4 h-4 font-mono font-bold">.*</div>
              </button>
            </div>
            <button
              onClick={handleSearch}
              className="w-full px-4 py-2 bg-blue-50 text-blue-600 rounded-md hover:bg-blue-100 transition-colors text-sm font-medium"
            >
              Select Matching
            </button>
          </div>

          {/* Selection Actions */}
          <div className="flex gap-2">
            <button
              onClick={handleKeepSelected}
              disabled={!selectedRows.length}
              className="flex-1 px-3 py-2 text-sm text-white bg-blue-600 rounded-md hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-1"
            >
              <CheckSquare className="w-4 h-4" />
              Keep Selected
            </button>
            <button
              onClick={handleRemoveSelected}
              disabled={!selectedRows.length}
              className="flex-1 px-3 py-2 text-sm text-white bg-red-600 rounded-md hover:bg-red-700 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-1"
            >
              <XSquare className="w-4 h-4" />
              Remove Selected
            </button>
          </div>

          {/* Statistics */}
          <div className="pt-3 border-t text-sm space-y-1">
            <div className="flex justify-between text-gray-600">
              <span>Selected:</span>
              <span className="font-medium">{selectedRows.length}</span>
            </div>
            <div className="flex justify-between text-gray-600">
              <span>Total Rows:</span>
              <span className="font-medium">{results.length}</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default FilterMenu;