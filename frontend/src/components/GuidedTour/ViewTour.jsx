import React, { useState, useCallback, useEffect, useRef } from 'react';
import { ChevronLeft, ChevronRight, X } from 'lucide-react';
import { VIEW_TOUR_MAP } from './viewTourSteps';

/**
 * ViewTour — a per-view in-depth guided tour, externally controlled.
 *
 * Props:
 *   viewId  — 'table' | 'network2d' | 'network3d' | 'map' | 'tree'
 *   active  — boolean, whether the tour is showing
 *   onClose — callback when the tour finishes or is dismissed
 */
const ViewTour = ({ viewId, active, onClose }) => {
  const steps = VIEW_TOUR_MAP[viewId];
  const [step, setStep] = useState(0);

  // Reset step when tour starts or view changes
  useEffect(() => {
    if (active) setStep(0);
  }, [active, viewId]);

  const close = useCallback(() => {
    setStep(0);
    onClose?.();
  }, [onClose]);

  const next = useCallback(() => {
    if (!steps) return;
    if (step < steps.length - 1) setStep(s => s + 1);
    else close();
  }, [step, steps, close]);

  const prev = useCallback(() => {
    setStep(s => (s > 0 ? s - 1 : s));
  }, []);

  // Stable refs for keyboard handler
  const nextRef = useRef(next);
  const prevRef = useRef(prev);
  const closeRef = useRef(close);
  useEffect(() => { nextRef.current = next; }, [next]);
  useEffect(() => { prevRef.current = prev; }, [prev]);
  useEffect(() => { closeRef.current = close; }, [close]);

  useEffect(() => {
    if (!active) return;
    const handler = (e) => {
      if (e.key === 'Escape') { closeRef.current(); return; }
      if (e.key === 'ArrowRight' || e.key === 'Enter') { nextRef.current(); return; }
      if (e.key === 'ArrowLeft') { prevRef.current(); return; }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [active]);

  if (!active || !steps || steps.length === 0) return null;

  const currentStep = steps[step];
  if (!currentStep) return null;
  const StepIcon = currentStep.icon;

  return (
    <div className="absolute bottom-16 right-4 z-50 w-[320px] max-w-[calc(100vw-120px)]
      pointer-events-auto">
      <div className="bg-surface-overlay/95 backdrop-blur-2xl border border-brd/50
        rounded-2xl shadow-2xl shadow-black/20 overflow-hidden">
        {/* Progress bar */}
        <div className="h-0.5 bg-surface-inset">
          <div
            className="h-full bg-brand transition-all duration-500 ease-out rounded-r-full"
            style={{ width: `${((step + 1) / steps.length) * 100}%` }}
          />
        </div>

        <div className="p-3.5">
          {/* Header */}
          <div className="flex items-center gap-2.5 mb-2">
            <div className="flex-shrink-0 w-7 h-7 rounded-lg bg-brand/10 flex items-center justify-center">
              <StepIcon className="w-3.5 h-3.5 text-brand" />
            </div>
            <div className="flex-1 min-w-0">
              <h3 className="text-[13px] font-bold text-content leading-tight">{currentStep.title}</h3>
              <span className="text-[9px] text-content-muted font-medium">
                {step + 1} of {steps.length}
              </span>
            </div>
            <button
              onClick={close}
              className="flex-shrink-0 p-1 rounded-md text-content-muted hover:text-content-secondary hover:bg-surface-inset/60 transition-all"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          </div>

          {/* Body */}
          <p className="text-[12px] text-content-secondary leading-relaxed mb-3">
            {currentStep.body}
          </p>

          {/* Nav */}
          <div className="flex items-center justify-between">
            {/* Dots */}
            <div className="flex items-center gap-1">
              {steps.map((_, i) => (
                <div
                  key={i}
                  className={`rounded-full transition-all duration-300 ${
                    i === step
                      ? 'w-3 h-1.5 bg-brand'
                      : i < step
                      ? 'w-1.5 h-1.5 bg-brand/40'
                      : 'w-1.5 h-1.5 bg-brd/60'
                  }`}
                />
              ))}
            </div>

            <div className="flex items-center gap-1">
              {step > 0 && (
                <button
                  onClick={prev}
                  className="flex items-center gap-0.5 px-2 py-1 rounded-md text-[10px] font-medium text-content-secondary hover:bg-surface-inset/70 transition-all"
                >
                  <ChevronLeft className="w-3 h-3" />
                  Back
                </button>
              )}
              <button
                onClick={next}
                className="flex items-center gap-0.5 px-3 py-1 rounded-md text-[10px] font-semibold bg-brand hover:bg-brand-hover text-content-inverse shadow-sm transition-all"
              >
                {step === steps.length - 1 ? 'Done' : 'Next'}
                {step < steps.length - 1 && <ChevronRight className="w-3 h-3" />}
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default ViewTour;
