using System;
using System.Collections.Generic;
using UnityEngine;

namespace Saga.Realm.Data
{
    /// <summary>
    /// VERTICAL_SLICE_REALM.md 3절 — war.js setupMarch()/finishMarch()의
    /// "출진 준비 → fight() 호출 → 뒤처리"를 소패 하나로 좁혀 옮겼다.
    /// **51장 "대규모 콘텐츠"(2026-09-14)로 정도가 둘째 목표로 붙으면서
    /// 적 성 하나(_xiaopei)를 RealmEnemyCity.AllIds 전부를 키로 둔 딕셔너리
    /// (_enemies)로 일반화했다** — Attack()/Plot() 모두 "어느 적을 칠지"를
    /// fromCityId로부터 RealmEnemyCity.TargetFrom()이 알아낸다(성 하나당
    /// 목표 하나뿐이라 인자를 안 늘려도 된다). `Xiaopei` 프로퍼티는 옛
    /// 테스트·호출부 호환을 위해 그대로 남긴다(Get("xiaopei")와 같다).
    /// **뺀 것**(문서 그대로): 수량 선택 UI(전군을 보낸다), 진영(camp —
    /// 무승부는 routed와 같이 취급), 함락 뒤처리(무장 배치·태수·치안
    /// 반토막·랜드마크 — `Captured` 깃발만 세운다), 구원군·물길.
    /// **51장 2차 확장(2026-09-15)** — 낙양·하비·업 셋을 더 추가하는 동안
    /// 이 클래스는 한 줄도 안 바뀌었다(`AllIds` 기준 딕셔너리로 이미
    /// 일반화돼 있었다는 뜻 — RealmEnemyCity.cs·RealmCityData.cs 데이터만
    /// 추가하면 되는 구조가 의도대로 동작했다).
    /// </summary>
    public static class RealmWarState
    {
        private static readonly Dictionary<string, RealmEnemyRecord> _enemies = BuildInitial();

        private static Dictionary<string, RealmEnemyRecord> BuildInitial()
        {
            var dict = new Dictionary<string, RealmEnemyRecord>();
            foreach (var id in RealmEnemyCity.AllIds) dict[id] = RealmEnemyCity.NewRecord(id);
            return dict;
        }

        public static RealmEnemyRecord Get(string enemyId) => _enemies.TryGetValue(enemyId, out var r) ? r : null;

        /// <summary>옛 호출부 호환용 — Get("xiaopei")와 같다.</summary>
        public static RealmEnemyRecord Xiaopei => Get(RealmEnemyCity.XiaopeiId);

        public static event Action Changed;

        public readonly struct AttackResult
        {
            public readonly bool Ok;
            public readonly string Message;
            // 유효한 출진이었는지(Ok)와 별개로 실제 전투 결과(승/패)까지
            // UI가 사운드를 고를 수 있게 알려준다 — Ok=false(출진 자체가
            // 무효)일 땐 의미 없어 기본값 false로 둔다.
            public readonly bool Won;
            // PLAN.md 109-13 싸움터 땅 — 싸움터 장면(`RealmBattlefield`)이 양군 머릿수를 그리는 값. Ok=false 면 비어 있다.
            public readonly string EnemyId;
            public readonly int AtkStart, AtkLeft, DefStart, DefLeft;
            // PLAN.md 109-15 명마 — 싸움터 컷에서 공격군이 달려 붙는 속도 배율(안 탔으면 1).
            public readonly float Charge;
            public AttackResult(bool ok, string message, bool won = false) : this(ok, message, won, null, 0, 0, 0, 0) { }
            public AttackResult(bool ok, string message, bool won, string enemyId, int atkStart, int atkLeft, int defStart, int defLeft, float charge = 1f)
            {
                Ok = ok; Message = message; Won = won;
                EnemyId = enemyId; AtkStart = atkStart; AtkLeft = atkLeft; DefStart = defStart; DefLeft = defLeft;
                Charge = charge;
            }
        }

        /// <summary>출진할 수 있는가 — war.js canMarch()를 이 슬라이스
        /// 범위(물길 없음)로 좁힌 것. 목표는 보통 fromCityId 하나로 정해지지만
        /// (RealmEnemyCity.TargetFrom), 51장 16차 확장(2026-09-18, PLAN.md
        /// Q-U2)부터 국경 성 일부가 목표를 둘 갖는다 — 그런 성은 `enemyId`를
        /// 명시해야 한다(생략하면 `TargetFrom`이 그중 하나만 골라 버려
        /// 플레이어가 고른 것과 다를 수 있다, `RealmCommandUi.ExecuteAttack()`
        /// 이 이 경우 고르기 패널을 먼저 연다). PLAN.md 101-2 5-6(2026-09-20)
        /// — `useTactic`이 true면 <see cref="ResolveTactic"/>이 목표 성의
        /// 지형(<see cref="RealmLand"/>)에 맞는 전술을 골라 <see cref="RealmWar.Fight"/>
        /// 에 배율을 얹는다. PLAN.md 101-2 5-3(2026-09-20) — `duelPowerMul`은
        /// `RealmCommandUi`가 일기토 3합(<see cref="RealmDuelState"/>) 결과를
        /// 미리 평균 내 넘겨준 배율(기본 1 — 안 쓰면 그대로). tasks U-0098 — `grid` 는 격자 전술판
        /// (<see cref="RealmTactics.Apply"/>)의 보정값: 공 위력 ×(1+winPct/100)·받는 피해 ×lossMul·전사·중상. null 이면 지금 그대로.</summary>
        public static AttackResult Attack(string fromCityId, string enemyId = null, bool useTactic = false, float duelPowerMul = 1f, RealmTactics.Bonus grid = null)
        {
            string block = MarchBlock(fromCityId, ref enemyId);
            if (block != null) return new AttackResult(false, block);

            var def = RealmEnemyCity.Get(enemyId);
            var enemy = _enemies[enemyId];
            var city = RealmCityState.CityRecord(fromCityId);
            int troops = city.Troops;
            int need = Mathf.RoundToInt(troops / 1000f * RealmCityState.FoodPer1000 * 2f);
            var officers = MarchOfficers(fromCityId);

            // 출진 — 병력 전군·군량 need만큼 미리 나간다(war.js와 같은 순서).
            city.Troops = 0;
            city.Food -= need;
            foreach (var id in officers) RealmCityState.MarkOfficerDone(id);

            // tasks U-0098 격자 전술 — 판 결과를 남은 싸움에: 쓰러진·다친 장수는 빠지고, 공 위력·받는 피해 배율만 얹는다(판정은 아래 Fight 한 번).
            string gridNote = null;
            float takeMul = 1f;
            if (grid != null)
            {
                duelPowerMul *= 1f + grid.WinPct / 100f;
                takeMul = grid.LossMul;
                gridNote = ApplyGrid(grid, officers, enemyId, def.Name);
            }

            if (RealmTechData.Pct("atkPct") != 0) duelPowerMul *= RealmTechData.Mul("atkPct"); // tasks U-0129 창 갈기·쇠뇌 틀
            if (RealmTechData.Pct("defPct") != 0) takeMul /= RealmTechData.Mul("defPct");      // tasks U-0129 방패 벽 — 아군 손실을 덜
            var atk = new RealmArmy { Troops = troops, Start = troops, Train = city.Train, Tech = city.Tech, OfficerIds = officers, Morale = 1f };
            var defArmy = new RealmArmy { Troops = enemy.Troops, Start = enemy.Troops, Train = enemy.Train, Tech = enemy.Tech, OfficerIds = new List<string>(), Morale = 1f };

            string tacticNote = null;
            float firstRoundMul = 1f, defMul = 1f;
            if (useTactic) (firstRoundMul, defMul, tacticNote) = ResolveTactic(def.Land, officers);

            var result = RealmWar.Fight(atk, defArmy, enemy, def.Land, firstRoundMul, defMul, duelPowerMul, takeMul);

            int eaten = Mathf.RoundToInt(troops / 1000f * RealmCityState.FoodPer1000);
            int baggage = Mathf.Max(0, need - eaten);

            string message;
            if (result.Won)
            {
                enemy.Captured = true;
                enemy.Troops = defArmy.Troops;
                // REALM 다음 조각 (2) — 함락한 성을 플레이 가능한 성으로
                // 들인다. 전후 성벽·병력·훈련·기술은 이 전투가 실제로 남긴
                // 값 그대로(RealmCityState.AbsorbCity() 주석 참고).
                RealmCityState.AbsorbCity(enemyId, enemy.Wall, enemy.Troops, enemy.Train, enemy.Tech);
                message = string.Format(RealmLocalization.T("war.captured", "{0}을(를) 함락했다! (아군 손실 {1}, 적 손실 {2}) — 이제 우리 성입니다"),
                    def.Name, result.LossA, result.LossD);
            }
            else
            {
                // 물러났다 — 살아 돌아온 병력·치중을 출진한 성으로 되돌린다
                // (routed와 "날이 저묾" 둘 다 이 슬라이스에선 같이 취급).
                city.Troops += atk.Troops;
                city.Food += baggage;
                enemy.Troops = defArmy.Troops; // 병력·성벽이 이어져 재도전이 의미 있다.
                message = string.Format(RealmLocalization.T("war.retreated", "물러났다 — 생존 {0}, 적 손실 {1}, 치중 {2} 귀환"),
                    atk.Troops, result.LossD, baggage);
            }

            if (tacticNote != null) message = tacticNote + " " + message;
            if (gridNote != null) message = gridNote + " " + message;

            // PLAN.md 109-15 명마 — 땅 싸움(강가 ✕)에서 명마를 탄 장수가 앞장서면 한 줄 남기고, 싸움터 컷의 돌격 속도를 넘긴다.
            bool water = def.Land == RealmLand.River;
            string mountNote = RealmMounts.Note(officers, water);
            if (mountNote.Length > 0) message = mountNote + " " + message;
            var (mountUsed, _) = RealmMounts.BestFor(officers, water);
            float charge = mountUsed != null ? RealmMounts.ChargeOf(mountUsed.Id) : 1f;

            Changed?.Invoke();
            return new AttackResult(true, message, result.Won, enemyId, troops, atk.Troops, defArmy.Start, defArmy.Troops, charge);
        }

        /// <summary>출진을 막는 까닭(없으면 null) — <see cref="Attack"/> 앞머리 검사 그대로(순서·글), 격자 전술판(`RealmTactics.Open`)도 이것으로
        /// 판을 열지 정한다(R-5 리뷰 — 조건을 두 곳에 베끼지 않게). `enemyId` 는 null 이면 그 성의 목표로, 못 치는 목표면 null 로 바뀐다.</summary>
        public static string MarchBlock(string fromCityId, ref string enemyId)
        {
            if (enemyId == null) enemyId = RealmEnemyCity.TargetFrom(fromCityId);
            else if (!RealmEnemyCity.TargetsFrom(fromCityId).Contains(enemyId)) enemyId = null;
            if (enemyId == null) return RealmLocalization.T("war.err_no_target", "이 성에서는 칠 적국이 없습니다");
            if (_enemies[enemyId].Captured) return RealmLocalization.T("war.err_already_captured", "이미 함락한 성입니다");
            var city = RealmCityState.CityRecord(fromCityId);
            if (city == null) return RealmLocalization.T("war.err_no_target", "이 성에서는 칠 적국이 없습니다");
            if (city.Troops < 500) return RealmLocalization.T("war.err_too_few_troops", "오백은 넘겨야 군대라 하지요");
            int need = Mathf.RoundToInt(city.Troops / 1000f * RealmCityState.FoodPer1000 * 2f);
            if (city.Food < need) return string.Format(RealmLocalization.T("war.err_no_food", "군량이 모자랍니다 ({0} 필요)"), need);
            if (MarchOfficers(fromCityId).Count == 0)
            {
                // 다친 장수만 남았으면 그렇게 말한다(R-5 리뷰 — 같은 장수가 다른 명령은 내릴 수 있어 헷갈렸다).
                int hurt = 0, months = 0;
                foreach (var id in RealmCityState.RosterIds)
                    if (RealmCityState.OfficerCityId(id) == fromCityId && !RealmCityState.IsOfficerDone(id) && RealmCityState.IsHurt(id)) { hurt++; months = Mathf.Max(months, RealmCityState.HurtMonths(id)); }
                return hurt > 0
                    ? string.Format(RealmLocalization.T("war.err_hurt", "이 성 무장은 다쳐 나갈 수 없습니다 (🩹 {0}명 · {1}달)"), hurt, months)
                    : RealmLocalization.T("order.err_no_officer_here", "이 성에서 명령을 쓸 수 있는 무장이 없습니다");
            }
            return null;
        }

        /// <summary>출진할 장수 — 그 성에 있고 이 달 명령을 안 썼고 다치지 않은(tasks U-0098 중상) 우리 장수, 명단 순서.
        /// <see cref="Attack"/> 와 격자 전술판(<see cref="RealmTactics.Open"/>)이 같은 목록을 쓴다.</summary>
        public static List<string> MarchOfficers(string fromCityId)
        {
            var officers = new List<string>();
            foreach (var id in RealmCityState.RosterIds)
            {
                if (RealmCityState.OfficerCityId(id) == fromCityId && !RealmCityState.IsOfficerDone(id) && !RealmCityState.IsHurt(id))
                {
                    officers.Add(id);
                }
            }
            return officers;
        }

        /// <summary>쓰러진 장수는 군주(수도 장수·시작 장수·명단 하나뿐)면 중상, 아니면 전사(명단에서 빠지고 열전) — 웹 tactics.js marchApply.
        /// 둘 다 남은 싸움에서 빠진다. 돌려주는 값은 전투 글 머리.</summary>
        private static string ApplyGrid(RealmTactics.Bonus grid, List<string> officers, string enemyId, string where)
        {
            var hurt = new List<(string id, int months)>(grid.Wounded);
            var dead = new List<string>();
            foreach (var id in grid.Fallen)
            {
                if (IsLord(id)) hurt.Add((id, RealmTactics.WoundMonths)); else dead.Add(id);
            }
            string by = string.Format(RealmLocalization.T("tactics.by", "{0} 수비군"), where);
            string note = string.Format(RealmLocalization.T("tactics.note", "♟️ 전술판 {0} — 공 위력 {1}{2}%{3} —"),
                Kind(grid.Kind), grid.WinPct >= 0 ? "+" : "", grid.WinPct,
                grid.LossMul != 1f ? string.Format(RealmLocalization.T("tactics.note_take", " · 받는 피해 ×{0}"), grid.LossMul) : "");
            foreach (var id in dead)
            {
                string name = RealmOfficerPool.Get(id)?.Name ?? id;
                officers.Remove(id);
                if (RealmCityState.RetireOfficer(id, enemyId, by))
                    note += " " + string.Format(RealmLocalization.T("tactics.fallen", "⚰️ {0} 이(가) {1} 아래에서 쓰러졌다 —"), name, where);
            }
            foreach (var w in hurt)
            {
                officers.Remove(w.id);
                RealmCityState.SetHurt(w.id, Mathf.Max(RealmCityState.HurtMonths(w.id), w.months));
                note += " " + string.Format(RealmLocalization.T("tactics.wounded", "🩹 {0} 이(가) 크게 다쳐 물러났다({1}달) —"), RealmOfficerPool.Get(w.id)?.Name ?? w.id, w.months);
            }
            return note;
        }

        private static string Kind(string kind)
        {
            switch (kind)
            {
                case "rout": return RealmLocalization.T("tactics.rout", "대승");
                case "win": return RealmLocalization.T("tactics.win", "승");
                case "lose": return RealmLocalization.T("tactics.lose", "패");
                default: return RealmLocalization.T("tactics.draw", "무승부");
            }
        }

        /// <summary>군주 — 판이 끝나지 않게 전사 대신 중상(웹 marchApply). 이 트랙엔 군주 칸이 없어 계승(`RealmSuccessionState`)이 보는 수도 장수,
        /// 수도가 비었으면 시작 장수(명단에 있을 때) **한 사람**만 군주로 친다(둘 다 지키면 계승 뒤 군주가 둘이 됐다 — R-5 리뷰). 명단 하나뿐이면 누구든.</summary>
        public static string Lord()
        {
            string cap = RealmSuccessionState.FindCapitalOfficer();
            if (cap != null) return cap;
            foreach (var id in RealmCityState.RosterIds) if (id == RealmOfficerPool.StartingOfficerId) return id;
            return null;
        }

        public static bool IsLord(string id) => RealmCityState.RosterIds.Count <= 1 || id == Lord();

        /// <summary>PLAN.md 101-2 5-6 "지형·진형 전술 개입" — 웹판(`saga-web/saga-realm/PLAN.md`
        /// 107행)은 지형 4종(산·숲·평야·강) 전술 4개 + 진형 수동 선택까지
        /// 전제하지만, 이 트랙엔 성 지형이 <see cref="RealmLand"/> 둘(Plain/River)
        /// 뿐이라 각 지형에 전술 하나씩만 물렸다. "진형 수동 선택"(자동 진형
        /// 대비 페널티 ×0.5)은 이 트랙에 진형 시스템 자체가 없어(`RealmArmy`에
        /// 그런 필드가 없다) 스코프에서 뺐다. 문턱 미달이면 조용히 배율 없이
        /// 진행한다(웹판처럼 "쓸까 말까" 3택이 아니라 이 트랙은 토글 하나뿐이라
        /// 실패해도 공격 자체는 그대로 나간다).</summary>
        private static (float firstRoundMul, float defMul, string note) ResolveTactic(RealmLand land, List<string> officerIds)
        {
            if (land == RealmLand.Plain)
            {
                // 평야 — 기병 돌격(웹판 그대로: 무력 80+, 첫 합 ×1.25).
                int bestMight = 0;
                foreach (var id in officerIds)
                {
                    var o = RealmOfficerPool.Get(id);
                    if (o != null && o.Might > bestMight) bestMight = o.Might;
                }
                return bestMight >= 80
                    ? (1.25f, 1f, RealmLocalization.T("war.tactic_charge_ok", "⚔️ 기병 돌격 성공 —"))
                    : (1f, 1f, RealmLocalization.T("war.tactic_charge_fail", "⚔️ 기병 돌격 실패(무력 80 필요) —"));
            }

            // 강 — 화공(웹판 "숲 화공" 재해석: 지력 60+, 이 슬라이스엔 "한 합"
            // 개념을 밖으로 못 빼내 전투 내내 적 전투력 ×0.85로 옮겼다).
            int bestWisdom = 0;
            foreach (var id in officerIds)
            {
                var o = RealmOfficerPool.Get(id);
                if (o != null && o.Wisdom > bestWisdom) bestWisdom = o.Wisdom;
            }
            return bestWisdom >= 60
                ? (1f, 0.85f, RealmLocalization.T("war.tactic_fire_ok", "🔥 화공 성공 —"))
                : (1f, 1f, RealmLocalization.T("war.tactic_fire_fail", "🔥 화공 실패(지력 60 필요) —"));
        }

        /// <summary>전술 토글 버튼 라벨용 — 이 성에서 나갈 공격이 어느
        /// 지형·전술을 쓰게 될지 미리 보여준다(목표가 없으면 빈 문자열).</summary>
        public static string TacticHintFrom(string fromCityId)
        {
            var enemyId = RealmEnemyCity.TargetFrom(fromCityId);
            if (enemyId == null) return "";
            var def = RealmEnemyCity.Get(enemyId);
            return def.Land == RealmLand.Plain
                ? RealmLocalization.T("war.tactic_hint_plain", "평야: 기병 돌격(무력 80+)")
                : RealmLocalization.T("war.tactic_hint_river", "강: 화공(지력 60+)");
        }

        public readonly struct PlotResult
        {
            public readonly bool Ok;
            public readonly string Message;
            public PlotResult(bool ok, string message) { Ok = ok; Message = message; }
        }

        /// <summary>diplo.js plotChance() 의 일반 갈래(이간·매수가 아닌 것)
        /// 그대로 — 거는 사람 지력 대 막는 사람 지력, 태수가 없으면 30
        /// (원작 기본값, 소패·정도는 처음부터 태수가 없다). 치안 항은 이
        /// 슬라이스의 적 성에 치안 필드가 없어 뺐다(중립값으로 상쇄한
        /// 것과 같다 — RealmPlotData.cs 클래스 주석 참고).</summary>
        private static float PlotChance(RealmOfficer officer) =>
            Mathf.Clamp((0.30f + (officer.Wisdom - 30) / 200f) * RealmOfficerTraits.PlotChanceMultiplier(officer.Id)
                * (1f + (RealmTechData.Pct("plotPct") + RealmTechData.Pct("diploPct")) / 100f), 0.05f, 0.9f); // tasks U-0129 꾀주머니·태학·먼 장사

        /// <summary>계략을 걸 수 있는 무장 — Attack()과 같은 자리(출진
        /// 성)에 배치된, 이 달에 아직 안 쓴 사람 중 지력 최고. UI가 % 미리
        /// 보기에도 쓴다(RealmCommandUi.cs).</summary>
        private static RealmOfficer BestPlotter(string fromCityId)
        {
            RealmOfficer best = null;
            foreach (var id in RealmCityState.RosterIds)
            {
                if (RealmCityState.OfficerCityId(id) != fromCityId) continue;
                if (RealmCityState.IsOfficerDone(id)) continue;
                if (RealmCityState.IsHurt(id)) continue; // tasks U-0098 중상은 계략도 못 꾸민다(웹 hurt — 출진·외교)
                var o = RealmOfficerPool.Get(id);
                if (o == null) continue;
                if (best == null || o.Wisdom > best.Wisdom) best = o;
            }
            return best;
        }

        /// <summary>계략 버튼에 걸기 전 성공률을 보여주기 위한 미리보기 —
        /// 무장이 없으면 0(버튼에 "무장 없음"으로 뜬다).</summary>
        public static float PreviewPlotChance(string fromCityId)
        {
            var officer = BestPlotter(fromCityId);
            return officer == null ? 0f : PlotChance(officer);
        }

        /// <summary>계략을 건다 — diplo.js plot() 을 이 슬라이스 범위로
        /// 좁힌 것. 목표는 Attack()과 같이 fromCityId로 정해진다(목표가
        /// 둘인 성은 `enemyId`를 명시할 것 — Attack()과 같은 이유,
        /// 16차 확장 참고). 이간·매수(적 무장 대상)는 적 성에 무장이
        /// 없어 범위 밖 — RealmPlotData.cs 클래스 주석 참고.</summary>
        public static PlotResult Plot(string kind, string fromCityId, string enemyId = null)
        {
            if (enemyId == null) enemyId = RealmEnemyCity.TargetFrom(fromCityId);
            else if (!RealmEnemyCity.TargetsFrom(fromCityId).Contains(enemyId)) enemyId = null;
            if (enemyId == null) return new PlotResult(false, RealmLocalization.T("plot.err_no_target", "이 성에서는 계략을 걸 적국이 없습니다"));

            var enemy = _enemies[enemyId];
            if (enemy.Captured) return new PlotResult(false, RealmLocalization.T("war.err_already_captured", "이미 함락한 성입니다"));

            var plot = RealmPlotData.Get(kind);
            if (plot == null) return new PlotResult(false, RealmLocalization.T("plot.err_unknown", "없는 계략"));

            var officer = BestPlotter(fromCityId);
            if (officer == null) return new PlotResult(false, RealmLocalization.T("plot.err_no_officer_here", "이 성에서 계략을 쓸 수 있는 무장이 없습니다"));
            if (!RealmCityState.TrySpendGold(plot.Gold)) return new PlotResult(false, RealmLocalization.T("order.err_no_gold", "금이 모자랍니다"));

            RealmCityState.MarkOfficerDone(officer.Id);
            float chance = PlotChance(officer);
            string message;
            if (UnityEngine.Random.value > chance)
            {
                message = string.Format(RealmLocalization.T("plot.failed", "{0} {1} — 들통났다 (성공률 {2}%였다)"),
                    plot.Emoji, plot.Name, Mathf.RoundToInt(chance * 100f));
            }
            else
            {
                var def = RealmEnemyCity.Get(enemyId);
                string effect = kind == "rumor" ? ApplyRumor(enemy, def.Name) : ApplyFire(enemy, def.Name);
                message = string.Format(RealmLocalization.T("plot.succeeded", "{0} {1} 성공 — {2}"), plot.Emoji, plot.Name, effect);
            }

            Changed?.Invoke();
            return new PlotResult(true, message);
        }

        /// <summary>유언비어 — 원작은 치안을 깎지만(sec 필드 없음, 클래스
        /// 주석 참고) 훈련도를 깎아 실제로 다음 전투(RealmWar.ArmyPower)에
        /// 반영되게 재해석했다. 낙폭도 원작 수치(10+rand(12)) 그대로.</summary>
        private static string ApplyRumor(RealmEnemyRecord enemy, string enemyName)
        {
            int before = enemy.Train;
            int drop = 10 + UnityEngine.Random.Range(0, 12);
            enemy.Train = Mathf.Max(0, enemy.Train - drop);
            return string.Format(RealmLocalization.T("plot.rumor_effect", "{0} 훈련도 {1} → {2}"), enemyName, before, enemy.Train);
        }

        /// <summary>화계 — 원작은 군량을 태우지만(적 성에 군량 필드 없음)
        /// 병력을 그만큼 직접 깎아 재해석했다. 비율도 원작(25~55%) 그대로.</summary>
        private static string ApplyFire(RealmEnemyRecord enemy, string enemyName)
        {
            int before = enemy.Troops;
            float frac = 0.25f + UnityEngine.Random.value * 0.3f;
            int burned = Mathf.RoundToInt(enemy.Troops * frac);
            enemy.Troops = Mathf.Max(0, enemy.Troops - burned);
            return string.Format(RealmLocalization.T("plot.fire_effect", "{0} 병력 {1} → {2} ({3} 소실)"), enemyName, before, enemy.Troops, burned);
        }

        public static (int wall, int maxWall, int troops, int train, int tech, bool captured) Snapshot(string enemyId)
        {
            var e = Get(enemyId);
            return e == null ? (0, 0, 0, 0, 0, false) : (e.Wall, e.MaxWall, e.Troops, e.Train, e.Tech, e.Captured);
        }

        public static void Restore(string enemyId, int wall, int maxWall, int troops, int train, int tech, bool captured)
        {
            _enemies[enemyId] = new RealmEnemyRecord { Wall = wall, MaxWall = maxWall, Troops = troops, Train = train, Tech = tech, Captured = captured };
            Changed?.Invoke();
        }
    }
}
