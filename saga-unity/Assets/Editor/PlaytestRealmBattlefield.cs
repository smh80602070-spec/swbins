using System.Collections.Generic;
using UnityEngine;
using Saga.Realm.Data;
using Saga.Realm.World;

namespace Saga.EditorTools
{
    /// <summary>
    /// PLAN.md 109-13 ① "싸움터 땅" 진단 — `PlaytestRealmSlice` 가 세 시대 단계 뒤에 부른다(판 상태를 안 건드린다).
    /// 표(쉰여덟 성 전부·남는 줄 없음) · 늘 같음 · 가장자리(8.4~9.8) · 결 여섯 이상 · 산성 봉우리 · 강가 물줄기 · 주 덮어쓰기(밀림·초원) ·
    /// 머릿수 눈금 · 싸움터 장면(무효 출진은 안 뜸·카메라 깊이·하늘빛·기둥 수·끝 자세 — 이긴 쪽은 한가운데, 진 쪽은 쓰러짐/물러남) · 이름 한 줄.
    /// </summary>
    public static class PlaytestRealmBattlefield
    {
        private static bool _ok;

        public static bool Run()
        {
            _ok = true;
            int kinds = CheckTable();
            CheckHeads();
            string stage = CheckStage();
            RealmBattlefield.Hide();
            if (_ok) Debug.Log($"[PlaytestRealmSlice] battlefield OK - 성 {RealmBattleLook.Cities.Count} · 결 {kinds} · 가장자리 · 늘 같음 · 머릿수 · {stage}");
            return _ok;
        }

        private static int CheckTable()
        {
            var ids = new HashSet<string>(RealmCityData.AllCityIds);
            foreach (var id in RealmEnemyCity.AllIds) ids.Add(id);
            foreach (var id in ids)
                if (!RealmBattleLook.Cities.ContainsKey(id)) Fail($"싸움터 표에 {id} 없음");
            foreach (var id in RealmBattleLook.Cities.Keys)
                if (RealmCityData.Get(id) == null) Fail($"싸움터 표의 {id} 가 성이 아님");

            var kinds = new HashSet<string>();
            foreach (var id in ids)
            {
                var a = RealmBattleLook.For(id);
                var b = RealmBattleLook.For(id);
                kinds.Add(a.Key);
                if (a.Key != b.Key || a.Ground != b.Ground || a.Props.Length != b.Props.Length) Fail($"{id} 늘 같지 않음");
                int want = a.PropKind == RealmBattleLook.Prop.Grass ? 6 : 8;
                if (a.Props.Length != want) Fail($"{id} 소품 {a.Props.Length} ≠ {want}");
                for (int i = 0; i < a.Props.Length; i++)
                {
                    var p = a.Props[i];
                    if (p.X != b.Props[i].X || p.Z != b.Props[i].Z) Fail($"{id} 소품 {i} 자리 흔들림");
                    float r = Mathf.Sqrt(p.X * p.X + p.Z * p.Z);
                    if (r < 8.39f || r > 9.81f || r > RealmBattlefield.GroundRadius) Fail($"{id} 소품 {i} 반지름 {r:0.00}");
                    if (p.Kind != a.PropKind) Fail($"{id} 소품 종류 섞임");
                }
            }
            if (kinds.Count < 6) Fail($"결 {kinds.Count} < 6");

            Expect("jinyang", "mount", RealmBattleLook.Prop.Peak, false);   // 산성 봉우리
            Expect("puyang", "river", RealmBattleLook.Prop.Reed, true);     // 강가 물줄기
            Expect("changsha", "hill", RealmBattleLook.Prop.Mound, false);  // 구릉 둔덕
            Expect("xiaopei", "plain", RealmBattleLook.Prop.Grass, false);
            Expect("yunzhong", "steppe", RealmBattleLook.Prop.Grass, false); // 막북 = 땅 결을 덮는 주
            Expect("zhuti", "jungle", RealmBattleLook.Prop.Reed, false);    // 강가 땅이어도 남중 밀림(물줄기 없음)
            if (RealmBattleLook.For("nowhere").Key != "plain") Fail("표 밖 성이 평야가 아님");
            return kinds.Count;
        }

        private static void Expect(string id, string key, RealmBattleLook.Prop prop, bool stream)
        {
            var l = RealmBattleLook.For(id);
            if (l.Key != key || l.PropKind != prop || l.Stream != stream) Fail($"{id} = {l.Key}/{l.PropKind}/{l.Stream} ≠ {key}/{prop}/{stream}");
        }

        private static void CheckHeads()
        {
            if (RealmBattlefield.Heads(400) != RealmBattlefield.MinPerSide) Fail("작은 군 머릿수 하한");
            if (RealmBattlefield.Heads(12000) != 12) Fail("천 명당 하나");
            if (RealmBattlefield.Heads(90000) != RealmBattlefield.MaxPerSide) Fail("머릿수 상한 24");
            if (RealmBattlefield.Alive(10, 5000, 0) != 0) Fail("전멸인데 선 기둥");
            if (RealmBattlefield.Alive(10, 5000, 1) != 1) Fail("살아 있으면 적어도 하나");
            if (RealmBattlefield.Alive(10, 5000, 5000) != 10) Fail("잃은 게 없는데 쓰러짐");
        }

        private static string CheckStage()
        {
            if (RealmBattlefield.Show(new RealmWarState.AttackResult(false, "x")) != null) Fail("무효 출진에 싸움터가 뜸");

            // 이긴 싸움 — 산성(진양), 아군 12000 → 9000, 적 8000 → 0
            var bf = RealmBattlefield.Show(new RealmWarState.AttackResult(true, "x", true, "jinyang", 12000, 9000, 8000, 0));
            if (bf == null || RealmBattlefield.Active != bf) { Fail("싸움터가 안 뜸"); return "장면 없음"; }
            if ((bf.transform.position - RealmBattlefield.Origin).sqrMagnitude > 0.01f) Fail("싸움터 자리");
            if (bf.Cam == null || bf.Cam.depth < 50f) Fail("싸움터 카메라 깊이");
            else if (bf.Cam.backgroundColor != RealmBattleLook.For("jinyang").Sky) Fail("하늘빛");
            if (bf.AtkCount != 12 || bf.AtkAlive != 9 || bf.DefCount != 8 || bf.DefAlive != 0) Fail($"기둥 {bf.AtkAlive}/{bf.AtkCount} · {bf.DefAlive}/{bf.DefCount}");
            if (bf.PropCount != 8 || bf.transform.Find("Peak") == null) Fail("산성 봉우리 소품");
            if (bf.transform.Find("Stream") != null) Fail("산성에 물줄기");
            bf.SampleForTest(RealmBattlefield.Duration);
            var leader = bf.transform.Find("Atk_0");
            if (leader == null || Mathf.Abs(leader.localPosition.x) > 1f) Fail($"이긴 장수가 한가운데로 안 나옴 x={leader?.localPosition.x:0.00}");
            for (int i = 0; i < bf.DefCount; i++)
            {
                var d = bf.transform.Find($"Def_{i}");
                if (d == null || Mathf.Abs(Mathf.DeltaAngle(0f, d.localEulerAngles.z)) < 80f) { Fail($"전멸한 적 {i} 가 서 있음"); break; }
            }
            var standing = bf.transform.Find("Atk_8");
            var fallen = bf.transform.Find("Atk_9");
            if (standing == null || Mathf.Abs(Mathf.DeltaAngle(0f, standing.localEulerAngles.z)) > 1f) Fail("산 아군이 쓰러짐");
            if (fallen == null || Mathf.Abs(Mathf.DeltaAngle(0f, fallen.localEulerAngles.z)) < 80f) Fail("잃은 아군이 서 있음");
            string won = $"이김 {bf.AtkAlive}/{bf.AtkCount}·{bf.DefAlive}/{bf.DefCount}";

            // 진 싸움 — 강가(복양), 물줄기 · 진 아군은 물러난다
            bf = RealmBattlefield.Show(new RealmWarState.AttackResult(true, "x", false, "puyang", 3000, 1000, 20000, 15000));
            if (bf == null) { Fail("둘째 싸움터가 안 뜸"); return won; }
            if (bf.transform.Find("Stream") == null) Fail("강가 물줄기 없음");
            // 옛 싸움터는 프레임 끝에 지워진다(Destroy) — 같은 프레임엔 Active 가 새 것인지만 본다.
            if (RealmBattlefield.Active != bf) Fail("싸움터가 겹침");
            bf.SampleForTest(0f);
            float x0 = bf.transform.Find("Atk_0").localPosition.x;
            bf.SampleForTest(RealmBattlefield.Duration);
            float x1 = bf.transform.Find("Atk_0").localPosition.x;
            if (x1 > -1.3f - 0.5f) Fail($"진 장수가 안 물러남 x {x0:0.0}→{x1:0.0}");
            var winner = bf.transform.Find("Def_0");
            if (winner == null || winner.localPosition.x > 1.3f) Fail("이긴 적이 안 나아감");

            string title = RealmBattleLook.Title("xiaopei");
            var city = RealmCityData.Get("xiaopei");
            if (city == null || !title.Contains(city.Name) || !title.Contains(RealmBattleLook.For("xiaopei").Name)) Fail($"이름 한 줄 '{title}'");
            return won + $" · 짐 물러남 x {x0:0.0}→{x1:0.0} · '{title}'";
        }

        private static void Fail(string msg)
        {
            _ok = false;
            Debug.LogError("[PlaytestRealmSlice] battlefield FAIL - " + msg);
        }
    }
}
