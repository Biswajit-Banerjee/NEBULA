import React, { useEffect, useRef, useState, useCallback, useImperativeHandle, forwardRef, useContext, useMemo } from 'react';
import { AlertCircle, Loader2 } from 'lucide-react';
import { ThemeContext } from '../ThemeProvider/ThemeProvider';

const hexToRgb = (hex) => {
  const h = hex.replace('#', '');
  return {
    r: parseInt(h.substring(0, 2), 16),
    g: parseInt(h.substring(2, 4), 16),
    b: parseInt(h.substring(4, 6), 16),
  };
};

const DOMAIN_COLORS = {
  nD1: '#90cdf4', nD2: '#9ae6b4', nD3: '#fbd38d', nD4: '#f687b3',
  nD5: '#b794f4', nD6: '#76e4f7', nD7: '#feb2b2', nD8: '#e9d8fd',
  nD9: '#fbb6ce', nD10: '#c6f6d5',
};

const getDomainColor = (domainId) => DOMAIN_COLORS[domainId] || '#a0aec0';

const NON_DOMAIN_COLOR = { r: 140, g: 140, b: 140 };
const BINDING_SITE_COLOR = { r: 239, g: 68, b: 68 };   // #ef4444 red
const ACTIVE_SITE_COLOR = { r: 217, g: 119, b: 6 };    // #d97706 amber

// Stable bg color objects (avoid recreating every render)
const BG_DARK = { r: 26, g: 28, b: 42 };
const BG_LIGHT = { r: 233, g: 230, b: 222 };

const MolstarViewer = forwardRef(({ accession, domains, features }, ref) => {
  const containerRef = useRef(null);
  const pluginRef = useRef(null);
  const initedRef = useRef(false); // prevent double-init from StrictMode
  const [status, setStatus] = useState('idle'); // idle | loading | ready | error | no-structure
  const [errorMsg, setErrorMsg] = useState('');
  const { dark } = useContext(ThemeContext);

  // Theme-aware background color
  const bgColor = dark ? '#1a1c2a' : '#e9e6de';
  const molstarBg = dark ? BG_DARK : BG_LIGHT;

  // Stable reference to domains for coloring (only changes when content changes)
  const domainsKey = useMemo(() => JSON.stringify(domains?.map(d => d.domain_id) || []), [domains]);

  // Expose focusDomain method to parent
  useImperativeHandle(ref, () => ({
    focusDomain: (range) => {
      const inst = pluginRef.current;
      if (!inst) return;
      try { inst.visual.focus([{ struct_asym_id: 'A', start_residue_number: range.start, end_residue_number: range.end }]); } catch (_) {}
    },
    resetView: () => {
      const inst = pluginRef.current;
      if (!inst) return;
      try { inst.visual.reset({ camera: true, theme: false }); } catch (_) {}
    },
  }));

  const applyColoring = useCallback(async (instance, doms, feats) => {
    if (!instance) return;
    // Guard: check the plugin internals are actually ready
    try {
      if (!instance.plugin?.managers?.structure?.hierarchy?.current?.structures?.length) return;
    } catch (_) { return; }

    const selectionData = [];

    // Domain coloring first
    (doms || []).forEach((domain) => {
      const color = hexToRgb(getDomainColor(domain.domain_id));
      (domain.ranges || []).forEach((range) => {
        selectionData.push({
          struct_asym_id: 'A',
          start_residue_number: range.start,
          end_residue_number: range.end,
          color,
        });
      });
    });

    // Feature coloring (binding sites red, active sites amber) – applied after
    // domains so they override the domain color at those residues
    (feats || []).forEach((f) => {
      const isActive = (f.type || '').toLowerCase() === 'active site';
      selectionData.push({
        struct_asym_id: 'A',
        start_residue_number: f.location.start,
        end_residue_number: f.location.end,
        color: isActive ? ACTIVE_SITE_COLOR : BINDING_SITE_COLOR,
      });
    });

    if (selectionData.length === 0) return;

    try {
      await instance.visual.select({
        data: selectionData,
        nonSelectedColor: NON_DOMAIN_COLOR,
      });
    } catch (err) {
      console.warn('Failed to apply coloring:', err);
    }
  }, []);

  // Main init effect - only re-run when accession changes
  useEffect(() => {
    if (!accession || !containerRef.current) return;
    if (typeof window.PDBeMolstarPlugin === 'undefined') {
      setStatus('error');
      setErrorMsg('PDBe Molstar plugin not loaded');
      return;
    }

    // Prevent React StrictMode double-init
    if (initedRef.current) return;
    initedRef.current = true;

    let destroyed = false;
    const instance = new window.PDBeMolstarPlugin();
    pluginRef.current = instance;
    let renderStarted = false;

    const init = async () => {
      setStatus('loading');
      setErrorMsg('');

      try {
        // Fetch structure URL from AlphaFold DB
        const res = await fetch(`https://alphafold.ebi.ac.uk/api/prediction/${accession}`);
        if (destroyed) return;
        if (!res.ok) {
          if (res.status === 404) {
            setStatus('no-structure');
            return;
          }
          throw new Error(`AFDB API error: ${res.status}`);
        }

        const data = await res.json();
        if (destroyed) return;
        if (!data || data.length === 0) {
          setStatus('no-structure');
          return;
        }

        const entry = data[0];
        const structureUrl = entry.bcifUrl || entry.cifUrl;
        if (!structureUrl) {
          setStatus('no-structure');
          return;
        }

        const isBinary = !!entry.bcifUrl;
        const bgObj = dark ? BG_DARK : BG_LIGHT;
        const options = {
          customData: {
            url: structureUrl,
            format: 'cif',
            binary: isBinary,
          },
          visualStyle: 'cartoon',
          bgColor: bgObj,
          hideControls: true,
          hideCanvasControls: ['expand', 'animation', 'controlToggle', 'controlInfo'],
          landscape: true,
          reactive: true,
          sequencePanel: false,
          pdbeLink: false,
          loadingOverlay: true,
        };

        renderStarted = true;
        await instance.render(containerRef.current, options);
        if (destroyed) return;

        // Wait for the structure to load before applying coloring
        await new Promise((resolve, reject) => {
          let elapsed = 0;
          const MAX_WAIT = 30000;
          const check = () => {
            if (destroyed) { reject(new Error('destroyed')); return; }
            elapsed += 500;
            if (elapsed > MAX_WAIT) { resolve(); return; }
            try {
              if (instance.plugin?.managers?.structure?.hierarchy?.current?.structures?.length > 0) {
                resolve();
                return;
              }
            } catch (_) {}
            setTimeout(check, 500);
          };
          setTimeout(check, 1000);
        });
        if (destroyed) return;

        // Apply domain + feature coloring
        await applyColoring(instance, domains, features);
        if (destroyed) return;
        setStatus('ready');
      } catch (err) {
        if (destroyed || err.message === 'destroyed') return;
        console.error('MolstarViewer init error:', err);
        setStatus('error');
        setErrorMsg(err.message || 'Failed to load structure');
      }
    };

    init();

    return () => {
      destroyed = true;
      if (renderStarted && pluginRef.current) {
        try { pluginRef.current.clear(); } catch (_) {}
      }
      pluginRef.current = null;
      initedRef.current = false;
    };
    // Only re-init when accession changes - domains are applied separately
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [accession]);

  // Update bg color when theme changes (don't re-init the whole plugin)
  useEffect(() => {
    const inst = pluginRef.current;
    if (!inst || status !== 'ready') return;
    try {
      inst.canvas.setBgColor(molstarBg);
    } catch (_) {}
  }, [dark, molstarBg, status]);

  // Re-apply coloring when domains or features change
  useEffect(() => {
    if (status === 'ready' && pluginRef.current) {
      applyColoring(pluginRef.current, domains, features);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [domainsKey, status]);

  return (
    <div className="relative w-full rounded-lg overflow-hidden border border-brd/40"
         style={{ backgroundColor: bgColor, height: '100%', minHeight: '300px' }}>
      {/* Molstar container */}
      <div ref={containerRef} className="absolute inset-0" />

      {/* Loading overlay */}
      {status === 'loading' && (
        <div className="absolute inset-0 flex flex-col items-center justify-center z-10"
             style={{ backgroundColor: bgColor }}>
          <Loader2 className="w-8 h-8 text-brand animate-spin mb-3" />
          <span className="text-sm text-content-secondary">Loading 3D structure...</span>
          <span className="text-xs text-content-muted mt-1">Fetching from AlphaFold DB</span>
        </div>
      )}

      {/* No structure available */}
      {status === 'no-structure' && (
        <div className="absolute inset-0 flex flex-col items-center justify-center z-10">
          <AlertCircle className="w-8 h-8 text-content-muted mb-3" />
          <span className="text-sm text-content-secondary">No AlphaFold structure available</span>
          <span className="text-xs text-content-muted mt-1">for accession {accession}</span>
        </div>
      )}

      {/* Error state */}
      {status === 'error' && (
        <div className="absolute inset-0 flex flex-col items-center justify-center z-10">
          <AlertCircle className="w-8 h-8 text-err mb-3" />
          <span className="text-sm text-err">Failed to load structure</span>
          <span className="text-xs text-content-muted mt-1">{errorMsg}</span>
        </div>
      )}
    </div>
  );
});

MolstarViewer.displayName = 'MolstarViewer';

export default MolstarViewer;
export { getDomainColor, DOMAIN_COLORS, hexToRgb };
