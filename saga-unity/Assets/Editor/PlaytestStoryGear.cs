using UnityEditor;
using UnityEngine;
using Saga.Story.Data;

namespace Saga.EditorTools
{
    /// <summary>
    /// tasks U-0246 4종횡 장비 진단 — `-executeMethod Saga.EditorTools.PlaytestStoryGear.Run`(-quit 없이, 편집 모드 — 씬 안 엶).
    /// 표 수(웹과 같음) · 요구 Lv · 더 센 것만 · 공격·방어·체력 합 · 방어 막음(def/(def+40), 상한 60%) · 세트 2·3·4 점·세트 무예 · 떨굼 풀·고유 · 세이브 왕복.
    /// </summary>
    public static class PlaytestStoryGear
    {
        private const string Tag = "[PlaytestStoryGear]";

        public static void Run()
        {
            PlaytestKit.Begin(Tag);
            using (PlaytestKit.ErrorCounter())
            {
                try
                {
                    StoryGear.Restore(null);
                    StoryJobState.Restore(1, 0f, StoryJobState.NoJob);
                    CheckTables();
                    CheckEquip();
                    CheckSet();
                    CheckDrops();
                    CheckSave();
                }
                catch (System.Exception e) { PlaytestKit.Fail("예외 " + e); }
                finally
                {
                    StoryGear.Restore(null);
                    StoryJobState.Restore(1, 0f, StoryJobState.NoJob);
                }
            }
            PlaytestKit.Summary("PlaytestStoryGear");
            if (Application.isBatchMode) EditorApplication.Exit(PlaytestKit.Fails == 0 ? 0 : 1);
        }

        private static void CheckTables()
        {
            int uniques = 0;
            foreach (var g in StoryGearTables.Gear)
            {
                bool slotOk = false;
                foreach (var s in StoryGearTables.Slots) slotOk |= s.Key == g.Slot;
                PlaytestKit.Check(slotOk, $"장비 {g.Key} 부위 {g.Slot} 모름");
                if (g.Unique) { uniques++; PlaytestKit.Check(StoryGearTables.Find(g.Base) != null, $"고유 {g.Key} 바탕 {g.Base} 없음"); }
            }
            PlaytestKit.Check(StoryGearTables.Slots.Length == 10, $"부위 {StoryGearTables.Slots.Length} ≠ 10");
            PlaytestKit.Check(StoryGearTables.Gear.Length - uniques >= 40 && uniques >= 10, $"장비 {StoryGearTables.Gear.Length - uniques}·고유 {uniques}");
            PlaytestKit.Check(StoryGearTables.Sets.Length >= 2, $"세트 {StoryGearTables.Sets.Length} < 2");
            foreach (var s in StoryGearTables.Sets)
                foreach (var p in s.Pieces) PlaytestKit.Check(StoryGearTables.Find(p) != null, $"세트 {s.Key} 조각 {p} 없음");
            Debug.Log($"{Tag} tables OK — 부위 {StoryGearTables.Slots.Length}·장비 {StoryGearTables.Gear.Length - uniques}·고유 {uniques}·세트 {StoryGearTables.Sets.Length}");
        }

        private static void CheckEquip()
        {
            PlaytestKit.Check(StoryGear.Atk == 0 && StoryGear.Def == 0 && StoryGear.Hp == 0 && Mathf.Approximately(StoryGear.TakeMul, 1f), "맨몸인데 장비 값");
            PlaytestKit.Check(!StoryGear.EquipIfBetter("sword2"), "Lv1 에 요구 Lv5 환도를 낌");
            PlaytestKit.Check(StoryGear.EquipIfBetter("sword1"), "Lv1 목검을 안 낌");
            StoryJobState.Restore(20, 0f, StoryJobState.NoJob);
            PlaytestKit.Check(StoryGear.EquipIfBetter("sword3"), "Lv20 청강검을 안 낌");
            PlaytestKit.Check(!StoryGear.EquipIfBetter("sword2"), "더 약한 환도로 갈아 낌");
            PlaytestKit.Check(StoryGear.EquipIfBetter("top4"), "두정갑 안 낌");
            var w = StoryGearTables.Find("sword3"); var t = StoryGearTables.Find("top4");
            PlaytestKit.Check(StoryGear.Atk == w.Atk + t.Atk && StoryGear.Def == w.Def + t.Def && StoryGear.Hp == w.Hp + t.Hp, $"합 {StoryGear.Atk}/{StoryGear.Def}/{StoryGear.Hp}");
            float cut = Mathf.Min(0.6f, StoryGear.Def / (StoryGear.Def + 40f));
            PlaytestKit.Check(Mathf.Approximately(StoryGear.TakeMul, 1f - cut), $"막음 {StoryGear.TakeMul} ≠ {1f - cut}");
            float hpBefore = StoryPlayerHp.HpMax;
            StoryGear.Restore(null);
            PlaytestKit.Check(StoryPlayerHp.HpMax < hpBefore, "장비 체력이 최대 체력에 안 붙음");
            Debug.Log($"{Tag} equip OK — 청강검+두정갑 공 {w.Atk + t.Atk}·방 {w.Def + t.Def}(받는 피해 ×{1f - cut:F2})·체 {w.Hp + t.Hp}");
        }

        private static void CheckSet()
        {
            StoryGear.Restore(null);
            StoryJobState.Restore(20, 0f, StoryJobState.NoJob);
            var set = StoryGearTables.Sets[0];
            for (int i = 0; i < set.Pieces.Length; i++)
            {
                PlaytestKit.Check(StoryGear.EquipIfBetter(set.Pieces[i]), $"세트 조각 {set.Pieces[i]} 안 낌");
                PlaytestKit.Check(StoryGear.SetCount.TryGetValue(set.Key, out int n) && n == i + 1, $"세트 점수 {n} ≠ {i + 1}");
                PlaytestKit.Check((StoryGear.FullSet == set) == (i == set.Pieces.Length - 1), $"{i + 1} 점에 세트 무예 {StoryGear.FullSet?.Key}");
            }
            int atk = 0, def = 0, hp = 0;
            foreach (var p in set.Pieces) { var d = StoryGearTables.Find(p); atk += d.Atk; def += d.Def; hp += d.Hp; }
            foreach (var b in set.Bonus) { atk += b.Atk; def += b.Def; hp += b.Hp; }
            PlaytestKit.Check(StoryGear.Atk == atk && StoryGear.Def == def && StoryGear.Hp == hp, $"세트 합 {StoryGear.Atk}/{StoryGear.Def}/{StoryGear.Hp} ≠ {atk}/{def}/{hp}");
            StoryJobState.Restore(5, 0f, StoryJobState.NoJob);
            StoryGear.Recalc();
            PlaytestKit.Check(StoryGear.FullSet == null, "요구 Lv 모자란데 세트 무예");
            StoryJobState.Restore(20, 0f, StoryJobState.NoJob);
            StoryGear.Recalc();
            Debug.Log($"{Tag} set OK — {set.Key} {set.Pieces.Length} 점 · 공 {atk}·방 {def}·체 {hp} · 세트 무예 {set.Skill?.Name}");
        }

        private static void CheckDrops()
        {
            StoryGear.Restore(null);
            StoryJobState.Restore(20, 0f, StoryJobState.NoJob);
            int grunt = 0, boss = 0, uniq = 0;
            for (int i = 0; i < 4000; i++) if (StoryGear.RollDrop(false) != null) grunt++;
            for (int i = 0; i < 1000; i++)
            {
                string k = StoryGear.RollDrop(true);
                if (k == null) continue;
                boss++;
                var d = StoryGearTables.Find(k);
                PlaytestKit.Check(d != null && d.Need <= 23, $"떨굼 {k} 요구 Lv 넘음");
                if (d != null && d.Unique) uniq++;
            }
            PlaytestKit.Check(grunt > 80 && grunt < 220, $"잡졸 떨굼 {grunt}/4000(기대 ≈140)");
            PlaytestKit.Check(boss > 850 && boss < 950, $"두목 떨굼 {boss}/1000(기대 ≈900)");
            PlaytestKit.Check(uniq > 0, "고유 하나도 안 나옴");
            StoryJobState.Restore(1, 0f, StoryJobState.NoJob);
            for (int i = 0; i < 500; i++)
            {
                var d = StoryGearTables.Find(StoryGear.RollDrop(true));
                if (d != null) PlaytestKit.Check(d.Need <= 4 && !d.Unique, $"Lv1 떨굼 {d.Key}(요구 {d.Need})");
            }
            Debug.Log($"{Tag} drops OK — 잡졸 {grunt}/4000 · 두목 {boss}/1000 · 고유 {uniq}");
        }

        private static void CheckSave()
        {
            StoryJobState.Restore(20, 0f, StoryJobState.NoJob);
            StoryGear.Restore(null);
            StoryGear.EquipIfBetter("sword4");
            StoryGear.EquipIfBetter("hat3");
            string snap = StoryGear.Snapshot();
            int atk = StoryGear.Atk, def = StoryGear.Def, n = StoryGear.Worn.Count;
            string next = StoryGear.RollDrop(true);
            StoryGear.Restore(snap);
            PlaytestKit.Check(StoryGear.Worn.Count == n && StoryGear.Atk == atk && StoryGear.Def == def, "세이브 왕복 장비 다름");
            PlaytestKit.Check(StoryGear.RollDrop(true) == next, "세이브 왕복 뒤 떨굼 난수 흐름 다름");
            StoryGear.Restore("{깨진");
            PlaytestKit.Check(StoryGear.Worn.Count == 0, "깨진 세이브에서 장비 남음");
            Debug.Log($"{Tag} save OK — 칸 {n}");
        }
    }
}
