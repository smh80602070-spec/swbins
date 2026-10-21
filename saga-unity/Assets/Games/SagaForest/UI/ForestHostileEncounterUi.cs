using System;
using System.Collections;
using UnityEngine;
using UnityEngine.UI;
using Saga.Forest.Audio;
using Saga.Forest.Data;

namespace Saga.Forest.UI
{
    /// <summary>
    /// FOREST "전투 콘텐츠"(2026-09-14, 사용자가 "Forest 전투 콘텐츠 설계부터
    /// 시작"으로 명시적 요청) — `World/ForestCreature.cs`의 클래스 주석이
    /// "전투·포획·HP는 안 만든다"고 못박아 둔 결정을 사용자 지시로 뒤집는다.
    /// 다만 GO/DUNGEON의 DuelRules(스탯·수식) 같은 무거운 판정 시스템을 새로
    /// 짓지 않았다 — FOREST엔 플레이어 스탯·파티·골드 같은 인프라 자체가
    /// 없어(순수 라이프심) 그런 걸 지금 지으면 "전투"가 아니라 "새 RPG
    /// 경제"가 된다. 대신 여덟 종 중 하나(포자괴물 — 텍스트로도 이미
    /// "괴물"로 묘사돼 있었다)만 적대(Hostile)로 바꿔, 대치하면 이 UI가
    /// 뜨는 아주 가벼운 "밀어내기" 미니게임(버튼 연타로 게이지를 비움,
    /// 실패해도 처벌 없음 — 원작(동물의 숲)의 비폭력 톤은 유지)만 만든다.
    /// 결과와 무관하게 창조물은 물러난다 — "이긴다/진다"가 아니라 "빨리
    /// 몰아내나 천천히 몰아내나"의 차이일 뿐이다.
    /// </summary>
    public class ForestHostileEncounterUi : MonoBehaviour
    {
        public static ForestHostileEncounterUi Instance { get; private set; }

        private const int PressesToWin = 6;
        private const float TimeoutSec = 6f;

        // [SerializeField] 필수 — Build()는 편집기 씬 빌드 스크립트가 edit-time에
        // 딱 한 번 부른다(Awake는 Play 모드에서만 돎, 다른 편집기 빌드 스크립트와
        // 같은 관례). private 필드가 [SerializeField]가 아니면 이 참조는 씬
        // 저장·재로드를 못 버텨(자식 GameObject 자체는 씬에 그대로 남지만, 이
        // C# 필드는 직렬화 대상이 아니라 null로 되돌아간다) Play 모드 진입 시
        // _panel이 null인 채로 남는다 — DialogueLabel.cs의 `[SerializeField]
        // private Text label;`과 같은 이유로 여기도 필요.
        [SerializeField] private GameObject _panel;
        [SerializeField] private Image _gaugeFill;
        // 67장 "사운드" 첫 슬라이스 — ForestAudio.cs 참고. 이 필드들도 같은
        // 이유로 [SerializeField]가 필요하다(위 _panel 주석과 동일).
        private int _pressesLeft;
        private Action<bool> _onResolved;
        private Coroutine _timeoutRoutine;

        private void Awake()
        {
            Instance = this;
        }

        /// <summary>edit-time 씬 빌드가 직접 부른다 — 다른 편집기 빌드 스크립트의
        /// UI 조립 패턴(BuildDialogueUi 등)과 같다. pressClip/resolveClip는
        /// 없어도(다른 PC 등) 동작에 지장 없다 — PlaySfx가 null을 조용히 건너뛴다.</summary>
        public void Build(Transform canvasRoot)
        {
            _panel = EncounterUiKit.NewPanel(canvasRoot, new Vector2(0.5f, 0.22f), new Vector2(560f, 220f),
                new Color(0.08f, 0.08f, 0.1f, 0.85f));
            EncounterUiKit.NewText(_panel.transform, ForestLocalization.T("encounter.title", "포자괴물이 다가온다!"), new Vector2(0.5f, 1f),
                new Vector2(0f, -34f), new Vector2(520f, 60f), 30);
            _gaugeFill = EncounterUiKit.NewBarRow(_panel.transform, ForestLocalization.T("encounter.gauge", "경계"), -110f, out _);
            EncounterUiKit.NewButton(_panel.transform, ForestLocalization.T("encounter.push_back"), new Vector2(0.5f, 0f),
                new Vector2(0f, 44f), new Vector2(280f, 84f), OnPress);
            _panel.SetActive(false);
        }

        public bool IsActive => _panel != null && _panel.activeSelf;

        public void StartEncounter(Action<bool> onResolved)
        {
            if (_panel == null)
            {
                // 씬에 UI가 없는 상황(다른 헤드리스 테스트 등) — 곧바로 물러난 것으로 처리.
                onResolved?.Invoke(true);
                return;
            }
            _onResolved = onResolved;
            _pressesLeft = PressesToWin;
            _gaugeFill.fillAmount = 1f;
            _panel.SetActive(true);
            if (_timeoutRoutine != null) StopCoroutine(_timeoutRoutine);
            _timeoutRoutine = StartCoroutine(TimeoutAfter(TimeoutSec));
        }

        /// <summary>테스트가 실제 버튼 클릭 없이 같은 효과를 내려고 부른다 —
        /// PlaytestForestCreatures.cs 참고.</summary>
        public void DebugPress() => OnPress();

        private void OnPress()
        {
            if (!IsActive) return;
            ForestAudio.PlaySfx("ui_click"); // tasks U-0104
            _pressesLeft--;
            _gaugeFill.fillAmount = Mathf.Max(0f, (float)_pressesLeft / PressesToWin);
            if (_pressesLeft <= 0) Resolve(true);
        }

        private IEnumerator TimeoutAfter(float sec)
        {
            yield return new WaitForSeconds(sec);
            Resolve(false);
        }

        private void Resolve(bool won)
        {
            if (_timeoutRoutine != null)
            {
                StopCoroutine(_timeoutRoutine);
                _timeoutRoutine = null;
            }
            _panel.SetActive(false);
            ForestAudio.PlaySfx(won ? "victory" : "defeat"); // tasks U-0104 — 밀어냄/놓침
            var cb = _onResolved;
            _onResolved = null;
            cb?.Invoke(won);
        }
    }
}
