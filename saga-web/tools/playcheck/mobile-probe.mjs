// node saga-web/tools/playcheck/mobile-probe.mjs [판|판/파일…] → shots/mobile_<판>.png (W-0185·W-0186 R-0, 10-12)
// 폰 흉내(390×844 터치·Fast 4G 1.1MB/s·지연 60ms·CPU ×4)로 첫 화면까지 — load·DG 준비 시각·받은 양·큰 파일 여섯·예외.
// 기본은 공개 주소(GitHub Pages, 사용자 폰과 같은 길). 헤드리스는 소프트웨어 그래픽이라 3D 초당 프레임은 실제 폰보다 낮다 — 비교는 같은 조건끼리만.
const { launch, sleep } = await import('./cdp.mjs');
const BASE = 'https://smh80602070-spec.github.io/swbins/saga-web/';
const ARGS = process.argv.slice(2).filter((a) => a[0] !== '-');
const GAMES = ARGS.length ? ARGS : ['saga-go', 'saga-dungeon', 'saga-forest', 'saga-story', 'saga-realm'];
for (const g of GAMES) {
  const c = await launch(390, 844);
  const hard = setTimeout(() => { console.log(g, 'TIMEOUT'); c.close(); process.exit(1); }, 170000);
  let bytes = 0, reqs = 0, big = [];
  const urls = {};
  try {
    await c.send('Network.enable');
    await c.send('Network.setCacheDisabled', { cacheDisabled: true });
    await c.send('Network.setBypassServiceWorker', { bypass: true });
    await c.send('Network.emulateNetworkConditions', { offline: false, latency: 60, downloadThroughput: 1125000, uploadThroughput: 93750 });
    await c.send('Emulation.setCPUThrottlingRate', { rate: 4 });
    await c.send('Emulation.setDeviceMetricsOverride', { width: 390, height: 844, deviceScaleFactor: 2, mobile: true });
    await c.send('Emulation.setTouchEmulationEnabled', { enabled: true, maxTouchPoints: 5 });
    const t0 = Date.now();
    await c.go(BASE + (g.indexOf('.') > 0 ? g : g + '/'), 100);
    // 받는 양은 Performance API 로(창 안 자원 표)
    let ready = -1, loaded = -1;
    for (let i = 0; i < 150; i++) {
      const s = await c.ev(`JSON.stringify({ rs: document.readyState, dg: !!(window.DG && DG.core), t: !!document.getElementById('title-continue') || !!document.querySelector('#title, .title, #account, .acct') })`);
      try {
        const o = JSON.parse(s);
        if (loaded < 0 && o.rs === 'complete') { loaded = Date.now() - t0; }
        if (ready < 0 && o.dg) { ready = Date.now() - t0; }
        if (loaded >= 0 && ready >= 0) { break; }
      } catch (e) { /* 이동 중 */ }
      await sleep(400);
    }
    await sleep(3000);
    const res = JSON.parse(await c.ev(`JSON.stringify(performance.getEntriesByType('resource').map(function (r) { return [r.name.replace(location.origin, ''), r.transferSize || r.encodedBodySize || 0, Math.round(r.duration)]; }))`));
    res.forEach((r) => { bytes += r[1]; reqs++; });
    big = res.sort((a, b) => b[1] - a[1]).slice(0, 6).map((r) => r[0].split('/').slice(-2).join('/') + ' ' + Math.round(r[1] / 1024) + 'KB ' + r[2] + 'ms');
    const ex = c.logs.filter((l) => /^EXC|error/i.test(l) && !/WebGLProgram|Shader|ERROR: 0:|Program Info|favicon/i.test(l));
    console.log(`${g} — load ${loaded}ms · DG ${ready}ms · 받은 ${Math.round(bytes / 1024)}KB / ${reqs}개`);
    console.log('   큰 것: ' + big.join(' | '));
    console.log('   예외: ' + (ex.length ? ex.slice(0, 3).join(' || ').slice(0, 400) : '없음'));
    console.log('   →', await c.shot('mobile_' + g.replace(/[^w-]/g, '_')));
  } catch (e) { console.log(g, 'ERR', e.message); }
  clearTimeout(hard); await c.close(); await sleep(2500);
}
process.exit(0);
