// 헤드리스 크롬 CDP 러너 — 사가 판 조작·화면 확인(키·클릭·촬영). 프로필·사진은 이 폴더 chrome-prof/·shots/(git 제외)
import { spawn } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';

const SCR = path.dirname(new URL(import.meta.url).pathname).replace(/^\/([A-Z]:)/, '$1');
const PROFILE = path.join(SCR, process.env.PC_PROF || 'chrome-prof');   // 둘을 같이 띄우려면 PC_PROF·PC_PORT 를 달리
const OUT = path.join(SCR, 'shots');
fs.mkdirSync(OUT, { recursive: true });
const CHROME = 'C:/Program Files/Google/Chrome/Application/chrome.exe';
const PORT = +(process.env.PC_PORT || 9351);

export async function launch(w = 1280, h = 720) {
  const proc = spawn(CHROME, ['--headless=new', '--disable-gpu', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--disable-gpu-sandbox',
    '--remote-debugging-port=' + PORT, '--user-data-dir=' + PROFILE, '--window-size=' + w + ',' + h, '--autoplay-policy=no-user-gesture-required', 'about:blank'], { stdio: 'ignore' });
  let tabs;
  for (let i = 0; i < 50; i++) {
    try { tabs = await (await fetch('http://127.0.0.1:' + PORT + '/json')).json(); break; } catch (e) { await sleep(200); }
  }
  const tab = tabs.find((t) => t.type === 'page');
  const ws = new WebSocket(tab.webSocketDebuggerUrl);
  await new Promise((r) => ws.addEventListener('open', r));
  let id = 0; const wait = {}; const logs = [];
  ws.addEventListener('message', (m) => {
    const j = JSON.parse(m.data);
    if (j.id && wait[j.id]) { wait[j.id](j); delete wait[j.id]; }
    if (j.method === 'Runtime.exceptionThrown') { logs.push('EXC ' + (j.params.exceptionDetails.exception && j.params.exceptionDetails.exception.description || j.params.exceptionDetails.text)); }
    if (j.method === 'Runtime.consoleAPICalled' && (j.params.type === 'error' || j.params.type === 'warning')) { logs.push(j.params.type + ' ' + j.params.args.map((a) => a.value || a.description).join(' ')); }
  });
  const send = (method, params = {}) => new Promise((r) => { const i = ++id; wait[i] = r; ws.send(JSON.stringify({ id: i, method, params })); });
  await send('Runtime.enable'); await send('Page.enable');
  await send('Emulation.setDeviceMetricsOverride', { width: w, height: h, deviceScaleFactor: 1, mobile: false });
  await send('Page.addScriptToEvaluateOnNewDocument', { source: `
    document.hasFocus = function(){ return true; };` });
  const api = {
    send, logs,
    async go(url, ms = 3000) { await send('Page.navigate', { url }); await sleep(ms); },
    async ev(expr) { const r = await send('Runtime.evaluate', { expression: expr, returnByValue: true, awaitPromise: true, timeout: 10000 }); if (r.result && r.result.exceptionDetails) { return 'ERR ' + (r.result.exceptionDetails.exception || {}).description; } return r.result && r.result.result ? r.result.result.value : r; },
    async shot(name) { const r = await send('Page.captureScreenshot', { format: 'png' }); const f = path.join(OUT, name + '.png'); fs.writeFileSync(f, Buffer.from(r.result.data, 'base64')); return f; },
    async key(k, holdMs = 80) {
      const code = k.length === 1 ? 'Key' + k.toUpperCase() : k;
      const key = k === 'Space' ? ' ' : k;
      await send('Input.dispatchKeyEvent', { type: 'keyDown', key, code, windowsVirtualKeyCode: k.length === 1 ? k.toUpperCase().charCodeAt(0) : 0 });
      await sleep(holdMs);
      await send('Input.dispatchKeyEvent', { type: 'keyUp', key, code });
    },
    async click(x, y) {
      await send('Input.dispatchMouseEvent', { type: 'mousePressed', x, y, button: 'left', clickCount: 1 });
      await send('Input.dispatchMouseEvent', { type: 'mouseReleased', x, y, button: 'left', clickCount: 1 });
    },
    async close() { try { await send('Browser.close'); } catch (e) {} ws.close(); setTimeout(() => { try { proc.kill(); } catch (e) {} }, 500); }
  };
  return api;
}
export function sleep(ms) { return new Promise((r) => setTimeout(r, ms)); }
