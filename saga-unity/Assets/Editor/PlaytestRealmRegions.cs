using System.Collections.Generic;
using System.Linq;
using UnityEngine;
using Saga.Realm.Data;
using Saga.Realm.UI;
using Saga.Realm.World;

namespace Saga.EditorTools
{
    /// <summary>
    /// tasks U-0204 ① 지역 단위 전략 지도 진단 — `PlaytestRealmSlice` 가 지도 가까이 보기 앞에 부른다(한 프레임 안).
    /// ① 표: 모든 성이 한 지역 · 지역당 성 ≤ 12 · 이웃 대칭 · 중원에서 모든 지역에 닿음 ② 보기: 첫 화면 = 수도 지역 · 바꿈·세이브 `viewRegion` 왕복·옛 세이브 = 수도
    /// ③ 지도: 그 지역 내 성·회색 적 성만(≤ 12) · 이웃 화살표 = 이웃 수 · 화살표 누름 = 그 지역 ④ 따라감: 지금 성이 다른 지역으로 바뀌면 그 지역
    /// ⑤ 천하도 창: 성 있는 지역 줄 · 「보기」 = 그 지역·창 닫힘 ⑥ 손잡이(끄면 내 성 전부·화살표 0). 끝나면 세이브 JSON·지금 성·지도로 되돌린다.
    /// </summary>
    public static class PlaytestRealmRegions
    {
        private const string T = "[PlaytestRealmSlice] regions";
        private static bool _ok, _step;

        public static bool Run()
        {
            _ok = true;
            string json0 = RealmSaveState.ToJson();
            string city0 = RealmCityState.CurrentCity;
            bool viewing0 = RealmMapState.ViewingMap;
            RealmWorldMap map = null;
            foreach (var mm in Resources.FindObjectsOfTypeAll<RealmWorldMap>())
                if (mm.gameObject.scene.IsValid()) { map = mm; break; }
            try
            {
                RealmRegions.ResetForTest();
                if (!RealmMapState.ViewingMap) RealmMapState.Toggle();

                // ① 표
                Begin();
                var all = RealmRegions.AllCities().Distinct().ToList();
                var orphan = all.Where(c => RealmRegions.RegionOf(c).Length == 0).ToList();
                if (orphan.Count > 0) Fail($"지역 없는 성 {string.Join(",", orphan)}");
                var used = RealmRegions.All.Where(r => RealmRegions.CitiesIn(r.Id, all).Count > 0).ToList();
                foreach (var r in used)
                {
                    int n = RealmRegions.CitiesIn(r.Id, all).Count;
                    if (n > 12) Fail($"{r.Id} 성 {n} > 12");
                    foreach (var nb in RealmRegions.Neighbors(r.Id)) if (!RealmRegions.Neighbors(nb).Contains(r.Id)) Fail($"이웃 비대칭 {r.Id}→{nb}");
                }
                var seen = new HashSet<string> { "zhongyuan" };
                var q = new Queue<string>(seen);
                while (q.Count > 0) foreach (var nb in RealmRegions.Neighbors(q.Dequeue())) if (seen.Add(nb)) q.Enqueue(nb);
                var lost = used.Where(r => !seen.Contains(r.Id)).Select(r => r.Id).ToList();
                if (lost.Count > 0) Fail($"중원에서 못 닿는 지역 {string.Join(",", lost)}");
                End($"table OK - 성 {all.Count} 전부 지역 · 지역 {used.Count}(" + string.Join(" ", used.Select(r => $"{r.Name}{RealmRegions.CitiesIn(r.Id, all).Count}")) + ") · 이웃 대칭 · 중원에서 다 닿음");

                // ② 보기·세이브
                Begin();
                string cap = RealmRegions.CapitalRegion();
                if (RealmRegions.View != cap) Fail($"첫 화면 {RealmRegions.View} ≠ 수도 {cap}");
                string other = used.First(r => r.Id != cap).Id;
                RealmRegions.SetView(other);
                bool saved = RealmSaveState.ToJson().Contains($"\"viewRegion\":\"{other}\"");
                RealmRegions.Restore(null);
                if (!saved || RealmRegions.View != cap) Fail($"세이브 {saved} · 옛 세이브 {RealmRegions.View}");
                RealmRegions.Restore(other);
                if (RealmRegions.View != other) Fail("세이브 왕복");
                End($"view OK - 첫 화면 수도 {cap} · {other} 로 바꿈·viewRegion 왕복·옛 세이브 = 수도");

                // ③ 지도
                Begin();
                if (map == null) Fail("월드맵 없음");
                else
                {
                    RealmRegions.Restore(cap);
                    map.Rebuild();
                    int own = Count(map, "Marker_"), enemy = Count(map, "Enemy_");
                    var nbs = RealmRegions.Neighbors(cap);
                    if (own != RealmRegions.VisibleOwned().Count || enemy != RealmRegions.VisibleEnemies().Count) Fail($"표지 내 {own}·적 {enemy}");
                    if (own + enemy > 12) Fail($"한 화면 성 {own + enemy} > 12");
                    if (map.ArrowRegions.Count != nbs.Length) Fail($"화살표 {map.ArrowRegions.Count} ≠ 이웃 {nbs.Length}");
                    var tap = map.GetComponentsInChildren<RealmRegionArrow>(true).FirstOrDefault();
                    if (tap == null) Fail("화살표 탭 자리 없음");
                    else
                    {
                        string to = tap.RegionId;
                        RealmRegions.SetView(to);   // 카메라 탭과 같은 길(RealmWorldMapCamera.TrySelectCity)
                        if (RealmRegions.View != to || map.ArrowRegions.Count != RealmRegions.Neighbors(to).Length) Fail($"화살표 누름 {RealmRegions.View}≠{to}");
                    }
                    End($"map OK - {cap} 한 화면 내 성 {own}·적 성 {enemy}(≤12) · 화살표 {nbs.Length}(" + string.Join(",", nbs) + $") · 누르면 {tap?.RegionId}");
                }

                // ④ 따라감
                Begin();
                string home = RealmCityState.ActiveCityIds.FirstOrDefault(c => RealmRegions.RegionOf(c) == cap);
                if (home != null) RealmCityState.SetCurrentCity(home);   // 지금 성을 수도 지역에 두고 시작
                RealmRegions.Restore(cap);
                map?.Rebuild();
                string away = RealmCityState.ActiveCityIds.FirstOrDefault(c => RealmRegions.RegionOf(c) != cap && RealmRegions.RegionOf(c).Length > 0);
                if (away == null) End("follow SKIP - 다른 지역 내 성 없음");
                else
                {
                    RealmCityState.SetCurrentCity(away);   // Changed → 지도 다시 짓기 → FollowCurrent
                    map?.Rebuild();
                    if (RealmRegions.View != RealmRegions.RegionOf(away)) Fail($"지금 성 {away}(지역 {RealmRegions.RegionOf(away)}) 골랐더니 지금 성 {RealmCityState.CurrentCity} · 화면 {RealmRegions.View}");
                    End($"follow OK - 지금 성 {away} → 화면 {RealmRegions.View}");
                }

                // ⑤ 천하도 창
                Begin();
                var ui = RealmRegionUi.Instance;
                if (ui == null) Fail("천하도 창 없음");
                else
                {
                    if (ui.RowCount != used.Count) Fail($"천하도 줄 {ui.RowCount} ≠ 성 있는 지역 {used.Count}");
                    ui.Open();
                    int pick = Enumerable.Range(0, ui.RowCount).First(i => ui.RowId(i) != RealmRegions.View);
                    string pid = ui.RowId(pick);
                    string row = ui.RowText(pick);
                    ui.RowButton(pick).onClick.Invoke();
                    if (RealmRegions.View != pid || ui.PanelOpen) Fail($"보기 {RealmRegions.View}≠{pid} · 창 {ui.PanelOpen}");
                    if (!ui.ToggleText.Contains(RealmRegions.Get(pid).Name)) Fail($"단추 글「{ui.ToggleText}」");
                    End($"card OK - 줄 {ui.RowCount}「{row}」→ 보기 = {pid}·창 닫힘 · 단추「{ui.ToggleText.Replace("\n", " ")}」");
                }

                // ⑥ 손잡이
                Begin();
                RealmRegions.On = false;
                map?.Rebuild();
                if (RealmRegions.VisibleOwned().Count != RealmCityState.ActiveCityIds.Count || (map != null && map.ArrowRegions.Count != 0)) Fail("껐는데 지역만");
                End($"off OK - 끄면 내 성 전부 {RealmCityState.ActiveCityIds.Count}·화살표 0");
            }
            finally
            {
                RealmRegions.ResetForTest();
                RealmSaveState.ApplyJson(json0);
                if (RealmCityState.CurrentCity != city0) RealmCityState.SetCurrentCity(city0);
                if (RealmMapState.ViewingMap != viewing0) RealmMapState.Toggle();
                map?.Rebuild();
            }
            return _ok;
        }

        private static int Count(RealmWorldMap map, string prefix) => map.transform.Cast<Transform>().Count(c => c.name.StartsWith(prefix));

        private static void Begin() => _step = true;
        private static void End(string line) { if (_step) Debug.Log($"{T} {line}"); }

        private static void Fail(string why)
        {
            _ok = false;
            _step = false;
            Debug.LogError($"{T} FAIL - {why}");
        }
    }
}
