using System.Collections.Generic;
using System.Reflection;
using UnityEngine;
using Saga.Dungeon.Cinematics;
using Saga.Dungeon.Data;
using Saga.Dungeon.UI;
using Saga.Dungeon.World;

namespace Saga.EditorTools
{
    /// <summary>
    /// PLAN.md 109-10-3 시련(웹 사가나락 §5.11) 진단 — `PlaytestDungeonHeadless` 가 비결 진단 뒤에 부른다(한 프레임 안, 시간은 `Tick` 으로).
    /// 웹 진단(문턱·열린 단계·배율 / 진척→수호자→완주·순위·전설·두 단계 / 쓰러짐 −30초·시간 초과)을 이 트랙에 맞춰:
    /// 규칙(문턱·위 셋·배율·순위 정렬·10 자름·상한) · 표식(잠김 안내 → 카드, 단추 셋) · 카드 단추 진짜 onClick → 시련 방 ·
    /// 무리(다섯·세 시대·배율 체력) · 진척 → 수호자(무리 다섯) · 완주(순위·전설 명소 무기·금·두 단계·돌아옴) · 느린 완주 한 단계 ·
    /// 쓰러짐(−30초·안 끝남·유품 없음) · HUD(1분 미만 붉게) · 시간 초과(기록 없음) · 난입과 겹치지 않음 · 세이브 v12.
    /// 끝나면 시련 기록·영웅·도감·자리를 시작 때로.
    /// </summary>
    public static class PlaytestDungeonTrial
    {
        private const string T = "[PlaytestDungeonHeadless] trial";
        private static bool _ok;

        public static bool Run()
        {
            _ok = true;
            var playerGo = GameObject.FindWithTag("Player");
            var runner = TrialRunner.Instance;
            var card = TrialCardUi.Instance;
            var gate = Object.FindFirstObjectByType<TrialGate>();
            if (playerGo == null || runner == null || card == null || gate == null)
            {
                Fail($"필요한 것 없음(러너 {runner != null}·카드 {card != null}·표식 {gate != null})");
                return false;
            }
            int best = TrialState.Best, open = TrialState.Open, runs = TrialState.Runs;
            var board = TrialState.SnapshotBoard();
            int level = HeroState.Level, exp = HeroState.Exp, hp = HeroState.Hp, gold = HeroState.Gold;
            string weapon = HeroState.EquippedWeaponId, gem = HeroState.SocketedGemId;
            string[] bestiary = BestiaryState.Snapshot();
            Vector3 pos = playerGo.transform.position;
            var pillarsBefore = new HashSet<LootMarker>(Object.FindObjectsByType<LootMarker>(FindObjectsSortMode.None));
            string m = "";
            try
            {
                DungeonCutscenes.Instance?.Skip();
                m += CheckRules() + CheckGateAndCard(gate, card, runner, playerGo.transform) + CheckClear(runner, playerGo.transform)
                    + CheckSlowClear(runner, playerGo.transform) + CheckDeathAndTimeout(runner, playerGo.transform) + CheckSave();
            }
            finally
            {
                if (runner.IsActive) runner.Tick(1e6f); // 남은 판은 시간 초과로 닫는다.
                if (card.IsOpen) card.Close();
                foreach (var lm in Object.FindObjectsByType<LootMarker>(FindObjectsSortMode.None))
                    if (!pillarsBefore.Contains(lm)) Object.DestroyImmediate(lm.gameObject);
                TrialState.Restore(best, open, runs, board);
                HeroState.Restore(level, exp, hp, gold, weapon, gem);
                BestiaryState.Restore(bestiary);
                var cc = playerGo.GetComponent<CharacterController>();
                if (cc != null) cc.enabled = false;
                playerGo.transform.position = pos;
                if (cc != null) cc.enabled = true;
                Object.FindFirstObjectByType<Saga.Core.SessionCard>()?.Hide();
            }
            if (_ok) Debug.Log($"{T} OK - 규칙(문턱·위 셋·배율·순위·10·상한)·표식(잠김→카드)·카드 onClick→방·무리 세 시대·진척→수호자·완주(순위·명소 무기·금·+2·돌아옴)·느린 완주 +1·쓰러짐 −30초(유품 없음)·HUD 붉게·시간 초과·난입 막음·세이브 v12 |{m}");
            return _ok;
        }

        private static string CheckRules()
        {
            TrialState.Restore(0, 1, 0, null);
            if (TrialState.IsUnlocked(9) || !TrialState.IsUnlocked(10)) Fail("문턱 제10층");
            if (!Same(TrialState.Offers(), 1)) Fail($"새 기록 단계 {string.Join(",", TrialState.Offers())}");
            TrialState.Restore(4, 0, 3, null);
            if (TrialState.Open != 5 || !Same(TrialState.Offers(), 5, 4, 3)) Fail($"최고 4 → 열림 {TrialState.Open}·위 셋 {string.Join(",", TrialState.Offers())}");
            if (!TrialState.IsUnlocked(2)) Fail("한 번 한 뒤엔 층과 무관하게 열려야");
            if (Mathf.Abs(TrialState.EnemyMul(3) - 2.05f) > 0.001f) Fail($"3단계 배율 {TrialState.EnemyMul(3)}");

            TrialState.Restore(0, 1, 0, null);
            int r1 = TrialState.RecordClear(2, 500f, 0, 9, "d");
            if (r1 != 1 || TrialState.Open != 4 || TrialState.Best != 2) Fail($"빠른 완주 순위 {r1}·열림 {TrialState.Open}(기대 4)");
            int r2 = TrialState.RecordClear(2, 300f, 1, 9, "d");
            if (r2 != 2 || TrialState.Open != 4) Fail($"느린 같은 단계 순위 {r2}·열림 {TrialState.Open}");
            int r3 = TrialState.RecordClear(3, 100f, 0, 9, "d");
            if (r3 != 1 || TrialState.Board[0].lv != 3 || TrialState.Board[1].sec != 400) Fail($"높은 단계가 위로 {r3}·{TrialState.Board[0].lv}/{TrialState.Board[1].sec}");
            for (int i = 0; i < 12; i++) TrialState.RecordClear(1, 10f, 0, 9, "d");
            if (TrialState.Board.Count != TrialState.BoardSize || TrialState.Runs != 15) Fail($"순위표 {TrialState.Board.Count}·횟수 {TrialState.Runs}");
            if (TrialState.RecordClear(1, 10f, 5, 9, "d") != 0) Fail("순위표 밖인데 순위가 매겨짐");
            TrialState.Restore(99, 100, 1, null);
            TrialState.RecordClear(100, 800f, 0, 9, "d");
            if (TrialState.Open != TrialState.MaxStage) Fail($"상한 {TrialState.Open}");
            return "";
        }

        private static string CheckGateAndCard(TrialGate gate, TrialCardUi card, TrialRunner runner, Transform player)
        {
            TrialState.Restore(0, 1, 0, null);
            int floor = DungeonFloorRunner.Instance != null ? DungeonFloorRunner.Instance.CurrentFloor : 1;
            if (floor < TrialState.UnlockFloor)
            {
                gate.Arrive();
                if (card.IsOpen) Fail($"{floor}층인데 카드가 열림");
            }
            TrialState.Restore(2, 3, 1, null);
            gate.Arrive();
            if (!card.IsOpen) Fail("열린 뒤 표식이 카드를 안 엶");
            int shown = 0;
            for (int i = 0; i < 3; i++) if (card.StageButton(i).gameObject.activeSelf) shown++;
            if (shown != 3 || card.StageOf(0) != 3 || card.StageOf(2) != 1) Fail($"카드 단추 {shown}·{card.StageOf(0)}/{card.StageOf(2)}");
            if (string.IsNullOrEmpty(card.BoardText)) Fail("순위표 글 없음");
            if (Vector3.Distance(gate.transform.position, Object.FindFirstObjectByType<HordeGate>().transform.position) <= TrialGate.TriggerRadius * 2f)
                Fail("시련 표식이 난입 표식과 반경이 겹침");
            var dead = ButtonWiringCheck.FindDeadButtons(out _, out string err);
            foreach (var d in dead) if (d.Contains("TrialCard")) Fail($"죽은 버튼 {d}");

            card.StageButton(1).onClick.Invoke(); // 2단계
            if (card.IsOpen || !runner.IsActive || runner.Stage != 2) Fail($"2단계 단추 → 시작 {runner.IsActive}·{runner.Stage}");
            if (Vector3.Distance(player.position, runner.transform.position) > 12f) Fail("시련 방으로 안 옮겨짐");
            if (!TrialRunner.Busy || runner.StartRun(1, player.position)) Fail("시련 중에 또 시작됨");
            if (!HeroState.GraveSuppressed) Fail("시련 중 유품 막음이 꺼져 있음");

            var live = runner.LiveEnemies();
            var names = new HashSet<string>();
            float gruntHp = DungeonFormulas.EnemyHp(TrialState.BaseFloor, false) * TrialState.EnemyMul(2);
            int gruntsAtHp = 0;
            foreach (var e in live)
            {
                names.Add(e.DisplayNameRaw);
                if (Mathf.Abs(e.CurrentHp - gruntHp) < 0.5f) gruntsAtHp++;
            }
            string modern = DungeonEras.FoeFor(TrialState.BaseFloor, DungeonEra.Modern).NameKo;
            string future = DungeonEras.FoeFor(TrialState.BaseFloor, DungeonEra.Future).NameKo;
            if (live.Count != TrialRunner.PackGrunts + 1 || !names.Contains("황건적") || !names.Contains(modern) || !names.Contains(future) || gruntsAtHp != 4)
                Fail($"첫 무리 {live.Count}·이름 {string.Join("/", names)}·체력 맞는 잡졸 {gruntsAtHp}");
            return $" 첫 무리 {string.Join("/", names)}";
        }

        /// <summary>CheckGateAndCard 가 연 2단계를 이어 — 무리 다섯 → 수호자 → 빨리 깸.</summary>
        private static string CheckClear(TrialRunner runner, Transform player)
        {
            Vector3 home = player.position; // 이미 방 안 — 돌아올 자리는 카드를 연 곳
            int goldBefore = HeroState.Gold;
            int pillars = LootMarker.PillarCount;
            KillToGuardian(runner);
            if (runner.Progress != TrialState.Goal || !runner.GuardianUp || runner.Packs != 5) Fail($"진척 {runner.Progress}·수호자 {runner.GuardianUp}·무리 {runner.Packs}(기대 5)");
            var g = runner.Guardian;
            float gHp = DungeonFormulas.EnemyHp(TrialState.BaseFloor, true) * TrialRunner.GuardianHpMul * TrialState.EnemyMul(2);
            if (g == null || !g.IsBoss || Mathf.Abs(g.CurrentHp - gHp) > 1f) Fail($"수호자 체력 {g?.CurrentHp}/{gHp}");
            int packs = runner.Packs;
            runner.Tick(1f);
            if (runner.Packs != packs) Fail("수호자가 선 뒤에도 무리가 보충됨");
            if (!TrialRunner.HudLine().Contains("2")) Fail($"HUD 줄 '{TrialRunner.HudLine()}'");
            runner.Tick(100f); // 약 800초 남김 → 두 단계
            g.TakeDamage(1e9f);
            if (runner.IsActive || !runner.LastCleared || runner.LastRank != 1) Fail($"완주 {runner.IsActive}/{runner.LastCleared}·순위 {runner.LastRank}");
            if (TrialState.Best != 2 || TrialState.Open != 4 || TrialState.Runs != 2) Fail($"기록 최고 {TrialState.Best}·열림 {TrialState.Open}(기대 4)·횟수 {TrialState.Runs}");
            var item = ItemData.Get(runner.LastRewardId);
            if (item == null || item.Lore == Secret.None) Fail($"전설 보상 {runner.LastRewardId}");
            if (HeroState.Gold < goldBefore + (6 + 2) * TrialRunner.GoldPerMerit) Fail($"공적 금 {HeroState.Gold - goldBefore}");
            if (LootMarker.PillarCount != pillars + 1 || LootMarker.LastPillarTier != LootMarker.PillarUnique) Fail("완주 빛기둥");
            if (HeroState.GraveSuppressed) Fail("끝나도 유품 막음이 남음");
            if (Vector3.Distance(player.position, runner.transform.position) < 12f) Fail("완주 뒤 방에 남음");
            if (TrialRunner.HudLine().Length != 0) Fail("끝난 뒤 HUD 줄이 남음");
            return $" 보상 {runner.LastRewardId}";
        }

        private static string CheckSlowClear(TrialRunner runner, Transform player)
        {
            // 열린 맨 위(4) 를 느리게 — 한 단계만.
            if (!runner.StartRun(TrialState.Open, player.position)) { Fail("4단계 시작 안 됨"); return ""; }
            KillToGuardian(runner);
            runner.Tick(600f); // 300초 남김
            runner.Guardian?.TakeDamage(1e9f);
            if (runner.IsActive || TrialState.Open != 5 || TrialState.Best != 4) Fail($"느린 완주 열림 {TrialState.Open}(기대 5)·최고 {TrialState.Best}");
            if (TrialState.Board.Count != 2 || TrialState.Board[0].lv != 4 || TrialState.Board[0].sec != 600) Fail($"순위표 {TrialState.Board.Count}·{TrialState.Board[0].lv}/{TrialState.Board[0].sec}");
            return "";
        }

        private static string CheckDeathAndTimeout(TrialRunner runner, Transform player)
        {
            HeroState.AddGold(123);
            int gold = HeroState.Gold, graves = GraveMarker.SpawnCount, boardCount = TrialState.Board.Count, runsBefore = TrialState.Runs, bestBefore = TrialState.Best;
            if (!runner.StartRun(1, player.position)) { Fail("1단계 시작 안 됨"); return ""; }
            HeroState.TakeDamage(1e9f);
            if (!runner.IsActive || runner.Deaths != 1 || Mathf.Abs(runner.TimeLeft - (TrialState.TrialSec - TrialState.DeathPenaltySec)) > 0.01f)
                Fail($"쓰러짐 — 진행 {runner.IsActive}·{runner.Deaths}·남은 {runner.TimeLeft}");
            if (HeroState.Gold != gold || GraveMarker.SpawnCount != graves || HeroState.Hp != HeroState.HpMax) Fail($"쓰러짐 유품 금 {gold}→{HeroState.Gold}·무덤 {GraveMarker.SpawnCount - graves}·체력 {HeroState.Hp}");
            runner.Tick(runner.TimeLeft - 55f);
            string hud = TrialRunner.HudLine();
            if (!hud.Contains("<color") || !hud.Contains("0:55")) Fail($"1분 미만 HUD '{hud}'");
            var horde = HordeRunner.Instance;
            var hordeGate = Object.FindFirstObjectByType<HordeGate>();
            if (horde != null && hordeGate != null)
            {
                // 난입 표식에 서서 그 Update 를 부른다 — 시련 중엔 난입이 안 열린다.
                Vector3 inArena = player.position;
                Place(player, hordeGate.transform.position);
                typeof(HordeGate).GetField("_triggeredThisVisit", BindingFlags.NonPublic | BindingFlags.Instance)?.SetValue(hordeGate, false);
                typeof(HordeGate).GetMethod("Update", BindingFlags.NonPublic | BindingFlags.Instance).Invoke(hordeGate, null);
                if (horde.IsActive) Fail("시련 중 난입이 열림");
                Place(player, inArena);
            }
            runner.Tick(100f);
            if (runner.IsActive || runner.LastCleared || TrialState.Board.Count != boardCount || TrialState.Runs != runsBefore + 1 || TrialState.Best != bestBefore)
                Fail($"시간 초과 — 진행 {runner.IsActive}·완주 {runner.LastCleared}·순위표 {TrialState.Board.Count}·횟수 {TrialState.Runs}");
            if (HeroState.GraveSuppressed) Fail("시간 초과 뒤 유품 막음이 남음");
            HeroState.TakeDamage(1e9f); // 시련 밖에선 다시 유품이 떨어진다.
            if (GraveMarker.SpawnCount != graves + 1) Fail("시련 밖 쓰러짐에 유품이 안 떨어짐");
            HeroState.FullHeal();
            return "";
        }

        private static string CheckSave()
        {
            var saveType = typeof(SaveState);
            var ver = saveType.GetField("SaveVersion", BindingFlags.NonPublic | BindingFlags.Static);
            if (ver == null || (int)ver.GetValue(null) < 12) Fail($"세이브 버전 {(ver != null ? ver.GetValue(null) : "?")} < 12");
            var data = saveType.GetNestedType("SaveData", BindingFlags.NonPublic);
            foreach (var f in new[] { "trialBest", "trialOpen", "trialRuns", "trialBoard" })
                if (data == null || data.GetField(f) == null) Fail($"SaveData.{f} 없음");
            var w = JsonUtility.FromJson<Wrap>(JsonUtility.ToJson(new Wrap { board = TrialState.SnapshotBoard() }));
            int n = TrialState.Board.Count;
            TrialState.Restore(TrialState.Best, TrialState.Open, TrialState.Runs, w.board);
            if (TrialState.Board.Count != n || n == 0 || TrialState.Board[0].lv != 4) Fail($"순위표 JSON 왕복 {TrialState.Board.Count}/{n}");
            TrialState.Restore(0, 0, 0, null);
            if (TrialState.Open != 1 || TrialState.Board.Count != 0) Fail("옛 세이브(0/0/0/null) 기본값");
            return "";
        }

        [System.Serializable] private class Wrap { public TrialState.Entry[] board; }

        private static void KillToGuardian(TrialRunner runner)
        {
            for (int guard = 0; guard < 40 && !runner.GuardianUp; guard++)
            {
                foreach (var e in runner.LiveEnemies()) if (e != runner.Guardian) e.TakeDamage(1e9f);
                if (!runner.GuardianUp) runner.Tick(0.01f);
            }
        }

        private static void Place(Transform player, Vector3 p)
        {
            var cc = player.GetComponent<CharacterController>();
            if (cc != null) cc.enabled = false;
            player.position = p;
            if (cc != null) cc.enabled = true;
        }

        private static bool Same(int[] a, params int[] b)
        {
            if (a.Length != b.Length) return false;
            for (int i = 0; i < a.Length; i++) if (a[i] != b[i]) return false;
            return true;
        }

        private static void Fail(string msg)
        {
            _ok = false;
            Debug.LogError($"{T} FAIL - {msg}");
        }
    }
}
