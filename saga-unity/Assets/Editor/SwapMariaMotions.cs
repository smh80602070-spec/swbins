using System.Collections.Generic;
using System.Linq;
using UnityEditor;
using UnityEditor.Animations;
using UnityEngine;

namespace Saga.EditorTools
{
    /// <summary>
    /// char-forge ④ — 주역 Maria.controller 의 Mixamo 동작 열여섯을 char-forge 공방 동작(UAL CC0 + 자체 키프레임)으로 바꾼다.
    /// 클립 출처 = `Assets/Art/CharactersForge/_cmp_real_hero_f_01.fbx`(Humanoid, 레시피 anims 15개 — 대기·걷기·달리기·공격·피격·구르기·
    /// 줍기·오르기·활공·수영·물 위 뜨기·점프·왼/오른 옆걸음·죽음). Maria 몸은 Humanoid 아바타라 그대로 받는다.
    /// 상태 이름은 그대로라 코드(`PlayerController` 등)는 안 바뀐다. 뒷걸음은 걷기를 거꾸로(timeScale -1).
    /// **멱등** — 몇 번을 돌려도 같은 결과. 클립이 하나라도 없으면 컨트롤러를 안 건드리고 실패(3)로 끝낸다.
    /// 로그 `SWAP_MARIA states=… blend=… missing=…`, 끝에 `SWAP_MARIA_RESULT OK|FAIL`.
    /// 배치: `-executeMethod Saga.EditorTools.SwapMariaMotions.SwapBatch`
    /// 주의: `BuildMariaLockOnStrafe`·`BuildMariaTraversal` 은 Mixamo 클립으로 컨트롤러를 짓는다 — 다시 돌리면 되돌아가니 그 뒤에 이걸 돌린다.
    /// </summary>
    public static class SwapMariaMotions
    {
        private const string ControllerPath = "Assets/Animators/Maria.controller";
        private const string Fbx = "Assets/Art/CharactersForge/_cmp_real_hero_f_01.fbx";

        // 컨트롤러 상태 이름 → 공방 클립 이름(레시피 anims 키)
        private static readonly Dictionary<string, string> StateClip = new Dictionary<string, string>
        {
            { "Idle", "idle" }, { "Walk", "walk" }, { "Run", "run" }, { "Attack", "attack" }, { "Hit", "hit" }, { "Dodge", "dodge" },
            { "Interaction", "interaction" }, { "Climb", "climb" }, { "Glide", "glide" }, { "Jump", "jump" }, { "Death", "death" },
        };

        [MenuItem("Saga/Char Forge/Swap Maria Motions (Forge)")]
        public static bool Swap()
        {
            BuildCharCompareRealScene.SetupForgeImport(Fbx);   // 옆걸음 루프 표시가 든 새 판으로 클립을 다시 가져온다
            var clips = AssetDatabase.LoadAllAssetsAtPath(Fbx).OfType<AnimationClip>()
                .Where(c => !c.name.StartsWith("__preview__")).GroupBy(c => c.name).ToDictionary(g => g.Key, g => g.First());
            var ctrl = AssetDatabase.LoadAssetAtPath<AnimatorController>(ControllerPath);
            if (ctrl == null) { Debug.LogError("SWAP_MARIA 컨트롤러 없음"); return false; }

            var need = StateClip.Values.Concat(new[] { "strafe_l", "strafe_r", "tread", "swim" }).Distinct().ToList();
            var missing = need.Where(n => !clips.ContainsKey(n)).ToList();
            if (missing.Count > 0)
            {
                Debug.LogError($"SWAP_MARIA missing={string.Join(",", missing)}");
                return false;
            }

            int states = 0, blend = 0;
            foreach (var layer in ctrl.layers)
                Walk(layer.stateMachine, clips, ref states, ref blend);
            EditorUtility.SetDirty(ctrl);
            AssetDatabase.SaveAssets();
            Debug.Log($"SWAP_MARIA states={states} blend={blend} missing=0");
            return states == StateClip.Count && blend >= 7;
        }

        private static void Walk(AnimatorStateMachine sm, Dictionary<string, AnimationClip> clips, ref int states, ref int blend)
        {
            foreach (var cs in sm.states)
            {
                var st = cs.state;
                if (StateClip.TryGetValue(st.name, out var key))
                {
                    st.motion = clips[key];
                    states++;
                }
                else if (st.motion is BlendTree bt)
                {
                    blend += Blend(st.name, bt, clips);
                }
            }
            foreach (var sub in sm.stateMachines) Walk(sub.stateMachine, clips, ref states, ref blend);
        }

        // Strafe 블렌드(2D): 대기(0,0)·앞(걷기)·뒤(걷기 거꾸로)·왼·오른 — 자식 자리(position)로 가른다(몇 번을 돌려도 같다).
        // Swim 블렌드(1D): 첫째 = 물 위 뜨기, 둘째 = 수영.
        private static int Blend(string state, BlendTree bt, Dictionary<string, AnimationClip> clips)
        {
            var ch = bt.children;
            bool twoD = bt.blendType != BlendTreeType.Simple1D;
            int n = 0;
            for (int i = 0; i < ch.Length; i++)
            {
                string key; float ts = 1f;
                if (twoD)
                {
                    var p = ch[i].position;
                    if (p.y < -0.5f) { key = "walk"; ts = -1f; }
                    else if (p.x < -0.5f) key = "strafe_l";
                    else if (p.x > 0.5f) key = "strafe_r";
                    else if (p.y > 0.5f) key = "walk";
                    else key = "idle";
                }
                else key = i == 0 ? "tread" : "swim";
                ch[i].motion = clips[key];
                ch[i].timeScale = ts;
                n++;
            }
            bt.children = ch;
            return n;
        }

        /// <summary>배치: 통과 0, 실패 3.</summary>
        public static void SwapBatch() => EditorApplication.Exit(Swap() ? 0 : 3);
    }
}
