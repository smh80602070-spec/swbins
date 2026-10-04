using UnityEditor;
using UnityEngine;
using Saga.Core;

namespace Saga.EditorTools
{
    /// <summary>
    /// U-0041 진단 — 하늘 12장이 읽히고(2:1) 시각·시대 → 이름 표가 맞고, `SkyPanorama.Apply` 가 skybox 와 카메라 배경을 바꾸며,
    /// 없는 그림이면 아무것도 안 바꾼다. 하늘이 안 올라온 PC 는 SKIP.
    /// `-executeMethod Saga.EditorTools.PlaytestSkyPanorama.Run` → "[PlaytestSkyPanorama] OK/FAIL/SKIP".
    /// </summary>
    public static class PlaytestSkyPanorama
    {
        [MenuItem("Saga/Playtest Sky Panorama")]
        public static void Run()
        {
            PlaytestKit.Begin("[PlaytestSkyPanorama]");
            if (SkyPanorama.Load("sky_noon_present") == null)
            {
                Debug.Log("[PlaytestSkyPanorama] SKIP — 하늘 그림 없음(Resources/Sky)");
                if (Application.isBatchMode) EditorApplication.Exit(0);
                return;
            }
            using (PlaytestKit.ErrorCounter())
            {
                PlaytestKit.Check(SkyPanorama.TimeOf(5) == "dawn" && SkyPanorama.TimeOf(7) == "dawn" && SkyPanorama.TimeOf(8) == "noon" && SkyPanorama.TimeOf(15) == "noon"
                    && SkyPanorama.TimeOf(16) == "sunset" && SkyPanorama.TimeOf(18) == "sunset" && SkyPanorama.TimeOf(19) == "night" && SkyPanorama.TimeOf(4) == "night"
                    && SkyPanorama.TimeOf(0) == "night" && SkyPanorama.TimeOf(24) == "night" && SkyPanorama.TimeOf(-1) == "night", "시각 → 시간대 표가 다름");
                PlaytestKit.Check(SkyPanorama.NameFor(12, "bogus") == "sky_noon_present", "모르는 시대가 현재로 안 떨어짐");
                int n = 0;
                foreach (var t in SkyPanorama.Times)
                    foreach (var e in SkyPanorama.Eras)
                    {
                        string name = $"sky_{t}_{e}";
                        var tex = SkyPanorama.Load(name);
                        if (tex == null) { PlaytestKit.Fail($"{name} 을 못 읽음"); continue; }
                        n++;
                        PlaytestKit.Check(tex.width == tex.height * 2, $"{name}: 2:1 이 아님 {tex.width}×{tex.height}");
                    }
                PlaytestKit.Check(n == 12, $"하늘 {n}/12");
                var camGo = new GameObject("__cam", typeof(Camera));
                var cam = camGo.GetComponent<Camera>();
                cam.clearFlags = CameraClearFlags.SolidColor;
                var before = RenderSettings.skybox;
                PlaytestKit.Check(!SkyPanorama.Apply("sky_no_such", cam) && cam.clearFlags == CameraClearFlags.SolidColor && RenderSettings.skybox == before, "없는 그림인데 하늘이 바뀜");
                PlaytestKit.Check(SkyPanorama.Apply("sky_sunset_future", cam) && cam.clearFlags == CameraClearFlags.Skybox && RenderSettings.skybox != null
                    && RenderSettings.skybox.shader.name == "Skybox/Panoramic", "적용이 skybox·카메라 배경을 안 바꿈");
                RenderSettings.skybox = before;
                Object.DestroyImmediate(camGo);
                Debug.Log($"[PlaytestSkyPanorama] 하늘 {n}/12 읽힘");
            }
            PlaytestKit.Summary("PlaytestSkyPanorama");
            if (Application.isBatchMode) EditorApplication.Exit(PlaytestKit.Fails == 0 ? 0 : 1);
        }
    }
}
