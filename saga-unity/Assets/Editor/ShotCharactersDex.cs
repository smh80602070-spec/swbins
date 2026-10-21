using System.IO;
using UnityEditor;
using UnityEditor.SceneManagement;
using UnityEngine;

namespace Saga.EditorTools
{
    /// <summary>
    /// tasks U-0156 — 로컬 설치 몸(`Art/CharactersDex/&lt;id&gt;.gltf`)을 빈 씬에 나란히 세워 앞모습 한 장을 찍는다(게임 군중이 시드 고정이라 새 몸이 안 나올 때 눈 판정용).
    /// GUI 모드(-batchmode 없이 — `-nographics` 면 렌더가 안 된다): `SAGA_SHOT_IDS`(쉼표) · `SAGA_SHOT_OUT`(PNG 경로).
    /// `-executeMethod Saga.EditorTools.ShotCharactersDex.Run` → 저장 뒤 스스로 끝남. 씬은 저장 안 함.
    /// </summary>
    public static class ShotCharactersDex
    {
        public static void Run()
        {
            var ids = (System.Environment.GetEnvironmentVariable("SAGA_SHOT_IDS") ?? "").Split(',');
            string outPath = System.Environment.GetEnvironmentVariable("SAGA_SHOT_OUT") ?? "Logs/characters_dex_shot.png";
            EditorSceneManager.NewScene(NewSceneSetup.EmptyScene, NewSceneMode.Single);

            const float gap = 1.1f;
            int n = 0;
            foreach (var raw in ids)
            {
                string id = raw.Trim();
                if (id.Length == 0) continue;
                var prefab = AssetDatabase.LoadAssetAtPath<GameObject>(ReimportCharactersDex.Dir + id + ".gltf");
                if (prefab == null) { Debug.LogWarning($"[ShotCharactersDex] {id} 못 읽음"); continue; }
                var go = (GameObject)Object.Instantiate(prefab);
                go.name = id;
                go.transform.position = new Vector3(n * gap, 0f, 0f);
                go.transform.rotation = Quaternion.Euler(0f, 180f, 0f); // glTF 앞(+Z) → 카메라(−Z 에서 봄) 쪽
                n++;
            }

            var sun = new GameObject("Sun").AddComponent<Light>();
            sun.type = LightType.Directional;
            sun.intensity = 1.3f;
            sun.transform.rotation = Quaternion.Euler(35f, 160f, 0f);
            RenderSettings.ambientMode = UnityEngine.Rendering.AmbientMode.Flat;
            RenderSettings.ambientLight = new Color(0.55f, 0.55f, 0.6f);

            // 몸 경계 상자 전체를 담는다(glTF 원점·축척이 몸마다 달라도).
            Bounds all = default; bool any = false;
            foreach (var r in Object.FindObjectsByType<Renderer>(FindObjectsSortMode.None))
            {
                if (r is SkinnedMeshRenderer sk) sk.updateWhenOffscreen = true;
                if (!any) { all = r.bounds; any = true; } else all.Encapsulate(r.bounds);
            }
            Debug.Log($"[ShotCharactersDex] 경계 {all.center} 크기 {all.size}");
            var cam = new GameObject("Cam").AddComponent<Camera>();
            cam.clearFlags = CameraClearFlags.SolidColor;
            cam.backgroundColor = new Color(0.82f, 0.84f, 0.88f);
            cam.fieldOfView = 30f;
            cam.nearClipPlane = 0.05f; cam.farClipPlane = 500f;
            float fit = Mathf.Max(all.size.x / (16f / 9f), all.size.y) * 1.15f;
            float dist = fit / (2f * Mathf.Tan(15f * Mathf.Deg2Rad)) + all.extents.z;
            cam.transform.position = all.center + new Vector3(0f, 0f, -dist);
            cam.transform.LookAt(all.center);

            ShaderUtil.allowAsyncCompilation = false; // 빈 셰이더 자리(청록) 없이
            int wait = 30;
            void Tick()
            {
                if (--wait > 0) { SceneView.RepaintAll(); return; }
                EditorApplication.update -= Tick;
                Shoot(cam, outPath, n);
            }
            EditorApplication.update += Tick;
        }

        private static void Shoot(Camera cam, string outPath, int n)
        {
            const int w = 1920, h = 1080;
            var rt = new RenderTexture(w, h, 24);
            cam.targetTexture = rt;
            cam.Render();
            RenderTexture.active = rt;
            var tex = new Texture2D(w, h, TextureFormat.RGB24, false);
            tex.ReadPixels(new Rect(0, 0, w, h), 0, 0);
            tex.Apply();
            RenderTexture.active = null;
            Directory.CreateDirectory(Path.GetDirectoryName(Path.GetFullPath(outPath)));
            File.WriteAllBytes(outPath, tex.EncodeToPNG());
            Debug.Log($"[ShotCharactersDex] {n} 명 → {outPath}");
            EditorApplication.Exit(0);
        }
    }
}
