using System;
using System.Collections.Generic;
using UnityEngine;

namespace Saga.Dungeon.Data
{
    /// <summary>
    /// U-0126 전리품 거르기(웹 W-0287 `loot-filter.js`) — 규칙 목록으로 떨어진 무기 표식을 보이기·숨기기·빛기둥.
    /// 위에서부터 **처음 맞는 규칙**의 동작, 아무 규칙도 안 맞으면 보이기. 대상은 무기 떨굼만 — 금·보석(재료)은 늘 보인다.
    /// 보상은 `DungeonEnemy.Die()` 가 이미 다 주고 표식은 잔향뿐이라, 숨기기 = 표식·빛기둥을 안 세움(통계·도감·장착은 그대로).
    ///
    /// 웹 조건 넷을 이 트랙에 맞췄다:
    /// - 등급 — 웹 다섯 이름(상품·양품·명품·보물·전설)에 `ItemData.Grade` 0·1·2 → 0·2·3, 명소 무기(wp_lm_) → 4.
    ///   웹 "상품 숨기기" 빠른 추가는 minTier 0(= 전부)이라 다 숨겨졌다 — 여기선 maxTier(이하) 조건을 따로 둬 바로잡았다.
    /// - 부위 — 이 트랙 떨굼은 무기뿐이라 "무기" 하나.
    /// - 원소 — 이 트랙 무기엔 원소가 없어 비전(`Secret`, 명소 무기)으로.
    /// - 내 직업 무기 — 직업이 없어 "지금보다 센 무기"(떨어질 때 바로 갖춘 것)로.
    /// 기본 셋은 전설·보물 빛기둥 둘 — 웹 셋째 "내 직업 무기 빛기둥" 은 이 트랙에선 떨어지자마자 갖추는 무기 거의 전부라
    /// 보통 무기에도 기둥이 서(109-10 "명품 이상만 기둥" 이 깨짐) 빠른 추가로만 둔다.
    /// 저장은 PlayerPrefs 한 키(JSON), 없으면 기본 셋. 4층 밑으로 처음 내려가면 숨기기를 한 번 권한다.
    /// </summary>
    public static class LootFilter
    {
        public enum Act { Show, Hide, Beam }

        [Serializable]
        public class Rule
        {
            public int minTier = -1;   // 이상(−1 = 안 봄)
            public int maxTier = -1;   // 이하
            public bool weapon;        // 부위 무기
            public int lore = -1;      // 비전(Secret 값)
            public bool better;        // 지금보다 센 무기
            public Act act;
            public bool off;

            public Rule Clone() => (Rule)MemberwiseClone();
        }

        [Serializable]
        private class Store { public List<Rule> rules = new List<Rule>(); }

        public const int MaxRules = 12, HintFloor = 4;
        private const string PrefKey = "saga_dungeon_loot_filter", HintKey = "saga_dungeon_loot_hinted";
        private static readonly string[] TierKo = { "상품", "양품", "명품", "보물", "전설" };
        private static List<Rule> _rules;

        public static List<Rule> Defaults() => new List<Rule>
        {
            new Rule { minTier = 4, act = Act.Beam },
            new Rule { minTier = 3, act = Act.Beam },
        };

        public static IReadOnlyList<Rule> Rules => Load();

        private static List<Rule> Load()
        {
            if (_rules != null) return _rules;
            string json = PlayerPrefs.GetString(PrefKey, "");
            Store s = null;
            if (!string.IsNullOrEmpty(json)) { try { s = JsonUtility.FromJson<Store>(json); } catch (ArgumentException) { s = null; } }
            _rules = s != null && s.rules != null ? s.rules : Defaults();
            return _rules;
        }

        private static void Save()
        {
            PlayerPrefs.SetString(PrefKey, JsonUtility.ToJson(new Store { rules = Load() }));
            PlayerPrefs.Save();
        }

        /// <summary>진단 — 저장된 걸 다시 읽게 캐시를 비운다(저장 왕복).</summary>
        public static void Reload() => _rules = null;

        // ---- 물건 성질 ----

        public static int TierOf(ItemData item)
        {
            if (item == null) return 0;
            if (item.WebTier >= 0) return item.WebTier; // tasks U-0245 굴린 무기는 웹 등급 그대로
            if (item.Id.StartsWith("wp_lm_")) return 4;
            return item.Grade >= 2 ? 3 : item.Grade == 1 ? 2 : 0;
        }

        public static bool Matches(Rule r, ItemData item, bool better)
        {
            int t = TierOf(item);
            if (r.minTier >= 0 && t < r.minTier) return false;
            if (r.maxTier >= 0 && t > r.maxTier) return false;
            if (r.lore >= 0 && (int)item.Lore != r.lore) return false;
            if (r.better && !better) return false;
            return true; // 부위 = 무기 — 이 트랙 떨굼은 다 무기
        }

        /// <summary>떨굼 하나의 판정. item 이 없으면(금·보석만) 늘 보이기. better = 떨어질 때 바로 갖춘 무기.</summary>
        public static Act Decide(ItemData item, bool better) => Decide(item, better, Load());

        public static Act Decide(ItemData item, bool better, IReadOnlyList<Rule> rules)
        {
            if (item == null || rules == null) return Act.Show;
            foreach (var r in rules)
            {
                if (r == null || r.off) continue;
                if (Matches(r, item, better)) return r.act;
            }
            return Act.Show;
        }

        // ---- 규칙 손질 ----

        public static bool Add(Rule r)
        {
            var rs = Load();
            if (r == null || rs.Count >= MaxRules) return false;
            rs.Insert(0, r);
            Save();
            return true;
        }

        public static bool Remove(int i) { var rs = Load(); if (i < 0 || i >= rs.Count) return false; rs.RemoveAt(i); Save(); return true; }

        public static bool Move(int i, int d)
        {
            var rs = Load(); int j = i + d;
            if (i < 0 || i >= rs.Count || j < 0 || j >= rs.Count) return false;
            (rs[i], rs[j]) = (rs[j], rs[i]);
            Save();
            return true;
        }

        public static bool Toggle(int i) { var rs = Load(); if (i < 0 || i >= rs.Count) return false; rs[i].off = !rs[i].off; Save(); return true; }

        public static bool CycleAct(int i)
        {
            var rs = Load(); if (i < 0 || i >= rs.Count) return false;
            rs[i].act = (Act)(((int)rs[i].act + 1) % 3);
            Save();
            return true;
        }

        public static void ResetToDefaults() { _rules = Defaults(); Save(); }

        /// <summary>빠른 추가 넷 — 0 상품 숨기기 · 1 양품 이하 숨기기 · 2 센 무기 빛기둥 · 3 명품 이상 빛기둥.</summary>
        public static bool AddPreset(int p)
        {
            switch (p)
            {
                case 0: return Add(new Rule { maxTier = 0, act = Act.Hide });
                case 1: return Add(new Rule { maxTier = 1, act = Act.Hide });
                case 2: return Add(new Rule { weapon = true, better = true, act = Act.Beam });
                case 3: return Add(new Rule { minTier = 2, act = Act.Beam });
            }
            return false;
        }

        // ---- 추천(4층 밑으로 처음) ----

        public static bool Hinted => PlayerPrefs.GetInt(HintKey, 0) != 0;

        /// <summary>권할 때면 글을, 아니면 null(한 번만).</summary>
        public static string HintIfDeep(int floor)
        {
            if (floor < HintFloor || Hinted) return null;
            PlayerPrefs.SetInt(HintKey, 1);
            PlayerPrefs.Save();
            return DungeonLocalization.T("lootf.hint", "🧹 바닥이 어지러우면 설정 › 거르기에서 \"상품 숨기기\" 를 켜 보세요");
        }

        /// <summary>진단 — 저장 키 둘을 지우고 기본 셋으로.</summary>
        public static void ResetForTest()
        {
            PlayerPrefs.DeleteKey(PrefKey);
            PlayerPrefs.DeleteKey(HintKey);
            _rules = null;
        }

        // ---- 글 ----

        public static string TierName(int t) => t >= 0 && t < TierKo.Length ? DungeonLocalization.T("lootf.tier." + t, TierKo[t]) : t.ToString();

        public static string ActName(Act a) => a == Act.Hide ? DungeonLocalization.T("lootf.act.hide", "숨기기")
            : a == Act.Beam ? DungeonLocalization.T("lootf.act.beam", "빛기둥") : DungeonLocalization.T("lootf.act.show", "보이기");

        public static string Describe(Rule r)
        {
            var parts = new List<string>();
            if (r.minTier >= 0) parts.Add(string.Format(DungeonLocalization.T("lootf.min", "{0} 이상"), TierName(r.minTier)));
            if (r.maxTier >= 0) parts.Add(string.Format(DungeonLocalization.T("lootf.max", "{0} 이하"), TierName(r.maxTier)));
            if (r.weapon) parts.Add(DungeonLocalization.T("lootf.weapon", "무기"));
            if (r.lore >= 0) parts.Add(string.Format(DungeonLocalization.T("lootf.lore", "비전 {0}"), SecretState.Name((Secret)r.lore)));
            if (r.better) parts.Add(DungeonLocalization.T("lootf.better", "지금보다 센"));
            return parts.Count > 0 ? string.Join(" · ", parts) : DungeonLocalization.T("lootf.any", "모든 물건");
        }
    }
}
