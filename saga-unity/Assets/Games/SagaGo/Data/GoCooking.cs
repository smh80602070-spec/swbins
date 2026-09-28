using System.Collections.Generic;
using UnityEngine;

namespace Saga.Go.Data
{
    /// <summary>
    /// PLAN.md 109-14-6 "채집·요리"(웹 사가고 ⑲-6 `cooking.js` · saga-godot 106 ⑱) — 표·자리·판정만 모은 순수 정적 클래스.
    /// 채집 — 지역 일곱마다 **고정** 무리: 일반 넷(웹 바이옴 표 앞 넷) + 특산 둘(마을은 하나). 무리마다 일반 2~3·특산 2 포기, 둘레 2.6m 고리.
    /// 지역 → 웹 바이옴: 마을 home · 서쪽 숲길·동쪽 숲 bamboo · 북쪽 산기슭 ruins · 너른 강 marsh(둑) · 남쪽 공터 plain · 끝 논밭 canyon.
    /// 2.8m 안에 들면 저절로 줍고, 다시 자라기 일반 30분·특산 1시간(실제 시각). 짐승 고기는 14-1b 짐승(바위곰)이 오기 전까지 산적이 떨군다.
    /// 솥 — 역참 다섯마다 곁 6.5m 에 가마솥, 7.4m 안에서만 조리. 요리 여덟 × 품질 셋 — 바늘이 1.6초에 한 번 오가고 요리마다 맛있는 칸이 다르다.
    /// 다섯 번 하면 자동 조리(보통). 회복 셋(한 사람·명단·되살리기, 포만감 35 · 최대 100 · 초당 −1) · 버프 다섯(공격·방어·모험 계열, 명단 전체 300초, 계열마다 하나).
    /// 수치는 웹 그대로, 거리 × 1.85(GO 사람 키), 고정 공격 × 0.75 · 고정 방어 × 0.6 · 고정 회복 × 0.4(보패와 같은 비). 웹의 승급 특산물(인물 승급)·눈꽃(서리봉 고원)은 이 트랙에 없어 뺐다.
    /// </summary>
    public static class GoCooking
    {
        public enum Kind { Common, Special, Drop }

        public struct Item
        {
            public string Id, NameKo;
            public Kind Kind;
            public Color Color;
            public string Name => GoLocalization.T("cook.item." + Id, NameKo);
        }

        public static readonly Item[] Items =
        {
            new Item { Id = "mint", NameKo = "박하", Kind = Kind.Common, Color = new Color(0.36f, 0.78f, 0.42f) },
            new Item { Id = "honey_flower", NameKo = "꿀꽃", Kind = Kind.Common, Color = new Color(0.98f, 0.78f, 0.25f) },
            new Item { Id = "apple", NameKo = "산사과", Kind = Kind.Common, Color = new Color(0.86f, 0.2f, 0.18f) },
            new Item { Id = "mushroom", NameKo = "송이버섯", Kind = Kind.Common, Color = new Color(0.62f, 0.42f, 0.26f) },
            new Item { Id = "clam", NameKo = "바지락", Kind = Kind.Common, Color = new Color(0.86f, 0.8f, 0.66f) },
            new Item { Id = "orchid", NameKo = "청하란", Kind = Kind.Special, Color = new Color(0.72f, 0.86f, 1f) },
            new Item { Id = "conch", NameKo = "갯소라", Kind = Kind.Special, Color = new Color(1f, 0.62f, 0.52f) },
            new Item { Id = "ash_flower", NameKo = "재꽃", Kind = Kind.Special, Color = new Color(0.8f, 0.74f, 0.9f) },
            new Item { Id = "meat", NameKo = "짐승 고기", Kind = Kind.Drop, Color = new Color(0.7f, 0.3f, 0.25f) },
        };

        public static bool TryItem(string id, out Item it)
        {
            foreach (var x in Items) if (x.Id == id) { it = x; return true; }
            it = default;
            return false;
        }

        public static string ItemName(string id) => TryItem(id, out var it) ? it.Name : id;

        /// <summary>지역 → 웹 바이옴.</summary>
        public static string BiomeOf(string region) => region switch
        {
            "village" => "home",
            "west_wood" => "bamboo",
            "east_grove" => "bamboo",
            "north_foot" => "ruins",
            "river" => "marsh",
            "south_glade" => "plain",
            _ => "canyon",
        };

        private static readonly Dictionary<string, string> SpecialOf = new Dictionary<string, string>
        {
            { "home", "orchid" }, { "plain", "orchid" }, { "bamboo", "orchid" }, { "marsh", "conch" }, { "canyon", "ash_flower" }, { "ruins", "ash_flower" },
        };

        private static readonly Dictionary<string, string[]> CommonOf = new Dictionary<string, string[]>
        {
            { "home", new[] { "mint", "honey_flower", "apple", "mushroom", "clam", "apple" } },
            { "plain", new[] { "honey_flower", "mint", "apple", "honey_flower", "mint", "mushroom" } },
            { "bamboo", new[] { "mushroom", "mushroom", "mint", "apple", "honey_flower", "mint" } },
            { "canyon", new[] { "apple", "apple", "mushroom", "honey_flower", "mint", "mushroom" } },
            { "marsh", new[] { "clam", "clam", "clam", "mint", "mushroom", "honey_flower" } },
            { "ruins", new[] { "mushroom", "apple", "honey_flower", "mint", "mushroom", "apple" } },
        };

        public const int CommonPatches = 4;
        public const long RespawnCommonSec = 1800, RespawnSpecialSec = 3600;
        public const float PickRadius = 2.8f;       // 웹 1.5m
        public const float PickHeight = 3f;
        public const float Ring = 2.6f;             // 웹 1.4m
        public const float PatchSpread = 14f;       // 칸 가운데에서 ±(48m 칸)
        public const float BankOffset = 17f;        // 강 둑 칸 → 물가 쪽(칸 가장자리 24m)
        public const float PotOffset = 6.5f;        // 웹 3.5m
        public const float PotRadius = 7.4f;        // 웹 4m

        // ---- 요리 ----
        public const int ProfMax = 5, FullMax = 100, FullPerDish = 35;
        public const float BuffSec = 300f, FullDecayPerSec = 1f;
        public const float NeedleSec = 1.6f, PerfectHalf = 0.07f, NormalHalf = 0.2f;
        public const float AtkScale = 0.75f, DefScale = 0.6f, HealScale = 0.4f;

        public enum Effect { Heal, HealAll, Revive, Buff }
        public enum Cat { Attack, Defense, Adventure }

        public struct Recipe
        {
            public string Id, NameKo;
            public Effect Effect;
            public float[] Ratio;       // 회복 비율(품질 셋)
            public float[] Flat;        // 한 사람 회복 고정(웹 값 — × HealScale)
            public Cat Cat;
            public string Stat;         // atk · def · crit_rate · crit_dmg · stamina_save
            public float[] Value;       // 버프 값(웹 값 — 고정 공격·방어는 × 이 트랙 크기)
            public (string item, int n)[] Ing;
            public float Zone;          // 맛있는 칸 가운데(0~1)
            public string Name => GoLocalization.T("cook.recipe." + Id, NameKo);
        }

        public static readonly Recipe[] Recipes =
        {
            new Recipe { Id = "honey_cake", NameKo = "꿀꽃 떡", Effect = Effect.Heal, Ratio = new[] { 0.14f, 0.2f, 0.26f }, Flat = new[] { 40f, 60f, 80f }, Ing = new[] { ("honey_flower", 2), ("apple", 1) }, Zone = 0.62f },
            new Recipe { Id = "mush_skewer", NameKo = "버섯 꼬치", Effect = Effect.HealAll, Ratio = new[] { 0.06f, 0.09f, 0.12f }, Ing = new[] { ("mushroom", 2), ("mint", 1) }, Zone = 0.45f },
            new Recipe { Id = "meat_stew", NameKo = "고기 찜", Effect = Effect.Revive, Ratio = new[] { 0.1f, 0.15f, 0.2f }, Ing = new[] { ("meat", 2), ("apple", 1) }, Zone = 0.7f },
            new Recipe { Id = "mint_stirfry", NameKo = "박하 고기볶음", Effect = Effect.Buff, Cat = Cat.Attack, Stat = "atk", Value = new[] { 12f, 18f, 24f }, Ing = new[] { ("meat", 1), ("mint", 2) }, Zone = 0.55f },
            new Recipe { Id = "orchid_tea", NameKo = "청하란 차", Effect = Effect.Buff, Cat = Cat.Attack, Stat = "crit_rate", Value = new[] { 0.05f, 0.08f, 0.1f }, Ing = new[] { ("orchid", 1), ("honey_flower", 2) }, Zone = 0.38f },
            new Recipe { Id = "ash_pancake", NameKo = "재꽃 버섯전", Effect = Effect.Buff, Cat = Cat.Attack, Stat = "crit_dmg", Value = new[] { 0.1f, 0.15f, 0.2f }, Ing = new[] { ("ash_flower", 1), ("mushroom", 2) }, Zone = 0.5f },
            new Recipe { Id = "clam_soup", NameKo = "바지락탕", Effect = Effect.Buff, Cat = Cat.Defense, Stat = "def", Value = new[] { 10f, 15f, 20f }, Ing = new[] { ("clam", 2), ("mint", 1) }, Zone = 0.66f },
            new Recipe { Id = "conch_grill", NameKo = "갯소라 구이", Effect = Effect.Buff, Cat = Cat.Adventure, Stat = "stamina_save", Value = new[] { 0.12f, 0.18f, 0.24f }, Ing = new[] { ("conch", 1), ("clam", 1) }, Zone = 0.42f },
        };

        public static int RecipeIndex(string id)
        {
            for (int i = 0; i < Recipes.Length; i++) if (Recipes[i].Id == id) return i;
            return -1;
        }

        public static string QualityName(int q) => Mathf.Clamp(q, 0, 2) switch
        {
            0 => GoLocalization.T("cook.q0", "이상한"),
            1 => GoLocalization.T("cook.q1", "보통"),
            _ => GoLocalization.T("cook.q2", "맛있는"),
        };

        public static string DishId(string recipe, int q) => "dish_" + recipe + "_" + Mathf.Clamp(q, 0, 2);
        public static string DishName(string recipe, int q) => QualityName(q) + " " + Recipes[RecipeIndex(recipe)].Name;

        public static string CatName(Cat c) => c switch
        {
            Cat.Attack => GoLocalization.T("cook.cat.attack", "공격"),
            Cat.Defense => GoLocalization.T("cook.cat.defense", "방어"),
            _ => GoLocalization.T("cook.cat.adventure", "모험"),
        };

        public static string StatName(string stat) => stat switch
        {
            "atk" => GoLocalization.T("artifact.stat.atk", "공격력"),
            "def" => GoLocalization.T("artifact.stat.def", "방어력"),
            "crit_rate" => GoLocalization.T("weapon.stat.crit_rate", "치명타 확률"),
            "crit_dmg" => GoLocalization.T("weapon.stat.crit_dmg", "치명타 피해"),
            _ => GoLocalization.T("cook.stat.stamina_save", "스태미나 소모 감소"),
        };

        /// <summary>버프가 들판에 타는 값(고정 공격·방어는 이 트랙 크기).</summary>
        public static float BuffValue(Recipe r, int q)
        {
            float v = r.Value[Mathf.Clamp(q, 0, 2)];
            return r.Stat == "atk" ? v * AtkScale : r.Stat == "def" ? v * DefScale : v;
        }

        public static float HealFlat(Recipe r, int q) => r.Flat != null ? r.Flat[Mathf.Clamp(q, 0, 2)] * HealScale : 0f;

        public static string EffectText(Recipe r, int q)
        {
            q = Mathf.Clamp(q, 0, 2);
            switch (r.Effect)
            {
                case Effect.Heal: return string.Format(GoLocalization.T("cook.eff.heal", "한 사람 체력 {0}%+{1} 회복"), Mathf.RoundToInt(r.Ratio[q] * 100f), Mathf.RoundToInt(HealFlat(r, q)));
                case Effect.HealAll: return string.Format(GoLocalization.T("cook.eff.heal_all", "명단 모두 체력 {0}% 회복"), Mathf.RoundToInt(r.Ratio[q] * 100f));
                case Effect.Revive: return string.Format(GoLocalization.T("cook.eff.revive", "쓰러진 사람을 체력 {0}% 로"), Mathf.RoundToInt(r.Ratio[q] * 100f));
            }
            float v = BuffValue(r, q);
            string val = v < 1f ? $"{Mathf.RoundToInt(v * 100f)}%" : $"{v:0.#}";
            return string.Format(GoLocalization.T("cook.eff.buff", "{0} · 명단 {1} +{2} · {3}초"), CatName(r.Cat), StatName(r.Stat), val, Mathf.RoundToInt(BuffSec));
        }

        /// <summary>바늘 자리(0~1, 0→1→0 왕복 — 웹 `needleAt`).</summary>
        public static float NeedleAt(float t)
        {
            float p = ((t % NeedleSec) + NeedleSec) % NeedleSec / NeedleSec * 2f;
            return p <= 1f ? p : 2f - p;
        }

        public static int QualityAt(Recipe r, float needle)
        {
            float d = Mathf.Abs(needle - r.Zone);
            return d <= PerfectHalf ? 2 : d <= NormalHalf ? 1 : 0;
        }

        // ---- 채집 자리(순수 — 지역 id·무리 번호 해시로 늘 같다) ----

        public struct Node
        {
            public string Id;       // "ck_<지역>_<무리>_<포기>"
            public string Item;
            public string RegionId;
            public bool Special;
            public Vector3 Pos;     // 표 땅 높이(월드에선 `CookField` 가 땅에 맞춰 앉힌다)
        }

        private static Node[] _nodes;

        public static Node[] Nodes
        {
            get
            {
                if (_nodes != null) return _nodes;
                var list = new List<Node>();
                foreach (var r in GoWorldMap.Regions) PlaceRegion(r.Id, list);
                _nodes = list.ToArray();
                return _nodes;
            }
        }

        public static bool TryNode(string id, out Node n)
        {
            foreach (var x in Nodes) if (x.Id == id) { n = x; return true; }
            n = default;
            return false;
        }

        private static bool Land(char ch) => ch == '.' || ch == '=' || ch == 'F' || ch == 'T';

        /// <summary>무리가 설 칸(과 칸 안에서 미는 쪽) — 강은 둑(강에 닿은 뭍 칸, 물가 쪽으로 밀어서).</summary>
        private static List<(Vector2Int t, Vector3 push)> Tiles(string region)
        {
            var l = new List<(Vector2Int, Vector3)>();
            for (int y = 0; y < TestMapData.RowCount; y++)
                for (int x = 0; x < TestMapData.Cols; x++)
                {
                    if (!Land(TestMapData.TileAt(x, y))) continue;
                    if (region == "river")
                    {
                        if (y + 1 < TestMapData.RowCount && TestMapData.TileAt(x, y + 1) == '~') l.Add((new Vector2Int(x, y), Vector3.forward * BankOffset));
                        else if (y > 0 && TestMapData.TileAt(x, y - 1) == '~') l.Add((new Vector2Int(x, y), Vector3.back * BankOffset));
                    }
                    else if (GoWorldMap.RegionAt(x, y) == region) l.Add((new Vector2Int(x, y), Vector3.zero));
                }
            return l;
        }

        private static void PlaceRegion(string region, List<Node> list)
        {
            var tiles = Tiles(region);
            if (tiles.Count == 0) return;
            string bio = BiomeOf(region);
            var items = new List<string>();
            for (int i = 0; i < CommonPatches; i++) items.Add(CommonOf[bio][i]);
            for (int i = 0; i < (bio == "home" ? 1 : 2); i++) items.Add(SpecialOf[bio]);
            for (int n = 0; n < items.Count; n++)
            {
                string item = items[n];
                bool special = TryItem(item, out var it) && it.Kind == Kind.Special;
                uint h = Hash(region + ":ck:" + n);
                var (t, push) = tiles[(int)(h % (uint)tiles.Count)];
                float ox = ((h >> 8) % 1000u / 999f * 2f - 1f) * PatchSpread;
                float oz = ((h >> 18) % 1000u / 999f * 2f - 1f) * PatchSpread;
                if (push != Vector3.zero) oz = push.z + ((h >> 18) % 1000u / 999f * 2f - 1f) * 3f; // 둑은 물가에 붙여서
                Vector3 c = TestMapData.WorldPos(t.x, t.y) + new Vector3(ox, TestMapData.GroundHeight(t.x, t.y), oz);
                int cnt = special ? 2 : 2 + ((h >> 28) % 2u == 0u ? 1 : 0);
                for (int k = 0; k < cnt; k++)
                {
                    float a = Mathf.PI * 2f * k / cnt + 0.6f;
                    list.Add(new Node
                    {
                        Id = $"ck_{region}_{n}_{k}", Item = item, RegionId = region, Special = special,
                        Pos = c + new Vector3(Mathf.Cos(a), 0f, Mathf.Sin(a)) * Ring,
                    });
                }
            }
        }

        /// <summary>발 자리에서 그 포기에 손이 닿는가(수평 2.8m · 높이 ±3m).</summary>
        public static bool CanReach(Vector3 node, Vector3 feet)
        {
            Vector3 d = node - feet;
            float dy = d.y;
            d.y = 0f;
            return d.magnitude <= PickRadius && Mathf.Abs(dy) <= PickHeight;
        }

        /// <summary>역참 다섯 곁 솥 자리(표 땅 높이).</summary>
        public static Vector3 PotPos(GoWorldMap.Waypoint w) => GoWorldMap.WaypointPos(w) + Vector3.right * PotOffset;

        private static uint Hash(string s)
        {
            uint h = 2166136261;
            foreach (char c in s) { h ^= c; h *= 16777619; }
            return h;
        }
    }

    /// <summary>109-14-6 재료·요리 가방·숙련·채집 시각(세이브 v23) + 버프·포만감(이번 판만 — 웹·Godot 와 같다).</summary>
    public static class CookState
    {
        private static readonly Dictionary<string, int> _bag = new Dictionary<string, int>();
        private static readonly Dictionary<string, int> _prof = new Dictionary<string, int>();
        private static readonly Dictionary<string, long> _gather = new Dictionary<string, long>();
        private static readonly Dictionary<GoCooking.Cat, (int recipe, int q, float left)> _buffs = new Dictionary<GoCooking.Cat, (int, int, float)>();
        private static readonly Dictionary<string, float> _full = new Dictionary<string, float>();
        public static event System.Action Changed;
        /// <summary>109-14-13 이야기 임무 — 주웠다(재료 id) · 조리했다(요리 id).</summary>
        public static event System.Action<string> Picked, Cooked;

        /// <summary>진단 — 실제 시각 대신(유닉스 초).</summary>
        public static long NowForTest = -1;
        public static long Now => NowForTest >= 0 ? NowForTest : System.DateTimeOffset.UtcNow.ToUnixTimeSeconds();

        private static void Touch() => Changed?.Invoke();

        public static int Count(string id) => _bag.TryGetValue(id, out int n) ? n : 0;

        public static void Add(string id, int n)
        {
            if (n <= 0) return;
            _bag[id] = Count(id) + n;
            Touch();
        }

        /// <summary>재료를 쓴다(109-14-24 낚시 미끼도 여기서 하나 쓴다) — 모자라면 아무것도 안 하고 false.</summary>
        public static bool Spend(string id, int n)
        {
            if (Count(id) < n) return false;
            _bag[id] -= n;
            if (_bag[id] <= 0) _bag.Remove(id);
            Touch();
            return true;
        }

        public static int Prof(string recipe) => _prof.TryGetValue(recipe, out int n) ? n : 0;
        public static bool CanAuto(string recipe) => Prof(recipe) >= GoCooking.ProfMax;

        public static bool Available(GoCooking.Node n)
        {
            if (!_gather.TryGetValue(n.Id, out long t)) return true;
            return Now - t >= (n.Special ? GoCooking.RespawnSpecialSec : GoCooking.RespawnCommonSec);
        }

        /// <summary>줍는다 — 다시 자라기 전이면 false.</summary>
        public static bool Pick(GoCooking.Node n)
        {
            if (!Available(n)) return false;
            _gather[n.Id] = Now;
            Add(n.Item, 1);
            DailyTaskState.ReportProgress(DailyTaskState.Kind.Gather, 1); // 109-14-8
            AchieveState.Bump("gather"); // 109-14-25 업적
            Picked?.Invoke(n.Item);
            return true;
        }

        /// <summary>다시 자란 기록은 지운다(세이브가 끝없이 안 커지게).</summary>
        public static void Prune()
        {
            var old = new List<string>();
            foreach (var kv in _gather) if (Now - kv.Value >= GoCooking.RespawnSpecialSec) old.Add(kv.Key);
            foreach (var k in old) _gather.Remove(k);
        }

        public static bool HasDish()
        {
            foreach (var kv in _bag) if (kv.Key.StartsWith("dish_") && kv.Value > 0) return true;
            return false;
        }

        /// <summary>조리할 수 있나 — 솥 거리는 부르는 쪽(`atPot`)이 넘긴다.</summary>
        public static bool CanCook(int ri, bool atPot, out string why)
        {
            why = null;
            if (ri < 0 || ri >= GoCooking.Recipes.Length) { why = GoLocalization.T("cook.why.none", "없는 요리"); return false; }
            if (!atPot) { why = GoLocalization.T("cook.why.pot", "역참 곁 솥에서만"); return false; }
            foreach (var (item, n) in GoCooking.Recipes[ri].Ing)
                if (Count(item) < n) { why = string.Format(GoLocalization.T("cook.why.lack", "{0} 부족"), GoCooking.ItemName(item)); return false; }
            return true;
        }

        /// <summary>조리 — 재료를 쓰고 그 품질 요리 하나. 요리 id(못 하면 null).</summary>
        public static string Cook(int ri, int q, bool atPot)
        {
            if (!CanCook(ri, atPot, out _)) return null;
            var r = GoCooking.Recipes[ri];
            foreach (var (item, n) in r.Ing) Spend(item, n);
            string id = GoCooking.DishId(r.Id, q);
            _bag[id] = Count(id) + 1;
            _prof[r.Id] = Mathf.Min(99, Prof(r.Id) + 1);
            Touch();
            DailyTaskState.ReportProgress(DailyTaskState.Kind.Cook, 1); // 109-14-8
            AchieveState.Bump("cook"); // 109-14-25 업적 — 맛있는(품질 2) 한 상은 따로
            if (q >= 2) AchieveState.Bump("tasty");
            Cooked?.Invoke(id);
            return id;
        }

        public static string AutoCook(int ri, bool atPot) =>
            ri >= 0 && ri < GoCooking.Recipes.Length && CanAuto(GoCooking.Recipes[ri].Id) ? Cook(ri, 1, atPot) : null;

        /// <summary>그 요리에서 가장 좋은 품질로 가진 것(없으면 −1).</summary>
        public static int BestDish(int ri)
        {
            for (int q = 2; q >= 0; q--) if (Count(GoCooking.DishId(GoCooking.Recipes[ri].Id, q)) > 0) return q;
            return -1;
        }

        public static float FullOf(string id) => id != null && _full.TryGetValue(id, out float f) ? f : 0f;

        /// <summary>회복 요리가 먹일 한 사람 — 쓰러짐 여부·체력·배부름은 부르는 쪽이 본다. 먹었다고 적는다.</summary>
        public static bool TryFeed(string id)
        {
            if (FullOf(id) + GoCooking.FullPerDish > GoCooking.FullMax) return false;
            _full[id] = FullOf(id) + GoCooking.FullPerDish;
            return true;
        }

        /// <summary>요리 하나를 쓴다(먹기가 성공한 뒤 부른다).</summary>
        public static bool UseDish(int ri, int q)
        {
            if (!Spend(GoCooking.DishId(GoCooking.Recipes[ri].Id, q), 1)) return false;
            Touch();
            return true;
        }

        /// <summary>버프를 건다 — 계열마다 하나(새로 먹으면 갈아 끼움).</summary>
        public static void SetBuff(int ri, int q)
        {
            _buffs[GoCooking.Recipes[ri].Cat] = (ri, Mathf.Clamp(q, 0, 2), GoCooking.BuffSec);
            Touch();
        }

        /// <summary>켜진 버프 몫 — stat → 값(이 트랙 크기).</summary>
        public static float Buff(string stat)
        {
            float v = 0f;
            foreach (var b in _buffs.Values)
            {
                var r = GoCooking.Recipes[b.recipe];
                if (r.Stat == stat) v += GoCooking.BuffValue(r, b.q);
            }
            return v;
        }

        /// <summary>스태미나 소모 배율(모험 계열).</summary>
        public static float StaminaMul => 1f - Buff("stamina_save");

        public static IEnumerable<(GoCooking.Cat cat, int recipe, int q, float left)> Buffs()
        {
            foreach (var kv in _buffs) yield return (kv.Key, kv.Value.recipe, kv.Value.q, kv.Value.left);
        }

        /// <summary>시간 흐름 — 끝난 버프 이름들을 돌려준다.</summary>
        public static List<string> Step(float dt)
        {
            var ended = new List<string>();
            foreach (var cat in new List<GoCooking.Cat>(_buffs.Keys))
            {
                var b = _buffs[cat];
                b.left -= dt;
                if (b.left <= 0f) { _buffs.Remove(cat); ended.Add(GoCooking.Recipes[b.recipe].Name); }
                else _buffs[cat] = b;
            }
            foreach (var id in new List<string>(_full.Keys))
            {
                _full[id] -= GoCooking.FullDecayPerSec * dt;
                if (_full[id] <= 0f) _full.Remove(id);
            }
            if (ended.Count > 0) Touch();
            return ended;
        }

        // ---- 세이브 ----
        [System.Serializable]
        public struct Entry { public string id; public int n; }
        [System.Serializable]
        public struct TimeEntry { public string id; public long t; }

        public static List<Entry> SnapshotBag() => Snap(_bag);
        public static List<Entry> SnapshotProf() => Snap(_prof);

        private static List<Entry> Snap(Dictionary<string, int> d)
        {
            var l = new List<Entry>();
            foreach (var kv in d) l.Add(new Entry { id = kv.Key, n = kv.Value });
            l.Sort((a, b) => string.CompareOrdinal(a.id, b.id));
            return l;
        }

        public static List<TimeEntry> SnapshotGather()
        {
            Prune();
            var l = new List<TimeEntry>();
            foreach (var kv in _gather) l.Add(new TimeEntry { id = kv.Key, t = kv.Value });
            l.Sort((a, b) => string.CompareOrdinal(a.id, b.id));
            return l;
        }

        public static void Restore(List<Entry> bag, List<Entry> prof, List<TimeEntry> gather)
        {
            _bag.Clear();
            _prof.Clear();
            _gather.Clear();
            if (bag != null) foreach (var e in bag) if (!string.IsNullOrEmpty(e.id) && e.n > 0) _bag[e.id] = e.n;
            if (prof != null) foreach (var e in prof) if (GoCooking.RecipeIndex(e.id) >= 0 && e.n > 0) _prof[e.id] = Mathf.Min(99, e.n);
            if (gather != null) foreach (var e in gather) if (!string.IsNullOrEmpty(e.id)) _gather[e.id] = e.t;
            Touch();
        }

        /// <summary>진단 — 가방·숙련·채집·버프·포만감 모두 비운다.</summary>
        public static void ResetForTest()
        {
            _buffs.Clear();
            _full.Clear();
            Restore(null, null, null);
        }

        /// <summary>진단 — 버프·포만감만 비운다(세이브 밖).</summary>
        public static void ClearSession()
        {
            _buffs.Clear();
            _full.Clear();
            Touch();
        }
    }
}
