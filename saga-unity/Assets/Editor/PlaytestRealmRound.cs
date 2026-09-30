using System.Collections.Generic;
using System.Linq;
using System.Reflection;
using UnityEngine;
using Saga.Realm.Data;
using Saga.Realm.UI;

namespace Saga.EditorTools
{
    /// <summary>
    /// PLAN.md 109-16b 회차(웹 사가국지 §5-14 진단 항목) — `PlaytestRealmSlice` 가 시나리오 진단 뒤에 부른다.
    /// 수치 표(적 배율 ×1.2/1.4…최대 ×2 · 금 +1500씩 최대 +6000) · 이긴 판에서만 열림 · 9회차는 막힘 · 타이틀 기본값이 없으면 막힘 ·
    /// 시작(2회차 = 적 병력·성벽 ×1.2 · 금 +1500 · 자질 합 높은 시간 틈 사람 둘이 첫 성에 돌아옴 · 판이 새로 서서 이긴 기록이 풀림) ·
    /// 3회차 ×1.4(이월이 쌓이지 않고 기본값에서 다시) · 세이브 왕복 · "다음 달" 단추 두 번 누르기(첫 누름은 조건만, 6초 안 둘째 누름이 시작) ·
    /// 최고 회차 기록. 끝나면 세이브 JSON·회차·최고 기록을 되돌린다.
    /// </summary>
    public static class PlaytestRealmRound
    {
        private const string T = "[PlaytestRealmSlice] round";
        private const string BestKey = "saga.realm.bestRound";
        private static bool _ok;

        public static bool Run()
        {
            _ok = true;
            string json0 = RealmSaveState.ToJson();
            int round0 = RealmRound.Round;
            bool hadBest = PlayerPrefs.HasKey(BestKey);
            int best0 = PlayerPrefs.GetInt(BestKey, 1);
            var parts = new List<string>();
            try
            {
                RealmRound.DefaultJsonForTest = null;
                CheckTable(parts);
                CheckStart(parts);
                CheckUi(parts);
            }
            finally
            {
                RealmRound.DefaultJsonForTest = null;
                RealmRound.NoSideEffectsForTest = false;
                RealmSaveState.ApplyJson(json0);
                RealmRound.Restore(round0);
                if (hadBest) PlayerPrefs.SetInt(BestKey, best0); else PlayerPrefs.DeleteKey(BestKey);
            }
            if (_ok) Debug.Log($"{T} OK - {string.Join(" · ", parts)}");
            return _ok;
        }

        private static void Fail(string what)
        {
            _ok = false;
            Debug.LogError($"{T} FAIL - {what}");
        }

        private static void CheckTable(List<string> parts)
        {
            if (Mathf.Abs(RealmRound.FoeMul(1) - 1f) > 0.001f || Mathf.Abs(RealmRound.FoeMul(2) - 1.2f) > 0.001f || Mathf.Abs(RealmRound.FoeMul(3) - 1.4f) > 0.001f
                || Mathf.Abs(RealmRound.FoeMul(6) - 2f) > 0.001f || Mathf.Abs(RealmRound.FoeMul(9) - 2f) > 0.001f) Fail("적 배율 1/1.2/1.4/…/상한 2");
            if (RealmRound.GoldBonus(1) != 0 || RealmRound.GoldBonus(2) != 1500 || RealmRound.GoldBonus(3) != 3000 || RealmRound.GoldBonus(5) != 6000 || RealmRound.GoldBonus(9) != 6000) Fail("금 이월 0/1500/3000/6000/상한");
            if (RealmRound.Max != 9 || RealmRound.FolkMax != 2) Fail("최대 회차·돌아올 사람");
            parts.Add("표(적 ×1.2씩 최대 ×2 · 금 +1500씩 최대 +6000 · 최대 9회차 · 사람 둘)");
        }

        /// <summary>새 게임 같은 상태 — 이 단계(전 성 함락 뒤)의 판에서 적 성을 원래 값·안 함락으로, 우리 성은 본 성들만 남기고 이긴 기록·문답을 비운 JSON.</summary>
        private static string MakeFreshJson()
        {
            string keep = RealmSaveState.ToJson();
            var own = RealmCityState.SnapshotCities().Where(c => !RealmEnemyCity.AllIds.Contains(c.CityId)).ToList();
            RealmCityState.Restore(1000, 194, 1, RealmCityData.StartingCityId,
                new List<string> { RealmOfficerPool.StartingOfficerId }, null, null,
                new List<string> { RealmOfficerPool.StartingOfficerId }, new List<string> { RealmOfficerPool.StartingOfficerCityId }, own);
            foreach (var id in RealmEnemyCity.AllIds)
            {
                var d = RealmEnemyCity.Get(id);
                RealmWarState.Restore(id, d.BaseWall, d.BaseWall, d.BaseTroops, d.BaseTrain, d.BaseTech, false);
            }
            RealmQuizState.Restore(new List<string>(), null, null, 0, 0, 0, 0);
            RealmVictoryState.Restore(null);
            RealmRound.Restore(1);
            string fresh = RealmSaveState.ToJson();
            RealmSaveState.ApplyJson(keep);
            return fresh;
        }

        private static void CheckStart(List<string> parts)
        {
            // 기본값(= 새 판)
            string def = MakeFreshJson();
            RealmRound.DefaultJsonForTest = def;
            RealmSaveState.ApplyJson(def);
            RealmRound.Restore(1);
            int baseGold = RealmCityState.Gold;
            var baseTroops = new Dictionary<string, int>();
            var baseWall = new Dictionary<string, int>();
            foreach (var id in RealmEnemyCity.AllIds) { var r = RealmWarState.Get(id); baseTroops[id] = r.Troops; baseWall[id] = r.MaxWall; }

            // 안 이긴 판 — 닫힘
            RealmVictoryState.Restore(null);
            bool started0 = RealmRound.StartNext(false, false, out string why0);
            if (RealmRound.CanNext || started0 || string.IsNullOrEmpty(why0)) Fail("안 이겼는데 열림");

            // 시간 틈 사람 셋을 우리 사람으로 — 자질 합 200·200·190 → 강서·영점 둘(같은 합은 id 순)
            string start = RealmCityData.StartingCityId;
            foreach (var id in new[] { "tm_geumdam", "tm_yeongjeom", "tm_gangseo" }) RealmCityState.JoinOfficer(id, start);
            var folk = RealmRound.FolkToReturn();
            if (folk.Count != 2 || folk[0] != "tm_gangseo" || folk[1] != "tm_yeongjeom") Fail("돌아올 사람 " + string.Join(",", folk));

            // 이긴 판(닫힌 판) — 열림 · 미리보기
            RealmVictoryState.Restore("Conquest");
            if (!RealmRound.CanNext) Fail("이겼는데 안 열림");
            string pv = RealmRound.Preview();
            if (!pv.Contains("2") || !pv.Contains("1.2") || !pv.Contains("1500")) Fail("미리보기 " + pv);
            if (!RealmRound.ReadyLine().Contains("2")) Fail("안내 줄 " + RealmRound.ReadyLine());

            // 기본값이 없으면 막힘(타이틀을 안 거친 판)
            RealmRound.DefaultJsonForTest = null;
            bool started1 = RealmRound.StartNext(false, false, out string why1);
            if (started1 || why1 != Saga.Realm.Data.RealmLocalization.T("round.no_defaults", "타이틀에서 시작한 판에서만 다음 회차를 만든다.")) Fail("기본값 없는데 시작 " + why1);
            if (RealmRound.Round != 1 || !RealmVictoryState.IsOver) Fail("막힌 시작이 상태를 건드림");
            RealmRound.DefaultJsonForTest = def;

            // 2회차
            if (!RealmRound.StartNext(false, false, out string why2)) { Fail("2회차 시작 " + why2); return; }
            if (RealmRound.Round != 2) Fail("회차 " + RealmRound.Round);
            if (RealmVictoryState.IsOver) Fail("새 회차인데 이긴 기록이 안 풀림");
            if (RealmCityState.Gold != baseGold + 1500) Fail($"금 +1500 ({RealmCityState.Gold - baseGold})");
            foreach (var id in RealmEnemyCity.AllIds)
            {
                var r = RealmWarState.Get(id);
                if (r.Troops != Mathf.RoundToInt(baseTroops[id] * 1.2f) || r.MaxWall != Mathf.RoundToInt(baseWall[id] * 1.2f)) { Fail($"{id} 병력·성벽 ×1.2 ({r.Troops}/{baseTroops[id]} · {r.MaxWall}/{baseWall[id]})"); break; }
            }
            if (!RealmCityState.RosterIds.Contains("tm_gangseo") || !RealmCityState.RosterIds.Contains("tm_yeongjeom") || RealmCityState.RosterIds.Contains("tm_geumdam")) Fail("돌아온 사람 둘");
            if (RealmCityState.OfficerCityId("tm_gangseo") != start) Fail("돌아온 사람이 첫 성에 없음");
            if (RealmSaveState.ToJson().IndexOf("\"round\":2", System.StringComparison.Ordinal) < 0) Fail("세이브에 회차 2 가 없음");
            if (RealmRound.Best < 1) Fail("최고 기록");

            // 3회차 — 이월이 쌓이지 않고 기본값에서 다시(×1.4·금 +3000)
            RealmVictoryState.Restore("Culture");
            if (!RealmRound.StartNext(false, false, out string why3)) { Fail("3회차 시작 " + why3); return; }
            if (RealmRound.Round != 3 || RealmCityState.Gold != baseGold + 3000) Fail($"3회차 금 ({RealmCityState.Gold - baseGold})");
            var first = RealmWarState.Get(RealmEnemyCity.AllIds[0]);
            if (first.Troops != Mathf.RoundToInt(baseTroops[RealmEnemyCity.AllIds[0]] * 1.4f)) Fail("3회차 병력 ×1.4");
            if (RealmRound.Best < 2) Fail("최고 회차 2");

            // 세이브 왕복
            string saved = RealmSaveState.ToJson();
            RealmRound.Restore(1);
            RealmSaveState.ApplyJson(saved);
            if (RealmRound.Round != 3) Fail("세이브 왕복 회차 " + RealmRound.Round);
            string legacy = saved.Replace("\"round\":3", "\"round\":0");
            RealmSaveState.ApplyJson(legacy);
            if (RealmRound.Round != 1) Fail("옛 세이브(회차 없음)는 1회차");

            // 9회차는 막힘
            RealmRound.Restore(9);
            RealmVictoryState.Restore("Conquest");
            bool started9 = RealmRound.StartNext(false, false, out string why9);
            if (RealmRound.CanNext || started9 || why9 == null || !why9.Contains("9")) Fail("9회차 뒤에도 열림 " + why9);
            RealmRound.Restore(1);
            parts.Add("시작(안 이기면 닫힘·기본값 없으면 닫힘·2회차 = 적 ×1.2·금 +1500·시간 틈 사람 둘 귀환·이긴 기록 풀림 · 3회차 ×1.4 기본값에서 다시 · 세이브 왕복·옛 세이브 1회차 · 9회차 막힘 · 최고 기록)");
        }

        private static void CheckUi(List<string> parts)
        {
            var ui = Object.FindFirstObjectByType<RealmCommandUi>();
            if (ui == null) { Fail("ui: RealmCommandUi 없음"); return; }
            var press = typeof(RealmCommandUi).GetMethod("ExecuteNextMonth", BindingFlags.NonPublic | BindingFlags.Instance);
            var arm = typeof(RealmCommandUi).GetField("_roundArmUntil", BindingFlags.NonPublic | BindingFlags.Instance);
            if (press == null || arm == null) { Fail("ui: 다음 달 누르기·무장 필드 없음"); return; }

            string def = MakeFreshJson();
            RealmRound.DefaultJsonForTest = def;
            RealmSaveState.ApplyJson(def);
            RealmRound.Restore(1);
            RealmRound.NoSideEffectsForTest = true; // 세이브 파일·씬 다시 열기 없이
            arm.SetValue(ui, 0f);
            RealmVictoryState.Restore("Conquest");
            press.Invoke(ui, null);           // 첫 누름 — 조건만
            if (RealmRound.Round != 1 || !RealmVictoryState.IsOver || (float)arm.GetValue(ui) <= Time.unscaledTime) Fail("ui: 첫 누름이 시작해 버리거나 무장이 안 됨");
            press.Invoke(ui, null);           // 6초 안 둘째 누름 — 시작
            if (RealmRound.Round != 2 || RealmVictoryState.IsOver) Fail("ui: 둘째 누름이 2회차를 안 염 " + RealmRound.Round);
            // 무장이 풀린 뒤 이긴 판이 아니면 다음 달(월 넘김)이 그대로 돈다
            RealmRound.NoSideEffectsForTest = false;
            parts.Add("다음 달 단추(이긴 판 첫 누름 = 조건만·6초 안 둘째 누름 = 시작·시작하면 무장 풀림)");
        }
    }
}
