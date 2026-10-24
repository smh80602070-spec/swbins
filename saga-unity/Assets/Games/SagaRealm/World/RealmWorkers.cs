using System;
using System.Collections.Generic;
using Saga.Core;
using UnityEngine;

namespace Saga.Realm.World
{
    /// <summary>
    /// tasks U-0224 눈에 보이는 일꾼(에이지 오브 엠파이어 · 참고작 격차 유니티 5천하 칸) — 성 디오라마의 밭·시장·곡창 사이를
    /// 이름 없는 군중 몸(`CrowdBodies`, U-0040)이 짐을 지고 천천히 오간다. **보이기만** — 경제·세이브 셈은 그대로 숫자 정산.
    /// 길(디오라마 축척): 남문 밖 → 시장 고리(7.5)와 곡창 고리(9.2) 사이 둘레 길(<see cref="Lane"/>) → 목표로 곧게. 곧은 토막이
    /// 소품에 걸리면 다가서는 각을 조금씩 비튼다(<see cref="ApproachAngle"/>). 일꾼 셋 갈래 — 밭 → 곡창(곡식 자루, 곡창 없으면 남문)
    /// · 남문 → 밭(빈손으로 가 자루를 지고 돌아옴) · 남문 → 시장(상자를 지고 감). 일꾼 수 = <see cref="CountFor"/>.
    /// `RealmCityBuilder.Rebuild` 끝에서 Play 때만 짓는다(다시 지으면 같이 지워지고 같은 시드 → 같은 사람).
    /// 군중 목록이 없는 PC(`CrowdBodies.Available` 거짓)는 아무도 안 세운다(캡슐 대체 금지). 손잡이 `SAGA_REALM_WORKERS=0`·<see cref="On"/>.
    /// </summary>
    public class RealmWorkers : MonoBehaviour
    {
        public const int Max = 12;
        public const int PopPerWorker = 20000;
        public const float Height = 0.5f;      // 성벽(1.6~2.6)의 3분의 1쯤 — 디오라마 축척
        public const float Speed = 0.7f;       // m/초
        public const float WaitSec = 2.5f;     // 짐 싣고 내리는 동안 서 있음
        public const float Lane = 8.4f;        // 둘레 길 반지름
        public const float GateR = 12.2f;      // 남문 밖 출발점(성벽 11)
        public const float Clearance = 0.2f;

        public enum Kind { FarmToGranary, GateToFarm, GateToMarket }

        public struct Prop { public Vector3 Pos; public float Half; }

        /// <summary>진단 손잡이 — 거짓이면 아무도 안 세운다. 기본은 환경 변수 `SAGA_REALM_WORKERS=0` 이 아니면 켬.</summary>
        public static bool On = Environment.GetEnvironmentVariable("SAGA_REALM_WORKERS") != "0";

        private static Material _sackMat, _crateMat;

        /// <summary>일꾼 수(순수) — 밭마다 둘·시장마다 하나, 상한 <see cref="Max"/>, 인구 <see cref="PopPerWorker"/> 마다 하나까지(인구 있으면 최소 1).</summary>
        public static int CountFor(int agri, int comm, int food, int pop)
        {
            int farms = Mathf.Clamp(agri / 90, 0, RealmCityBuilder.MaxFarms);
            int markets = Mathf.Clamp(comm / 80, 0, RealmCityBuilder.MaxMarkets);
            int popCap = pop <= 0 ? 0 : Mathf.Max(1, pop / PopPerWorker);
            return Mathf.Min(farms * 2 + markets, Max, popCap);
        }

        /// <summary>디오라마 아래 "Workers" 를 만들어 일꾼을 세운다. 세운 수 0 이면 뿌리도 안 둔다. 반환 = 세운 일꾼.</summary>
        public static List<RealmWorkers> Build(Transform parent, IList<Prop> farms, IList<Prop> markets, IList<Prop> granaries,
            int agri, int comm, int food, int pop, uint seed)
        {
            var made = new List<RealmWorkers>();
            int n = CountFor(agri, comm, food, pop);
            if (!On || !CrowdBodies.Available || n <= 0) return made;
            var obstacles = new List<Prop>();
            obstacles.AddRange(farms); obstacles.AddRange(markets); obstacles.AddRange(granaries);

            // 갈래 차례 — 밭 i → 곡창, 시장 i, 남문 → 밭 i … (상한에 걸려도 세 갈래가 고루 남게)
            var jobs = new List<(Kind kind, int idx)>();
            int rows = Mathf.Max(farms.Count, markets.Count);
            for (int i = 0; i < rows; i++)
            {
                if (i < farms.Count) jobs.Add((Kind.FarmToGranary, i));
                if (i < markets.Count) jobs.Add((Kind.GateToMarket, i));
                if (i < farms.Count) jobs.Add((Kind.GateToFarm, i));
            }

            var root = new GameObject("Workers");
            root.transform.SetParent(parent, false);
            var rng = new AnonymousCrowd.Rng(seed);
            // 보이기만 — 군중 몸 동작이 `UnityEngine.Random.value` 를 꺼내 쓰는데, 그러면 달 넘김 사건 굴림 줄이 밀린다
            // (다음 달 정리 카드 대신 사건 창이 뜸 — 진단 PlaytestRealmSlice Agri 에서 잡힘). 짓는 동안의 난수 상태를 되돌린다.
            var randomState = UnityEngine.Random.state;
            for (int j = 0; j < jobs.Count && made.Count < n; j++)
            {
                var (kind, idx) = jobs[j];
                var path = PathFor(kind, idx, farms, markets, granaries, obstacles);
                if (path == null || path.Count < 2) continue;
                string key = null;
                int body = -1;
                for (int t = 0; t < 50; t++)
                {
                    key = $"realm_worker_{seed}_{j}_{t}";
                    body = CrowdBodies.IndexFor(key);
                    if (body >= 0 && CrowdBodies.List.bodies[body] != null) break;
                    key = null;
                }
                if (key == null) continue;
                var go = new GameObject($"Worker_{made.Count:00}_{kind}");
                go.transform.SetParent(root.transform, false);
                go.transform.localPosition = path[0];
                var vis = CrowdBodies.Spawn(key, go.transform, Height * (0.94f + rng.Next01() * 0.12f));
                if (vis == null) { Destroy(go); continue; }
                var w = go.AddComponent<RealmWorkers>();
                w.Init(kind, path, rng.Next01() * CycleOf(path), vis);
                w.BodyIndex = body;
                made.Add(w);
            }
            UnityEngine.Random.state = randomState;
            if (made.Count == 0) Destroy(root);
            return made;
        }

        /// <summary>갈래 하나의 길(로컬 좌표, y=0) — 앞 끝에서 짐을 지고 뒤 끝에 내린다(남문 → 밭은 반대로 돌아올 때 짐).</summary>
        public static List<Vector3> PathFor(Kind kind, int idx, IList<Prop> farms, IList<Prop> markets, IList<Prop> granaries, IList<Prop> obstacles)
        {
            switch (kind)
            {
                case Kind.FarmToGranary:
                {
                    var farm = farms[idx];
                    if (granaries.Count == 0) return Join(Approach(farm, obstacles, inward: true), GatePath(obstacles));
                    var gr = granaries[idx % granaries.Count];
                    return Join(Approach(farm, obstacles, inward: true), Approach(gr, obstacles, inward: false, reverse: true));
                }
                case Kind.GateToFarm:
                    return Join(GatePath(obstacles, reverse: true), Approach(farms[idx], obstacles, inward: true, reverse: true));
                default:
                    return Join(GatePath(obstacles, reverse: true), Approach(markets[idx], obstacles, inward: true, reverse: true));
            }
        }

        /// <summary>소품 곁 → 둘레 길까지(reverse 면 둘레 길 → 소품 곁). inward = 소품이 둘레 길 안쪽(밭·시장)인가.</summary>
        private static List<Vector3> Approach(Prop p, IList<Prop> obstacles, bool inward, bool reverse = false)
        {
            float r = new Vector2(p.Pos.x, p.Pos.z).magnitude;
            float stand = inward ? r + p.Half + 0.25f : r - p.Half - 0.25f;
            if (inward && stand > Lane) stand = Lane;
            if (!inward && stand < Lane) stand = Lane;
            float a = ApproachAngle(Angle(p.Pos), stand, Lane, obstacles, p);
            var path = new List<Vector3> { Polar(a, stand), Polar(a, Lane) };
            if (reverse) path.Reverse();
            return path;
        }

        /// <summary>둘레 길 → 남문 밖(reverse 면 남문 밖 → 둘레 길). 남문 = 남쪽(-Z, 각 180°) — 곡창이 문 앞을 막으면 둘레 길에서 비스듬히 문으로.</summary>
        private static List<Vector3> GatePath(IList<Prop> obstacles, bool reverse = false)
        {
            var gate = new Vector3(0f, 0f, -GateR);
            float a = 180f;
            for (float d = 0f; d <= 16f; d += 4f)
            {
                if (SegmentClear(Polar(180f + d, Lane), gate, obstacles, default)) { a = 180f + d; break; }
                if (d > 0f && SegmentClear(Polar(180f - d, Lane), gate, obstacles, default)) { a = 180f - d; break; }
            }
            var path = new List<Vector3> { Polar(a, Lane), gate };
            if (reverse) path.Reverse();
            return path;
        }

        /// <summary>반지름 r0 ~ r1 곧은 토막이 소품(자기 자신 빼고)에 안 걸리는 각 — 0, ±4, ±8 … ±maxDelta 차례로 본다(다 걸리면 처음 각).</summary>
        public static float ApproachAngle(float baseDeg, float r0, float r1, IList<Prop> obstacles, Prop self, float maxDelta = 12f)
        {
            for (float d = 0f; d <= maxDelta; d += 4f)
                for (int s = 0; s < (d == 0f ? 1 : 2); s++)
                {
                    float a = baseDeg + (s == 0 ? d : -d);
                    if (SegmentClear(Polar(a, r0), Polar(a, r1), obstacles, self)) return a;
                }
            return baseDeg;
        }

        public static bool SegmentClear(Vector3 a, Vector3 b, IList<Prop> obstacles, Prop self)
        {
            foreach (var o in obstacles)
            {
                if (o.Pos == self.Pos) continue;
                if (DistToSegmentXZ(o.Pos, a, b) < o.Half + Clearance) return false;
            }
            return true;
        }

        /// <summary>두 토막을 둘레 길 호(짧은 쪽, 15° 마다 점)로 잇는다.</summary>
        private static List<Vector3> Join(List<Vector3> first, List<Vector3> second)
        {
            var path = new List<Vector3>(first);
            float a0 = Angle(first[first.Count - 1]), a1 = Angle(second[0]);
            float delta = Mathf.DeltaAngle(a0, a1);
            int steps = Mathf.CeilToInt(Mathf.Abs(delta) / 15f);
            for (int i = 1; i < steps; i++) path.Add(Polar(a0 + delta * i / steps, Lane));
            path.AddRange(second);
            return path;
        }

        // RealmCityBuilder.BuildCountedProps 와 같은 각 규칙 — x = sin, z = cos.
        public static Vector3 Polar(float deg, float r) => new Vector3(Mathf.Sin(deg * Mathf.Deg2Rad) * r, 0f, Mathf.Cos(deg * Mathf.Deg2Rad) * r);
        private static float Angle(Vector3 p) => Mathf.Atan2(p.x, p.z) * Mathf.Rad2Deg;

        public static float DistToSegmentXZ(Vector3 p, Vector3 a, Vector3 b)
        {
            var pa = new Vector2(p.x - a.x, p.z - a.z);
            var ab = new Vector2(b.x - a.x, b.z - a.z);
            float t = ab.sqrMagnitude < 1e-6f ? 0f : Mathf.Clamp01(Vector2.Dot(pa, ab) / ab.sqrMagnitude);
            return (pa - ab * t).magnitude;
        }

        public static float LengthOf(IReadOnlyList<Vector3> path)
        {
            float len = 0f;
            for (int i = 1; i < path.Count; i++) len += Vector3.Distance(path[i - 1], path[i]);
            return len;
        }

        /// <summary>한 바퀴 = 갔다(걷기) · 서기 · 왔다 · 서기.</summary>
        public static float CycleOf(IReadOnlyList<Vector3> path) => 2f * (LengthOf(path) / Speed + WaitSec);

        // ── 한 사람 ──

        public Kind Job { get; private set; }
        public int BodyIndex { get; private set; }
        public IReadOnlyList<Vector3> Path => _path;
        public bool Carrying { get; private set; }
        public bool Walking { get; private set; }
        public GameObject Cargo => _cargo;

        private List<Vector3> _path;
        private float _phase, _len;
        private CrowdBodyAnimator _anim;
        private GameObject _cargo;

        private void Init(Kind kind, List<Vector3> path, float phase, GameObject visual)
        {
            Job = kind; _path = path; _phase = phase; _len = LengthOf(path);
            _anim = visual.GetComponent<CrowdBodyAnimator>();
            _cargo = MakeCargo(kind, visual.transform);
            Pose(_phase);
        }

        private void Update() => Pose(Time.time + _phase);

        /// <summary>시각 t 의 자리·방향·짐(진단도 부른다).</summary>
        public void Pose(float t)
        {
            float walk = _len / Speed, cycle = 2f * (walk + WaitSec);
            t = Mathf.Repeat(t, cycle);
            // 네 토막: 0 갔다 · 1 끝에서 섬 · 2 왔다 · 3 처음에서 섬
            int leg; float d;
            if (t < walk) { leg = 0; d = _len * t / walk; }
            else if (t < walk + WaitSec) { leg = 1; d = _len; }
            else if (t < 2f * walk + WaitSec) { leg = 2; d = _len * (1f - (t - walk - WaitSec) / walk); }
            else { leg = 3; d = 0f; }
            bool back = leg == 2;
            Walking = leg == 0 || leg == 2;

            // 짐: 밭→곡창·남문→시장은 처음에서 싣고 갈 때까지, 남문→밭은 밭에서 받아 돌아올 때까지
            Carrying = Job == Kind.GateToFarm ? (leg == 1 || leg == 2) : (leg == 3 || leg == 0);
            if (_cargo != null && _cargo.activeSelf != Carrying) _cargo.SetActive(Carrying);

            Sample(d, out var pos, out var dir);
            transform.localPosition = pos;
            if (Walking && dir.sqrMagnitude > 1e-6f) transform.localRotation = Quaternion.LookRotation(back ? -dir : dir);
            if (_anim != null) _anim.SetWalking(Walking);
        }

        private void Sample(float d, out Vector3 pos, out Vector3 dir)
        {
            for (int i = 1; i < _path.Count; i++)
            {
                float seg = Vector3.Distance(_path[i - 1], _path[i]);
                if (d <= seg || i == _path.Count - 1)
                {
                    dir = (_path[i] - _path[i - 1]).normalized;
                    pos = Vector3.Lerp(_path[i - 1], _path[i], seg < 1e-5f ? 1f : Mathf.Clamp01(d / seg));
                    return;
                }
                d -= seg;
            }
            pos = _path[0]; dir = Vector3.forward;
        }

        /// <summary>짐 — 새 모델 없이 도형(곡식 자루 = 작은 원기둥, 상자 = 작은 정육면체)을 등 뼈(없으면 몸)에 붙인다. 충돌체 없음.</summary>
        private static GameObject MakeCargo(Kind kind, Transform visual)
        {
            bool crate = kind == Kind.GateToMarket;
            var go = GameObject.CreatePrimitive(crate ? PrimitiveType.Cube : PrimitiveType.Cylinder);
            go.name = crate ? "Cargo_Crate" : "Cargo_Sack";
            var col = go.GetComponent<Collider>();
            if (col != null) Destroy(col);
            if (crate) { if (_crateMat == null) _crateMat = MakeMat("Cargo_Crate", new Color(0.55f, 0.38f, 0.2f)); }
            else if (_sackMat == null) _sackMat = MakeMat("Cargo_Sack", new Color(0.82f, 0.74f, 0.5f));
            go.GetComponent<MeshRenderer>().sharedMaterial = crate ? _crateMat : _sackMat;

            var root = visual.parent;
            var back = FindBone(visual, "UpperChest") ?? FindBone(visual, "Chest") ?? visual;
            float s = Height * 0.22f;
            go.transform.localScale = crate ? new Vector3(s, s, s) : new Vector3(s * 0.8f, s * 0.6f, s * 0.8f);
            go.transform.rotation = root.rotation;
            go.transform.position = root.position + Vector3.up * (Height * 0.68f) - root.forward * (Height * 0.12f);
            go.transform.SetParent(back, true);
            go.SetActive(false);
            return go;
        }

        private static Transform FindBone(Transform t, string part)
        {
            if (t.name.EndsWith(part, StringComparison.Ordinal)) return t;
            for (int i = 0; i < t.childCount; i++)
            {
                var f = FindBone(t.GetChild(i), part);
                if (f != null) return f;
            }
            return null;
        }

        private static Material MakeMat(string name, Color c)
        {
            var mat = new Material(Shader.Find("Universal Render Pipeline/Lit")) { name = $"{name} (generated)" };
            mat.color = c;
            return mat;
        }
    }
}
