const palettes = {
  light: ['#c53030', '#c05621', '#9b6b00', '#276749', '#0f766e', '#2563eb', '#6b46c1'],
  dark: ['#fc8181', '#f6ad55', '#f6e05e', '#68d391', '#4fd1c5', '#63b3ed', '#b794f4'],
};

const backgrounds = {
  light: '#d6d1c7',
  dark: '#1a1c2a',
};

const outlines = {
  light: '#1f2937',
  dark: '#ffffff',
};

function toRgb(hex) {
  const value = hex.slice(1);
  return [0, 2, 4].map((offset) => parseInt(value.slice(offset, offset + 2), 16) / 255);
}

function luminance(hex) {
  return toRgb(hex).reduce((sum, channel, index) => {
    const linear = channel <= 0.03928
      ? channel / 12.92
      : ((channel + 0.055) / 1.055) ** 2.4;
    return sum + linear * [0.2126, 0.7152, 0.0722][index];
  }, 0);
}

function contrast(first, second) {
  const light = Math.max(luminance(first), luminance(second));
  const dark = Math.min(luminance(first), luminance(second));
  return (light + 0.05) / (dark + 0.05);
}

const failures = [];
for (const [mode, palette] of Object.entries(palettes)) {
  for (const [index, color] of palette.entries()) {
    const backgroundRatio = contrast(color, backgrounds[mode]);
    const outlineRatio = contrast(outlines[mode], backgrounds[mode]);
    if (backgroundRatio < 3) {
      failures.push(`${mode} rainbow stop ${index + 1} ${color} vs ${backgrounds[mode]}: ${backgroundRatio.toFixed(2)}:1`);
    }
    if (outlineRatio < 3) {
      failures.push(`${mode} outline ${outlines[mode]} vs ${backgrounds[mode]}: ${outlineRatio.toFixed(2)}:1`);
    }
    console.log(`${mode} stop ${index + 1}: fill ${backgroundRatio.toFixed(2)}:1, outline ${outlineRatio.toFixed(2)}:1`);
  }
}

if (failures.length) {
  console.error('\nContrast failures:');
  failures.forEach((failure) => console.error(`- ${failure}`));
  process.exit(1);
}

console.log('\nAll graph fills and outlines meet the 3:1 non-text contrast target.');
