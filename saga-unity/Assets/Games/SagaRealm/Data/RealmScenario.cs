using System;
using System.Collections.Generic;
using System.Linq;
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
        // 단계(tasks U-0026) — 성 차지 카드를 고르면 열린다. `_stageId` 는 단계를 연 카드 id(없으면 null).
        private static string _stageId, _stageTarget;
        private static int _stageSince;
        /// <summary>설전·일기토 단계의 앞 단 결과(이김/짐) — 앞 단이 아직이면 null. 세이브엔 안 담는다(도입 카드가 뜬 채 저장·불러오면 처음부터 다시 묻는다).</summary>
        private static bool? _preWon;
        /// <summary>진단 — 정해 두면 그 성을 차지한 것으로 본다(실제 함락 대신).</summary>
        public static System.Func<string, bool> CapturedForTest;
        /// <summary>끄는 손잡이 — 진단이 기본으로 끈다(성 차지 단계가 열려 본 사슬이 쉬면 앞선 진단이 흔들린다). 단계 진단만 켠다.</summary>
        public static bool StagesEnabled = true;
        private static readonly Dictionary<string, (string k, int turn)> _done = new Dictionary<string, (string, int)>();
        /// <summary>곁가지 — 시간 틈 사람이 우리 사람인 걸 처음 본 달(웹 `scenario.seen[id]`). 열두 달 뒤 그 사람 카드가 온다.</summary>
        private static readonly Dictionary<string, int> _sideSeen = new Dictionary<string, int>();
        public const int SideMonths = 12;
        /// <summary>곁가지 켜기 — 진단(<see cref="ResetForTest"/>)은 끄고 시작한다(본 사슬 진단이 곁가지 카드에 흔들리지 않게).</summary>
        public static bool SideEnabled = true;
        /// <summary>지금 글을 만드는 곁가지 카드의 사람 — {책사} 가 이 사람이 된다.</summary>
        private static string _who;

        public static RealmScenarioData.Card CardOf(string id) => RealmScenarioData.Get(id) ?? RealmScenarioSideData.Get(id);

        public static int TurnNow => TurnForTest ?? ((RealmCityState.Year - StartYear) * 12 + (RealmCityState.Month - 1));

        private static readonly string[] ActKo =
        {
            "", "📖 1막 · 중원의 난", "📖 2막 · 대전", "📖 3막 · 강 위", "📖 4막 · 삼계 균열", "📖 5막 · 먼 길", "📖 6막 · 천하", "📖 7막 · 틈의 끝", "", "📖 곁가지 · 시간 틈 사람",
        };

        /// <summary>처음 본 달을 적는다(옛 세이브는 앞 카드를 건너뜀) · 달이 되돌아갔으면(새 판) 처음부터.</summary>
        private static void Sync()
        {
            int turn = TurnNow;
            if (_seen && turn < _turnSeen) { _done.Clear(); _sideSeen.Clear(); _seen = false; }
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

        /// <summary>사람 세력에게 다음 카드 하나 — 표 순서대로, 앞 카드가 끝나야 다음이 온다. 본 사슬에 받을 카드가 없으면 곁가지(시간 틈 사람 열두 달)를 본다. 없으면 null.</summary>
        public static string DueCardId()
        {
            if (!Enabled || RealmCityState.ActiveCityIds.Count == 0) return null;
            Sync();
            // 단계가 열려 있는 동안 본 사슬은 쉰다(곁가지는 흐른다) — 때가 되면 결과 카드
            if (_stageId != null)
            {
                string end = StageFire();
                return end ?? (SideEnabled ? DueSideId() : null);
            }
            foreach (var c in RealmScenarioData.Cards)
            {
                if (_done.ContainsKey(c.Id)) continue;
                if (IsDue(c)) return c.Id;
                break;
            }
            return SideEnabled ? DueSideId() : null;
        }

        /// <summary>곁가지 — 시간 틈 사람이 우리 사람이 된 지 <see cref="SideMonths"/> 달이 지났으면 그 사람 고향 이야기. 처음 본 달은 여기서 적는다.</summary>
        private static string DueSideId()
        {
            string due = null;
            foreach (var c in RealmScenarioSideData.Side)
            {
                if (!Mine(c.Who)) continue;
                if (!_sideSeen.ContainsKey(c.Who)) _sideSeen[c.Who] = TurnNow;
                if (due == null && !_done.ContainsKey(c.Id) && TurnNow - _sideSeen[c.Who] >= SideMonths) due = c.Id;
            }
            return due;
        }

        /// <summary>진단 — 그 사람을 처음 본 달.</summary>
        public static int? SideSeenTurn(string who) => _sideSeen.TryGetValue(who, out var t) ? t : (int?)null;

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
            text.Replace("{책사}", _who != null ? NameOf(_who) : Adviser()).Replace("{이웃}", Neighbour()).Replace("{맹장}", Champion())
                .Replace("{adviser}", _who != null ? NameOf(_who) : Adviser()).Replace("{neighbour}", Neighbour()).Replace("{champion}", Champion());

        /// <summary>이룬 승리 종류 — 이 트랙 승리는 정복·문화 둘.</summary>
        public static string VictoryKind() => VictoryKindForTest ?? (RealmVictoryState.Result == RealmVictoryState.Kind.Culture ? "culture" : "conquest");

        public static string Hint(RealmScenarioData.Choice ch) => HintOf(ch.Fx, ch.Cost);

        /// <summary>효과 목록의 한 줄 힌트 — 음수(진 결과)는 "-" 글, 양수는 "+" 글(고르기 카드는 늘 양수).</summary>
        public static string HintOf(RealmScenarioData.Fx[] fxs, int cost = 0)
        {
            var parts = new List<string>();
            if (cost > 0) parts.Add(string.Format(RealmLocalization.T("scenario.hint.cost", "금 {0} 든다"), cost));
            foreach (var f in fxs)
            {
                bool neg = f.N < 0;
                int n = Mathf.Abs(f.N);
                switch (f.T)
                {
                    case "gold": parts.Add(string.Format(neg ? RealmLocalization.T("scenario.hint.gold_minus", "금 -{0}") : RealmLocalization.T("scenario.hint.gold", "금 +{0}"), n)); break;
                    case "food": parts.Add(string.Format(neg ? RealmLocalization.T("scenario.hint.food_minus", "수도 군량 -{0}") : RealmLocalization.T("scenario.hint.food", "수도 군량 +{0}"), n)); break;
                    case "sec": parts.Add(string.Format(neg ? RealmLocalization.T("scenario.hint.sec_minus", "수도 치안 -{0}") : RealmLocalization.T("scenario.hint.sec", "수도 치안 +{0}"), n)); break;
                    case "train": parts.Add(string.Format(neg ? RealmLocalization.T("scenario.hint.train_minus", "수도 훈련 -{0}") : RealmLocalization.T("scenario.hint.train", "수도 훈련 +{0}"), n)); break;
                    case "tech": parts.Add(string.Format(neg ? RealmLocalization.T("scenario.hint.tech_minus", "수도 기술 -{0}") : RealmLocalization.T("scenario.hint.tech", "수도 기술 +{0}"), n)); break;
                    case "recruit": parts.Add(string.Format(RealmLocalization.T("scenario.hint.recruit", "{0} 합류"), NameOf(f.Id))); break;
                    case "recruitFree": parts.Add(RealmLocalization.T("scenario.hint.recruit_free", "재야 인재 합류")); break;
                    case "quiz": parts.Add(string.Format(RealmLocalization.T("scenario.hint.quiz", "문답 정답 +{0}"), n)); break;
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
            if (IsStageEnd(id, out var sg)) return DescribeEnd(sg);
            var c = CardOf(id);
            if (c == null) return (id, "", "", "", "");
            _who = c.Who;
            try { return DescribeCard(c, id); }
            finally { _who = null; }
        }

        private static (string title, string body, string a, string b, string c) DescribeCard(RealmScenarioData.Card c, string id)
        {
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
            if (IsStageEnd(id, out var sg)) return ResolveEnd(sg);
            var c = CardOf(id);
            if (c == null || choiceIndex < 0 || choiceIndex > 2) return (RealmLocalization.T("scenario.no_card", "없는 카드"), false);
            Sync();
            _who = c.Who;
            try { return ResolveCard(c, id, choiceIndex); }
            finally { _who = null; }
        }

        private static (string message, bool ok) ResolveCard(RealmScenarioData.Card c, string id, int choiceIndex)
        {
            var ch = c.Choices[choiceIndex];
            if (ch.Cost > 0 && !RealmCityState.TrySpendGold(ch.Cost))
                return (RealmLocalization.T("scenario.no_gold", "금이 모자라 못 했다 — 다음 달에 다시 묻는다"), false);
            string cap = Capital;
            foreach (var f in ch.Fx) Apply(f, cap);
            _done[id] = (ch.K, TurnNow);
            string text = Fill(RealmLocalization.T($"scenario.{id}.{ch.K}.result", ch.ResultKo));
            string goal = BeginStage(id);
            return (goal == null ? text : text + "\n" + goal, true);
        }

        // ---- 단계(tasks U-0026) — 성 차지 -------------------------------------------------------------------------

        public static string StageId => _stageId;
        public static string StageTarget => _stageTarget;
        public static int StageSince => _stageSince;

        /// <summary>끝나는 달까지 남은 달(열린 단계가 없으면 0).</summary>
        public static int StageMonthsLeft
        {
            get
            {
                var st = _stageId == null ? null : RealmScenarioData.StageOf(_stageId);
                return st == null ? 0 : Mathf.Max(0, st.Months - (TurnNow - _stageSince));
            }
        }

        public static bool IsStageEnd(string id, out RealmScenarioData.Stage stage)
        {
            stage = null;
            if (id == null || !id.EndsWith("_end")) return false;
            stage = RealmScenarioData.StageOf(id.Substring(0, id.Length - 4));
            return stage != null;
        }

        private static bool IsCaptured(string enemyId)
        {
            if (CapturedForTest != null) return CapturedForTest(enemyId);
            if (RealmCityState.ActiveCityIds.Contains(enemyId)) return true;
            var rec = RealmWarState.Get(enemyId);
            return rec != null && rec.Captured;
        }

        private static string LandKey(RealmLand land) => land == RealmLand.River ? "river" : "plain";

        /// <summary>성 차지 목표 — 우리 성에서 칠 수 있는 안 차지된 적 성 하나. 어울리는 지역(prov) → 어울리는 땅(near) → 병력 적은 성 → id 순. 없으면 null.</summary>
        public static string PickTarget(string near, string prov)
        {
            string best = null; int bestFit = 0, bestTroops = 0;
            var seen = new HashSet<string>();
            foreach (var ours in RealmCityState.ActiveCityIds)
            {
                foreach (var eid in RealmEnemyCity.TargetsFrom(ours))
                {
                    if (!seen.Add(eid) || IsCaptured(eid)) continue;
                    var def = RealmEnemyCity.Get(eid);
                    if (def == null) continue;
                    int fit = !string.IsNullOrEmpty(prov) && RealmEnemyCity.ProvOf(eid) == prov ? 0
                        : !string.IsNullOrEmpty(near) && LandKey(def.Land) == near ? 1 : 2;
                    int troops = RealmWarState.Get(eid)?.Troops ?? def.BaseTroops;
                    bool better = best == null || fit < bestFit || (fit == bestFit && (troops < bestTroops || (troops == bestTroops && string.CompareOrdinal(eid, best) < 0)));
                    if (better) { best = eid; bestFit = fit; bestTroops = troops; }
                }
            }
            return best;
        }

        /// <summary>성 차지 카드를 고른 직후 단계를 연다 — 열었으면 안내 한 줄, 아니면 null(목표 성이 없거나 단계 없는 카드).</summary>
        private static string BeginStage(string cardId)
        {
            var st = RealmScenarioData.StageOf(cardId);
            if (!StagesEnabled || st == null) return null;
            if (st.Kind == "debate" || st.Kind == "duel")
            {
                // 설전·일기토 — 목표 성 없이 열고 곧(다음 달) 결과 카드가 와서 앞 단을 치른다. 일기토 상대가 이미 우리 사람이면 열지 않는다.
                if (st.Kind == "duel" && !string.IsNullOrEmpty(st.Foe) && Mine(st.Foe)) return null;
                _stageId = cardId; _stageTarget = ""; _stageSince = TurnNow; _preWon = null;
                return null;
            }
            if (st.Kind != "own") return null;
            string target = PickTarget(st.Near, st.Prov);
            if (string.IsNullOrEmpty(target)) return null;
            _stageId = cardId; _stageTarget = target; _stageSince = TurnNow;
            return string.Format(RealmLocalization.T("scenario.stage.goal", "🎯 {0} — {1} 을(를) {2}달 안에 차지하라"),
                RealmLocalization.T($"scenario.stage.{st.Id}.title", st.TitleKo), CityName(target), st.Months);
        }

        private static string CityName(string enemyId) => RealmEnemyCity.Get(enemyId)?.Name ?? enemyId;

        /// <summary>HUD 한 줄 — 열린 단계의 목표·남은 달(없으면 null).</summary>
        public static string StageLine()
        {
            var st = _stageId == null ? null : RealmScenarioData.StageOf(_stageId);
            if (st == null || st.Kind != "own") return null;
            return string.Format(RealmLocalization.T("scenario.stage.line", "🎯 {0} 차지 — {1}달 남음"), CityName(_stageTarget), StageMonthsLeft);
        }

        private static void ClearStage() { _stageId = null; _stageTarget = null; _stageSince = 0; _preWon = null; }

        /// <summary>결과 카드가 앞 단(설전·일기토)을 먼저 치러야 하는가 — UI 가 단추를 눌렀을 때 묻는다.</summary>
        public static bool NeedsPre(string id) => IsStageEnd(id, out var sg) && sg.Kind != "own" && _preWon == null;

        /// <summary>앞 단 종류 — "debate" · "duel"(그 밖은 null).</summary>
        public static string PreKind(string id) => IsStageEnd(id, out var sg) && sg.Kind != "own" ? sg.Kind : null;

        /// <summary>UI 가 앞 단 결과를 넘긴다 — 이김이면 true.</summary>
        public static void SetPre(bool won) { _preWon = won; }

        /// <summary>설전 난도를 정하는 책사 지력 — 로스터에서 가장 높은 지력.</summary>
        public static int AdviserWisdom()
        {
            int best = 0;
            foreach (var id in RealmCityState.RosterIds)
            {
                var o = RealmOfficerPool.Get(id);
                if (o != null && o.Wisdom > best) best = o.Wisdom;
            }
            return best;
        }

        /// <summary>단계가 열려 있을 때 결과 카드 id — 목표를 차지했거나 달 수가 다 됐을 때만(아니면 null).</summary>
        private static string StageFire()
        {
            var st = RealmScenarioData.StageOf(_stageId);
            if (st == null) { ClearStage(); return null; }
            if (st.Kind != "own") return _stageId + "_end";   // 설전·일기토는 때를 안 기다린다
            if (!IsCaptured(_stageTarget) && TurnNow - _stageSince < st.Months) return null;
            return _stageId + "_end";
        }

        private static (string title, string body, string a, string b, string c) DescribeEnd(RealmScenarioData.Stage sg)
        {
            var c = CardOf(sg.Id);
            string title = (c != null ? c.Emoji + " " : "") + RealmLocalization.T($"scenario.stage.{sg.Id}.title", sg.TitleKo);
            string act = c != null ? RealmLocalization.T($"scenario.act.{c.Act}", ActKo[c.Act]) : "";
            if (sg.Kind != "own" && _preWon == null)
            {
                // 도입 카드 — 단추를 누르면 UI 가 설전·일기토를 연다
                string intro = Fill(RealmLocalization.T($"scenario.stage.{sg.Id}.intro", sg.IntroKo));
                return (title, (act.Length > 0 ? "<size=70%>" + act + "</size>\n" : "") + intro, RealmLocalization.T("scenario.stage.start", "시작"), "", "");
            }
            bool won = sg.Kind == "own" ? IsCaptured(_stageTarget) : _preWon == true;
            var br = won ? sg.Win : sg.Lose;
            string text = Fill(RealmLocalization.T($"scenario.stage.{sg.Id}.{(won ? "win" : "lose")}", br.TextKo));
            string body = (act.Length > 0 ? "<size=70%>" + act + "</size>\n" : "") + text + "\n<size=70%>" + HintOf(br.Fx) + "</size>";
            return (title, body, RealmLocalization.T("scenario.stage.confirm", "확인"), "", "");
        }

        private static (string message, bool ok) ResolveEnd(RealmScenarioData.Stage sg)
        {
            if (sg.Kind != "own" && _preWon == null) return (RealmLocalization.T("scenario.stage.not_yet", "먼저 겨뤄야 한다"), false);
            bool won = sg.Kind == "own" ? IsCaptured(_stageTarget) : _preWon == true;
            var br = won ? sg.Win : sg.Lose;
            string cap = Capital;
            foreach (var f in br.Fx) ApplyStage(f, cap);
            ClearStage();
            return (Fill(RealmLocalization.T($"scenario.stage.{sg.Id}.{(won ? "win" : "lose")}", br.TextKo)), true);
        }

        // 결과 효과 — 음수 금은 가진 만큼만 뺀다(모자라면 0 까지). 나머지는 카드 효과와 같다.
        private static void ApplyStage(RealmScenarioData.Fx f, string cap)
        {
            if (f.T == "gold" && f.N < 0) { RealmCityState.TrySpendGold(Mathf.Min(-f.N, RealmCityState.Gold)); return; }
            switch (f.T)
            {
                case "quiz": RealmQuizState.AddBonusCorrect(f.N); return;       // 문답 정답 수 가산(문화 승리 기준에 합쳐진다)
                case "lend": return;                                             // 이웃 세력으로 떠난다 — 이 트랙엔 이웃 군주가 없어 글만
                case "recruitFree":
                    if (cap == null) return;
                    string pick = PickFreeOfficer();
                    if (pick != null) RealmCityState.JoinOfficer(pick, cap);
                    else RealmCityState.AdjustCity(cap, tech: 10);               // 재야가 없으면 기존 등용 규칙처럼 기술 +10
                    return;
            }
            Apply(f, cap);
        }

        /// <summary>재야 중 지력 으뜸 하나(시간 틈 아홉·이미 우리 사람은 뺀다) — 없으면 null.</summary>
        private static string PickFreeOfficer()
        {
            string best = null; int bw = -1;
            foreach (var id in RealmOfficerPool.AllHiddenIds)
            {
                if (RealmCityState.RosterIds.Contains(id) || System.Array.IndexOf(RealmScenarioData.TimeFolk, id) >= 0) continue;
                var o = RealmOfficerPool.Get(id);
                if (o != null && o.Wisdom > bw) { bw = o.Wisdom; best = id; }
            }
            return best;
        }

        /// <summary>세이브용 — 열린 단계(없으면 null·null·0).</summary>
        public static void SnapshotStage(out string id, out string target, out int since) { id = _stageId; target = _stageTarget; since = _stageSince; }

        /// <summary>불러오기 — 모르는 단계·성은 버린다(옛 세이브는 필드가 없어 단계 없음).</summary>
        public static void RestoreStage(string id, string target, int since)
        {
            ClearStage();
            var st = string.IsNullOrEmpty(id) ? null : RealmScenarioData.StageOf(id);
            if (st == null) return;
            if (st.Kind == "own" && (string.IsNullOrEmpty(target) || RealmEnemyCity.Get(target) == null)) return;
            _stageId = id; _stageTarget = st.Kind == "own" ? target : ""; _stageSince = since;
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

        public static void Snapshot(out bool seen, out int t0, out int turnSeen, out string[] ids, out string[] ks, out int[] turns, out string[] sideWho, out int[] sideTurn)
        {
            seen = _seen; t0 = _t0; turnSeen = _turnSeen;
            var i = new List<string>(); var k = new List<string>(); var t = new List<int>();
            foreach (var c in RealmScenarioData.Cards)
                if (_done.TryGetValue(c.Id, out var d)) { i.Add(c.Id); k.Add(d.k); t.Add(d.turn); }
            foreach (var c in RealmScenarioSideData.Side)
                if (_done.TryGetValue(c.Id, out var d)) { i.Add(c.Id); k.Add(d.k); t.Add(d.turn); }
            ids = i.ToArray(); ks = k.ToArray(); turns = t.ToArray();
            var sw = new List<string>(); var st = new List<int>();
            foreach (var kv in _sideSeen) { sw.Add(kv.Key); st.Add(kv.Value); }
            sideWho = sw.ToArray(); sideTurn = st.ToArray();
        }

        /// <summary>불러오기·새 게임 — 없으면(옛 세이브) 안 본 것으로(다음에 Sync 가 처음 본 달을 적는다). 모르는 카드는 버린다.</summary>
        public static void Restore(bool seen, int t0, int turnSeen, string[] ids, string[] ks, int[] turns, string[] sideWho = null, int[] sideTurn = null)
        {
            ClearStage();
            _done.Clear();
            _sideSeen.Clear();
            if (seen && sideWho != null && sideTurn != null)
                for (int j = 0; j < sideWho.Length && j < sideTurn.Length; j++) _sideSeen[sideWho[j]] = sideTurn[j];
            _seen = seen; _t0 = t0; _turnSeen = turnSeen;
            if (seen && ids != null)
                for (int i = 0; i < ids.Length; i++)
                    if (CardOf(ids[i]) != null)
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
            CapturedForTest = null;
            StagesEnabled = false;
            SideEnabled = false;
            Restore(false, 0, 0, null, null, null);
        }
    }
}
