using UnityEngine;
using Saga.Core;

namespace Saga.Story.World
{
    /// <summary>
    /// STORY 배경음 장면(tasks U-0021) — 살아 있는 적이 <see cref="BattleRange"/> 안에 있으면 `battle`, 아니면 `field`.
    /// (STORY 는 마을 장면이 아직 없어 `story-town` 곡은 쓰지 않는다.) `GameBootstrap` 이 시작 때 붙인다.
    /// </summary>
    public static class StoryBgmScene
    {
        public const float BattleRange = 12f;

        public static void Attach(GameObject go) => BgmSceneDriver.Attach(go, Pick);

        public static string Pick()
        {
            var player = GameObject.FindWithTag("Player");
            if (player == null) return null;
            var p = player.transform.position;
            foreach (var e in StoryEnemy.All)
            {
                if (e == null || e.IsDead) continue;
                if ((e.transform.position - p).sqrMagnitude <= BattleRange * BattleRange) return BgmSceneDriver.Battle;
            }
            return "field";
        }
    }
}
