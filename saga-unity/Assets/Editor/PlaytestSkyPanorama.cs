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
            // 씬별 방식 — 마을·숲·스토리 = 하늘+조명, 사가천하 도시 = 조명만, 던전·그 밖 = 안 건드림
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

        /// <summary>U-0083 사실 하늘 — 셰이더·빌드 원본 표 · 시각 → 해 방향 공식 넷(옛 정오 표식과 같은 자리) · 밤 달 · 조명 적용 · 하늘 입히기·날씨 덮개.</summary>
        private static void CheckRealSky()
        {
            var sh = Shader.Find(SkyPass.RealSkyShader);
            PlaytestKit.Check(sh != null && !ShaderUtil.ShaderHasError(sh), "Saga/SkyReal 셰이더 없음·오류");
            PlaytestKit.Check(System.Array.Exists(Saga.Core.Region.RegionMaterials.Sources, s => s.name == "SkyReal" && s.shader == SkyPass.RealSkyShader), "RegionMaterials 원본 표에 SkyReal 없음(빌드에서 빠짐)");
            float El(Vector3 v) => Mathf.Asin(v.y) * Mathf.Rad2Deg;
            Vector3 d6 = SkyPass.SunDirAt(6f), d12 = SkyPass.SunDirAt(12f), d17 = SkyPass.SunDirAt(17f), d22 = SkyPass.SunDirAt(22f);
            PlaytestKit.Check(El(d6) > -0.5f && El(d6) < 15f && d6.x > 0.9f, $"6시 해 — 동쪽 지평선이어야 {d6} {El(d6):0.0}°");
            PlaytestKit.Check(Mathf.Abs(El(d12) - SkyPass.NoonElevation) < 2f && d12.z < -0.4f, $"12시 해 — 남쪽 {SkyPass.NoonElevation}° 여야 {d12} {El(d12):0.0}°");
            PlaytestKit.Check(El(d17) > 8f && El(d17) < 25f && d17.x < -0.5f, $"17시 해 — 서쪽 낮게(노을빛)여야 {d17} {El(d17):0.0}°");
            PlaytestKit.Check(El(d22) < 0f && El(SkyPass.MoonDirAt(22f)) > 40f, $"22시 — 해 아래·달 높이 {El(d22):0.0}°/{El(SkyPass.MoonDirAt(22f)):0.0}°");
            PlaytestKit.Check(SkyPass.LightSourceAt(22f) == SkyPass.MoonDirAt(22f) && SkyPass.LightSourceAt(12f) == d12, "밤 빛원 = 달·낮 = 해 가 아님");
            // 옛 정오 표식 자리와 같은 방향(그림자 방향이 바뀌지 않게)
            if (SkyPanorama.TrySun("sky_noon_present", out var mark, out _))
                PlaytestKit.Check(Vector3.Angle(mark, d12) < 4f, $"12시 공식이 옛 정오 표식과 {Vector3.Angle(mark, d12):0.0}° 어긋남");
            var hourWas = SkyPass.HourFn;
            SkyPass.HourFn = () => 17;
            PlaytestKit.Check(Mathf.Approximately(SkyPass.HourNow(), 17f), $"시각을 붙들면 정각이어야 {SkyPass.HourNow()}");
            SkyPass.HourFn = hourWas;

            var go = new GameObject("Sun");
            var sun = go.AddComponent<Light>();
            sun.type = LightType.Directional; sun.shadows = LightShadows.Soft; sun.intensity = 2f;
            bool ok = SkyPass.ApplyLightAt(12f, out var noon);
            PlaytestKit.Check(ok && (go.transform.forward + d12).magnitude < 1e-3f && (noon - d12).magnitude < 1e-3f, "12시: 조명이 공식 해 반대쪽을 안 비춤");
            ok = SkyPass.ApplyLightAt(5f, out var dawn);   // 해가 아직 아래 → MinPitch 로 끌어올림, 방위는 해 쪽
            PlaytestKit.Check(ok && Mathf.Abs(El(dawn) - SkyPass.MinPitch) < 0.1f && dawn.x > 0.9f, $"5시: 고도 보정 {El(dawn):0.0}°·동쪽 {dawn}");
            ok = SkyPass.ApplyLightAt(22f, out _);
            PlaytestKit.Check(ok && sun.color.b > sun.color.r && Mathf.Abs(sun.intensity - 2f * 0.35f) < 1e-3f, "22시: 달빛(푸른빛·어둡게)이 아님");
            Object.DestroyImmediate(go);

            var before = RenderSettings.skybox;
            var camGo = new GameObject("__cam", typeof(Camera));
            ok = SkyPass.ApplyRealSky(12f, camGo.GetComponent<Camera>(), false);
            var m = SkyPass.RealSkyMaterial;
            PlaytestKit.Check(ok && m != null && m.shader.name == SkyPass.RealSkyShader && camGo.GetComponent<Camera>().clearFlags == CameraClearFlags.Skybox
                && ((Vector3)m.GetVector("_SunDir") - d12).magnitude < 1e-3f, "사실 하늘을 안 입힘·해 방향이 안 넘어감");
            SkyPass.SetSkyWeather(0.9f, SkyPass.OvercastOf(SkyWeatherRules.Kind.Rain), 1.5f);
            PlaytestKit.Check(m != null && Mathf.Approximately(m.GetFloat("_CloudCover"), 0.9f) && Mathf.Approximately(m.GetFloat("_Overcast"), 0.8f), "날씨 덮개가 안 넘어감");
            RenderSettings.skybox = before;
            Object.DestroyImmediate(camGo);
            Debug.Log($"[PlaytestSkyPanorama] 사실 하늘 OK - 6시 {El(d6):0.0}° · 12시 {El(d12):0.0}° · 17시 {El(d17):0.0}° · 22시 해 {El(d22):0.0}°/달 {El(SkyPass.MoonDirAt(22f)):0.0}°");
        }

        /// <summary>U-0079 미래 땅 덧층 — 셰이더 `_Future`(기본 0) · 미래 땅 = 은하 나루·틈새 갈림길 둘만 · 발 자리 → 목표 · 2초 따라가기·되돌아옴 · 그림 하늘 시대 past/future.</summary>
        private static void CheckFutureSky()
        {
            var sh = Shader.Find(SkyPass.RealSkyShader);
            PlaytestKit.Check(sh != null && sh.FindPropertyIndex("_Future") >= 0, "SkyReal 에 _Future 가 없음");
            if (sh != null && sh.FindPropertyIndex("_Future") >= 0)
            {
                var fresh = new Material(sh);
                PlaytestKit.Check(Mathf.Approximately(fresh.GetFloat("_Future"), 0f), "_Future 기본이 0 이 아님(사실 하늘이 바뀜)");
                Object.DestroyImmediate(fresh);
            }
            var fut = new System.Collections.Generic.List<string>();
            foreach (var a in Saga.Go.Data.GoAreas.All) if (a.SkyFuture) fut.Add(a.Id);
            PlaytestKit.Check(fut.Count == 2 && fut.Contains("skyport") && fut.Contains("crossing"), $"미래 하늘 땅이 은하 나루·틈새 갈림길 둘이 아님: {string.Join(",", fut)}");

            Saga.Go.World.AreaField.SkyFor(Saga.Go.Data.GoAreas.Skyport.ArrivalPos);
            PlaytestKit.Check(Mathf.Approximately(SkyPass.FutureTarget, 1f), "은하 나루에 내렸는데 덧층 목표가 1 이 아님");
            Saga.Go.World.AreaField.SkyFor(Saga.Go.Data.GoAreas.Crossing.Center + Vector3.up * 90f);
            PlaytestKit.Check(Mathf.Approximately(SkyPass.FutureTarget, 1f), "틈새 갈림길 하늘 섬 위인데 덧층 목표가 1 이 아님");
            Saga.Go.World.AreaField.SkyFor(Saga.Go.Data.GoAreas.Sunken.Center);
            PlaytestKit.Check(Mathf.Approximately(SkyPass.FutureTarget, 0f), "잠긴 도읍(과거)인데 덧층 목표가 0 이 아님");
            Saga.Go.World.AreaField.SkyFor(Saga.Go.Data.GoAreas.Skyport.ReturnPos);
            PlaytestKit.Check(Mathf.Approximately(SkyPass.FutureTarget, 0f), "지도로 나왔는데 덧층 목표가 0 이 아님");

            var before = RenderSettings.skybox;
            var camGo = new GameObject("__cam", typeof(Camera));
            bool ok = SkyPass.ApplyRealSky(22f, camGo.GetComponent<Camera>(), false);
            var m = SkyPass.RealSkyMaterial;
            PlaytestKit.Check(ok && m != null, "사실 하늘을 못 입힘");
            if (m != null)
            {
                SkyPass.FutureTarget = 0f; SkyPass.StepFuture(10f);
                PlaytestKit.Check(SkyPass.Era == "past" && Mathf.Approximately(m.GetFloat("_Future"), 0f), $"덧층 0 에서 시대 {SkyPass.Era}·_Future {m.GetFloat("_Future")}");
                SkyPass.FutureTarget = 1f;
                SkyPass.StepFuture(1f);
                float half = m.GetFloat("_Future");
                PlaytestKit.Check(SkyPass.Era == "future" && Mathf.Abs(half - 0.5f) < 1e-3f, $"1초 뒤 덧층 반쯤이어야 {half}·시대 {SkyPass.Era}");
                SkyPass.StepFuture(1.5f);
                PlaytestKit.Check(Mathf.Approximately(m.GetFloat("_Future"), 1f) && Mathf.Approximately(SkyPass.FutureNow, 1f), $"2초 넘으면 덧층 1 이어야 {m.GetFloat("_Future")}");
                PlaytestKit.Check(!SkyPass.StepFuture(1f), "목표에 닿았는데 또 바뀜(매 프레임 SetFloat)");
                PlaytestKit.Check(SkyPanorama.NameFor(22, SkyPass.Era) == "sky_night_future", "미래 땅 그림 하늘 이름이 sky_night_future 가 아님");
                SkyPass.FutureTarget = 0f; SkyPass.StepFuture(5f);
                PlaytestKit.Check(SkyPass.Era == "past" && Mathf.Approximately(m.GetFloat("_Future"), 0f) && SkyPanorama.NameFor(12, SkyPass.Era) == "sky_noon_past", "지도로 나오면 덧층 0·시대 past 로 안 돌아옴");
            }
            RenderSettings.skybox = before;
            Object.DestroyImmediate(camGo);
            Debug.Log($"[PlaytestSkyPanorama] 미래 하늘 OK - 땅 {string.Join(",", fut)} · 따라가기 {SkyPass.FutureFadeSec}초");
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
                CheckRealSky();
                CheckFutureSky();
                Debug.Log($"[PlaytestSkyPanorama] 하늘 {n}/12 읽힘");
            }
            PlaytestKit.Summary("PlaytestSkyPanorama");
            if (Application.isBatchMode) EditorApplication.Exit(PlaytestKit.Fails == 0 ? 0 : 1);
        }
    }
}
