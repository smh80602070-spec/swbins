using UnityEngine;
using Saga.Dungeon.Audio;
using Saga.Dungeon.Cinematics;
using Saga.Dungeon.Data;
using Saga.Dungeon.UI;

namespace Saga.Dungeon.World
{
    /// <summary>
    /// PLAN.md 106-2 "잊힌 능묘" 입구 — 첫 발을 들이면 제목과 목표를 한 번 알리고
    /// `TempleFlag.Visited` 를 세운다(HUD 열쇠 줄이 이때부터 보인다). 제목은 도착 컷
    /// (PLAN.md 106-3, Timeline — 지역명 카드)이 맡고, 목표 토스트는 컷이 끝난 뒤에 띄운다.
    /// </summary>
    public class TempleEntrance : MonoBehaviour
    {
        private const float EnterRadius = 7f;

        private Transform _player;

        private void Awake()
        {
            var playerGo = GameObject.FindWithTag("Player");
            _player = playerGo != null ? playerGo.transform : null;
        }

        private void Update() => Tick();

        public void Tick()
        {
            if (_player == null || TempleState.Has(TempleFlag.Visited)) return;
            if (TempleVisuals.FlatDistance(transform.position, _player.position) > EnterRadius) return;
            TempleState.Set(TempleFlag.Visited);
            SfxPlayer.Play("door_open"); // tasks U-0104 — 사원 입구에 들어섬.
            var cuts = DungeonCutscenes.Instance;
            if (cuts == null || !cuts.PlayArrival(ShowGoal)) ShowGoal();
        }

        private static void ShowGoal()
        {
            DialogueLabel.Instance?.Show(DungeonLocalization.T("temple.enter",
                "작은 열쇠로 길을 열고, 보스 열쇠로 능묘지기에게 닿아라"), 5f);
        }
    }
}
