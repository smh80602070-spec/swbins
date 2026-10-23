using UnityEngine;
using Saga.Forest.Data;
using Saga.Forest.World;

namespace Saga.EditorTools
{
    /// <summary>
    /// tasks U-0177 유적 발굴·복원(웹 W-0309 · 고돗 G-0315) 진단 — `PlaytestForestHeadless` 가축 진단 뒤에 부른다(한 프레임 안, 날짜는 넣는다).
    /// ① 굴림(60일 중 조각 수가 0.5 언저리·같은 날 같은 결과) ② 화석 갈래·그날 첫 번만(다른 갈래·둘째 번 없음) ③ 넷 모이면 복원·열매 +8·셋째에 잔치 +15 한 번·전시대 셋(충돌체 없음)
    /// ④ 세이브 칸·왕복·옛 세이브 빈 것 ⑤ 손잡이. 끝나면 유적·열매를 시작 때로.
    /// </summary>
    public static class PlaytestForestRelics
    {
        private const string T = "[PlaytestForestHeadless] relics";
        private static bool _ok, _step;

        public static bool Run()
        {
            _ok = true;
            int fruit0 = ForestState.FruitCount;
            string relic0 = ForestRelics.Snapshot();
            const int D = 92000;
            try
            {
                ForestRelics.ResetForTest();

                // ① 굴림
                Begin();
                int hits = 0;
                for (int d = D; d < D + 60; d++) if (ForestRelics.RollPiece(d) != null) hits++;
                if (hits < 18 || hits > 42) Fail($"60일 중 조각 {hits}(0.5 언저리 아님)");
                bool same = true;
                for (int d = D; d < D + 20; d++) if (ForestRelics.RollPiece(d) != ForestRelics.RollPiece(d)) same = false;
                if (!same) Fail("같은 날 굴림이 다름");
                End($"roll OK - 60일 중 {hits}일 조각(확률 {ForestRelics.Chance}) · 날로 결정적");

                // ② 화석·하루 첫 번
                Begin();
                int day = D;
                while (ForestRelics.RollPiece(day) == null) day++;
                if (ForestRelics.OnGather(ForestMuseumState.Category.Insect, day) != null) Fail("곤충 갈래에서 조각");
                string l1 = ForestRelics.OnGather(ForestMuseumState.Category.Fossil, day);
                if (l1 == null) Fail("조각 날인데 화석에서 안 나옴");
                if (ForestRelics.OnGather(ForestMuseumState.Category.Fossil, day) != null) Fail("같은 날 둘째 번에도 굴림");
                End($"gather OK - 곤충 없음 · 화석 첫 번「{l1}」· 둘째 번 없음");

                // ③ 복원·잔치·전시대
                Begin();
                ForestState.Restore(0);
                int guard = 0;
                string restoredLine = null;
                while (!ForestRelics.Feasted && guard++ < 400)
                {
                    day++;
                    string l = ForestRelics.OnGather(ForestMuseumState.Category.Fossil, day);
                    if (l != null && l.Contains("\n") && restoredLine == null) restoredLine = l;
                }
                int want = ForestRelics.Sets.Length * ForestRelics.RestoreFruit + ForestRelics.FeastFruit;
                if (!ForestRelics.Feasted || ForestRelics.Restored.Count != 3) Fail($"{guard}일 동안 다 못 되살림({ForestRelics.Restored.Count})");
                if (ForestState.FruitCount != want) Fail($"열매 {ForestState.FruitCount} ≠ {want}");
                foreach (var s in ForestRelics.Sets) if (ForestRelics.RestoreSet(s.Key) != null) Fail("되살린 것을 또 되살림");
                if (ForestState.FruitCount != want) Fail("잔치가 두 번");
                if (ForestRelicStands.Count != 3) Fail($"전시대 {ForestRelicStands.Count} ≠ 3");
                if (ForestRelicStands.Root != null && ForestRelicStands.Root.GetComponentsInChildren<Collider>().Length != 0) Fail("전시대에 충돌체");
                if (ForestRelics.OnGather(ForestMuseumState.Category.Fossil, day + 1) != null) Fail("다 되살렸는데 조각");
                End($"restore OK - {guard}일에 셋 복원 · 열매 +{want}(8×3 + 잔치 15 한 번) · 전시대 3(충돌체 0) · 다 되살린 뒤 조각 없음「{restoredLine?.Replace("\n", " / ")}」");

                // ④ 세이브
                Begin();
                string snap = ForestRelics.Snapshot();
                if (!ForestSaveState.ToJson().Contains("\"relicsJson\"")) Fail("세이브에 relicsJson 없음");
                ForestRelics.Restore(null);
                if (ForestRelics.Restored.Count != 0 || ForestRelicStands.Count != 0) Fail("옛 세이브인데 유적이 남음");
                ForestRelics.Restore(snap);
                if (ForestRelics.Restored.Count != 3 || !ForestRelics.Feasted || ForestRelicStands.Count != 3) Fail("세이브 왕복");
                End("save OK - relicsJson 칸·왕복(복원·잔치·전시대)·옛 세이브 빈 것");

                // ⑤ 손잡이
                Begin();
                ForestRelics.ResetForTest();
                ForestRelics.On = false;
                day = D;
                while (ForestRelics.RollPiece(day) == null) day++;
                if (ForestRelics.OnGather(ForestMuseumState.Category.Fossil, day) != null) Fail("손잡이 껐는데 조각");
                End("off OK - 손잡이 끄면 조각 없음");
            }
            finally
            {
                ForestRelics.On = true;
                ForestRelics.Restore(relic0);
                ForestState.Restore(fruit0);
            }
            return _ok;
        }

        private static void Begin() => _step = true;
        private static void End(string line) { if (_step) Debug.Log($"{T} {line}"); }

        private static void Fail(string why)
        {
            _ok = false;
            _step = false;
            Debug.LogError($"{T} FAIL - {why}");
        }
    }
}
