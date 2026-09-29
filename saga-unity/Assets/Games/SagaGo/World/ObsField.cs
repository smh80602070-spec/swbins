using System.Collections.Generic;
using UnityEngine;
using Saga.Go.Data;
using Saga.Go.Player;

namespace Saga.Go.World
{
    /// <summary>
    /// PLAN.md 109-14-35 시간 틈 관측소(웹 사가고 ⑲-35 `era-sites.js`) — 마을 서북쪽 풀밭 위에 부서진 기둥 여섯 + 허공의 틈(빛나는 얇은 판) + 24m 위에 떠 있는 관측대(반지름 12m 돌 원판, 충돌·난간) +
    /// 남쪽 13m 시간 기둥(흰 고리가 솟는다 — 14장 틈 석등 셋을 밝힌 뒤부터 늘 선다). 시간 기둥 안에서 뛰면 구름섬 바람 기둥과 같은 방식으로 솟아(`PlayerController.ExtraDrafts`) 관측대 위로 내려앉는다.
    /// 기둥·틈은 충돌이 없다(석등·이야기 무리가 걷는 땅을 안 막게). 도형만. `WorldMapBuilder` 가 Play 때 붙인다.
    /// </summary>
    public class ObsField : MonoBehaviour
    {
        public static ObsField Instance { get; private set; }

        private readonly Dictionary<string, Material> _mats = new Dictionary<string, Material>();
        private readonly List<LineRenderer> _rings = new List<LineRenderer>();
        private PlayerController.DraftCol _col;
        private bool _registered;
        private float _t, _wait;

        public GameObject Deck { get; private set; }
        public GameObject Rings { get; private set; }
        public bool PillarOpen { get; private set; }

        private void Awake() => Instance = this;
        private void OnDestroy() { Unregister(); if (Instance == this) Instance = null; }
        private void Start() { Build(); Refresh(); }

        private Material Mat(string key, Color c, float glow = 0f, float smooth = 0.15f)
        {
            if (_mats.TryGetValue(key, out var m)) return m;
            m = new Material(Shader.Find("Universal Render Pipeline/Lit")) { name = "Obs_" + key + " (generated)", color = c };
            m.SetFloat("_Smoothness", smooth);
            if (glow > 0f)
            {
                m.EnableKeyword("_EMISSION");
                m.SetColor("_EmissionColor", c * glow);
            }
            _mats[key] = m;
            return m;
        }

        private static GameObject Prim(PrimitiveType t, Transform parent, string name, Vector3 pos, Vector3 scale, Material m, bool collide, float yaw = 0f)
        {
            var go = GameObject.CreatePrimitive(t);
            go.name = name;
            if (!collide) Destroy(go.GetComponent<Collider>());
            go.transform.SetParent(parent, false);
            go.transform.position = pos;
            go.transform.rotation = Quaternion.Euler(0f, yaw, 0f);
            go.transform.localScale = scale;
            go.GetComponent<MeshRenderer>().sharedMaterial = m;
            return go;
        }

        public void Build()
        {
            foreach (Transform c in transform) if (c.name.StartsWith("Obs_")) Destroy(c.gameObject);
            _rings.Clear();
            var root = new GameObject("Obs_root");
            root.transform.SetParent(transform, false);
            Vector3 g = GoStory.ObsPos(Vector2.zero);
            Vector3 deck = GoStory.DeckCenter;
            var stone = WorldMapBuilder.Instance != null ? WorldMapBuilder.Instance.StoneMaterial : null;
            var pale = stone != null ? stone : Mat("pale", new Color(0.62f, 0.66f, 0.72f), 0f, 0.2f);
            var glass = Mat("rift", new Color(0.62f, 0.4f, 0.95f), 2.2f, 0.7f);
            var brass = Mat("brass", new Color(0.7f, 0.58f, 0.3f), 0f, 0.5f);

            // 부서진 기둥 여섯 — 관측소 둘레(충돌 없음)
            for (int i = 0; i < 6; i++)
            {
                float a = i * Mathf.PI * 2f / 6f + 0.3f;
                float h = 3.5f + (i * 7 % 4) * 1.1f;
                Prim(PrimitiveType.Cube, root.transform, "Obs_pillar" + i, g + new Vector3(Mathf.Cos(a) * 11f, h * 0.5f, Mathf.Sin(a) * 11f), new Vector3(1.8f, h, 1.8f), pale, false, a * Mathf.Rad2Deg);
            }
            // 허공의 틈 — 땅 위 3m 부터 14m 까지 서 있는 얇은 빛 판 둘(엇갈려)
            Prim(PrimitiveType.Cube, root.transform, "Obs_rift0", g + new Vector3(0f, 9f, 0f), new Vector3(0.18f, 12f, 5.5f), glass, false, 20f);
            Prim(PrimitiveType.Cube, root.transform, "Obs_rift1", g + new Vector3(0.4f, 9.5f, 0f), new Vector3(0.12f, 10f, 3.5f), glass, false, 100f);
            // 시간 기둥 받침 — 남쪽 13m, 바닥에 빛나는 원판
            Vector3 pil = GoStory.ObsPillarPos;
            Prim(PrimitiveType.Cylinder, root.transform, "Obs_pillar_base", pil + Vector3.up * 0.06f, new Vector3(GoStory.DraftR * 2f + 1.6f, 0.06f, GoStory.DraftR * 2f + 1.6f), Mat("base", new Color(0.55f, 0.75f, 1f), 1.4f, 0.4f), false);

            // 떠 있는 관측대 — 돌 원판(충돌 + 오르기 금지) + 밑으로 뾰족한 뿔 + 난간 + 관측경
            Deck = new GameObject("Obs_deck");
            Deck.transform.SetParent(root.transform, false);
            float r = GoStory.DeckR;
            var disc = Prim(PrimitiveType.Cylinder, Deck.transform, "Obs_deck_disc", deck - Vector3.up * 1.5f, new Vector3(r * 2f, 1.5f, r * 2f), pale, false);
            disc.AddComponent<MeshCollider>().sharedMesh = disc.GetComponent<MeshFilter>().sharedMesh;
            disc.AddComponent<NoClimb>();
            Prim(PrimitiveType.Sphere, Deck.transform, "Obs_deck_horn", deck - Vector3.up * 8f, new Vector3(r * 1.1f, 11f, r * 1.1f), pale, false);
            const int seg = 20;
            float rr = r - 0.7f, len = 2f * Mathf.PI * rr / seg + 0.2f;
            for (int i = 0; i < seg; i++)
            {
                float a = (i + 0.5f) * Mathf.PI * 2f / seg;
                var w = Prim(PrimitiveType.Cube, Deck.transform, "Obs_deck_rail", deck + new Vector3(Mathf.Sin(a) * rr, GoStory.SkyRail * 0.5f, Mathf.Cos(a) * rr), new Vector3(len, GoStory.SkyRail, 0.5f), pale, true, a * Mathf.Rad2Deg + 90f);
                w.AddComponent<NoClimb>();
            }
            // 관측경 — 놋쇠 통 하나와 받침(충돌 없음)
            Prim(PrimitiveType.Cube, Deck.transform, "Obs_scope_stand", deck + new Vector3(4f, 0.8f, -3f), new Vector3(1f, 1.6f, 1f), brass, false);
            var scope = Prim(PrimitiveType.Cylinder, Deck.transform, "Obs_scope", deck + new Vector3(4f, 2.1f, -3f), new Vector3(0.7f, 1.6f, 0.7f), brass, false);
            scope.transform.rotation = Quaternion.Euler(50f, 30f, 0f);

            // 시간 기둥 고리 여덟(닫힌 동안은 꺼 둔다)
            Rings = new GameObject("Obs_rings");
            Rings.transform.SetParent(root.transform, false);
            var lineMat = new Material(Shader.Find("Sprites/Default")) { name = "ObsPillar (generated)" };
            for (int i = 0; i < 8; i++)
            {
                var go = new GameObject("Obs_ring");
                go.transform.SetParent(Rings.transform, false);
                var lr = go.AddComponent<LineRenderer>();
                lr.useWorldSpace = false;
                lr.loop = true;
                lr.positionCount = 32;
                lr.widthMultiplier = 0.25f;
                lr.material = lineMat;
                lr.startColor = lr.endColor = new Color(0.65f, 0.85f, 1f, 0.6f);
                lr.shadowCastingMode = UnityEngine.Rendering.ShadowCastingMode.Off;
                for (int k = 0; k < 32; k++)
                {
                    float a = k * Mathf.PI * 2f / 32f;
                    lr.SetPosition(k, new Vector3(Mathf.Cos(a) * GoStory.DraftR, 0f, Mathf.Sin(a) * GoStory.DraftR));
                }
                _rings.Add(lr);
            }
            Physics.SyncTransforms();
        }

        private void Unregister()
        {
            if (_registered) PlayerController.ExtraDrafts.Remove(_col);
            _registered = false;
        }

        /// <summary>시간 기둥이 열렸나에 맞춰 고리·솟는 판정을 켜고 끈다(진단도 부른다).</summary>
        public void Refresh()
        {
            bool open = !StoryState.OffForTest && GoStory.ObsPillarOpen;
            PillarOpen = open;
            if (Rings != null) Rings.SetActive(open);
            Unregister();
            if (open)
            {
                _col = new PlayerController.DraftCol { Base = GoStory.ObsPillarPos, R = GoStory.DraftR, Top = GoStory.ObsDraftTop };
                PlayerController.ExtraDrafts.Add(_col);
                _registered = true;
            }
        }

        private void Update()
        {
            _wait -= Time.deltaTime;
            if (_wait <= 0f)
            {
                _wait = 0.25f;
                if (PillarOpen != (!StoryState.OffForTest && GoStory.ObsPillarOpen)) Refresh();
            }
            if (Rings == null || !Rings.activeSelf) return;
            _t += Time.deltaTime;
            Vector3 b = GoStory.ObsPillarPos;
            float h = GoStory.ObsDraftTop - b.y;
            for (int i = 0; i < _rings.Count; i++)
            {
                float f = Mathf.Repeat(_t * GoStory.DraftRise / h + i / (float)_rings.Count, 1f);
                _rings[i].transform.position = b + Vector3.up * (f * h);
            }
        }
    }
}
