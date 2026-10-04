using System.Collections.Generic;
using System.IO;
using UnityEditor;
using UnityEngine;

namespace Saga.EditorTools
{
    /// <summary>
    /// U-0040 점검 — 로컬 설치된 인물 299(`Assets/Art/CharactersDex/<id>.gltf`, K-0065)가 Unity 에서 읽히는지: 전부 임포트되고(프리팹 로드)
    /// 렌더러·몸 메시가 있고, 키가 사람 범위(1.2~2.2m)이고, 재질에 바탕 그림이 걸리고, 임포트 오류가 0 인지, 동작 클립 수.
    /// 설치가 없으면(다른 PC) 건너뛴다(OK 가 아니라 SKIP). `-executeMethod Saga.EditorTools.PlaytestCharactersDex.Run` → "[PlaytestCharactersDex] OK/FAIL/SKIP".
    /// </summary>
    public static class PlaytestCharactersDex
    {
        public const string Dir = "Assets/Art/CharactersDex/";

        [MenuItem("Saga/Playtest Characters Dex")]
        public static void Run()
        {
            PlaytestKit.Begin("[PlaytestCharactersDex]");
            var files = Directory.Exists(Dir) ? Directory.GetFiles(Dir, "*.gltf") : new string[0];
            if (files.Length == 0)
            {
                Debug.Log("[PlaytestCharactersDex] SKIP — 설치 없음(tools/char-forge/engine_characters.sh --install unity)");
                if (Application.isBatchMode) EditorApplication.Exit(0);
                return;
            }
            using (PlaytestKit.ErrorCounter())
            {
                int loaded = 0, noTex = 0, tooTall = 0, tooShort = 0, clips = 0, skinned = 0;
                var bad = new List<string>();
                float minH = 99f, maxH = 0f;
                foreach (var f in files)
                {
                    string path = f.Replace(Path.DirectorySeparatorChar, (char)47);
                    var prefab = AssetDatabase.LoadAssetAtPath<GameObject>(path);
                    if (prefab == null) { bad.Add(Path.GetFileNameWithoutExtension(path)); continue; }
                    loaded++;
                    var rs = prefab.GetComponentsInChildren<Renderer>(true);
                    if (rs.Length == 0) { bad.Add(Path.GetFileNameWithoutExtension(path) + "(렌더러 0)"); continue; }
                    if (prefab.GetComponentInChildren<SkinnedMeshRenderer>(true) != null) skinned++;
                    // 프리팹 렌더러 bounds 는 에셋 상태에서도 메시 bounds 로 얻는다.
                    var b = rs[0].bounds; foreach (var r in rs) b.Encapsulate(r.bounds);
                    minH = Mathf.Min(minH, b.size.y); maxH = Mathf.Max(maxH, b.size.y);
                    if (b.size.y > 2.2f) tooTall++; else if (b.size.y < 1.2f) tooShort++;
                    bool anyTex = false;
                    foreach (var r in rs) foreach (var m in r.sharedMaterials)
                        if (m != null && m.HasProperty("baseColorTexture") && m.GetTexture("baseColorTexture") != null) anyTex = true;
                        else if (m != null && m.HasProperty("_BaseMap") && m.GetTexture("_BaseMap") != null) anyTex = true;
                    if (!anyTex) noTex++;
                    foreach (var o in AssetDatabase.LoadAllAssetsAtPath(path)) if (o is AnimationClip) clips++;
                }
                Debug.Log($"[PlaytestCharactersDex] 파일 {files.Length} · 읽힘 {loaded} · 스킨 몸 {skinned} · 키 {minH:0.00}~{maxH:0.00}m(2.2 초과 {tooTall}·1.2 미만 {tooShort}) · 바탕 그림 없음 {noTex} · 동작 클립 {clips}");
                PlaytestKit.Check(loaded == files.Length, $"못 읽힌 몸 {bad.Count}: {string.Join(",", bad.GetRange(0, Mathf.Min(8, bad.Count)))}");
                PlaytestKit.Check(skinned == loaded, $"스킨 메시가 없는 몸 {loaded - skinned}");
                PlaytestKit.Check(tooTall + tooShort == 0, $"키가 사람 범위 밖 {tooTall + tooShort}");
                PlaytestKit.Check(noTex == 0, $"바탕 그림이 없는 몸 {noTex}");
            }
            PlaytestKit.Summary("PlaytestCharactersDex");
            if (Application.isBatchMode) EditorApplication.Exit(PlaytestKit.Fails == 0 ? 0 : 1);
        }
    }
}
