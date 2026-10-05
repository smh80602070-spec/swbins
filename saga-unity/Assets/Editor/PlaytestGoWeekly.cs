using System;
using System.Collections.Generic;
using System.Linq;
using System.Text.RegularExpressions;
using UnityEditor;
using UnityEngine;
using Saga.Go.Data;
using Saga.Go.UI;

namespace Saga.EditorTools
{
    /// <summary>
    /// tasks U-0044 주간 도전 진단. 두 길 —
    /// ① <see cref="RunBatch"/>(`-executeMethod …PlaytestGoWeekly.RunBatch`, 장면 없이): 표(풀 10·서로 다른 셈·같은 주 같은 다섯·주마다 달라짐·열 가지가 다 한 번은 뽑힘) ·
    ///    주 갈림(월요일 새벽 4시 전후) · 진척(주 시작 값 대비·줄면 시작 값을 낮춤) · 받기(이번 주 아님·못 채움·한 번만·지급 금/견문록) ·
    ///    완주(다섯 다 받아야·한 번만·지급 매듭/교본/연마석/경험치) · 알림(첫 확인 조용·새로 채운 것만) · 주가 바뀌면 받은 것 비움·시작 값 새로 ·
    ///    스냅샷 왕복(모르는 셈·도전 버림·옛 세이브(0)는 새 주).
    /// ② <see cref="Run"/>(`PlaytestHeadless` 가 도움말 진단 뒤에 부른다, 장면 안): 진짜 셈(Bump)으로 채워 창·단추 ●·받기 단추·금 지급 · 세이브 파일에
    ///    필드가 들어가고(버전 그대로) 옛 세이브(필드 없음)는 새 주로 읽힘. 끝나면 금·재료·연마석·경험치·업적 셈·세이브를 되돌린다.
    /// </summary>
    public static class PlaytestGoWeekly
    {
        private static string _tag;
        private static bool _ok;

        private static readonly DateTime Monday = new DateTime(2026, 10, 5, 5, 0, 0); // 월요일 새벽 5시(갈림 뒤)

        [MenuItem("Saga/Playtest Go Weekly")]
        public static void RunBatch()
        {
            PlaytestKit.Begin("[PlaytestGoWeekly]");
            int gold = GoldState.Gold; var mats = TalentState.SnapshotMats(); var talent = TalentState.Snapshot();
            var arts = ArtifactState.Snapshot(); int seq = ArtifactState.Seq, polish = ArtifactState.Polish;
            int lv = PlayerStats.Level, exp = PlayerStats.Exp;
            using (PlaytestKit.ErrorCounter())
            {
                WeeklyState.ResetForTest();
                try
                {
                    CheckTables();
                    CheckWeekBoundary();
                    CheckProgressAndClaim();
                    CheckBonus();
                    CheckNotice();
                    CheckWeekChange();
                    CheckSnapshot();
                }
                finally
                {
                    WeeklyState.ResetForTest();
                    GoldState.Restore(gold); TalentState.Restore(talent, mats); ArtifactState.Restore(arts, seq, polish); PlayerStats.Restore(lv, exp);
                }
            }
            PlaytestKit.Summary("PlaytestGoWeekly");
            if (Application.isBatchMode) EditorApplication.Exit(PlaytestKit.Fails == 0 ? 0 : 1);
        }

        // ---- 규칙 층 ----

        private static void CheckTables()
        {
            var pool = GoWeekly.Pool;
            PlaytestKit.Check(pool.Length == 10 && pool.Select(g => g.Id).Distinct().Count() == 10, $"풀 {pool.Length} ≠ 10(서로 다른 id)");
            PlaytestKit.Check(pool.Select(g => g.Stat).Distinct().Count() == pool.Length, "서로 다른 셈이 아님");
            PlaytestKit.Check(pool.All(g => g.Target > 0), "목표가 0 이하");
            // 고돗 수치 그대로(걷기·알 품기만 뺐다)
            PlaytestKit.Check(GoWeekly.Get("kills").Target == 30 && GoWeekly.Get("react").Target == 25 && GoWeekly.Get("gather").Target == 25 && GoWeekly.Get("chests").Target == 4, "목표 수치가 고돗과 다름");
            PlaytestKit.Check(GoWeekly.PerWeek == 5 && GoWeekly.RewardGold == 2500 && GoWeekly.RewardNote == 2 && GoWeekly.BonusKnot == 2 && GoWeekly.BonusGuide == 2 && GoWeekly.BonusPolish == 2 && GoWeekly.BonusExp == 100, "보상 수치가 고돗과 다름");
            var seen = new HashSet<string>(); bool varies = false; string[] prev = null;
            for (int w = 2900; w < 2960; w++)
            {
                var p = GoWeekly.Picks(w);
                PlaytestKit.Check(p.Length == 5 && p.Distinct().Count() == 5, $"주 {w} 뽑기가 다섯 서로 다른 것이 아님");
                PlaytestKit.Check(p.SequenceEqual(GoWeekly.Picks(w)), $"주 {w} 뽑기가 흔들림");
                if (prev != null && !p.SequenceEqual(prev)) varies = true;
                prev = p;
                foreach (var id in p) seen.Add(id);
            }
            PlaytestKit.Check(varies, "주가 바뀌어도 뽑기가 같음");
            PlaytestKit.Check(seen.Count == 10, $"60주 동안 뽑힌 도전 {seen.Count} ≠ 10");
        }

        private static void CheckWeekBoundary()
        {
            int w = GoWeekly.WeekOf(new DateTime(2026, 10, 5, 4, 0, 0)); // 월요일 새벽 4시 정각 = 새 주
            PlaytestKit.Check(GoWeekly.WeekOf(new DateTime(2026, 10, 5, 3, 59, 0)) == w - 1, "월요일 3:59 는 지난 주여야 함");
            PlaytestKit.Check(GoWeekly.WeekOf(new DateTime(2026, 10, 11, 23, 59, 0)) == w, "일요일 밤은 같은 주여야 함");
            PlaytestKit.Check(GoWeekly.WeekOf(new DateTime(2026, 10, 12, 3, 59, 0)) == w, "다음 월요일 3:59 는 아직 같은 주여야 함");
            PlaytestKit.Check(GoWeekly.WeekOf(new DateTime(2026, 10, 12, 4, 0, 0)) == w + 1, "다음 월요일 4:00 는 새 주여야 함");
            PlaytestKit.Check(GoWeekly.WeekOf(new DateTime(2026, 10, 7, 12, 0, 0)) == w, "주 중간이 같은 주가 아님");
        }

        private static Dictionary<string, int> NewStats() => GoWeekly.Pool.ToDictionary(g => g.Stat, g => 0);

        private static void Setup(Dictionary<string, int> stats, DateTime? now = null)
        {
            WeeklyState.ResetForTest();
            GoWeekly.ProviderOverride = s => stats.TryGetValue(s, out int v) ? v : 0;
            WeeklyState.NowForTest = now ?? Monday;
            WeeklyState.Ensure();
        }

        private static void CheckProgressAndClaim()
        {
            var stats = NewStats();
            Setup(stats);
            var picks = WeeklyState.Picks();
            string id0 = picks[0]; var g0 = GoWeekly.Get(id0);
            PlaytestKit.Check(WeeklyState.Progress(id0) == 0 && !WeeklyState.Done(id0), "처음 진척이 0 이 아님");
            stats[g0.Stat] += g0.Target - 1;
            PlaytestKit.Check(WeeklyState.Progress(id0) == g0.Target - 1 && !WeeklyState.Done(id0), "목표 −1 인데 채웠다고 나옴");
            PlaytestKit.Check(WeeklyState.Claim(id0) == "", "못 채웠는데 받아짐");
            string notPick = GoWeekly.Pool.First(g => !picks.Contains(g.Id)).Id;
            stats[GoWeekly.Get(notPick).Stat] += 999;
            PlaytestKit.Check(WeeklyState.Claim(notPick) == "", "이번 주 도전이 아닌데 받아짐");
            stats[g0.Stat] += 1;
            PlaytestKit.Check(WeeklyState.Done(id0) && WeeklyState.Claimable().Contains(id0), "목표를 채웠는데 받을 수 있다고 안 나옴");
            int gold = GoldState.Gold, note = TalentState.Count(GoTalent.Mat.Note);
            string t = WeeklyState.Claim(id0);
            PlaytestKit.Check(t.Length > 0 && GoldState.Gold == gold + GoWeekly.RewardGold && TalentState.Count(GoTalent.Mat.Note) == note + GoWeekly.RewardNote, $"받기 지급이 다름(금 {GoldState.Gold - gold} 견문록 {TalentState.Count(GoTalent.Mat.Note) - note})");
            PlaytestKit.Check(WeeklyState.Claimed(id0) && WeeklyState.Claim(id0) == "" && GoldState.Gold == gold + GoWeekly.RewardGold, "한 번만 받아져야 함");
            PlaytestKit.Check(!WeeklyState.Claimable().Contains(id0), "받은 것이 또 받을 것으로 나옴");
            // 값이 줄면(상자가 되살아나는 등) 시작 값을 낮춰 0 아래로 안 간다 — 시작 값이 10 인 주에서 셈이 3 으로 줄었다
            var dip = NewStats();
            var gd = GoWeekly.Pool[0]; dip[gd.Stat] = 10;
            Setup(dip);
            string idd = GoWeekly.Pool.Select(g => g.Id).FirstOrDefault(i => WeeklyState.Picks().Contains(i) && GoWeekly.Get(i).Stat == gd.Stat);
            if (idd == null) { dip = NewStats(); gd = GoWeekly.Get(WeeklyState.Picks()[1]); dip[gd.Stat] = 10; Setup(dip); idd = gd.Id; }
            dip[gd.Stat] = 3;
            PlaytestKit.Check(WeeklyState.Progress(idd) == 0, "값이 줄었는데 진척이 0 이 아님");
            dip[gd.Stat] = 5;
            PlaytestKit.Check(WeeklyState.Progress(idd) == 2, "낮춘 시작 값에서 다시 세지 않음");
            // 주 시작 값 대비 — 이미 쌓여 있던 값은 안 센다
            var pre = NewStats(); foreach (var g in GoWeekly.Pool) pre[g.Stat] = 500;
            Setup(pre);
            foreach (var id in WeeklyState.Picks()) PlaytestKit.Check(WeeklyState.Progress(id) == 0, "주 시작 전에 쌓은 값이 진척으로 셈");
        }

        private static void CheckBonus()
        {
            var stats = NewStats();
            Setup(stats);
            var picks = WeeklyState.Picks();
            PlaytestKit.Check(WeeklyState.ClaimBonus() == "" && !WeeklyState.BonusReady, "아무것도 안 받았는데 완주 보상이 나옴");
            for (int i = 0; i < picks.Length - 1; i++)
            {
                var g = GoWeekly.Get(picks[i]); stats[g.Stat] += g.Target;
                PlaytestKit.Check(WeeklyState.Claim(picks[i]).Length > 0, "받기 실패");
            }
            PlaytestKit.Check(WeeklyState.ClaimBonus() == "" && !WeeklyState.AllClaimed, "넷만 받았는데 완주 보상이 나옴");
            var last = GoWeekly.Get(picks[4]); stats[last.Stat] += last.Target;
            PlaytestKit.Check(WeeklyState.Claim(picks[4]).Length > 0 && WeeklyState.AllClaimed && WeeklyState.BonusReady, "다섯을 다 받았는데 완주 준비가 안 됨");
            int knot = TalentState.Count(GoTalent.Mat.Knot), guide = TalentState.Count(GoTalent.Mat.Guide), polish = ArtifactState.Polish;
            int lv = PlayerStats.Level, exp = PlayerStats.Exp;
            string t = WeeklyState.ClaimBonus();
            PlaytestKit.Check(t.Length > 0 && TalentState.Count(GoTalent.Mat.Knot) == knot + GoWeekly.BonusKnot && TalentState.Count(GoTalent.Mat.Guide) == guide + GoWeekly.BonusGuide && ArtifactState.Polish == polish + GoWeekly.BonusPolish, "완주 지급(매듭·교본·연마석)이 다름");
            PlaytestKit.Check(PlayerStats.Level > lv || PlayerStats.Exp != exp, "완주 경험치가 안 들어감");
            PlaytestKit.Check(WeeklyState.BonusClaimed && !WeeklyState.BonusReady && WeeklyState.ClaimBonus() == "", "완주 보상이 한 번만이 아님");
        }

        private static void CheckNotice()
        {
            var stats = NewStats();
            Setup(stats);
            var picks = WeeklyState.Picks();
            PlaytestKit.Check(WeeklyState.Check().Count == 0, "첫 확인이 조용하지 않음");
            var g = GoWeekly.Get(picks[2]); stats[g.Stat] += g.Target;
            var n = WeeklyState.Check();
            PlaytestKit.Check(n.Count == 1 && n[0] == picks[2], "새로 채운 도전만 알려야 함");
            PlaytestKit.Check(WeeklyState.Check().Count == 0, "같은 도전을 또 알림");
            // 불러온 직후(이미 채운 것이 있어도) 첫 확인은 조용
            var snapBase = WeeklyState.SnapshotBase(); var snapCl = WeeklyState.SnapshotClaimed();
            WeeklyState.Restore(WeeklyState.SnapshotWeek(), snapBase, snapCl, false);
            PlaytestKit.Check(WeeklyState.Check().Count == 0, "불러온 직후 첫 확인이 조용하지 않음");
        }

        private static void CheckWeekChange()
        {
            var stats = NewStats();
            Setup(stats);
            var picks = WeeklyState.Picks();
            var g = GoWeekly.Get(picks[0]); stats[g.Stat] += g.Target;
            WeeklyState.Claim(picks[0]);
            PlaytestKit.Check(WeeklyState.ClaimedCount() == 1, "준비: 하나 받음");
            int w0 = WeeklyState.Week;
            WeeklyState.NowForTest = Monday.AddDays(3); // 같은 주 목요일
            PlaytestKit.Check(WeeklyState.ClaimedCount() == 1 && WeeklyState.Week == w0, "같은 주인데 받은 것이 비워짐");
            foreach (var x in GoWeekly.Pool) stats[x.Stat] += 777;
            WeeklyState.NowForTest = Monday.AddDays(7); // 다음 월요일 새벽 5시
            PlaytestKit.Check(WeeklyState.Week == w0 + 1, "다음 주 번호가 +1 이 아님");
            PlaytestKit.Check(WeeklyState.ClaimedCount() == 0 && !WeeklyState.BonusClaimed, "새 주인데 받은 것·완주가 안 비워짐");
            foreach (var id in WeeklyState.Picks()) PlaytestKit.Check(WeeklyState.Progress(id) == 0, "새 주 시작 값이 지금 값이 아님(지난 주 값이 진척으로 셈)");
            PlaytestKit.Check(WeeklyState.Picks().SequenceEqual(GoWeekly.Picks(w0 + 1)), "새 주 뽑기가 표와 다름");
        }

        private static void CheckSnapshot()
        {
            var stats = NewStats();
            Setup(stats);
            var picks = WeeklyState.Picks();
            var g = GoWeekly.Get(picks[1]); stats[g.Stat] += g.Target + 4;
            WeeklyState.Claim(picks[1]);
            var w = WeeklyState.SnapshotWeek(); var b = WeeklyState.SnapshotBase(); var c = WeeklyState.SnapshotClaimed(); bool bonus = WeeklyState.SnapshotBonus();
            WeeklyState.ResetForTest();
            GoWeekly.ProviderOverride = s => stats.TryGetValue(s, out int v) ? v : 0; WeeklyState.NowForTest = Monday;
            WeeklyState.Restore(w, b, c, bonus);
            PlaytestKit.Check(WeeklyState.Claimed(picks[1]) && WeeklyState.ClaimedCount() == 1 && WeeklyState.Progress(picks[1]) == g.Target + 4, "스냅샷 왕복이 다름");
            // 모르는 셈·도전은 버린다
            WeeklyState.Restore(w,
                new List<CookState.Entry> { new CookState.Entry { id = "kills", n = 7 }, new CookState.Entry { id = "walk", n = 9 } },
                new List<CookState.Entry> { new CookState.Entry { id = picks[0], n = 1 }, new CookState.Entry { id = "hatch", n = 1 } }, true);
            PlaytestKit.Check(WeeklyState.Claimed(picks[0]) && !WeeklyState.Claimed("hatch") && WeeklyState.ClaimedCount() == 1, "모르는 도전이 안 버려짐");
            PlaytestKit.Check(WeeklyState.BonusClaimed, "완주 표시가 복원 안 됨");
            // 옛 세이브(주 번호 0·null) = 새 주
            WeeklyState.Restore(0, null, null, true);
            PlaytestKit.Check(WeeklyState.StoredWeek == -1 && !WeeklyState.BonusClaimed, "옛 세이브가 새 주로 안 읽힘");
            WeeklyState.Ensure();
            PlaytestKit.Check(WeeklyState.StoredWeek == WeeklyState.Week && WeeklyState.ClaimedCount() == 0, "옛 세이브 뒤 Ensure 가 새 주를 안 지음");
        }

        // ---- 장면 층 ----

        public static bool Run(string tag)
        {
            _tag = tag; _ok = true;
            var ui = WeeklyUi.Instance;
            if (ui == null) { Fail("WeeklyUi 없음(WorldMapBuilder 연결?)"); return false; }

            int gold = GoldState.Gold; var mats = TalentState.SnapshotMats(); var talent = TalentState.Snapshot();
            var arts = ArtifactState.Snapshot(); int seq = ArtifactState.Seq, polish = ArtifactState.Polish;
            var ach = (AchieveState.SnapshotStats(), AchieveState.SnapshotKinds(), AchieveState.SnapshotGot());
            var wk = (WeeklyState.SnapshotWeek(), WeeklyState.SnapshotBase(), WeeklyState.SnapshotClaimed(), WeeklyState.SnapshotBonus());
            string savePath = System.IO.Path.Combine(Application.persistentDataPath, "save.json");
            string originalSave = System.IO.File.Exists(savePath) ? System.IO.File.ReadAllText(savePath) : null;
            var parts = new List<string>();
            try
            {
                WeeklyState.ResetForTest();
                CheckUi(ui, parts);
                CheckFile(savePath, parts);
            }
            finally
            {
                ui.Close();
                if (originalSave != null) System.IO.File.WriteAllText(savePath, originalSave);
                else if (System.IO.File.Exists(savePath)) System.IO.File.Delete(savePath);
                WeeklyState.ResetForTest();
                WeeklyState.Restore(wk.Item1, wk.Item2, wk.Item3, wk.Item4);
                AchieveState.Restore(ach.Item1, ach.Item2, ach.Item3);
                GoldState.Restore(gold); TalentState.Restore(talent, mats); ArtifactState.Restore(arts, seq, polish);
            }
            if (_ok) Debug.Log($"[{_tag}] weekly OK - {string.Join(" · ", parts)}");
            return _ok;
        }

        /// <summary>진짜 셈(Bump)으로 채울 수 있는 도전이 든 주를 골라 그 주로 붙든다.</summary>
        private static string[] PinBumpableWeek()
        {
            string[] bump = { "kills", "elite", "boss", "domain", "react", "gather", "cook" };
            for (int d = 0; d < 7 * 40; d += 7)
            {
                var at = Monday.AddDays(d);
                var picks = GoWeekly.Picks(GoWeekly.WeekOf(at));
                if (picks.Any(id => bump.Contains(GoWeekly.Get(id).Stat))) { WeeklyState.NowForTest = at; WeeklyState.Ensure(); return picks; }
            }
            return null;
        }

        private static void CheckUi(WeeklyUi ui, List<string> parts)
        {
            if (ui.OpenButton == null || ui.CloseButton == null || ui.BonusButton == null) { Fail("단추 없음"); return; }
            var picks = PinBumpableWeek();
            if (picks == null) { Fail("40주 안에 Bump 로 채울 수 있는 도전이 든 주가 없음"); return; }
            ui.Refresh();
            ui.OpenButton.onClick.Invoke();
            if (!ui.IsOpen) Fail("단추로 안 열림");
            if (ui.RowCount != 5) Fail($"줄 {ui.RowCount} ≠ 5");
            for (int i = 0; i < 5; i++)
            {
                if (!ui.RowText(i).Contains(GoWeekly.Get(picks[i]).Name)) Fail($"줄 {i} 에 이름 없음");
                if (ui.ClaimButton(i).interactable) Fail($"줄 {i} 받기가 처음부터 켜져 있음");
            }
            int row = Array.FindIndex(picks, id => new[] { "kills", "elite", "boss", "domain", "react", "gather", "cook" }.Contains(GoWeekly.Get(id).Stat));
            var g = GoWeekly.Get(picks[row]);
            AchieveState.Bump(g.Stat, g.Target);
            ui.CheckNow(); ui.Refresh();
            if (!ui.ClaimButton(row).interactable) Fail("목표를 채웠는데 받기가 안 켜짐");
            if (!ui.OpenLabel.Contains("●")) Fail("받을 게 있는데 단추에 ● 가 없음");
            int gold = GoldState.Gold;
            ui.ClaimButton(row).onClick.Invoke();
            if (GoldState.Gold != gold + GoWeekly.RewardGold) Fail($"받기 단추로 금이 안 들어옴({GoldState.Gold - gold})");
            if (ui.ClaimButton(row).interactable) Fail("받은 뒤에도 받기가 켜져 있음");
            ui.CloseButton.onClick.Invoke();
            if (ui.IsOpen) Fail("닫는다로 안 닫힘");
            parts.Add($"창 열고 닫기·줄 5·진짜 셈({g.Stat})으로 채워 받기 단추 지급(금 +{GoWeekly.RewardGold})·단추 ●");
        }

        private static void CheckFile(string savePath, List<string> parts)
        {
            WeeklyState.NowForTest = null; WeeklyState.ResetForTest();
            WeeklyState.Ensure();
            if (!SaveState.Save()) { Fail("SaveState.Save 실패"); return; }
            string json = System.IO.File.ReadAllText(savePath);
            if (!json.Contains("\"wgWeek\":") || !json.Contains("\"wgBase\":[") || !json.Contains("\"wgClaimed\":[") || !json.Contains("\"version\":29")) Fail("세이브에 주간 도전이 없다(버전은 그대로여야 함)");
            int w = WeeklyState.StoredWeek;
            WeeklyState.ResetForTest();
            if (!SaveState.TryLoad() || WeeklyState.StoredWeek != w) Fail("세이브 왕복(주 번호)");
            string old = Regex.Replace(json, ",\"wgWeek\":-?\\d+,\"wgBase\":\\[[^\\]]*\\],\"wgClaimed\":\\[[^\\]]*\\],\"wgBonus\":(true|false)", "");
            if (old.Contains("wgWeek")) { Fail("옛 세이브 가짜 파일 만들기 실패"); return; }
            System.IO.File.WriteAllText(savePath, old);
            WeeklyState.ResetForTest();
            if (!SaveState.TryLoad()) { Fail("주간 도전 없는 옛 파일 TryLoad 실패"); return; }
            WeeklyState.Ensure();
            if (WeeklyState.ClaimedCount() != 0 || WeeklyState.StoredWeek != WeeklyState.Week) Fail("옛 세이브가 새 주로 안 읽힘");
            parts.Add("세이브(주·시작 값·받은 것 왕복 · 옛 세이브는 새 주 · 버전 그대로)");
        }

        private static void Fail(string msg)
        {
            _ok = false;
            Debug.LogError($"[{_tag}] weekly FAIL - {msg}");
        }
    }
}
