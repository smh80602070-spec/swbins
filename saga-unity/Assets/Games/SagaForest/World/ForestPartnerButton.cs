using TMPro;
using UnityEngine;
using UnityEngine.UI;
using Saga.Core;
using Saga.Forest.Data;
using Saga.Forest.UI;

namespace Saga.Forest.World
{
    /// <summary>
    /// tasks U-0144 — 집 안 동반자 곁(2.5m)에 서면 화면 아래 가운데에 "💔 헤어지기" 단추 하나(웹 partner.breakUp).
    /// 처음 누르면 "정말? 한 번 더" 로 바뀌고 4초 안에 다시 누르면 헤어진다(하트 절반). 멀어지면 단추가 숨고 확인도 풀린다.
    /// 캔버스는 처음 곁에 섰을 때 만든다(진단이 직접 <see cref="Press"/> 를 부른다). `ForestVisitorRunner` 가 집 안 동반자에 붙인다.
    /// </summary>
    public class ForestPartnerButton : MonoBehaviour
    {
        public const float Radius = 2.5f;
        public const float ConfirmSec = 4f;

        private Transform _player;
        private Canvas _canvas;
        private Button _button;
        private float _confirmLeft;

        /// <summary>진단 — 단추가 지금 보이나·확인 대기 중인가.</summary>
        public bool Shown => _canvas != null && _canvas.gameObject.activeSelf;
        public bool Confirming => _confirmLeft > 0f;

        private void Update()
        {
            if (_player == null) { var p = GameObject.FindWithTag("Player"); _player = p != null ? p.transform : null; }
            bool near = _player != null && Vector3.Distance(_player.position, transform.position) <= Radius && ForestPartner.Has;
            if (near && _canvas == null) Build();
            if (_canvas != null && _canvas.gameObject.activeSelf != near) _canvas.gameObject.SetActive(near);
            if (!near) _confirmLeft = 0f;
            else if (_confirmLeft > 0f) { _confirmLeft -= Time.deltaTime; if (_confirmLeft <= 0f) Relabel(); }
        }

        private void Build()
        {
            _canvas = EncounterUiKit.NewCanvas("PartnerCanvas");
            _canvas.sortingOrder = 3;
            _button = SagaUi.NewButton(_canvas.transform, "PartnerBreak", "", new Vector2(0.5f, 0f), new Vector2(0f, 150f), new Vector2(300f, 64f), SagaUi.ButtonIdle, 26f);
            _button.onClick.AddListener(() => Press());
            Relabel();
        }

        private void Relabel()
        {
            if (_button == null) return;
            _button.GetComponentInChildren<TMP_Text>().text = _confirmLeft > 0f
                ? ForestLocalization.T("partner.break_confirm", "정말 헤어질까? 한 번 더")
                : ForestLocalization.T("partner.break_btn", "💔 헤어지기");
        }

        /// <summary>단추 누름 — 첫 번째는 확인, 4초 안 두 번째에 헤어진다. 헤어졌으면 그 글.</summary>
        public string Press()
        {
            if (!ForestPartner.Has) return null;
            if (_confirmLeft <= 0f)
            {
                _confirmLeft = ConfirmSec;
                Relabel();
                return null;
            }
            _confirmLeft = 0f;
            int idx = ForestVisitors.IndexOf(ForestPartner.Id);
            string who = idx >= 0 ? $"{ForestVisitors.List[idx].Emoji} {ForestVisitors.Name(ForestVisitors.List[idx])}" : "";
            string line = ForestPartner.BreakUp(who);
            DialogueLabel.Instance?.Show(line, ForestVisitors.LineSec);
            return line;
        }

        private void OnDestroy()
        {
            if (_canvas != null) Destroy(_canvas.gameObject);
        }
    }
}
