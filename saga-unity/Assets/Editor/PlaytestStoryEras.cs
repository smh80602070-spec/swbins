using System.Collections.Generic;
using UnityEditor;
using UnityEngine;
using Saga.Story.Data;
using Saga.Story.World;

namespace Saga.EditorTools
{
    /// <summary>
    /// PLAN.md 109-3 "STORY 세 시대 사람·적" 진단 — `PlaytestStorySlice` 준비 단계(사실 모델 진단 뒤)가 부른다. 같은 프레임 안에서 끝낸다.
    /// 표(단계 넷 × 현대·미래 몸 여덟이 서로 다르고 옛 몸·손님 몸과 안 겹침) · 들판(열 자리 중 표의 넷만 다른 시대·이름·몸·키, 두목 그대로) ·
    /// "시간 틈" 알림(가까이 오면 이름마다 한 번) · 비경 해시 몫(층 1~5 보통 전투 잡졸 약 40%) · 실제 비경 전투 방(단계마다 시대 잡졸 이름·몸, 정예는 그대로) ·
    /// 들판 손님 둘(현대·미래·몸·싸움길 뒤·잡졸/NPC 와 떨어짐·대사 넷 돌림).
    /// 끝나면 플레이어 자리·비경 상태를 시작 때로(비경은 슬라이스 준비 단계와 같은 초기화).
    /// </summary>
    public static class PlaytestStoryEras
    {
        private const string T = "[PlaytestStorySlice] eras";
        private static bool _ok;

        public static bool Run()
        {
            _ok = true;
            var playerGo = GameObject.FindWithTag("Player");
            if (playerGo == null) { Fail("플레이어 없음"); return false; }
            var cc = playerGo.GetComponent<CharacterController>();
            Vector3 pos = playerGo.transform.position;
            // 비경 전투 클리어는 노드 경험치를 준다 — 뒤 단계(전직 Lv.10·15 전제)가 흔들리지 않게 되돌린다.
            int level0 = StoryJobState.Level;
            float exp0 = StoryJobState.Exp;
            string job0 = StoryJobState.Job;
            float mp0 = StoryCombat.Mp;
            var before = new HashSet<GameObject>(UnityEngine.SceneManagement.SceneManager.GetActiveScene().GetRootGameObjects());
            string m = "";
            StoryEras.SnapshotStories(out var storyIds0, out var storyCounts0);
            try
            {
                m += CheckFolkStory(); // 사연은 처음 상태에서 — 뒤 대사 진단은 사연을 다 들은 것으로 시작한다
                var ids = new string[StoryEras.FolkList.Length];
                var counts = new int[ids.Length];
                for (int i = 0; i < ids.Length; i++) { ids[i] = StoryEras.FolkList[i].Id; counts[i] = 99; }
                StoryEras.RestoreStories(ids, counts);
                m += CheckTable() + CheckField(playerGo.transform) + CheckShares() + CheckLabyrinth() + CheckFolk();
            }
            finally
            {
                StoryEras.RestoreStories(storyIds0, storyCounts0);
                StoryLabyrinthState.ResetForTest();
                StoryLabyrinthState.Restore(0, 0);
                StoryEnemy.ResetAnnouncements();
                StoryJobState.Restore(level0, exp0, job0);
                StoryCombat.RestoreMp(mp0);
                // 비경 전투 타격이 남긴 데칼·전리품·타격 효과 — 뒤 단계의 데칼 캡(32) 검사가 막히지 않게 이 진단이 만든 것만 지운다.
                foreach (var go in UnityEngine.SceneManagement.SceneManager.GetActiveScene().GetRootGameObjects())
                    if (!before.Contains(go) && (go.GetComponent<StoryGroundDecal>() != null || go.GetComponent<StoryLootMarker>() != null
                        || go.GetComponent<DamagePopup>() != null || go.name.StartsWith("HitSpark")))
                        Object.DestroyImmediate(go);
                if (cc != null) cc.enabled = false;
                playerGo.transform.position = pos;
                if (cc != null) cc.enabled = true;
            }
            if (_ok) Debug.Log($"{T} OK - 표(몸 여덟·옛 몸과 안 겹침)·들판 넷(이름·몸·키)·두목 그대로·시간 틈 알림·비경 몫·단계별 실제 전투 방·정예 그대로·손님 둘(몸·자리·대사 돌림) |{m}");
            return _ok;
        }

        /// <summary>PLAN.md 109-16 곁가지 side_guests — 사연 넷 토막 차례로·끝 토막에 경험치 한 번·다 들으면 예전 대사·세이브 왕복.</summary>
        private static string CheckFolkStory()
        {
            StoryEras.RestoreStories(null, null);
            var folks = Object.FindObjectsByType<StoryEraFolk>(FindObjectsSortMode.None);
            if (folks.Length != StoryEras.FolkList.Length) Fail($"들판 손님 {folks.Length}");
            foreach (var f in folks)
            {
                var d = f.Data;
                if (!StoryEras.HasStory(d.Id)) { Fail($"{d.Id} 사연 없음"); continue; }
                int n = StoryEras.StoryLength(d.Id);
                if (n != 4) Fail($"{d.Id} 사연 {n}토막");
                float exp = StoryJobState.Exp; int lv = StoryJobState.Level;
                for (int i = 0; i < n; i++)
                {
                    string line = f.Speak();
                    if (!line.Contains(StoryEras.StoryLine(d.Id, i)) || !line.Contains($"{i + 1}/{n}")) Fail($"{d.Id} 사연 {i + 1}토막 {line}");
                    bool gained = StoryJobState.Level != lv || StoryJobState.Exp > exp;
                    if (i < n - 1 && gained) Fail($"{d.Id} 끝 토막 전에 경험치가 들어옴");
                    if (i == n - 1 && !gained) Fail($"{d.Id} 끝 토막에 경험치가 없음");
                }
                float exp2 = StoryJobState.Exp; int lv2 = StoryJobState.Level;
                string after = f.Speak();
                if (after.Contains("/4") || StoryJobState.Level != lv2 || StoryJobState.Exp != exp2) Fail($"{d.Id} 사연 뒤엔 예전 대사여야(경험치 다시 없음) {after}");
                f.ResetSaid();
            }
            string json = StorySaveState.ToJson();
            if (!json.Contains("folkStoryIds")) Fail("세이브 필드");
            StoryEras.RestoreStories(null, null);
            StorySaveState.ApplyJson(json);
            if (StoryEras.StoryHeardCount("photographer") != 4) Fail("사연 세이브 왕복");
            return "손님 사연(둘·넷 토막 차례·끝 토막 경험치 한 번·다 들으면 예전 대사·세이브 왕복) · ";
        }

        private static string CheckTable()
        {
            var bodies = new HashSet<string>();
            var names = new HashSet<string>();
            for (int t = 0; t < StoryEras.TierCount; t++)
            {
                if (StoryEras.Foes[t, 0].Era != StoryEra.Modern || StoryEras.Foes[t, 1].Era != StoryEra.Future) Fail($"단계 {t} 시대 칸 순서");
                for (int e = 0; e < 2; e++)
                {
                    var f = StoryEras.Foes[t, e];
                    if (!bodies.Add(f.Body)) Fail($"몸 {f.Body} 겹침");
                    if (!names.Add(f.NameKo) || f.NameKo == "황건적") Fail($"이름 {f.NameKo} 겹침");
                    if (System.Array.IndexOf(StoryEras.OldBodies, f.Body) >= 0) Fail($"몸 {f.Body} 가 옛 몸과 같음");
                }
            }
            foreach (var folk in StoryEras.FolkList)
                if (!bodies.Add(folk.Body) || System.Array.IndexOf(StoryEras.OldBodies, folk.Body) >= 0) Fail($"손님 몸 {folk.Body} 가 적·옛 몸과 같음");
            if (StoryEras.Tier(0) != 0 || StoryEras.Tier(1) != 1 || StoryEras.Tier(2) != 1 || StoryEras.Tier(3) != 2 || StoryEras.Tier(5) != 3) Fail("단계 경계");
            return $" 몸 {bodies.Count}";
        }

        private static string CheckField(Transform player)
        {
            var field = new List<StoryEnemy>();
            StoryEnemy boss = null;
            foreach (var e in StoryEnemy.All)
            {
                if (e == null || e.transform.parent == null || e.transform.parent.GetComponent<StoryEnemySpawner>() == null) continue;
                if (e.IsBoss) boss = e; else field.Add(e);
            }
            field.Sort((a, b) => a.transform.position.x.CompareTo(b.transform.position.x));
            if (field.Count != FieldMapData.EnemyPositionsM().Length) { Fail($"들판 잡졸 {field.Count}"); return ""; }
            if (boss == null || boss.Era != StoryEra.Past) Fail("두목이 없거나 과거가 아님");

            int other = 0, rigged = 0;
            var eras = new HashSet<StoryEra>();
            StoryEnemy pastOne = null;
            for (int i = 0; i < field.Count; i++)
            {
                var e = field[i];
                var want = StoryEras.FieldEra(i);
                if (e.Era != want) Fail($"들판 {i} 번 시대 {e.Era} ≠ {want}");
                if (want == StoryEra.Past) { if (pastOne == null) pastOne = e; if (e.DisplayName == "") Fail("황건적 이름 빔"); continue; }
                other++;
                eras.Add(want);
                var foe = StoryEras.FoeFor(0, want);
                if (e.DisplayName != StoryEras.FoeName(foe)) Fail($"들판 {i} 번 이름 {e.DisplayName} ≠ {foe.NameKo}");
                if (AssetDatabase.LoadAssetAtPath<GameObject>(SetupNpcCharacterImports.PrefabPath(foe.Body)) == null) continue;
                string ctrl = ControllerOf(e);
                if (ctrl != foe.Body) Fail($"들판 {i} 번 몸 {ctrl} ≠ {foe.Body}");
                else rigged++;
                float h = Height(e);
                float wantH = 1.6f * foe.HeightMul;
                if (Mathf.Abs(h - wantH) > wantH * 0.15f) Fail($"들판 {i} 번 {foe.Body} 키 {h:F2} ≠ {wantH:F2}");
            }
            if (other * 10 != field.Count * 4) Fail($"들판 다른 시대 {other}/{field.Count}(40%)");
            if (eras.Count != 2) Fail("들판에 현대·미래 둘 다가 아님");

            // "시간 틈" 알림 — 가까이 오면 이름마다 한 번, 과거 잡졸은 안 알린다.
            StoryEnemy.ResetAnnouncements();
            var cc = player.GetComponent<CharacterController>();
            StoryEnemy firstEra = null;
            foreach (var e in field) if (e.Era != StoryEra.Past) { firstEra = e; break; }
            if (firstEra != null)
            {
                Place(cc, player, new Vector3(firstEra.transform.position.x - 30f, player.position.y, 0f));
                if (firstEra.CheckAnnounce()) Fail("멀리서 알림");
                Place(cc, player, new Vector3(firstEra.transform.position.x - 2f, player.position.y, 0f));
                if (!firstEra.CheckAnnounce() || !StoryEnemy.WasAnnounced(firstEra.DisplayName))
                    Fail($"가까이 와도 알림 없음(dx {player.position.x - firstEra.transform.position.x:F1}, 죽음 {firstEra.IsDead}, 이름 {firstEra.DisplayName})");
                if (firstEra.CheckAnnounce()) Fail("알림이 두 번");
            }
            if (pastOne != null)
            {
                Place(cc, player, new Vector3(pastOne.transform.position.x, player.position.y, 0f));
                if (pastOne.CheckAnnounce()) Fail("황건적도 알림");
            }
            return $" 들판 다른 시대 {other}/{field.Count}(사실 몸 {rigged})";
        }

        private static string CheckShares()
        {
            int n = 0, mo = 0, fu = 0;
            for (int f = 1; f <= 5; f++)
                for (int c = 0; c < 40; c++)
                    for (int i = 0; i < 2; i++)
                    {
                        n++;
                        var e = StoryEras.LabyrinthEra(f, c, i);
                        if (e != StoryEras.LabyrinthEra(f, c, i)) Fail("해시가 부를 때마다 다름");
                        if (e == StoryEra.Modern) mo++; else if (e == StoryEra.Future) fu++;
                    }
            float share = (float)(mo + fu) / n;
            if (share < 0.34f || share > 0.46f) Fail($"비경 몫 {share:P0}");
            if (mo < n / 8 || fu < n / 8) Fail($"현대 {mo}·미래 {fu} 쏠림");
            return $" 비경 몫 {share:P0}(현대 {mo}·미래 {fu})";
        }

        private static string CheckLabyrinth()
        {
            var runner = StoryLabyrinthRunner.Instance;
            if (runner == null) { Fail("비경 실행기 없음"); return ""; }
            StoryLabyrinthState.ResetForTest();
            StoryLabyrinthState.Restore(0, 0);
            runner.StartRunWithSeed(20260824);
            var seen = new HashSet<string>();
            int rigged = 0;
            for (int floor = 1; floor <= 5; floor++)
            {
                while (StoryLabyrinthState.Floor < floor) StoryLabyrinthState.AdvanceFloor();
                int tier = StoryEras.Tier(floor);
                // 이 층에서 시대 잡졸이 나올 때까지 보통 전투를 몇 번(해시라 곧 나온다).
                bool found = false;
                for (int tries = 0; tries < 12 && !found; tries++)
                {
                    bool cleared = false;
                    runner.EnterNode(StoryLabyrinthData.NodeType.Combat, () => cleared = true);
                    if (runner.ActiveArenaEnemies.Count != 2) { Fail($"{floor}층 전투 잡졸 {runner.ActiveArenaEnemies.Count}"); break; }
                    int combat = runner.CombatCount - 1;
                    for (int i = 0; i < runner.ActiveArenaEnemies.Count; i++)
                    {
                        var e = runner.ActiveArenaEnemies[i];
                        var want = StoryEras.LabyrinthEra(floor, combat, i);
                        if (e.Era != want) Fail($"{floor}층 전투 {combat} 자리 {i} 시대 {e.Era} ≠ {want}");
                        if (want == StoryEra.Past) continue;
                        var foe = StoryEras.FoeFor(tier, want);
                        if (e.DisplayName != StoryEras.FoeName(foe)) Fail($"{floor}층 이름 {e.DisplayName} ≠ {foe.NameKo}");
                        if (AssetDatabase.LoadAssetAtPath<GameObject>(SetupNpcCharacterImports.PrefabPath(foe.Body)) != null)
                        {
                            if (ControllerOf(e) != foe.Body) Fail($"{floor}층 몸 {ControllerOf(e)} ≠ {foe.Body}");
                            else rigged++;
                        }
                        seen.Add(foe.Body);
                        found = true;
                    }
                    foreach (var e in new List<StoryEnemy>(runner.ActiveArenaEnemies)) e.TakeDamage(99999f);
                    InvokePrivate(runner, "Update");
                    if (!cleared) Fail($"{floor}층 전투가 안 끝남");
                }
                if (!found) Fail($"{floor}층 전투 12번에 시대 잡졸 없음");
            }
            // 정예는 그대로 — 클리어하면 보너스 카드가 끼니 확인만 하고 물러난다(슬라이스 비경 진단이 정예 클리어를 따로 본다).
            runner.EnterNode(StoryLabyrinthData.NodeType.Elite, () => { });
            if (runner.ActiveArenaEnemies.Count != 1) Fail($"정예 {runner.ActiveArenaEnemies.Count}");
            foreach (var e in runner.ActiveArenaEnemies) if (e.Era != StoryEra.Past) Fail("정예가 시대 적");
            runner.AbandonRun();
            return $" 비경 시대 몸 {seen.Count}가지(사실 몸 {rigged})";
        }

        private static string CheckFolk()
        {
            var folks = Object.FindObjectsByType<StoryEraFolk>(FindObjectsSortMode.None);
            if (folks.Length != StoryEras.FolkList.Length) { Fail($"손님 {folks.Length} ≠ {StoryEras.FolkList.Length}"); return ""; }
            var others = new List<float>();
            foreach (var x in FieldMapData.EnemyPositionsM()) others.Add(x);
            others.Add(FieldMapData.Rope().X);
            foreach (var n in new[] { "Npc_Scout", "Npc_JobTrainer" }) { var go = GameObject.Find(n); if (go != null) others.Add(go.transform.position.x); }
            var eras = new HashSet<StoryEra>();
            int rigged = 0;
            foreach (var f in folks)
            {
                var d = f.Data;
                eras.Add(d.Era);
                if (d.Era == StoryEra.Past) Fail($"{d.Id} 가 과거 사람");
                if (Mathf.Abs(f.transform.position.z - StoryEras.FolkLaneZ) > 0.01f || Mathf.Abs(f.transform.position.x - d.X) > 0.01f) Fail($"{d.Id} 자리");
                foreach (var x in others) if (Mathf.Abs(x - d.X) < 2f) Fail($"{d.Id} 가 잡졸·NPC(x {x:F1})와 {Mathf.Abs(x - d.X):F1}m");
                var lines = new HashSet<string>();
                for (int i = 0; i < d.LinesKo.Length; i++) lines.Add(f.Speak());
                if (lines.Count != d.LinesKo.Length) Fail($"{d.Id} 대사 {lines.Count}가지");
                if (f.Speak() != $"{StoryEras.FolkName(d)} — {StoryEras.FolkLine(d, 0)}") Fail($"{d.Id} 대사가 한 바퀴 뒤 처음으로 안 돎");
                if (AssetDatabase.LoadAssetAtPath<GameObject>(SetupNpcCharacterImports.PrefabPath(d.Body)) == null) continue;
                var anim = f.transform.Find("Visual")?.GetComponentInChildren<Animator>();
                string ctrl = anim != null && anim.runtimeAnimatorController != null ? anim.runtimeAnimatorController.name : "";
                if (ctrl != d.Body) Fail($"{d.Id} 몸 {ctrl} ≠ {d.Body}"); else rigged++;
            }
            if (!eras.Contains(StoryEra.Modern) || !eras.Contains(StoryEra.Future)) Fail("손님이 현대·미래 둘 다가 아님");
            return $" 손님 {folks.Length}(사실 몸 {rigged})";
        }

        private static string ControllerOf(StoryEnemy e)
        {
            var visual = e.transform.Find("Visual");
            var anim = visual != null ? visual.GetComponentInChildren<Animator>() : null;
            return anim != null && anim.runtimeAnimatorController != null ? anim.runtimeAnimatorController.name : "";
        }

        private static float Height(StoryEnemy e)
        {
            var visual = e.transform.Find("Visual");
            if (visual == null) return 0f;
            bool any = false;
            Bounds b = default;
            foreach (var r in visual.GetComponentsInChildren<Renderer>())
            {
                if (!any) { b = r.bounds; any = true; } else b.Encapsulate(r.bounds);
            }
            return any ? b.size.y : 0f;
        }

        private static void Place(CharacterController cc, Transform player, Vector3 p)
        {
            if (cc != null) cc.enabled = false;
            player.position = p;
            if (cc != null) cc.enabled = true;
        }

        private static void InvokePrivate(object target, string method)
        {
            var mi = target.GetType().GetMethod(method, System.Reflection.BindingFlags.NonPublic | System.Reflection.BindingFlags.Public | System.Reflection.BindingFlags.Instance);
            mi?.Invoke(target, null);
        }

        private static void Fail(string msg)
        {
            _ok = false;
            Debug.LogError($"{T}: {msg}");
        }
    }
}
