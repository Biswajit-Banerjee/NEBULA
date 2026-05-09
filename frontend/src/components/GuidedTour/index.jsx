import React, { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import { ChevronLeft, ChevronRight, Loader2, CheckCircle2, Pause, Play } from 'lucide-react';
import tourSteps from './tourSteps';

export const TOUR_SEEN_KEY = 'nebula-tour-seen';

/* ------------------------------------------------------------------ */
/* Tooltip positioning helpers                                         */
/* ------------------------------------------------------------------ */

function getTargetRect(selector) {
  if (!selector) return null;
  const el = document.querySelector(selector);
  if (!el) return null;
  return el.getBoundingClientRect();
}

function computeTooltipPos(placement, targetRect) {
  const pad = 20;
  const vw = window.innerWidth;
  const vh = window.innerHeight;

  // centre fallback
  if (placement === 'center' || !placement) {
    return { position: 'fixed', left: '50%', top: '50%', transform: 'translate(-50%, -50%)' };
  }

  // For view-guide steps: position card in corner, not blocking the view
  if (placement === 'top-right') {
    return { position: 'fixed', top: `${pad + 52}px`, right: `${pad}px` };
  }
  if (placement === 'top-left') {
    return { position: 'fixed', top: `${pad + 52}px`, left: `${pad}px` };
  }
  if (placement === 'bottom-right') {
    return { position: 'fixed', bottom: `${pad + 52}px`, right: `${pad}px` };
  }
  if (placement === 'bottom-left') {
    return { position: 'fixed', bottom: `${pad + 52}px`, left: `${pad}px` };
  }

  // Anchored to a target element
  if (placement === 'bottom' && targetRect) {
    let left = targetRect.left + targetRect.width / 2 - 190;
    if (left < pad) left = pad;
    if (left + 380 > vw - pad) left = vw - 380 - pad;
    return { position: 'fixed', left: `${left}px`, top: `${targetRect.bottom + 12}px` };
  }

  return { position: 'fixed', left: '50%', top: '50%', transform: 'translate(-50%, -50%)' };
}

/* ------------------------------------------------------------------ */
/* Main GuidedTour component                                          */
/* ------------------------------------------------------------------ */

/**
 * Props:
 *   active        — boolean, is tour running
 *   onEnd         — callback to close tour
 *   isLoading     — true while search is in progress
 *   hasResults    — true once results are loaded
 *   expandDock    — () => force-expand the floating dock
 *   collapseDock  — () => collapse the floating dock
 *   onSearch      — (pairs) => trigger a real search
 *   onViewChange  — (viewId) => switch the active view
 *   onSetSplit    — (bool) => enable/disable split mode
 *   onSetSecondaryView — (viewId) => set secondary view in split mode
 */
const GuidedTour = ({
  active, onEnd, isLoading, hasResults,
  expandDock, collapseDock,
  onSearch, onViewChange, onSetSplit, onSetSecondaryView,
}) => {
  const [step, setStep] = useState(0);
  const [targetRect, setTargetRect] = useState(null);
  const [waiting, setWaiting] = useState(false);
  const [paused, setPaused] = useState(false);
  const tooltipRef = useRef(null);
  const actionFiredRef = useRef(new Set());

  const currentStep = tourSteps[step];
  const totalSteps = tourSteps.length;
  const canPause = !!currentStep?.features; // only view steps are pausable

  // Reset state when tour starts/stops
  useEffect(() => {
    if (active) {
      setStep(0);
      setWaiting(false);
      setPaused(false);
      actionFiredRef.current = new Set();
    }
  }, [active]);

  const handlePause = useCallback(() => setPaused(true), []);
  const handleResume = useCallback(() => setPaused(false), []);

  /* ── Execute step actions ── */
  useEffect(() => {
    if (!active || !currentStep?.action) return;
    // Only fire each step's action once
    if (actionFiredRef.current.has(step)) return;
    actionFiredRef.current.add(step);

    const action = currentStep.action;

    if (action === 'search-c00025') {
      collapseDock?.();
      setWaiting(true);
      const tourPair = [{
        id: 'tour-c00025',
        mode: 'compound',
        source: '',
        target: 'C00025',
        reaction: '', ec: '',
        color: '#8B5CF6',
        visible: true,
        sourceDisplay: '',
        targetDisplay: 'L-Glutamate',
      }];
      onSearch?.(tourPair);
    } else if (action === 'view-table') {
      onSetSplit?.(false);
      onViewChange?.('table');
    } else if (action === 'view-network2d') {
      onSetSplit?.(false);
      onViewChange?.('network2d');
    } else if (action === 'view-network3d') {
      onSetSplit?.(false);
      onViewChange?.('network3d');
    } else if (action === 'view-map') {
      onSetSplit?.(false);
      onViewChange?.('map');
    } else if (action === 'view-tree') {
      onSetSplit?.(false);
      onViewChange?.('tree');
    } else if (action === 'split-table-2d') {
      onViewChange?.('table');
      onSetSecondaryView?.('network2d');
      onSetSplit?.(true);
    } else if (action === 'unsplit') {
      onSetSplit?.(false);
      onViewChange?.('table');
    }
  }, [active, step, currentStep, onSearch, onViewChange, onSetSplit, onSetSecondaryView, collapseDock]);

  /* ── Auto-advance past "waiting" step once results load ── */
  useEffect(() => {
    if (!active || !waiting) return;
    if (hasResults && !isLoading) {
      setWaiting(false);
      // small delay to let the table render
      const t = setTimeout(() => setStep(s => s + 1), 600);
      return () => clearTimeout(t);
    }
  }, [active, waiting, hasResults, isLoading]);

  /* ── Dock expand/collapse per step ── */
  useEffect(() => {
    if (!active) return;
    if (currentStep?.expandDock) expandDock?.();
    else collapseDock?.();
  }, [active, step, currentStep, expandDock, collapseDock]);

  /* ── Measure target for spotlight ── */
  const measureTarget = useCallback(() => {
    if (!currentStep?.target) { setTargetRect(null); return; }
    setTargetRect(getTargetRect(currentStep.target));
  }, [currentStep]);

  useEffect(() => {
    if (!active) return;
    measureTarget();
    const onResize = () => measureTarget();
    window.addEventListener('resize', onResize);
    return () => window.removeEventListener('resize', onResize);
  }, [active, step, measureTarget]);

  useEffect(() => {
    if (!active) return;
    const t1 = setTimeout(measureTarget, 150);
    const t2 = setTimeout(measureTarget, 400);
    return () => { clearTimeout(t1); clearTimeout(t2); };
  }, [active, step, measureTarget]);

  /* ── Navigation ── */
  const finish = useCallback(() => {
    try { localStorage.setItem(TOUR_SEEN_KEY, 'true'); } catch {}
    collapseDock?.();
    onSetSplit?.(false);
    setStep(0);
    setWaiting(false);
    setPaused(false);
    actionFiredRef.current = new Set();
    onEnd();
  }, [onEnd, collapseDock, onSetSplit]);

  const next = useCallback(() => {
    if (waiting) return; // don't advance while waiting for results
    setPaused(false);
    setStep(s => {
      if (s < totalSteps - 1) return s + 1;
      // Last step → finish
      try { localStorage.setItem(TOUR_SEEN_KEY, 'true'); } catch {}
      collapseDock?.();
      onSetSplit?.(false);
      setTimeout(() => onEnd(), 0);
      return 0;
    });
  }, [totalSteps, waiting, onEnd, collapseDock, onSetSplit]);

  const prev = useCallback(() => {
    if (waiting) return;
    setStep(s => {
      if (s <= 0) return s;
      const target = s - 1;
      // Allow view-switch actions to re-fire, but NOT the search action
      const targetAction = tourSteps[target]?.action;
      if (targetAction && targetAction !== 'search-c00025') {
        actionFiredRef.current.delete(target);
      }
      return target;
    });
  }, [waiting]);

  // Stable refs for keyboard
  const nextRef = useRef(next);
  const prevRef = useRef(prev);
  const finishRef = useRef(finish);
  useEffect(() => { nextRef.current = next; }, [next]);
  useEffect(() => { prevRef.current = prev; }, [prev]);
  useEffect(() => { finishRef.current = finish; }, [finish]);

  useEffect(() => {
    if (!active) return;
    const handler = (e) => {
      if (e.key === 'Escape') { finishRef.current(); return; }
      if (e.key === 'ArrowRight' || e.key === 'Enter') { nextRef.current(); return; }
      if (e.key === 'ArrowLeft') { prevRef.current(); return; }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [active]);

  /* ── Tooltip position ── */
  const tooltipStyle = useMemo(
    () => computeTooltipPos(currentStep?.placement, targetRect),
    [currentStep?.placement, targetRect]
  );

  if (!active || !currentStep) return null;

  const StepIcon = currentStep.icon;
  const showSpotlight = targetRect && currentStep.target && !paused;
  const isViewStep = !!currentStep.features;
  const isCenterStep = currentStep.placement === 'center';

  /* ── Paused: show only a small floating resume pill ── */
  if (paused) {
    return (
      <div className="fixed inset-0 z-[9999] pointer-events-none">
        <div className="fixed bottom-20 right-5 pointer-events-auto">
          <button
            onClick={handleResume}
            className="flex items-center gap-2 px-4 py-2.5 rounded-full
              bg-brand hover:bg-brand-hover text-content-inverse
              shadow-lg shadow-brand/25 hover:shadow-brand-hover/30
              text-xs font-semibold transition-all duration-200
              hover:scale-105 active:scale-95 animate-in fade-in-0 slide-in-from-right-4"
          >
            <Play className="w-3.5 h-3.5" />
            Resume Tour
            <span className="text-content-inverse/70 font-normal">
              ({step + 1}/{totalSteps})
            </span>
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 z-[9999] pointer-events-none">
      {/* Overlay — only for center/spotlight steps */}
      {isCenterStep && (
        <div
          className="absolute inset-0 bg-black/50 backdrop-blur-[2px] pointer-events-auto"
          onClick={finish}
        />
      )}

      {/* Spotlight ring for targeted elements */}
      {showSpotlight && (
        <>
          <div className="absolute inset-0 pointer-events-auto" onClick={finish} />
          <div
            className="absolute pointer-events-none rounded-2xl ring-2 ring-brand/60 transition-all duration-300"
            style={{
              left: targetRect.left - 8,
              top: targetRect.top - 8,
              width: targetRect.width + 16,
              height: targetRect.height + 16,
              boxShadow: '0 0 0 9999px rgba(0, 0, 0, 0.5), 0 0 30px 4px rgba(0, 0, 0, 0.25)',
            }}
          />
        </>
      )}

      {/* Tooltip card */}
      <div
        ref={tooltipRef}
        className={`pointer-events-auto ${isViewStep ? 'w-[340px]' : 'w-[400px]'} max-w-[calc(100vw-32px)]`}
        style={tooltipStyle}
      >
        <div className="bg-surface-overlay/95 backdrop-blur-2xl border border-brd/50 rounded-2xl shadow-2xl shadow-black/20 overflow-hidden">
          {/* Progress bar */}
          <div className="h-1 bg-surface-inset">
            <div
              className="h-full bg-brand transition-all duration-500 ease-out rounded-r-full"
              style={{ width: `${((step + 1) / totalSteps) * 100}%` }}
            />
          </div>

          <div className="p-4">
            {/* Icon + Title */}
            <div className="flex items-center gap-3 mb-2.5">
              <div className="flex-shrink-0 w-8 h-8 rounded-xl bg-brand/10 flex items-center justify-center">
                {waiting ? (
                  <Loader2 className="w-4 h-4 text-brand animate-spin" />
                ) : (
                  <StepIcon className="w-4 h-4 text-brand" />
                )}
              </div>
              <div className="flex-1 min-w-0">
                <h3 className="text-sm font-bold text-content leading-tight">{currentStep.title}</h3>
                <span className="text-[10px] text-content-muted font-medium">
                  Step {step + 1} of {totalSteps}
                </span>
              </div>
              {/* Pause button — only on view steps */}
              {canPause && !waiting && (
                <button
                  onClick={handlePause}
                  className="flex-shrink-0 p-1.5 rounded-lg text-content-muted hover:text-brand hover:bg-brand/10 transition-all"
                  title="Pause tour to explore this view"
                >
                  <Pause className="w-3.5 h-3.5" />
                </button>
              )}
            </div>

            {/* Body */}
            <p className="text-[13px] text-content-secondary leading-relaxed mb-3">
              {currentStep.body}
            </p>

            {/* Feature list for view steps */}
            {currentStep.features && (
              <div className="mb-3 space-y-1.5">
                {currentStep.features.map((feat, i) => (
                  <div key={i} className="flex items-start gap-2 text-xs text-content-secondary">
                    <CheckCircle2 className="w-3.5 h-3.5 text-ok flex-shrink-0 mt-0.5" />
                    <span>{feat}</span>
                  </div>
                ))}
              </div>
            )}

            {/* Pause hint for view steps */}
            {canPause && !waiting && (
              <p className="text-[10px] text-content-muted mb-2 italic">
                Press Pause to explore this view freely, then Resume when ready.
              </p>
            )}

            {/* Navigation */}
            <div className="flex items-center justify-between pt-1">
              <button
                onClick={finish}
                className="text-[11px] text-content-muted hover:text-content-secondary transition-colors px-2 py-1 rounded-lg hover:bg-surface-inset/60"
              >
                Skip tour
              </button>

              <div className="flex items-center gap-1.5">
                {/* Step dots */}
                <div className="flex items-center gap-1 mr-2">
                  {tourSteps.map((_, i) => (
                    <div
                      key={i}
                      className={`rounded-full transition-all duration-300 ${
                        i === step
                          ? 'w-3.5 h-1.5 bg-brand'
                          : i < step
                          ? 'w-1.5 h-1.5 bg-brand/40'
                          : 'w-1.5 h-1.5 bg-brd/60'
                      }`}
                    />
                  ))}
                </div>

                {step > 0 && !waiting && (
                  <button
                    onClick={prev}
                    className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-[11px] font-medium text-content-secondary hover:bg-surface-inset/70 transition-all"
                  >
                    <ChevronLeft className="w-3 h-3" />
                    Back
                  </button>
                )}
                {!waiting && (
                  <button
                    onClick={next}
                    className="flex items-center gap-1 px-3.5 py-1.5 rounded-lg text-[11px] font-semibold bg-brand hover:bg-brand-hover text-content-inverse shadow-sm transition-all"
                  >
                    {step === totalSteps - 1 ? 'Get Started' : 'Next'}
                    {step < totalSteps - 1 && <ChevronRight className="w-3 h-3" />}
                  </button>
                )}
                {waiting && (
                  <div className="flex items-center gap-1.5 px-3.5 py-1.5 text-[11px] font-medium text-content-muted">
                    <Loader2 className="w-3 h-3 animate-spin" />
                    Loading…
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default GuidedTour;
