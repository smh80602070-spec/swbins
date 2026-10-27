using System;
using UnityEngine;

namespace Saga.Core
{
    /// <summary>
    /// tasks U-0146 생활 몸짓(다섯 판 공용) — 고돗 `saga_core/world/life_pose.gd`(G-0265·0266)·웹 W-0303 pose3d 의 앉기·인사·둘러보기·체중.
    /// 새 클립·모캡 없음 — 애니메이터가 놓은 자세 위에 `LateUpdate` 에서 휴머노이드 뼈를 **월드 축으로** 돌린다(2나락 `Gesturer` 결).
    ///
    ///   sit    (나) 가만히 <see cref="SitAfter"/>초 → 땅에 무릎 세워 앉기 — 엉덩이를 발목 쉬는 높이 + 0.08m 로 내리고, 발목을 엉덩이 앞 0.36m(오른쪽 0.34m)에
    ///          두는 두 뼈 IK(무릎은 위로), 발은 쉬는 자세로 평평 · 몸 −8° 뒤로 · 윗팔은 제 무릎 쪽·아래팔은 무릎 앞 아래로(손이 무릎에 — 각도를 더하지 않고 방향으로, 1만리 촬영에서 팔이 뜬 뒤). 움직이면 0.25초에 섞어 일어난다.
    ///   wave   (주민) 내가 <see cref="GreetRadius"/>m 안으로 들어서면 오른팔 인사 1.6초 + 고개를 나 쪽으로(±60°).
    ///   look   (주민) 둘러보기 2.6초 — 머리·목·가슴을 위 축으로 +34° → −28° → 0.
    ///   shift  (주민) 체중 3.0초 — 엉덩이 옆 2cm·기울기 −4°, 허리 3°·가슴 2°.
    ///          주민은 3~5초마다(자리로 정한 씨앗) look/shift 를 번갈아 — 카메라 25m 안일 때만.
    /// 휴머노이드가 아니면(폴백 캡슐·Generic) 아무것도 안 한다. hold(이동·공격·탈것·줄 등 판이 넘긴 조건)·스스로 움직이는 중이면 몸짓 0.
    /// 붙이는 곳: 주민 = <see cref="NpcIdle.SpawnRigged"/>(대기 상태 "Idle" 만, 2나락 `Gesturer` 가 있으면 스스로 빠짐) · 나 = 판 플레이어 컨트롤러 ·
    /// 5천하 = `RealmFigure`(대기 클립일 때만). 애니메이터가 이번 프레임 뼈를 안 썼으면 지난번 돌린 만큼을 먼저 되돌린다(쌓이지 않게).
    /// </summary>
    [DisallowMultipleComponent]
    public class LifePose : MonoBehaviour
    {
        public const float SitAfter = 8f, Blend = 0.25f;
        public const float WaveSec = 1.6f, LookSec = 2.6f, ShiftSec = 3.0f;
        public const float IdleMin = 3f, IdleMax = 5f, IdleNear = 25f, GreetRadius = 3.2f;
        public const float SitHipUp = 0.08f, SitLean = -8f;
        public static readonly float[] SitFootFwd = { 0.36f, 0.34f };
        public const float StillSpeed = 0.1f;
        public enum Act { None, Wave, Look, Shift }

        private bool _npc;
        private Func<bool> _hold;
        private Animator _animator;
        private Transform _player;
        private Camera _cam;
        private Vector3 _lastPos;
        private bool _near, _bound;
        private float _idleLeft;
        private int _idleFlip;

        /// <summary>진단·판 — 지금 상태.</summary>
        public bool Npc => _npc;
        public float StillT { get; private set; }
        public float SitW { get; private set; }
        public Act Current { get; private set; }
        public float ActT { get; private set; }
        public int Greets { get; private set; }
        public bool Humanoid => _bones != null;
        public bool HoldNow { get; private set; }
        // U-0249 대표 몸만 선택적으로 켠다. 다른 판·주민의 자세는 기존대로.
        public bool Breathing { get; set; }
        public const float BreathPeriod = 2.4f;
        private float _breathPhase, _breathWeight;
        private static readonly int SpeedHash = Animator.StringToHash("Speed");
        private static readonly string[] ArmSwingBlockedStates = { "Attack", "Attack1", "Attack2", "Attack3", "Heavy", "Hit", "Death", "Jump", "Fall", "Climb", "Swim", "Taunt", "Heal", "Blocked" };
        private readonly Quaternion[] _armIdleLocal = new Quaternion[2];
        private bool _armIdleReady, _hasSpeedParam;

        // 뼈 — 0 엉덩이 1 허리 2 가슴 3 목 4 머리 5·6 허벅지 L·R 7·8 정강이 9·10 발 11·12 윗팔 13·14 아래팔
        private static readonly HumanBodyBones[] BoneIds =
        {
            HumanBodyBones.Hips, HumanBodyBones.Spine, HumanBodyBones.Chest, HumanBodyBones.Neck, HumanBodyBones.Head,
            HumanBodyBones.LeftUpperLeg, HumanBodyBones.RightUpperLeg, HumanBodyBones.LeftLowerLeg, HumanBodyBones.RightLowerLeg,
            HumanBodyBones.LeftFoot, HumanBodyBones.RightFoot,
            HumanBodyBones.LeftUpperArm, HumanBodyBones.RightUpperArm, HumanBodyBones.LeftLowerArm, HumanBodyBones.RightLowerArm,
        };
        private const int BHips = 0, BSpine = 1, BChest = 2, BNeck = 3, BHead = 4, BThigh = 5, BCalf = 7, BFoot = 9, BUArm = 11, BLArm = 13;
        private Transform[] _bones;
        private Quaternion[] _lastSet, _lastBase;
        private bool[] _touched;
        private Vector3 _hipLastSet, _hipLastBase;
        private bool _hipTouched;

        /// <summary>붙인다(이미 있으면 그것). hold 는 판이 넘기는 "지금 몸짓 금지" 조건.</summary>
        public static LifePose Attach(GameObject root, bool npc, Func<bool> hold = null)
        {
            var p = root.GetComponent<LifePose>();
            if (p == null) p = root.AddComponent<LifePose>();
            p._npc = npc;
            p._hold = hold;
            p._bound = false;
            return p;
        }

        private void Start()
        {
            // 2나락은 Gesturer 가 몸짓을 맡는다(마을 사람·동행) — 그 판 씬이면 겹치지 않게 빠진다(판 코드를 참조하지 않으려 이름으로 찾는다).
            if (GetComponent("Gesturer") != null || GesturerInScene()) { Destroy(this); return; }
            _lastPos = transform.position;
            _idleLeft = IdleMin + Hash01(transform.position) * (IdleMax - IdleMin);
            _idleFlip = Hash01(transform.position + Vector3.one) < 0.5f ? 0 : 1;
        }

        private static Type _gesturerType;
        private static bool _gesturerLooked;
        private static bool GesturerInScene()
        {
            if (!_gesturerLooked)
            {
                _gesturerLooked = true;
                foreach (var asm in AppDomain.CurrentDomain.GetAssemblies())
                {
                    _gesturerType = asm.GetType("Saga.Dungeon.World.Gesturer", false);
                    if (_gesturerType != null) break;
                }
            }
            return _gesturerType != null && FindFirstObjectByType(_gesturerType) != null;
        }

        /// <summary>몸을 찾는다(늦게 지어진 몸도 — 진단·몸 교체 뒤 다시 부른다).</summary>
        public void Bind()
        {
            _bound = true;
            _animator = GetComponentInChildren<Animator>();
            _bones = null;
            _hands[0] = _hands[1] = null;
            _armIdleReady = false;
            _hasSpeedParam = false;
            if (_animator == null || !_animator.isHuman || _animator.avatar == null) return;
            foreach (var parameter in _animator.parameters)
                if (parameter.nameHash == SpeedHash && parameter.type == AnimatorControllerParameterType.Float) { _hasSpeedParam = true; break; }
            var b = new Transform[BoneIds.Length];
            for (int i = 0; i < BoneIds.Length; i++)
            {
                b[i] = _animator.GetBoneTransform(BoneIds[i]);
                if (b[i] == null && i != BChest && i != BNeck) return; // 가슴·목은 없는 리그가 있다
            }
            _bones = b;
            _lastSet = new Quaternion[b.Length];
            _lastBase = new Quaternion[b.Length];
            _touched = new bool[b.Length];
        }

        private void LateUpdate()
        {
            float dt = Time.deltaTime;
            if (_player == null && !_npc) _player = transform;
            if (_player == null) { var pg = GameObject.FindWithTag("Player"); _player = pg != null ? pg.transform : null; }
            if (_cam == null) _cam = Camera.main;
            Vector3 d = transform.position - _lastPos;
            _lastPos = transform.position;
            float sp = dt > 0f ? new Vector2(d.x, d.z).magnitude / dt : 0f;
            float vy = dt > 0f ? Mathf.Abs(d.y) / dt : 0f;
            bool still = sp < StillSpeed && vy < StillSpeed;
            Step(dt, still, _player != null ? _player.position : (Vector3?)null, _cam != null ? _cam.transform.position : (Vector3?)null);
            Apply();
        }

        /// <summary>시계 한 걸음(진단이 직접) — 가만히 있음·나·카메라 자리를 넣는다.</summary>
        public void Step(float dt, bool still, Vector3? playerPos, Vector3? camPos)
        {
            // 몸이 바뀌었으면(편성 교체·VRoid 바꿔 끼움) 다시 찾는다.
            if (!_bound || (_animator != null && !_animator.isActiveAndEnabled) || (_bones != null && _bones[BHips] == null)) Bind();
            var idle = GetComponent<NpcIdle>();
            HoldNow = (_hold != null && SafeHold()) || !still || (idle != null && idle.StateName != "Idle") || BusyClip();
            _breathPhase = Mathf.Repeat(_breathPhase + Mathf.Max(0f, dt), BreathPeriod);
            _breathWeight = Mathf.MoveTowards(_breathWeight,
                Breathing && !HoldNow ? 1f : 0f, Mathf.Max(0f, dt) / Blend);
            if (HoldNow)
            {
                StillT = 0f;
                if (Current != Act.None && !(_npc && Current == Act.Wave && still)) { Current = Act.None; ActT = 0f; }
            }
            else StillT += dt;

            if (!_npc)
            {
                float target = !HoldNow && StillT >= SitAfter ? 1f : 0f;
                SitW = Mathf.MoveTowards(SitW, target, dt / Blend);
            }
            else
            {
                // 다가섬 — 반경 안으로 들어서는 순간 한 번 인사(나갔다 오면 또).
                bool near = false;
                if (playerPos.HasValue)
                {
                    var v = playerPos.Value - transform.position; v.y = 0f;
                    near = v.magnitude <= GreetRadius;
                }
                if (near && !_near && !HoldNow) { Play(Act.Wave); Greets++; }
                _near = near;
                // 둘러보기·체중 — 카메라 25m 안에서만, 3~5초마다 번갈아.
                bool camNear = camPos.HasValue && (camPos.Value - transform.position).magnitude <= IdleNear;
                if (!HoldNow && camNear && Current == Act.None)
                {
                    _idleLeft -= dt;
                    if (_idleLeft <= 0f)
                    {
                        Play(_idleFlip++ % 2 == 0 ? Act.Look : Act.Shift);
                        _idleLeft = IdleMin + Hash01(transform.position + Vector3.up * _idleFlip) * (IdleMax - IdleMin);
                    }
                }
            }

            if (Current != Act.None)
            {
                ActT += dt;
                if (ActT >= DurOf(Current)) { Current = Act.None; ActT = 0f; }
            }
        }

        /// <summary>몸짓 하나를 튼다(앉아 있거나 hold 면 안 함).</summary>
        public bool Play(Act a)
        {
            if (a == Act.None || HoldNow || SitW > 0.01f) return false;
            Current = a;
            ActT = 0f;
            return true;
        }

        public static float DurOf(Act a) => a == Act.Wave ? WaveSec : a == Act.Look ? LookSec : a == Act.Shift ? ShiftSec : 0f;

        /// <summary>애니메이터가 대기 아닌 동작(베기·맞기·뛰기 등)을 트는 중인가 — 제자리 연타 중 앉지 않게.</summary>
        private bool BusyClip()
        {
            if (_animator == null || !_animator.isActiveAndEnabled || _animator.runtimeAnimatorController == null) return false;
            if (Motion30.CurrentOf(_animator) != "") return true; // tasks U-0200 R-5 — 행동 클립(줍기·앉기·사다리…) 위에 몸짓을 겹치지 않는다
            var s = _animator.GetCurrentAnimatorStateInfo(0);
            foreach (var n in BusyStates) if (s.IsName(n)) return true;
            return _animator.IsInTransition(0) && !_animator.GetNextAnimatorStateInfo(0).IsName("Idle");
        }
        private static readonly string[] BusyStates = { "Attack", "Hit", "Death", "Jump", "Fall", "Climb", "Swim", "Run", "Walk", "Taunt", "Heal", "Blocked" };

        private bool SafeHold()
        {
            try { return _hold(); }
            catch (Exception) { return true; }
        }

        /// <summary>뼈에 적용(진단도 직접). 휴머노이드가 아니면 아무것도 안 한다.</summary>
        public void Apply()
        {
            if (_bones == null) return;
            RestoreUntouched();
            ApplyArmSwing();
            var body = _animator.transform;
            Vector3 f = Vector3.ProjectOnPlane(body.forward, Vector3.up).normalized;
            if (f.sqrMagnitude < 1e-4f) f = Vector3.forward;
            Vector3 r = Vector3.Cross(Vector3.up, f);
            if (_breathWeight > 0f && SitW < 0.001f && Current == Act.None)
            {
                float breath = Mathf.Sin(_breathPhase * (2f * Mathf.PI / BreathPeriod)) * _breathWeight;
                Turn(BChest, 1.2f * breath, r);
                Turn(BUArm, 0.3f * breath, f);
                Turn(BUArm + 1, -0.3f * breath, f);
            }
            if (SitW > 0.001f) PoseSit(SitW, f, r, body.position.y);
            if (Current == Act.None) return;
            float k = ActT / DurOf(Current);
            float w = Envelope(k);
            switch (Current)
            {
                case Act.Wave:
                    Turn(BUArm + 1, 140f * w, f);
                    Turn(BLArm + 1, 28f * Mathf.Sin(k * Mathf.PI * 6f) * w, f);
                    if (_player != null && _player != transform)
                    {
                        var to = Vector3.ProjectOnPlane(_player.position - body.position, Vector3.up);
                        if (to.sqrMagnitude > 1e-4f) Turn(BHead, Mathf.Clamp(Vector3.SignedAngle(f, to, Vector3.up), -60f, 60f) * w, Vector3.up);
                    }
                    break;
                case Act.Look:
                {
                    float yaw = k < 0.35f ? Mathf.SmoothStep(0f, 34f, k / 0.35f)
                        : k < 0.75f ? Mathf.SmoothStep(34f, -28f, (k - 0.35f) / 0.4f)
                        : Mathf.SmoothStep(-28f, 0f, (k - 0.75f) / 0.25f);
                    Turn(BHead, yaw * 0.5f, Vector3.up);
                    Turn(BNeck, yaw * 0.3f, Vector3.up);
                    Turn(BChest, yaw * 0.2f, Vector3.up);
                    break;
                }
                case Act.Shift:
                {
                    float s = Mathf.Sin(k * Mathf.PI);
                    MoveHips(r * (0.02f * s));
                    Turn(BHips, -4f * s, f);
                    Turn(BSpine, 3f * s, f);
                    Turn(BChest, 2f * s, f);
                    break;
                }
            }
        }

        /// <summary>U-0249: 실제 걷기·달리기 블렌드의 윗팔 움직임을 1.3배 키운다. 공격·피격·공중 동작은 애니메이터 원본을 유지한다.</summary>
        private void ApplyArmSwing()
        {
            if (!Breathing || _npc || _bones == null || _animator == null || !_hasSpeedParam || !_animator.isActiveAndEnabled) return;
            if ((_hold != null && SafeHold()) || SitW > 0.01f || Current != Act.None || _animator.IsInTransition(0)) return;
            if (Motion30.CurrentOf(_animator) != "") return;
            var state = _animator.GetCurrentAnimatorStateInfo(0);
            foreach (var name in ArmSwingBlockedStates) if (state.IsName(name)) return;

            float speed = _animator.GetFloat(SpeedHash);
            if (speed <= 0.05f)
            {
                _armIdleLocal[0] = _bones[BUArm].localRotation;
                _armIdleLocal[1] = _bones[BUArm + 1].localRotation;
                _armIdleReady = true;
                return;
            }
            if (!_armIdleReady) return;

            for (int side = 0; side < 2; side++)
            {
                var arm = _bones[BUArm + side];
                Quaternion delta = Quaternion.Inverse(_armIdleLocal[side]) * arm.localRotation;
                delta.ToAngleAxis(out float angle, out Vector3 axis);
                if (angle > 180f) angle -= 360f;
                if (Mathf.Abs(angle) > 0.001f && axis.sqrMagnitude > 0f)
                    arm.localRotation = _armIdleLocal[side] * Quaternion.AngleAxis(angle * 1.3f, axis);
            }
        }

        /// <summary>앉기 — 엉덩이 내림 + 두 뼈 IK(무릎 위로) + 발 평평 + 몸·팔.</summary>
        private void PoseSit(float w, Vector3 f, Vector3 r, float groundY)
        {
            var feetRest = new Vector3[2];
            var footRot = new Quaternion[2];
            for (int s = 0; s < 2; s++) { feetRest[s] = _bones[BFoot + s].position; footRot[s] = _bones[BFoot + s].rotation; }
            float ankleY = Mathf.Min(feetRest[0].y, feetRest[1].y);
            // 몸 크기 비례 — 수치(웹·고돗)는 엉덩이~발목 0.85m 사람 기준. 1만리 사람은 키 3.4m 라 그만큼 키운다.
            float scale = Mathf.Max(0.3f, (_bones[BHips].position.y - ankleY) / 0.85f);
            // tasks U-0235(고돗 G-0394) — 예전엔 엉덩이 뼈를 발목 높이 + 0.08 에 둬 발목 높이·골반 두께만큼 떴다.
            // 허벅지 뼈 = 땅 + 허벅지 반지름(0.08 × 허벅지 쉬는 높이/0.9), 엉덩이 뼈는 그 위 쉬는 높이 차만큼.
            float thighRest = Mathf.Max(0.05f, Mathf.Min(_bones[BThigh].position.y, _bones[BThigh + 1].position.y) - groundY);
            float thighR = SitHipUp * thighRest / 0.9f;
            float hipOverThigh = _bones[BHips].position.y - Mathf.Min(_bones[BThigh].position.y, _bones[BThigh + 1].position.y);
            float drop = (groundY + thighR + hipOverThigh) - _bones[BHips].position.y;
            if (drop < 0f) MoveHips(Vector3.up * (drop * w));
            Vector3 hip = _bones[BHips].position;
            for (int s = 0; s < 2; s++)
            {
                var thigh = _bones[BThigh + s];
                var calf = _bones[BCalf + s];
                var foot = _bones[BFoot + s];
                Vector3 seat = new Vector3(thigh.position.x, feetRest[s].y, thigh.position.z) + f * (SitFootFwd[s] * scale);
                Vector3 target = Vector3.Lerp(feetRest[s], seat, w);
                TwoBone(thigh, calf, foot, target, Vector3.up + f * 0.3f);
                if (!_touched[BFoot + s]) _lastBase[BFoot + s] = foot.localRotation;
                foot.rotation = footRot[s];
                _lastSet[BFoot + s] = foot.localRotation;
                _touched[BFoot + s] = true;
            }
            Turn(BSpine, SitLean * w, r);
            // 팔 — tasks U-0235(고돗 G-0394): 두 뼈 IK 로 손을 같은 쪽 무릎 위 0.05·엉덩이 쪽 0.04 에, 팔꿈치는 바깥·아래.
            float wk = 0f;
            for (int s = 0; s < 2; s++)
            {
                var ua = _bones[BUArm + s]; var la = _bones[BLArm + s];
                if (ua == null || la == null) continue;
                if (_hands[s] == null && _animator != null) _hands[s] = _animator.GetBoneTransform(s == 0 ? HumanBodyBones.LeftHand : HumanBodyBones.RightHand);
                var hand = _hands[s];
                Vector3 knee = _bones[BCalf + s].position;
                Vector3 toHip = _bones[BHips].position - knee; toHip.y = 0f;
                Vector3 goal = knee + Vector3.up * (0.05f * scale) + (toHip.sqrMagnitude > 1e-6f ? toHip.normalized * (0.04f * scale) : Vector3.zero);
                if (hand != null)
                {
                    Vector3 cur = hand.position;
                    Vector3 pole = (s == 0 ? -r : r) - Vector3.up * 0.6f;
                    TwoBone(ua, la, hand, Vector3.Lerp(cur, goal, w), pole);
                    wk = Mathf.Max(wk, (hand.position - goal).magnitude / scale);
                }
                else
                {
                    Vector3 cur = la.position - ua.position;
                    RotateTo(ua, cur, Vector3.Slerp(cur.normalized, (goal - ua.position).normalized, w));
                }
            }
            SitWristKnee = wk;
            if (w > 0.99f && !_sitLogged && Environment.GetEnvironmentVariable("SAGA_SIT_LOG") == "1")
            {
                _sitLogged = true;
                float ray = Physics.Raycast(_bones[BHips].position + Vector3.up * 0.2f, Vector3.down, out var hit, 10f, ~0, QueryTriggerInteraction.Ignore) ? hit.point.y : float.NaN;
                Debug.Log($"[LifePose] sit 땅 {groundY:F3}·광선 땅 {ray:F3}({(ray.Equals(float.NaN) ? "-" : hit.collider.name)})·발목 {ankleY:F3}·엉덩이 {_bones[BHips].position.y:F3}·허벅지 반지름 {thighR:F3}·scale {scale:F2}·손목–무릎 {wk:F3}·손 {(_hands[0] != null ? _hands[0].position.ToString("F2") : "-")}/{(_hands[1] != null ? _hands[1].position.ToString("F2") : "-")}·무릎 {_bones[BCalf].position:F2}/{_bones[BCalf + 1].position:F2}");
            }
            SitHipGap = (Mathf.Min(_bones[BThigh].position.y, _bones[BThigh + 1].position.y) - thighR - groundY) / scale;
        }

        /// <summary>진단 U-0235 — 앉은 뒤 엉덩이 살 아래와 땅 사이(몸 크기로 나눈 m) · 손목과 무릎 목표 사이 가장 큰 것.</summary>
        public float SitHipGap { get; private set; }
        public float SitWristKnee { get; private set; }
        private bool _sitLogged;

        private readonly Transform[] _hands = new Transform[2];
        /// <summary>손 뼈 자리(없으면 아래팔 첫 자식).</summary>
        private Vector3 HandPos(int side, Transform lowerArm)
        {
            if (_hands[side] == null && _animator != null) _hands[side] = _animator.GetBoneTransform(side == 0 ? HumanBodyBones.LeftHand : HumanBodyBones.RightHand);
            if (_hands[side] != null) return _hands[side].position;
            return lowerArm.childCount > 0 ? lowerArm.GetChild(0).position : lowerArm.position;
        }

        /// <summary>두 뼈 IK — 위 뼈(a)·아래 뼈(b) 를 돌려 끝(c)을 target 으로, 무릎은 pole 쪽.</summary>
        private void TwoBone(Transform a, Transform b, Transform c, Vector3 target, Vector3 pole)
        {
            float l1 = (b.position - a.position).magnitude, l2 = (c.position - b.position).magnitude;
            if (l1 < 1e-4f || l2 < 1e-4f) return;
            Vector3 d = target - a.position;
            float dist = Mathf.Clamp(d.magnitude, Mathf.Abs(l1 - l2) + 1e-3f, l1 + l2 - 1e-3f);
            Vector3 dir = d.normalized;
            float cosA = Mathf.Clamp((l1 * l1 + dist * dist - l2 * l2) / (2f * l1 * dist), -1f, 1f);
            Vector3 perp = Vector3.ProjectOnPlane(pole, dir);
            if (perp.sqrMagnitude < 1e-6f) perp = Vector3.ProjectOnPlane(Vector3.up, dir);
            perp.Normalize();
            Vector3 knee = a.position + (dir * cosA + perp * Mathf.Sqrt(1f - cosA * cosA)) * l1;
            RotateTo(a, b.position - a.position, knee - a.position);
            RotateTo(b, c.position - b.position, (a.position + dir * dist) - b.position);
        }

        private void RotateTo(Transform t, Vector3 from, Vector3 to)
        {
            int i = Array.IndexOf(_bones, t);
            if (i >= 0 && !_touched[i]) _lastBase[i] = t.localRotation;
            t.rotation = Quaternion.FromToRotation(from, to) * t.rotation;
            if (i >= 0) { _lastSet[i] = t.localRotation; _touched[i] = true; }
        }

        private void Turn(int bone, float deg, Vector3 axis)
        {
            var t = _bones[bone];
            if (t == null || Mathf.Abs(deg) < 1e-4f) return;
            if (!_touched[bone]) _lastBase[bone] = t.localRotation;
            t.rotation = Quaternion.AngleAxis(deg, axis) * t.rotation;
            _lastSet[bone] = t.localRotation;
            _touched[bone] = true;
        }

        private void MoveHips(Vector3 worldDelta)
        {
            var h = _bones[BHips];
            if (!_hipTouched) _hipLastBase = h.localPosition;
            h.position += worldDelta;
            _hipLastSet = h.localPosition;
            _hipTouched = true;
        }

        /// <summary>애니메이터가 이번 프레임 뼈를 안 썼으면(= 지난번 우리가 둔 값 그대로) 더하기 전으로 되돌린다.</summary>
        private void RestoreUntouched()
        {
            for (int i = 0; i < _bones.Length; i++)
            {
                if (!_touched[i] || _bones[i] == null) continue;
                if (Quaternion.Angle(_bones[i].localRotation, _lastSet[i]) < 0.01f) _bones[i].localRotation = _lastBase[i];
                _touched[i] = false;
            }
            if (_hipTouched)
            {
                var h = _bones[BHips];
                if ((h.localPosition - _hipLastSet).sqrMagnitude < 1e-10f) h.localPosition = _hipLastBase;
                _hipTouched = false;
            }
        }

        private static float Envelope(float k) =>
            Mathf.SmoothStep(0f, 1f, Mathf.Clamp01(k / 0.15f)) * (1f - Mathf.SmoothStep(0f, 1f, Mathf.Clamp01((k - 0.85f) / 0.15f)));

        private static float Hash01(Vector3 p)
        {
            unchecked
            {
                int h = Mathf.RoundToInt(p.x * 10f) * 73856093 ^ Mathf.RoundToInt(p.y * 10f) * 19349663 ^ Mathf.RoundToInt(p.z * 10f) * 83492791;
                return (h & 0xffff) / 65536f;
            }
        }

        /// <summary>촬영 — 곧장 앉을 만큼 가만히 있었던 것으로.</summary>
        public void ForceSitForTest() => StillT = SitAfter;

        /// <summary>진단 — 시계를 처음으로.</summary>
        public void ResetForTest()
        {
            StillT = 0f; SitW = 0f; Current = Act.None; ActT = 0f; _near = false; Greets = 0;
            _idleLeft = IdleMin;
        }
    }
}
