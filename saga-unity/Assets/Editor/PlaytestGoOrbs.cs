using System.Collections.Generic;
using System.Text.RegularExpressions;
using UnityEngine;
using Saga.Go.Combat;
using Saga.Go.Data;
using Saga.Go.World;

namespace Saga.EditorTools
{
    /// <summary>
    /// PLAN.md 109-14-3a "수집 구슬·봉헌"(웹 사가고 ⑲-3 진단 항목) — `PlaytestHeadless` 가 정상 진단 뒤에 부른다.
    /// 표(지역 일곱 × 셋·id 겹침 없음·자리 규칙 — 강 구슬은 강 칸 수면 위·산마루는 정상 윗면 둘레·나무는 숲 칸) · 손 닿는 높이(들판은 서서 · 나무는 점프 꼭대기라야 ·
    /// 산마루는 윗면에 서서 · 강은 헤엄치는 발) · 월드(구슬 물체 수 = 안 주운 수) · 줍기(한 번만) · 봉헌(불 안 올린 봉수대 거절 · 14m 밖 거절 · 둘마다 등급 +1·스태미나 상한 +8·금) ·
    /// 세이브 v20 왕복·v18 로드(빈 기록). 끝나면 구슬·봉수대·돈·경험·세이브 파일을 되돌린다.
    /// </summary>
    public static class PlaytestGoOrbs
    {
        private static string _tag;
        private static bool _ok;

        public static bool Run(string tag)
        {
            _tag = tag;
            _ok = true;
            var field = GoOrbField.Instance;
            if (field == null) { Fail("GoOrbField 없음(WorldMapBuilder 가 안 붙임)"); return false; }

            var startGot = OrbState.Snapshot();
            int startGiven = OrbState.Given;
            var startEvents = new List<string>(WorldEventState.TriggeredIds);
            int startGold = GoldState.Gold, startLevel = PlayerStats.Level, startExp = PlayerStats.Exp;
            string savePath = System.IO.Path.Combine(Application.persistentDataPath, "save.json");
            string originalSave = System.IO.File.Exists(savePath) ? System.IO.File.ReadAllText(savePath) : null;
            string table = "", pick = "", offer = "";
            try
            {
                table = CheckTable();
                CheckReach(field);
                pick = CheckPick(field);
                offer = CheckOffer(field);
                CheckSave(savePath);
            }
            finally
            {
                if (originalSave != null) System.IO.File.WriteAllText(savePath, originalSave);
                else if (System.IO.File.Exists(savePath)) System.IO.File.Delete(savePath);
                OrbState.Restore(startGot, startGiven);
                WorldEventState.Restore(startEvents);
                GoldState.Restore(startGold);
                PlayerStats.Restore(startLevel, startExp);
                GoStamina.ResetFull();
                field.Rebuild();
            }
            if (_ok) Debug.Log($"[{_tag}] orbs OK - {table} · 손 닿는 높이 넷 · {pick} · {offer} · 세이브 v20 왕복·v18 로드");
            return _ok;
        }

        private static string CheckTable()
        {
            var all = GoOrbs.All;
            if (all.Length != GoWorldMap.Regions.Length * GoOrbs.PerRegion) Fail($"구슬 {all.Length} ≠ 지역 {GoWorldMap.Regions.Length} × 3");
            var ids = new HashSet<string>();
            var perRegion = new Dictionary<string, int>();
            var kinds = new int[4];
            foreach (var o in all)
            {
                if (!ids.Add(o.Id)) Fail($"id 겹침 {o.Id}");
                perRegion.TryGetValue(o.RegionId, out int n); perRegion[o.RegionId] = n + 1;
                kinds[(int)o.Kind]++;
                char ch = TestMapData.TileAt(o.Gx, o.Gy);
                switch (o.Kind)
                {
                    case GoOrbs.Kind.River:
                        if (ch != '~') Fail($"{o.Id} 강 구슬이 강 칸이 아님({ch})");
                        if (Mathf.Abs(o.Pos.y - (TestMapData.WaterSurfaceHeight + GoOrbs.RiverAbove)) > 0.01f) Fail($"{o.Id} 강 구슬 높이 {o.Pos.y}");
                        break;
                    case GoOrbs.Kind.Tree:
                        if (ch != 'T') Fail($"{o.Id} 나무 구슬이 숲 칸이 아님({ch})");
                        break;
                    case GoOrbs.Kind.Ridge:
                        if (!TestMapData.HasPeak(o.Gx, o.Gy)) Fail($"{o.Id} 산마루 구슬이 정상 칸이 아님");
                        break;
                    case GoOrbs.Kind.Field:
                        if (ch != '.' && ch != '=' && ch != 'F' && ch != 'T') Fail($"{o.Id} 들판 구슬 칸 {ch}");
                        break;
                }
                if (GoWorldMap.RegionAt(o.Gx, o.Gy) != o.RegionId) Fail($"{o.Id} 가 제 지역 밖");
            }
            foreach (var r in GoWorldMap.Regions)
                if (!perRegion.TryGetValue(r.Id, out int n) || n != GoOrbs.PerRegion) Fail($"{r.Id} 구슬 {n} ≠ 3");
            if (kinds[(int)GoOrbs.Kind.River] == 0 || kinds[(int)GoOrbs.Kind.Ridge] == 0 || kinds[(int)GoOrbs.Kind.Tree] == 0) Fail("강·산마루·나무 구슬 중 없는 결");
            return $"구슬 {all.Length}(산마루 {kinds[0]}·강 {kinds[1]}·나무 {kinds[2]}·들판 {kinds[3]})";
        }

        private static void CheckReach(GoOrbField field)
        {
            foreach (var o in GoOrbs.All)
            {
                Vector3 p = field.PosOf(o.Id);
                switch (o.Kind)
                {
                    case GoOrbs.Kind.Field:
                        if (!GoOrbs.CanReach(p, p - Vector3.up * GoOrbs.FieldAbove)) Fail($"{o.Id} 들판 구슬이 서서 안 닿음");
                        break;
                    case GoOrbs.Kind.Tree:
                    {
                        Vector3 feet = p - Vector3.up * GoOrbs.TreeAbove;
                        if (GoOrbs.CanReach(p, feet)) Fail($"{o.Id} 나무 구슬이 서서 닿음(점프해야)");
                        float apex = Saga.Go.Player.PlayerController.JumpVelocity * Saga.Go.Player.PlayerController.JumpVelocity / (2f * 20f);
                        if (!GoOrbs.CanReach(p, feet + Vector3.up * apex)) Fail($"{o.Id} 나무 구슬이 점프 꼭대기({apex:0.0}m)에서도 안 닿음");
                        break;
                    }
                    case GoOrbs.Kind.Ridge:
                        if (!GoOrbs.CanReach(p, p - Vector3.up * GoOrbs.RidgeAbove)) Fail($"{o.Id} 산마루 구슬이 윗면에 서서 안 닿음");
                        if (GoOrbs.CanReach(p, new Vector3(p.x, 0f, p.z))) Fail($"{o.Id} 산마루 구슬이 산 밑에서 닿음");
                        break;
                    case GoOrbs.Kind.River:
                    {
                        Vector3 swimFeet = new Vector3(p.x, TestMapData.WaterSurfaceHeight - Saga.Go.Player.PlayerController.SwimDepth, p.z);
                        if (!GoOrbs.CanReach(p, swimFeet)) Fail($"{o.Id} 강 구슬이 헤엄치는 발에서 안 닿음");
                        break;
                    }
                }
            }
        }

        private static string CheckPick(GoOrbField field)
        {
            // 봉수대 곁 구슬을 줍다 봉헌이 먼저 일어나지 않게 불을 끈다(CheckOffer 가 다시 켠다)
            var ev = new List<string>(WorldEventState.TriggeredIds);
            ev.Remove(BeaconTower.EventId);
            WorldEventState.Restore(ev);
            OrbState.ResetForTest();
            field.Rebuild();
            int objs = 0;
            foreach (Transform c in field.transform) if (c.name.StartsWith("Orb_")) objs++;
            if (objs < GoOrbs.All.Length) Fail($"구슬 물체 {objs} < {GoOrbs.All.Length}");

            GoOrbs.Orb fieldOrb = default, treeOrb = default;
            foreach (var o in GoOrbs.All)
            {
                if (o.Kind == GoOrbs.Kind.Field && fieldOrb.Id == null) fieldOrb = o;
                if (o.Kind == GoOrbs.Kind.Tree && treeOrb.Id == null) treeOrb = o;
            }
            if (fieldOrb.Id == null || treeOrb.Id == null) { Fail("들판·나무 구슬이 없어 줍기를 못 봄"); return "줍기 못 봄"; }
            Vector3 fp = field.PosOf(fieldOrb.Id);
            if (field.Check(fp - Vector3.up * GoOrbs.FieldAbove + new Vector3(GoOrbs.PickRadius + 1f, 0f, 0f)) != 0) Fail("3m 밖에서 주워짐");
            if (field.Check(fp - Vector3.up * GoOrbs.FieldAbove) != 1 || !OrbState.Has(fieldOrb.Id)) Fail("들판 구슬을 서서 못 주움");
            if (field.Check(fp - Vector3.up * GoOrbs.FieldAbove) != 0 || OrbState.GotCount != 1) Fail("같은 구슬이 두 번 주워짐");
            Vector3 tp = field.PosOf(treeOrb.Id);
            if (field.Check(tp - Vector3.up * GoOrbs.TreeAbove) != 0) Fail("나무 구슬이 서서 주워짐");
            if (field.Check(tp - Vector3.up * (GoOrbs.TreeAbove - 2.4f)) != 1) Fail("나무 구슬이 점프 꼭대기에서 안 주워짐");
            return $"줍기 둘(들판·나무 점프) · 한 번만";
        }

        private static string CheckOffer(GoOrbField field)
        {
            // 불 안 올린 봉수대 — 거절
            var events = new List<string>(WorldEventState.TriggeredIds);
            events.Remove(BeaconTower.EventId);
            WorldEventState.Restore(events);
            Vector3 at = BeaconTower.Position;
            if (field.TryOffer(at) != 0 || OrbState.Given != 0) Fail("불 안 올린 봉수대에 바쳐짐");
            WorldEventState.TryTrigger(BeaconTower.EventId);
            if (field.TryOffer(at + new Vector3(GoOrbs.OfferRadius + 2f, 0f, 0f)) != 0 || OrbState.Given != 0) Fail("14m 밖에서 바쳐짐");
            int gold0 = GoldState.Gold;
            float max0 = GoStamina.Max;
            if (field.TryOffer(at) != 1 || OrbState.Level != 1 || OrbState.Held != 0) Fail($"구슬 둘 봉헌 → 등급 {OrbState.Level}");
            if (Mathf.Abs(GoStamina.Max - (max0 + GoOrbs.StaminaPerLevel)) > 0.01f) Fail($"스태미나 상한 {GoStamina.Max} ≠ {max0 + GoOrbs.StaminaPerLevel}");
            if (GoldState.Gold - gold0 != GoOrbs.GoldPerLevel) Fail($"봉헌 금 {GoldState.Gold - gold0}");
            // 하나 더 — 등급은 그대로
            foreach (var o in GoOrbs.All) if (!OrbState.Has(o.Id)) { OrbState.Collect(o.Id); break; }
            if (field.TryOffer(at) != 0 || OrbState.Level != 1 || OrbState.Given != 3) Fail("셋째 구슬이 등급을 올림/안 바쳐짐");
            // 전부 모으면 최대 10단 · 180
            foreach (var o in GoOrbs.All) OrbState.Collect(o.Id);
            field.TryOffer(at);
            if (OrbState.Level != GoOrbs.MaxLevel || Mathf.Abs(GoStamina.Max - 180f) > 0.01f) Fail($"전부 봉헌 등급 {OrbState.Level}·상한 {GoStamina.Max}");
            return $"봉헌(불 없음·14m 밖 거절 · 둘 → 1단 +8 · 셋째 그대로 · 전부 {GoOrbs.MaxLevel}단 {GoStamina.Max:0})";
        }

        private static void CheckSave(string savePath)
        {
            OrbState.Restore(new List<string> { GoOrbs.All[0].Id, GoOrbs.All[1].Id, GoOrbs.All[2].Id }, 2);
            if (!SaveState.Save()) { Fail("SaveState.Save 실패"); return; }
            string json = System.IO.File.ReadAllText(savePath);
            if (!json.Contains("\"version\":21") || !json.Contains("\"orbsGiven\":2") || !json.Contains(GoOrbs.All[2].Id)) Fail("세이브 v19 에 구슬이 없다");
            OrbState.ResetForTest();
            if (!SaveState.TryLoad() || OrbState.GotCount != 3 || OrbState.Given != 2 || OrbState.Level != 1) Fail($"v19 왕복 뒤 구슬 {OrbState.GotCount}·바침 {OrbState.Given}");
            string v18 = Regex.Replace(json.Replace("\"version\":21", "\"version\":18"), ",\"orbsGot\":\\[[^\\]]*\\],\"orbsGiven\":\\d+", "");
            if (v18.Contains("orbsGot")) { Fail("v18 가짜 파일 만들기 실패"); return; }
            System.IO.File.WriteAllText(savePath, v18);
            if (!SaveState.TryLoad()) { Fail("v18 파일 TryLoad 실패"); return; }
            if (OrbState.GotCount != 0 || OrbState.Given != 0) Fail("v18 파일을 읽었는데 구슬 기록이 비어 있지 않음");
        }

        private static void Fail(string msg)
        {
            _ok = false;
            Debug.LogError($"[{_tag}] orbs FAIL - {msg}");
        }
    }
}
