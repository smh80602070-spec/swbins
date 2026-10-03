using TMPro;
using System.Reflection;
using UnityEditor;
using UnityEditor.SceneManagement;
using UnityEngine;
using UnityEngine.UI;
using Saga.Core;
using Saga.Story.Data;
using Saga.Story.Player;
using Saga.Story.World;
using Saga.Story.UI;

namespace Saga.EditorTools
{
    /// <summary>`PlaytestStorySlice` 의 일부(partial) — tasks U-0010 분할.</summary>
    public static partial class PlaytestStorySlice
    {
        /// <summary>PLAN.md 101-2 STORY 5-2 2단계(2026-09-23) — 2차 전직·2차 무예·유파 세트. 무사로
        /// 전직해 CheckJobSkills를 마친 직후 부른다(레벨은 앞 단계 GainExp로 Lv.15 이상):
        /// (a) 전직 막힘 사유 둘(레벨·무예 5), (b) 전직관 ShowPromote → **진짜 선택 버튼 onClick**으로
        /// 장군이 되고 grow가 사슬로 더해지며 무기는 뿌리(검) 그대로, (c) 2차 무예 선행 조건,
        /// (d) 칸 자동 배치(윗자리부터 + 같은 유파 짝 먼저)·세트 판정, (e) 세트 보정 다섯
        /// (피해·범위·강화 지속·발수·dash 재사용 대기)이 실제 시전 값에 실리는지, (f) rain(앞만 맞음),
        /// (g) 패널 줄=사슬 무예 수, (h) 비경 경험치 식·체력 배율, 모르는 직업 키 로드.
        /// 끝나면 장군 상태로 남겨 뒤의 세이브 왕복이 2차 키도 확인하게 한다.</summary>
        private static bool CheckPromotionAndSchools()
        {
            const string T = "[PlaytestStorySlice]";
            int level = StoryJobState.Level;
            float exp = StoryJobState.Exp;
            if (StoryJobState.Job != "warrior" || level < StoryCombat.JobPromoteLevel)
            {
                Debug.LogError($"{T} 2차 전직 검사 전제 이상 — job={StoryJobState.Job} level={level}(기대 ≥{StoryCombat.JobPromoteLevel})");
                return false;
            }

            // (a)
            StorySkillState.Restore(new[] { "w_cut" }, new[] { StoryCombat.JobPromoteSkillLevel - 1 });
            if (StoryJobState.PromoteBlock() != "job.why_skill") { Debug.LogError($"{T} 무예 4인데 막힘 사유={StoryJobState.PromoteBlock()}(기대 job.why_skill)"); return false; }
            StoryJobState.Restore(StoryCombat.JobPromoteLevel - 1, 0f, "warrior");
            StorySkillState.Restore(new[] { "w_cut" }, new[] { StoryCombat.JobPromoteSkillLevel });
            if (StoryJobState.PromoteBlock() != "job.why_level") { Debug.LogError($"{T} Lv.14인데 막힘 사유={StoryJobState.PromoteBlock()}(기대 job.why_level)"); return false; }
            StoryJobState.Restore(level, exp, "warrior");
            if (!StoryJobState.CanPromote || StoryJobState.NextJob != "general") { Debug.LogError($"{T} 조건 채웠는데 전직 불가 — why={StoryJobState.PromoteBlock()} next={StoryJobState.NextJob}"); return false; }

            // (b) 진짜 버튼 — 전직관 → StoryChoiceUi 첫 버튼.
            var trainer = Object.FindFirstObjectByType<StoryJobTrainer>();
            var choice = StoryChoiceUi.Instance;
            var yes = choice != null ? GetPrivate(choice, "optionAButton") as Button : null;
            if (trainer == null || yes == null) { Debug.LogError($"{T} 전직관({trainer != null})·선택 UI 버튼({yes != null}) 없음"); return false; }
            trainer.ShowPromote();
            if (!choice.IsShowing) { Debug.LogError($"{T} ShowPromote()가 선택 UI를 안 띄움"); return false; }
            yes.onClick.Invoke();
            StorySkillPanelUi.Instance?.Hide();
            float expectAtk = StoryCombat.JobsTier1["warrior"].Atk + StoryCombat.JobsTier2["general"].Atk;
            if (StoryJobState.Job != "general" || StoryJobState.Tier != 2 || StoryJobState.Root != "warrior" ||
                !Mathf.Approximately(StoryJobState.AtkBonus, expectAtk) || StoryJobState.NextJob != "marshal" || choice.IsShowing)
            {
                Debug.LogError($"{T} 2차 전직 뒤 상태 이상 — job={StoryJobState.Job} tier={StoryJobState.Tier} root={StoryJobState.Root} atk+={StoryJobState.AtkBonus}(기대={expectAtk}) next={StoryJobState.NextJob} ui={choice.IsShowing}");
                return false;
            }
            var weapon = Object.FindFirstObjectByType<StoryWeaponVisual>();
            if (weapon == null || weapon.CurrentWeaponRoot == null || weapon.CurrentWeaponRoot.childCount < 2)
            {
                Debug.LogError($"{T} 장군 전직 뒤 손에 검이 없음(뿌리 무기 유지 실패)");
                return false;
            }

            // (c) 선행 조건 — 2차 무예는 같은 유파 1차 5가 먼저, 1차 무예도 계속 찍힌다.
            StorySkillState.Restore(new[] { "w_cut" }, new[] { 4 });
            if (StorySkillState.CanRaise("g_smash") != "skill.why_need") { Debug.LogError($"{T} 참격 4인데 패왕격 사유={StorySkillState.CanRaise("g_smash")}"); return false; }
            StorySkillState.Restore(new[] { "w_cut" }, new[] { 5 });
            if (StorySkillState.CanRaise("g_smash") != null || StorySkillState.CanRaise("w_whirl") != null || StorySkillState.CanRaise("s_rain") != "skill.why_other_job")
            {
                Debug.LogError($"{T} 장군 찍기 사유 이상 — 패왕격={StorySkillState.CanRaise("g_smash")} 선풍={StorySkillState.CanRaise("w_whirl")} 전우={StorySkillState.CanRaise("s_rain")}");
                return false;
            }

            // (d) 자동 배치 — 2차 둘 먼저, 남은 두 칸은 그 짝(같은 유파 1차)이 표 순서보다 앞선다.
            StorySkillState.Restore(
                new[] { "w_cut", "w_whirl", "w_rush", "w_iron", "w_edge", "g_smash", "g_edge" },
                new[] { 5, 1, 1, 1, 5, 1, 1 });
            string[] expectSlots = { "g_smash", "g_edge", "w_cut", "w_edge" };
            for (int i = 0; i < expectSlots.Length; i++)
            {
                var s = StorySkillState.SlotSkill(i);
                if (s == null || s.Key != expectSlots[i]) { Debug.LogError($"{T} 장군 무예 칸 {i}={s?.Key}(기대={expectSlots[i]})"); return false; }
            }
            if (StorySkillState.SchoolTier("w_jung") != 2 || StorySkillState.SchoolTier("w_pa") != 2 || StorySkillState.SchoolTier("w_pae") != 0)
            {
                Debug.LogError($"{T} 세트 판정 이상 — 정={StorySkillState.SchoolTier("w_jung")} 파={StorySkillState.SchoolTier("w_pa")} 패={StorySkillState.SchoolTier("w_pae")}(기대 2/2/0)");
                return false;
            }

            // (e) 세트 보정이 실제 시전에 실린다.
            var castMethod = typeof(StoryPlayerController).GetMethod("TryCastJobSkill", BindingFlags.NonPublic | BindingFlags.Instance);
            var cds = (System.Collections.Generic.Dictionary<string, float>)GetPrivate(_storyController, "_skillCooldownLeft");
            cds.Clear();
            TeleportPlayer(new Vector3(5f, 0.1f, 0f));
            StoryCombat.RestoreMp(StoryCombat.MpMaxCurrent);
            _storyController.TriggerJobSkill(0); // 패왕격(정 2세트 → 피해 ×1.15)
            var smash = StorySkillData.Get("g_smash");
            if (_storyController.LastCast.key != "g_smash" || !Mathf.Approximately(_storyController.LastCast.mul, StorySkillState.MulOf(smash) * 1.15f))
            {
                Debug.LogError($"{T} 정 2세트 피해 보정 안 실림 — key={_storyController.LastCast.key} mul={_storyController.LastCast.mul}(기대={StorySkillState.MulOf(smash) * 1.15f})");
                return false;
            }

            if (!CastWithSet(castMethod, cds, "general", new[] { "w_iron", "g_wall" }, "g_wall", out var wall)) return false;
            if (!Mathf.Approximately(wall.buffSec, 11f * 1.15f)) { Debug.LogError($"{T} 수 2세트 철벽 지속={wall.buffSec}(기대={11f * 1.15f})"); return false; }

            int boltsBefore = Object.FindObjectsByType<StoryBolt>(FindObjectsSortMode.None).Length;
            if (!CastWithSet(castMethod, cds, "sniper", new[] { "a_double", "s_split" }, "s_split", out var split)) return false;
            int boltsAdded = Object.FindObjectsByType<StoryBolt>(FindObjectsSortMode.None).Length - boltsBefore;
            if (split.shots != 5 || boltsAdded != 5) { Debug.LogError($"{T} 연 2세트 분시 발수={split.shots}/생긴 투사체={boltsAdded}(기대 5/5)"); return false; }

            if (!CastWithSet(castMethod, cds, "assassin", new[] { "r_step", "x_shadow" }, "x_shadow", out var shadow)) return false;
            if (!Mathf.Approximately(shadow.cooldown, 6f * 0.8f * StoryLabyrinthState.CooldownMul) || shadow.critForce)
            {
                Debug.LogError($"{T} 보 2세트 그림자밟기 재사용={shadow.cooldown}(기대={6f * 0.8f}) 급소확정={shadow.critForce}(2세트엔 false)");
                return false;
            }

            if (!CastWithSet(castMethod, cds, "sage", new[] { "m_bolt", "p_quake" }, "p_quake", out var quake)) return false;
            if (!Mathf.Approximately(quake.radius, StorySkillData.Get("p_quake").RadiusM * 1.15f)) { Debug.LogError($"{T} 진 2세트 지진 반경={quake.radius}"); return false; }

            // 세트가 없으면 보정도 없다(1차 하나만).
            StorySkillState.Restore(new[] { "m_bolt" }, new[] { 5 });
            var none = StorySkillState.BonusOf(StorySkillData.Get("m_bolt"));
            if (none.AoeMul != 1f || none.DmgMul != 1f || none.ShotsAdd != 0) { Debug.LogError($"{T} 세트 없는데 보정이 붙음"); return false; }

            // (f) rain — 앞 띠만 맞고 등 뒤는 안 맞는다.
            StoryJobState.Restore(level, exp, "sniper");
            StorySkillState.Restore(new[] { "s_rain" }, new[] { 1 });
            cds.Clear();
            TeleportPlayer(new Vector3(5f, 0.1f, 0f));
            SetPrivate(_storyController, "_facing", 1f);
            var front = SpawnDummyEnemy(new Vector3(8f, 0.1f, 0f));
            var behind = SpawnDummyEnemy(new Vector3(3f, 0.1f, 0f));
            StoryCombat.RestoreMp(StoryCombat.MpMaxCurrent);
            castMethod.Invoke(_storyController, new object[] { StorySkillData.Get("s_rain") });
            if (!front.IsDead || behind.IsDead) { Debug.LogError($"{T} 전우 판정 이상 — 앞 더미 죽음={front.IsDead} 뒤 더미 죽음={behind.IsDead}"); return false; }
            if (!behind.IsDead) Object.Destroy(behind.gameObject);

            // (g) 패널 — 3단계(차수 탭)부터 한 번에 한 차수만: 열면 지금 자리(2차) 탭, 1차 탭으로 바꾸면 무사 줄.
            StoryJobState.Restore(level, exp, "general");
            StorySkillState.Restore(null, null);
            var panel = StorySkillPanelUi.Instance;
            panel.Show();
            int rows2 = panel.RowCount, tab2 = panel.CurrentTab, tabs = panel.TabCount;
            panel.SelectTab(1);
            int rows1 = panel.RowCount;
            panel.Hide();
            if (tab2 != 2 || tabs != 2 || rows2 != StorySkillData.OfJob("general").Count || rows1 != StorySkillData.OfJob("warrior").Count)
            {
                Debug.LogError($"{T} 장군 무예 패널 — 탭 {tabs}개·연 탭 {tab2}(기대 2/2) 2차 줄 {rows2}(기대={StorySkillData.OfJob("general").Count}) 1차 줄 {rows1}(기대={StorySkillData.OfJob("warrior").Count})");
                return false;
            }

            // (h) 비경 경험치 식(lv=1은 옛 고정값과 같다)·체력 배율·모르는 직업 키.
            if (StoryCombat.EnemyExp(1, false) != StoryCombat.GruntExp || StoryCombat.EnemyExp(1, true) != StoryCombat.BossExp ||
                StoryCombat.EnemyExp(15, false) != 66f || StoryCombat.EnemyExp(15, true) != 990f)
            {
                Debug.LogError($"{T} 적 경험치 식 이상 — lv1={StoryCombat.EnemyExp(1, false)}/{StoryCombat.EnemyExp(1, true)} lv15={StoryCombat.EnemyExp(15, false)}/{StoryCombat.EnemyExp(15, true)}");
                return false;
            }
            float expectHpMul = (StoryCombat.StartAtk + StoryJobState.AtkBonus + StoryLabyrinthState.MemoryAtkBonus) / StoryCombat.StartAtk;
            if (!Mathf.Approximately(StoryLabyrinthRunner.PlayerPowerHpMul(), expectHpMul) || expectHpMul <= 1f)
            {
                Debug.LogError($"{T} 비경 체력 배율={StoryLabyrinthRunner.PlayerPowerHpMul()}(기대={expectHpMul}, >1)");
                return false;
            }
            StoryJobState.Restore(level, exp, "no_such_job");
            bool unknownOk = StoryJobState.Job == StoryJobState.NoJob;
            StoryJobState.Restore(level, exp, "general");
            if (!unknownOk) { Debug.LogError($"{T} 모르는 직업 키가 무명으로 안 돌아감"); return false; }

            StorySkillState.Restore(null, null);
            cds.Clear();
            SetPrivate(_storyController, "_buffUntilTime", 0f);
            Debug.Log("[PlaytestStorySlice] promotion + schools OK - 2차 전직(진짜 버튼)·선행·칸 배치·세트 5종(피해/지속/발수/재사용/반경)·전우·패널·비경 식");
            return true;
        }

        /// <summary>PLAN.md 101-2 STORY 5-2 3단계(2026-09-23) — 3·4차 전직과 무예 칸 고정. 장군 상태로
        /// CheckPromotionAndSchools를 마친 직후 부른다:
        /// (a) 3차 막힘 사유(Lv.20·2차 무예 8)와 사유 숫자 → 진짜 버튼으로 원수(grow 세 자리 합),
        /// (b) 4차 막힘 사유(Lv.25·3차 무예 10) → 진짜 버튼으로 전신, 더 오를 자리 없음, 무기는 뿌리(검),
        /// (c) 자동 배치만이면 4차 무예 넷(유파 전부 다름, 세트 0) — 3단계 칸 고정을 넣은 이유,
        /// (d) 칸 고정: 패널 "칸" 버튼 경로로 안 익힌 무예 거절·다섯째 거절·풀기 당김·고정 하나 + 자동 짝,
        /// (e) 정(正) 4세트(1~4차 고정) → 파멸격 피해 ×1.35가 실제 시전에, 보(步) 4세트 → 명계보
        ///     급소 확정 + 재사용 ×0.8, 무사 질(疾)은 무예 셋뿐이라 4세트 불가,
        /// (f) 패널 탭 넷·지금 자리 탭·칸 줄 글자, (g) 3·4차 무예 선행이 사슬 안에 있는지.
        /// 끝나면 전신 상태(레벨은 원래대로)로 남겨 뒤의 세이브 왕복이 4차 키와 칸 고정을 확인하게 한다.</summary>
        private static bool CheckUpperTiersAndPins()
        {
            const string T = "[PlaytestStorySlice]";
            int level = StoryJobState.Level;
            float exp = StoryJobState.Exp;
            var trainer = Object.FindFirstObjectByType<StoryJobTrainer>();
            var choice = StoryChoiceUi.Instance;
            var yes = choice != null ? GetPrivate(choice, "optionAButton") as Button : null;
            if (StoryJobState.Job != "general" || trainer == null || yes == null)
            {
                Debug.LogError($"{T} 3·4차 검사 전제 이상 — job={StoryJobState.Job}(기대 general) 전직관={trainer != null} 버튼={yes != null}");
                return false;
            }

            // (a) 3차 — 원수.
            StoryJobState.Restore(StoryCombat.JobPromoteLevel3 - 1, 0f, "general");
            StorySkillState.Restore(new[] { "w_cut", "g_smash" }, new[] { 5, StoryCombat.JobPromoteSkillLevel3 });
            if (StoryJobState.PromoteBlock() != "job.why_level" || StoryJobState.PromoteLevelNeeded != 20 || StoryJobState.NextJob != "marshal")
            {
                Debug.LogError($"{T} 장군 Lv.19 사유={StoryJobState.PromoteBlock()} 요구 Lv={StoryJobState.PromoteLevelNeeded}(기대 why_level/20) next={StoryJobState.NextJob}");
                return false;
            }
            StoryJobState.Restore(StoryCombat.JobPromoteLevel3, 0f, "general");
            StorySkillState.Restore(new[] { "w_cut", "g_smash" }, new[] { 10, StoryCombat.JobPromoteSkillLevel3 - 1 });
            if (StoryJobState.PromoteBlock() != "job.why_skill" || StoryJobState.PromoteSkillLevelNeeded != 8)
            {
                // 1차 무예(참격 10)는 안 센다 — 웹판 canJoin()도 바로 아랫자리(장군) 무예만 본다.
                Debug.LogError($"{T} 패왕격 7인데 사유={StoryJobState.PromoteBlock()} 요구={StoryJobState.PromoteSkillLevelNeeded}(기대 why_skill/8)");
                return false;
            }
            StorySkillState.Restore(new[] { "w_cut", "g_smash" }, new[] { 5, StoryCombat.JobPromoteSkillLevel3 });
            trainer.ShowPromote();
            if (!choice.IsShowing) { Debug.LogError($"{T} 3차 ShowPromote()가 선택 UI를 안 띄움"); return false; }
            yes.onClick.Invoke();
            StorySkillPanelUi.Instance?.Hide();
            float atk3 = StoryCombat.JobsTier1["warrior"].Atk + StoryCombat.JobsTier2["general"].Atk + StoryCombat.JobsTier3["marshal"].Atk;
            if (StoryJobState.Job != "marshal" || StoryJobState.Tier != 3 || StoryJobState.Root != "warrior" ||
                !Mathf.Approximately(StoryJobState.AtkBonus, atk3) || StoryJobState.NextJob != "warlord")
            {
                Debug.LogError($"{T} 3차 전직 뒤 — job={StoryJobState.Job} tier={StoryJobState.Tier} root={StoryJobState.Root} atk+={StoryJobState.AtkBonus}(기대={atk3}) next={StoryJobState.NextJob}");
                return false;
            }

            // (b) 4차 — 전신(3차 무예 하나를 10, 만렙).
            StoryJobState.Restore(StoryCombat.JobPromoteLevel4 - 1, 0f, "marshal");
            StorySkillState.Restore(new[] { "w_cut", "g_smash", "n_heaven" }, new[] { 5, 5, 10 });
            if (StoryJobState.PromoteBlock() != "job.why_level" || StoryJobState.PromoteLevelNeeded != 25)
            {
                Debug.LogError($"{T} 원수 Lv.24 사유={StoryJobState.PromoteBlock()} 요구 Lv={StoryJobState.PromoteLevelNeeded}(기대 why_level/25)");
                return false;
            }
            StoryJobState.Restore(StoryCombat.JobPromoteLevel4, 0f, "marshal");
            StorySkillState.Restore(new[] { "w_cut", "g_smash", "n_heaven" }, new[] { 5, 5, 9 });
            if (StoryJobState.PromoteBlock() != "job.why_skill" || StoryJobState.PromoteSkillLevelNeeded != 10)
            {
                Debug.LogError($"{T} 천붕격 9인데 사유={StoryJobState.PromoteBlock()} 요구={StoryJobState.PromoteSkillLevelNeeded}(기대 why_skill/10)");
                return false;
            }
            StorySkillState.Restore(new[] { "w_cut", "g_smash", "n_heaven" }, new[] { 5, 5, 10 });
            trainer.ShowPromote();
            if (!choice.IsShowing) { Debug.LogError($"{T} 4차 ShowPromote()가 선택 UI를 안 띄움"); return false; }
            yes.onClick.Invoke();
            StorySkillPanelUi.Instance?.Hide();
            float atk4 = atk3 + StoryCombat.JobsTier4["warlord"].Atk;
            var weapon = Object.FindFirstObjectByType<StoryWeaponVisual>();
            if (StoryJobState.Job != "warlord" || StoryJobState.Tier != 4 || StoryJobState.Root != "warrior" ||
                !Mathf.Approximately(StoryJobState.AtkBonus, atk4) || StoryJobState.NextJob != "godwar" ||
                StoryJobState.PromoteBlock() != "job.why_level" || StoryJobState.PromoteLevelNeeded != 30 || // tasks U-0025 — 4차 뒤에 5차(군신 Lv.30)가 이어진다
 weapon == null || weapon.CurrentWeaponRoot == null || weapon.CurrentWeaponRoot.childCount < 2)
            {
                Debug.LogError($"{T} 4차 전직 뒤 — job={StoryJobState.Job} tier={StoryJobState.Tier} root={StoryJobState.Root} atk+={StoryJobState.AtkBonus}(기대={atk4}) next={StoryJobState.NextJob} why={StoryJobState.PromoteBlock()} 검={weapon != null && weapon.CurrentWeaponRoot != null && weapon.CurrentWeaponRoot.childCount >= 2}");
                return false;
            }

            // (c) 자동 배치만이면 4차 무예 넷이 칸을 다 차지해 세트가 하나도 안 켜진다.
            string[] learned = { "w_cut", "w_whirl", "w_rush", "w_edge", "g_smash", "g_roar", "g_edge",
                "n_heaven", "n_quake", "n_charge", "n_edge", "o_ruin", "o_tremor", "o_smite", "o_edge" };
            int[] lvls = { 5, 5, 5, 5, 5, 5, 5, 5, 5, 5, 5, 1, 1, 1, 1 };
            StorySkillState.Restore(learned, lvls);
            string[] autoSlots = { "o_ruin", "o_tremor", "o_smite", "o_edge" };
            for (int i = 0; i < autoSlots.Length; i++)
            {
                var s = StorySkillState.SlotSkill(i);
                if (s == null || s.Key != autoSlots[i]) { Debug.LogError($"{T} 전신 자동 칸 {i}={s?.Key}(기대={autoSlots[i]})"); return false; }
            }
            if (StorySkillState.SchoolTier("w_jung") != 0 || StorySkillState.SchoolTier("w_pa") != 0)
            {
                Debug.LogError($"{T} 자동 배치에서 세트가 켜짐 — 정={StorySkillState.SchoolTier("w_jung")} 파={StorySkillState.SchoolTier("w_pa")}");
                return false;
            }

            // (d) 칸 고정 — 패널 "칸" 버튼과 같은 경로(ClickPin).
            var panel = StorySkillPanelUi.Instance;
            panel.Show();
            panel.ClickPin("w_iron"); // 안 익힘
            if (StorySkillState.PinCount != 0) { Debug.LogError($"{T} 안 익힌 철갑이 고정됨"); panel.Hide(); return false; }
            panel.ClickPin("w_cut");
            // 참격 하나만 고정 → 칸0=참격, 남은 칸은 자동(4차부터, 같은 유파 파멸격이 먼저).
            string[] onePin = { "w_cut", "o_ruin", "o_tremor", "o_smite" };
            for (int i = 0; i < onePin.Length; i++)
            {
                var s = StorySkillState.SlotSkill(i);
                if (s == null || s.Key != onePin[i]) { Debug.LogError($"{T} 고정 하나 뒤 칸 {i}={s?.Key}(기대={onePin[i]})"); panel.Hide(); return false; }
            }
            if (StorySkillState.SchoolTier("w_jung") != 2) { Debug.LogError($"{T} 참격 고정으로 정 2세트가 안 켜짐({StorySkillState.SchoolTier("w_jung")})"); panel.Hide(); return false; }
            panel.ClickPin("g_smash");
            panel.ClickPin("n_heaven");
            panel.ClickPin("o_ruin");
            panel.ClickPin("o_edge"); // 다섯째 — 거절
            if (StorySkillState.PinCount != 4 || StorySkillState.PinIndex("o_edge") >= 0 || StorySkillState.SchoolTier("w_jung") != 4)
            {
                Debug.LogError($"{T} 고정 넷 — 수={StorySkillState.PinCount}(기대 4) 파천검 고정={StorySkillState.PinIndex("o_edge")}(기대 -1) 정 세트={StorySkillState.SchoolTier("w_jung")}(기대 4)");
                panel.Hide();
                return false;
            }
            string slotsText = panel.SlotsText;
            if (!slotsText.Contains(StoryLocalization.T("skill.o_ruin", "파멸격").Split('(')[0]) || panel.TabCount != 4 || panel.CurrentTab != 4 || panel.RowCount != StorySkillData.OfJob("warlord").Count)
            {
                Debug.LogError($"{T} 전신 패널 — 칸 줄=\"{slotsText}\" 탭 {panel.TabCount}(기대 4) 연 탭 {panel.CurrentTab}(기대 4) 줄 {panel.RowCount}(기대={StorySkillData.OfJob("warlord").Count})");
                panel.Hide();
                return false;
            }
            panel.ClickPin("g_smash"); // 풀기 — 뒤의 고정이 당겨진다
            if (StorySkillState.PinIndex("n_heaven") != 1 || StorySkillState.PinIndex("o_ruin") != 2 || StorySkillState.PinCount != 3)
            {
                Debug.LogError($"{T} 고정 풀기 뒤 당김 — 천붕격={StorySkillState.PinIndex("n_heaven")}(기대 1) 파멸격={StorySkillState.PinIndex("o_ruin")}(기대 2)");
                panel.Hide();
                return false;
            }
            panel.Hide();

            // (e) 4세트가 실제 시전에 실린다.
            var castMethod = typeof(StoryPlayerController).GetMethod("TryCastJobSkill", BindingFlags.NonPublic | BindingFlags.Instance);
            var cds = (System.Collections.Generic.Dictionary<string, float>)GetPrivate(_storyController, "_skillCooldownLeft");
            StorySkillState.Restore(learned, lvls, new[] { "w_cut", "g_smash", "n_heaven", "o_ruin" });
            cds.Clear();
            TeleportPlayer(new Vector3(5f, 0.1f, 0f));
            StoryCombat.RestoreMp(StoryCombat.MpMaxCurrent);
            _storyController.TriggerJobSkill(3); // 칸3 = 파멸격
            var ruin = StorySkillData.Get("o_ruin");
            if (_storyController.LastCast.key != "o_ruin" || !Mathf.Approximately(_storyController.LastCast.mul, StorySkillState.MulOf(ruin) * 1.35f))
            {
                Debug.LogError($"{T} 정 4세트 — key={_storyController.LastCast.key} mul={_storyController.LastCast.mul}(기대={StorySkillState.MulOf(ruin) * 1.35f})");
                return false;
            }
            int jilCount = 0;
            foreach (var sk in StorySkillData.All) if (sk.School == "w_jil") jilCount++;
            if (jilCount != 3) { Debug.LogError($"{T} 무사 질(疾) 무예 {jilCount}개(기대 3 — 2차가 없어 4세트 불가, 웹판 그대로)"); return false; }

            StoryJobState.Restore(StoryCombat.JobPromoteLevel4, 0f, "reaper");
            StorySkillState.Restore(new[] { "r_step", "x_shadow", "v_void", "d_veil" }, new[] { 5, 5, 5, 1 },
                new[] { "r_step", "x_shadow", "v_void", "d_veil" });
            cds.Clear();
            TeleportPlayer(new Vector3(5f, 0.1f, 0f));
            StoryCombat.RestoreMp(StoryCombat.MpMaxCurrent);
            bool veilOk = (bool)castMethod.Invoke(_storyController, new object[] { StorySkillData.Get("d_veil") });
            var veil = _storyController.LastCast;
            if (!veilOk || veil.key != "d_veil" || !veil.critForce || !Mathf.Approximately(veil.cooldown, 8f * 0.8f * StoryLabyrinthState.CooldownMul))
            {
                Debug.LogError($"{T} 보 4세트 명계보 — ok={veilOk} 급소확정={veil.critForce}(기대 true) 재사용={veil.cooldown}(기대={8f * 0.8f})");
                return false;
            }

            // (g) 3·4차 무예 — 선행이 자기 사슬의 아랫자리 무예인지, 차수 4 무예는 자리 넷 모두에.
            foreach (var sk in StorySkillData.All)
            {
                if (sk.Tier < 3) continue;
                var pre = StorySkillData.Get(sk.Need);
                if (pre == null || pre.Tier >= sk.Tier || StoryJobState.RootOf(pre.Job) != StoryJobState.RootOf(sk.Job))
                {
                    Debug.LogError($"{T} {sk.Key}(차수 {sk.Tier}) 선행 {sk.Need}가 없거나 사슬 밖/같은 차수");
                    return false;
                }
            }
            foreach (var key in StoryCombat.JobsTier4.Keys)
            {
                if (StorySkillData.OfJob(key).Count < 5) { Debug.LogError($"{T} 4차 {key} 무예 {StorySkillData.OfJob(key).Count}개(기대 ≥5)"); return false; }
            }

            StoryJobState.Restore(level, exp, "warlord");
            StorySkillState.Restore(null, null);
            cds.Clear();
            SetPrivate(_storyController, "_buffUntilTime", 0f);
            Debug.Log("[PlaytestStorySlice] upper tiers + pins OK - 3·4차 전직(진짜 버튼·Lv.20/25·무예 8/10)·자동 칸 세트 0·칸 고정(거절/당김/자동 짝)·정 4세트·보 4세트 급소확정·차수 탭");
            return true;
        }

        /// <summary>PLAN.md 101-3 G(2026-09-23, 웹판 jobLook 이식) — 전직 차수마다 옷 빛깔. 무명 0 →
        /// 1차 0.12 → 2차 0.24 → 4차 0.48, 갈래가 바뀌면 색도 바뀌고, 첫 옷 슬롯 색 = 원래 색과 갈래 색의
        /// 섞임, 피부 재질이 있으면 건너뛴다(Maria), 무명으로 돌리면 원래 색. 끝나면 전신 상태로 되돌린다.</summary>
        private static bool CheckOutfitTint()
        {
            const string T = "[PlaytestStorySlice]";
            var tint = Object.FindFirstObjectByType<StoryOutfitTint>();
            if (tint == null) { Debug.LogError($"{T} 플레이어에 StoryOutfitTint가 없음(씬 재빌드 필요?)"); return false; }
            int level = StoryJobState.Level;
            float exp = StoryJobState.Exp;
            string job = StoryJobState.Job;

            StoryJobState.Restore(level, exp, StoryJobState.NoJob);
            var original = tint.FirstTintedColor();
            if (tint.CurrentMix != 0f || original == null) { Debug.LogError($"{T} 무명 옷 — mix={tint.CurrentMix}(기대 0) 옷 슬롯={original != null}"); return false; }

            (string key, int tier, string root)[] steps = { ("warrior", 1, "warrior"), ("general", 2, "warrior"), ("warlord", 4, "warrior"), ("reaper", 4, "rogue") };
            foreach (var (key, tier, root) in steps)
            {
                StoryJobState.Restore(level, exp, key); // JobChosen → Refresh
                float mix = Mathf.Min(StoryOutfitTint.TintMax, tier * StoryOutfitTint.TintPerTier);
                var expect = Color.Lerp(original.Value, StoryOutfitTint.BranchColor(root), mix);
                var got = tint.FirstTintedColor();
                if (!Mathf.Approximately(tint.CurrentMix, mix) || tint.TintedSlots < 1 || got == null ||
                    Mathf.Abs(got.Value.r - expect.r) > 0.002f || Mathf.Abs(got.Value.g - expect.g) > 0.002f || Mathf.Abs(got.Value.b - expect.b) > 0.002f)
                {
                    Debug.LogError($"{T} {key} 옷 — mix={tint.CurrentMix}(기대 {mix}) 옷 슬롯={tint.TintedSlots} 색={got}(기대 {expect})");
                    return false;
                }
            }
            bool hasSkin = false;
            foreach (var r in _storyController.Visual.GetComponentsInChildren<Renderer>(true))
                foreach (var m in r.sharedMaterials)
                    if (m != null && m.name.IndexOf("Skin", System.StringComparison.OrdinalIgnoreCase) >= 0) hasSkin = true;
            if (hasSkin && tint.SkippedSkinSlots < 1) { Debug.LogError($"{T} 피부 재질이 있는데 건너뛴 슬롯 0 — 피부까지 물듦"); return false; }

            StoryJobState.Restore(level, exp, StoryJobState.NoJob);
            var back = tint.FirstTintedColor();
            StoryJobState.Restore(level, exp, job);
            if (back == null || back.Value != original.Value) { Debug.LogError($"{T} 무명으로 돌려도 옷 색이 안 돌아옴 — {back}(기대 {original})"); return false; }
            Debug.Log($"[PlaytestStorySlice] outfit tint OK - 무명 0·1차 0.12·2차 0.24·4차 0.48, 갈래 색, 피부 {tint.SkippedSkinSlots}슬롯 제외(Maria={hasSkin}), 되돌림");
            return true;
        }

        /// <summary>`job`으로 두고 `keys`(1차 5 + 2차 1)를 찍어 `cast`를 쏜 뒤 LastCast를 돌려준다.</summary>
        private static bool CastWithSet(MethodInfo castMethod, System.Collections.Generic.Dictionary<string, float> cds,
            string job, string[] keys, string cast,
            out (string key, float mul, float radius, int shots, float buffSec, float cooldown, bool critForce) last)
        {
            StoryJobState.Restore(StoryJobState.Level, StoryJobState.Exp, job);
            StorySkillState.Restore(keys, new[] { 5, 1 });
            cds.Clear();
            TeleportPlayer(new Vector3(5f, 0.1f, 0f));
            StoryCombat.RestoreMp(StoryCombat.MpMaxCurrent);
            bool ok = (bool)castMethod.Invoke(_storyController, new object[] { StorySkillData.Get(cast) });
            last = _storyController.LastCast;
            if (!ok || last.key != cast)
            {
                Debug.LogError($"[PlaytestStorySlice] {job} {cast} 시전 실패(ok={ok} last={last.key}) — 세트 {string.Join("+", keys)}");
                return false;
            }
            return true;
        }

        private static void Fail()
        {
            _hadError = true;
            EditorApplication.update -= Tick;
            EditorApplication.isPlaying = false;
        }

        /// <summary>PLAN.md 67~69장 "접근성"(2026-09-14) — GO
        /// `PlaytestHeadless.CheckSettingsPanel()`과 같은 결. 이 파일은
        /// 새 Phase를 안 늘리고 Init 안에서 한 번만 부른다(다단계 Phase
        /// 머신에 끼워 넣는 비용을 피한다 — 디버그 오버레이 확장 때와
        /// 같은 판단, docs/PROJECT_STATE.md 참고).</summary>
        private static bool CheckSettingsPanel()
        {
            var panel = Object.FindFirstObjectByType<StorySettingsPanel>();
            if (panel == null)
            {
                Debug.LogError("[PlaytestStorySlice] StorySettingsPanel 컴포넌트를 못 찾음");
                return false;
            }

            var panelGoField = typeof(StorySettingsPanel).GetField("_panel", BindingFlags.NonPublic | BindingFlags.Instance);
            var panelGo = panelGoField.GetValue(panel) as GameObject;
            if (panelGo == null)
            {
                Debug.LogError("[PlaytestStorySlice] StorySettingsPanel._panel이 null — 씬 재로드 후 참조가 안 살아남음");
                return false;
            }

            var toggleMethod = typeof(StorySettingsPanel).GetMethod("TogglePanel", BindingFlags.NonPublic | BindingFlags.Instance);
            toggleMethod.Invoke(panel, null); // 열기 — 여기서 NRE가 나면 그대로 테스트 실패로 드러난다.
            if (!panelGo.activeSelf)
            {
                Debug.LogError("[PlaytestStorySlice] TogglePanel() 호출 후에도 설정 패널이 안 열림");
                return false;
            }
            toggleMethod.Invoke(panel, null); // 닫기
            if (panelGo.activeSelf)
            {
                Debug.LogError("[PlaytestStorySlice] TogglePanel() 두 번째 호출 후에도 설정 패널이 안 닫힘");
                return false;
            }

            var sfxValueLabelField = typeof(StorySettingsPanel).GetField("_sfxValueLabel", BindingFlags.NonPublic | BindingFlags.Instance);
            var sfxValueLabel = sfxValueLabelField.GetValue(panel) as TextMeshProUGUI;
            if (sfxValueLabel == null)
            {
                Debug.LogError("[PlaytestStorySlice] StorySettingsPanel._sfxValueLabel이 null");
                return false;
            }

            bool sfxBefore = StorySettingsState.SfxOn;
            var chooseSfxMethod = typeof(StorySettingsPanel).GetMethod("ChooseSfx", BindingFlags.NonPublic | BindingFlags.Instance);
            chooseSfxMethod.Invoke(panel, null); // 실제 버튼 핸들러 — 상태를 뒤집고 Refresh()까지 그대로 탄다.
            string expectedText = StoryLocalization.T(StorySettingsState.SfxOn ? "state.on" : "state.off");
            if (StorySettingsState.SfxOn == sfxBefore || sfxValueLabel.text != expectedText)
            {
                Debug.LogError($"[PlaytestStorySlice] ChooseSfx() 이후 라벨이 실제로 안 바뀜 text=\"{sfxValueLabel.text}\"(기대=\"{expectedText}\")");
                return false;
            }
            chooseSfxMethod.Invoke(panel, null); // 원상복귀

            bool vibBefore = StorySettingsState.VibrationOn;
            StorySettingsState.VibrationOn = !vibBefore;
            if (StorySettingsState.VibrationOn == vibBefore)
            {
                Debug.LogError("[PlaytestStorySlice] 진동 토글이 안 바뀜");
                return false;
            }

            StorySettingsState.UiScaleMultiplier = 1.15f;
            var scaler = Saga.Core.SagaUi.FirstGameScaler(); // Ⅱ 단추 등 메뉴 캔버스는 뺀다(110 ⑤c)
            float expected = Saga.Core.SagaUi.GameReference.x / 1.15f; // 110 ⑤b 기준 1600×900
            if (scaler == null || Mathf.Abs(scaler.referenceResolution.x - expected) > 1f)
            {
                Debug.LogError($"[PlaytestStorySlice] UI 크기가 캔버스에 안 먹음 — got={(scaler == null ? "null" : scaler.referenceResolution.x.ToString())}");
                return false;
            }
            StorySettingsState.UiScaleMultiplier = 1f;

            StorySettingsState.HighGraphicsQuality = false;
            if (!Mathf.Approximately(QualitySettings.shadowDistance, 15f) || QualitySettings.antiAliasing != 0)
            {
                Debug.LogError($"[PlaytestStorySlice] 그래픽 품질(절약)이 QualitySettings에 안 먹음 — shadowDistance={QualitySettings.shadowDistance} aa={QualitySettings.antiAliasing}");
                return false;
            }
            StorySettingsState.HighGraphicsQuality = true;

            string langBefore = StoryLocalization.CurrentLanguage;
            string qualityLabelBefore = StorySettingsState.GraphicsQualityLabel();
            StoryLocalization.CycleLanguage();
            if (StoryLocalization.CurrentLanguage == langBefore
                || StorySettingsState.GraphicsQualityLabel() == qualityLabelBefore)
            {
                Debug.LogError("[PlaytestStorySlice] 언어 전환이 실제 문구를 안 바꿈");
                return false;
            }
            StoryLocalization.CurrentLanguage = langBefore;

            Debug.Log("[PlaytestStorySlice] settings panel OK - sfx/vibration/ui-scale/graphics-quality/language all verified");
            return true;
        }

        /// <summary>PLAN.md 67~69장 "Localization" 2차(2026-09-14) — StoryHud의
        /// MP 표시가 실제로 영어 문구를 보여주는지 본다.</summary>
        private static bool CheckPlayerHudLocalization()
        {
            var hudGo = GameObject.Find("StoryHudUI");
            var hud = hudGo != null ? hudGo.GetComponent<StoryHud>() : null;
            var label = hudGo != null ? hudGo.GetComponentInChildren<TextMeshProUGUI>() : null;
            if (hud == null || label == null)
            {
                Debug.LogError("[PlaytestStorySlice] StoryHudUI/Label을 못 찾음");
                return false;
            }

            string langBefore = StoryLocalization.CurrentLanguage;
            var method = typeof(StoryHud).GetMethod("Refresh", BindingFlags.NonPublic | BindingFlags.Instance);

            StoryLocalization.CurrentLanguage = "en";
            method.Invoke(hud, null);
            if (!label.text.Contains("MP"))
            {
                Debug.LogError($"[PlaytestStorySlice] StoryHud 영어 전환이 안 먹음 text=\"{label.text}\"");
                StoryLocalization.CurrentLanguage = langBefore;
                return false;
            }
            StoryLocalization.CurrentLanguage = langBefore;
            method.Invoke(hud, null);

            Debug.Log("[PlaytestStorySlice] player hud localization OK");
            return true;
        }

        /// <summary>2026-09-15 "모바일 액션 버튼 언어 전환 반응" —
        /// `LocalizedButtonLabel`(폴링, Update()는 private이라 리플렉션)이
        /// 실제로 씬 빌드 시점 이후에도 언어를 따라가는지 본다.</summary>
        private static bool CheckActionButtonLocalization()
        {
            var go = GameObject.Find("ActionButton_공격");
            var localized = go != null ? go.GetComponent<LocalizedButtonLabel>() : null;
            var label = go != null ? go.GetComponentInChildren<TextMeshProUGUI>() : null;
            if (localized == null || label == null)
            {
                Debug.LogError("[PlaytestStorySlice] ActionButton_공격/LocalizedButtonLabel을 못 찾음");
                return false;
            }

            string langBefore = StoryLocalization.CurrentLanguage;
            var method = typeof(LocalizedButtonLabel).GetMethod("Update", BindingFlags.NonPublic | BindingFlags.Instance);

            StoryLocalization.CurrentLanguage = "en";
            method.Invoke(localized, null);
            if (label.text != "Attack")
            {
                Debug.LogError($"[PlaytestStorySlice] 액션 버튼 영어 전환이 안 먹음 text=\"{label.text}\"(기대=Attack)");
                StoryLocalization.CurrentLanguage = langBefore;
                return false;
            }
            StoryLocalization.CurrentLanguage = langBefore;
            method.Invoke(localized, null);
            if (label.text != (langBefore == "en" ? "Attack" : "공격"))
            {
                Debug.LogError($"[PlaytestStorySlice] 액션 버튼이 원래 언어로 안 돌아옴 text=\"{label.text}\"(기대=공격)");
                return false;
            }

            Debug.Log("[PlaytestStorySlice] action button localization OK");
            return true;
        }

        /// <summary>PLAN.md 101-2 "공통 선행" A·B(STORY 네 번째 이식) —
        /// `PlaytestHeadless.CheckGoalBoardAndSessionCard()`(GO)·DUNGEON·
        /// FOREST 버전과 같은 기준, 이 파일의 bool-반환 관례에 맞춰 옮김 —
        /// GoalBoard 세 줄이 실제로 채워지는지, Awake()의 IGoalSource 자동
        /// 재탐색이 동작하는지, SessionCard 가 뜨고 스스로 닫히는지를
        /// 직접 확인한다.</summary>
        private static bool CheckGoalBoardAndSessionCard()
        {
            var board = Object.FindFirstObjectByType<GoalBoard>();
            if (board == null)
            {
                Debug.LogError("[PlaytestStorySlice] GoalBoard 컴포넌트를 못 찾음");
                return false;
            }

            var sourceField = typeof(GoalBoard).GetField("_source", BindingFlags.NonPublic | BindingFlags.Instance);
            if (sourceField.GetValue(board) == null)
            {
                Debug.LogError("[PlaytestStorySlice] GoalBoard._source가 null — Awake() 자동 재탐색 실패");
                return false;
            }

            var labelField = typeof(GoalBoard).GetField("_label", BindingFlags.NonPublic | BindingFlags.Instance);
            var label = labelField.GetValue(board) as TextMeshProUGUI;
            if (label == null || !label.text.Contains(Saga.Core.SagaUi.L("지금", "Now") + " —") || !label.text.Contains(Saga.Core.SagaUi.L("이번 세션", "This session") + " —") || !label.text.Contains(Saga.Core.SagaUi.L("이번 주", "This week") + " —"))
            {
                Debug.LogError($"[PlaytestStorySlice] GoalBoard 세 줄이 안 채워짐 text=\"{(label == null ? "null" : label.text.Replace("\n", " | "))}\"");
                return false;
            }

            var card = Object.FindFirstObjectByType<SessionCard>();
            if (card == null)
            {
                Debug.LogError("[PlaytestStorySlice] SessionCard 컴포넌트를 못 찾음");
                return false;
            }
            if (card.IsShowing)
            {
                Debug.LogError("[PlaytestStorySlice] SessionCard가 세션 시작부터 떠 있음(기본은 숨김)");
                return false;
            }

            card.Show("테스트", "줄1", "줄2");
            if (!card.IsShowing)
            {
                Debug.LogError("[PlaytestStorySlice] SessionCard.Show() 호출 후에도 안 뜸");
                return false;
            }

            // 5초를 실제로 안 기다리고 _closeTimer를 만료 직전으로 돌린 뒤
            // Update()를 한 번 더 불러 자동 닫힘 경로를 확인한다.
            var closeTimerField = typeof(SessionCard).GetField("_closeTimer", BindingFlags.NonPublic | BindingFlags.Instance);
            closeTimerField.SetValue(card, 0.0001f);
            var updateMethod = typeof(SessionCard).GetMethod("Update", BindingFlags.NonPublic | BindingFlags.Instance);
            updateMethod.Invoke(card, null);
            if (card.IsShowing)
            {
                Debug.LogError("[PlaytestStorySlice] SessionCard가 만료 후에도 자동으로 안 닫힘");
                return false;
            }

            if (Object.FindFirstObjectByType<StorySessionTracker>() == null)
            {
                Debug.LogError("[PlaytestStorySlice] StorySessionTracker 컴포넌트를 못 찾음");
                return false;
            }

            Debug.Log("[PlaytestStorySlice] goal board / session card OK - 3 lines filled, source auto-found, card shows and auto-closes");
            return true;
        }

        private static void TeleportPlayer(Vector3 position)
        {
            if (_playerController != null) _playerController.enabled = false;
            _player.position = position;
            if (_playerController != null) _playerController.enabled = true;
        }

        private static object GetPrivate(object target, string fieldName)
        {
            var field = target.GetType().GetField(fieldName, BindingFlags.NonPublic | BindingFlags.Instance);
            return field?.GetValue(target);
        }

        private static void SetPrivate(object target, string fieldName, object value)
        {
            var field = target.GetType().GetField(fieldName, BindingFlags.NonPublic | BindingFlags.Instance);
            field?.SetValue(target, value);
        }

        private static void InvokePrivate(object target, string methodName)
        {
            var method = target.GetType().GetMethod(methodName, BindingFlags.NonPublic | BindingFlags.Instance);
            method?.Invoke(target, null);
        }
    }
}
