import http from 'k6/http';
import { check, sleep } from 'k6';
import exec from 'k6/execution';
import { Counter, Rate, Trend } from 'k6/metrics';

const BASE_URL = (__ENV.BASE_URL || 'http://localhost:8081').replace(/\/+$/, '');
const REPORT_PREFIX = __ENV.REPORT_PREFIX || 'loadtest-report';
const API_PATHS = {
  signup: '/api/auth/register',
  login: '/api/auth/login',
  create_portfolio: '/api/portfolios',
  list_portfolios: '/api/portfolios',
};
const TEST_PASSWORD = __ENV.TEST_PASSWORD || 'LoadTest-Portfolio-2026!';
const TEST_DURATION_SECONDS = 600;
const BASELINE_VUS = 100;
const PEAK_VUS = 1000;
const MANAGER_ISOLATION_USERS = 3;
const SCENARIO_GROUP = `G_${BASELINE_VUS}_to_${PEAK_VUS}_spike`;
const THINK_TIME_SECONDS = 2;
const AUTH_START_STAGGER_SECONDS = 0.15;
const AUTH_COHORT_SIZE = 60;
const PHASE_MESSAGES = {
  baseline: `holding the steady ${BASELINE_VUS}-user baseline`,
  spike_ramp_up_1: 'ramping up gradually from 100 toward 325 users',
  spike_ramp_up_2: 'ramping up gradually from 325 toward 550 users',
  spike_ramp_up_3: 'ramping up gradually from 550 toward 775 users',
  spike_ramp_up_4: `ramping up gradually from 775 toward ${PEAK_VUS} users`,
  spike_peak: `holding the ${PEAK_VUS}-user spike`,
  spike_ramp_down_1: 'ramping down from 1000 toward 500 users',
  spike_ramp_down_2: 'ramping down from 500 toward zero users',
};
const SIGNUP_PAYLOAD_TEMPLATE = Object.freeze({ email: '', username: '', password: '' });
const LOGIN_PAYLOAD_TEMPLATE = Object.freeze({ username: '', password: '' });
const PORTFOLIO_PAYLOAD_TEMPLATE = Object.freeze({
  name: '',
  type: 'AMOUNT',
  currency: 'INR',
  benchmark: 'NIFTY50',
  exchange: 'NSE',
  rebalanceFrequency: 'MONTHLY',
  amount: 1000,
});
const API_NAMES = ['signup', 'login', 'create_portfolio', 'list_portfolios'];
const PHASES = [
  { name: 'baseline', start: 0, end: 60 },
  { name: 'spike_ramp_up_1', start: 60, end: 120 },
  { name: 'spike_ramp_up_2', start: 120, end: 180 },
  { name: 'spike_ramp_up_3', start: 180, end: 240 },
  { name: 'spike_ramp_up_4', start: 240, end: 300 },
  { name: 'spike_peak', start: 300, end: 480 },
  { name: 'spike_ramp_down_1', start: 480, end: 540 },
  { name: 'spike_ramp_down_2', start: 540, end: 600 },
];
const P95_LIMITS = {
  signup: 2500,
  login: 2500,
  create_portfolio: 2500,
  list_portfolios: 2500,
};
const ERROR_LIMITS = {
  signup: 0.005,
  login: 0.005,
  create_portfolio: 0.01,
  list_portfolios: 0.005,
};

const apiMetrics = Object.fromEntries(API_NAMES.map((api) => [api, {
  duration: new Trend(`api_${api}_duration_ms`),
  errors: new Counter(`api_${api}_errors`),
}]));
const phaseDurations = new Trend('api_phase_duration_ms');
const windowDurations = new Trend('api_window_duration_ms');
const phaseErrors = new Counter('api_phase_errors');
const windowErrors = new Counter('api_window_errors');
const phaseActiveVus = new Trend('api_phase_vus_active');
const windowActiveVus = new Trend('api_window_vus_active');
const statusCounts = new Counter('api_status_count');
const timeoutCounts = new Counter('api_timeout_count');
const checkFailures = new Counter('api_check_failures');
const activeVus = new Trend('api_vus_active');
const managerIsolationSuccessRate = new Rate('manager_isolation_success_rate');
const portfolioCreateResponseWithId = new Counter('portfolio_create_response_with_id');
const portfolioPersistenceSuccessRate = new Rate('portfolio_persistence_success_rate');

function buildThresholds() {
  const thresholds = {
    'http_req_failed{api:signup}': ['rate<0.005'],
    'http_req_failed{api:login}': ['rate<0.005'],
    'http_req_failed{api:create_portfolio}': ['rate<0.01'],
    'http_req_failed{api:list_portfolios}': ['rate<0.005'],
    [`http_req_duration{group:${SCENARIO_GROUP}}`]: ['p(95)<3000'],
    'manager_isolation_success_rate{case:owner_access}': ['rate>=1'],
    'manager_isolation_success_rate{case:cross_manager_access}': ['rate>=1'],
    [`portfolio_persistence_success_rate{group:${SCENARIO_GROUP}}`]: ['rate>=1'],
  };
  const observedStatuses = ['0', '200', '201', '400', '401', '409', '429', '500', '502', '503'];

  for (const api of API_NAMES) {
    const p95 = P95_LIMITS[api];
    const p99 = api === 'create_portfolio' ? 3000 : api === 'list_portfolios' ? 1500 : 2000;
    thresholds[`http_req_duration{api:${api}}`] = [`p(95)<${p95}`, `p(99)<${p99}`];
    thresholds[`api_${api}_duration_ms{api:${api}}`] = [`p(95)<${p95}`, `p(99)<${p99}`];
    thresholds[`api_${api}_errors{api:${api}}`] = ['count>=0'];
    thresholds[`api_vus_active{api:${api}}`] = ['p(95)>=0'];
    thresholds[`api_timeout_count{api:${api}}`] = ['count>=0'];
    thresholds[`api_check_failures{api:${api}}`] = ['count>=0'];

    const scenarioTags = `{api:${api},group:${SCENARIO_GROUP}}`;
    thresholds[`http_req_duration${scenarioTags}`] = [`p(95)<${p95}`];
    thresholds[`http_req_failed${scenarioTags}`] = [`rate<${ERROR_LIMITS[api]}`];
    thresholds[`api_${api}_duration_ms${scenarioTags}`] = [`p(95)<${p95}`, `p(99)<${p99}`];
    thresholds[`api_${api}_errors${scenarioTags}`] = ['count>=0'];
    thresholds[`api_vus_active${scenarioTags}`] = ['p(95)>=0'];
    thresholds[`api_timeout_count${scenarioTags}`] = ['count>=0'];
    thresholds[`api_check_failures${scenarioTags}`] = ['count>=0'];
    for (const status of observedStatuses) {
      thresholds[`api_status_count${scenarioTags.replace('}', `,status:${status}}`)}`] = ['count>=0'];
    }

    for (const { name: phase } of PHASES) {
      const phaseTags = `{api:${api},phase:${phase}}`;
      const phaseScenarioTags = `{api:${api},group:${SCENARIO_GROUP},phase:${phase}}`;
      thresholds[`api_phase_duration_ms${phaseTags}`] = ['p(95)>=0'];
      thresholds[`api_phase_vus_active${phaseTags}`] = ['p(95)>=0'];
      thresholds[`api_phase_errors${phaseTags}`] = ['count>=0'];
      thresholds[`api_timeout_count${phaseScenarioTags}`] = ['count>=0'];
      thresholds[`api_check_failures${phaseScenarioTags}`] = ['count>=0'];
      for (const status of observedStatuses) {
        thresholds[`api_status_count${phaseScenarioTags.replace('}', `,status:${status}}`)}`] = ['count>=0'];
      }
    }

    for (let windowStart = 0; windowStart < TEST_DURATION_SECONDS; windowStart += 10) {
      const phase = PHASES.find(({ start, end }) => windowStart >= start && windowStart < end).name;
      const window = `${String(windowStart).padStart(3, '0')}-${String(windowStart + 10).padStart(3, '0')}`;
      const windowTags = `{api:${api},phase:${phase},window:${window}}`;
      thresholds[`api_window_duration_ms${windowTags}`] = ['p(95)>=0'];
      thresholds[`api_window_vus_active${windowTags}`] = ['p(95)>=0'];
    }
  }
  return thresholds;
}

export const options = {
  summaryTrendStats: ['avg', 'min', 'med', 'max', 'p(90)', 'p(95)', 'p(99)'],
  scenarios: {
    [SCENARIO_GROUP]: {
      executor: 'ramping-vus',
      exec: 'spikeTest',
      startVUs: BASELINE_VUS,
      stages: [
        { target: BASELINE_VUS, duration: '60s' },
        { target: 325, duration: '60s' },
        { target: 550, duration: '60s' },
        { target: 775, duration: '60s' },
        { target: PEAK_VUS, duration: '60s' },
        { target: PEAK_VUS, duration: '180s' },
        { target: 500, duration: '60s' },
        { target: 0, duration: '60s' },
      ],
      gracefulRampDown: '2s',
      gracefulStop: '5s',
      tags: { group: SCENARIO_GROUP },
    },
  },
  thresholds: buildThresholds(),
};

export function setup() {
  console.log('');
  console.log('=== Portfolio API load test starting ===');
  console.log(`Started: ${new Date().toISOString()}`);
  console.log(`API under test: ${BASE_URL}`);
  console.log(`Planned duration: about 10 minutes; the test starts with ${BASELINE_VUS} users and gradually ramps to ${PEAK_VUS}.`);
  console.log('Each virtual user has a manager account and portfolio, then repeatedly lists portfolios.');
  console.log(`Three accounts are prepared for isolation checks; the other ${PEAK_VUS - MANAGER_ISOLATION_USERS} sign up during the measured run.`);
  console.log(`New account setup is staggered slightly. Up to ${PEAK_VUS} test accounts and portfolios may be saved in the configured database.`);
  console.log(`The first ${MANAGER_ISOLATION_USERS} test managers will also verify that other managers cannot read their portfolios.`);
  console.log('Live progress is printed about every 10 seconds. Keep this terminal open until the final report appears.');
  console.log('========================================');

  const isolationManagers = [];
  for (let index = 0; index < MANAGER_ISOLATION_USERS; index += 1) {
    const username = `fm_isolation_${Date.now()}_${index}_${randomString(8)}`;
    const password = TEST_PASSWORD;
    const signupResponse = http.post(
      `${BASE_URL}${API_PATHS.signup}`,
      JSON.stringify({
        ...SIGNUP_PAYLOAD_TEMPLATE,
        email: `${username}@loadtest.invalid`,
        username,
        password,
      }),
      { headers: { 'Content-Type': 'application/json' } },
    );
    if (signupResponse.status !== 201) {
      throw new Error(`Could not prepare manager-isolation test user ${index + 1}: signup returned HTTP ${signupResponse.status}.`);
    }

    const loginResponse = http.post(
      `${BASE_URL}${API_PATHS.login}`,
      JSON.stringify({ ...LOGIN_PAYLOAD_TEMPLATE, username, password }),
      { headers: { 'Content-Type': 'application/json' } },
    );
    const loginResult = jsonBody(loginResponse);
    if (loginResponse.status !== 200 || !loginResult || typeof loginResult.token !== 'string') {
      throw new Error(`Could not prepare manager-isolation test user ${index + 1}: login returned HTTP ${loginResponse.status} or no token.`);
    }

    const portfolioResponse = http.post(
      `${BASE_URL}${API_PATHS.create_portfolio}`,
      JSON.stringify({ ...PORTFOLIO_PAYLOAD_TEMPLATE, name: `k6 isolation ${index + 1}` }),
      {
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${loginResult.token}`,
        },
      },
    );
    const portfolio = jsonBody(portfolioResponse);
    if (portfolioResponse.status !== 201 || !portfolio || !Number.isSafeInteger(portfolio.id)) {
      throw new Error(`Could not prepare manager-isolation test user ${index + 1}: portfolio creation returned HTTP ${portfolioResponse.status} or no portfolio ID.`);
    }

    isolationManagers.push({
      portfolioId: portfolio.id,
      authHeaders: { Authorization: `Bearer ${loginResult.token}` },
    });
  }
  console.log(`Prepared ${isolationManagers.length} manager-isolation accounts and portfolios.`);
  return { isolationManagers };
}

function randomString(length) {
  const characters = 'abcdefghijklmnopqrstuvwxyz0123456789';
  let value = '';
  for (let index = 0; index < length; index += 1) {
    value += characters.charAt(Math.floor(Math.random() * characters.length));
  }
  return value;
}

function jsonBody(response) {
  try {
    return JSON.parse(response.body);
  } catch (error) {
    return null;
  }
}

function currentLoadTags() {
  const elapsedSeconds = Math.max(
    0,
    Math.min(TEST_DURATION_SECONDS - 1, Math.floor(exec.scenario.progress * TEST_DURATION_SECONDS)),
  );
  const phase = PHASES.find(({ start, end }) => elapsedSeconds >= start && elapsedSeconds < end).name;
  const windowStart = Math.floor(elapsedSeconds / 10) * 10;
  return {
    phase,
    window: `${String(windowStart).padStart(3, '0')}-${String(windowStart + 10).padStart(3, '0')}`,
  };
}

function callApi(api, group, method, body, expectedStatus, headers = {}) {
  const loadTags = currentLoadTags();
  const tags = { api, group, ...loadTags };
  const start = Date.now();
  const response = http.request(
    method,
    `${BASE_URL}${API_PATHS[api]}`,
    body == null ? null : JSON.stringify(body),
    {
      headers: { 'Content-Type': 'application/json', ...headers },
      tags,
    },
  );
  const durationMs = Date.now() - start;

  apiMetrics[api].duration.add(durationMs, { api });
  phaseDurations.add(durationMs, { api, phase: loadTags.phase });
  windowDurations.add(durationMs, { api, ...loadTags });
  activeVus.add(exec.instance.vusActive, { api });
  phaseActiveVus.add(exec.instance.vusActive, { api, phase: loadTags.phase });
  windowActiveVus.add(exec.instance.vusActive, { api, ...loadTags });
  statusCounts.add(1, { ...tags, status: String(response.status) });
  if (response.status !== expectedStatus) {
    apiMetrics[api].errors.add(1, { api });
    phaseErrors.add(1, { api, phase: loadTags.phase });
    windowErrors.add(1, { api, ...loadTags });
  }
  if (response.error_code === 105 || /timeout|deadline/i.test(response.error || '')) {
    timeoutCounts.add(1, tags);
  }
  return response;
}

function checkStep(response, api, group, assertions) {
  const passed = check(response, assertions);
  if (!passed) {
    checkFailures.add(1, { api, group, ...currentLoadTags() });
  }
  return passed;
}

let vuSession;
let lastProgressWindow = -1;

function runManagerIsolationChecks(manager, managers, group) {
  for (const target of managers) {
    const ownsPortfolio = target.portfolioId === manager.portfolioId;
    const caseName = ownsPortfolio ? 'owner_access' : 'cross_manager_access';
    const expectedStatus = ownsPortfolio ? 200 : 404;
    const response = http.get(
      `${BASE_URL}${API_PATHS.list_portfolios}/${target.portfolioId}`,
      {
        headers: manager.authHeaders,
        tags: { api: 'manager_isolation', group, case: caseName, ...currentLoadTags() },
        responseCallback: http.expectedStatuses(200, 404),
      },
    );
    const passed = response.status === expectedStatus;
    check(response, {
      [ownsPortfolio
        ? 'manager can read their own portfolio'
        : 'manager cannot read another manager portfolio']: () => passed,
    });
    managerIsolationSuccessRate.add(passed ? 1 : 0, { case: caseName });
  }
}

function runFlow(group, testData) {
  if (!vuSession && __VU <= MANAGER_ISOLATION_USERS) {
    const manager = testData?.isolationManagers?.[__VU - 1];
    if (!manager) {
      throw new Error(`Manager-isolation setup data is missing for virtual user ${__VU}.`);
    }
    runManagerIsolationChecks(manager, testData.isolationManagers, group);
    vuSession = { authHeaders: manager.authHeaders };
  }

  if (vuSession) {
    const listResponse = callApi(
      'list_portfolios',
      group,
      'GET',
      null,
      200,
      vuSession.authHeaders,
    );
    checkStep(listResponse, 'list_portfolios', group, {
      'list portfolios returns 200': (response) => response.status === 200,
      'list portfolios response is an array': (response) => {
        const result = jsonBody(response);
        return Array.isArray(result);
      },
    });
    sleep(THINK_TIME_SECONDS);
    return;
  }

  sleep(((__VU - 1) % AUTH_COHORT_SIZE) * AUTH_START_STAGGER_SECONDS);

  const suffix = `${group.toLowerCase()}_${__VU}_${__ITER}_${Date.now()}_${randomString(8)}`;
  const email = `fm_${suffix}@loadtest.invalid`;
  const username = `fm_${suffix}`;
  const credentials = { username, password: TEST_PASSWORD };

  const signupResponse = callApi(
    'signup',
    group,
    'POST',
    { ...SIGNUP_PAYLOAD_TEMPLATE, email, username, password: TEST_PASSWORD },
    201,
  );
  checkStep(signupResponse, 'signup', group, {
    'signup returns 201': (response) => response.status === 201,
  });

  const loginResponse = callApi(
    'login',
    group,
    'POST',
    { ...LOGIN_PAYLOAD_TEMPLATE, ...credentials },
    200,
  );
  checkStep(loginResponse, 'login', group, {
    'login returns 200': (response) => response.status === 200,
    'login response contains a JWT token': (response) => {
      const result = jsonBody(response);
      return Boolean(result && typeof result.token === 'string' && result.token.length > 0);
    },
  });
  const loginResult = jsonBody(loginResponse);
  const authHeaders = loginResult && loginResult.token
    ? { Authorization: `Bearer ${loginResult.token}` }
    : {};
  vuSession = { authHeaders };

  const portfolioRequest = {
    ...PORTFOLIO_PAYLOAD_TEMPLATE,
    name: `k6 ${group} ${__VU} ${randomString(6)}`,
  };
  const createResponse = callApi(
    'create_portfolio',
    group,
    'POST',
    portfolioRequest,
    201,
    authHeaders,
  );
  const createdPortfolio = jsonBody(createResponse);
  const hasCreatedPortfolioId = createResponse.status === 201
    && createdPortfolio
    && Number.isSafeInteger(createdPortfolio.id);
  if (hasCreatedPortfolioId) {
    portfolioCreateResponseWithId.add(1, { group: SCENARIO_GROUP });
  }
  checkStep(createResponse, 'create_portfolio', group, {
    'create portfolio returns 201': (response) => response.status === 201,
    'create portfolio response contains an ID': () => Boolean(hasCreatedPortfolioId),
  });

  const listResponse = callApi(
    'list_portfolios',
    group,
    'GET',
    null,
    200,
    authHeaders,
  );
  checkStep(listResponse, 'list_portfolios', group, {
    'list portfolios returns 200': (response) => response.status === 200,
    'list portfolios response is an array': (response) => {
      const result = jsonBody(response);
      return Array.isArray(result);
    },
    'newly created portfolio is present after listing': (response) => {
      const result = jsonBody(response);
      return Boolean(
        response.status === 200
        && hasCreatedPortfolioId
        && Array.isArray(result)
        && result.some((portfolio) => portfolio && portfolio.id === createdPortfolio.id),
      );
    },
  });
  const listedPortfolios = jsonBody(listResponse);
  const persisted = Boolean(
    listResponse.status === 200
    && hasCreatedPortfolioId
    && Array.isArray(listedPortfolios)
    && listedPortfolios.some((portfolio) => portfolio && portfolio.id === createdPortfolio.id),
  );
  portfolioPersistenceSuccessRate.add(persisted, { group: SCENARIO_GROUP });
  sleep(THINK_TIME_SECONDS);
}

export function spikeTest(testData) {
  if (__VU === 1) {
    const elapsed = Math.min(
      TEST_DURATION_SECONDS - 1,
      Math.floor(exec.scenario.progress * TEST_DURATION_SECONDS),
    );
    const windowIndex = Math.floor(elapsed / 10);
    if (windowIndex > lastProgressWindow) {
      lastProgressWindow = windowIndex;
      const minutes = Math.floor(elapsed / 60);
      const seconds = String(elapsed % 60).padStart(2, '0');
      const { phase } = currentLoadTags();
      console.log(
        `[Progress ~${minutes}:${seconds}] ${PHASE_MESSAGES[phase]}. `
        + `k6 currently reports ${exec.instance.vusActive} active virtual users.`,
      );
    }
  }
  runFlow(SCENARIO_GROUP, testData);
}

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
  const phase = PHASES.find(({ start, end }) => {
    const windowStart = Number(window.slice(0, 3));
    return windowStart >= start && windowStart < end;
  }).name;
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

function portfolioWriteVerificationRows(data) {
  const measuredAttempts = requestCount(data, 'create_portfolio');
  const measuredCreated = countFor(data, 'portfolio_create_response_with_id', {});
  const persistence = metricValues(
    data,
    'portfolio_persistence_success_rate',
    { group: SCENARIO_GROUP },
  );
  const measuredVerified = persistence && Number.isFinite(persistence.passes) ? persistence.passes : 0;
  const measuredUnverified = measuredAttempts - measuredVerified;
  const isolation = metricValues(data, 'manager_isolation_success_rate', { case: 'owner_access' });
  const isolationAttempts = isolation && Number.isFinite(isolation.passes + isolation.fails)
    ? isolation.passes + isolation.fails
    : 0;
  const isolationVerified = isolation && Number.isFinite(isolation.passes) ? isolation.passes : 0;
  const isolationUnverified = isolationAttempts - isolationVerified;
  const unconfirmedCell = (count) => `${count}${count > 0 ? ' ***' : ''}`;
  return [
    ['Measured load', String(measuredAttempts), String(measuredCreated), String(measuredVerified), unconfirmedCell(measuredUnverified)],
    ['Isolation setup', String(isolationAttempts), String(isolationAttempts), String(isolationVerified), unconfirmedCell(isolationUnverified)],
    [
      'Total',
      String(measuredAttempts + isolationAttempts),
      String(measuredCreated + isolationAttempts),
      String(measuredVerified + isolationVerified),
      unconfirmedCell(measuredUnverified + isolationUnverified),
    ],
  ];
}

function concurrency(data, api, phase = null, window = null) {
  if (window) return metricValues(data, 'api_window_vus_active', { api, phase, window })?.max || 0;
  const values = phase
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
  return { values, requests, errors, errorPercent, p95, failed };
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
    const phaseDuration = end - start;
    return [
      `${start}-${end}s ${phase}`,
      String(active),
      String(requests),
      formatNumber(phaseDuration > 0 ? requests / phaseDuration : NaN, 2),
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
    '',
    'TABLE 7 — PORTFOLIO WRITE VERIFICATION',
    formatTable(
      ['Scope', 'Create attempts', '201 + ID', 'Read-back confirmed', 'Not confirmed'],
      portfolioWriteVerificationRows(data),
    ),
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
    const failureP95 = formatNumber(firstFailure.result.p95);
    const statusCode = [409, 500, 503, 401, 429, 400]
      .find((status) => statusCount(data, api, status, firstFailure.phase) > 0);
    const statusPercentage = statusCode
      ? statusCount(data, api, statusCode, firstFailure.phase) / firstFailure.result.requests * 100
      : 0;
    const concurrencyText = firstFailure.vus > 0 ? Math.round(firstFailure.vus) : 'unavailable';
    const mode = classifyFailure(data, api, firstFailure.phase);
    const latencyStatement = baseline
      ? `p95 rose from ${formatNumber(baseline.result.p95)}ms to ${failureP95}ms`
      : `p95 was ${failureP95}ms with no passing baseline`;
    return `${method} ${path} first crossed a limit during ${firstFailure.phase} at ${concurrencyText} active users — ${mode}; ${latencyStatement}; ${formatNumber(statusPercentage, 2)}% returned HTTP ${statusCode || 'errors'}.`;
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
  return String(value).replace(/[&<>"']/g, (character) => ({
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#39;',
  })[character]);
}

function parseReportTables(report) {
  const lines = report.split('\n');
  const tables = [];
  const verdicts = [];
  let table;
  let readingVerdicts = false;

  for (const line of lines) {
    if (line === 'VERDICTS') {
      readingVerdicts = true;
      table = null;
      continue;
    }
    if (readingVerdicts) {
      if (line.startsWith('- ')) verdicts.push(line.slice(2));
      continue;
    }
    if (line.startsWith('TABLE ')) {
      table = { title: line, rows: [] };
      tables.push(table);
    } else if (table && line.startsWith('|') && !line.startsWith('|-')) {
      table.rows.push(line.split('|').slice(1, -1).map((cell) => cell.trim()));
    }
  }
  return { tables, verdicts };
}

function renderTimeline(data) {
  const colors = {
    signup: '#6659d9',
    login: '#1b9a86',
    create_portfolio: '#e29435',
    list_portfolios: '#d6536d',
  };
  const windows = Array.from({ length: TEST_DURATION_SECONDS / 10 }, (_, index) => {
    const start = index * 10;
    return `${String(start).padStart(3, '0')}-${String(start + 10).padStart(3, '0')}`;
  });
  const left = 76;
  const right = 930;
  const slot = (right - left) / windows.length;
  const top = 32;
  const bottom = 190;
  const vusTop = 228;
  const vusBottom = 280;
  const maxLatency = Math.max(...Object.values(P95_LIMITS), 1500);
  const phaseFor = (window) => {
    const start = Number(window.slice(0, 3));
    return PHASES.find(({ start: phaseStart, end }) => start >= phaseStart && start < end).name;
  };
  const bands = windows.map((window, index) => {
    const phase = phaseFor(window);
    const fill = phase.startsWith('spike') ? '#fff0f2' : phase === 'baseline' ? '#eef3ff' : '#edf8f4';
    return `<rect x="${left + index * slot}" y="${top}" width="${slot}" height="${vusBottom - top}" fill="${fill}"/>`;
  }).join('');
  const latencyGrid = Array.from(
    { length: Math.ceil(maxLatency / 500) + 1 },
    (_, index) => index * 500,
  ).map((value) => {
    const y = bottom - value / maxLatency * (bottom - top);
    return `<line x1="${left}" y1="${y}" x2="${right}" y2="${y}" stroke="#dfe4ee"/><text x="${left - 10}" y="${y + 4}" text-anchor="end">${value}</text>`;
  }).join('');
  const latencyLines = API_NAMES.map((api) => {
    const points = windows.map((window, index) => {
      const values = windowDurationValues(data, api, window);
      if (!values || !Number.isFinite(values['p(95)'])) return null;
      return {
        x: left + slot * (index + 0.5),
        y: bottom - Math.min(values['p(95)'], maxLatency) / maxLatency * (bottom - top),
        value: values['p(95)'],
        window,
      };
    }).filter(Boolean);
    const line = points.map(({ x, y }) => `${x},${y}`).join(' ');
    const dots = points.map(({ x, y, value, window }) => (
      `<circle cx="${x}" cy="${y}" r="3.5" fill="${colors[api]}"><title>${api} ${window}: p95 ${Math.round(value)} ms</title></circle>`
    )).join('');
    return points.length ? `<polyline points="${line}" fill="none" stroke="${colors[api]}" stroke-width="2.5" stroke-linejoin="round"/>${dots}` : '';
  }).join('');
  const maxVus = PEAK_VUS;
  const vusGrid = [0, BASELINE_VUS, PEAK_VUS].map((value) => {
    const y = vusBottom - value / maxVus * (vusBottom - vusTop);
    return `<line x1="${left}" y1="${y}" x2="${right}" y2="${y}" stroke="#dfe4ee"/><text x="${left - 10}" y="${y + 4}" text-anchor="end">${value}</text>`;
  }).join('');
  const vusPoints = windows.map((window, index) => {
    const phase = phaseFor(window);
    const value = Math.max(...API_NAMES.map((api) => concurrency(data, api, phase, window)));
    return value ? {
      x: left + slot * (index + 0.5),
      y: vusBottom - value / maxVus * (vusBottom - vusTop),
      value,
      window,
    } : null;
  }).filter(Boolean);
  const vusLine = vusPoints.map(({ x, y }) => `${x},${y}`).join(' ');
  const vusDots = vusPoints.map(({ x, y, value, window }) => (
    `<circle cx="${x}" cy="${y}" r="3.5" fill="#354d89"><title>${window}: ${Math.round(value)} active VUs</title></circle>`
  )).join('');
  const labels = windows.map((window, index) => {
    const seconds = Number(window.slice(0, 3));
    return `<text x="${left + slot * (index + 0.5)}" y="306" text-anchor="middle">${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, '0')}</text>`;
  }).join('');
  const legend = Object.entries(colors).map(([api, color]) => (
    `<span><i style="background:${color}"></i>${escapeHtml(api.replace(/_/g, ' '))}</span>`
  )).join('');
  return `<div class="timeline-legend">${legend}<span><i style="background:#354d89"></i>Active VUs (lower chart)</span></div>
    <div class="chart-scroll"><svg viewBox="0 0 960 320" role="img" aria-label="Ten-second p95 latency and active virtual user timeline">
    ${bands}${latencyGrid}<text x="16" y="108" transform="rotate(-90 16 108)">p95 latency (ms)</text>
    ${latencyLines}${vusGrid}<text x="16" y="267" transform="rotate(-90 16 267)">Active VUs</text>
    <polyline points="${vusLine}" fill="none" stroke="#354d89" stroke-width="2.5" stroke-linejoin="round"/>${vusDots}${labels}
    </svg></div><p class="chart-note">Each point summarizes a 10-second interval. Shading marks baseline, spike, recovery and ramp-down phases.</p>`;
}

function renderHtmlReport(report, data) {
  const parsed = parseReportTables(report);
  const requests = API_NAMES.reduce((total, api) => total + requestCount(data, api), 0)
    + managerIsolationRequestCount(data);
  const errors = API_NAMES.reduce((total, api) => total + errorCount(data, api), 0);
  const peakVus = API_NAMES.reduce((maximum, api) => Math.max(maximum, concurrency(data, api)), 0);
  const duration = Number(data.state && data.state.testRunDurationMs) / 1000 || 0;
  const droppedIterations = data.metrics?.dropped_iterations?.values?.count || 0;
  const run = data.runMetadata || {};
  const thresholdFailure = Object.values(data.metrics || {}).some((metric) => (
    Object.values(metric.thresholds || {}).some((threshold) => threshold.ok === false)
  ));
  const hasFailedGroup = parsed.tables.some(({ rows }) => rows.some((row) => row.some((cell) => cell.includes('***'))));
  const passed = !thresholdFailure && !hasFailedGroup;
  const latencyTable = parsed.tables.find(({ title }) => title.includes('PER-API LATENCY'));
  const latencyRows = latencyTable ? latencyTable.rows.slice(1) : [];
  const latencyCards = latencyRows.map((row) => {
    const api = row[0].startsWith('GET ') ? 'list_portfolios'
      : row[0].includes('/auth/register') ? 'signup'
        : row[0].includes('/auth/login') ? 'login' : 'create_portfolio';
    const p95 = Number(row[3]);
    const limit = P95_LIMITS[api];
    const width = Number.isFinite(p95) && limit ? Math.min(100, p95 / limit * 100) : 0;
    return `<article class="latency-card">
      <div class="latency-card__top"><span>${escapeHtml(row[0])}</span><strong>${escapeHtml(row[3])}<small> ms p95</small></strong></div>
      <div class="bar"><span style="width:${width.toFixed(1)}%"></span></div>
      <div class="latency-card__foot"><span>Target &lt; ${limit} ms</span><span>${escapeHtml(row[7])} req/s</span></div>
    </article>`;
  }).join('');
  const tableHtml = parsed.tables.map(({ title, rows }) => {
    const [headers, ...body] = rows;
    const headerHtml = (headers || []).map((cell) => `<th>${escapeHtml(cell)}</th>`).join('');
    const bodyHtml = body.map((row) => {
      const failed = row.some((cell) => cell.includes('***'))
        || row.some((cell) => cell.includes('First observed in'));
      const cells = row.map((cell) => {
        const cleanCell = cell.replace(/\s*\*\*\*/g, '');
        return `<td>${escapeHtml(cleanCell)}</td>`;
      }).join('');
      return `<tr class="${failed ? 'row-fail' : ''}">${cells}</tr>`;
    }).join('');
    return `<section class="panel"><div class="panel__heading"><h2>${escapeHtml(title.replace(/^TABLE \d+ — /, ''))}</h2></div><div class="table-scroll"><table><thead><tr>${headerHtml}</tr></thead><tbody>${bodyHtml}</tbody></table></div></section>`;
  }).join('');
  const verdictHtml = parsed.verdicts.map((verdict) => {
    const failed = verdict.includes(' first crossed a limit ');
    const endpoint = verdict.split(failed ? ' first crossed a limit ' : ' showed no threshold break')[0];
    return `<article class="verdict ${failed ? 'verdict--fail' : 'verdict--pass'}">
      <span class="badge">${failed ? 'BREAK' : 'PASS'}</span>
      <div><strong>${escapeHtml(endpoint)}</strong><p>${escapeHtml(verdict.slice(endpoint.length).replace(/^ first crossed a limit /, 'First crossed a limit ').replace(/^ showed no threshold break/, 'No threshold break'))}</p></div>
    </article>`;
  }).join('');
  const timeline = renderTimeline(data);
  const startedAt = run.startedAt
    || new Date(Date.now() - Number(data.state?.testRunDurationMs || 0)).toISOString();
  const generatedAt = run.generatedAt || new Date().toISOString();
  const esc = escapeHtml;

  return `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <meta name="color-scheme" content="light">
  <title>Portfolio API | Load test report</title>
  <style>
    :root{font-family:Inter,ui-sans-serif,system-ui,-apple-system,"Segoe UI",sans-serif;color:#172033;background:#f3f5fa;font-synthesis:none}
    *{box-sizing:border-box}body{margin:0;min-width:320px}.hero{padding:38px max(24px,calc((100% - 1180px)/2));background:linear-gradient(120deg,#111b3b,#302a68 62%,#5547a7);color:white}
    .eyebrow{font-size:12px;font-weight:750;letter-spacing:.14em;text-transform:uppercase;color:#b9c4ff}.hero h1{font-size:clamp(28px,4vw,42px);letter-spacing:-.04em;margin:10px 0 6px}.hero p{margin:0;color:#d4daf7;font-size:15px}
    .status-pill{display:inline-flex;align-items:center;gap:8px;margin-top:22px;border:1px solid #ffffff35;border-radius:999px;padding:7px 12px;font-size:12px;font-weight:750;letter-spacing:.06em;background:#ffffff12}.status-pill:before{content:"";width:8px;height:8px;border-radius:50%;background:${passed ? '#51dfad' : '#ff7187'}}
    main{max-width:1180px;margin:0 auto;padding:28px 24px 64px}.summary{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:14px;margin-top:-2px}.stat,.panel,.latency-card,.verdict{background:white;border:1px solid #e5e9f2;border-radius:14px;box-shadow:0 5px 18px #19264a08}
    .stat{padding:18px}.stat span{display:block;color:#68738c;font-size:12px;font-weight:650}.stat strong{display:block;margin-top:8px;font-size:28px;letter-spacing:-.04em}.stat small{font-size:13px;color:#7b8499;font-weight:550;letter-spacing:0}
    .section-title{display:flex;align-items:end;justify-content:space-between;gap:16px;margin:32px 0 14px}.section-title h2{font-size:20px;letter-spacing:-.025em;margin:0}.section-title p{margin:0;color:#737d93;font-size:13px}
    .latency-grid{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:12px}.latency-card{padding:16px}.latency-card__top,.latency-card__foot{display:flex;justify-content:space-between;align-items:center;gap:12px}.latency-card__top span{font-weight:700;font-size:13px;overflow-wrap:anywhere}.latency-card__top strong{font-size:20px;white-space:nowrap}.latency-card__top small{font-size:11px;color:#78839a;font-weight:600}.latency-card__foot{margin-top:9px;color:#778198;font-size:11px}.bar{height:7px;margin-top:14px;background:#edf0f7;border-radius:8px;overflow:hidden}.bar span{display:block;height:100%;background:linear-gradient(90deg,#6679ed,#9a69e8);border-radius:8px}
    .timeline-legend{display:flex;flex-wrap:wrap;gap:12px 18px;padding:0 20px 10px;color:#65718a;font-size:11px}.timeline-legend span{display:inline-flex;align-items:center;gap:6px}.timeline-legend i{display:inline-block;width:9px;height:9px;border-radius:50%}.chart-scroll{overflow:auto;padding:4px 12px 0}.chart-scroll svg{display:block;width:100%;min-width:720px;height:auto}.chart-scroll text{font:10px system-ui,sans-serif;fill:#778198}.chart-note{margin:0;padding:2px 20px 16px;color:#778198;font-size:11px}.date-value{font-size:14px!important;letter-spacing:0!important;overflow-wrap:anywhere}.run-time{margin-top:12px!important;font-size:12px!important}
    .panel{margin-top:14px;overflow:hidden}.panel__heading{padding:18px 20px 14px}.panel__heading h2{margin:0;font-size:16px;letter-spacing:-.015em}.table-scroll{overflow:auto}table{width:100%;border-collapse:collapse;text-align:left;font-size:13px;white-space:nowrap}th{padding:11px 15px;background:#f7f8fc;color:#66718a;font-size:11px;text-transform:uppercase;letter-spacing:.045em;font-weight:750;border-top:1px solid #edf0f6;border-bottom:1px solid #e9edf5}td{padding:12px 15px;border-bottom:1px solid #eef1f6;color:#364158}tbody tr:last-child td{border-bottom:0}tbody tr:hover{background:#fafbfe}.row-fail{background:#fff4f5}.row-fail td{color:#9d3044}.verdicts{display:grid;gap:10px}.verdict{display:flex;align-items:flex-start;gap:13px;padding:16px}.verdict strong{font-size:13px}.verdict p{margin:5px 0 0;color:#67728a;font-size:13px;line-height:1.55}.badge{flex:none;border-radius:7px;padding:4px 8px;font-size:10px;font-weight:800;letter-spacing:.06em}.verdict--pass .badge{color:#08724f;background:#e5f8f0}.verdict--fail .badge{color:#a42d45;background:#ffeaee}
    footer{max-width:1180px;margin:auto;padding:0 24px 28px;color:#8790a3;font-size:12px}.empty{padding:24px;color:#78839a;text-align:center}
    @media(max-width:780px){.summary{grid-template-columns:repeat(2,minmax(0,1fr))}.latency-grid{grid-template-columns:1fr}.section-title{align-items:flex-start;flex-direction:column}}
    @media(max-width:430px){main{padding-left:14px;padding-right:14px}.hero{padding-left:18px;padding-right:18px}.stat{padding:14px}.stat strong{font-size:24px}}
    @media print{body{background:white}.hero{print-color-adjust:exact;-webkit-print-color-adjust:exact}.stat,.panel,.latency-card,.verdict{box-shadow:none;break-inside:avoid}main{padding-top:18px}}
  </style>
</head>
<body>
  <header class="hero"><div class="eyebrow">Load test • k6</div><h1>Portfolio API performance</h1><p>${BASELINE_VUS}-user baseline, gradual ramp to ${PEAK_VUS}, sustained peak, then ramp-down — 10-minute load profile.</p><div class="status-pill">${passed ? 'ALL THRESHOLDS PASSED' : 'THRESHOLDS CROSSED'}</div><p class="run-time">Started ${esc(startedAt)} · Generated ${esc(generatedAt)}</p></header>
  <main>
    <div class="summary">
      <article class="stat"><span>Test duration</span><strong>${esc(duration.toFixed(1))}<small> sec</small></strong></article>
      <article class="stat"><span>HTTP requests</span><strong>${esc(requests.toLocaleString())}</strong></article>
      <article class="stat"><span>Application errors</span><strong>${esc(errors.toLocaleString())}</strong></article>
      <article class="stat"><span>Peak active VUs</span><strong>${esc(Math.round(peakVus).toLocaleString())}</strong></article>
      <article class="stat"><span>Dropped iterations</span><strong>${esc(Math.round(droppedIterations).toLocaleString())}</strong></article>
    </div>
    <section class="panel"><div class="panel__heading"><h2>Load timeline · p95 and active users</h2></div>${timeline}</section>
    <div class="section-title"><h2>Latency at a glance</h2><p>p95 response time against the configured endpoint target</p></div>
    <div class="latency-grid">${latencyCards || '<div class="panel empty">No latency measurements were recorded.</div>'}</div>
    ${tableHtml}
    <div class="section-title"><h2>What happened</h2><p>Per-endpoint verdicts based on measured thresholds and failures</p></div>
    <div class="verdicts">${verdictHtml || '<div class="panel empty">No endpoint verdicts are available.</div>'}</div>
  </main>
  <footer>Started ${esc(startedAt)} • Generated ${esc(generatedAt)} • Based on k6 summary metrics • Self-contained HTML; no Grafana or external assets required.</footer>
</body>
</html>`;
}

export function handleSummary(data) {
  const durationMs = Number(data.state && data.state.testRunDurationMs) || 0;
  const generatedAt = new Date().toISOString();
  data.runMetadata = {
    startedAt: new Date(Date.now() - durationMs).toISOString(),
    generatedAt,
    profile: `${BASELINE_VUS} VUs for 60s; ramp to 325, 550, 775, then ${PEAK_VUS} over four 60s stages; hold ${PEAK_VUS} for 180s; ramp down to 500 and then 0 over two 60s stages`,
    plannedDurationSeconds: TEST_DURATION_SECONDS,
    requestedPeakVus: PEAK_VUS,
    timeBucketSeconds: 10,
  };
  const report = makeReport(data);
  const html = renderHtmlReport(report, data);
  return {
    stdout: [
      '=== Portfolio API load test finished ===',
      `HTML dashboard: ${REPORT_PREFIX}.html`,
      `Text summary:   ${REPORT_PREFIX}.txt`,
      `Raw k6 data:    ${REPORT_PREFIX}.json`,
      'Open the HTML dashboard for the latency timeline and phase-by-phase results.',
      '',
      report,
      '',
    ].join('\n'),
    [`${REPORT_PREFIX}.html`]: html,
    [`${REPORT_PREFIX}.txt`]: `${report}\n`,
    [`${REPORT_PREFIX}.json`]: JSON.stringify(data, null, 2),
  };
}
