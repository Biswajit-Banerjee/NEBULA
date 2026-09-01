import { clsx } from "clsx"
import { twMerge } from "tailwind-merge"
import { getApiUrl } from '../config/api'
 
export function cn(...inputs) {
  return twMerge(clsx(inputs))
}

// Cache objects (bounded to prevent memory leaks)
const compoundCache = new Map();
const reactionCache = new Map();
const ecCache = new Map();
const MAX_CACHE_SIZE = 500;

const _boundedSet = (cache, key, value) => {
  if (cache.size >= MAX_CACHE_SIZE) cache.clear();
  cache.set(key, value);
};

export const fetchCompoundData = async (compoundId) => {
  if (compoundCache.has(compoundId)) {
    return compoundCache.get(compoundId);
  }

  try {
    const response = await fetch(getApiUrl(`compound/${compoundId}`));
    if (!response.ok) {
      throw new Error('Failed to fetch compound data');
    }
    const data = await response.json();
    _boundedSet(compoundCache, compoundId, data);
    return data;
  } catch (error) {
    console.error('Error fetching compound data:', error);
    throw error;
  }
};

export const fetchReactionData = async (equation) => {
  if (reactionCache.has(equation)) {
    return reactionCache.get(equation);
  }

  try {
    const response = await fetch(getApiUrl(`reaction/${encodeURIComponent(equation)}`));
    if (!response.ok) {
      throw new Error('Failed to fetch reaction data');
    }
    const data = await response.json();
    _boundedSet(reactionCache, equation, data);
    return data;
  } catch (error) {
    console.error('Error fetching reaction data:', error);
    throw error;
  }
};

export const fetchECData = async (ecNumber) => {
  if (ecCache.has(ecNumber)) {
    return ecCache.get(ecNumber);
  }

  try {
    const response = await fetch(getApiUrl(`ec/${ecNumber}`));
    if (!response.ok) {
      throw new Error('Failed to fetch EC data');
    }
    const data = await response.json();
    _boundedSet(ecCache, ecNumber, data);
    return data;
  } catch (error) {
    console.error('Error fetching EC data:', error);
    throw error;
  }
};