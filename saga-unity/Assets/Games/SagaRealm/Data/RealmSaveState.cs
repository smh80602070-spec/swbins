using System;
using System.Collections.Generic;
using System.IO;
using UnityEngine;

namespace Saga.Realm.Data
{
    /// <summary>
    /// VERTICAL_SLICE_REALM.md 5절 "저장한다 → 다시 켜서 이어진다" —
    /// 여러 성 확장(2-4절 참고, 개념만) 이후로는 성마다의 아홉 필드도
    /// 함께 저장한다. 3절(전쟁) 이후로는 적국 상태(성벽·병력·함락 여부)도
    /// 같이 저장 — 병력·성벽이 두 번의 공격에 걸쳐 이어지려면 필요하다.
    /// **51장 "대규모 콘텐츠"(2026-09-14)로 정도가 둘째 목표로 붙으면서
    /// 고정 필드 다섯 개(xiaopeiWall 등)를 `RealmEnemyCity.AllIds` 전부를
    /// 도는 `List&lt;EnemySave&gt;`로 바꿨다** — `SaveVersion`을 3→4로 올렸다
    /// (구조가 달라 옛 v3 세이브는 자동 무시되고 새 게임으로 시작한다 —
    /// PLAN.md 28장 "Version 필드" 대비 그대로, 마이그레이션 경로는 안
    /// 만든다).
    /// </summary>
    public static class RealmSaveState
    {
        private const int SaveVersion = 4;

        /// <summary>PLAN.md 110 ② — 타이틀이 "이어하기/새로 시작"을 가른다.</summary>
        public const string FileName = "save_realm.json";
        private static string SavePath => Path.Combine(Application.persistentDataPath, FileName);
        public static bool HasSave => File.Exists(SavePath);

        public static void DeleteSave()
        {
            try { if (File.Exists(SavePath)) File.Delete(SavePath); }
            catch (Exception e) { Debug.LogWarning($"[RealmSaveState] 세이브 삭제 실패: {e.Message}"); }
        }

        [Serializable]
        private class CitySave
        {
            public string cityId;
            public int agri, comm, tech, sec, wall, train, ships, pop, troops, food;
        }

        [Serializable]
        private class EnemySave
        {
            public string enemyId;
            public int wall, maxWall, troops, train, tech;
            public bool captured;
        }

        [Serializable]
        private class SaveData
        {
            public int version;
            public int gold;
            public int year;
            public int month;
            public string currentCity;
            public List<string> roster;
            public List<string> done;
            public List<string> found;
            public List<string> officerCityIds;
            public List<string> officerCityCities;
            public List<CitySave> cities;
            public List<EnemySave> enemies;
            // REALM 다음 조각 (3) 문답 — 세이브 버전은 안 올렸다(JsonUtility는
            // 없는 필드를 기본값/null로 채워 읽으니, 옛 v3 세이브를 불러와도
            // RealmQuizState.Restore(null,...)이 그냥 빈 상태로 시작할 뿐 깨지지
            // 않는다).
            public List<string> quizLearned;
            public List<string> quizWrongIds;
            public List<int> quizWrongCounts;
            public int quizTotal, quizCorrect, quizStreak, quizBestStreak;
            // 101-2 5-1 "인물 특성·야망"(2026-09-20) — 특성·야망 종류·목표는
            // id 해시로 결정적이라(RealmOfficerTraits.cs 클래스 주석) 세이브가
            // 필요 없고, 달성 여부만 저장한다. quiz 필드와 같은 이유로 버전을
            // 안 올렸다 — 없는 필드는 JsonUtility가 null로 채워 옛 세이브도 그냥
            // "아직 아무도 달성 안 함" 상태로 시작한다.
            public List<string> officerAmbitionsDone;
            // 101-2 5-5 "승리 조건"(2026-09-20) — 결과는 Kind enum 이름
            // 문자열 하나뿐(닫힌 판이라 "언제·어느 조건"만 있으면 된다).
            // quiz·야망 필드와 같은 이유로 버전을 안 올린다 — 없는 필드는
            // JsonUtility가 null로 채워 옛 세이브도 RealmVictoryState.Restore(null)
            // 로 "아직 안 끝남" 상태로 시작한다.
            public string victoryResult;
            // PLAN.md 109-15 명마·비행 — 날 탈것 고르기 + 장착 표(장수 → 말, 나란한 두 배열). victoryResult 와 같은 이유로 버전을 안 올린다 —
            // 없는 필드는 null 로 들어와 옛 세이브는 "안 고름·장착 없음".
            public string mountSel;
            public string[] mountEqOfficers;
            public string[] mountEqMounts;
        }

        /// <summary>PlaytestRealmSlice.cs 전용 — GameBootstrap.Awake()가
        /// 매 Play 시작마다 TryLoad()를 부르기 때문에, 이전 헤드리스
        /// 실행이 남긴 세이브 파일이 있으면 "새 게임 시작 상태"를 전제로
        /// 하는 테스트의 Init 단계가 깨진다(2026-09-13 계략 슬라이스
        /// 추가 중 실제로 겪음 — persistentDataPath는 Unity 프로세스가
        /// 바뀌어도 그대로 남는다). 실제 게임 코드 경로에선 안 쓴다.</summary>
        public static void DeleteForTest()
        {
            try { if (File.Exists(SavePath)) File.Delete(SavePath); }
            catch (Exception e) { Debug.LogWarning($"[RealmSaveState] 테스트용 세이브 삭제 실패: {e.Message}"); }
        }

        public static bool Save()
        {
            try
            {
                File.WriteAllText(SavePath, ToJson());
                return true;
            }
            catch (Exception e)
            {
                Debug.LogWarning($"[RealmSaveState] 저장 실패: {e.Message}");
                return false;
            }
        }

        /// <summary>PLAN.md 110 ② — 지금 상태를 세이브 JSON 으로. 플레이어가 없으면(타이틀) 자리 없이 —
        /// 타이틀이 앱을 켤 때 "새 게임 기본값"을 떠 두고 "새로 시작" 때 <see cref="ApplyJson"/> 으로 되돌린다.</summary>
        public static string ToJson()
        {
            var cities = new List<CitySave>();
            foreach (var snap in RealmCityState.SnapshotCities())
            {
                cities.Add(new CitySave
                {
                    cityId = snap.CityId, agri = snap.Agri, comm = snap.Comm, tech = snap.Tech, sec = snap.Sec,
                    wall = snap.Wall, train = snap.Train, ships = snap.Ships, pop = snap.Pop, troops = snap.Troops, food = snap.Food,
                });
            }

            var officerCityIds = new List<string>();
            var officerCityCities = new List<string>();
            foreach (var id in RealmCityState.RosterIds)
            {
                officerCityIds.Add(id);
                officerCityCities.Add(RealmCityState.OfficerCityId(id));
            }

            var enemies = new List<EnemySave>();
            foreach (var enemyId in RealmEnemyCity.AllIds)
            {
                var snap = RealmWarState.Snapshot(enemyId);
                enemies.Add(new EnemySave
                {
                    enemyId = enemyId, wall = snap.wall, maxWall = snap.maxWall,
                    troops = snap.troops, train = snap.train, tech = snap.tech, captured = snap.captured,
                });
            }

            var data = new SaveData
            {
                version = SaveVersion,
                gold = RealmCityState.Gold,
                year = RealmCityState.Year,
                month = RealmCityState.Month,
                currentCity = RealmCityState.CurrentCity,
                roster = new List<string>(RealmCityState.RosterIds),
                done = BuildDoneSnapshot(),
                found = new List<string>(RealmCityState.FoundIds),
                officerCityIds = officerCityIds,
                officerCityCities = officerCityCities,
                cities = cities,
                enemies = enemies,
                quizLearned = RealmQuizState.SnapshotLearned(),
                quizWrongIds = RealmQuizState.SnapshotWrongIds(),
                quizWrongCounts = RealmQuizState.SnapshotWrongCounts(),
                quizTotal = RealmQuizState.GetProgress().Answered,
                quizCorrect = RealmQuizState.GetProgress().Correct,
                quizStreak = RealmQuizState.GetProgress().Streak,
                quizBestStreak = RealmQuizState.GetProgress().BestStreak,
                officerAmbitionsDone = RealmOfficerTraits.SnapshotDone(),
                victoryResult = RealmVictoryState.SnapshotResult(),
                mountSel = RealmMounts.Snapshot(),
            };
            RealmMounts.SnapshotEq(out data.mountEqOfficers, out data.mountEqMounts);
            return JsonUtility.ToJson(data);
        }

        public static bool TryLoad()
        {
            if (!File.Exists(SavePath)) return false;

            string json;
            try
            {
                json = File.ReadAllText(SavePath);
            }
            catch (Exception e)
            {
                Debug.LogWarning($"[RealmSaveState] 로드 실패: {e.Message}");
                return false;
            }
            return ApplyJson(json);
        }

        /// <summary>PLAN.md 110 ② — 세이브 JSON 을 상태에 적용(파일 로드·"새로 시작" 기본값 둘 다). 자리가 없으면 플레이어는 안 옮긴다.</summary>
        public static bool ApplyJson(string json)
        {
            SaveData data;
            try
            {
                data = JsonUtility.FromJson<SaveData>(json);
            }
            catch (Exception e)
            {
                Debug.LogWarning($"[RealmSaveState] 로드 실패: {e.Message}");
                return false;
            }
            if (data == null || data.version != SaveVersion) return false;

            var cities = new List<RealmCityState.CitySnapshot>();
            if (data.cities != null)
            {
                foreach (var c in data.cities)
                {
                    cities.Add(new RealmCityState.CitySnapshot
                    {
                        CityId = c.cityId, Agri = c.agri, Comm = c.comm, Tech = c.tech, Sec = c.sec,
                        Wall = c.wall, Train = c.train, Ships = c.ships, Pop = c.pop, Troops = c.troops, Food = c.food,
                    });
                }
            }

            RealmCityState.Restore(data.gold, data.year, data.month, data.currentCity,
                data.roster, data.done, data.found, data.officerCityIds, data.officerCityCities, cities);
            if (data.enemies != null)
            {
                foreach (var e in data.enemies)
                {
                    RealmWarState.Restore(e.enemyId, e.wall, e.maxWall, e.troops, e.train, e.tech, e.captured);
                }
            }
            RealmQuizState.Restore(data.quizLearned, data.quizWrongIds, data.quizWrongCounts,
                data.quizTotal, data.quizCorrect, data.quizStreak, data.quizBestStreak);
            RealmOfficerTraits.Restore(data.officerAmbitionsDone);
            RealmVictoryState.Restore(data.victoryResult);
            RealmMounts.Restore(data.mountSel, data.mountEqOfficers, data.mountEqMounts);
            return true;
        }

        private static List<string> BuildDoneSnapshot()
        {
            var result = new List<string>();
            foreach (var id in RealmCityState.RosterIds)
            {
                if (RealmCityState.IsOfficerDone(id)) result.Add(id);
            }
            return result;
        }
    }
}
