import { chromium, expect } from '@playwright/test';
import { existsSync, readdirSync, mkdirSync, writeFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
process.chdir(join(dirname(fileURLToPath(import.meta.url)), '..'));
const root=join(process.env.LOCALAPPDATA || '', 'ms-playwright');
const installed=existsSync(root) ? readdirSync(root).filter(n=>/^chromium-/.test(n)).sort().reverse().map(n=>join(root,n,'chrome-win64','chrome.exe')).find(existsSync) : undefined;
mkdirSync('artifacts',{recursive:true});
const browser=await chromium.launch({headless:true,executablePath:process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE || installed,args:['--enable-unsafe-swiftshader']});
const page=await browser.newPage({viewport:{width:1440,height:1100}});
const generated=process.argv.includes('--generated');
const live=process.argv.includes('--live') || generated;
const expectedPoints=generated ? 3 : 2, expectedOptions=generated ? 2 : 6;
const errors=[]; page.on('pageerror',e=>errors.push(e.message));
let scientificRequests=0;
page.on('request',r=>{if(r.url().includes('/assistant/search'))scientificRequests++});
const plan={start_date:'2026-11-15',duration_days:1,search_days:2,site_ids:['mouton','malapert'],coordinates:[],
  constraints:{min_concurrent_hours:6,min_sunlit_fraction:.4,min_earth_visible_fraction:.4,min_earth_elevation_deg:0},assumptions:['Dos candidatos del catálogo; paso horario.'],clarification:null};
const points=[{latitude_deg:-84.6,longitude_deg:31,label:'Mons Mouton'},{latitude_deg:-85.98,longitude_deg:-1.67,label:'Mons Malapert'}];
// Only Gemini interpretation/status are simulated. Search goes to the running NASA-backed API.
if (!live) await page.route('**/api/v1/assistant/status',r=>r.fulfill({json:{configured:true}}));
if (!live) await page.route('**/api/v1/assistant/plan',r=>r.fulfill({json:{plan,points,scope:'Solo estos candidatos y fechas; no un óptimo global.'}}));
try {
  await page.goto('http://127.0.0.1:5174',{waitUntil:'networkidle',timeout:180000});
  await page.getByLabel('Sitios, fechas y condiciones que necesitas').fill(generated ? 'Genera 3 puntos nuevos alrededor de latitud -89, longitud 0 a 20 km. Analiza un dia desde el 15 de noviembre de 2026, sin otras fechas, minimo 0% luz, 0% Tierra, 0 horas continuas. Muestra dos opciones.' : 'Muestra seis alternativas. Compara Mons Mouton y Mons Malapert desde el 15 de noviembre de 2026, un dia por escenario, probando inicios ese dia y los dos siguientes. Necesito seis horas continuas de Sol y Tierra visibles, minimo 40% de luz y 40% de Tierra visible.');
  await page.getByRole('button',{name:'Preparar búsqueda',exact:true}).click();
  await expect(page.locator('.assistant-coordinate-link')).toHaveCount(expectedPoints,{timeout:120000});
  await expect(page.locator('.assistant-plan')).toContainText(`${generated ? 3 : 6} alternativas`);
  await page.getByRole('button',{name:'Buscar opciones con datos NASA',exact:true}).click();
  await expect(page.locator('.assistant-answer')).toContainText('Horizons y LOLA',{timeout:180000});
  await expect(page.getByRole('button',{name:/Seleccionar alternativa [0-9]+:/})).toHaveCount(expectedOptions);
  await page.getByRole('button',{name:/Seleccionar alternativa [0-9]+:/}).first().click();
  await expect(page.getByText('TU VENTANA EN DETALLE',{exact:true})).toBeVisible();
  await page.getByRole('button',{name:'Mapa NASA',exact:true}).click();
  await expect(page.locator('.assistant-map-pin').first()).toBeVisible();
  await page.screenshot({path:'artifacts/assistant-real-search.png',fullPage:true});
  await page.setViewportSize({width:390,height:844});
  const overflow=await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth);
  if(overflow || errors.length || scientificRequests!==1)throw new Error(JSON.stringify({overflow,errors,scientificRequests}));
  const report={gemini:live ? 'live authenticated Gemini interpretation' : 'simulated structured interpretation; no live key used',search:'running backend, Horizons and LOLA; cache allowed',alternatives:expectedOptions,scientificRequests,overflow,errors};
  writeFileSync(generated ? '../docs/VALIDACION_PUNTOS_NAVEGADOR_REAL.json' : live ? '../docs/VALIDACION_ASISTENTE_NAVEGADOR_REAL.json' : 'artifacts/assistant-validation.json',JSON.stringify(report,null,2));
  console.log(JSON.stringify(report,null,2));
} finally {await browser.close()}
