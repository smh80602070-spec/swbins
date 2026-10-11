using System.Collections;
using UnityEngine;
using Saga.Dungeon.Audio;
using Saga.Dungeon.Cinematics;
using Saga.Dungeon.Data;
using Saga.Dungeon.UI;

namespace Saga.Dungeon.World
{
    public enum TempleChestContent
    {
        SmallKey,
        Bombs,
        BossKey,
        Treasure,   // PLAN.md 106-5 — 높은 곳 보상(돈·경험치, `treasureGold`·`treasureExp`)
    }

    /// <summary>
    /// PLAN.md 106-2 "잊힌 능묘" 상자 — 조건(방의 적 전멸·진행 비트)이 맞으면 나타나고,
    /// 가까이 가면 뚜껑이 열리며 얻은 것이 머리 위로 떠오른다(젤다 "아이템 획득"). 여는 순간
    /// 상자 컷(PLAN.md 106-3 — 옆으로 비껴 선 카메라가 아이템 쪽으로 다가간다)이 돈다. 열림은 `openedFlag` 로 저장되고, 벽력탄·보스 열쇠는
    /// 그 비트 자체가 "가지고 있다"는 뜻이다(`TempleState.HasBombs`·`HasBossKey`).
    /// DUNGEON 은 상호작용 키 없이 근접 판정이 관례라(`DungeonTrove`·`DungeonPuzzle`) 그대로 따른다.
    /// </summary>
    public class TempleChest : MonoBehaviour
    {
        private const float OpenRadius = 1.9f;
        /// <summary>106-5 — 높이 차가 이보다 크면 안 열린다(탑 꼭대기 상자를 밑에서 못 열게).</summary>
        private const float OpenHeight = 1.5f;
        private const float LidOpenSec = 0.35f;
        private const float LidOpenDeg = -110f;
        private const float ItemRiseSec = 1.0f;
        private const float PopInSec = 0.3f;
        private const float ToastSec = 5f;

        [SerializeField] private TempleChestContent content;
        [SerializeField] private TempleFlag openedFlag;
        [SerializeField] private string revealRoomId;
        [SerializeField] private TempleFlag revealFlag;
        [SerializeField] private bool big;
        [SerializeField] private Material woodMaterial;
        [SerializeField] private Material metalMaterial;
        [SerializeField] private int treasureGold;
        [SerializeField] private int treasureExp;

        private Transform _visualRoot;
        private Transform _lidPivot;
        private Transform _item;
        private Transform _player;
        private bool _revealed;
        private bool _opened;

        public bool IsRevealed => _revealed;
        public bool IsOpened => _opened;
        public TempleChestContent Content => content;

        private void Awake()
        {
            if (transform.childCount == 0) Build();
            else Bind();
            var playerGo = GameObject.FindWithTag("Player");
            _player = playerGo != null ? playerGo.transform : null;
        }

        private void OnEnable() => TempleState.Changed += ApplyState;
        private void OnDisable() => TempleState.Changed -= ApplyState;

        private void Start()
        {
            ApplyState();
            if (!_opened)
            {
                _revealed = RevealConditionMet();
                _visualRoot.gameObject.SetActive(_revealed);
            }
        }

        /// <summary>편집기 빌드가 부른다(씬에 부품이 저장된다). Awake 는 자식이 없을 때만.</summary>
        public void Build()
        {
            float s = big ? 1.35f : 1f;
            Vector3 body = new Vector3(1.2f, 0.7f, 0.8f) * s;
            var wood = woodMaterial != null ? woodMaterial : TempleVisuals.Solid(TempleVisuals.WoodColor);
            var metal = metalMaterial != null ? metalMaterial : TempleVisuals.Solid(TempleVisuals.IronColor, 0.8f, 0.45f);
            var trim = big ? TempleVisuals.Solid(TempleVisuals.GoldColor, 0.9f, 0.6f) : metal;

            _visualRoot = new GameObject("Visual").transform;
            _visualRoot.SetParent(transform, false);

            TempleVisuals.Box(_visualRoot, "Base", new Vector3(0f, body.y * 0.5f, 0f), body, wood);
            TempleVisuals.Box(_visualRoot, "BandL", new Vector3(-body.x * 0.32f, body.y * 0.5f, 0f),
                new Vector3(0.08f * s, body.y + 0.02f, body.z + 0.03f), trim, collider: false);
            TempleVisuals.Box(_visualRoot, "BandR", new Vector3(body.x * 0.32f, body.y * 0.5f, 0f),
                new Vector3(0.08f * s, body.y + 0.02f, body.z + 0.03f), trim, collider: false);

            _lidPivot = new GameObject("LidPivot").transform;
            _lidPivot.SetParent(_visualRoot, false);
            _lidPivot.localPosition = new Vector3(0f, body.y, -body.z * 0.5f);
            TempleVisuals.Box(_lidPivot, "Lid", new Vector3(0f, 0.11f * s, body.z * 0.5f),
                new Vector3(body.x + 0.04f, 0.22f * s, body.z + 0.04f), wood, collider: false);
            TempleVisuals.Box(_lidPivot, "Lock", new Vector3(0f, 0f, body.z + 0.03f),
                new Vector3(0.16f, 0.2f, 0.06f) * s, trim, collider: false);

            _item = BuildItem(_visualRoot, body.y).transform;
            _item.gameObject.SetActive(false);
        }

        private GameObject BuildItem(Transform parent, float bodyHeight)
        {
            var root = new GameObject("Item");
            root.transform.SetParent(parent, false);
            root.transform.localPosition = new Vector3(0f, bodyHeight + 0.3f, 0f);
            var glow = TempleVisuals.Glow(content == TempleChestContent.Bombs
                ? new Color(1f, 0.45f, 0.15f) : TempleVisuals.GoldColor);
            if (content == TempleChestContent.Treasure)
            {
                // 금화 더미 — 납작한 원기둥 셋
                for (int i = 0; i < 3; i++)
                    TempleVisuals.Primitive(PrimitiveType.Cylinder, root.transform, "Coin", new Vector3((i - 1) * 0.14f, i * 0.05f, 0f),
                        new Vector3(0.22f, 0.025f, 0.22f), glow, collider: false);
                return root;
            }
            if (content == TempleChestContent.Bombs)
            {
                TempleVisuals.Primitive(PrimitiveType.Sphere, root.transform, "Bomb", Vector3.zero, Vector3.one * 0.4f,
                    TempleVisuals.Solid(new Color(0.12f, 0.12f, 0.14f), 0.6f, 0.5f), collider: false);
                TempleVisuals.Box(root.transform, "Fuse", new Vector3(0f, 0.25f, 0f), new Vector3(0.05f, 0.14f, 0.05f), glow, collider: false);
            }
            else
            {
                float k = content == TempleChestContent.BossKey ? 1.6f : 1f;
                TempleVisuals.Primitive(PrimitiveType.Cylinder, root.transform, "Bow", new Vector3(0f, 0.16f * k, 0f),
                    new Vector3(0.22f, 0.02f, 0.22f) * k, glow, collider: false).localRotation = Quaternion.Euler(90f, 0f, 0f);
                TempleVisuals.Box(root.transform, "Shaft", new Vector3(0f, -0.05f * k, 0f), new Vector3(0.05f, 0.32f, 0.05f) * k, glow, collider: false);
                TempleVisuals.Box(root.transform, "Bit", new Vector3(0.06f * k, -0.17f * k, 0f), new Vector3(0.1f, 0.05f, 0.05f) * k, glow, collider: false);
            }
            return root;
        }

        private void Bind()
        {
            _visualRoot = transform.Find("Visual");
            _lidPivot = _visualRoot != null ? _visualRoot.Find("LidPivot") : null;
            _item = _visualRoot != null ? _visualRoot.Find("Item") : null;
        }

        private void Update() => Tick();

        /// <summary>한 프레임 판정 — 헤드리스 진단도 직접 부른다.</summary>
        public void Tick()
        {
            if (_opened) return;
            if (!_revealed && RevealConditionMet())
            {
                _revealed = true;
                _visualRoot.gameObject.SetActive(true);
                StartCoroutine(PopIn());
                SfxPlayer.Play("ui_notify"); // tasks U-0104 — 상자가 나타남(여는 소리는 아래 chest_open).
                DialogueLabel.Instance?.Show(DungeonLocalization.T("temple.chest_appeared", "✨ 어디선가 상자가 나타났다"), 3f);
            }
            if (!_revealed || _player == null) return;
            if (TempleVisuals.FlatDistance(transform.position, _player.position) <= OpenRadius * (big ? 1.25f : 1f)
                && Mathf.Abs(_player.position.y - transform.position.y) <= OpenHeight)
            {
                Open();
            }
        }

        private bool RevealConditionMet()
        {
            if (revealFlag != TempleFlag.None && !TempleState.Has(revealFlag)) return false;
            if (!string.IsNullOrEmpty(revealRoomId) && DungeonEnemy.CountAliveInRoom(revealRoomId) > 0) return false;
            return true;
        }

        private void Open()
        {
            _opened = true;
            string msg;
            switch (content)
            {
                case TempleChestContent.SmallKey:
                    TempleState.AddSmallKey();
                    msg = DungeonLocalization.T("temple.got_small_key", "🗝 작은 열쇠를 얻었다! — 잠긴 문 하나를 연다");
                    break;
                case TempleChestContent.Treasure:
                    HeroState.AddGold(treasureGold);
                    HeroState.AddExp(treasureExp);
                    msg = string.Format(DungeonLocalization.T("temple.got_treasure", "💰 높은 곳의 보물 — 금 +{0} · 경험치 +{1}"), treasureGold, treasureExp);
                    break;
                case TempleChestContent.Bombs:
                    msg = DungeonLocalization.T("temple.got_bombs", "💣 벽력탄을 얻었다! — R·「벽력탄」 버튼으로 놓는다. 금 간 벽을 부술 수 있다");
                    break;
                default:
                    msg = DungeonLocalization.T("temple.got_boss_key", "🔑 보스 열쇠를 얻었다! — 능묘지기의 문을 연다");
                    break;
            }
            TempleState.Set(openedFlag);
            SfxPlayer.Play("chest_open"); // tasks U-0104 — 상자 열기.
            DialogueLabel.Instance?.Show(msg, ToastSec);
            StartCoroutine(OpenRoutine());
            if (_player != null)
            {
                var pc = _player.GetComponent<Player.PlayerController>();
                if (pc != null) pc.FaceToward(transform.position);
                float itemHeight = _item != null ? _item.localPosition.y : 1f;
                DungeonCutscenes.Instance?.PlayChest(transform.position, _player.position, itemHeight);
            }
        }

        /// <summary>진행 비트가 이미 서 있으면(세이브 로드) 연출 없이 열린 모습으로.</summary>
        private void ApplyState()
        {
            if (_opened || !TempleState.Has(openedFlag)) return;
            _opened = true;
            _revealed = true;
            if (_visualRoot != null) _visualRoot.gameObject.SetActive(true);
            if (_lidPivot != null) _lidPivot.localRotation = Quaternion.Euler(LidOpenDeg, 0f, 0f);
        }

        private IEnumerator PopIn()
        {
            float t = 0f;
            while (t < PopInSec)
            {
                t += Time.deltaTime;
                float k = Mathf.SmoothStep(0.2f, 1f, t / PopInSec);
                _visualRoot.localScale = Vector3.one * k;
                yield return null;
            }
            _visualRoot.localScale = Vector3.one;
        }

        private IEnumerator OpenRoutine()
        {
            float t = 0f;
            while (t < LidOpenSec)
            {
                t += Time.deltaTime;
                if (_lidPivot != null) _lidPivot.localRotation = Quaternion.Euler(LidOpenDeg * Mathf.Clamp01(t / LidOpenSec), 0f, 0f);
                yield return null;
            }
            if (_item == null) yield break;
            _item.gameObject.SetActive(true);
            Vector3 start = _item.localPosition;
            t = 0f;
            while (t < ItemRiseSec)
            {
                t += Time.deltaTime;
                float k = Mathf.Clamp01(t / ItemRiseSec);
                _item.localPosition = start + Vector3.up * (1.1f * Mathf.Sin(k * Mathf.PI * 0.5f));
                _item.localRotation = Quaternion.Euler(0f, k * 360f, 0f);
                yield return null;
            }
            yield return new WaitForSeconds(0.6f);
            _item.gameObject.SetActive(false);
        }
    }
}
