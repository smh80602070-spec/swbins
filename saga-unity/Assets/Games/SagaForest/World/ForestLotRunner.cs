using System.Collections.Generic;
using TMPro;
using UnityEngine;
using UnityEngine.UI;
using Saga.Core;
using Saga.Forest.Data;
using Saga.Forest.UI;

namespace Saga.Forest.World
{
    /// <summary>
    /// tasks U-0127 입주 조건 실행기(웹 사가마을 W-0284) — `ForestBootstrap.Start` 가 Play 때 세운다(씬 재빌드 없음).
    /// ① 작은 빈 집 모습: 내 집 껍데기(`ForestHouse.BuildShell`)를 ×0.55 로 줄여 광장 둘레 눌러앉기 자리 끝 셋에서 바깥으로 2.2m(충돌 없음).
    /// ② 1초마다 `ForestLots.Tick(오늘)` — 날이 넘어가 손님이 눌러앉으면 알림(손님 몸은 `ForestVisitorRunner` 가 명단 수가 바뀐 걸 보고 세운다).
    /// ③ 창: 제작대 창의 "🏠 빈 집" 단추가 연다 — 짓기(열매) · 집마다 태그·힌트·가구 · 창고 가구 고르기(누를 때마다 다음)·넣기·빼기(마지막).
    /// </summary>
    public class ForestLotRunner : MonoBehaviour
    {
        public const float HouseScale = 0.55f, OutsetM = 2.2f;
        public static ForestLotRunner Instance { get; private set; }

        private readonly List<GameObject> _houses = new List<GameObject>();
        private int _builtCount = -1;
        private float _checkLeft;
        private GameObject _panel;
        private TextMeshProUGUI _title;
        private Button _build;
        private readonly TextMeshProUGUI[] _info = new TextMeshProUGUI[ForestLots.MaxLots];
        private readonly Button[] _pick = new Button[ForestLots.MaxLots], _put = new Button[ForestLots.MaxLots], _take = new Button[ForestLots.MaxLots];
        private int _pickIndex;

        public bool IsOpen => _panel != null && _panel.activeSelf;
        public IReadOnlyList<GameObject> Houses => _houses;
        /// <summary>진단 — 마지막으로 눌러앉은 손님 키.</summary>
        public string LastSettled { get; private set; }

        public static ForestLotRunner Install()
        {
            if (Instance != null) return Instance;
            return new GameObject("ForestLots").AddComponent<ForestLotRunner>();
        }

        /// <summary>집 i 자리(world XZ) — 눌러앉기 자리 끝에서부터, 광장 한가운데에서 바깥으로 밀어.</summary>
        public static Vector2 LotSpot(int i)
        {
            var spots = ForestVisitors.SettleSpots;
            Vector2 s = spots[spots.Length - 1 - i];
            Vector2 d = s - ForestVisitors.Spot;
            return s + (d.sqrMagnitude > 1e-4f ? d.normalized : Vector2.up) * OutsetM;
        }

        private void Awake()
        {
            Instance = this;
            BuildUi();
            ForestLots.Changed += OnChanged;
            ForestHomeState.Changed += OnChanged;
            RebuildHouses();
        }

        private void OnDestroy()
        {
            ForestLots.Changed -= OnChanged;
            ForestHomeState.Changed -= OnChanged;
            if (Instance == this) Instance = null;
        }

        private void OnChanged()
        {
            if (ForestLots.Count != _builtCount) RebuildHouses();
            Refresh();
        }

        private void Update()
        {
            _checkLeft -= Time.deltaTime;
            if (_checkLeft > 0f) return;
            _checkLeft = 1f;
            CheckDay();
        }

        /// <summary>날 바뀜 굴리기 — 진단은 날을 바꾼 뒤 직접 부른다.</summary>
        public string CheckDay()
        {
            string who = ForestLots.Tick(ForestVisitors.Today);
            if (who == null) return null;
            LastSettled = who;
            var v = ForestVisitors.List[ForestVisitors.IndexOf(who)];
            DialogueLabel.Instance?.Show(string.Format(ForestLocalization.T("lot.settled", "🏡 {0} {1}이(가) 꾸며 둔 집에 눌러앉았다"), v.Emoji, ForestVisitors.Name(v)), 4f);
            return who;
        }

        public void RebuildHouses()
        {
            foreach (var h in _houses) if (h != null) DestroyImmediate(h);
            _houses.Clear();
            _builtCount = ForestLots.Count;
            for (int i = 0; i < ForestLots.Count; i++)
            {
                var go = new GameObject($"SmallHouse_{i}");
                go.transform.SetParent(transform, false);
                var at = LotSpot(i);
                go.transform.position = new Vector3(at.x, 0f, at.y);
                Vector2 toPlaza = ForestVisitors.Spot - at;
                go.transform.rotation = Quaternion.LookRotation(new Vector3(-toPlaza.x, 0f, -toPlaza.y)); // 문(−Z)이 광장 쪽
                go.transform.localScale = Vector3.one * HouseScale;
                ForestHouse.BuildShell(go.transform, false);
                _houses.Add(go);
            }
        }

        // ---- 창 ----

        private void BuildUi()
        {
            SagaUi.EnsureEventSystem();
            var canvas = SagaUi.NewHudCanvas("LotCanvas", 95, transform);
            _panel = SagaUi.NewPanel(canvas.transform, "LotPanel", new Vector2(0.5f, 0.5f), Vector2.zero, new Vector2(940f, 760f), SagaUi.Panel).gameObject;
            _title = SagaUi.NewText(_panel.transform, "", 32f, SagaUi.Gold, new Vector2(0.5f, 1f), new Vector2(0f, -30f), new Vector2(880f, 56f));
            _build = SagaUi.NewButton(_panel.transform, "LotBuild", "", new Vector2(0.5f, 1f), new Vector2(0f, -96f), new Vector2(420f, 56f), SagaUi.ButtonAccent, 24f);
            _build.onClick.AddListener(PressBuild);
            for (int i = 0; i < ForestLots.MaxLots; i++)
            {
                int k = i;
                float y0 = -168f - 172f * i;
                _info[i] = SagaUi.NewText(_panel.transform, "", 21f, SagaUi.Ink, new Vector2(0.5f, 1f), new Vector2(0f, y0), new Vector2(880f, 76f));
                _pick[i] = SagaUi.NewButton(_panel.transform, $"LotPick{i}", "", new Vector2(0.5f, 1f), new Vector2(-170f, y0 - 84f), new Vector2(400f, 56f), SagaUi.ButtonIdle, 22f);
                _pick[i].onClick.AddListener(PressPick);
                _put[i] = SagaUi.NewButton(_panel.transform, $"LotPut{i}", "", new Vector2(0.5f, 1f), new Vector2(130f, y0 - 84f), new Vector2(180f, 56f), SagaUi.ButtonAccent, 22f);
                _put[i].onClick.AddListener(() => PressPut(k));
                _take[i] = SagaUi.NewButton(_panel.transform, $"LotTake{i}", "", new Vector2(0.5f, 1f), new Vector2(330f, y0 - 84f), new Vector2(180f, 56f), SagaUi.ButtonIdle, 22f);
                _take[i].onClick.AddListener(() => PressTake(k));
            }
            var close = SagaUi.NewButton(_panel.transform, "LotClose", ForestLocalization.T("hand.close", "닫기"), new Vector2(0.5f, 0f), new Vector2(0f, 20f), new Vector2(240f, 56f), SagaUi.ButtonIdle, 24f);
            close.onClick.AddListener(Close);
            _panel.SetActive(false);
        }

        public void Open() { if (_panel == null) return; _panel.SetActive(true); Refresh(); }
        public void Close() { if (_panel != null) _panel.SetActive(false); }

        /// <summary>창고에 있는 가구 id(값 순 아님 — 표 순).</summary>
        public static List<string> StockIds()
        {
            var o = new List<string>();
            foreach (var f in FurnitureItem.All) if (ForestHomeState.StockCount(f.Id) > 0) o.Add(f.Id);
            return o;
        }

        public string PickedId { get { var s = StockIds(); return s.Count == 0 ? null : s[((_pickIndex % s.Count) + s.Count) % s.Count]; } }

        public void Refresh()
        {
            if (_panel == null || !_panel.activeSelf) return;
            _title.text = string.Format(ForestLocalization.T("lot.title", "작은 빈 집 {0}/{1} — 서로 다른 태그 셋이면 다음 날 손님이 눌러앉는다"), ForestLots.Count, ForestLots.MaxLots);
            _build.GetComponentInChildren<TMP_Text>().text = string.Format(ForestLocalization.T("lot.build", "🏠 빈 집 짓기 (열매 {0})"), ForestLots.BuildFruit);
            _build.interactable = ForestLots.Count < ForestLots.MaxLots;
            string pick = PickedId;
            var pf = FurnitureItem.Get(pick);
            for (int i = 0; i < ForestLots.MaxLots; i++)
            {
                bool has = i < ForestLots.Count;
                _info[i].gameObject.SetActive(has);
                bool open = has && string.IsNullOrEmpty(ForestLots.List[i].who);
                _pick[i].gameObject.SetActive(open);
                _put[i].gameObject.SetActive(open);
                _take[i].gameObject.SetActive(open && ForestLots.List[i].furn.Count > 0);
                if (!has) continue;
                var tags = ForestLots.TagsOf(i);
                var tn = new List<string>();
                foreach (var t in tags) tn.Add(ForestLots.TagName(t));
                var fn = new List<string>();
                foreach (var k in ForestLots.List[i].furn) { var f = FurnitureItem.Get(k); fn.Add(f != null ? f.Name : k); }
                _info[i].text = string.Format(ForestLocalization.T("lot.row", "🏠 {0}번째 집 — {1}\n태그 {2} · 가구 {3}"), i + 1, ForestLots.HintFor(i),
                    tn.Count > 0 ? string.Join("·", tn) : "-", fn.Count > 0 ? string.Join(", ", fn) : "-");
                if (!open) continue;
                _pick[i].GetComponentInChildren<TMP_Text>().text = pf != null
                    ? $"◀ {pf.Name} ({ForestLots.TagName(ForestLots.TagOf(pick))}) ×{ForestHomeState.StockCount(pick)} ▶"
                    : ForestLocalization.T("lot.no_stock", "창고에 가구가 없다");
                _put[i].GetComponentInChildren<TMP_Text>().text = ForestLocalization.T("lot.put", "넣기");
                _put[i].interactable = pf != null;
                _take[i].GetComponentInChildren<TMP_Text>().text = ForestLocalization.T("lot.take", "빼기");
            }
        }

        public void PressBuild()
        {
            string why = ForestLots.Build();
            DialogueLabel.Instance?.Show(why == null ? ForestLocalization.T("lot.built", "🏠 작은 빈 집을 지었다 — 가구를 넣어 손님을 부르자")
                : why == "lot.why_fruit" ? string.Format(ForestLocalization.T("lot.why_fruit", "열매가 모자라다 (필요 {0}개)"), ForestLots.BuildFruit)
                : string.Format(ForestLocalization.T("lot.why_max", "빈 집은 {0}채까지"), ForestLots.MaxLots), 2.5f);
            Refresh();
        }

        public void PressPick() { _pickIndex++; Refresh(); }

        public void PressPut(int i)
        {
            string id = PickedId;
            string why = id == null ? "lot.why_stock" : ForestLots.Put(i, id);
            DialogueLabel.Instance?.Show(why == null ? ForestLocalization.T("lot.put_ok", "🪑 넣었다") + " — " + ForestLots.HintFor(i)
                : ForestLocalization.T(why, "넣을 수 없다"), 2.5f);
            Refresh();
        }

        public void PressTake(int i)
        {
            var furn = i >= 0 && i < ForestLots.Count ? ForestLots.List[i].furn : null;
            if (furn != null && furn.Count > 0 && ForestLots.Take(i, furn[furn.Count - 1]))
                DialogueLabel.Instance?.Show(ForestLocalization.T("lot.take_ok", "🪑 창고로 거두었다"), 2f);
            Refresh();
        }
    }
}
