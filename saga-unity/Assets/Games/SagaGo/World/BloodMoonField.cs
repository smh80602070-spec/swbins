using Saga.Go.Combat;
using Saga.Go.Data;
using UnityEngine;
using UnityEngine.UI;

namespace Saga.Go.World
{
    /// <summary>
    /// tasks U-0227 ① 핏빛 달 밤 런타임 — 2초마다 지금이 붉은 밤인지 보고(`GoBloodMoon.RedAt`), 붉어지는 순간 한 번 토스트 + 1초 뒤 쓰러진 들판 무리를
    /// 일으킨다(`FieldEnemy.ReviveSoon` — 모닥불 U-0168 과 같은 길, 수호장·숨은 터·임무 적·들판 인물은 그대로). 붉은 동안 화면에 옅은 붉은 덧칠
    /// (화면 공간 UI 알파 0.12, HUD 밑 — 렌더·화질 손 안 댐). `WorldMapBuilder` 가 Play 때 붙인다.
    /// </summary>
    public class BloodMoonField : MonoBehaviour
    {
        public const float CheckSec = 2f;
        public static readonly Color Tint = new Color(0.55f, 0f, 0.05f, 0.12f);

        public static BloodMoonField Instance { get; private set; }
        /// <summary>마지막으로 일으킨 수(진단).</summary>
        public int Risen { get; private set; }

        private float _t, _riseAt = -1f;
        private Image _veil;

        private void Awake()
        {
            Instance = this;
            var cgo = new GameObject("BloodMoonVeil");
            cgo.transform.SetParent(transform, false);
            var canvas = cgo.AddComponent<Canvas>();
            canvas.renderMode = RenderMode.ScreenSpaceOverlay;
            canvas.sortingOrder = -50; // HUD(0~) 밑, 3D 위 · 누름은 안 가로챔(GraphicRaycaster 없음)
            var go = new GameObject("Veil", typeof(RectTransform));
            go.transform.SetParent(canvas.transform, false);
            var rt = (RectTransform)go.transform;
            rt.anchorMin = Vector2.zero; rt.anchorMax = Vector2.one; rt.offsetMin = rt.offsetMax = Vector2.zero;
            _veil = go.AddComponent<Image>();
            _veil.color = Tint;
            _veil.raycastTarget = false;
            _veil.enabled = false;
            GoBloodMoon.Active = false;
        }

        private void OnDestroy() { if (Instance == this) { Instance = null; GoBloodMoon.Active = false; } }

        private void Update()
        {
            if (_riseAt >= 0f && Time.time >= _riseAt) { _riseAt = -1f; Rise(); }
            _t -= Time.deltaTime;
            if (_t > 0f) return;
            _t = CheckSec;
            SetRed(GoBloodMoon.RedAt(GoNight.NowFn()));
        }

        /// <summary>붉은 밤 켜고 끄기(진단도 부른다). 켜지는 순간 토스트·1초 뒤 일으킴.</summary>
        public void SetRed(bool red)
        {
            if (_veil != null) _veil.enabled = red;
            if (red == GoBloodMoon.Active) return;
            GoBloodMoon.Active = red;
            if (!red) return;
            Saga.Go.UI.DialogueLabel.Instance?.Show(GoLocalization.T("bloodmoon.rise", "🌕 핏빛 달이 떴다 — 쓰러진 것들이 다시 일어선다 (오늘 밤 전리품 ×2)"), 4f);
            _riseAt = Time.time + GoBloodMoon.RiseSec;
        }

        /// <summary>쓰러진 들판 무리를 일으킨다(진단은 곧장 부른다).</summary>
        public int Rise()
        {
            int n = 0;
            foreach (var e in FieldEnemy.All) if (e != null && e.ReviveSoon()) n++;
            Risen = n;
            return n;
        }

        public bool VeilShown => _veil != null && _veil.enabled;
    }
}
