using UnityEngine;
using Saga.Core;
using Saga.Go.World;

namespace Saga.EditorTools
{
    /// <summary>
    /// tasks U-0226 1만리 본 지도 12구역 진단 — `PlaytestHeadless` 끝 무렵(한 프레임 안).
    /// ① ZoneOf 표(모서리·경계·지도 밖) ② 한 구역 한복판에서 보이는 식생·소품 < 전체 40% ③ 경계 넘으면 막 1·새 구역 켜짐·옛 구역 꺼짐
    /// ④ 띠 24m 안은 넘기 전에도 보임 ⑤ 경계 4m 안 왔다 갔다는 안 바뀜 ⑥ 지도 밖이면 다 꺼짐 ⑦ 끔이면 다 켜짐. 끝나면 플레이어 자리 기준으로 되돌린다.
    /// </summary>
    public static class PlaytestGoZones
    {
        private const string T = "[PlaytestHeadless] go-zones";

        public static bool Run()
        {
            bool ok = true;
            void Fail(string why) { ok = false; Debug.LogError($"{T} FAIL - {why}"); }
            var z = GoZones.Instance;
            if (z == null) { Debug.LogError($"{T} FAIL - GoZones 없음(GameBootstrap.Start 가 안 붙임)"); return false; }
            bool on0 = GoZones.On, cut0 = ZoneCut.On;
            var player = GameObject.FindWithTag("Player");
            Vector3 home = player != null ? player.transform.position : Vector3.zero;
            try
            {
                // ① 표
                (float x, float zz, int want)[] table =
                {
                    (-216f, -264f, 0), (-73f, -264f, 0), (-72f, -264f, 1), (215f, -1f, 5), (0f, 0f, 4), (0f, 30f, 7), (216f, 264f, 11), (-216f, 264f, 9),
                    (217f, 0f, -1), (0f, 265f, -1), (1400f, -860f, -1), (0f, -860f, -1),
                };
                foreach (var (x, zz, want) in table)
                    if (GoZones.ZoneOf(x, zz) != want) Fail($"ZoneOf({x},{zz}) = {GoZones.ZoneOf(x, zz)} (기대 {want})");
                if (ok) Debug.Log($"{T} table OK - 144m 3×4 = 12구역 · 모서리·경계·지도 밖(이야기 땅·서리봉 -1)");

                GoZones.On = true; ZoneCut.On = true;
                z.Collect();
                int all = z.ManagedCount;
                if (all < 30) Fail($"다스리는 렌더러가 {all} 뿐(식생·소품 루트를 못 찾음?)");

                // ② 한 구역 한복판
                int center = 4; // 가운데 줄 가운데 칸
                var rc = GoZones.RectOf(center);
                z.Apply(center);
                float frac = (float)z.VisibleCount / Mathf.Max(1, all);
                if (frac >= 0.4f) Fail($"구역 {center} 에서 보이는 몫 {frac:P0} (40% 넘음)");
                else Debug.Log($"{T} share OK - 다스림 {all} 중 구역 {center} 에서 보임 {z.VisibleCount} ({frac:P0}) · 키 큰 것 {z.TallCount} 은 늘 그림");

                // ③ 경계 넘기 ④ 띠
                z.Tick(new Vector3(rc.center.x, 0f, rc.center.y));
                int cut0n = ZoneCut.Count;
                z.Tick(new Vector3(rc.xMax + 10f, 0f, rc.center.y)); // 동쪽 구역 5 로
                if (z.Current != 5 || ZoneCut.Count != cut0n + 1) Fail($"경계 넘어 구역 {z.Current}·막 {ZoneCut.Count - cut0n} (기대 5·1)");
                int bandHits = 0, wrong = 0;
                foreach (var r in Object.FindObjectsByType<Renderer>(FindObjectsInactive.Exclude, FindObjectsSortMode.None))
                {
                    var c = r.bounds.center;
                    int zc = GoZones.ZoneOf(c.x, c.z);
                    if (zc < 0) continue;
                    if (!IsManaged(r)) continue;
                    bool inBand = GoZones.Shows(5, new Vector2(c.x, c.z)) && zc != 5;
                    if (inBand && r.enabled) bandHits++;
                    if (!GoZones.Shows(5, new Vector2(c.x, c.z)) && r.enabled) wrong++;
                }
                if (wrong > 0) Fail($"구역 5 밖인데 그려지는 렌더러 {wrong}");
                if (bandHits == 0) Fail("이웃 띠 24m 안 렌더러가 하나도 안 보임");
                if (ok) Debug.Log($"{T} cross OK - 4→5 막 1번 · 새 구역 켜짐·옛 구역 꺼짐 · 띠 안 보임 {bandHits}");

                // ⑤ 왔다 갔다
                int n0 = ZoneCut.Count;
                z.Tick(new Vector3(rc.xMax - 2f, 0f, rc.center.y)); // 구역 4 쪽으로 2m — 여유 4m 안
                if (z.Current != 5 || ZoneCut.Count != n0) Fail($"경계 2m 안 되돌아옴에 구역이 바뀜({z.Current})");
                z.Tick(new Vector3(rc.xMax - 6f, 0f, rc.center.y));
                if (z.Current != 4) Fail($"6m 들어가도 구역 4 로 안 바뀜({z.Current})");
                else Debug.Log($"{T} hysteresis OK - 경계 4m 안 왔다 갔다는 그대로, 넘으면 바뀜");

                // ⑥ 지도 밖 ⑦ 끔
                z.Tick(new Vector3(1400f, 0f, -860f));
                if (z.Current != -1 || z.VisibleCount != 0) Fail($"지도 밖인데 보임 {z.VisibleCount}");
                GoZones.On = false;
                z.Tick(home);
                int enabledAll = 0;
                foreach (var r in Object.FindObjectsByType<Renderer>(FindObjectsInactive.Exclude, FindObjectsSortMode.None))
                    if (IsManaged(r) && r.enabled) enabledAll++;
                if (z.VisibleCount < all * 0.9f) Fail($"끔인데 보임 {z.VisibleCount}/{all}");
                if (ok) Debug.Log($"{T} off OK - 지도 밖 0 · 손잡이 끄면 {z.VisibleCount}/{all} 보임");
            }
            finally
            {
                GoZones.On = on0; ZoneCut.On = cut0;
                z.Apply(-2);
                z.Tick(home);
            }
            return ok;
        }

        private static bool IsManaged(Renderer r)
        {
            if (r.bounds.size.y >= GoZones.TallKeep) return false; // 키 큰 실루엣은 늘 그림
            for (var t = r.transform; t != null; t = t.parent)
                if (t.parent == null) return t.name == "Vegetation" || t.name.StartsWith("RegionProps_");
            return false;
        }
    }
}
