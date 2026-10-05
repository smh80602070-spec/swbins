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
    /// PLAN.md 101-2 GO ② "사당 시련" — 웹판 §5②(3분 방·파도 3·하루 3회)를
    /// 이 트랙에 맞춰 좁힌 재해석(설계 경위는 docs/HISTORY.md 2026-09-20
    /// "GO② 사당 시련 설계 뒤 중단" 절). 뼈대는 BanditEncounter.cs·
    /// RareWolfEncounter.cs와 같다(EncounterUiKit 조립, hitstop·화면
    /// 플래시, PulseVisual) — 다른 점은 Update()가 파도 3을 하나의 공유
    /// 타이머(180초)로 이어 붙인다는 것뿐: 파도가 끝나도 클리어면
    /// <see cref="DuelRules.Left"/>(남은 시간)를 다음 파도의 timeSec로
    /// 그대로 넘겨 새 DuelRules를 만든다. 짐승형 새 시각 자산은 없어(웹판
    /// wolfpack→bandit→scout 재해석) RareWolfEncounter처럼 primitive
    /// 캡슐만 쓰되 사당의 사이한 기운을 나타내려 보라색 계열로 파도마다
    /// 진하게 갈아입힌다. 등용 대상이 아니고(도적과 달리 부대에 안
    /// 남는다) 한 번뿐인 자리도 아니다(LuckyCairn처럼 몇 번이고 다시 올 수
    /// 있음 — 하루 3회·10분 재입장 잠금은 ShrineTrialState.cs가 잰다).
    /// </summary>
    [RequireComponent(typeof(SphereCollider))]
    public class ShrineTrialEncounter : MonoBehaviour
    {
        private const int Gx = 4;
        private const int Gy = 1;
        private const float AmbushRadius = 8f;
        private const float RetryCooldownSec = 8f;
        private const float ToastSec = 4f;
        private const float VictoryToastSec = 6f;

        // PLAN.md 101-2 GO ② — 웹판 "wolfpack 90 → bandit 120 → scout 170"
        // 순서를 파도 난이도로 그대로 옮긴다. 마지막 파도가 "미니보스"
        // 역할을 겸한다(웹판의 별도 미니보스를 4번째 전투 추가 없이 좁힘).
        private static readonly string[] FoeNameKeys = { "foe.shrine_pack", "foe.shrine_raiders", "foe.shrine_scout" };
        private static readonly string[] FoeNameFallback = { "사당을 지키는 들개떼", "사당을 노리는 도적 무리", "사당의 척후병" };
        private static readonly float[] FoePower = { 90f, 120f, 170f };
        private const float FoeHpMul = 7f; // 기존 두 사건과 같은 배율.
        private const float SharedTimeSec = 180f; // 웹판 "3분 방" 그대로.

        private const int ClearExpReward = 120;
        private const int ClearGoldReward = 70;
        private const int StampBonusExp = 100;
        private const int StampBonusGold = 80;
        private const int FailGoldCost = 10;

        // PLAN.md 101-3 C hitstop — BanditEncounter.cs·RareWolfEncounter.cs와 같은 값.
        private const float HitstopSec = 0.07f;
        private const float HeavyHitstopSec = 0.12f;

        private static readonly Color[] WaveColors =
        {
            new Color(0.42f, 0.22f, 0.55f),
            new Color(0.32f, 0.14f, 0.48f),
            new Color(0.22f, 0.08f, 0.4f),
        };
        private static readonly Color TellColor = new Color(1.0f, 0.55f, 0.1f);

        private enum State { Idle, Prompt, Fight, Cooldown }

        private State _state = State.Idle;
        private DuelRules _duel;
        private int _waveIndex;
        private float _totalDealt;
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
        private TextMeshProUGUI _titleText;
        private TextMeshProUGUI _timerText;
        private Button _ultButton;

        private Coroutine _flashRoutine;
        private Coroutine _pulseRoutine;

        private void Awake()
        {
            // LuckyCairn.cs와 같은 결 — 도적·희귀 늑대와 달리 한 번뿐인 자리가
            // 아니라(며칠이고 다시 도전할 수 있음) WorldEventState 확인이
            // 없다. 이미 저장된 씬을 실제 Play로 열면 Awake가 다시 불려
            // Build()를 또 돌릴 텐데, 편집기 빌드 스크립트가 이미 자식을
            // 만들어 둔 뒤라 그대로 두면 두 벌씩 겹쳐 생긴다(BanditEncounter.cs·
            // RareWolfEncounter.cs가 2026-09-12 겪은 것과 같은 함정) — 자식을
            // 전부 지우고 Build()를 다시 통째로 돌려 모든 필드를 확실히 채운다.
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
                            OnWaveOver();
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

            // 사당 입구를 나타내는 작은 돌 아치(기둥 둘 + 상인방) — 전투
            // 중이 아니어도 항상 보여 플레이어가 문 자리를 알 수 있게 한다.
            var archMat = new Material(Shader.Find("Universal Render Pipeline/Lit")) { name = "ShrineArch (generated)" };
            archMat.color = new Color(0.35f, 0.32f, 0.3f);
            AddBox("Pillar_L", new Vector3(-1.4f, 1.1f, 0f), new Vector3(0.6f, 2.2f, 0.6f), archMat);
            AddBox("Pillar_R", new Vector3(1.4f, 1.1f, 0f), new Vector3(0.6f, 2.2f, 0.6f), archMat);
            AddBox("Lintel", new Vector3(0f, 2.3f, 0f), new Vector3(3.4f, 0.5f, 0.6f), archMat);

            // 파도 적 시각 — 짐승형 새 자산 없이 RareWolfEncounter처럼
            // primitive 캡슐만(보라색 계열, 전투 중에만 보인다).
            var visual = GameObject.CreatePrimitive(PrimitiveType.Capsule);
            visual.name = "Visual";
            Object.DestroyImmediate(visual.GetComponent<Collider>());
            visual.transform.SetParent(transform, false);
            visual.transform.localScale = new Vector3(1.2f, 1.2f, 1.2f);
            visual.transform.localPosition = new Vector3(0f, 1.2f, 1.5f);
            visual.SetActive(false);

            _visualMat = new Material(Shader.Find("Universal Render Pipeline/Lit")) { name = "ShrineFoe (generated)" };
            _visualMat.color = WaveColors[0];
            visual.GetComponent<MeshRenderer>().sharedMaterial = _visualMat;
        }

        private void AddBox(string name, Vector3 localPos, Vector3 size, Material mat)
        {
            var box = GameObject.CreatePrimitive(PrimitiveType.Cube);
            box.name = name;
            Object.DestroyImmediate(box.GetComponent<Collider>());
            box.transform.SetParent(transform, false);
            box.transform.localPosition = localPos;
            box.transform.localScale = size;
            box.GetComponent<MeshRenderer>().sharedMaterial = mat;
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
            var canvas = EncounterUiKit.NewCanvas("ShrineTrialPrompt");
            _promptRoot = canvas.gameObject;
            _promptRoot.SetActive(false);

            var panel = EncounterUiKit.NewPanel(canvas.transform, new Vector2(0.5f, 0.5f), new Vector2(700f, 420f), new Color(0f, 0f, 0f, 0.72f));

            EncounterUiKit.NewText(panel.transform, GoLocalization.T("encounter.shrine_intro", "⛩ 옛 사당의 시련\n문 너머로 서늘한 기운이 새어 나온다 — 파도 셋을 버텨야 한다."),
                new Vector2(0.5f, 1f), new Vector2(0f, -28f), new Vector2(620f, 176f), 30); // 110 ⑤c-3: 글 상자가 첫 단추(-220)까지 내려와 겹쳤다

            EncounterUiKit.NewButton(panel.transform, GoLocalization.T("encounter.fight"), new Vector2(0.5f, 1f), new Vector2(0f, -220f), new Vector2(560f, 74f), ChooseFight);
            EncounterUiKit.NewButton(panel.transform, GoLocalization.T("encounter.avoid"), new Vector2(0.5f, 1f), new Vector2(0f, -304f), new Vector2(560f, 74f), ChooseAvoid);
        }

        private void ChooseFight()
        {
            _promptRoot.SetActive(false);
            if (!ShrineTrialState.CanEnter())
            {
                string msg = ShrineTrialState.IsLocked
                    ? GoLocalization.T("encounter.shrine_locked", "사당 문이 아직 굳게 닫혀 있다 — 잠시 뒤 다시 오라.")
                    : GoLocalization.T("encounter.shrine_daily_full", "오늘은 이미 사당 시련에 세 번 도전했다 — 내일 다시 오라.");
                Toast(msg);
                EnterCooldown();
                return;
            }
            StartTrial();
        }

        private void ChooseAvoid()
        {
            _promptRoot.SetActive(false);
            Toast(GoLocalization.T("encounter.shrine_avoid_msg", "서늘한 기운을 뒤로하고 발길을 돌렸다."));
            EnterCooldown();
        }

        // ---- 전투 화면 --------------------------------------------------------

        private void BuildCombatUi()
        {
            var canvas = EncounterUiKit.NewCanvas("ShrineCombatUI");
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

            _titleText = EncounterUiKit.NewText(canvas.transform, "⛩", new Vector2(0f, 1f), new Vector2(EncounterUiKit.DuelTitleX, EncounterUiKit.DuelTitleY), new Vector2(400f, 60f), 28);
            _titleText.alignment = TextAlignmentOptions.Left;

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

        private void StartTrial()
        {
            ShrineTrialState.ReportEntry();
            _waveIndex = 0;
            _totalDealt = 0f;
            StartWave(SharedTimeSec);
        }

        private void StartWave(float timeSecCarryover)
        {
            _state = State.Fight;
            float foeHp = Mathf.Max(1f, Mathf.Round(FoePower[_waveIndex] * FoeHpMul));
            // PLAN.md 101-2 ⑦ "승급 3택"·⑥ "인연" — 기존 두 사건과 같은 배율 체인.
            float atk = (PartyState.Atk + PlayerStats.AtkBonus + Inventory.AtkBonus) * PerkState.AtkMultiplier * BondState.AtkMultiplier * (1f + CycleState.Bonus) * (1f + EggState.BuddyBonus("atk")); // U-0045 회차 · U-0046 동행 공격
            float def = (PartyState.Def + PlayerStats.DefBonus + Inventory.DefBonus) * PerkState.DefMultiplier * BondState.DefMultiplier * (1f + EggState.BuddyBonus("def")); // U-0046 동행 방어
            _duel = DuelRules.Create(foeHp, atk, def, timeSec: timeSecCarryover);
            _duel.KiMul = PerkState.KiMultiplier;
            _combatRoot.SetActive(true);
            transform.Find("Visual").gameObject.SetActive(true);
            _visualMat.color = WaveColors[_waveIndex];
            _titleText.text = $"⛩ {GoLocalization.T(FoeNameKeys[_waveIndex], FoeNameFallback[_waveIndex])} ({_waveIndex + 1}/{FoePower.Length})";
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
            RefreshCombatUi();
            if (_duel.Over)
            {
                OnWaveOver();
            }
        }

        private void FleeCombat()
        {
            if (_duel != null)
            {
                _duel.Flee();
                OnWaveOver();
            }
        }

        private void OnDuelEvent(DuelRules.DuelEvent e)
        {
            switch (e.T)
            {
                case "tell":
                    Toast(GoLocalization.T("encounter.shrine_tell", "강타가 온다 — 피하라!"));
                    _visualMat.color = TellColor;
                    break;
                case "heavy":
                    _visualMat.color = WaveColors[_waveIndex];
                    ScreenFlash(e.Dodged ? new Color(0.2f, 1.0f, 0.4f, 0.35f) : new Color(1.0f, 0.15f, 0.15f, 0.45f));
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
        }

        /// <summary>파도 하나가 끝났다 — 클리어면(파도가 남았으면) 남은 시간을
        /// 그대로 이어받아 다음 파도로, 아니면(마지막 파도 클리어이거나 애초에
        /// 못 깼으면) 시련 전체를 끝낸다. BanditEncounter.FinishFight()·
        /// RareWolfEncounter.FinishFight()와 이 클래스가 유일하게 갈라지는 지점.</summary>
        private void OnWaveOver()
        {
            bool cleared = _duel.Cleared;
            bool fled = _duel.Fled;
            float left = _duel.Left;
            _totalDealt += _duel.Dealt;

            if (cleared && _waveIndex < FoePower.Length - 1)
            {
                string beaten = GoLocalization.T(FoeNameKeys[_waveIndex], FoeNameFallback[_waveIndex]);
                _waveIndex++;
                StartWave(left);
                Toast(string.Format(GoLocalization.T("encounter.shrine_wave_clear", "{0} 격파! 다음 파도가 밀려온다."), beaten), 2f);
                return;
            }

            FinishTrial(cleared, fled);
        }

        private void FinishTrial(bool cleared, bool fled)
        {
            _combatRoot.SetActive(false);
            transform.Find("Visual").gameObject.SetActive(false);
            _duel = null;

            if (cleared)
            {
                bool stampEarned = ShrineTrialState.ReportClear();

                int levelBefore = PlayerStats.Level;
                PlayerStats.AddExp(ClearExpReward);
                GoldState.Add(ClearGoldReward);

                var msg = string.Format(GoLocalization.T("encounter.shrine_clear", "사당 시련을 돌파했다 — 인장 조각을 얻었다!\n경험치 +{0} · 돈 +{1}냥"), ClearExpReward, ClearGoldReward);
                if (stampEarned)
                {
                    PlayerStats.AddExp(StampBonusExp);
                    GoldState.Add(StampBonusGold);
                    msg += string.Format(GoLocalization.T("encounter.shrine_stamp", "\n인장 완성! (통산 {0}개) — 이정표 보상 경험치 +{1} · 돈 +{2}냥"), ShrineTrialState.Stamps, StampBonusExp, StampBonusGold);
                }
                if (PlayerStats.Level > levelBefore) msg += string.Format(GoLocalization.T("encounter.levelup_suffix", " — 레벨업! ({0} → {1})"), levelBefore, PlayerStats.Level);
                Toast(msg, VictoryToastSec);

                // PLAN.md 101-3 F "죽음" — 기존 두 사건과 같은 시각적 표식.
                LootMarker.Spawn(transform.position);
            }
            else if (_totalDealt <= 0f)
            {
                // 한 대도 못 때리고 물러난 것은 실패로 안 친다(기존 두 사건과 같은 경계).
                Toast(GoLocalization.T("encounter.retreat_clean", "물러났다."));
            }
            else
            {
                string msg = GoLocalization.T("encounter.shrine_fail", "시련에 밀렸다 — 문이 다시 닫힌다.");
                if (GoldState.TrySpend(FailGoldCost))
                {
                    msg += string.Format(GoLocalization.T("encounter.shrine_fail_cost", "\n노잣돈 {0}냥을 잃었다."), FailGoldCost);
                }
                ShrineTrialState.ReportFailLock();
                msg += string.Format(GoLocalization.T("encounter.shrine_lock", "\n{0}분 동안 다시 들어갈 수 없다."), Mathf.RoundToInt((float)(ShrineTrialState.LockWindowSec / 60.0)));
                Toast(msg);
            }

            _waveIndex = 0;
            _totalDealt = 0f;
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

            Vector3 baseScale = new Vector3(1.2f, 1.2f, 1.2f);
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

        /// <summary>BanditEncounter.ApplyHitstop()과 같은 로직 — 이 사건 쪽도
        /// primitive 캡슐이라 Animator가 없어 player만 실제로 멎는다.</summary>
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
