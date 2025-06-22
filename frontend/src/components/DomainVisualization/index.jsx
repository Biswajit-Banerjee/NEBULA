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

  const findSequenceBounds = () => {
    if (!proteinData?.domains) return { min: 0, max: 1000 };

    let min = Number.MAX_SAFE_INTEGER;
    let max = 0;

    proteinData.domains.forEach(domain => {
      domain.ranges.forEach(range => {
        min = Math.min(min, range.start);
        max = Math.max(max, range.end);
      });
    });

    // the real sequence length.
    min = Math.max(0, min);
    // max already represents the last residue position.

    return { min, max };
  };

  useEffect(() => {
    const updateScale = () => {
      if (containerRef.current) {
        const { min, max } = findSequenceBounds();
        const sequenceLength = max - min;
        const containerWidth = containerRef.current.offsetWidth - 48;
        const newScale = containerWidth / sequenceLength;
        setScale(newScale);
      }
    };

    updateScale();
    window.addEventListener('resize', updateScale);
    return () => window.removeEventListener('resize', updateScale);
  }, [proteinData, containerRef, setScale]);

  const { min: minPosition, max: maxPosition } = findSequenceBounds();

  const getPositionOnScale = (position) => {
    return (position - minPosition) * scale + 24;
  };

  return (
    <div className="mt-2" ref={containerRef}>
      <div className="relative h-24 bg-gray-100 rounded p-4">
        {/* Base protein line */}
        <div className="absolute top-8 left-4 h-1 bg-gray-300" style={{ width: 'calc(100% - 2rem)' }} />

        {/* Domains */}
        {proteinData?.domains?.map((domain, idx) => (
          <React.Fragment key={`domain-${idx}`}>
            {domain.ranges.map((range, rangeIdx) => {
              const width = (range.end - range.start) * scale;
              const left = getPositionOnScale(range.start);
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
                      top: '6px',
                      height: '20px',
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
                      top: '28px',
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
        {proteinData?.features?.map((feature, idx) => {
          const width = Math.max(4, (feature.location.end - feature.location.start) * scale);
          const left = getPositionOnScale(feature.location.start);
          return (
            <div
              key={`feature-${idx}`}
              className="absolute w-1 h-3 bg-red-500"
              style={{
                left: `${left}px`,
                width: `${width}px`,
                top: '0px',
              }}
              title={`${feature.type}: ${feature.location.start}-${feature.location.end}`}
            />
          );
        })}

        {/* Domain range scale */}
        <div className="absolute bottom-0 left-4 right-4 text-xs text-gray-500">
          <div className="absolute -bottom-4 left-0">{minPosition}</div>
          <div className="absolute -bottom-4 right-0">{maxPosition}</div>
        </div>
      </div>
      
      {/* Legend */}
      <div className="flex flex-wrap gap-4 mt-6 text-xs">
        {proteinData?.domains?.map((domain, idx) => (
          <div key={`legend-${idx}`} className="flex items-center">
            <div 
              className="w-3 h-3 mr-1.5 rounded" 
              style={{ backgroundColor: getDomainColor(domain.domain_id) }}
            />
            <span>{domain.domain_id}</span>
          </div>
        ))}
        <div className="flex items-center">
          <div className="w-3 h-3 bg-red-500 mr-1.5" />
          <span>Binding Sites</span>
        </div>
      </div>
    </div>
  );
};

export default DomainVisualization;