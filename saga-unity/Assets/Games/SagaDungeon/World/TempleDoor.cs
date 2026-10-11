using System.Collections;
using UnityEngine;
using Saga.Dungeon.Audio;
using Saga.Dungeon.Data;
using Saga.Dungeon.UI;

namespace Saga.Dungeon.World
{
    public enum TempleDoorKind
    {
        SmallKey,
        BossKey,
    }

    /// <summary>
    /// PLAN.md 106-2 "잊힌 능묘" 잠긴 문 — 복도 한가운데를 막는 나무 문짝(폭 4m =
    /// `DungeonCorridorBuilder.DoorWidth`). 열쇠를 가지고 다가가면 하나를 쓰고 바닥으로
    /// 가라앉는다. 없으면 무엇이 필요한지 한 번 알려 준다(다가갈 때마다 한 번).
    /// 보스 문은 금빛 자물쇠·쇠 띠로 구분한다.
    /// </summary>
    public class TempleDoor : MonoBehaviour
    {
        private const float OpenRadius = 2.6f;
        private const float SinkSec = 0.8f;
        private const float DoorHeight = 3.6f;
        private const float DoorWidth = 4f;

        [SerializeField] private TempleDoorKind kind;
        [SerializeField] private TempleFlag openedFlag;
        [SerializeField] private Material woodMaterial;
        [SerializeField] private Material metalMaterial;

        private Transform _slab;
        private Transform _player;
        private bool _opened;
        private bool _wasNear;

        public bool IsOpened => _opened;
        public TempleDoorKind Kind => kind;

        private void Awake()
        {
            if (transform.childCount == 0) Build();
            else _slab = transform.Find("Slab");
            var playerGo = GameObject.FindWithTag("Player");
            _player = playerGo != null ? playerGo.transform : null;
        }

        private void OnEnable() => TempleState.Changed += ApplyState;
        private void OnDisable() => TempleState.Changed -= ApplyState;
        private void Start() => ApplyState();

        public void Build()
        {
            var wood = woodMaterial != null ? woodMaterial : TempleVisuals.Solid(TempleVisuals.WoodColor);
            var metal = metalMaterial != null ? metalMaterial : TempleVisuals.Solid(TempleVisuals.IronColor, 0.8f, 0.45f);
            var lockMat = kind == TempleDoorKind.BossKey
                ? TempleVisuals.Solid(TempleVisuals.GoldColor, 0.9f, 0.6f)
                : metal;

            _slab = new GameObject("Slab").transform;
            _slab.SetParent(transform, false);
            TempleVisuals.Box(_slab, "Door", new Vector3(0f, DoorHeight * 0.5f, 0f), new Vector3(DoorWidth, DoorHeight, 0.4f), wood);
            for (int i = 0; i < 3; i++)
            {
                float y = 0.6f + i * 1.2f;
                TempleVisuals.Box(_slab, $"Band_{i}", new Vector3(0f, y, 0f), new Vector3(DoorWidth + 0.02f, 0.14f, 0.46f), metal, collider: false);
            }
            float lockSize = kind == TempleDoorKind.BossKey ? 0.7f : 0.4f;
            TempleVisuals.Box(_slab, "LockFront", new Vector3(0f, 1.6f, 0.26f), new Vector3(lockSize, lockSize, 0.14f), lockMat, collider: false);
            TempleVisuals.Box(_slab, "LockBack", new Vector3(0f, 1.6f, -0.26f), new Vector3(lockSize, lockSize, 0.14f), lockMat, collider: false);
        }

        private void Update() => Tick();

        public void Tick()
        {
            if (_opened || _player == null) return;
            bool near = TempleVisuals.FlatDistance(transform.position, _player.position) <= OpenRadius;
            if (near && !_wasNear) TryOpen();
            _wasNear = near;
        }

        private void TryOpen()
        {
            bool ok = kind == TempleDoorKind.SmallKey ? TempleState.TryUseSmallKey() : TempleState.HasBossKey;
            if (!ok)
            {
                string need = kind == TempleDoorKind.SmallKey
                    ? DungeonLocalization.T("temple.door_need_key", "🔒 잠겨 있다 — 작은 열쇠가 필요하다")
                    : DungeonLocalization.T("temple.door_need_boss_key", "🔒 금빛 자물쇠 — 보스 열쇠가 필요하다");
                DialogueLabel.Instance?.Show(need, 3f);
                return;
            }
            _opened = true;
            TempleState.Set(openedFlag);
            SfxPlayer.Play("door_open"); // tasks U-0104
            DialogueLabel.Instance?.Show(kind == TempleDoorKind.SmallKey
                ? DungeonLocalization.T("temple.door_opened", "철컥 — 문이 열렸다")
                : DungeonLocalization.T("temple.boss_door_opened", "철컥 — 무거운 문이 열렸다. 능묘지기가 기다린다"), 3.5f);
            StartCoroutine(Sink());
        }

        private void ApplyState()
        {
            if (_opened || !TempleState.Has(openedFlag)) return;
            _opened = true;
            if (_slab != null) _slab.gameObject.SetActive(false);
        }

        private IEnumerator Sink()
        {
            Vector3 start = _slab.localPosition;
            float t = 0f;
            while (t < SinkSec)
            {
                t += Time.deltaTime;
                _slab.localPosition = start + Vector3.down * (DoorHeight * Mathf.SmoothStep(0f, 1f, t / SinkSec));
                yield return null;
            }
            _slab.gameObject.SetActive(false);
        }
    }
}
