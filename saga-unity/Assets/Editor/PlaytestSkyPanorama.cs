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
        /// <summary>K-0067 해·달 표식 → 조명(`Sun`) — 표식 12장·변환 기준점·임시 Sun 에 적용(방향·색·세기·낮은 해 고도 보정).</summary>
        private static void CheckSunMarkers()
        {
            foreach (var t in SkyPanorama.Times)
                foreach (var e in SkyPanorama.Eras)
                {
                    string name = $"sky_{t}_{e}";
                    if (!SkyPanorama.TryMarker(name, out var m)) { PlaytestKit.Fail($"{name} 표식을 못 읽음"); continue; }
                    PlaytestKit.Check(m.U >= 0f && m.U <= 1f && m.V >= 0f && m.V <= 1f, $"{name} 표식 uv 가 0~1 밖 {m.U},{m.V}");
                    PlaytestKit.Check(m.Moon == (t == "night"), $"{name} 달/해 표시가 시간대와 다름(Moon={m.Moon})");
                    var dir = SkyPanorama.SunDirection(m.U, m.V);
                    float el = Mathf.Asin(dir.y) * Mathf.Rad2Deg;
                    PlaytestKit.Check(Mathf.Abs(el - m.El) < 0.6f && Mathf.Abs(dir.magnitude - 1f) < 1e-4f, $"{name} 고도 {el:0.0} ≠ 표식 {m.El:0.0}");
                }
            // 변환 기준점 — 이미지 정중앙(수평선·경도 0)은 돔 회전 270° 뒤 −Z, 맨 위는 위, 맨 아래는 아래
            PlaytestKit.Check((SkyPanorama.SunDirection(0.5f, 0.5f) - new Vector3(0f, 0f, -1f)).magnitude < 1e-3f, "uv(0.5,0.5) 가 −Z 가 아님");
            PlaytestKit.Check((SkyPanorama.SunDirection(0.5f, 0f) - Vector3.up).magnitude < 1e-3f && (SkyPanorama.SunDirection(0.5f, 1f) - Vector3.down).magnitude < 1e-3f, "uv 맨 위·맨 아래 방향이 위·아래가 아님");
            PlaytestKit.Check(!SkyPanorama.TryMarker("sky_no_such", out _), "없는 하늘에 표식이 있다");

            PlaytestKit.Check(!SkyPass.ApplyLight("sky_noon_present", out _) || SkyPass.FindSun() != null, "Sun 이 없는데 적용됨");
            // 씬별 방식 — 마을·숲·스토리 = 하늘+조명, 사가국지 도시 = 조명만, 던전·그 밖 = 안 건드림
            PlaytestKit.Check(SkyPass.ModeFor("TestVillage") == SkyPass.Mode.SkyAndLight && SkyPass.ModeFor("TestVillageForest") == SkyPass.Mode.SkyAndLight
                && SkyPass.ModeFor("TestField") == SkyPass.Mode.SkyAndLight && SkyPass.ModeFor("TestCity") == SkyPass.Mode.LightOnly
                && SkyPass.ModeFor("TestDungeon") == SkyPass.Mode.None && SkyPass.ModeFor("Title") == SkyPass.Mode.None, "씬별 하늘·조명 방식 표가 다름");
            // 주 조명 찾기 — 숲·스토리·도시는 이름이 "Light"(그림자 있음)고 보조 `RimLight`(그림자 없음)가 따로 있다
            var rimGo = new GameObject("RimLight"); var rim = rimGo.AddComponent<Light>(); rim.type = LightType.Directional; rim.shadows = LightShadows.None;
            var mainGo = new GameObject("Light"); var mainL = mainGo.AddComponent<Light>(); mainL.type = LightType.Directional; mainL.shadows = LightShadows.Soft;
            PlaytestKit.Check(SkyPass.FindSun() == mainL, "그림자 있는 'Light' 가 주 조명으로 안 잡힘(RimLight 가 잡혔나)");
            Object.DestroyImmediate(mainGo); Object.DestroyImmediate(rimGo);
            var go = new GameObject("Sun");
            var sun = go.AddComponent<Light>();
            sun.type = LightType.Directional; sun.intensity = 2f; sun.color = Color.white;
            bool ok = SkyPass.ApplyLight("sky_noon_present", out var noonDir);
            PlaytestKit.Check(ok && (go.transform.forward + noonDir).magnitude < 1e-3f, "낮: 조명이 해 반대쪽을 안 비춤");
            PlaytestKit.Check(Mathf.Abs(sun.intensity - 2f * 1.1f) < 1e-3f && sun.color.r > sun.color.b, "낮: 세기·색(따뜻한 흰빛)이 표와 다름");
            ok = SkyPass.ApplyLight("sky_sunset_present", out var setDir);   // 표식 고도 4° → MinPitch 로 끌어올림
            float setEl = Mathf.Asin(setDir.y) * Mathf.Rad2Deg;
            PlaytestKit.Check(ok && Mathf.Abs(setEl - SkyPass.MinPitch) < 0.1f && (go.transform.forward + setDir).magnitude < 1e-3f, $"노을: 낮은 해 고도 보정 {setEl:0.0}° ≠ {SkyPass.MinPitch}°");
            PlaytestKit.Check(Mathf.Abs(sun.intensity - 2f * 0.95f) < 1e-3f && sun.color.r > sun.color.g && sun.color.g > sun.color.b, "노을: 주황빛·세기가 표와 다름");
            ok = SkyPass.ApplyLight("sky_night_present", out _);
            PlaytestKit.Check(ok && Mathf.Abs(sun.intensity - 2f * 0.35f) < 1e-3f && sun.color.b > sun.color.r, "밤: 달빛(푸른빛·어둡게)이 표와 다름");
            float before = sun.intensity;
            PlaytestKit.Check(!SkyPass.ApplyLight("sky_no_such", out _) && Mathf.Approximately(sun.intensity, before), "없는 하늘인데 조명이 바뀜");
            Object.DestroyImmediate(go);
        }

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
                CheckSunMarkers();
                Debug.Log($"[PlaytestSkyPanorama] 하늘 {n}/12 읽힘");
            }
            PlaytestKit.Summary("PlaytestSkyPanorama");
            if (Application.isBatchMode) EditorApplication.Exit(PlaytestKit.Fails == 0 ? 0 : 1);
        }
    }
}
