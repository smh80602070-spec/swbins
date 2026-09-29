using System.Collections.Generic;
using UnityEngine;
using Saga.Go.Combat;
using Saga.Go.Data;
using Saga.Go.Player;
using Saga.Go.World;

namespace Saga.EditorTools
{
    /// <summary>
    /// PLAN.md 109-14-52 8부 무대 여섯 매듭·먹구름 눈: 매듭 여섯 자리(1부 여섯 제단 곁)·26장 뒤부터 보임·풀린 연기/묶인 불·금빛 줄 세 모드(위로·눈 등불로·거둠) ·
    /// 눈(구름섬 서쪽 판 — 층·윗면·구름섬과 안 겹침)·28장 9째 단계부터·소용돌이/맑은 뜰·구름섬 서쪽 바람 기둥(29장부터)·활공 거리.
    /// 27~29장이 아직 없어 `GoStory.TestCh/TestStep` 으로 장·단계를 가정한다.
    /// </summary>
    public static class PlaytestGoKnots
    {
        private static bool _ok;

        public static bool Run(string tag)
        {
            _ok = true;
            var kf = KnotField.Instance;
            var fc = FieldCombat.Instance;
            if (kf == null || fc == null) { Fail("KnotField/FieldCombat 없음"); return false; }
            int ch0 = StoryState.Ch, st0 = StoryState.StepIndex;
            bool off0 = StoryState.OffForTest;
            try
            {
                StoryState.OffForTest = false;
                // 자리 — 여섯이 서로 다르고 제 제단 곁(3m 북쪽)
                var bases = new List<Vector3>();
                for (int k = 0; k < 6; k++) bases.Add(GoStory.KnotBase(k));
                for (int i = 0; i < 6; i++)
                    for (int j = i + 1; j < 6; j++)
                        if (GoStory.Flat(bases[i], bases[j]) < 5f) Fail($"매듭 {i}·{j} 자리가 겹침");
                if (GoStory.Flat(bases[1], GoStory.GridPos(GoStory.Altar2Gx, GoStory.Altar2Gy) + new Vector3(0f, 0f, -GoStory.KnotNorth)) > 0.01f) Fail("둘째 매듭이 둘째 제단 북쪽이 아님");
                if (GoStory.Flat(bases[4], GoStory.IslePos(Vector2.zero)) > GoStory.KnotNorth + 0.1f) Fail("다섯째 매듭이 바위섬 위가 아님");
                if (!GoStory.OnSkyTop(bases[5] + Vector3.up * 0.3f) && GoStory.Flat(bases[5], GoStory.SkyCenter) > GoStory.KnotNorth + 0.1f) Fail("여섯째 매듭이 구름섬 위가 아님");

                // 26장 끝나기 전엔 안 보인다
                GoStory.TestCh = 25; GoStory.TestStep = 0;
                kf.Refresh();
                for (int k = 0; k < 6; k++) if (kf.KnotShown(k)) Fail("26장 앞인데 매듭이 보임");
                // 27장 시작 — 여섯 다 풀린 먹구름 연기
                GoStory.TestCh = 26; GoStory.TestStep = 0;
                kf.Refresh();
                for (int k = 0; k < 6; k++)
                    if (!kf.KnotShown(k) || !kf.SmokeShown(k) || kf.FireShown(k) || kf.BeamNow(k) != 0) Fail($"27장 시작: 매듭 {k} 이 연기(풀림)가 아님");
                // 묶임 표 — 27장 4·5·8째 단계, 28장 3·5·8째 단계부터
                var tie = new[] { (26, 3), (26, 4), (26, 5), (26, 8), (27, 2), (27, 3), (27, 5), (27, 8) };
                foreach (var (c, s) in tie)
                {
                    GoStory.TestCh = c; GoStory.TestStep = s;
                    kf.Refresh();
                    int tied = 0;
                    for (int j = 0; j < 6; j++) if (GoStory.KnotCh[j] * 100 + GoStory.KnotStep[j] <= c * 100 + s) tied++;
                    for (int j = 0; j < 6; j++)
                    {
                        bool want = GoStory.KnotCh[j] * 100 + GoStory.KnotStep[j] <= c * 100 + s;
                        if (kf.FireShown(j) != want || kf.SmokeShown(j) == want) Fail($"({c},{s}) 매듭 {j}: 불 {kf.FireShown(j)} 연기 {kf.SmokeShown(j)}");
                        int wantBeam = !want ? 0 : (tied == 6 ? 2 : 1);
                        if (kf.BeamNow(j) != wantBeam) Fail($"({c},{s}) 매듭 {j} 줄 {kf.BeamNow(j)} ≠ {wantBeam}");
                    }
                }
                // 여섯 다 묶이면 줄이 눈 등불로(2), 등불 금빛 — 눈은 28장 9째 단계부터
                GoStory.TestCh = 27; GoStory.TestStep = 8;
                kf.Refresh();
                for (int j = 0; j < 6; j++) if (kf.BeamNow(j) != 2) Fail($"여섯 다 묶였는데 매듭 {j} 줄이 눈으로 안 감 {kf.BeamNow(j)}");
                if (!kf.LanternGold) Fail("여섯 다 묶였는데 눈 등불이 안 금빛");
                if (kf.EyeShown) Fail("28장 9째 단계 전인데 눈이 섬");
                GoStory.TestCh = 27; GoStory.TestStep = 9;
                kf.Refresh();
                if (!kf.EyeShown || !kf.SwirlShown || kf.MeadowShown) Fail("28장 9째 단계부터 눈(소용돌이)이 서야");
                if (kf.PillarOn) Fail("29장 앞인데 눈 바람 기둥이 섬");
                CheckEye(kf);
                // 29장 — 기둥 열림, 보스 전까지 줄은 눈으로
                GoStory.TestCh = 28; GoStory.TestStep = 0;
                kf.Refresh();
                if (!kf.PillarOn) Fail("29장부터 눈 바람 기둥이 서야");
                CheckPillar();
                // 29장 6째 단계(보스 뒤) — 줄을 거두고 소용돌이가 걷혀 맑은 뜰
                GoStory.TestCh = 28; GoStory.TestStep = 5;
                kf.Refresh();
                if (kf.BeamNow(0) != 2 || !kf.SwirlShown) Fail("29장 보스 전: 줄은 눈으로·소용돌이 그대로여야");
                GoStory.TestCh = 28; GoStory.TestStep = 6;
                kf.Refresh();
                for (int j = 0; j < 6; j++) if (kf.BeamNow(j) != 0 || !kf.FireShown(j)) Fail($"29장 보스 뒤 매듭 {j}: 줄을 거두고 불만 남아야");
                if (kf.SwirlShown || !kf.MeadowShown) Fail("29장 보스 뒤 소용돌이가 걷혀 맑은 뜰이어야");
                // 진행 되돌리기
                GoStory.TestCh = null;
                StoryState.OffForTest = true;
                kf.Refresh();
                if (kf.EyeShown || kf.KnotShown(0) || kf.PillarOn) Fail("이야기 끔인데 매듭·눈이 남음");
            }
            finally
            {
                GoStory.TestCh = null;
                StoryState.OffForTest = off0;
                kf.Refresh();
            }
            if (_ok) Debug.Log($"[{tag}] knots OK - 매듭 여섯(제단 곁·26장 뒤 연기 → 묶임 표 27장 4·5·8/28장 3·5·8 불·금빛 줄 위로 → 여섯이면 눈 등불로 → 29장 6째 뒤 거둠)·먹구름 눈(구름섬 서쪽 판·층·윗면·28장 9째 단계부터·소용돌이 → 맑은 뜰)·눈 바람 기둥(29장부터·솟는 높이·활공 거리)");
            return _ok;
        }

        private static void CheckEye(KnotField kf)
        {
            Physics.SyncTransforms();
            Vector3 c = GoStory.EyeCenter;
            if (!Physics.Raycast(c + new Vector3(-5f, 3f, 8f), Vector3.down, out var hit, 8f) || Mathf.Abs(hit.point.y - c.y) > 0.05f) Fail("눈 윗면 충돌");
            if (!GoStory.OnEyeTop(c + Vector3.up * 0.3f) || !GoStory.OnSkyTop(c + Vector3.up * 0.3f) || !GoStory.OnSkyLayer(c + Vector3.up * 0.3f)) Fail("눈 층 판정");
            float gap = GoStory.Flat(c, GoStory.SkyCenter) - GoStory.EyeR - GoStory.SkyR;
            if (gap < 3f || gap > 10f) Fail($"눈과 구름섬 가장자리 사이 {gap:0.0}m");
            if (GoStory.OnSkyTop(GoStory.SkyCenter + Vector3.up * 0.3f) == false) Fail("구름섬 윗면이 하늘 층이 아님");
            if (GoStory.OnEyeTop(GoStory.SkyCenter + Vector3.up * 0.3f)) Fail("구름섬이 눈으로 셈");
            if (c.y - GoStory.SkyCenter.y != GoStory.EyeRise) Fail("눈 높이가 구름섬 +24m 가 아님");
        }

        private static void CheckPillar()
        {
            Vector3 b = GoStory.EyePillarPos;
            if (!PlayerController.InDraft(b + Vector3.up * 5f) || Mathf.Abs(PlayerController.DraftTopAt(b + Vector3.up * 5f) - (GoStory.EyeCenter.y + GoStory.DraftOver)) > 0.01f) Fail("눈 바람 기둥이 안 솟음");
            if (PlayerController.InDraft(b + new Vector3(GoStory.DraftR + 2f, 5f, 0f))) Fail("눈 바람 기둥 반지름");
            if (!GoStory.OnSkyTop(b + Vector3.up * 0.3f)) Fail("눈 바람 기둥 밑이 구름섬 위가 아님");
            float reach = (GoStory.EyePillarTop - GoStory.EyeCenter.y) / PlayerController.GlideFallSpeed * PlayerController.GlideSpeed;
            float need = Mathf.Abs(GoStory.EyeCenter.x - b.x) - (GoStory.EyeR - 1.5f);
            if (reach < need) Fail($"기둥 끝에서 활공 {reach:0.0}m 로 눈 가장자리(밖 {need:0.0}m)에 못 닿음");
        }

        private static void Fail(string msg) { _ok = false; Debug.LogError("[PlaytestGoKnots] FAIL - " + msg); }
    }
}
