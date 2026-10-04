using UnityEngine;

namespace Saga.Core
{
    /// <summary>
    /// U-0041 — 자체툴(K-0034) 하늘 파노라마 12장(`Resources/Sky/sky_&lt;새벽·낮·노을·밤&gt;_&lt;과거·현재·미래&gt;.jpg`)을 고르고 하늘로 입힌다.
    /// 순수 함수(시각·시대 → 이름)와 적용(`Skybox/Panoramic` 재질 + 카메라 하늘 배경)을 나눈다. 그림이 없으면 아무것도 안 바꾼다.
    /// 그림은 이 파일이 안 놓는다(K-0019 배치). 해·달 위치 표식(`sky_markers.json`, K-0067 이 그림에 실제로 그린 자리)으로 조명 방향을 맞춘다 —
    /// `TrySun`(표식 → 월드 방향, 순수 함수)·`SkyPass` 가 주 조명에 적용.
    /// </summary>
    public static class SkyPanorama
    {
        public static readonly string[] Eras = { "past", "present", "future" };
        public static readonly string[] Times = { "dawn", "noon", "sunset", "night" };

        /// <summary>시각(0~23) → 새벽(5~7)·낮(8~15)·노을(16~18)·밤(그 밖).</summary>
        public static string TimeOf(int hour)
        {
            hour = ((hour % 24) + 24) % 24;
            if (hour >= 5 && hour <= 7) return "dawn";
            if (hour >= 8 && hour <= 15) return "noon";
            if (hour >= 16 && hour <= 18) return "sunset";
            return "night";
        }

        public static string NameFor(int hour, string era)
        {
            if (System.Array.IndexOf(Eras, era) < 0) era = "present";
            return $"sky_{TimeOf(hour)}_{era}";
        }

        public static Texture2D Load(string name) => Resources.Load<Texture2D>("Sky/" + name);

        /// <summary>하늘 파노라마를 입힐 때 쓰는 `Skybox/Panoramic` 의 `_Rotation`(도) — `Apply` 와 `SunDirection` 이 같은 값을 쓴다.</summary>
        public const float SkyRotation = 270f;

        /// <summary>해(밤엔 달) 표식 — 이미지 좌표(u 왼→오, v 위→아래, K-0067)와 조명이 달인지.</summary>
        public struct SunMark { public float U, V, Az, El; public bool Moon; }

        /// <summary>
        /// 이미지 좌표 → 월드에서 해를 향한 방향(단위). `Skybox/Panoramic`(위도·경도, 이미지 위쪽이 하늘 꼭대기)의 규칙:
        /// 경도 = (0.5 − u)·2π · 위도(꼭대기에서) = v·π → 방향 (sinθ·cos경도, cosθ, sinθ·sin경도), 하늘 돔을 `rotationDeg` 만큼 Y 축으로 돌린 것(x' = x·cos − z·sin, z' = x·sin + z·cos).
        /// 고도 = 90° − v·180° 라 K 의 표식 규약(`el = 90 − v·180`)과 같다.
        /// </summary>
        public static Vector3 SunDirection(float u, float v, float rotationDeg = SkyRotation)
        {
            float lon = (0.5f - u) * 2f * Mathf.PI, lat = v * Mathf.PI;
            float h = Mathf.Sin(lat);
            float x = h * Mathf.Cos(lon), y = Mathf.Cos(lat), z = h * Mathf.Sin(lon);
            float a = rotationDeg * Mathf.Deg2Rad, c = Mathf.Cos(a), s = Mathf.Sin(a);
            return new Vector3(x * c - z * s, y, x * s + z * c).normalized;
        }

        private static string _markersText;
        private static string MarkersText()
        {
            if (_markersText == null)
            {
                var ta = Resources.Load<TextAsset>("Sky/sky_markers");
                _markersText = ta != null ? ta.text : "";
            }
            return _markersText;
        }

        /// <summary>`sky_markers.json` 에서 이 하늘(`sky_noon_present` 이나 `noon_present`)의 해·달 표식을 읽는다. 없으면 거짓.</summary>
        public static bool TryMarker(string skyName, out SunMark mark)
        {
            mark = default;
            string key = skyName != null && skyName.StartsWith("sky_") ? skyName.Substring(4) : skyName;
            string t = MarkersText();
            if (string.IsNullOrEmpty(t) || string.IsNullOrEmpty(key)) return false;
            int at = t.IndexOf("\"" + key + "\"", System.StringComparison.Ordinal);
            if (at < 0) return false;
            int open = t.IndexOf('{', at);
            if (open < 0) return false;
            int depth = 0, end = -1;
            for (int i = open; i < t.Length; i++)
            {
                if (t[i] == '{') depth++;
                else if (t[i] == '}' && --depth == 0) { end = i; break; }
            }
            if (end < 0) return false;
            string block = t.Substring(open, end - open + 1);
            var uv = System.Text.RegularExpressions.Regex.Match(block, @"""sun_uv""\s*:\s*\[\s*([-0-9.eE]+)\s*,\s*([-0-9.eE]+)\s*\]");
            if (!uv.Success) return false;
            mark.U = float.Parse(uv.Groups[1].Value, System.Globalization.CultureInfo.InvariantCulture);
            mark.V = float.Parse(uv.Groups[2].Value, System.Globalization.CultureInfo.InvariantCulture);
            mark.El = 90f - mark.V * 180f;
            mark.Az = mark.U * 360f;
            mark.Moon = block.Contains("\"light\": \"moon\"") || block.Contains("\"light\":\"moon\"");
            return true;
        }

        /// <summary>이 하늘의 해(밤엔 달)를 향한 월드 방향. 표식이 없으면 거짓.</summary>
        public static bool TrySun(string skyName, out Vector3 dir, out bool moon)
        {
            dir = Vector3.up; moon = false;
            if (!TryMarker(skyName, out var m)) return false;
            dir = SunDirection(m.U, m.V);
            moon = m.Moon;
            return true;
        }

        /// <summary>하늘을 입힌다(전역 skybox + 카메라 배경을 하늘로). 그림·재질이 없으면 false 이고 아무것도 안 바꾼다.</summary>
        public static bool Apply(string name, Camera camera)
        {
            var tex = Load(name);
            if (tex == null) return false;
            var mat = Saga.Core.Region.RegionMaterials.Make("Sky");
            if (mat == null) return false;
            tex.wrapMode = TextureWrapMode.Clamp; // 좌우 이음매
            mat.SetTexture("_MainTex", tex);
            mat.SetFloat("_Mapping", 1f); mat.SetFloat("_ImageType", 0f); mat.SetFloat("_Rotation", SkyRotation);
            RenderSettings.skybox = mat;
            if (camera != null) camera.clearFlags = CameraClearFlags.Skybox;
            if (Application.isPlaying) DynamicGI.UpdateEnvironment();
            return true;
        }
    }
}
