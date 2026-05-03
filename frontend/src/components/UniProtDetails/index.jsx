import React from 'react';

const DomainTable = ({ data = [] }) => {
  if (!data.length) {
    return (
      <div className="text-sm text-content-muted py-2">
        No domain data available
      </div>
    );
  }

  return (
    <div className="overflow-x-auto">
      <table className="min-w-full divide-y divide-brd/70">
        <thead className="bg-surface-inset/60">
          <tr>
            <th className="px-3 py-2 text-left text-xs font-medium text-content-muted">Organism</th>
            <th className="px-3 py-2 text-left text-xs font-medium text-content-muted">Domain ID</th>
            <th className="px-3 py-2 text-left text-xs font-medium text-content-muted">A</th>
            <th className="px-3 py-2 text-left text-xs font-medium text-content-muted">X</th>
            <th className="px-3 py-2 text-left text-xs font-medium text-content-muted">H</th>
            <th className="px-3 py-2 text-left text-xs font-medium text-content-muted">T</th>
            <th className="px-3 py-2 text-left text-xs font-medium text-content-muted">F</th>
            <th className="px-3 py-2 text-right text-xs font-medium text-content-muted">Length</th>
          </tr>
        </thead>
        <tbody className="bg-surface/80 divide-y divide-brd/70">
          {data.map((row, index) => (
            <tr key={index} className="hover:bg-surface-inset/70">
              <td className="px-3 py-2 text-sm text-content-secondary whitespace-nowrap">{row.organism_name}</td>
              <td className="px-3 py-2 text-sm font-mono text-info whitespace-nowrap">{row.domain_id}</td>
              <td className="px-3 py-2 text-sm text-content">{row.A}</td>
              <td className="px-3 py-2 text-sm text-content">{row.X}</td>
              <td className="px-3 py-2 text-sm text-content">{row.H}</td>
              <td className="px-3 py-2 text-sm text-content">{row.T}</td>
              <td className="px-3 py-2 text-sm text-content">{row.F}</td>
              <td className="px-3 py-2 text-sm text-content text-right">{row.length}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
};

export default DomainTable;