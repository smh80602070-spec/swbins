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
        /// <summary>은사 선택 패널의 0번 버튼(항상 공격축, 축마다 하나씩
        /// 고정 순서로 뜬다 — StoryLabyrinthMapUi.ShowBlessingPick 참고)을
        /// 실제로 클릭해 콜백 경로까지 확인한다.</summary>
        private static bool ClickFirstBlessingButton(StoryLabyrinthMapUi mapUi)
        {
            var panel = GetPrivate(mapUi, "_blessingPanel") as GameObject;
            var root = GetPrivate(mapUi, "_blessingButtonRoot") as Transform;
            if (panel == null || !panel.activeSelf || root == null || root.childCount != 3)
            {
                Debug.LogError($"[PlaytestStorySlice] 비경 은사 패널이 안 뜸 — panelActive={(panel != null ? panel.activeSelf.ToString() : "null")} buttons={(root != null ? root.childCount.ToString() : "null")}(기대=3)");
                return false;
            }
            root.GetChild(0).GetComponent<Button>().onClick.Invoke();
            return true;
        }

        /// <summary>노드 지도 화면의 0번 버튼(노드 목록 중 첫째, 5층은
        /// "도전한다" 하나뿐)을 클릭한다.</summary>
        private static bool ClickFirstMapNodeButton(StoryLabyrinthMapUi mapUi)
        {
            var panel = GetPrivate(mapUi, "_mapPanel") as GameObject;
            var root = GetPrivate(mapUi, "_nodeButtonRoot") as Transform;
            if (panel == null || !panel.activeSelf || root == null || root.childCount == 0)
            {
                Debug.LogError($"[PlaytestStorySlice] 비경 노드 지도가 안 뜸 — panelActive={(panel != null ? panel.activeSelf.ToString() : "null")} buttons={(root != null ? root.childCount.ToString() : "null")}");
                return false;
            }
            root.GetChild(0).GetComponent<Button>().onClick.Invoke();
            return true;
        }

        private static void CheckJumpNow()
        {
            _storyController.TriggerJump();
            float v = (float)GetPrivate(_storyController, "_verticalVelocity");
            if (v <= 0f)
            {
                Debug.LogError($"[PlaytestStorySlice] TriggerJump() 뒤에도 수직 속도가 0 이하 — v={v}");
                Fail();
            }
            else
            {
                Debug.Log($"[PlaytestStorySlice] jump OK, verticalVelocity={v}");
            }
        }

        private static bool IsDestroyed(StoryEnemy enemy) => enemy == null;

        /// <summary>스킬 전용 더미 — StoryEnemySpawner 고정 자리와 무관하게
        /// 하나씩 즉석에서 세운다(modelPrefab 없이 CharacterVisual 폴백
        /// 캡슐로 충분, 시각 확인 대상이 아니다).</summary>
        private static StoryEnemy SpawnDummyEnemy(Vector3 position)
        {
            var go = new GameObject("TestDummyEnemy");
            go.transform.position = position;
            return go.AddComponent<StoryEnemy>();
        }

        /// <summary>PLAN.md 101-2 STORY "5-7 손맛 표준"(2026-09-17, 101-3 C
        /// 표) — 공격 직후 바로 확인한다(`StartCoroutine()`이 첫 yield 전
        /// 세그먼트를 같은 프레임에 동기 실행한다는 점 이용, DUNGEON
        /// `PlaytestDungeonHeadless.CheckHitstop()`과 같은 결). 카메라
        /// 흔들림은 `_shakeTimer`(private) 로, hitstop 은 player Animator
        /// 의 `.speed` 로 본다 — 둘 다 `TryAttack()` 호출과 같은 프레임에서
        /// 봐야 하므로 호출부(Phase.KillEnemies)가 첫 공격 직후 바로 부른다.</summary>
        private static bool CheckHitFeedback()
        {
            var cam = StoryCameraFollow.Instance;
            if (cam == null)
            {
                Debug.LogError("[PlaytestStorySlice] StoryCameraFollow.Instance가 없음 — shake 검증 불가");
                return false;
            }
            float shakeTimer = (float)GetPrivate(cam, "_shakeTimer");
            if (shakeTimer <= 0f)
            {
                Debug.LogError("[PlaytestStorySlice] 공격 직후 카메라 shake가 안 걸림(_shakeTimer<=0)");
                return false;
            }

            var animator = GetPrivate(_storyController, "animator") as Animator;
            if (animator != null && animator.speed != 0f)
            {
                Debug.LogError($"[PlaytestStorySlice] hitstop이 공격 직후 player Animator를 안 멈춤 — speed={animator.speed}");
                return false;
            }

            Debug.Log(animator == null
                ? "[PlaytestStorySlice] hit feedback OK - shake 확인(player Animator는 null, 폴백 캡슐 케이스라 hitstop 검증 스킵)"
                : "[PlaytestStorySlice] hit feedback OK - shake + hitstop(Animator.speed=0) 확인");
            return true;
        }

        /// <summary>PLAN.md 101-3 G "성장 연출"(2026-09-18 STORY 이식) — GO/
        /// DUNGEON `CheckLevelUpCut()`과 같은 결. 호출부(Phase.Init)가
        /// **세션에서 가장 먼저** 부른다 — KillEnemies 단계부터는 잡졸을
        /// 죽일 때마다 `StoryJobState.GainExp()`가 걸려, 나중에 확인하면
        /// 이미 다른 레벨업 컷이 지나갔거나 겹쳤을 수 있다(GO가 실제로
        /// 겪은 함정과 같은 종류).</summary>
        private static bool CheckLevelUpCut()
        {
            var cam = StoryCameraFollow.Instance;
            if (cam == null)
            {
                Debug.LogError("[PlaytestStorySlice] 성장 연출 검증용 StoryCameraFollow를 못 찾음");
                return false;
            }

            var zField = typeof(StoryCameraFollow).GetField("_zDistance", BindingFlags.NonPublic | BindingFlags.Instance);
            float before = (float)zField.GetValue(cam);

            StoryJobState.GainExp(StoryCombat.ExpNeed(StoryJobState.Level) + 1f);

            float after = (float)zField.GetValue(cam);
            if (Mathf.Approximately(after, before))
            {
                Debug.LogError($"[PlaytestStorySlice] 레벨업 직후 카메라 거리(zDistance)가 안 바뀜 — {after}");
                return false;
            }
            Debug.Log($"[PlaytestStorySlice] level-up cut OK - 레벨업 직후 zDistance {before:F2}→{after:F2}");
            return true;
        }

        /// <summary>PLAN.md 101-3 G "지형 반응"(2026-09-18 STORY 이식) — GO
        /// `PlaytestHeadless.CheckGroundDecal()`과 같은 결, "최대 32" 캡이
        /// 지켜지는지 직접 40개를 스폰해 확인한다.</summary>
        private static bool CheckGroundDecalCap()
        {
            for (int i = 0; i < 40; i++)
            {
                StoryGroundDecal.Spawn(Vector3.zero, StoryGroundDecal.Kind.HitMark);
            }
            if (StoryGroundDecal.ActiveCount > 32)
            {
                Debug.LogError($"[PlaytestStorySlice] 지형 데칼 최대 32 캡이 안 지켜짐 — ActiveCount={StoryGroundDecal.ActiveCount}");
                return false;
            }
            Debug.Log($"[PlaytestStorySlice] ground decal cap OK - ActiveCount={StoryGroundDecal.ActiveCount}(≤32)");
            return true;
        }

        /// <summary>PLAN.md 101-3 G "장비 가시화"(2026-09-18, 사용자 선택
        /// "직업별 무기 소켓") — 전직 전엔 맨손(`StoryWeaponVisual.
        /// CurrentWeaponRoot`가 null)이어야 한다. `CheckWeaponVisualAfterJob()`
        /// 과 짝(전/후 비교) — GO `CheckWeaponVisual()`이 등급 전/후 칼날
        /// 크기를 비교하는 것과 같은 결.</summary>
        private static bool CheckWeaponVisualBeforeJob()
        {
            var weaponVisual = Object.FindFirstObjectByType<StoryWeaponVisual>();
            if (weaponVisual == null)
            {
                Debug.LogError("[PlaytestStorySlice] 무기 가시화 검증용 StoryWeaponVisual을 못 찾음");
                return false;
            }
            if (weaponVisual.CurrentWeaponRoot != null)
            {
                Debug.LogError("[PlaytestStorySlice] 전직 전인데 이미 무기가 들려 있음(맨손이어야 함)");
                return false;
            }
            return true;
        }

        /// <summary>전직(무사) 직후 검 모양(자루+칼날 둘)이 실제로 소켓 밑에
        /// 생겼는지 본다.</summary>
        private static bool CheckWeaponVisualAfterJob()
        {
            var weaponVisual = Object.FindFirstObjectByType<StoryWeaponVisual>();
            var root = weaponVisual != null ? weaponVisual.CurrentWeaponRoot : null;
            if (root == null)
            {
                Debug.LogError("[PlaytestStorySlice] 전직(warrior) 후에도 무기가 안 생김");
                return false;
            }
            if (root.childCount < 2)
            {
                Debug.LogError($"[PlaytestStorySlice] 검(무사) 무기에 부품이 모자람 — childCount={root.childCount}(기대≥2, 자루+칼날)");
                return false;
            }
            Debug.Log($"[PlaytestStorySlice] weapon visual OK - 전직(warrior) 후 검 모양 생김(부품 {root.childCount}개)");
            return true;
        }

        /// <summary>2026-09-23 발견 — 에디터 빌드가 `onClick.AddListener`(런타임 전용)로 건
        /// 리스너는 씬 저장 때 안 남아, 저장된 씬의 버튼이 전부 먹통이었다. 지금까지의 진단은
        /// 핸들러를 리플렉션으로 직접 불러 이걸 못 잡았다 — 여기선 **진짜 `Button.onClick`**을
        /// 눌러 본다. 상태를 바꾸는 버튼(교대·저장·무예 칸)은 영속 리스너 수만 본다.</summary>
        private static bool CheckButtonWiring()
        {
            // (a) 공격 버튼 — 눌러서 실제로 공격 쿨다운이 걸리는지.
            var attackButton = GameObject.Find("ActionButton_공격")?.GetComponent<Button>();
            if (attackButton == null) { Debug.LogError("[PlaytestStorySlice] ActionButton_공격 Button 없음"); return false; }
            // 시작 자리 옆 잡졸을 진짜로 베어 KillEnemies의 "잡졸 10" 전제를 깨뜨린 적이 있어
            // (실제로 겪음) 모든 적에게서 멀리 옮겨 누르고 같은 틱 안에 되돌린다.
            Vector3 startPos = _player.position;
            float minEnemyX = float.MaxValue;
            foreach (var e in StoryEnemy.All) minEnemyX = Mathf.Min(minEnemyX, e.transform.position.x);
            TeleportPlayer(new Vector3(minEnemyX - 10f, startPos.y, 0f));
            SetPrivate(_storyController, "_attackCooldownLeft", 0f);
            attackButton.onClick.Invoke();
            TeleportPlayer(startPos);
            if ((float)GetPrivate(_storyController, "_attackCooldownLeft") <= 0f)
            {
                Debug.LogError("[PlaytestStorySlice] 공격 버튼 onClick을 눌러도 공격이 안 나감(리스너가 씬에 안 남음)");
                return false;
            }
            SetPrivate(_storyController, "_attackCooldownLeft", 0f);

            // (b) 씬 빌더가 건 나머지 버튼 — 영속 리스너가 실제로 저장됐는지.
            string[] persistentNames =
            {
                "ActionButton_점프", "ActionButton_횡소", "ActionButton_기탄", "ActionButton_기합",
                "ActionButton_선봉", "ActionButton_유격", "ActionButton_호법", "ActionButton_무예", "ActionButton_소환", "SaveButton",
                "SkillSlot_0", "SkillSlot_1", "SkillSlot_2", "SkillSlot_3",
            };
            foreach (var name in persistentNames)
            {
                var b = GameObject.Find(name)?.GetComponent<Button>();
                if (b == null || b.onClick.GetPersistentEventCount() < 1)
                {
                    Debug.LogError($"[PlaytestStorySlice] {name} 버튼이 없거나 영속 onClick 리스너가 없음");
                    return false;
                }
            }

            // (c) 스스로 UI를 짓는 컴포넌트 — Awake()가 건 리스너로 실제로 열고 닫히는지.
            var settings = Object.FindFirstObjectByType<StorySettingsPanel>();
            var settingsToggle = settings != null ? (Button)GetPrivate(settings, "_toggleButton") : null;
            var settingsClose = settings != null ? (Button)GetPrivate(settings, "_closeButton") : null;
            var settingsPanel = settings != null ? (GameObject)GetPrivate(settings, "_panel") : null;
            if (settingsToggle == null || settingsClose == null || settingsPanel == null)
            {
                Debug.LogError("[PlaytestStorySlice] StorySettingsPanel 버튼 참조가 씬에 안 남음");
                return false;
            }
            settingsToggle.onClick.Invoke();
            bool openedBySettingsButton = settingsPanel.activeSelf;
            settingsClose.onClick.Invoke();
            if (!openedBySettingsButton || settingsPanel.activeSelf)
            {
                Debug.LogError($"[PlaytestStorySlice] 설정 버튼 onClick으로 안 열리거나 안 닫힘 — opened={openedBySettingsButton} stillOpen={settingsPanel.activeSelf}");
                return false;
            }

            var jobUi = Object.FindFirstObjectByType<StoryJobChoiceUi>();
            var jobButtons = jobUi != null ? (Button[])GetPrivate(jobUi, "_jobButtons") : null;
            if (jobButtons == null || jobButtons.Length != StoryCombat.JobOrder.Length)
            {
                Debug.LogError("[PlaytestStorySlice] StoryJobChoiceUi 직업 버튼 참조가 씬에 안 남음");
                return false;
            }
            string chosen = null;
            jobUi.Show("버튼 배선 확인", k => chosen = k);
            jobButtons[1].onClick.Invoke();
            if (chosen != StoryCombat.JobOrder[1] || jobUi.IsShowing)
            {
                Debug.LogError($"[PlaytestStorySlice] 전직 버튼 onClick이 콜백을 안 부르거나 안 닫힘 — chosen={chosen} showing={jobUi.IsShowing}");
                return false;
            }

            var skillUi = StorySkillPanelUi.Instance;
            var skillClose = skillUi != null ? (Button)GetPrivate(skillUi, "_closeButton") : null;
            if (skillClose == null)
            {
                Debug.LogError("[PlaytestStorySlice] StorySkillPanelUi(또는 닫기 버튼 참조)가 씬에 없음");
                return false;
            }
            GameObject.Find("ActionButton_무예").GetComponent<Button>().onClick.Invoke();
            bool openedBySkillButton = skillUi.IsShowing;
            skillClose.onClick.Invoke();
            if (!openedBySkillButton || skillUi.IsShowing)
            {
                Debug.LogError($"[PlaytestStorySlice] 무예 버튼 onClick으로 안 열리거나 닫기 버튼으로 안 닫힘 — opened={openedBySkillButton} stillOpen={skillUi.IsShowing}");
                return false;
            }

            var labyUi = StoryLabyrinthMapUi.Instance;
            var abandon = labyUi != null ? (Button)GetPrivate(labyUi, "_abandonButton") : null;
            var mapPanel = labyUi != null ? (GameObject)GetPrivate(labyUi, "_mapPanel") : null;
            if (abandon == null || mapPanel == null)
            {
                Debug.LogError("[PlaytestStorySlice] StoryLabyrinthMapUi 포기 버튼 참조가 씬에 안 남음");
                return false;
            }
            mapPanel.SetActive(true);
            abandon.onClick.Invoke(); // 회차 밖이라 AbandonRun()은 no-op, Close()만 탄다.
            if (mapPanel.activeSelf)
            {
                Debug.LogError("[PlaytestStorySlice] 비경 포기 버튼 onClick으로 지도가 안 닫힘");
                return false;
            }

            Debug.Log("[PlaytestStorySlice] button wiring OK - real onClick fired for attack/settings/job/skill/labyrinth, persistent listeners saved for the rest");
            return true;
        }

        /// <summary>PLAN.md 101-2 STORY 5-2 1단계(2026-09-23) — 직업 무예·SP. 무사로 막
        /// 전직한 직후 부른다: (a) 데이터 무결성, (b) SP 파생값·찍기·거절 사유, (c) 자동 무예 칸,
        /// (d) 효과 일곱 갈래(근접·범위·돌진·강화·관통·화살·연사, 퇴보사 후퇴) 실제 시전,
        /// (e) 쿨다운·기력 부족 거절, (f) 무예 패널 줄·찍기 버튼 경로.</summary>
        private static bool CheckJobSkills()
        {
            // (a)
            var seen = new System.Collections.Generic.HashSet<string>();
            foreach (var sk in StorySkillData.All)
            {
                if (!seen.Add(sk.Key)) { Debug.LogError($"[PlaytestStorySlice] 무예 키 중복 {sk.Key}"); return false; }
                if (!StoryCombat.TryGetJob(sk.Job, out _)) { Debug.LogError($"[PlaytestStorySlice] 무예 {sk.Key} 직업 {sk.Job} 없음"); return false; }
                if (StorySkillData.GetSchool(sk.School) == null) { Debug.LogError($"[PlaytestStorySlice] 무예 {sk.Key} 유파 {sk.School} 없음"); return false; }
                if (sk.Need != null && (StorySkillData.Get(sk.Need) == null || StorySkillData.Get(sk.Need).School != sk.School))
                {
                    Debug.LogError($"[PlaytestStorySlice] 무예 {sk.Key} 선행 {sk.Need}가 없거나 유파가 다름");
                    return false;
                }
            }
            foreach (var job in StoryCombat.JobOrder)
            {
                int n = StorySkillData.OfJob(job).Count;
                if (n < 5) { Debug.LogError($"[PlaytestStorySlice] {job} 무예 {n}개(기대 ≥5)"); return false; }
            }

            // (b)
            StorySkillState.Restore(null, null);
            int expectTotal = (StoryJobState.Level - 1) * StorySkillState.SpPerLevel;
            if (StorySkillState.SpTotal != expectTotal || StorySkillState.SpLeft != expectTotal || expectTotal < 12)
            {
                Debug.LogError($"[PlaytestStorySlice] SP 파생값 이상 — total={StorySkillState.SpTotal} left={StorySkillState.SpLeft}(기대={expectTotal}, ≥12)");
                return false;
            }
            if (StorySkillState.SlotSkill(0) != null) { Debug.LogError("[PlaytestStorySlice] 안 찍었는데 무예 칸 0이 참"); return false; }
            if (StorySkillState.CanRaise("a_shot") != "skill.why_other_job") { Debug.LogError($"[PlaytestStorySlice] 남의 직업 무예 거절 사유 이상 — {StorySkillState.CanRaise("a_shot")}"); return false; }
            if (!StorySkillState.Raise("w_cut") || StorySkillState.LevelOf("w_cut") != 1 || StorySkillState.SpLeft != expectTotal - 1)
            {
                Debug.LogError($"[PlaytestStorySlice] 참격 찍기 이상 — lv={StorySkillState.LevelOf("w_cut")} left={StorySkillState.SpLeft}");
                return false;
            }
            var wCut = StorySkillData.Get("w_cut");
            StorySkillState.Raise("w_cut");
            StorySkillState.Raise("w_cut");
            if (!Mathf.Approximately(StorySkillState.MulOf(wCut), wCut.MulBase + 2 * wCut.MulPerLevel))
            {
                Debug.LogError($"[PlaytestStorySlice] 참격 Lv.3 배율 이상 — {StorySkillState.MulOf(wCut)}(기대={wCut.MulBase + 2 * wCut.MulPerLevel})");
                return false;
            }
            StorySkillState.Restore(new[] { "w_cut" }, new[] { 10 });
            if (StorySkillState.CanRaise("w_cut") != "skill.why_maxed") { Debug.LogError($"[PlaytestStorySlice] 만렙 거절 사유 이상 — {StorySkillState.CanRaise("w_cut")}"); return false; }
            // 점수를 딱 다 쓴 상태 — 무예 하나 상한이 10이라 여러 무예에 나눠 채운다(w_rush는 남겨 둠).
            string[] fillKeys = { "w_cut", "w_whirl", "w_iron", "w_edge" };
            var fillLevels = new int[fillKeys.Length];
            int remaining = expectTotal;
            for (int i = 0; i < fillKeys.Length && remaining > 0; i++) { fillLevels[i] = Mathf.Min(10, remaining); remaining -= fillLevels[i]; }
            StorySkillState.Restore(fillKeys, fillLevels);
            if (remaining > 0 || StorySkillState.SpLeft != 0 || StorySkillState.CanRaise("w_rush") != "skill.why_no_sp")
            {
                Debug.LogError($"[PlaytestStorySlice] 점수 없음 거절 사유 이상 — left={StorySkillState.SpLeft} why={StorySkillState.CanRaise("w_rush")}");
                return false;
            }

            // (c) 표 순서 자동 배치 — 무사 다섯 중 앞 넷(참격·선풍·돌진·철갑), 파공검은 칸 밖.
            StorySkillState.Restore(new[] { "w_edge", "w_iron", "w_rush", "w_whirl", "w_cut" }, new[] { 1, 1, 1, 1, 1 });
            string[] expectSlots = { "w_cut", "w_whirl", "w_rush", "w_iron" };
            for (int i = 0; i < expectSlots.Length; i++)
            {
                var s = StorySkillState.SlotSkill(i);
                if (s == null || s.Key != expectSlots[i]) { Debug.LogError($"[PlaytestStorySlice] 무예 칸 {i}={s?.Key}(기대={expectSlots[i]})"); return false; }
            }

            // (d) 실제 시전 — facing은 이 테스트 내내 +1(오른쪽).
            var castMethod = typeof(StoryPlayerController).GetMethod("TryCastJobSkill", BindingFlags.NonPublic | BindingFlags.Instance);
            var cds = (System.Collections.Generic.Dictionary<string, float>)GetPrivate(_storyController, "_skillCooldownLeft");

            TeleportPlayer(new Vector3(5f, 0.1f, 0f));
            var meleeDummy = SpawnDummyEnemy(new Vector3(6f, 0.1f, 0f));
            StoryCombat.RestoreMp(StoryCombat.MpMax);
            _storyController.TriggerJobSkill(0); // 참격
            if (!meleeDummy.IsDead || !Mathf.Approximately(StoryCombat.Mp, StoryCombat.MpMax - wCut.Cost) || _storyController.JobSkillCooldownLeft("w_cut") <= 0f)
            {
                Debug.LogError($"[PlaytestStorySlice] 참격(근접) 시전 이상 — dead={meleeDummy.IsDead} mp={StoryCombat.Mp} cd={_storyController.JobSkillCooldownLeft("w_cut")}");
                return false;
            }
            float mpAfterFirst = StoryCombat.Mp;
            _storyController.TriggerJobSkill(0); // 쿨다운 중 — 기력이 안 빠져야 한다.
            if (!Mathf.Approximately(StoryCombat.Mp, mpAfterFirst)) { Debug.LogError("[PlaytestStorySlice] 참격 쿨다운 중인데 또 나감"); return false; }

            var aoeDummy = SpawnDummyEnemy(new Vector3(3.5f, 0.1f, 0f)); // 등 뒤 1.5m — 범위는 앞뒤를 안 가린다.
            StoryCombat.RestoreMp(StoryCombat.MpMax);
            _storyController.TriggerJobSkill(1); // 선풍
            if (!aoeDummy.IsDead) { Debug.LogError("[PlaytestStorySlice] 선풍(범위) 뒤에도 등 뒤 더미가 안 죽음"); return false; }

            float xBeforeDash = _player.position.x;
            var dashDummy = SpawnDummyEnemy(new Vector3(7f, 0.1f, 0f));
            StoryCombat.RestoreMp(StoryCombat.MpMax);
            _storyController.TriggerJobSkill(2); // 돌진
            float dashed = _player.position.x - xBeforeDash;
            if (dashed < 2f || !dashDummy.IsDead)
            {
                Debug.LogError($"[PlaytestStorySlice] 돌진 이상 — 이동={dashed:0.00}m(기대≈{StorySkillData.Get("w_rush").DistM:0.00}) dead={dashDummy.IsDead}");
                return false;
            }

            StoryCombat.RestoreMp(StoryCombat.MpMax);
            _storyController.TriggerJobSkill(3); // 철갑
            var buffAtk = (float)GetPrivate(_storyController, "_buffAtk");
            var buffUntil = (float)GetPrivate(_storyController, "_buffUntilTime");
            if (!Mathf.Approximately(buffAtk, 1.2f) || buffUntil < Time.time + 8.5f)
            {
                Debug.LogError($"[PlaytestStorySlice] 철갑(강화) 이상 — atk={buffAtk}(기대=1.2) until={buffUntil}(now={Time.time})");
                return false;
            }

            int boltsBefore = Object.FindObjectsByType<StoryBolt>(FindObjectsSortMode.None).Length;
            StoryCombat.RestoreMp(StoryCombat.MpMax);
            castMethod.Invoke(_storyController, new object[] { StorySkillData.Get("w_edge") }); // 칸 밖이어도 레벨 1이면 나간다.
            var boltsNow = Object.FindObjectsByType<StoryBolt>(FindObjectsSortMode.None);
            if (boltsNow.Length != boltsBefore + 1) { Debug.LogError($"[PlaytestStorySlice] 파공검(관통) 투사체 수 {boltsNow.Length - boltsBefore}(기대=1)"); return false; }

            // 궁수 무예 — 상태만 궁수 레벨로 채워 투사체 모양(관통 여부·발 수)과 후퇴를 본다.
            StorySkillState.Restore(new[] { "a_shot", "a_double", "a_retreat" }, new[] { 1, 1, 1 });
            cds.Clear();
            int piercingBefore = 0, nonPiercingBefore = 0;
            foreach (var b in Object.FindObjectsByType<StoryBolt>(FindObjectsSortMode.None)) { if (b.Pierce) piercingBefore++; else nonPiercingBefore++; }
            StoryCombat.RestoreMp(StoryCombat.MpMax);
            castMethod.Invoke(_storyController, new object[] { StorySkillData.Get("a_shot") });
            castMethod.Invoke(_storyController, new object[] { StorySkillData.Get("a_double") });
            int nonPiercingNow = 0;
            foreach (var b in Object.FindObjectsByType<StoryBolt>(FindObjectsSortMode.None)) { if (!b.Pierce) nonPiercingNow++; }
            if (nonPiercingNow - nonPiercingBefore != 1 + StorySkillData.Get("a_double").Shots)
            {
                Debug.LogError($"[PlaytestStorySlice] 사격+연사 비관통 투사체 {nonPiercingNow - nonPiercingBefore}(기대={1 + StorySkillData.Get("a_double").Shots})");
                return false;
            }
            float xBeforeRetreat = _player.position.x;
            StoryCombat.RestoreMp(StoryCombat.MpMax);
            castMethod.Invoke(_storyController, new object[] { StorySkillData.Get("a_retreat") });
            if (_player.position.x - xBeforeRetreat > -1f)
            {
                Debug.LogError($"[PlaytestStorySlice] 퇴보사가 뒤로 안 밀림 — Δx={_player.position.x - xBeforeRetreat:0.00}");
                return false;
            }

            // (e) 기력 부족 — 못 쓰고 쿨다운도 안 걸린다. 레벨 0 무예도 못 쓴다.
            cds.Clear();
            StoryCombat.RestoreMp(0f);
            bool castWithoutMp = (bool)castMethod.Invoke(_storyController, new object[] { StorySkillData.Get("a_shot") });
            StoryCombat.RestoreMp(StoryCombat.MpMax);
            bool castLevelZero = (bool)castMethod.Invoke(_storyController, new object[] { StorySkillData.Get("a_eye") });
            if (castWithoutMp || _storyController.JobSkillCooldownLeft("a_shot") > 0f || castLevelZero)
            {
                Debug.LogError($"[PlaytestStorySlice] 거절 이상 — 기력0 시전={castWithoutMp} 레벨0 시전={castLevelZero}");
                return false;
            }

            // (f) 무예 패널 — 무사 줄 수, 찍기 버튼 경로(ClickRaise = 줄 버튼 onClick).
            StorySkillState.Restore(null, null);
            var panel = StorySkillPanelUi.Instance;
            panel.Show();
            int expectRows = StorySkillData.OfJob("warrior").Count;
            if (panel.RowCount != expectRows) { Debug.LogError($"[PlaytestStorySlice] 무예 패널 줄 {panel.RowCount}(기대={expectRows})"); panel.Hide(); return false; }
            panel.ClickRaise("w_rush");
            if (StorySkillState.LevelOf("w_rush") != 1 || panel.RowCount != expectRows)
            {
                Debug.LogError($"[PlaytestStorySlice] 패널 찍기 뒤 레벨={StorySkillState.LevelOf("w_rush")}(기대=1) 줄={panel.RowCount}(다시 그려도 {expectRows}줄이어야 함 — DestroyImmediate)");
                panel.Hide();
                return false;
            }
            panel.Hide();
            cds.Clear();
            SetPrivate(_storyController, "_buffUntilTime", 0f);
            Debug.Log("[PlaytestStorySlice] job skills OK - SP derive/raise/refusals, auto slots, melee/aoe/dash/buff/bolt/arrow/volley/retreat cast, cooldown+mp refusals, panel rows");
            return true;
        }
    }
}
