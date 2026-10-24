using System.Linq;
using UnityEngine;
using Saga.Realm.Data;
using Saga.Realm.Player;
using Saga.Realm.World;

namespace Saga.EditorTools
{
    /// <summary>
    /// tasks U-0102 지도 가까이 보기 진단 — `PlaytestRealmSlice` 세 시대 단계 끝(전 성이 우리 것, `PlaytestRealmActors` 다음)에 부른다(한 프레임 안).
    /// ① 지도를 켜면 카메라 중심 = 지금 성 ② 다른 성을 고르면 중심이 그쪽으로 옮겨 감 ③ 확대 끝 40 · 축소 끝 420 ④ 이름표 수 = 우리 성 수,
    /// 먼 줌(300)엔 지금 성 것만·가까이(60)엔 다 ⑤ 40m 에서 지금 성 태수 몸이 시야 안·화면 높이 8% 이상 ⑥ 날기 값 그대로.
    /// 끝나면 지금 성·지도 보기·카메라 거리/기울기를 시작 때로.
    /// </summary>
    public static class PlaytestRealmMapView
    {
        private const string T = "[PlaytestRealmSlice] mapview";
        private static bool _ok;

        public static bool Run()
        {
            _ok = true;
            string m = "";
            bool viewing0 = RealmMapState.ViewingMap;
            string city0 = RealmCityState.CurrentCity;
            RealmWorldMapCamera cam = null;
            float r0 = 0f, p0 = 0f;
            try
            {
                RealmRegions.On = false; // tasks U-0204 — 이 진단은 옛 흐름(내 성 전부 한 판)을 잰다 · 지역 화면은 PlaytestRealmRegions
                if (!RealmMapState.ViewingMap) RealmMapState.Toggle();
                cam = Object.FindFirstObjectByType<RealmWorldMapCamera>();
                RealmWorldMap map = null;
                foreach (var mm in Resources.FindObjectsOfTypeAll<RealmWorldMap>())
                    if (mm.gameObject.scene.IsValid()) { map = mm; break; }
                if (cam == null || map == null) { Fail($"지도 카메라 {cam != null}·지도 {map != null}"); return false; }
                r0 = cam.DebugRadius; p0 = cam.DebugPitch;
                map.Rebuild();
                var ids = RealmCityState.ActiveCityIds;
                if (ids.Count < 2) { Fail("우리 성이 둘 미만"); return false; }

                // ⓪ 켜면 다시 짓는다(꺼진 채 불러온 판의 구운 표지 셋 그대로이던 것) · 땅이 모든 성을 덮는다
                RealmMapState.Toggle(); RealmMapState.Toggle();   // 끔 → 켬(OnEnable)
                int markers = map.transform.Cast<Transform>().Count(c => c.name.StartsWith("Marker_") && c.gameObject.activeSelf);
                if (markers < ids.Count) Fail($"켠 지도 표지 {markers} < 우리 성 {ids.Count}");
                var ground = map.transform.Find("Ground");
                float reach = ids.Max(id => { var p = RealmWorldMap.CityWorldPos(id); return p.HasValue ? new Vector2(p.Value.x - map.transform.position.x, p.Value.z - map.transform.position.z).magnitude : 0f; });
                if (ground == null || ground.localScale.x * 0.5f < reach) Fail($"땅 반지름 {(ground != null ? ground.localScale.x * 0.5f : 0f):0} < 가장 먼 성 {reach:0}");
                m += $" 표지 {markers}·땅 반지름 {(ground != null ? ground.localScale.x * 0.5f : 0f):0}m(가장 먼 성 {reach:0}m) ·";

                // ① 켜면 지금 성 위
                cam.enabled = false; cam.enabled = true;   // OnEnable — 바로 지금 성 위
                for (int i = 0; i < 3; i++) cam.Tick(0.02f);
                var here = RealmWorldMap.CityWorldPos(RealmCityState.CurrentCity);
                if (here == null || Vector3.Distance(cam.DebugPivot, here.Value) > 1f) Fail($"중심 {cam.DebugPivot} ≠ 지금 성 {here}");

                // ② 다른 성 — 가장 먼 우리 성으로 바꾸고 1초 Tick
                string far = ids.OrderByDescending(id => Vector3.Distance(RealmWorldMap.CityWorldPos(id) ?? Vector3.zero, here ?? Vector3.zero)).First();
                RealmCityState.SetCurrentCity(far);
                var there = RealmWorldMap.CityWorldPos(far).Value;
                float d0 = Vector3.Distance(cam.DebugPivot, there);
                cam.Tick(0.05f);
                float d1 = Vector3.Distance(cam.DebugPivot, there);
                for (int i = 0; i < 40; i++) cam.Tick(0.05f);   // 2초 — 끝판 지도는 성 사이가 1.6km 라 1초(e^-6)엔 몇 m 남는다
                float d2 = Vector3.Distance(cam.DebugPivot, there);
                if (!(d1 < d0 && d1 > 1f) || d2 > 1f) Fail($"중심 따라가기 {d0:0}→{d1:0}→{d2:0.0}(부드럽게 2초 안에)");
                m += $" 따라감 {d0:0}→{d1:0}→{d2:0.0}m";

                // ③ 확대 범위
                cam.ZoomSteps(-60);
                if (Mathf.Abs(cam.DebugRadius - RealmWorldMapCamera.MinRadius) > 0.01f || RealmWorldMapCamera.MinRadius > 40f) Fail($"확대 끝 {cam.DebugRadius}");
                cam.ZoomSteps(60);
                if (Mathf.Abs(cam.DebugRadius - RealmWorldMapCamera.MaxRadius) > 0.01f) Fail($"축소 끝 {cam.DebugRadius}");

                // ④ 이름표
                map.Rebuild();
                if (map.LabelCount != ids.Count) Fail($"이름표 {map.LabelCount} ≠ 우리 성 {ids.Count}");
                cam.SetView(300f, 0.8f);
                map.RefreshLabels(cam.Cam, cam.DebugRadius);
                if (map.VisibleLabels != 1) Fail($"먼 줌 보이는 이름표 {map.VisibleLabels} ≠ 1(지금 성만)");
                cam.SetView(60f, 0.8f);
                map.RefreshLabels(cam.Cam, cam.DebugRadius);
                if (map.VisibleLabels != ids.Count) Fail($"가까이 보이는 이름표 {map.VisibleLabels} ≠ {ids.Count}");

                // ⑤ 40m 에서 지금 성 태수 몸이 보인다
                string govCity = RealmActorPlan.FromState().Where(a => a.Kind == RealmActorPlan.Kind.Governor).Select(a => a.CityId).FirstOrDefault();
                if (govCity == null) { Fail("태수 있는 성이 없음(몸 점검 못 함)"); return false; }
                RealmCityState.SetCurrentCity(govCity);   // Changed → 지도 다시 짓기(배우 포함)
                var govGo = map.transform.Cast<Transform>().FirstOrDefault(c => c.name == "Actor_Gov_" + govCity && c.gameObject.activeSelf);
                if (govGo == null) Fail($"{govCity} 태수 물체 없음");
                else
                {
                    cam.SetView(RealmWorldMapCamera.MinRadius, 0.6f);
                    for (int i = 0; i < 60; i++) cam.Tick(0.05f);
                    var foot = cam.Cam.WorldToViewportPoint(govGo.position);
                    var head = cam.Cam.WorldToViewportPoint(govGo.position + Vector3.up * RealmMapActors.FigureHeight);
                    float h = head.y - foot.y;
                    bool inView = foot.z > 0f && foot.x > 0f && foot.x < 1f && foot.y > 0f && head.y < 1f;
                    if (!inView || h < 0.08f) Fail($"최소 거리 태수 몸 시야 {inView} 화면 높이 {h:P0}");
                    m += $" · 최소 거리 태수 화면 높이 {h:P0}";
                }

                // ⑥ 날기 값 그대로
                if (RealmMounts.FlyRadius < RealmWorldMapCamera.MinRadius || RealmMounts.FlyRadius > RealmWorldMapCamera.MaxRadius) Fail("날기 거리가 범위 밖");
            }
            finally
            {
                RealmRegions.On = true;
                if (RealmCityState.CurrentCity != city0) RealmCityState.SetCurrentCity(city0);
                if (cam != null) { cam.SetView(r0, p0); cam.Tick(10f); }
                if (RealmMapState.ViewingMap != viewing0) RealmMapState.Toggle();
            }
            if (_ok) Debug.Log($"{T} OK - 켜면 지금 성 위·고르면 따라감·확대 {RealmWorldMapCamera.MinRadius}~{RealmWorldMapCamera.MaxRadius}·이름표(먼 줌 지금 성만)·가까이 태수 보임 |{m}");
            return _ok;
        }

        private static void Fail(string why)
        {
            _ok = false;
            Debug.LogError($"{T} FAIL - {why}");
        }
    }
}
