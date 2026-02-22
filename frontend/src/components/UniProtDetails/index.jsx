import React from 'react';

const DomainTable = ({ data = [] }) => {
  if (!data.length) {
    return (
      <div className="text-sm text-gray-400 dark:text-slate-500 py-2">
        No domain data available
      </div>
    );
  }

  return (
    <div className="overflow-x-auto">
      <table className="min-w-full divide-y divide-gray-200/70 dark:divide-slate-700/40">
        <thead className="bg-gray-50/60 dark:bg-slate-800/60">
          <tr>
            <th className="px-3 py-2 text-left text-xs font-medium text-gray-400 dark:text-slate-400">Organism</th>
            <th className="px-3 py-2 text-left text-xs font-medium text-gray-400 dark:text-slate-400">Domain ID</th>
            <th className="px-3 py-2 text-left text-xs font-medium text-gray-400 dark:text-slate-400">A</th>
            <th className="px-3 py-2 text-left text-xs font-medium text-gray-400 dark:text-slate-400">X</th>
            <th className="px-3 py-2 text-left text-xs font-medium text-gray-400 dark:text-slate-400">H</th>
            <th className="px-3 py-2 text-left text-xs font-medium text-gray-400 dark:text-slate-400">T</th>
            <th className="px-3 py-2 text-left text-xs font-medium text-gray-400 dark:text-slate-400">F</th>
            <th className="px-3 py-2 text-right text-xs font-medium text-gray-400 dark:text-slate-400">Length</th>
          </tr>
        </thead>
        <tbody className="bg-white/80 dark:bg-slate-800/60 divide-y divide-gray-200/70 dark:divide-slate-700/40">
          {data.map((row, index) => (
            <tr key={index} className="hover:bg-gray-50/70 dark:hover:bg-slate-700/40">
              <td className="px-3 py-2 text-sm text-gray-500 dark:text-slate-400 whitespace-nowrap">{row.organism_name}</td>
              <td className="px-3 py-2 text-sm font-mono text-blue-500 dark:text-blue-400/80 whitespace-nowrap">{row.domain_id}</td>
              <td className="px-3 py-2 text-sm text-gray-700 dark:text-slate-300">{row.A}</td>
              <td className="px-3 py-2 text-sm text-gray-700 dark:text-slate-300">{row.X}</td>
              <td className="px-3 py-2 text-sm text-gray-700 dark:text-slate-300">{row.H}</td>
              <td className="px-3 py-2 text-sm text-gray-700 dark:text-slate-300">{row.T}</td>
              <td className="px-3 py-2 text-sm text-gray-700 dark:text-slate-300">{row.F}</td>
              <td className="px-3 py-2 text-sm text-gray-700 dark:text-slate-300 text-right">{row.length}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
};

export default DomainTable;