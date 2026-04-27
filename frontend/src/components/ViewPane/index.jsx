import React, { useEffect, useRef, useState, lazy, Suspense } from 'react';
import ResultTable from '../ResultTable';

const LazyNetworkViewer3D = lazy(() => import('../NetworkViewer'));
const LazyNetworkViewer2D = lazy(() => import('../NetworkViewer2D'));
const LazySimpleGraphViewer = lazy(() => import('../SimpleGraphViewer'));
const LazyHypergraphTreeView = lazy(() => import('../HypergraphTreeView'));

const LoadingFallback = ({ label }) => (
  <div className="flex items-center justify-center h-full min-h-[200px] text-slate-500 dark:text-slate-400">
    <div className="flex flex-col items-center gap-2">
      <div className="w-6 h-6 border-2 border-slate-300 dark:border-slate-600/50 border-t-violet-400 rounded-full animate-spin" />
      <span className="text-xs">Loading {label}…</span>
    </div>
  </div>
);

const ViewPane = ({
  viewType,
  results,
  setResults,
  filteredResults,
  setFilteredResults,
  selectedRows,
  setSelectedRows,
  searchPairs,
  network2dRef,
  network3dRef,
  treeData,
  treeStats,
  treeSolutions,
}) => {
  const containerRef = useRef(null);
  const [measuredHeight, setMeasuredHeight] = useState(0);

  const safeResults = results || [];
  const safeFiltered = filteredResults || safeResults;

  // Measure the container so we can give network viewers a real pixel height
  useEffect(() => {
    const measure = () => {
      if (containerRef.current) {
        const h = containerRef.current.clientHeight;
        if (h > 0) setMeasuredHeight(h);
      }
    };
    measure();
    // Re-measure on resize and after short delay (for tray animations)
    window.addEventListener('resize', measure);
    const t1 = setTimeout(measure, 100);
    const t2 = setTimeout(measure, 350);
    return () => {
      window.removeEventListener('resize', measure);
      clearTimeout(t1);
      clearTimeout(t2);
    };
  }, [viewType]);

  // Fire resize when switching to a network view
  useEffect(() => {
    if (viewType === 'network2d' || viewType === 'network3d' || viewType === 'map' || viewType === 'tree') {
      const t = setTimeout(() => window.dispatchEvent(new Event('resize')), 150);
      return () => clearTimeout(t);
    }
  }, [viewType]);

  const pixelHeight = measuredHeight > 0 ? `${measuredHeight}px` : '600px';

  // Keep all views mounted to preserve state (positions, zoom, generation, etc.)
  // Use display:none to hide inactive views instead of unmounting them.
  // Table and Tree are lightweight so we conditionally render those.
  // 2D and 3D viewers are expensive to rebuild, so we always mount them once data exists.
  const has2dData = safeFiltered.length > 0;
  const hasMapData = safeFiltered.length > 0;
  const has3dData = safeFiltered.length > 0;

  return (
    <div ref={containerRef} className="h-full w-full overflow-hidden relative">
      {/* Table */}
      <div
        className="absolute inset-0 overflow-auto bg-white/90 dark:bg-slate-800/90"
        style={{ display: viewType === 'table' ? 'block' : 'none' }}
      >
        <div className="pt-16 pb-16">
          <ResultTable
            results={safeResults}
            setResults={setResults}
            filteredResults={safeFiltered}
            setFilteredResults={setFilteredResults}
            selectedRows={selectedRows}
            setSelectedRows={setSelectedRows}
            searchPairs={searchPairs}
          />
        </div>
      </div>

      {/* 2D Network — always mounted once data exists */}
      {has2dData && (
        <div
          className="absolute inset-0"
          style={{ display: viewType === 'network2d' ? 'block' : 'none' }}
        >
          <Suspense fallback={<LoadingFallback label="2D Network" />}>
            <LazyNetworkViewer2D
              ref={network2dRef}
              results={safeFiltered}
              searchPairs={searchPairs}
              height={pixelHeight}
            />
          </Suspense>
        </div>
      )}

      {/* Map (simple graph) — always mounted once data exists */}
      {hasMapData && (
        <div
          className="absolute inset-0"
          style={{ display: viewType === 'map' ? 'block' : 'none' }}
        >
          <Suspense fallback={<LoadingFallback label="Map" />}>
            <LazySimpleGraphViewer
              results={safeFiltered}
              searchPairs={searchPairs}
              height={pixelHeight}
            />
          </Suspense>
        </div>
      )}

      {/* 3D Network — always mounted once data exists */}
      {has3dData && (
        <div
          className="absolute inset-0"
          style={{ display: viewType === 'network3d' ? 'block' : 'none' }}
        >
          <Suspense fallback={<LoadingFallback label="3D Network" />}>
            <LazyNetworkViewer3D
              ref={network3dRef}
              results={safeFiltered}
              height={pixelHeight}
            />
          </Suspense>
        </div>
      )}

      {/* Tree — conditionally rendered (lightweight, no expensive state) */}
      {viewType === 'tree' && (
        <div className="absolute inset-0">
          <Suspense fallback={<LoadingFallback label="Tree View" />}>
            <LazyHypergraphTreeView
              treeData={treeData}
              height={pixelHeight}
              stats={treeStats}
              solutions={treeSolutions}
            />
          </Suspense>
        </div>
      )}
    </div>
  );
};

export default ViewPane;
