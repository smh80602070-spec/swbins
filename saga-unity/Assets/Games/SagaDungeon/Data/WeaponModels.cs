using UnityEngine;

namespace Saga.Dungeon.Data
{
    /// <summary>
    /// U-0038 A — 장착 무기 모양(<see cref="ItemData.WeaponShape"/>)·등급(0~2) → 자체툴(K-0030) 무기 GLB(`Resources/World/wpn_&lt;종류&gt;_&lt;등급&gt;`).
    /// 칼날 → 검, 창(Lance) → 창, 건틀릿 → 장갑. 모델이 없으면 null — `WeaponVisual` 이 코드 칼날을 그대로 쓴다.
    /// 소켓 규약(K-0030): `grip`(손바닥 중심=원점)·`tip`(조준축 끝) 빈 노드. 모델은 이 파일이 안 놓는다(K-0019 배치).
    /// </summary>
    public static class WeaponModels
    {
        private static readonly string[] GradeNames = { "common", "rare", "legend" };
        private static readonly System.Collections.Generic.Dictionary<string, GameObject> Cache = new System.Collections.Generic.Dictionary<string, GameObject>();

        public static string ModelName(ItemData.WeaponShape shape, int grade)
        {
            string kind = shape == ItemData.WeaponShape.Lance ? "spear" : shape == ItemData.WeaponShape.Gauntlet ? "gauntlet" : "sword";
            return $"wpn_{kind}_{GradeNames[Mathf.Clamp(grade, 0, GradeNames.Length - 1)]}";
        }

        public static GameObject Load(ItemData.WeaponShape shape, int grade)
        {
            string name = ModelName(shape, grade);
            if (Cache.TryGetValue(name, out var prefab) && prefab != null) return prefab;
            prefab = Resources.Load<GameObject>("World/" + name);
            Cache[name] = prefab;
            return prefab;
        }

        /// <summary>모델 안에서 이름이 같은 가장 얕은 자식을 찾는다(없으면 null).</summary>
        public static Transform FindNode(Transform root, string name)
        {
            if (root.name == name) return root;
            foreach (Transform c in root)
            {
                var f = FindNode(c, name);
                if (f != null) return f;
            }
            return null;
        }

        /// <summary>모델을 소켓 +Y 축(grip→tip)·원점(grip)에 맞춘 지역 회전·위치·배율. 노드가 없으면 false.</summary>
        public static bool Fit(GameObject instance, float targetLength, out Quaternion rotation, out Vector3 position, out float scale)
        {
            rotation = Quaternion.identity; position = Vector3.zero; scale = 1f;
            var grip = FindNode(instance.transform, "grip");
            var tip = FindNode(instance.transform, "tip");
            if (grip == null || tip == null) return false;
            var g = instance.transform.InverseTransformPoint(grip.position);
            var t = instance.transform.InverseTransformPoint(tip.position);
            var dir = t - g;
            float len = dir.magnitude;
            if (len < 0.01f) return false;
            rotation = Quaternion.FromToRotation(dir, Vector3.up);
            scale = targetLength > 0f ? targetLength / len : 1f;
            position = -(rotation * g) * scale;
            return true;
        }
    }
}
