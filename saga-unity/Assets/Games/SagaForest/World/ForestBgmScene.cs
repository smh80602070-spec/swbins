using UnityEngine;
using Saga.Core;
using Saga.Forest.UI;

namespace Saga.Forest.World
{
    /// <summary>
    /// FOREST 배경음 장면(tasks U-0021) — 적대 조우 창이 떠 있으면 `battle`, 마을(존 −1)이면 `town`, 바깥 존이면 `field`.
    /// `ForestBootstrap` 이 시작 때 붙인다.
    /// </summary>
    public static class ForestBgmScene
    {
        public static void Attach(GameObject go) => BgmSceneDriver.Attach(go, Pick);

        public static string Pick()
        {
            var encounter = ForestHostileEncounterUi.Instance;
            if (encounter != null && encounter.IsActive) return BgmSceneDriver.Battle;
            var tracker = ForestZoneTracker.Instance;
            return tracker != null && tracker.CurrentZone >= 0 ? "field" : "town";
        }
    }
}
