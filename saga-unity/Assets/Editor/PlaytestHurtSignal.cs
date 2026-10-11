using System;
using System.Collections.Generic;
using System.Linq;
using System.Reflection;
using UnityEngine;
using UnityEngine.UI;
using Saga.Core;
using Saga.Dungeon.Data;
using Saga.Story.Data;

namespace Saga.EditorTools
{
    /// <summary>
    /// tasks U-0105 — "내가 맞았다" 신호(공용 <see cref="HurtVignette"/>: 가장자리 붉게 번쩍·체력 30% 밑 맥박).
    /// 판 사슬이 한 줄씩 부른다 — `PlaytestDungeonHeadless`("dg")·`PlaytestStorySlice`("st")·`PlaytestHeadless`("go").
    /// 판 칸(살아 있는 장면의 진짜 배선):
    ///   dg — 진짜 `HeroState.TakeDamage` → 번쩍 +1·붉은 숫자 하나·카메라 흔들림(맞힘보다 작게)·무적이면 신호 0, 체력 25% 맥박·50% 꺼짐(PlayerController Bind).
    ///   st — 진짜 `StoryPlayerHp.Hurt` → 번쩍 +1·붉은 숫자 하나·무적 0.7초 안 두 번째는 신호 0, 25%/50% 맥박(StoryPlayerVitals Bind).
    ///   go — 진짜 `FieldCombat.ReceiveStrike` → 번쩍 +1·회피 무적이면 0, 나선 인물 20% 맥박·가득 꺼짐(FieldCombat Bind).
    /// 공용 칸(모든 판): ① Flash → 알파 &gt; 0.3, 0.5초 뒤 0 ② Bind 0.2 → 맥박 0.15~0.3, 0.5 → 0, 0 은 맥박 없음, owner 가 사라지면 풀림
    /// ⑤ 캔버스 하나뿐(두 번 불러도)·Overlay·레이캐스트 0·가운데 투명·가장자리 붉음.
    /// 살아 있는 상태(체력·무적·마지막 피격·판 등급 셈·파티)는 되돌리고, 판이 건 Bind 는 끝에 다시 건다.
    /// </summary>
    public static class PlaytestHurtSignal
    {
        private static string _tag;
        private static bool _ok;
        private const BindingFlags PS = BindingFlags.Public | BindingFlags.NonPublic | BindingFlags.Static;
        private const BindingFlags PI = BindingFlags.Public | BindingFlags.NonPublic | BindingFlags.Instance;

        public static bool Run(string tag, string game)
        {
            _tag = tag; _ok = true;
            var parts = new List<string>();
            var savedFunc = HurtVignette.BoundFunc;
            var savedOwner = HurtVignette.BoundOwner;
            try
            {
                if (game == "dg") CheckDungeon(parts);
                else if (game == "st") CheckStory(parts);
                else if (game == "go") CheckGo(parts);
                else Fail("모르는 판 " + game);
                CheckFlash(parts);
                CheckPulse(parts);
                CheckCanvas(parts);
            }
            catch (Exception e) { Fail("예외 " + e.GetType().Name + ": " + e.Message + "\n" + e.StackTrace); }
            finally
            {
                HurtVignette.ResetForTest();
                bool ownerAlive = ReferenceEquals(savedOwner, null) || savedOwner != null;
                if (savedFunc != null && ownerAlive) HurtVignette.Bind(savedFunc, savedOwner);
            }
            if (_ok) Debug.Log($"[{_tag}] hurt OK - {game} · {string.Join(" · ", parts)}");
            return _ok;
        }

        private static int Popups() => UnityEngine.Object.FindObjectsByType<DamagePopup>(FindObjectsSortMode.None).Length;

        private static void KillPopups(HashSet<DamagePopup> keep)
        {
            foreach (var p in UnityEngine.Object.FindObjectsByType<DamagePopup>(FindObjectsSortMode.None))
                if (!keep.Contains(p)) UnityEngine.Object.DestroyImmediate(p.gameObject);
        }

        private static HashSet<DamagePopup> PopupSet() =>
            new HashSet<DamagePopup>(UnityEngine.Object.FindObjectsByType<DamagePopup>(FindObjectsSortMode.None));

        /// <summary>체력 비율 frac 로 맥박이 켜졌나(0.5초 걸음 뒤 알파 &gt; 0) / 꺼졌나(0).</summary>
        private static void ExpectLow(bool on, string what)
        {
            HurtVignette.Tick(0.5f);
            if (on && !(HurtVignette.Alpha >= HurtVignette.PulseMinA * 0.99f)) Fail($"{what} 맥박 알파 {HurtVignette.Alpha:F3} (기대 ≥ {HurtVignette.PulseMinA})");
            if (!on && HurtVignette.Alpha > 0.0001f) Fail($"{what} 맥박이 안 꺼짐(알파 {HurtVignette.Alpha:F3})");
        }

        private static void CheckDungeon(List<string> parts)
        {
            var pc = UnityEngine.Object.FindFirstObjectByType<Saga.Dungeon.Player.PlayerController>();
            if (pc == null) { Fail("2나락 PlayerController 없음"); return; }
            if (HurtVignette.BoundOwner != pc) Fail("2나락 PlayerController 가 Bind 를 안 걸었음");

            var hpProp = typeof(HeroState).GetProperty(nameof(HeroState.Hp));
            var whoProp = typeof(HeroState).GetProperty(nameof(HeroState.LastHitWho));
            var howProp = typeof(HeroState).GetProperty(nameof(HeroState.LastHitHow));
            var dealtProp = typeof(HeroState).GetProperty(nameof(HeroState.LastDealt));
            int hp = HeroState.Hp, dealt = HeroState.LastDealt; bool inv = HeroState.Invulnerable; int hold = HeroState.DamageHold;
            string who = HeroState.LastHitWho, how = HeroState.LastHitHow;
            var rig = pc.GetComponentInChildren<Saga.Dungeon.Player.CameraRig>();
            var shakeT = typeof(Saga.Dungeon.Player.CameraRig).GetField("_shakeTimer", PI);
            var shakeM = typeof(Saga.Dungeon.Player.CameraRig).GetField("_shakeMagnitude", PI);
            float rigT = 0f, rigM = 0f;
            if (rig != null && shakeT != null) { rigT = (float)shakeT.GetValue(rig); rigM = (float)shakeM.GetValue(rig); }
            var keep = PopupSet();
            try
            {
                HeroState.Invulnerable = false; HeroState.DamageHold = 0;
                hpProp.SetValue(null, HeroState.HpMax);
                if (rig != null && shakeT != null) { shakeT.SetValue(rig, 0f); shakeM.SetValue(rig, 0f); }
                int n = HurtVignette.FlashCount, pops = Popups();
                HeroState.TakeDamage(10f, "진단", "hurt");
                if (HurtVignette.FlashCount != n + 1) Fail($"2나락 피격 번쩍 {HurtVignette.FlashCount - n} ≠ 1");
                if (Popups() != pops + 1) Fail($"2나락 붉은 숫자 {Popups() - pops} ≠ 1");
                if (HeroState.LastDealt <= 0 || HeroState.LastDealt != HeroState.HpMax - HeroState.Hp) Fail($"LastDealt {HeroState.LastDealt} ≠ 깎인 {HeroState.HpMax - HeroState.Hp}");
                if (HurtVignette.Alpha < 0.3f) Fail($"2나락 피격 알파 {HurtVignette.Alpha:F2}");
                string shake = "흔들림 카메라 없음";
                if (rig != null && shakeT != null)
                {
                    float m = (float)shakeM.GetValue(rig), t = (float)shakeT.GetValue(rig);
                    if (!(m > 0f && m < 0.05f && t > 0f)) Fail($"2나락 피격 흔들림 {m}/{t} (기대 0 < 세기 < 맞힘 0.05)");
                    shake = $"흔들림 {m:F2}/{t:F2}";
                }
                // 무적이면 피해도 신호도 없음
                HeroState.Invulnerable = true;
                n = HurtVignette.FlashCount; pops = Popups();
                HeroState.TakeDamage(10f);
                if (HurtVignette.FlashCount != n || Popups() != pops) Fail("2나락 무적인데 신호가 남");
                HeroState.Invulnerable = false;
                // 맥박 — 25% 켜짐, 50% 꺼짐(번쩍은 0.5초 걸음에 다 사라짐)
                hpProp.SetValue(null, Mathf.Max(1, Mathf.RoundToInt(HeroState.HpMax * 0.25f)));
                ExpectLow(true, "2나락 체력 25%");
                hpProp.SetValue(null, Mathf.RoundToInt(HeroState.HpMax * 0.5f));
                ExpectLow(false, "2나락 체력 50%");
                parts.Add($"2나락 피격 번쩍·붉은 숫자 1·{shake}·무적 0·25% 맥박·50% 꺼짐");
            }
            finally
            {
                hpProp.SetValue(null, hp); whoProp.SetValue(null, who); howProp.SetValue(null, how); dealtProp.SetValue(null, dealt);
                HeroState.Invulnerable = inv; HeroState.DamageHold = hold;
                if (rig != null && shakeT != null) { shakeT.SetValue(rig, rigT); shakeM.SetValue(rig, rigM); }
                KillPopups(keep);
            }
        }

        private static void CheckStory(List<string> parts)
        {
            var vit = UnityEngine.Object.FindFirstObjectByType<Saga.Story.Player.StoryPlayerVitals>();
            if (vit == null) { Fail("4종횡 StoryPlayerVitals 없음"); return; }
            if (HurtVignette.BoundOwner != vit) Fail("4종횡 StoryPlayerVitals 가 Bind 를 안 걸었음");

            var t = typeof(StoryPlayerHp);
            var hpP = t.GetProperty(nameof(StoryPlayerHp.Hp)); var invP = t.GetProperty(nameof(StoryPlayerHp.Invuln));
            var sinceP = t.GetProperty(nameof(StoryPlayerHp.SinceHurt)); var fallsP = t.GetProperty(nameof(StoryPlayerHp.Falls));
            var lastMaxF = t.GetField("_lastMax", PS);
            object hp = hpP.GetValue(null), inv = invP.GetValue(null), since = sinceP.GetValue(null), falls = fallsP.GetValue(null), lastMax = lastMaxF.GetValue(null);
            bool hold = StoryPlayerHp.HoldForPick;
            var rr = typeof(Saga.Story.Data.StoryRunRank);
            var rrHits = rr.GetField("_hits", PS); var rrCombo = rr.GetField("_combo", PS);
            object hits = rrHits?.GetValue(null), combo = rrCombo?.GetValue(null);
            var keep = PopupSet();
            try
            {
                StoryPlayerHp.HoldForPick = false;
                StoryPlayerHp.SetForTest(StoryPlayerHp.HpMax);
                int n = HurtVignette.FlashCount, pops = Popups();
                if (!StoryPlayerHp.Hurt(5f)) Fail("4종횡 피격이 안 들어감");
                if (HurtVignette.FlashCount != n + 1) Fail($"4종횡 피격 번쩍 {HurtVignette.FlashCount - n} ≠ 1");
                if (Popups() != pops + 1) Fail($"4종횡 붉은 숫자 {Popups() - pops} ≠ 1");
                if (HurtVignette.Alpha < 0.3f) Fail($"4종횡 피격 알파 {HurtVignette.Alpha:F2}");
                // 무적 0.7초 안 두 번째 — 피해도 신호도 없음
                n = HurtVignette.FlashCount;
                if (StoryPlayerHp.Hurt(5f)) Fail("4종횡 무적 중에 또 맞음");
                if (HurtVignette.FlashCount != n) Fail("4종횡 무적인데 번쩍");
                StoryPlayerHp.SetForTest(StoryPlayerHp.HpMax * 0.25f);
                ExpectLow(true, "4종횡 체력 25%");
                StoryPlayerHp.SetForTest(StoryPlayerHp.HpMax * 0.5f);
                ExpectLow(false, "4종횡 체력 50%");
                parts.Add("4종횡 피격 번쩍·붉은 숫자 1·무적 0·25% 맥박·50% 꺼짐");
            }
            finally
            {
                hpP.SetValue(null, hp); invP.SetValue(null, inv); sinceP.SetValue(null, since); fallsP.SetValue(null, falls); lastMaxF.SetValue(null, lastMax);
                StoryPlayerHp.HoldForPick = hold;
                if (rrHits != null) rrHits.SetValue(null, hits);
                if (rrCombo != null) rrCombo.SetValue(null, combo);
                KillPopups(keep);
            }
        }

        private static void CheckGo(List<string> parts)
        {
            var fc = Saga.Go.Combat.FieldCombat.Instance;
            if (fc == null) { Fail("1만리 FieldCombat 없음"); return; }
            if (HurtVignette.BoundOwner != fc) Fail("1만리 FieldCombat 이 Bind 를 안 걸었음");
            try
            {
                fc.ResetForTest();
                var m = fc.Active;
                if (m == null) { Fail("1만리 나선 인물 없음"); return; }
                int n = HurtVignette.FlashCount;
                if (!fc.ReceiveStrike(5f, null)) Fail("1만리 피격이 안 들어감");
                if (HurtVignette.FlashCount != n + 1) Fail($"1만리 피격 번쩍 {HurtVignette.FlashCount - n} ≠ 1");
                fc.ResetForTest();
                typeof(Saga.Go.Combat.FieldCombat).GetProperty(nameof(Saga.Go.Combat.FieldCombat.InvulnLeft)).SetValue(fc, 1f); // 회피 무적(구르기 없이 — 기력 안 씀)
                n = HurtVignette.FlashCount;
                fc.ReceiveStrike(5f, null);
                if (HurtVignette.FlashCount != n) Fail("1만리 회피 무적인데 번쩍");
                fc.ResetForTest();
                m = fc.Active;
                m.Hp = m.MaxHp * 0.2f;
                ExpectLow(true, "1만리 나선 인물 20%");
                m.Hp = m.MaxHp;
                ExpectLow(false, "1만리 나선 인물 가득");
                parts.Add("1만리 피격 번쩍·회피 0·20% 맥박·가득 꺼짐");
            }
            finally { fc.ResetForTest(); }
        }

        private static void CheckFlash(List<string> parts)
        {
            HurtVignette.ResetForTest();
            HurtVignette.Flash();
            if (HurtVignette.FlashCount != 1) Fail("Flash 셈 ≠ 1");
            if (HurtVignette.Alpha <= 0.3f) Fail($"Flash 직후 알파 {HurtVignette.Alpha:F2} ≤ 0.3");
            var img = HurtVignette.ImageNow;
            if (img == null || !img.enabled) Fail("Flash 직후 가장자리 그림이 안 켜짐");
            HurtVignette.Tick(0.2f);
            float mid = HurtVignette.Alpha;
            if (!(mid > 0f && mid < HurtVignette.FlashA)) Fail($"Flash 0.2초 뒤 알파 {mid:F2}(줄어드는 중이어야)");
            HurtVignette.Tick(0.3f);
            if (HurtVignette.Alpha > 0.0001f) Fail($"Flash 0.5초 뒤 알파 {HurtVignette.Alpha:F3} ≠ 0");
            if (img != null && img.enabled) Fail("Flash 끝났는데 그림이 켜져 있음");
            parts.Add($"번쩍 {HurtVignette.FlashA}→{mid:F2}→0");
        }

        private static void CheckPulse(List<string> parts)
        {
            HurtVignette.ResetForTest();
            HurtVignette.Tick(0.5f);
            if (HurtVignette.Alpha > 0f) Fail("Bind 없는데 맥박");
            float frac = 0.2f;
            HurtVignette.Bind(() => frac);
            HurtVignette.Flash(); // 캔버스 — 맥박만 볼 때도 같은 것
            HurtVignette.Tick(0.5f);
            float lo = 1f, hi = 0f;
            for (int i = 0; i < 60; i++) { HurtVignette.Tick(1f / 30f); lo = Mathf.Min(lo, HurtVignette.Alpha); hi = Mathf.Max(hi, HurtVignette.Alpha); }
            if (lo < HurtVignette.PulseMinA * 0.99f || hi > HurtVignette.PulseMaxA * 1.01f || hi - lo < 0.05f) Fail($"맥박 0.2 알파 {lo:F2}~{hi:F2} (기대 0.15~0.3 사이에서 오르내림)");
            frac = 0.5f;
            ExpectLow(false, "Bind 0.5");
            frac = 0f;
            ExpectLow(false, "Bind 0(쓰러짐)");
            HurtVignette.SetLow(true);
            ExpectLow(true, "SetLow(true)");
            HurtVignette.SetLow(false);
            ExpectLow(false, "SetLow(false)");
            var owner = new GameObject("HurtSignalOwner(test)");
            HurtVignette.Bind(() => 0.2f, owner);
            ExpectLow(true, "owner 살아 있음");
            UnityEngine.Object.DestroyImmediate(owner);
            ExpectLow(false, "owner 사라짐");
            if (HurtVignette.BoundFunc != null) Fail("owner 가 사라졌는데 Bind 가 남음");
            parts.Add($"맥박 0.2 → {lo:F2}~{hi:F2}·0.5/0/owner 사라짐 → 0");
        }

        private static void CheckCanvas(List<string> parts)
        {
            HurtVignette.ResetForTest();
            HurtVignette.Flash(); HurtVignette.Flash(); HurtVignette.Bind(() => 0.1f); HurtVignette.SetLow(true);
            int count = UnityEngine.Object.FindObjectsByType<HurtVignette>(FindObjectsSortMode.None).Length;
            if (count != 1) Fail($"신호 캔버스 {count} ≠ 1");
            var canvas = HurtVignette.CanvasNow;
            if (canvas == null) { Fail("캔버스 없음"); return; }
            if (canvas.renderMode != RenderMode.ScreenSpaceOverlay) Fail("캔버스가 Overlay 가 아님");
            if (canvas.GetComponent<GraphicRaycaster>() != null) Fail("캔버스에 GraphicRaycaster 가 붙음");
            var graphics = canvas.GetComponentsInChildren<Graphic>(true);
            if (graphics.Length == 0 || graphics.Any(g => g.raycastTarget)) Fail("raycastTarget 이 켜진 그림이 있음");
            var tex = HurtVignette.EdgeTexture;
            float center = tex.GetPixel(tex.width / 2, tex.height / 2).a;
            float quarter = tex.GetPixel(tex.width / 4, tex.height / 2).a;   // 가운데 쪽 25% 지점 — 아직 투명
            float edge = tex.GetPixel(0, tex.height / 2).a, corner = tex.GetPixel(0, 0).a;
            if (center > 0f || quarter > 0f) Fail($"가운데가 투명하지 않음({center:F2}/{quarter:F2})");
            if (edge < 0.8f || corner < 0.8f) Fail($"가장자리가 옅음({edge:F2}/{corner:F2})");
            // 장면이 바뀐 것처럼 캔버스가 사라지면 다음 부름에 다시 하나
            UnityEngine.Object.DestroyImmediate(canvas.gameObject);
            HurtVignette.Flash();
            count = UnityEngine.Object.FindObjectsByType<HurtVignette>(FindObjectsSortMode.None).Length;
            if (count != 1 || HurtVignette.CanvasNow == null) Fail($"캔버스가 사라진 뒤 다시 만들기 {count} ≠ 1");
            parts.Add($"캔버스 1·레이캐스트 0·가운데 {center:F0}·가장자리 {edge:F2}");
        }

        private static void Fail(string msg)
        {
            _ok = false;
            Debug.LogError($"[{_tag}] hurt FAIL - {msg}");
        }
    }
}
