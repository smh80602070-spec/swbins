using TMPro;
using System.Reflection;
using UnityEditor;
using UnityEditor.SceneManagement;
using UnityEngine;
using UnityEngine.UI;
using Saga.Core;
using Saga.Story.Data;
using Saga.Story.Player;
using Saga.Story.World;
using Saga.Story.UI;

namespace Saga.EditorTools
{
    public static partial class PlaytestStorySlice
    {
        /// <summary>PLAN.md 101-2 STORY "5-3 비경"(2026-09-20) — 실제
        /// Play-mode 경로로 확인한다: (a) 지도 결정성, (b) 축복 축 구조,
        /// (c) 즉시 판정 노드 셋(보물·휴식·사건), (d) 전투/정예 노드가
        /// 아레나에서 실제 StoryEnemy를 스폰·처치까지 시키는지, (e) 노드
        /// 제한시간 초과 실패와 재기(再起) 은사의 1회 무효화, (f) 실제
        /// 맵 UI 버튼을 눌러 1~5층을 완주하는 전체 흐름, (g) 기억 조각
        /// 영구 강화(공격력)와 10단 상한.</summary>
        private static bool CheckLabyrinth()
        {
            var mapA = StoryLabyrinthData.GenerateFloors(12345);
            var mapB = StoryLabyrinthData.GenerateFloors(12345);
            if (mapA.Length != mapB.Length)
            {
                Debug.LogError($"[PlaytestStorySlice] 비경 지도 층수 불일치 — {mapA.Length} vs {mapB.Length}");
                return false;
            }
            for (int i = 0; i < mapA.Length; i++)
            {
                if (mapA[i].Length != mapB[i].Length)
                {
                    Debug.LogError($"[PlaytestStorySlice] 비경 지도 {i}층 노드 개수가 같은 seed인데 다름");
                    return false;
                }
                for (int j = 0; j < mapA[i].Length; j++)
                {
                    if (mapA[i][j] != mapB[i][j])
                    {
                        Debug.LogError($"[PlaytestStorySlice] 비경 지도 {i}층 {j}번 노드가 같은 seed인데 다름 — {mapA[i][j]} vs {mapB[i][j]}");
                        return false;
                    }
                }
            }
            Debug.Log("[PlaytestStorySlice] labyrinth map determinism OK (seed 고정 시 지도 동일)");

            if (StoryLabyrinthData.AxisPools.Length != 3)
            {
                Debug.LogError($"[PlaytestStorySlice] 비경 축복 축 개수={StoryLabyrinthData.AxisPools.Length}(기대=3)");
                return false;
            }
            for (int axis = 0; axis < 3; axis++)
            {
                foreach (var b in StoryLabyrinthData.AxisPools[axis])
                {
                    if ((int)b.Axis != axis)
                    {
                        Debug.LogError($"[PlaytestStorySlice] 비경 축복 축 불일치 — {b.Key} axis={b.Axis}(기대={(StoryLabyrinthData.BlessingAxis)axis})");
                        return false;
                    }
                }
            }
            Debug.Log("[PlaytestStorySlice] labyrinth blessing axis structure OK (3택 축 중복 0이 구조적으로 보장됨)");

            var runner = StoryLabyrinthRunner.Instance;
            var mapUi = StoryLabyrinthMapUi.Instance;
            if (runner == null || mapUi == null)
            {
                Debug.LogError($"[PlaytestStorySlice] 비경 컴포넌트를 씬에서 못 찾음 — runner={runner != null} mapUi={mapUi != null}");
                return false;
            }

            // ── 즉시 판정 노드(보물/휴식/사건) — 층 진행과 무관, EnterNode 직접 호출 ──
            runner.StartRunWithSeed(1);

            bool treasureCleared = false;
            int shardsBeforeTreasure = StoryLabyrinthState.MemoryShards; // tasks U-0128 — 들판 판 S 등급 덤으로 조각이 이미 있을 수 있어 전후 차로 본다
            runner.EnterNode(StoryLabyrinthData.NodeType.Treasure, () => treasureCleared = true);
            if (!treasureCleared || StoryLabyrinthState.MemoryShards != shardsBeforeTreasure + 1)
            {
                Debug.LogError($"[PlaytestStorySlice] 비경 보물 노드 실패 — cleared={treasureCleared} shards={StoryLabyrinthState.MemoryShards}(기대={shardsBeforeTreasure + 1})");
                return false;
            }

            StoryCombat.RestoreMp(0f);
            bool restCleared = false;
            runner.EnterNode(StoryLabyrinthData.NodeType.Rest, () => restCleared = true);
            if (!restCleared || !Mathf.Approximately(StoryCombat.Mp, StoryCombat.MpMaxCurrent))
            {
                Debug.LogError($"[PlaytestStorySlice] 비경 휴식 노드 실패 — cleared={restCleared} mp={StoryCombat.Mp}(기대={StoryCombat.MpMaxCurrent})");
                return false;
            }

            bool eventCleared = false;
            runner.EnterNode(StoryLabyrinthData.NodeType.Event, () => eventCleared = true);
            if (!eventCleared)
            {
                Debug.LogError("[PlaytestStorySlice] 비경 사건 노드 콜백이 안 옴(결과와 무관하게 항상 와야 한다)");
                return false;
            }
            Debug.Log("[PlaytestStorySlice] labyrinth instant nodes (treasure/rest/event) OK");

            // ── 전투 노드 — 아레나로 순간이동 + 실제 StoryEnemy 스폰·처치 ──
            Vector3 beforeCombatPos = _player.position;
            int shardsBeforeCombat = StoryLabyrinthState.MemoryShards;
            bool combatCleared = false;
            runner.EnterNode(StoryLabyrinthData.NodeType.Combat, () => combatCleared = true);
            if (!runner.NodeActive || runner.ActiveArenaEnemies.Count != 2)
            {
                Debug.LogError($"[PlaytestStorySlice] 비경 전투 노드가 잡졸 2를 안 세움 — active={runner.NodeActive} count={runner.ActiveArenaEnemies.Count}");
                return false;
            }
            foreach (var e in runner.ActiveArenaEnemies) e.TakeDamage(99999f);
            InvokePrivate(runner, "Update");
            if (!combatCleared || runner.NodeActive)
            {
                Debug.LogError($"[PlaytestStorySlice] 비경 전투 노드 클리어 실패 — cleared={combatCleared} active={runner.NodeActive}");
                return false;
            }
            if (StoryLabyrinthState.MemoryShards != shardsBeforeCombat + 1)
            {
                Debug.LogError($"[PlaytestStorySlice] 비경 전투 노드 기억 조각 보상 불일치 — {StoryLabyrinthState.MemoryShards}(기대={shardsBeforeCombat + 1})");
                return false;
            }
            if (Vector3.Distance(_player.position, beforeCombatPos) > 0.01f)
            {
                Debug.LogError($"[PlaytestStorySlice] 비경 전투 노드 클리어 후 원위치로 안 돌아옴 — {_player.position}(기대={beforeCombatPos})");
                return false;
            }
            Debug.Log("[PlaytestStorySlice] labyrinth combat node OK - 2 enemies, cleared, shard+1, teleported back");

            // ── 정예 노드 — HP 2배 + 클리어 후 보너스 은사 카드(실제 클릭까지) ──
            int shardsBeforeElite = StoryLabyrinthState.MemoryShards;
            bool eliteCleared = false;
            runner.EnterNode(StoryLabyrinthData.NodeType.Elite, () => eliteCleared = true);
            if (runner.ActiveArenaEnemies.Count != 1)
            {
                Debug.LogError($"[PlaytestStorySlice] 비경 정예 노드가 1을 안 세움 — count={runner.ActiveArenaEnemies.Count}");
                return false;
            }
            var eliteEnemy = runner.ActiveArenaEnemies[0];
            eliteEnemy.TakeDamage(StoryCombat.EnemyHp);
            if (eliteEnemy.IsDead)
            {
                Debug.LogError("[PlaytestStorySlice] 비경 정예가 잡졸 한 방(EnemyHp)에 죽음 — HP 배율 2배가 안 먹은 듯");
                return false;
            }
            eliteEnemy.TakeDamage(99999f);
            InvokePrivate(runner, "Update");
            if (eliteCleared)
            {
                Debug.LogError("[PlaytestStorySlice] 비경 정예 클리어 콜백이 은사 선택 전에 옴(정예는 은사부터 골라야 한다)");
                return false;
            }
            if (!ClickFirstBlessingButton(mapUi))
            {
                return false;
            }
            if (!eliteCleared)
            {
                Debug.LogError("[PlaytestStorySlice] 은사 클릭 후에도 정예 클리어 콜백이 안 옴");
                return false;
            }
            if (StoryLabyrinthState.MemoryShards != shardsBeforeElite + 1)
            {
                Debug.LogError($"[PlaytestStorySlice] 비경 정예 노드 기억 조각 보상 불일치 — {StoryLabyrinthState.MemoryShards}(기대={shardsBeforeElite + 1})");
                return false;
            }
            bool anyBlessingApplied =
                !Mathf.Approximately(StoryLabyrinthState.AtkMul, 1f) ||
                StoryLabyrinthState.CritRateBonus != 0f ||
                !Mathf.Approximately(StoryLabyrinthState.CooldownMul, 1f);
            if (!anyBlessingApplied)
            {
                Debug.LogError("[PlaytestStorySlice] 정예 은사 클릭 후에도 공격축 배율이 전부 기본값 — ApplyBlessing이 안 먹은 듯(버튼 0은 항상 공격축)");
                return false;
            }
            Debug.Log("[PlaytestStorySlice] labyrinth elite node OK - 2x hp, blessing card shown+clicked, shard+1, blessing applied");

            // ── 노드 제한시간 초과 — 실패로 회차가 끝난다(재기 없음) ──
            StoryLabyrinthState.EndRun();
            runner.StartRunWithSeed(2);
            bool failCallbackFired = false;
            runner.EnterNode(StoryLabyrinthData.NodeType.Combat, () => failCallbackFired = true);
            SetPrivate(runner, "_nodeTimeLeft", -1f);
            InvokePrivate(runner, "Update");
            if (StoryLabyrinthState.InRun || failCallbackFired || runner.NodeActive)
            {
                Debug.LogError($"[PlaytestStorySlice] 비경 제한시간 초과 실패 처리 결함 — inRun={StoryLabyrinthState.InRun} clearedCallback={failCallbackFired} nodeActive={runner.NodeActive}");
                return false;
            }
            Debug.Log("[PlaytestStorySlice] labyrinth time-limit failure OK - run ended, no clear callback, extra_life 없이 즉시 실패");

            // ── 재기(再起, extra_life) — 첫 실패는 무효화되고 다시 도전 ──
            runner.StartRunWithSeed(3);
            StoryLabyrinthState.ApplyBlessing("extra_life");
            bool extraLifeCallbackFired = false;
            runner.EnterNode(StoryLabyrinthData.NodeType.Combat, () => extraLifeCallbackFired = true);
            SetPrivate(runner, "_nodeTimeLeft", -1f);
            InvokePrivate(runner, "Update");
            if (!StoryLabyrinthState.InRun || StoryLabyrinthState.ExtraLifeAvailable)
            {
                Debug.LogError($"[PlaytestStorySlice] 재기 소모 실패 — inRun={StoryLabyrinthState.InRun}(기대=true) extraLifeAvailable={StoryLabyrinthState.ExtraLifeAvailable}(기대=false)");
                return false;
            }
            if (!runner.NodeActive || runner.ActiveArenaEnemies.Count != 2)
            {
                Debug.LogError($"[PlaytestStorySlice] 재기 뒤 노드가 다시 안 시작됨 — active={runner.NodeActive} count={runner.ActiveArenaEnemies.Count}");
                return false;
            }
            foreach (var e in runner.ActiveArenaEnemies) e.TakeDamage(99999f);
            InvokePrivate(runner, "Update");
            if (!extraLifeCallbackFired)
            {
                Debug.LogError("[PlaytestStorySlice] 재기 뒤 재도전 클리어 콜백이 안 옴");
                return false;
            }
            Debug.Log("[PlaytestStorySlice] labyrinth extra-life (재기) retry OK - 1회 무효화 뒤 재도전 클리어");
            runner.AbandonRun();

            // ── 전체 흐름 — 실제 맵 UI 버튼을 눌러 1~5층 완주 ──
            const int fullRunSeed = 42;
            var expectedFloors = StoryLabyrinthData.GenerateFloors(fullRunSeed);
            runner.StartRunWithSeed(fullRunSeed);
            bool entryDone = false;
            mapUi.ShowEntryBlessing(() => { entryDone = true; mapUi.ShowFloor(); });
            if (!ClickFirstBlessingButton(mapUi)) return false;
            if (!entryDone)
            {
                Debug.LogError("[PlaytestStorySlice] 비경 진입 은사 선택 후 콜백이 안 옴");
                return false;
            }

            for (int f = 0; f < expectedFloors.Length; f++)
            {
                if (StoryLabyrinthState.Floor != f + 1)
                {
                    Debug.LogError($"[PlaytestStorySlice] 비경 {f}번째 층 진행 중 Floor={StoryLabyrinthState.Floor}(기대={f + 1})");
                    return false;
                }
                var nodeType = expectedFloors[f][0]; // 항상 첫 노드 — 노드 종류별 판정은 위에서 이미 각각 확인했다.
                if (!ClickFirstMapNodeButton(mapUi)) return false;

                if (nodeType == StoryLabyrinthData.NodeType.Combat || nodeType == StoryLabyrinthData.NodeType.Elite)
                {
                    if (!runner.NodeActive)
                    {
                        Debug.LogError($"[PlaytestStorySlice] 비경 {f + 1}층 {nodeType} 노드가 전투를 안 시작함");
                        return false;
                    }
                    foreach (var e in runner.ActiveArenaEnemies) e.TakeDamage(99999f);
                    InvokePrivate(runner, "Update");
                    if (nodeType == StoryLabyrinthData.NodeType.Elite && !ClickFirstBlessingButton(mapUi))
                    {
                        return false;
                    }
                }
            }
            if (StoryLabyrinthState.Floor < 5)
            {
                Debug.LogError($"[PlaytestStorySlice] 4개 층을 다 골랐는데 Floor={StoryLabyrinthState.Floor}(기대>=5)");
                return false;
            }

            if (!ClickFirstMapNodeButton(mapUi)) return false; // 5층 "도전한다".
            if (!runner.NodeActive || runner.ActiveArenaEnemies.Count != 1 || !runner.ActiveArenaEnemies[0].IsBoss)
            {
                Debug.LogError($"[PlaytestStorySlice] 비경 5층 보스가 안 섬 — active={runner.NodeActive} count={runner.ActiveArenaEnemies.Count}");
                return false;
            }
            runner.ActiveArenaEnemies[0].TakeDamage(99999f);
            InvokePrivate(runner, "Update");
            if (StoryLabyrinthState.InRun)
            {
                Debug.LogError("[PlaytestStorySlice] 비경 보스 처치 후에도 회차가 안 끝남");
                return false;
            }
            Debug.Log($"[PlaytestStorySlice] labyrinth full run OK - seed={fullRunSeed}, cleared floor 1~5, shards now={StoryLabyrinthState.MemoryShards}");

            // ── 영구 강화(기억 조각→공격력) + 10단 상한 ──
            float atkBonusBefore = StoryLabyrinthState.MemoryAtkBonus;
            if (StoryLabyrinthState.MemoryShards < 1)
            {
                Debug.LogError($"[PlaytestStorySlice] 영구 강화 검증 전 기억 조각이 부족 — {StoryLabyrinthState.MemoryShards}");
                return false;
            }
            if (!StoryLabyrinthState.TryUpgradeMemory() || StoryLabyrinthState.MemoryTier != 1)
            {
                Debug.LogError($"[PlaytestStorySlice] 영구 강화 실패 — tier={StoryLabyrinthState.MemoryTier}(기대=1)");
                return false;
            }
            if (StoryLabyrinthState.MemoryAtkBonus <= atkBonusBefore)
            {
                Debug.LogError($"[PlaytestStorySlice] 영구 강화 후 MemoryAtkBonus 안 늘어남 — {StoryLabyrinthState.MemoryAtkBonus}(이전={atkBonusBefore})");
                return false;
            }
            StoryLabyrinthState.AddShards(999);
            while (StoryLabyrinthState.TryUpgradeMemory()) { } // 상한까지 밀어붙인다.
            if (StoryLabyrinthState.MemoryTier != StoryLabyrinthData.MemoryTierMax || StoryLabyrinthState.TryUpgradeMemory())
            {
                Debug.LogError($"[PlaytestStorySlice] 영구 강화 상한({StoryLabyrinthData.MemoryTierMax}단) 위반 — tier={StoryLabyrinthState.MemoryTier}");
                return false;
            }
            Debug.Log($"[PlaytestStorySlice] labyrinth memory upgrade OK - tier capped at {StoryLabyrinthData.MemoryTierMax}, atkBonus={StoryLabyrinthState.MemoryAtkBonus}");

            Debug.Log("[PlaytestStorySlice] labyrinth (101-2 5-3) full verification OK");
            return true;
        }
    }
}
