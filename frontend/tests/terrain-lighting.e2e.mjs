import {chromium,expect} from '@playwright/test';
import {existsSync,readdirSync,mkdirSync,writeFileSync} from 'node:fs';
import {join,dirname} from 'node:path';
import {fileURLToPath} from 'node:url';
import assert from 'node:assert/strict';
process.chdir(join(dirname(fileURLToPath(import.meta.url)),'..'));
const root=join(process.env.LOCALAPPDATA,'ms-playwright');
const binary=readdirSync(root).filter(n=>n.startsWith('chromium-')).sort().reverse().map(n=>join(root,n,'chrome-win64','chrome.exe')).find(existsSync);
const browser=await chromium.launch({headless:true,executablePath:process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE||binary,args:['--enable-unsafe-swiftshader']});
try{
  const page=await browser.newPage({viewport:{width:1440,height:1100},reducedMotion:'reduce'}),errors=[],warnings=[];
  page.on('pageerror',e=>errors.push(e.message));page.on('console',m=>{if(m.type()==='warning')warnings.push(m.text())});
  let evaluations=0;page.on('request',r=>{if(r.url().endsWith('/scenarios/evaluate'))evaluations++});
  const diagnostic=()=>page.locator('.three-mount').evaluate(el=>JSON.parse(el.dataset.sceneDiagnostics));
  await page.goto('http://127.0.0.1:5174',{waitUntil:'networkidle',timeout:120000});
  await page.waitForFunction(()=>document.querySelector('.connection')?.textContent?.includes('CONNECTED'));
  await page.getByText('Elegir coordenadas propias',{exact:true}).click();
  await page.getByLabel('Latitud',{exact:true}).fill('-89');await page.getByLabel('Longitud',{exact:true}).fill('0');
  await page.getByRole('button',{name:'Marcar punto',exact:true}).click();
  await page.locator('input[type=date]').fill('2026-11-15');await page.locator('.mission-setup select').first().selectOption('7');
  const response=page.waitForResponse(r=>r.url().endsWith('/scenarios/evaluate'),{timeout:180000});
  await page.getByRole('button',{name:'Analizar este sitio',exact:true}).click();
  const upstream=await response;assert.equal(upstream.status(),200);const result=await upstream.json();
  await page.getByRole('button',{name:'Terreno',exact:true}).click();
  await page.waitForFunction(()=>{const raw=document.querySelector('.three-mount')?.dataset.sceneDiagnostics;return raw&&JSON.parse(raw).bodyModels.length===2&&JSON.parse(raw).view==='local'});
  await expect(page.locator('.scene-direction-key')).toContainText('Sol oculto');
  let d=await diagnostic();assert.equal(d.sunVisible,false);assert.equal(d.earthVisible,false);
  const expectedRadius=1+result.site_height_km_used/1737.4;assert.ok(Math.abs(Math.hypot(...d.observer)-expectedRadius)<1e-10);
  mkdirSync('artifacts',{recursive:true});await page.locator('.scene-wrapper').screenshot({path:'artifacts/terrain-clarity-hidden.png'});
  const sunny=result.samples.findIndex(s=>s.time_utc==='2026-11-19T00:00:00Z');assert.ok(sunny>=0);
  await page.getByRole('slider',{name:'Tiempo en el visor 3D'}).fill(String(sunny));
  await page.waitForFunction(()=>JSON.parse(document.querySelector('.three-mount').dataset.sceneDiagnostics).time==='2026-11-19T00:00:00Z');
  await page.getByRole('button',{name:'Tu punto',exact:true}).click();await page.waitForTimeout(250);
  d=await diagnostic();assert.equal(d.sunVisible,true);assert.equal(d.earthVisible,true);assert.equal(d.shadows,true);assert.equal(d.terrainCastsShadow,true);assert.equal(d.terrainReceivesShadow,true);assert.deepEqual(d.shadowMapSize,[2048,2048]);assert.equal(d.reducedMotion,true);
  const dot=(a,b)=>a.reduce((sum,v,i)=>sum+v*b[i],0);
  const lat=-89*Math.PI/180;
  const worldDirection=entry=>{const az=entry.azimuth_deg*Math.PI/180,el=entry.elevation_deg*Math.PI/180;return[-Math.sin(lat)*Math.cos(az)*Math.cos(el)+Math.cos(lat)*Math.sin(el),Math.cos(lat)*Math.cos(az)*Math.cos(el)+Math.sin(lat)*Math.sin(el),-Math.sin(az)*Math.cos(el)]};
  assert.ok(dot(worldDirection(result.samples[sunny].sun),d.solarDirection)>1-1e-10);
  assert.ok(dot(worldDirection(result.samples[sunny].earth),d.earthTargetDirection)>1-1e-10);
  assert.ok(dot(d.solarDirection,d.lightDirection)>1-1e-10);
  assert.ok(dot(d.solarDirection,d.sunArrowDirection)<-1+1e-10);
  assert.ok(dot(d.earthTargetDirection,d.earthArrowDirection)>1-1e-10);
  assert.ok(d.sunDiameterPixels>70&&d.earthDiameterPixels>45);
  const canvas=page.locator('.three-mount canvas');
  const shadowOn=await canvas.screenshot();
  await page.getByRole('button',{name:'Sombras',exact:true}).click();await expect.poll(async()=>(await diagnostic()).shadows).toBe(false);await page.waitForTimeout(250);
  const shadowOff=await canvas.screenshot();
  const shadowDifference=await page.evaluate(async({a,b})=>{
    async function pixels(base64){const image=new Image();image.src='data:image/png;base64,'+base64;await image.decode();const canvas=document.createElement('canvas');canvas.width=image.width;canvas.height=image.height;const c=canvas.getContext('2d');c.drawImage(image,0,0);return c.getImageData(0,0,image.width,image.height).data}
    const x=await pixels(a),y=await pixels(b);let changed=0,total=0;for(let i=0;i<x.length;i+=4){const diff=Math.abs(x[i]-y[i])+Math.abs(x[i+1]-y[i+1])+Math.abs(x[i+2]-y[i+2]);total+=diff;if(diff>9)changed++}return{changedPixels:changed,meanAbsoluteChannelDifference:total/(x.length/4*3)}
  },{a:shadowOn.toString('base64'),b:shadowOff.toString('base64')});
  assert.ok(shadowDifference.changedPixels>50,JSON.stringify(shadowDifference));
  await page.getByRole('button',{name:'Sombras',exact:true}).click();await page.waitForTimeout(200);
  await page.locator('.scene-wrapper').screenshot({path:'artifacts/terrain-clarity-sunlit.png'});
  await page.getByRole('button',{name:'Tierra',exact:true}).click();await page.waitForTimeout(200);
  assert.ok((await diagnostic()).earthDiameterPixels>d.earthDiameterPixels*1.3);
  await page.locator('.scene-wrapper').screenshot({path:'artifacts/terrain-earth-closeup.png'});
  await page.getByRole('button',{name:'Tu punto',exact:true}).click();
  await page.setViewportSize({width:390,height:844});await page.waitForTimeout(250);
  const mobile=await diagnostic();assert.ok(mobile.sunDiameterPixels>35&&mobile.earthDiameterPixels>25);
  await page.locator('.scene-wrapper').screenshot({path:'artifacts/terrain-clarity-mobile.png'});
  const overflow=await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth);assert.equal(overflow,false);assert.equal(errors.length,0);assert.equal(evaluations,1);
  // A point near the fine DEM coverage boundary must switch the mesh to the
  // same height source used by the evaluated observer, not keep coarse terrain.
  await page.setViewportSize({width:1440,height:1100});
  await page.getByLabel('Latitud',{exact:true}).fill('-87.67');await page.getByRole('button',{name:'Marcar punto',exact:true}).click();await page.locator('.mission-setup select').first().selectOption('1');
  const edgeResponse=page.waitForResponse(r=>r.url().endsWith('/scenarios/evaluate'),{timeout:180000});await page.getByRole('button',{name:'Analizar este sitio',exact:true}).click();const edge=await (await edgeResponse).json();
  assert.equal(edge.horizon_source,'LOLA_MULTIRESOLUTION_20_240M');await expect(page.locator('.terrain-badge')).toContainText('20 m');await expect.poll(async()=>(await diagnostic()).terrainPixelSize).toBe(20);
  await expect.poll(async()=>Math.abs(Math.hypot(...(await diagnostic()).observer)-(1+edge.site_height_km_used/1737.4))).toBeLessThan(1e-10);
  assert.equal(evaluations,2);assert.equal(errors.length,0);
  const report={source:'real NASA-backed evaluation, no mocked positions or terrain; cache allowed',observer_radius_matches_dem:true,mesh_matches_fine_dem_at_coverage_boundary:true,api_angles_match_rendered_directions:true,directional_light_matches_horizons:true,solar_arrow_points_to_observer:true,earth_arrow_points_to_earth:true,actual_shadow_render_changed:shadowDifference,desktop_body_diameters_px:{sun:d.sunDiameterPixels,earth:d.earthDiameterPixels},mobile_body_diameters_px:{sun:mobile.sunDiameterPixels,earth:mobile.earthDiameterPixels},earth_focus_enlarges:true,hidden_and_visible_states:true,reduced_motion:true,display_controls_trigger_no_evaluation:true,evaluations,overflow,errors,warnings,scope:'Visual shadows on the local mesh, not full 250 km horizon, radiometry or landing certification'};
  writeFileSync('../docs/VALIDACION_ESCENA_LUZ_SOMBRAS.json',JSON.stringify(report,null,2));console.log(JSON.stringify(report,null,2));
}finally{await browser.close()}
