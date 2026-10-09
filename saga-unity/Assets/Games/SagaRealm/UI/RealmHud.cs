using TMPro;
using System.Text;
using UnityEngine;
using UnityEngine.UI;
using Saga.Realm.Data;

namespace Saga.Realm.UI
{
    /// <summary>화면 위 상태 줄 — 현재 성 이름과 그 성의 아홉 값(개간·
    /// 상업·기술·치안·축성·훈련·조선·인구·병력·군량), 세력 금고·연월·
    /// 로스터(이름+배치 성)·적국 전황 요약(3절, U-0067 로 함락 수+남은 곳 셋).
    /// RealmCityState.Changed·
    /// RealmWarState.Changed를 구독해 명령·다음 달 정산·성 전환·공격
    /// 직후 바로 갱신한다. RealmCityBuilder.cs와 같은 이유로 로드 순서
    /// 경합을 피하려 첫 Update 프레임에 한 번 더 강제 갱신한다.</summary>
    public class RealmHud : MonoBehaviour
    {
        [SerializeField] private TextMeshProUGUI label;

        private bool _synced;

        // U-0067 — 로스터·적국을 전부 이어 붙이면 상자(760×340)를 넘쳐 화면
        // 절반을 덮었다. 로스터는 RosterMax 명, 적국은 요약만, 그래도 넘치면 말줄임.
        private const int RosterMax = 6;
        private const int EnemyMax = 3;
        // 위 가운데 GoalBoard(폭 540)가 16:9·4:3 에서 x 530 부터라, 씬이 구운 폭 760 을
        // 그 앞에서 끊는다. 줄이 늘면 글자를 줄여(18~26) 상자 안에 담는다.
        private const float MaxWidth = 500f;

        private void Awake()
        {
            if (label != null)
            {
                var rt = label.rectTransform;
                if (rt.sizeDelta.x > MaxWidth) rt.sizeDelta = new Vector2(MaxWidth, rt.sizeDelta.y);
                label.enableAutoSizing = true;
                label.fontSizeMin = 18f;
                label.fontSizeMax = Mathf.Max(18f, label.fontSize);
                label.overflowMode = TextOverflowModes.Ellipsis;
            }
            RealmCityState.Changed += Refresh;
            RealmWarState.Changed += Refresh;
        }

        private void Update()
        {
            if (_synced) return;
            _synced = true;
            Refresh();
        }

        private void OnDestroy()
        {
            RealmCityState.Changed -= Refresh;
            RealmWarState.Changed -= Refresh;
        }

        private void Refresh()
        {
            if (label == null) return;
            var cityId = RealmCityState.CurrentCity;
            var cityDef = RealmCityData.Get(cityId);
            var record = RealmCityState.CityRecord(cityId);
            if (cityDef == null || record == null) return;

            var sb = new StringBuilder();
            sb.Append(cityDef.Name).Append(" · ")
                .Append(string.Format(RealmLocalization.T("hud.year_month"), RealmCityState.Year, RealmCityState.Month, RealmCityState.Gold))
                .Append('\n');
            sb.Append(RealmLocalization.T("hud.agri")).Append(' ').Append(record.Agri)
                .Append(" · ").Append(RealmLocalization.T("hud.comm")).Append(' ').Append(record.Comm)
                .Append(" · ").Append(RealmLocalization.T("hud.tech")).Append(' ').Append(record.Tech)
                .Append(" · ").Append(RealmLocalization.T("hud.sec")).Append(' ').Append(record.Sec).Append('\n');
            sb.Append(RealmLocalization.T("hud.wall")).Append(' ').Append(record.Wall)
                .Append(" · ").Append(RealmLocalization.T("hud.train")).Append(' ').Append(record.Train)
                .Append(" · ").Append(RealmLocalization.T("hud.ships")).Append(' ').Append(record.Ships).Append('\n');
            sb.Append(RealmLocalization.T("hud.pop")).Append(' ').Append(record.Pop)
                .Append(" · ").Append(RealmLocalization.T("hud.troops")).Append(' ').Append(record.Troops)
                .Append(" · ").Append(RealmLocalization.T("hud.food")).Append(' ').Append(record.Food).Append('\n');
            sb.Append(RealmLocalization.T("hud.roster"));
            int shown = 0, rosterTotal = 0;
            foreach (var id in RealmCityState.RosterIds)
            {
                rosterTotal++;
                if (shown >= RosterMax) continue;
                if (shown > 0) sb.Append(", ");
                shown++;
                var officer = RealmOfficerPool.Get(id);
                var atCity = RealmCityData.Get(RealmCityState.OfficerCityId(id));
                sb.Append(officer != null ? officer.Name : id);
                if (atCity != null) sb.Append('(').Append(atCity.Name).Append(')');
                sb.Append(TraitsAndAmbitionOf(id));
            }
            if (rosterTotal > shown)
                sb.Append(string.Format(RealmLocalization.T("hud.roster_more", " 외 {0}명"), rosterTotal - shown));
            sb.Append('\n');
            AppendEnemySummary(sb);
            label.text = sb.ToString();
        }

        /// <summary>U-0067 — 적국 55곳을 한 줄씩 다 쓰던 것을 "함락 K/N ·
        /// 남은 곳(병력 적은 순) EnemyMax 곳 · 외 n곳" 으로 줄인다.</summary>
        private static void AppendEnemySummary(StringBuilder sb)
        {
            int total = 0, captured = 0;
            var remaining = new System.Collections.Generic.List<(RealmEnemyCityDef def, RealmEnemyRecord rec)>();
            foreach (var enemyId in RealmEnemyCity.AllIds)
            {
                var enemyDef = RealmEnemyCity.Get(enemyId);
                var enemy = RealmWarState.Get(enemyId);
                if (enemyDef == null || enemy == null) continue;
                total++;
                if (enemy.Captured) captured++;
                else remaining.Add((enemyDef, enemy));
            }
            sb.Append(string.Format(RealmLocalization.T("hud.enemy_summary", "적국 함락 {0}/{1}"), captured, total));
            if (remaining.Count == 0) return;
            remaining.Sort((a, b) => a.rec.Troops.CompareTo(b.rec.Troops));
            sb.Append(RealmLocalization.T("hud.enemy_remaining", " · 남은 곳 "));
            int n = System.Math.Min(EnemyMax, remaining.Count);
            for (int i = 0; i < n; i++)
            {
                if (i > 0) sb.Append(" · ");
                var (def, rec) = remaining[i];
                sb.Append(def.Name).Append(" — ")
                    .Append(string.Format(RealmLocalization.T("hud.enemy_status"), rec.Troops, rec.Wall, rec.Train));
            }
            if (remaining.Count > n)
                sb.Append(string.Format(RealmLocalization.T("hud.enemy_more", " 외 {0}곳"), remaining.Count - n));
        }

        private static readonly System.Collections.Generic.Dictionary<RealmOfficerTraits.Trait, string> TraitLabel =
            new System.Collections.Generic.Dictionary<RealmOfficerTraits.Trait, string>
            {
                [RealmOfficerTraits.Trait.Brave] = "용맹",
                [RealmOfficerTraits.Trait.Cunning] = "교활",
                [RealmOfficerTraits.Trait.Wise] = "현명",
            };

        private static readonly System.Collections.Generic.Dictionary<RealmOfficerTraits.Ambition, string> AmbitionLabel =
            new System.Collections.Generic.Dictionary<RealmOfficerTraits.Ambition, string>
            {
                [RealmOfficerTraits.Ambition.Wealth] = "부귀",
                [RealmOfficerTraits.Ambition.Rival] = "숙적",
                [RealmOfficerTraits.Ambition.Scholar] = "학문",
            };

        /// <summary>PLAN.md 101-2 5-1 "인물 특성·야망" — 웹판 "무장 카드에
        /// 특성 배지 2개·야망 한 줄"을 이 판의 유일한 로스터 표시 자리
        /// (텍스트 한 줄짜리 HUD)에 대괄호로 욱여넣는다. 야망 달성 후엔
        /// 진행도 대신 체크 표시만 남긴다.</summary>
        // 110 ⑤c-2c-2 — 특성·야망 이름은 번역 표 `trait.<이름>`·`ambition.<이름>`.
        private static string TraitName(RealmOfficerTraits.Trait t) => RealmLocalization.T("trait." + t.ToString().ToLowerInvariant(), TraitLabel[t]);
        private static string AmbitionName(RealmOfficerTraits.Ambition a) => RealmLocalization.T("ambition." + a.ToString().ToLowerInvariant(), AmbitionLabel[a]);

        private static string TraitsAndAmbitionOf(string officerId)
        {
            var traits = RealmOfficerTraits.TraitsOf(officerId);
            string traitStr = traits.Length > 0 ? TraitName(traits[0]) : "";
            for (int i = 1; i < traits.Length; i++) traitStr += "·" + TraitName(traits[i]);

            var kind = RealmOfficerTraits.AmbitionOf(officerId);
            string ambStr;
            if (RealmOfficerTraits.IsAmbitionDone(officerId))
            {
                ambStr = string.Format(RealmLocalization.T("hud.ambition_done", "야망:{0} 달성✓"), AmbitionName(kind));
            }
            else
            {
                var (current, target) = RealmOfficerTraits.AmbitionProgress(officerId);
                ambStr = string.Format(RealmLocalization.T("hud.ambition", "야망:{0} {1}/{2}"), AmbitionName(kind), current, target);
            }
            return $"[{traitStr} {ambStr}]";
        }
    }
}
