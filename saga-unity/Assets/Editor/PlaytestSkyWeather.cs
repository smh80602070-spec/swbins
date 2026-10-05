using System.Collections.Generic;
using System.Linq;
using UnityEditor;
using UnityEngine;
using Saga.Core;

namespace Saga.EditorTools
{
    /// <summary>
    /// U-0047 계절·날씨·구름 진단(`-executeMethod …PlaytestSkyWeather.RunBatch`, 장면 없이 — 하늘이 배치 모드 기본 꺼짐이라 컴포넌트를 직접 세운다).
    /// 규칙: 계절 4(달 12 개가 겹침 없이 한 계절)·날씨 6(순서)·`KeyAt` 결정론(같은 3시간 슬롯은 같은 날씨)·분포(겨울엔 눈이 가장 많고 여름엔 눈 0·비는 여름 &gt; 겨울,
    /// 여섯 날씨가 다 어느 계절엔 나옴)·강제·가중치 0 = 맑음. 컴포넌트: 구름 겹 3·입자 셋·날씨별 방출(비·눈·안개·맑음 0)·구름 투명도 순서·시간대 색(밤 어둡게)·
    /// 안개 곱 왕복(씬 안개를 켜 둔 값에서 곱했다 치우면 되돌아옴). 끝나면 전부 되돌린다.
    /// </summary>
    public static class PlaytestSkyWeather
    {
        [MenuItem("Saga/Playtest Sky Weather")]
        public static void RunBatch()
        {
            PlaytestKit.Begin("[PlaytestSkyWeather]");
            bool fog = RenderSettings.fog; float dens = RenderSettings.fogDensity; Color fcol = RenderSettings.fogColor;
            var hour = SkyPass.HourFn;
            using (PlaytestKit.ErrorCounter())
            {
                try
                {
                    CheckRules();
                    CheckComponent();
                }
                finally
                {
                    SkyWeatherRules.ForcedWeather = null; SkyWeatherRules.ForcedSeason = null;
                    SkyWeatherRules.NowMsFn = () => System.DateTimeOffset.UtcNow.ToUnixTimeMilliseconds();
                    SkyWeatherRules.MonthFn = () => System.DateTime.Now.Month;
                    SkyPass.HourFn = hour;
                    if (SkyWeather.Instance != null) SkyWeather.Instance.Teardown();
                    RenderSettings.fog = fog; RenderSettings.fogDensity = dens; RenderSettings.fogColor = fcol;
                }
            }
            PlaytestKit.Summary("PlaytestSkyWeather");
            if (Application.isBatchMode) EditorApplication.Exit(PlaytestKit.Fails == 0 ? 0 : 1);
        }

        private static int Count(SkyWeatherRules.Season season, SkyWeatherRules.Kind kind, int slots = 6000)
        {
            int n = 0;
            for (int i = 0; i < slots; i++) if (SkyWeatherRules.KeyAt(i * SkyWeatherRules.SpanMs + 1, season) == kind) n++;
            return n;
        }

        private static void CheckRules()
        {
            var ss = SkyWeatherRules.Seasons;
            PlaytestKit.Check(ss.Length == 4 && ss.Select(s => s.Key).SequenceEqual(new[] { "spring", "summer", "autumn", "winter" }), "계절 넷·순서가 다름");
            for (int m = 1; m <= 12; m++) PlaytestKit.Check(ss.Count(s => s.Months.Contains(m)) == 1, $"{m}월이 한 계절에 속하지 않음");
            PlaytestKit.Check(SkyWeatherRules.SeasonOfMonth(3).Key == "spring" && SkyWeatherRules.SeasonOfMonth(6).Key == "summer" && SkyWeatherRules.SeasonOfMonth(9).Key == "autumn"
                && SkyWeatherRules.SeasonOfMonth(12).Key == "winter" && SkyWeatherRules.SeasonOfMonth(1).Key == "winter" && SkyWeatherRules.SeasonOfMonth(2).Key == "winter", "달→계절이 다름(12·1·2 = 겨울)");
            var ws = SkyWeatherRules.Weathers;
            PlaytestKit.Check(ws.Length == 6 && Enumerable.Range(0, 6).All(i => (int)ws[i].Kind == i), "날씨 여섯의 순서가 Kind 와 다름");
            PlaytestKit.Check(ss.All(s => s.Wx.Length == 6), "계절 날씨 가중치가 여섯이 아님");
            PlaytestKit.Check(ws[(int)SkyWeatherRules.Kind.Rain].Rain > 0 && ws[(int)SkyWeatherRules.Kind.Snow].Snow > 0 && ws[(int)SkyWeatherRules.Kind.Fog].Fog > 0 && ws[(int)SkyWeatherRules.Kind.Clear].Rain == 0, "입자 방출 표가 다름");

            // 결정론 — 같은 슬롯(3시간)은 같고, 같은 입력은 늘 같다
            var winter = ss[3]; long t0 = 1_700_000_000_000L / SkyWeatherRules.SpanMs * SkyWeatherRules.SpanMs;
            PlaytestKit.Check(SkyWeatherRules.KeyAt(t0, winter) == SkyWeatherRules.KeyAt(t0 + SkyWeatherRules.SpanMs - 1, winter), "한 슬롯 안에서 날씨가 바뀜");
            PlaytestKit.Check(SkyWeatherRules.KeyAt(t0 + 12345, winter) == SkyWeatherRules.KeyAt(t0 + 12345, winter), "같은 입력인데 흔들림");
            PlaytestKit.Check(Enumerable.Range(0, 200).Select(i => SkyWeatherRules.KeyAt(t0 + i * SkyWeatherRules.SpanMs, winter)).Distinct().Count() > 2, "날씨가 거의 안 바뀜");

            // 분포 — 겨울엔 눈이 가장 많고 여름엔 눈이 없고 비는 여름이 겨울보다 많다
            var summer = ss[1]; var spring = ss[0];
            int[] wc = Enumerable.Range(0, 6).Select(k => Count(winter, (SkyWeatherRules.Kind)k)).ToArray();
            PlaytestKit.Check(wc[(int)SkyWeatherRules.Kind.Snow] == wc.Max(), $"겨울에 눈이 가장 많지 않음({string.Join("/", wc)})");
            PlaytestKit.Check(Count(summer, SkyWeatherRules.Kind.Snow) == 0, "여름에 눈이 옴");
            PlaytestKit.Check(Count(summer, SkyWeatherRules.Kind.Rain) > Count(winter, SkyWeatherRules.Kind.Rain) * 3, "여름 비가 겨울 비의 3배보다 적음");
            PlaytestKit.Check(Count(spring, SkyWeatherRules.Kind.Snow) < 6000 * 0.03, "봄에 눈이 3% 넘게 옴");
            var seen = new HashSet<SkyWeatherRules.Kind>();
            foreach (var s in ss) for (int k = 0; k < 6; k++) if (Count(s, (SkyWeatherRules.Kind)k, 2000) > 0) seen.Add((SkyWeatherRules.Kind)k);
            PlaytestKit.Check(seen.Count == 6, $"여섯 날씨가 다 안 나옴({seen.Count})");
            // 비 확률은 가중치 비율 근처(여름 비 1.9 / (1.1+1.1+1.9+0.8+0.7+0) = 0.339)
            float rainSummer = Count(summer, SkyWeatherRules.Kind.Rain) / 6000f;
            PlaytestKit.Check(rainSummer > 0.31f && rainSummer < 0.37f, $"여름 비 비율 {rainSummer:0.000} ≠ 0.339 근처");

            // 가중치가 전부 0 이면 맑음
            var zero = winter; zero.Wx = new float[6];
            PlaytestKit.Check(SkyWeatherRules.KeyAt(t0, zero) == SkyWeatherRules.Kind.Clear, "가중치 0 인데 맑음이 아님");

            // 강제·시각 붙들기
            SkyWeatherRules.ForcedWeather = SkyWeatherRules.Kind.Rain; SkyWeatherRules.ForcedSeason = "winter";
            PlaytestKit.Check(SkyWeatherRules.CurrentKind() == SkyWeatherRules.Kind.Rain && SkyWeatherRules.CurrentSeason().Key == "winter", "강제가 안 먹음");
            SkyWeatherRules.ForcedWeather = null; SkyWeatherRules.ForcedSeason = null;
            SkyWeatherRules.NowMsFn = () => t0; SkyWeatherRules.MonthFn = () => 1;
            PlaytestKit.Check(SkyWeatherRules.CurrentKind() == SkyWeatherRules.KeyAt(t0, winter), "시각 붙들기로 현재 날씨가 안 정해짐");
        }

        private static void CheckComponent()
        {
            var camGo = new GameObject("PlaytestSkyWeatherCam");
            var cam = camGo.AddComponent<Camera>();
            try
            {
                RenderSettings.fog = true; RenderSettings.fogDensity = 0.01f; RenderSettings.fogColor = new Color(0.5f, 0.5f, 0.5f);
                SkyPass.HourFn = () => 12;
                SkyWeatherRules.ForcedSeason = "summer";
                SkyWeatherRules.ForcedWeather = SkyWeatherRules.Kind.Clear;
                var sw = SkyWeather.Install(cam);
                if (sw == null) { PlaytestKit.Fail("SkyWeather 가 안 서(SAGA_NO_WEATHER?)"); return; }
                PlaytestKit.Check(SkyWeather.Instance == sw && SkyWeather.Install(cam) == sw, "두 번 설치하면 하나여야 함");
                PlaytestKit.Check(sw.LayerCount == 3, $"구름 겹 {sw.LayerCount} ≠ 3(Resources/Sky/cloud_layer_01~03)");
                PlaytestKit.Check(sw.HasParticles, "입자 셋이 안 섬(Resources/Sky/fx_rain·snow·fog)");

                sw.Refresh();
                PlaytestKit.Check(sw.RainRate == 0f && sw.SnowRate == 0f && sw.FogRate == 0f, "맑음인데 입자가 나옴");
                float clearAlpha = sw.CloudAlpha(0);

                SkyWeatherRules.ForcedWeather = SkyWeatherRules.Kind.Rain; sw.Refresh();
                PlaytestKit.Check(sw.RainRate > 0f && sw.SnowRate == 0f && sw.FogRate == 0f, "비 날씨에 비만 나와야 함");
                PlaytestKit.Check(sw.CloudAlpha(0) > clearAlpha && sw.CloudAlpha(0) >= 0.9f, "비 날씨에 구름이 짙어지지 않음");
                PlaytestKit.Check(sw.CloudAlpha(1) < sw.CloudAlpha(0) && sw.CloudAlpha(2) < sw.CloudAlpha(1), "구름 겹 투명도가 아래부터 짙어야 함");
                float rainDens = RenderSettings.fogDensity;
                PlaytestKit.Check(Mathf.Abs(rainDens - 0.01f * 1.6f) < 1e-5f, $"비 날씨 안개 농도 {rainDens} ≠ 0.016");

                SkyWeatherRules.ForcedWeather = SkyWeatherRules.Kind.Snow; sw.Refresh();
                PlaytestKit.Check(sw.SnowRate > 0f && sw.RainRate == 0f && sw.FogRate == 0f, "눈 날씨에 눈만 나와야 함");
                SkyWeatherRules.ForcedWeather = SkyWeatherRules.Kind.Fog; sw.Refresh();
                PlaytestKit.Check(sw.FogRate > 0f && sw.RainRate == 0f && sw.SnowRate == 0f, "안개 날씨에 안개만 나와야 함");
                PlaytestKit.Check(Mathf.Abs(RenderSettings.fogDensity - 0.01f * 2.4f) < 1e-5f, "안개 날씨 농도가 ×2.4 가 아님");

                // 시간대 색 — 밤 구름은 어둡다
                SkyWeatherRules.ForcedWeather = SkyWeatherRules.Kind.Cloud; SkyPass.HourFn = () => 12; sw.Refresh();
                var noon = sw.CloudAlpha(0) > 0 ? new[] { 1f } : null; // 알파 확인용
                var noonColor = GetLayerColor(sw);
                SkyPass.HourFn = () => 23; sw.Refresh();
                var nightColor = GetLayerColor(sw);
                PlaytestKit.Check(noonColor.r > 0.95f && nightColor.r < 0.4f && nightColor.b > nightColor.r, $"시간대 색이 다름(낮 {noonColor} 밤 {nightColor})");

                // 안개 곱 왕복 — 치우면 씬이 켜 둔 값으로 되돌아온다
                sw.Teardown();
                PlaytestKit.Check(SkyWeather.Instance == null, "치웠는데 Instance 가 남음");
                PlaytestKit.Check(Mathf.Abs(RenderSettings.fogDensity - 0.01f) < 1e-6f && Mathf.Abs(RenderSettings.fogColor.r - 0.5f) < 1e-5f, "치운 뒤 안개가 원래 값으로 안 돌아옴");

                // 씬 안개가 꺼져 있으면 안 건드린다
                RenderSettings.fog = false; RenderSettings.fogDensity = 0.02f;
                var sw2 = SkyWeather.Install(cam); sw2.Refresh();
                PlaytestKit.Check(Mathf.Abs(RenderSettings.fogDensity - 0.02f) < 1e-6f, "안개가 꺼진 씬의 농도를 건드림");
                sw2.Teardown();
            }
            finally
            {
                if (SkyWeather.Instance != null) SkyWeather.Instance.Teardown();
                Object.DestroyImmediate(camGo);
            }
        }

        private static Color GetLayerColor(SkyWeather sw)
        {
            var mr = sw.transform.Find("CloudLayer_1")?.GetComponent<MeshRenderer>();
            return mr != null ? mr.sharedMaterial.color : Color.magenta;
        }
    }
}
