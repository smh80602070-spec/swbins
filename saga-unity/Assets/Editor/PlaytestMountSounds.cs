using System.Collections.Generic;
using UnityEngine;
using Saga.Core;

namespace Saga.EditorTools
{
    /// <summary>
    /// tasks U-0237 탈것 발굽·날갯짓 — 네 판 헤드리스가 부른다(`mount-sounds` 줄). 공용 <see cref="MountSounds"/> 를 기록기로 돌린다:
    /// 말로 풀밭 20m(6m/s) → hoof_soft · 돌 → hoof_hard · 안 탐 → 0 · 학 떠서 2초 → wing_flap 4 · 용 2초 → wing_heavy 2~3 · 학이 땅을 걸음 → 0 · 끔 → 0.
    /// 소리 파일(`Resources/Audio/Sfx/sfx_hoof_*`·`sfx_wing_*`)이 있는지도 본다(없으면 FAIL — K-0189 배치 확인).
    /// </summary>
    public static class PlaytestMountSounds
    {
        public static bool Run(string tag)
        {
            bool ok = true;
            void Fail(string m) { ok = false; Debug.LogError($"[{tag}] mount-sounds FAIL - {m}"); }
            var log = new List<string>();
            var ms = new MountSounds((n, v) => log.Add(n));
            int Walk(bool riding, bool fly, bool air, bool heavy, bool grounded, string surface, float sec, float speed)
            {
                log.Clear(); ms.Reset();
                Vector3 p = Vector3.zero;
                float dt = 1f / 30f;
                for (float t = 0f; t < sec; t += dt) { p += Vector3.forward * speed * dt; ms.Tick(p, riding, fly, air, heavy, grounded, surface, dt); }
                return log.Count;
            }
            int soft = Walk(true, false, false, false, true, StepSounds.Grass, 20f / 6f, 6f);
            if (soft < 4 || soft > 7 || log.Exists(n => n != "hoof_soft")) Fail($"말 풀밭 20m 발굽 {soft}({string.Join(",", log)})");
            int hard = Walk(true, false, false, false, true, StepSounds.Stone, 20f / 6f, 6f);
            if (hard < 4 || log.Exists(n => n != "hoof_hard")) Fail($"말 돌길 발굽 {hard}");
            if (Walk(false, false, false, false, true, StepSounds.Grass, 3f, 6f) != 0) Fail("안 탔는데 발굽");
            int flap = Walk(true, true, true, false, false, StepSounds.Grass, 2f, 8f);
            if (flap < 3 || flap > 5 || log.Exists(n => n != "wing_flap")) Fail($"학 2초 날갯짓 {flap}");
            int heavy = Walk(true, true, true, true, false, StepSounds.Grass, 2f, 8f);
            if (heavy < 2 || heavy > 3 || log.Exists(n => n != "wing_heavy")) Fail($"용 2초 날갯짓 {heavy}");
            if (Walk(true, true, false, false, true, StepSounds.Grass, 3f, 6f) != 0) Fail("학이 땅을 걷는데 소리");
            StepSounds.ForcedEnabled = false;
            int off = Walk(true, false, false, false, true, StepSounds.Grass, 3f, 6f);
            StepSounds.ForcedEnabled = null;
            if (off != 0) Fail($"끔인데 {off}");
            foreach (var n in new[] { "hoof_soft_1", "hoof_hard_1", "wing_flap_1", "wing_heavy_1" })
                if (Resources.Load<AudioClip>("Audio/Sfx/sfx_" + n) == null) Fail($"소리 없음 sfx_{n}");
            if (ok) Debug.Log($"[{tag}] mount-sounds OK - 말 풀 20m 발굽 {soft}(soft)·돌 {hard}(hard)·안 탐 0·학 2초 {flap}·용 2초 {heavy}·학 땅 0·끔 0·소리 파일 넷");
            return ok;
        }
    }
}
