using System.Collections.Generic;
using System.Reflection;
using UnityEngine;
using Saga.Core;
using Saga.Story.Data;
using Saga.Story.Player;
using Saga.Story.World;

namespace Saga.EditorTools
{
    /// <summary>
    /// tasks U-0142 4종횡 회피 + 저스트 회피(웹 W-0282·고돗 G-0233) 진단 — `PlaytestStorySlice` 준비 단계가 부른다. 같은 프레임 안에서 끝낸다.
    /// 회피 거리 2.8m·무적 0.12초·쿨 0.9초 · 무적 안 두목 판정(실제 러너 Hurt) → 저스트·피해 0·금빛 번쩍·슬로 0.35·다음 타 1.3 한 번(실제 연참이 씀) ·
    /// 쿨 중엔 저스트 없음 · 맞은 뒤 무적(0.7초) 안은 저스트 아님 · 무적 밖 → 맞음 · 슬로 0.8초·쿨 4초 끝.
    /// (dash 유파 2세트 회피 쿨 ×0.8 은 유파 세트 진단 `CheckPromotionAndSchools` 몫.)
    /// 끝나면 자리·체력·판 등급 셈·저스트 상태를 되돌리고, 이 진단이 만든 숫자 팝업을 지운다.
    /// </summary>
    public static class PlaytestStoryJust
    {
        private const string T = "[PlaytestStorySlice] storyJust";
        private const BindingFlags PS = BindingFlags.Public | BindingFlags.NonPublic | BindingFlags.Static;
        private const BindingFlags PI = BindingFlags.Public | BindingFlags.NonPublic | BindingFlags.Instance;
        private static bool _ok;

        public static bool Run()
        {
            _ok = true;
            var playerGo = GameObject.FindWithTag("Player");
            var pc = playerGo != null ? playerGo.GetComponent<StoryPlayerController>() : null;
            var cc = playerGo != null ? playerGo.GetComponent<CharacterController>() : null;
            var runner = Object.FindFirstObjectByType<StoryBossPatternRunner>();
            if (pc == null || cc == null) { Fail("플레이어 없음"); return false; }
            if (runner == null) { Fail("두목 러너 없음"); return false; }

            Vector3 pos0 = playerGo.transform.position;
            var hpT = typeof(StoryPlayerHp);
            var hpP = hpT.GetProperty(nameof(StoryPlayerHp.Hp)); var sinceP = hpT.GetProperty(nameof(StoryPlayerHp.SinceHurt));
            var fallsP = hpT.GetProperty(nameof(StoryPlayerHp.Falls)); var lastMaxF = hpT.GetField("_lastMax", PS);
            object hp0 = hpP.GetValue(null), since0 = sinceP.GetValue(null), falls0 = fallsP.GetValue(null), lastMax0 = lastMaxF.GetValue(null);
            var rr = typeof(StoryRunRank);
            var rrHits = rr.GetField("_hits", PS); var rrCombo = rr.GetField("_combo", PS);
            object hits0 = rrHits?.GetValue(null), combo0 = rrCombo?.GetValue(null);
            bool hold0 = StoryPlayerHp.HoldForPick;
            float dealt0 = runner.DamageDealt;
            int runnerHits0 = runner.Hits;
            var roots0 = new HashSet<GameObject>(UnityEngine.SceneManagement.SceneManager.GetActiveScene().GetRootGameObjects());
            var cdF = typeof(StoryPlayerController).GetField("_dodgeCooldownLeft", PI);
            var atkCdF = typeof(StoryPlayerController).GetField("_attackCooldownLeft", PI);
            string m = "";
            try
            {
                StoryPlayerHp.HoldForPick = false;
                StoryPlayerHp.SetForTest(StoryPlayerHp.HpMax);
                StoryJust.Reset();
                cdF.SetValue(pc, 0f);

                // 회피 — 적에게서 먼 자리(연참이 아무도 안 때리게)에서 오른쪽으로.
                float x = FreeX();
                Place(cc, playerGo.transform, new Vector3(x, 0.1f, 0f));
                pc.SetTestAxis(1f);
                bool did = pc.TriggerDodge();
                pc.ClearTestInput();
                float dx = playerGo.transform.position.x - x;
                if (!did || Mathf.Abs(dx - 2.8f) > 0.05f) Fail($"회피 거리 {dx:F2}m(기대 2.8)");
                if (!Mathf.Approximately(StoryPlayerHp.Invuln, StoryPlayerHp.DodgeInvuln) || !Mathf.Approximately(StoryPlayerHp.DodgeLeft, 0.12f))
                    Fail($"회피 무적 {StoryPlayerHp.Invuln}/{StoryPlayerHp.DodgeLeft}");
                if (!Mathf.Approximately(pc.DodgeCooldownLeft, 0.9f) || pc.TriggerDodge()) Fail($"회피 쿨 {pc.DodgeCooldownLeft}(기대 0.9·쿨 중 다시 안 됨)");
                m += " 회피 2.8m·무적 0.12·쿨 0.9";

                // 저스트 — 무적 안에 실제 두목 판정이 닿는다.
                float hpBefore = StoryPlayerHp.Hp;
                int flash0 = HurtVignette.FlashCount, just0 = StoryJust.Count;
                runner.Hurt(10f, StoryBossPattern.Kind.Slam);
                if (StoryJust.Count != just0 + 1) Fail("무적 안 두목 판정인데 저스트 아님");
                if (StoryPlayerHp.Hp != hpBefore || runner.DamageDealt != dealt0 || runner.Hits != runnerHits0) Fail($"저스트인데 피해 {hpBefore - StoryPlayerHp.Hp}");
                if (HurtVignette.FlashCount != flash0 + 1 || HurtVignette.Tint != StoryPlayerVitals.JustColor) Fail($"저스트 번쩍 {HurtVignette.FlashCount - flash0}·색 {HurtVignette.Tint}");
                if (!Mathf.Approximately(StoryJust.Scale(1f), 0.35f) || !Mathf.Approximately(StoryJust.SlowLeft, 0.8f) || !Mathf.Approximately(StoryJust.CdLeft, 4f))
                    Fail($"저스트 슬로 {StoryJust.Scale(1f)}·{StoryJust.SlowLeft}·쿨 {StoryJust.CdLeft}");
                // 다음 한 타 ×1.3 — 실제 연참이 한 번 꺼내 쓴다.
                if (!Mathf.Approximately(StoryJust.Bonus, 1.3f)) Fail($"다음 타 {StoryJust.Bonus}");
                atkCdF.SetValue(pc, 0f);
                pc.TriggerAttack();
                if (!Mathf.Approximately(StoryJust.Bonus, 1f) || !Mathf.Approximately(StoryJust.TakeNextMul(), 1f)) Fail($"다음 타가 안 쓰임 {StoryJust.Bonus}");
                m += " 저스트(피해 0·금빛·슬로 0.35·다음 타 1.3 한 번)";

                // 쿨 중 — 다시 회피해 닿아도 저스트 아님(피해도 없음).
                cdF.SetValue(pc, 0f);
                pc.TriggerDodge();
                hpBefore = StoryPlayerHp.Hp;
                runner.Hurt(10f, StoryBossPattern.Kind.Slam);
                if (StoryJust.Count != just0 + 1 || StoryPlayerHp.Hp != hpBefore) Fail("쿨 중 저스트/피해");
                // 슬로 0.8초·쿨 4초 끝.
                StoryJust.Tick(0.81f);
                if (!Mathf.Approximately(StoryJust.Scale(1f), 1f)) Fail("슬로가 0.8초 뒤에도 남음");
                StoryJust.Tick(3.2f);
                if (StoryJust.CdLeft > 0f) Fail($"쿨 4초 뒤 {StoryJust.CdLeft}");
                m += " 쿨 중 없음·슬로 0.8·쿨 4";

                // 무적 밖 → 맞음. 맞은 뒤 무적(0.7초) 안은 회피 아니라 저스트 아님.
                StoryPlayerHp.Tick(0.2f);
                hpBefore = StoryPlayerHp.Hp;
                runner.Hurt(10f, StoryBossPattern.Kind.Slam);
                if (StoryPlayerHp.Hp >= hpBefore || StoryJust.Count != just0 + 1) Fail($"무적 밖인데 안 맞음/저스트 {hpBefore}→{StoryPlayerHp.Hp}");
                runner.Hurt(10f, StoryBossPattern.Kind.Slam);
                if (StoryJust.Count != just0 + 1) Fail("맞은 뒤 무적인데 저스트");
                m += " 무적 밖 맞음·피격 무적은 아님";
            }
            catch (System.Exception ex)
            {
                Fail("예외 " + ex);
            }
            finally
            {
                pc.ClearTestInput();
                StoryJust.Reset();
                hpP.SetValue(null, hp0); sinceP.SetValue(null, since0); fallsP.SetValue(null, falls0); lastMaxF.SetValue(null, lastMax0);
                StoryPlayerHp.SetForTest(StoryPlayerHp.Hp);
                StoryPlayerHp.HoldForPick = hold0;
                if (rrHits != null) rrHits.SetValue(null, hits0);
                if (rrCombo != null) rrCombo.SetValue(null, combo0);
                typeof(StoryBossPatternRunner).GetProperty(nameof(StoryBossPatternRunner.DamageDealt)).SetValue(runner, dealt0);
                typeof(StoryBossPatternRunner).GetProperty(nameof(StoryBossPatternRunner.Hits)).SetValue(runner, runnerHits0);
                cdF.SetValue(pc, 0f);
                atkCdF.SetValue(pc, 0f);
                HurtVignette.Tick(1f);
                foreach (var go in UnityEngine.SceneManagement.SceneManager.GetActiveScene().GetRootGameObjects())
                    if (!roots0.Contains(go) && (go.GetComponent<DamagePopup>() != null || go.GetComponent<StoryGroundDecal>() != null || go.name.StartsWith("HitSpark")))
                        Object.DestroyImmediate(go);
                Place(cc, playerGo.transform, pos0);
            }
            if (_ok) Debug.Log($"{T} OK -{m}");
            return _ok;
        }

        /// <summary>적이 4m 안에 없는 들판 자리(연참 사거리 2.2m + 회피 2.8m 를 넉넉히).</summary>
        private static float FreeX()
        {
            for (float x = 3f; x < FieldMapData.WidthM - 4f; x += 0.5f)
            {
                bool clear = true;
                foreach (var e in StoryEnemy.All)
                    if (e != null && !e.IsDead && Mathf.Abs(e.transform.position.x - x) < 4f + 2.8f) { clear = false; break; }
                if (clear) return x;
            }
            return 3f;
        }

        private static void Place(CharacterController cc, Transform t, Vector3 p)
        {
            cc.enabled = false;
            t.position = p;
            cc.enabled = true;
        }

        private static void Fail(string why)
        {
            _ok = false;
            Debug.LogError($"{T} FAIL - {why}");
        }
    }
}
