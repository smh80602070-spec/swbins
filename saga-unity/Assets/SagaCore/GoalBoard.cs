using TMPro;
using UnityEngine;
using UnityEngine.UI;

namespace Saga.Core
{
    /// <summary>
    /// PLAN.md 101-2 "공통 선행" A — 목표판 3줄(지금/이번 세션/이번 주).
    /// GO 를 첫 이식으로 이 위젯을 짓는다(104-1 다음 우선순위 4).
    ///
    /// `BanditEncounter`(Saga.Go.World, 2026-09-12)와 같은 결로 Awake()가
    /// 매 Play 세션 자기 자식을 지우고 다시 짓는다 —
    /// 에디터 빌드 스크립트가 필드를 한 번만 채우고 [SerializeField]가
    /// 없어서 씬 재로드 후 null이 되는 함정(RealmCommandUi·
    /// LocalizedButtonLabel, 2026-09-15/16)을 애초에 피한다. 그 대신
    /// 대가로 이 컴포넌트는 필드를 하나도 직렬화하지 않는다.
    /// </summary>
    public class GoalBoard : MonoBehaviour
    {
        private const float RefreshInterval = 1f;

        private IGoalSource _source;
        private TextMeshProUGUI _label;
        private float _refreshTimer;

        /// <summary>게임 쪽 IGoalSource 구현을 넘긴다. Awake()가 이미 UI를
        /// 지어 둔 뒤라 호출 순서는 상관없다.</summary>
        public void Init(IGoalSource source)
        {
            _source = source;
            Refresh();
        }

        private void Awake()
        {
            for (int i = transform.childCount - 1; i >= 0; i--)
            {
                DestroyImmediate(transform.GetChild(i).gameObject);
            }
            Build();

            // Init()으로 넘긴 참조는 이 컴포넌트의 plain private 필드라
            // [SerializeField]가 안 통한다(인터페이스 타입 — 유니티가 직렬화
            // 못 함) — 씬을 저장·재로드하면 여기서도 null이 된다(REALM·
            // LocalizedButtonLabel과 같은 함정, 2026-09-15/16). 대신 씬 안의
            // IGoalSource 구현체를 스스로 다시 찾는다(DebugHud._player 재탐색과
            // 같은 결) — SagaCore가 게임 쪽 구체 타입을 몰라도 인터페이스만으로 찾을 수 있다.
            if (_source == null) _source = FindGoalSource();
            Refresh();
        }

        private IGoalSource FindGoalSource()
        {
            var behaviours = Object.FindObjectsByType<MonoBehaviour>(FindObjectsSortMode.None);
            foreach (var b in behaviours)
            {
                if (!ReferenceEquals(b, this) && b is IGoalSource src) return src;
            }
            return null;
        }

        private void Build()
        {
            var canvasGo = new GameObject("Canvas", typeof(RectTransform));
            canvasGo.transform.SetParent(transform, false);
            var canvas = canvasGo.AddComponent<Canvas>();
            canvas.renderMode = RenderMode.ScreenSpaceOverlay;
            var scaler = canvasGo.AddComponent<CanvasScaler>();
            scaler.uiScaleMode = CanvasScaler.ScaleMode.ScaleWithScreenSize;
            Saga.Core.SagaUi.ApplyGameScaler(scaler);
            canvasGo.AddComponent<GraphicRaycaster>();

            // 화면 위쪽 가운데, 대화창(DialogueUI, y=-80부터) 바로 위 —
            // 이 판에서 유일하게 비어 있는 가로 폭 전체 상단 띠.
            var textGo = new GameObject("Label", typeof(RectTransform));
            textGo.transform.SetParent(canvasGo.transform, false);
            var rect = (RectTransform)textGo.transform;
            rect.anchorMin = new Vector2(0.5f, 1f);
            rect.anchorMax = new Vector2(0.5f, 1f);
            rect.pivot = new Vector2(0.5f, 1f);
            rect.anchoredPosition = new Vector2(0f, -10f);
            // PLAN.md 110 ⑥c — 폭 540 을 넘는 줄(그날 뽑힌 일과·영어)은 줄바꿈 대신 글씨를 줄인다(22→15).
            // 900 폭에 줄바꿈이면 긴 줄만큼 글이 넓어져 DUNGEON 왼쪽 위 상태 글과 닿았다(여유 27px).
            rect.sizeDelta = new Vector2(540f, 90f);

            _label = textGo.AddComponent<TextMeshProUGUI>();
            _label.fontSize = 22;
            _label.enableAutoSizing = true;
            _label.fontSizeMin = 15;
            _label.fontSizeMax = 22;
            _label.alignment = TextAlignmentOptions.Top;
            _label.color = Color.white;
            _label.textWrappingMode = TextWrappingModes.NoWrap;
            _label.text = "";
        }

        private void Update()
        {
            _refreshTimer += Time.unscaledDeltaTime;
            if (_refreshTimer < RefreshInterval) return;
            _refreshTimer = 0f;
            Refresh();
        }

        private void Refresh()
        {
            if (_source == null || _label == null) return;
            _label.text = $"{SagaUi.L("지금", "Now")} — {_source.GoalLineNow()}\n" +
                $"{SagaUi.L("이번 세션", "This session")} — {_source.GoalLineSession()}\n" +
                $"{SagaUi.L("이번 주", "This week")} — {_source.GoalLineWeek()}";
        }
    }
}
