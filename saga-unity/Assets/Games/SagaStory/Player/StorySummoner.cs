using UnityEngine;
using UnityEngine.InputSystem;
using Saga.Story.Cinematics;
using Saga.Story.Data;
using Saga.Story.UI;
using Saga.Story.World;

namespace Saga.Story.Player
{
    /// <summary>
    /// PLAN.md 106-10 둘째 단계 — V 키·모바일 "소환" 버튼으로 우레뿔 거수(`StorySummon`)를 부른다. 게이지가 덜 찼거나,
    /// 좌우 14m 안에 적이 없거나(게이지 안 씀), 줄에 매달렸거나, 컷 중이면 안 부르고 까닭을 토스트로 알린다.
    /// 부르면 `StoryCutscenes.PlaySummon` 이 소환 컷을 튼다(넘기면 그 자리에서 내리찍는다). 컷이 없으면 소환수가 혼자 논다.
    /// 몸 프리팹은 씬 빌더가 꽂는다(없으면 캡슐).
    /// </summary>
    [RequireComponent(typeof(StoryPlayerController))]
    public class StorySummoner : MonoBehaviour
    {
        [SerializeField] private GameObject summonPrefab;

        private StoryPlayerController _pc;

        public StorySummon LastSummon { get; private set; }
        public string LastRefusal { get; private set; }

        private void Awake()
        {
            _pc = GetComponent<StoryPlayerController>();
        }

        private void Update()
        {
            if (StoryCutscenes.Playing) return;
            var kb = Keyboard.current;
            if (kb != null && kb.vKey.wasPressedThisFrame) TrySummon();
        }

        /// <summary>모바일 "소환" 버튼(영속 onClick).</summary>
        public void TriggerSummon() => TrySummon();

        public bool TrySummon()
        {
            LastRefusal = null;
            if (StoryCutscenes.Playing) return false;
            if (_pc != null && _pc.OnRope) return Refuse("summon.on_rope", "줄에 매달린 채로는 부를 수 없다");
            if (!StorySummonState.Ready) return Refuse("summon.not_ready", "소환 게이지가 아직 덜 찼다");
            float facing = _pc != null && _pc.Visual != null && _pc.Visual.forward.x < 0f ? -1f : 1f;
            if (!FoeInReach(transform.position.x + facing * StorySummon.StandOffM))
                return Refuse("summon.no_foe", "부를 까닭이 없다 — 곁에 적이 없다");

            StorySummonState.TrySpend();
            StoryPlayerController.NotifyAttacked(); // PLAN.md 109-15 — 소환도 싸움이라 탈것에서 내린다
            float damage = (_pc != null ? _pc.AttackPower : StoryCombat.StartAtk) * StorySummon.DamageMul;
            var s = StorySummon.Spawn(summonPrefab, transform.position, facing, damage);
            LastSummon = s;
            var cuts = StoryCutscenes.Instance;
            if (cuts != null) cuts.PlaySummon(s, transform.position, facing, s.ResolveNow);
            return true;
        }

        /// <summary>소환수가 설 자리(`summonX`)에서 내려찍기가 닿는 적이 있나.</summary>
        private bool FoeInReach(float summonX)
        {
            foreach (var e in StoryEnemy.All)
            {
                if (e == null || e.IsDead) continue;
                var p = e.transform.position;
                if (Mathf.Abs(p.x - summonX) <= StorySummon.RadiusX && Mathf.Abs(p.y - transform.position.y) <= StorySummon.RadiusY) return true;
            }
            return false;
        }

        private bool Refuse(string key, string fallback)
        {
            LastRefusal = key;
            DialogueLabel.Instance?.Show(StoryLocalization.T(key, fallback), 2f);
            return false;
        }
    }
}
