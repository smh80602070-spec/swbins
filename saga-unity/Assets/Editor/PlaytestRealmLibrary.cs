using System.Collections.Generic;
using System.Linq;
using UnityEditor;
using UnityEngine;
using Saga.Realm.Data;

namespace Saga.EditorTools
{
    /// <summary>
    /// `un.rk.library` 서고 — 규칙 층만 본다(RECURRING R-3, 화면 없이). 서고 = 익힌 문제를 익힌 순번 역순(최근 먼저)으로 최대 limit 개 보이는 것:
    /// ① 아무것도 안 익히면 비어 있음 ② 순서·기본 20 개 상한·limit 인자 ③ 분야 필터 ④ 항목에 문제·정답 글·해설이 채워짐 ⑤ 모르는 id 는 건너뛰고 상한을 안 먹음
    /// ⑥ 새로 처음 맞히면 맨 앞에 붙고 다시 맞혀도 중복이 안 생김 ⑦ 세이브 스냅샷 왕복이 순서를 지킴.
    /// `-executeMethod Saga.EditorTools.PlaytestRealmLibrary.Run` → "[PlaytestRealmLibrary] OK/FAIL".
    /// </summary>
    public static class PlaytestRealmLibrary
    {
        [MenuItem("Saga/Playtest Realm Library")]
        public static void Run()
        {
            PlaytestKit.Begin("[PlaytestRealmLibrary]");
            using (PlaytestKit.ErrorCounter()) Checks();
            PlaytestKit.Summary("PlaytestRealmLibrary");
            if (Application.isBatchMode) EditorApplication.Exit(PlaytestKit.Fails == 0 ? 0 : 1);
        }

        private static void Checks()
        {
            var bank = RealmQuizData.Bank;
            // ① 비어 있음
            RealmQuizState.Restore(null, null, null, 0, 0, 0, 0);
            PlaytestKit.Check(RealmQuizState.LearnedList().Count == 0, "un.rk.library: 안 익혔는데 서고가 안 비어 있음");

            // ② 순서·상한 — 문제 25개를 은행 순서대로 익힌 상태
            var order = bank.Take(25).Select(q => q.Id).ToList();
            RealmQuizState.Restore(order, null, null, 0, 0, 0, 0);
            var all = RealmQuizState.LearnedList();
            PlaytestKit.Check(all.Count == 20, $"un.rk.library: 기본 상한 {all.Count} ≠ 20");
            PlaytestKit.Check(all.Count > 0 && all[0].Id == order[24] && all[all.Count - 1].Id == order[5], $"un.rk.library: 최근 먼저 순서가 아님 {(all.Count > 0 ? all[0].Id : "-")}…{(all.Count > 0 ? all[all.Count - 1].Id : "-")}");
            PlaytestKit.Check(RealmQuizState.LearnedList(null, 5).Count == 5, "un.rk.library: limit 5 가 안 먹음");
            PlaytestKit.Check(RealmQuizState.LearnedList(null, 100).Count == 25, "un.rk.library: limit 100 인데 25개가 안 나옴");

            // ③ 분야 필터
            string cat = bank[24].Cat;
            var filtered = RealmQuizState.LearnedList(cat, 100);
            var expect = order.Where(id => RealmQuizData.ById(id).Cat == cat).Reverse().ToList();
            PlaytestKit.Check(filtered.Count == expect.Count && filtered.Select(e => e.Id).SequenceEqual(expect), $"un.rk.library: 분야 필터 {filtered.Count}≠{expect.Count} 또는 순서");
            PlaytestKit.Check(filtered.All(e => e.Cat == cat), "un.rk.library: 다른 분야가 섞임");

            // ④ 항목 내용
            foreach (var e in all)
            {
                var q = RealmQuizData.ById(e.Id);
                if (string.IsNullOrEmpty(e.Q) || string.IsNullOrEmpty(e.AnswerText) || string.IsNullOrEmpty(e.Why) || e.AnswerText != q.Choices[q.AnswerIdx] || e.Lv != q.Lv)
                {
                    PlaytestKit.Fail($"un.rk.library: {e.Id} 항목이 비었거나 문제 은행과 다름");
                    break;
                }
            }

            // ⑤ 모르는 id 는 건너뛰고 상한을 안 먹음
            RealmQuizState.Restore(new List<string> { "zzz_unknown", order[0], order[1] }, null, null, 0, 0, 0, 0);
            var skip = RealmQuizState.LearnedList(null, 2);
            PlaytestKit.Check(skip.Count == 2 && skip[0].Id == order[1] && skip[1].Id == order[0], $"un.rk.library: 모르는 id 가 상한을 먹음 {skip.Count}");

            // ⑥ 처음 맞히면 맨 앞, 다시 맞혀도 중복 없음
            RealmQuizState.Restore(order, null, null, 0, 0, 0, 0);
            var fresh = bank[30];
            PlaytestKit.Check(!order.Contains(fresh.Id), "un.rk.library: 진단 전제 — 31번째 문제가 이미 익힘");
            var p = new RealmQuizState.Presented(fresh.Id, fresh.Cat, fresh.Lv, fresh.Q, fresh.Choices, fresh.AnswerIdx, false);
            var r1 = RealmQuizState.Answer(p, p.CorrectIndex);
            PlaytestKit.Check(r1.Ok && r1.First, "un.rk.library: 처음 맞힘이 first 가 아님");
            var after = RealmQuizState.LearnedList(null, 100);
            PlaytestKit.Check(after.Count == 26 && after[0].Id == fresh.Id, $"un.rk.library: 새로 익힌 문제가 맨 앞이 아님 {after.Count}");
            RealmQuizState.Answer(new RealmQuizState.Presented(fresh.Id, fresh.Cat, fresh.Lv, fresh.Q, fresh.Choices, fresh.AnswerIdx, true), fresh.AnswerIdx);
            PlaytestKit.Check(RealmQuizState.LearnedList(null, 100).Count == 26, "un.rk.library: 다시 맞혔더니 서고에 중복이 생김");

            // ⑦ 세이브 스냅샷 왕복
            var snap = RealmQuizState.SnapshotLearned();
            RealmQuizState.Restore(null, null, null, 0, 0, 0, 0);
            RealmQuizState.Restore(snap, null, null, 0, 0, 0, 0);
            PlaytestKit.Check(RealmQuizState.SnapshotLearned().SequenceEqual(snap) && RealmQuizState.LearnedList(null, 1)[0].Id == fresh.Id, "un.rk.library: 세이브 왕복이 순서를 바꿈");
        }
    }
}
