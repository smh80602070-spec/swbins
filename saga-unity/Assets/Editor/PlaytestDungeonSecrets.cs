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
    /// PLAN.md 109-10 첫 조각 "비결"(웹 사가나락 §5.9) 진단 — `PlaytestDungeonHeadless` 가 세 시대 진단 뒤에 부른다(한 프레임 안).
    /// 웹 진단 항목(다섯·해금 · 모양별 변형·원본 불변 · 단수 잠금·풀기·환원 · 실제 시전 · 흡혈 버프)을 이 트랙에 맞춰:
    /// 표(다섯·열리는 레벨·단) · 무예 셋 × 비결 다섯 배율 · 잠금·풀기·환원(레벨이 내려간 세이브) · 실제 시전(없음 = 옛 수치,
    /// 신속·분노·확산 평타/회전베기·한기 얼림·흡혈) · 빛기둥(등급 → 기둥, 실제 처치) · 패널(진짜 onClick·딱지·잠긴 칸) · 세이브 v11.
    /// PLAN.md 109-10-2 비전(웹 §5.10): 명소 무기에만·다섯 다 나옴 · 들면 ×1.6(분노와 곱해 2.32)·실제 시전 · 딴 비결·빈 무예 그대로 ·
    /// 내려놓으면 꺼짐 · 패널·HUD·줍기 글.
    /// 앞 진단들은 비전 없는 목검(wp_start)을 쥐고 돈다 — 실제 세이브의 명소 무기가 배율을 흔들지 않게.
    /// 끝나면 영웅·비결·다른 적·파티 게이지를 시작 때로.
    /// </summary>
    public static class PlaytestDungeonSecrets
    {
        private const string T = "[PlaytestDungeonHeadless] secrets";
        private static bool _ok;
        private static readonly List<GameObject> Spawned = new List<GameObject>();

        public static bool Run()
        {
            _ok = true;
            var playerGo = GameObject.FindWithTag("Player");
            var combat = playerGo != null ? playerGo.GetComponent<PlayerCombat>() : null;
            var lockOn = playerGo != null ? playerGo.GetComponent<PlayerLockOn>() : null;
            var panel = SecretPanelUi.Instance;
            if (combat == null || panel == null) { Fail($"전투 {combat != null}·비결 패널 {panel != null} 없음"); return false; }

            int level = HeroState.Level, exp = HeroState.Exp, hp = HeroState.Hp, gold = HeroState.Gold;
            string weapon = HeroState.EquippedWeaponId, gem = HeroState.SocketedGemId;
            int[] secrets = SecretState.Snapshot();
            string[] bestiary = BestiaryState.Snapshot();
            var others = new List<DungeonEnemy>(DungeonEnemy.Active);
            foreach (var e in others) if (e != null) e.gameObject.SetActive(false);
            string m = "";
            try
            {
                DungeonCutscenes.Instance?.Skip();
                if (lockOn != null) lockOn.Release();
                _weapon = "wp_start";
                SetLevel(HeroState.Level);
                m += CheckTable() + CheckMultipliers() + CheckLocks() + CheckCasts(combat, playerGo.transform.position)
                    + CheckPanel(panel) + CheckSave() + CheckLore(combat, panel, playerGo.transform.position)
                    + CheckPillars(playerGo.transform.position); // 빛기둥은 무기를 바꿔 줍는다 — 맨 끝.
            }
            finally
            {
                foreach (var go in Spawned) if (go != null) Object.DestroyImmediate(go);
                Spawned.Clear();
                foreach (var lm in Object.FindObjectsByType<LootMarker>(FindObjectsSortMode.None))
                    if (lm.PillarTier > LootMarker.PillarNone) Object.DestroyImmediate(lm.gameObject);
                foreach (var e in others) if (e != null) e.gameObject.SetActive(true);
                HeroState.Restore(level, exp, hp, gold, weapon, gem);
                SecretState.Restore(secrets);
                BestiaryState.Restore(bestiary);
                PartyState.Reset();
                combat.ResetCooldownsForTest();
                if (panel.IsOpen) panel.Toggle();
            }
            if (_ok) Debug.Log($"{T} OK - 다섯·Lv 1/3/5/7/9·배율 18칸·잠금·풀기·환원·실제 시전(옛 수치·신속·분노·확산 셋·반경·한기·흡혈)·빛기둥(명품·보물·고유·소리 자리)·패널 onClick·딱지·세이브 v11·비전(명소에만·다섯·×2.32·실제 시전·딴 비결·내려놓기·패널·HUD·줍기 글) |{m}");
            return _ok;
        }

        private static string CheckTable()
        {
            int[] want = { 1, 1, 3, 5, 7, 9 };
            for (int s = 0; s <= SecretState.SecretCount; s++)
                if (SecretState.UnlockLevel((Secret)s) != want[s]) Fail($"{(Secret)s} 열림 Lv.{SecretState.UnlockLevel((Secret)s)} ≠ {want[s]}");
            if (SecretState.RankAt(1) != 1 || SecretState.RankAt(2) != 1 || SecretState.RankAt(3) != 2 || SecretState.RankAt(9) != 5 || SecretState.RankAt(40) != 5) Fail("단 경계");
            var names = new HashSet<string>();
            var glyphs = new HashSet<string>();
            for (int s = 1; s <= SecretState.SecretCount; s++)
            {
                if (!names.Add(SecretState.Name((Secret)s))) Fail($"이름 겹침 {(Secret)s}");
                if (!glyphs.Add(SecretState.Glyph((Secret)s))) Fail($"딱지 겹침 {(Secret)s}");
                if (string.IsNullOrEmpty(SecretState.Effect((Secret)s, SecretMove.Attack))) Fail($"설명 없음 {(Secret)s}");
            }
            return $" 이름 {names.Count}";
        }

        private static string CheckMultipliers()
        {
            SetLevel(9);
            // 무예마다 (위력, 재냉각, 사거리, 곁 타수, 얼림) — 없음이 첫 줄.
            float[,] want =
            {
                { 1f, 1f, 1f, 0f, 0f },
                { 1.45f, 1.4f, 1f, 0f, 0f },
                { 0.9f, 1f, 1f, 0f, 2.8f },
                { 0.8f, 1f, 1.35f, 2f, 0f },
                { 0.7f, 0.5f, 1f, 0f, 0f },
                { 0.9f, 1f, 1f, 0f, 0f },
            };
            int n = 0;
            for (int mv = 0; mv < SecretState.MoveCount; mv++)
            {
                var move = (SecretMove)mv;
                for (int s = 0; s <= SecretState.SecretCount; s++)
                {
                    SecretState.Restore(Only(move, (Secret)s));
                    float extra = move == SecretMove.Whirl ? 0f : want[s, 3];
                    if (!Near(SecretState.DamageMul(move), want[s, 0]) || !Near(SecretState.CooldownMul(move), want[s, 1])
                        || !Near(SecretState.RangeMul(move), want[s, 2]) || SecretState.ExtraTargets(move) != (int)extra
                        || !Near(SecretState.ChillSec(move), want[s, 4]))
                        Fail($"{move}·{(Secret)s} 배율 {SecretState.DamageMul(move)}/{SecretState.CooldownMul(move)}/{SecretState.RangeMul(move)}/{SecretState.ExtraTargets(move)}/{SecretState.ChillSec(move)}");
                    // 다른 무예는 안 바뀐다.
                    for (int o = 0; o < SecretState.MoveCount; o++)
                        if (o != mv && (!Near(SecretState.DamageMul((SecretMove)o), 1f) || !Near(SecretState.CooldownMul((SecretMove)o), 1f)))
                            Fail($"{move} 에 건 {(Secret)s} 가 {(SecretMove)o} 까지 바꿈");
                    n++;
                }
            }
            SecretState.Restore(null);
            return $" 칸 {n}";
        }

        private static string CheckLocks()
        {
            SetLevel(1);
            SecretState.Restore(null);
            if (SecretState.Choose(SecretMove.Attack, Secret.Frost) || SecretState.Of(SecretMove.Attack) != Secret.None) Fail("Lv.1 에 한기가 걸림");
            if (!SecretState.Choose(SecretMove.Attack, Secret.Rage) || SecretState.Of(SecretMove.Attack) != Secret.Rage) Fail("Lv.1 분노가 안 걸림");
            SecretState.Choose(SecretMove.Attack, Secret.Rage);
            if (SecretState.Of(SecretMove.Attack) != Secret.None) Fail("같은 칸 다시 눌러도 안 풀림");
            SetLevel(9);
            if (!SecretState.Choose(SecretMove.Whirl, Secret.Leech)) Fail("Lv.9 흡혈이 안 걸림");
            int[] snap = SecretState.Snapshot();
            SetLevel(4); // 환원 — 흡혈(Lv.9)이 걸린 세이브를 Lv.4 로 읽는다.
            SecretState.Restore(snap);
            if (SecretState.Of(SecretMove.Whirl) != Secret.None || SecretState.Picked(SecretMove.Whirl) != Secret.Leech || !Near(SecretState.DamageMul(SecretMove.Whirl), 1f))
                Fail($"환원 — Lv.4 에 흡혈이 {SecretState.Of(SecretMove.Whirl)}/{SecretState.Picked(SecretMove.Whirl)}");
            SetLevel(9);
            if (SecretState.Of(SecretMove.Whirl) != Secret.Leech) Fail("레벨이 다시 오르면 흡혈이 살아나야");
            SecretState.Restore(new[] { 99, -1 });
            for (int i = 0; i < SecretState.MoveCount; i++) if (SecretState.Picked((SecretMove)i) != Secret.None) Fail("모르는 값·짧은 배열이 없음으로 안 읽힘");
            return "";
        }

        private static string CheckCasts(PlayerCombat combat, Vector3 p)
        {
            SetLevel(9);
            HeroState.FullHeal();
            Vector3 x = Vector3.right, z = Vector3.forward;

            // 없음 = 옛 수치(평타 0.55초·HitDamage).
            SecretState.Restore(null);
            var a = Dummy(p + x * 1.2f);
            float hit = Cast(combat, SecretMove.Attack);
            if (!Near(a.hp0 - a.e.CurrentHp, hit) || !Near(combat.CooldownLeft(SecretMove.Attack), 0.55f, 0.01f)) Fail($"없음 평타 {a.hp0 - a.e.CurrentHp}/{hit}·{combat.CooldownLeft(SecretMove.Attack)}");
            // 신속 평타 — 위력 ×0.7·재냉각 0.275.
            SecretState.Restore(Only(SecretMove.Attack, Secret.Swift));
            float hp = a.e.CurrentHp;
            Cast(combat, SecretMove.Attack);
            if (!Near(hp - a.e.CurrentHp, hit * 0.7f) || !Near(combat.CooldownLeft(SecretMove.Attack), 0.275f, 0.01f)) Fail($"신속 {hp - a.e.CurrentHp}/{hit * 0.7f}·{combat.CooldownLeft(SecretMove.Attack)}");
            // 분노 강공격 — 위력 2.6×1.45·재냉각 1.3×1.4.
            SecretState.Restore(Only(SecretMove.Heavy, Secret.Rage));
            hp = a.e.CurrentHp;
            Cast(combat, SecretMove.Heavy);
            if (!Near(hp - a.e.CurrentHp, hit * 2.6f * 1.45f, 0.1f) || !Near(combat.CooldownLeft(SecretMove.Heavy), 1.82f, 0.01f)) Fail($"분노 강공격 {hp - a.e.CurrentHp}/{hit * 2.6f * 1.45f}·{combat.CooldownLeft(SecretMove.Heavy)}");
            Kill(a);

            // 확산 평타 — 1.2m 첫 대상 + 곁 둘(2.0·3.0m, 3.0 은 원래 사거리 2.5 밖), 3.3m 넷째는 안 맞음.
            SecretState.Restore(Only(SecretMove.Attack, Secret.Spread));
            var s1 = Dummy(p + x * 1.2f); var s2 = Dummy(p - x * 2.0f); var s3 = Dummy(p + z * 3.0f); var s4 = Dummy(p - z * 3.3f);
            Cast(combat, SecretMove.Attack);
            int spreadHits = 0;
            foreach (var d in new[] { s1, s2, s3 }) { if (Near(d.hp0 - d.e.CurrentHp, hit * 0.8f)) spreadHits++; }
            if (spreadHits != 3 || s4.e.CurrentHp < s4.hp0) Fail($"확산 평타 맞은 {spreadHits}/3·넷째 {s4.hp0 - s4.e.CurrentHp}");
            // 회전베기 반경 — 없음이면 3.3m 안 맞고 확산이면 맞음(2.8 × 1.35 = 3.78).
            SecretState.Restore(null);
            hp = s4.e.CurrentHp;
            Cast(combat, SecretMove.Whirl);
            if (s4.e.CurrentHp < hp) Fail("없음 회전베기가 3.3m 를 맞힘");
            SecretState.Restore(Only(SecretMove.Whirl, Secret.Spread));
            Cast(combat, SecretMove.Whirl);
            if (!(s4.e.CurrentHp < hp)) Fail("확산 회전베기가 3.3m 를 못 맞힘");
            foreach (var d in new[] { s1, s2, s3, s4 }) Kill(d);

            // 한기 회전베기 — 맞은 적이 2.8초 얼고, 1초 뒤 아직·3초 뒤 풀림.
            SecretState.Restore(Only(SecretMove.Whirl, Secret.Frost));
            var f = Dummy(p + x * 1.5f);
            hp = f.e.CurrentHp;
            Cast(combat, SecretMove.Whirl);
            if (!f.e.IsChilled || !Near(hp - f.e.CurrentHp, hit * 0.7f * 0.9f)) Fail($"한기 얼림 {f.e.IsChilled}·피해 {hp - f.e.CurrentHp}");
            f.e.Tick(1f);
            if (!f.e.IsChilled) Fail("한기 1초 만에 풀림");
            f.e.Tick(2f);
            if (f.e.IsChilled) Fail("한기 3초 지나도 안 풀림");
            Kill(f);

            // 흡혈 평타 — 3초 창, 준 피해의 12%(끝수 넘김) 회복, 창 안의 다른 무예도 흡수.
            SecretState.Restore(Only(SecretMove.Attack, Secret.Leech));
            var l = Dummy(p + x * 1.2f);
            HeroState.Restore(9, 0, 1, HeroState.Gold, _weapon, HeroState.SocketedGemId);
            float carry = 0f; int expectHeal = 0;
            float dealt = Cast(combat, SecretMove.Attack) * 0.9f;
            carry += dealt * 0.12f; expectHeal += (int)Mathf.Floor(carry); carry -= Mathf.Floor(carry);
            if (!SecretState.LeechActive(Time.time)) Fail("흡혈 창이 안 열림");
            float dealt2 = Cast(combat, SecretMove.Heavy) * 2.6f;
            carry += dealt2 * 0.12f; expectHeal += (int)Mathf.Floor(carry);
            if (HeroState.Hp != Mathf.Min(HeroState.HpMax, 1 + expectHeal) || expectHeal <= 0) Fail($"흡혈 회복 {HeroState.Hp - 1} (기대 {expectHeal})");
            if (SecretState.LeechActive(Time.time + 3.1f)) Fail("흡혈 창이 3초를 넘김");
            Kill(l);
            SecretState.Restore(null);
            return $" 한 타 {hit:0.0}·흡혈 +{expectHeal}";
        }

        private static string CheckPillars(Vector3 p)
        {
            if (LootMarker.PillarTierOf(ItemData.Get("wp_axe")) != LootMarker.PillarNone
                || LootMarker.PillarTierOf(ItemData.Get("wp_saber")) != LootMarker.PillarFine
                || LootMarker.PillarTierOf(ItemData.Get("wp_glaive")) != LootMarker.PillarTreasure
                || LootMarker.PillarTierOf(ItemData.Get("wp_lm_tomb")) != LootMarker.PillarUnique
                || LootMarker.PillarTierOf(null) != LootMarker.PillarNone) Fail("등급 → 기둥 표");
            int count = LootMarker.PillarCount;
            var before = new HashSet<LootMarker>(Object.FindObjectsByType<LootMarker>(FindObjectsSortMode.None)); // 앞 진단(명소 주인 등)이 세운 기둥은 뺀다.
            DieWith(p + Vector3.right * 6f, "wp_axe");
            if (LootMarker.PillarCount != count) Fail("보통 무기에 기둥이 섬");
            string[] ids = { "wp_saber", "wp_glaive", "wp_lm_cloud" };
            float[] heights = { 3.4f, 5.6f, 8f };
            for (int i = 0; i < ids.Length; i++)
            {
                DieWith(p + Vector3.right * (6f + 2f * i), ids[i]);
                if (LootMarker.PillarCount != count + i + 1 || LootMarker.LastPillarTier != i + 1) Fail($"{ids[i]} 기둥 {LootMarker.PillarCount - count}·등급 {LootMarker.LastPillarTier}");
            }
            int found = 0;
            foreach (var lm in Object.FindObjectsByType<LootMarker>(FindObjectsSortMode.None))
            {
                if (lm.PillarTier == LootMarker.PillarNone || before.Contains(lm)) continue;
                found++;
                if (!Near(lm.PillarFullHeight, heights[lm.PillarTier - 1]) || lm.GetComponentsInChildren<LineRenderer>().Length != 2 || lm.PillarTopHeight > 0.5f)
                    Fail($"기둥 {lm.PillarTier} 높이 {lm.PillarFullHeight}·선 {lm.GetComponentsInChildren<LineRenderer>().Length}·첫 높이 {lm.PillarTopHeight}");
            }
            if (found != 3) Fail($"기둥 표식 {found}/3");
            return $" 기둥 {found}";
        }

        private static string CheckPanel(SecretPanelUi panel)
        {
            SetLevel(1);
            SecretState.Restore(null);
            panel.Refresh();
            for (int i = 0; i < SecretState.MoveCount; i++) if (panel.BadgeText((SecretMove)i) == null) Fail($"{(SecretMove)i} 버튼 딱지 없음");
            if (panel.IsOpen) panel.Toggle();
            panel.ToggleButton.onClick.Invoke();
            if (!panel.IsOpen) Fail("비결 버튼이 패널을 안 엶");
            if (panel.Cell(SecretMove.Heavy, Secret.Frost).interactable) Fail("Lv.1 한기 칸이 눌림");
            panel.Cell(SecretMove.Heavy, Secret.Frost).onClick.Invoke();
            if (SecretState.Of(SecretMove.Heavy) != Secret.None) Fail("잠긴 칸 onClick 이 걸림");
            panel.Cell(SecretMove.Heavy, Secret.Rage).onClick.Invoke();
            if (SecretState.Of(SecretMove.Heavy) != Secret.Rage || panel.BadgeText(SecretMove.Heavy) != SecretState.Glyph(Secret.Rage) || panel.BadgeText(SecretMove.Attack) != "")
                Fail($"분노 칸 → {SecretState.Of(SecretMove.Heavy)}·딱지 \"{panel.BadgeText(SecretMove.Heavy)}\"/\"{panel.BadgeText(SecretMove.Attack)}\"");
            panel.Cell(SecretMove.Heavy, Secret.Rage).onClick.Invoke();
            if (SecretState.Of(SecretMove.Heavy) != Secret.None || panel.BadgeText(SecretMove.Heavy) != "") Fail("분노 칸 다시 눌러도 안 풀림");
            SetLevel(9);
            panel.Refresh();
            if (!panel.Cell(SecretMove.Whirl, Secret.Leech).interactable) Fail("Lv.9 흡혈 칸이 잠김");
            panel.ToggleButton.onClick.Invoke();
            if (panel.IsOpen) Fail("비결 버튼이 패널을 안 닫음");
            var dead = ButtonWiringCheck.FindDeadButtons(out int total, out string err);
            if (err != null) Fail(err);
            foreach (var d in dead) if (d.Contains("SecretPanel")) Fail($"죽은 비결 버튼 {d}");
            return $" 버튼 {total}";
        }

        private static string CheckSave()
        {
            var saveType = typeof(SaveState);
            var ver = saveType.GetField("SaveVersion", BindingFlags.NonPublic | BindingFlags.Static);
            if (ver == null || (int)ver.GetValue(null) < 11) Fail($"세이브 버전 {(ver != null ? ver.GetValue(null) : "?")} < 11");
            var data = saveType.GetNestedType("SaveData", BindingFlags.NonPublic);
            if (data == null || data.GetField("secrets") == null) Fail("SaveData.secrets 없음");
            SetLevel(9);
            SecretState.Restore(new[] { (int)Secret.Swift, (int)Secret.Rage, (int)Secret.Frost });
            var round = JsonUtility.FromJson<Wrap>(JsonUtility.ToJson(new Wrap { secrets = SecretState.Snapshot() }));
            SecretState.Restore(null);
            SecretState.Restore(round.secrets);
            if (SecretState.Of(SecretMove.Attack) != Secret.Swift || SecretState.Of(SecretMove.Heavy) != Secret.Rage || SecretState.Of(SecretMove.Whirl) != Secret.Frost) Fail("비결 JSON 왕복");
            SecretState.Restore(null);
            return "";
        }

        [System.Serializable] private class Wrap { public int[] secrets; }

        private static string CheckLore(PlayerCombat combat, SecretPanelUi panel, Vector3 p)
        {
            var lores = new HashSet<Secret>();
            foreach (var kv in ItemData.Catalog)
            {
                bool unique = kv.Key.StartsWith("wp_lm_");
                if (unique != (kv.Value.Lore != Secret.None)) Fail($"{kv.Key} 비전 {kv.Value.Lore}(명소 무기에만)");
                if (unique) lores.Add(kv.Value.Lore);
                if (unique && LootMarker.PillarTierOf(kv.Value) != LootMarker.PillarUnique) Fail($"{kv.Key} 가 고유 기둥이 아님");
            }
            if (lores.Count != SecretState.SecretCount) Fail($"비전 {lores.Count}/5 가지만 나옴");
            var loreNames = new HashSet<string>();
            for (int s = 1; s <= SecretState.SecretCount; s++)
                if (!loreNames.Add(SecretState.LoreName((Secret)s)) || SecretState.LoreName((Secret)s) == SecretState.Name((Secret)s)) Fail($"비전 이름 {(Secret)s}");

            // 잿빛 성주도(노화 = 분노) 를 든다.
            _weapon = "wp_lm_fort";
            SetLevel(9);
            HeroState.FullHeal();
            if (SecretState.EquippedLore != Secret.Rage) Fail($"성주도 비전 {SecretState.EquippedLore}");
            SecretState.Restore(new[] { (int)Secret.Swift, (int)Secret.Rage, 0 });
            if (!Near(SecretState.DamageMul(SecretMove.Heavy), 1.45f * 1.6f) || !SecretState.LoreBoosts(SecretMove.Heavy)) Fail($"분노 + 노화 {SecretState.DamageMul(SecretMove.Heavy)} ≠ 2.32");
            if (!Near(SecretState.DamageMul(SecretMove.Attack), 0.7f) || SecretState.LoreBoosts(SecretMove.Attack)) Fail($"신속(딴 비결)이 비전을 탐 {SecretState.DamageMul(SecretMove.Attack)}");
            if (!Near(SecretState.DamageMul(SecretMove.Whirl), 1f) || SecretState.LoreBoosts(SecretMove.Whirl)) Fail("빈 무예가 비전을 탐");
            if (!Near(SecretState.CooldownMul(SecretMove.Heavy), 1.4f)) Fail("비전이 재냉각까지 바꿈");

            // 실제 시전 — 강공격 2.6 × 2.32.
            var d = Dummy(p + Vector3.right * 1.2f);
            float hit = Cast(combat, SecretMove.Heavy);
            float dealt = d.hp0 - d.e.CurrentHp;
            if (!Near(dealt, hit * 2.6f * 1.45f * 1.6f, 0.15f)) Fail($"노화 강공격 {dealt} ≠ {hit * 2.6f * 1.45f * 1.6f}");
            Kill(d);

            // 패널·HUD.
            panel.Refresh();
            if (panel.TitleText == null || !panel.TitleText.Contains(SecretState.LoreName(Secret.Rage))) Fail($"패널 제목에 비전 없음 '{panel.TitleText}'");
            if (panel.RowText(SecretMove.Heavy) == null || !panel.RowText(SecretMove.Heavy).Contains("1.6")) Fail($"강공격 줄에 ×1.6 없음 '{panel.RowText(SecretMove.Heavy)}'");
            if (panel.RowText(SecretMove.Attack).Contains("1.6")) Fail("딴 비결 줄에 ×1.6");
            if (!panel.CellText(SecretMove.Whirl, Secret.Rage).Contains(SecretState.LoreName(Secret.Rage)) || panel.CellText(SecretMove.Whirl, Secret.Swift).Contains(SecretState.LoreName(Secret.Swift)))
                Fail("비전 칸 표시");
            var hud = Object.FindFirstObjectByType<PlayerHud>();
            var hudLabel = hud != null ? typeof(PlayerHud).GetField("label", BindingFlags.NonPublic | BindingFlags.Instance)?.GetValue(hud) as TMPro.TextMeshProUGUI : null;
            var refresh = typeof(PlayerHud).GetMethod("Refresh", BindingFlags.NonPublic | BindingFlags.Instance);
            if (hudLabel == null || refresh == null) Fail("HUD 글 못 찾음");
            else
            {
                refresh.Invoke(hud, null);
                if (!hudLabel.text.Contains(SecretState.LoreName(Secret.Rage))) Fail($"HUD 무기 줄에 비전 없음");
            }

            // 내려놓으면 꺼짐.
            _weapon = "wp_axe";
            SetLevel(9);
            if (SecretState.EquippedLore != Secret.None || !Near(SecretState.DamageMul(SecretMove.Heavy), 1.45f)) Fail($"쇠도끼로 바꿔도 비전 {SecretState.DamageMul(SecretMove.Heavy)}");
            panel.Refresh();
            if (panel.RowText(SecretMove.Heavy).Contains("1.6") || panel.TitleText.Contains(SecretState.LoreName(Secret.Rage))) Fail("무기를 바꿔도 패널에 비전이 남음");

            // 줍기 글 — 비늘 삼지창(빙혼)을 떨어뜨리는 적을 쓰러뜨린다.
            var drop = Dummy(p + Vector3.right * 6f, "wp_lm_palace");
            drop.e.TakeDamage(1e7f);
            var dl = DialogueLabel.Instance;
            var dlText = dl != null ? typeof(DialogueLabel).GetField("label", BindingFlags.NonPublic | BindingFlags.Instance)?.GetValue(dl) as TMPro.TextMeshProUGUI : null;
            if (dlText == null || !dlText.text.Contains(SecretState.LoreLine(Secret.Frost))) Fail($"줍기 글에 비전 줄 없음 '{dlText?.text}'");
            SecretState.Restore(null);
            _weapon = "wp_start";
            SetLevel(9);
            return $" 비전 {lores.Count}·노화 강공격 {dealt:0.0}";
        }

        // ── 도우미

        private struct D { public DungeonEnemy e; public float hp0; }

        private static D Dummy(Vector3 pos, string item = null)
        {
            var go = new GameObject("SecretTestDummy");
            go.SetActive(false);
            go.transform.position = pos;
            var e = go.AddComponent<DungeonEnemy>();
            e.ConfigureCombat(100000f, 0f, 0, 0, item, null, false, "황건적", Color.gray, 1f);
            go.SetActive(true);
            Spawned.Add(go);
            return new D { e = e, hp0 = e.CurrentHp };
        }

        private static void DieWith(Vector3 pos, string item)
        {
            var d = Dummy(pos, item);
            d.e.TakeDamage(1e7f);
        }

        private static void Kill(D d)
        {
            if (d.e != null) Object.DestroyImmediate(d.e.gameObject);
        }

        /// <summary>재냉각을 비우고 그 무예를 진짜 버튼 경로로 쓴다. 돌려주는 값 = 그때의 HitDamage(비결 전).</summary>
        private static float Cast(PlayerCombat combat, SecretMove m)
        {
            combat.ResetCooldownsForTest();
            float hit = HeroState.HitDamage;
            if (m == SecretMove.Attack) combat.TriggerAttack();
            else if (m == SecretMove.Heavy) combat.TriggerHeavyAttack();
            else combat.TriggerWhirl();
            return hit;
        }

        private static int[] Only(SecretMove m, Secret s)
        {
            var a = new int[SecretState.MoveCount];
            a[(int)m] = (int)s;
            return a;
        }

        private static string _weapon = "wp_start";

        private static void SetLevel(int level) =>
            HeroState.Restore(level, 0, HeroState.HpMax, HeroState.Gold, _weapon, HeroState.SocketedGemId);

        private static bool Near(float a, float b, float eps = 0.02f) => Mathf.Abs(a - b) <= eps;

        private static void Fail(string msg)
        {
            _ok = false;
            Debug.LogError($"{T} FAIL - {msg}");
        }
    }
}
