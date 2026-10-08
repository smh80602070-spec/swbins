using System.Collections.Generic;
using System.Linq;
using System.Text.RegularExpressions;
using UnityEngine;
using Saga.Go.Combat;
using Saga.Go.Data;
using Saga.Go.Player;
using Saga.Go.UI;

namespace Saga.EditorTools
{
    /// <summary>
    /// PLAN.md 109-14-25 "업적"(웹 사가만리 ⑲-25 진단 항목) — `PlaytestHeadless` 가 낚시 진단 뒤에 부른다.
    /// 표(스물둘·단계 예순셋·단계 오름차순·매듭 자리·표 값이 이 트랙 최대치 안·글) · 보상(금 300 / 금 600·쪽지 2 / 교본 2·강화석 3 · 어려운 셋 매듭) ·
    /// 신호(반응 수·가짓수·없음은 안 셈 · 실제 들판 처치·채집·요리) · 상태에서 읽는 값(구슬·여정 등급·이야기 장·세계 임무) · 받기·모두 받기 ·
    /// 알림(첫 확인은 조용·새 단계만·다시 안 울림) · 세이브 왕복(옛 세이브는 0) · 화면(단추 ●N·탭 다섯·줄·받기·모두 받기).
    /// 끝나면 업적·돈·재료·강화석·구슬·이야기·레벨·세이브 파일·시각을 되돌린다.
    /// </summary>
    public static class PlaytestGoAchieve
    {
        private static string _tag;
        private static bool _ok;

        public static bool Run(string tag)
        {
            _tag = tag;
            _ok = true;
            var fc = FieldCombat.Instance;
            var pc = fc != null ? fc.GetComponent<PlayerController>() : null;
            var ui = AchieveUi.Instance;
            if (fc == null || pc == null || ui == null) { Fail("FieldCombat/PlayerController/AchieveUi 없음"); return false; }

            var ach = (AchieveState.SnapshotStats(), AchieveState.SnapshotKinds(), AchieveState.SnapshotGot());
            var cookBag = CookState.SnapshotBag();
            var cookProf = CookState.SnapshotProf();
            var cookGather = CookState.SnapshotGather();
            var inv = WeaponState.SnapshotInv();
            var equip = WeaponState.SnapshotEquip();
            int ore = WeaponState.Ore;
            var talent = TalentState.Snapshot();
            var mats = TalentState.SnapshotMats();
            int gold = GoldState.Gold;
            int lv = PlayerStats.Level; long exp = PlayerStats.Exp;
            var orbs = OrbState.Snapshot();
            int given = OrbState.Given;
            int ch = StoryState.Ch, step = StoryState.StepIndex;
            bool storyOff = StoryState.OffForTest;
            long now0 = CookState.NowForTest;
            string savePath = System.IO.Path.Combine(Application.persistentDataPath, "save.json");
            string originalSave = System.IO.File.Exists(savePath) ? System.IO.File.ReadAllText(savePath) : null;
            var parts = new List<string>();
            try
            {
                CheckTables(parts);
                CheckReward(parts);
                CheckSignals(fc, parts);
                CheckValues(parts);
                CheckClaim(parts);
                CheckNotice(parts);
                CheckSave(savePath, parts);
                CheckUi(ui, parts);
            }
            finally
            {
                ui.Close();
                if (originalSave != null) System.IO.File.WriteAllText(savePath, originalSave);
                else if (System.IO.File.Exists(savePath)) System.IO.File.Delete(savePath);
                AchieveState.Restore(ach.Item1, ach.Item2, ach.Item3);
                CookState.NowForTest = now0;
                CookState.Restore(cookBag, cookProf, cookGather);
                WeaponState.Restore(inv, equip, ore);
                TalentState.Restore(talent, mats);
                GoldState.Restore(gold);
                PlayerStats.Restore(lv, exp);
                OrbState.Restore(orbs, given);
                StoryState.OffForTest = storyOff;
                StoryState.Restore(ch, step);
                fc.ResetForTest();
                pc.Teleport(fc.SafePoint);
                foreach (var e in FieldEnemy.All) e.RestoreHomeForTest();
            }
            if (_ok) Debug.Log($"[{_tag}] achieve OK - {string.Join(" · ", parts)}");
            return _ok;
        }

        private static GoAchieve.Entry Get(string id) => GoAchieve.All.First(a => a.Id == id);

        private static void CheckTables(List<string> parts)
        {
            if (GoAchieve.All.Length != 22 || GoAchieve.TotalTiers != 63) Fail($"업적 {GoAchieve.All.Length}·단계 {GoAchieve.TotalTiers} ≠ 22·63");
            if (GoAchieve.All.Select(a => a.Id).Distinct().Count() != 22) Fail("업적 id 겹침");
            foreach (var a in GoAchieve.All)
            {
                for (int i = 1; i < a.Tiers.Length; i++) if (a.Tiers[i] <= a.Tiers[i - 1]) Fail($"{a.Id} 단계가 오름차순이 아님");
                if (a.Hard >= a.Tiers.Length) Fail($"{a.Id} 매듭 자리가 단계 밖");
                if (a.Name.StartsWith("ach.name.") || a.Unit.StartsWith("ach.unit.")) Fail($"{a.Id} 글이 없음");
            }
            foreach (GoAchieve.Cat c in System.Enum.GetValues(typeof(GoAchieve.Cat)))
            {
                int n = GoAchieve.All.Count(a => a.Cat == c);
                if (n < 3 || n > AchieveUi.MaxRows) Fail($"{c} 갈래 줄 {n}");
                if (GoAchieve.CatName(c).StartsWith("ach.cat.")) Fail($"{c} 갈래 이름 글");
            }
            if (GoAchieve.All.Count(a => a.Hard >= 0) != 3) Fail("어려운 셋(매듭)이 아님");
            // 표 값이 이 트랙에서 닿을 수 있는 최대치 안
            if (Get("chest").Tiers.Last() > GoTreasure.Chests.Length) Fail($"상자 {GoTreasure.Chests.Length} 개인데 끝 단계 {Get("chest").Tiers.Last()}");
            if (Get("orb").Tiers.Last() > GoOrbs.All.Length) Fail($"구슬 {GoOrbs.All.Length} 개인데 끝 단계 {Get("orb").Tiers.Last()}");
            if (Get("peak").Tiers.Last() > GoWorldMap.Peaks.Length) Fail($"정상 {GoWorldMap.Peaks.Length} 개인데 끝 단계");
            if (Get("offer").Tiers.Last() > GoOrbs.MaxLevel) Fail("봉헌 등급 끝 단계가 최대 등급 밖");
            if (Get("mission").Tiers.Last() > GoRegionMission.Missions.Length) Fail($"사명 지역 {GoRegionMission.Missions.Length} 곳인데 끝 단계 {Get("mission").Tiers.Last()}");
            if (Get("kinds").Tiers.Last() > System.Enum.GetValues(typeof(GoReaction)).Length - 1) Fail("반응 가짓수 끝 단계가 반응 수 밖");
            if (Get("fishkinds").Tiers.Last() > GoFishing.Fishes.Length || Get("wq").Tiers.Last() > WorldQuestState.Count) Fail("물고기·세계 임무 끝 단계");
            parts.Add("표(스물둘·단계 63·오름차순·어려운 셋·글·이 트랙 최대치 안)");
        }

        private static void CheckReward(List<string> parts)
        {
            var a = Get("kill");
            var r0 = GoAchieve.RewardOf(a, 0);
            var r1 = GoAchieve.RewardOf(a, 1);
            var r2 = GoAchieve.RewardOf(a, 2);
            if (r0.Gold != 300 || r0.Ore != 0 || r0.Mats.Sum() != 0) Fail("첫 단 보상");
            if (r1.Gold != 600 || r1.Mats[(int)GoTalent.Mat.Note] != 2 || r1.Ore != 0) Fail("둘째 단 보상");
            if (r2.Gold != 0 || r2.Mats[(int)GoTalent.Mat.Guide] != 2 || r2.Ore != 3) Fail("셋째 단 보상");
            var ch = Get("chapter");
            if (GoAchieve.RewardOf(ch, 2).Mats[(int)GoTalent.Mat.Knot] != 1 || GoAchieve.RewardOf(ch, 1).Mats[(int)GoTalent.Mat.Knot] != 0) Fail("어려운 셋만 셋째 단에 매듭 하나");
            var mi = Get("mission");
            if (GoAchieve.RewardOf(mi, 1).Mats[(int)GoTalent.Mat.Knot] != 1 || GoAchieve.RewardOf(mi, 1).Gold != 600) Fail("지역 평정 둘째 단(끝 단)에 매듭");
            if (GoAchieve.RewardText(r1).Length == 0 || GoAchieve.TierOf(a, 19) != 0 || GoAchieve.TierOf(a, 20) != 1 || GoAchieve.TierOf(a, 300) != 3 || GoAchieve.TierOf(a, 9999) != 3) Fail("단계 셈");
            parts.Add("보상(300 / 600·쪽지 2 / 교본 2·강화석 3 · 어려운 셋 매듭)");
        }

        private static void CheckSignals(FieldCombat fc, List<string> parts)
        {
            AchieveState.ResetForTest();
            AchieveState.Reaction(GoReaction.None);
            if (AchieveState.Stat("react") != 0) Fail("반응 없음이 셈에 들어감");
            AchieveState.Reaction(GoReaction.Shatter);
            AchieveState.Reaction(GoReaction.Swirl);
            AchieveState.Reaction(GoReaction.Swirl);
            if (AchieveState.Stat("react") != 3 || AchieveState.Kinds != 2 || AchieveState.KindCount("swirl") != 2) Fail($"반응 셈 {AchieveState.Stat("react")}·가짓수 {AchieveState.Kinds}");
            if (AchieveState.ValueOf(Get("shatter")) != 1 || AchieveState.ValueOf(Get("swirl")) != 2 || AchieveState.ValueOf(Get("kinds")) != 2 || AchieveState.ValueOf(Get("react")) != 3) Fail("반응 값");
            AchieveState.Bump("gather", 20);
            if (AchieveState.StatusOf(Get("gather")).Tier != 1) Fail("채집 20 → 첫 단");

            // 실제 게임 신호 — 들판 처치·채집·요리·반응
            AchieveState.ResetForTest();
            CookState.NowForTest = 3_000_000;
            CookState.ResetForTest();
            FieldEnemy e = null;
            foreach (var x in FieldEnemy.All) if (x.Alive && !x.IsGuardian && !x.IsHero) { e = x; break; }
            if (e == null) { Fail("들판 적이 없음"); return; }
            if (e.Shielded) e.SetShieldForTest(0f);
            e.TakeRaw(e.Hp + 999f, Color.white);
            if (AchieveState.Stat("kills") != 1) Fail($"들판 처치가 안 셈 {AchieveState.Stat("kills")}");
            e.ReviveNow();
            CookState.Pick(GoCooking.Nodes[0]);
            if (AchieveState.Stat("gather") != 1) Fail("채집이 안 셈");
            foreach (var (item, n) in GoCooking.Recipes[0].Ing) CookState.Add(item, n);
            CookState.Cook(0, 1, true);
            if (AchieveState.Stat("cook") != 1 || AchieveState.Stat("tasty") != 0) Fail("요리 셈(보통은 맛있는 한 상이 아님)");
            foreach (var (item, n) in GoCooking.Recipes[0].Ing) CookState.Add(item, n);
            CookState.Cook(0, 2, true);
            if (AchieveState.Stat("cook") != 2 || AchieveState.Stat("tasty") != 1) Fail("맛있는 요리 셈");
            e.ReviveNow();
            e.WarpForTest(fc.transform.position + new Vector3(40f, 0f, 40f));
            if (e.Shielded) e.SetShieldForTest(0f);
            int r0 = AchieveState.Stat("react");
            e.TakeHit(1f, GoElement.Cryo, 10f, out _);
            e.TakeHit(1f, GoElement.Pyro, 10f, out _);
            if (AchieveState.Stat("react") <= r0) Fail("원소 반응이 안 셈");
            e.ReviveNow();
            parts.Add("신호(반응 수·가짓수·없음 뺌 · 들판 처치·채집·요리·맛있는 요리·반응 실제로)");
        }

        private static void CheckValues(List<string> parts)
        {
            AchieveState.ResetForTest();
            var ids = GoOrbs.All.Take(5).Select(o => o.Id).ToList();
            OrbState.Restore(ids, 0);
            if (AchieveState.ValueOf(Get("orb")) != 5 || AchieveState.StatusOf(Get("orb")).Tier != 1) Fail("구슬 5 → 첫 단");
            PlayerStats.Restore(10, 0);
            if (AchieveState.StatusOf(Get("rank")).Tier != 2) Fail("여정 등급 10 → 둘째 단");
            StoryState.OffForTest = false;
            StoryState.Restore(5, 0);
            if (AchieveState.ValueOf(Get("chapter")) != 5 || AchieveState.StatusOf(Get("chapter")).Tier != 2) Fail($"이야기 장 값 {AchieveState.ValueOf(Get("chapter"))}");
            WorldQuestState.Restore(new List<int> { 3, 3, -1 }, new List<bool> { true, true, false });
            if (AchieveState.ValueOf(Get("wq")) != 2) Fail("세계 임무 2");
            WorldQuestState.Restore(null, null);
            FishState.Restore(new List<CookState.Entry>(), new List<CookState.Entry> { new CookState.Entry { id = "crucian", n = 4 }, new CookState.Entry { id = "gizzard", n = 7 } }, null);
            if (AchieveState.ValueOf(Get("fish")) != 11 || AchieveState.ValueOf(Get("fishkinds")) != 2) Fail("물고기 기록 값");
            FishState.ResetForTest();
            parts.Add("상태에서 읽는 값(구슬·여정 등급·이야기 장·세계 임무·물고기 기록)");
        }

        private static void CheckClaim(List<string> parts)
        {
            AchieveState.ResetForTest();
            GoldState.Restore(0);
            TalentState.Restore(TalentState.Snapshot(), new int[5]);
            int ore0 = WeaponState.Ore;
            StoryState.OffForTest = false;
            StoryState.Restore(9, 0); // 이야기 장 9 → 세 단계 다 닿음, 어려운 셋
            var a = Get("chapter");
            var s = AchieveState.StatusOf(a);
            if (s.Tier != 3 || s.Claim != 3) Fail($"장 9 인데 단계 {s.Tier} 받을 {s.Claim}");
            if (AchieveState.Claim("nope").Length != 0) Fail("없는 업적을 받음");
            string t0 = AchieveState.Claim("chapter");
            if (t0.Length == 0 || GoldState.Gold != 300) Fail($"첫 단 받기 금 {GoldState.Gold}");
            AchieveState.Claim("chapter");
            if (GoldState.Gold != 900 || TalentState.Count(GoTalent.Mat.Note) != 2) Fail($"둘째 단 받기 금 {GoldState.Gold}");
            AchieveState.Claim("chapter");
            if (GoldState.Gold != 900 || TalentState.Count(GoTalent.Mat.Guide) != 2 || TalentState.Count(GoTalent.Mat.Knot) != 1 || WeaponState.Ore != ore0 + 3) Fail("셋째 단 받기(교본 2·매듭 1·강화석 3)");
            if (AchieveState.Claim("chapter").Length != 0 || AchieveState.StatusOf(a).Claim != 0) Fail("다 받았는데 또 받아짐");
            // 모두 받기 — 다른 업적 몇 개
            PlayerStats.Restore(20, 0);
            AchieveState.Bump("kills", 100);
            int expect = AchieveState.Claimable(); // 상자·구슬 같은 게임 상태 몫이 섞일 수 있어 받을 수를 먼저 센다
            int n = AchieveState.ClaimAll();
            if (expect < 5 || n != expect || AchieveState.Claimable() != 0) Fail($"모두 받기 {n}(기대 {expect}, 최소 3 + 2)");
            parts.Add("받기(단계마다 한 번·보상·모두 받기)");
        }

        private static void CheckNotice(List<string> parts)
        {
            AchieveState.ResetForTest();
            AchieveState.Bump("kills", 30);
            if (AchieveState.Check().Count != 0) Fail("첫 확인이 알림을 냄(불러온 직후는 조용해야 함)");
            if (AchieveState.Check().Count != 0) Fail("바뀐 게 없는데 알림");
            AchieveState.Bump("kills", 70); // 100 → 둘째 단
            var n = AchieveState.Check();
            if (n.Count != 1 || n[0].a.Id != "kill" || n[0].tier != 2) Fail($"새 단계 알림 {n.Count}");
            if (AchieveState.Check().Count != 0) Fail("같은 단계를 또 알림");
            AchieveState.Restore(AchieveState.SnapshotStats(), AchieveState.SnapshotKinds(), AchieveState.SnapshotGot());
            AchieveState.Bump("kills", 200);
            if (AchieveState.Check().Count != 0) Fail("불러온 뒤 첫 확인은 조용해야 함");
            parts.Add("알림(첫 확인 조용·새 단계만·다시 안 울림·불러온 뒤 조용)");
        }

        private static void CheckSave(string savePath, List<string> parts)
        {
            AchieveState.Restore(
                new List<CookState.Entry> { new CookState.Entry { id = "kills", n = 42 }, new CookState.Entry { id = "weak", n = 3 } },
                new List<CookState.Entry> { new CookState.Entry { id = "shatter", n = 5 } },
                new List<CookState.Entry> { new CookState.Entry { id = "kill", n = 1 }, new CookState.Entry { id = "bogus", n = 2 }, new CookState.Entry { id = "boss", n = 99 } });
            if (AchieveState.Stat("kills") != 42 || AchieveState.StatusOf(Get("kill")).Got != 1) Fail("복원");
            if (AchieveState.StatusOf(Get("boss")).Got > Get("boss").Tiers.Length) Fail("받은 단계가 단계 수를 넘음");
            if (!SaveState.Save()) { Fail("SaveState.Save 실패"); return; }
            string json = System.IO.File.ReadAllText(savePath);
            if (!json.Contains("\"achStats\":[") || !json.Contains("\"achGot\":[") || !json.Contains("\"version\":29")) Fail("세이브에 업적이 없다(버전은 28 그대로)");
            AchieveState.ResetForTest();
            if (!SaveState.TryLoad() || AchieveState.Stat("kills") != 42 || AchieveState.Stat("weak") != 3 || AchieveState.KindCount("shatter") != 5 || AchieveState.StatusOf(Get("kill")).Got != 1) Fail("왕복 뒤 업적이 달라짐");
            string old = Regex.Replace(json, ",\"achStats\":\\[[^\\]]*\\],\"achKinds\":\\[[^\\]]*\\],\"achGot\":\\[[^\\]]*\\]", "");
            if (old.Contains("achStats")) { Fail("옛 세이브 가짜 파일 만들기 실패"); return; }
            System.IO.File.WriteAllText(savePath, old);
            if (!SaveState.TryLoad()) { Fail("업적 없는 옛 파일 TryLoad 실패"); return; }
            if (AchieveState.Stat("kills") != 0 || AchieveState.Kinds != 0) Fail("업적 없는 옛 세이브를 읽었는데 0 이 아님");
            parts.Add("세이브(신호·가짓수·받은 단계 왕복 · 옛 세이브는 0 · 버전 그대로)");
        }

        private static void CheckUi(AchieveUi ui, List<string> parts)
        {
            AchieveState.ResetForTest();
            GoldState.Restore(0);
            StoryState.OffForTest = false;
            StoryState.Restore(9, 0);
            PlayerStats.Restore(20, 0);
            ui.Refresh();
            int claimable = AchieveState.Claimable();
            if (claimable <= 0 || !ui.OpenLabel.Contains("●" + claimable)) Fail($"단추에 ●{claimable} 가 없음 '{ui.OpenLabel}'");
            ui.Open();
            if (!ui.IsOpen || !ui.TitleText.Contains("/" + GoAchieve.TotalTiers) || !ui.AllButton.interactable) Fail($"창 제목 '{ui.TitleText}'");
            for (int i = 0; i < 5; i++) if (ui.TabButton(i) == null || ui.TabLabel(i).Length == 0) Fail($"탭 {i}");
            ui.SelectTab(GoAchieve.Cat.World);
            for (int i = 0; i < 5; i++) if (!ui.RowShown(i)) Fail($"세상 곳곳 줄 {i} 이 안 보임");
            ui.SelectTab(GoAchieve.Cat.Story);
            if (!ui.RowShown(2) || ui.RowShown(3)) Fail("이야기 갈래는 세 줄이어야 함");
            if (!ui.RowText(0).Contains(Get("chapter").Name) || !ui.RowText(0).Contains("★★★")) Fail($"줄 글 '{ui.RowText(0)}'");
            if (!ui.ClaimButton(0).interactable || !ui.TabLabel((int)GoAchieve.Cat.Story).Contains("●")) Fail("받을 게 있는 줄·탭 표시");
            int g0 = GoldState.Gold;
            ui.ClaimButton(0).onClick.Invoke();
            if (GoldState.Gold != g0 + 300 || AchieveState.StatusOf(Get("chapter")).Claim != 2) Fail("받기 단추");
            ui.AllButton.onClick.Invoke();
            if (AchieveState.Claimable() != 0 || ui.AllButton.interactable || ui.OpenLabel.Contains("●")) Fail("모두 받기 단추");
            var notified = ui.CheckNow();
            if (notified == null) Fail("CheckNow");
            ui.Close();
            parts.Add("화면(단추 ●N·창 제목·탭 다섯·세상 5줄·이야기 3줄·받기·모두 받기)");
        }

        private static void Fail(string msg)
        {
            _ok = false;
            Debug.LogError($"[{_tag}] achieve FAIL - {msg}");
        }
    }
}
