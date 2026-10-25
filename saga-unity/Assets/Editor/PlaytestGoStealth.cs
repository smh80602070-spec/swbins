using System.Collections.Generic;
using UnityEngine;
using Saga.Go.Combat;
using Saga.Go.Data;
using Saga.Go.Player;

namespace Saga.EditorTools
{
    /// <summary>
    /// tasks U-0232 몰래 다가가 등용 진단 — `PlaytestHeadless` 가 부른다. 시야 표(앞·뒤·12m 밖·옆 60°·웅크림 6m·풀숲 걸음/달림) ·
    /// 판정(뒤 3m = 기습 · 뒤 6m = 없음 · 앞 6m 걸음 = 보통 겨루기 · 앞 10m 달림 = 들킴 → 겁 물러섬 10m·사나움 겨루기 · 알아챈 뒤 뒤 3m = 보통) ·
    /// 기습 겨루기(첫 타 ×1.15 · 37.5% 에서 굴복 · 보통은 30% 에서도 안 꿇음) · 웅크림 걸음 0.5 · 달리면 풀림 · 끔이면 예전(7m 겨루기·기습 없음).
    /// 끝나면 동행·경험치·자리·인물 자리를 되돌린다.
    /// </summary>
    public static class PlaytestGoStealth
    {
        private static bool _ok;
        private static void Fail(string m) { _ok = false; Debug.LogError("[PlaytestHeadless] stealth FAIL - " + m); }

        public static bool Run()
        {
            _ok = true;
            bool on0 = GoStealth.On;
            GoStealth.On = true;
            CheckSees();
            var heroes = FieldHeroes.Instance;
            var fc = FieldCombat.Instance;
            if (heroes == null || fc == null) { Fail("FieldHeroes/FieldCombat 없음"); GoStealth.On = on0; return false; }
            var pc = fc.GetComponent<PlayerController>();
            var startMembers = new List<string>(PartyState.MemberIds);
            int startLevel = PlayerStats.Level; long startExp = PlayerStats.Exp;
            Vector3 startPos = fc.transform.position;
            string judge = "", hit = "", walk = "";
            try
            {
                judge = CheckJudge(heroes);
                hit = CheckAmbushDuel(heroes);
                walk = CheckCrouch(pc);
            }
            finally
            {
                GoStealth.On = on0;
                PartyState.Restore(startMembers);
                PlayerStats.Restore(startLevel, startExp);
                foreach (var s in heroes.Slots) { s.Skip = 0; s.Wait = 0f; heroes.Refresh(s); }
                if (pc != null) { pc.Crouching = false; pc.ClearTestInput(); pc.Teleport(startPos); }
                DuelGate.ResetForTest();
            }
            if (_ok) Debug.Log($"[PlaytestHeadless] stealth OK - 시야 앞 100°·12m·웅크림 6m·풀숲 | {judge} | {hit} | {walk}");
            return _ok;
        }

        private static void CheckSees()
        {
            Vector3 o = Vector3.zero, f = Vector3.forward;
            void Want(string what, bool got, bool want) { if (got != want) Fail($"Sees {what} = {got}"); }
            Want("앞 8m", GoStealth.Sees(o, f, new Vector3(0, 0, 8), false, false, false), true);
            Want("뒤 5m", GoStealth.Sees(o, f, new Vector3(0, 0, -5), false, false, true), false);
            Want("앞 13m", GoStealth.Sees(o, f, new Vector3(0, 0, 13), false, false, true), false);
            Want("옆 60° 8m", GoStealth.Sees(o, f, Quaternion.Euler(0, 60, 0) * new Vector3(0, 0, 8), false, false, false), false);
            Want("옆 45° 8m", GoStealth.Sees(o, f, Quaternion.Euler(0, 45, 0) * new Vector3(0, 0, 8), false, false, false), true);
            Want("웅크림 앞 8m", GoStealth.Sees(o, f, new Vector3(0, 0, 8), true, false, false), false);
            Want("웅크림 앞 5m", GoStealth.Sees(o, f, new Vector3(0, 0, 5), true, false, false), true);
            Want("풀숲 걸음 앞 8m", GoStealth.Sees(o, f, new Vector3(0, 0, 8), false, true, false), false);
            Want("풀숲 달림 앞 8m", GoStealth.Sees(o, f, new Vector3(0, 0, 8), false, true, true), true);
            if (Mathf.Abs(GoStealth.AmbushYieldFrac - 0.375f) > 1e-4f) Fail($"기습 굴복 문턱 {GoStealth.AmbushYieldFrac}");
        }

        private static string FindId(bool fierce, int rarity)
        {
            foreach (var h in GoHeroes.All) if (h.Rarity == rarity && GoStealth.Fierce(h.Id) == fierce) return h.Id;
            return null;
        }

        private static FieldHeroes.Slot IdleSlot(FieldHeroes heroes)
        {
            foreach (var s in heroes.Slots) if (s.Idle != null && s.Fighter == null) return s;
            return null;
        }

        private static string CheckJudge(FieldHeroes heroes)
        {
            var slot = IdleSlot(heroes);
            if (slot == null) { Fail("서 있는 사람 없음"); return ""; }
            var t = slot.Idle.transform;
            t.rotation = Quaternion.identity;
            slot.Noticed = slot.Retreated = false;
            Vector3 hp = t.position;
            FieldHeroes.Sneak J(Vector3 off, bool crouch, bool run) => heroes.Judge(slot, hp + off, crouch, run, false);
            void Want(string what, FieldHeroes.Sneak got, FieldHeroes.Sneak want) { if (got != want) Fail($"판정 {what} = {got}(≠ {want})"); }
            Want("뒤 3m", J(new Vector3(0, 0, -3), false, false), FieldHeroes.Sneak.Ambush);
            Want("뒤 6m", J(new Vector3(0, 0, -6), false, false), FieldHeroes.Sneak.None);
            Want("앞 6m 걸음", J(new Vector3(0, 0, 6), false, false), FieldHeroes.Sneak.Duel);
            Want("앞 10m 걸음", J(new Vector3(0, 0, 10), false, false), FieldHeroes.Sneak.None);
            Want("웅크림 앞 6.5m", J(new Vector3(0, 0, 6.5f), true, false), FieldHeroes.Sneak.None);
            Want("뒤 10m 달림", J(new Vector3(0, 0, -10), false, true), FieldHeroes.Sneak.None);

            string id0 = slot.HeroId;
            string timid = FindId(false, 3), fierce = FindId(true, 3);
            if (timid == null || fierce == null) { Fail("겁/사나움 ★3 인물을 못 찾음"); return ""; }
            slot.HeroId = fierce;
            Want("사나움 앞 10m 달림", J(new Vector3(0, 0, 10), false, true), FieldHeroes.Sneak.SpottedDuel);
            slot.HeroId = timid;
            var r = J(new Vector3(0, 0, 10), false, true);
            Want("겁 앞 10m 달림", r, FieldHeroes.Sneak.SpottedRetreat);
            Vector3 before = t.position;
            heroes.Act(slot, r, new Vector3(0, 0, 10));
            Vector3 mv = t.position - before; mv.y = 0f;
            if (!slot.Noticed || mv.magnitude < 9f || mv.z > -8f) Fail($"겁 물러섬 {mv.magnitude:0.0}m z{mv.z:0.0} 알아챔 {slot.Noticed}");
            hp = t.position;
            Want("알아챈 뒤 등 뒤 3m", J(-t.forward * 3f, false, false), FieldHeroes.Sneak.Duel);
            Want("물러선 뒤 다시 달림 6m", J(t.forward * 6f, false, true), FieldHeroes.Sneak.Duel);

            GoStealth.On = false;
            Want("끔 뒤 3m", J(-t.forward * 3f, false, false), FieldHeroes.Sneak.Duel);
            Want("끔 앞 10m 달림", J(t.forward * 10f, false, true), FieldHeroes.Sneak.None);
            GoStealth.On = true;
            slot.HeroId = id0;
            heroes.Refresh(slot);
            return $"뒤 3m 기습·앞 6m 겨루기·달리면 들킴(겁 {mv.magnitude:0.0}m 물러섬·사나움 겨루기)·끔 7m";
        }

        private static string CheckAmbushDuel(FieldHeroes heroes)
        {
            var slot = IdleSlot(heroes);
            if (slot == null) { Fail("겨룰 자리 없음"); return ""; }
            string id0 = slot.HeroId;
            string id = FindId(false, 3) ?? FindId(true, 3);
            float first = 0f, firstAmb = 0f, yieldAt = -1f, plainAt30 = -1f;
            foreach (bool amb in new[] { false, true })
            {
                slot.HeroId = id;
                heroes.Refresh(slot);
                slot.HeroId = id;
                heroes.StartDuel(slot, amb);
                var f = slot.Fighter;
                if (f == null) { Fail("겨루기 안 열림"); return ""; }
                if (f.Ambushed != amb) Fail($"Ambushed {f.Ambushed} ≠ {amb}");
                float hp0 = f.Hp;
                f.TakeHit(10f, GoElement.Physical, 50f, out _);
                float d = hp0 - f.Hp;
                if (amb) firstAmb = d; else first = d;
                // 작은 타로 깎아 내려가며 굴복 자리를 잰다
                for (int i = 0; i < 4000 && !f.Yielded; i++)
                {
                    float before = f.Hp / f.MaxHp;
                    f.TakeHit(f.MaxHp * 0.01f, GoElement.Physical, 50f, out _);
                    if (f.Yielded) { if (amb) yieldAt = before; }
                    else if (!amb && plainAt30 < 0f && f.Hp / f.MaxHp <= 0.30f) plainAt30 = f.Hp / f.MaxHp;
                }
                if (!f.Yielded) Fail($"기습 {amb} 굴복 안 함");
            }
            float ratio = first > 0f ? firstAmb / first : 0f;
            if (Mathf.Abs(ratio - GoStealth.AmbushFirstHitMul) > 0.02f) Fail($"기습 첫 타 비 {ratio:0.000}(≠ 1.15) {first:0.0}/{firstAmb:0.0}");
            if (yieldAt < 0.375f || yieldAt > 0.375f + 0.04f) Fail($"기습 굴복 직전 체력 {yieldAt:0.000}(37.5% 언저리여야)");
            if (plainAt30 < 0f) Fail("보통 겨루기가 30% 전에 굴복");
            slot.HeroId = id0;
            heroes.Refresh(slot);
            return $"기습 첫 타 ×{ratio:0.00} · 굴복 {yieldAt * 100f:0.0}%(보통은 30% 에서도 섬)";
        }

        private static string CheckCrouch(PlayerController pc)
        {
            if (pc == null) { Fail("PlayerController 없음"); return ""; }
            Vector3 p0 = pc.transform.position;
            float Speed(bool crouch, bool sprint)
            {
                pc.Teleport(p0);
                pc.Crouching = crouch;
                pc.SetTestInput(new Vector2(0f, 1f), sprint);
                for (int i = 0; i < 3; i++) pc.Step(0.05f);
                return pc.GroundSpeedNow;
            }
            float walk = Speed(false, false), crouchV = Speed(true, false);
            float ratio = walk > 0f ? crouchV / walk : 0f;
            if (Mathf.Abs(ratio - GoStealth.CrouchSpeedMul) > 0.02f) Fail($"웅크림 걸음 비 {ratio:0.00}({crouchV:0.00}/{walk:0.00})");
            if (!pc.Crouching) Fail("걸었는데 웅크림이 풀림");
            GoStamina.ResetFull();
            Speed(true, true);
            if (pc.Crouching) Fail("달렸는데 웅크림이 안 풀림");
            pc.Teleport(p0);
            pc.Crouching = true;
            pc.Dash(Vector3.forward, 0.1f, 0.01f);
            if (pc.Crouching) Fail("대시했는데 웅크림이 안 풀림");
            GoStealth.On = false;
            Speed(true, false);
            if (pc.Crouching) Fail("끔인데 웅크림이 남음");
            GoStealth.On = true;
            pc.ClearTestInput();
            pc.Crouching = false;
            pc.Teleport(p0);
            return $"웅크림 걸음 ×{ratio:0.00}·달림·대시면 풀림·끔이면 없음";
        }
    }
}
