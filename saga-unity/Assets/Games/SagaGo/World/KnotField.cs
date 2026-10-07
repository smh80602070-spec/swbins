using System.Collections.Generic;
using UnityEngine;
using Saga.Go.Data;
using Saga.Go.Player;

namespace Saga.Go.World
{
    /// <summary>
    /// PLAN.md 109-14-52 이야기 8부 무대(웹 사가만리 ⑲-52 `stormeye.js`) — 새 고정 지역 없이 첫 지역들로 돌아온다.
    /// 여섯 매듭(1부 여섯 제단 자리 북쪽의 금줄 감은 돌 — 26장을 마친 뒤부터 보이고, 풀린 건 먹구름 연기·묶이면 불 + 금빛 줄) ·
    /// 먹구름 눈(구름섬 서쪽 하늘에 뜬 판 — 28장 9째 단계부터 서고, 29장 보스 뒤엔 소용돌이가 걷혀 맑은 뜰) · 구름섬에서 눈으로 가는 바람 기둥(29장부터).
    /// 그림은 코드 도형(SAGA-DESIGN §7).
    /// </summary>
    public class KnotField : MonoBehaviour
    {
        public static KnotField Instance { get; private set; }

        private readonly Dictionary<string, Material> _mats = new Dictionary<string, Material>();
        private readonly GameObject[] _stone = new GameObject[6], _smoke = new GameObject[6], _fire = new GameObject[6];
        private readonly LineRenderer[] _beam = new LineRenderer[6];
        private GameObject _eye, _swirl, _meadow, _lantern, _pillar;
        private readonly List<LineRenderer> _rings = new List<LineRenderer>();
        private PlayerController.DraftCol _col;
        private bool _colOn;
        private float _t, _wait;
        private bool _built;

        public bool KnotShown(int k) => _stone[k] != null && _stone[k].activeSelf;
        public bool SmokeShown(int k) => _smoke[k] != null && _smoke[k].activeSelf;
        public bool FireShown(int k) => _fire[k] != null && _fire[k].activeSelf;
        private readonly int[] _mode = new int[6];
        public int BeamNow(int k) => _mode[k];
        public bool EyeShown => _eye != null && _eye.activeSelf;
        public bool SwirlShown => _swirl != null && _swirl.activeSelf;
        public bool MeadowShown => _meadow != null && _meadow.activeSelf;
        public bool PillarOn => _colOn;
        public bool LanternGold { get; private set; }

        private void Awake() { Instance = this; }
        private void OnDestroy() { if (_colOn) PlayerController.ExtraDrafts.Remove(_col); if (Instance == this) Instance = null; }

        private void Start() { Build(); Refresh(); }

        private Material Mat(string key, Color c, float glow = 0f, float smooth = 0.15f, float metal = 0f)
        {
            if (_mats.TryGetValue(key, out var m)) return m;
            m = new Material(Shader.Find("Universal Render Pipeline/Lit")) { name = "Knot_" + key + " (generated)", color = c };
            m.SetFloat("_Smoothness", smooth);
            m.SetFloat("_Metallic", metal);
            if (glow > 0f) { m.EnableKeyword("_EMISSION"); m.SetColor("_EmissionColor", c * glow); }
            _mats[key] = m;
            return m;
        }

        private void Build()
        {
            if (_built) return;
            _built = true;
            var stone = Mat("stone", new Color(0.5f, 0.5f, 0.54f));
            var gold = Mat("gold", new Color(0.95f, 0.78f, 0.3f), 1.2f, 0.6f, 0.6f);
            var smokeM = Mat("smoke", new Color(0.22f, 0.18f, 0.28f));
            var fireM = Mat("fire", new Color(1f, 0.6f, 0.2f), 3f);
            var beamMat = new Material(Shader.Find("Sprites/Default")) { name = "KnotBeam (generated)" };
            for (int k = 0; k < 6; k++)
            {
                var root = new GameObject("Knot_" + k);
                root.transform.SetParent(transform, false);
                root.SetActive(false);
                _stone[k] = root;
                Vector3 b = FolkWalker.Grounded(GoStory.KnotBase(k) + Vector3.up * 2f);
                AreaField.P(PrimitiveType.Cylinder, root.transform, "Knot_stone", b + Vector3.up * 0.7f, new Vector3(0.55f, 0.7f, 0.55f), stone, true);
                AreaField.P(PrimitiveType.Cylinder, root.transform, "Knot_rope", b + Vector3.up * 0.95f, new Vector3(0.62f, 0.07f, 0.62f), gold, false);
                _smoke[k] = new GameObject("Knot_smoke");
                _smoke[k].transform.SetParent(root.transform, false);
                for (int i = 0; i < 3; i++)
                    AreaField.P(PrimitiveType.Sphere, _smoke[k].transform, "Knot_smoke_puff", b + new Vector3(0.2f * i, 1.9f + i * 0.85f, 0f), Vector3.one * (0.9f - i * 0.2f), smokeM, false);
                _fire[k] = new GameObject("Knot_fire");
                _fire[k].transform.SetParent(root.transform, false);
                AreaField.P(PrimitiveType.Sphere, _fire[k].transform, "Knot_flame", b + Vector3.up * 1.9f, new Vector3(0.55f, 0.9f, 0.55f), fireM, false);
                var bl = new GameObject("Knot_beam");
                bl.transform.SetParent(root.transform, false);
                var lr = bl.AddComponent<LineRenderer>();
                lr.useWorldSpace = true;
                lr.positionCount = 2;
                lr.widthMultiplier = 0.4f;
                lr.material = beamMat;
                lr.startColor = lr.endColor = new Color(1f, 0.85f, 0.4f, 0.75f);
                lr.shadowCastingMode = UnityEngine.Rendering.ShadowCastingMode.Off;
                lr.SetPosition(0, b + Vector3.up * 2.4f);
                lr.SetPosition(1, b + Vector3.up * GoStory.KnotBeamUp);
                bl.SetActive(false);
                _beam[k] = lr;
            }
            // 먹구름 눈
            var eyeRoot = new GameObject("Eye_island");
            eyeRoot.transform.SetParent(transform, false);
            eyeRoot.SetActive(false);
            _eye = eyeRoot;
            Vector3 c = GoStory.EyeCenter;
            float r = GoStory.EyeR, slab = GoStory.EyeSlab;
            var disc = AreaField.P(PrimitiveType.Cylinder, eyeRoot.transform, "Eye_disc", c - Vector3.up * (slab * 0.5f), new Vector3(r * 2f, slab * 0.5f, r * 2f), stone, true);
            disc.AddComponent<NoClimb>();
            AreaField.P(PrimitiveType.Sphere, eyeRoot.transform, "Eye_horn", c - Vector3.up * (slab + 8f), new Vector3(r * 1.2f, 14f, r * 1.2f), stone, false);
            const int seg = 28;
            float rr = r - 0.7f, len = 2f * Mathf.PI * rr / seg + 0.2f;
            for (int i = 0; i < seg; i++)
            {
                float a = (i + 0.5f) * Mathf.PI * 2f / seg;
                var w = AreaField.P(PrimitiveType.Cube, eyeRoot.transform, "Eye_rail", c + new Vector3(Mathf.Sin(a) * rr, GoStory.SkyRail * 0.5f, Mathf.Cos(a) * rr), new Vector3(len, GoStory.SkyRail, 0.5f), stone, true, new Vector3(0f, a * Mathf.Rad2Deg, 0f));
                w.AddComponent<NoClimb>();
            }
            AreaField.P(PrimitiveType.Cylinder, eyeRoot.transform, "Eye_pedestal", c + Vector3.up * 0.6f, new Vector3(1.2f, 0.6f, 1.2f), stone, true);
            _lantern = AreaField.P(PrimitiveType.Sphere, eyeRoot.transform, "Eye_lantern", c + Vector3.up * GoStory.EyeLantern, Vector3.one * 1.6f, Mat("lantern_off", new Color(0.25f, 0.22f, 0.3f)), false);
            _swirl = new GameObject("Eye_swirl");
            _swirl.transform.SetParent(eyeRoot.transform, false);
            var cloud = Mat("cloud_dark", new Color(0.2f, 0.16f, 0.28f));
            for (int i = 0; i < 14; i++)
            {
                float a = i * Mathf.PI * 2f / 14f;
                AreaField.P(PrimitiveType.Sphere, _swirl.transform, "Eye_cloud", c + new Vector3(Mathf.Cos(a) * (r + 6f), 2f + (i % 4) * 2.4f, Mathf.Sin(a) * (r + 6f)), new Vector3(9f, 4f, 6f), cloud, false, new Vector3(0f, -a * Mathf.Rad2Deg, 0f));
            }
            _meadow = new GameObject("Eye_meadow");
            _meadow.transform.SetParent(eyeRoot.transform, false);
            AreaField.P(PrimitiveType.Cylinder, _meadow.transform, "Eye_grass", c + Vector3.up * 0.04f, new Vector3(r * 1.9f, 0.04f, r * 1.9f), Mat("grass", new Color(0.4f, 0.6f, 0.34f)), false);
            var white = Mat("cloud_white", new Color(0.95f, 0.96f, 1f), 0.3f);
            for (int i = 0; i < 8; i++)
            {
                float a = i * Mathf.PI * 2f / 8f + 0.3f;
                AreaField.P(PrimitiveType.Sphere, _meadow.transform, "Eye_cloud_white", c + new Vector3(Mathf.Cos(a) * (r + 5f), -1f + (i % 3), Mathf.Sin(a) * (r + 5f)), new Vector3(8f, 3f, 6f), white, false);
            }
            // 눈으로 가는 바람 기둥 고리
            _pillar = new GameObject("Eye_pillar");
            _pillar.transform.SetParent(transform, false);
            _pillar.SetActive(false);
            var lineMat = new Material(Shader.Find("Sprites/Default")) { name = "EyePillar (generated)" };
            for (int n = 0; n < 8; n++)
            {
                var go = new GameObject("Eye_ring");
                go.transform.SetParent(_pillar.transform, false);
                var lr = go.AddComponent<LineRenderer>();
                lr.useWorldSpace = false;
                lr.loop = true;
                lr.positionCount = 32;
                lr.widthMultiplier = 0.25f;
                lr.material = lineMat;
                lr.startColor = lr.endColor = new Color(0.85f, 0.85f, 1f, 0.6f);
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

        /// <summary>이야기 진행에 맞춰 켜고 끈다 — 진단이 직접 부른다.</summary>
        public void Refresh()
        {
            if (!_built) Build();
            bool story = !StoryState.OffForTest;
            bool shown = story && GoStory.KnotsShown;
            for (int k = 0; k < 6; k++)
            {
                _stone[k].SetActive(shown);
                bool tied = shown && GoStory.KnotTied(k);
                _smoke[k].SetActive(!tied);
                _fire[k].SetActive(tied);
                int mode = shown ? GoStory.KnotBeam(k) : 0;
                _mode[k] = mode;
                _beam[k].gameObject.SetActive(mode != 0);
                if (mode != 0)
                {
                    Vector3 b = FolkWalker.Grounded(GoStory.KnotBase(k) + Vector3.up * 2f);
                    _beam[k].SetPosition(0, b + Vector3.up * 2.4f);
                    _beam[k].SetPosition(1, mode == 2 ? GoStory.EyeCenter + Vector3.up * GoStory.EyeLantern : b + Vector3.up * GoStory.KnotBeamUp);
                }
            }
            bool eye = story && GoStory.EyeShown;
            bool clear = story && GoStory.EyeClear;
            _eye.SetActive(eye);
            _swirl.SetActive(!clear);
            _meadow.SetActive(clear);
            LanternGold = story && GoStory.AllKnotsTied;
            _lantern.GetComponent<MeshRenderer>().sharedMaterial = LanternGold ? Mat("lantern_on", new Color(1f, 0.85f, 0.4f), 3f) : Mat("lantern_off", new Color(0.25f, 0.22f, 0.3f));
            if (_colOn) PlayerController.ExtraDrafts.Remove(_col);
            _colOn = false;
            bool open = eye && GoStory.EyePillarOpen;
            _pillar.SetActive(open);
            if (open)
            {
                _col = new PlayerController.DraftCol { Base = GoStory.EyePillarPos, R = GoStory.DraftR, Top = GoStory.EyePillarTop };
                PlayerController.ExtraDrafts.Add(_col);
                _colOn = true;
            }
        }

        private void Update()
        {
            _t += Time.deltaTime;
            _wait -= Time.deltaTime;
            if (_wait <= 0f) { _wait = 0.5f; Refresh(); }
            if (_swirl != null && _swirl.activeInHierarchy) _swirl.transform.RotateAround(GoStory.EyeCenter, Vector3.up, 6f * Time.deltaTime);
            if (_pillar != null && _pillar.activeSelf)
            {
                Vector3 b = GoStory.EyePillarPos;
                float h = GoStory.EyePillarTop - b.y;
                for (int i = 0; i < _rings.Count; i++)
                {
                    float f = Mathf.Repeat(_t * GoStory.DraftRise / h + i / (float)_rings.Count, 1f);
                    _rings[i].transform.position = b + Vector3.up * (f * h);
                }
            }
        }
    }
}
