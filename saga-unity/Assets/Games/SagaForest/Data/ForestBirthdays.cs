using System;
using System.Collections.Generic;

namespace Saga.Forest.Data
{
    /// <summary>
    /// tasks U-0229 ② 주민 생일(웹 W-0427 · 스타듀 밸리·동물의숲 — 구조만). 주민(숲지기 + 손님 열)마다 생일 하루 — id 해시로 12달 × 28일 안,
    /// 겹치면 다음 날로 민다. 날짜는 실제 달력(`ForestVisitors.Today` — 이 판 날짜는 실제 날)이라 29~31일엔 생일이 없다.
    /// 그날 첫 말 걸기 = 하트 +3(하루 상한을 넘어도 그날 한 번은 들어감) · 아침 토스트·「오늘」 한 줄 · 벌 없음.
    /// **이 판 다름**: 가방·선물이 없어(ForestHearts 머리 주석) 웹 "좋아하는 물건 셋·선물 ×5"는 뺐다. 손잡이 `SAGA_FOREST_BIRTHDAY=0`.
    /// </summary>
    public static class ForestBirthdays
    {
        public const int Months = 12, DaysPerMonth = 28, Gain = 3;

        public static bool On = Environment.GetEnvironmentVariable("SAGA_FOREST_BIRTHDAY") != "0";

        private static Dictionary<string, int> _slots;

        /// <summary>주민 id 목록 — 숲지기 + 손님 열(표 순서).</summary>
        public static List<string> People()
        {
            var l = new List<string> { ForestHearts.KeeperId };
            foreach (var v in ForestVisitors.List) l.Add(v.Key);
            return l;
        }

        /// <summary>id → 생일 칸(0 ~ 12×28−1, 순수·결정적, 겹침 없음).</summary>
        public static int SlotOf(string id)
        {
            if (_slots == null)
            {
                _slots = new Dictionary<string, int>();
                var used = new HashSet<int>();
                foreach (var p in People())
                {
                    int s = (int)(Hash(p) % (uint)(Months * DaysPerMonth));
                    while (!used.Add(s)) s = (s + 1) % (Months * DaysPerMonth);
                    _slots[p] = s;
                }
            }
            return _slots.TryGetValue(id ?? "", out var v) ? v : -1;
        }

        /// <summary>생일(달 1~12, 날 1~28).</summary>
        public static (int month, int day) BirthdayOf(string id)
        {
            int s = SlotOf(id);
            return s < 0 ? (0, 0) : (s / DaysPerMonth + 1, s % DaysPerMonth + 1);
        }

        /// <summary>그 날(2000-01-01 부터 며칠째)의 달·날.</summary>
        public static (int month, int day) DateOf(int today)
        {
            var d = new DateTime(2000, 1, 1).AddDays(today);
            return (d.Month, d.Day);
        }

        public static bool IsBirthday(string id, int today)
        {
            if (!On) return false;
            var (m, d) = BirthdayOf(id);
            var (tm, td) = DateOf(today);
            return m > 0 && m == tm && d == td;
        }

        /// <summary>오늘 생일인 주민들(표 순서).</summary>
        public static List<string> Today(int today)
        {
            var l = new List<string>();
            if (!On) return l;
            foreach (var p in People()) if (IsBirthday(p, today)) l.Add(p);
            return l;
        }

        /// <summary>주민 이름(숲지기 · 손님 표).</summary>
        public static string Name(string id)
        {
            if (id == ForestHearts.KeeperId) return ForestLocalization.T("keeper.name", "숲지기");
            foreach (var v in ForestVisitors.List) if (v.Key == id) return ForestVisitors.Name(v);
            return id;
        }

        private static uint Hash(string s)
        {
            uint h = 2166136261;
            foreach (char c in s) { h ^= c; h *= 16777619; }
            return h;
        }
    }
}
