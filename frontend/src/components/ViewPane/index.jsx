import React, { useEffect, useRef, useState, lazy, Suspense } from 'react';
import ResultTable from '../ResultTable';

const LazyNetworkViewer3D = lazy(() => import('../NetworkViewer'));
const LazyNetworkViewer2D = lazy(() => import('../NetworkViewer2D'));

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
    if (viewType === 'network2d' || viewType === 'network3d') {
      const t = setTimeout(() => window.dispatchEvent(new Event('resize')), 150);
      return () => clearTimeout(t);
    }
  }, [viewType]);

  const pixelHeight = measuredHeight > 0 ? `${measuredHeight}px` : '600px';

  if (viewType === 'table') {
    return (
      <div ref={containerRef} className="h-full overflow-auto bg-white/90 dark:bg-slate-800/90">
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
    );
  }

  if (viewType === 'network2d') {
    return (
      <div ref={containerRef} className="h-full w-full overflow-hidden">
        <Suspense fallback={<LoadingFallback label="2D Network" />}>
          <LazyNetworkViewer2D
            ref={network2dRef}
            results={safeFiltered}
            searchPairs={searchPairs}
            height={pixelHeight}
          />
        </Suspense>
      </div>
    );
  }

  if (viewType === 'network3d') {
    return (
      <div ref={containerRef} className="h-full w-full overflow-hidden">
        <Suspense fallback={<LoadingFallback label="3D Network" />}>
          <LazyNetworkViewer3D
            ref={network3dRef}
            results={safeFiltered}
            height={pixelHeight}
          />
        </Suspense>
      </div>
    );
  }

  return null;
};

export default ViewPane;
