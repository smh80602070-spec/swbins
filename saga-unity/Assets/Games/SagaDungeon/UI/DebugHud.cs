using TMPro;
using UnityEngine;
using UnityEngine.InputSystem;
using UnityEngine.Rendering;
using UnityEngine.UI;
using Saga.Dungeon.Data;
using Saga.Dungeon.World;

namespace Saga.Dungeon.UI
{
    /// <summary>
    /// PLAN.md 44~49장 디버그 화면 — GO `UI/DebugHud.cs`와 같은 결(다섯 판
    /// 공용 로직 복사 관례, 루트 CLAUDE.md), DUNGEON엔 아직 없어 2026-09-14에
    /// 새로 만들었다. 문서가 나열한 전체 목록(FPS/Draw Calls/Visible
    /// Objects/Enemy Count/NPC Count/Memory/Player Position/Current Quest/
    /// Player Level/Current Zone) 중 DUNGEON에 이미 있는 시스템에 얹을 수
    /// 있는 것만 골랐다: Level=`HeroState.Level`, Current Quest=
    /// `QuestState.ObjectiveText`, Current Zone=`DungeonFloorRunner.
    /// CurrentFloor`(절차적 층 진행이 이 판의 "지역" 개념), Player Position.
    /// Enemy Count는 `DungeonEnemy.Active.Count`로 바로 된다(GO는 상주
    /// 리스트가 없어 못 넣었던 것과 다르다). Draw Calls/Visible Objects/
    /// Memory는 GO와 같은 이유(Unity Profiler 몫)로 안 넣는다.
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
            int floor = DungeonFloorRunner.Instance != null ? DungeonFloorRunner.Instance.CurrentFloor : 1;
            label.text = $"renderer: {rendererName}\n{_fps:F0} fps\n" +
                $"lv {HeroState.Level} · floor {floor} · enemies {DungeonEnemy.Active.Count}\n" +
                $"quest: {QuestState.ObjectiveText}\n" +
                $"pos: {pos}";
        }
    }
}
