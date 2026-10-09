using System.Collections.Generic;
using System.IO;
using UnityEditor;
using UnityEngine;

namespace Saga.EditorTools
{
    /// <summary>
    /// tasks U-0065 — 사가천하 지도·싸움터 인물(`RealmFigure`)이 입는 몸 9벌(<see cref="BuildTestCityScene"/> 의 무장·재야 몸 표)에
    /// 사가천하 전용 Humanoid 아바타를 굽는다. U-0034 가 몸을 VRoid 로 다시 구우며 바깥 Animator 가 Generic(아바타 없음)이 돼
    /// `RealmFigure.BuildBody` 가 대역으로 돌아가던 회귀를 고친다. 뼈 지도는 주인공(<see cref="SetupVroidHero"/>)과 같다.
    /// 공용 몸 프리팹·씬은 안 건드린다 — 결과는 `Resources/RealmAvatars/&lt;프리팹 이름&gt;.asset`(로컬 전용 .gitignore, 주인공 아바타와 같은 자리 규칙).
    /// 배치: `-executeMethod Saga.EditorTools.BakeRealmAvatars.Run` → "[BakeRealmAvatars] OK 9/9". `BakeVroidHumansReal` 도 끝에서 부른다.
    /// </summary>
    public static class BakeRealmAvatars
    {
        public const string OutDir = "Assets/Art/CharactersRealistic/Resources/RealmAvatars";

        [MenuItem("Saga/Bake Realm Avatars (REALM)")]
        public static void Run()
        {
            string err = BakeAll(out string summary);
            Debug.Log(err == null ? "[BakeRealmAvatars] OK " + summary : "[BakeRealmAvatars] FAIL " + summary + " — " + err);
            if (Application.isBatchMode) EditorApplication.Exit(err == null ? 0 : 1);
        }

        /// <summary>몸 표 전부를 굽는다. 실패한 몸이 있으면 그 이름들(없으면 null). 프리팹이 없는 몸(묶음 없는 PC)은 건너뛴다.</summary>
        public static string BakeAll(out string summary)
        {
            var names = new List<string>(BuildTestCityScene.OfficerBodyNames);
            names.AddRange(BuildTestCityScene.WandererBodyNames);
            if (!Directory.Exists(OutDir)) Directory.CreateDirectory(OutDir);
            int ok = 0, have = 0;
            var failed = new List<string>();
            foreach (var n in names)
            {
                var prefab = AssetDatabase.LoadAssetAtPath<GameObject>(SetupNpcCharacterImports.PrefabPath(n));
                if (prefab == null) continue;
                have++;
                if (Bake(prefab, out string why)) ok++;
                else failed.Add($"{n}({why})");
            }
            AssetDatabase.SaveAssets();
            summary = $"{ok}/{have}";
            return failed.Count == 0 ? null : string.Join(", ", failed);
        }

        private static bool Bake(GameObject prefab, out string why)
        {
            why = null;
            // 런타임과 같은 계층(프리팹 뿌리 = Animator)에서 아바타를 세워야 뼈 경로가 맞는다.
            var root = (GameObject)PrefabUtility.InstantiatePrefab(prefab);
            try
            {
                PrefabUtility.UnpackPrefabInstance(root, PrefabUnpackMode.Completely, InteractionMode.AutomatedAction);
                root.name = prefab.name;
                var byName = new Dictionary<string, Transform>();
                foreach (var t in root.GetComponentsInChildren<Transform>(true))
                    if (!byName.ContainsKey(t.name)) byName[t.name] = t;

                var human = new List<HumanBone>();
                foreach (var kv in SetupVroidHero.BoneMap())
                {
                    if (!byName.ContainsKey(kv.Value)) continue;
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
                avatar.name = prefab.name;
                string path = $"{OutDir}/{prefab.name}.asset";
                AssetDatabase.DeleteAsset(path);
                AssetDatabase.CreateAsset(avatar, path);
                Debug.Log($"[BakeRealmAvatars] {prefab.name} 뼈 {human.Count}");
                return true;
            }
            finally { Object.DestroyImmediate(root); }
        }
    }
}
