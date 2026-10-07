// 사가종횡 — 첫 사냥터 사람 적을 내 곁에 세워 가까이 찍는다(모델·재질 확인용)
// 인자: tune=키:값,...(예: tune=world3d.outline:0) · 이름(사진 파일 뒤꼬리)
import { launch, sleep } from './cdp.mjs';
const TUNE = (process.argv.find((a) => a.startsWith('tune=')) || '').slice(5);
const NAME = process.argv.find((a) => /^[a-z0-9_]+$/.test(a)) || 'base';
const c = await launch(1280, 720);
const hard = setTimeout(() => { console.log('TIMEOUT'); c.close(); process.exit(1); }, 120000);
try {
  await c.go('http://127.0.0.1:8871/saga-story/index.html', 6000);
  await c.ev(`(function(){ var t = '${TUNE}'; if (!t) return; t.split(',').forEach(function (kv) { var p = kv.split(':'); DG.core.setTune(p[0], +p[1]); }); })()`);
  await c.go('http://127.0.0.1:8871/saga-story/index.html', 8000);
  await c.ev(`(function(){ var b=document.getElementById('title-continue'); if(b){ b.click(); } })()`);
  await sleep(3000);
  await c.ev(`(function(){ if (DG.story.isOpen()) DG.story.skip(); if (!DG.side.active()) DG.side.enter('field'); })()`);
  await sleep(8000);
  console.log(await c.ev(`(function(){ var r = DG.side.raw(), h = r.enemies.filter(function (e) { return (e.kind || (e.ref && e.ref.kind)) === 'human'; }); h.forEach(function (e, i) { e.x = r.player.x + 140 + i * 90; e.y = r.player.y; e.spd = 0; }); return h.length + ' 사람 적 곁으로'; })()`));
  await sleep(3000);
  await c.shot('st_look_' + NAME);
  if (process.argv.includes('ab')) {   // 같은 장면에서 외곽선만 숨겨 한 장 더
    console.log(await c.ev(`(function(){ var n = 0, w = []; DG.sideView3d._scene().traverse(function (o) { if (/_outline$/.test(o.name || '')) { o.visible = false; n++; if (o.material && o.material.uniforms && w.length < 6) { o.geometry.computeBoundingSphere(); w.push(o.material.uniforms.outlineWidth.value.toFixed(3) + '/' + o.geometry.boundingSphere.radius.toFixed(2)); } } }); return '외곽선 숨김 ' + n + ' · 폭/반지름 ' + w.join(' '); })()`));
    await sleep(1500);
    await c.shot('st_look_' + NAME + '_noline');
    console.log(await c.ev(`(function(){ var out = {}, T = window.THREE; DG.sideView3d._scene().traverse(function (o) { if (!o.isMesh || !o.visible || /_outline$/.test(o.name || '')) { return; } var mats = Array.isArray(o.material) ? o.material : [o.material]; mats.forEach(function (m) { var c = m.color ? m.color : null, lum = c ? (0.3 * c.r + 0.59 * c.g + 0.11 * c.b) : -1; var k = m.type + ' ' + (m.name || '?') + ' col#' + (c ? c.getHexString() : '-') + ' map:' + (m.map ? 'y' : 'n') + ' vc:' + !!m.vertexColors + ' emis#' + (m.emissive ? m.emissive.getHexString() : '-') + ' op:' + m.opacity + (m.userData && m.userData.flashBase ? ' flash' : ''); if (lum >= 0 && lum < 0.12 || m.type === 'MeshBasicMaterial') { out[k] = (out[k] || 0) + 1; } }); }); return Object.keys(out).map(function (k) { return out[k] + '× ' + k; }).slice(0, 25).join(String.fromCharCode(10)); })()`));
  }
  await c.ev(`(function(){ var t = '${TUNE}'; if (!t) return; t.split(',').forEach(function (kv) { DG.core.setTune(kv.split(':')[0], null); }); })()`);
} catch (e) { console.log('ERR', e.message); }
clearTimeout(hard);
setTimeout(() => process.exit(0), 1500);
await c.close();
process.exit(0);
