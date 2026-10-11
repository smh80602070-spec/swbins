using System.Collections.Generic;
using TMPro;
using UnityEngine;
using UnityEngine.UI;
using Saga.Core;
using Saga.Story.Data;

namespace Saga.Story.UI
{
    /// <summary>
    /// tasks U-0093 — 레벨업 무예 3택 창(웹 사가종횡 W-0104). <see cref="StorySkillState.PendingPicks"/> 가 있으면 뜬다:
    /// 유파가 서로 다른 무예 셋(이름·유파·지금 Lv·한 줄 효과) 중 하나를 누르면 그 무예 +1, 「거절 — 강화 점수 +1」.
    /// 고를 것이 없어진 장은 저절로 SP 2 로 바꾼다. 씬 재빌드 없이 GameBootstrap 이 <see cref="Install"/> 로 세운다(코드로 짓는 UI).
    /// 창이 떠 있는 동안 주인공은 맞지 않는다(사가나락 축복 3택 U-0076 과 같은 이유 — 고르는 사이 쓰러지면 안 됨).
    /// </summary>
    public class StoryPickUi : MonoBehaviour
    {
        public static StoryPickUi Instance { get; private set; }

        private GameObject _panel;
        private TextMeshProUGUI _title;
        private readonly List<Button> _options = new List<Button>();
        private Button _decline;
        private List<StorySkillData.Skill> _offer = new List<StorySkillData.Skill>();

        public bool IsShowing => _panel != null && _panel.activeSelf;
        public IReadOnlyList<StorySkillData.Skill> Offer => _offer;

        public static StoryPickUi Install()
        {
            if (Instance != null) return Instance;
            return new GameObject("StoryPickUi").AddComponent<StoryPickUi>();
        }

        private void Awake()
        {
            Instance = this;
            Build();
            StorySkillState.PicksChanged += Refresh;
            Refresh();
        }

        private void OnDestroy()
        {
            StorySkillState.PicksChanged -= Refresh;
            StoryPlayerHp.HoldForPick = false;
            if (Instance == this) Instance = null;
        }

        private void Build()
        {
            SagaUi.EnsureEventSystem();
            var canvas = SagaUi.NewHudCanvas("PickCanvas", 95, transform);
            _panel = SagaUi.NewPanel(canvas.transform, "PickPanel", new Vector2(0.5f, 0.5f), new Vector2(0f, 10f), new Vector2(860f, 660f), SagaUi.Panel).gameObject;
            _title = SagaUi.NewText(_panel.transform, "", 34f, SagaUi.Gold, new Vector2(0.5f, 1f), new Vector2(0f, -48f), new Vector2(800f, 70f));
            for (int i = 0; i < 3; i++)
            {
                int at = i;
                var b = SagaUi.NewButton(_panel.transform, $"Pick{i}", "", new Vector2(0.5f, 1f), new Vector2(0f, -140f - 110f * i), new Vector2(780f, 96f), SagaUi.ButtonIdle, 26f);
                b.onClick.AddListener(() => Choose(at));
                _options.Add(b);
            }
            _decline = SagaUi.NewButton(_panel.transform, "Decline", "", new Vector2(0.5f, 0f), new Vector2(0f, 46f), new Vector2(480f, 68f), SagaUi.ButtonAccent, 26f);
            _decline.onClick.AddListener(Decline);
            _panel.SetActive(false);
        }

        /// <summary>장이 남아 있으면 새 셋을 뽑아 띄우고, 없으면 닫는다.</summary>
        public void Refresh()
        {
            if (_panel == null) return;
            if (StorySkillState.PendingPicks <= 0) { Close(); return; }
            if (IsShowing && _offer.Count > 0) return;   // 지금 셋을 고르는 중이면 그대로
            _offer = StorySkillState.Offer3();
            if (_offer.Count == 0) { StorySkillState.Decline(nothingLeft: true); return; }   // 고를 것이 없는 장 = SP 2(다시 Refresh 로 들어온다)
            _title.text = string.Format(StoryLocalization.T("pick.title", "레벨업 — 무예 하나를 고른다 (남은 장 {0})"), StorySkillState.PendingPicks);
            for (int i = 0; i < _options.Count; i++)
            {
                bool on = i < _offer.Count;
                _options[i].gameObject.SetActive(on);
                if (!on) continue;
                var sk = _offer[i];
                var school = StorySkillData.GetSchool(sk.School);
                string name = StoryLocalization.T($"skill.{sk.Key}", sk.Name);
                string desc = StoryLocalization.T($"skill.{sk.Key}.desc", sk.Desc);
                _options[i].GetComponentInChildren<TMP_Text>().text =
                    $"{name} · {(school != null ? school.Name : "-")}  Lv.{StorySkillState.LevelOf(sk.Key)}→{StorySkillState.LevelOf(sk.Key) + 1}\n<size=80%>{desc}</size>";
            }
            _decline.GetComponentInChildren<TMP_Text>().text = StoryLocalization.T("pick.decline", "거절 — 강화 점수 +1");
            _panel.SetActive(true);
            StoryPlayerHp.HoldForPick = true;
        }

        /// <summary>셋 중 i 번을 고른다(진단도 부른다).</summary>
        public void Choose(int i)
        {
            if (i < 0 || i >= _offer.Count) return;
            string key = _offer[i].Key;
            _offer.Clear();
            _panel.SetActive(false);
            StoryPlayerHp.HoldForPick = false;
            if (StorySkillState.Pick(key))
                DialogueLabel.Instance?.Show(string.Format(StoryLocalization.T("pick.done", "{0} +1"), StoryLocalization.T($"skill.{key}", StorySkillData.Get(key)?.Name ?? key)), 2.5f);
            else Refresh();
        }

        public void Decline()
        {
            _offer.Clear();
            _panel.SetActive(false);
            StoryPlayerHp.HoldForPick = false;
            StorySkillState.Decline();
        }

        private void Close()
        {
            _offer.Clear();
            if (_panel != null) _panel.SetActive(false);
            StoryPlayerHp.HoldForPick = false;
        }
    }
}
