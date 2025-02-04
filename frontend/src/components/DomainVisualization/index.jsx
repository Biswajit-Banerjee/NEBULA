import React, { useEffect } from 'react';

const DomainVisualization = ({ 
  proteinData, 
  selectedDomain, 
  setSelectedDomain, 
  selectedRange, 
  setSelectedRange,
  containerRef,
  scale,
  setScale
}) => {
  const domainColors = {
    'nD1': '#90cdf4', 'nD2': '#9ae6b4', 'nD3': '#fbd38d', 'nD4': '#f687b3',
    'nD5': '#b794f4', 'nD6': '#76e4f7', 'nD7': '#feb2b2', 'nD8': '#e9d8fd',
    'nD9': '#fbb6ce', 'nD10': '#c6f6d5',
  };

  const getDomainColor = (domainId) => {
    if (domainColors[domainId]) return domainColors[domainId];
    return '#' + Math.floor(Math.random()*16777215).toString(16);
  };

  useEffect(() => {
    const updateScale = () => {
      if (containerRef.current) {
        const maxLength = Math.max(
          ...proteinData.domains.flatMap(d => d.ranges.map(r => r.end))
        );
        const containerWidth = containerRef.current.offsetWidth - 32;
        setScale(containerWidth / maxLength);
      }
    };

    updateScale();
    window.addEventListener('resize', updateScale);
    return () => window.removeEventListener('resize', updateScale);
  }, [proteinData, containerRef, setScale]);

  return (
    <div className="mt-4" ref={containerRef}>
      <div className="relative h-48 bg-gray-100 rounded p-4">
        {/* Base protein line */}
        <div className="absolute top-12 left-4 h-1 bg-gray-300" style={{ width: '100%' }} />

        {/* Domains */}
        {proteinData.domains.map((domain, idx) => (
          <React.Fragment key={`domain-${idx}`}>
            {domain.ranges.map((range, rangeIdx) => {
              const width = (range.end - range.start) * scale;
              const left = range.start * scale + 16;
              const color = getDomainColor(domain.domain_id);
              const isSelected = selectedDomain?.domain_id === domain.domain_id && 
                               selectedRange?.start === range.start;
              
              return (
                <div key={`domain-container-${idx}-${rangeIdx}`} className="relative">
                  <div
                    className={`absolute rounded cursor-pointer transition-all
                      ${isSelected ? 'ring-2 ring-offset-1 ring-blue-500' : 'hover:opacity-90'}`}
                    style={{
                      left: `${left}px`,
                      width: `${width}px`,
                      top: '10px',
                      height: '24px',
                      backgroundColor: color,
                    }}
                    onClick={() => {
                      setSelectedDomain(domain);
                      setSelectedRange(range);
                    }}
                  />
                  
                  <div
                    className="absolute text-xs font-medium"
                    style={{
                      left: `${left}px`,
                      top: '38px',
                      width: `${width}px`,
                    }}
                  >
                    <div className="truncate">{domain.domain_id}</div>
                    <div className="text-gray-500">{range.start}-{range.end}</div>
                  </div>
                </div>
              );
            })}
          </React.Fragment>
        ))}

        {/* Binding sites */}
        {proteinData.features?.map((feature, idx) => {
          const width = Math.max(4, (feature.location.end - feature.location.start) * scale);
          const left = feature.location.start * scale + 16;
          return (
            <div
              key={`feature-${idx}`}
              className="absolute w-1 h-3 bg-red-500"
              style={{
                left: `${left}px`,
                width: `${width}px`,
                top: '4px',
              }}
              title={`${feature.type}: ${feature.location.start}-${feature.location.end}`}
            />
          );
        })}
      </div>
      
      {/* Legend */}
      <div className="flex flex-wrap gap-4 mt-4 text-sm">
        {proteinData.domains.map((domain, idx) => (
          <div key={`legend-${idx}`} className="flex items-center">
            <div 
              className="w-4 h-4 mr-2 rounded" 
              style={{ backgroundColor: getDomainColor(domain.domain_id) }}
            />
            <span>{domain.domain_id}</span>
          </div>
        ))}
        <div className="flex items-center">
          <div className="w-4 h-4 bg-red-500 mr-2" />
          <span>Binding Sites</span>
        </div>
      </div>
    </div>
  );
};

export default DomainVisualization;