using System.Reflection;
using Unity.Cinemachine;
using UnityEngine;
using Saga.Story.Cinematics;
using Saga.Story.Player;
using Saga.Story.UI;
using Saga.Story.World;

namespace Saga.EditorTools
{
    /// <summary>
    /// PLAN.md 106-8 "STORY 두목 등장 컷" 진단 — `PlaytestStorySlice` 가 Init 단계에서 부른다(두목이 살아 있고
    /// 플레이어가 아직 두목 곁에 간 적 없을 때). 카메라 하이브리드(브레인·플레이 가상 카메라) · 멀면 안 틂 · 9m 안이면
    /// 틂 · 플레이어 멈춤 · 관문 대장 시간 멈춤 · HUD 꺼짐 · 이름표 글자/페이드 · 넓은→가까운 샷 순간 포효 · 가까운 샷이
    /// 두목 곁 앞쪽 낮은 데 · 넘기면 HUD 복귀 · 한 번만. 컷을 여기서 한 번 틀어 두므로 뒤 단계(두목 곁으로 순간이동)는 안 막힌다.
    /// </summary>
    public static class PlaytestStoryBossIntro
    {
        private const string T = "[PlaytestStorySlice] boss intro";
        private static bool _ok;

        public static bool Run()
        {
            _ok = true;
            var playerGo = GameObject.FindWithTag("Player");
            var pc = playerGo != null ? playerGo.GetComponent<StoryPlayerController>() : null;
            var cc = playerGo != null ? playerGo.GetComponent<CharacterController>() : null;
            var cuts = StoryCutscenes.Instance;
            StoryEnemy boss = null;
            foreach (var e in StoryEnemy.All) if (e != null && e.IsBoss) boss = e;
            var hud = Object.FindFirstObjectByType<StoryHud>();
            if (pc == null || cuts == null || boss == null || hud == null)
            {
                Fail($"필요한 것 없음(player {pc != null}, 컷 {cuts != null}, 두목 {boss != null}, HUD {hud != null}) — 씬 재빌드?");
                return false;
            }
            Vector3 start = playerGo.transform.position;
            string metrics = "";
            try
            {
                // ── 카메라 하이브리드
                var cam = Camera.main;
                if (cam == null || cam.GetComponent<CinemachineBrain>() == null) Fail("실제 카메라에 CinemachineBrain 이 없다");
                var follow = StoryCameraFollow.Instance;
                if (follow == null || follow.GetComponent<CinemachineCamera>() == null) Fail("StoryCameraFollow 가 플레이 가상 카메라에 없다");
                if (boss.IntroPlayed) Fail("아무도 안 다가갔는데 이미 컷이 돌았다");

                // ── 멀면 안 튼다
                Teleport(cc, playerGo.transform, new Vector3(boss.transform.position.x - 20f, start.y, 0f));
                if (boss.CheckIntro() || StoryCutscenes.Playing) Fail("20m 밖에서 등장 컷이 돌았다");

                // ── 9m 안
                Teleport(cc, playerGo.transform, new Vector3(boss.transform.position.x - 6f, start.y, 0f));
                int plays = cuts.PlayCount;
                if (!boss.CheckIntro() || !StoryCutscenes.Playing) Fail("6m 안인데 등장 컷이 안 돌았다");
                string wantName = boss.DisplayName; // 109-11-3 — 관문 대장(새 게임은 늘 승격)이면 이번 주 관문 대장 이름
                if (cuts.ShownName != wantName) Fail($"이름표 글자 \"{cuts.ShownName}\" (기대 \"{wantName}\")");
                if (hud.GetComponentInParent<Canvas>().enabled) Fail("컷 동안 HUD 가 켜져 있다");

                // 멈춤 — 플레이어 Update 가 일찍 돌아간다(쿨다운이 안 준다), 관문 대장 시간이 안 준다.
                SetPrivate(pc, "_attackCooldownLeft", 1f);
                Invoke(pc, "Update");
                if (!Mathf.Approximately((float)GetPrivate(pc, "_attackCooldownLeft"), 1f)) Fail("컷 동안 플레이어가 멈추지 않았다");
                SetPrivate(pc, "_attackCooldownLeft", 0f);
                if (boss.IsChampion)
                {
                    float left = boss.ChampionTimeLeft;
                    Invoke(boss, "Update");
                    if (!Mathf.Approximately(left, boss.ChampionTimeLeft)) Fail("컷 동안 관문 대장 시간이 줄었다");
                }

                cuts.Seek(1.0);
                cuts.Tick(0.01f);
                if (cuts.RoarFired) Fail("포효가 너무 일찍");
                if (cuts.NameAlpha > 0f) Fail("이름표가 넓은 샷에서 벌써 떴다");
                cuts.Seek(2.6);
                cuts.Tick(0.01f);
                if (!cuts.RoarFired) Fail("넓은→가까운 샷 순간 포효 신호가 없다");
                if (cuts.NameAlpha <= 0.5f) Fail($"가까운 샷에서 이름표가 안 떴다 (α {cuts.NameAlpha:0.00})");
                var close = cuts.CameraOf(true);
                if (close == null || cuts.CameraOf(false) == null) Fail("등장 컷 카메라가 없다");
                else
                {
                    Vector3 bp = boss.transform.position;
                    float d = Vector3.Distance(close.transform.position, bp);
                    if (d > 4.5f) Fail($"가까운 샷이 두목에게서 멀다 ({d:0.0}m)");
                    if (close.transform.position.z >= bp.z) Fail("가까운 샷이 두목 뒤(화면 안쪽)에 섰다");
                    if (close.transform.position.y > bp.y + 1f) Fail("가까운 샷이 올려다보지 않는다");
                    metrics += $" 가까운 샷 {d:0.0}m";
                }

                cuts.Skip();
                if (StoryCutscenes.Playing) Fail("등장 컷이 안 넘어갔다");
                if (!hud.GetComponentInParent<Canvas>().enabled) Fail("컷 뒤 HUD 가 안 돌아왔다");
                if (!boss.IntroPlayed || boss.CheckIntro()) Fail("등장 컷이 한 번만이 아니다");
                if (cuts.PlayCount - plays != 1) Fail($"컷 수 {cuts.PlayCount - plays} ≠ 1");
            }
            finally
            {
                cuts.Skip();
                Teleport(cc, playerGo.transform, start);
            }
            if (_ok) Debug.Log($"{T} OK - 브레인·플레이 가상 카메라·멀면 안 틂·9m 틂·플레이어/관문 대장 시간 멈춤·HUD·이름표·포효·가까운 샷·넘김·한 번 |{metrics}");
            return _ok;
        }

        private static void Teleport(CharacterController cc, Transform t, Vector3 pos)
        {
            if (cc != null) cc.enabled = false;
            t.position = pos;
            if (cc != null) cc.enabled = true;
        }

        private static void Invoke(object target, string method) =>
            target.GetType().GetMethod(method, BindingFlags.NonPublic | BindingFlags.Instance)?.Invoke(target, null);

        private static object GetPrivate(object target, string field) =>
            target.GetType().GetField(field, BindingFlags.NonPublic | BindingFlags.Instance)?.GetValue(target);

        private static void SetPrivate(object target, string field, object value) =>
            target.GetType().GetField(field, BindingFlags.NonPublic | BindingFlags.Instance)?.SetValue(target, value);

        private static void Fail(string msg)
        {
            Debug.LogError($"{T}: {msg}");
            _ok = false;
        }
    }
}
