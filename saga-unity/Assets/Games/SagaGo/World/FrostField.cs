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
    /// PLAN.md 109-14-27a 서리봉 고원(웹 사가고 ⑲-27) — 지도 북쪽 밖 먼 곳에 400×540m 눈밭을 실행 때 짓는다(구름섬처럼 — 글자 지도는 안 건드림).
    /// 눈밭 바닥·바깥 보이지 않는 벽(못 넘음)·명소 다섯(옛 산성 터 = 남쪽 문 있는 담·기상 관측소·추락한 비행선·얼어붙은 호수·경계비)·작은 발견 일곱을
    /// 도형으로 세우고, 고원 안이면 눈이 내린다(`RegionAtmosphere` 가 눈안개로 옮김). 명소 16m·발견 7m 안 = 발견(금·연마석·경험치, 한 번).
    /// 드나드는 길: 북쪽 산기슭 역참 곁 "서리 고개" 돌기둥 ↔ 고원 남쪽 경계비 — 곁이면 단추(또는 F)로 순간이동.
    /// `WorldMapBuilder` 가 Play 때 붙인다(씬 재빌드 없음).
    /// </summary>
    public class FrostField : MonoBehaviour
    {
        public static FrostField Instance { get; private set; }
        public const float CheckEverySec = 0.25f;

        private readonly Dictionary<string, Material> _mats = new Dictionary<string, Material>();
        private readonly Dictionary<string, GameObject> _sites = new Dictionary<string, GameObject>();
        private GameObject _gate, _stele, _btnRoot;
        private Vector3 _gateGround;
        private Button _travel;
        private TextMeshProUGUI _travelText;
        private ParticleSystem _snow;
        private float _wait;

        /// <summary>마지막 발견 글(진단).</summary>
        public string LastFound { get; private set; }
        public Button TravelButton => _travel;
        public string TravelLabel => _travelText != null ? _travelText.text : "";
        public bool SnowOn => _snow != null && _snow.emission.enabled;
        public Vector3 GateGround => _gateGround;
        public GameObject SiteObject(string id) => _sites.TryGetValue(id, out var g) ? g : null;

        private void Awake() => Instance = this;
        private void OnDestroy() { if (Instance == this) Instance = null; }
        private void Start() => Rebuild();

        // ---- 짓기 ----

        private Material Mat(string key, Color c, float glow = 0f, float smooth = 0.15f)
        {
            if (_mats.TryGetValue(key, out var m)) return m;
            m = new Material(Shader.Find("Universal Render Pipeline/Lit")) { name = "Frost_" + key + " (generated)", color = c };
            m.SetFloat("_Smoothness", smooth);
            if (glow > 0f)
            {
                m.EnableKeyword("_EMISSION");
                m.SetColor("_EmissionColor", c * glow);
            }
            _mats[key] = m;
            return m;
        }

        private static GameObject P(PrimitiveType t, Transform parent, Vector3 local, Vector3 scale, Material m, bool collide, Vector3 euler = default)
        {
            var go = GameObject.CreatePrimitive(t);
            if (!collide) Destroy(go.GetComponent<Collider>());
            go.transform.SetParent(parent, false);
            go.transform.localPosition = local;
            go.transform.localRotation = Quaternion.Euler(euler);
            go.transform.localScale = scale;
            go.GetComponent<MeshRenderer>().sharedMaterial = m;
            return go;
        }

        public void Rebuild()
        {
            foreach (Transform c in transform) if (c.name.StartsWith("Frost_")) Destroy(c.gameObject);
            _sites.Clear();
            var root = new GameObject("Frost_root");
            root.transform.SetParent(transform, false);
            Vector3 c0 = GoFrost.Center;
            var snow = Mat("snow", new Color(0.93f, 0.96f, 1f), 0f, 0.3f);
            var ground = P(PrimitiveType.Cube, root.transform, c0 + new Vector3(0f, -GoFrost.Thickness * 0.5f, 0f), new Vector3(GoFrost.HalfX * 2f, GoFrost.Thickness, GoFrost.HalfZ * 2f), snow, true);
            ground.name = "Frost_ground";
            BuildWalls(root.transform);
            foreach (var s in GoFrost.Sites) _sites[s.Id] = BuildSite(root.transform, s);
            BuildGate(root.transform);
            BuildSnow(root.transform);
            BuildUi();
        }

        /// <summary>눈밭 둘레의 보이지 않는 벽 — 넘지도 오르지도 못한다.</summary>
        private void BuildWalls(Transform parent)
        {
            Vector3 c = GoFrost.Center;
            float hx = GoFrost.HalfX, hz = GoFrost.HalfZ, h = GoFrost.WallHeight, t = 2f;
            var defs = new[]
            {
                (new Vector3(c.x, h * 0.5f, c.z - hz - t * 0.5f), new Vector3(hx * 2f + t * 2f, h, t)),
                (new Vector3(c.x, h * 0.5f, c.z + hz + t * 0.5f), new Vector3(hx * 2f + t * 2f, h, t)),
                (new Vector3(c.x - hx - t * 0.5f, h * 0.5f, c.z), new Vector3(t, h, hz * 2f)),
                (new Vector3(c.x + hx + t * 0.5f, h * 0.5f, c.z), new Vector3(t, h, hz * 2f)),
            };
            int i = 0;
            foreach (var (pos, size) in defs)
            {
                var go = new GameObject("Frost_wall" + i++);
                go.transform.SetParent(parent, false);
                go.transform.position = pos;
                go.AddComponent<BoxCollider>().size = size;
                go.AddComponent<NoClimb>();
            }
        }

        private void BuildGate(Transform parent)
        {
            var stone = Mat("gate_stone", new Color(0.55f, 0.58f, 0.64f));
            var glow = Mat("gate_glow", new Color(0.55f, 0.85f, 1f), 2.5f);
            // 마을 쪽 — 북쪽 산기슭 역참 곁
            _gateGround = FolkWalker.Grounded(GoFrost.GatePos);
            _gate = new GameObject("Frost_gate");
            _gate.transform.SetParent(parent, false);
            _gate.transform.position = _gateGround;
            Pillar(_gate.transform, stone, glow);
            // 고원 쪽 — 경계비가 곧 나가는 돌기둥(경계비 모델 자리 옆에 나란히)
            _stele = new GameObject("Frost_stele_gate");
            _stele.transform.SetParent(parent, false);
            _stele.transform.position = GoFrost.SteleGround + new Vector3(4f, 0f, 0f);
            Pillar(_stele.transform, stone, glow);
        }

        private static void Pillar(Transform t, Material stone, Material glow)
        {
            P(PrimitiveType.Cube, t, new Vector3(0f, 1.75f, 0f), new Vector3(1.2f, 3.5f, 1.2f), stone, true);
            P(PrimitiveType.Sphere, t, new Vector3(0f, 3.9f, 0f), Vector3.one * 0.9f, glow, false);
        }

        private GameObject BuildSite(Transform parent, GoFrost.Site s)
        {
            var root = new GameObject("Frost_site_" + s.Id);
            root.transform.SetParent(parent, false);
            root.transform.position = s.Pos;
            var t = root.transform;
            var stone = Mat("stone", new Color(0.5f, 0.52f, 0.57f));
            var dark = Mat("dark", new Color(0.14f, 0.15f, 0.19f));
            var wood = Mat("wood", new Color(0.4f, 0.28f, 0.18f));
            var metal = Mat("metal", new Color(0.62f, 0.68f, 0.74f), 0f, 0.6f);
            var white = Mat("white", new Color(0.96f, 0.97f, 1f));
            var ice = Mat("ice", new Color(0.62f, 0.83f, 0.98f), 0f, 0.8f);
            var fire = Mat("fire", new Color(1f, 0.5f, 0.15f), 3f);
            switch (s.Id)
            {
                case "fort": // 옛 산성 터 — 네모 담(남쪽 문) + 안쪽 무너진 망루 터
                    {
                        const float side = 40f, th = 2f, h = 5f, gate = 9f;
                        float half = side * 0.5f;
                        P(PrimitiveType.Cube, t, new Vector3(0f, h * 0.5f, -half), new Vector3(side, h, th), stone, true);
                        P(PrimitiveType.Cube, t, new Vector3(-half, h * 0.5f, 0f), new Vector3(th, h, side), stone, true);
                        P(PrimitiveType.Cube, t, new Vector3(half, h * 0.5f, 0f), new Vector3(th, h, side), stone, true);
                        float seg = (side - gate) * 0.5f;
                        P(PrimitiveType.Cube, t, new Vector3(-(gate * 0.5f + seg * 0.5f), h * 0.5f, half), new Vector3(seg, h, th), stone, true);
                        P(PrimitiveType.Cube, t, new Vector3(gate * 0.5f + seg * 0.5f, h * 0.5f, half), new Vector3(seg, h, th), stone, true);
                        P(PrimitiveType.Cube, t, new Vector3(-6f, 2f, -6f), new Vector3(6f, 4f, 6f), stone, true, new Vector3(0f, 18f, 0f));
                        P(PrimitiveType.Cube, t, new Vector3(7f, 1f, 4f), new Vector3(4f, 2f, 3f), stone, true, new Vector3(0f, -25f, 0f));
                        P(PrimitiveType.Cube, t, new Vector3(0f, 5.1f, -half), new Vector3(side + 0.2f, 0.4f, th + 0.2f), white, false); // 담 위 눈
                        break;
                    }
                case "obs": // 기상 관측소 — 상자 건물 + 접시 + 안테나
                    P(PrimitiveType.Cube, t, new Vector3(0f, 3.5f, 0f), new Vector3(12f, 7f, 10f), white, true);
                    P(PrimitiveType.Cube, t, new Vector3(0f, 7.2f, 0f), new Vector3(12.6f, 0.5f, 10.6f), dark, false);
                    P(PrimitiveType.Cube, t, new Vector3(0f, 1.6f, 5.05f), new Vector3(2.4f, 3.2f, 0.2f), dark, false);
                    P(PrimitiveType.Cylinder, t, new Vector3(3f, 10f, 0f), new Vector3(0.3f, 3f, 0.3f), metal, false);
                    P(PrimitiveType.Sphere, t, new Vector3(-3f, 8.2f, 0f), new Vector3(4.5f, 1.2f, 4.5f), metal, false, new Vector3(20f, 0f, 15f));
                    break;
                case "ship": // 추락한 비행선 — 반쯤 묻힌 긴 몸통 + 꼬리날개
                    P(PrimitiveType.Sphere, t, new Vector3(0f, 1.6f, 0f), new Vector3(26f, 7f, 8f), metal, true, new Vector3(0f, 8f, 10f));
                    P(PrimitiveType.Cube, t, new Vector3(-12.5f, 4.6f, 0f), new Vector3(3f, 5f, 0.4f), metal, false, new Vector3(0f, 8f, 10f));
                    P(PrimitiveType.Cube, t, new Vector3(-12f, 2.4f, 0f), new Vector3(3f, 0.4f, 6f), metal, false, new Vector3(0f, 8f, 10f));
                    P(PrimitiveType.Sphere, t, new Vector3(9f, 3.2f, 0f), new Vector3(5f, 3f, 4.4f), Mat("glass", new Color(0.35f, 0.75f, 0.95f), 0.6f, 0.9f), false);
                    P(PrimitiveType.Cube, t, new Vector3(4f, 0.6f, 0f), new Vector3(14f, 1.4f, 10f), white, false);
                    break;
                case "lake": // 얼어붙은 호수 — 걸을 수 있는 얼음판
                    P(PrimitiveType.Cylinder, t, new Vector3(0f, 0.05f, 0f), new Vector3(56f, 0.1f, 56f), ice, false);
                    break;
                case "stele": // 서리 고개 경계비
                    P(PrimitiveType.Cube, t, new Vector3(0f, 2.5f, 0f), new Vector3(2.2f, 5f, 1f), stone, true);
                    P(PrimitiveType.Cube, t, new Vector3(0f, 5.2f, 0f), new Vector3(2.5f, 0.5f, 1.3f), white, false);
                    P(PrimitiveType.Cube, t, new Vector3(0f, 0.4f, 0f), new Vector3(4f, 0.8f, 2.6f), stone, false);
                    break;
                case "sat": // 떨어진 위성 조각
                    P(PrimitiveType.Cube, t, new Vector3(0f, 0.7f, 0f), new Vector3(3.2f, 0.4f, 1.6f), metal, true, new Vector3(0f, 25f, 18f));
                    P(PrimitiveType.Cube, t, new Vector3(2.4f, 0.4f, 1.2f), new Vector3(2.4f, 0.2f, 1.4f), Mat("panel", new Color(0.1f, 0.2f, 0.45f), 0.3f, 0.7f), false, new Vector3(0f, -10f, 8f));
                    P(PrimitiveType.Sphere, t, new Vector3(-1.6f, 0.6f, -0.6f), new Vector3(1.4f, 1.4f, 1.4f), metal, true);
                    break;
                case "statue": // 장수 석상
                    P(PrimitiveType.Cube, t, new Vector3(0f, 0.6f, 0f), new Vector3(2f, 1.2f, 2f), stone, true);
                    P(PrimitiveType.Cylinder, t, new Vector3(0f, 2.6f, 0f), new Vector3(1f, 1.4f, 1f), stone, true);
                    P(PrimitiveType.Sphere, t, new Vector3(0f, 4.3f, 0f), new Vector3(0.9f, 0.9f, 0.9f), stone, false);
                    P(PrimitiveType.Cube, t, new Vector3(0.9f, 3f, 0f), new Vector3(0.2f, 2.4f, 0.2f), stone, false);
                    break;
                case "hut": // 사냥꾼 오두막
                    P(PrimitiveType.Cube, t, new Vector3(0f, 1.6f, 0f), new Vector3(6f, 3.2f, 5f), wood, true);
                    P(PrimitiveType.Cube, t, new Vector3(0f, 3.5f, 0f), new Vector3(7f, 0.4f, 6f), white, false, new Vector3(0f, 0f, 6f));
                    P(PrimitiveType.Cube, t, new Vector3(0f, 1.1f, 2.55f), new Vector3(1.2f, 2.2f, 0.1f), dark, false);
                    break;
                case "snowman": // 누가 만든 눈사람
                    P(PrimitiveType.Sphere, t, new Vector3(0f, 0.9f, 0f), Vector3.one * 1.8f, white, true);
                    P(PrimitiveType.Sphere, t, new Vector3(0f, 2.3f, 0f), Vector3.one * 1.3f, white, false);
                    P(PrimitiveType.Sphere, t, new Vector3(0f, 3.3f, 0f), Vector3.one * 0.9f, white, false);
                    P(PrimitiveType.Cube, t, new Vector3(0f, 3.85f, 0f), new Vector3(0.7f, 0.5f, 0.7f), dark, false);
                    break;
                case "cable": // 멈춘 케이블카
                    P(PrimitiveType.Cylinder, t, new Vector3(-6f, 5f, 0f), new Vector3(0.5f, 5f, 0.5f), metal, true);
                    P(PrimitiveType.Cylinder, t, new Vector3(6f, 5f, 0f), new Vector3(0.5f, 5f, 0.5f), metal, true);
                    P(PrimitiveType.Cylinder, t, new Vector3(0f, 9.4f, 0f), new Vector3(0.12f, 6.1f, 0.12f), dark, false, new Vector3(0f, 0f, 90f));
                    P(PrimitiveType.Cube, t, new Vector3(1f, 6.6f, 0f), new Vector3(3f, 2.2f, 2.2f), Mat("cabin", new Color(0.85f, 0.25f, 0.2f)), false);
                    break;
                case "cave": // 얼음굴 어귀
                    P(PrimitiveType.Sphere, t, new Vector3(0f, 1.2f, 0f), new Vector3(9f, 5f, 7f), ice, true);
                    P(PrimitiveType.Sphere, t, new Vector3(0f, 1.1f, 2.2f), new Vector3(4.2f, 3.2f, 3.6f), dark, false);
                    break;
                case "beacon": // 고원 봉화
                    P(PrimitiveType.Cube, t, new Vector3(0f, 1f, 0f), new Vector3(3f, 2f, 3f), stone, true);
                    P(PrimitiveType.Sphere, t, new Vector3(0f, 2.6f, 0f), new Vector3(1.6f, 1.6f, 1.6f), fire, false);
                    break;
            }
            return root;
        }

        private static Texture2D _dot;
        private static Texture2D Dot()
        {
            if (_dot != null) return _dot;
            const int n = 32;
            _dot = new Texture2D(n, n, TextureFormat.RGBA32, false) { name = "FrostDot (generated)" };
            for (int y = 0; y < n; y++)
                for (int x = 0; x < n; x++)
                {
                    float d = Vector2.Distance(new Vector2(x, y), new Vector2(n * 0.5f, n * 0.5f)) / (n * 0.5f);
                    _dot.SetPixel(x, y, new Color(1f, 1f, 1f, Mathf.Clamp01(1f - d)));
                }
            _dot.Apply();
            return _dot;
        }

        /// <summary>눈 — 발 둘레 위에서 상자 모양으로 내림. 고원 밖이면 멈춘다.</summary>
        private void BuildSnow(Transform parent)
        {
            var go = new GameObject("Frost_snow");
            go.transform.SetParent(parent, false);
            _snow = go.AddComponent<ParticleSystem>();
            var main = _snow.main;
            main.loop = true;
            main.startLifetime = GoFrost.SnowHeight / GoFrost.SnowFall * 1.15f;
            main.startSpeed = 0f;
            main.startSize = new ParticleSystem.MinMaxCurve(0.14f, 0.24f);
            main.startColor = new Color(1f, 1f, 1f, 0.9f);
            main.simulationSpace = ParticleSystemSimulationSpace.World;
            main.maxParticles = 400;
            var em = _snow.emission;
            em.rateOverTime = GoFrost.SnowRate;
            em.enabled = false;
            var shape = _snow.shape;
            shape.shapeType = ParticleSystemShapeType.Box;
            shape.scale = new Vector3(GoFrost.SnowBox, 0.5f, GoFrost.SnowBox);
            var vel = _snow.velocityOverLifetime;
            vel.enabled = true;
            vel.space = ParticleSystemSimulationSpace.World;
            vel.x = new ParticleSystem.MinMaxCurve(-0.5f, 0.5f);
            vel.y = -GoFrost.SnowFall;
            vel.z = new ParticleSystem.MinMaxCurve(-0.3f, 0.3f);
            var r = go.GetComponent<ParticleSystemRenderer>();
            r.material = new Material(Shader.Find("Sprites/Default")) { name = "FrostSnow (generated)", mainTexture = Dot() };
            r.shadowCastingMode = UnityEngine.Rendering.ShadowCastingMode.Off;
        }

        private void BuildUi()
        {
            if (_btnRoot != null) Destroy(_btnRoot);
            var canvas = EncounterUiKit.NewCanvas("FrostUI");
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

        // ---- 프레임 ----

        private static Vector3 Flat(Vector3 v) { v.y = 0f; return v; }

        /// <summary>돌기둥 곁이면 어느 쪽으로 가는지: 1 = 고원으로(마을 쪽 돌기둥) · −1 = 마을로(고원 쪽) · 0 = 곁 아님.</summary>
        public int NearGate(Vector3 feet)
        {
            if (_gate == null) return 0;
            if (Contains(feet)) return (Flat(feet) - Flat(_stele.transform.position)).magnitude <= GoFrost.GateRadius ? -1 : 0;
            return (Flat(feet) - Flat(_gate.transform.position)).magnitude <= GoFrost.GateRadius ? 1 : 0;
        }

        private static bool Contains(Vector3 p) => GoFrost.Contains(p);

        private void Update()
        {
            var fc = FieldCombat.Instance;
            if (fc == null) return;
            Vector3 feet = fc.transform.position;
            Tick(feet);
            int g = NearGate(feet);
            var kb = Keyboard.current;
            if (kb != null && g != 0 && kb.fKey.wasPressedThisFrame && !FishingField.Busy && !StoryState.Talking
                && !(StoryUi.Instance != null && StoryUi.Instance.TalkShown) && !DispatchUi.AtBoard() && GoFishing.NearSpot(new Vector2(feet.x, feet.z)) == null && !GoFishing.NearBoard(new Vector2(feet.x, feet.z)))
                TravelHere();
            _wait -= Time.deltaTime;
            if (_wait > 0f) return;
            _wait = CheckEverySec;
            Check(feet);
        }

        /// <summary>눈·이동 단추를 발 자리에 맞춘다(진단도 부른다).</summary>
        public void Tick(Vector3 feet)
        {
            if (_snow != null)
            {
                bool inside = Contains(feet);
                var em = _snow.emission;
                if (em.enabled != inside) { em.enabled = inside; if (!inside) _snow.Clear(); }
                _snow.transform.position = feet + Vector3.up * GoFrost.SnowHeight;
            }
            int g = NearGate(feet);
            if (_travel == null) return;
            bool show = g != 0 && !FishingField.Busy && !StoryState.Talking;
            if (_travel.gameObject.activeSelf != show) _travel.gameObject.SetActive(show);
            if (show) _travelText.text = g > 0 ? GoLocalization.T("frost.go_up", "서리 고개로 오른다") : GoLocalization.T("frost.go_down", "마을 쪽으로 내려간다");
        }

        /// <summary>돌기둥 곁에서 반대쪽으로 순간이동 — 곁이 아니면 false.</summary>
        public bool TravelHere()
        {
            var fc = FieldCombat.Instance;
            if (fc == null) return false;
            int g = NearGate(fc.transform.position);
            if (g == 0) return false;
            return Travel(g > 0);
        }

        public bool Travel(bool toFrost)
        {
            var fc = FieldCombat.Instance;
            var pc = fc != null ? fc.GetComponent<PlayerController>() : null;
            if (pc == null || fc.InCombat()) return false;
            pc.Teleport(toFrost ? GoFrost.ArrivalPos : GoFrost.ReturnPos);
            if (_travel != null) _travel.gameObject.SetActive(false);
            return true;
        }

        /// <summary>발 자리에서 명소·발견 찾기 — 새로 찾은 수. 진단이 직접 부른다.</summary>
        public int Check(Vector3 feet)
        {
            if (!Contains(feet)) return 0;
            int n = 0;
            foreach (var s in GoFrost.Sites)
            {
                if (FrostState.Found(s.Id)) continue;
                if ((Flat(feet) - Flat(s.Pos)).magnitude > GoFrost.RadiusOf(s)) continue;
                if (!FrostState.Discover(s.Id)) continue;
                n++;
                LastFound = string.Format(GoLocalization.T("frost.found", "서리봉 고원 — {0} 발견! {1}"), s.Name, GoFrost.RewardText(s));
                if (DialogueLabel.Instance != null) DialogueLabel.Instance.Show(LastFound, 3.5f);
                FieldRingFx.Spawn(feet, 2.5f, new Color(0.7f, 0.9f, 1f), 0.5f);
            }
            return n;
        }
    }
}
