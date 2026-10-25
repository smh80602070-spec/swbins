using System.Collections.Generic;
using Saga.Go.Data;
using UnityEngine;

namespace Saga.Go.World
{
    /// <summary>
    /// tasks U-0227 ② 들판 수수께끼 런타임 — 지금 구역(`GoZones.ZoneOf`)의 셋만 짓고 판정한다(구역이 바뀌면 옛것을 지우고 새로 지음 — U-0226 철학).
    /// 돌 = 곁 1.6m 로 다가가면 들춰짐 · 꽃 = 다음 꽃이 커지고 밝음, 첫 꽃을 밟은 뒤 8초 안에 다섯 · 바람개비 = 날개가 가리키는 쪽 2~5.5m 에 1.2초 서면 돎.
    /// 모양은 코드 도형(돌 = 납작 구, 꽃 = 줄기+구, 바람개비 = 기둥+날개 둘 — 새 모델 없음, 충돌체 없음). 자리는 결정적 후보 중 땅이 있고 물·명소가 아닌 첫 자리.
    /// `WorldMapBuilder` 가 Play 때 붙인다.
    /// </summary>
    public class RiddleField : MonoBehaviour
    {
        public static RiddleField Instance { get; private set; }

        public sealed class Spot
        {
            public int Zone, K;
            public GoRiddle.Kind Kind;
            public Vector3 Pos;
            public float Dir;
            public GameObject Root;
            public Transform Rock, Rotor;
            /// <summary>tasks U-0242 — 들출 돌 모델 자리(풀리면 _open 으로 갈음) · 날개 모델이면 제 y 축으로 돈다.</summary>
            public Transform RockModel;
            public bool RotorAxisY;
            public readonly List<Transform> Flowers = new List<Transform>();
            public int Next;          // 꽃 — 다음에 밟을 꽃
            public float StartedAt;   // 꽃 — 첫 꽃 밟은 때(-1 = 아직)
            public float Held;        // 바람개비 — 바람 쪽에 선 시간
            public bool Solved;
        }

        public readonly List<Spot> Spots = new List<Spot>();
        public int Zone { get; private set; } = -2;
        /// <summary>마지막 보상 문구(진단).</summary>
        public string LastReward { get; private set; }

        private Transform _player;
        private static Material _rockMat, _stemMat, _petalMat, _nextMat, _doneMat, _poleMat, _wingMat;

        private void Awake() => Instance = this;
        private void OnDestroy() { if (Instance == this) Instance = null; }

        private void Update()
        {
            if (!GoRiddle.On) { if (Zone != -2) Build(-1); return; }
            if (_player == null) { var g = GameObject.FindWithTag("Player"); if (g == null) return; _player = g.transform; }
            Step(_player.position, Time.time);
        }

        /// <summary>한 프레임(진단은 자리·시각을 넘겨 직접 부른다).</summary>
        public void Step(Vector3 p, float now)
        {
            int z = GoZones.ZoneOf(p.x, p.z);
            if (z != Zone) Build(z);
            foreach (var s in Spots)
            {
                if (s.Solved) { if (s.Rotor != null) { if (s.RotorAxisY) s.Rotor.Rotate(0f, 540f * Time.deltaTime, 0f, Space.Self); else s.Rotor.Rotate(0f, 0f, 540f * Time.deltaTime, Space.Self); } continue; }
                switch (s.Kind)
                {
                    case GoRiddle.Kind.Rock:
                        if (Flat(p - s.Pos) <= GoRiddle.RockReach) Finish(s);
                        break;
                    case GoRiddle.Kind.Flowers:
                        if (s.StartedAt >= 0f && now - s.StartedAt > GoRiddle.FlowerSec) ResetFlowers(s);
                        if (Flat(p - GoRiddle.FlowerPos(s.Pos, s.Next)) <= GoRiddle.FlowerStep)
                        {
                            if (s.Next == 0) s.StartedAt = now;
                            s.Next++;
                            if (s.Next >= GoRiddle.Flowers) Finish(s); else PaintFlowers(s);
                        }
                        break;
                    case GoRiddle.Kind.Pinwheel:
                        s.Held = GoRiddle.InWind(s.Pos, s.Dir, p) ? s.Held + Time.deltaTime : 0f;
                        if (s.Held >= GoRiddle.PinHoldSec) Finish(s);
                        break;
                }
            }
        }

        /// <summary>바람개비 판정을 시간으로 밀어 넣는다(진단 — Time.deltaTime 없이).</summary>
        public void HoldWind(Spot s, Vector3 p, float sec)
        {
            s.Held = GoRiddle.InWind(s.Pos, s.Dir, p) ? s.Held + sec : 0f;
            if (!s.Solved && s.Held >= GoRiddle.PinHoldSec) Finish(s);
        }

        /// <summary>tasks U-0242 — 바람개비 날개 모델 높이(받침 위, K-0195 규격).</summary>
        public const float PinBladeY = 1.25f;

        private static float Flat(Vector3 d) => new Vector2(d.x, d.z).magnitude;

        private void Finish(Spot s)
        {
            s.Solved = true;
            if (GoRiddle.Solve(s.Zone, s.K, out var reward))
            {
                LastReward = reward;
                string line = string.Format(GoLocalization.T("riddle.seed", "🌰 씨앗을 찾았다 ({0})"), GoRiddle.Seeds);
                if (reward != null) line += " — " + reward;
                Saga.Go.UI.DialogueLabel.Instance?.Show(line, reward != null ? 4f : 2.5f);
            }
            ShowSolved(s);
        }

        /// <summary>그 구역 수수께끼를 짓는다(옛것은 지움). -1 이면 아무것도 안 지음.</summary>
        public void Build(int zone)
        {
            foreach (var s in Spots) if (s.Root != null) Destroy(s.Root);
            Spots.Clear();
            Zone = zone;
            if (zone < 0 || !GoRiddle.On) return;
            var rc = GoZones.RectOf(zone);
            for (int k = 0; k < GoRiddle.PerZone; k++)
            {
                if (!TryPlace(rc, zone, k, out var pos, out float dir)) continue;
                var s = new Spot { Zone = zone, K = k, Kind = GoRiddle.KindOf(k), Pos = pos, Dir = dir, StartedAt = -1f, Solved = GoRiddle.Solved(zone, k) };
                MakeVisual(s);
                Spots.Add(s);
            }
        }

        /// <summary>결정적 후보(띠 안 8 → 구역 전체 16) 중 땅이 평평하고 물·명소가 아닌 첫 자리.</summary>
        private static bool TryPlace(Rect rc, int zone, int k, out Vector3 pos, out float dir)
        {
            for (int a = 0; a < GoRiddle.Tries; a++)
            {
                var c = GoRiddle.Candidate(rc, zone, k, a, out dir);
                if (!Physics.Raycast(new Vector3(c.x, 120f, c.z), Vector3.down, out var hit, 240f, ~0, QueryTriggerInteraction.Ignore)) continue;
                if (hit.normal.y < 0.9f) continue;
                string n = hit.collider.gameObject.name.ToLowerInvariant();
                if (n.Contains("water") || n.Contains("river") || n.Contains("sea") || n.Contains("landmark") || n.Contains("wall") || n.Contains("roof")) continue;
                pos = hit.point;
                return true;
            }
            pos = Vector3.zero; dir = 0f;
            return false;
        }

        private void MakeVisual(Spot s)
        {
            Mats();
            s.Root = new GameObject($"Riddle_{s.Zone}_{s.K}_{s.Kind}");
            s.Root.transform.SetParent(transform, false);
            s.Root.transform.position = s.Pos;
            switch (s.Kind)
            {
                case GoRiddle.Kind.Rock:
                {
                    // tasks U-0242 — 자체 모델(K-0195 들출 돌 puzzle_stone_01 · 들춘 뒤 _open)이 있으면 그것
                    var holder = new GameObject("Rock").transform;
                    holder.SetParent(s.Root.transform, false);
                    if (Saga.Core.WorldModels.Spawn(s.Solved ? "puzzle_stone_01_open" : "puzzle_stone_01", holder, 1.4f) != null) { s.RockModel = holder; break; }
                    Destroy(holder.gameObject);
                    s.Rock = Prim(PrimitiveType.Sphere, s.Root.transform, "Rock", new Vector3(0f, 0.3f, 0f), new Vector3(1.1f, 0.7f, 1f), _rockMat).transform;
                    break;
                }
                case GoRiddle.Kind.Flowers:
                    for (int i = 0; i < GoRiddle.Flowers; i++)
                    {
                        var at = GoRiddle.FlowerPos(Vector3.zero, i);
                        var f = new GameObject("Flower_" + i).transform;
                        f.SetParent(s.Root.transform, false);
                        f.localPosition = at;
                        Prim(PrimitiveType.Cylinder, f, "Stem", new Vector3(0f, 0.25f, 0f), new Vector3(0.06f, 0.25f, 0.06f), _stemMat);
                        Prim(PrimitiveType.Sphere, f, "Petal", new Vector3(0f, 0.55f, 0f), Vector3.one * 0.32f, _petalMat);
                        s.Flowers.Add(f);
                    }
                    PaintFlowers(s);
                    break;
                case GoRiddle.Kind.Pinwheel:
                    // tasks U-0242 — 자체 모델(K-0195 받침 pinwheel_01 + 날개 pinwheel_01_blades — 축 원점, 받침 위 1.25m, 날개 제 y 축으로 돈다)
                    if (Saga.Core.WorldModels.Load("pinwheel_01") != null && Saga.Core.WorldModels.Load("pinwheel_01_blades") != null)
                    {
                        var baseGo = Saga.Core.WorldModels.Spawn("pinwheel_01", s.Root.transform);
                        baseGo.transform.localRotation = Quaternion.Euler(0f, s.Dir, 0f);
                        s.Rotor = new GameObject("Rotor").transform;
                        s.Rotor.SetParent(s.Root.transform, false);
                        s.Rotor.localPosition = new Vector3(0f, PinBladeY, 0f);
                        s.Rotor.localRotation = Quaternion.Euler(0f, s.Dir, 0f);
                        var blades = Object.Instantiate(Saga.Core.WorldModels.Load("pinwheel_01_blades"), s.Rotor, false);
                        foreach (var c in blades.GetComponentsInChildren<Collider>(true)) Object.DestroyImmediate(c);
                        s.RotorAxisY = true;
                        break;
                    }
                    Prim(PrimitiveType.Cylinder, s.Root.transform, "Pole", new Vector3(0f, 1f, 0f), new Vector3(0.1f, 1f, 0.1f), _poleMat);
                    var head = new GameObject("Head").transform;
                    head.SetParent(s.Root.transform, false);
                    head.localPosition = new Vector3(0f, 2.05f, 0f);
                    head.localRotation = Quaternion.Euler(0f, s.Dir, 0f); // 날개 앞면 = 바람이 오는 쪽(서야 할 쪽)
                    s.Rotor = new GameObject("Rotor").transform;
                    s.Rotor.SetParent(head, false);
                    s.Rotor.localPosition = new Vector3(0f, 0f, 0.15f);
                    Prim(PrimitiveType.Cube, s.Rotor, "WingA", Vector3.zero, new Vector3(1.4f, 0.14f, 0.04f), _wingMat);
                    Prim(PrimitiveType.Cube, s.Rotor, "WingB", Vector3.zero, new Vector3(0.14f, 1.4f, 0.04f), _wingMat);
                    break;
            }
            if (s.Solved) ShowSolved(s);
        }

        private static void ShowSolved(Spot s)
        {
            if (s.Rock != null) { s.Rock.localPosition = new Vector3(0.9f, 0.35f, 0f); s.Rock.localRotation = Quaternion.Euler(0f, 0f, 70f); }
            if (s.RockModel != null && s.RockModel.childCount > 0 && s.RockModel.GetChild(0).name != "puzzle_stone_01_open")
            {
                var open = Saga.Core.WorldModels.Spawn("puzzle_stone_01_open", s.RockModel, 1.4f);
                if (open != null) { var old = s.RockModel.GetChild(0).gameObject; old.SetActive(false); Object.Destroy(old); }
            }
            foreach (var f in s.Flowers) { f.localScale = Vector3.one * 1.3f; SetMat(f, _doneMat); }
        }

        private static void ResetFlowers(Spot s) { s.Next = 0; s.StartedAt = -1f; PaintFlowers(s); }

        private static void PaintFlowers(Spot s)
        {
            for (int i = 0; i < s.Flowers.Count; i++)
            {
                bool next = i == s.Next, done = i < s.Next;
                s.Flowers[i].localScale = Vector3.one * (next ? 1.45f : 1f);
                SetMat(s.Flowers[i], done ? _doneMat : next ? _nextMat : _petalMat);
            }
        }

        private static void SetMat(Transform flower, Material m)
        {
            var petal = flower.Find("Petal");
            if (petal != null) petal.GetComponent<MeshRenderer>().sharedMaterial = m;
        }

        private static GameObject Prim(PrimitiveType t, Transform parent, string name, Vector3 local, Vector3 scale, Material m)
        {
            var go = GameObject.CreatePrimitive(t);
            go.name = name;
            var col = go.GetComponent<Collider>();
            if (col != null) Destroy(col);
            go.transform.SetParent(parent, false);
            go.transform.localPosition = local;
            go.transform.localScale = scale;
            go.GetComponent<MeshRenderer>().sharedMaterial = m;
            return go;
        }

        private static void Mats()
        {
            if (_rockMat != null) return;
            _rockMat = Mat("Riddle_Rock", new Color(0.52f, 0.5f, 0.47f));
            _stemMat = Mat("Riddle_Stem", new Color(0.25f, 0.5f, 0.2f));
            _petalMat = Mat("Riddle_Petal", new Color(0.85f, 0.45f, 0.65f));
            _nextMat = Mat("Riddle_Next", new Color(1f, 0.8f, 0.95f), 0.8f);
            _doneMat = Mat("Riddle_Done", new Color(1f, 0.85f, 0.3f), 0.6f);
            _poleMat = Mat("Riddle_Pole", new Color(0.45f, 0.33f, 0.2f));
            _wingMat = Mat("Riddle_Wing", new Color(0.9f, 0.85f, 0.6f));
        }

        private static Material Mat(string name, Color c, float glow = 0f)
        {
            var m = new Material(Shader.Find("Universal Render Pipeline/Lit")) { name = name + " (generated)", color = c };
            if (glow > 0f) { m.EnableKeyword("_EMISSION"); m.SetColor("_EmissionColor", c * glow); }
            return m;
        }
    }
}
