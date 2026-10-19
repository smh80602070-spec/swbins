using UnityEngine;
using Saga.Dungeon.Audio;
using Saga.Dungeon.Data;

namespace Saga.Dungeon.World
{
    /// <summary>
    /// PLAN.md 101-3 F "죽음" — 적이 쓰러진 자리에 짧게 남는 표식. 실제
    /// 보상(경험치·돈·장비·보석)은 `DungeonEnemy.Die()`가 그 자리에서
    /// 이미 다 준다(세이브·베스티어리·퀘스트 완료까지 얽혀 있어 이번
    /// 항목 때문에 그 흐름을 늦추지 않는다 — 101-3 장 전제 "기존 씬
    /// 구성을 안 바꾸는 컴포넌트 추가"). 이 마커는 그 보상의 **시각적
    /// 잔향**일 뿐이라 주워도 아무것도 더 안 준다 — 반짝임+효과음으로
    /// "여기서 뭔가 떨어졌었다"는 확인만 준다.
    ///
    /// 회수 판정은 트리거 콜라이더 대신 `DungeonSecretStash.cs`와 같은
    /// "DUNGEON 관례"(Update() 폴링 거리 판정)를 그대로 따른다.
    ///
    /// **전리품 빛기둥(PLAN.md 109-10, 웹 §5.9)** — 명품 이상이 떨어지면 그 자리에 등급색 기둥이 선다
    /// (디아블로3 낙하 빛기둥). 이 트랙 무기 등급 셋(`ItemData.Grade`) + 명소 층 첫 토벌 무기를 웹 넷에
    /// 맞췄다: 1 = 명품(노랑, 옅고 짧게) · 2 = 보물(초록) · 명소 무기 = 고유(주황, 굵고 높게). 높이는 웹
    /// 110·180·260 의 비를 이 방 크기에 맞춘 3.4·5.6·8m. 보물·고유는 떨어지는 순간 소리가 난다.
    /// 기둥이 선 표식은 1.5초 동안 줍히지 않는다 — 바로 곁에서 쓰러뜨려도 기둥이 서는 걸 보게.
    /// </summary>
    public class LootMarker : MonoBehaviour
    {
        private const float PickupRadius = 2f; // PLAN.md 101-3 F "회수 반경 2m" 그대로.
        private const float LifetimeSec = 12f; // 안 주우면 스스로 사라진다 — 방에 계속 쌓이지 않게.
        private const float BobHeight = 0.12f;
        private const float BobSpeed = 2.5f;
        private const float SpinDegPerSec = 90f;

        private static readonly Color GlowColor = new Color(0.75f, 0.85f, 1f);
        private static readonly Color EmissionColor = new Color(0.5f, 0.6f, 0.9f);

        /// <summary>테스트 전용 카운터(리플렉션 대신) — `HitSpark.SpawnCount`와 같은 결.</summary>
        public static int SpawnCount { get; private set; }

        public const int PillarNone = 0, PillarFine = 1, PillarTreasure = 2, PillarUnique = 3;
        private static readonly float[] PillarHeight = { 0f, 3.4f, 5.6f, 8f };
        private static readonly float[] PillarRadius = { 0f, 0.18f, 0.18f, 0.26f };
        private static readonly float[] PillarAlpha = { 0f, 0.28f, 0.28f, 0.42f };
        private static readonly Color[] PillarColor =
        {
            Color.clear,
            new Color(1f, 1f, 0.39f),       // 웹 명품 #ffff64
            new Color(0f, 0.75f, 0f),       // 웹 보물 #00c000
            new Color(0.94f, 0.65f, 0.23f), // 웹 고유 #f0a53a
        };
        private const float PillarRiseSec = 0.35f;
        private const float PillarHoldSec = 1.5f;

        /// <summary>진단 — 기둥이 선 수·마지막 기둥 등급.</summary>
        public static int PillarCount { get; private set; }
        public static int LastPillarTier { get; private set; }

        /// <summary>떨어진 물건 → 기둥 등급. 명소 층 첫 토벌 무기(`wp_lm_*`, 한 번뿐)는 고유.</summary>
        public static int PillarTierOf(ItemData item)
        {
            if (item == null || item.Grade <= 0) return PillarNone;
            if (item.Id.StartsWith("wp_lm_")) return PillarUnique;
            return item.Grade >= 2 ? PillarTreasure : PillarFine;
        }

        /// <summary>U-0126 전리품 거르기 — 떨굼 하나를 규칙대로: 숨기기면 표식을 안 세우고(다른 것 — 금 말고 보석 — 이 함께면 기둥 없는 표식만),
        /// 빛기둥이면 명품 아래라도 명품 기둥을, 보이기면 예전 그대로(등급 기둥). 진단이 직접 부른다.</summary>
        public static LootFilter.Act SpawnFiltered(Vector3 worldPos, ItemData item, bool better, bool hasOther)
        {
            var act = LootFilter.Decide(item, better);
            if (act == LootFilter.Act.Hide)
            {
                HiddenCount++;
                if (hasOther) Spawn(worldPos);
                return act;
            }
            Spawn(worldPos, act == LootFilter.Act.Beam ? Mathf.Max(PillarTierOf(item), PillarFine) : PillarTierOf(item));
            return act;
        }

        /// <summary>진단 — 거르기로 숨긴 무기 수.</summary>
        public static int HiddenCount { get; private set; }

        private int _pillarTier;
        private LineRenderer _core;
        private LineRenderer _halo;

        private Transform _player;
        private Transform _visual;
        private Vector3 _basePos;
        private float _age;

        public static void Spawn(Vector3 worldPos, int pillarTier = PillarNone)
        {
            SpawnCount++;
            var go = new GameObject("LootMarker");
            go.transform.position = worldPos;
            var marker = go.AddComponent<LootMarker>();
            pillarTier = Mathf.Clamp(pillarTier, PillarNone, PillarUnique);
            if (pillarTier == PillarNone) return;
            PillarCount++;
            LastPillarTier = pillarTier;
            marker._pillarTier = pillarTier;
            marker.BuildPillar();
            if (pillarTier >= PillarTreasure) SfxPlayer.PlayDiscovery(); // 웹 — 보물·전설·고유는 떨어지는 순간 소리.
        }

        /// <summary>기둥 = 세로 선 둘(속 기둥 + 두 배 폭 옅은 테), 위로 갈수록 사라진다. 선은 늘 카메라를 본다.</summary>
        private void BuildPillar()
        {
            Color c = PillarColor[_pillarTier];
            float a = PillarAlpha[_pillarTier];
            _core = NewBeam("PillarCore", c, a * 1.6f, PillarRadius[_pillarTier] * 2f);
            _halo = NewBeam("PillarHalo", c, a * 0.6f, PillarRadius[_pillarTier] * 4.5f);
            SetPillarHeight(0.05f);
        }

        private LineRenderer NewBeam(string name, Color c, float alpha, float width)
        {
            var go = new GameObject(name);
            go.transform.SetParent(transform, false);
            var lr = go.AddComponent<LineRenderer>();
            lr.material = new Material(Shader.Find("Sprites/Default")) { name = name + " (generated)" };
            lr.useWorldSpace = false;
            lr.positionCount = 2;
            lr.widthMultiplier = width;
            lr.shadowCastingMode = UnityEngine.Rendering.ShadowCastingMode.Off;
            lr.receiveShadows = false;
            var g = new Gradient();
            g.SetKeys(new[] { new GradientColorKey(c, 0f), new GradientColorKey(Color.Lerp(c, Color.white, 0.35f), 1f) },
                new[] { new GradientAlphaKey(Mathf.Clamp01(alpha), 0f), new GradientAlphaKey(Mathf.Clamp01(alpha) * 0.7f, 0.6f), new GradientAlphaKey(0f, 1f) });
            lr.colorGradient = g;
            return lr;
        }

        private void SetPillarHeight(float h)
        {
            foreach (var lr in new[] { _core, _halo })
            {
                if (lr == null) continue;
                lr.SetPosition(0, Vector3.zero);
                lr.SetPosition(1, Vector3.up * h);
            }
        }

        /// <summary>진단 — 기둥 등급·지금 높이(없으면 0).</summary>
        public int PillarTier => _pillarTier;
        public float PillarTopHeight => _core != null ? _core.GetPosition(1).y : 0f;
        public float PillarFullHeight => PillarHeight[_pillarTier];

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

            if (_pillarTier > PillarNone)
                SetPillarHeight(PillarHeight[_pillarTier] * Mathf.SmoothStep(0.02f, 1f, Mathf.Clamp01(_age / PillarRiseSec)));

            bool holding = _pillarTier > PillarNone && _age < PillarHoldSec;
            if (!holding && _player != null && Vector3.Distance(_basePos, _player.position) <= PickupRadius)
            {
                SfxPlayer.Play("item_pick"); // tasks U-0104 — 주울 때(떨어질 때 보물 소리는 위 PlayDiscovery).
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
