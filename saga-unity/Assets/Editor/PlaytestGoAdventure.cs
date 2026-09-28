using System.Collections.Generic;
using System.Reflection;
using System.Text.RegularExpressions;
using UnityEngine;
using Saga.Go.Combat;
using Saga.Go.Data;
using Saga.Go.Player;
using Saga.Go.UI;

namespace Saga.EditorTools
{
    /// <summary>
    /// PLAN.md 109-14-7 "여정 등급·천하 등급"(웹 사가고 ⑲-7 진단 항목) — `PlaytestHeadless` 가 요리 진단 뒤에 부른다.
    /// 옛 진단들은 `AdventureState.OffForTest`(천하 0·보상 없음)로 돌고, 여기서만 켠다.
    /// 표(문턱·배율·보상) · 레벨 → 천하 등급 → 들판 적 체력·방패·공격 다시 잼(남은 체력 비율 그대로) · 수호장 금 · 레벨업 보상(한 번씩·여러 단계 한꺼번에·매듭 5 의 배수) ·
    /// 실제 레벨업 배선(`PlayerStats.AddExp` → 보상) · 낮추기·되돌리기(싸우는 중·0 거절) · 지도 칸 글·진짜 단추 · 세이브 v24 왕복·v23 로드(보상 안 쏟아짐).
    /// 끝나면 레벨·돈·강화석·재료·세이브 파일·스위치를 되돌린다.
    /// </summary>
    public static class PlaytestGoAdventure
    {
        private static string _tag;
        private static bool _ok;

        public static bool Run(string tag)
        {
            _tag = tag;
            _ok = true;
            var fc = FieldCombat.Instance;
            var pc = fc != null ? fc.GetComponent<PlayerController>() : null;
            var map = WorldMapUi.Instance;
            if (fc == null || pc == null || map == null) { Fail("FieldCombat/PlayerController/WorldMapUi 없음"); return false; }

            int startLevel = PlayerStats.Level, startExp = PlayerStats.Exp, startGold = GoldState.Gold;
            bool startLowered = AdventureState.Lowered;
            int startPaid = AdventureState.Paid;
            var startInv = WeaponState.SnapshotInv();
            var startEquip = WeaponState.SnapshotEquip();
            int startOre = WeaponState.Ore;
            var startTalent = TalentState.Snapshot();
            var startMats = TalentState.SnapshotMats();
            string savePath = System.IO.Path.Combine(Application.persistentDataPath, "save.json");
            string originalSave = System.IO.File.Exists(savePath) ? System.IO.File.ReadAllText(savePath) : null;
            try
            {
                CheckTables();
                AdventureState.OffForTest = false;
                pc.Teleport(fc.SafePoint);
                CheckScale();
                CheckRewards();
                CheckLower();
                CheckMap(map);
                CheckSave(savePath);
            }
            finally
            {
                if (originalSave != null) System.IO.File.WriteAllText(savePath, originalSave);
                else if (System.IO.File.Exists(savePath)) System.IO.File.Delete(savePath);
                PlayerStats.Restore(startLevel, startExp);
                AdventureState.OffForTest = true;
                AdventureState.RestoreSave(startLowered, startPaid); // 끈 채 다시 잼 → 들판 적 천하 0
                GoldState.Restore(startGold);
                WeaponState.Restore(startInv, startEquip, startOre);
                TalentState.Restore(startTalent, startMats);
                map.Close();
                foreach (var e in FieldEnemy.All) e.RestoreHomeForTest();
            }
            if (_ok) Debug.Log($"[{_tag}] adventure OK - 문턱 1·3·6…24·배율·보상 · 레벨 6 → 천하 2 적 체력·방패 ×1.7·공격 ×1.44(비율 그대로) · 수호장 금 ×1.5 · 보상 한 번씩·두 단계 한꺼번에·매듭 5 배수 · AddExp 배선 · 낮추기·되돌리기·거절 · 지도 칸·단추 · 세이브 v24 왕복·v23 로드");
            return _ok;
        }

        private static bool Near(float a, float b, float eps = 0.01f) => Mathf.Abs(a - b) <= eps;

        private static void CheckTables()
        {
            if (GoAdventure.NaturalOf(1) != 0 || GoAdventure.NaturalOf(3) != 1 || GoAdventure.NaturalOf(5) != 1 || GoAdventure.NaturalOf(6) != 2
                || GoAdventure.NaturalOf(24) != 8 || GoAdventure.NaturalOf(99) != 8) Fail("천하 문턱");
            if (!Near(GoAdventure.HpMul(2), 1.7f) || !Near(GoAdventure.AtkMul(8), 2.76f) || !Near(GoAdventure.LootMul(4), 2f)) Fail("배율");
            if (GoAdventure.RewardOf(5) != (500, 2, 1) || GoAdventure.RewardOf(4).knot != 0) Fail("보상 표");
            if (GoAdventure.NextAt(1) != 3 || GoAdventure.NextAt(24) != 0) Fail("다음 문턱");
            if (AdventureState.WorldLevel != 0) Fail("진단 스위치가 켜져 있는데 천하 등급이 0 이 아님");
        }

        private static FieldEnemy Pick(bool guardian)
        {
            foreach (var e in FieldEnemy.All)
                if (e.Alive && e.IsGuardian == guardian && (guardian || e.ShieldMax > 0f)) return e;
            return null;
        }

        private static void CheckScale()
        {
            PlayerStats.Restore(1, 0);
            AdventureState.ResetForTest();
            var e = Pick(false);
            var g = Pick(true);
            if (e == null) { Fail("방패 두른 들판 적이 없음"); return; }
            if (e.WorldLevel != 0) Fail($"천하 0 인데 적 {e.WorldLevel}");
            float hp0 = e.MaxHp, atk0 = e.Atk, sh0 = e.ShieldMax;
            e.SetHpForTest(hp0 * 0.5f);
            PlayerStats.Restore(6, 0);
            AdventureState.ResetForTest(); // 세이브를 읽은 것처럼 다시 잰다
            if (AdventureState.WorldLevel != 2 || e.WorldLevel != 2) Fail($"레벨 6 → 천하 {AdventureState.WorldLevel}·적 {e.WorldLevel}");
            if (!Near(e.MaxHp, hp0 * 1.7f, 0.1f) || !Near(e.ShieldMax, sh0 * 1.7f, 0.1f) || !Near(e.Atk, atk0 * 1.44f, 0.05f)) Fail($"천하 2 적 체력 {e.MaxHp}/{hp0}·방패 {e.ShieldMax}/{sh0}·공격 {e.Atk}/{atk0}");
            if (!Near(e.Hp / e.MaxHp, 0.5f, 0.01f)) Fail("다시 재도 남은 체력 비율이 바뀜");
            if (g != null && g.GuardianGoldNow != Mathf.RoundToInt(FieldEnemy.GuardianGold * 1.5f)) Fail($"수호장 금 {g.GuardianGoldNow}");
            PlayerStats.Restore(1, 0);
            AdventureState.ResetForTest();
            if (!Near(e.MaxHp, hp0, 0.1f) || !Near(e.Atk, atk0, 0.05f)) Fail("천하 0 으로 되돌렸는데 적이 안 돌아옴");
            e.ReviveNow();
        }

        private static void CheckRewards()
        {
            PlayerStats.Restore(4, 0);
            AdventureState.ResetForTest();
            GoldState.Restore(0);
            WeaponState.Restore(null, null, 0);
            int k0 = TalentState.Count(GoTalent.Mat.Knot);
            PlayerStats.Restore(5, 0);
            var lines = AdventureState.OnLevelUp(5);
            if (GoldState.Gold != 500 || WeaponState.Ore != 2 || TalentState.Count(GoTalent.Mat.Knot) != k0 + 1 || lines.Count != 1 || AdventureState.Paid != 5) Fail($"여정 5 보상 금 {GoldState.Gold}·강화석 {WeaponState.Ore}·매듭");
            AdventureState.OnLevelUp(5);
            if (GoldState.Gold != 500) Fail("같은 등급 보상을 또 줌");
            var e = Pick(false);
            float hp0 = e != null ? e.MaxHp : 0f;
            PlayerStats.Restore(7, 0);
            lines = AdventureState.OnLevelUp(7);
            if (GoldState.Gold != 500 + 600 + 700 || WeaponState.Ore != 6 || AdventureState.Paid != 7) Fail($"두 단계 한꺼번에 금 {GoldState.Gold}");
            if (lines.Count != 3 || AdventureState.WorldLevel != 2) Fail($"천하 2 알림 줄 {lines.Count}");
            if (e != null && !Near(e.MaxHp, hp0 * 1.7f / 1.35f, 0.1f)) Fail($"레벨업으로 천하 1 → 2 인데 적이 안 다시 잼 {e.MaxHp}/{hp0}");
            // 실제 배선 — AddExp 가 레벨을 올리면 GameBootstrap 이 보상을 준다
            int gold = GoldState.Gold;
            PlayerStats.AddExp(PlayerStats.ExpToNext);
            if (PlayerStats.Level != 8 || GoldState.Gold != gold + 800) Fail($"AddExp 레벨업 보상 {GoldState.Gold - gold}");
            ClosePerkCard();
        }

        private static void ClosePerkCard()
        {
            var ui = Object.FindFirstObjectByType<PerkChoiceUi>();
            if (ui == null || !ui.IsShowing) return;
            var f = typeof(PerkChoiceUi).GetField("_panel", BindingFlags.NonPublic | BindingFlags.Instance);
            (f?.GetValue(ui) as GameObject)?.SetActive(false);
        }

        private static void CheckLower()
        {
            PlayerStats.Restore(1, 0);
            AdventureState.ResetForTest();
            if (AdventureState.CanLower(false, out _)) Fail("천하 0 에서 낮춤");
            PlayerStats.Restore(6, 0);
            AdventureState.ResetForTest();
            var e = Pick(false);
            float hp2 = e != null ? e.MaxHp : 0f;
            if (AdventureState.Lower(true)) Fail("싸우는 중 낮춤");
            if (!AdventureState.Lower(false) || AdventureState.WorldLevel != 1) Fail($"낮추기 → {AdventureState.WorldLevel}");
            if (e != null && !Near(e.MaxHp, hp2 / 1.7f * 1.35f, 0.1f)) Fail("낮췄는데 적이 안 다시 잼");
            if (AdventureState.Lower(false)) Fail("두 번 낮춤");
            if (!AdventureState.Restore(false) || AdventureState.WorldLevel != 2 || AdventureState.Restore(false)) Fail("되돌리기");
        }

        private static void CheckMap(WorldMapUi map)
        {
            PlayerStats.Restore(6, 0);
            AdventureState.ResetForTest();
            map.Open();
            if (!map.AdventureText.Contains("6") || !map.WorldLevelButton.gameObject.activeSelf) Fail($"지도 여정 칸 '{map.AdventureText}'");
            if (WorldMapUi.Fighting()) Fail("안전한 자리인데 싸우는 중");
            map.WorldLevelButton.onClick.Invoke();
            if (!AdventureState.Lowered || !map.AdventureText.Contains(GoLocalization.T("adv.lowered", "(낮춤)"))) Fail("지도 낮추기 단추");
            map.WorldLevelButton.onClick.Invoke();
            if (AdventureState.Lowered) Fail("지도 되돌리기 단추");
            map.Close();
        }

        private static void CheckSave(string savePath)
        {
            PlayerStats.Restore(9, 0);
            AdventureState.RestoreSave(true, 9);
            if (!SaveState.Save()) { Fail("SaveState.Save 실패"); return; }
            string json = System.IO.File.ReadAllText(savePath);
            if (!json.Contains("\"version\":24") || !json.Contains("\"advLowered\":true") || !json.Contains("\"advPaid\":9")) Fail("세이브 v24 에 여정이 없다");
            AdventureState.RestoreSave(false, 1);
            if (!SaveState.TryLoad() || !AdventureState.Lowered || AdventureState.Paid != 9 || AdventureState.WorldLevel != 2) Fail("v24 왕복 뒤 여정이 달라짐");
            string v23 = Regex.Replace(json.Replace("\"version\":24", "\"version\":23"), ",\"advLowered\":(true|false),\"advPaid\":\\d+", "");
            if (v23.Contains("advPaid")) { Fail("v23 가짜 파일 만들기 실패"); return; }
            System.IO.File.WriteAllText(savePath, v23);
            if (!SaveState.TryLoad()) { Fail("v23 파일 TryLoad 실패"); return; }
            if (AdventureState.Lowered || AdventureState.Paid != 9) Fail($"v23 파일 — 받은 등급 {AdventureState.Paid} ≠ 레벨 9(지난 보상이 쏟아짐)");
        }

        private static void Fail(string msg)
        {
            _ok = false;
            Debug.LogError($"[{_tag}] adventure FAIL - {msg}");
        }
    }
}
