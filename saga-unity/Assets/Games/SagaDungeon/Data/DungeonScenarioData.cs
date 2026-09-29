namespace Saga.Dungeon.Data
{
    /// <summary>
    /// PLAN.md 109-16 사가블로 시나리오 「이름이 지워지는 나라」 표(웹 사가블로 `js/data-scenario.js` · 정본 `scenario/saga-dungeon.md`) — 1막 중원의 난 셋 · 2막 잿빛과 소금 셋 ·
    /// 3막 불타는 남쪽 넷 · 4막 모래와 눈과 고철 넷 · 5막 이름 없는 곳 둘 · 6막 비석 너머 셋 = 열아홉 장, 장면 41. **표 원본은 웹 파일에서 스크립트로 옮겼다**(한 자도 손으로 안 옮김).
    /// 이 트랙 다름: 층 주인 이름을 이 트랙 것으로(옥관 수릉장·잿빛 성주·비늘 수문장·구름 천장), 웹 명소 키 `heaven` 은 이 트랙 `cloud`.
    /// 생성물 — 고치려면 웹 표를 고치고 다시 옮긴다. 영어·한국어 글은 `dungeon_*.json` 의 `dscen.*` 키.
    /// </summary>
    public static class DungeonScenarioData
    {
        public sealed class Cast { public string Id, NameKo, Emoji; }

        public readonly struct Line
        {
            /// <summary>말하는 이 — `me`(부대 선두) 또는 <see cref="Casts"/> 의 id.</summary>
            public readonly string Who, Ko;
            public Line(string who, string ko) { Who = who; Ko = ko; }
        }

        public sealed class Option { public string Key, LabelKo; public int Feat, Gold; }

        public sealed class Choice { public string Id, PromptKo; public Option[] Options; }

        public sealed class Scene
        {
            public string Id, ChapterId;
            public Line[] Lines;
            /// <summary>마지막 줄 뒤 고르기(망루성 성주의 이름).</summary>
            public Choice Choice;
        }

        /// <summary>talk · kill · floor · chain · landmark · rescue · region — 웹 단계 종류 그대로.</summary>
        public sealed class Step { public string T, Scene, Key, By; public int N; }

        public sealed class Chapter
        {
            public string Id, TitleKo, StageKo, BlurbKo, After, AwardKo;
            public int No, Act, Exp, Gold, Feat;
            public Step[] Steps;
        }

        public static readonly Cast[] Casts =
        {
            new Cast { Id = "mukhyang", NameKo = "사관 묵향", Emoji = "📜" },
            new Cast { Id = "gyogyo", NameKo = "교두", Emoji = "🥋" },
            new Cast { Id = "yeoldusi", NameKo = "시간 여행자 열두시", Emoji = "⌛" },
            new Cast { Id = "guard", NameKo = "벌판 역참지기", Emoji = "🏮" },
            new Cast { Id = "danchu", NameKo = "고물 줍는 아이 단추", Emoji = "🧒" },
            new Cast { Id = "boatman", NameKo = "염전 늙은 뱃사공", Emoji = "🚣" },
            new Cast { Id = "lord", NameKo = "잿빛 성주의 망령", Emoji = "👑" },
            new Cast { Id = "soyeon", NameKo = "떠돌이 퇴마사 소연", Emoji = "🔮" },
            new Cast { Id = "mechanic", NameKo = "개척지 정비공", Emoji = "🔧" },
            new Cast { Id = "mumyeong", NameKo = "이름을 삼키는 목소리", Emoji = "🌑" },
            new Cast { Id = "caravan", NameKo = "대상 우두머리", Emoji = "🐫" },
            new Cast { Id = "cable", NameKo = "케이블카 기사", Emoji = "🚡" },
            new Cast { Id = "kkik", NameKo = "수리 로봇 끽", Emoji = "🤖" },
            new Cast { Id = "taoist", NameKo = "사당지기 도사", Emoji = "☁️" },
        };

        public static readonly Scene[] Scenes =
        {
            new Scene { Id = "moru1", ChapterId = "a1_moru",
                Lines = new[] {
                    new Line("mukhyang", "부임 첫날부터 황건 떼가 마을 어귀를 쳤습니다. 다행히 담이 버텼지요. 저는 이 마을 사관 묵향입니다."),
                    new Line("me", "기와 담 너머로 이상한 것이 지나갔습니다. 하늘을 나는 작은 쇠 눈알 같은 것이요."),
                    new Line("mukhyang", "정찰 드론이라 하더군요. 택배 기사 손님이 짐을 떨어뜨리고 도망갔는데, 그 짐도 이 시대 것이 아니었습니다."),
                    new Line("mukhyang", "그보다 큰일이 있습니다. 요즘 죽은 이들의 이름이 비석에서 지워집니다. 굴혈 쪽에서 시작된 일입니다. 우선 어귀의 무리부터 쓸어 주십시오.") },
                Choice = null },
            new Scene { Id = "moru2", ChapterId = "a1_moru",
                Lines = new[] {
                    new Line("mukhyang", "어귀가 조용해졌습니다. 무리의 창끝에 쓰인 글자 하나 없는 것을 보셨습니까? 이름을 모르는 병사들이었습니다."),
                    new Line("me", "굴혈이 저 아래에 열려 있다고 하셨지요. 첫 층을 보고 오겠습니다.") },
                Choice = null },
            new Scene { Id = "moru3", ChapterId = "a1_moru",
                Lines = new[] {
                    new Line("me", "첫 층에 닿았습니다. 벽에 이름 자국이 긁혀 있었는데, 누가 새겼다 지운 듯했습니다."),
                    new Line("mukhyang", "굴혈이 사람들의 이름을 먹고 있다는 소문이 사실인가 봅니다. 이 기록을 잇는 것이 제 일입니다. 더 내려가시면 제가 적겠습니다."),
                    new Line("gyogyo", "거기 새 부임자. 교두 노릇을 맡은 늙은이요. 벌판의 흑기 도적부터 정리하시오. 결사의 비석도 그다음에 알려 주겠소.") },
                Choice = null },
            new Scene { Id = "flag1", ChapterId = "a1_blackflag",
                Lines = new[] {
                    new Line("guard", "벌판 역참을 밤마다 검은 깃발 무리가 턴다오. 그 깃발에는 이름 하나 적혀 있지 않소. 대장의 갑옷에는 빛나는 문양이 박혀 있다는 소문도 있고."),
                    new Line("me", "폭주하는 젊은이들까지 도적 편에 붙었다지요. 이 벌판부터 잠재우겠습니다.") },
                Choice = null },
            new Scene { Id = "flag2", ChapterId = "a1_blackflag",
                Lines = new[] {
                    new Line("guard", "흑기 대장이 쓰러졌소! 이제 수레가 다시 다니겠소."),
                    new Line("gyogyo", "결사비가 열렸소. 결사로 들어서면 한 번 죽으면 끝이라, 각오가 있어야 하오."),
                    new Line("me", "깃발에 이름이 없던 까닭은 결국 알 수 없었습니다. 굴혈 안에 답이 있을 것 같습니다.") },
                Choice = null },
            new Scene { Id = "tomb1", ChapterId = "a1_tomb",
                Lines = new[] {
                    new Line("mukhyang", "굴혈 다섯째 층에는 옛 왕릉이 있습니다. 순장된 병사들이 아직도 칼을 쥐고 서 있다지요. 가장 안쪽 현실에 옥관을 쓴 수릉장이 있습니다."),
                    new Line("me", "왕릉의 벽마다 도굴꾼의 손전등 자국이 남아 있었습니다. 누군가 먼저 드나든 흔적입니다."),
                    new Line("mukhyang", "그 벽에 새 이름을 적는 빛 비석이 있다는 이야기도 들었습니다. 잘 살펴봐 주십시오.") },
                Choice = null },
            new Scene { Id = "fac1", ChapterId = "a2_factory",
                Lines = new[] {
                    new Line("danchu", "아저씨, 공장 굴뚝에서 쇠 긁는 소리가 밤새 나요. 무서워서 못 가겠어요. 고물을 주우러 가야 하는데."),
                    new Line("me", "공장 아래에 옛 성벽이 있다더군요. 방역복 차림의 누가 폐도시를 훑고 다닌다는 말도 들었습니다."),
                    new Line("danchu", "맞아요, 회색 옷 입은 이들이 있어요. 공장의 심장이 굴혈로 이어진 관이래요. 부탁이에요!") },
                Choice = null },
            new Scene { Id = "fac2", ChapterId = "a2_factory",
                Lines = new[] {
                    new Line("danchu", "소리가 멎었어요! 폭주룡도 없어졌고요. 고철을 한 아름 주웠어요."),
                    new Line("me", "공장 심장의 관은 굴혈로 이어져 있었습니다. 굴혈의 이름 먹는 소리와 같은 결이더군요."),
                    new Line("danchu", "이 고물 상점은 아저씨께 드릴게요. 필요한 부품이 있을 거예요.") },
                Choice = null },
            new Scene { Id = "tide1", ChapterId = "a2_tideflat",
                Lines = new[] {
                    new Line("boatman", "썰물 때마다 갯벌 밑에서 무언가 운다오. 배가 셋이나 사라졌소. 바다가 이름을 부르며 물러갔다고들 하지."),
                    new Line("me", "녹슨 관측탑이 갯벌 한가운데 서 있다지요. 실험실 장갑을 두른 것들도 보입니다."),
                    new Line("boatman", "뱃노래 가락이 갯벌 밑에서 되돌아 나오는 밤이 있소. 촉수왕이 그걸 흉내 내는 것 같소.") },
                Choice = null },
            new Scene { Id = "tide2", ChapterId = "a2_tideflat",
                Lines = new[] {
                    new Line("boatman", "밀물이 제 소리로 돌아왔소. 소금 한 섬을 받아 주시오."),
                    new Line("me", "갯벌이 부르던 이름은 결국 배 셋의 사공들 이름이었습니다. 이제 그 이름이 굴혈에 남는 일은 없겠지요."),
                    new Line("gyogyo", "잿빛 성주가 이름을 잃어 성을 떠나지 못한다는 소문이오. 10층으로 내려가 보시오.") },
                Choice = null },
            new Scene { Id = "fort1", ChapterId = "a2_watchtower",
                Lines = new[] {
                    new Line("lord", "내… 이름이 무엇이었더냐. 비상등만 깜박이는 성문 앞에서 수백 해를 서 있었다. 투구 속의 이 기계 눈은 누가 심었느냐."),
                    new Line("mukhyang", "제 기록에 남은 성주의 이름을 찾았습니다. 돌려주면 망령이 성을 떠나겠지만, 이름을 봉인하면 성이 그 갑주를 내놓을 것입니다."),
                    new Line("me", "이름을 돌려줄지, 봉인할지 — 결정은 제가 하겠습니다.") },
                Choice = new Choice { Id = "fort", PromptKo = "성주의 이름을 어떻게 할 것인가", Options = new[] { new Option { Key = "restore", LabelKo = "이름을 돌려준다", Feat = 30, Gold = 0 }, new Option { Key = "seal", LabelKo = "이름을 봉인한다", Feat = 0, Gold = 3000 } } } },
            new Scene { Id = "fort2_restore", ChapterId = "a2_watchtower",
                Lines = new[] {
                    new Line("lord", "이제 기억난다. 그 이름을 내 것이라 부르니 가슴이 가볍다. 성을 떠나마. 네게 가호를 남긴다."),
                    new Line("mukhyang", "이름 하나가 돌아왔습니다. 굴혈이 삼킨 이름들 중 하나를 되찾은 셈이지요.") },
                Choice = null },
            new Scene { Id = "fort2_seal", ChapterId = "a2_watchtower",
                Lines = new[] {
                    new Line("lord", "이름을 빼앗겼지만… 성을 지킬 갑주는 남는군. 가져가라, 이 조각을."),
                    new Line("mukhyang", "봉인된 이름은 제 기록에 따로 적어 두겠습니다. 어떤 결정이든 기록은 남습니다.") },
                Choice = null },
            new Scene { Id = "rg1", ChapterId = "a3_riftgate",
                Lines = new[] {
                    new Line("soyeon", "떠돌이 퇴마사 소연이오. 균열은 무명혈의 곁가지요. 문지기 겁옥이 그 문을 지키며 이름을 걸러 내고 있소."),
                    new Line("me", "균열에 버스 한 대가 떨어져 있었습니다. 안에는 아무도 없고 창문마다 별바다 손님들이 매달려 있더군요."),
                    new Line("soyeon", "시대 손님이오. 문이 열리는 대로 다른 시대의 것이 끼어들지. 봉인비 앞에서 문지기를 상대해 주시오.") },
                Choice = null },
            new Scene { Id = "rg2", ChapterId = "a3_riftgate",
                Lines = new[] {
                    new Line("soyeon", "봉인비에 새 글자가 새겨졌소. 균열이 멈췄고 부적 던전도 열 수 있게 되었소. 이 부적을 받으시오."),
                    new Line("mukhyang", "문지기의 창끝에도 이름이 없었습니다. 겁옥이라는 이름조차 누군가에게서 빌린 듯했지요.") },
                Choice = null },
            new Scene { Id = "sf1", ChapterId = "a3_sunfurnace",
                Lines = new[] {
                    new Line("mechanic", "태양로 온도가 계속 올라요. 발전 설비도 미쳐 날뛰고, 거신 하나가 로 한복판에 선 채 움직이지 않아요. 개척지 우물 곁에 천막을 쳤는데 밤마다 뜨겁습니다."),
                    new Line("me", "균열의 열을 먹고 폭주하는군요. 제어반 근처까지 무리를 몰아내겠습니다.") },
                Choice = null },
            new Scene { Id = "sf2", ChapterId = "a3_sunfurnace",
                Lines = new[] {
                    new Line("mechanic", "태양판 위로 다시 새가 앉았어요! 개척지에 불이 들어왔습니다."),
                    new Line("me", "거신의 등에서 굴혈로 이어지는 관을 보았습니다. 이 열도 굴혈에서 온 것이더군요.") },
                Choice = null },
            new Scene { Id = "bw1", ChapterId = "a3_blackwind",
                Lines = new[] {
                    new Line("mukhyang", "15층에 흑풍 산채가 있습니다. 채주는 이름을 팔아 힘을 샀다고 합니다. 무전기와 총포까지 갖췄다는 소문이에요."),
                    new Line("me", "경비 보행기가 산채 앞에 서 있는 것도 보았습니다. 도적들이 다른 시대의 것을 산 셈이군요.") },
                Choice = null },
            new Scene { Id = "bw2", ChapterId = "a3_blackwind",
                Lines = new[] {
                    new Line("mukhyang", "채주가 쓰러졌습니다. 그의 이름은 채주가 되기 전에 지워졌더군요. 굴혈이 이름을 사 간 것입니다."),
                    new Line("me", "한 사람의 이름이 아니라, 이름이 팔리는 장사가 있었던 것입니다.") },
                Choice = null },
            new Scene { Id = "pal1", ChapterId = "a3_palace",
                Lines = new[] {
                    new Line("mukhyang", "20층은 물에 잠긴 용궁입니다. 용궁 기와 아래로 잠수 장비의 잔해가 흩어져 있고, 수압 돔이 반쯤 남아 있다고 합니다."),
                    new Line("me", "비늘 수문장을 상대해야 아래로 갈 수 있겠지요. 내려가 보겠습니다.") },
                Choice = null },
            new Scene { Id = "pal2", ChapterId = "a3_palace",
                Lines = new[] {
                    new Line("mumyeong", "…이름을 다오. 너도 이름이 있지 않으냐. 나는 그것을 먹으며 자랐다. 이름을 다오."),
                    new Line("me", "누구냐! 바닥에서 목소리가 들립니다. 이름을 먹는다고?"),
                    new Line("mukhyang", "무명혈의 주인입니다. 이 굴혈 전체가 그의 몸이었어요. 기록을 서둘러야 합니다.") },
                Choice = null },
            new Scene { Id = "car1", ChapterId = "a4_caravan",
                Lines = new[] {
                    new Line("caravan", "서역 길목이 막힌 지 석 달째요. 낙타도 짐도 돌아오지 않소. 모래에 트럭이 박혀 있고 묻힌 유적 속에서는 빛 문이 열려 있다는 말도 있소."),
                    new Line("me", "모래바다 폭군이 길을 막고 있다지요. 대상 길부터 열겠습니다.") },
                Choice = null },
            new Scene { Id = "car2", ChapterId = "a4_caravan",
                Lines = new[] {
                    new Line("caravan", "방울 소리가 다시 들리오! 비단 한 필을 남기고 가겠소. 이 길이 열렸으니 더 많은 이름이 돌아올 게요.") },
                Choice = null },
            new Scene { Id = "snow1", ChapterId = "a4_snowfort",
                Lines = new[] {
                    new Line("cable", "산성 폐허에 누가 눌러앉아 케이블카가 끊겼어요. 골짜기가 고립됐습니다. 칸 안에 커다란 손자국이 얼어붙어 있었고요."),
                    new Line("me", "케이블카를 다시 돌려 산성으로 오르겠습니다. 거한이 있다면 그 자리에서 만나지요.") },
                Choice = null },
            new Scene { Id = "snow2", ChapterId = "a4_snowfort",
                Lines = new[] {
                    new Line("cable", "케이블카가 다시 움직여요! 골짜기에 불빛이 켜졌습니다."),
                    new Line("me", "거한의 몸에 냉각관이 박혀 있었습니다. 산 위의 눈은 이 땅의 것이 아니었군요.") },
                Choice = null },
            new Scene { Id = "scr1", ChapterId = "a4_scrap",
                Lines = new[] {
                    new Line("kkik", "끽… 제 이름은 끽입니다. 쓰러진 기계들이 하나씩 사라져요. 누군가 모으고 있어요. 저는 제 이름을 꽉 붙잡아서 멀쩡합니다."),
                    new Line("me", "이름을 먹고 일어선 기계라면 고철 거신이겠군요. 옛 감시탑 곁으로 가 보겠습니다.") },
                Choice = null },
            new Scene { Id = "scr2", ChapterId = "a4_scrap",
                Lines = new[] {
                    new Line("kkik", "황무지의 기계들이 잠들었어요. 이제 나사 한 줌을 드릴게요. 저도 함께 갈래요. 이름을 지키는 법을 알려 드릴 수 있어요."),
                    new Line("me", "든든한 동행이 생겼습니다. 마을에서 수리도 부탁드리겠습니다.") },
                Choice = null },
            new Scene { Id = "hg1", ChapterId = "a4_hellgate",
                Lines = new[] {
                    new Line("mukhyang", "25층 업화 대문입니다. 돌기둥에 경고 표지판이 붙어 있고, 문지기의 기계 팔이 문을 지킵니다. 문 너머는 천계로 이어져 있다지요."),
                    new Line("me", "경고 표지판은 어느 시대 글자로 쓰여 있었습니다. 문 너머가 두렵지만 가야겠습니다.") },
                Choice = null },
            new Scene { Id = "hg2", ChapterId = "a4_hellgate",
                Lines = new[] {
                    new Line("mukhyang", "문이 열렸습니다. 이제 천계 사당이 눈앞입니다. 마지막 막이 다가옵니다."),
                    new Line("me", "이름이 돌아오는 날까지 걷겠습니다.") },
                Choice = null },
            new Scene { Id = "hv1", ChapterId = "a5_heaven",
                Lines = new[] {
                    new Line("taoist", "하늘 사당의 수호장이 사당을 버렸소. 그 칼끝이 이제 우리를 향하오. 비석에 빛이 꺼지고 엘리베이터도 무너졌소."),
                    new Line("me", "수호장은 무명왕에게 이름을 판 첫 장수라 들었습니다. 구름 위 금궐까지 올라가겠습니다.") },
                Choice = null },
            new Scene { Id = "hv2", ChapterId = "a5_heaven",
                Lines = new[] {
                    new Line("taoist", "비석에 빛이 돌아왔소. 구주를 평정한 이는 그대가 되겠구려."),
                    new Line("mukhyang", "구름 천장이 쓰러졌습니다. 이제 남은 것은 이름을 먹는 자 하나입니다. 무명왕이 눈앞에 있습니다.") },
                Choice = null },
            new Scene { Id = "nl1", ChapterId = "a5_nameless",
                Lines = new[] {
                    new Line("mumyeong", "어서 오라. 내가 먹은 이름들이 세 시대의 모습으로 나를 지킨다 — 장수, 폭주족, 기계. 너도 이름을 내놓으라."),
                    new Line("me", "지워진 이름은 돌려받겠습니다. 비석 숲에 이름을 되돌리는 것이 제 일입니다."),
                    new Line("mukhyang", "제 기록에 적은 이름이 모두 이곳에 있습니다. 하나씩 되찾읍시다.") },
                Choice = null },
            new Scene { Id = "nl2_restore", ChapterId = "a5_nameless",
                Lines = new[] {
                    new Line("mumyeong", "…이름들이 돌아간다. 비석이 다시 글자를 얻는구나."),
                    new Line("lord", "내 이름도 돌아왔으니 이 싸움에 함께하겠다. 성을 떠나 네 곁에 서리라."),
                    new Line("mukhyang", "기록이 끝났습니다. 지워졌던 비석의 이름이 모두 되돌아왔어요. 당신은 이름을 찾은 자입니다.") },
                Choice = null },
            new Scene { Id = "nl2_seal", ChapterId = "a5_nameless",
                Lines = new[] {
                    new Line("mumyeong", "…이름들이 돌아간다. 비석이 다시 글자를 얻는구나."),
                    new Line("mukhyang", "봉인했던 잿빛 성주의 이름은 제 기록에 따로 남겨 두었습니다. 다 돌려주지는 못했지만 대부분 되돌렸어요."),
                    new Line("me", "기록은 남았고 굴혈은 조용해졌습니다. 저는 이름을 찾은 자로 남겠습니다.") },
                Choice = null },
            new Scene { Id = "or1", ChapterId = "a6_orphan",
                Lines = new[] {
                    new Line("mukhyang", "이상합니다. 이름은 모두 돌아왔는데 비석 한 구석에 글자가 하나 남았어요. 어느 기록에도 없는 이름입니다."),
                    new Line("danchu", "이 글자, 도시 잔해 조각에도 새겨져 있었어요! 주인이 없는 이름이라 어디에도 돌려줄 데가 없대요."),
                    new Line("me", "주인 없는 이름이 비석 아래 새 틈을 열고 있군요. 굴혈을 더 내려가 보겠습니다.") },
                Choice = null },
            new Scene { Id = "or2", ChapterId = "a6_orphan",
                Lines = new[] {
                    new Line("kkik", "삐걱— 32층 지도에 없는 문. 문틀에는 빛 기둥의 글자가, 문짝에는 비석 숲의 이끼가 붙어 있어요."),
                    new Line("mukhyang", "이름 하나가 세 시대를 다 건너와 이 문 앞에 섰다는 뜻이겠지요. 기록해 두겠습니다."),
                    new Line("me", "문 너머에 주인을 찾아 주러 가겠습니다.") },
                Choice = null },
            new Scene { Id = "fd1", ChapterId = "a6_ford",
                Lines = new[] {
                    new Line("boatman", "갈대나루에 밤마다 배 없는 노 소리가 난다오. 노 젓는 이가 누구든 이름이 없으니 물이 대답을 안 해."),
                    new Line("soyeon", "틈이 나루까지 번졌어요. 이름 없는 노꾼이 배를 저어 시대를 건너다니고 있더군요."),
                    new Line("me", "굴혈 34층에 그 노꾼의 배가 정박해 있을 것 같습니다. 내려가 보겠습니다.") },
                Choice = null },
            new Scene { Id = "fd2", ChapterId = "a6_ford",
                Lines = new[] {
                    new Line("kkik", "34층 물가에서 배 한 척 발견! 뱃머리에 새겨진 글자를 스캔했어요 — 도시 잔해 조각의 그 글자와 같은 획이에요."),
                    new Line("boatman", "내 늙은 눈에도 알겠소. 저 노꾼은 이름을 잃은 게 아니라 이름을 지키려고 스스로 지운 사람이오."),
                    new Line("mukhyang", "그렇다면 마지막 문 너머에서 이름을 되돌려 줄 수 있습니다.") },
                Choice = null },
            new Scene { Id = "bd1", ChapterId = "a6_beyond",
                Lines = new[] {
                    new Line("mumyeong", "(작은 목소리로) 내가 삼킨 이름 중에 삼켜지지 않은 하나가 있었다. 그 이름이 내 뱃속에서 문을 열었지."),
                    new Line("me", "삼킨 이름을 지키려는 이름이 있었다는 말이군요."),
                    new Line("soyeon", "문 너머 36층에 그가 기다려요. 이번에는 싸우러가 아니라 이름을 돌려주러 가는 길이에요.") },
                Choice = null },
            new Scene { Id = "bd2", ChapterId = "a6_beyond",
                Lines = new[] {
                    new Line("taoist", "비석 너머에도 비석이 있었구려. 그 위에 글자를 새기는 이는 늘 새 이름을 얻는다 하오."),
                    new Line("danchu", "제가 새겨 봐도 돼요? …이름은 \"이 땅을 걸어온 사람\"으로 하래요!"),
                    new Line("mukhyang", "주인 없던 이름이 주인을 얻었습니다. 기록을 맺겠습니다 — 당신은 비석 너머의 이름입니다.") },
                Choice = null },
            new Scene { Id = "tomb2", ChapterId = "a1_tomb",
                Lines = new[] {
                    new Line("yeoldusi", "살았다! 저는 시간 여행자 열두시입니다. 이 굴혈의 구멍은 우리 시대 지도에 없습니다 — 무명혈이라 불리는 지도에 없는 구멍이죠."),
                    new Line("me", "지도에 없는 구멍이라니. 이 땅의 이름을 먹는 것과 관계가 있습니까?"),
                    new Line("yeoldusi", "있습니다. 이름이 지워진 곳은 앞날의 기록에서도 지워지지요. 더 깊은 곳에서 그 주인이 이름을 모으고 있을 겁니다."),
                    new Line("mukhyang", "기록해 두겠습니다. 1막은 여기까지입니다. 이름이 지워지는 나라의 끝을 함께 찾아봅시다.") },
                Choice = null },
        };

        public static readonly Chapter[] Chapters =
        {
            new Chapter { Id = "a1_moru", No = 1, Act = 1, TitleKo = "모루골 부임", StageKo = "모루골", BlurbKo = "부임 첫날 황건 떼가 마을 어귀를 친다. 사관 묵향이 \"죽은 이들 이름이 비석에서 지워진다\"고 털어놓는다.",
                After = null, Exp = 60, Gold = 300, Feat = 0, AwardKo = "",
                Steps = new[]
                {
                    new Step { T = "talk", Scene = "moru1", N = 0, Key = "", By = "" },
                    new Step { T = "kill", Scene = "", N = 10, Key = "", By = "" },
                    new Step { T = "talk", Scene = "moru2", N = 0, Key = "", By = "" },
                    new Step { T = "floor", Scene = "", N = 1, Key = "", By = "" },
                    new Step { T = "talk", Scene = "moru3", N = 0, Key = "", By = "" },
                } },
            new Chapter { Id = "a1_blackflag", No = 2, Act = 1, TitleKo = "흑기 도적의 밤", StageKo = "중원 벌판", BlurbKo = "벌판 역참지기의 부탁으로 흑기 대장을 친다. 대장의 깃발에도 이름이 없다.",
                After = "a1_moru", Exp = 100, Gold = 800, Feat = 0, AwardKo = "",
                Steps = new[]
                {
                    new Step { T = "talk", Scene = "flag1", N = 0, Key = "", By = "" },
                    new Step { T = "chain", Scene = "", N = 0, Key = "jungwon", By = "" },
                    new Step { T = "talk", Scene = "flag2", N = 0, Key = "", By = "" },
                } },
            new Chapter { Id = "a1_tomb", No = 3, Act = 1, TitleKo = "순장 왕릉", StageKo = "굴혈 1~5층", BlurbKo = "5층 왕릉의 옥관 수릉장. 갇힌 시간 여행자 열두시가 \"이 구멍은 미래 지도에 없다\"고 말한다.",
                After = "a1_blackflag", Exp = 200, Gold = 1500, Feat = 20, AwardKo = "",
                Steps = new[]
                {
                    new Step { T = "talk", Scene = "tomb1", N = 0, Key = "", By = "" },
                    new Step { T = "floor", Scene = "", N = 5, Key = "", By = "" },
                    new Step { T = "landmark", Scene = "", N = 0, Key = "tomb", By = "" },
                    new Step { T = "rescue", Scene = "", N = 1, Key = "", By = "" },
                    new Step { T = "talk", Scene = "tomb2", N = 0, Key = "", By = "" },
                } },
            new Chapter { Id = "a2_factory", No = 4, Act = 2, TitleKo = "멈춘 공장의 심장", StageKo = "잿빛 폐도시", BlurbKo = "단추의 부탁 — 멈춘 공장 굴뚝에서 폭주룡이 난다. 공장 심장은 굴혈로 이어진 관이다.",
                After = "a1_tomb", Exp = 300, Gold = 2500, Feat = 0, AwardKo = "",
                Steps = new[]
                {
                    new Step { T = "region", Scene = "", N = 0, Key = "neon", By = "" },
                    new Step { T = "talk", Scene = "fac1", N = 0, Key = "", By = "" },
                    new Step { T = "chain", Scene = "", N = 0, Key = "neon", By = "" },
                    new Step { T = "talk", Scene = "fac2", N = 0, Key = "", By = "" },
                } },
            new Chapter { Id = "a2_tideflat", No = 5, Act = 2, TitleKo = "물 빠진 바다의 노래", StageKo = "소금 개펄", BlurbKo = "염전 늙은 뱃사공이 \"바다가 이름을 부르며 물러갔다\"고 한다. 녹슨 관측탑 아래 촉수왕.",
                After = "a2_factory", Exp = 400, Gold = 3500, Feat = 0, AwardKo = "",
                Steps = new[]
                {
                    new Step { T = "region", Scene = "", N = 0, Key = "saltmarsh", By = "" },
                    new Step { T = "talk", Scene = "tide1", N = 0, Key = "", By = "" },
                    new Step { T = "chain", Scene = "", N = 0, Key = "saltmarsh", By = "" },
                    new Step { T = "talk", Scene = "tide2", N = 0, Key = "", By = "" },
                } },
            new Chapter { Id = "a2_watchtower", No = 6, Act = 2, TitleKo = "무너진 망루성", StageKo = "굴혈 6~10층", BlurbKo = "10층 성주의 망령은 제 이름을 잃어 성을 떠나지 못한다. 묵향의 기록에서 이름을 찾아 줄지 고른다.",
                After = "a2_tideflat", Exp = 600, Gold = 5000, Feat = 30, AwardKo = "",
                Steps = new[]
                {
                    new Step { T = "floor", Scene = "", N = 10, Key = "", By = "" },
                    new Step { T = "talk", Scene = "fort1", N = 0, Key = "", By = "" },
                    new Step { T = "landmark", Scene = "", N = 0, Key = "fort", By = "" },
                    new Step { T = "talk", Scene = "fort2", N = 0, Key = "", By = "fort" },
                } },
            new Chapter { Id = "a3_riftgate", No = 7, Act = 3, TitleKo = "갈라진 땅의 문지기", StageKo = "지옥 균열", BlurbKo = "퇴마사 소연이 쫓던 문지기 겁옥 — 균열은 무명혈의 곁가지.",
                After = "a2_watchtower", Exp = 900, Gold = 8000, Feat = 0, AwardKo = "",
                Steps = new[]
                {
                    new Step { T = "region", Scene = "", N = 0, Key = "hellgate", By = "" },
                    new Step { T = "talk", Scene = "rg1", N = 0, Key = "", By = "" },
                    new Step { T = "chain", Scene = "", N = 0, Key = "hellgate", By = "" },
                    new Step { T = "talk", Scene = "rg2", N = 0, Key = "", By = "" },
                } },
            new Chapter { Id = "a3_sunfurnace", No = 8, Act = 3, TitleKo = "과열된 태양로", StageKo = "태양 신도시", BlurbKo = "개척지 정비공 — 태양로가 균열의 열을 먹고 폭주한다.",
                After = "a3_riftgate", Exp = 1100, Gold = 9000, Feat = 0, AwardKo = "",
                Steps = new[]
                {
                    new Step { T = "region", Scene = "", N = 0, Key = "solar", By = "" },
                    new Step { T = "talk", Scene = "sf1", N = 0, Key = "", By = "" },
                    new Step { T = "chain", Scene = "", N = 0, Key = "solar", By = "" },
                    new Step { T = "talk", Scene = "sf2", N = 0, Key = "", By = "" },
                } },
            new Chapter { Id = "a3_blackwind", No = 9, Act = 3, TitleKo = "흑풍 산채", StageKo = "굴혈 11~15층", BlurbKo = "15층 흑풍 채주 — 도적 떼가 이름을 팔아 힘을 샀다.",
                After = "a3_sunfurnace", Exp = 1300, Gold = 10000, Feat = 40, AwardKo = "",
                Steps = new[]
                {
                    new Step { T = "talk", Scene = "bw1", N = 0, Key = "", By = "" },
                    new Step { T = "floor", Scene = "", N = 15, Key = "", By = "" },
                    new Step { T = "landmark", Scene = "", N = 0, Key = "bandit", By = "" },
                    new Step { T = "talk", Scene = "bw2", N = 0, Key = "", By = "" },
                } },
            new Chapter { Id = "a3_palace", No = 10, Act = 3, TitleKo = "가라앉은 용궁", StageKo = "굴혈 16~20층", BlurbKo = "20층 비늘 수문장을 치자 바닥에서 처음으로 목소리가 들린다 — \"이름을 다오\".",
                After = "a3_blackwind", Exp = 1600, Gold = 12000, Feat = 50, AwardKo = "",
                Steps = new[]
                {
                    new Step { T = "talk", Scene = "pal1", N = 0, Key = "", By = "" },
                    new Step { T = "floor", Scene = "", N = 20, Key = "", By = "" },
                    new Step { T = "landmark", Scene = "", N = 0, Key = "palace", By = "" },
                    new Step { T = "talk", Scene = "pal2", N = 0, Key = "", By = "" },
                } },
            new Chapter { Id = "a4_caravan", No = 11, Act = 4, TitleKo = "끊긴 대상 길", StageKo = "서역 모랫길", BlurbKo = "대상 우두머리 — 모래가 묻힌 유적째 대상 길을 삼켰다.",
                After = "a3_palace", Exp = 2000, Gold = 15000, Feat = 0, AwardKo = "",
                Steps = new[]
                {
                    new Step { T = "region", Scene = "", N = 0, Key = "silkroad", By = "" },
                    new Step { T = "talk", Scene = "car1", N = 0, Key = "", By = "" },
                    new Step { T = "chain", Scene = "", N = 0, Key = "silkroad", By = "" },
                    new Step { T = "talk", Scene = "car2", N = 0, Key = "", By = "" },
                } },
            new Chapter { Id = "a4_snowfort", No = 12, Act = 4, TitleKo = "산성의 거한", StageKo = "북방 설산", BlurbKo = "케이블카 기사 — 멈춘 케이블카를 다시 돌려 산성으로.",
                After = "a4_caravan", Exp = 2200, Gold = 17000, Feat = 0, AwardKo = "",
                Steps = new[]
                {
                    new Step { T = "region", Scene = "", N = 0, Key = "snowfort", By = "" },
                    new Step { T = "talk", Scene = "snow1", N = 0, Key = "", By = "" },
                    new Step { T = "chain", Scene = "", N = 0, Key = "snowfort", By = "" },
                    new Step { T = "talk", Scene = "snow2", N = 0, Key = "", By = "" },
                } },
            new Chapter { Id = "a4_scrap", No = 13, Act = 4, TitleKo = "스스로 일어선 고철", StageKo = "기계 황무지", BlurbKo = "수리 로봇 끽 — 고철 거신은 이름을 먹고 일어선 기계다. 끽은 제 이름을 지켜 멀쩡하다.",
                After = "a4_snowfort", Exp = 2400, Gold = 20000, Feat = 0, AwardKo = "",
                Steps = new[]
                {
                    new Step { T = "region", Scene = "", N = 0, Key = "scrap", By = "" },
                    new Step { T = "talk", Scene = "scr1", N = 0, Key = "", By = "" },
                    new Step { T = "chain", Scene = "", N = 0, Key = "scrap", By = "" },
                    new Step { T = "talk", Scene = "scr2", N = 0, Key = "", By = "" },
                } },
            new Chapter { Id = "a4_hellgate", No = 14, Act = 4, TitleKo = "업화 대문", StageKo = "굴혈 21~25층", BlurbKo = "25층 업화 문지기 — 문 너머가 천계로 이어진다.",
                After = "a4_scrap", Exp = 2800, Gold = 25000, Feat = 60, AwardKo = "",
                Steps = new[]
                {
                    new Step { T = "talk", Scene = "hg1", N = 0, Key = "", By = "" },
                    new Step { T = "floor", Scene = "", N = 25, Key = "", By = "" },
                    new Step { T = "landmark", Scene = "", N = 0, Key = "hellgate", By = "" },
                    new Step { T = "talk", Scene = "hg2", N = 0, Key = "", By = "" },
                } },
            new Chapter { Id = "a5_heaven", No = 15, Act = 5, TitleKo = "칼을 든 수호장 · 구름 위 금궐", StageKo = "천계 사당 · 굴혈 26~30층", BlurbKo = "사당지기 도사의 사슬을 끝내고 30층 금궐 — 구름 천장은 무명왕에게 이름을 판 첫 장수.",
                After = "a4_hellgate", Exp = 4000, Gold = 40000, Feat = 100, AwardKo = "",
                Steps = new[]
                {
                    new Step { T = "talk", Scene = "hv1", N = 0, Key = "", By = "" },
                    new Step { T = "chain", Scene = "", N = 0, Key = "heaven", By = "" },
                    new Step { T = "floor", Scene = "", N = 30, Key = "", By = "" },
                    new Step { T = "landmark", Scene = "", N = 0, Key = "cloud", By = "" },
                    new Step { T = "talk", Scene = "hv2", N = 0, Key = "", By = "" },
                } },
            new Chapter { Id = "a5_nameless", No = 16, Act = 5, TitleKo = "이름 없는 곳", StageKo = "굴혈 끝", BlurbKo = "무명왕 — 먹은 이름들이 세 시대 모습으로 번갈아 나온다. 지워졌던 비석 이름이 되돌아온다. (31층 전투는 아직 없다 — 이야기로 맺는다)",
                After = "a5_heaven", Exp = 8000, Gold = 80000, Feat = 200, AwardKo = "이름을 찾은 자",
                Steps = new[]
                {
                    new Step { T = "talk", Scene = "nl1", N = 0, Key = "", By = "" },
                    new Step { T = "talk", Scene = "nl2", N = 0, Key = "", By = "fort" },
                } },
            new Chapter { Id = "a6_orphan", No = 17, Act = 6, TitleKo = "주인 없는 이름", StageKo = "굴혈 32층", BlurbKo = "이름은 모두 돌아왔는데 비석 한 구석에 어느 기록에도 없는 글자가 남았다. 그 이름이 새 틈을 연다.",
                After = "a5_nameless", Exp = 10000, Gold = 100000, Feat = 150, AwardKo = "",
                Steps = new[]
                {
                    new Step { T = "talk", Scene = "or1", N = 0, Key = "", By = "" },
                    new Step { T = "floor", Scene = "", N = 32, Key = "", By = "" },
                    new Step { T = "talk", Scene = "or2", N = 0, Key = "", By = "" },
                } },
            new Chapter { Id = "a6_ford", No = 18, Act = 6, TitleKo = "갈대나루의 새 틈", StageKo = "굴혈 34층", BlurbKo = "밤마다 배 없는 노 소리가 나는 갈대나루. 이름 없는 노꾼은 이름을 잃은 것이 아니라 지키려고 지운 사람이다.",
                After = "a6_orphan", Exp = 12000, Gold = 120000, Feat = 150, AwardKo = "",
                Steps = new[]
                {
                    new Step { T = "talk", Scene = "fd1", N = 0, Key = "", By = "" },
                    new Step { T = "floor", Scene = "", N = 34, Key = "", By = "" },
                    new Step { T = "talk", Scene = "fd2", N = 0, Key = "", By = "" },
                } },
            new Chapter { Id = "a6_beyond", No = 19, Act = 6, TitleKo = "비석 너머", StageKo = "굴혈 36층", BlurbKo = "삼켜지지 않은 이름이 문 너머에서 기다린다. 싸우러 가는 길이 아니라 이름을 돌려주러 가는 길.",
                After = "a6_ford", Exp = 16000, Gold = 160000, Feat = 250, AwardKo = "비석 너머의 이름",
                Steps = new[]
                {
                    new Step { T = "talk", Scene = "bd1", N = 0, Key = "", By = "" },
                    new Step { T = "floor", Scene = "", N = 36, Key = "", By = "" },
                    new Step { T = "talk", Scene = "bd2", N = 0, Key = "", By = "" },
                } },
        };

        public static Cast CastOf(string id)
        {
            foreach (var c in Casts) if (c.Id == id) return c;
            return null;
        }

        public static Scene SceneOf(string id)
        {
            foreach (var s in Scenes) if (s.Id == id) return s;
            return null;
        }

        public static Chapter ChapterOf(string id)
        {
            foreach (var c in Chapters) if (c.Id == id) return c;
            return null;
        }

        /// <summary>그 고르기 id 가 든 고르기(없으면 null).</summary>
        public static Choice ChoiceOf(string id)
        {
            foreach (var s in Scenes) if (s.Choice != null && s.Choice.Id == id) return s.Choice;
            return null;
        }
    }
}
