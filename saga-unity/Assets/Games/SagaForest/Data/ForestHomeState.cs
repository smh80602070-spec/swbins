using System;
using System.Collections.Generic;
using UnityEngine;

namespace Saga.Forest.Data
{
    /// <summary>
    /// FOREST "집 꾸미기(가구)" 슬라이스(2026-09-12) + **자유 배치로 재설계
    /// (2026-09-13, 스물한 번째 세션)** — `DungeonBestiaryState`/`HeroState`와
    /// 같은 결의 정적 상태 클래스. 창고(구매한 가구, 아직 안 놓은 것)와 방
    /// 안 격자 칸(`World/ForestFurniturePlacer.cs`)에 놓인 것을 나눠 관리한다.
    ///
    /// **원작(웹판 `home.js`)과 맞춘 점 — 격자 칸에 놓는다.** 웹판도 실은
    /// 연속 좌표가 아니라 `TILE` 크기로 칸 나눔한 자리에 놓는다(`home.js
    /// place()`의 `Math.floor(p.x/T)*T` — 우리 `WorldToCell`/`CellToLocal`과
    /// 같은 발상). 처음 이 슬라이스가 "고정 자리 여섯"으로 좁혔던 건 이
    /// 프로젝트에 "놓기" 버튼이 없어서였는데(FOREST는 이동뿐인 GO판
    /// 컨트롤러 재사용, 공격 버튼도 없다), 여전히 새 버튼은 안 만들고
    /// 이 트랙의 기존 관례("다가가면 반응")를 그대로 격자 전체로 넓혔다 —
    /// 방(6x6m, 문·좌판 자리 제외)에 놓을 수 있는 칸이 여섯→열여덟로 늘어
    /// 사실상 "아무 데나 놓는다"에 가까워졌다.
    /// </summary>
    public static class ForestHomeState
    {
        public const float TileSize = 1f;
        // ForestHouse.cs RoomSize=(6,3,6) 기준 격자 반경 — 벽(±3m, 두께
        // 0.2m)에서 충분히 떨어진 -2..2 다섯 줄×다섯 칸.
        public const int GridHalfExtent = 2;

        // World/ForestFurniturePlacer.cs·Editor/BuildTestVillageForestScene.cs가
        // 좌판·문 위치를 이 값과 맞춰 쓴다(단일 출처) — ForestHouse.cs의
        // 실내 출구 트리거((0,0,-2), 반경 1.4)·좌판 자리((0,0,2.6))와
        // 겹치지 않을 만큼만 넉넉히 비운다.
        public static readonly Vector3 DoorLocalPos = new Vector3(0f, 0f, -2f);
        public const float DoorKeepClear = 1.6f;
        public static readonly Vector3 StallLocalPos = new Vector3(0f, 0f, 2.6f);
        public const float StallKeepClear = 1.0f;

        private static readonly Dictionary<string, int> Stock = new Dictionary<string, int>();
        private static readonly Dictionary<Vector2Int, string> Placements = new Dictionary<Vector2Int, string>();

        /// <summary>가구를 놓거나 거둘 때마다 울린다 — `ForestFurniturePlacer
        /// .cs`가 이걸 구독해 시각을 다시 그린다(`RealmCityBuilder.cs`의
        /// `RealmCityState.Changed`와 같은 결).</summary>
        public static event Action Changed;

        public static Vector2Int WorldToCell(Vector3 localPos) =>
            new Vector2Int(Mathf.RoundToInt(localPos.x / TileSize), Mathf.RoundToInt(localPos.z / TileSize));

        public static Vector3 CellToLocal(Vector2Int cell) => new Vector3(cell.x * TileSize, 0f, cell.y * TileSize);

        /// <summary>격자 반경 안이면서 문·좌판 자리에서 충분히 떨어진 칸만
        /// 유효하다 — 벽 자체는 반경이 이미 안쪽으로 좁아 안 닿는다.</summary>
        public static bool IsValidCell(Vector2Int cell)
        {
            if (Mathf.Abs(cell.x) > GridHalfExtent || Mathf.Abs(cell.y) > GridHalfExtent) return false;
            var local = CellToLocal(cell);
            if (Vector3.Distance(local, DoorLocalPos) < DoorKeepClear) return false;
            if (Vector3.Distance(local, StallLocalPos) < StallKeepClear) return false;
            return true;
        }

        // FOREST 다음 조각 — 벽지/장판(ForestFinishData.cs 클래스 주석
        // 참고). 기본 한 벌(흙벽·마루)은 처음부터 갖고 입은 채 시작한다.
        private static readonly HashSet<string> _ownedWalls = new HashSet<string> { ForestFinishData.DefaultWallKey };
        private static readonly HashSet<string> _ownedFloors = new HashSet<string> { ForestFinishData.DefaultFloorKey };
        private static string _currentWall = ForestFinishData.DefaultWallKey;
        private static string _currentFloor = ForestFinishData.DefaultFloorKey;

        public static int StockCount(string id) => id != null && Stock.TryGetValue(id, out var n) ? n : 0;

        public static string CellItem(Vector2Int cell) => Placements.TryGetValue(cell, out var id) ? id : null;

        public static IEnumerable<KeyValuePair<Vector2Int, string>> AllPlacements() => Placements;

        /// <summary>PLAN.md 109-12-1 — 사지 않고 창고에 넣는다(방문객 보상·여우 화상).</summary>
        public static void AddStock(string id, int n)
        {
            if (FurnitureItem.Get(id) == null || n <= 0) return;
            Stock[id] = StockCount(id) + n;
            Changed?.Invoke();
        }

        /// <summary>과일로 산다 — 모자라면 false(창고 안 늘어남).</summary>
        public static bool TryBuy(string id)
        {
            var item = FurnitureItem.Get(id);
            if (item == null) return false;
            if (!ForestState.SpendFruit(item.FruitCost)) return false;
            Stock[id] = StockCount(id) + 1;
            return true;
        }

        /// <summary>그 칸이 비어 있고 유효하면(IsValidCell) 창고에서 가장
        /// 값진 것부터 하나 놓는다(원작의 "선 자리에 놓는다"를 "어느 칸이든
        /// 다가가면 창고에서 하나"로 단순화한 것 — 항목을 고르는 UI가
        /// 없어서). 놓인 품목 id를 돌려준다(null이면 실패 — 이미 있거나
        /// 무효 칸이거나 창고가 빔).</summary>
        public static string TryPlaceAny(Vector2Int cell)
        {
            if (!IsValidCell(cell) || Placements.ContainsKey(cell)) return null;

            string best = null;
            int bestValue = -1;
            foreach (var item in FurnitureItem.All) // 109-12-1 — 방문객 가구도 놓인다
            {
                if (StockCount(item.Id) <= 0) continue;
                if (item.Value > bestValue) { bestValue = item.Value; best = item.Id; }
            }
            if (best == null) return null;

            Stock[best] -= 1;
            Placements[cell] = best;
            Changed?.Invoke();
            return best;
        }

        /// <summary>그 칸에 놓인 걸 창고로 되거둔다. 거둔 품목 id(없으면 null).</summary>
        public static string PickUp(Vector2Int cell)
        {
            if (!Placements.TryGetValue(cell, out var id)) return null;

            Placements.Remove(cell);
            Stock[id] = StockCount(id) + 1;
            Changed?.Invoke();
            return id;
        }

        // ── 벽지/장판 ────────────────────────────────────────
        public static string CurrentWall => _currentWall;
        public static string CurrentFloor => _currentFloor;
        public static bool OwnsFinish(FinishKind kind, string key) =>
            (kind == FinishKind.Wall ? _ownedWalls : _ownedFloors).Contains(key);

        /// <summary>과일로 사서 바로 입는다 — 이 슬라이스엔 "갈아입기" UI가
        /// 없어(가구 자리처럼 다가가면 반응하는 것뿐) 구매=착용으로 합쳤다.
        /// 이미 가진 것이면 돈 안 내고 그냥 새로 입기만 한다.</summary>
        public static bool TryBuyAndEquipFinish(FinishKind kind, string key)
        {
            var item = ForestFinishData.Get(kind, key);
            if (item == null) return false;
            var owned = kind == FinishKind.Wall ? _ownedWalls : _ownedFloors;
            if (!owned.Contains(key))
            {
                if (!ForestState.SpendFruit(item.FruitCost)) return false;
                owned.Add(key);
            }
            if (kind == FinishKind.Wall) _currentWall = key; else _currentFloor = key;
            return true;
        }

        /// <summary>웹판 `home.js score()` 그대로 — 값/50 + 개수×2 + 계열 보너스
        /// (3개 이상 +25, 5개 이상 +45) + 벽지/장판 보너스(기본이 아니면
        /// 각 +12, 원작 그대로). 원작의 tier(증축) 보너스는 이 슬라이스엔
        /// 증축 시스템 자체가 없어 여전히 뺐다.</summary>
        public static (int Total, int Count, int Bonus, int Finish) Score()
        {
            float sum = 0f;
            int count = 0;
            var sets = new Dictionary<FurnitureSet, int>();

            foreach (var id in Placements.Values)
            {
                if (string.IsNullOrEmpty(id)) continue;
                var item = FurnitureItem.Get(id);
                if (item == null) continue;
                sum += item.Value / 50f;
                count++;
                sets[item.Set] = sets.TryGetValue(item.Set, out var n) ? n + 1 : 1;
            }
            sum += count * 2;

            int bonus = 0;
            foreach (var kv in sets)
            {
                if (kv.Value >= 5) bonus += 45;
                else if (kv.Value >= 3) bonus += 25;
            }
            sum += bonus;

            int finish = 0;
            if (_currentWall != ForestFinishData.DefaultWallKey) finish += 12;
            if (_currentFloor != ForestFinishData.DefaultFloorKey) finish += 12;
            sum += finish;

            return ((int)System.Math.Round(sum), count, bonus, finish);
        }

        public static (string[] Keys, int[] Counts) SnapshotStock()
        {
            var keys = new string[Stock.Count];
            var counts = new int[Stock.Count];
            int i = 0;
            foreach (var kv in Stock)
            {
                keys[i] = kv.Key;
                counts[i] = kv.Value;
                i++;
            }
            return (keys, counts);
        }

        public static void RestoreStock(string[] keys, int[] counts)
        {
            Stock.Clear();
            if (keys == null || counts == null) return;
            for (int i = 0; i < keys.Length && i < counts.Length; i++)
            {
                if (!string.IsNullOrEmpty(keys[i])) Stock[keys[i]] = counts[i];
            }
        }

        public static (int[] X, int[] Y, string[] Ids) SnapshotPlacements()
        {
            var xs = new int[Placements.Count];
            var ys = new int[Placements.Count];
            var ids = new string[Placements.Count];
            int i = 0;
            foreach (var kv in Placements)
            {
                xs[i] = kv.Key.x;
                ys[i] = kv.Key.y;
                ids[i] = kv.Value;
                i++;
            }
            return (xs, ys, ids);
        }

        public static void RestorePlacements(int[] xs, int[] ys, string[] ids)
        {
            Placements.Clear();
            if (xs == null || ys == null || ids == null) return;
            int n = System.Math.Min(xs.Length, System.Math.Min(ys.Length, ids.Length));
            for (int i = 0; i < n; i++)
            {
                if (!string.IsNullOrEmpty(ids[i])) Placements[new Vector2Int(xs[i], ys[i])] = ids[i];
            }
            Changed?.Invoke();
        }

        public static (string[] Walls, string[] Floors, string CurWall, string CurFloor) SnapshotFinishes()
        {
            var walls = new string[_ownedWalls.Count];
            _ownedWalls.CopyTo(walls);
            var floors = new string[_ownedFloors.Count];
            _ownedFloors.CopyTo(floors);
            return (walls, floors, _currentWall, _currentFloor);
        }

        public static void RestoreFinishes(string[] ownedWalls, string[] ownedFloors, string curWall, string curFloor)
        {
            _ownedWalls.Clear();
            _ownedWalls.Add(ForestFinishData.DefaultWallKey);
            if (ownedWalls != null) foreach (var k in ownedWalls) if (!string.IsNullOrEmpty(k)) _ownedWalls.Add(k);

            _ownedFloors.Clear();
            _ownedFloors.Add(ForestFinishData.DefaultFloorKey);
            if (ownedFloors != null) foreach (var k in ownedFloors) if (!string.IsNullOrEmpty(k)) _ownedFloors.Add(k);

            _currentWall = !string.IsNullOrEmpty(curWall) ? curWall : ForestFinishData.DefaultWallKey;
            _currentFloor = !string.IsNullOrEmpty(curFloor) ? curFloor : ForestFinishData.DefaultFloorKey;
        }
    }
}
