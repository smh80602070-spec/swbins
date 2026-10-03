using System.Collections.Generic;
using UnityEngine;

namespace Saga.Realm.Data
{
    /// <summary>
    /// REALM 다음 조각 (3) — js/quiz.js의 출제·채점·기록을 옮겼다. 원작의
    /// 보상은 공적(feat)+금+명성(fame)+연속 5마다 등용서인데, 이 슬라이스엔
    /// 공적·명성·등용서(scroll) 시스템 자체가 없다(REALM Unity 슬라이스가
    /// 여태 안 들인 것들) — **금만** 옮겼다(등급별 금액은 원작 LV_REWARD
    /// 그대로: 초급 40/10, 중급 60/15, 고급 90/22 — 처음/복습). drawReview·
    /// drawWrong(자동 순행 auto.js 전용 통로)은 이 프로젝트에 자동 순행이
    /// 없어 범위 밖 — 사람이 직접 푸는 draw()/answer() 경로만 있으면
    /// 충분하다. 오답노트(wrongList)는 진행 화면(RealmQuizUi)에서 안 보여
    /// 주지만 판정 로직(복습 우선순위)엔 그대로 살아 있다.
    /// </summary>
    public static class RealmQuizState
    {
        private const int StreakEvery = 5; // 원작 그대로 — 다만 보상(등용서)은 이 슬라이스에 없어 기록만 한다.

        private static readonly Dictionary<int, (int first, int review)> LvReward = new Dictionary<int, (int, int)>
        {
            [1] = (40, 10),
            [2] = (60, 15),
            [3] = (90, 22),
        };

        private static readonly HashSet<string> _learned = new HashSet<string>();
        // 서고(archive) — "최근 순"을 익힌 순번으로 재해석(godot REALM 10절과
        // 같은 결, 실제 시각을 쓰면 헤드리스 검증의 결정성이 깨진다). Answer()
        // 에서 처음 익힐 때만 append, 절대 제거되지 않는다.
        private static readonly List<string> _learnedOrder = new List<string>();
        private static readonly Dictionary<string, int> _wrongs = new Dictionary<string, int>();
        private static int _total, _correct, _streak, _bestStreak;

        public readonly struct Presented
        {
            public readonly string Id;
            public readonly string Cat;
            public readonly int Lv;
            public readonly string Q;
            public readonly string[] Choices;
            public readonly int CorrectIndex;
            public readonly bool Review;

            public Presented(string id, string cat, int lv, string q, string[] choices, int correctIndex, bool review)
            {
                Id = id; Cat = cat; Lv = lv; Q = q; Choices = choices; CorrectIndex = correctIndex; Review = review;
            }
        }

        public readonly struct AnswerResult
        {
            public readonly bool Ok;
            public readonly bool First;
            public readonly string Why;
            public readonly string AnswerText;
            public readonly int Gold;
            public readonly int Streak;

            public AnswerResult(bool ok, bool first, string why, string answerText, int gold, int streak)
            {
                Ok = ok; First = first; Why = why; AnswerText = answerText; Gold = gold; Streak = streak;
            }
        }

        /// <summary>보기 순서를 섞어 낸다 — quiz.js present() 그대로.</summary>
        private static Presented Present(RealmQuizQuestion refQ)
        {
            var order = new List<int> { 0, 1, 2, 3 };
            for (int i = order.Count - 1; i > 0; i--)
            {
                int j = UnityEngine.Random.Range(0, i + 1);
                (order[i], order[j]) = (order[j], order[i]);
            }
            var choices = new string[4];
            int correctIndex = 0;
            for (int i = 0; i < 4; i++)
            {
                choices[i] = refQ.Choices[order[i]];
                if (order[i] == refQ.AnswerIdx) correctIndex = i;
            }
            return new Presented(refQ.Id, refQ.Cat, refQ.Lv, refQ.Q, choices, correctIndex, _learned.Contains(refQ.Id));
        }

        /// <summary>문제를 하나 낸다 — quiz.js draw() 그대로. 안 익힌 문제
        /// 우선(그중 쉬운 등급부터), 다 익혔으면 틀린 적 많은 순 복습.</summary>
        public static Presented? Draw(string catKey = null)
        {
            var pool = catKey != null ? RealmQuizData.OfCat(catKey) : RealmQuizData.Bank;
            if (pool.Count == 0) return null;

            var fresh = new List<RealmQuizQuestion>();
            foreach (var q in pool) if (!_learned.Contains(q.Id)) fresh.Add(q);

            if (fresh.Count > 0)
            {
                int low = 3;
                foreach (var q in fresh) if (q.Lv < low) low = q.Lv;
                var tier = new List<RealmQuizQuestion>();
                foreach (var q in fresh) if (q.Lv == low) tier.Add(q);
                return Present(tier[UnityEngine.Random.Range(0, tier.Count)]);
            }

            var review = new List<RealmQuizQuestion>(pool);
            review.Sort((a, b) => WrongsOf(b.Id).CompareTo(WrongsOf(a.Id)));
            int topN = Mathf.Max(4, Mathf.CeilToInt(review.Count / 4f));
            int take = Mathf.Min(topN, review.Count);
            return Present(review[UnityEngine.Random.Range(0, take)]);
        }

        private static int WrongsOf(string id) => _wrongs.TryGetValue(id, out var n) ? n : 0;

        /// <summary>채점 — quiz.js answer() 그대로(공적·명성·등용서는 이
        /// 슬라이스에 없어 금만 준다, 클래스 주석 참고).</summary>
        public static AnswerResult Answer(Presented p, int choiceIdx)
        {
            var refQ = RealmQuizData.ById(p.Id);
            bool ok = choiceIdx == p.CorrectIndex;
            bool first = ok && !_learned.Contains(p.Id);
            _total++;

            int gold = 0;
            if (ok)
            {
                _correct++;
                _streak++;
                if (_streak > _bestStreak) _bestStreak = _streak;
                if (WrongsOf(p.Id) > 0) _wrongs[p.Id] = Mathf.Max(0, _wrongs[p.Id] - 1);
                if (_wrongs.TryGetValue(p.Id, out var left) && left == 0) _wrongs.Remove(p.Id);

                var (firstGold, reviewGold) = LvReward[p.Lv];
                gold = first ? firstGold : reviewGold;
                if (RealmOfficerTraits.AnyWiseInRoster()) gold = Mathf.RoundToInt(gold * RealmOfficerTraits.WiseQuizMultiplier); // 101-2 5-1 "현명".
                if (first) { _learned.Add(p.Id); _learnedOrder.Add(p.Id); }
                RealmCityState.AddGold(gold);
            }
            else
            {
                _streak = 0;
                _wrongs[p.Id] = WrongsOf(p.Id) + 1;
            }

            return new AnswerResult(ok, first, refQ.Why, refQ.Choices[refQ.AnswerIdx], gold, _streak);
        }

        public readonly struct Progress
        {
            public readonly int Learned;
            public readonly int Total;
            public readonly int Answered;
            public readonly int Correct;
            public readonly int Streak;
            public readonly int BestStreak;

            public Progress(int learned, int total, int answered, int correct, int streak, int bestStreak)
            {
                Learned = learned; Total = total; Answered = answered; Correct = correct;
                Streak = streak; BestStreak = bestStreak;
            }
        }

        /// <summary>시나리오 설전이 주는 문답 정답 수 가산(tasks U-0027, 웹 `quiz` 효과) — 문화 승리 기준에 합쳐진다. 세이브엔 이미 있는 정답 수로 담긴다.</summary>
        public static void AddBonusCorrect(int n)
        {
            if (n > 0) _correct += n;
        }

        public static Progress GetProgress() =>
            new Progress(_learned.Count, RealmQuizData.Bank.Count, _total, _correct, _streak, _bestStreak);

        public readonly struct LearnedEntry
        {
            public readonly string Id;
            public readonly string Cat;
            public readonly int Lv;
            public readonly string Q;
            public readonly string AnswerText;
            public readonly string Why;

            public LearnedEntry(string id, string cat, int lv, string q, string answerText, string why)
            {
                Id = id; Cat = cat; Lv = lv; Q = q; AnswerText = answerText; Why = why;
            }
        }

        /// <summary>서고 — quiz.js learnedList() 그대로, 익힌 순번 역순(최근
        /// 먼저) 최대 limit개(기본 20 — ChoicePrompt류 패널이 스크롤이 없어
        /// godot REALM 10절과 같은 이유로 자른다). catKey는 분야 필터(다음에
        /// UI만 얹으면 되도록 인자만 미리 받는다, 아직 UI는 전체만 보여줌).</summary>
        public static List<LearnedEntry> LearnedList(string catKey = null, int limit = 20)
        {
            var result = new List<LearnedEntry>();
            for (int i = _learnedOrder.Count - 1; i >= 0 && result.Count < limit; i--)
            {
                var q = RealmQuizData.ById(_learnedOrder[i]);
                if (q == null) continue;
                if (catKey != null && q.Cat != catKey) continue;
                result.Add(new LearnedEntry(q.Id, q.Cat, q.Lv, q.Q, q.Choices[q.AnswerIdx], q.Why));
            }
            return result;
        }

        // ── 저장/불러오기 ──────────────────────────────────────
        // 익힌 순서 그대로 저장한다(서고 정렬 키) — 예전엔 HashSet 순서를
        // 그대로 썼는데(우연히 대체로 삽입 순이지만 보장되진 않음), 이제
        // _learnedOrder가 진짜 삽입 순을 보장한다. 세이브 스키마(필드 이름·
        // 개수)는 그대로라 버전을 안 올려도 된다 — 구버전 세이브를 불러와도
        // Restore()가 준 순서를 그대로 _learnedOrder로 쓴다(옛 순서 근사치,
        // 해롭지 않다 — 서고는 표시용일 뿐 판정 로직과 무관).
        public static List<string> SnapshotLearned() => new List<string>(_learnedOrder);
        public static List<string> SnapshotWrongIds() => new List<string>(_wrongs.Keys);
        public static List<int> SnapshotWrongCounts()
        {
            var list = new List<int>();
            foreach (var id in _wrongs.Keys) list.Add(_wrongs[id]);
            return list;
        }

        public static void Restore(List<string> learned, List<string> wrongIds, List<int> wrongCounts,
            int total, int correct, int streak, int bestStreak)
        {
            _learned.Clear();
            _learnedOrder.Clear();
            if (learned != null)
            {
                foreach (var id in learned) { _learned.Add(id); _learnedOrder.Add(id); }
            }

            _wrongs.Clear();
            if (wrongIds != null && wrongCounts != null)
            {
                for (int i = 0; i < wrongIds.Count && i < wrongCounts.Count; i++) _wrongs[wrongIds[i]] = wrongCounts[i];
            }

            _total = total; _correct = correct; _streak = streak; _bestStreak = bestStreak;
        }
    }
}
