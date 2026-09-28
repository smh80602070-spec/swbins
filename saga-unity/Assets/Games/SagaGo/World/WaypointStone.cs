using UnityEngine;
using Saga.Go.Combat;
using Saga.Go.Data;
using Saga.Go.UI;

namespace Saga.Go.World
{
    /// <summary>
    /// PLAN.md 107-3 "순간이동 지점" — 돌기둥 위 구슬. 가까이(7m) 가면 활성화되어 구슬이 푸르게 빛나고,
    /// 그 뒤로 M 지도 화면에서 이 자리로 순간이동할 수 있다. 원작 모양을 따르지 않고 돌·구슬·빛만 쓴다.
    /// </summary>
    public class WaypointStone : MonoBehaviour
    {
        private static readonly Color IdleColor = new Color(0.55f, 0.55f, 0.58f);
        private static readonly Color ActiveColor = new Color(0.35f, 0.9f, 1f);

        public GoWorldMap.Waypoint Data { get; private set; }
        private Material _orbMat;
        private Light _light;
        private float _check;

        public static WaypointStone Spawn(GoWorldMap.Waypoint w, Transform parent, Material stone)
        {
            var go = new GameObject($"Waypoint_{w.Id}");
            go.transform.SetParent(parent, false);
            go.transform.position = GoWorldMap.WaypointPos(w);
            var s = go.AddComponent<WaypointStone>();
            s.Data = w;
            s.Build(stone);
            return s;
        }

        private void Build(Material stone)
        {
            Part(PrimitiveType.Cube, "Base", new Vector3(0f, 0.3f, 0f), new Vector3(3f, 0.6f, 3f), stone, true);
            Part(PrimitiveType.Cube, "Pillar", new Vector3(0f, 2.8f, 0f), new Vector3(1.2f, 4.4f, 1.2f), stone, true);
            _orbMat = new Material(Shader.Find("Universal Render Pipeline/Lit")) { name = "WaypointOrb (generated)" };
            _orbMat.EnableKeyword("_EMISSION");
            Part(PrimitiveType.Sphere, "Orb", new Vector3(0f, 5.8f, 0f), Vector3.one * 1.3f, _orbMat, false);
            var lightGo = new GameObject("Glow");
            lightGo.transform.SetParent(transform, false);
            lightGo.transform.localPosition = new Vector3(0f, 5.8f, 0f);
            _light = lightGo.AddComponent<Light>();
            _light.type = LightType.Point;
            _light.range = 16f;
            _light.intensity = 2.2f;
            _light.color = ActiveColor;
            Refresh();
        }

        private GameObject Part(PrimitiveType type, string name, Vector3 local, Vector3 scale, Material mat, bool keepCollider)
        {
            var p = GameObject.CreatePrimitive(type);
            p.name = name;
            if (!keepCollider) Destroy(p.GetComponent<Collider>());
            p.transform.SetParent(transform, false);
            p.transform.localPosition = local;
            p.transform.localScale = scale;
            if (mat != null) p.GetComponent<MeshRenderer>().sharedMaterial = mat;
            return p;
        }

        private void OnEnable() => WorldMapState.Changed += Refresh;
        private void OnDisable() => WorldMapState.Changed -= Refresh;

        public void Refresh()
        {
            if (_orbMat == null) return;
            bool on = WorldMapState.IsActive(Data.Id);
            Color c = on ? ActiveColor : IdleColor;
            _orbMat.color = c;
            _orbMat.SetColor("_EmissionColor", on ? ActiveColor * 2.2f : Color.black);
            _light.enabled = on;
        }

        private void Update()
        {
            _check -= Time.deltaTime;
            if (_check > 0f) return;
            _check = 0.25f;
            var fc = FieldCombat.Instance;
            if (fc == null) return;
            TryActivateFrom(fc.transform.position);
            TryDailyBonus(fc.transform.position);
        }

        /// <summary>109-14-8 — 넷을 다 한 날 역참 7m 안에 들르면 일과 마무리 보상(하루 한 번). 받았으면 true. 진단도 부른다.</summary>
        public bool TryDailyBonus(Vector3 playerPos)
        {
            Vector3 d = playerPos - transform.position;
            d.y = 0f;
            if (d.magnitude > GoWorldMap.WaypointActivateRadius) return false;
            string got = DailyTaskState.TryClaimBonus();
            if (got == null) return false;
            FieldRingFx.Spawn(transform.position, 8f, new Color(1f, 0.85f, 0.4f), 0.9f);
            if (DialogueLabel.Instance != null) DialogueLabel.Instance.Show(got, 4f);
            return true;
        }

        /// <summary>그 자리가 반경 안이면 활성화(처음이면 true). 진단도 부른다.</summary>
        public bool TryActivateFrom(Vector3 playerPos)
        {
            Vector3 d = playerPos - transform.position;
            d.y = 0f;
            if (d.magnitude > GoWorldMap.WaypointActivateRadius || WorldMapState.IsActive(Data.Id)) return false;
            if (!WorldMapState.Activate(Data.Id)) return false;
            FieldRingFx.Spawn(transform.position, 6f, ActiveColor, 0.8f);
            if (DialogueLabel.Instance != null)
                DialogueLabel.Instance.Show(string.Format(GoLocalization.T("wp.activated", "{0} 활성화 — 지도(M)에서 순간이동할 수 있다"), GoWorldMap.WaypointName(Data)), 3f);
            return true;
        }
    }
}
