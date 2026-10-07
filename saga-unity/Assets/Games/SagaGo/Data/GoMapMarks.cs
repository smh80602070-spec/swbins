using System.Collections.Generic;
using UnityEngine;

namespace Saga.Go.Data
{
    /// <summary>
    /// PLAN.md 109-14-23 지도 임무 표식(웹 사가만리 ⑲-23 `story.mapMarks`) — 이야기 하나와 세계 임무 셋이 지도에 찍는 점.
    /// 세이브·표만 읽는 순수 판(화면 없이 진단이 본다). 꼴: Track = 따라가는 임무(◆), Idle = 맡았지만 안 따라가는 임무(◇, 그 단계의 목표),
    /// Avail = 여정 등급이 닿아 맡을 수 있는 세계 임무(!, 맡길 사람 자리). 이야기는 금빛·세계 임무는 푸른빛.
    /// 따라가는 것 말고는 못 가 본 지역엔 안 찍는다(`WorldMapState.IsVisited` — 망루로 온 땅이 밝혀지면 전부).
    /// 이 트랙엔 미니맵이 없어(웹 미니맵 ⑲-23 절반) 월드맵 화면에서만 쓴다.
    /// </summary>
    public static class GoMapMarks
    {
        public enum Kind { Track, Idle, Avail }

        public struct Mark
        {
            public Kind Kind;
            /// <summary>세계 임무(푸른빛)인가 — 아니면 이야기(금빛).</summary>
            public bool Wq;
            /// <summary>세계 임무 번호(이야기는 −1).</summary>
            public int Quest;
            public Vector3 Pos;
            public string Name, Text;

            public bool Is(bool wq, int quest) => Wq == wq && Quest == quest;
        }

        /// <summary>순간이동 지점 — 켠 역참 또는 오른 정상. `Index` 는 `GoWorldMap.Waypoints`/`Peaks` 번호.</summary>
        public struct Way
        {
            public bool Peak;
            public int Index;
            public string Name;
            public Vector3 Pos;
            /// <summary>표식에서 이 지점까지(m).</summary>
            public float Dist;
        }

        public static string Icon(Kind k) => k == Kind.Track ? "◆" : k == Kind.Idle ? "◇" : "!";

        /// <summary>지금 찍을 표식 — 이야기 하나(끝났거나 잠겼으면 없음) + 세계 임무. `from` = 플레이어 자리(gather 가 가까운 채집물을 고른다).</summary>
        public static List<Mark> Build(Vector3 from)
        {
            var list = new List<Mark>();
            if (StoryState.OffForTest) return list;
            bool quest = StoryState.TrackingQuest;

            var ss = StoryState.StoryCurrent;
            if (ss != null) Put(list, quest ? Kind.Idle : Kind.Track, false, -1, ss, GoStory.ChapterName(StoryState.Chapter), from);

            for (int q = 0; q < GoWorldQuests.Quests.Length; q++)
            {
                var w = GoWorldQuests.Quests[q];
                if (WorldQuestState.Taken(q))
                    Put(list, quest && StoryState.Track == q ? Kind.Track : Kind.Idle, true, q, WorldQuestState.Current(q), GoWorldQuests.Name(w), from);
                else if (WorldQuestState.Available(q))
                    Put(list, Kind.Avail, true, q, w.Steps[0], GoWorldQuests.Name(w), from);
            }
            return list;
        }

        private static void Put(List<Mark> list, Kind kind, bool wq, int q, GoStory.Step st, string name, Vector3 from)
        {
            if (st == null) return;
            Vector3 pos = GoStory.TargetOf(st, from, out _);
            if (kind != Kind.Track && !WorldMapState.IsVisited(GoWorldMap.RegionAt(pos))) return;
            list.Add(new Mark { Kind = kind, Wq = wq, Quest = q, Pos = pos, Name = name, Text = GoStory.StepText(st) });
        }

        /// <summary>`pos` 에서 가장 가까운 순간이동 지점(켠 역참·오른 정상) — 없으면 false.</summary>
        public static bool NearestWay(Vector3 pos, out Way best)
        {
            best = default;
            bool any = false;
            for (int i = 0; i < GoWorldMap.Waypoints.Length; i++)
            {
                var w = GoWorldMap.Waypoints[i];
                if (!WorldMapState.IsActive(w.Id)) continue;
                Consider(ref best, ref any, false, i, GoWorldMap.WaypointName(w), GoWorldMap.ArrivalPos(w), pos);
            }
            for (int i = 0; i < GoWorldMap.Peaks.Length; i++)
            {
                var p = GoWorldMap.Peaks[i];
                if (!WorldMapState.IsPeakFound(p.Id)) continue;
                Consider(ref best, ref any, true, i, GoWorldMap.PeakName(p), GoWorldMap.PeakArrival(p), pos);
            }
            return any;
        }

        private static void Consider(ref Way best, ref bool any, bool peak, int index, string name, Vector3 at, Vector3 pos)
        {
            float d = GoStory.Flat(at, pos);
            if (any && d >= best.Dist) return;
            any = true;
            best = new Way { Peak = peak, Index = index, Name = name, Pos = at, Dist = d };
        }

        public static string Dist(float m) => m < 1000f ? Mathf.RoundToInt(m) + "m" : (m / 1000f).ToString("0.0") + "km";
    }
}
