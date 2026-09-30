using System.Collections.Generic;

namespace Saga.Realm.Data
{
    /// <summary>
    /// PLAN.md 109-16 곁가지 「시간 틈 사람 각자 두 번째 카드」(정본 `scenario/saga-realm.md` side_time_&lt;인물&gt; · 웹 `data-scenario.js` SIDE 아홉) — 시간 틈 사람이 우리 사람이 된 지 열두 달 뒤 그 사람 고향 이야기 한 장.
    /// 본 사슬과 **따로** 흐르며(<see cref="RealmScenario.DueCardId"/> 가 본 사슬에 받을 카드가 없을 때만 낸다) 카드 속 {책사} 는 그 사람이다. 웹 충성 +5 는 이 트랙 규칙대로 수도 기술 +10. 생성물 — 웹 표를 스크립트로 옮김.
    /// </summary>
    public static class RealmScenarioSideData
    {
        public static readonly RealmScenarioData.Card[] Side =
        {
            new RealmScenarioData.Card { Id = "sd_tm_gangseo", No = 29, Act = 9, Who = "tm_gangseo", Emoji = "🛡️", TitleKo = "강서의 옛 부대",
                MinTurn = 0, TextKo = "{책사} 이(가) 성벽 위에서 오래 서 있다. 낡은 군번줄을 만지작거리며 옛 부대 이야기를 꺼낸다. 마지막 훈련 날 함께 웃던 이들의 얼굴이 이 시대 병사들의 얼굴과 겹친다고 한다.",
                Choices = new[]
                {
                    new RealmScenarioData.Choice { K = "atk", LabelKo = "옛 부대의 훈련을 이 성 병사들에게 가르쳐 달라 청한다", Cost = 0, Fx = new RealmScenarioData.Fx[] { new RealmScenarioData.Fx("train", 6), new RealmScenarioData.Fx("tech", 10) }, ResultKo = "{책사} 이(가) 옛 부대식으로 병사를 가르치자 대열이 눈에 띄게 반듯해졌다" },
                    new RealmScenarioData.Choice { K = "def", LabelKo = "군번줄을 성문에 걸어 부대를 기린다", Cost = 0, Fx = new RealmScenarioData.Fx[] { new RealmScenarioData.Fx("sec", 8), new RealmScenarioData.Fx("tech", 10) }, ResultKo = "군번줄이 성문에서 반짝이자 병사들이 옷깃을 여몄다" },
                    new RealmScenarioData.Choice { K = "util", LabelKo = "옛 부대 이야기를 기록으로 남긴다", Cost = 0, Fx = new RealmScenarioData.Fx[] { new RealmScenarioData.Fx("gold", 600), new RealmScenarioData.Fx("tech", 10) }, ResultKo = "이야기가 기록으로 남자 서고에 새 책이 꽂혔다" },
                } },
            new RealmScenarioData.Card { Id = "sd_tm_gongseok", No = 30, Act = 9, Who = "tm_gongseok", Emoji = "🦺", TitleKo = "공석의 안전 수칙",
                MinTurn = 0, TextKo = "{책사} 이(가) 성벽 공사장 한쪽에 안전 수칙을 적어 붙이고 있다. 공사판에서 동료를 잃은 뒤 생긴 버릇이라 한다. 수칙 한 줄마다 누군가의 이름이 있다고.",
                Choices = new[]
                {
                    new RealmScenarioData.Choice { K = "atk", LabelKo = "수칙대로 성벽 훈련장을 정비한다", Cost = 0, Fx = new RealmScenarioData.Fx[] { new RealmScenarioData.Fx("train", 6), new RealmScenarioData.Fx("tech", 10) }, ResultKo = "수칙을 따르자 훈련 중 다치는 병사가 눈에 띄게 줄었다" },
                    new RealmScenarioData.Choice { K = "def", LabelKo = "수칙을 성 곳곳에 붙인다", Cost = 0, Fx = new RealmScenarioData.Fx[] { new RealmScenarioData.Fx("sec", 8), new RealmScenarioData.Fx("tech", 10) }, ResultKo = "성 곳곳에 수칙이 붙자 골목의 사고가 줄고 마음이 놓였다" },
                    new RealmScenarioData.Choice { K = "util", LabelKo = "수칙을 공사 기록으로 묶는다", Cost = 0, Fx = new RealmScenarioData.Fx[] { new RealmScenarioData.Fx("gold", 600), new RealmScenarioData.Fx("tech", 10) }, ResultKo = "수칙 기록이 서고에서 성 안 공사의 기준이 되었다" },
                } },
            new RealmScenarioData.Card { Id = "sd_tm_geumdam", No = 31, Act = 9, Who = "tm_geumdam", Emoji = "💼", TitleKo = "금담의 첫 가게",
                MinTurn = 0, TextKo = "{책사} 이(가) 장터 한구석을 오래 바라본다. 처음 차린 가게가 망했던 날이 떠오른다고 한다. 그날 배운 것이 지금 이 성의 장부에 다 들어 있다며 웃는다.",
                Choices = new[]
                {
                    new RealmScenarioData.Choice { K = "atk", LabelKo = "가게를 다시 열 사람을 군수품 조달로 세운다", Cost = 0, Fx = new RealmScenarioData.Fx[] { new RealmScenarioData.Fx("train", 6), new RealmScenarioData.Fx("tech", 10) }, ResultKo = "{책사} 이(가) 장부를 다듬자 군수품이 제때 도착하기 시작했다" },
                    new RealmScenarioData.Choice { K = "def", LabelKo = "장터 자릿세를 낮춰 작은 가게를 돕는다", Cost = 0, Fx = new RealmScenarioData.Fx[] { new RealmScenarioData.Fx("sec", 8), new RealmScenarioData.Fx("tech", 10) }, ResultKo = "작은 가게들이 늘자 장터에 사람이 북적였다" },
                    new RealmScenarioData.Choice { K = "util", LabelKo = "첫 가게 자리에 새 가게를 낸다", Cost = 0, Fx = new RealmScenarioData.Fx[] { new RealmScenarioData.Fx("gold", 600), new RealmScenarioData.Fx("tech", 10) }, ResultKo = "새 가게가 문을 열자 금이 돌기 시작했다" },
                } },
            new RealmScenarioData.Card { Id = "sd_tm_myeongbyeon", No = 32, Act = 9, Who = "tm_myeongbyeon", Emoji = "⚖️", TitleKo = "명변의 첫 변론",
                MinTurn = 0, TextKo = "{책사} 이(가) 재판 마당에서 조용히 서류를 정리한다. 처음 맡았던 사건에서 졌던 기억을 꺼낸다. 진 뒤에야 말을 아끼는 법을 배웠다고 한다.",
                Choices = new[]
                {
                    new RealmScenarioData.Choice { K = "atk", LabelKo = "재판을 병사 규율에도 세운다", Cost = 0, Fx = new RealmScenarioData.Fx[] { new RealmScenarioData.Fx("train", 6), new RealmScenarioData.Fx("tech", 10) }, ResultKo = "{책사} 이(가) 규율 조항을 세우자 병영의 다툼이 조용히 가라앉았다" },
                    new RealmScenarioData.Choice { K = "def", LabelKo = "재판 마당을 백성에게 연다", Cost = 0, Fx = new RealmScenarioData.Fx[] { new RealmScenarioData.Fx("sec", 8), new RealmScenarioData.Fx("tech", 10) }, ResultKo = "재판 마당이 열리자 억울하다는 소리가 줄었다" },
                    new RealmScenarioData.Choice { K = "util", LabelKo = "변론 기록을 서고에 묶는다", Cost = 0, Fx = new RealmScenarioData.Fx[] { new RealmScenarioData.Fx("gold", 600), new RealmScenarioData.Fx("tech", 10) }, ResultKo = "변론 기록이 서고에 꽂혔다" },
                } },
            new RealmScenarioData.Card { Id = "sd_tm_doha", No = 33, Act = 9, Who = "tm_doha", Emoji = "💻", TitleKo = "도하의 첫 프로그램",
                MinTurn = 0, TextKo = "{책사} 이(가) 서고에서 필사본을 넘기다 웃는다. 처음 짠 프로그램은 화면에 안녕이라는 글자만 띄웠다고 한다. 그 글자가 이 시대 붓글씨와 닮아 신기하다는 것이다.",
                Choices = new[]
                {
                    new RealmScenarioData.Choice { K = "atk", LabelKo = "서고 필사본 정리를 군 문서에 넓힌다", Cost = 0, Fx = new RealmScenarioData.Fx[] { new RealmScenarioData.Fx("train", 6), new RealmScenarioData.Fx("tech", 10) }, ResultKo = "{책사} 이(가) 문서를 정리하자 명령이 어긋나는 일이 줄었다" },
                    new RealmScenarioData.Choice { K = "def", LabelKo = "서고를 백성에게 잠시 연다", Cost = 0, Fx = new RealmScenarioData.Fx[] { new RealmScenarioData.Fx("sec", 8), new RealmScenarioData.Fx("tech", 10) }, ResultKo = "서고에 사람들이 드나들자 성 안에 글 읽는 소리가 났다" },
                    new RealmScenarioData.Choice { K = "util", LabelKo = "첫 프로그램 이야기를 기록으로 남긴다", Cost = 0, Fx = new RealmScenarioData.Fx[] { new RealmScenarioData.Fx("gold", 600), new RealmScenarioData.Fx("tech", 10) }, ResultKo = "이야기가 기록으로 남아 서고에 새 줄이 생겼다" },
                } },
            new RealmScenarioData.Card { Id = "sd_tm_seongyeon", No = 34, Act = 9, Who = "tm_seongyeon", Emoji = "🧭", TitleKo = "성연의 첫 항로",
                MinTurn = 0, TextKo = "{책사} 이(가) 나루에서 강물을 오래 바라본다. 첫 항로를 그렸던 날, 지도에 없는 길을 그어서 야단맞았다고 한다. 그 길이 결국 맞았다는 얘기를 하며 웃는다.",
                Choices = new[]
                {
                    new RealmScenarioData.Choice { K = "atk", LabelKo = "항로를 군 이동 길에 접목한다", Cost = 0, Fx = new RealmScenarioData.Fx[] { new RealmScenarioData.Fx("train", 6), new RealmScenarioData.Fx("tech", 10) }, ResultKo = "{책사} 이(가) 길을 손보자 행군이 하루 빨라졌다" },
                    new RealmScenarioData.Choice { K = "def", LabelKo = "나루에 등불을 세운다", Cost = 0, Fx = new RealmScenarioData.Fx[] { new RealmScenarioData.Fx("sec", 8), new RealmScenarioData.Fx("tech", 10) }, ResultKo = "나루 등불이 서자 밤 뱃길이 안전해졌다" },
                    new RealmScenarioData.Choice { K = "util", LabelKo = "첫 항로 그림을 서고에 남긴다", Cost = 0, Fx = new RealmScenarioData.Fx[] { new RealmScenarioData.Fx("gold", 600), new RealmScenarioData.Fx("tech", 10) }, ResultKo = "항로 그림이 서고에서 길 찾는 이의 안내가 되었다" },
                } },
            new RealmScenarioData.Card { Id = "sd_tm_gwedo", No = 35, Act = 9, Who = "tm_gwedo", Emoji = "🧑‍🚀", TitleKo = "궤도의 첫 비행",
                MinTurn = 0, TextKo = "{책사} 이(가) 성루 위에서 밤하늘을 올려다본다. 처음 궤도에 오른 날 밑을 내려다보며 이 세상이 얼마나 작고 따뜻한지 알았다고 한다. 지금은 그 마음으로 이 성을 본다는 것이다.",
                Choices = new[]
                {
                    new RealmScenarioData.Choice { K = "atk", LabelKo = "성루의 감시를 궤도식으로 바꾼다", Cost = 0, Fx = new RealmScenarioData.Fx[] { new RealmScenarioData.Fx("train", 6), new RealmScenarioData.Fx("tech", 10) }, ResultKo = "{책사} 이(가) 성루 경계를 손보자 밤 경계가 한결 빈틈없어졌다" },
                    new RealmScenarioData.Choice { K = "def", LabelKo = "성루에 별 보는 자리를 만든다", Cost = 0, Fx = new RealmScenarioData.Fx[] { new RealmScenarioData.Fx("sec", 8), new RealmScenarioData.Fx("tech", 10) }, ResultKo = "성루 별 자리에 사람들이 모이자 밤 골목이 평온해졌다" },
                    new RealmScenarioData.Choice { K = "util", LabelKo = "하늘 사진을 서고에 남긴다", Cost = 0, Fx = new RealmScenarioData.Fx[] { new RealmScenarioData.Fx("gold", 600), new RealmScenarioData.Fx("tech", 10) }, ResultKo = "하늘 사진이 서고 한 벽을 채웠다" },
                } },
            new RealmScenarioData.Card { Id = "sd_tm_eunha", No = 36, Act = 9, Who = "tm_eunha", Emoji = "🚀", TitleKo = "은하의 첫 조종간",
                MinTurn = 0, TextKo = "{책사} 이(가) 마구간 앞에서 말의 갈기를 쓸어 준다. 처음 조종간을 잡았을 때 손이 떨렸다고 한다. 말도 조종간도 손을 믿어 줄 때 가장 잘 따른다며 웃는다.",
                Choices = new[]
                {
                    new RealmScenarioData.Choice { K = "atk", LabelKo = "기병 훈련에 조종의 요령을 보탠다", Cost = 0, Fx = new RealmScenarioData.Fx[] { new RealmScenarioData.Fx("train", 6), new RealmScenarioData.Fx("tech", 10) }, ResultKo = "{책사} 이(가) 요령을 가르치자 기병 대열의 돌격이 매끄러워졌다" },
                    new RealmScenarioData.Choice { K = "def", LabelKo = "마구간을 새로 고친다", Cost = 0, Fx = new RealmScenarioData.Fx[] { new RealmScenarioData.Fx("sec", 8), new RealmScenarioData.Fx("tech", 10) }, ResultKo = "마구간이 새로워지자 말도 사람도 마음이 놓였다" },
                    new RealmScenarioData.Choice { K = "util", LabelKo = "비행 궤적을 서고에 남긴다", Cost = 0, Fx = new RealmScenarioData.Fx[] { new RealmScenarioData.Fx("gold", 600), new RealmScenarioData.Fx("tech", 10) }, ResultKo = "궤적 그림이 서고에 걸려 볼거리가 되었다" },
                } },
            new RealmScenarioData.Card { Id = "sd_tm_yeongjeom", No = 37, Act = 9, Who = "tm_yeongjeom", Emoji = "🦾", TitleKo = "영점의 옛 훈련장",
                MinTurn = 0, TextKo = "{책사} 이(가) 무예 마당 한가운데 서서 말없이 의체를 살핀다. 처음 의체를 입던 날 아팠다는 얘기는 안 했다. 대신 이 마당이 옛 훈련장을 닮았다고만 한다.",
                Choices = new[]
                {
                    new RealmScenarioData.Choice { K = "atk", LabelKo = "무예 마당에서 직접 병사를 상대해 준다", Cost = 0, Fx = new RealmScenarioData.Fx[] { new RealmScenarioData.Fx("train", 6), new RealmScenarioData.Fx("tech", 10) }, ResultKo = "{책사} 이(가) 병사들과 겨루자 마당 가득 함성이 울렸다" },
                    new RealmScenarioData.Choice { K = "def", LabelKo = "무예 마당에 쉼터를 세운다", Cost = 0, Fx = new RealmScenarioData.Fx[] { new RealmScenarioData.Fx("sec", 8), new RealmScenarioData.Fx("tech", 10) }, ResultKo = "쉼터가 서자 다친 병사가 쉬어 갈 수 있게 되었다" },
                    new RealmScenarioData.Choice { K = "util", LabelKo = "기동 기록을 서고에 남긴다", Cost = 0, Fx = new RealmScenarioData.Fx[] { new RealmScenarioData.Fx("gold", 600), new RealmScenarioData.Fx("tech", 10) }, ResultKo = "기동 기록이 서고에 꽂혀 무예서의 옆자리를 차지했다" },
                } },
        };

        public static RealmScenarioData.Card Get(string id)
        {
            foreach (var c in Side) if (c.Id == id) return c;
            return null;
        }
    }
}
