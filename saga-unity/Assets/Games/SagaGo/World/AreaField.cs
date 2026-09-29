using System.Collections.Generic;
using TMPro;
using UnityEngine;
using UnityEngine.InputSystem;
using UnityEngine.UI;
using Saga.Go.Combat;
using Saga.Go.Data;
using Saga.Go.Player;
using Saga.Go.UI;

namespace Saga.Go.World
{
    /// <summary>
    /// PLAN.md 109-14-37 지도 밖 독립 땅(<see cref="GoAreas"/>) — 은하 나루 같은 이야기 무대를 실행 때 짓는다(서리봉 고원 `FrostField` 와 같은 방식).
    /// 땅 바닥·바깥 보이지 않는 벽(못 넘음)·명소와 작은 발견을 도형으로 세우고, 발 자리로 명소를 찾고(금·연마석·경험치 한 번), 지도 쪽 돌기둥 ↔ 땅 쪽 경계비 돌기둥으로 오간다
    /// (곁 4.5m 에서 단추 또는 F — 열린 땅만, 싸우는 중엔 막힘). 이야기가 바꾸는 부분(계류 탑 빛 공·매인 별배·종·막차 등)은 `Refresh` 가 진행에 맞춰 켠다.
    /// `WorldMapBuilder` 가 Play 때 붙인다(씬 재빌드 없음).
    /// </summary>
    public class AreaField : MonoBehaviour
    {
        public static AreaField Instance { get; private set; }
        public const float CheckEverySec = 0.25f;

        private readonly Dictionary<string, Material> _mats = new Dictionary<string, Material>();
        private readonly Dictionary<string, GameObject> _sites = new Dictionary<string, GameObject>();
        private readonly Dictionary<string, GameObject> _gates = new Dictionary<string, GameObject>();
        private readonly Dictionary<string, GameObject> _steles = new Dictionary<string, GameObject>();
        private readonly Dictionary<string, GameObject> _parts = new Dictionary<string, GameObject>();
        private GameObject _btnRoot;
        private Button _travel;
        private TextMeshProUGUI _travelText;
        private float _wait;

        public string LastFound { get; private set; }
        public Button TravelButton => _travel;
        public string TravelLabel => _travelText != null ? _travelText.text : "";
        /// <summary>땅 바닥·지도 쪽 돌기둥은 Awake 에서 짓는다 — 이야기 자리(`Grounded`)가 바닥이 있어야 앉는다.</summary>
        private void Awake()
        {
            Instance = this;
            Rebuild();
            Physics.SyncTransforms();
        }

        private void OnDestroy()
        {
            if (_riftRegistered) PlayerController.ExtraDrafts.Remove(_riftCol);
            if (Instance == this) Instance = null;
        }

        public GameObject SiteObject(string areaId, string siteId) => _sites.TryGetValue(areaId + ":" + siteId, out var g) ? g : null;
        /// <summary>이야기가 켜고 끄는 조각(예: "skyport:beacon") — 없으면 null.</summary>
        public GameObject PartObject(string key) => _parts.TryGetValue(key, out var g) ? g : null;
        public GameObject GateObject(string areaId) => _gates.TryGetValue(areaId, out var g) ? g : null;
        public GameObject SteleObject(string areaId) => _steles.TryGetValue(areaId, out var g) ? g : null;

        // ---- 짓기 ----

        private Material Mat(string key, Color c, float glow = 0f, float smooth = 0.15f, float metal = 0f)
        {
            if (_mats.TryGetValue(key, out var m)) return m;
            m = new Material(Shader.Find("Universal Render Pipeline/Lit")) { name = "Area_" + key + " (generated)", color = c };
            m.SetFloat("_Smoothness", smooth);
            m.SetFloat("_Metallic", metal);
            if (glow > 0f)
            {
                m.EnableKeyword("_EMISSION");
                m.SetColor("_EmissionColor", c * glow);
            }
            _mats[key] = m;
            return m;
        }

        internal static GameObject P(PrimitiveType t, Transform parent, string name, Vector3 local, Vector3 scale, Material m, bool collide, Vector3 euler = default)
        {
            var go = GameObject.CreatePrimitive(t);
            go.name = name;
            if (!collide) Destroy(go.GetComponent<Collider>());
            else if (t == PrimitiveType.Cylinder)
            {
                // 원기둥 기본 충돌은 캡슐이라 납작하게 눌러도 둥근 공이 된다 — 섬돌처럼 발 디디는 원판은 메시 충돌로
                Destroy(go.GetComponent<Collider>());
                go.AddComponent<MeshCollider>().sharedMesh = go.GetComponent<MeshFilter>().sharedMesh;
            }
            go.transform.SetParent(parent, false);
            go.transform.localPosition = local;
            go.transform.localRotation = Quaternion.Euler(euler);
            go.transform.localScale = scale;
            go.GetComponent<MeshRenderer>().sharedMaterial = m;
            return go;
        }

        public void Rebuild()
        {
            foreach (Transform c in transform) if (c.name.StartsWith("Area_")) Destroy(c.gameObject);
            _sites.Clear(); _gates.Clear(); _steles.Clear(); _parts.Clear();
            foreach (var a in GoAreas.All) BuildArea(a);
            BuildUi();
        }

        private static Color Hex(string h) => ColorUtility.TryParseHtmlString("#" + h, out var c) ? c : Color.gray;

        private void BuildArea(GoAreas.Area a)
        {
            var root = new GameObject("Area_" + a.Id);
            root.transform.SetParent(transform, false);
            Vector3 c0 = a.Center;
            var ground = P(PrimitiveType.Cube, root.transform, "Area_ground", c0 + new Vector3(0f, -GoAreas.Thickness * 0.5f, 0f), new Vector3(GoAreas.HalfX * 2f, GoAreas.Thickness, GoAreas.HalfZ * 2f), Mat("ground_" + a.Id, Hex(a.GroundHex), 0f, 0.1f), true);
            // 바깥 보이지 않는 벽 넷
            float hx = GoAreas.HalfX, hz = GoAreas.HalfZ, h = GoAreas.WallHeight, t = 2f;
            var defs = new[]
            {
                (new Vector3(c0.x, h * 0.5f, c0.z - hz - t * 0.5f), new Vector3(hx * 2f + t * 2f, h, t)),
                (new Vector3(c0.x, h * 0.5f, c0.z + hz + t * 0.5f), new Vector3(hx * 2f + t * 2f, h, t)),
                (new Vector3(c0.x - hx - t * 0.5f, h * 0.5f, c0.z), new Vector3(t, h, hz * 2f)),
                (new Vector3(c0.x + hx + t * 0.5f, h * 0.5f, c0.z), new Vector3(t, h, hz * 2f)),
            };
            int i = 0;
            foreach (var (pos, size) in defs)
            {
                var go = new GameObject("Area_wall" + i++);
                go.transform.SetParent(root.transform, false);
                go.transform.position = pos;
                go.AddComponent<BoxCollider>().size = size;
                go.AddComponent<NoClimb>();
            }
            foreach (var s in a.Sites) _sites[s.Key] = BuildSite(root.transform, a, s);
            if (a.Id == "crossing") BuildRiftIsland(root.transform);
            if (a.Id == "sunken") BuildSunkenExtras(root.transform, a);
            // 돌기둥 — 지도 쪽(열린 뒤에만 보임) · 땅 쪽(경계비 곁)
            var stone = Mat("gate_stone", new Color(0.55f, 0.58f, 0.64f));
            var glow = Mat("gate_glow", new Color(0.7f, 0.55f, 1f), 2.5f);
            var gate = new GameObject("Area_gate");
            gate.transform.SetParent(root.transform, false);
            gate.transform.position = FolkWalker.Grounded(a.MapGate());
            Pillar(gate.transform, stone, glow);
            _gates[a.Id] = gate;
            var stele = new GameObject("Area_stele_gate");
            stele.transform.SetParent(root.transform, false);
            stele.transform.position = a.SteleGround;
            Pillar(stele.transform, stone, glow);
            _steles[a.Id] = stele;
            Refresh();
        }

        private static void Pillar(Transform t, Material stone, Material glow)
        {
            P(PrimitiveType.Cube, t, "Pillar", new Vector3(0f, 1.75f, 0f), new Vector3(1.2f, 3.5f, 1.2f), stone, true);
            P(PrimitiveType.Sphere, t, "PillarGlow", new Vector3(0f, 3.9f, 0f), Vector3.one * 0.9f, glow, false);
        }

        private GameObject BuildSite(Transform parent, GoAreas.Area a, GoAreas.Site s)
        {
            var root = new GameObject("Area_site_" + s.Id);
            root.transform.SetParent(parent, false);
            root.transform.position = s.Pos;
            if (a.Id == "skyport") BuildSkyportSite(root.transform, s.Id);
            else if (a.Id == "crossing") BuildCrossingSite(root.transform, s.Id);
            else if (a.Id == "sunken") BuildSunkenSite(root.transform, s.Id);
            return root;
        }

        private GameObject Part(string key, Transform parent, PrimitiveType t, string name, Vector3 local, Vector3 scale, Material m, bool collide, Vector3 euler = default)
        {
            var g = P(t, parent, name, local, scale, m, collide, euler);
            _parts[key] = g;
            return g;
        }

        // ---- 은하 나루 도형(웹 skyport.js 명소 모델을 이 판 크기로 옮긴 도형) ----
        private void BuildSkyportSite(Transform t, string id)
        {
            var stone = Mat("s_stone", new Color(0.5f, 0.5f, 0.52f));
            var dark = Mat("s_dark", new Color(0.14f, 0.15f, 0.19f));
            var metal = Mat("s_metal", new Color(0.66f, 0.7f, 0.76f), 0f, 0.65f, 0.6f);
            var rust = Mat("s_rust", new Color(0.42f, 0.24f, 0.15f), 0f, 0.1f);
            var wood = Mat("s_wood", new Color(0.36f, 0.25f, 0.16f));
            var glass = Mat("s_glass", new Color(0.55f, 0.8f, 0.95f), 0.4f, 0.8f);
            var glow = Mat("s_glow", new Color(0.55f, 0.85f, 1f), 2.4f);
            var solar = Mat("s_solar", new Color(0.12f, 0.2f, 0.42f), 0.2f, 0.8f, 0.3f);
            var bronze = Mat("s_bronze", new Color(0.62f, 0.45f, 0.2f), 0f, 0.5f, 0.4f);
            switch (id)
            {
                case "port": // 별배 나루 — 계류 탑(18m 기둥) + 꼭대기 빛 공 + 착륙판 + 부스
                    P(PrimitiveType.Cube, t, "Port_tower", new Vector3(0f, GoStory.TowerHeight * 0.5f, 0f), new Vector3(GoStory.TowerHalf * 2f, GoStory.TowerHeight, GoStory.TowerHalf * 2f), metal, true);
                    Part("skyport:beacon", t, PrimitiveType.Sphere, "Port_beacon", new Vector3(0f, GoStory.TowerHeight + 1.2f, 0f), Vector3.one * 1.6f, Mat("s_beacon_off", new Color(0.25f, 0.28f, 0.32f)), false);
                    // 매인 별배 — 착륙판 위 6m 에 수평으로 떠 있다(그림만, 밑은 비어 지나간다). 16장 7째 단계부터.
                    var ship = new GameObject("Port_ship");
                    ship.transform.SetParent(t, false);
                    ship.transform.localPosition = new Vector3(0f, GoStory.ShipUp + 1.5f, 6f);
                    P(PrimitiveType.Sphere, ship.transform, "Ship_hull", Vector3.zero, new Vector3(26f, 7f, 8f), metal, false);
                    P(PrimitiveType.Cube, ship.transform, "Ship_fin", new Vector3(-12.5f, 3f, 0f), new Vector3(3f, 5f, 0.4f), metal, false);
                    P(PrimitiveType.Cube, ship.transform, "Ship_wing", new Vector3(-1f, -0.5f, 0f), new Vector3(9f, 0.4f, 24f), metal, false);
                    P(PrimitiveType.Sphere, ship.transform, "Ship_glow", new Vector3(11f, 0.5f, 0f), new Vector3(2.4f, 2f, 3f), glow, false);
                    _parts["skyport:ship"] = ship;
                    P(PrimitiveType.Cylinder, t, "Port_pave", new Vector3(0f, 0.03f, 6f), new Vector3(28f, 0.03f, 28f), Mat("s_pave", new Color(0.32f, 0.34f, 0.38f), 0f, 0.5f), false);
                    P(PrimitiveType.Cylinder, t, "Port_pad", new Vector3(0f, 0.1f, 6f), new Vector3(18f, 0.1f, 18f), metal, false);
                    P(PrimitiveType.Cube, t, "Port_booth", new Vector3(14f, 1.6f, 4f), new Vector3(3.4f, 3.2f, 3.4f), glass, false);
                    P(PrimitiveType.Cube, t, "Port_booth_roof", new Vector3(14f, 3.4f, 4f), new Vector3(4f, 0.3f, 4f), dark, false);
                    break;
                case "temple": // 옛 절터 — 돌 기단 + 부러진 기둥 넷 + 석등
                    P(PrimitiveType.Cube, t, "Temple_base", new Vector3(0f, 0.3f, 0f), new Vector3(16f, 0.6f, 16f), stone, false);
                    for (int i = 0; i < 4; i++)
                    {
                        float x = (i % 2 == 0 ? -5.5f : 5.5f), z = (i < 2 ? -5.5f : 5.5f), h = 2.5f + (i * 5 % 3) * 1f;
                        P(PrimitiveType.Cylinder, t, "Temple_pillar", new Vector3(x, 0.6f + h * 0.5f, z), new Vector3(1.2f, h * 0.5f, 1.2f), stone, false);
                    }
                    P(PrimitiveType.Cube, t, "Temple_lantern_base", new Vector3(0f, 1.1f, 0f), new Vector3(1.2f, 1f, 1.2f), stone, false);
                    P(PrimitiveType.Cube, t, "Temple_lantern", new Vector3(0f, 2.0f, 0f), new Vector3(1.6f, 0.9f, 1.6f), stone, false);
                    // 종각 — 동쪽 10m, 돌 기단 4m 벽 + 기둥 넷 + 들보 + 지붕(종은 17장 뒤에 걸린다)
                    P(PrimitiveType.Cube, t, "Belfry_base", new Vector3(10f, 0.5f, 0f), new Vector3(4f, 1f, 4f), stone, true);
                    foreach (var (dx, dz) in new[] { (-1.6f, -1.6f), (1.6f, -1.6f), (-1.6f, 1.6f), (1.6f, 1.6f) })
                        P(PrimitiveType.Cylinder, t, "Belfry_post", new Vector3(10f + dx, 3f, dz), new Vector3(0.35f, 2f, 0.35f), wood, false);
                    P(PrimitiveType.Cube, t, "Belfry_beam", new Vector3(10f, 4.6f, 0f), new Vector3(4.2f, 0.35f, 0.35f), wood, false);
                    P(PrimitiveType.Cube, t, "Belfry_roof", new Vector3(10f, 5.4f, 0f), new Vector3(5.4f, 0.4f, 5.4f), dark, false, new Vector3(0f, 0f, 0f));
                    Part("skyport:bell", t, PrimitiveType.Cylinder, "Belfry_bell", new Vector3(10f, 3.6f, 0f), new Vector3(1.6f, 0.8f, 1.6f), bronze, false);
                    Part("skyport:bell_hidden", t, PrimitiveType.Sphere, "Belfry_bell_tip", new Vector3(10f, 4.4f, 0f), new Vector3(0.6f, 0.4f, 0.6f), bronze, false);
                    break;
                case "station": // 은하역 — 승강장 + 선로 둘 + 녹슨 객차 + 표지판
                    // 선로가 남쪽(+z)으로 뻗는다(잔상 쫓기 길) — 승강장 7×40, 선로 둘 서쪽, 객차는 선로 위 북쪽 끝에서 남으로
                    P(PrimitiveType.Cube, t, "Station_platform", new Vector3(0f, 0.45f, 0f), new Vector3(7f, 0.9f, 40f), stone, true);
                    P(PrimitiveType.Cube, t, "Station_rail_a", new Vector3(-6f, 0.12f, 30f), new Vector3(0.4f, 0.24f, 160f), dark, false);
                    P(PrimitiveType.Cube, t, "Station_rail_b", new Vector3(-8f, 0.12f, 30f), new Vector3(0.4f, 0.24f, 160f), dark, false);
                    P(PrimitiveType.Cube, t, "Station_car", new Vector3(-7f, 2.5f, 0f), new Vector3(3.2f, 3.4f, 18f), rust, false);
                    Part("skyport:train_windows", t, PrimitiveType.Cube, "Station_car_windows", new Vector3(-5.38f, 3.0f, 0f), new Vector3(0.1f, 1f, 15f), glass, false);
                    Part("skyport:train_lamp_a", t, PrimitiveType.Sphere, "Station_lamp_a", new Vector3(-6.4f, 2.0f, 9.2f), Vector3.one * 0.6f, Mat("s_lamp_off", new Color(0.22f, 0.22f, 0.22f)), false);
                    Part("skyport:train_lamp_b", t, PrimitiveType.Sphere, "Station_lamp_b", new Vector3(-7.6f, 2.0f, 9.2f), Vector3.one * 0.6f, Mat("s_lamp_off", new Color(0.22f, 0.22f, 0.22f)), false);
                    P(PrimitiveType.Cube, t, "Station_sign_post", new Vector3(2.5f, 2.2f, 14f), new Vector3(0.3f, 4.4f, 0.3f), dark, false);
                    P(PrimitiveType.Cube, t, "Station_sign", new Vector3(2.5f, 4.2f, 14f), new Vector3(0.2f, 1f, 3.6f), Mat("s_sign", new Color(0.2f, 0.45f, 0.35f), 0.4f), false);
                    break;
                case "farm": // 태양광 밭 — 판 3줄 × 5 + 동쪽 변전함
                    for (int r = 0; r < 3; r++)
                        for (int k = 0; k < 5; k++)
                        {
                            float x = -12f + k * 6f, z = -8f + r * 6f;
                            P(PrimitiveType.Cube, t, "Farm_panel", new Vector3(x, 1.6f, z), new Vector3(5.2f, 0.18f, 3.4f), solar, false, new Vector3(-25f, 0f, 0f));
                            P(PrimitiveType.Cube, t, "Farm_leg", new Vector3(x, 0.8f, z), new Vector3(0.25f, 1.6f, 0.25f), dark, false);
                        }
                    P(PrimitiveType.Cube, t, "Farm_substation", new Vector3(GoStory.SubstationOff.x, 1.6f, GoStory.SubstationOff.y), new Vector3(3f, 3.2f, 2.6f), metal, true);
                    Part("skyport:substation_lamp", t, PrimitiveType.Sphere, "Farm_substation_lamp", new Vector3(GoStory.SubstationOff.x, 3.5f, GoStory.SubstationOff.y - 1.35f), Vector3.one * 0.5f, Mat("s_lamp_red", new Color(0.85f, 0.15f, 0.12f), 2f), false);
                    break;
                case "gate": // 틈 고개 경계비
                    P(PrimitiveType.Cube, t, "Gate_stele", new Vector3(0f, 2.5f, 0f), new Vector3(1.6f, 5f, 1f), stone, true);
                    P(PrimitiveType.Sphere, t, "Gate_glow", new Vector3(0f, 5.6f, 0f), Vector3.one * 1.1f, glow, false);
                    break;
                case "courier": // 멈춘 배달 기계
                    P(PrimitiveType.Sphere, t, "Courier_body", new Vector3(0f, 1.1f, 0f), new Vector3(1.4f, 1.1f, 1.4f), metal, false);
                    P(PrimitiveType.Sphere, t, "Courier_eye", new Vector3(0f, 1.2f, 0.65f), new Vector3(0.4f, 0.3f, 0.2f), glow, false);
                    break;
                case "bell": // 떨어진 절 종 — 누운 종 + 나무 틀
                    Part("skyport:bell_fallen", t, PrimitiveType.Cylinder, "Bell_fallen", new Vector3(0f, 0.7f, 0f), new Vector3(1.4f, 1f, 1.4f), bronze, false, new Vector3(0f, 0f, 90f));
                    P(PrimitiveType.Cube, t, "Bell_frame_a", new Vector3(-2f, 1.2f, 0f), new Vector3(0.3f, 2.4f, 0.3f), wood, false, new Vector3(0f, 0f, 12f));
                    P(PrimitiveType.Cube, t, "Bell_frame_b", new Vector3(2f, 1.2f, 0f), new Vector3(0.3f, 2.4f, 0.3f), wood, false, new Vector3(0f, 0f, -12f));
                    break;
                case "phone":
                    P(PrimitiveType.Cube, t, "Phone_booth", new Vector3(0f, 1.2f, 0f), new Vector3(1.2f, 2.4f, 1.2f), glass, false);
                    P(PrimitiveType.Cube, t, "Phone_roof", new Vector3(0f, 2.5f, 0f), new Vector3(1.4f, 0.2f, 1.4f), dark, false);
                    break;
                case "capsule":
                    P(PrimitiveType.Sphere, t, "Capsule_mound", new Vector3(0f, 0.2f, 0f), new Vector3(3f, 0.9f, 3f), Mat("s_soil", new Color(0.3f, 0.26f, 0.2f)), false);
                    P(PrimitiveType.Cylinder, t, "Capsule_lid", new Vector3(0f, 0.62f, 0f), new Vector3(1f, 0.08f, 1f), metal, false);
                    break;
                case "cairn":
                    for (int i = 0; i < 3; i++) P(PrimitiveType.Sphere, t, "Cairn_stone", new Vector3(0f, 0.4f + i * 0.55f, 0f), new Vector3(1.6f - i * 0.4f, 0.6f, 1.6f - i * 0.4f), stone, false);
                    break;
                case "sign":
                    P(PrimitiveType.Cube, t, "Sign_post", new Vector3(0f, 1.4f, 0f), new Vector3(0.22f, 2.8f, 0.22f), wood, false);
                    P(PrimitiveType.Cube, t, "Sign_board_a", new Vector3(0.7f, 2.4f, 0f), new Vector3(1.6f, 0.4f, 0.1f), wood, false, new Vector3(0f, 0f, 8f));
                    P(PrimitiveType.Cube, t, "Sign_board_b", new Vector3(-0.7f, 1.8f, 0f), new Vector3(1.6f, 0.4f, 0.1f), wood, false, new Vector3(0f, 0f, -8f));
                    break;
                case "crate":
                    P(PrimitiveType.Cube, t, "Crate_box", new Vector3(0f, 0.7f, 0f), new Vector3(2f, 1.4f, 1.4f), metal, false, new Vector3(0f, 20f, 0f));
                    P(PrimitiveType.Cube, t, "Crate_stripe", new Vector3(0f, 0.7f, 0f), new Vector3(2.05f, 0.3f, 1.45f), Mat("s_stripe", new Color(0.9f, 0.6f, 0.1f)), false, new Vector3(0f, 20f, 0f));
                    break;
                case "busstop":
                    P(PrimitiveType.Cube, t, "Bus_roof", new Vector3(0f, 2.6f, 0f), new Vector3(4f, 0.2f, 1.6f), dark, false);
                    P(PrimitiveType.Cube, t, "Bus_post_a", new Vector3(-1.8f, 1.3f, -0.6f), new Vector3(0.15f, 2.6f, 0.15f), dark, false);
                    P(PrimitiveType.Cube, t, "Bus_post_b", new Vector3(1.8f, 1.3f, -0.6f), new Vector3(0.15f, 2.6f, 0.15f), dark, false);
                    P(PrimitiveType.Cube, t, "Bus_bench", new Vector3(0f, 0.5f, -0.6f), new Vector3(2.6f, 0.15f, 0.6f), wood, false);
                    break;
                case "jar":
                    P(PrimitiveType.Sphere, t, "Jar_body", new Vector3(0f, 0.7f, 0f), new Vector3(1.3f, 1.4f, 1.3f), Mat("s_jar", new Color(0.48f, 0.3f, 0.18f)), false);
                    P(PrimitiveType.Cylinder, t, "Jar_neck", new Vector3(0f, 1.5f, 0f), new Vector3(0.5f, 0.25f, 0.5f), Mat("s_jar", new Color(0.48f, 0.3f, 0.18f)), false);
                    break;
                case "antenna":
                    P(PrimitiveType.Cylinder, t, "Antenna_mast", new Vector3(0f, 4f, 0f), new Vector3(0.16f, 4f, 0.16f), rust, false);
                    P(PrimitiveType.Cube, t, "Antenna_bar_a", new Vector3(0f, 6f, 0f), new Vector3(2.4f, 0.1f, 0.1f), rust, false);
                    P(PrimitiveType.Cube, t, "Antenna_bar_b", new Vector3(0f, 7f, 0f), new Vector3(1.6f, 0.1f, 0.1f), rust, false, new Vector3(0f, 40f, 0f));
                    break;
            }
        }

        // ---- 갈림길 끝 섬(웹 ⑲-43) — 첫 정거장 동남쪽 하늘에 뜬 돌 섬 + 세 갈래 선로(끝마다 닻) + 세로 틈 + 별빛 + 바람 기둥(20장이 끝난 뒤) ----
        private PlayerController.DraftCol _riftCol;
        private bool _riftRegistered;
        private GameObject _riftRings;
        private readonly List<LineRenderer> _riftRingList = new List<LineRenderer>();
        private float _riftT;
        public bool RiftPillarOpen { get; private set; }
        public int TearNow { get; private set; }

        private void BuildRiftIsland(Transform parent)
        {
            var stone = Mat("c_stone", new Color(0.52f, 0.5f, 0.55f));
            var dark = Mat("c_dark", new Color(0.15f, 0.14f, 0.2f));
            var metal = Mat("c_metal", new Color(0.66f, 0.68f, 0.76f), 0f, 0.65f, 0.6f);
            var wood = Mat("c_wood", new Color(0.36f, 0.25f, 0.16f));
            var glow = Mat("c_glow", new Color(0.72f, 0.55f, 1f), 2.6f);
            var root = new GameObject("Area_rift_island");
            root.transform.SetParent(parent, false);
            Vector3 c = GoStory.RiftCenter;
            float r = GoStory.RiftR;
            var disc = P(PrimitiveType.Cylinder, root.transform, "Rift_disc", c - Vector3.up * 1.5f, new Vector3(r * 2f, 1.5f, r * 2f), stone, true);
            disc.AddComponent<NoClimb>();
            P(PrimitiveType.Sphere, root.transform, "Rift_horn", c - Vector3.up * 11f, new Vector3(r * 1.2f, 16f, r * 1.2f), stone, false);
            const int seg = 28;
            float rr = r - 0.7f, len = 2f * Mathf.PI * rr / seg + 0.2f;
            for (int i = 0; i < seg; i++)
            {
                float a = (i + 0.5f) * Mathf.PI * 2f / seg;
                var w = P(PrimitiveType.Cube, root.transform, "Rift_rail", c + new Vector3(Mathf.Sin(a) * rr, GoStory.SkyRail * 0.5f, Mathf.Cos(a) * rr), new Vector3(len, GoStory.SkyRail, 0.5f), stone, true, new Vector3(0f, a * Mathf.Rad2Deg + 90f, 0f));
                w.AddComponent<NoClimb>();
            }
            // 세 갈래 선로 — 가운데 3m 에서 17m 까지, 끝마다 닻(빛 공)
            var branches = new[] { ("wood", 60f, wood), ("iron", 300f, metal), ("light", 180f, glow) };
            int bi = 0;
            foreach (var (id, deg, mat) in branches)
            {
                float a = deg * Mathf.Deg2Rad;
                Vector3 dir = new Vector3(Mathf.Sin(a), 0f, -Mathf.Cos(a));
                float yaw = deg;
                P(PrimitiveType.Cube, root.transform, "Rift_rail_" + id + "_a", c + dir * 10f + Vector3.up * 0.1f + Quaternion.Euler(0f, yaw, 0f) * Vector3.left * 0.7f, new Vector3(0.3f, 0.2f, 14f), mat, false, new Vector3(0f, yaw, 0f));
                P(PrimitiveType.Cube, root.transform, "Rift_rail_" + id + "_b", c + dir * 10f + Vector3.up * 0.1f + Quaternion.Euler(0f, yaw, 0f) * Vector3.right * 0.7f, new Vector3(0.3f, 0.2f, 14f), mat, false, new Vector3(0f, yaw, 0f));
                Part("crossing:anchor" + bi, root.transform, PrimitiveType.Sphere, "Rift_anchor_" + id, c + dir * 17f + Vector3.up * 1.0f, Vector3.one * 1.4f, Mat("c_anchor_off", new Color(0.25f, 0.25f, 0.3f)), false);
                bi++;
            }
            // 세로 틈 — 가운데 위에 서 있는 빛 판 둘(닫히면 사라지고 별빛)
            var tear = new GameObject("Rift_tear");
            tear.transform.SetParent(root.transform, false);
            P(PrimitiveType.Cube, tear.transform, "Rift_tear_a", c + Vector3.up * 8f, new Vector3(0.2f, 14f, 6f), glow, false, new Vector3(0f, 20f, 0f));
            P(PrimitiveType.Cube, tear.transform, "Rift_tear_b", c + new Vector3(0.4f, 8.5f, 0f), new Vector3(0.14f, 12f, 4f), glow, false, new Vector3(0f, 100f, 0f));
            _parts["crossing:tear"] = tear;
            var stars = new GameObject("Rift_stars");
            stars.transform.SetParent(root.transform, false);
            var starMat = Mat("c_star", new Color(1f, 0.95f, 0.75f), 3.2f);
            for (int i = 0; i < 9; i++)
            {
                float a = i * 2.4f;
                P(PrimitiveType.Sphere, stars.transform, "Rift_star", c + new Vector3(Mathf.Cos(a) * (2f + i * 0.5f), 6f + (i % 4) * 2.2f, Mathf.Sin(a) * (2f + i * 0.5f)), Vector3.one * 0.35f, starMat, false);
            }
            _parts["crossing:stars"] = stars;
            // 바람 기둥 고리 여덟(20장이 끝난 뒤)
            _riftRings = new GameObject("Rift_rings");
            _riftRings.transform.SetParent(root.transform, false);
            _riftRingList.Clear();
            var lineMat = new Material(Shader.Find("Sprites/Default")) { name = "RiftPillar (generated)" };
            for (int i = 0; i < 8; i++)
            {
                var go = new GameObject("Rift_ring");
                go.transform.SetParent(_riftRings.transform, false);
                var lr = go.AddComponent<LineRenderer>();
                lr.useWorldSpace = false;
                lr.loop = true;
                lr.positionCount = 32;
                lr.widthMultiplier = 0.25f;
                lr.material = lineMat;
                lr.startColor = lr.endColor = new Color(0.85f, 0.75f, 1f, 0.6f);
                lr.shadowCastingMode = UnityEngine.Rendering.ShadowCastingMode.Off;
                for (int k = 0; k < 32; k++)
                {
                    float a = k * Mathf.PI * 2f / 32f;
                    lr.SetPosition(k, new Vector3(Mathf.Cos(a) * GoStory.DraftR, 0f, Mathf.Sin(a) * GoStory.DraftR));
                }
                _riftRingList.Add(lr);
            }
            Physics.SyncTransforms();
        }

        private void RefreshRift()
        {
            int tear = StoryState.OffForTest ? 0 : GoStory.TearState;
            TearNow = tear;
            if (_parts.TryGetValue("crossing:tear", out var t) && t != null)
            {
                t.SetActive(tear < 2);
                t.transform.localScale = tear == 1 ? new Vector3(1f, 1f, 0.45f) : Vector3.one;
            }
            if (_parts.TryGetValue("crossing:stars", out var st) && st != null) st.SetActive(tear >= 2);
            for (int i = 0; i < 3; i++)
                SetMat("crossing:anchor" + i, tear >= 1 ? Mat("c_anchor_on", new Color(1f, 0.9f, 0.5f), 3f) : Mat("c_anchor_off", new Color(0.25f, 0.25f, 0.3f)));
            bool open = !StoryState.OffForTest && GoStory.RiftPillarOpen;
            RiftPillarOpen = open;
            if (_riftRings != null) _riftRings.SetActive(open);
            if (_riftRegistered) PlayerController.ExtraDrafts.Remove(_riftCol);
            _riftRegistered = false;
            if (open)
            {
                _riftCol = new PlayerController.DraftCol { Base = GoStory.RiftPillarPos, R = GoStory.DraftR, Top = GoStory.RiftDraftTop };
                PlayerController.ExtraDrafts.Add(_riftCol);
                _riftRegistered = true;
            }
        }

        private void TickRiftRings(float dt)
        {
            if (_riftRings == null || !_riftRings.activeSelf) return;
            _riftT += dt;
            Vector3 b = GoStory.RiftPillarPos;
            float h = GoStory.RiftDraftTop - b.y;
            for (int i = 0; i < _riftRingList.Count; i++)
            {
                float f = Mathf.Repeat(_riftT * GoStory.DraftRise / h + i / (float)_riftRingList.Count, 1f);
                _riftRingList[i].transform.position = b + Vector3.up * (f * h);
            }
        }

        // ---- 잠긴 도읍 도형(웹 sunken.js 명소 모델을 이 판 크기로) — 땅 전체가 얕은 물(투명 판)에 잠긴 모습 ----
        private void BuildSunkenExtras(Transform parent, GoAreas.Area a)
        {
            var waterMat = new Material(Shader.Find("Sprites/Default")) { name = "SunkenWater (generated)", color = new Color(0.32f, 0.62f, 0.78f, 0.42f) };
            var water = GameObject.CreatePrimitive(PrimitiveType.Cube);
            water.name = "Sunken_water";
            Destroy(water.GetComponent<Collider>());
            water.transform.SetParent(parent, false);
            water.transform.position = a.Center + new Vector3(0f, GoStory.SeaLevel, 0f);
            water.transform.localScale = new Vector3(GoAreas.HalfX * 2f, 0.02f, GoAreas.HalfZ * 2f);
            water.GetComponent<MeshRenderer>().sharedMaterial = waterMat;
            water.GetComponent<MeshRenderer>().shadowCastingMode = UnityEngine.Rendering.ShadowCastingMode.Off;
            // 궁궐 둘레 불 켜진 테왁 여덟(20장을 마친 뒤 — 5부 끝에 밝혀진다)
            var lamp = Mat("u_lamp", new Color(1f, 0.85f, 0.45f), 3f);
            var lampOff = Mat("u_lamp_off", new Color(0.3f, 0.28f, 0.25f));
            a.TrySite("palace", out var palace);
            var lights = new GameObject("Sunken_sealights");
            lights.transform.SetParent(parent, false);
            for (int i = 0; i < GoStory.SeaLights; i++)
            {
                float ang = i * Mathf.PI * 2f / GoStory.SeaLights;
                P(PrimitiveType.Sphere, lights.transform, "Sea_light", palace.Pos + new Vector3(Mathf.Cos(ang) * GoStory.SeaLightR, 0.5f, Mathf.Sin(ang) * GoStory.SeaLightR), Vector3.one * 0.7f, lamp, false);
            }
            _parts["sunken:sealights"] = lights;
        }

        private void BuildSunkenSite(Transform t, string id)
        {
            var stone = Mat("u_stone", new Color(0.52f, 0.53f, 0.55f));
            var dark = Mat("u_dark", new Color(0.13f, 0.16f, 0.2f));
            var metal = Mat("u_metal", new Color(0.66f, 0.72f, 0.78f), 0f, 0.65f, 0.6f);
            var rust = Mat("u_rust", new Color(0.42f, 0.27f, 0.18f), 0f, 0.1f);
            var wood = Mat("u_wood", new Color(0.4f, 0.3f, 0.2f));
            var glass = Mat("u_glass", new Color(0.6f, 0.85f, 0.95f), 0.4f, 0.8f);
            var glow = Mat("u_glow", new Color(0.65f, 0.9f, 1f), 2.4f);
            var yellow = Mat("u_yellow", new Color(0.9f, 0.72f, 0.12f), 0f, 0.4f);
            var pearlM = Mat("u_pearl", new Color(0.95f, 0.93f, 0.9f), 0.3f, 0.8f);
            switch (id)
            {
                case "palace": // 잠긴 궁궐 — 기운 정전 + 반쯤 잠긴 돌계단 + 기단 + 동쪽 곁채(22장)
                    P(PrimitiveType.Cube, t, "Palace_plinth", new Vector3(0f, 0.4f, 0f), new Vector3(20f, 0.8f, 16f), stone, true);
                    P(PrimitiveType.Cube, t, "Palace_hall", new Vector3(0f, 3.4f, -2f), new Vector3(13f, 5f, 8f), rust, false, new Vector3(0f, 0f, 6f));
                    P(PrimitiveType.Cube, t, "Palace_roof", new Vector3(0f, 6.6f, -2f), new Vector3(15f, 0.9f, 10f), dark, false, new Vector3(0f, 0f, 6f));
                    for (int i = 0; i < 5; i++) P(PrimitiveType.Cube, t, "Palace_step", new Vector3(0f, 0.15f + i * 0.15f, 8.6f + (4 - i) * 0.7f), new Vector3(7f, 0.3f, 0.7f), stone, true);
                    P(PrimitiveType.Cube, t, "Palace_annex", new Vector3(GoStory.AnnexOff.x, 2f, GoStory.AnnexOff.y - 3f), new Vector3(5f, 4f, 4f), rust, false);
                    P(PrimitiveType.Cube, t, "Palace_annex_roof", new Vector3(GoStory.AnnexOff.x, 4.4f, GoStory.AnnexOff.y - 3f), new Vector3(6f, 0.6f, 5f), dark, false);
                    break;
                case "lab": // 해저 연구 기지 — 컨테이너 + 관제실 + 잔교 + 노란 잠수정
                    P(PrimitiveType.Cube, t, "Lab_container_a", new Vector3(-6f, 1.4f, -6f), new Vector3(6f, 2.8f, 2.6f), metal, true);
                    P(PrimitiveType.Cube, t, "Lab_container_b", new Vector3(0f, 1.4f, -6f), new Vector3(6f, 2.8f, 2.6f), rust, true);
                    P(PrimitiveType.Cube, t, "Lab_control", new Vector3(6f, 2f, -5f), new Vector3(4.6f, 4f, 4f), metal, true);
                    P(PrimitiveType.Cube, t, "Lab_control_glass", new Vector3(6f, 2.6f, -2.98f), new Vector3(3.6f, 1.2f, 0.1f), glass, false);
                    P(PrimitiveType.Cube, t, "Lab_pier", new Vector3(1f, 0.2f, 9f), new Vector3(3f, 0.3f, 16f), wood, false);
                    P(PrimitiveType.Sphere, t, "Lab_sub", new Vector3(4.5f, 0.2f, 14f), new Vector3(2.4f, 1.6f, 6f), yellow, false);
                    P(PrimitiveType.Sphere, t, "Lab_sub_window", new Vector3(4.5f, 0.6f, 11.4f), new Vector3(1.1f, 0.6f, 0.5f), glass, false);
                    break;
                case "dome": // 빛 돔 — 받침 고리 + 유리 반구(r11) + 둘레 열두 조각 벽(북쪽 한 조각이 문 — 22장 8째 단계부터 열림)
                    P(PrimitiveType.Cylinder, t, "Dome_floor", new Vector3(0f, 0.15f, 0f), new Vector3(GoStory.DomeR * 2f + 2f, 0.15f, GoStory.DomeR * 2f + 2f), metal, false);
                    var shell = P(PrimitiveType.Sphere, t, "Dome_shell", Vector3.zero, new Vector3(GoStory.DomeR * 2f, GoStory.DomeR * 2f, GoStory.DomeR * 2f), glass, false);
                    for (int i = 0; i < GoStory.DomeSegs; i++)
                    {
                        float ang = i * Mathf.PI * 2f / GoStory.DomeSegs;
                        float wx = Mathf.Sin(ang) * (GoStory.DomeR + 0.3f), wz = -Mathf.Cos(ang) * (GoStory.DomeR + 0.3f);
                        float wl = 2f * Mathf.PI * GoStory.DomeR / GoStory.DomeSegs + 0.2f;
                        var seg = P(PrimitiveType.Cube, t, i == 0 ? "Dome_door" : "Dome_wall", new Vector3(wx, 3f, wz), new Vector3(wl, 6f, 0.8f), i == 0 ? Mat("u_door", new Color(0.5f, 0.75f, 0.9f), 0.8f, 0.8f) : metal, true, new Vector3(0f, ang * Mathf.Rad2Deg, 0f));
                        seg.AddComponent<NoClimb>();
                        if (i == 0) _parts["sunken:dome_door"] = seg;
                    }
                    P(PrimitiveType.Cube, t, "Dome_terminal", new Vector3(GoStory.Term.x, 1f, GoStory.Term.y), new Vector3(1.4f, 2f, 1f), metal, false);
                    P(PrimitiveType.Cube, t, "Dome_terminal_screen", new Vector3(GoStory.Term.x, 1.5f, GoStory.Term.y - 0.52f), new Vector3(1f, 0.6f, 0.05f), glow, false);
                    break;
                case "lighthouse": // 옛 등대 — 15m 돌탑(옆면 타기) + 등롱(23장 3째 단계 뒤 불) + 빛줄기
                    P(PrimitiveType.Cube, t, "Light_base", new Vector3(0f, 0.6f, 0f), new Vector3(9f, 1.2f, 9f), stone, true);
                    P(PrimitiveType.Cube, t, "Light_tower", new Vector3(0f, GoStory.LightHeight * 0.5f, 0f), new Vector3(GoStory.LightHalf * 2f, GoStory.LightHeight, GoStory.LightHalf * 2f), stone, true);
                    Part("sunken:lantern", t, PrimitiveType.Sphere, "Light_lantern", new Vector3(0f, GoStory.LightHeight + 1.2f, 0f), Vector3.one * 1.8f, Mat("u_lantern_off", new Color(0.25f, 0.28f, 0.3f)), false);
                    Part("sunken:beam", t, PrimitiveType.Cube, "Light_beam", new Vector3(0f, GoStory.LightHeight + 1.2f, 9f), new Vector3(1.2f, 0.6f, 18f), Mat("u_beam", new Color(1f, 0.95f, 0.7f), 2.4f), false);
                    break;
                case "gate": // 해무 어귀 경계비
                    P(PrimitiveType.Cube, t, "Gate_stele", new Vector3(0f, 2.5f, 0f), new Vector3(1.6f, 5f, 1f), stone, true);
                    P(PrimitiveType.Sphere, t, "Gate_glow", new Vector3(0f, 5.6f, 0f), Vector3.one * 1.1f, glow, false);
                    break;
                case "tewak":
                    P(PrimitiveType.Sphere, t, "Tewak_gourd", new Vector3(0f, 0.4f, 0f), new Vector3(0.9f, 0.7f, 0.9f), Mat("u_gourd", new Color(0.88f, 0.78f, 0.5f)), false);
                    P(PrimitiveType.Cylinder, t, "Tewak_neck", new Vector3(0f, 0.85f, 0f), new Vector3(0.25f, 0.15f, 0.25f), wood, false);
                    break;
                case "helmet":
                    P(PrimitiveType.Sphere, t, "Helmet_dome", new Vector3(0f, 0.5f, 0f), new Vector3(1.1f, 0.95f, 1.1f), rust, false);
                    P(PrimitiveType.Sphere, t, "Helmet_visor", new Vector3(0f, 0.55f, 0.45f), new Vector3(0.6f, 0.4f, 0.3f), glass, false);
                    break;
                case "supply":
                    P(PrimitiveType.Cube, t, "Supply_box", new Vector3(0f, 0.7f, 0f), new Vector3(2f, 1.4f, 1.4f), metal, false, new Vector3(0f, 25f, 0f));
                    P(PrimitiveType.Cube, t, "Supply_band", new Vector3(0f, 0.7f, 0f), new Vector3(2.05f, 0.25f, 1.45f), yellow, false, new Vector3(0f, 25f, 0f));
                    break;
                case "pearl":
                    P(PrimitiveType.Sphere, t, "Pearl_shell_a", new Vector3(0f, 0.3f, 0f), new Vector3(1.6f, 0.4f, 1.3f), Mat("u_shell", new Color(0.88f, 0.8f, 0.75f)), false);
                    P(PrimitiveType.Sphere, t, "Pearl_pearl", new Vector3(0f, 0.55f, 0f), Vector3.one * 0.45f, pearlM, false);
                    break;
                case "buoy":
                    P(PrimitiveType.Sphere, t, "Buoy_ball", new Vector3(0f, 0.6f, 0f), Vector3.one * 1.2f, Mat("u_buoy", new Color(0.9f, 0.3f, 0.15f)), false);
                    P(PrimitiveType.Cylinder, t, "Buoy_pole", new Vector3(0f, 1.9f, 0f), new Vector3(0.12f, 1.2f, 0.12f), dark, false);
                    break;
                case "turtle":
                    P(PrimitiveType.Sphere, t, "Turtle_shell", new Vector3(0f, 0.6f, 0f), new Vector3(2.4f, 1f, 1.8f), stone, false);
                    P(PrimitiveType.Cube, t, "Turtle_stele", new Vector3(0f, 1.9f, 0f), new Vector3(1.1f, 1.8f, 0.3f), stone, false);
                    break;
                case "plaque":
                    P(PrimitiveType.Cube, t, "Plaque_board", new Vector3(0f, 0.3f, 0f), new Vector3(3f, 0.25f, 1.2f), wood, false, new Vector3(0f, 30f, 8f));
                    break;
                case "haetae":
                    P(PrimitiveType.Cube, t, "Haetae_base", new Vector3(0f, 0.5f, 0f), new Vector3(1.6f, 1f, 1.6f), stone, false);
                    P(PrimitiveType.Sphere, t, "Haetae_body", new Vector3(0f, 1.6f, 0f), new Vector3(1.3f, 1.2f, 1.8f), stone, false);
                    P(PrimitiveType.Sphere, t, "Haetae_head", new Vector3(0f, 2.1f, 0.9f), Vector3.one * 0.9f, stone, false);
                    break;
                case "jelly":
                    P(PrimitiveType.Sphere, t, "Jelly_bell", new Vector3(0f, 1.8f, 0f), new Vector3(1.6f, 1f, 1.6f), glow, false);
                    for (int i = 0; i < 4; i++) P(PrimitiveType.Cylinder, t, "Jelly_tentacle", new Vector3(Mathf.Cos(i * 1.57f) * 0.5f, 0.9f, Mathf.Sin(i * 1.57f) * 0.5f), new Vector3(0.08f, 0.8f, 0.08f), glow, false);
                    break;
                case "drone":
                    P(PrimitiveType.Sphere, t, "Drone_body", new Vector3(0f, 1f, 0f), new Vector3(1.4f, 0.8f, 1.8f), metal, false);
                    P(PrimitiveType.Sphere, t, "Drone_eye", new Vector3(0f, 1.05f, 0.85f), new Vector3(0.4f, 0.3f, 0.2f), glow, false);
                    P(PrimitiveType.Cube, t, "Drone_fin", new Vector3(0f, 1f, -1.1f), new Vector3(1.6f, 0.08f, 0.5f), dark, false);
                    break;
            }
        }

        // ---- 틈새 갈림길 도형(웹 crossing.js 명소 모델을 이 판 크기로) ----
        private void BuildCrossingSite(Transform t, string id)
        {
            var stone = Mat("c_stone", new Color(0.52f, 0.5f, 0.55f));
            var dark = Mat("c_dark", new Color(0.15f, 0.14f, 0.2f));
            var metal = Mat("c_metal", new Color(0.66f, 0.68f, 0.76f), 0f, 0.65f, 0.6f);
            var rust = Mat("c_rust", new Color(0.42f, 0.25f, 0.16f), 0f, 0.1f);
            var wood = Mat("c_wood", new Color(0.36f, 0.25f, 0.16f));
            var glassM = Mat("c_glass", new Color(0.7f, 0.6f, 0.95f), 0.5f, 0.8f);
            var glow = Mat("c_glow", new Color(0.72f, 0.55f, 1f), 2.6f);
            var clay = Mat("c_clay", new Color(0.35f, 0.3f, 0.3f));
            switch (id)
            {
                case "platform": // 첫 정거장 — 선로 남북 60m · 승강장 · 빛 지붕 · 역명판 · 차막이
                    P(PrimitiveType.Cube, t, "Plat_rail_a", new Vector3(-1.4f, 0.12f, 0f), new Vector3(0.4f, 0.24f, 60f), dark, false);
                    P(PrimitiveType.Cube, t, "Plat_rail_b", new Vector3(1.4f, 0.12f, 0f), new Vector3(0.4f, 0.24f, 60f), dark, false);
                    P(PrimitiveType.Cube, t, "Plat_platform", new Vector3(PlatOff, 0.45f, 0f), new Vector3(5f, 0.9f, 44f), stone, true);
                    P(PrimitiveType.Cube, t, "Plat_roof", new Vector3(PlatOff, 4.4f, 0f), new Vector3(6f, 0.25f, 44f), glassM, false);
                    for (int i = 0; i < 6; i++) P(PrimitiveType.Cylinder, t, "Plat_post", new Vector3(PlatOff + 2f, 2.6f, -20f + i * 8f), new Vector3(0.3f, 1.8f, 0.3f), metal, false);
                    P(PrimitiveType.Cube, t, "Plat_nameplate", new Vector3(PlatOff + 2.6f, 2.4f, -6f), new Vector3(0.1f, 0.9f, 4f), Mat("c_paper", new Color(0.92f, 0.88f, 0.78f), 0.2f), false);
                    P(PrimitiveType.Cube, t, "Plat_timetable", new Vector3(PlatOff + 2.6f, 2.0f, 6f), new Vector3(0.1f, 1.4f, 2.4f), Mat("c_paper", new Color(0.92f, 0.88f, 0.78f), 0.2f), false);
                    P(PrimitiveType.Cube, t, "Plat_bumper", new Vector3(0f, 0.7f, 30.4f), new Vector3(3f, 1.4f, 0.8f), rust, true);
                    break;
                case "tgate": // 뒤엉킨 성문 — 기운 누각 + 문 기둥 둘 + 떠 있는 성벽 조각 넷
                    P(PrimitiveType.Cube, t, "TGate_pillar_l", new Vector3(-3f, 3.5f, 0f), new Vector3(2f, 7f, 2.4f), stone, true);
                    P(PrimitiveType.Cube, t, "TGate_pillar_r", new Vector3(3f, 3.5f, 0f), new Vector3(2f, 7f, 2.4f), stone, true);
                    P(PrimitiveType.Cube, t, "TGate_tower", new Vector3(0f, 8.2f, 0f), new Vector3(10f, 2f, 3.6f), wood, false, new Vector3(0f, 0f, 12f));
                    P(PrimitiveType.Cube, t, "TGate_roof", new Vector3(0f, 9.6f, 0f), new Vector3(12f, 0.5f, 4.6f), dark, false, new Vector3(0f, 0f, 12f));
                    for (int i = 0; i < 4; i++)
                        P(PrimitiveType.Cube, t, "TGate_chunk", new Vector3(-9f + i * 6f, 6f + (i % 2) * 3f, -5f - i), new Vector3(3.5f, 1.4f, 1.2f), stone, false, new Vector3(i * 9f, i * 20f, i * 12f));
                    break;
                case "clock": // 멈춘 시계탑 — 16m 기둥(옆면 타기) · 네 면 빛 문자판 · 바늘
                    P(PrimitiveType.Cube, t, "Clock_tower", new Vector3(0f, GoStory.ClockHeight * 0.5f, 0f), new Vector3(GoStory.ClockHalf * 2f, GoStory.ClockHeight, GoStory.ClockHalf * 2f), stone, true);
                    foreach (var (dx, dz, yaw) in new[] { (0f, GoStory.ClockHalf + 0.05f, 0f), (0f, -GoStory.ClockHalf - 0.05f, 180f), (GoStory.ClockHalf + 0.05f, 0f, 90f), (-GoStory.ClockHalf - 0.05f, 0f, -90f) })
                        P(PrimitiveType.Cylinder, t, "Clock_dial", new Vector3(dx, GoStory.ClockHeight - 3f, dz), new Vector3(2.2f, 0.05f, 2.2f), glow, false, new Vector3(90f, yaw, 0f));
                    Part("crossing:clock_hand", t, PrimitiveType.Cube, "Clock_hand", new Vector3(0f, GoStory.ClockHeight - 3f, GoStory.ClockHalf + 0.12f), new Vector3(0.12f, 0.9f, 0.05f), dark, false);
                    break;
                case "steps": // 떠 있는 섬돌 — 열다섯 개가 나선으로 1.1m 씩 떠오르고 꼭대기에 틈 수정
                    for (int i = 0; i < GoStory.StepN; i++)
                    {
                        float a = i * Mathf.PI * 0.25f;
                        P(PrimitiveType.Cylinder, t, "Steps_stone", new Vector3(Mathf.Cos(a) * GoStory.StepR, (i + 1) * GoStory.StepRise - 0.2f, Mathf.Sin(a) * GoStory.StepR), new Vector3(2.3f, 0.2f, 2.3f), stone, true);
                    }
                    P(PrimitiveType.Sphere, t, "Steps_crystal", new Vector3(0f, GoStory.StepN * GoStory.StepRise + 1.4f, 0f), new Vector3(1.2f, 2.6f, 1.2f), glow, false);
                    break;
                case "gate": // 틈 고개 경계비
                    P(PrimitiveType.Cube, t, "Gate_stele", new Vector3(0f, 2.5f, 0f), new Vector3(1.6f, 5f, 1f), stone, true);
                    P(PrimitiveType.Sphere, t, "Gate_glow", new Vector3(0f, 5.6f, 0f), Vector3.one * 1.1f, glow, false);
                    break;
                case "dial":
                    P(PrimitiveType.Cylinder, t, "Dial_face", new Vector3(0f, 0.3f, 0f), new Vector3(2.4f, 0.12f, 2.4f), glow, false, new Vector3(12f, 0f, 8f));
                    break;
                case "lantern":
                    P(PrimitiveType.Cube, t, "Lantern_post", new Vector3(0f, 1.2f, 0f), new Vector3(0.25f, 2.4f, 0.25f), wood, false);
                    P(PrimitiveType.Sphere, t, "Lantern_lamp", new Vector3(0f, 2.6f, 0f), Vector3.one * 0.7f, glow, false);
                    break;
                case "guard":
                    P(PrimitiveType.Cube, t, "Guard_body", new Vector3(0f, 1.5f, 0f), new Vector3(1.3f, 2f, 1f), metal, false);
                    P(PrimitiveType.Sphere, t, "Guard_head", new Vector3(0f, 2.9f, 0f), Vector3.one * 0.8f, metal, false);
                    P(PrimitiveType.Sphere, t, "Guard_eye", new Vector3(0f, 2.95f, 0.36f), new Vector3(0.4f, 0.14f, 0.1f), glow, false);
                    break;
                case "tile":
                    for (int i = 0; i < 4; i++) P(PrimitiveType.Cube, t, "Tile_piece", new Vector3(i * 0.5f - 0.7f, 0.15f + i * 0.08f, (i % 2) * 0.4f), new Vector3(1.4f, 0.12f, 1f), clay, false, new Vector3(0f, i * 25f, i * 6f));
                    break;
                case "signal":
                    P(PrimitiveType.Cylinder, t, "Signal_pole", new Vector3(0f, 2.5f, 0f), new Vector3(0.2f, 2.5f, 0.2f), rust, false);
                    P(PrimitiveType.Cube, t, "Signal_arm", new Vector3(0.7f, 4.7f, 0f), new Vector3(1.6f, 0.15f, 0.15f), rust, false, new Vector3(0f, 0f, -20f));
                    P(PrimitiveType.Sphere, t, "Signal_lamp", new Vector3(1.5f, 4.4f, 0f), Vector3.one * 0.5f, Mat("c_lamp_red", new Color(0.8f, 0.12f, 0.1f), 1.6f), false);
                    break;
                case "crystal":
                    P(PrimitiveType.Sphere, t, "Crystal_a", new Vector3(0f, 1.2f, 0f), new Vector3(1f, 2.6f, 1f), glow, false, new Vector3(0f, 0f, 8f));
                    P(PrimitiveType.Sphere, t, "Crystal_b", new Vector3(0.8f, 0.7f, 0.3f), new Vector3(0.6f, 1.5f, 0.6f), glow, false, new Vector3(0f, 0f, -22f));
                    break;
                case "cart":
                    P(PrimitiveType.Cube, t, "Cart_bed", new Vector3(0f, 0.9f, 0f), new Vector3(2.6f, 0.4f, 1.6f), wood, false, new Vector3(0f, 0f, 6f));
                    P(PrimitiveType.Cylinder, t, "Cart_wheel_a", new Vector3(-0.9f, 0.5f, 0.9f), new Vector3(1f, 0.1f, 1f), wood, false, new Vector3(90f, 0f, 0f));
                    P(PrimitiveType.Cylinder, t, "Cart_wheel_b", new Vector3(0.9f, 0.5f, -0.9f), new Vector3(1f, 0.1f, 1f), wood, false, new Vector3(90f, 0f, 0f));
                    break;
                case "pod":
                    P(PrimitiveType.Sphere, t, "Pod_body", new Vector3(0f, 1.1f, 0f), new Vector3(2.2f, 1.7f, 3f), metal, false, new Vector3(0f, 25f, 12f));
                    P(PrimitiveType.Sphere, t, "Pod_window", new Vector3(0f, 1.5f, 1.1f), new Vector3(0.9f, 0.6f, 0.4f), glassM, false, new Vector3(0f, 25f, 12f));
                    break;
                case "ticket":
                    P(PrimitiveType.Cube, t, "Ticket_box", new Vector3(0f, 1.1f, 0f), new Vector3(1.2f, 2.2f, 0.9f), metal, false);
                    P(PrimitiveType.Cube, t, "Ticket_screen", new Vector3(0f, 1.6f, 0.47f), new Vector3(0.8f, 0.5f, 0.05f), glow, false);
                    break;
                case "helm":
                    P(PrimitiveType.Sphere, t, "Helm_helmet", new Vector3(0f, 0.5f, 0f), new Vector3(0.9f, 0.8f, 0.9f), metal, false);
                    P(PrimitiveType.Cube, t, "Helm_sword", new Vector3(1f, 0.3f, 0.2f), new Vector3(0.12f, 0.06f, 1.9f), metal, false, new Vector3(0f, 30f, 0f));
                    break;
            }
        }

        private const float PlatOff = 3.2f;

        /// <summary>이야기 진행에 맞춰 바뀌는 조각·돌기둥을 켜고 끈다(진단도 부른다). 계류 탑 빛 공·매인 별배·종·막차는 각 장에서 여기에 더한다.</summary>
        private void SetMat(string key, Material m)
        {
            if (_parts.TryGetValue(key, out var g) && g != null) g.GetComponent<MeshRenderer>().sharedMaterial = m;
        }

        private bool _clockOn, _lightLit;
        public bool LightLit => _lightLit;
        private void TickBeam()
        {
            if (!_lightLit || !_parts.TryGetValue("sunken:beam", out var beam) || beam == null) return;
            float ang = Time.time * 40f * Mathf.Deg2Rad;
            beam.transform.localPosition = new Vector3(Mathf.Sin(ang) * 9f, GoStory.LightHeight + 1.2f, Mathf.Cos(ang) * 9f);
            beam.transform.localRotation = Quaternion.Euler(0f, ang * Mathf.Rad2Deg, 0f);
        }
        public bool ClockOn => _clockOn;
        private float _ring;
        /// <summary>종각 종을 3초 흔든다(그림만, 잦아드는 흔들림).</summary>
        public void RingBell() => _ring = 3f;
        public bool Ringing => _ring > 0f;
        private void TickClock()
        {
            if (!_parts.TryGetValue("crossing:clock_hand", out var hand) || hand == null) return;
            if (_clockOn) hand.transform.localRotation = Quaternion.Euler(0f, 0f, -Time.time * 30f);
        }

        private void TickBell(float dt)
        {
            if (!_parts.TryGetValue("skyport:bell", out var bell) || bell == null) return;
            _ring = Mathf.Max(0f, _ring - dt);
            float amp = _ring / 3f * 25f;
            bell.transform.localRotation = Quaternion.Euler(0f, 0f, Mathf.Sin(Time.time * 9f) * amp);
        }

        public void Refresh()
        {
            foreach (var a in GoAreas.All)
                if (_gates.TryGetValue(a.Id, out var g) && g != null) g.SetActive(a.Open());
            bool hung = !StoryState.OffForTest && GoStory.BellHung;
            if (_parts.TryGetValue("skyport:bell", out var bell) && bell != null) bell.SetActive(hung);
            if (_parts.TryGetValue("skyport:bell_hidden", out var tip) && tip != null) tip.SetActive(hung);
            if (_parts.TryGetValue("skyport:bell_fallen", out var fallen) && fallen != null) fallen.SetActive(!hung);
            _clockOn = !StoryState.OffForTest && GoStory.ClockRunning;
            RefreshRift();
            bool powered = !StoryState.OffForTest && GoStory.TrainPowered;
            SetMat("skyport:train_lamp_a", powered ? Mat("s_lamp_on", new Color(1f, 0.95f, 0.7f), 3f) : Mat("s_lamp_off", new Color(0.22f, 0.22f, 0.22f)));
            SetMat("skyport:train_lamp_b", powered ? Mat("s_lamp_on", new Color(1f, 0.95f, 0.7f), 3f) : Mat("s_lamp_off", new Color(0.22f, 0.22f, 0.22f)));
            SetMat("skyport:train_windows", powered ? Mat("s_win_on", new Color(1f, 0.9f, 0.55f), 1.6f, 0.8f) : Mat("s_glass", new Color(0.55f, 0.8f, 0.95f), 0.4f, 0.8f));
            SetMat("skyport:substation_lamp", powered ? Mat("s_lamp_green", new Color(0.2f, 0.9f, 0.3f), 2.4f) : Mat("s_lamp_red", new Color(0.85f, 0.15f, 0.12f), 2f));
            // 잠긴 도읍 — 테왁 불(20장 뒤)·빛 돔 문(22장 8째 단계부터 열림)·등대 불(23장 4째 단계부터)
            bool sea = !StoryState.OffForTest && GoStory.SeaLightsOn;
            if (_parts.TryGetValue("sunken:sealights", out var sl) && sl != null) sl.SetActive(sea);
            bool domeOpen = !StoryState.OffForTest && GoStory.DomeOpen;
            if (_parts.TryGetValue("sunken:dome_door", out var door) && door != null) door.SetActive(!domeOpen);
            _lightLit = !StoryState.OffForTest && GoStory.LighthouseLit;
            SetMat("sunken:lantern", _lightLit ? Mat("u_lantern_on", new Color(1f, 0.92f, 0.6f), 3.5f) : Mat("u_lantern_off", new Color(0.25f, 0.28f, 0.3f)));
            if (_parts.TryGetValue("sunken:beam", out var beam) && beam != null) beam.SetActive(_lightLit);
            bool docked = !StoryState.OffForTest && GoStory.PortDocked;
            if (_parts.TryGetValue("skyport:ship", out var ship) && ship != null) ship.SetActive(docked);
            if (_parts.TryGetValue("skyport:beacon", out var beacon) && beacon != null)
            {
                var r = beacon.GetComponent<MeshRenderer>();
                r.sharedMaterial = docked ? Mat("s_beacon_on", new Color(1f, 0.92f, 0.55f), 3.5f) : Mat("s_beacon_off", new Color(0.25f, 0.28f, 0.32f));
            }
        }

        // ---- 화면 ----

        private void BuildUi()
        {
            if (_btnRoot != null) Destroy(_btnRoot);
            var canvas = EncounterUiKit.NewCanvas("AreaUI");
            canvas.sortingOrder = 8;
            _btnRoot = canvas.gameObject;
            _btnRoot.transform.SetParent(transform, false);
            _travel = EncounterUiKit.NewButton(canvas.transform, "", new Vector2(0.5f, 0f), new Vector2(0f, 440f), new Vector2(360f, 60f), null);
            ((RectTransform)_travel.transform).pivot = new Vector2(0.5f, 0f);
            _travelText = _travel.GetComponentInChildren<TextMeshProUGUI>();
            _travelText.fontSize = 22;
            _travel.onClick.AddListener(() => TravelHere());
            _travel.gameObject.SetActive(false);
        }

        private static Vector3 Flat(Vector3 v) { v.y = 0f; return v; }

        /// <summary>돌기둥 곁이면 어느 쪽으로 가는지: (땅, +1 = 땅으로(지도 쪽 돌기둥) · −1 = 지도로(땅 쪽 돌기둥)) — 곁 아니면 (null, 0). 닫힌 땅의 지도 쪽 돌기둥은 곁이 아니다.</summary>
        public (GoAreas.Area area, int dir) NearGate(Vector3 feet)
        {
            foreach (var a in GoAreas.All)
            {
                if (!_gates.ContainsKey(a.Id)) continue;
                if (a.Contains(feet)) { if ((Flat(feet) - Flat(_steles[a.Id].transform.position)).magnitude <= GoAreas.GateRadius) return (a, -1); }
                else if (a.Open() && (Flat(feet) - Flat(_gates[a.Id].transform.position)).magnitude <= GoAreas.GateRadius) return (a, 1);
            }
            return (null, 0);
        }

        private void Update()
        {
            var fc = FieldCombat.Instance;
            if (fc == null) return;
            Vector3 feet = fc.transform.position;
            Tick(feet);
            var kb = Keyboard.current;
            TickBell(Time.deltaTime);
            TickClock();
            TickBeam();
            TickRiftRings(Time.deltaTime);
            var (a, g) = NearGate(feet);
            if (kb != null && g != 0 && kb.fKey.wasPressedThisFrame && !FishingField.Busy && !StoryState.Talking
                && !(StoryUi.Instance != null && StoryUi.Instance.TalkShown) && !DispatchUi.AtBoard() && GoFishing.NearSpot(new Vector2(feet.x, feet.z)) == null && !GoFishing.NearBoard(new Vector2(feet.x, feet.z)))
                TravelHere();
            _wait -= Time.deltaTime;
            if (_wait > 0f) return;
            _wait = CheckEverySec;
            Refresh();
            Check(feet);
        }

        /// <summary>이동 단추를 발 자리에 맞춘다(진단도 부른다).</summary>
        public void Tick(Vector3 feet)
        {
            if (_travel == null) return;
            var (a, g) = NearGate(feet);
            bool show = g != 0 && !FishingField.Busy && !StoryState.Talking;
            if (_travel.gameObject.activeSelf != show) _travel.gameObject.SetActive(show);
            if (show) _travelText.text = g > 0
                ? string.Format(GoLocalization.T("area.go_in", "{0} 으로 든다"), GoWorldMap.RegionName(a.Id))
                : GoLocalization.T("area.go_out", "마을 쪽으로 돌아간다");
        }

        /// <summary>돌기둥 곁에서 반대쪽으로 순간이동 — 곁이 아니면 false.</summary>
        public bool TravelHere()
        {
            var fc = FieldCombat.Instance;
            if (fc == null) return false;
            var (a, g) = NearGate(fc.transform.position);
            if (g == 0) return false;
            return Travel(a, g > 0);
        }

        public bool Travel(GoAreas.Area a, bool toArea)
        {
            var fc = FieldCombat.Instance;
            var pc = fc != null ? fc.GetComponent<PlayerController>() : null;
            if (pc == null || fc.InCombat()) return false;
            if (toArea && !a.Open()) return false;
            pc.Teleport(toArea ? a.ArrivalPos : a.ReturnPos);
            if (_travel != null) _travel.gameObject.SetActive(false);
            return true;
        }

        /// <summary>발 자리에서 명소·발견 찾기 — 새로 찾은 수. 진단이 직접 부른다.</summary>
        public int Check(Vector3 feet)
        {
            var a = GoAreas.AreaAt(feet);
            if (a == null) return 0;
            int n = 0;
            foreach (var s in a.Sites)
            {
                if (AreaState.Found(s.Key)) continue;
                if ((Flat(feet) - Flat(s.Pos)).magnitude > s.Radius) continue;
                if (!AreaState.Discover(s.Key)) continue;
                n++;
                LastFound = string.Format(GoLocalization.T("area.found", "{0} — {1} 발견! {2}"), GoWorldMap.RegionName(a.Id), s.Name, GoAreas.RewardText(s));
                if (DialogueLabel.Instance != null) DialogueLabel.Instance.Show(LastFound, 3.5f);
                FieldRingFx.Spawn(feet, 2.5f, new Color(0.7f, 0.9f, 1f), 0.5f);
            }
            return n;
        }
    }
}
