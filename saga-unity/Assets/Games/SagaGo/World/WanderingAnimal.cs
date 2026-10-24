using System.Collections.Generic;
using UnityEngine;
using Saga.Go.Data;
using Saga.Go.UI;

namespace Saga.Go.World
{
    /// <summary>
    /// PLAN.md 24~27장 "동물" — Idle/Wander(첫 조각)에 이어 Flee/Group/
    /// Interaction(둘째 조각, 2026-09-12)까지. 전투 대상이 아니다 — Collider가
    /// 없어 플레이어와 부딪혀도 아무 반응이 없다(부딪힘 자체가 없다).
    /// </summary>
    public class WanderingAnimal : MonoBehaviour
    {
        private const float WanderRadius = 24f;
        private const float MoveSpeed = 2.2f;
        private const float MinIdleSec = 2f;
        private const float MaxIdleSec = 5f;
        private const float ArriveDist = 0.6f;

        // ---- Flee/Group ----------------------------------------------------
        private const float FleeAlertRadius = 16f;   // 플레이어가 이 안에 들어오면 놀라 달아난다.
        private const float FleeStopRadius = 30f;     // 이만큼 멀어져야 진정한다(붙었다 뗐다 방지 — 히스테리시스).
        private const float FleeSpeed = 4.6f;         // MoveSpeed보다 확실히 빠르게(달아나는 느낌).
        private const float FleeStepRadius = 18f;     // 달아날 때 한 번에 뛰는 거리(WanderRadius보다 짧게 — 급하게 몇 걸음).
        private const float GroupAlertRadius = 40f;   // 이 반경 안의 다른 동물도 같이 놀란다(현재 스폰 두 자리는
                                                       // 서로 이보다 멀어 아직 실제로 안 겹치지만, 동물이 늘면 발동).

        private static readonly List<WanderingAnimal> Active = new List<WanderingAnimal>();
        private static Transform _player;

        private enum State { Idle, Wander, Flee }

        private Vector3 _origin;
        private Vector3 _target;
        private float _idleUntil;
        private State _state;

        private void Awake()
        {
            _origin = transform.position;
            _target = _origin;
            if (_player == null)
            {
                var playerGo = GameObject.FindGameObjectWithTag("Player");
                if (playerGo != null) _player = playerGo.transform;
            }
            Active.Add(this);
            PickIdle();
        }

        private void OnDestroy()
        {
            Active.Remove(this);
        }

        // ---- 진단(tasks R-3 un.go.animals) — 규칙 그대로 한 번 돌리고 상태를 읽는다 ----
        public static IReadOnlyList<WanderingAnimal> All => Active;
        public string StateName => _state.ToString();
        public Vector3 Origin => _origin;
        public Vector3 Target => _target;
        public const float FleeAlertRadiusForTest = FleeAlertRadius, FleeStopRadiusForTest = FleeStopRadius, GroupAlertRadiusForTest = GroupAlertRadius, WanderRadiusForTest = WanderRadius;
        /// <summary>쉼을 끝내고 한 번 돈다(배회 목표를 고른다).</summary>
        public void EndIdleForTest() { _idleUntil = 0f; }
        public void TickForTest() => Update();
        /// <summary>제자리·쉼으로(진단 뒤).</summary>
        public void ResetForTest() { transform.position = _origin; _target = _origin; PickIdle(); }

        private void Update()
        {
            if (_state == State.Flee)
            {
                UpdateFlee();
                return;
            }

            if (_player != null)
            {
                float distSqr = FlatDistSqr(transform.position, _player.position);
                if (distSqr <= FleeAlertRadius * FleeAlertRadius)
                {
                    StartFlee(announce: true);
                    return;
                }
            }

            if (_state == State.Idle)
            {
                if (Time.time >= _idleUntil) PickTarget();
                return;
            }

            MoveToward(_target, MoveSpeed);
            if (FlatDistSqr(transform.position, _target) <= ArriveDist * ArriveDist)
            {
                PickIdle();
            }
        }

        private void UpdateFlee()
        {
            if (_player != null && FlatDistSqr(transform.position, _player.position) > FleeStopRadius * FleeStopRadius)
            {
                PickIdle();
                return;
            }

            MoveToward(_target, FleeSpeed);
            if (FlatDistSqr(transform.position, _target) <= ArriveDist * ArriveDist)
            {
                PickFleeTarget();
            }
        }

        /// <summary>
        /// 자신이 플레이어를 직접 보고 놀란(announce=true) 경우에만 자막을
        /// 띄우고 주변 동물도 깨운다 — Group으로 전파된 동물(announce=false)은
        /// 조용히 같이 달아나기만 한다(자막 중복 방지).
        /// </summary>
        private void StartFlee(bool announce)
        {
            if (_state == State.Flee) return;
            _state = State.Flee;
            PickFleeTarget();

            if (announce)
            {
                DialogueLabel.Instance?.Show(GoLocalization.T("event.animal_flee", "동물이 놀라 달아난다."), 2f);
                foreach (var other in Active)
                {
                    if (other == this) continue;
                    if (FlatDistSqr(transform.position, other.transform.position) <= GroupAlertRadius * GroupAlertRadius)
                    {
                        other.StartFlee(announce: false);
                    }
                }
            }
        }

        private void PickIdle()
        {
            _state = State.Idle;
            _idleUntil = Time.time + Random.Range(MinIdleSec, MaxIdleSec);
        }

        private void PickTarget()
        {
            // 몇 번 시도해도 걸을 수 있는 칸을 못 찾으면 이번 틱은 그냥 쉬고
            // 다음 틱에 다시 시도한다(강·산 한가운데서 스폰되는 일은 없지만
            // 배회 반경이 걸을 수 없는 칸을 스치는 경우는 있다).
            if (TryPickWalkable(_origin, WanderRadius, out Vector3 candidate))
            {
                _target = candidate;
                _state = State.Wander;
                return;
            }
            PickIdle();
        }

        /// <summary>플레이어(또는 무리를 놀라게 한 동물 자신)의 반대 방향으로 몇 걸음 —
        /// 서식지(_origin) 밖으로 너무 멀리 달아나지는 않게 origin 기준 반경으로 고른다.</summary>
        private void PickFleeTarget()
        {
            Vector3 awayFrom = _player != null ? _player.position : transform.position;
            Vector3 fleeDir = transform.position - awayFrom;
            fleeDir.y = 0f;
            if (fleeDir.sqrMagnitude < 0.01f)
            {
                fleeDir = Random.insideUnitCircle;
                fleeDir = new Vector3(fleeDir.x, 0f, fleeDir.y);
            }
            fleeDir.Normalize();

            Vector3 preferred = transform.position + fleeDir * FleeStepRadius;
            if (TryPickWalkable(preferred, FleeStepRadius * 0.5f, out Vector3 candidate)
                || TryPickWalkable(_origin, WanderRadius, out candidate))
            {
                _target = candidate;
                return;
            }
            // 걸을 수 있는 자리를 아예 못 찾으면 제자리에서 진정할 때까지 기다린다.
            _target = transform.position;
        }

        /// <summary>center 주변 radius 안에서 걸을 수 있는 칸을 무작위로 찾는다(공통 로직).</summary>
        private static bool TryPickWalkable(Vector3 center, float radius, out Vector3 result)
        {
            for (int tries = 0; tries < 6; tries++)
            {
                Vector2 offset = Random.insideUnitCircle * radius;
                Vector3 candidate = center + new Vector3(offset.x, 0f, offset.y);
                var (gx, gy) = TestMapData.WorldToGrid(candidate);
                char tile = TestMapData.TileAt(gx, gy);
                if (TestMapData.Legend.TryGetValue(tile, out var info) && info.Walkable)
                {
                    result = new Vector3(candidate.x, center.y, candidate.z);
                    return true;
                }
            }
            result = center;
            return false;
        }

        private void MoveToward(Vector3 target, float speed)
        {
            Vector3 toTarget = target - transform.position;
            toTarget.y = 0f;
            if (toTarget.sqrMagnitude <= ArriveDist * ArriveDist) return;

            Vector3 dir = toTarget.normalized;
            transform.position += dir * (speed * Time.deltaTime);
            transform.rotation = Quaternion.LookRotation(dir);
        }

        private static float FlatDistSqr(Vector3 a, Vector3 b)
        {
            float dx = a.x - b.x;
            float dz = a.z - b.z;
            return dx * dx + dz * dz;
        }
    }
}
