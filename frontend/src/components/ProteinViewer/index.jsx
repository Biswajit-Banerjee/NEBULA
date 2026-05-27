import React, { useState, useEffect, useRef } from "react";
import { getApiUrl } from '../../config/api';
import { Card, CardContent } from "@/components/ui/card";
import { 
  Download, 
  X, 
  AlertCircle, 
  Info, 
  ChevronRight, 
  ExternalLink, 
  ZoomIn, 
  ZoomOut, 
  Maximize,
} from "lucide-react";
import DomainVisualization from "../DomainVisualization";
import { useMediaQuery } from 'react-responsive';

// Download the referenced element as a high-resolution PNG using html2canvas.
// Dynamically imports the library so the initial bundle stays lean.
const downloadAsImage = async (ref, filename) => {
  try {
    if (!ref?.current) return;

    // Lazy-load to avoid adding html2canvas into the first paint bundle.
    const html2canvas = (await import("html2canvas")).default;

    const canvas = await html2canvas(ref.current, {
      scale: 2,           // increase resolution
      useCORS: true,      // allow cross-origin images where possible
      backgroundColor: null, // preserve transparent backgrounds
    });

    canvas.toBlob((blob) => {
      if (!blob) return;
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = filename;
      link.click();
      URL.revokeObjectURL(url);
    }, "image/png");
  } catch (err) {
    console.error("Failed to download image", err);
  }
};

const DomainBadge = ({ type }) => {
  // Color mapping for different domain types
  const colors = {
    A: "bg-err-subtle text-err",
    X: "bg-info-subtle text-info",
    H: "bg-ok-subtle text-ok",
    T: "bg-brand/10 text-brand",
    F: "bg-warn-subtle text-warn",
    default: "bg-surface-inset text-content"
  };
  
  return (
    <span className={`px-2 py-1 rounded-md font-medium ${colors[type] || colors.default}`}>
      {type}
    </span>
  );
};

const DomainTag = ({ label, value, tooltip = "" }) => (
  <div className="flex items-center gap-1.5 text-xs">
    <span className="text-content-secondary">{label}:</span>
    <span className="font-medium truncate" title={tooltip || value}>
      {value || "N/A"}
    </span>
  </div>
);

const DomainCell = ({ domain, range, proteinData, isSelected, onClick }) => {
  if (!domain || !proteinData) return null;

  const bindingSites = proteinData.features?.filter(
    (feature) =>
      feature.location.start >= range.start &&
      feature.location.end <= range.end
  ).length || 0;

  const hierarchy = domain.f_id?.split(".") || [];
  
  const architectureInfo = hierarchy[0] || "N/A";
  const xClassInfo = hierarchy[1] || "N/A";
  const hClassInfo = hierarchy[2] || "N/A";
  const tClassInfo = hierarchy[3] || "N/A";
  const fClassInfo = hierarchy[4] || "N/A";

  return (
    <div 
      id={`domain-cell-${domain.domain_id}-${range.start}-${range.end}`}
      className={`p-5 border rounded-lg transition-all duration-200 hover:shadow-md text-base w-[280px] shrink-0 overflow-hidden flex flex-col cursor-pointer
        ${isSelected ? "ring-2 ring-brand bg-brand/10" : "hover:bg-surface-inset/50"}`}
      onClick={() => onClick && onClick(domain, range)}
    >
      <div className="flex justify-between items-start mb-3">
        <div>
          <div className="font-semibold">{domain.domain_id}</div>
          <div className="text-xs text-content-secondary mt-1">
            Position: {range.start}-{range.end}
          </div>
        </div>
        <a
          href={`http://prodata.swmed.edu/ecod/af2_pdb/domain/${proteinData.primary_accession}_F1_${domain.domain_id}`}
          target="_blank"
          rel="noopener noreferrer"
          className="text-info hover:text-info p-1 rounded-full hover:bg-info-subtle"
          title="View in ECOD"
          onClick={(e) => e.stopPropagation()}
        >
          <ExternalLink className="w-4 h-4" />
        </a>
      </div>

      <div className="flex flex-col gap-2 flex-1">
        <div className="flex items-center gap-1 flex-wrap">
          <span className="bg-brand/10 text-brand px-2 py-1 rounded text-xs">
            {bindingSites} {bindingSites === 1 ? "binding site" : "binding sites"}
          </span>
          {domain.family_id && (
            <span className="bg-warn-subtle text-warn px-2 py-1 rounded text-xs font-mono" title="ECOD Family ID">
              {domain.family_id}
            </span>
          )}
        </div>
        
        <div className="text-xs mt-1">
          <div className="text-content font-medium mb-1">Hierarchy:</div>
          <div className="grid grid-cols-[auto_minmax(0,1fr)] gap-x-1 gap-y-1">
            <DomainBadge type="A" />
            <div className="truncate" title={architectureInfo}>{architectureInfo}</div>
            
            <DomainBadge type="X" />
            <div className="truncate" title={xClassInfo}>{xClassInfo}</div>
            
            <DomainBadge type="H" />
            <div className="truncate" title={hClassInfo}>{hClassInfo}</div>
            
            <DomainBadge type="T" />
            <div className="truncate" title={tClassInfo}>{tClassInfo}</div>
            
            <DomainBadge type="F" />
            <div className="truncate" title={fClassInfo}>{fClassInfo}</div>
          </div>
        </div>
      </div>
    </div>
  );
};

const DomainGrid = ({ 
  domains = [], 
  proteinData, 
  selectedDomain, 
  selectedRange, 
  onSelectDomain 
}) => {
  if (!domains || !Array.isArray(domains) || domains.length === 0) {
    return (
      <div className="text-center py-6 bg-surface-inset/70 rounded-lg border border-dashed border-brd/70">
        <Info className="w-6 h-6 mx-auto mb-2 text-content-muted" />
        <p className="text-content-secondary">No domain information available</p>
      </div>
    );
  }

  // Create a flat array of all ranges with their domain info
  const ranges = [];
  domains.forEach(domain => {
    if (domain.ranges && Array.isArray(domain.ranges)) {
      domain.ranges.forEach(range => {
        if (range && typeof range.start === 'number') {
          ranges.push({ domain, range });
        }
      });
    }
  });

  // Sort ranges by start position
  const sortedRanges = ranges.sort((a, b) => a.range.start - b.range.start);

  const isSelected = (domain, range) => {
    return selectedDomain?.domain_id === domain.domain_id && 
           selectedRange?.start === range.start && 
           selectedRange?.end === range.end;
  };

  return (
    <div className="flex gap-4 overflow-x-auto pt-2 pb-4 px-1">
      {sortedRanges.map((item, index) => (
        <DomainCell
          key={`domain-${item.domain.domain_id}-${item.range.start}-${index}`}
          domain={item.domain}
          range={item.range}
          proteinData={proteinData}
          isSelected={isSelected(item.domain, item.range)}
          onClick={() => onSelectDomain(item.domain, item.range)}
        />
      ))}
    </div>
  );
};

const ProteinStats = ({ proteinData }) => {
  if (!proteinData) return null;
  
  const lengthVal = proteinData.sequence?.length || (() => {
    const ends = (proteinData.domains || []).flatMap(d => d.ranges?.map(r => r.end) || []);
    return ends.length ? Math.max(...ends) : "N/A";
  })();

  const stats = [
    { label: "Accession", value: proteinData.primary_accession },
    { label: "Organism", value: proteinData.organism_code?.toUpperCase() || "N/A" },
    { label: "Length", value: lengthVal },
    { label: "Features", value: proteinData.features?.length || 0 },
    { label: "Domains", value: proteinData.domains?.length || 0 }
  ];
  
  return (
    <div className="flex flex-wrap gap-x-6 gap-y-2 text-sm">
      {stats.map((stat, index) => (
        <div key={`stat-${index}`} className="flex items-center gap-1.5">
          <span className="text-content-muted">{stat.label}:</span>
          <span className="font-medium">{stat.value}</span>
        </div>
      ))}
    </div>
  );
};

const ProteinSelector = ({ data, selectedId, onChange }) => {
  const [isOpen, setIsOpen] = useState(false);
  
  if (!data || data.length === 0) return null;
  
  const selected = data.find(item => item.uniprot_kb_id === selectedId) || data[0];
  
  return (
    <div className="relative">
      <button
        className="border border-brd/80 rounded-md py-1.5 px-3 text-sm bg-surface-inset/80 hover:bg-surface-inset 
                 focus:ring-2 focus:ring-brand/40 focus:border-brand outline-none
                 flex items-center justify-between gap-2 min-w-[280px] text-content"
        onClick={() => setIsOpen(!isOpen)}
      >
        <div className="flex flex-col items-start">
          <span className="font-medium text-xs">{selected.uniprot_kb_id}</span>
          <div className="flex items-center gap-1.5">
            <span className="font-mono text-[11px] text-content-secondary">{selected.primary_accession}</span>
            {selected.organism_code && (
              <span className="bg-ok-subtle text-ok text-[10px] px-1.5 py-0.5 rounded font-medium uppercase">
                {selected.organism_code}
              </span>
            )}
          </div>
        </div>
        <ChevronRight className={`w-4 h-4 transition-transform ${isOpen ? 'rotate-90' : ''}`} />
      </button>
      
      {isOpen && (
        <div className="absolute z-10 mt-1 w-full bg-surface-overlay/95 border border-brd/70 rounded-md shadow-lg max-h-60 overflow-auto backdrop-blur-sm">
          {data.map((item) => (
            <div
              key={item.uniprot_kb_id}
              className={`px-3 py-2 cursor-pointer hover:bg-surface-inset/60 
                        ${item.uniprot_kb_id === selectedId ? 'bg-brand/10' : ''} text-content`}
              onClick={() => {
                onChange(item.uniprot_kb_id);
                setIsOpen(false);
              }}
            >
              <div className="text-sm font-medium">{item.uniprot_kb_id}</div>
              <div className="flex items-center gap-1.5 mt-0.5">
                <span className="font-mono text-[11px] text-content-secondary">{item.primary_accession}</span>
                {item.organism_code && (
                  <span className="bg-ok-subtle text-ok text-[10px] px-1.5 py-0.5 rounded font-medium uppercase">
                    {item.organism_code}
                  </span>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

const LoadingCard = () => (
  <Card className="w-full animate-pulse">
    <CardContent className="flex items-center justify-center h-64">
      <div className="flex items-center gap-3">
        <div className="w-2 h-2 bg-brand rounded-full animate-bounce [animation-delay:-0.3s]"></div>
        <div className="w-2 h-2 bg-brand rounded-full animate-bounce [animation-delay:-0.15s]"></div>
        <div className="w-2 h-2 bg-brand rounded-full animate-bounce"></div>
        <span className="text-brand font-medium ml-2">Loading protein data...</span>
      </div>
    </CardContent>
  </Card>
);

const ErrorCard = ({ message, ecNumber }) => (
  <Card className="w-full">
    <CardContent className="p-6">
      <div className="flex flex-col items-center gap-3 text-center">
        <AlertCircle className="w-8 h-8 text-err" />
        <h3 className="text-lg font-medium text-err">Data Error</h3>
        <p className="text-content-secondary">{message || `No protein data available for EC number: ${ecNumber}`}</p>
      </div>
    </CardContent>
  </Card>
);

const VisualizationControls = ({ scale, setScale, onReset }) => {
  return (
    <div className="flex items-center justify-end gap-2 my-2">
      <div className="bg-surface-inset/80 border border-brd/70 rounded-lg shadow-sm flex items-center divide-x divide-brd/70">
        <button 
          onClick={() => setScale(prev => Math.max(0.5, prev - 0.1))}
          className="p-1.5 hover:bg-surface-inset/70 rounded-l-lg"
          title="Zoom out"
        >
          <ZoomOut className="w-4 h-4" />
        </button>
        
        <div className="px-3 py-1 text-xs font-medium text-content">
          {Math.round(scale * 100)}%
        </div>
        
        <button 
          onClick={() => setScale(prev => Math.min(2, prev + 0.1))}
          className="p-1.5 hover:bg-surface-inset/70"
          title="Zoom in"
        >
          <ZoomIn className="w-4 h-4" />
        </button>
        
        <button 
          onClick={onReset}
          className="p-1.5 hover:bg-surface-inset/70 rounded-r-lg"
          title="Reset view"
        >
          <Maximize className="w-4 h-4" />
        </button>
      </div>
    </div>
  );
};

const DomainDetailPanel = ({ domain, range, proteinData, onClose }) => {
  if (!domain || !range || !proteinData) return null;

  const bindingSites = (proteinData.features || []).filter(
    (f) => f.location.start >= range.start && f.location.end <= range.end
  );

  return (
    <div className="bg-surface-inset/80 border border-brd/70 rounded-lg shadow-sm mt-2 p-3 max-h-96 overflow-y-auto">
      <div className="flex justify-between items-center mb-2">
        <h4 className="font-medium text-content text-sm">Domain Details</h4>
        <div className="text-xs bg-info-subtle text-info px-1.5 py-0.5 rounded">
          {bindingSites.length}
        </div>
      </div>

      {bindingSites.length === 0 ? (
        <div className="text-content-secondary text-xs text-center py-4">No binding sites detected.</div>
      ) : (
        <ul className="space-y-1 text-xs max-h-[8rem] overflow-y-auto pr-1">
          {bindingSites.map((site, idx) => (
            <li key={`site-${idx}`} className="flex justify-between gap-2 p-1 hover:bg-surface-inset/70 rounded">
              <span className="font-medium text-content">{site.location.start}</span>
              <span className="text-content-secondary truncate flex-1">{site.type || "N/A"}</span>
              {site.description && (
                <span className="text-content-muted truncate max-w-[120px]" title={site.description}>
                  {site.description}
                </span>
              )}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
};

const svgEsc = (s) =>
  String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

const generateProteinSVG = (proteinData, ecNumber) => {
  const domainColorMap = {
    nD1: '#90cdf4', nD2: '#9ae6b4', nD3: '#fbd38d', nD4: '#f687b3',
    nD5: '#b794f4', nD6: '#76e4f7', nD7: '#feb2b2', nD8: '#e9d8fd',
    nD9: '#fbb6ce', nD10: '#c6f6d5',
  };
  const getDomainColor = (id) => domainColorMap[id] || '#a0aec0';

  let minPos = Number.MAX_SAFE_INTEGER, maxPos = 0;
  (proteinData.domains || []).forEach(d =>
    (d.ranges || []).forEach(r => {
      minPos = Math.min(minPos, r.start);
      maxPos = Math.max(maxPos, r.end);
    })
  );
  if (minPos === Number.MAX_SAFE_INTEGER) { minPos = 0; maxPos = 1000; }

  const W = 860;
  const PAD = 48;
  const vizW = W - 2 * PAD;
  const sc = vizW / Math.max(maxPos - minPos, 1);
  const getX = (pos) => PAD + (pos - minPos) * sc;

  const features = proteinData.features || [];
  const bindingSites = features.filter(f => (f.type || '').toLowerCase() !== 'active site');
  const activeSites  = features.filter(f => (f.type || '').toLowerCase() === 'active site');
  const domains = proteinData.domains || [];
  const parts = [];
  let y = 0;

  // ── HEADER ────────────────────────────────────────────────
  const headerH = 114;
  parts.push(`<rect x="0" y="0" width="${W}" height="${headerH}" fill="#f1f5f9"/>`);
  parts.push(`<line x1="0" y1="${headerH}" x2="${W}" y2="${headerH}" stroke="#cbd5e1" stroke-width="1.5"/>`);

  // Title
  parts.push(`<text x="${PAD}" y="44" font-family="Arial, Helvetica, sans-serif" font-size="24" font-weight="700" fill="#0f172a">EC ${svgEsc(ecNumber)}</text>`);
  // "Protein View" badge – fixed offset after title text (~14px per char at size 24)
  const badgeX = PAD + (3 + ecNumber.length) * 14 + 8;
  parts.push(`<rect x="${badgeX}" y="26" width="86" height="22" fill="#dbeafe" rx="6"/>`);
  parts.push(`<text x="${badgeX + 43}" y="41" font-family="Arial, Helvetica, sans-serif" font-size="11.5" font-weight="600" fill="#1d4ed8" text-anchor="middle">Protein View</text>`);

  // Stats – 2 rows, 3 fixed columns each
  const lengthVal = proteinData.sequence?.length || maxPos;
  const COL_W = 190;
  const statsRow1 = [
    ['Accession', proteinData.primary_accession || 'N/A'],
    ['Organism', (proteinData.organism_code || 'N/A').toUpperCase()],
    ['Length', String(lengthVal)],
  ];
  const statsRow2 = [
    ['Features', String(features.length)],
    ['Domains', String(domains.length)],
  ];
  statsRow1.forEach(([label, val], i) => {
    parts.push(`<text x="${PAD + i * COL_W}" y="74" font-family="Arial, Helvetica, sans-serif" font-size="12.5" fill="#64748b">${svgEsc(label)}: <tspan font-weight="600" fill="#334155">${svgEsc(val)}</tspan></text>`);
  });
  statsRow2.forEach(([label, val], i) => {
    parts.push(`<text x="${PAD + i * COL_W}" y="96" font-family="Arial, Helvetica, sans-serif" font-size="12.5" fill="#64748b">${svgEsc(label)}: <tspan font-weight="600" fill="#334155">${svgEsc(val)}</tspan></text>`);
  });

  y = headerH + 28;

  // ── PROTEIN STRUCTURE SECTION ─────────────────────────────
  parts.push(`<text x="${PAD}" y="${y + 17}" font-family="Arial, Helvetica, sans-serif" font-size="15" font-weight="700" fill="#0f172a">Protein Structure</text>`);
  y += 32;

  // White panel behind the bar
  // barY is pushed down enough to give annotation space above the backbone
  const barPanelH = 168;
  parts.push(`<rect x="${PAD - 16}" y="${y}" width="${vizW + 32}" height="${barPanelH}" fill="#ffffff" rx="10" stroke="#e2e8f0" stroke-width="1.5"/>`);

  const barY = y + 96;

  // Backbone
  parts.push(`<rect x="${PAD}" y="${barY}" width="${vizW}" height="4" fill="#cbd5e1" rx="2"/>`);

  // Domain blocks – label inside block when wide enough, range below
  domains.forEach((domain) => {
    const color = getDomainColor(domain.domain_id);
    (domain.ranges || []).forEach((range) => {
      const dx = getX(range.start);
      const dw = Math.max(4, (range.end - range.start) * sc);
      const midX = dx + dw / 2;
      parts.push(`<rect x="${dx}" y="${barY - 12}" width="${dw}" height="28" fill="${color}" rx="4" opacity="0.92"/>`);
      if (dw >= 30) {
        parts.push(`<text x="${midX}" y="${barY + 7}" font-family="Arial, Helvetica, sans-serif" font-size="10" font-weight="600" fill="#1e293b" text-anchor="middle" opacity="0.8">${svgEsc(domain.domain_id)}</text>`);
      }
      parts.push(`<text x="${midX}" y="${barY + 30}" font-family="Arial, Helvetica, sans-serif" font-size="9.5" fill="#94a3b8" text-anchor="middle">${range.start}\u2013${range.end}</text>`);
    });
  });

  // ── Binding site lollipops ─────────────────────────────────
  // Two heights so closely-spaced sites don't collide
  const sortedBS = [...bindingSites].sort((a, b) => a.location.start - b.location.start);
  let lastBsX = -Infinity;
  let bsAlt = false;
  sortedBS.forEach((f) => {
    const bx = getX(f.location.start);
    bsAlt = (bx - lastBsX < 36) ? !bsAlt : false;
    lastBsX = bx;
    const stickTop = bsAlt ? barY - 38 : barY - 22;
    const circY   = stickTop - 5;
    parts.push(`<line x1="${bx}" y1="${barY - 1}" x2="${bx}" y2="${stickTop}" stroke="#ef4444" stroke-width="1.5" stroke-linecap="round"/>`);
    parts.push(`<circle cx="${bx}" cy="${circY}" r="4" fill="#ef4444" opacity="0.9"/>`);
    parts.push(`<text x="${bx}" y="${circY - 7}" font-family="Arial, Helvetica, sans-serif" font-size="8" font-weight="600" fill="#dc2626" text-anchor="middle">${f.location.start}</text>`);
  });

  // ── Active site lollipops (tallest layer, diamond heads + descriptions) ──
  activeSites.forEach((f) => {
    const ax  = getX(f.location.start);
    const desc = (f.description || '').trim();
    const stickTop = barY - 52;
    const dimCy    = stickTop - 9;   // diamond centre
    // Stick
    parts.push(`<line x1="${ax}" y1="${barY - 1}" x2="${ax}" y2="${stickTop}" stroke="#d97706" stroke-width="1.5" stroke-linecap="round"/>`);
    // Diamond (4-point polygon)
    parts.push(`<polygon points="${ax},${dimCy - 8} ${ax - 6},${dimCy} ${ax},${dimCy + 8} ${ax + 6},${dimCy}" fill="#d97706" opacity="0.95"/>`);
    // Residue position
    parts.push(`<text x="${ax}" y="${dimCy - 13}" font-family="Arial, Helvetica, sans-serif" font-size="8" font-weight="700" fill="#b45309" text-anchor="middle">${f.location.start}</text>`);
    // Functional description (italic, above position number)
    if (desc) {
      parts.push(`<text x="${ax}" y="${dimCy - 23}" font-family="Arial, Helvetica, sans-serif" font-size="7.5" font-style="italic" fill="#92400e" text-anchor="middle">${svgEsc(desc)}</text>`);
    }
  });

  // Position markers (min / max)
  const posY = y + barPanelH - 12;
  parts.push(`<text x="${PAD}" y="${posY}" font-family="Arial, Helvetica, sans-serif" font-size="10" fill="#94a3b8">${minPos}</text>`);
  parts.push(`<text x="${W - PAD}" y="${posY}" font-family="Arial, Helvetica, sans-serif" font-size="10" fill="#94a3b8" text-anchor="end">${maxPos}</text>`);

  y += barPanelH + 14;

  // Legend – unique domain IDs only
  const seenIds = new Set();
  const uniqueDomains = domains.filter(d => {
    if (seenIds.has(d.domain_id)) return false;
    seenIds.add(d.domain_id);
    return true;
  });
  let lx = PAD;
  uniqueDomains.forEach((domain) => {
    const color = getDomainColor(domain.domain_id);
    parts.push(`<rect x="${lx}" y="${y - 9}" width="13" height="13" fill="${color}" rx="3" opacity="0.9"/>`);
    parts.push(`<text x="${lx + 18}" y="${y + 1}" font-family="Arial, Helvetica, sans-serif" font-size="11.5" fill="#475569">${svgEsc(domain.domain_id)}</text>`);
    lx += domain.domain_id.length * 7.5 + 34;
  });
  // Binding site legend – mini lollipop (line + circle)
  parts.push(`<line x1="${lx + 5}" y1="${y - 8}" x2="${lx + 5}" y2="${y + 2}" stroke="#ef4444" stroke-width="1.5" stroke-linecap="round"/>`);
  parts.push(`<circle cx="${lx + 5}" cy="${y - 11}" r="4" fill="#ef4444" opacity="0.9"/>`);
  parts.push(`<text x="${lx + 18}" y="${y + 1}" font-family="Arial, Helvetica, sans-serif" font-size="11.5" fill="#475569">Binding Site</text>`);
  if (activeSites.length > 0) {
    lx += Math.round('Binding Site'.length * 7.5) + 30;
    // Active site legend – mini lollipop (line + diamond)
    parts.push(`<line x1="${lx + 5}" y1="${y - 8}" x2="${lx + 5}" y2="${y + 2}" stroke="#d97706" stroke-width="1.5" stroke-linecap="round"/>`);
    parts.push(`<polygon points="${lx + 5},${y - 19} ${lx},${y - 12} ${lx + 5},${y - 5} ${lx + 10},${y - 12}" fill="#d97706" opacity="0.95"/>`);
    parts.push(`<text x="${lx + 18}" y="${y + 1}" font-family="Arial, Helvetica, sans-serif" font-size="11.5" fill="#475569">Active Site (catalytic)</text>`);
  }

  y += 34;

  // ── DOMAIN INFORMATION SECTION ────────────────────────────
  parts.push(`<line x1="${PAD - 16}" y1="${y}" x2="${W - PAD + 16}" y2="${y}" stroke="#e2e8f0" stroke-width="1.5"/>`);
  y += 28;

  parts.push(`<text x="${PAD}" y="${y + 17}" font-family="Arial, Helvetica, sans-serif" font-size="15" font-weight="700" fill="#0f172a">Domain Information</text>`);
  const domCnt = domains.length;
  const pillLabel = `${domCnt} domain${domCnt !== 1 ? 's' : ''}`;
  const pillW = pillLabel.length * 7.2 + 20;
  parts.push(`<rect x="${W - PAD - pillW}" y="${y + 4}" width="${pillW}" height="20" fill="#f1f5f9" rx="10" stroke="#e2e8f0" stroke-width="1"/>`);
  parts.push(`<text x="${W - PAD - pillW / 2}" y="${y + 17}" font-family="Arial, Helvetica, sans-serif" font-size="11" fill="#64748b" text-anchor="middle">${svgEsc(pillLabel)}</text>`);
  y += 36;

  // Cards
  const pairs = [];
  domains.forEach((d) => (d.ranges || []).forEach((r) => pairs.push({ domain: d, range: r })));
  const COLS = Math.min(Math.max(pairs.length, 1), 2);
  const CARD_GAP = 20;
  const CARD_W = COLS > 1 ? (vizW - CARD_GAP) / 2 : Math.min(vizW, 420);
  const CARD_H = 244;
  const CARD_ROW_H = CARD_H + 20;

  pairs.forEach(({ domain, range }, i) => {
    const col = i % COLS;
    const row = Math.floor(i / COLS);
    const cx = PAD + col * (CARD_W + CARD_GAP);
    const cy = y + row * CARD_ROW_H;
    const domColor = getDomainColor(domain.domain_id);

    const bs = features.filter(
      (f) => f.location.start >= range.start && f.location.end <= range.end
    );
    const hier = (domain.f_id || '').split('.');
    const levels = [
      { badge: 'A', fill: '#fee2e2', text: '#b91c1c', label: hier[0] || 'N/A' },
      { badge: 'X', fill: '#dbeafe', text: '#1d4ed8', label: hier[1] || 'N/A' },
      { badge: 'H', fill: '#dcfce7', text: '#15803d', label: hier[2] || 'N/A' },
      { badge: 'T', fill: '#ede9fe', text: '#6d28d9', label: hier[3] || 'N/A' },
      { badge: 'F', fill: '#ffedd5', text: '#b45309', label: hier[4] || 'N/A' },
    ];

    // Soft drop-shadow
    parts.push(`<rect x="${cx + 2}" y="${cy + 3}" width="${CARD_W}" height="${CARD_H}" fill="#ddd6fe" rx="10" opacity="0.35"/>`);
    // Card body
    parts.push(`<rect x="${cx}" y="${cy}" width="${CARD_W}" height="${CARD_H}" fill="#faf5ff" rx="10" stroke="#c4b5fd" stroke-width="1.5"/>`);
    // Color accent stripe on the left
    parts.push(`<rect x="${cx}" y="${cy + 10}" width="4" height="${CARD_H - 20}" fill="${domColor}" rx="2" opacity="0.85"/>`);

    // Domain ID
    parts.push(`<text x="${cx + 20}" y="${cy + 29}" font-family="Arial, Helvetica, sans-serif" font-size="15" font-weight="700" fill="#0f172a">${svgEsc(domain.domain_id)}</text>`);
    parts.push(`<text x="${cx + 20}" y="${cy + 46}" font-family="Arial, Helvetica, sans-serif" font-size="11" fill="#94a3b8">Position: ${range.start}\u2013${range.end}</text>`);

    // Thin divider
    parts.push(`<line x1="${cx + 14}" y1="${cy + 56}" x2="${cx + CARD_W - 14}" y2="${cy + 56}" stroke="#e9d8fd" stroke-width="1"/>`);

    // Badges
    const bsText = `${bs.length} binding site${bs.length !== 1 ? 's' : ''}`;
    const bsBadgeW = Math.max(100, bsText.length * 6.8 + 18);
    parts.push(`<rect x="${cx + 14}" y="${cy + 64}" width="${bsBadgeW}" height="20" fill="#ede9fe" rx="5"/>`);
    parts.push(`<text x="${cx + 14 + bsBadgeW / 2}" y="${cy + 77}" font-family="Arial, Helvetica, sans-serif" font-size="10.5" font-weight="500" fill="#5b21b6" text-anchor="middle">${svgEsc(bsText)}</text>`);
    if (domain.family_id) {
      const fidX = cx + 14 + bsBadgeW + 8;
      const fidW = Math.max(60, domain.family_id.length * 7.8 + 18);
      parts.push(`<rect x="${fidX}" y="${cy + 64}" width="${fidW}" height="20" fill="#fef9c3" rx="5"/>`);
      parts.push(`<text x="${fidX + fidW / 2}" y="${cy + 77}" font-family="'Courier New', Courier, monospace" font-size="10.5" fill="#854d0e" text-anchor="middle">${svgEsc(domain.family_id)}</text>`);
    }

    // Hierarchy
    parts.push(`<text x="${cx + 14}" y="${cy + 106}" font-family="Arial, Helvetica, sans-serif" font-size="11" font-weight="700" fill="#334155">Hierarchy:</text>`);
    const maxLabelChars = Math.floor((CARD_W - 66) / 7.2);
    levels.forEach((lv, li) => {
      const ly = cy + 126 + li * 23;
      parts.push(`<rect x="${cx + 14}" y="${ly - 13}" width="20" height="17" fill="${lv.fill}" rx="4"/>`);
      parts.push(`<text x="${cx + 24}" y="${ly}" font-family="Arial, Helvetica, sans-serif" font-size="10" font-weight="700" fill="${lv.text}" text-anchor="middle">${lv.badge}</text>`);
      const label = lv.label.length > maxLabelChars ? lv.label.slice(0, maxLabelChars - 1) + '\u2026' : lv.label;
      parts.push(`<text x="${cx + 42}" y="${ly}" font-family="Arial, Helvetica, sans-serif" font-size="11" fill="#374151">${svgEsc(label)}</text>`);
    });
  });

  const totalRows = Math.ceil(pairs.length / COLS);
  const totalH = y + totalRows * CARD_ROW_H + 32;

  return (
    `<?xml version="1.0" encoding="UTF-8"?>` +
    `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${totalH}" viewBox="0 0 ${W} ${totalH}">` +
    `<rect width="${W}" height="${totalH}" fill="#f8fafc"/>` +
    parts.join('') +
    `</svg>`
  );
};

const ProteinViewer = ({ ecNumber, onClose }) => {
  const [data, setData] = useState(null);
  const [selectedId, setSelectedId] = useState("");
  const [proteinData, setProteinData] = useState(null);
  const [selectedDomain, setSelectedDomain] = useState(null);
  const [selectedRange, setSelectedRange] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [scale, setScale] = useState(1);
  const [showDomainDetails, setShowDomainDetails] = useState(false);
  const [activeTab, setActiveTab] = useState("visualization");
  const [loadingProgress, setLoadingProgress] = useState({ loaded: 0, total: 0 });
  const viewerRef = useRef(null);
  const containerRef = useRef(null);
  const isSmallScreen = useMediaQuery({ maxWidth: 768 });
  const domainScrollToRef = useRef(null);
  const abortRef = useRef(null);

  useEffect(() => {
    // Abort any in-flight background fetches when ecNumber changes or unmount
    if (abortRef.current) abortRef.current.abort();
    const controller = new AbortController();
    abortRef.current = controller;

    const fetchData = async () => {
      try {
        setLoading(true);
        setError(null);
        setData(null);
        setSelectedId("");
        setLoadingProgress({ loaded: 0, total: 0 });

        // Step 1: Instantly get the accession list (no UniProt API calls)
        const accRes = await fetch(getApiUrl(`ec/${ecNumber}/accessions`), { signal: controller.signal });
        if (!accRes.ok) throw new Error("Failed to fetch accession list");
        const accData = await accRes.json();
        const accessions = accData.data || [];

        if (accessions.length === 0) {
          setData([]);
          setLoading(false);
          return;
        }

        setLoadingProgress({ loaded: 0, total: accessions.length });

        // Step 2: Fetch the first accession and show it immediately
        const first = accessions[0];
        const firstRes = await fetch(
          getApiUrl(`accession/${first.accession}/domains?organism_code=${encodeURIComponent(first.organism_code || "")}`),
          { signal: controller.signal }
        );
        if (!firstRes.ok) throw new Error("Failed to fetch first entry");
        const firstData = await firstRes.json();

        if (firstData.data) {
          setData([firstData.data]);
          setSelectedId(firstData.data.uniprot_kb_id);
          setLoadingProgress({ loaded: 1, total: accessions.length });
        }
        setLoading(false);

        // Step 3: Fetch remaining accessions in the background
        for (let i = 1; i < accessions.length; i++) {
          if (controller.signal.aborted) break;
          const acc = accessions[i];
          try {
            const res = await fetch(
              getApiUrl(`accession/${acc.accession}/domains?organism_code=${encodeURIComponent(acc.organism_code || "")}`),
              { signal: controller.signal }
            );
            if (!res.ok) continue;
            const json = await res.json();
            if (json.data) {
              setData(prev => [...(prev || []), json.data]);
            }
          } catch (bgErr) {
            if (bgErr.name === 'AbortError') break;
            // Silently skip failed background fetches
          }
          setLoadingProgress(prev => ({ ...prev, loaded: i + 1 }));
        }
      } catch (err) {
        if (err.name === 'AbortError') return;
        console.error("Error loading data:", err);
        setError(err.message);
        setLoading(false);
      }
    };

    if (ecNumber) fetchData();

    return () => controller.abort();
  }, [ecNumber]);

  useEffect(() => {
    if (data && selectedId) {
      const selected = data.find((item) => item.uniprot_kb_id === selectedId);
      setProteinData(selected);

      // Automatically select the first domain (and its first range) if available
      if (selected?.domains?.length) {
        const firstDomain = selected.domains[0];
        const firstRange = firstDomain.ranges?.[0] || null;
        setSelectedDomain(firstDomain);
        setSelectedRange(firstRange);
        setShowDomainDetails(true);
      }
    }
  }, [data, selectedId]);

  // Auto-scroll to the selected domain card when it changes
  useEffect(() => {
    if (selectedDomain && selectedRange) {
      const el = document.getElementById(`domain-cell-${selectedDomain.domain_id}-${selectedRange.start}-${selectedRange.end}`);
      if (el) {
        el.scrollIntoView({ behavior: 'smooth', inline: 'center', block: 'center' });
      }
    }
  }, [selectedDomain, selectedRange]);

  const handleSelectDomain = (domain, range) => {
    setSelectedDomain(domain);
    setSelectedRange(range);
    setShowDomainDetails(true);
  };

  const handleDownload = () => {
    if (!viewerRef.current) return;
    downloadAsImage(viewerRef.current, `protein-view-${ecNumber}-${selectedId}.png`);
  };

  const resetView = () => {
    setScale(1);
    setSelectedDomain(null);
    setSelectedRange(null);
    setShowDomainDetails(false);
  };

  const handleExportSVG = () => {
    if (!proteinData) return;
    const svg = generateProteinSVG(proteinData, ecNumber);
    const blob = new Blob([svg], { type: 'image/svg+xml;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `protein-domains-${ecNumber}-${selectedId}.svg`;
    link.click();
    URL.revokeObjectURL(url);
  };

  if (loading) {
    return <LoadingCard />;
  }

  if (error || !data || data.length === 0) {
    return <ErrorCard message={error} ecNumber={ecNumber} />;
  }

  return (
    <Card className="w-full max-w-screen-xl mx-auto overflow-hidden border-brd/70">
      <CardContent ref={viewerRef} className="p-0">
        {/* Header Section */}
        <div className="bg-surface-inset/80 p-4 border-b border-brd/70">
          <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-2">
            <div className="space-y-2">
              <div className="flex items-center gap-2">
                <h2 className="text-xl font-semibold text-content">EC {ecNumber}</h2>
                <span className="bg-info-subtle text-info px-2 py-0.5 rounded text-xs font-medium">
                  Protein View
                </span>
              </div>
              
              <ProteinStats proteinData={proteinData} />
            </div>
            
            <div className="flex items-center gap-2">
              <ProteinSelector 
                data={data} 
                selectedId={selectedId} 
                onChange={setSelectedId}
              />
              {loadingProgress.total > 1 && loadingProgress.loaded < loadingProgress.total && (
                <span className="text-xs text-content-muted whitespace-nowrap animate-pulse">
                  {loadingProgress.loaded}/{loadingProgress.total}
                </span>
              )}
              
              <div className="flex items-center gap-2">
                <button
                  onClick={handleExportSVG}
                  disabled={!proteinData}
                  className="p-2 text-content-secondary hover:text-ok hover:bg-ok-subtle rounded-full transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
                  title="Export as SVG"
                >
                  <Download className="w-5 h-5" />
                </button>

                <a
                  href={`https://www.uniprot.org/uniprotkb/${proteinData?.primary_accession}/entry`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="p-2 text-content-secondary hover:text-info hover:bg-info-subtle rounded-full transition-colors"
                  title="Open in UniProt"
                >
                  <ExternalLink className="w-5 h-5" />
                </a>
                
                {onClose && (
                  <button
                    onClick={onClose}
                    className="p-2 text-content-secondary hover:text-err hover:bg-err-subtle 
                            rounded-full transition-colors"
                    title="Close"
                  >
                    <X className="w-5 h-5" />
                  </button>
                )}
              </div>
            </div>
          </div>
        </div>
        
        {/* Tab Navigation - For small screens */}
        {isSmallScreen && (
          <div className="bg-surface-inset/60 border-b border-brd/70">
            <div className="flex divide-x divide-brd/70">
              <button
                className={`flex-1 py-2 text-sm font-medium ${
                  activeTab === "visualization" 
                    ? "text-brand border-b-2 border-brand" 
                    : "text-content-secondary hover:text-content"
                }`}
                onClick={() => setActiveTab("visualization")}
              >
                Visualization
              </button>
              <button
                className={`flex-1 py-2 text-sm font-medium ${
                  activeTab === "domains" 
                    ? "text-brand border-b-2 border-brand" 
                    : "text-content-secondary hover:text-content"
                }`}
                onClick={() => setActiveTab("domains")}
              >
                Domains
              </button>
            </div>
          </div>
        )}

        {/* Main Content */}
        {proteinData && (
          <div className="p-4 grid gap-6 md:grid-cols-2">
            {/* Left Column - Visualization */}
            {(!isSmallScreen || activeTab === "visualization") && (
              <div className="space-y-4 min-w-0">
                <div className="space-y-3">
                  <div className="flex justify-between items-center">
                    <h3 className="font-medium text-content text-lg">Protein Structure</h3>
                    {/* <VisualizationControls 
                      scale={scale} 
                      setScale={setScale} 
                      onReset={resetView}
                    /> */}
                  </div>

                  <div className="relative">
                    <DomainVisualization
                      proteinData={proteinData}
                      selectedDomain={selectedDomain}
                      setSelectedDomain={setSelectedDomain}
                      selectedRange={selectedRange}
                      setSelectedRange={setSelectedRange}
                      containerRef={containerRef}
                      scale={scale}
                      setScale={setScale}
                      onDomainClick={handleSelectDomain}
                    />
                  </div>
                </div>

                {/* Domain Details Panel */}
                {showDomainDetails && (
                  <DomainDetailPanel
                    domain={selectedDomain}
                    range={selectedRange}
                    proteinData={proteinData}
                    onClose={() => setShowDomainDetails(false)}
                  />
                )}
              </div>
            )}

            {/* Right Column - Domains Grid */}
            {(!isSmallScreen || activeTab === "domains") && (
              <div className="space-y-4 self-end min-w-0 overflow-x-hidden">
                <div className="flex justify-between items-center">
                  <h3 className="font-medium text-content text-lg">Domain Information</h3>
                  <span className="text-xs text-content-secondary bg-surface-inset/60 px-2 py-1 rounded">
                    {proteinData.domains?.length || 0} domains
                  </span>
                </div>

                <DomainGrid 
                  domains={proteinData.domains}
                  proteinData={proteinData}
                  selectedDomain={selectedDomain}
                  selectedRange={selectedRange}
                  onSelectDomain={handleSelectDomain}
                />
              </div>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
};

export default ProteinViewer;