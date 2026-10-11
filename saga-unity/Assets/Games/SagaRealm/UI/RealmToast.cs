using TMPro;
using System.Collections;
using UnityEngine;
using UnityEngine.UI;

namespace Saga.Realm.UI
{
    /// <summary>SagaGo `UI/DialogueLabel.cs`와 같은 자기등록 싱글턴 자막 —
    /// 명령 결과·다음 달 정산 문구를 한 줄 띄운다.</summary>
    public class RealmToast : MonoBehaviour
    {
        public static RealmToast Instance { get; private set; }

        [SerializeField] private TextMeshProUGUI label;

        private Coroutine _hideRoutine;
        // tasks U-0097 — 사건·소식·시나리오 카드가 떠 있으면 토스트가 카드 글·갈래 단추 위에 겹쳤다(U-0091·U-0094 촬영).
        // 카드가 열려 있는 동안엔 화면 맨 아래 띠로 옮기고(위쪽은 HUD 줄과 카드 제목 사이 틈이 없어 처음엔 제목에 겹쳤다), 닫히면 원래 자리로.
        private Vector2 _homeMin, _homeMax, _homePivot, _homePos;
        private bool _homeSaved, _raised;
        public const float RaisedY = 18f;
        /// <summary>진단용 — 지금 위 띠에 있는가.</summary>
        public bool Raised => _raised;
        public RectTransform LabelRect => label != null ? label.rectTransform : null;

        private void Awake()
        {
            Instance = this;
            if (label != null)
            {
                var rt = label.rectTransform;
                _homeMin = rt.anchorMin; _homeMax = rt.anchorMax; _homePivot = rt.pivot; _homePos = rt.anchoredPosition;
                _homeSaved = true;
                label.gameObject.SetActive(false);
            }
        }

        public void Show(string text, float seconds = 5f)
        {
            if (label == null) return;
            label.text = text;
            Place(Saga.Realm.Data.RealmEventState.Current.HasValue);
            label.gameObject.SetActive(true);
            if (_hideRoutine != null) StopCoroutine(_hideRoutine);
            _hideRoutine = StartCoroutine(HideAfter(seconds));
        }

        private void LateUpdate()
        {
            if (label == null || !label.gameObject.activeSelf) return;
            bool card = Saga.Realm.Data.RealmEventState.Current.HasValue;
            if (card != _raised) Place(card);
        }

        /// <summary>카드가 열려 있으면 아래 가운데 띠, 아니면 씬에 놓인 원래 자리.</summary>
        private void Place(bool raise)
        {
            if (!_homeSaved || label == null) return;
            var rt = label.rectTransform;
            if (raise)
            {
                rt.anchorMin = rt.anchorMax = rt.pivot = new Vector2(0.5f, 0f);
                rt.anchoredPosition = new Vector2(0f, RaisedY);
            }
            else
            {
                rt.anchorMin = _homeMin; rt.anchorMax = _homeMax; rt.pivot = _homePivot; rt.anchoredPosition = _homePos;
            }
            _raised = raise;
        }

        private IEnumerator HideAfter(float seconds)
        {
            yield return new WaitForSeconds(seconds);
            label.gameObject.SetActive(false);
            _hideRoutine = null;
        }
    }
}
