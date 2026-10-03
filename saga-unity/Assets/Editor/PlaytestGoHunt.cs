using System.Collections.Generic;
using System.Linq;
using System.Text.RegularExpressions;
using UnityEditor;
using UnityEngine;
using Saga.Go.Combat;
using Saga.Go.Data;
using Saga.Go.UI;

namespace Saga.EditorTools
{
    /// <summary>
    /// tasks U-0031 사냥 기록 진단. 두 길 —
    /// ① <see cref="RunBatch"/>(`-executeMethod …PlaytestGoHunt.RunBatch`, 장면 없이): 표(종 11·우두머리 둘은 1·3·10, 나머지 10·40·120, 보상 여섯 단계) ·
    ///    Record(모르는 값 무시·그 종만 오름) · 단계 경계 · Claim(받은 단계만큼 한 번씩·금/쪽지/교본/매듭/강화석/연마석 실제 지급) · ClaimAll·FoundCount ·
    ///    알림(첫 확인은 조용·새 단계만) · 세이브 왕복(모르는 종 버림·받은 단계 누름·옛 세이브 0) · 업적 셈과 안 섞임.
    /// ② <see cref="Run"/>(`PlaytestHeadless` 가 업적 진단 뒤에 부른다, 장면 안): 실제 들판 처치가 그 종만 올림 · 화면(단추 ●N·줄 11·처음 잡기 전 "???"·받기 단추) ·
    ///    세이브 파일에 필드가 들어가고(버전 그대로) 옛 세이브(필드 없음)는 0 으로 읽힘. 끝나면 사냥 기록·돈·재료·강화석·연마석·세이브 파일을 되돌린다.
    /// </summary>
    public static class PlaytestGoHunt
    {
        private static string _tag;
        private static bool _ok;

        [MenuItem("Saga/Playtest Go Hunt")]
        public static void RunBatch()
        {
            PlaytestKit.Begin("[PlaytestGoHunt]");
            using (PlaytestKit.ErrorCounter())
            {
                HuntState.ResetForTest();
                try
                {
                    CheckTables();
                    CheckRecordAndTiers();
                    CheckClaim();
                    CheckNotice();
                    CheckSnapshot();
                    CheckIndependent();
                }
                finally { HuntState.ResetForTest(); }
            }
            PlaytestKit.Summary("PlaytestGoHunt");
            if (Application.isBatchMode) EditorApplication.Exit(PlaytestKit.Fails == 0 ? 0 : 1);
        }

        // ---- 규칙 층 ----

        private static void CheckTables()
        {
            var sp = GoHunt.Species;
            PlaytestKit.Check(sp.Length == 11 && sp.Distinct().Count() == 11, $"종 {sp.Length} ≠ 11(서로 다름)");
            PlaytestKit.Check(sp.Length >= 2 && GoHunt.IsBoss(sp[sp.Length - 1]) && GoHunt.IsBoss(sp[sp.Length - 2]) && !GoHunt.IsBoss(sp[0]), "우두머리가 맨 뒤 둘이 아님");
            PlaytestKit.Check(sp.Count(GoHunt.IsBoss) == 2 && GoHunt.IsBoss(FieldEnemy.Kind.Guardian) && GoHunt.IsBoss(FieldEnemy.Kind.Hero), "우두머리는 수호장·영웅 둘");
            PlaytestKit.Check(GoHunt.Tiers.SequenceEqual(new[] { 10, 40, 120 }) && GoHunt.BossTiers.SequenceEqual(new[] { 1, 3, 10 }), "단계 표가 고돗(10·40·120 / 1·3·10)과 다름");
            PlaytestKit.Check(GoHunt.Rewards.Length == 3 && GoHunt.BossRewards.Length == 3, "보상이 세 단계가 아님");
            foreach (var rw in new[] { GoHunt.Rewards, GoHunt.BossRewards })
                for (int i = 1; i < rw.Length; i++) PlaytestKit.Check(rw[i].Gold > rw[i - 1].Gold, "보상 금이 단계마다 늘지 않음");
            // 고돗 수치 그대로
            PlaytestKit.Check(GoHunt.Rewards[0].Gold == 1000 && GoHunt.Rewards[1].Gold == 2000 && GoHunt.Rewards[2].Gold == 3500 && GoHunt.Rewards[1].Ore == 2 && GoHunt.Rewards[2].Polish == 1, "일반 보상 수치");
            PlaytestKit.Check(GoHunt.BossRewards[0].Gold == 2500 && GoHunt.BossRewards[1].Gold == 5000 && GoHunt.BossRewards[2].Gold == 8000 && GoHunt.BossRewards[2].Mats[(int)GoTalent.Mat.Knot] == 1, "우두머리 보상 수치");
            foreach (var k in sp)
            {
                string name = FieldEnemy.KindName(k);
                PlaytestKit.Check(!string.IsNullOrEmpty(name), $"{k} 이름 없음");
                foreach (var r in GoHunt.RewardsOf(k)) PlaytestKit.Check(GoHunt.RewardText(r).Length > 0 && !GoHunt.RewardText(r).Contains("hunt.r_"), $"{k} 보상 글");
            }
        }

        private static void CheckRecordAndTiers()
        {
            HuntState.ResetForTest();
            for (int i = 0; i < 9; i++) HuntState.Record(FieldEnemy.Kind.Bandit);
            PlaytestKit.Check(HuntState.Kills(FieldEnemy.Kind.Bandit) == 9 && HuntState.TierReached(FieldEnemy.Kind.Bandit) == 0 && HuntState.Claimable(FieldEnemy.Kind.Bandit) == 0, "9마리는 아직 0단");
            HuntState.Record(FieldEnemy.Kind.Bandit);
            PlaytestKit.Check(HuntState.TierReached(FieldEnemy.Kind.Bandit) == 1 && HuntState.Claimable(FieldEnemy.Kind.Bandit) == 1, "10마리 = 1단");
            PlaytestKit.Check(HuntState.Kills(FieldEnemy.Kind.Skeleton) == 0 && HuntState.FoundCount() == 1, "다른 종이 같이 올랐다");
            PlaytestKit.Check(HuntState.Record((FieldEnemy.Kind)99) == 0 && HuntState.FoundCount() == 1, "모르는 값이 기록됨");
            for (int i = 0; i < 30; i++) HuntState.Record(FieldEnemy.Kind.Bandit);
            PlaytestKit.Check(HuntState.TierReached(FieldEnemy.Kind.Bandit) == 2, "40마리 = 2단");
            for (int i = 0; i < 80; i++) HuntState.Record(FieldEnemy.Kind.Bandit);
            PlaytestKit.Check(HuntState.Kills(FieldEnemy.Kind.Bandit) == 120 && HuntState.TierReached(FieldEnemy.Kind.Bandit) == 3, "120마리 = 3단");
            for (int i = 0; i < 20; i++) HuntState.Record(FieldEnemy.Kind.Bandit);
            PlaytestKit.Check(HuntState.TierReached(FieldEnemy.Kind.Bandit) == 3, "단계는 3 을 넘지 않음");
            // 우두머리 1·3·10
            var g = FieldEnemy.Kind.Guardian;
            HuntState.Record(g); PlaytestKit.Check(HuntState.TierReached(g) == 1, "우두머리 1마리 = 1단");
            HuntState.Record(g); PlaytestKit.Check(HuntState.TierReached(g) == 1, "우두머리 2마리 = 1단");
            HuntState.Record(g); PlaytestKit.Check(HuntState.TierReached(g) == 2, "우두머리 3마리 = 2단");
            for (int i = 0; i < 7; i++) HuntState.Record(g);
            PlaytestKit.Check(HuntState.TierReached(g) == 3, "우두머리 10마리 = 3단");
        }

        private static int MatOf(int[] bag, GoTalent.Mat m) => bag[(int)m];

        private static void CheckClaim()
        {
            HuntState.ResetForTest();
            var b = FieldEnemy.Kind.Bandit;
            for (int i = 0; i < 40; i++) HuntState.Record(b);
            int gold0 = GoldState.Gold, ore0 = WeaponState.Ore, pol0 = ArtifactState.Polish;
            var mats0 = TalentState.SnapshotMats();
            string t = HuntState.Claim(b);
            var mats1 = TalentState.SnapshotMats();
            PlaytestKit.Check(t.Length > 0 && GoldState.Gold - gold0 == 3000 && WeaponState.Ore - ore0 == 2 && ArtifactState.Polish == pol0
                && MatOf(mats1, GoTalent.Mat.Note) - MatOf(mats0, GoTalent.Mat.Note) == 3, $"40마리 받기: 금 +{GoldState.Gold - gold0}(3000)·강화석 +{WeaponState.Ore - ore0}(2)·쪽지 +{MatOf(mats1, GoTalent.Mat.Note) - MatOf(mats0, GoTalent.Mat.Note)}(3)");
            PlaytestKit.Check(HuntState.ClaimedTiers(b) == 2 && HuntState.Claimable(b) == 0, "받은 단계가 2 가 아님");
            int gold1 = GoldState.Gold;
            PlaytestKit.Check(HuntState.Claim(b) == "" && GoldState.Gold == gold1, "두 번째 받기가 또 줌");
            for (int i = 0; i < 80; i++) HuntState.Record(b);
            var mats2 = TalentState.SnapshotMats(); int pol1 = ArtifactState.Polish;
            HuntState.Claim(b);
            var mats3 = TalentState.SnapshotMats();
            PlaytestKit.Check(GoldState.Gold - gold1 == 3500 && ArtifactState.Polish - pol1 == 1 && MatOf(mats3, GoTalent.Mat.Guide) - MatOf(mats2, GoTalent.Mat.Guide) == 1, "120마리 셋째 단 받기(금 3500·연마석 1·교본 1)");
            // 우두머리 한꺼번에 3단 — 금 2500+5000+8000, 쪽지 2, 교본 1+2, 매듭 1, 연마석 1
            var g = FieldEnemy.Kind.Guardian;
            for (int i = 0; i < 10; i++) HuntState.Record(g);
            int gold2 = GoldState.Gold, pol2 = ArtifactState.Polish; var m4 = TalentState.SnapshotMats();
            HuntState.Claim(g);
            var m5 = TalentState.SnapshotMats();
            PlaytestKit.Check(GoldState.Gold - gold2 == 15500 && ArtifactState.Polish - pol2 == 1
                && MatOf(m5, GoTalent.Mat.Note) - MatOf(m4, GoTalent.Mat.Note) == 2 && MatOf(m5, GoTalent.Mat.Guide) - MatOf(m4, GoTalent.Mat.Guide) == 3 && MatOf(m5, GoTalent.Mat.Knot) - MatOf(m4, GoTalent.Mat.Knot) == 1, "우두머리 10마리 한꺼번에 받기");
            // 모두 받기
            HuntState.ResetForTest();
            for (int i = 0; i < 10; i++) HuntState.Record(FieldEnemy.Kind.Skeleton);
            for (int i = 0; i < 3; i++) HuntState.Record(FieldEnemy.Kind.Hero);
            PlaytestKit.Check(HuntState.ClaimableTotal() == 3 && HuntState.FoundCount() == 2, $"받을 것 {HuntState.ClaimableTotal()}(3)·만난 종 {HuntState.FoundCount()}(2)");
            PlaytestKit.Check(HuntState.ClaimAll() == 3 && HuntState.ClaimableTotal() == 0 && HuntState.TiersDone() == 3, "모두 받기");
        }

        private static void CheckNotice()
        {
            HuntState.ResetForTest();
            PlaytestKit.Check(HuntState.Check().Count == 0, "첫 확인이 조용하지 않음");
            for (int i = 0; i < 10; i++) HuntState.Record(FieldEnemy.Kind.IceFox);
            var n = HuntState.Check();
            PlaytestKit.Check(n.Count == 1 && n[0].k == FieldEnemy.Kind.IceFox && n[0].tier == 1, "새 단계 알림");
            PlaytestKit.Check(HuntState.Check().Count == 0, "같은 단계를 또 알림");
            // 불러온 직후 첫 확인은 기준만 잡는다
            HuntState.Restore(HuntState.SnapshotKills(), HuntState.SnapshotClaimed());
            PlaytestKit.Check(HuntState.Check().Count == 0, "불러온 직후 알림");
        }

        private static void CheckSnapshot()
        {
            HuntState.ResetForTest();
            for (int i = 0; i < 12; i++) HuntState.Record(FieldEnemy.Kind.WindHawk);
            HuntState.Record(FieldEnemy.Kind.Hero);
            HuntState.Claim(FieldEnemy.Kind.WindHawk);
            var k = HuntState.SnapshotKills(); var c = HuntState.SnapshotClaimed();
            HuntState.ResetForTest();
            PlaytestKit.Check(HuntState.Kills(FieldEnemy.Kind.WindHawk) == 0 && HuntState.FoundCount() == 0, "진단 준비: 초기화");
            HuntState.Restore(k, c);
            PlaytestKit.Check(HuntState.Kills(FieldEnemy.Kind.WindHawk) == 12 && HuntState.Kills(FieldEnemy.Kind.Hero) == 1 && HuntState.ClaimedTiers(FieldEnemy.Kind.WindHawk) == 1, "왕복");
            HuntState.Restore(
                new List<CookState.Entry> { new CookState.Entry { id = "Bandit", n = 5 }, new CookState.Entry { id = "Dragon", n = 9 }, new CookState.Entry { id = "Skeleton", n = 0 } },
                new List<CookState.Entry> { new CookState.Entry { id = "Bandit", n = 99 }, new CookState.Entry { id = "Dragon", n = 2 } });
            PlaytestKit.Check(HuntState.Kills(FieldEnemy.Kind.Bandit) == 5 && HuntState.FoundCount() == 1, "모르는 종·0 마리를 버리지 않음");
            PlaytestKit.Check(HuntState.ClaimedTiers(FieldEnemy.Kind.Bandit) == 3, "받은 단계가 단계 수 안으로 눌리지 않음");
            HuntState.Restore(null, null);
            PlaytestKit.Check(HuntState.FoundCount() == 0 && HuntState.TiersDone() == 0, "옛 세이브(null)는 0 이어야 함");
        }

        private static void CheckIndependent()
        {
            AchieveState.ResetForTest();
            HuntState.ResetForTest();
            for (int i = 0; i < 5; i++) HuntState.Record(FieldEnemy.Kind.RockBear);
            PlaytestKit.Check(AchieveState.Stat("kills") == 0, "사냥 기록이 업적 처치 셈을 건드림");
            AchieveState.Bump("kills", 7);
            PlaytestKit.Check(HuntState.Kills(FieldEnemy.Kind.RockBear) == 5 && HuntState.FoundCount() == 1, "업적 셈이 사냥 기록을 건드림");
            AchieveState.ResetForTest();
        }

        // ---- 장면 층(PlaytestHeadless 안) ----

        public static bool Run(string tag)
        {
            _tag = tag; _ok = true;
            var fc = FieldCombat.Instance;
            var ui = HuntLogUi.Instance;
            if (fc == null || ui == null) { Fail("FieldCombat/HuntLogUi 없음"); return false; }

            var hk = HuntState.SnapshotKills(); var hc = HuntState.SnapshotClaimed();
            int gold = GoldState.Gold, ore = WeaponState.Ore, polish = ArtifactState.Polish;
            var mats = TalentState.SnapshotMats();
            var talent = TalentState.Snapshot();
            var arts = ArtifactState.Snapshot(); int seq = ArtifactState.Seq;
            var ach = (AchieveState.SnapshotStats(), AchieveState.SnapshotKinds(), AchieveState.SnapshotGot());
            string savePath = System.IO.Path.Combine(Application.persistentDataPath, "save.json");
            string originalSave = System.IO.File.Exists(savePath) ? System.IO.File.ReadAllText(savePath) : null;
            var parts = new List<string>();
            try
            {
                HuntState.ResetForTest();
                CheckRealKill(parts);
                CheckUi(ui, parts);
                CheckFile(savePath, parts);
            }
            finally
            {
                ui.Close();
                if (originalSave != null) System.IO.File.WriteAllText(savePath, originalSave);
                else if (System.IO.File.Exists(savePath)) System.IO.File.Delete(savePath);
                HuntState.Restore(hk, hc);
                AchieveState.Restore(ach.Item1, ach.Item2, ach.Item3);
                GoldState.Restore(gold);
                WeaponState.Restore(WeaponState.SnapshotInv(), WeaponState.SnapshotEquip(), ore);
                TalentState.Restore(talent, mats);
                ArtifactState.Restore(arts, seq, polish);
                fc.ResetForTest();
                foreach (var e in FieldEnemy.All) e.RestoreHomeForTest();
            }
            if (_ok) Debug.Log($"[{_tag}] hunt OK - {string.Join(" · ", parts)}");
            return _ok;
        }

        private static void CheckRealKill(List<string> parts)
        {
            FieldEnemy e = null;
            foreach (var x in FieldEnemy.All) if (x.Alive && !x.IsGuardian && !x.IsHero) { e = x; break; }
            if (e == null) { Fail("들판 적이 없음"); return; }
            var k = e.EnemyKind;
            if (e.Shielded) e.SetShieldForTest(0f);
            e.TakeRaw(e.Hp + 999f, Color.white);
            if (HuntState.Kills(k) != 1 || HuntState.FoundCount() != 1) Fail($"들판 처치가 그 종({k})만 안 셈: {HuntState.Kills(k)}·만난 종 {HuntState.FoundCount()}");
            e.ReviveNow();
            parts.Add($"실제 들판 처치({k})가 그 종만 올림");
        }

        private static void CheckUi(HuntLogUi ui, List<string> parts)
        {
            var sp = GoHunt.Species;
            var seen = sp.First(k => HuntState.Kills(k) > 0);
            var unseen = sp.First(k => HuntState.Kills(k) == 0);
            ui.Refresh();
            if (ui.OpenLabel.Contains("●")) Fail($"받을 게 없는데 단추에 ●: {ui.OpenLabel}");
            ui.Open();
            if (!ui.IsOpen) Fail("Open 이 안 열림");
            if (ui.RowCount != sp.Length) Fail($"줄 {ui.RowCount} ≠ 종 {sp.Length}");
            int iSeen = System.Array.IndexOf(sp, seen), iUnseen = System.Array.IndexOf(sp, unseen);
            if (!ui.RowText(iSeen).Contains(FieldEnemy.KindName(seen))) Fail($"만난 종 줄에 이름이 없음: {ui.RowText(iSeen)}");
            if (ui.RowText(iUnseen).Contains(FieldEnemy.KindName(unseen)) || !ui.RowText(iUnseen).Contains("???")) Fail($"처음 잡기 전 줄이 ??? 가 아님: {ui.RowText(iUnseen)}");
            if (ui.ClaimButton(iSeen).interactable) Fail("받을 게 없는데 받기 단추가 켜짐");
            for (int i = 0; i < 9; i++) HuntState.Record(seen);   // 1 + 9 = 10마리 → 1단
            ui.Refresh();
            if (!ui.OpenLabel.Contains("●1")) Fail($"단추에 ●1 이 없음: {ui.OpenLabel}");
            if (!ui.ClaimButton(iSeen).interactable) Fail("받을 게 있는데 받기 단추가 꺼짐");
            if (!ui.AllButton.interactable) Fail("받을 게 있는데 모두 받기가 꺼짐");
            int g0 = GoldState.Gold;
            ui.ClaimButton(iSeen).onClick.Invoke();
            if (GoldState.Gold - g0 != 1000) Fail($"받기 단추로 금 +{GoldState.Gold - g0}(1000)");
            if (ui.OpenLabel.Contains("●") || ui.ClaimButton(iSeen).interactable) Fail("받은 뒤에도 ● / 받기가 남음");
            if (!ui.TitleText.Contains("1/" + sp.Length)) Fail($"제목에 만난 종 수가 없음: {ui.TitleText}");
            ui.Close();
            parts.Add("화면(단추 ●N·줄 11·처음 잡기 전 ???·받기 단추·제목)");
        }

        private static void CheckFile(string savePath, List<string> parts)
        {
            HuntState.ResetForTest();
            for (int i = 0; i < 42; i++) HuntState.Record(FieldEnemy.Kind.Bandit);
            HuntState.Claim(FieldEnemy.Kind.Bandit);
            if (!SaveState.Save()) { Fail("SaveState.Save 실패"); return; }
            string json = System.IO.File.ReadAllText(savePath);
            if (!json.Contains("\"huntKills\":[") || !json.Contains("\"huntClaimed\":[") || !json.Contains("\"version\":29")) Fail("세이브에 사냥 기록이 없다(버전은 그대로여야 함)");
            HuntState.ResetForTest();
            if (!SaveState.TryLoad() || HuntState.Kills(FieldEnemy.Kind.Bandit) != 42 || HuntState.ClaimedTiers(FieldEnemy.Kind.Bandit) != 2) Fail("세이브 왕복");
            string old = Regex.Replace(json, ",\"huntKills\":\\[[^\\]]*\\],\"huntClaimed\":\\[[^\\]]*\\]", "");
            if (old.Contains("huntKills")) { Fail("옛 세이브 가짜 파일 만들기 실패"); return; }
            System.IO.File.WriteAllText(savePath, old);
            if (!SaveState.TryLoad()) { Fail("사냥 기록 없는 옛 파일 TryLoad 실패"); return; }
            if (HuntState.FoundCount() != 0 || HuntState.TiersDone() != 0) Fail("사냥 기록 없는 옛 세이브를 읽었는데 0 이 아님");
            parts.Add("세이브(처치·받은 단계 왕복 · 옛 세이브는 0 · 버전 그대로)");
        }

        private static void Fail(string msg)
        {
            _ok = false;
            Debug.LogError($"[{_tag}] hunt FAIL - {msg}");
        }
    }
}
