using System.Collections.Generic;
using System.Linq;
using UnityEditor;
using UnityEngine;
using Saga.Story.Data;

namespace Saga.EditorTools
{
    /// <summary>
    /// `un.st.rift` 5-3 비경 — 규칙 층만 본다(화면·씬 없이, RECURRING R-3). ① 축복 표: 축마다 셋·키 중복 0·축 일치 ② 층 생성: 같은 씨앗 → 같은 층·4층 각 2~3칸·보스 칸 없음
    /// ③ 축복 효과: 아홉 키가 각자 한 값만 바꾸고 겹치면 곱·더함, 모르는 키는 무시, `StartRun` 이 되돌림 ④ 회차 흐름: 시작·층 올림·재기 한 번만·끝
    /// ⑤ 기억 조각: 비용 1~10(누적 55)·상한·부족 시 실패·공격력 보너스·복원 시 범위 자름 ⑥ 주간 변형자 표·결정적 선택 ⑦ 비경 적 경험치(레벨 비례·두목 15배).
    /// `-executeMethod Saga.EditorTools.PlaytestStoryRift.Run` → "[PlaytestStoryRift] OK/FAIL".
    /// </summary>
    public static class PlaytestStoryRift
    {
        [MenuItem("Saga/Playtest Story Rift")]
        public static void Run()
        {
            PlaytestKit.Begin("[PlaytestStoryRift]");
            int shards0 = StoryLabyrinthState.MemoryShards;
            int tier0 = StoryLabyrinthState.MemoryTier;
            using (PlaytestKit.ErrorCounter())
            {
                CheckBlessingTable();
                CheckFloors();
                CheckBlessingEffects();
                CheckRunFlow();
                CheckMemory();
                CheckWeekly();
                CheckEnemyExp();
            }
            StoryLabyrinthState.ResetForTest();
            StoryLabyrinthState.Restore(shards0, tier0);
            PlaytestKit.Summary("PlaytestStoryRift");
            if (Application.isBatchMode) EditorApplication.Exit(PlaytestKit.Fails == 0 ? 0 : 1);
        }

        private static void CheckBlessingTable()
        {
            var keys = new HashSet<string>();
            var axes = new[] { StoryLabyrinthData.BlessingAxis.Attack, StoryLabyrinthData.BlessingAxis.Defense, StoryLabyrinthData.BlessingAxis.Utility };
            PlaytestKit.Check(StoryLabyrinthData.AxisPools.Length == 3, "un.st.rift: 축 풀이 셋이 아님");
            for (int a = 0; a < StoryLabyrinthData.AxisPools.Length; a++)
            {
                var pool = StoryLabyrinthData.AxisPools[a];
                PlaytestKit.Check(pool.Length == 3, $"un.st.rift: 축 {a} 축복 {pool.Length}개 (기대 3)");
                foreach (var b in pool)
                {
                    PlaytestKit.Check(keys.Add(b.Key), $"un.st.rift: 축복 키 중복 {b.Key}");
                    PlaytestKit.Check(b.Axis == axes[a], $"un.st.rift: {b.Key} 축이 풀과 다름");
                    PlaytestKit.Check(!string.IsNullOrEmpty(b.Name) && !string.IsNullOrEmpty(b.Description), $"un.st.rift: {b.Key} 이름·설명이 비었음");
                }
            }
            PlaytestKit.Check(keys.Count == 9, $"un.st.rift: 축복 {keys.Count}개 (기대 9)");
        }

        private static void CheckFloors()
        {
            var a = StoryLabyrinthData.GenerateFloors(20260824);
            var b = StoryLabyrinthData.GenerateFloors(20260824);
            PlaytestKit.Check(a.Length == 4, $"un.st.rift: 층 {a.Length}개 (기대 4)");
            bool same = a.Length == b.Length;
            for (int i = 0; same && i < a.Length; i++) same = a[i].SequenceEqual(b[i]);
            PlaytestKit.Check(same, "un.st.rift: 같은 씨앗인데 층이 다름");
            var distinct = new HashSet<string>();
            for (int seed = 1; seed <= 30; seed++)
            {
                var f = StoryLabyrinthData.GenerateFloors(seed);
                distinct.Add(string.Join("|", f.Select(x => string.Join(",", x))));
                foreach (var floor in f)
                {
                    PlaytestKit.Check(floor.Length == 2 || floor.Length == 3, $"un.st.rift: 씨앗 {seed} 한 층에 {floor.Length}칸");
                    PlaytestKit.Check(floor.All(n => n != StoryLabyrinthData.NodeType.Boss), $"un.st.rift: 씨앗 {seed} 일반 층에 보스 칸");
                }
            }
            PlaytestKit.Check(distinct.Count > 5, $"un.st.rift: 씨앗 30개에서 층 모양이 {distinct.Count}가지뿐");
            PlaytestKit.Check(StoryLabyrinthData.GenerateFloors(1, 2).Length == 2, "un.st.rift: floorCount 인자가 안 먹음");
        }

        private static float[] Snapshot() => new[]
        {
            StoryLabyrinthState.AtkMul, StoryLabyrinthState.CritRateBonus, StoryLabyrinthState.CooldownMul, StoryLabyrinthState.MoveSpeedMul,
            StoryLabyrinthState.MpRegenMul, StoryLabyrinthState.TimeLimitMul, StoryLabyrinthState.ShardRewardMul,
            StoryLabyrinthState.ExtraLifeAvailable ? 1f : 0f, StoryLabyrinthState.MpShieldOnEntry ? 1f : 0f,
        };

        private static void CheckBlessingEffects()
        {
            // 키마다 정확히 한 칸만 바뀐다(= 표의 모든 키를 ApplyBlessing 이 안다).
            StoryLabyrinthState.StartRun(1);
            float[] baseline = Snapshot();
            foreach (var pool in StoryLabyrinthData.AxisPools)
            {
                foreach (var bl in pool)
                {
                    StoryLabyrinthState.StartRun(1);
                    StoryLabyrinthState.ApplyBlessing(bl.Key);
                    float[] now = Snapshot();
                    int changed = 0;
                    for (int i = 0; i < now.Length; i++) if (!Mathf.Approximately(now[i], baseline[i])) changed++;
                    PlaytestKit.Check(changed == 1, $"un.st.rift: 축복 {bl.Key} 가 {changed}칸을 바꿈(기대 1)");
                }
            }

            StoryLabyrinthState.StartRun(1);
            StoryLabyrinthState.ApplyBlessing("atk_power");
            PlaytestKit.Check(Mathf.Approximately(StoryLabyrinthState.AtkMul, 1.25f), $"un.st.rift: 예기 {StoryLabyrinthState.AtkMul}");
            StoryLabyrinthState.ApplyBlessing("atk_power");
            PlaytestKit.Check(Mathf.Approximately(StoryLabyrinthState.AtkMul, 1.5625f), $"un.st.rift: 예기 두 번이 곱이 아님 {StoryLabyrinthState.AtkMul}");
            StoryLabyrinthState.ApplyBlessing("atk_crit"); StoryLabyrinthState.ApplyBlessing("atk_crit");
            PlaytestKit.Check(Mathf.Approximately(StoryLabyrinthState.CritRateBonus, 0.2f), $"un.st.rift: 회심 두 번이 더함이 아님 {StoryLabyrinthState.CritRateBonus}");
            StoryLabyrinthState.ApplyBlessing("atk_haste");
            PlaytestKit.Check(Mathf.Approximately(StoryLabyrinthState.CooldownMul, 0.8f), "un.st.rift: 쾌속 값");
            StoryLabyrinthState.ApplyBlessing("time_margin");
            PlaytestKit.Check(Mathf.Approximately(StoryLabyrinthState.TimeLimitMul, 1.25f), "un.st.rift: 여유 값");
            StoryLabyrinthState.ApplyBlessing("move_speed");
            PlaytestKit.Check(Mathf.Approximately(StoryLabyrinthState.MoveSpeedMul, 1.2f), "un.st.rift: 경신 값");
            StoryLabyrinthState.ApplyBlessing("mp_regen");
            PlaytestKit.Check(Mathf.Approximately(StoryLabyrinthState.MpRegenMul, 1.3f), "un.st.rift: 운기 값");
            StoryLabyrinthState.ApplyBlessing("memory_bonus");
            PlaytestKit.Check(Mathf.Approximately(StoryLabyrinthState.ShardRewardMul, 1.5f), "un.st.rift: 각인 값");
            StoryLabyrinthState.ApplyBlessing("mp_shield");
            PlaytestKit.Check(StoryLabyrinthState.MpShieldOnEntry, "un.st.rift: 충전 값");

            float[] loaded = Snapshot();
            StoryLabyrinthState.ApplyBlessing("nope");
            PlaytestKit.Check(loaded.SequenceEqual(Snapshot()), "un.st.rift: 모르는 축복 키가 값을 바꿈");
            StoryLabyrinthState.StartRun(2);
            PlaytestKit.Check(baseline.SequenceEqual(Snapshot()), "un.st.rift: StartRun 이 축복을 안 되돌림");
        }

        private static void CheckRunFlow()
        {
            StoryLabyrinthState.StartRun(7);
            PlaytestKit.Check(StoryLabyrinthState.InRun && StoryLabyrinthState.Floor == 1 && StoryLabyrinthState.FloorNodes != null && StoryLabyrinthState.FloorNodes.Length == 4, "un.st.rift: StartRun 상태 이상");
            StoryLabyrinthState.AdvanceFloor();
            PlaytestKit.Check(StoryLabyrinthState.Floor == 2, "un.st.rift: 층 올림 실패");
            PlaytestKit.Check(!StoryLabyrinthState.ConsumeExtraLifeIfAvailable(), "un.st.rift: 재기가 없는데 소모됨");
            StoryLabyrinthState.ApplyBlessing("extra_life");
            PlaytestKit.Check(StoryLabyrinthState.ConsumeExtraLifeIfAvailable() && !StoryLabyrinthState.ExtraLifeAvailable, "un.st.rift: 재기 첫 소모 실패");
            PlaytestKit.Check(!StoryLabyrinthState.ConsumeExtraLifeIfAvailable(), "un.st.rift: 재기가 두 번 소모됨");
            StoryLabyrinthState.EndRun();
            PlaytestKit.Check(!StoryLabyrinthState.InRun, "un.st.rift: EndRun 뒤에도 회차 중");
            StoryLabyrinthState.StartRun(8);
            PlaytestKit.Check(StoryLabyrinthState.Floor == 1 && !StoryLabyrinthState.ExtraLifeAvailable, "un.st.rift: 새 회차가 이전 회차를 이어받음");
        }

        private static void CheckMemory()
        {
            int max = StoryLabyrinthData.MemoryTierMax;
            int total = 0;
            for (int t = 1; t <= max; t++) total += StoryLabyrinthData.MemoryUpgradeCost(t);
            PlaytestKit.Check(max == 10 && total == 55, $"un.st.rift: 기억 비용 합 {total} (기대 55, 상한 {max})");

            StoryLabyrinthState.Restore(0, 0);
            StoryLabyrinthState.AddShards(0); StoryLabyrinthState.AddShards(-5);
            PlaytestKit.Check(StoryLabyrinthState.MemoryShards == 0, "un.st.rift: 0·음수 조각이 더해짐");
            StoryLabyrinthState.AddShards(2);
            PlaytestKit.Check(StoryLabyrinthState.TryUpgradeMemory() && StoryLabyrinthState.MemoryTier == 1 && StoryLabyrinthState.MemoryShards == 1, "un.st.rift: 1단 새기기(비용 1)");
            PlaytestKit.Check(!StoryLabyrinthState.TryUpgradeMemory() && StoryLabyrinthState.MemoryTier == 1 && StoryLabyrinthState.MemoryShards == 1, "un.st.rift: 조각 부족인데 새겨짐/소모됨");
            StoryLabyrinthState.Restore(total, 0);
            for (int t = 1; t <= max; t++)
                PlaytestKit.Check(StoryLabyrinthState.TryUpgradeMemory() && StoryLabyrinthState.MemoryTier == t, $"un.st.rift: {t}단 새기기 실패");
            PlaytestKit.Check(StoryLabyrinthState.MemoryShards == 0, $"un.st.rift: 다 새기고 조각 {StoryLabyrinthState.MemoryShards} 남음(기대 0)");
            StoryLabyrinthState.AddShards(99);
            PlaytestKit.Check(!StoryLabyrinthState.TryUpgradeMemory() && StoryLabyrinthState.MemoryTier == max && StoryLabyrinthState.MemoryShards == 99, "un.st.rift: 상한 뒤에도 새겨지거나 조각이 줄었음");
            PlaytestKit.Check(Mathf.Approximately(StoryLabyrinthState.MemoryAtkBonus, max * StoryLabyrinthData.MemoryAtkBonusPerTier), "un.st.rift: 기억 공격력 보너스 합");
            StoryLabyrinthState.Restore(-4, 99);
            PlaytestKit.Check(StoryLabyrinthState.MemoryShards == 0 && StoryLabyrinthState.MemoryTier == max, "un.st.rift: 복원이 범위를 안 자름(상한)");
            StoryLabyrinthState.Restore(3, -2);
            PlaytestKit.Check(StoryLabyrinthState.MemoryShards == 3 && StoryLabyrinthState.MemoryTier == 0 && Mathf.Approximately(StoryLabyrinthState.MemoryAtkBonus, 0f), "un.st.rift: 복원이 범위를 안 자름(하한)");
        }

        private static void CheckWeekly()
        {
            var v = StoryLabyrinthData.WeeklyVariants;
            PlaytestKit.Check(v.Length == 3 && v[0].Key == "none" && v[0].EnemyHpMul == 1f && v[0].RewardMul == 1f, "un.st.rift: 주간 변형자 첫 칸이 평온이 아님");
            var keys = new HashSet<string>();
            foreach (var w in v)
            {
                PlaytestKit.Check(keys.Add(w.Key), $"un.st.rift: 변형자 키 중복 {w.Key}");
                PlaytestKit.Check(w.EnemyHpMul >= 1f && w.RewardMul >= 1f, $"un.st.rift: 변형자 {w.Key} 배율이 1 미만");
            }
            int week = StoryLabyrinthState.CurrentWeekIndex();
            PlaytestKit.Check(week > 0, $"un.st.rift: 주 index {week}");
            PlaytestKit.Check(StoryLabyrinthState.CurrentWeeklyVariant.Key == v[week % v.Length].Key, "un.st.rift: 이번 주 변형자가 주 index 로 안 골라짐");
        }

        private static void CheckEnemyExp()
        {
            PlaytestKit.Check(StoryCombat.EnemyExp(10, false) > StoryCombat.EnemyExp(1, false), "un.st.rift: 적 경험치가 레벨에 안 늚");
            PlaytestKit.Check(Mathf.Approximately(StoryCombat.EnemyExp(10, true), StoryCombat.EnemyExp(10, false) * 15f), "un.st.rift: 두목 경험치가 15배가 아님");
            PlaytestKit.Check(Mathf.Approximately(StoryCombat.EnemyExp(0, false), StoryCombat.EnemyExp(1, false)), "un.st.rift: 레벨 0 이 1 로 안 잡힘");
        }
    }
}
