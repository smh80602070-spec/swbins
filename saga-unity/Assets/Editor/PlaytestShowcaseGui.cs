using System.Collections.Generic;
using System.IO;
using System.Linq;
using UnityEditor;
using UnityEditor.SceneManagement;
using UnityEngine;

namespace Saga.EditorTools
{
    /// <summary>
    /// 사용자가 "확인 대기는 화면을 보여줘"로 명시적으로 요청했을 때만 쓰는 1회성 GUI 촬영 도구(프로젝트 규칙: 개발 중 습관적 촬영 금지).
    /// 씬을 플레이 모드로 띄워 런타임 생성물(NPC 몸·과일나무·하늘·툰 패스)이 선 뒤, 대상마다 전용 카메라로 렌더 텍스처에 찍어 PNG 로 남긴다.
    /// 환경변수: SAGA_SHOT_SCENE(씬 경로) · SAGA_SHOT_TARGETS("type:ForestFruitTree;type:CrowdBodyAnimator;sky;npc") · SAGA_SHOT_DIR · SAGA_SHOT_MAX(종류당 장수, 기본 2).
    /// 대상 문법: `type:<컴포넌트 클래스 이름>` · `name:<GameObject 이름 앞부분>` · `npc`(NpcIdle) · `sky`(메인 카메라 위치에서 하늘 두 방향).
    /// 실행: `Unity.exe -projectPath . -executeMethod Saga.EditorTools.PlaytestShowcaseGui.Run` (-batchmode 없이 — 그래픽 필요). 끝나면 스스로 종료.
    /// </summary>
    public static class PlaytestShowcaseGui
    {
        private const int Width = 1280, Height = 720;
        private const int WarmupFrames = 240;

        private static string _dir;
        private static string[] _targets;
        private static int _max = 2, _frame;
        private static bool _done;
        private static bool _stage1, _wantHouse;
        private static int _stage2At, _houseIndex;
        private static bool _origEnterOpts;
        private static EnterPlayModeOptions _origOpts;

        [MenuItem("Saga/Playtest Showcase (GUI Screenshot)")]
        public static void Run()
        {
            string scene = System.Environment.GetEnvironmentVariable("SAGA_SHOT_SCENE");
            string targets = System.Environment.GetEnvironmentVariable("SAGA_SHOT_TARGETS") ?? "npc;sky";
            _dir = (System.Environment.GetEnvironmentVariable("SAGA_SHOT_DIR") ?? "Temp/shots").Replace((char)92, (char)47).TrimEnd((char)47) + "/";
            int.TryParse(System.Environment.GetEnvironmentVariable("SAGA_SHOT_MAX"), out _max);
            if (_max <= 0) _max = 2;
            _targets = targets.Split(new[] { ';' }, System.StringSplitOptions.RemoveEmptyEntries);
            if (string.IsNullOrEmpty(scene)) { Debug.LogError("[ShowcaseGui] SAGA_SHOT_SCENE 없음"); EditorApplication.Exit(2); return; }
            Directory.CreateDirectory(_dir);
            // 도메인 리로드를 끈다 — 켜 두면 플레이 진입 때 정적 상태(아래 콜백)가 사라져 영원히 기다린다(다른 Playtest*Gui 와 같은 방식)
            _origEnterOpts = EditorSettings.enterPlayModeOptionsEnabled;
            _origOpts = EditorSettings.enterPlayModeOptions;
            EditorSettings.enterPlayModeOptionsEnabled = true;
            EditorSettings.enterPlayModeOptions = EnterPlayModeOptions.DisableDomainReload | EnterPlayModeOptions.DisableSceneReload;
            EditorSceneManager.OpenScene(scene);
            // SAGA_SHOT_HOUR — 하늘·조명 시각을 붙든다(`SkyPass.HourFn`, 도메인 리로드를 꺼서 플레이까지 유지된다)
            if (int.TryParse(System.Environment.GetEnvironmentVariable("SAGA_SHOT_HOUR"), out int hour)) Saga.Core.SkyPass.HourFn = () => hour;
            _frame = 0; _done = false; _stage1 = false; _wantHouse = _targets.Contains("house") || _targets.Contains("house2"); _houseIndex = _targets.Contains("house2") ? 1 : 0; _stage2At = 0;
            EditorApplication.playModeStateChanged += OnState;
            EditorApplication.isPlaying = true;
        }

        private static void OnState(PlayModeStateChange s)
        {
            if (s == PlayModeStateChange.EnteredPlayMode) EditorApplication.update += Tick;
            else if (s == PlayModeStateChange.EnteredEditMode && _done)
            {
                EditorApplication.playModeStateChanged -= OnState;
                EditorSettings.enterPlayModeOptionsEnabled = _origEnterOpts;
                EditorSettings.enterPlayModeOptions = _origOpts;
                EditorApplication.Exit(0);
            }
        }

        private static void Tick()
        {
            if (_done) return;
            // U-0056 몸 프리팹 애니메이터는 CullUpdateTransforms 라 메인 카메라 밖 몸은 자세를 안 쓴다 — 촬영 카메라가 한 프레임에 찍으면 T자세로 나온다.
            // 촬영 전 마지막 30 프레임은 전부 AlwaysAnimate 로 돌려 실제 자세가 서게 한다(게임 동작은 안 바꾼다 — 촬영 도구 안에서만).
            if (++_frame >= WarmupFrames - 30 && !_stage1)
                foreach (var a in Object.FindObjectsByType<Animator>(FindObjectsInactive.Exclude, FindObjectsSortMode.None)) a.cullingMode = AnimatorCullingMode.AlwaysAnimate;
            if (_frame < WarmupFrames) return;
            try
            {
                if (!_stage1)
                {
                    _stage1 = true;
                    ShootAll();
                    if (_wantHouse && EnterHouse()) { _stage2At = _frame + 150; return; }   // 카메라가 방 안 플레이어를 따라올 시간
                }
                else if (_wantHouse && _frame < _stage2At) return;
                else if (_wantHouse) ShootHouse();
            }
            catch (System.Exception e) { Debug.LogError("[ShowcaseGui] " + e); }
            _done = true;
            EditorApplication.update -= Tick;
            EditorApplication.isPlaying = false;
        }

        /// <summary>`house` — GO 마을집 방(U-0039)에 들어간다. 방이 없으면 거짓.</summary>
        private static bool EnterHouse()
        {
            var gi = _houseIndex < Saga.Go.World.GoHouseInterior.All.Count ? Saga.Go.World.GoHouseInterior.All[_houseIndex] : null;
            if (gi == null) { Debug.LogError("[ShowcaseGui] house — 방이 안 섰다"); return false; }
            gi.Enter();
            Debug.Log($"[ShowcaseGui] house — 들어감 {gi.Inside}");
            return true;
        }

        /// <summary>실제 게임 카메라가 방 안에서 보는 화면 + 천장 위에서 내려다본 전경.</summary>
        private static void ShootHouse()
        {
            var main = Camera.main;
            var gi = _houseIndex < Saga.Go.World.GoHouseInterior.All.Count ? Saga.Go.World.GoHouseInterior.All[_houseIndex] : null;
            if (main == null || gi == null) return;
            string tag = _houseIndex == 0 ? "house" : "house2";
            Shoot(main, tag + "_gamecam", main.transform.position, main.transform.rotation);
            var c = gi.RoomBounds.center;
            var over = c + new Vector3(0f, gi.RoomBounds.size.y * 2.2f, -gi.RoomBounds.size.z * 1.1f);
            Shoot(main, tag + "_overview", over, Quaternion.LookRotation(c - over, Vector3.up));
            var inside = gi.LandingIndoor + new Vector3(0f, 2.2f, -1.5f);
            Shoot(main, tag + "_fromdoor", inside, Quaternion.LookRotation(gi.RoomBounds.center - inside + Vector3.up * 0.5f, Vector3.up));
            Debug.Log($"[ShowcaseGui] house 촬영 — 플레이어 {GameObject.FindWithTag("Player")?.transform.position} 카메라 {main.transform.position}");
        }

        private static void ShootAll()
        {
            var main = Camera.main;
            if (main == null) { Debug.LogError("[ShowcaseGui] Camera.main 없음"); return; }
            int shots = 0;
            foreach (var spec in _targets)
            {
                if (spec == "sunsky")
                {
                    // 하늘 속 해 자리로 카메라를 돌려 해 원반이 화면 가운데 오는지 + 게임 카메라 화면(조명·그림자)
                    string skyName = Saga.Core.SkyPanorama.NameFor(Saga.Core.SkyPass.HourFn(), Saga.Core.SkyPass.Era);
                    bool hasSun = Saga.Core.SkyPanorama.TrySun(skyName, out var sd, out _);
                    Debug.Log($"[ShowcaseGui] sunsky {skyName} 표식 {hasSun} 방향 {sd} 조명 {Saga.Core.SkyPass.FindSun()?.transform.forward}");
                    if (hasSun) shots += Shoot(main, "sunsky_center", main.transform.position, Quaternion.LookRotation(sd)) ? 1 : 0;
                    shots += Shoot(main, "sunsky_gamecam", main.transform.position, main.transform.rotation) ? 1 : 0;
                    continue;
                }
                if (spec == "sky")
                {
                    foreach (var yaw in new[] { 0f, 180f })
                    {
                        var rot = Quaternion.Euler(-12f, main.transform.eulerAngles.y + yaw, 0f);
                        shots += Shoot(main, $"sky_yaw{yaw:0}", main.transform.position, rot) ? 1 : 0;
                    }
                    continue;
                }
                var found = Find(spec).Take(_max).ToList();
                Debug.Log($"[ShowcaseGui] {spec} → {found.Count}개");
                int i = 0;
                foreach (var t in found)
                {
                    if (!Frame(t, out var pos, out var rot)) continue;
                    string safe = new string(spec.Where(char.IsLetterOrDigit).ToArray());
                    shots += Shoot(main, $"{safe}_{i++}", pos, rot) ? 1 : 0;
                }
            }
            Debug.Log($"[ShowcaseGui] 찍음 {shots}장 → {_dir}");
        }

        /// <summary>대상 후보 — 서로 6m 이상 떨어진 것만 차례로(같은 자리에 겹쳐 찍지 않게).</summary>
        private static IEnumerable<Transform> Find(string spec)
        {
            IEnumerable<Transform> all;
            if (spec == "npc") all = Object.FindObjectsByType<Saga.Core.NpcIdle>(FindObjectsInactive.Exclude, FindObjectsSortMode.None).Select(c => c.transform);
            else if (spec.StartsWith("type:"))
            {
                string tn = spec.Substring(5);
                all = Object.FindObjectsByType<MonoBehaviour>(FindObjectsInactive.Exclude, FindObjectsSortMode.None)
                    .Where(m => m != null && m.GetType().Name == tn).Select(m => m.transform);
            }
            else if (spec.StartsWith("name:"))
            {
                string nn = spec.Substring(5);
                all = Object.FindObjectsByType<Transform>(FindObjectsInactive.Exclude, FindObjectsSortMode.None).Where(t => t.name.StartsWith(nn));
            }
            else yield break;
            var picked = new List<Transform>();
            foreach (var t in all.OrderBy(t => t.name))
            {
                if (picked.Any(p => (p.position - t.position).sqrMagnitude < 36f)) continue;
                picked.Add(t);
                yield return t;
            }
        }

        /// <summary>대상 둘레 렌더러 경계로 정면(+Z) 3/4 샷 자리를 구한다.</summary>
        private static bool Frame(Transform t, out Vector3 pos, out Quaternion rot)
        {
            pos = default; rot = default;
            var anim = t.GetComponentInParent<Animator>() ?? t.GetComponentInChildren<Animator>();
            var root = anim != null ? anim.transform : t;
            var rs = root.GetComponentsInChildren<Renderer>().Where(r => !(r is ParticleSystemRenderer) && r.enabled).ToArray();
            if (rs.Length == 0) return false;
            var b = rs[0].bounds;
            foreach (var r in rs) b.Encapsulate(r.bounds);
            // 무엇이 서 있는지 확인용 — 메시·재질 이름(중복 뺀 앞 8개)
            var names = rs.Select(r => (r is SkinnedMeshRenderer s ? s.sharedMesh : r.GetComponent<MeshFilter>()?.sharedMesh)).Where(m => m != null).Select(m => m.name).Distinct().Take(8);
            var shaders = rs.SelectMany(r => r.sharedMaterials).Where(m => m != null && m.shader != null).Select(m => m.shader.name).Distinct().Take(5);
            Debug.Log($"[ShowcaseGui] {t.name} 메시 {string.Join(",", names)} · 셰이더 {string.Join(",", shaders)} · 크기 {b.size.y:0.0}m");
            float size = Mathf.Clamp(b.size.magnitude, 0.6f, 14f);
            var center = b.center;
            var fwd = root.forward; fwd.y = 0f;
            if (fwd.sqrMagnitude < 0.01f) fwd = Vector3.forward;
            fwd = (Quaternion.Euler(0f, 28f, 0f) * fwd.normalized);
            float.TryParse(System.Environment.GetEnvironmentVariable("SAGA_SHOT_DIST"), out var dist);   // 거리 배율(기본 1.25) — 작은 것은 0.6 쯤
            if (dist <= 0f) dist = 1.25f;
            pos = center + fwd * (size * dist + 1.2f) + Vector3.up * (size * 0.18f);
            rot = Quaternion.LookRotation(center - pos, Vector3.up);
            return true;
        }

        private static bool Shoot(Camera template, string name, Vector3 pos, Quaternion rot)
        {
            var go = new GameObject("ShowcaseCam");
            var cam = go.AddComponent<Camera>();
            cam.CopyFrom(template);
            cam.transform.SetPositionAndRotation(pos, rot);
            cam.fieldOfView = 42f; cam.nearClipPlane = 0.1f; cam.farClipPlane = 600f;
            if (System.Environment.GetEnvironmentVariable("SAGA_SHOT_LIGHT") == "1")
            {
                var lg = new GameObject("ShowcaseLight").AddComponent<Light>();   // 어두운 방 보조 — 카메라 곁 점광(사진 한 장 뒤에 같이 지운다)
                lg.type = LightType.Point; lg.range = 14f; lg.intensity = 6f; lg.transform.SetParent(go.transform, false); lg.transform.localPosition = new Vector3(0.6f, 0.8f, -0.4f);
            }
            var rt = new RenderTexture(Width, Height, 24, RenderTextureFormat.ARGB32, RenderTextureReadWrite.sRGB);
            cam.targetTexture = rt;
            cam.Render();
            var prev = RenderTexture.active;
            RenderTexture.active = rt;
            var tex = new Texture2D(Width, Height, TextureFormat.RGB24, false);
            tex.ReadPixels(new Rect(0, 0, Width, Height), 0, 0);
            tex.Apply();
            RenderTexture.active = prev;
            File.WriteAllBytes(_dir + name + ".png", tex.EncodeToPNG());
            Object.DestroyImmediate(tex); cam.targetTexture = null; rt.Release(); Object.DestroyImmediate(rt); Object.DestroyImmediate(go);
            return true;
        }
    }
}
