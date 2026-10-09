using TMPro;
using System.Reflection;
using UnityEditor;
using UnityEditor.SceneManagement;
using UnityEngine;
using UnityEngine.UI;
using Saga.Core;
using Saga.Go.Audio;
using Saga.Go.Data;
using Saga.Go.Player;
using Saga.Go.UI;
using Saga.Go.World;

namespace Saga.EditorTools
{
    // R-4(2026-10-09) — PlaytestHeadless.cs 1500줄 상한이라 큰 사건 점검 둘(75초 토벌·산신당 시련)과 보상 상수 읽기을 떼어 냄(같은 partial 클래스, 부르는 쪽 그대로).
    public static partial class PlaytestHeadless
    {
        /// <summary>PLAN.md 101-2 ③ "75초 토벌"(2026-09-19) — `RareWolfEncounter`에
        /// 건 raid 모드(`DuelRules.Raid`)를 두 사이클로 확인한다. 첫 사이클은
        /// 저스트 회피(0.25s 창 안=완전 회피+기 보너스, 밖="early")·예고 중
        /// 아무 것도 안 눌러도 절반만 맞는지(수동 mitigation)를 `DuelRules`의
        /// public 필드를 직접 조작해(Act/Step은 public이라 리플렉션 불필요)
        /// 결정적으로 본다. 두 번째 사이클은 `RareWolfEncounter.StartFight()`를
        /// 다시 불러 깨끗한 `_duel`을 받은 뒤, `Hp`를 75%·50%·25% 문턱 바로
        /// 위로 세팅하고 실제 `DoAct("quick")`(private, 버튼 클릭과 같은 경로)를
        /// 태워 부위 파괴 보상(골드)·완파 보너스까지 실제 배선을 확인한다.</summary>
        private static void CheckRaidBoss()
        {
            var rareWolf = Object.FindFirstObjectByType<RareWolfEncounter>();
            if (rareWolf == null)
            {
                Debug.LogError("[PlaytestHeadless] 75초 토벌 검증용 RareWolfEncounter를 못 찾음");
                _hadError = true;
                return;
            }

            var rwType = typeof(RareWolfEncounter);
            var startFight = rwType.GetMethod("StartFight", BindingFlags.NonPublic | BindingFlags.Instance);
            var duelField = rwType.GetField("_duel", BindingFlags.NonPublic | BindingFlags.Instance);
            var doAct = rwType.GetMethod("DoAct", BindingFlags.NonPublic | BindingFlags.Instance);

            // ---- 사이클 1: raid 플래그·저스트 회피·수동 mitigation ----
            startFight.Invoke(rareWolf, null);
            var duel = (DuelRules)duelField.GetValue(rareWolf);

            if (!duel.Raid || !Mathf.Approximately(duel.Left, DuelRules.RaidTimeSec))
            {
                Debug.LogError($"[PlaytestHeadless] 75초 토벌 — raid 모드가 안 켜짐(Raid={duel.Raid}, Left={duel.Left})");
                _hadError = true;
                return;
            }

            duel.Tell = DuelRules.JustWindowSec + 0.1f; // 저스트 창보다 이르다.
            var early = duel.Act("dodge");
            if (early.Ok || early.Reason != "early")
            {
                Debug.LogError($"[PlaytestHeadless] 75초 토벌 — 저스트 창 밖 회피가 실패(early)해야 하는데 Ok={early.Ok} Reason={early.Reason}");
                _hadError = true;
                return;
            }

            duel.Tell = DuelRules.JustWindowSec - 0.05f; // 저스트 창 안.
            var just = duel.Act("dodge");
            if (!just.Ok || !duel.Dodged)
            {
                Debug.LogError($"[PlaytestHeadless] 75초 토벌 — 저스트 창 안 회피가 실패함(Ok={just.Ok})");
                _hadError = true;
                return;
            }
            float kiBefore = duel.Ki;
            var justEvents = duel.Step(0.2f); // Tell을 0 밑으로 밀어 heavy 판정.
            var justHeavy = justEvents.Find(e => e.T == "heavy");
            float expectedKi = Mathf.Min(DuelRules.KiMax, kiBefore + DuelRules.KiMax * DuelRules.JustKiBonus * duel.KiMul);
            if (justHeavy.T != "heavy" || justHeavy.Dmg != 0f || !justHeavy.Dodged || !Mathf.Approximately(duel.Ki, expectedKi))
            {
                Debug.LogError($"[PlaytestHeadless] 75초 토벌 — 저스트 회피가 완전 회피+기 보너스로 안 이어짐(dmg={justHeavy.Dmg}, ki {kiBefore:F1}→{duel.Ki:F1}, 기대={expectedKi:F1})");
                _hadError = true;
                return;
            }

            duel.Tell = DuelRules.TellSec; // 새 예고 — 이번엔 아무 것도 안 누른다.
            var passiveEvents = duel.Step(DuelRules.TellSec + 0.05f);
            var passiveHeavy = passiveEvents.Find(e => e.T == "heavy");
            float expectedHeavy = Mathf.Round(duel.FoeAtk * DuelRules.HeavyMul * DuelRules.PassiveMitigation);
            if (passiveHeavy.T != "heavy" || passiveHeavy.Dodged || !Mathf.Approximately(passiveHeavy.Dmg, expectedHeavy))
            {
                Debug.LogError($"[PlaytestHeadless] 75초 토벌 — 예고 중 아무 것도 안 누르면 절반만 맞아야 하는데 dmg={passiveHeavy.Dmg}(기대 {expectedHeavy})");
                _hadError = true;
                return;
            }

            // ---- 사이클 2: 부위 파괴 보상 — 실제 DoAct("quick") 경로 ----
            startFight.Invoke(rareWolf, null); // 깨끗한 _duel로 다시.
            duel = (DuelRules)duelField.GetValue(rareWolf);
            int fullBreakBonusGold = (int)rwType.GetField("FullBreakBonusGold", BindingFlags.NonPublic | BindingFlags.Static).GetValue(null);
            float[] thresholds = { 0.75f, 0.50f, 0.25f };

            for (int i = 0; i < thresholds.Length; i++)
            {
                duel.Hp = duel.FoeHp * thresholds[i] + 2f; // 문턱 바로 위(margin은 quick 한 방 dmg보다 작아야 넘어간다).
                duel.Cd = 0f; // 이전 반복의 QuickCd가 남아 있으면 이번 quick이 "cd"로 조용히 실패한다.
                int goldBefore = GoldState.Gold;
                doAct.Invoke(rareWolf, new object[] { "quick" });
                int expectedGold = goldBefore + DuelRules.PartRewardGold + (i == thresholds.Length - 1 ? fullBreakBonusGold : 0);
                if (GoldState.Gold != expectedGold || !duel.PartBroken[i])
                {
                    Debug.LogError($"[PlaytestHeadless] 75초 토벌 — {i}번째 부위 파괴 보상 실패(gold {goldBefore}->{GoldState.Gold}, 기대 {expectedGold}, broken={duel.PartBroken[i]})");
                    _hadError = true;
                    return;
                }
            }

            Debug.Log($"[PlaytestHeadless] raid boss OK - raid 모드(75s)·저스트 회피(완전 회피+기)·수동 mitigation(절반)·부위 3 파괴 보상+완파 보너스 전부 확인");
        }

        /// <summary>PLAN.md 101-2 GO ② "사당 시련"(2026-09-20) — 파도 3을
        /// 공유 타이머로 잇는 OnWaveOver() 전환(클리어 시 남은 시간을 그대로
        /// 다음 파도로), 최종 클리어 보상·인장 조각 3개=인장 1(이정표
        /// 보너스), 실패 시 소지금 손실+10분 잠금, 잠금 중 재입장 차단까지
        /// 본다. ShrineTrialState 자체는 인카운터 없이도 조각→인장 산술을
        /// 먼저 단위로 확인한다(3회째 true, Stamps+1).</summary>
        private static void CheckShrineTrial()
        {
            int stampsBefore = ShrineTrialState.Stamps;
            bool r1 = ShrineTrialState.ReportClear();
            bool r2 = ShrineTrialState.ReportClear();
            bool r3 = ShrineTrialState.ReportClear();
            if (r1 || r2 || !r3 || ShrineTrialState.Stamps != stampsBefore + 1)
            {
                Debug.LogError($"[PlaytestHeadless] 사당 시련 — 조각 3개=인장 1 산술이 안 맞음(r1={r1} r2={r2} r3={r3}, stamps {stampsBefore}->{ShrineTrialState.Stamps})");
                _hadError = true;
                return;
            }

            var encounter = Object.FindFirstObjectByType<ShrineTrialEncounter>();
            if (encounter == null)
            {
                Debug.LogError("[PlaytestHeadless] 사당 시련 검증용 ShrineTrialEncounter를 못 찾음");
                _hadError = true;
                return;
            }

            var seType = typeof(ShrineTrialEncounter);
            var startTrial = seType.GetMethod("StartTrial", BindingFlags.NonPublic | BindingFlags.Instance);
            var onWaveOver = seType.GetMethod("OnWaveOver", BindingFlags.NonPublic | BindingFlags.Instance);
            var duelField = seType.GetField("_duel", BindingFlags.NonPublic | BindingFlags.Instance);
            var waveIndexField = seType.GetField("_waveIndex", BindingFlags.NonPublic | BindingFlags.Instance);

            if (!ShrineTrialState.CanEnter())
            {
                Debug.LogError("[PlaytestHeadless] 사당 시련 — 검증 시작 전인데 이미 못 들어가는 상태(잠금/일일 한도)");
                _hadError = true;
                return;
            }

            // ---- 진입 1: 파도 3 전부 클리어 → 시간 이월·최종 보상 ----
            startTrial.Invoke(encounter, null);
            long expBefore = PlayerStats.Exp;
            int levelBefore = PlayerStats.Level;
            int goldBefore = GoldState.Gold;

            for (int wave = 0; wave < 2; wave++)
            {
                var duel = (DuelRules)duelField.GetValue(encounter);
                duel.Cleared = true;
                float leftBefore = duel.Left;
                onWaveOver.Invoke(encounter, null);

                int waveIndexNow = (int)waveIndexField.GetValue(encounter);
                var nextDuel = (DuelRules)duelField.GetValue(encounter);
                if (waveIndexNow != wave + 1 || nextDuel == duel || !Mathf.Approximately(nextDuel.Left, leftBefore))
                {
                    Debug.LogError($"[PlaytestHeadless] 사당 시련 — 파도 {wave} 클리어가 다음 파도로 안 이어짐(waveIndex={waveIndexNow}, left {leftBefore}->{nextDuel.Left})");
                    _hadError = true;
                    return;
                }
            }

            // 마지막 파도(2) 클리어 — 시련 전체 종료.
            var finalDuel = (DuelRules)duelField.GetValue(encounter);
            finalDuel.Cleared = true;
            onWaveOver.Invoke(encounter, null);

            int waveIndexAfter = (int)waveIndexField.GetValue(encounter);
            bool visualActiveAfter = encounter.transform.Find("Visual").gameObject.activeSelf;
            // exp는 이 헤드리스 실행에서 이미 여러 체크가 레벨업 문턱 가까이
            // 올려놨을 수 있어(PlayerStats.Exp가 레벨업마다 랩어라운드된다,
            // PlayerStats.AddExp() 참고) 정확한 값 대신 "레벨업했거나 딱
            // ClearExpReward만큼 늘었거나"로 느슨하게 본다 — CheckBanditLootMarker
            // 등 기존 체크들도 같은 이유로 exp 정확값은 안 잰다. gold는 안
            // 랩되니 정확히 잰다.
            bool expOk = PlayerStats.Level > levelBefore || PlayerStats.Exp == expBefore + ClearExpConst(seType);
            if (waveIndexAfter != 0 || visualActiveAfter
                || !expOk
                || GoldState.Gold != goldBefore + ClearGoldConst(seType))
            {
                Debug.LogError($"[PlaytestHeadless] 사당 시련 — 최종 클리어 보상·정리가 기대와 다름(waveIndex={waveIndexAfter}, visual={visualActiveAfter}, exp {expBefore}->{PlayerStats.Exp}, gold {goldBefore}->{GoldState.Gold})");
                _hadError = true;
                return;
            }

            // ---- 진입 2: 실패(밀림) → 소지금 손실 + 10분 잠금 ----
            startTrial.Invoke(encounter, null);
            var failDuel = (DuelRules)duelField.GetValue(encounter);
            failDuel.Cleared = false;
            failDuel.Dealt = 5f; // "한 대도 못 때리고 물러난 것은 실패로 안 친다" 경계 밖(진짜 실패).
            int goldBeforeFail = GoldState.Gold;
            onWaveOver.Invoke(encounter, null);

            // GoldState.TrySpend는 부분 차감이 없다(모자라면 아예 0을 뺀다) — DropState.TryDrop과 다른 결.
            int expectedGoldAfterFail = goldBeforeFail >= FailGoldConst(seType) ? goldBeforeFail - FailGoldConst(seType) : goldBeforeFail;
            if (GoldState.Gold != expectedGoldAfterFail || !ShrineTrialState.IsLocked || ShrineTrialState.CanEnter())
            {
                Debug.LogError($"[PlaytestHeadless] 사당 시련 — 실패 비용·잠금이 기대와 다름(gold {goldBeforeFail}->{GoldState.Gold}, 기대 {expectedGoldAfterFail}, locked={ShrineTrialState.IsLocked}, canEnter={ShrineTrialState.CanEnter()})");
                _hadError = true;
                return;
            }

            Debug.Log("[PlaytestHeadless] shrine trial OK - 조각3=인장1, 파도 3 시간 이월, 최종 클리어 보상, 실패 비용+10분 잠금(재입장 차단) 전부 확인");
        }

        private static int ClearExpConst(System.Type t) => (int)t.GetField("ClearExpReward", BindingFlags.NonPublic | BindingFlags.Static).GetValue(null);
        private static int ClearGoldConst(System.Type t) => (int)t.GetField("ClearGoldReward", BindingFlags.NonPublic | BindingFlags.Static).GetValue(null);
        private static int FailGoldConst(System.Type t) => (int)t.GetField("FailGoldCost", BindingFlags.NonPublic | BindingFlags.Static).GetValue(null);
    }
}
