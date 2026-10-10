using System.Collections.Generic;
using UnityEditor;
using UnityEditor.SceneManagement;
using UnityEngine;
using Saga.Core;
using Saga.Core.Region;

namespace Saga.EditorTools
{
    /// <summary>
    /// tasks U-0085 진단 — "배경 사실·인물 툰". 규칙(이름 → 금속·거칠기 표·배경 재질 복제·반투명/발광은 옛 규칙·인물 판별)과
    /// 다섯 판 씬을 열어 씬 패스(<see cref="ToonScenePass.ApplyTo"/>)를 돌린 뒤 "인물 툰 n / 배경 사실 m / 배경에 남은 툰 0" 을 센다.
    /// `-executeMethod Saga.EditorTools.PlaytestToonSplit.Run` → "[PlaytestToonSplit] OK/FAIL". 씬은 저장하지 않는다.
    /// </summary>
    public static class PlaytestToonSplit
    {
        private static readonly string[] Scenes =
        {
            "Assets/Scenes/TestVillage.unity", "Assets/Scenes/TestDungeon.unity", "Assets/Scenes/TestVillageForest.unity",
            "Assets/Scenes/TestField.unity", "Assets/Scenes/TestCity.unity",
        };

        private static void CheckRules()
        {
            PlaytestKit.Check(RegionMaterials.SurfaceFor("castle_wall_slates") == (0f, 0.9f) && RegionMaterials.SurfaceFor("dark_wooden_planks") == (0f, 0.8f)
                && RegionMaterials.SurfaceFor("Rusty_Iron") == (0.6f, 0.5f) && RegionMaterials.SurfaceFor("white_plaster") == (0f, 0.95f)
                && RegionMaterials.SurfaceFor("Material.001") == null, "이름 → 금속·거칠기 표가 다름");

            var lit = Shader.Find("Universal Render Pipeline/Lit");
            var stone = new Material(lit) { name = "stone_wall" };
            stone.SetFloat("_Smoothness", 0.7f);
            var cache = new Dictionary<Material, Material>();
            var made = RegionMaterials.ForBackdrop(stone, cache, out var kind);
            PlaytestKit.Check(made != stone && made.shader == lit && kind == RegionMaterials.Kind.Lit && Mathf.Abs(made.GetFloat("_Smoothness") - 0.1f) < 1e-4f
                && Mathf.Abs(stone.GetFloat("_Smoothness") - 0.7f) < 1e-4f, "돌 재질이 사실(Lit 복제·거칠기 0.9)로 안 바뀜·원본이 바뀜");
            PlaytestKit.Check(RegionMaterials.ForBackdrop(stone, cache, out _) == made && RegionMaterials.ForBackdrop(made, cache, out _) == made, "같은 원본·다듬은 재질을 또 복제함");
            var plain = new Material(lit) { name = "Material.001" };
            PlaytestKit.Check(RegionMaterials.ForBackdrop(plain, cache, out kind) == plain && kind == RegionMaterials.Kind.Lit, "모르는 이름은 원본 그대로여야");
            var glow = new Material(lit) { name = "lamp" };
            glow.SetColor("_EmissionColor", new Color(2f, 1.5f, 0.5f));
            var g = RegionMaterials.ForBackdrop(glow, cache, out kind);
            PlaytestKit.Check(kind == RegionMaterials.Kind.Emissive && g != null && g.shader.name == "Universal Render Pipeline/Unlit", "발광 재질이 옛 규칙(Unlit)이 아님");
            var see = new Material(lit) { name = "glass", renderQueue = 3000 };
            PlaytestKit.Check(RegionMaterials.ForBackdrop(see, cache, out kind) == see && kind == RegionMaterials.Kind.KeptTransparent, "반투명이 그대로가 아님");
            var road = RegionMaterials.Backdrop(null, Color.gray);
            PlaytestKit.Check(road != null && road.shader == lit, "코드 메시 배경 재질이 Lit 이 아님");

            var animGo = new GameObject("__anim", typeof(Animator));
            var child = GameObject.CreatePrimitive(PrimitiveType.Cube); child.transform.SetParent(animGo.transform);
            var skin = new GameObject("__skin", typeof(SkinnedMeshRenderer));
            var prop = GameObject.CreatePrimitive(PrimitiveType.Cube);
            PlaytestKit.Check(RegionMaterials.IsCharacter(child.GetComponent<Renderer>()) && RegionMaterials.IsCharacter(skin.GetComponent<Renderer>())
                && !RegionMaterials.IsCharacter(prop.GetComponent<Renderer>()), "인물 판별(Animator 아래·스킨 메시 / 그냥 소품)이 다름");
            Object.DestroyImmediate(animGo); Object.DestroyImmediate(skin); Object.DestroyImmediate(prop);
        }

        /// <summary>씬 패스 뒤 — 인물 렌더러 칸 중 툰 수, 배경 렌더러 칸 중 사실(Lit 계열) 수, 배경에 남은 툰(잔해 `_rift` 빼고) 수.</summary>
        private static string CheckScene(string path)
        {
            var scene = EditorSceneManager.OpenScene(path);
            var st = ToonScenePass.ApplyTo(scene);
            int charToon = 0, backLit = 0, backToon = 0;
            string sample = null;
            foreach (var root in scene.GetRootGameObjects())
                foreach (var r in root.GetComponentsInChildren<Renderer>(true))
                {
                    if (r is ParticleSystemRenderer || r is TrailRenderer || r is LineRenderer) continue;
                    bool ch = RegionMaterials.IsCharacter(r);
                    foreach (var m in r.sharedMaterials)
                    {
                        if (m == null || m.shader == null) continue;
                        bool toon = m.shader.name == "Saga/CelToon";
                        if (ch && toon) charToon++;
                        else if (!ch && toon && !m.name.EndsWith("_rift")) { backToon++; sample ??= $"{r.name}/{m.name}"; }
                        else if (!ch && (m.shader.name.Contains("/Lit") || m.shader.name.Contains("glTF-pbr"))) backLit++;
                    }
                }
            string name = System.IO.Path.GetFileNameWithoutExtension(path);
            PlaytestKit.Check(backToon == 0, $"{name}: 배경에 툰 {backToon}칸 남음(예 {sample})");
            PlaytestKit.Check(st.toonSlots == 0 || charToon > 0, $"{name}: 패스가 툰으로 바꾼 칸이 있는데 인물 툰이 0");
            return $"{name} 인물 툰 {charToon}·배경 사실 {backLit}(패스 바꿈 {st.converted}: 툰 {st.toonSlots}/사실 {st.litSlots})";
        }

        [MenuItem("Saga/Playtest Toon Split")]
        public static void Run()
        {
            PlaytestKit.Begin("[PlaytestToonSplit]");
            var notes = new List<string>();
            using (PlaytestKit.ErrorCounter())
            {
                CheckRules();
                foreach (var s in Scenes) notes.Add(CheckScene(s));
            }
            Debug.Log("[PlaytestToonSplit] " + string.Join(" | ", notes));
            PlaytestKit.Summary("PlaytestToonSplit");
            if (Application.isBatchMode) EditorApplication.Exit(PlaytestKit.Fails == 0 ? 0 : 1);
        }
    }
}
