using System.Collections.Generic;
using System.Linq;
using System.Text.RegularExpressions;
using UnityEngine;
using Saga.Go.Combat;
using Saga.Go.Data;
using Saga.Go.Player;
using Saga.Go.UI;
using Saga.Go.World;

namespace Saga.EditorTools
{
    /// <summary>
    /// PLAN.md 109-14-27a "서리봉 고원"(웹 사가고 ⑲-27 진단 항목) — `PlaytestHeadless` 가 탐사 진단 뒤에 부른다.
    /// 표(명소 다섯·발견 일곱·고원 안·서로 안 겹침·글) · 지역(고원 안이면 서리봉 고원 · 지도 안 칸은 그대로 · 이름·사연·눈안개 바이옴) ·
    /// 땅(눈밭 바닥·담·보이지 않는 벽·산성 남쪽 문) · 발견(고원 밖이면 못 찾음 · 명소 16m·발견 7m · 보상 한 번) ·
    /// 드나드는 길(북쪽 산기슭 돌기둥 ↔ 경계비 · 곁에서만 · 눈 내림) · 세이브 왕복(옛 세이브는 못 찾은 채).
    /// 끝나면 발견·돈·연마석·경험치·자리·세이브 파일을 되돌린다.
    /// </summary>
    public static class PlaytestGoFrost
    {
        private static string _tag;
        private static bool _ok;

        public static bool Run(string tag)
        {
            _tag = tag;
            _ok = true;
            var fc = FieldCombat.Instance;
            var pc = fc != null ? fc.GetComponent<PlayerController>() : null;
            var field = FrostField.Instance;
            var atm = Object.FindFirstObjectByType<RegionAtmosphere>();
            if (fc == null || pc == null || field == null) { Fail("FieldCombat/PlayerController/FrostField 없음"); return false; }

            var found = FrostState.Snapshot();
            int gold = GoldState.Gold, polish = ArtifactState.Polish;
            var arts = ArtifactState.Snapshot();
            int aseq = ArtifactState.Seq;
            int lv = PlayerStats.Level, exp = PlayerStats.Exp;
            string savePath = System.IO.Path.Combine(Application.persistentDataPath, "save.json");
            string originalSave = System.IO.File.Exists(savePath) ? System.IO.File.ReadAllText(savePath) : null;
            var parts = new List<string>();
            try
            {
                CheckTables(parts);
                CheckRegion(atm, parts);
                CheckGround(field, parts);
                CheckDiscover(field, parts);
                CheckTravel(fc, pc, field, parts);
                CheckMapJump(fc, pc, parts);
                CheckWild(fc, pc, field, parts);
                CheckKing(fc, pc, field, savePath, parts);
                CheckSave(savePath, parts);
            }
            finally
            {
                if (originalSave != null) System.IO.File.WriteAllText(savePath, originalSave);
                else if (System.IO.File.Exists(savePath)) System.IO.File.Delete(savePath);
                FrostState.Restore(found);
                GoldState.Restore(gold);
                ArtifactState.Restore(arts, aseq, polish);
                PlayerStats.Restore(lv, exp);
                field.Tick(fc.SafePoint);
                fc.ResetForTest();
                pc.Teleport(fc.SafePoint);
                foreach (var e in FieldEnemy.All) e.RestoreHomeForTest();
            }
            if (_ok) Debug.Log($"[{_tag}] frost OK - {string.Join(" · ", parts)}");
            return _ok;
        }

        private static GoFrost.Site Site(string id) { GoFrost.TrySite(id, out var s); return s; }

        // ---- 표 ----

        private static void CheckTables(List<string> parts)
        {
            var all = GoFrost.Sites;
            if (all.Length != 12 || all.Count(s => s.Big) != 5 || all.Count(s => !s.Big) != 7 || all.Select(s => s.Id).Distinct().Count() != 12) Fail("명소 다섯·발견 일곱이 아님");
            foreach (var s in all)
            {
                float r = GoFrost.RadiusOf(s);
                Vector3 p = s.Pos;
                if (!GoFrost.Contains(p) || Mathf.Abs(s.Off.x) + r + 2f > GoFrost.HalfX || Mathf.Abs(s.Off.y) + r + 2f > GoFrost.HalfZ) Fail($"{s.Id} 가 고원 가장자리에 걸침");
                if (s.Name.StartsWith("frost.site.")) Fail($"{s.Id} 이름 글이 없음");
                if (GoEras.EraName(s.Era).Length == 0) Fail($"{s.Id} 시대");
                foreach (var o in all)
                    if (o.Id != s.Id && string.CompareOrdinal(o.Id, s.Id) > 0 && (o.Pos - p).magnitude < r + GoFrost.RadiusOf(o) - 8f) Fail($"{s.Id}·{o.Id} 발견 원이 많이 겹침 {(o.Pos - p).magnitude:0.0}m");
            }
            if (all.Select(s => s.Era).Distinct().Count() != 3) Fail("과거·현대·미래가 한 땅에 안 섞임");
            // 지도 안(글자 지도 ±216×±264)과 안 겹치고 경계벽(90m) 밖
            if (GoFrost.Contains(new Vector3(0f, 0f, 0f)) || GoFrost.Contains(TestMapData.WorldPos(3, 3)) || GoFrost.Center.z + GoFrost.HalfZ > -TestMapData.RowCount * TestMapData.TileSize * 0.5f - 200f) Fail("고원이 지도 곁에 붙음");
            if (GoFrost.GatePos == Vector3.zero) Fail("돌기둥 자리");
            parts.Add("표(명소 다섯·발견 일곱·안 겹침·세 시대·지도 밖)");
        }

        // ---- 지역 ----

        private static void CheckRegion(RegionAtmosphere atm, List<string> parts)
        {
            if (GoWorldMap.RegionAt(GoFrost.Center) != "frost" || GoWorldMap.RegionAt(Site("fort").Pos) != "frost") Fail("고원 안이 서리봉 고원이 아님");
            if (GoWorldMap.RegionAt(TestMapData.WorldPos(3, 3)) != "village" || GoWorldMap.RegionAt(TestMapData.WorldPos(5, 5)) != "river") Fail("지도 안 칸의 지역이 바뀜");
            if (GoWorldMap.Regions.Any(r => r.Id == "frost")) Fail("고원이 글자 지도 지역 표에 들어감(구슬·채집·사명이 셈)");
            if (GoWorldMap.RegionName("frost").StartsWith("region.") || GoWorldMap.RegionOf("frost").Hanja != "霜峰" || GoWorldMap.RegionLore("frost").StartsWith("region.")) Fail("이름·한자·사연");
            if (GoWorldMap.DangerLine("frost").Length == 0 || WorldMapUi_EnterText().Length == 0) Fail("위험 줄·들어설 때 자막");
            if (GoWorldMap.AtmosphereOf("frost").RegionId != "frost") Fail("눈안개 바이옴");
            if (atm != null)
            {
                atm.Tick(GoFrost.Center, 60f);
                if (atm.CurrentRegion != "frost" || atm.SunTint.b < atm.SunTint.r) Fail($"바이옴이 눈안개로 안 옮김 '{atm.CurrentRegion}'");
                atm.Tick(TestMapData.WorldPos(3, 3), 60f);
                if (atm.CurrentRegion != "village") Fail("나오면 마을 바이옴으로 안 돌아옴");
            }
            parts.Add("지역(고원 안 = 서리봉 고원·지도 칸은 그대로·표 밖·이름·한자·사연·눈안개)");
        }

        private static string WorldMapUi_EnterText() => Saga.Go.UI.WorldMapUi.EnterText("frost", true);

        // ---- 땅 ----

        private static void CheckGround(FrostField field, List<string> parts)
        {
            Vector3 c = GoFrost.Center;
            if (!Physics.Raycast(c + Vector3.up * 30f, Vector3.down, out var hit, 60f) || Mathf.Abs(hit.point.y) > 0.05f) Fail("눈밭 바닥이 y=0 이 아님");
            // 명소 자리 바닥 — 모두 딛는 높이
            foreach (var s in GoFrost.Sites)
            {
                if (s.Id == "fort" || s.Id == "obs" || s.Id == "ship" || s.Id == "cave") continue; // 가운데에 건물·덩이가 섬
                if (!Physics.Raycast(s.Pos + new Vector3(3f, 30f, 3f), Vector3.down, out var h2, 60f) || h2.point.y > 1.2f) Fail($"{s.Id} 곁 바닥 높이");
            }
            var fort = Site("fort").Pos;
            // 산성 담 — 북쪽 담 위에서 아래로 쏘면 담 윗면(~5m), 남쪽 문 가운데는 바닥
            if (!Physics.Raycast(fort + new Vector3(0f, 30f, -20f), Vector3.down, out var w1, 60f) || w1.point.y < 4f) Fail("산성 북쪽 담이 없다");
            if (!Physics.Raycast(fort + new Vector3(0f, 30f, 20f), Vector3.down, out var w2, 60f) || w2.point.y > 0.5f) Fail("산성 남쪽 문이 막힘");
            if (!Physics.Raycast(fort + new Vector3(-12f, 30f, 20f), Vector3.down, out var w3, 60f) || w3.point.y < 4f) Fail("산성 남쪽 담 조각이 없다");
            // 바깥 보이지 않는 벽 — 안쪽에서 바깥으로 수평으로 쏘면 걸린다
            foreach (var dir in new[] { Vector3.forward, Vector3.back, Vector3.left, Vector3.right })
            {
                float reach = (dir == Vector3.forward || dir == Vector3.back ? GoFrost.HalfZ : GoFrost.HalfX) + 10f;
                if (!Physics.Raycast(c + Vector3.up * 5f, dir, out var wh, reach) || wh.collider.GetComponent<NoClimb>() == null) Fail($"경계벽이 {dir} 쪽에 없거나 오를 수 있음");
            }
            foreach (var s in GoFrost.Sites) if (field.SiteObject(s.Id) == null) Fail($"{s.Id} 모델이 안 섬");
            if (field.GateGround == Vector3.zero || Mathf.Abs(field.GateGround.y) > 60f) Fail("돌기둥 높이");
            // 109-14-33 눈 나무 — 160그루 세 메시(잎·눈·줄기), 충돌 없음, 명소·곰왕 자리를 비킴
            if (field.TreesBuilt != FrostField.TreeCount) Fail($"눈 나무 {field.TreesBuilt} ≠ {FrostField.TreeCount}");
            var treeMeshes = field.GetComponentsInChildren<MeshFilter>(true).Where(m => m.name.StartsWith("Frost_trees_")).ToArray();
            if (treeMeshes.Length != 3 || treeMeshes.Any(m => m.sharedMesh == null || m.sharedMesh.vertexCount < 1000 || m.GetComponent<Collider>() != null)) Fail("눈 나무 메시 셋(잎·눈·줄기)·충돌 없음");
            else
            {
                var leaf = treeMeshes.First(m => m.name.EndsWith("leaf")).sharedMesh;
                foreach (var s in GoFrost.Sites)
                    if (leaf.vertices.Any(p => new Vector3(p.x - s.Pos.x, 0f, p.z - s.Pos.z).magnitude < (s.Big ? 40f : 20f) && p.y < GoFrost.Center.y + 3f)) { Fail($"눈 나무가 {s.Id} 를 막음"); break; }
                if (leaf.vertices.Any(p => new Vector3(p.x - GoFrost.KingHome.x, 0f, p.z - GoFrost.KingHome.z).magnitude < 12f)) Fail("눈 나무가 곰왕 자리를 막음");
            }
            parts.Add("땅(눈밭 바닥·산성 담과 남쪽 문·경계벽 넷·모델 열둘·눈 나무 160)");
        }

        // ---- 발견 ----

        private static void CheckDiscover(FrostField field, List<string> parts)
        {
            FrostState.ResetForTest();
            GoldState.Restore(0);
            int pol0 = ArtifactState.Polish, exp0 = PlayerStats.Exp, lv0 = PlayerStats.Level;
            PlayerStats.Restore(1, 0);
            if (field.Check(TestMapData.WorldPos(3, 3)) != 0 || FrostState.Count != 0) Fail("고원 밖에서 찾음");
            var stele = Site("stele");
            if (field.Check(stele.Pos + new Vector3(GoFrost.BigRadius + 1f, 0f, 0f)) != 0) Fail("명소 16m 밖에서 찾음");
            int n = field.Check(stele.Pos + new Vector3(GoFrost.BigRadius - 1f, 0f, 0f));
            if (n != 1 || !FrostState.Found("stele") || GoldState.Gold != GoFrost.BigGold || ArtifactState.Polish != pol0 + GoFrost.BigPolish || PlayerStats.Exp < GoFrost.BigExp || field.LastFound == null || !field.LastFound.Contains(stele.Name)) Fail($"명소 발견 보상(금 {GoldState.Gold}·연마석 {ArtifactState.Polish - pol0}·경험 {PlayerStats.Exp})");
            if (field.Check(stele.Pos) != 0 || GoldState.Gold != GoFrost.BigGold) Fail("같은 명소를 또 찾아 보상을 줌");
            var man = Site("snowman");
            if (field.Check(man.Pos + new Vector3(GoFrost.SmallRadius + 1f, 0f, 0f)) != 0) Fail("발견 7m 밖에서 찾음");
            int gold = GoldState.Gold;
            if (field.Check(man.Pos + new Vector3(2f, 0f, 0f)) != 1 || GoldState.Gold != gold + GoFrost.SmallGold) Fail("작은 발견 보상(금 60)");
            if (FrostState.Discover("nope") || FrostState.Count != 2) Fail("없는 id 를 찾음");
            PlayerStats.Restore(lv0, exp0);
            parts.Add("발견(밖 못 찾음·명소 16m·발견 7m·보상 한 번·없는 id)");
        }

        // ---- 드나드는 길 ----

        private static void CheckTravel(FieldCombat fc, PlayerController pc, FrostField field, List<string> parts)
        {
            fc.ResetForTest();
            Vector3 gate = field.GateGround;
            pc.Teleport(gate + new Vector3(3f, 0.3f, 0f));
            if (field.NearGate(fc.transform.position) != 1) Fail("돌기둥 곁 판정");
            field.Tick(fc.transform.position);
            if (field.TravelButton == null || !field.TravelButton.gameObject.activeSelf || field.TravelLabel != GoLocalization.T("frost.go_up", "서리 고개로 오른다")) Fail($"이동 단추 '{field.TravelLabel}'");
            if (field.SnowOn) Fail("고원 밖인데 눈이 내림");
            if (!field.TravelHere()) Fail("돌기둥 곁에서 못 오름");
            if (!GoFrost.Contains(fc.transform.position) || (fc.transform.position - GoFrost.ArrivalPos).magnitude > 2f) Fail($"고원 도착 자리 {fc.transform.position}");
            field.Tick(fc.transform.position);
            if (!field.SnowOn) Fail("고원 안인데 눈이 안 내림");
            if (field.NearGate(fc.transform.position) != 0 || field.TravelButton.gameObject.activeSelf) Fail("도착하자마자 다시 돌기둥 곁으로 잡힘");
            // 고원 쪽 돌기둥에서 내려가기
            pc.Teleport(GoFrost.SteleGround + new Vector3(4f, 0.3f, 3f));
            if (field.NearGate(fc.transform.position) != -1) Fail("경계비 돌기둥 곁 판정");
            field.Tick(fc.transform.position);
            if (field.TravelLabel != GoLocalization.T("frost.go_down", "마을 쪽으로 내려간다")) Fail("내려가기 단추 글");
            if (!field.TravelHere() || GoFrost.Contains(fc.transform.position) || (fc.transform.position - GoFrost.ReturnPos).magnitude > 2f) Fail("고원에서 못 내려옴");
            field.Tick(fc.transform.position);
            if (field.SnowOn || field.NearGate(fc.transform.position) != 0) Fail("내려왔는데 눈·돌기둥 곁");
            if (field.TravelHere()) Fail("돌기둥 곁이 아닌데 이동함");
            parts.Add("드나드는 길(돌기둥 곁 판정·단추·오름·눈·내림·도착 자리는 곁이 아님)");
        }

        // ---- 지도(M) 순간이동 지점 둘(109-14-27b) — 서리 고개(경계비를 찾으면)·기상 관측소(관측소를 찾으면) ----

        private static void CheckMapJump(FieldCombat fc, PlayerController pc, List<string> parts)
        {
            var map = WorldMapUi.Instance;
            if (map == null) { Fail("지도 UI 없음"); return; }
            fc.ResetForTest();
            pc.Teleport(fc.SafePoint);
            FrostState.ResetForTest();
            map.Open();
            if (map.FrostButton(0).gameObject.activeSelf || map.FrostButton(1).gameObject.activeSelf) Fail("아무것도 못 찾았는데 고원 단추가 보임");
            if (map.TeleportToFrost(0) || map.TeleportToFrost(1)) Fail("못 찾은 지점으로 순간이동됨");
            FrostState.Discover("stele");
            if (!map.FrostButton(0).gameObject.activeSelf || !map.FrostButton(1).gameObject.activeSelf) Fail("경계비를 찾았는데 고원 단추가 안 보임");
            var name0 = map.FrostButton(0).GetComponentInChildren<TMPro.TextMeshProUGUI>().text;
            if (!name0.Contains(WorldMapUi.FrostJumpName(0)) || WorldMapUi.FrostJumpName(1) != Site("obs").Name) Fail($"단추 글 {name0}");
            if (map.TeleportToFrost(1)) Fail("관측소를 못 찾았는데 순간이동됨");
            DuelGate.Report(true);
            bool duel = map.TeleportToFrost(0);
            DuelGate.ResetForTest();
            if (duel) Fail("결투 중에 순간이동됨");
            if (!map.TeleportToFrost(0) || (fc.transform.position - GoFrost.ArrivalPos).magnitude > 2f || !GoFrost.Contains(fc.transform.position)) Fail($"서리 고개 순간이동 자리 {fc.transform.position}");
            if (map.IsOpen) Fail("순간이동 뒤 지도가 안 닫힘");
            map.Open();
            FrostState.Discover("obs");
            if (!map.TeleportToFrost(1)) Fail("관측소 순간이동 거절");
            Vector3 obs = Site("obs").Pos;
            if (!GoFrost.Contains(fc.transform.position) || (fc.transform.position - obs).magnitude > 12f || (fc.transform.position - obs).magnitude < 8f) Fail($"관측소 도착 {(fc.transform.position - obs).magnitude:F1}m");
            map.Close();
            FrostState.ResetForTest();
            parts.Add("지도 순간이동(못 찾으면 단추 숨김·거절 · 경계비 → 서리 고개 · 관측소 → 문 앞 · 결투 중 거절 · 뒤에 지도 닫힘)");
        }

        // ---- 고원 들판 무리(109-14-27b) ----

        private static void CheckWild(FieldCombat fc, PlayerController pc, FrostField field, List<string> parts)
        {
            fc.ResetForTest();
            field.TickKing(fc.SafePoint);
            if (FieldSpawner.FrostWild.Any(e => e != null && e.gameObject.activeSelf)) Fail("고원 밖인데 들판 무리가 서 있다");
            pc.Teleport(GoFrost.Center + new Vector3(0f, 0.4f, 200f));
            field.TickKing(pc.transform.position);
            var wild = FieldSpawner.FrostWild;
            int want = GoFrost.Wild.Sum(g => g.Foes.Length);
            if (wild.Count != want || wild.Any(e => e == null || !e.gameObject.activeSelf || !e.Alive || !GoFrost.Contains(e.transform.position))) { Fail($"고원 들판 무리 {wild.Count}/{want}"); return; }
            foreach (var g in GoFrost.Wild)
            {
                var mine = wild.Where(e => e.GroupId == g.Id).ToArray();
                if (mine.Length != g.Foes.Length) Fail($"{g.Id} 무리 {mine.Length}");
                for (int i = 0; i < mine.Length && i < g.Foes.Length; i++)
                    if (mine[i].EnemyKind != g.Foes[i].Kind || mine[i].Element != g.Foes[i].El) Fail($"{g.Id}[{i}] 종류·원소 {mine[i].EnemyKind}·{mine[i].Element}");
            }
            foreach (var e in wild)
                foreach (var s in GoFrost.Sites)
                    if (new Vector3(e.Home.x - s.Pos.x, 0f, e.Home.z - s.Pos.z).magnitude < (s.Big ? 40f : 20f)) Fail($"들판 무리가 {s.Id} 를 막음");
            var first = wild[0];
            first.TakeRaw(first.Hp * 0.5f, Color.white);
            field.TickKing(fc.SafePoint);
            if (wild.Any(e => e.gameObject.activeSelf) || FieldEnemy.All.Any(e => wild.Contains(e))) Fail("고원을 나섰는데 들판 무리가 남음");
            pc.Teleport(GoFrost.Center + new Vector3(0f, 0.4f, 200f));
            field.TickKing(pc.transform.position);
            if (!first.gameObject.activeSelf || !first.Alive || first.Hp < first.MaxHp) Fail("다시 들어섰는데 들판 무리가 처음부터가 아님");
            field.TickKing(fc.SafePoint);
            parts.Add($"들판 무리({GoFrost.Wild.Length}무리 {want}마리·원소·명소 밖·나서면 꺼졌다 처음부터)");
        }

        // ---- 만년설 바위곰왕(109-14-31) ----

        private static void KillKing(FieldEnemy k)
        {
            for (int i = 0; i < 6 && k.Alive; i++)
            {
                if (k.Shielded) k.SetShieldForTest(0f);
                k.TakeRaw(k.Hp + 99999f, Color.white);
            }
        }

        private static void CheckKing(FieldCombat fc, PlayerController pc, FrostField field, string savePath, List<string> parts)
        {
            var bloom = GuardianBloom.Instance;
            if (bloom == null) { Fail("GuardianBloom 없음"); return; }
            bool d0 = FrostBossState.Defeated, b0 = FrostBossState.Bloom;
            long p0 = FrostBossState.PaidAt;
            var dom0 = DomainState.Snapshot();
            int gold0 = GoldState.Gold, lv0 = PlayerStats.Level, exp0 = PlayerStats.Exp;
            var arts0 = ArtifactState.Snapshot();
            int seq0 = ArtifactState.Seq, pol0 = ArtifactState.Polish;
            try
            {
                FrostBossState.NowForTest = 7_000_000;
                DomainState.NowForTest = 1_000_000_000;
                FrostBossState.Restore(false);
                fc.ResetForTest();
                // 고원 밖 — 곰왕은 안 서 있다
                field.TickKing(fc.SafePoint);
                if (FieldEnemy.FrostKingInstance != null && FieldEnemy.FrostKingInstance.gameObject.activeSelf) Fail("고원 밖인데 곰왕이 서 있다");
                // 고원 안 — 선다
                pc.Teleport(GoFrost.Center + new Vector3(0f, 0.4f, 150f));
                field.TickKing(pc.transform.position);
                var k = FieldEnemy.FrostKingInstance;
                if (k == null || !k.gameObject.activeSelf || !k.Alive || !k.FrostKing || !k.IsGuardian || k == FieldEnemy.GuardianInstance) { Fail("고원에 들어섰는데 곰왕이 안 섬"); return; }
                if (GoStory.Flat(k.transform.position, GoFrost.KingHome) > 3f || !GoFrost.Contains(k.transform.position)) Fail($"곰왕 자리 {k.transform.position}");
                if (k.Element != GoElement.Cryo || k.ShieldLayers != 2 || !k.Shielded) Fail($"곰왕 겉 방패 빙·두 겹 {k.Element}·{k.ShieldLayers}");
                if (Mathf.Abs(k.MaxHp / k.ShieldMax - FieldEnemy.FrostKingHp / FieldEnemy.FrostKingShield) > 0.05f) Fail($"곰왕 체력·방패 {k.MaxHp}·{k.ShieldMax}");
                if (k.DisplayName != GoLocalization.T("field.foe.frostking", "만년설 바위곰왕") || k.CurrentMove != FieldEnemy.BossMove.Slam) Fail($"곰왕 이름·첫 수 {k.DisplayName}·{k.CurrentMove}");
                if (!k.CanStep(GoFrost.KingHome + new Vector3(12f, 0f, 0f)) || k.CanStep(GoFrost.Center + new Vector3(500f, 0f, 0f))) Fail("곰왕이 고원 안에서 못 걷거나 밖으로 나감");
                // 첫 토벌 — 금·경험·꽃
                GoldState.Restore(0);
                PlayerStats.Restore(1, 0);
                int goldFirst = k.GuardianGoldNow;
                KillKing(k);
                if (k.Alive || !FrostBossState.Defeated || !FrostBossState.Bloom || FrostBossState.Standing) Fail("곰왕 첫 토벌 기록·꽃");
                if (GoldState.Gold != goldFirst || (PlayerStats.Exp == 0 && PlayerStats.Level == 1)) Fail($"곰왕 첫 토벌 금 {GoldState.Gold} ≠ {goldFirst}·경험");
                bloom.Refresh();
                if (!bloom.FrostFlowerShown) Fail("곰왕 꽃이 안 핌");
                if (bloom.FlowerShown != GuardianState.Bloom) Fail("고원 꽃이 망루 꽃을 건드림");
                // 꽃이 핀 동안 다시 안 선다
                field.TickKing(pc.transform.position);
                if (k.Alive) Fail("꽃이 핀 동안 곰왕이 섬");
                // 카드
                pc.Teleport(GuardianBloom.FrostSpot + new Vector3(2f, 0.3f, 0f));
                DomainState.SetResinForTest(10);
                bloom.Refresh();
                if (!bloom.FrostCardShown || !bloom.FrostCardText.Contains("★4") || bloom.FrostClaimButton.interactable) Fail($"곰왕 꽃 카드(원기 10) '{bloom.FrostCardText}'");
                if (bloom.ClaimFrost(out _) != null || !FrostBossState.Bloom) Fail("원기 10 으로 곰왕 꽃을 받음");
                DomainState.SetResinForTest(120);
                bloom.Refresh();
                int arts = ArtifactState.Count, gold = GoldState.Gold;
                bloom.FrostClaimButton.onClick.Invoke();
                var last = ArtifactState.All.Count > 0 ? ArtifactState.All[ArtifactState.All.Count - 1] : null;
                if (FrostBossState.Bloom || FrostBossState.PaidAt != FrostBossState.Now || DomainState.Resin != 90) Fail($"곰왕 꽃 받기 기록·원기 {DomainState.Resin}");
                if (GoldState.Gold != gold + GuardianBloom.GoldPerTier * GoWorldMap.MaxDanger || ArtifactState.Count != arts + 1 || last == null || last.rarity != 4) Fail($"곰왕 꽃 보상 금 {GoldState.Gold - gold}·보패 {ArtifactState.Count - arts}");
                bloom.Refresh();
                if (bloom.FrostFlowerShown || bloom.FrostCardShown) Fail("받았는데 곰왕 꽃·카드가 남음");
                // 150초 뒤 다시 선다(고원 안에서)
                pc.Teleport(GoFrost.Center + new Vector3(0f, 0.4f, 150f));
                FrostBossState.NowForTest += FrostBossState.BackSec - 1;
                field.TickKing(pc.transform.position);
                if (k.Alive) Fail("149초에 곰왕이 섬");
                FrostBossState.NowForTest += 1;
                field.TickKing(pc.transform.position);
                if (!k.Alive || !k.gameObject.activeSelf) Fail("150초에 곰왕이 안 섬");
                // 다시 잡으면 금·경험 없이 꽃만
                gold = GoldState.Gold;
                int lv = PlayerStats.Level, exp = PlayerStats.Exp;
                KillKing(k);
                if (GoldState.Gold != gold || PlayerStats.Level != lv || PlayerStats.Exp != exp || !FrostBossState.Bloom) Fail("곰왕을 다시 잡았는데 금·경험이 나옴(꽃만이어야)");
                // 서 있는 곰왕은 고원을 나서면 꺼 둔다
                FrostBossState.Restore(false);
                field.TickKing(pc.transform.position);
                if (!k.Alive || !k.gameObject.activeSelf) Fail("안 쓰러뜨린 곰왕이 안 섬");
                field.TickKing(fc.SafePoint);
                if (k.gameObject.activeSelf) Fail("고원을 나섰는데 곰왕이 서 있다");
                field.TickKing(pc.transform.position);
                if (!k.gameObject.activeSelf || !k.Alive || k.Hp < k.MaxHp) Fail("다시 들어섰는데 곰왕이 처음부터가 아님");
                field.TickKing(fc.SafePoint);
                // 세이브 왕복 — 옛 세이브는 안 쓰러뜨린 채
                FrostBossState.Restore(true, true, 0);
                if (!SaveState.Save()) { Fail("SaveState.Save 실패(곰왕)"); return; }
                string json = System.IO.File.ReadAllText(savePath);
                if (!json.Contains("\"frostBossBloom\":true") || !json.Contains("\"version\":29")) Fail("세이브에 곰왕 꽃이 없다(버전은 28 그대로)");
                FrostBossState.Restore(true, false, 123);
                if (!SaveState.TryLoad() || !FrostBossState.Bloom || FrostBossState.PaidAt != 0) Fail("곰왕 세이브 왕복 뒤 꽃이 달라짐");
                string old = Regex.Replace(json, ",\"frostBossDown\":(true|false),\"frostBossBloom\":(true|false),\"frostBossPaidAt\":\\d+", "");
                if (old.Contains("frostBoss")) { Fail("곰왕 없는 옛 세이브 가짜 파일 만들기 실패"); return; }
                System.IO.File.WriteAllText(savePath, old);
                FrostBossState.Restore(true, true, 0);
                if (!SaveState.TryLoad() || FrostBossState.Defeated || !FrostBossState.Standing) Fail("곰왕 없는 옛 세이브를 읽었는데 쓰러진 채");
                parts.Add("곰왕(고원 밖 꺼짐·안 서고 빙 두 겹·첫 토벌 금·경험·꽃·원기 30 받기·150초 뒤 다시·다시 잡으면 꽃만·나서면 꺼졌다 처음부터·세이브 왕복·옛 세이브)");
            }
            finally
            {
                var k2 = FieldEnemy.FrostKingInstance;
                FrostBossState.NowForTest = -1;
                DomainState.NowForTest = -1;
                FrostBossState.Restore(d0, b0, p0);
                DomainState.Restore(dom0.resin, dom0.t, dom0.claims, dom0.week, dom0.weekN);
                GoldState.Restore(gold0);
                PlayerStats.Restore(lv0, exp0);
                ArtifactState.Restore(arts0, seq0, pol0);
                if (k2 != null && k2.gameObject.activeSelf) k2.gameObject.SetActive(false);
                bloom.Refresh();
                fc.ResetForTest();
                pc.Teleport(fc.SafePoint);
            }
        }

        // ---- 세이브 ----

        private static void CheckSave(string savePath, List<string> parts)
        {
            FrostState.Restore(new[] { "fort", "hut", "bogus" });
            if (FrostState.Count != 2) Fail("없는 id 가 복원됨");
            if (!SaveState.Save()) { Fail("SaveState.Save 실패"); return; }
            string json = System.IO.File.ReadAllText(savePath);
            if (!json.Contains("\"frostFound\":[") || !json.Contains("fort") || !json.Contains("\"version\":29")) Fail("세이브에 고원이 없다(버전은 28 그대로)");
            FrostState.ResetForTest();
            if (!SaveState.TryLoad() || !FrostState.Found("fort") || !FrostState.Found("hut") || FrostState.Count != 2) Fail("왕복 뒤 발견이 달라짐");
            string old = Regex.Replace(json, ",\"frostFound\":\\[[^\\]]*\\]", "");
            if (old.Contains("frostFound")) { Fail("옛 세이브 가짜 파일 만들기 실패"); return; }
            System.IO.File.WriteAllText(savePath, old);
            if (!SaveState.TryLoad()) { Fail("고원 없는 옛 파일 TryLoad 실패"); return; }
            if (FrostState.Count != 0) Fail("고원 없는 옛 세이브를 읽었는데 찾은 게 남음");
            parts.Add("세이브(발견 왕복 · 옛 세이브는 못 찾은 채 · 버전 그대로)");
        }

        private static void Fail(string msg)
        {
            _ok = false;
            Debug.LogError($"[{_tag}] frost FAIL - {msg}");
        }
    }
}
