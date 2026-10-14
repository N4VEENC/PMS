'use strict';

const fs = require('node:fs');
const path = require('node:path');

const API_NAMES = ['signup', 'login', 'create_portfolio', 'list_portfolios'];
const API_PATHS = {
  signup: '/api/auth/register',
  login: '/api/auth/login',
  create_portfolio: '/api/portfolios',
  list_portfolios: '/api/portfolios',
};
const BASELINE_VUS = 60;
const PEAK_VUS = 300;
const MANAGER_ISOLATION_USERS = 3;
const SCENARIO_GROUP = `G_${BASELINE_VUS}_to_${PEAK_VUS}_spike`;
const PHASES = [
  { name: 'baseline', start: 0, end: 30 },
  { name: 'spike_ramp_up', start: 30, end: 40 },
  { name: 'spike_peak', start: 40, end: 60 },
  { name: 'spike_ramp_down', start: 60, end: 70 },
  { name: 'recovery', start: 70, end: 110 },
  { name: 'ramp_down', start: 110, end: 120 },
];
const WINDOWS = Array.from({ length: 12 }, (_, index) => {
  const start = index * 10;
  return `${String(start).padStart(3, '0')}-${String(start + 10).padStart(3, '0')}`;
});
const P95_LIMITS = {
  signup: 1000,
  login: 1000,
  create_portfolio: 1500,
  list_portfolios: 800,
};
const ERROR_LIMITS = {
  signup: 0.005,
  login: 0.005,
  create_portfolio: 0.01,
  list_portfolios: 0.005,
};

function parseTags(metricKey) {
  const start = metricKey.indexOf('{');
  if (start < 0 || !metricKey.endsWith('}')) {
    return {};
  }
  return Object.fromEntries(metricKey.slice(start + 1, -1).split(',').map((tag) => {
    const separator = tag.indexOf(':');
    return [tag.slice(0, separator), tag.slice(separator + 1)];
  }));
}

function metricValues(data, name, requiredTags) {
  const metrics = data.metrics || {};
  const candidates = Object.entries(metrics)
    .filter(([key]) => key === name || key.startsWith(`${name}{`))
    .map(([key, metric]) => ({ key, metric, tags: parseTags(key) }))
    .filter(({ tags }) => Object.entries(requiredTags).every(([key, value]) => tags[key] === value));
  const exact = candidates.find(({ tags }) => Object.keys(tags).length === Object.keys(requiredTags).length);
  return (exact || candidates[0] || {}).metric?.values || null;
}

function formatNumber(value, digits = 0) {
  return Number.isFinite(value) ? value.toFixed(digits) : '-';
}

function countFor(data, name, tags) {
  const metrics = data.metrics || {};
  const candidates = Object.entries(metrics)
    .filter(([key]) => key === name || key.startsWith(`${name}{`))
    .map(([key, metric]) => ({ tags: parseTags(key), values: metric.values || {} }))
    .filter(({ tags: metricTags }) => Object.entries(tags).every(([key, value]) => metricTags[key] === value));
  const exact = candidates.find(({ tags: metricTags }) => Object.keys(metricTags).length === Object.keys(tags).length);
  if (exact) return Number.isFinite(exact.values.count) ? exact.values.count : 0;
  const mostSpecific = Math.max(0, ...candidates.map(({ tags: metricTags }) => Object.keys(metricTags).length));
  return candidates
    .filter(({ tags: metricTags }) => Object.keys(metricTags).length === mostSpecific)
    .reduce((total, { values }) => total + (Number.isFinite(values.count) ? values.count : 0), 0);
}

function durationValues(data, api) {
  return metricValues(data, `api_${api}_duration_ms`, { api });
}

function phaseDurationValues(data, api, phase) {
  return metricValues(data, 'api_phase_duration_ms', { api, phase });
}

function windowDurationValues(data, api, window) {
  const windowStart = Number(window.slice(0, 3));
  const phase = PHASES.find(({ start, end }) => windowStart >= start && windowStart < end).name;
  return metricValues(data, 'api_window_duration_ms', { api, phase, window });
}

function requestCount(data, api, phase = null, window = null) {
  const tags = { api, group: SCENARIO_GROUP };
  if (phase) tags.phase = phase;
  if (window) tags.window = window;
  return countFor(data, 'api_status_count', tags);
}

function errorCount(data, api, phase = null, window = null) {
  if (window) return countFor(data, 'api_window_errors', { api, phase, window });
  if (phase) return countFor(data, 'api_phase_errors', { api, phase });
  return countFor(data, `api_${api}_errors`, { api });
}

function statusCount(data, api, status, phase = null) {
  const tags = { api, group: SCENARIO_GROUP, status: String(status) };
  if (phase) tags.phase = phase;
  return countFor(data, 'api_status_count', tags);
}

function timeoutCount(data, api, phase = null) {
  const tags = { api, group: SCENARIO_GROUP };
  if (phase) tags.phase = phase;
  return countFor(data, 'api_timeout_count', tags);
}

function checksFailed(data, api, phase = null) {
  const tags = { api, group: SCENARIO_GROUP };
  if (phase) tags.phase = phase;
  return countFor(data, 'api_check_failures', tags);
}

function managerIsolationRows(data) {
  return [
    ['owner_access', 'Owner reads own portfolio (HTTP 200)', MANAGER_ISOLATION_USERS],
    ['cross_manager_access', 'Other manager is denied (HTTP 404)', MANAGER_ISOLATION_USERS * (MANAGER_ISOLATION_USERS - 1)],
  ].map(([caseName, description, expected]) => {
    const values = metricValues(data, 'manager_isolation_success_rate', { case: caseName });
    const passed = values && Number.isFinite(values.passes) ? values.passes : 0;
    const failed = values && Number.isFinite(values.fails) ? values.fails : 0;
    const observed = passed + failed;
    return [
      description,
      `${passed}/${expected}`,
      String(failed),
      observed === expected && failed === 0 ? 'PASS' : observed === 0 ? 'NOT RUN' : 'FAIL',
    ];
  });
}

function managerIsolationRequestCount(data) {
  return ['owner_access', 'cross_manager_access'].reduce((total, caseName) => {
    const values = metricValues(data, 'manager_isolation_success_rate', { case: caseName });
    return total + (values && Number.isFinite(values.passes) ? values.passes : 0)
      + (values && Number.isFinite(values.fails) ? values.fails : 0);
  }, 0);
}

function concurrency(data, api, phase = null, window = null) {
  const values = window
    ? metricValues(data, 'api_window_vus_active', { api, phase, window })
    : phase
      ? metricValues(data, 'api_phase_vus_active', { api, phase })
      : metricValues(data, 'api_vus_active', { api });
  return values && Number.isFinite(values.max) ? values.max : 0;
}

function formatTable(headers, rows) {
  const widths = headers.map((header, index) => Math.max(
    header.length,
    ...rows.map((row) => String(row[index] ?? '').length),
  ));
  const line = (row) => `| ${row.map((cell, index) => String(cell ?? '').padEnd(widths[index])).join(' | ')} |`;
  return [line(headers), `|-${widths.map((width) => '-'.repeat(width)).join('-|-')}-|`, ...rows.map(line)].join('\n');
}

function expectedFailureRate(api) {
  return ERROR_LIMITS[api] * 100;
}

function groupResult(data, api, phase) {
  const values = phaseDurationValues(data, api, phase);
  const requests = requestCount(data, api, phase);
  const errors = errorCount(data, api, phase);
  const errorPercent = requests > 0 ? errors / requests * 100 : 0;
  const p95 = values && Number.isFinite(values['p(95)']) ? values['p(95)'] : null;
  const failed = requests > 0 && (
    errorPercent > expectedFailureRate(api)
    || (p95 !== null && p95 >= P95_LIMITS[api])
  );
  return { requests, errors, errorPercent, p95, failed };
}

function classifyFailure(data, api, phase = null) {
  if (timeoutCount(data, api, phase) > 0) return 'request timeout';
  if (statusCount(data, api, 503, phase) > 0) return 'HTTP 503';
  if (statusCount(data, api, 500, phase) > 0) return 'HTTP 500';
  if (statusCount(data, api, 409, phase) > 0) return 'HTTP 409 conflict';
  if (statusCount(data, api, 401, phase) > 0) return 'HTTP 401 unauthorized';
  if (statusCount(data, api, 429, phase) > 0) return 'HTTP 429 rate limited';
  if (statusCount(data, api, 400, phase) > 0) return 'HTTP 400 bad request';
  if (checksFailed(data, api, phase) > 0) return 'failed response check';
  return 'latency threshold';
}

function makeReport(data) {
  const durationSeconds = Number(data.state && data.state.testRunDurationMs) / 1000 || 0;
  const run = data.runMetadata || {};
  const latencyRows = API_NAMES.map((api) => {
    const values = durationValues(data, api);
    const requests = requestCount(data, api);
    return [
      `${api === 'list_portfolios' ? 'GET' : 'POST'} ${API_PATHS[api]}`,
      formatNumber(values && (values['p(50)'] ?? values.med)),
      formatNumber(values && values['p(90)']),
      formatNumber(values && values['p(95)']),
      formatNumber(values && values['p(99)']),
      formatNumber(values && values.max),
      String(requests),
      formatNumber(durationSeconds > 0 ? requests / durationSeconds : NaN, 2),
    ];
  });
  const failureRows = API_NAMES.map((api) => {
    const requests = requestCount(data, api);
    const errors = errorCount(data, api);
    return [
      `${api === 'list_portfolios' ? 'GET' : 'POST'} ${API_PATHS[api]}`,
      formatNumber(requests > 0 ? errors / requests * 100 : 0, 2),
      String(statusCount(data, api, 409)),
      String(statusCount(data, api, 500)),
      String(statusCount(data, api, 503)),
      String(timeoutCount(data, api)),
      String(checksFailed(data, api)),
    ];
  });
  const apiColumns = ['signup', 'login', 'create_portfolio', 'list_portfolios'];
  const groupRows = PHASES.map(({ name: phase }) => [
    phase,
    ...apiColumns.map((api) => {
      const result = groupResult(data, api, phase);
      if (!result.requests) return '-';
      const cell = `${formatNumber(result.p95)}/${formatNumber(result.errorPercent, 2)}%`;
      return result.failed ? `${cell} ***` : cell;
    }),
  ]);
  const phaseSummaryRows = PHASES.map(({ name: phase, start, end }) => {
    const requests = API_NAMES.reduce((total, api) => total + requestCount(data, api, phase), 0);
    const errors = API_NAMES.reduce((total, api) => total + errorCount(data, api, phase), 0);
    const active = Math.max(...API_NAMES.map((api) => concurrency(data, api, phase)));
    return [
      `${start}-${end}s ${phase}`,
      String(active),
      String(requests),
      formatNumber((end > start) ? requests / (end - start) : NaN, 2),
      String(errors),
      formatNumber(requests > 0 ? errors / requests * 100 : 0, 2),
    ];
  });
  const breakpointRows = API_NAMES.map((api) => {
    const failures = PHASES
      .map(({ name: phase }) => ({ phase, result: groupResult(data, api, phase), vus: concurrency(data, api, phase) }))
      .filter(({ result }) => result.failed)
      .sort((left, right) => PHASES.findIndex(({ name }) => name === left.phase)
        - PHASES.findIndex(({ name }) => name === right.phase));
    if (failures.length === 0) {
      return [
        `${api === 'list_portfolios' ? 'GET' : 'POST'} ${API_PATHS[api]}`,
        'Not observed',
        'None',
        'No break observed',
      ];
    }
    const first = failures[0];
    return [
      `${api === 'list_portfolios' ? 'GET' : 'POST'} ${API_PATHS[api]}`,
      first.vus > 0 ? String(Math.round(first.vus)) : 'Unavailable',
      classifyFailure(data, api, first.phase),
      `First observed in ${first.phase}`,
    ];
  });

  const tables = [
    'TABLE 1 — PER-API LATENCY',
    formatTable(['Endpoint', 'p50 ms', 'p90 ms', 'p95 ms', 'p99 ms', 'max ms', 'Reqs', 'RPS'], latencyRows),
    '',
    'TABLE 2 — PER-API FAILURE MODES',
    formatTable(['Endpoint', 'Error%', '409', '500', '503', 'Timeout', 'Checks fail'], failureRows),
    '',
    'TABLE 3 — LOAD PHASE x API MATRIX (p95 ms / error%; *** = threshold failure)',
    formatTable(['Phase', 'signup', 'login', 'create_pf', 'list_pf'], groupRows),
    '',
    'TABLE 4 — LOAD PHASE SUMMARY',
    formatTable(['Phase', 'Peak active VUs', 'Requests', 'RPS', 'Errors', 'Error%'], phaseSummaryRows),
    '',
    'TABLE 5 — BREAKPOINT SUMMARY',
    formatTable(['Endpoint', 'Breaking concurrency', 'First failure mode', 'Verdict'], breakpointRows),
    '',
    'TABLE 6 — MANAGER DATA ISOLATION (3 TEST MANAGERS)',
    formatTable(['Check', 'Passed / expected', 'Failed', 'Result'], managerIsolationRows(data)),
  ];
  const verdicts = API_NAMES.map((api) => {
    const path = API_PATHS[api];
    const method = api === 'list_portfolios' ? 'GET' : 'POST';
    const failures = PHASES
      .map(({ name: phase }) => ({ phase, result: groupResult(data, api, phase), vus: concurrency(data, api, phase) }))
      .filter(({ result }) => result.failed)
      .sort((left, right) => PHASES.findIndex(({ name }) => name === left.phase)
        - PHASES.findIndex(({ name }) => name === right.phase));
    if (failures.length === 0) {
      return `${method} ${path} showed no threshold break in the tested groups; maximum observed concurrency was ${Math.round(concurrency(data, api))} VUs.`;
    }
    const firstFailure = failures[0];
    const baseline = PHASES
      .map(({ name: phase }) => ({ phase, result: groupResult(data, api, phase) }))
      .filter(({ result }) => result.requests > 0 && !result.failed)
      .find(({ phase }) => phase === 'baseline');
    const statusCode = [409, 500, 503, 401, 429, 400]
      .find((status) => statusCount(data, api, status, firstFailure.phase) > 0);
    const statusPercentage = statusCode
      ? statusCount(data, api, statusCode, firstFailure.phase) / firstFailure.result.requests * 100
      : 0;
    const concurrencyText = firstFailure.vus > 0 ? Math.round(firstFailure.vus) : 'unavailable';
    const latencyStatement = baseline
      ? `p95 rose from ${formatNumber(baseline.result.p95)}ms to ${formatNumber(firstFailure.result.p95)}ms`
      : `p95 was ${formatNumber(firstFailure.result.p95)}ms with no passing baseline`;
    return `${method} ${path} first crossed a limit during ${firstFailure.phase} at ${concurrencyText} active users — ${classifyFailure(data, api, firstFailure.phase)}; ${latencyStatement}; ${formatNumber(statusPercentage, 2)}% returned HTTP ${statusCode || 'errors'}.`;
  });
  const header = [
    `Test started: ${run.startedAt || 'timestamp unavailable'}`,
    `Report generated: ${run.generatedAt || 'timestamp unavailable'}`,
    `Profile: ${run.profile || `${BASELINE_VUS}-user baseline, spike to ${PEAK_VUS}, recovery`}`,
    `Actual duration: ${formatNumber(durationSeconds, 1)} seconds`,
    `Peak active VUs: ${Math.round(Math.max(...API_NAMES.map((api) => concurrency(data, api))))}`,
    `Dropped iterations: ${formatNumber(data.metrics?.dropped_iterations?.values?.count || 0)}`,
  ].join('\n');
  return `${header}\n\n${tables.join('\n')}\n\nVERDICTS\n${verdicts.map((line) => `- ${line}`).join('\n')}`;
}

function escapeHtml(value) {
  return value.replace(/[&<>"']/g, (character) => ({
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#39;',
  })[character]);
}

function parseReportTables(report) {
  const tables = [];
  const verdicts = [];
  let table;
  let readingVerdicts = false;
  for (const line of report.split('\n')) {
    if (line === 'VERDICTS') {
      readingVerdicts = true;
      table = null;
    } else if (readingVerdicts) {
      if (line.startsWith('- ')) verdicts.push(line.slice(2));
    } else if (line.startsWith('TABLE ')) {
      table = { title: line, rows: [] };
      tables.push(table);
    } else if (table && line.startsWith('|') && !line.startsWith('|-')) {
      table.rows.push(line.split('|').slice(1, -1).map((cell) => cell.trim()));
    }
  }
  return { tables, verdicts };
}

function renderTimeline(summary) {
  const colors = {
    signup: '#6659d9',
    login: '#1b9a86',
    create_portfolio: '#e29435',
    list_portfolios: '#d6536d',
  };
  const width = 960;
  const chartLeft = 76;
  const chartRight = 930;
  const chartWidth = chartRight - chartLeft;
  const slotWidth = chartWidth / WINDOWS.length;
  const latencyTop = 32;
  const latencyBottom = 190;
  const vusTop = 228;
  const vusBottom = 280;
  const maxLatency = Math.max(...Object.values(P95_LIMITS), 1500);
  const phaseAt = (window) => {
    const start = Number(window.slice(0, 3));
    return PHASES.find(({ start: phaseStart, end }) => start >= phaseStart && start < end).name;
  };
  const escapeAttribute = (value) => escapeHtml(String(value));
  const bands = WINDOWS.map((window, index) => {
    const phase = phaseAt(window);
    const fill = phase.startsWith('spike') ? '#fff0f2' : phase === 'baseline' ? '#eef3ff' : '#edf8f4';
    return `<rect x="${chartLeft + index * slotWidth}" y="${latencyTop}" width="${slotWidth}" height="${vusBottom - latencyTop}" fill="${fill}"/>`;
  }).join('');
  const latencyGrid = [0, 500, 1000, 1500].map((value) => {
    const y = latencyBottom - value / maxLatency * (latencyBottom - latencyTop);
    return `<line x1="${chartLeft}" y1="${y}" x2="${chartRight}" y2="${y}" stroke="#dfe4ee"/><text x="${chartLeft - 10}" y="${y + 4}" text-anchor="end">${value}</text>`;
  }).join('');
  const latencyLines = API_NAMES.map((api) => {
    const points = WINDOWS.map((window, index) => {
      const values = windowDurationValues(summary, api, window);
      if (!values || !Number.isFinite(values['p(95)'])) return null;
      const x = chartLeft + slotWidth * (index + 0.5);
      const y = latencyBottom - Math.min(values['p(95)'], maxLatency) / maxLatency * (latencyBottom - latencyTop);
      return { x, y, p95: values['p(95)'], window };
    }).filter(Boolean);
    if (!points.length) return '';
    const polyline = points.map(({ x, y }) => `${x},${y}`).join(' ');
    const dots = points.map(({ x, y, p95, window }) => (
      `<circle cx="${x}" cy="${y}" r="3.5" fill="${colors[api]}"><title>${escapeAttribute(api)} ${window}: p95 ${Math.round(p95)} ms</title></circle>`
    )).join('');
    return `<polyline points="${polyline}" fill="none" stroke="${colors[api]}" stroke-width="2.5" stroke-linejoin="round" stroke-linecap="round"/>${dots}`;
  }).join('');
  const peakVus = Math.max(PEAK_VUS, ...API_NAMES.flatMap((api) => WINDOWS.map((window) => (
    concurrency(summary, api, phaseAt(window), window)
  ))));
  const vusMax = Math.ceil(peakVus / 20) * 20;
  const vusGrid = [0, Math.ceil(vusMax / 2), vusMax].map((value) => {
    const y = vusBottom - value / vusMax * (vusBottom - vusTop);
    return `<line x1="${chartLeft}" y1="${y}" x2="${chartRight}" y2="${y}" stroke="#dfe4ee"/><text x="${chartLeft - 10}" y="${y + 4}" text-anchor="end">${value}</text>`;
  }).join('');
  const vusPoints = WINDOWS.map((window, index) => {
    const phase = phaseAt(window);
    const value = Math.max(...API_NAMES.map((api) => concurrency(summary, api, phase, window)));
    if (!value) return null;
    return {
      x: chartLeft + slotWidth * (index + 0.5),
      y: vusBottom - value / vusMax * (vusBottom - vusTop),
      value,
      window,
    };
  }).filter(Boolean);
  const vusPolyline = vusPoints.map(({ x, y }) => `${x},${y}`).join(' ');
  const vusDots = vusPoints.map(({ x, y, value, window }) => (
    `<circle cx="${x}" cy="${y}" r="3.5" fill="#354d89"><title>${window}: ${Math.round(value)} active VUs</title></circle>`
  )).join('');
  const xLabels = WINDOWS.map((window, index) => (
    `<text x="${chartLeft + slotWidth * (index + 0.5)}" y="306" text-anchor="middle">${Math.floor(Number(window.slice(0, 3)) / 60)}:${String(Number(window.slice(0, 3)) % 60).padStart(2, '0')}</text>`
  )).join('');
  const legend = Object.entries(colors).map(([api, color]) => (
    `<span><i style="background:${color}"></i>${escapeHtml(api.replaceAll('_', ' '))}</span>`
  )).join('');
  return `<div class="timeline-legend">${legend}<span><i style="background:#354d89"></i>Active VUs (lower chart)</span></div>
  <div class="chart-scroll"><svg viewBox="0 0 ${width} 320" role="img" aria-label="Ten-second p95 latency and active virtual user timeline">
    ${bands}${latencyGrid}<text x="16" y="108" transform="rotate(-90 16 108)">p95 latency (ms)</text>
    ${latencyLines}${vusGrid}<text x="16" y="267" transform="rotate(-90 16 267)">Active VUs</text>
    <polyline points="${vusPolyline}" fill="none" stroke="#354d89" stroke-width="2.5" stroke-linejoin="round"/>${vusDots}${xLabels}
  </svg></div><p class="chart-note">Each point summarizes one 10-second interval. Shading marks baseline, spike, recovery and ramp-down phases.</p>`;
}

function renderHtmlReport(report, summary) {
  const parsed = parseReportTables(report);
  const requests = API_NAMES.reduce((total, api) => total + requestCount(summary, api), 0)
    + managerIsolationRequestCount(summary);
  const errors = API_NAMES.reduce((total, api) => total + errorCount(summary, api), 0);
  const peakVus = API_NAMES.reduce((maximum, api) => Math.max(maximum, concurrency(summary, api)), 0);
  const duration = Number(summary.state && summary.state.testRunDurationMs) / 1000 || 0;
  const droppedIterations = summary.metrics?.dropped_iterations?.values?.count || 0;
  const thresholdFailure = Object.values(summary.metrics || {}).some((metric) => (
    Object.values(metric.thresholds || {}).some((threshold) => threshold.ok === false)
  ));
  const hasFailedGroup = parsed.tables.some(({ rows }) => rows.some((row) => row.some((cell) => cell.includes('***'))));
  const passed = !thresholdFailure && !hasFailedGroup;
  const run = summary.runMetadata || {};
  const latencyTable = parsed.tables.find(({ title }) => title.includes('PER-API LATENCY'));
  const latencyCards = (latencyTable ? latencyTable.rows.slice(1) : []).map((row) => {
    const api = row[0].startsWith('GET ') ? 'list_portfolios'
      : row[0].includes('/auth/register') ? 'signup'
        : row[0].includes('/auth/login') ? 'login' : 'create_portfolio';
    const p95 = Number(row[3]);
    const limit = P95_LIMITS[api];
    const width = Number.isFinite(p95) ? Math.min(100, p95 / limit * 100) : 0;
    return `<article class="latency"><div class="latency-top"><span>${escapeHtml(row[0])}</span><strong>${escapeHtml(row[3])}<small> ms p95</small></strong></div><div class="bar"><i style="width:${width.toFixed(1)}%"></i></div><div class="latency-foot"><span>Target &lt; ${limit} ms</span><span>${escapeHtml(row[7])} req/s</span></div></article>`;
  }).join('');
  const tableHtml = parsed.tables.map(({ title, rows }) => {
    const [headers, ...body] = rows;
    const head = (headers || []).map((cell) => `<th>${escapeHtml(cell)}</th>`).join('');
    const rowsHtml = body.map((row) => {
      const failed = row.some((cell) => cell.includes('***'))
        || row.some((cell) => cell.includes('First observed in'));
      return `<tr class="${failed ? 'failed' : ''}">${row.map((cell) => `<td>${escapeHtml(cell.replace(/\s*\*\*\*/g, ''))}</td>`).join('')}</tr>`;
    }).join('');
    return `<section class="panel"><h2>${escapeHtml(title.replace(/^TABLE \d+ — /, ''))}</h2><div class="table-scroll"><table><thead><tr>${head}</tr></thead><tbody>${rowsHtml}</tbody></table></div></section>`;
  }).join('');
  const verdictHtml = parsed.verdicts.map((verdict) => {
    const failed = verdict.includes(' first crossed a limit ');
    const endpoint = verdict.split(failed ? ' first crossed a limit ' : ' showed no threshold break')[0];
    const detail = verdict.slice(endpoint.length)
      .replace(/^ first crossed a limit /, 'First crossed a limit ')
      .replace(/^ showed no threshold break/, 'No threshold break');
    return `<article class="verdict ${failed ? 'failed' : ''}"><span class="badge">${failed ? 'BREAK' : 'PASS'}</span><div><strong>${escapeHtml(endpoint)}</strong><p>${escapeHtml(detail)}</p></div></article>`;
  }).join('');
  const timeline = renderTimeline(summary);
  const startedAt = run.startedAt
    || new Date(Date.now() - Number(summary.state?.testRunDurationMs || 0)).toISOString();
  const generatedAt = run.generatedAt || new Date().toISOString();
  return `<!doctype html>
<html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<meta name="color-scheme" content="light"><title>Portfolio API | Load test report</title>
<style>
:root{font-family:Inter,ui-sans-serif,system-ui,-apple-system,"Segoe UI",sans-serif;color:#172033;background:#f3f5fa;font-synthesis:none}*{box-sizing:border-box}
body{margin:0;min-width:320px}.hero{padding:38px max(24px,calc((100% - 1180px)/2));background:linear-gradient(120deg,#111b3b,#302a68 62%,#5547a7);color:white}
.eyebrow{font-size:12px;font-weight:750;letter-spacing:.14em;text-transform:uppercase;color:#b9c4ff}.hero h1{font-size:clamp(28px,4vw,42px);letter-spacing:-.04em;margin:10px 0 6px}.hero p{margin:0;color:#d4daf7;font-size:15px}
.status{display:inline-flex;align-items:center;gap:8px;margin-top:22px;border:1px solid #ffffff35;border-radius:999px;padding:7px 12px;font-size:12px;font-weight:750;letter-spacing:.06em;background:#ffffff12}.status:before{content:"";width:8px;height:8px;border-radius:50%;background:${passed ? '#51dfad' : '#ff7187'}}
main,footer{max-width:1180px;margin:auto;padding-left:24px;padding-right:24px}main{padding-top:28px;padding-bottom:64px}.summary{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:14px}
.stat,.panel,.latency,.verdict{background:white;border:1px solid #e5e9f2;border-radius:14px;box-shadow:0 5px 18px #19264a08}.stat{padding:18px}.stat span{display:block;color:#68738c;font-size:12px;font-weight:650}.stat strong{display:block;margin-top:8px;font-size:28px;letter-spacing:-.04em}.stat small{font-size:13px;color:#7b8499;font-weight:550;letter-spacing:0}
.section-title{display:flex;align-items:end;justify-content:space-between;gap:16px;margin:32px 0 14px}.section-title h2{font-size:20px;letter-spacing:-.025em;margin:0}.section-title p{margin:0;color:#737d93;font-size:13px}
.latency-grid{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:12px}.latency{padding:16px}.latency-top,.latency-foot{display:flex;justify-content:space-between;align-items:center;gap:12px}.latency-top span{font-weight:700;font-size:13px;overflow-wrap:anywhere}.latency-top strong{font-size:20px;white-space:nowrap}.latency-top small{font-size:11px;color:#78839a;font-weight:600}.latency-foot{margin-top:9px;color:#778198;font-size:11px}
.bar{height:7px;margin-top:14px;background:#edf0f7;border-radius:8px;overflow:hidden}.bar i{display:block;height:100%;background:linear-gradient(90deg,#6679ed,#9a69e8);border-radius:8px}.panel{margin-top:14px;overflow:hidden}.panel h2{margin:0;padding:18px 20px 14px;font-size:16px}
.timeline-legend{display:flex;flex-wrap:wrap;gap:12px 18px;padding:0 20px 10px;color:#65718a;font-size:11px}.timeline-legend span{display:inline-flex;align-items:center;gap:6px}.timeline-legend i{display:inline-block;width:9px;height:9px;border-radius:50%}.chart-scroll{overflow:auto;padding:4px 12px 0}.chart-scroll svg{display:block;width:100%;min-width:720px;height:auto}.chart-scroll text{font:10px system-ui,sans-serif;fill:#778198}.chart-note{margin:0;padding:2px 20px 16px;color:#778198;font-size:11px}
.table-scroll{overflow:auto}table{width:100%;border-collapse:collapse;text-align:left;font-size:13px;white-space:nowrap}th{padding:11px 15px;background:#f7f8fc;color:#66718a;font-size:11px;text-transform:uppercase;letter-spacing:.045em;font-weight:750;border-top:1px solid #edf0f6;border-bottom:1px solid #e9edf5}
td{padding:12px 15px;border-bottom:1px solid #eef1f6;color:#364158}tbody tr:last-child td{border-bottom:0}tbody tr:hover{background:#fafbfe}tr.failed{background:#fff4f5}tr.failed td{color:#9d3044}
.verdicts{display:grid;gap:10px}.verdict{display:flex;align-items:flex-start;gap:13px;padding:16px}.verdict strong{font-size:13px}.verdict p{margin:5px 0 0;color:#67728a;font-size:13px;line-height:1.55}.badge{flex:none;border-radius:7px;padding:4px 8px;font-size:10px;font-weight:800;letter-spacing:.06em;color:#08724f;background:#e5f8f0}.verdict.failed .badge{color:#a42d45;background:#ffeaee}
footer{padding-bottom:28px;color:#8790a3;font-size:12px}@media(max-width:780px){.summary{grid-template-columns:repeat(2,minmax(0,1fr))}.latency-grid{grid-template-columns:1fr}.section-title{align-items:flex-start;flex-direction:column}}
@media(max-width:430px){main,footer{padding-left:14px;padding-right:14px}.hero{padding-left:18px;padding-right:18px}.stat{padding:14px}.stat strong{font-size:24px}}
@media print{body{background:white}.hero{print-color-adjust:exact;-webkit-print-color-adjust:exact}.stat,.panel,.latency,.verdict{box-shadow:none;break-inside:avoid}main{padding-top:18px}}
</style></head><body>
<header class="hero"><div class="eyebrow">Load test • k6</div><h1>Portfolio API performance</h1><p>Latency, errors, scenario comparison and observed breakpoints in one report.</p><div class="status">${passed ? 'ALL THRESHOLDS PASSED' : 'THRESHOLDS CROSSED'}</div></header>
<main><div class="summary"><article class="stat"><span>Test duration</span><strong>${duration.toFixed(1)}<small> sec</small></strong></article>
<article class="stat"><span>HTTP requests</span><strong>${requests.toLocaleString()}</strong></article><article class="stat"><span>Application errors</span><strong>${errors.toLocaleString()}</strong></article>
<article class="stat"><span>Peak active VUs</span><strong>${Math.round(peakVus).toLocaleString()}</strong></article>
<article class="stat"><span>Dropped iterations</span><strong>${Math.round(droppedIterations).toLocaleString()}</strong></article>
<article class="stat"><span>Run started</span><strong class="date-value">${escapeHtml(startedAt)}</strong></article></div>
<section class="panel"><h2>Load timeline</h2>${timeline}</section>
<div class="section-title"><h2>Latency at a glance</h2><p>p95 response time against the configured endpoint target</p></div><div class="latency-grid">${latencyCards || '<div class="panel">No latency measurements were recorded.</div>'}</div>
${tableHtml}<div class="section-title"><h2>What happened</h2><p>Endpoint verdicts from measured thresholds and failures</p></div><div class="verdicts">${verdictHtml || '<div class="panel">No endpoint verdicts are available.</div>'}</div></main>
<footer>Started ${escapeHtml(startedAt)} • Generated ${escapeHtml(generatedAt)} • Self-contained HTML; no Grafana or external assets required.</footer>
</body></html>`;
}

function main() {
  const inputPath = process.argv[2];
  if (!inputPath) {
    console.error('Usage: node loadtest/reporter.js <k6-summary.json> [report.html]');
    process.exitCode = 2;
    return;
  }
  if (!fs.existsSync(inputPath)) {
    console.error(`Summary file not found: ${inputPath}`);
    process.exitCode = 2;
    return;
  }

  let summary;
  try {
    summary = JSON.parse(fs.readFileSync(inputPath, 'utf8'));
  } catch (error) {
    console.error(`Could not read valid k6 summary JSON from ${inputPath}: ${error.message}`);
    process.exitCode = 2;
    return;
  }

  const report = makeReport(summary);
  console.log(report);
  if (process.argv[3]) {
    const outputPath = path.resolve(process.argv[3]);
    const html = renderHtmlReport(report, summary);
    fs.writeFileSync(outputPath, html, 'utf8');
    console.log(`HTML report written to ${outputPath}`);
  }
}

if (require.main === module) {
  main();
}

module.exports = { makeReport, renderHtmlReport };
