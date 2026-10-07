using System.Collections.Generic;
using System.Linq;
using System.Reflection;
using TMPro;
using UnityEngine;
using Saga.Realm.Data;
using Saga.Realm.UI;

namespace Saga.EditorTools
{
    /// <summary>
    /// PLAN.md 109-16 시나리오 「천하와 균열」 진단(웹 사가천하 `scenario.js`·`data-scenario.js` 진단 항목) — `PlaytestRealmSlice` 가 명마 진단 뒤에 부른다(끝나면 세이브 JSON 으로 판 상태를 되돌린다).
    /// 표(열아홉 카드·막별 수 3·3·3·3·3·1·3·카드마다 답 셋에 효과가 있고 힌트가 나옴·등용 대상이 시간 틈 사람 표에 있음·6막 승리별 글 다섯·7막 뒤 두 카드 답별 글) ·
    /// 때(시작 달 0 → 12 → 24달 또는 5성 … 표 순서·앞 카드 답 전엔 다음이 안 옴·성 수로도 열림·6막은 승리 뒤·7막 첫 카드는 시간 틈 사람 아홉이 다 모여야) ·
    /// 효과(수도 군량/훈련/치안/기술·금·등용·이미 우리 사람이면 기술 +10·금이 모자라면 카드를 안 끝냄) ·
    /// 글({책사}·{이웃}·{맹장} 칸이 다 채워짐·6막 승리별·7막 답별) · 사건 카드 연결(`RollForMonth` 가 시나리오 카드를 먼저 냄·끄면 안 냄·답하면 끝) ·
    /// 판(제목·본문·버튼 셋 힌트) · 세이브(왕복·옛 세이브는 앞 카드를 건너뜀·처음 본 달).
    /// </summary>
    public static class PlaytestRealmScenario
    {
        private const string T = "[PlaytestRealmSlice] scenario";
        private static bool _ok;

        public static bool Run()
        {
            _ok = true;
            string json0 = RealmSaveState.ToJson();
            bool enabled0 = RealmScenario.Enabled;
            var parts = new List<string>();
            try
            {
                RealmScenario.ResetForTest();
                RealmScenario.VictoryForTest = false; // 이 단계(전 성 함락 뒤)엔 승리가 났고 도시 값이 바뀔 때마다 승리 검사가 다시 돈다 — 진단 동안은 붙든다
                RealmEventState.ClearForTest();
                CheckTable(parts);
                CheckDue(parts);
                CheckEffects(parts);
                CheckTexts(parts);
                CheckVictoryAndTime(parts);
                CheckEventLink(parts);
                CheckSave(parts);
                CheckSide(parts);
                CheckStages(parts);
                CheckPre(parts);
            }
            finally
            {
                RealmEventState.ClearForTest();
                RealmScenario.ResetForTest();
                RealmSaveState.ApplyJson(json0);
                RealmScenario.Enabled = enabled0;
                RealmScenario.TurnForTest = null;
            }
            if (_ok) Debug.Log($"{T} OK - {string.Join(" · ", parts)}");
            return _ok;
        }

        private static string Cap => RealmCityState.ActiveCityIds[0];

        // ---- 표 -----------------------------------------------------------------------------------------------

        private static void CheckTable(List<string> parts)
        {
            var cards = RealmScenarioData.Cards;
            if (cards.Length != 19 || cards.Select(c => c.Id).Distinct().Count() != 19) Fail("카드가 열아홉이 아님");
            var perAct = cards.GroupBy(c => c.Act).OrderBy(g => g.Key).Select(g => g.Count()).ToArray();
            if (!perAct.SequenceEqual(new[] { 3, 3, 3, 3, 3, 1, 3 })) Fail($"막별 카드 수 {string.Join(",", perAct)}");
            for (int i = 0; i < cards.Length; i++)
            {
                var c = cards[i];
                if (c.No != i + 1) Fail($"{c.Id} 번호 {c.No}");
                if (string.IsNullOrEmpty(c.TitleKo) || string.IsNullOrEmpty(c.TextKo) || string.IsNullOrEmpty(c.Emoji)) Fail($"{c.Id} 글 빠짐");
                if (c.Choices.Length != 3 || c.Choices[0].K != "atk" || c.Choices[1].K != "def" || c.Choices[2].K != "util") Fail($"{c.Id} 답 셋 순서");
                foreach (var ch in c.Choices)
                {
                    if (ch.Fx.Length == 0) Fail($"{c.Id}.{ch.K} 효과가 없다");
                    if (string.IsNullOrEmpty(ch.LabelKo) || string.IsNullOrEmpty(ch.ResultKo)) Fail($"{c.Id}.{ch.K} 글 빠짐");
                    if (RealmScenario.Hint(ch).Length == 0) Fail($"{c.Id}.{ch.K} 힌트가 비었다");
                    foreach (var f in ch.Fx)
                    {
                        if (!new[] { "gold", "food", "sec", "train", "tech", "recruit" }.Contains(f.T)) Fail($"{c.Id}.{ch.K} 모르는 효과 {f.T}");
                        if (f.T == "recruit" && (RealmOfficerPool.Get(f.Id) == null || !RealmScenarioData.TimeFolk.Contains(f.Id))) Fail($"{c.Id}.{ch.K} 등용 대상 {f.Id}");
                        if (f.T != "recruit" && f.N <= 0) Fail($"{c.Id}.{ch.K} 효과 값 {f.T} {f.N}");
                    }
                }
                if (c.Victory != (c.Act >= 6)) Fail($"{c.Id} 승리 조건");
                if (c.AllTime != (c.Id == "r7_gather")) Fail($"{c.Id} 시간 틈 사람 조건");
            }
            if (RealmScenarioData.TimeFolk.Length != 9 || RealmScenarioData.TimeFolk.Distinct().Count() != 9 || RealmScenarioData.TimeFolk.Any(id => RealmOfficerPool.Get(id) == null)) Fail("시간 틈 사람 아홉");
            var end = RealmScenarioData.Get("r6_end");
            if (end.TextByKo == null || !new[] { "conquest", "hegemony", "culture", "diplomacy", "survival" }.All(end.TextByKo.ContainsKey)) Fail("6막 승리별 글 다섯");
            foreach (var id in new[] { "r7_after", "r7_end" })
            {
                var c = RealmScenarioData.Get(id);
                if (c.FromId != "r7_gather" || c.TextByKKo == null || !new[] { "atk", "def", "util" }.All(c.TextByKKo.ContainsKey)) Fail($"{id} 답별 글");
            }
            // 1~5막은 12달씩 벌어지고(0·12·24 … 168) 성 수 문턱은 늘기만
            int prevTurn = -1, prevCities = -1;
            foreach (var c in cards.Where(c => !c.Victory))
            {
                if (c.MinTurn <= prevTurn && c.No > 1) Fail($"{c.Id} 달 문턱이 앞 카드보다 늦지 않음");
                if (c.OrCities != 0 && c.OrCities <= prevCities) Fail($"{c.Id} 성 수 문턱이 앞 카드보다 크지 않음");
                prevTurn = c.MinTurn; if (c.OrCities != 0) prevCities = c.OrCities;
            }
            parts.Add("표(열아홉 카드·막별 3·3·3·3·3·1·3·답 셋마다 효과·힌트·등용 대상·6막 승리별 다섯·7막 답별 셋)");
        }

        // ---- 때 -----------------------------------------------------------------------------------------------

        private static void CheckDue(List<string> parts)
        {
            RealmScenario.ResetForTest();
            RealmScenario.CitiesForTest = 1;
            RealmScenario.TurnForTest = 0;
            if (RealmScenario.DueCardId() != "r1_start") Fail($"시작 달 첫 카드 {RealmScenario.DueCardId()}");
            RealmScenario.Enabled = false;
            if (RealmScenario.DueCardId() != null) Fail("끄면 카드가 나옴");
            RealmScenario.Enabled = true;
            // 앞 카드에 답하기 전엔 다음이 안 온다(달이 지나도)
            RealmScenario.TurnForTest = 30;
            if (RealmScenario.DueCardId() != "r1_start") Fail("답 전엔 앞 카드 그대로");
            RealmScenario.TurnForTest = 0;
            Answer("r1_start", 0);
            RealmScenario.TurnForTest = 11;
            if (RealmScenario.DueCardId() != null) Fail($"11달인데 둘째 카드 {RealmScenario.DueCardId()}");
            RealmScenario.TurnForTest = 12;
            if (RealmScenario.DueCardId() != "r1_rift_sign") Fail("12달에 둘째 카드");
            Answer("r1_rift_sign", 1);
            RealmScenario.TurnForTest = 23;
            if (RealmScenario.DueCardId() != null) Fail("23달에 셋째 카드가 나옴");
            RealmScenario.CitiesForTest = 5; // 성 다섯이면 달이 안 차도 열린다
            if (RealmScenario.DueCardId() != "r1_first_ally") Fail("성 다섯인데 셋째 카드가 안 옴");
            RealmScenario.CitiesForTest = 4;
            if (RealmScenario.DueCardId() != null) Fail("성 넷·23달인데 셋째 카드");
            RealmScenario.TurnForTest = 24;
            if (RealmScenario.DueCardId() != "r1_first_ally") Fail("24달에 셋째 카드");
            Answer("r1_first_ally", 2);
            RealmScenario.CitiesForTest = 1;
            // 1~5막 열다섯 카드를 문턱 달마다 차례로
            var order = RealmScenarioData.Cards.Where(c => !c.Victory).ToList();
            int gold = RealmCityState.Gold;
            RealmCityState.AddGold(20000);
            for (int i = 3; i < order.Count; i++)
            {
                RealmScenario.TurnForTest = order[i].MinTurn - 1;
                if (RealmScenario.DueCardId() != null) Fail($"{order[i].Id} 문턱 한 달 앞에 카드가 나옴");
                RealmScenario.TurnForTest = order[i].MinTurn;
                if (RealmScenario.DueCardId() != order[i].Id) { Fail($"{order[i].Id} 문턱에 {RealmScenario.DueCardId()}"); break; }
                Answer(order[i].Id, i % 3);
            }
            if (RealmScenario.DoneCount != 15) Fail($"1~5막 끝낸 카드 {RealmScenario.DoneCount}");
            RealmScenario.TurnForTest = 500;
            RealmScenario.VictoryForTest = false; // ResetForTest 가 붙듦을 풀었다 — 진단 중엔 도시 값이 바뀔 때마다 승리 검사가 다시 돈다
            if (RealmScenario.DueCardId() != null) Fail("6막은 승리 전엔 안 옴");
            parts.Add("때(0·12·24달 또는 5성·앞 카드 답 전엔 다음이 안 옴·문턱 한 달 앞엔 안 옴·1~5막 열다섯 차례·6막은 승리 전엔 안 옴)");
        }

        private static void Answer(string id, int choice)
        {
            var (msg, ok) = RealmScenario.Resolve(id, choice);
            if (!ok || string.IsNullOrEmpty(msg) || msg.Contains("{")) Fail($"{id} 답 {choice}: '{msg}'");
        }

        // ---- 곁가지(시간 틈 사람 각자 두 번째 카드) --------------------------------------------------------------

        private static void CheckSide(List<string> parts)
        {
            var side = RealmScenarioSideData.Side;
            if (side.Length != 9 || side.Select(c => c.Who).Distinct().Count() != 9 || side.Any(c => System.Array.IndexOf(RealmScenarioData.TimeFolk, c.Who) < 0)) Fail("곁가지 표(아홉·시간 틈 사람 아홉)");
            foreach (var c in side)
                if (c.Choices.Length != 3 || !c.TextKo.Contains("{책사}") || c.Choices.Any(ch => ch.Fx.Length != 2 || !ch.Fx.Any(f => f.T == "tech" && f.N == 10))) Fail($"{c.Id} 모양");
            RealmScenario.ResetForTest();
            RealmScenario.SideEnabled = true;
            RealmScenario.CitiesForTest = 1;
            var mine = new HashSet<string>();
            RealmScenario.MineForTest = id => mine.Contains(id);
            // 본 사슬을 다 끝낸 것으로 — 곁가지만 본다
            var all = RealmScenarioData.Cards;
            RealmScenario.Restore(true, 0, 100, all.Select(c => c.Id).ToArray(), all.Select(c => "atk").ToArray(), all.Select(c => 0).ToArray());
            RealmScenario.TurnForTest = 100;
            if (RealmScenario.DueCardId() != null) Fail("우리 사람이 없는데 곁가지가 옴");
            mine.Add("tm_doha");
            if (RealmScenario.DueCardId() != null || RealmScenario.SideSeenTurn("tm_doha") != 100) Fail("처음 본 달에 곁가지가 옴");
            RealmScenario.TurnForTest = 111;
            if (RealmScenario.DueCardId() != null) Fail("열한 달째에 곁가지가 옴");
            mine.Add("tm_gangseo");
            RealmScenario.TurnForTest = 112;
            if (RealmScenario.DueCardId() != "sd_tm_doha") Fail("열두 달째 도하 카드 " + RealmScenario.DueCardId());
            // 글: {책사} 는 로스터의 책사가 아니라 그 사람
            var d = RealmScenario.Describe("sd_tm_doha");
            string doha = RealmOfficerPool.Get("tm_doha")?.Name ?? "tm_doha";
            if (!d.body.Contains(doha) || d.body.Contains("{") || !d.a.Contains("수도 훈련 +6") || !d.a.Contains("수도 기술 +10") || !d.title.Contains("도하")) Fail("곁가지 글 " + d.body);
            var rec = RealmCityState.CityRecord(Cap);
            int train = rec.Train, tech = rec.Tech, gold = RealmCityState.Gold;
            Answer("sd_tm_doha", 0);
            if (rec.Train != train + 6 || rec.Tech != tech + 10) Fail($"곁가지 효과 훈련 {rec.Train - train} 기술 {rec.Tech - tech}");
            if (!RealmScenario.IsDone("sd_tm_doha") || RealmScenario.DueCardId() != null) Fail("곁가지 뒤 또 옴 " + RealmScenario.DueCardId());
            TurnAndCheck(gold);
            // 다른 사람은 그 사람을 처음 본 달부터 열두 달
            RealmScenario.TurnForTest = 123;
            if (RealmScenario.DueCardId() != null) Fail("강서 카드가 열한 달째에 옴");
            RealmScenario.TurnForTest = 124;
            if (RealmScenario.DueCardId() != "sd_tm_gangseo") Fail("강서 카드 " + RealmScenario.DueCardId());
            // 본 사슬에 받을 카드가 있으면 그것이 먼저, 곁가지는 진단이 끄면 안 온다
            RealmScenario.SideEnabled = false;
            if (RealmScenario.DueCardId() != null) Fail("곁가지를 끄면 안 와야");
            RealmScenario.SideEnabled = true;
            RealmScenario.Restore(true, 0, 100, new[] { "r1_start", "r1_rift_sign" }, new[] { "atk", "atk" }, new[] { 0, 0 }, new[] { "tm_gangseo" }, new[] { 100 });
            RealmScenario.TurnForTest = 125;
            if (RealmScenario.DueCardId() != "r1_first_ally") Fail("본 사슬 카드가 먼저여야 " + RealmScenario.DueCardId());
            // 세이브 왕복 — 처음 본 달·끝낸 곁가지
            RealmScenario.Restore(true, 0, 100, all.Select(c => c.Id).ToArray(), all.Select(c => "atk").ToArray(), all.Select(c => 0).ToArray());
            RealmScenario.TurnForTest = 100;
            RealmScenario.DueCardId();
            RealmScenario.TurnForTest = 112;
            Answer(RealmScenario.DueCardId(), 2);
            string json = RealmSaveState.ToJson();
            if (!json.Contains("scenarioSideWho")) Fail("세이브 필드");
            RealmScenario.ResetForTest();
            RealmScenario.SideEnabled = true;
            RealmScenario.MineForTest = id => mine.Contains(id);
            RealmSaveState.ApplyJson(json);
            RealmScenario.TurnForTest = 112;
            if (!RealmScenario.IsDone("sd_tm_doha") && !RealmScenario.IsDone("sd_tm_gangseo")) Fail("곁가지 끝남이 세이브에 없음");
            if (RealmScenario.SideSeenTurn("tm_gangseo") != 100 && RealmScenario.SideSeenTurn("tm_doha") != 100) Fail("처음 본 달이 세이브에 없음");
            RealmScenario.ResetForTest();
            parts.Add("곁가지(시간 틈 사람 아홉·처음 본 달부터 열두 달·{책사}=그 사람·훈련 +6/기술 +10·본 사슬이 먼저·끄기·세이브 왕복)");
        }

        private static void TurnAndCheck(int gold0) { if (RealmCityState.Gold < gold0) Fail("곁가지가 금을 깎음"); }

        // ---- 효과 ---------------------------------------------------------------------------------------------

        private static void CheckEffects(List<string> parts)
        {
            RealmScenario.ResetForTest();
            RealmScenario.CitiesForTest = 1;
            RealmScenario.TurnForTest = 0;
            var rec = RealmCityState.CityRecord(Cap);
            rec.Sec = 20; rec.Train = 20; rec.Tech = 100; rec.Food = 1000;
            int gold0 = RealmCityState.Gold;
            Answer("r1_start", 0); // 군량 +1500 · 훈련 +5
            if (rec.Food != 2500 || rec.Train != 25 || rec.Sec != 20) Fail($"r1_start 위 군량 {rec.Food} 훈련 {rec.Train} 치안 {rec.Sec}");
            RealmScenario.TurnForTest = 12;
            Answer("r1_rift_sign", 2); // 금 +300 · 기술 +6
            if (RealmCityState.Gold != gold0 + 300 || rec.Tech != 106) Fail($"r1_rift_sign 금 {RealmCityState.Gold - gold0} 기술 {rec.Tech}");
            RealmScenario.TurnForTest = 24;
            Answer("r1_first_ally", 1); // 화친 → 치안 +10 (웹 이웃 우호 +25 → ×0.4)
            if (rec.Sec != 30) Fail($"화친 치안 {rec.Sec} ≠ 30");
            // 금이 모자라면 카드를 안 끝낸다 — r2_fallen 위 강서 등용(300)
            RealmScenario.TurnForTest = 36;
            bool wasMine = RealmCityState.RosterIds.Contains("tm_gangseo");
            int roster0 = RealmCityState.RosterIds.Count;
            RealmCityState.TrySpendGold(RealmCityState.Gold);
            var (msg, ok) = RealmScenario.Resolve("r2_fallen", 0);
            if (ok || RealmScenario.IsDone("r2_fallen") || RealmCityState.RosterIds.Count != roster0 || string.IsNullOrEmpty(msg)) Fail("금이 없는데 카드가 끝나거나 등용됨");
            if (RealmScenario.DueCardId() != "r2_fallen") Fail("금이 없어 못 낸 카드가 다음 달에 다시 오지 않음");
            RealmCityState.AddGold(1000);
            int gold1 = RealmCityState.Gold, tech1 = rec.Tech;
            Answer("r2_fallen", 0);
            if (RealmCityState.Gold != gold1 - 300 || !RealmCityState.RosterIds.Contains("tm_gangseo")) Fail("강서 등용(금 300)");
            if (wasMine ? rec.Tech != tech1 + 10 : RealmCityState.OfficerCityId("tm_gangseo") != Cap) Fail(wasMine ? "이미 우리 사람이면 기술 +10" : "강서가 수도에 합류하지 않음");
            // 이미 우리 사람이면(방금 들였으니 이제 그렇다) 같은 카드를 다시 답하면 기술 +10
            RealmScenario.Restore(true, 0, 36, new string[0], new string[0], new int[0]);
            RealmScenario.TurnForTest = 36;
            RealmCityState.AddGold(1000);
            int tech2 = rec.Tech;
            Answer("r2_fallen", 0);
            if (rec.Tech != tech2 + 10) Fail($"이미 우리 사람이면 기술 +10 (기술 {tech2} → {rec.Tech})");
            parts.Add("효과(군량 +1500·훈련 +5·금 +300·기술 +6·화친 = 치안 +10·강서 등용 금 300·이미 우리 사람이면 기술 +10·금이 없으면 카드를 안 끝내고 다음 달 다시)");
        }

        // ---- 글 -----------------------------------------------------------------------------------------------

        private static void CheckTexts(List<string> parts)
        {
            RealmScenario.ResetForTest();
            RealmScenario.CitiesForTest = 1;
            RealmScenario.TurnForTest = 0;
            foreach (var c in RealmScenarioData.Cards)
            {
                var (title, body, a, b, cc) = RealmScenario.Describe(c.Id);
                if (!title.Contains(c.Emoji) || title.Contains("scenario.") || body.Contains("scenario.") || body.Contains("{") || a.Contains("{") || b.Contains("{") || cc.Contains("{")) Fail($"{c.Id} 글에 빈 칸이 남음/번역 키가 그대로");
                if (!body.Contains("📖")) Fail($"{c.Id} 본문에 막 이름이 없다");
                if (!a.Contains("<size=70%>") || !b.Contains("<size=70%>") || !cc.Contains("<size=70%>")) Fail($"{c.Id} 선택지에 힌트가 없다");
            }
            // {책사}·{맹장} 은 로스터 이름으로
            var d1 = RealmScenario.Describe("r1_start");
            string adviser = RealmScenario.Adviser();
            if (!d1.body.Contains(adviser) || adviser.Length == 0) Fail("{책사} 가 로스터 이름으로 안 채워짐");
            if (RealmScenario.Champion().Length == 0 || RealmScenario.Neighbour().Length == 0) Fail("{맹장}·{이웃}");
            // 6막 — 이룬 승리별 글이 달라진다
            var end = RealmScenarioData.Get("r6_end");
            RealmScenario.VictoryKindForTest = "conquest";
            string conq = RealmScenario.BodyOf(end);
            RealmScenario.VictoryKindForTest = "culture";
            string cult = RealmScenario.BodyOf(end);
            RealmScenario.VictoryKindForTest = null;
            if (conq == cult || (!conq.Contains("통일") && !conq.Contains("one"))) Fail("6막 승리별 글이 같거나 정복 글이 아님");
            // 7막 뒤 두 카드 — 앞 카드에서 고른 답별 글
            var after = RealmScenarioData.Get("r7_after");
            string[] bodies = new string[3];
            for (int k = 0; k < 3; k++)
            {
                RealmScenario.Restore(true, 0, 0, new[] { "r7_gather" }, new[] { new[] { "atk", "def", "util" }[k] }, new[] { 0 });
                bodies[k] = RealmScenario.BodyOf(after);
            }
            if (bodies.Distinct().Count() != 3) Fail("7막 답별 글이 같음");
            RealmScenario.ResetForTest();
            if (RealmScenario.BodyOf(after) != RealmLocalization.T("scenario.r7_after.text", after.TextKo)) Fail("앞 카드 답이 없으면 기본 글");
            parts.Add("글({책사}·{이웃}·{맹장} 채움·빈 칸 없음·번역 키 안 샘·막 이름·힌트 셋·6막 승리별·7막 답별)");
        }

        // ---- 승리·시간 틈 사람 ---------------------------------------------------------------------------------

        private static void CheckVictoryAndTime(List<string> parts)
        {
            RealmScenario.ResetForTest();
            RealmScenario.CitiesForTest = 1;
            // 1~5막을 다 끝낸 것으로
            var pre = RealmScenarioData.Cards.Where(c => !c.Victory).ToList();
            RealmScenario.TurnForTest = 500;
            RealmScenario.Restore(true, 0, 500, pre.Select(c => c.Id).ToArray(), pre.Select(c => "atk").ToArray(), pre.Select(c => 0).ToArray());
            RealmScenario.VictoryForTest = false;
            {
                if (RealmScenario.DueCardId() != null) Fail("승리 전에 6막이 옴");
                RealmScenario.VictoryForTest = true;
                RealmScenario.VictoryKindForTest = "conquest";
                if (RealmScenario.DueCardId() != "r6_end") Fail($"승리 뒤 6막 {RealmScenario.DueCardId()}");
                Answer("r6_end", 1);
                // 7막 첫 카드 — 시간 틈 사람 아홉이 다 우리 사람이어야(판정을 붙들어 아홉 중 몇 명이 든 것으로)
                var mine = new HashSet<string>();
                RealmScenario.MineForTest = id => mine.Contains(id);
                if (RealmScenario.DueCardId() != null) Fail("시간 틈 사람이 없는데 7막이 옴");
                for (int i = 0; i < 8; i++) mine.Add(RealmScenarioData.TimeFolk[i]);
                if (RealmScenario.DueCardId() != null) Fail("여덟만 모였는데 7막이 옴");
                mine.Add(RealmScenarioData.TimeFolk[8]);
                if (RealmScenario.DueCardId() != "r7_gather") Fail($"아홉이 모였는데 7막 {RealmScenario.DueCardId()}");
                Answer("r7_gather", 2);
                if (RealmScenario.DueCardId() != "r7_after") Fail("7막 둘째");
                string body = RealmScenario.Describe("r7_after").body;
                if (!body.Contains(RealmLocalization.T("scenario.r7_after.textk.util", RealmScenarioData.Get("r7_after").TextByKKo["util"]).Substring(0, 6))) Fail("고른 답(길로 쓴다)의 글이 아님");
                Answer("r7_after", 0);
                if (RealmScenario.DueCardId() != "r7_end") Fail("7막 셋째");
                Answer("r7_end", 2);
                if (RealmScenario.DueCardId() != null || RealmScenario.DoneCount != 19) Fail("열아홉 카드가 다 끝나야");
            }
            RealmScenario.VictoryForTest = false;
            RealmScenario.VictoryKindForTest = null;
            parts.Add("승리·시간 틈 사람(승리 전엔 6막 안 옴·정복 뒤 6막·아홉 중 여덟만이면 7막 안 옴·아홉이면 열림·7막 셋 차례·열아홉 끝)");
        }

        // ---- 사건 카드 연결 -----------------------------------------------------------------------------------

        private static void CheckEventLink(List<string> parts)
        {
            RealmScenario.ResetForTest();
            RealmScenario.CitiesForTest = 1;
            RealmScenario.TurnForTest = 0;
            RealmEventState.ClearForTest();
            // 끄면 시나리오 카드가 안 뜬다(무작위 사건은 그대로)
            RealmScenario.Enabled = false;
            for (int i = 0; i < 40; i++)
            {
                RealmEventState.ClearForTest();
                RealmEventState.RollForMonth();
                if (RealmEventState.Current.HasValue && RealmEventState.Current.Value.Kind == RealmEventState.Kind.Scenario) { Fail("끈 채 시나리오 카드가 뜸"); break; }
            }
            RealmScenario.Enabled = true;
            RealmEventState.ClearForTest();
            RealmEventState.RollForMonth();
            if (!RealmEventState.Current.HasValue || RealmEventState.Current.Value.Kind != RealmEventState.Kind.Scenario || RealmEventState.Current.Value.OfficerId != "r1_start") { Fail("때가 되면 시나리오 카드가 무작위 사건보다 먼저 뜬다"); return; }
            var card = RealmEventState.Current.Value;
            // 열린 카드는 새로 안 뽑는다
            RealmEventState.RollForMonth();
            if (RealmEventState.Current.Value.OfficerId != "r1_start") Fail("열린 카드가 바뀜");
            // 판 — 제목·본문·버튼 셋(힌트 글)
            var ui = Object.FindFirstObjectByType<RealmCommandUi>();
            if (ui != null)
            {
                var f = typeof(RealmCommandUi);
                var body = f.GetField("_eventBodyText", BindingFlags.NonPublic | BindingFlags.Instance)?.GetValue(ui) as TextMeshProUGUI;
                var title = f.GetField("_eventTitleText", BindingFlags.NonPublic | BindingFlags.Instance)?.GetValue(ui) as TextMeshProUGUI;
                var root = f.GetField("_eventButtonsRoot", BindingFlags.NonPublic | BindingFlags.Instance)?.GetValue(ui) as Transform;
                var panel = f.GetField("_eventPanel", BindingFlags.NonPublic | BindingFlags.Instance)?.GetValue(ui) as GameObject;
                if (body == null || root == null || panel == null || !panel.activeSelf) Fail("시나리오 카드 판이 안 열림");
                else
                {
                    if (!body.text.Contains("📖 1막") || !title.text.Contains("🗺️")) Fail($"판 제목·본문 '{title.text}' / '{body.text.Substring(0, System.Math.Min(20, body.text.Length))}'");
                    var kids = new List<Transform>();
                    foreach (Transform t in root) if (t.gameObject.activeSelf && t.GetComponentInChildren<TextMeshProUGUI>() != null) kids.Add(t);
                    if (kids.Count < 3) Fail($"판의 버튼 {kids.Count} < 3");
                    else for (int q = kids.Count - 3; q < kids.Count; q++) if (!kids[q].GetComponentInChildren<TextMeshProUGUI>().text.Contains("<size=70%>")) Fail("새 버튼에 힌트 줄이 없다"); // 옛 버튼은 프레임 끝에 지워진다 — 마지막 셋이 새것
                    var rt = panel.GetComponent<RectTransform>();
                    if (rt.sizeDelta.y < 640f) Fail("판이 긴 본문을 담기엔 낮다");
                }
                panel?.SetActive(false);
            }
            var rec = RealmCityState.CityRecord(Cap);
            int train0 = rec.Train;
            var outcome = RealmEventState.Resolve(card, RealmEventState.Choice.A);
            if (!outcome.Ok || string.IsNullOrEmpty(outcome.Message) || RealmEventState.Current.HasValue || !RealmScenario.IsDone("r1_start") || RealmScenario.AnswerOf("r1_start") != "atk") Fail("답하면 카드가 끝나야");
            if (rec.Train == train0 && train0 < 95) Fail("답의 효과(훈련 +5)가 안 들어감");
            RealmScenario.TurnForTest = 5;
            RealmEventState.ClearForTest();
            RealmEventState.RollForMonth();
            if (RealmEventState.Current.HasValue && RealmEventState.Current.Value.Kind == RealmEventState.Kind.Scenario) Fail("둘째 카드가 5달에 뜸");
            RealmEventState.ClearForTest();
            parts.Add("사건 카드 연결(때가 되면 무작위 사건보다 먼저·끄면 안 뜸·열린 카드는 그대로·판 제목/본문/버튼 셋 힌트·높이 660·답하면 끝)");
        }

        // ---- 세이브 -------------------------------------------------------------------------------------------

        private static void CheckSave(List<string> parts)
        {
            RealmScenario.ResetForTest();
            RealmScenario.CitiesForTest = 1;
            RealmScenario.TurnForTest = 0;
            Answer("r1_start", 1);
            RealmScenario.TurnForTest = 12;
            Answer("r1_rift_sign", 2);
            string json = RealmSaveState.ToJson();
            if (!json.Contains("\"scenarioIds\":[\"r1_start\",\"r1_rift_sign\"]") || !json.Contains("\"scenarioKs\":[\"def\",\"util\"]") || !json.Contains("\"scenarioSeen\":true") || !json.Contains("\"version\":4")) Fail("세이브에 시나리오가 없다(버전은 4 그대로)");
            RealmScenario.ResetForTest();
            RealmScenario.CitiesForTest = 1;
            RealmScenario.TurnForTest = 12;
            if (!RealmSaveState.ApplyJson(json) || !RealmScenario.IsDone("r1_start") || RealmScenario.AnswerOf("r1_rift_sign") != "util" || RealmScenario.DoneCount != 2) Fail("왕복 뒤 끝낸 카드가 달라짐");
            if (RealmScenario.DueCardId() != null) Fail("왕복 뒤 둘째 카드가 또 옴");
            RealmScenario.TurnForTest = 24;
            if (RealmScenario.DueCardId() != "r1_first_ally") Fail("왕복 뒤 셋째 카드 때");
            // 옛 세이브(시나리오 칸 없음) — 24달을 넘긴 판이면 앞 카드를 다 건너뛴 것으로, 갓 시작한 판이면 처음부터
            string old = System.Text.RegularExpressions.Regex.Replace(json, ",\"scenarioSeen\":(true|false),\"scenarioSideWho\":\\[[^\\]]*\\],\"scenarioSideTurn\":\\[[^\\]]*\\],\"scenarioT0\":-?\\d+,\"scenarioTurnSeen\":-?\\d+,\"scenarioIds\":\\[[^\\]]*\\],\"scenarioKs\":\\[[^\\]]*\\],\"scenarioTurns\":\\[[^\\]]*\\]", "");
            // tasks U-0026 — 단계 세 필드도 옛 세이브엔 없다
            old = System.Text.RegularExpressions.Regex.Replace(old, ",\"scenarioStageId\":\"[^\"]*\",\"scenarioStageTarget\":\"[^\"]*\",\"scenarioStageSince\":-?[0-9]+", "");
            if (old.Contains("scenario")) { Fail("옛 세이브 가짜 만들기 실패"); return; }
            RealmScenario.TurnForTest = 30;
            if (!RealmSaveState.ApplyJson(old)) Fail("옛 세이브를 못 읽음");
            RealmScenario.TurnForTest = 30;
            if (!RealmScenario.IsLegacy("r1_start") || !RealmScenario.IsLegacy("r5_south") || RealmScenario.DueCardId() != null) Fail("24달 넘긴 옛 세이브는 앞 카드를 건너뛴 것으로");
            RealmScenario.Restore(false, 0, 0, null, null, null);
            RealmScenario.TurnForTest = 6;
            if (RealmScenario.DueCardId() != "r1_start" || RealmScenario.Since != 0) Fail("갓 시작한 판은 처음 본 달부터 센다");
            // 달이 되돌아가면(새 판) 처음부터
            RealmScenario.Restore(true, 0, 40, new[] { "r1_start" }, new[] { "atk" }, new[] { 0 });
            RealmScenario.TurnForTest = 3;
            if (RealmScenario.IsDone("r1_start")) Fail("달이 되돌아갔는데(새 판) 끝낸 카드가 남음");
            // 모르는 카드는 버린다
            RealmScenario.Restore(true, 0, 0, new[] { "nope", "r1_start" }, new[] { "atk", "def" }, new[] { 0, 0 });
            RealmScenario.TurnForTest = 0;
            if (RealmScenario.DoneCount != 1 || !RealmScenario.IsDone("r1_start")) Fail("모르는 카드를 못 거름");
            parts.Add("세이브(끝낸 카드·답 왕복·버전 4 그대로·옛 세이브 24달 넘으면 앞 카드 건너뜀·갓 시작하면 처음부터·달이 되돌아가면 새 판·모르는 카드는 버림)");
        }

        // ---- 단계(tasks U-0026) — 성 차지 여섯 ------------------------------------------------------------------

        // 우리 성에서 칠 수 있는 안 차지된 적 성 전부(표 밖에서 따로 센다).
        private static List<string> Candidates(System.Func<string, bool> captured)
        {
            var list = new List<string>();
            foreach (var ours in RealmCityState.ActiveCityIds)
                foreach (var eid in RealmEnemyCity.TargetsFrom(ours))
                    if (!list.Contains(eid) && !captured(eid)) list.Add(eid);
            return list;
        }

        private static void CheckStages(List<string> parts)
        {
            if (RealmScenarioData.Stages.Length != 11) Fail($"단계 표가 열하나가 아님({RealmScenarioData.Stages.Length})");
            var stages = RealmScenarioData.Stages.Where(s => s.Kind == "own").ToArray();   // 성 차지 여섯(앞 단 다섯은 CheckPre)
            var months = new[] { 10, 10, 12, 12, 12, 12 };
            var ids = new[] { "r2_plains", "r3_river", "r4_rift", "r4_plague", "r5_silk", "r5_south" };
            if (stages.Length != 6 || !stages.Select(s => s.Id).SequenceEqual(ids) || !stages.Select(s => s.Months).SequenceEqual(months)) Fail("단계 표가 여섯(10·10·12·12·12·12)이 아님");
            foreach (var s in stages)
            {
                if (s.Kind != "own" || RealmScenarioData.Get(s.Id) == null) Fail($"{s.Id} 단계 종류·카드");
                if (s.Win == null || s.Lose == null || s.Win.Fx.Length == 0 || s.Lose.Fx.Length == 0 || string.IsNullOrEmpty(s.Win.TextKo) || string.IsNullOrEmpty(s.Lose.TextKo) || string.IsNullOrEmpty(s.TitleKo)) Fail($"{s.Id} 단계 글·효과 빠짐");
                foreach (var f in s.Win.Fx.Concat(s.Lose.Fx))
                    if (!new[] { "gold", "food", "sec", "train", "tech" }.Contains(f.T) || f.N == 0) Fail($"{s.Id} 단계 효과 {f.T} {f.N}");
                if (s.Win.Fx.Any(f => f.N < 0) || !s.Lose.Fx.Any(f => f.N < 0)) Fail($"{s.Id} 이긴 쪽은 +만, 진 쪽엔 − 가 있어야 한다");
            }
            if (RealmEnemyCity.ProvOf("nanhai") != "jiao" || RealmEnemyCity.ProvOf("nope") != "") Fail("성 지역 표(ProvOf)");

            RealmScenario.StagesEnabled = true;
            RealmScenario.Enabled = true;
            RealmCityState.AddGold(5000);
            try
            {
                // ② 목표 성 고르기 — 표 밖에서 센 후보와 같은 성이 뽑혀야 한다(prov → 땅 → 병력 → id)
                RealmScenario.CapturedForTest = _ => false;
                var cand = Candidates(RealmScenario.CapturedForTest);
                if (cand.Count == 0) { Fail("목표 후보가 하나도 없다(진단 준비)"); return; }
                foreach (var s in stages)
                {
                    string want = cand.OrderBy(id =>
                    {
                        var def = RealmEnemyCity.Get(id);
                        bool provHit = !string.IsNullOrEmpty(s.Prov) && RealmEnemyCity.ProvOf(id) == s.Prov;
                        bool landHit = !string.IsNullOrEmpty(s.Near) && (def.Land == RealmLand.River ? "river" : "plain") == s.Near;
                        return provHit ? 0 : landHit ? 1 : 2;
                    }).ThenBy(id => RealmWarState.Get(id)?.Troops ?? RealmEnemyCity.Get(id).BaseTroops).ThenBy(id => id, System.StringComparer.Ordinal).First();
                    string got = RealmScenario.PickTarget(s.Near, s.Prov);
                    if (got != want) Fail($"{s.Id} 목표 성 {got} (기대 {want})");
                }
                if (cand.Any(id => RealmEnemyCity.ProvOf(id) == "jiao") && !RealmEnemyCity.ProvOf(RealmScenario.PickTarget("", "jiao")).Equals("jiao")) Fail("교주 우선이 안 먹음");
                RealmScenario.CapturedForTest = _ => true;
                if (RealmScenario.PickTarget("plain", "") != null) Fail("차지된 성뿐인데 목표가 뽑힘");
                RealmScenario.CapturedForTest = _ => false;

                // ③ 흐름 — 이긴 쪽
                RealmScenario.ResetForTest(); RealmScenario.StagesEnabled = true; RealmScenario.Enabled = true; RealmScenario.CapturedForTest = _ => false;
                RealmScenario.TurnForTest = 100;
                var (msg0, ok0) = RealmScenario.Resolve("r2_plains", 0);
                string target = RealmScenario.StageTarget;
                if (!ok0 || RealmScenario.StageId != "r2_plains" || string.IsNullOrEmpty(target) || !msg0.Contains("🎯")) Fail($"단계가 안 열림 id={RealmScenario.StageId} target={target} ok={ok0}");
                if (RealmScenario.StageLine() == null || RealmScenario.StageMonthsLeft != 10) Fail($"단계 한 줄·남은 달 {RealmScenario.StageMonthsLeft}");
                RealmScenario.TurnForTest = 104;
                if (RealmScenario.DueCardId() != null || RealmScenario.StageMonthsLeft != 6) Fail($"열린 동안 본 사슬이 안 쉼 due={RealmScenario.DueCardId()}");
                RealmScenario.CapturedForTest = id => id == target;
                if (RealmScenario.DueCardId() != "r2_plains_end") Fail($"차지했는데 결과 카드가 안 옴({RealmScenario.DueCardId()})");
                var d = RealmScenario.Describe("r2_plains_end");
                if (string.IsNullOrEmpty(d.title) || !d.body.Contains(RealmScenarioData.StageOf("r2_plains").Win.TextKo.Substring(0, 6)) || string.IsNullOrEmpty(d.a) || d.b != "" || d.c != "") Fail($"결과 카드 모양 b='{d.b}' c='{d.c}'");
                int gold0 = RealmCityState.Gold;
                var (msgW, okW) = RealmScenario.Resolve("r2_plains_end", 0);
                if (!okW || RealmCityState.Gold != gold0 + 500 || RealmScenario.StageId != null) Fail($"이긴 결과 금 {RealmCityState.Gold - gold0}(기대 +500)·단계 {RealmScenario.StageId}");

                // 진 쪽 — 달 수가 다 되면(r5_silk: 금 -300)
                RealmScenario.CapturedForTest = _ => false;
                RealmScenario.TurnForTest = 200;
                RealmScenario.Resolve("r5_silk", 0);
                if (RealmScenario.StageId != "r5_silk") Fail("r5_silk 단계가 안 열림");
                RealmScenario.TurnForTest = 211;
                if (RealmScenario.DueCardId() != null) Fail("열한 달째에 결과 카드가 옴");
                RealmScenario.TurnForTest = 212;
                if (RealmScenario.DueCardId() != "r5_silk_end") Fail($"열두 달째에 결과 카드가 안 옴({RealmScenario.DueCardId()})");
                gold0 = RealmCityState.Gold;
                RealmScenario.Resolve("r5_silk_end", 0);
                if (RealmCityState.Gold != gold0 - 300 || RealmScenario.StageId != null) Fail($"진 결과 금 {RealmCityState.Gold - gold0}(기대 -300)");

                // ④ 세이브 — 단계 중 왕복·모르는 값 버림·옛 세이브
                RealmScenario.Resolve("r3_river", 0);
                string sid = RealmScenario.StageId, stg = RealmScenario.StageTarget; int ssince = RealmScenario.StageSince;
                string json = RealmSaveState.ToJson();
                if (sid != "r3_river" || !json.Contains("\"scenarioStageId\":\"r3_river\"")) Fail("세이브 JSON 에 단계가 없다");
                RealmScenario.RestoreStage(null, null, 0);
                RealmScenario.RestoreStage("r3_river", stg, ssince);
                if (RealmScenario.StageId != "r3_river" || RealmScenario.StageTarget != stg || RealmScenario.StageSince != ssince) Fail("단계 복원");
                RealmScenario.RestoreStage("nope", stg, 0);
                if (RealmScenario.StageId != null) Fail("모르는 단계를 받아들임");
                RealmScenario.RestoreStage("r3_river", "nope", 0);
                if (RealmScenario.StageId != null) Fail("모르는 성을 받아들임");
                RealmScenario.RestoreStage("r3_river", stg, ssince);
                string old = System.Text.RegularExpressions.Regex.Replace(json, ",\"scenarioStageId\":\"[^\"]*\",\"scenarioStageTarget\":\"[^\"]*\",\"scenarioStageSince\":-?[0-9]+", "");
                if (old == json) Fail("진단 준비: 옛 세이브 JSON 을 못 만듦");
                RealmSaveState.ApplyJson(old);
                if (RealmScenario.StageId != null) Fail("옛 세이브(필드 없음)인데 단계가 남음");

                // ⑤ 불변 — 설전 카드는 성 차지(목표 성) 단계가 아니라 앞 단 단계를 열고(U-0027), 고르기 카드 모양은 그대로
                RealmScenario.Resolve("r1_first_ally", 0);
                if (RealmScenario.StageId != "r1_first_ally" || RealmScenario.StageTarget != "") Fail($"설전 카드가 목표 성 있는 단계를 열었다 id={RealmScenario.StageId} target='{RealmScenario.StageTarget}'");
                var dd = RealmScenario.Describe("r2_plains");
                if (string.IsNullOrEmpty(dd.a) || string.IsNullOrEmpty(dd.b) || string.IsNullOrEmpty(dd.c)) Fail("고르기 카드 단추 셋이 아님");
                parts.Add($"단계 성 차지 여섯 (목표 {target} → 이김 +500 · r5_silk 12달 → 진 −300 · 세이브 왕복·옛 세이브 · 본 사슬 쉼)");
            }
            finally
            {
                RealmScenario.CapturedForTest = null;
                RealmScenario.StagesEnabled = false;
                RealmScenario.TurnForTest = null;
            }
        }

        // ---- 단계(2) — 설전 셋·일기토 둘(tasks U-0027) ----------------------------------------------------------

        private static BindingFlags Priv => BindingFlags.NonPublic | BindingFlags.Instance;

        private static void CheckPre(List<string> parts)
        {
            var pre = RealmScenarioData.Stages.Where(s => s.Kind != "own").ToArray();
            var ids = new[] { "r1_first_ally", "r2_debate", "r4_tomb", "r5_west", "r3_duel" };
            var kinds = new[] { "debate", "debate", "duel", "debate", "duel" };
            if (!pre.Select(s => s.Id).SequenceEqual(ids) || !pre.Select(s => s.Kind).SequenceEqual(kinds)) Fail("앞 단 다섯 종류가 다름");
            foreach (var s in pre)
            {
                if (string.IsNullOrEmpty(s.IntroKo) || string.IsNullOrEmpty(s.TitleKo) || s.Win.Fx.Length == 0 || s.Lose.Fx.Length == 0 || RealmScenarioData.Get(s.Id) == null) Fail($"{s.Id} 앞 단 글·효과·카드");
                if (s.Kind == "duel" && string.IsNullOrEmpty(s.Foe)) Fail($"{s.Id} 일기토 상대가 없다");
                foreach (var f in s.Win.Fx.Concat(s.Lose.Fx))
                    if (!new[] { "gold", "sec", "train", "tech", "recruit", "recruitFree", "quiz", "lend" }.Contains(f.T)) Fail($"{s.Id} 모르는 효과 {f.T}");
            }
            // 일기토 판정 — 이긴 합이 더 많으면 이김, 같으면 승부 안 남
            var w = new List<string> { "win", "win", "lose" }; var l = new List<string> { "lose", "lose", "win" };
            var t = new List<string> { "win", "lose", "tie" }; var tt = new List<string> { "tie", "tie", "tie" };
            if (RealmDuelState.Decide(w) != true || RealmDuelState.Decide(l) != false || RealmDuelState.Decide(t) != null || RealmDuelState.Decide(tt) != null || RealmDuelState.Decide(null) != null) Fail("일기토 판정(Decide)");
            if (RealmDuelState.MaxRounds != 6) Fail("일기토 연장 상한");

            RealmScenario.StagesEnabled = true;
            RealmScenario.Enabled = true;
            RealmCityState.AddGold(9000);
            try
            {
                RealmScenario.ResetForTest(); RealmScenario.StagesEnabled = true; RealmScenario.Enabled = true;
                RealmScenario.TurnForTest = 300;
                var rec = RealmCityState.CityRecord(Cap);

                // 설전 — 열림(목표 성 없음)·곧 결과 카드·도입 카드·앞 단 전엔 못 끝냄·짐/이김 효과
                RealmScenario.Resolve("r2_debate", 0);
                if (RealmScenario.StageId != "r2_debate" || RealmScenario.StageTarget != "" || RealmScenario.StageLine() != null) Fail($"설전 단계 열림 id={RealmScenario.StageId} target='{RealmScenario.StageTarget}'");
                if (RealmScenario.DueCardId() != "r2_debate_end") Fail($"설전 결과 카드가 곧 안 옴({RealmScenario.DueCardId()})");
                if (!RealmScenario.NeedsPre("r2_debate_end") || RealmScenario.PreKind("r2_debate_end") != "debate") Fail("NeedsPre/PreKind(설전)");
                var intro = RealmScenario.Describe("r2_debate_end");
                if (!intro.body.Contains(RealmScenarioData.StageOf("r2_debate").IntroKo.Substring(0, 6)) || string.IsNullOrEmpty(intro.a) || intro.b != "" || intro.c != "") Fail("도입 카드 모양");
                var early = RealmScenario.Resolve("r2_debate_end", 0);
                if (early.ok || RealmScenario.StageId != "r2_debate") Fail("앞 단 전에 결과가 나옴");
                int correct0 = RealmQuizState.GetProgress().Correct;
                RealmScenario.SetPre(false);
                if (RealmScenario.NeedsPre("r2_debate_end") || !RealmScenario.Describe("r2_debate_end").body.Contains(RealmScenarioData.StageOf("r2_debate").Lose.TextKo.Substring(0, 6))) Fail("진 결과 카드 글");
                var lose = RealmScenario.Resolve("r2_debate_end", 0);
                if (!lose.ok || RealmQuizState.GetProgress().Correct != correct0 + 5 || RealmScenario.StageId != null) Fail($"설전 짐 효과(문답 +5) {RealmQuizState.GetProgress().Correct - correct0}");

                // 이김 — 문답 +20 · 재야 지력 으뜸 합류(없으면 기술 +10)
                string expectPick = null; int bw = -1;
                foreach (var hid in RealmOfficerPool.AllHiddenIds)
                {
                    if (RealmCityState.RosterIds.Contains(hid) || RealmScenarioData.TimeFolk.Contains(hid)) continue;
                    var ho = RealmOfficerPool.Get(hid);
                    if (ho != null && ho.Wisdom > bw) { bw = ho.Wisdom; expectPick = hid; }
                }
                correct0 = RealmQuizState.GetProgress().Correct;
                RealmScenario.Resolve("r2_debate", 0);   // 카드 선택 효과를 먼저 받고 — 결과 카드의 변화만 잰다
                int tech0 = rec.Tech;
                RealmScenario.SetPre(true);
                RealmScenario.Resolve("r2_debate_end", 0);
                if (RealmQuizState.GetProgress().Correct != correct0 + 20) Fail("설전 이김 효과(문답 +20)");
                if (expectPick != null ? !RealmCityState.RosterIds.Contains(expectPick) : (rec.Tech != tech0 + 10 && tech0 + 10 <= 900)) Fail($"재야 합류 {expectPick}");

                // 화친 설전 — 이김: 금 +300
                RealmScenario.Resolve("r1_first_ally", 0);   // 카드 선택 효과(금 등)는 먼저 받고 — 결과 카드의 변화만 잰다
                int gold0 = RealmCityState.Gold;
                RealmScenario.SetPre(true);
                RealmScenario.Resolve("r1_first_ally_end", 0);
                if (RealmCityState.Gold != gold0 + 300 || RealmScenario.StageId != null) Fail($"화친 설전 이김 금 {RealmCityState.Gold - gold0}");

                // 일기토 — 상대가 이미 우리 사람이면 안 열림 · 아니면 열려 이기면 합류, 지면 글만
                RealmScenario.MineForTest = id => id == "tm_yeongjeom";
                RealmScenario.Resolve("r3_duel", 0);
                if (RealmScenario.StageId != null) Fail("상대가 우리 사람인데 일기토가 열림");
                RealmScenario.MineForTest = null;
                bool already = RealmCityState.RosterIds.Contains("tm_yeongjeom");
                RealmScenario.Resolve("r3_duel", 0);
                if (already) { if (RealmScenario.StageId != null) Fail("영점이 이미 합류했는데 일기토가 열림"); }
                else
                {
                    if (RealmScenario.StageId != "r3_duel" || RealmScenario.PreKind("r3_duel_end") != "duel") Fail("일기토 단계가 안 열림");
                    RealmScenario.SetPre(false);
                    RealmScenario.Resolve("r3_duel_end", 0);
                    if (RealmCityState.RosterIds.Contains("tm_yeongjeom") || RealmScenario.StageId != null) Fail("일기토 졌는데 영점이 합류함");
                    RealmScenario.Resolve("r3_duel", 0);
                    RealmScenario.SetPre(true);
                    RealmScenario.Resolve("r3_duel_end", 0);
                    if (!RealmCityState.RosterIds.Contains("tm_yeongjeom")) Fail("일기토 이겼는데 영점이 합류 안 함");
                }
                // 묘문 일기토 지면 — 훈련·치안 내려감(상대 백기는 무장 표에 없어도 된다)
                RealmScenario.Resolve("r4_tomb", 0);
                int train0 = rec.Train, sec0 = rec.Sec;
                RealmScenario.SetPre(false);
                RealmScenario.Resolve("r4_tomb_end", 0);
                if (rec.Train > train0 || rec.Sec > sec0 || RealmScenario.StageId != null) Fail($"묘문 일기토 짐 효과 train {rec.Train - train0} sec {rec.Sec - sec0}");

                // 세이브 — 앞 단 단계는 목표 성 없이 왕복, 앞 단 결과는 안 담는다(불러오면 도입부터)
                RealmScenario.Resolve("r5_west", 0);
                RealmScenario.SetPre(true);
                string json = RealmSaveState.ToJson();
                if (!json.Contains("\"scenarioStageId\":\"r5_west\"")) Fail("설전 단계가 세이브에 없다");
                RealmScenario.RestoreStage("r5_west", "", 305);
                if (RealmScenario.StageId != "r5_west" || RealmScenario.StageTarget != "" || !RealmScenario.NeedsPre("r5_west_end")) Fail("설전 단계 복원(앞 단 결과는 비워야 한다)");
                RealmScenario.RestoreStage("r5_west", "nope", 305);
                if (RealmScenario.StageId != "r5_west" || RealmScenario.StageTarget != "") Fail("설전 단계는 모르는 성 값을 무시해야 한다");
                RealmScenario.RestoreStage(null, null, 0);

                // UI — 결과 카드 단추를 누르면 설전 패널이 열리고, 세 문답을 맞히면 이긴 결과가 난다(헤드리스 슬라이스에만 UI 가 있다)
                var ui = Object.FindFirstObjectByType<RealmCommandUi>();
                if (ui != null)
                {
                    RealmEventState.ClearForTest();
                    RealmScenario.TurnForTest = 400;
                    RealmScenario.Resolve("r2_debate", 0);
                    RealmEventState.RollForMonth();
                    if (!RealmEventState.Current.HasValue || RealmEventState.Current.Value.OfficerId != "r2_debate_end") Fail("UI 시험 준비: 결과 카드가 안 뜸");
                    else
                    {
                        var card = RealmEventState.Current.Value;
                        var f = typeof(RealmCommandUi);
                        var debatePanel = f.GetField("_debatePanel", Priv).GetValue(ui) as GameObject;
                        var ev = f.GetMethod("ChooseEvent", Priv);
                        int c0 = RealmQuizState.GetProgress().Correct;
                        ev.Invoke(ui, new object[] { card, RealmEventState.Choice.A });
                        if (!debatePanel.activeSelf || !RealmScenario.NeedsPre("r2_debate_end") || !RealmEventState.Current.HasValue) Fail("도입 카드 단추가 설전 패널을 안 엶");
                        else
                        {
                            var qs = f.GetField("_debateQuestions", Priv).GetValue(ui) as List<RealmQuizState.Presented>;
                            var answer = f.GetMethod("ChooseDebateAnswer", Priv);
                            int n = qs.Count;
                            for (int k = 0; k < n; k++) answer.Invoke(ui, new object[] { qs[k].CorrectIndex });
                            if (debatePanel.activeSelf || RealmScenario.StageId != null || RealmEventState.Current.HasValue) Fail("설전을 마쳤는데 결과가 안 났다");
                            if (RealmQuizState.GetProgress().Correct < c0 + 20) Fail($"UI 설전 이김 효과 {RealmQuizState.GetProgress().Correct - c0}");
                        }
                    }
                    RealmEventState.ClearForTest();
                }
                parts.Add("단계 설전 셋·일기토 둘 (도입 카드→앞 단→결과 · 설전 이김 문답 +20·재야 합류/짐 +5 · 일기토 합류/짐 · 상대가 우리 사람이면 안 열림 · 세이브 왕복 · UI 패널 콜백)");
            }
            finally
            {
                RealmScenario.MineForTest = null;
                RealmScenario.StagesEnabled = false;
                RealmScenario.TurnForTest = null;
                RealmEventState.ClearForTest();
            }
        }

        private static void Fail(string msg)
        {
            _ok = false;
            Debug.LogError($"{T} FAIL - {msg}");
        }
    }
}
