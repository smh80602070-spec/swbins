using TMPro;
using System.Collections;
using UnityEngine;
using UnityEngine.UI;
using Saga.Go.Data;
using Saga.Go.Player;
using Saga.Go.UI;
using Saga.Go.Audio;
using Saga.Core;

namespace Saga.Go.World
{
    /// <summary>
    /// VERTICAL_SLICE.md Phase 6(61~71단계 — 72~74 엘리트/보스는 이번
    /// 슬라이스에서 스킵) + 29·34·35절의 "도적의 습격" 단 하나의 사건 +
    /// 실시간 전투. 승패를 가르는 수식은 Data/DuelRules.cs(웹판 js/duel.js
    /// 그대로)가 맡는다 — 여기는 그 상태를 3D 세계에 그려 보여주는 화면
    /// 층일 뿐이다(saga-godot의 bandit_encounter.gd와 같은 경계).
    ///
    /// "달아난다"(사건 선택지)는 여전히 대사만 보여주고 넘어간다. "값을
    /// 치른다"는 GoldState.cs가 생긴 뒤로는 실제로 돈을 쓴다 — 못 낼
    /// 만큼 없으면 그 선택지가 거절된다(아래 ChoosePay 참고).
    ///
    /// UI 조립 공통 부품(캔버스/패널/텍스트/버튼/막대)은 2026-09-11에
    /// `UI/EncounterUiKit.cs`로 뽑아냈다 — 두 번째 실시간 전투 사건
    /// (World/RareWolfEncounter.cs)이 생기며 그대로 복붙하면 코드가
    /// 그대로 두 벌이 될 상황이었다.
    /// </summary>
    [RequireComponent(typeof(SphereCollider))]
    public class BanditEncounter : MonoBehaviour
    {
        private const int Gx = 5;
        private const int Gy = 3;
        private const string FoeName = "산적";
        private const float FoePower = 120f;
        private const float FoeHpMul = 7f; // 웹판 event.js "event.foeHpMul" 기본값
        private const float AmbushRadius = 20f;
        private const float RetryCooldownSec = 8f;
        private const float ToastSec = 4f;
        private const float VictoryToastSec = 6f; // 등용+경험치+장비까지 한 번에 읽어야 해 더 길게
        private const string RecruitId = "산적";
        private const int ExpReward = 100;
        private const int VictoryGoldReward = 30;
        private const int PayTollCost = 40;

        // PLAN.md 101-3 C hitstop(2026-09-17 추가, DUNGEON `PlayerCombat`·STORY
        // `StoryCombat`과 같은 결) — `Time.timeScale` 대신 player·foe 두
        // Animator.speed만 잠깐 0으로 둔다. 이 판은 프레임 단위 공격 판정이
        // 아니라 초당 판정(`DuelRules.Step`)이라 "누가 때렸는지"가 아니라
        // "타격이 발생했는지"(hit/heavy 이벤트) 기준으로 둘 다 같이 멎는다.
        private const float HitstopSec = 0.07f;
        private const float HeavyHitstopSec = 0.12f;

        private static readonly Color BaseColor = new Color(0.5f, 0.14f, 0.14f);
        private static readonly Color TellColor = new Color(1.0f, 0.55f, 0.1f);

        private enum State { Idle, Prompt, Fight, Cooldown }

        private State _state = State.Idle;
        private DuelRules _duel;
        private float _cooldownLeft;
        private bool _playerInRange;

        // 67장 "사운드"(2026-09-14) — 강타/피격 화면 플래시에 맞춰 타격감
        // SFX. GoAudio.cs 클래스 주석 참고 — 승리/패배 음악은 아직 없다.
        [SerializeField] private AudioClip hitClip;

        // 편집기 빌드 스크립트가 Init()으로 채워 준다 — NpcBuilder.cs·
        // Gatherable.cs와 같은 이유(런타임 Awake()는 AssetDatabase를 못 쓴다).
        [SerializeField] private GameObject model;

        // 44장 "주요 Enemy" 교체 — model이 리깅된 캐릭터(Animator 포함,
        // 예: Abe)일 때 쓸 스케일. BuildTestVillageScene.cs가 실측 높이
        // 기준으로 계산해 넘긴다(DungeonEnemy.ConfigureCombat의 visualScale과
        // 같은 결 — 실측값을 여기 하드코딩하지 않는다).
        [SerializeField] private float riggedVisualScale = 1f;

        private Transform _visual;
        private Vector3 _visualBaseScale;
        private Color _restTint = BaseColor;
        private Animator _playerAnimator;

        private GameObject _promptRoot;
        private GameObject _combatRoot;
        private Image _flashImage;
        private Image _hpFill;
        private Image _moraleFill;
        private Image _kiFill;
        private TextMeshProUGUI _timerText;
        private Button _ultButton;

        private Coroutine _flashRoutine;
        private Coroutine _pulseRoutine;

        public void Init(GameObject modelIn) => model = modelIn;

        /// <summary>44장 "주요 Enemy" 교체 — 리깅된 모델(Animator 포함)을
        /// 쓸 때 스케일까지 같이 넘긴다.</summary>
        public void Init(GameObject modelIn, float riggedVisualScaleIn)
        {
            model = modelIn;
            riggedVisualScale = riggedVisualScaleIn;
        }

        private void Awake()
        {
            // 세이브를 불러온 씬에서 이미 등용된 도적이 또 나오지 않게
            // 막는다 — HiddenTreasure.cs·MountainShrine.cs·Gatherable.cs가
            // 쓰는 것과 같은 "한 번뿐인 자리" 패턴인데 이 클래스엔 빠져
            // 있었다(2026-09-11 발견·고침). PartyState.MemberIds가
            // IReadOnlyList라 Linq 없이 직접 훑는다.
            foreach (var id in PartyState.MemberIds)
            {
                if (id == RecruitId)
                {
                    Destroy(gameObject);
                    return;
                }
            }
            // 이미 저장된 씬을 실제 Play로 열면 Awake가 다시 불려 Build()를
            // 또 돌리는데, 편집기 빌드 스크립트가 이미 자식(시각·UI)을 만들어
            // 둔 뒤라 그대로 두면 두 벌씩 겹쳐 생긴다. 예전엔(2026-09-12 GLB
            // 교체 때) "Visual" 자식이 있으면 그냥 건너뛰고 PulseVisual()이
            // 쓸 _visual/_visualBaseScale만 복원했는데, 그러면 Update()가
            // 쓰는 _promptRoot/_combatRoot/_hpFill 같은 나머지 UI 필드는
            // 이번 Play 세션 내내 null로 남아 도적에게 다가가는 순간
            // NullReferenceException이 났을 것이다(2026-09-12 뒤늦게 발견 —
            // RareWolfEncounter.cs도 같은 결함이 있어 같이 고침). 대신 기존
            // 자식을 전부 지우고 Build()를 다시 통째로 돌려 모든 필드를
            // 확실히 채운다. (UI 캔버스는 EncounterUiKit.NewCanvas가 루트에
            // 만들어 이 transform의 자식이 아니라 이 loop로는 못 지우고
            // 편집기 빌드 때 만든 옛 캔버스 두 개가 비활성 상태로 씬에
            // 고아처럼 남는다 — 새로 만든 캔버스가 실제 동작을 맡으니
            // 기능은 정상이고, 남는 건 화면에 안 보이는 미사용 GameObject
            // 두 개뿐이라 이번엔 감수한다.)
            for (int i = transform.childCount - 1; i >= 0; i--)
            {
                DestroyImmediate(transform.GetChild(i).gameObject);
            }
            Build();
        }

        public void Build()
        {
            SpawnVisual();
            SpawnArea();
            BuildPromptUi();
            BuildCombatUi();
        }

        private void Update()
        {
            float dt = Time.deltaTime;
            Saga.Go.Combat.DuelGate.Report(_state == State.Fight); // PLAN.md 107-1 옛 결투 중엔 들판 전투가 멈춘다.
            switch (_state)
            {
                case State.Idle:
                    if (_playerInRange)
                    {
                        _state = State.Prompt;
                        _promptRoot.SetActive(true);
                    }
                    break;

                case State.Fight:
                    if (_duel != null)
                    {
                        var events = _duel.Step(dt);
                        foreach (var e in events)
                        {
                            OnDuelEvent(e);
                        }
                        RefreshCombatUi();
                        if (_duel.Over)
                        {
                            FinishFight();
                        }
                    }
                    break;

                case State.Cooldown:
                    _cooldownLeft -= dt;
                    if (_cooldownLeft <= 0f)
                    {
                        _state = State.Idle;
                    }
                    break;
            }
        }

        private void OnTriggerEnter(Collider other)
        {
            if (other.CompareTag("Player")) _playerInRange = true;
        }

        private void OnTriggerExit(Collider other)
        {
            if (other.CompareTag("Player")) _playerInRange = false;
        }

        // ---- 자리·모양 --------------------------------------------------------

        private void SpawnVisual()
        {
            char tile = TestMapData.TileAt(Gx, Gy);
            float ground = TestMapData.Legend[tile].Height;
            transform.position = TestMapData.WorldPos(Gx, Gy) + new Vector3(0, ground, 0);

            // 44장 "주요 Enemy" 교체 — model에 Animator가 이미 붙어 있으면
            // (Abe처럼 SetupAbeCharacterImport.cs가 구운 AbeAnimated.prefab)
            // 리깅된 캐릭터로 보고 실제 스케일(riggedVisualScale)로
            // Instantiate, 색조는 안 입힌다(실제 피부/옷 텍스처가 있어
            // 곱색하면 오염된다 — DungeonEnemy.cs와 같은 결). 그 외(Kenney
            // GLB·null)는 기존 CharacterVisual(NativeHeight 기준 스케일+
            // BaseColor 곱색) 경로 그대로.
            if (model != null && model.GetComponent<Animator>() != null)
            {
                var inst = Instantiate(model, transform, false);
                inst.name = "Visual";
                inst.transform.localScale = Vector3.one * riggedVisualScale;
                inst.transform.localPosition = Vector3.zero;
                inst.transform.localRotation = Quaternion.identity;
                _visual = inst.transform;
                _restTint = Color.white;
                CharacterVisual.EnsureBlobShadow(transform); // PLAN 102-5 "그림자 계단" — Spawn()을 안 타는 리깅 분기는 직접 부른다.
            }
            else
            {
                _visual = model != null
                    ? CharacterVisual.Spawn(model, transform, CharacterVisual.HumanHeight, BaseColor)
                    : CharacterVisual.SpawnFallbackCapsule(transform, BaseColor);
                _restTint = BaseColor;
            }
            _visualBaseScale = _visual.localScale;
        }

        private void SpawnArea()
        {
            var col = GetComponent<SphereCollider>();
            col.isTrigger = true;
            col.radius = AmbushRadius;
        }

        // ---- 사건 선택지 UI --------------------------------------------------------

        private void BuildPromptUi()
        {
            var canvas = EncounterUiKit.NewCanvas("EncounterPrompt");
            _promptRoot = canvas.gameObject;
            _promptRoot.SetActive(false);

            var panel = EncounterUiKit.NewPanel(canvas.transform, new Vector2(0.5f, 0.5f), new Vector2(700f, 480f), new Color(0f, 0f, 0f, 0.72f));

            EncounterUiKit.NewText(panel.transform, GoLocalization.T("encounter.bandit_intro", "🗡 도적의 습격\n\"길세를 내고 가라. 아니면 두고 가든지.\""),
                new Vector2(0.5f, 1f), new Vector2(0f, -28f), new Vector2(620f, 176f), 30); // 110 ⑤c-3: 글 상자가 첫 단추(-220)까지 내려와 겹쳤다

            EncounterUiKit.NewButton(panel.transform, GoLocalization.T("encounter.fight"), new Vector2(0.5f, 1f), new Vector2(0f, -220f), new Vector2(560f, 74f), ChooseFight);
            EncounterUiKit.NewButton(panel.transform, GoLocalization.T("encounter.pay"), new Vector2(0.5f, 1f), new Vector2(0f, -304f), new Vector2(560f, 74f), ChoosePay);
            EncounterUiKit.NewButton(panel.transform, GoLocalization.T("encounter.flee"), new Vector2(0.5f, 1f), new Vector2(0f, -388f), new Vector2(560f, 74f), ChooseFleeEvent);
        }

        private void ChooseFight()
        {
            _promptRoot.SetActive(false);
            StartFight();
        }

        private void ChoosePay()
        {
            _promptRoot.SetActive(false);
            string foeName = GoLocalization.T("foe.bandit", FoeName);
            if (GoldState.TrySpend(PayTollCost))
            {
                Toast(string.Format(GoLocalization.T("encounter.pay_success", "{0} — 길세 {1}냥을 치르고 지나갔다. (남은 돈 {2}냥)"), foeName, PayTollCost, GoldState.Gold));
            }
            else
            {
                Toast(string.Format(GoLocalization.T("encounter.pay_fail", "길세로 낼 {1}냥이 없다 — {0}이 앞을 막아선다."), foeName, PayTollCost));
            }
            EnterCooldown();
        }

        private void ChooseFleeEvent()
        {
            _promptRoot.SetActive(false);
            Toast(GoLocalization.T("encounter.flee_msg", "어둠 속으로 달아났다."));
            EnterCooldown();
        }

        // ---- 전투 화면 --------------------------------------------------------

        private void BuildCombatUi()
        {
            var canvas = EncounterUiKit.NewCanvas("CombatUI");
            _combatRoot = canvas.gameObject;
            _combatRoot.SetActive(false);

            var flashGo = new GameObject("Flash", typeof(RectTransform));
            flashGo.transform.SetParent(canvas.transform, false);
            var flashRect = (RectTransform)flashGo.transform;
            flashRect.anchorMin = Vector2.zero;
            flashRect.anchorMax = Vector2.one;
            flashRect.offsetMin = Vector2.zero;
            flashRect.offsetMax = Vector2.zero;
            _flashImage = flashGo.AddComponent<Image>();
            _flashImage.color = new Color(1f, 0.15f, 0.15f, 0f);
            _flashImage.raycastTarget = false;

            var titleText = EncounterUiKit.NewText(canvas.transform, $"🗡 {GoLocalization.T("foe.bandit", FoeName)}", new Vector2(0f, 1f), new Vector2(EncounterUiKit.DuelTitleX, EncounterUiKit.DuelTitleY), new Vector2(380f, 60f), 30);
            titleText.alignment = TextAlignmentOptions.Left;

            _timerText = EncounterUiKit.NewText(canvas.transform, string.Format(GoLocalization.T("combat.timer", "{0}초"), 60), new Vector2(0f, 1f), EncounterUiKit.DuelTimerPos, new Vector2(220f, 60f), 30);
            _timerText.alignment = TextAlignmentOptions.Right;

            _hpFill = EncounterUiKit.NewBarRow(canvas.transform, GoLocalization.T("combat.momentum", "기세"), EncounterUiKit.DuelRowY(0), out _);
            _moraleFill = EncounterUiKit.NewBarRow(canvas.transform, GoLocalization.T("combat.morale", "사기"), EncounterUiKit.DuelRowY(1), out _);
            _kiFill = EncounterUiKit.NewBarRow(canvas.transform, GoLocalization.T("combat.ki", "기(氣)"), EncounterUiKit.DuelRowY(2), out _);

            Saga.Core.ButtonWiring.Wire(EncounterUiKit.NewButton(canvas.transform, GoLocalization.T("combat.quick"), new Vector2(0f, 0f), EncounterUiKit.DuelQuickPos, new Vector2(220f, 110f), null), DoAct, "quick");
            _ultButton = EncounterUiKit.NewButton(canvas.transform, GoLocalization.T("combat.ult"), new Vector2(0.5f, 0f), new Vector2(0f, 130f), new Vector2(220f, 110f), null);
            Saga.Core.ButtonWiring.Wire(_ultButton, DoAct, "ult");
            Saga.Core.ButtonWiring.Wire(EncounterUiKit.NewButton(canvas.transform, GoLocalization.T("combat.dodge"), new Vector2(1f, 0f), new Vector2(-150f, 130f), new Vector2(220f, 110f), null), DoAct, "dodge");
            EncounterUiKit.NewButton(canvas.transform, GoLocalization.T("combat.retreat"), new Vector2(0.5f, 0f), new Vector2(0f, 30f), new Vector2(300f, 74f), FleeCombat);
        }

        private void StartFight()
        {
            _state = State.Fight;
            float foeHp = Mathf.Max(1f, Mathf.Round(FoePower * FoeHpMul));
            // PLAN.md 59~65장 — 부대(PartyState) + 내 레벨(PlayerStats) + 낀
            // 장비(Inventory) 세 축을 합쳐 실제 전투력을 만든다. 기초 능력치
            // 자체는 안 건드리고(101-2 ⑦ "기본치 불변" 규칙) 승급 특성 배율만
            // 여기서 곱한다.
            // PLAN.md 101-2 ⑥ "인연" — BondState.AtkMultiplier/DefMultiplier도
            // PerkState와 같은 결로 곱한다(등용된 인물이 없으면 1f, 무해).
            float atk = (PartyState.Atk + PlayerStats.AtkBonus + Inventory.AtkBonus) * PerkState.AtkMultiplier * BondState.AtkMultiplier * (1f + CycleState.Bonus) * (1f + EggState.BuddyBonus("atk")); // U-0046 동행 · U-0045 회차 공격 +5%
            float def = (PartyState.Def + PlayerStats.DefBonus + Inventory.DefBonus) * PerkState.DefMultiplier * BondState.DefMultiplier * (1f + EggState.BuddyBonus("def")); // U-0046 동행 방어
            _duel = DuelRules.Create(foeHp, atk, def);
            _duel.KiMul = PerkState.KiMultiplier;
            _combatRoot.SetActive(true);
            RefreshCombatUi();

            // hitstop용 — 전투 시작 시점에 한 번만 찾는다(타격마다 FindWithTag
            // 하지 않는다). 씬에 플레이어가 하나뿐이라 캐싱해도 안전하다.
            var playerGo = GameObject.FindWithTag("Player");
            _playerAnimator = playerGo != null ? playerGo.GetComponent<PlayerController>()?.Animator : null;
        }

        private void DoAct(string kind)
        {
            if (_duel == null) return;
            var r = _duel.Act(kind);
            if (r.Ok)
            {
                if (kind == "quick") PulseVisual(1.15f);
                else if (kind == "ult") PulseVisual(1.4f);
            }
            RefreshCombatUi();
            if (_duel.Over)
            {
                FinishFight();
            }
        }

        private void FleeCombat()
        {
            if (_duel != null)
            {
                _duel.Flee();
                FinishFight();
            }
        }

        private void OnDuelEvent(DuelRules.DuelEvent e)
        {
            switch (e.T)
            {
                case "tell":
                    Toast(GoLocalization.T("encounter.bandit_tell", "강타가 온다 — 피하라!"));
                    CharacterVisual.Tint(_visual.gameObject, TellColor);
                    break;
                case "heavy":
                    CharacterVisual.Tint(_visual.gameObject, _restTint);
                    ScreenFlash(e.Dodged ? new Color(0.2f, 1.0f, 0.4f, 0.35f) : new Color(1.0f, 0.15f, 0.15f, 0.45f));
                    if (!e.Dodged)
                    {
                        GoAudio.PlaySfx(hitClip);
                        ApplyHitstop(heavy: true);
                        GroundDecal.Spawn(transform.position, GroundDecal.Kind.HitMark); // PLAN.md 101-3 G "지형 반응".
                    }
                    break;
                case "hit":
                    ScreenFlash(new Color(1.0f, 0.15f, 0.15f, 0.3f));
                    GoAudio.PlaySfx(hitClip, 0.7f);
                    ApplyHitstop(heavy: false);
                    GroundDecal.Spawn(transform.position, GroundDecal.Kind.HitMark); // PLAN.md 101-3 G "지형 반응".
                    break;
            }
        }

        private void RefreshCombatUi()
        {
            if (_duel == null) return;
            _hpFill.fillAmount = Mathf.Clamp01(_duel.Hp / _duel.FoeHp);
            _moraleFill.fillAmount = Mathf.Clamp01(_duel.Morale / _duel.MoraleMax);
            _kiFill.fillAmount = Mathf.Clamp01(_duel.Ki / DuelRules.KiMax);
            _timerText.text = string.Format(GoLocalization.T("combat.timer", "{0}초"), Mathf.CeilToInt(Mathf.Max(0f, _duel.Left)));
            _ultButton.interactable = _duel.Ki >= DuelRules.KiMax;
        }

        private void FinishFight()
        {
            bool cleared = _duel.Cleared;
            float dealt = _duel.Dealt;
            _combatRoot.SetActive(false);
            _duel = null;

            if (cleared)
            {
                DailyTaskState.ReportProgress(DailyTaskState.Kind.BanditWin, 1);
                PartyState.Recruit(RecruitId);
                BondState.ReportWin(); // PLAN.md 101-2 ⑥ "인연" — 등용된 전원의 "함께 이긴 토벌" +1.

                // PLAN.md 66장 Reward — 등용 외에 경험치·장비 보상도 준다.
                // 레벨업 여러 번은 LeveledUp 이벤트로, 실제 문구는 아래서 한 번에 모은다.
                int levelBefore = PlayerStats.Level;
                PlayerStats.AddExp(ExpReward);
                GoldState.Add(VictoryGoldReward);
                string lootId = LootTable.RollBanditDrop();
                ItemData lootItem = null;
                bool lootEquipped = false;
                if (lootId != null)
                {
                    lootItem = ItemData.Get(lootId);
                    void OnGained(ItemData item, bool equipped)
                    {
                        if (item == lootItem) lootEquipped = equipped;
                    }
                    Inventory.ItemGained += OnGained;
                    Inventory.AddItem(lootId);
                    Inventory.ItemGained -= OnGained;
                }

                // PLAN.md 70~71장 Quest — 촌장에게 말을 걸어 받아 둔 퀘스트가
                // 있으면 여기서 완료 처리(활성 상태가 아니면 CompleteBanditQuest가
                // false를 돌려줘 조용히 건너뛴다 — 촌장을 안 만났어도 전투 자체는
                // 그대로 된다).
                bool questDone = QuestState.CompleteBanditQuest();
                if (questDone) PlayerStats.AddExp(QuestState.BanditRewardExp);

                var msg = string.Format(GoLocalization.T("encounter.victory_base", "{0}을 물리쳤다 — 부대에 합류했다! (전투력 {1})\n경험치 +{2} · 돈 +{3}냥"),
                    GoLocalization.T("foe.bandit", FoeName), Mathf.RoundToInt(PartyState.Atk + PartyState.Def), ExpReward, VictoryGoldReward);
                if (questDone) msg += string.Format(GoLocalization.T("encounter.quest_done_suffix", "\n퀘스트 완료 — 촌장이 사례하다 (경험치 +{0})"), QuestState.BanditRewardExp);
                if (PlayerStats.Level > levelBefore) msg += string.Format(GoLocalization.T("encounter.levelup_suffix", " — 레벨업! ({0} → {1})"), levelBefore, PlayerStats.Level);
                if (lootItem != null) msg += string.Format(GoLocalization.T(lootEquipped ? "encounter.loot_equipped" : "encounter.loot_plain",
                    lootEquipped ? "\n{0}을(를) 주웠다 — 바로 갖췄다." : "\n{0}을(를) 주웠다."), lootItem.Name);
                Toast(msg, VictoryToastSec);

                // PLAN.md 101-3 F "죽음"(2026-09-17) — 보상은 이미 위에서
                // 다 줬다, 이건 그 자리에 남는 시각적 표식뿐.
                LootMarker.Spawn(transform.position);

                // 물리친 도적은 사라진다 — 이번 슬라이스에서는 다시 나지 않는다.
                Destroy(gameObject);
                return;
            }

            if (dealt <= 0f)
            {
                // 한 대도 못 때리고 물러난 것은 패배로 안 친다(웹판 event.js와 같은 경계).
                Toast(GoLocalization.T("encounter.retreat_clean", "물러났다."));
            }
            else
            {
                // PLAN.md 101-2 ⑧ "패배 비용과 회수" — 진짜로 밀린 패배에서만 짐을 떨어뜨린다.
                string msg = GoLocalization.T("encounter.retreat_pushed", "밀렸다. 물러났다.");
                if (DropState.TryDrop(transform.position, out var drop))
                {
                    DropMarker.Spawn(drop);
                    msg += string.Format(GoLocalization.T("encounter.drop_lost",
                        "\n짐 {0}냥을 떨어뜨렸다 — 10분 안에 이 자리로 돌아오면 되찾을 수 있다."), drop.Gold);
                }
                Toast(msg);
            }
            EnterCooldown();
        }

        private void EnterCooldown()
        {
            _state = State.Cooldown;
            _cooldownLeft = RetryCooldownSec;
        }

        // ---- 연출 --------------------------------------------------------

        private void PulseVisual(float scaleTo)
        {
            if (_pulseRoutine != null) StopCoroutine(_pulseRoutine);
            _pulseRoutine = StartCoroutine(PulseRoutine(scaleTo));
        }

        private IEnumerator PulseRoutine(float scaleTo)
        {
            Transform visual = _visual != null ? _visual : transform.Find("Visual");
            if (visual == null) yield break;

            Vector3 baseScale = _visualBaseScale;
            Vector3 peakScale = baseScale * scaleTo;

            float t = 0f;
            const float up = 0.08f;
            while (t < up)
            {
                t += Time.deltaTime;
                visual.localScale = Vector3.Lerp(baseScale, peakScale, t / up);
                yield return null;
            }
            t = 0f;
            const float down = 0.16f;
            while (t < down)
            {
                t += Time.deltaTime;
                visual.localScale = Vector3.Lerp(peakScale, baseScale, t / down);
                yield return null;
            }
            visual.localScale = baseScale;
        }

        /// <summary>player·foe(둘 다 있으면) Animator를 짧게 멈춘다 — foe는
        /// `_visual`이 리깅 모델(Abe)일 때만 실제 Animator가 있고, 폴백
        /// 캡슐이면 null이라 조용히 건너뛴다(DUNGEON `PlayerCombat`과 같은
        /// null 허용 결).</summary>
        private void ApplyHitstop(bool heavy)
        {
            var foeAnimator = _visual != null ? _visual.GetComponent<Animator>() : null;
            StartCoroutine(HitstopRoutine(_playerAnimator, foeAnimator, heavy ? HeavyHitstopSec : HitstopSec));
        }

        private static IEnumerator HitstopRoutine(Animator a, Animator b, float seconds)
        {
            if (a != null) a.speed = 0f;
            if (b != null) b.speed = 0f;
            yield return new WaitForSeconds(seconds);
            if (a != null) a.speed = 1f;
            if (b != null) b.speed = 1f;
        }

        private void ScreenFlash(Color color)
        {
            if (_flashRoutine != null) StopCoroutine(_flashRoutine);
            _flashRoutine = StartCoroutine(FlashRoutine(color));
        }

        private IEnumerator FlashRoutine(Color color)
        {
            _flashImage.color = color;
            float from = color.a;
            const float duration = 0.35f;
            float t = 0f;
            while (t < duration)
            {
                t += Time.deltaTime;
                var c = _flashImage.color;
                c.a = Mathf.Lerp(from, 0f, t / duration);
                _flashImage.color = c;
                yield return null;
            }
        }

        private void Toast(string text, float seconds = ToastSec)
        {
            DialogueLabel.Instance?.Show(text, seconds);
        }
    }
}
