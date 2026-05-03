// ═══════════════════════════════════════════════════════════════════════════════
// NEBULA Theme Registry
// ═══════════════════════════════════════════════════════════════════════════════
// Each theme defines ~80 design tokens as space-separated RGB values.
// Tailwind references them via  rgb(var(--token) / <alpha-value>)  so that
// opacity modifiers (e.g.  bg-surface/85 ) keep working.
//
// To add a new theme: copy any preset, change the RGB values, and register
// it in the THEMES object below. The ThemeProvider will pick it up automatically.
// ═══════════════════════════════════════════════════════════════════════════════

export const THEMES = {
  /* ─────────────────────── Nebula Light (default) ─────────────────────── */
  'nebula-light': {
    label: 'Nebula Light',
    isDark: false,
    // Preview swatch colors (hex) used in the selector UI
    swatch: { bg: '#D6D1C7', accent: '#8b5cf6', text: '#1e293b' },
    colors: {
      // ── Surface ──
      'surface-primary':   '214 209 199',   // #D6D1C7 warm stone
      'surface-secondary': '224 220 212',   // slightly lighter stone
      'surface-elevated':  '230 226 219',   // lifted stone
      'surface-overlay':   '224 220 212',   // stone (use with /85 etc.)
      'surface-inset':     '204 199 189',   // darker stone inset

      // ── Text ──
      'text-primary':   '30 41 59',          // slate-800 — high contrast
      'text-secondary': '71 85 105',         // slate-600
      'text-muted':     '100 116 139',       // slate-500
      'text-inverse':   '255 255 255',       // white

      // ── Border ──
      'border-primary':   '226 232 240',    // slate-200
      'border-secondary': '203 213 225',    // slate-300
      'border-focus':     '139 92 246',     // violet-500

      // ── Brand / Accent ──
      'brand-primary':       '139 92 246',  // violet-500
      'brand-primary-hover': '167 139 250', // violet-400
      'brand-secondary':     '6 182 212',   // cyan-500
      'brand-gradient-from': '139 92 246',  // violet-500
      'brand-gradient-via':  '168 85 247',  // purple-500
      'brand-gradient-to':   '99 102 241',  // indigo-500

      // ── Semantic ──
      'success':        '16 185 129',       // emerald-500
      'success-subtle': '236 253 245',      // emerald-50
      'warning':        '245 158 11',       // amber-500
      'warning-subtle': '255 251 235',      // amber-50
      'error':          '239 68 68',        // red-500
      'error-subtle':   '254 242 242',      // red-50
      'info':           '59 130 246',       // blue-500
      'info-subtle':    '239 246 255',      // blue-50

      // ── Interactive ──
      'input-bg':     '224 220 212',        // matches surface-secondary
      'input-border': '203 213 225',        // slate-300
      'input-focus':  '139 92 246',         // violet-500
      'btn-primary':  '139 92 246',         // violet-500
      'btn-text':     '255 255 255',        // white

      // ── Tree view ──
      'tree-metabolite': '6 182 212',       // cyan-500
      'tree-reaction':   '139 92 246',      // violet-500
      'tree-source':     '34 197 94',       // green-500
      'tree-seed':       '59 130 246',      // blue-500
      'tree-cofactor':   '168 162 158',     // stone-400
      'tree-solution':   '16 185 129',      // emerald-500

      // ── 2D Network node type colors ──
      'node-compound-fill':   '204 251 241',// teal-100
      'node-compound-stroke': '13 148 136', // teal-600
      'node-reaction-fill':   '224 231 255',// indigo-100
      'node-reaction-stroke': '79 70 229',  // indigo-600
      'node-ec-fill':         '254 243 199',// amber-100
      'node-ec-stroke':       '217 119 6',  // amber-600

      // ── Accent palette (UI chips, badges, pills) ──
      'accent-teal':    '20 184 166',       // teal-500
      'accent-indigo':  '99 102 241',       // indigo-500
      'accent-amber':   '245 158 11',       // amber-500
      'accent-emerald': '16 185 129',       // emerald-500
      'accent-cyan':    '6 182 212',        // cyan-500
      'accent-violet':  '139 92 246',       // violet-500

      // ── Scrollbar ──
      'scrollbar-track':      '204 199 189',// stone inset
      'scrollbar-thumb':      '148 163 184',// slate-400
      'scrollbar-thumb-hover':'100 116 139',// slate-500

      // ── Misc ──
      'code-bg':   '204 199 189',           // stone inset
      'code-text': '30 41 59',              // slate-800
      'ring':      '139 92 246',            // violet-500
    },
  },

  /* ─────────────────────── Nebula Dark ─────────────────────── */
  'nebula-dark': {
    label: 'Nebula Dark',
    isDark: true,
    swatch: { bg: '#1a1c2a', accent: '#a78bfa', text: '#cbd5e1' },
    colors: {
      'surface-primary':   '26 28 42',
      'surface-secondary': '30 41 59',      // slate-800
      'surface-elevated':  '30 41 59',
      'surface-overlay':   '30 41 59',
      'surface-inset':     '15 23 42',      // slate-900

      'text-primary':   '203 213 225',      // slate-300
      'text-secondary': '148 163 184',      // slate-400
      'text-muted':     '100 116 139',      // slate-500
      'text-inverse':   '15 23 42',         // slate-900

      'border-primary':   '51 65 85',       // slate-700
      'border-secondary': '71 85 105',      // slate-600
      'border-focus':     '167 139 250',    // violet-400

      'brand-primary':       '167 139 250', // violet-400
      'brand-primary-hover': '196 181 253', // violet-300
      'brand-secondary':     '34 211 238',  // cyan-400
      'brand-gradient-from': '167 139 250', // violet-400
      'brand-gradient-via':  '192 132 252', // purple-400
      'brand-gradient-to':   '129 140 248', // indigo-400

      'success':        '52 211 153',       // emerald-400
      'success-subtle': '6 78 59',          // emerald-900
      'warning':        '251 191 36',       // amber-400
      'warning-subtle': '120 53 15',        // amber-900
      'error':          '248 113 113',      // red-400
      'error-subtle':   '127 29 29',        // red-900
      'info':           '96 165 250',       // blue-400
      'info-subtle':    '30 58 138',        // blue-900

      'input-bg':     '51 65 85',           // slate-700
      'input-border': '71 85 105',          // slate-600
      'input-focus':  '167 139 250',        // violet-400
      'btn-primary':  '167 139 250',        // violet-400
      'btn-text':     '15 23 42',           // slate-900

      'tree-metabolite': '34 211 238',      // cyan-400
      'tree-reaction':   '167 139 250',     // violet-400
      'tree-source':     '74 222 128',      // green-400
      'tree-seed':       '96 165 250',      // blue-400
      'tree-cofactor':   '168 162 158',     // stone-400
      'tree-solution':   '52 211 153',      // emerald-400

      'node-compound-fill':   '13 148 136', // teal-600 (used at 0.3 alpha)
      'node-compound-stroke': '45 212 191', // teal-400
      'node-reaction-fill':   '79 70 229',  // indigo-600 (used at 0.25 alpha)
      'node-reaction-stroke': '129 140 248',// indigo-400
      'node-ec-fill':         '217 119 6',  // amber-600 (used at 0.25 alpha)
      'node-ec-stroke':       '251 191 36', // amber-400

      'accent-teal':    '45 212 191',       // teal-400
      'accent-indigo':  '129 140 248',      // indigo-400
      'accent-amber':   '251 191 36',       // amber-400
      'accent-emerald': '52 211 153',       // emerald-400
      'accent-cyan':    '34 211 238',       // cyan-400
      'accent-violet':  '167 139 250',      // violet-400

      'scrollbar-track':      '30 41 59',   // slate-800
      'scrollbar-thumb':      '100 116 139',// slate-500
      'scrollbar-thumb-hover':'148 163 184',// slate-400

      'code-bg':   '30 41 59',              // slate-800
      'code-text': '203 213 225',           // slate-300
      'ring':      '167 139 250',           // violet-400
    },
  },

  /* ─────────────────────── Dracula ─────────────────────── */
  dracula: {
    label: 'Dracula',
    isDark: true,
    swatch: { bg: '#282a36', accent: '#bd93f9', text: '#f8f8f2' },
    colors: {
      'surface-primary':   '40 42 54',      // dracula bg
      'surface-secondary': '68 71 90',      // dracula current line
      'surface-elevated':  '68 71 90',
      'surface-overlay':   '68 71 90',
      'surface-inset':     '33 34 44',      // slightly darker

      'text-primary':   '248 248 242',      // dracula fg
      'text-secondary': '189 147 249',      // dracula purple (comments-ish)
      'text-muted':     '98 114 164',       // dracula comment
      'text-inverse':   '40 42 54',

      'border-primary':   '68 71 90',       // current line
      'border-secondary': '98 114 164',     // comment
      'border-focus':     '189 147 249',    // purple

      'brand-primary':       '189 147 249', // dracula purple
      'brand-primary-hover': '207 176 255', // lighter purple
      'brand-secondary':     '139 233 253', // dracula cyan
      'brand-gradient-from': '189 147 249', // purple
      'brand-gradient-via':  '255 121 198', // pink
      'brand-gradient-to':   '139 233 253', // cyan

      'success':        '80 250 123',       // dracula green
      'success-subtle': '30 60 40',
      'warning':        '241 250 140',      // dracula yellow
      'warning-subtle': '60 62 40',
      'error':          '255 85 85',        // dracula red
      'error-subtle':   '80 30 30',
      'info':           '139 233 253',      // dracula cyan
      'info-subtle':    '30 60 75',

      'input-bg':     '68 71 90',
      'input-border': '98 114 164',
      'input-focus':  '189 147 249',
      'btn-primary':  '189 147 249',
      'btn-text':     '40 42 54',

      'tree-metabolite': '139 233 253',     // cyan
      'tree-reaction':   '189 147 249',     // purple
      'tree-source':     '80 250 123',      // green
      'tree-seed':       '139 233 253',     // cyan
      'tree-cofactor':   '98 114 164',      // comment
      'tree-solution':   '80 250 123',      // green

      'node-compound-fill':   '42 161 152',
      'node-compound-stroke': '139 233 253',
      'node-reaction-fill':   '108 113 196',
      'node-reaction-stroke': '189 147 249',
      'node-ec-fill':         '203 75 22',
      'node-ec-stroke':       '255 184 108',

      'accent-teal':    '139 233 253',
      'accent-indigo':  '189 147 249',
      'accent-amber':   '241 250 140',
      'accent-emerald': '80 250 123',
      'accent-cyan':    '139 233 253',
      'accent-violet':  '189 147 249',

      'scrollbar-track':      '40 42 54',
      'scrollbar-thumb':      '98 114 164',
      'scrollbar-thumb-hover':'139 147 199',

      'code-bg':   '68 71 90',
      'code-text': '248 248 242',
      'ring':      '189 147 249',
    },
  },

  /* ─────────────────────── Solarized Light ─────────────────────── */
  'solarized-light': {
    label: 'Solarized Light',
    isDark: false,
    swatch: { bg: '#fdf6e3', accent: '#268bd2', text: '#657b83' },
    colors: {
      'surface-primary':   '253 246 227',   // base3
      'surface-secondary': '238 232 213',   // base2
      'surface-elevated':  '253 246 227',   // base3
      'surface-overlay':   '238 232 213',   // base2
      'surface-inset':     '238 232 213',   // base2

      'text-primary':   '101 123 131',      // base00
      'text-secondary': '88 110 117',       // base01
      'text-muted':     '147 161 161',      // base1
      'text-inverse':   '253 246 227',      // base3

      'border-primary':   '238 232 213',    // base2
      'border-secondary': '147 161 161',    // base1
      'border-focus':     '38 139 210',     // blue

      'brand-primary':       '38 139 210',  // solarized blue
      'brand-primary-hover': '108 113 196', // solarized violet
      'brand-secondary':     '42 161 152',  // solarized cyan
      'brand-gradient-from': '38 139 210',  // blue
      'brand-gradient-via':  '108 113 196', // violet
      'brand-gradient-to':   '42 161 152',  // cyan

      'success':        '133 153 0',        // solarized green
      'success-subtle': '240 245 220',
      'warning':        '181 137 0',        // solarized yellow
      'warning-subtle': '250 245 225',
      'error':          '220 50 47',        // solarized red
      'error-subtle':   '252 235 235',
      'info':           '38 139 210',       // solarized blue
      'info-subtle':    '230 245 255',

      'input-bg':     '253 246 227',
      'input-border': '147 161 161',
      'input-focus':  '38 139 210',
      'btn-primary':  '38 139 210',
      'btn-text':     '253 246 227',

      'tree-metabolite': '42 161 152',      // cyan
      'tree-reaction':   '108 113 196',     // violet
      'tree-source':     '133 153 0',       // green
      'tree-seed':       '38 139 210',      // blue
      'tree-cofactor':   '147 161 161',     // base1
      'tree-solution':   '133 153 0',       // green

      'node-compound-fill':   '180 222 220',
      'node-compound-stroke': '42 161 152',
      'node-reaction-fill':   '210 213 240',
      'node-reaction-stroke': '108 113 196',
      'node-ec-fill':         '245 235 200',
      'node-ec-stroke':       '181 137 0',

      'accent-teal':    '42 161 152',
      'accent-indigo':  '108 113 196',
      'accent-amber':   '181 137 0',
      'accent-emerald': '133 153 0',
      'accent-cyan':    '42 161 152',
      'accent-violet':  '108 113 196',

      'scrollbar-track':      '238 232 213',
      'scrollbar-thumb':      '147 161 161',
      'scrollbar-thumb-hover':'88 110 117',

      'code-bg':   '238 232 213',
      'code-text': '88 110 117',
      'ring':      '38 139 210',
    },
  },

  /* ─────────────────────── Solarized Dark ─────────────────────── */
  'solarized-dark': {
    label: 'Solarized Dark',
    isDark: true,
    swatch: { bg: '#002b36', accent: '#268bd2', text: '#839496' },
    colors: {
      'surface-primary':   '0 43 54',       // base03
      'surface-secondary': '7 54 66',       // base02
      'surface-elevated':  '7 54 66',
      'surface-overlay':   '7 54 66',
      'surface-inset':     '0 43 54',

      'text-primary':   '131 148 150',      // base0
      'text-secondary': '147 161 161',      // base1
      'text-muted':     '88 110 117',       // base01
      'text-inverse':   '0 43 54',          // base03

      'border-primary':   '7 54 66',        // base02
      'border-secondary': '88 110 117',     // base01
      'border-focus':     '38 139 210',     // blue

      'brand-primary':       '38 139 210',
      'brand-primary-hover': '108 113 196',
      'brand-secondary':     '42 161 152',
      'brand-gradient-from': '38 139 210',
      'brand-gradient-via':  '108 113 196',
      'brand-gradient-to':   '42 161 152',

      'success':        '133 153 0',
      'success-subtle': '20 40 10',
      'warning':        '181 137 0',
      'warning-subtle': '50 40 10',
      'error':          '220 50 47',
      'error-subtle':   '60 20 20',
      'info':           '38 139 210',
      'info-subtle':    '10 40 60',

      'input-bg':     '7 54 66',
      'input-border': '88 110 117',
      'input-focus':  '38 139 210',
      'btn-primary':  '38 139 210',
      'btn-text':     '253 246 227',

      'tree-metabolite': '42 161 152',
      'tree-reaction':   '108 113 196',
      'tree-source':     '133 153 0',
      'tree-seed':       '38 139 210',
      'tree-cofactor':   '88 110 117',
      'tree-solution':   '133 153 0',

      'node-compound-fill':   '42 161 152',
      'node-compound-stroke': '42 161 152',
      'node-reaction-fill':   '108 113 196',
      'node-reaction-stroke': '108 113 196',
      'node-ec-fill':         '181 137 0',
      'node-ec-stroke':       '181 137 0',

      'accent-teal':    '42 161 152',
      'accent-indigo':  '108 113 196',
      'accent-amber':   '181 137 0',
      'accent-emerald': '133 153 0',
      'accent-cyan':    '42 161 152',
      'accent-violet':  '108 113 196',

      'scrollbar-track':      '0 43 54',
      'scrollbar-thumb':      '88 110 117',
      'scrollbar-thumb-hover':'131 148 150',

      'code-bg':   '7 54 66',
      'code-text': '147 161 161',
      'ring':      '38 139 210',
    },
  },
};

export const THEME_IDS = Object.keys(THEMES);
export const DEFAULT_THEME = 'nebula-light';
