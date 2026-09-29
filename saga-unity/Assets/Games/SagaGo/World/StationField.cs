using System.Collections.Generic;
using UnityEngine;
using Saga.Go.Data;

namespace Saga.Go.World
{
    /// <summary>
    /// PLAN.md 109-14-36 옛 역참 터(웹 사가고 ⑲-36 `era-sites.js`) — 남쪽 공터와 논밭 사이 길 칸에 동쪽이 트인 돌담 세 변 · 초가 마구간 · 구유 · 깃대 · 돌장승 둘.
    /// 충돌이 없다(이야기 무리·쫓기 길을 안 막게). 도형만. `WorldMapBuilder` 가 Play 때 붙인다.
    /// </summary>
    public class StationField : MonoBehaviour
    {
        public static StationField Instance { get; private set; }

        private readonly Dictionary<string, Material> _mats = new Dictionary<string, Material>();
        private void Awake() => Instance = this;
        private void OnDestroy() { if (Instance == this) Instance = null; }
        private void Start() => Build();

        private Material Mat(string key, Color c, float smooth = 0.1f)
        {
            if (_mats.TryGetValue(key, out var m)) return m;
            m = new Material(Shader.Find("Universal Render Pipeline/Lit")) { name = "Station_" + key + " (generated)", color = c };
            m.SetFloat("_Smoothness", smooth);
            _mats[key] = m;
            return m;
        }

        private static GameObject P(PrimitiveType t, Transform parent, string name, Vector3 pos, Vector3 scale, Material m, float yaw = 0f, float pitch = 0f)
        {
            var go = GameObject.CreatePrimitive(t);
            go.name = name;
            Destroy(go.GetComponent<Collider>());
            go.transform.SetParent(parent, false);
            go.transform.position = pos;
            go.transform.rotation = Quaternion.Euler(pitch, yaw, 0f);
            go.transform.localScale = scale;
            go.GetComponent<MeshRenderer>().sharedMaterial = m;
            return go;
        }

        public void Build()
        {
            foreach (Transform c in transform) if (c.name.StartsWith("Station_")) Destroy(c.gameObject);
            var root = new GameObject("Station_root");
            root.transform.SetParent(transform, false);
            Vector3 g = GoStory.StationPos(Vector2.zero);
            var stone = Mat("stone", new Color(0.48f, 0.46f, 0.42f), 0.05f);
            var thatch = Mat("thatch", new Color(0.62f, 0.5f, 0.24f), 0.02f);
            var wood = Mat("wood", new Color(0.33f, 0.22f, 0.14f), 0.05f);
            var cloth = Mat("flag", new Color(0.7f, 0.15f, 0.12f), 0.1f);
            // 돌담 세 변 — 북·서·남, 동쪽이 트임
            P(PrimitiveType.Cube, root.transform, "Station_wall_n", g + new Vector3(0f, 1.1f, -11f), new Vector3(22f, 2.2f, 1.2f), stone);
            P(PrimitiveType.Cube, root.transform, "Station_wall_s", g + new Vector3(0f, 1.1f, 11f), new Vector3(22f, 2.2f, 1.2f), stone);
            P(PrimitiveType.Cube, root.transform, "Station_wall_w", g + new Vector3(-11f, 1.1f, 0f), new Vector3(1.2f, 2.2f, 22f), stone);
            // 초가 마구간 — 서남쪽 구석 (역마가 서는 자리 곁)
            Vector3 st = g + new Vector3(-8f, 0f, -4f);
            foreach (var (dx, dz) in new[] { (-3f, -2.5f), (3f, -2.5f), (-3f, 2.5f), (3f, 2.5f) })
                P(PrimitiveType.Cylinder, root.transform, "Station_post", st + new Vector3(dx, 1.4f, dz), new Vector3(0.35f, 1.4f, 0.35f), wood);
            P(PrimitiveType.Cube, root.transform, "Station_roof_a", st + new Vector3(0f, 3.4f, -1.4f), new Vector3(7.4f, 0.35f, 3.6f), thatch, 0f, -22f);
            P(PrimitiveType.Cube, root.transform, "Station_roof_b", st + new Vector3(0f, 3.4f, 1.4f), new Vector3(7.4f, 0.35f, 3.6f), thatch, 0f, 22f);
            P(PrimitiveType.Cube, root.transform, "Station_trough", st + new Vector3(2.4f, 0.45f, 0f), new Vector3(0.8f, 0.5f, 3.6f), wood);
            // 깃대 — 역참 앞마당
            P(PrimitiveType.Cylinder, root.transform, "Station_pole", g + new Vector3(4f, 3f, -6f), new Vector3(0.22f, 3f, 0.22f), wood);
            P(PrimitiveType.Cube, root.transform, "Station_flag", g + new Vector3(4.9f, 5.3f, -6f), new Vector3(1.8f, 1.1f, 0.06f), cloth);
            // 돌장승 둘 — 동쪽 어귀
            foreach (float z in new[] { -6.5f, 6.5f })
            {
                P(PrimitiveType.Cylinder, root.transform, "Station_jangseung", g + new Vector3(10f, 1.6f, z), new Vector3(0.9f, 1.6f, 0.9f), stone);
                P(PrimitiveType.Sphere, root.transform, "Station_jangseung_head", g + new Vector3(10f, 3.5f, z), new Vector3(1.2f, 1.3f, 1.2f), stone);
            }
        }
    }
}
