import { useSyncExternalStore, useCallback } from 'react';

/**
 * Shared text-size setting for the documentation, guided tour, Quick Help,
 * Key popovers and help overlays. One value, remembered across sessions.
 */
export const TEXT_SCALES = [0.8, 0.9, 1, 1.1, 1.25, 1.4, 1.6, 1.8, 2];
export const DEFAULT_SCALE_INDEX = 2;
const STORAGE_KEY = 'nebula-text-scale';

const clampIdx = (i) => Math.max(0, Math.min(TEXT_SCALES.length - 1, i));

const readStored = () => {
  try {
    const raw = Number(localStorage.getItem(STORAGE_KEY));
    const idx = TEXT_SCALES.indexOf(raw);
    return idx >= 0 ? idx : DEFAULT_SCALE_INDEX;
  } catch {
    return DEFAULT_SCALE_INDEX;
  }
};

let index = typeof window === 'undefined' ? DEFAULT_SCALE_INDEX : readStored();
const listeners = new Set();

const publish = () => {
  if (typeof document !== 'undefined') {
    document.documentElement.style.setProperty('--nebula-text-scale', String(TEXT_SCALES[index]));
  }
  try { localStorage.setItem(STORAGE_KEY, String(TEXT_SCALES[index])); } catch { /* storage unavailable */ }
  listeners.forEach((l) => l());
};

if (typeof document !== 'undefined') {
  document.documentElement.style.setProperty('--nebula-text-scale', String(TEXT_SCALES[index]));
}

const subscribe = (cb) => { listeners.add(cb); return () => listeners.delete(cb); };
const getSnapshot = () => index;

export const setTextScaleIndex = (i) => {
  const next = clampIdx(i);
  if (next === index) return;
  index = next;
  publish();
};

/** Returns { scale, index, percent, canInc, canDec, inc, dec, reset, fontSize }. */
export function useTextScale() {
  const idx = useSyncExternalStore(subscribe, getSnapshot, () => DEFAULT_SCALE_INDEX);
  const inc = useCallback(() => setTextScaleIndex(index + 1), []);
  const dec = useCallback(() => setTextScaleIndex(index - 1), []);
  const reset = useCallback(() => setTextScaleIndex(DEFAULT_SCALE_INDEX), []);
  const scale = TEXT_SCALES[idx];
  return {
    scale,
    index: idx,
    percent: Math.round(scale * 100),
    canInc: idx < TEXT_SCALES.length - 1,
    canDec: idx > 0,
    inc,
    dec,
    reset,
    /** Inline style for a container whose children are sized in `em`. */
    fontSize: { fontSize: `${16 * scale}px` },
  };
}
