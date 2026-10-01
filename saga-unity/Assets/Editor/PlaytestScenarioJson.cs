using System.Collections.Generic;
using UnityEditor;
using UnityEngine;
using Saga.Realm.Data;
using ForestData = Saga.Forest.Data.ForestScenarioData;
using StoryData = Saga.Story.Data.StoryScenarioData;
using DungeonData = Saga.Dungeon.Data.DungeonScenarioData;

namespace Saga.EditorTools
{
    /// <summary>
    /// 시나리오 JSON 로더 진단(tasks U-0009) — 네 판의 `Resources/scenario_&lt;판&gt;.json` 이 읽히고, 내보낼 때 적은 개수와 같고,
    /// id 중복이 없고, 씬이 가리키는 장이 있는지 본다. REALM 은 사전(`TextByKo`·`TextByKKo`)이 채워지는지도 본다.
    /// `-executeMethod Saga.EditorTools.PlaytestScenarioJson.Run` → "[PlaytestScenarioJson] OK/FAIL".
    /// </summary>
    public static class PlaytestScenarioJson
    {
        // 내보낼 때(2026-10-01) 찍은 개수 — 표를 일부러 늘릴 때 여기도 고친다.
        private const int ForestChapters = 29, ForestScenes = 58, ForestCasts = 11;
        private const int StoryChapters = 17, StoryScenes = 29, StoryCasts = 11;
        private const int DungeonChapters = 19, DungeonScenes = 41, DungeonCasts = 14;
        private const int RealmCards = 19, RealmSide = 9;

        [MenuItem("Saga/Playtest Scenario JSON")]
        public static void Run()
        {
            PlaytestKit.Begin("[PlaytestScenarioJson]");
            using (PlaytestKit.ErrorCounter())
            {
                Counts("FOREST", ForestData.Chapters.Length, ForestChapters, ForestData.Scenes.Length, ForestScenes, ForestData.Casts.Length, ForestCasts);
                Counts("STORY", StoryData.Chapters.Length, StoryChapters, StoryData.Scenes.Length, StoryScenes, StoryData.Casts.Length, StoryCasts);
                Counts("DUNGEON", DungeonData.Chapters.Length, DungeonChapters, DungeonData.Scenes.Length, DungeonScenes, DungeonData.Casts.Length, DungeonCasts);

                var fch = new HashSet<string>(); foreach (var c in ForestData.Chapters) PlaytestKit.Check(fch.Add(c.Id), $"FOREST 장 id 중복 {c.Id}");
                foreach (var s in ForestData.Scenes) PlaytestKit.Check(fch.Contains(s.ChapterId), $"FOREST 씬 {s.Id} 의 장 {s.ChapterId} 없음");
                var sch = new HashSet<string>(); foreach (var c in StoryData.Chapters) PlaytestKit.Check(sch.Add(c.Id), $"STORY 장 id 중복 {c.Id}");
                foreach (var s in StoryData.Scenes) PlaytestKit.Check(sch.Contains(s.ChapterId), $"STORY 씬 {s.Id} 의 장 {s.ChapterId} 없음");
                var dids = new HashSet<string>(); foreach (var c in DungeonData.Chapters) PlaytestKit.Check(dids.Add(c.Id), $"DUNGEON 장 id 중복 {c.Id}");
                foreach (var s in DungeonData.Scenes) PlaytestKit.Check(!string.IsNullOrEmpty(s.Id), "DUNGEON 씬 id 비어 있음");

                // 첫 장은 After 가 null(JSON 의 "" 를 Normalize 가 되돌린다) — 소비 코드가 `After == null` 로 첫 장을 찾는다.
                PlaytestKit.Check(ForestData.Chapters[0].After == null, "FOREST 첫 장 After 가 null 이 아님");
                PlaytestKit.Check(StoryData.Chapters[0].After == null, "STORY 첫 장 After 가 null 이 아님");
                PlaytestKit.Check(DungeonData.Chapters[0].After == null, "DUNGEON 첫 장 After 가 null 이 아님");
                PlaytestKit.Check(ForestData.Chapters[1].After != null, "FOREST 둘째 장 After 가 비어 있음");

                // 선택이 없는 씬은 Choice 가 null(JsonUtility 가 빈 객체로 쓴 것을 Normalize 가 되돌린다).
                int noChoice = 0, withChoice = 0;
                foreach (var s in ForestData.Scenes) { if (s.Choice == null) noChoice++; else withChoice++; }
                PlaytestKit.Check(noChoice > 0 && withChoice > 0, $"FOREST Choice null {noChoice} · 있음 {withChoice} — Normalize 확인");
                foreach (var s in ForestData.Scenes) if (s.Choice != null) PlaytestKit.Check(!string.IsNullOrEmpty(s.Choice.Id) && s.Choice.Options != null && s.Choice.Options.Length > 0, $"FOREST 선택 {s.Id} 가 비어 있음");

                PlaytestKit.Check(RealmScenarioData.Cards.Length == RealmCards, $"REALM 카드 {RealmScenarioData.Cards.Length} ≠ {RealmCards}");
                PlaytestKit.Check(RealmScenarioSideData.Side.Length == RealmSide, $"REALM 곁가지 {RealmScenarioSideData.Side.Length} ≠ {RealmSide}");
                var rids = new HashSet<string>();
                foreach (var c in RealmScenarioData.Cards) PlaytestKit.Check(rids.Add(c.Id), $"REALM 카드 id 중복 {c.Id}");
                foreach (var c in RealmScenarioSideData.Side) PlaytestKit.Check(rids.Add(c.Id), $"REALM 곁가지 id 가 본 사슬과 겹침 {c.Id}");
                var end = RealmScenarioData.Get("r7_after");
                PlaytestKit.Check(end != null && end.TextByKKo != null && end.TextByKKo.ContainsKey("util"), "REALM r7_after.TextByKKo 사전이 안 채워짐");
                int dicts = 0; foreach (var c in RealmScenarioData.Cards) if (c.TextByKo != null) dicts++;
                PlaytestKit.Check(dicts > 0, "REALM TextByKo 가진 카드가 하나도 없음");
                PlaytestKit.Check(RealmScenarioData.TimeFolk.Length == 9, $"REALM 시간 틈 사람 {RealmScenarioData.TimeFolk.Length} ≠ 9");
            }
            PlaytestKit.Summary("PlaytestScenarioJson");
            if (Application.isBatchMode) EditorApplication.Exit(PlaytestKit.Fails == 0 ? 0 : 1);
        }

        private static void Counts(string tag, int ch, int wantCh, int sc, int wantSc, int ca, int wantCa)
        {
            PlaytestKit.Check(ch == wantCh, $"{tag} 장 {ch} ≠ {wantCh}");
            PlaytestKit.Check(sc == wantSc, $"{tag} 씬 {sc} ≠ {wantSc}");
            PlaytestKit.Check(ca == wantCa, $"{tag} 인물 {ca} ≠ {wantCa}");
        }
    }
}
