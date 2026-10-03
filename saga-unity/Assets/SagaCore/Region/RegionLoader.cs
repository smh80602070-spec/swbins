using System.Collections.Generic;
using UnityEngine;
using UnityEngine.Rendering;

namespace Saga.Core.Region
{
    public sealed class RegionLoadOptions
    {
        public bool applySun = true;        // 배치표의 해(SUN)를 방향광 하나로
        public bool applySky = true;        // 하늘 파노라마를 RenderSettings.skybox 로
        public bool applyFog = true;        // 안개를 RenderSettings 에
        public bool applyCamera;            // 주 카메라를 배치표 구도로(미리보기용)
        public bool lights = true;
        public bool fx = true;
        public int maxLights = 12;          // 한꺼번에 켜는 점광원 수 — 모바일 발열
        public bool forceMobileSky;
        public Transform lightTarget;       // 광원 선택 기준(없으면 주 카메라)
    }

    public sealed class RegionLoadResult
    {
        public RegionLayout layout;
        public GameObject root;
        public int pieceObjects;            // 오브젝트로 놓은 조각(한 번만 나오는 종류)
        public int pieceInstanced;          // GPU 인스턴싱으로 놓은 조각(두 번 이상 나오는 종류)
        public int pieceMissing;            // 에셋을 못 찾은 조각
        public int treeCount, flowerCount, lightCount, activeLights;
        public int roadMeshes, terrainQuads;
        public int sceneryRenderers;
        public int toonMats, glowMats, keptMats;
        public int drawCallsEstimate;       // (렌더러 × 칸) + 인스턴싱 호출 + 입자 — SRP Batcher 가 묶기 전 추정
        public long triangles;
        public bool skyApplied, fogApplied;
        public string skyUsed;
        public readonly List<string> warnings = new List<string>();
        public RegionResources owner;       // 뿌리가 지워질 때 같이 지울 메시·재질·그림

        public int PiecePlacements => pieceObjects + pieceInstanced;
    }

    /// <summary>지역 배치표(layout.json)로 지역을 짠다(tasks U-0023). 로더는 하나, 지역은 데이터 — 마을·은하 나루·서리봉·시간 틈·갈림길 다섯.
    /// 에셋은 `Resources/Regions/` 의 K-0051 산출물을 읽기만 한다. 좌표 규칙은 <see cref="RegionLayout"/>.</summary>
    public static class RegionLoader
    {
        public static readonly string[] Ids = { "Village", "GalaxyFerry", "FrostPeak", "TimeRift", "Crossroads" };

        private const float MaxPointLightRange = 36f;
        private const float MinPointLightRange = 3f;

        public static RegionLayout LoadLayout(string id)
        {
            var ta = Resources.Load<TextAsset>("Regions/" + id + "/layout");
            return ta == null ? null : RegionLayout.Parse(id, ta.text);
        }

        public static RegionLoadResult Build(string id, Transform parent = null, RegionLoadOptions opt = null)
        {
            opt = opt ?? new RegionLoadOptions();
            var res = new RegionLoadResult();
            var layout = LoadLayout(id);
            if (layout == null) { res.warnings.Add("배치표를 못 찾음: Regions/" + id + "/layout"); return res; }
            res.layout = layout;

            var root = new GameObject("Region_" + id);
            if (parent != null) root.transform.SetParent(parent, false);
            res.root = root;
            res.owner = root.AddComponent<RegionResources>();
            var matCache = new Dictionary<Material, Material>();

            BuildTerrain(layout, root.transform, res);
            if (layout.scenery == null) BuildRoadsAndPlaza(layout, root.transform, res);   // 풍경 GLB 가 있으면 길은 그 안에 구워져 있다
            BuildTreesAndFlowers(layout, root.transform, res);
            BuildPieces(layout, root.transform, res, matCache);
            BuildScenery(layout, root.transform, res, matCache);
            foreach (var kv in matCache) if (kv.Value != null && kv.Value != kv.Key) res.owner.Own(kv.Value);   // 바꿔 만든 재질만 — 원본은 에셋
            BuildWater(layout, root.transform, res);
            BuildGate(layout, root.transform, res);
            if (opt.fx) BuildFx(layout, root.transform, res);
            if (opt.lights) BuildLights(layout, root.transform, res, opt);
            if (opt.applySky) ApplySky(layout, res, opt);
            if (opt.applyFog) ApplyFog(layout, res);
            if (opt.applyCamera) ApplyCamera(layout);
            return res;
        }

        // ---------------------------------------------------------------- 지형
        private static void BuildTerrain(RegionLayout L, Transform parent, RegionLoadResult res)
        {
            var T = L.terrain;
            if (T == null) return;
            var mesh = RegionMeshes.Terrain(T, out int quads);
            res.terrainQuads = quads;
            var mat = RegionMaterials.Make("Ground");
            if (mat == null) { res.warnings.Add("땅 재질 없음"); return; }
            var low = LoadTex(L.id, T.lowTex);
            if (low != null) mat.SetTexture("_BaseMap", low); else res.warnings.Add("땅 그림 없음: " + T.lowTex);
            if (T.highTex != null)
            {
                var high = LoadTex(L.id, T.highTex);
                if (high != null) { mat.SetTexture("_HighMap", high); mat.SetFloat("_HasHigh", 1f); }
                else res.warnings.Add("땅 그림 없음: " + T.highTex);
            }
            mat.SetColor("_TintLow", T.tintLow.gamma); mat.SetColor("_TintHigh", T.tintHigh.gamma);
            mat.SetFloat("_SatLow", T.satLow); mat.SetFloat("_SatHigh", T.satHigh);
            mat.SetFloat("_TileLow", T.tileLow); mat.SetFloat("_TileHigh", T.tileHigh);
            mat.SetFloat("_HeightZ0", T.heightZ0); mat.SetFloat("_HeightZ1", T.heightZ1);
            mat.SetFloat("_Slope0", T.slope0); mat.SetFloat("_Slope1", T.slope1);
            AddMesh(parent, "Terrain", mesh, mat, res);
        }

        // ---------------------------------------------------------------- 마을: 길·광장
        private static void BuildRoadsAndPlaza(RegionLayout L, Transform parent, RegionLoadResult res)
        {
            if (L.roads.Count > 0)
            {
                foreach (var kv in RegionMeshes.Roads(L))
                {
                    string texPath = kv.Key == "dirt" ? "tex/road_dirt.jpg" : kv.Key == "asphalt" ? "tex/road_asphalt.jpg" : null;
                    Texture tex = texPath == null ? null : LoadTex(L.id, texPath);
                    if (tex == null) res.warnings.Add("길 그림 없음: " + kv.Key);
                    AddMesh(parent, "Road_" + kv.Key, kv.Value, RegionMaterials.Toon(tex, tex == null ? new Color(0.2f, 0.15f, 0.1f) : Color.white), res);
                    res.roadMeshes++;
                }
            }
            if (L.hasPlaza)
            {
                var tex = LoadTex(L.id, "tex/plaza_cobble.jpg");
                if (tex == null) res.warnings.Add("광장 그림 없음");
                AddMesh(parent, "Plaza", RegionMeshes.Plaza(L), RegionMaterials.Toon(tex, tex == null ? Color.gray : Color.white), res);
            }
        }

        // ---------------------------------------------------------------- 마을: 나무·꽃(코드 메시, 색별 한 장)
        private static void BuildTreesAndFlowers(RegionLayout L, Transform parent, RegionLoadResult res)
        {
            if (L.trees.Count > 0)
            {
                RegionMeshes.Trees(L.trees, out var trunks, out var leaves);
                var vm = RegionMaterials.Make("ToonVertex");
                AddMesh(parent, "TreeTrunks", trunks, vm, res);
                for (int i = 0; i < leaves.Length; i++) if (leaves[i].vertexCount > 0) AddMesh(parent, "TreeLeaves" + i, leaves[i], vm, res);
                res.treeCount = L.trees.Count;
            }
            if (L.flowers.Count > 0)
            {
                var vm = RegionMaterials.Make("ToonVertex");
                var fl = RegionMeshes.Flowers(L);
                for (int i = 0; i < fl.Length; i++) if (fl[i].vertexCount > 0) AddMesh(parent, "Flowers" + i, fl[i], vm, res);
                res.flowerCount = L.flowers.Count;
            }
        }

        // ---------------------------------------------------------------- 조각(GLB)
        private sealed class Part
        {
            public Mesh mesh;
            public Matrix4x4 local;        // 조각 뿌리 기준
            public Material[] mats;        // 칸마다(툰으로 바꾼 것)
        }

        private static void BuildPieces(RegionLayout L, Transform parent, RegionLoadResult res, Dictionary<Material, Material> matCache)
        {
            if (L.pieces.Count == 0) return;
            var counts = new Dictionary<string, int>();
            foreach (var p in L.pieces) counts[p.piece] = counts.TryGetValue(p.piece, out int c) ? c + 1 : 1;

            var prefabs = new Dictionary<string, GameObject>();
            var parts = new Dictionary<string, List<Part>>();
            RegionInstancer instancer = null;
            var cull = PieceBounds(L);
            var piecesRoot = new GameObject("Pieces").transform;
            piecesRoot.SetParent(parent, false);

            foreach (var p in L.pieces)
            {
                if (!prefabs.TryGetValue(p.piece, out var prefab))
                {
                    prefab = Resources.Load<GameObject>("Regions/Pieces/" + p.piece);
                    prefabs[p.piece] = prefab;
                    if (prefab == null) res.warnings.Add("조각 에셋 없음: " + p.piece);
                    else parts[p.piece] = ReadParts(prefab, matCache, res);
                }
                if (prefab == null) { res.pieceMissing++; continue; }

                var rot = Quaternion.Euler(0f, p.yawDeg, 0f);
                // 뼈대가 있는 조각은 인스턴싱으로 못 그린다(오브젝트 경로만 뼈를 움직인다)
                if (counts[p.piece] >= 2 && prefab.GetComponentInChildren<SkinnedMeshRenderer>(true) == null)
                {
                    if (instancer == null)
                    {
                        instancer = parent.gameObject.AddComponent<RegionInstancer>();
                        instancer.SetBounds(cull);
                    }
                    var place = Matrix4x4.TRS(p.pos, rot, Vector3.one * p.scale);
                    foreach (var part in parts[p.piece])
                        for (int s = 0; s < part.mats.Length; s++)
                            instancer.Add(part.mesh, s, part.mats[s], place * part.local);
                    res.pieceInstanced++;
                }
                else
                {
                    var go = Object.Instantiate(prefab, piecesRoot);
                    go.name = p.piece;
                    go.transform.localPosition = p.pos; go.transform.localRotation = rot; go.transform.localScale = Vector3.one * p.scale;
                    foreach (var r in go.GetComponentsInChildren<Renderer>(true)) SwapMaterials(r, matCache, res);
                    res.pieceObjects++;
                    CountRenderer(go, res);
                }
            }
            if (instancer != null)
            {
                res.drawCallsEstimate += instancer.DrawCalls;
                res.triangles += instancer.Triangles;
            }
        }

        // 조각 위치에서 구한 걸러내기 상자 — 가장자리에 여유(조각 크기·키)를 둔다.
        private static Bounds PieceBounds(RegionLayout L)
        {
            if (L.pieces.Count == 0) return new Bounds(Vector3.zero, new Vector3(100f, 50f, 100f));
            Vector3 lo = L.pieces[0].pos, hi = lo;
            foreach (var p in L.pieces) { lo = Vector3.Min(lo, p.pos); hi = Vector3.Max(hi, p.pos); }
            var b = new Bounds();
            b.SetMinMax(lo - new Vector3(30f, 10f, 30f), hi + new Vector3(30f, 40f, 30f));
            return b;
        }

        private static List<Part> ReadParts(GameObject prefab, Dictionary<Material, Material> cache, RegionLoadResult res)
        {
            var list = new List<Part>();
            var inv = prefab.transform.worldToLocalMatrix;
            foreach (var mf in prefab.GetComponentsInChildren<MeshFilter>(true))
            {
                var mr = mf.GetComponent<MeshRenderer>();
                var mesh = mf.sharedMesh;
                if (mr == null || mesh == null) continue;
                var src = mr.sharedMaterials;
                var made = new Material[mesh.subMeshCount];
                for (int s = 0; s < made.Length; s++)
                    made[s] = src.Length == 0 ? null : FromGltfCounted(src[Mathf.Min(s, src.Length - 1)], cache, res);
                list.Add(new Part { mesh = mesh, local = inv * mf.transform.localToWorldMatrix, mats = made });
            }
            return list;
        }

        // ---------------------------------------------------------------- 풍경 GLB
        private static void BuildScenery(RegionLayout L, Transform parent, RegionLoadResult res, Dictionary<Material, Material> matCache)
        {
            if (string.IsNullOrEmpty(L.scenery)) return;
            string name = System.IO.Path.GetFileNameWithoutExtension(L.scenery);
            var prefab = Resources.Load<GameObject>("Regions/" + L.id + "/" + name);
            if (prefab == null) { res.warnings.Add("풍경 에셋 없음: " + L.scenery); return; }
            var go = Object.Instantiate(prefab, parent);
            go.name = "Scenery";
            go.transform.localPosition = Vector3.zero; go.transform.localRotation = Quaternion.identity; go.transform.localScale = Vector3.one;
            foreach (var r in go.GetComponentsInChildren<Renderer>(true)) { SwapMaterials(r, matCache, res); res.sceneryRenderers++; }
            CountRenderer(go, res);
        }

        // ---------------------------------------------------------------- 물·문·효과
        private static void BuildWater(RegionLayout L, Transform parent, RegionLoadResult res)
        {
            if (!L.hasWater) return;
            var go = AddMesh(parent, "Water", RegionMeshes.WaterPlane(L.waterSize), RegionMaterials.Toon(null, L.waterColor), res);
            go.transform.localPosition = new Vector3(0f, L.waterY, 0f);
        }

        private static void BuildGate(RegionLayout L, Transform parent, RegionLoadResult res)
        {
            if (!L.hasGate) return;
            var mat = RegionMaterials.Make("SparkAdd");
            if (mat == null) return;
            var swirl = RegionFx.Swirl(L.gateColor0, L.gateColor1);
            res.owner.Own(swirl);
            mat.SetTexture("_MainTex", swirl);
            mat.SetColor("_Tint", new Color(1f, 1f, 1f, 0.45f));
            var go = AddMesh(parent, "Gate", RegionMeshes.Disc(L.gateRadius), mat, res);
            go.transform.localPosition = L.gateCenter;
        }

        private static void BuildFx(RegionLayout L, Transform parent, RegionLoadResult res)
        {
            if (L.fireflies.on) { OwnFxMaterial(RegionFx.Fireflies(parent, L.fireflies), res); res.drawCallsEstimate++; }
            if (L.snowfall.on) { OwnFxMaterial(RegionFx.Snow(parent, L.snowfall), res); res.drawCallsEstimate++; }
        }

        private static void OwnFxMaterial(GameObject fx, RegionLoadResult res)
        {
            var r = fx.GetComponent<ParticleSystemRenderer>();
            if (r != null) res.owner.Own(r.sharedMaterial);
        }

        // ---------------------------------------------------------------- 빛
        private static void BuildLights(RegionLayout L, Transform parent, RegionLoadResult res, RegionLoadOptions opt)
        {
            var group = new GameObject("Lights").transform;
            group.SetParent(parent, false);
            var points = new List<Light>();
            int n = 0;
            foreach (var spec in L.lights)
            {
                if (spec.sun)
                {
                    if (!opt.applySun) continue;
                    var sgo = new GameObject("Sun");
                    sgo.transform.SetParent(group, false);
                    sgo.transform.rotation = Quaternion.LookRotation(spec.dir);
                    var sun = sgo.AddComponent<Light>();
                    sun.type = LightType.Directional; sun.color = spec.color.gamma;
                    sun.intensity = Mathf.Clamp(spec.energy * 0.4f, 0.3f, 2f);
                    sun.shadows = LightShadows.Soft;
                    continue;
                }
                var go = new GameObject("Point" + n++);
                go.transform.SetParent(group, false);
                go.transform.localPosition = spec.pos;
                var l = go.AddComponent<Light>();
                l.type = LightType.Point; l.color = spec.color.gamma;
                // Blender 와트 → 유니티: 세기는 와트에 비례하되 제한, 범위는 제곱근에 비례(값은 시안 대조로 손볼 시작점)
                l.intensity = Mathf.Clamp(spec.energy / 80f, 0.5f, 4f);
                l.range = Mathf.Clamp(Mathf.Sqrt(spec.energy) * 0.55f, MinPointLightRange, MaxPointLightRange);
                l.shadows = LightShadows.None;
                l.enabled = false;
                points.Add(l);
            }
            res.lightCount = points.Count;
            if (points.Count > 0)
            {
                var pool = group.gameObject.AddComponent<RegionLightPool>();
                pool.maxActive = opt.maxLights; pool.target = opt.lightTarget;
                pool.Setup(points);
                res.activeLights = pool.ActiveCount;
            }
        }

        // ---------------------------------------------------------------- 하늘·안개·카메라
        private static void ApplySky(RegionLayout L, RegionLoadResult res, RegionLoadOptions opt)
        {
            RenderSettings.skybox = null;     // 이 지역에 하늘 그림이 없으면 앞 지역 하늘을 물려받지 않는다
            bool mobile = opt.forceMobileSky || Application.isMobilePlatform;
            string file = mobile ? (L.skyMobile ?? L.skyFull) : (L.skyFull ?? L.skyMobile);
            if (string.IsNullOrEmpty(file)) return;
            var tex = LoadTex(L.id, file);
            if (tex == null) { res.warnings.Add("하늘 그림 없음: " + file); return; }
            var mat = RegionMaterials.Make("Sky");
            if (mat == null) return;
            mat.SetTexture("_MainTex", tex);
            // 그림 한가운데(앞쪽)가 Blender +y = Unity +z 를 보게: Skybox/Panoramic 은 기본으로 +x 를 보므로 270°.
            mat.SetFloat("_Mapping", 1f); mat.SetFloat("_ImageType", 0f); mat.SetFloat("_Rotation", 270f);
            RenderSettings.skybox = mat;
            if (Application.isPlaying) DynamicGI.UpdateEnvironment();
            res.skyApplied = true; res.skyUsed = file;
        }

        // Blender 의 안개는 상자 안 부피(density = 미터당 흡수). 전역 지수 안개와 같은 식(exp(-d·거리))이지만 상자 밖은 비어 있다 —
        // 얇은 층(≤0.012)만 전역으로 근사하고, 짙은 층(시간 틈 구름바다 0.035)은 풍경 GLB 의 구름 메시에 맡긴다.
        private static void ApplyFog(RegionLayout L, RegionLoadResult res)
        {
            RenderSettings.fog = false;       // 안개 없는 지역·건너뛴 지역이 앞 지역 안개를 물려받지 않는다
            if (!L.hasFog) return;
            if (L.fogDensity > 0.012f) { res.warnings.Add("안개 " + L.fogDensity + " 는 짙은 부피라 전역 안개를 건너뜀(구름 메시가 대신)"); return; }
            RenderSettings.fog = true;
            RenderSettings.fogMode = FogMode.Exponential;
            RenderSettings.fogDensity = L.fogDensity;
            RenderSettings.fogColor = L.fogColor.gamma;
            res.fogApplied = true;
        }

        private static void ApplyCamera(RegionLayout L)
        {
            var cam = Camera.main;
            if (cam == null || !L.hasCamera) return;
            cam.transform.position = L.cameraPos;
            cam.transform.rotation = Quaternion.LookRotation((L.cameraLook - L.cameraPos).normalized, Vector3.up);
            cam.fieldOfView = RegionLayout.VerticalFov(L.cameraLens, cam.aspect);
        }

        // ---------------------------------------------------------------- 도우미
        private static Texture2D LoadTex(string regionId, string relativePath)
        {
            if (string.IsNullOrEmpty(relativePath)) return null;
            string noExt = System.IO.Path.ChangeExtension(relativePath, null).Replace('\\', '/');
            return Resources.Load<Texture2D>("Regions/" + regionId + "/" + noExt);
        }

        private static GameObject AddMesh(Transform parent, string name, Mesh mesh, Material mat, RegionLoadResult res)
        {
            res.owner.Own(mesh); res.owner.Own(mat);
            var go = new GameObject(name);
            go.transform.SetParent(parent, false);
            go.AddComponent<MeshFilter>().sharedMesh = mesh;
            var r = go.AddComponent<MeshRenderer>();
            r.sharedMaterial = mat;
            res.drawCallsEstimate += 1;
            res.triangles += mesh.GetIndexCount(0) / 3;
            return go;
        }

        private static Material FromGltfCounted(Material src, Dictionary<Material, Material> cache, RegionLoadResult res)
        {
            bool known = src != null && cache.ContainsKey(src);
            var made = RegionMaterials.FromGltf(src, cache, out var kind);
            if (!known && src != null)
            {
                if (kind == RegionMaterials.Kind.Toon) res.toonMats++;
                else if (kind == RegionMaterials.Kind.Emissive) res.glowMats++;
                else res.keptMats++;
            }
            return made;
        }

        private static void SwapMaterials(Renderer r, Dictionary<Material, Material> cache, RegionLoadResult res)
        {
            if (r is ParticleSystemRenderer || r is TrailRenderer || r is LineRenderer) return;
            var mats = r.sharedMaterials;
            for (int i = 0; i < mats.Length; i++) mats[i] = FromGltfCounted(mats[i], cache, res);
            r.sharedMaterials = mats;
        }

        private static void CountRenderer(GameObject go, RegionLoadResult res)
        {
            foreach (var mf in go.GetComponentsInChildren<MeshFilter>(true))
            {
                var mesh = mf.sharedMesh;
                if (mesh == null) continue;
                var r = mf.GetComponent<Renderer>();
                int subs = r != null ? Mathf.Min(mesh.subMeshCount, r.sharedMaterials.Length) : 1;
                for (int s = 0; s < subs; s++) { res.drawCallsEstimate++; res.triangles += mesh.GetIndexCount(s) / 3; }
            }
        }
    }
}
