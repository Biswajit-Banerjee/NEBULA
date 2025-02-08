import React, { useState } from 'react';
import { Search, X } from 'lucide-react';

const FilterMenu = ({ results, setSelectedRows, onClose }) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [isRegexMode, setIsRegexMode] = useState(false);
  const [searchColumn, setSearchColumn] = useState('all');

  const handleSearch = () => {
    if (!searchTerm.trim()) return;

    try {
      const matchingIndices = new Set();
      
      results.forEach((row, index) => {
        let shouldMatch = false;
        const pattern = isRegexMode ? new RegExp(searchTerm) : searchTerm.toLowerCase();

        if (searchColumn === 'all') {
          shouldMatch = Object.values(row).some(value => {
            if (value === null || value === undefined) return false;
            const strValue = String(value).toLowerCase();
            return isRegexMode ? pattern.test(strValue) : strValue.includes(pattern);
          });
        } else {
          const value = row[searchColumn];
          if (value !== null && value !== undefined) {
            const strValue = String(value).toLowerCase();
            shouldMatch = isRegexMode ? pattern.test(strValue) : strValue.includes(pattern);
          }
        }

        if (shouldMatch) {
          matchingIndices.add(index);
        }
      });

      // Directly update the selected rows in the parent
      setSelectedRows(matchingIndices);
      
      // Optional: close the filter menu after selection
      // onClose();
    } catch (e) {
      console.error('Invalid search pattern:', e);
    }
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
            Select
          </button>
        </div>
      </div>
    </div>
  );
};

export default FilterMenu;