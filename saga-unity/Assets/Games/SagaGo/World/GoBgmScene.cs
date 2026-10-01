using UnityEngine;
using Saga.Core;
using Saga.Go.Combat;

namespace Saga.Go.World
{
    /// <summary>
    /// GO 배경음 장면 전환(tasks U-0014) — 들판 싸움이 붙으면 `go-battle`, 아니면 `go-main` 곡으로 바꾼다(0.5초마다 본다).
    /// 곡 파일(`Resources/Audio/Bgm/go-battle.ogg`)이 없으면 `Bgm` 이 폴백 곡 그대로 두므로 아무 일도 안 일어난다.
    /// `GameBootstrap` 이 시작 때 붙인다(씬 재빌드 없음).
    /// </summary>
    public class GoBgmScene : MonoBehaviour
    {
        private const float PollSec = 0.5f;
        private float _wait;

        private void Update()
        {
            _wait -= Time.unscaledDeltaTime;
            if (_wait > 0f) return;
            _wait = PollSec;
            var fc = FieldCombat.Instance;
            Bgm.SetScene(fc != null && fc.InCombat() ? "battle" : "main");
        }
    }
}
