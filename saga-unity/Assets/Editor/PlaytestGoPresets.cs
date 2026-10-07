using System.Collections.Generic;
using System.Linq;
using UnityEngine;
using Saga.Go.Combat;
using Saga.Go.Data;
using Saga.Go.Player;
using Saga.Go.UI;

namespace Saga.EditorTools
{
    /// <summary>
    /// PLAN.md 109-14-18 "편성 1~4·싸우는 중 막기"(웹 사가만리 ⑲-18 진단 항목) — `PlaytestHeadless` 가 이야기 동료 진단 뒤에 부른다.
    /// 옛 세이브 = 지금 들판이 1번 · 빈 칸 = 지금 들판 베낌 · 넣기가 지금 칸에 적힘 · 돌아오면 옛 들판(순서까지) · 없는 인물·겹침 뺌 · 같은 칸 무시 ·
    /// 세이브 왕복 · 싸우는 중(쫓는 적 55.5m 안·방금 3초) 막힘 · 멀거나 쉬거나 제단만 치는 적이면 안 막힘 · 바꾸면 주인공이 앞 · 도감 단추 줄.
    /// 끝나면 동행·편성·들판·적을 되돌린다.
    /// </summary>
    public static class PlaytestGoPresets
    {
        private static string _tag;
        private static bool _ok;

        public static bool Run(string tag)
        {
            _tag = tag;
            _ok = true;
            var fc = FieldCombat.Instance;
            var pc = fc != null ? fc.GetComponent<PlayerController>() : null;
            if (fc == null || pc == null) { Fail("FieldCombat/PlayerController 없음"); return false; }
            var start = new List<string>(PartyState.MemberIds);
            var presets0 = PartyState.SnapshotPresets();
            int at0 = PartyState.PresetAt();
            var parts = new List<string>();
            FieldEnemy probe = null;
            try
            {
                foreach (var e in FieldEnemy.All) e.RestoreHomeForTest();
                pc.Teleport(fc.SafePoint);
                fc.ResetForTest();
                CheckPresets(fc, parts);
                probe = CheckBusy(fc, parts);
                CheckDex(fc, parts);
            }
            finally
            {
                HeroDexUi.Instance?.Close();
                if (probe != null) probe.ClearSiegeForTest();
                PartyState.Restore(start);
                PartyState.RestorePresets(presets0, at0);
                fc.ResetForTest();
                fc.RebuildParty();
                pc.Teleport(fc.SafePoint);
                foreach (var e in FieldEnemy.All) e.RestoreHomeForTest();
            }
            if (_ok) Debug.Log($"[{_tag}] presets OK - {string.Join(" · ", parts)}");
            return _ok;
        }

        private static string F() => string.Join(",", PartyState.FieldIds());
        private static string P(int i) => string.Join(",", PartyState.PresetOf(i));

        private static void CheckPresets(FieldCombat fc, List<string> parts)
        {
            var ids = GoHeroes.All.Take(6).Select(h => h.Id).ToList();
            string a = ids[0], b = ids[1], c = ids[2], d = ids[3], e = ids[4], f = ids[5];
            PartyState.Restore(ids);
            PartyState.RestorePresets(null, 0);                      // 옛 세이브 — 칸 없음
            string first = F();
            if (PartyState.PresetAt() != 0 || P(0) != first || P(1) != "" || first != $"{f},{e},{d}") Fail($"옛 세이브 1번 = 지금 들판 '{P(0)}'·'{P(1)}'");
            if (!PartyState.UsePreset(1, false, out _) || PartyState.PresetAt() != 1 || F() != first || P(1) != first) Fail($"빈 칸 = 지금 들판 베낌 '{F()}'·'{P(1)}'");
            PartyState.ToField(a);                                   // 편성 2 에 넣기
            if (P(1) != $"{a},{f},{e}" || P(0) != first) Fail($"넣기가 지금 칸에 안 적힘 '{P(1)}'·1번 '{P(0)}'");
            PartyState.MoveUp(e);
            string two = F();
            if (!PartyState.UsePreset(0, false, out _) || F() != first) Fail($"1번으로 돌아오면 옛 들판 '{F()}' ≠ '{first}'");
            if (!PartyState.UsePreset(1, false, out _) || F() != two) Fail($"2번 순서까지 '{F()}' ≠ '{two}'");
            if (PartyState.UsePreset(1, false, out string same) || same != null) Fail("같은 칸을 또 바꿈");
            if (PartyState.UsePreset(9, false, out string none) || none == null) Fail("없는 칸");
            parts.Add("옛 세이브 1번·빈 칸 베낌·넣기 적힘·돌아오면 옛 들판(순서)·같은 칸 무시");

            // 없는 인물·겹침 — 세이브에서 온 칸
            var saved = PartyState.SnapshotPresets();
            saved[2] = $"nobody,{c},{c},{b}";
            PartyState.RestorePresets(saved, 1);
            if (P(2) != $"nobody,{c},{c},{b}") Fail("세이브 칸을 그대로 못 읽음 " + P(2));
            if (!PartyState.UsePreset(2, false, out _) || PartyState.FieldIds()[0] != c || PartyState.FieldIds()[1] != b || P(2) != F()) Fail($"없는 인물·겹침 '{F()}'·'{P(2)}'");
            string three = F();
            // 세이브 왕복 — 쉼표 목록 · 지금 칸 · JSON 에 실림
            var snap = PartyState.SnapshotPresets();
            int at = PartyState.PresetAt();
            PartyState.RestorePresets(null, 0);
            PartyState.RestorePresets(snap, at);
            if (PartyState.PresetAt() != 2 || P(1) != two || P(2) != three) Fail($"세이브 왕복 {PartyState.PresetAt()}·'{P(1)}'·'{P(2)}'");
            string json = SaveState.ToJson();
            if (!json.Contains("\"partyPresets\"") || !json.Contains(two) || !json.Contains("\"partyPreset\": 2") && !json.Contains("\"partyPreset\":2")) Fail("세이브 JSON 에 편성이 없다");
            parts.Add("없는 인물·겹침 뺌·세이브 왕복");

            // 바꾸면 주인공이 앞
            fc.RebuildParty();
            if (fc.Party.Count > 1) fc.Swap(1);
            PartyState.UsePreset(0, false, out _);
            fc.RebuildParty(true);
            string party = string.Join(",", fc.Party.Skip(1).Select(m => m.Id));
            if (fc.ActiveIndex != 0 || fc.Active.Id != FieldCombat.HeroId || party != first) Fail($"바꾼 뒤 앞 {fc.Active?.Id}·명단 {party}");
            else parts.Add("바꾸면 주인공이 앞·들판 명단 따라감");
        }

        private static FieldEnemy CheckBusy(FieldCombat fc, List<string> parts)
        {
            fc.TickTimers(FieldCombat.CombatCalmSec + 0.1f);
            if (fc.InCombat()) { Fail("아무도 안 쫓는데 싸우는 중" + Chasers(fc)); return null; }
            var e = FieldEnemy.All.First(x => !x.IsGuardian && !x.IsHero && !x.DomainFoe && !x.StoryFoe && x.Alive);
            Vector3 fwd = fc.transform.forward; fwd.y = 0f; fwd.Normalize();
            e.WarpForTest(fc.transform.position + fwd * 20f);
            if (fc.InCombat()) Fail("쉬는 적 20m 에 싸우는 중");
            e.ForceChase();
            if (!fc.InCombat()) Fail("쫓는 적 20m 인데 안 막힘");
            if (PartyState.UsePreset(1, fc.InCombat(), out string why) || why == null) Fail("싸우는 중인데 편성이 바뀜");
            if (!FieldCombat.FormationBusy()) Fail("FormationBusy 가 InCombat 을 안 따름");
            e.WarpForTest(fc.transform.position + fwd * (FieldCombat.CombatRadius + 8f));
            e.ForceChase();
            if (fc.InCombat()) Fail("쫓는 적이 55.5m 밖인데 막힘");
            e.WarpForTest(fc.transform.position + fwd * 20f);
            e.SetSiege(fc.transform.position + fwd * 40f);             // 제단만 치는 적(곁 9.25m 밖)
            if (fc.InCombat()) Fail("제단만 치는 적인데 막힘");
            e.WarpForTest(fc.transform.position + fwd * 5f);           // 곁에 오면 나를 친다 = 싸움
            e.ForceChase();
            if (!fc.InCombat()) Fail("곁에 온 제단 적인데 안 막힘");
            e.ClearSiegeForTest();
            e.RestoreHomeForTest();
            fc.TickTimers(FieldCombat.CombatCalmSec + 0.1f);
            e.TakeHit(1f, GoElement.Physical, 0f, out _);            // 방금 때림
            e.RestoreHomeForTest();
            if (!fc.InCombat()) Fail("방금 때렸는데 안 막힘");
            fc.TickTimers(FieldCombat.CombatCalmSec + 0.1f);
            if (fc.InCombat()) Fail("3초 지나도 막힘");
            else parts.Add("쫓는 적 20m 막힘·55.5m 밖·쉼·제단만 치면 안 막힘·방금 3초");
            return e;
        }

        private static string Chasers(FieldCombat fc)
        {
            var list = FieldEnemy.All.Where(x => x.Alive && x.CurrentState != FieldEnemy.State.Wander && x.CurrentState != FieldEnemy.State.Return)
                .Select(x => $"{x.name}:{x.CurrentState}:{(x.transform.position - fc.transform.position).magnitude:0}");
            return " — " + string.Join(", ", list);
        }

        private static void CheckDex(FieldCombat fc, List<string> parts)
        {
            var dex = HeroDexUi.Instance;
            if (dex == null) { Fail("도감 없음"); return; }
            var ids = GoHeroes.All.Take(4).Select(h => h.Id).ToList();
            PartyState.Restore(ids);
            PartyState.RestorePresets(null, 0);
            fc.RebuildParty();
            dex.Open();
            if (dex.PresetButton(0) == null || !dex.PresetText(0).Contains("1") || !dex.PresetText(0).Contains("3") || !dex.PresetText(2).Contains(GoLocalization.T("preset.empty", "빈 칸"))) Fail($"단추 글 '{dex.PresetText(0)}'·'{dex.PresetText(2)}'");
            string first = F();
            dex.PresetButton(3).onClick.Invoke();
            if (PartyState.PresetAt() != 3 || F() != first) Fail("단추로 빈 칸 4번");
            PartyState.ToField(ids[0]);
            dex.PresetButton(0).onClick.Invoke();
            if (PartyState.PresetAt() != 0 || F() != first || !dex.PresetText(3).Contains("3")) Fail($"단추로 1번 '{F()}'·4번 '{dex.PresetText(3)}'");
            dex.Close();
            parts.Add("도감 단추 줄 넷(글·바꾸기)");
        }

        private static void Fail(string msg)
        {
            _ok = false;
            Debug.LogError($"[{_tag}] presets FAIL - {msg}");
        }
    }
}
