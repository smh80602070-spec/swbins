using System.Collections.Generic;
using UnityEngine;
using UnityEngine.InputSystem;
using UnityEngine.Rendering;
using UnityEngine.Rendering.Universal;
using Saga.Go.Combat;
using Saga.Go.Data;

namespace Saga.Go.World
{
    /// <summary>
    /// PLAN.md 109-14-3b 원소 시야(웹 사가만리 ⑲-3) — V 를 누르는 동안(폰은 HUD "시야" 단추로 켜고 끔) 전역 Volume(채도 −70·노출 −0.6)을 0.2초에 걸쳐 올리고,
    /// 켜는 순간 83m 물결 고리, 0.25초마다 짚기 빛기둥(`GoSight`)과 흔적 점을 다시 세운다. 결투·등장 컷 중엔 꺼진다. 이동·전투는 안 막는다.
    /// `WorldMapBuilder` 가 Play 때 붙인다(씬 재빌드 없음). 빛기둥은 발광 세기가 높아 잿빛 속에서도 빛깔이 남는다.
    /// </summary>
    public class ElementalSight : MonoBehaviour
    {
        public static ElementalSight Instance { get; private set; }

        /// <summary>폰 "시야" 단추가 켜 둔 상태.</summary>
        public bool Toggled { get; set; }
        public bool On { get; private set; }
        public float Weight => _volume != null ? _volume.weight : 0f;
        public readonly List<(GoSight.Mark mark, Vector3 pos, Color color)> Marks = new List<(GoSight.Mark, Vector3, Color)>();
        public readonly List<Vector3> TrailPoints = new List<Vector3>();

        private bool _testHeld;
        private Volume _volume;
        private Transform _markRoot;
        private float _wait;
        private readonly Dictionary<Color, Material> _mats = new Dictionary<Color, Material>();

        private void Awake()
        {
            Instance = this;
            var go = new GameObject("ElementalSightVolume");
            go.transform.SetParent(transform, false);
            _volume = go.AddComponent<Volume>();
            _volume.isGlobal = true;
            _volume.priority = 60f;
            _volume.weight = 0f;
            var profile = ScriptableObject.CreateInstance<VolumeProfile>();
            var ca = profile.Add<ColorAdjustments>(true);
            ca.saturation.Override(GoSight.Saturation);
            ca.postExposure.Override(GoSight.Exposure);
            _volume.sharedProfile = profile;
            _markRoot = new GameObject("SightMarks").transform;
            _markRoot.SetParent(transform, false);
        }

        private void OnDestroy() { if (Instance == this) Instance = null; }

        /// <summary>진단 — V 를 누른 것처럼.</summary>
        public void SetHeldForTest(bool held) => _testHeld = held;

        private void Update() => Tick(Time.deltaTime);

        /// <summary>한 틱 — 진단이 시간을 건너뛰려고 직접 부른다.</summary>
        public void Tick(float dt)
        {
            var kb = Keyboard.current;
            bool held = _testHeld || Toggled || (kb != null && kb.vKey.isPressed);
            bool blocked = DuelGate.Active || Saga.Go.Cinematics.GoCutscenes.Playing;
            bool want = held && !blocked;
            var fc = FieldCombat.Instance;
            if (want && !On && fc != null)
                FieldRingFx.Spawn(fc.transform.position, GoSight.Range, new Color(0.85f, 0.9f, 1f), GoSight.RippleSec); // 켜는 순간 퍼지는 물결
            if (!want && On) Clear();
            On = want;
            _volume.weight = Mathf.MoveTowards(_volume.weight, On ? 1f : 0f, dt / GoSight.FadeSec);
            if (!On) return;
            _wait -= dt;
            if (_wait > 0f) return;
            _wait = GoSight.RefreshSec;
            if (fc != null) Refresh(fc.transform.position);
        }

        /// <summary>짚기·흔적을 다시 모으고 세운다.</summary>
        public void Refresh(Vector3 player)
        {
            Clear();
            var builder = WorldMapBuilder.Instance;
            Vector3? nearest = null;
            float best = float.MaxValue;
            void Near(Vector3 p)
            {
                Vector3 d = p - player; d.y = 0f;
                float m = d.magnitude;
                if (m <= GoSight.TrailRange && m < best) { best = m; nearest = p; }
            }

            if (builder != null)
            {
                foreach (var c in builder.Chests)
                {
                    if (c == null) continue;
                    if (!c.Opened)
                    {
                        Near(c.transform.position);
                        Add(GoSight.Mark.Chest, c.transform.position, GoSight.ChestColor, player);
                    }
                    foreach (var t in c.Torches)
                        if (t != null && !t.Lit) Add(GoSight.Mark.Torch, t.transform.position, GoSight.ColorOf(GoSight.Mark.Torch, t.Element), player);
                    if (!c.Opened && !c.Unlocked) // 109-14-22 안 맞힌 과녁 — 흰 점
                        for (int i = 0; i < c.Targets.Count; i++) if (!c.TargetLit(i)) Add(GoSight.Mark.Torch, c.TargetEye(i), Color.white, player);
                }
                foreach (var s in builder.Stones)
                    if (s != null && !WorldMapState.IsActive(s.Data.Id)) Add(GoSight.Mark.Landmark, s.transform.position, GoSight.LandmarkColor, player);
                if (builder.Tower != null && !WorldMapState.Revealed) Add(GoSight.Mark.Landmark, builder.Tower.TopCenter, GoSight.LandmarkColor, player);
            }
            foreach (var p in GoWorldMap.Peaks)
                if (!WorldMapState.IsPeakFound(p.Id)) Add(GoSight.Mark.Landmark, p.Top, GoSight.LandmarkColor, player);
            var orbs = GoOrbField.Instance;
            foreach (var o in GoOrbs.All)
            {
                if (OrbState.Has(o.Id)) continue;
                Vector3 op = orbs != null ? orbs.PosOf(o.Id) : o.Pos;
                Near(op);
                Add(GoSight.Mark.Orb, op, GoSight.OrbColor, player);
            }
            foreach (var e in FieldEnemy.All)
                if (e != null && e.Alive && e.isActiveAndEnabled) Add(GoSight.Mark.Enemy, e.transform.position, GoSight.ColorOf(GoSight.Mark.Enemy, e.Element), player);

            if (nearest.HasValue)
                foreach (var tp in GoSight.Trail(player, nearest.Value))
                {
                    Vector3 g = FolkWalker.Grounded(new Vector3(tp.x, player.y + 1f, tp.z)) + Vector3.up * 0.4f;
                    TrailPoints.Add(g);
                    Spawn(PrimitiveType.Sphere, g, new Vector3(0.5f, 0.5f, 0.5f), GoSight.OrbColor, "Trail");
                }
        }

        private void Add(GoSight.Mark mark, Vector3 pos, Color color, Vector3 player)
        {
            if (!GoSight.InRange(player, pos, GoSight.Range)) return;
            Marks.Add((mark, pos, color));
            // 빛기둥 — 표적 위로 곧게(짚은 것이 멀리서도 보이게)
            Spawn(PrimitiveType.Cylinder, pos + Vector3.up * 5f, new Vector3(0.35f, 5f, 0.35f), color, "Mark_" + mark);
        }

        private void Spawn(PrimitiveType type, Vector3 pos, Vector3 scale, Color color, string name)
        {
            var go = GameObject.CreatePrimitive(type);
            go.name = name;
            Destroy(go.GetComponent<Collider>());
            go.transform.SetParent(_markRoot, false);
            go.transform.position = pos;
            go.transform.localScale = scale;
            if (!_mats.TryGetValue(color, out var m) || m == null)
            {
                m = new Material(Shader.Find("Universal Render Pipeline/Lit")) { name = "SightMark (generated)", color = color };
                m.EnableKeyword("_EMISSION");
                m.SetColor("_EmissionColor", color * 4f);
                _mats[color] = m;
            }
            var r = go.GetComponent<MeshRenderer>();
            r.sharedMaterial = m;
            r.shadowCastingMode = ShadowCastingMode.Off;
        }

        private void Clear()
        {
            Marks.Clear();
            TrailPoints.Clear();
            for (int i = _markRoot.childCount - 1; i >= 0; i--) Destroy(_markRoot.GetChild(i).gameObject);
        }
    }
}
