using UnityEngine;

namespace Saga.Core
{
    /// <summary>
    /// PLAN.md 101-3 C "타격 VFX" — 히트마다 짧게 튀는 불꽃 파티클.
    /// 표는 "Mobile: Shuriken 스파크 8입자 / PC: VFX Graph 동일 이름"이라
    /// 적었지만 VFX Graph는 에디터 노드 그래프로 그려야 하는 애셋이라
    /// 이 프로젝트가 지금까지 지켜 온 "빌드 스크립트가 전부 코드로 짓는다"
    /// 방식과 안 맞는다(사람이 그래프를 열어 그릴 사람 몫 — PLAN.md 0장
    /// 원칙과 같은 이유로 지금은 미룬다). PC도 같은 Shuriken을 재사용하고
    /// 강공격만 입자 수·속도로 구분한다.
    ///
    /// **풀링 없이 즉시 파괴** — 표는 "풀링 16"을 적어 뒀지만
    /// `DamagePopup.cs`가 이미 겪은 것과 같은 이유(도메인 리로드를 끈
    /// 헤드리스 연속 검증에서 static 배열이 이전 Play 세션에 파괴된
    /// Unity 오브젝트를 계속 들고 있게 된다 — 배열 자체는 null이 아니라
    /// `EnsurePool()`류 가드로 못 거른다)로 실제 오브젝트 풀은 위험하다.
    /// 수명이 0.25초로 짧고 공격 쿨다운(0.55초+)보다 훨씬 빨리 끝나
    /// 동시에 여럿이 겹칠 일이 드물어(회전베기가 그나마 예외) Destroy에
    /// 맡겨도 모바일 성능 부담이 DamagePopup과 같은 수준으로 작다고 본다.
    /// </summary>
    public static class HitSpark
    {
        private const float LifeSec = 0.25f;
        private const int NormalParticles = 8; // 표의 "Mobile 8입자" 그대로.
        private const int HeavyParticles = 14; // PC·강공격 구분은 그래프 대신 입자 수·속도로.
        private const float NormalSpeed = 3f;
        private const float HeavySpeed = 5f;

        private static readonly Color SparkColor = new Color(1f, 0.85f, 0.3f);

        /// <summary>테스트 전용 카운터(리플렉션 대신) — `StoryCombat.RestoreMp`와
        /// 같은 결로 헤드리스 검증이 "스폰이 실제로 됐는지"를 값으로 확인한다.</summary>
        public static int SpawnCount { get; private set; }

        public static void Spawn(Vector3 worldPos, bool heavy = false)
        {
            SpawnCount++;

            var go = new GameObject("HitSpark");
            go.transform.position = worldPos;

            var ps = go.AddComponent<ParticleSystem>();
            var main = ps.main;
            main.duration = LifeSec;
            main.loop = false;
            main.startLifetime = LifeSec;
            main.startSpeed = heavy ? HeavySpeed : NormalSpeed;
            main.startSize = heavy ? 0.16f : 0.1f;
            main.startColor = SparkColor;
            main.simulationSpace = ParticleSystemSimulationSpace.World;
            main.playOnAwake = false;
            main.stopAction = ParticleSystemStopAction.None;

            var emission = ps.emission;
            emission.rateOverTime = 0f;

            var shape = ps.shape;
            shape.shapeType = ParticleSystemShapeType.Sphere;
            shape.radius = 0.05f;

            // URP는 내장 파티클 셰이더(Built-in RP 전용)를 마젠타로
            // 그린다 — `Sprites/Default`는 두 RP 모두에서 그대로 렌더되는
            // 단순 알파 블렌드 셰이더라(URP 전용 키워드 배선 없이도 동작)
            // 새 머티리얼 없이 안전하게 쓸 수 있다.
            var renderer = ps.GetComponent<ParticleSystemRenderer>();
            renderer.material = new Material(Shader.Find("Sprites/Default"));

            ps.Emit(heavy ? HeavyParticles : NormalParticles);
            Object.Destroy(go, LifeSec);
        }
    }
}
