import React, { useContext } from 'react';
import {
  ChevronRight, Filter, Settings2, Eye, EyeOff, Layers, Upload, Download, Palette,
} from 'lucide-react';
import { ThemeContext } from '../ThemeProvider/ThemeProvider';
import { RAINBOW_PALETTE } from '../NetworkViewer2D/utils/colorSchemes';
import { PIN_COLORS } from '../PathwayExplorer/palette';

/**
 * Theme-aware symbols. They read the same CSS tokens as the real viewers
 * (see PathwayExplorer/palette.js and NetworkViewer2D/utils/colorSchemes.js),
 * so a glyph always matches what the viewer draws in the active theme.
 */
const v = (name, a) => (a === undefined ? `rgb(var(--${name}))` : `rgb(var(--${name}) / ${a})`);

const C = {
  intermediate: v('tree-metabolite'),
  target: v('warning'),
  source: v('tree-source'),
  seed: v('tree-cofactor'),
  reaction: v('tree-reaction'),
  highlight: v('tree-solution'),
  choice: v('accent-violet'),
  diverge: v('error'),
  err: v('error'),
  edge: v('text-muted', 0.9),
  text: v('text-primary'),
  muted: v('text-muted'),
  nodeFill: v('surface-elevated'),
  bg: v('surface-overlay'),
  compoundFill: v('node-compound-fill'),
  compoundStroke: v('node-compound-stroke'),
  reactionFill: v('node-reaction-fill'),
  reactionStroke: v('node-reaction-stroke'),
  ecFill: v('node-ec-fill'),
  ecStroke: v('node-ec-stroke'),
  brand: v('brand-primary'),
  border: v('border-primary'),
};
const SHARE_COLORS = ['#8B5CF6', '#06B6D4', '#10B981'];
const FONT = 'Inter, Helvetica, Arial, sans-serif';

const Line = ({ y = 14, x1 = 6, x2 = 50, w = 2, color = C.edge, dash, op = 1 }) => (
  <line x1={x1} x2={x2} y1={y} y2={y} stroke={color} strokeWidth={w} strokeDasharray={dash} strokeLinecap="round" opacity={op} />
);
const Txt = ({ x = 28, y = 17, size = 10, children, fill = C.text, italic, bold, anchor = 'middle' }) => (
  <text x={x} y={y} fontSize={size} fontFamily={FONT} fill={fill} textAnchor={anchor}
    fontStyle={italic ? 'italic' : undefined} fontWeight={bold ? 700 : 500}>{children}</text>
);
const Sq = ({ fill, stroke, dash, sw = 1.5, x = 20 }) => (
  <rect x={x} y={8} width={12} height={12} rx={2.5} fill={fill} stroke={stroke} strokeWidth={sw} strokeDasharray={dash} />
);
const arcPath = (cx, cy, r, a0, a1) => {
  const p = (a) => `${cx + r * Math.cos(a)},${cy + r * Math.sin(a)}`;
  return `M${p(a0)} A${r},${r} 0 0 1 ${p(a1)}`;
};
const RoundRect = ({ x = 15, fill = C.reactionFill, stroke = C.reactionStroke, sw = 1.4, ring, ringDash }) => (
  <>
    {ring && <rect x={x - 4} y={4} width={38} height={20} rx={5} fill="none" stroke={ring} strokeWidth={2} strokeDasharray={ringDash} />}
    <rect x={x} y={7} width={30} height={14} rx={3} fill={fill} stroke={stroke} strokeWidth={sw} />
  </>
);

const GENERATION_STOPS = (dark) => RAINBOW_PALETTE[dark ? 'dark' : 'light'];
const GenBar = ({ dark }) => (
  <>
    {GENERATION_STOPS(dark).map((c, i) => <rect key={c} x={4 + i * 7.1} y={9} width={7.1} height={10} fill={c} />)}
    <rect x={4} y={9} width={49.7} height={10} fill="none" stroke={C.border} strokeWidth={1} rx={2} />
  </>
);
const GenDot = ({ cx = 28, cy = 14, r = 7, idx = 1, dark }) => (
  <circle cx={cx} cy={cy} r={r} fill={GENERATION_STOPS(dark)[idx]} stroke={dark ? '#fff' : '#1f2937'} strokeWidth={0.8} />
);

const EcodBadge = ({ letter, fill, text }) => (
  <>
    <rect x={20} y={6} width={16} height={16} rx={4} fill={fill} />
    <Txt x={28} y={18} size={11} bold fill={text}>{letter}</Txt>
  </>
);
const ECOD_STYLE = {
  A: ['rgb(var(--error-subtle))', 'rgb(var(--error))'],
  X: ['rgb(var(--info-subtle))', 'rgb(var(--info))'],
  H: ['rgb(var(--success-subtle))', 'rgb(var(--success))'],
  T: ['rgb(var(--brand-primary) / 0.15)', 'rgb(var(--brand-primary))'],
  F: ['rgb(var(--warning-subtle))', 'rgb(var(--warning))'],
};

/** id -> (ctx) => svg children. ctx = { dark } */
const DRAW = {
  /* ── Path Finder ── */
  'pf-intermediate': () => <circle cx={28} cy={14} r={8} fill={C.nodeFill} stroke={C.intermediate} strokeWidth={2.2} />,
  'pf-target': () => <circle cx={28} cy={14} r={11} fill={C.target} stroke={C.target} strokeWidth={1.5} />,
  'pf-source': () => <circle cx={28} cy={14} r={8} fill={C.source} stroke={C.source} strokeWidth={1.5} />,
  'pf-seed': () => <circle cx={28} cy={14} r={8} fill={C.seed} stroke={C.seed} strokeWidth={1.5} />,
  'pf-seed-inline': () => (
    <>
      <Sq x={4} fill={C.reaction} stroke={C.nodeFill} sw={1.2} />
      <Txt x={19} y={13} size={9} italic fill={C.seed} anchor="start">+ CO2, H2O</Txt>
      <Txt x={19} y={23} size={9} italic fill={C.seed} anchor="start">+ Pyruvate</Txt>
    </>
  ),
  'pf-branch': () => (
    <>
      <circle cx={28} cy={14} r={11.5} fill="none" stroke={C.choice} strokeWidth={1.5} strokeDasharray="3 2.5" />
      <circle cx={28} cy={14} r={7.5} fill={C.nodeFill} stroke={C.intermediate} strokeWidth={2.2} />
    </>
  ),
  'pf-shared': () => (
    <>
      {SHARE_COLORS.map((c, i) => (
        <path key={c} d={arcPath(28, 14, 11.5, -Math.PI / 2 + (i * 2 * Math.PI) / 3 + 0.12, -Math.PI / 2 + ((i + 1) * 2 * Math.PI) / 3 - 0.12)}
          fill="none" stroke={c} strokeWidth={3} />
      ))}
      <circle cx={28} cy={14} r={7.5} fill={C.nodeFill} stroke={C.intermediate} strokeWidth={2.2} />
    </>
  ),
  'pf-tag': () => <Txt size={10} italic bold fill={C.diverge}>diverges · merges</Txt>,
  'pf-selected': () => (
    <>
      <circle cx={28} cy={14} r={12} fill="none" stroke={C.highlight} strokeWidth={2.5} />
      <circle cx={28} cy={14} r={7.5} fill={C.nodeFill} stroke={C.intermediate} strokeWidth={2.2} />
    </>
  ),
  'pf-reaction': () => <Sq fill={C.reaction} stroke={C.nodeFill} sw={1.2} />,
  'pf-reaction-unlisted': () => <Sq fill={C.nodeFill} stroke={C.reaction} sw={1.6} />,
  'pf-reaction-deleted': () => (
    <>
      <Sq fill={C.nodeFill} stroke={C.err} sw={1.6} dash="2 2" />
      <line x1={16} x2={40} y1={14} y2={14} stroke={C.err} strokeWidth={1} />
    </>
  ),
  'pf-reaction-highlight': () => <Sq fill={C.highlight} stroke={C.nodeFill} sw={1.2} />,
  'pf-line-width': () => (
    <>
      <Line y={7} w={1.3} /><Line y={14} w={3.2} /><Line y={22} w={5.5} />
    </>
  ),
  'pf-line-dashed': () => <Line dash="4 3" w={2} op={0.8} />,
  'pf-line-highlight': () => <Line color={C.highlight} w={4} />,
  'pf-pin': () => (
    <>
      {PIN_COLORS.map((c, i) => <Line key={c} y={5 + i * 6} color={c} w={Math.max(1.5, 5 - i * 1.1)} />)}
    </>
  ),
  'pf-line-target': () => (
    <>
      <Line y={9} color={SHARE_COLORS[0]} w={3} /><Line y={19} color={SHARE_COLORS[1]} w={3} />
    </>
  ),
  'pf-line-shared': () => <Line color={v('text-secondary')} w={3} />,
  'pf-gen-header': () => (
    <>
      <Txt y={12} size={8.5} bold fill={C.muted}>SEED</Txt>
      <Txt y={23} size={8.5} bold fill={C.muted}>GEN 3</Txt>
    </>
  ),

  /* ── Reaction Network ── */
  'rn-compound': () => <circle cx={28} cy={14} r={9} fill={C.compoundFill} stroke={C.compoundStroke} strokeWidth={1.6} />,
  'rn-reaction': () => <RoundRect />,
  'rn-ec': () => <ellipse cx={28} cy={14} rx={14} ry={8} fill={C.ecFill} stroke={C.ecStroke} strokeWidth={1.6} />,
  'rn-edge-solid': () => <Line w={1.8} color={v('text-secondary')} />,
  'rn-edge-dashed': () => <Line w={1.8} color={v('text-secondary')} dash="5 3" />,
  'rn-edge-dotted': () => <Line w={1.8} color="#8B5CF6" dash="1.5 3" />,
  'rn-stoich': () => (
    <>
      <Line y={17} w={1.8} color={v('text-secondary')} />
      <Txt y={11} size={11} bold fill={C.text}>2</Txt>
    </>
  ),
  'rn-band-header': () => (
    <>
      <Txt y={12} size={8.5} bold fill={C.muted}>Seed</Txt>
      <Txt y={23} size={8.5} bold fill={C.muted}>Gen 3</Txt>
    </>
  ),
  'rn-gen-colors': ({ dark }) => <GenBar dark={dark} />,
  'rn-hover': ({ dark }) => (
    <>
      <circle cx={28} cy={14} r={12.5} fill="none" stroke={v('info', 0.55)} strokeWidth={3} />
      <GenDot cx={28} cy={14} r={9} idx={4} dark={dark} />
    </>
  ),
  'rn-locked': ({ dark }) => (
    <>
      <circle cx={28} cy={14} r={12} fill="none" stroke="rgba(251,191,36,0.95)" strokeWidth={1.6} strokeDasharray="3 2" />
      <GenDot cx={28} cy={14} r={9} idx={2} dark={dark} />
    </>
  ),
  'rn-collapsed': () => <RoundRect sw={3} />,
  'rn-overlay': () => (
    <>
      <circle cx={28} cy={14} r={12} fill="none" stroke="#8B5CF6" strokeWidth={2.2} />
      <circle cx={28} cy={14} r={9} fill={C.compoundFill} stroke={C.compoundStroke} strokeWidth={1.4} />
    </>
  ),

  /* ── Metabolic Map ── */
  'mm-compound': ({ dark }) => <GenDot cx={28} cy={14} r={7} idx={5} dark={dark} />,
  'mm-ghost': () => <circle cx={28} cy={14} r={4} fill={C.muted} fillOpacity={0.35} stroke={v('text-secondary')} strokeOpacity={0.4} />,
  'mm-backbone': ({ dark }) => (
    <>
      <circle cx={28} cy={14} r={11} fill="none" stroke={v('brand-primary', 0.65)} strokeWidth={2} />
      <GenDot cx={28} cy={14} r={7} idx={3} dark={dark} />
    </>
  ),
  'mm-locked': ({ dark }) => (
    <>
      <circle cx={28} cy={14} r={11} fill="none" stroke="rgba(251,57,36,0.9)" strokeWidth={1.6} strokeDasharray="3 2" />
      <GenDot cx={28} cy={14} r={7} idx={0} dark={dark} />
    </>
  ),
  'mm-edge': () => (
    <>
      <Line w={1.6} color={v('text-secondary')} />
      <polygon points="31,9 40,14 31,19" fill={v('text-secondary')} />
    </>
  ),
  'mm-edge-merged': () => (
    <>
      <Line w={1.6} color={v('text-secondary')} />
      <rect x={14} y={7} width={28} height={14} rx={4} fill={C.bg} stroke={C.border} />
      <Txt y={17.5} size={8.5}>3 rxns</Txt>
    </>
  ),
  'mm-edge-bridge': () => <Line w={1.6} color={v('text-secondary')} dash="4 4" />,
  'mm-gen-colors': ({ dark }) => <GenBar dark={dark} />,
  'mm-pathway-region': () => <Txt size={9} italic fill={C.muted}>Glycolysis</Txt>,

  /* ── Protein viewer ── */
  'pv-domain': () => (
    <>
      <rect x={4} y={9} width={20} height={10} rx={2} fill="#90cdf4" />
      <rect x={26} y={9} width={26} height={10} rx={2} fill="#9ae6b4" />
    </>
  ),
  'pv-binding': () => (
    <>
      <rect x={4} y={9} width={48} height={10} rx={2} fill="#90cdf4" />
      <rect x={20} y={7} width={9} height={14} rx={1.5} fill="#ef4444" opacity={0.85} />
    </>
  ),
  'pv-active': () => (
    <>
      <rect x={4} y={9} width={48} height={10} rx={2} fill="#9ae6b4" />
      <rect x={30} y={9} width={6} height={10} rx={1.5} fill="#d97706" opacity={0.9} />
    </>
  ),
  'pv-segments': () => (
    <>
      {[4, 22, 40].map((x) => <rect key={x} x={x} y={8} width={13} height={12} rx={3} fill={v('surface-inset')} stroke={C.border} />)}
      <Txt x={10.5} y={17} size={7}>11</Txt><Txt x={28.5} y={17} size={7}>96</Txt><Txt x={46.5} y={17} size={7}>210</Txt>
    </>
  ),
  ...Object.fromEntries(['A', 'X', 'H', 'T', 'F'].map((l) => [`pv-ecod-${l}`, () => <EcodBadge letter={l} fill={ECOD_STYLE[l][0]} text={ECOD_STYLE[l][1]} />])),

  /* ── Metabolome Records ── */
  'mr-stripe': () => (
    <>
      <rect x={6} y={5} width={44} height={18} rx={3} fill="#8B5CF6" fillOpacity={0.14} />
      <rect x={6} y={5} width={4} height={18} rx={1} fill="#8B5CF6" />
      <Line y={14} x1={16} x2={44} w={1.6} color={C.muted} />
    </>
  ),
  'mr-multi': () => (
    <>
      {['#8B5CF6', '#06B6D4', '#10B981'].map((c, i) => <rect key={c} x={16 + i * 8} y={6} width={6} height={16} rx={1.5} fill={c} />)}
    </>
  ),
  'mr-ec': () => (
    <>
      <rect x={8} y={6} width={40} height={16} rx={4} fill={v('info-subtle')} />
      <Txt y={18} size={9.5} bold fill={v('info')}>1.4.1.2</Txt>
    </>
  ),
  'dock-dot': () => <circle cx={28} cy={14} r={6} fill="#8B5CF6" stroke={C.border} strokeWidth={2} />,
};

const ICONS = {
  'ui-expand': ChevronRight, 'ui-filter': Filter, 'ui-columns': Settings2, 'ui-eye': Eye,
  'ui-eye-off': EyeOff, 'ui-combined': Layers, 'ui-upload': Upload, 'ui-download': Download, 'ui-theme': Palette,
};

export const GLYPH_IDS = new Set([...Object.keys(DRAW), ...Object.keys(ICONS)]);

/**
 * <Glyph id="pf-seed" /> — sized in em so it scales with the surrounding text
 * (and therefore with the shared text-size setting).
 */
const Glyph = ({ id, className = '', title }) => {
  const { dark } = useContext(ThemeContext);
  const Icon = ICONS[id];
  if (Icon) {
    return (
      <span className={`inline-flex items-center justify-center text-content-secondary ${className}`} style={{ width: '3.5em', height: '1.75em' }} title={title} aria-hidden="true">
        <Icon style={{ width: '1.35em', height: '1.35em' }} />
      </span>
    );
  }
  const draw = DRAW[id];
  if (!draw) return null;
  return (
    <svg
      viewBox="0 0 56 28"
      className={`inline-block flex-shrink-0 align-middle ${className}`}
      style={{ width: '3.5em', height: '1.75em' }}
      role="img"
      aria-label={title || id}
    >
      {draw({ dark })}
    </svg>
  );
};

export default Glyph;
