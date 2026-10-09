using TMPro;
using UnityEngine;
using UnityEngine.InputSystem;
using UnityEngine.Rendering;
using UnityEngine.UI;
using Saga.Go.Data;

namespace Saga.Go.UI
{
    /// <summary>
    /// PLAN.md 46장·66-1장 — 디버그 빌드에서만 온스크린 진단 정보를 표시한다
    /// (릴리즈 빌드에서는 자동으로 숨는다). saga-godot의
    /// renderer_debug_label.gd와 같은 정신에서 시작했지만, 44~49장이
    /// 나열한 전체 목록(FPS/Draw Calls/Visible Objects/Enemy Count/
    /// NPC Count/Memory/Player Position/Current Quest/Player Level/
    /// Current Zone) 중 **Player Level·Current Quest·Player Position**
    /// 셋을 2026-09-14에 추가했다 — GO에 이미 있는 시스템(`PlayerStats`·
    /// `QuestState`)에 그대로 얹을 수 있는 항목만 골랐다. 나머지는 여전히
    /// 안 넣는다: Draw Calls/Visible Objects/Memory는 문서 자체가 대안으로
    /// 제시한 Unity Profiler API 몫(온스크린 라벨로 값을 뽑는 공식 API가
    /// 따로 없다), Enemy/NPC Count·Current Zone은 GO에 대응하는 시스템이
    /// 없다(사건은 상주 리스트가 아니라 트리거식 1회성 — `BanditEncounter.
    /// cs` 등, 맵도 이름 붙은 지역 구분이 아직 없다 — `TestMapData.cs`).
    /// </summary>
    // 이름 주의 — "DebugOverlay"는 UnityEngine.Rendering.DebugOverlay와
    // 겹쳐 컴파일 에러(CS0104)가 난다. DebugHud로 피했다.
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
            label.text = $"renderer: {rendererName}\n{_fps:F0} fps\n" +
                $"lv {PlayerStats.Level} · quest: {QuestLabel()}\n" +
                $"pos: {pos}";
        }

        private static string QuestLabel() => QuestState.BanditQuest switch
        {
            QuestStage.Active => "도적 소탕 진행 중",
            QuestStage.Completed => "도적 소탕 완료",
            _ => "-",
        };
    }
}
