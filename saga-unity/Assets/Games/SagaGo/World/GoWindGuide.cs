using System.Collections.Generic;
using UnityEngine;
using UnityEngine.Rendering;
using Saga.Go.Combat;

namespace Saga.Go.World
{
    /// <summary>
    /// tasks U-0179 바람 길잡이(고돗 G-0318 `wind_guide.gd` 짝, 웹 짝 없음) — 따라가는 목표(<see cref="StoryField.Target"/> — 이야기·따라가는 세계 임무)가 있을 때
    /// 1.5초 가만히 서 있으면 흰 바람 줄기 일곱이 내 둘레에서 목표 쪽으로 14m 흘러 사라진다(6초에 한 번, 4m 안이면 안 붊).
    /// <see cref="WindOnly"/> 면 금빛 기둥을 끄고 걷는 동안에도 12초마다 분다(HUD 덜기, 고돗 `SAGA_WIND_ONLY=1`). 새 키 없음 — 서서 둘러보는 몸짓이 곧 길 묻기.
    /// 줄기 = 코드 상자(빛 안 받음·그림자 없음·충돌체 없음), 커졌다 줄며 사라진다. 세이브 없음.
    /// </summary>
    public class GoWindGuide : MonoBehaviour
    {
        public const float StillSec = 1.5f, Every = 6f, WindOnlyEvery = 12f, NearM = 4f, LenM = 14f, Life = 1.6f, StillSpeed = 0.3f;
        public const int Streaks = 7;

        /// <summary>끄면 안 붊(고돗 `SAGA_WIND_GUIDE=0` 짝).</summary>
        public static bool On = true;
        /// <summary>바람만 — 기둥을 끄고 걸어도 분다(`StoryField.Refresh` 가 읽는다).</summary>
        public static bool WindOnly;
        /// <summary>진단 — 목표를 이 자리로 둔다(null = 진짜 목표).</summary>
        public static Vector3? TargetForTest;
        /// <summary>분 횟수(진단).</summary>
        public static int Blows { get; private set; }

        public static GoWindGuide Instance { get; private set; }

        private struct Streak { public Transform T; public Vector3 From, Dir; public float Age, Delay; }

        private readonly List<Streak> _live = new List<Streak>();
        private static Material _mat;
        private Vector3 _lastPos;
        private bool _hasLast;
        private float _still, _since = Every;

        public int Live => _live.Count;
        public float StillFor => _still;

        /// <summary>목표 쪽 땅 위 방향(정규화) — 너무 가깝거나 목표가 없으면 false.</summary>
        public static bool Dir(Vector3 from, Vector3 to, out Vector3 dir)
        {
            dir = to - from;
            dir.y = 0f;
            float d = dir.magnitude;
            if (d <= NearM) { dir = Vector3.zero; return false; }
            dir /= d;
            return true;
        }

        /// <summary>불 때인가 — 가만히 1.5초·지난번에서 6초(바람만이면 걸어도 12초).</summary>
        public static bool ShouldBlow(float still, float since, bool windOnly) =>
            (still >= StillSec && since >= Every) || (windOnly && since >= WindOnlyEvery);

        private static bool TargetNow(out Vector3 t)
        {
            if (TargetForTest.HasValue) { t = TargetForTest.Value; return true; }
            return StoryField.Target(out t, out _);
        }

        private void Awake() => Instance = this;

        private void OnDestroy()
        {
            if (Instance == this) Instance = null;
            ClearForTest();
        }

        private void Update() => Step(Time.deltaTime);

        /// <summary>한 박자 — 가만히 셈·불기·줄기 움직임. 진단도 부른다.</summary>
        public void Step(float dt)
        {
            Move(dt);
            var fc = FieldCombat.Instance;
            if (fc == null || dt <= 0f) return;
            Vector3 p = fc.transform.position;
            if (_hasLast)
            {
                Vector3 d = p - _lastPos;
                d.y = 0f;
                _still = d.magnitude / dt < StillSpeed ? _still + dt : 0f;
            }
            _lastPos = p;
            _hasLast = true;
            _since += dt;
            if (!On || !ShouldBlow(_still, _since, WindOnly)) return;
            if (!TargetNow(out Vector3 t) || !Dir(p, t, out Vector3 dir)) return;
            Blow(p, dir);
        }

        /// <summary>줄기 일곱 — 내 둘레(옆으로 흩고 앞뒤로 엇갈려)에서 목표 쪽으로.</summary>
        public void Blow(Vector3 p, Vector3 dir)
        {
            _since = 0f;
            Blows++;
            Vector3 side = Vector3.Cross(Vector3.up, dir);
            if (_mat == null)
            {
                _mat = new Material(Shader.Find("Universal Render Pipeline/Unlit")) { name = "WindGuide (generated)", color = new Color(0.72f, 0.9f, 1f) }; // tasks U-0185 — 흰색은 밝은 모래·눈 위에서 안 보였다(촬영) → 옅은 하늘빛
            }
            for (int i = 0; i < Streaks; i++)
            {
                float s = (i - (Streaks - 1) * 0.5f) * 0.9f;
                var go = GameObject.CreatePrimitive(PrimitiveType.Cube);
                go.name = "WindStreak";
                Saga.Core.Colliders.Strip(go);
                var r = go.GetComponent<MeshRenderer>();
                r.sharedMaterial = _mat;
                r.shadowCastingMode = ShadowCastingMode.Off;
                r.receiveShadows = false;
                go.transform.SetParent(transform, false);
                go.transform.rotation = Quaternion.LookRotation(dir);
                go.transform.localScale = Vector3.zero;
                Vector3 from = p + side * s - dir * (1.5f + (i % 3) * 0.8f) + Vector3.up * (0.6f + (i % 4) * 0.35f);
                go.transform.position = from;
                _live.Add(new Streak { T = go.transform, From = from, Dir = dir, Age = 0f, Delay = (i % 4) * 0.12f });
            }
        }

        private void Move(float dt)
        {
            for (int i = _live.Count - 1; i >= 0; i--)
            {
                var s = _live[i];
                s.Age += dt;
                if (s.T == null || s.Age >= s.Delay + Life)
                {
                    if (s.T != null) DestroyImmediate(s.T.gameObject);
                    _live.RemoveAt(i);
                    continue;
                }
                float k = Mathf.Clamp01((s.Age - s.Delay) / Life);
                float w = Mathf.Sin(k * Mathf.PI); // 커졌다 줄며 사라진다
                s.T.position = s.From + s.Dir * (LenM * k) + Vector3.up * Mathf.Sin(k * Mathf.PI * 2f) * 0.25f;
                s.T.localScale = new Vector3(0.11f * w, 0.07f * w, 2.4f * w); // tasks U-0185 — 0.05 는 화면에서 실선 한 줄로 흐렸다
                _live[i] = s;
            }
        }

        /// <summary>진단 — 가만히 셈을 이 값으로(걸음 기록은 지금 자리로).</summary>
        public void SetStillForTest(float still, float since)
        {
            _still = still;
            _since = since;
            var fc = FieldCombat.Instance;
            _hasLast = fc != null;
            if (fc != null) _lastPos = fc.transform.position;
        }

        public void ClearForTest()
        {
            foreach (var s in _live) if (s.T != null) DestroyImmediate(s.T.gameObject);
            _live.Clear();
        }

        public static void ResetCountForTest() => Blows = 0;
    }
}
