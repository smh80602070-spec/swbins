using System;
using UnityEngine;
using Saga.Core;

namespace Saga.EditorTools
{
    /// <summary>
    /// tasks U-0236 탈것 탄 자세 진단 — 네 판 탈것 진단(Playtest*Mount)이 흰 말을 태운 자리에서 부른다.
    /// 말·사슴·학·용 차례로 같은 MountRig 에 태워 엉덩이 살 아래 − 등 ≤ 0.04m · 무릎이 몸통 옆 밖(반폭 −0.02 이상) · 발이 등보다 아래 ·
    /// 넓은 몸통(허벅지로 못 감쌈)이면 무릎이 등 위 · 끔이면 손 수치. 끝나면 흰 말로 되돌리고 뼈 회전도 돌려놓는다.
    /// </summary>
    public static class RidePoseCheck
    {
        private static readonly (string id, bool fly)[] Mounts = { ("mt_white", false), ("mt_deer", false), ("mt_crane", true), ("mt_dragon", true) };

        public static void Check(MountRig rig, Transform player, Transform visual, Action<string> fail)
        {
            if (rig == null || player == null || visual == null) { fail("ride-pose: MountRig·기수 없음"); return; }
            // 뼈 회전 사진 — 같은 프레임에 IK 를 덮어 쓰므로(배치 모드는 애니메이터가 곧바로 되돌리지 않을 수 있다) 끝나고 돌려놓는다
            var snap = new System.Collections.Generic.List<(Transform t, Quaternion q)>();
            foreach (var t in visual.GetComponentsInChildren<Transform>(true)) snap.Add((t, t.localRotation));
            var parts = new System.Collections.Generic.List<string>();
            bool any = false;
            foreach (var (id, fly) in Mounts)
            {
                rig.Tick(player, visual, id, fly, false);
                var p = rig.LastPose;
                if (!p.Posed) { parts.Add($"{id} 손 수치(휴머노이드 아님)"); continue; }
                any = true;
                if (Mathf.Abs(p.HipGap) > 0.04f) fail($"ride-pose {id} 엉덩이 살–등 {p.HipGap:F3}m");
                if (!p.Wide)
                {
                    if (p.KneeOutMin < -0.02f) fail($"ride-pose {id} 무릎이 몸통 속 {p.KneeOutMin:F3}m(반폭 {p.HalfW:F2})");
                    if (p.FootBelow <= 0f) fail($"ride-pose {id} 발이 등보다 위 {p.FootBelow:F3}m");
                    parts.Add($"{id} 등 {p.BackY:F2}·살–등 {p.HipGap:F3}·무릎 밖 {p.KneeOutMin:F3}·발 아래 {p.FootBelow:F2}");
                }
                else
                {
                    // 넓은 몸통 — 무릎을 등 위에 얹음: 무릎이 몸통 속(등 아래·반폭 안)이면 안 됨
                    if (p.KneeOverBack < -0.03f && p.KneeOutMin < -0.02f) fail($"ride-pose {id} 넓은 몸통인데 무릎이 몸통 속(등 위 {p.KneeOverBack:F3}·밖 {p.KneeOutMin:F3})");
                    parts.Add($"{id} 등 {p.BackY:F2}(넓음 — 무릎 등 위 {p.KneeOverBack:F3})·살–등 {p.HipGap:F3}");
                }
            }
            // 끔이면 예전 손 수치
            bool on0 = RidePose.On;
            RidePose.On = false;
            rig.Tick(player, visual, "mt_white", false, false);
            if (Mathf.Abs(rig.RiderLiftNow - MountRig.LiftOf("mt_white", false)) > 0.001f) fail("ride-pose 끔인데 손 수치가 아님");
            RidePose.On = on0;
            rig.Tick(player, visual, "mt_white", false, false);
            foreach (var (t, q) in snap) if (t != null) t.localRotation = q;
            Debug.Log($"[RidePose] ride-pose {(any ? "OK" : "SKIP")} - {string.Join(" · ", parts)} · 끔 = 손 수치");
        }
    }
}
