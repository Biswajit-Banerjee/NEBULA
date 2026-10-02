import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import PathwayGraphics, { SvgLegend, legendHeight } from './PathwayGraphics';

/**
 * Build a standalone, publication-ready SVG document of a laid-out pathway
 * model: explicit colors and fonts (no CSS variables), optional title,
 * caption and legend. Selected / pinned paths are baked in exactly as shown.
 */
export function buildSvgString({
  model, layout, palette, names, labelMode, showReactionLabels,
  active, pins, targets, targetColors, deletedReactionNames,
  title, caption, background = true, legend = true,
}) {
  const b = layout.bounds;
  const graphW = b.maxX - b.minX;
  const graphH = b.maxY - b.minY;
  const margin = 24;
  const headerH = title ? (caption ? 58 : 38) : 8;
  const legendH = legend ? legendHeight(model, targets) + 18 : 0;
  const W = Math.ceil(Math.max(graphW, legend ? 780 : 0) + margin * 2);
  const H = Math.ceil(headerH + graphH + legendH + margin);

  const svg = (
    <svg xmlns="http://www.w3.org/2000/svg" width={W} height={H} viewBox={`0 0 ${W} ${H}`}>
      {background && <g id="Background"><rect width={W} height={H} fill={palette.bg} /></g>}
      {(title || (title && caption)) && (
        <g id="Figure_Header">
          {title && (
            <text x={margin} y={margin + 8} fontFamily={palette.font} fontSize={16} fontWeight={700} fill={palette.text}>
              {title}
            </text>
          )}
          {title && caption && (
            <text x={margin} y={margin + 28} fontFamily={palette.font} fontSize={11} fill={palette.muted}>
              {caption}
            </text>
          )}
        </g>
      )}
      <g id="Pathway_Graph" transform={`translate(${margin - b.minX},${headerH - b.minY})`}>
        <PathwayGraphics
          model={model}
          layout={layout}
          palette={palette}
          names={names}
          labelMode={labelMode}
          showReactionLabels={showReactionLabels}
          active={active}
          pins={pins}
          targetColors={targetColors}
          deletedReactionNames={deletedReactionNames}
          exportMode
        />
      </g>
      {legend && (
        <g id="Legend">
          <SvgLegend
            x={margin}
            y={headerH + graphH + 18}
            palette={palette}
            model={model}
            targets={targets}
            targetColors={targetColors}
          />
        </g>
      )}
    </svg>
  );
  return `<?xml version="1.0" encoding="UTF-8" standalone="no"?>\n${renderToStaticMarkup(svg)}`;
}

export function downloadText(text, filename, type = 'image/svg+xml') {
  const blob = new Blob([text], { type });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
