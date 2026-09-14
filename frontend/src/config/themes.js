
export const SEARCH_HIGHLIGHT_PALETTES = {
  'nebula-light': [
    '#8B5CF6', '#06B6D4', '#10B981', '#F59E0B', '#EF4444',
    '#3B82F6', '#059669', '#D97706', '#DC2626', '#7C3AED',
  ],

  'solar-corona': [
    '#95502D', '#61703D', '#456E73', '#806087', '#8B652B',
    '#975664', '#536D8B', '#726B4E', '#3C6B55', '#8D6250',
  ],

  'magnetar': [
    '#98BCF4', '#B3DBCE', '#E1C698', '#C0B2D9', '#DDA9BA',
    '#86CBD9', '#BCCB98', '#DEB19B', '#A3ADD9', '#A9C2C9',
  ],

  'event-horizon': [
    '#DEB77B', '#9CBADD', '#D79A8C', '#98CBB4', '#B4A5BE',
    '#C8CA97', '#D6A7B7', '#88BEC4', '#BDAD95', '#A7BCA2',
  ],

  'xenonite': [
    '#1C8FB5', '#D9A441', '#2E86AB', '#C6473F', '#2E9E6B',
    '#7C6E9F', '#0EA5C7', '#B9840F', '#7FD4E8', '#647587',
  ],

  'astrophage': [
    '#FF6A1A', '#2FE0C4', '#FFB020', '#FF4D4D', '#4FC3E0',
    '#FFD166', '#9B8BC4', '#4FD69C', '#FF9A44', '#FF8A4C',
  ],
};

export function getSolidColorForPairByIndex(
  index,
  themeId = DEFAULT_THEME
) {
  const palette =
    SEARCH_HIGHLIGHT_PALETTES[themeId] ??
    SEARCH_HIGHLIGHT_PALETTES[DEFAULT_THEME];

  const integerIndex = Number.isFinite(index) ? Math.trunc(index) : 0;

  // Wrap safely, including negative indices.
  const wrappedIndex =
    ((integerIndex % palette.length) + palette.length) % palette.length;

  return palette[wrappedIndex];
}

const rgb = (hex) => {
  const value = hex.replace('#', '');
  return [0, 2, 4]
    .map((offset) => Number.parseInt(value.slice(offset, offset + 2), 16))
    .join(' ');
};

const makeAstroTheme = ({ label, isDark, swatch, palette }) => ({
  label,
  isDark,
  swatch,
  colors: {
    'surface-primary': rgb(palette.surfacePrimary),
    'surface-secondary': rgb(palette.surfaceSecondary),
    'surface-elevated': rgb(palette.surfaceElevated),
    'surface-overlay': rgb(palette.surfaceOverlay),
    'surface-inset': rgb(palette.surfaceInset),

    'text-primary': rgb(palette.textPrimary),
    'text-secondary': rgb(palette.textSecondary),
    'text-muted': rgb(palette.textMuted),
    'text-inverse': rgb(palette.textInverse),

    'border-primary': rgb(palette.borderPrimary),
    'border-secondary': rgb(palette.borderSecondary),
    'border-focus': rgb(palette.brandPrimary),

    'brand-primary': rgb(palette.brandPrimary),
    'brand-primary-hover': rgb(palette.brandHover),
    'brand-secondary': rgb(palette.brandSecondary),
    'brand-gradient-from': rgb(palette.gradientFrom),
    'brand-gradient-via': rgb(palette.gradientVia),
    'brand-gradient-to': rgb(palette.gradientTo),

    'success': rgb(palette.success),
    'success-subtle': rgb(palette.successSubtle),
    'warning': rgb(palette.warning),
    'warning-subtle': rgb(palette.warningSubtle),
    'error': rgb(palette.error),
    'error-subtle': rgb(palette.errorSubtle),
    'info': rgb(palette.info),
    'info-subtle': rgb(palette.infoSubtle),

    'input-bg': rgb(palette.inputBg),
    'input-border': rgb(palette.borderSecondary),
    'input-focus': rgb(palette.brandPrimary),
    'btn-primary': rgb(palette.brandPrimary),
    'btn-text': rgb(palette.buttonText),

    'tree-metabolite': rgb(palette.compoundStroke),
    'tree-reaction': rgb(palette.reactionStroke),
    'tree-source': rgb(palette.source),
    'tree-seed': rgb(palette.seed),
    'tree-cofactor': rgb(palette.cofactor),
    'tree-solution': rgb(palette.solution),

    'node-compound-fill': rgb(palette.compoundFill),
    'node-compound-stroke': rgb(palette.compoundStroke),
    'node-reaction-fill': rgb(palette.reactionFill),
    'node-reaction-stroke': rgb(palette.reactionStroke),
    'node-ec-fill': rgb(palette.ecFill),
    'node-ec-stroke': rgb(palette.ecStroke),

    'accent-teal': rgb(palette.compoundStroke),
    'accent-indigo': rgb(palette.reactionStroke),
    'accent-amber': rgb(palette.warning),
    'accent-emerald': rgb(palette.success),
    'accent-cyan': rgb(palette.info),
    'accent-violet': rgb(palette.compatViolet),

    'scrollbar-track': rgb(palette.scrollbarTrack),
    'scrollbar-thumb': rgb(palette.scrollbarThumb),
    'scrollbar-thumb-hover': rgb(palette.scrollbarHover),

    'code-bg': rgb(palette.codeBg),
    'code-text': rgb(palette.codeText),
    'ring': rgb(palette.brandPrimary),
  },
});


export const THEMES = {
  // Crisp cool-white surfaces, violet→cyan brand gradient. Reads like a
  // contemporary SaaS product — high contrast, minimal warmth, fast to scan.
  'nebula-light': makeAstroTheme({
    label: 'Pulsar',
    isDark: false,
    swatch: {
      bg: '#F8F9FC',
      accent: '#7C5CFA',
      text: '#1B1E2B',
    },
    palette: {
      surfacePrimary: '#F8F9FC',
      surfaceSecondary: '#EFF1F6',
      surfaceElevated: '#FFFFFF',
      surfaceOverlay: '#FFFFFF',
      surfaceInset: '#E6E9F0',

      textPrimary: '#1B1E2B',
      textSecondary: '#4B5165',
      textMuted: '#6B7280',
      textInverse: '#FFFFFF',

      borderPrimary: '#E2E5EC',
      borderSecondary: '#C7CCD9',

      brandPrimary: '#7C5CFA',
      brandHover: '#9478FF',
      brandSecondary: '#06B6D4',
      gradientFrom: '#7C5CFA',
      gradientVia: '#A855F7',
      gradientTo: '#6366F1',

      success: '#10B981',
      successSubtle: '#E6FBF3',
      warning: '#F59E0B',
      warningSubtle: '#FEF6E7',
      error: '#EF4444',
      errorSubtle: '#FDECEC',
      info: '#3B82F6',
      infoSubtle: '#EAF1FE',

      compoundFill: '#CCFBF1',
      compoundStroke: '#0D9488',
      reactionFill: '#E4E4FF',
      reactionStroke: '#6366F1',
      ecFill: '#FEF3C7',
      ecStroke: '#D97706',

      source: '#22C55E',
      seed: '#3B82F6',
      cofactor: '#9CA3AF',
      solution: '#10B981',

      compatViolet: '#7C5CFA',
      scrollbarTrack: '#EFF1F6',
      scrollbarThumb: '#C7CCD9',
      scrollbarHover: '#9AA1B5',
      codeBg: '#EFF1F6',
      codeText: '#2A2E3D',
      inputBg: '#FFFFFF',
      buttonText: '#FFFFFF',
    },
  }),

  // Midnight cobalt with an ion-blue / teal pulse. Reads like a focused
  // late-night workspace — energetic without being loud.
  'magnetar': makeAstroTheme({
    label: 'Magnetar',
    isDark: true,
    swatch: {
      bg: '#0E1826',
      accent: '#6FA8F5',
      text: '#E4ECF5',
    },
    palette: {
      surfacePrimary: '#0E1826',
      surfaceSecondary: '#16243A',
      surfaceElevated: '#1E3049',
      surfaceOverlay: '#263A54',
      surfaceInset: '#0A121F',

      textPrimary: '#E4ECF5',
      textSecondary: '#AEC3D9',
      textMuted: '#93AAC2',
      textInverse: '#0E1826',

      borderPrimary: '#2E4560',
      borderSecondary: '#5E7A98',

      brandPrimary: '#6FA8F5',
      brandHover: '#93C0FA',
      brandSecondary: '#7FD9C6',
      gradientFrom: '#5C8FEC',
      gradientVia: '#7FBEF0',
      gradientTo: '#7FD9C6',

      success: '#6FCBA8',
      successSubtle: '#1B3A34',
      warning: '#E0B876',
      warningSubtle: '#3B3320',
      error: '#E48E9B',
      errorSubtle: '#3E2530',
      info: '#7FBEF0',
      infoSubtle: '#1B3350',

      compoundFill: '#2E5583',
      compoundStroke: '#8FC0F7',
      reactionFill: '#2F5148',
      reactionStroke: '#7FD9C6',
      ecFill: '#5C4A28',
      ecStroke: '#DEBB78',

      source: '#7ED0A9',
      seed: '#C7DCF0',
      cofactor: '#9FA4CF',
      solution: '#7FD9C6',

      compatViolet: '#A7B0EA',
      scrollbarTrack: '#101C2C',
      scrollbarThumb: '#3C5975',
      scrollbarHover: '#5E7FA0',
      codeBg: '#0C1826',
      codeText: '#A9C6E4',
      inputBg: '#0A121F',
      buttonText: '#0E1826',
    },
  }),

  // Warm parchment paper, burnished sienna, deep olive. Reads like an
  // annotated manuscript — familiar, low-glare, comfortable for long reading.
  'solar-corona': makeAstroTheme({
    label: 'Solar Corona',
    isDark: false,
    swatch: {
      bg: '#F4EEDD',
      accent: '#8B4A24',
      text: '#3B3320',
    },
    palette: {
      surfacePrimary: '#F4EEDD',
      surfaceSecondary: '#E8DFC5',
      surfaceElevated: '#FBF7EC',
      surfaceOverlay: '#FDFAF1',
      surfaceInset: '#DED2AE',

      textPrimary: '#3B3320',
      textSecondary: '#5E5440',
      textMuted: '#6B6047',
      textInverse: '#FFF9EC',

      borderPrimary: '#D2C4A0',
      borderSecondary: '#A28E63',

      brandPrimary: '#8B4A24',
      brandHover: '#713A1B',
      brandSecondary: '#55632F',
      gradientFrom: '#8B4A24',
      gradientVia: '#B4823E',
      gradientTo: '#6B7A46',

      success: '#4C6B32',
      successSubtle: '#E4E9D0',
      warning: '#7A5410',
      warningSubtle: '#EFE0B8',
      error: '#953A28',
      errorSubtle: '#F0D6CA',
      info: '#3D6474',
      infoSubtle: '#DCE6E6',

      compoundFill: '#E9CBA0',
      compoundStroke: '#8B5A2B',
      reactionFill: '#D4DCB9',
      reactionStroke: '#5C6B33',
      ecFill: '#CFDDD8',
      ecStroke: '#3E6E70',

      source: '#5F7A3F',
      seed: '#85602E',
      cofactor: '#786A50',
      solution: '#386350',

      compatViolet: '#7A6684',
      scrollbarTrack: '#E8DFC5',
      scrollbarThumb: '#AC9868',
      scrollbarHover: '#8A7550',
      codeBg: '#E9DFC3',
      codeText: '#5A4E30',
      inputBg: '#FBF7EC',
      buttonText: '#FFF9EC',
    },
  }),

  // Smoked charcoal, antique gold, a distant blue rim. Reads like a
  // book-lined study at night — quiet, weighty, distinguished.
  'event-horizon': makeAstroTheme({
    label: 'Event Horizon',
    isDark: true,
    swatch: {
      bg: '#171514',
      accent: '#D4A85B',
      text: '#EBE0CD',
    },
    palette: {
      surfacePrimary: '#171514',
      surfaceSecondary: '#201D1B',
      surfaceElevated: '#2A2622',
      surfaceOverlay: '#332D28',
      surfaceInset: '#100F0D',

      textPrimary: '#EBE0CD',
      textSecondary: '#C2B39C',
      textMuted: '#A99C87',
      textInverse: '#1A1613',

      borderPrimary: '#423A32',
      borderSecondary: '#7D6E5C',

      brandPrimary: '#D4A85B',
      brandHover: '#E4BE7C',
      brandSecondary: '#8AA6BE',
      gradientFrom: '#B8813F',
      gradientVia: '#D4A85B',
      gradientTo: '#8AA6BE',

      success: '#9DBB8C',
      successSubtle: '#26301F',
      warning: '#D0AA66',
      warningSubtle: '#382C18',
      error: '#D3897E',
      errorSubtle: '#3A2420',
      info: '#93AFC7',
      infoSubtle: '#212C36',

      compoundFill: '#62492F',
      compoundStroke: '#D9B876',
      reactionFill: '#3C4F62',
      reactionStroke: '#93AFC7',
      ecFill: '#5E3E38',
      ecStroke: '#CC8E7F',

      source: '#A5BC8C',
      seed: '#E3CB8E',
      cofactor: '#A69AAC',
      solution: '#8CBBA0',

      compatViolet: '#AC9AB6',
      scrollbarTrack: '#191714',
      scrollbarThumb: '#5A4F43',
      scrollbarHover: '#86765F',
      codeBg: '#100F0D',
      codeText: '#C0A97F',
      inputBg: '#100F0D',
      buttonText: '#1A1613',
    },
  }),
};

// Xenonite (light) = the crystalline Eridian ship hull — pale mint-teal
// surfaces with warm gold structural accents. Astrophage (dark) = carbon-
// black surfaces with a molten-orange stellar glow and a spectrometer-teal
// absorption-line accent.
Object.assign(THEMES, {
  'xenonite': makeAstroTheme({
    label: 'Xenonite',
    isDark: false,
    swatch: {
      bg: '#F5F9FC',
      accent: '#1C8FB5',
      text: '#16232E',
    },
    palette: {
      surfacePrimary: '#F5F9FC',
      surfaceSecondary: '#E6EEF4',
      surfaceElevated: '#FFFFFF',
      surfaceOverlay: '#FBFDFF',
      surfaceInset: '#D9E6EE',

      textPrimary: '#16232E',
      textSecondary: '#435666',
      textMuted: '#647587',
      textInverse: '#F5F9FC',

      borderPrimary: '#CFE0EA',
      borderSecondary: '#94B3C4',

      brandPrimary: '#1C8FB5',
      brandHover: '#187B9C',
      brandSecondary: '#D9A441',
      gradientFrom: '#0EA5C7',
      gradientVia: '#7FD4E8',
      gradientTo: '#D9A441',

      success: '#2E9E6B',
      successSubtle: '#E1F5EA',
      warning: '#B9840F',
      warningSubtle: '#FBEFD3',
      error: '#C6473F',
      errorSubtle: '#FBE2DF',
      info: '#2E86AB',
      infoSubtle: '#DFF0F7',

      compoundFill: '#CDEAF3',
      compoundStroke: '#1C8FB5',
      reactionFill: '#F1E2BE',
      reactionStroke: '#B9840F',
      ecFill: '#FCE2DC',
      ecStroke: '#C6473F',

      source: '#2E9E6B',
      seed: '#D9A441',
      cofactor: '#7F8FA0',
      solution: '#1C8FB5',

      compatViolet: '#7C6E9F',
      scrollbarTrack: '#E6EEF4',
      scrollbarThumb: '#A9C7D6',
      scrollbarHover: '#7FA3B8',
      codeBg: '#E8F1F6',
      codeText: '#175E77',
      inputBg: '#FFFFFF',
      buttonText: '#F5F9FC',
    },
  }),

  'astrophage': makeAstroTheme({
    label: 'Astrophage',
    isDark: true,
    swatch: {
      bg: '#0B0B0C',
      accent: '#FF6A1A',
      text: '#F2EDE6',
    },
    palette: {
      surfacePrimary: '#0B0B0C',
      surfaceSecondary: '#141415',
      surfaceElevated: '#1C1B1B',
      surfaceOverlay: '#242322',
      surfaceInset: '#050505',

      textPrimary: '#F2EDE6',
      textSecondary: '#B8AFA4',
      textMuted: '#8F877D',
      textInverse: '#0B0B0C',

      borderPrimary: '#2C2A28',
      borderSecondary: '#524C45',

      brandPrimary: '#FF6A1A',
      brandHover: '#FF8A4C',
      brandSecondary: '#2FE0C4',
      gradientFrom: '#FF3D00',
      gradientVia: '#FF8A1A',
      gradientTo: '#2FE0C4',

      success: '#4FD69C',
      successSubtle: '#123326',
      warning: '#FFB020',
      warningSubtle: '#3A2A0C',
      error: '#FF4D4D',
      errorSubtle: '#3A1414',
      info: '#4FC3E0',
      infoSubtle: '#0E2A33',

      compoundFill: '#3A2410',
      compoundStroke: '#FF9A44',
      reactionFill: '#123330',
      reactionStroke: '#2FE0C4',
      ecFill: '#331414',
      ecStroke: '#FF6A5C',

      source: '#4FD69C',
      seed: '#FFD166',
      cofactor: '#8F8B99',
      solution: '#2FE0C4',

      compatViolet: '#9B8BC4',
      scrollbarTrack: '#0F0F10',
      scrollbarThumb: '#3A3733',
      scrollbarHover: '#5C564E',
      codeBg: '#0A0A0A',
      codeText: '#FFB37A',
      inputBg: '#050505',
      buttonText: '#0B0B0C',
    },
  }),
});

export const THEME_IDS = Object.keys(THEMES);
export const DEFAULT_THEME = 'nebula-light';