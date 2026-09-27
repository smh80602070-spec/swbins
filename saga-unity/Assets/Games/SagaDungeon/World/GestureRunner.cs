using UnityEngine;
using Saga.Dungeon.Data;

namespace Saga.Dungeon.World
{
    /// <summary>
    /// PLAN.md 109-10-7 몸짓 묶음(웹 `gesture.js` bind) — Play 때 한 번 설치(씬 재빌드 없음).
    /// 사건 → <see cref="GestureState"/>: 레벨업·두목급 처치 → 동행 환호. 선두 대기술(회전베기)은 `PlayerCombat` 이, 행상 볼일은 `DungeonMerchant` 가 곧장 부른다.
    /// 씬에 구운 촌민(컴포넌트 없는 "Villager")엔 여기서 <see cref="Gesturer"/> 를 붙인다 — 행상 주인·시대 손님·동행은 제 코드가 붙인다.
    /// </summary>
    public class GestureRunner : MonoBehaviour
    {
        public static GestureRunner Instance { get; private set; }

        /// <summary>진단 — 붙인 촌민 수.</summary>
        public int Villagers { get; private set; }

        public static void Install()
        {
            if (Instance != null) return;
            GestureState.Reset();
            new GameObject("GestureRunner").AddComponent<GestureRunner>();
        }

        private void Awake()
        {
            Instance = this;
            HeroState.LeveledUp += OnLeveledUp;
            DungeonEnemy.AnyDied += OnEnemyDied;
            // 이름으로 찾는다 — 리깅 몸이 없는 PC(폴백 몸)의 촌민은 NpcIdle 도 없다(`BuildTestDungeonScene.BuildVillager`).
            foreach (var t in Object.FindObjectsByType<Transform>(FindObjectsSortMode.None))
            {
                if (t.name != "Villager" || t.GetComponent<Gesturer>() != null) continue;
                Gesturer.Attach(t.gameObject, Gesturer.NpcKey("villager", t.position), npc: true);
                Villagers++;
            }
        }

        private void OnDestroy()
        {
            HeroState.LeveledUp -= OnLeveledUp;
            DungeonEnemy.AnyDied -= OnEnemyDied;
            if (Instance == this) Instance = null;
        }

        private void OnLeveledUp(int level) => GestureState.OnLevelUp(GestureState.Now);

        private void OnEnemyDied(DungeonEnemy e)
        {
            if (e == null) return;
            GestureState.OnKill(e.IsBoss || e.IsWorldBoss, GestureState.Now);
        }
    }
}
