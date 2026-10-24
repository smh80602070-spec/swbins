using System.Collections.Generic;
using System.Reflection;
using UnityEngine;
using Saga.Go.Combat;
using Saga.Go.Data;
using Saga.Go.UI;

namespace Saga.EditorTools
{
    /// <summary>
    /// tasks U-0199 1만리 동료 우정(고돗 G-0340 짝) 진단 — `PlaytestHeadless` 가 길찾기 뒤에 부른다(한 프레임 안).
    /// ① 단계(누적 0·20·50…650 → Lv 0~10 · 낯섦·친근·신뢰·지기 · 다음까지) ② 점수(앞에 선 동료 +2·다른 동료 +1·주인공 0·탐사 +15) · 오름 알림(와/과)
    /// ③ 지기 처음 = 인연 매듭 1(한 번만) · 지기 대사 = 인물 한마디 ④ 진짜 들판 — FieldCombat 처치 훅(편성 동료만)·도감 상세 줄 ⑤ 세이브 칸·왕복·옛 세이브 ⑥ 손잡이.
    /// 끝나면 우정·재능 재료를 시작 때로.
    /// </summary>
    public static class PlaytestGoFriendship
    {
        private const string T = "[PlaytestHeadless] friend";
        private static bool _ok, _step;

        public static bool Run()
        {
            _ok = true;
            string f0 = GoFriendship.Snapshot();
            var tal0 = TalentState.Snapshot();
            var mats0 = TalentState.SnapshotMats();
            string m = "";
            try
            {
                GoFriendship.ResetForTest();
                string a = null, b = null;
                foreach (var h in GoHeroes.Story) { if (a == null) a = h.Id; else if (b == null) { b = h.Id; break; } }
                if (a == null || b == null) { Fail("이야기 동료 둘 없음"); return false; }

                // ① 단계
                Begin();
                if (GoFriendship.LevelOf(19) != 0 || GoFriendship.LevelOf(20) != 1 || GoFriendship.LevelOf(649) != 9 || GoFriendship.LevelOf(9999) != 10) Fail("Lv 문턱");
                if (GoFriendship.TierOf(2) != 0 || GoFriendship.TierOf(3) != 1 || GoFriendship.TierOf(6) != 2 || GoFriendship.TierOf(9) != 3) Fail("단계 묶음");
                if (GoFriendship.ToNext(15f) != 5 || GoFriendship.ToNext(700f) != 0) Fail("다음까지");
                if (GoFriendship.WithWa("명운") != "명운과" || GoFriendship.WithWa("현책") != "현책과" || GoFriendship.WithWa("미호") != "미호와" || GoFriendship.WithWa("Vanguard") != "Vanguard") Fail("와/과");
                End("tier OK - 누적 20 → Lv1 · 650 → Lv10 · 낯섦 0~2·친근 3~5·신뢰 6~8·지기 9~10 · 다음까지 · 와/과");

                // ② 점수
                Begin();
                GoFriendship.OnKill(a, new[] { a, b });
                if (GoFriendship.Pts(a) != GoFriendship.KillActive || GoFriendship.Pts(b) != GoFriendship.KillParty) Fail($"처치 앞 {GoFriendship.Pts(a)}·다른 {GoFriendship.Pts(b)}");
                if (GoFriendship.Add("hero", 50f).Length != 0 || GoFriendship.Pts("hero") != 0f) Fail("주인공이 셈");
                string up = GoFriendship.Add(b, GoFriendship.Dispatch + 5f);   // 1 + 20 = 21 → Lv1
                if (!up.Contains("Lv.1") || !up.Contains(GoFriendship.WithWa(GoFriendship.NameOf(b)))) Fail($"오름 알림「{up}」");
                End($"pts OK - 앞 +{GoFriendship.KillActive}·다른 +{GoFriendship.KillParty}·주인공 0·탐사 +{GoFriendship.Dispatch} · 「{up}」");

                // ③ 지기·매듭
                Begin();
                int k0 = TalentState.Count(GoTalent.Mat.Knot);
                string up9 = GoFriendship.Add(a, 540f);                          // → Lv9 지기
                int k1 = TalentState.Count(GoTalent.Mat.Knot);
                GoFriendship.Add(a, 200f);                                       // Lv10 — 매듭 또 없음
                int k2 = TalentState.Count(GoTalent.Mat.Knot);
                GoHeroes.TryGet(a, out var ha);
                if (k1 != k0 + 1 || k2 != k1 || !GoFriendship.KnotGiven(a)) Fail($"매듭 {k0}→{k1}→{k2}");
                string qa = GoHeroes.Quote(ha);
                if (!string.IsNullOrEmpty(qa) && GoFriendship.Line(a) != qa) Fail($"지기 대사「{GoFriendship.Line(a)}」≠ 한마디");
                if (!up9.Contains("+1")) Fail($"지기 알림「{up9}」");
                End($"knot OK - 지기 처음 인연 매듭 +1(Lv10 에도 또 없음) · 지기 대사 = 그 인물 한마디 · 「{up9}」");

                // ④ 진짜 들판
                Begin();
                var fc = FieldCombat.Instance;
                if (fc == null) Fail("FieldCombat 없음");
                else
                {
                    var ids = new List<string>();
                    foreach (var mem in fc.Party) if (mem.Id != FieldCombat.HeroId) ids.Add(mem.Id);
                    var before = new Dictionary<string, float>();
                    foreach (var id in ids) before[id] = GoFriendship.Pts(id);
                    float heroBefore = GoFriendship.Pts(FieldCombat.HeroId);
                    typeof(FieldCombat).GetMethod("OnFriendKill", BindingFlags.NonPublic | BindingFlags.Instance).Invoke(fc, new object[] { null });
                    foreach (var id in ids)
                    {
                        float want = id == fc.Active?.Id ? GoFriendship.KillActive : GoFriendship.KillParty;
                        if (Mathf.Abs(GoFriendship.Pts(id) - before[id] - want) > 0.001f) Fail($"{id} 처치 훅 +{GoFriendship.Pts(id) - before[id]} ≠ {want}");
                    }
                    if (GoFriendship.Pts(FieldCombat.HeroId) != heroBefore) Fail("주인공이 처치 훅에서 셈");
                    string dexId = null;   // 도감 「동행」 = PartyState 명단의 도감 인물(옛 슬라이스 「산적」은 도감 인물이 아니다)
                    foreach (var id in PartyState.MemberIds) if (GoHeroes.TryGet(id, out _)) { dexId = id; break; }
                    string dex = dexId != null ? HeroDexUi.Detail(dexId) : "(편성에 도감 인물 없음 — 도감 줄은 못 봄)";
                    if (dexId != null && !dex.Contains(GoFriendship.DexLine(dexId))) Fail($"편성 동료 {dexId} 도감 상세에 우정 줄 없음「{dex}」");
                    m += $" 편성 동료 {ids.Count} · 도감「{dex.Split('\n')[dex.Split('\n').Length - 1]}」";
                    End($"field OK - FieldCombat 처치 훅(편성 동료 {ids.Count}, 주인공 0) · 편성 동료({dexId}) 도감 상세 우정 줄「{dex.Split('\n')[dex.Split('\n').Length - 1]}」");
                }

                // ⑤ 세이브
                Begin();
                string snap = GoFriendship.Snapshot();
                if (!SaveState.ToJson().Contains("\"friendJson\"")) Fail("세이브에 friendJson 없음");
                GoFriendship.Restore(null);
                if (GoFriendship.Pts(a) != 0f) Fail("옛 세이브인데 점수");
                GoFriendship.Restore(snap);
                if (GoFriendship.Level(a) != 10 || !GoFriendship.KnotGiven(a)) Fail("왕복");
                End("save OK - friendJson 왕복(점수·매듭 받은 이)·옛 세이브 0");

                // ⑥ 손잡이
                Begin();
                GoFriendship.On = false;
                float pb = GoFriendship.Pts(b);
                GoFriendship.OnKill(b, new[] { b });
                if (GoFriendship.Pts(b) != pb || GoFriendship.DexLine(b).Length != 0) Fail("껐는데 우정");
                End("off OK - 끄면 점수·줄 없음");
            }
            finally
            {
                GoFriendship.On = true;
                GoFriendship.Restore(f0);
                TalentState.Restore(tal0, mats0);
            }
            if (_ok) Debug.Log($"{T} done |{m}");
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
