using System.Reflection;
using UnityEngine;
using Saga.Story.Data;
using Saga.Story.World;

namespace Saga.EditorTools
{
    /// <summary>
    /// tasks U-0230 진단 — `PlaytestStorySlice` 끝 무렵(한 프레임 안).
    /// respawn: ① 쓰러지면 대기열 ② 30초 전·플레이어 곁이면 안 섬 ③ 30초·15m 밖이면 그 자리에 섬 ④ 끔이면 안 쌓임
    /// rune: ⑤ 틈 90~180·화살 넷 결정적 ⑥ 틈 지나면 앞 7m 에 룬 ⑦ 닿으면 입력 창 ⑧ 틀리면 사라짐·6초 넘기면 사라짐 ⑨ 다 맞히면 10분 ×2 ⑩ 비경 안·끔이면 없음
    /// elite: ⑪ 100마다 엘리트(체력 ×15·크기 ×1.6) ⑫ 셋째 엘리트 뒤 엘리트 두목(체력 ×40·60초) ⑬ 끔. 끝나면 셈·시각을 되돌리고 세운 것을 지운다.
    /// </summary>
    public static class PlaytestStoryRune
    {
        private const string T = "[PlaytestStorySlice]";

        public static bool Run()
        {
            bool ok = true;
            void Fail(string what, string why) { ok = false; Debug.LogError($"{T} {what} FAIL - {why}"); }
            var sp = StoryEnemySpawner.Instance;
            var spot = StoryRuneSpot.Instance;
            if (sp == null || spot == null) { Debug.LogError($"{T} rune FAIL - 생성기·룬 없음"); return false; }
            bool rOn = StoryElite.RespawnOn, eOn = StoryElite.On, runeOn = StoryRune.On;
            var now0 = StoryRune.Now;
            StoryEnemy boss = null;
            try
            {
                StoryElite.RespawnOn = true; StoryElite.On = true; StoryRune.On = true;
                StoryElite.ResetForTest(); StoryRune.ResetForTest();
                sp.ClearRespawnForTest(); // 앞 처치 단계가 쌓은 대기열은 비우고 이 검사 것만 센다
                // ① ~ ③ 되살기
                StoryEnemy victim = null;
                foreach (var e in sp.GetComponentsInChildren<StoryEnemy>()) if (!e.IsDead && !e.IsBoss && e.FieldIndex >= 0 && !e.IsElite) { victim = e; break; }
                if (victim == null) victim = sp.SpawnAt(0); // 앞 단계가 다 잡았으면 하나 세워서
                {
                    int idx = victim.FieldIndex, q0 = sp.PendingRespawns;
                    float x = victim.transform.position.x, t0 = Time.time;
                    typeof(StoryEnemy).GetMethod("Die", BindingFlags.Instance | BindingFlags.NonPublic).Invoke(victim, null);
                    if (sp.PendingRespawns != q0 + 1) Fail("respawn", $"쓰러졌는데 대기열 {q0}→{sp.PendingRespawns}");
                    if (sp.TickRespawn(t0 + 10f, x + 100f) != 0) Fail("respawn", "10초에 섬");
                    if (sp.TickRespawn(t0 + 31f, x + 2f) != 0) Fail("respawn", "플레이어 곁인데 섬");
                    int n = sp.TickRespawn(t0 + 31f, x + 100f);
                    bool back = false;
                    foreach (var e in sp.GetComponentsInChildren<StoryEnemy>()) if (e != victim && e.FieldIndex == idx && !e.IsDead) back = true;
                    if (n != 1 || !back) Fail("respawn", $"30초·15m 밖인데 안 섬(섬 {n})");
                    StoryElite.RespawnOn = false;
                    var v2 = sp.SpawnAt(idx);
                    int q1 = sp.PendingRespawns;
                    typeof(StoryEnemy).GetMethod("Die", BindingFlags.Instance | BindingFlags.NonPublic).Invoke(v2, null);
                    if (sp.PendingRespawns != q1) Fail("respawn", "끔인데 대기열에 쌓임");
                    StoryElite.RespawnOn = true;
                    if (ok) Debug.Log($"{T} respawn OK - 쓰러지면 대기 · 30초 전·곁이면 안 섬 · 30초·15m 밖이면 자리 {idx} 에 섬 · 끔 0");
                }

                // ⑤ ~ ⑩ 룬
                float clock = 1000f;
                StoryRune.Now = () => clock;
                float g = StoryRune.GapOf(0);
                if (g < 90f || g > 180f || StoryRune.SequenceOf(3).Length != 4 || string.Join("", StoryRune.SequenceOf(3)) != string.Join("", StoryRune.SequenceOf(3))) Fail("rune", $"틈 {g}·화살");
                var pl = new Vector3(5f, 0f, 0f);
                for (int i = 0; i < 200 && spot.State == StoryRuneSpot.Phase.Idle; i++) spot.Tick(1f, pl, 1f, false);
                if (spot.State != StoryRuneSpot.Phase.Placed || Mathf.Abs(spot.RunePos.x - (pl.x + 7f)) > 0.01f) Fail("rune", $"틈 지나도 룬 없음·자리 {spot.RunePos.x}");
                spot.Tick(0.1f, spot.RunePos, 1f, false);
                if (spot.State != StoryRuneSpot.Phase.Input || !spot.PanelShown) Fail("rune", "닿았는데 입력 창 없음");
                spot.Press((spot.Sequence[0] + 1) % 4);
                if (spot.State != StoryRuneSpot.Phase.Idle || StoryRune.Buffed) Fail("rune", "틀렸는데 남음");
                spot.Place(pl); spot.Tick(0.1f, spot.RunePos, 1f, false); spot.Tick(6.1f, spot.RunePos, 1f, false);
                if (spot.State != StoryRuneSpot.Phase.Idle) Fail("rune", "6초 넘겨도 남음");
                spot.Place(pl); spot.Tick(0.1f, spot.RunePos, 1f, false);
                foreach (int d in (int[])spot.Sequence.Clone()) spot.Press(d);
                if (!StoryRune.Buffed || StoryRune.ExpMul != 2f) Fail("rune", $"다 맞혔는데 덤 {StoryRune.ExpMul}");
                clock += 601f;
                if (StoryRune.ExpMul != 1f) Fail("rune", "10분 지나도 ×2");
                spot.Place(pl); spot.Tick(0.1f, pl, 1f, true);
                if (spot.State != StoryRuneSpot.Phase.Idle) Fail("rune", "비경 안인데 룬");
                StoryRune.On = false;
                for (int i = 0; i < 200; i++) spot.Tick(1f, pl, 1f, false);
                if (spot.State != StoryRuneSpot.Phase.Idle) Fail("rune", "끔인데 룬");
                StoryRune.On = true;
                if (ok) Debug.Log($"{T} rune OK - 틈 {g:0}초·앞 7m · 닿으면 화살 넷 · 틀림·6초 사라짐 · 다 맞히면 10분 ×2 · 비경·끔 없음");

                // ⑪ ~ ⑬ 엘리트
                StoryElite.SetForTest(99, 0);
                if (StoryElite.OnFieldKill(false, false) != StoryElite.Event.Elite) Fail("elite", "100째 처치에 엘리트 차례 아님");
                StoryEnemy cand = null;
                foreach (var e in sp.GetComponentsInChildren<StoryEnemy>()) if (!e.IsDead && !e.IsBoss && e.FieldIndex >= 0 && !e.IsElite) { cand = e; break; }
                if (cand == null) cand = sp.SpawnAt(0);
                float hp0 = cand.MaxHp, sc0 = cand.transform.localScale.x;
                var el = sp.PromoteElite();
                if (el == null || !el.IsElite || el.IsEliteBoss) Fail("elite", "엘리트가 안 섬");
                else if (el == cand && (Mathf.Abs(el.MaxHp - hp0 * 15f) > 0.5f || Mathf.Abs(el.transform.localScale.x - sc0 * 1.6f) > 0.01f)) Fail("elite", $"체력 {el.MaxHp}/{hp0 * 15f}·크기 {el.transform.localScale.x}");
                StoryElite.SetForTest(0, 2);
                if (StoryElite.OnFieldKill(true, false) != StoryElite.Event.Boss) Fail("elite", "셋째 엘리트에 두목 차례 아님");
                boss = sp.SpawnEliteBoss();
                if (boss == null || !boss.IsEliteBoss || boss.FieldIndex != -1) Fail("elite", "엘리트 두목이 안 섬");
                StoryElite.On = false;
                StoryElite.SetForTest(99, 0);
                if (StoryElite.OnFieldKill(false, false) != StoryElite.Event.None) Fail("elite", "끔인데 엘리트");
                if (ok) Debug.Log($"{T} elite OK - 100마다 엘리트(체력 ×15·크기 ×1.6) · 셋째 엘리트 뒤 두목(체력 ×40·60초 뒤 사라짐) · 경험치 ×{StoryElite.ExpMul} · 끔");
            }
            finally
            {
                StoryElite.RespawnOn = rOn; StoryElite.On = eOn; StoryRune.On = runeOn;
                StoryRune.Now = now0;
                StoryElite.ResetForTest(); StoryRune.ResetForTest();
                if (boss != null) Object.Destroy(boss.gameObject);
            }
            return ok;
        }
    }
}
