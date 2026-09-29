using System.Collections.Generic;
using UnityEngine;
using Saga.Go.Data;

namespace Saga.Go.World
{
    /// <summary>
    /// PLAN.md 109-14-34 갈대 나루 물가 녹슨 조선소(웹 사가고 ⑲-34 `era-sites.js`) — 마을 강 서쪽 둑에 창고·녹슨 배 뼈대·나루 널판·용접대·통 몇 개와
    /// 기중기(노란 다리 둘 + 들보). 기중기 다리는 곧은 벽이라 그대로 기어오르고(`PlayerController` 벽 잡기 — 충돌이 있는 것만), 들보 윗면(`GoStory.CraneTop`)이 꼭대기다.
    /// 나머지 건물은 충돌이 없다(이야기 무리·지키기 물결이 걷는 땅을 안 막게). 도형만. `WorldMapBuilder` 가 Play 때 붙인다.
    /// </summary>
    public class YardField : MonoBehaviour
    {
        public static YardField Instance { get; private set; }

        private readonly Dictionary<string, Material> _mats = new Dictionary<string, Material>();
        private GameObject _crane;
        /// <summary>기중기 몸(충돌 있음) — 진단이 다리 벽·들보 윗면을 잰다.</summary>
        public GameObject Crane => _crane;

        private void Awake() => Instance = this;
        private void OnDestroy() { if (Instance == this) Instance = null; }
        private void Start() => Build();

        private Material Mat(string key, Color c, float glow = 0f, float smooth = 0.2f)
        {
            if (_mats.TryGetValue(key, out var m)) return m;
            m = new Material(Shader.Find("Universal Render Pipeline/Lit")) { name = "Yard_" + key + " (generated)", color = c };
            m.SetFloat("_Smoothness", smooth);
            if (glow > 0f)
            {
                m.EnableKeyword("_EMISSION");
                m.SetColor("_EmissionColor", c * glow);
            }
            _mats[key] = m;
            return m;
        }

        private static GameObject Box(Transform parent, string name, Vector3 center, Vector3 size, Material m, bool collide, float yaw = 0f)
        {
            var go = GameObject.CreatePrimitive(PrimitiveType.Cube);
            go.name = name;
            if (!collide) Destroy(go.GetComponent<Collider>());
            go.transform.SetParent(parent, false);
            go.transform.position = center;
            go.transform.rotation = Quaternion.Euler(0f, yaw, 0f);
            go.transform.localScale = size;
            go.GetComponent<MeshRenderer>().sharedMaterial = m;
            return go;
        }

        public void Build()
        {
            foreach (Transform c in transform) if (c.name.StartsWith("Yard_")) Destroy(c.gameObject);
            var root = new GameObject("Yard_root");
            root.transform.SetParent(transform, false);
            Vector3 g = GoStory.YardPos(Vector2.zero);
            var rust = Mat("rust", new Color(0.42f, 0.23f, 0.14f), 0f, 0.1f);
            var iron = Mat("iron", new Color(0.2f, 0.19f, 0.19f), 0f, 0.3f);
            var yellow = Mat("crane", new Color(0.86f, 0.66f, 0.1f), 0f, 0.35f);
            var plank = Mat("plank", new Color(0.3f, 0.22f, 0.15f), 0f, 0.05f);
            var glow = Mat("weld", new Color(1f, 0.5f, 0.12f), 3f, 0.4f);

            // 창고 — 용접대 서쪽, 다온 곁
            Box(root.transform, "Yard_warehouse", g + new Vector3(-13f, 3f, -8f), new Vector3(11f, 6f, 8f), rust, false);
            Box(root.transform, "Yard_warehouse_roof", g + new Vector3(-13f, 6.4f, -8f), new Vector3(12f, 0.8f, 9f), iron, false, 0f);
            // 뭍에 올린 녹슨 배 뼈대 — 강 쪽
            Box(root.transform, "Yard_hull", g + new Vector3(9f, 1.6f, 8f), new Vector3(15f, 3.2f, 4.2f), rust, false, 12f);
            for (int i = 0; i < 5; i++) Box(root.transform, "Yard_rib" + i, g + new Vector3(3f + i * 3.2f, 3.6f, 8.6f - i * 0.6f), new Vector3(0.35f, 2.6f, 4.6f), iron, false, 12f);
            // 나루 널판 — 강으로 뻗음
            Box(root.transform, "Yard_pier", g + new Vector3(-2f, 0.12f, 13f), new Vector3(3.2f, 0.25f, 12f), plank, false);
            // 용접대 — 불꽃 빛
            var weldPos = GoStory.YardPos(GoStory.YardWeld);
            Box(root.transform, "Yard_weld_table", weldPos + new Vector3(0f, 0.5f, 0f), new Vector3(2.4f, 1f, 1.2f), iron, false);
            var spark = Box(root.transform, "Yard_weld_spark", weldPos + new Vector3(0.6f, 1.15f, 0f), new Vector3(0.5f, 0.35f, 0.5f), glow, false);
            var light = new GameObject("Yard_weld_light").AddComponent<Light>();
            light.transform.SetParent(root.transform, false);
            light.transform.position = spark.transform.position + Vector3.up * 0.8f;
            light.type = LightType.Point; light.color = new Color(1f, 0.55f, 0.2f); light.range = 9f; light.intensity = 1.6f; light.shadows = LightShadows.None;
            // 통
            for (int i = 0; i < 4; i++)
            {
                var b = GameObject.CreatePrimitive(PrimitiveType.Cylinder);
                b.name = "Yard_barrel" + i;
                Destroy(b.GetComponent<Collider>());
                b.transform.SetParent(root.transform, false);
                b.transform.position = g + new Vector3(-6f + i * 1.3f, 0.7f, -13f + (i % 2) * 1f);
                b.transform.localScale = new Vector3(1f, 0.7f, 1f);
                b.GetComponent<MeshRenderer>().sharedMaterial = i % 2 == 0 ? rust : iron;
            }

            // 기중기 — 다리 둘(충돌 있음, 곧은 벽) + 들보. 들보 윗면 = `GoStory.CraneTop`. 다리는 땅 밑으로 3m 더 묻어 언덕에도 뜨지 않게.
            _crane = new GameObject("Yard_crane");
            _crane.transform.SetParent(root.transform, false);
            Vector3 top = GoStory.CraneTop;
            float legH = GoStory.CraneHeight + 3f, legX = 5.35f, w = 1.4f;
            foreach (int side in new[] { -1, 1 })
                Box(_crane.transform, "Yard_crane_leg" + side, new Vector3(top.x + side * legX, top.y - legH * 0.5f, top.z), new Vector3(w, legH, w), yellow, true);
            Box(_crane.transform, "Yard_crane_beam", new Vector3(top.x, top.y - 0.6f, top.z), new Vector3(legX * 2f + w, 1.2f, w), yellow, true);
            // 가새와 매달린 갈고리(충돌 없음)
            Box(_crane.transform, "Yard_crane_brace", new Vector3(top.x, top.y - 5f, top.z), new Vector3(legX * 2f, 0.3f, 0.3f), iron, false);
            Box(_crane.transform, "Yard_crane_cable", new Vector3(top.x, top.y - 5.5f, top.z), new Vector3(0.12f, 9.6f, 0.12f), iron, false);
            Box(_crane.transform, "Yard_crane_hook", new Vector3(top.x, top.y - 10.4f, top.z), new Vector3(0.8f, 0.8f, 0.8f), iron, false);
            // 들보 위에 박힌 날개 조각(빛나는 판) — 이야기 13장 6단계 목표
            Box(_crane.transform, "Yard_wingpiece", top + new Vector3(0.8f, 0.5f, 0f), new Vector3(2.4f, 0.15f, 1f), Mat("wing", new Color(0.6f, 0.85f, 1f), 1.6f, 0.6f), false, 20f);
        }
    }
}
