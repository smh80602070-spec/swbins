using TMPro;
using UnityEngine;
using UnityEngine.UI;
using Saga.Dungeon.Data;
using Saga.Dungeon.World;

namespace Saga.Dungeon.UI
{
    /// <summary>
    /// VERTICAL_SLICE_DUNGEON.md 완료 조건 "공격력이 올랐다는 걸 화면에서
    /// 확인한다" — GO의 UI/PlayerHud.cs와 같은 결(항상 보이는 최소 상태
    /// 표시줄, 릴리즈 빌드에서도 항상 보임).
    /// </summary>
    public class PlayerHud : MonoBehaviour
    {
        [SerializeField] private TextMeshProUGUI label;

        // "HUD 개선" 슬라이스(PLAN.md 26장) — 숫자 텍스트뿐이던 체력 표시에
        // 시각적 게이지를 더한다. Image.Type.Filled(Horizontal)라 값만
        // 매 프레임 바꾸면 돼 텍스트 갱신과 같은 타이머를 그대로 쓴다.
        [SerializeField] private Image healthBarFill;

        private const float RefreshGapSec = 0.5f;
        private float _timer;

        private void Start()
        {
            Refresh();
        }

        private void Update()
        {
            _timer += Time.unscaledDeltaTime;
            if (_timer < RefreshGapSec) return;
            _timer = 0f;
            Refresh();
        }

        private void Refresh()
        {
            if (label == null) return;
            string weapon = HeroState.EquippedWeapon?.Name ?? DungeonLocalization.T("item.bare_hands");
            var lore = SecretState.EquippedLore; // PLAN.md 109-10-2 비전
            if (lore != Secret.None) weapon += string.Format(DungeonLocalization.T("lore.hud", " [비전 {0}]"), SecretState.LoreName(lore));
            // "절차적 층 진행" 슬라이스 — ProcRoom에 아직 안 닿았으면(Room1~4,
            // 개념상 "층1") DungeonFloorRunner.Instance가 null이라 1로 대신함.
            int floor = DungeonFloorRunner.Instance?.CurrentFloor ?? 1;
            string hp = string.Format(DungeonLocalization.T("hud.hp"), HeroState.Hp, HeroState.HpMax);
            string exp = string.Format(DungeonLocalization.T("hud.exp"), HeroState.Exp, HeroState.ExpToNext);
            string gold = string.Format(DungeonLocalization.T("hud.gold"), HeroState.Gold);
            string atk = string.Format(DungeonLocalization.T("hud.atk"), HeroState.Atk);
            string floorLine = string.Format(DungeonLocalization.T("hud.floor"), floor);
            // PLAN.md 109-10-5 — 바깥 칸에선 층 대신 "위험 N"(웹 HUD 결). 웹의 "들판 HUD 머리 = 지역 이름"은 이 줄이 무기 이름과
            // 한 줄이라 영어에서 넘쳐(목표판과 겹침) 뺐다 — 지역 이름은 들어섬 배너·M 지도가 보여 준다.
            int region = DungeonRegionTracker.Instance != null ? DungeonRegionTracker.Instance.Current : -1;
            if (region >= 0) floorLine = DungeonRegionFoes.DangerLabel(region);
            string landmark = DungeonFloorRunner.Instance?.LandmarkHud ?? ""; // PLAN.md 108 ③ 명소 층
            if (landmark.Length > 0) floorLine += "  " + landmark;
            label.text = $"Lv.{HeroState.Level}  {hp}  ({exp})  {gold}\n" +
                         $"{weapon} ({atk})  {floorLine}\n" +
                         $"{QuestState.ObjectiveText}"; // "퀘스트 시스템" 슬라이스

            // PLAN.md 106-2 "잊힌 능묘" — 한 번 들어간 뒤부터 열쇠·도구 줄.
            string temple = TempleState.HudLine();
            if (temple.Length > 0) label.text += $"\n{temple}";

            // PLAN.md 109-10-3 시련 — 단계·남은 시간(1분 미만 붉게)·진척 또는 수호자.
            string trial = TrialRunner.HudLine();
            if (trial.Length > 0) label.text += $"\n{trial}";

            // PLAN.md 101-2 5.4 "월드 보스" — 75초 두목전이 진행 중일 때만 카운트다운을 얹는다.
            var worldBoss = DungeonEnemy.ActiveWorldBoss;
            if (worldBoss != null)
            {
                string timer = string.Format(DungeonLocalization.T("hud.worldboss_timer", "⏱ 두목전 — {0:0}초"),
                    Mathf.Max(0f, worldBoss.WorldBossTimeLeft));
                label.text += $"\n{timer}";
            }

            // PLAN.md 101-2 5.5 "난입" — 진행 중일 때만 파도·타이머를 얹는다.
            var horde = HordeRunner.Instance;
            if (horde != null && horde.IsActive)
            {
                string hordeLine = string.Format(
                    DungeonLocalization.T("hud.horde", "⚔ 난입 — 파도 {0} · 남은 {1:0}초 · 처치 {2}"),
                    horde.Wave, horde.TimeLeft, horde.KillCount);
                label.text += $"\n{hordeLine}";
            }

            if (healthBarFill != null)
            {
                healthBarFill.fillAmount = HeroState.HpMax > 0 ? (float)HeroState.Hp / HeroState.HpMax : 0f;
            }
        }
    }
}
