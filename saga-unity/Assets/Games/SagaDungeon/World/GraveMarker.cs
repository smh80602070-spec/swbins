using UnityEngine;
using Saga.Dungeon.Audio;
using Saga.Dungeon.Data;
using Saga.Dungeon.UI;

namespace Saga.Dungeon.World
{
    /// <summary>
    /// PLAN.md 101-2 5.2 "유품(遺品)" — 웹판 §5.2(`saga-web/saga-dungeon/PLAN.md`
    /// 143행, 2026-09-18 코드분 완료·실기 미확인)의 "죽음 비용과 회수"를 이
    /// 트랙에 옮긴다. 웹판은 "다음 회차에 그 층에 도달하면"(런 리셋+절차적
    /// 재방문) 전제인데, 이 트랙은 편도 진행(방을 뜨면 그 자리로 못 돌아온다,
    /// `DungeonFloorRunner.cs`)이라 그 전제가 없다 — 대신 "회수 전에 방을
    /// 뜨면 잃는다"로 좁혀 재해석했다(`LootMarker`와 달리 이건 주우면 실제
    /// 보상을 준다 — <see cref="HeroState.DropGoldAsGrave"/>가 이미 골드를
    /// 챙겨 뒀다가 여기서 돌려준다). 세이브에는 안 남는다(편도 진행이라
    /// "같은 자리로 돌아와 로드"할 일이 없어 저장할 이유가 약하다 — 다음
    /// 손질 후보로 남겨 둠).
    ///
    /// 한 번에 하나만 존재한다(웹판 "회수 전에 다시 죽으면 옛 유품 소멸") —
    /// `Spawn()`이 이전 마커를 먼저 지운다. 방 갈이 시 자동 소멸은
    /// `DungeonFloorRunner.AddToRoom()`(그 방의 `_contentRoot` 자식이 되어
    /// 방이 갈릴 때 통째로 Destroy됨)에 맡긴다 — 별도 로직 없음.
    /// </summary>
    public class GraveMarker : MonoBehaviour
    {
        private const float PickupRadius = 2f; // LootMarker.cs와 같은 회수 반경.
        private const float BobHeight = 0.14f;
        private const float BobSpeed = 2f;
        private const float SpinDegPerSec = 60f;

        private static readonly Color GlowColor = new Color(0.55f, 0.4f, 0.75f); // LootMarker보다 어둡게(무겁게) — "잃은 것" 느낌.
        private static readonly Color EmissionColor = new Color(0.35f, 0.2f, 0.55f);

        /// <summary>테스트 전용 카운터(리플렉션 대신) — `LootMarker.SpawnCount`와 같은 결.</summary>
        public static int SpawnCount { get; private set; }

        private static GraveMarker _active;

        /// <summary>tasks U-0092 — 지금 유품(없으면 금 0). 은총에서 다시 설 때 그 자리·금을 기억했다가 그 방에 다시 닿으면 세운다.</summary>
        public static (Vector3 pos, int gold) Current => _active != null ? (_active.transform.position, _active._gold) : (Vector3.zero, 0);

        private int _gold;
        private Transform _player;
        private Transform _visual;
        private float _age;
        private bool _armed;

        /// <summary>이전 유품이 있었으면 먼저 지운다(웹판 "회수 전에 다시 죽으면 옛 유품 소멸").</summary>
        public static void Spawn(Vector3 worldPos, int gold)
        {
            if (_active != null) Destroy(_active.gameObject);

            SpawnCount++;
            var go = new GameObject("GraveMarker");
            go.transform.position = worldPos;
            var marker = go.AddComponent<GraveMarker>();
            marker._gold = gold;
            _active = marker;
            DungeonFloorRunner.Instance?.AddToRoom(go);
        }

        private void Awake()
        {
            var playerGo = GameObject.FindWithTag("Player");
            _player = playerGo != null ? playerGo.transform : null;
            BuildVisual();
        }

        private void OnDestroy()
        {
            if (_active == this) _active = null;
        }

        private void BuildVisual()
        {
            var visual = GameObject.CreatePrimitive(PrimitiveType.Cube);
            visual.name = "Visual";
            visual.transform.SetParent(transform, false);
            visual.transform.localScale = new Vector3(0.4f, 0.55f, 0.4f); // 관·비석 실루엣에 가깝게(구슬인 LootMarker와 구분).
            visual.transform.localPosition = new Vector3(0f, 0.5f, 0f);
            Object.Destroy(visual.GetComponent<Collider>());

            var mat = new Material(Shader.Find("Universal Render Pipeline/Lit")) { name = "GraveMarker (generated)" };
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

            // tasks U-0092 — 쓰러진 자리에서 그대로 일어나면 발밑 유품을 곧바로 다시 주워 유품이 뜻이 없었다(카드 촬영에서 "유품을 되찾았다" 가 바로 뜸).
            // 한 번 반경 밖으로 벗어난 뒤에야 주울 수 있다(웹 "돌아가서 되찾는다").
            float dist = _player != null ? Vector3.Distance(transform.position, _player.position) : float.MaxValue;
            if (!_armed) { if (dist > PickupRadius + 0.5f) _armed = true; return; }
            if (dist <= PickupRadius)
            {
                HeroState.AddGold(_gold);
                SfxPlayer.PlayDiscovery();
                string msg = string.Format(DungeonLocalization.T("grave.recovered", "유품을 되찾았다 — 금 {0}"), _gold);
                DialogueLabel.Instance?.Show(msg, 3f);
                Destroy(gameObject);
            }
        }
    }
}
