using System.Collections.Generic;
using UnityEngine;
using Saga.Dungeon.Cinematics;
using Saga.Dungeon.Data;
using Saga.Dungeon.Player;
using Saga.Dungeon.World;

namespace Saga.EditorTools
{
    /// <summary>
    /// tasks U-0158 부서지는 통·항아리 진단 — `PlaytestDungeonHeadless` 가 난도 진단 뒤에 부른다(한 프레임 안).
    /// 진짜 방 짓기(전투방 셋·우물방 둘·명소 층 0·자리 겹침 없음·방 안·두 번 지어도 같음) · 진짜 평타(적 없을 때 가까운 소품 깸·보상 금)·
    /// 회전베기(둘레 깸) · 보상(금 = Gold · 약병 = 체력 15%) · 조각(물리·대신 조각 다섯) · 깬 소품은 다시 안 맞음.
    /// 끝나면 층·영웅·자리를 시작 때로, 조각을 지운다.
    /// </summary>
    public static class PlaytestDungeonBreakable
    {
        private const string T = "[PlaytestDungeonHeadless] breakable";
        private static bool _ok;

        public static bool Run()
        {
            _ok = true;
            var runner = Object.FindFirstObjectByType<DungeonFloorRunner>();
            var playerGo = GameObject.FindWithTag("Player");
            if (runner == null || playerGo == null) { Fail("러너·플레이어 없음"); return false; }
            if (Saga.Core.WorldModels.Load(DungeonBreakable.Models[0]) == null) { Debug.Log($"{T} OK - 모델 없는 PC(건너뜀)"); return true; }
            int floor0 = runner.CurrentFloor;
            int lv = HeroState.Level, exp = HeroState.Exp, hp = HeroState.Hp, gold = HeroState.Gold;
            string weapon = HeroState.EquippedWeaponId, gem = HeroState.SocketedGemId;
            Vector3 pos = playerGo.transform.position;
            Quaternion rot = playerGo.transform.rotation;
            string m = "";
            try
            {
                DungeonCutscenes.Instance?.Skip();
                DungeonBreakable.ResetForTest();
                m += CheckBuild(runner) + CheckRewards(runner) + CheckSwing(runner, playerGo);
            }
            finally
            {
                foreach (var go in Object.FindObjectsByType<Transform>(FindObjectsSortMode.None))
                    if (go != null && go.parent == null && go.name.StartsWith("Shard_")) Object.DestroyImmediate(go.gameObject);
                runner.JumpToFloor(floor0 >= 2 ? floor0 : 2);
                HeroState.Restore(lv, exp, hp, gold, weapon, gem);
                playerGo.GetComponent<PlayerCombat>()?.ResetCooldownsForTest();
                Place(playerGo, pos);
                playerGo.transform.rotation = rot;
                DungeonBreakable.ResetForTest();
            }
            if (_ok) Debug.Log($"{T} OK - 방(전투 셋·우물 둘·명소 0·겹침 없음·방 안·같음)·보상(금·약병 15%)·평타(적 없이 깸)·회전베기(둘레)·조각(물리)·깬 것 다시 안 맞음 |{m}");
            return _ok;
        }

        private static List<DungeonBreakable> Live()
        {
            var list = new List<DungeonBreakable>();
            foreach (var b in DungeonBreakable.Active) if (b != null && !b.Broken && b.gameObject.activeInHierarchy) list.Add(b);
            return list;
        }

        private static string CheckBuild(DungeonFloorRunner runner)
        {
            runner.JumpToFloor(2);
            runner.BuildRoomForTest("fight");
            var a = Live();
            if (a.Count != DungeonBreakable.FightCount) Fail($"전투방 소품 {a.Count} ≠ {DungeonBreakable.FightCount}");
            float lim = DungeonRoomBuilder.RoomWidth * 0.5f;
            var seen = new List<(Vector3 p, string model)>();
            foreach (var b in a)
            {
                Vector3 lp = b.transform.localPosition;
                if (Mathf.Abs(lp.x) > lim - 0.5f || Mathf.Abs(lp.z) > lim - 0.5f) Fail($"소품이 벽 밖 {lp}");
                foreach (var s in seen) if ((s.p - b.transform.position).sqrMagnitude < 1f) Fail("소품 자리 겹침");
                if (b.GetComponent<Collider>() == null) Fail("소품 충돌 없음");
                seen.Add((b.transform.position, b.Model));
            }
            runner.BuildRoomForTest("fight");
            var again = Live();
            int same = 0;
            foreach (var b in again) foreach (var s in seen) if ((s.p - b.transform.position).sqrMagnitude < 1e-6f && s.model == b.Model) { same++; break; }
            if (same != seen.Count || again.Count != seen.Count) Fail($"다시 지은 소품 {same}/{seen.Count}");
            runner.BuildRoomForTest("well");
            int well = Live().Count;
            if (well != DungeonBreakable.OtherCount) Fail($"우물방 소품 {well} ≠ {DungeonBreakable.OtherCount}");
            runner.JumpToFloor(DungeonLandmarkData.All[0].Floor);
            int lm = Live().Count;
            if (lm != 0) Fail($"명소 층 소품 {lm} ≠ 0");
            var kinds = new HashSet<string>();
            for (int f = 2; f < 9; f++)
            {
                if (DungeonLandmarkData.IndexOfFloor(f) >= 0) continue;
                runner.JumpToFloor(f);
                runner.BuildRoomForTest("fight");
                foreach (var b in Live()) kinds.Add(b.Model);
            }
            if (kinds.Count < 3) Fail($"소품 종류 {kinds.Count} < 3");
            return $" 전투 {a.Count}·우물 {well}·종류 {kinds.Count}";
        }

        private static string CheckRewards(DungeonFloorRunner runner)
        {
            int golds = 0, potions = 0;
            for (int f = 2; f < 12 && (golds == 0 || potions == 0); f++)
            {
                if (DungeonLandmarkData.IndexOfFloor(f) >= 0) continue;
                runner.JumpToFloor(f);
                runner.BuildRoomForTest("fight");
                foreach (var b in Live())
                {
                    HeroState.Restore(HeroState.Level, HeroState.Exp, 1, HeroState.Gold, HeroState.EquippedWeaponId, HeroState.SocketedGemId);
                    int g0 = HeroState.Gold, h0 = HeroState.Hp;
                    b.Break(b.transform.position + Vector3.back);
                    if (!b.Broken || DungeonBreakable.Active.Contains(b)) Fail("깬 소품이 목록에 남음");
                    if (b.Potion)
                    {
                        int want = Mathf.Max(1, Mathf.RoundToInt(HeroState.HpMax * DungeonBreakable.PotionFrac));
                        if (HeroState.Hp - h0 != want || HeroState.Gold != g0) Fail($"약병 회복 {HeroState.Hp - h0} ≠ {want}");
                        potions++;
                    }
                    else
                    {
                        if (HeroState.Gold - g0 != b.Gold || b.Gold < 1 || HeroState.Hp != h0) Fail($"금 {HeroState.Gold - g0} ≠ {b.Gold}");
                        golds++;
                    }
                    if (DungeonBreakable.LastShards < 4) Fail($"조각 {DungeonBreakable.LastShards} < 4");
                    int before = HeroState.Gold;
                    b.Break(Vector3.zero);
                    if (HeroState.Gold != before) Fail("깬 소품을 또 깸");
                }
            }
            if (golds == 0 || potions == 0) Fail($"보상 금 {golds}·약병 {potions} — 둘 다 나와야");
            int shards = 0, bodies = 0;
            foreach (var t in Object.FindObjectsByType<Rigidbody>(FindObjectsSortMode.None)) if (t.name.StartsWith("Shard_")) { shards++; if (t.GetComponent<Collider>() != null) bodies++; }
            if (shards == 0 || bodies != shards) Fail($"조각 물리 {bodies}/{shards}");
            return $" 금 {golds}·약병 {potions}·조각 {shards}(대신 {DungeonBreakable.LastShardsFallback})";
        }

        private static string CheckSwing(DungeonFloorRunner runner, GameObject playerGo)
        {
            var combat = playerGo.GetComponent<PlayerCombat>();
            if (combat == null) { Fail("PlayerCombat 없음"); return ""; }
            playerGo.GetComponent<PlayerLockOn>()?.Release();
            runner.JumpToFloor(2);
            runner.BuildRoomForTest("well");
            var props = Live();
            if (props.Count < 2) { Fail("우물방 소품 부족"); return ""; }
            var p0 = props[0];
            Vector3 toCenter = (runner.transform.position - p0.transform.position);
            toCenter.y = 0f;
            Place(playerGo, p0.transform.position + toCenter.normalized * 1.4f);
            int g0 = HeroState.Gold, n0 = DungeonBreakable.BrokenCount;
            combat.ResetCooldownsForTest();
            combat.TriggerAttack();
            if (!p0.Broken || DungeonBreakable.BrokenCount != n0 + 1) Fail($"평타가 소품을 못 깸(깬 수 {DungeonBreakable.BrokenCount - n0})");
            if (!p0.Potion && HeroState.Gold - g0 != p0.Gold) Fail($"평타 소품 금 {HeroState.Gold - g0} ≠ {p0.Gold}");
            // 이미 깬 것 앞에서 다시 — 아무것도 안 깬다
            int n1 = DungeonBreakable.BrokenCount;
            combat.ResetCooldownsForTest();
            combat.TriggerAttack();
            if (DungeonBreakable.BrokenCount != n1) Fail("깬 자리에서 또 깸");
            var p1 = props[1];
            toCenter = runner.transform.position - p1.transform.position;
            toCenter.y = 0f;
            Place(playerGo, p1.transform.position + toCenter.normalized * 1.6f);
            combat.ResetCooldownsForTest();
            combat.TriggerWhirl();
            if (!p1.Broken) Fail("회전베기가 둘레 소품을 못 깸");
            combat.ResetCooldownsForTest();
            return " 평타·회전베기";
        }

        private static void Place(GameObject playerGo, Vector3 p)
        {
            var cc = playerGo.GetComponent<CharacterController>();
            if (cc != null) cc.enabled = false;
            playerGo.transform.position = p;
            if (cc != null) cc.enabled = true;
        }

        private static void Fail(string why)
        {
            _ok = false;
            Debug.LogError($"{T} FAIL - {why}");
        }
    }
}
