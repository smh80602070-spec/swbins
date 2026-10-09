using System.Collections.Generic;
using UnityEngine;
using Saga.Core.Region;

namespace Saga.Core
{
    /// <summary>
    /// U-0037 — 자체툴 월드 소품 GLB(`Resources/World/<이름>`)를 런타임에 한 개 세우는 공용 도우미. 콜라이더를 떼고 재질을 툰으로(`RegionMaterials.FromGltf`)
    /// 바꾸고, 가장 넓은 변을 `maxWidth` 이하로 맞추고 바닥을 부모 원점에 둔다. 모델이 없으면 null — 부른 쪽이 기존 도형을 그대로 둔다.
    /// 모델은 이 파일이 안 놓는다(K-0019 배치).
    /// </summary>
    public static class WorldModels
    {
        private static readonly Dictionary<string, GameObject> Cache = new Dictionary<string, GameObject>();

        public static GameObject Load(string name)
        {
            if (string.IsNullOrEmpty(name)) return null;
            if (Cache.TryGetValue(name, out var p) && p != null) return p;
            p = Resources.Load<GameObject>("World/" + name);
            Cache[name] = p;
            return p;
        }

        /// <summary>`parent` 밑에 모델을 세운다(로컬 원점·바닥 접지). maxWidth ≤ 0 이면 원래 크기. 없으면 null.</summary>
        public static GameObject Spawn(string name, Transform parent, float maxWidth = 0f)
        {
            var prefab = Load(name);
            if (prefab == null) return null;
            var go = Object.Instantiate(prefab, parent, false);
            go.name = name;
            go.transform.localPosition = Vector3.zero;
            go.transform.localRotation = Quaternion.identity;
            go.transform.localScale = Vector3.one;
            foreach (var c in go.GetComponentsInChildren<Collider>(true)) Object.DestroyImmediate(c); // U-0073 — 만든 프레임의 레이·컨트롤러가 걸리지 않게 바로
            var cache = new Dictionary<Material, Material>();
            var mats = new List<Material>();
            Bounds b = default; bool any = false;
            foreach (var r in go.GetComponentsInChildren<Renderer>(true))
            {
                r.GetSharedMaterials(mats);
                bool changed = false;
                for (int i = 0; i < mats.Count; i++)
                {
                    var made = RegionMaterials.FromGltf(mats[i], cache, out _);
                    if (made != null && made != mats[i]) { mats[i] = made; changed = true; }
                }
                if (changed) r.SetSharedMaterials(mats);
                if (!any) { b = r.bounds; any = true; } else b.Encapsulate(r.bounds);
            }
            if (!any) { Object.Destroy(go); return null; }
            float wide = Mathf.Max(b.size.x, b.size.z);
            float k = maxWidth > 0f && wide > maxWidth ? maxWidth / wide : 1f;
            go.transform.localScale = Vector3.one * k;
            // b 는 월드값 — 부모 변환이 단위(이동·회전만)라는 가정에서 바닥 높이를 지역 y 로 바꾼다.
            float bottom = (b.min.y - go.transform.position.y) * k;
            go.transform.localPosition = new Vector3(0f, -bottom, 0f);
            return go;
        }
    }
}
