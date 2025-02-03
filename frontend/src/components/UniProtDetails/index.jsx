import React from 'react';

const DomainTable = ({ data = [] }) => {
  if (!data.length) {
    return (
      <div className="text-sm text-gray-500 py-2">
        No domain data available
      </div>
    );
  }

  return (
    <div className="overflow-x-auto">
      <table className="min-w-full divide-y divide-gray-200">
        <thead className="bg-gray-50">
          <tr>
            <th className="px-3 py-2 text-left text-xs font-medium text-gray-500">Organism</th>
            <th className="px-3 py-2 text-left text-xs font-medium text-gray-500">Domain ID</th>
            <th className="px-3 py-2 text-left text-xs font-medium text-gray-500">A</th>
            <th className="px-3 py-2 text-left text-xs font-medium text-gray-500">X</th>
            <th className="px-3 py-2 text-left text-xs font-medium text-gray-500">H</th>
            <th className="px-3 py-2 text-left text-xs font-medium text-gray-500">T</th>
            <th className="px-3 py-2 text-left text-xs font-medium text-gray-500">F</th>
            <th className="px-3 py-2 text-right text-xs font-medium text-gray-500">Length</th>
          </tr>
        </thead>
        <tbody className="bg-white divide-y divide-gray-200">
          {data.map((row, index) => (
            <tr key={index} className="hover:bg-gray-50">
              <td className="px-3 py-2 text-sm text-gray-600 whitespace-nowrap">{row.organism_name}</td>
              <td className="px-3 py-2 text-sm font-mono text-blue-600 whitespace-nowrap">{row.domain_id}</td>
              <td className="px-3 py-2 text-sm text-gray-900">{row.A}</td>
              <td className="px-3 py-2 text-sm text-gray-900">{row.X}</td>
              <td className="px-3 py-2 text-sm text-gray-900">{row.H}</td>
              <td className="px-3 py-2 text-sm text-gray-900">{row.T}</td>
              <td className="px-3 py-2 text-sm text-gray-900">{row.F}</td>
              <td className="px-3 py-2 text-sm text-gray-900 text-right">{row.length}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
};

export default DomainTable;