using System.Collections.Generic;
using UnityEditor;
using UnityEditor.SceneManagement;
using UnityEngine;
using Saga.Core;

namespace Saga.EditorTools
{
    /// <summary>
    /// U-0022 단계 3 진단 — 빌드 씬 여섯을 하나씩 열어(저장 안 함) <see cref="ToonScenePass.ApplyTo"/> 가 재질을 툰으로 바꾸는지:
    /// 바꾼 칸이 있다(게임 씬) · 바꾼 재질은 `Saga/CelToon`(또는 Unlit) · 두 번째 패스는 아무것도 안 바꾼다 · 씬 파일은 안 바뀐다(메모리 재질).
    /// 씬마다 셰이더 이름 분포도 한 줄로 찍는다(바꿀 수 있는 셰이더를 놓친 게 없는지).
    /// `-executeMethod Saga.EditorTools.PlaytestToonScenePass.Run` → "[PlaytestToonScenePass] OK/FAIL".
    /// </summary>
    public static class PlaytestToonScenePass
    {
        [MenuItem("Saga/Playtest Toon Scene Pass")]
        public static void Run()
        {
            PlaytestKit.Begin("[PlaytestToonScenePass]");
            using (PlaytestKit.ErrorCounter())
            {
                int totalConverted = 0;
                foreach (var path in SagaPlayerBuild.Scenes)
                {
                    if (path == SagaFlow.TitleScenePath) continue; // 타이틀은 UI 뿐
                    var scene = EditorSceneManager.OpenScene(path, OpenSceneMode.Single);
                    var hist = new SortedDictionary<string, int>();
                    foreach (var root in scene.GetRootGameObjects())
                        foreach (var r in root.GetComponentsInChildren<Renderer>(true))
                        {
                            if (r is ParticleSystemRenderer || r is TrailRenderer || r is LineRenderer) continue;
                            foreach (var m in r.sharedMaterials)
                            {
                                string n = m == null || m.shader == null ? "(none)" : m.shader.name;
                                hist[n] = hist.TryGetValue(n, out var c) ? c + 1 : 1;
                            }
                        }
                    var top = new List<string>();
                    foreach (var kv in hist) top.Add($"{kv.Key}={kv.Value}");
                    var a = ToonScenePass.ApplyTo(scene);
                    var b = ToonScenePass.ApplyTo(scene);
                    Debug.Log($"[PlaytestToonScenePass] {System.IO.Path.GetFileNameWithoutExtension(path)}: 렌더러 {a.renderers} · 칸 {a.slots} · 바꿈 {a.converted} · 그대로 {a.kept} · 둘째 패스 바꿈 {b.converted} | {string.Join(", ", top)}");
                    PlaytestKit.Check(b.converted == 0, $"{path}: 둘째 패스가 또 바꿈 {b.converted}");
                    totalConverted += a.converted;
                    foreach (var root in scene.GetRootGameObjects())
                        foreach (var r in root.GetComponentsInChildren<Renderer>(true))
                            foreach (var m in r.sharedMaterials)
                                if (m != null && m.shader != null && (m.shader.name == "Shader Graphs/glTF-pbrMetallicRoughness" && !Saga.Core.Region.RegionMaterials.IsTransparent(m)))
                                    PlaytestKit.Check(false, $"{path}: 바꾸고도 불투명 glTF 재질이 남음(반투명은 원본 유지가 설계) {r.name}/{m.name}");
                }
                PlaytestKit.Check(totalConverted > 0, "어느 씬에서도 재질을 못 바꿈");
            }
            PlaytestKit.Summary("PlaytestToonScenePass");
            if (Application.isBatchMode) EditorApplication.Exit(PlaytestKit.Fails == 0 ? 0 : 1);
        }
    }
}
