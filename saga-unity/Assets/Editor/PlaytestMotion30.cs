using System.Linq;
using UnityEditor;
using UnityEngine;
using Saga.Core;

namespace Saga.EditorTools
{
    /// <summary>
    /// tasks U-0200 ① 모션 30 진단 — `PlaytestDungeonHeadless` 가 부대 우정 뒤에 부른다(한 프레임 안).
    /// ① 구운 클립 30(Resources/Clips30, Humanoid) — 로컬 설치가 없으면 SKIP(다른 PC) ② 자세: 주인공 몸에 sit_ground 가운데를 입히면 엉덩이가 0.25m 넘게 내려가고,
    /// cheer 어느 칸엔 오른손이 머리 위 ③ 섞기: 2나락 주인공에 command → 들어감(0.1초 0.5)·끝나면 빔 ④ 움직이면 나옴 · 고리 클립은 정한 초·취소 함수
    /// ⑤ 끄기·없는 이름·Humanoid 아닌 몸은 거짓.
    /// </summary>
    public static class PlaytestMotion30
    {
        private const string T = "[PlaytestDungeonHeadless] motion30";
        private static bool _ok, _step;

        public static bool Run()
        {
            _ok = true;
            var all = Resources.LoadAll<AnimationClip>(Motion30.ResDir.TrimEnd('/'));
            if (all.Length == 0) { Debug.Log($"{T} SKIP - Resources/{Motion30.ResDir} 없음(로컬 설치·BakeClips30 — U-0200 메모)"); return true; }

            // ① 클립
            Begin();
            int human = all.Count(c => c.humanMotion);
            if (all.Length != 30 || human != 30) Fail($"클립 {all.Length}·Humanoid {human} ≠ 30");
            End($"clips OK - {all.Length} · Humanoid {human} · 고리 {all.Count(c => c.isLooping)}");

            // ② 자세
            Begin();
            var hero = AssetDatabase.LoadAssetAtPath<GameObject>(SetupVroidHero.PrefabPath);
            if (hero == null) Fail("hero_vroid 없음");
            else
            {
                var go = (GameObject)Object.Instantiate(hero);
                try
                {
                    var a = go.GetComponent<Animator>();
                    a.enabled = false;
                    var hips = a.GetBoneTransform(HumanBodyBones.Hips);
                    var head = a.GetBoneTransform(HumanBodyBones.Head);
                    var hand = a.GetBoneTransform(HumanBodyBones.RightHand);
                    var lhand = a.GetBoneTransform(HumanBodyBones.LeftHand);
                    var handler = new HumanPoseHandler(a.avatar, go.transform);
                    var stand = AssetDatabase.LoadAssetAtPath<AnimationClip>(BakeClips30.OutDir + "command.anim");
                    BakeClips30.ApplyPose(handler, stand, 0f);
                    float rest = hips.position.y - go.transform.position.y;
                    var sit = AssetDatabase.LoadAssetAtPath<AnimationClip>(BakeClips30.OutDir + "sit_ground.anim");
                    BakeClips30.ApplyPose(handler, sit, sit.length * 0.5f);
                    float sitY = hips.position.y - go.transform.position.y;
                    var cheer = AssetDatabase.LoadAssetAtPath<AnimationClip>(BakeClips30.OutDir + "cheer.anim");
                    float best = -9f;
                    for (int i = 0; i <= 10; i++) { BakeClips30.ApplyPose(handler, cheer, cheer.length * i / 10f); best = Mathf.Max(best, Mathf.Max(hand.position.y, lhand.position.y) - head.position.y); }
                    handler.Dispose();
                    if (rest - sitY < 0.25f) Fail($"앉기 엉덩이 {rest:0.00} → {sitY:0.00}m(덜 내려감)");
                    if (best < 0.05f) Fail($"기쁨 손이 머리 위로 안 감({best:0.00}m)");
                    End($"pose OK - 앉기 엉덩이 {rest:0.00} → {sitY:0.00}m · 기쁨 손(둘 중 높은 쪽) 머리 위 +{best:0.00}m");
                }
                finally { Object.DestroyImmediate(go); }
            }

            // ③ 섞기 · ④ 움직임·고리 · ⑤ 거짓
            var pc = Object.FindFirstObjectByType<Saga.Dungeon.Player.PlayerController>();
            var anim = pc != null ? pc.Animator : null;
            if (anim == null || !anim.isHuman) { Debug.Log($"{T} blend SKIP - 2나락 주인공이 Humanoid 아님(VRoid 몸 없음)"); return _ok; }
            var t0 = anim.transform.localPosition;
            try
            {
                Begin();
                if (!Motion30.Play(anim, "command")) Fail("command 못 틂");
                var m = anim.GetComponent<Motion30>();
                m.StepForTest(0.1f);
                float w1 = m.Weight;
                if (Motion30.CurrentOf(anim) != "command" || Mathf.Abs(w1 - 0.5f) > 0.05f) Fail($"들어감 {Motion30.CurrentOf(anim)} {w1:0.00}");
                m.StepForTest(Motion30.Clip("command").length + 0.5f);
                if (Motion30.CurrentOf(anim) != "") Fail("끝나도 안 나옴");
                End($"blend OK - command 0.1초 몫 {w1:0.00} · {Motion30.Clip("command").length:0.0}초 뒤 빔");

                Begin();
                Motion30.Play(anim, "sit_ground", 4f);
                m.StepForTest(0.5f);
                anim.transform.position += Vector3.right * 0.5f;
                m.StepForTest(0.05f);
                m.StepForTest(Motion30.Blend);
                if (Motion30.CurrentOf(anim) != "") Fail("0.5m 움직였는데 안 나옴");
                anim.transform.localPosition = t0;
                bool cancel = false;
                Motion30.Play(anim, "ladder", 600f, () => cancel, stopOnMove: false);
                m.StepForTest(1f);
                anim.transform.position += Vector3.up * 1f;
                m.StepForTest(5f);
                bool still = Motion30.CurrentOf(anim) == "ladder";
                cancel = true;
                m.StepForTest(0.05f);
                m.StepForTest(Motion30.Blend);
                if (!still || Motion30.CurrentOf(anim) != "") Fail($"사다리 오르는 중 {still} · 취소 뒤 {Motion30.CurrentOf(anim)}");
                End("move OK - 0.5m 걸으면 나옴 · 사다리(움직여도 그대로·취소 함수로 나옴)");

                Begin();
                Motion30.On = false;
                bool off = Motion30.Play(anim, "cheer");
                Motion30.On = true;
                if (off || Motion30.Play(anim, "no_such_clip") || Motion30.Play(null, "cheer")) Fail("끔·없는 이름·빈 몸인데 틂");
                End("off OK - 끔·없는 이름·빈 몸은 거짓");
            }
            finally
            {
                Motion30.On = true;
                Motion30.Stop(anim);
                anim.transform.localPosition = t0;
            }
            return _ok;
        }

        private static void Begin() => _step = true;
        private static void End(string line) { if (_step) Debug.Log($"{T} {line}"); }

        private static void Fail(string why)
        {
            _ok = false;
            _step = false;
            Debug.LogError($"{T} FAIL - {why}");
        }
    }
}
