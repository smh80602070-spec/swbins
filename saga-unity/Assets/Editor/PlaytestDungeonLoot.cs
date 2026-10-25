using System.Collections.Generic;
using UnityEditor;
using UnityEngine;
using Saga.Dungeon.Data;

namespace Saga.EditorTools
{
    /// <summary>
    /// tasks U-0245 2나락 굴린 장비 진단 — `-executeMethod Saga.EditorTools.PlaytestDungeonLoot.Run`(-quit 없이, 편집 모드 — 씬 안 엶).
    /// 표 수(웹과 같음) · 같은 id 는 같은 물건 · 세트는 보물·고유는 전설에서만 · 등급 분포 · 일곱 부위 장착·세트 세 점·무기 공격력 · 세이브 왕복 · 장비 없으면 옛 값.
    /// </summary>
    public static class PlaytestDungeonLoot
    {
        private const string Tag = "[PlaytestDungeonLoot]";

        public static void Run()
        {
            PlaytestKit.Begin(Tag);
            using (PlaytestKit.ErrorCounter())
            {
                try
                {
                    Fresh();
                    CheckTables();
                    CheckBaseline();
                    CheckRolls();
                    CheckEquipAndSet();
                    CheckSaveRoundTrip();
                }
                catch (System.Exception e) { PlaytestKit.Fail("예외 " + e); }
                finally { Fresh(); }
            }
            PlaytestKit.Summary("PlaytestDungeonLoot");
            if (Application.isBatchMode) EditorApplication.Exit(PlaytestKit.Fails == 0 ? 0 : 1);
        }

        private static void Fresh()
        {
            Gear.Restore(null);
            HeroState.Restore(1, 0, HeroState.BaseHp, 0, "wp_start", null, null);
        }

        private static void CheckTables()
        {
            PlaytestKit.Check(GearTables.Tiers.Length == 5, $"등급 {GearTables.Tiers.Length} ≠ 5");
            PlaytestKit.Check(GearTables.Bases.Length >= 35, $"바탕 {GearTables.Bases.Length} < 35");
            PlaytestKit.Check(GearTables.Affixes.Length >= 14, $"접사 {GearTables.Affixes.Length} < 14");
            PlaytestKit.Check(GearTables.Sets.Length >= 10, $"세트 {GearTables.Sets.Length} < 10");
            PlaytestKit.Check(GearTables.Uniques.Length >= 30, $"고유 {GearTables.Uniques.Length} < 30");
            var seen = new HashSet<string>();
            foreach (var s in GearTables.Sets)
            {
                PlaytestKit.Check(s.Skill != null, $"세트 {s.Key} 세트 무예 없음");
                foreach (var p in s.Pieces)
                {
                    PlaytestKit.Check(GearTables.Base(p) != null, $"세트 {s.Key} 조각 {p} 바탕 없음");
                    PlaytestKit.Check(seen.Add(p), $"바탕 {p} 가 두 벌에 듦");
                }
            }
            foreach (var u in GearTables.Uniques) PlaytestKit.Check(GearTables.Base(u.Base) != null, $"고유 {u.Key} 바탕 {u.Base} 없음");
            foreach (var b in GearTables.Bases)
                PlaytestKit.Check(b.Slot == "weapon" || System.Array.IndexOf(Gear.SideSlots, b.Slot) >= 0, $"바탕 {b.Key} 부위 {b.Slot} 모름");
            Debug.Log($"{Tag} tables OK — 등급 {GearTables.Tiers.Length}·바탕 {GearTables.Bases.Length}·접사 {GearTables.Affixes.Length}·세트 {GearTables.Sets.Length}·고유 {GearTables.Uniques.Length}");
        }

        private static float _baseAtk;
        private static int _baseHp;

        private static void CheckBaseline()
        {
            _baseAtk = HeroState.Atk;
            _baseHp = HeroState.HpMax;
            PlaytestKit.Check(Mathf.Approximately(_baseAtk, HeroState.BaseAtk), $"장비 없는 공격력 {_baseAtk} ≠ {HeroState.BaseAtk}");
            PlaytestKit.Check(_baseHp == HeroState.BaseHp, $"장비 없는 체력 {_baseHp} ≠ {HeroState.BaseHp}");
        }

        private static void CheckRolls()
        {
            var tiers = new int[5];
            int sets = 0, uniques = 0;
            for (int i = 0; i < 2000; i++)
            {
                string id = Gear.Roll(20);
                var it = Gear.Parse(id);
                if (it == null) { PlaytestKit.Fail("굴린 id 못 읽음 " + id); return; }
                tiers[it.Tier.Key]++;
                if (it.Set != null) { sets++; PlaytestKit.Check(it.Tier.Key == GearTables.SetTier, $"세트 조각 등급 {it.Tier.Key} — {id}"); }
                if (it.Unique != null) { uniques++; PlaytestKit.Check(it.Tier.Key == 4, $"고유 등급 {it.Tier.Key} — {id}"); }
                if (it.Unique == null) PlaytestKit.Check(it.AffixKeys.Count == it.Tier.Affix, $"접사 수 {it.AffixKeys.Count} ≠ {it.Tier.Affix} — {id}");
                if (it.IsWeapon) PlaytestKit.Check(ItemData.Get(id) != null && ItemData.Get(id).AtkBonus == it.Main, $"무기 ItemData 안 맞음 {id}");
                else PlaytestKit.Check(ItemData.Get(id) == null, $"무기 아닌데 ItemData {id}");
                if (i < 50)
                {
                    // 같은 id 는 늘 같은 물건(세이브엔 id 만) — 캐시를 거치지 않는 새 문자열로 다시
                    var again = Gear.Parse(string.Copy(id));
                    PlaytestKit.Check(again != null && Gear.NameOf(again) == Gear.NameOf(it), $"다시 읽은 이름 다름 {id}");
                }
            }
            PlaytestKit.Check(tiers[0] > tiers[1] && tiers[1] > tiers[2] && tiers[2] > tiers[3] && tiers[3] >= tiers[4] && tiers[4] > 0,
                $"등급 분포 {string.Join("/", tiers)}");
            PlaytestKit.Check(sets > 0 && uniques > 0, $"세트 {sets}·고유 {uniques} 하나도 안 나옴");
            Debug.Log($"{Tag} rolls OK — 2000 굴림 등급 {string.Join("/", tiers)} · 세트 조각 {sets} · 고유 {uniques}");
        }

        private static void CheckEquipAndSet()
        {
            Fresh();
            var set = GearTables.Sets[0];
            string weaponPiece = null;
            foreach (var p in set.Pieces)
            {
                string id = Gear.Roll(20, baseKey: p, tier: GearTables.SetTier, set: true);
                var it = Gear.Parse(id);
                PlaytestKit.Check(it != null && it.Set == set, $"세트 조각 아님 {id}");
                if (it.IsWeapon) { weaponPiece = id; HeroState.Restore(1, 0, HeroState.BaseHp, 0, id, null, null); }
                else PlaytestKit.Check(Gear.EquipIfBetter(id), $"빈 칸인데 안 갖춤 {id}");
            }
            var t = Gear.Totals;
            PlaytestKit.Check(t.SetCount.TryGetValue(set.Key, out int n) && n == 3, $"세트 {set.Key} 점수 {n} ≠ 3");
            PlaytestKit.Check(t.FullSet == set, $"세트 무예 한 벌 {t.FullSet?.Key ?? "없음"} ≠ {set.Key}");
            PlaytestKit.Check(HeroState.Atk > _baseAtk, $"세트 갖춘 공격력 {HeroState.Atk} ≤ 맨몸 {_baseAtk}");
            if (weaponPiece != null) PlaytestKit.Check(HeroState.EquippedWeapon != null && HeroState.EquippedWeapon.WebTier == GearTables.SetTier, "굴린 무기가 무기 칸에 없음");

            // 같은 부위에 더 약한 상품은 안 갈아 끼운다
            string slot = null;
            foreach (var kv in Gear.Slots) { slot = kv.Key; break; }
            if (slot != null)
            {
                string weak = Gear.Roll(1, slot: slot, tier: 0);
                PlaytestKit.Check(!Gear.EquipIfBetter(weak), $"약한 {weak} 로 {slot} 갈아 끼움");
            }
            Debug.Log($"{Tag} equip OK — 세트 {set.Key} 세 점 · 공격력 {_baseAtk:F1} → {HeroState.Atk:F1} · 체력 {_baseHp} → {HeroState.HpMax} · 세트 무예 {set.Skill.Name}");
        }

        private static void CheckSaveRoundTrip()
        {
            string snap = Gear.Snapshot();
            float atk = HeroState.Atk;
            int hp = HeroState.HpMax, seq = Gear.Seq, slots = Gear.Slots.Count;
            Gear.Restore(null);
            PlaytestKit.Check(Gear.Slots.Count == 0, "빈 Restore 뒤 칸이 남음");
            Gear.Restore(snap);
            PlaytestKit.Check(Gear.Slots.Count == slots && Gear.Seq == seq, $"세이브 왕복 칸 {Gear.Slots.Count}/{slots}·차례 {Gear.Seq}/{seq}");
            PlaytestKit.Check(Mathf.Approximately(HeroState.Atk, atk) && HeroState.HpMax == hp, $"세이브 왕복 능력치 {HeroState.Atk}/{atk}·{HeroState.HpMax}/{hp}");
            Gear.Restore("{깨진 json");
            PlaytestKit.Check(Gear.Slots.Count == 0, "깨진 세이브에서 칸이 남음");
            Debug.Log($"{Tag} save OK — 칸 {slots}·차례 {seq}");
        }
    }
}
