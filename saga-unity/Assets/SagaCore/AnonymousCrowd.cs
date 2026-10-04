using System;
using System.Collections.Generic;
using UnityEngine;

namespace Saga.Core
{
    /// <summary>
    /// U-0042 — 이름 없는 군중. 인물 299(`CrowdBodies`, U-0040)를 마을·광장에 서 있거나 오가는 행인으로 세운다.
    /// 시대 역할 인물(GO 역참 행인·시대 사람)은 건드리지 않는다(사용자 결정 2026-10-04 "299 는 이름 없는 군중에만") — 이름표·대사·충돌 없음.
    /// 299 목록이 없는 PC(`CrowdBodies.Available` 거짓)는 아무것도 안 세운다(캡슐 대체 금지). 같은 시드는 늘 같은 사람·자리(저장 없음).
    /// </summary>
    public static class AnonymousCrowd
    {
        public struct Plan
        {
            public Vector3 Center;
            public float Radius;
            public int Standing, Walking;
            public uint Seed;
            public float Height;                       // 기준 키(그 판 사람 키) — 사람마다 ±6%
            public Func<Vector3, bool> CanStand;       // 서 있을 수 있는 자리인가(없으면 모두 가능)
            public float CurveAmount;                  // 숲처럼 땅이 구면으로 휘는 판 — 플레이어와의 거리² × 이 값만큼 몸을 내린다(0 = 안 내림)
        }

        public const float WalkDistance = 8f;

        /// <summary>군중 뿌리 "AnonymousCrowd" 를 만들어 사람을 세운다. 세운 수 0 이면 뿌리도 안 둔다. 반환 = 세운 사람들.</summary>
        public static List<GameObject> Spawn(Transform parent, Plan plan)
        {
            var made = new List<GameObject>();
            if (!CrowdBodies.Available || plan.Standing + plan.Walking <= 0) return made;
            var root = new GameObject("AnonymousCrowd");
            root.transform.SetParent(parent, false);
            var rng = new Rng(plan.Seed);
            var used = new HashSet<int>();
            int total = plan.Standing + plan.Walking;
            bool unique = CrowdBodies.List.bodies.Length >= total;
            for (int n = 0; n < total; n++)
            {
                bool walker = n >= plan.Standing;
                if (!TryPlace(plan, rng, walker, out var start, out var dir)) continue;
                string key = null;
                for (int t = 0; t < 200; t++)
                {
                    key = $"crowd_{plan.Seed}_{n}_{t}";
                    int idx = CrowdBodies.IndexFor(key);
                    if (idx >= 0 && CrowdBodies.List.bodies[idx] != null && (!unique || used.Add(idx))) break;
                    key = null;
                }
                if (key == null) continue;
                var go = new GameObject($"Crowd_{n:00}");
                go.transform.SetParent(root.transform, false);
                go.transform.position = Grounded(start);
                go.transform.rotation = Quaternion.LookRotation(dir);
                var vis = CrowdBodies.Spawn(key, go.transform, plan.Height * (0.94f + rng.Next01() * 0.12f));
                if (vis == null) { UnityEngine.Object.Destroy(go); continue; }
                var w = go.AddComponent<CrowdWalker>();
                w.Init(start, dir, rng.Next01() * CrowdWalker.Cycle, walker, vis.GetComponent<CrowdBodyAnimator>(), vis.transform, plan.CurveAmount);
                made.Add(go);
            }
            if (made.Count == 0) UnityEngine.Object.Destroy(root);
            return made;
        }

        /// <summary>자리 잡기 — 반지름 안 무작위, 걷는 사람은 오가는 8m 줄 전체(처음·가운데·끝)가 설 수 있어야 한다. 40번 시도.</summary>
        private static bool TryPlace(Plan plan, Rng rng, bool walker, out Vector3 start, out Vector3 dir)
        {
            for (int t = 0; t < 40; t++)
            {
                float a = rng.Next01() * Mathf.PI * 2f, r = Mathf.Sqrt(rng.Next01()) * plan.Radius;
                start = plan.Center + new Vector3(Mathf.Cos(a) * r, 0f, Mathf.Sin(a) * r);
                float yaw = rng.Next01() * Mathf.PI * 2f;
                dir = new Vector3(Mathf.Cos(yaw), 0f, Mathf.Sin(yaw));
                var end = start + dir * WalkDistance;
                bool ok = plan.CanStand == null || (plan.CanStand(start) && (!walker || (plan.CanStand(end) && plan.CanStand((start + end) * 0.5f))));
                if (ok) return true;
            }
            start = plan.Center; dir = Vector3.forward;
            return false;
        }

        public static Vector3 Grounded(Vector3 p)
        {
            var hits = Physics.RaycastAll(new Vector3(p.x, p.y + 30f, p.z), Vector3.down, 80f, ~0, QueryTriggerInteraction.Ignore);
            float best = float.NegativeInfinity;
            foreach (var h in hits)
            {
                if (h.collider is CharacterController) continue;
                if (h.point.y > p.y + 3f) continue;
                if (h.point.y > best) best = h.point.y;
            }
            if (best > float.NegativeInfinity) p.y = best;
            return p;
        }

        /// <summary>mulberry32 — 같은 시드는 늘 같은 열(웹·진단 씨앗과 같은 계열).</summary>
        public sealed class Rng
        {
            private uint _s;
            public Rng(uint seed) { _s = seed; }
            public float Next01()
            {
                unchecked
                {
                    _s += 0x6D2B79F5u;
                    uint t = _s;
                    t = (t ^ (t >> 15)) * (t | 1u);
                    t ^= t + (t ^ (t >> 7)) * (t | 61u);
                    return ((t ^ (t >> 14)) / 4294967296.0f);
                }
            }
        }
    }

    /// <summary>
    /// 군중 한 명의 오가기 — GO 역참 행인(`FolkWalker`)과 같은 36초 주기(4초 걸어 8m 가고, 14초 서 있다, 4초 걸어 돌아와, 14초 서 있다).
    /// 서 있는 사람은 제자리·대기. 걷는 동작은 `CrowdBodyAnimator.SetWalking`.
    /// </summary>
    public sealed class CrowdWalker : MonoBehaviour
    {
        public const float Cycle = 36f, WalkSec = 4f;
        private const float StandSec = Cycle * 0.5f - WalkSec;

        public bool Walks { get; private set; }
        private Vector3 _origin, _dir;
        private float _phase, _lastY;
        private CrowdBodyAnimator _anim;
        private Transform _visual, _player;
        private float _visualBaseY, _curve;

        public void Init(Vector3 origin, Vector3 dir, float phase, bool walks, CrowdBodyAnimator anim, Transform visual = null, float curveAmount = 0f)
        {
            _origin = origin; _dir = dir.normalized; _phase = phase; Walks = walks; _anim = anim;
            _lastY = transform.position.y;
            _visual = visual; _curve = curveAmount;
            if (_visual != null) _visualBaseY = _visual.localPosition.y;
        }

        /// <summary>땅 휨 따라 "Visual" 을 내린다(숲 `ForestEraFolk.FollowCurve` 와 같은 식 — 플레이어 기준). 진단도 부른다.</summary>
        public void FollowCurve(Vector3 curveCenter)
        {
            if (_visual == null || _curve <= 0f) return;
            float dx = transform.position.x - curveCenter.x, dz = transform.position.z - curveCenter.z;
            var p = _visual.localPosition;
            _visual.localPosition = new Vector3(p.x, _visualBaseY - (dx * dx + dz * dz) * _curve, p.z);
        }

        private void LateUpdate()
        {
            if (_curve <= 0f) return;
            if (_player == null) { var g = GameObject.FindWithTag("Player"); if (g != null) _player = g.transform; }
            if (_player != null) FollowCurve(_player.position);
        }

        /// <summary>시각 t 에 출발점에서 몇 m 나가 있나(0~`AnonymousCrowd.WalkDistance`)·걷는 중인가·어느 쪽으로(+1 나감, -1 돌아옴).</summary>
        public static float OffsetAt(float t, out bool walking, out int sign)
        {
            t = Mathf.Repeat(t, Cycle);
            walking = false; sign = 1;
            if (t < WalkSec) { walking = true; return AnonymousCrowd.WalkDistance * t / WalkSec; }
            t -= WalkSec;
            if (t < StandSec) return AnonymousCrowd.WalkDistance;
            t -= StandSec;
            if (t < WalkSec) { walking = true; sign = -1; return AnonymousCrowd.WalkDistance * (1f - t / WalkSec); }
            return 0f;
        }

        private void Update()
        {
            if (!Walks) return;
            float off = OffsetAt(Time.time + _phase, out bool walking, out int sign);
            Vector3 p = _origin + _dir * off;
            if (walking)
            {
                p = AnonymousCrowd.Grounded(new Vector3(p.x, _lastY, p.z));
                _lastY = p.y;
                transform.rotation = Quaternion.Slerp(transform.rotation, Quaternion.LookRotation(_dir * sign), 0.2f);
            }
            else p.y = _lastY;
            transform.position = p;
            if (_anim != null) _anim.SetWalking(walking);
        }
    }
}
