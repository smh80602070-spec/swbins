using System.Collections.Generic;

namespace Saga.Dungeon.Data
{
    /// <summary>
    /// 지워진 이름의 비석(웹 사가블로 `town.js` NAME_STONE_*, 정본 side_names_*, tasks U-0028) — 마을마다 하나. 밟으면 굴혈이 삼킨 이름 하나가 보이고
    /// 사관 묵향의 기록에 적힌다(마을마다 한 번 금). 이름은 가상 음절(실명 없음)이고 마을 id 해시로 정해 늘 같다 — 해시는 웹과 같은 식(h = h×33 ^ 글자, 32비트).
    /// 웹은 금 600 + 공적 8 을 따로 주지만 이 트랙엔 공적 칸이 없고 시나리오가 공적을 금으로 바꿔 주니(<see cref="DungeonRegionFoes.GoldPerMerit"/>) 같은 환산으로 한 번에 준다.
    /// 세이브: 마을 id → 이름(<c>nameStoneTowns/nameStoneNames</c>, 없는 세이브는 아직 못 찾은 것).
    /// </summary>
    public static class DungeonNameStones
    {
        public const int Gold = 600;
        public const int Merit = 8;
        public static int RewardGold => Gold + Merit * DungeonRegionFoes.GoldPerMerit;

        /// <summary>웹 `NAME_STONE_NAMES` 그대로 스물넷.</summary>
        public static readonly string[] Names =
        {
            "서하", "온유", "도윤", "해담", "가람", "이든", "나루", "다솜", "보리", "새롬", "아람", "우솔",
            "초록", "한결", "여울", "슬기", "미르", "별찬", "소담", "푸름", "하늬", "려온", "지안", "단비",
        };

        private static readonly List<string> _order = new List<string>();
        private static readonly Dictionary<string, string> _found = new Dictionary<string, string>();

        public static string NameOf(string townId)
        {
            uint h = 5381;
            foreach (char c in townId ?? "") h = unchecked(h * 33u) ^ c;
            return Names[(int)(h % (uint)Names.Length)];
        }

        public static bool IsFound(string townId) => townId != null && _found.ContainsKey(townId);
        public static int Count => _found.Count;
        public static string FoundName(string townId) => IsFound(townId) ? _found[townId] : null;

        /// <summary>비석을 밟았다 — 처음이면 기록하고 금을 주며 true, 이미 적었으면 이름만 돌려주고 false.</summary>
        public static bool Claim(string townId, out string name)
        {
            name = NameOf(townId);
            if (string.IsNullOrEmpty(townId) || _found.ContainsKey(townId)) return false;
            _found[townId] = name;
            _order.Add(townId);
            HeroState.AddGold(RewardGold);
            return true;
        }

        public static void Snapshot(out string[] towns, out string[] names)
        {
            towns = _order.ToArray();
            names = new string[towns.Length];
            for (int i = 0; i < towns.Length; i++) names[i] = _found[towns[i]];
        }

        /// <summary>불러오기 — 없으면(옛 세이브) 전부 못 찾은 것. 이름이 비면 마을 id 로 다시 정한다(해시는 늘 같다).</summary>
        public static void Restore(string[] towns, string[] names)
        {
            _order.Clear();
            _found.Clear();
            if (towns == null) return;
            for (int i = 0; i < towns.Length; i++)
            {
                if (string.IsNullOrEmpty(towns[i]) || _found.ContainsKey(towns[i])) continue;
                _order.Add(towns[i]);
                _found[towns[i]] = names != null && i < names.Length && !string.IsNullOrEmpty(names[i]) ? names[i] : NameOf(towns[i]);
            }
        }

        public static void ResetForTest() => Restore(null, null);
    }
}
