using System;
using UnityEngine;
using Saga.Dungeon.Data;
using Saga.Dungeon.UI;
using Saga.Dungeon.World;

namespace Saga.EditorTools
{
    /// <summary>
    /// tasks U-0195 2나락 시즌·래더(고돗 G-0334 짝) 진단 — `PlaytestDungeonHeadless` 가 신의 가호 뒤에 부른다(한 프레임 안).
    /// ① 시즌 번호(월요일 0시에 바뀜·일요일까지 같음) · 점(D1~S5 × 급) · 단계 문턱 ② 래더(좋은 판 다섯만·점수 = 합·셋째 줄·단계 오름 !)
    /// ③ 넘어감(처음 켠 기기 = 번호만 · 다음 주 = 단계 금·지난 기록·래더 비움 · 지난 기록 넷까지 · 시계를 뒤로 = 아무것도 안 함) ④ 판 등급 잇기(진짜 Finish — 살아 나온 판만·Append 셋째 줄)
    /// ⑤ 창(🏆·점수·좋은 판·지난 시즌·닫기) ⑥ 세이브 칸·왕복·옛 세이브 ⑦ 손잡이. 끝나면 시즌·금·판 등급·창을 시작 때로.
    /// </summary>
    public static class PlaytestDungeonSeason
    {
        private const string T = "[PlaytestDungeonHeadless] season";
        private static bool _ok, _step;

        public static bool Run()
        {
            _ok = true;
            string season0 = DungeonSeason.Snapshot();
            int gold0 = HeroState.Gold;
            int[] tiers0 = DungeonRunRank.SnapshotTiers();
            string[] grades0 = DungeonRunRank.SnapshotGrades(tiers0);
            var mon = new DateTime(2026, 10, 19);   // 월요일
            try
            {
                DungeonSeason.ResetForTest();
                DungeonSeason.NowForTest = mon;

                // ① 번호·점·문턱
                Begin();
                int w = DungeonSeason.IdOf(mon);
                if (DungeonSeason.IdOf(mon.AddDays(6)) != w || DungeonSeason.IdOf(mon.AddDays(7)) != w + 1 || DungeonSeason.IdOf(mon.AddDays(-1)) != w - 1) Fail("월요일 0시에 안 바뀜");
                if (DungeonSeason.PtsOf("D", 1) != 1 || DungeonSeason.PtsOf("S", 5) != 25 || DungeonSeason.PtsOf("B", 2) != 6) Fail("점");
                if (DungeonSeason.TierIdx(9) != -1 || DungeonSeason.TierIdx(10) != 0 || DungeonSeason.TierIdx(99) != 3 || DungeonSeason.TierIdx(125) != 4) Fail("문턱");
                End("week OK - 월요일 0시에 번호 +1(일요일까지 같음) · D·1급 1점·B·2급 6점·S·5급 25점 · 문턱 10·25·45·70·100");

                // ② 래더
                Begin();
                DungeonSeason.Roll(out _);                            // 처음 켠 기기 — 번호만
                if (DungeonSeason.Id != w || HeroState.Gold != gold0) Fail("처음 켠 기기가 덤");
                string l1 = DungeonSeason.Record("B", 3);              // 9
                DungeonSeason.Record("A", 2);                          // 8 → 17 청동
                string l3 = DungeonSeason.LastLine;
                foreach (var g in new[] { "D", "C", "S", "C" }) DungeonSeason.Record(g, 1);  // 1·2·5·2 → 좋은 다섯 9·8·5·2·2 = 26
                if (DungeonSeason.Runs.Count != DungeonSeason.Keep || DungeonSeason.Score != 26) Fail($"래더 {DungeonSeason.Runs.Count}판 {DungeonSeason.Score}점 ≠ 5판 26");
                if (!l1.Contains("+9") || !l3.Contains("!")) Fail($"줄「{l1}」·「{l3}」");
                End($"ladder OK - 좋은 판 다섯(9·8·5·2·2 = {DungeonSeason.Score}) · 「{l1}」·「{l3}」");

                // ③ 넘어감
                Begin();
                DungeonSeason.NowForTest = mon.AddDays(-3);           // 시계를 뒤로
                int back = DungeonSeason.Roll(out string backLine);
                if (back != 0 || backLine.Length != 0 || DungeonSeason.Id != w || DungeonSeason.Score != 26) Fail("시계를 뒤로 돌렸는데 닫음");
                DungeonSeason.NowForTest = mon.AddDays(8);
                int g1 = DungeonSeason.Roll(out string rolled);
                if (g1 != 300 || HeroState.Gold != gold0 + 300 || DungeonSeason.Runs.Count != 0 || DungeonSeason.PastSeasons.Count != 1 || DungeonSeason.PastSeasons[0].score != 26) Fail($"백은 닫기 금 {g1}·지갑 +{HeroState.Gold - gold0}");
                DungeonSeason.NowForTest = mon.AddDays(-3);
                if (DungeonSeason.Roll(out _) != 0 || HeroState.Gold != gold0 + 300) Fail("뒤로 돌려 또 받음");
                for (int i = 2; i <= 6; i++) { DungeonSeason.NowForTest = mon.AddDays(7 * i + 1); DungeonSeason.Roll(out _); }
                if (DungeonSeason.PastSeasons.Count != DungeonSeason.PastKeep) Fail($"지난 기록 {DungeonSeason.PastSeasons.Count}");
                End($"roll OK - 시계 뒤로 = 아무것도 안 함(다시 받기 없음) · 다음 주「{rolled}」 지갑 +300 · 래더 비움 · 지난 기록 넷까지");

                // ④ 판 등급 잇기(진짜 Finish)
                Begin();
                DungeonSeason.ResetForTest();
                DungeonSeason.NowForTest = mon;
                DungeonSeason.Roll(out _);
                var alive = FinishFake(false);
                string aliveMsg = DungeonRunRank.Append(alive), aliveLine = DungeonSeason.LastLine;
                if (!alive.HasValue || DungeonSeason.Runs.Count != 1 || !aliveMsg.Contains("🏅")) Fail($"살아 나온 판 — 래더 {DungeonSeason.Runs.Count}·「{aliveMsg.Replace("\n", " / ")}」");
                var dead = FinishFake(true);
                if (!dead.HasValue || DungeonSeason.Runs.Count != 1 || DungeonRunRank.Append(dead).Contains("🏅")) Fail("쓰러진 판이 시즌에");
                End($"runrank OK - 살아 나온 판만 래더 · 알림 셋째 줄「{aliveLine}」· 쓰러진 판은 줄 없음");

                // ⑤ 창
                Begin();
                var ui = DungeonSeasonUi.Instance;
                if (ui == null || ui.OpenButton == null) Fail("창·🏆 없음");
                else
                {
                    ui.OpenButton.onClick.Invoke();
                    if (!ui.IsOpen || !ui.Body.text.Contains(DungeonSeason.Score + "점") || !ui.Body.text.Contains("1.")) Fail($"창「{ui.Body.text}」");
                    ui.CloseButton.onClick.Invoke();
                    if (ui.IsOpen) Fail("닫기");
                    End($"ui OK - 🏆 → 「{ui.Body.text.Split('\n')[0]}」· 좋은 판 줄 · 닫기");
                }

                // ⑥ 세이브
                Begin();
                string snap = DungeonSeason.Snapshot();
                if (!SaveState.ToJson().Contains("\"seasonJson\"")) Fail("세이브에 seasonJson 없음");
                DungeonSeason.Restore(null);
                if (DungeonSeason.Id != -1 || DungeonSeason.Runs.Count != 0) Fail("옛 세이브인데 기록");
                DungeonSeason.Restore(snap);
                if (DungeonSeason.Id != w || DungeonSeason.Runs.Count != 1) Fail("왕복");
                End("save OK - seasonJson 왕복(번호·래더·지난 기록)·옛 세이브 = 처음 켠 기기");

                // ⑦ 손잡이
                Begin();
                DungeonSeason.On = false;
                DungeonSeason.NowForTest = mon.AddDays(30);
                int gOff = HeroState.Gold;
                if (DungeonSeason.Roll(out _) != 0 || DungeonSeason.Record("S", 5).Length != 0 || HeroState.Gold != gOff || DungeonSeason.Runs.Count != 1) Fail("껐는데 시즌");
                End("off OK - 끄면 기록·넘어감 없음");
            }
            finally
            {
                DungeonSeason.On = true;
                DungeonSeason.NowForTest = null;
                DungeonSeason.Restore(season0);
                HeroState.Restore(HeroState.Level, HeroState.Exp, HeroState.Hp, gold0, HeroState.EquippedWeaponId, HeroState.SocketedGemId); // 넘어감 금 되돌림
                DungeonRunRank.Restore(tiers0, grades0);
                DungeonRunRank.ClearForTest();
                DungeonSeasonUi.Instance?.Close();
            }
            return _ok;
        }

        /// <summary>판 하나를 열어 처치 셋을 넣고 닫는다(진짜 Finish — 덤 금은 0 판이라 지갑을 안 건드린다).</summary>
        private static DungeonRunRank.Result? FinishFake(bool dead)
        {
            DungeonRunRank.ClearForTest();
            DungeonRunRank.OnHit(0f);
            for (int i = 0; i < DungeonRunRank.MinKills; i++) DungeonRunRank.OnKill();
            return DungeonRunRank.Finish(60f, dead);
        }

        private static void Begin() => _step = true;
        private static void End(string line) { if (_step) Debug.Log($"{T} {line}"); }

        private static void Fail(string why)
        {
            _ok = false;
            _step = false;
            Debug.LogError($"{T} FAIL - {why}");
        }
    }
}
