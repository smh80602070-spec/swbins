using TMPro;
using System.Collections;
using UnityEngine;
using UnityEngine.UI;

namespace Saga.Go.UI
{
    /// <summary>
    /// 지나가다 듣는 한 마디를 띄우는 화면 상단 자막. 누르는 대화창이 아니다
    /// — saga-godot의 npc_builder.gd _say()와 같은 감각("dialogue_label"
    /// 그룹의 첫 Label을 찾아 글자만 갈아 끼움). Unity엔 그룹이 없어
    /// 자기등록 싱글턴으로 대신한다.
    /// </summary>
    public class DialogueLabel : MonoBehaviour
    {
        public static DialogueLabel Instance { get; private set; }

        [SerializeField] private TextMeshProUGUI label;

        private Coroutine _hideRoutine;

        // U-0072 — 화면 전체 판(낚시 게시판)이 열린 동안 대사 줄이 그 글을 덮었다. 참이면 Show 가 아무것도 안 하고, 켜는 순간 떠 있던 줄도 숨긴다.
        private static bool _muted;
        public static bool Muted
        {
            get => _muted;
            set { _muted = value; if (value && Instance != null) Instance.HideNow(); }
        }

        private void Awake()
        {
            Instance = this;
            _muted = false; // 정적이라 도메인 리로드를 끈 촬영 도구에서 지난 판 값이 남지 않게
            if (label != null)
            {
                ApplyLayout(label);
                label.gameObject.SetActive(false);
            }
        }

        /// <summary>
        /// 자리 한 곳 — 씬 빌더와 <see cref="Awake"/> 가 같이 부른다(씬을 다시 안 지어도 실행 때 맞는다).
        /// PLAN.md 110 ⑤c-3: 가운데 정렬이면 세 줄(영어)이 위로 번져 목표판·Ⅱ 단추에 닿았다 → 목표판 밑에서 시작해 아래로.
        /// </summary>
        public static void ApplyLayout(TextMeshProUGUI text)
        {
            var rect = text.rectTransform;
            rect.anchorMin = rect.anchorMax = rect.pivot = new Vector2(0.5f, 1f);
            rect.anchoredPosition = new Vector2(0f, -112f);
            rect.sizeDelta = new Vector2(920f, 140f);
            text.fontSize = 34;
            text.alignment = TextAlignmentOptions.Top;
        }

        public void Show(string text, float seconds)
        {
            if (label == null || _muted) return;

            label.text = text;
            label.gameObject.SetActive(true);
            if (_hideRoutine != null)
            {
                StopCoroutine(_hideRoutine);
            }
            _hideRoutine = StartCoroutine(HideAfter(seconds));
        }

        private void HideNow()
        {
            if (_hideRoutine != null) { StopCoroutine(_hideRoutine); _hideRoutine = null; }
            if (label != null) label.gameObject.SetActive(false);
        }

        private IEnumerator HideAfter(float seconds)
        {
            yield return new WaitForSeconds(seconds);
            label.gameObject.SetActive(false);
            _hideRoutine = null;
        }
    }
}
