using System.Collections.Generic;
using UnityEngine;
using Saga.Realm.Data;
using Saga.Realm.World;

namespace Saga.EditorTools
{
    /// <summary>
    /// PLAN.md 109-13-2 "지도 위 실제 인물·모션" 진단 — 웹 사가천하 §5-10 진단 항목(순수 판 늘 같음 · 상한 24 · 명령→동작 표 완결 · 손잡이 끄면 빈 목록)
    /// + 이 트랙 몫(태수는 제 성에 선 무장 · 재야는 찾았지만 안 들인 사람 · 월드맵 배우 층 수 = 판 · 싸움터 두 장수 순서표).
    /// `CheckOrderGesture`·`CheckOrderCleared` 는 슬라이스 개간 단계가, `Run` 은 세 시대·싸움터 단계 뒤(전 성이 우리 것)에 부른다.
    /// </summary>
    public static class PlaytestRealmActors
    {
        private static bool _ok;

        public static bool CheckOrderGesture(string cityId, string orderKey, string clip)
        {
            _ok = true;
            if (RealmCityState.OrderThisMonth(cityId) != orderKey) Fail($"{cityId} 이 달 명령 {RealmCityState.OrderThisMonth(cityId)} ≠ {orderKey}");
            string gov = RealmActorPlan.GovernorOf(cityId);
            if (gov == null || gov != RealmCityState.OrderOfficerThisMonth(cityId)) Fail($"태수 {gov} ≠ 명령 낸 무장 {RealmCityState.OrderOfficerThisMonth(cityId)}");
            bool seen = false;
            foreach (var a in RealmActorPlan.FromState())
            {
                if (a.Kind != RealmActorPlan.Kind.Governor || a.CityId != cityId) continue;
                seen = true;
                if (a.Clip != clip) Fail($"{cityId} 태수 몸짓 {a.Clip} ≠ {clip}");
            }
            if (!seen) Fail($"{cityId} 태수가 판에 없음");
            if (_ok) Debug.Log($"[PlaytestRealmSlice] actors order OK - {cityId} {orderKey} → 태수 {gov} {clip}");
            return _ok;
        }

        public static bool CheckOrderCleared(string cityId)
        {
            _ok = true;
            if (RealmCityState.OrderThisMonth(cityId) != null) Fail("달이 넘어갔는데 명령 몸짓이 남음");
            foreach (var a in RealmActorPlan.FromState())
                if (a.Kind == RealmActorPlan.Kind.Governor && a.CityId == cityId && a.Clip != "idle") Fail($"새 달 태수 몸짓 {a.Clip}");
            return _ok;
        }

        public static bool Run()
        {
            _ok = true;
            CheckClipTable();
            CheckPurePlan();
            string state = CheckState();
            string map = CheckMap();
            CheckGeneralSchedule();
            string bodies = CheckBodies();
            if (_ok) Debug.Log($"[PlaytestRealmSlice] actors OK - 표 {RealmOrderData.AllKeys.Length} 명령 · 상한 {RealmActorPlan.Cap} · 끄면 빈 목록 · {state} · {map} · 두 장수 순서표 · {bodies}");
            return _ok;
        }

        private static void CheckClipTable()
        {
            var clips = new HashSet<string>(RealmActorPlan.Clips);
            foreach (var key in RealmOrderData.AllKeys)
                if (!clips.Contains(RealmActorPlan.MapClip(key))) Fail($"명령 {key} → 없는 동작 {RealmActorPlan.MapClip(key)}");
            var want = new Dictionary<string, string> { ["agri"] = "hoe", ["comm"] = "haggle", ["train"] = "swing", ["hire"] = "bow", ["wall"] = "hammer", ["tech"] = "idle" };
            foreach (var kv in want)
                if (RealmActorPlan.MapClip(kv.Key) != kv.Value) Fail($"{kv.Key} → {RealmActorPlan.MapClip(kv.Key)} ≠ {kv.Value}");
            if (RealmActorPlan.MapClip(null) != "idle") Fail("명령 없음이 서기가 아님");
        }

        private static void CheckPurePlan()
        {
            var cities = new List<string>();
            for (int i = 0; i < 30; i++) cities.Add("c" + i);
            var none = new List<(string, string)>();
            var plan = RealmActorPlan.Plan(cities, c => "g_" + c, c => c == "c1" ? "comm" : null, none);
            if (plan.Count != RealmActorPlan.Cap) Fail($"성 30 → 배우 {plan.Count} ≠ 상한 {RealmActorPlan.Cap}");
            if (plan[1].Clip != "haggle" || plan[0].Clip != "idle") Fail("명령 몸짓이 판에 안 실림");

            var wan = new List<(string, string)>();
            for (int i = 0; i < 20; i++) wan.Add(("w" + i, "c0"));
            plan = RealmActorPlan.Plan(cities.GetRange(0, 10), c => c == "c3" ? null : "g_" + c, c => null, wan);
            int gov = 0, w = 0;
            foreach (var a in plan) { if (a.Kind == RealmActorPlan.Kind.Governor) gov++; else w++; }
            if (gov != 9 || w != RealmActorPlan.Cap - 9) Fail($"태수 먼저 → 재야: 태수 {gov}·재야 {w}");
            if (plan[0].Kind != RealmActorPlan.Kind.Governor || plan[plan.Count - 1].Kind != RealmActorPlan.Kind.Wanderer) Fail("순서가 태수 → 재야가 아님");

            var again = RealmActorPlan.Plan(cities.GetRange(0, 10), c => c == "c3" ? null : "g_" + c, c => null, wan);
            for (int i = 0; i < plan.Count; i++)
                if (plan[i].OfficerId != again[i].OfficerId || plan[i].Clip != again[i].Clip) { Fail("판이 늘 같지 않음"); break; }
            if (RealmActorPlan.Plan(cities, c => "g", c => null, wan, enabled: false).Count != 0) Fail("손잡이 끔인데 배우가 있음");
        }

        private static string CheckState()
        {
            var plan = RealmActorPlan.FromState();
            int gov = 0, wan = 0;
            foreach (var a in plan)
            {
                if (a.Kind == RealmActorPlan.Kind.Governor)
                {
                    gov++;
                    if (RealmCityState.OfficerCityId(a.OfficerId) != a.CityId) Fail($"태수 {a.OfficerId} 가 {a.CityId} 에 안 섬");
                    if (!RealmCityState.OwnsCity(a.CityId)) Fail($"우리 성 아닌 {a.CityId} 에 태수");
                }
                else
                {
                    wan++;
                    foreach (var id in RealmCityState.RosterIds) if (id == a.OfficerId) Fail($"들인 {id} 가 재야로 떠돎");
                    if (!System.Linq.Enumerable.Contains(RealmCityState.FoundIds, a.OfficerId)) Fail($"못 찾은 {a.OfficerId} 가 떠돎");
                }
            }
            if (plan.Count > RealmActorPlan.Cap) Fail($"배우 {plan.Count} > 상한");
            if (gov == 0) Fail("태수가 하나도 없음");
            return $"지금 판 태수 {gov}·재야 {wan}";
        }

        private static string CheckMap()
        {
            RealmWorldMap map = null;
            foreach (var m in Resources.FindObjectsOfTypeAll<RealmWorldMap>())
                if (m.gameObject.scene.IsValid()) { map = m; break; }
            if (map == null) { Fail("월드맵 없음"); return "지도 없음"; }
            map.Rebuild();
            var actors = map.GetComponent<RealmMapActors>();
            int want = RealmActorPlan.FromState().Count;
            int named = 0;
            foreach (Transform c in map.transform) if (c.name.StartsWith("Actor_")) named++;
            if (actors == null || actors.Count != want) Fail($"월드맵 배우 {actors?.Count} ≠ 판 {want}");
            // Destroy 는 프레임 끝이라 옛 배우가 같이 셀 수 있다 — 적어도 판만큼은 있어야 한다.
            if (named < want) Fail($"Actor_ 물체 {named} < {want}");
            RealmActorPlan.Enabled = false;
            map.Rebuild();
            if (actors != null && actors.Count != 0) Fail("손잡이 끔인데 월드맵에 배우");
            RealmActorPlan.Enabled = true;
            map.Rebuild();
            return $"월드맵 배우 {want}";
        }

        /// <summary>109-13-2b 사실 몸 — 표가 있으면 월드맵 배우·싸움터 장수가 사실 몸으로 서고(키·같은 몸 안 겹침·눕고 섬), 손잡이로 끄면 대역 도형. 표가 없으면(묶음 없는 PC) 전부 대역.</summary>
        private static string CheckBodies()
        {
            var table = RealmBodies.Current;
            bool have = table != null && table.Controller != null && (table.OfficerCount > 0 || table.WandererCount > 0);
            if (RealmBodies.Index(0, "x") != -1) Fail("빈 표 번호가 -1 아님");
            if (RealmBodies.Index(5, "xuchang") != RealmBodies.Index(5, "xuchang")) Fail("몸 번호가 늘 같지 않음");
            if (RealmBodies.Index(3, "a", RealmBodies.Index(3, "a")) == RealmBodies.Index(3, "a")) Fail("건너뛴 몸을 또 고름");

            var parent = new GameObject("BodyTest").transform;
            int rigged = 0, fallback = 0;
            try
            {
                var f = RealmFigure.Create("T_off", parent, Vector3.zero, 0f, Color.white, 1.9f, 0f, RealmBodies.Role.Officer, "cao");
                var w = RealmFigure.Create("T_wan", parent, Vector3.zero, 0f, Color.white, 1.8f, 0f, RealmBodies.Role.Wanderer, "id1");
                foreach (var x in new[] { f, w }) if (x.Rigged) rigged++; else fallback++;
                if (have)
                {
                    if (table.OfficerCount > 0 && !f.Rigged) Fail("무장 몸이 있는데 대역으로 섬");
                    if (table.WandererCount > 0 && !w.Rigged) Fail("재야 몸이 있는데 대역으로 섬");
                    foreach (var x in new[] { f, w })
                    {
                        if (!x.Rigged) continue;
                        x.External = true;
                        x.Play("idle"); x.Pose(0f);
                        float h = HeightOf(x);
                        if (Mathf.Abs(h - x.Height) > x.Height * 0.15f) Fail($"{x.BodyName} 키 {h:0.00} ≠ {x.Height:0.00}");
                        if (x.Tilt > 40f) Fail($"{x.BodyName} 서 있는데 기움 {x.Tilt:0}°");
                        x.Play("die"); x.Pose(1.7f);
                        if (x.Tilt < 70f) Fail($"{x.BodyName} 쓰러졌는데 기움 {x.Tilt:0}°");
                        x.Play("attack"); x.Pose(0.3f);
                        if (x.GetComponentInChildren<SkinnedMeshRenderer>() == null) Fail($"{x.BodyName} 몸 그림 없음");
                    }
                    RealmBodies.ForceFallback = true;
                    var g = RealmFigure.Create("T_fb", parent, Vector3.zero, 0f, Color.white, 1.9f, 0f, RealmBodies.Role.Officer, "cao");
                    RealmBodies.ForceFallback = false;
                    if (g.Rigged) Fail("손잡이 끔인데 사실 몸");
                }
                else if (rigged > 0) Fail("몸 표가 없는데 사실 몸");
            }
            finally
            {
                RealmBodies.ForceFallback = false;
                Object.DestroyImmediate(parent.gameObject);
            }
            return have ? $"사실 몸 무장 {table.OfficerCount}·재야 {table.WandererCount}" : "몸 표 없음(대역 도형)";
        }

        private static float HeightOf(RealmFigure f)
        {
            float top = 0f, bottom = float.MaxValue;
            foreach (var r in f.GetComponentsInChildren<Renderer>()) { top = Mathf.Max(top, r.bounds.max.y); bottom = Mathf.Min(bottom, r.bounds.min.y); }
            return top - bottom;
        }

        private static void CheckGeneralSchedule()
        {
            void Expect(bool atkSide, bool won, float t, string clip)
            {
                string got = RealmBattlefield.GeneralClip(atkSide, won, t).clip;
                if (got != clip) Fail($"장수 순서표 {(atkSide ? "공" : "수")} 이김={won} t={t} → {got} ≠ {clip}");
            }
            Expect(true, true, 0.5f, "walk");
            Expect(true, true, 1.2f, "attack");
            Expect(false, true, 1.2f, "idle");
            Expect(false, true, 1.3f, "hit");
            Expect(true, true, 1.8f, "attack");
            Expect(false, true, 1.8f, "die");
            Expect(true, true, 3f, "idle");
            Expect(false, true, 3f, "die");
            Expect(true, false, 1.8f, "die");      // 진 싸움 — 공격 장수가 쓰러진다
            Expect(false, false, 1.8f, "attack");
        }

        private static void Fail(string msg)
        {
            _ok = false;
            Debug.LogError("[PlaytestRealmSlice] actors FAIL - " + msg);
        }
    }
}
