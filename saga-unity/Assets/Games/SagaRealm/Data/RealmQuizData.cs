using System.Collections.Generic;

namespace Saga.Realm.Data
{
    /// <summary>
    /// REALM 다음 조각 (3) — 문답(js/quiz.js·data-quiz.js). 원작 문제은행은
    /// 260문항(역사·사자성어·상식·유행어·세계사·속담 6분야 × 30~50개)인데,
    /// 이 슬라이스는 **분야마다 6문항씩(총 36문항)**만 옮겼다 — 메커니즘
    /// (안 익힌 문제 우선→쉬운 등급부터, 다 익히면 복습) 검증엔 분야당
    /// 등급이 섞인 소수 표본으로 충분하고, 나머지 224문항은 그대로
    /// 베끼는 것 자체가 게임성에 새로 보태는 게 없다(REALM의 무장
    /// 로스터를 3명으로 좁힌 것과 같은 절제). 문항·정답은 원작 그대로, 실존
    /// 인물 이름만 웹 판(2026-09-26 사용자 결정 "모든 실명을 가명으로")과 같은
    /// 가명으로 바꿨다(PLAN.md 110 ⑥c) — 도감에 있는 인물은 도감 가명(세종 대신
    /// 훈민 …), 없는 인물은 웹이 새로 지은 이름. 사자성어·지명·나라 이름은 그대로.
    /// </summary>
    public class RealmQuizQuestion
    {
        public readonly string Id;
        public readonly string Cat;
        public readonly int Lv;
        private readonly string _q;
        private readonly string[] _choices;
        public readonly int AnswerIdx;
        private readonly string _why;

        /// <summary>Localization — RealmCityData.Name 등과 같은 결(T(key, fallback)).
        /// Id 별로 키를 매겨 en 번역 누락 시 원문(한국어) 그대로 보인다.</summary>
        public string Q => RealmLocalization.T("quiz." + Id + ".q", _q);
        public string[] Choices
        {
            get
            {
                var arr = new string[_choices.Length];
                for (int i = 0; i < _choices.Length; i++) arr[i] = RealmLocalization.T("quiz." + Id + ".c" + i, _choices[i]);
                return arr;
            }
        }
        public string Why => RealmLocalization.T("quiz." + Id + ".why", _why);

        public RealmQuizQuestion(string id, string cat, int lv, string q, string[] choices, int answerIdx, string why)
        {
            Id = id; Cat = cat; Lv = lv; _q = q; _choices = choices; AnswerIdx = answerIdx; _why = why;
        }
    }

    public static class RealmQuizData
    {
        public class Category
        {
            public readonly string Key;
            public readonly string Name;
            public Category(string key, string name) { Key = key; Name = name; }
        }

        public static readonly Category[] Cats =
        {
            new Category("hist", "역사"),
            new Category("idiom", "사자성어"),
            new Category("sense", "상식"),
            new Category("mz", "유행어"),
            new Category("world", "세계사"),
            new Category("proverb", "속담"),
        };

        public static string CatName(string key)
        {
            foreach (var c in Cats) if (c.Key == key) return RealmLocalization.T("quiz.cat." + key, c.Name);
            return key;
        }

        /// <summary>서고 목록 한 줄용 — quiz.js shortQ() 그대로(26자 넘으면 줄임).</summary>
        public static string ShortQ(string q) => q.Length > 26 ? q.Substring(0, 26) + "…" : q;

        public static readonly List<RealmQuizQuestion> Bank = new List<RealmQuizQuestion>
        {
            // ── 역사 ──
            new RealmQuizQuestion("h01", "hist", 1, "훈민정음을 창제한 조선의 왕은?",
                new[] { "철왕", "훈민", "전헌왕", "규장왕" }, 1, "훈민대왕이 1443년 훈민정음을 창제하고 1446년에 반포했다."),
            new RealmQuizQuestion("h02", "hist", 1, "한산도 대첩에서 학익진으로 왜군을 무찌른 장군은?",
                new[] { "행주장", "진주장", "해장", "초모의" }, 2, "해장 장군이 1592년 한산도 앞바다에서 학익진으로 대승했다."),
            new RealmQuizQuestion("h03", "hist", 2, "살수대첩(612년)에서 수나라 대군을 무찌른 고구려 장수는?",
                new[] { "현묘", "철령", "안시장", "평강서" }, 0, "현묘가 살수(청천강)에서 수나라 30만 별동대를 궤멸시켰다."),
            new RealmQuizQuestion("h04", "hist", 2, "귀주대첩(1019년)에서 거란군을 물리친 고려 장수는?",
                new[] { "담판공", "별무장", "강우", "견금공" }, 2, "강우가 귀주에서 거란 3차 침입군을 크게 무찔렀다."),
            new RealmQuizQuestion("h05", "hist", 1, "고려를 세운 사람은?",
                new[] { "미륵주", "후백패", "통합공", "위화공" }, 2, "통합공이 918년 고려를 세웠다."),
            new RealmQuizQuestion("h08", "hist", 2, "발해를 세운 사람은?",
                new[] { "요동패", "활왕", "위례공", "알왕" }, 0, "고구려 유민 요동패가 698년 발해를 세웠다."),

            // ── 사자성어 ──
            new RealmQuizQuestion("i01", "idiom", 1, "사방이 적으로 둘러싸여 고립된 처지를 뜻하는 말은?",
                new[] { "사면초가", "고립무원", "진퇴양난", "풍전등화" }, 0, "사면초가(四面楚歌) — 패초왕이 사방에서 들리는 초나라 노래에 대세가 기운 것을 알았다는 고사."),
            new RealmQuizQuestion("i02", "idiom", 2, "옛것을 익혀 새것을 안다는 뜻은?",
                new[] { "일취월장", "온고지신", "교학상장", "박학다식" }, 1, "온고지신(溫故知新) — 논어에 나오는 말로, 옛것을 잘 익히면 새것이 보인다는 뜻."),
            new RealmQuizQuestion("i05", "idiom", 2, "둘이 다투는 사이 엉뚱한 제3자가 이득을 보는 것은?",
                new[] { "어부지리", "견토지쟁", "일석이조", "수주대토" }, 0, "어부지리(漁夫之利) — 조개와 도요새가 다투는 사이 어부가 둘 다 잡았다."),
            new RealmQuizQuestion("i08", "idiom", 1, "큰 인물은 늦게 이루어진다는 뜻은?",
                new[] { "대기만성", "소년등과", "입신양명", "금의환향" }, 0, "대기만성(大器晚成) — 큰 그릇은 늦게 완성된다."),
            new RealmQuizQuestion("i09", "idiom", 2, "쓸모가 다하면 버려진다는 뜻은?",
                new[] { "토사구팽", "감탄고토", "배은망덕", "조령모개" }, 0, "토사구팽(兎死狗烹) — 토끼를 잡으면 사냥개를 삶는다."),
            new RealmQuizQuestion("i12", "idiom", 1, "인재를 얻으려 참을성 있게 여러 번 찾아가는 것은?",
                new[] { "문전성시", "삼고초려", "문전박대", "초지일관" }, 1, "삼고초려(三顧草廬) — 인형이 현책의 초가집을 세 번 찾아갔다."),

            // ── 상식 ──
            new RealmQuizQuestion("s01", "sense", 1, "물이 끓는 온도는? (1기압 기준)",
                new[] { "90℃", "100℃", "120℃", "80℃" }, 1, "1기압에서 물은 100℃에 끓는다."),
            new RealmQuizQuestion("s02", "sense", 1, "태양계의 행성은 몇 개인가?",
                new[] { "7개", "8개", "9개", "10개" }, 1, "수금지화목토천해 8개. 명왕성은 2006년 왜소행성으로 분류가 바뀌었다."),
            new RealmQuizQuestion("s07", "sense", 1, "무지개 색은 보통 몇 가지로 나누나?",
                new[] { "5가지", "6가지", "7가지", "8가지" }, 2, "빨주노초파남보 7가지."),
            new RealmQuizQuestion("s08", "sense", 1, "물의 화학식은?",
                new[] { "CO2", "H2O", "O2", "NaCl" }, 1, "물은 수소 2개와 산소 1개가 결합한 H2O 다."),
            new RealmQuizQuestion("s11", "sense", 2, "사람의 심장은 몇 개의 방으로 이루어져 있나?",
                new[] { "2개", "3개", "4개", "5개" }, 2, "2심방 2심실, 모두 4개의 방이다."),
            new RealmQuizQuestion("s12", "sense", 3, "대나무는 식물 분류상 무엇에 속하나?",
                new[] { "나무", "풀", "이끼", "버섯" }, 1, "대나무는 볏과의 풀이다. 나이테가 없고 속이 비어 있다."),

            // ── 유행어 ──
            new RealmQuizQuestion("m01", "mz", 1, "\"갓생\"의 뜻은?",
                new[] { "신을 믿는 삶", "부지런하고 알찬 삶", "게으른 삶", "갓 태어난 삶" }, 1, "God(갓)+인생 — 계획대로 부지런히 사는 모범적인 삶."),
            new RealmQuizQuestion("m02", "mz", 1, "\"중꺾마\"는 무엇의 줄임말인가?",
                new[] { "중간에 꺾이는 마음", "중요한 것은 꺾이지 않는 마음", "중간고사 꺾고 마무리", "중심을 꺾는 마법" }, 1, "져도 포기하지 않는 마음가짐을 뜻한다."),
            new RealmQuizQuestion("m03", "mz", 2, "\"알잘딱깔센\"의 뜻은?",
                new[] { "알아서 잘 딱 깔끔하고 센스 있게", "알고 보니 잘생긴 센 사람", "알바를 잘하는 센스", "알쏭달쏭한 센스" }, 0, "\"알아서 잘, 딱, 깔끔하고 센스 있게\"의 줄임말."),
            new RealmQuizQuestion("m07", "mz", 1, "\"킹받다\"의 뜻은?",
                new[] { "왕이 되다", "몹시 화가 나다", "왕대접을 받다", "크게 감동받다" }, 1, "King+열받다 — \"매우 열받는다\"를 재밌게 강조한 말."),
            new RealmQuizQuestion("m09", "mz", 1, "\"TMI\"의 뜻은?",
                new[] { "너무 많은 정보", "너무 멋진 아이디어", "아주 중요한 정보", "너무 미운 사람" }, 0, "Too Much Information — 굳이 몰라도 될 시시콜콜한 정보."),
            new RealmQuizQuestion("m10", "mz", 3, "\"손민수하다\"의 뜻은?",
                new[] { "남의 물건을 훔치다", "남의 스타일을 따라 사다", "손으로 민수를 그리다", "민수에게 손을 흔들다" }, 1, "웹툰 \"치즈인더트랩\"의 캐릭터에서 유래 — 남의 아이템을 그대로 따라 사는 것."),

            // ── 세계사 ──
            new RealmQuizQuestion("w01", "world", 1, "프랑스 혁명이 시작된 해는?",
                new[] { "1689년", "1776년", "1789년", "1848년" }, 2, "1789년 바스티유 감옥 습격으로 시작됐다."),
            new RealmQuizQuestion("w03", "world", 1, "제1차 세계대전이 일어난 해는?",
                new[] { "1905년", "1914년", "1929년", "1939년" }, 1, "1914년 사라예보에서 오스트리아 황태자가 저격된 일이 방아쇠였다."),
            new RealmQuizQuestion("w06", "world", 2, "카시안더 대왕을 가르친 철학자는?",
                new[] { "아고라스", "이데온", "로고벨", "테트락토" }, 2, "로고벨이 소년 카시안더의 스승이었다."),
            new RealmQuizQuestion("w07", "world", 1, "중국을 처음 통일하고 만리장성을 이은 황제는?",
                new[] { "분서제", "흉노제", "현무제", "홍건제" }, 0, "분서제가 기원전 221년 통일하고 북방 성벽을 하나로 이었다."),
            new RealmQuizQuestion("w09", "world", 1, "산타마로가 대서양을 건너 아메리카에 닿은 해는?",
                new[] { "1453년", "1492년", "1519년", "1588년" }, 1, "1492년이다."),
            new RealmQuizQuestion("w11", "world", 2, "종교개혁의 불을 붙인 「95개조 반박문」을 쓴 사람은?",
                new[] { "비텐하르트", "제네브랑", "취리헨", "스콜라노" }, 0, "1517년 비텐하르트가 면벌부 판매를 비판하는 95개조를 붙였다."),

            // ── 속담 ──
            new RealmQuizQuestion("p01", "proverb", 1, "\"발 없는 말이 천 리 간다\"는 무엇을 두고 하는 말인가?",
                new[] { "소문이 빠르게 퍼짐", "말(馬)이 잘 달림", "걸음이 빠른 사람", "편지가 멀리 감" }, 0, "여기서 \"말\"은 언어다 — 말조심하라는 뜻이다."),
            new RealmQuizQuestion("p02", "proverb", 1, "\"등잔 밑이 어둡다\"의 뜻은?",
                new[] { "가까운 것을 오히려 모른다", "불이 약하다", "밤에는 위험하다", "아랫사람이 힘들다" }, 0, "남의 일은 잘 알아도 제 주변 일은 모른다는 말이다."),
            new RealmQuizQuestion("p04", "proverb", 1, "\"우물 안 개구리\"가 가리키는 사람은?",
                new[] { "좁은 세상만 알고 큰 세상을 모르는 사람", "물을 좋아하는 사람", "겁이 많은 사람", "헤엄을 잘 치는 사람" }, 0, "자기가 아는 것이 전부라 여기는 좁은 시야를 꾸짖는 말이다."),
            new RealmQuizQuestion("p05", "proverb", 1, "\"소 잃고 외양간 고친다\"의 뜻은?",
                new[] { "일이 터진 뒤에야 대비한다", "소가 중요하다", "집을 자주 고쳐야 한다", "손해는 되찾을 수 있다" }, 0, "미리 챙기지 않고 늦게 후회한다는 말이다."),
            new RealmQuizQuestion("p06", "proverb", 2, "\"백지장도 맞들면 낫다\"의 뜻은?",
                new[] { "쉬운 일도 함께 하면 수월하다", "종이는 가볍다", "혼자 하는 게 빠르다", "작은 일은 미뤄도 된다" }, 0, "아무리 가벼운 일도 힘을 합치면 낫다 — 협력의 가치를 말한다."),
            new RealmQuizQuestion("p11", "proverb", 3, "\"바늘허리에 실 매어 쓸까\"의 뜻은?",
                new[] { "순서를 건너뛰면 안 된다", "바늘은 위험하다", "실이 굵어야 한다", "바느질은 어렵다" }, 0, "급해도 절차를 지켜야 한다는 말 — 실은 바늘귀에 꿰어야 한다."),
        };

        public static RealmQuizQuestion ById(string id)
        {
            foreach (var q in Bank) if (q.Id == id) return q;
            return null;
        }

        public static List<RealmQuizQuestion> OfCat(string catKey)
        {
            var list = new List<RealmQuizQuestion>();
            foreach (var q in Bank) if (q.Cat == catKey) list.Add(q);
            return list;
        }
    }
}
