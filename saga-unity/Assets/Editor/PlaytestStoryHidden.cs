using System.Collections.Generic;
using System.Reflection;
using UnityEngine;
using Saga.Story.Data;
using Saga.Story.World;

namespace Saga.EditorTools
{
    /// <summary>
    /// tasks U-0181 4종횡 숨은 우두머리(고돗 G-0319 짝) 진단 — `PlaytestStorySlice` 준비 단계 끝(띄우기 뒤)이 부른다(한 프레임 안, 틱은 손으로).
    /// 들판 두목을 복제해 진짜로 쓰러뜨린다(다른 적은 잠깐 끔·레벨은 잠깐 99 — 레벨업 3택이 안 뜨게): ① 규칙(읽음·60초·끔)
    /// ② 비문(멀면 안 읽힘·곁이면 처음만) ③ 빠른 처치 → 2초 뒤 숨은 우두머리(체력 ×2.5·공격 ×1.5·이름)·느린 처치·안 읽음은 안 섬
    /// ④ 숨은 우두머리 처치 = 경험치 ×2.5·처치 기록·두목 사명 그대로 ⑤ 세이브 칸·왕복·옛 세이브 ⑥ 손잡이.
    /// 끝나면 복제·숨은 적·전리품 표식·땅 표식을 지우고 다른 적·사명·직업·판 등급·소환·달 사명·숨은 기록을 시작 때로.
    /// </summary>
    public static class PlaytestStoryHidden
    {
        private const string T = "[PlaytestStorySlice] hidden";
        private const BindingFlags PS = BindingFlags.Public | BindingFlags.NonPublic | BindingFlags.Static;
        private const BindingFlags PI = BindingFlags.NonPublic | BindingFlags.Instance;
        private static bool _ok, _step;

        public static bool Run()
        {
            _ok = true;
            StoryEnemy boss = null;
            foreach (var e in StoryEnemy.All)
                if (e != null && !e.IsDead && e.IsBoss && !e.IsLabyrinthEnemy && !e.IsHidden) { boss = e; break; }
            var clue = StoryHiddenClue.Instance;
            if (boss == null || clue == null) { Fail($"들판 두목·비문 없음(두목 {boss != null}·비문 {clue != null})"); return false; }

            int kills0 = StoryQuestState.Kills, bossKills0 = StoryQuestState.BossKills;
            int lv0 = StoryJobState.Level; float exp0 = StoryJobState.Exp; string job0 = StoryJobState.Job;
            var rank = SnapStatics(typeof(StoryRunRank));
            var summon = SnapStatics(typeof(StorySummonState));
            string month0 = StoryMonthly.Snapshot(), hidden0 = StoryHidden.Snapshot();
            var decals0 = new HashSet<StoryGroundDecal>(Object.FindObjectsByType<StoryGroundDecal>(FindObjectsSortMode.None));
            var loot0 = new HashSet<StoryLootMarker>(Object.FindObjectsByType<StoryLootMarker>(FindObjectsSortMode.None));
            var hidden = new List<(GameObject go, Vector3 at)>();
            var made = new List<GameObject>();
            var firstF = typeof(StoryEnemy).GetField("_firstHitAt", PI);
            Vector3 bp = boss.transform.position;
            try
            {
                foreach (var e in StoryEnemy.All)
                    if (e != null && e.gameObject.activeSelf) { hidden.Add((e.gameObject, e.transform.position)); e.gameObject.SetActive(false); e.transform.position += new Vector3(5000f, 0f, 0f); }
                StoryJobState.Restore(99, 0f, job0);
                StoryHidden.ResetForTest();
                StoryHiddenClue.ClearForTest();

                // ① 규칙
                Begin();
                if (StoryHidden.ShouldSummon(0f, 10f)) Fail("안 읽었는데 부름");
                StoryHidden.ReadClue();
                if (!StoryHidden.ShouldSummon(0f, 60f) || StoryHidden.ShouldSummon(0f, 60.1f) || StoryHidden.ShouldSummon(float.NaN, 1f)) Fail("60초 문턱·첫 타 없음");
                StoryHidden.ResetForTest();
                End("rule OK - 읽어야·첫 타부터 60초 안·첫 타 없으면 안 부름");

                // ② 비문
                Begin();
                float cx = StoryHiddenClue.ClueX;
                if (clue.Sense(new Vector3(cx - 3f, 0f, 0f)) || StoryHidden.Read) Fail("멀리서 읽힘");
                if (clue.Sense(new Vector3(cx, 3f, 0f))) Fail("공중에서 읽힘");
                if (!clue.Sense(new Vector3(cx - 0.5f, 0f, 0f)) || !StoryHidden.Read) Fail("곁인데 안 읽힘");
                if (clue.Sense(new Vector3(cx, 0f, 0f))) Fail("두 번째도 처음 알림");
                End($"clue OK - 들판 끝 x {cx:0.0}(두목 x {bp.x:0.0} 뒤) · 멀리·공중 안 읽힘 · 곁 처음만");

                // ③ 빠른 처치 → 숨은 우두머리 · 느린 처치 · 안 읽음
                Begin();
                var fast = Clone(boss, bp, made);
                fast.TakeDamage(1f);
                if (float.IsNaN(fast.FirstHitAt)) Fail("첫 타 시각 안 남음");
                fast.TakeDamage(1e9f);
                if (!fast.IsDead || !StoryHiddenClue.Pending) Fail($"빠른 처치인데 기다림 없음(죽음 {fast.IsDead})");
                if (StoryHiddenClue.StepPending(StoryHidden.DelaySec - 0.1f) != null) Fail("2초 전에 섬");
                var hb = StoryHiddenClue.StepPending(0.2f);
                if (hb == null) Fail("2초 뒤 안 섬");
                else
                {
                    made.Add(hb.gameObject);
                    float want = StoryCombat.BossHp * StoryRound.FoeMul() * StoryHidden.HpMul;
                    if (!hb.IsHidden || !hb.IsBoss || Mathf.Abs(hb.MaxHp - want) > 0.5f || Mathf.Abs(hb.Hp - want) > 0.5f) Fail($"숨은 우두머리 체력 {hb.Hp}/{hb.MaxHp} ≠ {want}");
                    if (!Mathf.Approximately(hb.HitMul, StoryHidden.DmgMul) || !hb.IntroPlayed) Fail($"공격 ×{hb.HitMul}·등장 컷 {hb.IntroPlayed}");
                    if (Vector3.Distance(hb.transform.position, bp) > 0.01f) Fail("두목 자리 아님");
                }
                StoryHiddenClue.ClearForTest();
                var slow = Clone(boss, bp, made);
                slow.TakeDamage(1f);
                firstF.SetValue(slow, Time.time - StoryHidden.FastSec - 1f);
                slow.TakeDamage(1e9f);
                if (StoryHiddenClue.Pending) Fail("61초 처치인데 부름");
                StoryHidden.ResetForTest();
                StoryHiddenClue.ClearForTest();
                var unread = Clone(boss, bp, made);
                unread.TakeDamage(1f); unread.TakeDamage(1e9f);
                if (StoryHiddenClue.Pending) Fail("안 읽었는데 부름");
                End($"summon OK - 빠른 처치 → 2초 뒤 「{hb?.DisplayName}」 체력 ×{StoryHidden.HpMul}·공격 ×{StoryHidden.DmgMul}·등장 컷 없음 · 61초·안 읽음은 안 섬");

                // ④ 숨은 우두머리 처치
                Begin();
                if (hb != null)
                {
                    StoryRunRank.ClearForTest();
                    hb.TakeDamage(1f);
                    if (StoryRunRank.Active) Fail("숨은 우두머리를 쳤더니 판이 열림(닫을 두목이 없어 모닥불이 막힌다)");
                    int bk = StoryQuestState.BossKills, hk = StoryHidden.Kills;
                    float e0 = StoryJobState.Exp;
                    hb.TakeDamage(1e9f);
                    float gain = StoryJobState.Exp - e0, wantGain = StoryCombat.BossExp * StoryHidden.ExpMul * StoryRound.GainMul();
                    if (!hb.IsDead || StoryHidden.Kills != hk + 1) Fail($"처치 기록 {StoryHidden.Kills} ≠ {hk + 1}");
                    if (Mathf.Abs(gain - wantGain) > 0.5f) Fail($"경험치 +{gain} ≠ {wantGain}");
                    if (StoryQuestState.BossKills != bk) Fail("두목 사명이 또 셈");
                    End($"kill OK - 쳐도 판 안 열림 · 경험치 +{gain:0}(두목 ×{StoryHidden.ExpMul}) · 처치 기록 1 · 두목 사명 그대로");
                }

                // ⑤ 세이브
                Begin();
                StoryHidden.ResetForTest();
                StoryHidden.ReadClue();
                StoryHidden.OnKilled();
                string snap = StoryHidden.Snapshot();
                if (!StorySaveState.ToJson().Contains("\"hiddenJson\"")) Fail("세이브에 hiddenJson 없음");
                StoryHidden.Restore(null);
                if (StoryHidden.Read || StoryHidden.Kills != 0) Fail("옛 세이브인데 남음");
                StoryHidden.Restore(snap);
                if (!StoryHidden.Read || StoryHidden.Kills != 1) Fail("세이브 왕복");
                End("save OK - hiddenJson 칸·왕복(읽음·처치)·옛 세이브 빈 것");

                // ⑥ 손잡이
                Begin();
                StoryHidden.On = false;
                StoryHiddenClue.ClearForTest();
                var off = Clone(boss, bp, made);
                off.TakeDamage(1f); off.TakeDamage(1e9f);
                if (StoryHiddenClue.Pending) Fail("껐는데 부름");
                End("off OK - 손잡이 끄면 안 섬");
            }
            finally
            {
                StoryHidden.On = true;
                StoryHiddenClue.ClearForTest();
                foreach (var g in made) if (g != null) Object.DestroyImmediate(g);
                foreach (var d in Object.FindObjectsByType<StoryGroundDecal>(FindObjectsSortMode.None)) if (!decals0.Contains(d)) Object.DestroyImmediate(d.gameObject);
                foreach (var l in Object.FindObjectsByType<StoryLootMarker>(FindObjectsSortMode.None)) if (!loot0.Contains(l)) Object.DestroyImmediate(l.gameObject);
                foreach (var h in hidden) if (h.go != null) { h.go.transform.position = h.at; h.go.SetActive(true); }
                StoryQuestState.Restore(kills0, bossKills0);
                StoryJobState.Restore(lv0, exp0, job0);
                RestoreStatics(rank);
                RestoreStatics(summon);
                StoryMonthly.Restore(month0);
                StoryHidden.Restore(hidden0);
            }
            return _ok;
        }

        private static StoryEnemy Clone(StoryEnemy boss, Vector3 at, List<GameObject> made)
        {
            var go = Object.Instantiate(boss.gameObject, at, boss.transform.rotation);
            go.name = "HiddenTestBoss";
            go.SetActive(true); // 원본을 끈 뒤 복제했으니 켠다
            made.Add(go);
            return go.GetComponent<StoryEnemy>();
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
