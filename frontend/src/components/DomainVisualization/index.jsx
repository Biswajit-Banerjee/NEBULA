import React, { useEffect, useRef, useCallback } from 'react';

const DOMAIN_COLORS = {
  'nD1': '#90cdf4', 'nD2': '#9ae6b4', 'nD3': '#fbd38d', 'nD4': '#f687b3',
  'nD5': '#b794f4', 'nD6': '#76e4f7', 'nD7': '#feb2b2', 'nD8': '#e9d8fd',
  'nD9': '#fbb6ce', 'nD10': '#c6f6d5',
};

const getDomainColor = (domainId) => DOMAIN_COLORS[domainId] || '#a0aec0';

const DomainVisualization = ({ 
  proteinData, 
  selectedDomain, 
  setSelectedDomain, 
  selectedRange, 
  setSelectedRange,
  containerRef,
  scale,
  setScale,
  onDomainClick,
}) => {
  const vizRef = useRef(null);

  const findSequenceBounds = useCallback(() => {
    if (!proteinData?.domains) return { min: 0, max: 1000 };
    let min = Number.MAX_SAFE_INTEGER;
    let max = 0;
    proteinData.domains.forEach(domain => {
      domain.ranges.forEach(range => {
        min = Math.min(min, range.start);
        max = Math.max(max, range.end);
      });
    });
    min = Math.max(0, min);
    // Use protein sequence length if available, otherwise use max domain end
    const seqLen = proteinData.sequence?.length;
    if (seqLen && seqLen > max) max = seqLen;
    return { min: 1, max };
  }, [proteinData]);

  const updateScale = useCallback(() => {
    const el = vizRef.current;
    if (!el) return;
    const { min, max } = findSequenceBounds();
    const sequenceLength = max - min;
    if (sequenceLength <= 0) return;
    const availableWidth = el.offsetWidth - 32; // 16px padding each side
    if (availableWidth <= 0) return;
    setScale(availableWidth / sequenceLength);
  }, [proteinData, setScale, findSequenceBounds]);

  useEffect(() => {
    const el = vizRef.current;
    if (!el) return;
    updateScale();
    const ro = new ResizeObserver(() => updateScale());
    ro.observe(el);
    return () => ro.disconnect();
  }, [updateScale]);

  const { min: minPosition, max: maxPosition } = findSequenceBounds();

  const getPositionOnScale = (position) => {
    return (position - minPosition) * scale + 16;
  };

  const handleDomainClick = (domain, range) => {
    if (onDomainClick) {
      onDomainClick(domain, range);
    } else {
      setSelectedDomain(domain);
      setSelectedRange(range);
    }
  };

  // Split features into binding sites and active sites
  const allFeatures = proteinData?.features || [];
  const bindingSites = allFeatures.filter(f => (f.type || '').toLowerCase() !== 'active site');
  const activeSites = allFeatures.filter(f => (f.type || '').toLowerCase() === 'active site');

  const bindingSitePos = bindingSites.map(f => ({
    f, left: getPositionOnScale(f.location.start),
    width: Math.max(3, (f.location.end - f.location.start) * scale),
  }));
  const activeSitePos = activeSites.map(f => ({
    f, left: getPositionOnScale(f.location.start),
    width: Math.max(3, (f.location.end - f.location.start) * scale),
  }));

  // Layout constants – bar centre at 30px inside the container
  const BAR_TOP = 18;
  const BAR_H = 24;
  const BAR_CENTER = BAR_TOP + BAR_H / 2;       // 30
  const BS_H = 14;                                // binding site height
  const AS_H = 10;                                // active site height
  const LABEL_TOP = BAR_TOP + BAR_H + 4;          // 46

  return (
    <div ref={containerRef} className="w-full">
      <div className="relative bg-surface-inset/40 rounded-lg" ref={vizRef}
           style={{ padding: '16px 16px 42px', minHeight: '68px' }}>

        {/* Backbone */}
        <div className="absolute h-[4px] bg-brd/60 rounded-full"
             style={{ left: '16px', right: '16px', top: `${BAR_CENTER - 2}px` }} />

        {/* Domain blocks */}
        {proteinData?.domains?.map((domain, idx) =>
          domain.ranges.map((range, ri) => {
            const w = (range.end - range.start) * scale;
            const l = getPositionOnScale(range.start);
            const isSelected = selectedDomain?.domain_id === domain.domain_id
              && selectedRange?.start === range.start;
            return (
              <React.Fragment key={`d-${idx}-${ri}`}>
                <div
                  className={`absolute rounded cursor-pointer transition-all duration-150
                    ${isSelected ? 'ring-2 ring-offset-1 ring-brand/80 shadow-md' : 'hover:brightness-110'}`}
                  style={{ left: `${l}px`, width: `${Math.max(w, 8)}px`,
                           top: `${BAR_TOP}px`, height: `${BAR_H}px`,
                           backgroundColor: getDomainColor(domain.domain_id) }}
                  onClick={() => handleDomainClick(domain, range)}
                  title={`${domain.domain_id}: ${range.start}-${range.end}`}
                />
                {w > 30 && (
                  <div className="absolute text-[10px] text-center pointer-events-none font-semibold text-content truncate"
                       style={{ left: `${l}px`, top: `${LABEL_TOP}px`, width: `${Math.max(w, 30)}px` }}>
                    {domain.domain_id}
                  </div>
                )}
              </React.Fragment>
            );
          })
        )}

        {/* Binding sites – overlaid ON the bar, shorter than domains, hoverable */}
        {bindingSitePos.map((bp, i) => (
          <div key={`bs-${i}`} className="absolute rounded-sm cursor-help"
               style={{ left: `${bp.left}px`, width: `${Math.max(bp.width, 4)}px`,
                        top: `${BAR_CENTER - BS_H / 2}px`, height: `${BS_H}px`,
                        backgroundColor: '#ef4444', opacity: 0.8, zIndex: 2 }}
               title={`${bp.f.type}: residues ${bp.f.location.start}-${bp.f.location.end}`} />
        ))}

        {/* Active sites – overlaid ON the bar, even shorter, hoverable */}
        {activeSitePos.map((ap, i) => (
          <div key={`as-${i}`} className="absolute rounded-sm cursor-help"
               style={{ left: `${ap.left}px`, width: `${Math.max(ap.width, 4)}px`,
                        top: `${BAR_CENTER - AS_H / 2}px`, height: `${AS_H}px`,
                        backgroundColor: '#d97706', opacity: 0.85, zIndex: 3 }}
               title={`Active Site: ${ap.f.description || ''} – residue ${ap.f.location.start}`} />
        ))}

        {/* Position markers */}
        <div className="absolute left-4 text-[10px] text-content-muted" style={{ bottom: '6px' }}>{minPosition}</div>
        <div className="absolute right-4 text-[10px] text-content-muted" style={{ bottom: '6px' }}>{maxPosition}</div>
      </div>

      {/* Legend */}
      <div className="flex flex-wrap items-center gap-3 mt-2 px-1 text-[11px] text-content-secondary">
        {proteinData?.domains?.map((domain, idx) => {
          if (proteinData.domains.slice(0, idx).some(d => d.domain_id === domain.domain_id)) return null;
          return (
            <div key={`lg-${idx}`} className="flex items-center gap-1 cursor-pointer hover:opacity-80"
                 onClick={() => handleDomainClick(domain, domain.ranges?.[0])}>
              <div className="w-2.5 h-2.5 rounded-sm" style={{ backgroundColor: getDomainColor(domain.domain_id) }} />
              <span>{domain.domain_id}</span>
            </div>
          );
        })}
        {bindingSites.length > 0 && (
          <div className="flex items-center gap-1">
            <div className="w-2.5 h-2.5 rounded-sm" style={{ backgroundColor: '#ef4444' }} />
            <span>Binding Sites</span>
          </div>
        )}
        {activeSites.length > 0 && (
          <div className="flex items-center gap-1">
            <div className="w-2.5 h-2.5 rounded-sm" style={{ backgroundColor: '#d97706' }} />
            <span>Active Sites</span>
          </div>
        )}
      </div>
    </div>
  );
};

export default DomainVisualization;
