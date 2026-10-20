using System.Collections.Generic;
using UnityEditor;
using UnityEngine;
using Saga.Core;
using Saga.Go.Data;
using Saga.Go.World;

namespace Saga.EditorTools
{
    /// <summary>
    /// tasks U-0140 진단 — 1만리 마을 `PropsBuilder` 가 씬에 구운 소품이 자체 모델(`Resources/World`)인지(읽기만).
    /// 돌등롱 둘·좌판(이름·몸 = 모델 id·상자 충돌) · 나무 울 둘(충돌 없음·가운데 틈 ≥ 1.8m) · 옛 Kenney 메시 0 ·
    /// 배경 재질(`ForBackdrop` — 사실 PBR, 이름 " (real)")로 다듬음 · 바닥 접지 · 크기 = 모델 실측 ±20%. 모델이 없는 PC 면 건너뛴다고 적고 넘어간다.
    /// </summary>
    public static class PlaytestGoVillageProps
    {
        private static string _tag;
        private static bool _ok;

        public static bool Run(string tag)
        {
            _tag = tag;
            _ok = true;
            var props = Object.FindFirstObjectByType<PropsBuilder>();
            if (props == null) { Fail("PropsBuilder 없음(씬 재빌드?)"); return false; }
            if (WorldModels.Load(PropsBuilder.WorldStall) == null)
            {
                Debug.Log($"[{_tag}] village-props OK - 자체 모델 없음(건너뜀)");
                return true;
            }

            float town = TestMapData.Legend['H'].Height, farm = TestMapData.Legend['F'].Height;
            var sizes = new List<string>();
            CheckPiece(props, "Lantern_House2", PropsBuilder.WorldLantern, town, true, 1, 2.3f, sizes);
            CheckPiece(props, "Lantern_House3", PropsBuilder.WorldLantern, town, true, 1, 2.3f, sizes);
            CheckPiece(props, "MarketStall", PropsBuilder.WorldStall, town, true, 0, 3.0f, sizes);
            var f0 = CheckPiece(props, "Fence_0", PropsBuilder.WorldFence, farm, false, 2, 3.12f, sizes);
            var f1 = CheckPiece(props, "Fence_1", PropsBuilder.WorldFence, farm, false, 2, 3.12f, sizes);
            foreach (var old in new[] { "Fence_2", "FenceGate" })
                if (props.transform.Find(old) != null) Fail($"옛 울 조각 {old} 이 남음");
            float gap = 0f;
            if (f0.HasValue && f1.HasValue)
            {
                gap = f1.Value.min.z > f0.Value.min.z ? f1.Value.min.z - f0.Value.max.z : f0.Value.min.z - f1.Value.max.z;
                if (gap < 1.8f) Fail($"울 가운데 틈 {gap:0.00}m < 1.8");
            }

            // 옛 Kenney 원본 메시가 PropsBuilder 밑에 남지 않음.
            var kenney = new HashSet<Mesh>();
            foreach (var p in new[] { "lantern", "stall-red", "fence", "fence-gate" })
                foreach (var a in AssetDatabase.LoadAllAssetsAtPath($"Assets/Art/Props/{p}.glb"))
                    if (a is Mesh mesh) kenney.Add(mesh);
            int left = 0, opaque = 0;
            var mats = new List<Material>();
            foreach (var r in props.GetComponentsInChildren<Renderer>(true))
            {
                var f = r.GetComponent<MeshFilter>();
                if (f != null && f.sharedMesh != null && kenney.Contains(f.sharedMesh)) left++;
                r.GetSharedMaterials(mats);
                foreach (var m in mats)
                    if (m != null && m.shader != null && m.shader.name == "Shader Graphs/glTF-pbrMetallicRoughness" && !Saga.Core.Region.RegionMaterials.IsTransparent(m) && !m.name.EndsWith(" (real)")) opaque++;
            }
            if (left > 0) Fail($"옛 Kenney 메시 {left} 개가 남음");
            if (opaque > 0) Fail($"배경 재질로 안 다듬은 불투명 glTF {opaque} 개(ForBackdrop 안 거침)");

            if (_ok) Debug.Log($"[{_tag}] village-props OK - 돌등롱 둘·좌판·나무 울 둘(자체 모델·충돌·바닥·크기)·울 틈·Kenney 0·배경 재질 | 틈 {gap:0.00}m · {string.Join(" · ", sizes)}");
            return _ok;
        }

        /// <summary>조각 하나 — `axis` 는 크기를 볼 축(0 = x 폭, 1 = 높이, 2 = z 길이). 돌려주는 값은 월드 경계.</summary>
        private static Bounds? CheckPiece(PropsBuilder props, string name, string model, float ground, bool collider, int axis, float size, List<string> sizes)
        {
            var t = props.transform.Find(name);
            if (t == null) { Fail($"{name} 없음"); return null; }
            if (t.childCount == 0 || t.GetChild(0).name != model) { Fail($"{name} 몸이 {model} 이 아님"); return null; }
            bool hasCol = t.GetComponentsInChildren<Collider>(true).Length > 0;
            if (hasCol != collider) Fail($"{name} 충돌 {(hasCol ? "있음" : "없음")}(바라는 것 {(collider ? "있음" : "없음")})");
            Bounds b = default; bool any = false;
            foreach (var r in t.GetComponentsInChildren<Renderer>(true))
                if (!any) { b = r.bounds; any = true; } else b.Encapsulate(r.bounds);
            if (!any) { Fail($"{name} 렌더러 없음"); return null; }
            if (Mathf.Abs(b.min.y - ground) > 0.05f) Fail($"{name} 바닥 {b.min.y:0.00} ≠ 땅 {ground:0.00}");
            float got = b.size[axis];
            if (got < size * 0.8f || got > size * 1.2f) Fail($"{name} 크기 {got:0.00} ≠ {size:0.00}±20%");
            sizes.Add($"{name} {b.size.x:0.0}×{b.size.y:0.0}×{b.size.z:0.0}");
            return b;
        }

        private static void Fail(string msg)
        {
            Debug.LogError($"[{_tag}] village-props: {msg}");
            _ok = false;
        }
    }
}
