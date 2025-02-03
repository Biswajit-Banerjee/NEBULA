// Cache objects
const compoundCache = new Map();
const reactionCache = new Map();
const ecCache = new Map();

export const fetchCompoundData = async (compoundId) => {
  if (compoundCache.has(compoundId)) {
    return compoundCache.get(compoundId);
  }

  try {
    const response = await fetch(`/api/compound/${compoundId}`);
    if (!response.ok) {
      throw new Error('Failed to fetch compound data');
    }
    const data = await response.json();
    compoundCache.set(compoundId, data);
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
    const response = await fetch(`/api/reaction/${encodeURIComponent(equation)}`);
    if (!response.ok) {
      throw new Error('Failed to fetch reaction data');
    }
    const data = await response.json();
    reactionCache.set(equation, data);
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
    const response = await fetch(`/api/ec/${ecNumber}`);
    if (!response.ok) {
      throw new Error('Failed to fetch EC data');
    }
    const data = await response.json();
    ecCache.set(ecNumber, data);
    return data;
  } catch (error) {
    console.error('Error fetching EC data:', error);
    throw error;
  }
};