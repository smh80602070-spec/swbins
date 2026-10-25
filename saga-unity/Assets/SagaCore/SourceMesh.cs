using UnityEngine;

namespace Saga.Core
{
    /// <summary>
    /// tasks U-0239 — 런타임 정적 배칭(`StaticBatchingUtility.Combine`) 전에 렌더러의 원래 메시를 적어 둔다.
    /// 배칭 뒤엔 MeshFilter 가 묶음 메시 전체를 가리켜, 폰 예산(<see cref="PerfBudget"/>)이 렌더러마다 묶음 전체를 세게 된다 — 이 표식이 있으면 원래 메시로 센다.
    /// </summary>
    [DisallowMultipleComponent]
    public sealed class SourceMesh : MonoBehaviour
    {
        public Mesh Mesh;

        /// <summary>root 밑 메시 렌더러마다 지금 메시를 적는다(배칭 직전에 부름).</summary>
        public static void Tag(GameObject root)
        {
            foreach (var mf in root.GetComponentsInChildren<MeshFilter>(true))
            {
                if (mf.sharedMesh == null) continue;
                var s = mf.GetComponent<SourceMesh>();
                if (s == null) s = mf.gameObject.AddComponent<SourceMesh>();
                if (s.Mesh == null) s.Mesh = mf.sharedMesh;
            }
        }
    }
}
