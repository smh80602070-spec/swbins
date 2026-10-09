using TMPro;
using UnityEngine;
using UnityEngine.InputSystem;
using UnityEngine.Rendering;
using UnityEngine.UI;
using Saga.Realm.Data;

namespace Saga.Realm.UI
{
    /// <summary>
    /// PLAN.md 44~49장 디버그 화면 — GO `UI/DebugHud.cs`와 같은 결(다섯 판
    /// 공용 로직 복사 관례), REALM엔 아직 없어 2026-09-14에 새로 만들었다.
    /// REALM은 경영·문답 게임이라 다른 네 판과 달리 **조작하는 캐릭터
    /// 자체가 없다**(`FindWithTag("Player")`를 부를 대상이 없다 — 이
    /// 저장소 전체에서 REALM만 Player 태그를 안 쓴다) — Player Position은
    /// 낼 수 없다. 대신 REALM에 이미 있는 진행 축(`RealmCityState.Year`/
    /// `Month`/`Gold`/`CurrentCity`)을 Current Zone·Current Quest 대용으로
    /// 얹었다. Player Level 개념도 없다(장수는 있어도 플레이어 개인
    /// 레벨이 아니다). GO/DUNGEON/FOREST/STORY와 같은 이유로 Draw Calls/
    /// Visible Objects/Memory도 안 넣는다(Unity Profiler 몫).
    /// </summary>
    // 이름 주의 — "DebugOverlay"는 UnityEngine.Rendering.DebugOverlay와
    // 겹쳐 컴파일 에러(CS0104)가 난다. DebugHud로 피했다(GO와 같은 이유).
    public class DebugHud : MonoBehaviour
    {
        [SerializeField] private TextMeshProUGUI label;

        private float _fpsTimer;
        private int _frameCount;
        private float _fps;
        // U-0067 — 플레이어 HUD 와 같은 자리라 기본 숨김, F3 으로 켜고 끈다.
        // 글자 갱신은 숨겨도 계속한다(진단이 label.text 를 읽는다).
        private bool _shown;

        private void Awake()
        {
            if (!Debug.isDebugBuild)
            {
                gameObject.SetActive(false);
            }
        }

        private void Update()
        {
            if (Keyboard.current != null && Keyboard.current.f3Key.wasPressedThisFrame)
                _shown = !_shown;
            if (label != null && label.enabled != _shown) label.enabled = _shown;
            _frameCount++;
            _fpsTimer += Time.unscaledDeltaTime;
            if (_fpsTimer >= 0.5f)
            {
                _fps = _frameCount / _fpsTimer;
                _frameCount = 0;
                _fpsTimer = 0f;
                Refresh();
            }
        }

        private void Refresh()
        {
            if (label == null) return;
            var pipeline = GraphicsSettings.currentRenderPipeline;
            string rendererName = pipeline != null ? pipeline.name : "(built-in)";
            label.text = $"renderer: {rendererName}\n{_fps:F0} fps\n" +
                $"{RealmCityState.Year}년 {RealmCityState.Month}월 · 금 {RealmCityState.Gold}\n" +
                $"city: {RealmCityState.CurrentCity}";
        }
    }
}
