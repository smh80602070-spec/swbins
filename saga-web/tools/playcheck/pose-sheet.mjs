// W-0303 — pose-shot.mjs 가 찍은 shots/<접두어>_*.jpg 에서 인물 둘레만 잘라 한 장 모음판(shots/<접두어>_sheet.jpg)으로. 눈 판정용
//   node pose-sheet.mjs [접두어] [x,y,w,h 자르기 — 기본 1280×720 화면의 인물 둘레 470,250,340,280]
import fs from 'node:fs';
import { chromium } from 'playwright-core';
const CHROME = process.env.PW_CHROME || 'C:/Program Files/Google/Chrome/Application/chrome.exe';   // pw.mjs 와 같은 크롬
const tag = process.argv[2] || 'side', [cx, cy, cw, ch] = (process.argv[3] || '470,250,340,280').split(',').map(Number);
const files = fs.readdirSync('shots').filter(f => f.startsWith(tag + '_') && f.endsWith('.jpg') && !f.endsWith('_sheet.jpg')).sort();
const cells = files.map(f => `<figure><div style="width:${cw}px;height:${ch}px;background:url(data:image/jpeg;base64,${fs.readFileSync('shots/' + f).toString('base64')}) -${cx}px -${cy}px"></div><figcaption>${f.slice(tag.length + 1, -4)}</figcaption></figure>`).join('');
const html = `<html><body style="margin:0;background:#222;display:flex;flex-wrap:wrap;width:${(cw + 8) * 4}px;font:14px sans-serif;color:#eee">${cells}</body></html>`.replace(/<figure>/g, '<figure style="margin:4px">');
const b = await chromium.launch({ executablePath: CHROME, headless: true }), p = await b.newPage({ viewport: { width: (cw + 8) * 4, height: 400 } });
await p.setContent(html); await p.screenshot({ path: `shots/${tag}_sheet.jpg`, type: 'jpeg', quality: 85, fullPage: true });
await b.close();
console.log(`shots/${tag}_sheet.jpg · ${files.length}칸`);
