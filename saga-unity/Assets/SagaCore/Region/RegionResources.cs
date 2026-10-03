using System.Collections.Generic;
using UnityEngine;

namespace Saga.Core.Region
{
    /// <summary>지역 뿌리가 만든 메시·재질·그림을 뿌리가 지워질 때 함께 지운다(tasks U-0023 R-5). GameObject 만 지우면 이 값 객체들이 새어
    /// 지역을 오갈 때마다 메모리가 쌓인다. 에셋(프리팹이 가진 원본 재질·메시)은 여기 넣지 않는다.</summary>
    [ExecuteAlways]
    public sealed class RegionResources : MonoBehaviour
    {
        private readonly List<Object> _owned = new List<Object>();

        public int Count => _owned.Count;

        public void Own(Object o)
        {
            if (o != null) _owned.Add(o);
        }

        private void OnDestroy()
        {
            foreach (var o in _owned)
            {
                if (o == null) continue;
                if (Application.isPlaying) Destroy(o); else DestroyImmediate(o);
            }
            _owned.Clear();
        }
    }
}
