using System.Collections.Generic;
using UnityEngine;

namespace Saga.Go.Data
{
    /// <summary>
    /// PLAN.md 109-14-5b "보패"(웹 사가만리 ⑲-5 뒤 절반 `artifact.js` · ⑳ 이름·수치 · saga-godot 106 ⑰) — 표·식만 모은 순수 정적 클래스.
    /// 부위 다섯(패옥 체력·비녀 공격 고정, 가락지·향낭·관모는 칸 구성에서 고름), ★4·★5(최대 +12·+15, 부옵션 처음 2~3·3~4, 3단마다 넷 미만이면 새로·넷이면 하나 오름).
    /// 세트 다섯(2 세트·4 세트), 연마석으로 강화·분해하면 연마석, 가진 것 상한 200(넘치면 안 낀 ★4 부터 분해).
    /// 무작위는 보패마다 번호 씨앗(mulberry32, 20260824 + 번호 × 7919) — 웹과 같은 식이라 같은 번호면 같은 보패가 나온다(진단이 웹 표본과 대조).
    /// 값은 웹 그대로 들고, 들판에 탈 때만 이 트랙 크기로 — 고정 공격 × 0.75(기본 공격력 60/80) · 고정 체력 × 0.4(270/660) · 고정 방어 × 0.6(35/60).
    /// 얻는 곳: 상자 무늬 ★4 · 옻칠 ★5 · 금박 ★5 둘 · 방패 두른 원소 괴물 ★4(웹 숨은 터·들판 보스는 그 순서가 오기 전까지 없다).
    /// </summary>
    public static class GoArtifacts
    {
        public static readonly string[] Slots = { "flower", "plume", "sands", "goblet", "circlet" };
        public static readonly string[] SetIds = { "gladiator", "crimson", "viridescent", "emblem", "depth" };

        /// <summary>주옵션 ★5 [+0, +15].</summary>
        private static readonly Dictionary<string, (float lo, float hi)> Main = new Dictionary<string, (float, float)>
        {
            { "hp", (80f, 480f) }, { "atk", (20f, 120f) },
            { "atk_pct", (0.06f, 0.42f) }, { "hp_pct", (0.06f, 0.42f) }, { "def_pct", (0.08f, 0.52f) },
            { "energy", (0.07f, 0.46f) }, { "crit_rate", (0.04f, 0.28f) }, { "crit_dmg", (0.08f, 0.56f) },
            { "elem_fire", (0.06f, 0.42f) }, { "elem_water", (0.06f, 0.42f) }, { "elem_elec", (0.06f, 0.42f) }, { "elem_wind", (0.06f, 0.42f) },
            { "elem_ice", (0.06f, 0.42f) }, { "elem_rock", (0.06f, 0.42f) }, { "elem_grass", (0.06f, 0.42f) }, { "elem_phys", (0.08f, 0.52f) },
        };

        /// <summary>칸 구성 — 가락지 = 치명, 향낭 = 원소·체력·방어, 관모 = 기력.</summary>
        public static readonly Dictionary<string, string[]> SlotMains = new Dictionary<string, string[]>
        {
            { "flower", new[] { "hp" } },
            { "plume", new[] { "atk" } },
            { "sands", new[] { "atk_pct", "crit_rate", "crit_dmg" } },
            { "goblet", new[] { "hp_pct", "def_pct", "elem_fire", "elem_water", "elem_elec", "elem_wind", "elem_ice", "elem_rock", "elem_grass", "elem_phys" } },
            { "circlet", new[] { "atk_pct", "hp_pct", "def_pct", "energy" } },
        };

        /// <summary>부옵션 ★5 한 번 최대치.</summary>
        private static readonly Dictionary<string, float> SubRoll = new Dictionary<string, float>
        {
            { "hp", 30f }, { "atk", 8f }, { "def", 5f }, { "hp_pct", 0.05f }, { "atk_pct", 0.05f }, { "def_pct", 0.065f },
            { "energy", 0.055f }, { "crit_rate", 0.033f }, { "crit_dmg", 0.066f },
        };
        private static readonly string[] SubKeys = { "hp", "atk", "def", "hp_pct", "atk_pct", "def_pct", "energy", "crit_rate", "crit_dmg" };
        private static readonly float[] RollTiers = { 0.75f, 0.85f, 1.0f };

        public const int Step = 3, Cap = 200;
        public const float HpScale = 0.4f, DefScale = 0.6f;
        public static int MaxLv(int rarity) => rarity >= 5 ? 15 : 12;
        public static float RarityMul(int rarity) => rarity >= 5 ? 1f : 0.8f;
        public static int SalvageBase(int rarity) => rarity >= 5 ? 2 : 1;
        public static bool Flat(string key) => key == "hp" || key == "atk" || key == "def";

        /// <summary>세트 2/4 — 2 는 능력치, 4 는 효과(normal_melee·react_fire·react_swirl·burst_dmg·skill_dmg).</summary>
        public struct SetDef
        {
            public string Id, NameKo, Two, Four;
            public float TwoV, FourV;
            public string Name => GoLocalization.T("artifact.set." + Id, NameKo);
        }

        public static readonly SetDef[] Sets =
        {
            new SetDef { Id = "gladiator", NameKo = "떠돌이 무사", Two = "atk_pct", TwoV = 0.15f, Four = "normal_melee", FourV = 0.3f },
            new SetDef { Id = "crimson", NameKo = "대장간 불씨", Two = "elem_fire", TwoV = 0.12f, Four = "react_fire", FourV = 0.35f },
            new SetDef { Id = "viridescent", NameKo = "솔바람 피리", Two = "elem_wind", TwoV = 0.12f, Four = "react_swirl", FourV = 0.5f },
            new SetDef { Id = "emblem", NameKo = "봉화 깃발", Two = "energy", TwoV = 0.18f, Four = "burst_dmg", FourV = 0.2f },
            new SetDef { Id = "depth", NameKo = "나루 안개", Two = "elem_water", TwoV = 0.12f, Four = "skill_dmg", FourV = 0.25f },
        };

        public static SetDef SetOf(string id)
        {
            foreach (var s in Sets) if (s.Id == id) return s;
            return Sets[0];
        }

        /// <summary>상자 등급(나무·무늬·옻칠·금박) → 얻는 ★ 목록.</summary>
        public static int[] ChestRarities(GoTreasure.Grade g) => g switch
        {
            GoTreasure.Grade.Exquisite => new[] { 4 },
            GoTreasure.Grade.Precious => new[] { 5 },
            GoTreasure.Grade.Luxurious => new[] { 5, 5 },
            _ => new int[0],
        };
        public const int EliteRarity = 4;

        // ---- 무작위(웹 mulberry32 와 비트까지 같게 — double 로 나눈다) ----

        public sealed class Rng
        {
            private uint _t;
            public Rng(uint seed) { _t = seed; }
            public double Next()
            {
                unchecked
                {
                    _t += 0x6D2B79F5u;
                    uint r = (_t ^ (_t >> 15)) * (1u | _t);
                    r = (r + (r ^ (r >> 7)) * (61u | r)) ^ r;
                    return (r ^ (r >> 14)) / 4294967296.0;
                }
            }
            public T Pick<T>(IList<T> arr) => arr[(int)System.Math.Floor(Next() * arr.Count) % arr.Count];
        }

        [System.Serializable]
        public class Sub
        {
            public string key;
            public float value;
        }

        /// <summary>보패 하나 — 세이브에 그대로 적힌다(JsonUtility).</summary>
        [System.Serializable]
        public class Artifact
        {
            public string uid, set, slot, main, owner;
            public int rarity, lv, spent;
            public long seed;
            public List<Sub> subs = new List<Sub>();
        }

        private static float Roll(string key, int rarity, Rng r) => SubRoll[key] * RarityMul(rarity) * r.Pick(RollTiers);

        private static void AddSub(Artifact a, Rng r)
        {
            var pool = new List<string>();
            foreach (var k in SubKeys)
            {
                if (k == a.main) continue;
                bool had = false;
                foreach (var s in a.subs) if (s.key == k) { had = true; break; }
                if (!had) pool.Add(k);
            }
            string key = r.Pick(pool);
            a.subs.Add(new Sub { key = key, value = Roll(key, a.rarity, r) });
        }

        /// <summary>새 보패 — set·slot 이 비면 씨앗으로 고른다(웹 `generate`).</summary>
        public static Artifact Generate(uint seed, int rarity, string setId = null, string slot = null)
        {
            var r = new Rng(seed);
            rarity = rarity >= 5 ? 5 : 4;
            if (string.IsNullOrEmpty(setId)) setId = r.Pick(SetIds);
            if (string.IsNullOrEmpty(slot)) slot = r.Pick(Slots);
            var a = new Artifact { set = setId, slot = slot, rarity = rarity, lv = 0, spent = 0, main = r.Pick(SlotMains[slot]), seed = seed, owner = "" };
            int n = (rarity >= 5 ? 3 : 2) + (r.Next() < 0.25 ? 1 : 0);
            for (int i = 0; i < n; i++) AddSub(a, r);
            return a;
        }

        /// <summary>+3 에 닿을 때 — 넷 미만이면 새로, 넷이면 하나 올린다(씨앗 = 보패 씨앗 × 31 + Lv).</summary>
        public static void OnStep(Artifact a)
        {
            var r = new Rng(unchecked((uint)(a.seed * 31 + a.lv)));
            if (a.subs.Count < 4) AddSub(a, r);
            else { var s = r.Pick(a.subs); s.value += Roll(s.key, a.rarity, r); }
        }

        public static float MainValue(Artifact a)
        {
            var t = Main[a.main];
            return (t.lo + (t.hi - t.lo) * a.lv / 15f) * RarityMul(a.rarity);
        }

        /// <summary>강화 +n → +n+1 = 연마석 ⌈0.6 × (n+1)⌉ + 금 12 × 그만큼.</summary>
        public static (int polish, int gold) UpCost(int lv)
        {
            int p = (int)System.Math.Ceiling(0.6 * (lv + 1)); // 웹과 같게 double(0.6f × 5 는 3 을 넘는다)
            return (p, 12 * p);
        }

        public static int SalvageValue(Artifact a) => SalvageBase(a.rarity) + Mathf.FloorToInt(a.spent * 0.8f);

        /// <summary>들판에 타는 값(고정 셋은 이 트랙 크기로).</summary>
        public static float Applied(string key, float v) => key switch
        {
            "atk" => v * GoWeapons.AtkScale,
            "hp" => v * HpScale,
            "def" => v * DefScale,
            _ => v,
        };

        // ---- 글 ----

        public static string SlotName(string slot) => slot switch
        {
            "flower" => GoLocalization.T("artifact.slot.flower", "패옥"),
            "plume" => GoLocalization.T("artifact.slot.plume", "비녀"),
            "sands" => GoLocalization.T("artifact.slot.sands", "가락지"),
            "goblet" => GoLocalization.T("artifact.slot.goblet", "향낭"),
            _ => GoLocalization.T("artifact.slot.circlet", "관모"),
        };

        public static string StatName(string key) => key switch
        {
            "hp" => GoLocalization.T("artifact.stat.hp", "체력"),
            "atk" => GoLocalization.T("artifact.stat.atk", "공격력"),
            "def" => GoLocalization.T("artifact.stat.def", "방어력"),
            "hp_pct" => GoLocalization.T("artifact.stat.hp_pct", "체력%"),
            "atk_pct" => GoLocalization.T("artifact.stat.atk_pct", "공격력%"),
            "def_pct" => GoLocalization.T("artifact.stat.def_pct", "방어력%"),
            "energy" => GoLocalization.T("weapon.stat.energy", "기력 획득"),
            "crit_rate" => GoLocalization.T("weapon.stat.crit_rate", "치명타 확률"),
            "crit_dmg" => GoLocalization.T("weapon.stat.crit_dmg", "치명타 피해"),
            "elem_fire" => GoLocalization.T("artifact.stat.elem_fire", "화 피해"),
            "elem_water" => GoLocalization.T("artifact.stat.elem_water", "수 피해"),
            "elem_elec" => GoLocalization.T("artifact.stat.elem_elec", "뇌 피해"),
            "elem_wind" => GoLocalization.T("artifact.stat.elem_wind", "풍 피해"),
            "elem_ice" => GoLocalization.T("artifact.stat.elem_ice", "빙 피해"),
            "elem_rock" => GoLocalization.T("artifact.stat.elem_rock", "암 피해"),
            "elem_grass" => GoLocalization.T("artifact.stat.elem_grass", "초 피해"),
            _ => GoLocalization.T("artifact.stat.elem_phys", "물리 피해"),
        };

        public static string StatText(string key, float v) =>
            Flat(key) ? $"{StatName(key)} +{Mathf.RoundToInt(Applied(key, v))}" : $"{StatName(key)} +{v * 100f:0.0}%";

        public static string FourText(string four) => four switch
        {
            "normal_melee" => GoLocalization.T("artifact.four.normal_melee", "칼·대도·창 기본 공격 피해 +30%"),
            "react_fire" => GoLocalization.T("artifact.four.react_fire", "물안개·녹임·터짐·들불 피해 +35%"),
            "react_swirl" => GoLocalization.T("artifact.four.react_swirl", "회오리 피해 +50%"),
            "burst_dmg" => GoLocalization.T("artifact.four.burst_dmg", "원소 해방 피해 +20%"),
            _ => GoLocalization.T("artifact.four.skill_dmg", "원소 스킬 피해 +25%"),
        };

        public static string Label(Artifact a) => a == null ? "" : $"★{a.rarity} {SetOf(a.set).Name} {SlotName(a.slot)}";
    }

    /// <summary>109-14-5b 가진 보패(상한 200)·연마석·누가 낀 것(세이브 v22).</summary>
    public static class ArtifactState
    {
        private static readonly List<GoArtifacts.Artifact> _list = new List<GoArtifacts.Artifact>();
        public static int Seq { get; private set; }
        public static int Polish { get; private set; }
        public static int Count => _list.Count;
        public static IReadOnlyList<GoArtifacts.Artifact> All => _list;
        public static event System.Action Changed;

        private static int _ver;
        private static readonly Dictionary<string, (int ver, Bonus b)> _cache = new Dictionary<string, (int, Bonus)>();

        private static void Touch()
        {
            _ver++;
            Changed?.Invoke();
        }

        /// <summary>한 사람이 들판에서 쓰는 몫(고정 셋은 이미 이 트랙 크기).</summary>
        public class Bonus
        {
            public float Hp, HpPct, Atk, AtkPct, Def, DefPct, Energy, CritRate, CritDmg;
            public readonly float[] Elem = new float[8]; // GoElement 번호(0 물리 · 1 화 · 2 수 · 3 뇌 · 4 풍 · 5 빙 · 6 암 · 7 초)
            public float NormalMelee, ReactFire, ReactSwirl, BurstDmg, SkillDmg;
            public readonly List<(string set, int n)> Sets = new List<(string, int)>();
        }

        private static readonly Bonus Empty = new Bonus();

        public static GoArtifacts.Artifact Get(string uid)
        {
            foreach (var a in _list) if (a.uid == uid) return a;
            return null;
        }

        /// <summary>하나 얻는다 — 번호 씨앗으로 만들고, 상한을 넘으면 안 낀 ★4 부터 분해(웹 `add`).</summary>
        public static string Add(int rarity, string setId = null, string slot = null)
        {
            Seq++;
            var a = GoArtifacts.Generate(unchecked((uint)(20260824 + Seq * 7919)), rarity, setId, slot);
            a.uid = "a" + Seq;
            _list.Add(a);
            Trim(a.uid);
            Touch();
            return a.uid;
        }

        private static void Trim(string keep)
        {
            int over = _list.Count - GoArtifacts.Cap;
            while (over > 0)
            {
                GoArtifacts.Artifact worst = null;
                foreach (var w in _list)
                {
                    if (w.uid == keep || !string.IsNullOrEmpty(w.owner)) continue;
                    if (worst == null || w.rarity < worst.rarity || (w.rarity == worst.rarity && w.lv < worst.lv)) worst = w;
                }
                if (worst == null) break;
                SalvageQuiet(worst);
                over--;
            }
        }

        private static int SalvageQuiet(GoArtifacts.Artifact a)
        {
            int v = GoArtifacts.SalvageValue(a);
            Polish += v;
            _list.Remove(a);
            return v;
        }

        /// <summary>분해 — 낀 것은 안 된다. 돌아온 연마석.</summary>
        public static int Salvage(string uid)
        {
            var a = Get(uid);
            if (a == null || !string.IsNullOrEmpty(a.owner)) return 0;
            int v = SalvageQuiet(a);
            Touch();
            return v;
        }

        /// <summary>안 낀 ★4 를 모두 분해 — 돌아온 연마석(없으면 0).</summary>
        public static int SalvageLoose4()
        {
            int got = 0;
            foreach (var a in _list.ToArray())
                if (a.rarity == 4 && string.IsNullOrEmpty(a.owner)) got += SalvageQuiet(a);
            if (got > 0) Touch();
            return got;
        }

        public static void AddPolish(int n)
        {
            if (n <= 0) return;
            Polish += n;
            Touch();
        }

        /// <summary>그 사람이 낀 것 — 부위 → 보패.</summary>
        public static Dictionary<string, GoArtifacts.Artifact> EquippedOf(string id)
        {
            var d = new Dictionary<string, GoArtifacts.Artifact>();
            if (string.IsNullOrEmpty(id)) return d;
            foreach (var a in _list) if (a.owner == id) d[a.slot] = a;
            return d;
        }

        /// <summary>그 부위에 낄 수 있는 것 — 안 낀 것 + 제가 낀 것 + 남이 낀 것(끼면 그쪽에서 빠진다). 좋은 순(★·Lv).</summary>
        public static List<GoArtifacts.Artifact> ChoicesFor(string slot)
        {
            var l = new List<GoArtifacts.Artifact>();
            foreach (var a in _list) if (a.slot == slot) l.Add(a);
            l.Sort((x, y) => x.rarity != y.rarity ? y.rarity.CompareTo(x.rarity) : x.lv != y.lv ? y.lv.CompareTo(x.lv) : string.CompareOrdinal(x.uid, y.uid));
            return l;
        }

        /// <summary>낀다 — 도감 동행만. 같은 부위에 끼던 것은 빠지고, 남이 끼던 것이면 그쪽에서 빠진다.</summary>
        public static bool Equip(string id, string uid)
        {
            var a = Get(uid);
            if (a == null || !TalentState.Trainable(id)) return false;
            foreach (var x in _list) if (x != a && x.owner == id && x.slot == a.slot) x.owner = "";
            a.owner = id;
            Touch();
            return true;
        }

        public static bool Unequip(string uid)
        {
            var a = Get(uid);
            if (a == null || string.IsNullOrEmpty(a.owner)) return false;
            a.owner = "";
            Touch();
            return true;
        }

        public static bool CanUp(string uid, out string why, out (int polish, int gold) cost)
        {
            cost = default;
            var a = Get(uid);
            if (a == null) { why = GoLocalization.T("artifact.why.none", "없는 보패"); return false; }
            if (a.lv >= GoArtifacts.MaxLv(a.rarity)) { why = GoLocalization.T("artifact.why.max", "최대 강화"); return false; }
            cost = GoArtifacts.UpCost(a.lv);
            if (Polish < cost.polish) { why = GoLocalization.T("artifact.why.polish", "연마석 부족"); return false; }
            if (GoldState.Gold < cost.gold) { why = GoLocalization.T("talent.why.gold", "금 부족"); return false; }
            why = null;
            return true;
        }

        public static bool Up(string uid)
        {
            if (!CanUp(uid, out _, out var c)) return false;
            var a = Get(uid);
            Polish -= c.polish;
            GoldState.TrySpend(c.gold);
            a.spent += c.polish;
            a.lv++;
            if (a.lv % GoArtifacts.Step == 0) GoArtifacts.OnStep(a);
            Touch();
            return true;
        }

        /// <summary>끼고 있는 것의 합 + 켜진 세트(웹 `statsOf`). 주인공·도감 밖은 빈 몫.</summary>
        public static Bonus BonusOf(string id)
        {
            if (string.IsNullOrEmpty(id)) return Empty;
            if (_cache.TryGetValue(id, out var c) && c.ver == _ver) return c.b;
            var b = new Bonus();
            var cnt = new Dictionary<string, int>();
            foreach (var a in _list)
            {
                if (a.owner != id) continue;
                AddStat(b, a.main, GoArtifacts.MainValue(a));
                foreach (var s in a.subs) AddStat(b, s.key, s.value);
                cnt.TryGetValue(a.set, out int n);
                cnt[a.set] = n + 1;
            }
            foreach (var set in GoArtifacts.Sets)
            {
                if (!cnt.TryGetValue(set.Id, out int n) || n < 2) continue;
                AddStat(b, set.Two, set.TwoV);
                b.Sets.Add((set.Id, n));
                if (n < 4) continue;
                switch (set.Four)
                {
                    case "normal_melee": b.NormalMelee += set.FourV; break;
                    case "react_fire": b.ReactFire += set.FourV; break;
                    case "react_swirl": b.ReactSwirl += set.FourV; break;
                    case "burst_dmg": b.BurstDmg += set.FourV; break;
                    default: b.SkillDmg += set.FourV; break;
                }
            }
            _cache[id] = (_ver, b);
            return b;
        }

        private static void AddStat(Bonus b, string key, float v)
        {
            v = GoArtifacts.Applied(key, v);
            switch (key)
            {
                case "hp": b.Hp += v; break;
                case "atk": b.Atk += v; break;
                case "def": b.Def += v; break;
                case "hp_pct": b.HpPct += v; break;
                case "atk_pct": b.AtkPct += v; break;
                case "def_pct": b.DefPct += v; break;
                case "energy": b.Energy += v; break;
                case "crit_rate": b.CritRate += v; break;
                case "crit_dmg": b.CritDmg += v; break;
                case "elem_phys": b.Elem[0] += v; break;
                case "elem_fire": b.Elem[1] += v; break;
                case "elem_water": b.Elem[2] += v; break;
                case "elem_elec": b.Elem[3] += v; break;
                case "elem_wind": b.Elem[4] += v; break;
                case "elem_ice": b.Elem[5] += v; break;
                case "elem_rock": b.Elem[6] += v; break;
                case "elem_grass": b.Elem[7] += v; break;
            }
        }

        /// <summary>상자 — 무늬 ★4 · 옻칠 ★5 · 금박 ★5 둘. 알림 글.</summary>
        public static string OnChest(GoTreasure.Grade grade)
        {
            var parts = new List<string>();
            foreach (int r in GoArtifacts.ChestRarities(grade)) parts.Add(GoArtifacts.Label(Get(Add(r))));
            return string.Join(" · ", parts);
        }

        /// <summary>방패 두른 원소 괴물 — ★4 하나.</summary>
        public static string OnElite() => GoArtifacts.Label(Get(Add(GoArtifacts.EliteRarity)));

        public static List<GoArtifacts.Artifact> Snapshot()
        {
            var l = new List<GoArtifacts.Artifact>();
            foreach (var a in _list)
            {
                var c = new GoArtifacts.Artifact { uid = a.uid, set = a.set, slot = a.slot, main = a.main, owner = a.owner ?? "", rarity = a.rarity, lv = a.lv, spent = a.spent, seed = a.seed };
                foreach (var s in a.subs) c.subs.Add(new GoArtifacts.Sub { key = s.key, value = s.value });
                l.Add(c);
            }
            return l;
        }

        public static void Restore(List<GoArtifacts.Artifact> list, int seq, int polish)
        {
            _list.Clear();
            _cache.Clear();
            if (list != null)
                foreach (var a in list)
                {
                    if (a == null || string.IsNullOrEmpty(a.uid) || !GoArtifacts.SlotMains.ContainsKey(a.slot ?? "")) continue;
                    a.rarity = a.rarity >= 5 ? 5 : 4;
                    a.lv = Mathf.Clamp(a.lv, 0, GoArtifacts.MaxLv(a.rarity));
                    a.owner ??= "";
                    a.subs ??= new List<GoArtifacts.Sub>();
                    _list.Add(a);
                }
            Seq = Mathf.Max(0, seq);
            Polish = Mathf.Max(0, polish);
            Touch();
        }

        public static void ResetForTest() => Restore(null, 0, 0);
    }
}
