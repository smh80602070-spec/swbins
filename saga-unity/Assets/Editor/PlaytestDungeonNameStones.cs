using System.Collections.Generic;
using System.Text.RegularExpressions;
using UnityEditor;
using UnityEditor.SceneManagement;
using UnityEngine;
using Saga.Dungeon.Data;
using Saga.Dungeon.World;

namespace Saga.EditorTools
{
    /// <summary>
    /// 지워진 이름의 비석(tasks U-0028) 진단 — 규칙(웹 해시와 같은 이름 4건·스물네 이름 서로 다름·마을마다 한 번만 금·세이브 왕복·옛 세이브)과
    /// 씬(TestDungeon 을 편집 모드로 열어 마을 방마다 비석이 서는지·방 안·다른 것에서 떨어짐·두 번 불러도 안 늘어남·같은 입력이면 같은 자리).
    /// `-executeMethod Saga.EditorTools.PlaytestDungeonNameStones.RunBatch` → "[PlaytestDungeonNameStones] OK/FAIL". 장면은 저장하지 않는다.
    /// </summary>
    public static class PlaytestDungeonNameStones
    {
        private const string ScenePath = "Assets/Scenes/TestDungeon.unity";

        [MenuItem("Saga/Playtest Dungeon Name Stones")]
        public static void RunBatch()
        {
            PlaytestKit.Begin("[PlaytestDungeonNameStones]");
            string json0 = SaveState.ToJson();
            using (PlaytestKit.ErrorCounter())
            {
                try
                {
                    CheckRules();
                    CheckSave();
                    CheckScene();
                }
                finally
                {
                    DungeonNameStones.ResetForTest();
                    SaveState.ApplyJson(json0);
                }
            }
            PlaytestKit.Summary("PlaytestDungeonNameStones");
            if (Application.isBatchMode) EditorApplication.Exit(PlaytestKit.Fails == 0 ? 0 : 1);
        }

        private static void CheckRules()
        {
            // 웹 town.js nameStoneNameOf 와 같은 해시 — node 로 뽑은 값(abc→5번 이든, Town2→5번 이든, moru→8번 보리, village_01→15번 슬기)
            PlaytestKit.Check(DungeonNameStones.NameOf("abc") == "이든" && DungeonNameStones.NameOf("Town2") == "이든" && DungeonNameStones.NameOf("moru") == "보리" && DungeonNameStones.NameOf("village_01") == "슬기",
                $"이름 해시가 웹과 다름: abc={DungeonNameStones.NameOf("abc")} Town2={DungeonNameStones.NameOf("Town2")} moru={DungeonNameStones.NameOf("moru")} village_01={DungeonNameStones.NameOf("village_01")}");
            PlaytestKit.Check(DungeonNameStones.Names.Length == 24 && new HashSet<string>(DungeonNameStones.Names).Count == 24, "이름이 스물넷·서로 다름이 아님");
            PlaytestKit.Check(DungeonNameStones.NameOf("") == DungeonNameStones.NameOf(null), "빈 id·null 이 다름");

            DungeonNameStones.ResetForTest();
            int gold0 = HeroState.Gold;
            PlaytestKit.Check(DungeonNameStones.Claim("Town2", out string n1) && n1 == DungeonNameStones.NameOf("Town2"), "첫 밟기가 처음이 아님");
            PlaytestKit.Check(HeroState.Gold == gold0 + DungeonNameStones.RewardGold && DungeonNameStones.RewardGold == 600 + 8 * DungeonRegionFoes.GoldPerMerit, $"첫 밟기 금 {HeroState.Gold - gold0}");
            int gold1 = HeroState.Gold;
            PlaytestKit.Check(!DungeonNameStones.Claim("Town2", out string n2) && n2 == n1 && HeroState.Gold == gold1 && DungeonNameStones.Count == 1, "두 번째 밟기가 금을 또 줌");
            PlaytestKit.Check(DungeonNameStones.Claim("Town3", out _) && DungeonNameStones.Count == 2 && DungeonNameStones.IsFound("Town3") && !DungeonNameStones.IsFound("Town4"), "마을마다 따로 기록 안 됨");
            PlaytestKit.Check(!DungeonNameStones.Claim("", out _) && !DungeonNameStones.Claim(null, out _), "빈 id 가 기록됨");
        }

        private static void CheckSave()
        {
            DungeonNameStones.ResetForTest();
            DungeonNameStones.Claim("Town2", out _);
            DungeonNameStones.Claim("Town4", out _);
            string json = SaveState.ToJson();
            PlaytestKit.Check(json.Contains("\"nameStoneTowns\":[\"Town2\",\"Town4\"]"), "세이브 JSON 에 비석 마을이 없다");
            DungeonNameStones.ResetForTest();
            PlaytestKit.Check(DungeonNameStones.Count == 0, "진단 준비: 초기화");
            PlaytestKit.Check(SaveState.ApplyJson(json) && DungeonNameStones.Count == 2 && DungeonNameStones.IsFound("Town2") && DungeonNameStones.IsFound("Town4"), "세이브 왕복");
            PlaytestKit.Check(DungeonNameStones.FoundName("Town4") == DungeonNameStones.NameOf("Town4"), "왕복 뒤 이름이 달라짐");
            // 옛 세이브 — 비석 필드가 아예 없다
            string old = Regex.Replace(json, ",\"nameStoneTowns\":\\[[^\\]]*\\],\"nameStoneNames\":\\[[^\\]]*\\]", "");
            PlaytestKit.Check(old != json && !old.Contains("nameStone"), "진단 준비: 옛 세이브 JSON 을 못 만듦");
            PlaytestKit.Check(SaveState.ApplyJson(old) && DungeonNameStones.Count == 0, "옛 세이브(필드 없음)인데 비석이 남음");
            // 길이가 어긋난 짧은 배열은 받는 만큼만, 빈 이름은 다시 정한다
            DungeonNameStones.Restore(new[] { "Town3", "Town2" }, new[] { "" });
            PlaytestKit.Check(DungeonNameStones.Count == 2 && DungeonNameStones.FoundName("Town3") == DungeonNameStones.NameOf("Town3"), "짧은 이름 배열 복원");
        }

        private static void CheckScene()
        {
            DungeonNameStones.ResetForTest();
            EditorSceneManager.OpenScene(ScenePath, OpenSceneMode.Single);
            var stones = NameStoneSpawner.SpawnAll();
            var towns = new List<string>();
            foreach (var set in DungeonEraDecor.Towns) if (!set.Id.StartsWith("Crossroads") && GameObject.Find(set.Id) != null) towns.Add(set.Id);
            PlaytestKit.Check(towns.Count >= 3, $"마을 방이 {towns.Count} 개뿐");
            PlaytestKit.Check(stones.Count == towns.Count, $"비석 {stones.Count} ≠ 마을 {towns.Count}");
            var positions = new Dictionary<string, Vector3>();
            foreach (var st in stones)
            {
                var room = GameObject.Find(st.TownId);
                if (room == null) { PlaytestKit.Fail("비석의 마을 방이 없다: " + st.TownId); continue; }
                Vector3 d = st.transform.position - room.transform.position;
                PlaytestKit.Check(Mathf.Abs(d.x) <= 6f && Mathf.Abs(d.z) <= 6f, $"{st.TownId} 비석이 방 가운데 둘레(±6m) 밖: {d}");
                PlaytestKit.Check(st.transform.parent == room.transform, $"{st.TownId} 비석이 방 아래에 안 섬");
                float gap = float.MaxValue;
                foreach (var o in NameStoneSpawner.Avoid(room))
                {
                    if ((o - st.transform.position).sqrMagnitude < 1e-6f) continue;
                    gap = Mathf.Min(gap, Vector2.Distance(new Vector2(o.x, o.z), new Vector2(st.transform.position.x, st.transform.position.z)));
                }
                PlaytestKit.Check(gap >= 1.5f, $"{st.TownId} 비석이 다른 것에 {gap:0.0}m 로 붙었다");
                positions[st.TownId] = st.transform.position;
                PlaytestKit.Check(st.transform.childCount == 2, $"{st.TownId} 비석 그림 조각 {st.transform.childCount}");
            }
            // 두 번 불러도 안 늘어남
            PlaytestKit.Check(NameStoneSpawner.SpawnAll().Count == 0, "두 번째 SpawnAll 이 또 세웠다");
            // 밟기 — 처음엔 금·기록, 다음엔 이름만
            if (stones.Count > 0)
            {
                var st = stones[0];
                int g0 = HeroState.Gold;
                string first = st.Touch();
                PlaytestKit.Check(first.Contains(DungeonNameStones.NameOf(st.TownId)) && HeroState.Gold == g0 + DungeonNameStones.RewardGold && DungeonNameStones.IsFound(st.TownId), "비석 첫 밟기");
                string again = st.Touch();
                PlaytestKit.Check(again != first && again.Contains(DungeonNameStones.NameOf(st.TownId)) && HeroState.Gold == g0 + DungeonNameStones.RewardGold, "비석 두 번째 밟기");
            }
            // 같은 입력이면 같은 자리 — 지우고 다시
            foreach (var st in stones) Object.DestroyImmediate(st.gameObject);
            var again2 = NameStoneSpawner.SpawnAll();
            foreach (var st in again2)
                PlaytestKit.Check(positions.TryGetValue(st.TownId, out var p) && (p - st.transform.position).sqrMagnitude < 1e-6f, $"{st.TownId} 다시 세우니 자리가 달라짐");
            EditorSceneManager.NewScene(NewSceneSetup.EmptyScene, NewSceneMode.Single);   // 연 장면은 저장하지 않고 버린다
        }
    }
}
