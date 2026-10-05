using System.Collections.Generic;
using System.Linq;
using UnityEditor;
using UnityEngine;
using Saga.Core;
using Saga.Go.Combat;
using Saga.Go.Data;
using Saga.Go.Player;
using Saga.Go.World;

namespace Saga.EditorTools
{
    /// <summary>
    /// U-0049 사가고 무기 모델 진단. 두 길 —
    /// ① <see cref="RunBatch"/>(`-executeMethod …PlaytestGoWeaponModel.RunBatch`, 장면 없이): 이름 표(종류 5 → sword·axe·spear·staff·bow · 희귀도 1~2 common·3 rare·4~5 legend) ·
    ///    15벌(5×3)이 `Resources/World` 에서 읽히고 `grip`·`tip` 노드로 `Fit` 이 선다 · 인물의 장착 무기에서 모델 이름이 나온다(수련용 → common · 장착한 3성 → rare).
    /// ② <see cref="Run"/>(`PlaytestHeadless` 가 편성 몸 진단 뒤에 부른다, 장면 안): 지금 손에 그 인물의 무기 모델이 쥐어져 있고(코드 칼날은 렌더러만 꺼짐) ·
    ///    다른 인물(활)로 바꾸면 모델이 바뀌고 · **편성 교체로 몸이 바뀌면 무기가 새 몸 손으로 따라온다**(그전엔 첫 몸 손에만 있었다) · 돌아오면 다시 주인공 손.
    /// </summary>
    public static class PlaytestGoWeaponModel
    {
        private static string _tag;
        private static bool _ok;

        [MenuItem("Saga/Playtest Go Weapon Model")]
        public static void RunBatch()
        {
            PlaytestKit.Begin("[PlaytestGoWeaponModel]");
            var winv = WeaponState.SnapshotInv(); var weq = WeaponState.SnapshotEquip(); int ore = WeaponState.Ore;
            using (PlaytestKit.ErrorCounter())
            {
                try { CheckNames(); CheckModels(); CheckEquipped(); }
                finally { WeaponState.Restore(winv, weq, ore); }
            }
            PlaytestKit.Summary("PlaytestGoWeaponModel");
            if (Application.isBatchMode) EditorApplication.Exit(PlaytestKit.Fails == 0 ? 0 : 1);
        }

        private static void CheckNames()
        {
            PlaytestKit.Check(GoWeaponModels.ModelName(GoWeapons.Type.Sword, 1) == "wpn_sword_common", "검 1성 이름");
            PlaytestKit.Check(GoWeaponModels.ModelName(GoWeapons.Type.Sword, 3) == "wpn_sword_rare", "검 3성 이름");
            PlaytestKit.Check(GoWeaponModels.ModelName(GoWeapons.Type.Sword, 4) == "wpn_sword_legend" && GoWeaponModels.ModelName(GoWeapons.Type.Sword, 5) == "wpn_sword_legend", "검 4~5성 이름");
            PlaytestKit.Check(GoWeaponModels.ModelName(GoWeapons.Type.Claymore, 3) == "wpn_axe_rare", "대검 → 도끼");
            PlaytestKit.Check(GoWeaponModels.ModelName(GoWeapons.Type.Polearm, 1) == "wpn_spear_common", "장대 → 창");
            PlaytestKit.Check(GoWeaponModels.ModelName(GoWeapons.Type.Catalyst, 4) == "wpn_staff_legend", "서책 → 지팡이");
            PlaytestKit.Check(GoWeaponModels.ModelName(GoWeapons.Type.Bow, 2) == "wpn_bow_common", "활 2성은 common");
            PlaytestKit.Check(new[] { 0, 1, 2, 3, 4, 5, 9 }.Select(GoWeaponModels.GradeOf).SequenceEqual(new[] { 0, 0, 0, 1, 2, 2, 2 }), "희귀도→등급 경계");
            foreach (GoWeapons.Type t in System.Enum.GetValues(typeof(GoWeapons.Type)))
                PlaytestKit.Check(GoWeaponModels.Length(t) > 0.5f && GoWeaponModels.Length(t) < 6f, $"{t} 길이가 이상함");
        }

        private static void CheckModels()
        {
            int n = 0;
            foreach (GoWeapons.Type t in System.Enum.GetValues(typeof(GoWeapons.Type)))
                foreach (int rarity in new[] { 1, 3, 4 })
                {
                    string name = GoWeaponModels.ModelName(t, rarity);
                    var prefab = WorldModels.Load(name);
                    if (prefab == null) { PlaytestKit.Fail($"{name} 이 Resources/World 에 없음(K-0019 배치)"); continue; }
                    var go = Object.Instantiate(prefab);
                    try
                    {
                        bool fit = GoWeaponModels.Fit(go, GoWeaponModels.Length(t), out var rot, out var pos, out float sc);
                        PlaytestKit.Check(fit && sc > 0f, $"{name}: grip·tip 노드가 없거나 같다");
                        if (fit)
                        {
                            go.transform.SetPositionAndRotation(Vector3.zero, Quaternion.identity); // 소켓 자리에서 적용한 값 그대로 검사
                            var grip = GoWeaponModels.FindNode(go.transform, "grip"); var tip = GoWeaponModels.FindNode(go.transform, "tip");
                            Vector3 gl = go.transform.InverseTransformPoint(grip.position), tl = go.transform.InverseTransformPoint(tip.position);
                            Vector3 gp = rot * gl * sc + pos, tp = rot * tl * sc + pos;
                            PlaytestKit.Check(gp.magnitude < 1e-3f, $"{name}: grip 이 원점이 아님({gp})");
                            PlaytestKit.Check(Mathf.Abs(tp.magnitude - GoWeaponModels.Length(t)) < 0.02f && tp.y > 0.9f * tp.magnitude, $"{name}: tip 이 위쪽 목표 길이가 아님({tp})");
                            n++;
                        }
                    }
                    finally { Object.DestroyImmediate(go); }
                }
            PlaytestKit.Check(n == 15, $"읽힌 모델 {n} ≠ 15");
        }

        private static void CheckEquipped()
        {
            WeaponState.Restore(null, null, 0);
            PlaytestKit.Check(GoWeaponModels.ModelFor("hero") == "wpn_sword_common", $"주인공 수련용 모델 {GoWeaponModels.ModelFor("hero")}");
            PlaytestKit.Check(GoWeaponModels.ModelFor("story_haram") == "wpn_bow_common", "활 인물(하람) 수련용 모델");
            PlaytestKit.Check(GoWeaponModels.ModelFor("story_ferryman") == "wpn_spear_common", "창 인물(사공) 수련용 모델");
            // 주인공은 도감 동행이 아니라 무기를 못 낀다(`WeaponState.Equip` — 도감 동행만) — 영입한 검 인물(가면 쓴 나그네)로
            var members = new List<string>(PartyState.MemberIds);
            try
            {
                if (!members.Contains("story_wanderer")) PartyState.Restore(members.Concat(new[] { "story_wanderer" }));
                WeaponState.Give("w_sword_3");
                PlaytestKit.Check(WeaponState.Equip("story_wanderer", "w_sword_3"), "3성 검을 못 낌");
                PlaytestKit.Check(GoWeaponModels.ModelFor("story_wanderer") == "wpn_sword_rare", $"장착한 3성 검 → rare 가 아님({GoWeaponModels.ModelFor("story_wanderer")})");
                PlaytestKit.Check(GoWeaponModels.ModelFor("hero") == "wpn_sword_common", "주인공 모델이 장착과 상관없이 common 이어야 함");
            }
            finally { PartyState.Restore(members); }
        }

        // ---- 장면 층 ----

        public static bool Run(string tag)
        {
            _tag = tag; _ok = true;
            var fc = FieldCombat.Instance;
            var pc = fc != null ? fc.GetComponent<PlayerController>() : null;
            var wv = pc != null ? pc.GetComponent<WeaponVisual>() : null;
            var bodies = pc != null ? pc.GetComponent<PartyBodies>() : null;
            if (wv == null || bodies == null) { Fail("WeaponVisual/PartyBodies 없음"); return false; }
            var parts = new List<string>();
            var winv = WeaponState.SnapshotInv(); var weq = WeaponState.SnapshotEquip(); int ore = WeaponState.Ore;
            try
            {
                fc.ResetForTest();
                CheckHand(pc, wv, parts);
                CheckFollowsBody(fc, pc, wv, bodies, parts);
            }
            finally
            {
                WeaponState.Restore(winv, weq, ore);
                fc.ResetForTest(); bodies.FinishMotion();
                wv.RefreshModel("hero");
            }
            if (_ok) Debug.Log($"[{_tag}] weapon model OK - {string.Join(" · ", parts)}");
            return _ok;
        }

        private static Transform Hand(PlayerController pc) => CharacterVisual.FindOrCreateWeaponSocket(pc.Visual.gameObject, pc.Animator);

        private static void CheckHand(PlayerController pc, WeaponVisual wv, List<string> parts)
        {
            wv.RefreshModel("hero");
            if (wv.ModelInstance == null) { Fail($"주인공 손에 무기 모델이 없음({GoWeaponModels.ModelFor("hero")})"); return; }
            if (wv.ModelName != GoWeaponModels.ModelFor("hero")) Fail($"모델 이름 {wv.ModelName} ≠ {GoWeaponModels.ModelFor("hero")}");
            if (wv.ModelInstance.transform.parent != Hand(pc)) Fail("모델이 지금 몸 손 소켓 밑이 아님");
            if (wv.BladeShown) Fail("모델이 보이는데 코드 칼날이 켜져 있음");
            var old = wv.ModelInstance;
            wv.RefreshModel("story_haram"); // 활 인물
            if (wv.ModelName != "wpn_bow_common" || wv.ModelInstance == old) Fail($"활 인물로 바꿔도 모델이 안 바뀜({wv.ModelName})");
            wv.RefreshModel("hero");
            if (wv.ModelName != "wpn_sword_common") Fail("주인공으로 돌아오면 검이어야 함");
            parts.Add($"주인공 손에 {wv.ModelName}·코드 칼날 꺼짐·활 인물이면 wpn_bow_common");
        }

        private static void CheckFollowsBody(FieldCombat fc, PlayerController pc, WeaponVisual wv, PartyBodies bodies, List<string> parts)
        {
            int idx = -1;
            for (int i = 0; i < fc.Party.Count; i++) if (fc.Party[i].Id == PartyBodies.BanditId) idx = i;
            if (idx < 0 || bodies.PrefabFor(PartyBodies.BanditId) == null) { parts.Add("편성 교체 따라가기는 건너뜀(산적이 명단에 없거나 몸 모델이 이 PC 에 없음)"); return; }
            var heroBody = pc.Visual;
            if (!fc.Swap(idx)) { Fail("산적으로 교체가 안 됨"); return; }
            bodies.FinishMotion();
            if (pc.Visual == heroBody) { Fail("교체했는데 몸이 그대로"); return; }
            string expect = GoWeaponModels.ModelFor(PartyBodies.BanditId);
            if (wv.ModelInstance == null) { Fail($"몸이 바뀐 뒤 무기 모델이 없음({expect})"); return; }
            if (wv.ModelName != expect) Fail($"새 몸의 무기 모델 {wv.ModelName} ≠ {expect}");
            if (wv.ModelInstance.transform.parent != Hand(pc)) Fail("무기가 새 몸 손으로 안 따라옴(옛 몸 손에 남음)");
            if (heroBody != null && heroBody.GetComponentsInChildren<Transform>(true).Any(t => t == wv.ModelInstance.transform)) Fail("옛 몸 밑에 무기가 남음");
            bodies.Show(PartyBodies.HeroId); bodies.FinishMotion(); // 교체엔 재사용 대기가 있어 돌아올 땐 몸 보이기를 직접(무기 이벤트는 같은 경로)
            if (pc.Visual != heroBody) Fail("주인공으로 못 돌아옴");
            else if (wv.ModelInstance == null || wv.ModelInstance.transform.parent != Hand(pc)) Fail("돌아온 주인공 손에 무기가 안 옴");
            parts.Add($"편성 교체 → 무기가 새 몸 손으로 따라옴({expect}) · 돌아오면 주인공 손");
        }

        private static void Fail(string msg)
        {
            _ok = false;
            Debug.LogError($"[{_tag}] weapon model FAIL - {msg}");
        }
    }
}
