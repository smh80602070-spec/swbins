using System.Collections.Generic;
using System.Linq;
using UnityEngine;
using Saga.Go.Data;
using Saga.Go.World;

namespace Saga.EditorTools
{
    /// <summary>
    /// tasks U-0227 ② 들판 수수께끼 진단 — `PlaytestHeadless` 끝 무렵(한 프레임 안).
    /// ① 후보 자리 결정적·구역 안 ② 구역 4 에 셋(돌·꽃·바람개비) ③ 돌 다가가면 풀림·씨앗 +1 ④ 꽃 8초 넘기면 처음부터·차례대로면 풀림
    /// ⑤ 바람개비 반대편은 안 돎·바람 쪽 1.2초면 돎 ⑥ 같은 자리 두 번 안 줌 ⑦ 다섯째 씨앗에 숲 정령 금 300 ⑧ 저장 왕복 ⑨ 끔이면 안 지음.
    /// 끝나면 세이브 JSON 을 시작 때로.
    /// </summary>
    public static class PlaytestGoRiddle
    {
        private const string T = "[PlaytestHeadless] riddle";

        public static bool Run()
        {
            bool ok = true;
            void Fail(string why) { ok = false; Debug.LogError($"{T} FAIL - {why}"); }
            var field = RiddleField.Instance;
            if (field == null) { Debug.LogError($"{T} FAIL - RiddleField 없음"); return false; }
            string json0 = SaveState.ToJson();
            bool on0 = GoRiddle.On;
            try
            {
                GoRiddle.On = true;
                WorldEventState.Restore(WorldEventState.TriggeredIds.Where(id => !id.StartsWith("riddle_")).ToList());
                // ① 후보
                var rc = GoZones.RectOf(4);
                var a = GoRiddle.Candidate(rc, 4, 1, 0, out float da);
                var b = GoRiddle.Candidate(rc, 4, 1, 0, out float db);
                if (a != b || da != db || !rc.Contains(new Vector2(a.x, a.z))) Fail($"후보가 결정적이 아니거나 구역 밖 {a}");

                // ② 짓기
                field.Build(4);
                var kinds = field.Spots.Select(s => s.Kind).ToList();
                if (field.Spots.Count < 3) Fail($"구역 4 수수께끼 {field.Spots.Count}(셋 기대 — 자리 못 찾음?)");
                if (ok) Debug.Log($"{T} build OK - 구역 4 에 {string.Join("·", kinds)} · 자리 {string.Join(" ", field.Spots.Select(s => $"({s.Pos.x:0},{s.Pos.z:0})"))}");

                var rock = field.Spots.FirstOrDefault(s => s.Kind == GoRiddle.Kind.Rock);
                var flw = field.Spots.FirstOrDefault(s => s.Kind == GoRiddle.Kind.Flowers);
                var pin = field.Spots.FirstOrDefault(s => s.Kind == GoRiddle.Kind.Pinwheel);
                Vector3 far = new Vector3(rc.center.x, 0f, rc.yMax - 2f);
                // ③ 돌
                if (rock != null)
                {
                    int s0 = GoRiddle.Seeds;
                    field.Step(far, 0f);
                    field.Step(rock.Pos + new Vector3(1f, 0f, 0f), 0f);
                    if (!rock.Solved || GoRiddle.Seeds != s0 + 1 || !GoRiddle.Solved(4, rock.K)) Fail($"돌 들추기 안 됨 solved={rock.Solved} 씨앗 {s0}→{GoRiddle.Seeds}");
                    else Debug.Log($"{T} rock OK - 1m 다가가니 들춰짐 · 씨앗 {GoRiddle.Seeds}");
                }
                // ④ 꽃
                if (flw != null)
                {
                    field.Step(GoRiddle.FlowerPos(flw.Pos, 0), 0f);
                    field.Step(far, 1f);
                    field.Step(GoRiddle.FlowerPos(flw.Pos, 1), 9.5f); // 8초 넘김 → 처음부터
                    if (flw.Next != 0 || flw.Solved) Fail($"8초 넘겼는데 다음 꽃 {flw.Next}");
                    for (int i = 0; i < GoRiddle.Flowers; i++) { field.Step(far, 10f + i); field.Step(GoRiddle.FlowerPos(flw.Pos, i), 10.5f + i); }
                    if (!flw.Solved) Fail($"차례대로 밟았는데 안 풀림(다음 {flw.Next})");
                    else Debug.Log($"{T} flowers OK - 8초 넘기면 처음부터 · 다섯 차례대로 풀림");
                }
                // ⑤ 바람개비
                if (pin != null)
                {
                    float r = pin.Dir * Mathf.Deg2Rad;
                    var wind = pin.Pos + new Vector3(Mathf.Sin(r), 0f, Mathf.Cos(r)) * 3.5f;
                    var back = pin.Pos - new Vector3(Mathf.Sin(r), 0f, Mathf.Cos(r)) * 3.5f;
                    field.HoldWind(pin, back, 2f);
                    if (pin.Solved) Fail("반대편에 섰는데 돎");
                    field.HoldWind(pin, wind, 0.7f); field.HoldWind(pin, wind, 0.7f);
                    if (!pin.Solved) Fail("바람 쪽 1.4초 섰는데 안 돎");
                    else Debug.Log($"{T} pinwheel OK - 반대편 안 돎 · 바람 쪽 1.2초 돎");
                }
                // ⑥ 두 번
                if (rock != null && GoRiddle.Solve(4, rock.K, out _)) Fail("같은 돌을 두 번 셈");
                // ⑦ 다섯째 — 씨앗을 넷으로 맞춘 뒤 하나 더
                var ids = WorldEventState.TriggeredIds.Where(id => !id.StartsWith("riddle_")).ToList();
                ids.AddRange(new[] { "riddle_9_0", "riddle_9_1", "riddle_9_2", "riddle_10_0" });
                WorldEventState.Restore(ids);
                int gold0 = GoldState.Gold;
                GoRiddle.Solve(10, 1, out var reward);
                if (GoRiddle.Seeds != 5 || reward == null || GoldState.Gold != gold0 + 300) Fail($"다섯째 씨앗 보상 {reward}·금 +{GoldState.Gold - gold0}");
                else Debug.Log($"{T} milestone OK - 씨앗 5 → {reward}");
                // ⑧ 저장 왕복
                string js = SaveState.ToJson();
                WorldEventState.Restore(new List<string>());
                SaveState.ApplyJson(js);
                if (GoRiddle.Seeds != 5 || !WorldEventState.IsTriggered("riddle_reward_5")) Fail($"저장 왕복 뒤 씨앗 {GoRiddle.Seeds}");
                // ⑨ 끔
                GoRiddle.On = false;
                field.Build(4);
                if (field.Spots.Count != 0) Fail("끔인데 지음");
                if (ok) Debug.Log($"{T} save/off OK - 저장 왕복 씨앗 5·보상 받음 기록 · 끔이면 안 지음");
            }
            finally
            {
                GoRiddle.On = on0;
                SaveState.ApplyJson(json0);
                field.Build(-1);
            }
            return ok;
        }
    }
}
