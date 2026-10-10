using UnityEngine;

namespace Saga.Dungeon.Player
{
    /// <summary>
    /// tasks U-0082 — 사가나락 방 조명. PBR 방은 천장이 해를 막아 보조등 없이 찍으면 거의 까맸다(U-0077 측정 최대 화소 (32,46,114)).
    /// 원작 문법(디아블로)대로 주인공 둘레 따뜻한 횃불 점광 하나 + 씬 앰비언트(Flat) 상향 — 빛을 더할 뿐, 그림자·텍스처·품질 설정은 안 건드린다.
    /// 값은 10-10 측정에서 고른 것. 2나락 색 보정 LUT 세기(BuildGameToneLuts.DungeonContribution 0.3)와 같이 맞춘다.
    /// <see cref="PlayerController"/> 의 Awake 가 붙인다(사가나락 씬에서만). 씬 파일은 안 고친다(런타임).
    /// </summary>
    public static class HeroTorch
    {
        public const string ObjectName = "HeroTorch";
        public static readonly Color HeroTorchColor = new Color(1f, 0.78f, 0.55f);
        public const float HeroTorchRange = 12f;
        public const float HeroTorchIntensity = 4f;
        public const float HeroTorchHeight = 2.2f;
        /// <summary>방 앰비언트 — 씬 빌더 값 (0.16,0.15,0.18) 에서 올림.</summary>
        public static readonly Color RoomAmbient = new Color(0.7f, 0.66f, 0.76f);

        /// <summary>주인공 밑에 횃불을 하나만 달고(이미 있으면 그대로) 앰비언트를 맞춘다.</summary>
        public static Light Attach(Transform hero)
        {
            RenderSettings.ambientMode = UnityEngine.Rendering.AmbientMode.Flat;
            RenderSettings.ambientLight = RoomAmbient;
            // 실행 중엔 ambientLight 만 바꿔서는 URP 가 읽는 SH 가 안 바뀐다(10-10 확인) — 주변광 SH 를 직접 넣는다
            var sh = new UnityEngine.Rendering.SphericalHarmonicsL2();
            sh.AddAmbientLight(RoomAmbient.linear);
            RenderSettings.ambientProbe = sh;
            if (hero == null) return null;
            var existing = hero.Find(ObjectName);
            if (existing != null && existing.TryGetComponent<Light>(out var had)) return had;
            var go = new GameObject(ObjectName);
            go.transform.SetParent(hero, false);
            go.transform.localPosition = new Vector3(0f, HeroTorchHeight, 0f);
            var light = go.AddComponent<Light>();
            light.type = LightType.Point;
            light.color = HeroTorchColor;
            light.range = HeroTorchRange;
            light.intensity = HeroTorchIntensity;
            light.shadows = LightShadows.None;
            light.renderMode = LightRenderMode.ForcePixel;
            return light;
        }
    }
}
