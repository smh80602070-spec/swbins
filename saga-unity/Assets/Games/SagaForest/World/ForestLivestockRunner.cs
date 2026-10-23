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
    /// tasks U-0173 가축 기르기 실행기(웹 W-0299 · 고돗 G-0311) — `ForestBootstrap.Start` 가 Play 때 세운다(씬 재빌드 없음).
    /// ① 우리 모습: 집 남서쪽(제작대 남쪽) 반 변 <see cref="Half"/>m 네모 울타리(`pen_fence_01` 변마다 둘, 남쪽 가운데 = `pen_gate_01`, 충돌 없음) —
    ///    지은 뒤에만. 그 안을 짐승 대역 몸(코드 도형 — 몸은 K-0186)이 천천히 돈다.
    /// ② 1초마다 <see cref="ForestLivestock.Tick"/>(오늘) — 아침 산물·떠남 알림.
    /// ③ 창: 제작대 창의 "🐔 우리" 단추가 연다 — 우리 짓기(열매) · 마리마다 하트·배·「먹이」「쓰다듬기」 · 꼬꼬·매매 들이기 · 닫기.
    /// </summary>
    public class ForestLivestockRunner : MonoBehaviour
    {
        public const float Half = 2f;
        public static readonly Vector3 HouseOffset = new Vector3(-4f, 0f, -8.5f);
        public static ForestLivestockRunner Instance { get; private set; }

        private GameObject _pen;
        private readonly List<GameObject> _bodies = new List<GameObject>();
        private float _checkLeft;
        private GameObject _panel;
        private TextMeshProUGUI _title;
        private Button _build;
        private readonly TextMeshProUGUI[] _info = new TextMeshProUGUI[ForestLivestock.Max];
        private readonly Button[] _feed = new Button[ForestLivestock.Max], _pet = new Button[ForestLivestock.Max];
        private readonly Button[] _buy = new Button[2];

        public bool IsOpen => _panel != null && _panel.activeSelf;
        public GameObject Pen => _pen;
        public IReadOnlyList<GameObject> Bodies => _bodies;
        public RectTransform Root => _panel != null ? (RectTransform)_panel.transform : null;
        public string InfoText(int i) => _info[i] != null && _info[i].gameObject.activeSelf ? _info[i].text : "";
        public Button FeedButton(int i) => _feed[i];
        public Button BuyButton(int i) => _buy[i];
        public Button BuildButton => _build;
        /// <summary>진단 — 마지막 아침 알림.</summary>
        public string LastMorning { get; private set; }
        public Vector3 Center { get; private set; }

        public static ForestLivestockRunner Install()
        {
            if (Instance != null) return Instance;
            return new GameObject("ForestLivestock").AddComponent<ForestLivestockRunner>();
        }

        private void Awake()
        {
            Instance = this;
            var house = FindFirstObjectByType<ForestHouse>();
            Vector3 at = house != null ? house.transform.position + HouseOffset : new Vector3(7f, 0f, -18.5f);
            Center = new Vector3(at.x, 0f, at.z);
            BuildUi();
            ForestLivestock.Changed += OnChanged;
            RebuildPen();
        }

        private void OnDestroy()
        {
            ForestLivestock.Changed -= OnChanged;
            if (Instance == this) Instance = null;
        }

        private void OnChanged()
        {
            if ((_pen != null) != ForestLivestock.HasPen || _bodies.Count != ForestLivestock.Count) RebuildPen();
            Refresh();
        }

        private void Update()
        {
            Wander(Time.time);
            _checkLeft -= Time.deltaTime;
            if (_checkLeft > 0f) return;
            _checkLeft = 1f;
            CheckDay();
        }

        /// <summary>날 바뀜 굴리기 — 진단은 날을 바꾼 뒤 직접 부른다.</summary>
        public string CheckDay()
        {
            string line = ForestLivestock.Line(ForestLivestock.Tick(ForestVisitors.Today));
            if (string.IsNullOrEmpty(line)) return null;
            LastMorning = line;
            DialogueLabel.Instance?.Show(line, 4f);
            return line;
        }

        // ---- 우리 모습 ----

        public void RebuildPen()
        {
            if (_pen != null) DestroyImmediate(_pen);
            _pen = null;
            _bodies.Clear();
            if (!ForestLivestock.HasPen) return;
            _pen = new GameObject("LivestockPen");
            _pen.transform.SetParent(transform, false);
            _pen.transform.position = Center;
            // 변마다 조각 둘(반 변 = 조각 하나) — 남쪽(−Z) 동쪽 조각이 문.
            for (int side = 0; side < 4; side++)
            {
                float yaw = side * 90f;
                var rot = Quaternion.Euler(0f, yaw, 0f);
                for (int k = 0; k < 2; k++)
                {
                    bool gate = side == 0 && k == 1;
                    Piece(gate ? "pen_gate_01" : "pen_fence_01", rot * new Vector3((k - 0.5f) * Half, 0f, -Half), yaw, Half);
                }
            }
            var ground = GameObject.CreatePrimitive(PrimitiveType.Quad);
            ground.name = "PenStraw";
            Colliders.Strip(ground);
            ground.transform.SetParent(_pen.transform, false);
            ground.transform.localPosition = new Vector3(0f, 0.02f, 0f);
            ground.transform.localRotation = Quaternion.Euler(90f, 0f, 0f);
            ground.transform.localScale = new Vector3(Half * 2f - 0.2f, Half * 2f - 0.2f, 1f);
            Tint(ground, new Color(0.62f, 0.55f, 0.32f));
            for (int i = 0; i < ForestLivestock.Count; i++) _bodies.Add(Body(ForestLivestock.List[i].kind, i));
            Wander(Time.time);
        }

        private void Piece(string model, Vector3 local, float yaw, float length)
        {
            var slot = new GameObject(model);
            slot.transform.SetParent(_pen.transform, false);
            slot.transform.localPosition = local;
            var go = WorldModels.Spawn(model, slot.transform, length);
            if (go == null)
            {
                go = GameObject.CreatePrimitive(PrimitiveType.Cube); // 대역 — 모델이 없을 때
                Colliders.Strip(go);
                go.transform.SetParent(slot.transform, false);
                go.transform.localScale = new Vector3(length, 0.8f, 0.12f);
                go.transform.localPosition = new Vector3(0f, 0.4f, 0f);
                Tint(go, new Color(0.55f, 0.4f, 0.25f));
            }
            else
            {
                // 모델 긴 변이 변 방향(지역 X)을 따르게(길이는 Spawn 이 조각 하나 이하로 줄였다).
                var b = Bounds(go);
                if (b.size.z > b.size.x) go.transform.localRotation = Quaternion.Euler(0f, 90f, 0f);
            }
            slot.transform.localRotation = Quaternion.Euler(0f, yaw, 0f);
        }

        private static Bounds Bounds(GameObject go)
        {
            Bounds b = default; bool any = false;
            foreach (var r in go.GetComponentsInChildren<Renderer>(true)) { if (!any) { b = r.bounds; any = true; } else b.Encapsulate(r.bounds); }
            return b;
        }

        /// <summary>짐승 대역 몸 — 몸 GLB 는 K-0186 이 놓으면 여기만 바꾼다.</summary>
        private GameObject Body(string kind, int i)
        {
            bool goat = kind == "goat";
            var root = new GameObject($"Animal_{i}_{kind}");
            root.transform.SetParent(_pen.transform, false);
            Color fur = goat ? new Color(0.91f, 0.89f, 0.84f) : new Color(0.98f, 0.97f, 0.93f);
            var body = Prim(PrimitiveType.Sphere, root.transform, goat ? new Vector3(0f, 0.45f, 0f) : new Vector3(0f, 0.25f, 0f), goat ? new Vector3(0.45f, 0.38f, 0.75f) : new Vector3(0.3f, 0.28f, 0.36f), fur);
            Prim(PrimitiveType.Sphere, root.transform, goat ? new Vector3(0f, 0.68f, 0.42f) : new Vector3(0f, 0.42f, 0.17f), goat ? Vector3.one * 0.24f : Vector3.one * 0.17f, fur);
            if (goat)
            {
                for (int s = -1; s <= 1; s += 2)
                {
                    Prim(PrimitiveType.Cylinder, root.transform, new Vector3(0.12f * s, 0.15f, 0.22f * s), new Vector3(0.07f, 0.15f, 0.07f), new Color(0.48f, 0.42f, 0.36f));
                    Prim(PrimitiveType.Cylinder, root.transform, new Vector3(0.12f * s, 0.15f, -0.22f * s), new Vector3(0.07f, 0.15f, 0.07f), new Color(0.48f, 0.42f, 0.36f));
                    var horn = Prim(PrimitiveType.Cylinder, root.transform, new Vector3(0.06f * s, 0.84f, 0.38f), new Vector3(0.04f, 0.09f, 0.04f), new Color(0.43f, 0.38f, 0.32f));
                    horn.transform.localRotation = Quaternion.Euler(-30f, 0f, 0f);
                }
            }
            else
            {
                Prim(PrimitiveType.Sphere, root.transform, new Vector3(0f, 0.53f, 0.17f), Vector3.one * 0.07f, new Color(0.85f, 0.26f, 0.23f));
                Prim(PrimitiveType.Sphere, root.transform, new Vector3(0f, 0.42f, 0.27f), new Vector3(0.05f, 0.04f, 0.07f), new Color(0.91f, 0.65f, 0.23f));
            }
            body.name = "Body";
            return root;
        }

        private static GameObject Prim(PrimitiveType t, Transform parent, Vector3 pos, Vector3 scale, Color c)
        {
            var g = GameObject.CreatePrimitive(t);
            Colliders.Strip(g);
            g.transform.SetParent(parent, false);
            g.transform.localPosition = pos;
            g.transform.localScale = scale;
            Tint(g, c);
            return g;
        }

        private static void Tint(GameObject g, Color c)
        {
            var r = g.GetComponent<Renderer>();
            if (r == null) return;
            var block = new MaterialPropertyBlock();
            r.GetPropertyBlock(block);
            block.SetColor("_BaseColor", c);
            block.SetColor("_Color", c);
            r.SetPropertyBlock(block);
        }

        /// <summary>우리 안을 천천히 돈다(웹 draw2d 와 같은 꼴 — 사인 두 개).</summary>
        private void Wander(float now)
        {
            float inner = Half - 0.55f;
            for (int i = 0; i < _bodies.Count; i++)
            {
                var b = _bodies[i];
                if (b == null) continue;
                float t = now + i * 1.7f;
                float x = Mathf.Sin(t * 0.37f + i) * inner, z = Mathf.Cos(t * 0.29f + i * 2f) * inner;
                float dx = Mathf.Cos(t * 0.37f + i) * 0.37f, dz = -Mathf.Sin(t * 0.29f + i * 2f) * 0.29f;
                b.transform.localPosition = new Vector3(x, Mathf.Abs(Mathf.Sin(t * 3f)) * 0.04f, z);
                if (dx * dx + dz * dz > 1e-5f) b.transform.localRotation = Quaternion.LookRotation(new Vector3(dx, 0f, dz));
            }
        }

        // ---- 창 ----

        private void BuildUi()
        {
            SagaUi.EnsureEventSystem();
            var canvas = SagaUi.NewHudCanvas("LivestockCanvas", 95, transform);
            _panel = SagaUi.NewPanel(canvas.transform, "LivestockPanel", new Vector2(0.5f, 0.5f), Vector2.zero, new Vector2(940f, 760f), SagaUi.Panel, "window").gameObject;
            _title = SagaUi.NewText(_panel.transform, "", 30f, SagaUi.Gold, new Vector2(0.5f, 1f), new Vector2(0f, -30f), new Vector2(880f, 56f));
            _build = SagaUi.NewButton(_panel.transform, "PenBuild", "", new Vector2(0.5f, 1f), new Vector2(0f, -96f), new Vector2(420f, 56f), SagaUi.ButtonAccent, 24f);
            _build.onClick.AddListener(PressBuild);
            for (int i = 0; i < ForestLivestock.Max; i++)
            {
                int k = i;
                float y0 = -168f - 112f * i;
                _info[i] = SagaUi.NewText(_panel.transform, "", 21f, SagaUi.Ink, new Vector2(0f, 1f), new Vector2(30f, y0), new Vector2(500f, 96f));
                _info[i].alignment = TextAlignmentOptions.Left;
                _feed[i] = SagaUi.NewButton(_panel.transform, $"Feed{i}", "", new Vector2(1f, 1f), new Vector2(-210f, y0 - 20f), new Vector2(180f, 56f), SagaUi.ButtonAccent, 22f);
                _feed[i].onClick.AddListener(() => PressFeed(k));
                _pet[i] = SagaUi.NewButton(_panel.transform, $"Pet{i}", "", new Vector2(1f, 1f), new Vector2(-30f, y0 - 20f), new Vector2(160f, 56f), SagaUi.ButtonIdle, 22f);
                _pet[i].onClick.AddListener(() => PressPet(k));
            }
            for (int i = 0; i < 2; i++)
            {
                string key = ForestLivestock.Kinds[i].Key;
                _buy[i] = SagaUi.NewButton(_panel.transform, $"Buy{key}", "", new Vector2(0.5f, 0f), new Vector2(-220f + 440f * i, 96f), new Vector2(400f, 56f), SagaUi.ButtonIdle, 22f);
                _buy[i].onClick.AddListener(() => PressBuy(key));
            }
            var close = SagaUi.NewButton(_panel.transform, "LivestockClose", ForestLocalization.T("hand.close", "닫기"), new Vector2(0.5f, 0f), new Vector2(0f, 20f), new Vector2(240f, 56f), SagaUi.ButtonIdle, 24f);
            close.onClick.AddListener(Close);
            _panel.SetActive(false);
        }

        public void Open() { if (_panel == null) return; _panel.SetActive(true); _panel.transform.SetAsLastSibling(); Refresh(); }
        public void Close() { if (_panel != null) _panel.SetActive(false); }

        public void Refresh()
        {
            if (_panel == null || !_panel.activeSelf) return;
            bool pen = ForestLivestock.HasPen;
            _title.text = string.Format(ForestLocalization.T("stock.title", "🐔 작은 우리 {0}/{1} — 열매를 먹이면 아침에 거둔다 · 열매 {2}"),
                ForestLivestock.Count, ForestLivestock.Max, ForestState.FruitCount);
            _build.gameObject.SetActive(!pen);
            _build.GetComponentInChildren<TMP_Text>().text = string.Format(ForestLocalization.T("stock.build", "🔨 작은 우리 짓기 (열매 {0})"), ForestLivestock.PenFruit);
            for (int i = 0; i < ForestLivestock.Max; i++)
            {
                bool has = i < ForestLivestock.Count;
                _info[i].gameObject.SetActive(has);
                _feed[i].gameObject.SetActive(has);
                _pet[i].gameObject.SetActive(has);
                if (!has) continue;
                var a = ForestLivestock.List[i];
                var K = ForestLivestock.KindOf(a.kind);
                string hearts = new string('♥', a.heart) + new string('♡', ForestLivestock.HeartMax - a.heart);
                string belly = a.fed ? ForestLocalization.T("stock.fed", "배부름") : a.hungry > 0 ? string.Format(ForestLocalization.T("stock.hungry_n", "굶은 날 {0}"), a.hungry) : ForestLocalization.T("stock.hungry", "배고픔");
                _info[i].text = $"{K.Emoji} {a.name}  {hearts}\n{belly} · {K.ProductEmoji} {K.Product}";
                _feed[i].GetComponentInChildren<TMP_Text>().text = string.Format(ForestLocalization.T("stock.feed", "🍎 먹이 ({0})"), ForestLivestock.FeedFruit);
                _feed[i].interactable = !a.fed;
                _pet[i].GetComponentInChildren<TMP_Text>().text = ForestLocalization.T("stock.pet", "🤚 쓰다듬기");
                _pet[i].interactable = !a.petted;
            }
            for (int i = 0; i < 2; i++)
            {
                var K = ForestLivestock.Kinds[i];
                _buy[i].gameObject.SetActive(pen && ForestLivestock.Count < ForestLivestock.Max);
                _buy[i].GetComponentInChildren<TMP_Text>().text = string.Format(ForestLocalization.T("stock.buy", "{0} {1} 새끼 들이기 (열매 {2})"), K.Emoji, K.Name, K.Price);
            }
        }

        private static string Why(string key)
        {
            switch (key)
            {
                case "stock.why_fruit": return ForestLocalization.T(key, "열매가 모자라다");
                case "stock.why_feed": return ForestLocalization.T(key, "먹일 열매가 없다");
                case "stock.why_pen_one": return ForestLocalization.T(key, "우리는 하나만");
                case "stock.why_no_pen": return ForestLocalization.T(key, "작은 우리를 먼저 짓는다");
                case "stock.why_max": return string.Format(ForestLocalization.T(key, "우리엔 {0}마리까지"), ForestLivestock.Max);
                case "stock.why_fed": return ForestLocalization.T(key, "오늘은 이미 먹였다");
                case "stock.why_petted": return ForestLocalization.T(key, "오늘은 이미 쓰다듬었다");
                case "stock.why_off": return ForestLocalization.T(key, "가축 기르기가 꺼져 있다");
                default: return ForestLocalization.T("stock.why_none", "할 수 없다");
            }
        }

        public void PressBuild()
        {
            string why = ForestLivestock.BuildPen();
            DialogueLabel.Instance?.Show(why == null ? ForestLocalization.T("stock.built", "🔨 작은 우리를 지었다 — 꼬꼬·매매 새끼를 들이자") : Why(why), 2.5f);
            Refresh();
        }

        public void PressBuy(string kind)
        {
            string why = ForestLivestock.Buy(kind);
            DialogueLabel.Instance?.Show(why == null ? ForestLocalization.T("stock.bought", "🐣 우리에 들였다 — 날마다 열매를 먹이면 아침에 거둔다") : Why(why), 2.5f);
            Refresh();
        }

        public void PressFeed(int i)
        {
            string why = ForestLivestock.Feed(i);
            DialogueLabel.Instance?.Show(why == null ? ForestLocalization.T("stock.fed_ok", "🍎 먹였다 — 내일 아침에 거둔다") : Why(why), 2f);
            Refresh();
        }

        public void PressPet(int i)
        {
            string why = ForestLivestock.Pet(i);
            DialogueLabel.Instance?.Show(why == null ? string.Format(ForestLocalization.T("stock.pet_ok", "🤚 좋아한다 ♥{0}"), ForestLivestock.List[i].heart) : Why(why), 2f);
            Refresh();
        }
    }
}
