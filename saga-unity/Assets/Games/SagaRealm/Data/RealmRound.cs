using System.Collections.Generic;
using System.Linq;
using UnityEngine;

namespace Saga.Realm.Data
{
    /// <summary>
    /// PLAN.md 109-16b 회차 — 이긴 판에서 같은 깃발로 다시(웹 사가국지 §5-14, SAGA-DESIGN §16 공통 뼈대: 회차 카운터 · 이긴 판에서만 열림 ·
    /// 난도 한 갈래 · 작은 이월). 웹은 결과 카드 단추, 이 트랙은 판이 끝난 뒤 "다음 달" 단추(=`RealmCommandUi.ExecuteNextMonth`)를 회차 시작으로
    /// 바꿨다(카드 자리·배치 점검을 안 건드리려고) — 한 번 누르면 조건을 미리 보이고 6초 안에 한 번 더 누르면 시작.
    ///
    /// **이월**(웹 수치 그대로): ① 적 성 병력·성벽 ×(1+0.2×(N−1), 최대 ×2) ② 우리 금 +1500×(N−1)(최대 +6000) ③ 지난 회차에 우리 사람이던
    /// 시간 틈 사람 최대 둘(자질 합 높은 순)이 첫 성에 다시 합류(이 트랙엔 충성 축이 없어 웹의 충성 +15 는 없다). 9회차 다음은 없다.
    /// **다시 세우기**: 타이틀이 앱을 켤 때 떠 둔 "새 게임 기본값"(`SagaFlow.Defaults["realm"]`)을 <see cref="RealmSaveState.ApplyJson"/> 으로 되돌린다
    /// (타이틀 "새로 시작"과 같은 길 — 모든 정적 상태가 이미 그 JSON 에 있다). 타이틀을 거치지 않고 판 씬만 연 실행(헤드리스)은 기본값이 없어 회차가 막힌다.
    /// 최고 회차는 새로 시작해도 남게 PlayerPrefs 에 둔다(웹 `save.rtkRound.clears` 와 같은 결).
    /// </summary>
    public static class RealmRound
    {
        public const int Max = 9;
        public const float FoeStep = 0.2f, FoeCap = 2f;
        public const int GoldStep = 1500, GoldCap = 6000, FolkMax = 2;
        public const string GameKey = "realm";
        private const string BestKey = "saga.realm.bestRound";

        public static int Round { get; private set; } = 1;
        /// <summary>6초 안에 한 번 더 누르면 시작(첫 누름에서 잰다).</summary>
        public const float ArmSeconds = 6f;

        public static int Best => Mathf.Max(Round, PlayerPrefs.GetInt(BestKey, 1));

        /// <summary>진단 — 타이틀을 안 거친 실행이 쓸 기본값(없으면 <see cref="Saga.Core.SagaFlow.Defaults"/>).</summary>
        public static string DefaultJsonForTest;
        /// <summary>진단 — 세이브 파일을 안 쓰고 씬도 안 다시 연다(UI 경로 시험).</summary>
        public static bool NoSideEffectsForTest;

        public static float FoeMul(int round) => Mathf.Min(FoeCap, 1f + FoeStep * (Mathf.Max(1, round) - 1));
        public static int GoldBonus(int round) => Mathf.Min(GoldCap, GoldStep * (Mathf.Max(1, round) - 1));

        /// <summary>이긴 판이고 마지막 회차가 아니다.</summary>
        public static bool CanNext => RealmVictoryState.IsOver && Round < Max;

        public static void Restore(int round) => Round = round < 1 ? 1 : Mathf.Min(round, Max);

        public static string DefaultJson()
        {
            if (!string.IsNullOrEmpty(DefaultJsonForTest)) return DefaultJsonForTest;
            return Saga.Core.SagaFlow.Defaults.TryGetValue(GameKey, out var j) ? j : null;
        }

        /// <summary>지금 우리 사람 중 시간 틈 사람 — 자질 합 높은 순 최대 <see cref="FolkMax"/>(같으면 id 순).</summary>
        public static List<string> FolkToReturn()
        {
            var found = new List<RealmEras.TimeOfficer>();
            foreach (var t in RealmEras.TimeOfficers)
                if (RealmCityState.RosterIds.Contains(t.Id)) found.Add(t);
            found.Sort((a, b) =>
            {
                int c = (b.Might + b.Wisdom + b.Command).CompareTo(a.Might + a.Wisdom + a.Command);
                return c != 0 ? c : string.CompareOrdinal(a.Id, b.Id);
            });
            var ids = new List<string>();
            for (int i = 0; i < found.Count && i < FolkMax; i++) ids.Add(found[i].Id);
            return ids;
        }

        /// <summary>한 줄 미리보기 — 다음 회차의 적 배율·금·돌아올 사람.</summary>
        public static string Preview()
        {
            int next = Round + 1;
            return string.Format(RealmLocalization.T("round.preview", "🔁 {0}회차 — 같은 깃발 · 적 병력·성벽 ×{1:0.0#} · 금 +{2} · 돌아올 시간 틈 사람 {3}명"),
                next, FoeMul(next), GoldBonus(next), FolkToReturn().Count);
        }

        /// <summary>판이 끝난 직후 안내(토스트) 한 줄.</summary>
        public static string ReadyLine() => CanNext
            ? string.Format(RealmLocalization.T("round.ready", "🔁 \"다음 달\" 단추 = {0}회차 (적 ×{1:0.0#} · 금 +{2})"), Round + 1, FoeMul(Round + 1), GoldBonus(Round + 1))
            : string.Format(RealmLocalization.T("round.last", "🔁 {0}회차까지 깼다 — 더 없다"), Round);

        /// <summary>
        /// 다음 회차를 시작한다 — 안 되면 false 와 까닭. <paramref name="persist"/> 면 세이브를 쓰고 <paramref name="reload"/> 면 판 씬을 다시 연다(진단은 둘 다 끈다).
        /// </summary>
        public static bool StartNext(bool persist, bool reload, out string reason)
        {
            reason = null;
            if (NoSideEffectsForTest) { persist = false; reload = false; }
            if (!RealmVictoryState.IsOver) { reason = RealmLocalization.T("round.not_won", "이긴 판에서만 다음 회차가 열린다."); return false; }
            if (Round >= Max) { reason = string.Format(RealmLocalization.T("round.last", "🔁 {0}회차까지 깼다 — 더 없다"), Round); return false; }
            string def = DefaultJson();
            if (string.IsNullOrEmpty(def)) { reason = RealmLocalization.T("round.no_defaults", "타이틀에서 시작한 판에서만 다음 회차를 만든다."); return false; }

            int next = Round + 1;
            var folk = FolkToReturn();
            PlayerPrefs.SetInt(BestKey, Mathf.Max(PlayerPrefs.GetInt(BestKey, 1), Round));
            if (!RealmSaveState.ApplyJson(def)) { reason = RealmLocalization.T("round.no_defaults", "타이틀에서 시작한 판에서만 다음 회차를 만든다."); return false; }

            Round = next;
            PlayerPrefs.SetInt(BestKey, Mathf.Max(PlayerPrefs.GetInt(BestKey, 1), Round));
            float mul = FoeMul(next);
            foreach (var id in RealmEnemyCity.AllIds)
            {
                var r = RealmWarState.Get(id);
                if (r == null) continue;
                r.Troops = Mathf.RoundToInt(r.Troops * mul);
                r.MaxWall = Mathf.RoundToInt(r.MaxWall * mul);
                r.Wall = Mathf.Min(r.MaxWall, Mathf.RoundToInt(r.Wall * mul));
            }
            RealmCityState.AddGold(GoldBonus(next));
            foreach (var id in folk) RealmCityState.JoinOfficer(id, RealmCityData.StartingCityId);

            if (persist) RealmSaveState.Save();
            if (reload) UnityEngine.SceneManagement.SceneManager.LoadScene(UnityEngine.SceneManagement.SceneManager.GetActiveScene().buildIndex);
            return true;
        }
    }
}
