using System.Text;
using TMPro;
using UnityEngine;
using UnityEngine.UI;
using Saga.Core;
using Saga.Dungeon.Data;
using Saga.Dungeon.World;

namespace Saga.Dungeon.UI
{
    /// <summary>
    /// tasks U-0195 2나락 시즌 창(고돗 G-0334 `season_button.gd` 짝, 읽기만) — 일시정지 왼쪽 🏆 단추 → 창: 이번 시즌 점수·단계·다음 단계까지 · 좋은 판 다섯 · 지난 시즌 넷 · 단계표 · 닫기.
    /// 열 때 넘어감을 먼저 본다(<see cref="DungeonSeason.Roll"/>). `GameBootstrap.Start` 가 붙인다(씬 재빌드 없음). 이 판엔 ☰ 메뉴 격자가 없어 단추 하나로.
    /// </summary>
    public class DungeonSeasonUi : MonoBehaviour
    {
        /// <summary>오른쪽 위 — 일시정지(오른쪽에서 386, 80 폭) 왼쪽 8 틈. −486 이면 영어 목표판 글(더 길다)과 10px 겹쳤다(UiLayoutCheck).</summary>
        public static readonly Vector2 ButtonAt = new Vector2(-474f, -30f);

        public static DungeonSeasonUi Instance { get; private set; }
        public Button OpenButton { get; private set; }
        public Button CloseButton { get; private set; }
        public TextMeshProUGUI Body { get; private set; }
        private GameObject _panel;

        public bool IsOpen => _panel != null && _panel.activeSelf;

        public static DungeonSeasonUi Install()
        {
            if (Instance != null) return Instance;
            return new GameObject("DungeonSeasonUi").AddComponent<DungeonSeasonUi>();
        }

        private void Awake()
        {
            Instance = this;
            SagaUi.EnsureEventSystem();
            var canvas = SagaUi.NewHudCanvas("DungeonSeasonCanvas", 40, transform);
            OpenButton = SagaUi.NewButton(canvas.transform, "Btn_시즌", "🏆", new Vector2(1f, 1f), ButtonAt, new Vector2(80f, 80f), SagaUi.ButtonIdle, 40f);
            OpenButton.onClick.AddListener(Toggle);
            _panel = SagaUi.NewPanel(canvas.transform, "SeasonPanel", new Vector2(0.5f, 0.5f), Vector2.zero, new Vector2(820f, 700f), new Color(0.07f, 0.07f, 0.09f, 0.97f)).gameObject; // 0.92 면 뒤 지역 글이 비쳤다(촬영)
            SagaUi.NewText(_panel.transform, DungeonLocalization.T("season.title", "🏆 시즌 — 한 주 = 한 시즌(월요일 0시)"), 34f, SagaUi.Gold, new Vector2(0.5f, 1f), new Vector2(0f, -46f), new Vector2(760f, 56f));
            Body = SagaUi.NewText(_panel.transform, "", 22f, SagaUi.Ink, new Vector2(0.5f, 1f), new Vector2(0f, -96f), new Vector2(740f, 470f), TextAlignmentOptions.TopLeft);
            Body.rectTransform.pivot = new Vector2(0.5f, 1f); // 제목 밑에 위로 붙인다(촬영 — 가운데 기준이면 밑으로 처져 닫기와 겹쳤다)
            CloseButton = SagaUi.NewButton(_panel.transform, "Btn_닫기", DungeonLocalization.T("season.close", "닫기"), new Vector2(0.5f, 0f), new Vector2(0f, 56f), new Vector2(260f, 76f), SagaUi.ButtonIdle, 28f);
            CloseButton.onClick.AddListener(Close);
            _panel.SetActive(false);
            OpenButton.gameObject.SetActive(DungeonSeason.On);
        }

        private void OnDestroy() { if (Instance == this) Instance = null; }

        public void Toggle() { if (IsOpen) Close(); else Open(); }

        public void Open()
        {
            if (!DungeonSeason.On) return;
            if (DungeonSeason.Roll(out string rolled) > 0 || rolled.Length > 0) DialogueLabel.Instance?.Show(rolled, 4f);
            _panel.SetActive(true);
            Refresh();
        }

        public void Close() => _panel.SetActive(false);

        public void Refresh()
        {
            if (Body == null) return;
            int score = DungeonSeason.Score, t = DungeonSeason.TierIdx(score);
            var sb = new StringBuilder();
            sb.AppendLine(string.Format(DungeonLocalization.T("season.now", "이번 시즌 {0}점 · {1}"), score, DungeonSeason.TierName(t))
                + (t >= DungeonSeason.Need.Length - 1 ? "" : string.Format(DungeonLocalization.T("season.next", " · {0}까지 {1}"), DungeonSeason.TierName(t + 1), DungeonSeason.Need[t + 1] - score)));
            sb.AppendLine("<size=80%><color=#b8b2a8>" + DungeonLocalization.T("season.rule", "살아 나온 등급 판만 (D1·C2·B3·A4·S5) × 급 — 좋은 판 다섯 합") + "</color></size>");
            sb.AppendLine();
            sb.AppendLine(DungeonLocalization.T("season.runs", "좋은 판"));
            if (DungeonSeason.Runs.Count == 0) sb.AppendLine("  " + DungeonLocalization.T("season.runs_none", "아직 없음 — 층을 살아 내려가면 기록된다"));
            for (int i = 0; i < DungeonSeason.Runs.Count; i++)
            {
                var r = DungeonSeason.Runs[i];
                sb.AppendLine(string.Format(DungeonLocalization.T("season.run", "  {0}. {1} · 급 {2} — {3}점"), i + 1, r.rank, r.tier, r.pts));
            }
            sb.AppendLine();
            sb.Append(DungeonLocalization.T("season.past", "지난 시즌"));
            if (DungeonSeason.PastSeasons.Count == 0) sb.Append(" — " + DungeonLocalization.T("season.past_none", "없음"));
            foreach (var p in DungeonSeason.PastSeasons) sb.Append($"  {DungeonSeason.TierName(p.tierIdx)} {p.score}");
            sb.AppendLine();
            sb.Append("<size=80%><color=#b8b2a8>");
            for (int i = 0; i < DungeonSeason.Need.Length; i++) sb.Append(string.Format(DungeonLocalization.T("season.tier_gold", "{0} {1}→금 {2}  "), DungeonSeason.TierEmoji[i], DungeonSeason.Need[i], DungeonSeason.Gold[i]));
            sb.Append("</color></size>");
            Body.text = sb.ToString();
        }
    }
}
