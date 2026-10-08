/**
 * data.js 표(HEROES·BIOS·FACTIONS) 끝에 생성 절을 넣고 갈아 끼우는 도우미 — heroes-from-realm(W-0115)·heroes-new-201(W-0116) 이 같이 쓴다.
 * 절 = 머리줄 `    // ── <이름> ──…` 부터 다음 `    // ── ` 머리줄(또는 표를 닫는 줄) 앞까지. 그래서 절 여럿이 한 표에 나란히 있어도
 * 하나를 갈아 끼울 때 이웃 절을 안 건드린다. 절 안 항목은 모두 끝 쉼표를 단다(ES5 배열·객체 끝 쉼표 허용).
 */
const HEAD = '\n    // ── ';

/** 절 하나의 [시작, 끝) — 없으면 null. 끝은 다음 머리줄의 첫 글자 또는 닫는 줄의 첫 글자 */
function span(t, from, end, mark) {
  const at = t.indexOf(mark, from);
  if (at < 0 || at > end) return null;
  let nx = t.indexOf(HEAD, at + 1);
  nx = nx < 0 || nx > end ? end + 1 : nx + 1;
  return [at, nx];
}

/** sections: [{ open, close, body }] — body 는 머리줄 포함, '\n' 으로 끝난다 */
export function patchSections(src, sections, mark) {
  const eol = src.includes('\r\n') ? '\r\n' : '\n';
  let t = src.replace(/\r\n/g, '\n');
  for (const S of sections) {
    const start = t.indexOf(S.open);
    const end = start < 0 ? -1 : t.indexOf(S.close, start);
    if (start < 0 || end < 0) throw new Error('표를 못 찾음: ' + S.open.trim());
    const sp = span(t, start, end, mark);
    if (sp) { t = t.slice(0, sp[0]) + S.body + t.slice(sp[1]); continue; }
    const before = t.slice(0, end + 1).replace(/([}'])(\s*)$/, '$1,$2');   // 앞 항목에 쉼표
    t = before + S.body + t.slice(end + 1);
  }
  return t.replace(/\n/g, eol);
}

/** 이 생성기의 절만 걷어 낸 모습(줄끝 LF) — 원래 표를 읽을 때 쓴다 */
export function stripSections(src, mark) {
  let t = src.replace(/\r\n/g, '\n'), at;
  while ((at = t.indexOf(mark)) >= 0) {
    const close = t.slice(at).search(/\n  [\]}];/);
    const sp = span(t, at, at + close, mark);
    t = t.slice(0, sp[0]) + t.slice(sp[1]);
  }
  return t;
}
