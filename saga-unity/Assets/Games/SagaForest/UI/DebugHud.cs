using TMPro;
using UnityEngine;
using UnityEngine.InputSystem;
using UnityEngine.Rendering;
using UnityEngine.UI;

namespace Saga.Forest.UI
{
    /// <summary>
    /// PLAN.md 44~49장 디버그 화면 — GO `UI/DebugHud.cs`와 같은 결(다섯 판
    /// 공용 로직 복사 관례), FOREST엔 아직 없어 2026-09-14에 새로 만들었다.
    /// 문서가 나열한 전체 목록(FPS/Draw Calls/Enemy Count/Player Position/
    /// Current Quest/Player Level/Current Zone 등) 중 **Player Position만**
    /// 얹었다 — `ForestState.cs` 클래스 주석이 이미 적어 둔 대로 이 판엔
    /// 전투·성장·경제가 없어(GO/DUNGEON의 HeroState/PlayerStats에 대응하는
    /// 것 자체가 없다) Level·Quest는 낼 수 없고, 적대 개체(포자괴물)도
    /// 상주 리스트가 아니라 밀어내기 미니게임뿐이라 Enemy Count도 못
    /// 낸다. GO/DUNGEON과 같은 이유로 Draw Calls/Visible Objects/Memory도
    /// 안 넣는다(Unity Profiler 몫).
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
        private Transform _player;

        private void Awake()
        {
            if (!Debug.isDebugBuild)
            {
                gameObject.SetActive(false);
                return;
            }
            var playerGo = GameObject.FindWithTag("Player");
            _player = playerGo != null ? playerGo.transform : null;
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
            string pos = _player != null
                ? $"{_player.position.x:F1}, {_player.position.y:F1}, {_player.position.z:F1}"
                : "-";
            label.text = $"renderer: {rendererName}\n{_fps:F0} fps\npos: {pos}";
        }
    }
}
