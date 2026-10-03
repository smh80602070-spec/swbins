using System;
using System.Collections.Generic;
using UnityEngine;

namespace Saga.Go.Data
{
    /// <summary>
    /// tasks U-0032 쉼터 마당(saga-godot 사가고 2026-09-30 새 시스템 `data/homestead.gd`·`world/homestead.gd`) — 원신 동천·동물의숲 집 꾸미기를 이 판 문법으로.
    /// 금으로 소품을 사 마당(반지름 <see cref="Radius"/>m)에 놓으면 안락도가 오르고, 안락도 등급이 오를수록 마당이 **실제 시간**으로 금을 쌓아 준다
    /// (상한 <see cref="CapHours"/>시간치, 가서 "수확"). 규칙·수치는 고돗 그대로, 소품 모델은 이 트랙에 있는 것에 맞췄다(<see cref="Item.Model"/>).
    /// 세이브 `homeItems`·`homeT`·`homeAcc`·`homeSpent`(버전 그대로 — 옛 세이브는 빈 마당). 업적·사냥 기록·일일 의뢰 셈과 섞지 않는다.
    /// </summary>
    public static class GoHomestead
    {
        public const float Radius = 9f;       // 마당 반지름(m) — 이 안에서만 놓는다
        public const float PromptM = 12f;     // 이 안에서 "쉼터" 단추가 뜬다
        public const float Spacing = 0.9f;    // 소품끼리 이 안에 놓지 못한다
        public const float Refund = 0.5f;     // 치우면 값의 절반
        public const float CapHours = 12f;    // 쌓이는 수입 상한(시간)
        public const float RemoveReach = 3f;  // 치우기 — 서 있는 자리 둘레 이 안의 가장 가까운 소품
        public const int MaxItems = 40;

        /// <summary>마당 중심 — 마을 서쪽 열린 들판 칸(`TestMapData` 열 1·줄 3 '.')의 한가운데. 진단이 반지름 안 충돌체 0 을 확인한다.</summary>
        public static Vector3 Center => TestMapData.WorldPos(1.5f, 3.5f);

        public sealed class Item
        {
            public string Id, NameKo, Model;   // Model: Resources 경로("Regions/Pieces/…", "Props/…") 또는 "" = 도형
            public int Cost, Comfort;
            public float Scale;
            public string Name => GoLocalization.T("home.item." + Id, NameKo);
        }

        private static Item I(string id, string name, string model, float scale, int cost, int comfort) =>
            new Item { Id = id, NameKo = name, Model = model, Scale = scale, Cost = cost, Comfort = comfort };

        /// <summary>고돗 `ITEMS` 열둘(같은 순서·값). 모델: 울타리·등롱·비석·우물·작은 집·허수아비는 `Regions/Pieces`, 나머지는 도형.</summary>
        public static readonly Item[] Items =
        {
            I("fence", "울타리", "Regions/Pieces/wood_fence_01", 1.0f, 100, 1),
            I("reed", "갈대", "", 1.0f, 120, 1),
            I("flowers", "꽃덤불", "", 0.7f, 150, 2),
            I("rock", "정원석", "", 1.2f, 200, 2),
            I("lamp", "등롱", "Regions/Pieces/stone_lantern_01", 0.7f, 350, 3),
            I("scare", "허수아비", "Regions/Pieces/banner_pole_01", 1.0f, 400, 3),
            I("stele", "작은 비석", "Regions/Pieces/stele_01", 1.0f, 500, 4),
            I("tree", "느티나무", "", 0.55f, 800, 6),
            I("pine", "소나무", "", 0.55f, 800, 6),
            I("well", "우물", "Regions/Pieces/well_01", 1.0f, 900, 6),
            I("stall", "좌판", "", 0.6f, 1200, 8),
            I("shed", "작은 집", "Regions/Pieces/hanok_01", 0.28f, 2500, 15),
        };

        public struct Tier
        {
            public string NameKo;
            public int Min, Income;   // 안락도 최소값 · 한 시간당 금
            public string Name => GoLocalization.T("home.tier." + Min, NameKo);
        }

        /// <summary>고돗 `TIERS` — 안락도가 Min 이상이면 그 등급.</summary>
        public static readonly Tier[] Tiers =
        {
            new Tier { NameKo = "빈 마당", Min = 0, Income = 0 },
            new Tier { NameKo = "아담한 마당", Min = 10, Income = 60 },
            new Tier { NameKo = "정갈한 마당", Min = 30, Income = 150 },
            new Tier { NameKo = "아늑한 쉼터", Min = 60, Income = 300 },
            new Tier { NameKo = "이름난 쉼터", Min = 100, Income = 500 },
        };

        public static Item Find(string id)
        {
            foreach (var it in Items) if (it.Id == id) return it;
            return null;
        }

        public static int TierOf(int comfort)
        {
            int t = 0;
            for (int i = 0; i < Tiers.Length; i++) if (comfort >= Tiers[i].Min) t = i;
            return t;
        }
    }

    [Serializable]
    public class HomePlaced
    {
        public string id;
        public float x, z;
        public int r;   // 돌림 0~3(90° 단위)
    }

    /// <summary>
    /// 쉼터 마당 상태 — 놓은 소품·마지막 정산 시각(유닉스 초)·정산 때 쌓인 금·총 쓴 금. 시각은 <see cref="NowForTest"/> 로 진단이 돌린다.
    /// 등급이 바뀌는 순간(놓기·치우기)엔 그 전 등급 수입을 먼저 은행(acc)에 넣는다 — 소급해서 바뀌지 않는다.
    /// </summary>
    public static class HomeState
    {
        private static readonly List<HomePlaced> _items = new List<HomePlaced>();
        private static long _t;
        private static double _acc;
        private static int _spent;
        public static long NowForTest = -1;
        public static event Action Changed;

        public static long Now => NowForTest >= 0 ? NowForTest : DateTimeOffset.UtcNow.ToUnixTimeSeconds();

        public static IReadOnlyList<HomePlaced> Items => _items;
        public static int Count => _items.Count;
        public static int Spent => _spent;

        private static void EnsureT() { if (_t == 0) _t = Now; }

        public static int Comfort()
        {
            int n = 0;
            foreach (var e in _items) { var it = GoHomestead.Find(e.id); if (it != null) n += it.Comfort; }
            return n;
        }

        public static int Tier() => GoHomestead.TierOf(Comfort());
        public static int IncomePerHour() => GoHomestead.Tiers[Tier()].Income;

        /// <summary>지금까지 쌓인 금(상한 적용).</summary>
        public static int Pending()
        {
            EnsureT();
            double hours = Math.Max((Now - _t) / 3600.0, 0.0);
            double cap = IncomePerHour() * (double)GoHomestead.CapHours;
            return (int)Math.Min(_acc + IncomePerHour() * hours, Math.Max(cap, _acc));
        }

        /// <summary>등급이 바뀌기 전에 지금까지의 수입을 은행에 넣고 시각을 새로 잡는다.</summary>
        public static void Bank()
        {
            _acc = Pending();
            _t = Now;
        }

        /// <summary>수확 — 받은 금(0 이면 아무것도 안 함).</summary>
        public static int Harvest()
        {
            int n = Pending();
            if (n <= 0) return 0;
            _acc = 0.0; _t = Now;
            GoldState.Add(n);
            Changed?.Invoke();
            return n;
        }

        /// <summary>놓기 — 오류 글(성공이면 ""). x·z 는 세계 좌표, center 는 마당 중심.</summary>
        public static string Place(string id, float x, float z, int rot, Vector3 center)
        {
            var it = GoHomestead.Find(id);
            if (it == null) return GoLocalization.T("home.err.unknown", "그런 소품은 없다");
            if (_items.Count >= GoHomestead.MaxItems) return string.Format(GoLocalization.T("home.err.full", "마당이 가득 찼다 ({0}개)"), GoHomestead.MaxItems);
            if (new Vector2(x - center.x, z - center.z).magnitude > GoHomestead.Radius)
                return string.Format(GoLocalization.T("home.err.out", "마당 밖이다 — 표지 둘레 {0}m 안에 놓는다"), (int)GoHomestead.Radius);
            foreach (var e in _items)
                if (new Vector2(e.x - x, e.z - z).magnitude < GoHomestead.Spacing) return GoLocalization.T("home.err.near", "다른 소품과 너무 가깝다");
            if (!GoldState.TrySpend(it.Cost)) return string.Format(GoLocalization.T("home.err.gold", "금이 모자란다 ({0} 필요)"), it.Cost);
            Bank();
            _items.Add(new HomePlaced { id = id, x = Mathf.Round(x * 2f) / 2f, z = Mathf.Round(z * 2f) / 2f, r = ((rot % 4) + 4) % 4 });
            _spent += it.Cost;
            Changed?.Invoke();
            return "";
        }

        /// <summary>치우기 — (x,z) 에서 reach 안 가장 가까운 소품을 치우고 절반을 돌려준다. 치운 id(없으면 "").</summary>
        public static string RemoveNear(float x, float z, float reach)
        {
            int best = -1; float bd = reach;
            for (int i = 0; i < _items.Count; i++)
            {
                float d = new Vector2(_items[i].x - x, _items[i].z - z).magnitude;
                if (d <= bd) { bd = d; best = i; }
            }
            if (best < 0) return "";
            string id = _items[best].id;
            Bank();
            _items.RemoveAt(best);
            GoldState.Add(Mathf.FloorToInt(GoHomestead.Find(id).Cost * GoHomestead.Refund));
            Changed?.Invoke();
            return id;
        }

        // ---- 세이브 ----

        public static List<HomePlaced> Snapshot()
        {
            var l = new List<HomePlaced>();
            foreach (var e in _items) l.Add(new HomePlaced { id = e.id, x = e.x, z = e.z, r = e.r });
            return l;
        }

        public static long SnapshotT() { EnsureT(); return _t; }
        public static int SnapshotAcc() => (int)Math.Round(_acc);

        /// <summary>불러오기·새 게임·진단 — 없으면(옛 세이브) 빈 마당. 모르는 소품은 버리고 40개를 넘으면 앞에서 자른다.</summary>
        public static void Restore(List<HomePlaced> items, long t, int acc, int spent)
        {
            _items.Clear();
            if (items != null)
                foreach (var e in items)
                {
                    if (e == null || GoHomestead.Find(e.id) == null || _items.Count >= GoHomestead.MaxItems) continue;
                    _items.Add(new HomePlaced { id = e.id, x = e.x, z = e.z, r = ((e.r % 4) + 4) % 4 });
                }
            _t = t > 0 ? t : Now;
            _acc = Math.Max(acc, 0);
            _spent = Math.Max(spent, 0);
            Changed?.Invoke();
        }

        public static void ResetForTest() => Restore(null, 0, 0, 0);
    }
}
