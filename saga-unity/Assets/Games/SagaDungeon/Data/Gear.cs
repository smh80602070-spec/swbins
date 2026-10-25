using System;
using System.Collections.Generic;
using UnityEngine;

namespace Saga.Dungeon.Data
{
    // tasks U-0245 — 웹 2나락 장비 표의 꼴(표 자체는 tools/gen-dungeon-gear.mjs 가 GearTables.cs 로 뽑는다).
    public sealed class GearTier
    {
        public readonly int Key; public readonly string Name, Hanja, Color; public readonly float Mul, Weight; public readonly int Affix;
        public GearTier(int key, string name, string hanja, string color, float mul, int affix, float weight)
        { Key = key; Name = name; Hanja = hanja; Color = color; Mul = mul; Affix = affix; Weight = weight; }
    }

    public sealed class GearBase
    {
        public readonly string Key, Slot, Name, Main, Look; public readonly float Base;
        public GearBase(string key, string slot, string name, string main, float b, string look)
        { Key = key; Slot = slot; Name = name; Main = main; Base = b; Look = look; }
    }

    public sealed class GearAffix
    {
        public readonly string Key, Kind, Stat, Eff, Pre, Post, Label; public readonly float Lo, Hi;
        public GearAffix(string key, string kind, string stat, string eff, float lo, float hi, string pre, string post, string label)
        { Key = key; Kind = kind; Stat = stat; Eff = eff; Lo = lo; Hi = hi; Pre = pre; Post = post; Label = label; }
    }

    /// <summary>효과 한 줄 — kind flat·pct(stat might·wisdom·command·all) · world(eff atkPct 등) · eldmg·elres(el).</summary>
    public sealed class GearEff
    {
        public readonly string Kind, Stat, Eff, El; public readonly float V; public readonly bool Scale;
        public GearEff(string kind, string stat, string eff, string el, float v, bool scale)
        { Kind = kind; Stat = stat; Eff = eff; El = el; V = v; Scale = scale; }
        public GearEff With(float v) => new GearEff(Kind, Stat, Eff, El, v, Scale);
    }

    public sealed class GearSetSkill
    {
        public readonly string Name, Emoji, Shape, Eff, El, Desc; public readonly float V, R, Far, Sec, Cd, Spread, Kb; public readonly int Shots;
        public GearSetSkill(string name, string emoji, string shape, float v, float r, float far, float sec, float cd, int shots, float spread, float kb, string eff, string el, string desc)
        { Name = name; Emoji = emoji; Shape = shape; V = v; R = r; Far = far; Sec = sec; Cd = cd; Shots = shots; Spread = spread; Kb = kb; Eff = eff; El = el; Desc = desc; }
    }

    public sealed class GearSet
    {
        public readonly string Key, Name, Desc; public readonly string[] Pieces; public readonly GearEff[] Bonus2, Bonus3; public readonly GearSetSkill Skill;
        public GearSet(string key, string name, string[] pieces, string desc, GearEff[] b2, GearEff[] b3, GearSetSkill skill)
        { Key = key; Name = name; Pieces = pieces; Desc = desc; Bonus2 = b2; Bonus3 = b3; Skill = skill; }
    }

    public sealed class GearUnique
    {
        public readonly string Key, Base, Name, Desc; public readonly GearEff[] Eff;
        public GearUnique(string key, string b, string name, string desc, GearEff[] eff) { Key = key; Base = b; Name = name; Desc = desc; Eff = eff; }
    }

    public static partial class GearTables
    {
        public static GearBase Base(string key) { foreach (var b in Bases) if (b.Key == key) return b; return null; }
        public static GearAffix Affix(string key) { foreach (var a in Affixes) if (a.Key == key) return a; return null; }
        public static GearSet SetOfBase(string baseKey) { foreach (var s in Sets) foreach (var p in s.Pieces) if (p == baseKey) return s; return null; }
        public static GearSet Set(string key) { foreach (var s in Sets) if (s.Key == key) return s; return null; }
        public static GearUnique UniqueOfBase(string baseKey) { foreach (var u in Uniques) if (u.Base == baseKey) return u; return null; }
    }

    /// <summary>
    /// tasks U-0245 — 2나락 굴린 장비(웹 item.js `roll` 그대로: 바탕 + 등급 0~4 + 접사 0~4 · 보물(3)에서 세트 조각 · 전설(4)에서 고유).
    /// 이 트랙은 가방 없이 "더 센 것만 바로 갖춘다"(HeroState.EquipIfBetter)라, 굴린 물건은 **문자열 id 하나**로 산다 —
    /// `rx:&lt;바탕&gt;:&lt;등급&gt;:&lt;수준&gt;:&lt;씨앗&gt;[:s|:u]`. 접사는 씨앗에서 다시 굴려 같은 값(세이브엔 id 만).
    /// 무기는 옛 무기 칸(EquippedWeaponId·갑/을)에, 나머지 일곱 부위(갑주·투구·장갑·신·목걸이·부적·가락지)는 여기 <see cref="Slots"/>.
    /// 웹 능력치(무력·지력·통솔)는 이 트랙의 공격력·체력으로 옮긴다 — 아래 상수(웹 장수 셋 → 주인공 하나).
    /// </summary>
    public static class Gear
    {
        public const string Prefix = "rx:";
        public static readonly string[] SideSlots = { "armor", "helm", "glove", "boot", "neck", "charm", "ring" };

        // 웹 능력치 → 이 트랙. 무기의 주 능력치는 ItemData.AtkBonus 로 그대로(옛 무기 서열 12~51 과 같은 자리).
        private const float MightToAtk = 0.5f, WisdomToAtk = 0.35f, CommandToHp = 0.5f, ElDmgToAtk = 0.5f, ElResToGuard = 0.5f, GuardCap = 40f;

        /// <summary>떨굼 켜기(끄기 `SAGA_GEAR_DROPS=0` — 옛 고정 보상만).</summary>
        public static bool DropsOn = Environment.GetEnvironmentVariable("SAGA_GEAR_DROPS") != "0";
        public const float DropChance = 0.14f, EliteDropChance = 0.5f;

        public sealed class Item
        {
            public string Id; public GearBase Base; public GearTier Tier; public int Ilvl, Seed; public float Main;
            public GearSet Set; public GearUnique Unique;
            public readonly List<GearEff> Effects = new List<GearEff>(); // 접사(또는 고유 효과)
            public readonly List<string> AffixKeys = new List<string>();
            public bool IsWeapon => Base.Slot == "weapon";
        }

        private static readonly Dictionary<string, Item> Cache = new Dictionary<string, Item>();
        private static readonly Dictionary<string, string> _slots = new Dictionary<string, string>();
        public static IReadOnlyDictionary<string, string> Slots => _slots;
        public static int Seq { get; private set; }
        public static event Action Changed;

        // ── 씨앗 굴림(mulberry32) ───────────────────────────────
        private struct Rng
        {
            private uint _a;
            public Rng(int seed) { _a = (uint)seed; }
            public float Next()
            {
                unchecked
                {
                    _a += 0x6D2B79F5u;
                    uint t = _a;
                    t = (t ^ (t >> 15)) * (t | 1u);
                    t ^= t + (t ^ (t >> 7)) * (t | 61u);
                    return ((t ^ (t >> 14)) >> 0) / 4294967296f;
                }
            }
        }

        public static bool IsGear(string id) => id != null && id.StartsWith(Prefix, StringComparison.Ordinal);

        /// <summary>id → 물건(접사까지). 틀린 id 면 null.</summary>
        public static Item Parse(string id)
        {
            if (!IsGear(id)) return null;
            if (Cache.TryGetValue(id, out var hit)) return hit;
            var p = id.Split(':');
            if (p.Length < 5) return null;
            var b = GearTables.Base(p[1]);
            if (b == null || !int.TryParse(p[2], out int t) || !int.TryParse(p[3], out int ilvl) || !int.TryParse(p[4], out int seed)) return null;
            t = Mathf.Clamp(t, 0, GearTables.Tiers.Length - 1);
            var it = new Item { Id = id, Base = b, Tier = GearTables.Tiers[t], Ilvl = Mathf.Max(1, ilvl), Seed = seed };
            it.Main = Mathf.Max(1f, Mathf.Round(b.Base * it.Tier.Mul * (1f + it.Ilvl * 0.085f)));
            string flag = p.Length > 5 ? p[5] : "";
            if (flag == "s") it.Set = GearTables.SetOfBase(b.Key);
            if (flag == "u") it.Unique = GearTables.UniqueOfBase(b.Key);
            if (it.Unique != null)
            {
                // 웹 data-unique.js effectsAt — 표 수치는 수준 20 기준, 수준 따라 늘고 줄어든다(0.45 바닥)
                float mul = Mathf.Max(0.45f, 1f + (it.Ilvl - GearTables.UniqueBaseIlvl) * 0.035f);
                foreach (var e in it.Unique.Eff)
                    it.Effects.Add(e.Scale && (e.Kind == "flat" || e.Kind == "eldmg") ? e.With(Mathf.Max(1f, Mathf.Round(e.V * mul))) : e);
            }
            else
            {
                var rng = new Rng(seed);
                var used = new HashSet<string>();
                int guard = 0;
                while (it.AffixKeys.Count < it.Tier.Affix && guard++ < 40)
                {
                    var a = GearTables.Affixes[Mathf.Min(GearTables.Affixes.Length - 1, (int)(rng.Next() * GearTables.Affixes.Length))];
                    if (!used.Add(a.Key)) continue;
                    float grow = a.Kind == "flat" ? 1f + it.Ilvl * 0.055f : 1f + it.Ilvl * 0.022f;
                    float v = Mathf.Max(1f, Mathf.Round((a.Lo + rng.Next() * (a.Hi - a.Lo)) * it.Tier.Mul * grow));
                    it.AffixKeys.Add(a.Key);
                    it.Effects.Add(new GearEff(a.Kind, a.Stat, a.Eff, null, v, true));
                }
            }
            if (!it.IsWeapon) it.Effects.Insert(0, new GearEff("flat", b.Main, null, null, it.Main, true)); // 무기 아닌 부위는 주 능력치도 효과로
            Cache[id] = it;
            return it;
        }

        /// <summary>표시 이름 — 고유는 고유 이름, 세트 조각은 "세트 이름 바탕", 나머지는 첫 접사 머리말/꼬리말 + 바탕.</summary>
        public static string NameOf(Item it)
        {
            if (it == null) return "";
            if (it.Unique != null) return it.Unique.Name;
            if (it.Set != null) return it.Set.Name + " " + it.Base.Name;
            string pre = null, post = null;
            foreach (var k in it.AffixKeys)
            {
                var a = GearTables.Affix(k);
                if (pre == null && a.Pre != null) pre = a.Pre;
                else if (post == null && a.Post != null) post = a.Post;
            }
            return (pre != null ? pre + " " : "") + it.Base.Name + (post != null ? "(" + post + ")" : "");
        }

        // ── 굴림 ─────────────────────────────────────────────
        /// <summary>웹 rollTier — 상품은 가중치 그대로, 위 등급은 (1+탐색%)^등급 배.</summary>
        private static int RollTier(ref Rng rng, float bias)
        {
            float find = 1f + (Totals.FindPct + bias) / 100f, total = 0f;
            var w = new float[GearTables.Tiers.Length];
            for (int i = 0; i < w.Length; i++) { w[i] = GearTables.Tiers[i].Weight * (i == 0 ? 1f : Mathf.Pow(find, i)); total += w[i]; }
            float r = rng.Next() * total;
            for (int i = 0; i < w.Length; i++) { r -= w[i]; if (r <= 0f) return i; }
            return 0;
        }

        /// <summary>물건 하나를 굴려 id 로 돌려준다. slot·tier 를 주면 그 부위·등급, base 를 주면 그 바탕.</summary>
        public static string Roll(int ilvl, string slot = null, int tier = -1, float bias = 0f, string baseKey = null, bool? set = null, bool? unique = null)
        {
            int seed = unchecked(20260824 + (++Seq) * 7919);
            var rng = new Rng(seed);
            GearBase b = baseKey != null ? GearTables.Base(baseKey) : null;
            if (b == null)
            {
                var pool = new List<GearBase>();
                foreach (var x in GearTables.Bases) if (slot == null || x.Slot == slot) pool.Add(x);
                if (pool.Count == 0) return null;
                b = pool[Mathf.Min(pool.Count - 1, (int)(rng.Next() * pool.Count))];
            }
            int t = tier >= 0 ? Mathf.Clamp(tier, 0, GearTables.Tiers.Length - 1) : RollTier(ref rng, bias);
            string flag = "";
            if (t == GearTables.SetTier && GearTables.SetOfBase(b.Key) != null && (set ?? rng.Next() < GearTables.SetChance)) flag = ":s";
            if (t == GearTables.Tiers.Length - 1 && GearTables.UniqueOfBase(b.Key) != null && (unique ?? rng.Next() < GearTables.UniqueChance)) flag = ":u";
            return $"{Prefix}{b.Key}:{t}:{Mathf.Max(1, ilvl)}:{seed}{flag}";
        }

        /// <summary>`DungeonEnemy.Die` — 쓰러뜨린 적이 장비를 떨구나. 두목은 늘, 정예는 절반, 나머지는 <see cref="DropChance"/>×(1+전리품%).</summary>
        public static string RollDrop(int ilvl, bool boss, bool elite)
        {
            if (!DropsOn) return null;
            var rng = new Rng(unchecked(1013904223 + Seq * 31 + ilvl));
            float chance = boss ? 1f : (elite ? EliteDropChance : DropChance) * (1f + Totals.LootPct / 100f);
            if (rng.Next() >= chance) { Seq++; return null; }
            return Roll(ilvl, bias: boss ? 60f : 0f);
        }

        // ── 세트 무예 buff(웹 shape 'buff' — 지금은 막기 % 하나: guardPct) ─────
        private static float _buffGuard, _buffUntil = -1f;
        public static void Buff(string eff, float v, float sec)
        {
            if (eff != "guardPct") return;
            _buffGuard = v;
            _buffUntil = Time.time + Mathf.Max(0.5f, sec);
        }
        /// <summary>지금 걸린 세트 무예 막기 %(끝났으면 0) — HeroState.TakeDamage 가 곱한다.</summary>
        public static float BuffGuardPct => Time.time < _buffUntil ? _buffGuard : 0f;

        /// <summary>처치 보상 경험·금에 장비 % 를 얹는다(0 이면 그대로).</summary>
        public static int WithPct(int amount, float pct) => pct > 0f && amount > 0 ? Mathf.RoundToInt(amount * (1f + pct / 100f)) : amount;

        // ── 장착(무기 아닌 일곱 부위) ───────────────────────────
        /// <summary>더 센 것만 바로 갖춘다(HeroState.EquipIfBetter 와 같은 결). 무기는 무기 칸으로 넘긴다.</summary>
        public static bool EquipIfBetter(string id)
        {
            var it = Parse(id);
            if (it == null) return false;
            if (it.IsWeapon) return HeroState.EquipIfBetter(id);
            _slots.TryGetValue(it.Base.Slot, out var cur);
            if (cur != null && ScoreWith(it.Base.Slot, cur) >= ScoreWith(it.Base.Slot, id)) return false;
            _slots[it.Base.Slot] = id;
            Recalc();
            return true;
        }

        /// <summary>그 부위에 id 를 끼웠을 때 전체 점수(세트 효과까지) — 갈아 끼울지 정하는 잣대.</summary>
        private static float ScoreWith(string slot, string id)
        {
            _slots.TryGetValue(slot, out var keep);
            _slots[slot] = id;
            var t = Compute();
            if (keep == null) _slots.Remove(slot); else _slots[slot] = keep;
            return t.Score;
        }

        // ── 합산 ─────────────────────────────────────────────
        public sealed class Sum
        {
            public float AtkFlat, AtkPct, HpFlat, HpPct, CritPct, GuardPct, ExpPct, GoldPct, LootPct, FindPct;
            public readonly Dictionary<string, int> SetCount = new Dictionary<string, int>();
            public GearSet FullSet; // 세 점을 다 갖춘 한 벌(세트 무예)
            public float Score => AtkFlat * (1f + AtkPct / 100f) + AtkPct * 0.4f + HpFlat * 0.6f + HpPct * 0.3f
                                  + CritPct * 0.5f + GuardPct * 0.5f + (ExpPct + GoldPct + LootPct + FindPct) * 0.15f;
        }

        private static Sum _totals;
        /// <summary>지금 걸친 것 전부의 합(무기 포함·세트 효과까지). 무기가 바뀌면(HeroState.EquipmentChanged) 다시 센다.</summary>
        public static Sum Totals => _totals ??= Compute();

        static Gear() { HeroState.EquipmentChanged += _ => { _totals = null; Changed?.Invoke(); }; }

        private static IEnumerable<Item> Worn()
        {
            var w = Parse(HeroState.EquippedWeaponId);
            if (w != null) yield return w;
            foreach (var kv in _slots) { var it = Parse(kv.Value); if (it != null) yield return it; }
        }

        private static void Apply(Sum s, GearEff e)
        {
            switch (e.Kind)
            {
                case "flat":
                    if (e.Stat == "might" || e.Stat == "all") s.AtkFlat += e.V * MightToAtk;
                    if (e.Stat == "wisdom" || e.Stat == "all") s.AtkFlat += e.V * WisdomToAtk;
                    if (e.Stat == "command" || e.Stat == "all") s.HpFlat += e.V * CommandToHp;
                    break;
                case "pct":
                    if (e.Stat != "command") s.AtkPct += e.V;
                    if (e.Stat == "command" || e.Stat == "all") s.HpPct += e.V;
                    break;
                case "eldmg": s.AtkFlat += e.V * ElDmgToAtk; break;
                case "elres": s.GuardPct += e.V * ElResToGuard; break;
                case "world":
                    switch (e.Eff)
                    {
                        case "atkPct": s.AtkPct += e.V; break;
                        case "hpPct": s.HpPct += e.V; break;
                        case "critPct": s.CritPct += e.V; break;
                        case "expPct": s.ExpPct += e.V; break;
                        case "goldPct": s.GoldPct += e.V; break;
                        case "lootPct": s.LootPct += e.V; break;
                        case "findPct": s.FindPct += e.V; break;
                        case "guardPct": s.GuardPct += e.V; break;
                    }
                    break;
            }
        }

        private static Sum Compute()
        {
            var s = new Sum();
            foreach (var it in Worn())
            {
                foreach (var e in it.Effects) Apply(s, e);
                if (it.Set != null) s.SetCount[it.Set.Key] = (s.SetCount.TryGetValue(it.Set.Key, out int n) ? n : 0) + 1;
            }
            foreach (var kv in s.SetCount)
            {
                var set = GearTables.Set(kv.Key);
                if (set == null) continue;
                if (kv.Value >= 2) foreach (var e in set.Bonus2) Apply(s, e);
                if (kv.Value >= 3) { foreach (var e in set.Bonus3) Apply(s, e); if (s.FullSet == null) s.FullSet = set; }
            }
            s.GuardPct = Mathf.Min(s.GuardPct, GuardCap);
            return s;
        }

        /// <summary>무기를 바꿨을 때도 부른다(HeroState.EquipmentChanged).</summary>
        public static void Recalc()
        {
            _totals = Compute();
            Changed?.Invoke();
        }

        // ── 세이브 ───────────────────────────────────────────
        [Serializable] private class Snap { public int seq; public string[] slots; public string[] ids; }

        public static string Snapshot()
        {
            var s = new Snap { seq = Seq, slots = new string[_slots.Count], ids = new string[_slots.Count] };
            int i = 0;
            foreach (var kv in _slots) { s.slots[i] = kv.Key; s.ids[i] = kv.Value; i++; }
            return JsonUtility.ToJson(s);
        }

        /// <summary>없거나 깨진 값이면 빈 칸(옛 세이브 그대로 열림).</summary>
        public static void Restore(string json)
        {
            _slots.Clear();
            Seq = 0;
            if (!string.IsNullOrEmpty(json))
            {
                try
                {
                    var s = JsonUtility.FromJson<Snap>(json);
                    Seq = Mathf.Max(0, s.seq);
                    if (s.slots != null && s.ids != null)
                        for (int i = 0; i < s.slots.Length && i < s.ids.Length; i++)
                            if (Array.IndexOf(SideSlots, s.slots[i]) >= 0 && Parse(s.ids[i]) != null) _slots[s.slots[i]] = s.ids[i];
                }
                catch (Exception) { _slots.Clear(); Seq = 0; }
            }
            Recalc();
        }
    }
}
