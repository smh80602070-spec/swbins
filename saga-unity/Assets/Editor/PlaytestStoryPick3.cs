using System.Collections.Generic;
using System.Linq;
using UnityEngine;
using Saga.Story.Data;
using Saga.Story.UI;

namespace Saga.EditorTools
{
    /// <summary>
    /// tasks U-0093 "레벨업 무예 3택 + 한 판 결과 등급"(웹 사가종횡 W-0104) 진단 — `PlaytestStorySlice` Init 끝에 부른다(한 프레임 안).
    /// ① 옛 세이브(3택 칸 없음, Lv.30·무예 여럿) 불러오기 → 문턱 = 그 레벨, SP 남은 점수 그대로 ② Offer3 100번 유파 겹침 0·셋 이하·전부 올릴 수 있음
    /// ③ 레벨업 → 장 +1 ④ Pick → 그 무예 +1·SP 그대로·장 −1 ⑤ Decline → SP +1 ⑥ 세이브 왕복(문턱·3택 몫·강화 점수·남은 장)
    /// ⑦ 3택 창(뜸·맞지 않음·고르면 닫힘) ⑧ RankOf S·C·판 흐름(처치 3 미만은 등급 없음·두목 처치로 닫힘) ⑨ ko/en.
    /// 끝나면 세이브 JSON 으로 통째 되돌리고 3택 몫은 시작 때 값으로.
    /// </summary>
    public static class PlaytestStoryPick3
    {
        private const string T = "[PlaytestStorySlice] pick3";
        private static bool _ok;

        public static bool Run()
        {
            _ok = true;
            string json0 = StorySaveState.ToJson();
            int cut0 = StorySkillState.SpCutLv, free0 = StorySkillState.FreeLevels, bonus0 = StorySkillState.BonusSp, pend0 = StorySkillState.PendingPicks;
            string m = "";
            try
            {
                // ① 옛 세이브 이행 — 전사 사슬 무예 여럿을 찍은 Lv.30(3택 몫이 0 인 JSON = 옛 세이브와 같다)
                StoryJobState.Restore(30, 0f, "warrior");
                var wk = StorySkillData.All.Where(s => StoryJobState.InChain(s.Job)).Take(8).ToList();
                StorySkillState.Restore(wk.Select(s => s.Key).ToArray(), wk.Select(s => Mathf.Min(3, s.Max)).ToArray());
                int spOld = StorySkillState.SpLeft;
                string legacy = StorySaveState.ToJson();
                if (!legacy.Contains("\"spCutLv\":0")) Fail("옛 세이브 흉내 — spCutLv 0 이 아님");
                if (!StorySaveState.ApplyJson(legacy)) Fail("옛 세이브 불러오기 실패");
                if (StorySkillState.SpCutLv != 30) Fail($"이행 문턱 {StorySkillState.SpCutLv} ≠ 30");
                if (StorySkillState.SpLeft != spOld) Fail($"이행 뒤 SP {StorySkillState.SpLeft} ≠ {spOld}");
                m += $" 이행 SP {spOld} 그대로";

                // ② Offer3 100번
                var rng = new System.Random(20260824);
                int maxN = 0;
                for (int i = 0; i < 100; i++)
                {
                    var o = StorySkillState.Offer3(rng);
                    maxN = Mathf.Max(maxN, o.Count);
                    if (o.Count > 3) Fail("셋 넘음");
                    if (o.Select(s => string.IsNullOrEmpty(s.School) ? s.Key : s.School).Distinct().Count() != o.Count) { Fail("유파 겹침"); break; }
                    if (o.Any(s => StorySkillState.CanPick(s.Key) != null)) { Fail("못 올리는 무예가 섞임"); break; }
                }
                if (maxN != 3) Fail($"셋을 못 채움(최대 {maxN})");

                // ③ 레벨업 → 장 하나
                int pend = StorySkillState.PendingPicks;
                StoryJobState.GainExp(StoryCombat.ExpNeed(StoryJobState.Level) + 0.01f);
                if (StoryJobState.Level != 31 || StorySkillState.PendingPicks != pend + 1) Fail($"레벨업 장 Lv.{StoryJobState.Level} 장 {StorySkillState.PendingPicks}");

                // ④ Pick — SP 그대로
                int sp = StorySkillState.SpLeft;
                var pick = StorySkillState.Offer3(rng)[0];
                int lv = StorySkillState.LevelOf(pick.Key);
                if (!StorySkillState.Pick(pick.Key)) Fail("Pick 거절");
                if (StorySkillState.LevelOf(pick.Key) != lv + 1 || StorySkillState.SpLeft != sp || StorySkillState.PendingPicks != pend) Fail($"Pick 뒤 Lv {StorySkillState.LevelOf(pick.Key)}·SP {StorySkillState.SpLeft}/{sp}·장 {StorySkillState.PendingPicks}");

                // ⑤ Decline — SP +1
                StoryJobState.GainExp(StoryCombat.ExpNeed(StoryJobState.Level) + 0.01f);
                sp = StorySkillState.SpLeft;
                if (!StorySkillState.Decline() || StorySkillState.SpLeft != sp + 1) Fail($"Decline SP {StorySkillState.SpLeft} ≠ {sp + 1}");
                m += $" · 3택 Pick·Decline(SP {sp}→{StorySkillState.SpLeft})";

                // ⑥ 세이브 왕복
                StoryJobState.GainExp(StoryCombat.ExpNeed(StoryJobState.Level) + 0.01f);   // 남은 장 1
                int c = StorySkillState.SpCutLv, f = StorySkillState.FreeLevels, b = StorySkillState.BonusSp, p = StorySkillState.PendingPicks, sl = StorySkillState.SpLeft;
                string j = StorySaveState.ToJson();
                StorySkillState.RestorePicks(0, 0, 0, 0);
                StorySaveState.ApplyJson(j);
                if (StorySkillState.SpCutLv != c || StorySkillState.FreeLevels != f || StorySkillState.BonusSp != b || StorySkillState.PendingPicks != p || StorySkillState.SpLeft != sl)
                    Fail($"세이브 왕복 {StorySkillState.SpCutLv}/{c} {StorySkillState.FreeLevels}/{f} {StorySkillState.BonusSp}/{b} {StorySkillState.PendingPicks}/{p}");
                m += $" · 왕복(문턱 {c}·3택 {f}·강화 {b}·장 {p})";

                // ⑦ 창
                var ui = StoryPickUi.Instance;
                if (ui == null) Fail("3택 창 없음(GameBootstrap Install)");
                else
                {
                    ui.Refresh();
                    if (!ui.IsShowing || ui.Offer.Count == 0) Fail($"장이 있는데 창이 안 뜸 {ui.IsShowing}/{ui.Offer.Count}");
                    if (!StoryPlayerHp.HoldForPick) Fail("창이 떠도 피해를 막지 않음");
                    float hp = StoryPlayerHp.Hp;
                    StoryPlayerHp.Hurt(5f);
                    if (StoryPlayerHp.Hp != hp) Fail("창이 떠 있는데 맞음");
                    if (ui.Offer.Count > 0)
                    {
                        string key = ui.Offer[0].Key;
                        int before = StorySkillState.LevelOf(key);
                        ui.Choose(0);
                        if (ui.IsShowing || StoryPlayerHp.HoldForPick || StorySkillState.LevelOf(key) != before + 1) Fail("고른 뒤 창·막기·레벨");
                    }
                    m += " · 창 ○";
                }

                // ⑧ 등급
                if (StoryRunRank.RankOf(90f, 0, 20).Rank != "S") Fail("RankOf S");
                if (StoryRunRank.RankOf(600f, 15, 3).Rank != "C") Fail("RankOf C");
                StoryRunRank.ClearForTest();
                StoryRunRank.OnHit(0f); StoryRunRank.OnKill(false, 1f); StoryRunRank.OnKill(true, 2f);
                if (StoryRunRank.Last.HasValue) Fail("처치 2 판에 등급이 남");
                StoryRunRank.ClearForTest();
                for (int i = 0; i < 12; i++) StoryRunRank.OnHit(i);
                StoryRunRank.OnHurt();
                for (int i = 0; i < 6; i++) StoryRunRank.OnHit(20 + i);
                StoryRunRank.OnKill(false, 30f); StoryRunRank.OnKill(false, 40f); StoryRunRank.OnKill(true, 100f);
                var r = StoryRunRank.Last;
                if (!r.HasValue || r.Value.Hits != 1 || r.Value.ComboMax != 12 || r.Value.Sec != 100 || r.Value.Rank != "A") Fail($"판 흐름 {(r.HasValue ? $"{r.Value.Rank} 피격 {r.Value.Hits} 연타 {r.Value.ComboMax} {r.Value.Sec}초" : "없음")}");
                else m += $" · {StoryRunRank.Line(r.Value)}";

                // ⑨ ko/en
                foreach (var lang in new[] { "ko", "en" })
                {
                    var ta = Resources.Load<TextAsset>($"Localization/story_{lang}");
                    foreach (var k in new[] { "pick.title", "pick.decline", "pick.done", "runrank.line" })
                        if (ta == null || !ta.text.Contains($"\"{k}\"")) Fail($"{lang} 키 {k} 없음");
                }
            }
            finally
            {
                StorySaveState.ApplyJson(json0);
                StorySkillState.RestorePicks(cut0, free0, bonus0, pend0);
                StoryRunRank.ClearForTest();
                StoryPlayerHp.HoldForPick = false;
                StoryPickUi.Instance?.Refresh();
            }
            if (_ok) Debug.Log($"{T} OK - 옛 세이브 이행 SP 그대로 · Offer3 100번 유파 겹침 0 · 레벨업 장 · Pick SP 그대로 · Decline +1 · 세이브 왕복 · 창(막기·고름) · RankOf S/C·판 흐름 · ko/en |{m}");
            return _ok;
        }

        private static void Fail(string why)
        {
            _ok = false;
            Debug.LogError($"{T} FAIL - {why}");
        }
    }
}
