using System.Collections.Generic;
using UnityEngine;
using UnityEngine.Rendering;
using Saga.Core;
using Saga.Core.Region;
using Saga.Go.Data;

namespace Saga.Go.World
{
    /// <summary>
    /// PLAN.md 28~31장 — Vegetation/Rock 배치. saga-godot의 vegetation_builder.gd와
    /// 같은 원칙("자리는 시각의 순수 함수다"): 매 프레임 새로 뽑지 않고, 격자
    /// 좌표에서 결정적으로 해시해 늘 같은 자리에 같은 나무·바위가 선다.
    ///
    /// 2026-09-12 GLB 도입(PLAN.md 8장) — Kenney Nature Kit(CC0, saga-godot
    /// 트랙과 같은 파일, docs/ASSET_GUIDE.md 참고) tree_oak·rock_largeA·
    /// rock_smallA를 나무 한 그루/바위 하나씩 그대로 인스턴스화하던 첫
    /// 버전. TerrainBuilder처럼 하나의 결합 메시로 안 묶는 이유 — Unity의
    /// StaticBatchingUtility.Combine()(GameBootstrap.cs, PLAN.md 76장)이
    /// 이미 static MeshRenderer들을 같은 머티리얼끼리 자동으로 묶어 주므로,
    /// 직접 정점을 베이크하는 것보다 표준적이고 UV·텍스처도 그대로 산다.
    ///
    /// 2026-09-21 procgen 교체(PLAN.md 102-4·103-1) — Kenney 단일
    /// 모델 하나 대신 `tools/asset-forge/procgen.py`가 찍은 나무 12벌·
    /// 바위 10벌(`Assets/Art/Generated/SagaGo/`) 풀에서 타일 좌표로
    /// 결정적으로 골라 심는다. 그 GLB엔 UV가 없어(트라이플레이너 재질,
    /// `Saga/VertexColorTriplanarLit`) 대신 정점색(몸통 갈색·수관 초록·
    /// 바위 회색)을 바탕으로 쓴다. GLB 풀이 비어 있으면(다른 PC 등) 예전
    /// 결합 메시 방식으로 대체한다.
    ///
    /// 2026-09-24 식생 바이옴(PLAN.md 107-3) — 숲 칸마다 그 지역(`GoWorldMap.RegionAt`)의 `Vegetation` 표로
    /// 나무 수·수관 모양(활엽·침엽·버드나무류)·크기·잎 빛깔(`_CanopyTint`, 지역마다 재질 한 벌)을 고르고,
    /// 들·숲 칸엔 풀 포기, 강 북쪽 둑엔 갈대를 깐다(풀·갈대는 procgen `grass_s*`·`reed_s*`, 충돌 없음).
    /// 칸마다 앞 세 그루는 옛 자리 그대로(해시 salt 불변) — 늘어난 나무는 상자·역참·무리 자리를 비킨다.
    /// </summary>
    public class VegetationBuilder : MonoBehaviour
    {
        private const int RocksPerMountainTile = 1;
        /// <summary>옛 판의 칸당 나무 수 — 이 수 안쪽은 옛 자리 그대로, 넘치는 나무만 요지를 비킨다.</summary>
        public const int LegacyTreesPerTile = 3;
        /// <summary>늘어난 나무가 비키는 거리(상자·역참·들판 무리 한가운데·수호장).</summary>
        public const float ExtraTreeClearance = 8f;
        /// <summary>풀 포기가 비키는 거리(상자·역참 — 풀이 뚫고 나오지 않게).</summary>
        public const float GrassClearance = 3.5f;
        public const int ReedsPerBankTile = 7;
        private const float GrassScaleMin = 0.8f, GrassScaleMax = 1.25f;
        private const float ReedScaleMin = 1.1f, ReedScaleMax = 1.5f;

        /// <summary>`treeModels[i]`(= procgen 씨앗 i+1) 수관 모양 — procgen.py `make_tree` 가 씨앗 난수 아홉째 값으로
        /// 고르는 것을 같은 난수열로 미리 셈(1·2 침엽, 3·4·6·11 버드나무류, 나머지 활엽). GLB 꼭짓점 수로도 확인.</summary>
        public static readonly GoWorldMap.TreeForm[] TreeFormBySeed =
        {
            GoWorldMap.TreeForm.Conifer, GoWorldMap.TreeForm.Conifer, GoWorldMap.TreeForm.Willow, GoWorldMap.TreeForm.Willow,
            GoWorldMap.TreeForm.Broadleaf, GoWorldMap.TreeForm.Willow, GoWorldMap.TreeForm.Broadleaf, GoWorldMap.TreeForm.Broadleaf,
            GoWorldMap.TreeForm.Broadleaf, GoWorldMap.TreeForm.Broadleaf, GoWorldMap.TreeForm.Willow, GoWorldMap.TreeForm.Broadleaf,
        };

        // ---- 통일 세트(tasks U-0141 — `Resources/World`, 자체툴 K-0052·0058) ----
        // 있으면 procgen 대신 쓴다(없는 PC 는 아래 procgen → 결합 메시 순으로 폴백). 자리·수·크기 변주·몸통 충돌은 그대로.

        /// <summary>통일 세트 나무와 수관 모양 — 자작나무는 버드나무류 자리(가늘고 성긴 잎).</summary>
        public static readonly (string name, GoWorldMap.TreeForm form)[] UnifiedTrees =
        {
            ("tree_broadleaf_01", GoWorldMap.TreeForm.Broadleaf), ("tree_broadleaf_02", GoWorldMap.TreeForm.Broadleaf),
            ("tree_broadleaf_03", GoWorldMap.TreeForm.Broadleaf), ("tree_pine_01", GoWorldMap.TreeForm.Conifer),
            ("tree_pine_02", GoWorldMap.TreeForm.Conifer), ("tree_pine_03", GoWorldMap.TreeForm.Conifer),
            ("tree_birch_01", GoWorldMap.TreeForm.Willow),
        };
        public static readonly string[] UnifiedRocks = { "rock_large_01", "rock_large_02", "rock_moss_01" };
        public static readonly string[] UnifiedGrass = { "grass_tuft_01", "grass_tuft_02" };
        public static readonly string[] UnifiedReeds = { "reed_clump_01" };
        /// <summary>단풍 판(`<이름>_autumn`)을 쓰는 지역 — 수관 빛깔이 붉은 쪽(호박빛)인 곳.</summary>
        public static bool WantsAutumn(Color tint) => tint.a > 0f && tint.r > tint.g;
        // 통일 세트 나무는 5.6~8.3m(procgen 3.4~5m) — 숲 높이가 옛 판과 비슷하게(×s 변주 그대로).
        private const float UnifiedTreeScale = 0.7f;
        private const float UnifiedRockScale = 1.0f;   // 2.4~4m 폭 × 0.7~1.5(옛 procgen 2.6 배 ≈ 2~4.4m)
        private const float UnifiedGrassScale = 1.4f;  // 풀 포기 0.4m 폭 → 옛 procgen 0.7m 쯤
        private const float UnifiedReedScale = 0.85f;  // 1.7m → 옛 1.5m

        // procgen.py 기본 치수(trunk_height=3.0m)가 이미 TrunkHeight와 맞춰
        // 나온 "실제 미터" 치수라 배율은 1이면 된다(Kenney tree_oak.glb는
        // 0.64×1.23×0.74 짜리 축소 모델이라 4.5배가 필요했던 것과 다르다).
        // 나무마다 s(0.7~1.3)를 곱해 크기 변주를 준다(기존 방식 유지).
        private const float GeneratedTreeScale = 1.0f;
        // 바위도 procgen 반지름(0.5m) 기준 — 예전 Kenney 배율(2.6)과 비슷한
        // 눈대중으로 시작, 실기 확인 후 조정(PLAN.md 102-4 "실기 확인 대기").
        private const float GeneratedRockScale = 2.6f;

        // 트렁크 충돌은 시각과 분리 — 실제 나무 메시가 어디까지 트렁크인지
        // 몰라도 기존과 같은 크기의 캡슐로 막는다(걷는 느낌을 안 바꾼다).
        private const float TrunkRadius = 0.4f;
        private const float TrunkHeight = 3.0f;

        // ---- GLB 폴백(fallback) primitive 크기 — 예전 결합 메시 시절 그대로 ----
        private const float FallbackCanopyRadius = 2.2f;
        private const float FallbackRockRadius = 1.4f;
        private static readonly Color TrunkColor = new Color(0.32f, 0.21f, 0.12f);
        private static readonly Color CanopyColor = new Color(0.12f, 0.30f, 0.11f);
        private static readonly Color RockColor = new Color(0.5f, 0.48f, 0.46f);

        // 편집기 빌드 스크립트가 Init()으로 채워 준다 — NpcBuilder.cs와 같은
        // 이유(런타임 Awake()는 AssetDatabase를 못 쓴다).
        [SerializeField] private GameObject[] treeModels;
        [SerializeField] private GameObject[] rockModels;
        [SerializeField] private Material treeMaterial;
        [SerializeField] private Material rockMaterial;
        [SerializeField] private GameObject[] grassModels;
        [SerializeField] private GameObject[] reedModels;

        private readonly Dictionary<string, Material> _regionMaterials = new Dictionary<string, Material>();

        public void Init(GameObject[] trees, GameObject[] rocks, Material treeMat, Material rockMat)
        {
            treeModels = trees;
            rockModels = rocks;
            treeMaterial = treeMat;
            rockMaterial = rockMat;
        }

        /// <summary>107-3 식생 바이옴 — 풀·갈대 모델(없으면 안 깐다).</summary>
        public void InitGroundCover(GameObject[] grass, GameObject[] reeds)
        {
            grassModels = grass;
            reedModels = reeds;
        }

        private void Awake()
        {
            // 이미 저장된 씬을 실제 Play로 열면 Awake가 다시 불려 Build()를
            // 또 돌리는데, 편집기 빌드 스크립트가 이미 자식들을 만들어 둔
            // 뒤라 그대로 두면 나무·바위가 두 벌씩 겹쳐 생긴다 —
            // NpcBuilder.cs와 같은 방어(2026-09-12 GLB 교체 때 같이 발견).
            if (transform.childCount > 0) { RegisterGrassWind(); return; }
            Build();
            RegisterGrassWind();
        }

        /// <summary>tasks U-0216 — 풀 포기 재질을 흔들림 사본(`Saga/GrassSway`)으로 바꿔 끼우고 <see cref="Saga.Core.GrassWind"/> 에 등록(Play 때 Awake ·
        /// 진단은 직접). 높이 맞춤은 원본 GLB 메시(정적 배칭 뒤 렌더러 메시는 합친 것이라) — 통일 세트 이름(`grass_tuft_*`)으로 찾는다. 바꾼 재질 수.</summary>
        public int RegisterGrassWind()
        {
            var grass = transform.Find("Grass");
            if (grass == null) return 0;
            int n = 0;
            foreach (var r in grass.GetComponentsInChildren<MeshRenderer>(true))
            {
                Mesh src = null;
                for (var t = r.transform; t != null && t != grass && src == null; t = t.parent)
                {
                    if (System.Array.IndexOf(UnifiedGrass, t.name) < 0) continue;
                    var prefab = WorldModels.Load(t.name);
                    var mf = prefab != null ? prefab.GetComponentInChildren<MeshFilter>(true) : null;
                    src = mf != null ? mf.sharedMesh : null;
                }
                if (src == null && !r.isPartOfStaticBatch) { var own = r.GetComponent<MeshFilter>(); src = own != null ? own.sharedMesh : null; }
                n += Saga.Core.GrassWind.Own(r, src, r.transform.lossyScale.y);
            }
            return n;
        }

        public void Build()
        {
            BuildTrees();
            BuildRocks();
            BuildGrass();
            BuildReeds();
            MarkStatic();
        }

        // ---- 식생 바이옴 ---------------------------------------------------

        /// <summary>지역마다 재질 한 벌 — 나무 재질을 복제해 `_CanopyTint` 만 바꾼다(같은 지역끼리 정적 배칭이 묶인다).
        /// 편집기 빌드에서 만든 재질은 씬에 함께 저장된다. 나무 재질이 없으면(다른 PC) null.</summary>
        public Material RegionMaterial(string regionId)
        {
            if (treeMaterial == null) return null;
            if (_regionMaterials.TryGetValue(regionId, out var m) && m != null) return m;
            var veg = GoWorldMap.VegetationOf(regionId);
            if (veg.CanopyTint.a <= 0f) { _regionMaterials[regionId] = treeMaterial; return treeMaterial; }
            m = new Material(treeMaterial) { name = treeMaterial.name + "_" + regionId };
            m.SetColor("_CanopyTint", veg.CanopyTint);
            _regionMaterials[regionId] = m;
            return m;
        }

        /// <summary>늘어난 나무·풀이 비키는 요지 — 보물 상자·역참·들판 무리 한가운데·망루 수호장.</summary>
        public static List<Vector3> KeyPoints()
        {
            var list = new List<Vector3>();
            foreach (var c in GoTreasure.Chests) list.Add(TestMapData.WorldPos(c.Gx, c.Gy));
            foreach (var w in GoWorldMap.Waypoints) list.Add(TestMapData.WorldPos(w.Gx, w.Gy));
            foreach (var g in Saga.Go.Combat.FieldSpawner.GroupCenters()) list.Add(g);
            list.Add(TestMapData.WorldPos(Saga.Go.Combat.FieldSpawner.GuardianGx, Saga.Go.Combat.FieldSpawner.GuardianGy));
            return list;
        }

        private static bool NearAny(Vector3 p, List<Vector3> points, float radius)
        {
            foreach (var q in points)
            {
                float dx = p.x - q.x, dz = p.z - q.z;
                if (dx * dx + dz * dz < radius * radius) return true;
            }
            return false;
        }

        /// <summary>그 지역 모양에 맞는 나무 모델 번호들 — 모델 수가 표와 다르거나 맞는 게 없으면 전부.</summary>
        private List<int> TreeCandidates(GoWorldMap.TreeForm forms)
        {
            var list = new List<int>();
            if (treeModels.Length == TreeFormBySeed.Length)
                for (int i = 0; i < treeModels.Length; i++)
                    if ((forms & TreeFormBySeed[i]) != 0 && treeModels[i] != null) list.Add(i);
            if (list.Count == 0)
                for (int i = 0; i < treeModels.Length; i++) if (treeModels[i] != null) list.Add(i);
            return list;
        }

        /// <summary>PLAN.md 76장 Mobile Performance Pass — 나무·바위는 절대
        /// 안 움직이니 정적 배칭·오클루전 컬링 대상으로 표시한다.</summary>
        private void MarkStatic()
        {
            foreach (Transform t in GetComponentsInChildren<Transform>(true))
            {
                t.gameObject.isStatic = true;
            }
        }

        // ---- 해시 --------------------------------------------------------

        /// <summary>
        /// 정수 좌표 + salt에서 결정적으로 0~1 값을 뽑는다. saga-godot의
        /// vegetation_builder.gd _hash()와 같은 공식(Math.random을 쓰지
        /// 않는다 — 무작위면 다시 켤 때마다 숲이 바뀐다).
        /// </summary>
        /// <summary>internal — LandmarksBuilder.BuildVillage()도 같은 결정적
        /// 해시로 집 크기를 흔든다(103-1 "배치 조합", 2026-09-21).</summary>
        internal static float Hash(int gx, int gy, int salt)
        {
            unchecked
            {
                long h = ((long)gx * 374761393) ^ ((long)gy * 668265263) ^ ((long)salt * 2246822519);
                h = (h ^ (h >> 13)) * 1274126177;
                h ^= h >> 16;
                return (h & 0x7fffffffL) / (float)0x7fffffff;
            }
        }

        // ---- 나무 --------------------------------------------------------

        /// <summary>숲 칸 (x,y) 의 i 번째 나무 밑동 자리(해시 salt 불변 — 옛 자리 그대로).</summary>
        public static Vector3 TreeBase(int x, int y, int i)
        {
            float jx = (Hash(x, y, i * 2) - 0.5f) * TestMapData.TileSize * 0.8f;
            float jz = (Hash(x, y, i * 2 + 1) - 0.5f) * TestMapData.TileSize * 0.8f;
            return TestMapData.WorldPos(x, y) + new Vector3(jx, TestMapData.Legend['T'].Height, jz);
        }

        /// <summary>안 세우는 나무 — 지역 소품 빈터(108 ①, 옛 자리라도) · 늘어난 나무가 요지에 가까울 때.</summary>
        public static bool SkipTree(Vector3 basePos, int i, List<Vector3> keyPoints) =>
            GoRegionProps.InClearing(basePos) || (i >= LegacyTreesPerTile && NearAny(basePos, keyPoints, ExtraTreeClearance));

        private void BuildTrees()
        {
            var keyPoints = KeyPoints();

            var visualParent = new GameObject("Trees");
            visualParent.transform.SetParent(transform, false);
            var trunkParent = new GameObject("TreeTrunkCollisions");
            trunkParent.transform.SetParent(transform, false);

            bool hasModels = treeModels != null && treeModels.Length > 0;
            bool unified = WorldModels.Load(UnifiedTrees[0].name) != null;
            if (unified) hasModels = true; // 결합 메시 폴백 재료를 만들지 않게

            // GLB 폴백용 결합 메시 재료(모델을 못 찾았을 때만 실제로 쓰인다).
            var verts = new List<Vector3>();
            var colors = new List<Color>();
            var tris = new List<int>();
            Mesh trunkSrc = hasModels ? null : GetPrimitiveMesh(PrimitiveType.Cylinder);
            Mesh canopySrc = hasModels ? null : GetPrimitiveMesh(PrimitiveType.Sphere);

            for (int y = 0; y < TestMapData.RowCount; y++)
            {
                string row = TestMapData.Rows[y];
                for (int x = 0; x < row.Length; x++)
                {
                    if (row[x] != 'T') continue;
                    string region = GoWorldMap.RegionAt(x, y);
                    var veg = GoWorldMap.VegetationOf(region);
                    var candidates = unified ? UnifiedTreeCandidates(veg.Forms) : hasModels ? TreeCandidates(veg.Forms) : null;

                    for (int i = 0; i < veg.TreesPerForestTile; i++)
                    {
                        float s = Mathf.Lerp(veg.ScaleMin, veg.ScaleMax, Hash(x, y, i * 2 + 100));
                        float yaw = Hash(x, y, i * 2 + 200) * 360f;
                        Vector3 basePos = TreeBase(x, y, i);
                        Quaternion rot = Quaternion.Euler(0f, yaw, 0f);
                        if (SkipTree(basePos, i, keyPoints)) continue;

                        if (unified)
                        {
                            int pick = Mathf.Clamp(Mathf.FloorToInt(Hash(x, y, i * 2 + 300) * candidates.Count), 0, candidates.Count - 1);
                            var (treeName, form) = UnifiedTrees[candidates[pick]];
                            string model = WantsAutumn(veg.CanopyTint) && WorldModels.Load(treeName + "_autumn") != null ? treeName + "_autumn" : treeName;
                            SpawnUnified(model, "Tree_" + form, visualParent.transform, basePos, rot, UnifiedTreeScale * s, region);
                        }
                        else if (hasModels)
                        {
                            int pick = Mathf.Clamp(Mathf.FloorToInt(Hash(x, y, i * 2 + 300) * candidates.Count), 0, candidates.Count - 1);
                            int variant = candidates[pick];
                            var tree = Object.Instantiate(treeModels[variant], visualParent.transform);
                            tree.name = treeModels.Length == TreeFormBySeed.Length ? "Tree_" + TreeFormBySeed[variant] : "Tree";
                            tree.transform.position = basePos;
                            tree.transform.rotation = rot;
                            tree.transform.localScale = Vector3.one * (GeneratedTreeScale * s);
                            ApplyMaterial(tree, RegionMaterial(region));
                        }
                        else
                        {
                            float trunkH0 = TrunkHeight * s;
                            float trunkR0 = TrunkRadius * s;
                            var trunkXf = Matrix4x4.TRS(
                                basePos + Vector3.up * (trunkH0 * 0.5f), rot,
                                new Vector3(trunkR0 * 2f, trunkH0 * 0.5f, trunkR0 * 2f));
                            AppendTransformedMesh(trunkSrc, verts, colors, tris, trunkXf, TrunkColor);

                            float canopyR = FallbackCanopyRadius * s;
                            var canopyXf = Matrix4x4.TRS(
                                basePos + Vector3.up * (trunkH0 * 0.85f), Quaternion.identity,
                                Vector3.one * (canopyR * 2f));
                            AppendTransformedMesh(canopySrc, verts, colors, tris, canopyXf, CanopyColor);
                        }

                        // 트렁크 충돌은 시각 방식과 무관하게 항상 같은 크기(걷는 느낌
                        // 불변) — 잎까지 막으면 나무 사이를 지날 때 부자연스럽다.
                        float trunkH = TrunkHeight * s;
                        float trunkR = TrunkRadius * s;
                        var colGo = new GameObject("TrunkCol");
                        colGo.transform.SetParent(trunkParent.transform, false);
                        colGo.transform.position = basePos + Vector3.up * (trunkH * 0.5f);
                        var cap = colGo.AddComponent<CapsuleCollider>();
                        cap.radius = trunkR;
                        cap.height = trunkH;
                        cap.direction = 1; // Y축
                    }
                }
            }

            if (!hasModels && verts.Count > 0)
            {
                BuildBakedMesh(visualParent.transform, "Trees", verts, colors, tris);
            }
        }

        // ---- 바위 --------------------------------------------------------

        /// <summary>
        /// 산 타일은 TerrainBuilder.BuildCollision이 이미 통째로 막아 뒀다(걸을
        /// 수 없는 지형) — 여기 바위는 순전히 눈에 보이는 장식이라 추가 충돌체가
        /// 필요 없다.
        /// </summary>
        private void BuildRocks()
        {
            // PLAN.md 107 ② — 산 칸은 이제 칸마다 높이가 다른 고원이라 높이는 칸마다 GroundHeight().

            var visualParent = new GameObject("Rocks");
            visualParent.transform.SetParent(transform, false);

            var verts = new List<Vector3>();
            var colors = new List<Color>();
            var tris = new List<int>();
            bool unifiedRocks = WorldModels.Load(UnifiedRocks[0]) != null;
            bool anyModel = unifiedRocks || (rockModels != null && rockModels.Length > 0);
            Mesh rockSrc = anyModel ? null : GetPrimitiveMesh(PrimitiveType.Sphere);

            for (int y = 0; y < TestMapData.RowCount; y++)
            {
                string row = TestMapData.Rows[y];
                for (int x = 0; x < row.Length; x++)
                {
                    if (row[x] != '^') continue;

                    for (int i = 0; i < RocksPerMountainTile; i++)
                    {
                        float jx = (Hash(x, y, i * 3 + 500) - 0.5f) * TestMapData.TileSize * 0.6f;
                        float jz = (Hash(x, y, i * 3 + 501) - 0.5f) * TestMapData.TileSize * 0.6f;
                        float sizeVariant = 0.7f + Hash(x, y, i * 3 + 502) * 0.8f;
                        float yaw = Hash(x, y, i * 3 + 503) * 360f;
                        Vector3 basePos = TestMapData.WorldPos(x, y) + new Vector3(jx, TestMapData.GroundHeight(x, y), jz);

                        if (unifiedRocks)
                        {
                            int variant = Mathf.Clamp(Mathf.FloorToInt(Hash(x, y, i * 3 + 506) * UnifiedRocks.Length), 0, UnifiedRocks.Length - 1);
                            SpawnUnified(UnifiedRocks[variant], "Rock", visualParent.transform, basePos, Quaternion.Euler(0f, yaw, 0f), UnifiedRockScale * sizeVariant, null);
                        }
                        else if (anyModel)
                        {
                            int variant = Mathf.FloorToInt(Hash(x, y, i * 3 + 506) * rockModels.Length);
                            variant = Mathf.Clamp(variant, 0, rockModels.Length - 1);

                            var rock = Object.Instantiate(rockModels[variant], visualParent.transform);
                            rock.name = "Rock";
                            rock.transform.position = basePos;
                            rock.transform.rotation = Quaternion.Euler(0f, yaw, 0f);
                            rock.transform.localScale = Vector3.one * (GeneratedRockScale * sizeVariant);
                            ApplyMaterial(rock, rockMaterial);
                        }
                        else
                        {
                            float radius = FallbackRockRadius * sizeVariant;
                            float wobbleX = 0.85f + Hash(x, y, i * 3 + 504) * 0.3f;
                            float wobbleZ = 0.85f + Hash(x, y, i * 3 + 505) * 0.3f;
                            var scale = new Vector3(radius * 2f * wobbleX, radius * 1.3f, radius * 2f * wobbleZ);
                            var xf = Matrix4x4.TRS(
                                basePos + Vector3.up * (scale.y * 0.5f),
                                Quaternion.Euler(0f, yaw, 0f), scale);
                            AppendTransformedMesh(rockSrc, verts, colors, tris, xf, RockColor);
                        }
                    }
                }
            }

            if (!anyModel && verts.Count > 0)
            {
                BuildBakedMesh(visualParent.transform, "Rocks", verts, colors, tris);
            }
        }

        // ---- 풀·갈대(107-3 식생 바이옴) -------------------------------------

        /// <summary>들('.')·숲('T') 칸에 그 지역 수만큼 풀 포기 — 충돌 없음, 지역 재질(풀도 수관 빛깔로 물든다).</summary>
        private void BuildGrass()
        {
            bool unified = WorldModels.Load(UnifiedGrass[0]) != null;
            if (!unified && (grassModels == null || grassModels.Length == 0)) return;
            var parent = new GameObject("Grass");
            parent.transform.SetParent(transform, false);
            var keyPoints = KeyPoints();
            for (int y = 0; y < TestMapData.RowCount; y++)
            {
                string row = TestMapData.Rows[y];
                for (int x = 0; x < row.Length; x++)
                {
                    char ch = row[x];
                    if (ch != '.' && ch != 'T') continue;
                    string region = GoWorldMap.RegionAt(x, y);
                    var veg = GoWorldMap.VegetationOf(region);
                    float ground = TestMapData.GroundHeight(x, y);
                    for (int i = 0; i < veg.GrassPerTile; i++)
                    {
                        float jx = (Hash(x, y, i * 3 + 700) - 0.5f) * TestMapData.TileSize * 0.9f;
                        float jz = (Hash(x, y, i * 3 + 701) - 0.5f) * TestMapData.TileSize * 0.9f;
                        Vector3 pos = TestMapData.WorldPos(x, y) + new Vector3(jx, ground, jz);
                        if (NearAny(pos, keyPoints, GrassClearance) || GoRegionProps.InClearing(pos)) continue;
                        if (unified)
                        {
                            int u = Mathf.Clamp(Mathf.FloorToInt(Hash(x, y, i * 3 + 702) * UnifiedGrass.Length), 0, UnifiedGrass.Length - 1);
                            SpawnUnified(UnifiedGrass[u], "Grass", parent.transform, pos, Quaternion.Euler(0f, Hash(x, y, i * 3 + 703) * 360f, 0f),
                                UnifiedGrassScale * Mathf.Lerp(GrassScaleMin, GrassScaleMax, Hash(x, y, i * 3 + 704)), region);
                            continue;
                        }
                        int variant = Mathf.Clamp(Mathf.FloorToInt(Hash(x, y, i * 3 + 702) * grassModels.Length), 0, grassModels.Length - 1);
                        if (grassModels[variant] == null) continue;
                        var g = Object.Instantiate(grassModels[variant], parent.transform);
                        g.name = "Grass";
                        g.transform.position = pos;
                        g.transform.rotation = Quaternion.Euler(0f, Hash(x, y, i * 3 + 703) * 360f, 0f);
                        g.transform.localScale = Vector3.one * Mathf.Lerp(GrassScaleMin, GrassScaleMax, Hash(x, y, i * 3 + 704));
                        TintGroundCover(g, region);
                        StripColliders(g);
                    }
                }
            }
        }

        /// <summary>강 북쪽 둑 — 강 칸 바로 위(+z) 줄의 들·숲 칸 남쪽 가장자리를 따라 갈대(길·다리 칸은 비움).</summary>
        private void BuildReeds()
        {
            bool unified = WorldModels.Load(UnifiedReeds[0]) != null;
            if (!unified && (reedModels == null || reedModels.Length == 0)) return;
            var parent = new GameObject("Reeds");
            parent.transform.SetParent(transform, false);
            for (int y = 0; y < TestMapData.RowCount - 1; y++)
            {
                string row = TestMapData.Rows[y];
                for (int x = 0; x < row.Length; x++)
                {
                    char ch = row[x];
                    if ((ch != '.' && ch != 'T') || TestMapData.TileAt(x, y + 1) != '~') continue;
                    float ground = TestMapData.GroundHeight(x, y);
                    for (int i = 0; i < ReedsPerBankTile; i++)
                    {
                        float jx = (Hash(x, y, i * 3 + 800) - 0.5f) * TestMapData.TileSize * 0.95f;
                        float jz = TestMapData.TileSize * (0.36f + Hash(x, y, i * 3 + 801) * 0.11f); // 둑 끝 1~7m 안쪽
                        Vector3 pos = TestMapData.WorldPos(x, y) + new Vector3(jx, ground, jz);
                        if (unified)
                        {
                            int u = Mathf.Clamp(Mathf.FloorToInt(Hash(x, y, i * 3 + 802) * UnifiedReeds.Length), 0, UnifiedReeds.Length - 1);
                            SpawnUnified(UnifiedReeds[u], "Reed", parent.transform, pos, Quaternion.Euler(0f, Hash(x, y, i * 3 + 803) * 360f, 0f),
                                UnifiedReedScale * Mathf.Lerp(ReedScaleMin, ReedScaleMax, Hash(x, y, i * 3 + 804)), "river");
                            continue;
                        }
                        int variant = Mathf.Clamp(Mathf.FloorToInt(Hash(x, y, i * 3 + 802) * reedModels.Length), 0, reedModels.Length - 1);
                        if (reedModels[variant] == null) continue;
                        var r = Object.Instantiate(reedModels[variant], parent.transform);
                        r.name = "Reed";
                        r.transform.position = pos;
                        r.transform.rotation = Quaternion.Euler(0f, Hash(x, y, i * 3 + 803) * 360f, 0f);
                        r.transform.localScale = Vector3.one * Mathf.Lerp(ReedScaleMin, ReedScaleMax, Hash(x, y, i * 3 + 804));
                        TintGroundCover(r, "river");
                        StripColliders(r);
                    }
                }
            }
        }

        private readonly Dictionary<string, Material> _coverMaterials = new Dictionary<string, Material>();

        /// <summary>풀·갈대 GLB 는 정점색이 아니라 색마다 재질(glTFast `baseColorFactor`)이라 트라이플레이너를 안 씌우고,
        /// 가져온 재질을 지역마다 복제해 초록 쪽만 셰이더 `_CanopyTint` 와 같은 공식으로 물들인다(세기 0 인 지역은 그대로).</summary>
        private void TintGroundCover(GameObject go, string regionId)
        {
            var tint = GoWorldMap.VegetationOf(regionId).CanopyTint;
            if (tint.a <= 0f) return;
            foreach (var renderer in go.GetComponentsInChildren<MeshRenderer>(true))
            {
                var mats = renderer.sharedMaterials;
                for (int i = 0; i < mats.Length; i++)
                {
                    var src = mats[i];
                    if (src == null) continue;
                    string prop = src.HasProperty("baseColorFactor") ? "baseColorFactor" : src.HasProperty("_BaseColor") ? "_BaseColor" : null;
                    if (prop == null) continue;
                    string key = src.GetInstanceID() + "|" + regionId;
                    if (!_coverMaterials.TryGetValue(key, out var m) || m == null)
                    {
                        m = new Material(src) { name = src.name + "_" + regionId };
                        m.SetColor(prop, TintLeafy(src.GetColor(prop), tint));
                        _coverMaterials[key] = m;
                    }
                    mats[i] = m;
                }
                renderer.sharedMaterials = mats;
            }
        }

        // ---- 통일 세트 도우미(tasks U-0141) ---------------------------------------

        private readonly Dictionary<Material, Material> _backdrop = new Dictionary<Material, Material>();
        private readonly Dictionary<(Material, string), Material> _leafTint = new Dictionary<(Material, string), Material>();

        /// <summary>그 지역 모양에 맞는 통일 세트 나무 번호들(없으면 전부).</summary>
        private static List<int> UnifiedTreeCandidates(GoWorldMap.TreeForm forms)
        {
            var list = new List<int>();
            for (int i = 0; i < UnifiedTrees.Length; i++)
                if ((forms & UnifiedTrees[i].form) != 0 && WorldModels.Load(UnifiedTrees[i].name) != null) list.Add(i);
            if (list.Count == 0)
                for (int i = 0; i < UnifiedTrees.Length; i++) if (WorldModels.Load(UnifiedTrees[i].name) != null) list.Add(i);
            return list;
        }

        /// <summary>통일 세트 모델 하나 — `label` 이름의 빈 자리(위치·회전·크기) 밑에 모델(이름 = 모델 id). 배경 재질(`RegionMaterials.ForBackdrop`, 같은 원본은 한 벌)·충돌 없음.
        /// `region` 이 있으면 잎 재질(나무결 아닌 것)을 그 지역 빛깔로 엷게 곱한다(지역마다 한 벌 — 같은 지역끼리 배칭이 묶인다).</summary>
        private GameObject SpawnUnified(string model, string label, Transform parent, Vector3 pos, Quaternion rot, float scale, string region)
        {
            var prefab = WorldModels.Load(model);
            if (prefab == null) return null;
            var holder = new GameObject(label);
            holder.transform.SetParent(parent, false);
            holder.transform.SetPositionAndRotation(pos, rot);
            holder.transform.localScale = Vector3.one * scale;
            var go = Object.Instantiate(prefab, holder.transform, false);
            go.name = model;
            StripColliders(go);
            var tint = region != null ? GoWorldMap.VegetationOf(region).CanopyTint : Color.clear;
            var mats = new List<Material>();
            foreach (var r in go.GetComponentsInChildren<Renderer>(true))
            {
                r.GetSharedMaterials(mats);
                for (int i = 0; i < mats.Count; i++)
                {
                    var m = RegionMaterials.ForBackdrop(mats[i], _backdrop, out _) ?? mats[i];
                    if (tint.a > 0f && m != null && !IsWoody(m.name)) m = LeafTinted(m, region, tint);
                    mats[i] = m;
                }
                r.SetSharedMaterials(mats);
            }
            return holder;
        }

        private static bool IsWoody(string name)
        {
            string n = name.ToLowerInvariant();
            return n.Contains("plank") || n.Contains("bark") || n.Contains("wood") || n.Contains("trunk") || n.Contains("concrete") || n.Contains("rock") || n.Contains("stone");
        }

        /// <summary>잎 재질 지역판 — 텍스처 잎은 바탕색 계수가 흰색이라 `TintLeafy` 가 안 먹는다. 빛깔을 가장 밝은 채널 1 로 맞춘 색을
        /// 세기 절반만큼 곱한다(초록은 그대로·노랑은 파랑을 빼고·짙은 숲은 빨강·파랑을 뺀다).</summary>
        private Material LeafTinted(Material src, string region, Color tint)
        {
            if (_leafTint.TryGetValue((src, region), out var done) && done != null) return done;
            string prop = src.HasProperty("baseColorFactor") ? "baseColorFactor" : src.HasProperty("_BaseColor") ? "_BaseColor" : null;
            if (prop == null) { _leafTint[(src, region)] = src; return src; }
            var m = new Material(src) { name = src.name + "_" + region };
            m.SetColor(prop, src.GetColor(prop) * LeafMultiplier(tint));
            _leafTint[(src, region)] = m;
            return m;
        }

        /// <summary>잎 곱 색 — 빛깔을 가장 밝은 채널 1 로 맞추고 세기(a)의 절반만 섞는다.</summary>
        public static Color LeafMultiplier(Color tint)
        {
            float top = Mathf.Max(0.001f, Mathf.Max(tint.r, Mathf.Max(tint.g, tint.b)));
            var norm = new Color(tint.r / top, tint.g / top, tint.b / top, 1f);
            return Color.Lerp(Color.white, norm, tint.a * 0.5f);
        }

        /// <summary>셰이더 `_CanopyTint` 와 같은 공식 — 초록이 뚜렷한 색만 tint 쪽으로, 밝기 흔들림은 살린다.</summary>
        public static Color TintLeafy(Color c, Color tint)
        {
            float leafy = Mathf.Clamp01((c.g - Mathf.Max(c.r, c.b)) * 6f) * tint.a;
            float k = (c.r + c.g + c.b) / 3f / 0.177f;
            var t = new Color(tint.r * k, tint.g * k, tint.b * k, c.a);
            return Color.Lerp(c, t, leafy);
        }

        private static void StripColliders(GameObject go)
        {
            foreach (var c in go.GetComponentsInChildren<Collider>(true)) Object.DestroyImmediate(c);
        }

        // ---- 공통 --------------------------------------------------------

        /// <summary>procgen GLB엔 UV가 없어 임포트 기본 머티리얼이 무의미하다
        /// — 트라이플레이너 재질(Saga/VertexColorTriplanarLit)로 갈아 끼운다.
        /// material이 null이면(다른 PC에서 못 지었을 때) 그대로 둔다.</summary>
        private static void ApplyMaterial(GameObject instance, Material material)
        {
            if (material == null) return;
            foreach (var renderer in instance.GetComponentsInChildren<MeshRenderer>(true))
            {
                renderer.sharedMaterial = material;
            }
        }

        private static void BuildBakedMesh(Transform parent, string name, List<Vector3> verts, List<Color> colors, List<int> tris)
        {
            var mesh = new Mesh { name = name };
            mesh.indexFormat = verts.Count > 65000 ? IndexFormat.UInt32 : IndexFormat.UInt16;
            mesh.SetVertices(verts);
            mesh.SetColors(colors);
            mesh.SetTriangles(tris, 0);
            mesh.RecalculateNormals();
            mesh.RecalculateBounds();

            var go = new GameObject(name + "Mesh");
            go.transform.SetParent(parent, false);
            go.AddComponent<MeshFilter>().sharedMesh = mesh;
            go.AddComponent<MeshRenderer>().sharedMaterial =
                new Material(Shader.Find("Saga/VertexColorLit")) { name = $"{name} (generated)" };
        }

        /// <summary>
        /// 내장 primitive 메시(반지름 0.5 기준 Sphere/Cylinder)를 얻는다 —
        /// 임시 GameObject를 만들어 sharedMesh만 빼고 바로 지운다(엔진 내장
        /// 리소스라 GameObject를 지워도 메시 자체는 안 없어진다).
        /// </summary>
        private static Mesh GetPrimitiveMesh(PrimitiveType type)
        {
            var temp = GameObject.CreatePrimitive(type);
            Mesh mesh = temp.GetComponent<MeshFilter>().sharedMesh;
            Object.DestroyImmediate(temp);
            return mesh;
        }

        private static void AppendTransformedMesh(Mesh src, List<Vector3> verts, List<Color> colors,
            List<int> tris, Matrix4x4 xform, Color color)
        {
            Vector3[] srcVerts = src.vertices;
            int[] srcTris = src.triangles;
            int b = verts.Count;
            for (int i = 0; i < srcVerts.Length; i++)
            {
                verts.Add(xform.MultiplyPoint3x4(srcVerts[i]));
                colors.Add(color);
            }
            for (int i = 0; i < srcTris.Length; i++)
            {
                tris.Add(b + srcTris[i]);
            }
        }
    }
}
