using UnityEngine;
using Saga.Dungeon.Data;
using Saga.Dungeon.UI;
using DungeonSave = Saga.Dungeon.Data.SaveState;

namespace Saga.EditorTools
{
    /// <summary>
    /// tasks U-0135 2나락 무예별 작은 나무 진단 — `PlaytestDungeonHeadless` 무기 두 벌(swap) 뒤에 부른다(한 프레임 안).
    /// 다섯 줄: ① 경험·레벨(Lv×8, 누적 1520 에 20) ② 찍기 규칙(앞 마디·한 갈래·마디 최대·점 모자람) ③ 효과(위력·재냉각+기력 하한 0.3·범위·흡수·
    /// 불 결/분노 겹침·한기 결 얼림·연타) ④ 되돌리기 금 200·경험 유지·금 모자람 ⑤ 저장 왕복·옛 세이브 빈 나무·비결 창 나무 단추·나무 창 겹침 0.
    /// 영웅(금·레벨·무기)·비결·나무는 떠 뒀다 되돌린다.
    /// </summary>
    public static class PlaytestDungeonSkillTree
    {
        private const string T = "[PlaytestDungeonHeadless] tree";
        private static bool _ok, _step;

        public static bool Run()
        {
            _ok = true;
            int lv = HeroState.Level, exp = HeroState.Exp, hp = HeroState.Hp, gold = HeroState.Gold;
            string w = HeroState.EquippedWeaponId, gem = HeroState.SocketedGemId, w2 = HeroState.SecondWeaponId;
            var secrets = SecretState.Snapshot();
            string tree0 = SkillTree.Snapshot();
            const SecretMove A = SecretMove.Attack, W = SecretMove.Whirl;
            try
            {
                SkillTree.ResetForTest();
                SecretState.Restore(null);

                // ① 경험·레벨
                Begin();
                for (int i = 0; i < 7; i++) SkillTree.Gain(A);
                if (SkillTree.Level(A) != 1) Fail($"경험 7 에 Lv.{SkillTree.Level(A)}");
                if (SkillTree.Gain(A) != 2 || SkillTree.PointsLeft(A) != 1) Fail($"경험 8 에 Lv.2·점 1 아님(Lv.{SkillTree.Level(A)})");
                SkillTree.Gain(W, 1519);
                if (SkillTree.Level(W) != 19) Fail($"1519 에 Lv.{SkillTree.Level(W)} ≠ 19");
                SkillTree.Gain(W, 1000);
                if (SkillTree.Level(W) != SkillTree.MaxLv || SkillTree.Level(SecretMove.Heavy) != 1) Fail("최고 레벨 20·무예마다 따로 아님");
                End("level OK - 맞힌 시전 1 = 경험 1 · Lv×8 · 1520 에 20 · 무예마다 따로");

                // ② 찍기 규칙
                Begin();
                if (SkillTree.Why(A, 1, true) != "prereq") Fail("앞 마디 없이 둘째 마디가 열림");
                if (!SkillTree.Put(A, 0, true) || SkillTree.Pts(A, 0) != 1) Fail("첫 마디 가 찍기 실패");
                if (SkillTree.Why(A, 0, true) != "point") Fail("점 없이 또 찍힘");
                SkillTree.Gain(A, 200);
                if (SkillTree.Why(A, 0, false) != "side") Fail("같은 마디 다른 갈래가 열림");
                SkillTree.Put(A, 0, true); SkillTree.Put(A, 0, true);
                if (SkillTree.Why(A, 0, true) != "max" || SkillTree.Pts(A, 0) != 3) Fail("마디 최대 3 아님");
                if (!SkillTree.Put(A, 1, true)) Fail("앞 마디 찍은 뒤 둘째가 안 열림");
                End("rules OK - 앞 마디부터·한 마디 한 갈래·마디 최대 3·점 모자라면 거절");

                // ③ 효과
                Begin();
                if (!Mathf.Approximately(SkillTree.DamageMul(A), 1.12f)) Fail($"위력 4%×3 → {SkillTree.DamageMul(A)}");
                if (!Mathf.Approximately(SkillTree.CooldownMul(A), 0.96f)) Fail($"재냉각 4% → {SkillTree.CooldownMul(A)}");
                SkillTree.ResetForTest();
                SkillTree.Gain(W, 1520);
                SkillTree.Put(W, 0, false); SkillTree.Put(W, 0, false); SkillTree.Put(W, 0, false); // 기력 18
                SkillTree.Put(W, 1, false);                                                       // 범위 6
                SkillTree.Put(W, 2, false);                                                       // 흡수 3
                SkillTree.Put(W, 3, true);                                                        // 불 결
                SkillTree.Put(W, 4, true); SkillTree.Put(W, 4, true); SkillTree.Put(W, 4, true); // 기력 15
                SkillTree.Put(W, 5, false);                                                       // 범위 8
                SkillTree.Put(W, 6, true);                                                        // 연타
                SkillTree.Put(W, 7, false); SkillTree.Put(W, 7, false); SkillTree.Put(W, 7, false); // 기력 24
                float cd = SkillTree.CooldownMul(W);
                if (!Mathf.Approximately(cd, Mathf.Max(SkillTree.CdFloor, 1f - 0.57f))) Fail($"기력 57% → 재냉각 {cd}");
                if (!Mathf.Approximately(SkillTree.RangeMul(W), 1.14f) || !Mathf.Approximately(SkillTree.DrainFrac(W), 0.03f)) Fail($"범위 {SkillTree.RangeMul(W)}·흡수 {SkillTree.DrainFrac(W)}");
                if (!Mathf.Approximately(SkillTree.DamageMul(W), SkillTree.FireMul * SkillTree.MultiWhirlMul) || SkillTree.ExtraTargets(W) != 0) Fail($"회전베기 불 결·연타 위력 {SkillTree.DamageMul(W)}");
                SecretState.Choose(W, Secret.Rage);
                bool rageOn = SecretState.Of(W) == Secret.Rage;
                if (rageOn && !Mathf.Approximately(SkillTree.DamageMul(W), SkillTree.DupMul * SkillTree.MultiWhirlMul)) Fail("분노 비결 위에 불 결이 ×1.05 아님");
                SkillTree.Gain(A, 1520);
                for (int i = 0; i < 3; i++) SkillTree.Put(A, i, i != 1);
                SkillTree.Put(A, 3, false); SkillTree.Put(A, 4, true); SkillTree.Put(A, 5, true); SkillTree.Put(A, 6, true);
                if (!SkillTree.Chills(A) || SkillTree.ExtraTargets(A) != 1) Fail($"평타 한기 결 {SkillTree.Chills(A)}·연타 곁 {SkillTree.ExtraTargets(A)}");
                End($"effect OK - 위력·재냉각·기력(곱 {cd:0.00})·범위 ×1.14·흡수 3%·불 결 ×1.1(분노면 ×1.05{(rageOn ? "" : " — 분노 잠김이라 건너뜀")})·한기 결 얼림·연타");

                // ④ 되돌리기
                Begin();
                int xpW = SkillTree.Xp(W);
                HeroState.Restore(HeroState.Level, HeroState.Exp, HeroState.HpMax, 100, w, gem, w2);
                if (SkillTree.Reset(W) != "gold" || SkillTree.Spent(W) == 0) Fail("금 100 인데 되돌림");
                HeroState.Restore(HeroState.Level, HeroState.Exp, HeroState.HpMax, 300, w, gem, w2);
                if (SkillTree.Reset(W) != null || HeroState.Gold != 100 || SkillTree.Spent(W) != 0 || SkillTree.Xp(W) != xpW) Fail($"되돌리기 금 {HeroState.Gold}·점 {SkillTree.Spent(W)}·경험 {SkillTree.Xp(W)}/{xpW}");
                if (SkillTree.Reset(W) != "empty") Fail("빈 나무를 또 되돌림");
                End("reset OK - 금 200·점 비움·경험 그대로·금 모자람/빈 나무 거절");

                // ⑤ 저장·창
                Begin();
                string json = DungeonSave.ToJson();
                if (!json.Contains("\"treeJson\"")) Fail("세이브에 treeJson 없음");
                int spentA = SkillTree.Spent(A);
                SkillTree.ResetForTest();
                if (!DungeonSave.ApplyJson(json) || SkillTree.Spent(A) != spentA || SkillTree.Level(W) != SkillTree.MaxLv) Fail("저장 왕복 나무가 안 돌아옴");
                if (!DungeonSave.ApplyJson(json.Replace("\"treeJson\":", "\"treeJsonX\":")) || SkillTree.Spent(A) != 0 || SkillTree.Xp(A) != 0) Fail("옛 세이브(없음)인데 나무가 남음");
                var panel = SecretPanelUi.Instance;
                var ui = SkillTreeUi.Instance;
                if (panel == null || panel.TreeButton(A) == null || ui == null) Fail("비결 창 나무 단추·나무 창 없음");
                else
                {
                    panel.TreeButton(SecretMove.Heavy).onClick.Invoke();
                    if (!ui.IsOpen || ui.Move != SecretMove.Heavy || ui.TitleText == null || !ui.TitleText.Contains("Lv.1")) Fail($"강공격 나무 창 열림 {ui.IsOpen}·{ui.TitleText}");
                    int bad = Overlaps(ui.Root);
                    if (bad != 0) Fail($"나무 창 겹침·밖 {bad}");
                    ui.Close();
                }
                End("save OK - treeJson 왕복·옛 세이브 빈 나무·비결 창 나무 단추 → 그 무예 창·창 겹침 0");
            }
            finally
            {
                HeroState.Restore(lv, exp, hp, gold, w, gem, w2);
                SecretState.Restore(secrets);
                SkillTree.Restore(tree0);
                SkillTreeUi.Instance?.Close();
            }
            return _ok;
        }

        /// <summary>창 바로 밑 위젯끼리 겹친 쌍 + 창 밖으로 나간 수(PlaytestDungeonLootFilter 와 같은 셈).</summary>
        private static int Overlaps(RectTransform root)
        {
            if (root == null) return 1;
            var rects = new System.Collections.Generic.List<Rect>();
            var c = new Vector3[4];
            Rect Local(RectTransform t)
            {
                t.GetWorldCorners(c);
                Vector3 a = root.InverseTransformPoint(c[0]), b = root.InverseTransformPoint(c[2]);
                return Rect.MinMaxRect(a.x, a.y, b.x, b.y);
            }
            Rect box = Local(root);
            int bad = 0;
            foreach (RectTransform t in root)
            {
                if (!t.gameObject.activeSelf) continue;
                Rect r = Local(t);
                if (r.xMin < box.xMin - 0.5f || r.xMax > box.xMax + 0.5f || r.yMin < box.yMin - 0.5f || r.yMax > box.yMax + 0.5f) bad++;
                foreach (var o in rects) if (r.xMin < o.xMax - 0.5f && o.xMin < r.xMax - 0.5f && r.yMin < o.yMax - 0.5f && o.yMin < r.yMax - 0.5f) bad++;
                rects.Add(r);
            }
            return bad;
        }

        private static void Begin() => _step = true;
        private static void End(string line) { if (_step) Debug.Log($"{T} {line}"); }

        private static void Fail(string msg)
        {
            Debug.LogError($"{T}: {msg}");
            _ok = false;
            _step = false;
        }
    }
}
