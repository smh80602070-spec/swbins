using System.Collections.Generic;
using UnityEditor;
using UnityEngine;
using Saga.Go.Combat;
using Saga.Go.Data;
using Saga.Go.World;

namespace Saga.EditorTools
{
    /// <summary>
    /// PLAN.md 109-1 "GO 세 시대 사람·적" 진단 — `PlaytestHeadless` 가 지역 소품 진단 뒤에 부른다(읽기만, 세이브·자리 안 바꾼다).
    /// 적: 해시 고정(FNV)·마을 역참 110m 안은 제 시대·다른 시대 무리 몫(30~55%)·세 시대 모두·네 몸 모두 · 세운 적의 시대 = 무리 시대,
    /// 다른 시대는 그 시대 몸(프리팹 있으면 컨트롤러 이름까지)·이름(원소 낱말), 과거는 옛 이름 · 지역 위험 줄 "시간 틈".
    /// 사람: 역참마다 셋(제 시대 먼저, 세 시대 서로 다름)·돌기둥 13m·설 수 있는 칸·역할마다 다른 몸·몸 프리팹·대사에 땅 이름·
    /// 오가기 순수 함수(0·4·10·20·30초)·말 걸기 반경.
    /// </summary>
    public static class PlaytestGoEras
    {
        private static string _tag;
        private static bool _ok;

        public static bool Run(string tag)
        {
            _tag = tag;
            _ok = true;
            string m = CheckRule() + CheckSpawned() + CheckDangerLine() + CheckFolk() + CheckProps();
            if (_ok) Debug.Log($"[{_tag}] eras OK - 해시 고정·역참 둘레 제 시대·다른 시대 몫·세 시대·네 몸·세운 적 시대/몸/이름·위험 줄 시간 틈·역참 사람 셋(시대 순서·자리·몸·대사·오가기)·소품 세 시대(지역마다 현대·미래·몫·잔해 뜸/돎/발광/충돌 없음) |{m}");
            return _ok;
        }

        private static string CheckRule()
        {
            if (GoEras.Hash("a") != 0xE40C292Cu) Fail($"FNV-1a 해시가 틀림 {GoEras.Hash("a"):X}");
            var home = GoWorldMap.Waypoints[0];
            int n = 0, other = 0;
            var eras = new HashSet<GoEra>();
            var bodies = new HashSet<string>();
            foreach (var (id, members) in FieldSpawner.GroupMembers())
            {
                n++;
                GoEra era = FieldSpawner.GroupEra(id);
                eras.Add(era);
                string region = FieldSpawner.GroupRegion(id);
                GoEra main = GoEras.RegionEra(region);
                if (era != main) other++;
                for (int i = 0; i < members.Length; i++)
                {
                    string b = GoEras.FoeBodyFor(era, id, i);
                    if (era == GoEra.Past) { if (b != null) Fail($"{id} 과거 무리에 시대 몸 {b}"); }
                    else if (b == null || System.Array.IndexOf(GoEras.FoeBodies(era), b) < 0) Fail($"{id} {era} 무리 몸 {b}");
                    else bodies.Add(b);
                }
            }
            // 마을 역참 110m 안 무리는 제 시대
            int near = 0;
            int gi = 0;
            var ids = new List<string>();
            foreach (var (id, _) in FieldSpawner.GroupMembers()) ids.Add(id);
            foreach (var ctr in FieldSpawner.GroupCenters())
            {
                Vector3 d = ctr - TestMapData.WorldPos(home.Gx, home.Gy);
                d.y = 0f;
                if (d.magnitude < GoEras.MainOnlyRadius)
                {
                    near++;
                    if (FieldSpawner.GroupEra(ids[gi]) != GoEras.RegionEra(FieldSpawner.GroupRegion(ids[gi]))) Fail($"{ids[gi]} 가 역참 {d.magnitude:F0}m 안인데 다른 시대");
                }
                gi++;
            }
            float share = n > 0 ? (float)other / n : 0f;
            if (share < 0.3f || share > 0.55f) Fail($"다른 시대 무리 몫 {other}/{n} — 약 40% 여야");
            if (eras.Count != 3) Fail($"무리 시대가 {eras.Count}가지 — 세 시대 모두 서야");
            int want = GoEras.FoeBodies(GoEra.Modern).Length + GoEras.FoeBodies(GoEra.Future).Length;
            if (bodies.Count != want) Fail($"다른 시대 몸이 {bodies.Count}/{want}만 쓰임");
            return $" 무리 {n}(다른 시대 {other}·역참 둘레 {near})·몸 {bodies.Count}";
        }

        private static string CheckSpawned()
        {
            int modern = 0, future = 0, rigged = 0;
            foreach (var e in FieldEnemy.All)
            {
                if (e.IsGuardian)
                {
                    if (e.Era != GoEra.Past || e.EraBody != null) Fail("수호장이 다른 시대");
                    continue;
                }
                GoEra want = FieldSpawner.GroupEra(e.GroupId);
                if (e.Era != want) { Fail($"{e.name}({e.GroupId}) 시대 {e.Era} ≠ 무리 {want}"); continue; }
                if (e.Era == GoEra.Past)
                {
                    if (e.EraBody != null || e.DisplayName != FieldEnemy.KindName(e.EnemyKind)) Fail($"과거 적 {e.GroupId} 이름·몸 {e.DisplayName}/{e.EraBody}");
                    continue;
                }
                if (e.Era == GoEra.Modern) modern++; else future++;
                if (e.EraBody == null || System.Array.IndexOf(GoEras.FoeBodies(e.Era), e.EraBody) < 0) { Fail($"{e.GroupId} 몸 {e.EraBody}"); continue; }
                if (!e.DisplayName.Contains(GoEras.FoeBodyName(e.EraBody))) Fail($"{e.GroupId} 이름 \"{e.DisplayName}\" 에 몸 이름 없음");
                if (e.IsElemental && e.DisplayName == GoEras.FoeBodyName(e.EraBody)) Fail($"{e.GroupId} 원소 적 이름에 원소 낱말 없음");
                var prefab = AssetDatabase.LoadAssetAtPath<GameObject>(SetupNpcCharacterImports.PrefabPath(e.EraBody));
                if (prefab == null) continue;
                var visual = e.transform.Find("Visual");
                var anim = visual != null ? visual.GetComponentInChildren<Animator>() : null;
                if (anim == null || anim.runtimeAnimatorController == null || anim.runtimeAnimatorController.name != e.EraBody)
                    Fail($"{e.GroupId} 몸이 {e.EraBody} 아님({(anim != null && anim.runtimeAnimatorController != null ? anim.runtimeAnimatorController.name : "없음")})");
                else rigged++;
            }
            if (modern == 0 || future == 0) Fail($"세운 적 중 현대 {modern}·미래 {future} — 둘 다 있어야");
            return $" 세운 적 현대 {modern}·미래 {future}(사실 몸 {rigged})";
        }

        private static string CheckDangerLine()
        {
            string rift = GoLocalization.T("region.era_foes", "시간 틈 {0}").Replace("{0}", "");
            int with = 0;
            foreach (var r in GoWorldMap.Regions)
            {
                var names = FieldSpawner.EraFoeNames(r.Id);
                string line = GoWorldMap.DangerLine(r.Id);
                if (names.Count == 0) { if (line.Contains(rift.Trim())) Fail($"{r.Id} 에 다른 시대 무리가 없는데 \"{line}\""); continue; }
                with++;
                if (!line.Contains(rift.Trim())) Fail($"{r.Id} 위험 줄에 시간 틈 없음 \"{line}\"");
                foreach (var nm in names) if (!line.Contains(nm)) Fail($"{r.Id} 위험 줄에 {nm} 없음 \"{line}\"");
            }
            if (with == 0) Fail("시간 틈 적이 선 지역이 없음");
            return $" 시간 틈 지역 {with}";
        }

        private static string CheckFolk()
        {
            // 역할마다 몸이 다르다(색만 다른 몸 금지)
            var roleBodies = new HashSet<string>();
            foreach (var r in GoEras.Roles) if (!roleBodies.Add(r.Body)) Fail($"역할 몸 {r.Body} 가 겹침");
            foreach (var e in GoEras.All) if (GoEras.RolesOf(e).Length < 3) Fail($"{e} 역할 {GoEras.RolesOf(e).Length} < 3");

            // 오가기 — 시각의 순수 함수
            bool w; int s;
            if (Mathf.Abs(FolkWalker.OffsetAt(0f, out w, out s)) > 0.01f || !w) Fail("오가기 0초");
            if (Mathf.Abs(FolkWalker.OffsetAt(4f, out w, out s) - FolkWalker.WalkDistance) > 0.01f) Fail("오가기 4초");
            if (Mathf.Abs(FolkWalker.OffsetAt(10f, out w, out s) - FolkWalker.WalkDistance) > 0.01f || w) Fail("오가기 10초(서 있어야)");
            if (Mathf.Abs(FolkWalker.OffsetAt(20f, out w, out s) - FolkWalker.WalkDistance * 0.5f) > 0.01f || !w || s != -1) Fail("오가기 20초(돌아오는 중)");
            if (Mathf.Abs(FolkWalker.OffsetAt(30f, out w, out s)) > 0.01f || w) Fail("오가기 30초");
            if (Mathf.Abs(FolkWalker.OffsetAt(36f + 2f, out w, out s) - FolkWalker.OffsetAt(2f, out w, out s)) > 0.01f) Fail("오가기 주기 36초");

            var fb = FolkBuilder.Instance;
            if (fb == null) { Fail("FolkBuilder 없음"); return ""; }
            int wn = GoWorldMap.Waypoints.Length;
            if (fb.Folk.Count != wn * FolkBuilder.PerWaypoint) Fail($"사람 {fb.Folk.Count} ≠ {wn}×{FolkBuilder.PerWaypoint}");
            int rigged = 0;
            for (int wi = 0; wi < wn; wi++)
            {
                var here = fb.Folk.FindAll(f => f.WaypointIndex == wi);
                if (here.Count != FolkBuilder.PerWaypoint) { Fail($"역참 {wi} 사람 {here.Count}"); continue; }
                var wp = GoWorldMap.Waypoints[wi];
                GoEra main = GoEras.RegionEra(GoWorldMap.RegionAt(TestMapData.WorldPos(wp.Gx, wp.Gy)));
                if (here[0].Role.Era != main) Fail($"{wp.Id} 첫 사람이 제 시대 아님 {here[0].Role.Era}");
                var eras = new HashSet<GoEra>();
                Vector3 pillar = GoWorldMap.WaypointPos(wp);
                string region = GoWorldMap.RegionName(GoWorldMap.RegionAt(TestMapData.WorldPos(wp.Gx, wp.Gy)));
                foreach (var f in here)
                {
                    eras.Add(f.Role.Era);
                    Vector3 d = f.Origin - pillar; d.y = 0f;
                    if (Mathf.Abs(d.magnitude - FolkBuilder.Ring) > 0.5f) Fail($"{f.name} 돌기둥에서 {d.magnitude:F1}m");
                    if (!FieldEnemy.CanStandOn(f.Origin) || !FieldEnemy.CanStandOn(f.Origin + f.Dir * FolkWalker.WalkDistance)) Fail($"{f.name} 오가는 길이 산·물 칸");
                    string line = GoEras.FolkLine(f.Role, wi);
                    if (line.Contains("{") || (!line.Contains(region) && !line.Contains(GoWorldMap.WaypointName(wp)))) Fail($"{f.name} 대사 \"{line}\"");
                    var talk = f.GetComponentInChildren<VillagerTalk>();
                    var col = talk != null ? talk.GetComponent<SphereCollider>() : null;
                    if (col == null || !col.isTrigger || !Mathf.Approximately(col.radius, FolkBuilder.TalkRadius)) Fail($"{f.name} 말 걸기 반경");
                    var prefab = AssetDatabase.LoadAssetAtPath<GameObject>(SetupNpcCharacterImports.PrefabPath(f.Role.Body));
                    if (prefab == null) continue;
                    var anim = f.GetComponentInChildren<Animator>();
                    if (anim == null || anim.runtimeAnimatorController == null || anim.runtimeAnimatorController.name != f.Role.Body) Fail($"{f.name} 몸이 {f.Role.Body} 아님");
                    else rigged++;
                }
                if (eras.Count != 3) Fail($"{wp.Id} 시대 {eras.Count}가지");
            }
            return $" 사람 {fb.Folk.Count}(사실 몸 {rigged})";
        }

        /// <summary>109-1b — 지역 소품 무더기의 현대·미래 조각.</summary>
        private static string CheckProps()
        {
            int past = 0, modern = 0, future = 0;
            var perRegion = new Dictionary<string, (int m, int f)>();
            foreach (var c in GoRegionProps.Clusters)
            {
                perRegion.TryGetValue(c.RegionId, out var rc);
                foreach (var p in c.Pieces)
                {
                    if (p.Era == GoEra.Modern) { modern++; rc.m++; }
                    else if (p.Era == GoEra.Future) { future++; rc.f++; }
                    else past++;
                }
                perRegion[c.RegionId] = rc;
            }
            foreach (var kv in perRegion)
                if (kv.Value.m == 0 || kv.Value.f == 0) Fail($"{kv.Key} 소품에 현대 {kv.Value.m}·미래 {kv.Value.f} — 둘 다 있어야");
            float share = (float)(modern + future) / (past + modern + future);
            if (share < 0.25f || share > 0.45f) Fail($"소품 다른 시대 몫 {share:P0} — 약 30~40% 여야");

            var builder = Object.FindFirstObjectByType<RegionPropsBuilder>();
            if (builder == null) { Fail("RegionPropsBuilder 없음"); return ""; }
            int spun = 0;
            foreach (var c in GoRegionProps.Clusters)
            {
                var root = builder.transform.Find("RegionProps_" + c.Id);
                if (root == null) { Fail($"{c.Id} 무더기 없음"); continue; }
                var list = new List<Transform>();
                foreach (Transform t in root) if (t.GetComponent<Light>() == null) list.Add(t);
                if (list.Count != c.Pieces.Length) { Fail($"{c.Id} 조각 수 {list.Count} ≠ {c.Pieces.Length}"); continue; }
                for (int i = 0; i < list.Count; i++)
                {
                    var p = c.Pieces[i];
                    var go = list[i].gameObject;
                    var spin = go.GetComponent<RiftSpin>();
                    bool anyRift = false, allRift = true, emissive = true;
                    foreach (var r in go.GetComponentsInChildren<MeshRenderer>(true))
                        foreach (var mat in r.sharedMaterials)
                        {
                            if (mat == null) continue;
                            bool rift = mat.name.EndsWith("_rift");
                            anyRift |= rift; allRift &= rift;
                            if (rift && !(mat.shader != null && mat.shader.name == "Saga/CelToon" && mat.GetFloat("_RimStrength") >= 1f)) emissive = false; // U-0066 툰 + 하늘색 림
                        }
                    if (p.Era != GoEra.Future)
                    {
                        if (spin != null || anyRift) Fail($"{c.Id} {go.name} ({p.Era}) 에 잔해 재질·회전");
                        continue;
                    }
                    if (spin == null) { Fail($"{c.Id} {go.name} 잔해가 안 돎"); continue; }
                    if (!allRift || !emissive) Fail($"{c.Id} {go.name} 잔해 재질이 툰·하늘색 림 아님");
                    if (go.isStatic) Fail($"{c.Id} {go.name} 잔해가 정적");
                    if (go.GetComponentsInChildren<Collider>(true).Length > 0) Fail($"{c.Id} {go.name} 잔해에 충돌");
                    if (!Bounds(go, out var b0)) continue;
                    float floor = c.InRiver ? TestMapData.WaterSurfaceHeight : root.position.y;
                    if (b0.min.y - floor < GoRegionProps.RiftMinHover) Fail($"{c.Id} {go.name} 잔해가 {b0.min.y - floor:F2}m 만 뜸");
                    var keep = go.transform.rotation;
                    go.transform.rotation = RiftSpin.RotationAt(spin.BaseRotation, 0f, 13.7f);
                    Bounds(go, out var b1);
                    go.transform.rotation = keep;
                    if (Mathf.Abs(b1.min.y - b0.min.y) > 0.03f) Fail($"{c.Id} {go.name} 돌면 밑면이 변함 {b0.min.y:F2}→{b1.min.y:F2}");
                    spun++;
                }
            }
            if (spun != future) Fail($"도는 잔해 {spun} ≠ 표 미래 조각 {future}");
            return $" 소품 과거 {past}·현대 {modern}·미래 {future}({share:P0})";
        }

        private static bool Bounds(GameObject go, out Bounds b)
        {
            b = default;
            bool any = false;
            foreach (var r in go.GetComponentsInChildren<Renderer>(true))
            {
                if (!any) { b = r.bounds; any = true; } else b.Encapsulate(r.bounds);
            }
            return any;
        }

        private static void Fail(string msg)
        {
            _ok = false;
            Debug.LogError($"[{_tag}] eras: {msg}");
        }
    }
}
