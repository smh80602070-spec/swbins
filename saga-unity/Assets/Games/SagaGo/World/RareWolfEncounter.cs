using TMPro;
using System.Collections;
using UnityEngine;
using UnityEngine.UI;
using Saga.Go.Data;
using Saga.Go.Player;
using Saga.Go.UI;
using Saga.Core;

namespace Saga.Go.World
{
    /// <summary>
    /// PLAN.md 51장 GO 월드 확장 — "희귀 몬스터". BanditEncounter.cs와
    /// 뼈대는 같지만(판정은 똑같이 Data/DuelRules.cs가 맡는다) 사람이
    /// 아니라 짐승이라 다른 점이 있다: "값을 치른다"가 없다(늑대한테
    /// 돈을 줄 수 없다) — 선택지가 "맞선다"/"피한다" 둘뿐이다. 등용
    /// 대상도 아니라 이겨도 부대(PartyState)엔 안 들어간다 — 대신
    /// 확정 보상(경험치·돈·전용 방어구)이 도적보다 후하다("희귀"가
    /// 실제로 특별해야 한다). UI 조립은 두 사건이 같이 쓰는
    /// UI/EncounterUiKit.cs로 만든다.
    ///
    /// PLAN.md 101-2 ③ "75초 토벌"(2026-09-19) — 웹판 §5 ③(raid.js, "몬스터헌터
    /// 나우" 참고)을 이 사건에 건다. 웹판이 "토벌에서만 켠다(create({raid:true}))
    /// — 야생 조우·성채 수비대는 옛 판정 그대로"로 이미 정리해 둔 스코프를
    /// 그대로 따른다: `BanditEncounter.cs`(웹판 "야생 조우"에 대응)는 옛 판정
    /// 그대로 두고, "희귀 몬스터를 일부러 찾아가 잡는다"는 이 사건이 이미
    /// 가장 "토벌"에 가까운 결이라(도장도 "희귀 늑대 토벌") 여기에 얹었다
    /// (`DuelRules.Create(..., raid: true)`). 부위 3(갑주·병장·기마)은 사람
    /// 산적 전용 이름이라 짐승엔 안 맞아 다리/몸통/급소로 재해석했다.
    /// </summary>
    [RequireComponent(typeof(SphereCollider))]
    public class RareWolfEncounter : MonoBehaviour
    {
        private const int Gx = 0;
        private const int Gy = 3;
        private const string FoeName = "흰 늑대";
        private const float FoePower = 160f; // 도적(120)보다 세게 — "희귀"가 더 어렵게 느껴지도록.
        private const float FoeHpMul = 7f;
        private const float AmbushRadius = 16f;
        private const float RetryCooldownSec = 8f;
        private const float ToastSec = 4f;
        private const float VictoryToastSec = 6f;
        private const int ExpReward = 150;
        private const int RewardGold = 50;
        private const string RewardItemId = "ar_wolf";
        private const string EventId = "rare_wolf";

        // PLAN.md 101-2 ③ "75초 토벌" — 부위 3 전부 파괴 보너스(웹판 "등용
        // 확률 ×1.5"는 이 사건이 등용 대상이 아니라 안 맞아, 즉시 지급되는
        // 다른 부위 보상들과 같은 결의 골드 보너스로 재해석).
        private const int FullBreakBonusGold = 20;
        private static readonly string[] PartKeys = { "part.leg", "part.torso", "part.core" };
        private static readonly string[] PartFallback = { "다리", "몸통", "급소" };

        // PLAN.md 101-3 C hitstop(2026-09-17) — `BanditEncounter.cs`와 완전히
        // 같은 값·로직. 늑대 쪽(`_visualMat`뿐, Animator 없는 primitive
        // capsule)은 애초에 못 멈춰 player 쪽만 실제로 걸린다.
        private const float HitstopSec = 0.07f;
        private const float HeavyHitstopSec = 0.12f;

        private static readonly Color BaseColor = new Color(0.78f, 0.78f, 0.8f);
        private static readonly Color TellColor = new Color(1.0f, 0.4f, 0.2f);

        private enum State { Idle, Prompt, Fight, Cooldown }

        private State _state = State.Idle;
        private DuelRules _duel;
        private float _cooldownLeft;
        private bool _playerInRange;

        private Material _visualMat;
        private Animator _playerAnimator;

        private GameObject _promptRoot;
        private GameObject _combatRoot;
        private Image _flashImage;
        private Image _hpFill;
        private Image _moraleFill;
        private Image _kiFill;
        private TextMeshProUGUI _timerText;
        private TextMeshProUGUI _partsText; // PLAN.md 101-2 ③ 부위 3 게이지(텍스트로 대신).
        private Button _ultButton;

        private Coroutine _flashRoutine;
        private Coroutine _pulseRoutine;
        private bool _fullBreakBonusGiven;

        private void Awake()
        {
            // 등용 대상이 아니라 PartyState.MemberIds엔 안 남는다 — 대신
            // WorldEventState(굴 보물·산신당과 같은 id 집합)로 처치 여부를
            // 기억한다.
            if (WorldEventState.IsTriggered(EventId))
            {
                Destroy(gameObject);
                return;
            }
            // 이미 저장된 씬을 실제 Play로 열면 Awake가 다시 불려 Build()를
            // 또 돌리는데, 편집기 빌드 스크립트가 이미 자식(시각·UI)을 만들어
            // 둔 뒤라 그대로 두면 두 벌씩 겹쳐 생긴다. NpcBuilder.cs 등은
            // "이미 있으면 건너뛴다"로 막지만, 이 클래스는 Update()가 쓰는
            // _promptRoot/_combatRoot/_hpFill 같은 필드를 Build() 안에서만
            // 채우므로 그냥 건너뛰면 이번 Play 세션 내내 그 필드들이 null로
            // 남아 늑대에게 다가가는 순간 NullReferenceException이 났을
            // 것이다(2026-09-12 발견 — BanditEncounter.cs도 같은 결함이 있어
            // 같이 고침). 대신 기존 자식을 전부 지우고 Build()를 다시 통째로
            // 돌려 모든 필드를 확실히 채운다. (UI 캔버스는 EncounterUiKit
            // .NewCanvas가 루트에 만들어 이 transform의 자식이 아니다 —
            // 이 loop로는 못 지우고 편집기 빌드 때 만든 옛 캔버스 두 개가
            // 비활성 상태로 씬에 고아처럼 남는다. 새로 만든 캔버스가 실제
            // 동작을 맡으니 기능은 정상이고, 남는 건 화면에 안 보이는
            // 미사용 GameObject 두 개뿐이라 이번엔 감수한다.)
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

            // 아직 GLB 전(PLAN.md 8장) — 짐승이라 사람(Player·NPC·도적)보다
            // 살짝 낮고 홀쭉한 비율로만 구분한다.
            var visual = GameObject.CreatePrimitive(PrimitiveType.Capsule);
            visual.name = "Visual";
            Object.DestroyImmediate(visual.GetComponent<Collider>());
            visual.transform.SetParent(transform, false);
            visual.transform.localScale = new Vector3(1.3f, 1.3f, 1.3f);
            visual.transform.localPosition = new Vector3(0f, 1.3f, 0f);

            _visualMat = new Material(Shader.Find("Universal Render Pipeline/Lit")) { name = "RareWolf (generated)" };
            _visualMat.color = BaseColor;
            visual.GetComponent<MeshRenderer>().sharedMaterial = _visualMat;
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
            var canvas = EncounterUiKit.NewCanvas("RareEncounterPrompt");
            _promptRoot = canvas.gameObject;
            _promptRoot.SetActive(false);

            var panel = EncounterUiKit.NewPanel(canvas.transform, new Vector2(0.5f, 0.5f), new Vector2(700f, 420f), new Color(0f, 0f, 0f, 0.72f));

            EncounterUiKit.NewText(panel.transform, GoLocalization.T("encounter.wolf_intro", "🐺 흰 늑대\n숲 그늘에서 눈빛 하나가 이쪽을 노려본다."),
                new Vector2(0.5f, 1f), new Vector2(0f, -28f), new Vector2(620f, 176f), 30); // 110 ⑤c-3: 글 상자가 첫 단추(-220)까지 내려와 겹쳤다

            EncounterUiKit.NewButton(panel.transform, GoLocalization.T("encounter.fight"), new Vector2(0.5f, 1f), new Vector2(0f, -220f), new Vector2(560f, 74f), ChooseFight);
            EncounterUiKit.NewButton(panel.transform, GoLocalization.T("encounter.avoid"), new Vector2(0.5f, 1f), new Vector2(0f, -304f), new Vector2(560f, 74f), ChooseAvoid);
        }

        private void ChooseFight()
        {
            _promptRoot.SetActive(false);
            StartFight();
        }

        private void ChooseAvoid()
        {
            _promptRoot.SetActive(false);
            Toast(GoLocalization.T("encounter.wolf_avoid_msg", "숨을 죽이고 조용히 발길을 돌렸다."));
            EnterCooldown();
        }

        // ---- 전투 화면 --------------------------------------------------------

        private void BuildCombatUi()
        {
            var canvas = EncounterUiKit.NewCanvas("RareCombatUI");
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

            var titleText = EncounterUiKit.NewText(canvas.transform, $"🐺 {GoLocalization.T("foe.rare_wolf", FoeName)}", new Vector2(0f, 1f), new Vector2(EncounterUiKit.DuelTitleX, EncounterUiKit.DuelTitleY), new Vector2(380f, 60f), 30);
            titleText.alignment = TextAlignmentOptions.Left;

            _timerText = EncounterUiKit.NewText(canvas.transform, string.Format(GoLocalization.T("combat.timer", "{0}초"), 60), new Vector2(0f, 1f), EncounterUiKit.DuelTimerPos, new Vector2(220f, 60f), 30);
            _timerText.alignment = TextAlignmentOptions.Right;

            _hpFill = EncounterUiKit.NewBarRow(canvas.transform, GoLocalization.T("combat.momentum", "기세"), EncounterUiKit.DuelRowY(0), out _);
            _moraleFill = EncounterUiKit.NewBarRow(canvas.transform, GoLocalization.T("combat.morale", "사기"), EncounterUiKit.DuelRowY(1), out _);
            _kiFill = EncounterUiKit.NewBarRow(canvas.transform, GoLocalization.T("combat.ki", "기(氣)"), EncounterUiKit.DuelRowY(2), out _);

            // PLAN.md 101-2 ③ "75초 토벌" 부위 3 게이지 — 새 UI 부품을 안
            // 만들고(EncounterUiKit엔 바 로우뿐) 기세 바로 아래 한 줄 텍스트로.
            _partsText = EncounterUiKit.NewText(canvas.transform, "", new Vector2(0f, 1f), new Vector2(150f, EncounterUiKit.DuelRowY(3)), new Vector2(500f, 40f), 22);
            _partsText.alignment = TextAlignmentOptions.Left;

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
            // PLAN.md 101-2 ⑦ "승급 3택"·⑥ "인연" — BanditEncounter.StartFight()와 같은 배율 적용.
            float atk = (PartyState.Atk + PlayerStats.AtkBonus + Inventory.AtkBonus) * PerkState.AtkMultiplier * BondState.AtkMultiplier * (1f + CycleState.Bonus) * (1f + EggState.BuddyBonus("atk")); // U-0045 회차 · U-0046 동행 공격
            float def = (PartyState.Def + PlayerStats.DefBonus + Inventory.DefBonus) * PerkState.DefMultiplier * BondState.DefMultiplier * (1f + EggState.BuddyBonus("def")); // U-0046 동행 방어
            // PLAN.md 101-2 ③ "75초 토벌" — 이 사건만 raid:true(75s·부위 3·저스트 회피).
            _duel = DuelRules.Create(foeHp, atk, def, raid: true);
            _duel.KiMul = PerkState.KiMultiplier;
            _fullBreakBonusGiven = false;
            _combatRoot.SetActive(true);
            RefreshCombatUi();

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
            if (_duel.PartsJustBroken > 0) OnPartsBroken(_duel.PartsJustBroken);
            RefreshCombatUi();
            if (_duel.Over)
            {
                FinishFight();
            }
        }

        /// <summary>PLAN.md 101-2 ③ — 부위 파괴 즉시 보상(재료 단사→돈) + 스태거
        /// 연출(강한 pulse + 추가 hitstop). 셋 다 깨지면 완파 보너스까지 한 메시지에
        /// 같이 묶는다(DialogueLabel이 단일 인스턴스라 Toast를 연달아 부르면
        /// 뒤엣것이 앞엣것을 지운다 — FinishFight()가 이미 그러듯 한 문자열로 모은다).</summary>
        private void OnPartsBroken(int count)
        {
            int gold = DuelRules.PartRewardGold * count;
            GoldState.Add(gold);
            PulseVisual(1.6f);
            ApplyHitstop(heavy: true);
            ScreenFlash(new Color(1.0f, 0.85f, 0.2f, 0.4f));

            var msg = string.Format(GoLocalization.T("encounter.part_broken", "부위 파괴! (재료 +{0}냥)"), gold);
            if (!_fullBreakBonusGiven && _duel.PartBroken[0] && _duel.PartBroken[1] && _duel.PartBroken[2])
            {
                _fullBreakBonusGiven = true;
                GoldState.Add(FullBreakBonusGold);
                msg += string.Format(GoLocalization.T("encounter.full_break_bonus", "\n부위 전파! 완파 보너스 +{0}냥"), FullBreakBonusGold);
            }
            Toast(msg, 1.6f);
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
                    Toast(GoLocalization.T("encounter.wolf_tell", "늑대가 몸을 낮춘다 — 덮치기 전에 피하라!"));
                    _visualMat.color = TellColor;
                    break;
                case "heavy":
                    _visualMat.color = BaseColor;
                    ScreenFlash(e.Dodged ? new Color(0.2f, 1.0f, 0.4f, 0.35f) : new Color(1.0f, 0.15f, 0.15f, 0.45f));
                    if (e.Dodged && _duel.Raid)
                    {
                        // PLAN.md 101-2 ③ "저스트 회피" — 완전 회피는 이 raid 사건에서만
                        // 가능(비raid 사건은 DodgeCut 15%만 깎여 e.Dmg>0). 화면 플래시는
                        // 위에서 이미 초록으로 반응했으니 짧은 "간발!" 팝만 더한다.
                        Toast(GoLocalization.T("combat.just_dodge", "간발!"), 1.2f);
                    }
                    if (!e.Dodged)
                    {
                        ApplyHitstop(heavy: true);
                        GroundDecal.Spawn(transform.position, GroundDecal.Kind.HitMark); // PLAN.md 101-3 G "지형 반응".
                    }
                    break;
                case "hit":
                    ScreenFlash(new Color(1.0f, 0.15f, 0.15f, 0.3f));
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

            // PLAN.md 101-2 ③ "75초 토벌" 부위 3 게이지 — 깨진 부위는 취소선 대신
            // 괄호로(Text엔 취소선이 없다) 표시.
            var sb = new System.Text.StringBuilder(GoLocalization.T("combat.parts", "부위 "));
            for (int i = 0; i < DuelRules.PartCount; i++)
            {
                if (i > 0) sb.Append(' ');
                string name = GoLocalization.T(PartKeys[i], PartFallback[i]);
                sb.Append(_duel.PartBroken[i] ? $"({name})" : name);
            }
            _partsText.text = sb.ToString();
        }

        private void FinishFight()
        {
            bool cleared = _duel.Cleared;
            float dealt = _duel.Dealt;
            _combatRoot.SetActive(false);
            _duel = null;

            if (cleared)
            {
                WorldEventState.TryTrigger(EventId);
                DailyTaskState.ReportProgress(DailyTaskState.Kind.WolfWin, 1);
                BondState.ReportWin(); // PLAN.md 101-2 ⑥ "인연" — 늑대 자신은 등용 대상이 아니지만, 이미 등용된 인물의 "함께 이긴 토벌"은 오른다.

                int levelBefore = PlayerStats.Level;
                PlayerStats.AddExp(ExpReward);
                GoldState.Add(RewardGold);
                Inventory.AddItem(RewardItemId);
                var item = ItemData.Get(RewardItemId);

                var msg = string.Format(GoLocalization.T("encounter.wolf_victory", "{0}을 물리쳤다 — 희귀 몬스터 토벌!\n경험치 +{1} · 돈 +{2}냥"),
                    GoLocalization.T("foe.rare_wolf", FoeName), ExpReward, RewardGold);
                if (PlayerStats.Level > levelBefore) msg += string.Format(GoLocalization.T("encounter.levelup_suffix", " — 레벨업! ({0} → {1})"), levelBefore, PlayerStats.Level);
                if (item != null) msg += string.Format(GoLocalization.T("encounter.loot_certain", "\n{0}을(를) 확실히 얻었다."), item.Name);
                Toast(msg, VictoryToastSec);

                // PLAN.md 101-3 F "죽음"(2026-09-17) — 보상은 이미 위에서
                // 다 줬다, 이건 그 자리에 남는 시각적 표식뿐.
                LootMarker.Spawn(transform.position);

                // 희귀 몬스터는 이번 슬라이스에서 한 번만 나고 다시 안 난다
                // (도적과 같은 결, RareWolfState가 재등장을 막는다).
                Destroy(gameObject);
                return;
            }

            if (dealt <= 0f)
            {
                Toast(GoLocalization.T("encounter.retreat_clean", "물러났다."));
            }
            else
            {
                // PLAN.md 101-2 ⑧ "패배 비용과 회수" — BanditEncounter.FinishFight()와 같은 로직.
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
            Transform visual = transform.Find("Visual");
            if (visual == null) yield break;

            Vector3 baseScale = new Vector3(1.3f, 1.3f, 1.3f);
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

        /// <summary>`BanditEncounter.ApplyHitstop()`과 같은 로직 — 늑대 쪽은
        /// Animator가 없어(위 클래스 주석) 항상 player만 실제로 멎는다.</summary>
        private void ApplyHitstop(bool heavy)
        {
            StartCoroutine(HitstopRoutine(_playerAnimator, heavy ? HeavyHitstopSec : HitstopSec));
        }

        private static IEnumerator HitstopRoutine(Animator a, float seconds)
        {
            if (a != null) a.speed = 0f;
            yield return new WaitForSeconds(seconds);
            if (a != null) a.speed = 1f;
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
