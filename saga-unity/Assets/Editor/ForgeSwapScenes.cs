using System.Collections.Generic;
using System.Linq;
using UnityEditor;
using UnityEditor.SceneManagement;
using UnityEngine;

namespace Saga.EditorTools
{
    /// <summary>
    /// char-forge 교체(<see cref="SetupNpcCharacterImports.ForgeSwap"/>) 뒤 빌드 씬에 **풀어 박힌** 옛 몸을 갈아 끼운다.
    /// 씬 빌더가 편집 중에 `NpcIdle.SpawnRigged` 로 심은 "Visual" 은 프리팹 연결이 없는 복사본이라 프리팹을 다시 구워도
    /// 옛 Mixamo 메시가 남는다(TestDungeon 역참 사람·TestVillageForest 마을 사람·TestField 손님, 09-28 확인).
    /// 씬 전체를 다시 짓지 않고: 바꾼 몸의 Mixamo FBX 메시를 쓰는 "Visual" 만 찾아 같은 부모·같은 방향·같은 키·같은 발 높이로
    /// 새 프리팹을 심고, 씬 안에서 옛 Visual 의 Animator 를 가리키던 참조는 새 Animator 로 옮긴다.
    /// 로그 `FORGE_SCENE <씬> replaced=n remapped=n dangling=n`, 끝에 `FORGE_SCENE_RESULT OK|FAIL`.
    /// </summary>
    public static class ForgeSwapScenes
    {
        [MenuItem("Saga/Char Forge/Refresh Swapped Bodies In Build Scenes")]
        public static bool Refresh()
        {
            // 공방 교체 자리 + U-0034 VRoid 사람 자리(계획표 `unity_bodies.json`) — 둘 다 씬에 풀어 박힌 옛 Mixamo 메시를 찾는다
            var names = new HashSet<string>(SetupNpcCharacterImports.ForgeSwap.Keys);
            foreach (var (slot, _) in SetupNpcCharacterImports.VroidHumanSlots(out _)) names.Add(slot);
            var swapped = names.ToDictionary(n => $"Assets/Art/CharactersRealistic/{n}/{n}.fbx", n => n);
            // 공방 몸으로 한 번 갈아 끼운 복사본(풀린 채 남은 것)도 VRoid 로 한 번 더 간다
            foreach (var kv in SetupNpcCharacterImports.ForgeSwap) swapped[$"Assets/Art/CharactersForge/{kv.Value}.fbx"] = kv.Key;
            bool ok = true;
            foreach (var path in SagaPlayerBuild.Scenes)
            {
                var scene = EditorSceneManager.OpenScene(path, OpenSceneMode.Single);
                int replaced = 0, remapped = 0, dangling = 0;
                var olds = scene.GetRootGameObjects()
                    .SelectMany(r => r.GetComponentsInChildren<Animator>(true))
                    .Select(a => (anim: a, body: BodyOf(a.gameObject, swapped)))
                    .Where(x => x.body != null && PrefabUtility.GetPrefabInstanceHandle(x.anim.gameObject) == null)
                    .ToList();
                foreach (var (oldAnim, body) in olds)
                {
                    var prefab = AssetDatabase.LoadAssetAtPath<GameObject>(SetupNpcCharacterImports.PrefabPath(body));
                    var old = oldAnim.gameObject;
                    var parent = old.transform.parent;
                    if (prefab == null || parent == null) { dangling++; Debug.LogError($"FORGE_SCENE {path} {old.name}({body}) 프리팹·부모 없음"); continue; }
                    if (!TryBounds(old, out var ob)) continue;

                    var inst = (GameObject)Object.Instantiate(prefab, parent, false);
                    inst.name = old.name;
                    inst.transform.SetSiblingIndex(old.transform.GetSiblingIndex());
                    inst.transform.localPosition = Vector3.zero;
                    inst.transform.localRotation = old.transform.localRotation;
                    inst.SetActive(old.activeSelf);
                    if (TryBounds(inst, out var nb) && nb.size.y > 0.01f)
                    {
                        inst.transform.localScale *= ob.size.y / nb.size.y;
                        TryBounds(inst, out nb);
                        inst.transform.position += Vector3.up * (ob.min.y - nb.min.y);
                    }
                    var newAnim = inst.GetComponent<Animator>();
                    newAnim.cullingMode = oldAnim.cullingMode;
                    newAnim.applyRootMotion = oldAnim.applyRootMotion;

                    remapped += Remap(scene, old, oldAnim, newAnim, ref dangling);
                    Object.DestroyImmediate(old);
                    replaced++;
                }
                if (replaced > 0)
                {
                    EditorSceneManager.MarkSceneDirty(scene);
                    EditorSceneManager.SaveScene(scene);
                }
                Debug.Log($"FORGE_SCENE {path} replaced={replaced} remapped={remapped} dangling={dangling}");
                ok &= dangling == 0;
            }
            Debug.Log("FORGE_SCENE_RESULT " + (ok ? "OK" : "FAIL"));
            return ok;
        }

        /// <summary>배치: `-executeMethod Saga.EditorTools.ForgeSwapScenes.RefreshBatch` — 통과 0, 실패 3.</summary>
        public static void RefreshBatch() => EditorApplication.Exit(Refresh() ? 0 : 3);

        /// <summary>이 Animator 밑 SkinnedMeshRenderer 가 바꾼 몸의 Mixamo FBX 메시를 쓰면 그 몸 이름.</summary>
        private static string BodyOf(GameObject go, Dictionary<string, string> swapped)
        {
            foreach (var smr in go.GetComponentsInChildren<SkinnedMeshRenderer>(true))
            {
                if (smr.sharedMesh == null) continue;
                if (swapped.TryGetValue(AssetDatabase.GetAssetPath(smr.sharedMesh), out var body)) return body;
            }
            return null;
        }

        /// <summary>씬의 다른 컴포넌트가 옛 몸 안을 가리키면: Animator 는 새 것으로, 그 밖은 끊긴 참조로 센다.</summary>
        private static int Remap(UnityEngine.SceneManagement.Scene scene, GameObject old, Animator oldAnim, Animator newAnim, ref int dangling)
        {
            int n = 0;
            var inside = new HashSet<Object>(old.GetComponentsInChildren<Component>(true).Cast<Object>()
                .Concat(old.GetComponentsInChildren<Transform>(true).Select(t => (Object)t.gameObject)));
            foreach (var root in scene.GetRootGameObjects())
            foreach (var c in root.GetComponentsInChildren<Component>(true))
            {
                if (c == null || c is Transform || inside.Contains(c)) continue; // 부모 Transform 의 자식 목록은 Destroy 가 스스로 정리
                var so = new SerializedObject(c);
                var it = so.GetIterator();
                bool changed = false;
                while (it.Next(true))
                {
                    if (it.propertyType != SerializedPropertyType.ObjectReference || it.objectReferenceValue == null) continue;
                    if (!inside.Contains(it.objectReferenceValue)) continue;
                    if (it.objectReferenceValue == oldAnim) { it.objectReferenceValue = newAnim; changed = true; n++; }
                    else if (it.objectReferenceValue == old) { it.objectReferenceValue = newAnim.gameObject; changed = true; n++; }
                    else { dangling++; Debug.LogError($"FORGE_SCENE {scene.path} {c.GetType().Name}.{it.propertyPath} → 옛 몸 안 {it.objectReferenceValue.name}"); }
                }
                if (changed) so.ApplyModifiedPropertiesWithoutUndo();
            }
            return n;
        }

        private static bool TryBounds(GameObject go, out Bounds b)
        {
            b = default;
            bool any = false;
            foreach (var r in go.GetComponentsInChildren<Renderer>(true))
            {
                if (!any) { b = r.bounds; any = true; }
                else b.Encapsulate(r.bounds);
            }
            return any;
        }
    }
}
