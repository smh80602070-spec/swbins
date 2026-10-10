using UnityEngine;

namespace Saga.Go.World
{
    /// <summary>
    /// PLAN.md 109-9 "건물 가림 카메라"(웹 사가만리 ⑯ 뒷부분) — 사람이 밟지 않는 부분(지붕)에 다는 트리거 충돌체 표식.
    /// 걷기·등반·다른 판정은 트리거를 안 보고, 카메라(`CameraRig`)만 이 표식이 붙은 트리거에 닿으면 그 앞까지 당긴다.
    /// </summary>
    public class CameraOccluder : MonoBehaviour
    {
        /// <summary>렌더러 경계로 트리거 상자를 씌운다(로컬 좌표, 회전 없는 균일 스케일 가정 — 마을집 지붕).</summary>
        public static BoxCollider Attach(GameObject go)
        {
            var rs = go.GetComponentsInChildren<Renderer>();
            if (rs.Length == 0) return null;
            var b = rs[0].bounds;
            foreach (var r in rs) b.Encapsulate(r.bounds);
            var col = go.AddComponent<BoxCollider>();
            col.isTrigger = true;
            var t = go.transform;
            Vector3 s = t.lossyScale;
            col.center = t.InverseTransformPoint(b.center);
            col.size = new Vector3(b.size.x / Mathf.Max(1e-4f, s.x), b.size.y / Mathf.Max(1e-4f, s.y), b.size.z / Mathf.Max(1e-4f, s.z));
            go.AddComponent<CameraOccluder>();
            return col;
        }

        /// <summary>U-0086 — 렌더러 없이 월드 상자 하나(마을집 방 천장처럼 모델 경계로 못 잡는 자리).</summary>
        public static BoxCollider AttachBox(Transform parent, string name, Vector3 center, Vector3 size)
        {
            var go = new GameObject(name);
            go.transform.SetParent(parent, false);
            go.transform.position = center;
            var col = go.AddComponent<BoxCollider>();
            col.isTrigger = true;
            col.size = size;
            go.AddComponent<CameraOccluder>();
            return col;
        }
    }
}
