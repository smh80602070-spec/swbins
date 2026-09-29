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
                CheckRoute(pc, field, parts);
                CheckAmber(fc, pc, field, parts);
                CheckVault(fc, pc, field, parts);
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
            int nBig = a.Id == "amber" || a.Id == "vault" ? 7 : 5; // 굳은 거리·갈무리 벌은 명소 일곱(웹 ⑲-57·61 — 신상 등이 더)
            if (all.Length != nBig + 10 || all.Count(s => s.Big) != nBig || all.Count(s => !s.Big) != 10 || all.Select(s => s.Id).Distinct().Count() != nBig + 10) Fail($"{a.Id} 명소 {nBig}·발견 열이 아님");
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
            parts.Add("표(명소 다섯(굳은 거리 일곱)·발견 열·안 겹침·세 시대·다른 땅 밖)");
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
            parts.Add("땅(바닥·벽 넷·명소·발견 도형)");
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

        // ---- 109-14-48 구름 위 항로 — 잠긴 도읍 등대 서쪽 하늘 섬 셋·바람 기둥 셋·섬 발견 ----
        private static void CheckRoute(PlayerController pc, AreaField field, List<string> parts)
        {
            var a = GoAreas.Sunken;
            if (a.SkySites == null || a.SkySites.Length != 3) { Fail("하늘 섬 발견 셋이 아님"); return; }
            for (int i = 0; i < 3; i++)
            {
                var s = a.SkySites[i];
                if (!GoAreas.TrySite(s.Key, out var t) || t != s || s.Up != GoAreas.RouteUp[i] || s.Name.StartsWith("area.")) Fail($"하늘 섬 {s.Id} 표·이름");
                Vector2 o = GoAreas.RouteOff(i);
                if (Mathf.Abs(o.x) + GoAreas.RouteR[i] + 2f > GoAreas.HalfX || Mathf.Abs(o.y) + GoAreas.RouteR[i] + 2f > GoAreas.HalfZ) Fail($"하늘 섬 {s.Id} 가 땅 가장자리에 걸침");
                if (i > 0)
                {
                    float gap = (GoAreas.RouteOff(i - 1).x - GoAreas.RouteR[i - 1]) - (o.x + GoAreas.RouteR[i]);
                    if (Mathf.Abs(gap - GoAreas.RouteGap) > 0.01f) Fail($"하늘 섬 {i - 1}·{i} 틈 {gap:0.00}");
                    // 기둥 끝에서 활공해 다음 섬 가장자리 1.5m 안까지: 12m 위에서 초속 3 로 내려오며 초속 10 → 40m 까지
                    float need = GoAreas.RouteDraftR + GoAreas.RouteGap + 1.5f;
                    if (need > 30f) Fail($"기둥에서 다음 섬까지 {need:0.0}m — 활공으로 못 닿음");
                }
            }
            if (a.Ceil < GoAreas.RouteUp[2] + 20f) Fail("잠긴 도읍 보이지 않는 벽이 가장 높은 섬보다 낮음");
            foreach (var o in GoAreas.All) if (o != a && o.SkySites != null) Fail("다른 땅에 하늘 섬");

            // 등롱 앞 — 섬도 기둥도 안 선다
            StoryState.Restore(22, 0);
            field.Refresh();
            if (field.RouteShown || PlayerController.InDraft(GoStory.RoutePillarPos(0) + Vector3.up * 5f)) Fail("등대에 불이 들어오기 전인데 하늘 섬·기둥이 섬");
            Vector3 top0 = GoStory.RouteCenter(0);
            if (field.Check(top0 + new Vector3(0f, 0.3f, 0f)) != 0) Fail("등대에 불이 들어오기 전인데 하늘 섬을 찾음");
            // 등롱 뒤(23장 4째 단계)
            StoryState.Restore(22, 3);
            field.Refresh();
            if (!field.RouteShown) Fail("등롱 불을 넣었는데 하늘 섬이 안 섬");
            Physics.SyncTransforms();
            for (int i = 0; i < 3; i++)
            {
                Vector3 c = GoStory.RouteCenter(i);
                if (!Physics.Raycast(c + new Vector3(-3f, 3f, 6f), Vector3.down, out var hit, 8f) || Mathf.Abs(hit.point.y - c.y) > 0.05f) Fail($"하늘 섬 {i} 윗면 충돌 {(hit.collider != null ? hit.point.y - c.y : -99f):0.00}");
                if (!GoStory.OnRouteTop(i, c + Vector3.up * 0.3f) || !GoStory.OnSkyTop(c + Vector3.up * 0.3f) || !GoStory.OnSkyLayer(c + Vector3.up * 0.3f) || GoStory.OnSkyTop(GoAreas.Sunken.Center)) Fail($"하늘 섬 {i} 층 판정");
                if (i > 0 && GoStory.OnRouteTop(i - 1, c + Vector3.up * 0.3f)) Fail("두 섬이 한 층으로 셈");
            }
            // 기둥 — 24장을 마치면 앞 둘, 25장을 마치면 셋째
            bool Draft(int i) { var b = GoStory.RoutePillarPos(i); return PlayerController.InDraft(b + Vector3.up * 5f); }
            if (Draft(0) || Draft(1) || Draft(2)) Fail("24장 앞인데 바람 기둥이 섬");
            StoryState.Restore(23, 0);
            field.Refresh();
            if (Draft(0) || Draft(1) || Draft(2)) Fail("23장 끝인데 바람 기둥이 섬(24장 뒤에 열려야)");
            GoStory.RouteDraftsForTest = true; // 24·25장이 이식되기 전 — 열린 기둥을 잰다
            try
            {
                field.Refresh();
                if (!Draft(0) || !Draft(1) || !Draft(2)) Fail("열린 기둥 셋이 안 섬");
                for (int i = 0; i < 3; i++)
                {
                    Vector3 b = GoStory.RoutePillarPos(i);
                    if (Mathf.Abs(PlayerController.DraftTopAt(b + Vector3.up * 5f) - (GoStory.RouteCenter(i).y + GoStory.DraftOver)) > 0.01f) Fail($"바람 기둥 {i} 솟는 높이");
                    if (PlayerController.InDraft(b + new Vector3(GoStory.DraftR + 2f, 5f, 0f))) Fail($"바람 기둥 {i} 반지름");
                    if (!(i == 0 ? !GoStory.OnRouteLayer(b + Vector3.up * 0.3f) : GoStory.OnRouteTop(i - 1, b + Vector3.up * 0.3f))) Fail($"바람 기둥 {i} 밑자리 층");
                }
            }
            finally { GoStory.RouteDraftsForTest = false; field.Refresh(); }
            // 발견 — 섬 윗면에 서야(땅에서 섬 밑을 지나가는 것으론 안 됨)
            AreaState.ResetForTest();
            Vector3 c1 = GoStory.RouteCenter(0);
            if (field.Check(new Vector3(c1.x, 0.4f, c1.z)) != 0) Fail("섬 밑 땅에서 하늘 섬을 찾음");
            int g0 = GoldState.Gold;
            if (field.Check(c1 + new Vector3(0f, 0.3f, 0f)) != 1 || !AreaState.Found("sunken:isle_shrine") || GoldState.Gold != g0 + GoAreas.BigGold) Fail("하늘 사당 섬 윗면에서 발견·보상");
            if (field.Check(c1 + new Vector3(0f, 0.3f, 0f)) != 0) Fail("하늘 섬을 두 번 찾음");
            if (field.Check(GoStory.RouteCenter(2) + new Vector3(0f, 0.3f, 0f)) != 1 || !AreaState.Found("sunken:isle_orbit")) Fail("궤도 정거장 조각 발견");
            var snap = AreaState.Snapshot();
            AreaState.Restore(snap);
            if (!AreaState.Found("sunken:isle_shrine") || !AreaState.Found("sunken:isle_orbit") || AreaState.Found("sunken:isle_wreck")) Fail("하늘 섬 발견이 저장·복원에서 빠짐");
            StoryState.Restore(22, 0);
            field.Refresh();
            if (field.RouteShown || Draft(0)) Fail("등롱 앞으로 되돌렸는데 하늘 섬·기둥이 남음");
            parts.Add("[sunken 구름 위 항로] 하늘 섬 셋 표(등대 서쪽 사슬·틈 8m·기둥→섬 활공 안)·보이지 않는 벽 위·등롱 앞엔 안 섬/뒤엔 섬(윗면 충돌·층 판정)·바람 기둥 셋(23장 끝엔 닫힘·열림 손잡이로 솟는 높이·반지름·밑자리)·섬 윗면에서 발견(밑 땅에선 안 됨·중복 없음·저장 복원)");
        }

        // ---- 109-14-57 굳은 거리(여덟째 지역, 9부 무대) — 30~32장은 이식 전이라 이야기 상태는 순수 함수에 (장, 단계)를 직접 넣어 잰다 ----
        private static void CheckAmber(FieldCombat fc, PlayerController pc, AreaField field, List<string> parts)
        {
            var a = GoAreas.Amber;
            if (a.Id != "amber" || a.OpenCh != 29 || !GoAreas.TryArea("amber", out var t) || t != a || GoAreas.All.Length != 5 || GoAreas.All[3] != a) Fail("굳은 거리 표·열릴 장(29장)");
            if (a.GateSite != "pass" || !a.Sites.Any(s => s.Id == "pass" && s.Big && s.Era == GoEra.Future)) Fail("굳은 거리 고개 어귀 명소");
            foreach (var id in new[] { "cross", "clock", "market", "tower", "rail", "statue" }) if (!a.TrySite(id, out var s) || !s.Big) Fail($"굳은 거리 명소 {id}");
            // 돌기둥 — 은하 나루 북쪽 끝 · 다른 땅 돌기둥과 30m 이상
            if (!GoAreas.Skyport.Contains(a.MapGate()) || a.MapGate().z > GoAreas.Skyport.Center.z - GoAreas.HalfZ + 60f) Fail("굳은 거리 돌기둥이 은하 나루 북쪽 끝이 아님");
            foreach (var o in GoAreas.All)
                if (o != a && ((o.MapGate() - a.MapGate()).magnitude < 30f || (o.SteleGround - a.MapGate()).magnitude < 30f)) Fail($"굳은 거리 돌기둥이 {o.Id} 돌기둥과 가까움");
            foreach (var s in GoAreas.Skyport.Sites) if ((s.Pos - a.MapGate()).magnitude < s.Radius + 3f) Fail($"굳은 거리 돌기둥이 은하 나루 {s.Id} 발견 원 안");
            // 이야기 상태 표(장은 0부터 — 30장 = 29)
            if (GoStory.AmberPassOpenAt(28) || !GoStory.AmberPassOpenAt(29) || !GoStory.AmberPassOpenAt(35)) Fail("고개 결정 막: 29장을 마쳐야 풀림");
            for (int i = 0; i < 3; i++)
            {
                int from = 5 + i;
                if (GoStory.AmberCrystalOffAt(i, 28, 99) || GoStory.AmberCrystalOffAt(i, 29, from - 1) || !GoStory.AmberCrystalOffAt(i, 29, from) || !GoStory.AmberCrystalOffAt(i, 30, 0)) Fail($"굳은 자리 {i}: 30장 {from}째 단계부터 녹음");
            }
            if (GoStory.AmberCrystalOffAt(1, 29, 5) || GoStory.AmberCrystalOffAt(2, 29, 6)) Fail("굳은 자리가 차례대로 안 녹음");
            if (GoStory.AmberDomeBrokenAt(29, 9) || GoStory.AmberDomeBrokenAt(30, 1) || !GoStory.AmberDomeBrokenAt(30, 2) || !GoStory.AmberDomeBrokenAt(31, 0)) Fail("장터 돔: 31장 2째 단계부터 깨짐");
            if (GoStory.AmberTowerMeltedAt(30, 9) || GoStory.AmberTowerMeltedAt(31, 2) || !GoStory.AmberTowerMeltedAt(31, 3) || !GoStory.AmberTowerMeltedAt(32, 0)) Fail("태엽 심장: 32장 3째 단계부터 녹음");
            if (GoStory.AmberLightsGreenAt(30, 9) || GoStory.AmberLightsGreenAt(31, 4) || !GoStory.AmberLightsGreenAt(31, 5) || !GoStory.AmberLightsGreenAt(32, 0)) Fail("신호등: 32장 5째 단계(거북 뒤)부터 초록");
            if (!GoStory.AmberClockWindingAt(30, 5) || GoStory.AmberClockWindingAt(30, 4) || GoStory.AmberClockWindingAt(30, 6) || GoStory.AmberClockWindingAt(31, 5) || GoStory.AmberClockWindingAt(29, 5)) Fail("괘종시계 바늘: 31장 5째 단계만");
            // 도형 — 결정·돔·심장·신호등 빛·시계방·부양탑 충돌
            bool off0 = StoryState.OffForTest;
            try
            {
                StoryState.OffForTest = false;
                StoryState.Restore(15, 0);
                field.Refresh();
                for (int i = 0; i < 3; i++) if (!field.AmberPartOn("amber:crystal" + i)) Fail($"굳은 자리 {i} 결정이 안 보임");
                if (!field.AmberPartOn("amber:dome") || !field.AmberPartOn("amber:heart") || field.AmberLampsGreen || field.AmberWinding) Fail("돔·태엽 심장·신호등 처음 모습");
                StoryState.Restore(29, 0); // 29장을 마침(= 1차 결말) — 고개만 풀리고 9부 상태는 그대로
                field.Refresh();
                if (!a.Open() || !field.AmberPartOn("amber:crystal0") || !field.AmberPartOn("amber:dome") || !field.AmberPartOn("amber:heart") || field.AmberLampsGreen) Fail("29장 끝인데 9부 상태가 바뀜");
                Physics.SyncTransforms();
                a.TrySite("cross", out var cross);
                var c0 = cross.Pos + new Vector3(GoStory.AmberCrystalAt[0].x, 0f, GoStory.AmberCrystalAt[0].y);
                if (!Physics.Raycast(c0 + new Vector3(-6f, 1.5f, 0f), Vector3.right, out var hit, 12f) || Mathf.Abs(hit.point.x - (c0.x - 1.2f)) > 0.3f) Fail($"굳은 자리 결정 충돌 {hit.point.x - c0.x:0.00}");
                a.TrySite("market", out var market);
                if (!Physics.Raycast(market.Pos + new Vector3(-9f, 1.5f, 0f), Vector3.right, out hit, 12f) || Mathf.Abs(hit.point.x - (market.Pos.x - GoStory.AmberDomeR)) > 0.4f) Fail($"장터 돔 충돌 {hit.point.x - market.Pos.x:0.00}");
                a.TrySite("tower", out var tower);
                if (!Physics.Raycast(tower.Pos + new Vector3(0f, 20f, 0f), Vector3.down, out hit, 30f) || Mathf.Abs(hit.point.y - GoStory.AmberTowerHeight) > 0.05f) Fail($"부양탑 윗면 충돌 {hit.point.y:0.00}");
                if (!Physics.Raycast(tower.Pos + new Vector3(-8f, 6f, 0f), Vector3.right, out hit, 12f) || Mathf.Abs(hit.point.x - (tower.Pos.x - GoStory.AmberTowerHalf)) > 0.05f) Fail($"부양탑 옆면 충돌 {hit.point.x - tower.Pos.x:0.00}");
                a.TrySite("clock", out var clock);
                if (!Physics.Raycast(clock.Pos + new Vector3(-8f, 2f, 0f), Vector3.right, out hit, 12f) || Mathf.Abs(hit.point.x - (clock.Pos.x - 2.5f)) > 0.05f) Fail("시계방 벽 충돌");
                foreach (var id in new[] { "cross", "clock", "market", "tower", "rail", "statue", "pass" })
                {
                    a.TrySite(id, out var s);
                    if (!Physics.Raycast(s.Pos + new Vector3(0f, 30f, 0f), Vector3.down, 60f) || field.SiteObject("amber", id).transform.childCount == 0) Fail($"굳은 거리 {id} 도형·바닥");
                }
                // 30장(14-58) — 굳은 자리는 30장 5·6·7째 단계부터 차례로 녹고(결정 도형·충돌이 사라짐), 돔·심장·신호등은 그대로. 31·32장 상태는 뒤 조각이 잰다
                StoryState.Restore(29, 5);
                field.Refresh();
                Physics.SyncTransforms();
                if (field.AmberPartOn("amber:crystal0") || !field.AmberPartOn("amber:crystal1") || !field.AmberPartOn("amber:crystal2")) Fail("30장 5째 단계: 신호등 앞 결정만 녹아야");
                if (Physics.Raycast(c0 + new Vector3(-6f, 1.5f, 0f), Vector3.right, 12f)) Fail("녹은 굳은 자리에 충돌이 남음");
                StoryState.Restore(30, 1); // 31장 석등 단계 — 돔은 아직
                field.Refresh();
                if (!field.AmberPartOn("amber:dome") || field.AmberWinding) Fail("31장 1째 단계: 돔은 아직 굳은 채·바늘 안 돎");
                StoryState.Restore(30, 2); // 31장 2째 단계(석등을 켠 뒤) — 돔이 깨진다
                field.Refresh();
                if (field.AmberPartOn("amber:dome") || !field.AmberPartOn("amber:heart") || field.AmberLampsGreen || field.AmberWinding) Fail("31장 2째 단계: 돔만 깨져야(심장·신호등·바늘은 그대로)");
                StoryState.Restore(30, 5); // 되감는 괘종시계 지키기
                field.Refresh();
                if (!field.AmberWinding || field.AmberPartOn("amber:dome")) Fail("31장 5째 단계: 바늘이 돌고 돔은 깨진 채여야");
                StoryState.Restore(30, 6);
                field.Refresh();
                if (field.AmberWinding) Fail("31장 6째 단계: 바늘이 멈춰야");
                StoryState.Restore(31, 2); // 32장 2째 단계(탑 꼭대기) — 심장은 아직
                field.Refresh();
                if (!field.AmberPartOn("amber:heart") || field.AmberLampsGreen) Fail("32장 2째 단계: 심장은 아직 굳은 채·신호등 빨강");
                StoryState.Restore(31, 3); // 심장을 녹인 뒤 — 심장만 꺼진다
                field.Refresh();
                if (field.AmberPartOn("amber:heart") || field.AmberLampsGreen || field.AmberPartOn("amber:dome")) Fail("32장 3째 단계: 심장만 꺼지고 신호등은 아직 빨강이어야");
                StoryState.Restore(31, 5); // 거북을 쓰러뜨린 뒤 — 신호등 초록
                field.Refresh();
                if (!field.AmberLampsGreen || field.AmberPartOn("amber:heart") || field.AmberWinding) Fail("32장 5째 단계: 신호등이 초록이어야");
                StoryState.Restore(29, 7);
                field.Refresh();
                if (field.AmberPartOn("amber:crystal0") || field.AmberPartOn("amber:crystal1") || field.AmberPartOn("amber:crystal2") || !field.AmberPartOn("amber:dome") || !field.AmberPartOn("amber:heart") || field.AmberLampsGreen) Fail("30장 7째 단계: 굳은 자리 셋만 녹고 돔·심장·신호등은 그대로여야");
            }
            finally
            {
                StoryState.OffForTest = off0;
            }
            // 발견 — 고가 선로 명소(웹 명소 일곱째)·작은 발견
            AreaState.ResetForTest();
            GoldState.Restore(0);
            a.TrySite("rail", out var rail);
            if (field.Check(rail.Pos + new Vector3(rail.Radius - 1f, 0f, 0f)) != 1 || GoldState.Gold != GoAreas.BigGold) Fail("고가 선로 발견·보상");
            a.TrySite("lamp", out var lamp);
            if (field.Check(lamp.Pos + new Vector3(lamp.Radius - 1f, 0f, 0f)) != 1 || GoldState.Gold != GoAreas.BigGold + GoAreas.SmallGold) Fail("굳은 가로등 발견·보상");
            AreaState.ResetForTest();
            parts.Add("[amber 굳은 거리] 표(명소 일곱·돌기둥 은하 나루 북쪽 끝·29장 뒤 열림)·이야기 상태 표(고개·굳은 자리 5·6·7·돔·심장·신호등 초록·바늘)·도형(결정·돔·심장·신호등 처음 모습·충돌 다섯·명소 일곱 바닥)·발견");
        }

        // ---- 109-14-61 갈무리 벌(아홉째 지역, 10부 무대) — 33~35장·11부는 이식 전이라 이야기 상태는 순수 함수에 (장, 단계)를 직접 넣어 잰다 ----
        private static void CheckVault(FieldCombat fc, PlayerController pc, AreaField field, List<string> parts)
        {
            var a = GoAreas.Vault;
            if (a.Id != "vault" || a.OpenCh != 32 || !GoAreas.TryArea("vault", out var t) || t != a || GoAreas.All[4] != a) Fail("갈무리 벌 표·열릴 장(32장)");
            if (a.GateSite != "pass" || !a.Sites.Any(s => s.Id == "pass" && s.Big && s.Era == GoEra.Past) || !a.Sites.Any(s => s.Id == "vault" && s.Big && s.Era == GoEra.Future)) Fail("갈무리 벌 어귀·금고 명소");
            foreach (var id in new[] { "pylon0", "pylon1", "granary", "yard", "statue" }) if (!a.TrySite(id, out var s) || !s.Big) Fail($"갈무리 벌 명소 {id}");
            // 돌기둥 — 서리봉 고원 동쪽 끝, 고원 명소 발견 원 밖
            if (!GoFrost.Contains(a.MapGate()) || a.MapGate().x < GoFrost.Center.x + GoFrost.HalfX - 30f) Fail("갈무리 벌 돌기둥이 서리봉 고원 동쪽 끝이 아님");
            foreach (var s in GoFrost.Sites) if ((s.Pos - a.MapGate()).magnitude < GoFrost.RadiusOf(s) + 3f) Fail($"갈무리 벌 돌기둥이 서리봉 {s.Id} 발견 원 안");
            foreach (var o in GoAreas.All)
                if (o != a && ((o.MapGate() - a.MapGate()).magnitude < 30f || (o.SteleGround - a.MapGate()).magnitude < 30f)) Fail($"갈무리 벌 돌기둥이 {o.Id} 돌기둥과 가까움");
            // 이야기 상태 표(장은 0부터 — 33장 = 32)
            if (GoStory.VaultGateOpenAt(31) || !GoStory.VaultGateOpenAt(32) || !GoStory.VaultGateOpenAt(40)) Fail("울타리: 9부(32장)를 마쳐야 꺼짐");
            if (GoStory.VaultGranaryOpenAt(32, 99) || GoStory.VaultGranaryOpenAt(33, 1) || !GoStory.VaultGranaryOpenAt(33, 2) || !GoStory.VaultGranaryOpenAt(34, 0)) Fail("곳간 문: 34장 2째 단계부터");
            if (GoStory.VaultPylonOffAt(0, 33, 4) || GoStory.VaultPylonOffAt(1, 33, 5) || !GoStory.VaultPylonOffAt(0, 33, 5) || !GoStory.VaultPylonOffAt(1, 33, 6) || !GoStory.VaultPylonOffAt(0, 34, 0) || !GoStory.VaultPylonOffAt(1, 34, 0)) Fail("동력 기둥: 34장 5·6째 단계부터 차례로");
            if (GoStory.VaultDoorOpenAt(33, 5) || !GoStory.VaultDoorOpenAt(33, 6) || !GoStory.VaultDoorOpenAt(34, 0)) Fail("금고 문: 34장 6째 단계부터");
            if (GoStory.VaultCoreDimAt(33, 9) || GoStory.VaultCoreDimAt(34, 4) || !GoStory.VaultCoreDimAt(34, 5) || !GoStory.VaultCoreDimAt(35, 0)) Fail("갈무리의 핵: 35장 5째 단계부터");
            if (GoStory.VaultHaemiFreeAt(34, 5) || !GoStory.VaultHaemiFreeAt(34, 6) || !GoStory.VaultHaemiFreeAt(35, 0)) Fail("해미 진열장: 35장 6째 단계부터");
            if (GoStory.VaultDeepShownAt(34) || !GoStory.VaultDeepShownAt(35)) Fail("가장 깊은 진열장: 10부(35장)를 마친 뒤");
            if (GoStory.VaultMomentFreeAt(36, 9) || GoStory.VaultMomentFreeAt(37, 3) || !GoStory.VaultMomentFreeAt(37, 4) || !GoStory.VaultMomentFreeAt(38, 0)) Fail("깊은 진열장 유리: 11부 38장 4째 단계부터");
            // 도형 — 처음 모습(닫힌 채)과 충돌
            bool off0 = StoryState.OffForTest;
            try
            {
                StoryState.OffForTest = false;
                StoryState.Restore(31, 0);
                field.Refresh();
                foreach (var k in new[] { "vault:door", "vault:granary_door", "vault:pylon0orb", "vault:pylon1orb", "vault:core", "vault:haemi" }) if (!field.VaultPartOn(k)) Fail($"갈무리 벌 처음 모습: {k} 가 없음");
                if (field.VaultPartOn("vault:deep")) Fail("가장 깊은 진열장이 10부 전에 드러남");
                if (a.Open()) Fail("9부 전인데 갈무리 벌이 열림");
                StoryState.Restore(32, 0); // 9부를 마침 — 울타리만 꺼지고 10부 상태는 그대로
                field.Refresh();
                if (!a.Open() || !field.VaultPartOn("vault:door") || !field.VaultPartOn("vault:granary_door") || !field.VaultPartOn("vault:core") || field.VaultPartOn("vault:deep")) Fail("32장 끝인데 10부 상태가 바뀜");
                Physics.SyncTransforms();
                a.TrySite("vault", out var vault);
                Vector3 vp = vault.Pos;
                if (!Physics.Raycast(vp + new Vector3(0f, 1.5f, 20f), Vector3.back, out var hit, 20f) || Mathf.Abs(hit.point.z - (vp.z + GoStory.VaultR)) > 0.6f) Fail($"금고 남쪽 문 충돌 {hit.point.z - vp.z:0.00}");
                var doorObj = field.PartObject("vault:door");
                doorObj.SetActive(false);
                Physics.SyncTransforms();
                bool passes = !Physics.Raycast(vp + new Vector3(0f, 1.5f, 20f), Vector3.back, 9f);
                doorObj.SetActive(true);
                Physics.SyncTransforms();
                if (!passes) Fail("금고 문을 치웠는데 충돌이 남음(문 충돌이 문 조각 밑에 있어야)");
                if (!Physics.Raycast(vp + new Vector3(-24f, 1.5f, 0f), Vector3.right, out hit, 20f) || Mathf.Abs(hit.point.x - (vp.x - GoStory.VaultR)) > 1f) Fail($"금고 둥근 벽 충돌 {hit.point.x - vp.x:0.00}");
                if (!Physics.Raycast(vp + new Vector3(0f, 30f, 0f), Vector3.down, out hit, 40f) || hit.point.y < GoStory.VaultH - 0.1f || hit.point.y > GoStory.VaultH + 0.7f) Fail($"금고 지붕 충돌 {hit.point.y:0.00}");
                a.TrySite("pylon0", out var pyl);
                if (!Physics.Raycast(pyl.Pos + new Vector3(0f, 20f, 0f), Vector3.down, out hit, 30f) || Mathf.Abs(hit.point.y - GoStory.VaultPylonH) > 0.05f) Fail($"동력 기둥 윗면 충돌 {hit.point.y:0.00}");
                a.TrySite("granary", out var gr);
                if (!Physics.Raycast(gr.Pos + new Vector3(-10f, 2f, 0f), Vector3.right, out hit, 10f) || Mathf.Abs(hit.point.x - (gr.Pos.x - 2.5f)) > 0.05f) Fail("곳간 벽 충돌");
                a.TrySite("yard", out var yd);
                if (!Physics.Raycast(yd.Pos + new Vector3(-16f, 3f, 0f), Vector3.right, out hit, 12f) || Mathf.Abs(hit.point.x - (yd.Pos.x - 6f)) > 0.05f) Fail("야적장 창고 벽 충돌");
                var yardObj = field.SiteObject("vault", "yard");
                for (int i = 0; i < 3; i++) if (yardObj.transform.Find("Yard_carrier" + i) == null) Fail($"운반 드론 {i} 이 없음");
                foreach (var id in new[] { "pass", "vault", "pylon0", "pylon1", "granary", "yard", "statue" })
                {
                    a.TrySite(id, out var s);
                    if (!Physics.Raycast(s.Pos + new Vector3(0f, 30f, 0f), Vector3.down, 60f) || field.SiteObject("vault", id).transform.childCount == 0) Fail($"갈무리 벌 {id} 도형·바닥");
                }
            }
            finally
            {
                StoryState.OffForTest = off0;
            }
            AreaState.ResetForTest();
            GoldState.Restore(0);
            a.TrySite("statue", out var st);
            if (field.Check(st.Pos + new Vector3(st.Radius - 1f, 0f, 0f)) != 1 || GoldState.Gold != GoAreas.BigGold) Fail("벌 신상 발견·보상");
            AreaState.ResetForTest();
            parts.Add("[vault 갈무리 벌] 표(명소 일곱·돌기둥 서리봉 동쪽 끝·32장 뒤 열림)·이야기 상태 표(울타리·곳간·동력 기둥·금고 문·핵·해미·깊은 진열장·순간 유리)·도형(처음 닫힌 모습·금고 문/둥근 벽/지붕·동력 기둥·곳간·창고 충돌·운반 드론 셋)·발견");
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
