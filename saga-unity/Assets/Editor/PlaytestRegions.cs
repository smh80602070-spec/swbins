using System.Collections.Generic;
using System.IO;
using System.Text.RegularExpressions;
using Saga.Core.Region;
using UnityEditor;
using UnityEditor.SceneManagement;
using UnityEngine;

namespace Saga.EditorTools
{
    /// <summary>지역 재질 원본(`Resources/RegionMaterials/*.mat`) 만들기 — 셰이더가 빌드에서 안 빠지게 재질에 매달아 둔다(tasks U-0023). CelToon.mat 과 같은 규칙, 에셋 그림은 아니다.</summary>
    public static class RegionMaterialSetup
    {
        public const string Dir = "Assets/SagaCore/Resources/RegionMaterials";

        [MenuItem("Saga/Regions/Create Materials")]
        public static void EnsureAll()
        {
            if (!AssetDatabase.IsValidFolder(Dir)) Directory.CreateDirectory(Dir);
            bool created = false;
            foreach (var (name, shaderName) in RegionMaterials.Sources)
            {
                string path = Dir + "/" + name + ".mat";
                if (AssetDatabase.LoadAssetAtPath<Material>(path) != null) continue;
                var shader = Shader.Find(shaderName);
                if (shader == null) { Debug.LogError("[RegionMaterialSetup] 셰이더 없음: " + shaderName); continue; }
                var m = new Material(shader) { name = name };
                switch (name)
                {
                    case "Toon":
                    case "Unlit":
                        m.enableInstancing = true;
                        break;
                    case "ToonVertex":
                        m.enableInstancing = true;
                        m.SetFloat("_UseVertexColor", 1f);
                        m.EnableKeyword("_VERTEX_COLOR");
                        break;
                    case "SparkAdd":
                        m.SetFloat("_SrcBlend", (float)UnityEngine.Rendering.BlendMode.SrcAlpha);
                        m.SetFloat("_DstBlend", (float)UnityEngine.Rendering.BlendMode.One);
                        break;
                    case "SparkAlpha":
                        m.SetFloat("_SrcBlend", (float)UnityEngine.Rendering.BlendMode.SrcAlpha);
                        m.SetFloat("_DstBlend", (float)UnityEngine.Rendering.BlendMode.OneMinusSrcAlpha);
                        break;
                    case "Sky":
                        m.SetFloat("_Mapping", 1f); m.SetFloat("_ImageType", 0f);
                        break;
                }
                AssetDatabase.CreateAsset(m, path);
                created = true;
            }
            if (created) AssetDatabase.SaveAssets();
        }
    }

    /// <summary>지역 로더 진단(tasks U-0023) — 컴파일·셰이더·JSON·좌표·메시 감김·지역 다섯 조립. `-executeMethod Saga.EditorTools.PlaytestRegions.Run` → "[PlaytestRegions] OK/FAIL".
    /// 지역마다 드로우콜 추정·삼각형 수를 한 줄씩 남긴다(`[Regions] 지역 …`) — 실제 SetPass 는 실기에서만 알 수 있다.</summary>
    public static class PlaytestRegions
    {
        [MenuItem("Saga/Playtest Regions")]
        public static void Run()
        {
            PlaytestKit.Begin("[PlaytestRegions]");
            RegionMaterialSetup.EnsureAll();
            using (PlaytestKit.ErrorCounter())
            {
                ChecksShaders();
                ChecksJson();
                ChecksCoordinates();
                ChecksVillageGround();
                ChecksFogLid();
                ChecksSceneryFacing();
                ChecksMeshes();
                foreach (var id in RegionLoader.Ids) ChecksRegion(id);
                ChecksDeterministic();
                ChecksReview();
            }
            PlaytestKit.Summary("PlaytestRegions");
            if (Application.isBatchMode) EditorApplication.Exit(PlaytestKit.Fails == 0 ? 0 : 1);
        }

        private static void ChecksShaders()
        {
            foreach (var n in new[] { "Saga/RegionGround", "Saga/RegionSpark" })
            {
                var sh = Shader.Find(n);
                PlaytestKit.Check(sh != null, n + " 셰이더를 못 찾음");
                if (sh == null) continue;
                PlaytestKit.Check(sh.isSupported, n + " 이 이 기기에서 지원되지 않음");
                PlaytestKit.Check(!ShaderUtil.ShaderHasError(sh), n + " 컴파일 오류");
            }
            foreach (var (name, _) in RegionMaterials.Sources)
                PlaytestKit.Check(Resources.Load<Material>(RegionMaterials.Dir + name) != null, "재질 원본 없음: " + name);
        }

        // 마을 높이는 "위에서 쏜 광선이 처음 맞은 면"(집·나무 꼭대기 포함)이라 그대로 땅으로 쓰면 집이 언덕에 묻힌다 — 열림으로 걷어낸 뒤
        // 땅 높이가 조각 높이와 가까워야 한다(Godot `region_loader.gd` 실측 평균 오차 3.6m → 0.8m). 재질 칸이 있는 지역은 높이를 안 건드린다.
        private static void ChecksVillageGround()
        {
            var v = RegionLoader.LoadLayout("Village");
            PlaytestKit.Check(v != null && v.terrain != null, "마을 배치표·지형 없음");
            if (v == null || v.terrain == null) return;
            float sum = 0f, max = 0f; int n = 0;
            foreach (var p in v.pieces)
            {
                if (!v.terrain.SampleHeight(p.pos.x, p.pos.z, out float h)) continue;
                float d = Mathf.Abs(h - p.pos.y);
                sum += d; if (d > max) max = d; n++;
            }
            PlaytestKit.Check(n >= 15, $"마을 조각 중 땅 위에 선 것이 {n}개뿐");
            float mean = n > 0 ? sum / n : 99f;
            PlaytestKit.Check(mean < 1.5f, $"마을 땅 높이가 조각 높이와 평균 {mean:0.0}m 어긋남(열림 처리 확인 — 1.5m 미만이어야 함)");
            Debug.Log($"[Regions] 마을 땅-조각 높이 오차 평균 {mean:0.00}m 최대 {max:0.0}m (n={n})");
            var f = RegionLoader.LoadLayout("FrostPeak");
            PlaytestKit.Check(f != null && f.terrain != null && f.terrain.tintLow == Color.white, "재질 칸이 있는 지역(서리봉)에 마을 풀 색 보정이 새어 들어감");
        }

        // 재질 칸이 있는 지역(서리봉·사거리·은하 나루)의 높이는 안개 상자 윗면(10·8·5m)으로 덮여 있어 카메라·조각이 땅 아래에 묻혔다 —
        // 뚜껑을 걷은 뒤 카메라와 모든 조각이 땅 위에 있어야 한다.
        private static void ChecksFogLid()
        {
            foreach (var id in new[] { "FrostPeak", "Crossroads", "GalaxyFerry" })
            {
                var L = RegionLoader.LoadLayout(id);
                PlaytestKit.Check(L != null && L.terrain != null && L.terrain.hasMaterials && L.hasFogBox, id + " 새 모양 배치표(재질 칸·안개 상자) 아님");
                if (L == null || L.terrain == null) continue;
                int below = 0, n = 0; float worst = 0f;
                foreach (var p in L.pieces)
                {
                    if (!L.terrain.SampleHeight(p.pos.x, p.pos.z, out float h)) continue;
                    n++;
                    if (h > p.pos.y + 1.5f) { below++; worst = Mathf.Max(worst, h - p.pos.y); }
                }
                PlaytestKit.Check(n >= 10 && below == 0, $"{id} 조각 {below}/{n} 개가 땅({worst:0.0}m)에 묻힘 — 안개 상자 뚜껑 제거 확인");
                if (L.hasCamera && L.terrain.SampleHeight(L.cameraPos.x, L.cameraPos.z, out float ch))
                    PlaytestKit.Check(ch < L.cameraPos.y, $"{id} 카메라가 땅 아래: 땅 {ch:0.0}m ≥ 카메라 {L.cameraPos.y:0.0}m");
                if (id == "FrostPeak")
                {
                    // 소나무 구역(풍경 GLB 소나무 밑동 y≈-1.5~0m, 길에서 먼 x≈±30)의 땅이 소나무 밑동 위로 솟아 소나무를 묻으면 안 된다
                    foreach (var pt in new[] { new Vector2(-30f, 40f), new Vector2(30f, 60f), new Vector2(-40f, 25f) })
                    {
                        bool ok = L.terrain.SampleHeight(pt.x, pt.y, out float gh);
                        PlaytestKit.Check(ok && gh < 2f, $"서리봉 소나무 구역 {pt} 땅이 {gh:0.0}m — 소나무 밑동(≈0m)을 묻음");
                    }
                }
                if (L.hasWater)
                {
                    // 물에 뜬 조각(배·뗏목) 밑은 물 아래여야 물이 보인다
                    int floating = 0, dry = 0;
                    foreach (var p in L.pieces)
                    {
                        if (p.pos.y > L.waterY + 0.05f || !L.terrain.SampleHeight(p.pos.x, p.pos.z, out float h)) continue;
                        floating++; if (h >= L.waterY) dry++;
                    }
                    PlaytestKit.Check(floating >= 3 && dry == 0, $"{id} 물에 뜬 조각 {floating}개 중 {dry}개 밑이 물 위 땅");
                    // 호수가 한 줄기 길이 아니라 넓게 있어야 한다 — 상자 안 격자 칸 중 물 아래 칸이 일정 비율 이상
                    int inBox = 0, under = 0;
                    var T = L.terrain;
                    for (int j = 0; j < T.nz; j++)
                        for (int i = 0; i < T.nx; i++)
                        {
                            float x = T.x0 + i * T.step, z = T.z0 + j * T.step, h = T.H(i, j);
                            if (float.IsNaN(h) || Mathf.Abs(x - L.fogBoxCenter.x) > L.fogBoxSize.x * 0.5f || Mathf.Abs(z - L.fogBoxCenter.y) > L.fogBoxSize.y * 0.5f) continue;
                            inBox++; if (h < L.waterY) under++;
                        }
                    PlaytestKit.Check(inBox > 0 && under >= inBox * 0.3f, $"{id} 호수가 좁다: 상자 안 {inBox}칸 중 물 아래 {under}칸(30% 이상이어야 함)");
                    Debug.Log($"[Regions] {id} 상자 안 호수 칸 {under}/{inBox}");
                }
                if (id == "GalaxyFerry")
                {
                    PlaytestKit.Check(L.hasMoon && L.moonRadius > 0f && L.moonHalo > L.moonRadius, "은하 나루 달(sky.moon) 못 읽음");
                    var built = RegionLoader.Build(id, null, new RegionLoadOptions());
                    PlaytestKit.Check(built.root != null && built.root.transform.Find("Moon") != null && built.root.transform.Find("MoonHalo") != null, "은하 나루에 달·후광이 안 섬");
                    if (built.root != null) Object.DestroyImmediate(built.root);
                }
                Debug.Log($"[Regions] {id} 뚜껑 제거 뒤 묻힌 조각 {below}/{n}");
            }
        }

        // 풍경 GLB 방향 — glTF z = -Blender y 라 그대로 들이면 z 가 뒤집혀 카메라 뒤에 선다. Y축 180° 로 바로잡은 뒤, 배치표 좌표(조각·하늘 고리)와
        // 같은 쪽(+z)에 서야 한다. 시간 틈은 큰 흰 고리(Torus.003/.004 = sky.rift_rings)와 구름바다(cloudpuff: 밝은 기본색+약한 발광)도 본다.
        private static void ChecksSceneryFacing()
        {
            // (지역, 풍경 안 노드 이름, 이 노드의 중심 z 가 이쪽 부호여야 함)
            var table = new[] { ("FrostPeak", "pines_g", 1f), ("Crossroads", "Torus", 1f), ("TimeRift", "Torus.003", 1f), ("GalaxyFerry", "Cone", 1f) };
            foreach (var (id, node, sign) in table)
            {
                var built = RegionLoader.Build(id, null, new RegionLoadOptions());
                PlaytestKit.Check(built.root != null, id + " 을 못 짬");
                if (built.root == null) continue;
                Renderer hit = null;
                foreach (var r in built.root.GetComponentsInChildren<Renderer>(true)) if (r.gameObject.name == node && r.transform.parent != null && r.transform.parent.name == "Scenery") hit = r;
                PlaytestKit.Check(hit != null, $"{id} 풍경에 {node} 없음");
                if (hit != null) PlaytestKit.Check(hit.bounds.center.z * sign > 5f, $"{id} 풍경 {node} 이 카메라 뒤(z {hit.bounds.center.z:0.0}) — 풍경 방향 뒤집힘");
                if (id == "TimeRift")
                {
                    PlaytestKit.Check(built.root.transform.Find("RiftRing0") == null, "시간 틈 큰 고리가 GLB 와 코드로 두 번 섬");
                    Renderer cloud = null;
                    foreach (var r in built.root.GetComponentsInChildren<Renderer>(true)) if (r.gameObject.name == "cloudsea") cloud = r;
                    PlaytestKit.Check(cloud != null, "시간 틈 구름바다(cloudsea) 못 찾음");
                    if (cloud != null)
                    {
                        var c = cloud.sharedMaterial.GetColor("_BaseColor");
                        float lum = (c.r + c.g + c.b) / 3f;
                        PlaytestKit.Check(lum >= 0.6f, $"구름바다가 어둡다(발광색 단색 갈색?): 평균 {lum:0.00}");
                    }
                }
                Object.DestroyImmediate(built.root);
            }
        }

        private static void ChecksJson()
        {
            var o = RegionJson.Parse("{\"a\":[1,null,-2.5e1,true],\"s\":\"가\\n\\\"x\\\"\",\"d\":{}}") as Dictionary<string, object>;
            PlaytestKit.Check(o != null, "JSON 객체 파싱 실패");
            if (o == null) return;
            var a = (List<object>)o["a"];
            PlaytestKit.Check(a.Count == 4 && a[1] == null && (double)a[2] == -25.0 && (bool)a[3], "JSON 배열(null·지수·불) 파싱이 다름");
            PlaytestKit.Check((string)o["s"] == "가\n\"x\"", "JSON 문자열 이스케이프가 다름");
            bool threw = false;
            try { RegionJson.Parse("{\"a\":[1,2}"); } catch (System.FormatException) { threw = true; }
            PlaytestKit.Check(threw, "깨진 JSON 을 받아들임");
            threw = false;
            try { RegionJson.Parse("{\"a\":[1,2"); } catch (System.FormatException) { threw = true; }
            PlaytestKit.Check(threw, "잘린 JSON 이 FormatException 이 아님");
            var nan = RegionJson.Parse("[NaN,-Infinity,Infinity]") as List<object>;
            PlaytestKit.Check(nan != null && double.IsNaN((double)nan[0]) && double.IsNegativeInfinity((double)nan[1]) && double.IsPositiveInfinity((double)nan[2]), "NaN·Infinity 를 못 읽음");
        }

        private static void ChecksCoordinates()
        {
            PlaytestKit.Check(RegionLayout.BlenderToUnity(1f, 2f, 3f) == new Vector3(1f, 3f, 2f), "좌표 변환이 (x,z,y) 가 아님");
            // Blender 에서 Z 축으로 r 만큼 돌린 +X 방향 = (cos r, sin r, 0) → 유니티 (cos r, 0, sin r)
            foreach (float r in new[] { 0f, 0.5f, 1.5708f, 3.2944f, -1f })
            {
                Vector3 dir = Quaternion.Euler(0f, RegionLayout.YawFromBlender(r), 0f) * Vector3.right;
                Vector3 want = new Vector3(Mathf.Cos(r), 0f, Mathf.Sin(r));
                PlaytestKit.Check((dir - want).magnitude < 1e-4f, $"회전 r={r}: 유니티 +X 가 {dir} (기대 {want})");
            }
            // 렌즈 24mm 센서 36 → 가로 시야 73.7°
            float vf = RegionLayout.VerticalFov(24f, 1f);
            PlaytestKit.Check(Mathf.Abs(vf - 73.74f) < 0.1f, "시야각 계산이 다름: " + vf);
        }

        private static void ChecksMeshes()
        {
            // 구·뿔: 모든 면이 바깥을 본다(감는 방향 검증)
            var b = new MeshBuilder();
            b.AddBlob(Vector3.zero, 1f, Color.white, new System.Random(1), 0f);
            var blob = b.ToMesh("t");
            PlaytestKit.Check(blob.triangles.Length / 3 == 320, "잎덩이 삼각형 320 이 아님: " + blob.triangles.Length / 3);
            PlaytestKit.Check(AllOutward(blob, Vector3.zero), "잎덩이 면이 안쪽을 본다");
            var cb = new MeshBuilder();
            cb.AddCone(Vector3.zero, 0.5f, 2f, Vector2.zero, 6, Color.white);
            var cone = cb.ToMesh("c");
            PlaytestKit.Check(cone.triangles.Length / 3 == 12, "뿔 삼각형이 12 가 아님");
            PlaytestKit.Check(AllOutward(cone, new Vector3(0f, 0.6f, 0f), 0.0f, true), "뿔 면이 안쪽을 본다");

            // 지형: 구멍 없는 칸 수 = 면 수, 모든 면이 위에서 봐 앞면
            foreach (var id in RegionLoader.Ids)
            {
                var L = RegionLoader.LoadLayout(id);
                PlaytestKit.Check(L != null, "배치표 없음: " + id);
                if (L == null || L.terrain == null) continue;
                var T = L.terrain;
                int want = 0;
                for (int j = 0; j < T.nz - 1; j++)
                    for (int i = 0; i < T.nx - 1; i++)
                        if (!float.IsNaN(T.H(i, j)) && !float.IsNaN(T.H(i + 1, j)) && !float.IsNaN(T.H(i, j + 1)) && !float.IsNaN(T.H(i + 1, j + 1))) want++;
                var m = RegionMeshes.Terrain(T, out int quads);
                PlaytestKit.Check(quads == want && m.triangles.Length / 3 == want * 2, $"{id} 지형 면 수 {quads}/{want}");
                PlaytestKit.Check(AllUp(m), id + " 지형에 뒤집힌 면이 있다");
                // 구멍 한가운데는 높이를 못 읽는다, 구멍 아닌 곳은 읽는다
                bool anyHole = false, anyRead = false;
                for (int j = 0; j < T.nz - 1 && !(anyHole && anyRead); j++)
                    for (int i = 0; i < T.nx - 1; i++)
                    {
                        bool ok = T.SampleHeight(T.x0 + (i + 0.5f) * T.step, T.z0 + (j + 0.5f) * T.step, out _);
                        if (ok) anyRead = true; else anyHole = true;
                    }
                PlaytestKit.Check(anyRead, id + " 높이를 읽을 곳이 없다");
            }

            // 마을: 길·광장 면은 모두 위를 본다
            var village = RegionLoader.LoadLayout("Village");
            if (village != null)
            {
                foreach (var kv in RegionMeshes.Roads(village))
                    PlaytestKit.Check(AllUp(kv.Value), "길 " + kv.Key + " 에 뒤집힌 면이 있다");
                PlaytestKit.Check(AllUp(RegionMeshes.Plaza(village)), "광장에 뒤집힌 면이 있다");
            }
        }

        private static bool AllUp(Mesh m)
        {
            var v = m.vertices; var t = m.triangles;
            for (int k = 0; k < t.Length; k += 3)
                if (Vector3.Cross(v[t[k + 1]] - v[t[k]], v[t[k + 2]] - v[t[k]]).y <= 0f) return false;
            return true;
        }

        // 면 법선(cross)이 중심 바깥을 보는지. cone 이면 밑면(법선이 아래)도 허용한다.
        private static bool AllOutward(Mesh m, Vector3 center, float eps = 0f, bool cone = false)
        {
            var v = m.vertices; var t = m.triangles;
            for (int k = 0; k < t.Length; k += 3)
            {
                Vector3 n = Vector3.Cross(v[t[k + 1]] - v[t[k]], v[t[k + 2]] - v[t[k]]);
                Vector3 c = (v[t[k]] + v[t[k + 1]] + v[t[k + 2]]) / 3f - center;
                if (cone && Mathf.Abs(n.normalized.y + 1f) < 1e-3f) continue;   // 밑면: 아래를 본다
                if (cone) c.y = 0f;
                if (Vector3.Dot(n, c) <= eps) return false;
            }
            return true;
        }

        private static string _lastSummary;

        private static void ChecksRegion(string id)
        {
            var scene = EditorSceneManager.NewScene(NewSceneSetup.EmptyScene, NewSceneMode.Single);
            var L = RegionLoader.LoadLayout(id);
            PlaytestKit.Check(L != null, id + " 배치표 없음");
            if (L == null) return;

            // 배치표 수를 글자로 따로 세어 파싱 결과와 맞춘다
            string json = Resources.Load<TextAsset>("Regions/" + id + "/layout").text;
            int rawPieces = Regex.Matches(json, "\"piece\"").Count;
            PlaytestKit.Check(L.pieces.Count == rawPieces, $"{id} 조각 수 파싱 {L.pieces.Count} / 원본 {rawPieces}");
            int rawRoads = Regex.Matches(json, "\"mat\":\\s*\"").Count;
            PlaytestKit.Check(L.roads.Count == rawRoads, $"{id} 길 수 파싱 {L.roads.Count} / 원본 {rawRoads}");

            var res = RegionLoader.Build(id, null, new RegionLoadOptions { applyCamera = false });
            PlaytestKit.Check(res.root != null, id + " 조립 실패");
            if (res.root == null) return;

            PlaytestKit.Check(res.PiecePlacements + res.pieceMissing == L.pieces.Count, $"{id} 조각 합 {res.PiecePlacements}+{res.pieceMissing} != {L.pieces.Count}");
            PlaytestKit.Check(res.pieceMissing == 0, $"{id} 조각 에셋 {res.pieceMissing} 개 없음");
            int rootChildPieces = res.root.transform.Find("Pieces") == null ? 0 : res.root.transform.Find("Pieces").childCount;
            PlaytestKit.Check(rootChildPieces == res.pieceObjects, $"{id} 조각 오브젝트 {rootChildPieces} != {res.pieceObjects}");
            var inst = res.root.GetComponent<RegionInstancer>();
            PlaytestKit.Check((inst == null ? 0 : inst.InstanceCount) >= (res.pieceInstanced > 0 ? res.pieceInstanced : 0), id + " 인스턴스 수가 모자람");

            if (L.terrain != null) PlaytestKit.Check(res.terrainQuads > 0 && res.root.transform.Find("Terrain") != null, id + " 지형이 없다");
            if (L.scenery != null) PlaytestKit.Check(res.sceneryRenderers > 0, id + " 풍경 GLB 렌더러가 없다");
            else PlaytestKit.Check(L.roads.Count == 0 || res.roadMeshes > 0, id + " 길 메시가 없다");
            if (L.trees.Count > 0) PlaytestKit.Check(res.treeCount == L.trees.Count, id + " 나무 수");
            if (L.flowers.Count > 0) PlaytestKit.Check(res.flowerCount == L.flowers.Count, id + " 꽃 수");
            int pointLights = 0;
            foreach (var l in L.lights) if (!l.sun) pointLights++;
            PlaytestKit.Check(res.lightCount == pointLights, $"{id} 점광원 수 {res.lightCount} != {pointLights}");
            PlaytestKit.Check(res.activeLights <= 12, id + " 켜진 광원이 너무 많다: " + res.activeLights);
            PlaytestKit.Check(res.skyApplied, id + " 하늘이 안 붙었다");
            if (L.terrain != null && L.terrain.highTex != null)
            {
                var mr = res.root.transform.Find("Terrain").GetComponent<MeshRenderer>();
                PlaytestKit.Check(mr.sharedMaterial.GetFloat("_HasHigh") > 0.5f && mr.sharedMaterial.GetTexture("_HighMap") != null, id + " high 땅 그림이 안 붙었다");
            }
            foreach (var w in res.warnings)
                if (w.Contains("없음")) PlaytestKit.Fail(id + " 경고: " + w);

            // 모든 렌더러 재질이 툰·Unlit·(원본 반투명) 중 하나
            foreach (var r in res.root.GetComponentsInChildren<Renderer>(true))
            {
                if (r is ParticleSystemRenderer) continue;
                foreach (var m in r.sharedMaterials)
                {
                    PlaytestKit.Check(m != null && m.shader != null, id + " " + r.name + " 재질이 비었다");
                    if (m == null || m.shader == null) continue;
                    string sn = m.shader.name;
                    bool ok = sn == "Saga/CelToon" || sn == "Saga/RegionGround" || sn == "Saga/RegionSpark" || sn == "Universal Render Pipeline/Unlit" || RegionMaterials.IsTransparent(m);
                    PlaytestKit.Check(ok, $"{id} {r.name} 재질 {m.name} 의 셰이더 {sn} 가 툰 규칙 밖");
                }
            }

            string line = $"[Regions] 지역 {id}: 조각 {L.pieces.Count}(오브젝트 {res.pieceObjects} · 인스턴싱 {res.pieceInstanced}) 나무 {res.treeCount} 꽃 {res.flowerCount} 지형면 {res.terrainQuads} 길 {res.roadMeshes} " +
                          $"풍경렌더러 {res.sceneryRenderers} 광원 {res.lightCount}(켬 {res.activeLights}) 재질 툰{res.toonMats}/사실{res.litMats}/빛{res.glowMats}/원본{res.keptMats} 드로우콜추정 {res.drawCallsEstimate} 삼각형 {res.triangles} 안개 {(res.fogApplied ? "O" : "X")}";
            Debug.Log(line);
            if (id == "Village") _lastSummary = line;
            Object.DestroyImmediate(res.root);
            RenderSettings.skybox = null; RenderSettings.fog = false;
        }

        // R-5 코드 리뷰 지적 고침 확인 — 인스턴싱 꺼진 재질·안개 되돌리기·소유 자원 정리.
        private static void ChecksReview()
        {
            var scene = EditorSceneManager.NewScene(NewSceneSetup.EmptyScene, NewSceneMode.Single);
            var lit = Shader.Find("Universal Render Pipeline/Lit");
            if (lit != null)
            {
                var go = new GameObject("inst");
                var inst = go.AddComponent<RegionInstancer>();
                var mat = new Material(lit) { enableInstancing = false };
                var mesh = RegionMeshes.WaterPlane(1f);
                inst.Add(mesh, 0, mat, Matrix4x4.identity);
                inst.Add(mesh, 0, mat, Matrix4x4.Translate(Vector3.one));
                PlaytestKit.Check(inst.BatchCount == 1 && inst.InstanceCount == 2, "인스턴싱 꺼진 재질 묶음이 하나가 아님");
                PlaytestKit.Check(!mat.enableInstancing, "원본 재질을 고쳐 버림");
                Object.DestroyImmediate(go); Object.DestroyImmediate(mat); Object.DestroyImmediate(mesh);
            }

            // 안개가 있는 지역 다음에 없는 지역 — 안개가 남으면 안 된다
            var a = RegionLoader.Build("Crossroads");
            PlaytestKit.Check(RenderSettings.fog, "갈림길 안개가 안 켜짐");
            var groundMat = a.root.transform.Find("Terrain").GetComponent<MeshRenderer>().sharedMaterial;
            PlaytestKit.Check(a.owner != null && a.owner.Count > 0, "소유 자원이 비었다");
            Object.DestroyImmediate(a.root);
            PlaytestKit.Check(groundMat == null, "뿌리를 지워도 땅 재질이 남았다(새는 자원)");
            var b = RegionLoader.Build("Village");
            PlaytestKit.Check(!RenderSettings.fog, "마을이 앞 지역 안개를 물려받았다");
            var c = RegionLoader.Build("TimeRift");
            PlaytestKit.Check(!RenderSettings.fog, "시간 틈(짙은 안개 건너뜀)이 앞 지역 안개를 물려받았다");
            Object.DestroyImmediate(b.root); Object.DestroyImmediate(c.root);
            RenderSettings.skybox = null; RenderSettings.fog = false;
        }

        // 같은 입력이면 같은 모양 — 마을을 두 번 짜서 요약이 같은지.
        private static void ChecksDeterministic()
        {
            var first = _lastSummary;
            var scene = EditorSceneManager.NewScene(NewSceneSetup.EmptyScene, NewSceneMode.Single);
            var res = RegionLoader.Build("Village");
            string again = res.root == null ? "" : $"{res.pieceObjects}/{res.pieceInstanced}/{res.treeCount}/{res.flowerCount}/{res.terrainQuads}/{res.drawCallsEstimate}/{res.triangles}";
            var res2 = RegionLoader.Build("Village");
            string again2 = res2.root == null ? "" : $"{res2.pieceObjects}/{res2.pieceInstanced}/{res2.treeCount}/{res2.flowerCount}/{res2.terrainQuads}/{res2.drawCallsEstimate}/{res2.triangles}";
            PlaytestKit.Check(first != null && again == again2 && again.Length > 0, $"마을을 두 번 짠 결과가 다름: {again} / {again2}");
            if (res.root != null) Object.DestroyImmediate(res.root);
            if (res2.root != null) Object.DestroyImmediate(res2.root);
            RenderSettings.skybox = null; RenderSettings.fog = false;
        }
    }

    /// <summary>눈으로 보는 미리보기 — 새(저장 안 된) 장면에 지역 하나를 짜고 카메라를 배치표 구도에 놓는다. 시안 `tools/world-forge/_out/hero_<지역>_pbr.png` 와 나란히 본다. 장면을 저장하지 말 것.</summary>
    public static class RegionPreview
    {
        [MenuItem("Saga/Regions/Preview Village (do not save)")] public static void Village() => Open("Village");
        [MenuItem("Saga/Regions/Preview Galaxy Ferry (do not save)")] public static void GalaxyFerry() => Open("GalaxyFerry");
        [MenuItem("Saga/Regions/Preview Frost Peak (do not save)")] public static void FrostPeak() => Open("FrostPeak");
        [MenuItem("Saga/Regions/Preview Time Rift (do not save)")] public static void TimeRift() => Open("TimeRift");
        [MenuItem("Saga/Regions/Preview Crossroads (do not save)")] public static void Crossroads() => Open("Crossroads");

        public static void Open(string id)
        {
            RegionMaterialSetup.EnsureAll();
            var scene = EditorSceneManager.NewScene(NewSceneSetup.DefaultGameObjects, NewSceneMode.Single);
            var L = RegionLoader.LoadLayout(id);
            if (L == null) { Debug.LogError("[RegionPreview] 배치표 없음: " + id); return; }
            // 배치표에 해가 있으면 기본 방향광은 치운다
            bool hasSun = L.lights.Exists(l => l.sun);
            if (hasSun) foreach (var l in Object.FindObjectsByType<Light>(FindObjectsSortMode.None)) if (l.type == LightType.Directional) Object.DestroyImmediate(l.gameObject);
            var res = RegionLoader.Build(id, null, new RegionLoadOptions { applyCamera = true });
            var cam = Camera.main;
            if (cam != null) { cam.clearFlags = CameraClearFlags.Skybox; cam.farClipPlane = 600f; }
            Debug.Log($"[RegionPreview] {id}: 조각 {res.PiecePlacements}/{L.pieces.Count}, 드로우콜 추정 {res.drawCallsEstimate}, 삼각형 {res.triangles}" + (res.warnings.Count > 0 ? ", 경고 " + string.Join(" · ", res.warnings) : ""));
        }
    }
}
