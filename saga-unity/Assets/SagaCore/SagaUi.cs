using TMPro;
using UnityEngine;
using UnityEngine.EventSystems;
using UnityEngine.InputSystem.UI;
using UnityEngine.SceneManagement;
using UnityEngine.UI;

namespace Saga.Core
{
    /// <summary>
    /// PLAN.md 110 ② — 상용화 새 UI 의 공통 도구(타이틀·일시정지 메뉴가 먼저 쓴다, 110 ⑤ 에서 판별 HUD 도 이리로).
    /// 글자는 전부 TextMeshPro(기본 폰트 = TMP 설정의 Noto Sans KR 동적 SDF — `Editor/SetupSagaFonts`).
    /// 캔버스는 가로 1920×1080 기준·Expand(기준 영역이 통째로 들어감, 20:9 = 2400×1080·4:3 = 1920×1440) —
    /// 부르는 쪽이 <see cref="IsNarrow"/> 로 줄 배치를 고른다.
    /// </summary>
    public static class SagaUi
    {
        public static readonly Vector2 Reference = new Vector2(1920f, 1080f);
        public static readonly Color Ink = new Color(0.95f, 0.93f, 0.88f);
        public static readonly Color InkDim = new Color(0.72f, 0.70f, 0.66f);
        public static readonly Color Gold = new Color(0.95f, 0.78f, 0.38f);
        public static readonly Color Panel = new Color(0.07f, 0.07f, 0.09f, 0.92f);
        public static readonly Color ButtonIdle = new Color(0.18f, 0.17f, 0.2f, 0.95f);
        public static readonly Color ButtonAccent = new Color(0.62f, 0.42f, 0.16f, 0.98f);

        /// <summary>PLAN.md 110 ⑤b — 다섯 판 HUD 캔버스의 기준(가로 1600×900, Expand). 옛 기준은 세로 1080×1920·폭 맞춤이라
        /// 가로 화면에서 논리 높이가 607(16:9)·486(20:9)으로 줄어 버튼끼리 부딪혔다. Expand 는 기준 영역이 어느 화면비에서도
        /// 통째로 들어가고 남는 쪽만 넓어진다(16:9 = 1600×900, 20:9 = 2000×900, 4:3 = 1600×1200).</summary>
        public static readonly Vector2 GameReference = new Vector2(1600f, 900f);

        /// <summary>판 HUD 캔버스 스케일러 한 곳 — 빌더·런타임·설정의 UI 크기(배수)가 다 이것을 부른다.</summary>
        public static void ApplyGameScaler(CanvasScaler scaler, float uiScale = 1f)
        {
            if (scaler == null || scaler.GetComponent<MenuCanvas>() != null) return; // 타이틀·일시정지 메뉴는 제 기준 유지
            scaler.uiScaleMode = CanvasScaler.ScaleMode.ScaleWithScreenSize;
            scaler.screenMatchMode = CanvasScaler.ScreenMatchMode.Expand;
            scaler.referenceResolution = GameReference / Mathf.Max(0.01f, uiScale);
        }

        /// <summary>PLAN.md 110 ⑤c — 공통 UI(타이틀·일시정지)의 언어. 판 설정의 언어는 판마다 따로 저장되고(PlayerPrefs),
        /// 타이틀이 켜질 때·타이틀 설정에서 바꿀 때 여기에 적는다(SagaCore 는 판 어셈블리를 모른다). 기본 "ko".</summary>
        public static string Lang = "ko";
        public static bool En => Lang == "en";
        public static string L(string ko, string en) => En ? en : ko;

        /// <summary>PLAN.md 110 ⑤c-2c-2 — 판 번역 표에 키가 없어 폴백(보통 한국어)을 돌려줄 때 부른다(판, 키, 폴백). 에디터 도구 `HangulWatch` 가 듣는다.</summary>
        public static System.Action<string, string, string> MissingText;

        /// <summary>판 HUD 와 같은 기준(1600×900 Expand)의 메뉴 캔버스 — 판 HUD 옆에 붙는 공통 단추(일시정지)용.
        /// 판 설정의 "UI 크기"는 이 캔버스를 건너뛴다(<see cref="MenuCanvas"/>).</summary>
        public static Canvas NewHudCanvas(string name, int sortingOrder, Transform parent = null)
        {
            var canvas = NewCanvas(name, sortingOrder, parent);
            canvas.GetComponent<CanvasScaler>().referenceResolution = GameReference;
            return canvas;
        }

        /// <summary>씬의 판 HUD 스케일러 하나(메뉴 캔버스 — 타이틀·일시정지·Ⅱ 단추 — 는 뺀다). 진단의 "UI 크기가 먹나" 검사용.</summary>
        public static CanvasScaler FirstGameScaler()
        {
            foreach (var s in Object.FindObjectsByType<CanvasScaler>(FindObjectsSortMode.InstanceID))
                if (s.GetComponent<MenuCanvas>() == null) return s;
            return null;
        }

        public static Canvas NewCanvas(string name, int sortingOrder, Transform parent = null)
        {
            var go = new GameObject(name);
            if (parent != null) go.transform.SetParent(parent, false);
            var canvas = go.AddComponent<Canvas>();
            canvas.renderMode = RenderMode.ScreenSpaceOverlay;
            canvas.sortingOrder = sortingOrder;
            var scaler = go.AddComponent<CanvasScaler>();
            scaler.uiScaleMode = CanvasScaler.ScaleMode.ScaleWithScreenSize;
            scaler.referenceResolution = Reference;
            scaler.screenMatchMode = CanvasScaler.ScreenMatchMode.Expand; // 110 ⑤b — 1920×1080 이 어느 화면비에서도 통째로 들어간다
            go.AddComponent<GraphicRaycaster>();
            go.AddComponent<MenuCanvas>();
            return canvas;
        }

        /// <summary>세로 화면이면 true — 캔버스 논리 폭이 1400 밑으로 줄어 줄 배치를 세로로 바꾼다
        /// (캔버스 rect 는 스케일러가 한 프레임 뒤에 잡아 Awake 에선 못 믿는다).</summary>
        public static bool IsNarrow() => Screen.height > Screen.width;

        /// <summary>UI 가 눌리려면 씬에 EventSystem 이 하나 있어야 한다 — 없으면 새 입력 시스템 모듈로 만든다.</summary>
        public static void EnsureEventSystem()
        {
            if (Object.FindFirstObjectByType<EventSystem>() != null) return;
            var es = new GameObject("EventSystem");
            es.AddComponent<EventSystem>();
            es.AddComponent<InputSystemUIInputModule>();
        }

        public static RectTransform NewRect(Transform parent, string name, Vector2 anchor, Vector2 pos, Vector2 size)
        {
            var go = new GameObject(name, typeof(RectTransform));
            go.transform.SetParent(parent, false);
            var rt = (RectTransform)go.transform;
            rt.anchorMin = rt.anchorMax = rt.pivot = anchor;
            rt.anchoredPosition = pos;
            rt.sizeDelta = size;
            return rt;
        }

        /// <summary>부모를 꽉 채우는 칸.</summary>
        public static RectTransform Fill(Transform parent, string name)
        {
            var rt = NewRect(parent, name, new Vector2(0.5f, 0.5f), Vector2.zero, Vector2.zero);
            rt.anchorMin = Vector2.zero;
            rt.anchorMax = Vector2.one;
            rt.offsetMin = rt.offsetMax = Vector2.zero;
            return rt;
        }

        /// <summary>U-0153 — 판 짧은 이름(K-0040 UI 스킨 폴더 = 웹 `shared/assets/ui/<판>`). 모르는 씬(타이틀 등)은 null.</summary>
        public static string SkinFor(string sceneName)
        {
            switch (sceneName)
            {
                case "TestVillage": return "go";
                case "TestDungeon": return "dungeon";
                case "TestVillageForest": return "forest";
                case "TestField": return "story";
                case "TestCity": return "realm";
                default: return null;
            }
        }

        /// <summary>지금 판의 스킨 — 판 씬이 아니면(타이틀) 1만리 색.</summary>
        public static string Skin => SkinFor(SceneManager.GetActiveScene().name) ?? "go";

        /// <summary>진단용 — true 면 스킨이 있어도 단색(스킨 없는 PC 와 같은 모양).</summary>
        public static bool SkinOff;

        private static readonly System.Collections.Generic.Dictionary<string, Sprite> PartCache = new System.Collections.Generic.Dictionary<string, Sprite>();

        /// <summary>UI 스킨 부품 하나(`Resources/UI/<판>/<부품>` — window·popup·card·tab_on·tab_off·btn_normal·btn_hover·btn_pressed·btn_disabled).
        /// K-0173 이 놓기 전·스킨 없는 PC 면 null → 부르는 쪽은 지금 단색.</summary>
        public static Sprite Part(string part, string skin = null)
        {
            if (SkinOff || string.IsNullOrEmpty(part)) return null;
            var key = (skin ?? Skin) + "/" + part;
            if (!PartCache.TryGetValue(key, out var s))
            {
                s = Resources.Load<Sprite>("UI/" + key);
                PartCache[key] = s;
            }
            return s;
        }

        /// <summary>그림은 2배로 그려져 있다(웹 `border-image: 32 / 16px`) — 모서리를 반으로 줄여 놓는다.</summary>
        private const float SkinPixelsMul = 2f;

        /// <summary>스킨 부품이 있으면 Sliced + 흰 색조로 입힌다. 입혔으면 true.</summary>
        public static bool ApplySkin(Image img, string part, string skin = null)
        {
            var s = Part(part, skin);
            if (img == null || s == null) return false;
            img.sprite = s;
            img.type = Image.Type.Sliced;
            img.pixelsPerUnitMultiplier = SkinPixelsMul;
            img.color = Color.white;
            return true;
        }

        /// <summary>part 를 주면(window·popup·card) 스킨이 있을 때 그 틀을 입고, 없으면 color 단색 — 배치·크기는 같다.</summary>
        public static Image NewPanel(Transform parent, string name, Vector2 anchor, Vector2 pos, Vector2 size, Color color,
            string part = null, string skin = null)
        {
            var img = NewRect(parent, name, anchor, pos, size).gameObject.AddComponent<Image>();
            img.color = color;
            if (part != null) ApplySkin(img, part, skin);
            return img;
        }

        /// <summary>U-0153 촬영 — 창이 판 HUD(정렬 3~9) 밑에 깔려 HUD 글이 창 위로 비치던 것. 창 오브젝트에 제 캔버스(정렬 덮어쓰기)를 달아 order 로 올린다.
        /// 단추가 눌리게 GraphicRaycaster 도. 일시정지(200)·세션 카드(100) 밑 · ☰ 메뉴 화면 150 · 판 창 120.</summary>
        public const int WindowOrder = 120, MenuOrder = 150;

        public static void Lift(GameObject go, int order)
        {
            if (go == null) return;
            var c = go.GetComponent<Canvas>();
            if (c == null) c = go.AddComponent<Canvas>(); // ?? 는 유니티 가짜 null 을 못 거른다
            c.overrideSorting = true;
            c.sortingOrder = order;
            if (go.GetComponent<GraphicRaycaster>() == null) go.AddComponent<GraphicRaycaster>();
            // 꺼진 채 단 캔버스는 overrideSorting 이 안 먹는다(설정 창은 Start 때 꺼져 있다) — 켜질 때마다 다시 건다
            var keep = go.GetComponent<SortKeep>();
            if (keep == null) keep = go.AddComponent<SortKeep>();
            keep.Order = order;
        }

        /// <summary><see cref="Lift"/> 짝 — 켜질 때 정렬을 다시 건다.</summary>
        public class SortKeep : MonoBehaviour
        {
            public int Order;
            private void OnEnable()
            {
                var c = GetComponent<Canvas>();
                if (c == null) return;
                c.overrideSorting = true;
                c.sortingOrder = Order;
            }
        }

        /// <summary>U-0153 촬영 — 판 창(설정 등) 겉옷 한 번에: window 틀 + 판 HUD 위 정렬. 씬에 구워진 창도 Start 에서 부르면 된다(여러 번 불러도 같음).</summary>
        public static void DressWindow(GameObject panel)
        {
            if (panel == null) return;
            ApplySkin(panel.GetComponent<Image>(), "window");
            Lift(panel, WindowOrder);
        }

        public static TextMeshProUGUI NewText(Transform parent, string text, float fontSize, Color color,
            Vector2 anchor, Vector2 pos, Vector2 size, TextAlignmentOptions align = TextAlignmentOptions.Center)
        {
            var t = NewRect(parent, "Text", anchor, pos, size).gameObject.AddComponent<TextMeshProUGUI>();
            t.text = text;
            t.fontSize = fontSize;
            t.color = color;
            t.alignment = align;
            t.textWrappingMode = TextWrappingModes.Normal;
            t.raycastTarget = false;
            return t;
        }

        public static Button NewButton(Transform parent, string name, string label, Vector2 anchor, Vector2 pos, Vector2 size,
            Color color, float fontSize = 34f, string skin = null)
        {
            var rt = NewRect(parent, name, anchor, pos, size);
            var img = rt.gameObject.AddComponent<Image>();
            img.color = color;
            var b = rt.gameObject.AddComponent<Button>();
            b.targetGraphic = img;
            // U-0153 — 보통 단추(ButtonIdle)만 판 색 옷. 할 일 단추(ButtonAccent)는 웹 `.btn.primary` 처럼 금빛 단색 그대로
            if (color == ButtonIdle && ApplySkin(img, "btn_normal", skin))
            {
                b.transition = Selectable.Transition.SpriteSwap;
                var st = b.spriteState;
                st.highlightedSprite = Part("btn_hover", skin);
                st.selectedSprite = null; // 누른 뒤 고른 채로 남아도 보통 모양(hover 로 남으면 폰에서 눌린 듯 보인다)
                st.pressedSprite = Part("btn_pressed", skin);
                st.disabledSprite = Part("btn_disabled", skin);
                b.spriteState = st;
            }
            else
            {
                var colors = b.colors;
                colors.highlightedColor = new Color(1.15f, 1.15f, 1.15f);
                colors.pressedColor = new Color(0.8f, 0.8f, 0.8f);
                b.colors = colors;
            }
            var t = NewText(rt, label, fontSize, Ink, new Vector2(0.5f, 0.5f), Vector2.zero, size);
            t.rectTransform.anchorMin = Vector2.zero;
            t.rectTransform.anchorMax = Vector2.one;
            t.rectTransform.offsetMin = new Vector2(8f, 4f);
            t.rectTransform.offsetMax = new Vector2(-8f, -4f);
            t.fontStyle = FontStyles.Bold;
            return b;
        }

        public static string Label(Button b) => b.GetComponentInChildren<TMP_Text>().text;
    }
}
