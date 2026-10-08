using System;
using System.Collections.Generic;
using System.IO;
using System.Linq;
using System.Reflection;
using UnityEditor;
using UnityEngine;

namespace Saga.EditorTools
{
    /// <summary>
    /// tasks U-0057 인물 몸 Mesh LOD(K-0046 ② 엔진 쪽 — 폰 발열·프레임, 화질 안 깎기).
    /// VRoid 몸은 `.glb`(glTFast 임포터)라 `ModelImporter.generateMeshLods` 가 안 닿는다 → 구운 몸 프리팹(`Art/CharactersRealistic/**`)의
    /// SkinnedMeshRenderer 메시를 복사해 `MeshLodUtility.GenerateMeshLods` 로 LOD 를 붙이고(원본 glb 는 그대로) 복사본을 끼운다.
    /// 복사 메시는 `Art/CharactersRealistic/MeshLod/`(몸 프리팹처럼 로컬 전용) — 같은 glb 메시는 한 벌만.
    /// 배치: `-executeMethod Saga.EditorTools.CharacterMeshLod.Apply` → "[CharacterMeshLod] OK 메시 n · 삼각형 LOD0 a · LOD1 b · LOD2 c".
    /// </summary>
    public static class CharacterMeshLod
    {
        public const string BodiesRoot = "Assets/Art/CharactersRealistic";
        public const string OutDir = BodiesRoot + "/MeshLod";
        public const string VroidRoot = "Assets/Art/CharactersVroid/";
        public const int LodLimit = 3;

        [MenuItem("Saga/Character Mesh LOD (U-0057)")]
        public static void Apply()
        {
            string err = ApplyAll(out string summary);
            if (err != null) Debug.LogError("[CharacterMeshLod] FAIL " + err);
            else Debug.Log("[CharacterMeshLod] OK " + summary);
            if (Application.isBatchMode) EditorApplication.Exit(err == null ? 0 : 1);
        }

        /// <summary>몸 굽기(`BakeVroidHumansReal`·`SetupVroidHero.Bake`)가 끝에 부른다 — 다시 구운 프리팹은 원본 메시라 LOD 를 다시 붙인다(이미 붙은 것은 건너뜀).</summary>
        public static string ApplyAll(out string summary)
        {
            string err = null;
            summary = null;
            int meshes = 0, prefabs = 0;
            long[] tris = new long[LodLimit];
            try
            {
                var gen = FindGenerate(out string sig);
                if (gen == null) { err = "MeshLodUtility.GenerateMeshLods 를 못 찾음"; }
                else
                {
                    Debug.Log("[CharacterMeshLod] API " + sig);
                    if (!Directory.Exists(OutDir)) Directory.CreateDirectory(OutDir);
                    var done = new Dictionary<Mesh, Mesh>();
                    foreach (string guid in AssetDatabase.FindAssets("t:Prefab", new[] { BodiesRoot }))
                    {
                        string path = AssetDatabase.GUIDToAssetPath(guid);
                        if (path.Contains("/_vroid_test/")) continue;
                        var root = PrefabUtility.LoadPrefabContents(path);
                        bool changed = false;
                        try
                        {
                            foreach (var smr in root.GetComponentsInChildren<SkinnedMeshRenderer>(true))
                            {
                                var src = smr.sharedMesh;
                                if (src == null) continue;
                                if (done.ContainsValue(src)) continue; // 이미 LOD 복사본
                                string srcPath = AssetDatabase.GetAssetPath(src);
                                if (!srcPath.StartsWith(VroidRoot) || !srcPath.EndsWith(".glb")) continue;
                                if (!done.TryGetValue(src, out var lod))
                                {
                                    lod = MakeLod(gen, src, srcPath);
                                    done[src] = lod;
                                    if (lod != null)
                                    {
                                        meshes++;
                                        for (int l = 0; l < LodLimit; l++) tris[l] += Triangles(lod, Math.Min(l, lod.lodCount - 1));
                                    }
                                }
                                if (lod == null) continue;
                                smr.sharedMesh = lod;
                                changed = true;
                            }
                            if (changed) { PrefabUtility.SaveAsPrefabAsset(root, path); prefabs++; }
                        }
                        finally { PrefabUtility.UnloadPrefabContents(root); }
                    }
                    AssetDatabase.SaveAssets();
                }
            }
            catch (Exception e) { err = e.ToString(); }
            summary = $"메시 {meshes} · 프리팹 {prefabs} · 삼각형 LOD0 {tris[0]:N0} · LOD1 {tris[1]:N0}({Ratio(tris[1], tris[0])}) · LOD2 {tris[2]:N0}({Ratio(tris[2], tris[0])})";
            return err;
        }

        private static string Ratio(long a, long b) => b > 0 ? (a / (double)b).ToString("0.00") + "배" : "-";

        private static MethodInfo FindGenerate(out string sig)
        {
            sig = null;
            var t = typeof(Editor).Assembly.GetType("UnityEditor.MeshLodUtility");
            var m = t?.GetMethods(BindingFlags.Public | BindingFlags.Static)
                .Where(x => x.Name == "GenerateMeshLods" && x.GetParameters().Length > 0 && x.GetParameters()[0].ParameterType == typeof(Mesh))
                .OrderByDescending(x => x.GetParameters().Length).FirstOrDefault();
            if (m != null) sig = m.ToString();
            return m;
        }

        private static Mesh MakeLod(MethodInfo gen, Mesh src, string srcPath)
        {
            var copy = UnityEngine.Object.Instantiate(src);
            copy.name = src.name;
            var ps = gen.GetParameters();
            var args = new object[ps.Length];
            args[0] = copy;
            for (int i = 1; i < ps.Length; i++)
            {
                var pt = ps[i].ParameterType;
                if (pt == typeof(int)) args[i] = LodLimit;
                else if (ps[i].HasDefaultValue) args[i] = ps[i].DefaultValue;
                else args[i] = pt.IsValueType ? Activator.CreateInstance(pt) : null;
            }
            try { gen.Invoke(null, args); }
            catch (Exception e) { Debug.LogWarning($"[CharacterMeshLod] {srcPath}:{src.name} LOD 못 만듦 — {e.InnerException?.Message ?? e.Message}"); UnityEngine.Object.DestroyImmediate(copy); return null; }
            if (copy.lodCount < 2) { Debug.LogWarning($"[CharacterMeshLod] {srcPath}:{src.name} LOD {copy.lodCount}단 — 그대로 둠"); UnityEngine.Object.DestroyImmediate(copy); return null; }
            string file = $"{OutDir}/{Path.GetFileNameWithoutExtension(srcPath)}__{Safe(src.name)}.asset";
            AssetDatabase.DeleteAsset(file);
            AssetDatabase.CreateAsset(copy, file);
            return copy;
        }

        private static string Safe(string s) => new string(s.Select(c => char.IsLetterOrDigit(c) ? c : '_').ToArray());

        /// <summary>그 LOD 단의 삼각형 수(서브메시 합).</summary>
        public static long Triangles(Mesh m, int lod)
        {
            long n = 0;
            for (int s = 0; s < m.subMeshCount; s++) n += m.GetLod(s, lod).indexCount / 3;
            return n;
        }
    }
}
