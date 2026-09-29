using System;
using System.Collections.Generic;
using UnityEngine;

namespace Saga.Realm.Data
{
    /// <summary>
    /// PLAN.md 109-16 시나리오 「천하와 균열」 진행(웹 사가국지 `js/scenario.js` · 정본 `scenario/saga-realm.md`) — 표(<see cref="RealmScenarioData"/>)의 열아홉 카드를
    /// **사람 세력에게 정해진 때에 표 순서대로 하나씩** 사건 카드(`RealmEventState`, 세 갈래 고르기)로 낸다. 앞 카드에 답해야 다음이 온다. 월간 무작위 사건보다 먼저 뜬다.
    /// 열림: 시작 뒤 `MinTurn` 달이 지났거나(또는 `OrCities` 성 이상을 쥐었거나) — 6막은 승리를 하나 이룬 뒤, 7막 첫 카드는 시간 틈 사람 아홉이 다 우리 사람이 된 뒤.
    /// 효과는 이미 있는 손잡이(금·수도 군량/치안/훈련/기술·시간 틈 사람 등용)만 만진다 — 새 판정 없음. 금이 모자라 못 내면 카드를 안 끝내고 다음 달에 다시 묻는다.
    /// 세이브: `scenarioSeen/T0/TurnSeen` + 끝낸 카드 셋(id·고른 답·달) — 버전 그대로, 옛 세이브(24달 넘게 한 판)는 지나온 길로 보고 앞 카드를 건너뛴다(웹 `legacy`).
    /// 진단은 `Enabled = false` 로 끈다(월간 사건 진단이 흔들리지 않게).
    /// </summary>
    public static class RealmScenario
    {
        public const int StartYear = 194;
        public const int LegacyAfterTurn = 24;

        /// <summary>끄는 손잡이(웹 `DG_NO_SCENARIO`) — 진단이 기본으로 끈다.</summary>
        public static bool Enabled = true;
        /// <summary>진단 — 정해 두면 달 수 대신 이 값 · 다스리는 성 수 대신 이 값 · 시간 틈 사람이 우리 사람인지 대신 이 판정.</summary>
        public static int? TurnForTest;
        public static int? CitiesForTest;
        public static Func<string, bool> MineForTest;
        /// <summary>진단 — 승리 여부·종류를 붙든다(승리 검사가 도시 값이 바뀔 때마다 다시 돌아 진단 중 저절로 승리가 나기 때문).</summary>
        public static bool? VictoryForTest;
        public static string VictoryKindForTest;

        private static bool VictoryOver => VictoryForTest ?? RealmVictoryState.IsOver;

        private static int CityCount => CitiesForTest ?? RealmCityState.ActiveCityIds.Count;
        private static bool Mine(string officerId) => MineForTest != null ? MineForTest(officerId) : RealmMounts.Mine(officerId);

        private static bool _seen;
        private static int _t0, _turnSeen;
        private static readonly Dictionary<string, (string k, int turn)> _done = new Dictionary<string, (string, int)>();

        public static int TurnNow => TurnForTest ?? ((RealmCityState.Year - StartYear) * 12 + (RealmCityState.Month - 1));

        private static readonly string[] ActKo =
        {
            "", "📖 1막 · 중원의 난", "📖 2막 · 대전", "📖 3막 · 강 위", "📖 4막 · 삼계 균열", "📖 5막 · 먼 길", "📖 6막 · 천하", "📖 7막 · 틈의 끝",
        };

        /// <summary>처음 본 달을 적는다(옛 세이브는 앞 카드를 건너뜀) · 달이 되돌아갔으면(새 판) 처음부터.</summary>
        private static void Sync()
        {
            int turn = TurnNow;
            if (_seen && turn < _turnSeen) { _done.Clear(); _seen = false; }
            _turnSeen = turn;
            if (_seen) return;
            _seen = true;
            _t0 = turn;
            if (turn > LegacyAfterTurn) foreach (var c in RealmScenarioData.Cards) _done[c.Id] = ("", turn);
        }

        public static bool IsDone(string id) { Sync(); return _done.ContainsKey(id); }
        public static bool IsLegacy(string id) { Sync(); return _done.TryGetValue(id, out var d) && d.k.Length == 0; }
        public static string AnswerOf(string id) { Sync(); return _done.TryGetValue(id, out var d) && d.k.Length > 0 ? d.k : null; }
        public static int DoneCount { get { Sync(); return _done.Count; } }
        public static int Since { get { Sync(); return TurnNow - _t0; } }

        public static bool IsDue(RealmScenarioData.Card c)
        {
            Sync();
            if (c.Victory && !VictoryOver) return false;
            if (c.AllTime)
            {
                foreach (var id in RealmScenarioData.TimeFolk) if (!Mine(id)) return false;
                return true;
            }
            if (c.Victory) return true;
            if (Since >= c.MinTurn) return true;
            return c.OrCities > 0 && CityCount >= c.OrCities;
        }

        /// <summary>사람 세력에게 다음 카드 하나 — 표 순서대로, 앞 카드가 끝나야 다음이 온다. 없으면 null.</summary>
        public static string DueCardId()
        {
            if (!Enabled || RealmCityState.ActiveCityIds.Count == 0) return null;
            Sync();
            foreach (var c in RealmScenarioData.Cards)
            {
                if (_done.ContainsKey(c.Id)) continue;
                return IsDue(c) ? c.Id : null;
            }
            return null;
        }

        // ---- 글 -----------------------------------------------------------------------------------------------

        private static string Capital => RealmCityState.ActiveCityIds.Count > 0 ? RealmCityState.ActiveCityIds[0] : null;

        private static string NameOf(string officerId) => RealmOfficerPool.Get(officerId)?.Name ?? officerId;

        /// <summary>{책사} — 로스터에서 지력이 가장 높은 무장.</summary>
        public static string Adviser()
        {
            string best = null; int bw = -1;
            foreach (var id in RealmCityState.RosterIds)
            {
                var o = RealmOfficerPool.Get(id);
                if (o != null && o.Wisdom > bw) { bw = o.Wisdom; best = id; }
            }
            return best != null ? NameOf(best) : RealmLocalization.T("scenario.adviser", "책사");
        }

        /// <summary>{맹장} — 로스터에서 무력이 가장 높은 무장.</summary>
        public static string Champion()
        {
            string best = null; int bm = -1;
            foreach (var id in RealmCityState.RosterIds)
            {
                var o = RealmOfficerPool.Get(id);
                if (o != null && o.Might > bm) { bm = o.Might; best = id; }
            }
            return best != null ? NameOf(best) : RealmLocalization.T("scenario.champion", "맹장");
        }

        /// <summary>{이웃} — 수도에서 칠 수 있는 이웃 성(이 트랙엔 이웃 군주가 없어 성 이름으로).</summary>
        public static string Neighbour()
        {
            string cap = Capital;
            string enemy = cap != null ? RealmEnemyCity.TargetFrom(cap) : null;
            var def = enemy != null ? RealmEnemyCity.Get(enemy) : null;
            return def != null ? def.Name : RealmLocalization.T("scenario.neighbour", "이웃 군주");
        }

        public static string Fill(string text) =>
            text.Replace("{책사}", Adviser()).Replace("{이웃}", Neighbour()).Replace("{맹장}", Champion())
                .Replace("{adviser}", Adviser()).Replace("{neighbour}", Neighbour()).Replace("{champion}", Champion());

        /// <summary>이룬 승리 종류 — 이 트랙 승리는 정복·문화 둘.</summary>
        public static string VictoryKind() => VictoryKindForTest ?? (RealmVictoryState.Result == RealmVictoryState.Kind.Culture ? "culture" : "conquest");

        public static string Hint(RealmScenarioData.Choice ch)
        {
            var parts = new List<string>();
            if (ch.Cost > 0) parts.Add(string.Format(RealmLocalization.T("scenario.hint.cost", "금 {0} 든다"), ch.Cost));
            foreach (var f in ch.Fx)
            {
                switch (f.T)
                {
                    case "gold": parts.Add(string.Format(RealmLocalization.T("scenario.hint.gold", "금 +{0}"), f.N)); break;
                    case "food": parts.Add(string.Format(RealmLocalization.T("scenario.hint.food", "수도 군량 +{0}"), f.N)); break;
                    case "sec": parts.Add(string.Format(RealmLocalization.T("scenario.hint.sec", "수도 치안 +{0}"), f.N)); break;
                    case "train": parts.Add(string.Format(RealmLocalization.T("scenario.hint.train", "수도 훈련 +{0}"), f.N)); break;
                    case "tech": parts.Add(string.Format(RealmLocalization.T("scenario.hint.tech", "수도 기술 +{0}"), f.N)); break;
                    case "recruit": parts.Add(string.Format(RealmLocalization.T("scenario.hint.recruit", "{0} 합류"), NameOf(f.Id))); break;
                }
            }
            return string.Join(" · ", parts);
        }

        /// <summary>본문 — 6막은 이룬 승리별, 7막 뒤 두 카드는 앞 카드(<c>FromId</c>)에서 고른 답별(없으면 기본 글).</summary>
        public static string BodyOf(RealmScenarioData.Card c)
        {
            string key = $"scenario.{c.Id}.text";
            if (c.TextByKKo != null)
            {
                string k = AnswerOf(c.FromId);
                if (k != null && c.TextByKKo.TryGetValue(k, out var ko)) return RealmLocalization.T($"scenario.{c.Id}.textk.{k}", ko);
            }
            else if (c.TextByKo != null)
            {
                string k = VictoryKind();
                if (c.TextByKo.TryGetValue(k, out var ko)) return RealmLocalization.T($"{key}.{k}", ko);
            }
            return RealmLocalization.T(key, c.TextKo);
        }

        /// <summary>카드 하나의 제목·본문·선택지 셋 글(<see cref="RealmEventState.Describe"/> 가 부른다).</summary>
        public static (string title, string body, string a, string b, string c) Describe(string id)
        {
            var c = RealmScenarioData.Get(id);
            if (c == null) return (id, "", "", "", "");
            string title = c.Emoji + " " + RealmLocalization.T($"scenario.{id}.title", c.TitleKo);
            string act = RealmLocalization.T($"scenario.act.{c.Act}", ActKo[c.Act]);
            string body = "<size=70%>" + act + "</size>\n" + Fill(BodyOf(c));
            var labels = new string[3];
            for (int i = 0; i < 3; i++)
            {
                var ch = c.Choices[i];
                labels[i] = Fill(RealmLocalization.T($"scenario.{id}.{ch.K}.label", ch.LabelKo)) + "\n<size=70%>" + Hint(ch) + "</size>";
            }
            return (title, body, labels[0], labels[1], labels[2]);
        }

        // ---- 답하기 -------------------------------------------------------------------------------------------

        /// <summary>선택 효과 — 금이 모자라면 카드를 안 끝내고(다음 달 다시) 실패 글. 성공하면 카드를 끝낸 것으로 적는다.</summary>
        public static (string message, bool ok) Resolve(string id, int choiceIndex)
        {
            var c = RealmScenarioData.Get(id);
            if (c == null || choiceIndex < 0 || choiceIndex > 2) return (RealmLocalization.T("scenario.no_card", "없는 카드"), false);
            Sync();
            var ch = c.Choices[choiceIndex];
            if (ch.Cost > 0 && !RealmCityState.TrySpendGold(ch.Cost))
                return (RealmLocalization.T("scenario.no_gold", "금이 모자라 못 했다 — 다음 달에 다시 묻는다"), false);
            string cap = Capital;
            foreach (var f in ch.Fx) Apply(f, cap);
            _done[id] = (ch.K, TurnNow);
            return (Fill(RealmLocalization.T($"scenario.{id}.{ch.K}.result", ch.ResultKo)), true);
        }

        private static void Apply(RealmScenarioData.Fx f, string cap)
        {
            switch (f.T)
            {
                case "gold": RealmCityState.AddGold(f.N); break;
                case "food": if (cap != null) RealmCityState.AdjustCity(cap, food: f.N); break;
                case "sec": if (cap != null) RealmCityState.AdjustCity(cap, sec: f.N); break;
                case "train": if (cap != null) RealmCityState.AdjustCity(cap, train: f.N); break;
                case "tech": if (cap != null) RealmCityState.AdjustCity(cap, tech: f.N); break;
                case "recruit":
                    if (cap == null) break;
                    if (!Mine(f.Id)) RealmCityState.JoinOfficer(f.Id, cap);
                    else RealmCityState.AdjustCity(cap, tech: 10); // 이미 우리 사람이면 웹은 충성 +5 → 이 트랙은 기술 +10
                    break;
            }
        }

        // ---- 세이브 -------------------------------------------------------------------------------------------

        public static void Snapshot(out bool seen, out int t0, out int turnSeen, out string[] ids, out string[] ks, out int[] turns)
        {
            seen = _seen; t0 = _t0; turnSeen = _turnSeen;
            var i = new List<string>(); var k = new List<string>(); var t = new List<int>();
            foreach (var c in RealmScenarioData.Cards)
                if (_done.TryGetValue(c.Id, out var d)) { i.Add(c.Id); k.Add(d.k); t.Add(d.turn); }
            ids = i.ToArray(); ks = k.ToArray(); turns = t.ToArray();
        }

        /// <summary>불러오기·새 게임 — 없으면(옛 세이브) 안 본 것으로(다음에 Sync 가 처음 본 달을 적는다). 모르는 카드는 버린다.</summary>
        public static void Restore(bool seen, int t0, int turnSeen, string[] ids, string[] ks, int[] turns)
        {
            _done.Clear();
            _seen = seen; _t0 = t0; _turnSeen = turnSeen;
            if (seen && ids != null)
                for (int i = 0; i < ids.Length; i++)
                    if (RealmScenarioData.Get(ids[i]) != null)
                        _done[ids[i]] = (ks != null && i < ks.Length ? ks[i] ?? "" : "", turns != null && i < turns.Length ? turns[i] : 0);
        }

        public static void ResetForTest()
        {
            Enabled = true;
            TurnForTest = null;
            CitiesForTest = null;
            MineForTest = null;
            VictoryForTest = null;
            VictoryKindForTest = null;
            Restore(false, 0, 0, null, null, null);
        }
    }
}
