using TMPro;
using UnityEngine;
using UnityEngine.UI;
using Saga.Dungeon.Data;
using Saga.Dungeon.World;

namespace Saga.Dungeon.UI
{
    /// <summary>
    /// PLAN.md 106-6 "FF 확장" — 왼쪽 위 체력 막대 아래 파티 줄(FF 전투 화면의 이름·HP·ATB 줄을 옮겼다).
    /// 무사 줄 = 이름 · 체력 · 명령 게이지 · [1], 술사 줄 = 이름 · 명령 게이지 · [2](적이 노리지 않아 체력 없음),
    /// 맨 아래 소환 게이지 · [V]. 게이지가 차면 금빛으로 바뀌고 "준비" 가 붙는다. 모바일 버튼 셋(도발·치유·소환)은
    /// 준비되면 진해지고 아니면 흐려진다. 막대는 런타임에 만든다(버튼이 아니라 영속 리스너가 필요 없다).
    /// </summary>
    public class PartyHud : MonoBehaviour
    {
        [SerializeField] private Image tauntButton;
        [SerializeField] private Image healButton;
        [SerializeField] private Image summonButton;

        private static readonly Color BarBg = new Color(0f, 0f, 0f, 0.45f);
        private static readonly Color HpColor = new Color(0.35f, 0.75f, 0.35f);
        private static readonly Color AtbColor = new Color(0.35f, 0.6f, 0.95f);
        private static readonly Color ReadyColor = new Color(1f, 0.8f, 0.25f);
        private static readonly Color SummonColor = new Color(0.8f, 0.55f, 0.25f);
        private static readonly Color DownColor = new Color(0.55f, 0.2f, 0.2f);

        private const float Top = -205f;
        private const float RowH = 40f;

        private TextMeshProUGUI _guardName, _mysticName, _summonName;
        private Image _guardHp, _guardAtb, _mysticAtb, _summon;
        private Color _tauntBase, _healBase, _summonBase;

        public Image GuardAtbFill => _guardAtb;
        public Image SummonFill => _summon;

        private void Awake()
        {
            var root = (RectTransform)transform;
            _guardName = Label(root, "GuardName", 0);
            _guardHp = Bar(root, "GuardHp", 0, 190f, 150f, HpColor);
            _guardAtb = Bar(root, "GuardAtb", 0, 350f, 150f, AtbColor);
            _mysticName = Label(root, "MysticName", 1);
            _mysticAtb = Bar(root, "MysticAtb", 1, 350f, 150f, AtbColor);
            _summonName = Label(root, "SummonName", 2);
            _summon = Bar(root, "SummonGauge", 2, 190f, 310f, SummonColor);
            if (tauntButton != null) _tauntBase = tauntButton.color;
            if (healButton != null) _healBase = healButton.color;
            if (summonButton != null) _summonBase = summonButton.color;
        }

        private void Update() => Refresh();

        public void Refresh()
        {
            var guard = AllyFighter.Instance;
            bool guardUp = guard == null || guard.IsUp;
            bool gReady = PartyState.Ready(PartyRole.Guard);
            bool mReady = PartyState.Ready(PartyRole.Mystic);
            bool sReady = PartyState.SummonReady;

            _guardName.text = DungeonLocalization.T("party.hud_guard", "무사") + DungeonBond.Tag(PartyRole.Guard) + (guardUp ? Tag(gReady, "1") : "  " + DungeonLocalization.T("party.hud_down", "쓰러짐"));
            _guardHp.fillAmount = guard != null ? guard.Hp / AllyFighter.HpMax : 1f;
            _guardHp.color = guardUp ? HpColor : DownColor;
            SetGauge(_guardAtb, PartyState.AtbOf(PartyRole.Guard) / PartyState.AtbMax, gReady);

            _mysticName.text = DungeonLocalization.T("party.hud_mystic", "술사") + DungeonBond.Tag(PartyRole.Mystic) + Tag(mReady, "2");
            SetGauge(_mysticAtb, PartyState.AtbOf(PartyRole.Mystic) / PartyState.AtbMax, mReady);

            _summonName.text = DungeonLocalization.T("party.hud_summon", "소환") + Tag(sReady, "V");
            _summon.fillAmount = PartyState.Summon / PartyState.SummonMax;
            _summon.color = sReady ? ReadyColor : SummonColor;

            Dim(tauntButton, _tauntBase, gReady && guardUp);
            Dim(healButton, _healBase, mReady);
            Dim(summonButton, _summonBase, sReady);
        }

        private static string Tag(bool ready, string key) =>
            ready ? $"  {DungeonLocalization.T("party.hud_ready", "준비")} [{key}]" : $"  [{key}]";

        private static void SetGauge(Image fill, float frac, bool ready)
        {
            fill.fillAmount = Mathf.Clamp01(frac);
            fill.color = ready ? ReadyColor : AtbColor;
        }

        private static void Dim(Image img, Color baseColor, bool ready)
        {
            if (img == null) return;
            img.color = new Color(baseColor.r, baseColor.g, baseColor.b, ready ? Mathf.Max(0.8f, baseColor.a) : baseColor.a * 0.45f);
        }

        private static TextMeshProUGUI Label(RectTransform root, string name, int row)
        {
            var go = new GameObject(name, typeof(RectTransform));
            go.transform.SetParent(root, false);
            var rt = (RectTransform)go.transform;
            rt.anchorMin = rt.anchorMax = rt.pivot = new Vector2(0f, 1f);
            rt.anchoredPosition = new Vector2(20f, Top - row * RowH);
            rt.sizeDelta = new Vector2(180f, 30f);
            var t = go.AddComponent<TextMeshProUGUI>();
            t.fontSize = 22;
            t.color = Color.white;
            t.alignment = TextAlignmentOptions.Left;
            t.textWrappingMode = TextWrappingModes.NoWrap;
            t.raycastTarget = false;
            Saga.Core.TmpEffect.Add(go, Saga.Core.TmpEffect.Kind.Shadow, new Color(0f, 0f, 0f, 0.8f), 0.3f);
            return t;
        }

        private static Image Bar(RectTransform root, string name, int row, float x, float width, Color color)
        {
            var bg = new GameObject(name + "Bg", typeof(RectTransform));
            bg.transform.SetParent(root, false);
            var brt = (RectTransform)bg.transform;
            brt.anchorMin = brt.anchorMax = brt.pivot = new Vector2(0f, 1f);
            // 이름 칸(180px) 뒤에 "준비 [1]" 글자가 붙어도 겹치지 않게 막대는 이름 줄 오른쪽 아래로 붙인다.
            brt.anchoredPosition = new Vector2(20f + x, Top - row * RowH - 8f);
            brt.sizeDelta = new Vector2(width, 14f);
            var bgImg = bg.AddComponent<Image>();
            bgImg.color = BarBg;
            bgImg.raycastTarget = false;

            var fill = new GameObject("Fill", typeof(RectTransform));
            fill.transform.SetParent(bg.transform, false);
            var frt = (RectTransform)fill.transform;
            frt.anchorMin = Vector2.zero;
            frt.anchorMax = Vector2.one;
            frt.offsetMin = frt.offsetMax = Vector2.zero;
            var img = fill.AddComponent<Image>();
            img.color = color;
            img.type = Image.Type.Filled;
            img.fillMethod = Image.FillMethod.Horizontal;
            img.fillOrigin = (int)Image.OriginHorizontal.Left;
            img.raycastTarget = false;
            return img;
        }
    }
}
