using System.Collections.Generic;
using UnityEngine;
using Saga.Dungeon.Data;
using Saga.Dungeon.UI;
using Saga.Dungeon.World;
using DungeonSave = Saga.Dungeon.Data.SaveState;

namespace Saga.EditorTools
{
    /// <summary>
    /// tasks U-0137 2나락 난도 평·험·절 진단 — `PlaytestDungeonHeadless` 무예 나무(tree) 뒤에 부른다(한 프레임 안).
    /// 다섯 줄: ① 표(웹 MODES 수치)·문턱(10·20층) ② 들머리(2층까지)에서만 바꿈·더 내려가면 고정 ③ 실제 방 — 같은 씨앗으로 평/험/절 2층 싸움 방을 지어 적 체력·피해·금·경험 배율
    /// ④ 부적 층 배율과 곱·목표판 줄 끝 ⑤ 저장 왕복·옛 세이브 평·설정 창 난도 단추. 층·난도·기록·난수는 떠 뒀다 되돌린다.
    /// </summary>
    public static class PlaytestDungeonMode
    {
        private const string T = "[PlaytestDungeonHeadless] mode";
        private static bool _ok, _step;

        public static bool Run()
        {
            _ok = true;
            string mode0 = DungeonMode.Snapshot();
            var rand0 = Random.state;
            var runner = DungeonFloorRunner.Instance;
            int floor0 = runner != null ? runner.CurrentFloor : 0;
            try
            {
                // ① 표·문턱
                Begin();
                var h = DungeonMode.Get("hard"); var x = DungeonMode.Get("hell");
                if (h.Hp != 1.8f || h.Dmg != 1.5f || h.Gold != 1.6f || x.Hp != 3.2f || x.Dmg != 2.2f || x.Gold != 2.4f || h.Need != 10 || x.Need != 20) Fail("표가 웹 MODES 와 다름");
                DungeonMode.BestForTest = 9;
                DungeonMode.Restore("normal");
                if (DungeonMode.Why("hard") != "locked" || DungeonMode.NextOpen() != "normal") Fail("9층인데 험이 열림");
                DungeonMode.BestForTest = 20;
                End("table OK - 험 1.8·1.5·1.6 / 절 3.2·2.2·2.4 · 9층 닫힘·20층 둘 다 열림");

                // ② 들머리에서만
                Begin();
                if (runner == null) Fail("층 진행기 없음");
                else
                {
                    runner.JumpToFloor(3);
                    if (DungeonMode.AtStart || DungeonMode.Choose("hard")) Fail($"{runner.CurrentFloor}층에서 난도가 바뀜");
                    runner.JumpToFloor(2);
                    if (!DungeonMode.AtStart || !DungeonMode.Choose("hard") || DungeonMode.Current.Key != "hard") Fail($"들머리({runner.CurrentFloor}층)에서 험이 안 골라짐");
                }
                End("start OK - 3층 거절·들머리 2층에서 고름(회차 고정)");

                // ③ 실제 방
                Begin();
                if (runner != null)
                {
                    runner.JumpToFloor(2);
                    var n = Room(runner, "normal"); var hd = Room(runner, "hard"); var hl = Room(runner, "hell");
                    if (n.Count == 0 || n.Count != hd.Count || n.Count != hl.Count) Fail($"같은 씨앗인데 적 수 {n.Count}/{hd.Count}/{hl.Count}");
                    else
                    {
                        for (int i = 0; i < n.Count; i++)
                        {
                            if (!Near(hd[i].hp, n[i].hp * 1.8f) || !Near(hl[i].hp, n[i].hp * 3.2f)) { Fail($"체력 {n[i].hp}→{hd[i].hp}/{hl[i].hp}"); break; }
                            if (!Near(hd[i].dmg, n[i].dmg * 1.5f) || !Near(hl[i].dmg, n[i].dmg * 2.2f)) { Fail($"피해 {n[i].dmg}→{hd[i].dmg}/{hl[i].dmg}"); break; }
                            if (!NearR(hd[i].gold, n[i].gold * 1.6f) || !NearR(hl[i].exp, n[i].exp * 2.2f)) { Fail($"금 {n[i].gold}→{hd[i].gold} · 경험 {n[i].exp}→{hl[i].exp}"); break; }  // 졸개 감산이 배율 뒤라 반올림이 두 번
                        }
                    }
                    End($"room OK - 2층 싸움 방 적 {n.Count} · 체력 ×1.8/×3.2 · 피해 ×1.5/×2.2 · 금 ×1.6 · 경험 ×2.2");
                }

                // ④ 부적 곱·목표판
                Begin();
                DungeonMode.Restore("hell");
                int sig = 0;
                for (int f = 2; f < 60 && sig == 0; f++) if (SigilState.IsSigilFloor(f) && SigilState.EnemyHpMultiplier(f) != 1f) sig = f;
                if (sig == 0) Fail("배율 있는 부적 층을 못 찾음");
                else if (runner != null)
                {
                    runner.JumpToFloor(sig);
                    var sn = Room(runner, "normal"); var sx = Room(runner, "hell");
                    if (sn.Count == 0 || sn.Count != sx.Count) Fail($"부적 {sig}층 방 적 {sn.Count}/{sx.Count}");
                    else for (int i = 0; i < sn.Count; i++) if (!Near(sx[i].hp, sn[i].hp * 3.2f)) { Fail($"부적 {sig}층 체력 {sn[i].hp}→{sx[i].hp} ≠ ×3.2"); break; }
                }
                if (!DungeonMode.HudSuffix.Contains(DungeonMode.Get("hell").Name)) Fail($"목표판 줄 끝 {DungeonMode.HudSuffix}");
                DungeonMode.Restore("normal");
                if (DungeonMode.HudSuffix.Length != 0) Fail("평인데 목표판에 난도");
                End($"sigil OK - 부적 {sig}층(×{SigilState.EnemyHpMultiplier(sig)}) 방도 평 대비 절 ×3.2 · 목표판 줄 끝 절·평이면 없음");

                // ⑤ 저장·단추
                Begin();
                DungeonMode.Restore("hard");
                string json = DungeonSave.ToJson();
                if (!json.Contains("\"mode\":\"hard\"")) Fail("세이브에 mode 없음");
                DungeonMode.Restore("normal");
                if (!DungeonSave.ApplyJson(json) || DungeonMode.Current.Key != "hard") Fail("저장 왕복 난도");
                if (!DungeonSave.ApplyJson(json.Replace("\"mode\":\"hard\",", "")) || DungeonMode.Current.Key != "normal") Fail("옛 세이브(없음)인데 평 아님");
                var settings = Object.FindFirstObjectByType<DungeonSettingsPanel>();
                if (settings == null || settings.ModeButton == null) Fail("설정 창 난도 단추 없음");
                End("save OK - mode 왕복·옛 세이브 평·설정 창 난도 단추");
            }
            finally
            {
                DungeonMode.BestForTest = null;
                DungeonMode.Restore(mode0);
                if (runner != null) runner.JumpToFloor(floor0 >= 2 ? floor0 : 2);
                Random.state = rand0;
            }
            return _ok;
        }

        private struct Foe { public float hp, dmg; public int gold, exp; }

        /// <summary>같은 씨앗으로 지금 층 싸움 방을 짓고 방 적(이름 Enemy_Floor*)의 값을 이름 순으로. mode null 이면 지금 난도.</summary>
        private static List<Foe> Room(DungeonFloorRunner runner, string mode)
        {
            if (mode != null) DungeonMode.Restore(mode);
            Random.InitState(20260824);
            runner.BuildRoomForTest("fight");
            var list = new List<(string, Foe)>();
            foreach (var e in runner.GetComponentsInChildren<DungeonEnemy>(true))
                if (e.name.StartsWith("Enemy_Floor")) list.Add((e.name + e.transform.localPosition, new Foe { hp = e.MaxHp, dmg = e.Damage, gold = e.RewardGold, exp = e.RewardExp }));
            list.Sort((a, b) => string.CompareOrdinal(a.Item1, b.Item1));
            return list.ConvertAll(t => t.Item2);
        }

        private static bool NearR(int a, float b) => Mathf.Abs(a - b) <= Mathf.Max(1.01f, b * 0.12f);

        private static bool Near(float a, float b) => Mathf.Abs(a - b) <= Mathf.Max(1.01f, Mathf.Abs(b) * 0.01f);

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
