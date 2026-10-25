using System.Collections.Generic;
using Saga.Core;
using UnityEngine;

namespace Saga.Go.World
{
    /// <summary>
    /// tasks U-0226 1만리 본 지도 구역 나눔(폰 발열 · 웹 W-0414 ② 짝) — 지도(±216 × ±264)를 144m 정사각 3×4 = 12구역으로 나누고,
    /// 지금 구역 + 맞닿은 띠(<see cref="Band"/>) 안의 들판 식생("Vegetation")·지역 소품("RegionProps_*") 렌더러만 그린다.
    /// 땅·물·하늘·명소("Landmarks" — 지평선 실루엣)는 그대로 다 그린다(웹 ③ "카메라 묶기 안 함"과 같은 판단).
    /// 구역이 바뀌면 `ZoneCut` 으로 덮고 → 새 구역을 켜고 옛것을 끄고 → 걷는다. 지도 밖(이야기 땅·서리봉)에 있으면 지도 소품은 다 끈다.
    /// 끄는 것은 **렌더러만**(충돌체·스크립트 그대로 — `PocketVisibility` 와 같은 원칙), 끌 때 켜져 있던 것만 되돌린다(쳐낸 풀 등은 그대로).
    /// `GameBootstrap.Start` 가 정적 묶음 뒤에 붙인다. 손잡이 `SAGA_GO_ZONES=0`·<see cref="On"/>.
    /// </summary>
    public sealed class GoZones : MonoBehaviour
    {
        public const float Size = 144f, MinX = -216f, MinZ = -264f, Band = 24f, Hysteresis = 4f;
        /// <summary>이 키 넘는 것(나무 실루엣)은 늘 그린다 — 다 끄면 먼 지평선이 성겨 보였다(U-0226 촬영 켬/끔 비교, 안개를 짙게 하는 건 화질 깎기라 안 함).</summary>
        public const float TallKeep = 3.5f;
        public const int Cols = 3, Rows = 4;

        public static bool On = System.Environment.GetEnvironmentVariable("SAGA_GO_ZONES") != "0";
        public static GoZones Instance { get; private set; }

        /// <summary>지금 구역(-1 = 지도 밖, -2 = 아직 안 정함).</summary>
        public int Current { get; private set; } = -2;
        public int ManagedCount => _items.Count;
        public int VisibleCount { get; private set; }
        /// <summary>키가 커서 늘 그리는 렌더러 수(진단).</summary>
        public int TallCount { get; private set; }

        private struct Item { public Renderer R; public Vector2 P; }
        private readonly List<Item> _items = new List<Item>();
        private readonly HashSet<Renderer> _hidden = new HashSet<Renderer>();
        private Transform _player;

        /// <summary>자리 → 구역 번호(순수). 지도 밖이면 -1. 번호 = 줄 × 3 + 칸(남서 0 → 북동 11).</summary>
        public static int ZoneOf(float x, float z)
        {
            float lx = x - MinX, lz = z - MinZ;
            if (lx < 0f || lz < 0f || lx > Cols * Size || lz > Rows * Size || x > -MinX + 0.01f || z > -MinZ + 0.01f) return -1;
            int c = Mathf.Min(Cols - 1, (int)(lx / Size)), r = Mathf.Min(Rows - 1, (int)(lz / Size));
            return r * Cols + c;
        }

        /// <summary>구역 사각형(xz 최소·최대).</summary>
        public static Rect RectOf(int zone)
        {
            int c = zone % Cols, r = zone / Cols;
            return new Rect(MinX + c * Size, MinZ + r * Size, Size, Size);
        }

        /// <summary>이 자리(소품 중심)가 그 구역 + 띠 안인가(순수).</summary>
        public static bool Shows(int zone, Vector2 p)
        {
            if (zone < 0) return false;
            var rc = RectOf(zone);
            return p.x >= rc.xMin - Band && p.x <= rc.xMax + Band && p.y >= rc.yMin - Band && p.y <= rc.yMax + Band;
        }

        public static GoZones Install()
        {
            if (Instance != null) return Instance;
            var go = new GameObject("GoZones");
            var z = go.AddComponent<GoZones>();
            z.Collect();
            return z;
        }

        private void Awake() => Instance = this;
        private void OnDestroy() { if (Instance == this) Instance = null; ShowAll(); }

        /// <summary>다스릴 렌더러를 모은다(식생·지역 소품). 진단이 다시 부를 수 있다.</summary>
        public void Collect()
        {
            ShowAll();
            _items.Clear();
            TallCount = 0;
            var roots = new List<Transform>();
            var veg = GameObject.Find("Vegetation");
            if (veg != null) roots.Add(veg.transform);
            foreach (var t in FindObjectsByType<Transform>(FindObjectsInactive.Exclude, FindObjectsSortMode.None))
                if (t.parent == null && t.name.StartsWith("RegionProps_")) roots.Add(t);
            foreach (var root in roots)
                foreach (var r in root.GetComponentsInChildren<Renderer>(true))
                {
                    var b = r.bounds;
                    var c = b.center;
                    if (b.size.y >= TallKeep) { TallCount++; continue; }
                    if (ZoneOf(c.x, c.z) < 0 && ZoneOf(r.transform.position.x, r.transform.position.z) < 0) continue; // 지도 밖 것은 안 다룸
                    _items.Add(new Item { R = r, P = new Vector2(c.x, c.z) });
                }
            Current = -2;
        }

        private void LateUpdate()
        {
            if (_player == null) { var g = GameObject.FindWithTag("Player"); if (g == null) return; _player = g.transform; }
            Tick(_player.position);
        }

        /// <summary>플레이어 자리로 구역을 맞춘다(진단도 부른다). 구역이 바뀌면(첫 정함 제외, 지도 안끼리) 막을 덮는다.</summary>
        public void Tick(Vector3 playerPos)
        {
            int z = On ? ZoneOf(playerPos.x, playerPos.z) : -3;
            if (z == Current) return;
            // 경계에서 왔다 갔다 해도 막이 연달아 안 덮이게 — 지도 안끼리는 지금 구역에서 Hysteresis 넘게 나가야 바꾼다
            if (Current >= 0 && z >= 0)
            {
                var rc = RectOf(Current);
                if (playerPos.x >= rc.xMin - Hysteresis && playerPos.x <= rc.xMax + Hysteresis && playerPos.z >= rc.yMin - Hysteresis && playerPos.z <= rc.yMax + Hysteresis) return;
            }
            if (Current >= 0 && z >= 0) ZoneCut.Cover("go.zone");
            Apply(z);
        }

        /// <summary>그 구역 기준으로 켜고 끈다. -3 = 끔(전부 보임).</summary>
        public void Apply(int zone)
        {
            Current = zone;
            int vis = 0;
            foreach (var it in _items)
            {
                if (it.R == null) continue;
                bool show = zone == -3 || Shows(zone, it.P);
                if (show)
                {
                    if (_hidden.Remove(it.R)) it.R.enabled = true;
                    if (it.R.enabled) vis++;
                }
                else if (it.R.enabled)
                {
                    it.R.enabled = false;
                    _hidden.Add(it.R);
                }
            }
            VisibleCount = vis;
        }

        private void ShowAll()
        {
            foreach (var r in _hidden) if (r != null) r.enabled = true;
            _hidden.Clear();
        }
    }
}
