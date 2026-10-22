/**
 * 1만리 — 쳐내기(패링) (W-0375 · 엘든 링 쳐내기·세키로 — 구조만, 이름·수치·그림은 우리 것)
 * ---------------------------------------------------------------
 * 들판 전투의 대응은 회피뿐이었다 → 적이 예고(f.st 'wind') 중이고 남은 시간이 PARRY_WIN 안이며 그 적이 사거리 안이면
 * 평타 키가 쳐내기가 된다: 그 공격은 취소(무피해)·적은 비틀(f.stun — 이미 있는 기절 길: 멈추고 받는 피해 ×STUN_MUL)·
 * 다음 내 한 타 ×NEXT_MUL. 보스·영웅 몸은 비틀 BOSS_STAG. 창 밖(이르면)은 그냥 평타(적 공격은 그대로 들어온다).
 * 자동 사냥(autoFight)의 평타는 S.autoAct 표시로 쳐내기를 안 쓴다(자동 손맛 그대로 — 쳐내기는 손으로 누른 평타만).
 * field-combat.js 는 큰 파일 상한이라 이 파일에 두고 거기는 기존 줄 끝에서 부른다(attack 첫 줄·hitFoe 곱·handle 사건). 손잡이 go.parry(1, 0 = 끔).
 */
(function (global) {
  'use strict';

  var PARRY_WIN = 0.25, STAG = 1.2, BOSS_STAG = 0.5, NEXT_MUL = 2;
  var next = 1;

  function core() { return global.DG.core; }
  function FC() { return global.DG.fieldCombat; }
  function on() { var C = core(); return !(C && C.tuned && !+C.tuned('go.parry', 1)); }
  /** 이 적이 지금 쳐낼 수 있는 창인가(순수) */
  function window_(f) { return !!(f && f.st === 'wind' && f.stT > 0 && f.stT <= PARRY_WIN); }

  /** 쳐내기 시도 — 쳐냈으면 그 적, 아니면 null */
  function tryParry(S, px, py) {
    var F = FC();
    if (!on() || !F || !S || !F.living || S.autoAct) { return null; }   // 자동 사냥의 평타는 쳐내기를 안 쓴다(불변 규칙)
    var L = F.living(S), K = F.KDVf ? F.KDVf() : 1, best = null, bd = Infinity, i, f, def, rt, reach, d;
    for (i = 0; i < L.length; i++) {
      f = L[i];
      if (!window_(f)) { continue; }
      def = F.FOES && F.FOES[f.kind]; rt = def && def.rot && F.ROT ? F.ROT[f.atkT] : def;
      reach = ((rt && rt.reach) || 1.5) + 0.6 + (f.mark ? 1 : 0);
      d = Math.hypot(f.x - px, f.y - py) - (F.BODY ? F.BODY(f) : 0);
      if (d <= reach * K && d < bd) { best = f; bd = d; }
    }
    if (!best) { return null; }
    def = F.FOES && F.FOES[best.kind];
    best.st = 'recover'; best.stT = 0.5; best.mark = null; best.atkSiege = false;
    best.cd = ((def && def.cd) || 1.5) * (best.cdMul || 1);
    best.stun = Math.max(best.stun || 0, def && (def.boss || def.hero) ? BOSS_STAG : STAG);
    next = NEXT_MUL;
    if (F.push) { F.push(S, { t: 'parry', uid: best.uid, x: best.x, y: best.y }); }
    core().emit('field:parry', { uid: best.uid });
    return best;
  }
  /** 피해 곱 — 쳐낸 뒤 첫 한 타만 ×NEXT_MUL */
  function nextMul() { if (next === 1) { return 1; } var m = next; next = 1; return m; }

  global.DG = global.DG || {};
  global.DG.fieldParry = { PARRY_WIN: PARRY_WIN, STAG: STAG, BOSS_STAG: BOSS_STAG, NEXT_MUL: NEXT_MUL, window: window_, tryParry: tryParry, nextMul: nextMul, _reset: function () { next = 1; } };
})(window);
