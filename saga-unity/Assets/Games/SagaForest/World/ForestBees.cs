using System.Collections.Generic;
using TMPro;
using UnityEngine;
using UnityEngine.InputSystem;
using UnityEngine.UI;
using Saga.Core;
using Saga.Forest.Audio;
using Saga.Forest.Data;
using Saga.Forest.UI;

namespace Saga.Forest.World
{
    /// <summary>
    /// tasks U-0206 벌집(고돗 G-0346 짝 — 동물의숲 벌집, 구조만 · 웹 bug.js 벌떼). 과일나무를 흔들 때(`ForestFruitTree`)
    /// 그날·그 나무 자리 해시로 <see cref="HiveP"/>% 벌집이 떨어져 벌떼(노랑·검정 알갱이 <see cref="NBees"/>)가 나온다. 나무마다 하루 한 번만 굴린다.
    ///   쫓음   <see cref="Speed"/> m/s 로 나를 쫓는다(걷기 6 &lt; 7 &lt; 달리기 10 — 달려야 떨어진다). <see cref="GiveUpSec"/> 동안 못 붙으면 흩어짐.
    ///   모임   <see cref="NearM"/> 안에 붙으면 <see cref="GatherSec"/> 모였다가 쏜다 — 그 사이 화면 「🕸 잡기」 단추(또는 E)면 잡음: 곤충 한 종 도감 기록.
    ///   쏘임   놓치면 <see cref="StingSec"/> 동안 못 움직임(<see cref="MoveMul"/> 0)·"벌에 쏘였다!" — 그리고 흩어짐.
    /// 탈것 위면 벌떼가 안 뜬다(굴림은 소비). 세이브에 안 남는다(하루 굴림은 날짜 해시로 다시 셈). SAGA_BEES=0 이면 벌집 없음.
    /// 걸음은 <see cref="Step"/> 으로 빼 진단이 한 프레임 안에서 직접 부른다(U-0205 HealthGlobe 와 같은 결).
    /// </summary>
    public class ForestBees : MonoBehaviour
    {
        public const int HiveP = 20; // %
        public const float Speed = 7f;
        public const float NearM = 1.2f;
        public const float GatherSec = 0.8f; // 고돗 0.6 — 폰 단추라 조금 더
        public const float StingSec = 1.2f;
        public const float GiveUpSec = 8f;
        public const int NBees = 8;
        public const float SwarmR = 0.75f;
        public const float FinishSec = 0.6f;
        private const float BeeR = 0.12f;
        private const float ToastSec = 3f;
        private static readonly Color Yellow = new Color(1f, 0.82f, 0.1f);
        private static readonly Color Dark = new Color(0.12f, 0.1f, 0.06f);

        public enum S { Chase, Gather, Done }

        /// <summary>진단 — 굴림·나옴·잡음·쏘임·흩어짐 수.</summary>
        public static int Rolled { get; private set; }
        public static int Spawned { get; private set; }
        public static int Caught { get; private set; }
        public static int Stung { get; private set; }
        public static int Fled { get; private set; }
        /// <summary>지금 떠 있는 벌떼(한 번에 하나).</summary>
        public static ForestBees Active { get; private set; }
        /// <summary>진단 — 시계를 붙든다(null 이면 Time.time). 쏘임은 벌떼가 지워진 뒤에도 풀려야 해 시각으로 잰다(고돗 함정 ①).</summary>
        public static float? NowForTest;

        private static int _rolledDay = int.MinValue;
        private static readonly HashSet<string> RolledToday = new HashSet<string>();
        private static float _stingEnd = float.NegativeInfinity;
        private static readonly System.Random CatchRng = new System.Random(20260824);

        public static bool On => System.Environment.GetEnvironmentVariable("SAGA_BEES") != "0";
        private static float Now => NowForTest ?? Time.time;
        /// <summary>걷기 배율 — 쏘인 동안 0, 평소 1(`PlayerController` 두 자리).</summary>
        public static float MoveMul => Now < _stingEnd ? 0f : 1f;
        public static bool StungNow => Now < _stingEnd;

        public S State { get; private set; } = S.Chase;
        public bool Gone { get; private set; }
        public float Age => _age;
        /// <summary>진단 — 잡기 단추가 지금 보이나.</summary>
        public bool ButtonShown => _canvas != null && _canvas.gameObject.activeSelf;
        public Button CatchButton => _button;

        private readonly List<Transform> _bees = new List<Transform>();
        private readonly List<float> _phase = new List<float>();
        private Material _yellow, _dark;
        private Transform _player;
        private Canvas _canvas;
        private Button _button;
        private float _age, _t, _doneT;

        /// <summary>나무 자리 → 하루 키(씬에 구운 자리라 날마다 같다).</summary>
        public static string TreeKey(Vector3 pos) => $"{Mathf.RoundToInt(pos.x)},{Mathf.RoundToInt(pos.z)}";

        /// <summary>그날·그 나무에 벌집이 떨어지나(씨앗 고정 — 다시 셈해도 같음). FNV-1a(런타임 해시는 판마다 다를 수 있어).</summary>
        public static bool HiveRoll(int day, string key)
        {
            unchecked
            {
                uint h = 2166136261u;
                foreach (char c in $"{day}|{key}|hive") { h ^= c; h *= 16777619u; }
                h ^= h >> 15; h *= 0x2c1b3c6du; h ^= h >> 12;
                return h % 100u < (uint)HiveP;
            }
        }

        /// <summary>`ForestFruitTree` 가 흔든 뒤 한 줄 — 그 나무의 오늘 첫 흔들기면 굴리고, 벌집이면 벌떼(나왔으면 그것).</summary>
        public static ForestBees OnShake(Vector3 treePos)
        {
            if (!On) return null;
            int day = ForestVisitors.Today;
            if (_rolledDay != day) { _rolledDay = day; RolledToday.Clear(); }
            string key = TreeKey(treePos);
            if (!RolledToday.Add(key)) return null; // 나무마다 하루 한 번
            Rolled++;
            if (!HiveRoll(day, key)) return null;
            if (ForestMounts.Riding != null) return null; // 탈것 위 — 굴림은 소비, 벌떼 없음
            if (Active != null && !Active.Gone) return null; // 한 번에 한 무리
            return Spawn(treePos);
        }

        public static ForestBees Spawn(Vector3 treePos)
        {
            var go = new GameObject("Bees");
            go.transform.position = treePos + Vector3.up * 1.6f;
            var b = go.AddComponent<ForestBees>();
            Active = b;
            Spawned++;
            DialogueLabel.Instance?.Show(ForestLocalization.T("bees.hive", "🐝 벌집이 떨어졌다! 벌떼가 쫓아온다 — 달리거나, 붙을 때 🕸 잡기(E)"), ToastSec);
            return b;
        }

        /// <summary>진단 — 통계·하루 굴림·쏘임·떠 있는 벌떼를 비운다.</summary>
        public static void ResetForTest()
        {
            if (Active != null) DestroyImmediate(Active.gameObject);
            Active = null;
            Rolled = Spawned = Caught = Stung = Fled = 0;
            _rolledDay = int.MinValue;
            RolledToday.Clear();
            _stingEnd = float.NegativeInfinity;
        }

        private void Awake()
        {
            var p = GameObject.FindWithTag("Player");
            _player = p != null ? p.transform : null;
            var shader = Shader.Find("Universal Render Pipeline/Lit"); // U-0183 빌드 포함 셰이더(LootMarker·HealthGlobe 와 같음)
            _yellow = new Material(shader) { name = "Bees Yellow (generated)", color = Yellow };
            _yellow.EnableKeyword("_EMISSION");
            _yellow.SetColor("_EmissionColor", Yellow * 1.5f);
            _dark = new Material(shader) { name = "Bees Dark (generated)", color = Dark };
            var rng = new System.Random(20260824);
            for (int i = 0; i < NBees; i++)
            {
                var b = GameObject.CreatePrimitive(PrimitiveType.Sphere);
                b.name = "Bee";
                b.transform.SetParent(transform, false);
                b.transform.localScale = new Vector3(BeeR * 2f, BeeR * 1.6f, BeeR * 2f);
                Colliders.Strip(b);
                var mr = b.GetComponent<MeshRenderer>();
                mr.sharedMaterial = i % 3 != 0 ? _yellow : _dark;
                mr.shadowCastingMode = UnityEngine.Rendering.ShadowCastingMode.Off; // 작은 알갱이는 그림자 없음
                mr.receiveShadows = false;
                _bees.Add(b.transform);
                _phase.Add((float)rng.NextDouble() * Mathf.PI * 2f);
            }
            Swirl();
        }

        private void OnDestroy()
        {
            if (Active == this) Active = null;
            if (_canvas != null) Destroy(_canvas.gameObject);
            if (_yellow != null) Destroy(_yellow);
            if (_dark != null) Destroy(_dark);
        }

        private void Update()
        {
            if (_player == null) { var p = GameObject.FindWithTag("Player"); _player = p != null ? p.transform : null; }
            if (State == S.Gather && Keyboard.current != null && Keyboard.current.eKey.wasPressedThisFrame) TryCatch();
            Step(Time.deltaTime, _player != null ? _player.position : (Vector3?)null);
        }

        /// <summary>한 걸음(진단이 직접 부른다) — 맴돎·쫓음·모임·쏘임·흩어짐.</summary>
        public void Step(float dt, Vector3? playerPos)
        {
            if (Gone) return;
            _age += dt;
            Swirl();
            if (State == S.Done)
            {
                _doneT += dt;
                float k = Mathf.Clamp01(_doneT / FinishSec);
                transform.localScale = Vector3.one * (1f + 2f * k);
                transform.position += Vector3.up * (2f / FinishSec) * dt;
                if (_doneT >= FinishSec) Vanish();
                return;
            }
            if (playerPos == null) return;
            Vector3 target = playerPos.Value + Vector3.up * 1.2f;
            Vector3 to = target - transform.position;
            float flat = new Vector2(to.x, to.z).magnitude;
            if (State == S.Chase)
            {
                if (_age > GiveUpSec)
                {
                    Fled++;
                    DialogueLabel.Instance?.Show(ForestLocalization.T("bees.fled", "🐝 벌떼가 흩어졌다."), 1.5f);
                    Finish();
                    return;
                }
                if (flat <= NearM)
                {
                    State = S.Gather;
                    _t = GatherSec;
                    ShowButton(true);
                }
                else transform.position += to.normalized * Mathf.Min(Speed * dt, to.magnitude);
            }
            else // Gather
            {
                transform.position = Vector3.Lerp(transform.position, target, Mathf.Min(1f, dt * 6f));
                _t -= dt;
                if (_t <= 0f) Sting();
            }
        }

        /// <summary>단추·E — 모이는 중이면 잡음: 곤충 한 종 도감 기록. 잡았으면 그 곤충 이름(아니면 null).</summary>
        public string TryCatch()
        {
            if (Gone || State != S.Gather) return null;
            Caught++;
            string item = ForestHandState.PickItem(ForestMuseumState.ItemsOf(ForestMuseumState.Category.Insect), ForestMuseumState.IsDiscovered, CatchRng);
            bool isNew = ForestMuseumState.Record(ForestMuseumState.Category.Insect, item);
            string shown = ForestMuseumState.DisplayName(item);
            DialogueLabel.Instance?.Show(string.Format(ForestLocalization.T("bees.caught", "🕸 벌떼를 잡았다! — {0}"), isNew ? $"NEW! {shown}" : shown), ToastSec);
            ForestGatherPopup.Spawn(transform.position, isNew ? $"NEW! {shown}" : shown, false); // GatherFeel 은 연속 채집 덤을 세서 쓰지 않음
            ForestAudio.PlaySfx("item_pick");
            Finish();
            return item;
        }

        private void Sting()
        {
            Stung++;
            _stingEnd = Now + StingSec; // 시각으로 — 벌떼가 먼저 지워져도 풀린다
            DialogueLabel.Instance?.Show(ForestLocalization.T("bees.stung", "🐝 벌에 쏘였다! 😵"), 2f);
            Finish();
        }

        private void Finish()
        {
            State = S.Done;
            _doneT = 0f;
            ShowButton(false);
        }

        private void Vanish()
        {
            Gone = true;
            if (Active == this) Active = null;
            Destroy(gameObject);
        }

        private void Swirl()
        {
            float tight = State == S.Gather ? 0.4f : 1f;
            float spin = State == S.Gather ? 14f : 7f;
            for (int i = 0; i < _bees.Count; i++)
            {
                float ph = _phase[i] + _age * spin;
                _bees[i].localPosition = new Vector3(Mathf.Cos(ph), Mathf.Sin(ph * 1.7f) * 0.5f, Mathf.Sin(ph * 1.3f)) * SwarmR * tight;
            }
        }

        private void ShowButton(bool on)
        {
            if (on && _canvas == null)
            {
                _canvas = EncounterUiKit.NewCanvas("BeesCanvas");
                _canvas.sortingOrder = 4;
                _button = SagaUi.NewButton(_canvas.transform, "BeesCatch", ForestLocalization.T("bees.catch_btn", "🕸 잡기"),
                    new Vector2(0.5f, 0f), new Vector2(0f, 230f), new Vector2(260f, 80f), SagaUi.ButtonIdle, 30f);
                _button.onClick.AddListener(() => TryCatch());
            }
            if (_canvas != null && _canvas.gameObject.activeSelf != on) _canvas.gameObject.SetActive(on);
        }
    }
}
