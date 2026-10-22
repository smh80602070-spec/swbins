using UnityEngine;
using Saga.Dungeon.Data;
using Saga.Dungeon.Player;

namespace Saga.EditorTools
{
    /// <summary>
    /// tasks U-0159 웹 대조 S 묶음 ① 2나락 몫 — `PlaytestDungeonHeadless` 가 부서지는 소품 뒤에 부른다(한 프레임 안).
    /// 흔들림 규격(평타 : 강공격 = 4 : 6, 120ms) · 무기 등급 잔광(등급 0 없음 · 1 = 0.16초 · 2 = 0.22초 · 친 한 대에 켜지고 휘두른 뒤 꺼짐).
    /// 끝나면 영웅(무기)을 시작 때로.
    /// </summary>
    public static class PlaytestDungeonHitFx
    {
        private const string T = "[PlaytestDungeonHeadless] hitfx";
        private static bool _ok;

        public static bool Run()
        {
            _ok = true;
            var playerGo = GameObject.FindWithTag("Player");
            var wv = playerGo != null ? playerGo.GetComponent<WeaponVisual>() : null;
            if (wv == null) { Fail("WeaponVisual 없음"); return false; }
            int lv = HeroState.Level, exp = HeroState.Exp, hp = HeroState.Hp, gold = HeroState.Gold;
            string weapon = HeroState.EquippedWeaponId, gem = HeroState.SocketedGemId;
            try
            {
                if (Mathf.Abs(PlayerCombat.HitShakeMag / 0.12f - 4f / 6f) > 0.01f || !Mathf.Approximately(PlayerCombat.HitShakeSec, 0.12f))
                    Fail($"평타 흔들림 {PlayerCombat.HitShakeMag}/{PlayerCombat.HitShakeSec}");
                var trail = wv.GradeTrail;
                if (trail == null) { Fail("잔광 없음"); return false; }
                string[] ids = { "wp_start", "wp_saber", "wp_glaive" };
                for (int g = 0; g < ids.Length; g++)
                {
                    HeroState.Restore(lv, exp, hp, gold, ids[g], gem);
                    if (!Mathf.Approximately(trail.time, WeaponVisual.TrailSec[g])) Fail($"등급 {g} 잔광 {trail.time} ≠ {WeaponVisual.TrailSec[g]}");
                    wv.OnStruck();
                    bool on = wv.TrailEmitting;
                    if (on != (g >= 1)) Fail($"등급 {g} 친 뒤 잔광 {on}");
                    if (g >= 1 && trail.startColor.a <= 0.5f) Fail($"등급 {g} 잔광 빛 {trail.startColor}");
                    trail.emitting = false;
                }
                if (WeaponVisual.TrailSec[2] <= WeaponVisual.TrailSec[1] || WeaponVisual.TrailSec[1] <= 0f) Fail("잔광이 단마다 안 길어짐");
            }
            finally
            {
                HeroState.Restore(lv, exp, hp, gold, weapon, gem);
                if (wv.GradeTrail != null) { wv.GradeTrail.emitting = false; wv.GradeTrail.Clear(); }
            }
            if (_ok) Debug.Log($"{T} OK - 흔들림 평타 {PlayerCombat.HitShakeMag}/{PlayerCombat.HitShakeSec}s(강공격 4:6) · 잔광 등급 0 없음·1 {WeaponVisual.TrailSec[1]}s·2 {WeaponVisual.TrailSec[2]}s(친 한 대에 켜짐)");
            return _ok;
        }

        private static void Fail(string why)
        {
            _ok = false;
            Debug.LogError($"{T} FAIL - {why}");
        }
    }
}
