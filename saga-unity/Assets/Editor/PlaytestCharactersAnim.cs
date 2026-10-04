using System.Collections.Generic;
using System.IO;
using UnityEditor;
using UnityEngine;

namespace Saga.EditorTools
{
    /// <summary>
    /// U-0040 동작 시험 — 로컬 설치 인물 299(`Assets/Art/CharactersDex/<id>.gltf`)가 **공용 동작 한 벌**(`anims/crowd_anims.glb` = 자체툴 `<id>_anims.glb`
    /// 18종: idle·walk·attack…, K-0059 `vroid_batch.sh`)로 움직이는지: 몸 최상위를 `Armature` 로 부르고 빈 부모 밑에 두면 클립의 뼈 경로가 맞고,
    /// 몸마다 **핵심 뼈(`J_Bip_*`) 경로 누락이 0**(머리카락·귀 같은 선택 뼈만 없어도 됨), 걷기를 샘플링하면 뼈가 움직인다.
    /// 설치가 없으면 SKIP. `-executeMethod Saga.EditorTools.PlaytestCharactersAnim.Run` → "[PlaytestCharactersAnim] OK/FAIL/SKIP".
    /// </summary>
    public static class PlaytestCharactersAnim
    {
        public const string Dir = "Assets/Art/CharactersDex/";
        public const string SharedAnims = Dir + "anims/crowd_anims.glb";

        [MenuItem("Saga/Playtest Characters Anim")]
        public static void Run()
        {
            PlaytestKit.Begin("[PlaytestCharactersAnim]");
            var bodies = Directory.Exists(Dir) ? Directory.GetFiles(Dir, "*.gltf") : new string[0];
            if (bodies.Length == 0 || !File.Exists(SharedAnims))
            {
                Debug.Log("[PlaytestCharactersAnim] SKIP — 설치 없음(몸 또는 anims/crowd_anims.glb)");
                if (Application.isBatchMode) EditorApplication.Exit(0);
                return;
            }
            using (PlaytestKit.ErrorCounter())
            {
                var clips = new Dictionary<string, AnimationClip>();
                foreach (var o in AssetDatabase.LoadAllAssetsAtPath(SharedAnims))
                    if (o is AnimationClip c && !c.name.StartsWith("__preview")) clips[c.name] = c;
                PlaytestKit.Check(clips.Count >= 8 && clips.ContainsKey("idle") && clips.ContainsKey("walk"), $"공용 클립이 모자람 {clips.Count}");
                clips.TryGetValue("idle", out var idle); clips.TryGetValue("walk", out var walk);
                var idlePaths = new List<string>(); var seen = new HashSet<string>();
                if (idle != null) foreach (var b in AnimationUtility.GetCurveBindings(idle)) if (seen.Add(b.path)) idlePaths.Add(b.path);

                int ok = 0, coreMiss = 0, optMissTotal = 0, noMove = 0; var badIds = new List<string>();
                int maxOpt = 0;
                foreach (var f in bodies)
                {
                    string path = f.Replace(Path.DirectorySeparatorChar, (char)47);
                    string id = Path.GetFileNameWithoutExtension(path);
                    var body = AssetDatabase.LoadAssetAtPath<GameObject>(path);
                    if (body == null) { badIds.Add(id + "(읽기)"); continue; }
                    var inst = Object.Instantiate(body);
                    var holder = new GameObject("holder");
                    inst.name = "Armature";
                    inst.transform.SetParent(holder.transform, false);
                    int core = 0, opt = 0;
                    foreach (var p in idlePaths)
                    {
                        if (holder.transform.Find(p) != null) continue;
                        string leaf = p.Substring(p.LastIndexOf((char)47) + 1);
                        if (leaf.StartsWith("J_Bip_")) core++; else opt++;
                    }
                    coreMiss += core; optMissTotal += opt; maxOpt = Mathf.Max(maxOpt, opt);
                    if (core > 0) badIds.Add($"{id}(핵심 뼈 {core})");
                    var lleg = FindDeep(inst.transform, "J_Bip_L_UpperLeg");
                    if (walk != null && lleg != null)
                    {
                        var before = lleg.localRotation;
                        walk.SampleAnimation(holder, walk.length * 0.25f);
                        if (Quaternion.Angle(before, lleg.localRotation) <= 1f) { noMove++; badIds.Add(id + "(안 움직임)"); }
                    }
                    else { noMove++; badIds.Add(id + "(허벅지 없음)"); }
                    if (core == 0) ok++;
                    Object.DestroyImmediate(holder);
                }
                Debug.Log($"[PlaytestCharactersAnim] 몸 {bodies.Length} · 동작 맞음 {ok} · 핵심 뼈 누락 합 {coreMiss} · 선택 뼈 누락 합 {optMissTotal}(몸당 최대 {maxOpt}) · 안 움직임 {noMove} · 클립 {clips.Count}");
                PlaytestKit.Check(coreMiss == 0 && noMove == 0, $"문제 몸 {badIds.Count}: {string.Join(", ", badIds.GetRange(0, Mathf.Min(8, badIds.Count)))}");
            }
            PlaytestKit.Summary("PlaytestCharactersAnim");
            if (Application.isBatchMode) EditorApplication.Exit(PlaytestKit.Fails == 0 ? 0 : 1);
        }

        private static Transform FindDeep(Transform t, string name)
        {
            if (t.name == name) return t;
            foreach (Transform c in t) { var f = FindDeep(c, name); if (f != null) return f; }
            return null;
        }
    }
}
