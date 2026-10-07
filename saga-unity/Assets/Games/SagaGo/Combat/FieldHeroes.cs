using System.Collections.Generic;
using UnityEngine;
using Saga.Go.Data;
using Saga.Go.Player;
using Saga.Go.UI;
using Saga.Go.World;

namespace Saga.Go.Combat
{
    /// <summary>
    /// PLAN.md 109-6 "싸워서 등용"(웹 사가만리 ⑯) — 지역마다 한 자리(`GoHeroes.Stands`)에 도감 인물이 하나씩 서 있다
    /// (그 지역 명단에서 아직 동행이 아닌 첫 사람). 평소엔 들판 적이 아니라 그냥 서 있는 사람이고(들판 적 목록·진단을 안 건드린다),
    /// 곁 <see cref="GoHeroes.ChallengeRadius"/> 안에 들면 그 자리에서 겨루기가 열린다 — 인물이 들판 적(`FieldEnemy.Kind.Hero`)으로 바뀌고
    /// 졸개(★3 하나·★4~5 둘, 제 원소 — 둘째는 다른 시대 몸)가 붙는다. 체력이 0 이면 쓰러지지 않고 굴복 → <see cref="GoHeroes.YieldSec"/> 뒤
    /// 동행(`PartyState.Recruit`)이 되고 다음 사람이 선다. 끌고 멀리 가면(들판 적 규칙 — 32m 밖) 인물이 돌아가 없던 일,
    /// 모두 쓰러지면 인물은 떠나고(그 판에선 그 지역 명단 뒤로) 다음 사람이 선다. 세이브는 동행 명단 + 겨루기를 연 사람(`HeroDexState`, 109-6b 도감 "만남").
    /// `FieldSpawner` 가 Play 시작 때 붙인다(씬에 굳히지 않는다).
    /// </summary>
    public class FieldHeroes : MonoBehaviour
    {
        public const float NextHeroSec = 4f;
        public const float ResetBackSec = 2f;
        public const float MinionSpread = 4.5f;

        public static FieldHeroes Instance { get; private set; }

        public class Slot
        {
            public GoHeroes.Stand Stand;
            public List<string> Roster;
            public int Skip;
            public string HeroId;
            public GameObject Idle;
            public FieldEnemy Fighter;
            public readonly List<FieldEnemy> Minions = new List<FieldEnemy>();
            public float Wait;
            public float YieldLeft = -1f;
        }

        private readonly List<Slot> _slots = new List<Slot>();
        private FieldSpawner _spawner;
        private PartyBodies _bodies;

        public IReadOnlyList<Slot> Slots => _slots;

        private void Awake()
        {
            Instance = this;
            _spawner = GetComponent<FieldSpawner>();
            foreach (var s in GoHeroes.Stands)
                _slots.Add(new Slot { Stand = s, Roster = GoHeroes.RosterOf(s.RegionId) });
            FieldEnemy.HeroYielded += OnYielded;
            FieldEnemy.HeroReset += OnReset;
            FieldCombat.Wiped += OnWiped;
        }

        private void OnDestroy()
        {
            FieldEnemy.HeroYielded -= OnYielded;
            FieldEnemy.HeroReset -= OnReset;
            FieldCombat.Wiped -= OnWiped;
            if (Instance == this) Instance = null;
        }

        private void Start()
        {
            foreach (var slot in _slots) Refresh(slot);
        }

        public static Vector3 StandPos(GoHeroes.Stand s) => FolkWalker.Grounded(TestMapData.WorldPos(s.Gx, s.Gy) + Vector3.up * 5f);

        /// <summary>그 지역에 지금 설 사람 — 명단에서 동행이 아닌 사람을 건너뛴 수(`Skip`)만큼 돌린 첫째. 다 모았으면 null.</summary>
        public static string NextHero(List<string> roster, int skip)
        {
            var free = new List<string>();
            foreach (var id in roster) if (!IsMember(id)) free.Add(id);
            if (free.Count == 0) return null;
            return free[((skip % free.Count) + free.Count) % free.Count];
        }

        private static bool IsMember(string id)
        {
            foreach (var m in PartyState.MemberIds) if (m == id) return true;
            return false;
        }

        /// <summary>다음 사람을 세운다(이미 서 있으면 치우고). 진단도 부른다.</summary>
        public void Refresh(Slot slot)
        {
            ClearFight(slot);
            if (slot.Idle != null) Destroy(slot.Idle);
            slot.Idle = null;
            slot.YieldLeft = -1f;
            slot.HeroId = NextHero(slot.Roster, slot.Skip);
            if (slot.HeroId == null || !GoHeroes.TryGet(slot.HeroId, out var hero)) return;

            var root = new GameObject($"HeroIdle_{hero.Id}");
            root.transform.SetParent(transform, false);
            root.transform.position = StandPos(slot.Stand);
            var prefab = Bodies() != null ? _bodies.PrefabFor(hero.Id) : null;
            if (prefab != null)
            {
                var inst = Instantiate(prefab, root.transform);
                inst.name = "Visual";
                inst.transform.localPosition = Vector3.zero;
                inst.transform.localRotation = Quaternion.identity;
                foreach (var col in inst.GetComponentsInChildren<Collider>()) Destroy(col);
                _bodies.Dress(inst, hero.Id, CharacterVisual.HumanHeight); // 109-7 키·체격·꾸밈(동행이 됐을 때와 같은 겉모습)
                var anim = inst.GetComponentInChildren<Animator>();
                if (anim != null && anim.isHuman && _bodies.BodyController != null) anim.runtimeAnimatorController = _bodies.BodyController;
                CharacterVisual.EnsureBlobShadow(root.transform);
            }
            else
            {
                CharacterVisual.SpawnFallbackCapsule(root.transform, Color.Lerp(Color.white, GoElements.ColorOf(GoHeroes.ElementOf(hero)), 0.5f));
            }
            var tag = new GameObject("NameTag");
            tag.transform.SetParent(root.transform, false);
            tag.transform.localPosition = new Vector3(0f, CharacterVisual.HumanHeight + 1.1f, 0f);
            var text = Saga.Core.SagaWorldText.Add(tag, GoHeroes.Label(hero), 64f * 0.035f, Color.Lerp(Color.white, GoElements.ColorOf(GoHeroes.ElementOf(hero)), 0.5f));
            slot.Idle = root;
        }

        private PartyBodies Bodies()
        {
            if (_bodies == null && FieldCombat.Instance != null) _bodies = FieldCombat.Instance.GetComponent<PartyBodies>();
            return _bodies;
        }

        private void Update()
        {
            float dt = Time.deltaTime;
            var fc = FieldCombat.Instance;
            var cam = Camera.main;
            foreach (var slot in _slots)
            {
                if (slot.YieldLeft >= 0f)
                {
                    slot.YieldLeft -= dt;
                    if (slot.YieldLeft < 0f) FinishYield(slot);
                    continue;
                }
                if (slot.Wait > 0f)
                {
                    slot.Wait -= dt;
                    if (slot.Wait <= 0f) Refresh(slot);
                    continue;
                }
                if (slot.Idle == null || slot.Fighter != null || fc == null) continue;
                if (cam != null)
                {
                    var tag = slot.Idle.transform.Find("NameTag");
                    if (tag != null) tag.rotation = Quaternion.LookRotation(tag.position - cam.transform.position);
                }
                if (DuelGate.Active || Saga.Go.Cinematics.GoCutscenes.Playing || !fc.CanBeTargeted) continue;
                Vector3 d = fc.transform.position - slot.Idle.transform.position;
                d.y = 0f;
                if (d.magnitude <= GoHeroes.ChallengeRadius) StartDuel(slot);
                else if (d.sqrMagnitude > 0.01f) slot.Idle.transform.rotation = Quaternion.Slerp(slot.Idle.transform.rotation, Quaternion.LookRotation(d), 3f * dt);
            }
        }

        /// <summary>겨루기를 연다 — 서 있던 사람을 들판 적으로 바꾸고 졸개를 붙인다. 진단도 부른다.</summary>
        public void StartDuel(Slot slot)
        {
            if (slot.HeroId == null || slot.Fighter != null || !GoHeroes.TryGet(slot.HeroId, out var hero)) return;
            Vector3 pos = slot.Idle != null ? slot.Idle.transform.position : StandPos(slot.Stand);
            Quaternion rot = slot.Idle != null ? slot.Idle.transform.rotation : Quaternion.identity;
            if (slot.Idle != null) Destroy(slot.Idle);
            slot.Idle = null;
            var prefab = Bodies() != null ? _bodies.PrefabFor(hero.Id) : null;
            slot.Fighter = FieldEnemy.SpawnHero(hero, pos, prefab, _bodies != null ? _bodies.BodyController : null, transform, _bodies);
            slot.Fighter.transform.rotation = rot;
            slot.Fighter.Challenge();
            HeroDexState.MarkSeen(hero.Id); // 109-6b 도감 — 겨뤄 본 사람은 그림자에서 벗어난다
            int n = GoHeroes.Minions(hero.Rarity);
            var element = GoHeroes.ElementOf(hero);
            for (int i = 0; i < n && _spawner != null; i++)
            {
                float a = i * Mathf.PI * 2f / n + 0.8f;
                Vector3 home = pos + new Vector3(Mathf.Cos(a), 0f, Mathf.Sin(a)) * MinionSpread;
                // §13 — 둘째 졸개는 다른 시대 몸(인물 id 해시로 현대·미래 중 하나)
                GoEra era = i == 0 ? GoEra.Past : (GoEras.Hash(hero.Id) % 2 == 0 ? GoEra.Modern : GoEra.Future);
                slot.Minions.Add(_spawner.SpawnHeroMinion(element, home, slot.Fighter.GroupId, era, i));
            }
            DialogueLabel.Instance?.Show(string.Format(GoLocalization.T("hero.challenge", "⚔ {0} — \"{1}\"\n겨루기! 이겨서 굴복시키면 동행이 된다"),
                GoHeroes.Label(hero), GoHeroes.Quote(hero)), 4f);
        }

        private Slot SlotOf(FieldEnemy e)
        {
            foreach (var s in _slots) if (s.Fighter == e) return s;
            return null;
        }

        private void OnYielded(FieldEnemy e)
        {
            var slot = SlotOf(e);
            if (slot == null) return;
            slot.YieldLeft = GoHeroes.YieldSec;
            if (GoHeroes.TryGet(e.HeroId, out var hero))
                DialogueLabel.Instance?.Show(string.Format(GoLocalization.T("hero.yield", "{0}이(가) 무릎을 꿇었다…"), GoHeroes.Name(hero)), 2f);
        }

        /// <summary>굴복 끝 — 동행이 되고, 졸개를 치우고, 다음 사람을 기다린다. 진단도 부른다.</summary>
        public void FinishYield(Slot slot)
        {
            slot.YieldLeft = -1f;
            string id = slot.HeroId;
            if (id != null && !IsMember(id))
            {
                PartyState.Recruit(id);
                if (GoHeroes.TryGet(id, out var hero))
                    DialogueLabel.Instance?.Show(string.Format(GoLocalization.T("hero.joined", "{0} — 동행이 되었다! ({1} 원소 · 1~4 로 바꿔 싸운다)"),
                        GoHeroes.Label(hero), GoElements.NameOf(GoHeroes.ElementOf(hero))), 4f);
            }
            ClearFight(slot);
            slot.Wait = NextHeroSec;
        }

        private void OnReset(FieldEnemy e)
        {
            var slot = SlotOf(e);
            if (slot == null) return;
            ClearFight(slot);
            slot.Wait = ResetBackSec; // 같은 사람이 제자리에 다시 선다
        }

        private void OnWiped()
        {
            foreach (var slot in _slots)
            {
                if (slot.Fighter == null || slot.YieldLeft >= 0f) continue;
                if (GoHeroes.TryGet(slot.HeroId, out var hero))
                    DialogueLabel.Instance?.Show(string.Format(GoLocalization.T("hero.left", "{0}은(는) 등을 돌려 떠났다."), GoHeroes.Name(hero)), 3f);
                ClearFight(slot);
                slot.Skip++;
                slot.Wait = NextHeroSec;
            }
        }

        private void ClearFight(Slot slot)
        {
            // 끄고 지운다 — 들판 적 목록(`FieldEnemy.All`)에서 그 자리에서 빠지게(Destroy 는 프레임 끝).
            if (slot.Fighter != null) { slot.Fighter.gameObject.SetActive(false); Destroy(slot.Fighter.gameObject); }
            slot.Fighter = null;
            foreach (var m in slot.Minions) if (m != null) { m.gameObject.SetActive(false); Destroy(m.gameObject); }
            slot.Minions.Clear();
        }
    }
}
