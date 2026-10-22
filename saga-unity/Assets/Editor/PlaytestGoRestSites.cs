using System.Collections.Generic;
using System.Reflection;
using UnityEngine;
using Saga.Go.Combat;
using Saga.Go.Data;
using Saga.Go.Player;
using Saga.Go.World;

namespace Saga.EditorTools
{
    /// <summary>
    /// tasks U-0168 1만리 모닥불 쉼터 진단 — `PlaytestHeadless` 가 자동 퀘스트 뒤에 부른다(한 프레임 안, 앉기 틱은 손으로).
    /// ① 자리: 적이 서는 지역마다 하나·그 지역 칸·풀/숲/논 칸·겹침 없음 ② 다가가면 앉음: 처음 = 지핌·부활 자리·동료 회복 ·
    /// 그 지역 쓰러진 잡몹 = 바로 섬(타이머 0)·수호장은 그대로 ③ 안 나갔다 오면 다시 안 앉음 · 12m 밖 나갔다 오면 다시(지핌 아님) ·
    /// ④ 다 쓰러지면 그 불 옆에서 일어남 ⑤ 안 지핀 상태 = 부활 자리 처음 자리 ⑥ 세이브 칸 restLit·restAt 왕복(규칙 층).
    /// 끝나면 쉼터·동료 체력·적 상태·자리·부활 자리를 시작 때로.
    /// </summary>
    public static class PlaytestGoRestSites
    {
        private const string T = "[PlaytestHeadless] restsites";
        private const BindingFlags PI = BindingFlags.Instance | BindingFlags.NonPublic | BindingFlags.Public;
        private static bool _ok;

        public static bool Run()
        {
            _ok = true;
            var field = RestSiteField.Instance;
            var fc = FieldCombat.Instance;
            var pc = fc != null ? fc.GetComponent<PlayerController>() : null;
            if (field == null || fc == null || pc == null) { Fail("RestSiteField·FieldCombat·PlayerController 없음"); return false; }
            var lit0 = GoRestSites.SnapshotLit();
            string at0 = GoRestSites.At;
            Vector3 pos0 = pc.transform.position, safe0 = fc.SafePoint;
            var hp0 = new List<float>();
            foreach (var mm in fc.Party) hp0.Add(mm.Hp);
            var stateP = typeof(FieldEnemy).GetProperty(nameof(FieldEnemy.CurrentState), PI);
            var timerF = typeof(FieldEnemy).GetField("_timer", PI);
            var reviveM = typeof(FieldEnemy).GetMethod("Revive", PI);
            var downed = new List<FieldEnemy>();
            string m = "";
            try
            {
                // ① 자리
                var sites = GoRestSites.Sites;
                int want = 0;
                foreach (var r in GoWorldMap.Regions) if (r.Roster != null && r.Roster.Length > 0) want++;
                if (sites.Length != want) Fail($"자리 {sites.Length} ≠ 적 서는 지역 {want}");
                var seen = new HashSet<string>();
                foreach (var s in sites)
                {
                    if (!seen.Add(s.Id)) Fail("같은 지역 둘 " + s.Id);
                    if (GoWorldMap.RegionAt(s.Gx, s.Gy) != s.Id) Fail($"{s.Id} 칸이 다른 지역");
                    if (GoRestSites.AllowedTiles.IndexOf(TestMapData.TileAt(s.Gx, s.Gy)) < 0) Fail($"{s.Id} 칸 '{TestMapData.TileAt(s.Gx, s.Gy)}'");
                }
                m += $" 자리 {sites.Length}";

                // ② 앉기 — 잡몹이 있는 지역 하나
                GoRestSites.ResetForTest();
                field.Refresh();
                Vector3 home = fc.SafePoint;
                string target = null;
                FieldEnemy grunt = null, guardian = null;
                foreach (var s in sites)
                {
                    foreach (var e in FieldEnemy.All)
                        if (e != null && e.Alive && GoWorldMap.RegionAt(e.Home) == s.Id && !e.IsGuardian && !e.DomainFoe && !e.StoryFoe && !e.IsHero) { grunt = e; break; }
                    if (grunt != null) { target = s.Id; break; }
                }
                if (target == null) { Fail("잡몹 있는 쉼터 지역 없음"); return false; }
                foreach (var e in FieldEnemy.All) if (e != null && e.Alive && e.IsGuardian && GoWorldMap.RegionAt(e.Home) == target) { guardian = e; break; }
                foreach (var e in guardian != null ? new[] { grunt, guardian } : new[] { grunt })
                {
                    stateP.SetValue(e, FieldEnemy.State.Dead);
                    timerF.SetValue(e, FieldEnemy.RespawnSec);
                    downed.Add(e);
                }
                foreach (var mm in fc.Party) mm.Hp = mm.MaxHp * 0.25f;
                Vector3 fire = FirePos(field, target);
                pc.Teleport(fire + new Vector3(30f, 0.5f, 0f));
                field.Tick(); // 멀리서 한 번 — 다시 앉을 수 있게
                pc.Teleport(fire + new Vector3(1.5f, 0.5f, 0f));
                if (field.Tick() != target) Fail("다가갔는데 안 앉음");
                if (!GoRestSites.IsLit(target) || GoRestSites.At != target) Fail($"지핌·부활 자리 {GoRestSites.IsLit(target)}·{GoRestSites.At}");
                foreach (var mm in fc.Party) if (mm.Hp < mm.MaxHp) { Fail($"{mm.Name} 회복 안 됨 {mm.Hp}/{mm.MaxHp}"); break; }
                if ((float)timerF.GetValue(grunt) > 0f) Fail("잡몹이 바로 안 섬");
                if (guardian != null && (float)timerF.GetValue(guardian) <= 0f) Fail("수호장도 섬");
                if ((fc.SafePoint - (fire + GoRestSites.WakeOffset)).sqrMagnitude > 0.01f) Fail($"부활 자리 {fc.SafePoint} ≠ 불 옆");
                m += $" · {target} 앉음·다시 섬 {field.LastRevived}{(guardian != null ? "·수호장 그대로" : "")}";

                // ③ 그 자리에서 또 = 안 앉음 · 나갔다 오면 다시(지핌 아님)
                if (field.Tick() != null) Fail("안 나갔는데 또 앉음");
                pc.Teleport(fire + new Vector3(20f, 0.5f, 0f));
                field.Tick();
                pc.Teleport(fire + new Vector3(1.5f, 0.5f, 0f));
                if (field.Tick() != target || GoRestSites.LitCount != 1) Fail("나갔다 와도 안 앉음");

                // ④ 다 쓰러짐 → 불 옆
                pc.Teleport(fire + new Vector3(40f, 0.5f, 0f));
                fc.WipeAndReturn();
                Vector3 woke = pc.transform.position - (fire + GoRestSites.WakeOffset); woke.y = 0f;
                if (woke.magnitude > 1f) Fail($"쓰러진 뒤 자리 {pc.transform.position} ≠ 불 옆 {fire}");

                // ⑤ 안 지핀 상태 = 처음 자리
                GoRestSites.ResetForTest();
                field.Refresh();
                if ((fc.SafePoint - home).sqrMagnitude > 0.01f) Fail("안 지핀 상태인데 부활 자리가 불 옆");

                // ⑥ 세이브 칸 왕복(규칙 층) — 모르는 id·안 지핀 at 은 버린다
                GoRestSites.Restore(new List<string> { target, "nowhere" }, target);
                var snap = GoRestSites.SnapshotLit();
                if (snap.Count != 1 || GoRestSites.At != target) Fail($"왕복 {snap.Count}·{GoRestSites.At}");
                GoRestSites.Restore(snap, "nowhere");
                if (GoRestSites.At != "") Fail("모르는 at 이 남음");
                if (!SaveState.ToJson().Contains("\"restLit\"")) Fail("세이브에 restLit 칸 없음");
            }
            finally
            {
                foreach (var e in downed) if (e != null && !e.Alive) reviveM.Invoke(e, null);
                GoRestSites.Restore(lit0, at0);
                field.Refresh();
                fc.SafePoint = safe0;
                for (int i = 0; i < hp0.Count && i < fc.Party.Count; i++) fc.Party[i].Hp = hp0[i];
                pc.Teleport(pos0);
            }
            if (_ok) Debug.Log($"{T} OK - 1만리 모닥불(지역마다 하나·앉으면 지핌·회복·부활 자리·잡몹 다시 섬·수호장 그대로·안 나가면 다시 안 앉음·쓰러지면 불 옆·안 지핀 = 처음 자리·세이브 칸) |{m}");
            return _ok;
        }

        private static Vector3 FirePos(RestSiteField field, string id)
        {
            var t = field.transform.Find("RestFire_" + id);
            return t != null ? t.position : GoRestSites.Get(id).Value.Pos;
        }

        private static void Fail(string why)
        {
            _ok = false;
            Debug.LogError($"{T} FAIL - {why}");
        }
    }
}
