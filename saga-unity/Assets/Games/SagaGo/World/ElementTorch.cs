using UnityEngine;
using Saga.Go.Combat;
using Saga.Go.Data;

namespace Saga.Go.World
{
    /// <summary>
    /// PLAN.md 107-4 "원소 석등" — 화려한 상자 둘레에 선 돌 등. 등갓 앞 구슬이 제 원소 빛깔로 은은히 비쳐
    /// 무슨 원소로 밝혀야 하는지 알려 주고, 그 원소의 스킬·폭발 원에 걸리면 불이 붙는다(타이머·전부 켜짐 판정은
    /// 주인 `TreasureChest` 가 한다). 원작 모양을 따르지 않고 돌·구슬·빛만 쓴다.
    /// </summary>
    public class ElementTorch : MonoBehaviour
    {
        public GoElement Element { get; private set; }
        public bool Lit { get; private set; }

        private Material _flameMat;
        private Material _gemMat;
        private GameObject _flame;
        private Light _light;

        public static ElementTorch Spawn(Vector3 pos, GoElement el, Transform parent, Material stone, string name)
        {
            var go = new GameObject(name);
            go.transform.SetParent(parent, true);
            go.transform.position = pos;
            var t = go.AddComponent<ElementTorch>();
            t.Element = el;
            t.Build(stone);
            return t;
        }

        private void Build(Material stone)
        {
            gameObject.AddComponent<NoClimb>();
            Part(PrimitiveType.Cube, "Base", new Vector3(0f, 0.25f, 0f), new Vector3(1.4f, 0.5f, 1.4f), stone, true);
            Part(PrimitiveType.Cube, "Pillar", new Vector3(0f, 1.4f, 0f), new Vector3(0.6f, 1.8f, 0.6f), stone, true);
            Part(PrimitiveType.Cube, "Lamp", new Vector3(0f, 2.8f, 0f), new Vector3(1.2f, 1.0f, 1.2f), stone, false);
            Part(PrimitiveType.Cube, "Cap", new Vector3(0f, 3.45f, 0f), new Vector3(1.8f, 0.3f, 1.8f), stone, false);

            Color c = GoElements.ColorOf(Element);
            _gemMat = NewEmissive("TorchGem (generated)", c, c * 0.8f);
            // 네 면 모두에 구슬 — 어느 쪽에서 봐도 원소가 읽히게
            for (int i = 0; i < 4; i++)
            {
                float a = i * Mathf.PI * 0.5f;
                Part(PrimitiveType.Sphere, "Gem", new Vector3(Mathf.Sin(a) * 0.62f, 2.8f, Mathf.Cos(a) * 0.62f), Vector3.one * 0.32f, _gemMat, false);
            }
            _flameMat = NewEmissive("TorchFlame (generated)", c, c * 3f);
            _flame = Part(PrimitiveType.Sphere, "Flame", new Vector3(0f, 4.1f, 0f), Vector3.one * 0.9f, _flameMat, false);

            var lightGo = new GameObject("Glow");
            lightGo.transform.SetParent(transform, false);
            lightGo.transform.localPosition = new Vector3(0f, 4.1f, 0f);
            _light = lightGo.AddComponent<Light>();
            _light.type = LightType.Point;
            _light.range = 12f;
            _light.intensity = 2.5f;
            _light.color = c;
            SetLit(false);
        }

        private static Material NewEmissive(string name, Color baseColor, Color emission)
        {
            var m = new Material(Shader.Find("Universal Render Pipeline/Lit")) { name = name };
            m.color = baseColor;
            m.EnableKeyword("_EMISSION");
            m.SetColor("_EmissionColor", emission);
            return m;
        }

        private GameObject Part(PrimitiveType type, string name, Vector3 local, Vector3 scale, Material mat, bool keepCollider)
        {
            var p = GameObject.CreatePrimitive(type);
            p.name = name;
            if (!keepCollider) Saga.Core.Colliders.Strip(p);
            p.transform.SetParent(transform, false);
            p.transform.localPosition = local;
            p.transform.localScale = scale;
            if (mat != null) p.GetComponent<MeshRenderer>().sharedMaterial = mat;
            return p;
        }

        public void SetLit(bool on)
        {
            Lit = on;
            if (_flame != null) _flame.SetActive(on);
            if (_light != null) _light.enabled = on;
        }

        /// <summary>이 원이 석등 몸에 걸리나(원소는 안 본다).</summary>
        public bool InPulse(Vector3 center, float radius)
        {
            Vector3 d = transform.position - center;
            d.y = 0f;
            return d.magnitude <= radius + GoTreasure.TorchHitSlack;
        }
    }
}
