using Saga.Core;
using UnityEngine;
using Saga.Go.Combat;
using Saga.Go.Data;
using Saga.Go.UI;

namespace Saga.Go.World
{
    /// <summary>
    /// PLAN.md 107-3 "멀리 보이는 랜드마크" — 옛 망루. 길목(3,6) 옆 안쪽 산 고원 위에 선 8m 네모 돌탑(높이 24m,
    /// 고원과 합쳐 지면에서 40m 안팎)에 꼭대기 화톳불. 마을에서 남쪽으로 보인다. 옆면은 상자 충돌체라 기어오를 수
    /// 있고, 꼭대기에 서면 지도 전체가 밝혀진다(`WorldMapState.RevealAll`) — 원작의 "높은 곳에 올라 지도 밝히기" 문법.
    /// </summary>
    public class Watchtower : MonoBehaviour
    {
        private static readonly Color FireColor = new Color(1f, 0.62f, 0.25f);
        private static readonly Color RevealedColor = new Color(0.4f, 0.9f, 1f);

        private Material _fireMat;
        private Light _light;
        private float _check;

        public float TopY { get; private set; }
        public Vector3 TopCenter => new Vector3(transform.position.x, TopY, transform.position.z);

        public static Watchtower Spawn(Transform parent, Material stone)
        {
            var go = new GameObject("Watchtower");
            go.transform.SetParent(parent, false);
            float ground = TestMapData.GroundHeight(GoWorldMap.TowerGx, GoWorldMap.TowerGy);
            go.transform.position = TestMapData.WorldPos(GoWorldMap.TowerGx, GoWorldMap.TowerGy) + Vector3.up * ground;
            var t = go.AddComponent<Watchtower>();
            t.Build(stone);
            return t;
        }

        private void Build(Material stone)
        {
            float h = GoWorldMap.TowerHeight, w = GoWorldMap.TowerWidth;
            TopY = transform.position.y + h;
            var shaftMat = stone != null ? EnvironmentMaterial.MakeTiled(stone, w, h) : null;
            Part(PrimitiveType.Cube, "Shaft", new Vector3(0f, h * 0.5f, 0f), new Vector3(w, h, w), shaftMat, true);
            // 꼭대기 네 모서리 성가퀴 — 충돌체 없이(넘어오르기 착지 자리를 가리지 않게)
            for (int i = 0; i < 4; i++)
            {
                float sx = (i & 1) == 0 ? -1f : 1f, sz = (i & 2) == 0 ? -1f : 1f;
                Part(PrimitiveType.Cube, "Merlon", new Vector3(sx * (w * 0.5f - 0.7f), h + 0.8f, sz * (w * 0.5f - 0.7f)), new Vector3(1.4f, 1.6f, 1.4f), shaftMat, false);
            }
            Part(PrimitiveType.Cylinder, "Brazier", new Vector3(0f, h + 0.6f, 0f), new Vector3(2.2f, 0.6f, 2.2f), stone, false);
            _fireMat = new Material(Shader.Find("Universal Render Pipeline/Lit")) { name = "WatchtowerFire (generated)" };
            _fireMat.EnableKeyword("_EMISSION");
            Part(PrimitiveType.Sphere, "Fire", new Vector3(0f, h + 1.8f, 0f), Vector3.one * 1.8f, _fireMat, false);
            var lightGo = new GameObject("Beacon");
            lightGo.transform.SetParent(transform, false);
            lightGo.transform.localPosition = new Vector3(0f, h + 2.5f, 0f);
            _light = lightGo.AddComponent<Light>();
            _light.type = LightType.Point;
            _light.range = 60f;
            _light.intensity = 3f;
            Refresh();
        }

        private void Part(PrimitiveType type, string name, Vector3 local, Vector3 scale, Material mat, bool keepCollider)
        {
            var p = GameObject.CreatePrimitive(type);
            p.name = name;
            if (!keepCollider) Destroy(p.GetComponent<Collider>());
            p.transform.SetParent(transform, false);
            p.transform.localPosition = local;
            p.transform.localScale = scale;
            if (mat != null) p.GetComponent<MeshRenderer>().sharedMaterial = mat;
        }

        private void OnEnable() => WorldMapState.Changed += Refresh;
        private void OnDisable() => WorldMapState.Changed -= Refresh;

        private void Refresh()
        {
            if (_fireMat == null) return;
            Color c = WorldMapState.Revealed ? RevealedColor : FireColor;
            _fireMat.color = c;
            _fireMat.SetColor("_EmissionColor", c * 3f);
            _light.color = c;
        }

        private void Update()
        {
            _check -= Time.deltaTime;
            if (_check > 0f) return;
            _check = 0.25f;
            var fc = FieldCombat.Instance;
            if (fc != null) TryRevealFrom(fc.transform.position);
        }

        /// <summary>꼭대기(윗면 1m 안·가운데 5m 안)에 섰으면 지도를 밝힌다(처음이면 true). 진단도 부른다.</summary>
        public bool TryRevealFrom(Vector3 playerPos)
        {
            if (WorldMapState.Revealed || playerPos.y < TopY - 1f) return false;
            Vector3 d = playerPos - transform.position;
            d.y = 0f;
            if (d.magnitude > GoWorldMap.TowerWidth * 0.5f + 1f) return false;
            if (!WorldMapState.RevealAll()) return false;
            FieldRingFx.Spawn(TopCenter, 30f, RevealedColor, 1.2f);
            if (DialogueLabel.Instance != null)
                DialogueLabel.Instance.Show(GoLocalization.T("map.revealed", "옛 망루에 올랐다 — 온 땅이 지도에 밝혀졌다(M)"), 3.5f);
            return true;
        }
    }
}
