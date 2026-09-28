using System.Collections.Generic;
using UnityEngine;
using Saga.Go.Combat;
using Saga.Go.Data;
using Saga.Go.Player;
using Saga.Go.UI;

namespace Saga.Go.World
{
    /// <summary>
    /// PLAN.md 109-14-24 낚시(웹 사가고 ⑲-24) — 낚시터 넷(서는 자리 푸른 빛)·물고기 그림자(원반)·찌·줄·고리·게시판(상자 셋)을 도형만으로 세우고,
    /// 매 프레임 `FishingFlow` 를 돌린다(발 자리·싸움 중 여부 넘김). 겨누는 동안은 걸음을 잠그고(`PlayerController.MoveLocked`) 방향 입력이 고리를 옮긴다 —
    /// 점프하면 풀림(낚시 끝). `WorldMapBuilder` 가 Play 때 붙인다(씬 재빌드 없음). 물 높이는 강 칸 수면 하나(`TestMapData.WaterSurfaceHeight`).
    /// </summary>
    public class FishingField : MonoBehaviour
    {
        public static FishingField Instance { get; private set; }
        /// <summary>낚시 중인가 — 들판 전투(`CanAct`)와 이야기 F(`StoryUi`)가 비킨다.</summary>
        public static bool Busy => Instance != null && Instance.Flow.Busy;

        public readonly FishingFlow Flow = new FishingFlow();
        /// <summary>진단 — 켜면 프레임이 흐름을 안 돌린다(진단이 `Flow.Step` 을 직접 부른다).</summary>
        public bool Paused;

        private sealed class SpotFx
        {
            public GameObject Root, Halo;
            public Transform[] Fish;
        }

        private readonly Dictionary<string, SpotFx> _fx = new Dictionary<string, SpotFx>();
        private readonly Dictionary<string, Material> _mats = new Dictionary<string, Material>();
        private GameObject _gear;
        private Transform _bob;
        private LineRenderer _line, _ring;
        private bool _lockedByMe;
        private float _surfaceY;

        public Vector3 StandPos(string spotId) => _fx.TryGetValue(spotId, out var f) ? f.Root.transform.position : Vector3.zero;

        /// <summary>게시판 곁 서는 자리(땅에 앉힌 높이) — 게시판 낚시터만.</summary>
        public Vector3 BoardPos(GoFishing.Spot sp) => FolkWalker.Grounded(new Vector3(sp.BoardPos.x, 0f, sp.BoardPos.y));

        private void Awake()
        {
            Instance = this;
            _surfaceY = TestMapData.WaterSurfaceHeight;
            Flow.Say += OnSay;
        }

        private void OnDestroy()
        {
            Flow.Say -= OnSay;
            if (Instance == this) Instance = null;
        }

        private void Start() => Rebuild();

        private static void OnSay(string text)
        {
            if (DialogueLabel.Instance != null) DialogueLabel.Instance.Show(text, 2.5f);
        }

        // ---- 그림 ----

        private Material Mat(string key, Color c, float glow)
        {
            if (_mats.TryGetValue(key, out var m)) return m;
            m = new Material(Shader.Find("Universal Render Pipeline/Lit")) { name = "Fishing_" + key + " (generated)", color = c };
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

        public void Rebuild()
        {
            foreach (Transform c in transform) if (c.name.StartsWith("Fishing_")) Destroy(c.gameObject);
            _fx.Clear();
            foreach (var sp in GoFishing.Spots) _fx[sp.Id] = Build(sp);
            BuildGear();
        }

        private SpotFx Build(GoFishing.Spot sp)
        {
            var fx = new SpotFx { Root = new GameObject("Fishing_" + sp.Id) };
            fx.Root.transform.SetParent(transform, false);
            fx.Root.transform.position = FolkWalker.Grounded(new Vector3(sp.Stand.x, 0f, sp.Stand.y));
            fx.Halo = Prim(PrimitiveType.Cylinder, fx.Root.transform, new Vector3(0f, 0.04f, 0f), new Vector3(GoFishing.StandR * 0.9f, 0.02f, GoFishing.StandR * 0.9f), Mat("halo", new Color(0.43f, 0.78f, 1f), 1.2f));
            var shadow = Mat("shadow", new Color(0.04f, 0.1f, 0.13f), 0f);
            fx.Fish = new Transform[GoFishing.FishPerSpot];
            for (int i = 0; i < fx.Fish.Length; i++)
            {
                var d = GoFishing.FishOf(sp.Fish[i]);
                var go = Prim(PrimitiveType.Sphere, transform, Vector3.zero, new Vector3(d.Len * GoFishing.ShadowScale * 1.6f, 0.03f, d.Len * GoFishing.ShadowScale * 0.6f), shadow);
                go.name = "Fishing_shadow_" + sp.Id + "_" + i;
                fx.Fish[i] = go.transform;
            }
            if (sp.Board) BuildBoard(sp, fx.Root.transform);
            return fx;
        }

        /// <summary>게시판 — 기둥 둘·판자·종이(웹 상자 셋). 물을 등지고 선다(글이 물 쪽에서 보이게).</summary>
        private void BuildBoard(GoFishing.Spot sp, Transform parent)
        {
            var wood = Mat("board_wood", new Color(0.48f, 0.35f, 0.23f), 0f);
            var paper = Mat("board_paper", new Color(0.91f, 0.86f, 0.75f), 0f);
            var root = new GameObject("Fishing_board_" + sp.Id);
            root.transform.SetParent(transform, false);
            root.transform.position = FolkWalker.Grounded(new Vector3(sp.BoardPos.x, 0f, sp.BoardPos.y));
            root.transform.rotation = Quaternion.LookRotation(new Vector3(sp.Dir.x, 0f, sp.Dir.y));
            foreach (float ox in new[] { -1.3f, 1.3f })
                Prim(PrimitiveType.Cube, root.transform, new Vector3(ox, 1.6f, 0f), new Vector3(0.22f, 3.2f, 0.22f), wood);
            Prim(PrimitiveType.Cube, root.transform, new Vector3(0f, 2.5f, 0f), new Vector3(3.1f, 1.7f, 0.15f), wood);
            Prim(PrimitiveType.Cube, root.transform, new Vector3(0f, 2.5f, 0.1f), new Vector3(2.4f, 1.1f, 0.04f), paper);
        }

        private void BuildGear()
        {
            if (_gear != null) Destroy(_gear);
            _gear = new GameObject("Fishing_gear");
            _gear.transform.SetParent(transform, false);
            _bob = Prim(PrimitiveType.Sphere, _gear.transform, Vector3.zero, Vector3.one * 0.28f, Mat("bob", new Color(1f, 0.29f, 0.23f), 0.4f)).transform;
            var lineMat = new Material(Shader.Find("Sprites/Default")) { name = "Fishing_line (generated)" };
            _line = _gear.AddComponent<LineRenderer>();
            _line.useWorldSpace = true;
            _line.positionCount = 2;
            _line.startWidth = _line.endWidth = 0.04f;
            _line.material = lineMat;
            _line.startColor = _line.endColor = new Color(0.95f, 0.95f, 0.95f, 0.75f);
            _line.shadowCastingMode = UnityEngine.Rendering.ShadowCastingMode.Off;
            var ringGo = new GameObject("Fishing_ring");
            ringGo.transform.SetParent(_gear.transform, false);
            _ring = ringGo.AddComponent<LineRenderer>();
            _ring.useWorldSpace = false;
            _ring.loop = true;
            _ring.positionCount = 32;
            _ring.startWidth = _ring.endWidth = 0.12f;
            _ring.material = new Material(Shader.Find("Sprites/Default")) { name = "Fishing_ring (generated)" };
            _ring.startColor = _ring.endColor = new Color(1f, 0.88f, 0.54f, 0.9f);
            _ring.shadowCastingMode = UnityEngine.Rendering.ShadowCastingMode.Off;
            const float r = 1.6f;
            for (int i = 0; i < 32; i++)
            {
                float a = i * Mathf.PI * 2f / 32f;
                _ring.SetPosition(i, new Vector3(Mathf.Cos(a) * r, 0f, Mathf.Sin(a) * r));
            }
            _gear.SetActive(false);
        }

        // ---- 프레임 ----

        private static Vector2 Flat(Vector3 p) => new Vector2(p.x, p.z);

        private void Update()
        {
            var fc = FieldCombat.Instance;
            if (fc != null && !Paused) Tick(Time.deltaTime, fc);
            Paint(fc != null ? fc.transform.position : Vector3.zero);
        }

        /// <summary>한 틱 — 흐름·걸음 잠금·고리 옮기기.</summary>
        public void Tick(float dt, FieldCombat fc)
        {
            var pc = fc.GetComponent<PlayerController>();
            Vector3 feet = fc.transform.position;
            bool aim = Flow.State == FishingFlow.Phase.Aim;
            if (pc != null)
            {
                if (aim && pc.AimCancelled) { pc.AimCancelled = false; pc.MoveLocked = false; _lockedByMe = false; Flow.Last = "jump"; Flow.End(); aim = false; }
                if (aim && !_lockedByMe) { pc.MoveLocked = true; pc.AimCancelled = false; _lockedByMe = true; }
                if (aim) Flow.Nudge(pc.AimInput.y, pc.AimInput.x, dt);
            }
            Flow.Step(dt, Flat(feet), fc.InCombat());
            if (pc != null && _lockedByMe && Flow.State != FishingFlow.Phase.Aim) { pc.MoveLocked = false; _lockedByMe = false; }
        }

        private void Paint(Vector3 player)
        {
            Vector2 p = Flat(player);
            bool idle = Flow.State == FishingFlow.Phase.Idle;
            foreach (var sp in GoFishing.Spots)
            {
                if (!_fx.TryGetValue(sp.Id, out var fx)) continue;
                bool near = Vector2.Distance(sp.Cast, p) < 90f * GoFishing.Sc;
                fx.Halo.SetActive(idle && near);
                var list = Flow.Fish(sp);
                for (int i = 0; i < fx.Fish.Length; i++)
                {
                    bool show = near && FishState.Present(sp.Id, list[i].Idx);
                    fx.Fish[i].gameObject.SetActive(show);
                    if (!show) continue;
                    Vector2 v = list[i].Target - list[i].P;
                    fx.Fish[i].position = new Vector3(list[i].P.x, _surfaceY - 0.15f, list[i].P.y);
                    if (v.sqrMagnitude > 1e-4f) fx.Fish[i].rotation = Quaternion.Euler(0f, Mathf.Atan2(v.x, v.y) * Mathf.Rad2Deg - 90f, 0f);
                }
            }
            if (_gear == null) return;
            if (idle) { _gear.SetActive(false); return; }
            _gear.SetActive(true);
            bool aim = Flow.State == FishingFlow.Phase.Aim;
            _ring.gameObject.SetActive(aim);
            _ring.transform.position = new Vector3(Flow.Reticle.x, _surfaceY + 0.05f, Flow.Reticle.y);
            _bob.gameObject.SetActive(!aim);
            _line.enabled = !aim;
            float dip = Flow.State == FishingFlow.Phase.Bite ? 0.25f
                : Flow.State == FishingFlow.Phase.Nibble ? Mathf.Max(0f, Mathf.Sin(Flow.T * 14f)) * 0.1f
                : Flow.State == FishingFlow.Phase.Reel ? Mathf.Abs(Mathf.Sin(Flow.Clock * 11f)) * 0.12f : 0f;
            _bob.position = new Vector3(Flow.Float.x, _surfaceY + 0.08f - dip, Flow.Float.y);
            Vector3 hand = player + new Vector3(Flow.Spot != null ? Flow.Spot.Dir.x : 0f, 0f, Flow.Spot != null ? Flow.Spot.Dir.y : 0f) * 1.4f + Vector3.up * 1.3f;
            _line.SetPosition(0, hand);
            _line.SetPosition(1, _bob.position + Vector3.up * 0.1f);
        }
    }
}
