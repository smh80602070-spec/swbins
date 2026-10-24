using System.Collections.Generic;
using System.Linq;
using UnityEditor;
using UnityEditor.SceneManagement;
using UnityEngine;
using Saga.Core;

namespace Saga.EditorTools
{
    /// <summary>
    /// tasks U-0217 인물 얼굴 그림자(원신식, 고돗 G-0248 probe_face_light 짝) — `-executeMethod Saga.EditorTools.PlaytestFaceLight.Run`(-quit 없이).
    /// ① 셰이더 `Saga/CelToon` 오류 0 · `_FaceMode` 기본 0(옛 픽셀) · `_FaceFlatten` 0.65 ② 얼굴 가름 규칙(재질 이름)
    /// ③ 3마을 씬(VRoid NPC) + 주인공 VRoid 몸에 툰 패스 → <see cref="FaceLight.ApplyTo"/>: 몸 셋 이상 · 얼굴 표면 `_FaceMode` 1 · 몸 살갗·옷·머리카락 0 ·
    ///    얼굴 없는 몸(괴물·옛 몸)은 안 붙음 · 사본은 몸마다(공유 재질 안 고침) ④ 한 프레임(TickAll) 뒤 `_HeadFwd` 0 벡터 아님·수평 앞이 몸 앞과 같은 쪽
    /// ⑤ `SAGA_FACE_LIGHT=0` 이면 붙는 몸 0 · 전부 `_FaceMode` 0. 씬은 저장 안 함.
    /// 화면: `FaceShots`(GUI, -batchmode 없이) — 같은 몸·같은 자세에서 `_FaceMode` 0/1 × 빛 셋(씬 해·옆빛·높은 해) 얼굴 가까이.
    /// </summary>
    public static class PlaytestFaceLight
    {
        private const string Tag = "[PlaytestFaceLight]";
        private const string ScenePath = "Assets/Scenes/TestVillageForest.unity";

        public static void Run()
        {
            PlaytestKit.Begin(Tag);
            string knob = System.Environment.GetEnvironmentVariable("SAGA_FACE_LIGHT");
            using (PlaytestKit.ErrorCounter())
            {
                try
                {
                    CheckShader();
                    CheckRules();
                    CheckScene();
                }
                catch (System.Exception e) { PlaytestKit.Fail("예외 " + e); }
                finally
                {
                    System.Environment.SetEnvironmentVariable("SAGA_FACE_LIGHT", knob);
                    FaceLight.DetachAll();
                }
            }
            PlaytestKit.Summary("PlaytestFaceLight");
            if (Application.isBatchMode) EditorApplication.Exit(PlaytestKit.Fails == 0 ? 0 : 1);
        }

        private static void CheckShader()
        {
            var sh = Shader.Find("Saga/CelToon");
            if (sh == null) { PlaytestKit.Fail("Saga/CelToon 없음"); return; }
            var msgs = ShaderUtil.GetShaderMessages(sh);
            int errs = msgs.Count(x => x.severity == UnityEditor.Rendering.ShaderCompilerMessageSeverity.Error);
            foreach (var x in msgs.Where(x => x.severity == UnityEditor.Rendering.ShaderCompilerMessageSeverity.Error).Take(5)) Debug.LogWarning($"{Tag} shader msg {x.message} @{x.line}");
            PlaytestKit.Check(!ShaderUtil.ShaderHasError(sh) && errs == 0, $"CelToon 컴파일 오류 {errs}");
            var probe = new Material(sh);
            PlaytestKit.Check(probe.HasProperty("_FaceMode") && probe.GetFloat("_FaceMode") == 0f, "_FaceMode 기본이 0 이 아님(옛 픽셀이 바뀜)");
            PlaytestKit.Check(probe.HasProperty("_FaceFlatten") && Mathf.Abs(probe.GetFloat("_FaceFlatten") - 0.65f) < 1e-4f, "_FaceFlatten 기본 0.65 아님");
            PlaytestKit.Check(probe.HasProperty("_HeadFwd") && probe.GetVector("_HeadFwd") == Vector4.zero, "_HeadFwd 기본 0 아님");
            Object.DestroyImmediate(probe);
            Debug.Log($"{Tag} shader OK - 오류 0 · _FaceMode 기본 0 · _FaceFlatten 0.65 · _HeadFwd 0");
        }

        private static void CheckRules()
        {
            var yes = new[] { "N00_000_00_Face_00_SKIN (toon)", "N00_000_00_FaceMouth_00_FACE", "N00_000_00_FaceBrow_00_FACE (toon) (outline)", "N00_000_00_EyeIris_00_EYE", "N00_000_00_Body_00_SKIN" };
            var no = new[] { "N00_000_00_HairBack_00_HAIR", "N00_001_01_Tops_01_CLOTH (toon)", "N00_000_Hair_00_HAIR", "Goblin_Body", "" };
            foreach (var n in yes) PlaytestKit.Check(FaceLight.FacePartName(n), $"살갗·얼굴 부품인데 아님: {n}");
            foreach (var n in no) PlaytestKit.Check(!FaceLight.FacePartName(n), $"살갗·얼굴 부품 아닌데 맞음: {n}");
            Debug.Log($"{Tag} rules OK - 살갗·얼굴·눈 {yes.Length} 맞음 · 머리카락·옷·괴물 {no.Length} 아님 (몸 살갗은 얼굴 메시·_face 재질일 때만 표면)");
        }

        /// <summary>3마을 씬 + 주인공 VRoid 를 세우고 툰 패스까지(런타임과 같은 재질).</summary>
        public static UnityEngine.SceneManagement.Scene Setup(out GameObject hero)
        {
            var s = EditorSceneManager.OpenScene(ScenePath);
            hero = null;
            var prefab = Resources.Load<GameObject>(VroidHeroSwap.HeroBodyPath);
            if (prefab != null)
            {
                hero = Object.Instantiate(prefab);
                hero.name = VroidHeroSwap.SwappedName;
                hero.transform.position = new Vector3(0f, -500f, 0f);
                UnityEngine.SceneManagement.SceneManager.MoveGameObjectToScene(hero, s);
            }
            var st = ToonScenePass.ApplyTo(s);
            Debug.Log($"{Tag} toon pass 렌더러 {st.renderers} · 툰 칸 {st.toonSlots} · 바꿈 {st.converted}");
            return s;
        }

        private static Animator[] Animators(UnityEngine.SceneManagement.Scene s) =>
            s.GetRootGameObjects().SelectMany(r => r.GetComponentsInChildren<Animator>(true)).ToArray();

        private static void CheckScene()
        {
            var s = Setup(out var hero);
            PlaytestKit.Check(hero != null, "주인공 VRoid 몸(Resources/HeroBody/hero_vroid) 없음");
            var anims = Animators(s);
            // 공유 재질(툰 패스 사본)의 _FaceMode 를 미리 적어 둔다 — 붙인 뒤에도 그대로여야(몸마다 사본만)
            var shared = new Dictionary<Material, float>();
            foreach (var a in anims)
                foreach (var r in a.GetComponentsInChildren<Renderer>(true))
                    foreach (var m in r.sharedMaterials) if (m != null && m.HasProperty(FaceLight.FaceModeId)) shared[m] = m.GetFloat(FaceLight.FaceModeId);

            int changed = 0;
            foreach (var a in anims) changed += FaceLight.ApplyTo(a);
            var bodies = FaceLight.All.ToList();
            Debug.Log($"{Tag} scene Animator {anims.Length} · 얼굴 붙은 몸 {bodies.Count} · 바꾼 칸 {changed}");
            PlaytestKit.Check(bodies.Count >= 3, $"얼굴 붙은 몸 {bodies.Count} < 3");
            PlaytestKit.Check(hero != null && bodies.Any(b => b.anim != null && b.anim.transform.IsChildOf(hero.transform)), "주인공 VRoid 에 안 붙음");

            int faceOn = 0, otherOff = 0, bad = 0;
            var faceNames = new SortedSet<string>(); var otherNames = new SortedSet<string>();
            foreach (var b in bodies)
            {
                foreach (var r in b.anim.GetComponentsInChildren<Renderer>(true))
                {
                    if (r.GetComponentInParent<Animator>(true) != b.anim) continue;
                    foreach (var m in r.sharedMaterials)
                    {
                        if (m == null || !m.HasProperty(FaceLight.FaceModeId)) continue;
                        bool face = b.mats.Contains(m);
                        float v = m.GetFloat(FaceLight.FaceModeId);
                        if (face) { if (v > 0.5f) faceOn++; else bad++; faceNames.Add(r.name + "/" + m.name.Split(' ')[0]); }
                        else { if (v < 0.5f) otherOff++; else bad++; otherNames.Add(r.name + "/" + m.name.Split(' ')[0]); }
                    }
                }
            }
            Debug.Log($"{Tag} 얼굴 표면 {string.Join(", ", faceNames.Take(12))}");
            Debug.Log($"{Tag} 그 밖(0) {string.Join(", ", otherNames.Take(12))}");
            PlaytestKit.Check(faceOn > 0 && bad == 0, $"얼굴 1 {faceOn} · 잘못 {bad}");
            PlaytestKit.Check(otherNames.Any(n => n.ToLowerInvariant().Contains("hair")) && otherNames.Any(n => n.ToLowerInvariant().Contains("body")), "머리카락·몸 재질이 0 쪽에 없음");
            PlaytestKit.Check(faceNames.All(n => !n.ToLowerInvariant().Contains("hair") && !n.ToLowerInvariant().Contains("cloth")), "머리카락·옷이 얼굴로 잡힘");
            Debug.Log($"{Tag} surfaces OK - 얼굴 _FaceMode 1 칸 {faceOn} · 몸 살갗·옷·머리카락 0 칸 {otherOff}");

            // 얼굴 없는 몸(괴물·옛 몸)은 안 붙음
            var none = anims.Where(a => !FaceLight.TryGet(a, out _)).Select(a => a.name).Distinct().Take(6).ToList();
            Debug.Log($"{Tag} 안 붙은 몸(얼굴 메시 없음) {anims.Length - bodies.Count}: {string.Join(", ", none)}");
            var goblinPrefab = AssetDatabase.LoadAssetAtPath<GameObject>("Assets/Art/CharactersRealistic/Goblin/GoblinAnimated.prefab");
            if (goblinPrefab != null)
            {
                var gob = (GameObject)PrefabUtility.InstantiatePrefab(goblinPrefab, s);
                gob.transform.position = new Vector3(5f, -500f, 0f);
                ToonScenePass.ApplyTo(s);
                int gobChanged = 0;
                foreach (var ga in gob.GetComponentsInChildren<Animator>(true)) gobChanged += FaceLight.ApplyTo(ga);
                int gobToon = gob.GetComponentsInChildren<Renderer>(true).SelectMany(r => r.sharedMaterials).Count(m => m != null && m.HasProperty(FaceLight.FaceModeId));
                PlaytestKit.Check(gobChanged == 0 && gob.GetComponentsInChildren<Animator>(true).All(ga => !FaceLight.TryGet(ga, out _)), $"괴물(고블린)에 붙음 {gobChanged}");
                Debug.Log($"{Tag} monster OK - 고블린 툰 칸 {gobToon} · 얼굴 붙음 0");
                Object.DestroyImmediate(gob);
            }
            else PlaytestKit.Fail("괴물 본보기(GoblinAnimated.prefab) 없음");

            // 공유 재질 그대로
            int sharedChanged = shared.Count(kv => kv.Key != null && Mathf.Abs(kv.Key.GetFloat(FaceLight.FaceModeId) - kv.Value) > 1e-4f);
            PlaytestKit.Check(sharedChanged == 0, $"공유 재질 _FaceMode 바뀜 {sharedChanged}");
            int perBody = bodies.SelectMany(b => b.mats).Count();
            int distinct = bodies.SelectMany(b => b.mats).Distinct().Count();
            PlaytestKit.Check(perBody == distinct, $"얼굴 사본이 몸끼리 겹침 {perBody}/{distinct}");
            Debug.Log($"{Tag} copies OK - 공유 재질 바뀜 0 · 얼굴 사본 {distinct}(몸마다)");

            // 한 프레임 뒤 머리 앞
            FaceLight.TickAll(true);
            int zero = 0, back = 0;
            foreach (var b in bodies)
            {
                foreach (var m in b.mats) if (m.GetVector(FaceLight.HeadFwdId).sqrMagnitude < 0.5f) zero++;
                var f = b.last; f.y = 0f;
                var bf = b.anim.transform.forward; bf.y = 0f;
                float dot = Vector3.Dot(f.normalized, bf.normalized);
                if (dot < 0f) back++;
                if (b == bodies[0] || b.anim.transform.IsChildOf(hero != null ? hero.transform : b.anim.transform))
                    Debug.Log($"{Tag} head {b.anim.name} 머리 {b.head.name} 앞 {b.last.x:0.00},{b.last.y:0.00},{b.last.z:0.00} · 몸 앞과 내적 {dot:0.00}");
            }
            PlaytestKit.Check(zero == 0, $"한 프레임 뒤 _HeadFwd 0 벡터 {zero}");
            Debug.Log($"{Tag} headfwd OK - 0 벡터 0 · 몸 앞과 반대(Animator 앞이 몸과 다른 몸 — 참고) {back}/{bodies.Count}");

            // 손잡이 0
            FaceLight.DetachAll();
            System.Environment.SetEnvironmentVariable("SAGA_FACE_LIGHT", "0");
            int off = 0;
            foreach (var a in anims) off += FaceLight.ApplyTo(a);
            int on = anims.SelectMany(a => a.GetComponentsInChildren<Renderer>(true)).SelectMany(r => r.sharedMaterials)
                .Count(m => m != null && m.HasProperty(FaceLight.FaceModeId) && m.GetFloat(FaceLight.FaceModeId) > 0.5f);
            PlaytestKit.Check(off == 0 && !FaceLight.All.Any() && on == 0, $"SAGA_FACE_LIGHT=0 인데 바꿈 {off}·몸 {FaceLight.All.Count()}·_FaceMode 1 {on}");
            Debug.Log($"{Tag} off OK - SAGA_FACE_LIGHT=0 바꿈 0 · 되돌린 뒤 _FaceMode 1 칸 0");
        }

        // ── 화면(GUI) ──────────────────────────────────────────────

        /// <summary>얼굴 가까이 전후(`_FaceMode` 0/1) × 빛 셋. `-executeMethod Saga.EditorTools.PlaytestFaceLight.FaceShots`(-batchmode 없이). SAGA_SHOT_DIR · SAGA_FACE_SHOT_MAX(몸 수, 기본 2).</summary>
        public static void FaceShots()
        {
            string dir = (System.Environment.GetEnvironmentVariable("SAGA_SHOT_DIR") ?? "Temp/shots").Replace((char)92, (char)47).TrimEnd((char)47) + "/";
            System.IO.Directory.CreateDirectory(dir);
            int.TryParse(System.Environment.GetEnvironmentVariable("SAGA_FACE_SHOT_MAX"), out int max);
            if (max <= 0) max = 2;
            bool asyncWas = ShaderUtil.allowAsyncCompilation;
            ShaderUtil.allowAsyncCompilation = false;
            try
            {
                var s = Setup(out var hero);
                foreach (var a in Animators(s)) { CharacterOutline.ApplyTo(a.gameObject); FaceLight.ApplyTo(a); }
                CharacterOutline.SetActiveForTest(true);
                FaceLight.TickAll(true);
                var sun = s.GetRootGameObjects().SelectMany(r => r.GetComponentsInChildren<Light>(true)).FirstOrDefault(l => l.type == LightType.Directional);
                var mainCam = s.GetRootGameObjects().SelectMany(r => r.GetComponentsInChildren<Camera>(true)).FirstOrDefault();
                var sunRot0 = sun != null ? sun.transform.rotation : Quaternion.identity;
                // 주인공은 땅 밑에 세웠으니 씬 NPC 부터
                var bodies = FaceLight.All.Where(b => hero == null || !b.anim.transform.IsChildOf(hero.transform)).Take(max).ToList();
                int shots = 0, k = 0;
                foreach (var b in bodies)
                {
                    var head = b.head.position;
                    var fwd = b.last; fwd.y = 0f; fwd = fwd.sqrMagnitude > 1e-4f ? fwd.normalized : Vector3.forward;
                    var right = Vector3.Cross(Vector3.up, fwd);
                    var look = head + Vector3.up * 0.03f;
                    var pos = look + Quaternion.AngleAxis(20f, Vector3.up) * fwd * 0.75f + Vector3.up * 0.04f;
                    var camGo = new GameObject("FaceCam");
                    var cam = camGo.AddComponent<Camera>();
                    if (mainCam != null) cam.CopyFrom(mainCam);
                    cam.fieldOfView = 30f; cam.nearClipPlane = 0.02f; cam.farClipPlane = 300f;
                    cam.transform.SetPositionAndRotation(pos, Quaternion.LookRotation(look - pos));
                    var lights = new List<(string tag, Quaternion rot)> { ("scene", sunRot0) };
                    lights.Add(("side", Quaternion.LookRotation(-(right * 0.82f + Vector3.up * 0.57f + fwd * 0.05f))));   // 몸 오른쪽 35° 위
                    lights.Add(("high", Quaternion.LookRotation(-(fwd * 0.34f + right * 0.2f + Vector3.up * 0.92f))));   // 앞쪽 높은 해(~67°)
                    foreach (var (tag, rot) in lights)
                    {
                        if (sun != null) sun.transform.rotation = rot;
                        FaceLight.SetModeForTest(false);
                        var a0 = Render(cam, $"{dir}face_{k}_{tag}_a_off.png");
                        FaceLight.SetModeForTest(true);
                        var a1 = Render(cam, $"{dir}face_{k}_{tag}_b_on.png");
                        double sum = 0; int big = 0;
                        for (int i = 0; i < a0.Length; i++)
                        {
                            int d = Mathf.Abs(a0[i].r - a1[i].r) + Mathf.Abs(a0[i].g - a1[i].g) + Mathf.Abs(a0[i].b - a1[i].b);
                            sum += d; if (d > 24) big++;
                        }
                        Debug.Log($"{Tag} shot {k} {b.anim.name} {tag} 평균 차 {sum / a0.Length / 3.0:0.00}/255 · 8 넘는 픽셀 {big * 100.0 / a0.Length:0.00}%");
                        shots += 2;
                    }
                    if (sun != null) sun.transform.rotation = sunRot0;
                    Object.DestroyImmediate(camGo);
                    k++;
                }
                Debug.Log($"{Tag} face 찍음 {shots}장 → {dir}");
            }
            catch (System.Exception e) { Debug.LogError($"{Tag} shots " + e); }
            finally
            {
                FaceLight.DetachAll();
                ShaderUtil.allowAsyncCompilation = asyncWas;
            }
            if (!Application.isBatchMode) EditorApplication.Exit(0);
        }

        private static Color32[] Render(Camera cam, string path)
        {
            var rt = new RenderTexture(960, 720, 24, RenderTextureFormat.ARGB32, RenderTextureReadWrite.sRGB);
            cam.targetTexture = rt;
            cam.Render(); // 처음 쓰는 변형은 편집기가 뒤에서 짓는다 — 다 지어질 때까지 기다린 뒤 다시
            for (int w = 0; w < 200 && ShaderUtil.anythingCompiling; w++) System.Threading.Thread.Sleep(50);
            cam.Render();
            var prev = RenderTexture.active;
            RenderTexture.active = rt;
            var tex = new Texture2D(rt.width, rt.height, TextureFormat.RGB24, false);
            tex.ReadPixels(new Rect(0, 0, rt.width, rt.height), 0, 0);
            tex.Apply();
            RenderTexture.active = prev;
            System.IO.File.WriteAllBytes(path, tex.EncodeToPNG());
            var px = tex.GetPixels32();
            Object.DestroyImmediate(tex); cam.targetTexture = null; rt.Release(); Object.DestroyImmediate(rt);
            return px;
        }
    }
}
