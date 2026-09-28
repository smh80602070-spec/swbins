using System.Collections.Generic;
using System.Text.RegularExpressions;
using UnityEngine;
using Saga.Go.Combat;
using Saga.Go.Data;
using Saga.Go.Player;
using Saga.Go.UI;

namespace Saga.EditorTools
{
    /// <summary>
    /// PLAN.md 107-8 "지역 사명 사슬" 진단 — `PlaytestHeadless` 가 보물 상자 진단 뒤에 부른다.
    /// 순수 단 계산(앞 단 막힘) · 표(지역·역참·망루·무리·상자) · 일부만 쓰러뜨리면 안 셈 · 무리 먼저(발견 전 셈 쌓임, 보상 없음, 2 에서 멈춤) →
    /// 역참 켜는 순간 2/3 한꺼번에(금 80×등급) · 마을은 안 셈 · 한 줄(다음 할 일·보상 글·다 끝나면 숨음) · 세이브 v18 왕복 뒤 다시 안 줌 ·
    /// 상자 → 평정(금 200×등급) · 지도 이름 밑 "평정"/"사명 n/3" · 망루 → 무리 → 수호장 → 평정 · v15 로드.
    /// 끝나면 사명·지도·수호장·월드 이벤트·돈·경험·적·세이브 파일을 되돌린다.
    /// </summary>
    public static class PlaytestGoRegionMission
    {
        private static string _tag;
        private static bool _ok;

        public static bool Run(string tag)
        {
            _tag = tag;
            _ok = true;
            var hud = RegionMissionHud.Instance;
            var fc = FieldCombat.Instance;
            if (hud == null || fc == null) { Fail($"필요한 것 없음(사명 줄 {hud != null}, 전투 {fc != null}) — WorldMapBuilder 가 안 붙였나?"); return false; }

            var startMissions = RegionMissionState.Snapshot();
            var startWp = WorldMapState.SnapshotWaypoints();
            var startRegions = WorldMapState.SnapshotRegions();
            bool startRevealed = WorldMapState.Revealed;
            bool startGuardian = GuardianState.Defeated;
            var startEvents = new List<string>(WorldEventState.TriggeredIds);
            int gold = GoldState.Gold, level = PlayerStats.Level, exp = PlayerStats.Exp;
            Vector3 playerPos = fc.transform.position;
            string savePath = System.IO.Path.Combine(Application.persistentDataPath, "save.json");
            string savedJson = System.IO.File.Exists(savePath) ? System.IO.File.ReadAllText(savePath) : null;
            try
            {
                CheckPure();
                CheckTable();
                // 깨끗한 판 — 앞 진단이 쌓은 토벌 셈·켠 역참·수호장·연 상자를 지운다
                RegionMissionState.Restore(null);
                WorldMapState.Restore(null, null, false);
                GuardianState.Restore(false);
                var events = new List<string>();
                foreach (var id in startEvents) if (!id.StartsWith("chest_")) events.Add(id);
                WorldEventState.Restore(events);
                hud.ClearFlashForTest();
                CheckEastGrove(hud);
                CheckSaveRoundTrip(hud);
                CheckEastFinal(hud);
                CheckSouthGuardian(hud);
                CheckV15Load(savePath);
            }
            finally
            {
                foreach (var e in FieldEnemy.All)
                {
                    if (e.IsGuardian) continue;
                    if (!e.Alive) e.ReviveNow();
                    e.RestoreHomeForTest();
                }
                RegionMissionState.Restore(startMissions);
                WorldMapState.Restore(startWp, startRegions, startRevealed);
                GuardianState.Restore(startGuardian);
                WorldEventState.Restore(startEvents);
                GoldState.Restore(gold);
                PlayerStats.Restore(level, exp);
                var pc = fc.GetComponent<PlayerController>();
                if (pc != null) pc.Teleport(playerPos);
                hud.ClearFlashForTest();
                if (savedJson != null) System.IO.File.WriteAllText(savePath, savedJson);
                else if (System.IO.File.Exists(savePath)) System.IO.File.Delete(savePath);
            }
            if (_ok) Debug.Log($"[{_tag}] region mission OK - 순수 단 계산·표 {GoRegionMission.Missions.Length}·일부 처치 안 셈·무리 먼저→역참 2/3 한꺼번에·마을 안 셈·한 줄/보상 글/숨김·v18 왕복 다시 안 줌·상자 평정·지도 표시·망루→무리→수호장 평정·v15 로드");
            return _ok;
        }

        private static void CheckPure()
        {
            if (GoRegionMission.StageOf(false, 2, true) != 0) Fail("발견 전인데 단이 올라갔다(앞 단 막힘)");
            if (GoRegionMission.StageOf(true, 1, true) != 1) Fail("토벌 1 인데 셋째 단까지 셌다");
            if (GoRegionMission.StageOf(true, 2, false) != 2) Fail("발견·토벌 2 → 2 단이 아니다");
            if (GoRegionMission.StageOf(true, 2, true) != 3) Fail("셋 다 채웠는데 평정이 아니다");
        }

        private static void CheckTable()
        {
            if (GoRegionMission.IndexOf("village") >= 0) Fail("고향(마을 들판)에 사명이 있다");
            if (FieldSpawner.GroupRegion(FieldSpawner.GuardianGroupId) != null) Fail("수호장이 무리로 셈된다");
            foreach (var m in GoRegionMission.Missions)
            {
                bool region = false;
                foreach (var r in GoWorldMap.Regions) if (r.Id == m.RegionId) region = true;
                if (!region) Fail($"{m.RegionId} 가 지역 표에 없다");
                if (m.WaypointId == null)
                {
                    if (GoWorldMap.RegionAt(GoWorldMap.TowerGx, GoWorldMap.TowerGy) != m.RegionId) Fail($"{m.RegionId} 첫 단이 망루인데 망루가 다른 지역");
                }
                else
                {
                    bool found = false;
                    foreach (var w in GoWorldMap.Waypoints)
                        if (w.Id == m.WaypointId) { found = true; if (GoWorldMap.RegionAt(GoWorldMap.WaypointPos(w)) != m.RegionId) Fail($"{m.WaypointId} 가 {m.RegionId} 밖"); }
                    if (!found) Fail($"역참 {m.WaypointId} 없음");
                }
                int groups = 0;
                foreach (var e in FieldEnemy.All) if (!e.IsGuardian && FieldSpawner.GroupRegion(e.GroupId) == m.RegionId) groups++;
                if (groups == 0) Fail($"{m.RegionId} 에 토벌할 무리가 없다");
                if (m.Final == GoRegionMission.Final.Chests)
                {
                    GoRegionMission.ChestProgress(m.RegionId, out _, out int total);
                    if (total == 0) Fail($"{m.RegionId} 셋째 단이 상자인데 상자가 없다");
                }
                else if (GoRegionMission.RegionOfGroup("south_glade_w") != m.RegionId) Fail("수호장 지역과 남쪽 공터 무리 지역이 다르다");
            }
        }

        private static void CheckEastGrove(RegionMissionHud hud)
        {
            const string R = "east_grove";
            Vector3 at = TestMapData.WorldPos(6.9f, 3f);
            int g0 = GoldState.Gold;
            var group = Members("east_grove_n");
            if (group.Count < 2) { Fail("east_grove_n 무리가 둘 미만"); return; }

            // 일부만 쓰러뜨리면 안 셈
            Kill(group[0]);
            if (RegionMissionState.ClearsOf(R) != 0) Fail("무리 일부만 쓰러뜨렸는데 토벌이 셈됐다");
            // 발견 전 무리 — 셈은 쌓이고 단은 0
            foreach (var e in group) Kill(e);
            if (RegionMissionState.ClearsOf(R) != 1) Fail($"무리 전멸 셈 {RegionMissionState.ClearsOf(R)} ≠ 1");
            Revive(group);
            foreach (var e in group) Kill(e);
            Revive(group);
            foreach (var e in group) Kill(e);
            if (RegionMissionState.ClearsOf(R) != GoRegionMission.ClearsNeeded) Fail($"토벌 셈이 {GoRegionMission.ClearsNeeded} 에서 안 멈춘다({RegionMissionState.ClearsOf(R)})");
            if (RegionMissionState.StageOf(R) != 0) Fail("역참을 안 켰는데 단이 올라갔다");
            if (RegionMissionState.AddClear("village") || RegionMissionState.AddClear(null)) Fail("마을·모르는 지역 토벌이 셈됐다");
            hud.Tick(at, RegionMissionHud.RefreshSec + 0.01f);
            if (GoldState.Gold != g0) Fail("발견 전에 보상이 들어왔다");
            if (!hud.LineShown || !hud.LineText.Contains("0/3") || !hud.LineText.Contains(GoWorldMap.RegionName(R))) Fail($"사명 한 줄 \"{hud.LineText}\"");
            if (!hud.LineText.Contains(GoLocalization.T("wp.east"))) Fail($"첫 단 할 일이 역참이 아니다: \"{hud.LineText}\"");

            // 역참을 켜는 순간 둘째 단까지
            WorldMapState.Activate("wp_east");
            int expBefore = PlayerStats.Exp, levelBefore = PlayerStats.Level;
            hud.Tick(at, RegionMissionHud.RefreshSec + 0.01f);
            int want = GoRegionMission.Stage2GoldPerGrade * 1;
            if (GoldState.Gold != g0 + want) Fail($"둘째 단 금 {GoldState.Gold - g0} ≠ {want}");
            if (PlayerStats.Exp == expBefore && PlayerStats.Level == levelBefore) Fail("둘째 단 경험치가 안 들어왔다");
            if (RegionMissionState.StageOf(R) != 2) Fail($"역참 켠 뒤 단 {RegionMissionState.StageOf(R)} ≠ 2(한꺼번에)");
            if (!hud.Flashing || !hud.LineText.Contains("2/3")) Fail($"보상 글 \"{hud.LineText}\"");
            hud.Tick(at, RegionMissionHud.FlashSec + 0.01f);
            hud.Tick(at, RegionMissionHud.RefreshSec + 0.01f);
            if (hud.Flashing || !hud.LineText.Contains("2/3") || !hud.LineText.Contains(string.Format(GoLocalization.T("mission.next.chests"), 0, ""))) Fail($"셋째 단 할 일 \"{hud.LineText}\"");
            hud.Tick(at, RegionMissionHud.RefreshSec + 0.01f);
            if (GoldState.Gold != g0 + want) Fail("같은 단 보상을 두 번 줬다");
            // 다른 지역에 서면 그 지역 줄 — 마을은 사명이 없어 숨는다
            hud.Tick(TestMapData.WorldPos(3f, 3f), RegionMissionHud.RefreshSec + 0.01f);
            if (hud.LineShown) Fail("마을 들판에서 사명 줄이 보인다");
        }

        private static void CheckSaveRoundTrip(RegionMissionHud hud)
        {
            if (!SaveState.Save()) { Fail("SaveState.Save 실패"); return; }
            string path = System.IO.Path.Combine(Application.persistentDataPath, "save.json");
            string json = System.IO.File.ReadAllText(path);
            if (!json.Contains("\"version\":26") || !json.Contains("\"missions\":[")) Fail("세이브 v18 에 사명이 없다");
            RegionMissionState.Restore(null);
            int g = GoldState.Gold;
            if (!SaveState.TryLoad()) { Fail("v18 TryLoad 실패"); return; }
            if (RegionMissionState.ClearsOf("east_grove") != GoRegionMission.ClearsNeeded || (RegionMissionState.PaidOf("east_grove") & 1) == 0)
                Fail("v18 왕복 뒤 토벌 셈·받은 보상이 사라졌다");
            g = GoldState.Gold; // TryLoad 가 세이브의 돈으로 되돌린다
            hud.Tick(TestMapData.WorldPos(6.9f, 3f), RegionMissionHud.RefreshSec + 0.01f);
            if (GoldState.Gold != g) Fail("다시 불러온 뒤 받은 보상을 또 줬다");
            hud.Tick(TestMapData.WorldPos(6.9f, 3f), RegionMissionHud.FlashSec + 0.01f);
        }

        private static void CheckEastFinal(RegionMissionHud hud)
        {
            const string R = "east_grove";
            Vector3 at = TestMapData.WorldPos(6.9f, 3f);
            int g0 = GoldState.Gold;
            foreach (var c in GoTreasure.Chests)
                if (GoWorldMap.RegionAt(TestMapData.WorldPos(c.Gx, c.Gy)) == R) WorldEventState.TryTrigger(GoTreasure.EventKey(c));
            hud.Tick(at, RegionMissionHud.RefreshSec + 0.01f);
            int want = GoRegionMission.FinalGoldPerGrade * 1;
            if (GoldState.Gold != g0 + want) Fail($"평정 금 {GoldState.Gold - g0} ≠ {want}");
            if (!hud.Flashing || !hud.LineText.Contains(Seg("mission.clear"))) Fail($"평정 글 \"{hud.LineText}\"");
            hud.Tick(at, RegionMissionHud.FlashSec + 0.01f);
            hud.Tick(at, RegionMissionHud.RefreshSec + 0.01f);
            if (hud.LineShown) Fail("평정한 지역인데 사명 줄이 남아 있다");

            var ui = WorldMapUi.Instance;
            if (ui != null)
            {
                WorldMapState.Visit(R);
                WorldMapState.Visit("south_glade");
                ui.Open();
                int east = -1, south = -1;
                for (int i = 0; i < GoWorldMap.Regions.Length; i++)
                {
                    if (GoWorldMap.Regions[i].Id == R) east = i;
                    if (GoWorldMap.Regions[i].Id == "south_glade") south = i;
                }
                if (!ui.RegionLabel(east).Contains(GoLocalization.T("map.mission_clear"))) Fail($"지도 동쪽 숲 이름표 \"{ui.RegionLabel(east)}\"");
                if (!ui.RegionLabel(south).Contains(string.Format(GoLocalization.T("map.mission"), 0, 3))) Fail($"지도 남쪽 공터 이름표 \"{ui.RegionLabel(south)}\"");
                ui.Close();
            }
        }

        private static void CheckSouthGuardian(RegionMissionHud hud)
        {
            const string R = "south_glade";
            Vector3 at = TestMapData.WorldPos(3f, 7.5f);
            WorldMapState.RevealAll();
            hud.Tick(at, RegionMissionHud.RefreshSec + 0.01f);
            if (RegionMissionState.StageOf(R) != 1) Fail($"망루에 오른 뒤 남쪽 공터 단 {RegionMissionState.StageOf(R)} ≠ 1");
            if (!hud.LineText.Contains(string.Format(GoLocalization.T("mission.next.clears"), 0, 2))) Fail($"둘째 단 할 일 \"{hud.LineText}\"");
            int g0 = GoldState.Gold;
            var group = Members("south_glade_e");
            foreach (var e in group) Kill(e);
            Revive(group);
            foreach (var e in group) Kill(e);
            hud.Tick(at, RegionMissionHud.RefreshSec + 0.01f);
            int want2 = GoRegionMission.Stage2GoldPerGrade * 3;
            if (GoldState.Gold != g0 + want2) Fail($"남쪽 공터 둘째 단 금 {GoldState.Gold - g0} ≠ {want2}");
            hud.Tick(at, RegionMissionHud.FlashSec + 0.01f);
            hud.Tick(at, RegionMissionHud.RefreshSec + 0.01f);
            if (!hud.LineText.Contains(GoLocalization.T("mission.next.guardian"))) Fail($"셋째 단 할 일이 수호장이 아니다: \"{hud.LineText}\"");
            GuardianState.MarkDefeated();
            hud.Tick(at, RegionMissionHud.RefreshSec + 0.01f);
            int want3 = GoRegionMission.FinalGoldPerGrade * 3;
            if (GoldState.Gold != g0 + want2 + want3) Fail($"남쪽 공터 평정 금 {GoldState.Gold - g0 - want2} ≠ {want3}");
            if (!hud.LineText.Contains(Seg("mission.clear"))) Fail($"수호장 뒤 평정 글 \"{hud.LineText}\"");
            hud.Tick(at, RegionMissionHud.FlashSec + 0.01f);
        }

        private static void CheckV15Load(string path)
        {
            if (!SaveState.Save()) { Fail("SaveState.Save 실패(v15 준비)"); return; }
            string json = System.IO.File.ReadAllText(path);
            string v15 = Regex.Replace(json.Replace("\"version\":26", "\"version\":15"), ",\"missions\":\\[[^\\]]*\\]", "");
            if (v15.Contains("missions")) { Fail("v15 모양 만들기 실패"); return; }
            System.IO.File.WriteAllText(path, v15);
            if (!SaveState.TryLoad()) { Fail("v15 파일 TryLoad 실패"); return; }
            foreach (var m in GoRegionMission.Missions)
                if (RegionMissionState.ClearsOf(m.RegionId) != 0 || RegionMissionState.PaidOf(m.RegionId) != 0) Fail($"v15 를 읽었는데 {m.RegionId} 사명 기록이 있다");
        }

        private static List<FieldEnemy> Members(string groupId)
        {
            var list = new List<FieldEnemy>();
            foreach (var e in FieldEnemy.All) if (e.GroupId == groupId) { if (!e.Alive) e.ReviveNow(); list.Add(e); }
            return list;
        }

        private static void Revive(List<FieldEnemy> group)
        {
            foreach (var e in group) if (!e.Alive) e.ReviveNow();
        }

        private static void Kill(FieldEnemy e)
        {
            if (e.Alive) e.TakeHit(999999f, GoElement.Physical, 100f, out _);
        }

        /// <summary>번역 표 서식 글에서 자리표({n}) 사이 가장 긴 고정 조각 — 지금 언어로 "평정!" 같은 말을 찾는다(110 ⑤c-2c-2).</summary>
        private static string Seg(string key)
        {
            string best = "";
            foreach (var part in Regex.Split(GoLocalization.T(key), @"\{[^}]*\}")) if (part.Trim().Length > best.Trim().Length) best = part;
            return best.Trim();
        }

        private static void Fail(string msg)
        {
            Debug.LogError($"[{_tag}] region mission: {msg}");
            _ok = false;
        }
    }
}
