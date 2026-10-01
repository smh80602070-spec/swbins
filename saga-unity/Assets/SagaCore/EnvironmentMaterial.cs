using UnityEngine;

namespace Saga.Core
{
    /// <summary>
    /// 44장 "Environment" 교체 — 방/복도 바닥·벽에 실제 PBR 재질(Poly Haven,
    /// `BuildEnvironmentPbrSample.cs`가 미리 구워 둔 URP Lit 머티리얼)을
    /// 씌운다. 원본 머티리얼은 텍스처 실측 타일 크기(대략 2m 기준으로 가정)로
    /// 설계돼 있어, 표면 크기에 맞는 반복 횟수로 다시 구운 인스턴스를 새로
    /// 만든다(`DungeonRoomBuilder.MakeMaterial(color)`와 같은 결 — 공유 안
    /// 함, 인스턴스별. 방·복도 크기가 몇 종류뿐이라 인스턴스 수가 많지 않다).
    /// </summary>
    public static class EnvironmentMaterial
    {
        private const float TileMeters = 2f;

        // PLAN.md 103-1 "DUNGEON 방 셸 — 티어별 마모 3단"(2026-09-22) — 새 텍스처
        // 없이 톤만 어둡게·거칠게 눌러 "낡음"을 표현한다(GO `LandmarksBuilder`의
        // "새 지오메트리 없이 배치·톤 조합만 늘린다" 원칙과 같은 결). 0=깨끗(원본
        // 그대로), 1=때탄 갈색조, 2=짙게 바랜 폐허조.
        private static readonly Color[] WearTint =
        {
            Color.white,
            new Color(0.82f, 0.76f, 0.68f),
            new Color(0.60f, 0.56f, 0.52f),
        };
        private static readonly float[] WearSmoothnessScale = { 1f, 0.7f, 0.45f };

        public static Material MakeTiled(Material template, float widthMeters, float depthMeters, int wearTier = 0)
        {
            var mat = new Material(template) { name = template.name + " (tiled)" };
            mat.mainTextureScale = new Vector2(
                Mathf.Max(0.1f, widthMeters / TileMeters),
                Mathf.Max(0.1f, depthMeters / TileMeters));
            ApplyWear(mat, wearTier);
            return mat;
        }

        private static void ApplyWear(Material mat, int wearTier)
        {
            wearTier = Mathf.Clamp(wearTier, 0, WearTint.Length - 1);
            if (wearTier == 0) return;
            mat.color = WearTint[wearTier];
            // BuildEnvironmentPbrSample.cs가 구운 MetallicSmoothness 알파를 그대로
            // 통과시키려 _Smoothness=1로 둔 걸 여기서만 눌러 매끈함을 죽인다(원본
            // 재질 애셋은 안 건드림 — MakeTiled가 매번 새 인스턴스라 안전).
            if (mat.HasProperty("_Smoothness"))
            {
                mat.SetFloat("_Smoothness", mat.GetFloat("_Smoothness") * WearSmoothnessScale[wearTier]);
            }
        }
    }
}
