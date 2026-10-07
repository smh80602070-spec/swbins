using System.Collections.Generic;
using UnityEngine;
using Saga.Dungeon.Cinematics;
using Saga.Dungeon.Data;
using Saga.Dungeon.Player;
using Saga.Dungeon.UI;
using Saga.Dungeon.World;

namespace Saga.EditorTools
{
    /// <summary>
    /// PLAN.md 109-10-8 동행 서명·합격(웹 사가나락 §5.17) 진단 — `PlaytestDungeonHeadless` 가 몸짓 뒤에 부른다(한 프레임 안, 시간은 넣어서).
    /// 웹 진단 셋(쓸 까닭 / 실제 방·쿨 / 합격 ×1.50·창 밖·손잡이)을 이 트랙에 맞춰:
    /// 표(재사용 24·21초·반경·밀침 상한·그림 문자) · 쓸 까닭 진리표 · 시험 시전자(외딴 곳 더미)로 첫 4초·셋 모임·정예 하나·두목 하나·반경 밖·
    /// 피해 = 평타 × v·밀침(두목은 안 밀림)·술사 얼림·재사용 · 합격 ×1.50·알림·창은 한 번(둘째 동행은 못 씀)·창 밖 1.6초 · 못 움직이면 안 씀 · 손잡이 ·
    /// 진짜 회전베기가 창을 연다 · 진짜 동행 둘에 시전자(역할)·몸짓 제 키(쓴 쪽만 ✨) · ko/en.
    /// 끝나면 더미·셈·창·동행 재사용을 시작 때로.
    /// </summary>
    public static class PlaytestDungeonAllySig
    {
        private const string T = "[PlaytestDungeonHeadless] allysig";
        private static readonly Vector3 Far = new Vector3(-7000f, 0f, -7000f);
        private static bool _ok;
        private static readonly List<GameObject> Dummies = new List<GameObject>();

        public static bool Run()
        {
            _ok = true;
            var playerGo = GameObject.FindWithTag("Player");
            if (playerGo == null) { Fail("플레이어 없음"); return false; }
            int sigs = AllySigState.Sigs, combos = AllySigState.Combos;
            var realCasters = Object.FindObjectsByType<AllySigCaster>(FindObjectsSortMode.None);
            var realCd = new Dictionary<AllySigCaster, float>();
            foreach (var c in realCasters) realCd[c] = c.CooldownLeft;
            string m = "";
            try
            {
                DungeonCutscenes.Instance?.Skip();
                AllySigState.Enabled = true;
                m += CheckTable() + CheckCasts() + CheckCombo() + CheckSwitch() + CheckReal(playerGo) + CheckLocalization();
            }
            finally
            {
                AllySigState.Enabled = true;
                AllySigState.NowOverride = -1f;
                AllySigState.OnCast(true); // 창 닫기(셈은 아래서 되돌림)
                AllySigState.RestoreCounts(sigs, combos);
                GestureState.Reset();
                foreach (var kv in realCd) if (kv.Key != null) kv.Key.SetCooldownForTest(kv.Value);
                foreach (var d in Dummies) if (d != null) Object.DestroyImmediate(d);
                Dummies.Clear();
                playerGo.GetComponent<PlayerCombat>()?.ResetCooldownsForTest();
            }
            if (_ok) Debug.Log($"{T} OK - 표(재사용 24·21·반경 5·밀침)·쓸 까닭 진리표·첫 4초·셋/정예/두목/반경 밖·피해 ×v·밀침(두목 제외)·얼림·재사용 · 합격 ×1.50·알림·창 한 번·창 밖 · 못 움직임·손잡이 · 회전베기 = 창 · 동행 둘·제 키 몸짓 · ko/en |{m}");
            return _ok;
        }

        private static string CheckTable()
        {
            var g = AllySigState.Guard;
            var my = AllySigState.Mystic;
            if (!Mathf.Approximately(AllySigState.CooldownOf(g), 24f) || !Mathf.Approximately(AllySigState.CooldownOf(my), 21f)) Fail("재사용 ≠ 24·21");
            if (!Mathf.Approximately(AllySigState.CooldownOf(new AllySigState.Sig { Cd = 4f }), AllySigState.CdMin)) Fail("재사용 하한 8 안 먹음");
            if (g.Knockback > AllySigState.KnockbackMax + 1e-4f || my.Knockback > AllySigState.KnockbackMax + 1e-4f) Fail("밀침 상한 넘음");
            if (g.ChillSec != 0f || !Mathf.Approximately(my.ChillSec, 2.8f)) Fail("얼림 값");
            if (AllySigState.Of(PartyRole.Guard).NameKey != g.NameKey || AllySigState.Of(PartyRole.Mystic).NameKey != my.NameKey) Fail("역할 → 서명");
            foreach (var s in new[] { g, my })
                if (string.IsNullOrEmpty(s.Emoji) || s.Emoji.Contains("️") || s.V <= 1f) Fail($"{s.NameKo} 그림 문자·배율");
            // 쓸 까닭(웹 allySigWants 진리표)
            var rows = new (int n, bool strong, bool combo, bool expect)[]
            {
                (0, false, false, false), (0, true, true, false), (1, false, false, false), (2, false, false, false),
                (3, false, false, true), (1, true, false, true), (1, false, true, true), (5, false, false, true),
            };
            foreach (var r in rows)
                if (AllySigState.Wants(r.n, r.strong, r.combo) != r.expect) Fail($"쓸 까닭 n{r.n}·강{r.strong}·합{r.combo} ≠ {r.expect}");
            return " 표";
        }

        /// <summary>외딴 곳에 시험 시전자 하나(평타 피해 4) — 동행 몸 없이 규칙만 본다.</summary>
        private static AllySigCaster TestCaster(PartyRole role, Vector3 at, System.Func<bool> canAct = null)
        {
            var go = new GameObject("AllySigTestCaster_" + role);
            go.transform.position = at;
            Dummies.Add(go);
            return AllySigCaster.Attach(go, role, canAct, () => 4f, null);
        }

        private static string CheckCasts()
        {
            string m = "";
            AllySigState.OnCast(true); // 창 닫힘에서 시작
            GestureState.Reset();
            var c = TestCaster(PartyRole.Guard, Far);
            var a = Dummy(Far + new Vector3(2f, 0f, 0f), false, false);
            var b = Dummy(Far + new Vector3(0f, 0f, 2f), false, false);
            // 첫 4초 — 셋이 모여도 안 씀
            var third = Dummy(Far + new Vector3(-2f, 0f, 0f), false, false);
            if (c.Tick(AllySigState.FirstSec - 0.1f, 10f)) Fail("첫 4초 안에 씀");
            third.gameObject.SetActive(false); // 둘만
            if (c.Tick(0.2f, 10f)) Fail("적 둘에 씀(셋 모임 아님)");
            third.gameObject.SetActive(true);
            float hpA = a.CurrentHp;
            float distA = Flat(a.transform.position, Far);
            int sigs0 = AllySigState.Sigs;
            if (!c.Tick(0.01f, 10f)) Fail("셋 모였는데 안 씀");
            float dmg = hpA - a.CurrentHp;
            if (c.LastHits != 3 || !Mathf.Approximately(dmg, 4f * AllySigState.Guard.V) || c.LastCombo || AllySigState.Sigs != sigs0 + 1)
                Fail($"서명 맞힘 {c.LastHits}·피해 {dmg}(기대 {4f * AllySigState.Guard.V})·합격 {c.LastCombo}");
            float pushed = Flat(a.transform.position, Far) - distA;
            if (Mathf.Abs(pushed - AllySigState.Guard.Knockback) > 0.01f) Fail($"밀침 {pushed:0.00}m ≠ {AllySigState.Guard.Knockback}");
            if (!Mathf.Approximately(c.CooldownLeft, AllySigState.CooldownOf(AllySigState.Guard))) Fail($"재사용 {c.CooldownLeft}");
            if (!GestureState.TryActive(GestureState.GuardKey, 10f, out var gc) || gc.Kind != GestureState.Kind.Sig
                || gc.Text != DungeonLocalization.T("gesture.sig", "✨ 서명")) Fail("몸짓 ✨ 서명 없음");
            if (GestureState.TryActive(GestureState.MysticKey, 10f, out _)) Fail("안 쓴 술사에도 몸짓");
            // 재사용 동안 안 씀 → 돌면 또
            if (c.Tick(AllySigState.CooldownOf(AllySigState.Guard) - 0.1f, 20f)) Fail("재사용 중에 씀");
            if (!c.Tick(0.2f, 20f)) Fail("재사용이 돌았는데 안 씀");
            m += $" 셋 {c.LastHits}·피해 {dmg}·밀침 {pushed:0.00}m";
            foreach (var d in new[] { a, b, third }) d.gameObject.SetActive(false);

            // 정예 하나 → 씀 · 두목 하나 → 씀·안 밀림 · 반경 밖 셋 → 안 씀
            var elite = Dummy(Far + new Vector3(3f, 0f, 0f), true, false);
            c.SetCooldownForTest(0f);
            if (!c.Tick(0.01f, 30f) || c.LastHits != 1) Fail("정예 하나에 안 씀");
            elite.gameObject.SetActive(false);
            var boss = Dummy(Far + new Vector3(0f, 0f, 3f), false, true);
            float bossDist = Flat(boss.transform.position, Far);
            c.SetCooldownForTest(0f);
            if (!c.Tick(0.01f, 31f) || c.LastHits != 1) Fail("두목 하나에 안 씀");
            if (Mathf.Abs(Flat(boss.transform.position, Far) - bossDist) > 0.001f) Fail("두목이 밀림");
            boss.gameObject.SetActive(false);
            var farOnes = new[]
            {
                Dummy(Far + new Vector3(AllySigState.Radius + 0.5f, 0f, 0f), false, false),
                Dummy(Far + new Vector3(0f, 0f, AllySigState.Radius + 0.5f), false, false),
                Dummy(Far + new Vector3(-AllySigState.Radius - 0.5f, 0f, 0f), false, false),
            };
            c.SetCooldownForTest(0f);
            if (c.Tick(0.01f, 32f)) Fail("반경 밖 셋에 씀");
            foreach (var d in farOnes) d.gameObject.SetActive(false);

            // 술사 — 얼림·밀침 0.83
            var mc = TestCaster(PartyRole.Mystic, Far + new Vector3(100f, 0f, 0f));
            var e = Dummy(Far + new Vector3(102f, 0f, 0f), true, false);
            mc.SetCooldownForTest(0f);
            if (!mc.Tick(0.01f, 40f) || !e.IsChilled) Fail("술사 서명이 안 얼림");
            if (!Mathf.Approximately(mc.LastDamage, 4f * AllySigState.Mystic.V)) Fail($"술사 피해 {mc.LastDamage}");
            float mp = Flat(e.transform.position, Far + new Vector3(100f, 0f, 0f)) - 2f;
            if (Mathf.Abs(mp - AllySigState.Mystic.Knockback) > 0.01f) Fail($"술사 밀침 {mp:0.00}");
            e.gameObject.SetActive(false);

            // 못 움직이면(쓰러짐) 안 씀
            bool up = false;
            var dc = TestCaster(PartyRole.Guard, Far + new Vector3(200f, 0f, 0f), () => up);
            var de = Dummy(Far + new Vector3(201f, 0f, 0f), true, false);
            dc.SetCooldownForTest(0f);
            if (dc.Tick(0.01f, 50f)) Fail("쓰러졌는데 씀");
            up = true;
            if (!dc.Tick(0.01f, 50f)) Fail("일어섰는데 안 씀");
            de.gameObject.SetActive(false);
            return m;
        }

        private static string CheckCombo()
        {
            var g = TestCaster(PartyRole.Guard, Far + new Vector3(300f, 0f, 0f));
            var my = TestCaster(PartyRole.Mystic, Far + new Vector3(300f, 0f, 1f));
            var e = Dummy(Far + new Vector3(302f, 0f, 0f), false, false); // 잡졸 하나 — 합격 창에서만 쓸 까닭
            g.SetCooldownForTest(0f);
            my.SetCooldownForTest(0f);
            if (g.Tick(0.01f, 100f)) Fail("창 없이 잡졸 하나에 씀");
            int combos0 = AllySigState.Combos;
            AllySigState.OnLeadSignature(100f);
            if (!AllySigState.ComboOpen(101.4f) || AllySigState.ComboOpen(101.5f)) Fail("창 1.5초가 아님");
            float hp = e.CurrentHp;
            if (!g.Tick(0.01f, 101f) || !g.LastCombo) Fail("창 안에서 합격 안 됨");
            float ratio = g.LastDamage / (4f * AllySigState.Guard.V);
            if (Mathf.Abs(ratio - 1.5f) > 1e-4f || Mathf.Abs(hp - e.CurrentHp - g.LastDamage) > 1e-3f) Fail($"합격 배율 {ratio:0.00}");
            if (AllySigState.Combos != combos0 + 1) Fail("합격 셈");
            string toast = DialogueLabel.Instance != null ? DialogueLabel.Instance.CurrentText : "";
            if (DialogueLabel.Instance != null && !toast.Contains(AllySigState.Name(AllySigState.Guard))) Fail($"합격 알림 '{toast}'");
            if (!GestureState.TryActive(GestureState.GuardKey, 101f, out var gc) || gc.Text != DungeonLocalization.T("gesture.combo", "⚡ 합격")) Fail("몸짓 ⚡ 합격");
            if (my.Tick(0.01f, 101.1f)) Fail("한 창으로 둘째 동행도 합격");
            // 창 밖
            AllySigState.OnLeadSignature(200f);
            my.SetCooldownForTest(0f);
            if (my.Tick(0.01f, 201.6f)) Fail("창 밖(1.6초)인데 합격");
            e.gameObject.SetActive(false);
            return $" 합격 ×{ratio:0.00}";
        }

        private static string CheckSwitch()
        {
            var c = TestCaster(PartyRole.Guard, Far + new Vector3(400f, 0f, 0f));
            var e = Dummy(Far + new Vector3(401f, 0f, 0f), true, false);
            c.SetCooldownForTest(0f);
            AllySigState.Enabled = false;
            bool cast = c.Tick(0.01f, 300f);
            AllySigState.Enabled = true;
            if (cast) Fail("손잡이 끔인데 씀");
            e.gameObject.SetActive(false);
            return " 손잡이";
        }

        private static string CheckReal(GameObject playerGo)
        {
            string m = "";
            // 진짜 회전베기 — 곁에 튼튼한 더미 하나 → 창이 열린다.
            AllySigState.OnCast(true);
            var combat = playerGo.GetComponent<PlayerCombat>();
            var near = Dummy(playerGo.transform.position + playerGo.transform.forward * 1.2f, false, false);
            combat.ResetCooldownsForTest();
            combat.TriggerWhirl();
            if (!AllySigState.ComboOpen(AllySigState.Now)) Fail("회전베기가 합격 창을 안 엶");
            near.gameObject.SetActive(false);
            AllySigState.OnCast(true);
            combat.ResetCooldownsForTest();

            var roles = new HashSet<PartyRole>();
            foreach (var c in Object.FindObjectsByType<AllySigCaster>(FindObjectsSortMode.None))
            {
                if (c.name.StartsWith("AllySigTestCaster")) continue;
                roles.Add(c.Role);
                var ally = (Component)c.GetComponent<AllyFighter>() ?? c.GetComponent<AllyMystic>();
                if (ally == null) Fail($"{c.name} 은 동행이 아닌데 시전자");
                else if ((ally is AllyFighter) != (c.Role == PartyRole.Guard)) Fail($"{c.name} 역할 틀림");
                var g = c.GetComponent<Gesturer>();
                if (g == null || g.OwnKey != AllySigCaster.GestureKeyOf(c.Role)) Fail($"{c.name} 몸짓 제 키 없음");
            }
            if (AllyFighter.Instance != null && !roles.Contains(PartyRole.Guard)) Fail("무사에 시전자 없음");
            if (AllyMystic.Instance != null && !roles.Contains(PartyRole.Mystic)) Fail("술사에 시전자 없음");
            // 쓴 쪽만 ✨ — 진짜 동행 둘의 몸짓
            if (AllyFighter.Instance != null && AllyMystic.Instance != null)
            {
                GestureState.Reset();
                GestureState.OnAllySig(GestureState.GuardKey, false, 500f);
                var gf = AllyFighter.Instance.GetComponent<Gesturer>();
                var gm = AllyMystic.Instance.GetComponent<Gesturer>();
                gf.Apply(500.3f);
                gm.Apply(500.3f);
                if (gf.LabelText != DungeonLocalization.T("gesture.sig", "✨ 서명") || gm.LabelText == gf.LabelText) Fail($"제 키 몸짓 무사 '{gf.LabelText}'·술사 '{gm.LabelText}'");
                // 동행 둘이 같이 읽는 호응은 여전히 둘 다
                GestureState.OnLeadSignature(600f);
                gf.Apply(600.1f);
                gm.Apply(600.1f);
                if (gf.LabelText == "" || gm.LabelText == "") Fail("호응이 한쪽만");
                gf.Apply(700f);
                gm.Apply(700f);
            }
            m += $" 동행 {roles.Count}";
            return m;
        }

        private static string CheckLocalization()
        {
            var keys = new[] { "allysig.guard", "allysig.mystic", "allysig.combo", "gesture.sig", "gesture.combo" };
            int n = 0;
            foreach (var lang in new[] { "ko", "en" })
            {
                var ta = Resources.Load<TextAsset>($"Localization/dungeon_{lang}");
                if (ta == null) { Fail($"번역 {lang} 없음"); continue; }
                foreach (var k in keys) { if (!ta.text.Contains($"\"{k}\"")) Fail($"{lang} 에 {k} 없음"); n++; }
            }
            return $" 키 {n}";
        }

        private static DungeonEnemy Dummy(Vector3 at, bool elite, bool boss)
        {
            var go = new GameObject("AllySigDummy");
            go.SetActive(false);
            go.transform.position = at;
            var e = go.AddComponent<DungeonEnemy>();
            e.SetSpawnContext("allysig_test", null);
            e.ConfigureCombat(1000f, 0f, 0, 0, null, null, boss, "황건적", Color.white, 1f);
            if (elite) e.MarkElite();
            go.SetActive(true);
            Dummies.Add(go);
            return e;
        }

        private static float Flat(Vector3 a, Vector3 b)
        {
            a.y = 0f;
            b.y = 0f;
            return Vector3.Distance(a, b);
        }

        private static void Fail(string why)
        {
            _ok = false;
            Debug.LogError($"{T} FAIL - {why}");
        }
    }
}
