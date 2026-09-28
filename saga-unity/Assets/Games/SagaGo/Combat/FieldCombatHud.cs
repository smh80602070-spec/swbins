using TMPro;
using UnityEngine;
using UnityEngine.UI;
using Saga.Go.Data;
using Saga.Go.UI;

namespace Saga.Go.Combat
{
    /// <summary>
    /// PLAN.md 107-1 "HUD" — `FieldCombat.Start()` 가 런타임에 만든다(씬 빌더가 건 리스너는 저장 안 되는
    /// 함정을 아예 피한다 — 런타임 리스너라 `ButtonWiringCheck` 도 산 버튼으로 본다).
    /// 아래 가운데: 나선 인물 이름·체력·원소 기력·스태미나. 오른쪽: 명단 넷(탭하면 교체).
    /// 오른쪽 아래: 공격·스킬·폭발·회피 버튼(모바일, PC 에선 J·E·Q·L 과 같다).
    /// </summary>
    public class FieldCombatHud : MonoBehaviour
    {
        private const float RefreshSec = 0.1f;

        private FieldCombat _combat;
        private GameObject _root;
        private TextMeshProUGUI _nameText;
        private Image _hpFill;
        private Image _energyFill;
        private Image _staminaFill;
        private TextMeshProUGUI _skillLabel;
        private Image _skillImage;
        private TextMeshProUGUI _burstLabel;
        private Image _burstImage;
        private readonly Button[] _rosterButtons = new Button[FieldCombat.MaxParty];
        private readonly TextMeshProUGUI[] _rosterTexts = new TextMeshProUGUI[FieldCombat.MaxParty];
        private readonly Image[] _rosterHp = new Image[FieldCombat.MaxParty];
        private float _refresh;

        public GameObject Root => _root;
        public Button AttackButton { get; private set; }
        public Button SkillButton { get; private set; }
        public Button BurstButton { get; private set; }
        public Button DodgeButton { get; private set; }
        public Button JumpButton { get; private set; }
        /// <summary>109-14-3b 원소 시야 켜고 끄기(폰 — PC 는 V 를 누르는 동안).</summary>
        public Button SightButton { get; private set; }
        public Button RosterButton(int i) => _rosterButtons[i];
        public string RosterText(int i) => _rosterTexts[i].text;

        private void Start()
        {
            _combat = GetComponent<FieldCombat>();
            Build();
            Refresh();
        }

        private void Build()
        {
            var canvas = EncounterUiKit.NewCanvas("FieldCombatHUD");
            canvas.sortingOrder = 3;
            _root = canvas.gameObject;
            var t = canvas.transform;

            // 아래 가운데 — 상태
            _nameText = EncounterUiKit.NewText(t, "", new Vector2(0.5f, 0f), new Vector2(0f, 150f), new Vector2(460f, 40f), 26);
            _hpFill = Bar(t, new Vector2(0f, 112f), new Vector2(460f, 24f), new Color(0.35f, 0.85f, 0.35f, 0.95f));
            _energyFill = Bar(t, new Vector2(0f, 92f), new Vector2(460f, 10f), new Color(1f, 0.85f, 0.3f, 0.95f));
            _staminaFill = Bar(t, new Vector2(0f, 196f), new Vector2(280f, 10f), new Color(0.9f, 1f, 0.6f, 0.9f));

            // 왼쪽 가운데 — 명단(110 ⑤b: 오른쪽은 위 버튼 줄·아래 전투 버튼과 겹쳐 비어 있는 왼쪽으로. 위 HUD 줄 밑·조이스틱 위)
            for (int i = 0; i < FieldCombat.MaxParty; i++)
            {
                var b = EncounterUiKit.NewButton(t, "", new Vector2(0f, 0.5f), new Vector2(20f, 170f - i * 90f), new Vector2(270f, 80f), null);
                switch (i)
                {
                    case 0: b.onClick.AddListener(Swap0); break;
                    case 1: b.onClick.AddListener(Swap1); break;
                    case 2: b.onClick.AddListener(Swap2); break;
                    default: b.onClick.AddListener(Swap3); break;
                }
                _rosterButtons[i] = b;
                _rosterTexts[i] = b.GetComponentInChildren<TextMeshProUGUI>();
                _rosterTexts[i].fontSize = 24;
                _rosterTexts[i].alignment = TextAlignmentOptions.Top;
                _rosterHp[i] = Bar(b.transform, new Vector2(0f, 10f), new Vector2(230f, 8f), new Color(0.35f, 0.85f, 0.35f, 0.9f), new Vector2(0.5f, 0f));
            }

            // 오른쪽 아래 — 행동 버튼
            AttackButton = EncounterUiKit.NewButton(t, GoLocalization.T("field.btn.attack", "공격"), new Vector2(1f, 0f), new Vector2(-50f, 60f), new Vector2(190f, 190f), null);
            AttackButton.onClick.AddListener(OnAttack);
            // 109-14-2 누르고 있으면 강공격
            _attackHold = AttackButton.gameObject.AddComponent<AttackHoldButton>();
            _attackHold.Combat = _combat;
            SkillButton = EncounterUiKit.NewButton(t, "", new Vector2(1f, 0f), new Vector2(-270f, 70f), new Vector2(150f, 150f), null);
            SkillButton.onClick.AddListener(OnSkill);
            _skillLabel = SkillButton.GetComponentInChildren<TextMeshProUGUI>();
            _skillImage = SkillButton.GetComponent<Image>();
            BurstButton = EncounterUiKit.NewButton(t, "", new Vector2(1f, 0f), new Vector2(-70f, 280f), new Vector2(150f, 150f), null);
            BurstButton.onClick.AddListener(OnBurst);
            _burstLabel = BurstButton.GetComponentInChildren<TextMeshProUGUI>();
            _burstImage = BurstButton.GetComponent<Image>();
            DodgeButton = EncounterUiKit.NewButton(t, GoLocalization.T("field.btn.dodge", "회피"), new Vector2(1f, 0f), new Vector2(-260f, 250f), new Vector2(140f, 110f), null);
            DodgeButton.onClick.AddListener(OnDodge);
            // PLAN.md 107 ② — 점프(공중에서 한 번 더 = 활공, 등반 중 = 도약).
            JumpButton = EncounterUiKit.NewButton(t, GoLocalization.T("field.btn.jump", "점프"), new Vector2(1f, 0f), new Vector2(-450f, 60f), new Vector2(140f, 140f), null);
            JumpButton.onClick.AddListener(OnJump);
            // 109-14-7 때 배치 점검 — 조우 창 가운데 단추(560 폭)와 안 겹치게 오른쪽으로(회피 단추와 5 띄움)
            SightButton = EncounterUiKit.NewButton(t, GoLocalization.T("field.btn.sight", "시야"), new Vector2(1f, 0f), new Vector2(-405f, 225f), new Vector2(110f, 90f), null);
            SightButton.onClick.AddListener(OnSight);
            // 109-14-22 활 조준 — 회피 위(활 인물일 때만), 화면 가운데 조준점·충전
            AimButton = EncounterUiKit.NewButton(t, GoLocalization.T("field.btn.aim", "🎯 조준\n(R)"), new Vector2(1f, 0f), new Vector2(-260f, 370f), new Vector2(140f, 100f), null);
            AimButton.onClick.AddListener(OnAim);
            AimButton.GetComponentInChildren<TextMeshProUGUI>().fontSize = 22;
            _aimText = EncounterUiKit.NewText(t, "", new Vector2(0.5f, 0.5f), new Vector2(0f, 0f), new Vector2(360f, 110f), 30);
            _aimText.rectTransform.pivot = new Vector2(0.5f, 0.5f);
            _aimText.alignment = TextAlignmentOptions.Center;
            _aimText.raycastTarget = false;
            _aimText.gameObject.SetActive(false);
        }

        public Button AimButton { get; private set; }
        private TextMeshProUGUI _aimText;
        public string AimText => _aimText != null && _aimText.gameObject.activeSelf ? _aimText.text : "";
        private void OnAim() => _combat.ToggleAim();

        private void OnSight()
        {
            var s = Saga.Go.World.ElementalSight.Instance;
            if (s != null) s.Toggled = !s.Toggled;
        }

        private static Image Bar(Transform parent, Vector2 pos, Vector2 size, Color color, Vector2? anchor = null)
        {
            Vector2 a = anchor ?? new Vector2(0.5f, 0f);
            var bg = new GameObject("Bar", typeof(RectTransform));
            bg.transform.SetParent(parent, false);
            var r = (RectTransform)bg.transform;
            r.anchorMin = r.anchorMax = a;
            r.pivot = new Vector2(0.5f, 0.5f);
            r.anchoredPosition = pos;
            r.sizeDelta = size;
            var bgImg = bg.AddComponent<Image>();
            bgImg.color = new Color(0f, 0f, 0f, 0.45f);
            bgImg.raycastTarget = false;

            var fillGo = new GameObject("Fill", typeof(RectTransform));
            fillGo.transform.SetParent(bg.transform, false);
            var fr = (RectTransform)fillGo.transform;
            fr.anchorMin = Vector2.zero;
            fr.anchorMax = Vector2.one;
            fr.offsetMin = fr.offsetMax = Vector2.zero;
            var fill = fillGo.AddComponent<Image>();
            fill.color = color;
            fill.type = Image.Type.Filled;
            fill.fillMethod = Image.FillMethod.Horizontal;
            fill.raycastTarget = false;
            return fill;
        }

        private void Update()
        {
            _refresh -= Time.unscaledDeltaTime;
            if (_refresh > 0f) return;
            _refresh = RefreshSec;
            Refresh();
        }

        public void Refresh()
        {
            if (_combat == null || _root == null) return;
            bool show = !DuelGate.Active;
            if (_root.activeSelf != show) _root.SetActive(show);
            var m = _combat.Active;
            if (m == null) return;
            if (_combat.AimOn) _refresh = 0.05f; // 109-14-22 충전 글이 부드럽게

            _nameText.text = $"{m.Name}  <color=#{ColorUtility.ToHtmlStringRGB(GoElements.ColorOf(m.Element))}>● {GoElements.NameOf(m.Element)}</color>  {Mathf.CeilToInt(m.Hp)}/{Mathf.CeilToInt(m.MaxHp)}";
            if (_combat.GuardHp > 0f) // 109-14-1a 굳힘 보호막 — 남은 양·초
                _nameText.text += $"  <color=#{ColorUtility.ToHtmlStringRGB(GoElements.ColorOf(GoElement.Geo))}>" +
                    string.Format(GoLocalization.T("field.hud.guard", "굳힘 {0} · {1}초"), Mathf.CeilToInt(_combat.GuardHp), Mathf.CeilToInt(_combat.GuardLeft)) + "</color>";
            _hpFill.fillAmount = m.MaxHp > 0f ? m.Hp / m.MaxHp : 0f;
            _energyFill.fillAmount = m.Energy / FieldCombat.BurstCost;
            _staminaFill.fillAmount = GoStamina.Value / GoStamina.Max;
            _staminaFill.color = GoStamina.SprintLocked ? new Color(1f, 0.45f, 0.3f, 0.9f) : new Color(0.9f, 1f, 0.6f, 0.9f);

            Color ec = GoElements.ColorOf(m.Element);
            var hk = GoKits.KitOf(m.Id, m.Element); // 109-14-11 고유·갈래면 그 스킬 이름
            string skillName = hk != null ? hk.Skill.Name : GoSkillShapes.Name(GoSkillShapes.ShapeOf(m.Id)); // 109-8 — 동행마다 모양 이름(주인공 = 스킬)
            _skillLabel.text = m.SkillCd > 0f
                ? $"{skillName}\n{Mathf.CeilToInt(m.SkillCd)}"
                : $"{skillName}\n(E)";
            _skillImage.color = new Color(ec.r, ec.g, ec.b, m.SkillCd > 0f ? 0.15f : 0.45f);
            _burstLabel.text = m.BurstReady
                ? $"{GoLocalization.T("field.btn.burst", "해방")}\n★ (Q)"
                : $"{GoLocalization.T("field.btn.burst", "해방")}\n{Mathf.FloorToInt(m.Energy)}%";
            _burstImage.color = new Color(ec.r, ec.g, ec.b, m.BurstReady ? 0.6f : 0.15f);
            // 109-14-22 활 인물이면 조준 단추, 조준 중이면 가운데 조준점(잠기면 금빛)·충전
            if (AimButton != null)
            {
                bool bow = FieldCombat.IsBow(m);
                AimButton.gameObject.SetActive(bow);
                if (bow) AimButton.GetComponent<Image>().color = _combat.AimOn ? new Color(1f, 0.82f, 0.3f, 0.55f) : new Color(1f, 1f, 1f, 0.18f);
                _aimText.gameObject.SetActive(_combat.AimOn);
                if (_combat.AimOn)
                {
                    bool locked = _combat.AimLock.Kind != FieldCombat.AimKind.None;
                    string mark = locked ? "<color=#ffd24d>◎</color>" : "◎";
                    _aimText.text = _combat.Charging
                        ? mark + "\n<size=60%>" + string.Format(GoLocalization.T("field.aim_charge", "충전 {0}%"), Mathf.RoundToInt(_combat.AimCharge / FieldCombat.AimChargeSec * 100f)) + "</size>"
                        : mark;
                }
            }

            var party = _combat.Party;
            for (int i = 0; i < FieldCombat.MaxParty; i++)
            {
                bool has = i < party.Count;
                _rosterButtons[i].gameObject.SetActive(has);
                if (!has) continue;
                var p = party[i];
                string mark = p.BurstReady ? " ★" : "";
                _rosterTexts[i].text = $"{i + 1}  {p.Name}  <color=#{ColorUtility.ToHtmlStringRGB(GoElements.ColorOf(p.Element))}>●</color>{mark}";
                _rosterTexts[i].color = p.Down ? new Color(0.6f, 0.6f, 0.6f) : Color.white;
                _rosterHp[i].fillAmount = p.MaxHp > 0f ? p.Hp / p.MaxHp : 0f;
                _rosterButtons[i].GetComponent<Image>().color = i == _combat.ActiveIndex
                    ? new Color(1f, 1f, 1f, 0.42f) : new Color(1f, 1f, 1f, 0.14f);
            }
        }

        private AttackHoldButton _attackHold;

        private void OnAttack()
        {
            if (_attackHold != null && _attackHold.ConsumeClick()) return; // 강공격이 나간 뒤 뗀 클릭
            _combat.AttackPress();
        }
        private void OnSkill() => _combat.Skill();
        private void OnBurst() => _combat.Burst();
        private void OnDodge() => _combat.Dodge();
        private void OnJump()
        {
            var pc = GetComponent<Saga.Go.Player.PlayerController>();
            if (pc != null) pc.RequestJump();
        }
        private void Swap0() => _combat.Swap(0);
        private void Swap1() => _combat.Swap(1);
        private void Swap2() => _combat.Swap(2);
        private void Swap3() => _combat.Swap(3);
    }
}
