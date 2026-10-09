using System.Collections.Generic;
using System.IO;
using UnityEngine;
using Saga.Forest.Data;
using Saga.Forest.World;

namespace Saga.EditorTools
{
    /// <summary>
    /// PLAN.md 109-4 "FOREST 세 시대" 진단 — `PlaytestForestHeadless` 가 존 소품 진단 뒤에 부른다.
    /// 사람: 표(여섯·시대마다 둘·몸 저마다 다르고 옛 몸과 안 겹침·이름·대사 넷) · 길(마을 안·존 밖·물건 3m·집 5m·스폰 4m·존 소품 3m·서로 2.5m) ·
    /// 세운 것(씬에 여섯·몸이 있는 PC 는 리깅·키 1.75m) · 오가기(서기→걷기→끝점·Speed) · 대사 넷 돌림 · 휨.
    /// 소품: 존마다 현대·미래 하나 이상·명소 곁 무더기 · 다른 시대 30~50% · 잔해(돎·발광 재질·충돌 없음·머리 위·돌아도 밑면 그대로) · 현대 조각은 제 재질.
    /// 끝나면 사람을 지금 시각 자리로, 휨을 플레이어 자리로 되돌린다.
    /// </summary>
    public static class PlaytestForestEras
    {
        private static bool _ok;

        public const float ObjectClearance = 3f;
        public const float HouseClearance = 5f;
        public const float SpawnClearance = 4f;
        public const float PropClearance = 3f;
        public const float FolkClearance = 2.5f;

        private static readonly HashSet<string> Objects = new HashSet<string>
        {
            "ForestCollectSpot", "ForestDeliveryMailbox", "ForestLandmark", "ForestFinishStall", "ForestVillager", "ForestFruitTree",
            "ForestTownScoreBoard", "ForestDeliveryCounter", "ForestWishStone", "ForestFurnitureStall",
        };

        public static bool Run()
        {
            _ok = true;
            CheckTable();
            CheckPaths();
            string folk = CheckFolk();
            string props = CheckProps();
            var player = GameObject.FindWithTag("Player");
            foreach (var f in Object.FindObjectsByType<ForestEraFolk>(FindObjectsSortMode.None))
            {
                f.Step(Time.time);
                if (player != null) f.FollowCurve(player.transform.position);
            }
            var builder = Object.FindFirstObjectByType<ForestZonePropsBuilder>();
            if (builder != null && player != null) builder.Follow(player.transform.position);
            if (_ok) Debug.Log($"[PlaytestForestHeadless] eras OK - 사람 여섯(시대 둘씩·몸 다름)·길 비킴·오가기·대사 넷·휨 |{folk} ·{props}");
            return _ok;
        }

        private static void CheckTable()
        {
            var list = ForestEras.FolkList;
            if (list.Length != 6) Fail($"사람 {list.Length} ≠ 6");
            var perEra = new int[3];
            var bodies = new HashSet<string>();
            var ids = new HashSet<string>();
            foreach (var f in list)
            {
                perEra[(int)f.Era]++;
                if (!ids.Add(f.Id)) Fail($"id 겹침 {f.Id}");
                if (!bodies.Add(f.Body)) Fail($"몸 겹침 {f.Body}");
                if (System.Array.IndexOf(ForestEras.OldBodies, f.Body) >= 0 || f.Body.StartsWith("Maria")) Fail($"{f.Id} 몸 {f.Body} 가 이 판 옛 몸");
                if (string.IsNullOrEmpty(f.NameKo) || string.IsNullOrEmpty(f.NameKey)) Fail($"{f.Id} 이름 빔");
                if (f.LinesKo == null || f.LinesKo.Length != 4) { Fail($"{f.Id} 대사 {f.LinesKo?.Length} ≠ 4"); continue; }
                var lines = new HashSet<string>(f.LinesKo);
                if (lines.Count != 4) Fail($"{f.Id} 대사 겹침");
                if (f.Dir.sqrMagnitude < 0.5f) Fail($"{f.Id} 방향 없음");
            }
            for (int e = 0; e < 3; e++) if (perEra[e] != 2) Fail($"{(ForestEra)e} 사람 {perEra[e]} ≠ 2");

            // 오가기 함수 — 0 에서 출발, 걸음 끝에 끝점, 반 주기 뒤 돌아옴, 걷는 동안만 walking.
            float a = ForestEras.OffsetAt(0f, out bool w0, out _);
            float b = ForestEras.OffsetAt(ForestEras.WalkSec + 0.01f, out bool w1, out _);
            float c = ForestEras.OffsetAt(ForestEras.Cycle * 0.5f + ForestEras.WalkSec * 0.5f, out bool w2, out int s2);
            float d = ForestEras.OffsetAt(ForestEras.Cycle - 0.01f, out bool w3, out _);
            if (a > 0.01f || !w0) Fail($"오가기 0초 {a:F2} walking={w0}");
            if (Mathf.Abs(b - ForestEras.WalkDistance) > 0.01f || w1) Fail($"오가기 걸음 끝 {b:F2} walking={w1}");
            if (!w2 || s2 != -1 || Mathf.Abs(c - ForestEras.WalkDistance * 0.5f) > 0.05f) Fail($"오가기 돌아옴 {c:F2} walking={w2} sign={s2}");
            if (d > 0.01f || w3) Fail($"오가기 주기 끝 {d:F2}");
        }

        private static IEnumerable<Vector3> PathSamples(ForestEras.Folk f)
        {
            var dir = f.Dir.normalized;
            for (int k = 0; k <= 4; k++)
            {
                float off = ForestEras.WalkDistance * k / 4f;
                yield return new Vector3(f.Start.x + dir.x * off, 0f, f.Start.y + dir.y * off);
            }
        }

        private static void CheckPaths()
        {
            var objects = new List<(string, Vector3, float)>();
            foreach (var mb in Object.FindObjectsByType<MonoBehaviour>(FindObjectsInactive.Exclude, FindObjectsSortMode.None))
            {
                string n = mb.GetType().Name;
                if (Objects.Contains(n)) objects.Add((n, mb.transform.position, ObjectClearance));
                else if (n == "ForestHouse") objects.Add((n, mb.transform.position, HouseClearance));
            }
            if (objects.Count < 12) Fail($"비킬 물건이 {objects.Count} 개뿐 — 이름표가 낡았나");
            var props = new List<Vector3>();
            foreach (var c in ForestZoneProps.Clusters) foreach (var p in c.Pieces) props.Add(ForestZoneProps.PiecePos(c, p));
            var spawn = new Vector3(0f, 0f, -15f);
            var player = GameObject.FindWithTag("Player");
            if (player != null) spawn = player.transform.position;

            var list = ForestEras.FolkList;
            for (int i = 0; i < list.Length; i++)
            {
                var f = list[i];
                foreach (var at in PathSamples(f))
                {
                    if (ForestBiomeData.ZoneAt(at.x, at.z) >= 0) Fail($"{f.Id} 길이 존 {ForestBiomeData.ZoneAt(at.x, at.z)} 안 {at}");
                    if (Mathf.Abs(at.x) > ForestGroundBuilder.VillageWidth * 0.5f - 3f || Mathf.Abs(at.z) > ForestGroundBuilder.VillageDepth * 0.5f - 3f)
                        Fail($"{f.Id} 길이 마을 가장자리 곁 {at}");
                    foreach (var (n, pos, r) in objects) if (Flat(pos - at) < r) Fail($"{f.Id} 길이 {n} 에서 {Flat(pos - at):F1}m");
                    foreach (var p in props) if (Flat(p - at) < PropClearance) Fail($"{f.Id} 길이 존 소품에서 {Flat(p - at):F1}m");
                    if (Flat(spawn - at) < SpawnClearance) Fail($"{f.Id} 길이 플레이어 스폰 곁");
                    for (int j = i + 1; j < list.Length; j++)
                        foreach (var bt in PathSamples(list[j]))
                            if (Flat(bt - at) < FolkClearance) { Fail($"{f.Id}·{list[j].Id} 길이 {Flat(bt - at):F1}m"); break; }
                }
            }
        }

        private static string CheckFolk()
        {
            var found = new ForestEraFolk[ForestEras.FolkList.Length];
            foreach (var f in Object.FindObjectsByType<ForestEraFolk>(FindObjectsSortMode.None))
            {
                if (f.FolkIndex < 0 || f.FolkIndex >= found.Length) { Fail($"{f.name} 번호 {f.FolkIndex}"); continue; }
                if (found[f.FolkIndex] != null) Fail($"사람 {f.FolkIndex} 둘");
                found[f.FolkIndex] = f;
            }
            int rigged = 0, expected = 0;
            for (int i = 0; i < found.Length; i++)
            {
                var data = ForestEras.FolkList[i];
                var folk = found[i];
                if (folk == null) { Fail($"{data.Id} 가 씬에 없다(씬 재빌드?)"); continue; }
                if (folk.Visual == null) { Fail($"{data.Id} Visual 없음"); continue; }
                bool onDisk = File.Exists(SetupNpcCharacterImports.PrefabPath(data.Body));
                if (onDisk) expected++;
                if (folk.Rigged) rigged++;
                else if (onDisk) Fail($"{data.Id} 몸 {data.Body} 이 디스크에 있는데 리깅 안 됨(씬 재빌드?)");

                // 오가기 — 서 있는 끝점·걷는 한가운데·돌아온 출발점.
                float t0 = -data.Phase; // OffsetAt(0)
                folk.Step(t0 + ForestEras.WalkSec * 0.5f);
                var mid = folk.transform.position;
                var want = ForestEras.PosAt(data, t0 + ForestEras.WalkSec * 0.5f);
                if (Flat(mid - want) > 0.01f) Fail($"{data.Id} 걷는 중 자리 {mid} ≠ {want}");
                var anim = folk.GetComponentInChildren<Animator>();
                if (folk.Rigged && anim.GetFloat("Speed") < 0.1f) Fail($"{data.Id} 걷는데 Speed {anim.GetFloat("Speed"):F2}");
                folk.Step(t0 + ForestEras.WalkSec + 1f);
                var end = new Vector3(data.Start.x, 0f, data.Start.y) + new Vector3(data.Dir.normalized.x, 0f, data.Dir.normalized.y) * ForestEras.WalkDistance;
                if (Flat(folk.transform.position - end) > 0.01f) Fail($"{data.Id} 끝점 {folk.transform.position} ≠ {end}");
                if (folk.Rigged && anim.GetFloat("Speed") > 0.01f) Fail($"{data.Id} 서 있는데 Speed {anim.GetFloat("Speed"):F2}");
                folk.Step(t0 + ForestEras.Cycle - 1f);
                if (Flat(folk.transform.position - new Vector3(data.Start.x, 0f, data.Start.y)) > 0.01f) Fail($"{data.Id} 안 돌아옴 {folk.transform.position}");

                // 키 — 휨 0(제 자리 기준)에서 렌더러 높이.
                folk.FollowCurve(folk.transform.position);
                if (folk.Rigged && Bounds(folk.Visual.gameObject, out var b))
                {
                    if (Mathf.Abs(b.size.y - ForestEras.Height) > 0.25f) Fail($"{data.Id} 키 {b.size.y:F2} ≠ {ForestEras.Height}");
                    if (Mathf.Abs(b.min.y - folk.transform.position.y) > 0.1f) Fail($"{data.Id} 발 {b.min.y:F2}");
                }

                // 휨 — 먼 점 기준이면 거리² × 0.004 내려간다.
                var far = folk.transform.position + new Vector3(20f, 0f, 0f);
                float y0 = folk.Visual.localPosition.y;
                folk.FollowCurve(far);
                float drop = y0 - folk.Visual.localPosition.y;
                if (Mathf.Abs(drop - 400f * ForestLandmark.CurveAmount) > 0.01f) Fail($"{data.Id} 휨 {drop:F3} ≠ {400f * ForestLandmark.CurveAmount:F3}");
                folk.FollowCurve(folk.transform.position);

                // 대사 — 넷을 돌리고 다섯째는 첫째로.
                var said = new HashSet<string>();
                string first = null;
                for (int k = 0; k < 5; k++)
                {
                    string text = folk.Speak();
                    if (k == 0) first = text;
                    if (k < 4) said.Add(text);
                    else if (text != first) Fail($"{data.Id} 다섯째 대사가 첫째가 아님");
                    if (!text.Contains(ForestEras.EraName(data.Era))) Fail($"{data.Id} 대사에 시대 이름 없음: {text}");
                }
                if (said.Count != 4) Fail($"{data.Id} 대사 {said.Count} 가지");
            }
            return $" 몸 {rigged}/{found.Length}(디스크 {expected})";
        }

        private static string CheckProps()
        {
            int total = 0, modern = 0, future = 0, spinning = 0;
            var zoneModern = new int[ForestBiomeData.Zones.Length];
            var zoneFuture = new int[ForestBiomeData.Zones.Length];
            var zoneLandmark = new int[ForestBiomeData.Zones.Length];
            var builder = Object.FindFirstObjectByType<ForestZonePropsBuilder>();
            if (builder == null) { Fail("ForestZonePropsBuilder 없음"); return ""; }
            foreach (var c in ForestZoneProps.Clusters)
            {
                int zi = ForestZoneProps.ZoneIndex(c.ZoneKey);
                if (c.AtLandmark)
                {
                    zoneLandmark[zi]++;
                    var lm = ForestBiomeData.Zones[zi].LandmarkPos;
                    var center = ForestZoneProps.Center(c);
                    if (Flat(center - new Vector3(lm.x, 0f, lm.y)) > 0.01f) Fail($"{c.Id} 가운데가 명소 자리가 아님");
                }
                var root = builder.transform.Find("ZoneProps_" + c.Id);
                for (int i = 0; i < c.Pieces.Length; i++)
                {
                    var p = c.Pieces[i];
                    total++;
                    if (p.Era == ForestEra.Modern) { modern++; zoneModern[zi]++; }
                    if (p.Era != ForestEra.Future) continue;
                    future++;
                    zoneFuture[zi]++;
                    if (p.Collide) Fail($"{c.Id} 잔해 {p.Model} 가 부딪힌다");
                    if (p.Y < ForestEras.RiftMinHover) Fail($"{c.Id} 잔해 {p.Model} 가 {p.Y:F1}m — 머리 위({ForestEras.RiftMinHover}m) 아래");
                    if (root == null || i >= root.childCount) continue;
                    var piece = root.GetChild(i);
                    var body = piece.Find("Visual/Body");
                    var spin = body != null ? body.GetComponent<ForestRiftSpin>() : null;
                    if (spin == null) { Fail($"{c.Id} {piece.name} 가 안 돈다(ForestRiftSpin 없음)"); continue; }
                    spinning++;
                    if (piece.GetComponentInChildren<Collider>(true) != null) Fail($"{c.Id} {piece.name} 잔해에 충돌");
                    foreach (var r in body.GetComponentsInChildren<MeshRenderer>(true))
                        foreach (var m in r.sharedMaterials)
                            if (m == null || !m.name.EndsWith("_rift") || m.shader == null || m.shader.name != "Saga/CelToon" || m.GetFloat("_RimStrength") < 1f) { Fail($"{c.Id} {piece.name}/{r.name} 잔해 툰·림 재질 아님 ({(m != null ? m.name : "null")})"); break; }
                    // 돌아도 밑면 그대로(세로축 회전).
                    builder.Follow(piece.position);
                    var saved = body.localRotation;
                    Bounds(body.gameObject, out var b0);
                    body.localRotation = ForestRiftSpin.RotationAt(spin.BaseRotation, 0f, 7f);
                    Bounds(body.gameObject, out var b1);
                    body.localRotation = saved;
                    if (Mathf.Abs(b0.min.y - b1.min.y) > 0.05f) Fail($"{c.Id} {piece.name} 돌면 밑면 {b0.min.y:F2}→{b1.min.y:F2}");
                    float turned = Quaternion.Angle(ForestRiftSpin.RotationAt(spin.BaseRotation, 0f, 0f), ForestRiftSpin.RotationAt(spin.BaseRotation, 0f, 7f));
                    if (Mathf.Abs(turned - 7f * ForestEras.RiftSpinDegPerSec) > 1f) Fail($"{c.Id} {piece.name} 7초에 {turned:F0}° 돎");
                }
                if (root == null) continue;
                for (int i = 0; i < c.Pieces.Length && i < root.childCount; i++)
                {
                    if (c.Pieces[i].Era != ForestEra.Modern) continue;
                    var piece = root.GetChild(i);
                    if (piece.GetComponentInChildren<ForestRiftSpin>(true) != null) Fail($"{c.Id} {piece.name} 현대 조각이 돈다");
                    foreach (var r in piece.GetComponentsInChildren<MeshRenderer>(true))
                        foreach (var m in r.sharedMaterials)
                            if (m != null && m.name.EndsWith("_rift")) { Fail($"{c.Id} {piece.name} 현대 조각에 잔해 재질"); break; }
                }
            }
            for (int i = 0; i < zoneModern.Length; i++)
            {
                string key = ForestBiomeData.Zones[i].Key;
                if (zoneModern[i] < 1) Fail($"{key} 현대 조각 없음");
                if (zoneFuture[i] < 1) Fail($"{key} 미래 조각 없음");
                if (zoneLandmark[i] != 1) Fail($"{key} 명소 곁 무더기 {zoneLandmark[i]} ≠ 1");
            }
            float share = total > 0 ? (modern + future) / (float)total : 0f;
            if (share < 0.3f || share > 0.5f) Fail($"다른 시대 {share:P0} — 30~50% 밖");
            return $" 소품 {total}(현대 {modern}·미래 {future}, {share:P0})·잔해 돎 {spinning}";
        }

        private static bool Bounds(GameObject go, out Bounds b)
        {
            b = default;
            bool any = false;
            foreach (var r in go.GetComponentsInChildren<Renderer>(true))
            {
                if (!any) { b = r.bounds; any = true; }
                else b.Encapsulate(r.bounds);
            }
            return any;
        }

        private static float Flat(Vector3 v) => new Vector2(v.x, v.z).magnitude;

        private static void Fail(string msg)
        {
            _ok = false;
            Debug.LogError($"[PlaytestForestHeadless] eras FAIL - {msg}");
        }
    }
}
