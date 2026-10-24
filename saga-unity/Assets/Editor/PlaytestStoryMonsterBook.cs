using System.Collections.Generic;
using System.Reflection;
using UnityEngine;
using Saga.Story.Data;
using Saga.Story.World;

namespace Saga.EditorTools
{
    /// <summary>
    /// tasks U-0222 4종횡 괴물 카드 도감(고돗 G-0374 짝) 진단 — `PlaytestStorySlice` 가 동료 우정 진단 뒤에 부른다(한 프레임 안).
    /// ① 종(열일곱·잡몹·시대·두목 고유 기술·숨은 우두머리·모르는 종 빈 글) ② 씨앗 고정 잡몹 1000 처치 카드 ≈5% ±1.5% · 전역 Random 흐름 그대로
    /// ③ 확률(두목·숨은 확정·관문 대장 50%) ④ 다섯 장 = 다 모음(한 번) · 여섯째 안 쌓임 ⑤ 공격 곱(종 2 = 1.004 · 편성 곱에 들어감) ⑥ 끔 1.0
    /// ⑦ 저장 왕복·옛 세이브 0·모르는 종 버림 ⑧ 진짜 처치(복제 잡졸, 비경 표시로 경험·사명·판 등급 안 셈) — 씨앗으로 나온 판·안 나온 판 ⑨ 장의 모든 적에 종.
    /// 끝나면 카드·달 사명·문파·우정·콤보·판 등급·굴림을 시작 때로.
    /// </summary>
    public static class PlaytestStoryMonsterBook
    {
        private const string T = "[PlaytestStorySlice] book";
        private const BindingFlags PS = BindingFlags.Public | BindingFlags.NonPublic | BindingFlags.Static;
        private static bool _ok, _step;

        public static bool Run()
        {
            _ok = true;
            string book0 = StoryMonsterBook.Snapshot();
            string month0 = StoryMonthly.Snapshot(), guild0 = StoryGuild.Snapshot(), bond0 = StoryBond.Snapshot();
            var combo = SnapStatics(typeof(StoryComboKill));
            var rank = SnapStatics(typeof(StoryRunRank));
            var loot0 = new HashSet<StoryLootMarker>(Object.FindObjectsByType<StoryLootMarker>(FindObjectsSortMode.None));
            var made = new List<GameObject>();
            string m = "";
            try
            {
                string chief = "hwanggeon_chief";

                // ① 종
                Begin();
                var sp = StoryMonsterBook.Species;
                string g = StoryMonsterBook.SpeciesOf(false, false, "", StoryEra.Past, "");
                string mo = StoryMonsterBook.SpeciesOf(false, false, "", StoryEra.Modern, StoryEras.Foes[1, 0].NameKey);
                string bo = StoryMonsterBook.SpeciesOf(false, true, chief, StoryEra.Past, "");
                string hi = StoryMonsterBook.SpeciesOf(true, true, chief, StoryEra.Past, "");
                string un = StoryMonsterBook.SpeciesOf(false, false, "", StoryEra.Future, "enemy.nope");
                if (sp.Length != 17) Fail($"종 {sp.Length} ≠ 17");
                if (g != StoryMonsterBook.Grunt || mo != StoryEras.Foes[1, 0].NameKey || bo != chief || hi != StoryMonsterBook.Hidden || un != "") Fail($"종 매김 {g}·{mo}·{bo}·{hi}·「{un}」");
                foreach (var s in sp) if (string.IsNullOrEmpty(StoryMonsterBook.Name(s)) || StoryMonsterBook.Name(s) == s) Fail($"종 이름 없음 {s}");
                End($"species OK - {sp.Length}종(잡몹 1·시대 8·두목 고유 기술 7·숨은 1) · 「{StoryMonsterBook.Name(mo)}」·「{StoryMonsterBook.Name(bo)}」 · 모르는 종 빈 글");

                // ② 1000 처치 ≈5% · 전역 Random 그대로
                Begin();
                var rs = Random.state;
                float before = Random.value; Random.state = rs;
                StoryMonsterBook.SeedForTest(20260824);
                int cards = 0;
                for (int i = 0; i < 1000; i++)
                {
                    StoryMonsterBook.ResetForTest();
                    if (StoryMonsterBook.OnKill(g, StoryMonsterBook.Chance(false, false, false)).HasValue) cards++;
                }
                float after = Random.value;
                Random.state = rs;
                if (Mathf.Abs(cards / 1000f - StoryMonsterBook.GruntChance) > 0.015f) Fail($"잡몹 1000 카드 {cards}(≈50)");
                if (before != after) Fail("전역 Random 흐름이 바뀜");
                End($"chance OK - 씨앗 고정 잡몹 1000 처치 카드 {cards}({cards / 10f:0.0}%) · 전역 Random 흐름 그대로");

                // ③ 확률
                Begin();
                StoryMonsterBook.ResetForTest();
                bool sure = true;
                for (int i = 0; i < 4; i++) sure &= StoryMonsterBook.OnKill(chief, StoryMonsterBook.Chance(false, true, false)).HasValue;
                sure &= StoryMonsterBook.OnKill(StoryMonsterBook.Hidden, StoryMonsterBook.Chance(true, true, false)).HasValue;
                if (!sure) Fail("두목·숨은 우두머리 확정 아님");
                if (StoryMonsterBook.Chance(false, true, true) != 0.5f || StoryMonsterBook.Chance(false, false, false) != 0.05f) Fail("관문 대장 50%·잡몹 5%");
                End("odds OK - 두목·숨은 우두머리 확정 · 관문 대장 50% · 잡몹 5%");

                // ④ 다섯 장 = 다 모음
                Begin();
                var fifth = StoryMonsterBook.OnKill(chief, 1f);
                var sixth = StoryMonsterBook.OnKill(chief, 1f);
                int setMsgs = 0;
                if (fifth.HasValue && fifth.Value.SetDone) setMsgs++;
                if (!fifth.HasValue || fifth.Value.N != 5 || !fifth.Value.SetDone) Fail("다섯째가 다 모음이 아님");
                if (sixth.HasValue || StoryMonsterBook.Count(chief) != 5) Fail($"여섯째가 쌓임 {StoryMonsterBook.Count(chief)}");
                string toast = fifth.HasValue ? StoryMonsterBook.ToastText(fifth.Value) : "";
                if (setMsgs != 1 || !toast.Contains(StoryMonsterBook.Name(chief))) Fail($"다 모음 알림「{toast}」");
                End($"set OK - 다섯 장 = 다 모음(알림 한 번「{toast}」) · 여섯째 안 쌓임");

                // ⑤ 공격 곱
                Begin();
                float party1 = StoryPartyState.AtkMultiplier;
                for (int i = 0; i < 5; i++) StoryMonsterBook.OnKill(StoryMonsterBook.Hidden, 1f);
                float mul2 = StoryMonsterBook.AtkMul;
                float party2 = StoryPartyState.AtkMultiplier;
                if (StoryMonsterBook.CompleteCount() != 2 || Mathf.Abs(mul2 - 1.004f) > 1e-5f) Fail($"종 2 다 모음 곱 {mul2}");
                if (Mathf.Abs(party2 / party1 - 1.004f / 1.002f) > 1e-4f) Fail($"편성 곱에 안 들어감 {party1}→{party2}");
                End($"atk OK - 다 모은 종 2 = ×{mul2:0.000} · 편성 공격 곱 {party1:0.0000}→{party2:0.0000}");

                // ⑥ 끔
                Begin();
                StoryMonsterBook.On = false;
                float offMul = StoryMonsterBook.AtkMul;
                var offCard = StoryMonsterBook.OnKill(g, 1f);
                StoryMonsterBook.On = true;
                if (offMul != 1f || offCard.HasValue) Fail($"껐는데 곱 {offMul}·카드");
                End("off OK - 끄면 곱 1.0·카드 없음");

                // ⑦ 저장
                Begin();
                string snap = StoryMonsterBook.Snapshot();
                if (!StorySaveState.ToJson().Contains("\"cardsJson\"")) Fail("세이브에 cardsJson 없음");
                StoryMonsterBook.Restore(null);
                if (StoryMonsterBook.FoundCount() != 0) Fail("옛 세이브인데 카드");
                StoryMonsterBook.Restore(snap);
                if (StoryMonsterBook.CompleteCount() != 2 || StoryMonsterBook.Count(chief) != 5) Fail("왕복");
                StoryMonsterBook.Restore("{\"rows\":[{\"id\":\"nope\",\"n\":3},{\"id\":\"hwanggeon\",\"n\":9}]}");
                if (StoryMonsterBook.FoundCount() != 1 || StoryMonsterBook.Count(g) != 5) Fail("모르는 종·넘침 안 누름");
                End($"save OK - cardsJson 왕복(다 모음 2) · 옛 세이브 0 · 모르는 종 버림·다섯 위는 누름 · 줄「{StoryMonsterBook.Line()}」");

                // ⑧ 진짜 처치
                Begin();
                StoryEnemy src = null;
                foreach (var e in StoryEnemy.All) if (e != null && !e.IsDead && !e.IsBoss && !e.IsHidden && !e.IsLabyrinthEnemy && e.Era == StoryEra.Past) { src = e; break; }
                if (src == null) Fail("들판 과거 잡졸 없음");
                else
                {
                    int yes = -1, no = -1;
                    for (int s = 0; s < 1000 && (yes < 0 || no < 0); s++)
                    {
                        bool hit = new System.Random(s).NextDouble() < StoryMonsterBook.GruntChance;
                        if (hit && yes < 0) yes = s; else if (!hit && no < 0) no = s;
                    }
                    StoryMonsterBook.ResetForTest();
                    var a = Clone(src, made);
                    if (a.BookSpecies != StoryMonsterBook.Grunt) Fail($"복제 잡졸 종 {a.BookSpecies}");
                    StoryMonsterBook.SeedForTest(no);
                    a.TakeDamage(1e9f);
                    int c1 = StoryMonsterBook.Count(StoryMonsterBook.Grunt);
                    var b = Clone(src, made);
                    StoryMonsterBook.SeedForTest(yes);
                    b.TakeDamage(1e9f);
                    int c2 = StoryMonsterBook.Count(StoryMonsterBook.Grunt);
                    if (!a.IsDead || !b.IsDead || c1 != 0 || c2 != 1) Fail($"진짜 처치 카드 {c1}→{c2}");
                    m += $" 진짜 처치 {c1}→{c2}";
                    End($"kill OK - 복제 잡졸 진짜 처치: 안 나오는 씨앗 0 · 나오는 씨앗 1(Die 한 줄)");
                }

                // ⑨ 장의 모든 적에 종
                Begin();
                int n = 0, none = 0;
                foreach (var e in StoryEnemy.All) if (e != null && !made.Contains(e.gameObject)) { n++; if (e.BookSpecies.Length == 0) none++; }
                if (n == 0 || none != 0) Fail($"종 없는 적 {none}/{n}");
                End($"scene OK - 장의 적 {n} 모두 종 있음");
            }
            finally
            {
                StoryMonsterBook.On = true;
                StoryMonsterBook.SeedForTest(System.Environment.TickCount);
                foreach (var go in made) if (go != null) Object.DestroyImmediate(go);
                foreach (var l in Object.FindObjectsByType<StoryLootMarker>(FindObjectsSortMode.None)) if (!loot0.Contains(l)) Object.DestroyImmediate(l.gameObject);
                StoryMonsterBook.Restore(book0);
                StoryMonthly.Restore(month0);
                StoryGuild.Restore(guild0);
                StoryBond.Restore(bond0);
                RestoreStatics(combo);
                RestoreStatics(rank);
            }
            if (_ok) Debug.Log($"{T} done |{m}");
            return _ok;
        }

        private static StoryEnemy Clone(StoryEnemy src, List<GameObject> made)
        {
            var go = Object.Instantiate(src.gameObject, src.transform.position + new Vector3(0f, 0f, 400f), src.transform.rotation);
            go.name = "BookTestGrunt";
            go.SetActive(true);
            made.Add(go);
            var e = go.GetComponent<StoryEnemy>();
            e.SetLabyrinthEnemy(true); // 경험치·사명·판 등급을 안 건드린다(PlaytestStoryCompanions 와 같은 수)
            return e;
        }

        private static Dictionary<FieldInfo, object> SnapStatics(System.Type t)
        {
            var d = new Dictionary<FieldInfo, object>();
            foreach (var f in t.GetFields(PS))
                if (!f.IsLiteral && !f.IsInitOnly && (f.FieldType.IsValueType || f.FieldType == typeof(string))) d[f] = f.GetValue(null);
            return d;
        }

        private static void RestoreStatics(Dictionary<FieldInfo, object> d)
        {
            foreach (var kv in d) kv.Key.SetValue(null, kv.Value);
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
