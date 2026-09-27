using UnityEngine;

namespace Saga.Story.World
{
    /// <summary>
    /// PLAN.md 101-2 STORY "5-7 손맛 표준"(2026-09-17) — DUNGEON
    /// `World/DamagePopup.cs`와 완전히 같은 로직(SagaStory.asmdef 자체가
    /// 없어 타입을 직접 못 쓴다 — 루트 CLAUDE.md "다섯 판은 다섯 벌 복사"
    /// 원칙). "heavy"(강공격) 대신 이 판의 대응 개념인 크리티컬(crit)로
    /// 색을 가른다.
    /// </summary>
    public class DamagePopup : MonoBehaviour
    {
        private const float RiseSpeed = 1.4f;
        private const float LifeSec = 0.6f;

        private static readonly Color NormalColor = Color.white;
        private static readonly Color CritColor = new Color(1f, 0.55f, 0.1f);

        private float _t;
        private TMPro.TextMeshPro _mesh;
        private Camera _cam;

        public static void Spawn(Vector3 worldPos, float amount, bool crit)
        {
            var go = new GameObject("DamagePopup");
            go.transform.position = worldPos;

            var mesh = Saga.Core.SagaWorldText.Add(go, Mathf.RoundToInt(amount).ToString(), 48f * (crit ? 0.32f : 0.22f), crit ? CritColor : NormalColor);

            go.AddComponent<DamagePopup>();
        }

        /// <summary>PLAN.md 109-11-1 — 플레이어가 맞은 피해(빛깔을 따로).</summary>
        public static void Spawn(Vector3 worldPos, float amount, Color color)
        {
            var go = new GameObject("DamagePopup");
            go.transform.position = worldPos;
            Saga.Core.SagaWorldText.Add(go, Mathf.RoundToInt(amount).ToString(), 48f * 0.26f, color);
            go.AddComponent<DamagePopup>();
        }

        private void Awake()
        {
            _mesh = GetComponent<TMPro.TextMeshPro>();
            _cam = Camera.main;
        }

        private void Update()
        {
            _t += Time.deltaTime;
            transform.position += Vector3.up * RiseSpeed * Time.deltaTime;
            if (_cam != null) transform.rotation = _cam.transform.rotation;

            if (_mesh != null)
            {
                Color c = _mesh.color;
                c.a = Mathf.Clamp01(1f - _t / LifeSec);
                _mesh.color = c;
            }

            if (_t >= LifeSec) Destroy(gameObject);
        }
    }
}
