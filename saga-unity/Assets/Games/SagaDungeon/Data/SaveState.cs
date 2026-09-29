using System;
using System.IO;
using System.Linq;
using UnityEngine;
using Saga.Dungeon.World;

namespace Saga.Dungeon.Data
{
    /// <summary>
    /// VERTICAL_SLICE_DUNGEON.md "저장/로드(로컬 파일 하나)". GO의
    /// Data/SaveState.cs와 같은 구조(마이그레이션 경로 포함, PLAN.md 75장
    /// "Data Versioning") — 파일명은 다르다(`save_dungeon.json`, GO의
    /// `save.json`과 안 겹치게 — 다섯 판이 세이브 키를 따로 쓰는 것과 같은
    /// 원칙, 루트 CLAUDE.md).
    /// </summary>
    public static class SaveState
    {
        // v5("절차적 층 진행" 슬라이스) — `DungeonFloorRunner.CurrentFloor`를
        // 저장 안 하면 저장/로드할 때마다 던전 진행이 항상 층2로 돌아가
        // 버리는 실제 결함이 있었다(이 필드가 생기기 전엔 방이 넷뿐이라
        // 저장할 "층" 개념 자체가 없어서 문제가 안 됐다). v4 이하 세이브는
        // dungeonFloor가 int 기본값 0으로 채워지고, `TryLoad()`가 2 미만이면
        // 무시하도록 짜서 옛 세이브도 그대로 로드된다(새로 층2부터 시작).
        // v6 — PLAN.md 101-2 5.1 "축복 3택"(BlessingState) 저장. v5 이하 세이브는
        // blessings가 null로 채워지고 Restore(null)는 조용히 아무것도 안 앉힌다.
        // v7 — PLAN.md 101-2 5.5 "난입"(HordeState) 저장. 웹판 `save.dungeon.horde
        // = {best, runs}` 그대로. v6 이하 세이브는 두 필드가 int 기본값 0으로
        // 채워지고 Restore(0, 0)이 그대로 앉아 "아직 안 해봄"과 같은 뜻이 된다.
        // v8 — PLAN.md 101-2 5.6 "목표판·일일/주간"(DungeonDailyTaskState) 저장.
        // GO의 v10과 같은 구조(날짜 문자열이 오늘의 일과 셋을 해시로 다시 뽑는 키).
        // v7 이하 세이브는 dailyDate가 null/빈 문자열로 채워지고 Restore가 빈
        // 상태로 둔다 — 다음 EnsureToday() 호출이 오늘 날짜로 새로 채운다.
        // v9 — PLAN.md 106-2 "잊힌 능묘"(TempleState) 작은 열쇠 수 + 진행 비트. v8 이하
        // 세이브는 두 필드가 0 으로 채워져 "아직 안 들어감"과 같은 뜻이 된다.
        // v10 — PLAN.md 108 ③ 명소 층 주인 토벌 수(LandmarkState). v9 이하는 null → 전부 0("아직 안 잡음").
        // v11 — PLAN.md 109-10 비결(SecretState, 웹 §5.9 `save.secrets`). 무예 셋 순서 정수, v10 이하는 null → 전부 없음.
        // v12 — PLAN.md 109-10-3 시련(TrialState, 웹 §5.11 `trial = {best, open, runs, board}`). v11 이하는 0/0/0/null → 열린 단계 1.
        // v13 — PLAN.md 109-10-5 지역 우두머리(RegionBossState, 웹 §5.13 `regionBoss = {지역: {kills, firstAt, lastAt}}`). v12 이하는 null → 전부 0.
        // v14 — PLAN.md 109-10-6 지역 사연(RegionSagaState, 웹 §5.14 `quest.chain`·`chainAll`). v13 이하는 null/false → 전부 닫힘.
        private const int SaveVersion = 14;

        /// <summary>PLAN.md 110 ② — 타이틀이 "이어하기/새로 시작"을 가른다.</summary>
        public const string FileName = "save_dungeon.json";
        private static string SavePath => Path.Combine(Application.persistentDataPath, FileName);
        public static bool HasSave => File.Exists(SavePath);

        public static void DeleteSave()
        {
            try { if (File.Exists(SavePath)) File.Delete(SavePath); }
            catch (Exception e) { Debug.LogWarning($"[SaveState] 세이브 삭제 실패: {e.Message}"); }
        }

        [Serializable]
        private class SaveData
        {
            public int version;
            public float[] playerPos;
            public int level;
            public int exp;
            public int gold;
            public int hp;
            public string weaponId;
            public string gemId;
            public string[] discovered;
            public int questStage; // v3 이하 호환용 — v4부터는 아래 세 플래그가 정본.
            public bool bossDead;
            public bool minibossDead;
            public bool captiveFreed;
            public int dungeonFloor; // v5 — DungeonFloorRunner.CurrentFloor, 0이면 "없음"(v4 이하 세이브).
            public string[] blessings; // v6 — BlessingState.SnapshotIds(), 축별 최대 3개.
            public int hordeBestSurvivalSec; // v7 — HordeState.BestSurvivalSec.
            public int hordeRuns; // v7 — HordeState.Runs.
            // v8 — DungeonDailyTaskState. dailyProgress/dailyDone은 dailyDate 기준으로
            // 뽑힌 오늘의 일과 셋과 같은 길이(Restore가 해시로 다시 뽑아 맞춘다).
            public string dailyDate;
            public int[] dailyProgress;
            public bool[] dailyDone;
            public bool dailyStampGranted;
            public int dailyStamps;
            public int templeKeys; // v9 — TempleState.SmallKeys.
            public int templeFlags; // v9 — (int)TempleState.Flags, 비트 순서는 TempleFlag 주석 참고.
            public int[] landmarkClears; // v10 — LandmarkState.Snapshot(), DungeonLandmarkData.All 순서.
            public int[] secrets; // v11 — SecretState.Snapshot(), SecretMove 순서(평타·강공격·회전베기).
            public int trialBest; // v12 — TrialState 넷.
            public int trialOpen;
            public int trialRuns;
            public TrialState.Entry[] trialBoard;
            public RegionBossState.Entry[] regionBoss; // v13
            public RegionSagaState.Entry[] regionSaga; // v14
            public bool regionSagaAll;
            public string mountSel; // PLAN.md 109-15 — 고른 탈것(탄 채는 저장 안 함). 버전 그대로: 옛 세이브는 null → 안 고른 채.
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
                Debug.LogWarning($"[SaveState] 저장 실패: {e.Message}");
                return false;
            }
        }

        /// <summary>PLAN.md 110 ② — 지금 상태를 세이브 JSON 으로. 플레이어가 없으면(타이틀) 자리 없이 —
        /// 타이틀이 앱을 켤 때 "새 게임 기본값"을 떠 두고 "새로 시작" 때 <see cref="ApplyJson"/> 으로 되돌린다.</summary>
        public static string ToJson()
        {
            Transform player = FindPlayer();

            var data = new SaveData
            {
                version = SaveVersion,
                playerPos = player != null ? new[] { player.position.x, player.position.y, player.position.z } : null,
                level = HeroState.Level,
                exp = HeroState.Exp,
                gold = HeroState.Gold,
                hp = HeroState.Hp,
                weaponId = HeroState.EquippedWeaponId,
                gemId = HeroState.SocketedGemId,
                discovered = BestiaryState.Snapshot(),
                bossDead = QuestState.BossDead,
                minibossDead = QuestState.MinibossDead,
                captiveFreed = QuestState.CaptiveFreed,
                dungeonFloor = DungeonFloorRunner.Instance?.CurrentFloor ?? 0,
                blessings = BlessingState.SnapshotIds().ToArray(),
                hordeBestSurvivalSec = HordeState.BestSurvivalSec,
                hordeRuns = HordeState.Runs,
                dailyDate = DungeonDailyTaskState.CurrentDate,
                dailyProgress = DungeonDailyTaskState.SnapshotProgress(),
                dailyDone = DungeonDailyTaskState.SnapshotDone(),
                dailyStampGranted = DungeonDailyTaskState.SnapshotDayStampGranted(),
                dailyStamps = DungeonDailyTaskState.Stamps,
                templeKeys = TempleState.SmallKeys,
                templeFlags = (int)TempleState.Flags,
                landmarkClears = LandmarkState.Snapshot(),
                secrets = SecretState.Snapshot(),
                trialBest = TrialState.Best,
                trialOpen = TrialState.Open,
                trialRuns = TrialState.Runs,
                trialBoard = TrialState.SnapshotBoard(),
                regionBoss = RegionBossState.Snapshot(),
                regionSaga = RegionSagaState.Snapshot(),
                regionSagaAll = RegionSagaState.AllDone,
                mountSel = DungeonMounts.Snapshot(),
            };
            return JsonUtility.ToJson(data);
        }

        /// <summary>저장 파일이 있으면 캐릭터 상태·위치에 적용하고 true,
        /// 없거나 깨져 있으면 아무것도 바꾸지 않고 false(새 게임 취급).</summary>
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
                Debug.LogWarning($"[SaveState] 로드 실패: {e.Message}");
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
                Debug.LogWarning($"[SaveState] 로드 실패: {e.Message}");
                return false;
            }
            if (data == null) return false;

            // 이 빌드보다 나중 버전(다운그레이드)이면 반쯤 바뀐 채로 적용하지 않는다.
            if (data.version > SaveVersion) return false;

            HeroState.Restore(data.level, data.exp, data.hp, data.gold, data.weaponId, data.gemId);
            SecretState.Restore(data.version >= 11 ? data.secrets : null); // 레벨 뒤(모자라면 없는 것으로 읽는다).
            if (data.version >= 12) TrialState.Restore(data.trialBest, data.trialOpen, data.trialRuns, data.trialBoard);
            else TrialState.Restore(0, 1, 0, null);
            RegionBossState.Restore(data.version >= 13 ? data.regionBoss : null);
            RegionSagaState.Restore(data.version >= 14 ? data.regionSaga : null, data.version >= 14 && data.regionSagaAll);
            DungeonMounts.Restore(data.mountSel);
            BestiaryState.Restore(data.discovered);
            if (data.version >= 4)
            {
                QuestState.Restore(data.bossDead, data.minibossDead, data.captiveFreed);
            }
            else
            {
                QuestState.RestoreLegacyStage(data.questStage);
            }
            LandmarkState.Restore(data.version >= 10 ? data.landmarkClears : null); // 층을 짓기 전에(주인 보상 판정)
            if (data.version >= 5 && data.dungeonFloor >= 2)
            {
                DungeonFloorRunner.Instance?.JumpToFloor(data.dungeonFloor);
            }
            if (data.version >= 6)
            {
                BlessingState.Restore(data.blessings);
            }
            if (data.version >= 7)
            {
                HordeState.Restore(data.hordeBestSurvivalSec, data.hordeRuns);
            }
            if (data.version >= 8)
            {
                DungeonDailyTaskState.Restore(data.dailyDate, data.dailyProgress, data.dailyDone, data.dailyStampGranted, data.dailyStamps);
            }
            if (data.version >= 9)
            {
                TempleState.Restore(data.templeKeys, data.templeFlags);
            }

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
