// ============================================================================
// BENCHMARK UTILITIES — Phase 7 Benchmarking
// Application: Campus Evacuation Capacity Analyzer
// File: benchmarks/benchmark-utils.js
//
// Statistical helpers for benchmark data aggregation and CSV I/O.
// ============================================================================

// ---------------------------------------------------------------------------
// Sorting helper for numeric arrays
// ---------------------------------------------------------------------------
function sortedNumeric(arr) {
  return arr.slice().sort((a, b) => a - b);
}

// ---------------------------------------------------------------------------
// Median
// ---------------------------------------------------------------------------
function median(arr) {
  if (!arr || arr.length === 0) return NaN;
  const s = sortedNumeric(arr);
  const mid = Math.floor(s.length / 2);
  return s.length % 2 !== 0 ? s[mid] : (s[mid - 1] + s[mid]) / 2;
}

// ---------------------------------------------------------------------------
// Percentile (linear interpolation)
// ---------------------------------------------------------------------------
function percentile(arr, p) {
  if (!arr || arr.length === 0) return NaN;
  const s = sortedNumeric(arr);
  if (s.length === 1) return s[0];
  const k = (p / 100) * (s.length - 1);
  const lo = Math.floor(k);
  const hi = Math.ceil(k);
  const frac = k - lo;
  return s[lo] + frac * (s[hi] - s[lo]);
}

// ---------------------------------------------------------------------------
// IQR (interquartile range)
// ---------------------------------------------------------------------------
function iqr(arr) {
  return percentile(arr, 75) - percentile(arr, 25);
}

// ---------------------------------------------------------------------------
// Mean
// ---------------------------------------------------------------------------
function mean(arr) {
  if (!arr || arr.length === 0) return NaN;
  let sum = 0;
  for (let i = 0; i < arr.length; i++) sum += arr[i];
  return sum / arr.length;
}

// ---------------------------------------------------------------------------
// Standard deviation (population)
// ---------------------------------------------------------------------------
function stddev(arr) {
  if (!arr || arr.length < 2) return 0;
  const m = mean(arr);
  let sumSq = 0;
  for (let i = 0; i < arr.length; i++) sumSq += (arr[i] - m) * (arr[i] - m);
  return Math.sqrt(sumSq / arr.length);
}

// ---------------------------------------------------------------------------
// Coefficient of variation (%)
// ---------------------------------------------------------------------------
function coefficientOfVariation(arr) {
  const m = mean(arr);
  if (Math.abs(m) < 1e-12) return 0;
  return (stddev(arr) / Math.abs(m)) * 100;
}

// ---------------------------------------------------------------------------
// Min / Max
// ---------------------------------------------------------------------------
function min(arr) {
  if (!arr || arr.length === 0) return NaN;
  let m = arr[0];
  for (let i = 1; i < arr.length; i++) if (arr[i] < m) m = arr[i];
  return m;
}

function max(arr) {
  if (!arr || arr.length === 0) return NaN;
  let m = arr[0];
  for (let i = 1; i < arr.length; i++) if (arr[i] > m) m = arr[i];
  return m;
}

// ---------------------------------------------------------------------------
// CSV escape: wrap field in quotes if it contains commas, quotes, or newlines
// ---------------------------------------------------------------------------
function csvEscape(val) {
  const s = String(val);
  if (s.indexOf(',') >= 0 || s.indexOf('"') >= 0 || s.indexOf('\n') >= 0) {
    return '"' + s.replace(/"/g, '""') + '"';
  }
  return s;
}

// ---------------------------------------------------------------------------
// Build CSV string from header array and rows (array of arrays)
// ---------------------------------------------------------------------------
function buildCSV(header, rows) {
  const lines = [header.map(csvEscape).join(',')];
  for (const row of rows) {
    lines.push(row.map(csvEscape).join(','));
  }
  return lines.join('\n') + '\n';
}

// ---------------------------------------------------------------------------
// Parse CSV string into { header: string[], rows: string[][] }
// RFC 4180 compliant: handles quoted commas, quotes, and embedded newlines
// ---------------------------------------------------------------------------
function parseCSV(csvStr) {
  if (!csvStr || typeof csvStr !== 'string') return { header: [], rows: [] };
  const allRows = [];
  let currentRow = [];
  let currentField = '';
  let inQuotes = false;
  let i = 0;
  const n = csvStr.length;

  while (i < n) {
    const char = csvStr[i];
    if (inQuotes) {
      if (char === '"') {
        if (i + 1 < n && csvStr[i + 1] === '"') {
          currentField += '"';
          i += 2;
        } else {
          inQuotes = false;
          i++;
        }
      } else {
        currentField += char;
        i++;
      }
    } else {
      if (char === '"') {
        inQuotes = true;
        i++;
      } else if (char === ',') {
        currentRow.push(currentField);
        currentField = '';
        i++;
      } else if (char === '\r') {
        if (i + 1 < n && csvStr[i + 1] === '\n') {
          i++;
        }
        currentRow.push(currentField);
        currentField = '';
        allRows.push(currentRow);
        currentRow = [];
        i++;
      } else if (char === '\n') {
        currentRow.push(currentField);
        currentField = '';
        allRows.push(currentRow);
        currentRow = [];
        i++;
      } else {
        currentField += char;
        i++;
      }
    }
  }

  if (currentField.length > 0 || currentRow.length > 0) {
    currentRow.push(currentField);
    allRows.push(currentRow);
  }

  if (allRows.length > 0 && allRows[allRows.length - 1].length === 1 && allRows[allRows.length - 1][0] === '') {
    allRows.pop();
  }

  if (allRows.length === 0) return { header: [], rows: [] };
  return {
    header: allRows[0],
    rows: allRows.slice(1)
  };
}

// ---------------------------------------------------------------------------
// Aggregate raw benchmark rows into summary statistics
// Input: array of result objects with numeric fields
// Groups by configKey + algorithm
// Returns summary rows with median, mean, min, max, IQR, stddev, CV
// ---------------------------------------------------------------------------
function aggregateResults(rawRows, groupByFields, metricFields) {
  const groups = new Map();

  for (const row of rawRows) {
    const key = groupByFields.map(f => String(row[f])).join('|');
    if (!groups.has(key)) {
      const base = {};
      for (const f of groupByFields) base[f] = row[f];
      groups.set(key, { base, metrics: {} });
      for (const mf of metricFields) groups.get(key).metrics[mf] = [];
    }
    const g = groups.get(key);
    for (const mf of metricFields) {
      if (typeof row[mf] === 'number' && isFinite(row[mf])) {
        g.metrics[mf].push(row[mf]);
      }
    }
  }

  const summaries = [];
  for (const [, { base, metrics }] of groups) {
    const summary = Object.assign({}, base);
    summary.repetitions = 0;
    for (const mf of metricFields) {
      const arr = metrics[mf];
      if (arr.length > 0) summary.repetitions = Math.max(summary.repetitions, arr.length);
      summary[mf + '_median'] = median(arr);
      summary[mf + '_mean']   = mean(arr);
      summary[mf + '_min']    = min(arr);
      summary[mf + '_max']    = max(arr);
      summary[mf + '_iqr']    = iqr(arr);
      summary[mf + '_stddev'] = stddev(arr);
      summary[mf + '_cv']     = coefficientOfVariation(arr);
    }
    summaries.push(summary);
  }

  return summaries;
}

// ---------------------------------------------------------------------------
// Format number: fixed decimal places, avoid -0
// ---------------------------------------------------------------------------
function fmt(val, decimals) {
  if (typeof val !== 'number' || isNaN(val)) return '';
  decimals = decimals != null ? decimals : 4;
  const s = val.toFixed(decimals);
  return s === '-0' + '.' + '0'.repeat(decimals) ? '0.' + '0'.repeat(decimals) : s;
}

// ---------------------------------------------------------------------------
// Node.js exports
// ---------------------------------------------------------------------------
if (typeof module !== 'undefined' && module.exports) {
  module.exports = {
    median,
    percentile,
    iqr,
    mean,
    stddev,
    coefficientOfVariation,
    min,
    max,
    csvEscape,
    buildCSV,
    parseCSV,
    aggregateResults,
    fmt
  };
}
