using System.Collections.Generic;
using UnityEditor;
using UnityEngine;
using Saga.Core;
using GoTut = Saga.Go.Data.GoTutorial;
using DungeonTut = Saga.Dungeon.Data.DungeonTutorial;
using GoSave = Saga.Go.Data.SaveState;
using DungeonSave = Saga.Dungeon.Data.SaveState;
using StoryTut = Saga.Story.Data.StoryTutorial;
using StorySave = Saga.Story.Data.StorySaveState;
using ForestTut = Saga.Forest.Data.ForestTutorial;
using ForestSave = Saga.Forest.Data.ForestSaveState;

namespace Saga.EditorTools
{
    /// <summary>
    /// 첫 10분 사명 진단(tasks U-0013) — ① `TutorialSteps` 순서·건너뛰기·끄기·세이브 왕복(가짜 판정) ② GO·DUNGEON·STORY 단계 표(다섯·id 중복 0)
    /// ③ 옛 세이브(v28/v14)는 `Line()==null`, 새 게임 기본값은 `Line()!=null`.
    /// `-executeMethod Saga.EditorTools.PlaytestTutorial.Run` → "[PlaytestTutorial] OK/FAIL".
    /// </summary>
    public static class PlaytestTutorial
    {
        [MenuItem("Saga/Playtest Tutorial")]
        public static void Run()
        {
            PlaytestKit.Begin("[PlaytestTutorial]");
            bool goOn = GoTut.Enabled, dgOn = DungeonTut.Enabled, stOn = StoryTut.Enabled, foOn = ForestTut.Enabled;
            using (PlaytestKit.IsolatedSaves())
            using (PlaytestKit.ErrorCounter())
            {
                try
                {
                    CheckEngine();
                    CheckTables();
                    GoTut.Enabled = true; DungeonTut.Enabled = true; StoryTut.Enabled = true; ForestTut.Enabled = true;
                    CheckVersions("GO", GoSave.ToJson(), GoSave.ApplyJson, () => GoTut.Line());
                    CheckVersions("DUNGEON", DungeonSave.ToJson(), DungeonSave.ApplyJson, () => DungeonTut.Line());
                    CheckStorySave();
                    CheckForestSave();
                }
                finally
                {
                    GoTut.Restore(null); DungeonTut.Restore(null); StoryTut.Restore(null); ForestTut.Restore(null);
                    GoTut.Enabled = goOn; DungeonTut.Enabled = dgOn; StoryTut.Enabled = stOn; ForestTut.Enabled = foOn;
                }
            }
            PlaytestKit.Summary("PlaytestTutorial");
            if (Application.isBatchMode) EditorApplication.Exit(PlaytestKit.Fails == 0 ? 0 : 1);
        }

        private static void CheckEngine()
        {
            bool a = false, b = false, c = false;
            var t = new TutorialSteps(
                new TutorialSteps.Step { Id = "a", Ko = "가", En = "A", Done = () => a },
                new TutorialSteps.Step { Id = "b", Ko = "나", En = "B", Done = () => b },
                new TutorialSteps.Step { Id = "c", Ko = "다", En = "C", Done = () => c });
            string l0 = t.Line();
            PlaytestKit.Check(l0 != null && l0.Contains("1/3"), $"처음 줄이 1/3 이 아님 '{l0}'");
            b = true; // 순서 밖으로 먼저 한 일
            PlaytestKit.Check(t.Line().Contains("1/3"), "앞 단계를 안 했는데 넘어감");
            a = true;
            string l1 = t.Line();
            PlaytestKit.Check(l1 != null && l1.Contains("3/3") && t.DoneCount == 2, $"a·b 를 하면 셋째로 건너뜀 '{l1}' done={t.DoneCount}");
            var saved = t.Ids();
            PlaytestKit.Check(saved.Count == 2 && saved[0] == "a" && saved[1] == "b", "Ids 가 표 순서가 아님");
            t.Restore(null);
            PlaytestKit.Check(t.DoneCount == 0, "Restore(null) 이 비우지 못함");
            t.Restore(new[] { "b", "zzz" });
            PlaytestKit.Check(t.DoneCount == 1 && t.Ids()[0] == "b", "Restore 가 모르는 id 를 받아들임");
            c = true; a = false;
            t.Restore(saved); // a·b 끝, c 참
            PlaytestKit.Check(t.Line() == null && t.Finished, "다 끝났는데 줄이 남음");
            t.Restore(null); t.Enabled = false;
            PlaytestKit.Check(t.Line() == null, "Enabled=false 인데 줄이 나옴");
            t.Enabled = true; t.CompleteAll();
            PlaytestKit.Check(t.Line() == null && t.Finished, "CompleteAll 뒤에 줄이 남음");
        }

        private static void CheckTables()
        {
            CheckIds("GO", GoTut.AllIds());
            CheckIds("DUNGEON", DungeonTut.AllIds());
            CheckIds("STORY", StoryTut.AllIds());
            CheckIds("FOREST", ForestTut.AllIds());
        }

        private static void CheckIds(string tag, List<string> ids)
        {
            PlaytestKit.Check(ids.Count == 5, $"{tag} 단계 {ids.Count} ≠ 5");
            PlaytestKit.Check(new HashSet<string>(ids).Count == ids.Count, $"{tag} 단계 id 중복");
        }

        private static void CheckVersions(string tag, string cur, System.Func<string, bool> apply, System.Func<string> line)
        {
            int v = ReadVersion(cur);
            PlaytestKit.Check(v > 0, $"{tag} 현재 버전을 못 읽음");
            PlaytestKit.Check(apply(cur), $"{tag} 새 게임 기본값이 안 읽힘");
            PlaytestKit.Check(line() != null, $"{tag} 새 게임인데 첫걸음 줄이 없음");
            PlaytestKit.Check(apply(cur.Replace($"\"version\":{v}", $"\"version\":{v - 1}")), $"{tag} v{v - 1} 세이브가 안 읽힘");
            PlaytestKit.Check(line() == null, $"{tag} 옛 세이브인데 첫걸음 줄이 남음 '{line()}'");
            PlaytestKit.Check(apply(cur), $"{tag} 새 게임 기본값이 다시 안 읽힘");
            PlaytestKit.Check(line() != null, $"{tag} 새 게임으로 되돌렸는데 첫걸음 줄이 없음");
        }

        // STORY 는 세이브 버전을 안 올린다(새 칸 `tutV` — 0(없는 세이브)이 옛 세이브). 칸을 지워 옛 세이브를 흉내 낸다.
        private static void CheckStorySave()
        {
            string cur = StorySave.ToJson();
            PlaytestKit.Check(cur.Contains("\"tutV\":1"), "STORY 새 게임 기본값에 tutV 가 없음");
            PlaytestKit.Check(StorySave.ApplyJson(cur), "STORY 새 게임 기본값이 안 읽힘");
            PlaytestKit.Check(StoryTut.Line() != null, "STORY 새 게임인데 첫걸음 줄이 없음");
            string old = System.Text.RegularExpressions.Regex.Replace(cur, @",""tutV"":1", "");
            PlaytestKit.Check(old != cur, "STORY 옛 세이브 흉내(tutV 제거)가 안 됨");
            PlaytestKit.Check(StorySave.ApplyJson(old), "STORY tutDone 없는 세이브가 안 읽힘");
            PlaytestKit.Check(StoryTut.Line() == null, $"STORY 옛 세이브인데 첫걸음 줄이 남음 '{StoryTut.Line()}'");
            PlaytestKit.Check(StorySave.ApplyJson(cur), "STORY 새 게임 기본값이 다시 안 읽힘");
            PlaytestKit.Check(StoryTut.Line() != null, "STORY 새 게임으로 되돌렸는데 첫걸음 줄이 없음");
        }

        // FOREST 도 세이브 버전을 안 올린다(`tutV` 0 = 없는 세이브 = 옛 세이브) — STORY 와 같은 방식.
        private static void CheckForestSave()
        {
            string cur = ForestSave.ToJson();
            PlaytestKit.Check(cur.Contains("\"tutV\":1"), "FOREST 새 게임 기본값에 tutV 가 없음");
            PlaytestKit.Check(ForestSave.ApplyJson(cur), "FOREST 새 게임 기본값이 안 읽힘");
            PlaytestKit.Check(ForestTut.Line() != null, "FOREST 새 게임인데 첫걸음 줄이 없음");
            string old = System.Text.RegularExpressions.Regex.Replace(cur, @",""tutV"":1", "");
            PlaytestKit.Check(old != cur, "FOREST 옛 세이브 흉내(tutV 제거)가 안 됨");
            PlaytestKit.Check(ForestSave.ApplyJson(old), "FOREST tutV 없는 세이브가 안 읽힘");
            PlaytestKit.Check(ForestTut.Line() == null, $"FOREST 옛 세이브인데 첫걸음 줄이 남음 '{ForestTut.Line()}'");
            PlaytestKit.Check(ForestSave.ApplyJson(cur), "FOREST 새 게임 기본값이 다시 안 읽힘");
            PlaytestKit.Check(ForestTut.Line() != null, "FOREST 새 게임으로 되돌렸는데 첫걸음 줄이 없음");
        }

        private static int ReadVersion(string json)
        {
            const string key = "\"version\":";
            int i = json.IndexOf(key);
            if (i < 0) return 0;
            i += key.Length;
            int j = i;
            while (j < json.Length && char.IsDigit(json[j])) j++;
            return int.TryParse(json.Substring(i, j - i), out int v) ? v : 0;
        }
    }
}
