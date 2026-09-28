using System.Collections.Generic;
using UnityEngine;

namespace Saga.Go.Data
{
    /// <summary>
    /// PLAN.md 109-14-5a "무기·치명타"(웹 사가고 ⑲-5 · ⑳ 이름·수치 · saga-godot 106 ⑯) — 표·식만 모은 순수 정적 클래스.
    /// 종류 다섯(칼·대도·창·서책·활, 인물 id 해시 = 웹 `typeOf` 와 같은 식 — 주인공은 칼), 인물은 제 종류만 든다.
    /// 기본 공격 모양(`Kit`)은 웹 표를 이 트랙 칼(3타 0.8·0.9·1.3 · 0.33초 · 4.2m)에 맞춰 옮긴다 — 배율은 타마다 웹 칼과 같은 비, 빠르기 × 0.33/0.34, 사거리 × 4.2/3.2.
    /// 서책은 인물 원소로 멀리 하나, 활은 더 멀리 하나(물리), 대도는 무거운 타격(얼음 깨뜨림).
    /// 무기 열다섯(웹 ⑳ 표 — 수련용 ★1 다섯은 누구나 기본, ★3·★4 는 부옵션 + 효과). 공격은 이 트랙 기본 공격력(60)/웹(80) = × 0.75.
    /// Lv 1~30(상한 = 벼림 0~5 → 10·14·18·22·26·30), 공격 × (1 + 0.06 × (Lv−1) + 0.1 × 벼림), 부옵션 × (1 + 0.12 × (Lv−1)), 같은 무기를 또 얻으면 울림(효과 × (1 + 0.25 × (울림−1)), 5 가 넘치면 강화석 10).
    /// 강화 n → n+1 = 강화석 1 + ⌊(n−1)/5⌋ + 금 15n · 벼림 = 금 250~1250(웹 단사는 이 판에 없어 뺐다). 치명타 = 기본 5%·50% + 무기 부옵션.
    /// 웹의 갯바람 작살(낚시, ⑲-24)은 그 순서가 오기 전까지 없다.
    /// </summary>
    public static class GoWeapons
    {
        public enum Type { Sword = 0, Claymore = 1, Polearm = 2, Catalyst = 3, Bow = 4 }

        public readonly struct Kit
        {
            public readonly float[] Mul;
            public readonly float[] Sec;
            public readonly float Reach;   // 붙어 치는 사거리(0 = 멀리 하나)
            public readonly float Range;   // 멀리 하나를 치는 사거리
            public readonly bool Heavy;
            public readonly bool Element;
            public Kit(float[] mul, float[] sec, float reach, float range, bool heavy, bool element)
            { Mul = mul; Sec = sec; Reach = reach; Range = range; Heavy = heavy; Element = element; }
        }

        private static readonly float[] StepScale = { 0.8f / 0.9f, 0.9f / 1.0f, 1.3f / 1.5f };
        private const float ReachScale = 4.2f / 3.2f, SecScale = 0.33f / 0.34f;

        private static Kit FromWeb(float[] mul, float[] sec, float reach, float range, bool heavy = false, bool el = false)
        {
            var m = new float[3];
            var s = new float[3];
            for (int i = 0; i < 3; i++) { m[i] = mul[i] * StepScale[i]; s[i] = sec[i] * SecScale; }
            return new Kit(m, s, reach * ReachScale, range * ReachScale, heavy, el);
        }

        /// <summary>웹 `KIT` 그대로 → 이 트랙 크기.</summary>
        public static readonly Kit[] Kits =
        {
            FromWeb(new[] { 0.9f, 1.0f, 1.5f }, new[] { 0.34f, 0.34f, 0.55f }, 3.2f, 0f),
            FromWeb(new[] { 1.5f, 1.75f, 2.5f }, new[] { 0.58f, 0.58f, 0.92f }, 3.7f, 0f, heavy: true),
            FromWeb(new[] { 0.75f, 0.875f, 1.25f }, new[] { 0.28f, 0.28f, 0.46f }, 4.2f, 0f),
            FromWeb(new[] { 0.75f, 0.875f, 1.25f }, new[] { 0.36f, 0.36f, 0.55f }, 0f, 7f, el: true),
            FromWeb(new[] { 0.75f, 0.75f, 1.125f }, new[] { 0.32f, 0.32f, 0.49f }, 0f, 14f),
        };

        public struct Weapon
        {
            public string Id;
            public string NameKo;
            public Type Type;
            public int Rarity;
            public float Atk;       // 웹 값(× AtkScale 은 AtkAt 이 한다)
            public string Sub;      // atk_pct · crit_rate · crit_dmg · energy · hp_pct
            public float SubV;
            public string Pas;      // n · s · b · react
            public float PasV;
            public string Name => GoLocalization.T("weapon." + Id, NameKo);
        }

        private static Weapon W(string id, string name, Type t, int r, float atk, string sub = null, float subV = 0f, string pas = null, float pasV = 0f) =>
            new Weapon { Id = id, NameKo = name, Type = t, Rarity = r, Atk = atk, Sub = sub, SubV = subV, Pas = pas, PasV = pasV };

        public static readonly Weapon[] All =
        {
            W("w_sword_0", "수련용 목검", Type.Sword, 1, 20), W("w_claymore_0", "수련용 목도", Type.Claymore, 1, 20),
            W("w_polearm_0", "수련용 장대", Type.Polearm, 1, 20), W("w_catalyst_0", "수련용 서첩", Type.Catalyst, 1, 20),
            W("w_bow_0", "수련용 단궁", Type.Bow, 1, 20),
            W("w_sword_3", "청동 환도", Type.Sword, 3, 34, "atk_pct", 0.07f, "n", 0.12f),
            W("w_claymore_3", "나무꾼 큰도끼", Type.Claymore, 3, 34, "hp_pct", 0.07f, "b", 0.12f),
            W("w_polearm_3", "대나무 창", Type.Polearm, 3, 35, "crit_dmg", 0.09f, "n", 0.12f),
            W("w_catalyst_3", "해진 서책", Type.Catalyst, 3, 34, "energy", 0.08f, "react", 0.12f),
            W("w_bow_3", "사냥꾼 활", Type.Bow, 3, 35, "crit_dmg", 0.09f, "n", 0.12f),
            W("w_sword_4", "청하 보검", Type.Sword, 4, 40, "crit_rate", 0.035f, "s", 0.16f),
            W("w_claymore_4", "파도 참마도", Type.Claymore, 4, 38, "atk_pct", 0.08f, "react", 0.2f),
            W("w_polearm_4", "봉수 월도", Type.Polearm, 4, 40, "energy", 0.06f, "b", 0.16f),
            W("w_catalyst_4", "별자리 두루마리", Type.Catalyst, 4, 38, "atk_pct", 0.08f, "s", 0.16f),
            W("w_bow_4", "갯바람 각궁", Type.Bow, 4, 40, "crit_rate", 0.035f, "b", 0.16f),
        };

        public const int MaxLv = 30, MaxAsc = 5, RefineMax = 5, RefineOverOre = 10;
        public const float AtkPerLv = 0.06f, AtkPerAsc = 0.1f, SubPerLv = 0.12f;
        public static readonly int[] AscGold = { 250, 500, 750, 1000, 1250 };
        public const float BaseCritRate = 0.05f, BaseCritDmg = 0.5f;
        public static readonly int[] ChestOre = { 2, 5, 15, 40 };   // 평범·정교·진귀·화려
        public const int EliteOre = 1;
        public static float AtkScale => PartyState.BaseAtk / 80f;

        public static bool TryGet(string id, out Weapon w)
        {
            foreach (var x in All) if (x.Id == id) { w = x; return true; }
            w = All[0];
            return false;
        }

        public static string DefaultOf(Type t) => "w_" + t.ToString().ToLowerInvariant() + "_0";
        public static bool IsShared(string id) => TryGet(id, out var w) && w.Rarity <= 1;

        /// <summary>인물 → 종류(웹 `typeOf` 식: h = 7, h = h × 37 + 글자 & 0x7fffffff). 주인공·빈 id 는 칼.</summary>
        public static Type TypeOf(string id)
        {
            if (string.IsNullOrEmpty(id) || id == "hero") return Type.Sword;
            long h = 7;
            foreach (char c in id) h = (h * 37 + c) & 0x7fffffff;
            return (Type)(h % 5);
        }

        public static string TypeName(Type t) => t switch
        {
            Type.Sword => GoLocalization.T("weapon.type.sword", "칼"),
            Type.Claymore => GoLocalization.T("weapon.type.claymore", "대도"),
            Type.Polearm => GoLocalization.T("weapon.type.polearm", "창"),
            Type.Catalyst => GoLocalization.T("weapon.type.catalyst", "서책"),
            _ => GoLocalization.T("weapon.type.bow", "활"),
        };

        public static int Cap(int asc) => Mathf.Min(MaxLv, 10 + 4 * Mathf.Clamp(asc, 0, MaxAsc));
        public static float AtkAt(Weapon w, int lv, int asc) => w.Atk * AtkScale * (1f + AtkPerLv * (lv - 1) + AtkPerAsc * asc);
        public static float SubAt(Weapon w, int lv) => w.SubV * (1f + SubPerLv * (lv - 1));
        public static float PassiveAt(Weapon w, int refine) => w.PasV * (1f + 0.25f * (Mathf.Clamp(refine, 1, RefineMax) - 1));
        public static (int ore, int gold) UpCost(int lv) => (1 + (lv - 1) / 5, 15 * lv);

        /// <summary>상자 → 무기(진귀 ★3 · 화려 ★4, 상자 id 해시로 종류 — 웹 `chestWeapon` 식), 없으면 null.</summary>
        public static string ChestWeapon(string chestId, GoTreasure.Grade grade)
        {
            int r = grade == GoTreasure.Grade.Precious ? 3 : grade == GoTreasure.Grade.Luxurious ? 4 : 0;
            if (r == 0 || string.IsNullOrEmpty(chestId)) return null;
            long h = 0;
            foreach (char c in chestId) h = (h * 31 + c) & 0x7fffffff;
            return "w_" + ((Type)(h % 5)).ToString().ToLowerInvariant() + "_" + r;
        }

        public static string StatName(string sub) => sub switch
        {
            "atk_pct" => GoLocalization.T("weapon.stat.atk_pct", "공격력"),
            "crit_rate" => GoLocalization.T("weapon.stat.crit_rate", "치명타 확률"),
            "crit_dmg" => GoLocalization.T("weapon.stat.crit_dmg", "치명타 피해"),
            "energy" => GoLocalization.T("weapon.stat.energy", "기력 획득"),
            _ => GoLocalization.T("weapon.stat.hp_pct", "체력"),
        };

        public static string PassiveName(string pas) => pas switch
        {
            "n" => GoLocalization.T("weapon.pas.n", "기본 공격 피해"),
            "s" => GoLocalization.T("weapon.pas.s", "원소 스킬 피해"),
            "b" => GoLocalization.T("weapon.pas.b", "원소 해방 피해"),
            _ => GoLocalization.T("weapon.pas.react", "원소 반응 피해"),
        };
    }

    /// <summary>109-14-5a 가진 무기(Lv·벼림·울림)·든 무기·강화석(세이브 v21).</summary>
    public static class WeaponState
    {
        private struct Rec { public int Lv, Asc, Ref; }
        private static readonly Dictionary<string, Rec> _inv = new Dictionary<string, Rec>();
        private static readonly Dictionary<string, string> _equip = new Dictionary<string, string>();
        public static int Ore { get; private set; }
        public static event System.Action Changed;

        /// <summary>한 사람이 들판에서 쓰는 몫.</summary>
        public struct Mods
        {
            public GoWeapons.Weapon Weapon;
            public GoWeapons.Kit Kit;
            public int Lv, Asc, Ref;
            public float Atk, AtkPct, CritRate, CritDmg, Energy, HpPct;
            public string Pas;
            public float PasV;
        }

        public static bool Owned(string wid) => GoWeapons.IsShared(wid) ? GoWeapons.TryGet(wid, out _) : _inv.ContainsKey(wid);
        public static (int lv, int asc, int refine) RecOf(string wid) => _inv.TryGetValue(wid, out var r) ? (r.Lv, r.Asc, r.Ref) : (1, 0, 1);

        /// <summary>그 사람이 든 무기 — 없거나 종류가 안 맞으면 제 종류 수련용.</summary>
        public static string Equipped(string id)
        {
            var t = GoWeapons.TypeOf(id);
            if (id != null && _equip.TryGetValue(id, out var wid) && GoWeapons.TryGet(wid, out var w) && w.Type == t && Owned(wid)) return wid;
            return GoWeapons.DefaultOf(t);
        }

        public static string HolderOf(string wid)
        {
            if (GoWeapons.IsShared(wid)) return null;
            foreach (var kv in _equip) if (kv.Value == wid) return kv.Key;
            return null;
        }

        /// <summary>들 수 있는 것 — 제 종류 수련용 + 가진 제 종류.</summary>
        public static List<string> ChoicesFor(string id)
        {
            var t = GoWeapons.TypeOf(id);
            var list = new List<string> { GoWeapons.DefaultOf(t) };
            foreach (var w in GoWeapons.All) if (w.Type == t && w.Rarity > 1 && _inv.ContainsKey(w.Id)) list.Add(w.Id);
            return list;
        }

        /// <summary>무기를 얻는다 — 처음이면 Lv1, 또 얻으면 울림 +1(5 가 넘치면 강화석 10). 알림 글.</summary>
        public static string Give(string wid)
        {
            if (!GoWeapons.TryGet(wid, out var w) || w.Rarity <= 1) return "";
            if (!_inv.TryGetValue(wid, out var r))
            {
                _inv[wid] = new Rec { Lv = 1, Asc = 0, Ref = 1 };
                Changed?.Invoke();
                return $"★{w.Rarity} {w.Name}";
            }
            if (r.Ref < GoWeapons.RefineMax)
            {
                r.Ref++;
                _inv[wid] = r;
                Changed?.Invoke();
                return string.Format(GoLocalization.T("weapon.refine", "{0} 울림 {1}"), w.Name, r.Ref);
            }
            AddOre(GoWeapons.RefineOverOre);
            return string.Format(GoLocalization.T("weapon.refine_over", "강화석 +{0}({1} 울림 끝)"), GoWeapons.RefineOverOre, w.Name);
        }

        public static void AddOre(int n)
        {
            if (n <= 0) return;
            Ore += n;
            Changed?.Invoke();
        }

        /// <summary>든다 — 도감 동행만, 제 종류만. 한 자루를 옮기면 먼저 든 사람은 수련용으로.</summary>
        public static bool Equip(string id, string wid)
        {
            if (!TalentState.Trainable(id) || !GoWeapons.TryGet(wid, out var w) || w.Type != GoWeapons.TypeOf(id) || !Owned(wid)) return false;
            if (GoWeapons.IsShared(wid)) _equip.Remove(id);
            else
            {
                string prev = HolderOf(wid);
                if (prev != null && prev != id) _equip.Remove(prev);
                _equip[id] = wid;
            }
            Changed?.Invoke();
            return true;
        }

        public static bool CanUp(string wid, out string why, out (int ore, int gold) cost)
        {
            cost = default;
            if (GoWeapons.IsShared(wid)) { why = GoLocalization.T("weapon.why.shared", "수련용은 강화 안 함"); return false; }
            if (!_inv.TryGetValue(wid, out var r)) { why = GoLocalization.T("weapon.why.none", "없는 무기"); return false; }
            if (r.Lv >= GoWeapons.MaxLv) { why = GoLocalization.T("weapon.why.max", "최대 레벨"); return false; }
            if (r.Lv >= GoWeapons.Cap(r.Asc)) { why = GoLocalization.T("weapon.why.cap", "무기 벼림 필요"); return false; }
            cost = GoWeapons.UpCost(r.Lv);
            if (Ore < cost.ore) { why = GoLocalization.T("weapon.why.ore", "강화석 부족"); return false; }
            if (GoldState.Gold < cost.gold) { why = GoLocalization.T("talent.why.gold", "금 부족"); return false; }
            why = null;
            return true;
        }

        public static bool Up(string wid)
        {
            if (!CanUp(wid, out _, out var c)) return false;
            Ore -= c.ore;
            GoldState.TrySpend(c.gold);
            var r = _inv[wid];
            r.Lv++;
            _inv[wid] = r;
            Changed?.Invoke();
            return true;
        }

        public static bool CanAscend(string wid, out string why, out int gold)
        {
            gold = 0;
            if (GoWeapons.IsShared(wid) || !_inv.TryGetValue(wid, out var r)) { why = GoLocalization.T("weapon.why.no_asc", "벼림 안 함"); return false; }
            if (r.Asc >= GoWeapons.MaxAsc) { why = GoLocalization.T("weapon.why.asc_max", "최대 벼림"); return false; }
            if (r.Lv < GoWeapons.Cap(r.Asc)) { why = string.Format(GoLocalization.T("weapon.why.asc_lv", "Lv.{0} 에서 벼림"), GoWeapons.Cap(r.Asc)); return false; }
            gold = GoWeapons.AscGold[r.Asc];
            if (GoldState.Gold < gold) { why = GoLocalization.T("talent.why.gold", "금 부족"); return false; }
            why = null;
            return true;
        }

        public static bool Ascend(string wid)
        {
            if (!CanAscend(wid, out _, out int gold)) return false;
            GoldState.TrySpend(gold);
            var r = _inv[wid];
            r.Asc++;
            _inv[wid] = r;
            Changed?.Invoke();
            return true;
        }

        /// <summary>들판 전투가 읽는 한 사람 몫(주인공·도감 밖은 제 종류 수련용).</summary>
        public static Mods ModsOf(string id)
        {
            string wid = Equipped(id);
            GoWeapons.TryGet(wid, out var w);
            var (lv, asc, refine) = RecOf(wid);
            var m = new Mods
            {
                Weapon = w, Kit = GoWeapons.Kits[(int)w.Type], Lv = lv, Asc = asc, Ref = refine,
                Atk = GoWeapons.AtkAt(w, lv, asc), CritRate = GoWeapons.BaseCritRate, CritDmg = GoWeapons.BaseCritDmg,
                Pas = w.Pas, PasV = w.Pas != null ? GoWeapons.PassiveAt(w, refine) : 0f,
            };
            float sub = w.Sub != null ? GoWeapons.SubAt(w, lv) : 0f;
            switch (w.Sub)
            {
                case "atk_pct": m.AtkPct += sub; break;
                case "crit_rate": m.CritRate += sub; break;
                case "crit_dmg": m.CritDmg += sub; break;
                case "energy": m.Energy += sub; break;
                case "hp_pct": m.HpPct += sub; break;
            }
            return m;
        }

        /// <summary>상자 — 강화석(등급별) + 진귀 ★3·화려 ★4 무기. 알림 글.</summary>
        public static string OnChest(string chestId, GoTreasure.Grade grade)
        {
            var parts = new List<string>();
            int ore = GoWeapons.ChestOre[(int)grade];
            if (ore > 0) { AddOre(ore); parts.Add(string.Format(GoLocalization.T("weapon.ore_plus", "강화석 +{0}"), ore)); }
            string wid = GoWeapons.ChestWeapon(chestId, grade);
            if (wid != null) parts.Add(Give(wid));
            return string.Join(" · ", parts);
        }

        [System.Serializable]
        public struct InvEntry { public string wid; public int lv, asc, refine; }
        [System.Serializable]
        public struct EquipEntry { public string hero, wid; }

        public static List<InvEntry> SnapshotInv()
        {
            var list = new List<InvEntry>();
            foreach (var kv in _inv) list.Add(new InvEntry { wid = kv.Key, lv = kv.Value.Lv, asc = kv.Value.Asc, refine = kv.Value.Ref });
            list.Sort((a, b) => string.CompareOrdinal(a.wid, b.wid));
            return list;
        }

        public static List<EquipEntry> SnapshotEquip()
        {
            var list = new List<EquipEntry>();
            foreach (var kv in _equip) list.Add(new EquipEntry { hero = kv.Key, wid = kv.Value });
            list.Sort((a, b) => string.CompareOrdinal(a.hero, b.hero));
            return list;
        }

        public static void Restore(List<InvEntry> inv, List<EquipEntry> equip, int ore)
        {
            _inv.Clear();
            _equip.Clear();
            if (inv != null)
                foreach (var e in inv)
                    if (GoWeapons.TryGet(e.wid, out var w) && w.Rarity > 1)
                        _inv[e.wid] = new Rec { Lv = Mathf.Clamp(e.lv, 1, GoWeapons.MaxLv), Asc = Mathf.Clamp(e.asc, 0, GoWeapons.MaxAsc), Ref = Mathf.Clamp(e.refine, 1, GoWeapons.RefineMax) };
            if (equip != null) foreach (var e in equip) if (!string.IsNullOrEmpty(e.hero) && !string.IsNullOrEmpty(e.wid)) _equip[e.hero] = e.wid;
            Ore = Mathf.Max(0, ore);
            Changed?.Invoke();
        }

        public static void ResetForTest() => Restore(null, null, 0);
    }
}
