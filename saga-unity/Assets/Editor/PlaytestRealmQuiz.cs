using System.Collections.Generic;
using UnityEditor;
using UnityEngine;
using Saga.Realm.Data;

namespace Saga.EditorTools
{
    /// <summary>
    /// `un.rk.quiz` 문답 36 — 규칙 층만 본다(화면·씬 없이, RECURRING R-3). ① 문제 은행: 36문·id 중복 0·보기 넷·정답 번호·등급 1~3·분류 ② 출제: 안 익힌 쉬운 등급부터
    /// ③ 채점: 첫 정답(금·익힘·연속) / 재정답(금 줄어듦) / 오답(연속 0·틀림 기록) ④ 다 익히면 복습 출제 ⑤ 세이브 스냅샷 왕복.
    /// `-executeMethod Saga.EditorTools.PlaytestRealmQuiz.Run` → "[PlaytestRealmQuiz] OK/FAIL".
    /// </summary>
    public static class PlaytestRealmQuiz
    {
        [MenuItem("Saga/Playtest Realm Quiz")]
        public static void Run()
        {
            PlaytestKit.Begin("[PlaytestRealmQuiz]");
            using (PlaytestKit.ErrorCounter())
            {
                Random.InitState(20260824);
                CheckBank();
                CheckRound();
            }
            PlaytestKit.Summary("PlaytestRealmQuiz");
            if (Application.isBatchMode) EditorApplication.Exit(PlaytestKit.Fails == 0 ? 0 : 1);
        }

        private static void CheckBank()
        {
            var bank = RealmQuizData.Bank;
            PlaytestKit.Check(bank.Count == 36, $"un.rk.quiz: 문제 은행 {bank.Count} ≠ 36");
            var ids = new HashSet<string>();
            var cats = new HashSet<string>();
            foreach (var c in RealmQuizData.Cats) cats.Add(c.Key);
            int perCat = 0;
            foreach (var q in bank)
            {
                PlaytestKit.Check(ids.Add(q.Id), $"un.rk.quiz: id 중복 {q.Id}");
                PlaytestKit.Check(!string.IsNullOrEmpty(q.Q), $"un.rk.quiz: {q.Id} 문제 글이 비어 있음");
                PlaytestKit.Check(q.Choices.Length == 4, $"un.rk.quiz: {q.Id} 보기 {q.Choices.Length} ≠ 4");
                PlaytestKit.Check(q.AnswerIdx >= 0 && q.AnswerIdx < 4, $"un.rk.quiz: {q.Id} 정답 번호 {q.AnswerIdx}");
                PlaytestKit.Check(q.Lv >= 1 && q.Lv <= 3, $"un.rk.quiz: {q.Id} 등급 {q.Lv}");
                PlaytestKit.Check(cats.Contains(q.Cat), $"un.rk.quiz: {q.Id} 분류 {q.Cat} 가 목록에 없음");
            }
            foreach (var c in RealmQuizData.Cats) perCat += RealmQuizData.OfCat(c.Key).Count;
            PlaytestKit.Check(perCat == bank.Count, $"un.rk.quiz: 분류별 합 {perCat} ≠ {bank.Count}");
        }

        private static void CheckRound()
        {
            RealmQuizState.Restore(null, null, null, 0, 0, 0, 0);
            int lowLv = 3;
            foreach (var q in RealmQuizData.Bank) if (q.Lv < lowLv) lowLv = q.Lv;

            var p = RealmQuizState.Draw();
            PlaytestKit.Check(p.HasValue, "un.rk.quiz: 첫 출제가 null");
            if (!p.HasValue) return;
            var first = p.Value;
            PlaytestKit.Check(first.Lv == lowLv && !first.Review, $"un.rk.quiz: 첫 출제가 가장 쉬운 안 익힌 등급이 아님 Lv{first.Lv} review={first.Review}");
            PlaytestKit.Check(first.Choices.Length == 4 && first.CorrectIndex >= 0 && first.CorrectIndex < 4, "un.rk.quiz: 출제 보기·정답 번호 이상");

            var r1 = RealmQuizState.Answer(first, first.CorrectIndex);
            PlaytestKit.Check(r1.Ok && r1.First && r1.Gold > 0 && r1.Streak == 1, $"un.rk.quiz: 첫 정답 ok={r1.Ok} first={r1.First} gold={r1.Gold} streak={r1.Streak}");
            PlaytestKit.Check(RealmQuizState.GetProgress().Learned == 1 && RealmQuizState.GetProgress().Correct == 1, "un.rk.quiz: 익힘·정답 수가 안 오름");

            var r2 = RealmQuizState.Answer(first, first.CorrectIndex);
            PlaytestKit.Check(r2.Ok && !r2.First && r2.Gold > 0 && r2.Gold < r1.Gold && r2.Streak == 2, $"un.rk.quiz: 다시 맞힘 first={r2.First} gold={r2.Gold}(<{r1.Gold}) streak={r2.Streak}");

            int wrongIdx = (first.CorrectIndex + 1) % 4;
            var r3 = RealmQuizState.Answer(first, wrongIdx);
            PlaytestKit.Check(!r3.Ok && r3.Gold == 0 && r3.Streak == 0, $"un.rk.quiz: 오답 ok={r3.Ok} gold={r3.Gold} streak={r3.Streak}");
            PlaytestKit.Check(RealmQuizState.SnapshotWrongIds().Contains(first.Id), "un.rk.quiz: 틀린 문제가 기록에 없음");
            PlaytestKit.Check(RealmQuizState.GetProgress().BestStreak == 2, $"un.rk.quiz: 최고 연속 {RealmQuizState.GetProgress().BestStreak} ≠ 2");

            // 다 익히면 복습 출제
            for (int i = 0; i < RealmQuizData.Bank.Count + 4 && RealmQuizState.GetProgress().Learned < RealmQuizData.Bank.Count; i++)
            {
                var d = RealmQuizState.Draw();
                if (!d.HasValue) break;
                RealmQuizState.Answer(d.Value, d.Value.CorrectIndex);
            }
            PlaytestKit.Check(RealmQuizState.GetProgress().Learned == RealmQuizData.Bank.Count, $"un.rk.quiz: 다 익히지 못함 {RealmQuizState.GetProgress().Learned}/{RealmQuizData.Bank.Count}");
            var review = RealmQuizState.Draw();
            PlaytestKit.Check(review.HasValue && review.Value.Review, "un.rk.quiz: 다 익힌 뒤에 복습 출제가 아님");

            // 세이브 스냅샷 왕복
            var learned = RealmQuizState.SnapshotLearned();
            var wrongIds = RealmQuizState.SnapshotWrongIds();
            var wrongCounts = RealmQuizState.SnapshotWrongCounts();
            var prog = RealmQuizState.GetProgress();
            RealmQuizState.Restore(null, null, null, 0, 0, 0, 0);
            PlaytestKit.Check(RealmQuizState.GetProgress().Learned == 0, "un.rk.quiz: Restore(null) 이 비우지 못함");
            RealmQuizState.Restore(learned, wrongIds, wrongCounts, prog.Answered, prog.Correct, prog.Streak, prog.BestStreak);
            var back = RealmQuizState.GetProgress();
            PlaytestKit.Check(back.Learned == prog.Learned && back.Answered == prog.Answered && back.Correct == prog.Correct && back.BestStreak == prog.BestStreak, "un.rk.quiz: 세이브 왕복이 값을 바꿈");
        }
    }
}
