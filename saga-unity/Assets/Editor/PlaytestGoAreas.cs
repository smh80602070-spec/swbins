using System.Collections.Generic;
using System.Linq;
using System.Text.RegularExpressions;
using UnityEngine;
using Saga.Go.Combat;
using Saga.Go.Data;
using Saga.Go.Player;
using Saga.Go.World;

namespace Saga.EditorTools
{
    /// <summary>
    /// PLAN.md 109-14-37·41 "지도 밖 독립 땅 — 은하 나루·틈새 갈림길"(웹 사가고 ⑲-37·41 진단 항목) — `PlaytestHeadless` 가 서리봉 고원 진단 뒤에 부른다. `GoAreas.All` 의 땅마다:
    /// 표(명소 다섯·발견 열·안 겹침·세 시대·지도/고원/다른 땅 밖) · 지역(땅 안이면 그 지역 · 지도 안 칸은 그대로 · 이름·한자·사연·바이옴·위험도) ·
    /// 땅(바닥·벽 넷·도형) · 돌기둥(열릴 장 전엔 닫힘·뒤엔 열림 · 곁에서만 · 오감) · 발견(명소 16m·발견 7m·보상 한 번) · 세이브 왕복(옛 세이브는 못 찾은 채).
    /// 끝나면 발견·돈·연마석·경험치·이야기 진행·자리·세이브 파일을 되돌린다.
    /// </summary>
    public static class PlaytestGoAreas
    {
        private static string _tag;
        private static bool _ok;

        public static bool Run(string tag)
        {
            _tag = tag;
            _ok = true;
            var fc = FieldCombat.Instance;
            var pc = fc != null ? fc.GetComponent<PlayerController>() : null;
            var field = AreaField.Instance;
            if (fc == null || pc == null || field == null) { Fail("FieldCombat/PlayerController/AreaField 없음"); return false; }

            var found = AreaState.Snapshot();
            int gold = GoldState.Gold, polish = ArtifactState.Polish;
            var arts = ArtifactState.Snapshot();
            int aseq = ArtifactState.Seq;
            int lv = PlayerStats.Level, exp = PlayerStats.Exp;
            int ch0 = StoryState.Ch, st0 = StoryState.StepIndex;
            bool off0 = StoryState.OffForTest;
            string savePath = System.IO.Path.Combine(Application.persistentDataPath, "save.json");
            string originalSave = System.IO.File.Exists(savePath) ? System.IO.File.ReadAllText(savePath) : null;
            var parts = new List<string>();
            try
            {
                StoryState.OffForTest = false;
                foreach (var a in GoAreas.All)
                {
                    var p = new List<string>();
                    CheckTables(a, p);
                    CheckRegion(a, p);
                    CheckGround(a, field, p);
                    CheckTravel(a, fc, pc, field, p);
                    CheckDiscover(a, field, p);
                    parts.Add($"[{a.Id}] {string.Join(" · ", p)}");
                }
                CheckSave(savePath, parts);
            }
            finally
            {
                if (originalSave != null) System.IO.File.WriteAllText(savePath, originalSave);
                else if (System.IO.File.Exists(savePath)) System.IO.File.Delete(savePath);
                AreaState.Restore(found);
                GoldState.Restore(gold);
                ArtifactState.Restore(arts, aseq, polish);
                PlayerStats.Restore(lv, exp);
                StoryState.Restore(ch0, st0);
                StoryState.OffForTest = off0;
                field.Refresh();
                field.Tick(fc.SafePoint);
                fc.ResetForTest();
                pc.Teleport(fc.SafePoint);
                foreach (var e in FieldEnemy.All) e.RestoreHomeForTest();
            }
            if (_ok) Debug.Log($"[{_tag}] areas OK - {string.Join(" · ", parts)}");
            return _ok;
        }

        private static void CheckTables(GoAreas.Area a, List<string> parts)
        {
            var all = a.Sites;
            if (all.Length != 15 || all.Count(s => s.Big) != 5 || all.Count(s => !s.Big) != 10 || all.Select(s => s.Id).Distinct().Count() != 15) Fail($"{a.Id} 명소 다섯·발견 열이 아님");
            foreach (var s in all)
            {
                float r = s.Radius;
                if (!a.Contains(s.Pos) || Mathf.Abs(s.Off.x) + r + 2f > GoAreas.HalfX || Mathf.Abs(s.Off.y) + r + 2f > GoAreas.HalfZ) Fail($"{a.Id}:{s.Id} 가 땅 가장자리에 걸침");
                if (s.Name.StartsWith("area.")) Fail($"{a.Id}:{s.Id} 이름 글이 없음");
                if (GoEras.EraName(s.Era).Length == 0) Fail($"{s.Id} 시대");
                foreach (var o in all)
                    if (o.Id != s.Id && string.CompareOrdinal(o.Id, s.Id) > 0 && (o.Pos - s.Pos).magnitude < r + o.Radius - 8f) Fail($"{a.Id}:{s.Id}·{o.Id} 발견 원이 많이 겹침 {(o.Pos - s.Pos).magnitude:0.0}m");
            }
            if (all.Select(s => s.Era).Distinct().Count() != 3) Fail($"{a.Id} 과거·현대·미래가 한 땅에 안 섞임");
            // 지도 밖·서리봉 고원·다른 땅과 안 겹침
            if (a.Contains(Vector3.zero) || a.Contains(TestMapData.WorldPos(3, 3)) || GoFrost.Contains(a.Center)) Fail($"{a.Id} 가 지도·고원과 겹침");
            foreach (var o in GoAreas.All)
                if (o != a && Mathf.Abs(a.Center.x - o.Center.x) < GoAreas.HalfX * 2f + 20f && Mathf.Abs(a.Center.z - o.Center.z) < GoAreas.HalfZ * 2f + 20f) Fail($"{a.Id}·{o.Id} 땅이 겹침");
            if (a.MapGate() == Vector3.zero || a.ArrivalPos.x < a.Center.x - GoAreas.HalfX) Fail($"{a.Id} 돌기둥 자리");
            parts.Add("표(명소 다섯·발견 열·안 겹침·세 시대·다른 땅 밖)");
        }

        private static void CheckRegion(GoAreas.Area a, List<string> parts)
        {
            if (GoWorldMap.RegionAt(a.Center) != a.Id || GoWorldMap.RegionAt(a.Sites[2].Pos) != a.Id) Fail($"{a.Id} 땅 안이 그 지역이 아님");
            if (GoWorldMap.RegionAt(TestMapData.WorldPos(3, 3)) != "village" || GoWorldMap.RegionAt(GoFrost.Center) != "frost") Fail("다른 지역이 바뀜");
            if (GoWorldMap.Regions.Any(r => r.Id == a.Id)) Fail($"{a.Id} 가 글자 지도 지역 표에 들어감");
            if (GoWorldMap.RegionName(a.Id).StartsWith("region.") || GoWorldMap.RegionOf(a.Id).Hanja != a.Hanja || GoWorldMap.RegionLore(a.Id).StartsWith("region.")) Fail($"{a.Id} 이름·한자·사연");
            if (GoWorldMap.AtmosphereOf(a.Id).RegionId != a.Id || GoWorldMap.DangerOf(a.Id) != a.Danger) Fail($"{a.Id} 바이옴·위험도");
            parts.Add("지역(땅 안 = 그 지역·다른 지역 그대로·표 밖·이름·한자·사연·바이옴)");
        }

        private static void CheckGround(GoAreas.Area a, AreaField field, List<string> parts)
        {
            Physics.SyncTransforms();
            Vector3 c = a.Center;
            if (!Physics.Raycast(c + Vector3.up * 5f, Vector3.down, out var hit, 20f) || Mathf.Abs(hit.point.y) > 0.05f) Fail($"{a.Id} 땅 바닥이 없다");
            foreach (var d in new[] { Vector3.right, Vector3.left, Vector3.forward, Vector3.back })
            {
                Vector3 from = c + d * ((d.x != 0f ? GoAreas.HalfX : GoAreas.HalfZ) - 5f) + Vector3.up * 2f;
                if (!Physics.Raycast(from, d, 20f)) Fail($"{a.Id} 땅 바깥 벽 {d}");
            }
            foreach (var s in a.Sites) if (field.SiteObject(a.Id, s.Id) == null) Fail($"{a.Id}:{s.Id} 도형이 없다");
            parts.Add("땅(바닥·벽 넷·도형 열다섯)");
        }

        private static void CheckTravel(GoAreas.Area a, FieldCombat fc, PlayerController pc, AreaField field, List<string> parts)
        {
            fc.ResetForTest();
            StoryState.Restore(a.OpenCh - 1, 0);
            field.Refresh();
            if (a.Open() || field.GateObject(a.Id).activeSelf) Fail($"{a.Id} 열릴 장 전인데 틈 문이 열림");
            pc.Teleport(a.MapGate() + new Vector3(3f, 0.3f, 0f));
            if (field.NearGate(fc.transform.position).dir != 0 || field.TravelHere()) Fail($"{a.Id} 닫힌 문에서 이동함");
            StoryState.Restore(a.OpenCh, 0);
            field.Refresh();
            if (!a.Open() || !field.GateObject(a.Id).activeSelf) Fail($"{a.Id} 열릴 장 뒤인데 틈 문이 안 열림");
            pc.Teleport(a.MapGate() + new Vector3(3f, 0.3f, 0f));
            var (na, dir) = field.NearGate(fc.transform.position);
            if (na != a || dir != 1) Fail($"{a.Id} 돌기둥 곁 판정");
            field.Tick(fc.transform.position);
            if (field.TravelButton == null || !field.TravelButton.gameObject.activeSelf || !field.TravelLabel.Contains(GoWorldMap.RegionName(a.Id))) Fail($"{a.Id} 이동 단추 '{field.TravelLabel}'");
            if (!field.TravelHere()) Fail($"{a.Id} 돌기둥 곁에서 못 듦");
            if (!a.Contains(fc.transform.position) || (fc.transform.position - a.ArrivalPos).magnitude > 2f) Fail($"{a.Id} 땅 도착 자리 {fc.transform.position}");
            if (field.NearGate(fc.transform.position).dir != 0) Fail($"{a.Id} 도착하자마자 돌기둥 곁으로 잡힘");
            pc.Teleport(a.SteleGround + new Vector3(2f, 0.3f, 3f));
            if (field.NearGate(fc.transform.position).dir != -1) Fail($"{a.Id} 땅 쪽 돌기둥 곁 판정");
            field.Tick(fc.transform.position);
            if (field.TravelLabel != GoLocalization.T("area.go_out", "마을 쪽으로 돌아간다")) Fail("돌아가기 단추 글");
            if (!field.TravelHere() || a.Contains(fc.transform.position) || (fc.transform.position - a.ReturnPos).magnitude > 2f) Fail($"{a.Id} 땅에서 못 돌아옴");
            if (field.TravelHere()) Fail("돌기둥 곁이 아닌데 이동함");
            parts.Add("드나드는 길(열릴 장 전 닫힘·뒤 열림·곁 판정·단추·듦·도착 자리는 곁이 아님·돌아옴)");
        }

        private static void CheckDiscover(GoAreas.Area a, AreaField field, List<string> parts)
        {
            AreaState.ResetForTest();
            var big = a.Sites.First(s => s.Big);
            var small = a.Sites.First(s => !s.Big);
            GoldState.Restore(0);
            ArtifactState.Restore(ArtifactState.Snapshot(), ArtifactState.Seq, 0);
            if (field.Check(Vector3.zero) != 0) Fail("땅 밖에서 찾음");
            Vector3 far = big.Pos + new Vector3(big.Radius + 3f, 0f, 0f);
            if (field.Check(far) != 0 || AreaState.Found(big.Key)) Fail("명소 원 밖에서 찾음");
            int n = field.Check(big.Pos + new Vector3(big.Radius - 1f, 0f, 0f));
            if (n != 1 || !AreaState.Found(big.Key) || GoldState.Gold != GoAreas.BigGold || ArtifactState.Polish != GoAreas.BigPolish) Fail($"{a.Id} 명소 찾기 {n}·금 {GoldState.Gold}·연마석 {ArtifactState.Polish}");
            if (field.Check(big.Pos) != 0 || GoldState.Gold != GoAreas.BigGold) Fail("보상이 두 번");
            if (field.Check(small.Pos + new Vector3(small.Radius + 3f, 0f, 0f)) != 0) Fail("발견 원 밖에서 찾음");
            if (field.Check(small.Pos + new Vector3(small.Radius - 1f, 0f, 0f)) != 1 || GoldState.Gold != GoAreas.BigGold + GoAreas.SmallGold) Fail("발견 찾기·금");
            if (AreaState.CountIn(a.Id) != 2 || AreaState.Discover(a.Id + ":bogus")) Fail("찾은 수·없는 열쇠");
            parts.Add("발견(밖 못 찾음·명소 16m·발견 7m·보상 한 번·없는 열쇠)");
        }

        private static void CheckSave(string savePath, List<string> parts)
        {
            AreaState.Restore(new[] { "skyport:port", "skyport:jar", "crossing:clock", "crossing:bogus", "nope:x" });
            if (AreaState.Count != 3) Fail("없는 열쇠가 복원됨");
            if (!SaveState.Save()) { Fail("SaveState.Save 실패"); return; }
            string json = System.IO.File.ReadAllText(savePath);
            if (!json.Contains("\"areaFound\":[") || !json.Contains("skyport:port") || !json.Contains("crossing:clock") || !json.Contains("\"version\":28")) Fail("세이브에 땅이 없다(버전은 28 그대로)");
            AreaState.ResetForTest();
            if (!SaveState.TryLoad() || !AreaState.Found("skyport:port") || !AreaState.Found("skyport:jar") || !AreaState.Found("crossing:clock") || AreaState.Count != 3) Fail("왕복 뒤 발견이 달라짐");
            string old = Regex.Replace(json, ",\"areaFound\":\\[[^\\]]*\\]", "");
            if (old.Contains("areaFound")) { Fail("옛 세이브 가짜 파일 만들기 실패"); return; }
            System.IO.File.WriteAllText(savePath, old);
            if (!SaveState.TryLoad()) { Fail("땅 없는 옛 파일 TryLoad 실패"); return; }
            if (AreaState.Count != 0) Fail("땅 없는 옛 세이브를 읽었는데 찾은 게 남음");
            parts.Add("세이브(발견 왕복 · 옛 세이브는 못 찾은 채 · 버전 그대로)");
        }

        private static void Fail(string msg)
        {
            _ok = false;
            Debug.LogError($"[{_tag}] areas FAIL - {msg}");
        }
    }
}
