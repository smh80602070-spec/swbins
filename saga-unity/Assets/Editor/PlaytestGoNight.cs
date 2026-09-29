using System;
using UnityEngine;
using Saga.Go.Combat;
using Saga.Go.Data;
using Saga.Go.Player;
using Saga.Go.World;

namespace Saga.EditorTools
{
    /// <summary>
    /// PLAN.md 109-14-56b 결말 뒤 밤의 잔불 — 시각 판정(21~4시 경계·새벽 4시 갈림)·열림(29장 뒤·밤만)·자리 일곱(그 땅 안·땅 있음)·
    /// 가까이 14m → 잔당 셋(천하 등급 없음)·멀리 60m 밖·낮이 되면 거둠·다 쓰러뜨리면 금 800 + 교본 1·그날 한 번·다음 날 다시·세이브 칸.
    /// </summary>
    public static class PlaytestGoNight
    {
        private static bool _ok;

        public static bool Run(string tag)
        {
            _ok = true;
            var nf = NightEchoField.Instance;
            var fc = FieldCombat.Instance;
            var pc = fc != null ? fc.GetComponent<PlayerController>() : null;
            if (nf == null || fc == null || pc == null) { Fail("NightEchoField/FieldCombat 없음"); return false; }
            int ch0 = StoryState.Ch, st0 = StoryState.StepIndex;
            bool off0 = StoryState.OffForTest;
            int gold0 = GoldState.Gold;
            var mats0 = TalentState.SnapshotMats();
            var tal0 = TalentState.Snapshot();
            string day0 = NightEchoState.Day;
            var done0 = NightEchoState.Snapshot();
            var now0 = GoNight.NowFn;
            try
            {
                StoryState.OffForTest = false;
                NightEchoState.ResetForTest();
                // 시각 — 21시 정각부터 밤 · 4시 전까지 · 하루는 새벽 4시에 갈린다
                var d = new DateTime(2026, 9, 29, 0, 0, 0);
                if (GoNight.IsNight(d.AddHours(20).AddMinutes(59)) || !GoNight.IsNight(d.AddHours(21)) || !GoNight.IsNight(d.AddDays(1).AddHours(3).AddMinutes(59)) || GoNight.IsNight(d.AddDays(1).AddHours(4))) Fail("밤 경계(21시~4시 전)");
                if (GoNight.DayKey(d.AddHours(23)) != GoNight.DayKey(d.AddDays(1).AddHours(3).AddMinutes(59)) || GoNight.DayKey(d.AddDays(1).AddHours(3).AddMinutes(59)) == GoNight.DayKey(d.AddDays(1).AddHours(4))) Fail("하루 갈림(새벽 4시)");
                // 열림 — 29장 뒤 밤에만
                GoNight.NowFn = () => d.AddHours(23);
                StoryState.Restore(28, 0);
                if (GoNight.Lit) Fail("29장 앞인데 잔불이 탐");
                StoryState.Restore(29, 0);
                if (!GoNight.Lit) Fail("29장 뒤 밤인데 잔불이 안 탐");
                GoNight.NowFn = () => d.AddHours(12);
                if (GoNight.Lit) Fail("낮인데 잔불이 탐");
                // 자리 일곱 — 서로 떨어져 있고 그 땅 안·땅 위
                var sp = GoNight.Spots;
                if (sp.Length != 10) Fail("자리가 열이 아님(일곱 + 2차 결말 뒤 새 지역 셋)");
                for (int i = 0; i < sp.Length; i++)
                {
                    if (sp[i].Foes.Length != 3 || sp[i].Name.StartsWith("night.") || sp[i].Line.StartsWith("night.") || GoStory.NpcIndex(sp[i].WhoNpc) < 0) Fail($"{sp[i].Id} 표(잔당 셋·이름·한 줄·인물)");
                    for (int j = i + 1; j < sp.Length; j++) if (GoStory.Flat(sp[i].Pos, sp[j].Pos) < 20f) Fail($"{sp[i].Id}·{sp[j].Id} 자리가 너무 가까움");
                    Vector3 p = NightEchoField.SpotPos(sp[i]);
                    if (!Physics.Raycast(p + new Vector3(2f, 30f, 0f), Vector3.down, out var hit, 80f) || Mathf.Abs(hit.point.y - p.y) > 1.5f) Fail($"{sp[i].Id} 자리에 땅이 없다");
                }
                if (!GoFrost.Contains(sp[5].Pos) || !GoAreas.Sunken.Contains(sp[6].Pos)) Fail("서리봉·잠긴 도읍 잔불이 그 땅 안이 아님");
                if (!GoAreas.Amber.Contains(sp[7].Pos) || !GoAreas.Vault.Contains(sp[8].Pos) || !GoAreas.Fork.Contains(sp[9].Pos) || sp[7].After != 38 || sp[8].After != 38 || sp[9].After != 38) Fail("새 지역 셋이 그 땅 안·38장 뒤가 아님");
                // 낮 — 불도 잔당도 없다
                Vector3 s0 = NightEchoField.SpotPos(sp[0]);
                pc.Teleport(s0 + new Vector3(0f, 0.4f, 5f));
                fc.ResetForTest();
                nf.Tick(pc.transform.position);
                if (nf.CampUp("ruins") || nf.FireShown("ruins")) Fail("낮인데 불·잔당이 있음");
                // 밤 — 멀리서는 불만, 14m 안이면 잔당 셋
                GoNight.NowFn = () => d.AddHours(23);
                pc.Teleport(s0 + new Vector3(0f, 0.4f, 40f));
                nf.Tick(pc.transform.position);
                if (!nf.FireShown("ruins") || nf.CampUp("ruins")) Fail("밤 멀리서: 불은 타고 잔당은 없어야");
                pc.Teleport(s0 + new Vector3(0f, 0.4f, 6f));
                nf.Tick(pc.transform.position);
                if (nf.CampCount("ruins") != 3) { Fail($"가까이 갔는데 잔당 {nf.CampCount("ruins")}"); return false; }
                foreach (var e in nf.CampFoes("ruins")) if (!e.DomainFoe || !e.Alive) Fail("잔당이 숨은 터 식(천하 등급 없음)이 아님");
                // 60m 밖으로 — 거둠 · 다시 가까이 — 다시 섬
                pc.Teleport(s0 + new Vector3(0f, 0.4f, 80f));
                nf.Tick(pc.transform.position);
                if (nf.CampUp("ruins")) Fail("60m 넘게 떠났는데 잔당이 남음");
                pc.Teleport(s0 + new Vector3(0f, 0.4f, 6f));
                nf.Tick(pc.transform.position);
                if (nf.CampCount("ruins") != 3) Fail("다시 가까이 갔는데 잔당이 안 섬");
                // 낮이 되면 거둠
                GoNight.NowFn = () => d.AddDays(1).AddHours(5);
                nf.Tick(pc.transform.position);
                if (nf.CampUp("ruins") || nf.FireShown("ruins")) Fail("낮이 됐는데 불·잔당이 남음");
                // 다 쓰러뜨리면 — 금 800·교본 1·그 자리 그날 끝
                GoNight.NowFn = () => d.AddDays(1).AddHours(22);
                nf.Tick(pc.transform.position);
                if (nf.CampCount("ruins") != 3) { Fail("다음 날 밤 잔당이 안 섬"); return false; }
                int gold = GoldState.Gold, guide = TalentState.Count(GoTalent.Mat.Guide);
                foreach (var e in nf.CampFoes("ruins").ToArray()) if (e != null && e.Alive) { if (e.Shielded) e.SetShieldForTest(0f); e.TakeRaw(e.Hp + 99999f, Color.white); }
                if (GoldState.Gold != gold + 800 || TalentState.Count(GoTalent.Mat.Guide) != guide + 1 || !NightEchoState.Done("ruins") || nf.CampUp("ruins") || string.IsNullOrEmpty(nf.LastClear)) Fail($"처치 보상 금 {GoldState.Gold - gold}·교본 {TalentState.Count(GoTalent.Mat.Guide) - guide}·끝 {NightEchoState.Done("ruins")}");
                nf.Tick(pc.transform.position);
                if (nf.CampUp("ruins") || nf.FireShown("ruins")) Fail("그날 한 번인데 다시 탐");
                // 같은 밤 새벽 3시 — 아직 그날(어제 밤과 같은 하루)
                GoNight.NowFn = () => d.AddDays(2).AddHours(3);
                nf.Tick(pc.transform.position);
                if (nf.CampUp("ruins")) Fail("같은 하루(새벽 4시 전)인데 다시 탐");
                // 다음 하루 밤 — 다시 선다
                GoNight.NowFn = () => d.AddDays(2).AddHours(22);
                nf.Tick(pc.transform.position);
                if (nf.CampCount("ruins") != 3 || NightEchoState.Done("ruins")) Fail("다음 날 밤에 다시 안 섬");
                // 새 지역 셋(⑲-69) — 38장 앞엔 불도 잔당도 없고, 뒤엔 자리마다 불이 타고 잔당 셋 · 처치 보상 같은 800·교본 1
                GoNight.NowFn = () => d.AddDays(3).AddHours(23);
                NightEchoState.ResetForTest();
                StoryState.Restore(29, 0);
                foreach (string nid in new[] { "amber", "vault", "fork" })
                {
                    Vector3 px = NightEchoField.SpotPos(sp[GoNight.IndexOf(nid)]);
                    pc.Teleport(px + new Vector3(0f, 0.4f, 6f));
                    fc.ResetForTest();
                    nf.Tick(pc.transform.position);
                    if (nf.FireShown(nid) || nf.CampUp(nid)) Fail($"{nid}: 38장 앞인데 불·잔당이 있음");
                }
                StoryState.Restore(38, 0);
                foreach (string nid in new[] { "amber", "vault", "fork" })
                {
                    Vector3 px = NightEchoField.SpotPos(sp[GoNight.IndexOf(nid)]);
                    pc.Teleport(px + new Vector3(0f, 0.4f, 6f));
                    fc.ResetForTest();
                    nf.Tick(pc.transform.position);
                    if (!nf.FireShown(nid) || nf.CampCount(nid) != 3) { Fail($"{nid}: 38장 뒤 밤인데 불 {nf.FireShown(nid)}·잔당 {nf.CampCount(nid)}"); continue; }
                    int g1 = GoldState.Gold, gd1 = TalentState.Count(GoTalent.Mat.Guide);
                    var camp = nf.CampFoes(nid).ToArray();
                    foreach (var e in camp) if (e != null && e.Alive) { if (e.Shielded) e.SetShieldForTest(0f); e.TakeRaw(e.Hp + 99999f, Color.white); }
                    foreach (var e in camp) if (e != null) { e.gameObject.SetActive(false); UnityEngine.Object.Destroy(e.gameObject); } // 쓰러진 몸이 이 프레임에 남으면 뒤 지역 진단의 땅 레이를 막는다
                    if (GoldState.Gold != g1 + 800 || TalentState.Count(GoTalent.Mat.Guide) != gd1 + 1 || !NightEchoState.Done(nid)) Fail($"{nid}: 처치 보상·그날 끝 표시");
                }
                // 세이브 칸
                NightEchoState.ResetForTest();
                NightEchoState.MarkDone("road");
                string json = SaveState.ToJson();
                if (!json.Contains("\"nightDay\":\"" + GoNight.DayKey(GoNight.NowFn()) + "\"") || !json.Contains("\"nightDone\":[\"road\"]")) Fail("세이브에 밤의 잔불 칸이 없다");
                NightEchoState.Restore("x", new[] { "peak", "bogus" });
                var snap = NightEchoState.Snapshot();
                if (snap.Count != 0) Fail("다른 날 세이브는 버려야"); // 날짜 갈림으로 비워진다
                NightEchoState.Restore(GoNight.DayKey(GoNight.NowFn()), new[] { "peak", "bogus" });
                snap = NightEchoState.Snapshot();
                if (snap.Count != 1 || snap[0] != "peak") Fail("복원(없는 자리는 버림)");
            }
            finally
            {
                GoNight.NowFn = now0;
                nf.Tick(fc.SafePoint + Vector3.up * 500f);
                StoryState.OffForTest = off0;
                StoryState.Restore(ch0, st0);
                NightEchoState.Restore(day0, done0);
                GoldState.Restore(gold0);
                TalentState.Restore(tal0, mats0);
                fc.ResetForTest();
                pc.Teleport(fc.SafePoint);
                foreach (var e in FieldEnemy.All) e.RestoreHomeForTest();
            }
            if (_ok) Debug.Log($"[{tag}] night OK - 시각(21~4시 경계·새벽 4시 갈림)·열림(29장 뒤 밤만)·자리 일곱(잔당 셋·그 땅 안)·낮엔 없음·가까이 14m 잔당·60m 밖/낮 거둠·처치 금 800 교본 1·그날 한 번·다음 날 다시·세이브 칸(날짜·자리)");
            return _ok;
        }

        private static void Fail(string msg) { _ok = false; Debug.LogError("[PlaytestGoNight] FAIL - " + msg); }
    }
}
