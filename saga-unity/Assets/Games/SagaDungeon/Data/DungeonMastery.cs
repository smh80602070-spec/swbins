using System;
using System.Collections.Generic;
using UnityEngine;

namespace Saga.Dungeon.Data
{
    /// <summary>
    /// tasks U-0178 장비 숙련(고돗 G-0317 `dungeon_mastery.gd` 짝, 웹 짝 없음) — 든 무기는 처치마다, 갑주는 맞을 때마다 숙련 +1,
    /// 문턱 10·30·60·100·150 에서 단계(최고 5). 무기 단계마다 공격 +3%(<see cref="HeroState.HitDamage"/> 곱), 갑주 단계마다 받는 피해 −2%
    /// (<see cref="HeroState.TakeDamage"/> 곱). 이 트랙엔 갑주 칸이 없어(무기 갑·을·보석뿐) **갑주 = 몸에 걸친 한 벌** — 갈 일이 없으니
    /// 고돗의 "다른 부위를 갈면 절반 물려받기"도 없다. 무기는 id 마다 따로 쌓여 을로 내려도·다시 쥐어도 그대로(고돗과 같음).
    /// 소환·동행 처치도 든 무기 숙련으로 센다(고돗과 같음).
    /// </summary>
    public static class DungeonMastery
    {
        public static readonly int[] Steps = { 10, 30, 60, 100, 150 };
        public const int MaxTier = 5;
        public const float WeaponPct = 0.03f, GuardPct = 0.02f;

        /// <summary>끄면 쌓기·효과 둘 다 없음(고돗 `SAGA_MASTERY=0` 짝).</summary>
        public static bool On = true;

        [Serializable]
        private class Store { public List<string> ids = new List<string>(); public List<int> xps = new List<int>(); public int guard; }

        private static Store _s = new Store();

        /// <summary>단계가 오른 순간(무기냐·무기 id(갑주면 null)·새 단계) — 토스트.</summary>
        public static event Action<bool, string, int> TierUp;

        public static int Tier(int xp)
        {
            int t = 0;
            while (t < MaxTier && xp >= Steps[t]) t++;
            return t;
        }

        public static int WeaponXp(string id)
        {
            int i = id == null ? -1 : _s.ids.IndexOf(id);
            return i < 0 ? 0 : _s.xps[i];
        }

        public static int GuardXp => _s.guard;
        public static int WeaponTier(string id) => Tier(WeaponXp(id));
        public static int GuardTier => Tier(_s.guard);

        public static float AtkMul => On ? 1f + WeaponPct * WeaponTier(HeroState.EquippedWeaponId) : 1f;
        public static float GuardMul => On ? 1f - GuardPct * GuardTier : 1f;

        /// <summary>`DungeonEnemy.Die` — 누가 쓰러뜨렸든 지금 든 무기에 +1.</summary>
        public static void OnKill()
        {
            if (!On) return;
            string id = HeroState.EquippedWeaponId;
            if (string.IsNullOrEmpty(id)) return;
            int i = _s.ids.IndexOf(id);
            if (i < 0) { _s.ids.Add(id); _s.xps.Add(0); i = _s.ids.Count - 1; }
            int before = Tier(_s.xps[i]);
            _s.xps[i]++;
            int after = Tier(_s.xps[i]);
            if (after > before) TierUp?.Invoke(true, id, after);
        }

        /// <summary>`HeroState.TakeDamage` — 실제로 체력이 깎였을 때만 +1.</summary>
        public static void OnHurt()
        {
            if (!On) return;
            int before = GuardTier;
            _s.guard++;
            if (GuardTier > before) TierUp?.Invoke(false, null, GuardTier);
        }

        /// <summary>HUD 꼬리(" ★2") — 0 단계면 빈 글.</summary>
        public static string Stars(int tier) => tier > 0 ? " ★" + tier : "";

        public static string Snapshot() => JsonUtility.ToJson(_s);

        public static void Restore(string json)
        {
            Store s = null;
            if (!string.IsNullOrEmpty(json)) { try { s = JsonUtility.FromJson<Store>(json); } catch (ArgumentException) { s = null; } }
            _s = s ?? new Store();
            if (_s.ids == null || _s.xps == null || _s.ids.Count != _s.xps.Count) { _s.ids = new List<string>(); _s.xps = new List<int>(); }
            _s.guard = Math.Max(0, _s.guard);
        }

        public static void ResetForTest() => Restore(null);
    }
}
