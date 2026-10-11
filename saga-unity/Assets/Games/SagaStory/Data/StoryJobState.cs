using System;
using UnityEngine;

namespace Saga.Story.Data
{
    /// <summary>
    /// PLAN.md 51장 "STORY 확장 — 전직·SP 투자 UI"(saga-godot
    /// `story_save_state.gd`의 level/exp/job 부분이 정본, SP 투자 자체는
    /// 범위 밖 — `StoryCombat.JobsTier1` 클래스 주석 참고). `StoryQuestState.cs`
    /// 와 같은 결의 정적 상태 클래스 — 인스턴스가 하나뿐이라 MonoBehaviour로
    /// 안 만든다.
    /// </summary>
    public static class StoryJobState
    {
        public const string NoJob = "none";

        public static int Level { get; private set; } = 1;
        public static float Exp { get; private set; }
        public static string Job { get; private set; } = NoJob;

        public static event Action<int> LeveledUp;

        // PLAN.md 101-3 G "장비 가시화"(2026-09-18, `StoryWeaponVisual.cs`
        // 전용) — 전직은 딱 한 번뿐이라(1절 CanChooseJob) 매 프레임 폴링
        // 대신 이벤트로 배선한다. DUNGEON `HeroState.EquipmentChanged`·GO
        // `Inventory.ItemGained`와 같은 결.
        public static event Action<string> JobChosen;

        public static bool HasJob => Job != NoJob;

        /// <summary>core.js gainExp() 그대로 — 한 번에 여러 레벨을 넘을 수
        /// 있어 while로 처리한다(연속 처치 등).</summary>
        public static void GainExp(float amount)
        {
            if (amount <= 0f) return;
            Exp += amount;
            while (Exp >= StoryCombat.ExpNeed(Level))
            {
                Exp -= StoryCombat.ExpNeed(Level);
                Level++;
                LeveledUp?.Invoke(Level);
                StorySkillState.OnLevelUp(Level);   // tasks U-0093 무예 3택(구독 순서에 안 기대게 직접)
            }
        }

        public static bool CanChooseJob => !HasJob && Level >= StoryCombat.JobChangeLevel;

        /// <summary>story_job_trainer.gd `_choose()` 그대로 — 전직은 한
        /// 번뿐, 이미 골랐거나 레벨이 안 되면 조용히 실패(호출부가 상태
        /// 토스트로 알린다).</summary>
        public static bool ChooseJob(string jobKey)
        {
            if (!CanChooseJob) return false;
            if (!StoryCombat.JobsTier1.ContainsKey(jobKey)) return false;
            Job = jobKey;
            JobChosen?.Invoke(jobKey);
            return true;
        }

        // PLAN.md 101-2 5-2 2단계(2026-09-23) — 2차 자리. 웹판 `job.js` grow()처럼 자리 사슬
        // (2차 → 1차)을 따라 grow를 **더한다**(2차는 1차 위에 얹힌다).
        public static float AtkBonus => SumChain(i => i.Atk);
        public static float MpBonus => SumChain(i => i.Mp);
        public static float HpBonus => SumChain(i => i.Hp);

        public static string JobDisplayName => StoryCombat.TryGetJob(Job, out var info) ? info.Name : "";

        /// <summary>지금 자리의 차수(무명 0).</summary>
        public static int Tier => StoryCombat.TryGetJob(Job, out var info) ? info.Tier : 0;

        /// <summary>갈래 뿌리(1차 키) — 무기 모양·고유 조작처럼 2차에도 안 바뀌는 것들이 본다.</summary>
        public static string Root => RootOf(Job);

        public static string RootOf(string job)
        {
            string key = job;
            while (StoryCombat.TryGetJob(key, out var info) && info.From != null) key = info.From;
            return StoryCombat.JobsTier1.ContainsKey(key ?? "") ? key : NoJob;
        }

        /// <summary>`job`이 지금 자리 사슬(지금 자리 + 아랫자리들)에 드는가 — 웹판 skillsOf()의 판정.</summary>
        public static bool InChain(string job)
        {
            string key = Job;
            while (StoryCombat.TryGetJob(key, out var info))
            {
                if (key == job) return true;
                key = info.From;
            }
            return false;
        }

        private static float SumChain(Func<StoryCombat.JobInfo, float> pick)
        {
            float sum = 0f;
            string key = Job;
            while (StoryCombat.TryGetJob(key, out var info))
            {
                sum += pick(info);
                key = info.From;
            }
            return sum;
        }

        /// <summary>지금 자리에서 오를 윗자리(2~4차, 없으면 null) — 웹판 nextJobs()는 갈래마다 하나.</summary>
        public static string NextJob
        {
            get
            {
                if (!HasJob) return null;
                foreach (var table in StoryCombat.UpperJobTables)
                {
                    foreach (var kv in table)
                    {
                        if (kv.Value.From == Job) return kv.Key;
                    }
                }
                return null;
            }
        }

        /// <summary>다음 자리 차수(없으면 0) — 요구 레벨·무예 레벨을 고른다.</summary>
        public static int NextTier => NextJob != null ? Tier + 1 : 0;

        /// <summary>다음 자리로 오르는 레벨·아랫자리 무예 레벨(상태 줄 사유가 쓴다).</summary>
        public static int PromoteLevelNeeded => StoryCombat.PromoteLevelFor(NextTier);
        public static int PromoteSkillLevelNeeded => StoryCombat.PromoteSkillLevelFor(NextTier);

        /// <summary>윗자리 전직을 못 하는 이유(현지화 키), 되면 null — 웹판 canJoin() 순서
        /// (자리 → 레벨 → 아랫자리 무예 하나를 2차 5·3차 8·4차 10 이상).</summary>
        public static string PromoteBlock()
        {
            if (NextJob == null) return "job.why_no_next";
            if (Level < PromoteLevelNeeded) return "job.why_level";
            int best = 0;
            foreach (var sk in StorySkillData.All)
            {
                if (sk.Job == Job) best = Mathf.Max(best, StorySkillState.LevelOf(sk.Key));
            }
            return best < PromoteSkillLevelNeeded ? "job.why_skill" : null;
        }

        public static bool CanPromote => PromoteBlock() == null;

        /// <summary>윗자리 전직(2~4차) — 무예 레벨은 그대로 두고(웹판 join()도 skills를 안 건드린다)
        /// 자리만 올린다. `JobChosen`을 쏴 무기·HUD가 다시 그린다.</summary>
        public static bool Promote()
        {
            if (!CanPromote) return false;
            Job = NextJob;
            JobChosen?.Invoke(Job);
            return true;
        }

        /// <summary>세이브 로드·(테스트의) 상태 초기화 둘 다 이 경로를 탄다
        /// — `JobChosen`도 같이 쏴서 `StoryWeaponVisual`이 그때그때 손의
        /// 무기를 다시 맞추게 한다(2026-09-18, PLAN.md 101-3 G "장비
        /// 가시화" 이식 중 발견 — Restore가 이 이벤트를 안 쏘면 이전 세션이
        /// 남긴 무기 모델이 새 Job 상태와 안 맞게 손에 그대로 남는다).</summary>
        public static void Restore(int level, float exp, string job)
        {
            Level = Mathf.Max(1, level);
            Exp = Mathf.Max(0f, exp);
            // 모르는 자리(데이터에서 빠진 키)는 무명으로 — 무예·무기가 없는 자리를 잡고 있지 않게.
            Job = StoryCombat.TryGetJob(job, out _) ? job : NoJob;
            JobChosen?.Invoke(Job);
        }
    }
}
