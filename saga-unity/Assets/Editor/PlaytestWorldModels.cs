using System.Collections.Generic;
using UnityEditor;
using UnityEngine;
using Saga.Core;
using Saga.Core.Region;

namespace Saga.EditorTools
{
    /// <summary>
    /// U-0037 진단 — `WorldModels.Spawn`: 월드 소품 GLB(좌판·천막·표지판·우물·담)가 읽히고, 콜라이더가 없고, 재질이 툰으로 바뀌고(불투명 glTF 0),
    /// 가장 넓은 변이 maxWidth 이하이고, 바닥이 부모 원점에 닿고, 없는 이름은 null.
    /// `-executeMethod Saga.EditorTools.PlaytestWorldModels.Run` → "[PlaytestWorldModels] OK/FAIL".
    /// </summary>
    public static class PlaytestWorldModels
    {
        [MenuItem("Saga/Playtest World Models")]
        public static void Run()
        {
            PlaytestKit.Begin("[PlaytestWorldModels]");
            using (PlaytestKit.ErrorCounter())
            {
                var parent = new GameObject("__wm").transform;
                foreach (var name in new[] { "market_stall_01", "tent_small_01", "tent_large_01", "signpost_01", "well_01", "wall_block_01", "wall_piece_01" })
                {
                    var go = WorldModels.Spawn(name, parent, 2.4f);
                    if (go == null) { PlaytestKit.Fail($"{name} 을 못 읽음"); continue; }
                    PlaytestKit.Check(go.GetComponentsInChildren<Collider>(true).Length == 0, $"{name}: 콜라이더가 남음");
                    Bounds b = default; bool any = false; int opaqueLeft = 0;
                    var mats = new List<Material>();
                    foreach (var r in go.GetComponentsInChildren<Renderer>(true))
                    {
                        r.GetSharedMaterials(mats);
                        foreach (var m in mats)
                            if (m != null && m.shader != null && m.shader.name == "Shader Graphs/glTF-pbrMetallicRoughness" && !RegionMaterials.IsTransparent(m)) opaqueLeft++;
                        if (!any) { b = r.bounds; any = true; } else b.Encapsulate(r.bounds);
                    }
                    PlaytestKit.Check(any, $"{name}: 렌더러 없음");
                    PlaytestKit.Check(opaqueLeft == 0, $"{name}: 불투명 glTF 가 안 바뀜 {opaqueLeft}");
                    PlaytestKit.Check(Mathf.Max(b.size.x, b.size.z) <= 2.4f + 0.02f, $"{name}: 폭 {Mathf.Max(b.size.x, b.size.z):0.00} > 2.4");
                    PlaytestKit.Check(Mathf.Abs(b.min.y - parent.position.y) < 0.02f, $"{name}: 바닥이 안 닿음 {b.min.y:0.00}");
                    Debug.Log($"[PlaytestWorldModels] {name}: {b.size.x:0.00}×{b.size.y:0.00}×{b.size.z:0.00}");
                }
                PlaytestKit.Check(WorldModels.Spawn("no_such_model", parent) == null && WorldModels.Spawn(null, parent) == null, "없는 이름이 null 이 아님");
                Object.DestroyImmediate(parent.gameObject);
            }
            PlaytestKit.Summary("PlaytestWorldModels");
            if (Application.isBatchMode) EditorApplication.Exit(PlaytestKit.Fails == 0 ? 0 : 1);
        }
    }
}
