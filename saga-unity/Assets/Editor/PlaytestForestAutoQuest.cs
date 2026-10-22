using System.Reflection;
using UnityEngine;
using Saga.Core;
using Saga.Forest.Data;
using Saga.Forest.Player;
using Saga.Forest.UI;
using Saga.Forest.World;

namespace Saga.EditorTools
{
    /// <summary>
    /// tasks U-0166 3마을 자동 퀘스트 진단 — `PlaytestForestHeadless` 가 시나리오 진단 뒤에 부른다(한 프레임 안, 시간·접수대·우체통 Update 는 손으로 넣는다).
    /// 이야기를 끈 채 소포를 하나 들려 접수대 곁에서 켜면 그 구역 우체통까지 걸어가 배달(배달 수 +1) · 걸음 종류 표(talk·forest·go·deliver·place) ·
    /// 목표 자리(forest = 구역 가운데 · deliver = 소포 없으면 접수대) · 손 조작 = 멈춤 · ▶ 단추. 끝나면 택배·과일·이야기·자리를 시작 때로.
    /// </summary>
    public static class PlaytestForestAutoQuest
    {
        private const string T = "[PlaytestForestHeadless] autoquest";
        private const BindingFlags PI = BindingFlags.Instance | BindingFlags.NonPublic;
        private static bool _ok;

        public static bool Run()
        {
            _ok = true;
            var aq = ForestAutoQuest.Instance;
            var pc = Object.FindFirstObjectByType<PlayerController>();
            var counter = Object.FindFirstObjectByType<ForestDeliveryCounter>();
            var boxes = Object.FindObjectsByType<ForestDeliveryMailbox>(FindObjectsSortMode.None);
            if (aq == null || pc == null || counter == null || boxes.Length == 0) { Fail("ForestAutoQuest·플레이어·접수대·우체통 없음"); return false; }
            Vector3 pos0 = pc.transform.position;
            bool enabled0 = ForestScenario.Enabled;
            int delivered0 = ForestDeliveryState.Snapshot(), fruit0 = ForestState.FruitCount;
            string m = "";
            try
            {
                AutoQuestHud.WatchOffForTest = true;
                // 걸음 종류 표
                string kinds = ForestAutoQuest.KindOf(new ForestScenarioData.Step { T = "talk" }) + ForestAutoQuest.KindOf(new ForestScenarioData.Step { T = "forest" })
                    + ForestAutoQuest.KindOf(new ForestScenarioData.Step { T = "go" }) + ForestAutoQuest.KindOf(new ForestScenarioData.Step { T = "deliver" })
                    + ForestAutoQuest.KindOf(new ForestScenarioData.Step { T = "place" });
                if (kinds != "talkgomeetdelivermanual") Fail("걸음 종류 " + kinds);

                // 이야기 끔 · 소포 없음 = 목표 없음
                ForestScenario.Enabled = false;
                ForestDeliveryState.Restore(delivered0);
                if (aq.First() != null) Fail("소포 없는데 목표 있음");
                // 소포 하나(보통) — 접수대 곁에서
                int target = 0;
                ForestDeliveryState.TryPickup(ForestDeliveryState.Kind.Normal, target);
                Vector3 mail = ForestDeliveryMailbox.PositionOf(target);
                pc.Teleport(counter.transform.position + new Vector3(2f, 0.3f, 0f));
                Physics.SyncTransforms();
                var g = aq.First();
                if (g == null || g.Type != "deliver" || g.At == null || (g.At.Value - mail).sqrMagnitude > 0.01f) Fail($"배달 목표 {g?.Id}·{g?.At} ≠ 우체통 {mail}");
                float d0 = Flat(pc.transform.position - mail), dMin = d0;
                if (!aq.Q.Start()) Fail("켜기 " + aq.Q.Why);
                var upd = typeof(ForestDeliveryMailbox).GetMethod("Update", PI);
                int steps = 0;
                for (; steps < 2400 && aq.Q.On && ForestDeliveryState.DeliveredCount == delivered0; steps++)
                {
                    aq.Step(0.05f);
                    pc.Step(0.05f);
                    foreach (var b in boxes) upd?.Invoke(b, null);
                    dMin = Mathf.Min(dMin, Flat(pc.transform.position - mail));
                }
                if (ForestDeliveryState.DeliveredCount != delivered0 + 1)
                    Fail($"배달 안 됨({steps} 걸음, {d0:0.0}→{dMin:0.0}m · {aq.Q.Why}·{aq.Q.Doing}·{string.Join(" ", aq.Q.Log)})");
                m += $" 걸음 {steps}·우체통 {d0:0}→{dMin:0.0}m·배달 +{ForestDeliveryState.DeliveredCount - delivered0}";
                aq.Q.Stop("진단");

                // 이야기 켜 둔 채 지금 걸음 목표가 종류대로 자리를 갖는가(다 본 세이브면 건너뜀)
                ForestScenario.Enabled = enabled0;
                var step = ForestScenario.CurrentStep();
                if (step != null)
                {
                    var sg = aq.First();
                    string k = ForestAutoQuest.KindOf(step);
                    if (sg == null || (k == "go" && sg.At == null)) Fail($"이야기 걸음 {step.T} 목표 {sg?.Id}·{sg?.At}");
                    m += $" · 이야기 걸음 {step.T}→{k}";
                }
                ForestScenario.Enabled = false;

                // 손 조작 — 소포 하나 더 들려 켠다
                ForestDeliveryState.TryPickup(ForestDeliveryState.Kind.Normal, target);
                aq.Q.Start();
                aq.FakeHandInputForTest = true;
                aq.Step(0.05f);
                if (aq.Q.On || aq.Q.Why != AutoQuestHud.HandWhy) Fail($"손 조작 멈춤 {aq.Q.On}·{aq.Q.Why}");
                // ▶ 단추
                if (aq.PlayButton == null) Fail("▶ 단추 없음");
                else
                {
                    aq.PlayButton.onClick.Invoke();
                    bool on = aq.Q.On;
                    aq.PlayButton.onClick.Invoke();
                    if (!on || aq.Q.On) Fail("▶ 단추 켜고 끄기");
                }
            }
            finally
            {
                if (aq.Q.On) aq.Q.Stop("진단 끝");
                pc.ClearTestInput();
                AutoQuestHud.WatchOffForTest = false;
                ForestScenario.Enabled = enabled0;
                ForestDeliveryState.Restore(delivered0);
                ForestState.Restore(fruit0);
                pc.Teleport(pos0);
            }
            if (_ok) Debug.Log($"{T} OK - 3마을(걸음 종류 표·소포 없음 = 목표 없음·우체통까지 걸어가 배달·이야기 걸음 자리·손 조작·▶) |{m}");
            return _ok;
        }

        private static float Flat(Vector3 v) { v.y = 0f; return v.magnitude; }

        private static void Fail(string why)
        {
            _ok = false;
            Debug.LogError($"{T} FAIL - {why}");
        }
    }
}
