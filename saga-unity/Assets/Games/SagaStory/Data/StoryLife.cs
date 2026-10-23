using System;
using UnityEngine;

namespace Saga.Story.Data
{
    /// <summary>
    /// tasks U-0133 생활 기술 등급(웹 W-0283 `life.js` — 고돗 G-0238 처럼 채집만) — 이 판엔 채집·가방·돈이 없어(`StoryDiscovery` 주석)
    /// 들판 채집터(`World/StoryGatherNode`)와 재료 셈 하나를 두고: 캘 때마다 경험 +1, 아홉 단계 F·E·D·C·B·A·3·2·1(필요 20·40·60·90·120·160·200·250 = 940),
    /// 덤 하나 확률 = 단계/8(1급은 늘). 단계가 오르면 토스트 한 줄. 요리·연주는 재료를 쓸 곳이 없어 뒤로 — 저장 꼴만 칸을 남긴다.
    /// </summary>
    public static class StoryLife
    {
        public static readonly string[] Ranks = { "F", "E", "D", "C", "B", "A", "3", "2", "1" };
        public static readonly int[] Need = { 20, 40, 60, 90, 120, 160, 200, 250 }; // 단계 i → i+1(누적 940)

        [Serializable]
        private class Store
        {
            public int gatherXp;
            public int mats;
            public int cookXp; // 요리·연주 자리(웹 cook·play) — 아직 안 쓴다
            public int playXp;
        }

        private static Store _s = new Store();

        public static int GatherXp => _s.gatherXp;
        public static int Mats => _s.mats;
        public static int TotalNeed { get { int n = 0; foreach (int v in Need) n += v; return n; } }

        public static event Action Changed;

        /// <summary>경험으로 단계 번호 0(F)~8(1).</summary>
        public static int RankIdx(int xp)
        {
            int i = 0;
            while (i < Need.Length && xp >= Need[i]) { xp -= Need[i]; i++; }
            return i;
        }

        public static int GatherRank => RankIdx(_s.gatherXp);
        public static string GatherRankName => Ranks[GatherRank];

        /// <summary>지금 단계 안에서 쌓은 경험·다음 단계까지 필요(끝이면 0).</summary>
        public static void Progress(out int xpIn, out int need)
        {
            int xp = _s.gatherXp, i = 0;
            while (i < Need.Length && xp >= Need[i]) { xp -= Need[i]; i++; }
            xpIn = xp;
            need = i < Need.Length ? Need[i] : 0;
        }

        /// <summary>덤 하나 나올 확률 — 단계/8(F 는 0, 1급은 1).</summary>
        public static float ExtraChance => GatherRank / 8f;

        /// <summary>한 번 캔다 — 재료 +1(+덤), 경험 +1. 돌려주는 값 = 얻은 재료 수. 단계가 올랐으면 rankUp 에 새 단계 이름.</summary>
        public static int Gather(System.Random rng, out string rankUp)
        {
            int before = GatherRank;
            int n = 1 + (rng.NextDouble() < ExtraChance + StoryGuild.MatsChance ? 1 : 0); // tasks U-0192 상단 덤(문파 없으면 +0)
            _s.mats += n;
            _s.gatherXp++;
            int after = GatherRank;
            rankUp = after > before ? Ranks[after] : null;
            Changed?.Invoke();
            return n;
        }

        public static string RankUpLine(string rank) =>
            string.Format(StoryLocalization.T("life.rankup", "🌿 채집 등급 {0} — 덤 하나 나올 확률 {1:0}%"), rank, ExtraChance * 100f);

        public static string HudLine()
        {
            Progress(out int xpIn, out int need);
            string prog = need > 0 ? $"{xpIn}/{need}" : StoryLocalization.T("life.max", "끝");
            return string.Format(StoryLocalization.T("life.hud", "🌿 {0} {1} · 재료 {2}"), GatherRankName, prog, _s.mats);
        }

        // ---- 저장 ----

        public static string Snapshot() => JsonUtility.ToJson(_s);

        public static void Restore(string json)
        {
            Store s = null;
            if (!string.IsNullOrEmpty(json)) { try { s = JsonUtility.FromJson<Store>(json); } catch (ArgumentException) { s = null; } }
            _s = s ?? new Store();
            _s.gatherXp = Math.Max(0, _s.gatherXp);
            _s.mats = Math.Max(0, _s.mats);
            Changed?.Invoke();
        }

        /// <summary>진단 — 경험을 바로 정한다.</summary>
        public static void SetXpForTest(int xp)
        {
            _s.gatherXp = Math.Max(0, xp);
            Changed?.Invoke();
        }
    }
}
