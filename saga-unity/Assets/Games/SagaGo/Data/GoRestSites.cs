using System.Collections.Generic;
using UnityEngine;

namespace Saga.Go.Data
{
    /// <summary>
    /// tasks U-0168 1만리 쉼터(웹 `saga-go/js/rest-site.js` W-0297 · 고돗 `world/rest_sites.gd` G-0305 짝 — 엘든 링 축복은 구조만) — 규칙 층.
    /// 적이 서는 지역마다 쉼터 하나: 그 지역 이름 자리에서 가장 가까운 풀·숲·논 칸(`.`·`T`·`F` — 마을집·길·물·산·굴·사당·폐허 아님) 가운데 + <see cref="SideOffset"/>.
    /// 처음 앉으면 불을 지핀다(<see cref="Lit"/>) · 마지막으로 앉은 쉼터(<see cref="At"/>)가 다 쓰러졌을 때 일어나는 자리.
    /// 세이브 `restLit`·`restAt`(버전 그대로 — 옛 세이브는 아무 데도 안 지핀 채 = 옛 그대로 마을에서 일어남).
    /// </summary>
    public static class GoRestSites
    {
        public struct Site
        {
            public string Id;      // = 지역 id
            public int Gx, Gy;
            /// <summary>땅 높이는 몸(월드)이 레이로 잡는다 — 여기 y 는 칸 높이.</summary>
            public Vector3 Pos;
        }

        /// <summary>칸 가운데엔 숲 칸 나무가 서 있을 수 있어 옆으로 비킨다.</summary>
        public static readonly Vector3 SideOffset = new Vector3(6f, 0f, 6f);
        /// <summary>앉은 뒤 일어나는 자리 — 불 옆.</summary>
        public static readonly Vector3 WakeOffset = new Vector3(2.2f, 0.3f, 0f);
        public const string AllowedTiles = ".TF";

        private static Site[] _sites;
        private static readonly HashSet<string> _lit = new HashSet<string>();

        public static string At { get; private set; } = "";
        public static IEnumerable<string> Lit => _lit;
        public static int LitCount => _lit.Count;
        public static bool IsLit(string id) => _lit.Contains(id);

        public static Site[] Sites => _sites ??= Build();

        private static Site[] Build()
        {
            var list = new List<Site>();
            foreach (var r in GoWorldMap.Regions)
            {
                if (r.Roster == null || r.Roster.Length == 0) continue; // 마을 들판·너른 강 — 적이 없다
                int bx = -1, by = -1;
                float bd = float.MaxValue;
                for (int gy = 0; gy < TestMapData.RowCount; gy++)
                    for (int gx = 0; gx < TestMapData.Cols; gx++)
                    {
                        if (GoWorldMap.RegionAt(gx, gy) != r.Id || AllowedTiles.IndexOf(TestMapData.TileAt(gx, gy)) < 0) continue;
                        float d = (gx - r.LabelGx) * (gx - r.LabelGx) + (gy - r.LabelGy) * (gy - r.LabelGy);
                        if (d < bd) { bd = d; bx = gx; by = gy; }
                    }
                if (bx < 0) continue;
                var p = TestMapData.WorldPos(bx, by) + SideOffset;
                p.y = TestMapData.GroundHeight(bx, by);
                list.Add(new Site { Id = r.Id, Gx = bx, Gy = by, Pos = p });
            }
            return list.ToArray();
        }

        public static Site? Get(string id)
        {
            foreach (var s in Sites) if (s.Id == id) return s;
            return null;
        }

        /// <summary>앉음 — 처음이면 true(불을 지핌). 부활 자리가 이 쉼터로.</summary>
        public static bool Sit(string id)
        {
            if (Get(id) == null) return false;
            bool first = _lit.Add(id);
            At = id;
            return first;
        }

        public static List<string> SnapshotLit() => new List<string>(_lit);

        public static void Restore(List<string> lit, string at)
        {
            _lit.Clear();
            if (lit != null) foreach (var id in lit) if (Get(id) != null) _lit.Add(id);
            At = !string.IsNullOrEmpty(at) && _lit.Contains(at) ? at : "";
        }

        public static void ResetForTest() => Restore(null, null);
    }
}
