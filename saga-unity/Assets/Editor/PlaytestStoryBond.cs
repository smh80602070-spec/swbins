using System;
using UnityEngine;
using Saga.Core;
using Saga.Story.Data;

namespace Saga.EditorTools
{
    /// <summary>
    /// tasks U-0208 4종횡 동료 우정(1만리 U-0199·2나락 U-0201 짝 — 공용 셈 <see cref="Friendship"/>) 진단 — `PlaytestStorySlice` 준비 단계 끝(문파·콤보 뒤)이 부른다(한 프레임 안).
    /// ① 처치 +1·두목 +10(나와 있는 동료만) ② 교대 +2(새로 나온 동료) ③ 단 오름 알림·기질 줄(선봉 무·유격 지·호법 덕)
    /// ④ 지기 처음 공격 ×1.05(나와 있을 때만·유지·배율 지기 전 그대로) + `SAGA_STORY_BOND=0` ⑤ HUD 꼬리표 ⑥ 세이브 칸·왕복·옛 세이브.
    /// 끝나면 우정·나와 있는 동료(쿨 0)·손잡이를 시작 때로.
    /// </summary>
    public static class PlaytestStoryBond
    {
        private const string T = "[PlaytestStorySlice] sbond";
        private static bool _ok, _step;

        public static bool Run()
        {
            _ok = true;
            string bond0 = StoryBond.Snapshot();
            int active0 = StoryPartyState.ActiveIndex;
            string env0 = Environment.GetEnvironmentVariable("SAGA_STORY_BOND");
            try
            {
                Environment.SetEnvironmentVariable("SAGA_STORY_BOND", null);
                StoryBond.On = true;
                StoryBond.ResetForTest();

                // ① 처치
                Begin();
                StoryPartyState.Restore(0);
                if (StoryBond.Tag(0).Length != 0) Fail("0점인데 꼬리표");
                string k1 = "";
                for (int i = 0; i < 9; i++) k1 = StoryBond.OnKill(false);
                if (StoryBond.Pts(0) != 9f || k1.Length != 0) Fail($"잡졸 아홉 {StoryBond.Pts(0)} · 알림「{k1}」");
                string kb = StoryBond.OnKill(true);
                if (StoryBond.Pts(0) != 19f || StoryBond.Pts(1) != 0f || StoryBond.Pts(2) != 0f) Fail($"두목 {StoryBond.Pts(0)}·{StoryBond.Pts(1)}·{StoryBond.Pts(2)}");
                string k20 = StoryBond.OnKill(false);
                if (StoryBond.Level(0) != 1 || !k20.Contains("Lv.1")) Fail($"스물째 Lv {StoryBond.Level(0)} · 알림「{k20}」");
                End($"kill OK - 잡졸 +1 · 두목 +10 · 나와 있는 선봉만 · Lv.1 알림「{k20}」");

                // ② 교대
                Begin();
                StoryPartyState.Restore(0);
                if (!StoryPartyState.TrySwap(1)) Fail("교대 안 됨");
                string s1 = StoryBond.OnSwap();
                if (StoryBond.Pts(1) != StoryBond.SwapPts || StoryBond.Pts(0) != 20f || s1.Length != 0) Fail($"교대 유격 {StoryBond.Pts(1)} · 선봉 {StoryBond.Pts(0)}");
                if (StoryPartyState.TrySwap(2)) Fail("쿨 중인데 교대");
                if (StoryPartyState.CooldownLeft != StoryPartyState.SwapCooldownSec) Fail($"쿨 {StoryPartyState.CooldownLeft}");
                StoryBond.OnKill(false);
                if (StoryBond.Pts(1) != 3f) Fail($"유격 처치 {StoryBond.Pts(1)}");
                StoryBond.ForgetKillForTest();
                StoryBond.OnSwap();
                if (StoryBond.Pts(1) != 3f) Fail($"싸움 밖 교대인데 점수 {StoryBond.Pts(1)}");
                End($"swap OK - 교대 +{StoryBond.SwapPts}(새로 나온 유격) · 쿨 {StoryPartyState.SwapCooldownSec:0}초 그대로 · 처치는 나와 있는 쪽 · 싸움 밖(처치 {StoryBond.SwapFightSec:0}초 넘음) 교대는 0");

                // ③ 단·기질
                Begin();
                float[] pts = { 0, 19, 20, 50, 89, 650, 9999 };
                int[] lv = { 0, 0, 1, 2, 2, 10, 10 };
                for (int i = 0; i < pts.Length; i++) if (Friendship.LevelOf(pts[i]) != lv[i]) Fail($"{pts[i]}점 = Lv {Friendship.LevelOf(pts[i])}");
                StoryPartyState.Restore(2);
                string g = "";
                while (StoryBond.Level(2) < 3) { string u = StoryBond.OnKill(true); if (u.Length > 0) g = u; }
                string virtue1 = StoryLocalization.T("sbond.line.virtue1", Friendship.LinesKo[3][1]);
                string might0 = StoryLocalization.T("sbond.line.might0", Friendship.LinesKo[0][0]);
                if (!g.Contains("Lv.3") || !g.Contains(virtue1)) Fail($"호법 Lv.3 알림「{g}」");
                if (StoryBond.Line(0) != might0) Fail($"선봉 줄「{StoryBond.Line(0)}」");
                if (StoryBond.Line(1) == StoryBond.Line(0)) Fail("유격 = 선봉 줄");
                End($"tier OK - 20·50 경계 · Lv 10 상한 · 기질 무·지·덕 · 「{g}」");

                // ④ 지기 곱 + 손잡이
                Begin();
                StoryPartyState.Restore(0);
                float base0 = StoryPartyState.Roster[0].AtkMultiplier, base1 = StoryPartyState.Roster[1].AtkMultiplier;
                if (Mathf.Abs(StoryPartyState.AtkMultiplier - base0) > 1e-4f) Fail("지기 전인데 곱");
                string knot = "";
                while (StoryBond.Level(0) < 9) { string u = StoryBond.OnKill(true); if (u.Length > 0) knot = u; }
                if (!StoryBond.Knot(0) || !knot.Contains("1.05")) Fail($"지기 알림「{knot}」");
                if (Mathf.Abs(StoryPartyState.AtkMultiplier - base0 * StoryBond.KnotAtkMul) > 1e-4f) Fail($"지기 곱 {StoryPartyState.AtkMultiplier}");
                while (StoryBond.Level(0) < 10) StoryBond.OnKill(true);
                StoryPartyState.Restore(1);
                if (Mathf.Abs(StoryPartyState.AtkMultiplier - base1) > 1e-4f) Fail($"유격(지기 아님) 곱 {StoryPartyState.AtkMultiplier}");
                StoryPartyState.Restore(0);
                Environment.SetEnvironmentVariable("SAGA_STORY_BOND", "0");
                float p2 = StoryBond.Pts(2);
                string offUp = StoryBond.OnKill(true) + StoryBond.OnSwap();
                bool offOk = Mathf.Abs(StoryPartyState.AtkMultiplier - base0) < 1e-4f && StoryBond.Tag(0).Length == 0 && offUp.Length == 0;
                float p0off = StoryBond.Pts(0);
                StoryBond.OnKill(false);
                if (!offOk || StoryBond.Pts(0) != p0off || StoryBond.Pts(2) != p2) Fail("SAGA_STORY_BOND=0 인데 곱·꼬리표·점수");
                Environment.SetEnvironmentVariable("SAGA_STORY_BOND", null);
                if (Mathf.Abs(StoryPartyState.AtkMultiplier - base0 * StoryBond.KnotAtkMul) > 1e-4f) Fail("다시 켜니 지기 곱 사라짐");
                End($"knot OK - 지기 처음 나와 있을 때 공격 ×{StoryBond.KnotAtkMul:0.00}(유지 · 다른 동료 ×{base1:0.00} 그대로) · 「{knot}」 · off OK - SAGA_STORY_BOND=0 이면 점수·꼬리표·곱 없음");

                // ⑤ 꼬리표
                Begin();
                string tag0 = StoryBond.Tag(0), tag2 = StoryBond.Tag(2), tag1 = StoryBond.Tag(1);
                if (tag0 != " 💞10" || tag2 != " 😊3" || tag1.Length != 0) Fail($"꼬리표「{tag0}」「{tag2}」「{tag1}」");
                End($"hud OK - 선봉「{tag0}」 · 호법「{tag2}」 · 유격 Lv0 빈 글");

                // ⑥ 세이브
                Begin();
                StoryBond.ResetForTest();
                StoryPartyState.Restore(1);
                StoryBond.OnKill(true);
                string snap = StoryBond.Snapshot();
                if (!StorySaveState.ToJson().Contains("\"bondJson\"")) Fail("세이브에 bondJson 없음");
                StoryBond.Restore(null);
                if (StoryBond.Pts(1) != 0f) Fail("옛 세이브인데 점수");
                StoryBond.Restore(snap);
                if (StoryBond.Pts(1) != 10f) Fail("왕복");
                StoryBond.Restore("{\"pts\":[5,5],\"knot\":[false,false]}");
                if (StoryBond.Pts(0) != 0f) Fail("길이 틀린 세이브를 받음");
                End("save OK - bondJson 왕복·옛 세이브 0·길이 틀리면 버림");
            }
            finally
            {
                Environment.SetEnvironmentVariable("SAGA_STORY_BOND", env0);
                StoryBond.On = true;
                StoryBond.Restore(bond0);
                StoryPartyState.Restore(active0);
            }
            return _ok;
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
