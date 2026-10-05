using System;
using System.Collections.Generic;
using System.IO;
using UnityEngine;
using Saga.Core;

namespace Saga.Go.Data
{
    /// <summary>
    /// VERTICAL_SLICE.md 26절 "저장/로드(로컬 파일 하나)" — 12단계 완료
    /// 조건의 마지막 단계. saga-godot의 save_state.gd와 같은 구조
    /// (_migrate_step 마이그레이션 경로 포함, PLAN.md 75장 "Data
    /// Versioning"을 처음부터 지킴 — v1→v2, v2→v3, v3→v4, v4→v5, v5→v6,
    /// v6→v7, v7→v8, v8→v9 전환이 그 실사용례다).
    /// </summary>
    public static class SaveState
    {
        private const int SaveVersion = 29;

        /// <summary>PLAN.md 110 ② — 타이틀이 "이어하기/새로 시작"을 가른다.</summary>
        public const string FileName = "save.json";
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
            public List<string> partyMembers;
            // v2(PLAN.md 59~65장 Stats/Item/Inventory/Equipment 추가) — v1엔 없던 필드.
            public int level;
            public int exp;
            public List<string> ownedItems;
            public string equippedWeapon;
            public string equippedArmor;
            // v3(PLAN.md 70~71장 Quest 추가) — v2까지는 없던 필드.
            public int questBanditStage;
            // v4(PLAN.md 72~73장 World Event/Hidden Area 추가) — v3까지는 없던 필드.
            // v9부터는 worldFlags로 옮겨 가고 이 필드는 v8 이하 파일을 읽을 때만 쓰인다.
            public bool caveTreasureFound;
            // v5(PLAN.md 66장 Reward의 돈·상인 거래 추가) — v4까지는 없던 필드.
            public int gold;
            public bool merchantSold;
            // v6(PLAN.md 51장 GO 월드 확장 — 수집) — v5까지는 없던 필드.
            public List<string> gatheredSpots;
            // v7(PLAN.md 51장 GO 월드 확장 — 산신당 가호) — v6까지는 없던 필드.
            // v9부터는 worldFlags로 옮겨 가고 이 필드는 v8 이하 파일을 읽을 때만 쓰인다.
            public bool shrineBlessed;
            // v8(PLAN.md 51장 GO 월드 확장 — 희귀 몬스터) — v7까지는 없던 필드.
            // v9부터는 worldFlags로 옮겨 가고 이 필드는 v8 이하 파일을 읽을 때만 쓰인다.
            public bool rareWolfDefeated;
            // v9(WorldEventState를 GatherState처럼 id 집합으로 일반화, 2026-09-12) —
            // 위 세 bool 필드를 하나로 접었다. v8 이하 파일을 읽을 땐 MigrateStep(8,...)이
            // 세 bool을 보고 이 목록을 채운다.
            public List<string> worldFlags;
            // v10(PLAN.md 101-2 ④ 일과판, 2026-09-19) — v9까지는 없던 필드.
            // dailyProgress/dailyDone은 dailyDate 기준으로 뽑힌 오늘의 일과
            // 셋과 같은 길이(DailyTaskState.Restore가 해시로 다시 뽑아 맞춘다).
            public string dailyDate;
            public int[] dailyProgress;
            public bool[] dailyDone;
            public bool dailyStampGranted;
            public int dailyStamps;
            // v11(PLAN.md 101-2 ⑦ 승급 3택, 2026-09-19) — v10까지는 없던 필드.
            // 축(공/수/보) 순서로 최대 3개, PerkState.Restore가 id로 되찾는다.
            public List<string> perkIds;
            // v12(PLAN.md 101-2 ⑥ 인연 · ⑧ 패배 비용과 회수, 2026-09-20) — v11까지는
            // 없던 필드. bondWalkedM/bondWins는 partyMembers와 같은 길이·순서
            // (BondState.Snapshot*가 그렇게 만든다). drops는 아직 회수/만료 안 된
            // "떨어진 짐" 목록.
            public float[] bondWalkedM;
            public int[] bondWins;
            public DropState.Drop[] drops;
            // v13(PLAN.md 101-2 ② 사당 시련, 2026-09-20) — v12까지는 없던 필드.
            public string shrineDate;
            public int shrineDailyCount;
            public int shrineShards;
            public int shrineStamps;
            public long shrineLockUntilTicks;
            // v14 — PLAN.md 107-3 지역 지도(순간이동 지점·발 디딘 지역·망루로 밝힌 지도).
            public List<string> waypoints;
            public List<string> regionsVisited;
            public bool mapRevealed;
            // v15 — PLAN.md 107-7 망루 수호장(한 번 쓰러뜨리면 다시 안 선다).
            public bool guardianDown;
            // v16 — PLAN.md 107-8 지역 사명 사슬(지역마다 무리 토벌 셈·받은 보상).
            public List<RegionMissionState.Entry> missions;
            // v17 — PLAN.md 109-6b 도감 화면(겨루기를 연 인물 = "만남", 등용은 partyMembers).
            public List<string> heroesSeen;
            // v18 — PLAN.md 109-9 오른 정상(발견 보상 한 번·지도에서 순간이동).
            public List<string> peaksFound;
            // PLAN.md 109-14-1a 원소 일곱 안내를 했는가 — 버전 그대로(옛 세이브엔 없어 false → 한 번 안내, 웹 save.field.el7 와 같은 결).
            public bool el7Noticed;
            // v19 — PLAN.md 109-14-3a 수집 구슬(주운 id)·바친 수.
            public List<string> orbsGot;
            public int orbsGiven;
            // v20 — PLAN.md 109-14-4 무예 단계·깨달음(동행마다)·재료 주머니(쪽지·교본·비전·매듭·비늘).
            public List<TalentState.Entry> talents;
            public int[] talentMats;
            // v21 — PLAN.md 109-14-5a 가진 무기(Lv·벼림·울림)·든 무기·강화석.
            public List<WeaponState.InvEntry> weapons;
            public List<WeaponState.EquipEntry> weaponEquip;
            public int weaponOre;
            // v22 — PLAN.md 109-14-5b 보패(부위·세트·주/부옵션·강화·누가 낌)·번호·연마석.
            public List<GoArtifacts.Artifact> artifacts;
            public int artifactSeq;
            public int artifactPolish;
            // v23 — PLAN.md 109-14-6 재료·요리 가방·숙련·채집 시각(유닉스 초). 버프·포만감은 세이브 안 함.
            public List<CookState.Entry> cookBag;
            public List<CookState.Entry> cookProf;
            public List<CookState.TimeEntry> cookGather;
            // v24 — PLAN.md 109-14-7 천하 등급 한 단계 낮춤·보상을 받은 여정 등급.
            public bool advLowered;
            public int advPaid;
            public int cycleN; // tasks U-0045 재출항 회차(버전 그대로 — 옛 세이브는 0)
            // v25 — PLAN.md 109-14-8 오늘 일과 마무리 보상을 받았나(날짜는 dailyDate).
            public bool dailyBonus;
            // v26 — PLAN.md 109-14-9 원기(값·기준 유닉스 초 — 0 이면 가득)·숨은 터 받은 수·이 주 주간 보스.
            public int resin;
            public long resinT;
            public int domainClaims;
            public string weeklyWeek;
            public int weeklyN;
            // v27 — PLAN.md 109-14-10 망루 수호장 보상 꽃(쓰러뜨리고 안 받음)·받은 유닉스 초(150초 뒤 다시 선다).
            public bool guardianBloom;
            public long guardianPaidAt;
            // v28 — PLAN.md 109-14-12 이야기 임무 장·단계(임무 적·제단 불은 저장 안 함 — 불러오면 그 단계 처음).
            public int storyCh;
            public int storyStep;
            // v29 — tasks U-0013 첫 10분 사명 — 끝난 단계 id(옛 세이브는 마이그레이션이 전부 끝남으로 채운다).
            public List<string> tutDone;
            // PLAN.md 109-14-18 편성 1~4(칸마다 들판 셋 id 를 쉼표로)·지금 칸 — 버전 그대로(옛 세이브엔 없어 빈 칸 넷·1번 = 지금 들판, 웹 partyPresets 와 같은 결).
            public List<string> partyPresets;
            public int partyPreset;
            // PLAN.md 109-14-21 세계 임무 — 임무마다 단계(−1 안 맡음)·끝남·따라가는 임무 id(없으면 이야기). 버전 그대로(옛 세이브 = 아무것도 안 맡음).
            // 109-14-24 낚시 — 가방·누적 잡은 수·잡은 자리 시각(버전 그대로 — 옛 세이브는 빈 채)
            public List<CookState.Entry> fishBag;
            public List<CookState.Entry> fishLog;
            public List<CookState.TimeEntry> fishGone;
            // 109-14-25 업적 — 신호 셈·반응 가짓수별 횟수·받은 단계 수(버전 그대로 — 옛 세이브는 0 에서)
            public List<CookState.Entry> achStats;
            public List<CookState.Entry> achKinds;
            public List<CookState.Entry> achGot;
            // tasks U-0031 사냥 기록 — 종별 처치 수·받은 단계 수(버전 그대로 — 옛 세이브는 0 에서)
            public List<CookState.Entry> huntKills;
            public List<CookState.Entry> huntClaimed;
            // tasks U-0044 주간 도전 — 주 번호·주 시작 셈 값·받은 도전·완주 보상(버전 그대로 — 옛 세이브는 새 주로 읽힘)
            public int wgWeek;
            public List<CookState.Entry> wgBase;
            public List<CookState.Entry> wgClaimed;
            public bool wgBonus;
            // tasks U-0032 쉼터 마당 — 놓은 소품·마지막 정산 시각(유닉스 초)·쌓인 금·총 쓴 금(버전 그대로 — 옛 세이브는 빈 마당)
            public List<HomePlaced> homeItems;
            public long homeT;
            public int homeAcc;
            public int homeSpent;
            // 109-14-26 탐사 파견 — 나간 이(탐사지·동료·시간·시작 유닉스 초)·끝낸 수(버전 그대로 — 옛 세이브는 빈 채)
            public List<DispatchState.Entry> dispOut;
            public int dispDone;
            // 109-14-27a 서리봉 고원 — 찾은 명소·발견(버전 그대로 — 옛 세이브는 아무것도 못 찾은 채)
            public List<string> frostFound;
            // 109-14-31 서리봉 고원 들판 보스 만년설 바위곰왕 — 쓰러뜨림·꽃·받은 때(버전 그대로)
            public bool frostBossDown, frostBossBloom;
            public long frostBossPaidAt;
            // 109-14-37 독립 땅(은하 나루 등)에서 찾은 명소·발견 "지역:명소"(버전 그대로)
            public List<string> areaFound;
            // 109-14-56b 밤의 잔불 — 오늘(새벽 4시에 갈림)·이미 끈 자리(버전 그대로 — 옛 세이브는 빈 채)
            public string nightDay;
            public List<string> nightDone;
            // 109-15 탈것 — 고른 탈것 id(버전 그대로 — 옛 세이브는 안 고른 채, 탄 채로는 저장 안 함)
            public string mountSel;
            public List<int> wqSteps;
            public List<bool> wqDone;
            public string wqTrack;
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
            var dom = DomainState.Snapshot(); // 109-14-9

            var data = new SaveData
            {
                version = SaveVersion,
                playerPos = player != null ? SavedPlayerPos(player.position) : null,
                partyMembers = new List<string>(PartyState.MemberIds),
                partyPresets = PartyState.SnapshotPresets(), // 109-14-18
                fishBag = FishState.SnapshotBag(), // 109-14-24
                fishLog = FishState.SnapshotLog(),
                fishGone = FishState.SnapshotGone(),
                achStats = AchieveState.SnapshotStats(), // 109-14-25
                achKinds = AchieveState.SnapshotKinds(),
                achGot = AchieveState.SnapshotGot(),
                huntKills = HuntState.SnapshotKills(), // U-0031
                huntClaimed = HuntState.SnapshotClaimed(),
                wgWeek = WeeklyState.SnapshotWeek(), // U-0044
                wgBase = WeeklyState.SnapshotBase(),
                wgClaimed = WeeklyState.SnapshotClaimed(),
                wgBonus = WeeklyState.SnapshotBonus(),
                homeItems = HomeState.Snapshot(), // U-0032
                homeT = HomeState.SnapshotT(),
                homeAcc = HomeState.SnapshotAcc(),
                homeSpent = HomeState.Spent,
                dispOut = DispatchState.Snapshot(), // 109-14-26
                dispDone = DispatchState.Done,
                frostFound = FrostState.Snapshot(), // 109-14-27a
                areaFound = AreaState.Snapshot(), // 109-14-37
                nightDay = NightEchoState.Day, nightDone = NightEchoState.Snapshot(), // 109-14-56b
                mountSel = GoMounts.Snapshot(), // 109-15
                frostBossDown = FrostBossState.Defeated, // 109-14-31
                frostBossBloom = FrostBossState.Bloom,
                frostBossPaidAt = FrostBossState.PaidAt,
                wqSteps = WorldQuestState.SnapshotSteps(), // 109-14-21
                wqDone = WorldQuestState.SnapshotDone(),
                wqTrack = StoryState.TrackId,
                partyPreset = PartyState.PresetAt(),
                level = PlayerStats.Level,
                exp = PlayerStats.Exp,
                ownedItems = new List<string>(Inventory.OwnedIds),
                equippedWeapon = Inventory.EquippedWeaponId,
                equippedArmor = Inventory.EquippedArmorId,
                questBanditStage = (int)QuestState.BanditQuest,
                gold = GoldState.Gold,
                merchantSold = ShopState.MerchantSold,
                gatheredSpots = new List<string>(GatherState.GatheredIds),
                worldFlags = new List<string>(WorldEventState.TriggeredIds),
                dailyDate = DailyTaskState.CurrentDate,
                dailyProgress = DailyTaskState.SnapshotProgress(),
                dailyDone = DailyTaskState.SnapshotDone(),
                dailyStampGranted = DailyTaskState.SnapshotDayStampGranted(),
                dailyStamps = DailyTaskState.Stamps,
                perkIds = PerkState.SnapshotIds(),
                bondWalkedM = BondState.SnapshotWalked(PartyState.MemberIds),
                bondWins = BondState.SnapshotWins(PartyState.MemberIds),
                drops = DropState.Snapshot(),
                shrineDate = ShrineTrialState.SnapshotDate(),
                shrineDailyCount = ShrineTrialState.SnapshotDailyCount(),
                shrineShards = ShrineTrialState.SnapshotShards(),
                shrineStamps = ShrineTrialState.SnapshotStamps(),
                shrineLockUntilTicks = ShrineTrialState.SnapshotLockUntilTicks(),
                waypoints = WorldMapState.SnapshotWaypoints(),
                regionsVisited = WorldMapState.SnapshotRegions(),
                mapRevealed = WorldMapState.Revealed,
                guardianDown = GuardianState.Defeated,
                guardianBloom = GuardianState.Bloom,
                guardianPaidAt = GuardianState.PaidAt,
                missions = RegionMissionState.Snapshot(),
                heroesSeen = HeroDexState.Snapshot(),
                peaksFound = WorldMapState.SnapshotPeaks(),
                el7Noticed = Combat.GoElements.SevenNoticed,
                orbsGot = OrbState.Snapshot(),
                orbsGiven = OrbState.Given,
                talents = TalentState.Snapshot(),
                talentMats = TalentState.SnapshotMats(),
                weapons = WeaponState.SnapshotInv(),
                weaponEquip = WeaponState.SnapshotEquip(),
                weaponOre = WeaponState.Ore,
                artifacts = ArtifactState.Snapshot(),
                artifactSeq = ArtifactState.Seq,
                artifactPolish = ArtifactState.Polish,
                cookBag = CookState.SnapshotBag(),
                cookProf = CookState.SnapshotProf(),
                cookGather = CookState.SnapshotGather(),
                advLowered = AdventureState.Lowered,
                advPaid = AdventureState.Paid,
                cycleN = CycleState.Cycle, // U-0045
                dailyBonus = DailyTaskState.BonusClaimed,
                resin = dom.resin,
                resinT = dom.t,
                domainClaims = dom.claims,
                weeklyWeek = dom.week,
                weeklyN = dom.weekN,
                storyCh = StoryState.Ch,
                storyStep = StoryState.StepIndex,
                tutDone = GoTutorial.Ids(),
            };
            return JsonUtility.ToJson(data);
        }

        /// <summary>저장 파일이 있으면 부대·레벨/경험치·인벤토리·퀘스트·숨겨진
        /// 보물·돈/상인 거래·플레이어 위치에 적용하고 true, 없거나 마이그레이션
        /// 경로가 없거나 깨져 있으면 아무것도 바꾸지 않고 false(새 게임 취급).</summary>
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

            data = Migrate(data);
            if (data == null) return false;

            PartyState.Restore(data.partyMembers ?? new List<string>());
            PlayerStats.Restore(data.level, data.exp);
            Inventory.Restore(data.ownedItems ?? new List<string>(), data.equippedWeapon, data.equippedArmor);
            QuestState.Restore((QuestStage)data.questBanditStage);
            GoldState.Restore(data.gold);
            ShopState.Restore(data.merchantSold);
            GatherState.Restore(data.gatheredSpots);
            WorldEventState.Restore(data.worldFlags);
            DailyTaskState.Restore(data.dailyDate, data.dailyProgress, data.dailyDone, data.dailyStampGranted, data.dailyStamps, data.dailyBonus);
            PerkState.Restore(data.perkIds ?? new List<string>());
            BondState.Restore(PartyState.MemberIds, data.bondWalkedM, data.bondWins);
            DropState.Restore(data.drops);
            ShrineTrialState.Restore(data.shrineDate, data.shrineDailyCount, data.shrineShards, data.shrineStamps, data.shrineLockUntilTicks);
            WorldMapState.Restore(data.waypoints, data.regionsVisited, data.mapRevealed);
            GuardianState.Restore(data.guardianDown, data.guardianBloom, data.guardianPaidAt);
            RegionMissionState.Restore(data.missions);
            HeroDexState.Restore(data.heroesSeen);
            WorldMapState.RestorePeaks(data.peaksFound);
            Combat.GoElements.SevenNoticed = data.el7Noticed;
            OrbState.Restore(data.orbsGot, data.orbsGiven);
            TalentState.Restore(data.talents, data.talentMats);
            WeaponState.Restore(data.weapons, data.weaponEquip, data.weaponOre);
            ArtifactState.Restore(data.artifacts, data.artifactSeq, data.artifactPolish);
            CookState.Restore(data.cookBag, data.cookProf, data.cookGather);
            DomainState.Restore(data.resin, data.resinT, data.domainClaims, data.weeklyWeek, data.weeklyN);
            CycleState.Restore(data.cycleN); // U-0045 — 천하 등급 상한이 회차에 달려 모험 등급 복원보다 먼저
            AdventureState.RestoreSave(data.advLowered, data.advPaid); // 레벨 뒤 — 천하 등급이 바뀌면 들판 적이 다시 잰다
            StoryState.Restore(data.storyCh, data.storyStep);
            GoTutorial.Restore(data.tutDone); // tasks U-0013
            StoryState.CatchUpJoins(); // 109-14-15 — 합류가 생기기 전에 끝낸 장의 이야기 동료
            PartyState.RestorePresets(data.partyPresets, data.partyPreset); // 109-14-18 — 합류 뒤(지금 칸 = 지금 들판)
            WorldQuestState.Restore(data.wqSteps, data.wqDone); // 109-14-21 — 이야기 자리(StoryState.Restore) 뒤
            StoryState.RestoreTrack(data.wqTrack);
            FishState.Restore(data.fishBag, data.fishLog, data.fishGone); // 109-14-24 — 요리 가방(CookState) 뒤
            AchieveState.Restore(data.achStats, data.achKinds, data.achGot); // 109-14-25
            HuntState.Restore(data.huntKills, data.huntClaimed); // U-0031 — 없는 세이브(null)는 0 에서
            WeeklyState.Restore(data.wgWeek, data.wgBase, data.wgClaimed, data.wgBonus); // U-0044 — 없는 세이브(0·null)는 새 주
            HomeState.Restore(data.homeItems, data.homeT, data.homeAcc, data.homeSpent); // U-0032 — 없는 세이브(null·0)는 빈 마당
            DispatchState.Restore(data.dispOut, data.dispDone); // 109-14-26
            FrostState.Restore(data.frostFound); // 109-14-27a
            FrostBossState.Restore(data.frostBossDown, data.frostBossBloom, data.frostBossPaidAt); // 109-14-31
            AreaState.Restore(data.areaFound); // 109-14-37
            NightEchoState.Restore(data.nightDay, data.nightDone); // 109-14-56b
            GoMounts.Restore(data.mountSel); // 109-15
            World.GoOrbField.Instance?.Rebuild();

            Transform player = FindPlayer();
            if (player != null && data.playerPos != null && data.playerPos.Length == 3)
            {
                player.position = new Vector3(data.playerPos[0], data.playerPos[1], data.playerPos[2]);
            }
            return true;
        }

        /// <summary>data의 version이 SaveVersion보다 낮으면 MigrateStep()을 한
        /// 단계씩 적용해 최신 모양으로 바꿔 돌려준다(딱 맞으면 그대로).
        /// 마이그레이션 경로가 없거나(MigrateStep이 null) 이 빌드보다 나중
        /// 버전(다운그레이드)이면 null — 데이터를 반쯤 바꾼 채로 적용하지
        /// 않는다.</summary>
        private static SaveData Migrate(SaveData data) =>
            SaveMigrator.Run(data, SaveVersion, d => d.version, MigrateStep);

        /// <summary>버전 fromVersion에서 온 data를 fromVersion+1 모양으로 바꿔
        /// 돌려준다. 등록된 경로가 없으면 null.</summary>
        private static SaveData MigrateStep(int fromVersion, SaveData data)
        {
            if (fromVersion == 1)
            {
                // v1엔 레벨/경험치/인벤토리 필드가 아예 없었다 — 처음 시작한
                // 것과 같은 기본값(1레벨, 빈 손)으로 채운다.
                data.version = 2;
                data.level = 1;
                data.exp = 0;
                data.ownedItems = new List<string>();
                data.equippedWeapon = null;
                data.equippedArmor = null;
                return data;
            }
            if (fromVersion == 2)
            {
                // v2엔 퀘스트 필드가 없었다 — 촌장을 아직 안 만난 것과 같은
                // 기본값(QuestStage.NotStarted == 0)으로 채운다.
                data.version = 3;
                data.questBanditStage = (int)QuestStage.NotStarted;
                return data;
            }
            if (fromVersion == 3)
            {
                // v3엔 숨겨진 보물 필드가 없었다 — 아직 못 찾은 것과 같은
                // 기본값(false)으로 채운다.
                data.version = 4;
                data.caveTreasureFound = false;
                return data;
            }
            if (fromVersion == 4)
            {
                // v4엔 돈·상인 거래 필드가 없었다 — 처음 시작한 것과 같은
                // 기본값(시작 소지금, 상인한테서 아직 안 산 상태)으로 채운다.
                data.version = 5;
                data.gold = GoldState.StartingGold;
                data.merchantSold = false;
                return data;
            }
            if (fromVersion == 5)
            {
                // v5엔 채집 필드가 없었다 — 아직 아무 데도 안 캔 것과 같은
                // 기본값(빈 목록)으로 채운다.
                data.version = 6;
                data.gatheredSpots = new List<string>();
                return data;
            }
            if (fromVersion == 6)
            {
                // v6엔 산신당 가호 필드가 없었다 — 아직 못 받은 것과 같은
                // 기본값(false)으로 채운다.
                data.version = 7;
                data.shrineBlessed = false;
                return data;
            }
            if (fromVersion == 7)
            {
                // v7엔 희귀 몬스터 필드가 없었다 — 아직 못 잡은 것과 같은
                // 기본값(false)으로 채운다.
                data.version = 8;
                data.rareWolfDefeated = false;
                return data;
            }
            if (fromVersion == 8)
            {
                // v8까지는 caveTreasureFound/shrineBlessed/rareWolfDefeated가
                // 각각 별도 bool 필드였다 — WorldEventState를 GatherState처럼
                // id 집합으로 일반화하며 하나의 문자열 목록으로 접는다(값은
                // 그대로 옮기는 것뿐이라 진행 손실 없음).
                data.version = 9;
                data.worldFlags = new List<string>();
                if (data.caveTreasureFound) data.worldFlags.Add("cave_treasure");
                if (data.shrineBlessed) data.worldFlags.Add("shrine_blessing");
                if (data.rareWolfDefeated) data.worldFlags.Add("rare_wolf");
                return data;
            }
            if (fromVersion == 9)
            {
                // v9엔 일과판 필드가 없었다 — 아직 오늘 일과를 안 뽑은 것과
                // 같은 기본값(빈 날짜)으로 채운다. DailyTaskState.Restore가
                // 빈 날짜를 보면 다음 EnsureToday() 호출 때 오늘 날짜로
                // 새로 뽑는다(도장 0부터 시작 — 진행 손실이랄 게 없다).
                data.version = 10;
                data.dailyDate = "";
                data.dailyProgress = Array.Empty<int>();
                data.dailyDone = Array.Empty<bool>();
                data.dailyStampGranted = false;
                data.dailyStamps = 0;
                return data;
            }
            if (fromVersion == 10)
            {
                // v10엔 승급 특성 필드가 없었다 — 아직 하나도 안 고른 것과
                // 같은 기본값(빈 목록)으로 채운다.
                data.version = 11;
                data.perkIds = new List<string>();
                return data;
            }
            if (fromVersion == 11)
            {
                // v11엔 인연·짐 필드가 없었다 — 아직 하나도 안 쌓인 것과 같은
                // 기본값(빈 배열)으로 채운다.
                data.version = 12;
                data.bondWalkedM = Array.Empty<float>();
                data.bondWins = Array.Empty<int>();
                data.drops = Array.Empty<DropState.Drop>();
                return data;
            }
            if (fromVersion == 12)
            {
                // v12엔 사당 시련 필드가 없었다 — 아직 하나도 안 도전한 것과
                // 같은 기본값(빈 날짜, 잠금 없음)으로 채운다.
                data.version = 13;
                data.shrineDate = "";
                data.shrineDailyCount = 0;
                data.shrineShards = 0;
                data.shrineStamps = 0;
                data.shrineLockUntilTicks = 0;
                return data;
            }
            if (fromVersion == 13)
            {
                // v13엔 지역 지도 필드가 없었다 — 아직 아무 지점도 안 켜고 아무 데도 안 간 것과 같은 기본값.
                data.version = 14;
                data.waypoints = new List<string>();
                data.regionsVisited = new List<string>();
                data.mapRevealed = false;
                return data;
            }
            if (fromVersion == 14)
            {
                // v14엔 망루 수호장이 없었다 — 아직 안 쓰러뜨린 것과 같다.
                data.version = 15;
                data.guardianDown = false;
                return data;
            }
            if (fromVersion == 15)
            {
                // v15엔 지역 사명이 없었다 — 토벌 셈 0·받은 보상 없음. 발견·수호장·상자는 이미 있는 기록에서 다시 센다.
                data.version = 16;
                data.missions = new List<RegionMissionState.Entry>();
                return data;
            }
            if (fromVersion == 16)
            {
                // v16엔 도감 "만남"이 없었다 — 동행만 만난 것으로 친다(HeroDexState.IsSeen 이 동행 명단을 본다).
                data.version = 17;
                data.heroesSeen = new List<string>();
                return data;
            }
            if (fromVersion == 17)
            {
                // v17엔 정상 기록이 없었다 — 아직 아무 정상에도 안 오른 것과 같다.
                data.version = 18;
                data.peaksFound = new List<string>();
                return data;
            }
            if (fromVersion == 18)
            {
                // v18엔 수집 구슬이 없었다 — 하나도 안 주운 것과 같다.
                data.version = 19;
                data.orbsGot = new List<string>();
                data.orbsGiven = 0;
                return data;
            }
            if (fromVersion == 19)
            {
                // v19엔 무예가 없었다 — 모두 1단·깨달음 0·재료 0.
                data.version = 20;
                data.talents = new List<TalentState.Entry>();
                data.talentMats = new int[5];
                return data;
            }
            if (fromVersion == 20)
            {
                // v20엔 무기가 없었다 — 모두 수련용·강화석 0.
                data.version = 21;
                data.weapons = new List<WeaponState.InvEntry>();
                data.weaponEquip = new List<WeaponState.EquipEntry>();
                data.weaponOre = 0;
                return data;
            }
            if (fromVersion == 21)
            {
                // v21엔 보패가 없었다 — 빈 주머니·연마석 0.
                data.version = 22;
                data.artifacts = new List<GoArtifacts.Artifact>();
                data.artifactSeq = 0;
                data.artifactPolish = 0;
                return data;
            }
            if (fromVersion == 22)
            {
                // v22엔 요리가 없었다 — 빈 가방·숙련 0·모든 포기가 자라 있다.
                data.version = 23;
                data.cookBag = new List<CookState.Entry>();
                data.cookProf = new List<CookState.Entry>();
                data.cookGather = new List<CookState.TimeEntry>();
                return data;
            }
            if (fromVersion == 23)
            {
                // v23엔 여정 등급 보상이 없었다 — 지금 레벨까지 받은 걸로(지난 보상이 쏟아지지 않게), 낮춤 없음.
                data.version = 24;
                data.advLowered = false;
                data.advPaid = data.level;
                return data;
            }
            if (fromVersion == 24)
            {
                // v24엔 마무리 보상이 없었다 — 안 받은 것으로. 하루 셋이던 진행은 길이가 달라 Restore 가 그날만 비운다.
                data.version = 25;
                data.dailyBonus = false;
                return data;
            }
            if (fromVersion == 25)
            {
                // v25엔 원기가 없었다 — 가득(기준 시각 0)·받은 수 0.
                data.version = 26;
                data.resin = GoDomain.ResinMax;
                data.resinT = 0;
                data.domainClaims = 0;
                data.weeklyWeek = "";
                data.weeklyN = 0;
                return data;
            }
            if (fromVersion == 26)
            {
                // v26엔 꽃이 없었다 — 이미 쓰러뜨린 수호장 자리엔 꽃이 핀 것으로(받으면 150초 뒤 다시 선다).
                data.version = 27;
                data.guardianBloom = data.guardianDown;
                data.guardianPaidAt = 0;
                return data;
            }
            if (fromVersion == 27)
            {
                // v27엔 이야기 임무가 없었다 — 1장 첫 단계부터.
                data.version = 28;
                data.storyCh = 0;
                data.storyStep = 0;
                return data;
            }
            if (fromVersion == 28)
            {
                // v28엔 첫걸음 사명이 없었다 — 옛 세이브는 이미 해 본 사람이라 전부 끝난 것으로.
                data.version = 29;
                data.tutDone = GoTutorial.AllIds();
                return data;
            }
            return null;
        }

        /// <summary>저장할 플레이어 위치 — 마을집 방 안이면 밖 복귀 자리(U-0039, 불러오면 포켓 공간에 떨어지지 않게).</summary>
        private static float[] SavedPlayerPos(Vector3 current)
        {
            Vector3 p = World.GoHouseInterior.SavePosition(current);
            return new[] { p.x, p.y, p.z };
        }

        private static Transform FindPlayer()
        {
            var go = GameObject.FindWithTag("Player");
            return go != null ? go.transform : null;
        }
    }
}
