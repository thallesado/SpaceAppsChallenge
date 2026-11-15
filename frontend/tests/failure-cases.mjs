import assert from 'node:assert/strict';
import { existsSync, readdirSync, mkdirSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium } from '@playwright/test';
const frontend = join(dirname(fileURLToPath(import.meta.url)), '..');
const root = process.env.LOCALAPPDATA ? join(process.env.LOCALAPPDATA, 'ms-playwright') : '';
const installed = root && existsSync(root) ? readdirSync(root).filter(n => /^chromium-/.test(n)).sort().reverse().map(n => join(root, n, 'chrome-win64/chrome.exe')).find(existsSync) : undefined;
const browser = await chromium.launch({ headless: true, executablePath: process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE || installed, args: ['--enable-unsafe-swiftshader'] });
const report = { kind: 'Browser fault injection; failures are simulated, not NASA outages', cases: [], moonTrekRequests: 0 };
async function check(name, route, verify) {
  const context = await browser.newContext();
  const page = await context.newPage();
  page.on('request', r => { if (/trek\.nasa\.gov|\/api\/v1\/maps\//.test(r.url())) report.moonTrekRequests++; });
  try {
    await route(page);
    await page.goto('http://127.0.0.1:5174', { waitUntil: 'networkidle', timeout: 90000 });
    await verify(page);
    report.cases.push({ name, passed: true });
  } finally { await context.close(); }
}
try {
  await check('Backend unavailable: explicit error and analysis disabled',
    page => page.route('**/api/v1/status', r => r.abort()),
    async page => {
      await page.getByRole('alert').filter({ hasText: 'No se pudo conectar' }).waitFor();
      assert(await page.getByRole('button', { name: 'Analizar este sitio', exact: true }).isDisabled());
      assert.equal(await page.locator('.condition-cards').count(), 0);
    });
  await check('Evaluation 502: no demo metrics',
    page => page.route('**/api/v1/scenarios/evaluate', r => r.fulfill({ status: 502, contentType: 'application/json', body: JSON.stringify({ detail: 'AUDIT simulated ephemeris failure' }) })),
    async page => {
      await page.getByRole('button', { name: 'Analizar este sitio', exact: true }).click();
      await page.getByRole('alert').filter({ hasText: 'AUDIT simulated' }).waitFor();
      assert.equal(await page.locator('.condition-cards').count(), 0);
    });
  await check('Mesh without coverage: explicit message and terrain disabled',
    page => page.route('**/api/v1/terrain/mesh', r => r.fulfill({ status: 422, contentType: 'application/json', body: JSON.stringify({ detail: 'AUDIT no terrain coverage' }) })),
    async page => {
      await page.locator('.terrain-warning').filter({ hasText: 'AUDIT no terrain coverage' }).waitFor();
      assert(await page.getByRole('button', { name: 'Terreno', exact: true }).isDisabled());
    });
  await check('Blender asset unavailable: explicit model error',
    page => page.route('**/luna/luna_cientifica.glb', r => r.abort()),
    async page => {
      await page.locator('.scene-error').filter({ hasText: 'No se pudo cargar' }).waitFor();
      assert.equal(await page.locator('.condition-cards').count(), 0);
    });
  assert.equal(report.moonTrekRequests, 0, 'The current explorer must not request Moon Trek');
  const folder = join(frontend, 'artifacts'); mkdirSync(folder, { recursive: true });
  writeFileSync(join(folder, 'failure-cases.json'), JSON.stringify(report, null, 2) + '\n');
  console.log(JSON.stringify(report, null, 2));
} finally { await browser.close(); }
