/**
 * Cofactor filtering and reaction deduplication utilities.
 *
 * When cofactors are hidden:
 *  1. Z compounds are stripped from equations, compound_generation, etc.
 *  2. Reactions that share the same base reaction ID AND identical
 *     C-compound stoichiometry (after Z removal) are merged into one.
 */

const Z_COMPOUND_RE = /Z\d{5}/;

/**
 * Strip Z-compound terms from an equation string.
 * e.g. "C00036 + Z00030 => C00022 + C00011 + Z00030"
 *   -> "C00036 => C00022 + C00011"
 */
function stripZFromEquation(eq) {
  if (!eq) return eq;
  const [lhs, rhs] = eq.split('=>').map(s => s.trim());
  const filterSide = (side) =>
    side
      .split('+')
      .map(t => t.trim())
      .filter(t => !Z_COMPOUND_RE.test(t))
      .join(' + ');
  const newLhs = filterSide(lhs || '');
  const newRhs = filterSide(rhs || '');
  return `${newLhs} => ${newRhs}`;
}

/**
 * Build a canonical key from the C-compound parts of an equation.
 * Parses stoichiometry, groups by compound, sorts deterministically.
 * e.g. "C00036 + C00036 + C00036 => C00022 + C00011 + C00022"
 *   -> "3 C00036 => 2 C00022 + 1 C00011"  (sorted)
 */
function canonicalCKey(eq) {
  if (!eq) return '';
  const [lhs, rhs] = eq.split('=>').map(s => (s || '').trim());

  const parseSide = (side) => {
    const counts = {};
    side.split('+').forEach(term => {
      const t = term.trim();
      if (!t) return;
      // Match optional stoichiometry coefficient + compound ID
      const m = t.match(/^(\d*\.?\d*)\s*([CZ]\d{5}.*)$/);
      const id = m ? m[2].trim() : t;
      if (Z_COMPOUND_RE.test(id)) return; // skip Z compounds
      const coeff = m && m[1] ? parseFloat(m[1]) : 1;
      counts[id] = (counts[id] || 0) + coeff;
    });
    return Object.entries(counts)
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([id, n]) => `${n} ${id}`)
      .join(' + ');
  };

  return `${parseSide(lhs)} => ${parseSide(rhs)}`;
}

/**
 * Extract the base reaction ID by stripping variant suffixes like _v1, _v2.
 * "R00217_v1" -> "R00217"
 * "R00217_v1_forward_123" -> "R00217"
 */
function baseReactionId(rxnName) {
  if (!rxnName) return rxnName;
  // Strip _v<N> and everything after
  return rxnName.replace(/_v\d+.*$/, '');
}

/**
 * Filter cofactors from results and deduplicate reaction variants.
 *
 * @param {Array} data - Array of reaction result objects from the API
 * @returns {Array} Filtered and deduplicated results
 */
export function filterCofactors(data) {
  if (!data || !Array.isArray(data) || data.length === 0) return data;

  // Pass 1: strip Z compounds from each row; drop reactions that become empty on either side
  const cleaned = [];
  data.forEach(row => {
    const newRow = { ...row };

    // Clean equation
    if (newRow.equation) {
      newRow.equation = stripZFromEquation(newRow.equation);

      // If either side of the equation is now empty, skip this reaction entirely
      const [lhs, rhs] = newRow.equation.split('=>').map(s => s.trim());
      if (!lhs || !rhs) return; // skip
    }

    // Clean compound_generation: remove Z keys
    if (newRow.compound_generation) {
      const cg = {};
      Object.entries(newRow.compound_generation).forEach(([k, v]) => {
        if (!Z_COMPOUND_RE.test(k)) cg[k] = v;
      });
      newRow.compound_generation = cg;
      newRow.max_generation = Object.keys(cg).length > 0
        ? Math.max(...Object.values(cg))
        : 0;
    }

    // Clean target field (comma-separated compound list)
    if (newRow.target && typeof newRow.target === 'string') {
      newRow.target = newRow.target
        .split(',')
        .map(t => t.trim())
        .filter(t => !Z_COMPOUND_RE.test(t))
        .join(', ');
    }

    cleaned.push(newRow);
  });

  // Pass 2: deduplicate variants with same base reaction ID + same C-compound stoichiometry
  const groups = new Map(); // key -> merged row

  cleaned.forEach(row => {
    const base = baseReactionId(row.reaction);
    const cKey = canonicalCKey(row.equation);
    const groupKey = `${base}||${cKey}`;

    if (!groups.has(groupKey)) {
      groups.set(groupKey, { ...row });
    } else {
      // Merge: combine ec_lists, keep first row's other fields
      const existing = groups.get(groupKey);
      if (row.ec_list && existing.ec_list) {
        const ecSet = new Set([
          ...(Array.isArray(existing.ec_list) ? existing.ec_list : []),
          ...(Array.isArray(row.ec_list) ? row.ec_list : []),
        ]);
        existing.ec_list = [...ecSet];
      }
      // Merge pairIndices if present
      if (row.pairIndex !== undefined && existing.pairIndices) {
        if (!existing.pairIndices.includes(row.pairIndex)) {
          existing.pairIndices.push(row.pairIndex);
        }
      }
    }
  });

  return [...groups.values()];
}
