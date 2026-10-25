using System;
using System.Collections.Generic;
using System.Reflection;
using UnityEngine;
using Saga.Go.Combat;
using Saga.Go.Data;
using Saga.Go.World;

namespace Saga.EditorTools
{
    /// <summary>
    /// tasks U-0227 ① 핏빛 달 밤 진단 — `PlaytestHeadless` 끝 무렵(한 프레임 안).
    /// ① 한 해 붉은 밤 수(다섯에 하나 꼴)·새벽은 전날 밤·낮엔 안 붉음 ② 붉어지면 배율 2·덧칠 · 쓰러진 잡몹이 일어날 차례(타이머 0)·수호장은 그대로
    /// ③ 꺼지면 배율 1 ④ 끔 손잡이. 끝나면 쓰러뜨린 적·손잡이를 되돌린다.
    /// </summary>
    public static class PlaytestGoBloodMoon
    {
        private const string T = "[PlaytestHeadless] blood-moon";
        private const BindingFlags PI = BindingFlags.Instance | BindingFlags.Public | BindingFlags.NonPublic;

        public static bool Run()
        {
            bool ok = true;
            void Fail(string why) { ok = false; Debug.LogError($"{T} FAIL - {why}"); }
            var field = BloodMoonField.Instance;
            if (field == null) { Debug.LogError($"{T} FAIL - BloodMoonField 없음"); return false; }
            bool on0 = GoBloodMoon.On, force0 = GoBloodMoon.ForceRed, always0 = GoNight.AlwaysNightForTest;
            var stateP = typeof(FieldEnemy).GetProperty(nameof(FieldEnemy.CurrentState), PI);
            var timerF = typeof(FieldEnemy).GetField("_timer", PI);
            var reviveM = typeof(FieldEnemy).GetMethod("Revive", PI);
            var downed = new List<FieldEnemy>();
            try
            {
                GoBloodMoon.On = true; GoBloodMoon.ForceRed = false; GoNight.AlwaysNightForTest = false;
                // ① 셈
                long d0 = GoBloodMoon.NightDay(new DateTime(2026, 1, 1, 22, 0, 0));
                int red = 0;
                for (int i = 0; i < 365; i++) if (GoBloodMoon.IsBloodNight(d0 + i)) red++;
                if (red < 50 || red > 95) Fail($"2026 한 해 붉은 밤 {red}(다섯에 하나 꼴 기대)");
                if (GoBloodMoon.NightDay(new DateTime(2026, 10, 25, 2, 0, 0)) != GoBloodMoon.NightDay(new DateTime(2026, 10, 24, 22, 0, 0))) Fail("새벽 2시가 전날 밤이 아님");
                if (GoBloodMoon.IsBloodNight(d0 + 7) != GoBloodMoon.IsBloodNight(d0 + 7)) Fail("같은 밤이 다르게 굴림");
                long anyRed = d0; while (!GoBloodMoon.IsBloodNight(anyRed)) anyRed++;
                var redNoon = new DateTime(1970, 1, 1).AddDays(anyRed).AddHours(12);
                var redNight = new DateTime(1970, 1, 1).AddDays(anyRed).AddHours(22);
                if (GoBloodMoon.RedAt(redNoon)) Fail("붉은 밤 날의 한낮이 붉음");
                if (!GoBloodMoon.RedAt(redNight)) Fail("붉은 밤 날 밤 22시가 안 붉음");
                if (ok) Debug.Log($"{T} roll OK - 2026 붉은 밤 {red}/365 · 새벽은 전날 밤 · 낮엔 안 붉음");

                // ② 붉어짐 — 잡몹 하나를 쓰러뜨려 두고
                FieldEnemy grunt = null, guard = null;
                foreach (var e in FieldEnemy.All)
                {
                    if (e == null || !e.Alive) continue;
                    if (grunt == null && !e.IsGuardian && !e.DomainFoe && !e.StoryFoe && !e.IsHero) grunt = e;
                    if (guard == null && e.IsGuardian) guard = e;
                }
                if (grunt == null) Fail("들판 잡몹 없음");
                else
                {
                    stateP.SetValue(grunt, FieldEnemy.State.Dead); timerF.SetValue(grunt, FieldEnemy.RespawnSec); downed.Add(grunt);
                    if (guard != null) { stateP.SetValue(guard, FieldEnemy.State.Dead); timerF.SetValue(guard, float.MaxValue); downed.Add(guard); }
                    field.SetRed(true);
                    if (!GoBloodMoon.Active || GoBloodMoon.Mul != 2 || !field.VeilShown) Fail($"붉어졌는데 배율 {GoBloodMoon.Mul}·덧칠 {field.VeilShown}");
                    int n = field.Rise();
                    float t = (float)timerF.GetValue(grunt);
                    if (n < 1 || t > 0.01f) Fail($"일으킴 {n}·잡몹 타이머 {t}(0 기대)");
                    if (guard != null && (float)timerF.GetValue(guard) < 1e30f) Fail("수호장까지 일으킴(꽃 규칙)");
                    if (ok) Debug.Log($"{T} rise OK - 배율 ×2·붉은 덧칠 · 쓰러진 잡몹 {n} 일어설 차례 · 수호장 그대로");
                }

                // ③ 꺼짐 ④ 끔
                field.SetRed(false);
                if (GoBloodMoon.Active || GoBloodMoon.Mul != 1 || field.VeilShown) Fail("꺼졌는데 배율·덧칠 남음");
                GoBloodMoon.On = false;
                if (GoBloodMoon.RedAt(redNight)) Fail("끔인데 붉음");
                if (ok) Debug.Log($"{T} off OK - 꺼지면 ×1 · 손잡이 끄면 안 붉음");
            }
            finally
            {
                field.SetRed(false);
                GoBloodMoon.On = on0; GoBloodMoon.ForceRed = force0; GoNight.AlwaysNightForTest = always0;
                foreach (var e in downed) if (e != null && !e.Alive) reviveM.Invoke(e, null);
            }
            return ok;
        }
    }
}
