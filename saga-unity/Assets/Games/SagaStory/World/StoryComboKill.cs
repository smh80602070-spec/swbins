using System;
using System.Collections.Generic;
using UnityEngine;
using Saga.Core;
using Saga.Story.Data;

namespace Saga.Story.World
{
    /// <summary>
    /// tasks U-0207 콤보 킬(고돗 G-0345 짝 — 메이플스토리 콤보 킬 구슬, 구조만). 처치가 <see cref="Window"/> 초 안에 이어지면 수가 오른다(끊기면 1부터).
    ///   글     <see cref="ShowFrom"/> 부터 머리 위에 "콤보 킬 n"(10·30·50 넘으면 색이 진해짐) — 늘 하나(새 글이 옛 글을 지움 · 고돗 촬영 lg_st_combo).
    ///   구슬   <see cref="OrbEvery"/> 마다 파란 경험치 구슬 — <see cref="MagnetM"/> 안이면 끌려와 <see cref="EatM"/> 안에서 먹음:
    ///          잡졸 경험치 × <see cref="OrbMul"/>(3 + 콤보/10, 최대 8) × 회차 배율 · "EXP +n". <see cref="LifeSec"/> 뒤 사라짐.
    ///   기록   <see cref="Best"/> = 이번 실행 최고(저장 안 함). 판 등급(StoryRunRank)의 판 경험치엔 안 넣는다(두 번 셈 방지).
    /// 셈은 정적 — 들판·비경을 옮겨도 5초 안이면 이어진다. 판정은 Update 거리 폴링(콜라이더 없음). SAGA_COMBO_KILL=0 이면 셈·글·구슬 없음.
    /// </summary>
    public class StoryComboKill : MonoBehaviour
    {
        public const float Window = 5f;
        public const int ShowFrom = 3;
        public const int OrbEvery = 10;
        public const float MagnetM = 3.5f;
        public const float EatM = 0.8f;
        public const float PullSpeed = 10f;
        public const float LifeSec = 20f;
        public const float Radius = 0.3f;
        private const float BaseY = 0.5f;
        public static readonly Color OrbColor = new Color(0.3f, 0.65f, 1f);
        private static readonly int[] TierAt = { 50, 30, 10, 0 };
        private static readonly Color[] TierColor =
        {
            new Color(1f, 0.35f, 0.9f), new Color(1f, 0.55f, 0.2f), new Color(1f, 0.85f, 0.3f), new Color(0.9f, 0.95f, 1f),
        };

        /// <summary>지금 콤보 수 · 이번 실행 최고 · 진단용 떨군/먹은 구슬 수.</summary>
        public static int Count { get; private set; }
        public static int Best { get; private set; }
        public static int Orbs { get; private set; }
        public static int Eaten { get; private set; }
        public static readonly List<StoryComboKill> Active = new List<StoryComboKill>();
        /// <summary>진단 — 지금 떠 있는 콤보 글(늘 하나).</summary>
        public static GameObject Label { get; private set; }

        private static float _lastAt = -1000f;

        public static bool On => Environment.GetEnvironmentVariable("SAGA_COMBO_KILL") != "0";

        /// <summary>구슬 배율 — 3 + 콤보/10, 최대 8.</summary>
        public static int OrbMul(int n) => Mathf.Min(3 + n / 10, 8);

        /// <summary>한 알 경험치 — 잡졸 경험 × 배율 × 회차(두목·숨은 우두머리도 밑은 잡졸).</summary>
        public static float OrbExp(int n) => StoryCombat.GruntExp * OrbMul(n) * StoryRound.GainMul();

        public static Color TierOf(int n)
        {
            for (int i = 0; i < TierAt.Length; i++) if (n >= TierAt[i]) return TierColor[i];
            return Color.white;
        }

        public float ExpAmount { get; private set; }
        public bool Gone { get; private set; }
        public float Age => _age;

        private Transform _player;
        private Transform _visual;
        private Material _mat;
        private float _age;

        /// <summary>처치 한 번(`StoryEnemy.Die` 한 곳) — 지금 콤보 수(꺼짐이면 0). now 는 진단이 넣는다(음수면 Time.time).</summary>
        public static int OnKill(Vector3 pos, float now = -1f)
        {
            if (!On) return 0;
            float t = now < 0f ? Time.time : now;
            Count = t - _lastAt <= Window ? Count + 1 : 1;
            _lastAt = t;
            Best = Mathf.Max(Best, Count);
            if (Count >= ShowFrom)
            {
                if (Label != null) { Label.SetActive(false); Destroy(Label); } // 옛 글은 곧바로 안 보이게(Destroy 는 프레임 끝)
                Label = new GameObject("ComboKillLabel");
                Label.transform.position = pos + Vector3.up * 2.6f;
                float size = 48f * (0.3f + Mathf.Min(Count, 50) / 5 * 0.012f);
                SagaWorldText.Add(Label, string.Format(StoryLocalization.T("combo.label", "콤보 킬 {0}"), Count), size, TierOf(Count));
                Label.AddComponent<DamagePopup>();
            }
            if (Count % OrbEvery == 0)
            {
                var go = new GameObject("ComboOrb");
                go.transform.position = pos + Vector3.up * 0.2f;
                go.AddComponent<StoryComboKill>().ExpAmount = OrbExp(Count);
                Orbs++;
            }
            return Count;
        }

        public static void ResetForTest()
        {
            foreach (var o in Active.ToArray()) if (o != null) DestroyImmediate(o.gameObject);
            Active.Clear();
            if (Label != null) DestroyImmediate(Label);
            Label = null;
            Count = 0;
            Best = 0;
            Orbs = 0;
            Eaten = 0;
            _lastAt = -1000f;
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
            _mat = new Material(Shader.Find("Universal Render Pipeline/Lit")) { name = "ComboOrb (generated)" }; // U-0183 빌드 포함 셰이더(StoryLootMarker 와 같음)
            _mat.color = OrbColor;
            _mat.EnableKeyword("_EMISSION");
            _mat.SetColor("_EmissionColor", OrbColor * 3f);
            var mr = visual.GetComponent<MeshRenderer>();
            mr.sharedMaterial = _mat;
            mr.shadowCastingMode = UnityEngine.Rendering.ShadowCastingMode.Off;
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
            if (_age > LifeSec)
            {
                Vanish();
                return;
            }
            if (_visual != null) _visual.localPosition = new Vector3(0f, BaseY + Mathf.Sin(_age * 3f) * 0.1f, 0f);
            if (playerPos == null) return;
            Vector3 to = playerPos.Value - transform.position;
            to.y = 0f;
            float d = to.magnitude;
            if (d <= EatM) Eat(playerPos.Value);
            else if (d <= MagnetM) transform.position += to / d * Mathf.Min(PullSpeed * dt, d);
        }

        /// <summary>먹는다 — 경험치를 주고 사라진다(레벨업·3택 고리는 GainExp 그대로).</summary>
        public float Eat(Vector3 at)
        {
            if (Gone) return 0f;
            StoryJobState.GainExp(ExpAmount);
            Eaten++;
            var pop = new GameObject("DamagePopup");
            pop.transform.position = at + Vector3.up * 2.2f;
            SagaWorldText.Add(pop, string.Format(StoryLocalization.T("combo.exp", "EXP +{0}"), Mathf.RoundToInt(ExpAmount)), 48f * 0.24f, OrbColor);
            pop.AddComponent<DamagePopup>();
            Vanish();
            return ExpAmount;
        }

        private void Vanish()
        {
            Gone = true;
            Active.Remove(this);
            Destroy(gameObject);
        }
    }
}
