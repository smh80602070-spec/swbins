/**
 * 1만리 — 보스 약점 부수기 (W-0395 ② 웹 역이식 — 정본 고돗 G-0342 · 호라이즌 구조만)
 * ---------------------------------------------------------------
 * 보스(FOES[kind].boss)에겐 빛나는 약점이 있다 — 약점 체력 = 최대 체력 × FRAC(0.12). 급소·치명(out.crit)으로 맞힌 피해만큼만 깎이고
 * 0 이 되면 부서진다: STAGGER(2.5)초 비틀(f.stun) · 그 뒤 이 보스의 공격 ×WEAKEN(0.85, hurt 의 f.weakMul) · 약점 표식 꺼짐.
 * 보스가 다시 서면(새 foe 객체) 약점도 다시 선다. 손잡이 fieldweak.on 0 이면 아무것도 안 한다(옛 길).
 *
 *   걸린 자리(field-combat): hitFoe `f.hp -= out.dmg` 뒤 onHit(S, f, out) · hurt 의 f.atk × (f.weakMul || 1) · 보스 체력 띠 글 앞 tag(f)
 *   세이브는 안 쓴다(전투 상태 foe 안: weakHp·weakMax·weakBroken·weakMul).
 */
(function (global) {
  'use strict';

  function core() { return global.DG.core; }
  function K(key, def) { var c = core(); return c && c.tuned ? c.tuned('fieldweak.' + key, def) : def; }
  function on() { return K('on', 1) ? true : false; }
  function FOES() { var F = global.DG.fieldFoes; return F ? F.FOES : (global.DG.fieldCombat ? global.DG.fieldCombat.FOES : {}); }
  function isBoss(f) { var d = f && FOES()[f.kind]; return !!(d && d.boss); }

  /** 처음 맞을 때 약점을 세운다 */
  function ensure(f) {
    if (!f || f.weakMax || !isBoss(f)) { return; }
    f.weakMax = Math.max(1, Math.round((f.hpMax || f.hp || 1) * K('frac', 0.12)));
    f.weakHp = f.weakMax; f.weakBroken = false;
  }

  /** hitFoe 가 피해를 넣은 뒤 — 치명(급소)만 약점을 깎는다. 부서지면 비틀 + 약해짐 */
  function onHit(S, f, out) {
    if (!on() || !out || !isBoss(f)) { return false; }
    ensure(f);
    if (f.weakBroken || !out.crit || !(out.dmg > 0)) { return false; }
    f.weakHp = Math.max(0, f.weakHp - out.dmg);
    if (f.weakHp > 0) { return false; }
    f.weakBroken = true;
    f.stun = Math.max(f.stun || 0, K('stagger', 2.5));
    f.weakMul = K('weaken', 0.85);
    var c = core();
    if (c && c.emit) { c.emit('toast', '✦ ' + (f.name || '보스') + '의 약점이 부서졌다 — 비틀 ' + K('stagger', 2.5) + '초 · 공격 ×' + K('weaken', 0.85)); c.emit('field:weakbreak', { uid: f.uid, kind: f.kind }); }
    return true;
  }

  /** 보스 체력 띠 앞 글 — ✦ 약점 n% / ✦ 부서짐 */
  function tag(f) {
    if (!on() || !isBoss(f)) { return ''; }
    ensure(f);
    return f.weakBroken ? '✦부서짐 ' : '✦' + Math.round(100 * f.weakHp / f.weakMax) + '% ';
  }

  global.DG = global.DG || {};
  global.DG.fieldWeak = { on: on, isBoss: isBoss, ensure: ensure, onHit: onHit, tag: tag };
})(window);
