using System.Collections.Generic;
using UnityEngine;

namespace Saga.Core
{
    /// <summary>
    /// tasks U-0225 주머니 땅 끄기 — 같은 씬 먼 자리에 지어 둔 땅(1만리 이야기 땅·서리봉, 3마을 집 안 등)은 플레이어가 그 안에 없을 때도
    /// 카메라 원거리(기본 1000m) 안이면 안개 속에서 그려진다. 플레이어가 상자(<see cref="Center"/>±<see cref="Half"/>) 밖이면 이 루트 밑
    /// **렌더러·조명만** 끈다 — 충돌체·스크립트는 그대로(다른 코드가 그 땅에 레이캐스트로 자리를 잡거나 진행을 바꿔도 깨지지 않게).
    /// 끌 때 켜져 있던 것만 기억했다가 되돌린다(이야기가 일부러 꺼 둔 것은 그대로). 손잡이 `SAGA_POCKET_HIDE=0`·<see cref="On"/>.
    /// </summary>
    public sealed class PocketVisibility : MonoBehaviour
    {
        public static bool On = System.Environment.GetEnvironmentVariable("SAGA_POCKET_HIDE") != "0";
        public static readonly List<PocketVisibility> All = new List<PocketVisibility>();

        public Vector3 Center;
        public Vector3 Half;               // y 는 안 봄
        public bool Visible { get; private set; } = true;
        /// <summary>지금 꺼 둔 렌더러 수(진단).</summary>
        public int HiddenCount => _hiddenR.Count;

        private readonly List<Renderer> _hiddenR = new List<Renderer>();
        private readonly List<Light> _hiddenL = new List<Light>();
        private Transform _player;

        public static PocketVisibility Attach(GameObject root, Vector3 center, Vector3 half)
        {
            var p = root.GetComponent<PocketVisibility>() ?? root.AddComponent<PocketVisibility>();
            p.Center = center; p.Half = half;
            return p;
        }

        public bool Contains(Vector3 pos) => Mathf.Abs(pos.x - Center.x) <= Half.x && Mathf.Abs(pos.z - Center.z) <= Half.z;

        private void OnEnable() { if (!All.Contains(this)) All.Add(this); }
        private void OnDisable() { All.Remove(this); SetVisible(true); }

        private void LateUpdate()
        {
            if (_player == null) { var g = GameObject.FindWithTag("Player"); if (g == null) return; _player = g.transform; }
            Refresh(_player.position);
        }

        /// <summary>플레이어 자리로 켜고 끈다(진단도 부른다 — 순간이동 직후 곧장 부르면 같은 프레임에 맞는다).</summary>
        public void Refresh(Vector3 playerPos) => SetVisible(!On || Contains(playerPos));

        /// <summary>모든 주머니를 그 자리 기준으로 곧장 맞춘다.</summary>
        public static void RefreshAll(Vector3 playerPos)
        {
            for (int i = All.Count - 1; i >= 0; i--) if (All[i] != null) All[i].Refresh(playerPos);
        }

        public void SetVisible(bool v)
        {
            if (v == Visible) return;
            Visible = v;
            if (!v)
            {
                foreach (var r in GetComponentsInChildren<Renderer>(false))
                    if (r.enabled) { r.enabled = false; _hiddenR.Add(r); }
                foreach (var l in GetComponentsInChildren<Light>(false))
                    if (l.enabled) { l.enabled = false; _hiddenL.Add(l); }
            }
            else
            {
                foreach (var r in _hiddenR) if (r != null) r.enabled = true;
                foreach (var l in _hiddenL) if (l != null) l.enabled = true;
                _hiddenR.Clear(); _hiddenL.Clear();
            }
        }
    }
}
