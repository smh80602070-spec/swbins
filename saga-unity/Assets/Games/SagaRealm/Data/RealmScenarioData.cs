using System.Collections.Generic;

namespace Saga.Realm.Data
{
    /// <summary>
    /// PLAN.md 109-16 시나리오 「천하와 균열」 표(웹 사가국지 `js/data-scenario.js` · 정본 `scenario/saga-realm.md`) — 1막 중원의 난 셋 · 2막 대전 셋 · 3막 강 위 셋 · 4막 삼계 균열 셋 · 5막 먼 길 셋 · 6막 천하 하나 +
    /// 결말 뒤 곁가지 7막 틈의 끝 셋 = 열아홉 카드. **표 원본은 웹 파일에서 스크립트로 옮겼다**(한 자도 손으로 안 옮김). 이 트랙 다름: 웹 효과 `loyal`(책사 충성)은 이 트랙에 충성 축이 없어
    /// **수도 기술 +2n** 으로, `rel`(이웃 우호)는 외교 축이 없어 **화친(+n)은 수도 치안 +0.4n**·**선전(−n)은 뺐다**. 힌트 글은 효과에서 만든다(`RealmScenario.Hint`).
    /// 생성물 — 고치려면 웹 표를 고치고 다시 옮긴다.
    /// </summary>
    public static class RealmScenarioData
    {
        public readonly struct Fx
        {
            /// <summary>gold · food · sec · train · tech · recruit(Id = 시간 틈 사람).</summary>
            public readonly string T;
            public readonly int N;
            public readonly string Id;
            public Fx(string t, int n, string id = null) { T = t; N = n; Id = id; }
        }

        public sealed class Choice
        {
            /// <summary>atk · def · util = 사건 카드 선택 A · B · C.</summary>
            public string K, LabelKo, ResultKo;
            public int Cost;
            public Fx[] Fx;
        }

        public sealed class Card
        {
            public string Id, Emoji, TitleKo, TextKo, FromId;
            public int No, Act, MinTurn, OrCities;
            /// <summary>승리 하나를 이룬 뒤에 뜬다(6막·7막) · 시간 틈 사람 아홉이 다 우리 사람이어야 뜬다(7막 첫 카드).</summary>
            public bool Victory, AllTime;
            /// <summary>6막 — 이룬 승리 종류별 글 · 7막 뒤 두 카드 — 앞 카드(<see cref="FromId"/>)에서 고른 답(atk·def·util)별 글.</summary>
            public Dictionary<string, string> TextByKo, TextByKKo;
            public Choice[] Choices;
        }

        /// <summary>시간 틈 사람 아홉 — 7막이 열리는 조건.</summary>
        public static readonly string[] TimeFolk = { "tm_gangseo", "tm_gongseok", "tm_geumdam", "tm_myeongbyeon", "tm_doha", "tm_seongyeon", "tm_gwedo", "tm_eunha", "tm_yeongjeom" };

        public static readonly Card[] Cards =
        {
            new Card { Id = "r1_start", No = 1, Act = 1, Emoji = "🗺️", TitleKo = "첫 성의 밤",
                MinTurn = 0, OrCities = 0, Victory = false, AllTime = false,
                TextKo = "{책사} 이(가) 천하 지도를 펴고 첫 목표를 묻는다. 지도 끝에는 어제까지 없던 땅이 희미하게 그려져 있다. 지도 위에는 이 시대 것이 아닌 볼펜 한 자루가 떨어져 있고, 가장자리로 빛 얼룩이 번져 간다.",
                TextByKo = null, FromId = null, TextByKKo = null,
                Choices = new[]
                {
                    new Choice { K = "atk", LabelKo = "이웃 땅으로 넓히자", Cost = 0, Fx = new[] { new Fx("food", 1500), new Fx("train", 5) }, ResultKo = "{책사} 이(가) 첫 출정 길을 그었다 — 곳간이 든든해졌다" },
                    new Choice { K = "def", LabelKo = "성부터 다지자", Cost = 0, Fx = new[] { new Fx("sec", 8), new Fx("tech", 6) }, ResultKo = "성문과 곳간을 손보았다 — {책사} 이(가) 믿음을 얻었다" },
                    new Choice { K = "util", LabelKo = "빛 얼룩부터 살핀다", Cost = 0, Fx = new[] { new Fx("gold", 500) }, ResultKo = "얼룩 근처에서 옛 주화 꾸러미가 나왔다" },
                } },
            new Card { Id = "r1_rift_sign", No = 2, Act = 1, Emoji = "🌌", TitleKo = "균열의 울림",
                MinTurn = 12, OrCities = 0, Victory = false, AllTime = false,
                TextKo = "북쪽 하늘에 가느다란 금이 갔다. 봉화대 병사가 금 아래에서 낯선 수레를 보았다 — 쇠 껍질에 바퀴가 달렸고 안은 비어 있다. 금에서는 옅은 빛이 새어 나오며, 바람이 그쪽으로 빨려 든다.",
                TextByKo = null, FromId = null, TextByKKo = null,
                Choices = new[]
                {
                    new Choice { K = "atk", LabelKo = "봉화를 올려 널리 알린다", Cost = 0, Fx = new[] { new Fx("train", 8) }, ResultKo = "봉화가 이어 오르자 군사의 기세가 올랐다" },
                    new Choice { K = "def", LabelKo = "성문을 닫고 살핀다", Cost = 0, Fx = new[] { new Fx("sec", 8) }, ResultKo = "성문을 닫고 지켜보니 백성이 안심했다" },
                    new Choice { K = "util", LabelKo = "척후를 금 아래로 보낸다", Cost = 0, Fx = new[] { new Fx("gold", 300), new Fx("tech", 6) }, ResultKo = "척후가 수레 안에서 쓸 만한 것을 가져왔다" },
                } },
            new Card { Id = "r1_first_ally", No = 3, Act = 1, Emoji = "🕊️", TitleKo = "첫 화친",
                MinTurn = 24, OrCities = 5, Victory = false, AllTime = false,
                TextKo = "{이웃} 의 사신이 예물을 들고 왔다. 예물 속에는 빛나는 부적이 섞여 있고, 재야의 한 논객이 끼어들어 \"손잡는 편이 덜 잃는다\" 며 설전을 청한다. 싸울지 손잡을지 정해야 한다.",
                TextByKo = null, FromId = null, TextByKKo = null,
                Choices = new[]
                {
                    new Choice { K = "atk", LabelKo = "선전 포고로 답한다", Cost = 0, Fx = new[] { new Fx("train", 8) }, ResultKo = "예물을 돌려보냈다 — 국경에 긴장이 돈다" },
                    new Choice { K = "def", LabelKo = "화친을 받아들인다", Cost = 0, Fx = new[] { new Fx("sec", 10) }, ResultKo = "설전 끝에 화친 조건을 더 얻어 냈다" },
                    new Choice { K = "util", LabelKo = "예물을 더해 우호를 산다", Cost = 300, Fx = new[] { new Fx("sec", 5) }, ResultKo = "예물을 더해 보내니 사신이 웃었다" },
                } },
            new Card { Id = "r2_fallen", No = 4, Act = 2, Emoji = "🪂", TitleKo = "하늘에서 떨어진 사람들",
                MinTurn = 36, OrCities = 8, Victory = false, AllTime = false,
                TextKo = "재야를 탐색하던 척후가 이상한 소문을 물어 왔다. 현대 옷차림의 사람 다섯이 하늘에서 떨어졌다는 것이다. 그중 강서라는 이는 특공대장이었다고 하고, 노트북을 든 도하의 화면에는 아직 그려지지 않은 앞날의 지도가 떠 있다 한다. {책사} 이(가) 한 사람부터 찾자고 한다.",
                TextByKo = null, FromId = null, TextByKKo = null,
                Choices = new[]
                {
                    new Choice { K = "atk", LabelKo = "강서를 직접 찾아 등용한다", Cost = 300, Fx = new[] { new Fx("recruit", 0, "tm_gangseo") }, ResultKo = "강서가 특공대 제복 그대로 찾아와 절도 있게 인사했다" },
                    new Choice { K = "def", LabelKo = "소문을 더 모은다", Cost = 0, Fx = new[] { new Fx("sec", 5), new Fx("tech", 6) }, ResultKo = "소문을 모아 지도에 표시하니 성 안이 술렁임을 그쳤다" },
                    new Choice { K = "util", LabelKo = "도하의 노트북부터 산다", Cost = 400, Fx = new[] { new Fx("recruit", 0, "tm_doha") }, ResultKo = "도하가 값을 치른 노트북 앞에서 앞날 지도를 펼쳐 보였다" },
                } },
            new Card { Id = "r2_plains", No = 5, Act = 2, Emoji = "⚔️", TitleKo = "관도 결전",
                MinTurn = 48, OrCities = 10, Victory = false, AllTime = false,
                TextKo = "{이웃} 의 대군이 큰 들판에 진을 쳤다. 강서가 특공대를 이끌고 밤에 야습하자고 제안하고, 금담은 태양광 등을 내밀며 \"밤을 낮처럼 쓰자\" 한다. 대군과 군량을 두고 한 판을 정해야 한다.",
                TextByKo = null, FromId = null, TextByKKo = null,
                Choices = new[]
                {
                    new Choice { K = "atk", LabelKo = "강서의 야습을 허락한다", Cost = 0, Fx = new[] { new Fx("train", 10) }, ResultKo = "야습이 적진의 곳간을 태우자 군사의 기세가 하늘을 찔렀다" },
                    new Choice { K = "def", LabelKo = "성 안에서 버틴다", Cost = 0, Fx = new[] { new Fx("sec", 8), new Fx("food", 1000) }, ResultKo = "태양광 등이 성벽 위를 환히 밝히니 적이 다가오지 못했다" },
                    new Choice { K = "util", LabelKo = "금담의 등을 큰 값에 산다", Cost = 300, Fx = new[] { new Fx("food", 2000) }, ResultKo = "등불로 밤 수레길이 열려 군량이 넉넉히 들어왔다" },
                } },
            new Card { Id = "r2_debate", No = 6, Act = 2, Emoji = "🎙️", TitleKo = "논객의 설전",
                MinTurn = 60, OrCities = 12, Victory = false, AllTime = false,
                TextKo = "논객 명변이 확성기를 들고 찾아왔다. \"이름난 재야 학자를 설전으로 불러 옵시다. 서당에 사람이 모이면 성이 밝아집니다.\" 퀴즈 판이 빛 판으로 바뀐 서고 앞에서 {책사} 도 고개를 끄덕인다.",
                TextByKo = null, FromId = null, TextByKKo = null,
                Choices = new[]
                {
                    new Choice { K = "atk", LabelKo = "명변을 군사로 등용한다", Cost = 300, Fx = new[] { new Fx("recruit", 0, "tm_myeongbyeon") }, ResultKo = "명변이 확성기를 들고 서당 앞에서 큰 설전을 벌였다" },
                    new Choice { K = "def", LabelKo = "서고를 정비한다", Cost = 0, Fx = new[] { new Fx("sec", 8) }, ResultKo = "서고가 정돈되니 배우러 오는 이가 늘었다" },
                    new Choice { K = "util", LabelKo = "학자에게 예물을 보낸다", Cost = 200, Fx = new[] { new Fx("tech", 10) }, ResultKo = "학자가 예물에 감복해 서고에 이름을 올렸다" },
                } },
            new Card { Id = "r3_navigator", No = 7, Act = 3, Emoji = "🧭", TitleKo = "항법사가 본 강",
                MinTurn = 72, OrCities = 15, Victory = false, AllTime = false,
                TextKo = "항법사 성연이 항법 판을 들고 찾아왔다. \"이 강의 바람이 사흘 뒤에 바뀝니다. 미래 기록에 그렇게 남아 있습니다.\" 도하가 기록을 해독해 보니 정말로 같은 말이 적혀 있었다. 강가 수채화 같은 풍경 위에 항법 판의 빛이 겹친다.",
                TextByKo = null, FromId = null, TextByKKo = null,
                Choices = new[]
                {
                    new Choice { K = "atk", LabelKo = "성연을 군사로 삼는다", Cost = 300, Fx = new[] { new Fx("recruit", 0, "tm_seongyeon") }, ResultKo = "성연이 항법 판을 펴 강의 바람을 손가락으로 짚었다" },
                    new Choice { K = "def", LabelKo = "기록을 고이 간직한다", Cost = 0, Fx = new[] { new Fx("sec", 5), new Fx("tech", 6) }, ResultKo = "기록을 서고에 넣어 두고 바람이 바뀌길 기다렸다" },
                    new Choice { K = "util", LabelKo = "궤도에게도 사람을 보낸다", Cost = 300, Fx = new[] { new Fx("recruit", 0, "tm_gwedo") }, ResultKo = "궤도가 탐사 장비를 메고 성 문을 두드렸다" },
                } },
            new Card { Id = "r3_river", No = 8, Act = 3, Emoji = "🌊", TitleKo = "적벽 강 위",
                MinTurn = 84, OrCities = 18, Victory = false, AllTime = false,
                TextKo = "강 위에서 큰 싸움이 다가온다. 성연이 \"사흘 뒤 바람이 바뀌니 그때 불을 쓰라\" 하고, 공석은 구조선을 끌어와 강가를 지키자 한다. 바람 예보를 믿을지, 수군과 화공으로 정면을 택할지 정해야 한다.",
                TextByKo = null, FromId = null, TextByKKo = null,
                Choices = new[]
                {
                    new Choice { K = "atk", LabelKo = "바람 예보를 믿고 화공을 쓴다", Cost = 0, Fx = new[] { new Fx("train", 10), new Fx("tech", 6) }, ResultKo = "바람이 예보대로 바뀌어 불길이 적선을 삼켰다" },
                    new Choice { K = "def", LabelKo = "구조선으로 강가를 지킨다", Cost = 0, Fx = new[] { new Fx("sec", 8) }, ResultKo = "구조선이 강가 백성을 실어 나르니 성 안이 든든해졌다" },
                    new Choice { K = "util", LabelKo = "수군을 늘려 정면으로 간다", Cost = 300, Fx = new[] { new Fx("train", 6) }, ResultKo = "수군을 늘려 정면에서 맞서니 적이 물러갔다" },
                } },
            new Card { Id = "r3_duel", No = 9, Act = 3, Emoji = "🦾", TitleKo = "의체 무사의 일기토",
                MinTurn = 96, OrCities = 20, Victory = false, AllTime = false,
                TextKo = "의체 무사 영점이 성 앞 공터에 서서 \"나보다 강한 장수 밑에만 서겠다\" 한다. 구경꾼들이 휴대폰 불빛을 켜 들고 모여들었다. 영점의 팔이 기계 소리를 낸다. 누가 이 일기토를 받겠는가.",
                TextByKo = null, FromId = null, TextByKKo = null,
                Choices = new[]
                {
                    new Choice { K = "atk", LabelKo = "{맹장}이 직접 받아 친다", Cost = 300, Fx = new[] { new Fx("recruit", 0, "tm_yeongjeom"), new Fx("train", 5) }, ResultKo = "일기토 끝에 영점이 무기를 내리고 절했다" },
                    new Choice { K = "def", LabelKo = "구경꾼을 물리고 정중히 청한다", Cost = 0, Fx = new[] { new Fx("sec", 5) }, ResultKo = "구경꾼을 물리니 영점이 한 걸음 물러섰다" },
                    new Choice { K = "util", LabelKo = "예물과 술로 마음을 산다", Cost = 400, Fx = new[] { new Fx("recruit", 0, "tm_yeongjeom") }, ResultKo = "술잔 앞에서 영점이 기계 팔을 내려놓았다" },
                } },
            new Card { Id = "r4_rift", No = 10, Act = 4, Emoji = "🌌", TitleKo = "균열의 왕",
                MinTurn = 108, OrCities = 25, Victory = false, AllTime = false,
                TextKo = "균열의 문이 활짝 열렸다. 종왕이 성혼과 유성 무리를 이끌고 내려온다. 성벽 위에는 강서의 특공대가 서 있고, 궤도의 탐사 장비가 이계 성혼의 정체를 알아낸다. 세 시대가 한 성벽에 모였다.",
                TextByKo = null, FromId = null, TextByKKo = null,
                Choices = new[]
                {
                    new Choice { K = "atk", LabelKo = "성문 밖에서 맞받는다", Cost = 0, Fx = new[] { new Fx("train", 12) }, ResultKo = "성문 밖에서 맞받으니 성혼의 기세가 꺾였다" },
                    new Choice { K = "def", LabelKo = "성벽을 걸고 지킨다", Cost = 0, Fx = new[] { new Fx("sec", 10), new Fx("food", 1500) }, ResultKo = "성벽이 버티니 유성 무리가 흩어졌다" },
                    new Choice { K = "util", LabelKo = "궤도의 장비로 성혼을 읽는다", Cost = 300, Fx = new[] { new Fx("tech", 10) }, ResultKo = "장비가 성혼의 약한 자리를 짚어 주었다" },
                } },
            new Card { Id = "r4_plague", No = 11, Act = 4, Emoji = "🧫", TitleKo = "역병의 근원",
                MinTurn = 120, OrCities = 27, Victory = false, AllTime = false,
                TextKo = "폐허에서 번지는 역병의 근원이 드러났다. 금담이 백신 공장을 세우자 하고, 의원들은 약재를 모아 왔다. 은하가 방호복을 입고 이계 부생의 정체를 확인했다. 성 안 백성이 기다리고 있다.",
                TextByKo = null, FromId = null, TextByKKo = null,
                Choices = new[]
                {
                    new Choice { K = "atk", LabelKo = "거해의 근원을 직접 친다", Cost = 0, Fx = new[] { new Fx("train", 8), new Fx("sec", 4) }, ResultKo = "방호복 부대가 근원을 봉쇄하니 역병이 잦아들었다" },
                    new Choice { K = "def", LabelKo = "백신 공장을 세운다", Cost = 0, Fx = new[] { new Fx("sec", 10) }, ResultKo = "공장이 백신을 쏟아내 성 안이 나았다" },
                    new Choice { K = "util", LabelKo = "은하에게 방호를 맡긴다", Cost = 300, Fx = new[] { new Fx("recruit", 0, "tm_eunha") }, ResultKo = "은하가 방호복을 입고 성 문 앞에 섰다" },
                } },
            new Card { Id = "r4_tomb", No = 12, Act = 4, Emoji = "🔔", TitleKo = "망자의 맹세",
                MinTurn = 132, OrCities = 30, Victory = false, AllTime = false,
                TextKo = "묘역의 종소리가 멎지 않는다. 백기가 이계 군세를 걸고 일기토를 청했다. 공석은 망자 명부를 정리해 이름을 대조하고, 영점의 의체는 망자 기운에 반응해 삐걱댄다. 이긴 뒤 이계 장수를 어떻게 할지도 정해야 한다.",
                TextByKo = null, FromId = null, TextByKKo = null,
                Choices = new[]
                {
                    new Choice { K = "atk", LabelKo = "{맹장}이 일기토를 받는다", Cost = 0, Fx = new[] { new Fx("train", 10) }, ResultKo = "{맹장} 의 칼이 종소리를 갈랐다 — 백기가 물러났다" },
                    new Choice { K = "def", LabelKo = "망자를 봉인한다", Cost = 0, Fx = new[] { new Fx("sec", 8) }, ResultKo = "봉인비가 세워지니 종소리가 그쳤다" },
                    new Choice { K = "util", LabelKo = "이계 장수를 등용한다", Cost = 300, Fx = new[] { new Fx("tech", 6) }, ResultKo = "이질의 장수가 무릎을 꿇었다(충성은 낮다)" },
                } },
            new Card { Id = "r5_silk", No = 13, Act = 5, Emoji = "🐫", TitleKo = "실크로드 대상",
                MinTurn = 144, OrCities = 32, Victory = false, AllTime = false,
                TextKo = "서쪽에서 대상 행렬이 길을 열어 달라 청한다. 사막 트럭이 낙타 곁을 달리고, 궤도의 탐사 드론이 모래 밑 옛 도시를 찾고 있다. 길을 열면 교역이 들어오지만 관문을 지킬 병사가 든다.",
                TextByKo = null, FromId = null, TextByKKo = null,
                Choices = new[]
                {
                    new Choice { K = "atk", LabelKo = "관문을 열고 병사를 보낸다", Cost = 0, Fx = new[] { new Fx("train", 6), new Fx("gold", 400) }, ResultKo = "병사가 관문을 지키니 대상이 줄을 이었다" },
                    new Choice { K = "def", LabelKo = "길을 열되 통행세를 받는다", Cost = 0, Fx = new[] { new Fx("gold", 600) }, ResultKo = "통행세가 곳간을 채웠다" },
                    new Choice { K = "util", LabelKo = "드론에게 길 안내를 맡긴다", Cost = 200, Fx = new[] { new Fx("food", 1500) }, ResultKo = "드론이 길을 비추니 짐이 하나도 잃지 않고 닿았다" },
                } },
            new Card { Id = "r5_west", No = 14, Act = 5, Emoji = "📜", TitleKo = "대진의 사신",
                MinTurn = 156, OrCities = 34, Victory = false, AllTime = false,
                TextKo = "서쪽 끝 나라의 사신이 이르렀다. 도하가 번역기를 들어 말을 옮기고, 은하가 본 별 지도에 그 나라가 표시되어 있다. 화친할지, 싸울지, 교역할지 정해야 한다.",
                TextByKo = null, FromId = null, TextByKKo = null,
                Choices = new[]
                {
                    new Choice { K = "atk", LabelKo = "군세를 보여 위세를 세운다", Cost = 0, Fx = new[] { new Fx("train", 8) }, ResultKo = "위세에 눌린 사신이 조용해졌다" },
                    new Choice { K = "def", LabelKo = "화친을 청한다", Cost = 0, Fx = new[] { new Fx("sec", 8) }, ResultKo = "화친 조약이 맺어졌다" },
                    new Choice { K = "util", LabelKo = "교역을 튼다", Cost = 300, Fx = new[] { new Fx("gold", 900) }, ResultKo = "별 지도를 따라 교역이 열렸다" },
                } },
            new Card { Id = "r5_south", No = 15, Act = 5, Emoji = "⛵", TitleKo = "남해의 배",
                MinTurn = 168, OrCities = 36, Victory = false, AllTime = false,
                TextKo = "남해의 섬들이 이어 보인다. 목선이 늘어선 포구에서 공석이 구조선을 띄우고, 성연이 항법으로 항로를 연다. 섬마다 다른 시대의 것들이 표류해 왔다는 소문이 있다.",
                TextByKo = null, FromId = null, TextByKKo = null,
                Choices = new[]
                {
                    new Choice { K = "atk", LabelKo = "수군을 보내 섬을 살핀다", Cost = 0, Fx = new[] { new Fx("train", 8) }, ResultKo = "수군이 섬을 살피니 표류물에서 병기가 나왔다" },
                    new Choice { K = "def", LabelKo = "포구를 다진다", Cost = 0, Fx = new[] { new Fx("sec", 8) }, ResultKo = "포구가 다져져 배가 안전히 드나들었다" },
                    new Choice { K = "util", LabelKo = "항로를 열어 교역한다", Cost = 300, Fx = new[] { new Fx("gold", 800) }, ResultKo = "성연의 항법으로 남해 교역이 열렸다" },
                } },
            new Card { Id = "r6_end", No = 16, Act = 6, Emoji = "🎆", TitleKo = "천하의 끝",
                MinTurn = 0, OrCities = 0, Victory = true, AllTime = false,
                TextKo = "천하의 끝이 다가왔다. 잔치의 등불 아래 도하가 기록 영상을 찍고, 성연이 귀환 항로를 펼쳐 보인다. 시간 틈 사람들은 제 시대로 돌아갈지 남을지 저마다 고민한다. 이 판의 이야기는 여기서 매듭짓는다.",
                TextByKo = new Dictionary<string, string> { { "conquest", "천하가 하나가 되었다. 통일 잔치의 등불 아래 도하가 기록 영상을 찍고, 성연이 귀환 항로를 펼쳐 보인다. 시간 틈 사람들은 제 시대로 돌아갈지 남을지 저마다 고민한다." }, { "hegemony", "패권의 문턱을 넘었다. 잔치 등불 아래 시간 틈 사람들이 도하의 기록 영상 앞에 모였다. 성연이 귀환 항로를 펼치며 돌아갈 이는 돌아가라 한다." }, { "culture", "서고에 세 시대의 책이 나란히 꽂혔다. 도하가 기록 영상을 찍고 성연이 귀환 항로를 그려 넣었다. 시간 틈 사람들은 책 곁에 남을지 고민한다." }, { "diplomacy", "화친의 잔치가 열렸다. 도하가 기록 영상을 찍고 성연이 귀환 항로를 펼친다. 이웃 나라 사신과 시간 틈 사람들이 한 자리에 앉았다." }, { "survival", "이백마흔 달을 버텨 낸 성이 등불을 밝혔다. 도하가 기록 영상을 찍고 성연이 귀환 항로를 펼친다. 시간 틈 사람들은 이 성에 남기로 마음이 기운다." } }, FromId = null, TextByKKo = null,
                Choices = new[]
                {
                    new Choice { K = "atk", LabelKo = "돌아가는 이를 배웅한다", Cost = 0, Fx = new[] { new Fx("gold", 2000), new Fx("tech", 10) }, ResultKo = "귀환 항로에 등불이 켜졌고 시간 틈 사람들이 손을 흔들었다" },
                    new Choice { K = "def", LabelKo = "남는 이와 함께 지낸다", Cost = 0, Fx = new[] { new Fx("sec", 15), new Fx("tech", 10) }, ResultKo = "남은 이들이 성 안에 눌러앉아 이 시대의 이웃이 되었다" },
                    new Choice { K = "util", LabelKo = "기록 영상을 서고에 남긴다", Cost = 0, Fx = new[] { new Fx("gold", 1000), new Fx("food", 3000) }, ResultKo = "기록 영상은 서고에서 세 시대를 잇는 책이 되었다" },
                } },
            new Card { Id = "r7_gather", No = 17, Act = 7, Emoji = "🌀", TitleKo = "틈 아래 모인 아홉",
                MinTurn = 0, OrCities = 0, Victory = true, AllTime = true,
                TextKo = "결말의 잔치가 끝난 뒤, 시간 틈 사람 아홉이 성 앞 옛 성터에 모였다. 하늘의 금은 아직 아물지 않았다. {책사} 이(가) 시간 기둥의 그림자를 재고, 도하는 관측 기록을 펼치고, 성연은 귀환 항로의 마지막 눈금을 짚는다. 틈을 닫을지, 그대로 둘지, 길로 쓸지 — 이 성의 주인이 정할 차례다.",
                TextByKo = null, FromId = null, TextByKKo = null,
                Choices = new[]
                {
                    new Choice { K = "atk", LabelKo = "틈을 닫는다", Cost = 0, Fx = new[] { new Fx("sec", 10), new Fx("tech", 10) }, ResultKo = "시간 기둥에 마지막 쐐기를 박았다 — 하늘의 금이 소리 없이 아물기 시작한다" },
                    new Choice { K = "def", LabelKo = "틈을 그대로 둔다", Cost = 0, Fx = new[] { new Fx("gold", 800), new Fx("food", 2000) }, ResultKo = "틈은 그대로 두기로 했다 — 아홉이 번갈아 지켜보기로 약속했다" },
                    new Choice { K = "util", LabelKo = "틈을 길로 쓴다", Cost = 0, Fx = new[] { new Fx("gold", 1500), new Fx("train", 5) }, ResultKo = "성연이 항로에 첫 등불을 걸었다 — 틈이 세 시대를 잇는 길이 되었다" },
                } },
            new Card { Id = "r7_after", No = 18, Act = 7, Emoji = "🌠", TitleKo = "틈이 남긴 것",
                MinTurn = 0, OrCities = 0, Victory = true, AllTime = false,
                TextKo = "틈이 남긴 것을 살필 때가 왔다. {책사} 이(가) 성터에서 소식을 모아 왔다.",
                TextByKo = null, FromId = "r7_gather", TextByKKo = new Dictionary<string, string> { { "atk", "틈이 닫히고 열두 달이 지났다. 하늘의 금은 흔적도 없고 귀환 항로는 사라졌다. 아홉은 이 시대에 남기로 했고, 도하는 새 관측 기록에 \"이곳의 하늘\" 이라 적었다. 성연은 항로 대신 성벽 위 별자리를 그린다. {책사} 이(가) 성터에 비석을 세우자고 한다." }, { "def", "틈을 두고 열두 달이 지났다. 하늘의 금은 조금 넓어졌다 줄었다를 되풀이한다. 아홉은 번갈아 성터를 지키고, 도하의 관측 기록은 벌써 한 권을 채웠다. 성연은 흔들리는 항로를 손보며 \"이대로 두어도 좋겠다\" 고 웃는다." }, { "util", "틈을 길로 쓰고 열두 달이 지났다. 세 시대의 물자와 소식이 성터를 오간다. 도하는 새 관측 기록에 오가는 이를 세고, 성연은 항로에 등불을 하나씩 더 건다. {책사} 이(가) 오가는 것들을 어떻게 다스릴지 묻는다." } },
                Choices = new[]
                {
                    new Choice { K = "atk", LabelKo = "아홉을 장수로 세워 나아간다", Cost = 0, Fx = new[] { new Fx("train", 10), new Fx("tech", 10) }, ResultKo = "아홉이 각자 제 시대의 솜씨로 군사를 가르쳤다" },
                    new Choice { K = "def", LabelKo = "성터를 성벽으로 둘러 지킨다", Cost = 0, Fx = new[] { new Fx("sec", 12), new Fx("food", 2000) }, ResultKo = "성터 둘레에 낮은 성벽이 올라 백성이 마음을 놓았다" },
                    new Choice { K = "util", LabelKo = "틈에서 나온 것을 거둔다", Cost = 0, Fx = new[] { new Fx("gold", 1200) }, ResultKo = "성터에서 세 시대의 쓸 만한 것들이 나왔다" },
                } },
            new Card { Id = "r7_end", No = 19, Act = 7, Emoji = "🌅", TitleKo = "틈의 끝",
                MinTurn = 0, OrCities = 0, Victory = true, AllTime = false,
                TextKo = "틈의 이야기가 매듭지어질 때가 왔다. 성터에 잔치가 차려진다.",
                TextByKo = null, FromId = "r7_gather", TextByKKo = new Dictionary<string, string> { { "atk", "닫힌 하늘 아래 마지막 잔치가 열렸다. 성터 비석 옆에서 아홉이 잔을 든다. 도하가 마지막 영상을 찍고, 성연이 항로 대신 별자리를 새겼다. 돌아갈 길은 없어도 갈 곳은 이곳이라고, {책사} 이(가) 비문에 적었다. 틈의 이야기는 여기서 끝난다." }, { "def", "틈이 흔들리는 하늘 아래 마지막 잔치가 열렸다. 번갈아 지키던 아홉이 오랜만에 한자리에 앉았다. 도하가 마지막 영상을 찍고, 성연이 흔들리는 항로를 잔에 비춘다. 열린 채로 두는 것도 하나의 끝이라고, {책사} 이(가) 붓을 든다. 틈의 이야기는 여기서 끝난다." }, { "util", "길이 된 하늘 아래 마지막 잔치가 열렸다. 세 시대의 손님이 성터에 모였다. 도하가 마지막 영상을 찍고, 성연이 항로 끝에 마지막 등불을 걸었다. 오가는 길이 곧 이 성의 이름이라고, {책사} 이(가) 붓을 든다. 틈의 이야기는 여기서 끝난다." } },
                Choices = new[]
                {
                    new Choice { K = "atk", LabelKo = "아홉과 함께 잔을 든다", Cost = 0, Fx = new[] { new Fx("gold", 2500), new Fx("tech", 16) }, ResultKo = "아홉과 이 성의 사람들이 함께 잔을 들었다 — 웃음이 성터를 채웠다" },
                    new Choice { K = "def", LabelKo = "이 성을 모두의 고향으로 삼는다", Cost = 0, Fx = new[] { new Fx("sec", 20), new Fx("tech", 16) }, ResultKo = "아홉이 이 성을 고향이라 불렀다 — 성 안 골목마다 등불이 켜졌다" },
                    new Choice { K = "util", LabelKo = "틈의 기록을 서고에 남긴다", Cost = 0, Fx = new[] { new Fx("gold", 1200), new Fx("food", 4000) }, ResultKo = "마지막 기록이 서고에 꽂혔다 — 세 시대가 한 책장에서 만난다" },
                } },
        };

        public static Card Get(string id)
        {
            foreach (var c in Cards) if (c.Id == id) return c;
            return null;
        }
    }
}
