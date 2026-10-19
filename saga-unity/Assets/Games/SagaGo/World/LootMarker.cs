using UnityEngine;

namespace Saga.Go.World
{
    /// <summary>
    /// PLAN.md 101-3 F "죽음" — DUNGEON `LootMarker.cs`와 같은 로직을 이
    /// asmdef용으로 새로 짠다(SagaGo가 SagaDungeon을 참조하지 않아 타입을
    /// 직접 못 씀). 도적·희귀 몬스터를 이긴 자리에 짧게 남는 표식 — 실제
    /// 보상(경험치·돈·장비·등용)은 `FinishFight()`가 그 자리에서 이미 다
    /// 준다. 이 마커는 그 보상의 **시각적 잔향**일 뿐이라 주워도 아무것도
    /// 더 안 준다.
    ///
    /// 회수 판정은 GO의 다른 월드 오브젝트(`HiddenTreasure.cs` 등)와 같은
    /// "Update() 폴링 거리 판정" 관례를 따른다.
    /// </summary>
    public class LootMarker : MonoBehaviour
    {
        private const float PickupRadius = 2f; // PLAN.md 101-3 F "회수 반경 2m" 그대로.
        private const float LifetimeSec = 12f;
        private const float BobHeight = 0.12f;
        private const float BobSpeed = 2.5f;
        private const float SpinDegPerSec = 90f;

        private static readonly Color GlowColor = new Color(0.75f, 0.85f, 1f);
        private static readonly Color EmissionColor = new Color(0.5f, 0.6f, 0.9f);

        /// <summary>테스트 전용 카운터(리플렉션 대신).</summary>
        public static int SpawnCount { get; private set; }

        private Transform _player;
        private Transform _visual;
        private Vector3 _basePos;
        private float _age;

        public static void Spawn(Vector3 worldPos)
        {
            SpawnCount++;
            var go = new GameObject("LootMarker");
            go.transform.position = worldPos;
            go.AddComponent<LootMarker>();
        }

        private void Awake()
        {
            _basePos = transform.position;
            var playerGo = GameObject.FindWithTag("Player");
            _player = playerGo != null ? playerGo.transform : null;
            BuildVisual();
        }

        private void BuildVisual()
        {
            var visual = GameObject.CreatePrimitive(PrimitiveType.Sphere);
            visual.name = "Visual";
            visual.transform.SetParent(transform, false);
            visual.transform.localScale = Vector3.one * 0.35f;
            visual.transform.localPosition = new Vector3(0f, 0.5f, 0f);
            Saga.Core.Colliders.Strip(visual);

            var mat = new Material(Shader.Find("Universal Render Pipeline/Lit")) { name = "LootMarker (generated)" };
            mat.color = GlowColor;
            mat.EnableKeyword("_EMISSION");
            mat.SetColor("_EmissionColor", EmissionColor);
            visual.GetComponent<MeshRenderer>().sharedMaterial = mat;

            _visual = visual.transform;
        }

        private void Update()
        {
            _age += Time.deltaTime;
            if (_visual != null)
            {
                float bob = Mathf.Sin(_age * BobSpeed) * BobHeight;
                _visual.localPosition = new Vector3(0f, 0.5f + bob, 0f);
                _visual.Rotate(Vector3.up, SpinDegPerSec * Time.deltaTime, Space.World);
            }

            if (_player != null && Vector3.Distance(_basePos, _player.position) <= PickupRadius)
            {
                // 순수 시각적 잔향이라 효과음 없이 조용히 사라진다(전용 클립을
                // 새로 끌어오는 대신 — DUNGEON LootMarker의 discovery SFX와 달리
                // GoAudio엔 이름 붙은 SFX 헬퍼가 없다, 범위 밖으로 남김).
                Destroy(gameObject);
                return;
            }

            if (_age >= LifetimeSec)
            {
                Destroy(gameObject);
            }
        }
    }
}
