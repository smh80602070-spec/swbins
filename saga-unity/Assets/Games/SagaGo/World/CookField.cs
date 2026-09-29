using System.Collections.Generic;
using UnityEngine;
using Saga.Go.Combat;
using Saga.Go.Data;
using Saga.Go.UI;

namespace Saga.Go.World
{
    /// <summary>
    /// PLAN.md 109-14-6 채집·솥(웹 사가고 ⑲-6) — 채집 포기(`GoCooking.Nodes`)를 줄기 + 빛깔 머리로 세우고 역참 다섯 곁에 가마솥 + 불씨를 놓는다.
    /// 0.2초마다 발 자리로 줍기, 1초마다 다시 자란 포기를 다시 보이고, 매 프레임 요리 버프·포만감 시간을 흘린다. 모델 없이 도형만(웹 "효과 층").
    /// `WorldMapBuilder` 가 Play 때 붙인다(씬 재빌드 없음). 땅 높이는 실제 땅에 레이를 쏴 앉힌다.
    /// </summary>
    public class CookField : MonoBehaviour
    {
        public const float CheckEverySec = 0.2f;
        public static CookField Instance { get; private set; }

        private readonly Dictionary<string, GameObject> _nodes = new Dictionary<string, GameObject>();
        private readonly Dictionary<string, Vector3> _pos = new Dictionary<string, Vector3>();
        private readonly List<Vector3> _pots = new List<Vector3>();
        private readonly Dictionary<string, Material> _mats = new Dictionary<string, Material>();
        private float _wait, _refresh, _prune;

        /// <summary>마지막 줍기 글(진단).</summary>
        public string LastPicked { get; private set; }
        public IReadOnlyList<Vector3> Pots => _pots;

        private void Awake() => Instance = this;
        private void OnDestroy() { if (Instance == this) Instance = null; }

        private void Start() => Rebuild();

        /// <summary>글자 지도 포기 + 109-14-32 고원 눈꽃 포기 + 109-14-46 잠긴 도읍 바지락 포기.</summary>
        private static IEnumerable<GoCooking.Node> AllNodes()
        {
            foreach (var n in GoCooking.Nodes) yield return n;
            foreach (var n in GoCooking.FrostNodes) yield return n;
            foreach (var n in GoCooking.SunkenNodes) yield return n;
        }

        public Vector3 PosOf(string id) => _pos.TryGetValue(id, out var p) ? p : Vector3.zero;
        public bool Shown(string id) => _nodes.TryGetValue(id, out var go) && go != null && go.activeSelf;

        public void Rebuild()
        {
            foreach (Transform c in transform) if (c.name.StartsWith("Cook_")) Destroy(c.gameObject);
            _nodes.Clear();
            _pos.Clear();
            _pots.Clear();
            foreach (var n in AllNodes())
            {
                Vector3 p = FolkWalker.Grounded(n.Pos);
                _pos[n.Id] = p;
                _nodes[n.Id] = SpawnNode(n, p);
            }
            foreach (var w in GoWorldMap.Waypoints)
            {
                Vector3 p = FolkWalker.Grounded(GoCooking.PotPos(w));
                _pots.Add(p);
                SpawnPot(p, w.Id);
            }
            RefreshShown();
        }

        private Material Mat(string key, Color c, float glow)
        {
            if (_mats.TryGetValue(key, out var m)) return m;
            m = new Material(Shader.Find("Universal Render Pipeline/Lit")) { name = "Cook_" + key + " (generated)", color = c };
            if (glow > 0f)
            {
                m.EnableKeyword("_EMISSION");
                m.SetColor("_EmissionColor", c * glow);
            }
            _mats[key] = m;
            return m;
        }

        private static GameObject Prim(PrimitiveType t, Transform parent, Vector3 local, Vector3 scale, Material m)
        {
            var go = GameObject.CreatePrimitive(t);
            Destroy(go.GetComponent<Collider>());
            go.transform.SetParent(parent, false);
            go.transform.localPosition = local;
            go.transform.localScale = scale;
            go.GetComponent<MeshRenderer>().sharedMaterial = m;
            return go;
        }

        /// <summary>포기 — 줄기 + 빛깔 머리(특산은 빛나고 조금 크다). 조개·소라는 땅에 납작한 돌.</summary>
        private GameObject SpawnNode(GoCooking.Node n, Vector3 p)
        {
            GoCooking.TryItem(n.Item, out var it);
            var root = new GameObject("Cook_" + n.Id);
            root.transform.SetParent(transform, false);
            root.transform.position = p;
            var head = Mat(n.Item, it.Color, n.Special ? 1.6f : 0.35f);
            float s = n.Special ? 1.25f : 1f;
            if (n.Item == "clam" || n.Item == "conch")
                Prim(PrimitiveType.Sphere, root.transform, new Vector3(0f, 0.18f, 0f), new Vector3(0.8f, 0.35f, 0.65f) * s, head);
            else
            {
                Prim(PrimitiveType.Cylinder, root.transform, new Vector3(0f, 0.4f * s, 0f), new Vector3(0.12f, 0.4f * s, 0.12f), Mat("stem", new Color(0.25f, 0.45f, 0.2f), 0f));
                var shape = n.Item == "mushroom" ? new Vector3(0.75f, 0.35f, 0.75f) : new Vector3(0.55f, 0.55f, 0.55f);
                Prim(PrimitiveType.Sphere, root.transform, new Vector3(0f, 0.85f * s, 0f), shape * s, head);
            }
            return root;
        }

        /// <summary>가마솥 — 검은 솥 + 받침돌 셋 + 불씨.</summary>
        private void SpawnPot(Vector3 p, string id)
        {
            var root = new GameObject("Cook_pot_" + id);
            root.transform.SetParent(transform, false);
            root.transform.position = p;
            var stone = Mat("pot_stone", new Color(0.42f, 0.4f, 0.38f), 0f);
            for (int i = 0; i < 3; i++)
            {
                float a = i * Mathf.PI * 2f / 3f;
                Prim(PrimitiveType.Cube, root.transform, new Vector3(Mathf.Cos(a) * 1.1f, 0.3f, Mathf.Sin(a) * 1.1f), new Vector3(0.6f, 0.6f, 0.6f), stone);
            }
            Prim(PrimitiveType.Sphere, root.transform, new Vector3(0f, 0.35f, 0f), new Vector3(0.9f, 0.5f, 0.9f), Mat("pot_fire", new Color(1f, 0.45f, 0.1f), 3f));
            Prim(PrimitiveType.Cylinder, root.transform, new Vector3(0f, 1.25f, 0f), new Vector3(1.8f, 0.55f, 1.8f), Mat("pot_iron", new Color(0.12f, 0.12f, 0.13f), 0f));
            Prim(PrimitiveType.Cylinder, root.transform, new Vector3(0f, 1.8f, 0f), new Vector3(1.55f, 0.02f, 1.55f), Mat("pot_soup", new Color(0.75f, 0.55f, 0.3f), 0.4f));
        }

        /// <summary>솥 7.4m 안인가(수평).</summary>
        public bool AtPot(Vector3 feet)
        {
            foreach (var p in _pots)
            {
                Vector3 d = p - feet;
                d.y = 0f;
                if (d.magnitude <= GoCooking.PotRadius) return true;
            }
            return false;
        }

        public static bool PlayerAtPot()
        {
            var fc = FieldCombat.Instance;
            return Instance != null && fc != null && Instance.AtPot(fc.transform.position);
        }

        private void RefreshShown()
        {
            foreach (var n in AllNodes())
                if (_nodes.TryGetValue(n.Id, out var go) && go != null) go.SetActive(CookState.Available(n));
        }

        private void Update()
        {
            float dt = Time.deltaTime;
            foreach (var name in CookState.Step(dt))
                if (DialogueLabel.Instance != null) DialogueLabel.Instance.Show(string.Format(GoLocalization.T("cook.buff_end", "{0} 효과가 끝났다"), name), 2.5f);
            _refresh -= dt;
            if (_refresh <= 0f) { _refresh = 1f; RefreshShown(); }
            _prune -= dt;
            if (_prune <= 0f) { _prune = 60f; CookState.Prune(); }
            _wait -= dt;
            if (_wait > 0f) return;
            _wait = CheckEverySec;
            var fc = FieldCombat.Instance;
            if (fc != null) Check(fc.transform.position);
        }

        /// <summary>발 자리에서 줍기 — 주운 포기 수. 진단이 직접 부른다.</summary>
        public int Check(Vector3 feet)
        {
            var got = new Dictionary<string, int>();
            int picked = 0;
            foreach (var n in AllNodes())
            {
                if (!GoCooking.CanReach(_pos.TryGetValue(n.Id, out var p) ? p : n.Pos, feet)) continue;
                if (!CookState.Pick(n)) continue;
                picked++;
                got.TryGetValue(n.Item, out int c);
                got[n.Item] = c + 1;
                if (_nodes.TryGetValue(n.Id, out var go) && go != null) go.SetActive(false);
            }
            if (picked == 0) return 0;
            var parts = new List<string>();
            foreach (var kv in got) parts.Add($"{GoCooking.ItemName(kv.Key)} +{kv.Value}");
            LastPicked = string.Join(" · ", parts);
            FieldRingFx.Spawn(feet, 2f, new Color(0.6f, 0.95f, 0.5f), 0.4f);
            if (DialogueLabel.Instance != null) DialogueLabel.Instance.Show(LastPicked, 2f);
            return picked;
        }
    }
}
