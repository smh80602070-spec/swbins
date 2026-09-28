using TMPro;
using System.Collections.Generic;
using UnityEngine;
using UnityEngine.InputSystem;
using UnityEngine.UI;
using Saga.Go.Combat;
using Saga.Go.Data;
using Saga.Go.Player;

namespace Saga.Go.UI
{
    /// <summary>
    /// PLAN.md 107-3 "M 지도 화면" + "지역 이름" — `WorldMapBuilder` 가 Play 때 붙인다(런타임 생성 → 런타임 리스너).
    /// - M 키·오른쪽 위 "지도" 버튼으로 연다/닫는다. 글자 지도 칸 색으로 그린 텍스처(물은 푸르게, 산은 높이로 명암),
    ///   발 디딘 적 없는 지역은 어둡다(옛 망루 꼭대기에 서면 전부 밝힘). 플레이어 화살표·지역 이름·옛 망루·
    ///   순간이동 지점(활성 = 푸른 ◆, 누르면 그 자리로 순간이동, 결투 중엔 안 됨).
    /// - 지역 경계를 넘으면 가운데 위에 지역 이름(처음이면 "새 지역").
    /// </summary>
    public class WorldMapUi : MonoBehaviour
    {
        private const int TilePx = 8;
        // 110 ⑤c-2 — 지도는 왼쪽(높이 MapMaxH), 제목·지역 글·안내·닫기는 오른쪽 열(ColX). 예전엔 가운데 860 폭이라 세로가 화면을 넘었다.
        private const float MapMaxH = 820f;
        private const float ColX = 430f;
        private float MapW = 860f;
        private const float RegionCheckSec = 0.4f;

        public static WorldMapUi Instance { get; private set; }

        private GameObject _panel;
        private RawImage _mapImage;
        private Texture2D _tex;
        private RectTransform _mapRect;
        private RectTransform _arrow;
        private readonly List<Button> _wpButtons = new List<Button>();
        private readonly List<TextMeshProUGUI> _regionLabels = new List<TextMeshProUGUI>();
        private TextMeshProUGUI _info;
        private TextMeshProUGUI _regionInfo;
        private readonly List<TextMeshProUGUI> _rampLabels = new List<TextMeshProUGUI>();
        private readonly List<string> _rampRegions = new List<string>();
        public int RampLabelCount => _rampLabels.Count;
        public bool RampLabelShown(int i) => _rampLabels[i].gameObject.activeSelf;
        private float _mapH;
        private float _regionCheck;
        private string _lastRegion;

        public bool IsOpen => _panel != null && _panel.activeSelf;
        public Button MapButton { get; private set; }
        public Button WaypointButton(int i) => _wpButtons[i];
        /// <summary>109-9 정상 ▲(오른 정상 = 누르면 순간이동).</summary>
        public Button PeakButton(int i) => _peakButtons[i];
        private readonly List<Button> _peakButtons = new List<Button>();
        private readonly List<TextMeshProUGUI> _fallLabels = new List<TextMeshProUGUI>();
        private readonly List<string> _fallRegions = new List<string>();
        public int FallLabelCount => _fallLabels.Count;
        public bool FallLabelShown(int i) => _fallLabels[i].gameObject.activeSelf;
        public string RegionLabel(int i) => _regionLabels[i].text;
        public string LastRegion => _lastRegion;
        public string InfoText => _info.text;
        /// <summary>108 — 지도 위쪽 "지금 선 지역" 두 줄.</summary>
        public string RegionInfoText => _regionInfo.text;
        // 109-14-7 여정·천하 등급 줄 + 낮추기/되돌리기 단추
        public string AdventureText => _advText.text;
        public Button WorldLevelButton => _advButton;
        private TextMeshProUGUI _advText;
        private Button _advButton;
        /// <summary>진단용 — 지도 텍스처에서 칸 가운데 색.</summary>
        public Color TileColorOnMap(int gx, int gy) => _tex.GetPixel(gx * TilePx + TilePx / 2, (TestMapData.RowCount - 1 - gy) * TilePx + TilePx / 2);

        private void Awake() => Instance = this;

        private void Start()
        {
            Build();
            WorldMapState.Changed += OnChanged;
            OnChanged();
            _panel.SetActive(false);
        }

        private void OnDestroy()
        {
            WorldMapState.Changed -= OnChanged;
            AdventureState.Changed -= OnChanged;
            if (Instance == this) Instance = null;
        }

        private void Build()
        {
            var canvas = EncounterUiKit.NewCanvas("WorldMapUI");
            canvas.sortingOrder = 6;
            var t = canvas.transform;

            MapButton = EncounterUiKit.NewButton(t, GoLocalization.T("map.button", "지도"), new Vector2(1f, 1f), new Vector2(-30f, -230f), new Vector2(160f, 80f), null);
            MapButton.onClick.AddListener(Toggle);

            _panel = new GameObject("MapPanel", typeof(RectTransform));
            _panel.transform.SetParent(t, false);
            var pr = (RectTransform)_panel.transform;
            pr.anchorMin = Vector2.zero; pr.anchorMax = Vector2.one;
            pr.offsetMin = pr.offsetMax = Vector2.zero;
            _panel.AddComponent<Image>().color = new Color(0.02f, 0.03f, 0.05f, 0.9f);

            _mapH = Mathf.Min(MapMaxH, MapW * TestMapData.RowCount / TestMapData.Cols);
            MapW = _mapH * TestMapData.Cols / TestMapData.RowCount;
            var mapGo = new GameObject("Map", typeof(RectTransform));
            mapGo.transform.SetParent(_panel.transform, false);
            _mapRect = (RectTransform)mapGo.transform;
            _mapRect.anchorMin = _mapRect.anchorMax = new Vector2(0.5f, 0.5f);
            _mapRect.sizeDelta = new Vector2(MapW, _mapH);
            _mapRect.anchoredPosition = new Vector2(-300f, 0f);
            _mapImage = mapGo.AddComponent<RawImage>();
            _tex = new Texture2D(TestMapData.Cols * TilePx, TestMapData.RowCount * TilePx, TextureFormat.RGBA32, false)
            { filterMode = FilterMode.Bilinear, wrapMode = TextureWrapMode.Clamp, name = "WorldMap (generated)" };
            _mapImage.texture = _tex;

            var title = EncounterUiKit.NewText(_panel.transform, GoLocalization.T("map.title", "지도"), new Vector2(0.5f, 1f), new Vector2(ColX, -60f), new Vector2(620f, 60f), 36);
            title.fontStyle = FontStyles.Bold;
            _info = EncounterUiKit.NewText(_panel.transform, "", new Vector2(0.5f, 0f), new Vector2(ColX, 150f), new Vector2(620f, 120f), 22);
            _regionInfo = EncounterUiKit.NewText(_panel.transform, "", new Vector2(0.5f, 1f), new Vector2(ColX, -150f), new Vector2(620f, 330f), 22);
            _regionInfo.raycastTarget = false;
            _advText = EncounterUiKit.NewText(_panel.transform, "", new Vector2(0.5f, 0f), new Vector2(ColX, 345f), new Vector2(620f, 64f), 19);
            _advText.raycastTarget = false;
            _advButton = EncounterUiKit.NewButton(_panel.transform, "", new Vector2(0.5f, 0f), new Vector2(ColX, 285f), new Vector2(460f, 52f), null);
            _advButton.GetComponentInChildren<TextMeshProUGUI>().fontSize = 18;
            _advButton.onClick.AddListener(ToggleWorldLevel);
            AdventureState.Changed += OnChanged;

            foreach (var r in GoWorldMap.Regions)
            {
                var label = EncounterUiKit.NewText(_mapRect, "", new Vector2(0.5f, 0.5f), MapPos(r.LabelGx, r.LabelGy), new Vector2(220f, 64f), 22);
                label.fontStyle = FontStyles.Bold;
                label.raycastTarget = false;
                label.GetComponent<RectTransform>().pivot = new Vector2(0.5f, 0.5f);
                _regionLabels.Add(label);
            }

            var tower = EncounterUiKit.NewText(_mapRect, "▲\n" + GoLocalization.T("map.tower", "옛 망루"), new Vector2(0.5f, 0.5f), MapPos(GoWorldMap.TowerGx, GoWorldMap.TowerGy), new Vector2(160f, 60f), 20);
            tower.color = new Color(1f, 0.8f, 0.45f);
            tower.raycastTarget = false;
            tower.GetComponent<RectTransform>().pivot = new Vector2(0.5f, 0.5f);

            // 107-3 걸어 오르는 경사·고개 — 비탈 한가운데에 작게
            foreach (var r in TestMapData.Ramps)
            {
                if (string.IsNullOrEmpty(r.LabelKo)) continue;
                TestMapData.RampGeometry(r, out Vector3 rb, out Vector3 rt, out _, out _);
                Vector2 g = GoWorldMap.WorldToGridF((rb + rt) * 0.5f);
                var ramp = EncounterUiKit.NewText(_mapRect, "≡ " + GoLocalization.T(r.LabelKey, r.LabelKo), new Vector2(0.5f, 0.5f), MapPos(g.x, g.y), new Vector2(120f, 30f), 18);
                ramp.color = new Color(0.95f, 0.9f, 0.75f);
                ramp.raycastTarget = false;
                ramp.GetComponent<RectTransform>().pivot = new Vector2(0.5f, 0.5f);
                _rampLabels.Add(ramp);
                _rampRegions.Add(GoWorldMap.RegionAt((rb + rt) * 0.5f));
            }

            for (int i = 0; i < GoWorldMap.Waypoints.Length; i++)
            {
                var w = GoWorldMap.Waypoints[i];
                var b = EncounterUiKit.NewButton(_mapRect, "◆", new Vector2(0.5f, 0.5f), MapPos(w.Gx, w.Gy), new Vector2(64f, 64f), null);
                b.GetComponent<RectTransform>().pivot = new Vector2(0.5f, 0.5f);
                b.GetComponentInChildren<TextMeshProUGUI>().fontSize = 34;
                int idx = i;
                b.onClick.AddListener(() => TeleportTo(idx));
                _wpButtons.Add(b);
            }

            // 109-9 발원지 폭포 — 아래끝 자리에 "≈ 이름"(그 지역이나 너른 강에 발 디디면 보임)
            foreach (var w in TestMapData.Waterfalls)
            {
                TestMapData.WaterfallGeometry(w, out _, out Vector3 foot, out _, out _);
                Vector2 g = GoWorldMap.WorldToGridF(foot);
                var fall = EncounterUiKit.NewText(_mapRect, "≈ " + GoLocalization.T(w.NameKey, w.NameKo), new Vector2(0.5f, 0.5f), MapPos(g.x, g.y), new Vector2(140f, 30f), 18);
                fall.color = new Color(0.7f, 0.9f, 1f);
                fall.raycastTarget = false;
                fall.GetComponent<RectTransform>().pivot = new Vector2(0.5f, 0.5f);
                _fallLabels.Add(fall);
                _fallRegions.Add(GoWorldMap.RegionAt(w.Gx, w.Gy));
            }

            // 109-9 정상 — 봉우리마다 작은 ▲(그 지역에 발 디디면 보임, 오른 정상은 금빛·누르면 순간이동)
            for (int i = 0; i < GoWorldMap.Peaks.Length; i++)
            {
                var p = GoWorldMap.Peaks[i];
                Vector2 g = GoWorldMap.WorldToGridF(p.Top);
                var b = EncounterUiKit.NewButton(_mapRect, "▲", new Vector2(0.5f, 0.5f), MapPos(g.x, g.y), new Vector2(44f, 44f), null);
                b.GetComponent<RectTransform>().pivot = new Vector2(0.5f, 0.5f);
                b.GetComponentInChildren<TextMeshProUGUI>().fontSize = 24;
                int idx = i;
                b.onClick.AddListener(() => TeleportToPeak(idx));
                _peakButtons.Add(b);
            }

            var arrowText = EncounterUiKit.NewText(_mapRect, "▲", new Vector2(0.5f, 0.5f), Vector2.zero, new Vector2(48f, 48f), 36);
            arrowText.color = new Color(1f, 0.95f, 0.35f);
            arrowText.raycastTarget = false;
            arrowText.gameObject.AddComponent<Saga.Core.LayoutFree>(); // 움직이는 표지 — 배치 점검이 겹침에서 뺀다
            _arrow = arrowText.GetComponent<RectTransform>();
            _arrow.pivot = new Vector2(0.5f, 0.5f);

            var close = EncounterUiKit.NewButton(_panel.transform, GoLocalization.T("map.close", "닫기 (M)"), new Vector2(0.5f, 0f), new Vector2(ColX, 50f), new Vector2(260f, 80f), null);
            close.onClick.AddListener(Close);
        }

        /// <summary>글자 지도 연속 좌표 → 지도 이미지 안 위치(칸 줄 0 이 위쪽).</summary>
        private Vector2 MapPos(float gx, float gy)
        {
            float x = (gx + 0.5f) / TestMapData.Cols * MapW - MapW * 0.5f;
            float y = _mapH * 0.5f - (gy + 0.5f) / TestMapData.RowCount * _mapH;
            return new Vector2(x, y);
        }

        private void OnChanged()
        {
            PaintTexture();
            for (int i = 0; i < GoWorldMap.Regions.Length; i++)
            {
                var r = GoWorldMap.Regions[i];
                bool seen = WorldMapState.IsVisited(r.Id);
                _regionLabels[i].text = seen ? GoLocalization.T(r.NameKey, r.NameKo) + " " + GoWorldMap.DangerDots(r.Danger) + MissionSuffix(r.Id) : "? ? ?";
                _regionLabels[i].color = seen ? Color.white : new Color(0.6f, 0.6f, 0.65f);
            }
            for (int i = 0; i < _wpButtons.Count; i++)
            {
                var w = GoWorldMap.Waypoints[i];
                bool on = WorldMapState.IsActive(w.Id);
                var txt = _wpButtons[i].GetComponentInChildren<TextMeshProUGUI>();
                txt.color = on ? new Color(0.35f, 0.95f, 1f) : new Color(0.55f, 0.55f, 0.6f);
                _wpButtons[i].GetComponent<Image>().color = on ? new Color(0.2f, 0.6f, 0.8f, 0.35f) : new Color(1f, 1f, 1f, 0.08f);
                _wpButtons[i].gameObject.SetActive(WorldMapState.IsVisited(GoWorldMap.RegionAt(GoWorldMap.WaypointPos(w))) || on);
            }
            for (int i = 0; i < _rampLabels.Count; i++) _rampLabels[i].gameObject.SetActive(WorldMapState.IsVisited(_rampRegions[i]));
            for (int i = 0; i < _fallLabels.Count; i++)
                _fallLabels[i].gameObject.SetActive(WorldMapState.IsVisited(_fallRegions[i]) || WorldMapState.IsVisited("river"));
            for (int i = 0; i < _peakButtons.Count; i++)
            {
                var p = GoWorldMap.Peaks[i];
                bool found = WorldMapState.IsPeakFound(p.Id);
                _peakButtons[i].GetComponentInChildren<TextMeshProUGUI>().color = found ? new Color(1f, 0.82f, 0.35f) : new Color(0.6f, 0.58f, 0.55f);
                _peakButtons[i].GetComponent<Image>().color = found ? new Color(0.8f, 0.6f, 0.2f, 0.35f) : new Color(1f, 1f, 1f, 0.05f);
                _peakButtons[i].gameObject.SetActive(found || WorldMapState.IsVisited(p.RegionId));
            }
            RefreshAdventure();
            var player = FieldCombat.Instance;
            _regionInfo.text = RegionInfo(player != null ? GoWorldMap.RegionAt(player.transform.position) : _lastRegion ?? "village");
            _info.text = string.Format(GoLocalization.T("map.info", "푸른 ◆ 역참을 누르면 순간이동 · 켠 역참 {0}/{1}{2}"),
                WorldMapState.ActiveCount, GoWorldMap.Waypoints.Length,
                WorldMapState.Revealed ? "" : GoLocalization.T("map.hint", " · 옛 망루 꼭대기에 오르면 온 땅이 밝혀진다"))
                + string.Format(GoLocalization.T("map.chests", " · 보물 상자 {0}/{1}"), GoTreasure.OpenedCount, GoTreasure.Chests.Length)
                + string.Format(GoLocalization.T("map.peaks", " · 오른 정상 ▲ {0}/{1}"), WorldMapState.PeakCount, GoWorldMap.Peaks.Length);
        }

        /// <summary>109-14-7 — 들판 적이 쫓거나 예고하는 중이면 싸우는 중.</summary>
        public static bool Fighting()
        {
            foreach (var e in FieldEnemy.All)
                if (e.Alive && (e.CurrentState == FieldEnemy.State.Chase || e.CurrentState == FieldEnemy.State.Telegraph)) return true;
            return false;
        }

        private void ToggleWorldLevel()
        {
            bool ok = AdventureState.Lowered ? AdventureState.Restore(Fighting()) : AdventureState.Lower(Fighting());
            if (!ok)
            {
                string why;
                if (AdventureState.Lowered) AdventureState.CanRestore(Fighting(), out why); else AdventureState.CanLower(Fighting(), out why);
                Saga.Go.UI.DialogueLabel.Instance?.Show(why, 2.5f);
            }
            OnChanged();
        }

        private void RefreshAdventure()
        {
            if (_advText == null) return;
            int ar = AdventureState.Rank, n = AdventureState.Natural, w = AdventureState.WorldLevel, nx = GoAdventure.NextAt(ar);
            _advText.text = string.Format(GoLocalization.T("adv.line", "여정 등급 {0} · 천하 등급 {1}{2} — 적 체력 ×{3:0.00} · 공격 ×{4:0.00} · 수호장 금 ×{5:0.00}"),
                    ar, w, AdventureState.Lowered ? GoLocalization.T("adv.lowered", "(낮춤)") : "", GoAdventure.HpMul(w), GoAdventure.AtkMul(w), GoAdventure.LootMul(w))
                + "\n" + (nx > 0 ? string.Format(GoLocalization.T("adv.next", "여정 등급 {0} 에 천하 등급 {1}"), nx, n + 1) : GoLocalization.T("adv.max", "천하 등급 끝까지 올랐다"));
            _advButton.gameObject.SetActive(AdventureState.Lowered || n > 0);
            _advButton.GetComponentInChildren<TextMeshProUGUI>().text = AdventureState.Lowered
                ? string.Format(GoLocalization.T("adv.btn_restore", "천하 등급 되돌리기 ({0} → {1})"), w, n)
                : string.Format(GoLocalization.T("adv.btn_lower", "천하 등급 한 단계 낮추기 ({0} → {1})"), w, Mathf.Max(0, w - 1));
        }

        /// <summary>107-8 — 사명이 있는 지역 이름 밑에 "사명 n/3" 또는 "평정".</summary>
        private static string MissionSuffix(string regionId)
        {
            if (GoRegionMission.IndexOf(regionId) < 0) return "";
            int stage = RegionMissionState.StageOf(regionId);
            return stage >= GoRegionMission.Stages
                ? "\n" + GoLocalization.T("map.mission_clear", "평정")
                : "\n" + string.Format(GoLocalization.T("map.mission", "사명 {0}/{1}"), stage, GoRegionMission.Stages);
        }

        private void PaintTexture()
        {
            int w = _tex.width, h = _tex.height;
            var px = new Color[w * h];
            for (int gy = 0; gy < TestMapData.RowCount; gy++)
            {
                for (int gx = 0; gx < TestMapData.Cols; gx++)
                {
                    char ch = TestMapData.TileAt(gx, gy);
                    Color c = TestMapData.Legend.TryGetValue(ch, out var info) ? info.Color : Color.black;
                    if (TestMapData.IsWater(ch)) c = ch == 'B' ? new Color(0.55f, 0.4f, 0.25f) : new Color(0.22f, 0.45f, 0.72f);
                    if (ch == '^') c = Color.Lerp(new Color(0.42f, 0.4f, 0.38f), new Color(0.85f, 0.84f, 0.8f), Mathf.InverseLerp(12f, 38f, TestMapData.GroundHeight(gx, gy)));
                    if (!WorldMapState.IsVisited(GoWorldMap.RegionAt(gx, gy))) c = new Color(c.r * 0.16f, c.g * 0.16f, c.b * 0.2f);
                    c.a = 1f;
                    int py0 = (TestMapData.RowCount - 1 - gy) * TilePx;
                    for (int y = 0; y < TilePx; y++)
                        for (int x = 0; x < TilePx; x++)
                            px[(py0 + y) * w + gx * TilePx + x] = c;
                }
            }
            _tex.SetPixels(px);
            _tex.Apply();
        }

        private void Update()
        {
            var kb = Keyboard.current;
            if (kb != null && kb.mKey.wasPressedThisFrame) Toggle();

            var fc = FieldCombat.Instance;
            if (fc == null) return;
            TrackRegion(fc.transform.position, Time.deltaTime);
            if (IsOpen) UpdateArrow(fc);
        }

        /// <summary>지역 경계를 넘으면 이름을 띄우고 발 디딘 지역으로 적는다. 진단도 부른다.</summary>
        public void TrackRegion(Vector3 pos, float dt)
        {
            _regionCheck -= dt;
            if (_regionCheck > 0f) return;
            _regionCheck = RegionCheckSec;
            string region = GoWorldMap.RegionAt(pos);
            bool isNew = WorldMapState.Visit(region); // 같은 지역이어도 적는다(세이브 불러오기로 기록이 바뀌었을 수 있다)
            if (region == _lastRegion) return;
            bool first = _lastRegion == null;
            _lastRegion = region;
            if (first || DialogueLabel.Instance == null) return; // 시작 자리는 말없이 적기만
            DialogueLabel.Instance.Show(EnterText(region, isNew), isNew ? 4f : 2.2f);
        }

        /// <summary>108 — 경계를 넘을 때 자막. 늘 "— 이름 한자 —" + 위험 줄, 처음 가는 땅이면 사연 한 줄을 더.</summary>
        public static string EnterText(string region, bool isNew)
        {
            string name = GoWorldMap.RegionName(region) + " " + GoWorldMap.RegionOf(region).Hanja;
            string head = isNew
                ? string.Format(GoLocalization.T("region.enter_new", "— {0} —\n새 지역"), name)
                : string.Format(GoLocalization.T("region.enter", "— {0} —"), name);
            string text = head + "\n" + GoWorldMap.DangerLine(region);
            return isNew ? text + "\n" + GoWorldMap.RegionLore(region) : text;
        }

        /// <summary>108 — 지도 위쪽 두 줄: "지금 · 이름 한자 · 위험 줄" + 사연.</summary>
        public static string RegionInfo(string region)
        {
            return string.Format(GoLocalization.T("map.region_now", "지금 · {0} {1} · {2}"),
                    GoWorldMap.RegionName(region), GoWorldMap.RegionOf(region).Hanja, GoWorldMap.DangerLine(region))
                + "\n" + GoWorldMap.RegionLore(region);
        }

        private void UpdateArrow(FieldCombat fc)
        {
            Vector2 g = GoWorldMap.WorldToGridF(fc.transform.position);
            _arrow.anchoredPosition = MapPos(g.x, g.y);
            var pc = fc.GetComponent<PlayerController>();
            Vector3 f = pc != null && pc.Visual != null ? pc.Visual.forward : fc.transform.forward;
            _arrow.localEulerAngles = new Vector3(0f, 0f, Mathf.Atan2(-f.x, -f.z) * Mathf.Rad2Deg);
        }

        public void Toggle()
        {
            if (IsOpen) Close(); else Open();
        }

        public void Open()
        {
            if (HeroDexUi.Instance != null && HeroDexUi.Instance.IsOpen) HeroDexUi.Instance.Close(); // 109-6b 도감과 겹치지 않게
            OnChanged();
            _panel.SetActive(true);
            var fc = FieldCombat.Instance;
            if (fc != null) UpdateArrow(fc);
        }

        public void Close() => _panel.SetActive(false);

        /// <summary>109-9 — 오른 정상이면 그 윗면으로 순간이동(true). 결투 중·안 오른 정상은 거절.</summary>
        public bool TeleportToPeak(int index)
        {
            var p = GoWorldMap.Peaks[index];
            if (!WorldMapState.IsPeakFound(p.Id))
            {
                if (DialogueLabel.Instance != null) DialogueLabel.Instance.Show(GoLocalization.T("map.peak_locked", "아직 오르지 않은 정상 — 기어올라 윗면에 서야 한다"), 2f);
                return false;
            }
            if (DuelGate.Active) return false;
            var fc = FieldCombat.Instance;
            var pc = fc != null ? fc.GetComponent<PlayerController>() : Object.FindFirstObjectByType<PlayerController>();
            if (pc == null) return false;
            pc.Teleport(GoWorldMap.PeakArrival(p));
            foreach (var e in FieldEnemy.All) e.ForceReturn();
            Close();
            if (DialogueLabel.Instance != null) DialogueLabel.Instance.Show(string.Format(GoLocalization.T("map.teleported", "{0}(으)로 순간이동"), GoWorldMap.PeakName(p)), 2f);
            return true;
        }

        /// <summary>활성 지점이면 그 자리로 순간이동(true). 결투 중·비활성은 거절.</summary>
        public bool TeleportTo(int index)
        {
            var w = GoWorldMap.Waypoints[index];
            if (!WorldMapState.IsActive(w.Id))
            {
                if (DialogueLabel.Instance != null) DialogueLabel.Instance.Show(GoLocalization.T("map.wp_locked", "아직 켜지 않은 역참 — 가까이 가서 켜야 한다"), 2f);
                return false;
            }
            if (DuelGate.Active) return false;
            var fc = FieldCombat.Instance;
            var pc = fc != null ? fc.GetComponent<PlayerController>() : Object.FindFirstObjectByType<PlayerController>();
            if (pc == null) return false;
            pc.Teleport(GoWorldMap.ArrivalPos(w));
            foreach (var e in FieldEnemy.All) e.ForceReturn();
            Close();
            if (DialogueLabel.Instance != null) DialogueLabel.Instance.Show(string.Format(GoLocalization.T("map.teleported", "{0}(으)로 순간이동"), GoWorldMap.WaypointName(w)), 2f);
            return true;
        }
    }
}
