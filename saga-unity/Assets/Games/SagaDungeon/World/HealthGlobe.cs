using System;
using System.Collections.Generic;
using UnityEngine;
using Saga.Core;
using Saga.Dungeon.Data;

namespace Saga.Dungeon.World
{
    /// <summary>
    /// tasks U-0205 피 구슬(고돗 G-0344 짝 — 디아블로 3 체력 구슬, 구조만). 적이 쓰러진 자리에 붉게 빛나는 구슬
    /// (잡졸 <see cref="Chance"/> · 정예 1 · 두목 <see cref="BossN"/>).
    ///   끌림   <see cref="MagnetM"/> 안에 들면 나에게 <see cref="PullSpeed"/> 로 다가오고, <see cref="EatM"/> 안이면 먹는다:
    ///          최대 체력 <see cref="HealPct"/>%(올림, 최소 1) 회복·"+n" 숫자.
    ///   가득   체력이 가득이면 안 먹고 제자리에 남는다(끌림도 멈춤 — 뒤에 쓰라고).
    ///   수명   <see cref="LifeSec"/> 뒤 사라진다 — 마지막 <see cref="FadeSec"/> 동안 줄어들며 빛이 흐려진다.
    /// 판정은 LootMarker 와 같은 DUNGEON 관례(Update 거리 폴링, 콜라이더 없음). 세이브에 안 남는다. SAGA_GLOBE=0 이면 안 떨군다.
    /// </summary>
    public class HealthGlobe : MonoBehaviour
    {
        public const float Chance = 0.22f;
        public const int BossN = 3;
        public const float HealPct = 12f;
        public const float MagnetM = 3f;
        public const float EatM = 0.7f;
        public const float PullSpeed = 9f;
        public const float LifeSec = 25f;
        public const float FadeSec = 3f;
        public const float Radius = 0.3f; // 고돗 촬영 — 0.2 는 먼 카메라에서 점 하나
        public const float SpreadM = 0.8f;
        private const float BaseY = 0.45f;
        private static readonly Color GlobeColor = new Color(0.95f, 0.12f, 0.12f);
        private static readonly Color HealNumberColor = new Color(1f, 0.45f, 0.45f);

        /// <summary>진단 — 떨군 수·먹은 수 · 살아 있는 구슬.</summary>
        public static int Dropped { get; private set; }
        public static int Eaten { get; private set; }
        public static readonly List<HealthGlobe> Active = new List<HealthGlobe>();

        /// <summary>진단 — 고정 씨앗 주입(null 이면 UnityEngine.Random).</summary>
        public static System.Random Rng;

        public static bool On => Environment.GetEnvironmentVariable("SAGA_GLOBE") != "0";

        /// <summary>한 알 회복량 — 최대 체력 12% 올림, 최소 1.</summary>
        public static int HealAmount => Math.Max(1, Mathf.CeilToInt(HeroState.HpMax * HealPct / 100f));

        private Transform _player;
        private Transform _visual;
        private Material _mat;
        private float _age;

        public float Age => _age;
        public bool Gone { get; private set; }

        /// <summary>쓰러진 적 자리에 — 떨군 수(`DungeonEnemy.Die` 한 곳에서만).</summary>
        public static int Drop(Vector3 pos, bool isBoss, bool isElite)
        {
            if (!On) return 0;
            float roll = Rng != null ? (float)Rng.NextDouble() : UnityEngine.Random.value;
            int n = isBoss ? BossN : (isElite || roll < Chance ? 1 : 0);
            for (int i = 0; i < n; i++)
            {
                float a = Mathf.PI * 2f * i / Mathf.Max(n, 1);
                Vector3 off = n > 1 ? new Vector3(Mathf.Cos(a), 0f, Mathf.Sin(a)) * SpreadM : Vector3.zero;
                var go = new GameObject("HealthGlobe");
                go.transform.position = pos + off;
                go.AddComponent<HealthGlobe>();
                Dropped++;
            }
            return n;
        }

        public static void ResetForTest()
        {
            foreach (var g in Active.ToArray()) if (g != null) DestroyImmediate(g.gameObject);
            Active.Clear();
            Dropped = 0;
            Eaten = 0;
        }

        private void Awake()
        {
            Active.Add(this);
            var playerGo = GameObject.FindWithTag("Player");
            _player = playerGo != null ? playerGo.transform : null;

            var visual = GameObject.CreatePrimitive(PrimitiveType.Sphere);
            visual.name = "Visual";
            visual.transform.SetParent(transform, false);
            visual.transform.localScale = Vector3.one * Radius * 2f;
            visual.transform.localPosition = new Vector3(0f, BaseY, 0f);
            Colliders.Strip(visual);
            _mat = new Material(Shader.Find("Universal Render Pipeline/Lit")) { name = "HealthGlobe (generated)" }; // U-0183 빌드 포함 셰이더(LootMarker 와 같음)
            _mat.color = GlobeColor;
            _mat.EnableKeyword("_EMISSION");
            _mat.SetColor("_EmissionColor", GlobeColor * 2f);
            var mr = visual.GetComponent<MeshRenderer>();
            mr.sharedMaterial = _mat;
            mr.shadowCastingMode = UnityEngine.Rendering.ShadowCastingMode.Off; // 작은 줍기는 그림자 없음
            mr.receiveShadows = false;
            _visual = visual.transform;
        }

        private void OnDestroy()
        {
            Active.Remove(this);
            if (_mat != null) Destroy(_mat);
        }

        private void Update()
        {
            if (_player == null)
            {
                var playerGo = GameObject.FindWithTag("Player");
                _player = playerGo != null ? playerGo.transform : null;
            }
            Step(Time.deltaTime, _player != null ? _player.position : (Vector3?)null);
        }

        /// <summary>한 걸음(진단이 직접 부른다) — 둥실·수명·끌림·먹기.</summary>
        public void Step(float dt, Vector3? playerPos)
        {
            if (Gone) return;
            _age += dt;
            if (_age >= LifeSec)
            {
                Vanish();
                return;
            }
            float k = Mathf.Clamp01((_age - (LifeSec - FadeSec)) / FadeSec); // 마지막 3초 흐려짐
            if (_visual != null)
            {
                _visual.localPosition = new Vector3(0f, BaseY + Mathf.Sin(_age * 3f) * 0.08f, 0f);
                _visual.localScale = Vector3.one * Radius * 2f * (1f - k);
            }
            if (_mat != null && k > 0f) _mat.SetColor("_EmissionColor", GlobeColor * 2f * (1f - k));

            if (playerPos == null || HeroState.Hp <= 0 || HeroState.Hp >= HeroState.HpMax) return; // 가득이면 제자리
            Vector3 to = playerPos.Value - transform.position;
            to.y = 0f;
            float d = to.magnitude;
            if (d <= EatM) Eat(playerPos.Value);
            else if (d <= MagnetM) transform.position += to / d * Mathf.Min(PullSpeed * dt, d);
        }

        /// <summary>먹는다 — 실제 오른 체력(가득·쓰러짐이면 0, 구슬 남음).</summary>
        public int Eat(Vector3 at)
        {
            if (Gone || HeroState.Hp <= 0 || HeroState.Hp >= HeroState.HpMax) return 0;
            int before = HeroState.Hp;
            HeroState.HealBy(HealAmount);
            int got = HeroState.Hp - before;
            Eaten++;
            var pop = new GameObject("DamagePopup");
            pop.transform.position = at + Vector3.up * 2.2f;
            SagaWorldText.Add(pop, "+" + got, 48f * 0.26f, HealNumberColor);
            pop.AddComponent<DamagePopup>();
            Vanish();
            return got;
        }

        private void Vanish()
        {
            Gone = true;
            Active.Remove(this);
            Destroy(gameObject);
        }
    }
}
