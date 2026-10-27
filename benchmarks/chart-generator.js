// ============================================================================
// CHART GENERATOR — Phase 7 Benchmarking
// Application: Campus Evacuation Capacity Analyzer
// File: benchmarks/chart-generator.js
//
// Reads summary-results.csv and generates report-ready SVG charts.
// Pure Node.js — no external dependencies.
//
// Usage:
//   node benchmarks/chart-generator.js
//
// Outputs SVG files to benchmarks/results/charts/
// ============================================================================

const path = require('path');
const fs   = require('fs');
const utils = require(path.join(__dirname, 'benchmark-utils.js'));

const RESULTS_DIR = path.join(__dirname, 'results');
const CHARTS_DIR  = path.join(RESULTS_DIR, 'charts');

// ---------------------------------------------------------------------------
// Color palette for algorithms
// ---------------------------------------------------------------------------
const ALGO_COLORS = {
  'Edmonds-Karp':    { fill: '#3498db', stroke: '#2980b9' },
  'Ford-Fulkerson':  { fill: '#e74c3c', stroke: '#c0392b' },
  'Widest-Path':     { fill: '#2ecc71', stroke: '#27ae60' }
};

const ALGO_SHAPES = {
  'Edmonds-Karp':   'circle',
  'Ford-Fulkerson': 'square',
  'Widest-Path':    'triangle'
};

// ---------------------------------------------------------------------------
// SVG helper functions
// ---------------------------------------------------------------------------
function svgHeader(width, height, title) {
  return `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${width} ${height}" width="${width}" height="${height}">
<style>
  text { font-family: 'Segoe UI', Arial, sans-serif; }
  .title { font-size: 16px; font-weight: bold; fill: #2c3e50; }
  .axis-label { font-size: 12px; fill: #555; }
  .tick-label { font-size: 10px; fill: #666; }
  .legend-text { font-size: 11px; fill: #333; }
  .grid-line { stroke: #eee; stroke-width: 1; }
  .axis-line { stroke: #ccc; stroke-width: 1; }
</style>
<rect width="${width}" height="${height}" fill="white"/>
<text x="${width / 2}" y="25" text-anchor="middle" class="title">${escapeXml(title)}</text>
`;
}

function svgFooter() {
  return '</svg>\n';
}

function escapeXml(s) {
  return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

// ---------------------------------------------------------------------------
// Draw a grouped bar chart
// ---------------------------------------------------------------------------
function drawGroupedBarChart(opts) {
  const {
    data,          // [{ label, values: { algoName: number } }]
    title,
    yAxisLabel,
    width = 800,
    height = 500
  } = opts;

  const margin = { top: 50, right: 180, bottom: 80, left: 80 };
  const plotW = width - margin.left - margin.right;
  const plotH = height - margin.top - margin.bottom;

  const algos = Object.keys(ALGO_COLORS);
  const activeAlgos = algos.filter(a => data.some(d => d.values[a] != null));
  const barGroupWidth = plotW / data.length;
  const barWidth = Math.min(barGroupWidth * 0.7 / activeAlgos.length, 40);
  const groupGap = barGroupWidth - barWidth * activeAlgos.length;

  // Compute Y scale
  let maxVal = 0;
  for (const d of data) {
    for (const a of activeAlgos) {
      if (d.values[a] != null && d.values[a] > maxVal) maxVal = d.values[a];
    }
  }
  maxVal = maxVal * 1.15 || 1; // add 15% headroom

  const yScale = plotH / maxVal;

  let svg = svgHeader(width, height, title);

  // Grid lines
  const yTicks = 5;
  for (let i = 0; i <= yTicks; i++) {
    const y = margin.top + plotH - (i / yTicks) * plotH;
    const val = (i / yTicks) * maxVal;
    svg += `<line x1="${margin.left}" y1="${y}" x2="${margin.left + plotW}" y2="${y}" class="grid-line"/>`;
    svg += `<text x="${margin.left - 8}" y="${y + 4}" text-anchor="end" class="tick-label">${formatTickValue(val)}</text>\n`;
  }

  // Axes
  svg += `<line x1="${margin.left}" y1="${margin.top}" x2="${margin.left}" y2="${margin.top + plotH}" class="axis-line"/>`;
  svg += `<line x1="${margin.left}" y1="${margin.top + plotH}" x2="${margin.left + plotW}" y2="${margin.top + plotH}" class="axis-line"/>`;

  // Y axis label
  svg += `<text x="${margin.left - 55}" y="${margin.top + plotH / 2}" text-anchor="middle" transform="rotate(-90, ${margin.left - 55}, ${margin.top + plotH / 2})" class="axis-label">${escapeXml(yAxisLabel)}</text>\n`;

  // Bars
  for (let di = 0; di < data.length; di++) {
    const d = data[di];
    const groupX = margin.left + di * barGroupWidth + groupGap / 2;

    for (let ai = 0; ai < activeAlgos.length; ai++) {
      const algo = activeAlgos[ai];
      const val = d.values[algo];
      if (val == null) continue;

      const x = groupX + ai * barWidth;
      const barH = Math.max(1, val * yScale);
      const y = margin.top + plotH - barH;
      const colors = ALGO_COLORS[algo];

      svg += `<rect x="${x}" y="${y}" width="${barWidth - 2}" height="${barH}" fill="${colors.fill}" stroke="${colors.stroke}" stroke-width="1" rx="2"/>`;
    }

    // X-axis label
    const labelX = groupX + (activeAlgos.length * barWidth) / 2;
    svg += `<text x="${labelX}" y="${margin.top + plotH + 18}" text-anchor="middle" class="tick-label">${escapeXml(d.label)}</text>\n`;
  }

  // Legend
  svg += drawLegend(activeAlgos, width - margin.right + 15, margin.top + 10);

  svg += svgFooter();
  return svg;
}

// ---------------------------------------------------------------------------
// Draw a line chart (scatter + lines)
// ---------------------------------------------------------------------------
function drawLineChart(opts) {
  const {
    series,        // [{ algo, points: [{ x, y }] }]
    title,
    xAxisLabel,
    yAxisLabel,
    width = 800,
    height = 500,
    logScaleY = false,
    logScaleX = false
  } = opts;

  const margin = { top: 50, right: 180, bottom: 60, left: 80 };
  const plotW = width - margin.left - margin.right;
  const plotH = height - margin.top - margin.bottom;

  // Compute ranges
  let xMin = Infinity, xMax = -Infinity, yMin = Infinity, yMax = -Infinity;
  for (const s of series) {
    for (const p of s.points) {
      if (p.x < xMin) xMin = p.x;
      if (p.x > xMax) xMax = p.x;
      if (p.y < yMin) yMin = p.y;
      if (p.y > yMax) yMax = p.y;
    }
  }
  if (xMin === xMax) xMax = xMin + 1;
  if (yMin === yMax) yMax = yMin + 1;
  yMin = logScaleY ? Math.max(yMin, 0.001) : 0;
  yMax *= 1.15;

  function xPos(v) {
    if (logScaleX) {
      const logMin = Math.log10(Math.max(xMin, 1));
      const logMax = Math.log10(xMax);
      const logV = Math.log10(Math.max(v, 1));
      return margin.left + ((logV - logMin) / (logMax - logMin)) * plotW;
    }
    return margin.left + ((v - xMin) / (xMax - xMin)) * plotW;
  }
  function yPos(v) {
    if (logScaleY) {
      const logMin = Math.log10(Math.max(yMin, 0.001));
      const logMax = Math.log10(yMax);
      const logV = Math.log10(Math.max(v, 0.001));
      return margin.top + plotH - ((logV - logMin) / (logMax - logMin)) * plotH;
    }
    return margin.top + plotH - ((v - yMin) / (yMax - yMin)) * plotH;
  }

  let svg = svgHeader(width, height, title);

  // Grid lines
  const yTicks = 5;
  for (let i = 0; i <= yTicks; i++) {
    const frac = i / yTicks;
    let val;
    if (logScaleY) {
      const logMin = Math.log10(Math.max(yMin, 0.001));
      const logMax = Math.log10(yMax);
      val = Math.pow(10, logMin + frac * (logMax - logMin));
    } else {
      val = yMin + frac * (yMax - yMin);
    }
    const y = margin.top + plotH - frac * plotH;
    svg += `<line x1="${margin.left}" y1="${y}" x2="${margin.left + plotW}" y2="${y}" class="grid-line"/>`;
    svg += `<text x="${margin.left - 8}" y="${y + 4}" text-anchor="end" class="tick-label">${formatTickValue(val)}</text>\n`;
  }

  // Axes
  svg += `<line x1="${margin.left}" y1="${margin.top}" x2="${margin.left}" y2="${margin.top + plotH}" class="axis-line"/>`;
  svg += `<line x1="${margin.left}" y1="${margin.top + plotH}" x2="${margin.left + plotW}" y2="${margin.top + plotH}" class="axis-line"/>`;

  // Axis labels
  svg += `<text x="${margin.left + plotW / 2}" y="${height - 10}" text-anchor="middle" class="axis-label">${escapeXml(xAxisLabel)}</text>\n`;
  svg += `<text x="${margin.left - 55}" y="${margin.top + plotH / 2}" text-anchor="middle" transform="rotate(-90, ${margin.left - 55}, ${margin.top + plotH / 2})" class="axis-label">${escapeXml(yAxisLabel)}</text>\n`;

  // X ticks
  const uniqueX = [...new Set(series.flatMap(s => s.points.map(p => p.x)))].sort((a, b) => a - b);
  for (const xv of uniqueX) {
    const x = xPos(xv);
    svg += `<text x="${x}" y="${margin.top + plotH + 18}" text-anchor="middle" class="tick-label">${xv}</text>\n`;
  }

  // Series lines and points
  const activeAlgos = series.map(s => s.algo);
  for (const s of series) {
    const colors = ALGO_COLORS[s.algo] || { fill: '#999', stroke: '#666' };
    const sorted = s.points.slice().sort((a, b) => a.x - b.x);

    // Line
    if (sorted.length > 1) {
      const pathD = sorted.map((p, i) => `${i === 0 ? 'M' : 'L'}${xPos(p.x).toFixed(1)},${yPos(p.y).toFixed(1)}`).join(' ');
      svg += `<path d="${pathD}" fill="none" stroke="${colors.stroke}" stroke-width="2" stroke-linejoin="round"/>`;
    }

    // Points
    for (const p of sorted) {
      const cx = xPos(p.x);
      const cy = yPos(p.y);
      svg += drawShape(ALGO_SHAPES[s.algo] || 'circle', cx, cy, 4, colors.fill, colors.stroke);
    }
  }

  // Legend
  svg += drawLegend(activeAlgos, width - margin.right + 15, margin.top + 10);

  svg += svgFooter();
  return svg;
}

// ---------------------------------------------------------------------------
// Helper: draw shape at point
// ---------------------------------------------------------------------------
function drawShape(shape, cx, cy, r, fill, stroke) {
  switch (shape) {
    case 'square':
      return `<rect x="${cx - r}" y="${cy - r}" width="${2 * r}" height="${2 * r}" fill="${fill}" stroke="${stroke}" stroke-width="1"/>`;
    case 'triangle': {
      const pts = `${cx},${cy - r * 1.2} ${cx - r},${cy + r * 0.8} ${cx + r},${cy + r * 0.8}`;
      return `<polygon points="${pts}" fill="${fill}" stroke="${stroke}" stroke-width="1"/>`;
    }
    default:
      return `<circle cx="${cx}" cy="${cy}" r="${r}" fill="${fill}" stroke="${stroke}" stroke-width="1"/>`;
  }
}

// ---------------------------------------------------------------------------
// Helper: draw legend
// ---------------------------------------------------------------------------
function drawLegend(algos, x, y) {
  let svg = '';
  for (let i = 0; i < algos.length; i++) {
    const algo = algos[i];
    const colors = ALGO_COLORS[algo] || { fill: '#999', stroke: '#666' };
    const ly = y + i * 22;
    svg += `<rect x="${x}" y="${ly}" width="14" height="14" fill="${colors.fill}" stroke="${colors.stroke}" stroke-width="1" rx="2"/>`;
    svg += `<text x="${x + 20}" y="${ly + 11}" class="legend-text">${escapeXml(algo)}</text>\n`;
  }
  return svg;
}

// ---------------------------------------------------------------------------
// Format tick values
// ---------------------------------------------------------------------------
function formatTickValue(val) {
  if (Math.abs(val) >= 1000000) return (val / 1000000).toFixed(1) + 'M';
  if (Math.abs(val) >= 1000) return (val / 1000).toFixed(1) + 'K';
  if (Math.abs(val) < 0.01 && val !== 0) return val.toExponential(1);
  if (val === Math.floor(val)) return String(val);
  return val.toFixed(2);
}

// ===========================================================================
// MAIN: Read CSV and generate charts
// ===========================================================================
function main() {
  const summaryPath = path.join(RESULTS_DIR, 'summary-results.csv');
  if (!fs.existsSync(summaryPath)) {
    console.error('ERROR: summary-results.csv not found. Run benchmarks first.');
    process.exit(1);
  }

  const csvStr = fs.readFileSync(summaryPath, 'utf8');
  const { header, rows } = utils.parseCSV(csvStr);

  // Parse into objects
  const data = rows.map(row => {
    const obj = {};
    for (let i = 0; i < header.length; i++) {
      const val = row[i];
      const num = parseFloat(val);
      obj[header[i]] = (!isNaN(num) && val.trim() !== '') ? num : val;
    }
    return obj;
  });

  if (!fs.existsSync(CHARTS_DIR)) fs.mkdirSync(CHARTS_DIR, { recursive: true });

  console.log('================================================================');
  console.log('  CHART GENERATOR — Reading summary-results.csv');
  console.log(`  Records: ${data.length}`);
  console.log('================================================================\n');

  // --- Chart 1: Runtime vs Vertices (Sparse) ---
  generateScalingChart(data, 'sparse', 'Sparse',
    'Runtime vs Vertices (Sparse Graphs)',
    'chart-runtime-sparse.svg');

  // --- Chart 2: Runtime vs Vertices (Dense) ---
  generateScalingChart(data, 'dense', 'Dense',
    'Runtime vs Vertices (Dense Graphs, 50–60% Density)',
    'chart-runtime-dense.svg');

  // --- Chart 3: Runtime vs Vertices (Grid) ---
  generateScalingChart(data, 'grid', 'Grid',
    'Runtime vs Vertices (Grid Graphs)',
    'chart-runtime-grid.svg');

  // --- Chart 4: Edge Examinations vs Vertices (Sparse) ---
  generateMetricChart(data, 'sparse', 'edgeExaminations_median',
    'Edge Examinations vs Vertices (Sparse)',
    'Vertices', 'Edge Examinations (median)',
    'chart-examinations-sparse.svg');

  // --- Chart 5: Augmentations vs Vertices (Sparse) ---
  generateMetricChart(data, 'sparse', 'augmentations_median',
    'Augmentations vs Vertices (Sparse)',
    'Vertices', 'Augmentations (median)',
    'chart-augmentations-sparse.svg');

  // --- Chart 6: Capacity Range Effect ---
  generateCapacityChart(data);

  // --- Chart 7: Evacuation comparison bar chart ---
  generateEvacuationChart(data);

  console.log('\nAll charts generated successfully.');
}

// ---------------------------------------------------------------------------
// Chart generators
// ---------------------------------------------------------------------------

function generateScalingChart(data, family, familyLabel, title, filename) {
  const filtered = data.filter(d => d.family === family);
  if (filtered.length === 0) {
    console.log(`  Skipping ${filename}: no ${family} data`);
    return;
  }

  const algos = [...new Set(filtered.map(d => d.algorithm))];
  const series = algos.map(algo => ({
    algo,
    points: filtered
      .filter(d => d.algorithm === algo)
      .map(d => ({ x: d.vertices, y: d.totalMs_median }))
  }));

  const svg = drawLineChart({
    series, title,
    xAxisLabel: 'Vertices',
    yAxisLabel: 'Runtime (ms, median)',
    logScaleY: true
  });

  const outPath = path.join(CHARTS_DIR, filename);
  fs.writeFileSync(outPath, svg, 'utf8');
  console.log(`  Generated: ${filename}`);
}

function generateMetricChart(data, family, metric, title, xLabel, yLabel, filename) {
  const filtered = data.filter(d => d.family === family);
  if (filtered.length === 0) {
    console.log(`  Skipping ${filename}: no ${family} data`);
    return;
  }

  const algos = [...new Set(filtered.map(d => d.algorithm))];
  const series = algos.map(algo => ({
    algo,
    points: filtered
      .filter(d => d.algorithm === algo)
      .map(d => ({ x: d.vertices, y: d[metric] }))
      .filter(p => typeof p.y === 'number' && isFinite(p.y))
  }));

  const svg = drawLineChart({
    series, title,
    xAxisLabel: xLabel,
    yAxisLabel: yLabel
  });

  const outPath = path.join(CHARTS_DIR, filename);
  fs.writeFileSync(outPath, svg, 'utf8');
  console.log(`  Generated: ${filename}`);
}

function generateCapacityChart(data) {
  const capData = data.filter(d => d.family === 'capacity');
  if (capData.length === 0) {
    console.log('  Skipping capacity chart: no capacity data');
    return;
  }

  // Group by algorithm
  const algos = [...new Set(capData.map(d => d.algorithm))];
  const series = algos.map(algo => ({
    algo,
    points: capData
      .filter(d => d.algorithm === algo)
      .map(d => {
        // Extract max cap from config name like "CapRange-1-100"
        const match = d.config.match(/CapRange-\d+-(\d+)/);
        const maxCap = match ? parseInt(match[1]) : d.vertices;
        return { x: maxCap, y: d.augmentations_median };
      })
  }));

  const svg = drawLineChart({
    series,
    title: 'Observed Augmentations in Capacity-Range Sensitivity Study (25-node Sparse)',
    xAxisLabel: 'Maximum Capacity Bound C_max (log scale)',
    yAxisLabel: 'Augmentations (median)',
    logScaleX: true
  });

  const outPath = path.join(CHARTS_DIR, 'chart-capacity-effect.svg');
  fs.writeFileSync(outPath, svg, 'utf8');
  console.log('  Generated: chart-capacity-effect.svg');
}

function generateEvacuationChart(data) {
  const evacData = data.filter(d => d.family === 'evacuation');
  if (evacData.length === 0) {
    console.log('  Skipping evacuation chart: no evacuation data');
    return;
  }

  const barData = [];
  const configs = [...new Set(evacData.map(d => d.config))];
  for (const cfg of configs) {
    const values = {};
    for (const row of evacData.filter(d => d.config === cfg)) {
      values[row.algorithm] = row.totalMs_median;
    }
    barData.push({ label: cfg, values });
  }

  const svg = drawGroupedBarChart({
    data: barData,
    title: 'Runtime Comparison — Campus Evacuation Scenario',
    yAxisLabel: 'Runtime (ms, median)'
  });

  const outPath = path.join(CHARTS_DIR, 'chart-evacuation-comparison.svg');
  fs.writeFileSync(outPath, svg, 'utf8');
  console.log('  Generated: chart-evacuation-comparison.svg');
}

// ---------------------------------------------------------------------------
// Run
// ---------------------------------------------------------------------------
main();
