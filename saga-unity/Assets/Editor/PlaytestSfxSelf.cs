using System;
using System.Collections.Generic;
using System.IO;
using System.Linq;
using System.Reflection;
using UnityEngine;
using Saga.Core;
using Saga.Dungeon.Audio;
using Saga.Dungeon.Data;
using Saga.Forest.Audio;
using Saga.Story.Audio;
using Saga.Realm.Audio;

namespace Saga.EditorTools
{
    /// <summary>
    /// tasks U-0104 — 네 판(2나락·3마을·4종횡·5천하) 효과음이 빌린 Kenney 클립 대신 자체 92종(<see cref="SagaSfx"/>)을 이름으로 먼저 쓰는지.
    /// `PlaytestHeadless` 가 사가만리 효과음 진단 뒤에 부른다(장면 안 만들어도 되는 정적 층 — 판 장면 없이 돈다).
    /// ① 네 판 `Used` 이름이 전부 유니티 Resources 에서 열린다(`SagaSfx.Has`).
    /// ② 함수·사건을 부르면 `LastPlayed` 가 그 이름 — 2나락 다섯 함수 + 진짜 `HeroState.TakeDamage`(sword_hurt)·`HealBy`(heal) + 구르기 dodge,
    ///    3마을·4종횡·5천하는 이름 재생 + 부르는 곳 소스(UI 인스턴스는 장면에서 만들기 무거워 호출 문자열만 본다).
    /// ③ 파일이 없는 이름(가짜 로더)은 옛 클립도 없으면 조용히 건너뛴다(예외 0, 기록은 남음).
    /// ④ 2나락 피격 연타(같은 순간 세 번) → 기록 한 번(<see cref="HeroState.HurtSfxGap"/>).
    /// 살아있는 상태(HeroState 체력·무적·마지막 피격자)는 끝에 되돌린다.
    /// </summary>
    public static class PlaytestSfxSelf
    {
        private static string _tag;
        private static bool _ok;

        public static bool Run(string tag)
        {
            _tag = tag; _ok = true;
            var parts = new List<string>();
            var loader = SagaSfx.Loader;
            try
            {
                CheckFiles(parts);
                CheckDungeon(parts);
                CheckOthers(parts);
                CheckSilent(parts);
                CheckSources(parts);
                CheckNoKenney(parts);
            }
            catch (Exception e) { Fail("예외 " + e.GetType().Name + ": " + e.Message); }
            finally { SagaSfx.Loader = loader; SagaSfx.ResetForTest(); SfxPlayer.ResetForTest(); }
            if (_ok) Debug.Log($"[{_tag}] sfxself OK - {string.Join(" · ", parts)}");
            return _ok;
        }

        private static readonly (string game, string[] used)[] Games =
        {
            ("2나락", SfxPlayer.Used), ("3마을", ForestAudio.Used), ("4종횡", StoryAudio.Used), ("5천하", RealmAudio.Used),
        };

        private static void CheckFiles(List<string> parts)
        {
            SagaSfx.Loader = k => Resources.Load<AudioClip>(SagaSfx.Dir + k); SagaSfx.ResetForTest();
            int n = 0;
            foreach (var (game, used) in Games)
            {
                if (used.Distinct().Count() != used.Length) Fail($"{game} Used 에 겹친 이름");
                var lost = used.Where(u => !SagaSfx.Has(u)).ToList();
                if (lost.Count > 0) Fail($"{game} 이름이 유니티 Resources 에 없음: {string.Join(",", lost)}");
                n += used.Length;
            }
            parts.Add($"이름 {n}개 파일 열림");
        }

        private static void Expect(string name, string what)
        {
            if (SagaSfx.LastPlayed != name) Fail($"{what} → '{SagaSfx.LastPlayed}' (기대 '{name}')");
        }

        private static void CheckDungeon(List<string> parts)
        {
            SagaSfx.ResetForTest(); SfxPlayer.ResetForTest();
            SfxPlayer.PlayHit(); Expect("sword_hit", "PlayHit");
            SfxPlayer.PlayHeavyHit(); Expect("crit", "PlayHeavyHit");
            SfxPlayer.PlayEnemyDeath(); Expect("death", "PlayEnemyDeath");
            SfxPlayer.PlayLevelUp(); Expect("levelup", "PlayLevelUp");
            SfxPlayer.PlayDiscovery(); Expect("chest_open", "PlayDiscovery");

            // 진짜 HeroState — 피격(연타 셋 → 기록 하나)·회복. 상태는 되돌린다.
            var hpProp = typeof(HeroState).GetProperty(nameof(HeroState.Hp));
            var whoProp = typeof(HeroState).GetProperty(nameof(HeroState.LastHitWho));
            var howProp = typeof(HeroState).GetProperty(nameof(HeroState.LastHitHow));
            int hp = HeroState.Hp; bool inv = HeroState.Invulnerable; int hold = HeroState.DamageHold;
            string who = HeroState.LastHitWho, how = HeroState.LastHitHow;
            try
            {
                HeroState.Invulnerable = false; HeroState.DamageHold = 0;
                hpProp.SetValue(null, HeroState.HpMax);
                SagaSfx.ResetForTest(); SfxPlayer.ResetForTest();
                HeroState.TakeDamage(1f); HeroState.TakeDamage(1f); HeroState.TakeDamage(1f);
                Expect("sword_hurt", "HeroState.TakeDamage");
                int hurts = SagaSfx.History.Count(h => h == "sword_hurt");
                if (hurts != 1) Fail($"피격 연타 기록 {hurts} ≠ 1(최소 간격 {HeroState.HurtSfxGap}s)");
                if (HeroState.Hp >= HeroState.HpMax) Fail("피격이 체력을 안 깎음");
                HeroState.HealBy(1); Expect("heal", "HeroState.HealBy");
                SagaSfx.ResetForTest(); SfxPlayer.ResetForTest();
                hpProp.SetValue(null, HeroState.HpMax);
                HeroState.HealBy(1);
                if (SagaSfx.History.Contains("heal")) Fail("가득 찬 체력에서 회복음이 남");
            }
            finally
            {
                hpProp.SetValue(null, hp); whoProp.SetValue(null, who); howProp.SetValue(null, how);
                HeroState.Invulnerable = inv; HeroState.DamageHold = hold;
            }
            SfxPlayer.Play("dodge"); Expect("dodge", "SfxPlayer.Play(dodge)");
            parts.Add("2나락 여덟(맞힘·강타·쓰러짐·레벨업·발견·피격 연타 1·회복·구르기)");
        }

        private static void CheckOthers(List<string> parts)
        {
            SagaSfx.ResetForTest();
            foreach (var n in ForestAudio.Used) { ForestAudio.PlaySfx(n); Expect(n, "ForestAudio.PlaySfx"); }
            foreach (var n in StoryAudio.Used) { StoryAudio.PlaySfx(n); Expect(n, "StoryAudio.PlaySfx"); }
            foreach (var n in RealmAudio.Used) { RealmAudio.PlaySfx(n); Expect(n, "RealmAudio.PlaySfx"); }
            parts.Add($"3마을 {ForestAudio.Used.Length}·4종횡 {StoryAudio.Used.Length}·5천하 {RealmAudio.Used.Length}");
        }

        private static void CheckSilent(List<string> parts)
        {
            SagaSfx.Loader = k => null; SagaSfx.ResetForTest(); SfxPlayer.ResetForTest();
            SfxPlayer.PlayHit(); SfxPlayer.Play("nope");
            ForestAudio.PlaySfx("nope"); StoryAudio.PlaySfx("nope"); RealmAudio.PlaySfx("nope");
            if (SagaSfx.History.Count(h => h == "nope") != 4) Fail("파일 없는 이름도 기록은 남아야 함");
            parts.Add("파일 없음 조용히");
        }

        private static void CheckSources(List<string> parts)
        {
            const string root = "Assets/Games/";
            void Has(string file, string needle)
            {
                if (!File.Exists(root + file)) { Fail(file + " 없음"); return; }
                if (!File.ReadAllText(root + file).Contains(needle)) Fail($"{file} 에 {needle} 호출이 없음");
            }
            Has("SagaDungeon/Player/PlayerController.cs", "SfxPlayer.Play(\"dodge\")");
            Has("SagaDungeon/World/TempleDoor.cs", "SfxPlayer.Play(\"door_open\")");
            Has("SagaDungeon/World/TempleChest.cs", "SfxPlayer.Play(\"chest_open\")");
            Has("SagaDungeon/World/LootMarker.cs", "SfxPlayer.Play(\"item_pick\")");
            Has("SagaForest/UI/ForestHostileEncounterUi.cs", "ForestAudio.PlaySfx(\"ui_click\"");
            Has("SagaForest/UI/ForestHostileEncounterUi.cs", "ForestAudio.PlaySfx(won ? \"victory\" : \"defeat\"");
            Has("SagaForest/World/ForestGatherFeel.cs", "ForestAudio.PlaySfx(\"item_pick\"");
            Has("SagaStory/World/StoryEnemy.cs", "StoryAudio.PlaySfx(\"sword_hit\"");
            Has("SagaStory/World/StoryEnemy.cs", "StoryAudio.PlaySfx(\"death\"");
            Has("SagaRealm/UI/RealmCommandUi.cs", "RealmAudio.PlaySfx(ok ? \"ui_confirm\" : \"ui_error\"");
            Has("SagaGo/World/BanditEncounter.cs", "GoSfx.Play(\"sword_hit\"");
            parts.Add("부르는 곳 소스 11");
        }

        /// <summary>U-0152 — 빌린 Kenney 효과음 두 폴더가 없고, 코드·씬·프리팹 어디서도 그 경로·guid 를 안 부른다(대체 길 걷음).</summary>
        private static void CheckNoKenney(List<string> parts)
        {
            string[] dirs = { "Assets/Art/Audio/Kenney_" + "InterfaceSounds", "Assets/Art/Audio/Kenney_" + "RPGSounds" };
            foreach (var d in dirs)
                if (Directory.Exists(d)) Fail(d + " 폴더가 남음");
            int hits = 0;
            foreach (var ext in new[] { "*.cs", "*.unity", "*.prefab" })
                foreach (var f in Directory.GetFiles("Assets", ext, SearchOption.AllDirectories))
                {
                    if (f.Replace('\\', '/').Contains("/_Recovery/")) continue;
                    string text = File.ReadAllText(f);
                    foreach (var d in dirs)
                        if (text.Contains(d)) { hits++; Fail($"{f} 가 {d} 를 부름"); }
                }
            parts.Add(hits == 0 ? "Kenney 효과음 참조 0" : $"Kenney 참조 {hits}");
        }

        private static void Fail(string msg)
        {
            _ok = false;
            Debug.LogError($"[{_tag}] sfxself FAIL - {msg}");
        }
    }
}
