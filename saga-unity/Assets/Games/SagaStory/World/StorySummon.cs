using System.Collections.Generic;
using UnityEngine;
using Saga.Story.Data;
using Saga.Core;

namespace Saga.Story.World
{
    /// <summary>
    /// PLAN.md 106-10 둘째 단계 — STORY 소환수 "우레뿔 거수"(가상 이름, 원작 소환수 없음). DUNGEON `PartySummon`(바위 거신)의
    /// 판별 복사지만 2.5D 에 맞게 고쳤다: 발판이 허공에 떠 있는 판이라 땅에서 솟으면 발판 밑으로 몸이 비친다 —
    /// 대신 **먹구름에서 번개와 함께 내려선다**(0~1.2초). 2.0초에 뛰어올라 3.2초에 땅을 내려찍어 좌우 14m·위아래 6m 안
    /// 적 전부에 플레이어 한 타 × 8(두목 체력 216 의 약 8할 — 한 번에 두목을 지우진 않게). 4.2초부터 줄어들어 5초에 사라진다.
    /// 몸은 Mixamo Warrok(뿔 거구, Mutant Jump Attack 클립)을 6.5m 로 키워 먹구름빛을 입힌다 — 이 판 두목 몸(Brute)과 안 겹친다.
    /// 컷(`StoryCutscenes.PlaySummon`)은 카메라·이름표만, 시간은 이 개체가 센다. 컷을 넘기면 `ResolveNow()`(피해는 한 번만).
    /// </summary>
    public class StorySummon : MonoBehaviour
    {
        public const float RadiusX = 14f;
        public const float RadiusY = 6f;
        public const float DamageMul = 8f;
        public const float Height = 6.5f;
        public const float DescendSec = 1.2f;
        public const float SwingSec = 2.0f;   // 내려찍기 클립을 틀어 땅에 닿는 순간이 SlamSec 에 오게.
        public const float SlamSec = 3.2f;
        public const float ShrinkStartSec = 4.2f;
        public const float EndSec = 5.0f;
        public const float StandOffM = 4f;
        public const float LaneZ = 1.5f;      // 동료(0.9)보다 한 줄 더 뒤 — 크게 보이되 플레이어를 안 가린다.
        private const float DropFromM = 9f;

        private static readonly Color StormTint = new Color(0.55f, 0.62f, 0.82f);
        private static readonly Color BoltColor = new Color(0.75f, 0.88f, 1f);

        private Transform _body;
        private Animator _animator;
        private Light _light;
        private LineRenderer _ring;
        private LineRenderer _skyBolt;
        private readonly List<LineRenderer> _hitBolts = new List<LineRenderer>();
        private float _t;
        private float _damage;
        private bool _landed, _swung, _slammed;
        private float _boltFade;

        public bool Slammed => _slammed;
        public int LastHitCount { get; private set; }
        public float Elapsed => _t;
        public float Damage => _damage;
        public bool HasModel => _animator != null;
        public static int SlamCount { get; private set; }

        /// <summary>플레이어가 보는 쪽 `StandOffM` 앞, 플레이어 발 높이에 세운다.</summary>
        public static StorySummon Spawn(GameObject modelPrefab, Vector3 playerPos, float facing, float damage)
        {
            float dir = facing >= 0f ? 1f : -1f;
            var go = new GameObject("StorySummon");
            go.transform.position = new Vector3(playerPos.x + dir * StandOffM, playerPos.y, LaneZ);
            go.transform.rotation = Quaternion.Euler(0f, dir > 0f ? -90f : 90f, 0f); // 플레이어 쪽(화면 가운데)을 보고 선다.
            var s = go.AddComponent<StorySummon>();
            s._damage = damage;
            s.Build(modelPrefab);
            return s;
        }

        private void Build(GameObject modelPrefab)
        {
            _body = new GameObject("Body").transform;
            _body.SetParent(transform, false);
            if (modelPrefab != null && modelPrefab.GetComponent<Animator>() != null)
            {
                var inst = Instantiate(modelPrefab, _body, false);
                inst.name = "Visual";
                var rs = inst.GetComponentsInChildren<Renderer>();
                if (rs.Length > 0)
                {
                    var b = rs[0].bounds;
                    foreach (var r in rs) b.Encapsulate(r.bounds);
                    if (b.size.y > 0.01f) inst.transform.localScale = Vector3.one * (Height / b.size.y);
                }
                _animator = inst.GetComponent<Animator>();
                if (_animator != null) _animator.cullingMode = AnimatorCullingMode.AlwaysAnimate;
                CharacterVisual.Tint(inst, StormTint);
            }
            else
            {
                CharacterVisual.SpawnFallbackCapsule(_body, Height, StormTint);
            }
            _body.localPosition = new Vector3(0f, DropFromM, 0f);

            _light = gameObject.AddComponent<Light>();
            _light.type = LightType.Point;
            _light.color = BoltColor;
            _light.range = 16f;
            _light.intensity = 0f;
            _light.shadows = LightShadows.None;

            _ring = Line("SummonRing", 0.1f);
            SetRing(_ring, 3f);
            _skyBolt = Line("SkyBolt", 0.18f);
            _skyBolt.enabled = false;
        }

        private LineRenderer Line(string name, float width)
        {
            var go = new GameObject(name);
            go.transform.SetParent(transform, false);
            var lr = go.AddComponent<LineRenderer>();
            lr.useWorldSpace = true;
            lr.widthMultiplier = width;
            lr.material = new Material(Shader.Find("Sprites/Default"));
            lr.startColor = lr.endColor = BoltColor;
            lr.shadowCastingMode = UnityEngine.Rendering.ShadowCastingMode.Off;
            return lr;
        }

        private void SetRing(LineRenderer lr, float radius)
        {
            const int seg = 48;
            lr.loop = true;
            lr.positionCount = seg;
            Vector3 c = transform.position + Vector3.up * 0.06f;
            for (int i = 0; i < seg; i++)
            {
                float a = i * Mathf.PI * 2f / seg;
                lr.SetPosition(i, c + new Vector3(Mathf.Cos(a) * radius, 0f, Mathf.Sin(a) * radius * 0.5f));
            }
        }

        /// <summary>꺾인 번개 한 줄 — `from`→`to` 를 여덟 마디로 나눠 옆으로 흔든다.</summary>
        private static void Zigzag(LineRenderer lr, Vector3 from, Vector3 to, float jitter)
        {
            const int n = 8;
            lr.loop = false;
            lr.positionCount = n + 1;
            for (int i = 0; i <= n; i++)
            {
                Vector3 p = Vector3.Lerp(from, to, i / (float)n);
                if (i > 0 && i < n) p += new Vector3(Random.Range(-jitter, jitter), 0f, Random.Range(-jitter, jitter) * 0.3f);
                lr.SetPosition(i, p);
            }
            lr.enabled = true;
        }

        private void Update() => Tick(Time.deltaTime);

        /// <summary>한 프레임 — 진단이 시간을 직접 넣는다. 끝나면 스스로 사라진다.</summary>
        public void Tick(float dt)
        {
            _t += dt;
            float land = Mathf.Clamp01(_t / DescendSec);
            float drop = 1f - (1f - land) * (1f - land); // 내려설수록 느려진다.
            float shrink = Mathf.SmoothStep(0f, 1f, Mathf.Clamp01((_t - ShrinkStartSec) / (EndSec - ShrinkStartSec)));
            if (_body != null)
            {
                _body.localPosition = new Vector3(0f, DropFromM * (1f - drop), 0f);
                _body.localScale = Vector3.one * Mathf.Max(0.01f, 1f - shrink);
            }
            if (_light != null) _light.intensity = (_slammed ? 3f : 6f * land) * (1f - shrink) + _boltFade * 10f;

            // 내려오는 동안 먹구름에서 몸까지 번개가 이어진다.
            if (!_landed && _skyBolt != null)
            {
                Vector3 top = transform.position + Vector3.up * (DropFromM + Height + 3f);
                Zigzag(_skyBolt, top, transform.position + Vector3.up * (DropFromM * (1f - drop) + Height * 0.8f), 0.6f);
            }
            if (!_landed && _t >= DescendSec)
            {
                _landed = true;
                if (_skyBolt != null) _skyBolt.enabled = false;
                _boltFade = 1f;
                StoryGroundDecal.Spawn(transform.position, StoryGroundDecal.Kind.HitMark);
                HitSpark.Spawn(transform.position + Vector3.up * 0.4f, true);
                StoryCameraFollow.Instance?.Shake(0.35f, 0.3f);
            }
            if (!_swung && _t >= SwingSec)
            {
                _swung = true;
                if (_animator != null) _animator.SetTrigger("Attack");
            }
            if (!_slammed && _t >= SlamSec) Slam();

            _boltFade = Mathf.Max(0f, _boltFade - dt * 3f);
            foreach (var lr in _hitBolts)
            {
                if (lr == null) continue;
                var c = new Color(BoltColor.r, BoltColor.g, BoltColor.b, _boltFade);
                lr.startColor = lr.endColor = c;
                lr.enabled = _boltFade > 0.02f;
            }
            if (_ring != null) _ring.enabled = !_slammed;
            if (_t >= EndSec) Destroy(gameObject);
        }

        /// <summary>컷이 넘겨졌거나 없을 때 — 아직 안 내리찍었으면 지금 내리찍고 곧바로 사라진다.</summary>
        public void ResolveNow()
        {
            if (this == null) return;
            if (!_slammed) Slam();
            Destroy(gameObject);
        }

        private void Slam()
        {
            _slammed = true;
            SlamCount++;
            int n = 0;
            Vector3 c = transform.position;
            var prev = StorySummonState.HitSource;
            StorySummonState.HitSource = StorySummonState.Source.None; // 소환 내리찍기는 게이지를 안 채운다.
            try
            {
                // 목록을 베껴 돈다 — 죽은 적은 OnDestroy 로 목록에서 빠진다.
                foreach (var e in new List<StoryEnemy>(StoryEnemy.All))
                {
                    if (e == null || e.IsDead) continue;
                    Vector3 d = e.transform.position - c;
                    if (Mathf.Abs(d.x) > RadiusX || Mathf.Abs(d.y) > RadiusY) continue;
                    Vector3 at = e.transform.position;
                    e.TakeDamage(_damage, true);
                    var lr = Line($"HitBolt{n}", 0.12f);
                    Zigzag(lr, at + Vector3.up * 9f, at + Vector3.up * 0.8f, 0.45f);
                    _hitBolts.Add(lr);
                    n++;
                }
            }
            finally
            {
                StorySummonState.HitSource = prev;
            }
            LastHitCount = n;
            _boltFade = 1f;
            StoryGroundDecal.Spawn(c, StoryGroundDecal.Kind.HitMark);
            HitSpark.Spawn(c + Vector3.up * 0.5f, true);
            StoryCameraFollow.Instance?.Shake(0.6f, 0.5f);
        }
    }
}
