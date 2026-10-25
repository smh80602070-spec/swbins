using Saga.Dungeon.Data;
using UnityEngine;

namespace Saga.Dungeon.World
{
    /// <summary>
    /// tasks U-0228 ① 저주받은 상자 런타임 — 방 가운데 상자(검붉은 상자 + 보랏빛 뚜껑) · 바닥에 9m 고리(붉은 말뚝 24개, 코드 도형·충돌 없음).
    /// 곁 3m → 열림 → 6초마다 상자 둘레에 적 둘(층 달리기의 잡졸 길 — `DungeonFloorRunner.SpawnWaveGrunt`) × 4 → 24초 고리 안이면 성공.
    /// 방이 바뀌면 방 내용과 함께 지워진다(실패도 성공도 아님). 상태는 진단이 <see cref="Step"/> 으로 직접 민다.
    /// </summary>
    public class DungeonCursedChestRunner : MonoBehaviour
    {
        public enum Phase { Waiting, Active, Won, Lost }

        public Phase State { get; private set; } = Phase.Waiting;
        public int Spawned { get; private set; }
        public int RewardGold { get; private set; }
        public float T { get; private set; }

        private int _floor, _eliteGold;
        private DungeonFloorRunner _runner;
        private Transform _player, _lid;
        private int _waves;
        private bool _died;

        public void Init(DungeonFloorRunner runner, int floor, int eliteGold)
        {
            _runner = runner; _floor = floor; _eliteGold = eliteGold;
            Build();
            HeroState.Died += OnDied;
        }

        private void OnDestroy() => HeroState.Died -= OnDied;
        private void OnDied(int _) { if (State == Phase.Active) _died = true; }

        private void Update()
        {
            if (_player == null) { var g = GameObject.FindWithTag("Player"); if (g == null) return; _player = g.transform; }
            Step(Time.deltaTime, _player.position);
        }

        /// <summary>한 프레임(진단은 시간·자리를 넘겨 직접 부른다).</summary>
        public void Step(float dt, Vector3 player)
        {
            float d = new Vector2(player.x - transform.position.x, player.z - transform.position.z).magnitude;
            switch (State)
            {
                case Phase.Waiting:
                    if (d <= DungeonCursedChest.OpenR) Open();
                    break;
                case Phase.Active:
                    T += dt;
                    int want = DungeonCursedChest.WavesBy(T);
                    while (_waves < want) SpawnWave(_waves++);
                    if (_died || d > DungeonCursedChest.RingR) { Lose(); break; }
                    if (T >= DungeonCursedChest.LastSec) Win();
                    break;
            }
        }

        private void Open()
        {
            State = Phase.Active; T = 0f; _waves = 0; _died = false;
            if (_lid != null) _lid.localRotation = Quaternion.Euler(-60f, 0f, 0f);
            Saga.Dungeon.UI.DialogueLabel.Instance?.Show(DungeonLocalization.T("cursed.open", "☠ 저주받은 상자가 열렸다 — 붉은 고리 안에서 24초 버텨라"), 4f);
            SpawnWave(_waves++);
        }

        private void SpawnWave(int w)
        {
            if (_runner == null) return;
            for (int i = 0; i < DungeonCursedChest.PerWave; i++)
            {
                float a = (w * 97f + i * 180f) * Mathf.Deg2Rad;
                var world = transform.position + new Vector3(Mathf.Sin(a), 0f, Mathf.Cos(a)) * 4f;
                if (_runner.SpawnWaveGrunt(world) != null) Spawned++;
            }
        }

        private void Win()
        {
            State = Phase.Won;
            RewardGold = DungeonCursedChest.Reward(_floor, _eliteGold);
            HeroState.AddGold(RewardGold);
            Saga.Dungeon.UI.DialogueLabel.Instance?.Show(string.Format(DungeonLocalization.T("cursed.win", "☠ 저주를 풀었다 — 금 +{0}"), RewardGold), 4f);
            ClearRing();
        }

        private void Lose()
        {
            State = Phase.Lost;
            Saga.Dungeon.UI.DialogueLabel.Instance?.Show(DungeonLocalization.T("cursed.lose", "☠ 고리를 벗어났다 — 저주받은 상자가 사라졌다"), 3f);
            ClearRing();
            foreach (Transform c in transform) c.gameObject.SetActive(false);
        }

        private void ClearRing()
        {
            var ring = transform.Find("Ring");
            if (ring != null) ring.gameObject.SetActive(false);
        }

        private void Build()
        {
            var body = Prim(PrimitiveType.Cube, transform, "Body", new Vector3(0f, 0.45f, 0f), new Vector3(1.2f, 0.9f, 0.85f), new Color(0.28f, 0.08f, 0.1f));
            var hinge = new GameObject("LidHinge").transform;
            hinge.SetParent(transform, false);
            hinge.localPosition = new Vector3(0f, 0.9f, -0.42f);
            _lid = hinge;
            Prim(PrimitiveType.Cube, hinge, "Lid", new Vector3(0f, 0.12f, 0.42f), new Vector3(1.25f, 0.24f, 0.88f), new Color(0.45f, 0.12f, 0.55f));
            var ring = new GameObject("Ring").transform;
            ring.SetParent(transform, false);
            for (int i = 0; i < 24; i++)
            {
                float a = i * Mathf.PI * 2f / 24f;
                Prim(PrimitiveType.Cube, ring, "Post_" + i, new Vector3(Mathf.Sin(a), 0f, Mathf.Cos(a)) * DungeonCursedChest.RingR + Vector3.up * 0.15f, new Vector3(0.18f, 0.3f, 0.18f), new Color(0.8f, 0.1f, 0.12f));
            }
        }

        private static GameObject Prim(PrimitiveType t, Transform parent, string name, Vector3 local, Vector3 scale, Color c)
        {
            var go = GameObject.CreatePrimitive(t);
            go.name = name;
            var col = go.GetComponent<Collider>();
            if (col != null) Destroy(col);
            go.transform.SetParent(parent, false);
            go.transform.localPosition = local;
            go.transform.localScale = scale;
            var m = new Material(Shader.Find("Universal Render Pipeline/Lit")) { name = name + " (generated)", color = c };
            go.GetComponent<MeshRenderer>().sharedMaterial = m;
            return go;
        }
    }
}
