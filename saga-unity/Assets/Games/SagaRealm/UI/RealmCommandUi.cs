using TMPro;
using System.Collections.Generic;
using UnityEngine;
using UnityEngine.UI;
using Saga.Realm.Data;
using Saga.Realm.Audio;

namespace Saga.Realm.UI
{
    /// <summary>
    /// VERTICAL_SLICE_REALM.md 1·2-3·2-4·3절 — "명령"(10종, 두 열)·"성"
    /// (조망·명령 대상 전환)·"공격"(적국 공략, 51장부터 소패·정도 둘)·
    /// "다음 달" 버튼. SagaGo
    /// `World/BanditEncounter.cs`처럼 자기 UI를 스스로 짓는 컴포넌트.
    ///
    /// 2026-09-14 "사운드" — 명령/문답/공격/계략 네 판정 결과에 confirm/
    /// error 두 클립을 재생한다(`RealmAudio.cs` 클래스 주석 참고). 클립은
    /// `BuildTestCityScene.cs`가 `SetPrivateField`로 채운다 — 비어 있으면
    /// (헤드리스 유닛 테스트 등) `RealmAudio.PlaySfx`가 조용히 넘어간다.
    /// </summary>
    public class RealmCommandUi : MonoBehaviour
    {
        [SerializeField] private AudioClip confirmClip;
        [SerializeField] private AudioClip errorClip;

        // 2026-09-15 발견 — 아래 참조 필드들은 전부 [SerializeField] 없이
        // Build()(BuildTestCityScene.cs가 에디터에서 딱 한 번 부른다,
        // Awake()가 따로 없다)에서만 채워지고 있었다. Unity는 [SerializeField]
        // 없는 private 필드를 직렬화하지 않아서, 씬을 저장·재로드한 뒤(=
        // 실제 플레이 환경) 전부 null로 돌아온다 — 진단으로 직접 확인함
        // (PlaytestRealmSlice.cs 리플렉션 덤프). 그런데도 그동안 아무 테스트도
        // 이걸 못 잡았다: PlaytestRealmSlice.CheckSettingsPanel()은
        // GameObject.Find("Btn_설정")로 버튼이 "존재하는지"만 보고
        // ToggleSettingsPanel() 같은 RealmCommandUi 자신의 메서드는 한 번도
        // 안 불렀다 — 즉 실제 플레이에서 "설정" 버튼을 누르면
        // NullReferenceException으로 바로 죽는 상태였다(패널 아홉 개 전부
        // 같은 문제). DUNGEON/STORY LocalizedButtonLabel과 같은 함정 —
        // [SerializeField]로 승격해 Build()가 만든 참조가 씬에 실제로
        // 저장되게 한다.
        [SerializeField] private GameObject _orderPanel;
        [SerializeField] private GameObject _cityPanel;
        [SerializeField] private GameObject _plotPanel;
        [SerializeField] private GameObject _quizPanel;
        [SerializeField] private GameObject _archivePanel;
        [SerializeField] private GameObject _settingsPanel;
        // PLAN.md 51장 16차 확장(2026-09-18) "성 하나당 목표 하나" 제약을
        // 풀면서 신설 — 목표가 둘 이상인 성에서 공격 버튼을 누르면 이
        // 패널이 먼저 뜬다(하나뿐이면 옛날처럼 바로 공격, ExecuteAttack()
        // 참고). 위 [SerializeField] 승격 사고(2026-09-15) 재발을 막으려고
        // 처음부터 [SerializeField]로 선언한다.
        [SerializeField] private GameObject _attackPanel;
        [SerializeField] private Transform _cityButtonsRoot;
        [SerializeField] private Transform _plotButtonsRoot;
        [SerializeField] private Transform _quizButtonsRoot;
        [SerializeField] private Transform _archiveButtonsRoot;
        [SerializeField] private Transform _attackButtonsRoot;
        // PLAN.md 101-2 5-3 "일기토·설전"(2026-09-20) — 둘 다 강제 진행형
        // 모달(취소 버튼 없음, 3라운드를 다 골라야 닫힌다)이라 위
        // [SerializeField] 승격 사고(2026-09-15) 재발을 막으려고 처음부터
        // [SerializeField]로 선언한다.
        [SerializeField] private GameObject _duelPanel;
        [SerializeField] private TextMeshProUGUI _duelRoundText;
        [SerializeField] private GameObject _debatePanel;
        [SerializeField] private Transform _debateButtonsRoot;
        [SerializeField] private TextMeshProUGUI _debateQuestionText;
        [SerializeField] private TextMeshProUGUI _debateProgressText;
        // 101-2 5-2 "관계·이벤트 체인"(2026-09-20) — 월간 서사 카드. 다른
        // 패널과 달리 사용자가 여닫는 게 아니라 RealmEventState.Presented가
        // 뜰 때 스스로 열린다(OnEventPresented). CloseAllPanels()가 안
        // 건드리는 유일한 패널 — 답하기 전엔 다른 패널을 열고 닫아도 그대로
        // 남아 있어야 카드가 사라지지 않는다(Build()에서 맨 마지막에 지어
        // 항상 다른 패널 위에 그려진다).
        [SerializeField] private GameObject _eventPanel;
        [SerializeField] private TextMeshProUGUI _eventTitleText;
        [SerializeField] private TextMeshProUGUI _eventBodyText;
        [SerializeField] private Transform _eventButtonsRoot;
        [SerializeField] private TextMeshProUGUI _quizQuestionText;
        [SerializeField] private TextMeshProUGUI _quizProgressText;
        [SerializeField] private TextMeshProUGUI _settingsToggleLabel;
        [SerializeField] private TextMeshProUGUI _settingsTitleLabel;
        [SerializeField] private TextMeshProUGUI _settingsCloseLabel;
        [SerializeField] private TextMeshProUGUI _settingsSfxNameLabel;
        [SerializeField] private TextMeshProUGUI _settingsSfxLabel;
        [SerializeField] private TextMeshProUGUI _settingsVibrationNameLabel;
        [SerializeField] private TextMeshProUGUI _settingsVibrationLabel;
        [SerializeField] private TextMeshProUGUI _settingsUiScaleNameLabel;
        [SerializeField] private TextMeshProUGUI _settingsUiScaleLabel;
        [SerializeField] private TextMeshProUGUI _settingsQualityNameLabel;
        [SerializeField] private TextMeshProUGUI _settingsQualityLabel;
        [SerializeField] private TextMeshProUGUI _settingsLanguageNameLabel;
        [SerializeField] private TextMeshProUGUI _settingsLanguageLabel;
        [SerializeField] private TextMeshProUGUI _settingsBgmNameLabel;
        [SerializeField] private TextMeshProUGUI _settingsBgmLabel;
        [SerializeField] private TextMeshProUGUI _settingsSuccessionNameLabel;
        [SerializeField] private TextMeshProUGUI _settingsSuccessionLabel;
        private RealmQuizState.Presented? _currentQuiz; // 런타임 전용 상태 — 저장할 이유 없음, 그대로 둔다.

        // 2026-09-15 — 위 [SerializeField] 승격과 같은 세션, 별개 버그.
        // 이 여덟 라벨(+설정 자기 자신은 이미 _settingsToggleLabel로 있었다)은
        // 지금까지 아예 참조를 저장하지 않아 ChooseLanguage() 후
        // RefreshSettingsPanel()이 불려도 못 바꿨다 — "설정" 버튼 자신만
        // 언어가 바뀌고 나머지 여덟은 그대로 굳어 있던 것.
        [SerializeField] private TextMeshProUGUI _ordersLabel;
        [SerializeField] private TextMeshProUGUI _cityToggleLabel;
        [SerializeField] private TextMeshProUGUI _plotToggleLabel;
        [SerializeField] private TextMeshProUGUI _attackLabel;
        [SerializeField] private TextMeshProUGUI _nextMonthLabel;
        [SerializeField] private TextMeshProUGUI _quizToggleLabel;
        [SerializeField] private TextMeshProUGUI _mapLabel;
        [SerializeField] private TextMeshProUGUI _archiveToggleLabel;
        [SerializeField] private TextMeshProUGUI _saveLabel;
        [SerializeField] private TextMeshProUGUI _tacticToggleLabel;
        [SerializeField] private TextMeshProUGUI _duelToggleLabel;

        // PLAN.md 101-2 5-6 "지형·진형 전술 개입"(2026-09-20) — 다음 공격에
        // 전술을 쓸지 말지 켜 두는 토글. 값 자체는 위 GameObject 참조들과
        // 달리 씬 저장·재로드로 잃을 게 없는 순수 런타임 상태라
        // [SerializeField] 없이 둔다(기본 false로 시작해도 무방).
        private bool _tacticEnabled;

        // PLAN.md 101-2 5-3 "일기토"(2026-09-20) — 전술 토글과 같은 결의
        // 런타임 전용 상태. _pendingAttackEnemyId는 일기토가 끝날 때까지
        // 어느 적을 칠지 들고 있는 자리(null이면 TargetFrom()이 스스로
        // 고른다 — ExecuteAttack()의 옛 동작과 같다).
        private bool _duelEnabled;
        private string _pendingAttackEnemyId;
        private bool _pendingAttackHasEnemyId;
        private readonly List<string> _duelResults = new List<string>();
        private int _duelRoundIndex;

        // PLAN.md 101-2 5-3 "설전" — 등용에만 거는 3문 카드 진행 상태.
        private List<RealmQuizState.Presented> _debateQuestions;
        private List<int> _debateAnswers;

        private void Awake()
        {
            RealmEventState.Presented += OnEventPresented;
            RealmSuccessionState.Occurred += OnSuccessionOccurred;
        }

        private void OnDestroy()
        {
            RealmEventState.Presented -= OnEventPresented;
            RealmSuccessionState.Occurred -= OnSuccessionOccurred;
        }

        /// <summary>101-2 5-8 — 카드 없이 바로 토스트(플레이어가 응답할
        /// 선택지가 없는, 자동으로 벌어지는 일이라 이벤트 카드와 다른 결).</summary>
        private void OnSuccessionOccurred(string message)
        {
            RealmToast.Instance?.Show(message, 7f);
        }

        public void Build()
        {
            var canvas = RealmUiKit.NewCanvas("RealmCommandUI");
            canvas.transform.SetParent(transform, false);

            // 다섯 버튼(명령/성/계략/공격/다음달) — 외교(계략) 추가로
            // 넷에서 다섯으로 늘며 간격만 좁혔다(폭 190→180, 간격 270→210).
            var ordersButton = RealmUiKit.NewButton(canvas.transform, RealmLocalization.T("command.orders"), new Vector2(0.5f, 0f), new Vector2(-420f, 100f),
                new Vector2(180f, 110f), ToggleOrderPanel);
            _ordersLabel = ordersButton.GetComponentInChildren<TextMeshProUGUI>();
            var cityButton = RealmUiKit.NewButton(canvas.transform, RealmLocalization.T("command.city"), new Vector2(0.5f, 0f), new Vector2(-210f, 100f),
                new Vector2(180f, 110f), ToggleCityPanel);
            _cityToggleLabel = cityButton.GetComponentInChildren<TextMeshProUGUI>();
            var plotButton = RealmUiKit.NewButton(canvas.transform, RealmLocalization.T("command.plot"), new Vector2(0.5f, 0f), new Vector2(0f, 100f),
                new Vector2(180f, 110f), TogglePlotPanel);
            _plotToggleLabel = plotButton.GetComponentInChildren<TextMeshProUGUI>();
            var attackButton = RealmUiKit.NewButton(canvas.transform, RealmLocalization.T("command.attack"), new Vector2(0.5f, 0f), new Vector2(210f, 100f),
                new Vector2(180f, 110f), ExecuteAttack);
            _attackLabel = attackButton.GetComponentInChildren<TextMeshProUGUI>();
            var nextMonthButton = RealmUiKit.NewButton(canvas.transform, RealmLocalization.T("command.next_month"), new Vector2(0.5f, 0f), new Vector2(420f, 100f),
                new Vector2(180f, 110f), ExecuteNextMonth);
            _nextMonthLabel = nextMonthButton.GetComponentInChildren<TextMeshProUGUI>();

            // 문답(REALM 다음 조각 (3))은 명령/전쟁과 달리 턴·성·무장과
            // 무관한 개인 미니게임이라 아래 다섯 버튼 행에 안 끼우고
            // 화면 오른쪽 위 구석에 따로 뒀다(HUD가 왼쪽 위를 쓰니 안 겹침).
            var quizToggleButton = RealmUiKit.NewButton(canvas.transform, RealmLocalization.T("command.quiz"), new Vector2(1f, 1f), new Vector2(-110f, -132f), new Vector2(180f, 104f), ToggleQuizPanel);
            _quizToggleLabel = quizToggleButton.GetComponentInChildren<TextMeshProUGUI>();

            // 월드맵(2-8절) — 문답과 같은 구석, 그 바로 아래에 둔다(명령/성/
            // 계략/공격/다음달 행과도, HUD 라벨과도 안 겹치는 유일한 빈 자리).
            var mapButton = RealmUiKit.NewButton(canvas.transform, RealmLocalization.T("command.map"), new Vector2(1f, 1f), new Vector2(-110f, -244f), new Vector2(180f, 104f), ToggleMap);
            _mapLabel = mapButton.GetComponentInChildren<TextMeshProUGUI>();

            // 서고(godot REALM 10절) — 문답보다도 위 구석(같은 결로 명령
            // 계열과 안 겹치는 유일한 빈 자리).
            var archiveToggleButton = RealmUiKit.NewButton(canvas.transform, RealmLocalization.T("command.archive"), new Vector2(1f, 1f), new Vector2(-110f, -20f), new Vector2(180f, 104f), ToggleArchivePanel);
            _archiveToggleLabel = archiveToggleButton.GetComponentInChildren<TextMeshProUGUI>();

            // 설정(PLAN.md 67~69장 "접근성") — 문답/지도/서고와 같은 구석
            // 기둥을 한 칸 더 내려 잇는다(지도 -210 바로 아래, 10px 틈).
            // 디버그 오버레이(BuildTestCityScene.cs, y -20~-140)보다 한참
            // 아래라 겹치지 않는다.
            var settingsToggleButton = RealmUiKit.NewButton(canvas.transform, RealmLocalization.T("settings.title"),
                new Vector2(1f, 1f), new Vector2(-110f, -356f), new Vector2(180f, 104f), ToggleSettingsPanel);
            _settingsToggleLabel = settingsToggleButton.GetComponentInChildren<TextMeshProUGUI>();

            // 저장(2026-09-15 — GO/DUNGEON/FOREST/STORY엔 다 있던 저장 버튼이
            // REALM만 없었다) — 설정 바로 아래, 같은 구석 기둥을 한 칸 더
            // 잇는다(설정 -330 바로 아래, 10px 틈 — 같은 간격 규칙).
            var saveButton = RealmUiKit.NewButton(canvas.transform, RealmLocalization.T("command.save"),
                new Vector2(1f, 1f), new Vector2(-110f, -468f), new Vector2(180f, 104f), ExecuteSave);
            _saveLabel = saveButton.GetComponentInChildren<TextMeshProUGUI>();

            // 전술 토글(101-2 5-6, 2026-09-20) — 저장 바로 아래, 같은 구석
            // 기둥을 한 칸 더 잇는다(-450 바로 아래, 같은 120px 간격).
            // 공격 패널 안이 아니라 여기 둔 이유: 목표가 하나뿐인 성은
            // 패널 없이 바로 공격이 나가(ExecuteAttack() 참고) 패널 안
            // 토글은 대부분의 공격에서 보이지도 않을 것이기 때문.
            var tacticToggleButton = RealmUiKit.NewButton(canvas.transform, TacticToggleLabelText(),
                new Vector2(1f, 1f), new Vector2(-110f, -580f), new Vector2(180f, 104f), ToggleTactic);
            _tacticToggleLabel = tacticToggleButton.GetComponentInChildren<TextMeshProUGUI>();

            // 일기토 토글(101-2 5-3, 2026-09-20) — 전술 토글 바로 아래,
            // 같은 구석 기둥을 한 칸 더 잇는다(-570 바로 아래, 같은 120px 간격).
            var duelToggleButton = RealmUiKit.NewButton(canvas.transform, DuelToggleLabelText(),
                new Vector2(1f, 1f), new Vector2(-110f, -692f), new Vector2(180f, 104f), ToggleDuel);
            _duelToggleLabel = duelToggleButton.GetComponentInChildren<TextMeshProUGUI>();

            BuildOrderPanel(canvas.transform);
            BuildCityPanel(canvas.transform);
            BuildPlotPanel(canvas.transform);
            BuildQuizPanel(canvas.transform);
            BuildArchivePanel(canvas.transform);
            BuildSettingsPanel(canvas.transform);
            BuildAttackPanel(canvas.transform);
            BuildDuelPanel(canvas.transform);
            BuildDebatePanel(canvas.transform);
            // 맨 마지막 — 이벤트 카드가 항상 다른 패널 위에 그려지게(위
            // 필드 주석 참고).
            BuildEventPanel(canvas.transform);
        }

        /// <summary>PLAN.md 51장 16차 확장(2026-09-18) — 목표가 둘 이상인
        /// 성에서 어디를 칠지 고르는 패널. 함락 진행에 따라 목록이 바뀌지
        /// 않는 성(공격 대상은 정적 카탈로그)이라 계략 패널과 달리 값
        /// 자체는 안 바뀌지만, 열 때마다 "지금 성"이 바뀌어 있을 수 있어
        /// 성 패널(RefreshCityPanel)과 같은 결로 열 때마다 다시 짓는다.</summary>
        private void BuildAttackPanel(Transform parent)
        {
            _attackPanel = RealmUiKit.NewPanel(parent, new Vector2(0.5f, 0.5f), new Vector2(560f, 480f),
                new Color(0f, 0f, 0f, 0.75f));
            _attackPanel.SetActive(false);

            RealmUiKit.NewText(_attackPanel.transform, RealmLocalization.T("panel.attack_title", "칠 곳을 고르세요"), new Vector2(0.5f, 1f), new Vector2(0f, -60f),
                new Vector2(500f, 60f), 30);

            var root = new GameObject("AttackButtons", typeof(RectTransform));
            root.transform.SetParent(_attackPanel.transform, false);
            var rootRect = (RectTransform)root.transform;
            rootRect.anchorMin = Vector2.zero;
            rootRect.anchorMax = Vector2.one;
            rootRect.sizeDelta = Vector2.zero;
            rootRect.anchoredPosition = Vector2.zero;
            _attackButtonsRoot = root.transform;

            RealmUiKit.NewButton(_attackPanel.transform, RealmLocalization.T("settings.close"), new Vector2(0.5f, 0f), new Vector2(0f, 30f),
                new Vector2(300f, 70f), CloseAttackPanel);
        }

        /// <summary>PLAN.md 101-2 5-3 "일기토" — 강제 진행형 모달(닫기 버튼
        /// 없음, 3라운드를 다 골라야 저절로 닫힌다). 라운드 진행은
        /// `_duelRoundText` 한 줄과 베기/찌르기/막기 버튼 셋뿐 — 승/무/패
        /// 결과는 각 선택 직후 토스트로 짧게 알린다(RefreshDuelPanel 참고).</summary>
        private void BuildDuelPanel(Transform parent)
        {
            _duelPanel = RealmUiKit.NewPanel(parent, new Vector2(0.5f, 0.5f), new Vector2(640f, 420f),
                new Color(0f, 0f, 0f, 0.8f));
            _duelPanel.SetActive(false);

            RealmUiKit.NewText(_duelPanel.transform, RealmLocalization.T("duel.title", "🤺 일기토"), new Vector2(0.5f, 1f), new Vector2(0f, -60f),
                new Vector2(560f, 60f), 32);
            _duelRoundText = RealmUiKit.NewText(_duelPanel.transform, "", new Vector2(0.5f, 1f), new Vector2(0f, -140f),
                new Vector2(560f, 50f), 24);

            Saga.Core.ButtonWiring.Wire(RealmUiKit.NewButton(_duelPanel.transform, RealmDuelState.MoveName("slash"), new Vector2(0.5f, 1f), new Vector2(0f, -230f),
                new Vector2(460f, 80f), null), ChooseDuelMove, "slash");
            Saga.Core.ButtonWiring.Wire(RealmUiKit.NewButton(_duelPanel.transform, RealmDuelState.MoveName("stab"), new Vector2(0.5f, 1f), new Vector2(0f, -320f),
                new Vector2(460f, 80f), null), ChooseDuelMove, "stab");
            Saga.Core.ButtonWiring.Wire(RealmUiKit.NewButton(_duelPanel.transform, RealmDuelState.MoveName("guard"), new Vector2(0.5f, 1f), new Vector2(0f, -410f),
                new Vector2(460f, 80f), null), ChooseDuelMove, "guard");
        }

        /// <summary>PLAN.md 101-2 5-3 "설전" — 등용에만 거는 3문 카드
        /// (RealmQuizState.Presented 재사용, 문답 패널과 뼈대는 같지만
        /// _learned/_wrongs 등 학당 상태는 안 건드리는 별도 상태 — 클래스
        /// 주석 참고). 보기 수가 문답과 같이 4개라 위치도 그대로 베꼈다.</summary>
        private void BuildDebatePanel(Transform parent)
        {
            _debatePanel = RealmUiKit.NewPanel(parent, new Vector2(0.5f, 0.5f), new Vector2(760f, 640f),
                new Color(0f, 0f, 0f, 0.82f));
            _debatePanel.SetActive(false);

            RealmUiKit.NewText(_debatePanel.transform, RealmLocalization.T("debate.title", "🗣️ 설전"), new Vector2(0.5f, 1f), new Vector2(0f, -50f),
                new Vector2(680f, 50f), 28);
            _debateProgressText = RealmUiKit.NewText(_debatePanel.transform, "", new Vector2(0.5f, 1f), new Vector2(0f, -110f),
                new Vector2(680f, 40f), 22);
            _debateQuestionText = RealmUiKit.NewText(_debatePanel.transform, "", new Vector2(0.5f, 1f), new Vector2(0f, -190f),
                new Vector2(680f, 130f), 26);

            var root = new GameObject("DebateButtons", typeof(RectTransform));
            root.transform.SetParent(_debatePanel.transform, false);
            var rootRect = (RectTransform)root.transform;
            rootRect.anchorMin = Vector2.zero;
            rootRect.anchorMax = Vector2.one;
            rootRect.sizeDelta = Vector2.zero;
            rootRect.anchoredPosition = Vector2.zero;
            _debateButtonsRoot = root.transform;
        }

        private void RefreshAttackPanel(List<string> targets)
        {
            for (int i = _attackButtonsRoot.childCount - 1; i >= 0; i--)
            {
                Destroy(_attackButtonsRoot.GetChild(i).gameObject);
            }

            float y = -150f;
            foreach (var enemyId in targets)
            {
                var def = RealmEnemyCity.Get(enemyId);
                string capturedId = enemyId;
                RealmUiKit.NewButton(_attackButtonsRoot, def.Name, new Vector2(0.5f, 1f), new Vector2(0f, y),
                    new Vector2(460f, 84f), () => ChooseAttackTarget(capturedId));
                y -= 100f;
            }
        }

        /// <summary>명령 10종 — rtk.js ORDERS 순서, 두 열(왼쪽 5·오른쪽 5)로
        /// 나눠 패널 높이를 감당할 만하게 잡는다.</summary>
        private void BuildOrderPanel(Transform parent)
        {
            _orderPanel = RealmUiKit.NewPanel(parent, new Vector2(0.5f, 0.5f), new Vector2(920f, 720f), // 110 ⑤c-2 — 다섯째 줄이 판 밖·닫기와 겹쳤다
                new Color(0f, 0f, 0f, 0.75f));
            _orderPanel.SetActive(false);

            RealmUiKit.NewText(_orderPanel.transform, RealmLocalization.T("command.orders"), new Vector2(0.5f, 1f), new Vector2(0f, -60f),
                new Vector2(560f, 60f), 32);

            var keys = RealmOrderData.AllKeys;
            for (int i = 0; i < keys.Length; i++)
            {
                string key = keys[i];
                var order = RealmOrderData.Get(key);
                string label = order != null ? string.Format(RealmLocalization.T("ui.order_label", "{0} ({1}냥)"), order.Name, order.Gold) : key;

                int col = i / 5; // 0=왼쪽, 1=오른쪽
                int row = i % 5;
                float x = col == 0 ? -230f : 230f;
                float y = -130f - row * 96f;
                var orderButton = RealmUiKit.NewButton(_orderPanel.transform, label, new Vector2(0.5f, 1f), new Vector2(x, y),
                    new Vector2(420f, 84f), null);
                // 영속 리스너(인자 string) — 람다는 씬 저장 때 사라진다(SagaCore/ButtonWiring.cs).
                Saga.Core.ButtonWiring.Wire(orderButton, ChooseOrder, key);
            }

            RealmUiKit.NewButton(_orderPanel.transform, RealmLocalization.T("settings.close"), new Vector2(0.5f, 0f), new Vector2(0f, 30f),
                new Vector2(300f, 70f), CloseOrderPanel);
        }

        /// <summary>함락한 성(REALM 다음 조각 (2))이 늘면 목록도 늘어야
        /// 하므로, 계략 패널(RefreshPlotPanel)과 같은 결로 열 때마다
        /// RealmCityState.ActiveCityIds 기준으로 다시 짓는다.</summary>
        private void BuildCityPanel(Transform parent)
        {
            _cityPanel = RealmUiKit.NewPanel(parent, new Vector2(0.5f, 0.5f), new Vector2(1000f, 800f),
                new Color(0f, 0f, 0f, 0.75f));
            _cityPanel.SetActive(false);

            RealmUiKit.NewText(_cityPanel.transform, RealmLocalization.T("panel.city_title"), new Vector2(0.5f, 1f), new Vector2(0f, -60f),
                new Vector2(500f, 60f), 30);

            // 110 ⑤c-2 — 성은 함락할수록 늘어(끝판 58) 한 줄씩 쌓으면 화면 밖으로 나갔다 → 스크롤 격자(3열, 마스크).
            var view = new GameObject("CityScroll", typeof(RectTransform), typeof(Image), typeof(RectMask2D), typeof(ScrollRect));
            view.transform.SetParent(_cityPanel.transform, false);
            var viewRect = (RectTransform)view.transform;
            viewRect.anchorMin = Vector2.zero;
            viewRect.anchorMax = Vector2.one;
            viewRect.offsetMin = new Vector2(30f, 115f);  // 닫기(아래 30~100) 위
            viewRect.offsetMax = new Vector2(-30f, -125f); // 제목(-60~-120) 아래
            view.GetComponent<Image>().color = new Color(0f, 0f, 0f, 0f); // 끌기를 받는 투명 판
            var root = new GameObject("CityButtons", typeof(RectTransform), typeof(GridLayoutGroup), typeof(ContentSizeFitter));
            root.transform.SetParent(view.transform, false);
            var rootRect = (RectTransform)root.transform;
            rootRect.anchorMin = new Vector2(0f, 1f);
            rootRect.anchorMax = Vector2.one;
            rootRect.pivot = new Vector2(0.5f, 1f);
            rootRect.anchoredPosition = Vector2.zero;
            rootRect.sizeDelta = Vector2.zero;
            var grid = root.GetComponent<GridLayoutGroup>();
            grid.cellSize = new Vector2(296f, 76f);
            grid.spacing = new Vector2(14f, 12f);
            grid.constraint = GridLayoutGroup.Constraint.FixedColumnCount;
            grid.constraintCount = 3;
            grid.childAlignment = TextAnchor.UpperCenter;
            grid.padding = new RectOffset(0, 0, 4, 4);
            root.GetComponent<ContentSizeFitter>().verticalFit = ContentSizeFitter.FitMode.PreferredSize;
            var scroll = view.GetComponent<ScrollRect>();
            scroll.viewport = viewRect;
            scroll.content = rootRect;
            scroll.horizontal = false;
            scroll.movementType = ScrollRect.MovementType.Clamped;
            scroll.scrollSensitivity = 40f;
            _cityButtonsRoot = root.transform;

            RealmUiKit.NewButton(_cityPanel.transform, RealmLocalization.T("settings.close"), new Vector2(0.5f, 0f), new Vector2(0f, 30f),
                new Vector2(300f, 70f), CloseCityPanel);
        }

        private void RefreshCityPanel()
        {
            for (int i = _cityButtonsRoot.childCount - 1; i >= 0; i--)
            {
                // 격자는 켜진 자식을 세므로, 떼어 끄고 지운다(Destroy 는 프레임 끝이라 같은 프레임에 새 칸과 섞인다).
                var old = _cityButtonsRoot.GetChild(i).gameObject;
                old.SetActive(false);
                old.transform.SetParent(null, false);
                Destroy(old);
            }

            float y = -150f;
            foreach (var cityId in RealmCityState.ActiveCityIds)
            {
                var def = RealmCityData.Get(cityId);
                string capturedId = cityId;
                RealmUiKit.NewButton(_cityButtonsRoot, def.Name, new Vector2(0.5f, 1f), new Vector2(0f, y),
                    new Vector2(296f, 76f), () => ChooseCity(capturedId)); // 자리는 격자가 잡는다
                y -= 100f;
            }
        }

        /// <summary>diplo.js "계략은 성공률을 숨기지 않는다" — 성공률이
        /// 지금 조망 성·로스터 상태에 따라 매번 바뀌므로(RealmWarState
        /// .PreviewPlotChance), 정적으로 한 번 짓지 않고 열 때마다 버튼을
        /// 다시 만든다(RealmCityBuilder.Rebuild()와 같은 결). 51장 16차
        /// 확장(2026-09-18)의 "알려진 틈" 후속(2026-09-18) — 목표가 둘인
        /// 성(장안·장사·강주)에서는 계략도 목표를 고를 수 있어야 해서
        /// 패널 높이를 행 4개(계략 2종×목표 2곳)까지 늘렸다.</summary>
        private void BuildPlotPanel(Transform parent)
        {
            _plotPanel = RealmUiKit.NewPanel(parent, new Vector2(0.5f, 0.5f), new Vector2(680f, 620f),
                new Color(0f, 0f, 0f, 0.75f));
            _plotPanel.SetActive(false);

            RealmUiKit.NewText(_plotPanel.transform, RealmLocalization.T("panel.plot_title"), new Vector2(0.5f, 1f), new Vector2(0f, -60f),
                new Vector2(600f, 60f), 30);

            var root = new GameObject("PlotButtons", typeof(RectTransform));
            root.transform.SetParent(_plotPanel.transform, false);
            var rootRect = (RectTransform)root.transform;
            rootRect.anchorMin = Vector2.zero;
            rootRect.anchorMax = Vector2.one;
            rootRect.sizeDelta = Vector2.zero;
            rootRect.anchoredPosition = Vector2.zero;
            _plotButtonsRoot = root.transform;

            RealmUiKit.NewButton(_plotPanel.transform, RealmLocalization.T("settings.close"), new Vector2(0.5f, 0f), new Vector2(0f, 40f),
                new Vector2(300f, 70f), ClosePlotPanel);
        }

        /// <summary>51장 16차 확장의 "알려진 틈" 후속(2026-09-18) — 목표가
        /// 둘 이상인 성(장안·장사·강주)에서는 계략 종류만으로 목표를 못
        /// 정하므로, 그런 성에서는 "계략×목표" 조합을 행마다 하나씩 낸다
        /// (`ChooseAttackTarget`과 같은 결로 enemyId를 같이 캡처). 목표가
        /// 하나뿐인 대부분 성은 옛날처럼 계략 종류만 나열(enemyId 생략 —
        /// `RealmWarState.Plot()`이 `TargetFrom()`으로 스스로 찾는다).</summary>
        private void RefreshPlotPanel()
        {
            for (int i = _plotButtonsRoot.childCount - 1; i >= 0; i--)
            {
                Destroy(_plotButtonsRoot.GetChild(i).gameObject);
            }

            var targets = RealmEnemyCity.TargetsFrom(RealmCityState.CurrentCity);
            float chance = RealmWarState.PreviewPlotChance(RealmCityState.CurrentCity);
            string chanceText = chance > 0f ? $"{Mathf.RoundToInt(chance * 100f)}%" : RealmLocalization.T("plot.no_officer", "무장 없음");

            float y = -150f;
            foreach (var key in RealmPlotData.AllKeys)
            {
                var plot = RealmPlotData.Get(key);
                string capturedKey = key;
                if (targets.Count > 1)
                {
                    foreach (var enemyId in targets)
                    {
                        var def = RealmEnemyCity.Get(enemyId);
                        string capturedEnemy = enemyId;
                        string label = string.Format(RealmLocalization.T("ui.plot_label_target", "{0} {1} → {2} ({3}냥, 성공률 {4})"),
                            plot.Emoji, plot.Name, def.Name, plot.Gold, chanceText);
                        RealmUiKit.NewButton(_plotButtonsRoot, label, new Vector2(0.5f, 1f), new Vector2(0f, y),
                            new Vector2(600f, 84f), () => ChoosePlot(capturedKey, capturedEnemy));
                        y -= 100f;
                    }
                }
                else
                {
                    string label = string.Format(RealmLocalization.T("ui.plot_label", "{0} {1} ({2}냥, 성공률 {3})"), plot.Emoji, plot.Name, plot.Gold, chanceText);
                    RealmUiKit.NewButton(_plotButtonsRoot, label, new Vector2(0.5f, 1f), new Vector2(0f, y),
                        new Vector2(600f, 84f), () => ChoosePlot(capturedKey));
                    y -= 100f;
                }
            }
        }

        /// <summary>문답 — quiz.js draw()/answer() 그대로(RealmQuizState.cs
        /// 참고). 명령/계략과 달리 무장·턴을 안 쓰는 개인 미니게임이라
        /// 답하면 바로 다음 문제를 이어 낸다(닫을 때까지 계속 풀 수 있게).</summary>
        private void BuildQuizPanel(Transform parent)
        {
            _quizPanel = RealmUiKit.NewPanel(parent, new Vector2(0.5f, 0.5f), new Vector2(760f, 800f),
                new Color(0f, 0f, 0f, 0.82f));
            _quizPanel.SetActive(false);

            // 전부 위(anchor top) 기준으로 순서대로 쌓는다 — 아래(닫는다
            // 버튼)만 따로 아래 기준을 쓰면 문제 텍스트 줄 수에 따라
            // 겹칠 수 있어 통일했다.
            RealmUiKit.NewText(_quizPanel.transform, RealmLocalization.T("command.quiz"), new Vector2(0.5f, 1f), new Vector2(0f, -50f),
                new Vector2(600f, 50f), 30);
            _quizProgressText = RealmUiKit.NewText(_quizPanel.transform, "", new Vector2(0.5f, 1f), new Vector2(0f, -115f),
                new Vector2(680f, 36f), 22);
            _quizQuestionText = RealmUiKit.NewText(_quizPanel.transform, "", new Vector2(0.5f, 1f), new Vector2(0f, -230f),
                new Vector2(680f, 160f), 26);

            var root = new GameObject("QuizButtons", typeof(RectTransform));
            root.transform.SetParent(_quizPanel.transform, false);
            var rootRect = (RectTransform)root.transform;
            rootRect.anchorMin = Vector2.zero;
            rootRect.anchorMax = Vector2.one;
            rootRect.sizeDelta = Vector2.zero;
            rootRect.anchoredPosition = Vector2.zero;
            _quizButtonsRoot = root.transform;

            RealmUiKit.NewButton(_quizPanel.transform, RealmLocalization.T("settings.close"), new Vector2(0.5f, 1f), new Vector2(0f, -740f),
                new Vector2(300f, 70f), CloseQuizPanel);
        }

        /// <summary>새 문제를 뽑아 화면을 다시 채운다 — 열 때·정답을
        /// 고를 때마다 부른다.</summary>
        private void RefreshQuizPanel()
        {
            for (int i = _quizButtonsRoot.childCount - 1; i >= 0; i--)
            {
                Destroy(_quizButtonsRoot.GetChild(i).gameObject);
            }

            var progress = RealmQuizState.GetProgress();
            _quizProgressText.text = string.Format(
                RealmLocalization.T("quiz.progress", "학습 {0}/{1} · 정답 {2}/{3} · 연속 {4}(최고 {5})"),
                progress.Learned, progress.Total, progress.Correct, progress.Answered, progress.Streak, progress.BestStreak);

            var drawn = RealmQuizState.Draw();
            _currentQuiz = drawn;
            if (drawn == null)
            {
                _quizQuestionText.text = RealmLocalization.T("quiz.none_left", "낼 문제가 없다.");
                return;
            }
            var p = drawn.Value;
            _quizQuestionText.text = string.Format(RealmLocalization.T("quiz.header", "[{0} · Lv{1}{2}]\n{3}"),
                RealmQuizData.CatName(p.Cat), p.Lv, p.Review ? RealmLocalization.T("quiz.review_suffix", " · 복습") : "", p.Q);

            float y = -360f;
            for (int i = 0; i < p.Choices.Length; i++)
            {
                int idx = i;
                RealmUiKit.NewButton(_quizButtonsRoot, p.Choices[i], new Vector2(0.5f, 1f), new Vector2(0f, y),
                    new Vector2(660f, 84f), () => ChooseQuizAnswer(idx));
                y -= 100f;
            }
        }

        private void ChooseQuizAnswer(int choiceIdx)
        {
            if (_currentQuiz == null) return;
            var result = RealmQuizState.Answer(_currentQuiz.Value, choiceIdx);
            string msg = result.Ok
                ? string.Format(RealmLocalization.T("quiz.correct", "⭕ 정답! {0}"), result.Why)
                    + (result.Gold > 0 ? string.Format(RealmLocalization.T("quiz.correct_gold_suffix", " (+{0}냥)"), result.Gold) : "")
                : string.Format(RealmLocalization.T("quiz.wrong", "❌ 오답 — 정답은 \"{0}\". {1}"), result.AnswerText, result.Why);
            RealmToast.Instance?.Show(msg, 7f);
            PlayOutcomeSfx(result.Ok);
            RefreshQuizPanel();
        }

        /// <summary>명령/문답/공격/계략 네 결과 처리가 공통으로 쓰는
        /// confirm/error 재생 (`RealmAudio.cs` 클래스 주석 참고).</summary>
        private void PlayOutcomeSfx(bool ok) => RealmAudio.PlaySfx(ok ? confirmClip : errorClip);

        // 닫기 버튼 영속 리스너용(람다 불가 — SagaCore/ButtonWiring.cs, 2026-09-23 먹통 버그).
        private void CloseAttackPanel() => _attackPanel.SetActive(false);
        private void CloseOrderPanel() => _orderPanel.SetActive(false);
        private void CloseCityPanel() => _cityPanel.SetActive(false);
        private void ClosePlotPanel() => _plotPanel.SetActive(false);
        private void CloseQuizPanel() => _quizPanel.SetActive(false);
        private void CloseArchivePanel() => _archivePanel.SetActive(false);
        private void CloseSettingsPanel() => _settingsPanel.SetActive(false);

        private void CloseAllPanels()
        {
            _orderPanel.SetActive(false);
            _cityPanel.SetActive(false);
            _plotPanel.SetActive(false);
            _quizPanel.SetActive(false);
            _archivePanel.SetActive(false);
            _settingsPanel.SetActive(false);
            _attackPanel.SetActive(false);
            _duelPanel.SetActive(false);
            _debatePanel.SetActive(false);
        }

        /// <summary>서고(godot REALM 10절) — 익힌 문제를 최근 순으로 다시
        /// 본다(RealmQuizState.LearnedList). 계략 패널과 같은 결로 열 때마다
        /// 다시 짓는다(문답 도중 새로 익힌 게 있을 수 있으니).</summary>
        private void BuildArchivePanel(Transform parent)
        {
            _archivePanel = RealmUiKit.NewPanel(parent, new Vector2(0.5f, 0.5f), new Vector2(760f, 800f),
                new Color(0f, 0f, 0f, 0.82f));
            _archivePanel.SetActive(false);

            RealmUiKit.NewText(_archivePanel.transform, RealmLocalization.T("panel.archive_title"), new Vector2(0.5f, 1f), new Vector2(0f, -50f),
                new Vector2(680f, 50f), 28);

            var root = new GameObject("ArchiveButtons", typeof(RectTransform));
            root.transform.SetParent(_archivePanel.transform, false);
            var rootRect = (RectTransform)root.transform;
            rootRect.anchorMin = Vector2.zero;
            rootRect.anchorMax = Vector2.one;
            rootRect.sizeDelta = Vector2.zero;
            rootRect.anchoredPosition = Vector2.zero;
            _archiveButtonsRoot = root.transform;

            RealmUiKit.NewButton(_archivePanel.transform, RealmLocalization.T("settings.close"), new Vector2(0.5f, 1f), new Vector2(0f, -740f),
                new Vector2(300f, 70f), CloseArchivePanel);
        }

        private void RefreshArchivePanel()
        {
            for (int i = _archiveButtonsRoot.childCount - 1; i >= 0; i--)
            {
                Destroy(_archiveButtonsRoot.GetChild(i).gameObject);
            }

            var list = RealmQuizState.LearnedList();
            if (list.Count == 0)
            {
                RealmUiKit.NewText(_archiveButtonsRoot, RealmLocalization.T("archive.empty", "아직 익힌 문제가 없다."), new Vector2(0.5f, 1f), new Vector2(0f, -120f),
                    new Vector2(660f, 60f), 24);
                return;
            }

            float y = -110f;
            foreach (var entry in list)
            {
                string label = string.Format(RealmLocalization.T("archive.entry_label", "[{0}] {1}"), RealmQuizData.CatName(entry.Cat), RealmQuizData.ShortQ(entry.Q));
                var captured = entry;
                RealmUiKit.NewButton(_archiveButtonsRoot, label, new Vector2(0.5f, 1f), new Vector2(0f, y),
                    new Vector2(680f, 60f), () => ShowArchiveEntry(captured));
                y -= 68f;
                if (y < -700f) break; // 패널이 스크롤 없이 이 높이까진 담는다.
            }
        }

        private void ShowArchiveEntry(RealmQuizState.LearnedEntry entry)
        {
            RealmToast.Instance?.Show(string.Format(RealmLocalization.T("archive.detail", "[{0} · Lv{1}]\n{2}\n정답: {3}\n{4}"),
                RealmQuizData.CatName(entry.Cat), entry.Lv, entry.Q, entry.AnswerText, entry.Why), 8f);
        }

        /// <summary>설정(PLAN.md 67~69장 "접근성") — 효과음·진동·UI 크기·
        /// 그래픽 품질. 계략 패널처럼 매번 다시 짓지 않고, 한 번 지은 뒤
        /// 버튼 안 Text만 갱신한다(값이 네 개뿐이라 다시 지을 이유가 없다).</summary>
        private void BuildSettingsPanel(Transform parent)
        {
            _settingsPanel = RealmUiKit.NewPanel(parent, new Vector2(0.5f, 0.5f), new Vector2(680f, 860f), // 110 ⑤c-2 — 화면 논리 높이 900 안
                new Color(0f, 0f, 0f, 0.8f));
            _settingsPanel.SetActive(false);

            _settingsTitleLabel = RealmUiKit.NewText(_settingsPanel.transform, RealmLocalization.T("settings.title"),
                new Vector2(0.5f, 1f), new Vector2(0f, -60f), new Vector2(500f, 60f), 32);

            (_settingsSfxNameLabel, _settingsSfxLabel) = MakeSettingsRow(-130f, "settings.sfx", ChooseSfx);
            (_settingsVibrationNameLabel, _settingsVibrationLabel) = MakeSettingsRow(-220f, "settings.vibration", ChooseVibration);
            (_settingsUiScaleNameLabel, _settingsUiScaleLabel) = MakeSettingsRow(-310f, "settings.ui_scale", ChooseUiScale);
            (_settingsQualityNameLabel, _settingsQualityLabel) = MakeSettingsRow(-400f, "settings.graphics_quality", ChooseGraphicsQuality);
            (_settingsLanguageNameLabel, _settingsLanguageLabel) = MakeSettingsRow(-490f, "settings.language", ChooseLanguage);
            (_settingsBgmNameLabel, _settingsBgmLabel) = MakeSettingsRow(-580f, "settings.bgm", ChooseBgm);
            (_settingsSuccessionNameLabel, _settingsSuccessionLabel) = MakeSettingsRow(-670f, "settings.succession", ChooseSuccession);

            var closeButton = RealmUiKit.NewButton(_settingsPanel.transform, RealmLocalization.T("settings.close"),
                new Vector2(0.5f, 0f), new Vector2(0f, 30f), new Vector2(300f, 70f), CloseSettingsPanel);
            _settingsCloseLabel = closeButton.GetComponentInChildren<TextMeshProUGUI>();

            RefreshSettingsPanel();
        }

        private (TextMeshProUGUI name, TextMeshProUGUI value) MakeSettingsRow(float y, string nameKey, UnityEngine.Events.UnityAction onClick)
        {
            var name = RealmUiKit.NewText(_settingsPanel.transform, RealmLocalization.T(nameKey), new Vector2(0f, 1f),
                new Vector2(60f, y), new Vector2(260f, 70f), 26);
            name.alignment = TextAlignmentOptions.Left;
            var button = RealmUiKit.NewButton(_settingsPanel.transform, "", new Vector2(1f, 1f), new Vector2(-60f, y),
                new Vector2(260f, 70f), onClick);
            return (name, button.GetComponentInChildren<TextMeshProUGUI>());
        }

        private void ChooseSfx() { RealmSettingsState.SfxOn = !RealmSettingsState.SfxOn; RefreshSettingsPanel(); }
        private void ChooseVibration() { RealmSettingsState.VibrationOn = !RealmSettingsState.VibrationOn; RefreshSettingsPanel(); }
        private void ChooseUiScale() { RealmSettingsState.CycleUiScale(); RefreshSettingsPanel(); }
        private void ChooseGraphicsQuality() { RealmSettingsState.CycleGraphicsQuality(); RefreshSettingsPanel(); }
        private void ChooseLanguage() { RealmLocalization.CycleLanguage(); RelocalizeBaked(); RefreshSettingsPanel(); }

        /// <summary>110 ⑤c-2c — 씬에 구운 글(빌더 = 한국어)을 지금 언어로: 표 값과 같은 글은 표로, 명령 단추("개간 (60냥)")·
        /// 전술·일기토 단추는 만들 때와 같은 식으로 다시.</summary>
        private void Start() { RelocalizeBaked(); RefreshSettingsPanel(); }

        private void RelocalizeBaked()
        {
            RealmLocalization.RelocalizeScene();
            if (_tacticToggleLabel != null)
            {
                // 영어는 "Tactics:Off / Plain: cavalry charge (…)" 가 세 줄로 넘쳐 밑 일기토 단추를 덮었다 — 단추 안에 맞게 줄인다.
                if (!_tacticToggleLabel.enableAutoSizing)
                {
                    _tacticToggleLabel.fontSizeMax = _tacticToggleLabel.fontSize;
                    _tacticToggleLabel.fontSizeMin = 14f;
                    _tacticToggleLabel.enableAutoSizing = true;
                }
                _tacticToggleLabel.text = TacticToggleLabelText();
            }
            if (_duelToggleLabel != null) _duelToggleLabel.text = DuelToggleLabelText();
            if (_orderPanel == null) return;
            // 명령 단추는 BuildOrderPanel 이 AllKeys 순서로 지었고 닫기가 마지막이다.
            var buttons = _orderPanel.GetComponentsInChildren<Button>(true);
            var keys = RealmOrderData.AllKeys;
            for (int i = 0; i < keys.Length && i < buttons.Length - 1; i++)
            {
                var order = RealmOrderData.Get(keys[i]);
                var label = buttons[i].GetComponentInChildren<TMPro.TextMeshProUGUI>();
                if (order != null && label != null)
                    label.text = string.Format(RealmLocalization.T("ui.order_label", "{0} ({1}냥)"), order.Name, order.Gold);
            }
        }
        private void ChooseBgm() { RealmSettingsState.BgmOn = !RealmSettingsState.BgmOn; RefreshSettingsPanel(); }
        private void ChooseSuccession() { RealmSettingsState.SuccessionOn = !RealmSettingsState.SuccessionOn; RefreshSettingsPanel(); }

        private void RefreshSettingsPanel()
        {
            if (_settingsSfxLabel == null) return;

            _settingsToggleLabel.text = RealmLocalization.T("settings.title");
            _settingsTitleLabel.text = RealmLocalization.T("settings.title");
            _settingsCloseLabel.text = RealmLocalization.T("settings.close");
            _settingsSfxNameLabel.text = RealmLocalization.T("settings.sfx");
            _settingsVibrationNameLabel.text = RealmLocalization.T("settings.vibration");
            _settingsUiScaleNameLabel.text = RealmLocalization.T("settings.ui_scale");
            _settingsQualityNameLabel.text = RealmLocalization.T("settings.graphics_quality");
            _settingsLanguageNameLabel.text = RealmLocalization.T("settings.language");
            _settingsBgmNameLabel.text = RealmLocalization.T("settings.bgm");
            _settingsSuccessionNameLabel.text = RealmLocalization.T("settings.succession");

            _settingsSfxLabel.text = RealmLocalization.T(RealmSettingsState.SfxOn ? "state.on" : "state.off");
            _settingsVibrationLabel.text = RealmLocalization.T(RealmSettingsState.VibrationOn ? "state.on" : "state.off");
            _settingsUiScaleLabel.text = RealmSettingsState.UiScaleLabel();
            _settingsQualityLabel.text = RealmSettingsState.GraphicsQualityLabel();
            _settingsLanguageLabel.text = RealmLocalization.LanguageLabel();
            _settingsBgmLabel.text = RealmLocalization.T(RealmSettingsState.BgmOn ? "state.on" : "state.off");
            _settingsSuccessionLabel.text = RealmLocalization.T(RealmSettingsState.SuccessionOn ? "state.on" : "state.off");

            // 2026-09-15 — 설정 패널 자신 말고 바깥의 여덟 상시 버튼도 언어
            // 전환에 반응하게 한다(이전엔 설정 버튼 자기 자신만 갱신됐다).
            _ordersLabel.text = RealmLocalization.T("command.orders");
            _cityToggleLabel.text = RealmLocalization.T("command.city");
            _plotToggleLabel.text = RealmLocalization.T("command.plot");
            _attackLabel.text = RealmLocalization.T("command.attack");
            _nextMonthLabel.text = RealmLocalization.T("command.next_month");
            _quizToggleLabel.text = RealmLocalization.T("command.quiz");
            _mapLabel.text = RealmLocalization.T("command.map");
            _archiveToggleLabel.text = RealmLocalization.T("command.archive");
            _saveLabel.text = RealmLocalization.T("command.save");
            _tacticToggleLabel.text = TacticToggleLabelText();
        }

        private void ToggleSettingsPanel()
        {
            bool open = !_settingsPanel.activeSelf;
            CloseAllPanels();
            _settingsPanel.SetActive(open);
        }

        private void ToggleOrderPanel()
        {
            bool open = !_orderPanel.activeSelf;
            CloseAllPanels();
            _orderPanel.SetActive(open);
        }

        private void ToggleCityPanel()
        {
            bool open = !_cityPanel.activeSelf;
            CloseAllPanels();
            _cityPanel.SetActive(open);
            if (open) RefreshCityPanel();
        }

        private void TogglePlotPanel()
        {
            bool open = !_plotPanel.activeSelf;
            CloseAllPanels();
            _plotPanel.SetActive(open);
            if (open) RefreshPlotPanel();
        }

        private void ToggleQuizPanel()
        {
            bool open = !_quizPanel.activeSelf;
            CloseAllPanels();
            _quizPanel.SetActive(open);
            if (open) RefreshQuizPanel();
        }

        private void ToggleArchivePanel()
        {
            bool open = !_archivePanel.activeSelf;
            CloseAllPanels();
            _archivePanel.SetActive(open);
            if (open) RefreshArchivePanel();
        }

        /// <summary>월드맵을 열 때는 명령 계열 패널이 지도 위에 뜨는 게
        /// 어색해 미리 닫는다 — 닫는 쪽(지도→디오라마)은 패널과 무관해
        /// 그냥 토글만.</summary>
        private void ToggleMap()
        {
            if (!RealmMapState.ViewingMap) CloseAllPanels();
            RealmMapState.Toggle();
        }

        private void ChooseOrder(string key)
        {
            // PLAN.md 101-2 5-3 "설전" — 등용만, 사자가 있을 때만(없으면
            // 옛 동작 그대로 바로 실행 — ExecuteOrder()가 스스로 "무장이
            // 없습니다" 에러를 돌려준다).
            if (key == "hire")
            {
                var envoy = RealmCityState.HireEnvoyOfficer();
                if (envoy != null)
                {
                    StartDebate(envoy.Wisdom);
                    return;
                }
            }
            RunOrder(key, 1f, -1);
        }

        private void RunOrder(string key, float debateMul, int debateCorrect)
        {
            var result = RealmCityState.ExecuteOrder(key, debateMul);
            string prefix = debateCorrect >= 0
                ? string.Format(RealmLocalization.T("debate.result_prefix", "🗣️ 설전 {0}/3 정답 — "), debateCorrect)
                : "";
            RealmToast.Instance?.Show(prefix + result.Message, 5f);
            PlayOutcomeSfx(result.Ok);
            if (result.Ok) _orderPanel.SetActive(false);
        }

        /// <summary>사자의 지력으로 난도를 정해 3문을 뽑고 첫 문제부터
        /// 보여준다 — 명령 패널은 결과가 나올 때까지 안 필요해 미리 닫는다
        /// (다른 아홉 명령과 달리, 성공/실패가 갈리기 전에 이미 닫힌다).</summary>
        private void StartDebate(int wisdom)
        {
            _debateQuestions = RealmDebateState.Draw(wisdom);
            _debateAnswers = new List<int>();
            CloseAllPanels();
            if (_debateQuestions.Count == 0)
            {
                // 문제은행이 통째로 비는 일은 없지만(RealmQuizData.Bank 36문항
                // 고정), 방어적으로 설전 없이 바로 실행한다.
                RunOrder("hire", 1f, -1);
                return;
            }
            RefreshDebatePanel();
            _debatePanel.SetActive(true);
        }

        private void RefreshDebatePanel()
        {
            for (int i = _debateButtonsRoot.childCount - 1; i >= 0; i--)
            {
                Destroy(_debateButtonsRoot.GetChild(i).gameObject);
            }

            var q = _debateQuestions[_debateAnswers.Count];
            _debateProgressText.text = string.Format(RealmLocalization.T("debate.progress", "설전 {0}/{1}"), _debateAnswers.Count + 1, _debateQuestions.Count);
            _debateQuestionText.text = q.Q;

            float y = -350f;
            for (int i = 0; i < q.Choices.Length; i++)
            {
                int idx = i;
                RealmUiKit.NewButton(_debateButtonsRoot, q.Choices[i], new Vector2(0.5f, 1f), new Vector2(0f, y),
                    new Vector2(660f, 84f), () => ChooseDebateAnswer(idx));
                y -= 100f;
            }
        }

        private void ChooseDebateAnswer(int choiceIdx)
        {
            _debateAnswers.Add(choiceIdx);
            if (_debateAnswers.Count < _debateQuestions.Count)
            {
                RefreshDebatePanel();
                return;
            }

            _debatePanel.SetActive(false);
            var (correct, mul) = RealmDebateState.Result(_debateQuestions, _debateAnswers);
            RunOrder("hire", mul, correct);
        }

        private void ChooseCity(string cityId)
        {
            RealmCityState.SetCurrentCity(cityId);
            _cityPanel.SetActive(false);
            _tacticToggleLabel.text = TacticToggleLabelText(); // 성이 바뀌면 지형 힌트도 바뀐다(101-2 5-6).
        }

        /// <summary>101-2 5-5(2026-09-20) — 승리 조건이 한 번 굳으면(닫힌
        /// 판, `RealmVictoryState.cs` 클래스 주석) godot `realm_month_button.gd`
        /// 처럼 "다음 달"만 막는다. "공격"·"명령" 등은 계속해도 무해해(이미
        /// 정복했거나 더 얻을 것이 없을 뿐) 안 막는다.</summary>
        private float _roundArmUntil;

        private void ExecuteNextMonth()
        {
            if (RealmVictoryState.IsOver)
            {
                // 109-16b 회차 — 이긴 판의 "다음 달" 단추는 다음 회차 시작(한 번 눌러 조건을 보고, 6초 안에 한 번 더 누르면 시작)
                if (!RealmRound.CanNext)
                {
                    RealmToast.Instance?.Show(RealmRound.ReadyLine(), 4f);
                    return;
                }
                if (Time.unscaledTime < _roundArmUntil)
                {
                    _roundArmUntil = 0f;
                    if (!RealmRound.StartNext(true, true, out string why)) RealmToast.Instance?.Show(why, 4f);
                    return;
                }
                _roundArmUntil = Time.unscaledTime + RealmRound.ArmSeconds;
                RealmToast.Instance?.Show(RealmRound.Preview() + RealmLocalization.T("round.confirm", " — 한 번 더 누르면 시작"), RealmRound.ArmSeconds);
                return;
            }
            string summary = RealmCityState.NextMonth();
            RealmToast.Instance?.Show(summary, 5f);
        }

        /// <summary>2026-09-15 — GO/DUNGEON/FOREST/STORY엔 다 있던 저장
        /// 버튼이 REALM만 없었다(자동 로드만 있고, 지금까지 저장은
        /// PlaytestRealmSlice가 테스트용으로 RealmSaveState.Save()를 직접
        /// 부르는 게 전부였다). 다른 네 판과 같은 결 — 결과를 토스트로만
        /// 알린다, PlayOutcomeSfx도 같이 재사용.</summary>
        private void ExecuteSave()
        {
            bool ok = RealmSaveState.Save();
            RealmToast.Instance?.Show(RealmLocalization.T(ok ? "command.save_ok" : "command.save_fail",
                ok ? "저장했다." : "저장 실패."), 3f);
            PlayOutcomeSfx(ok);
        }

        /// <summary>PLAN.md 51장 16차 확장(2026-09-18) — 목표가 하나면 옛날
        /// 그대로 바로 공격(클릭 한 번 유지), 둘 이상이면 고르기 패널을
        /// 먼저 연다. 목표가 아예 없으면(대부분의 성) 옛날처럼 Attack()이
        /// 스스로 "칠 적국이 없습니다" 에러를 돌려주게 그대로 둔다.</summary>
        private void ExecuteAttack()
        {
            var targets = RealmEnemyCity.TargetsFrom(RealmCityState.CurrentCity);
            if (targets.Count > 1)
            {
                CloseAllPanels();
                RefreshAttackPanel(targets);
                _attackPanel.SetActive(true);
                return;
            }

            BeginAttackFlow(null, false);
        }

        private void ChooseAttackTarget(string enemyId)
        {
            _attackPanel.SetActive(false);
            BeginAttackFlow(enemyId, true);
        }

        /// <summary>PLAN.md 101-2 5-3 "일기토" — 켜져 있으면 실제 출진 전에
        /// 3합 카드를 먼저 돌린다(FinishAttackFlow가 결과를 받아 실행).
        /// 꺼져 있으면 옛 동작 그대로 바로 출진.</summary>
        private void BeginAttackFlow(string enemyId, bool hasEnemyId)
        {
            _pendingAttackEnemyId = enemyId;
            _pendingAttackHasEnemyId = hasEnemyId;
            if (_duelEnabled)
            {
                StartDuel();
            }
            else
            {
                FinishAttackFlow(1f, null);
            }
        }

        private void FinishAttackFlow(float duelMul, string duelPrefix)
        {
            var result = _pendingAttackHasEnemyId
                ? RealmWarState.Attack(RealmCityState.CurrentCity, _pendingAttackEnemyId, _tacticEnabled, duelMul)
                : RealmWarState.Attack(RealmCityState.CurrentCity, useTactic: _tacticEnabled, duelPowerMul: duelMul);
            string msg = duelPrefix != null ? duelPrefix + result.Message : result.Message;
            // PLAN.md 109-13 싸움터 땅 — 그 성의 고정 싸움터로 잠깐 컷하고, 알림 첫 줄에 싸움터 이름.
            if (Saga.Realm.World.RealmBattlefield.Show(result) != null)
                msg = "⚔ " + RealmBattleLook.Title(result.EnemyId) + "\n" + msg;
            RealmToast.Instance?.Show(msg, 6f);
            // 출진 자체가 무효면 error, 유효하면 전투 결과(승/패)로 고른다
            // (Won은 Ok=true일 때만 뜻이 있다 — RealmWarState.AttackResult 참고).
            PlayOutcomeSfx(result.Won);
        }

        private void StartDuel()
        {
            _duelResults.Clear();
            _duelRoundIndex = 0;
            CloseAllPanels();
            RefreshDuelPanel();
            _duelPanel.SetActive(true);
        }

        private void RefreshDuelPanel()
        {
            _duelRoundText.text = string.Format(RealmLocalization.T("duel.round", "일기토 {0}/{1} — 무엇을 낼까?"), _duelRoundIndex + 1, RealmDuelState.Rounds);
        }

        private void ChooseDuelMove(string move)
        {
            string enemyMove = RealmDuelState.AiMove();
            string result = RealmDuelState.RoundResult(move, enemyMove);
            _duelResults.Add(result);
            _duelRoundIndex++;

            if (_duelRoundIndex < RealmDuelState.Rounds)
            {
                RefreshDuelPanel();
                return;
            }

            _duelPanel.SetActive(false);
            float mul = RealmDuelState.AverageMul(_duelResults);
            int wins = _duelResults.FindAll(r => r == "win").Count;
            string prefix = string.Format(RealmLocalization.T("duel.result_prefix", "🤺 일기토 {0}승 — "), wins);
            FinishAttackFlow(mul, prefix);
        }

        /// <summary>PLAN.md 101-2 5-6 — 다음 공격에 지형 전술을 쓸지 켜고
        /// 끈다. 버튼 글자 자체에 현재 성 기준 힌트(지형·필요 능력치)를
        /// 얹어 "명령" 패널을 열지 않고도 미리 볼 수 있게 한다.</summary>
        private void ToggleTactic()
        {
            _tacticEnabled = !_tacticEnabled;
            _tacticToggleLabel.text = TacticToggleLabelText();
        }

        private string TacticToggleLabelText()
        {
            string state = RealmLocalization.T(_tacticEnabled ? "state.on" : "state.off");
            string hint = RealmWarState.TacticHintFrom(RealmCityState.CurrentCity);
            return string.IsNullOrEmpty(hint)
                ? $"{RealmLocalization.T("command.tactic", "전술")}:{state}"
                : $"{RealmLocalization.T("command.tactic", "전술")}:{state}\n{hint}";
        }

        /// <summary>PLAN.md 101-2 5-3 — 다음 공격에 일기토(3합 베기/찌르기/
        /// 막기)를 쓸지 켜고 끈다. 전술 토글과 독립 — 둘 다 켜면 배율이
        /// 같이 곱해진다(RealmWar.Fight의 firstRoundPowerMul·defPowerMul·
        /// duelPowerMul 세 자리가 서로 안 겹치는 축이라 자연히 그렇다).</summary>
        private void ToggleDuel()
        {
            _duelEnabled = !_duelEnabled;
            _duelToggleLabel.text = DuelToggleLabelText();
        }

        private string DuelToggleLabelText()
        {
            string state = RealmLocalization.T(_duelEnabled ? "state.on" : "state.off");
            return $"{RealmLocalization.T("command.duel", "일기토")}:{state}";
        }

        private void ChoosePlot(string key, string enemyId = null)
        {
            var result = RealmWarState.Plot(key, RealmCityState.CurrentCity, enemyId);
            RealmToast.Instance?.Show(result.Message, 6f);
            PlayOutcomeSfx(result.Ok);
            if (result.Ok) _plotPanel.SetActive(false);
        }

        /// <summary>101-2 5-2 — 월간 서사 카드. 계략/공격 패널과 달리
        /// 열 때마다 다시 짓지 않고 제목·본문·버튼 세 개를 그때그때
        /// 갱신한다(선택지 문구가 카드마다 다르지만 항상 3개 고정이라
        /// 자리 자체는 재사용).</summary>
        private void BuildEventPanel(Transform parent)
        {
            // PLAN.md 109-16 — 시나리오 카드는 본문이 길다(150~250자): 판 높이 660 · 본문 상자 높이 240·글 22.
            _eventPanel = RealmUiKit.NewPanel(parent, new Vector2(0.5f, 0.5f), new Vector2(720f, 660f),
                new Color(0f, 0f, 0f, 0.85f));
            _eventPanel.SetActive(false);

            _eventTitleText = RealmUiKit.NewText(_eventPanel.transform, "", new Vector2(0.5f, 1f), new Vector2(0f, -50f),
                new Vector2(660f, 60f), 32);
            _eventBodyText = RealmUiKit.NewText(_eventPanel.transform, "", new Vector2(0.5f, 1f), new Vector2(0f, -110f),
                new Vector2(660f, 240f), 22);
            _eventBodyText.alignment = TextAlignmentOptions.Top;

            var root = new GameObject("EventButtons", typeof(RectTransform));
            root.transform.SetParent(_eventPanel.transform, false);
            var rootRect = (RectTransform)root.transform;
            rootRect.anchorMin = Vector2.zero;
            rootRect.anchorMax = Vector2.one;
            rootRect.sizeDelta = Vector2.zero;
            rootRect.anchoredPosition = Vector2.zero;
            _eventButtonsRoot = root.transform;
        }

        /// <summary>RealmEventState.Presented 구독 — 다른 패널을 안 닫고
        /// 그 위에 그냥 띄운다(위 _eventPanel 필드 주석 참고).</summary>
        private void OnEventPresented(RealmEventState.Card card)
        {
            RefreshEventPanel(card);
            _eventPanel.SetActive(true);
        }

        /// <summary>PLAN.md 109-16 — 씬에 구워진 옛 카드 판(680×520)도 긴 시나리오 본문을 담게 열 때마다 크기·자리를 맞춘다(씬 재빌드 없이).</summary>
        private void ApplyEventLayout()
        {
            var panelRect = (RectTransform)_eventPanel.transform;
            panelRect.sizeDelta = new Vector2(720f, 660f);
            var t = (RectTransform)_eventTitleText.transform;
            t.anchoredPosition = new Vector2(0f, -50f);
            t.sizeDelta = new Vector2(660f, 60f);
            var b = (RectTransform)_eventBodyText.transform;
            b.anchoredPosition = new Vector2(0f, -110f);
            b.sizeDelta = new Vector2(660f, 240f);
            _eventBodyText.fontSize = 22;
            _eventBodyText.alignment = TextAlignmentOptions.Top;
        }

        private void RefreshEventPanel(RealmEventState.Card card)
        {
            ApplyEventLayout();
            for (int i = _eventButtonsRoot.childCount - 1; i >= 0; i--)
            {
                Destroy(_eventButtonsRoot.GetChild(i).gameObject);
            }

            var (title, body, a, b, c) = RealmEventState.Describe(card);
            _eventTitleText.text = title;
            _eventBodyText.text = body;

            var labels = new[] { a, b, c };
            var choices = new[] { RealmEventState.Choice.A, RealmEventState.Choice.B, RealmEventState.Choice.C };
            float y = -380f;
            for (int i = 0; i < labels.Length; i++)
            {
                var choice = choices[i];
                RealmUiKit.NewButton(_eventButtonsRoot, labels[i], new Vector2(0.5f, 1f), new Vector2(0f, y),
                    new Vector2(660f, 84f), () => ChooseEvent(card, choice));
                y -= 96f;
            }
        }

        private void ChooseEvent(RealmEventState.Card card, RealmEventState.Choice choice)
        {
            var result = RealmEventState.Resolve(card, choice);
            RealmToast.Instance?.Show(result.Message, 6f);
            PlayOutcomeSfx(result.Ok);
            _eventPanel.SetActive(false);
        }
    }
}
