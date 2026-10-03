using System;
using System.Collections.Generic;
using UnityEngine;

namespace Saga.Core.Region
{
    /// <summary>배치표의 점광원은 수십 개 — 모바일 발열 때문에 보는 이(target, 없으면 주 카메라) 가까운 몇 개만 켠다(tasks U-0023, 사용자 "발열").
    /// 꺼진 광원은 비용이 없다. 켜고 끄는 건 interval 초마다.</summary>
    [ExecuteAlways]
    public sealed class RegionLightPool : MonoBehaviour
    {
        public int maxActive = 12;
        public float interval = 0.25f;
        public Transform target;

        private Light[] _lights = new Light[0];
        private float[] _dist = new float[0];
        private int[] _order = new int[0];
        private double _next;

        public int ActiveCount { get; private set; }
        public int TotalCount => _lights.Length;

        public void Setup(List<Light> lights)
        {
            _lights = lights.ToArray();
            _dist = new float[_lights.Length];
            _order = new int[_lights.Length];
            Refresh();
        }

        private void Update()
        {
            if (Time.realtimeSinceStartupAsDouble < _next) return;
            _next = Time.realtimeSinceStartupAsDouble + interval;
            Refresh();
        }

        public void Refresh()
        {
            int n = _lights.Length;
            Transform t = target;
            if (t == null && Camera.main != null) t = Camera.main.transform;
            for (int i = 0; i < n; i++)
            {
                _order[i] = i;
                _dist[i] = t == null ? i : (t.position - _lights[i].transform.position).sqrMagnitude;
            }
            Array.Sort(_order, (a, b) => _dist[a].CompareTo(_dist[b]));
            ActiveCount = 0;
            for (int k = 0; k < n; k++)
            {
                bool on = k < maxActive;
                var l = _lights[_order[k]];
                if (l != null && l.enabled != on) l.enabled = on;
                if (on) ActiveCount++;
            }
        }
    }
}
