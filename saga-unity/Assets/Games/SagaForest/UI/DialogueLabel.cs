using TMPro;
using System.Collections;
using UnityEngine;
using UnityEngine.UI;

namespace Saga.Forest.UI
{
    /// <summary>
    /// VERTICAL_SLICE_FOREST.md — GO/DUNGEON의 UI/DialogueLabel.cs를 그대로
    /// 복사(네임스페이스만 변경, 루트 CLAUDE.md "다섯 판은 다섯 벌 복사"
    /// 원칙) — 채집·대화 결과 토스트를 띄우는 데 그대로 재사용한다.
    /// </summary>
    public class DialogueLabel : MonoBehaviour
    {
        public static DialogueLabel Instance { get; private set; }

        [SerializeField] private TextMeshProUGUI label;

        private Coroutine _hideRoutine;

        // U-0071 — 씬이 구운 자리(위 가운데 y −80)는 목표판(y −10·높이 90)·오른쪽 위 일시정지 단추(y −30·80, 아래 끝 110)와
        // 겹쳤다. 둘 다 끝나는 120 아래로 내린다(폭 920 은 그대로 — 내려가면 단추와 가로로 안 만난다).
        private const float TopY = -120f;

        private void Awake()
        {
            Instance = this;
            if (label != null)
            {
                var rt = label.rectTransform;
                if (rt.anchoredPosition.y > TopY) rt.anchoredPosition = new Vector2(rt.anchoredPosition.x, TopY);
                label.gameObject.SetActive(false);
            }
        }

        public void Show(string text, float seconds)
        {
            if (label == null) return;

            label.text = text;
            label.gameObject.SetActive(true);
            if (_hideRoutine != null)
            {
                StopCoroutine(_hideRoutine);
            }
            _hideRoutine = StartCoroutine(HideAfter(seconds));
        }

        private IEnumerator HideAfter(float seconds)
        {
            yield return new WaitForSeconds(seconds);
            label.gameObject.SetActive(false);
            _hideRoutine = null;
        }
    }
}
