using UnityEngine;

namespace Saga.Core
{
    /// <summary>
    /// U-0041 — 자체툴(K-0034) 하늘 파노라마 12장(`Resources/Sky/sky_&lt;새벽·낮·노을·밤&gt;_&lt;과거·현재·미래&gt;.jpg`)을 고르고 하늘로 입힌다.
    /// 순수 함수(시각·시대 → 이름)와 적용(`Skybox/Panoramic` 재질 + 카메라 하늘 배경)을 나눈다. 그림이 없으면 아무것도 안 바꾼다.
    /// 그림은 이 파일이 안 놓는다(K-0019 배치). 해·달 위치 표식(`sky_markers.json`)으로 조명 방향을 맞추는 일은 후속.
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

        /// <summary>하늘을 입힌다(전역 skybox + 카메라 배경을 하늘로). 그림·재질이 없으면 false 이고 아무것도 안 바꾼다.</summary>
        public static bool Apply(string name, Camera camera)
        {
            var tex = Load(name);
            if (tex == null) return false;
            var mat = Saga.Core.Region.RegionMaterials.Make("Sky");
            if (mat == null) return false;
            tex.wrapMode = TextureWrapMode.Clamp; // 좌우 이음매
            mat.SetTexture("_MainTex", tex);
            mat.SetFloat("_Mapping", 1f); mat.SetFloat("_ImageType", 0f); mat.SetFloat("_Rotation", 270f);
            RenderSettings.skybox = mat;
            if (camera != null) camera.clearFlags = CameraClearFlags.Skybox;
            if (Application.isPlaying) DynamicGI.UpdateEnvironment();
            return true;
        }
    }
}
