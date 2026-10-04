using TMPro;
using System.Collections.Generic;
using System.Reflection;
using UnityEngine;
using Saga.Dungeon.Cinematics;
using Saga.Dungeon.Data;
using Saga.Dungeon.Player;
using Saga.Dungeon.UI;
using Saga.Dungeon.World;

namespace Saga.EditorTools
{
    /// <summary>
    /// PLAN.md 106-6 "FF 확장" 진단 — `PlaytestDungeonHeadless` 가 탐험 진단 앞에서 부른다. 씬의 적을 잠깐 끄고 더미로:
    /// 진짜 평타가 게이지를 채움 · 덜 찬 명령은 안 먹음 · 무사 도발(적이 무사를 쫓고 때림, 플레이어 체력 그대로, 받는 피해 40%)
    /// · 무사 쓰러짐(도발 풀림·명령 막힘·HUD "쓰러짐") · 술사 치유(플레이어 +40%·무사 일으킴) · 12초 뒤 스스로 일어남 ·
    /// 술사 빛살(쏘고·날아가 맞힘·술사 게이지) · 붙으면 물러섬 · 소환(덜 참/곁에 적 없음 → 안 먹음 → 컷 · HUD 꺼짐 ·
    /// 3.2초 내리치기 14m 안만 · 넘겨도 피해 한 번 · 컷 전에 넘기면 그 자리에서 내리침). 끝나면 자리·체력·게이지를 되돌린다.
    /// </summary>
    public static class PlaytestDungeonParty
    {
        private const string T = "[PlaytestDungeonHeadless] party";
        private static bool _ok;
        private static readonly List<GameObject> Spawned = new List<GameObject>();

        public static bool Run()
        {
            _ok = true;
            var playerGo = GameObject.FindWithTag("Player");
            var party = playerGo != null ? playerGo.GetComponent<PartyCommands>() : null;
            var combat = playerGo != null ? playerGo.GetComponent<PlayerCombat>() : null;
            var pc = playerGo != null ? playerGo.GetComponent<PlayerController>() : null;
            var guard = AllyFighter.Instance;
            var mystic = AllyMystic.Instance;
            var hud = Object.FindFirstObjectByType<PartyHud>();
            var cuts = DungeonCutscenes.Instance;
            if (party == null || combat == null || pc == null || guard == null || mystic == null || hud == null || cuts == null)
            {
                Fail($"필요한 것 없음(명령 {party != null}, 전투 {combat != null}, 무사 {guard != null}, 술사 {mystic != null}, HUD {hud != null}, 컷 {cuts != null}) — 씬 재빌드?");
                return false;
            }

            Vector3 start = playerGo.transform.position;
            Vector3 guardStart = guard.transform.position, mysticStart = mystic.transform.position;
            int level = HeroState.Level, exp = HeroState.Exp, hp = HeroState.Hp, gold = HeroState.Gold;
            string weapon = HeroState.EquippedWeaponId, gem = HeroState.SocketedGemId;
            var others = new List<DungeonEnemy>(DungeonEnemy.Active);
            foreach (var e in others) if (e != null) e.gameObject.SetActive(false);
            string metrics = "";
            try
            {
                cuts.Skip();
                HeroState.FullHeal();
                PartyState.Reset();
                guard.ResetParty();
                Vector3 p = start;

                // ── 게이지: 진짜 평타 한 번
                var dummy = Dummy(p + new Vector3(1.5f, 0f, 0f), 1000f, 5f);
                SetPrivate(combat, "_cooldownLeft", 0f);
                combat.TriggerAttack();
                if (!Near(PartyState.AtbOf(PartyRole.Guard), PartyState.AtbPerPlayerHit)
                    || !Near(PartyState.AtbOf(PartyRole.Mystic), PartyState.AtbPerPlayerHit)
                    || !Near(PartyState.Summon, PartyState.SummonPerPlayerHit))
                {
                    Fail($"평타 한 번 게이지 — 무사 {PartyState.AtbOf(PartyRole.Guard)}·술사 {PartyState.AtbOf(PartyRole.Mystic)}·소환 {PartyState.Summon}");
                }
                if (party.TryOrderGuard() || party.TryOrderMystic()) Fail("덜 찬 게이지로 명령이 먹었다");
                Kill(dummy);

                // ── 무사 도발: 적이 무사를 쫓고 때린다
                guard.transform.position = p + new Vector3(0f, 0f, 12f);
                mystic.transform.position = p + new Vector3(-30f, 0f, 0f); // 술사 빛살이 끼지 않게 멀리.
                var foe = Dummy(p + new Vector3(0f, 0f, 14f), 1000f, 5f);
                PartyState.Fill(PartyRole.Guard);
                float summonBefore = PartyState.Summon;
                if (!party.TryOrderGuard()) Fail("가득 찬 게이지로 도발이 안 먹었다");
                if (PartyState.AtbOf(PartyRole.Guard) > 0f) Fail("도발 뒤 무사 게이지가 안 비었다");
                if (!Near(PartyState.Summon - summonBefore, PartyState.SummonPerCommand)) Fail("명령이 소환 게이지를 안 보탰다");
                if (!foe.IsTaunted) Fail("12m 안 적에 도발이 안 걸렸다");
                bool clips = guard.UsesDeathClip; // 106-6 전용 클립을 받은 PC(Paladin@Taunt·Blocked·HitReaction·Dying)
                // U-0034 VRoid 몸은 Death 만 있고 Taunt·Blocked 가 없다(게임 코드가 Attack 으로 폴백) — 동작별로 파라미터 유무를 본다
                bool hasTaunt = HasParam(guard.Animator, "Taunt"), hasBlocked = HasParam(guard.Animator, "Blocked");
                if (guard.LastTrigger != (hasTaunt ? "Taunt" : "Attack")) Fail($"도발 동작 트리거 {guard.LastTrigger} (전용 클립 {clips})");
                int heroHp = HeroState.Hp;
                float gHp = guard.Hp;
                for (int i = 0; i < 40; i++) foe.Tick(0.05f); // 2초 — 예비동작·판정 한 번 이상.
                float taken = gHp - guard.Hp;
                if (HeroState.Hp != heroHp) Fail($"도발 중인데 플레이어가 맞았다 ({heroHp}→{HeroState.Hp})");
                if (taken <= 0f) Fail("도발 중인 무사가 한 대도 안 맞았다");
                else
                {
                    float hits = taken / (5f * AllyFighter.TauntDamageMul); // 더미 한 대 5 × 40%.
                    if (!Near(hits, Mathf.Round(hits), 0.01f)) Fail($"무사가 받은 피해가 40% 가 아니다 ({taken})");
                }
                metrics += $" 도발 2초 무사 -{taken:0.0}";
                if (hasBlocked && guard.LastTrigger != "Blocked") Fail($"도발 중 맞았는데 방패로 받는 동작이 아니다 ({guard.LastTrigger})");

                // ── 쓰러짐
                if (clips && !hasTaunt) guard.Animator.Update(0.3f); // 시간이 안 흘러 남은 Attack 트리거를 비운다(실제 게임은 프레임마다 소비)
                guard.TakeHit(1000f);
                if (guard.IsUp) Fail("체력이 다해도 무사가 안 쓰러졌다");
                if (clips)
                {
                    if (guard.LastTrigger != "Death") Fail($"쓰러짐 트리거 {guard.LastTrigger}");
                    if (guard.transform.GetChild(0).localRotation != Quaternion.identity) Fail("전용 쓰러짐 클립이 있는데 몸을 절차적으로 눕혔다");
                    guard.Animator.Update(0.3f);
                    if (!guard.Animator.GetCurrentAnimatorStateInfo(0).IsName("Death") && !guard.Animator.GetNextAnimatorStateInfo(0).IsName("Death")) Fail("쓰러짐 상태로 안 넘어갔다");
                }
                if (foe.IsTaunted) Fail("무사가 쓰러졌는데 도발이 안 풀렸다");
                PartyState.Fill(PartyRole.Guard);
                if (party.TryOrderGuard()) Fail("쓰러진 무사에게 도발이 먹었다");
                hud.Refresh();
                var guardLabel = hud.transform.Find("GuardName")?.GetComponent<TMPro.TextMeshProUGUI>();
                if (guardLabel == null || !guardLabel.text.Contains(DungeonLocalization.T("party.hud_down", "쓰러짐")))
                    Fail($"HUD 무사 줄이 쓰러짐을 안 보인다 ({guardLabel?.text})");
                Kill(foe);

                // ── 술사 치유: 플레이어 +40%, 무사 일으킴
                HeroState.TakeDamage(HeroState.HpMax * 0.7f);
                int before = HeroState.Hp;
                PartyState.Fill(PartyRole.Mystic);
                if (!party.TryOrderMystic()) Fail("가득 찬 게이지로 치유가 안 먹었다");
                int want = Mathf.Min(HeroState.HpMax, before + Mathf.CeilToInt(HeroState.HpMax * AllyMystic.HealPlayerFrac));
                if (HeroState.Hp != want) Fail($"치유량 {before}→{HeroState.Hp} (기대 {want})");
                if (!guard.IsUp || guard.Hp < AllyFighter.HpMax * AllyMystic.ReviveGuardFrac - 0.01f) Fail($"치유가 무사를 안 일으켰다 (서 있음 {guard.IsUp}, {guard.Hp})");
                if (mystic.LastTrigger != (mystic.HasOwnClips ? "Heal" : "Attack")) Fail($"치유 시전 트리거 {mystic.LastTrigger} (전용 클립 {mystic.HasOwnClips})");
                if (clips)
                {
                    guard.Animator.Update(0.05f);
                    if (guard.Animator.GetCurrentAnimatorStateInfo(0).IsName("Death")) Fail("일어났는데 쓰러짐 자세에 머문다");
                }
                if (mystic.HasOwnClips && mystic.Animator.runtimeAnimatorController.name.Contains("Maria")) Fail("술사 전용 클립이 있는데 Maria 컨트롤러를 씌웠다");
                metrics += $" · 전용 클립 무사 {clips}·술사 {mystic.HasOwnClips}";

                // ── 스스로 일어남
                guard.TakeHit(1000f);
                guard.TickParty(AllyFighter.DownSec - 0.5f);
                if (guard.IsUp) Fail("12초 전에 일어났다");
                guard.TickParty(0.6f);
                if (!guard.IsUp || !Near(guard.Hp, AllyFighter.HpMax * AllyFighter.GetUpHpFrac)) Fail($"12초 뒤 30% 로 안 일어났다 ({guard.IsUp}, {guard.Hp})");

                // ── 술사 빛살
                guard.transform.position = p + new Vector3(30f, 0f, 0f);
                mystic.transform.position = p + new Vector3(0f, 0f, 6f);
                var target = Dummy(p + new Vector3(0f, 0f, 13f), 1000f, 0f);
                PartyState.Reset();
                int casts = mystic.BoltsCast;
                SetPrivate(mystic, "_castCooldown", 0f);
                mystic.Tick(0.01f);
                if (mystic.BoltsCast != casts + 1) Fail("10m 안 적에게 빛살을 안 쐈다");
                if (mystic.LastTrigger != "Attack") Fail($"빛살 시전 트리거 {mystic.LastTrigger}");
                var bolt = Object.FindObjectsByType<MysticBolt>(FindObjectsSortMode.None);
                if (bolt.Length == 0) Fail("빛살 개체가 없다");
                else
                {
                    float hpBefore = CurHp(target);
                    bool hit = false;
                    for (int i = 0; i < 60 && !hit; i++) hit = bolt[0].Step(0.02f);
                    float dealt = hpBefore - CurHp(target);
                    if (!hit || !Near(dealt, AllyMystic.BoltDamage)) Fail($"빛살이 안 닿았거나 피해가 다르다 (닿음 {hit}, {dealt} / {AllyMystic.BoltDamage})");
                    if (!Near(PartyState.AtbOf(PartyRole.Mystic), PartyState.AtbPerOwnHit)) Fail("빛살이 술사 게이지를 안 채웠다");
                }
                mystic.Tick(0.5f);
                if (mystic.BoltsCast != casts + 1) Fail("1.6초 간격보다 빨리 또 쐈다");
                // 붙으면 물러선다.
                target.transform.position = mystic.transform.position + new Vector3(0f, 0f, 2f);
                float d0 = Vector3.Distance(mystic.transform.position, target.transform.position);
                mystic.Tick(0.5f);
                float d1 = Vector3.Distance(mystic.transform.position, target.transform.position);
                if (d1 <= d0 + 1f) Fail($"붙은 적에게서 안 물러섰다 ({d0:0.00}→{d1:0.00})");
                Kill(target);

                // ── 소환: 안 먹는 경우
                mystic.transform.position = p + new Vector3(-30f, 0f, 0f);
                PartyState.Reset();
                if (party.TrySummon()) Fail("덜 찬 소환 게이지로 소환이 먹었다");
                PartyState.FillSummon();
                var far = Dummy(p + new Vector3(0f, 0f, -20f), 1000f, 0f);
                if (party.TrySummon()) Fail("곁(14m)에 적이 없는데 소환이 먹었다");
                if (!PartyState.SummonReady) Fail("헛소환이 게이지를 썼다");

                // ── 소환: 컷 · 내리치기
                var nearFoe = Dummy(p + new Vector3(0f, 0f, 5f), 1000f, 0f);
                int slams = PartySummon.SlamCount;
                if (!party.TrySummon()) Fail("가득 찬 게이지·곁의 적인데 소환이 안 먹었다");
                var s = party.LastSummon;
                if (PartyState.Summon > 0f) Fail("소환 뒤 게이지가 안 비었다");
                if (!DungeonCutscenes.Playing || cuts.Current != CutsceneKind.Summon) Fail($"소환 컷이 안 돌았다 ({cuts.Current})");
                if (hud.GetComponent<Canvas>().enabled) Fail("소환 컷 동안 파티 HUD 가 켜져 있다");
                if (cuts.CameraOf(CutsceneKind.Summon) == null || cuts.CameraOf(CutsceneKind.Summon, true) == null) Fail("소환 컷 카메라가 없다");
                float expect = HeroState.HitDamage * PartySummon.DamageMul;
                float nearHp = CurHp(nearFoe), farHp = CurHp(far);
                if (s != null)
                {
                    // 106-6 남은 것 "소환수 전용 모델" — 두목 뼈대 위 바위 마디·발광 조각, 두목 살갗은 숨김.
                    var anim = s.GetComponentInChildren<Animator>();
                    if (anim != null && anim.isHuman)
                    {
                        if (s.GolemChunks < 12 || s.GolemRunes < 3) Fail($"바위 거신 마디 {s.GolemChunks}·발광 {s.GolemRunes} (기대 ≥12·3)");
                        foreach (var sk in s.GetComponentsInChildren<SkinnedMeshRenderer>(true))
                            if (sk.enabled) { Fail("거신 속 두목 살갗이 보인다"); break; }
                        foreach (var mr in s.GetComponentsInChildren<MeshRenderer>(true))
                        {
                            var m = mr.sharedMaterial;
                            if (m != null && m.HasProperty("_Metallic") && m.GetFloat("_Metallic") > 0.5f) { Fail($"거신 바위가 금속 재질 {m.name}"); break; }
                        }
                        metrics += $" 거신 마디 {s.GolemChunks}·발광 {s.GolemRunes}";
                    }
                    else metrics += " 거신 = 틴트 폴백(사람 뼈대 모델 없음)";
                    s.Tick(PartySummon.SlamSec - 0.3f);
                    if (s.Slammed) Fail("3.2초 전에 내리쳤다");
                    s.Tick(0.4f);
                    if (!s.Slammed) Fail("3.2초가 지나도 안 내리쳤다");
                    if (!Near(nearHp - CurHp(nearFoe), expect)) Fail($"14m 안 적 피해 {nearHp - CurHp(nearFoe)} (기대 {expect})");
                    if (!Near(farHp, CurHp(far))) Fail("14m 밖 적이 맞았다");
                    metrics += $" 소환 한 방 {expect:0}·맞은 적 {s.LastHitCount}";
                }
                float afterSlam = CurHp(nearFoe);
                cuts.Skip();
                if (DungeonCutscenes.Playing) Fail("소환 컷이 안 넘어갔다");
                if (!Near(afterSlam, CurHp(nearFoe))) Fail("컷을 넘기자 한 번 더 내리쳤다");
                if (!hud.GetComponent<Canvas>().enabled) Fail("컷 뒤 파티 HUD 가 안 돌아왔다");

                // ── 컷 초반에 넘기면 그 자리에서 내리친다
                PartyState.FillSummon();
                float hp2 = CurHp(nearFoe);
                if (!party.TrySummon()) Fail("둘째 소환이 안 먹었다");
                cuts.Skip();
                if (!party.LastSummon.Slammed || !Near(hp2 - CurHp(nearFoe), expect)) Fail($"넘긴 소환이 내리치지 않았다 ({hp2 - CurHp(nearFoe)})");
                if (PartySummon.SlamCount != slams + 2) Fail($"내리치기 수 {PartySummon.SlamCount - slams} (기대 2)");
            }
            finally
            {
                cuts.Skip();
                foreach (var s in Object.FindObjectsByType<PartySummon>(FindObjectsSortMode.None)) Object.DestroyImmediate(s.gameObject);
                foreach (var b in Object.FindObjectsByType<MysticBolt>(FindObjectsSortMode.None)) Object.DestroyImmediate(b.gameObject);
                foreach (var go in Spawned) if (go != null) Object.DestroyImmediate(go);
                Spawned.Clear();
                foreach (var e in others) if (e != null) e.gameObject.SetActive(true);
                guard.ResetParty();
                guard.transform.position = guardStart;
                mystic.transform.position = mysticStart;
                PartyState.Reset();
                pc.Teleport(start);
                HeroState.Restore(level, exp, hp, gold, weapon, gem);
            }
            if (_ok) Debug.Log($"{T} OK - 평타→게이지·덜 참 막힘·도발(무사가 대신 맞음 40%)·쓰러짐·치유(+40%·일으킴)·12초 기상·빛살·물러섬·소환(막힘 둘·컷·HUD·14m 내리치기·넘겨도 한 번·초반 넘김) |{metrics}");
            return _ok;
        }

        private static DungeonEnemy Dummy(Vector3 pos, float hp, float dmg)
        {
            var go = new GameObject("PartyTestDummy");
            go.SetActive(false);
            go.transform.position = pos;
            var e = go.AddComponent<DungeonEnemy>();
            e.ConfigureCombat(hp, dmg, 0, 0, null, null, false, "황건적", Color.gray, 1f);
            go.SetActive(true);
            Spawned.Add(go);
            return e;
        }

        private static void Kill(DungeonEnemy e)
        {
            if (e != null) Object.DestroyImmediate(e.gameObject);
        }

        private static float CurHp(DungeonEnemy e) =>
            (float)typeof(DungeonEnemy).GetField("_curHp", BindingFlags.NonPublic | BindingFlags.Instance).GetValue(e);

        private static bool Near(float a, float b, float eps = 0.05f) => Mathf.Abs(a - b) <= eps;
        private static bool HasParam(Animator a, string name) { if (a == null || a.runtimeAnimatorController == null) return false; foreach (var p in a.parameters) if (p.name == name) return true; return false; }

        private static void SetPrivate(object target, string field, object value)
        {
            var f = target.GetType().GetField(field, BindingFlags.NonPublic | BindingFlags.Instance);
            if (f == null) Fail($"{target.GetType().Name}.{field} 없음");
            else f.SetValue(target, value);
        }

        private static void Fail(string msg)
        {
            Debug.LogError($"{T}: {msg}");
            _ok = false;
        }
    }
}
