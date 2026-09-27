using System;

namespace Saga.Dungeon.Data
{
    /// <summary>
    /// PLAN.md 109-10-5 지역 우두머리 기록 — 웹 `save.dungeon.regionBoss = { 지역: { kills, firstAt, lastAt } }` 를 세이브 v13 한 칸으로
    /// (JsonUtility 가 사전을 못 써서 지역 키를 단 배열). 시각은 유닉스 초(UTC) — 웹 Date.now 처럼 실제 시각이라 끄고 켜도 10분은 흐른다.
    /// 진단은 <see cref="NowOverride"/> 로 시각을 넣는다.
    /// </summary>
    public static class RegionBossState
    {
        [Serializable]
        public struct Entry
        {
            public string key;
            public int kills;
            public long firstAt;
            public long lastAt;
        }

        private static readonly Entry[] Rows = Fresh();

        /// <summary>0 이상이면 이 값을 지금 시각(유닉스 초)으로 쓴다 — 진단 전용.</summary>
        public static long NowOverride = -1;
        public static long Now => NowOverride >= 0 ? NowOverride : DateTimeOffset.UtcNow.ToUnixTimeSeconds();

        public static event Action Changed;

        private static Entry[] Fresh()
        {
            var a = new Entry[DungeonWorldMap.All.Length];
            for (int i = 0; i < a.Length; i++) a[i] = new Entry { key = DungeonWorldMap.All[i].Key };
            return a;
        }

        public static Entry Get(int region) => Rows[region];
        public static int Kills(int region) => Rows[region].kills;

        /// <summary>쉬는 중이면 남은 초, 아니면 0.</summary>
        public static double RestLeft(int region)
        {
            var r = Rows[region];
            if (r.kills <= 0 || r.lastAt <= 0) return 0;
            double left = DungeonRegionFoes.RestSeconds - (Now - r.lastAt);
            return left > 0 ? left : 0;
        }

        public static bool IsResting(int region) => RestLeft(region) > 0;

        /// <summary>쓰러뜨림 — 첫 토벌이면 true.</summary>
        public static bool RecordKill(int region)
        {
            long now = Now;
            bool first = Rows[region].kills == 0;
            Rows[region].kills++;
            if (first) Rows[region].firstAt = now;
            Rows[region].lastAt = now;
            Changed?.Invoke();
            return first;
        }

        public static Entry[] Snapshot() => (Entry[])Rows.Clone();

        /// <summary>v12 이하 = null → 전부 0. 키로 맞추고(표 순서가 바뀌어도) 모르는 키는 버린다.</summary>
        public static void Restore(Entry[] saved)
        {
            var fresh = Fresh();
            Array.Copy(fresh, Rows, Rows.Length);
            if (saved != null)
                foreach (var e in saved)
                {
                    int i = DungeonWorldMap.IndexOf(e.key);
                    if (i < 0) continue;
                    Rows[i] = new Entry { key = e.key, kills = Math.Max(0, e.kills), firstAt = e.firstAt, lastAt = e.lastAt };
                }
            Changed?.Invoke();
        }
    }
}
