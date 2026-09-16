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
} from "lucide-react";
import DomainVisualization from "../DomainVisualization";
import MolstarViewer, { getDomainColor } from "../MolstarViewer";
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
  const colors = {
    A: "bg-err-subtle text-err",
    X: "bg-info-subtle text-info",
    H: "bg-ok-subtle text-ok",
    T: "bg-brand/10 text-brand",
    F: "bg-warn-subtle text-warn",
    default: "bg-surface-inset text-content"
  };
  
  return (
    <span className={`inline-flex items-center justify-center w-5 h-5 rounded text-[10px] font-bold ${colors[type] || colors.default}`}>
      {type}
    </span>
  );
};

const DomainCell = ({ domain, proteinData, selectedRange, onSelectRange }) => {
  if (!domain || !proteinData) return null;

  const ranges = (domain.ranges || []).filter(r => r && typeof r.start === 'number')
    .sort((a, b) => a.start - b.start);
  if (ranges.length === 0) return null;

  const bindingSites = ranges.reduce((count, range) => count + (proteinData.features?.filter(
    (feature) =>
      feature.location.start >= range.start &&
      feature.location.end <= range.end
  ).length || 0), 0);

  const hierarchy = domain.f_id?.split(".") || [];
  const levels = [
    { badge: 'A', label: hierarchy[0] || "N/A" },
    { badge: 'X', label: hierarchy[1] || "N/A" },
    { badge: 'H', label: hierarchy[2] || "N/A" },
    { badge: 'T', label: hierarchy[3] || "N/A" },
    { badge: 'F', label: hierarchy[4] || "N/A" },
  ];

  const domainColor = getDomainColor(domain.domain_id);
  const isRangeSelected = (range) => selectedRange?.start === range.start && selectedRange?.end === range.end;
  const isDomainSelected = ranges.some(isRangeSelected);

  // Clicking anywhere on the card selects the domain, keeping whichever range
  // segment was last chosen (or the first one if none is active yet).
  const handleCardClick = () => {
    if (!onSelectRange) return;
    onSelectRange(ranges.find(isRangeSelected) || ranges[0]);
  };

  return (
    <div
      id={`domain-cell-${domain.domain_id}`}
      role="button"
      tabIndex={0}
      onClick={handleCardClick}
      onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); handleCardClick(); } }}
      className={`p-3 border rounded-lg transition-all duration-200 hover:shadow-md cursor-pointer
        ${isDomainSelected ? "ring-2 ring-inset ring-brand bg-brand/10 border-brand/40" : "border-brd/60 hover:bg-surface-inset/50 hover:border-brd"}`}
    >
      {/* Header row */}
      <div className="flex items-center justify-between mb-2 gap-2">
        <div className="flex items-center gap-2 min-w-0">
          <div className="w-3 h-3 rounded-sm flex-shrink-0" style={{ backgroundColor: domainColor }} />
          <span className="font-semibold text-sm text-content">{domain.domain_id}</span>
          {ranges.length > 1 && (
            <span className="text-[10px] text-content-muted bg-surface-inset/70 px-1.5 py-0.5 rounded-full flex-shrink-0" title="Disconnected segments">
              {ranges.length} segments
            </span>
          )}
        </div>
        <a
          href={`http://prodata.swmed.edu/ecod/af2_pdb/domain/${proteinData.primary_accession}_F1_${domain.domain_id}`}
          target="_blank"
          rel="noopener noreferrer"
          className="text-info hover:text-info p-1 rounded-full hover:bg-info-subtle flex-shrink-0"
          title="View in ECOD"
          onClick={(e) => e.stopPropagation()}
        >
          <ExternalLink className="w-3.5 h-3.5" />
        </a>
      </div>

      {/* Range chips – disconnected segments of the same domain, kept together */}
      <div className="flex items-center gap-1 mb-2 flex-wrap">
        {ranges.map((range, i) => (
          <button
            key={`${domain.domain_id}-range-${i}`}
            type="button"
            onClick={(e) => { e.stopPropagation(); onSelectRange && onSelectRange(range); }}
            className={`px-1.5 py-0.5 rounded text-[11px] font-mono transition-colors
              ${isRangeSelected(range)
                ? "bg-brand text-white"
                : "bg-surface-inset/70 text-content-secondary hover:bg-surface-inset"}`}
            title={`Residues ${range.start}-${range.end}`}
          >
            {range.start}–{range.end}
          </button>
        ))}
      </div>

      {/* Tags row */}
      <div className="flex items-center gap-1.5 mb-2 flex-wrap">
        <span className="bg-brand/10 text-brand px-1.5 py-0.5 rounded text-[11px]">
          {bindingSites} {bindingSites === 1 ? "site" : "sites"}
        </span>
        {domain.family_id && (
          <span className="bg-warn-subtle text-warn px-1.5 py-0.5 rounded text-[11px] font-mono" title="ECOD Family ID">
            {domain.family_id}
          </span>
        )}
      </div>

      {/* Compact hierarchy */}
      <div className="grid grid-cols-[auto_minmax(0,1fr)] gap-x-1.5 gap-y-0.5 text-[11px]">
        {levels.map((lv) => (
          <React.Fragment key={lv.badge}>
            <DomainBadge type={lv.badge} />
            <div className="break-words text-content-secondary leading-5">{lv.label}</div>
          </React.Fragment>
        ))}
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
      <div className="text-center py-8 bg-surface-inset/70 rounded-lg border border-dashed border-brd/70">
        <Info className="w-5 h-5 mx-auto mb-2 text-content-muted" />
        <p className="text-content-secondary text-sm">No domain information available</p>
      </div>
    );
  }

  // One card per unique domain id (a domain may have several disconnected ranges)
  const sortedDomains = [...domains]
    .filter(d => d.ranges?.some(r => r && typeof r.start === 'number'))
    .sort((a, b) => {
      const aStart = Math.min(...a.ranges.map(r => r.start));
      const bStart = Math.min(...b.ranges.map(r => r.start));
      return aStart - bStart;
    });

  return (
    <div className="flex flex-col gap-2 p-1">
      {sortedDomains.map((domain, index) => (
        <DomainCell
          key={`domain-${domain.domain_id}-${index}`}
          domain={domain}
          proteinData={proteinData}
          selectedRange={selectedDomain?.domain_id === domain.domain_id ? selectedRange : null}
          onSelectRange={(range) => onSelectDomain(domain, range)}
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
    <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs">
      {stats.map((stat, index) => (
        <div key={`stat-${index}`} className="flex items-center gap-1">
          <span className="text-content-muted">{stat.label}:</span>
          <span className="font-medium text-content">{stat.value}</span>
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
                 flex items-center justify-between gap-2 min-w-[240px] text-content"
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
        <div className="absolute z-50 mt-1 w-full bg-surface-overlay/95 border border-brd/70 rounded-md shadow-lg max-h-60 overflow-auto backdrop-blur-sm">
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

const SkeletonBlock = ({ className = '' }) => (
  <div className={`bg-surface-inset/70 rounded-md animate-pulse ${className}`} />
);

// Mirrors the real layout (header / sequence bar / cards + 3D viewer) so the
// page doesn't jump when the actual data arrives.
const ProteinViewerSkeleton = () => (
  <div className="w-full h-full flex flex-col overflow-hidden">
    <div className="bg-surface-inset/60 px-4 py-3 border border-brd/50 rounded-t-lg flex-shrink-0">
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-2">
        <div className="space-y-2 min-w-0">
          <SkeletonBlock className="h-5 w-40" />
          <div className="flex gap-3">
            <SkeletonBlock className="h-3 w-20" />
            <SkeletonBlock className="h-3 w-24" />
            <SkeletonBlock className="h-3 w-16" />
          </div>
        </div>
        <SkeletonBlock className="h-8 w-60" />
      </div>
    </div>

    <div className="border-x border-brd/50 px-4 py-2 flex-shrink-0">
      <SkeletonBlock className="h-16 w-full" />
    </div>

    <div className="border border-brd/50 border-t-0 rounded-b-lg flex-1 min-h-0 flex flex-row overflow-hidden">
      <div className="p-4 flex flex-col gap-2 border-r border-brd/40" style={{ width: '420px', flexShrink: 0 }}>
        <SkeletonBlock className="h-4 w-32 mb-1" />
        {[...Array(4)].map((_, i) => (
          <SkeletonBlock key={i} className="h-28 w-full" />
        ))}
      </div>
      <div className="p-4 flex-1 min-w-0 flex flex-col">
        <SkeletonBlock className="h-4 w-24 mb-3" />
        <SkeletonBlock className="flex-1 w-full" />
      </div>
    </div>
  </div>
);

const ErrorCard = ({ message, ecNumber }) => (
  <Card className="w-full max-w-md">
    <CardContent className="p-6">
      <div className="flex flex-col items-center gap-3 text-center">
        <AlertCircle className="w-8 h-8 text-err" />
        <h3 className="text-lg font-medium text-err">Data Error</h3>
        <p className="text-content-secondary">{message || `No protein data available for EC number: ${ecNumber}`}</p>
      </div>
    </CardContent>
  </Card>
);

const svgEsc = (s) =>
  String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

const generateProteinSVG = (proteinData, ecNumber) => {
  const domainColorMap = {
    nD1: '#90cdf4', nD2: '#9ae6b4', nD3: '#fbd38d', nD4: '#f687b3',
    nD5: '#b794f4', nD6: '#76e4f7', nD7: '#feb2b2', nD8: '#e9d8fd',
    nD9: '#fbb6ce', nD10: '#c6f6d5',
  };
  const getSvgDomainColor = (id) => domainColorMap[id] || '#a0aec0';

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
  const badgeX = PAD + (3 + ecNumber.length) * 14 + 8;
  parts.push(`<rect x="${badgeX}" y="26" width="86" height="22" fill="#dbeafe" rx="6"/>`);
  parts.push(`<text x="${badgeX + 43}" y="41" font-family="Arial, Helvetica, sans-serif" font-size="11.5" font-weight="600" fill="#1d4ed8" text-anchor="middle">Protein View</text>`);

  // Stats
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

  const barPanelH = 168;
  parts.push(`<rect x="${PAD - 16}" y="${y}" width="${vizW + 32}" height="${barPanelH}" fill="#ffffff" rx="10" stroke="#e2e8f0" stroke-width="1.5"/>`);

  const barY = y + 96;

  // Backbone
  parts.push(`<rect x="${PAD}" y="${barY}" width="${vizW}" height="4" fill="#cbd5e1" rx="2"/>`);

  // Domain blocks
  domains.forEach((domain) => {
    const color = getSvgDomainColor(domain.domain_id);
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

  // ── Active site lollipops ──
  activeSites.forEach((f) => {
    const ax  = getX(f.location.start);
    const desc = (f.description || '').trim();
    const stickTop = barY - 52;
    const dimCy    = stickTop - 9;
    parts.push(`<line x1="${ax}" y1="${barY - 1}" x2="${ax}" y2="${stickTop}" stroke="#d97706" stroke-width="1.5" stroke-linecap="round"/>`);
    parts.push(`<polygon points="${ax},${dimCy - 8} ${ax - 6},${dimCy} ${ax},${dimCy + 8} ${ax + 6},${dimCy}" fill="#d97706" opacity="0.95"/>`);
    parts.push(`<text x="${ax}" y="${dimCy - 13}" font-family="Arial, Helvetica, sans-serif" font-size="8" font-weight="700" fill="#b45309" text-anchor="middle">${f.location.start}</text>`);
    if (desc) {
      parts.push(`<text x="${ax}" y="${dimCy - 23}" font-family="Arial, Helvetica, sans-serif" font-size="7.5" font-style="italic" fill="#92400e" text-anchor="middle">${svgEsc(desc)}</text>`);
    }
  });

  // Position markers
  const posY = y + barPanelH - 12;
  parts.push(`<text x="${PAD}" y="${posY}" font-family="Arial, Helvetica, sans-serif" font-size="10" fill="#94a3b8">${minPos}</text>`);
  parts.push(`<text x="${W - PAD}" y="${posY}" font-family="Arial, Helvetica, sans-serif" font-size="10" fill="#94a3b8" text-anchor="end">${maxPos}</text>`);

  y += barPanelH + 14;

  // Legend
  const seenIds = new Set();
  const uniqueDomains = domains.filter(d => {
    if (seenIds.has(d.domain_id)) return false;
    seenIds.add(d.domain_id);
    return true;
  });
  let lx = PAD;
  uniqueDomains.forEach((domain) => {
    const color = getSvgDomainColor(domain.domain_id);
    parts.push(`<rect x="${lx}" y="${y - 9}" width="13" height="13" fill="${color}" rx="3" opacity="0.9"/>`);
    parts.push(`<text x="${lx + 18}" y="${y + 1}" font-family="Arial, Helvetica, sans-serif" font-size="11.5" fill="#475569">${svgEsc(domain.domain_id)}</text>`);
    lx += domain.domain_id.length * 7.5 + 34;
  });
  parts.push(`<line x1="${lx + 5}" y1="${y - 8}" x2="${lx + 5}" y2="${y + 2}" stroke="#ef4444" stroke-width="1.5" stroke-linecap="round"/>`);
  parts.push(`<circle cx="${lx + 5}" cy="${y - 11}" r="4" fill="#ef4444" opacity="0.9"/>`);
  parts.push(`<text x="${lx + 18}" y="${y + 1}" font-family="Arial, Helvetica, sans-serif" font-size="11.5" fill="#475569">Binding Site</text>`);
  if (activeSites.length > 0) {
    lx += Math.round('Binding Site'.length * 7.5) + 30;
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
    const domColor = getSvgDomainColor(domain.domain_id);

    const bs = features.filter(
      (f) => f.location.start >= range.start && f.location.end <= range.end
    );
    const hier = (domain.f_id || '').split('.');
    const lvls = [
      { badge: 'A', fill: '#fee2e2', text: '#b91c1c', label: hier[0] || 'N/A' },
      { badge: 'X', fill: '#dbeafe', text: '#1d4ed8', label: hier[1] || 'N/A' },
      { badge: 'H', fill: '#dcfce7', text: '#15803d', label: hier[2] || 'N/A' },
      { badge: 'T', fill: '#ede9fe', text: '#6d28d9', label: hier[3] || 'N/A' },
      { badge: 'F', fill: '#ffedd5', text: '#b45309', label: hier[4] || 'N/A' },
    ];

    parts.push(`<rect x="${cx + 2}" y="${cy + 3}" width="${CARD_W}" height="${CARD_H}" fill="#ddd6fe" rx="10" opacity="0.35"/>`);
    parts.push(`<rect x="${cx}" y="${cy}" width="${CARD_W}" height="${CARD_H}" fill="#faf5ff" rx="10" stroke="#c4b5fd" stroke-width="1.5"/>`);
    parts.push(`<rect x="${cx}" y="${cy + 10}" width="4" height="${CARD_H - 20}" fill="${domColor}" rx="2" opacity="0.85"/>`);

    parts.push(`<text x="${cx + 20}" y="${cy + 29}" font-family="Arial, Helvetica, sans-serif" font-size="15" font-weight="700" fill="#0f172a">${svgEsc(domain.domain_id)}</text>`);
    parts.push(`<text x="${cx + 20}" y="${cy + 46}" font-family="Arial, Helvetica, sans-serif" font-size="11" fill="#94a3b8">Position: ${range.start}\u2013${range.end}</text>`);

    parts.push(`<line x1="${cx + 14}" y1="${cy + 56}" x2="${cx + CARD_W - 14}" y2="${cy + 56}" stroke="#e9d8fd" stroke-width="1"/>`);

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

    parts.push(`<text x="${cx + 14}" y="${cy + 106}" font-family="Arial, Helvetica, sans-serif" font-size="11" font-weight="700" fill="#334155">Hierarchy:</text>`);
    const maxLabelChars = Math.floor((CARD_W - 66) / 7.2);
    lvls.forEach((lv, li) => {
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
  const [loadingProgress, setLoadingProgress] = useState({ loaded: 0, total: 0 });
  const viewerRef = useRef(null);
  const containerRef = useRef(null);
  const molstarRef = useRef(null);
  const isSmallScreen = useMediaQuery({ maxWidth: 768 });
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
      }
    }
  }, [data, selectedId]);

  // Auto-scroll to the selected domain card when it changes
  useEffect(() => {
    if (selectedDomain && selectedRange) {
      const el = document.getElementById(`domain-cell-${selectedDomain.domain_id}-${selectedRange.start}-${selectedRange.end}`);
      if (el) {
        el.scrollIntoView({ behavior: 'smooth', inline: 'center', block: 'nearest' });
      }
    }
  }, [selectedDomain, selectedRange]);

  const handleSelectDomain = (domain, range) => {
    setSelectedDomain(domain);
    setSelectedRange(range);
    // Focus the 3D viewer on this domain
    if (molstarRef.current) {
      molstarRef.current.focusDomain(range);
    }
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
    return <ProteinViewerSkeleton />;
  }

  if (error || !data || data.length === 0) {
    return (
      <div className="w-full h-full flex items-center justify-center">
        <ErrorCard message={error} ecNumber={ecNumber} />
      </div>
    );
  }

  return (
    <div className="w-full h-full mx-auto overflow-hidden flex flex-col" ref={viewerRef}>
      {/* ─── Row 1: Header ─── */}
      <div className="bg-surface-inset/60 px-4 py-3 border border-brd/50 rounded-t-lg flex-shrink-0">
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-2">
          {/* Left: EC info + stats */}
          <div className="space-y-1.5 min-w-0">
            <div className="flex items-center gap-2">
              <h2 className="text-lg font-semibold text-content">EC {ecNumber}</h2>
              <span className="bg-info-subtle text-info px-2 py-0.5 rounded text-[11px] font-medium">
                Protein View
              </span>
            </div>
            <ProteinStats proteinData={proteinData} />
          </div>
          
          {/* Right: Organism selector + action buttons */}
          <div className="flex items-center gap-2 flex-wrap flex-shrink-0">
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
            
            <div className="flex items-center gap-1">
              <button
                onClick={handleExportSVG}
                disabled={!proteinData}
                className="p-2 text-content-secondary hover:text-ok hover:bg-ok-subtle rounded-full transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
                title="Export as SVG"
              >
                <Download className="w-4 h-4" />
              </button>

              <a
                href={`https://www.uniprot.org/uniprotkb/${proteinData?.primary_accession}/entry`}
                target="_blank"
                rel="noopener noreferrer"
                className="p-2 text-content-secondary hover:text-info hover:bg-info-subtle rounded-full transition-colors"
                title="Open in UniProt"
              >
                <ExternalLink className="w-4 h-4" />
              </a>
            </div>
          </div>
        </div>
      </div>

      {/* ─── Sequence bar ─── */}
      {proteinData && (
        <div className="border-x border-brd/50 px-4 py-2 flex-shrink-0">
          <DomainVisualization
            proteinData={proteinData}
            selectedDomain={selectedDomain}
            setSelectedDomain={(d) => {
              setSelectedDomain(d);
              const range = d?.ranges?.[0];
              if (range) {
                setSelectedRange(range);
                if (molstarRef.current) molstarRef.current.focusDomain(range);
              }
            }}
            selectedRange={selectedRange}
            setSelectedRange={setSelectedRange}
            containerRef={containerRef}
            scale={scale}
            setScale={setScale}
            onDomainClick={handleSelectDomain}
          />
        </div>
      )}

      {/* ─── Body: domain cards + 3D viewer ─── */}
      {proteinData && (
        <div
          className={`border border-brd/50 border-t-0 rounded-b-lg flex-1 min-h-0 ${isSmallScreen ? 'flex flex-col overflow-y-auto' : 'flex flex-row'}`}
        >
          {/* Domain cards - scrollable, fixed width on desktop */}
          <div className={`p-4 flex flex-col overflow-hidden ${isSmallScreen ? 'border-b border-brd/40 flex-shrink-0' : 'border-r border-brd/40 min-h-0'}`}
               style={isSmallScreen ? { maxHeight: '45vh' } : { width: '420px', flexShrink: 0 }}>
            <div className="flex justify-between items-center mb-3 flex-shrink-0">
              <h3 className="font-medium text-content text-sm">Domain Information</h3>
              <span className="text-[11px] text-content-secondary bg-surface-inset/60 px-2 py-0.5 rounded">
                {proteinData.domains?.length || 0} domains
              </span>
            </div>
            <div className="flex-1 min-h-0 overflow-y-auto">
              <DomainGrid 
                domains={proteinData.domains}
                proteinData={proteinData}
                selectedDomain={selectedDomain}
                selectedRange={selectedRange}
                onSelectDomain={handleSelectDomain}
              />
            </div>
          </div>

          {/* 3D viewer - takes all remaining width */}
          <div className={`p-4 flex flex-col flex-1 min-w-0 ${isSmallScreen ? 'min-h-[400px]' : 'min-h-0'}`}>
            <div className="flex justify-between items-center mb-3 flex-shrink-0">
              <h3 className="font-medium text-content text-sm">3D Structure</h3>
              <span className="text-[11px] text-content-muted">AlphaFold DB</span>
            </div>
            <div className="flex-1 min-h-0">
              <MolstarViewer 
                ref={molstarRef}
                accession={proteinData.primary_accession}
                domains={proteinData.domains}
                features={proteinData.features}
              />
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default ProteinViewer;
