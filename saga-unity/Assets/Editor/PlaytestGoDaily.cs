using System.Collections.Generic;
using System.Reflection;
using System.Text.RegularExpressions;
using UnityEngine;
using Saga.Go.Combat;
using Saga.Go.Data;
using Saga.Go.World;

namespace Saga.EditorTools
{
    /// <summary>
    /// PLAN.md 109-14-8 "일일 의뢰"(웹 사가고 ⑲-8 진단 항목) — `PlaytestHeadless` 가 여정 진단 뒤에 부른다.
    /// 옛 진단들은 `DailyTaskState.OffForTest` 로 일과 진행을 무시한 채 돌고(날짜마다 다른 일과 보상이 금·강화석 값에 끼지 않게), 여기서만 켠다.
    /// 날 갈림 새벽 4시 · 하루 넷 = 갈래마다 하나(날짜 60 개 — 늘 넷·갈래 겹침 없음·같은 날 같은 넷·여덟 종류 모두 나옴) ·
    /// 일과 보상(목표 직전엔 없음·채우면 금·경험·강화석/쪽지·알림) · 실제 부르는 자리 넷(들판 적 쓰러짐·원소 반응·채집·요리) ·
    /// 넷 다 → 도장 · 마무리 보상(역참 밖 거절·안 한 번·두 번 거절·목표판 줄) · 세이브 v25 왕복·v24 로드.
    /// 오늘 일과는 리플렉션으로 정한다(실제 날짜가 무엇이든 같게). 끝나면 일과·돈·강화석·재료·요리·레벨·세이브 파일·스위치를 되돌린다.
    /// </summary>
    public static class PlaytestGoDaily
    {
        private static string _tag;
        private static bool _ok;
        private static readonly System.Type T = typeof(DailyTaskState);
        private const BindingFlags S = BindingFlags.NonPublic | BindingFlags.Static;

        public static bool Run(string tag)
        {
            _tag = tag;
            _ok = true;
            var fc = FieldCombat.Instance;
            var wm = WorldMapBuilder.Instance;
            if (fc == null || wm == null || wm.Stones.Count == 0) { Fail("FieldCombat/WorldMapBuilder 돌기둥 없음"); return false; }

            string d0 = DailyTaskState.CurrentDate;
            var p0 = DailyTaskState.SnapshotProgress();
            var dn0 = DailyTaskState.SnapshotDone();
            bool sg0 = DailyTaskState.SnapshotDayStampGranted(), b0 = DailyTaskState.BonusClaimed;
            int st0 = DailyTaskState.Stamps;
            int gold0 = GoldState.Gold, lv0 = PlayerStats.Level, exp0 = PlayerStats.Exp;
            var inv0 = WeaponState.SnapshotInv();
            var eq0 = WeaponState.SnapshotEquip();
            int ore0 = WeaponState.Ore;
            var tal0 = TalentState.Snapshot();
            var mat0 = TalentState.SnapshotMats();
            var bag0 = CookState.SnapshotBag();
            var prof0 = CookState.SnapshotProf();
            var gat0 = CookState.SnapshotGather();
            string savePath = System.IO.Path.Combine(Application.persistentDataPath, "save.json");
            string originalSave = System.IO.File.Exists(savePath) ? System.IO.File.ReadAllText(savePath) : null;
            string got = "";
            try
            {
                CheckPick();
                DailyTaskState.OffForTest = false;
                CheckRewards();
                got = CheckCallSites(fc);
                CheckBonus(wm);
                CheckSave(savePath);
            }
            finally
            {
                if (originalSave != null) System.IO.File.WriteAllText(savePath, originalSave);
                else if (System.IO.File.Exists(savePath)) System.IO.File.Delete(savePath);
                DailyTaskState.OffForTest = true;
                DailyTaskState.Restore(d0, p0, dn0, sg0, st0, b0);
                GoldState.Restore(gold0);
                PlayerStats.Restore(lv0, exp0);
                WeaponState.Restore(inv0, eq0, ore0);
                TalentState.Restore(tal0, mat0);
                CookState.ClearSession();
                CookState.Restore(bag0, prof0, gat0);
                CookState.NowForTest = -1;
                fc.ResetForTest();
                foreach (var e in FieldEnemy.All) e.RestoreHomeForTest();
            }
            if (_ok) Debug.Log($"[{_tag}] daily OK - 새벽 4시 · 하루 넷 = 갈래마다 하나(60 날·여덟 종류) · 일과 보상 · 부르는 자리 {got} · 도장 · 마무리 보상(역참·한 번) · 목표판 줄 · 세이브 v25 왕복·v24 로드");
            return _ok;
        }

        /// <summary>오늘 일과를 풀 번호로 정한다(진행·완료·도장 받음·마무리 비움).</summary>
        private static void SetToday(params int[] pool)
        {
            T.GetField("_date", S).SetValue(null, DailyTaskState.DayKey(System.DateTime.Now));
            T.GetField("_selected", S).SetValue(null, pool);
            T.GetField("_progress", S).SetValue(null, new int[pool.Length]);
            T.GetField("_done", S).SetValue(null, new bool[pool.Length]);
            T.GetField("_dayStampGranted", S).SetValue(null, false);
            T.GetField("_bonusClaimed", S).SetValue(null, false);
        }

        private static int GroupOf(DailyTaskState.Kind k) => k switch
        {
            DailyTaskState.Kind.Walk or DailyTaskState.Kind.CairnWish => 0,
            DailyTaskState.Kind.BanditWin or DailyTaskState.Kind.WolfWin => 1,
            DailyTaskState.Kind.FieldKill or DailyTaskState.Kind.Reaction => 2,
            _ => 3,
        };

        private static void CheckPick()
        {
            if (DailyTaskState.DayKey(new System.DateTime(2026, 9, 28, 3, 59, 0)) != "2026-09-27" || DailyTaskState.DayKey(new System.DateTime(2026, 9, 28, 4, 0, 0)) != "2026-09-28") Fail("새벽 4시 날 갈림");
            var select = T.GetMethod("SelectForDate", S);
            var seen = new HashSet<DailyTaskState.Kind>();
            var start = new System.DateTime(2026, 9, 1);
            for (int d = 0; d < 60; d++)
            {
                string key = start.AddDays(d).ToString("yyyy-MM-dd");
                select.Invoke(null, new object[] { key });
                if (DailyTaskState.TaskCount != 4) { Fail($"{key} 일과 {DailyTaskState.TaskCount} ≠ 4"); return; }
                var groups = new bool[4];
                var first = new List<DailyTaskState.Kind>();
                for (int i = 0; i < 4; i++)
                {
                    var k = DailyTaskState.TaskKind(i);
                    first.Add(k);
                    seen.Add(k);
                    if (groups[GroupOf(k)]) Fail($"{key} 갈래 겹침 {k}");
                    groups[GroupOf(k)] = true;
                }
                select.Invoke(null, new object[] { key });
                for (int i = 0; i < 4; i++) if (DailyTaskState.TaskKind(i) != first[i]) { Fail($"{key} 같은 날 다른 일과"); break; }
            }
            if (seen.Count != 8) Fail($"60 날에 나온 종류 {seen.Count} ≠ 8");
        }

        private static void CheckRewards()
        {
            SetToday(0, 1, 4, 6); // 걷기·도적·들판 적·채집
            GoldState.Restore(0);
            WeaponState.Restore(null, null, 0);
            string toast = null;
            void OnDone(string s) => toast = s;
            DailyTaskState.TaskCompleted += OnDone;
            DailyTaskState.ReportProgress(DailyTaskState.Kind.FieldKill, 7);
            if (GoldState.Gold != 0 || DailyTaskState.TaskDone(2) || toast != null) Fail("목표 직전에 보상");
            DailyTaskState.ReportProgress(DailyTaskState.Kind.FieldKill, 1);
            if (!DailyTaskState.TaskDone(2) || GoldState.Gold != 50 || WeaponState.Ore != 1 || toast == null || !toast.Contains("50")) Fail($"들판 적 8 보상 금 {GoldState.Gold}·강화석 {WeaponState.Ore}·알림 '{toast}'");
            DailyTaskState.ReportProgress(DailyTaskState.Kind.FieldKill, 5);
            if (GoldState.Gold != 50) Fail("끝난 일과가 또 보상");
            DailyTaskState.ReportProgress(DailyTaskState.Kind.Reaction, 6);
            if (GoldState.Gold != 50) Fail("오늘 없는 일과가 보상");
            SetToday(0, 1, 5, 7);
            int notes = TalentState.Count(GoTalent.Mat.Note);
            DailyTaskState.ReportProgress(DailyTaskState.Kind.Reaction, 6);
            if (GoldState.Gold != 95 || TalentState.Count(GoTalent.Mat.Note) != notes + 1) Fail("원소 반응 6 보상 금 45·쪽지 1");
            DailyTaskState.TaskCompleted -= OnDone;
        }

        private static string CheckCallSites(FieldCombat fc)
        {
            var parts = new List<string>();
            SetToday(3, 2, 4, 6); // 성황당·늑대·들판 적·채집
            FieldEnemy e = null;
            foreach (var x in FieldEnemy.All) if (x.Alive && !x.IsGuardian && !x.IsHero) { e = x; break; }
            if (e == null) { Fail("들판 적이 없음"); return ""; }
            if (e.Shielded) e.SetShieldForTest(0f);
            e.TakeRaw(e.Hp + 999f, Color.white);
            if (!DailyTaskState.TaskLine(2).Contains("1/8")) Fail($"들판 적 쓰러짐이 안 셈 '{DailyTaskState.TaskLine(2)}'"); else parts.Add("적");
            e.ReviveNow();
            CookState.NowForTest = 2_000_000;
            CookState.ResetForTest();
            CookState.Pick(GoCooking.Nodes[0]);
            if (!DailyTaskState.TaskLine(3).Contains("1/5")) Fail($"채집이 안 셈 '{DailyTaskState.TaskLine(3)}'"); else parts.Add("채집");
            SetToday(0, 1, 5, 7);
            e.ReviveNow();
            e.WarpForTest(fc.transform.position + new Vector3(40f, 0f, 40f));
            if (e.Shielded) e.SetShieldForTest(0f);
            e.TakeHit(1f, GoElement.Cryo, 10f, out _);
            e.TakeHit(1f, GoElement.Pyro, 10f, out _);
            if (!Regex.IsMatch(DailyTaskState.TaskLine(2), "[12]/6")) Fail($"원소 반응이 안 셈 '{DailyTaskState.TaskLine(2)}'"); else parts.Add("반응"); // 먼저 붙은 원소가 있으면 빙에서도 반응
            foreach (var (item, n) in GoCooking.Recipes[0].Ing) CookState.Add(item, n);
            CookState.Cook(0, 1, true);
            if (!DailyTaskState.TaskLine(3).Contains("1/2")) Fail($"요리가 안 셈 '{DailyTaskState.TaskLine(3)}'"); else parts.Add("요리");
            e.ReviveNow();
            return string.Join("·", parts);
        }

        private static void CheckBonus(WorldMapBuilder wm)
        {
            SetToday(0, 1, 4, 6);
            int stamps = DailyTaskState.Stamps;
            var stone = wm.Stones[0];
            Vector3 at = stone.transform.position;
            if (stone.TryDailyBonus(at)) Fail("넷을 안 했는데 마무리 보상");
            DailyTaskState.ReportProgress(DailyTaskState.Kind.Walk, 800);
            DailyTaskState.ReportProgress(DailyTaskState.Kind.BanditWin, 2);
            DailyTaskState.ReportProgress(DailyTaskState.Kind.FieldKill, 8);
            DailyTaskState.ReportProgress(DailyTaskState.Kind.Gather, 5);
            if (!DailyTaskState.AllDoneToday || DailyTaskState.Stamps != stamps + 1) Fail($"넷 다 했는데 도장 {DailyTaskState.Stamps - stamps}");
            if (DailyTaskState.SessionLineText() != GoLocalization.T("task.bonus_ready", "오늘 일과 끝 — 역참에 들르면 마무리 보상")) Fail($"목표판 줄 '{DailyTaskState.SessionLineText()}'");
            int gold = GoldState.Gold, ore = WeaponState.Ore, knot = TalentState.Count(GoTalent.Mat.Knot);
            if (stone.TryDailyBonus(at + new Vector3(20f, 0f, 0f))) Fail("역참 밖에서 마무리 보상");
            if (!stone.TryDailyBonus(at) || GoldState.Gold != gold + 150 || WeaponState.Ore != ore + 2 || TalentState.Count(GoTalent.Mat.Knot) != knot + 1 || !DailyTaskState.BonusClaimed)
                Fail($"마무리 보상 금 {GoldState.Gold - gold}·강화석 {WeaponState.Ore - ore}");
            if (stone.TryDailyBonus(at)) Fail("마무리 보상을 두 번");
            if (DailyTaskState.SessionLineText().Contains(GoLocalization.T("task.bonus_ready", "역참"))) Fail("받은 뒤에도 목표판이 역참 안내");
        }

        private static void CheckSave(string savePath)
        {
            if (!DailyTaskState.BonusClaimed) SetToday(0, 1, 4, 6);
            if (!SaveState.Save()) { Fail("SaveState.Save 실패"); return; }
            string json = System.IO.File.ReadAllText(savePath);
            if (!json.Contains("\"version\":28") || !json.Contains("\"dailyBonus\":true")) Fail("세이브 v25 에 마무리 보상이 없다");
            T.GetField("_bonusClaimed", S).SetValue(null, false);
            if (!SaveState.TryLoad() || !DailyTaskState.BonusClaimed) Fail("v25 왕복 뒤 마무리 보상이 달라짐");
            string v24 = Regex.Replace(json.Replace("\"version\":28", "\"version\":28"), ",\"dailyBonus\":(true|false)", "");
            if (v24.Contains("dailyBonus")) { Fail("v24 가짜 파일 만들기 실패"); return; }
            System.IO.File.WriteAllText(savePath, v24);
            if (!SaveState.TryLoad() || DailyTaskState.BonusClaimed) Fail("v24 파일 — 마무리 보상을 받은 걸로 읽음");
        }

        private static void Fail(string msg)
        {
            _ok = false;
            Debug.LogError($"[{_tag}] daily FAIL - {msg}");
        }
    }
}
