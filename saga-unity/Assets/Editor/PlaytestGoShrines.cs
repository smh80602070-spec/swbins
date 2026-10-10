using System.Collections.Generic;
using System.IO;
using System.Linq;
using System.Reflection;
using UnityEngine;
using Saga.Go.Data;
using Saga.Go.World;

namespace Saga.EditorTools
{
    /// <summary>
    /// tasks U-0081 — 사가만리 산신당(MountainShrine)·동쪽 숲 유적(EastGroveRelic)·은닉 보물(HiddenTreasure)·행운 돌탑(LuckyCairn) 제 동작 진단.
    /// `PlaytestHeadless` 가 플레이 모드에서 부른다(보상 길 OnTriggerEnter 가 Destroy 를 불러 편집 모드에선 오류 로그가 난다 — 플레이 모드면 프레임 끝으로 미뤄진다).
    /// 셋(산신당·유적·보물)은 평생 한 번(WorldEventState id) — 주인공 아닌 것엔 안 줌 · 첫 번째에 금(25/15/20)·경험·(보물은 wp_relic) · 두 번째 무효 ·
    /// 이미 받았으면 새로 세워도 자리를 안 잡음(Awake 가 스스로 지움) · 세이브 JSON 왕복 후에도 받은 기록 유지.
    /// 돌탑은 반복(20초 쿨다운·소원 3냥·무작위 결과) — 결과 금 변화가 {−3,+2,+12,+17} 중 하나 · 쿨다운 안 두 번째 무효 · 3냥 없으면 못 빎.
    /// 끝나면 받은 기록·돈·레벨/경험·소지품·세이브 파일·돌탑 쿨다운을 되돌린다.
    /// </summary>
    public static class PlaytestGoShrines
    {
        private static string _tag;
        private static bool _ok;

        public static bool Run(string tag)
        {
            _tag = tag;
            _ok = true;
            var player = GameObject.FindWithTag("Player");
            var pcol = player != null ? player.GetComponent<Collider>() : null;
            if (pcol == null) { Fail("주인공(Player 태그·충돌체) 없음"); return false; }

            var flags = new List<string>(WorldEventState.TriggeredIds);
            int gold = GoldState.Gold; int level = PlayerStats.Level; long exp = PlayerStats.Exp;
            var owned = new List<string>(Inventory.OwnedIds); string wpn = Inventory.EquippedWeaponId, arm = Inventory.EquippedArmorId;
            string savePath = Path.Combine(Application.persistentDataPath, SaveState.FileName);
            string saveText = File.Exists(savePath) ? File.ReadAllText(savePath) : null;
            bool dailyOff = DailyTaskState.OffForTest;
            var notes = new List<string>();
            var cleanup = new List<GameObject>();
            try
            {
                DailyTaskState.OffForTest = true;   // 돌탑 소원이 일일 의뢰 보상으로 돈을 바꾸지 않게
                notes.Add(Once<MountainShrine>("shrine_blessing", 25, pcol, cleanup, 8f));
                notes.Add(Once<EastGroveRelic>("east_grove_relic", 15, pcol, cleanup, 6f));
                notes.Add(Once<HiddenTreasure>("cave_treasure", 20, pcol, cleanup, 6f, "wp_relic"));
                notes.Add(Cairn(pcol));

                // 세이브 왕복 — 받은 기록 셋이 JSON 을 지나도 남는다
                string json = SaveState.ToJson();
                WorldEventState.Restore(null);
                SaveState.ApplyJson(json);
                foreach (var id in new[] { "shrine_blessing", "east_grove_relic", "cave_treasure" })
                    if (!WorldEventState.IsTriggered(id)) Fail($"세이브 왕복 뒤 {id} 기록이 사라짐");
                notes.Add("세이브 왕복 기록 셋 유지");
            }
            catch (System.Exception e) { Fail("예외 " + e); }
            finally
            {
                foreach (var g in cleanup) if (g != null) Object.Destroy(g);
                WorldEventState.Restore(flags);
                GoldState.Restore(gold);
                PlayerStats.Restore(level, exp);
                Inventory.Restore(owned, wpn, arm);
                DailyTaskState.OffForTest = dailyOff;
                if (saveText != null) File.WriteAllText(savePath, saveText); else if (File.Exists(savePath)) File.Delete(savePath);
            }
            if (_ok) Debug.Log($"[{_tag}] shrines OK - {string.Join(" | ", notes)}");
            return _ok;
        }

        private static void Enter(MonoBehaviour c, Collider who) =>
            c.GetType().GetMethod("OnTriggerEnter", BindingFlags.NonPublic | BindingFlags.Instance).Invoke(c, new object[] { who });

        /// <summary>평생 한 번 갈래 — 씬의 진짜 물체로 받기·두 번째 무효, 새로 세운 물체로 "이미 받았으면 자리 안 잡음".</summary>
        private static string Once<T>(string id, int rewardGold, Collider pcol, List<GameObject> cleanup, float radius, string item = null) where T : MonoBehaviour
        {
            string name = typeof(T).Name;
            var c = Object.FindFirstObjectByType<T>();
            if (c == null) { Fail($"{name} 이 씬에 없음(씬 재빌드?)"); return name + " ×"; }
            WorldEventState.Restore(WorldEventState.TriggeredIds.Where(x => x != id).ToList());

            // 주인공 아닌 것은 무시
            var other = new GameObject("__notPlayer", typeof(SphereCollider)); cleanup.Add(other);
            int g0 = GoldState.Gold;
            Enter(c, other.GetComponent<Collider>());
            if (GoldState.Gold != g0 || WorldEventState.IsTriggered(id)) Fail($"{name}: 주인공 아닌 것에 반응");

            // 첫 번째 — 금·경험·(물건)·기록
            int lv0 = PlayerStats.Level; long ex0 = PlayerStats.Exp;
            bool had = item != null && Inventory.OwnedIds.Contains(item);
            Enter(c, pcol);
            if (GoldState.Gold != g0 + rewardGold) Fail($"{name}: 금 {g0}→{GoldState.Gold}(+{rewardGold} 이어야)");
            if (PlayerStats.Level == lv0 && PlayerStats.Exp <= ex0) Fail($"{name}: 경험이 안 오름");
            if (!WorldEventState.IsTriggered(id)) Fail($"{name}: {id} 기록 없음");
            if (item != null && !had && !Inventory.OwnedIds.Contains(item)) Fail($"{name}: {item} 을 안 줌");

            // 두 번째 — 무효(이번 프레임엔 아직 안 지워졌다)
            int g1 = GoldState.Gold;
            Enter(c, pcol);
            if (GoldState.Gold != g1) Fail($"{name}: 두 번째에도 금 {g1}→{GoldState.Gold}");

            // 이미 받았으면 새로 세워도 자리를 안 잡는다(Awake 가 Build 전에 지움) / 안 받았으면 자리를 잡는다
            var again = new GameObject("__" + name); cleanup.Add(again);
            again.AddComponent<SphereCollider>();
            again.AddComponent<T>();
            float rTaken = again.GetComponent<SphereCollider>().radius;
            WorldEventState.Restore(WorldEventState.TriggeredIds.Where(x => x != id).ToList());
            var fresh = new GameObject("__" + name + "_fresh"); cleanup.Add(fresh);
            fresh.AddComponent<SphereCollider>();
            fresh.AddComponent<T>();
            float rFresh = fresh.GetComponent<SphereCollider>().radius;
            WorldEventState.TryTrigger(id);   // 받은 상태로 되돌려 다음 갈래·세이브 왕복으로
            if (Mathf.Approximately(rTaken, radius)) Fail($"{name}: 이미 받았는데 새 물체가 자리를 잡음(반경 {rTaken})");
            if (!Mathf.Approximately(rFresh, radius)) Fail($"{name}: 안 받은 새 물체가 자리를 안 잡음(반경 {rFresh} ≠ {radius})");
            return $"{name} 금 +{rewardGold}·한 번만·재생성 막힘";
        }

        /// <summary>행운 돌탑 — 반복·20초 쿨다운·소원 3냥·결과 넷.</summary>
        private static string Cairn(Collider pcol)
        {
            var c = Object.FindFirstObjectByType<LuckyCairn>();
            if (c == null) { Fail("LuckyCairn 이 씬에 없음"); return "돌탑 ×"; }
            var last = typeof(LuckyCairn).GetField("_lastWishTime", BindingFlags.NonPublic | BindingFlags.Instance);
            float lastWas = (float)last.GetValue(c);
            var deltas = new HashSet<int>();
            var randWas = Random.state;   // 뒤 진단이 쓰는 전역 난수를 안 흔든다
            try
            {
                Random.InitState(20260824);
                for (int i = 0; i < 12; i++)
                {
                    last.SetValue(c, Time.time - 21f);
                    GoldState.Restore(100);
                    Enter(c, pcol);
                    int d = GoldState.Gold - 100;
                    if (d != -3 && d != 2 && d != 12 && d != 17) Fail($"돌탑: 금 변화 {d}(−3·+2·+12·+17 중 하나여야)");
                    deltas.Add(d);
                    // 쿨다운 안 두 번째 — 무효
                    int g = GoldState.Gold;
                    Enter(c, pcol);
                    if (GoldState.Gold != g) Fail($"돌탑: 20초 안 두 번째에도 금 {g}→{GoldState.Gold}");
                }
                // 3냥 없으면 못 빎
                last.SetValue(c, Time.time - 21f);
                GoldState.Restore(2);
                Enter(c, pcol);
                if (GoldState.Gold != 2) Fail($"돌탑: 2냥인데 소원이 빌어짐(금 {GoldState.Gold})");
            }
            finally { last.SetValue(c, lastWas); Random.state = randWas; }
            if (deltas.Count < 2) Fail($"돌탑: 12번 빌어도 결과가 한 가지뿐({string.Join(",", deltas)}) — 무작위가 안 됨");
            return $"돌탑 12번 결과 {string.Join("/", deltas.OrderBy(x => x))}·쿨다운·3냥";
        }

        private static void Fail(string msg)
        {
            Debug.LogError($"[{_tag}] shrines: {msg}");
            _ok = false;
        }
    }
}
