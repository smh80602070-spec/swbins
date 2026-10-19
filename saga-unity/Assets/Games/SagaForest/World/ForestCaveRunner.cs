using System.Collections.Generic;
using UnityEngine;
using UnityEngine.InputSystem;
using UnityEngine.Rendering;
using UnityEngine.UI;
using Saga.Core;
using Saga.Forest.Audio;
using Saga.Forest.Data;
using Saga.Forest.UI;

namespace Saga.Forest.World
{
    /// <summary>
    /// tasks U-0132 땅 아래 층(웹 W-0285·고돗 G-0242) — 바위 지대 동쪽 굴 입구(곁에서 F 또는 아래 단추) → 먼 평평한 방(-500,0,500 —
    /// 집 방 +500 과 안 겹침, 집처럼 구면 투영을 안 물린 평범한 Lit)을 층마다 다시 쓴다(<see cref="ForestCave"/> 가 규칙).
    /// 방 안 자리는 웹 방 좌표(타일 8×9)를 1.5m 로 옮겼다. 굴 안은 해(방향광)를 끄고 주변광·안개·하늘을 어둡게, 주인공 곁 점광은
    /// 어둠 2.5m / 횃불 9m — 나가면(또는 굴에서 멀어지면) 처음 값으로 되돌린다. 짐승·광맥은 몸·광석 에셋이 없어 도형 대역.
    /// 씬 재빌드 없이 `ForestBootstrap.Start` 가 <see cref="Install"/> 로 세운다(세이브 뒤라 굴 좌표에 저장된 주인공을 입구로 꺼낸다).
    /// </summary>
    public class ForestCaveRunner : MonoBehaviour
    {
        public static readonly Vector3 EntrancePos = new Vector3(30f, 0f, 14f);   // 바위 지대(25,20) 남동 — 화석 채집 자리(19,14)·선돌(25,27)과 떨어짐
        public static readonly Vector3 Pocket = new Vector3(-500f, 0f, 500f);
        public const float UseRadius = 2.2f, ReachRadius = 1.8f, TileM = 1.5f;
        private static readonly Vector3 OutLanding = EntrancePos + new Vector3(-2f, 0.1f, -2f);
        private static readonly Color[] FloorColors =
        {
            new Color(0.32f, 0.26f, 0.2f), new Color(0.36f, 0.28f, 0.2f), new Color(0.4f, 0.32f, 0.24f),   // 흙
            new Color(0.55f, 0.55f, 0.5f), new Color(0.5f, 0.5f, 0.48f),                                       // 석회
            new Color(0.45f, 0.18f, 0.1f),                                                                      // 용암
        };

        public static ForestCaveRunner Instance { get; private set; }

        private readonly Dictionary<ForestCave.Kind, Transform> _things = new Dictionary<ForestCave.Kind, Transform>();
        private Transform _player, _entrance, _entranceVisual;
        private CharacterController _cc;
        private Renderer _floorRenderer;
        private Light _lamp;
        private Button _hint;
        private ForestCave.Kind? _near;
        private bool _nearEntrance;

        // 어둠 전 값
        private bool _dark;
        private readonly List<Light> _sunsOff = new List<Light>();
        private AmbientMode _ambMode;
        private Color _ambSky, _ambEq, _ambGround, _ambFlat;
        private bool _fog;
        private CameraClearFlags _clear;
        private Color _bg;

        public bool Dark => _dark;
        public bool HintShown => _hint != null && _hint.gameObject.activeSelf;
        public string HintText => _hint != null ? SagaUi.Label(_hint) : null;
        public float LampRange => _lamp != null && _lamp.enabled ? _lamp.range : 0f;
        public Vector3 PosOf(ForestCave.Kind k) => _things[k].position;
        public bool Shown(ForestCave.Kind k) => _things[k].gameObject.activeSelf;

        public static ForestCaveRunner Install()
        {
            if (Instance != null) return Instance;
            return new GameObject("ForestCave").AddComponent<ForestCaveRunner>();
        }

        private void Awake()
        {
            Instance = this;
            BuildEntrance();
            BuildRoom();
            BuildUi();
            ForestCave.Changed += Layout;
            Layout();
        }

        private void Start()
        {
            ResolvePlayer();
            RescueIfStranded();
        }

        private void OnDestroy()
        {
            ForestCave.Changed -= Layout;
            if (_dark) SetDark(false);
            if (Instance == this) Instance = null;
        }

        private void ResolvePlayer()
        {
            var pl = GameObject.FindWithTag("Player");
            _player = pl != null ? pl.transform : null;
            _cc = pl != null ? pl.GetComponent<CharacterController>() : null;
        }

        /// <summary>층은 판 안 상태라 굴 좌표에 저장된 세이브를 불러오면 방에 갇힌다 — 입구 앞으로 꺼낸다(고돗 rescue_if_stranded).</summary>
        public void RescueIfStranded()
        {
            if (_player == null || ForestCave.Inside) return;
            if (Flat(_player.position - Pocket).magnitude < 40f) Teleport(OutLanding);
        }

        // ---- 짓기 ----

        private static Material Mat(string name, Color c) => new Material(Shader.Find("Universal Render Pipeline/Lit")) { name = name + " (generated)", color = c };

        private static Transform Box(Transform parent, string name, Vector3 pos, Vector3 size, Material m, PrimitiveType type = PrimitiveType.Cube)
        {
            var go = GameObject.CreatePrimitive(type);
            go.name = name;
            go.transform.SetParent(parent, false);
            go.transform.localPosition = pos;
            go.transform.localScale = size;
            go.GetComponent<MeshRenderer>().sharedMaterial = m;
            Colliders.Strip(go);
            return go.transform;
        }

        // 바위 굴 입구 — 기둥 둘·이맛돌·검은 구멍. 땅 휨은 돌무더기처럼 Visual 을 내려 맞춘다.
        private void BuildEntrance()
        {
            _entrance = new GameObject("CaveEntrance").transform;
            _entrance.SetParent(transform, false);
            _entrance.position = EntrancePos;
            _entrance.rotation = Quaternion.Euler(0f, 225f, 0f); // 입이 마을(원점) 쪽
            _entranceVisual = new GameObject("Visual").transform;
            _entranceVisual.SetParent(_entrance, false);
            var rock = Mat("ForestCaveRock", new Color(0.45f, 0.42f, 0.38f));
            Box(_entranceVisual, "PillarL", new Vector3(-1.3f, 1.2f, 0f), new Vector3(0.9f, 2.4f, 1.2f), rock);
            Box(_entranceVisual, "PillarR", new Vector3(1.3f, 1.2f, 0f), new Vector3(0.9f, 2.4f, 1.2f), rock);
            Box(_entranceVisual, "Lintel", new Vector3(0f, 2.6f, 0f), new Vector3(3.6f, 0.7f, 1.4f), rock);
            Box(_entranceVisual, "Mouth", new Vector3(0f, 1.1f, 0.3f), new Vector3(1.7f, 2.2f, 0.2f), Mat("ForestCaveMouth", new Color(0.03f, 0.03f, 0.04f)));
        }

        private static Vector3 Local(float tx, float ty) => new Vector3((tx - 4.5f) * TileM, 0f, (4.5f - ty) * TileM);

        // 웹 방 좌표 그대로(타일 8×9) — 위로 나가는 자리는 방 북쪽 문(웹 cavedoor).
        private void BuildRoom()
        {
            var room = new GameObject("CaveRoom").transform;
            room.SetParent(transform, false);
            room.position = Pocket;
            var floorMat = Mat("ForestCaveFloor", FloorColors[0]);
            _floorRenderer = Box(room, "CaveFloor", new Vector3(0f, -0.1f, 0f), new Vector3(9f * TileM, 0.2f, 10f * TileM), floorMat).GetComponent<Renderer>();
            _floorRenderer.gameObject.AddComponent<BoxCollider>(); // 바닥·벽은 밟고 막힌다 — Box 가 지운 충돌체를 다시 붙인다
            var wall = Mat("ForestCaveWall", new Color(0.22f, 0.2f, 0.18f));
            float hx = 4.5f * TileM, hz = 5f * TileM;
            foreach (var (p, s) in new[] { (new Vector3(0f, 2f, hz), new Vector3(hx * 2f, 4f, 0.4f)), (new Vector3(0f, 2f, -hz), new Vector3(hx * 2f, 4f, 0.4f)),
                                           (new Vector3(hx, 2f, 0f), new Vector3(0.4f, 4f, hz * 2f)), (new Vector3(-hx, 2f, 0f), new Vector3(0.4f, 4f, hz * 2f)) })
            {
                var w = Box(room, "CaveWall", p, s, wall);
                w.gameObject.AddComponent<BoxCollider>();
            }

            var wood = Mat("ForestCaveLadder", new Color(0.55f, 0.38f, 0.2f));
            Add(ForestCave.Kind.Up, room, Local(4.5f, 0.6f), t => Box(t, "UpLadder", new Vector3(0f, 1.2f, 0f), new Vector3(0.9f, 2.4f, 0.15f), wood));
            Add(ForestCave.Kind.Torch, room, Local(1.5f, 1.8f), t =>
            {
                Box(t, "TorchPost", new Vector3(0f, 0.6f, 0f), new Vector3(0.18f, 1.2f, 0.18f), wood, PrimitiveType.Cylinder);
                Box(t, "TorchBowl", new Vector3(0f, 1.25f, 0f), new Vector3(0.5f, 0.15f, 0.5f), Mat("ForestCaveBowl", new Color(0.3f, 0.3f, 0.32f)), PrimitiveType.Cylinder);
                Box(t, "Flame", new Vector3(0f, 1.5f, 0f), new Vector3(0.35f, 0.45f, 0.35f), Mat("ForestCaveFlame", new Color(1f, 0.55f, 0.15f)), PrimitiveType.Sphere);
            });
            var ore = Mat("ForestCaveOre", new Color(0.75f, 0.3f, 0.45f));
            Add(ForestCave.Kind.Ore0, room, Local(2.5f, 3.5f), t => Box(t, "Vein", new Vector3(0f, 0.5f, 0f), new Vector3(1f, 1f, 0.8f), ore));
            Add(ForestCave.Kind.Ore1, room, Local(6.5f, 3.5f), t => Box(t, "Vein", new Vector3(0f, 0.5f, 0f), new Vector3(1f, 1f, 0.8f), ore));
            Add(ForestCave.Kind.Beast, room, Local(4.5f, 6.2f), t => Box(t, "BeastBody", new Vector3(0f, 0.6f, 0f), new Vector3(0.9f, 0.6f, 1.3f), Mat("ForestCaveBeast", new Color(0.15f, 0.13f, 0.12f)), PrimitiveType.Capsule));
            Add(ForestCave.Kind.Ladder, room, Local(4.5f, 8.1f), t => Box(t, "DownHole", new Vector3(0f, 0.02f, 0f), new Vector3(1.4f, 0.04f, 1.4f), Mat("ForestCaveHole", new Color(0.02f, 0.02f, 0.02f)), PrimitiveType.Cylinder));
            Add(ForestCave.Kind.Relic, room, Local(4.5f, 8.1f), t => Box(t, "Relic", new Vector3(0f, 0.45f, 0f), new Vector3(0.6f, 0.9f, 0.6f), Mat("ForestCaveRelic", new Color(0.8f, 0.65f, 0.3f)), PrimitiveType.Cylinder));

            var lampGo = new GameObject("CaveLamp");
            lampGo.transform.SetParent(transform, false);
            _lamp = lampGo.AddComponent<Light>();
            _lamp.type = LightType.Point;
            _lamp.color = new Color(1f, 0.82f, 0.6f);
            _lamp.intensity = 2.2f;
            _lamp.shadows = LightShadows.None;
            _lamp.enabled = false;
        }

        private void Add(ForestCave.Kind k, Transform room, Vector3 local, System.Action<Transform> build)
        {
            var t = new GameObject("Cave_" + k).transform;
            t.SetParent(room, false);
            t.localPosition = local;
            build(t);
            _things[k] = t;
        }

        private void BuildUi()
        {
            SagaUi.EnsureEventSystem();
            var canvas = SagaUi.NewHudCanvas("CaveCanvas", 93, transform);
            _hint = SagaUi.NewButton(canvas.transform, "CaveHint", "", new Vector2(0.5f, 0f), new Vector2(0f, 150f), new Vector2(560f, 64f), SagaUi.ButtonAccent, 24f);
            _hint.onClick.AddListener(Use);
            _hint.gameObject.SetActive(false);
        }

        /// <summary>층이 바뀌거나 무엇을 하면 — 있는 것만 보이고, 쫓은 짐승·가져간 유물은 숨고, 바닥 빛이 층을 따른다.</summary>
        private void Layout()
        {
            int f = Mathf.Max(0, ForestCave.Floor);
            var on = new HashSet<ForestCave.Kind>(ForestCave.KindsOn(f));
            foreach (var kv in _things)
            {
                bool show = on.Contains(kv.Key);
                if (kv.Key == ForestCave.Kind.Beast && ForestCave.IsShooed(f)) show = false;
                if (kv.Key == ForestCave.Kind.Relic && ForestCave.RelicTaken) show = false;
                if (kv.Value.gameObject.activeSelf != show) kv.Value.gameObject.SetActive(show);
            }
            _things[ForestCave.Kind.Torch].Find("Flame").gameObject.SetActive(ForestCave.Lit);
            if (_floorRenderer != null) _floorRenderer.sharedMaterial.color = FloorColors[Mathf.Clamp(f, 0, FloorColors.Length - 1)];
        }

        // ---- 매 프레임 ----

        private static Vector3 Flat(Vector3 v) => new Vector3(v.x, 0f, v.z);

        private void Update()
        {
            if (_player == null) { ResolvePlayer(); if (_player == null) return; }
            if (ForestCave.Inside && Flat(_player.position - Pocket).magnitude > 40f) { ForestCave.Leave(); SetDark(false); } // 탈것·순간이동 등으로 빠져나감
            Sense();
            if (_dark)
            {
                _lamp.transform.position = _player.position + Vector3.up * 1.6f;
                _lamp.range = ForestCave.Sight;
                bool flame = ForestCave.Lit;
                var fl = _things[ForestCave.Kind.Torch].Find("Flame").gameObject;
                if (fl.activeSelf != flame) fl.SetActive(flame);
            }
            var kb = Keyboard.current;
            if (kb != null && kb.fKey.wasPressedThisFrame && (_near.HasValue || _nearEntrance)) Use();
        }

        private void LateUpdate()
        {
            if (_player == null || _entranceVisual == null) return;
            Vector3 d = EntrancePos - _player.position;
            _entranceVisual.localPosition = new Vector3(0f, -(d.x * d.x + d.z * d.z) * ForestLandmark.CurveAmount, 0f);
        }

        /// <summary>곁에 선 것을 찾아 힌트 단추를 맞춘다. 진단도 부른다.</summary>
        public void Sense()
        {
            _near = null;
            _nearEntrance = false;
            string label = null;
            if (!ForestCave.Inside)
            {
                _nearEntrance = Flat(_player.position - EntrancePos).magnitude <= UseRadius;
                if (_nearEntrance) label = ForestLocalization.T("cave.lbl_enter", "⛰️ 굴로 들어간다");
            }
            else
            {
                float best = ReachRadius;
                foreach (var k in ForestCave.KindsOn(ForestCave.Floor))
                {
                    if (!_things[k].gameObject.activeSelf) continue; // 쫓은 짐승·가져간 유물
                    float d = Flat(_player.position - _things[k].position).magnitude;
                    if (d < best) { best = d; _near = k; }
                }
                if (_near.HasValue) label = ForestCave.Label(_near.Value);
            }
            bool show = label != null;
            if (show) _hint.GetComponentInChildren<TMPro.TMP_Text>().text = label + " (F)";
            if (_hint.gameObject.activeSelf != show) _hint.gameObject.SetActive(show);
        }

        /// <summary>F·힌트 단추 — 입구면 들어가고, 굴 안이면 곁의 것을 한다.</summary>
        public void Use()
        {
            if (!ForestCave.Inside) { if (_nearEntrance) EnterCave(); return; }
            if (_near.HasValue) Act(_near.Value);
        }

        public void EnterCave()
        {
            ForestCave.Enter();
            SetDark(true);
            Teleport(Pocket + Local(4.5f, 0.6f) + new Vector3(0f, 0.1f, -TileM));
            DialogueLabel.Instance?.Show(ForestLocalization.T("cave.enter", "⛰️ 굴 입구 방 — 사다리로 내려가면 땅 아래 층이다"), 3f);
        }

        /// <summary>그 자리의 것을 한다 — 결과 글을 자막으로. 진단이 곧장 부른다.</summary>
        public bool Act(ForestCave.Kind k)
        {
            string text;
            bool ok;
            switch (k)
            {
                case ForestCave.Kind.Torch: ok = ForestCave.LightTorch(out text); break;
                case ForestCave.Kind.Ore0: ok = ForestCave.Dig(0, out text); break;
                case ForestCave.Kind.Ore1: ok = ForestCave.Dig(1, out text); break;
                case ForestCave.Kind.Beast: ok = ForestCave.Shoo(out text); break;
                case ForestCave.Kind.Relic: ok = ForestCave.TakeRelic(out text); break;
                case ForestCave.Kind.Ladder:
                    ok = ForestCave.Down(out text);
                    if (ok) Teleport(Pocket + Local(4.5f, 0.6f) + new Vector3(0f, 0.1f, -TileM));
                    break;
                default:
                    ok = ForestCave.Up(out text);
                    if (!ok) { SetDark(false); Teleport(OutLanding); ok = true; }
                    else Teleport(Pocket + Local(4.5f, 8.1f) + new Vector3(0f, 0.1f, TileM)); // 윗층 사다리(구멍) 곁
                    break;
            }
            if (text != null) DialogueLabel.Instance?.Show(text, 3f);
            if (ok && (k == ForestCave.Kind.Ore0 || k == ForestCave.Kind.Ore1 || k == ForestCave.Kind.Relic))
            {
                // 채집 손맛만(ForestGatherFeel.Play 는 연속 채집 덤 열매를 줘 광맥 수가 흔들린다).
                ForestGatherPopup.Spawn(_things[k].position + Vector3.up * 1.2f, k == ForestCave.Kind.Relic ? "🏺" : "⛏️", false);
                ForestGatherBump.Apply(_things[k]);
                ForestAudio.PlaySfx("item_pick", null);
            }
            return ok;
        }

        private void Teleport(Vector3 pos)
        {
            if (_player == null) ResolvePlayer();
            if (_player == null) return;
            if (_cc != null) _cc.enabled = false;
            _player.position = pos;
            if (_cc != null) _cc.enabled = true;
        }

        /// <summary>굴 안 어둠 켜고 끄기 — 끌 때는 켤 때 떠 둔 값으로 되돌린다(해·주변광·안개·하늘).</summary>
        public void SetDark(bool on)
        {
            if (on == _dark) return;
            _dark = on;
            var cam = Camera.main;
            if (on)
            {
                _sunsOff.Clear();
                foreach (var l in Object.FindObjectsByType<Light>(FindObjectsSortMode.None))
                    if (l.type == LightType.Directional && l.enabled) { l.enabled = false; _sunsOff.Add(l); }
                _ambMode = RenderSettings.ambientMode; _ambSky = RenderSettings.ambientSkyColor; _ambEq = RenderSettings.ambientEquatorColor;
                _ambGround = RenderSettings.ambientGroundColor; _ambFlat = RenderSettings.ambientLight; _fog = RenderSettings.fog;
                RenderSettings.ambientMode = AmbientMode.Flat;
                RenderSettings.ambientLight = new Color(0.06f, 0.055f, 0.06f);
                RenderSettings.fog = false;
                if (cam != null) { _clear = cam.clearFlags; _bg = cam.backgroundColor; cam.clearFlags = CameraClearFlags.SolidColor; cam.backgroundColor = Color.black; }
                _lamp.enabled = true;
            }
            else
            {
                foreach (var l in _sunsOff) if (l != null) l.enabled = true;
                _sunsOff.Clear();
                RenderSettings.ambientMode = _ambMode; RenderSettings.ambientSkyColor = _ambSky; RenderSettings.ambientEquatorColor = _ambEq;
                RenderSettings.ambientGroundColor = _ambGround; RenderSettings.ambientLight = _ambFlat; RenderSettings.fog = _fog;
                if (cam != null) { cam.clearFlags = _clear; cam.backgroundColor = _bg; }
                _lamp.enabled = false;
            }
        }
    }
}
