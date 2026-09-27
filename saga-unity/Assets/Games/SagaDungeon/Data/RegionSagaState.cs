using System;

namespace Saga.Dungeon.Data
{
    /// <summary>
    /// PLAN.md 109-10-6 지역 사연 진행 — 웹 `save.quest.chain = { 지역: { step, have, done, at } }` · `chainAll` 을 세이브 v14 두 칸으로
    /// (JsonUtility 가 사전을 못 써서 지역 키를 단 배열, 열렸는지는 `opened`). 규칙·보상은 `World/RegionSagaRunner` — 여긴 기록만.
    /// </summary>
    public static class RegionSagaState
    {
        [Serializable]
        public struct Entry
        {
            public string key;
            public bool opened;
            public int step;   // 0 토벌 · 1 흔적 · 2 정예 · 3 우두머리
            public int have;
            public bool done;
            public long at;    // 연 시각(유닉스 초)
        }

        private static readonly Entry[] Rows = Fresh();
        public static bool AllDone { get; private set; }

        public static event Action Changed;

        private static Entry[] Fresh()
        {
            var a = new Entry[DungeonWorldMap.All.Length];
            for (int i = 0; i < a.Length; i++) a[i] = new Entry { key = DungeonWorldMap.All[i].Key };
            return a;
        }

        public static Entry Get(int r) => Rows[r];
        /// <summary>열렸고 아직 평정 전 — 그 걸음을 센다.</summary>
        public static bool Active(int r) => Rows[r].opened && !Rows[r].done;
        public static int Step(int r) => Rows[r].step;
        public static int Have(int r) => Rows[r].have;

        public static int DoneCount()
        {
            int n = 0;
            foreach (var e in Rows) if (e.done) n++;
            return n;
        }

        /// <summary>처음 들어섬 — 새로 열었으면 true.</summary>
        public static bool Open(int r)
        {
            if (Rows[r].opened) return false;
            Rows[r].opened = true;
            Rows[r].step = 0;
            Rows[r].have = 0;
            Rows[r].at = RegionBossState.Now;
            Changed?.Invoke();
            return true;
        }

        /// <summary>지금 걸음에 하나 더 — 채웠으면 true(걸음 넘김은 부르는 쪽).</summary>
        public static bool Add(int r, int need)
        {
            if (!Active(r)) return false;
            Rows[r].have = Math.Min(need, Rows[r].have + 1);
            Changed?.Invoke();
            return Rows[r].have >= need;
        }

        /// <summary>다음 걸음으로 — 넷째를 마치면 평정(true).</summary>
        public static bool Advance(int r)
        {
            if (!Active(r)) return false;
            Rows[r].have = 0;
            Rows[r].step++;
            if (Rows[r].step >= DungeonRegionSagas.Steps) { Rows[r].step = DungeonRegionSagas.Steps - 1; Rows[r].done = true; }
            Changed?.Invoke();
            return Rows[r].done;
        }

        /// <summary>아홉 다 평정 — 처음 한 번만 true.</summary>
        public static bool TryCompleteAll()
        {
            if (AllDone || DoneCount() < Rows.Length) return false;
            AllDone = true;
            Changed?.Invoke();
            return true;
        }

        public static Entry[] Snapshot() => (Entry[])Rows.Clone();

        /// <summary>v13 이하 = null/false → 전부 닫힘. 키로 맞추고 모르는 키는 버린다.</summary>
        public static void Restore(Entry[] saved, bool allDone)
        {
            Array.Copy(Fresh(), Rows, Rows.Length);
            if (saved != null)
                foreach (var e in saved)
                {
                    int i = DungeonWorldMap.IndexOf(e.key);
                    if (i < 0) continue;
                    Rows[i] = new Entry
                    {
                        key = e.key, opened = e.opened || e.done, done = e.done, at = e.at,
                        step = Math.Max(0, Math.Min(DungeonRegionSagas.Steps - 1, e.step)), have = Math.Max(0, e.have),
                    };
                }
            AllDone = allDone;
            Changed?.Invoke();
        }
    }
}
