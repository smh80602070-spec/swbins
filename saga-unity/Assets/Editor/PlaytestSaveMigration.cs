using UnityEditor;
using UnityEngine;
using Saga.Realm.Data;
using GoSave = Saga.Go.Data.SaveState;
using DungeonSave = Saga.Dungeon.Data.SaveState;
using ForestSave = Saga.Forest.Data.ForestSaveState;
using StorySave = Saga.Story.Data.StorySaveState;

namespace Saga.EditorTools
{
    /// <summary>
    /// 세이브 버전 검사·마이그레이션 진단(tasks U-0005) — `SaveMigrator` 를 쓰는 다섯 판을 JSON fixture 로 본다.
    /// REALM 은 옛 v3(소패 고정 필드) → `enemies` 로 이어지는지, 나머지는 옛 버전이 읽히고 미래 버전(99)은 거절되는지.
    /// `-executeMethod Saga.EditorTools.PlaytestSaveMigration.Run` → "[PlaytestSaveMigration] OK/FAIL". 실제 세이브는 격리한다.
    /// </summary>
    public static class PlaytestSaveMigration
    {
        [MenuItem("Saga/Playtest Save Migration")]
        public static void Run()
        {
            PlaytestKit.Begin("[PlaytestSaveMigration]");
            using (PlaytestKit.IsolatedSaves())
            using (PlaytestKit.ErrorCounter())
            {
                CheckRealm();
                CheckGo();
                CheckLenient("DUNGEON", DungeonSave.ToJson(), DungeonSave.ApplyJson);
                CheckLenient("FOREST", ForestSave.ToJson(), ForestSave.ApplyJson);
                CheckLenient("STORY", StorySave.ToJson(), StorySave.ApplyJson);
            }
            PlaytestKit.Summary("PlaytestSaveMigration");
            if (Application.isBatchMode) EditorApplication.Exit(PlaytestKit.Fails == 0 ? 0 : 1);
        }

        private static string Ver(string json, int from, int to) => json.Replace($"\"version\":{from}", $"\"version\":{to}");

        private static void CheckRealm()
        {
            string cur = RealmSaveState.ToJson();
            var before = new (int wall, int maxWall, int troops, int train, int tech, bool captured)[RealmEnemyCity.AllIds.Length];
            for (int i = 0; i < before.Length; i++) before[i] = RealmWarState.Snapshot(RealmEnemyCity.AllIds[i]);

            string v3 = Ver(cur, 4, 3);
            PlaytestKit.Check(v3 != cur, "REALM fixture 에서 \"version\":4 를 못 찾음");
            int a = v3.IndexOf("\"enemies\":[");
            int b = a < 0 ? -1 : v3.IndexOf(']', a);
            PlaytestKit.Check(a >= 0 && b > a, "REALM fixture 에서 enemies 목록을 못 찾음");
            if (a >= 0 && b > a)
            {
                // 옛 필드는 SaveData 에 있어 ToJson 이 0 으로 내보낸다 — 중복 키를 만들지 않게 그 값을 바꾼다.
                v3 = v3.Remove(a, b - a + 1).Replace(",,", ",");
                v3 = v3.Replace("\"xiaopeiWall\":0", "\"xiaopeiWall\":1234").Replace("\"xiaopeiMaxWall\":0", "\"xiaopeiMaxWall\":5000")
                    .Replace("\"xiaopeiTroops\":0", "\"xiaopeiTroops\":777").Replace("\"xiaopeiTrain\":0", "\"xiaopeiTrain\":60")
                    .Replace("\"xiaopeiTech\":0", "\"xiaopeiTech\":90").Replace("\"xiaopeiCaptured\":false", "\"xiaopeiCaptured\":true");
                PlaytestKit.Check(RealmSaveState.ApplyJson(v3), "REALM v3 세이브가 안 읽힘(이어받기 실패)");
                var s = RealmWarState.Snapshot(RealmEnemyCity.XiaopeiId);
                PlaytestKit.Check(s.wall == 1234 && s.troops == 777 && s.captured, $"REALM v3 소패 값이 안 이어짐 wall={s.wall} troops={s.troops} captured={s.captured}");
            }
            PlaytestKit.Check(!RealmSaveState.ApplyJson(Ver(cur, 4, 99)), "REALM 미래 버전(99)이 받아들여짐");
            PlaytestKit.Check(!RealmSaveState.ApplyJson(Ver(cur, 4, 2)), "REALM 경로 없는 옛 버전(2)이 받아들여짐");
            PlaytestKit.Check(RealmSaveState.ApplyJson(cur), "REALM 현재 세이브가 안 읽힘");

            for (int i = 0; i < before.Length; i++)
            {
                var x = before[i];
                RealmWarState.Restore(RealmEnemyCity.AllIds[i], x.wall, x.maxWall, x.troops, x.train, x.tech, x.captured);
            }
        }

        private static void CheckGo()
        {
            string cur = GoSave.ToJson();
            int v = ReadVersion(cur);
            PlaytestKit.Check(GoSave.ApplyJson(Ver(cur, v, v - 1)), $"GO v{v - 1} 세이브가 안 읽힘");
            PlaytestKit.Check(GoSave.ApplyJson(Ver(cur, v, 27)), "GO v27 세이브가 안 읽힘");
            PlaytestKit.Check(!GoSave.ApplyJson(Ver(cur, v, 99)), "GO 미래 버전(99)이 받아들여짐");
            PlaytestKit.Check(GoSave.ApplyJson(cur), "GO 현재 세이브가 안 읽힘");
        }

        private static void CheckLenient(string tag, string cur, System.Func<string, bool> apply)
        {
            int v = ReadVersion(cur);
            PlaytestKit.Check(v > 0, $"{tag} 현재 버전을 못 읽음");
            PlaytestKit.Check(apply(cur), $"{tag} 현재 세이브가 안 읽힘");
            PlaytestKit.Check(!apply(Ver(cur, v, 99)), $"{tag} 미래 버전(99)이 받아들여짐");
        }

        private static int ReadVersion(string json)
        {
            const string key = "\"version\":";
            int i = json.IndexOf(key);
            if (i < 0) return 0;
            i += key.Length;
            int j = i;
            while (j < json.Length && char.IsDigit(json[j])) j++;
            return int.TryParse(json.Substring(i, j - i), out int v) ? v : 0;
        }
    }
}
