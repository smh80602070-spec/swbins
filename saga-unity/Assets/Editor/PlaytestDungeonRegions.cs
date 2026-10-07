using System.Collections.Generic;
using UnityEngine;
using Saga.Dungeon.Data;
using Saga.Dungeon.UI;
using Saga.Dungeon.World;

namespace Saga.EditorTools
{
    /// <summary>
    /// PLAN.md 109-10-4 고정 세계 지역 아홉(웹 사가나락 §5.12) 진단 — `PlaytestDungeonHeadless` 가 시련 진단 뒤에 부른다(한 프레임 안, 시간은 `Tick` 으로).
    /// 웹 진단(지역 아홉·방위·마을 성격 / 막힘·자동지도 같은 표 / 안→밖 통과 / 구운 표 = 즉석 셈)을 이 트랙에 맞춰:
    /// 표(아홉·웹 키 순서·방위 여덟 + 가운데·칸 겹침 없음·글·시대 1~2) · 자리(칸 방이 씬에 있고 제 지역으로 읽힘·던전 층/능묘 속/난입 방은 지역 없음·복도 절반에서 바뀜) ·
    /// 땅빛(칸 방 바닥 전부·원래 빛 × 색조) · 배너(1.2초 머묾·지나치기만 하면 안 뜸·지역 밖 다녀와도 같은 지역은 다시 안 뜸·4초 뒤 꺼짐) ·
    /// M 지도(아홉 칸·이름 한자·지금 칸만 금빛·던전 층은 "지역 밖") · 번역 키(ko·en 둘 다).
    /// 끝나면 플레이어 자리·배너 상태를 시작 때로.
    /// </summary>
    public static class PlaytestDungeonRegions
    {
        private const string T = "[PlaytestDungeonHeadless] regions";
        private static readonly string[] WebOrder = { "jungwon", "neon", "saltmarsh", "hellgate", "solar", "silkroad", "heaven", "snowfort", "scrap" };
        // 웹 방위(동 → 시계 방향) — x 서→동, z 남→북.
        private static readonly Vector2Int[] WebCells =
        {
            new Vector2Int(0, 0), new Vector2Int(1, 0), new Vector2Int(1, -1), new Vector2Int(0, -1), new Vector2Int(-1, -1),
            new Vector2Int(-1, 0), new Vector2Int(-1, 1), new Vector2Int(0, 1), new Vector2Int(1, 1),
        };
        private static readonly string[] EraKeys = { "past", "modern", "future", "myth" };
        private static bool _ok;

        public static bool Run()
        {
            _ok = true;
            var playerGo = GameObject.FindWithTag("Player");
            var tracker = DungeonRegionTracker.Instance;
            var map = Object.FindFirstObjectByType<OverworldMapUI>();
            if (playerGo == null || tracker == null || map == null)
            {
                Fail($"필요한 것 없음(추적기 {tracker != null}·지도 {map != null})");
                return false;
            }
            Vector3 pos = playerGo.transform.position;
            int announced = tracker.Announced;
            string m = "";
            try
            {
                m += CheckTable() + CheckPlaces(tracker) + CheckBanner(tracker) + CheckMap(map, playerGo) + CheckLocalization();
            }
            finally
            {
                map.SetVisible(false);
                Place(playerGo, pos);
                tracker.ResetState(announced);
            }
            if (_ok) Debug.Log($"{T} OK - 표(아홉·웹 순·방위)·자리(칸 방·지역 밖·복도 절반)·땅빛·배너(1.2초·지나침·다시 안 뜸·꺼짐)·M 지도 아홉 칸·ko/en |{m}");
            return _ok;
        }

        private static string CheckTable()
        {
            var all = DungeonWorldMap.All;
            if (all.Length != WebOrder.Length) Fail($"지역 {all.Length} ≠ 9");
            var cells = new HashSet<Vector2Int>();
            for (int i = 0; i < all.Length && i < WebOrder.Length; i++)
            {
                var r = all[i];
                if (r.Key != WebOrder[i]) Fail($"{i} 번 {r.Key} ≠ 웹 {WebOrder[i]}");
                var c = new Vector2Int(r.GridX, r.GridZ);
                if (c != WebCells[i]) Fail($"{r.Key} 칸 {c} ≠ 웹 방위 {WebCells[i]}");
                if (!cells.Add(c)) Fail($"{r.Key} 칸 {c} 겹침");
                if (string.IsNullOrEmpty(r.NameKo) || string.IsNullOrEmpty(r.Hanja) || string.IsNullOrEmpty(r.DescKo) || string.IsNullOrEmpty(r.PlaceKo))
                    Fail($"{r.Key} 글 빠짐");
                if (r.Eras == null || r.Eras.Length < 1 || r.Eras.Length > 2) Fail($"{r.Key} 시대 {r.Eras?.Length}가지(1~2)");
                else foreach (var e in r.Eras) if (System.Array.IndexOf(EraKeys, e) < 0) Fail($"{r.Key} 시대 {e}");
                if (r.Rooms == null || r.Rooms.Length == 0) Fail($"{r.Key} 방 없음");
                if (DungeonWorldMap.FloorTint(i) == Color.white) Fail($"{r.Key} 땅빛이 흰색");
                if (DungeonWorldMap.IndexOf(r.Key) != i) Fail($"{r.Key} IndexOf");
            }
            return $" 칸 {cells.Count}";
        }

        private static string CheckPlaces(DungeonRegionTracker tracker)
        {
            var id = Shader.PropertyToID("_BaseColor");
            var block = new MaterialPropertyBlock();
            int rooms = 0;
            for (int i = 0; i < DungeonWorldMap.All.Length; i++)
            {
                var r = DungeonWorldMap.All[i];
                if (DungeonWorldMap.IndexAt(DungeonWorldMap.CellCenter(i)) != i) Fail($"{r.Key} 칸 가운데가 제 지역 아님");
                var tint = DungeonWorldMap.FloorTint(i);
                foreach (var path in r.Rooms)
                {
                    var go = GameObject.Find(path);
                    if (go == null) { Fail($"{r.Key} 방 {path} 없음"); continue; }
                    rooms++;
                    int at = DungeonWorldMap.IndexAt(go.transform.position);
                    if (at != i) Fail($"{path} 자리 {go.transform.position} → {at}(기대 {i})");
                    var floor = go.transform.Find("Floor");
                    var rend = floor != null ? floor.GetComponent<Renderer>() : null;
                    if (rend == null) { Fail($"{path} 바닥 없음"); continue; }
                    rend.GetPropertyBlock(block);
                    var want = rend.sharedMaterial.GetColor(id) * tint;
                    var got = block.GetColor(id);
                    if (Mathf.Abs(got.r - want.r) + Mathf.Abs(got.g - want.g) + Mathf.Abs(got.b - want.b) > 0.01f) Fail($"{path} 땅빛 {got} ≠ {want}");
                }
            }
            if (tracker.TintedFloors != rooms) Fail($"땅빛 받은 바닥 {tracker.TintedFloors} ≠ 방 {rooms}");

            // 지역 밖 — 던전 층·능묘 속·난입/시련 격리 방.
            var outside = new[]
            {
                new Vector3(0f, 0f, 120f), new Vector3(60f, 0f, 60f), new Vector3(-60f, 0f, 30f), new Vector3(-30f, 0f, 60f),
                new Vector3(-60f, 0f, 60f), new Vector3(-30f, 0f, 90f), new Vector3(0f, 0f, -60f),
            };
            foreach (var p in outside) if (DungeonWorldMap.IndexAt(p) != -1) Fail($"{p} 가 지역 {DungeonWorldMap.IndexAt(p)}(밖이어야)");
            var procRoom = GameObject.Find("/ProcRoom");
            if (procRoom != null && DungeonWorldMap.IndexAt(procRoom.transform.position) != -1) Fail("ProcRoom 이 지역 안");
            // 북 칸은 Room2~Room4 내내 한 지역, 복도 절반에서 바뀐다.
            int north = DungeonWorldMap.IndexOf("snowfort"), center = DungeonWorldMap.IndexOf("jungwon"), south = DungeonWorldMap.IndexOf("hellgate");
            if (DungeonWorldMap.IndexAt(new Vector3(0f, 0f, 90f)) != north || DungeonWorldMap.IndexAt(new Vector3(0f, 0f, 105f)) != north) Fail("Room4·Corridor4 가 북방 설산 아님");
            if (DungeonWorldMap.IndexAt(new Vector3(0f, 0f, -14f)) != center || DungeonWorldMap.IndexAt(new Vector3(0f, 0f, -16f)) != south) Fail("남쪽 들길 절반에서 안 바뀜");
            if (DungeonWorldMap.IndexAt(new Vector3(8f, 0f, -8f)) != center) Fail("난입 표식 자리가 중원 아님");
            return $" 방 {rooms}";
        }

        private static string CheckBanner(DungeonRegionTracker tracker)
        {
            int neon = DungeonWorldMap.IndexOf("neon"), hell = DungeonWorldMap.IndexOf("hellgate");
            Vector3 town4 = DungeonWorldMap.CellCenter(neon), town2 = DungeonWorldMap.CellCenter(hell);
            var proc = new Vector3(0f, 0f, 120f);
            int events = 0;
            System.Action<int> count = _ => events++;
            tracker.RegionEntered += count;
            try
            {
                tracker.ResetState(-1);
                tracker.Tick(town4, 1f);
                tracker.Tick(town4, 1f);
                if (tracker.Announced != -1 || events != 0) Fail("1.2초 전에 배너");
                tracker.Tick(town4, 0.3f);
                if (tracker.Announced != neon || events != 1 || !tracker.BannerVisible) Fail($"1.3초 머물러도 배너 없음(알림 {tracker.Announced}·{events})");
                string text = tracker.BannerText;
                if (!text.Contains(DungeonWorldMap.Name(neon)) || !text.Contains(DungeonWorldMap.All[neon].Hanja) || !text.Contains(DungeonWorldMap.Place(neon)))
                    Fail($"배너 글 '{text}'");

                // 스쳐 지나가기만(1.2초 안) — 안 뜬다.
                tracker.Tick(town2, 0f);
                tracker.Tick(town2, 0.5f);
                tracker.Tick(town2, 0.5f);
                tracker.Tick(town4, 0f);
                tracker.Tick(town4, 2f);
                if (events != 1 || tracker.Announced != neon) Fail($"스쳐 지난 지역에 배너(알림 {tracker.Announced}·{events})");

                // 지역 밖(던전 층)에 들어갔다 같은 지역으로 — 다시 안 뜬다.
                tracker.Tick(proc, 0f);
                tracker.Tick(proc, 5f);
                if (tracker.Current != -1) Fail("던전 층에서 지역 있음");
                tracker.Tick(town4, 0f);
                tracker.Tick(town4, 2f);
                if (events != 1) Fail("같은 지역으로 돌아와 다시 배너");

                tracker.Tick(town2, 0f);
                tracker.Tick(town2, 1.3f);
                if (events != 2 || tracker.Announced != hell || !tracker.BannerText.Contains(DungeonWorldMap.Name(hell))) Fail($"새 지역 배너 없음(알림 {tracker.Announced}·{events})");
                tracker.Tick(town2, DungeonRegionTracker.BannerSeconds + 0.1f);
                if (tracker.BannerVisible) Fail("4초 지나도 배너가 남음");
            }
            finally
            {
                tracker.RegionEntered -= count;
            }
            return $" 배너 {events}";
        }

        private static string CheckMap(OverworldMapUI map, GameObject playerGo)
        {
            if (map.CellCount != DungeonWorldMap.All.Length) { Fail($"지도 칸 {map.CellCount}"); return ""; }
            for (int i = 0; i < map.CellCount; i++)
            {
                string t = map.CellText(i);
                if (!t.Contains(DungeonWorldMap.Name(i)) || !t.Contains(DungeonWorldMap.All[i].Hanja)) Fail($"지도 칸 {i} 글 '{t}'");
            }
            map.SetVisible(true);
            int solar = DungeonWorldMap.IndexOf("solar");
            Place(playerGo, DungeonWorldMap.CellCenter(solar));
            map.Refresh();
            for (int i = 0; i < map.CellCount; i++)
                if ((map.CellColor(i) != OverworldMapUI.IdleColor(i)) != (i == solar)) Fail($"지도 칸 {i} 금빛이 틀림(지금 {solar})");
            if (!map.WhereText.Contains(DungeonWorldMap.Name(solar))) Fail($"지도 지금 줄 '{map.WhereText}'");
            Place(playerGo, new Vector3(0f, 0f, 120f));
            map.Refresh();
            for (int i = 0; i < map.CellCount; i++) if (map.CellColor(i) != OverworldMapUI.IdleColor(i)) Fail($"던전 층인데 칸 {i} 금빛");
            if (map.WhereText.Contains(DungeonWorldMap.Name(solar))) Fail("던전 층인데 지금 줄이 그대로");
            map.SetVisible(false);
            return " 지도 9";
        }

        private static string CheckLocalization()
        {
            int n = 0;
            foreach (var lang in new[] { "ko", "en" })
            {
                var ta = Resources.Load<TextAsset>($"Localization/dungeon_{lang}");
                if (ta == null) { Fail($"번역 {lang} 없음"); continue; }
                foreach (var r in DungeonWorldMap.All)
                    foreach (var k in new[] { $"region.{r.Key}", $"region.{r.Key}.desc", $"region.{r.Key}.place" })
                    {
                        if (!ta.text.Contains($"\"{k}\"")) Fail($"{lang} 에 {k} 없음");
                        n++;
                    }
                foreach (var e in EraKeys) if (!ta.text.Contains($"\"region.era.{e}\"")) Fail($"{lang} 에 region.era.{e} 없음");
            }
            return $" 키 {n}";
        }

        private static void Place(GameObject playerGo, Vector3 p)
        {
            var cc = playerGo.GetComponent<CharacterController>();
            if (cc != null) cc.enabled = false;
            playerGo.transform.position = p;
            if (cc != null) cc.enabled = true;
        }

        private static void Fail(string why)
        {
            _ok = false;
            Debug.LogError($"{T} FAIL - {why}");
        }
    }
}
