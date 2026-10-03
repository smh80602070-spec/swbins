using System.Collections.Generic;
using UnityEngine;
using UnityEngine.Rendering;

namespace Saga.Core.Region
{
    /// <summary>같은 조각이 여러 번 놓이는 곳을 GPU 인스턴싱으로 그린다(tasks U-0023). 오브젝트·노드가 늘지 않고, 한 묶음 = (메시, 칸, 재질) 하나당 그리기 호출 하나(1023개마다).
    /// 지역 뿌리를 옮기거나 돌려도 따라간다(행렬은 뿌리 기준으로 두고 매 프레임 월드로 곱한다 — 수십 개라 비용이 없다).</summary>
    [ExecuteAlways]
    public sealed class RegionInstancer : MonoBehaviour
    {
        private const int MaxPerCall = 1023;

        private sealed class Batch
        {
            public Mesh mesh;
            public int sub;
            public Material mat;
            public readonly List<Matrix4x4> local = new List<Matrix4x4>();
            public Matrix4x4[] world;
        }

        private readonly Dictionary<(Mesh, int, Material), Batch> _map = new Dictionary<(Mesh, int, Material), Batch>();
        private readonly List<Batch> _list = new List<Batch>();
        private Bounds _bounds = new Bounds(Vector3.zero, new Vector3(400f, 100f, 400f));

        public int InstanceCount { get; private set; }
        public int BatchCount => _list.Count;
        /// <summary>그리기 호출 수(묶음당 1023개씩 나눈 호출 합).</summary>
        public int DrawCalls { get; private set; }
        public long Triangles { get; private set; }

        public void SetBounds(Bounds localBounds) { _bounds = localBounds; }

        public void Add(Mesh mesh, int sub, Material mat, Matrix4x4 localToRegion)
        {
            if (mesh == null || mat == null) return;
            if (!_map.TryGetValue((mesh, sub, mat), out var b))
            {
                b = new Batch { mesh = mesh, sub = sub, mat = mat };
                _map[(mesh, sub, mat)] = b;
                _list.Add(b);
            }
            b.local.Add(localToRegion);
            b.world = null;
            InstanceCount++;
            DrawCalls = 0; Triangles = 0;
            foreach (var x in _list)
            {
                DrawCalls += (x.local.Count + MaxPerCall - 1) / MaxPerCall;
                Triangles += (long)x.local.Count * (x.mesh.GetIndexCount(x.sub) / 3);
            }
        }

        private void Update()
        {
            if (_list.Count == 0) return;
            var toWorld = transform.localToWorldMatrix;
            var wb = new Bounds(transform.TransformPoint(_bounds.center), _bounds.size);
            foreach (var b in _list)
            {
                int n = b.local.Count;
                if (b.world == null || b.world.Length != n) b.world = new Matrix4x4[n];
                for (int i = 0; i < n; i++) b.world[i] = toWorld * b.local[i];
                var rp = new RenderParams(b.mat)
                {
                    shadowCastingMode = ShadowCastingMode.On,
                    receiveShadows = true,
                    worldBounds = wb,
                    layer = gameObject.layer,
                };
                for (int start = 0; start < n; start += MaxPerCall)
                    Graphics.RenderMeshInstanced(rp, b.mesh, b.sub, b.world, Mathf.Min(MaxPerCall, n - start), start);
            }
        }
    }
}
