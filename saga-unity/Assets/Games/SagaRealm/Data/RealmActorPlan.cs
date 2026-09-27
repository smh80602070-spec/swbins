using System;
using System.Collections.Generic;

namespace Saga.Realm.Data
{
    /// <summary>
    /// PLAN.md 109-13-2 "지도 위 실제 인물·모션" — 웹 사가국지 §5-10 `actorPlan(state)` 의 이 트랙 판(순수 함수, 세이브 없음).
    /// 누가·어디서·무슨 동작: ② 태수 — 우리 성마다 그 성에 선 무장 하나(이 달 그 성에서 명령을 낸 사람, 없으면 통솔 높은 사람)가
    /// 이 달 명령에 맞춘 몸짓(`MapClip`: 개간 괭이질·상업 흥정·훈련 칼 휘두름·등용 읍·축성 망치, 그 밖은 서기) ·
    /// ④ 재야 — 수색으로 찾았지만 아직 안 들인 사람이 제 성 둘레를 느리게 걷는다.
    /// 웹 ① 원정군(달을 넘는 행군 보간)은 이 트랙 출진이 그 자리에서 끝나 뺐다 — 맞붙는 두 장수(웹 ③)는 싸움터 컷(`RealmBattlefield`)이 맡는다.
    /// 한 화면 상한 24(태수 먼저 → 재야), 손잡이 <see cref="Enabled"/> 가 꺼지면 빈 목록(옛 지도).
    /// </summary>
    public static class RealmActorPlan
    {
        public const int Cap = 24;

        /// <summary>웹 손잡이 `realm3d.actors` — 끄면 지도에 배우가 없다(옛 지도).</summary>
        public static bool Enabled = true;

        public enum Kind { Governor, Wanderer }

        public readonly struct Actor
        {
            public readonly Kind Kind;
            public readonly string OfficerId;
            public readonly string CityId;
            public readonly string Clip;
            public Actor(Kind kind, string officerId, string cityId, string clip) { Kind = kind; OfficerId = officerId; CityId = cityId; Clip = clip; }
        }

        /// <summary>동작 이름 전부 — 지금은 도형 대역(`RealmFigure`)이 코드로 짓고, 몸이 붙으면 같은 이름의 클립을 찾는다.</summary>
        public static readonly string[] Clips = { "idle", "walk", "hoe", "haggle", "swing", "bow", "hammer", "attack", "hit", "die" };

        /// <summary>명령 → 태수 몸짓(웹 `mapClips` 표). 표에 없는 명령·명령 없음은 서기.</summary>
        public static string MapClip(string orderKey) => orderKey switch
        {
            "agri" => "hoe",
            "comm" => "haggle",
            "train" => "swing",
            "hire" => "bow",
            "wall" => "hammer",
            _ => "idle",
        };

        /// <summary>순수 판 — 입력만으로 정한다(진단이 가짜 입력으로 상한을 본다).</summary>
        /// <param name="cities">우리 성, 이 순서대로 태수를 세운다.</param>
        /// <param name="governorOf">성 → 태수 무장 id(없으면 null).</param>
        /// <param name="orderOf">성 → 이 달 그 성의 명령 키(없으면 null).</param>
        /// <param name="wanderers">(무장 id, 떠도는 성) — 들인 순서대로.</param>
        public static List<Actor> Plan(IReadOnlyList<string> cities, Func<string, string> governorOf, Func<string, string> orderOf,
            IEnumerable<(string officerId, string cityId)> wanderers, bool enabled = true)
        {
            var list = new List<Actor>();
            if (!enabled) return list;
            foreach (var city in cities)
            {
                if (list.Count >= Cap) return list;
                string gov = governorOf(city);
                if (gov == null) continue;
                list.Add(new Actor(Kind.Governor, gov, city, MapClip(orderOf(city))));
            }
            foreach (var (officer, city) in wanderers)
            {
                if (list.Count >= Cap) break;
                list.Add(new Actor(Kind.Wanderer, officer, city, "walk"));
            }
            return list;
        }

        /// <summary>지금 판 상태로 짠다.</summary>
        public static List<Actor> FromState()
        {
            return Plan(RealmCityState.ActiveCityIds, GovernorOf, RealmCityState.OrderThisMonth, Wanderers(), Enabled);
        }

        /// <summary>태수 — 이 달 그 성에서 명령을 낸 무장, 없으면 그 성에 선 무장 중 통솔 높은 사람(같으면 id 순).</summary>
        public static string GovernorOf(string cityId)
        {
            string acted = RealmCityState.OrderOfficerThisMonth(cityId);
            if (acted != null && RealmCityState.OfficerCityId(acted) == cityId) return acted;
            string best = null;
            int bestCmd = -1;
            foreach (var id in RealmCityState.RosterIds)
            {
                if (RealmCityState.OfficerCityId(id) != cityId) continue;
                var o = RealmOfficerPool.Get(id);
                if (o == null) continue;
                if (o.Command > bestCmd || (o.Command == bestCmd && string.CompareOrdinal(id, best) < 0)) { best = id; bestCmd = o.Command; }
            }
            return best;
        }

        /// <summary>찾았지만 안 들인 재야 — 묻힌 성이 우리 성일 때만(지도엔 우리 성만 있다). 이름 순으로 늘 같게.</summary>
        public static List<(string officerId, string cityId)> Wanderers()
        {
            var ids = new List<string>();
            foreach (var id in RealmCityState.FoundIds)
                if (!Contains(RealmCityState.RosterIds, id)) ids.Add(id);
            ids.Sort(string.CompareOrdinal);
            var list = new List<(string, string)>();
            foreach (var id in ids)
            {
                foreach (var city in RealmCityState.ActiveCityIds)
                {
                    if (Array.IndexOf(RealmOfficerPool.HiddenAt(city), id) < 0) continue;
                    list.Add((id, city));
                    break;
                }
            }
            return list;
        }

        private static bool Contains(IReadOnlyList<string> list, string id)
        {
            for (int i = 0; i < list.Count; i++) if (list[i] == id) return true;
            return false;
        }
    }
}
