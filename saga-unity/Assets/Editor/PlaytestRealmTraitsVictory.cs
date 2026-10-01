using System.Collections.Generic;
using System.Linq;
using UnityEditor;
using UnityEngine;
using Saga.Realm.Data;

namespace Saga.EditorTools
{
    /// <summary>
    /// `un.rk.r101-2` 의 규칙 층 — 5-1 인물 특성·야망 / 5-3 설전 / 5-5 승리 조건(RECURRING R-3, 화면·씬 없이). ① 특성: 같은 id 는 늘 같은 두 특성(허용된 쌍)·세 특성이 다 나오고 보너스(용맹 +15%·교활 ×1.3)가 특성과 맞음
    /// ② 야망: 종류 셋·라이벌 성은 적 성 중 하나·`CheckAmbitions` 가 목표를 채운 무장에게만 500금을 한 번 지급·복원 ③ 설전: 3문·지력 문턱(40/70)별 난도 상한·정답 수 → 배율 0.8/0.95/1.1/1.3
    /// ④ 승리: 정복(적 성 55 전부 편입)·문화(문답 정답 30)·정복 우선·한 번만 알림·복원은 모르는 값을 없음으로.
    /// 5-2 이벤트 체인·5-6 지형 전술·5-8 계승은 무작위·무장 배치에 기대 `PlaytestRealmSlice`(통합 진단)가 본다. 시작 때 세이브 JSON 으로 상태를 떠 두었다가 끝에 되돌린다.
    /// `-executeMethod Saga.EditorTools.PlaytestRealmTraitsVictory.Run` → "[PlaytestRealmTraitsVictory] OK/FAIL".
    /// </summary>
    public static class PlaytestRealmTraitsVictory
    {
        [MenuItem("Saga/Playtest Realm Traits Victory")]
        public static void Run()
        {
            PlaytestKit.Begin("[PlaytestRealmTraitsVictory]");
            string saved = RealmSaveState.ToJson();
            using (PlaytestKit.IsolatedSaves())
            using (PlaytestKit.ErrorCounter())
            {
                CheckTraits();
                CheckAmbitions();
                CheckDebate();
                CheckVictory();
            }
            RealmSaveState.ApplyJson(saved);
            PlaytestKit.Summary("PlaytestRealmTraitsVictory");
            if (Application.isBatchMode) EditorApplication.Exit(PlaytestKit.Fails == 0 ? 0 : 1);
        }

        private static IEnumerable<string> SampleIds() => Enumerable.Range(0, 200).Select(i => "officer_" + i);

        private static void CheckTraits()
        {
            var seen = new HashSet<RealmOfficerTraits.Trait>();
            foreach (string id in SampleIds())
            {
                var t = RealmOfficerTraits.TraitsOf(id);
                PlaytestKit.Check(t.Length == 2 && t[0] != t[1], $"un.rk.r101-2: {id} 특성이 둘이 아니거나 겹침");
                PlaytestKit.Check(t.SequenceEqual(RealmOfficerTraits.TraitsOf(id)), $"un.rk.r101-2: {id} 특성이 호출마다 다름");
                foreach (var x in t) seen.Add(x);
                bool brave = RealmOfficerTraits.Has(id, RealmOfficerTraits.Trait.Brave), cunning = RealmOfficerTraits.Has(id, RealmOfficerTraits.Trait.Cunning);
                PlaytestKit.Check(brave == t.Contains(RealmOfficerTraits.Trait.Brave) && cunning == t.Contains(RealmOfficerTraits.Trait.Cunning), $"un.rk.r101-2: {id} Has 가 특성 목록과 다름");
                PlaytestKit.Check(Mathf.Approximately(RealmOfficerTraits.ArmyPowerBonus(id), brave ? 0.15f : 0f), $"un.rk.r101-2: {id} 전투력 보너스가 용맹과 안 맞음");
                PlaytestKit.Check(Mathf.Approximately(RealmOfficerTraits.PlotChanceMultiplier(id), cunning ? 1.3f : 1f), $"un.rk.r101-2: {id} 계략 배율이 교활과 안 맞음");
            }
            PlaytestKit.Check(seen.Count == 3, $"un.rk.r101-2: 표본 200명에서 특성 {seen.Count}종만 나옴");
            PlaytestKit.Check(RealmOfficerTraits.AmbitionRewardGold == 500, "un.rk.r101-2: 야망 보상 금이 500 이 아님");
        }

        private static void CheckAmbitions()
        {
            var kinds = new HashSet<RealmOfficerTraits.Ambition>();
            var enemies = new HashSet<string>(RealmEnemyCity.AllIds);
            foreach (string id in SampleIds())
            {
                kinds.Add(RealmOfficerTraits.AmbitionOf(id));
                PlaytestKit.Check(RealmOfficerTraits.AmbitionOf(id) == RealmOfficerTraits.AmbitionOf(id), $"un.rk.r101-2: {id} 야망이 호출마다 다름");
                PlaytestKit.Check(enemies.Contains(RealmOfficerTraits.RivalCityOf(id)), $"un.rk.r101-2: {id} 라이벌 성이 적 성이 아님");
                var (cur, target) = RealmOfficerTraits.AmbitionProgress(id);
                PlaytestKit.Check(target > 0 && cur >= 0, $"un.rk.r101-2: {id} 야망 진행/목표 값 이상({cur}/{target})");
            }
            PlaytestKit.Check(kinds.Count == 3, $"un.rk.r101-2: 표본 200명에서 야망 {kinds.Count}종만 나옴");

            // 목표를 채운 무장에게만, 한 번만 500금.
            RealmOfficerTraits.Restore(null);
            var roster = RealmCityState.RosterIds.ToList();
            PlaytestKit.Check(roster.Count > 0, "un.rk.r101-2: 로스터가 비어 있음");
            foreach (string id in roster)
                if (RealmOfficerTraits.AmbitionOf(id) == RealmOfficerTraits.Ambition.Rival)
                    RealmWarState.Restore(RealmOfficerTraits.RivalCityOf(id), 1, 1, 1, 1, 1, true);
            RealmCityState.AddGold(100000);
            var expected = roster.Where(id => { var p = RealmOfficerTraits.AmbitionProgress(id); return p.current >= p.target; }).ToList();
            int achieved = 0;
            System.Action<string, RealmOfficerTraits.Ambition> on = (id, a) => achieved++;
            RealmOfficerTraits.AmbitionAchieved += on;
            try
            {
                int gold0 = RealmCityState.Gold;
                RealmOfficerTraits.CheckAmbitions();
                var done = RealmOfficerTraits.SnapshotDone();
                PlaytestKit.Check(new HashSet<string>(done).SetEquals(expected), $"un.rk.r101-2: 달성 목록 {done.Count}명 ≠ 목표 채운 {expected.Count}명");
                PlaytestKit.Check(RealmCityState.Gold - gold0 == 500 * expected.Count && achieved == expected.Count, $"un.rk.r101-2: 보상 금 {RealmCityState.Gold - gold0} (기대 {500 * expected.Count}) 알림 {achieved}");
                foreach (string id in done) PlaytestKit.Check(RealmOfficerTraits.IsAmbitionDone(id), $"un.rk.r101-2: {id} 가 달성으로 안 보임");
                int gold1 = RealmCityState.Gold;
                RealmOfficerTraits.CheckAmbitions();
                PlaytestKit.Check(RealmCityState.Gold == gold1 && achieved == expected.Count, "un.rk.r101-2: 같은 야망이 두 번 보상됨");
            }
            finally { RealmOfficerTraits.AmbitionAchieved -= on; }
            var snap = RealmOfficerTraits.SnapshotDone();
            RealmOfficerTraits.Restore(null);
            PlaytestKit.Check(RealmOfficerTraits.SnapshotDone().Count == 0, "un.rk.r101-2: Restore(null) 이 달성 목록을 안 비움");
            RealmOfficerTraits.Restore(snap);
            PlaytestKit.Check(RealmOfficerTraits.SnapshotDone().Count == snap.Count, "un.rk.r101-2: 달성 목록 왕복 실패");
        }

        private static List<RealmQuizState.Presented> Fake(int n, int correct = 1) =>
            Enumerable.Range(0, n).Select(i => new RealmQuizState.Presented("q" + i, "cat", 1, "문제", new[] { "a", "b", "c", "d" }, correct, false)).ToList();

        private static void CheckDebate()
        {
            PlaytestKit.Check(RealmDebateState.Rounds == 3, "un.rk.r101-2: 설전 문항 수가 3 이 아님");
            float[] mul = { 0.8f, 0.95f, 1.1f, 1.3f };
            for (int right = 0; right <= 3; right++)
            {
                var qs = Fake(3);
                var picks = new List<int>();
                for (int i = 0; i < 3; i++) picks.Add(i < right ? 1 : 0);
                var (correct, m) = RealmDebateState.Result(qs, picks);
                PlaytestKit.Check(correct == right && Mathf.Approximately(m, mul[right]), $"un.rk.r101-2: 정답 {right}개 → ({correct}, ×{m}) (기대 ×{mul[right]})");
            }
            var r = RealmDebateState.Result(Fake(3), new List<int> { 1 });
            PlaytestKit.Check(r.correct == 1 && Mathf.Approximately(r.mul, 0.95f), "un.rk.r101-2: 답이 모자란 설전을 있는 만큼만 채점하지 않음");
            PlaytestKit.Check(RealmDebateState.Result(new List<RealmQuizState.Presented>(), new List<int>()).correct == 0, "un.rk.r101-2: 빈 설전 채점 이상");

            foreach (var (wisdom, maxLv) in new[] { (0, 1), (39, 1), (40, 2), (69, 2), (70, 3), (100, 3) })
            {
                for (int trial = 0; trial < 12; trial++)
                {
                    var drawn = RealmDebateState.Draw(wisdom);
                    PlaytestKit.Check(drawn.Count == RealmDebateState.Rounds, $"un.rk.r101-2: 지력 {wisdom} 설전이 {drawn.Count}문");
                    foreach (var p in drawn)
                    {
                        var q = RealmQuizData.ById(p.Id);
                        PlaytestKit.Check(p.Lv <= maxLv, $"un.rk.r101-2: 지력 {wisdom} 에 난도 {p.Lv} 문제가 나옴(상한 {maxLv})");
                        PlaytestKit.Check(q != null && p.Choices.Length == 4 && p.Choices[p.CorrectIndex] == q.Choices[q.AnswerIdx], $"un.rk.r101-2: {p.Id} 섞은 보기의 정답 위치가 어긋남");
                    }
                }
            }
        }

        private static void CheckVictory()
        {
            RealmVictoryState.Restore(null);
            RealmQuizState.Restore(null, null, null, 0, 0, 0, 0);
            PlaytestKit.Check(RealmVictoryState.Result == RealmVictoryState.Kind.None && !RealmVictoryState.IsOver, "un.rk.r101-2: 시작이 '결과 없음'이 아님");
            PlaytestKit.Check(RealmVictoryState.CapturedCount() == 0 && RealmVictoryState.ConquestProgress() == 0f && RealmVictoryState.CultureProgress() == 0f, "un.rk.r101-2: 시작 진행도가 0 이 아님");
            RealmVictoryState.CheckResult();
            PlaytestKit.Check(!RealmVictoryState.IsOver, "un.rk.r101-2: 아무것도 안 했는데 승리");

            // 문화 — 정답 29 는 아직, 30 이면 승리.
            int fired = 0; RealmVictoryState.Kind last = RealmVictoryState.Kind.None;
            System.Action<RealmVictoryState.Kind> on = k => { fired++; last = k; };
            RealmVictoryState.Achieved += on;
            try
            {
                RealmQuizState.Restore(null, null, null, 40, RealmVictoryState.CultureCorrectTarget - 1, 0, 0);
                RealmVictoryState.CheckResult();
                PlaytestKit.Check(!RealmVictoryState.IsOver && Mathf.Approximately(RealmVictoryState.CultureProgress(), 29f / 30f), "un.rk.r101-2: 정답 29 에서 승리했거나 진행도가 어긋남");
                var closest = RealmVictoryState.ClosestProgress();
                PlaytestKit.Check(Mathf.Approximately(closest.progress, 29f / 30f), "un.rk.r101-2: 가장 가까운 목표 진행도가 문화 값이 아님");
                RealmQuizState.Restore(null, null, null, 40, RealmVictoryState.CultureCorrectTarget, 0, 0);
                RealmVictoryState.CheckResult();
                PlaytestKit.Check(RealmVictoryState.Result == RealmVictoryState.Kind.Culture && fired == 1 && last == RealmVictoryState.Kind.Culture, $"un.rk.r101-2: 문화 승리 {RealmVictoryState.Result} 알림 {fired}");
                RealmVictoryState.CheckResult();
                PlaytestKit.Check(fired == 1, "un.rk.r101-2: 이미 끝났는데 승리 알림이 또 울림");

                // 정복 — 부분은 비율, 전부면 정복(문화가 이미 채워져 있어도 정복이 먼저).
                RealmVictoryState.Restore(null);
                fired = 0;
                var ids = RealmEnemyCity.AllIds;
                int part = ids.Length / 5;
                for (int i = 0; i < part; i++) RealmCityState.AbsorbCity(ids[i], 1, 1, 1, 1);
                PlaytestKit.Check(RealmVictoryState.CapturedCount() == part && Mathf.Approximately(RealmVictoryState.ConquestProgress(), part / (float)ids.Length), $"un.rk.r101-2: 편입 {part} 곳의 정복 진행도 {RealmVictoryState.ConquestProgress()}");
                for (int i = part; i < ids.Length; i++) RealmCityState.AbsorbCity(ids[i], 1, 1, 1, 1);
                PlaytestKit.Check(RealmVictoryState.CapturedCount() == ids.Length, $"un.rk.r101-2: 적 성 {ids.Length} 곳 중 {RealmVictoryState.CapturedCount()} 곳만 편입됨(성 정의가 빠졌나)");
                RealmVictoryState.CheckResult();
                PlaytestKit.Check(RealmVictoryState.Result == RealmVictoryState.Kind.Conquest && fired == 1 && last == RealmVictoryState.Kind.Conquest, $"un.rk.r101-2: 정복 승리 {RealmVictoryState.Result} 알림 {fired}");
            }
            finally { RealmVictoryState.Achieved -= on; }

            RealmVictoryState.Restore("Culture");
            PlaytestKit.Check(RealmVictoryState.Result == RealmVictoryState.Kind.Culture && RealmVictoryState.SnapshotResult() == "Culture", "un.rk.r101-2: 승리 결과 왕복 실패");
            RealmVictoryState.Restore("bogus");
            PlaytestKit.Check(RealmVictoryState.Result == RealmVictoryState.Kind.None, "un.rk.r101-2: 모르는 결과 값이 '없음'이 아님");
        }
    }
}
