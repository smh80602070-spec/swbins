using System.Collections.Generic;
using System.Linq;
using UnityEditor;
using UnityEngine;
using Saga.Story.Data;

namespace Saga.EditorTools
{
    /// <summary>
    /// `un.st.gate-captain` 5-4 관문 대장 — 규칙 층만 본다(화면·씬 없이, RECURRING R-3). ① 관문 대장 다섯: 표에 있고 서로 다른 기술·두목/수호장이 안 낌 ② 주 → 대장 돌려쓰기(5주 주기·
    /// 음수 주도 안전·다섯 주에 다섯 모두) ③ 대장 표(이름·키·기술 이름)와 첫 시전·간격 상수 ④ 주 1회 보상 상태: 안 받음→받음→초기화 ⑤ 세이브 왕복(받은 주 번호가 JSON 에 실려 복원)
    /// — 옛 세이브(필드 없음)는 아직 안 받은 것으로.
    /// 씬에서 도는 승격·방패·180초 제한은 `PlaytestStorySlice`·`PlaytestStoryBossPattern` 이 이미 본다.
    /// `-executeMethod Saga.EditorTools.PlaytestStoryGateCaptain.Run` → "[PlaytestStoryGateCaptain] OK/FAIL".
    /// </summary>
    public static class PlaytestStoryGateCaptain
    {
        [MenuItem("Saga/Playtest Story Gate Captain")]
        public static void Run()
        {
            PlaytestKit.Begin("[PlaytestStoryGateCaptain]");
            string saved = StorySaveState.ToJson();
            using (PlaytestKit.IsolatedSaves())
            using (PlaytestKit.ErrorCounter())
            {
                CheckRoster();
                CheckRotation();
                CheckSigTable();
                CheckWeeklyClaim();
                CheckSaveRoundTrip();
            }
            StorySaveState.ApplyJson(saved);
            PlaytestKit.Summary("PlaytestStoryGateCaptain");
            if (Application.isBatchMode) EditorApplication.Exit(PlaytestKit.Fails == 0 ? 0 : 1);
        }

        private static void CheckRoster()
        {
            var ids = StoryBossPattern.GateCaptains;
            PlaytestKit.Check(ids.Length == 5 && ids.Distinct().Count() == 5, $"un.st.gate-captain: 관문 대장 {ids.Length}명·고유 {ids.Distinct().Count()}명 (기대 5)");
            var kinds = new HashSet<StoryBossPattern.Kind>();
            foreach (string id in ids)
            {
                int i = StoryBossPattern.SigIndex(id);
                PlaytestKit.Check(i >= 0, $"un.st.gate-captain: {id} 가 기술 표에 없음");
                if (i < 0) continue;
                var k = StoryBossPattern.Sigs[i].Kind;
                PlaytestKit.Check(k != StoryBossPattern.Kind.None && kinds.Add(k), $"un.st.gate-captain: {id} 기술 {k} 이 없거나 다른 대장과 겹침");
            }
            foreach (string id in ids)
                PlaytestKit.Check(id != "gate_guardian" && !StoryBossPattern.Sigs.Take(6).Any(s => s.Id == id), $"un.st.gate-captain: {id} 가 들판 두목·수호장과 겹침");
            PlaytestKit.Check(StoryBossPattern.SigIndex("nope") == -1, "un.st.gate-captain: 모르는 id 가 -1 이 아님");
        }

        private static void CheckRotation()
        {
            var ids = StoryBossPattern.GateCaptains;
            var seen = new HashSet<int>();
            for (int w = 0; w < 25; w++)
            {
                int gi = StoryBossPattern.GateCaptainIndex(w);
                PlaytestKit.Check(gi >= 0 && StoryBossPattern.Sigs[gi].Id == ids[w % ids.Length], $"un.st.gate-captain: {w}주 대장이 순서와 다름");
                PlaytestKit.Check(gi == StoryBossPattern.GateCaptainIndex(w + ids.Length), $"un.st.gate-captain: {w}주와 {w + ids.Length}주가 같지 않음(주기)");
                if (w < ids.Length) seen.Add(gi);
            }
            PlaytestKit.Check(seen.Count == ids.Length, $"un.st.gate-captain: 다섯 주에 {seen.Count}명만 나옴");
            for (int w = -12; w < 0; w++)
                PlaytestKit.Check(StoryBossPattern.GateCaptainIndex(w) >= 0, $"un.st.gate-captain: 음수 주 {w} 에서 인덱스가 음수");
            PlaytestKit.Check(StoryBossPattern.GateCaptainIndex(-1) == StoryBossPattern.GateCaptainIndex(ids.Length - 1), "un.st.gate-captain: 주 -1 이 마지막 대장과 다름");
            int now = StoryBossPattern.GateCaptainIndex(StoryLabyrinthState.CurrentWeekIndex());
            PlaytestKit.Check(now >= 0, "un.st.gate-captain: 이번 주 대장을 못 고름");
        }

        private static void CheckSigTable()
        {
            var keys = new HashSet<string>();
            foreach (string id in StoryBossPattern.GateCaptains)
            {
                int i = StoryBossPattern.SigIndex(id);
                if (i < 0) continue;
                var s = StoryBossPattern.Sigs[i];
                PlaytestKit.Check(!string.IsNullOrEmpty(s.BossKo) && !string.IsNullOrEmpty(s.NameKo), $"un.st.gate-captain: {id} 이름이 비었음");
                PlaytestKit.Check(keys.Add(s.BossKey) && keys.Add(s.NameKey), $"un.st.gate-captain: {id} 현지화 키가 겹침");
                PlaytestKit.Check(!string.IsNullOrEmpty(StoryBossPattern.SigBoss(i)) && !string.IsNullOrEmpty(StoryBossPattern.SigName(i)), $"un.st.gate-captain: {id} 표시 글자가 비었음");
            }
            PlaytestKit.Check(StoryBossPattern.SigBoss(-1) == "" && StoryBossPattern.SigName(-1) == "", "un.st.gate-captain: 인덱스 -1 이 빈 글자가 아님");
            PlaytestKit.Check(StoryBossPattern.GateSigFirst > 0f && StoryBossPattern.GateSigCd > StoryBossPattern.GateSigFirst, "un.st.gate-captain: 첫 시전·간격 상수 이상");
        }

        private static void CheckWeeklyClaim()
        {
            StorySaveState.ResetChampionForTest();
            PlaytestKit.Check(StorySaveState.ChampionAvailable() && !StorySaveState.ChampionEverClaimed, "un.st.gate-captain: 새 상태가 '아직 안 받음'이 아님");
            StorySaveState.ClaimChampion();
            PlaytestKit.Check(!StorySaveState.ChampionAvailable() && StorySaveState.ChampionEverClaimed, "un.st.gate-captain: 보상을 받았는데 이번 주가 열려 있음");
            StorySaveState.ClaimChampion();
            PlaytestKit.Check(!StorySaveState.ChampionAvailable(), "un.st.gate-captain: 두 번 받기가 상태를 풀었음");
            StorySaveState.ResetChampionForTest();
            PlaytestKit.Check(StorySaveState.ChampionAvailable() && !StorySaveState.ChampionEverClaimed, "un.st.gate-captain: 초기화가 안 됨");
        }

        private static void CheckSaveRoundTrip()
        {
            StorySaveState.ResetChampionForTest();
            StorySaveState.ClaimChampion();
            string claimed = StorySaveState.ToJson();
            PlaytestKit.Check(claimed.Contains("\"championWeek\":"), "un.st.gate-captain: 세이브에 championWeek 필드가 없음");
            StorySaveState.ResetChampionForTest();
            PlaytestKit.Check(StorySaveState.ApplyJson(claimed) && !StorySaveState.ChampionAvailable(), "un.st.gate-captain: 받은 주가 세이브 왕복에서 사라짐");
            string fresh;
            StorySaveState.ResetChampionForTest();
            fresh = StorySaveState.ToJson();
            StorySaveState.ClaimChampion();
            PlaytestKit.Check(StorySaveState.ApplyJson(fresh) && StorySaveState.ChampionAvailable(), "un.st.gate-captain: 안 받은 상태가 복원되지 않음");
            // 옛 세이브: 필드가 아예 없으면 0 → 아직 안 받음.
            int a = claimed.IndexOf("\"championWeek\":");
            int b = claimed.IndexOf(',', a);
            string legacy = claimed.Remove(a, b - a + 1);
            StorySaveState.ClaimChampion();
            PlaytestKit.Check(StorySaveState.ApplyJson(legacy) && StorySaveState.ChampionAvailable() && !StorySaveState.ChampionEverClaimed, "un.st.gate-captain: 옛 세이브(필드 없음)가 '안 받음'으로 안 읽힘");
        }
    }
}
