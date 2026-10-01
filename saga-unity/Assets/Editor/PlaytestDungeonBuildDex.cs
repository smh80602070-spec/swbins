using System;
using System.Collections.Generic;
using System.Linq;
using UnityEditor;
using UnityEngine;
using Saga.Dungeon.Data;
using DungeonSave = Saga.Dungeon.Data.SaveState;

namespace Saga.EditorTools
{
    /// <summary>
    /// `un.dg.build-dex` 빌드·도감·보석/영웅 상태 — 규칙 층만 본다(화면·씬 없이, RECURRING R-3). ① 무기 표: 키=id·등급 0~2 가 공격력 서열을 따름·비전은 명소 무기만 ② 보석 표 오름차순
    /// ③ 영웅: 레벨업(경험치 20×1.3^n)·여러 레벨 한 번에·높은 레벨에서 안 멈춤·HP/공격력 성장 ④ 장비·보석은 "더 센 것만"·공격력에 합산 ⑤ 금: 더하기·쓰기 ⑥ 피해·무적·묘비(금 떨어뜨림/억제)·치유
    /// ⑦ 복원은 범위를 자름 ⑧ 도감: 처음 만난 이름만 기록·스냅샷 왕복 ⑨ 세이브 JSON 왕복(영웅·장비·보석·도감).
    /// `-executeMethod Saga.EditorTools.PlaytestDungeonBuildDex.Run` → "[PlaytestDungeonBuildDex] OK/FAIL".
    /// </summary>
    public static class PlaytestDungeonBuildDex
    {
        [MenuItem("Saga/Playtest Dungeon Build Dex")]
        public static void Run()
        {
            PlaytestKit.Begin("[PlaytestDungeonBuildDex]");
            string saved = DungeonSave.ToJson();
            using (PlaytestKit.IsolatedSaves())
            using (PlaytestKit.ErrorCounter())
            {
                CheckItems();
                CheckGems();
                CheckLevels();
                CheckEquip();
                CheckGold();
                CheckDamage();
                CheckRestore();
                CheckBestiary();
                CheckSaveRoundTrip();
            }
            HeroState.Invulnerable = false;
            HeroState.GraveSuppressed = false;
            DungeonSave.ApplyJson(saved);
            PlaytestKit.Summary("PlaytestDungeonBuildDex");
            if (Application.isBatchMode) EditorApplication.Exit(PlaytestKit.Fails == 0 ? 0 : 1);
        }

        private static void Fresh() => HeroState.Restore(1, 0, HeroState.BaseHp, 0, null, null);

        private static void CheckItems()
        {
            PlaytestKit.Check(ItemData.Catalog.Count >= 10, $"un.dg.build-dex: 무기 표 {ItemData.Catalog.Count}종 (표가 줄었나)");
            foreach (var kv in ItemData.Catalog)
            {
                var it = kv.Value;
                PlaytestKit.Check(kv.Key == it.Id && ItemData.Get(kv.Key) == it, $"un.dg.build-dex: 무기 키 {kv.Key} ≠ id {it.Id}");
                PlaytestKit.Check(it.AtkBonus >= 0f && it.Grade >= 0 && it.Grade <= 2 && !string.IsNullOrEmpty(it.Name), $"un.dg.build-dex: 무기 {kv.Key} 값 이상");
                if (it.Lore != Secret.None) PlaytestKit.Check(kv.Key.StartsWith("wp_lm_"), $"un.dg.build-dex: 명소 무기가 아닌 {kv.Key} 에 비전이 붙음");
            }
            PlaytestKit.Check(ItemData.Get("wp_start") != null && ItemData.Get("wp_start").AtkBonus == 0f && ItemData.Get("wp_start").Grade == 0, "un.dg.build-dex: 시작 무기(목검)가 0 이 아님");
            for (int g = 0; g < 2; g++)
            {
                var lo = ItemData.Catalog.Values.Where(i => i.Grade == g).Select(i => i.AtkBonus).DefaultIfEmpty(0f).Max();
                var hi = ItemData.Catalog.Values.Where(i => i.Grade == g + 1).Select(i => i.AtkBonus).DefaultIfEmpty(float.MaxValue).Min();
                PlaytestKit.Check(lo < hi, $"un.dg.build-dex: 등급 {g} 최대 공격력 {lo} 가 등급 {g + 1} 최소 {hi} 이상(서열이 안 맞음)");
            }
            PlaytestKit.Check(ItemData.Get("nope") == null && ItemData.Get(null) == null, "un.dg.build-dex: 모르는 무기가 null 이 아님");
        }

        private static void CheckGems()
        {
            var gems = GemData.Catalog.Values.OrderBy(g => g.AtkBonus).ToList();
            PlaytestKit.Check(gems.Count == 3, $"un.dg.build-dex: 보석 {gems.Count}종 (기대 3)");
            foreach (var kv in GemData.Catalog)
                PlaytestKit.Check(kv.Key == kv.Value.Id && GemData.Get(kv.Key) == kv.Value && kv.Value.AtkBonus > 0f && !string.IsNullOrEmpty(kv.Value.Name), $"un.dg.build-dex: 보석 {kv.Key} 이상");
            PlaytestKit.Check(gems.Select(g => g.AtkBonus).Distinct().Count() == gems.Count, "un.dg.build-dex: 보석 공격력이 겹침");
            PlaytestKit.Check(GemData.Get("nope") == null && GemData.Get(null) == null, "un.dg.build-dex: 모르는 보석이 null 이 아님");
        }

        private static void CheckLevels()
        {
            Fresh();
            PlaytestKit.Check(HeroState.Level == 1 && HeroState.HpMax == 30 && Mathf.Approximately(HeroState.Atk, 30f) && HeroState.ExpToNext == 20, $"un.dg.build-dex: 1레벨 기준 hpMax={HeroState.HpMax} atk={HeroState.Atk} next={HeroState.ExpToNext}");
            int fired = 0, last = 0;
            Action<int> on = lv => { fired++; last = lv; };
            HeroState.LeveledUp += on;
            try
            {
                HeroState.AddExp(0); HeroState.AddExp(-5);
                PlaytestKit.Check(HeroState.Exp == 0 && fired == 0, "un.dg.build-dex: 0·음수 경험치가 들어감");
                HeroState.AddExp(19);
                PlaytestKit.Check(HeroState.Level == 1 && HeroState.Exp == 19 && fired == 0, "un.dg.build-dex: 19 경험치로 레벨업");
                HeroState.AddExp(1);
                PlaytestKit.Check(HeroState.Level == 2 && HeroState.Exp == 0 && fired == 1 && last == 2, $"un.dg.build-dex: 레벨업 lv={HeroState.Level} exp={HeroState.Exp} fired={fired}");
                PlaytestKit.Check(HeroState.HpMax == 36 && Mathf.Approximately(HeroState.Atk, 36f) && HeroState.ExpToNext == 26, $"un.dg.build-dex: 2레벨 hpMax={HeroState.HpMax} atk={HeroState.Atk} next={HeroState.ExpToNext}");
                HeroState.AddExp(1000);
                PlaytestKit.Check(HeroState.Level > 4 && fired == HeroState.Level - 1 && HeroState.Exp >= 0 && HeroState.Exp < HeroState.ExpToNext, $"un.dg.build-dex: 큰 경험치 lv={HeroState.Level} exp={HeroState.Exp}/{HeroState.ExpToNext} fired={fired}");
            }
            finally { HeroState.LeveledUp -= on; }
            HeroState.Restore(90, 0, 100, 0, null, null);
            PlaytestKit.Check(HeroState.ExpToNext > 0, $"un.dg.build-dex: 90레벨 필요 경험치가 {HeroState.ExpToNext} (오버플로)");
            HeroState.AddExp(5);
            PlaytestKit.Check(HeroState.Level == 90 && HeroState.Exp == 5, "un.dg.build-dex: 높은 레벨에서 경험치 처리가 어긋남");
            Fresh();
            PlaytestKit.Check(HeroState.HitDamage >= 4f, "un.dg.build-dex: 한 타 피해가 최소 4 보다 작음");
        }

        private static void CheckEquip()
        {
            Fresh();
            string seen = null; int events = 0;
            Action<string> on = id => { seen = id; events++; };
            HeroState.EquipmentChanged += on;
            try
            {
                int e0 = events;
                PlaytestKit.Check(HeroState.EquipIfBetter("wp_axe") && HeroState.EquippedWeaponId == "wp_axe" && seen == "wp_axe" && events == e0 + 1, "un.dg.build-dex: 쇠도끼 장착/이벤트 실패");
                PlaytestKit.Check(!HeroState.EquipIfBetter("wp_axe") && !HeroState.EquipIfBetter("wp_start") && !HeroState.EquipIfBetter("nope") && HeroState.EquippedWeaponId == "wp_axe", "un.dg.build-dex: 같거나 못한/모르는 무기로 바뀜");
                PlaytestKit.Check(HeroState.EquipIfBetter("wp_saber") && HeroState.EquippedWeaponId == "wp_saber", "un.dg.build-dex: 더 센 환도로 안 바뀜");
                PlaytestKit.Check(Mathf.Approximately(HeroState.Atk, 30f + 18f), $"un.dg.build-dex: 무기 공격력 합산 {HeroState.Atk}");
            }
            finally { HeroState.EquipmentChanged -= on; }

            Fresh();
            PlaytestKit.Check(HeroState.SocketIfBetter("gem_sapphire") && HeroState.SocketedGemId == "gem_sapphire", "un.dg.build-dex: 남주 소켓 실패");
            PlaytestKit.Check(!HeroState.SocketIfBetter("gem_jade") && !HeroState.SocketIfBetter("gem_sapphire") && !HeroState.SocketIfBetter("nope") && HeroState.SocketedGemId == "gem_sapphire", "un.dg.build-dex: 같거나 못한/모르는 보석으로 바뀜");
            PlaytestKit.Check(HeroState.SocketIfBetter("gem_ruby") && Mathf.Approximately(HeroState.Atk, 30f + 14f), $"un.dg.build-dex: 홍옥 합산 {HeroState.Atk}");
            HeroState.EquipIfBetter("wp_axe");
            PlaytestKit.Check(Mathf.Approximately(HeroState.Atk, 30f + 12f + 14f), $"un.dg.build-dex: 무기+보석 합산 {HeroState.Atk}");
        }

        private static void CheckGold()
        {
            Fresh();
            HeroState.AddGold(0); HeroState.AddGold(-4);
            PlaytestKit.Check(HeroState.Gold == 0, "un.dg.build-dex: 0·음수 금이 더해짐");
            HeroState.AddGold(30);
            PlaytestKit.Check(!HeroState.TrySpendGold(31) && HeroState.Gold == 30, "un.dg.build-dex: 모자란 금이 쓰임");
            PlaytestKit.Check(!HeroState.TrySpendGold(0) && !HeroState.TrySpendGold(-1) && HeroState.Gold == 30, "un.dg.build-dex: 0·음수 지출이 성공/변경");
            PlaytestKit.Check(HeroState.TrySpendGold(30) && HeroState.Gold == 0, "un.dg.build-dex: 딱 맞게 쓰기 실패");
        }

        private static void CheckDamage()
        {
            Fresh();
            HeroState.Invulnerable = false; HeroState.GraveSuppressed = false;
            int died = -1;
            Action<int> on = g => died = g;
            HeroState.Died += on;
            try
            {
                int expect = (int)Math.Round(10f / BlessingState.DefMultiplier, MidpointRounding.AwayFromZero);
                HeroState.TakeDamage(0); HeroState.TakeDamage(-3);
                PlaytestKit.Check(HeroState.Hp == HeroState.HpMax, "un.dg.build-dex: 0·음수 피해가 들어감");
                HeroState.TakeDamage(10);
                PlaytestKit.Check(HeroState.Hp == HeroState.HpMax - expect, $"un.dg.build-dex: 피해 hp={HeroState.Hp} (기대 {HeroState.HpMax - expect})");
                HeroState.Invulnerable = true;
                int hp = HeroState.Hp;
                HeroState.TakeDamage(5);
                PlaytestKit.Check(HeroState.Hp == hp, "un.dg.build-dex: 무적인데 피해를 입음");
                HeroState.Invulnerable = false;
                HeroState.HealBy(0); HeroState.HealBy(-2);
                PlaytestKit.Check(HeroState.Hp == hp, "un.dg.build-dex: 0·음수 치유가 hp 를 바꿈");
                HeroState.HealBy(9999);
                PlaytestKit.Check(HeroState.Hp == HeroState.HpMax, "un.dg.build-dex: 치유가 hpMax 를 안 지킴");

                HeroState.AddGold(77);
                HeroState.TakeDamage(9999);
                PlaytestKit.Check(HeroState.Hp == 0 && died == 77 && HeroState.Gold == 0, $"un.dg.build-dex: 쓰러짐 hp={HeroState.Hp} 떨군 금={died} 남은 금={HeroState.Gold}");
                HeroState.HealBy(10);
                PlaytestKit.Check(HeroState.Hp == 0, "un.dg.build-dex: 쓰러진 영웅이 HealBy 로 일어남");
                HeroState.FullHeal();
                PlaytestKit.Check(HeroState.Hp == HeroState.HpMax, "un.dg.build-dex: FullHeal 실패");

                died = -1;
                HeroState.GraveSuppressed = true;
                HeroState.AddGold(40);
                HeroState.TakeDamage(9999);
                PlaytestKit.Check(died == 0 && HeroState.Gold == 40, $"un.dg.build-dex: 묘비 억제 중에 금이 떨어짐 {died}/{HeroState.Gold}");
            }
            finally
            {
                HeroState.Died -= on;
                HeroState.GraveSuppressed = false;
                HeroState.Invulnerable = false;
            }
        }

        private static void CheckRestore()
        {
            HeroState.Restore(-4, -9, 9999, -1, "", "gem_ruby");
            PlaytestKit.Check(HeroState.Level == 1 && HeroState.Exp == 0 && HeroState.Gold == 0 && HeroState.Hp == HeroState.HpMax && HeroState.EquippedWeaponId == "wp_start" && HeroState.SocketedGemId == "gem_ruby",
                $"un.dg.build-dex: 복원이 범위를 안 자름 lv={HeroState.Level} exp={HeroState.Exp} gold={HeroState.Gold} hp={HeroState.Hp}/{HeroState.HpMax} weapon={HeroState.EquippedWeaponId}");
            HeroState.Restore(3, 5, 0, 10, "wp_axe", null);
            PlaytestKit.Check(HeroState.Hp == HeroState.HpMax && HeroState.SocketedGemId == null, "un.dg.build-dex: hp 0 복원이 가득 채움이 아님/보석이 안 비워짐");
            HeroState.Restore(3, 5, 7, 10, "wp_axe", null);
            PlaytestKit.Check(HeroState.Hp == 7, "un.dg.build-dex: 정상 hp 복원이 값을 바꿈");
        }

        private static void CheckBestiary()
        {
            BestiaryState.Restore(null);
            PlaytestKit.Check(BestiaryState.Count == 0, "un.dg.build-dex: 도감 초기화 실패");
            PlaytestKit.Check(!BestiaryState.Record(null) && !BestiaryState.Record("") && BestiaryState.Count == 0, "un.dg.build-dex: 빈 이름이 기록됨");
            PlaytestKit.Check(BestiaryState.Record("황건적") && BestiaryState.IsDiscovered("황건적") && BestiaryState.Count == 1, "un.dg.build-dex: 첫 발견 기록 실패");
            PlaytestKit.Check(!BestiaryState.Record("황건적") && BestiaryState.Count == 1, "un.dg.build-dex: 같은 이름이 다시 '새 발견'");
            BestiaryState.Record("귀두 두목");
            var snap = BestiaryState.Snapshot();
            PlaytestKit.Check(snap.Length == 2, $"un.dg.build-dex: 스냅샷 {snap.Length}개 (기대 2)");
            BestiaryState.Restore(new[] { "a", "", null, "a", "b" });
            PlaytestKit.Check(BestiaryState.Count == 2 && BestiaryState.IsDiscovered("a") && BestiaryState.IsDiscovered("b") && !BestiaryState.IsDiscovered("황건적"), "un.dg.build-dex: 복원이 이전 기록을 안 덮음/빈 이름·중복을 안 거름");
            BestiaryState.Restore(snap);
            PlaytestKit.Check(BestiaryState.IsDiscovered("황건적") && BestiaryState.IsDiscovered("귀두 두목") && BestiaryState.Count == 2, "un.dg.build-dex: 스냅샷 왕복 실패");
        }

        private static void CheckSaveRoundTrip()
        {
            HeroState.Restore(5, 12, 20, 345, "wp_saber", "gem_sapphire");
            BestiaryState.Restore(new[] { "황건적", "귀두 두목", "기계화 정찰병" });
            string json = DungeonSave.ToJson();
            HeroState.Restore(1, 0, 30, 0, null, null);
            BestiaryState.Restore(null);
            PlaytestKit.Check(DungeonSave.ApplyJson(json), "un.dg.build-dex: DUNGEON 세이브가 안 읽힘");
            PlaytestKit.Check(HeroState.Level == 5 && HeroState.Exp == 12 && HeroState.Hp == 20 && HeroState.Gold == 345 && HeroState.EquippedWeaponId == "wp_saber" && HeroState.SocketedGemId == "gem_sapphire",
                $"un.dg.build-dex: 영웅 왕복 lv={HeroState.Level} exp={HeroState.Exp} hp={HeroState.Hp} gold={HeroState.Gold} w={HeroState.EquippedWeaponId} g={HeroState.SocketedGemId}");
            PlaytestKit.Check(BestiaryState.Count == 3 && BestiaryState.IsDiscovered("기계화 정찰병"), $"un.dg.build-dex: 도감 왕복 {BestiaryState.Count}개");
        }
    }
}
