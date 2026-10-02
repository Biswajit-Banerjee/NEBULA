import React, { useState, useCallback, useEffect, useRef } from 'react';
import { ChevronLeft, ChevronRight, X, BookOpen } from 'lucide-react';
import { VIEW_TOUR_MAP } from './viewTourSteps';
import MiniKey from '../Key/MiniKey';
import TextSizeControl from '../TextSize/TextSizeControl';
import { useTextScale } from '../../lib/textScale';
import { openDocs } from '../../lib/docsBus';

/**
 * ViewTour (Quick Help): a per-view, symbol-first tour, externally controlled.
 * Text is sized in em from the shared text-size setting.
 *
 * Props:
 *   viewId  — 'table' | 'network2d' | 'map' | 'tree'
 *   active  — boolean, whether the tour is showing
 *   onClose — callback when the tour finishes or is dismissed
 */
const ViewTour = ({ viewId, active, onClose }) => {
  const steps = VIEW_TOUR_MAP[viewId];
  const [step, setStep] = useState(0);
  const { fontSize } = useTextScale();

  useEffect(() => {
    if (active) setStep(0);
  }, [active, viewId]);

  const close = useCallback(() => {
    setStep(0);
    onClose?.();
  }, [onClose]);

  const next = useCallback(() => {
    if (!steps) return;
    if (step < steps.length - 1) setStep((s) => s + 1);
    else close();
  }, [step, steps, close]);

  const prev = useCallback(() => {
    setStep((s) => (s > 0 ? s - 1 : s));
  }, []);

  const nextRef = useRef(next);
  const prevRef = useRef(prev);
  const closeRef = useRef(close);
  useEffect(() => { nextRef.current = next; }, [next]);
  useEffect(() => { prevRef.current = prev; }, [prev]);
  useEffect(() => { closeRef.current = close; }, [close]);

  useEffect(() => {
    if (!active) return undefined;
    const handler = (e) => {
      if (e.key === 'Escape') { closeRef.current(); return; }
      if (e.key === 'ArrowRight' || e.key === 'Enter') { nextRef.current(); return; }
      if (e.key === 'ArrowLeft') { prevRef.current(); }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [active]);

  if (!active || !steps || steps.length === 0) return null;

  const currentStep = steps[step];
  if (!currentStep) return null;
  const StepIcon = currentStep.icon;

  return (
    <div
      className="absolute bottom-16 right-4 z-50 w-[22em] max-w-[calc(100vw-120px)] max-h-[calc(100%-5rem)] overflow-y-auto rounded-2xl pointer-events-auto"
      style={fontSize}
      role="dialog"
      aria-label={`Quick Help: ${currentStep.title}`}
    >
      <div className="bg-surface-overlay border border-brd/60 rounded-2xl shadow-2xl shadow-black/20 overflow-clip">
        <div className="h-1 bg-surface-inset">
          <div
            className="h-full bg-brand transition-all duration-500 ease-out rounded-r-full"
            style={{ width: `${((step + 1) / steps.length) * 100}%` }}
          />
        </div>

        <div className="p-3.5">
          <div className="flex items-center gap-2.5 mb-2">
            <div className="flex-shrink-0 w-[1.9em] h-[1.9em] rounded-lg bg-brand/10 flex items-center justify-center">
              <StepIcon className="w-[0.95em] h-[0.95em] text-brand" />
            </div>
            <div className="flex-1 min-w-0">
              <h3 className="font-bold text-content leading-tight" style={{ fontSize: '1.0625em' }}>{currentStep.title}</h3>
              <span className="text-content-muted font-medium" style={{ fontSize: '0.75em' }}>
                {step + 1} of {steps.length}
              </span>
            </div>
            <TextSizeControl label={false} className="flex-shrink-0" />
            <button
              onClick={close}
              className="flex-shrink-0 p-1 rounded-md text-content-muted hover:text-content-secondary hover:bg-surface-inset/60 transition-all"
              aria-label="Close Quick Help"
              title="Close (Esc)"
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          <p className="text-content-secondary leading-relaxed mb-3" style={{ fontSize: '0.9em' }}>
            {currentStep.body}
          </p>

          {currentStep.glyphs && <MiniKey ids={currentStep.glyphs} />}

          {currentStep.docSlug && (
            <button
              onClick={() => { close(); openDocs(currentStep.docSlug); }}
              className="mb-3 inline-flex items-center gap-1.5 font-semibold text-link hover:underline"
              style={{ fontSize: '0.82em' }}
            >
              <BookOpen className="w-[1.1em] h-[1.1em]" /> Learn more in the documentation
            </button>
          )}

          <div className="sticky bottom-0 -mx-3.5 -mb-3.5 flex items-center justify-between bg-surface-overlay px-3.5 pb-3.5 pt-2">
            <div className="flex items-center gap-1" aria-hidden="true">
              {steps.map((_, i) => (
                <div
                  key={i}
                  className={`rounded-full transition-all duration-300 ${
                    i === step ? 'w-3 h-1.5 bg-brand' : i < step ? 'w-1.5 h-1.5 bg-brand/40' : 'w-1.5 h-1.5 bg-brd/60'
                  }`}
                />
              ))}
            </div>

            <div className="flex items-center gap-1">
              {step > 0 && (
                <button
                  onClick={prev}
                  className="flex items-center gap-0.5 px-2 py-1 rounded-md font-medium text-content-secondary hover:bg-surface-inset/70 transition-all"
                  style={{ fontSize: '0.8em' }}
                >
                  <ChevronLeft className="w-[1em] h-[1em]" />
                  Back
                </button>
              )}
              <button
                onClick={next}
                className="flex items-center gap-0.5 px-3 py-1 rounded-md font-semibold bg-brand hover:bg-brand-hover text-content-inverse shadow-sm transition-all"
                style={{ fontSize: '0.8em' }}
              >
                {step === steps.length - 1 ? 'Done' : 'Next'}
                {step < steps.length - 1 && <ChevronRight className="w-[1em] h-[1em]" />}
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default ViewTour;
