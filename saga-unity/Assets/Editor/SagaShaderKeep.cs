using System.Collections.Generic;
using System.IO;
using System.Text.RegularExpressions;
using UnityEditor;
using UnityEditor.Build;
using UnityEditor.Build.Reporting;
using UnityEngine;

namespace Saga.EditorTools
{
    /// <summary>
    /// tasks U-0183 런타임 `Shader.Find` 셰이더 빌드 포함 — 플레이어 빌드는 머티리얼·씬이 참조하는 셰이더만 넣는다. 런타임에 이름으로만 찾는
    /// 셰이더(안개 덩이 URP Particles/Unlit · 3마을 땅 Saga/ForestWorldCurve · 물 Saga/WaterUnlit 등, 참조하는 .mat 0)는 빌드에서 빠져 `Shader.Find` 가 null —
    /// 안개는 Sprites/Default 로 떨어져 둥근 선이 다시 생기고(U-0119), 3마을 땅은 `new Material(null)` 로 짓지 못한다.
    /// 빌드 직전에만 그래픽 설정 "항상 포함" 목록에 <see cref="Names"/> 중 빠진 것을 더하고, 빌드가 끝나면 더한 것만 뺀다 — `ProjectSettings/` 는 git 에 그대로.
    /// URP Lit(머티리얼 1천여 개가 참조)·Sprites/Default(기본 포함)는 안 넣는다 — 항상 포함은 변형을 다 굽기 때문.
    /// </summary>
    public class SagaShaderKeep : IPreprocessBuildWithReport, IPostprocessBuildWithReport
    {
        /// <summary>런타임 코드가 이름으로만 찾는 셰이더. 새 `Shader.Find` 이름을 쓰면 여기에 — `PlaytestShaderKeep` 가 코드 전체를 훑어 빠진 것을 잡는다.</summary>
        public static readonly string[] Names =
        {
            "Universal Render Pipeline/Unlit",
            "Universal Render Pipeline/Particles/Unlit",
            "Shader Graphs/Decal",
            "Saga/WaterUnlit",
            "Saga/WaterfallUnlit",
            "Saga/VertexColorLit",
            "Saga/ForestWorldCurve",
        };

        /// <summary>항상 포함하지 않아도 되는 이름(머티리얼이 넉넉히 참조하거나 기본 포함).</summary>
        public static readonly string[] Covered = { "Universal Render Pipeline/Lit", "Sprites/Default" };

        private static readonly List<Shader> _added = new List<Shader>();

        public int callbackOrder => 0;

        public void OnPreprocessBuild(BuildReport report)
        {
            _added.Clear();
            _added.AddRange(Ensure());
            Debug.Log($"[SagaShaderKeep] 항상 포함에 더함 {_added.Count}: {string.Join(", ", _added.ConvertAll(s => s.name))}");
        }

        public void OnPostprocessBuild(BuildReport report) => Cleanup();

        /// <summary>이번 빌드에 더한 것을 뺀다 — 뒤 콜백과 `SagaPlayerBuild` finally 가 부른다(두 번 불러도 됨).</summary>
        public static void Cleanup()
        {
            Remove(_added);
            _added.Clear();
        }

        private static SerializedObject Settings()
        {
            var assets = AssetDatabase.LoadAllAssetsAtPath("ProjectSettings/GraphicsSettings.asset");
            return assets != null && assets.Length > 0 ? new SerializedObject(assets[0]) : null;
        }

        /// <summary>지금 항상 포함 목록.</summary>
        public static List<Shader> Included()
        {
            var list = new List<Shader>();
            var so = Settings();
            var arr = so?.FindProperty("m_AlwaysIncludedShaders");
            if (arr == null) return list;
            for (int i = 0; i < arr.arraySize; i++) if (arr.GetArrayElementAtIndex(i).objectReferenceValue is Shader s) list.Add(s);
            return list;
        }

        /// <summary><see cref="Names"/> 중 목록에 없는 것을 더하고 더한 것을 돌려준다(못 찾은 이름은 경고).</summary>
        public static List<Shader> Ensure()
        {
            var added = new List<Shader>();
            var so = Settings();
            var arr = so?.FindProperty("m_AlwaysIncludedShaders");
            if (arr == null) { Debug.LogWarning("[SagaShaderKeep] GraphicsSettings 의 항상 포함 목록을 못 읽음"); return added; }
            var have = Included();
            foreach (var n in Names)
            {
                var s = Shader.Find(n);
                if (s == null) { Debug.LogWarning($"[SagaShaderKeep] 셰이더 \"{n}\" 를 못 찾음"); continue; }
                if (have.Contains(s)) continue;
                arr.InsertArrayElementAtIndex(arr.arraySize);
                arr.GetArrayElementAtIndex(arr.arraySize - 1).objectReferenceValue = s;
                have.Add(s);
                added.Add(s);
            }
            so.ApplyModifiedPropertiesWithoutUndo();
            return added;
        }

        /// <summary>더한 것만 뺀다(원래 있던 것은 그대로).</summary>
        public static void Remove(List<Shader> added)
        {
            if (added == null || added.Count == 0) return;
            var so = Settings();
            var arr = so?.FindProperty("m_AlwaysIncludedShaders");
            if (arr == null) return;
            for (int i = arr.arraySize - 1; i >= 0; i--)
            {
                var el = arr.GetArrayElementAtIndex(i);
                if (el.objectReferenceValue is Shader s && added.Contains(s))
                {
                    el.objectReferenceValue = null;
                    arr.DeleteArrayElementAtIndex(i);
                }
            }
            so.ApplyModifiedPropertiesWithoutUndo();
        }

        /// <summary>런타임 코드(Assets 아래 Editor 폴더 밖 .cs)가 `Shader.Find("…")` 로 찾는 이름 전부.</summary>
        public static SortedSet<string> RuntimeFindNames()
        {
            var set = new SortedSet<string>();
            var rx = new Regex("Shader\\.Find\\(\"([^\"]+)\"\\)");
            foreach (var f in Directory.GetFiles(Application.dataPath, "*.cs", SearchOption.AllDirectories))
            {
                string p = f.Replace('\\', '/');
                if (p.Contains("/Editor/")) continue;
                foreach (Match m in rx.Matches(File.ReadAllText(f))) set.Add(m.Groups[1].Value);
            }
            return set;
        }
    }
}
