using System.IO;
using System.Linq;
using UnityEditor;
using UnityEngine;
using Saga.Core;

namespace Saga.EditorTools
{
    /// <summary>
    /// U-0040 — 로컬 설치 인물 299(`Assets/Art/CharactersDex/*.gltf`)와 공용 동작(`anims/crowd_anims.glb` 의 idle·walk)을 가리키는 런타임 목록 에셋
    /// `Assets/SagaCore/Resources/CrowdBodyList.asset` 을 만든다(로컬 전용 — `.gitignore`). 몸을 이 목록에서 참조해야 빌드에 들어간다(Resources 밖 에셋은 안 들어감).
    /// 설치가 없으면 아무것도 안 만들고 false. `-executeMethod Saga.EditorTools.CrowdBodyListBuilder.BuildBatch`.
    /// </summary>
    public static class CrowdBodyListBuilder
    {
        public const string Dir = "Assets/Art/CharactersDex/";
        public const string AnimsPath = Dir + "anims/crowd_anims.glb";
        public const string AssetPath = "Assets/SagaCore/Resources/CrowdBodyList.asset";

        [MenuItem("Saga/Crowd/Build Body List")]
        public static void BuildMenu() => Build();

        public static void BuildBatch()
        {
            bool ok = Build();
            if (Application.isBatchMode) EditorApplication.Exit(ok ? 0 : 1);
        }

        public static bool Build()
        {
            var files = Directory.Exists(Dir) ? Directory.GetFiles(Dir, "*.gltf").OrderBy(f => f).ToArray() : new string[0];
            if (files.Length == 0 || !File.Exists(AnimsPath))
            {
                Debug.Log("[CrowdBodyListBuilder] SKIP — 설치 없음(몸 또는 anims/crowd_anims.glb)");
                return false;
            }
            AnimationClip idle = null, walk = null;
            foreach (var o in AssetDatabase.LoadAllAssetsAtPath(AnimsPath))
                if (o is AnimationClip c) { if (c.name == "idle") idle = c; else if (c.name == "walk") walk = c; }
            if (idle == null || walk == null) { Debug.LogError("[CrowdBodyListBuilder] 공용 동작에 idle·walk 가 없다"); return false; }
            var bodies = files.Select(f => AssetDatabase.LoadAssetAtPath<GameObject>(f.Replace(Path.DirectorySeparatorChar, (char)47))).Where(b => b != null).ToArray();
            var list = AssetDatabase.LoadAssetAtPath<CrowdBodyList>(AssetPath);
            if (list == null) { list = ScriptableObject.CreateInstance<CrowdBodyList>(); AssetDatabase.CreateAsset(list, AssetPath); }
            list.bodies = bodies; list.idle = idle; list.walk = walk;
            EditorUtility.SetDirty(list);
            AssetDatabase.SaveAssets();
            Debug.Log($"[CrowdBodyListBuilder] 목록 {bodies.Length}/{files.Length} · idle {idle.length:0.00}s · walk {walk.length:0.00}s → {AssetPath}");
            return true;
        }
    }
}
