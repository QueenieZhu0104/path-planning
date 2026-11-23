import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import { createRequire } from 'node:module';
import { existsSync, readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { isAllowedActivityHost, isAllowedUniversityHost } from '../functions/_lib/source-policy.js';
import activityRegistry from '../data/activity-sources.json' with { type: 'json' };
import programmeSourceRegistry from '../data/programme-sources.json' with { type: 'json' };
import universityRegistry from '../data/universities.json' with { type: 'json' };

const require = createRequire(import.meta.url);
const { chromium } = require('playwright');
const root = dirname(dirname(fileURLToPath(import.meta.url)));
const publicDir = join(root, 'public');
const activityById = new Map(activityRegistry.records.map(activity => [activity.id, activity]));
const programmeSourceById = new Map(programmeSourceRegistry.records.map(source => [source.id, source]));
const universityByName = new Map(universityRegistry.records.map(university => [university.name, university]));

function browserExecutable() {
  const candidates = [
    process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE,
    process.platform === 'win32' ? 'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe' : '',
    process.platform === 'win32' ? 'C:\\Program Files\\Microsoft\\Edge\\Application\\msedge.exe' : '',
    process.platform === 'win32' ? 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe' : ''
  ].filter(Boolean);
  return candidates.find(existsSync);
}

function startServer() {
  const server = createServer((request, response) => {
    const pathname = new URL(request.url, 'http://127.0.0.1').pathname;
    const file = pathname === '/' || pathname === '/index.html' ? join(publicDir, 'index.html') : join(publicDir, pathname.replace(/^\/+/, ''));
    if (!file.startsWith(publicDir) || !existsSync(file)) {
      response.writeHead(404, { 'content-type': 'text/plain; charset=utf-8' });
      response.end('Not found');
      return;
    }
    const contentType = file.endsWith('.json') ? 'application/json'
      : file.endsWith('.css') ? 'text/css; charset=utf-8'
        : file.endsWith('.js') ? 'text/javascript; charset=utf-8'
          : file.endsWith('.woff2') ? 'font/woff2'
            : file.endsWith('.woff') ? 'font/woff'
              : file.endsWith('.ttf') ? 'font/ttf'
                : 'text/html; charset=utf-8';
    response.writeHead(200, { 'content-type': contentType });
    response.end(readFileSync(file));
  });
  return new Promise(resolve => server.listen(0, '127.0.0.1', () => resolve(server)));
}

const syllabusPayload = {
  syllabus: {
    overview: '该页面把数据科学与经济问题联系起来；具体课程仍须打开来源核对。',
    learningAreas: [
      { title: '数学与统计', description: '用概率与统计方法分析证据。' },
      { title: '编程与数据', description: '清理、分析并呈现数据。' },
      { title: '经济学', description: '研究市场、激励与政策问题。' },
      { title: '综合应用', description: '把模型用于现实经济问题。' }
    ],
    projectIdeas: ['分析公开数据并说明限制。', '比较两种政策情景。', '制作可复现的分析报告。'],
    careerDirections: ['数据分析', '经济研究支持', '政策分析支持'],
    suitableFor: '喜欢数学、社会问题和证据推理的学生。',
    challenges: '模型结论取决于假设与数据质量。',
    comparison: '比纯经济学更强调数据与计算。',
    sourceEvidence: ['页面列出了 Data Science and Economics 项目。'],
    sourceLimitations: '只读取了提供的页面，没有核实全部课程。'
  },
  sourceUrl: 'https://chs.nus.edu.sg/programmes/dse/',
  sourceCoverage: 'programme-mentioned-on-source-page',
  generatedAt: '2026-10-19T12:00:00.000Z',
  provider: 'mock-browser-test'
};

const universityInfoPayload = {
  university: 'National University of Singapore',
  question: 'Programme information',
  info: {
    overview: '只整理了本次读取页面中能够定位的信息。',
    verifiedFacts: [{
      label: '页面主题',
      value: 'Data Science and Economics 项目信息',
      sourceUrl: 'https://chs.nus.edu.sg/programmes/dse/',
      quoteOrEvidence: '页面标题含项目名称。'
    }],
    notVerified: ['当前申请截止日期未从该页面核实。'],
    nextSteps: ['打开招生页面核对当前申请周期。'],
    overallStatus: 'partial-source'
  },
  sources: [{ url: 'https://chs.nus.edu.sg/programmes/dse/', retrievedAt: '2026-10-19T12:00:00.000Z', textLength: 900 }],
  retrievedAt: '2026-10-19T12:00:00.000Z',
  provider: 'mock-browser-test',
  notice: 'This is a model-generated, source-limited summary of only the supplied pages. Open each cited official page before relying on a critical fact.'
};

function routeEvidencePayload(body) {
  const activity = activityById.get(body.candidateActivityIds?.[0]) || null;
  const programmeSource = programmeSourceById.get(body.programmeSourceId);
  const universitySource = programmeSource?.url || universityByName.get(body.route.university)?.officialUrl || '';
  const planMatches = body.plannedActivityIds?.filter(id => body.candidateActivityIds?.includes(id)).length || 0;
  const retrievedAt = new Date().toISOString();
  const expiresAt = new Date(Date.now() + 48 * 60 * 60 * 1000).toISOString();
  return {
    schemaVersion: 1,
    route: body.route,
    freshness: {
      cacheStatus: 'miss',
      stale: false,
      retrievedAt,
      expiresAt,
      refreshPolicy: '48-hour TTL'
    },
    sources: [
      { url: universitySource, kind: 'university', retrievedAt },
      ...(activity ? [{ url: activity.url, kind: 'activity', activityId: activity.id, retrievedAt }] : [])
    ],
    sourceErrors: [],
    databaseEvidence: null,
    admissionsEvidence: {
      verifiedCriteria: [{ category: 'academic', value: 'Mock exact official source excerpt.', sourceUrl: universitySource, evidenceText: 'Mock exact official source excerpt.' }],
      extracurricularRequirementStatus: 'not-found-in-reviewed-sources',
      extracurricularRequirements: [],
      notVerified: ['No numeric admission cutoff was validated.']
    },
    activityEvidence: activity ? [{
      activityId: activity.id,
      name: activity.name,
      sourceUrl: activity.url,
      sourceRetrievedAt: retrievedAt,
      sourceStatus: 'official-source-read',
      relationship: activity.relationship,
      alignment: 'strong',
      reasonCode: 'discipline-tag-match',
      facts: [{ field: 'deadline', value: 'Mock exact activity source excerpt.', sourceUrl: activity.url, evidenceText: 'Mock exact activity source excerpt.' }]
    }] : [],
    routeAlignment: {
      overall: planMatches ? 'strong' : 'partial',
      dimensions: { officialUniversitySources: 1, activitySources: activity ? 1 : 0, verifiedAdmissionsCriteria: 1, directionMatchedActivities: activity ? 1 : 0, currentPlanMatches: planMatches },
      missingEvidence: ['extracurricular-requirement-not-validated']
    },
    model: { provider: 'mock-browser-test', role: 'source-evidence-normalizer', evidenceValidation: 'exact-source-text' },
    notice: 'Mocked browser response; no live source was fetched.'
  };
}

async function onboard(page) {
  await page.getByRole('button', { name: /简体中文/ }).click();
  await page.locator('input[placeholder="输入你的昵称"]').fill('浏览器测试');
  await page.getByRole('button', { name: '进入 Path' }).click();
  assert.equal(await page.getByText('先告诉 Path 一点点关于你').count(), 0);
}

async function openDiscoveryResults(page) {
  await page.evaluate(() => {
    localStorage.setItem('path_discovery_v63', JSON.stringify({
      step: 1,
      complete: false,
      interests: ['computing'],
      subjects: ['Further%20Mathematics', 'Undecided'],
      v65: true
    }));
  });
  await page.reload();
  await page.getByRole('button', { name: '探索', exact: true }).click();

  const furtherMaths = page.getByRole('button', { name: '高等数学', exact: true });
  const undecided = page.getByRole('button', { name: '还不确定', exact: true });
  assert.equal(await furtherMaths.getAttribute('aria-pressed'), 'true');
  assert.equal(await undecided.getAttribute('aria-pressed'), 'false');
  await undecided.click();
  assert.equal(await furtherMaths.getAttribute('aria-pressed'), 'false');
  assert.equal(await undecided.getAttribute('aria-pressed'), 'true');
  await page.getByRole('button', { name: '计算机', exact: true }).click();
  assert.equal(await undecided.getAttribute('aria-pressed'), 'false');
  for (const subject of ['数学', '物理', '化学']) {
    await page.getByRole('button', { name: subject, exact: true }).click();
  }
  assert.match(await page.locator('.discovery-count').innerText(), /已选 4\/4/);
  assert.equal(await page.getByRole('button', { name: '生物', exact: true }).isEnabled(), false);
  assert.equal(await undecided.isEnabled(), true);
  await undecided.click();
  assert.equal(await page.getByRole('button', { name: '数学', exact: true }).getAttribute('aria-pressed'), 'false');
  await page.getByRole('button', { name: '计算机', exact: true }).click();
  await page.getByRole('button', { name: '下一步 →' }).click();
  await page.getByRole('button', { name: '新加坡', exact: true }).click();
  await page.getByRole('button', { name: '查看方向 →' }).click();
}

const server = await startServer();
const address = server.address();
const executablePath = browserExecutable();
let browser;
try {
  browser = await chromium.launch({ headless: true, ...(executablePath ? { executablePath } : {}) });
  const page = await browser.newPage({ viewport: { width: 1280, height: 900 } });
  page.setDefaultTimeout(8_000);
  const browserErrors = [];
  page.on('pageerror', error => browserErrors.push(`pageerror: ${error.message}`));
  page.on('console', message => { if (message.type() === 'error') browserErrors.push(`console: ${message.text()}`); });

  let syllabusRequests = 0;
  let universityInfoRequests = 0;
  let activityDetailsRequests = 0;
  const routeEvidenceRequests = new Map();
  await page.route('**/api/syllabus', async route => {
    const body = route.request().postDataJSON();
    assert.equal(body.university, 'National University of Singapore');
    assert.equal(body.major, 'Data Science & Economics');
    assert.equal(new URL(body.sourceUrl).protocol, 'https:');
    syllabusRequests += 1;
    await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(syllabusPayload) });
  });
  await page.route('**/api/university-info', async route => {
    const body = route.request().postDataJSON();
    assert.equal(body.university, 'National University of Singapore');
    assert.deepEqual(body.sourceUrls, ['https://chs.nus.edu.sg/programmes/dse/']);
    universityInfoRequests += 1;
    await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(universityInfoPayload) });
  });
  await page.route('**/api/route-evidence', async route => {
    const body = route.request().postDataJSON();
    assert.ok(body.route.university);
    assert.ok(body.route.major);
    assert.equal('profile' in body, false, 'personal profile must not be sent to the cached evidence endpoint');
    assert.ok(body.candidateActivityIds.length <= 3);
    assert.equal('candidateActivities' in body, false, 'activity identity and URLs must be resolved by the server registry');
    for (const id of body.candidateActivityIds) assert.equal(activityById.has(id), true);
    assert.equal('sourceUrls' in body, false, 'university source URLs must be resolved from server IDs');
    if (body.programmeSourceId) {
      const source = programmeSourceById.get(body.programmeSourceId);
      assert.equal(source?.university, body.route.university);
      assert.equal(source?.major, body.route.major);
    }
    const key = `${body.route.university}|${body.route.major}`;
    routeEvidenceRequests.set(key, (routeEvidenceRequests.get(key) || 0) + 1);
    await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(routeEvidencePayload(body)) });
  });
  await page.route('**/api/activity-details?*', async route => {
    const id = new URL(route.request().url()).searchParams.get('id');
    const activity = activityById.get(id);
    assert.ok(activity, 'the activity detail endpoint must receive a registered ID');
    activityDetailsRequests += 1;
    const retrievedAt = new Date().toISOString();
    await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({
      schemaVersion: 1,
      activity: { id, name: activity.name, tags: activity.tags || [], relationship: activity.relationship },
      freshness: { cacheStatus: 'miss', stale: false, retrievedAt, expiresAt: new Date(Date.now() + 48 * 60 * 60 * 1000).toISOString(), refreshPolicy: '48-hour TTL' },
      source: { url: activity.url, retrievedAt },
      facts: [{ field: 'deadline', value: 'Mock exact organiser excerpt.', evidenceText: 'Mock exact organiser excerpt.', sourceUrl: activity.url }],
      notVerified: [],
      notice: 'Mocked browser response; no live source was fetched.'
    }) });
  });


  await page.goto(`http://127.0.0.1:${address.port}/`, { waitUntil: 'load' });
  assert.equal(await page.title(), 'Path — Live Activity Evidence & University Planning');
  assert.doesNotMatch(await page.title(), /V[0-9]+/i, 'the browser title must not expose a release number');
  const catalogue = await page.evaluate(() => ({
    universities: DATA.universities.map(u => ({ name: u.name, url: u.url, programmes: u.programs.length })),
    audit: window.PATH_FINAL_AUDIT
  }));
  assert.equal(catalogue.universities.length, 31);
  assert.equal(catalogue.audit.routes, 390);
  assert.deepEqual(catalogue.audit.issues, []);
  for (const university of catalogue.universities) {
    const url = new URL(university.url);
    assert.equal(url.protocol, 'https:', `${university.name} must use HTTPS`);
    assert.equal(isAllowedUniversityHost(url.hostname), true, `${url.hostname} must be in the backend allowlist`);
  }
  const activityHosts = await page.evaluate(() => [...new Set(ACTIVITY_ALL.filter(activity => activity?.verifiedSource === true && activity?.url).map(activity => new URL(activity.url).hostname))]);
  for (const host of activityHosts) assert.equal(isAllowedActivityHost(host), true, `${host} must be in the activity-source allowlist`);
  console.log('PASS: catalogue exposes 31 universities / 390 routes and every listed university host is allowed by both APIs');
  console.log(`PASS: all ${activityHosts.length} registered activity-source hosts are accepted by the separate organiser allowlist`);

  await onboard(page);
  await page.locator('.nav').waitFor();
  assert.match(await page.locator('body').innerText(), /从“我还不确定”开始/);
  assert.deepEqual(
    (await page.locator('.nav > button').allTextContents()).map(text => text.trim()),
    ['首页', '探索', '行动规划']
  );
  assert.equal(await page.locator('.path-consultant-nav, #path-consultant-launcher').count(), 0);
  assert.equal((await page.locator('body').innerText()).includes('CollegeSeek'), false);
  assert.doesNotMatch(await page.locator('body').innerText(), /V[0-9]+/i, 'the main navigation must not expose a release number');
  assert.equal(await page.getByRole('button', { name: '为你推荐', exact: true }).count(), 0);
  console.log('PASS: onboarding completes after language and nickname without an interest-selection gate');
  console.log('PASS: redundant For You, CollegeSeek, and Compare entries are absent while Home, Explore, and Plan remain');
  await page.getByRole('button', { name: '首页', exact: true }).first().click();
  await page.getByRole('button', { name: '繁', exact: true }).click();
  assert.equal(await page.getByRole('button', { name: '為你推薦', exact: true }).count(), 0);
  await page.getByRole('button', { name: '探索', exact: true }).click();
  assert.equal(await page.getByRole('button', { name: '電腦 / 科技', exact: true }).count(), 1);
  assert.equal(await page.getByRole('button', { name: '计算机 / 科技', exact: true }).count(), 0);
  await page.getByRole('button', { name: 'EN', exact: true }).click();
  assert.equal(await page.getByRole('button', { name: 'For You', exact: true }).count(), 0);
  await page.getByRole('button', { name: '简', exact: true }).click();
  console.log('PASS: Traditional Chinese Explore labels and the simplified navigation match the active language');

  await openDiscoveryResults(page);
  assert.match(await page.locator('body').innerText(), /你的方向探索结果/);
  assert.equal(await page.getByRole('button', { name: '查看专业 →' }).count(), 12);
  assert.match(await page.locator('body').innerText(), /Path 已收录的大学与专业目录/);
  console.log('PASS: Explore returns real University × Major directions');

  const fallbackAudit = await page.evaluate(() => ({
    field: getMeta('Nanyang Technological University', 'Computer Engineering').field,
    syllabusProfile: window.PATH_SYLLABUS.chooseProfile('Computer Engineering'),
    next: nextMoveFor('Nanyang Technological University', 'Computer Engineering')
  }));
  assert.equal(fallbackAudit.field, '计算机 · 工程');
  assert.equal(fallbackAudit.syllabusProfile, 'computer-engineering');
  assert.notEqual(fallbackAudit.next.title, 'Singapore Mathematical Olympiad (SMO) 2026');
  assert.notEqual(fallbackAudit.next.kind, 'activity');
  console.log('PASS: default programme metadata is discipline-specific and closed activities are not promoted as the next move');

  await page.getByRole('button', { name: '查看专业 →' }).nth(5).click();
  assert.match(await page.locator('body').innerText(), /National University of Singapore[\s\S]*Data Science & Economics/);
  await page.locator('[data-live-admissions] .path-live-badge').waitFor();
  const admissionsLiveText = await page.locator('[data-live-admissions]').innerText();
  assert.match(admissionsLiveText, /来源抓取时间[\s\S]*到期刷新时间[\s\S]*已写入 48 小时缓存/);
  assert.match(admissionsLiveText, /未找到对某项特定课外活动的明确要求/);
  const directionLiveText = await page.locator('[data-live-direction]').innerText();
  assert.match(directionLiveText, /Path 方向证据 · 不是大学要求/);
  assert.equal(routeEvidenceRequests.get('National University of Singapore|Data Science & Economics'), 1);
  await page.evaluate(() => {
    const state = Object.values(window.PATH_LIVE_ROUTE_EVIDENCE).find(item => item?.route?.m === 'Data Science & Economics');
    state.payload.freshness.expiresAt = '2000-01-01T00:00:00.000Z';
    state.nextAttemptAt = 0;
    render();
  });
  await page.waitForFunction(() => {
    const state = Object.values(window.PATH_LIVE_ROUTE_EVIDENCE||{}).find(item => item?.route?.m === 'Data Science & Economics');
    return state?.state === 'ready' && Date.parse(state.payload?.freshness?.expiresAt||0) > Date.now();
  });
  assert.equal(routeEvidenceRequests.get('National University of Singapore|Data Science & Economics'), 2, 'an expired ready state must refresh when the route is rendered again');
  assert.doesNotMatch(await page.locator('body').innerText(), /V[0-9]+/i, 'university and programme details must not expose a release number');
  console.log('PASS: University and Major detail render together');
  console.log('PASS: programme page separates mocked official admissions evidence from Path direction evidence and shows 48-hour freshness metadata');
  console.log('PASS: an expired in-memory route state triggers a fresh backend check instead of remaining frozen');

  const syllabusTabs = page.locator('.ps-tab');
  assert.equal(await syllabusTabs.count(), 4);
  for (const label of ['课程地图', '实践与技能', '可能就业', '适合谁']) {
    await syllabusTabs.filter({ hasText: label }).click();
    assert.equal(await page.locator('.ps-tab.active').innerText(), label);
    assert.ok((await page.locator('.ps-tab-content').innerText()).trim().length > 20);
  }
  console.log('PASS: all four Syllabus tabs render non-empty content');

  await page.getByRole('button', { name: 'AI 整理该校版本' }).click();
  await page.getByText(/已生成；官方页面文字提及该专业名称/).waitFor();
  assert.equal(syllabusRequests, 1);
  console.log('PASS: Syllabus API UI path sends the selected official programme source and renders a mocked structured response');

  await page.getByRole('button', { name: '查询大学官方最新信息' }).click();
  await page.getByText('官方来源整理结果').waitFor();
  assert.match(await page.locator('#path-live-university-info').innerText(), /与页面文字关联的信息（请打开来源复核）/);
  assert.match(await page.locator('#path-live-university-info').innerText(), /当前申请截止日期未从该页面核实/);
  assert.equal(universityInfoRequests, 1);
  console.log('PASS: university-info UI distinguishes source-linked claims from unverified items');

  await page.getByRole('button', { name: '加入我的方向' }).click();
  assert.equal(routeEvidenceRequests.get('National University of Singapore|Data Science & Economics'), 2, 'fresh rerender must reuse the route evidence response');
  await page.getByRole('button', { name: '查看活动 →' }).first().click();
  assert.equal(await page.evaluate(() => S.page), 'activity');
  assert.match(await page.locator('body').innerText(), /Singapore Mathematical Olympiad/);
  await page.locator('[data-live-activity-details] .path-activity-live-badge').waitFor();
  const liveActivityText = await page.locator('[data-live-activity-details]').innerText();
  assert.match(liveActivityText, /实时比赛详情[\s\S]*来源抓取时间[\s\S]*到期刷新时间[\s\S]*Mock exact organiser excerpt/);
  assert.match(liveActivityText, /每条记录满 48 小时后刷新/);
  assert.doesNotMatch(await page.locator('body').innerText(), /V[0-9]+/i, 'activity details must not expose a release number');
  assert.equal(activityDetailsRequests, 1);
  console.log('PASS: Activity detail reads a registered centralized 48-hour record and labels mocked source evidence');

  await page.getByRole('button', { name: '加入我的规划' }).click();
  console.log('PASS: Activity detail opens from the selected route');

  await page.getByRole('button', { name: '← 返回' }).click();
  await page.waitForFunction(() => Object.values(window.PATH_LIVE_ROUTE_EVIDENCE||{}).some(state => state?.route?.m==='Data Science & Economics' && state?.planSignature));
  assert.equal(routeEvidenceRequests.get('National University of Singapore|Data Science & Economics'), 3, 'changing the saved activity plan must recalculate alignment through a backend cache hit');
  await page.getByRole('button', { name: '← 返回' }).click();
  await page.getByText('Computer Science', { exact: true }).click();
  await page.getByRole('button', { name: '加入我的方向' }).click();
  await page.getByRole('button', { name: '行动规划', exact: true }).click();
  assert.match(await page.locator('body').innerText(), /Data Science & Economics[\s\S]*Computer Science/);
  console.log('PASS: Add to Path keeps two independent University × Major routes in Plan');

  await page.locator('#v74-reminder-title').fill('核对申请材料');
  await page.locator('#v74-reminder-date').fill('2026-11-01');
  await page.getByRole('button', { name: '添加提醒' }).click();
  assert.match(await page.locator('body').innerText(), /核对申请材料/);
  console.log('PASS: reminder creation persists in the current browser session');

  await page.getByRole('button', { name: '行动规划' }).click();

  for (const width of [320, 390, 768, 1024, 1440]) {
    await page.setViewportSize({ width, height: 900 });
    const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
    assert.ok(overflow <= 1, `unexpected horizontal page overflow at ${width}px: ${overflow}px`);
  }
  console.log('PASS: Plan has no page-level horizontal overflow at 320/390/768/1024/1440 CSS pixels');
  assert.equal(await page.getByRole('button', { name: /开始对比|比较这些方向/ }).count(), 0);
  await page.evaluate(() => nav('compare'));
  assert.equal(await page.evaluate(() => S.page), 'plan');
  assert.equal(await page.locator('[data-live-compare]').count(), 0);
  console.log('PASS: Compare has no entry, route, or live comparison panel; legacy navigation requests return to Plan');

  await page.getByRole('button', { name: '行动规划' }).click();
  page.once('dialog', dialog => dialog.accept());
  await page.getByRole('button', { name: '重新开始 Path' }).click();
  await page.getByText('Welcome to Path').waitFor();
  const pathKeys = await page.evaluate(() => Object.keys(localStorage).filter(key => key.toLowerCase().startsWith('path_')));
  assert.deepEqual(pathKeys, []);
  console.log('PASS: Reset returns to language onboarding and clears Path local-storage keys');

  assert.deepEqual(browserErrors, []);
  console.log(`PASS: real ${executablePath ? 'system Chromium-family browser' : 'Playwright Chromium'} run completed without page or console errors`);
  console.log('All browser UI checks passed. Every API response, including activity details and route evidence, was mocked; no live AI, university page, competition page, College Scorecard, or deployed site was used.');
} finally {
  if (browser) await browser.close();
  await new Promise(resolve => server.close(resolve));
}
