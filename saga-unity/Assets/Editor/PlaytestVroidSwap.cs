using System.Collections.Generic;
using System.IO;
using UnityEditor;
using UnityEditor.Animations;
using UnityEngine;
using Saga.Dungeon.World;

namespace Saga.EditorTools
{
    /// <summary>
    /// U-0034 진단 — 계획표(`unity_bodies.json`)의 **사람 자리 전부**가 VRoid 몸으로 구워지는지(진짜 프리팹은 안 건드리고 `CharactersRealistic/_vroid_test/` 에):
    /// 구운 수 = 표에서 읽은 자리 수 · 프리팹 루트에 Animator+컨트롤러(대기 상태 있음) · 자식 `Armature` 에 스킨 몸 · 키 1.1~2.1m ·
    /// 손 뼈 `J_Bip_R_Hand` 를 `CharacterVisual.FindOrCreateWeaponSocket` 이 찾는다. 계획표나 공용 동작(`anims/crowd_anims.glb`)이 없으면 SKIP.
    /// `-executeMethod Saga.EditorTools.PlaytestVroidSwap.Run` → "[PlaytestVroidSwap] OK/FAIL/SKIP".
    /// </summary>
    public static class PlaytestVroidSwap
    {
        private const string OutDir = "Assets/Art/CharactersRealistic/_vroid_test";

        [MenuItem("Saga/Playtest VRoid Swap")]
        public static void Run()
        {
            PlaytestKit.Begin("[PlaytestVroidSwap]");
            var slots = SetupNpcCharacterImports.VroidHumanSlots(out var notInSpecs);
            if (slots.Count == 0 || !File.Exists(SetupNpcCharacterImports.VroidAnimsPath))
            {
                Debug.Log("[PlaytestVroidSwap] SKIP — 계획표 또는 공용 동작 없음");
                if (Application.isBatchMode) EditorApplication.Exit(0);
                return;
            }
            using (PlaytestKit.ErrorCounter())
            {
                var (baked, failed) = SetupNpcCharacterImports.BakeVroidHumans(OutDir);
                Debug.Log($"[PlaytestVroidSwap] 자리 {slots.Count} · 구움 {baked} · 실패 {failed.Count}({string.Join(",", failed)}) · 표에 없는 이름 {notInSpecs.Count}");
                // 표(Specs)에 없는 이름(Abe·TheBoss·주역 등 별도 파이프라인)은 참고만 — 실패로 안 센다.
                var realFailed = failed.FindAll(x => !x.EndsWith("(표에 없음)"));
                PlaytestKit.Check(baked == slots.Count && realFailed.Count == 0, $"못 구운 자리 {realFailed.Count}: {string.Join(",", realFailed)}");
                int hand = 0, noIdle = 0, badH = 0, noBody = 0; float minH = 9f, maxH = 0f;
                foreach (var (name, _) in slots)
                {
                    var prefab = AssetDatabase.LoadAssetAtPath<GameObject>($"{OutDir}/{name}Vroid.prefab");
                    if (prefab == null) continue;
                    var animator = prefab.GetComponent<Animator>();
                    var ctrl = animator != null ? animator.runtimeAnimatorController as AnimatorController : null;
                    bool idle = false;
                    if (ctrl != null) foreach (var st in ctrl.layers[0].stateMachine.states) if (st.state.name == "Idle" && st.state.motion != null) idle = true;
                    if (!idle) noIdle++;
                    var inst = (GameObject)Object.Instantiate(prefab);
                    var arm = inst.transform.Find("Armature");
                    if (arm == null || inst.GetComponentInChildren<SkinnedMeshRenderer>(true) == null) noBody++;
                    var rs = inst.GetComponentsInChildren<Renderer>(true);
                    if (rs.Length > 0)
                    {
                        var b = rs[0].bounds; foreach (var r in rs) b.Encapsulate(r.bounds);
                        minH = Mathf.Min(minH, b.size.y); maxH = Mathf.Max(maxH, b.size.y);
                        if (b.size.y < 1.1f || b.size.y > 2.1f) badH++;
                    }
                    var socket = CharacterVisual.FindOrCreateWeaponSocket(inst, inst.GetComponent<Animator>());
                    if (socket != null && socket.name == "J_Bip_R_Hand") hand++;
                    Object.DestroyImmediate(inst);
                }
                Debug.Log($"[PlaytestVroidSwap] 대기 없음 {noIdle} · 몸 없음 {noBody} · 키 {minH:0.00}~{maxH:0.00}m(범위 밖 {badH}) · 손 소켓 {hand}/{slots.Count}");
                PlaytestKit.Check(noIdle == 0, $"대기 상태가 없는 자리 {noIdle}");
                PlaytestKit.Check(noBody == 0, $"Armature/스킨 몸이 없는 자리 {noBody}");
                PlaytestKit.Check(badH == 0, $"키가 1.1~2.1m 밖 {badH}");
                PlaytestKit.Check(hand == slots.Count, $"손 소켓을 못 찾은 자리 {slots.Count - hand}");
            }
            PlaytestKit.Summary("PlaytestVroidSwap");
            if (Application.isBatchMode) EditorApplication.Exit(PlaytestKit.Fails == 0 ? 0 : 1);
        }
    }
}
