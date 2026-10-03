using System.Collections.Generic;
using System.Text.RegularExpressions;
using UnityEditor;
using UnityEditor.SceneManagement;
using UnityEngine;
using Saga.Forest.Data;
using Saga.Forest.World;

namespace Saga.EditorTools
{
    /// <summary>
    /// 탑성 조각 번들(tasks U-0029) 진단 — 규칙(조각 여섯 키·이름 서로 다름 · 한 조각씩 Record, 여섯째에만 Completed 한 번 ·
    /// 네 갈래 집계 불변)·세이브(왕복·옛 세이브)와 씬(TestVillageForest 를 편집 모드로 열어 돌무더기 여섯이 꽃밭 명소 둘레에 서는지 ·
    /// 두 번 불러도 안 늘어남 · 정자는 완성 뒤 한 번만).
    /// `-executeMethod Saga.EditorTools.PlaytestForestRuinBundle.RunBatch` → "[PlaytestForestRuinBundle] OK/FAIL". 장면은 저장하지 않는다.
    /// </summary>
    public static class PlaytestForestRuinBundle
    {
        private const string ScenePath = "Assets/Scenes/TestVillageForest.unity";

        [MenuItem("Saga/Playtest Forest Ruin Bundle")]
        public static void RunBatch()
        {
            PlaytestKit.Begin("[PlaytestForestRuinBundle]");
            string json0 = ForestSaveState.ToJson();
            using (PlaytestKit.ErrorCounter())
            {
                try
                {
                    CheckRules();
                    CheckAggregatesUntouched();
                    CheckSave();
                    CheckScene();
                }
                finally
                {
                    ForestRuinBundle.ResetForTest();
                    ForestSaveState.ApplyJson(json0);
                }
            }
            PlaytestKit.Summary("PlaytestForestRuinBundle");
            if (Application.isBatchMode) EditorApplication.Exit(PlaytestKit.Fails == 0 ? 0 : 1);
        }

        private static void CheckRules()
        {
            var keys = ForestRuinBundle.Keys;
            PlaytestKit.Check(keys.Length == 6 && ForestRuinBundle.Total == 6 && new HashSet<string>(keys).Count == 6, "조각 키가 여섯·서로 다름이 아님");
            var names = new HashSet<string>();
            foreach (var k in keys)
            {
                string n = ForestRuinBundle.DisplayName(k);
                PlaytestKit.Check(!string.IsNullOrEmpty(n) && n != k && names.Add(n), $"조각 {k} 이름이 비었거나 겹침: {n}");
            }
            // 웹 `ruin` 표와 같은 한국어 이름(현지화 표가 한국어일 때)
            if (ForestLocalization.CurrentLanguage == "ko")
                PlaytestKit.Check(ForestRuinBundle.DisplayName("rooftile") == "옛 기와 조각" && ForestRuinBundle.DisplayName("postkey") == "옛 우체통 열쇠", "웹 조각 이름과 다름");

            ForestRuinBundle.ResetForTest();
            int done = 0;
            ForestRuinBundle.Completed += () => done++;
            // 처음엔 빔 · 모르는 키는 안 센다
            PlaytestKit.Check(ForestRuinBundle.FoundCount == 0 && !ForestRuinBundle.IsCompleted, "진단 준비: 초기화");
            PlaytestKit.Check(!ForestRuinBundle.Record("nope") && !ForestRuinBundle.Record(null) && !ForestRuinBundle.Record("") && ForestRuinBundle.FoundCount == 0, "모르는 키가 기록됨");
            for (int i = 0; i < keys.Length - 1; i++)
            {
                PlaytestKit.Check(ForestRuinBundle.Record(keys[i]), $"{keys[i]} 첫 기록이 새로 아님");
                PlaytestKit.Check(!ForestRuinBundle.Record(keys[i]), $"{keys[i]} 다시 기록이 새로 침");
                PlaytestKit.Check(ForestRuinBundle.FoundCount == i + 1 && !ForestRuinBundle.IsCompleted && done == 0, $"{i + 1}번째에 벌써 완성/개수 어긋남(done={done})");
            }
            PlaytestKit.Check(ForestRuinBundle.Record(keys[5]) && ForestRuinBundle.IsCompleted && done == 1, $"여섯째에 완성이 안 됨(done={done})");
            PlaytestKit.Check(!ForestRuinBundle.Record(keys[5]) && !ForestRuinBundle.Record(keys[0]) && done == 1, "완성 뒤 다시 줍기가 Completed 를 또 쏨");
            ForestRuinBundle.ResetForTest();
            PlaytestKit.Check(!ForestRuinBundle.IsCompleted && ForestRuinBundle.FoundCount == 0, "ResetForTest 가 안 비움");
        }

        // 보너스 갈래 — 조각을 다 모아도 네 갈래 도감·마을 점수·시나리오 채집 개수가 그대로여야 한다.
        private static void CheckAggregatesUntouched()
        {
            ForestRuinBundle.ResetForTest();
            var cats = (ForestMuseumState.Category[])System.Enum.GetValues(typeof(ForestMuseumState.Category));
            PlaytestKit.Check(cats.Length == 4, $"도감 갈래 {cats.Length} ≠ 4(조각이 다섯째 값으로 끼면 안 된다)");
            string museum0 = string.Join("|", ForestMuseumState.Snapshot());
            int allDone0 = ForestMuseumState.AllBundlesDone ? 1 : 0;
            int total0 = ForestTownScore.Total(), points0 = ForestTownScore.MuseumPoints(), disc0 = ForestTownScore.MuseumDiscoveredTotal();
            int fruit0 = ForestState.FruitCount;
            var gather0 = new List<int>();
            var bundle0 = new List<bool>();
            foreach (var c in cats) { gather0.Add(ForestScenario.GatherCount(c)); bundle0.Add(ForestMuseumState.IsBundleDone(c)); }

            foreach (var k in ForestRuinBundle.Keys) ForestRuinBundle.Record(k);
            PlaytestKit.Check(ForestRuinBundle.IsCompleted, "진단 준비: 여섯 조각을 다 모음");

            PlaytestKit.Check(string.Join("|", ForestMuseumState.Snapshot()) == museum0, "조각이 도감 기록을 바꿈");
            PlaytestKit.Check((ForestMuseumState.AllBundlesDone ? 1 : 0) == allDone0, "조각이 네 갈래 다 채움을 바꿈");
            PlaytestKit.Check(ForestTownScore.Total() == total0 && ForestTownScore.MuseumPoints() == points0 && ForestTownScore.MuseumDiscoveredTotal() == disc0, "조각이 마을 평가를 바꿈");
            PlaytestKit.Check(ForestState.FruitCount == fruit0, "조각이 과일을 바꿈");
            for (int i = 0; i < cats.Length; i++)
            {
                PlaytestKit.Check(ForestScenario.GatherCount(cats[i]) == gather0[i], $"조각이 시나리오 채집 개수({cats[i]})를 바꿈");
                PlaytestKit.Check(ForestMuseumState.IsBundleDone(cats[i]) == bundle0[i], $"조각이 {cats[i]} 갈래 완성을 바꿈");
            }
            ForestRuinBundle.ResetForTest();
        }

        private static void CheckSave()
        {
            ForestRuinBundle.ResetForTest();
            ForestRuinBundle.Record("wallstone");
            ForestRuinBundle.Record("postkey");
            string json = ForestSaveState.ToJson();
            PlaytestKit.Check(Regex.IsMatch(json, "\"ruinPieces\":\\[[^\\]]*\"wallstone\"[^\\]]*\\]") && json.Contains("\"postkey\""), "세이브 JSON 에 조각이 없다");
            ForestRuinBundle.ResetForTest();
            PlaytestKit.Check(ForestRuinBundle.FoundCount == 0, "진단 준비: 초기화");
            PlaytestKit.Check(ForestSaveState.ApplyJson(json) && ForestRuinBundle.FoundCount == 2 && ForestRuinBundle.IsFound("wallstone") && ForestRuinBundle.IsFound("postkey") && !ForestRuinBundle.IsFound("rafter") && !ForestRuinBundle.IsCompleted, "세이브 왕복");
            // 옛 세이브 — 필드가 아예 없다(앞 세션에서 모은 조각은 남지 않고 빔)
            string old = Regex.Replace(json, "\"ruinPieces\":\\[[^\\]]*\\],?", "");
            PlaytestKit.Check(old != json && !old.Contains("ruinPieces"), "진단 준비: 옛 세이브 JSON 을 못 만듦");
            ForestRuinBundle.Record("rafter");
            PlaytestKit.Check(ForestSaveState.ApplyJson(old) && ForestRuinBundle.FoundCount == 0 && !ForestRuinBundle.IsCompleted, "옛 세이브(필드 없음)인데 조각이 남음");
            // 여섯을 다 모은 세이브는 불러도 Completed 를 안 쏘고(이벤트 없이) 완성 상태만 되돌린다
            foreach (var k in ForestRuinBundle.Keys) ForestRuinBundle.Record(k);
            string full = ForestSaveState.ToJson();
            ForestRuinBundle.ResetForTest();
            int fired = 0;
            System.Action onDone = () => fired++;
            ForestRuinBundle.Completed += onDone;
            bool ok = ForestSaveState.ApplyJson(full);
            ForestRuinBundle.Completed -= onDone;
            PlaytestKit.Check(ok && ForestRuinBundle.IsCompleted && ForestRuinBundle.FoundCount == 6 && fired == 0, $"완성 세이브 복원(fired={fired})");
            // 모르는 키는 조용히 버린다
            ForestRuinBundle.Restore(new[] { "rooftile", "ghost", "", null });
            PlaytestKit.Check(ForestRuinBundle.FoundCount == 1 && ForestRuinBundle.IsFound("rooftile"), "모르는 키가 복원됨");
        }

        private static void CheckScene()
        {
            ForestRuinBundle.ResetForTest();
            EditorSceneManager.OpenScene(ScenePath, OpenSceneMode.Single);
            PlaytestKit.Check(ForestRubbleSpot.Spots().Length == 0, "진단 준비: 장면에 돌무더기가 이미 있다");

            var spots = ForestRubbleSpot.Install();
            PlaytestKit.Check(spots.Length == 6, $"돌무더기 {spots.Length} ≠ 6");
            Vector3 c = ForestRubbleSpot.RuinCenter();
            PlaytestKit.Check(Vector2.Distance(new Vector2(c.x, c.z), ForestBiomeData.Zones[3].LandmarkPos) < 1e-4f && ForestBiomeData.Zones[3].Key == "flower_field", "폐허 자리가 꽃밭 명소가 아님");
            var keys = new HashSet<string>();
            var list = new List<Vector3>();
            foreach (var s in spots)
            {
                Vector3 p = s.transform.position;
                float d = Vector2.Distance(new Vector2(p.x, p.z), new Vector2(c.x, c.z));
                PlaytestKit.Check(d <= 5f, $"{s.name} 이 꽃밭 명소에서 {d:0.0}m(>5)");
                PlaytestKit.Check(d >= 2f, $"{s.name} 이 명소 기둥에 {d:0.0}m 로 붙었다(<2)");
                PlaytestKit.Check(ForestBiomeData.ZoneAt(p.x, p.z) == 3, $"{s.name} 이 꽃밭 존 밖");
                PlaytestKit.Check(keys.Add(s.PieceKey), $"{s.name} 조각 키 겹침 {s.PieceKey}");
                foreach (var o in list) PlaytestKit.Check(Vector3.Distance(o, p) >= 1.5f, $"{s.name} 이 다른 돌무더기에 1.5m 안으로 붙었다");
                list.Add(p);
            }
            PlaytestKit.Check(keys.Count == 6, "돌무더기가 여섯 조각을 하나씩 안 맡음");
            // 두 번 불러도 안 늘어남
            PlaytestKit.Check(ForestRubbleSpot.Install().Length == 6 && ForestRubbleSpot.Spots().Length == 6 && Object.FindObjectsByType<ForestRubbleSpot>(FindObjectsSortMode.None).Length == 6, "두 번째 Install 이 또 세웠다");

            // 정자 — 완성 뒤 한 번만(두 번 불러도 같은 것)
            PlaytestKit.Check(GameObject.Find(ForestMuseumDecorator.RebuiltGazeboName) == null, "진단 준비: 정자가 이미 있다");
            var g1 = ForestMuseumDecorator.SpawnRebuiltGazebo(ForestMuseumDecorator.RebuiltGazeboPos);
            var g2 = ForestMuseumDecorator.SpawnRebuiltGazebo(ForestMuseumDecorator.RebuiltGazeboPos);
            PlaytestKit.Check(g1 != null && g1 == g2 && CountNamed(ForestMuseumDecorator.RebuiltGazeboName) == 1, "정자를 두 번 지음");
            PlaytestKit.Check(g1 != null && g1.transform.childCount == 6, $"정자 조각 {(g1 != null ? g1.transform.childCount : -1)} ≠ 6(기둥 넷+지붕 둘)");
            EditorSceneManager.NewScene(NewSceneSetup.EmptyScene, NewSceneMode.Single);   // 연 장면은 저장하지 않고 버린다
        }

        private static int CountNamed(string name)
        {
            int n = 0;
            foreach (var go in Object.FindObjectsByType<Transform>(FindObjectsSortMode.None)) if (go.name == name) n++;
            return n;
        }
    }
}
