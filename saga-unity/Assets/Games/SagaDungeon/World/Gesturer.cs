using System;
using UnityEngine;
using Saga.Dungeon.Data;

namespace Saga.Dungeon.World
{
    /// <summary>
    /// PLAN.md 109-10-7 몸짓의 화면 층 — 마을 사람·동행 뿌리에 하나씩 붙어 <see cref="GestureState.Plan"/> 을 몸과 머리 위 글자로 옮긴다.
    ///
    /// 이 판 마을 사람 몸(PeasantMan·시대 손님·행상)은 **대기 클립뿐**이라 웹처럼 슬롯을 갈아 끼울 수 없다 → 애니메이터가 쓴 자세 위에
    /// `LateUpdate` 에서 팔·허리·머리 뼈를 **월드 축으로** 조금 더 돌린다(리그마다 뼈 로컬 축이 달라도 같은 쪽으로 움직인다):
    /// 인사 = 오른팔 들어 흔들기 · 일(흥정·셈) = 두 팔 앞으로 + 고개 끄덕 · 일(망치질·일손) = 오른팔 두 번 내리침 · 환호 = 두 팔 번쩍 + 통통 튐.
    /// 동행의 호응은 제 공격 클립(무사 베기·술사 시전) 트리거 — 웹 rally 가 attack 슬롯인 것과 같다.
    /// 휴머노이드가 아니면(폴백 캡슐) 몸 전체를 살짝 숙이고 튀기만. 걷거나 치는 중이면 글자만.
    /// 애니메이터가 이번 프레임 뼈를 안 썼으면(컬링·폴백) 지난번 더한 만큼을 먼저 되돌려 쌓이지 않게 한다.
    /// </summary>
    public class Gesturer : MonoBehaviour
    {
        private const float LabelSize = 40f * 0.19f;
        private const float HopHeight = 0.22f;
        private const float MoveBusySpeed = 0.4f;
        /// <summary>① 인사 — 마을 사람에게 이만큼 다가서면(시대 손님 대사 반경 `EraFolk.TalkRadius` 와 같다).</summary>
        public const float GreetRadius = 3.2f;
        private static readonly Color LabelColor = new Color(1f, 0.93f, 0.7f);

        private static readonly HumanBodyBones[] Bones =
        {
            HumanBodyBones.Spine, HumanBodyBones.Head,
            HumanBodyBones.RightUpperArm, HumanBodyBones.RightLowerArm,
            HumanBodyBones.LeftUpperArm, HumanBodyBones.LeftLowerArm,
        };
        private const int BSpine = 0, BHead = 1, BRUpper = 2, BRLower = 3, BLUpper = 4, BLLower = 5;

        private string _key;
        private bool _npc;
        private Func<bool> _extraBusy;
        private Animator _animator;
        private Transform _visual;
        private Transform[] _bones;
        private Quaternion[] _lastSet, _lastBase;
        private bool[] _touched;
        private Vector3 _visualBasePos;
        private Quaternion _visualBaseRot;
        private bool _visualTouched;
        private float _headHeight = 2.0f;
        private Transform _labelGo;
        private TMPro.TextMeshPro _label;
        private Camera _cam;
        private Vector3 _lastPos;
        private float _speed;
        private Transform _player;
        private bool _near;
        private float _triggeredT0 = float.NaN; // NaN 은 무엇과도 같지 않다 — 첫 몸짓은 늘 건다

        public string Key => _key;
        public bool IsNpc => _npc;
        public bool Humanoid => _bones != null;
        /// <summary>진단 — 마지막 프레임 몸짓·글자·걸어 둔 트리거.</summary>
        public GestureState.Pose LastPose { get; private set; }
        public string LabelText => _label != null && _label.gameObject.activeSelf ? _label.text : "";
        public string LastTrigger { get; private set; }
        public int Triggers { get; private set; }
        public bool LastBusy { get; private set; }
        /// <summary>진단 — 다가서서 인사한 수.</summary>
        public int Greets { get; private set; }

        /// <summary>붙이기(이미 있으면 그것을 돌려준다). key 는 "역할@x,z" 식 — 틈틈이 주기가 키로 정해진다.</summary>
        public static Gesturer Attach(GameObject root, string key, bool npc, Func<bool> extraBusy = null)
        {
            var g = root.GetComponent<Gesturer>();
            if (g == null) g = root.AddComponent<Gesturer>();
            g._key = key;
            g._npc = npc;
            g._extraBusy = extraBusy;
            return g;
        }

        /// <summary>마을 사람 키 — 역할 + 자리(반올림). 같은 씬이면 늘 같다.</summary>
        public static string NpcKey(string role, Vector3 pos) =>
            $"{role}@{Mathf.RoundToInt(pos.x)},{Mathf.RoundToInt(pos.z)}";

        private void Start()
        {
            _cam = Camera.main;
            _lastPos = transform.position;
            var playerGo = GameObject.FindWithTag("Player");
            _player = playerGo != null ? playerGo.transform : null;
            Bind();
        }

        /// <summary>몸을 찾는다(늦게 지어진 몸도 — 진단·폴백 교체 뒤 다시 부른다).</summary>
        public void Bind()
        {
            _animator = GetComponentInChildren<Animator>();
            _visual = _animator != null ? _animator.transform : (transform.childCount > 0 ? transform.GetChild(0) : null);
            if (_visual == _labelGo) _visual = null;
            if (_visual != null) { _visualBasePos = _visual.localPosition; _visualBaseRot = _visual.localRotation; }
            _bones = null;
            if (_animator != null && _animator.isHuman && _animator.avatar != null)
            {
                var b = new Transform[Bones.Length];
                bool ok = true;
                for (int i = 0; i < Bones.Length; i++) { b[i] = _animator.GetBoneTransform(Bones[i]); ok &= b[i] != null; }
                if (ok) { _bones = b; _lastSet = new Quaternion[b.Length]; _lastBase = new Quaternion[b.Length]; _touched = new bool[b.Length]; }
            }
            float top = 0f;
            foreach (var r in GetComponentsInChildren<Renderer>())
            {
                if (r is ParticleSystemRenderer || r is LineRenderer || (_labelGo != null && r.transform.IsChildOf(_labelGo))) continue;
                top = Mathf.Max(top, r.bounds.max.y - transform.position.y);
            }
            _headHeight = top >= 1.2f ? Mathf.Min(top, 3.2f) : 2.0f;
        }

        private void Update()
        {
            float dt = Time.deltaTime;
            if (dt > 0f)
            {
                Vector3 d = transform.position - _lastPos;
                d.y = 0f;
                _speed = d.magnitude / dt;
            }
            _lastPos = transform.position;
            if (_npc && _player != null) CheckApproach(_player.position, GestureState.Now);
        }

        /// <summary>① 다가섬 — 반경 안으로 들어서는 순간 한 번(나갔다 오면 또). 진단이 자리를 넣어 부른다.</summary>
        public bool CheckApproach(Vector3 playerPos, float now)
        {
            Vector3 d = playerPos - transform.position;
            d.y = 0f;
            bool near = d.magnitude <= GreetRadius;
            bool greeted = near && !_near && GestureState.OnGreet(_key, now);
            if (greeted) Greets++;
            _near = near;
            return greeted;
        }

        private void LateUpdate() => Apply(GestureState.Now);

        /// <summary>한 번 적용 — 진단이 now 를 넣어 곧장 부른다.</summary>
        public void Apply(float now)
        {
            if (_key == null) return;
            bool busy = IsBusy();
            LastBusy = busy;
            var p = GestureState.Plan(_key, now, busy, _npc);
            LastPose = p;

            RestoreUntouched();
            if (p.Kind != GestureState.Kind.None && p.Slot != GestureState.Slot.Idle)
            {
                float w = Envelope(p.K);
                if (p.Slot == GestureState.Slot.Attack && !_npc && HasTrigger("Attack"))
                {
                    // 제 공격 클립(동행만 — 마을 아낙 몸 PeasantGirl 의 Attack 은 술사 시전이라 일손엔 안 쓴다). 몸짓 하나에 한 번만 건다.
                    if (!(_triggeredT0 == p.T0))
                    {
                        _triggeredT0 = p.T0;
                        _animator.SetTrigger("Attack");
                        LastTrigger = "Attack";
                        Triggers++;
                    }
                }
                else if (_bones != null) PoseBones(p, w);
                else LeanVisual(p, w);
            }
            if (p.Bob > 0f && _visual != null)
            {
                _visual.localPosition = _visualBasePos + Vector3.up * (p.Bob * HopHeight);
                _visualTouched = true;
            }
            ShowLabel(p);
        }

        private bool IsBusy()
        {
            if (_extraBusy != null && _extraBusy()) return true;
            if (_speed > MoveBusySpeed) return true;
            if (_animator != null && _animator.isActiveAndEnabled && _animator.runtimeAnimatorController != null)
            {
                var s = _animator.GetCurrentAnimatorStateInfo(0);
                if (s.IsName("Attack") || s.IsName("Hit") || s.IsName("Death") || s.IsName("Taunt") || s.IsName("Blocked")
                    || s.IsName("Heal") || s.IsName("Walk") || s.IsName("Run")) return true;
            }
            return false;
        }

        private bool HasTrigger(string name)
        {
            if (_animator == null || _animator.runtimeAnimatorController == null || !_animator.isActiveAndEnabled) return false;
            foreach (var prm in _animator.parameters)
                if (prm.name == name && prm.type == AnimatorControllerParameterType.Trigger) return true;
            return false;
        }

        private static float Envelope(float k) =>
            Mathf.SmoothStep(0f, 1f, Mathf.Clamp01(k / 0.15f)) * (1f - Mathf.SmoothStep(0f, 1f, Mathf.Clamp01((k - 0.85f) / 0.15f)));

        /// <summary>애니메이터가 이번 프레임 뼈를 안 썼으면(= 지난번 우리가 둔 값 그대로) 더하기 전으로 되돌린다.</summary>
        private void RestoreUntouched()
        {
            if (_bones != null)
            {
                for (int i = 0; i < _bones.Length; i++)
                {
                    if (!_touched[i]) continue;
                    if (Quaternion.Angle(_bones[i].localRotation, _lastSet[i]) < 0.01f) _bones[i].localRotation = _lastBase[i];
                    _touched[i] = false;
                }
            }
            if (_visualTouched && _visual != null)
            {
                _visual.localPosition = _visualBasePos;
                _visual.localRotation = _visualBaseRot;
                _visualTouched = false;
            }
        }

        private void Turn(int bone, float deg, Vector3 axis)
        {
            var t = _bones[bone];
            if (!_touched[bone]) _lastBase[bone] = t.localRotation;
            t.rotation = Quaternion.AngleAxis(deg, axis) * t.rotation;
            _lastSet[bone] = t.localRotation;
            _touched[bone] = true;
        }

        /// <summary>월드 축: F = 몸 앞, R = 몸 오른쪽. AngleAxis(+, F) 는 늘어뜨린 팔을 오른쪽 위로, (−, R) 은 앞으로 든다.</summary>
        private void PoseBones(GestureState.Pose p, float w)
        {
            var body = _animator.transform;
            Vector3 f = body.forward, r = body.right;
            float k = p.K;
            switch (p.Slot)
            {
                case GestureState.Slot.Wave:
                    Turn(BRUpper, 140f * w, f);
                    Turn(BRLower, 28f * Mathf.Sin(k * Mathf.PI * 6f) * w, f);
                    Turn(BHead, 6f * w, f);
                    break;
                case GestureState.Slot.Interaction:
                    Turn(BSpine, 9f * w, r);
                    Turn(BRUpper, -38f * w, r);
                    Turn(BLUpper, -38f * w, r);
                    Turn(BRLower, -48f * w, r);
                    Turn(BLLower, -48f * w, r);
                    Turn(BHead, 10f * Mathf.Abs(Mathf.Sin(k * Mathf.PI * 2f)) * w, r);
                    break;
                case GestureState.Slot.Attack:
                {
                    // 두 번 내리침 — 들기 60% · 내리치기 20% · 멈춤 20%.
                    float ph = Mathf.Repeat(k * 2f, 1f);
                    float up = ph < 0.6f ? ph / 0.6f : ph < 0.8f ? 1f - (ph - 0.6f) / 0.2f : 0f;
                    Turn(BRUpper, -(30f + 120f * up) * w, r);
                    Turn(BRLower, -35f * w, r);
                    Turn(BSpine, (1f - up) * 12f * w, r);
                    break;
                }
                case GestureState.Slot.Jump:
                    Turn(BRUpper, 155f * w, f);
                    Turn(BLUpper, -155f * w, f);
                    break;
            }
        }

        /// <summary>폴백 몸 — 뼈가 없으니 몸 전체를 살짝 숙인다(환호는 튐만).</summary>
        private void LeanVisual(GestureState.Pose p, float w)
        {
            if (_visual == null || p.Slot == GestureState.Slot.Jump) return;
            float deg = p.Slot == GestureState.Slot.Attack
                ? 10f * Mathf.Abs(Mathf.Sin(p.K * Mathf.PI * 2f))
                : p.Slot == GestureState.Slot.Wave ? 5f * Mathf.Sin(p.K * Mathf.PI * 4f) : 8f;
            var axis = p.Slot == GestureState.Slot.Wave ? Vector3.forward : Vector3.right;
            _visual.localRotation = _visualBaseRot * Quaternion.AngleAxis(deg * w, axis);
            _visualTouched = true;
        }

        private void ShowLabel(GestureState.Pose p)
        {
            bool show = !string.IsNullOrEmpty(p.Text);
            if (!show)
            {
                if (_label != null && _label.gameObject.activeSelf) _label.gameObject.SetActive(false);
                return;
            }
            if (_label == null)
            {
                var go = new GameObject("GestureLabel");
                go.transform.SetParent(transform, false);
                _label = Saga.Core.SagaWorldText.Add(go, p.Text, LabelSize, LabelColor);
                _labelGo = _label.transform; // TMP 를 붙이면 Transform 이 RectTransform 으로 바뀐다 — 붙인 뒤에 잡는다
                _label.outlineWidth = 0.2f;
            }
            if (!_label.gameObject.activeSelf) _label.gameObject.SetActive(true);
            if (_label.text != p.Text) _label.text = p.Text;
            // 솟으며 커졌다가 끝에 흐려진다.
            float pop = Mathf.Clamp01(p.K / 0.12f);
            _labelGo.localPosition = Vector3.up * (_headHeight + 0.3f + 0.15f * pop);
            _labelGo.localScale = Vector3.one * Mathf.Lerp(0.6f, 1f, pop);
            var c = LabelColor;
            c.a = 1f - Mathf.Clamp01((p.K - 0.8f) / 0.2f);
            _label.color = c;
            if (_cam == null) _cam = Camera.main;
            if (_cam != null) _labelGo.rotation = _cam.transform.rotation;
        }
    }
}
