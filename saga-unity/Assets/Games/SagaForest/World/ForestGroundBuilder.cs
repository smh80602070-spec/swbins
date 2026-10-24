using System.Collections.Generic;
using UnityEngine;
using UnityEngine.Rendering;
using Saga.Forest.Data;

namespace Saga.Forest.World
{
    /// <summary>
    /// VERTICAL_SLICE_FOREST.md(saga-godot) 2·4절 — 마을 지형 하나(잔디).
    /// 30×20칸 × 3m/칸 = 90×60m 단일 메시를 촘촘히 쪼개(1.5m 해상도)
    /// `Saga/ForestWorldCurve` 머티리얼을 입힌다 — 정점이 너무 성기면
    /// (예: Unity 기본 Plane) 곡률이 뭉텅뭉텅 각져 보인다. **콜라이더는
    /// 평평한 원본 메시 그대로 붙인다** — 곡률은 순수 정점 셰이더 트릭이라
    /// 실제 좌표·충돌은 평면이어야 한다(1절 "판정은 항상 평면 좌표로" 원칙).
    /// **바이옴 지형 다양성(2026-09-12 추가)** — `ForestBiomeData`의 네 존을
    /// 정점색(COLOR)으로 굽는다. GO `TerrainBuilder.cs`의 "칸 경계가
    /// 바둑판처럼 갈라져 보이는" 함정과 원인 자체가 다르다 — 여기는 애초에
    /// 타일 격자가 없는 연속 메시라 정점마다 `ForestBiomeData.SampleTint()`를
    /// 그대로 평가하면(칸 단위 보간이 아니라 세계 좌표 연속 함수) 경계가
    /// 저절로 매끈하다.
    /// </summary>
    [RequireComponent(typeof(MeshFilter))]
    [RequireComponent(typeof(MeshRenderer))]
    public class ForestGroundBuilder : MonoBehaviour
    {
        public const float VillageWidth = 90f; // 30 tiles × 3m (VERTICAL_SLICE_FOREST.md 2절)
        public const float VillageDepth = 60f; // 20 tiles × 3m

        private const int SegmentsX = 60; // 1.5m 해상도
        private const int SegmentsZ = 40;

        [SerializeField] private Material groundMaterialOverride;

        // PLAN 102-5 "바닥 한 색" — GO TerrainBuilder.cs와 같은 결의 디테일
        // 오버레이. 런타임 스크립트라 AssetDatabase를 못 써 편집기 빌드
        // 스크립트(BuildTestVillageForestScene.BuildGround)가 채워 준다 —
        // 비어 있으면 셰이더 기본값(흰 텍스처, Strength 0)이라 씬이 안 깨진다.
        [SerializeField] private Texture2D detailTexture;
        [SerializeField] private float detailTiling = 4f;
        [SerializeField] private float detailStrength = 0.5f;

        private void Awake()
        {
            Build();
        }

        public void Build()
        {
            var verts = new List<Vector3>();
            var normals = new List<Vector3>();
            var colors = new List<Color>();
            var kinds = new List<Vector4>();
            var tris = new List<int>();

            float halfW = VillageWidth * 0.5f;
            float halfD = VillageDepth * 0.5f;

            for (int z = 0; z <= SegmentsZ; z++)
            {
                float v = (float)z / SegmentsZ;
                float wz = Mathf.Lerp(-halfD, halfD, v);
                for (int x = 0; x <= SegmentsX; x++)
                {
                    float u = (float)x / SegmentsX;
                    float wx = Mathf.Lerp(-halfW, halfW, u);
                    verts.Add(new Vector3(wx, 0f, wz));
                    normals.Add(Vector3.up);
                    colors.Add(ForestBiomeData.SampleTint(wx, wz));
                    kinds.Add(PhotoKindAt(wx, wz));
                }
            }

            int rowStride = SegmentsX + 1;
            for (int z = 0; z < SegmentsZ; z++)
            {
                for (int x = 0; x < SegmentsX; x++)
                {
                    int i00 = z * rowStride + x;
                    int i10 = i00 + 1;
                    int i01 = i00 + rowStride;
                    int i11 = i01 + 1;
                    tris.Add(i00); tris.Add(i01); tris.Add(i11);
                    tris.Add(i00); tris.Add(i11); tris.Add(i10);
                }
            }

            var mesh = new Mesh { name = "ForestGround" };
            mesh.indexFormat = verts.Count > 65000 ? IndexFormat.UInt32 : IndexFormat.UInt16;
            mesh.SetVertices(verts);
            mesh.SetNormals(normals);
            mesh.SetColors(colors);
            mesh.SetUVs(1, kinds);
            mesh.SetTriangles(tris, 0);
            mesh.RecalculateBounds();

            GetComponent<MeshFilter>().sharedMesh = mesh;

            var mr = GetComponent<MeshRenderer>();
            if (groundMaterialOverride != null)
            {
                mr.sharedMaterial = groundMaterialOverride;
                Saga.Core.WetGround.Own(mr);   // U-0212 비 젖음 — 공유 에셋은 런타임 사본으로 바꿔 끼워 등록(에셋 안 더럽힘)
            }
            else
            {
                var mat = new Material(Shader.Find("Saga/ForestWorldCurve")) { name = "ForestGround (generated)" };
                if (detailTexture != null)
                {
                    mat.SetTexture("_DetailTex", detailTexture);
                    mat.SetFloat("_DetailTiling", detailTiling);
                    mat.SetFloat("_DetailStrength", detailStrength);
                }
                Saga.Core.Region.RegionMaterials.ApplyGroundPhoto(mat, PhotoTiling);
                mr.sharedMaterial = mat;
                Saga.Core.WetGround.Register(mat);   // U-0212 비 젖음(런타임 재질)
            }

            var col = gameObject.AddComponent<MeshCollider>();
            col.sharedMesh = mesh;
        }

        // ---- U-0084 2단계 사진 땅 — 정점 UV1 = 사진 세트 가중치(풀·흙·바위·자갈) ----
        /// <summary>사진 되풀이 크기(m) — 이 판은 사람 키가 실제와 비슷해 사진 실제 크기 그대로.</summary>
        public static readonly Vector4 PhotoTiling = new Vector4(3f, 3f, 4f, 2.5f);

        /// <summary>바깥 = 풀. 바이옴 안쪽으로 갈수록(색 물들임과 같은 반경) 바위 지대 = 바위·자갈, 어둑숲·버섯숲 = 흙 섞인 숲바닥, 꽃밭 = 풀.</summary>
        public static Vector4 PhotoKindAt(float wx, float wz)
        {
            Vector4 w = new Vector4(1, 0, 0, 0);
            foreach (var z in ForestBiomeData.Zones)
            {
                float d = Vector2.Distance(new Vector2(wx, wz), z.Center);
                if (d >= z.Radius) continue;
                float t = d <= z.InnerRadius ? 1f : 1f - Mathf.InverseLerp(z.InnerRadius, z.Radius, d);
                Vector4 k;
                switch (z.Key)
                {
                    case "rocky": k = new Vector4(0.15f, 0, 0.55f, 0.3f); break;
                    case "dark_forest": k = new Vector4(0.45f, 0.55f, 0, 0); break;
                    case "mushroom_forest": k = new Vector4(0.6f, 0.4f, 0, 0); break;
                    default: k = w; break;
                }
                w = Vector4.Lerp(w, k, t);
            }
            return w;
        }
    }
}
