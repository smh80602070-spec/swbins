using System.Collections.Generic;
using UnityEngine;
using Saga.Core;
using Saga.Realm.Data;
using Saga.Realm.World;

namespace Saga.EditorTools
{
    /// <summary>
    /// tasks U-0224 눈에 보이는 일꾼 진단 — `PlaytestRealmSlice` 국가 방침 뒤에 부른다(한 프레임 안).
    /// 일곱 줄: ① CountFor 표 ② 농업 올리면 다시 지을 때 일꾼 늘어남 ③ 시각이 흐르면 자리가 바뀜(걷는다) ④ 짐(갈래별 실을 때·내릴 때)
    /// ⑤ 길이 소품을 안 뚫음 ⑥ 같은 시드 같은 몸 ⑦ 끔 손잡이·군중 목록 없으면 0. 끝나면 성 값과 디오라마를 시작 때로.
    /// </summary>
    public static class PlaytestRealmWorkers
    {
        private const string T = "[PlaytestRealmSlice] workers";
        private static bool _ok;

        public static bool Run()
        {
            _ok = true;
            var builder = Object.FindAnyObjectByType<RealmCityBuilder>(FindObjectsInactive.Include);
            var rec = RealmCityState.CityRecord(RealmCityState.CurrentCity);
            if (builder == null || rec == null) { Debug.LogError($"{T} FAIL - 디오라마·성 기록 없음"); return false; }
            int agri0 = rec.Agri, comm0 = rec.Comm, food0 = rec.Food, pop0 = rec.Pop;
            bool on0 = RealmWorkers.On;
            try
            {
                // ① 수 셈(순수)
                Expect(RealmWorkers.CountFor(0, 0, 0, 260000) == 0, "밭·시장 0 인데 일꾼");
                Expect(RealmWorkers.CountFor(180, 80, 0, 260000) == 5, $"밭2·시장1 = 5 아님 {RealmWorkers.CountFor(180, 80, 0, 260000)}");
                Expect(RealmWorkers.CountFor(400, 360, 1200, 260000) == 12, "상한 12 아님");
                Expect(RealmWorkers.CountFor(900, 800, 0, 260000) == 12, "밭·시장 상한 넘어 12 아님");
                Expect(RealmWorkers.CountFor(400, 360, 0, 50000) == 2, "인구 5만 = 2 아님");
                Expect(RealmWorkers.CountFor(400, 360, 0, 0) == 0, "인구 0 인데 일꾼");
                Line("count OK - 밭마다 둘·시장마다 하나·상한 12·인구 2만마다 하나");

                if (!CrowdBodies.Available)
                {
                    rec.Agri = 400; rec.Comm = 360; rec.Pop = 260000;
                    Expect(Workers(builder).Count == 0, "군중 목록 없는데 일꾼이 섬");
                    Line("no crowd list OK - 군중 목록 없는 PC = 0명(캡슐 대체 없음), 나머지 줄 건너뜀");
                    return _ok;
                }

                // ② 다시 지을 때 늘어남
                RealmWorkers.On = true;
                rec.Agri = 180; rec.Comm = 80; rec.Food = 800; rec.Pop = 260000;
                int few = Workers(builder).Count;
                rec.Agri = 360;
                var many = Workers(builder);
                Expect(few == 5 && many.Count == 9, $"농업 180→360 일꾼 {few}→{many.Count} (5→9)");
                Line($"rebuild OK - 농업 180→360 다시 지으니 일꾼 {few}→{many.Count}");

                // ③ 걷는다 ④ 짐
                RealmWorkers granaryRun = null, gateFarm = null, market = null;
                foreach (var w in many)
                {
                    if (w.Job == RealmWorkers.Kind.FarmToGranary && granaryRun == null) granaryRun = w;
                    if (w.Job == RealmWorkers.Kind.GateToFarm && gateFarm == null) gateFarm = w;
                    if (w.Job == RealmWorkers.Kind.GateToMarket && market == null) market = w;
                }
                Expect(granaryRun != null && gateFarm != null && market != null, "세 갈래가 다 안 섬");
                if (granaryRun != null)
                {
                    granaryRun.Pose(0.2f);
                    var p0 = granaryRun.transform.localPosition;
                    bool walk0 = granaryRun.Walking;
                    granaryRun.Pose(1.7f);
                    var p1 = granaryRun.transform.localPosition;
                    Expect(walk0 && (p1 - p0).magnitude > 0.8f, $"1.5초에 {(p1 - p0).magnitude:0.00}m(0.7m/초 기대)");
                    Line($"walk OK - 1.5초에 {(p1 - p0).magnitude:0.00}m 옮김·걷기 동작");

                    float walk = RealmWorkers.LengthOf(granaryRun.Path) / RealmWorkers.Speed;
                    granaryRun.Pose(0.2f);
                    bool c0 = granaryRun.Carrying && granaryRun.Cargo != null && granaryRun.Cargo.activeSelf;
                    granaryRun.Pose(walk + RealmWorkers.WaitSec + 0.5f);
                    bool c1 = granaryRun.Carrying || granaryRun.Cargo.activeSelf;
                    gateFarm.Pose(0.2f);
                    bool g0 = gateFarm.Carrying;
                    float gw = RealmWorkers.LengthOf(gateFarm.Path) / RealmWorkers.Speed;
                    gateFarm.Pose(gw + RealmWorkers.WaitSec + 0.5f);
                    bool g1 = gateFarm.Carrying && gateFarm.Cargo.activeSelf;
                    market.Pose(0.2f);
                    bool m0 = market.Carrying && market.Cargo.name == "Cargo_Crate";
                    Expect(c0 && !c1 && !g0 && g1 && m0, $"짐 밭→곡창 갈 때 {c0}/올 때 {c1} · 남문→밭 갈 때 {g0}/올 때 {g1} · 시장 상자 {m0}");
                    Line("cargo OK - 밭→곡창 자루 지고 감·빈손 귀환 · 남문→밭 빈손 가 자루 지고 옴 · 시장 상자");
                }

                // ⑤ 길이 소품을 안 뚫음(밭·시장·곡창 몸통 — 목표 소품 곁은 제외)
                var props = Props(builder);
                int blocked = 0, segs = 0;
                foreach (var w in many)
                    for (int i = 1; i < w.Path.Count; i++)
                    {
                        segs++;
                        foreach (var o in props)
                            if (RealmWorkers.DistToSegmentXZ(o.Pos, w.Path[i - 1], w.Path[i]) < o.Half - 0.05f) { blocked++; break; }
                    }
                Expect(blocked == 0, $"소품을 뚫는 길 토막 {blocked}/{segs}");
                Line($"path OK - 길 토막 {segs} 중 소품 뚫음 {blocked}");

                // ⑥ 같은 시드 같은 몸
                var bodiesA = new List<int>();
                foreach (var w in many) bodiesA.Add(w.BodyIndex);
                var again = Workers(builder);
                bool same = again.Count == bodiesA.Count;
                for (int i = 0; same && i < again.Count; i++) same = again[i].BodyIndex == bodiesA[i];
                Expect(same, "다시 지었더니 다른 사람");
                Line($"seed OK - 다시 지어도 같은 몸 {bodiesA.Count}명");

                // ⑦ 끔
                RealmWorkers.On = false;
                Expect(Workers(builder).Count == 0, "끔인데 일꾼");
                Line("off OK - 손잡이 끄면 0명");
            }
            finally
            {
                RealmWorkers.On = on0;
                rec.Agri = agri0; rec.Comm = comm0; rec.Food = food0; rec.Pop = pop0;
                builder.Rebuild();
            }
            return _ok;
        }

        private static List<RealmWorkers> Workers(RealmCityBuilder builder)
        {
            builder.Rebuild();
            var list = new List<RealmWorkers>();
            var root = builder.transform.Find("Workers");
            if (root != null)
                for (int i = 0; i < root.childCount; i++)
                {
                    var w = root.GetChild(i).GetComponent<RealmWorkers>();
                    if (w != null) list.Add(w);
                }
            return list;
        }

        private static List<RealmWorkers.Prop> Props(RealmCityBuilder builder)
        {
            var list = new List<RealmWorkers.Prop>();
            void Add(string root, float half)
            {
                var r = builder.transform.Find(root);
                if (r == null) return;
                for (int i = 0; i < r.childCount; i++)
                {
                    var p = r.GetChild(i).localPosition;
                    list.Add(new RealmWorkers.Prop { Pos = new Vector3(p.x, 0f, p.z), Half = half });
                }
            }
            // 몸통 반지름(모서리 대각 아님) — 곁을 스치는 건 괜찮고 몸통 안으로 들어가면 뚫음
            Add("Farms", 0.7f); Add("Markets", 0.5f); Add("Granarys", 0.55f);
            return list;
        }

        private static void Expect(bool cond, string why)
        {
            if (cond) return;
            _ok = false;
            Debug.LogError($"{T} FAIL - {why}");
        }

        private static void Line(string msg)
        {
            if (_ok) Debug.Log($"{T} {msg}");
        }
    }
}
