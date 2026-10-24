using System;
using UnityEngine;
using Saga.Story.Data;
using Saga.Story.World;

namespace Saga.EditorTools
{
    /// <summary>
    /// tasks U-0207 4종횡 콤보 킬(고돗 G-0345 짝) 진단 — `PlaytestStorySlice` 준비 단계 끝(문파 뒤)이 부른다(한 프레임 안, 시각은 OnKill 에 직접 · 구슬 걸음은 Step 으로).
    /// ① 셈(5초 안 이어짐 · 3부터 글 하나 · 글 낱말) ② 끊김(5초 넘으면 1부터, 글 없음) ③ 구슬(10마다 · 3.5m 밖 그대로 · 안 10m/s · 0.8m 먹기 = 경험 · 20초 수명)
    /// ④ 배율(3 + n/10 최대 8 · 잡졸 경험 × 회차 · 글 색 층) ⑤ 최고(끊겨도 남음 · 저장 안 함) ⑥ SAGA_COMBO_KILL=0. 끝나면 셈·구슬·레벨·경험·회차를 시작 때로.
    /// </summary>
    public static class PlaytestStoryComboKill
    {
        private const string T = "[PlaytestStorySlice] combo";
        private static bool _ok, _step;

        public static bool Run()
        {
            _ok = true;
            int lv0 = StoryJobState.Level; float exp0 = StoryJobState.Exp; string job0 = StoryJobState.Job;
            int round0 = StoryRound.Round, bk0 = StoryRound.BaseKills, br0 = StoryRound.BaseRifts;
            string env0 = Environment.GetEnvironmentVariable("SAGA_COMBO_KILL");
            string save0 = PlayerPrefs.HasKey("saga_story_combo_best") ? "x" : "";
            Vector3 at = new Vector3(500f, 0f, 500f); // 들판 밖 — 진짜 플레이어와 겹치지 않게(Step 에 자리를 직접 준다)
            try
            {
                Environment.SetEnvironmentVariable("SAGA_COMBO_KILL", null);
                StoryComboKill.ResetForTest();
                float t = 1000f;

                // ① 셈
                Begin();
                int c1 = StoryComboKill.OnKill(at, t);
                int c2 = StoryComboKill.OnKill(at, t += 2f);
                if (c1 != 1 || c2 != 2 || StoryComboKill.Label != null) Fail($"1·2 {c1}·{c2}·글 {StoryComboKill.Label != null}");
                int c3 = StoryComboKill.OnKill(at, t += 4.9f);
                var l3 = StoryComboKill.Label;
                var tm3 = l3 != null ? l3.GetComponent<TMPro.TextMeshPro>() : null;
                if (c3 != 3 || tm3 == null || !tm3.text.Contains("3")) Fail($"4.9초 뒤 {c3}·글 {(tm3 != null ? tm3.text : "없음")}");
                StoryComboKill.OnKill(at, t += 0.1f);
                if (CountLabels() != 1) Fail($"콤보 글 {CountLabels()} 개(늘 하나)");
                End($"count OK - 1·2 글 없음 · 4.9초 뒤 3 「{tm3?.text}」 · 4 에서 글 {CountLabels()} 개");

                // ② 끊김
                Begin();
                int cb = StoryComboKill.OnKill(at, t += 5.1f);
                if (cb != 1 || StoryComboKill.Best != 4) Fail($"5.1초 뒤 {cb}·최고 {StoryComboKill.Best}");
                End($"break OK - 5.1초 뒤 {cb} 부터 · 최고 {StoryComboKill.Best} 그대로");

                // ③ 구슬
                Begin();
                StoryRound.Restore(1, bk0, br0, bk0 >= 0);
                for (int i = 2; i <= 9; i++) StoryComboKill.OnKill(at, t += 0.2f);
                if (StoryComboKill.Orbs != 0) Fail($"9 에 구슬 {StoryComboKill.Orbs}");
                StoryComboKill.OnKill(at, t += 0.2f);
                if (StoryComboKill.Count != 10 || StoryComboKill.Orbs != 1 || StoryComboKill.Active.Count != 1) Fail($"10 에 구슬 {StoryComboKill.Orbs}·살아 {StoryComboKill.Active.Count}");
                var o = StoryComboKill.Active[0];
                Vector3 o0 = o.transform.position;
                o.Step(0.1f, o0 + Vector3.right * 4f);
                if (Vector3.Distance(o.transform.position, o0) > 0.001f) Fail("4m 인데 끌림");
                o.Step(0.1f, o0 + Vector3.right * 3f);
                float moved = o.transform.position.x - o0.x;
                if (Mathf.Abs(moved - 1f) > 0.01f || StoryComboKill.Eaten != 0) Fail($"3m 에서 0.1초 {moved:0.00}m");
                StoryJobState.Restore(lv0, 0f, job0);
                float want = StoryCombat.GruntExp * 4f * StoryGuild.ExpMul;
                o.Step(0.02f, o.transform.position + Vector3.right * 0.6f);
                float gotExp = StoryJobState.Exp;
                bool lvUp = StoryJobState.Level != lv0;
                if (!o.Gone || StoryComboKill.Eaten != 1) Fail($"안 먹음(남음 {!o.Gone}·먹음 {StoryComboKill.Eaten})");
                if (!lvUp && Mathf.Abs(gotExp - want) > 0.01f) Fail($"경험 {gotExp} ≠ {want}");
                for (int i = 11; i <= 20; i++) StoryComboKill.OnKill(at, t += 0.2f);
                var o2 = StoryComboKill.Active.Count == 1 ? StoryComboKill.Active[0] : null;
                if (o2 == null) Fail("20 에 구슬 없음");
                else
                {
                    o2.Step(19.9f, null);
                    if (o2.Gone) Fail("20초 전에 사라짐");
                    o2.Step(0.2f, null);
                    if (!o2.Gone) Fail("20초 뒤 남음");
                }
                End($"orb OK - 9 없음·10 하나 · 4m 그대로 · 3m 에서 0.1초 {moved:0.00}m(10m/s) · 0.8m 먹음 EXP +{(lvUp ? "레벨업" : gotExp.ToString("0"))}(잡졸 10×4) · 20초 사라짐");

                // ④ 배율
                Begin();
                if (StoryComboKill.OrbMul(10) != 4 || StoryComboKill.OrbMul(20) != 5 || StoryComboKill.OrbMul(50) != 8 || StoryComboKill.OrbMul(90) != 8) Fail("배율 3+n/10 최대 8 아님");
                StoryRound.Restore(3, bk0, br0, bk0 >= 0);
                float r3 = StoryComboKill.OrbExp(30);
                if (Mathf.Abs(r3 - StoryCombat.GruntExp * 6f * StoryRound.GainMul(3)) > 0.01f || StoryRound.GainMul(3) <= 1f) Fail($"3회차 30콤보 {r3}");
                StoryRound.Restore(round0, bk0, br0, bk0 >= 0);
                if (StoryComboKill.TierOf(3) == StoryComboKill.TierOf(10) || StoryComboKill.TierOf(10) == StoryComboKill.TierOf(30) || StoryComboKill.TierOf(30) == StoryComboKill.TierOf(50)) Fail("글 색 층 아님");
                End($"mul OK - 10×4·20×5·50×8·90×8 · 3회차 30콤보 {r3:0.#}(잡졸 10×6×{StoryRound.GainMul(3):0.##}) · 3·10·30·50 색 넷");

                // ⑤ 최고
                Begin();
                int best = StoryComboKill.Best;
                StoryComboKill.OnKill(at, t += 6f);
                if (best != 20 || StoryComboKill.Best != 20 || StoryComboKill.Count != 1) Fail($"최고 {best}→{StoryComboKill.Best}·지금 {StoryComboKill.Count}");
                if ((PlayerPrefs.HasKey("saga_story_combo_best") ? "x" : "") != save0) Fail("최고 기록을 저장함");
                End($"best OK - 끊겨도 최고 {StoryComboKill.Best} · 저장 안 함");

                // ⑥ 손잡이
                Begin();
                StoryComboKill.ResetForTest();
                Environment.SetEnvironmentVariable("SAGA_COMBO_KILL", "0");
                int off = 0;
                for (int i = 0; i < 12; i++) off += StoryComboKill.OnKill(at, t += 0.1f);
                if (off != 0 || StoryComboKill.Count != 0 || StoryComboKill.Orbs != 0 || StoryComboKill.Label != null) Fail("SAGA_COMBO_KILL=0 인데 셈·글·구슬");
                End("off OK - SAGA_COMBO_KILL=0 이면 열둘 잡아도 셈·글·구슬 없음");
            }
            finally
            {
                Environment.SetEnvironmentVariable("SAGA_COMBO_KILL", env0);
                StoryComboKill.ResetForTest();
                StoryRound.Restore(round0, bk0, br0, bk0 >= 0);
                StoryJobState.Restore(lv0, exp0, job0);
            }
            return _ok;
        }

        private static int CountLabels()
        {
            int n = 0;
            foreach (var go in UnityEngine.Object.FindObjectsByType<TMPro.TextMeshPro>(FindObjectsSortMode.None))
                if (go.gameObject.name == "ComboKillLabel" && go != null) n++;
            return n;
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
