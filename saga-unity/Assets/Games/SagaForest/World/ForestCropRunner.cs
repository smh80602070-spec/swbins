using TMPro;
using UnityEngine;
using UnityEngine.UI;
using Saga.Core;
using Saga.Forest.Data;
using Saga.Forest.UI;

namespace Saga.Forest.World
{
    /// <summary>
    /// tasks U-0223 밭 작물 실행기 — `ForestBootstrap.Start` 가 Play 때 세운다(씬 재빌드 없음, 가축 <see cref="ForestLivestockRunner"/> 와 같은 꼴).
    /// ① 밭 모습: 집 남동쪽(우리 맞은편 — 집 + <see cref="HouseOffset"/>) 2×2 칸, 칸마다 코드 흙 두둑(충돌 없음) 위에 단계 모델 —
    ///    빈 두둑·씨 = 모델 없음 · 싹 `wheat_sprout_01` · 자람 `wheat_growing_01` · 다 자람 `wheat_ripe_01`(world-forge build_field, 없으면 대역 원기둥). 물 받은 칸은 흙이 짙다.
    /// ② 1초마다 <see cref="ForestCrops.Tick"/>(오늘) — 자람 알림 · 비가 오면(<see cref="SkyWeatherRules.CurrentKind"/> = 비) 씨 뿌린 칸에 저절로 물.
    /// ③ 창: 제작대 창의 "🌾 밭" 단추가 연다 — 밭 짓기(열매) · 칸마다 단계·물 · 「씨 뿌리기」「물 주기」「거두기」 한 단추 · 닫기.
    /// </summary>
    public class ForestCropRunner : MonoBehaviour
    {
        public const float Cell = 1.3f, Gap = 0.35f;
        public static float Half => Cell + Gap * 0.5f;
        public static readonly Vector3 HouseOffset = new Vector3(4f, 0f, -8.5f);
        public static readonly string[] StageModels = { null, null, "wheat_sprout_01", "wheat_growing_01", "wheat_ripe_01" };
        public static ForestCropRunner Instance { get; private set; }

        private GameObject _field;
        private readonly GameObject[] _soil = new GameObject[ForestCrops.Plots];
        private readonly string[] _model = new string[ForestCrops.Plots];
        private float _checkLeft;
        private GameObject _panel;
        private TextMeshProUGUI _title;
        private Button _build;
        private readonly TextMeshProUGUI[] _info = new TextMeshProUGUI[ForestCrops.Plots];
        private readonly Button[] _act = new Button[ForestCrops.Plots];

        public bool IsOpen => _panel != null && _panel.activeSelf;
        public GameObject Field => _field;
        public RectTransform Root => _panel != null ? (RectTransform)_panel.transform : null;
        public string InfoText(int i) => _info[i] != null && _info[i].gameObject.activeSelf ? _info[i].text : "";
        public Button ActButton(int i) => _act[i];
        public Button BuildButton => _build;
        /// <summary>진단 — 칸에 지금 세운 모델 이름(빈 두둑·씨 = null).</summary>
        public string ModelAt(int i) => _model[i];
        /// <summary>진단 — 마지막 아침·비 알림.</summary>
        public string LastLine { get; private set; }
        public Vector3 Center { get; private set; }

        public static ForestCropRunner Install()
        {
            if (Instance != null) return Instance;
            return new GameObject("ForestCrops").AddComponent<ForestCropRunner>();
        }

        private void Awake()
        {
            Instance = this;
            var house = FindFirstObjectByType<ForestHouse>();
            Vector3 at = house != null ? house.transform.position + HouseOffset : new Vector3(19f, 0f, -18.5f);
            Center = new Vector3(at.x, 0f, at.z);
            BuildUi();
            ForestCrops.Changed += OnChanged;
            RebuildField();
        }

        private void OnDestroy()
        {
            ForestCrops.Changed -= OnChanged;
            if (Instance == this) Instance = null;
        }

        private void OnChanged()
        {
            RebuildField();
            Refresh();
        }

        private void Update()
        {
            _checkLeft -= Time.deltaTime;
            if (_checkLeft > 0f) return;
            _checkLeft = 1f;
            CheckDay();
            CheckRain();
        }

        /// <summary>날 바뀜 굴리기 — 진단은 날을 바꾼 뒤 직접 부른다.</summary>
        public string CheckDay() => Say(ForestCrops.Line(ForestCrops.Tick(ForestVisitors.Today)));

        /// <summary>비가 오면 씨 뿌린 칸에 물 — 새로 받은 칸이 있을 때만 알림.</summary>
        public string CheckRain()
        {
            if (SkyWeatherRules.CurrentKind() != SkyWeatherRules.Kind.Rain) return null;
            int n = ForestCrops.RainWater();
            return n > 0 ? Say(string.Format(ForestLocalization.T("crop.rain", "🌧 비가 밭 {0}칸에 물을 줬다"), n)) : null;
        }

        private string Say(string line)
        {
            if (string.IsNullOrEmpty(line)) return null;
            LastLine = line;
            DialogueLabel.Instance?.Show(line, 4f);
            return line;
        }

        // ---- 밭 모습 ----

        public void RebuildField()
        {
            if (_field != null) DestroyImmediate(_field);
            _field = null;
            for (int i = 0; i < ForestCrops.Plots; i++) { _soil[i] = null; _model[i] = null; }
            if (!ForestCrops.HasField) return;
            _field = new GameObject("CropField");
            _field.transform.SetParent(transform, false);
            _field.transform.position = Center;
            var edge = Prim(PrimitiveType.Cube, _field.transform, new Vector3(0f, 0.03f, 0f), new Vector3(Half * 2f + 0.3f, 0.06f, Half * 2f + 0.3f), new Color(0.47f, 0.36f, 0.24f));
            edge.name = "FieldEdge";
            for (int i = 0; i < ForestCrops.Plots; i++)
            {
                float x = (i % 2 == 0 ? -1f : 1f) * (Cell + Gap) * 0.5f, z = (i < 2 ? 1f : -1f) * (Cell + Gap) * 0.5f;
                var slot = new GameObject($"Plot_{i}");
                slot.transform.SetParent(_field.transform, false);
                slot.transform.localPosition = new Vector3(x, 0f, z);
                var p = ForestCrops.PlotAt(i);
                bool wet = p != null && p.watered;
                _soil[i] = Prim(PrimitiveType.Cube, slot.transform, new Vector3(0f, 0.1f, 0f), new Vector3(Cell, 0.14f, Cell), wet ? new Color(0.24f, 0.16f, 0.1f) : new Color(0.42f, 0.29f, 0.18f));
                _soil[i].name = "Soil";
                // 두둑 고랑 셋(흙 위 얇은 줄) — 빈 칸도 밭으로 보이게.
                for (int r = -1; r <= 1; r++)
                    Prim(PrimitiveType.Cube, slot.transform, new Vector3(r * Cell * 0.3f, 0.19f, 0f), new Vector3(0.14f, 0.05f, Cell * 0.9f), wet ? new Color(0.2f, 0.13f, 0.08f) : new Color(0.36f, 0.24f, 0.15f)).name = "Ridge";
                string model = StageModels[(int)ForestCrops.StageOf(i)];
                if (model == null) continue;
                var holder = new GameObject("Crop");
                holder.transform.SetParent(slot.transform, false);
                holder.transform.localPosition = new Vector3(0f, 0.17f, 0f);
                var go = WorldModels.Spawn(model, holder.transform, Cell * 0.95f);
                if (go == null) // 대역 — 모델이 없을 때
                {
                    float h = model == "wheat_sprout_01" ? 0.2f : model == "wheat_growing_01" ? 0.6f : 0.9f;
                    Prim(PrimitiveType.Cylinder, holder.transform, new Vector3(0f, h * 0.5f, 0f), new Vector3(Cell * 0.7f, h * 0.5f, Cell * 0.7f), model == "wheat_ripe_01" ? new Color(0.9f, 0.75f, 0.3f) : new Color(0.4f, 0.7f, 0.3f));
                }
                _model[i] = model;
            }
        }

        private static GameObject Prim(PrimitiveType t, Transform parent, Vector3 pos, Vector3 scale, Color c)
        {
            var g = GameObject.CreatePrimitive(t);
            Colliders.Strip(g);
            g.transform.SetParent(parent, false);
            g.transform.localPosition = pos;
            g.transform.localScale = scale;
            var r = g.GetComponent<Renderer>();
            if (r != null)
            {
                var block = new MaterialPropertyBlock();
                r.GetPropertyBlock(block);
                block.SetColor("_BaseColor", c);
                block.SetColor("_Color", c);
                r.SetPropertyBlock(block);
            }
            return g;
        }

        // ---- 창 ----

        private void BuildUi()
        {
            SagaUi.EnsureEventSystem();
            var canvas = SagaUi.NewHudCanvas("CropCanvas", 95, transform);
            _panel = SagaUi.NewPanel(canvas.transform, "CropPanel", new Vector2(0.5f, 0.5f), Vector2.zero, new Vector2(900f, 680f), SagaUi.Panel, "window").gameObject;
            _title = SagaUi.NewText(_panel.transform, "", 28f, SagaUi.Gold, new Vector2(0.5f, 1f), new Vector2(0f, -30f), new Vector2(840f, 56f));
            _build = SagaUi.NewButton(_panel.transform, "CropBuild", "", new Vector2(0.5f, 1f), new Vector2(0f, -96f), new Vector2(420f, 56f), SagaUi.ButtonAccent, 24f);
            _build.onClick.AddListener(PressBuild);
            for (int i = 0; i < ForestCrops.Plots; i++)
            {
                int k = i;
                float y0 = -168f - 104f * i;
                _info[i] = SagaUi.NewText(_panel.transform, "", 21f, SagaUi.Ink, new Vector2(0f, 1f), new Vector2(30f, y0), new Vector2(520f, 88f));
                _info[i].alignment = TextAlignmentOptions.Left;
                _act[i] = SagaUi.NewButton(_panel.transform, $"Plot{i}", "", new Vector2(1f, 1f), new Vector2(-30f, y0 - 16f), new Vector2(280f, 56f), SagaUi.ButtonAccent, 22f);
                _act[i].onClick.AddListener(() => PressPlot(k));
            }
            var close = SagaUi.NewButton(_panel.transform, "CropClose", ForestLocalization.T("hand.close", "닫기"), new Vector2(0.5f, 0f), new Vector2(0f, 20f), new Vector2(240f, 56f), SagaUi.ButtonIdle, 24f);
            close.onClick.AddListener(Close);
            _panel.SetActive(false);
        }

        public void Open() { if (_panel == null) return; _panel.SetActive(true); _panel.transform.SetAsLastSibling(); Refresh(); }
        public void Close() { if (_panel != null) _panel.SetActive(false); }

        public void Refresh()
        {
            if (_panel == null || !_panel.activeSelf) return;
            bool field = ForestCrops.HasField;
            _title.text = string.Format(ForestLocalization.T("crop.title", "🌾 작은 밭 — 하루 한 번 물을 주면 {0}번째 아침에 다 자란다 · 열매 {1}"), ForestCrops.GrowDays, ForestState.FruitCount);
            _build.gameObject.SetActive(!field);
            _build.GetComponentInChildren<TMP_Text>().text = string.Format(ForestLocalization.T("crop.build", "🔨 작은 밭 짓기 (열매 {0})"), ForestCrops.FieldFruit);
            for (int i = 0; i < ForestCrops.Plots; i++)
            {
                _info[i].gameObject.SetActive(field);
                _act[i].gameObject.SetActive(field);
                if (!field) continue;
                var p = ForestCrops.PlotAt(i);
                var st = ForestCrops.StageOf(i);
                string stage = StageName(st);
                string water = st == ForestCrops.Stage.Empty || st == ForestCrops.Stage.Ripe ? ""
                    : p.watered ? " · " + ForestLocalization.T("crop.wet", "💧 물 줌") : " · " + ForestLocalization.T("crop.dry", "마름");
                string grown = st == ForestCrops.Stage.Empty || st == ForestCrops.Stage.Ripe ? "" : $" ({p.grown}/{ForestCrops.GrowDays})";
                _info[i].text = string.Format(ForestLocalization.T("crop.plot", "칸 {0}"), i + 1) + $"\n{stage}{grown}{water}";
                var label = _act[i].GetComponentInChildren<TMP_Text>();
                switch (st)
                {
                    case ForestCrops.Stage.Empty:
                        label.text = string.Format(ForestLocalization.T("crop.sow", "🌱 씨 뿌리기 (열매 {0})"), ForestCrops.SeedFruit);
                        _act[i].interactable = true;
                        break;
                    case ForestCrops.Stage.Ripe:
                        label.text = string.Format(ForestLocalization.T("crop.harvest", "🌾 거두기 (열매 +{0})"), ForestCrops.HarvestFruit);
                        _act[i].interactable = true;
                        break;
                    default:
                        label.text = ForestLocalization.T("crop.water", "💧 물 주기");
                        _act[i].interactable = !p.watered;
                        break;
                }
            }
        }

        public static string StageName(ForestCrops.Stage st)
        {
            switch (st)
            {
                case ForestCrops.Stage.Seed: return ForestLocalization.T("crop.stage_seed", "씨 뿌림");
                case ForestCrops.Stage.Sprout: return ForestLocalization.T("crop.stage_sprout", "🌱 싹");
                case ForestCrops.Stage.Growing: return ForestLocalization.T("crop.stage_growing", "🌿 자라는 중");
                case ForestCrops.Stage.Ripe: return ForestLocalization.T("crop.stage_ripe", "🌾 다 자람");
                default: return ForestLocalization.T("crop.stage_empty", "빈 두둑");
            }
        }

        private static string Why(string key)
        {
            switch (key)
            {
                case "crop.why_fruit": return ForestLocalization.T(key, "열매가 모자라다");
                case "crop.why_one": return ForestLocalization.T(key, "밭은 하나만");
                case "crop.why_no_field": return ForestLocalization.T(key, "작은 밭을 먼저 짓는다");
                case "crop.why_sown": return ForestLocalization.T(key, "이미 씨를 뿌렸다");
                case "crop.why_bare": return ForestLocalization.T(key, "씨를 먼저 뿌린다");
                case "crop.why_ripe": return ForestLocalization.T(key, "다 자랐다 — 거두자");
                case "crop.why_watered": return ForestLocalization.T(key, "오늘은 이미 물을 줬다");
                case "crop.why_unripe": return ForestLocalization.T(key, "아직 덜 자랐다");
                case "crop.why_off": return ForestLocalization.T(key, "밭이 꺼져 있다");
                default: return ForestLocalization.T("crop.why_none", "할 수 없다");
            }
        }

        public void PressBuild()
        {
            string why = ForestCrops.Build();
            DialogueLabel.Instance?.Show(why == null ? ForestLocalization.T("crop.built", "🔨 작은 밭을 지었다 — 씨를 뿌리고 날마다 물을 주자") : Why(why), 2.5f);
            Refresh();
        }

        /// <summary>칸 단추 — 단계에 따라 씨 뿌리기·물 주기·거두기.</summary>
        public void PressPlot(int i)
        {
            var st = ForestCrops.StageOf(i);
            string why, ok;
            if (st == ForestCrops.Stage.Empty) { why = ForestCrops.Sow(i); ok = ForestLocalization.T("crop.sown", "🌱 씨를 뿌렸다 — 날마다 물을 주자"); }
            else if (st == ForestCrops.Stage.Ripe) { why = ForestCrops.Harvest(i); ok = string.Format(ForestLocalization.T("crop.harvested", "🌾 거뒀다 — 열매 +{0}"), ForestCrops.HarvestFruit); }
            else { why = ForestCrops.Water(i); ok = ForestLocalization.T("crop.watered", "💧 물을 줬다 — 내일 아침에 자란다"); }
            DialogueLabel.Instance?.Show(why == null ? ok : Why(why), 2f);
            Refresh();
        }
    }
}
