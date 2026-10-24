using System;
using System.Collections.Generic;
using UnityEngine;

namespace Saga.Dungeon.Data
{
    /// <summary>
    /// PLAN.md 101-2 5.6 "목표판·세션 카드·일일/주간" — 공통 A(GoalBoard)·
    /// B(SessionCard)는 이미 붙어 있었지만(2026-09-19, <see cref="World.DungeonSessionTracker"/>)
    /// "이번 세션"·"이번 주" 두 줄이 실제 값 없이 자리만 잡은 문구였다. SagaGo의
    /// <see cref="Saga.Go.Data.DailyTaskState"/>(101-2 ④)와 같은 구조(날짜 해시
    /// 풀 3택·도장 7=주간 보상)를 이 트랙의 실제 반복 시스템 넷에 맞춰 다시 짠다.
    ///
    /// 웹판 §5.6(`saga-web/saga-dungeon/PLAN.md` 180행) 풀 후보(유적·발견거리·
    /// 현상판·층·보스·상인)는 이 트랙엔 허브·상인·현상판이 없어(편도 절차적
    /// 진행) 그대로 못 옮긴다 — 대신 이미 101-2 5.1~5.5로 완성된, **몇 번이고
    /// 다시 할 수 있는** 시스템 넷으로 풀을 짰다: 걷기(GO와 같은 값)·적 처치·
    /// 부적 층 클리어(5.3 <see cref="SigilState"/>)·난입 생존(5.5
    /// <see cref="HordeState"/>). 월드 보스(5.4)는 세 번 중 못 만날 수도 있는
    /// 계기라 일일 풀에서 뺐다(GO도 마찬가지로 "발견형"류는 풀에서 뺀 전례,
    /// <see cref="Saga.Go.Data.DailyTaskState"/> 클래스 주석 참고).
    /// </summary>
    public static class DungeonDailyTaskState
    {
        public enum Kind { Walk, EnemyKill, SigilClear, HordeSurvive }

        private struct TaskDef
        {
            public Kind Kind;
            public int Target;
            public string Label; // {0}=진행, {1}=목표
        }

        private static readonly TaskDef[] Pool =
        {
            new TaskDef { Kind = Kind.Walk, Target = 800, Label = "걷기 {0}/{1}m" },
            new TaskDef { Kind = Kind.EnemyKill, Target = 15, Label = "적 처치 {0}/{1}" },
            new TaskDef { Kind = Kind.SigilClear, Target = 1, Label = "부적 층 클리어 {0}/{1}" },
            new TaskDef { Kind = Kind.HordeSurvive, Target = 1, Label = "난입 완주 {0}/{1}" },
        };

        private const int TasksPerDay = 3;
        public const int StampsPerReward = 7; // GO와 같은 값(일과 3/일 · 도장 7).
        private const int WeeklyRewardGold = 100;
        private const int WeeklyRewardExp = 150;

        private static string _date = "";
        private static int[] _selected = Array.Empty<int>();
        private static int[] _progress = Array.Empty<int>();
        private static bool[] _done = Array.Empty<bool>();
        private static bool _dayStampGranted;
        private static int _stamps;

        public static event Action<int, int> WeeklyRewardGranted;

        public static string CurrentDate => _date;
        public static int Stamps => _stamps;

        /// <summary>실제 달력 날짜가 바뀌었으면 그날의 일과 3개를 새로 뽑는다(도장은 유지, 오늘 진행만 리셋).</summary>
        public static void EnsureToday()
        {
            string today = DateTime.Now.ToString("yyyy-MM-dd");
            if (_date == today && _selected.Length > 0) return;
            SelectForDate(today);
        }

        private static void SelectForDate(string dateKey)
        {
            _date = dateKey;
            _selected = PickIndices(dateKey, TasksPerDay);
            _progress = new int[_selected.Length];
            _done = new bool[_selected.Length];
            _dayStampGranted = false;
        }

        /// <summary>날짜 문자열을 해싱해 풀을 섞은 뒤 앞 count개 인덱스를 오름차순으로 돌려준다(표시 순서 안정).</summary>
        private static int[] PickIndices(string dateKey, int count)
        {
            int seed = StableHash(dateKey);
            var rng = new System.Random(seed);
            var indices = new List<int>(Pool.Length);
            for (int i = 0; i < Pool.Length; i++) indices.Add(i);
            for (int i = indices.Count - 1; i > 0; i--)
            {
                int j = rng.Next(i + 1);
                (indices[i], indices[j]) = (indices[j], indices[i]);
            }
            int n = Mathf.Min(count, indices.Count);
            var picked = indices.GetRange(0, n);
            picked.Sort();
            return picked.ToArray();
        }

        private static int StableHash(string s)
        {
            unchecked
            {
                int hash = 17;
                foreach (char c in s) hash = hash * 31 + c;
                return hash;
            }
        }

        /// <summary>해당 종류 일과가 오늘 뽑힌 셋에 있으면 진행을 더한다(없으면 조용히 무시).</summary>
        public static void ReportProgress(Kind kind, int amount)
        {
            if (amount <= 0) return;
            EnsureToday();
            bool anyChanged = false;
            for (int i = 0; i < _selected.Length; i++)
            {
                if (_done[i]) continue;
                if (Pool[_selected[i]].Kind != kind) continue;
                int target = Pool[_selected[i]].Target;
                _progress[i] = Mathf.Min(target, _progress[i] + amount);
                if (_progress[i] >= target) _done[i] = true;
                anyChanged = true;
            }
            if (anyChanged) CheckAllDone();
        }

        private static void CheckAllDone()
        {
            if (_dayStampGranted || _done.Length == 0) return;
            foreach (var d in _done) if (!d) return;

            _dayStampGranted = true;
            _stamps++;
            if (_stamps % StampsPerReward == 0)
            {
                HeroState.AddGold(WeeklyRewardGold);
                HeroState.AddExp(WeeklyRewardExp);
                WeeklyRewardGranted?.Invoke(WeeklyRewardGold, WeeklyRewardExp);
            }
        }

        public static bool AllDoneToday
        {
            get
            {
                EnsureToday();
                foreach (var d in _done) if (!d) return false;
                return _done.Length > 0;
            }
        }

        /// <summary>목표판 "이번 세션" 줄 — 오늘의 일과 3 중 남은 것 하나(GO와 같은 역할).</summary>
        public static string SessionLineText()
        {
            EnsureToday();
            for (int i = 0; i < _selected.Length; i++)
            {
                if (_done[i]) continue;
                var def = Pool[_selected[i]];
                return string.Format(DungeonLocalization.T("task." + KindKey(def.Kind), def.Label), _progress[i], def.Target);
            }
            return _selected.Length == 0 ? "-" : string.Format(DungeonLocalization.T("task.all_done", "오늘의 일과 완료 (도장 {0})"), _stamps);
        }

        /// <summary>목표판 "이번 주" 줄 — 일과 도장이 쌓이는 주간 사다리 다음 단.</summary>
        public static string WeekLineText()
        {
            EnsureToday();
            int rem = _stamps % StampsPerReward;
            int need = StampsPerReward - rem;
            return string.Format(DungeonLocalization.T("task.week", "일과 도장 {0}/{1}(다음 보상까지 {2})"), rem, StampsPerReward, need);
        }

        // ---- tasks U-0213 「오늘」 창 — 칸별 읽기만(셈·세이브 안 바꿈) ----

        /// <summary>오늘 뽑힌 일과 수(EnsureToday 뒤).</summary>
        public static int TaskCount { get { EnsureToday(); return _selected.Length; } }

        /// <summary>i 번째 일과 한 줄(끝났으면 ✓).</summary>
        public static string TaskLine(int i)
        {
            EnsureToday();
            if (i < 0 || i >= _selected.Length) return "";
            var def = Pool[_selected[i]];
            return (_done[i] ? "✓ " : "") + string.Format(DungeonLocalization.T("task." + KindKey(def.Kind), def.Label), _progress[i], def.Target);
        }

        public static bool TaskDone(int i) { EnsureToday(); return i >= 0 && i < _done.Length && _done[i]; }

        /// <summary>110 ⑤c-2c — 번역 표 키(task.&lt;이것&gt;).</summary>
        private static string KindKey(Kind k) => k switch
        {
            Kind.Walk => "walk",
            Kind.EnemyKill => "enemy_kill",
            Kind.SigilClear => "sigil_clear",
            Kind.HordeSurvive => "horde_survive",
            _ => k.ToString().ToLowerInvariant(),
        };

        // ---- 저장/복원 (SaveState.cs 전용) ----

        public static int[] SnapshotProgress() => (int[])_progress.Clone();
        public static bool[] SnapshotDone() => (bool[])_done.Clone();
        public static bool SnapshotDayStampGranted() => _dayStampGranted;

        /// <summary>세이브에서 복원 — 저장된 날짜로 그날의 일과 셋을 다시 뽑은 뒤(해시가
        /// 결정적이라 순서·목표가 저장 시와 같다) 진행·완료·도장을 덮어쓴다. 날짜가
        /// 비어 있으면(v7 이하 파일) 새 게임과 같은 빈 상태로 둔다 — 다음 EnsureToday()
        /// 호출이 오늘 날짜로 채운다.</summary>
        public static void Restore(string date, int[] progress, bool[] done, bool dayStampGranted, int stamps)
        {
            _stamps = Mathf.Max(0, stamps);
            if (string.IsNullOrEmpty(date))
            {
                _date = "";
                _selected = Array.Empty<int>();
                _progress = Array.Empty<int>();
                _done = Array.Empty<bool>();
                _dayStampGranted = false;
                return;
            }

            SelectForDate(date);
            if (progress != null && progress.Length == _progress.Length) _progress = (int[])progress.Clone();
            if (done != null && done.Length == _done.Length) _done = (bool[])done.Clone();
            _dayStampGranted = dayStampGranted;
        }
    }
}
