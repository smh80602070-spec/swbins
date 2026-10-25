using Saga.Dungeon.Data;
using Saga.Dungeon.UI;
using UnityEngine;

namespace Saga.Dungeon.World
{
    /// <summary>
    /// tasks U-0228 ② 현상금 상자(웹 W-0428 · 디아블로 3 모험 모드 현상금 상자) — 판 도중 셋을 다 채우면 `DungeonFloorRunner` 가 계단 곁에 세운다.
    /// 곁 2m 로 오면 열림 → `DungeonBounty.ClaimChest`(현상금 하나 덤 × 급 × 2). 안 열고 내려가면 판 끝(`DungeonBounty.Finish`)이 대신 준다.
    /// </summary>
    public class DungeonBountyChest : MonoBehaviour
    {
        public const float OpenR = 2f;
        private Transform _player;

        private void Update()
        {
            if (_player == null) { var g = GameObject.FindWithTag("Player"); if (g == null) return; _player = g.transform; }
            TryOpen(_player.position);
        }

        /// <summary>그 자리에서 열 수 있으면 연다 — 연 금(못 열면 0, 진단도 부른다).</summary>
        public int TryOpen(Vector3 player)
        {
            if (new Vector2(player.x - transform.position.x, player.z - transform.position.z).magnitude > OpenR) return 0;
            int g = DungeonBounty.ClaimChest();
            if (g > 0) DialogueLabel.Instance?.Show(string.Format(DungeonLocalization.T("bounty.chest_open", "📦 현상금 상자 — 금 +{0}"), g), 3.5f);
            Destroy(gameObject);
            return g;
        }
    }
}
