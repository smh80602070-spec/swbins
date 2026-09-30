using System;
using System.Collections.Generic;
using System.IO;
using UnityEngine;
using Saga.Core;

namespace Saga.Story.Data
{
    /// <summary>
    /// VERTICAL_SLICE_STORY.md 1절 완료 조건 "저장한다 → 다시 켜서
    /// 이어진다" — SagaDungeon `Data/SaveState.cs`와 같은 구조(로컬 파일
    /// 하나, 버전 필드). 파일명은 다르다(`save_story.json`, 다섯 판이
    /// 세이브 키를 따로 쓰는 것과 같은 원칙, 루트 CLAUDE.md).
    /// 저장하는 것 — 위치 + 사명("첫 사냥") 진행도(장비는 이 슬라이스에
    /// 없다 — 1절 "제외" 목록에 없는 것은 애초에 저장할 상태 자체가
    /// 없다). **2026-09-15부터 레벨업(level/exp/job)도 추가됐다** — 아래
    /// SaveVersion 6 항목 참고.
    /// </summary>
    public static class StorySaveState
    {
        // v6 — "STORY 확장 — 전직·SP 투자 UI"(2026-09-15), level/exp/job
        // 추가. 구버전 세이브는 level/exp가 기본값(0)으로 들어오는데,
        // StoryJobState.Restore()가 Mathf.Max(1, level)로 최소 1레벨을
        // 보장해 무해하다(job도 빈 문자열→"none"으로 정규화).
        private const int SaveVersion = 6;

        /// <summary>PLAN.md 110 ② — 타이틀이 "이어하기/새로 시작"을 가른다.</summary>
        public const string FileName = "save_story.json";
        private static string SavePath => Path.Combine(Application.persistentDataPath, FileName);
        public static bool HasSave => File.Exists(SavePath);

        public static void DeleteSave()
        {
            try { if (File.Exists(SavePath)) File.Delete(SavePath); }
            catch (Exception e) { Debug.LogWarning($"[StorySaveState] 세이브 삭제 실패: {e.Message}"); }
        }

        // 101-2 5-4 "관문 대장" — godot `current_week()`와 같은 결
        // (Time.get_unix_time_from_system()/(86400*7)의 정수 몫 — 달력
        // 요일 기준이 아니라 그냥 7일 창이다, 실제 플레이 텀에서 체감 차이 없음).
        private static int _championWeek; // 0 = 아직 못 받음(실제 주 index는 항상 0보다 훨씬 크다).

        private static int CurrentWeekIndex() => (int)(DateTimeOffset.UtcNow.ToUnixTimeSeconds() / (7 * 86400));

        /// <summary>이번 주에 아직 관문 대장 보상을 못 받았으면 true —
        /// `StoryEnemy.TryBecomeChampion()`이 이걸로 챔피언 승격 여부를 정한다.</summary>
        public static bool ChampionAvailable() => _championWeek != CurrentWeekIndex();

        public static void ClaimChampion() => _championWeek = CurrentWeekIndex();

        /// <summary>109-16 시나리오 `gate` 단계 — 관문 대장을 한 번이라도 이겼다(주 번호가 0 이 아니다).</summary>
        public static bool ChampionEverClaimed => _championWeek != 0;

        /// <summary>PlaytestStorySlice.cs 전용 — 세이브 round-trip 진단이
        /// TryLoad() 전에 상태를 실제로 흩트리려고 쓴다(다른 XxxState류의
        /// Restore(기본값)과 같은 자리). 실제 게임 코드 경로에선 안 쓴다.</summary>
        public static void ResetChampionForTest() => _championWeek = 0;

        [Serializable]
        private class SaveData
        {
            public int version;
            public float[] playerPos;
            public int kills;
            public int bossKills;
            public string[] triggeredEvents;
            public int scoutTalkCount;
            public int choiceMade;
            public int level;
            public float exp;
            public string job;
            // 101-2 5-4 "관문 대장"(2026-09-20) — 이번 주에 이미 챔피언
            // 보상을 받았는지(주 index, 0=아직 없음). quiz류와 같은 이유로
            // 버전을 안 올린다 — 없는 필드는 JsonUtility가 0으로 채워
            // 옛 세이브도 "아직 안 받음"으로 시작한다.
            public int championWeek;
            // 101-2 5-3 "비경"(2026-09-20) — 회차 진행 자체는 메모리만
            // 두지만(StoryLabyrinthState.cs 클래스 주석) 확정된 기억
            // 조각·영구 강화 단수는 championWeek와 같은 이유로 버전을
            // 안 올린다 — 없는 필드는 0으로 채워져 옛 세이브도 "기억
            // 조각 0·강화 0단"으로 무해하게 시작한다.
            public int memoryShards;
            public int memoryTier;
            // 101-2 5-8 "동료 교대"(2026-09-21) — championWeek와 같은 이유로
            // 버전을 안 올린다. 없는 필드는 0(선봉)으로 채워져 옛 세이브도
            // "선두 1인" 기본값과 같아 무해하다(웹판 "없으면 선두 1인").
            public int partyActiveIndex;
            // 101-2 5-2 1단계 "직업 무예·SP"(2026-09-23) — championWeek와 같은 이유로 버전을
            // 안 올린다. JsonUtility가 Dictionary를 못 써서 나란한 두 배열로 담는다. 옛
            // 세이브엔 둘 다 없어 null로 들어오고 `StorySkillState.Restore()`가 빈 상태로
            // 시작한다(웹판도 SP 자체는 파생값이라 안 담는다 — 찍은 레벨만 담는 것도 같다).
            public string[] skillKeys;
            public int[] skillLevels;
            // 5-2 3단계(2026-09-23) "칸 고정" — 같은 이유로 버전 안 올림. 옛 세이브는 null →
            // 고정 없음(자동 배치만, 예전과 같다).
            public string[] skillPins;
            // PLAN.md 109-15 탈것 — 고른 탈것(탄 채는 저장 안 함). 버전 그대로: 옛 세이브는 null → 안 고른 채.
            public string mountSel;
            // PLAN.md 109-16 시나리오 진행. 버전 그대로: 없는 세이브(null)는 레벨·전직으로 지나온 장을 끝낸 것으로(RestoreLegacy).
            public string scenarioJson;
            public string[] folkStoryIds; // 곁가지 — 들판 시대 손님 사연을 들은 토막 수(버전 그대로: 옛 세이브는 null → 처음부터)
            public int[] folkStoryCounts;
        }

        public static bool Save()
        {
            if (FindPlayer() == null) return false;
            try
            {
                File.WriteAllText(SavePath, ToJson());
                return true;
            }
            catch (Exception e)
            {
                Debug.LogWarning($"[StorySaveState] 저장 실패: {e.Message}");
                return false;
            }
        }

        /// <summary>PLAN.md 110 ② — 지금 상태를 세이브 JSON 으로. 플레이어가 없으면(타이틀) 자리 없이 —
        /// 타이틀이 앱을 켤 때 "새 게임 기본값"을 떠 두고 "새로 시작" 때 <see cref="ApplyJson"/> 으로 되돌린다.</summary>
        public static string ToJson()
        {
            Transform player = FindPlayer();

            var events = new List<string>(StoryWorldEventState.TriggeredIds);
            StorySkillState.Snapshot(out var skillKeys, out var skillLevels);
            var data = new SaveData
            {
                version = SaveVersion,
                playerPos = player != null ? new[] { player.position.x, player.position.y, player.position.z } : null,
                kills = StoryQuestState.Kills,
                bossKills = StoryQuestState.BossKills,
                triggeredEvents = events.ToArray(),
                scoutTalkCount = StoryNpcState.ScoutTalkCount,
                choiceMade = StoryNpcState.ChoiceMade,
                level = StoryJobState.Level,
                exp = StoryJobState.Exp,
                job = StoryJobState.Job,
                championWeek = _championWeek,
                memoryShards = StoryLabyrinthState.MemoryShards,
                memoryTier = StoryLabyrinthState.MemoryTier,
                partyActiveIndex = StoryPartyState.ActiveIndex,
                skillKeys = skillKeys,
                skillLevels = skillLevels,
                skillPins = StorySkillState.SnapshotPins(),
                mountSel = StoryMounts.Snapshot(),
                scenarioJson = StoryScenario.Snapshot(),
            };
            StoryEras.SnapshotStories(out data.folkStoryIds, out data.folkStoryCounts);
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
                Debug.LogWarning($"[StorySaveState] 로드 실패: {e.Message}");
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
                Debug.LogWarning($"[StorySaveState] 로드 실패: {e.Message}");
                return false;
            }
            if (data == null || SaveMigrator.IsFuture(data.version, SaveVersion)) return false;

            StoryQuestState.Restore(data.kills, data.bossKills);
            StoryWorldEventState.Restore(data.triggeredEvents);
            StoryNpcState.Restore(data.scoutTalkCount, data.choiceMade);
            StoryJobState.Restore(data.level, data.exp, data.job);
            _championWeek = data.championWeek;
            StoryLabyrinthState.Restore(data.memoryShards, data.memoryTier);
            StoryPartyState.Restore(data.partyActiveIndex);
            StorySkillState.Restore(data.skillKeys, data.skillLevels, data.skillPins);
            StoryMounts.Restore(data.mountSel);
            StoryEras.RestoreStories(data.folkStoryIds, data.folkStoryCounts);
            if (string.IsNullOrEmpty(data.scenarioJson)) StoryScenario.RestoreLegacy(StoryJobState.Level, StoryJobState.HasJob);
            else StoryScenario.Restore(data.scenarioJson);

            Transform player = FindPlayer();
            if (player != null && data.playerPos != null && data.playerPos.Length == 3)
            {
                player.position = new Vector3(data.playerPos[0], data.playerPos[1], data.playerPos[2]);
            }
            return true;
        }

        private static Transform FindPlayer()
        {
            var go = GameObject.FindWithTag("Player");
            return go != null ? go.transform : null;
        }
    }
}
