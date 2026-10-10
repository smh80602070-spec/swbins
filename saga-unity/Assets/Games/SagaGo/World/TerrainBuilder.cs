using System.Collections.Generic;
using UnityEngine;
using UnityEngine.Rendering;
using Saga.Go.Data;

namespace Saga.Go.World
{
    /// <summary>
    /// VERTICAL_SLICE.md의 글자 지도를 읽어 땅을 세운다. saga-godot의
    /// terrain_builder.gd와 같은 알고리즘(칸을 4x4로 더 쪼개, 칸 중심은 제
    /// 색 그대로 두고 가장자리만 이웃과 섞는다)을 처음부터 쓴다 — saga-godot이
    /// 2026-09-11에 "칸 경계가 바둑판처럼 갈라져 보이는" 문제를 나중에 고쳐야
    /// 했던 것과 같은 함정을 Unity 쪽은 처음부터 피한다(VERTICAL_SLICE.md
    /// "테스트 지역 설계" 절 참고). 높이는 안 섞는다 — 산·강은 여전히 벽처럼
    /// 뚝 끊겨야 막힌 지형임이 드러난다(충돌은 칸마다 따로, BuildCollision 참고).
    /// </summary>
    [RequireComponent(typeof(MeshFilter))]
    [RequireComponent(typeof(MeshRenderer))]
    public class TerrainBuilder : MonoBehaviour
    {
        private const int Sub = 4;
        private const float EdgeBlendMargin = 0.34f;

        [Tooltip("비워 두면 Awake에서 VertexColorLit 셰이더로 직접 만든다.")]
        [SerializeField] private Material groundMaterialOverride;

        // 44장 "Environment" 디테일 오버레이 — VertexColorLit.shader의
        // _DetailTex/_DetailTiling/_DetailStrength에 그대로 물린다.
        // 런타임 스크립트라 AssetDatabase를 못 써 편집기 빌드 스크립트
        // (BuildTestVillageScene.BuildTerrain)가 채워 준다 — 비어 있으면
        // 셰이더 기본값(흰 텍스처, 곱해도 무변화)이라 씬이 안 깨진다.
        [SerializeField] private Texture2D detailTexture;
        [SerializeField] private float detailTiling = 2f;
        [SerializeField] private float detailStrength = 0.6f;

        private void Awake()
        {
            Build();
        }

        public void Build()
        {
            BuildGround();
            BuildWater();
            BuildCollision();
            BuildPeaks();
            BuildRamps();
            BuildWaterfalls();
            MarkStatic();
        }

        /// <summary>PLAN.md 109-9 발원지 폭포 — 고원 윗면 샘 웅덩이 → 턱에서 밖으로 휘어 절벽 면을 타고 강 수면까지 떨어지는 물 판
        /// (`Saga/WaterfallUnlit`, 흘러내리는 물살) → 아래에 물보라(입자). 충돌체 없음 — 뒤 절벽은 그대로 기어오른다.</summary>
        private void BuildWaterfalls()
        {
            ClearBuilt("Waterfalls");
            var parent = new GameObject("Waterfalls");
            parent.transform.SetParent(transform, false);
            var shader = Shader.Find("Saga/WaterfallUnlit");
            var poolShader = Shader.Find("Saga/WaterUnlit");
            var realShader = Shader.Find(WaterRealShader);
            foreach (var w in TestMapData.Waterfalls)
            {
                TestMapData.WaterfallGeometry(w, out Vector3 lip, out Vector3 foot, out Vector3 dir, out Vector3 side);
                var root = new GameObject($"Waterfall_{w.Id}");
                root.transform.SetParent(parent.transform, false);

                // 물 판 — 턱 뒤(윗면) → 턱 → 밖으로 휘어 → 수면. 줄마다 (왼쪽, 오른쪽) 정점 둘, uv.y = 흐른 거리(m).
                var path = new List<Vector3>
                {
                    lip - dir * 3f + Vector3.up * 0.08f,
                    lip + Vector3.up * 0.1f,
                    lip + dir * (TestMapData.WaterfallLip * 0.7f) - Vector3.up * 0.6f,
                    lip + dir * TestMapData.WaterfallLip - Vector3.up * 2f,
                };
                float drop = lip.y - foot.y;
                for (int k = 1; k <= 6; k++)
                {
                    float f = k / 6f;
                    Vector3 p = Vector3.Lerp(lip + dir * TestMapData.WaterfallLip - Vector3.up * 2f, foot, f);
                    path.Add(new Vector3(p.x, lip.y - 2f - (drop - 2f) * f, p.z));
                }
                var verts = new List<Vector3>();
                var uvs = new List<Vector2>();
                var tris = new List<int>();
                float along = 0f;
                float half = TestMapData.WaterfallWidth * 0.5f;
                for (int i = 0; i < path.Count; i++)
                {
                    if (i > 0) along += Vector3.Distance(path[i - 1], path[i]);
                    float widen = 1f + 0.25f * Mathf.Clamp01((float)(i - 3) / (path.Count - 4)); // 떨어지며 조금 퍼진다
                    verts.Add(path[i] - side * half * widen); uvs.Add(new Vector2(0f, along));
                    verts.Add(path[i] + side * half * widen); uvs.Add(new Vector2(1f, along));
                    if (i == 0) continue;
                    int b = verts.Count - 4;
                    tris.Add(b); tris.Add(b + 2); tris.Add(b + 1);
                    tris.Add(b + 1); tris.Add(b + 2); tris.Add(b + 3);
                }
                var mesh = new Mesh { name = $"Waterfall_{w.Id}" };
                mesh.SetVertices(verts);
                mesh.SetUVs(0, uvs);
                mesh.SetTriangles(tris, 0);
                mesh.RecalculateNormals();
                mesh.RecalculateBounds();
                var sheet = new GameObject("Sheet");
                sheet.transform.SetParent(root.transform, false);
                sheet.AddComponent<MeshFilter>().sharedMesh = mesh;
                var sr = sheet.AddComponent<MeshRenderer>();
                sr.sharedMaterial = new Material(shader != null ? shader : poolShader) { name = "Waterfall (generated)" };
                sr.shadowCastingMode = ShadowCastingMode.Off;

                // 샘 웅덩이 — 턱 뒤 고원 윗면
                var pool = GameObject.CreatePrimitive(PrimitiveType.Quad);
                pool.name = "SourcePool";
                Object.DestroyImmediate(pool.GetComponent<Collider>());
                pool.transform.SetParent(root.transform, false);
                pool.transform.position = lip - dir * 6f + Vector3.up * 0.06f;
                pool.transform.rotation = Quaternion.LookRotation(Vector3.down, dir);
                pool.transform.localScale = new Vector3(TestMapData.WaterfallWidth + 2f, 8f, 1f);
                pool.GetComponent<MeshRenderer>().sharedMaterial = WaterMaterial(realShader, poolShader, "WaterfallPool (generated)", poolDepth: 1.4f);

                // 물보라 — 아래끝 수면에서 피어오르는 흰 김
                var mist = new GameObject("Mist");
                mist.transform.SetParent(root.transform, false);
                mist.transform.position = foot + dir * 1.5f;
                mist.transform.rotation = Quaternion.LookRotation(Vector3.up, dir);
                var ps = mist.AddComponent<ParticleSystem>();
                var main = ps.main;
                main.loop = true;
                main.startLifetime = new ParticleSystem.MinMaxCurve(1.6f, 2.8f);
                main.startSpeed = new ParticleSystem.MinMaxCurve(1.5f, 4f);
                main.startSize = new ParticleSystem.MinMaxCurve(2.5f, 5f);
                main.startColor = new Color(0.95f, 0.98f, 1f, 0.28f);
                main.maxParticles = 160;
                main.simulationSpace = ParticleSystemSimulationSpace.World;
                main.gravityModifier = -0.05f;
                var em = ps.emission;
                em.rateOverTime = 40f;
                var shape = ps.shape;
                shape.shapeType = ParticleSystemShapeType.Box;
                shape.scale = new Vector3(TestMapData.WaterfallWidth * 1.2f, 2f, 0.5f);
                var col = ps.colorOverLifetime;
                col.enabled = true;
                var grad = new Gradient();
                grad.SetKeys(new[] { new GradientColorKey(Color.white, 0f), new GradientColorKey(Color.white, 1f) },
                             new[] { new GradientAlphaKey(0f, 0f), new GradientAlphaKey(1f, 0.2f), new GradientAlphaKey(0f, 1f) });
                col.color = grad;
                var pr = mist.GetComponent<ParticleSystemRenderer>();
                pr.sharedMaterial = new Material(Shader.Find("Sprites/Default")) { name = "WaterfallMist (generated)", mainTexture = SoftDot() };
                pr.shadowCastingMode = ShadowCastingMode.Off;
                ps.Play();
            }
        }

        private static Texture2D _softDot;

        /// <summary>물보라 입자 한 알 — 가운데가 짙고 가장자리로 흐려지는 흰 점(64², 코드로 한 번 굽는다).</summary>
        private static Texture2D SoftDot()
        {
            if (_softDot != null) return _softDot;
            const int N = 64;
            _softDot = new Texture2D(N, N, TextureFormat.RGBA32, false) { name = "SoftDot (generated)", wrapMode = TextureWrapMode.Clamp };
            var px = new Color[N * N];
            for (int y = 0; y < N; y++)
                for (int x = 0; x < N; x++)
                {
                    float d = Vector2.Distance(new Vector2(x + 0.5f, y + 0.5f), new Vector2(N * 0.5f, N * 0.5f)) / (N * 0.5f);
                    float a = Mathf.Clamp01(1f - d);
                    px[y * N + x] = new Color(1f, 1f, 1f, a * a);
                }
            _softDot.SetPixels(px);
            _softDot.Apply();
            return _softDot;
        }

        /// <summary>PLAN.md 107-3 "걸어 오르는 경사·고개" — `TestMapData.Ramps` 마다 절벽에 기댄 쐐기 모양 돌 비탈.
        /// 윗면(28°)은 걸어서 오르고 옆면은 바위색. 충돌은 볼록 MeshCollider(쐐기 꼭짓점 여섯의 껍질).</summary>
        private void BuildRamps()
        {
            var parent = new GameObject("Ramps");
            parent.transform.SetParent(transform, false);
            var mat = GetComponent<MeshRenderer>().sharedMaterial;
            foreach (var r in TestMapData.Ramps)
            {
                TestMapData.RampGeometry(r, out Vector3 bottom, out Vector3 top, out Vector3 dir, out Vector3 side);
                var mesh = BuildRampMesh(bottom, top, side * (TestMapData.RampWidth * 0.5f));
                var go = new GameObject($"Ramp_{r.Id}");
                go.transform.SetParent(parent.transform, false);
                go.AddComponent<MeshFilter>().sharedMesh = mesh;
                go.AddComponent<MeshRenderer>().sharedMaterial = mat;
                var col = go.AddComponent<MeshCollider>();
                col.sharedMesh = mesh;
                col.convex = true;
            }
        }

        private static Mesh BuildRampMesh(Vector3 bottom, Vector3 top, Vector3 halfSide)
        {
            const float Sink = 1.5f;
            Vector3 foot = new Vector3(top.x, bottom.y - Sink, top.z);
            Vector3 a0 = bottom - halfSide, a1 = bottom + halfSide;
            Vector3 b0 = top - halfSide, b1 = top + halfSide;
            Vector3 c0 = foot - halfSide, c1 = foot + halfSide;
            Vector3 sideN = halfSide.normalized;
            var verts = new List<Vector3>();
            var colors = new List<Color>();
            var normals = new List<Vector3>();
            var uvs = new List<Vector2>();
            var tris = new List<int>();

            void Face(Vector3[] pts, Vector3 want, Color col)
            {
                Vector3 n = Vector3.Cross(pts[1] - pts[0], pts[2] - pts[0]).normalized;
                if (Vector3.Dot(n, want) < 0f) { System.Array.Reverse(pts); n = -n; } // 유니티 앞면 = 보는 쪽으로 향한 외적
                int k = verts.Count;
                foreach (var p in pts)
                {
                    verts.Add(p);
                    normals.Add(n);
                    colors.Add(col);
                    uvs.Add(new Vector2(p.x + p.z, p.y));
                }
                for (int i = 1; i + 1 < pts.Length; i++) { tris.Add(k); tris.Add(k + i); tris.Add(k + i + 1); }
            }

            Vector3 up = Vector3.Cross(b0 - a0, a1 - a0);
            if (up.y < 0f) up = -up;
            Face(new[] { a0, a1, b1, b0 }, up, CliffRockColor);           // 오르는 윗면
            Face(new[] { a0, b0, c0 }, -sideN, CliffRockDark);             // 옆면 둘
            Face(new[] { a1, c1, b1 }, sideN, CliffRockDark);
            Face(new[] { a0, c0, c1, a1 }, Vector3.down, CliffRockDark);   // 밑면(땅속, 볼록 껍질용)
            var mesh = new Mesh { name = "Ramp" };
            mesh.SetVertices(verts);
            mesh.SetColors(colors);
            mesh.SetNormals(normals);
            mesh.SetUVs(0, uvs);
            mesh.SetTriangles(tris, 0);
            mesh.RecalculateBounds();
            return mesh;
        }

        /// <summary>
        /// PLAN.md 76장 Mobile Performance Pass — 절대 안 움직이는
        /// 지오메트리라 정적 배칭·오클루전 컬링 대상으로 표시한다.
        /// isStatic은 오브젝트 하나에만 걸리고 자식으로 안 번져서
        /// (WaterSurface·TerrainCollision과 그 밑의 Col_* 전부) 트리
        /// 전체를 훑어 건다.
        /// </summary>
        private void MarkStatic()
        {
            foreach (Transform t in GetComponentsInChildren<Transform>(true))
            {
                t.gameObject.isStatic = true;
            }
        }

        // ---- 땅 ------------------------------------------------------

        private void BuildGround()
        {
            var verts = new List<Vector3>();
            var colors = new List<Color>();
            var normals = new List<Vector3>();
            var uvs = new List<Vector2>();
            var tris = new List<int>();

            float half = TestMapData.TileSize * 0.5f;

            for (int y = 0; y < TestMapData.RowCount; y++)
            {
                string row = TestMapData.Rows[y];
                for (int x = 0; x < row.Length; x++)
                {
                    char ch = row[x];
                    if (!TestMapData.Legend.TryGetValue(ch, out TestMapData.TileInfo info))
                    {
                        Debug.LogWarning($"TerrainBuilder: 모르는 지형 글자 '{ch}'");
                        continue;
                    }

                    // PLAN.md 107 ② — 산은 칸마다 높이가 다른 고원, 강·다리 칸은 깊은 강바닥.
                    Vector3 center = TestMapData.WorldPos(x, y) + new Vector3(0, TestMapData.GroundHeight(x, y), 0);
                    Color own = info.Color;
                    Color col00 = CornerColor(x, y);
                    Color col10 = CornerColor(x + 1, y);
                    Color col01 = CornerColor(x, y + 1);
                    Color col11 = CornerColor(x + 1, y + 1);

                    if (TestMapData.IsWater(ch))
                    {
                        // U-0078 물 밑 비탈 — 흙 둑에서 강바닥까지 보이는 높이만 비탈로(충돌·헤엄 규칙은 그대로)
                        int gx = x, gy = y;
                        AddTileQuads(verts, colors, normals, uvs, tris, center, half, own, col00, col10, col01, col11,
                            BedSub, p => RiverBedAt(gx, gy, p));
                    }
                    else
                    {
                        AddTileQuads(verts, colors, normals, uvs, tris, center, half, own, col00, col10, col01, col11);
                    }
                    AddCliffSides(verts, colors, normals, uvs, tris, x, y, center, half, ch);
                }
            }

            var mesh = new Mesh { name = "Ground" };
            mesh.indexFormat = verts.Count > 65000 ? IndexFormat.UInt32 : IndexFormat.UInt16;
            mesh.SetVertices(verts);
            mesh.SetColors(colors);
            mesh.SetNormals(normals);
            mesh.SetUVs(0, uvs);
            mesh.SetTriangles(tris, 0);
            mesh.RecalculateBounds();

            GetComponent<MeshFilter>().sharedMesh = mesh;

            var mr = GetComponent<MeshRenderer>();
            if (groundMaterialOverride != null)
            {
                mr.sharedMaterial = groundMaterialOverride;
            }
            else
            {
                var mat = new Material(Shader.Find("Saga/VertexColorLit")) { name = "Ground (generated)" };
                if (detailTexture != null)
                {
                    mat.SetTexture("_DetailTex", detailTexture);
                    mat.SetFloat("_DetailTiling", detailTiling);
                    mat.SetFloat("_DetailStrength", detailStrength);
                }
                mr.sharedMaterial = mat;
            }
        }

        /// <summary>칸 하나를 Sub x Sub 조각으로 나눠 넣는다. (u,v)는 칸 안의 상대 위치.
        /// 44장 "Environment" 디테일 오버레이 — uv는 월드 XZ 그대로 담는다
        /// (셰이더가 타일링 배율을 곱한다, 정점색 블렌딩과는 무관한 별도 채널).</summary>
        private static void AddTileQuads(List<Vector3> verts, List<Color> colors, List<Vector3> normals, List<Vector2> uvs, List<int> tris,
            Vector3 center, float half, Color own, Color col00, Color col10, Color col01, Color col11,
            int sub = Sub, System.Func<Vector3, float> heightAt = null)
        {
            for (int j = 0; j < sub; j++)
            {
                float v0 = (float)j / sub;
                float v1 = (float)(j + 1) / sub;
                for (int i = 0; i < sub; i++)
                {
                    float u0 = (float)i / sub;
                    float u1 = (float)(i + 1) / sub;

                    Vector3 p00 = center + new Vector3(Mathf.Lerp(-half, half, u0), 0, Mathf.Lerp(-half, half, v0));
                    Vector3 p10 = center + new Vector3(Mathf.Lerp(-half, half, u1), 0, Mathf.Lerp(-half, half, v0));
                    Vector3 p11 = center + new Vector3(Mathf.Lerp(-half, half, u1), 0, Mathf.Lerp(-half, half, v1));
                    Vector3 p01 = center + new Vector3(Mathf.Lerp(-half, half, u0), 0, Mathf.Lerp(-half, half, v1));

                    Color cc00 = TileVertexColor(own, col00, col10, col01, col11, u0, v0);
                    Color cc10 = TileVertexColor(own, col00, col10, col01, col11, u1, v0);
                    Color cc11 = TileVertexColor(own, col00, col10, col01, col11, u1, v1);
                    Color cc01 = TileVertexColor(own, col00, col10, col01, col11, u0, v1);

                    Vector3 n00 = Vector3.up, n10 = Vector3.up, n11 = Vector3.up, n01 = Vector3.up;
                    if (heightAt != null)
                    {
                        n00 = Slope(ref p00, heightAt); n10 = Slope(ref p10, heightAt);
                        n11 = Slope(ref p11, heightAt); n01 = Slope(ref p01, heightAt);
                    }

                    int b = verts.Count;
                    verts.Add(p00); colors.Add(cc00); normals.Add(n00); uvs.Add(new Vector2(p00.x, p00.z));
                    verts.Add(p10); colors.Add(cc10); normals.Add(n10); uvs.Add(new Vector2(p10.x, p10.z));
                    verts.Add(p11); colors.Add(cc11); normals.Add(n11); uvs.Add(new Vector2(p11.x, p11.z));
                    verts.Add(p01); colors.Add(cc01); normals.Add(n01); uvs.Add(new Vector2(p01.x, p01.z));

                    // 노멀을 명시로 주고 셰이더가 Cull Off라 감김 방향은 안 가린다
                    // (Godot 쪽에서 겪은 외적 부호 계산 문제를 여기선 안 밟는다).
                    tris.Add(b + 0); tris.Add(b + 1); tris.Add(b + 2);
                    tris.Add(b + 0); tris.Add(b + 2); tris.Add(b + 3);
                }
            }
        }

        // ---- U-0078 물 밑 비탈 -------------------------------------------
        // 강 칸 바닥이 -3.5m 평판이라 둑이 계단(세로 벽)으로 보였다. 흙 둑 쪽은 둑 끝(수면 0.25m 위)에서
        // BankSlopeWidth 안에 강바닥까지 내려간다 — 물가에 얕은 띠가 생겨 물 셰이더 거품·깊이 흡수가 산다.
        // 산(절벽) 쪽은 그대로 깊다(폭포 발이 얕은 물에 떨어지지 않게). 보이는 메시만, 충돌체는 그대로.
        private const int BedSub = 8;
        public const float BankSlopeWidth = 14f;
        public const float BankLipHeight = TestMapData.WaterSurfaceHeight + 0.25f;

        /// <summary>강 칸(gx,gy) 안 월드 점 p 의 보이는 바닥 높이 — 가장 가까운 흙 둑 칸까지 거리로 비탈.</summary>
        public static float RiverBedAt(int gx, int gy, Vector3 p)
        {
            float half = TestMapData.TileSize * 0.5f;
            float d = float.MaxValue;
            for (int dy = -1; dy <= 1; dy++)
                for (int dx = -1; dx <= 1; dx++)
                {
                    if (dx == 0 && dy == 0) continue;
                    char n = TestMapData.TileAt(gx + dx, gy + dy);
                    if (TestMapData.IsWater(n) || n == '^') continue;
                    Vector3 c = TestMapData.WorldPos(gx + dx, gy + dy);
                    float qx = Mathf.Max(Mathf.Abs(p.x - c.x) - half, 0f);
                    float qz = Mathf.Max(Mathf.Abs(p.z - c.z) - half, 0f);
                    d = Mathf.Min(d, Mathf.Sqrt(qx * qx + qz * qz));
                }
            if (d == float.MaxValue) return TestMapData.RiverBedHeight;
            return Mathf.Lerp(BankLipHeight, TestMapData.RiverBedHeight, Mathf.SmoothStep(0f, 1f, d / BankSlopeWidth));
        }

        /// <summary>p.y 를 높이 함수로 올리고 그 자리 법선(중앙 차분)을 돌려준다.</summary>
        private static Vector3 Slope(ref Vector3 p, System.Func<Vector3, float> heightAt)
        {
            const float e = 0.5f;
            p.y = heightAt(p);
            float hx = heightAt(p + new Vector3(e, 0, 0)) - heightAt(p - new Vector3(e, 0, 0));
            float hz = heightAt(p + new Vector3(0, 0, e)) - heightAt(p - new Vector3(0, 0, e));
            return new Vector3(-hx, 2f * e, -hz).normalized;
        }

        private static readonly Color CliffRockColor = new Color(0.43f, 0.41f, 0.38f);
        private static readonly Color CliffRockDark = new Color(0.27f, 0.26f, 0.25f);
        private static readonly Color BankEarthColor = new Color(0.36f, 0.29f, 0.2f);
        private static readonly Color BankEarthDark = new Color(0.2f, 0.17f, 0.13f);
        private const float OutsideFloor = -10f;

        /// <summary>PLAN.md 107 ② — 이웃 칸이 더 낮은 모서리마다 세로 옆면(절벽·강둑)을 세운다.
        /// 예전엔 높이가 거의 같아 틈이 안 보였지만 산 12~38m·강바닥 -3.5m 가 되면 옆면 없이는 구멍이다.
        /// 지도 밖 모서리는 -10m 까지 내린다. 산은 바위색, 그 밖은 흙색, 아래로 갈수록 어둡게.</summary>
        private static void AddCliffSides(List<Vector3> verts, List<Color> colors, List<Vector3> normals, List<Vector2> uvs, List<int> tris,
            int x, int y, Vector3 center, float half, char ch)
        {
            float h = center.y;
            bool rock = ch == '^';
            Color top = rock ? CliffRockColor : BankEarthColor;
            Color bottom = rock ? CliffRockDark : BankEarthDark;
            AddSide(x + 1, y, new Vector3(1, 0, 0), new Vector3(half, 0, -half), new Vector3(half, 0, half));
            AddSide(x - 1, y, new Vector3(-1, 0, 0), new Vector3(-half, 0, half), new Vector3(-half, 0, -half));
            AddSide(x, y + 1, new Vector3(0, 0, 1), new Vector3(half, 0, half), new Vector3(-half, 0, half));
            AddSide(x, y - 1, new Vector3(0, 0, -1), new Vector3(-half, 0, -half), new Vector3(half, 0, -half));

            void AddSide(int nx, int ny, Vector3 normal, Vector3 a, Vector3 b)
            {
                bool outside = nx < 0 || ny < 0 || ny >= TestMapData.RowCount || nx >= TestMapData.Rows[ny].Length;
                float nh = outside ? OutsideFloor : TestMapData.GroundHeight(nx, ny);
                if (nh >= h - 0.01f) return;
                Vector3 pa = new Vector3(center.x + a.x, h, center.z + a.z);
                Vector3 pb = new Vector3(center.x + b.x, h, center.z + b.z);
                Vector3 qa = new Vector3(pa.x, nh, pa.z);
                Vector3 qb = new Vector3(pb.x, nh, pb.z);
                bool alongX = Mathf.Abs(normal.z) > 0.5f;
                int i0 = verts.Count;
                foreach (var p in new[] { qa, qb, pb, pa })
                {
                    verts.Add(p);
                    normals.Add(normal);
                    colors.Add(p.y >= h - 0.01f ? top : bottom);
                    uvs.Add(new Vector2(alongX ? p.x : p.z, p.y));
                }
                tris.Add(i0 + 0); tris.Add(i0 + 1); tris.Add(i0 + 2);
                tris.Add(i0 + 0); tris.Add(i0 + 2); tris.Add(i0 + 3);
            }
        }

        /// <summary>
        /// (u,v) 자리의 실제 정점 색. 네 모서리 사이를 이중선형보간한 "이웃과
        /// 섞은 색"과 "제 색"을, 가장자리까지 남은 거리(d)로 섞는다 — d가
        /// EdgeBlendMargin보다 크면(칸 중심 쪽) 100% 제 색, 0이면(칸 끝) 100%
        /// 이웃-평균색.
        /// </summary>
        private static Color TileVertexColor(Color own, Color c00, Color c10, Color c01, Color c11, float u, float v)
        {
            Color top = Color.Lerp(c00, c10, u);
            Color bot = Color.Lerp(c01, c11, u);
            Color cornerBlend = Color.Lerp(top, bot, v);
            float d = Mathf.Min(Mathf.Min(u, 1f - u), Mathf.Min(v, 1f - v));
            float t = Mathf.Clamp01((EdgeBlendMargin - d) / EdgeBlendMargin);
            return Color.Lerp(own, cornerBlend, t);
        }

        /// <summary>격자 교차점(cx,cy)에 맞닿은 칸(최대 4개)의 색을 평균낸다.</summary>
        private static Color CornerColor(int cx, int cy)
        {
            Color total = new Color(0, 0, 0, 0);
            int n = 0;
            for (int dy = -1; dy <= 0; dy++)
            {
                for (int dx = -1; dx <= 0; dx++)
                {
                    int ty = cy + dy;
                    int tx = cx + dx;
                    if (ty < 0 || ty >= TestMapData.RowCount) continue;
                    string row = TestMapData.Rows[ty];
                    if (tx < 0 || tx >= row.Length) continue;
                    char ch = row[tx];
                    if (!TestMapData.Legend.TryGetValue(ch, out TestMapData.TileInfo info)) continue;
                    total += info.Color;
                    n++;
                }
            }
            return n == 0 ? Color.black : total / n;
        }

        // ---- 물 --------------------------------------------------------

        /// <summary>강(river)·다리(bridge) 타일 위에 반투명 수면 한 장씩을 얹는다.</summary>
        private void BuildWater()
        {
            ClearBuilt("WaterSurface");
            var positions = new List<Vector3>();
            for (int y = 0; y < TestMapData.RowCount; y++)
            {
                string row = TestMapData.Rows[y];
                for (int x = 0; x < row.Length; x++)
                {
                    char ch = row[x];
                    if (ch != '~' && ch != 'B') continue;
                    float bedHeight = TestMapData.Legend[ch].Height;
                    positions.Add(TestMapData.WorldPos(x, y) + new Vector3(0, TestMapData.WaterSurfaceHeight, 0)); // 107 ② — 강·다리 칸 수면 높이 하나
                }
            }
            if (positions.Count == 0) return;

            var verts = new List<Vector3>();
            var tris = new List<int>();
            float half = TestMapData.TileSize * 0.5f;

            foreach (var center in positions)
            {
                Vector3 p00 = center + new Vector3(-half, 0, -half);
                Vector3 p10 = center + new Vector3(half, 0, -half);
                Vector3 p11 = center + new Vector3(half, 0, half);
                Vector3 p01 = center + new Vector3(-half, 0, half);
                int b = verts.Count;
                verts.Add(p00); verts.Add(p10); verts.Add(p11); verts.Add(p01);
                tris.Add(b + 0); tris.Add(b + 1); tris.Add(b + 2);
                tris.Add(b + 0); tris.Add(b + 2); tris.Add(b + 3);
            }

            var mesh = new Mesh { name = "WaterSurface" };
            mesh.indexFormat = verts.Count > 65000 ? IndexFormat.UInt32 : IndexFormat.UInt16;
            mesh.SetVertices(verts);
            mesh.SetTriangles(tris, 0);
            mesh.RecalculateNormals();
            mesh.RecalculateBounds();

            var go = new GameObject("WaterSurface");
            go.transform.SetParent(transform, false);
            go.AddComponent<MeshFilter>().sharedMesh = mesh;
            var mr = go.AddComponent<MeshRenderer>();
            mr.sharedMaterial = WaterMaterial(Shader.Find(WaterRealShader), Shader.Find("Saga/WaterUnlit"), "Water (generated)", poolDepth: 0f);
            mr.shadowCastingMode = ShadowCastingMode.Off;
        }

        public const string WaterRealShader = "Saga/WaterReal";

        /// <summary>U-0078 — 사실 물 재질. 굴절은 불투명 텍스처가 켜진 파이프라인(PC)일 때만, 셰이더가 없으면 옛 단색 물.
        /// poolDepth &gt; 0 = 땅 위에 얹은 얕은 판(폭포 샘 웅덩이) — 깊이를 그만큼 더해 물빛을 내고 거품은 끈다.</summary>
        public static Material WaterMaterial(Shader real, Shader fallback, string name, float poolDepth)
        {
            if (real == null || !real.isSupported) return new Material(fallback) { name = name };
            var mat = new Material(real) { name = name };
            var urp = GraphicsSettings.currentRenderPipeline as UnityEngine.Rendering.Universal.UniversalRenderPipelineAsset;
            mat.SetFloat("_Refract", urp != null && urp.supportsCameraOpaqueTexture ? 1f : 0f);
            mat.SetFloat("_FakeDepth", poolDepth);
            return mat;
        }

        /// <summary>씬에 이미 구워 저장된 같은 이름 자식(편집기 BuildTestVillageScene 이 Build 한 것)을 치운다 —
        /// Awake 가 다시 지으면 물·폭포가 두 겹으로 겹쳐 그려졌다(U-0078 에서 발견).</summary>
        private void ClearBuilt(string childName)
        {
            for (int i = transform.childCount - 1; i >= 0; i--)
            {
                var c = transform.GetChild(i);
                if (c.name != childName) continue;
                c.gameObject.SetActive(false);
                c.SetParent(null, false);
                if (Application.isPlaying) Destroy(c.gameObject); else DestroyImmediate(c.gameObject);
            }
        }

        // ---- 충돌 --------------------------------------------------------

        /// <summary>
        /// 타일마다 실제 충돌체를 놓는다 — 산·강은 막힌 벽, 다리는 널판
        /// 높이에서, 나머지는 제 타일 높이에서 딛는다. saga-godot의
        /// terrain_builder.gd _build_collision()과 같은 규칙.
        /// </summary>
        private void BuildCollision()
        {
            var parent = new GameObject("TerrainCollision");
            parent.transform.SetParent(transform, false);

            for (int y = 0; y < TestMapData.RowCount; y++)
            {
                string row = TestMapData.Rows[y];
                for (int x = 0; x < row.Length; x++)
                {
                    char ch = row[x];
                    if (!TestMapData.Legend.TryGetValue(ch, out TestMapData.TileInfo info)) continue;

                    Vector3 pos = TestMapData.WorldPos(x, y);
                    Vector3 size;
                    Vector3 center;

                    // PLAN.md 107 ② — 칸마다 땅속 -10m 까지 꽉 찬 기둥. 기둥 옆면이 곧 절벽·강둑이라
                    // 등반이 그 면을 잡는다(옛 산·강의 보이지 않는 벽은 없앴다).
                    float top = TestMapData.GroundHeight(x, y);
                    size = new Vector3(TestMapData.TileSize, top - OutsideFloor, TestMapData.TileSize);
                    center = pos + new Vector3(0, (top + OutsideFloor) * 0.5f, 0);
                    if (ch == 'B')
                    {
                        // 다리 널판은 강바닥 기둥과 따로 — 널판 밑으로 헤엄쳐 지나갈 수 있다.
                        float bridgeTop = info.Height + TestMapData.BridgeClearance;
                        var plank = new GameObject($"Col_bridge_plank_{x}_{y}");
                        plank.transform.SetParent(parent.transform, false);
                        // 보이는 덱(LandmarksBuilder.BuildBridge, 폭 6m·윗면 ≈1.0m)에 맞춘다 — 예전엔 칸 전체 48m 판이라
                        // 다리 옆 허공을 밟았고, 헤엄치면 머리가 판 밑에 걸렸다.
                        plank.transform.position = pos + new Vector3(0, bridgeTop - 0.3f, 0);
                        plank.AddComponent<BoxCollider>().size = new Vector3(7f, 0.6f, TestMapData.TileSize);
                    }

                    var tileGo = new GameObject($"Col_{info.Name}_{x}_{y}");
                    tileGo.transform.SetParent(parent.transform, false);
                    tileGo.transform.position = center;
                    var box = tileGo.AddComponent<BoxCollider>();
                    box.size = size;
                }
            }
            BuildBoundaryWalls(parent.transform);
        }

        /// <summary>PLAN.md 107-3 — 봉우리(`TestMapData.HasPeak`)마다 육각 뿔대 하나. 옆면 기울기 법선 y≈0.38 이라
        /// 등반이 잡고(가파름 문턱 0.5), 윗면은 넘어올라 설 수 있다. 땅과 같은 재질·정점색(바위).
        /// 충돌은 봉우리마다 볼록 MeshCollider.</summary>
        private void BuildPeaks()
        {
            var parent = new GameObject("Peaks");
            parent.transform.SetParent(transform, false);
            var mat = GetComponent<MeshRenderer>().sharedMaterial;
            for (int y = 0; y < TestMapData.RowCount; y++)
            {
                for (int x = 0; x < TestMapData.Cols; x++)
                {
                    if (!TestMapData.HasPeak(x, y)) continue;
                    Vector3 b = TestMapData.PeakBase(x, y);
                    var mesh = BuildPeakMesh(b, TestMapData.PeakHeight(x, y), TestMapData.PeakBaseRadius, TestMapData.PeakTopRadius);
                    var go = new GameObject($"Peak_{x}_{y}");
                    go.transform.SetParent(parent.transform, false);
                    go.AddComponent<MeshFilter>().sharedMesh = mesh;
                    go.AddComponent<MeshRenderer>().sharedMaterial = mat;
                    var col = go.AddComponent<MeshCollider>();
                    col.sharedMesh = mesh;
                    col.convex = true;
                }
            }
        }

        private static Mesh BuildPeakMesh(Vector3 basePos, float height, float rBase, float rTop)
        {
            const int Sides = 6;
            var verts = new List<Vector3>();
            var colors = new List<Color>();
            var normals = new List<Vector3>();
            var uvs = new List<Vector2>();
            var tris = new List<int>();
            float sink = 1.5f; // 고원 윗면 아래로 조금 묻어 틈이 안 보이게
            for (int i = 0; i < Sides; i++)
            {
                float a0 = i * Mathf.PI * 2f / Sides, a1 = (i + 1) * Mathf.PI * 2f / Sides;
                Vector3 d0 = new Vector3(Mathf.Cos(a0), 0f, Mathf.Sin(a0)), d1 = new Vector3(Mathf.Cos(a1), 0f, Mathf.Sin(a1));
                Vector3 b0 = basePos + d0 * rBase + Vector3.down * sink, b1 = basePos + d1 * rBase + Vector3.down * sink;
                Vector3 t0 = basePos + d0 * rTop + Vector3.up * height, t1 = basePos + d1 * rTop + Vector3.up * height;
                Vector3 n = Vector3.Cross(t0 - b0, b1 - b0).normalized;
                if (Vector3.Dot(n, (d0 + d1)) < 0f) n = -n;
                int k = verts.Count;
                foreach (var p in new[] { b0, b1, t1, t0 })
                {
                    verts.Add(p);
                    normals.Add(n);
                    colors.Add(p.y > basePos.y + height * 0.5f ? CliffRockColor : CliffRockDark);
                    uvs.Add(new Vector2(p.x + p.z, p.y));
                }
                tris.Add(k); tris.Add(k + 1); tris.Add(k + 2);
                tris.Add(k); tris.Add(k + 2); tris.Add(k + 3);
            }
            int c = verts.Count;
            Vector3 top = basePos + Vector3.up * height;
            verts.Add(top); normals.Add(Vector3.up); colors.Add(CliffRockColor); uvs.Add(new Vector2(top.x, top.z));
            for (int i = 0; i <= Sides; i++)
            {
                float a = i * Mathf.PI * 2f / Sides;
                Vector3 p = top + new Vector3(Mathf.Cos(a), 0f, Mathf.Sin(a)) * rTop;
                verts.Add(p); normals.Add(Vector3.up); colors.Add(CliffRockColor); uvs.Add(new Vector2(p.x, p.z));
                if (i > 0) { tris.Add(c); tris.Add(c + i); tris.Add(c + i + 1); }
            }
            var mesh = new Mesh { name = "Peak" };
            mesh.SetVertices(verts);
            mesh.SetColors(colors);
            mesh.SetNormals(normals);
            mesh.SetUVs(0, uvs);
            mesh.SetTriangles(tris, 0);
            mesh.RecalculateBounds();
            return mesh;
        }

        /// <summary>PLAN.md 107 ② — 지도 네 변 바깥의 보이지 않는 높은 벽. 테두리 산(30~38m) 꼭대기에서
        /// 밖으로 떨어지지 않게 하고, `NoClimb` 이라 기어오를 수도 없다.</summary>
        private static void BuildBoundaryWalls(Transform parent)
        {
            float w = TestMapData.Cols * TestMapData.TileSize;
            float d = TestMapData.RowCount * TestMapData.TileSize;
            Vector3 c = (TestMapData.WorldPos(0, 0) + TestMapData.WorldPos(TestMapData.Cols - 1, TestMapData.RowCount - 1)) * 0.5f;
            const float T = 4f;
            float hgt = TestMapData.BoundaryWallHeight - OutsideFloor;
            float cy = (TestMapData.BoundaryWallHeight + OutsideFloor) * 0.5f;
            Wall("Boundary_E", new Vector3(c.x + w * 0.5f + T * 0.5f, cy, c.z), new Vector3(T, hgt, d + T * 2));
            Wall("Boundary_W", new Vector3(c.x - w * 0.5f - T * 0.5f, cy, c.z), new Vector3(T, hgt, d + T * 2));
            Wall("Boundary_N", new Vector3(c.x, cy, c.z + d * 0.5f + T * 0.5f), new Vector3(w + T * 2, hgt, T));
            Wall("Boundary_S", new Vector3(c.x, cy, c.z - d * 0.5f - T * 0.5f), new Vector3(w + T * 2, hgt, T));

            void Wall(string name, Vector3 pos, Vector3 size)
            {
                var go = new GameObject(name);
                go.transform.SetParent(parent, false);
                go.transform.position = pos;
                go.AddComponent<BoxCollider>().size = size;
                go.AddComponent<NoClimb>();
            }
        }
    }
}
