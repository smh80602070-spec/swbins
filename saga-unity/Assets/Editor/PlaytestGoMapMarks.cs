using System.Collections.Generic;
using System.Linq;
using UnityEngine;
using Saga.Go.Combat;
using Saga.Go.Data;
using Saga.Go.Player;
using Saga.Go.UI;

namespace Saga.EditorTools
{
    /// <summary>
    /// PLAN.md 109-14-23 "지도 임무 표식"(웹 사가고 ⑲-23 진단 항목) — `PlaytestHeadless` 가 세계 임무 진단 뒤에 부른다.
    /// 표식 판(이야기 ◆ 따라가는 중 · 세계 임무 ! 맡을 수 있음(등급·못 가 본 땅이면 안 찍음) · ◇ 맡음 · 따라가기를 바꾸면 ◆ 가 옮겨 감 ·
    /// 꺼짐 · 목표 자리 = 그 단계의 목표) · 가까운 지점(켠 역참·오른 정상 중 가장 가까운 것) · 지도 화면(표식 단추·고르기 카드·
    /// 따라가기 단추 = ◇ 만 · 고른 것 다시 누르면 풀림 · 순간이동 지점으로 순간이동하고 지도가 닫힘).
    /// 끝나면 이야기·세계 임무·따라가는 줄·지도 기록·레벨·자리를 되돌린다.
    /// </summary>
    public static class PlaytestGoMapMarks
    {
        private static string _tag;
        private static bool _ok;

        public static bool Run(string tag)
        {
            _tag = tag;
            _ok = true;
            var fc = FieldCombat.Instance;
            var pc = fc != null ? fc.GetComponent<PlayerController>() : null;
            var ui = WorldMapUi.Instance;
            if (fc == null || pc == null || ui == null) { Fail("FieldCombat/PlayerController/WorldMapUi 없음"); return false; }
            bool off0 = StoryState.OffForTest;
            int ch0 = StoryState.Ch, st0 = StoryState.StepIndex, lv0 = PlayerStats.Level, exp0 = PlayerStats.Exp;
            var wqs0 = WorldQuestState.SnapshotSteps();
            var wqd0 = WorldQuestState.SnapshotDone();
            string track0 = StoryState.TrackId;
            var wp0 = WorldMapState.SnapshotWaypoints();
            var rg0 = WorldMapState.SnapshotRegions();
            bool rev0 = WorldMapState.Revealed;
            var pk0 = WorldMapState.SnapshotPeaks();
            var parts = new List<string>();
            try
            {
                StoryState.OffForTest = false;
                WorldQuestState.Restore(null, null);
                StoryState.Restore(0, 0);
                PlayerStats.Restore(3, 0);
                WorldMapState.Restore(null, null, false);
                WorldMapState.RestorePeaks(null);
                CheckMarks(fc, parts);
                CheckWays(parts);
                CheckUi(ui, pc, parts);
            }
            finally
            {
                ui.Close();
                WorldMapState.Restore(wp0, rg0, rev0);
                WorldMapState.RestorePeaks(pk0);
                WorldQuestState.Restore(wqs0, wqd0);
                StoryState.Restore(ch0, st0);
                StoryState.RestoreTrack(track0);
                StoryState.OffForTest = off0;
                PlayerStats.Restore(lv0, exp0);
                fc.ResetForTest();
                pc.Teleport(fc.SafePoint);
                foreach (var e in FieldEnemy.All) e.RestoreHomeForTest();
            }
            if (_ok) Debug.Log($"[{_tag}] map marks OK - {string.Join(" · ", parts)}");
            return _ok;
        }

        private static GoMapMarks.Mark? Find(List<GoMapMarks.Mark> list, bool wq, int q)
        {
            foreach (var m in list) if (m.Is(wq, q)) return m;
            return null;
        }

        private static void CheckMarks(FieldCombat fc, List<string> parts)
        {
            Vector3 from = fc.transform.position;
            var giverStep = GoWorldQuests.Quests[0].Steps[0];
            Vector3 giverPos = GoStory.TargetOf(giverStep, from, out _);
            string giverRegion = GoWorldMap.RegionAt(giverPos);

            // 이야기 = 따라가는 중(◆). 못 가 본 땅이어도 따라가는 것은 찍는다. 세계 임무 ! 는 못 가 본 땅이면 안 찍는다.
            var marks = GoMapMarks.Build(from);
            var story = Find(marks, false, -1);
            if (story == null) Fail("이야기 표식 없음");
            else
            {
                if (story.Value.Kind != GoMapMarks.Kind.Track) Fail($"이야기가 따라가는 중이 아님 {story.Value.Kind}");
                Vector3 want = GoStory.TargetOf(StoryState.StoryCurrent, from, out _);
                if (GoStory.Flat(story.Value.Pos, want) > 0.01f) Fail("이야기 표식이 그 단계 목표가 아님");
                if (string.IsNullOrEmpty(story.Value.Name) || string.IsNullOrEmpty(story.Value.Text)) Fail("이야기 표식 이름·글 빔");
            }
            if (Find(marks, true, 0) != null && !WorldMapState.IsVisited(giverRegion)) Fail("못 가 본 땅인데 ! 가 찍힘");
            WorldMapState.Visit(giverRegion);
            marks = GoMapMarks.Build(from);
            var avail = Find(marks, true, 0);
            if (avail == null) Fail("가 본 땅인데 ! 없음");
            else if (avail.Value.Kind != GoMapMarks.Kind.Avail || GoStory.Flat(avail.Value.Pos, giverPos) > 0.01f) Fail("! 가 맡길 사람 자리가 아님");
            if (Find(marks, true, 1) != null || Find(marks, true, 2) != null) Fail("등급 전인 임무에 ! 가 찍힘");

            // 등급이 닿으면 나머지 셋도(가 본 땅이면). 온 땅이 밝혀지면 전부.
            PlayerStats.Restore(12, 0);
            WorldMapState.Restore(null, null, true);
            marks = GoMapMarks.Build(from);
            if (marks.Count != 4 || marks.Count(m => m.Kind == GoMapMarks.Kind.Avail) != 3) Fail($"등급 12 표식 {marks.Count} (기대 이야기 1 + ! 3)");

            // 맡으면 ◇ — 이야기가 따라가는 중이니 임무는 ◇, 따라가기를 바꾸면 ◆ 가 옮겨 간다.
            WorldQuestState.Take(0);
            marks = GoMapMarks.Build(from);
            var q0 = Find(marks, true, 0);
            if (q0 == null || q0.Value.Kind != GoMapMarks.Kind.Idle) Fail("맡은 임무가 ◇ 아님");
            else if (GoStory.Flat(q0.Value.Pos, GoStory.TargetOf(WorldQuestState.Current(0), from, out _)) > 0.01f) Fail("◇ 가 그 단계 목표가 아님");
            if (marks.Count(m => m.Kind == GoMapMarks.Kind.Track) != 1) Fail("따라가는 표식이 하나가 아님");
            StoryState.SetTrack(0);
            marks = GoMapMarks.Build(from);
            if (Find(marks, true, 0)?.Kind != GoMapMarks.Kind.Track || Find(marks, false, -1)?.Kind != GoMapMarks.Kind.Idle) Fail("따라가기를 바꿔도 ◆ 가 안 옮겨 감");
            if (marks.Count(m => m.Kind == GoMapMarks.Kind.Track) != 1) Fail("바꾼 뒤 따라가는 표식이 하나가 아님");
            StoryState.SetTrack(-1);

            // 끝난 임무는 표식이 없다 · 꺼지면 아무것도 없다
            WorldQuestState.Restore(new List<int> { 2, -1, -1 }, new List<bool> { true, false, false });
            if (Find(GoMapMarks.Build(from), true, 0) != null) Fail("끝난 임무에 표식");
            StoryState.OffForTest = true;
            if (GoMapMarks.Build(from).Count != 0) Fail("꺼졌는데 표식");
            StoryState.OffForTest = false;
            WorldQuestState.Restore(null, null);
            parts.Add($"표식 판(이야기 ◆·! 등급·못 가 본 땅 숨김·◇·◆ 옮김·끝남·꺼짐)");
        }

        private static void CheckWays(List<string> parts)
        {
            var origin = GoWorldMap.ArrivalPos(GoWorldMap.Waypoints[0]);
            WorldMapState.Restore(null, null, false);
            WorldMapState.RestorePeaks(null);
            if (GoMapMarks.NearestWay(origin, out _)) Fail("켠 지점이 없는데 가까운 지점이 있음");

            // 켠 역참 둘 + 오른 정상 하나 — 표식 자리마다 가장 가까운 것을 독립으로 셈해 맞춘다
            int a = 0, b = GoWorldMap.Waypoints.Length - 1;
            WorldMapState.Activate(GoWorldMap.Waypoints[a].Id);
            if (b != a) WorldMapState.Activate(GoWorldMap.Waypoints[b].Id);
            WorldMapState.FindPeak(GoWorldMap.Peaks[0].Id);
            var spots = new List<Vector3> { origin, GoWorldMap.PeakArrival(GoWorldMap.Peaks[0]), GoWorldMap.ArrivalPos(GoWorldMap.Waypoints[b]) + new Vector3(30f, 0f, 0f) };
            foreach (var s in spots)
            {
                float best = float.MaxValue;
                foreach (int i in new[] { a, b }.Distinct()) best = Mathf.Min(best, GoStory.Flat(GoWorldMap.ArrivalPos(GoWorldMap.Waypoints[i]), s));
                best = Mathf.Min(best, GoStory.Flat(GoWorldMap.PeakArrival(GoWorldMap.Peaks[0]), s));
                if (!GoMapMarks.NearestWay(s, out var w) || Mathf.Abs(w.Dist - best) > 0.01f) Fail($"가까운 지점 거리 {(GoMapMarks.NearestWay(s, out var x) ? x.Dist : -1f):0.0} ≠ {best:0.0}");
            }
            if (!GoMapMarks.NearestWay(GoWorldMap.PeakArrival(GoWorldMap.Peaks[0]), out var pw) || !pw.Peak || pw.Index != 0) Fail("정상 곁인데 정상이 안 뽑힘");
            if (GoMapMarks.Dist(240f) != "240m" || GoMapMarks.Dist(1500f) != "1.5km") Fail("거리 글");
            parts.Add("가까운 지점(켠 역참·오른 정상 중 가장 가까운 것·없으면 없음)");
        }

        private static void CheckUi(WorldMapUi ui, PlayerController pc, List<string> parts)
        {
            var fc = FieldCombat.Instance;
            PlayerStats.Restore(12, 0);
            WorldMapState.Restore(new List<string> { GoWorldMap.Waypoints[0].Id }, null, true);
            WorldMapState.RestorePeaks(null);
            WorldQuestState.Restore(null, null);
            StoryState.Restore(0, 0);
            WorldQuestState.Take(0);
            ui.Open();
            var pure = GoMapMarks.Build(fc.transform.position);
            if (ui.MarkCount != pure.Count || ui.MarkCount != 4) Fail($"표식 단추 {ui.MarkCount} ≠ {pure.Count}");
            for (int i = 0; i < ui.MarkCount; i++) if (!ui.MarkShown(i)) Fail($"표식 {i} 단추 꺼짐");
            if (ui.HasPick || !ui.PickText.Contains("◆") || ui.PickTrackButton.gameObject.activeSelf) Fail("처음엔 범례만 있어야 함");

            int idle = -1, avail = -1, track = -1;
            for (int i = 0; i < ui.MarkCount; i++)
            {
                var k = ui.MarkAt(i).Kind;
                if (k == GoMapMarks.Kind.Idle && idle < 0) idle = i;
                if (k == GoMapMarks.Kind.Avail && avail < 0) avail = i;
                if (k == GoMapMarks.Kind.Track) track = i;
            }
            if (idle < 0 || avail < 0 || track < 0) { Fail("표식 꼴 셋이 안 나옴"); return; }

            // 고르기 — 따라가는 것·맡을 것은 따라가기 단추가 막힘, 안 따라가는 임무(◇)만 열림
            if (!ui.PickMark(track) || !ui.PickText.Contains(ui.MarkAt(track).Name) || ui.PickTrackButton.interactable) Fail("따라가는 표식 고르기");
            if (!ui.PickMark(avail) || ui.PickTrackButton.interactable || ui.TrackPicked()) Fail("맡기 전 ! 는 따라가기가 막혀야 함");
            if (!ui.PickMark(idle) || !ui.PickTrackButton.interactable) Fail("◇ 는 따라가기가 열려야 함");
            if (ui.PickMark(idle) || ui.HasPick) Fail("고른 것을 다시 누르면 풀려야 함");
            ui.PickMark(idle);
            if (!ui.PickText.Contains("m")) Fail("고르기 카드에 거리 없음");

            // 따라가기 — ◇ 를 따라가면 그 임무가 ◆ 로
            int q = ui.MarkAt(idle).Wq ? ui.MarkAt(idle).Quest : -1;
            if (!ui.TrackPicked()) Fail("따라가기가 안 됨");
            if (StoryState.TrackingQuest != (q >= 0) || (q >= 0 && StoryState.Track != q)) Fail("따라가는 줄이 안 바뀜");
            int tracked = Enumerable.Range(0, ui.MarkCount).Count(i => ui.MarkAt(i).Kind == GoMapMarks.Kind.Track);
            if (tracked != 1) Fail($"따라간 뒤 ◆ {tracked}개");
            if (ui.PickTrackButton.interactable) Fail("따라가는 표식인데 단추가 열림");

            // 순간이동 — 고른 표식에서 가장 가까운 켠 역참으로, 지도가 닫힌다
            var m = ui.MarkAt(Enumerable.Range(0, ui.MarkCount).First(i => ui.MarkAt(i).Wq == ui.MarkAt(idle).Wq && ui.MarkAt(i).Quest == ui.MarkAt(idle).Quest));
            if (!GoMapMarks.NearestWay(m.Pos, out var way)) { Fail("켠 역참이 없음"); return; }
            if (!ui.PickJumpButton.interactable) Fail("순간이동 단추가 닫힘");
            if (!ui.JumpPicked()) Fail("순간이동이 안 됨");
            else
            {
                if (ui.IsOpen) Fail("순간이동 뒤 지도가 안 닫힘");
                if (GoStory.Flat(pc.transform.position, way.Pos) > 1.5f) Fail($"순간이동 자리 {GoStory.Flat(pc.transform.position, way.Pos):0.0}m 어긋남");
            }

            // 꺼진 표식은 고르기가 풀린다
            ui.Open();
            ui.PickMark(0);
            StoryState.OffForTest = true;
            ui.Open();
            if (ui.MarkCount != 0 || ui.HasPick) Fail("꺼졌는데 표식·고르기가 남음");
            StoryState.OffForTest = false;
            ui.Close();
            parts.Add($"지도 화면(단추 4·범례·고르기 카드·따라가기 ◇ 만·순간이동 {way.Name} {GoMapMarks.Dist(way.Dist)})");
        }

        private static void Fail(string msg)
        {
            _ok = false;
            Debug.LogError($"[{_tag}] map marks FAIL - {msg}");
        }
    }
}
