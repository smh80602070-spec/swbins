using System.Collections.Generic;
using UnityEngine;
using Saga.Go.Data;
using Saga.Go.World;

namespace Saga.Go.Player
{
    /// <summary>
    /// PLAN.md 107-6 "동료 모델" — 들판 전투에서 인물을 바꾸면 몸이 바뀐다. 주인공은 씬에 굳힌 Maria,
    /// 동료는 id 로 고른 사실 모델(등용한 "산적" = Abe, 그 밖 = 기사·농부·아낙 중 FNV 해시)을 처음 나설 때 한 번
    /// 만들어 두고 켜고 끈다. 몸은 전부 Humanoid 라 주인공과 같은 Maria.controller 를 씌워(아바타 리타깃)
    /// 걷기·공격·등반·활공·수영 상태가 그대로 돈다. Humanoid 가 아닌 모델·빠진 모델은 쓰지 않고 주인공 몸에
    /// 원소 빛깔만 입힌다(예전 방식). 무기(`WeaponVisual`)는 `Shown` 이벤트로 몸을 따라온다(U-0049).
    ///
    /// 109-7 — 도감 인물은 `GoHeroLooks` 표의 몸(역사풍 열일곱 중 하나)에 키·체격·등·허리·머리 꾸밈을 입는다(`HeroDresser`).
    /// 표 밖 id(옛 세이브의 이름 없는 동행)만 예전처럼 기사·농부·아낙 해시. 들판 인물·겨루기 상대도 <see cref="Dress"/> 로 같은 겉모습.
    ///
    /// 109-8 교체 연출(웹 사가고 ⑭) — 들판에서 바꾸면 옛 몸을 바로 끄지 않고 떼어 옆뒤로 걸어 물러나게 한 뒤(0.6초) 떠오르며 줄어 흩어지고(0.9초),
    /// 새 몸은 옆에서 걸어 들어와 선다(0.35초 ease-out). 판정·카메라는 플레이어 자리 그대로(몸만 움직인다). 거리는 웹 걸음 × 이 트랙 척도.
    /// </summary>
    [RequireComponent(typeof(PlayerController))]
    public class PartyBodies : MonoBehaviour
    {
        public const string HeroId = Saga.Go.Combat.FieldCombat.HeroId;
        public const string BanditId = "산적";

        [SerializeField] private GameObject banditBody;
        [SerializeField] private GameObject[] extraBodies;
        [SerializeField] private RuntimeAnimatorController bodyController;
        // 109-7 — 인물 몸(`GoHeroLooks.Bodies` 이름 순서)·꾸밈(`GoHeroLooks.AllGear` 순서). 씬 빌더가 채운다(몸은 로컬 전용, 없으면 null).
        [SerializeField] private string[] lookBodyNames;
        [SerializeField] private GameObject[] lookBodies;
        [SerializeField] private string[] gearNames;
        [SerializeField] private GameObject[] gearModels;

        private PlayerController _pc;
        private Transform _heroVisual;
        private Animator _heroAnimator;
        private readonly Dictionary<string, Body> _bodies = new Dictionary<string, Body>();

        private class Body
        {
            public Transform Visual;
            public Animator Animator;
        }

        public string ShownId { get; private set; } = HeroId;
        /// <summary>몸이 바뀐 직후(인물 id) — U-0049 무기가 따라온다.</summary>
        public static event System.Action<string> Shown;

        // ---- 109-8 교체 연출 ----
        public const float EnterSec = 0.35f;
        public const float RetreatSec = 0.6f;
        public const float VanishSec = 0.9f;
        public static float MotionScale => CharacterVisual.HumanHeight / 1.75f;
        public static float EnterSide => 1.6f * MotionScale;
        public static float RetreatDist => 2.4f * MotionScale;

        private class Leaving
        {
            public Transform Visual;
            public Animator Animator;
            public Vector3 From, To, Scale;
            public float Age;
        }

        private readonly List<Leaving> _leaving = new List<Leaving>();
        private Transform _entering;
        private Vector3 _enterFrom;
        private float _enterAge;

        public bool InMotion => _leaving.Count > 0 || _entering != null;
        public int LeavingCount => _leaving.Count;
        public Transform Entering => _entering;
        /// <summary>물러나는 옛 몸(진단).</summary>
        public Transform LeavingVisual(int i) => _leaving[i].Visual;
        /// <summary>109-6 — 들판 인물(겨루기 상대)도 동행이 됐을 때와 같은 몸·같은 컨트롤러를 쓴다.</summary>
        public RuntimeAnimatorController BodyController => bodyController;
        public Transform HeroVisual => _heroVisual;

        private void Awake()
        {
            _pc = GetComponent<PlayerController>();
            _heroVisual = _pc.Visual;
            _heroAnimator = _pc.Animator;
        }

        /// <summary>이 인물이 쓸 몸 모델(없으면 null = 주인공 몸 + 빛깔).</summary>
        public GameObject PrefabFor(string memberId)
        {
            if (string.IsNullOrEmpty(memberId) || memberId == HeroId) return null;
            if (memberId == BanditId) return banditBody;
            if (GoHeroLooks.TryGet(memberId, out var look))
            {
                var forge = ForgeHero(memberId);
                if (forge != null) return forge;
                var own = LookBody(look.Body);
                if (own != null) return own;
            }
            if (extraBodies == null || extraBodies.Length == 0) return null;
            uint h = 2166136261;
            foreach (char c in memberId) { h ^= c; h *= 16777619; }
            return extraBodies[(int)(h % (uint)extraBodies.Length)];
        }

        /// <summary>char-forge 인물 제 몸 — `Resources/ForgeHero/hero_&lt;id&gt;`(`SetupForgeHeroes` 가 굽는다, 로컬 전용).</summary>
        public const string ForgeHeroPath = "ForgeHero/hero_";
        private static readonly Dictionary<string, GameObject> ForgeCache = new Dictionary<string, GameObject>();

        /// <summary>
        /// 인물 105 제 몸(char-forge 레시피 한 벌 = 인물 한 명). 쓸 때 한 벌씩 읽는다 — 씬에 105 벌을 걸면 폰 메모리에 다 올라간다.
        /// 이 PC 에 없으면 null(표의 몸 열일곱 + 모양 다섯 축으로 대신).
        /// </summary>
        public static GameObject ForgeHero(string heroId)
        {
            if (string.IsNullOrEmpty(heroId)) return null;
            if (!ForgeCache.TryGetValue(heroId, out var go)) ForgeCache[heroId] = go = Resources.Load<GameObject>(ForgeHeroPath + heroId);
            return go;
        }

        /// <summary>표의 몸 이름 → 프리팹(이 PC 에 없으면 null).</summary>
        public GameObject LookBody(string bodyName)
        {
            if (lookBodyNames == null || lookBodies == null) return null;
            for (int i = 0; i < lookBodyNames.Length && i < lookBodies.Length; i++)
                if (lookBodyNames[i] == bodyName) return lookBodies[i];
            return null;
        }

        public GameObject GearModel(GoHeroLooks.Gear g)
        {
            if (gearNames == null || gearModels == null) return null;
            string n = g.ToString();
            for (int i = 0; i < gearNames.Length && i < gearModels.Length; i++)
                if (gearNames[i] == n) return gearModels[i];
            return null;
        }

        /// <summary>막 만든 몸에 그 인물의 키·체격·꾸밈을 입힌다(표 밖 id 는 <paramref name="baseHeight"/> 로 키만 맞춘다).</summary>
        public void Dress(GameObject inst, string memberId, float baseHeight)
        {
            if (GoHeroLooks.TryGet(memberId, out var look))
            {
                if (ForgeHero(memberId) != null) HeroDresser.DressOwn(inst, look, baseHeight, GearModel);
                else HeroDresser.Dress(inst, look, baseHeight, GearModel);
                return;
            }
            float h = HeroDresser.MeasureHeight(inst);
            if (h > 0.01f) inst.transform.localScale = inst.transform.localScale * (baseHeight / h);
        }

        /// <summary>그 인물의 몸을 보인다. 제 몸이 있으면 true, 주인공 몸으로 대신하면 false.</summary>
        public bool Show(string memberId) => Show(memberId, false);

        /// <param name="motion">109-8 교체 연출을 튼다(들판 교체). false 면 돌던 연출도 끝내고 바로 바꾼다.</param>
        public bool Show(string memberId, bool motion)
        {
            if (_pc == null) Awake();
            if (!motion) FinishMotion();
            Body body = memberId == HeroId ? null : GetOrBuild(memberId);
            Transform next = body != null ? body.Visual : _heroVisual;
            Animator nextAnim = body != null ? body.Animator : _heroAnimator;
            var prev = _pc.Visual;
            if (next != null)
            {
                CancelLeaving(next); // 물러나던 몸을 곧바로 다시 부르면 제자리로
                FinishEnter();
                _pc.SetBody(next, nextAnim);
                if (motion && prev != null && prev != next) { StartLeave(prev); StartEnter(next); }
            }
            ShownId = body != null ? memberId : HeroId;
            Shown?.Invoke(ShownId); // U-0049 — 무기(WeaponVisual)가 새 몸 손으로 옮긴다
            return body != null;
        }

        private void StartLeave(Transform prev)
        {
            prev.gameObject.SetActive(true);
            Vector3 dir = (-prev.right * 0.6f - prev.forward * 0.8f);
            dir.y = 0f;
            dir = dir.sqrMagnitude > 1e-4f ? dir.normalized : -transform.forward;
            var l = new Leaving { Visual = prev, Animator = prev.GetComponentInChildren<Animator>(), Scale = prev.localScale };
            prev.SetParent(null, true);
            l.From = prev.position;
            l.To = l.From + dir * RetreatDist;
            prev.rotation = Quaternion.LookRotation(dir, Vector3.up); // 물러나는 쪽을 보고 걸어 나간다
            if (l.Animator != null && l.Animator.runtimeAnimatorController != null) l.Animator.SetFloat("Speed", 0.5f);
            _leaving.Add(l);
        }

        private void StartEnter(Transform next)
        {
            _entering = next;
            _enterAge = 0f;
            _enterFrom = transform.InverseTransformDirection(next.right) * EnterSide;
            next.localPosition = _enterFrom;
        }

        private void Update() => TickMotion(Time.deltaTime);

        /// <summary>진단이 시간을 건너뛰려고 직접 부른다.</summary>
        public void TickMotion(float dt)
        {
            if (_entering != null)
            {
                _enterAge += dt;
                float t = Mathf.Clamp01(_enterAge / EnterSec);
                float e = 1f - (1f - t) * (1f - t); // ease-out
                _entering.localPosition = _enterFrom * (1f - e);
                if (t >= 1f) FinishEnter();
            }
            for (int i = _leaving.Count - 1; i >= 0; i--)
            {
                var l = _leaving[i];
                l.Age += dt;
                float t = Mathf.Clamp01(l.Age / RetreatSec);
                float e = 1f - (1f - t) * (1f - t);
                Vector3 p = Vector3.Lerp(l.From, l.To, e);
                float u = Mathf.Clamp01((l.Age - RetreatSec) / (VanishSec - RetreatSec)); // 흩어짐 — 떠오르며 줄어든다
                l.Visual.position = p + Vector3.up * (u * 0.5f * MotionScale);
                l.Visual.localScale = l.Scale * Mathf.Max(0.02f, 1f - u);
                if (l.Animator != null && l.Animator.runtimeAnimatorController != null && t >= 1f) l.Animator.SetFloat("Speed", 0f);
                if (l.Age >= VanishSec)
                {
                    Saga.Go.Combat.FieldRingFx.Spawn(p, 1.2f * MotionScale, new Color(0.85f, 0.95f, 1f), 0.45f);
                    Restore(l);
                    _leaving.RemoveAt(i);
                }
            }
        }

        /// <summary>돌던 연출을 끝낸 자리로 — 새 몸은 제자리, 옛 몸은 꺼서 플레이어 밑으로.</summary>
        public void FinishMotion()
        {
            FinishEnter();
            foreach (var l in _leaving) Restore(l);
            _leaving.Clear();
        }

        private void FinishEnter()
        {
            if (_entering == null) return;
            _entering.localPosition = Vector3.zero;
            _entering = null;
        }

        private void CancelLeaving(Transform visual)
        {
            for (int i = _leaving.Count - 1; i >= 0; i--)
            {
                if (_leaving[i].Visual != visual) continue;
                Restore(_leaving[i]);
                _leaving.RemoveAt(i);
            }
        }

        private void Restore(Leaving l)
        {
            if (l.Visual == null) return;
            l.Visual.SetParent(transform, false);
            l.Visual.localPosition = Vector3.zero;
            l.Visual.localScale = l.Scale;
            if (l.Visual != _pc.Visual) l.Visual.gameObject.SetActive(false);
        }

        private Body GetOrBuild(string memberId)
        {
            if (_bodies.TryGetValue(memberId, out var cached)) return cached;
            var prefab = PrefabFor(memberId);
            Body body = null;
            if (prefab != null)
            {
                var inst = Instantiate(prefab, transform);
                inst.name = $"Body_{memberId}";
                inst.transform.localPosition = Vector3.zero;
                inst.transform.localRotation = Quaternion.identity;
                foreach (var col in inst.GetComponentsInChildren<Collider>()) DestroyImmediate(col); // 제 CharacterController·카메라 pull-in 과 안 부딪게
                Dress(inst, memberId, CharacterVisual.HumanHeight);
                foreach (var col in inst.GetComponentsInChildren<Collider>()) DestroyImmediate(col); // 꾸밈 모델 몫
                var anim = inst.GetComponentInChildren<Animator>();
                if (anim != null && anim.isHuman && bodyController != null)
                {
                    anim.runtimeAnimatorController = bodyController;
                    anim.applyRootMotion = false;
                    anim.cullingMode = AnimatorCullingMode.AlwaysAnimate;
                    inst.SetActive(false);
                    body = new Body { Visual = inst.transform, Animator = anim };
                }
                else
                {
                    Debug.LogWarning($"[PartyBodies] {prefab.name} 가 Humanoid 가 아니거나 컨트롤러가 없음 — {memberId} 는 주인공 몸에 빛깔로 대신");
                    Destroy(inst);
                }
            }
            _bodies[memberId] = body;
            return body;
        }
    }
}
