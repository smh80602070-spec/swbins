using System.Collections.Generic;
using System.IO;
using UnityEditor;
using UnityEngine;

namespace Saga.EditorTools
{
    /// <summary>
    /// 사가만리 주인공 몸을 VRoid 로(사용자 2026-10-08 "테스트 시 주인공 캐릭터는 아직도 변경이 안되었네? vroid로 변경해줘").
    /// 계획표 `tools/char-forge/data/unity_bodies.json` 의 "주역" 자리 = `avatar_sample_b`.
    /// 다른 VRoid 몸(<see cref="SetupNpcCharacterImports"/>)은 공용 동작만 도는 Generic 이지만, 주인공은 등반·활공·수영·공격 상태가 든
    /// `Maria.controller`(Humanoid 클립)를 그대로 써야 해서 VRoid 뼈(`J_Bip_*`)로 Humanoid 아바타를 만들어 함께 굽는다(리타깃).
    /// 결과 `Assets/Art/CharactersRealistic/Resources/HeroBody/hero_vroid.prefab`(+ 아바타) — 다른 VRoid 몸처럼 로컬 전용(.gitignore),
    /// 없으면 게임은 씬에 굳힌 Maria 그대로(<c>PartyBodies.HeroBodyPath</c>).
    /// 배치: `-executeMethod Saga.EditorTools.SetupVroidHero.Bake` → "[SetupVroidHero] OK".
    /// </summary>
    public static class SetupVroidHero
    {
        public const string GlbPath = "Assets/Art/CharactersVroid/avatar_sample_b.glb";
        public const string ControllerPath = "Assets/Animators/Maria.controller";
        public const string OutDir = "Assets/Art/CharactersRealistic/Resources/HeroBody";
        public const string PrefabPath = OutDir + "/hero_vroid.prefab";
        public const string AvatarPath = OutDir + "/hero_vroid_avatar.asset";

        // Unity 사람 뼈 이름 → VRoid 뼈 이름(손가락은 1·2·3 = Proximal·Intermediate·Distal)
        private static Dictionary<string, string> BoneMap()
        {
            var m = new Dictionary<string, string>
            {
                ["Hips"] = "J_Bip_C_Hips", ["Spine"] = "J_Bip_C_Spine", ["Chest"] = "J_Bip_C_Chest", ["UpperChest"] = "J_Bip_C_UpperChest",
                ["Neck"] = "J_Bip_C_Neck", ["Head"] = "J_Bip_C_Head",
            };
            foreach (var (side, s) in new[] { ("Left", "L"), ("Right", "R") })
            {
                m[side + "Shoulder"] = $"J_Bip_{s}_Shoulder"; m[side + "UpperArm"] = $"J_Bip_{s}_UpperArm";
                m[side + "LowerArm"] = $"J_Bip_{s}_LowerArm"; m[side + "Hand"] = $"J_Bip_{s}_Hand";
                m[side + "UpperLeg"] = $"J_Bip_{s}_UpperLeg"; m[side + "LowerLeg"] = $"J_Bip_{s}_LowerLeg";
                m[side + "Foot"] = $"J_Bip_{s}_Foot"; m[side + "Toes"] = $"J_Bip_{s}_ToeBase";
                foreach (var f in new[] { "Thumb", "Index", "Middle", "Ring", "Little" })
                {
                    m[$"{side} {f} Proximal"] = $"J_Bip_{s}_{f}1";
                    m[$"{side} {f} Intermediate"] = $"J_Bip_{s}_{f}2";
                    m[$"{side} {f} Distal"] = $"J_Bip_{s}_{f}3";
                }
            }
            return m;
        }

        [MenuItem("Saga/Setup VRoid Hero (GO)")]
        public static void Bake()
        {
            bool ok = BakeHero(out string why);
            if (ok) { string lodErr = CharacterMeshLod.ApplyAll(out string lod); Debug.Log("[CharacterMeshLod] " + (lodErr == null ? "OK " + lod : "FAIL " + lodErr)); } // U-0057
            Debug.Log(ok ? $"[SetupVroidHero] OK → {PrefabPath}" : $"[SetupVroidHero] FAIL {why}");
            if (Application.isBatchMode) EditorApplication.Exit(ok ? 0 : 1);
        }

        public static bool BakeHero(out string why)
        {
            why = null;
            var glb = AssetDatabase.LoadAssetAtPath<GameObject>(GlbPath);
            var controller = AssetDatabase.LoadAssetAtPath<RuntimeAnimatorController>(ControllerPath);
            if (glb == null) { why = GlbPath + " 없음"; return false; }
            if (controller == null) { why = ControllerPath + " 없음"; return false; }

            var root = new GameObject("hero_vroid");
            try
            {
                var inst = (GameObject)PrefabUtility.InstantiatePrefab(glb, root.transform);
                inst.name = "Armature";
                PrefabUtility.UnpackPrefabInstance(inst, PrefabUnpackMode.Completely, InteractionMode.AutomatedAction);

                var byName = new Dictionary<string, Transform>();
                foreach (var t in root.GetComponentsInChildren<Transform>(true))
                    if (!byName.ContainsKey(t.name)) byName[t.name] = t;

                var human = new List<HumanBone>();
                foreach (var kv in BoneMap())
                {
                    if (!byName.ContainsKey(kv.Value)) continue; // UpperChest·손가락 일부가 없는 몸도 있다
                    human.Add(new HumanBone { humanName = kv.Key, boneName = kv.Value, limit = new HumanLimit { useDefaultValues = true } });
                }
                var skeleton = new List<SkeletonBone>();
                foreach (var t in root.GetComponentsInChildren<Transform>(true))
                    skeleton.Add(new SkeletonBone { name = t.name, position = t.localPosition, rotation = t.localRotation, scale = t.localScale });

                var desc = new HumanDescription
                {
                    human = human.ToArray(), skeleton = skeleton.ToArray(),
                    upperArmTwist = 0.5f, lowerArmTwist = 0.5f, upperLegTwist = 0.5f, lowerLegTwist = 0.5f,
                    armStretch = 0.05f, legStretch = 0.05f, feetSpacing = 0f, hasTranslationDoF = false,
                };
                var avatar = AvatarBuilder.BuildHumanAvatar(root, desc);
                if (avatar == null || !avatar.isValid || !avatar.isHuman) { why = "Humanoid 아바타가 안 섰다(뼈 " + human.Count + ")"; return false; }
                avatar.name = "hero_vroid_avatar";

                if (!Directory.Exists(OutDir)) Directory.CreateDirectory(OutDir);
                AssetDatabase.DeleteAsset(AvatarPath);
                AssetDatabase.CreateAsset(avatar, AvatarPath);

                var animator = root.AddComponent<Animator>();
                animator.avatar = avatar;
                animator.runtimeAnimatorController = controller;
                animator.applyRootMotion = false;
                animator.cullingMode = AnimatorCullingMode.AlwaysAnimate;
                PrefabUtility.SaveAsPrefabAsset(root, PrefabPath);
                AssetDatabase.SaveAssets();
                Debug.Log($"[SetupVroidHero] 뼈 {human.Count} · 몸 {GlbPath} · 컨트롤러 {ControllerPath}");
                return true;
            }
            finally { Object.DestroyImmediate(root); }
        }
    }
}
