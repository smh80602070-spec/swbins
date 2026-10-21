using UnityEngine;
using Saga.Story.Data;

namespace Saga.Story.World
{
    /// <summary>
    /// VERTICAL_SLICE_STORY.md 1절 — FieldMapData.EnemyPositionsM()의
    /// 고정 자리 열에 잡졸(StoryEnemy)을 하나씩 세운다. 원작
    /// spawnEnemy()의 무작위 리스폰은 "제외" 목록(day/파도 시스템 자체가
    /// 범위 밖)이라, 한 번 세우고 그걸로 끝. **"STORY 콘텐츠 확장"
    /// (2026-09-13)에서 두목(황건 두목, q_boss1) 하나를 들판 가장
    /// 안쪽에 더했다** — 다 잡으면 "첫 사냥"·"두목의 목" 두 사명이 남는다.
    /// </summary>
    public class StoryEnemySpawner : MonoBehaviour
    {
        private const float GroundY = 0f;

        [SerializeField] private GameObject enemyModelPrefab;
        // 44장 "Boss" 교체 — 비어 있으면 잡졸과 같은 모델을 쓴다(예전 동작).
        [SerializeField] private GameObject bossModelPrefab;
        [SerializeField] private float riggedVisualScale = 1f;
        [SerializeField] private float riggedBossVisualScale = 1f;
        // 2026-09-14 "사운드" — StoryEnemy.cs로 그대로 넘길 뿐, 여긴 안 쓴다.
        // PLAN.md 109-3 세 시대 — 시대 적 몸(`StoryEras.FoeBodies` 이름 순, 배율 = 1.6m × HeightMul / 몸 키). 없는 PC 는 null → 잡졸 몸에 이름·빛깔만.
        [SerializeField] private string[] eraFoeNames = new string[0];
        [SerializeField] private GameObject[] eraFoeModels = new GameObject[0];
        [SerializeField] private float[] eraFoeScales = new float[0];

        private void Awake()
        {
            if (transform.childCount > 0) return;
            Build();
        }

        public void Build()
        {
            var xs = FieldMapData.EnemyPositionsM();
            for (int i = 0; i < xs.Length; i++)
            {
                var go = new GameObject("Enemy_HwangGeon");
                go.transform.SetParent(transform, false);
                go.transform.localPosition = new Vector3(xs[i], GroundY, 0f);
                var enemy = go.AddComponent<StoryEnemy>();
                // 109-3 — 들판 열 자리 중 넷은 다른 시대 적(표에 박은 자리, 난수 없음).
                var era = StoryEras.FieldEra(i);
                GameObject model = enemyModelPrefab;
                float scale = riggedVisualScale;
                if (era != StoryEra.Past)
                {
                    var foe = StoryEras.FoeFor(0, era);
                    enemy.SetEra(foe);
                    int k = System.Array.IndexOf(eraFoeNames, foe.Body);
                    if (k >= 0 && k < eraFoeModels.Length && eraFoeModels[k] != null)
                    {
                        model = eraFoeModels[k];
                        scale = k < eraFoeScales.Length ? eraFoeScales[k] : 1f;
                    }
                }
                SetPrivateField(enemy, "modelPrefab", model);
                SetPrivateField(enemy, "riggedVisualScale", scale);
            }

            var bossGo = new GameObject("Boss_HwangGeon");
            bossGo.transform.SetParent(transform, false);
            bossGo.transform.localPosition = new Vector3(FieldMapData.BossPositionM(), GroundY, 0f);
            var boss = bossGo.AddComponent<StoryEnemy>();
            boss.SetBoss(true);
            SetPrivateField(boss, "modelPrefab", enemyModelPrefab);
            SetPrivateField(boss, "bossModelPrefab", bossModelPrefab);
            SetPrivateField(boss, "riggedBossVisualScale", riggedBossVisualScale);
        }

        private static void SetPrivateField(object target, string fieldName, object value)
        {
            var field = target.GetType().GetField(fieldName,
                System.Reflection.BindingFlags.NonPublic | System.Reflection.BindingFlags.Instance);
            field?.SetValue(target, value);
        }
    }
}
