using System.Collections.Generic;
using UnityEditor;
using UnityEngine;
using Saga.Core.Region;
using Saga.Forest.Data;

namespace Saga.EditorTools
{
    /// <summary>
    /// U-0033 진단 — 집 가구 id ↔ 자체툴 실내 물건 GLB 표: 모든 id 가 실제 가구로 읽히고, 모델이 올라가 있고(Resources.Load),
    /// 크기가 상식 범위(가장 긴 변 0.05~3m), 툰 재질 변환 뒤 불투명 glTF 재질이 안 남고, 표에 없는 가구는 null(도형 유지).
    /// `-executeMethod Saga.EditorTools.PlaytestForestFurnitureModels.Run` → "[PlaytestForestFurnitureModels] OK/FAIL".
    /// </summary>
    public static class PlaytestForestFurnitureModels
    {
        [MenuItem("Saga/Playtest Forest Furniture Models")]
        public static void Run()
        {
            PlaytestKit.Begin("[PlaytestForestFurnitureModels]");
            using (PlaytestKit.ErrorCounter())
            {
                int n = 0;
                var kept = new List<string>();
                foreach (var kv in ForestFurnitureModels.All)
                {
                    n++;
                    PlaytestKit.Check(FurnitureItem.Get(kv.Key) != null, $"표의 가구 id '{kv.Key}' 가 FurnitureItem 에 없다");
                    var prefab = ForestFurnitureModels.Load(kv.Key);
                    if (!PlaytestKit_CheckNotNull(prefab, $"{kv.Key} → World/{kv.Value} 모델을 못 읽음")) continue;
                    var go = Object.Instantiate(prefab);
                    var cache = new Dictionary<Material, Material>();
                    Bounds b = default; bool any = false; int slots = 0, toon = 0, opaqueLeft = 0;
                    var mats = new List<Material>();
                    foreach (var r in go.GetComponentsInChildren<Renderer>(true))
                    {
                        r.GetSharedMaterials(mats);
                        foreach (var m in mats)
                        {
                            slots++;
                            var made = RegionMaterials.FromGltf(m, cache, out _);
                            if (made == null) continue;
                            if (made != m) toon++;
                            else if (m.shader != null && m.shader.name == "Shader Graphs/glTF-pbrMetallicRoughness" && !RegionMaterials.IsTransparent(m)) opaqueLeft++;
                        }
                        if (!any) { b = r.bounds; any = true; } else b.Encapsulate(r.bounds);
                    }
                    PlaytestKit.Check(any, $"{kv.Key}: 렌더러가 없음");
                    float longest = Mathf.Max(b.size.x, b.size.y, b.size.z);
                    PlaytestKit.Check(longest >= 0.05f && longest <= 3f, $"{kv.Key}: 크기가 이상함 {b.size}");
                    PlaytestKit.Check(opaqueLeft == 0, $"{kv.Key}: 불투명 glTF 재질이 안 바뀜 {opaqueLeft}");
                    Debug.Log($"[PlaytestForestFurnitureModels] {kv.Key} → {kv.Value}: 크기 {b.size.x:0.00}×{b.size.y:0.00}×{b.size.z:0.00} · 재질 {slots}(툰 {toon})");
                    Object.DestroyImmediate(go);
                }
                foreach (var item in FurnitureItem.Catalog)
                    if (ForestFurnitureModels.ModelName(item.Id) == null) kept.Add(item.Id);
                PlaytestKit.Check(n >= 12, $"표 항목이 너무 적다 {n}");
                PlaytestKit.Check(ForestFurnitureModels.Load("no_such_item") == null && ForestFurnitureModels.Load(null) == null, "없는 id 가 null 이 아님");
                Debug.Log($"[PlaytestForestFurnitureModels] 표 {n} · 도형 유지 {kept.Count}: {string.Join(",", kept)}");
            }
            PlaytestKit.Summary("PlaytestForestFurnitureModels");
            if (Application.isBatchMode) EditorApplication.Exit(PlaytestKit.Fails == 0 ? 0 : 1);
        }

        private static bool PlaytestKit_CheckNotNull(Object o, string msg)
        {
            PlaytestKit.Check(o != null, msg);
            return o != null;
        }
    }
}
