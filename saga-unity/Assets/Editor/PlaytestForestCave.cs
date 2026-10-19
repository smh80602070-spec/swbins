using UnityEngine;
using Saga.Forest.Data;
using Saga.Forest.World;

namespace Saga.EditorTools
{
    /// <summary>
    /// tasks U-0132 땅 아래 층(웹 W-0285) 진단 — `PlaytestForestHeadless` 입주 조건(movein) 뒤에 부른다(한 프레임 안, 날짜·횃불 시계는 강제).
    /// 다섯 줄: ① 입구 곁 힌트 → 들어가면 입구 방·어둠(해 꺼짐·점광 2.5m) ② 횃불(열매 없으면 거절·1 개 → 120초·시야 9m·끝나면 꺼짐)
    /// ③ 짐승 전 사다리 막힘·쫓으면 열림·광맥 하루 한 번(어두우면 1·밝으면 2·다음 날 다시) ④ 5층 사다리 대신 유물 한 번(열매·화석 도감)
    /// ⑤ 올라가 나가면 빛·하늘 되돌림·굴 좌표에 갇힌 주인공 꺼내기·저장 왕복·옛 세이브.
    /// 끝나면 열매·도감·굴 기록·날짜·시계·주인공 자리를 시작 때로.
    /// </summary>
    public static class PlaytestForestCave
    {
        private const string T = "[PlaytestForestHeadless] cave";
        private static bool _ok, _step;

        public static bool Run()
        {
            _ok = true;
            int fruit0 = ForestState.FruitCount;
            string[] museum0 = ForestMuseumState.Snapshot();
            string cave0 = ForestCave.Snapshot();
            var runner = ForestCaveRunner.Instance != null ? ForestCaveRunner.Instance : ForestCaveRunner.Install();
            var pl = GameObject.FindWithTag("Player");
            var cc = pl != null ? pl.GetComponent<CharacterController>() : null;
            Vector3 pos0 = pl != null ? pl.transform.position : Vector3.zero;
            var amb0 = RenderSettings.ambientMode;
            bool fog0 = RenderSettings.fog;
            var cam = Camera.main;
            var clear0 = cam != null ? cam.clearFlags : CameraClearFlags.Skybox;
            int suns0 = SunsOn();
            double clock = 1_000_000;
            const int D = 91000;
            try
            {
                if (pl == null) { Fail("주인공 없음"); return false; }
                ForestCave.ResetForTest();
                ForestCave.ClockForTest = () => clock;
                ForestVisitors.ForceDayForTest(D);

                // ① 입구·들어가기
                Begin();
                Put(pl, cc, ForestCaveRunner.EntrancePos + new Vector3(1f, 0.1f, 0f));
                runner.Sense();
                if (!runner.HintShown) Fail("굴 입구 곁인데 힌트가 없음");
                runner.Use();
                if (ForestCave.Floor != 0 || !runner.Dark) Fail($"들어갔는데 층 {ForestCave.Floor}·어둠 {runner.Dark}");
                if ((pl.transform.position - ForestCaveRunner.Pocket).magnitude > 12f) Fail($"방으로 안 옮겨짐 {pl.transform.position}");
                if (SunsOn() != 0 || RenderSettings.fog || (cam != null && cam.clearFlags != CameraClearFlags.SolidColor)) Fail($"굴 안인데 해 {SunsOn()}·안개 {RenderSettings.fog}");
                if (runner.LampRange <= 0f) Fail("점광이 안 켜짐");
                if (!runner.Shown(ForestCave.Kind.Ladder) || runner.Shown(ForestCave.Kind.Beast) || runner.Shown(ForestCave.Kind.Ore0)) Fail("입구 방에 짐승·광맥이 있거나 사다리가 없음");
                if (!ForestCave.HudLine().Contains(ForestLocalization.T("cave.hud_entry", "굴 입구"))) Fail($"HUD {ForestCave.HudLine()}");
                End("enter OK - 입구 힌트·입구 방(사다리뿐)·해 끔·안개 끔·검은 하늘·HUD");

                // ② 횃불
                Begin();
                ForestState.Restore(0);
                if (runner.Act(ForestCave.Kind.Torch) || ForestCave.Lit) Fail("열매 없이 횃불이 켜짐");
                if (ForestCave.Sight != ForestCave.SightDark) Fail($"어둠 시야 {ForestCave.Sight}");
                ForestState.Restore(3);
                if (!runner.Act(ForestCave.Kind.Torch) || !ForestCave.Lit || ForestState.FruitCount != 2 || ForestCave.TorchLeft != 120) Fail($"횃불 열매 {ForestState.FruitCount}·남은 {ForestCave.TorchLeft}");
                if (ForestCave.Sight != ForestCave.SightLit || runner.Act(ForestCave.Kind.Torch) || ForestState.FruitCount != 2) Fail("켜진 횃불을 또 켬·시야");
                clock += 121;
                if (ForestCave.Lit || ForestCave.Sight != ForestCave.SightDark) Fail("120초 뒤에도 밝음");
                End("torch OK - 열매 없으면 거절·열매 1 → 120초·시야 2.5→9m·끝나면 어둠");

                // ③ 짐승·사다리·광맥
                Begin();
                ForestState.Restore(10);
                if (!runner.Act(ForestCave.Kind.Ladder) || ForestCave.Floor != 1) Fail("입구 방 사다리가 안 내려감");
                if (runner.Act(ForestCave.Kind.Ladder) || ForestCave.Floor != 1) Fail("짐승이 있는데 내려감");
                if (!runner.Act(ForestCave.Kind.Beast) || runner.Shown(ForestCave.Kind.Beast)) Fail("짐승이 안 달아남");
                if (!runner.Act(ForestCave.Kind.Ore0) || ForestState.FruitCount != 11) Fail($"어둠 광맥 열매 {ForestState.FruitCount} ≠ 11");
                if (runner.Act(ForestCave.Kind.Ore0) || ForestState.FruitCount != 11) Fail("같은 날 같은 광맥을 또 캠");
                runner.Act(ForestCave.Kind.Torch);
                if (!runner.Act(ForestCave.Kind.Ore1) || ForestState.FruitCount != 12) Fail($"밝은 광맥 열매 {ForestState.FruitCount} ≠ 12(횃불 −1·+2)");
                ForestVisitors.ForceDayForTest(D + 1);
                if (!runner.Act(ForestCave.Kind.Ore0)) Fail("다음 날 광맥이 안 캐짐");
                if (!runner.Act(ForestCave.Kind.Ladder) || ForestCave.Floor != 2 || ForestCave.Deepest != 2) Fail($"쫓은 뒤 사다리 층 {ForestCave.Floor}·가장 깊이 {ForestCave.Deepest}");
                End("beast OK - 짐승 전 사다리 막힘·쫓으면 열림·광맥 하루 한 번(어둠 1·횃불 2)·다음 날 다시");

                // ④ 5층 유물
                Begin();
                while (ForestCave.Floor < ForestCave.Floors) { runner.Act(ForestCave.Kind.Beast); if (!runner.Act(ForestCave.Kind.Ladder)) break; }
                if (ForestCave.Floor != 5 || runner.Shown(ForestCave.Kind.Ladder) || !runner.Shown(ForestCave.Kind.Relic)) Fail($"5층 {ForestCave.Floor}·사다리/유물 모습");
                int f = ForestState.FruitCount;
                if (!runner.Act(ForestCave.Kind.Relic) || ForestState.FruitCount != f + ForestCave.RelicFruit || !ForestMuseumState.IsDiscovered(ForestCave.RelicFossil)) Fail("유물 열매·화석 도감");
                if (runner.Act(ForestCave.Kind.Relic) || runner.Shown(ForestCave.Kind.Relic) || ForestState.FruitCount != f + ForestCave.RelicFruit) Fail("유물을 두 번 가져감");
                if (runner.Act(ForestCave.Kind.Ladder)) Fail("5층에서 더 내려감");
                End("relic OK - 5층 사다리 대신 유물·열매 +5·화석 도감·한 번뿐");

                // ⑤ 나가기·되돌림·갇힘·저장
                Begin();
                for (int i = 0; i < 6 && ForestCave.Inside; i++) runner.Act(ForestCave.Kind.Up);
                if (ForestCave.Inside || runner.Dark) Fail("다 올라왔는데 굴 안");
                if (SunsOn() != suns0 || RenderSettings.ambientMode != amb0 || RenderSettings.fog != fog0 || (cam != null && cam.clearFlags != clear0)) Fail($"빛 안 되돌림 해 {SunsOn()}/{suns0}·주변광 {RenderSettings.ambientMode}/{amb0}");
                if ((pl.transform.position - ForestCaveRunner.EntrancePos).magnitude > 6f) Fail($"입구 앞으로 안 나옴 {pl.transform.position}");
                Put(pl, cc, ForestCaveRunner.Pocket + Vector3.up * 0.1f);
                runner.RescueIfStranded();
                if ((pl.transform.position - ForestCaveRunner.Pocket).magnitude < 40f) Fail("굴 좌표 세이브에서 안 꺼내짐");
                string json = ForestCave.Snapshot();
                ForestCave.Restore(null);
                if (ForestCave.Deepest != 0 || ForestCave.RelicTaken) Fail("옛 세이브(없음)인데 기록이 남음");
                ForestCave.Restore(json);
                if (ForestCave.Deepest != 5 || !ForestCave.RelicTaken || !ForestCave.DugToday(1, 0)) Fail($"저장 왕복 깊이 {ForestCave.Deepest}·유물 {ForestCave.RelicTaken}");
                if (!ForestSaveState.ToJson().Contains("\"caveJson\"")) Fail("세이브에 caveJson 없음");
                End("exit OK - 올라 나가면 해·주변광·안개·하늘 되돌림·갇힌 주인공 꺼냄·저장 왕복·옛 세이브 빈 것");
            }
            finally
            {
                if (ForestCave.Inside) ForestCave.Leave();
                runner.SetDark(false);
                ForestCave.ClockForTest = null;
                ForestCave.Restore(cave0);
                ForestVisitors.ForceDayForTest(null);
                ForestState.Restore(fruit0);
                ForestMuseumState.Restore(museum0);
                if (pl != null) Put(pl, cc, pos0);
            }
            return _ok;
        }

        private static int SunsOn()
        {
            int n = 0;
            foreach (var l in Object.FindObjectsByType<Light>(FindObjectsSortMode.None)) if (l.type == LightType.Directional && l.enabled) n++;
            return n;
        }

        private static void Put(GameObject pl, CharacterController cc, Vector3 p)
        {
            if (cc != null) cc.enabled = false;
            pl.transform.position = p;
            if (cc != null) cc.enabled = true;
        }

        private static void Begin() => _step = true;
        private static void End(string line) { if (_step) Debug.Log($"{T} {line}"); }

        private static void Fail(string msg)
        {
            Debug.LogError($"{T}: {msg}");
            _ok = false;
            _step = false;
        }
    }
}
