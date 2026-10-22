using System.Collections.Generic;
using TMPro;
using UnityEngine;
using UnityEngine.UI;
using Saga.Realm.Data;

namespace Saga.Realm.UI
{
    /// <summary>
    /// tasks U-0167 5천하 "시정 위임"(웹 `saga-realm/js/auto-rule.js` W-0338 · 고돗 G-0299 `auto_rule_realm.gd` 짝) — 걷기가 없는 판의 자동 퀘스트 자리.
    /// 켜 두면 켤 때와 달이 바뀔 때 한 번, 다스리는 성마다(이 달 명령을 아직 안 낸 성만) 내정 하나를 내린다:
    /// 치안이 <see cref="SecFloor"/> 밑이면 치안, 아니면 상한 대비 가장 모자란 개간·상업·기술·치안(다 찼으면 안 냄).
    /// 금은 켠 때 금·<see cref="GoldKeepMax"/> 중 작은 것 밑으로 안 쓴다. 명령 효과·비용·장수 고르기는 <see cref="RealmCityState.ExecuteOrder"/> 그대로(공개 함수만).
    /// 다음 달 넘기기·징병·외교·출진은 사람 몫(고돗과 같은 규칙). 켬/끔은 세이브에 안 남긴다(판을 다시 열면 꺼짐).
    /// 판이 끝난 뒤(통일·문화)는 따로 안 막는다 — 회차 다시 시작은 「다음 달」 단추 몫이고, 명령 자체는 그때도 그대로 먹는다.
    /// `RealmCommandUi.Start` 가 붙인다 — 오른쪽 기둥 맨 밑 칸(☰ 메뉴가 당겨 비운 −580).
    /// </summary>
    public class RealmAutoRule : MonoBehaviour
    {
        public const int SecFloor = 45, GoldKeepMax = 900;
        public static readonly string[] DevKeys = { "agri", "comm", "tech", "sec" };
        public static readonly Vector2 ButtonPos = new Vector2(-110f, -580f);

        public static RealmAutoRule Instance { get; private set; }
        public bool On { get; private set; }
        public int GoldFloor { get; private set; }
        public Button ToggleButton { get; private set; }
        /// <summary>마지막으로 돈 달의 명령 수·글(진단·토스트).</summary>
        public int LastCount { get; private set; }
        public readonly List<string> LastLines = new List<string>();
        /// <summary>마지막 달에 건너뛴 까닭 하나(진단 — 성·까닭).</summary>
        public string LastSkip { get; private set; } = "";
        private TextMeshProUGUI _label;
        private int _y, _m;
        private bool _running;

        public static RealmAutoRule Attach(Transform canvas, GameObject host)
        {
            if (Instance != null) return Instance;
            var r = host.AddComponent<RealmAutoRule>();
            // 이름 Btn_▶ = 모드 단추 — UiLayoutCheck 가 누르지 않는다(켜면 뒤에서 명령을 내 다음 상태를 흔든다, U-0163)
            r.ToggleButton = RealmUiKit.NewButton(canvas, "", new Vector2(1f, 1f), ButtonPos, new Vector2(180f, 104f), r.Toggle);
            r.ToggleButton.name = "Btn_▶";
            r._label = r.ToggleButton.GetComponentInChildren<TextMeshProUGUI>();
            r.Paint();
            return r;
        }

        private void Awake() => Instance = this;

        private void OnEnable() => RealmCityState.Changed += OnChanged;

        private void OnDisable() => RealmCityState.Changed -= OnChanged;

        private void OnDestroy() { if (Instance == this) Instance = null; }

        public void Toggle() => SetOn(!On);

        public void SetOn(bool on)
        {
            if (on == On) return;
            On = on;
            if (On)
            {
                GoldFloor = Mathf.Min(RealmCityState.Gold, GoldKeepMax);
                _y = RealmCityState.Year; _m = RealmCityState.Month;
                RunMonth();
            }
            Paint();
            RealmToast.Instance?.Show(On
                ? string.Format(RealmLocalization.T("aq.rule_on", "🌾 시정 위임 켬 — 금 {0} 밑으로는 안 쓴다 · 이 달 {1}곳"), GoldFloor, LastCount)
                : RealmLocalization.T("aq.rule_off", "🌾 시정 위임 끔"), 3f);
        }

        private void Paint()
        {
            if (_label != null) _label.text = On ? RealmLocalization.T("aq.rule_btn_on", "🌾 위임 ■") : RealmLocalization.T("aq.rule_btn", "🌾 위임 ▶");
        }

        private void OnChanged()
        {
            if (!On || _running) return;
            if (RealmCityState.Year == _y && RealmCityState.Month == _m) return;
            _y = RealmCityState.Year; _m = RealmCityState.Month;
            RunMonth();
            if (LastCount > 0) RealmToast.Instance?.Show(string.Format(RealmLocalization.T("aq.rule_month", "🌾 시정 위임 — {0}곳 내정"), LastCount) + "\n" + string.Join("\n", LastLines), 4f);
        }

        /// <summary>그 성에 내릴 명령 — 치안 낮으면 치안, 아니면 상한 대비 가장 모자란 것(다 찼으면 null).</summary>
        public static string Pick(RealmCityRecord r, System.Func<string, int> cap)
        {
            if (r == null) return null;
            int secCap = cap("sec");
            if (r.Sec < SecFloor && r.Sec < secCap) return "sec";
            string best = null;
            float bf = 1f;
            foreach (var k in DevKeys)
            {
                int c = cap(k);
                if (c <= 0) continue;
                float f = Value(r, k) / (float)c;
                if (f < bf) { bf = f; best = k; }
            }
            return best;
        }

        private static int Value(RealmCityRecord r, string key) => key switch
        {
            "agri" => r.Agri,
            "comm" => r.Comm,
            "tech" => r.Tech,
            "sec" => r.Sec,
            _ => 0,
        };

        /// <summary>이 달 한 번 — 성마다 하나씩(이미 낸 성·금 바닥·고를 것 없음은 건너뜀). 지금 성은 끝나면 되돌린다.</summary>
        public int RunMonth()
        {
            LastCount = 0;
            LastLines.Clear();
            LastSkip = "";
            _running = true;
            string here = RealmCityState.CurrentCity;
            try
            {
                foreach (var id in new List<string>(RealmCityState.ActiveCityIds))
                {
                    if (RealmCityState.OrderThisMonth(id) != null) continue;
                    string key = Pick(RealmCityState.CityRecord(id), k => RealmCityState.CapFor(k, id));
                    if (key == null) { LastSkip = id + " 다 참"; continue; }
                    int cost = RealmTechData.Cost(key, RealmOrderData.Get(key).Gold);
                    if (RealmCityState.Gold - cost < GoldFloor) { LastSkip = id + " 금 바닥"; continue; }
                    RealmCityState.SetCurrentCity(id);
                    var res = RealmCityState.ExecuteOrder(key);
                    if (!res.Ok) { LastSkip = $"{id} {key} {res.Message}"; continue; }
                    LastCount++;
                    LastLines.Add($"{RealmCityData.Get(id)?.Name ?? id} — {res.Message}");
                }
            }
            finally
            {
                RealmCityState.SetCurrentCity(here);
                _running = false;
            }
            return LastCount;
        }
    }
}
