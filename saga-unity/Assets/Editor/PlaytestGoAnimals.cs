using System.Linq;
using UnityEngine;
using Saga.Go.Combat;
using Saga.Go.Player;
using Saga.Go.World;

namespace Saga.EditorTools
{
    /// <summary>
    /// R-3 `un.go.animals`(PLAN 24~27장 동물 Idle/Wander/Flee/Group · 마을 나그네) 진단 — `PlaytestHeadless` 가 약점 뒤에 부른다(한 프레임 안, 규칙은 `TickForTest`).
    /// ① 동물 넷 이상·충돌 없음(전투 대상 아님)·나그네 NPC 있음 ② 배회: 쉼 끝 → 서식지 반경 안 걸을 칸 목표 · 한 번 돌면 그쪽으로 움직임
    /// ③ 놀람: 내가 16m 안 → 달아남 · 40m 안 다른 동물도 같이(무리) · 멀어지는 쪽 목표 ④ 진정: 30m 밖이면 쉼. 끝나면 동물·주인공 자리를 처음으로.
    /// </summary>
    public static class PlaytestGoAnimals
    {
        private const string T = "[PlaytestHeadless] animals";
        private static bool _ok, _step;

        public static bool Run()
        {
            _ok = true;
            var fc = FieldCombat.Instance;
            var pc = fc != null ? fc.GetComponent<PlayerController>() : null;
            var all = WanderingAnimal.All.Where(a => a != null).ToList();
            if (pc == null || all.Count == 0) { Debug.LogError($"{T} FAIL - 주인공·동물 없음({all.Count})"); return false; }
            try
            {
                foreach (var a in all) a.ResetForTest();

                // ① 있음
                Begin();
                int colliders = all.Sum(a => a.GetComponentsInChildren<Collider>(true).Length);
                var traveler = GameObject.Find("Villager_npc_traveler");
                if (all.Count < 4) Fail($"동물 {all.Count} < 4");
                if (colliders > 0) Fail($"동물 충돌 {colliders}(전투 대상 아님)");
                if (traveler == null) Fail("나그네 없음");
                End($"exist OK - 동물 {all.Count} · 충돌 0 · 나그네 @ {(traveler != null ? traveler.transform.position.ToString("F0") : "-")}");

                // ② 배회 — 주인공을 모든 동물에서 멀리
                Begin();
                var a0 = all[0];
                Vector3 far = a0.Origin + new Vector3(0f, 0f, 200f);
                pc.Teleport(far);
                a0.EndIdleForTest();
                a0.TickForTest();
                bool wander = a0.StateName == "Wander";
                float fromOrigin = Flat(a0.Target - a0.Origin).magnitude;
                Vector3 p0 = a0.transform.position;
                for (int i = 0; i < 10; i++) a0.TickForTest();
                float moved = Flat(a0.transform.position - p0).magnitude;
                if (!wander || fromOrigin > WanderingAnimal.WanderRadiusForTest + 0.01f) Fail($"배회 {a0.StateName}·목표 {fromOrigin:0.0}m");
                if (wander && fromOrigin > 1f && moved <= 0f) Fail("배회인데 안 움직임");
                End($"wander OK - 쉼 끝 → 배회 · 목표 서식지 {fromOrigin:0.0}m(≤{WanderingAnimal.WanderRadiusForTest}) · 열 번 {moved:0.00}m");

                // ③ 놀람·무리
                Begin();
                foreach (var a in all) a.ResetForTest();
                var mates = all.Where(b => b != a0 && Flat(b.transform.position - a0.transform.position).magnitude <= WanderingAnimal.GroupAlertRadiusForTest).ToList();
                pc.Teleport(a0.transform.position + new Vector3(WanderingAnimal.FleeAlertRadiusForTest - 4f, 0f, 0f));
                a0.TickForTest();
                bool fled = a0.StateName == "Flee";
                bool away = Flat(a0.Target - pc.transform.position).magnitude > Flat(a0.transform.position - pc.transform.position).magnitude;
                int mateFled = mates.Count(b => b.StateName == "Flee");
                if (!fled || !away) Fail($"놀람 {a0.StateName}·멀어지는 목표 {away}");
                if (mateFled != mates.Count) Fail($"무리 {mateFled}/{mates.Count} 만 달아남");
                End($"flee OK - 12m 에 놀라 달아남(멀어지는 목표) · 40m 안 무리 {mateFled}/{mates.Count} 같이");

                // ④ 진정
                Begin();
                pc.Teleport(a0.transform.position + new Vector3(WanderingAnimal.FleeStopRadiusForTest + 10f, 0f, 0f));
                a0.TickForTest();
                if (a0.StateName != "Idle") Fail($"멀어졌는데 {a0.StateName}");
                End("calm OK - 30m 밖이면 진정(쉼)");
            }
            finally
            {
                foreach (var a in all) if (a != null) a.ResetForTest();
                pc.Teleport(fc.SafePoint);
            }
            return _ok;
        }

        private static Vector3 Flat(Vector3 v) { v.y = 0f; return v; }
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
