using System.Collections.Generic;
using UnityEngine;

namespace Saga.Core
{
    /// <summary>U-0249 대표 몸의 VRoid 보조 뼈. 애니메이션 위에 부모 회전 지연·중력을 더한다.
    /// 물리 패키지·난수 없이 작은 시간 간격으로 적분하고, 끄거나 몸을 바꾸면 원래 자세를 돌려준다.</summary>
    [DefaultExecutionOrder(100)]
    [DisallowMultipleComponent]
    public sealed class SpringChain : MonoBehaviour
    {
        private sealed class Joint
        {
            public Transform Bone;
            public Quaternion ParentRotation, Base, Applied;
            public Vector3 Angle, Velocity, Direction;
            public bool Touched;
        }

        private readonly List<Joint> _joints = new List<Joint>();
        private Vector3 _lastPosition;
        public int JointCount => _joints.Count;
        public const float MaxAngle = 18f, Stiffness = 90f, Damping = 18f;

        public static SpringChain Attach(GameObject body)
        {
            var chain = body.GetComponent<SpringChain>();
            if (chain == null) chain = body.AddComponent<SpringChain>();
            chain.Bind();
            return chain;
        }

        public void Bind()
        {
            Restore();
            _joints.Clear();
            _lastPosition = transform.position;
            foreach (var bone in GetComponentsInChildren<Transform>(true))
            {
                string name = bone.name.ToLowerInvariant();
                if (!name.StartsWith("j_sec_") || bone.parent == null || bone.childCount == 0) continue;
                if (!name.Contains("hair") && !name.Contains("skirt") && !name.Contains("cape")) continue;
                Vector3 direction = bone.GetChild(0).localPosition;
                if (direction.sqrMagnitude < 1e-8f) continue;
                _joints.Add(new Joint { Bone = bone, ParentRotation = bone.parent.rotation,
                    Direction = (bone.localRotation * direction).normalized });
            }
        }

        private void LateUpdate()
        {
            float dt = Time.deltaTime;
            if (dt <= 0f) return; // 히트스톱·일시정지 때 에너지나 자세를 바꾸지 않는다.
            bool reset = dt > 0.2f || (transform.position - _lastPosition).sqrMagnitude > 9f;
            _lastPosition = transform.position;
            Restore();
            foreach (var joint in _joints)
            {
                var bone = joint.Bone;
                if (bone == null || bone.parent == null) continue;
                Quaternion parent = bone.parent.rotation;
                if (reset)
                {
                    joint.Angle = joint.Velocity = Vector3.zero;
                    joint.ParentRotation = parent;
                    continue;
                }
                Quaternion delta = parent * Quaternion.Inverse(joint.ParentRotation);
                joint.ParentRotation = parent;
                delta.ToAngleAxis(out float degrees, out Vector3 axis);
                if (degrees > 180f) degrees -= 360f;
                if (Mathf.Abs(degrees) > 0.001f && axis.sqrMagnitude > 0f)
                    joint.Velocity -= bone.parent.InverseTransformDirection(axis) * Mathf.Clamp(degrees, -45f, 45f) * 2f;
                Vector3 gravity = bone.parent.InverseTransformDirection(Vector3.down);
                Vector3 target = Vector3.Cross(joint.Direction, gravity) * 3f;
                int steps = Mathf.Max(1, Mathf.CeilToInt(dt * 120f));
                float h = dt / steps;
                for (int i = 0; i < steps; i++)
                {
                    joint.Velocity += ((target - joint.Angle) * Stiffness - joint.Velocity * Damping) * h;
                    joint.Angle += joint.Velocity * h;
                    if (joint.Angle.sqrMagnitude > MaxAngle * MaxAngle)
                    {
                        joint.Angle = joint.Angle.normalized * MaxAngle;
                        float outward = Vector3.Dot(joint.Velocity, joint.Angle.normalized);
                        if (outward > 0f) joint.Velocity -= joint.Angle.normalized * outward;
                    }
                }
                joint.Base = bone.localRotation;
                joint.Applied = joint.Base * Quaternion.Euler(joint.Angle);
                bone.localRotation = joint.Applied;
                joint.Touched = true;
            }
        }

        private void Restore()
        {
            foreach (var joint in _joints)
            {
                if (!joint.Touched || joint.Bone == null) continue;
                if (Quaternion.Angle(joint.Bone.localRotation, joint.Applied) < 0.01f)
                    joint.Bone.localRotation = joint.Base;
                joint.Touched = false;
            }
        }

        private void OnEnable()
        {
            _lastPosition = transform.position;
            foreach (var joint in _joints)
            {
                joint.Angle = joint.Velocity = Vector3.zero;
                if (joint.Bone != null && joint.Bone.parent != null) joint.ParentRotation = joint.Bone.parent.rotation;
            }
        }

        private void OnDisable() => Restore();
        private void OnDestroy() => Restore();
    }
}
