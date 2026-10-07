using System.Collections.Generic;
using UnityEditor;
using UnityEngine;
using Saga.Forest.Data;
using Saga.Forest.World;

namespace Saga.EditorTools
{
    /// <summary>
    /// PLAN.md 109-12-1 "떠돌이 방문객"(웹 사가마을 §5.9) 진단 — `PlaytestForestHeadless` 셋째 프레임(세 시대 진단 뒤)이 부른다. 같은 프레임 안에서 끝낸다.
    /// 표(여섯·시대 넷·몸 저마다 다르고 이 판 몸과 안 겹침·보상 가구는 가구전에 없음) · 날짜 돌림(같은 날 같음·60일에 여섯 다) ·
    /// 여우(물건 값 ×1.5·권함 → 모자람 → 삼·창고) · 조각(존 넷에 다섯·존마다 하나·서로 8m·물건에서 2.5m·방위 힌트·줍기·다 모으면 보상) ·
    /// 도깨비불 빛 구슬 · 가져오기(만나기 전 채집은 안 셈·갈래 둘·다 모으면 알림·보상) · 다가서기 말하기(물러났다 오면 또) ·
    /// 광장 자리(존 밖·물건 3m·사람 길 2.5m·스폰 4m) · 몸 · 방문객 가구 놓기 · 세이브 v8 왕복·v7 은 기록 없음.
    /// 109-12-2(웹 §5.10·5.11 진단 그대로): 도깨비(덤불 셋·꼬마가 대장 곁에 작게 서서 춤)·탐사원(부품 넷·마을 사람 루미가 나오고 평소 자리엔 숨음) /
    /// 단골 청함·눌러앉음·딴 날 제자리·선물 하루 한 번 / 자리 여덟(물건·길·서로 간격) / 돌아보기·손짓·춤 / 이웃 평가 +6·수다 한 쌍 / 세이브 v9.
    /// 끝나면 날짜·과일·창고·놓인 가구·손님 기록·단골·플레이어 자리를 시작 때로.
    /// </summary>
    public static class PlaytestForestVisitors
    {
        private const string T = "[PlaytestForestHeadless] visitors";
        private static bool _ok;

        public static bool Run()
        {
            _ok = true;
            var runner = ForestVisitorRunner.Instance;
            var playerGo = GameObject.FindWithTag("Player");
            if (runner == null || playerGo == null) { Fail($"실행기 {runner != null}·플레이어 {playerGo != null}"); return false; }
            var cc = playerGo.GetComponent<CharacterController>();
            Vector3 pos0 = playerGo.transform.position;
            int fruit0 = ForestState.FruitCount;
            var stock0 = ForestHomeState.SnapshotStock();
            var place0 = ForestHomeState.SnapshotPlacements();
            var rec0 = ForestVisitors.Snapshot();
            var bonds0 = ForestVisitors.SnapshotBonds();
            ForestVisitors.RestoreBonds(null, null, null, int.MinValue, null, false);
            // PLAN.md 109-16 곁가지 — 눌러앉은 손님은 눌러앉은 뒤 첫 말에 사연을 들려준다. 이 진단은 하루 선물을 보니 사연은 다 들은 것으로 시작한다(사연 자체는 PlaytestForestScenario).
            var stories0 = ForestVisitors.SnapshotStories();
            var allKeys = new string[ForestVisitors.List.Length];
            for (int i = 0; i < allKeys.Length; i++) allKeys[i] = ForestVisitors.List[i].Key;
            ForestVisitors.RestoreStories(allKeys);
            string m = "";
            try
            {
                m += CheckTable() + CheckSchedule() + CheckSpot() + CheckFox(runner, playerGo.transform) + CheckCollect(runner, "sailor")
                   + CheckCollect(runner, "wisp") + CheckCollect(runner, "dokkaebi") + CheckCollect(runner, "alien") + CheckBring(runner)
                   + CheckSettleSpots() + CheckSettle(runner) + CheckGestures(runner) + CheckPlace() + CheckSave();
            }
            catch (System.Exception ex)
            {
                Fail("예외 " + ex);
            }
            finally
            {
                ForestVisitors.ForceDayForTest(null);
                ForestVisitors.Restore(rec0.Day, rec0.Key, rec0.Got, rec0.Done, rec0.Offered, rec0.Met, rec0.B1, rec0.B2);
                ForestVisitors.RestoreBonds(bonds0.BondKeys, bonds0.BondCounts, bonds0.Settled, bonds0.GiftDay, bonds0.GiftGot, bonds0.AskSettle);
                ForestVisitors.RestoreStories(stories0);
                ForestState.Restore(fruit0);
                ForestHomeState.RestoreStock(stock0.Keys, stock0.Counts);
                ForestHomeState.RestorePlacements(place0.X, place0.Y, place0.Ids);
                runner.Rebuild();
                if (cc != null) cc.enabled = false;
                playerGo.transform.position = pos0;
                if (cc != null) cc.enabled = true;
            }
            if (_ok) Debug.Log($"{T} OK - 표·날짜 돌림·광장 자리·여우(권함·모자람·삼)·조각(선원·도깨비불: 존 넷·간격·방위·줍기·보상)·가져오기(만남 뒤만·갈래 둘)·말하기(물러났다 또)·가구 놓기·세이브 v9 · 12-2 도깨비·탐사원·단골·자리 여덟·몸짓·이웃·수다 |{m}");
            return _ok;
        }

        private static string CheckTable()
        {
            var keys = new HashSet<string>();
            var bodies = new HashSet<string>();
            var eras = new HashSet<string>();
            var taken = new HashSet<string> { "Maria", "PeasantMan" };
            foreach (var f in ForestEras.FolkList) taken.Add(f.Body);
            foreach (var v in ForestVisitors.List)
            {
                if (!keys.Add(v.Key)) Fail($"손님 키 겹침 {v.Key}");
                eras.Add(v.Era);
                if (!string.IsNullOrEmpty(v.Body))
                {
                    if (!bodies.Add(v.Body)) Fail($"몸 겹침 {v.Body}");
                    // 109-12-2 — 마을 사람이 곧 손님이면(루미) 그 사람 몸이어야 하고, 아니면 이 판 다른 사람과 안 겹친다.
                    if (!string.IsNullOrEmpty(v.FolkId))
                    {
                        bool match = false;
                        foreach (var fo in ForestEras.FolkList) if (fo.Id == v.FolkId && fo.Body == v.Body) match = true;
                        if (!match) Fail($"{v.Key} 몸 {v.Body} 가 마을 사람 {v.FolkId} 몸이 아님");
                    }
                    else if (taken.Contains(v.Body)) Fail($"몸 {v.Body} 가 이 판 다른 사람과 같음");
                }
                if (v.Type != ForestVisitors.Kind.Shop)
                {
                    var f = FurnitureItem.Get(v.Furniture);
                    if (f == null || v.Fruit <= 0) Fail($"{v.Key} 보상 {v.Furniture}·{v.Fruit}");
                    else if (System.Array.IndexOf(FurnitureItem.Catalog, f) >= 0) Fail($"{v.Key} 보상 가구가 가구전에서 팔림");
                }
                if (v.Type == ForestVisitors.Kind.Collect && (v.N < 3 || string.IsNullOrEmpty(v.PieceKo))) Fail($"{v.Key} 조각 {v.N}");
            }
            if (ForestVisitors.List.Length != 8) Fail($"손님 {ForestVisitors.List.Length}(웹 §5.9 여섯 + §5.10 둘)");
            foreach (var e in new[] { "past", "modern", "future", "myth" }) if (!eras.Contains(e)) Fail($"{e} 손님 없음");
            int all = 0;
            foreach (var _ in FurnitureItem.All) all++;
            if (all != FurnitureItem.Catalog.Length + FurnitureItem.VisitorGifts.Length) Fail("가구 전체 수");
            return $" 표(몸 {bodies.Count})";
        }

        private static string CheckSchedule()
        {
            var seen = new HashSet<string>();
            for (int d = 9000; d < 9060; d++)
            {
                if (ForestVisitors.WhoOn(d).Key != ForestVisitors.WhoOn(d).Key) Fail("같은 날 다른 손님");
                seen.Add(ForestVisitors.WhoOn(d).Key);
            }
            if (seen.Count != ForestVisitors.List.Length) Fail($"60일에 손님 {seen.Count} 종");
            ForestVisitors.ForceDayForTest(9001);
            if (ForestVisitors.Today != 9001 || ForestVisitors.TodayVisitor.Key != ForestVisitors.WhoOn(9001).Key) Fail("날짜 고정");
            return $" 돌림({seen.Count})";
        }

        private static int DayOf(string key)
        {
            for (int d = 9000; d < 9400; d++) if (ForestVisitors.WhoOn(d).Key == key) return d;
            Fail($"{key} 손님 날 없음");
            return 9000;
        }

        private static string CheckSpot()
        {
            var at = new Vector3(ForestVisitors.Spot.x, 0f, ForestVisitors.Spot.y);
            if (ForestBiomeData.ZoneAt(at.x, at.z) >= 0) Fail("손님 자리가 존 안");
            // 세 시대 진단(PlaytestForestEras)과 같은 이름표·간격 — 물건 3m · 집 5m · 존 소품 3m.
            var names = new HashSet<string> { "ForestCollectSpot", "ForestDeliveryMailbox", "ForestLandmark", "ForestFinishStall", "ForestVillager",
                "ForestFruitTree", "ForestTownScoreBoard", "ForestDeliveryCounter", "ForestWishStone", "ForestFurnitureStall" };
            int seen = 0;
            foreach (var mb in Object.FindObjectsByType<MonoBehaviour>(FindObjectsInactive.Exclude, FindObjectsSortMode.None))
            {
                string n = mb.GetType().Name;
                float need = names.Contains(n) ? PlaytestForestEras.ObjectClearance : n == "ForestHouse" ? PlaytestForestEras.HouseClearance : -1f;
                if (need < 0f) continue;
                seen++;
                float dist = Flat(mb.transform.position - at);
                if (dist < need) Fail($"손님 자리가 {n}({mb.name}) 에서 {dist:F1}m");
            }
            if (seen < 12) Fail($"비킬 물건이 {seen} 개뿐");
            foreach (var c in ForestZoneProps.Clusters)
                foreach (var p in c.Pieces)
                    if (Flat(ForestZoneProps.PiecePos(c, p) - at) < PlaytestForestEras.PropClearance) Fail("손님 자리가 존 소품 곁");
            for (int k = 0; k < 40; k++)
                foreach (var f in ForestEras.FolkList)
                    if (Flat(ForestEras.PosAt(f, k * ForestEras.Cycle / 40f) - at) < 2.5f) { Fail($"손님 자리가 {f.Id} 길 곁"); break; }
            if (Flat(new Vector3(0f, 0f, -15f) - at) < 4f) Fail("손님 자리가 스폰 곁");
            return " 자리";
        }

        private static string CheckFox(ForestVisitorRunner runner, Transform player)
        {
            ForestVisitors.ForceDayForTest(DayOf("fox"));
            ForestVisitors.ResetForTest();
            runner.Rebuild();
            var npc = runner.Npc;
            if (npc == null || npc.Data.Key != "fox" || runner.Pieces.Count != 0) { Fail("여우 날 손님"); return ""; }
            var it = ForestVisitors.FoxItem(ForestVisitors.Today);
            int price = ForestVisitors.FoxPrice(it);
            if (it.Value < 1400 || System.Array.IndexOf(FurnitureItem.Catalog, it) < 0 || price != Mathf.RoundToInt(it.FruitCost * 1.5f)) Fail($"여우 물건 {it.Id} 값 {price}");
            // 다가서기 — 멀면 없음, 들어오면 권함, 그대로 서 있으면 또 안 함, 물러났다 오면 산다(모자라면 못 삼).
            var spot = npc.transform.position;
            if (npc.CheckTalk(spot + new Vector3(10f, 0f, 0f)) != null) Fail("멀리서 말함");
            string offer = npc.CheckTalk(spot + new Vector3(1.5f, 0f, 0f));
            if (offer == null || !ForestVisitors.Rec.Offered || !offer.Contains(price.ToString())) Fail($"권함 {offer}");
            if (npc.CheckTalk(spot + new Vector3(1.2f, 0f, 0f)) != null) Fail("서 있기만 해도 또 말함");
            ForestState.Restore(price - 1);
            npc.CheckTalk(spot + new Vector3(5f, 0f, 0f));
            string shortLine = npc.CheckTalk(spot + new Vector3(1.5f, 0f, 0f));
            if (shortLine == null || ForestVisitors.Rec.Done || ForestState.FruitCount != price - 1) Fail($"과일 모자란데 삼 {shortLine}");
            ForestState.Restore(price + 5);
            int st = ForestHomeState.StockCount(it.Id);
            npc.CheckTalk(spot + new Vector3(5f, 0f, 0f));
            npc.CheckTalk(spot + new Vector3(1.5f, 0f, 0f));
            if (!ForestVisitors.Rec.Done || ForestState.FruitCount != 5 || ForestHomeState.StockCount(it.Id) != st + 1) Fail($"여우에게 못 삼(과일 {ForestState.FruitCount}·창고 {ForestHomeState.StockCount(it.Id)})");
            npc.CheckTalk(spot + new Vector3(5f, 0f, 0f));
            string after = npc.CheckTalk(spot + new Vector3(1.5f, 0f, 0f));
            if (after == null || ForestState.FruitCount != 5) Fail("산 뒤에 또 팜");
            string bodyNote = BodyCheck(npc);
            return $" 여우({it.Id} {price}{bodyNote})";
        }

        private static string BodyCheck(ForestVisitorNpc npc)
        {
            if (npc.TagText == null || !npc.TagText.Contains(ForestVisitors.Name(npc.Data))) Fail($"이름표 {npc.TagText}");
            if (string.IsNullOrEmpty(npc.Data.Body)) return npc.Orb ? "·구슬" : "";
            bool have = AssetDatabase.LoadAssetAtPath<GameObject>(SetupNpcCharacterImports.PrefabPath(npc.Data.Body)) != null;
            if (have && !npc.Rigged) Fail($"{npc.Data.Body} 몸이 있는데 안 심김");
            return have ? "·몸" : "·캡슐(몸 없는 PC)";
        }

        private static string CheckCollect(ForestVisitorRunner runner, string key)
        {
            var v = ForestVisitors.List[ForestVisitors.IndexOf(key)];
            ForestVisitors.ForceDayForTest(DayOf(key));
            ForestVisitors.ResetForTest();
            runner.Rebuild();
            var npc = runner.Npc;
            if (npc == null || npc.Data.Key != key) { Fail($"{key} 날 손님"); return ""; }
            if (key == "wisp" && !npc.Orb) Fail("도깨비불이 빛 구슬이 아님");
            string bodyNote = BodyCheck(npc);
            if (runner.Pieces.Count != v.N || runner.Spots.Count != v.N) { Fail($"{key} 조각 {runner.Pieces.Count}"); return ""; }
            var zones = new HashSet<int>();
            var avoid = ForestVisitorRunner.AvoidSpots();
            for (int i = 0; i < runner.Spots.Count; i++)
            {
                var p = runner.Spots[i];
                int z = ForestBiomeData.ZoneAt(p.x, p.y);
                if (z < 0) Fail($"조각 {i} 가 존 밖 {p}");
                zones.Add(z);
                for (int j = i + 1; j < runner.Spots.Count; j++) if (Vector2.Distance(p, runner.Spots[j]) <= ForestVisitors.PieceMinGap) Fail($"조각 {i}·{j} 가 {Vector2.Distance(p, runner.Spots[j]):F1}m");
                foreach (var q in avoid) if (Vector2.Distance(p, q) < ForestVisitors.PieceClear) { Fail($"조각 {i} 가 물건 곁 {Vector2.Distance(p, q):F1}m"); break; }
            }
            if (zones.Count != Mathf.Min(v.N, 4)) Fail($"조각이 존 {zones.Count} 곳");
            // 109-12-2 — 탐사원 날엔 마을 사람 루미가 광장에 나와 있고 평소 자리엔 없다.
            if (!string.IsNullOrEmpty(v.FolkId))
            {
                if (runner.HiddenFolk.Count != 1 || runner.HiddenFolk[0].gameObject.activeSelf || runner.HiddenFolk[0].Data.Id != v.FolkId)
                    Fail($"{key} 날 마을 사람 {v.FolkId} 이 안 숨음");
            }
            else if (runner.HiddenFolk.Count != 0) Fail($"{key} 날에 숨은 마을 사람");
            var again = ForestVisitors.PieceSpots(ForestVisitors.Today, v.N, avoid);
            for (int i = 0; i < again.Count; i++) if (again[i] != runner.Spots[i]) Fail("조각 자리가 부를 때마다 다름");
            // 다가서면 남은 방위를 알려 준다.
            var spot = npc.transform.position;
            npc.CheckTalk(spot + new Vector3(8f, 0f, 0f));
            string hint = npc.CheckTalk(spot + new Vector3(1.5f, 0f, 0f));
            bool anyDir = false;
            for (int d = 0; d < 8; d++) if (hint != null && hint.Contains(ForestVisitors.DirName(d))) anyDir = true;
            if (hint == null || !anyDir || !hint.Contains("(0/" + v.N + ")")) Fail($"방위 힌트 {hint}");
            // 줍기 — 멀면 안 줍고, 가까우면 줍는다. 다 모으면 보상.
            int fruit = ForestState.FruitCount, st = ForestHomeState.StockCount(v.Furniture);
            var pieces = new List<ForestVisitorPiece>(runner.Pieces);
            if (pieces[0].TryPick(pieces[0].transform.position + new Vector3(3f, 0f, 0f))) Fail("멀리서 주움");
            foreach (var pc in pieces) if (!pc.TryPick(pc.transform.position + new Vector3(0.5f, 0f, 0f))) Fail("가까워도 못 주움");
            if (ForestVisitors.Rec.GotCount != v.N || runner.Pieces.Count != 0) Fail($"주운 수 {ForestVisitors.Rec.GotCount}·남은 조각 {runner.Pieces.Count}");
            // 109-12-2 — 찾은 도깨비 꼬마는 대장 곁에 작게 서서 춤춘다(다시 세워도).
            if (v.Back)
            {
                if (runner.Kids.Count != v.N) Fail($"꼬마 {runner.Kids.Count}(찾은 {v.N})");
                foreach (var kid in runner.Kids)
                {
                    if (kid.Kind != ForestVisitorNpc.Role.Kid || !kid.Dancing || kid.BodyHeight >= ForestVisitors.Height * 0.7f) Fail("꼬마가 작게 춤추지 않음");
                    if (Flat(kid.transform.position - npc.transform.position) > 4.5f) Fail($"꼬마가 대장에게서 {Flat(kid.transform.position - npc.transform.position):F1}m");
                    string kl = kid.CheckTalk(kid.transform.position + new Vector3(0.5f, 0f, 0f));
                    if (kl == null || !kl.Contains("🧒")) Fail($"꼬마 한마디 {kl}");
                }
            }
            else if (runner.Kids.Count != 0) Fail("꼬마 아닌 손님에 꼬마");
            npc.CheckTalk(spot + new Vector3(8f, 0f, 0f));
            string done = npc.CheckTalk(spot + new Vector3(1.5f, 0f, 0f));
            if (!ForestVisitors.Rec.Done || ForestState.FruitCount != fruit + v.Fruit || ForestHomeState.StockCount(v.Furniture) != st + 1) Fail($"{key} 보상 {done}");
            // 다시 세워도 주운 조각은 안 나온다.
            runner.Rebuild();
            if (runner.Pieces.Count != 0) Fail("끝낸 날 조각이 다시 섬");
            if (v.Back && runner.Kids.Count != v.N) Fail("다시 세웠더니 꼬마가 사라짐");
            return $" {key}(존 {zones.Count}{bodyNote})";
        }

        private static string CheckBring(ForestVisitorRunner runner)
        {
            var v = ForestVisitors.List[ForestVisitors.IndexOf("traveler")];
            ForestVisitors.ForceDayForTest(DayOf("traveler"));
            ForestVisitors.ResetForTest();
            runner.Rebuild();
            var npc = runner.Npc;
            if (npc == null || npc.Data.Key != "traveler") { Fail("시간 여행자 날 손님"); return ""; }
            string bodyNote = BodyCheck(npc);
            // 만나기 전 채집은 안 센다.
            ForestVisitors.OnGather(ForestMuseumState.Category.Fossil);
            if (ForestVisitors.Rec.Bring1 != 0) Fail("만나기 전 채집을 셈");
            var spot = npc.transform.position;
            string first = npc.CheckTalk(spot + new Vector3(1.5f, 0f, 0f));
            if (first == null || !ForestVisitors.Rec.Met || ForestVisitors.Rec.Done) Fail($"첫 만남 {first}");
            ForestVisitors.OnGather(ForestMuseumState.Category.Insect); // 딴 갈래
            ForestVisitors.OnGather(ForestMuseumState.Category.Fossil);
            string mid = ForestVisitors.OnGather(ForestMuseumState.Category.Fossil);
            ForestVisitors.OnGather(ForestMuseumState.Category.Fossil); // 넘친 것
            if (mid != null || ForestVisitors.Rec.Bring1 != 2 || ForestVisitors.Rec.Bring2 != 0) Fail($"화석 셈 {ForestVisitors.Rec.Bring1}·{ForestVisitors.Rec.Bring2}");
            string ready = ForestVisitors.OnGather(ForestMuseumState.Category.Flower);
            if (ready == null || !ForestVisitors.BringReady(v, ForestVisitors.Rec)) Fail("다 모았는데 알림 없음");
            int fruit = ForestState.FruitCount, st = ForestHomeState.StockCount(v.Furniture);
            npc.CheckTalk(spot + new Vector3(8f, 0f, 0f));
            npc.CheckTalk(spot + new Vector3(1.5f, 0f, 0f));
            if (!ForestVisitors.Rec.Done || ForestState.FruitCount != fruit + v.Fruit || ForestHomeState.StockCount(v.Furniture) != st + 1) Fail("시간 여행자 보상");
            if (ForestVisitors.OnGather(ForestMuseumState.Category.Flower) != null) Fail("끝낸 뒤에도 셈");
            return $" 가져오기{bodyNote}";
        }

        private static string CheckSettleSpots()
        {
            var names = new HashSet<string> { "ForestCollectSpot", "ForestDeliveryMailbox", "ForestLandmark", "ForestFinishStall", "ForestVillager",
                "ForestFruitTree", "ForestTownScoreBoard", "ForestDeliveryCounter", "ForestWishStone", "ForestFurnitureStall" };
            var objects = new List<(string, Vector3, float)>();
            foreach (var mb in Object.FindObjectsByType<MonoBehaviour>(FindObjectsInactive.Exclude, FindObjectsSortMode.None))
            {
                string n = mb.GetType().Name;
                if (names.Contains(n)) objects.Add((n, mb.transform.position, PlaytestForestEras.ObjectClearance));
                else if (n == "ForestHouse") objects.Add((n, mb.transform.position, PlaytestForestEras.HouseClearance));
            }
            var spots = ForestVisitors.SettleSpots;
            if (spots.Length != 8) Fail($"눌러앉는 자리 {spots.Length}(여덟)");
            var spot = new Vector3(ForestVisitors.Spot.x, 0f, ForestVisitors.Spot.y);
            for (int i = 0; i < spots.Length; i++)
            {
                var at = new Vector3(spots[i].x, 0f, spots[i].y);
                if (ForestBiomeData.ZoneAt(at.x, at.z) >= 0) Fail($"자리 {i} 가 존 안");
                if (Flat(at - spot) < 3f) Fail($"자리 {i} 가 오늘 손님 자리 곁");
                if (Flat(at - spot) > 10f) Fail($"자리 {i} 가 광장에서 {Flat(at - spot):F1}m");
                foreach (var (n, p, r) in objects) if (Flat(p - at) < r) Fail($"자리 {i} 가 {n} 에서 {Flat(p - at):F1}m");
                foreach (var c in ForestZoneProps.Clusters) foreach (var pc in c.Pieces)
                    if (Flat(ForestZoneProps.PiecePos(c, pc) - at) < PlaytestForestEras.PropClearance) Fail($"자리 {i} 가 존 소품 곁");
                for (int k = 0; k < 40; k++)
                    foreach (var fo in ForestEras.FolkList)
                        if (Flat(ForestEras.PosAt(fo, k * ForestEras.Cycle / 40f) - at) < PlaytestForestEras.FolkClearance) { Fail($"자리 {i} 가 {fo.Id} 길 곁"); k = 40; break; }
                for (int j = i + 1; j < spots.Length; j++) if (Vector2.Distance(spots[i], spots[j]) < 2f) Fail($"자리 {i}·{j} 가 {Vector2.Distance(spots[i], spots[j]):F1}m");
                if (Flat(new Vector3(0f, 0f, -15f) - at) < PlaytestForestEras.SpawnClearance) Fail($"자리 {i} 가 스폰 곁");
            }
            return " 자리 여덟";
        }

        private static string CheckSettle(ForestVisitorRunner runner)
        {
            // 선원의 부탁을 세 번째로 마친 날 → 청함 → 눌러앉음.
            ForestVisitors.RestoreBonds(new[] { "sailor" }, new[] { 2 }, null, int.MinValue, null, false);
            int sailorDay = DayOf("sailor");
            ForestVisitors.ForceDayForTest(sailorDay);
            ForestVisitors.ResetForTest();
            runner.Rebuild();
            var npc = runner.Npc;
            foreach (var pc in new List<ForestVisitorPiece>(runner.Pieces)) pc.TryPick(pc.transform.position);
            var spot = npc.transform.position;
            Talk(npc, spot); // 보상 — 정 3
            if (ForestVisitors.BondOf("sailor") != 3 || !ForestVisitors.Rec.Done) Fail($"보상 뒤 정 {ForestVisitors.BondOf("sailor")}");
            string ask = Talk(npc, spot);
            if (ask == null || !ForestVisitors.Rec.AskSettle || ForestVisitors.IsSettled("sailor")) Fail($"눌러앉기 청함 {ask}");
            Talk(npc, spot);
            if (!ForestVisitors.IsSettled("sailor") || ForestVisitors.SettledList.Count != 1) Fail("눌러앉지 않음");
            if (ForestVisitors.GuestPoints() != ForestVisitors.GuestBeauty || ForestTownScore.GuestLine() == null) Fail("이웃 평가 +6");
            int total = ForestTownScore.Total();
            ForestVisitors.RestoreBonds(new[] { "sailor" }, new[] { 3 }, new string[0], int.MinValue, null, false);
            if (ForestTownScore.Total() != total - ForestVisitors.GuestBeauty) Fail("마을 평가에 이웃 몫이 안 듦");
            ForestVisitors.RestoreBonds(new[] { "sailor" }, new[] { 3 }, new[] { "sailor" }, int.MinValue, null, false);
            // 제 손님 날엔 한가운데 하나만.
            runner.Rebuild();
            if (runner.SettledNpcs.Count != 0) Fail("제 손님 날에 눌러앉은 자리에도 섬");
            // 딴 날 — 제자리에 서서 하루 한 번 선물, 수다 한 쌍.
            int otherDay = sailorDay + 1;
            while (ForestVisitors.WhoOn(otherDay).Key == "sailor") otherDay++;
            ForestVisitors.ForceDayForTest(otherDay);
            runner.Rebuild();
            if (runner.SettledNpcs.Count != 1) { Fail($"딴 날 눌러앉은 손님 {runner.SettledNpcs.Count}"); return ""; }
            var st = runner.SettledNpcs[0];
            var want = ForestVisitors.SettleSpots[0];
            if (st.Kind != ForestVisitorNpc.Role.Settled || Vector2.Distance(new Vector2(st.transform.position.x, st.transform.position.z), want) > 0.01f) Fail("눌러앉은 자리");
            if (st.ChatWith != runner.Npc || runner.Npc.ChatWith != st || st.Chat == null || !st.Chat.Contains("🧭")) Fail($"수다 한 쌍 {st.Chat}");
            int fruit = ForestState.FruitCount;
            string gift = Talk(st, st.transform.position);
            if (ForestState.FruitCount != fruit + ForestVisitors.GiftOf("sailor") || !ForestVisitors.GiftTakenToday("sailor")) Fail($"선물 {gift}");
            string chat = Talk(st, st.transform.position);
            if (ForestState.FruitCount != fruit + ForestVisitors.GiftOf("sailor") || chat == null || !chat.Contains(st.Chat)) Fail($"선물 두 번 또는 수다 없음 {chat}");
            // 다음 날엔 또 선물.
            ForestVisitors.ForceDayForTest(otherDay + 1);
            fruit = ForestState.FruitCount;
            ForestVisitors.TalkSettled("sailor");
            if (ForestState.FruitCount != fruit + ForestVisitors.GiftOf("sailor")) Fail("다음 날 선물 없음");
            // 루미가 눌러앉으면 평소 자리 마을 사람은 늘 숨는다.
            ForestVisitors.RestoreBonds(null, null, new[] { "sailor", "alien" }, int.MinValue, null, false);
            int d2 = otherDay;
            while (ForestVisitors.WhoOn(d2).Key == "alien" || ForestVisitors.WhoOn(d2).Key == "sailor") d2++;
            ForestVisitors.ForceDayForTest(d2);
            runner.Rebuild();
            if (runner.SettledNpcs.Count != 2 || runner.HiddenFolk.Count != 1) Fail($"눌러앉은 루미 {runner.SettledNpcs.Count}·숨은 마을 사람 {runner.HiddenFolk.Count}");
            ForestVisitors.RestoreBonds(null, null, null, int.MinValue, null, false);
            runner.Rebuild();
            foreach (var fo in Object.FindObjectsByType<ForestEraFolk>(FindObjectsInactive.Include, FindObjectsSortMode.None))
                if (!fo.gameObject.activeSelf) Fail($"마을 사람 {fo.Data.Id} 이 계속 숨음");
            return " 단골·선물·수다";
        }

        private static string CheckGestures(ForestVisitorRunner runner)
        {
            ForestVisitors.ForceDayForTest(DayOf("bugdoc"));
            ForestVisitors.ResetForTest();
            runner.Rebuild();
            var npc = runner.Npc;
            var at = npc.transform.position;
            var player = at + new Vector3(3f, 0f, 0f);
            // 돌아보기 — 5m 안이면 나를 본다.
            bool waved = false;
            for (int i = 0; i < 100; i++) { npc.Step(0.05f, player); waved |= npc.Waving; }
            float yaw = Vector3.Angle(npc.transform.forward, (player - at).normalized);
            if (yaw > 15f) Fail($"돌아보기 {yaw:F0}°");
            if (!waved) Fail("곁에 있어도 손짓 없음");
            // 멀면 손짓 없음.
            for (int i = 0; i < 40; i++) npc.Step(0.05f, at + new Vector3(20f, 0f, 0f));
            if (npc.Waving) Fail("멀어도 손짓");
            // 부탁을 다 들어주면 춤 — 깡충·돎.
            if (npc.Dancing) Fail("부탁 전에 춤");
            ForestVisitors.Rec.Done = true;
            var rot0 = npc.transform.rotation;
            float yMax = -1f;
            float baseY = npc.Visual != null ? npc.Visual.localPosition.y : 0f;
            for (int i = 0; i < 20; i++)
            {
                npc.Step(0.05f, player);
                npc.FollowCurve(at);
                if (npc.Visual != null) yMax = Mathf.Max(yMax, npc.Visual.localPosition.y - baseY);
            }
            if (!npc.Dancing || Quaternion.Angle(rot0, npc.transform.rotation) < 20f || yMax < 0.1f) Fail($"춤 — 돎 {Quaternion.Angle(rot0, npc.transform.rotation):F0}° 깡충 {yMax:F2}");
            return " 몸짓";
        }

        private static string Talk(ForestVisitorNpc npc, Vector3 spot)
        {
            npc.CheckTalk(spot + new Vector3(8f, 0f, 0f));
            return npc.CheckTalk(spot + new Vector3(1.2f, 0f, 0f));
        }

        private static string CheckPlace()
        {
            ForestHomeState.RestorePlacements(new int[0], new int[0], new string[0]); // 앞 진단이 채운 칸 — 끝에서 되돌린다
            Vector2Int cell = new Vector2Int(int.MinValue, 0);
            for (int x = -6; x <= 6 && cell.x == int.MinValue; x++)
                for (int y = -6; y <= 6; y++)
                {
                    var c = new Vector2Int(x, y);
                    if (ForestHomeState.IsValidCell(c) && ForestHomeState.CellItem(c) == null) { cell = c; break; }
                }
            if (cell.x == int.MinValue) { Fail("빈 칸 없음"); return ""; }
            ForestHomeState.RestoreStock(new[] { "visit_bug" }, new[] { 1 });
            string placed = ForestHomeState.TryPlaceAny(cell);
            if (placed != "visit_bug") Fail($"방문객 가구가 안 놓임 {placed}");
            ForestHomeState.PickUp(cell);
            return " 놓기";
        }

        private static string CheckSave()
        {
            ForestVisitors.ForceDayForTest(DayOf("sailor"));
            ForestVisitors.Restore(ForestVisitors.Today, "sailor", 0b10110, false, false, true, 0, 0);
            string json = ForestSaveState.ToJson();
            ForestVisitors.ResetForTest();
            if (!ForestSaveState.ApplyJson(json)) { Fail("세이브 되읽기"); return ""; }
            var s = ForestVisitors.Snapshot();
            if (s.Key != "sailor" || s.Got != 0b10110 || !s.Met || s.Done || ForestVisitors.Rec.GotCount != 3) Fail($"세이브 왕복 {s.Key}·{s.Got}");
            string v7 = json.Replace("\"version\":9", "\"version\":7");
            if (v7 == json) Fail("세이브 버전 9 아님");
            ForestSaveState.ApplyJson(v7);
            if (ForestVisitors.Snapshot().Got != 0) Fail("v7 세이브에 손님 기록이 남음");
            // v9 — 정·눌러앉은 손님·오늘 선물.
            ForestVisitors.RestoreBonds(new[] { "fox", "wisp" }, new[] { 2, 5 }, new[] { "wisp" }, 1234, new[] { "wisp" }, true);
            json = ForestSaveState.ToJson();
            ForestVisitors.RestoreBonds(null, null, null, int.MinValue, null, false);
            ForestSaveState.ApplyJson(json);
            var b = ForestVisitors.SnapshotBonds();
            if (ForestVisitors.BondOf("wisp") != 5 || ForestVisitors.BondOf("fox") != 2 || b.Settled.Length != 1 || b.Settled[0] != "wisp" || b.GiftDay != 1234 || b.GiftGot.Length != 1)
                Fail("세이브 v9 왕복");
            string v8 = json.Replace("\"version\":9", "\"version\":8");
            if (v8 == json) Fail("세이브 버전 9 아님");
            ForestSaveState.ApplyJson(v8);
            if (ForestVisitors.SettledList.Count != 0 || ForestVisitors.BondOf("wisp") != 0) Fail("v8 세이브에 단골이 남음");
            return " 세이브 v9";
        }

        private static float Flat(Vector3 d) => new Vector2(d.x, d.z).magnitude;

        private static void Fail(string msg)
        {
            _ok = false;
            Debug.LogError($"{T}: {msg}");
        }
    }
}
