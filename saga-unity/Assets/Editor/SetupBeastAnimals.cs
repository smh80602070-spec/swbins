using System.IO;
using System.Linq;
using UnityEditor;
using UnityEditor.Animations;
using UnityEngine;

namespace Saga.EditorTools
{
    /// <summary>
    /// PLAN.md 109-14-1b 임시 짐승 몸 — 새 원소 괴물 눈여우·회오리매·덩굴뱀에 쓰는 Quaternius CC0 저폴리 동물(`Assets/Art/Creatures/`,
    /// 웹 사가블로 `assets/models` 에서 옮겨 옴). glTFast Mecanim 모드로 들어온 클립으로 `Speed`·`Attack`·`Hit`·`Death` 컨트롤러와
    /// 프리팹(`CreaturesXxxAnimated.prefab`)을 굽는다. 걷기·달리기·대기는 반복 사본을 따로 만든다(임포트 클립은 반복 표시가 없다).
    /// 없는 클립은 상태를 뺀다(뱀은 피격·쓰러짐 클립이 없다). 프리팹이 없으면 `BuildTestVillageScene` 이 사람형 몸으로 둔다.
    /// 배치: `-executeMethod Saga.EditorTools.SetupBeastAnimals.SetupAll`.
    /// </summary>
    public static class SetupBeastAnimals
    {
        private sealed class Spec
        {
            public string Name, Idle, Walk, Run, Attack, Hit, Death;
        }

        private static readonly Spec[] Specs =
        {
            new Spec { Name = "Fox", Idle = "Idle", Walk = "Walk", Run = "Gallop", Attack = "Attack", Hit = "Idle_HitReact_Left", Death = "Death" },
            new Spec { Name = "Birb", Idle = "Idle", Walk = "Walk", Run = "Walk", Attack = "Bite_Front", Hit = "HitRecieve", Death = "Death" },
            new Spec { Name = "Snake", Idle = "Snake_Idle", Walk = "Snake_Walk", Run = "Snake_Walk", Attack = "Snake_Attack" },
        };

        public static string GlbPath(string name) => $"Assets/Art/Creatures/{name}/{name}.glb";
        public static string PrefabPath(string name) => $"Assets/Art/Creatures/{name}/{name}Animated.prefab";

        [MenuItem("Saga/Setup Beast Animals")]
        public static void SetupAll()
        {
            // glTFast 6.14 가 뼈대 있는 메시를 읽을 때 잡 안전 검사가 "SortAndNormalizeBoneWeightsJob ... Complete()" 로 임포트를 깬다 — 굽는 동안만 끈다.
            bool jobDebugger = Unity.Jobs.LowLevel.Unsafe.JobsUtility.JobDebuggerEnabled;
            Unity.Jobs.LowLevel.Unsafe.JobsUtility.JobDebuggerEnabled = false;
            var built = new System.Collections.Generic.List<string>();
            try { SetupEach(built); }
            finally { Unity.Jobs.LowLevel.Unsafe.JobsUtility.JobDebuggerEnabled = jobDebugger; }
            AssetDatabase.SaveAssets();
            Debug.Log($"[SetupBeastAnimals] {string.Join(" ", built)}");
        }

        private static void SetupEach(System.Collections.Generic.List<string> built)
        {
            foreach (var spec in Specs) built.Add($"{spec.Name}={Setup(spec)}");
        }

        private static bool Setup(Spec spec)
        {
            string glb = GlbPath(spec.Name);
            if (!File.Exists(glb)) { Debug.LogWarning($"[SetupBeastAnimals] {glb} 없음"); return false; }
            AssetDatabase.ImportAsset(glb, ImportAssetOptions.ForceUpdate);
            var body = AssetDatabase.LoadAssetAtPath<GameObject>(glb);
            if (body == null) { Debug.LogError($"[SetupBeastAnimals] {glb} 를 못 읽음"); return false; }
            var clips = AssetDatabase.LoadAllAssetsAtPath(glb).OfType<AnimationClip>().Where(c => !c.name.StartsWith("__preview")).ToList();
            Debug.Log($"[SetupBeastAnimals] {spec.Name} 클립 {clips.Count}: {string.Join(",", clips.Select(c => c.name))}");

            AnimationClip Find(string want)
            {
                if (string.IsNullOrEmpty(want)) return null;
                return clips.FirstOrDefault(c => c.name == want) ?? clips.FirstOrDefault(c => c.name.EndsWith("|" + want));
            }

            string clipDir = $"Assets/Art/Creatures/{spec.Name}/Clips";
            if (!AssetDatabase.IsValidFolder(clipDir)) AssetDatabase.CreateFolder($"Assets/Art/Creatures/{spec.Name}", "Clips");
            AnimationClip Looped(string state, string want)
            {
                var src = Find(want);
                if (src == null) return null;
                string path = $"{clipDir}/{spec.Name}_{state}.anim";
                if (AssetDatabase.LoadAssetAtPath<AnimationClip>(path) != null) AssetDatabase.DeleteAsset(path);
                var copy = new AnimationClip { name = $"{spec.Name}_{state}" };
                EditorUtility.CopySerialized(src, copy);
                copy.name = $"{spec.Name}_{state}";
                copy.legacy = false;
                var st = AnimationUtility.GetAnimationClipSettings(copy);
                st.loopTime = true;
                AnimationUtility.SetAnimationClipSettings(copy, st);
                AssetDatabase.CreateAsset(copy, path);
                return copy;
            }

            if (!AssetDatabase.IsValidFolder("Assets/Animators")) AssetDatabase.CreateFolder("Assets", "Animators");
            string cpath = $"Assets/Animators/Beast_{spec.Name}.controller";
            if (AssetDatabase.LoadAssetAtPath<AnimatorController>(cpath) != null) AssetDatabase.DeleteAsset(cpath);
            var controller = AnimatorController.CreateAnimatorControllerAtPath(cpath);
            controller.AddParameter("Speed", AnimatorControllerParameterType.Float);
            var sm = controller.layers[0].stateMachine;

            var idleClip = Looped("Idle", spec.Idle);
            if (idleClip == null) { Debug.LogError($"[SetupBeastAnimals] {spec.Name} 대기 클립 {spec.Idle} 없음"); return false; }
            var idle = sm.AddState("Idle"); idle.motion = idleClip; sm.defaultState = idle;
            AnimatorState walk = null, run = null;
            var walkClip = Looped("Walk", spec.Walk);
            if (walkClip != null) { walk = sm.AddState("Walk"); walk.motion = walkClip; SpeedT(idle, walk, AnimatorConditionMode.Greater, 0.1f); SpeedT(walk, idle, AnimatorConditionMode.Less, 0.1f); }
            var runClip = spec.Run == spec.Walk && walk != null ? null : Looped("Run", spec.Run);
            if (runClip != null) { run = sm.AddState("Run"); run.motion = runClip; var from = walk ?? idle; SpeedT(from, run, AnimatorConditionMode.Greater, 0.6f); SpeedT(run, from, AnimatorConditionMode.Less, 0.6f); }
            Trig(controller, sm, idle, "Attack", Find(spec.Attack), true);
            Trig(controller, sm, idle, "Hit", Find(spec.Hit), true);
            Trig(controller, sm, idle, "Death", Find(spec.Death), false);
            EditorUtility.SetDirty(controller);

            var instance = (GameObject)PrefabUtility.InstantiatePrefab(body);
            instance.name = spec.Name;
            var animator = instance.GetComponent<Animator>();
            if (animator == null) animator = instance.AddComponent<Animator>();
            animator.runtimeAnimatorController = controller;
            animator.applyRootMotion = false;
            animator.cullingMode = AnimatorCullingMode.CullUpdateTransforms;
            PrefabUtility.SaveAsPrefabAsset(instance, PrefabPath(spec.Name));
            Object.DestroyImmediate(instance);
            Debug.Log($"[SetupBeastAnimals] saved {PrefabPath(spec.Name)}");
            return true;
        }

        private static void SpeedT(AnimatorState from, AnimatorState to, AnimatorConditionMode mode, float threshold)
        {
            var t = from.AddTransition(to);
            t.hasExitTime = false;
            t.duration = 0.15f;
            t.AddCondition(mode, threshold, "Speed");
        }

        private static void Trig(AnimatorController controller, AnimatorStateMachine sm, AnimatorState idle, string trigger, AnimationClip clip, bool back)
        {
            if (clip == null) return;
            var to = sm.AddState(trigger);
            to.motion = clip;
            controller.AddParameter(trigger, AnimatorControllerParameterType.Trigger);
            var t = sm.AddAnyStateTransition(to);
            t.hasExitTime = false;
            t.duration = 0.1f;
            t.canTransitionToSelf = false;
            t.AddCondition(AnimatorConditionMode.If, 0, trigger);
            if (!back) return;
            var r = to.AddTransition(idle);
            r.hasExitTime = true;
            r.exitTime = 0.9f;
            r.duration = 0.15f;
        }
    }
}
