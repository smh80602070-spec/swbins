using System.Collections.Generic;
using System.IO;
using System.Linq;
using UnityEditor;
using UnityEngine;

namespace Saga.EditorTools
{
    /// <summary>
    /// char-forge 단계 4 — GO 도감 인물 105 제 몸. `tools/char-forge/_out/hero/hero_&lt;id&gt;.fbx`(레시피 `recipes/hero/`, 인물 한 명 = 한 벌)를
    /// `Assets/Art/CharactersForge/` 에 둔 뒤 이 메뉴가 Humanoid 로 가져오고(<see cref="BuildCharCompareRealScene.SetupForgeImport"/> — 재질·그림 같은 결)
    /// `CharactersForge/Resources/ForgeHero/hero_&lt;id&gt;.prefab` 을 굽는다. 게임은 `PartyBodies.ForgeHero` 가 쓸 때 한 벌씩 읽는다
    /// (씬에 105 벌을 걸면 폰 메모리에 다 올라간다). 컨트롤러는 안 넣는다 — 동행·들판 인물·겨루기 상대가 주인공 컨트롤러를 씌운다.
    /// FBX·프리팹 모두 로컬 전용(.gitignore) — 없는 PC 에선 표의 몸 열일곱으로 선다.
    /// 로그 `FORGE_HERO n=… human=… h=최소~최대 missing=…`, 끝에 `FORGE_HERO_RESULT OK|FAIL`(도감 105 모두 사람 아바타 제 몸이면 OK).
    /// </summary>
    public static class SetupForgeHeroes
    {
        private const string ForgeDir = "Assets/Art/CharactersForge/";
        private const string OutDir = ForgeDir + "Resources/ForgeHero/";

        [MenuItem("Saga/Char Forge/Setup Forge Heroes (105)")]
        public static bool Setup()
        {
            if (!AssetDatabase.IsValidFolder(ForgeDir + "Resources")) AssetDatabase.CreateFolder(ForgeDir.TrimEnd('/'), "Resources");
            if (!AssetDatabase.IsValidFolder(OutDir.TrimEnd('/'))) AssetDatabase.CreateFolder(ForgeDir + "Resources", "ForgeHero");

            var fbxs = Directory.GetFiles(ForgeDir, "hero_*.fbx").Select(p => p.Replace('\\', '/')).OrderBy(p => p).ToList();
            int human = 0;
            float lo = float.MaxValue, hi = 0f;
            var made = new HashSet<string>();
            foreach (var fbx in fbxs)
            {
                BuildCharCompareRealScene.SetupForgeImport(fbx);
                var avatar = AssetDatabase.LoadAllAssetsAtPath(fbx).OfType<Avatar>().FirstOrDefault();
                var model = AssetDatabase.LoadAssetAtPath<GameObject>(fbx);
                if (model == null || avatar == null || !avatar.isValid || !avatar.isHuman)
                {
                    Debug.LogError($"FORGE_HERO {fbx} Humanoid 아님");
                    continue;
                }
                human++;
                var id = Path.GetFileNameWithoutExtension(fbx);
                var inst = (GameObject)PrefabUtility.InstantiatePrefab(model);
                inst.name = id;
                var anim = inst.GetComponent<Animator>();
                if (anim == null) anim = inst.AddComponent<Animator>();
                anim.avatar = avatar;
                anim.runtimeAnimatorController = null;
                anim.applyRootMotion = false;
                anim.cullingMode = AnimatorCullingMode.CullUpdateTransforms;
                float h = Height(inst);
                lo = Mathf.Min(lo, h);
                hi = Mathf.Max(hi, h);
                PrefabUtility.SaveAsPrefabAsset(inst, OutDir + id + ".prefab");
                Object.DestroyImmediate(inst);
                made.Add(id.Substring("hero_".Length));
            }
            AssetDatabase.SaveAssets();

            var missing = Saga.Go.Data.GoHeroes.All.Select(x => x.Id).Where(id => !made.Contains(id)).ToList();
            Debug.Log($"FORGE_HERO n={fbxs.Count} human={human} h={lo:F2}~{hi:F2} missing={missing.Count}" +
                      (missing.Count > 0 ? " " + string.Join(",", missing.Take(12)) : ""));
            bool ok = human == fbxs.Count && missing.Count == 0 && lo > 1.3f && hi < 2.3f;
            Debug.Log("FORGE_HERO_RESULT " + (ok ? "OK" : "FAIL"));
            return ok;
        }

        /// <summary>배치: `-executeMethod Saga.EditorTools.SetupForgeHeroes.SetupBatch` — 통과 0, 실패 3.</summary>
        public static void SetupBatch() => EditorApplication.Exit(Setup() ? 0 : 3);

        private static float Height(GameObject go)
        {
            var rs = go.GetComponentsInChildren<Renderer>();
            if (rs.Length == 0) return 0f;
            var b = rs[0].bounds;
            foreach (var r in rs) b.Encapsulate(r.bounds);
            return b.size.y;
        }
    }
}
