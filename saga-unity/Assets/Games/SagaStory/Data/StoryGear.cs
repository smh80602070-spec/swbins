using System;
using System.Collections.Generic;
using UnityEngine;

namespace Saga.Story.Data
{
    // tasks U-0246 — 웹 4종횡 장비 표의 꼴(표 자체는 tools/gen-story-gear.mjs 가 StoryGearTables.cs 로 뽑는다).
    public sealed class StoryGearSlot
    {
        public readonly string Key, Name, Emoji;
        public StoryGearSlot(string key, string name, string emoji) { Key = key; Name = name; Emoji = emoji; }
    }

    /// <summary>장비 한 줄 — 웹 data-gear.js [key, slot, 이름, 요구Lv, 공격, 방어, 체력, 값] · 고유(data-unique.js)는 Base 가 있다.</summary>
    public sealed class StoryGearDef
    {
        public readonly string Key, Slot, Name, Base; public readonly int Need, Atk, Def, Hp, Price;
        public StoryGearDef(string key, string slot, string name, int need, int atk, int def, int hp, int price, string b)
        { Key = key; Slot = slot; Name = name; Need = need; Atk = atk; Def = def; Hp = hp; Price = price; Base = b; }
        public bool Unique => Base != null;
        /// <summary>웹 등급(이름표뿐): 요구 Lv 1·5·12·20 → 기본·상급·희귀·영웅, 고유 → 전설.</summary>
        public int Grade => Unique ? 4 : Need >= 20 ? 3 : Need >= 12 ? 2 : Need >= 5 ? 1 : 0;
    }

    public sealed class StoryGearBonus
    {
        public readonly int Pieces, Atk, Def, Hp;
        public StoryGearBonus(int pieces, int atk, int def, int hp) { Pieces = pieces; Atk = atk; Def = def; Hp = hp; }
    }

    public sealed class StoryGearSetSkill
    {
        public readonly string Name, Emoji, Effect, Desc; public readonly float Mul, R, Cd;
        public StoryGearSetSkill(string name, string emoji, string effect, float mul, float r, float cd, string desc)
        { Name = name; Emoji = emoji; Effect = effect; Mul = mul; R = r; Cd = cd; Desc = desc; }
    }

    public sealed class StoryGearSet
    {
        public readonly string Key, Name; public readonly string[] Pieces; public readonly StoryGearBonus[] Bonus; public readonly StoryGearSetSkill Skill;
        public StoryGearSet(string key, string name, string[] pieces, StoryGearBonus[] bonus, StoryGearSetSkill skill)
        { Key = key; Name = name; Pieces = pieces; Bonus = bonus; Skill = skill; }
    }

    public static partial class StoryGearTables
    {
        public static StoryGearDef Find(string key) { if (key != null) foreach (var g in Gear) if (g.Key == key) return g; return null; }
        public static StoryGearDef UniqueOf(string baseKey) { foreach (var g in Gear) if (g.Base == baseKey) return g; return null; }
        /// <summary>웹 등급 이름표 색(data.js RARITY 결 — 흰·초록·파랑·보라·주황).</summary>
        public static readonly string[] GradeColors = { "#d8d8d8", "#7ad67a", "#6aa8ff", "#c07aff", "#ffa040" };
    }

    /// <summary>
    /// tasks U-0246 4종횡 장비(웹 gear.js·gear-set.js 결, 고돗 G-0399 짝) — 이 트랙은 가방·장비 창이 없어 **더 센 것만 바로 낀다**(2나락 U-0245 와 같은 결).
    /// 열 부위(무기·투구·갑옷·전군·전화·수갑·망토·반지·목걸이·귀걸이)에 표의 물건 키 하나씩. 요구 Lv 가 모자라면 안 낀다.
    /// 공격은 그대로 더하고(웹 power().atk), 체력은 최대 체력에, 방어는 받는 피해를 def/(def+40) 만큼(상한 60%) 깎는다(웹 gear.cut).
    /// 떨굼 = 웹 rollDrop: 잡졸 3.5%·두목 90%, 풀은 요구 Lv ≤ 내 Lv+3, 두목이 Lv.20 을 떨구면 16% 로 고유. 주문서는 없다(가방이 없어서).
    /// 세트 = 조각 수만큼 2·3·4 점 효과, 다 모으면 세트 무예(C).
    /// </summary>
    public static class StoryGear
    {
        public const float GruntDrop = 0.035f, BossDrop = 0.9f, UniqueChance = 0.16f, CutK = 40f, CutCap = 0.6f;
        /// <summary>떨굼 켜기(끄기 `SAGA_GEAR_DROPS=0`).</summary>
        public static bool DropsOn = Environment.GetEnvironmentVariable("SAGA_GEAR_DROPS") != "0";

        private static readonly Dictionary<string, string> _worn = new Dictionary<string, string>();
        public static IReadOnlyDictionary<string, string> Worn => _worn;
        private static uint _rng = 20260824u;
        public static event Action Changed;

        public static int Atk { get; private set; }
        public static int Def { get; private set; }
        public static int Hp { get; private set; }
        public static StoryGearSet FullSet { get; private set; }
        public static readonly Dictionary<string, int> SetCount = new Dictionary<string, int>();

        /// <summary>받는 피해에 곱할 값(1 − 막음).</summary>
        public static float TakeMul => Def <= 0 ? 1f : 1f - Mathf.Min(CutCap, Def / (Def + CutK));

        private static float Next()
        {
            unchecked
            {
                _rng += 0x6D2B79F5u;
                uint t = _rng;
                t = (t ^ (t >> 15)) * (t | 1u);
                t ^= t + (t ^ (t >> 7)) * (t | 61u);
                return (t ^ (t >> 14)) / 4294967296f;
            }
        }

        private static int Score(StoryGearDef d) => d == null ? 0 : d.Atk * 3 + d.Def * 2 + d.Hp;

        /// <summary>요구 Lv 를 채우고 그 부위 지금 것보다 세면 낀다(세트 조각은 세트 점수가 오르면 덤 +20).</summary>
        public static bool EquipIfBetter(string key)
        {
            var d = StoryGearTables.Find(key);
            if (d == null || d.Need > StoryJobState.Level) return false;
            _worn.TryGetValue(d.Slot, out var cur);
            var c = StoryGearTables.Find(cur);
            int gain = Score(d) - Score(c);
            var set = SetOf(d.Key);
            if (set != null && SetOf(cur) != set) gain += 20;
            if (c != null && gain <= 0) return false;
            _worn[d.Slot] = d.Key;
            Recalc();
            return true;
        }

        public static StoryGearSet SetOf(string key)
        {
            if (key == null) return null;
            foreach (var s in StoryGearTables.Sets) foreach (var p in s.Pieces) if (p == key) return s;
            return null;
        }

        public static void Recalc()
        {
            int atk = 0, def = 0, hp = 0;
            SetCount.Clear();
            FullSet = null;
            foreach (var kv in _worn)
            {
                var d = StoryGearTables.Find(kv.Value);
                if (d == null || d.Need > StoryJobState.Level) continue;
                atk += d.Atk; def += d.Def; hp += d.Hp;
                var s = SetOf(d.Key);
                if (s != null) SetCount[s.Key] = (SetCount.TryGetValue(s.Key, out int n) ? n : 0) + 1;
            }
            foreach (var s in StoryGearTables.Sets)
            {
                if (!SetCount.TryGetValue(s.Key, out int n)) continue;
                foreach (var b in s.Bonus) if (b.Pieces <= n) { atk += b.Atk; def += b.Def; hp += b.Hp; }
                if (n >= s.Pieces.Length && s.Skill != null && FullSet == null) FullSet = s;
            }
            Atk = atk; Def = def; Hp = hp;
            Changed?.Invoke();
        }

        /// <summary>`StoryEnemy.Die` — 떨군 물건 키(없으면 null). 제 난수라 전역 Random 흐름을 안 건드린다.</summary>
        public static string RollDrop(bool boss)
        {
            if (!DropsOn) return null;
            if (Next() >= (boss ? BossDrop : GruntDrop)) return null;
            int lv = StoryJobState.Level;
            var pool = new List<StoryGearDef>();
            foreach (var g in StoryGearTables.Gear) if (!g.Unique && g.Need <= lv + 3) pool.Add(g);
            if (pool.Count == 0) foreach (var g in StoryGearTables.Gear) if (!g.Unique && g.Need == 1) pool.Add(g);
            if (pool.Count == 0) return null;
            var picked = pool[Mathf.Min(pool.Count - 1, (int)(Next() * pool.Count))];
            if (boss && picked.Need == 20 && Next() < UniqueChance)
            {
                var u = StoryGearTables.UniqueOf(picked.Key);
                if (u != null) return u.Key;
            }
            return picked.Key;
        }

        /// <summary>떨굼 한 줄(토스트) — 등급색 이름 + 바로 꼈는지.</summary>
        public static string LootLine(string key, bool worn)
        {
            var d = StoryGearTables.Find(key);
            if (d == null) return "";
            string name = $"<color={StoryGearTables.GradeColors[d.Grade]}>{(d.Unique ? "★ " : "")}{d.Name}</color>";
            return string.Format(worn ? StoryLocalization.T("gear.loot_worn", "{0} 을(를) 주웠다 — 바로 꼈다") : StoryLocalization.T("gear.loot_plain", "{0} 을(를) 주웠다"), name);
        }

        // ── 세이브 ───────────────────────────────────────────
        [Serializable] private class Snap { public uint rng; public string[] slots; public string[] keys; }

        public static string Snapshot()
        {
            var s = new Snap { rng = _rng, slots = new string[_worn.Count], keys = new string[_worn.Count] };
            int i = 0;
            foreach (var kv in _worn) { s.slots[i] = kv.Key; s.keys[i] = kv.Value; i++; }
            return JsonUtility.ToJson(s);
        }

        /// <summary>없거나 깨진 값이면 빈 칸(옛 세이브 그대로 열림).</summary>
        public static void Restore(string json)
        {
            _worn.Clear();
            _rng = 20260824u;
            if (!string.IsNullOrEmpty(json))
            {
                try
                {
                    var s = JsonUtility.FromJson<Snap>(json);
                    if (s.rng != 0u) _rng = s.rng;
                    if (s.slots != null && s.keys != null)
                        for (int i = 0; i < s.slots.Length && i < s.keys.Length; i++)
                        {
                            var d = StoryGearTables.Find(s.keys[i]);
                            if (d != null && d.Slot == s.slots[i]) _worn[d.Slot] = d.Key;
                        }
                }
                catch (Exception) { _worn.Clear(); }
            }
            Recalc();
        }
    }
}
