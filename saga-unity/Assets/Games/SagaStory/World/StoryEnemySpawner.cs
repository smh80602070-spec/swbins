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

        // ── tasks U-0230 되살기·사냥터 엘리트(Play 때만) ──
        public static StoryEnemySpawner Instance { get; private set; }
        private readonly System.Collections.Generic.List<(int index, float at)> _respawn = new System.Collections.Generic.List<(int, float)>();
        public int PendingRespawns => _respawn.Count;
        /// <summary>진단 — 되살기 대기열을 비운다.</summary>
        public void ClearRespawnForTest() => _respawn.Clear();
        private Transform _player;

        private void Start()
        {
            if (!Application.isPlaying) return;
            Instance = this;
            int i = 0;
            foreach (Transform c in transform)
            {
                var e = c.GetComponent<StoryEnemy>();
                if (e != null && !e.IsBoss && e.FieldIndex < 0) e.FieldIndex = i++;
            }
            StoryEnemy.FieldDied += OnFieldDied;
            if (GetComponent<StoryRuneSpot>() == null) gameObject.AddComponent<StoryRuneSpot>();
        }

        private void OnDestroy() { StoryEnemy.FieldDied -= OnFieldDied; if (Instance == this) Instance = null; }

        private void OnFieldDied(StoryEnemy e)
        {
            if (e.FieldIndex >= 0 && !e.IsEliteBoss && StoryElite.RespawnOn) _respawn.Add((e.FieldIndex, Time.time));
            switch (StoryElite.OnFieldKill(e.IsElite, e.IsEliteBoss))
            {
                case StoryElite.Event.Elite: PromoteElite(); break;
                case StoryElite.Event.Boss: SpawnEliteBoss(); break;
            }
        }

        private void Update()
        {
            if (!Application.isPlaying) return;
            if (_player == null) { var g = GameObject.FindWithTag("Player"); if (g != null) _player = g.transform; }
            TickRespawn(Time.time, _player != null ? _player.position.x : float.MaxValue);
        }

        /// <summary>되살기 차례 — 30초 지났고 플레이어가 그 자리에서 15m 넘게 떨어진 것만(진단도 부른다). 되살린 수.</summary>
        public int TickRespawn(float now, float playerX)
        {
            var xs = FieldMapData.EnemyPositionsM();
            int n = 0;
            for (int k = _respawn.Count - 1; k >= 0; k--)
            {
                var (idx, at) = _respawn[k];
                if (now - at < StoryElite.RespawnSec) continue;
                if (Mathf.Abs(transform.TransformPoint(new Vector3(xs[idx], 0f, 0f)).x - playerX) < StoryElite.RespawnFar) continue;
                _respawn.RemoveAt(k);
                if (SpawnAt(idx) != null) n++;
            }
            return n;
        }

        /// <summary>엘리트 하나 — 살아 있는 들판 잡졸 중 플레이어에게 가장 가까운 것을 키운다(띠·화면 어둡게는 StoryRuneSpot 의 덧칠이 함께).</summary>
        public StoryEnemy PromoteElite()
        {
            StoryEnemy best = null; float bd = float.MaxValue;
            float px = _player != null ? _player.position.x : 0f;
            foreach (var e in GetComponentsInChildren<StoryEnemy>())
            {
                if (e.IsDead || e.IsBoss || e.IsElite || e.FieldIndex < 0) continue;
                float d = Mathf.Abs(e.transform.position.x - px);
                if (d < bd) { bd = d; best = e; }
            }
            if (best == null) return null;
            best.MakeElite(false);
            StoryRuneSpot.Flash(StoryLocalization.T("elite.spawn", "⚠ 엘리트가 나타났다 — 처치하면 경험치 ×10"));
            return best;
        }

        /// <summary>엘리트 두목 — 들판 가운데 자리에 새로 세워 키우고 60초 뒤 사라지게.</summary>
        public StoryEnemy SpawnEliteBoss()
        {
            int mid = FieldMapData.EnemyPositionsM().Length / 2;
            var e = SpawnAt(mid);
            if (e == null) return null;
            e.FieldIndex = -1; // 되살기 자리 아님
            e.MakeElite(true);
            Destroy(e.gameObject, StoryElite.BossLifeSec);
            StoryRuneSpot.Flash(StoryLocalization.T("elite.boss", "☠ 엘리트 두목이 나타났다 — 60초 안에!"));
            return e;
        }

        public void Build()
        {
            var xs = FieldMapData.EnemyPositionsM();
            for (int i = 0; i < xs.Length; i++) SpawnAt(i);
            BuildBoss();
        }

        /// <summary>들판 i 번째 자리 잡졸 하나(Build·tasks U-0230 되살기 공용). 꺼 둔 채 만들어 몸·시대를 넣은 뒤 켠다 — `StoryEnemy.Awake` 가 몸을 지을 때 모델이 있게.</summary>
        public StoryEnemy SpawnAt(int i)
        {
            var xs = FieldMapData.EnemyPositionsM();
            if (i < 0 || i >= xs.Length) return null;
            {
                var go = new GameObject("Enemy_HwangGeon");
                go.SetActive(false);
                go.transform.SetParent(transform, false);
                go.transform.localPosition = new Vector3(xs[i], GroundY, 0f);
                var enemy = go.AddComponent<StoryEnemy>();
                enemy.FieldIndex = i;
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
                go.SetActive(true);
                return enemy;
            }
        }

        private void BuildBoss()
        {
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
