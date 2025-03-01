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
    <div className="w-80 bg-white shadow-xl rounded-xl border border-slate-200 overflow-hidden">
      <div className="p-4">
        <div className="flex justify-between items-center mb-4">
          <h3 className="text-lg font-semibold text-slate-800">Filter & Select</h3>
          <button 
            onClick={onClose}
            className="p-2 hover:bg-slate-100 rounded-full text-slate-500 hover:text-slate-700 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="space-y-4">
          <select
            value={searchColumn}
            onChange={(e) => setSearchColumn(e.target.value)}
            className="block w-full rounded-lg border border-slate-200 text-sm p-2.5 bg-white focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
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
              className="block w-full rounded-lg border border-slate-200 pl-10 pr-12 py-2.5 text-sm focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
            />
            <Search className="w-4 h-4 absolute left-3 top-1/2 transform -translate-y-1/2 text-slate-400" />
            <button
              onClick={() => setIsRegexMode(!isRegexMode)}
              className={`absolute right-3 top-1/2 transform -translate-y-1/2 ${
                isRegexMode ? 'text-indigo-600' : 'text-slate-400'
              }`}
              title={isRegexMode ? 'Regex mode active' : 'Toggle regex mode'}
            >
              <div className="w-4 h-4 font-mono font-bold">.*</div>
            </button>
          </div>
          <button
            onClick={handleSearch}
            className="w-full px-4 py-2.5 bg-gradient-to-r from-indigo-500 to-blue-600 hover:from-indigo-600 hover:to-blue-700 text-white rounded-lg transition-colors text-sm font-medium"
          >
            Search & Select
          </button>
        </div>
      </div>
    </div>
  );
};

export default FilterMenu;