using UnityEngine;
using UnityEngine.InputSystem;
using Saga.Dungeon.Cinematics;
using Saga.Dungeon.Data;
using Saga.Dungeon.UI;
using Saga.Dungeon.World;

namespace Saga.Dungeon.Player
{
    /// <summary>
    /// PLAN.md 106-6 "FF 확장" — 파티 명령·소환. 키 1 = 무사 "방패 도발", 2 = 술사 "치유의 빛", V = 소환 "바위 거신"
    /// (모바일은 "도발"·"치유"·"소환" 버튼). 게이지(`PartyState`)가 가득일 때만 먹고, 아니면 토스트로 까닭을 알린다.
    /// 컷 동안·등반 중엔 막힌다(공격 셋과 같은 결). 소환은 14m 안에 살아 있는 적이 있어야 한다(헛방 방지).
    /// </summary>
    public class PartyCommands : MonoBehaviour
    {
        [SerializeField] private GameObject summonPrefab;
        // PLAN.md 106-6 남은 것 "소환수 전용 모델" — 바위 거신 몸(CC0 바위 둘 + PolyHaven 돌 재질). 씬 빌더가 채운다.
        [SerializeField] private GameObject summonRockLarge;
        [SerializeField] private GameObject summonRockSmall;
        [SerializeField] private Material summonStone;

        private PlayerController _controller;

        public PartySummon LastSummon { get; private set; }

        private void Awake()
        {
            _controller = GetComponent<PlayerController>();
            PartyState.Reset();
            PlayerController.PerfectDodged += OnPerfectDodged;
        }

        private void OnDestroy()
        {
            PlayerController.PerfectDodged -= OnPerfectDodged;
        }

        private static void OnPerfectDodged() => PartyState.AddPerfectDodge();

        private void Update()
        {
            var kb = Keyboard.current;
            if (kb == null) return;
            if (kb.digit1Key.wasPressedThisFrame) OrderGuard();
            if (kb.digit2Key.wasPressedThisFrame) OrderMystic();
            if (kb.vKey.wasPressedThisFrame) Summon();
        }

        private bool Blocked => DungeonCutscenes.Playing || (_controller != null && _controller.Climbing);

        /// <summary>모바일 "도발" 버튼 · 키 1.</summary>
        public void OrderGuard() => TryOrderGuard();

        /// <summary>모바일 "치유" 버튼 · 키 2.</summary>
        public void OrderMystic() => TryOrderMystic();

        /// <summary>모바일 "소환" 버튼 · 키 V.</summary>
        public void Summon() => TrySummon();

        public bool TryOrderGuard()
        {
            if (Blocked) return false;
            var guard = AllyFighter.Instance;
            if (guard == null) return false;
            if (!guard.IsUp)
            {
                Toast("party.guard_is_down", "무사가 쓰러져 있다 — 술사의 치유로 일으키자");
                return false;
            }
            if (!PartyState.TrySpend(PartyRole.Guard))
            {
                Toast("party.not_ready", "명령 게이지가 아직 덜 찼다 — 싸워서 채우자");
                return false;
            }
            guard.OrderTaunt();
            Saga.Core.Motion30.Play(_controller != null ? _controller.Animator : null, "command"); // tasks U-0200 ① 호령
            return true;
        }

        public bool TryOrderMystic()
        {
            if (Blocked) return false;
            var mystic = AllyMystic.Instance;
            if (mystic == null) return false;
            if (!PartyState.TrySpend(PartyRole.Mystic))
            {
                Toast("party.not_ready", "명령 게이지가 아직 덜 찼다 — 싸워서 채우자");
                return false;
            }
            mystic.OrderHeal();
            Saga.Core.Motion30.Play(_controller != null ? _controller.Animator : null, "command"); // tasks U-0200 ① 호령
            return true;
        }

        public bool TrySummon()
        {
            if (Blocked) return false;
            if (!PartyState.SummonReady)
            {
                Toast("party.summon_not_ready", "소환 게이지가 아직 덜 찼다");
                return false;
            }
            if (DungeonEnemy.FindNearest(transform.position, PartySummon.Radius) == null)
            {
                Toast("party.summon_no_foe", "부를 까닭이 없다 — 곁에 적이 없다");
                return false;
            }
            PartyState.TrySpendSummon();
            // 거신은 플레이어와 가장 가까운 적 사이에 선다.
            var foe = DungeonEnemy.FindNearest(transform.position, PartySummon.Radius);
            Vector3 fwd = foe.transform.position - transform.position;
            if (new Vector2(fwd.x, fwd.z).sqrMagnitude < 0.01f)
                fwd = _controller != null && _controller.Visual != null ? _controller.Visual.forward : transform.forward;
            if (_controller != null) _controller.FaceToward(transform.position + fwd);
            var s = PartySummon.Spawn(summonPrefab, transform.position, fwd,
                new PartySummon.Look { RockLarge = summonRockLarge, RockSmall = summonRockSmall, Stone = summonStone });
            LastSummon = s;
            var cuts = DungeonCutscenes.Instance;
            float height = 1.9f * PartySummon.Scale;
            if (cuts == null) s.ResolveNow();
            else cuts.PlaySummon(s.transform.position, transform.position, height, s.ResolveNow);
            return true;
        }

        private static void Toast(string key, string fallback)
        {
            DialogueLabel.Instance?.Show(DungeonLocalization.T(key, fallback), 2f);
        }
    }
}
