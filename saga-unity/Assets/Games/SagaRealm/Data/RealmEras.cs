using UnityEngine;

namespace Saga.Realm.Data
{
    public enum RealmEra { Past, Modern, Future, Otherworld }

    /// <summary>
    /// PLAN.md 109-5 "REALM 세 시대"(SAGA-DESIGN §13 전체 퓨전) — 웹 사가천하 5-12 "시간 틈 사람 아홉"·5-9 "퓨전 시나리오·사연"을
    /// 이 트랙 구조로 재해석한다.
    ///
    /// ① 시간 틈 사람 아홉(현대 다섯·미래 넷) — 웹은 어느 시나리오 표에도 안 실어 이름 해시로 재야에 흩는다.
    /// 이 트랙은 시나리오 선택이 없고(5-4 제외 확정) 재야가 성마다 묻혀 있어(`RealmOfficerPool.HiddenAt`) 본토 적국 성 아홉에
    /// 하나씩 손으로 묻는다 — 그 성을 함락해 들인 뒤 수색으로 찾고 등용한다(고정 지역 원칙, 해시 대신 표).
    /// 처음 찾을 때 그 사람의 사연 한 토막(웹 "남은 것: 시간 틈 사연"). 웹의 이방인 충성 감점은 이 트랙에 충성 축이 없어
    /// 등용 성공률 × <see cref="StrangerHireMul"/>(낯선 시대 사람이라 설득이 어렵다)로 옮겼다.
    ///
    /// ② 퓨전 사연 셋 — 웹은 이계 셋(균열·폐허·묘역 성 21) 안이나 곁의 우리 성에서 뜬다. 이 트랙엔 이계 성이 없고,
    /// 대신 운중이 이미 "균열/폐허로 드는 막북의 첫 관문"으로 적혀 있다(`RealmCityData`) — 관문 성 셋을 정했다:
    /// 균열 = 운중 · 폐허 = 오원(막북 끝) · 묘역 = 일남(한의 땅 가장 남쪽 끝). 그 성을 쥐고 있으면 사연이 뜨고
    /// 둘째 단에서 이계 무장 하나를 거둘 수 있다(웹 `freeAlien` — 두목 아닌 첫째). 시나리오 ⑦⑧⑨(폐왕·명계·삼계)는
    /// 이 트랙에 세력 AI·시나리오 틀이 없어 뺐다.
    /// 이름은 웹 가명 그대로(전부 지어낸 것).
    /// </summary>
    public static class RealmEras
    {
        public const float StrangerHireMul = 0.85f;

        public struct TimeOfficer
        {
            public string Id, NameKo, TitleKo, QuoteKo;
            public RealmEra Era;
            public int Might, Wisdom, Command, Rarity;
            /// <summary>묻힌 성 — 본토 적국(함락해 들인 뒤 수색).</summary>
            public string CityId;
        }

        /// <summary>웹 `data-force.js` `TIME_OFFICERS` 그대로(자질·희귀도·말). 묻힌 성은 세 사슬 앞·가운데에 고루.</summary>
        public static readonly TimeOfficer[] TimeOfficers =
        {
            new TimeOfficer { Id = "tm_gangseo", NameKo = "강서", TitleKo = "특공대장", Era = RealmEra.Modern, Might = 84, Wisdom = 42, Command = 74, Rarity = 4,
                CityId = RealmEnemyCity.XiaopeiId, QuoteKo = "방패 뒤로 서십시오. 이 성문은 제가 막습니다." },
            new TimeOfficer { Id = "tm_gongseok", NameKo = "공석", TitleKo = "현장 반장", Era = RealmEra.Modern, Might = 68, Wisdom = 58, Command = 62, Rarity = 3,
                CityId = RealmEnemyCity.XiapiId, QuoteKo = "성벽이요? 사흘이면 두 겹으로 올립니다." },
            new TimeOfficer { Id = "tm_geumdam", NameKo = "금담", TitleKo = "기업가", Era = RealmEra.Modern, Might = 40, Wisdom = 86, Command = 64, Rarity = 4,
                CityId = RealmEnemyCity.LuoyangId, QuoteKo = "군자금은 모으는 게 아니라 굴리는 겁니다." },
            new TimeOfficer { Id = "tm_myeongbyeon", NameKo = "명변", TitleKo = "논객", Era = RealmEra.Modern, Might = 34, Wisdom = 88, Command = 56, Rarity = 3,
                CityId = RealmEnemyCity.YeId, QuoteKo = "설전이라면 제 쪽이 이깁니다. 근거가 있으니까요." },
            new TimeOfficer { Id = "tm_doha", NameKo = "도하", TitleKo = "해커", Era = RealmEra.Modern, Might = 46, Wisdom = 82, Command = 50, Rarity = 3,
                CityId = RealmEnemyCity.ShouchunId, QuoteKo = "봉화보다 빠른 소식길을 알고 있어요." },
            new TimeOfficer { Id = "tm_seongyeon", NameKo = "성연", TitleKo = "항법사", Era = RealmEra.Future, Might = 50, Wisdom = 86, Command = 76, Rarity = 4,
                CityId = RealmEnemyCity.ChanganId, QuoteKo = "별자리가 이 시대 것과 조금 달라요. 그래도 길은 찾습니다." },
            new TimeOfficer { Id = "tm_gwedo", NameKo = "궤도", TitleKo = "탐사 대장", Era = RealmEra.Future, Might = 66, Wisdom = 70, Command = 84, Rarity = 4,
                CityId = RealmEnemyCity.ChengduId, QuoteKo = "대원들은 제가 데려갑니다. 한 명도 두고 가지 않아요." },
            new TimeOfficer { Id = "tm_eunha", NameKo = "은하", TitleKo = "우주 창병", Era = RealmEra.Future, Might = 76, Wisdom = 58, Command = 68, Rarity = 3,
                CityId = RealmEnemyCity.XiangyangId, QuoteKo = "여기 중력은 가볍네요. 창도 가볍게 들립니다." },
            new TimeOfficer { Id = "tm_yeongjeom", NameKo = "영점", TitleKo = "의체 무사", Era = RealmEra.Future, Might = 88, Wisdom = 50, Command = 62, Rarity = 4,
                CityId = RealmEnemyCity.JianyeId, QuoteKo = "의체 출력 백 퍼센트. 일기토, 받아 드리죠." },
        };

        public struct Gateway
        {
            public string Key;
            public string RegionKo;
            public string CityId;
            /// <summary>둘째 단에서 거두는 이계 무장(웹 이계 명부에서 두목 아닌 첫째).</summary>
            public string OfficerId, OfficerNameKo;
            public int Might, Wisdom, Command, Rarity;
        }

        public static readonly Gateway[] Gateways =
        {
            new Gateway { Key = "rift", RegionKo = "균열", CityId = RealmEnemyCity.YunzhongId,
                OfficerId = "fu_seonghon", OfficerNameKo = "성혼", Might = 50, Wisdom = 88, Command = 70, Rarity = 4 },
            new Gateway { Key = "ruin", RegionKo = "폐허", CityId = RealmEnemyCity.WuyuanId,
                OfficerId = "ru_busaeng", OfficerNameKo = "부생", Might = 74, Wisdom = 30, Command = 52, Rarity = 3 },
            new Gateway { Key = "tomb", RegionKo = "묘역", CityId = RealmEnemyCity.RinanId,
                OfficerId = "tb_ganghae", OfficerNameKo = "강해", Might = 78, Wisdom = 32, Command = 56, Rarity = 3 },
        };

        public static Gateway GatewayOf(string key)
        {
            foreach (var g in Gateways) if (g.Key == key) return g;
            return Gateways[0];
        }

        public static string EraName(RealmEra e) => e switch
        {
            RealmEra.Modern => RealmLocalization.T("era.modern", "현대"),
            RealmEra.Future => RealmLocalization.T("era.future", "미래"),
            RealmEra.Otherworld => RealmLocalization.T("era.otherworld", "이계"),
            _ => RealmLocalization.T("era.past", "과거"),
        };

        public static string RegionName(Gateway g) => RealmLocalization.T("era.region." + g.Key, g.RegionKo);

        /// <summary>표시 이름 뒤 딱지 — 옛사람은 없음, 시간 틈 사람은 시대, 이계 무장은 그 땅 이름.</summary>
        public static string Tag(string officerId, RealmEra era)
        {
            if (era == RealmEra.Past) return "";
            if (era == RealmEra.Otherworld)
                foreach (var g in Gateways) if (g.OfficerId == officerId) return RegionName(g);
            return EraName(era);
        }

        public static bool TryTimeOfficer(string id, out TimeOfficer t)
        {
            foreach (var o in TimeOfficers) if (o.Id == id) { t = o; return true; }
            t = default;
            return false;
        }

        /// <summary>처음 찾았을 때 붙는 사연 한 토막(시간 틈 사람만, 아니면 빈 글).</summary>
        public static string FoundStory(string officerId)
        {
            if (!TryTimeOfficer(officerId, out var t)) return "";
            string title = RealmLocalization.T("officer." + t.Id + ".title", t.TitleKo);
            string quote = RealmLocalization.T("officer." + t.Id + ".quote", t.QuoteKo);
            return "\n" + string.Format(RealmLocalization.T("era.found_story", "⏳ 시간 틈 너머 {0}에서 온 {1} — \"{2}\""), EraName(t.Era), title, quote);
        }

        /// <summary>낯선 시대·이계 사람이면 등용 성공률에 <see cref="StrangerHireMul"/> — 같은 구간(0.05~0.9)으로 다시 눌러 담는다.</summary>
        public static float AdjustHireChance(RealmOfficer target, float chance) =>
            target != null && target.Era != RealmEra.Past ? Mathf.Clamp(chance * StrangerHireMul, 0.05f, 0.9f) : chance;
    }
}
