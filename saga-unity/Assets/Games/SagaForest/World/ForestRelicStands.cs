using System.Collections.Generic;
using TMPro;
using UnityEngine;
using Saga.Forest.Data;

namespace Saga.Forest.World
{
    /// <summary>
    /// tasks U-0177 유적 전시대 — 되살린 유적(`ForestRelics.Restored`)마다 바위 지대 화석 채집 자리 곁에 받침 + 유물 몸 + 이름표 하나.
    /// 에셋 없이 primitive(고돗 G-0315 와 같음 — 사고 둘레 전시대도 primitive + 이모지 이름표). 자리는 화석 비석 장식(`ForestMuseumDecorator`, +2.5·+2.5)의
    /// 반대쪽 줄(−x) 2m 간격. 충돌체 없음. `ForestRelics.Changed` 마다 다시 짓는다(불러오기·복원 둘 다).
    /// </summary>
    public static class ForestRelicStands
    {
        public const float Gap = 2f;
        private static GameObject _root;
        private static bool _hooked;

        public static GameObject Root => _root;
        public static int Count => _root == null ? 0 : _root.transform.childCount;

        public static void Install()
        {
            if (!_hooked) { _hooked = true; ForestRelics.Changed += Rebuild; }
            Rebuild();
        }

        /// <summary>전시대 자리 — 화석 채집 자리 기준.</summary>
        public static Vector3 SpotOf(int index)
        {
            Vector3 c = ForestCollectSpot.PositionOf(ForestMuseumState.Category.Fossil);
            return c + new Vector3(-2.5f - Gap * index, 0f, 2.5f);
        }

        public static void Rebuild()
        {
            if (!Application.isPlaying) return;
            if (_root != null) Object.Destroy(_root);
            _root = null;
            var list = ForestRelics.Restored;
            if (list.Count == 0) return;
            _root = new GameObject("RelicStands");
            for (int i = 0; i < list.Count; i++) Build(list[i], SpotOf(i));
        }

        private static readonly Dictionary<string, Color> Tints = new Dictionary<string, Color>
        {
            ["bowl"] = new Color(0.62f, 0.38f, 0.22f), ["stele"] = new Color(0.55f, 0.55f, 0.52f), ["tile"] = new Color(0.3f, 0.32f, 0.36f),
        };

        private static void Build(string key, Vector3 pos)
        {
            var set = ForestRelics.Find(key);
            var stand = new GameObject("Relic_" + key);
            stand.transform.SetParent(_root.transform, false);
            stand.transform.position = pos;
            Part(PrimitiveType.Cylinder, "Plinth", stand.transform, new Vector3(0f, 0.35f, 0f), new Vector3(0.9f, 0.35f, 0.9f), new Color(0.78f, 0.74f, 0.66f));
            Color t = Tints.TryGetValue(key, out var c) ? c : Color.gray;
            switch (key)
            {
                case "bowl":
                    Part(PrimitiveType.Sphere, "Body", stand.transform, new Vector3(0f, 0.95f, 0f), new Vector3(0.6f, 0.45f, 0.6f), t);
                    break;
                case "stele":
                    Part(PrimitiveType.Cube, "Body", stand.transform, new Vector3(0f, 1.15f, 0f), new Vector3(0.45f, 0.9f, 0.12f), t);
                    break;
                default:
                    Part(PrimitiveType.Cylinder, "Body", stand.transform, new Vector3(0f, 0.95f, 0f), new Vector3(0.55f, 0.05f, 0.55f), t, new Vector3(90f, 0f, 0f));
                    break;
            }
            var label = new GameObject("Label");
            label.transform.SetParent(stand.transform, false);
            label.transform.localPosition = new Vector3(0f, 2f, 0f);
            var tmp = label.AddComponent<TextMeshPro>();
            tmp.text = set != null ? set.Name : key;
            tmp.fontSize = 3f;
            tmp.alignment = TextAlignmentOptions.Center;
            tmp.color = new Color(1f, 0.95f, 0.8f);
        }

        private static void Part(PrimitiveType type, string name, Transform parent, Vector3 at, Vector3 scale, Color color, Vector3? euler = null)
        {
            var go = GameObject.CreatePrimitive(type);
            go.name = name;
            go.transform.SetParent(parent, false);
            go.transform.localPosition = at;
            go.transform.localScale = scale;
            if (euler.HasValue) go.transform.localEulerAngles = euler.Value;
            var mat = new Material(Shader.Find("Universal Render Pipeline/Lit")) { name = "RelicStand (generated)", color = color };
            go.GetComponent<MeshRenderer>().sharedMaterial = mat;
            Saga.Core.Colliders.Strip(go);
        }
    }
}
