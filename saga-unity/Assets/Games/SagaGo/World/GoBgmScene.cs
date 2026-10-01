using UnityEngine;
using Saga.Core;
using Saga.Go.Combat;
using Saga.Go.Data;

namespace Saga.Go.World
{
    /// <summary>
    /// GO 배경음 장면(tasks U-0014·U-0021) — 들판 싸움이 붙으면 `battle`, 마을 들판(`village` 지역)이면 `town`, 그 밖은 `field`.
    /// 곡 파일(`Resources/Audio/Bgm/go-<장면>.ogg`)이 없는 장면은 `Bgm` 이 폴백 곡 그대로 둔다. `GameBootstrap` 이 시작 때 붙인다.
    /// </summary>
    public static class GoBgmScene
    {
        public static void Attach(GameObject go) => BgmSceneDriver.Attach(go, Pick);

        public static string Pick()
        {
            var fc = FieldCombat.Instance;
            if (fc == null) return null;
            if (fc.InCombat()) return BgmSceneDriver.Battle;
            return GoWorldMap.RegionAt(fc.transform.position) == "village" ? "town" : "field";
        }
    }
}
