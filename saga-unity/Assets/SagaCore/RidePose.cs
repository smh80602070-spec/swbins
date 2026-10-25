using UnityEngine;

namespace Saga.Core
{
    /// <summary>
    /// tasks U-0236 탈것 탄 자세(고돗 G-0395 짝) — 기수 몸을 탈것 등 위에 앉히고 다리로 몸통을 감싼다. `MountRig.Tick` 이 매 LateUpdate(애니메이터 뒤) 부른다.
    /// 등 높이·몸통 반폭은 손 수치 말고 탈것 몸("Body" 조각) 렌더러 경계에서 잰다.
    /// 기수 허벅지 뼈 = 등 + 허벅지 반지름(0.08 × 허벅지 쉬는 높이/0.9) — visual 을 그만큼 올리고,
    /// 다리 = 두 뼈 IK: 무릎은 옆구리 밖 0.03·앞 0.10(등 아래 0.15), 발은 무릎 아래·뒤 0.15. 허벅지가 짧아 못 감싸면 IK 가 무릎을 앞으로 내민다.
    /// 휴머노이드가 아니면 예전처럼 손 수치로 올리기만.
    /// </summary>
    public static class RidePose
    {
        public static bool On = System.Environment.GetEnvironmentVariable("SAGA_RIDE_POSE") != "0";
        public const float ThighR = 0.08f, KneeOut = 0.03f, KneeFwd = 0.10f, KneeDown = 0.15f, FootBack = 0.15f;

        public struct Result { public bool Posed, Wide; public float BackY, HalfW, HipGap, KneeOutMin, KneeOverBack, FootBelow; }

        /// <summary>탈것 몸의 등 높이(위끝)·몸통 반폭 — "Body" 조각 렌더러 경계(없으면 전체).</summary>
        public static bool Measure(GameObject mount, out float backY, out float halfW, out Vector3 center)
        {
            backY = halfW = 0f; center = default;
            if (mount == null) return false;
            Renderer body = null;
            foreach (var r in mount.GetComponentsInChildren<Renderer>()) if (r.name == "Body") { body = r; break; }
            if (body == null) return false;
            var b = body.bounds;
            backY = b.max.y;
            center = b.center;
            // 몸통은 탈것 앞(+z)으로 놓여 있다 — 옆 반폭 = 로컬 x 크기 절반(돌아 있어도 그대로)
            halfW = Mathf.Abs(body.transform.lossyScale.x) * 0.5f;
            return true;
        }

        /// <summary>기수를 앉힌다. visual = 기수 그림(Animator 가 이 아래), mount = 탈것 몸. 예전 손 수치 lift 는 휴머노이드가 아닐 때만.</summary>
        public static Result Apply(Transform visual, GameObject mount)
        {
            var res = new Result();
            if (visual == null) return res;
            var anim = visual.GetComponentInChildren<Animator>();
            if (anim == null || !anim.isHuman) return res;
            var hips = anim.GetBoneTransform(HumanBodyBones.Hips);
            var th = new[] { anim.GetBoneTransform(HumanBodyBones.LeftUpperLeg), anim.GetBoneTransform(HumanBodyBones.RightUpperLeg) };
            var ca = new[] { anim.GetBoneTransform(HumanBodyBones.LeftLowerLeg), anim.GetBoneTransform(HumanBodyBones.RightLowerLeg) };
            var ft = new[] { anim.GetBoneTransform(HumanBodyBones.LeftFoot), anim.GetBoneTransform(HumanBodyBones.RightFoot) };
            if (hips == null || th[0] == null || th[1] == null || ca[0] == null || ca[1] == null || ft[0] == null || ft[1] == null) return res;
            if (!Measure(mount, out float backY, out float halfW, out var center)) return res;

            // 허벅지 쉬는 높이 — 지금 애니메이션 자세의 발 아래(가장 낮은 발)에서 허벅지까지
            float footLow = Mathf.Min(ft[0].position.y, ft[1].position.y);
            float thighY = Mathf.Min(th[0].position.y, th[1].position.y);
            float thighRest = Mathf.Max(0.05f, thighY - footLow + 0.08f);
            float thighR = ThighR * thighRest / 0.9f;
            float lift = backY + thighR - thighY;
            visual.position += Vector3.up * lift;

            Vector3 f = Vector3.ProjectOnPlane(mount.transform.forward, Vector3.up).normalized;
            if (f.sqrMagnitude < 1e-4f) f = Vector3.forward;
            Vector3 r = Vector3.Cross(Vector3.up, f);
            // 기수 몸통 가운데를 탈것 등 가운데 줄 위로(옆으로 어긋나지 않게)
            Vector3 hipXZ = hips.position; Vector3 off = Vector3.Project(center - hipXZ, r); off.y = 0f;
            visual.position += off;

            float kneeOutMin = float.MaxValue, footBelow = float.MaxValue, kneeOver = float.MaxValue;
            float scale = Mathf.Max(0.3f, thighRest / 0.9f);
            for (int s = 0; s < 2; s++)
            {
                Vector3 side = s == 0 ? -r : r;
                Vector3 axis = new Vector3(center.x, 0f, center.z);
                Vector3 thXZ = new Vector3(th[s].position.x, 0f, th[s].position.z);
                Vector3 along = Vector3.Project(thXZ - axis, f);
                float l2 = (ft[s].position - ca[s].position).magnitude;
                // 먼저 옆구리 감싸기(무릎 = 옆구리 밖 0.03·앞 0.10·등 아래 0.15, 발 = 무릎 아래·뒤 0.15)
                Vector3 knee = axis + along + side * (halfW + KneeOut) + f * (KneeFwd * scale);
                knee.y = backY - KneeDown * scale;
                Vector3 foot = knee + Vector3.down * (l2 * 0.9f) - f * (FootBack * scale) + side * (0.02f * scale);
                TwoBone(th[s], ca[s], ft[s], foot, knee - th[s].position);
                // 허벅지가 짧아 무릎이 몸통 속에 남으면(넓은 몸통 — 용·몸 작은 기수의 학) 다리를 앞으로 뻗어 등 위에 얹는다(고돗 G-0395)
                if (Vector3.Dot(ca[s].position - center, side) - halfW < -0.02f)
                {
                    res.Wide = true;
                    float l1 = (ca[s].position - th[s].position).magnitude;
                    Vector3 k2 = th[s].position + f * (l1 * 0.8f) + side * (l1 * 0.35f);
                    k2.y = backY + thighR;
                    Vector3 f2 = k2 + f * (l2 * 0.6f) + side * (l2 * 0.35f);
                    f2.y = backY + thighR * 0.5f;
                    TwoBone(th[s], ca[s], ft[s], f2, Vector3.up);
                }
                // 무릎이 몸통 옆 밖인가(반폭 기준)
                float kOut = Vector3.Dot(ca[s].position - center, side) - halfW;
                kneeOutMin = Mathf.Min(kneeOutMin, kOut);
                kneeOver = Mathf.Min(kneeOver, ca[s].position.y - backY);
                footBelow = Mathf.Min(footBelow, backY - ft[s].position.y);
            }
            res.Posed = true;
            res.BackY = backY; res.HalfW = halfW;
            res.HipGap = (Mathf.Min(th[0].position.y, th[1].position.y) - thighR) - backY;
            res.KneeOutMin = kneeOutMin; res.FootBelow = footBelow; res.KneeOverBack = kneeOver;
            return res;
        }

        /// <summary>두 뼈 IK — 위 뼈(a)·아래 뼈(b)를 돌려 끝(c)을 target 으로, 무릎은 pole 쪽.</summary>
        public static void TwoBone(Transform a, Transform b, Transform c, Vector3 target, Vector3 pole)
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
            a.rotation = Quaternion.FromToRotation(b.position - a.position, knee - a.position) * a.rotation;
            b.rotation = Quaternion.FromToRotation(c.position - b.position, (a.position + dir * dist) - b.position) * b.rotation;
        }
    }
}
