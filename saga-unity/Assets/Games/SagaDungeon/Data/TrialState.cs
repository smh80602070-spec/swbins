using System;
using System.Collections.Generic;

namespace Saga.Dungeon.Data
{
    /// <summary>
    /// PLAN.md 109-10-3 시련(試鍊) — 웹 사가나락 §5.11 "대균열식 15분 시간 도전"의 규칙·기록.
    /// 웹 수치 그대로: 15분(900초) · 진척 100(잡졸 3·정예 8, 웹의 보스 10·그림자 1 은 이 판 시련에 안 나온다) →
    /// 수호자 · 적 배율 1 + 0.35 × 단계 · 쓰러지면 −30초(끝나지 않는다) · 상한 100단계 · 순위표 10 · 문턱 제10층.
    /// 완주하면 절반 넘게 남겼을 때 두 단계, 아니면 한 단계 더 열린다. 시간 초과는 기록 없이 끝(주운 것만 남는다).
    /// 웹 세이브 `trial = { best, open, runs, board }` → 세이브 v12 네 칸(`SaveState`). 순위표의 "인물" 칸은 이 판이
    /// 주인공 하나라 빼고 레벨을 적는다.
    /// </summary>
    public static class TrialState
    {
        public const float TrialSec = 900f;
        public const int Goal = 100;
        public const int GruntPoints = 3;
        public const int ElitePoints = 8;
        public const float DeathPenaltySec = 30f;
        public const int MaxStage = 100;
        public const int BoardSize = 10;
        public const int UnlockFloor = 10;
        public const float StageMulPer = 0.35f;
        /// <summary>시련 적이 쓰는 층 공식의 층(문턱과 같게) — 단계 배율은 그 위에 곱한다.</summary>
        public const int BaseFloor = UnlockFloor;

        [Serializable]
        public struct Entry
        {
            public int lv;      // 단계
            public int sec;     // 걸린 초
            public int deaths;
            public int heroLv;  // 웹 "hero" 칸 대신 — 주인공 하나라 그때 레벨
            public string at;   // yyyy-MM-dd
        }

        public static int Best { get; private set; }
        public static int Open { get; private set; } = 1;
        public static int Runs { get; private set; }
        private static readonly List<Entry> BoardList = new List<Entry>();
        public static IReadOnlyList<Entry> Board => BoardList;

        public static float EnemyMul(int stage) => 1f + StageMulPer * Math.Max(1, stage);

        /// <summary>문턱 — 제10층에 닿았거나 이미 한 번이라도 했으면.</summary>
        public static bool IsUnlocked(int deepestFloor) => deepestFloor >= UnlockFloor || Runs > 0 || Open > 1;

        /// <summary>고를 수 있는 단계 — 열린 것 중 위 셋(높은 것부터).</summary>
        public static int[] Offers()
        {
            var list = new List<int>();
            for (int s = Open; s >= 1 && list.Count < 3; s--) list.Add(s);
            return list.ToArray();
        }

        /// <summary>완주 기록 — 돌려주는 값 = 순위표 순위(1~10, 밖이면 0). 열린 단계·최고 단계도 여기서 올린다.</summary>
        public static int RecordClear(int stage, float timeLeft, int deaths, int heroLevel, string date)
        {
            Runs++;
            Best = Math.Max(Best, stage);
            int step = timeLeft > TrialSec / 2f ? 2 : 1;
            Open = Math.Min(MaxStage, Math.Max(Open, stage + step));
            var e = new Entry { lv = stage, sec = (int)Math.Round(TrialSec - Math.Max(0f, timeLeft)), deaths = deaths, heroLv = heroLevel, at = date };
            BoardList.Add(e);
            BoardList.Sort(Compare);
            int rank = BoardList.IndexOf(e) + 1;
            if (BoardList.Count > BoardSize) BoardList.RemoveRange(BoardSize, BoardList.Count - BoardSize);
            return rank <= BoardSize ? rank : 0;
        }

        /// <summary>시간 초과 — 기록 없이 횟수만.</summary>
        public static void RecordTimeout() => Runs++;

        /// <summary>높은 단계 먼저, 같으면 빨리 깬 것, 같으면 덜 쓰러진 것.</summary>
        private static int Compare(Entry a, Entry b)
        {
            if (a.lv != b.lv) return b.lv.CompareTo(a.lv);
            if (a.sec != b.sec) return a.sec.CompareTo(b.sec);
            return a.deaths.CompareTo(b.deaths);
        }

        public static Entry[] SnapshotBoard() => BoardList.ToArray();

        /// <summary>SaveState 전용 — v11 이하는 (0, 0, 0, null) → 기본값(열린 단계 1).</summary>
        public static void Restore(int best, int open, int runs, Entry[] board)
        {
            Best = Math.Max(0, Math.Min(MaxStage, best));
            int floorOpen = Best > 0 ? Best + 1 : 1; // 깬 단계 바로 위는 늘 열려 있다
            Open = Math.Min(MaxStage, Math.Max(Math.Max(1, open), floorOpen));
            Runs = Math.Max(0, runs);
            BoardList.Clear();
            if (board != null) foreach (var e in board) if (e.lv > 0) BoardList.Add(e);
            BoardList.Sort(Compare);
            if (BoardList.Count > BoardSize) BoardList.RemoveRange(BoardSize, BoardList.Count - BoardSize);
        }

        public static string BoardLine(int i)
        {
            if (i < 0 || i >= BoardList.Count) return "";
            var e = BoardList[i];
            return string.Format(DungeonLocalization.T("trial.board_line", "{0}. {1}단계 · {2}:{3:00} · 쓰러짐 {4} · Lv.{5} · {6}"),
                i + 1, e.lv, e.sec / 60, e.sec % 60, e.deaths, e.heroLv, e.at);
        }
    }
}
