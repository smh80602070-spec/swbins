using System;
using System.Collections.Generic;
using UnityEngine;

namespace Saga.Go.Data
{
    /// <summary>
    /// PLAN.md 101-2 ④ "일과판(오늘의 일과)" — 웹판 §5 ④(`saga-web/saga-go/js/daily.js`
    /// 설계, 아직 웹 자체도 실기 확인 대기)의 날짜 해시 일과 풀·도장·주간
    /// 보상을 이 트랙 실제 시스템에 맞춰 재해석한다. 2026-09-19 결정
    /// (PLAN.md 101-2 서두) — saga-godot 트랙이 같은 설계 의도를 실기
    /// 승인까지 받았으니 그걸 검증으로 인정하고, saga-web 문서의 검증
    /// 도장을 더 기다리지 않는다. 다만 UI·조작·수치는 두 트랙 다 베끼지
    /// 않고 각자 재구성한다(코드 공유 없음 원칙).
    ///
    /// 웹판 풀 8(걷기·조우 3·역참 2·사건 2·비석 3·토벌 1·반려 500m·사당 1)
    /// 중 역참·비석·사당·반려는 이 트랙에 아직 없고, 발견형 콘텐츠(숨은
    /// 보물·산신당·동쪽 숲 유물·채집)는 전부 <see cref="WorldEventState"/>·
    /// <see cref="GatherState"/>로 "한 번뿐"이라 반복되는 일과가 못 된다
    /// (자리 수가 유한해 며칠 지나면 채울 수 없게 된다). 그래서 이 트랙
    /// 풀은 실제로 **몇 번이고 다시 할 수 있는** 시스템으로 짰다: 걷기·
    /// 도적 조우 승리(<see cref="World.BanditEncounter"/>)·희귀 늑대 토벌
    /// (<see cref="World.RareWolfEncounter"/>)·성황당 기원
    /// (<see cref="World.LuckyCairn"/>).
    ///
    /// PLAN.md 109-14-8 "일일 의뢰"(웹 사가고 ⑲-8 — 새 판 없이 이 판을 넓힘): 갈래 넷(걸음·만남·싸움·살림)에서 하루 하나씩 = 넷,
    /// 날 갈림은 새벽 4시. 새 후보 넷 — 들판 적 8(`FieldEnemy` 쓰러짐) · 원소 반응 6(`FieldEnemy.TakeHit`) · 채집 5·요리 2(`CookState`).
    /// 일과 하나를 채우면 그 일과 보상(금·경험 + 들판 적 강화석 1 · 원소 반응 무예 쪽지 1, 웹 값), 넷을 다 한 날 역참(순간이동 돌기둥 7m 안)에 들르면
    /// 마무리 보상 한 번(금 150 · 강화석 2 · 인연 매듭 1 — 웹 부대 경험 120 은 인물 경험이 없어 뺐다). 도장은 이 판 규칙 그대로(넷 다 한 날 하나, 7 = 주간).
    /// 이 판 갈래: 걸음 = 걷기·성황당 기원 · 만남 = 도적 조우·희귀 늑대 · 싸움 = 들판 적·원소 반응 · 살림 = 채집·요리.
    ///
    /// 날짜 문자열(yyyy-MM-dd)을 결정적으로 해싱해 그날의 갈래마다 하나를 뽑는다(웹판 진단 "일과 — 같은 날은 같은 셋(해시)"과 같은
    /// 성질 — <see cref="string.GetHashCode"/>는 프로세스마다 값이 달라질 수 있어 안 쓰고 직접 해싱한다).
    /// 넷 다 채우면 그날의 '일과 도장' 1개, 도장 7개 = 주간 보상(수치는 웹판 그대로: 도장 7).
    /// </summary>
    public static class DailyTaskState
    {
        // 번호는 세이브에 안 적히지만(날짜로 다시 뽑는다) 뒤에만 붙인다
        public enum Kind { Walk, BanditWin, WolfWin, CairnWish, FieldKill, Reaction, Gather, Cook }
        public enum Group { Step, Meet, Fight, Life }

        private struct TaskDef
        {
            public Kind Kind;
            public Group Group;
            public int Target;
            public string Label; // {0}=진행, {1}=목표
            public int Gold, Exp, Ore, Note;
        }

        // 보상은 웹 ⑲-8 표(걷기 30·60 · 조우 40·90 · 성채 토벌 60·120 → 희귀 늑대 · 비석 50·100 → 성황당 · 사냥 50·100·강화석 1 · 반응 45·90·쪽지 1 · 채집 35·70 · 요리 40·80)
        private static readonly TaskDef[] Pool =
        {
            new TaskDef { Kind = Kind.Walk, Group = Group.Step, Target = 800, Label = "걷기 {0}/{1}m", Gold = 30, Exp = 60 },
            new TaskDef { Kind = Kind.BanditWin, Group = Group.Meet, Target = 2, Label = "도적 조우 승리 {0}/{1}", Gold = 40, Exp = 90 },
            new TaskDef { Kind = Kind.WolfWin, Group = Group.Meet, Target = 1, Label = "희귀 늑대 토벌 {0}/{1}", Gold = 60, Exp = 120 },
            new TaskDef { Kind = Kind.CairnWish, Group = Group.Step, Target = 2, Label = "성황당 기원 {0}/{1}", Gold = 50, Exp = 100 },
            new TaskDef { Kind = Kind.FieldKill, Group = Group.Fight, Target = 8, Label = "들판의 적 쓰러뜨리기 {0}/{1}", Gold = 50, Exp = 100, Ore = 1 },
            new TaskDef { Kind = Kind.Reaction, Group = Group.Fight, Target = 6, Label = "원소 반응 일으키기 {0}/{1}", Gold = 45, Exp = 90, Note = 1 },
            new TaskDef { Kind = Kind.Gather, Group = Group.Life, Target = 5, Label = "채집물 줍기 {0}/{1}", Gold = 35, Exp = 70 },
            new TaskDef { Kind = Kind.Cook, Group = Group.Life, Target = 2, Label = "요리하기 {0}/{1}", Gold = 40, Exp = 80 },
        };

        private const int TasksPerDay = 4; // 109-14-8 갈래 넷에서 하나씩
        public const int DayStartHour = 4;  // 109-14-8 날 갈림 새벽 4시
        public const int StampsPerReward = 7; // 웹판 그대로: 도장 7 = 주간 보상
        private const int WeeklyRewardGold = 100;
        private const int WeeklyRewardExp = 150;
        public const int BonusGold = 150, BonusOre = 2, BonusKnot = 1;

        private static string _date = "";
        private static int[] _selected = Array.Empty<int>();
        private static int[] _progress = Array.Empty<int>();
        private static bool[] _done = Array.Empty<bool>();
        private static bool _dayStampGranted;
        private static bool _bonusClaimed;
        private static int _stamps;

        /// <summary>진단 — 켜면 진행 신호를 무시한다(옛 진단이 금·강화석 값을 잴 때 날짜마다 다른 일과가 끼지 않게). 일과 진단만 끈다.</summary>
        public static bool OffForTest;

        /// <summary>주간 보상이 실제로 지급된 순간(금·경험치) — UI 토스트 훅용, 안 구독해도 지급 자체는 된다.</summary>
        public static event Action<int, int> WeeklyRewardGranted;
        /// <summary>109-14-8 일과 하나를 채워 보상을 받은 순간 — 알림 글.</summary>
        public static event Action<string> TaskCompleted;

        public static string CurrentDate => _date;
        public static int Stamps => _stamps;
        public static bool BonusClaimed => _bonusClaimed;
        public static int TaskCount => _selected.Length;

        /// <summary>새벽 4시 전은 전날로 친다(웹 ⑲-8 `dayKey`).</summary>
        public static string DayKey(DateTime at) => at.AddHours(-DayStartHour).ToString("yyyy-MM-dd");

        /// <summary>날짜가 바뀌었으면(새벽 4시) 그날의 일과 넷을 새로 뽑는다(도장은 유지, 오늘 진행·마무리 보상만 리셋).</summary>
        public static void EnsureToday()
        {
            string today = DayKey(DateTime.Now);
            if (_date == today && _selected.Length > 0) return;
            SelectForDate(today);
        }

        private static void SelectForDate(string dateKey)
        {
            _date = dateKey;
            _selected = PickIndices(dateKey);
            _progress = new int[_selected.Length];
            _done = new bool[_selected.Length];
            _dayStampGranted = false;
            _bonusClaimed = false;
        }

        /// <summary>날짜 문자열을 해싱해 갈래마다 하나씩 뽑는다(걸음·만남·싸움·살림 순 — 표시 순서 안정).</summary>
        private static int[] PickIndices(string dateKey)
        {
            var rng = new System.Random(StableHash(dateKey));
            var picked = new List<int>(TasksPerDay);
            foreach (Group g in Enum.GetValues(typeof(Group)))
            {
                var cands = new List<int>();
                for (int i = 0; i < Pool.Length; i++) if (Pool[i].Group == g) cands.Add(i);
                if (cands.Count > 0) picked.Add(cands[rng.Next(cands.Count)]);
            }
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

        /// <summary>해당 종류 일과가 오늘 뽑힌 넷에 있으면 진행을 더한다(없으면 조용히 무시). 채우면 그 일과 보상.</summary>
        public static void ReportProgress(Kind kind, int amount)
        {
            if (amount <= 0 || OffForTest) return;
            EnsureToday();
            bool anyChanged = false;
            for (int i = 0; i < _selected.Length; i++)
            {
                if (_done[i]) continue;
                var def = Pool[_selected[i]];
                if (def.Kind != kind) continue;
                _progress[i] = Mathf.Min(def.Target, _progress[i] + amount);
                if (_progress[i] >= def.Target)
                {
                    _done[i] = true;
                    string eggText = EggState.Drop("commission", _date + "|" + i); // U-0046 신수 알
                    TaskCompleted?.Invoke(GrantTask(def) + (eggText.Length > 0 ? " · " + eggText : ""));
                }
                anyChanged = true;
            }
            if (anyChanged) CheckAllDone();
        }

        /// <summary>일과 하나 보상 — 알림 글.</summary>
        private static string GrantTask(TaskDef def)
        {
            GoldState.Add(def.Gold);
            PlayerStats.AddExp(def.Exp);
            string extra = "";
            if (def.Ore > 0) { WeaponState.AddOre(def.Ore); extra += " · " + string.Format(GoLocalization.T("weapon.ore_plus", "강화석 +{0}"), def.Ore); }
            if (def.Note > 0) { string m = TalentState.Add(new[] { def.Note, 0, 0, 0, 0 }); if (m.Length > 0) extra += " · " + m; }
            return string.Format(GoLocalization.T("task.done", "일과 완료 — {0} · 금 +{1} · 경험 +{2}{3}"),
                string.Format(GoLocalization.T("task." + KindKey(def.Kind), def.Label), def.Target, def.Target), def.Gold, def.Exp, extra);
        }

        private static void CheckAllDone()
        {
            if (_dayStampGranted || _done.Length == 0) return;
            foreach (var d in _done) if (!d) return;

            _dayStampGranted = true;
            _stamps++;
            if (_stamps % StampsPerReward == 0)
            {
                GoldState.Add(WeeklyRewardGold);
                PlayerStats.AddExp(WeeklyRewardExp);
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

        /// <summary>109-14-8 마무리 보상 — 넷을 다 한 날 역참에 들르면 한 번. 받았으면 알림 글, 아니면 null.</summary>
        public static string TryClaimBonus()
        {
            if (OffForTest || _bonusClaimed || !AllDoneToday) return null;
            _bonusClaimed = true;
            GoldState.Add(BonusGold);
            WeaponState.AddOre(BonusOre);
            string knot = TalentState.Add(new[] { 0, 0, 0, BonusKnot, 0 });
            return string.Format(GoLocalization.T("task.bonus", "오늘 일과 {0}/{0} 마무리 — 금 +{1} · 강화석 +{2}{3}"), _selected.Length, BonusGold, BonusOre,
                knot.Length > 0 ? " · " + knot : "");
        }

        /// <summary>목표판 "이번 세션" 줄 — 오늘의 일과 넷 중 남은 것 하나(웹판 §5 ④ 그대로의 역할). 다 했으면 마무리 보상 안내.</summary>
        public static string SessionLineText()
        {
            EnsureToday();
            for (int i = 0; i < _selected.Length; i++)
            {
                if (_done[i]) continue;
                var def = Pool[_selected[i]];
                return string.Format(GoLocalization.T("task." + KindKey(def.Kind), def.Label), _progress[i], def.Target);
            }
            if (_selected.Length > 0 && !_bonusClaimed) return GoLocalization.T("task.bonus_ready", "오늘 일과 끝 — 역참에 들르면 마무리 보상");
            return _selected.Length == 0 ? "-" : string.Format(GoLocalization.T("task.all_done", "오늘의 일과 완료 (도장 {0})"), _stamps);
        }

        /// <summary>진단·목표판 — i 번째 일과 한 줄.</summary>
        public static string TaskLine(int i)
        {
            EnsureToday();
            if (i < 0 || i >= _selected.Length) return "";
            var def = Pool[_selected[i]];
            return (_done[i] ? "✓ " : "") + string.Format(GoLocalization.T("task." + KindKey(def.Kind), def.Label), _progress[i], def.Target);
        }

        public static Kind TaskKind(int i) => Pool[_selected[i]].Kind;
        public static bool TaskDone(int i) => _done[i];

        /// <summary>목표판 "이번 주" 줄 — 일과 도장이 쌓이는 주간 사다리 다음 단.</summary>
        public static string WeekLineText()
        {
            EnsureToday();
            int rem = _stamps % StampsPerReward;
            int need = StampsPerReward - rem;
            return string.Format(GoLocalization.T("task.week", "일과 도장 {0}/{1}(다음 보상까지 {2})"), rem, StampsPerReward, need);
        }

        /// <summary>110 ⑤c-2c — 번역 표 키(task.&lt;이것&gt;).</summary>
        private static string KindKey(Kind k) => k switch
        {
            Kind.Walk => "walk",
            Kind.BanditWin => "bandit_win",
            Kind.WolfWin => "wolf_win",
            Kind.CairnWish => "cairn_wish",
            Kind.FieldKill => "field_kill",
            Kind.Reaction => "reaction",
            Kind.Gather => "gather",
            Kind.Cook => "cook",
            _ => k.ToString().ToLowerInvariant(),
        };

        // ---- 저장/복원 (SaveState.cs 전용) ----

        public static int[] SnapshotProgress() => (int[])_progress.Clone();
        public static bool[] SnapshotDone() => (bool[])_done.Clone();
        public static bool SnapshotDayStampGranted() => _dayStampGranted;

        /// <summary>세이브에서 복원 — 저장된 날짜로 그날의 일과를 다시 뽑은 뒤(해시가
        /// 결정적이라 순서·목표가 저장 시와 같다) 진행·완료·도장을 덮어쓴다. 날짜가
        /// 비어 있으면(v9 이하 파일) 새 게임과 같은 빈 상태로 둔다 — 다음 EnsureToday()
        /// 호출이 오늘 날짜로 채운다. 109-14-8 전(하루 셋) 세이브는 길이가 달라 그날 진행만 비운다.</summary>
        public static void Restore(string date, int[] progress, bool[] done, bool dayStampGranted, int stamps, bool bonusClaimed = false)
        {
            _stamps = Mathf.Max(0, stamps);
            if (string.IsNullOrEmpty(date))
            {
                _date = "";
                _selected = Array.Empty<int>();
                _progress = Array.Empty<int>();
                _done = Array.Empty<bool>();
                _dayStampGranted = false;
                _bonusClaimed = false;
                return;
            }

            SelectForDate(date);
            if (progress != null && progress.Length == _progress.Length) _progress = (int[])progress.Clone();
            if (done != null && done.Length == _done.Length) _done = (bool[])done.Clone();
            _dayStampGranted = dayStampGranted;
            _bonusClaimed = bonusClaimed;
        }
    }
}
