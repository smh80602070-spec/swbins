using System.Collections;
using UnityEngine;
using Saga.Dungeon.Audio;
using Saga.Dungeon.Data;
using Saga.Dungeon.Player;
using Saga.Dungeon.UI;

namespace Saga.Dungeon.World
{
    /// <summary>
    /// PLAN.md 106-2 "잊힌 능묘" 벽력탄 방 퍼즐 — 돌 블록을 2m 칸 단위로 밀어 발판에 올린다
    /// (젤다 "블록 밀기" 문법). 블록 한 면에 붙어 그 방향으로 0.35초 계속 밀면 한 칸 미끄러진다.
    /// 벽·방 경계(방 중심 ±8m)에 막히면 안 움직인다. 벽에 붙여 못 빼게 돼도 방을
    /// 벗어나면(방 중심에서 14m) 제자리로 돌아온다. 이 컴포넌트는 방 중심에 두고
    /// 블록·발판은 자식 로컬 좌표로 잡는다(편집기 빌드가 방마다 값을 넣는다).
    /// </summary>
    public class TemplePushBlock : MonoBehaviour
    {
        public const float Cell = 2f;
        private const float BlockSize = 1.8f;
        private const float PushHoldSec = 0.35f;
        private const float SlideSec = 0.3f;
        private const float PlateSnapM = 0.6f;
        private const float PlayerRadius = 0.4f;
        private const float ContactSlack = 0.35f;
        private const float RoomHalfLimit = 8f;
        private const float ResetRadius = 14f;

        [SerializeField] private Vector3 blockStartLocal = new Vector3(-4f, 0f, -4f);
        [SerializeField] private Vector3 plateLocal = new Vector3(4f, 0f, -4f);
        [SerializeField] private TempleFlag solvedFlag = TempleFlag.BlockSolved;
        [SerializeField] private Material stoneMaterial;
        [SerializeField] private Material metalMaterial;

        private Transform _block;
        private Transform _plate;
        private Transform _player;
        private PlayerController _playerController;
        private float _hold;
        private Vector3 _holdDir;
        private bool _sliding;
        private bool _solved;

        public bool IsSolved => _solved;
        public Vector3 BlockLocal => _block != null ? _block.localPosition : Vector3.zero;
        public Vector3 PlateLocal => plateLocal;

        private void Awake()
        {
            if (transform.childCount == 0) Build();
            else
            {
                _block = transform.Find("Block");
                _plate = transform.Find("Plate");
            }
            var playerGo = GameObject.FindWithTag("Player");
            _player = playerGo != null ? playerGo.transform : null;
            _playerController = playerGo != null ? playerGo.GetComponent<PlayerController>() : null;
        }

        private void OnEnable() => TempleState.Changed += ApplyState;
        private void OnDisable() => TempleState.Changed -= ApplyState;
        private void Start() => ApplyState();

        public void Build()
        {
            var stone = stoneMaterial != null ? stoneMaterial : TempleVisuals.Solid(TempleVisuals.StoneColor);
            var metal = metalMaterial != null ? metalMaterial : TempleVisuals.Solid(TempleVisuals.IronColor, 0.8f, 0.45f);
            _block = TempleVisuals.Box(transform, "Block", BlockCenter(blockStartLocal), Vector3.one * BlockSize, stone);
            // 블록 네 면 가운데 띠 — "밀 수 있는 것" 표시(젤다 블록의 무늬 자리).
            var mark = TempleVisuals.Solid(new Color(0.55f, 0.48f, 0.3f), 0.2f, 0.4f);
            TempleVisuals.Box(_block, "MarkX", Vector3.zero, new Vector3(1.02f, 0.12f, 0.6f), mark, collider: false);
            TempleVisuals.Box(_block, "MarkZ", Vector3.zero, new Vector3(0.6f, 0.12f, 1.02f), mark, collider: false);

            _plate = TempleVisuals.Primitive(PrimitiveType.Cylinder, transform, "Plate", plateLocal + new Vector3(0f, 0.04f, 0f),
                new Vector3(1.7f, 0.04f, 1.7f), metal, collider: false);
        }

        private static Vector3 BlockCenter(Vector3 floorLocal) => new Vector3(floorLocal.x, BlockSize * 0.5f, floorLocal.z);

        private void Update() => Tick(Time.deltaTime);

        /// <summary>한 프레임 판정 — 헤드리스 진단도 시간을 넣어 직접 부른다.</summary>
        public void Tick(float dt)
        {
            if (_solved || _sliding || _player == null || _block == null) return;

            if (TempleVisuals.FlatDistance(transform.position, _player.position) > ResetRadius)
            {
                if (TempleVisuals.FlatDistance(_block.localPosition, blockStartLocal) > 0.01f)
                    _block.localPosition = BlockCenter(blockStartLocal);
                _hold = 0f;
                return;
            }

            Vector3 d = _player.position - _block.position;
            float ax = Mathf.Abs(d.x), az = Mathf.Abs(d.z);
            float half = BlockSize * 0.5f;
            float reach = half + PlayerRadius + ContactSlack;
            Vector3 pushDir = Vector3.zero;
            if (ax >= az && ax <= reach && az < half * 0.9f) pushDir = new Vector3(-Mathf.Sign(d.x), 0f, 0f);
            else if (az > ax && az <= reach && ax < half * 0.9f) pushDir = new Vector3(0f, 0f, -Mathf.Sign(d.z));

            Vector3 intent = _playerController != null ? _playerController.MoveIntent : Vector3.zero;
            intent.y = 0f;
            bool pushing = pushDir != Vector3.zero && intent.sqrMagnitude > 0.01f
                && Vector3.Dot(intent.normalized, pushDir) > 0.7f;
            if (!pushing)
            {
                _hold = 0f;
                return;
            }
            if (pushDir != _holdDir) _hold = 0f;
            _holdDir = pushDir;
            _hold += dt;
            if (_hold < PushHoldSec) return;
            _hold = 0f;
            TryPush(pushDir);
        }

        /// <summary>한 칸 민다 — 막히면 false. <paramref name="instant"/>는 진단용(미끄러짐 없이 바로).</summary>
        public bool TryPush(Vector3 dir, bool instant = false)
        {
            if (_solved || _sliding || _block == null) return false;
            dir.y = 0f;
            dir = Mathf.Abs(dir.x) >= Mathf.Abs(dir.z) ? new Vector3(Mathf.Sign(dir.x), 0f, 0f) : new Vector3(0f, 0f, Mathf.Sign(dir.z));
            Vector3 targetLocal = _block.localPosition + dir * Cell;
            if (Mathf.Abs(targetLocal.x) > RoomHalfLimit || Mathf.Abs(targetLocal.z) > RoomHalfLimit) return false;

            Vector3 targetWorld = transform.TransformPoint(targetLocal);
            var selfCol = _block.GetComponent<Collider>();
            Physics.SyncTransforms(); // 밀 때만(드물다) — 방금 옮긴 것들까지 물리 쪽에 반영하고 겹침을 본다.
            foreach (var hit in Physics.OverlapBox(targetWorld, Vector3.one * (BlockSize * 0.47f), Quaternion.identity, ~0, QueryTriggerInteraction.Ignore))
            {
                if (hit == selfCol || hit.transform.IsChildOf(_block)) continue;
                if (_player != null && hit.transform.IsChildOf(_player)) continue;
                return false;
            }

            if (instant || !isActiveAndEnabled)
            {
                _block.localPosition = targetLocal;
                CheckPlate();
            }
            else
            {
                StartCoroutine(Slide(targetLocal));
            }
            SfxPlayer.Play("block"); // tasks U-0104 — 돌 블록 밀기.
            return true;
        }

        private IEnumerator Slide(Vector3 targetLocal)
        {
            _sliding = true;
            Vector3 start = _block.localPosition;
            float t = 0f;
            while (t < SlideSec)
            {
                t += Time.deltaTime;
                _block.localPosition = Vector3.Lerp(start, targetLocal, Mathf.SmoothStep(0f, 1f, t / SlideSec));
                yield return null;
            }
            _block.localPosition = targetLocal;
            _sliding = false;
            CheckPlate();
        }

        private void CheckPlate()
        {
            if (TempleVisuals.FlatDistance(_block.localPosition, plateLocal) > PlateSnapM) return;
            SetSolvedVisual();
            TempleState.Set(solvedFlag);
            SfxPlayer.Play("quest_done"); // tasks U-0104 — 발판 풀림.
            DialogueLabel.Instance?.Show(DungeonLocalization.T("temple.plate_pressed", "딸깍 — 발판이 눌렸다. 어딘가에서 소리가 났다"), 3.5f);
        }

        private void SetSolvedVisual()
        {
            _solved = true;
            if (_block != null) _block.localPosition = BlockCenter(plateLocal) + new Vector3(0f, -0.03f, 0f);
            if (_plate != null) _plate.GetComponent<MeshRenderer>().sharedMaterial = TempleVisuals.Glow(TempleVisuals.GoldColor);
        }

        private void ApplyState()
        {
            if (_solved || !TempleState.Has(solvedFlag)) return;
            SetSolvedVisual();
        }
    }
}
