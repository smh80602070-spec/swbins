using System.Collections.Generic;
using System.Linq;
using UnityEditor;
using UnityEngine;
using Saga.Realm.Data;

namespace Saga.EditorTools
{
    /// <summary>
    /// `un.rk.enemy-castles` 적국 55·성 58 — 규칙 층만 본다(화면·씬 없이, RECURRING R-3). ① 적 성 55개: id 중복 0·카탈로그에 다 있음·기본 값(성벽·병력·기술 양수) ② 출진 사슬: 모든 적 성이
    /// 시작 성 셋(허창·진류·복양)에서 `AttackFromCityId` 를 따라 끊김·순환 없이 닿고, `TargetsFrom` 의 자식 수 합이 55 ③ 새 기록은 기본 값 그대로·성벽=최대 ④ 전쟁 상태: 초기값=새 기록·스냅샷/복원 왕복·
    /// 모르는 id 는 0 ⑤ 출진 오류(목표 아님·이미 함락·모르는 성)는 상태를 안 바꿈. 전투 결과(무작위)는 이 진단 밖.
    /// `-executeMethod Saga.EditorTools.PlaytestRealmEnemyCastles.Run` → "[PlaytestRealmEnemyCastles] OK/FAIL".
    /// </summary>
    public static class PlaytestRealmEnemyCastles
    {
        [MenuItem("Saga/Playtest Realm Enemy Castles")]
        public static void Run()
        {
            PlaytestKit.Begin("[PlaytestRealmEnemyCastles]");
            var saved = RealmEnemyCity.AllIds.ToDictionary(id => id, id => RealmWarState.Snapshot(id));
            using (PlaytestKit.ErrorCounter())
            {
                CheckCatalog();
                CheckChain();
                CheckNewRecord();
                CheckWarState();
                CheckAttackErrors();
            }
            foreach (var kv in saved)
                RealmWarState.Restore(kv.Key, kv.Value.wall, kv.Value.maxWall, kv.Value.troops, kv.Value.train, kv.Value.tech, kv.Value.captured);
            PlaytestKit.Summary("PlaytestRealmEnemyCastles");
            if (Application.isBatchMode) EditorApplication.Exit(PlaytestKit.Fails == 0 ? 0 : 1);
        }

        private static void CheckCatalog()
        {
            var ids = RealmEnemyCity.AllIds;
            PlaytestKit.Check(ids.Length == 55, $"un.rk.enemy-castles: 적 성 {ids.Length}개 (기대 55)");
            PlaytestKit.Check(ids.Distinct().Count() == ids.Length, "un.rk.enemy-castles: AllIds 에 id 중복");
            PlaytestKit.Check(RealmCityData.AllCityIds.Length == 3 && ids.Length + RealmCityData.AllCityIds.Length == 58, "un.rk.enemy-castles: 성 58(적 55 + 시작 3)이 안 맞음");
            var lands = new HashSet<RealmLand>();
            foreach (string id in ids)
            {
                var d = RealmEnemyCity.Get(id);
                PlaytestKit.Check(d != null && d.Id == id, $"un.rk.enemy-castles: {id} 가 카탈로그에 없거나 id 가 다름");
                if (d == null) continue;
                lands.Add(d.Land);
                PlaytestKit.Check(!string.IsNullOrEmpty(d.Name) && d.BaseWall > 0 && d.BaseTroops > 0 && d.BaseTrain >= 0 && d.BaseTech > 0, $"un.rk.enemy-castles: {id} 기본 값 이상");
            }
            PlaytestKit.Check(lands.Count == 2, "un.rk.enemy-castles: 평야·강 지형이 둘 다 나오지 않음");
            PlaytestKit.Check(RealmEnemyCity.Get("nope") == null, "un.rk.enemy-castles: 모르는 id 가 null 이 아님");
        }

        private static void CheckChain()
        {
            var starts = new HashSet<string>(RealmCityData.AllCityIds);
            var enemies = new HashSet<string>(RealmEnemyCity.AllIds);
            int childSum = 0;
            foreach (string id in RealmEnemyCity.AllIds)
            {
                var d = RealmEnemyCity.Get(id);
                if (d == null) continue;
                PlaytestKit.Check(d.AttackFromCityId != id, $"un.rk.enemy-castles: {id} 가 자기 자신에서 출진");
                // 출진 사슬을 거슬러 올라가 시작 성에 닿는지(순환·끊김 검사).
                var seen = new HashSet<string> { id };
                string cur = d.AttackFromCityId;
                bool ok = false;
                for (int step = 0; step < 100; step++)
                {
                    if (starts.Contains(cur)) { ok = true; break; }
                    if (!enemies.Contains(cur) || !seen.Add(cur)) break;
                    cur = RealmEnemyCity.Get(cur).AttackFromCityId;
                }
                PlaytestKit.Check(ok, $"un.rk.enemy-castles: {id} 의 출진 사슬이 시작 성에 안 닿음(끊김/순환, 마지막 {cur})");
            }
            foreach (string from in starts.Concat(enemies))
            {
                var kids = RealmEnemyCity.TargetsFrom(from);
                childSum += kids.Count;
                foreach (string k in kids) PlaytestKit.Check(RealmEnemyCity.Get(k).AttackFromCityId == from, $"un.rk.enemy-castles: TargetsFrom({from}) 의 {k} 가 그 성에서 출진하지 않음");
                PlaytestKit.Check(kids.Count == 0 || RealmEnemyCity.TargetFrom(from) == kids[0], $"un.rk.enemy-castles: TargetFrom({from}) 이 첫 목표가 아님");
            }
            PlaytestKit.Check(childSum == RealmEnemyCity.AllIds.Length, $"un.rk.enemy-castles: 자식 수 합 {childSum} ≠ 55(성이 두 곳에서 칠 수 있거나 빠짐)");
            PlaytestKit.Check(RealmEnemyCity.TargetsFrom("xuchang").Contains(RealmEnemyCity.XiaopeiId), "un.rk.enemy-castles: 허창에서 소패를 못 침");
            PlaytestKit.Check(RealmEnemyCity.TargetsFrom("nope").Count == 0 && RealmEnemyCity.TargetFrom("nope") == null && RealmEnemyCity.TargetFrom(null) == null, "un.rk.enemy-castles: 모르는 성에 목표가 있음");
        }

        private static void CheckNewRecord()
        {
            foreach (string id in RealmEnemyCity.AllIds)
            {
                var d = RealmEnemyCity.Get(id);
                var r = RealmEnemyCity.NewRecord(id);
                PlaytestKit.Check(r != null && d != null && r.Wall == d.BaseWall && r.MaxWall == d.BaseWall && r.Troops == d.BaseTroops && r.Train == d.BaseTrain && r.Tech == d.BaseTech && !r.Captured, $"un.rk.enemy-castles: {id} 새 기록이 기본 값이 아님");
            }
            PlaytestKit.Check(RealmEnemyCity.NewRecord("nope") == null, "un.rk.enemy-castles: 모르는 id 의 새 기록이 null 이 아님");
        }

        private static void CheckWarState()
        {
            foreach (string id in RealmEnemyCity.AllIds)
                RealmWarState.Restore(id, 1, 2, 3, 4, 5, false);
            foreach (string id in RealmEnemyCity.AllIds)
            {
                var d = RealmEnemyCity.Get(id);
                RealmWarState.Restore(id, d.BaseWall, d.BaseWall, d.BaseTroops, d.BaseTrain, d.BaseTech, false);
                var s = RealmWarState.Snapshot(id);
                PlaytestKit.Check(s.wall == d.BaseWall && s.maxWall == d.BaseWall && s.troops == d.BaseTroops && !s.captured && RealmWarState.Get(id) != null, $"un.rk.enemy-castles: {id} 복원 후 스냅샷이 어긋남");
            }
            RealmWarState.Restore(RealmEnemyCity.XiaopeiId, 123, 4000, 77, 55, 66, true);
            var x = RealmWarState.Snapshot(RealmEnemyCity.XiaopeiId);
            PlaytestKit.Check(x == (123, 4000, 77, 55, 66, true) && RealmWarState.Xiaopei.Captured, $"un.rk.enemy-castles: 스냅샷 왕복 {x}");
            PlaytestKit.Check(RealmWarState.Snapshot("nope") == (0, 0, 0, 0, 0, false) && RealmWarState.Get("nope") == null, "un.rk.enemy-castles: 모르는 id 스냅샷이 0 이 아님");
        }

        private static void CheckAttackErrors()
        {
            string from = "xuchang";
            var city = RealmCityState.CityRecord(from);
            PlaytestKit.Check(city != null, "un.rk.enemy-castles: 허창 기록이 없음");
            if (city == null) return;
            var d = RealmEnemyCity.Get(RealmEnemyCity.XiaopeiId);
            RealmWarState.Restore(RealmEnemyCity.XiaopeiId, d.BaseWall, d.BaseWall, d.BaseTroops, d.BaseTrain, d.BaseTech, false);
            int troops = city.Troops, food = city.Food;

            var noTarget = RealmWarState.Attack(from, RealmEnemyCity.YongchangId);
            PlaytestKit.Check(!noTarget.Ok && !string.IsNullOrEmpty(noTarget.Message), "un.rk.enemy-castles: 이 성에서 못 치는 적국인데 출진이 됨");
            var unknownFrom = RealmWarState.Attack("nope");
            PlaytestKit.Check(!unknownFrom.Ok && !string.IsNullOrEmpty(unknownFrom.Message), "un.rk.enemy-castles: 모르는 성에서 출진이 됨");

            RealmWarState.Restore(RealmEnemyCity.XiaopeiId, 0, d.BaseWall, 100, d.BaseTrain, d.BaseTech, true);
            var captured = RealmWarState.Attack(from, RealmEnemyCity.XiaopeiId);
            PlaytestKit.Check(!captured.Ok && !captured.Won && !string.IsNullOrEmpty(captured.Message), "un.rk.enemy-castles: 이미 함락한 성에 또 출진함");
            PlaytestKit.Check(city.Troops == troops && city.Food == food, $"un.rk.enemy-castles: 실패한 출진이 허창 병력/군량을 바꿈({city.Troops}/{city.Food} ← {troops}/{food})");
        }
    }
}
