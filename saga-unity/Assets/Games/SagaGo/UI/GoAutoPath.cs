using System;
using System.Collections.Generic;
using UnityEngine;

namespace Saga.Go.UI
{
    /// <summary>
    /// tasks U-0190 1만리 자동 퀘스트 길찾기(웹 W-0382 gridPath 짝 — 꼴만) — 곧게 걷다 앞이 막히면 둘레 격자를 너비 우선으로 훑어 돌아갈 길을 낸다.
    /// 격자 = 내 자리 둘레 <see cref="Half"/>×2+1 칸(한 칸 <see cref="Cell"/>m, ≈ 사방 45m). 칸이 열림 = 위에서 쏜 땅 레이가 서 있을 만한 면(법선 y ≥ 0.6)에 닿고
    /// 그 위 몸 높이 캡슐에 걸리는 충돌체가 없음(트리거·내 몸·둥근 몸(적·짐승)은 뺌). 이웃 칸 땅 높이 차가 <see cref="StepH"/> 넘으면 못 감 · 대각선은 두 옆 칸이 다 열려야(모서리 깎기 금지).
    /// 목표 칸에 닿으면 그 길, 못 닿으면(창 밖·갇힘) 목표에 가장 가까운 닿는 칸 — 지금보다 <see cref="MinGain"/>m 넘게 가까워질 때만. 길은 곧게 갈 수 있는 가장 먼 칸만 남긴다(경유점).
    /// </summary>
    public static class GoAutoPath
    {
        public const float Cell = 1.5f, BodyR = 0.4f, StepH = 0.9f, MinGain = 3f, ProbeAhead = 2.2f;
        public const int Half = 30;

        /// <summary>진단 — 칸 하나(세계 x·z) → (열림, 땅 높이). null 이면 물리로 잰다.</summary>
        public static Func<float, float, (bool open, float h)> CellForTest;

        private static readonly RaycastHit[] _hits = new RaycastHit[12];
        private static readonly Collider[] _over = new Collider[12];

        private const int N = Half * 2 + 1;
        private static readonly sbyte[] _st = new sbyte[N * N];   // 0 모름 · 1 열림 · 2 막힘
        private static readonly float[] _h = new float[N * N];
        private static readonly int[] _from = new int[N * N];
        private static Vector3 _o;
        private static float _baseY;
        private static Transform _self;

        /// <summary>몸이 가는 쪽 <see cref="ProbeAhead"/>m 안에 벽(서 있을 수 없는 면)이 있나.</summary>
        public static bool BlockedAhead(Vector3 me, Vector3 dir, Transform self)
        {
            if (CellForTest != null)
            {
                Vector3 p = me + dir.normalized * ProbeAhead;
                return !CellForTest(p.x, p.z).open;
            }
            Vector3 o = me + Vector3.up * 0.9f;
            int n = Physics.SphereCastNonAlloc(o, 0.3f, dir.normalized, _hits, ProbeAhead, ~0, QueryTriggerInteraction.Ignore);
            for (int i = 0; i < n; i++)
            {
                var c = _hits[i].collider;
                if (Skip(c, self) || _hits[i].distance <= 0f) continue;
                if (_hits[i].normal.y < 0.5f) return true;
            }
            return false;
        }

        /// <summary>길 — 경유점(세계, y = 그 칸 땅). 막힌 데가 없어 곧게 가면 되거나 길이 없으면 null.</summary>
        public static List<Vector3> Plan(Vector3 from, Vector3 goal, Transform self)
        {
            _self = self;
            _baseY = from.y;
            _o = new Vector3(Mathf.Round(from.x / Cell) * Cell, 0f, Mathf.Round(from.z / Cell) * Cell);
            Array.Clear(_st, 0, _st.Length);
            for (int i = 0; i < _from.Length; i++) _from[i] = -1;
            int start = Idx(Half, Half);
            var (_, h0) = CellForTest != null ? CellForTest(_o.x, _o.z) : Measure(_o.x, _o.z);
            _st[start] = 1; _h[start] = Mathf.Abs(h0 - from.y) <= StepH * 2f ? h0 : from.y; // 서 있는 칸은 열림으로 본다(높이는 잰 땅, 지붕 등 엉뚱하면 발)
            int gx = Mathf.RoundToInt((goal.x - _o.x) / Cell) + Half, gz = Mathf.RoundToInt((goal.z - _o.z) / Cell) + Half;
            bool goalIn = gx >= 0 && gz >= 0 && gx < N && gz < N;
            int goalI = goalIn ? Idx(gx, gz) : -1;

            var q = new Queue<int>();
            q.Enqueue(start);
            _from[start] = start;
            int best = start;
            float bestD = Flat(Pos(start) - goal);
            float startD = bestD;
            while (q.Count > 0)
            {
                int c = q.Dequeue();
                if (c == goalI) { best = c; bestD = 0f; break; }
                int cx = c % N, cz = c / N;
                for (int dz = -1; dz <= 1; dz++)
                for (int dx = -1; dx <= 1; dx++)
                {
                    if (dx == 0 && dz == 0) continue;
                    int nx = cx + dx, nz = cz + dz;
                    if (nx < 0 || nz < 0 || nx >= N || nz >= N) continue;
                    int ni = Idx(nx, nz);
                    if (_from[ni] >= 0 || !Step(c, ni)) continue;
                    if (dx != 0 && dz != 0 && (!Step(c, Idx(cx + dx, cz)) || !Step(c, Idx(cx, cz + dz)))) continue;
                    _from[ni] = c;
                    float d = Flat(Pos(ni) - goal);
                    if (d < bestD) { bestD = d; best = ni; }
                    q.Enqueue(ni);
                }
            }
            if (best == start || (best != goalI && startD - bestD < MinGain)) return null;

            var cells = new List<int>();
            for (int c = best; c != start; c = _from[c]) cells.Add(c);
            cells.Add(start);
            cells.Reverse();
            // 곧게 갈 수 있는 가장 먼 칸만 — 경유점
            var way = new List<Vector3>();
            int at = 0;
            while (at < cells.Count - 1)
            {
                int far = at + 1;
                for (int j = cells.Count - 1; j > at + 1; j--) if (Straight(cells[at], cells[j])) { far = j; break; }
                way.Add(Pos(cells[far]));
                at = far;
            }
            if (best == goalI && way.Count > 0) way[way.Count - 1] = new Vector3(goal.x, way[way.Count - 1].y, goal.z);
            return way;
        }

        private static bool Straight(int a, int b)
        {
            Vector3 pa = Pos(a), pb = Pos(b);
            int steps = Mathf.CeilToInt(Flat(pb - pa) / (Cell * 0.4f));
            int prev = a;
            for (int s = 1; s <= steps; s++)
            {
                Vector3 p = Vector3.Lerp(pa, pb, s / (float)steps);
                int i = IdxOf(p);
                if (i < 0) return false;
                if (i == prev) continue;
                if (!Step(prev, i)) return false;
                // 옆으로 비껴 지나는 칸 — 몸 너비만큼 양옆도 열려야
                Vector3 side = Vector3.Cross(Vector3.up, (pb - pa).normalized) * BodyR;
                int l = IdxOf(p + side), r = IdxOf(p - side);
                if (l < 0 || r < 0 || !Open(l) || !Open(r)) return false;
                prev = i;
            }
            return true;
        }

        private static bool Step(int a, int b) => Open(b) && Mathf.Abs(_h[b] - _h[a]) <= StepH;

        private static bool Open(int i)
        {
            if (_st[i] == 0)
            {
                Vector3 p = Pos(i);
                var (open, h) = CellForTest != null ? CellForTest(p.x, p.z) : Measure(p.x, p.z);
                _st[i] = open ? (sbyte)1 : (sbyte)2;
                _h[i] = h;
            }
            return _st[i] == 1;
        }

        private static (bool, float) Measure(float x, float z)
        {
            Vector3 top = new Vector3(x, _baseY + 25f, z);
            int n = Physics.RaycastNonAlloc(top, Vector3.down, _hits, 60f, ~0, QueryTriggerInteraction.Ignore);
            float bd = float.MaxValue; RaycastHit hit = default;
            for (int i = 0; i < n; i++)
            {
                if (Skip(_hits[i].collider, _self)) continue;
                if (_hits[i].distance < bd) { bd = _hits[i].distance; hit = _hits[i]; }
            }
            if (bd == float.MaxValue) return (false, _baseY);
            float g = hit.point.y;
            if (hit.normal.y < 0.6f) return (false, g);
            Vector3 lo = new Vector3(x, g + 0.3f + BodyR, z), hi = new Vector3(x, g + 1.7f - BodyR, z);
            int m = Physics.OverlapCapsuleNonAlloc(lo, hi, BodyR, _over, ~0, QueryTriggerInteraction.Ignore);
            for (int i = 0; i < m; i++) if (!Skip(_over[i], _self)) return (false, g);
            return (true, g);
        }

        /// <summary>안 세는 충돌체 — 내 몸 · 둥근 몸(적·짐승·동료, 움직이니 벽이 아님).</summary>
        private static bool Skip(Collider c, Transform self)
        {
            if (c == null) return true;
            if (self != null && c.transform.IsChildOf(self)) return true;
            return c is CapsuleCollider || c is SphereCollider || c is CharacterController;
        }

        private static int Idx(int x, int z) => z * N + x;

        private static int IdxOf(Vector3 p)
        {
            int x = Mathf.RoundToInt((p.x - _o.x) / Cell) + Half, z = Mathf.RoundToInt((p.z - _o.z) / Cell) + Half;
            return x < 0 || z < 0 || x >= N || z >= N ? -1 : Idx(x, z);
        }

        private static Vector3 Pos(int i) => new Vector3(_o.x + (i % N - Half) * Cell, _st[i] == 1 ? _h[i] : _baseY, _o.z + (i / N - Half) * Cell);

        private static float Flat(Vector3 d) { d.y = 0f; return d.magnitude; }
    }
}
