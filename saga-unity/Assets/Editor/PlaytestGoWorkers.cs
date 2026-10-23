using System.Collections.Generic;
using UnityEngine;
using Saga.Go.Data;
using Saga.Go.UI;
using Saga.Go.World;
using GoSave = Saga.Go.Data.SaveState;

namespace Saga.EditorTools
{
    /// <summary>
    /// tasks U-0186 1만리 신수 일꾼(고돗 G-0328 짝) 진단 — `PlaytestHeadless` 가 바람 길잡이 뒤에 부른다(한 프레임 안, 시계는 `HomeState.NowForTest`).
    /// ① 칸·셈(칸 = 1 + 마당 등급 · 30분에 하나·상한 24 · 강화석 2시간·상한 6) ② 앉히기 규칙(없는 신수·동행·같은 신수·칸 가득 거절)
    /// ③ 진짜 쉼터 수확 — 박하·꿀꽃 번갈아·강화석, 받은 만큼만 시계가 앞으로 ④ 내보내기 = 먼저 받기 ⑤ 쉼터 창 줄·단추·마당 몸 ⑥ 세이브 왕복·옛 세이브 ⑦ 손잡이.
    /// 끝나면 세이브 JSON(마당·알·재료·강화석·금·일꾼)을 시작 때로.
    /// </summary>
    public static class PlaytestGoWorkers
    {
        private const string T = "[PlaytestHeadless] workers";
        private static bool _ok, _step;
        private const long T0 = 1_900_000_000;

        public static bool Run()
        {
            _ok = true;
            string json0 = GoSave.ToJson();
            var field = HomesteadField.Instance;
            Vector3 pos0 = field != null && field.Player != null ? field.Player.position : Vector3.zero;
            var ui = HomesteadUi.Instance;
            try
            {
                HomeState.NowForTest = T0;
                HomeState.Restore(null, T0, 0, 0);
                GoHomeWorkers.ResetForTest();
                EggState.ResetForTest();
                const string wis = "pt_samjogo", mig = "pt_dokkaebi", cmd = "pt_haetae";

                // ① 칸·셈
                Begin();
                if (GoHomeWorkers.Slots != 1) Fail($"빈 마당 칸 {GoHomeWorkers.Slots} ≠ 1");
                HomeState.Restore(Fences(10), T0, 0, 0);
                if (GoHomeWorkers.Slots != 2) Fail($"아담한 마당 칸 {GoHomeWorkers.Slots} ≠ 2");
                var w = new GoHomeWorkers.Worker { pet = wis, t = T0 };
                var m = new GoHomeWorkers.Worker { pet = mig, t = T0 };
                if (GoHomeWorkers.Pending(w, T0 + 29 * 60) != 0 || GoHomeWorkers.Pending(w, T0 + 30 * 60) != 1 || GoHomeWorkers.Pending(w, T0 + 48 * 3600) != GoHomeWorkers.Cap) Fail("지력 30분·상한 24");
                if (GoHomeWorkers.Pending(m, T0 + 3600) != 0 || GoHomeWorkers.Pending(m, T0 + 2 * 3600) != 1 || GoHomeWorkers.Pending(m, T0 + 48 * 3600) != GoHomeWorkers.OreCap) Fail("무력 2시간·상한 6");
                End("count OK - 칸 = 1 + 마당 등급(빈 1·아담 2) · 30분에 하나·상한 24 · 강화석 2시간·상한 6");

                // ② 앉히기 규칙
                Begin();
                if (GoHomeWorkers.Assign(wis, T0) != "work.why_none") Fail("안 가진 신수를 앉힘");
                EggState.Discover(wis); EggState.Discover(mig); EggState.Discover(cmd);
                EggState.SetBuddy(cmd);
                if (GoHomeWorkers.Assign(cmd, T0) != "work.why_buddy") Fail("동행 신수를 앉힘");
                if (GoHomeWorkers.NextCandidate() == cmd) Fail("다음 후보가 동행");
                if (GoHomeWorkers.Assign(wis, T0) != null || GoHomeWorkers.Assign(wis, T0) != "work.why_has") Fail("앉히기·같은 신수");
                if (GoHomeWorkers.Assign(mig, T0) != null) Fail("둘째 칸 못 앉힘");
                EggState.SetBuddy("");
                if (GoHomeWorkers.Assign(cmd, T0) != "work.why_slots") Fail("칸이 찼는데 앉힘");
                End("assign OK - 안 가진·동행·같은 신수·칸 가득 거절 · 둘 앉힘");

                // ③ 진짜 수확
                Begin();
                int mint0 = CookState.Count("mint"), honey0 = CookState.Count("honey_flower"), ore0 = WeaponState.Ore;
                HomeState.NowForTest = T0 + 3 * 3600 + 20 * 60; // 3시간 20분 — 지력 6(나머지 20분)·무력 1(나머지 1시간 20분)
                field?.HarvestNow();
                int dm = CookState.Count("mint") - mint0, dh = CookState.Count("honey_flower") - honey0, dore = WeaponState.Ore - ore0;
                if (field == null) Fail("HomesteadField 없음");
                else if (dm != 3 || dh != 3 || dore != 1) Fail($"수확 박하 {dm}·꿀꽃 {dh}·강화석 {dore} ≠ 3·3·1");
                if (GoHomeWorkers.PendingAll(HomeState.NowForTest) != 0) Fail("받은 뒤에도 남음");
                HomeState.NowForTest += 10 * 60; // 남은 20분 + 10분 = 30분 → 지력 1
                if (GoHomeWorkers.Pending(GoHomeWorkers.Workers[0], HomeState.NowForTest) != 1) Fail("나머지 시간이 버려짐");
                End($"harvest OK - 3시간 20분: 박하 {dm}·꿀꽃 {dh}·강화석 {dore}「{field?.LastWorkGot}」 · 나머지 20분은 남음");

                // ④ 내보내기
                Begin();
                int honey1 = CookState.Count("honey_flower") + CookState.Count("mint");
                string got = GoHomeWorkers.Dismiss(wis, HomeState.NowForTest);
                if (CookState.Count("honey_flower") + CookState.Count("mint") != honey1 + 1 || GoHomeWorkers.IsWorker(wis) || string.IsNullOrEmpty(got)) Fail($"내보내기 먼저 받기 「{got}」");
                if (GoHomeWorkers.Dismiss(wis, HomeState.NowForTest) != null) Fail("없는 일꾼 내보냄");
                End($"dismiss OK - 모은 것 먼저「{got}」· 빠짐");

                // ⑤ 창·몸
                Begin();
                if (ui == null) Fail("HomesteadUi 없음");
                else
                {
                    Move(field?.Player, GoHomestead.Center + new Vector3(1f, 0.3f, 1f)); // 창은 마당 둘레에서만 열린다
                    ui.Open();
                    if (!ui.WorkText.Contains("1/2") || !ui.AssignButton.interactable || !ui.DismissButton.interactable) Fail($"창 줄「{ui.WorkText}」·단추");
                    ui.AssignNext();
                    if (GoHomeWorkers.Workers.Count != 2 || ui.AssignButton.interactable) Fail("창에서 앉히기·칸 가득 흐림");
                    if (field != null && field.WorkerBodies != 2) Fail($"마당 몸 {field.WorkerBodies} ≠ 2");
                    ui.DismissLast();
                    if (GoHomeWorkers.Workers.Count != 1 || (field != null && field.WorkerBodies != 1)) Fail("창에서 내보내기·몸");
                    ui.Close();
                }
                End($"panel OK - 창 줄 · 앉히기 → 몸 2 · 내보내기 → 몸 1");

                // ⑥ 세이브
                Begin();
                string snap = GoHomeWorkers.Snapshot();
                if (!GoSave.ToJson().Contains("\"homeWorkers\"")) Fail("세이브에 homeWorkers 없음");
                GoHomeWorkers.Restore(null);
                if (GoHomeWorkers.Workers.Count != 0) Fail("옛 세이브인데 일꾼");
                GoHomeWorkers.Restore(snap);
                if (GoHomeWorkers.Workers.Count != 1 || GoHomeWorkers.Workers[0].pet != mig) Fail("세이브 왕복");
                End("save OK - homeWorkers 왕복·옛 세이브 일꾼 없음");

                // ⑦ 손잡이
                Begin();
                GoHomeWorkers.On = false;
                HomeState.NowForTest += 24 * 3600;
                if (GoHomeWorkers.PendingAll(HomeState.NowForTest) != 0 || GoHomeWorkers.Collect(HomeState.NowForTest) != "" || GoHomeWorkers.Assign(wis, HomeState.NowForTest) != "work.why_off") Fail("껐는데 쌓이거나 받음");
                End("off OK - 손잡이 끄면 쌓기·받기·앉히기 없음");
            }
            finally
            {
                GoHomeWorkers.On = true;
                HomeState.NowForTest = -1;
                GoSave.ApplyJson(json0);
                ui?.Close();
                if (field != null && field.Player != null) Move(field.Player, pos0);
            }
            return _ok;
        }

        private static void Move(Transform t, Vector3 p)
        {
            if (t == null) return;
            var cc = t.GetComponent<CharacterController>();
            if (cc != null) cc.enabled = false;
            t.position = p;
            if (cc != null) cc.enabled = true;
            Physics.SyncTransforms();
        }

        private static List<HomePlaced> Fences(int n)
        {
            var c = GoHomestead.Center; var l = new List<HomePlaced>();
            for (int i = 0; i < n; i++) l.Add(new HomePlaced { id = "fence", x = c.x - 6f + (i % 8) * 1.5f, z = c.z - 6f + (i / 8) * 1.5f, r = 0 });
            return l;
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
