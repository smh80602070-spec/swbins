using System;
using System.Collections.Generic;
using UnityEngine;

namespace Saga.Go.Data
{
    /// <summary>
    /// tasks U-0186 신수 일꾼(고돗 G-0328 `home_workers.gd` 짝, 웹 짝 없음) — 가진 신수(동행 말고)를 쉼터 마당 일꾼으로 앉히면 **실제 시간**으로 능력 갈래대로 모은다.
    /// 지력 🌿 박하·꿀꽃(번갈아) · 통솔 🍖 짐승 고기 — <see cref="EveryMin"/>분에 하나·상한 <see cref="Cap"/>(12시간). 무력 ⛏️ 강화석 — 이 트랙엔 강화석 조각이 없어
    /// <see cref="OreEveryMin"/>분에 강화석 하나·상한 <see cref="OreCap"/>(같은 12시간). 칸 = 1 + 마당 등급(<see cref="HomeState.Tier"/>, 꾸밀수록 는다).
    /// 쉼터 「수확」이 금과 함께 받고, 내보내면 모은 것을 먼저 받는다. 시계는 마당 금과 같은 <see cref="HomeState.Now"/>(끈 동안에도 흐름).
    /// </summary>
    public static class GoHomeWorkers
    {
        public const int EveryMin = 30, Cap = 24, OreEveryMin = 120, OreCap = 6;

        /// <summary>끄면 앉히기·쌓기·받기 없음(고돗 `SAGA_HOME_WORK=0` 짝).</summary>
        public static bool On = true;

        [Serializable]
        public class Worker { public string pet; public long t; public int n; }

        [Serializable]
        private class Store { public List<Worker> list = new List<Worker>(); }

        private static Store _s = new Store();

        public static event Action Changed;

        public static IReadOnlyList<Worker> Workers => _s.list;
        public static int Slots => 1 + HomeState.Tier();

        public static string KindOf(string petId)
        {
            var p = GoEggs.Find(petId);
            return p.HasValue ? p.Value.Stat : "";
        }

        public static int StepSec(string petId) => (KindOf(petId) == "might" ? OreEveryMin : EveryMin) * 60;
        public static int CapOf(string petId) => KindOf(petId) == "might" ? OreCap : Cap;

        /// <summary>그 일꾼이 지금 모은 수(상한 적용).</summary>
        public static int Pending(Worker w, long now)
        {
            if (w == null || !On) return 0;
            long dt = Math.Max(0, now - w.t);
            return Math.Min(CapOf(w.pet), (int)(dt / StepSec(w.pet)));
        }

        public static int PendingAll(long now)
        {
            int n = 0;
            foreach (var w in _s.list) n += Pending(w, now);
            return n;
        }

        public static bool IsWorker(string petId) => _s.list.Exists(w => w.pet == petId);

        /// <summary>앉힐 수 있는 다음 신수(가졌고·동행 아니고·일꾼 아님, 표 순서) — 없으면 null.</summary>
        public static string NextCandidate()
        {
            foreach (var p in GoEggs.Pets)
                if (EggState.Owns(p.Id) && p.Id != EggState.Buddy && !IsWorker(p.Id)) return p.Id;
            return null;
        }

        /// <summary>앉히기 — 못 하면 이유 키, 되면 null.</summary>
        public static string Assign(string petId, long now)
        {
            if (!On) return "work.why_off";
            if (string.IsNullOrEmpty(petId) || !EggState.Owns(petId)) return "work.why_none";
            if (petId == EggState.Buddy) return "work.why_buddy";
            if (IsWorker(petId)) return "work.why_has";
            if (_s.list.Count >= Slots) return "work.why_slots";
            _s.list.Add(new Worker { pet = petId, t = now });
            Changed?.Invoke();
            return null;
        }

        /// <summary>모은 것을 받는다 — 일꾼마다 받은 만큼 시계를 앞으로(남은 몫은 그대로). 받은 줄(없으면 빈 글).</summary>
        public static string Collect(long now)
        {
            if (!On) return "";
            int ore = 0, mint = 0, honey = 0, meat = 0;
            foreach (var w in _s.list)
            {
                int k = Pending(w, now);
                if (k <= 0) continue;
                long step = StepSec(w.pet);
                // 상한에 걸렸으면 시계를 지금으로(넘친 시간은 버림), 아니면 받은 만큼만 앞으로
                w.t = k >= CapOf(w.pet) ? now : w.t + k * step;
                switch (KindOf(w.pet))
                {
                    case "might": ore += k; break;
                    case "wisdom": for (int i = 0; i < k; i++) { if ((w.n + i) % 2 == 0) mint++; else honey++; } break;
                    default: meat += k; break;
                }
                w.n += k;
            }
            if (ore + mint + honey + meat == 0) return "";
            if (ore > 0) WeaponState.AddOre(ore);
            if (mint > 0) CookState.Add("mint", mint);
            if (honey > 0) CookState.Add("honey_flower", honey);
            if (meat > 0) CookState.Add("meat", meat);
            Changed?.Invoke();
            var parts = new List<string>();
            if (ore > 0) parts.Add(string.Format(GoLocalization.T("work.got_ore", "⛏️ 강화석 {0}"), ore));
            if (mint > 0) parts.Add(string.Format(GoLocalization.T("work.got_mint", "🌿 박하 {0}"), mint));
            if (honey > 0) parts.Add(string.Format(GoLocalization.T("work.got_honey", "🌼 꿀꽃 {0}"), honey));
            if (meat > 0) parts.Add(string.Format(GoLocalization.T("work.got_meat", "🍖 짐승 고기 {0}"), meat));
            return string.Join(" · ", parts);
        }

        /// <summary>내보내기 — 모은 것을 먼저 받고 뺀다. 받은 줄(없으면 빈 글), 일꾼이 아니면 null.</summary>
        public static string Dismiss(string petId, long now)
        {
            int i = _s.list.FindIndex(w => w.pet == petId);
            if (i < 0) return null;
            string got = Collect(now);
            _s.list.RemoveAt(i);
            Changed?.Invoke();
            return got;
        }

        public static string WhyText(string why)
        {
            switch (why)
            {
                case "work.why_buddy": return GoLocalization.T(why, "동행 중인 신수는 일하러 못 보낸다");
                case "work.why_has": return GoLocalization.T(why, "이미 마당에서 일한다");
                case "work.why_slots": return string.Format(GoLocalization.T(why, "일꾼 자리가 없다 — 마당을 꾸미면 는다({0}칸)"), Slots);
                case "work.why_off": return GoLocalization.T(why, "신수 일꾼이 꺼져 있다");
                default: return GoLocalization.T("work.why_none", "앉힐 신수가 없다 — 알을 부화시키자");
            }
        }

        public static string KindLabel(string petId)
        {
            switch (KindOf(petId))
            {
                case "might": return GoLocalization.T("work.kind_might", "⛏️ 캐기");
                case "wisdom": return GoLocalization.T("work.kind_wisdom", "🌿 뜯기");
                default: return GoLocalization.T("work.kind_command", "🍖 사냥");
            }
        }

        /// <summary>쉼터 창 한 줄.</summary>
        public static string Line(long now)
        {
            var parts = new List<string>();
            foreach (var w in _s.list)
            {
                var p = GoEggs.Find(w.pet);
                parts.Add($"{KindLabel(w.pet)} {(p.HasValue ? p.Value.Name : w.pet)} {Pending(w, now)}/{CapOf(w.pet)}");
            }
            string head = string.Format(GoLocalization.T("work.head", "🐾 신수 일꾼 {0}/{1} — 30분에 하나(강화석은 2시간) · 12시간치까지"), _s.list.Count, Slots);
            return parts.Count == 0 ? head + "\n" + GoLocalization.T("work.empty", "아직 일꾼이 없다") : head + "\n" + string.Join("  ·  ", parts);
        }

        public static string Snapshot() => JsonUtility.ToJson(_s);

        public static void Restore(string json)
        {
            Store s = null;
            if (!string.IsNullOrEmpty(json)) { try { s = JsonUtility.FromJson<Store>(json); } catch (ArgumentException) { s = null; } }
            _s = s ?? new Store();
            if (_s.list == null) _s.list = new List<Worker>();
            _s.list.RemoveAll(w => w == null || !GoEggs.Find(w.pet).HasValue);
            Changed?.Invoke();
        }

        public static void ResetForTest() => Restore(null);
    }
}
