using System.Reflection;
using TMPro;
using UnityEngine;
using Saga.Dungeon.Data;
using Saga.Dungeon.UI;
using Saga.Dungeon.World;

namespace Saga.EditorTools
{
    /// <summary>
    /// tasks U-0194 2나락 신의 가호(고돗 G-0335 짝) 진단 — `PlaytestDungeonHeadless` 가 장비 숙련 뒤에 부른다(한 프레임 안).
    /// ① 단(고른 횟수 0·2 = 0단 · 3 = 1단 · 6 = 2단 · 더 = 2단) ② 덤(그 축 배율 × 1.08·1.16 — 축복 덤과 곱, 남의 축 그대로)
    /// ③ 보스층 3택 고르기(GameBootstrap.ChooseWithFavor — 횟수 +1·단 오름 알림) · 그냥 Choose(무리 사냥)는 안 셈 ④ 카드 셋째 줄(보스층만 · 닿을 때 「→ 가호 1단!」)
    /// ⑤ 세이브 칸·왕복·옛 세이브 ⑥ 손잡이. 끝나면 축복·가호·창을 시작 때로.
    /// </summary>
    public static class PlaytestDungeonFavor
    {
        private const string T = "[PlaytestDungeonHeadless] favor";
        private static bool _ok, _step;

        public static bool Run()
        {
            _ok = true;
            string favor0 = DungeonFavor.Snapshot();
            var bless0 = BlessingState.SnapshotIds();
            var ui = Object.FindFirstObjectByType<BlessingChoiceUi>();
            try
            {
                DungeonFavor.ResetForTest();
                BlessingState.Restore(null);
                var atk = BlessingState.Axis.Atk;
                var offer = BlessingState.RollChoice(new System.Random(20260824));
                var atkCard = System.Array.Find(offer, b => b.Axis == atk);

                // ① 단
                Begin();
                int[] picks = { 0, 2, 3, 5, 6, 9 }, want = { 0, 0, 1, 1, 2, 2 };
                for (int i = 0; i < picks.Length; i++) if (DungeonFavor.TierOf(picks[i]) != want[i]) Fail($"{picks[i]}번 = {DungeonFavor.TierOf(picks[i])}단 ≠ {want[i]}");
                End("tier OK - 0·2번 0단 · 3번 1단 · 6번 2단 · 9번도 2단");

                // ② 덤 · ③ 고르기
                Begin();
                if (BlessingState.AtkMultiplier != 1f) Fail("빈 축인데 공 배율");
                BlessingState.Choose(atkCard);                    // 무리 사냥 길 — 안 셈
                if (DungeonFavor.Picks(atk) != 0) Fail("그냥 Choose 가 셈");
                float plain = BlessingState.AtkMultiplier;
                GameBootstrap.ChooseWithFavor(atkCard);
                GameBootstrap.ChooseWithFavor(atkCard);
                if (DungeonFavor.Tier(atk) != 0) Fail("두 번에 1단");
                string card2 = DungeonFavor.CardLine(atk);
                GameBootstrap.ChooseWithFavor(atkCard);
                float t1 = BlessingState.AtkMultiplier;
                for (int i = 0; i < 3; i++) GameBootstrap.ChooseWithFavor(atkCard);
                float t2 = BlessingState.AtkMultiplier;
                if (DungeonFavor.Picks(atk) != 6 || DungeonFavor.Tier(atk) != 2) Fail($"여섯 번 {DungeonFavor.Picks(atk)}·{DungeonFavor.Tier(atk)}단");
                if (!Near(t1, plain * 1.08f) || !Near(t2, plain * 1.16f)) Fail($"공 배율 {plain}→1단 {t1}→2단 {t2}");
                if (BlessingState.DefMultiplier != 1f || BlessingState.SweepMultiplier != 1f) Fail("남의 축까지 덤");
                if (!card2.Contains("→") || !DungeonFavor.CardLine(atk).Contains("2")) Fail($"카드 줄「{card2}」·「{DungeonFavor.CardLine(atk)}」");
                End($"pick OK - 그냥 Choose(무리 사냥) 안 셈 · 보스층 3택 세 번 1단·여섯 번 2단 · 공 ×{plain:0.00} → {t1:0.000} → {t2:0.000} · 수·선 그대로 · 「{card2}」→「{DungeonFavor.CardLine(atk)}」 · 알림「{DungeonFavor.UpLine(atk, 2)}」");

                // ④ 카드 셋째 줄
                Begin();
                if (ui == null) Fail("3택 창 없음");
                else
                {
                    DungeonFavor.ResetForTest();
                    var labels = (TextMeshProUGUI[])typeof(BlessingChoiceUi).GetField("_cardLabels", BindingFlags.NonPublic | BindingFlags.Instance).GetValue(ui);
                    ui.Show(offer, _ => { }, () => { }, favor: true);
                    string withFavor = labels[0].text;
                    ui.Show(offer, _ => { }, () => { });
                    string plainCard = labels[0].text;
                    HideUi(ui);
                    if (!withFavor.Contains(DungeonFavor.CardLine(offer[0].Axis)) || plainCard.Split('\n').Length != 2) Fail($"카드「{withFavor}」·무리「{plainCard}」");
                    End($"card OK - 보스층 카드「{withFavor.Replace("\n", " / ")}」· 무리 사냥 카드엔 없음");
                }

                // ⑤ 세이브
                Begin();
                DungeonFavor.ResetForTest();
                GameBootstrap.ChooseWithFavor(atkCard);
                string snap = DungeonFavor.Snapshot();
                if (!SaveState.ToJson().Contains("\"favorJson\"")) Fail("세이브에 favorJson 없음");
                DungeonFavor.Restore(null);
                if (DungeonFavor.Picks(atk) != 0) Fail("옛 세이브인데 횟수");
                DungeonFavor.Restore(snap);
                if (DungeonFavor.Picks(atk) != 1) Fail("왕복");
                DungeonFavor.Restore("{\"picks\":[1,2]}");
                if (DungeonFavor.Picks(atk) != 0) Fail("길이 틀린 세이브를 받음");
                End("save OK - favorJson 왕복·옛 세이브 0·길이 틀리면 버림");

                // ⑥ 손잡이
                Begin();
                DungeonFavor.Restore("{\"picks\":[6,0,0]}");
                DungeonFavor.On = false;
                if (DungeonFavor.Mul(atk) != 1f || DungeonFavor.OnPick(atk) != -1 || DungeonFavor.CardLine(atk).Length != 0) Fail("껐는데 가호");
                End("off OK - 끄면 덤·셈·카드 줄 없음");
            }
            finally
            {
                DungeonFavor.On = true;
                DungeonFavor.Restore(favor0);
                BlessingState.Restore(bless0);
                if (ui != null && ui.IsShowing) HideUi(ui);
            }
            return _ok;
        }

        /// <summary>창을 닫는다 — 고르기 없이(DamageHold 도 풀리게 거절 길이 아닌 Release 를 부른다).</summary>
        private static void HideUi(BlessingChoiceUi ui)
        {
            var panel = (GameObject)typeof(BlessingChoiceUi).GetField("_panel", BindingFlags.NonPublic | BindingFlags.Instance).GetValue(ui);
            panel.SetActive(false);
            typeof(BlessingChoiceUi).GetMethod("Release", BindingFlags.NonPublic | BindingFlags.Instance).Invoke(ui, null);
        }

        private static bool Near(float a, float b) => Mathf.Abs(a - b) < 0.0005f;
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
