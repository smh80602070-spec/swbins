using UnityEngine;
using Saga.Core;

namespace Saga.Dungeon.World
{
    /// <summary>
    /// DUNGEON 배경음 장면(tasks U-0021) — 적이 달려들거나 전조 중이면 `battle`, 땅 위 지역(고정 지역 아홉)에 서 있으면 `town`,
    /// 지역 밖(던전 층·능묘·시련 방)이면 `field`. `GameBootstrap` 이 시작 때 붙인다.
    /// </summary>
    public static class DungeonBgmScene
    {
        public static void Attach(GameObject go) => BgmSceneDriver.Attach(go, Pick);

        public static string Pick()
        {
            foreach (var e in DungeonEnemy.Active)
                if (e != null && e.IsEngaged) return BgmSceneDriver.Battle;
            var tracker = DungeonRegionTracker.Instance;
            return tracker != null && tracker.Current >= 0 ? "town" : "field";
        }
    }
}
