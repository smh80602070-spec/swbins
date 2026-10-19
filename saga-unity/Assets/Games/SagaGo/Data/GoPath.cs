using System;
using System.Collections.Generic;
using UnityEngine;

namespace Saga.Go.Data
{
    /// <summary>
    /// tasks U-0130 길 행동(웹 사가만리 W-0276 `talk.js` 99~193 · 고돗 G-0240 `path_action.gd`) — 순수 데이터.
    /// 들판 선두 동행(`PartyState.FieldIds()[0]` — 주인공 바로 뒤 자리)의 무력·지력·통솔 중 가장 높은 축이 마을 사람에게 하는 한 가지:
    /// 지력 → 조사(가장 가까운 숨은 터 방위·거리) · 무력 → 도발(산적 하나, 체력 = 공격 ×14, 이기면 경험 +30) · 통솔 → 이끌기(40m 넘는 가장 가까운 길목으로 앞장, 30초 뒤 귀가).
    /// 사람마다 하루 한 번(새벽 4시에 갈림 — `GoTrack.DayKey`), 조사·이끌기 30% 거절, 도발은 지면 거절 → 그날 말 안 섞음(-1).
    /// 세이브 `goPathDay`·`goPathUsed`("id=1"/"id=-1", 버전 그대로 — 옛 세이브는 빈 채). 날짜(`NowFn`)·굴림(`Rng`)은 주입.
    /// </summary>
    public static class GoPath
    {
        public enum Act { None, Probe, Provoke, Lead }

        public const float FailChance = 0.3f;      // 웹 talk.pathFail
        public const float ProvokeHpMul = 14f;     // 웹 talk.provokeHpMul
        public const int ProvokeExp = 30;          // 웹은 금 +30 → 이 트랙은 경험(티켓)
        public const float ProvokeLimitSec = 60f;  // 60초 안에 못 꺾으면 진 것
        public const float LeadMinDist = 40f;
        public const float LeadSec = 30f;
        public const float LeadSpeed = 4.5f;
        public const float NearRadius = 14f;       // 주민 대화 반경(NpcBuilder TalkRadius)

        public static Func<DateTime> NowFn = () => DateTime.Now;
        public static Func<float> Rng = () => UnityEngine.Random.value;

        public static string Day { get; private set; } = "";
        private static readonly Dictionary<string, int> _used = new Dictionary<string, int>();
        public static event Action Changed;

        /// <summary>가장 높은 축 — 같으면 지력 → 무력 → 통솔 순(웹 pathOf 그대로).</summary>
        public static Act ActOf(int might, int wisdom, int command)
        {
            Act k = Act.Probe; int best = wisdom;
            if (might > best) { k = Act.Provoke; best = might; }
            if (command > best) k = Act.Lead;
            return k;
        }

        public static string LeadId()
        {
            var f = PartyState.FieldIds();
            return f.Count > 0 ? f[0] : null;
        }

        /// <summary>지금 선두 동행의 길 행동(동행이 없으면 None).</summary>
        public static Act Current(out string heroId)
        {
            heroId = LeadId();
            if (heroId == null || !GoHeroes.TryGet(heroId, out var h)) return Act.None;
            return ActOf(h.Might, h.Wisdom, h.Command);
        }

        public static void Roll()
        {
            string today = GoTrack.DayKey(NowFn());
            if (today == Day) return;
            Day = today;
            _used.Clear();
            Changed?.Invoke();
        }

        /// <summary>0 아직 · 1 오늘 했다 · -1 거절(오늘 말을 안 섞는다).</summary>
        public static int Used(string id) { Roll(); return id != null && _used.TryGetValue(id, out int v) ? v : 0; }

        public static void Mark(string id, int v)
        {
            Roll();
            if (string.IsNullOrEmpty(id)) return;
            _used[id] = v;
            Changed?.Invoke();
        }

        /// <summary>조사·이끌기만 거절 굴림(도발은 싸움 결과가 거절).</summary>
        public static bool RollRefuse(Act a) => a != Act.Provoke && Rng() < FailChance;

        public static float ProvokeHp(float atk) => Mathf.Max(1f, Mathf.Round(atk * ProvokeHpMul));

        /// <summary>8방위 — 북 = -z(지도 gy 가 작을수록 북쪽).</summary>
        public static string Compass(Vector3 from, Vector3 to)
        {
            float a = Mathf.Atan2(to.x - from.x, -(to.z - from.z)) * Mathf.Rad2Deg;
            if (a < 0f) a += 360f;
            string[] k = { "n", "ne", "e", "se", "s", "sw", "w", "nw" };
            string[] ko = { "북", "북동", "동", "남동", "남", "남서", "서", "북서" };
            int i = Mathf.RoundToInt(a / 45f) % 8;
            return GoLocalization.T("path.dir." + k[i], ko[i]);
        }

        /// <summary>가장 가까운 숨은 터(보이는 입구 전부).</summary>
        public static bool NearestGate(Vector3 p, out GoDomain.Site site, out float dist)
        {
            site = default; dist = float.MaxValue; bool any = false;
            foreach (var s in GoDomain.Gates())
            {
                Vector3 q = s.Pos;
                float d = new Vector2(q.x - p.x, q.z - p.z).magnitude;
                if (d < dist) { dist = d; site = s; any = true; }
            }
            return any;
        }

        /// <summary>40m 넘는 가장 가까운 길목(역참).</summary>
        public static bool LeadTarget(Vector3 p, out GoWorldMap.Waypoint wp, out Vector3 pos, out float dist)
        {
            wp = default; pos = Vector3.zero; dist = float.MaxValue; bool any = false;
            foreach (var w in GoWorldMap.Waypoints)
            {
                Vector3 q = GoWorldMap.WaypointPos(w);
                float d = new Vector2(q.x - p.x, q.z - p.z).magnitude;
                if (d > LeadMinDist && d < dist) { dist = d; wp = w; pos = q; any = true; }
            }
            return any;
        }

        public static string Icon(Act a) => a == Act.Probe ? "🔎" : a == Act.Provoke ? "⚔️" : a == Act.Lead ? "🧭" : "";
        public static string Name(Act a) => a == Act.Probe ? GoLocalization.T("path.probe", "조사")
            : a == Act.Provoke ? GoLocalization.T("path.provoke", "도발")
            : a == Act.Lead ? GoLocalization.T("path.lead", "이끌기") : "";

        public static List<string> Snapshot()
        {
            Roll();
            var l = new List<string>();
            foreach (var kv in _used) l.Add(kv.Key + "=" + kv.Value);
            l.Sort(string.CompareOrdinal);
            return l;
        }

        public static void Restore(string day, IEnumerable<string> used)
        {
            Day = day ?? "";
            _used.Clear();
            if (used != null)
                foreach (var s in used)
                {
                    int i = s != null ? s.LastIndexOf('=') : -1;
                    if (i > 0 && int.TryParse(s.Substring(i + 1), out int v)) _used[s.Substring(0, i)] = v;
                }
            Roll();
            Changed?.Invoke();
        }
    }
}
