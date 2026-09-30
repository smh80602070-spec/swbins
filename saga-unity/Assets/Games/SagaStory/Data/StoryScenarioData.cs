namespace Saga.Story.Data
{
    /// <summary>
    /// PLAN.md 109-16 사가스토리 시나리오 「이름 없는 떠돌이」 표(웹 사가스토리 `js/data-scenario.js` · 정본 `scenario/saga-story.md`) — 이 트랙엔 사냥터가 들판 하나와 비경뿐이라
    /// 트랙 메모대로 **들판(p1_field)·첫 전직(p1_job)·비경(p3_labyrinth) 셋**만 넣는다(표 원본은 웹 파일에서 스크립트로 옮김). 웹 `stage` 단계는 뺐고(이미 들판),
    /// 돈·두루마리 보상은 이 트랙에 없어 뺐다. 나머지 장은 사냥터가 생긴 뒤 같은 생성기에 장 id 를 더한다.
    /// 생성물 — 고치려면 웹 표를 고치고 다시 옮긴다. 글은 `story_*.json` 의 `sscen.*` 키.
    /// </summary>
    public static class StoryScenarioData
    {
        public sealed class Cast { public string Id, NameKo, Emoji; }

        public readonly struct Line
        {
            /// <summary>말하는 이 — `me`(주인공) 또는 <see cref="Casts"/> 의 id.</summary>
            public readonly string Who, Ko;
            public Line(string who, string ko) { Who = who; Ko = ko; }
        }

        public sealed class ChoiceOption { public string Key, LabelKo, TitleKo; }

        /// <summary>장면 끝 고르기(웹 `choice`) — 고른 답은 <see cref="StoryScenario.ChoiceOf"/> 에 남고, 답에 칭호가 있으면 칭호가 된다.</summary>
        public sealed class Choice { public string Id, PromptKo; public ChoiceOption[] Options; }

        public sealed class Scene { public string Id, ChapterId; public Line[] Lines; public Choice Choice; }

        /// <summary>talk(`By` 가 있으면 그 고르기의 답에 따라 `장면_답`) · mission(q_field 첫 사냥 · q_boss1 두목의 목) · job(n차 전직) · gate(관문 대장을 한 번이라도 이겼다) · kills(이 단계가 시작된 뒤 잡졸 N) · boss(이 단계가 시작된 뒤 두목 N) · rift(비경을 이 단계가 시작된 뒤 한 번 끝까지).</summary>
        public sealed class Step { public string T, Scene, Key, By; public int N; }

        public sealed class Chapter
        {
            public string Id, TitleKo, StageKo, BlurbKo, After;
            public int No, Need, Exp, Shards, LegacyLevel, LegacyTier;
            /// <summary>칭호 = "이름 없는 " + 방금 고른 직업 이름.</summary>
            public bool JobTitle;
            public Step[] Steps;
        }

        public static readonly Cast[] Casts =
        {
            new Cast { Id = "sori", NameKo = "척후병 소리", Emoji = "🐎" },
            new Cast { Id = "mentor", NameKo = "스승", Emoji = "🥋" },
            new Cast { Id = "ieum", NameKo = "탐사 대원 이음", Emoji = "🧭" },
            new Cast { Id = "hankeot", NameKo = "여행자 한컷", Emoji = "📷" },
            new Cast { Id = "wanderer", NameKo = "나그네", Emoji = "🎒" },
            new Cast { Id = "guard", NameKo = "경비병", Emoji = "🛡️" },
            new Cast { Id = "townsman", NameKo = "남정성 사람", Emoji = "🏮" },
            new Cast { Id = "ashen", NameKo = "잿빛 사자", Emoji = "🌫️" },
            new Cast { Id = "gwijang", NameKo = "암굴 귀장", Emoji = "👹" },
            new Cast { Id = "yakson", NameKo = "의원 약손", Emoji = "⚕️" },
            new Cast { Id = "lamp", NameKo = "길잡이 등불이", Emoji = "🏮" },
        };

        public static readonly Scene[] Scenes =
        {
            new Scene { Id = "field1", ChapterId = "p1_field",
                Lines = new[] {
                    new Line("sori", "황건 두목의 진에 요즘 못 보던 병기가 들어갔소. 잿빛 떼쥐가 뛰고, 하늘엔 작은 눈알 같은 것이 뜨오."),
                    new Line("me", "눈알 같은 것이라니, 정찰 짐승입니까?"),
                    new Line("sori", "짐승이 아니라 날아다니는 쇠붙이요. 들판을 비우지 않고는 두목 근처에도 못 가오."),
                    new Line("me", "먼저 들판을 비우고, 그다음에 두목의 목을 보겠습니다.") } },
            new Scene { Id = "field2", ChapterId = "p1_field",
                Lines = new[] {
                    new Line("sori", "두목이 쓰러졌소! 진 한복판에서 푸른 빛 조각이 나왔는데, 누가 남긴 건지 모르겠소."),
                    new Line("me", "누가 대 주지 않고서야 도적이 저런 병기를 가질 수 없지요."),
                    new Line("sori", "이제 허도의 스승을 찾아가 보시오. 열 번은 넘게 해가 진 자라면 배울 자격이 있소.") } },
            new Scene { Id = "job1", ChapterId = "p1_job",
                Lines = new[] {
                    new Line("mentor", "이름 없는 자가 제일 빨리 배운다. 이름에 매여 있지 않으니까."),
                    new Line("mentor", "저 표적지를 보아라. 누가 세웠는지 모르나, 이 땅의 것이 아닌 나무로 만들었다. 내 무기도 그렇다. 어느 시대 것인지 나도 모른다."),
                    new Line("mentor", "🥋 무예창을 열어 네 길을 골라라. 무사·궁수·협객·방사 — 고른 길이 네 첫 이름이 된다.") } },
            new Scene { Id = "job2", ChapterId = "p1_job",
                Lines = new[] {
                    new Line("mentor", "골랐구나. 이제 너는 이름 없는 채로 한 갈래를 얻었다."),
                    new Line("mentor", "동쪽 강릉진 부두에 쇠로 된 배가 걸려 있다더라. 그 배의 사진을 찍는 여행자가 있다지 — 만나 보아라."),
                    new Line("me", "가겠습니다. 이름은 가는 길에서 찾지요.") } },
            new Scene { Id = "port1", ChapterId = "p2_port",
                Lines = new[] {
                    new Line("hankeot", "아, 마침 잘 오셨어요! 이 사진 좀 보세요. 부두에 쇠 화물선이 걸려 있는데, 배 뒤로 바다가 안 찍혀요. 텅 빈 하늘만요."),
                    new Line("me", "옛 나루에 쇠로 된 배라니… 실물은 더 기이하겠군요."),
                    new Line("hankeot", "조종실엔 푸른 빛 판이 깜박여요. 그 배를 차지한 게 왜구 선장인데, 부두 문지기 노릇을 하죠."),
                    new Line("me", "선장부터 만나 보겠습니다. 문이 그 사람 손에 있다면요.") } },
            new Scene { Id = "port2", ChapterId = "p2_port",
                Lines = new[] {
                    new Line("hankeot", "선장이 쓰러졌어요! 쇠배 조종실 판에서 지도 같은 게 나왔는데요."),
                    new Line("me", "이 나루도, 이 바다도 아닌 물길이 그려져 있습니다. 없는 바다의 지도군요."),
                    new Line("hankeot", "지도 끝이 오림 숲 쪽을 가리켜요. 거기서 발소리가 자기 것만 들리지 않는다는 말이 돌고요.") } },
            new Scene { Id = "cave1", ChapterId = "p2_cave",
                Lines = new[] {
                    new Line("ieum", "살았다… 도독 진 깊은 곳에 묶여 있었습니다. 저는 탐사 대원 이음, 먼 시대에서 문을 쫓아 왔습니다."),
                    new Line("ieum", "이 땅의 전쟁에 다른 시대 병기가 섞이는 건 새어 든 것입니다. 동쪽 끝에 난세의 문이 있어요."),
                    new Line("me", "문이라. 그렇다면 이름 없는 제 손에도 할 일이 있겠군요."),
                    new Line("ieum", "마을마다 서 있겠습니다. 소식이 닿으면 어디서든 말을 거세요. 우선 둘째 스승부터 찾으세요.") } },
            new Scene { Id = "cave2", ChapterId = "p2_cave",
                Lines = new[] {
                    new Line("mentor", "이름 없는 채로 둘째 자리에 올랐구나. 이름이 없으니 남의 시대 기술도 그대로 배우는군."),
                    new Line("mentor", "더 큰 불길이 기산채 쪽에서 오른다 한다. 다음 길은 스스로 정하되, 잿빛 자를 조심하라."),
                    new Line("me", "명심하겠습니다. 이름을 얻을 때까지 걷겠습니다.") } },
            new Scene { Id = "lab1", ChapterId = "p3_labyrinth",
                Lines = new[] {
                    new Line("ieum", "제 탐사 등으로 비경을 엽니다. 이 층들은 문이 남긴 기억의 껍질이에요. 돌 발판에 박힌 표지판이 보이면 다른 시대의 흔적입니다."),
                    new Line("ieum", "5층 수호장을 쓰러뜨리면 잃어버린 조각이 나올지도 몰라요. 도중에 나가도 얻은 조각은 남습니다."),
                    new Line("me", "제 이름이 없는 까닭이 거기 있다면 가야지요.") } },
            new Scene { Id = "lab2", ChapterId = "p3_labyrinth",
                Lines = new[] {
                    new Line("me", "…기억났습니다. 저는 문 너머에서 왔어요. 문이 열릴 때 떨어져 이 땅에 나왔습니다."),
                    new Line("ieum", "그래서 이름이 없었던 거군요. 문 너머에 두고 온 이름이 있을 겁니다."),
                    new Line("me", "그 이름을 찾으러 문까지 가겠습니다. 잿빛 사자보다 먼저요.") } },
            new Scene { Id = "job31", ChapterId = "p3_job",
                Lines = new[] {
                    new Line("mentor", "네 이름은 문 너머에 두고 왔구나. 내 방 벽의 이 오래된 사진을 보아라 — 이 땅에서 찍을 수 없는 색이다."),
                    new Line("mentor", "내 칼날에 비친 것이 무엇이냐. 나도 오래 전에 문을 본 적이 있다. 이제 셋째 자리를 열어 주마."),
                    new Line("mentor", "🥋 무예창에서 3차 전직을 하여라.") } },
            new Scene { Id = "job32", ChapterId = "p3_job",
                Lines = new[] {
                    new Line("mentor", "셋째 자리에 올랐다. 이제 네 손은 이름 없는 채로도 이 땅에서 가장 빠르다."),
                    new Line("mentor", "잿빛 사자가 옛 도읍 낙양으로 갔다는 소문이다. 도포를 벗게 될 것이다 — 가서 확인하여라."),
                    new Line("me", "다녀오겠습니다. 이름을 찾는 길이 그쪽에 있습니다.") } },
            new Scene { Id = "forest2", ChapterId = "p2_forest",
                Lines = new[] {
                    new Line("wanderer", "그림자의 정체가 벼락 말벌 떼였다니… 나무에 박혀 서 있던 쇠 보행기도 봤소?"),
                    new Line("me", "경비를 서듯 서 있었습니다. 지키는 것이 무엇인지는 알 수 없고요."),
                    new Line("wanderer", "남정성으로 가 보시오. 성 사람들이 무슨 소문을 알고 있소.") } },
            new Scene { Id = "nam2", ChapterId = "p2_namjeong",
                Lines = new[] {
                    new Line("townsman", "밤마다 굴 쪽에서 빛이 샌다오. 가로등 하나 없는 골목에 하나만 켜져 있고, 그 불빛이 굴 입구와 똑같은 색이오."),
                    new Line("me", "가로등과 굴 입구의 빛이 한 줄기라는 말씀이십니까?"),
                    new Line("townsman", "위군 도독이 굴혈에 진을 친 뒤로 시작된 일이오. 누가 가서 좀 봐 주시오."),
                    new Line("me", "길을 정했습니다. 굴혈로 가겠습니다.") } },
            new Scene { Id = "gisan1", ChapterId = "p3_gisan",
                Lines = new[] {
                    new Line("guard", "산채 두령이 요즘 빛이 나는 병기를 쥐고 있소. 창고엔 쇠 대롱이 쌓였는데, 그게 불을 뿜으면 활이 무슨 소용이오."),
                    new Line("ashen", "…좋은 물건이오. 값만 치르면 누구 손에든 가지. 시대가 무슨 상관이겠소."),
                    new Line("me", "잠깐! 방금 그 도포 차림이 발소리도 없이 사라졌습니다."),
                    new Line("guard", "잿빛 사자라고들 하오. 두령이 누구에게 병기를 받는지 이제 알겠소.") } },
            new Scene { Id = "gisan2", ChapterId = "p3_gisan",
                Lines = new[] {
                    new Line("guard", "군자금이 모였소! 이걸로 산채 아래 길을 열 병량을 사겠소."),
                    new Line("me", "잿빛 사자가 그 병기를 어디서 가져오는지 알아야 합니다. 이대로면 전쟁이 끝나지 않아요."),
                    new Line("guard", "호로곡 쪽에서 불길이 올랐소. 그쪽이 더 급하오.") } },
            new Scene { Id = "gorge2", ChapterId = "p3_gorge",
                Lines = new[] {
                    new Line("yakson", "부상병을 다 옮겼소. 이상한 일이 있었소 — 불길 속에서 강철 거인이 걸어 나왔는데 불이 붙지 않더이다."),
                    new Line("me", "진압 특공대 같은 것들도 보았습니다. 이 땅의 전쟁이 아닙니다."),
                    new Line("yakson", "적국 대장군의 갑주에도 푸른 빛 판이 박혀 있었소. 이음이라는 대원을 찾아가시오. 문 이야기를 아는 이요.") } },
            new Scene { Id = "luoyang2", ChapterId = "p4_luoyang",
                Lines = new[] {
                    new Line("ashen", "…도포가 걸리적거리는군. 어차피 이 땅에서 오래 못 입을 옷이었다."),
                    new Line("me", "당신이 폐도 흉장이었습니까! 무너진 궁궐 한복판에서 전철 소리가 났던 까닭이군요."),
                    new Line("ashen", "병기를 대 준 것은 나요. 문이 열려 있는 한 어느 시대 물건이든 흘러오지. 잿더미 위 기계 갑주는 덤이었소."),
                    new Line("me", "그럼 문 앞에서 다시 만납시다. 문을 닫으려는 사람이 여기 있으니까요.") } },
            new Scene { Id = "depth2", ChapterId = "p4_depth",
                Lines = new[] {
                    new Line("ieum", "여기부터는 빛이 안 닿습니다. 제 탐사 등을 앞세울게요."),
                    new Line("hankeot", "조명은 제가 맡을게요! 암굴 석벽에 이 땅 것이 아닌 색이 번져 있어요. 사진 한 장만!"),
                    new Line("me", "석벽이 점점 따뜻해집니다. 문이 가까운가 봅니다."),
                    new Line("ieum", "문 앞엔 귀장이 서 있을 거예요. 전쟁이 끝나지 않게 문을 연 자입니다.") } },
            new Scene { Id = "gate1", ChapterId = "p4_gate",
                Lines = new[] {
                    new Line("gwijang", "전쟁이 끝나면 문도 닫히지… 그러니 끝나지 않게 했다. 옛 갑옷 속에 든 것은 사람이 아니다."),
                    new Line("me", "그 때문에 수많은 시대가 이 땅에 새어 들었습니다. 이제 끝입니다."),
                    new Line("gwijang", "문이 흔들린다…! 문 둘레의 전선이 무너진다. 이제 문은 네가 정해라.") } },
            new Scene { Id = "gate2", ChapterId = "p4_gate",
                Choice = new Choice { Id = "gate", PromptKo = "난세의 문을 어떻게 할 것인가", Options = new[] { new ChoiceOption { Key = "close", LabelKo = "문을 닫는다" }, new ChoiceOption { Key = "keep", LabelKo = "문을 지킨다" } } },
                Lines = new[] {
                    new Line("ieum", "문이 흔들리며 빛 소용돌이가 일어요. 닫으면 새어 드는 시대도 멎지만 저는 제 시대로 돌아가야 해요."),
                    new Line("ieum", "지키면 당신이 문지기가 됩니다. 문은 열린 채, 새어 드는 것을 막는 쪽이에요."),
                    new Line("me", "이름 없는 제가, 이 문 앞에서 정합니다.") } },
            new Scene { Id = "name1", ChapterId = "p4_name",
                Lines = new[] {
                    new Line("mentor", "이름 없이 여기까지 왔구나. 마지막 자리다. 한컷의 사진 속 너는 이 땅의 사람이 아니더구나."),
                    new Line("mentor", "이음이 돌아갈 빛이 문 앞에서 기다린다. 서둘러 마지막 전직을 마쳐라."),
                    new Line("mentor", "🥋 무예창에서 4차 전직을 하여라.") } },
            new Scene { Id = "name2", ChapterId = "p4_name",
                Choice = new Choice { Id = "name", PromptKo = "스스로 붙일 칭호", Options = new[] { new ChoiceOption { Key = "found", LabelKo = "이름을 되찾은 자", TitleKo = "이름을 되찾은 자" }, new ChoiceOption { Key = "wander", LabelKo = "문 너머의 나그네", TitleKo = "문 너머의 나그네" }, new ChoiceOption { Key = "none", LabelKo = "이름 없이 걷는 자", TitleKo = "이름 없이 걷는 자" } } },
                Lines = new[] {
                    new Line("mentor", "넷째 자리에 올랐다. 이제 이름을 붙일 때다. 남이 붙여 준 것 말고, 네가 붙이는 이름."),
                    new Line("me", "문 너머에 두고 온 이름은 잃었지만, 이 땅에서 걸어온 길이 이름이 되겠습니다.") } },
            new Scene { Id = "name3_close", ChapterId = "p4_name",
                Lines = new[] {
                    new Line("ieum", "문이 닫혔으니 저는 제 시대로 돌아갑니다. 이 시대에 새어 든 것들은 남겠지만, 더는 늘지 않을 거예요."),
                    new Line("hankeot", "마지막 사진이에요. 이름 없던 분이 웃고 있네요."),
                    new Line("me", "이름은 얻었으니 남은 길은 제 발로 걷겠습니다. 고맙습니다, 두 분.") } },
            new Scene { Id = "name3_keep", ChapterId = "p4_name",
                Lines = new[] {
                    new Line("ieum", "문지기가 되신다니… 저는 이 시대 소식을 문 너머에 전하겠습니다. 문은 열린 채, 당신이 지켜 주세요."),
                    new Line("hankeot", "문 너머엔 다른 하늘이 있대요. 다음에 오면 사진 한 장만 부탁해요!"),
                    new Line("me", "이름은 얻었습니다. 문 너머 층이 열리는 날까지 이 자리를 지키겠습니다.") } },
            new Scene { Id = "beyond1", ChapterId = "p5_past",
                Lines = new[] {
                    new Line("lamp", "문 저편 땅이 온통 깃발 무덤이오. 어느 시대의 전장인지 표지 하나 없소."),
                    new Line("hankeot", "사진기 초점이 자꾸 나가요. 여긴 시간이 겹쳐 찍혀요. 창 든 그림자와 총 든 그림자가 한자리에…"),
                    new Line("me", "문을 지키는 것은 문 이쪽만이 아니었군요. 넘어온 것이 있으면 넘어간 자리도 있겠지요."),
                    new Line("lamp", "다음은 무너진 도시 쪽이오. 전철 소리 같은 것이 들리오.") } },
            new Scene { Id = "beyond2", ChapterId = "p5_now",
                Lines = new[] {
                    new Line("hankeot", "여기가… 도시였어요? 간판은 남았는데 글자가 다 거꾸로예요."),
                    new Line("lamp", "신호등이 켜질 때마다 옛 전장에서 넘어온 그림자가 길을 건너오. 문이 이쪽과 저쪽을 자꾸 섞어 놓소."),
                    new Line("me", "문이 열려 있는 한 섞임은 멈추지 않겠군요."),
                    new Line("hankeot", "마지막 신호는 하늘에서 와요. 궤도 기지가 아직 깨어 있대요.") } },
            new Scene { Id = "beyond3_close", ChapterId = "p5_future",
                Lines = new[] {
                    new Line("ieum", "(기지 통신) 제 시대에서도 이 기지 불빛이 보여요! 문이 닫혔는데도 신호가 남아 있었어요."),
                    new Line("me", "이곳에서 문 너머의 전부가 보입니다 — 옛 전장, 무너진 도시, 그리고 저 별."),
                    new Line("hankeot", "찍었어요. 세 시대가 한 장에 담겼어요. 문 이쪽 사람들에게 보여 줄 거예요."),
                    new Line("me", "닫은 문 저편이라도 잊지는 않겠습니다. 다음 길로 가지요.") } },
            new Scene { Id = "beyond3_keep", ChapterId = "p5_future",
                Lines = new[] {
                    new Line("ieum", "기지 등불이 켜졌어요! 제가 나고 자란 곳의 등불과 같은 색이에요. 문지기님, 여기까지 오셨군요."),
                    new Line("me", "이곳에서 문 너머의 전부가 보입니다 — 옛 전장, 무너진 도시, 그리고 저 별."),
                    new Line("hankeot", "찍었어요. 세 시대가 한 장에 담겼어요. 문 이쪽 사람들에게 보여 줄 거예요."),
                    new Line("me", "문을 지키려면 저쪽을 알아야 하지요. 이제 알았습니다. 다음 길로 가지요.") } },
        };

        public static readonly Chapter[] Chapters =
        {
            new Chapter { Id = "p1_field", No = 1, TitleKo = "허창 들판의 두목", StageKo = "허창 들판", BlurbKo = "척후병과 들판을 정찰한다. 황건 두목의 진에 다른 시대의 병기가 섞였다.",
                Need = 1, After = null, Exp = 400, Shards = 0, JobTitle = false,
                LegacyLevel = 10, LegacyTier = 1,
                Steps = new[]
                {
                    new Step { T = "talk", Scene = "field1" },
                    new Step { T = "mission", Key = "q_field" },
                    new Step { T = "mission", Key = "q_boss1" },
                    new Step { T = "talk", Scene = "field2" },
                } },
            new Chapter { Id = "p1_job", No = 2, TitleKo = "첫 스승", StageKo = "허도", BlurbKo = "허도의 스승에게 첫 전직을 배운다. \"이름 없는 자가 제일 빨리 배운다.\"",
                Need = 10, After = "p1_field", Exp = 600, Shards = 0, JobTitle = true,
                LegacyLevel = 10, LegacyTier = 1,
                Steps = new[]
                {
                    new Step { T = "talk", Scene = "job1" },
                    new Step { T = "job", N = 1 },
                    new Step { T = "talk", Scene = "job2" },
                } },
            new Chapter { Id = "p2_port", No = 3, TitleKo = "강릉진 부두", StageKo = "강릉진", BlurbKo = "부두에 쇠 화물선이 걸려 있다. 여행자 한컷의 사진 속 배는 \"없는 바다\"에 떠 있다.",
                Need = 10, After = "p1_job", Exp = 1200, Shards = 0, JobTitle = false,
                LegacyLevel = 25, LegacyTier = 2,
                Steps = new[]
                {
                    new Step { T = "talk", Scene = "port1" },
                    new Step { T = "gate" },
                    new Step { T = "talk", Scene = "port2" },
                } },
            new Chapter { Id = "p2_forest", No = 4, TitleKo = "오림의 그늘", StageKo = "오림 숲", BlurbKo = "나그네가 \"그림자를 조심하라\" 한다. 그림자는 벼락 말벌 떼다.",
                Need = 10, After = "p2_port", Exp = 1500, Shards = 0, JobTitle = false,
                LegacyLevel = 25, LegacyTier = 4,
                Steps = new[]
                {
                    new Step { T = "kills", N = 20 },
                    new Step { T = "talk", Scene = "forest2" },
                } },
            new Chapter { Id = "p2_namjeong", No = 5, TitleKo = "민심을 살핀다", StageKo = "남정성", BlurbKo = "성 사람들이 \"밤마다 굴에서 빛이 샌다\"고 한다.",
                Need = 12, After = "p2_forest", Exp = 2000, Shards = 0, JobTitle = false,
                LegacyLevel = 25, LegacyTier = 4,
                Steps = new[]
                {
                    new Step { T = "job", N = 1 },
                    new Step { T = "talk", Scene = "nam2" },
                } },
            new Chapter { Id = "p2_cave", No = 6, TitleKo = "한중 굴혈", StageKo = "한중 굴혈", BlurbKo = "위군 도독의 진 깊은 곳에서 탐사 대원 이음을 구한다. 둘째 스승에게 2차 전직을 배운다.",
                Need = 15, After = "p2_namjeong", Exp = 4000, Shards = 0, JobTitle = true,
                LegacyLevel = 25, LegacyTier = 2,
                Steps = new[]
                {
                    new Step { T = "talk", Scene = "cave1" },
                    new Step { T = "job", N = 2 },
                    new Step { T = "talk", Scene = "cave2" },
                } },
            new Chapter { Id = "p3_gisan", No = 7, TitleKo = "기산채의 사자", StageKo = "기산채", BlurbKo = "산채 두령에게 빛 병기를 대 주는 잿빛 사자가 나타났다 사라진다.",
                Need = 17, After = "p2_cave", Exp = 8000, Shards = 0, JobTitle = false,
                LegacyLevel = 45, LegacyTier = 4,
                Steps = new[]
                {
                    new Step { T = "talk", Scene = "gisan1" },
                    new Step { T = "talk", Scene = "gisan2" },
                } },
            new Chapter { Id = "p3_gorge", No = 8, TitleKo = "호로곡의 불길", StageKo = "호로곡", BlurbKo = "골짜기 전체가 탄다. 의원 약손과 부상병을 옮기고 적국 대장군을 친다.",
                Need = 20, After = "p3_gisan", Exp = 20000, Shards = 0, JobTitle = false,
                LegacyLevel = 45, LegacyTier = 4,
                Steps = new[]
                {
                    new Step { T = "kills", N = 30 },
                    new Step { T = "boss", N = 1 },
                    new Step { T = "talk", Scene = "gorge2" },
                } },
            new Chapter { Id = "p3_labyrinth", No = 9, TitleKo = "비경의 기억", StageKo = "비경", BlurbKo = "이음이 여는 5층 비경. 관문 수호장을 치면 잃은 기억 조각이 나온다 — 떠돌이도 문에서 떨어졌다.",
                Need = 22, After = "p3_gorge", Exp = 30000, Shards = 3, JobTitle = false,
                LegacyLevel = 45, LegacyTier = 3,
                Steps = new[]
                {
                    new Step { T = "talk", Scene = "lab1" },
                    new Step { T = "rift" },
                    new Step { T = "talk", Scene = "lab2" },
                } },
            new Chapter { Id = "p3_job", No = 10, TitleKo = "셋째 스승", StageKo = "허도", BlurbKo = "허도의 스승이 \"네 이름은 문 너머에 두고 왔구나\" 하며 3차 전직을 준다.",
                Need = 25, After = "p3_labyrinth", Exp = 40000, Shards = 0, JobTitle = true,
                LegacyLevel = 45, LegacyTier = 3,
                Steps = new[]
                {
                    new Step { T = "talk", Scene = "job31" },
                    new Step { T = "job", N = 3 },
                    new Step { T = "talk", Scene = "job32" },
                } },
            new Chapter { Id = "p4_luoyang", No = 11, TitleKo = "옛 도읍의 잿더미", StageKo = "낙양 옛터", BlurbKo = "잿빛 사자가 도포를 벗는다 — 옛 도읍을 쥔 폐도 흉장이다.",
                Need = 26, After = "p3_job", Exp = 40000, Shards = 0, JobTitle = false,
                LegacyLevel = 70, LegacyTier = 4,
                Steps = new[]
                {
                    new Step { T = "kills", N = 40 },
                    new Step { T = "boss", N = 1 },
                    new Step { T = "talk", Scene = "luoyang2" },
                } },
            new Chapter { Id = "p4_depth", No = 12, TitleKo = "검각 깊이", StageKo = "검각 암굴", BlurbKo = "빛이 닿지 않는 깊이. 이음과 한컷이 문 앞까지 길을 비춘다.",
                Need = 28, After = "p4_luoyang", Exp = 70000, Shards = 0, JobTitle = false,
                LegacyLevel = 70, LegacyTier = 4,
                Steps = new[]
                {
                    new Step { T = "kills", N = 50 },
                    new Step { T = "talk", Scene = "depth2" },
                } },
            new Chapter { Id = "p4_gate", No = 13, TitleKo = "난세의 문", StageKo = "검각 암굴 끝", BlurbKo = "암굴 귀장 — 전쟁이 끝나지 않게 문을 연 자. 쓰러뜨리면 문이 흔들린다. 닫을지 지킬지 정한다.",
                Need = 29, After = "p4_depth", Exp = 120000, Shards = 0, JobTitle = false,
                LegacyLevel = 70, LegacyTier = 4,
                Steps = new[]
                {
                    new Step { T = "boss", N = 1 },
                    new Step { T = "talk", Scene = "gate1" },
                    new Step { T = "talk", Scene = "gate2" },
                } },
            new Chapter { Id = "p4_name", No = 14, TitleKo = "이름", StageKo = "허도", BlurbKo = "넷째 스승이 마지막 전직을 준다. 떠돌이는 스스로 칭호를 고른다.",
                Need = 30, After = "p4_gate", Exp = 200000, Shards = 0, JobTitle = true,
                LegacyLevel = 70, LegacyTier = 4,
                Steps = new[]
                {
                    new Step { T = "talk", Scene = "name1" },
                    new Step { T = "job", N = 4 },
                    new Step { T = "talk", Scene = "name2" },
                    new Step { T = "talk", Scene = "name3", By = "gate" },
                } },
            new Chapter { Id = "p5_past", No = 15, TitleKo = "문 너머 옛 전장", StageKo = "문 너머 옛 전장", BlurbKo = "문 저편 첫째 땅 — 깃발 무덤 위에 창 든 그림자와 총 든 그림자가 겹쳐 선다.",
                Need = 30, After = "p4_name", Exp = 300000, Shards = 0, JobTitle = false,
                LegacyLevel = 999, LegacyTier = 4,
                Steps = new[]
                {
                    new Step { T = "kills", N = 60 },
                    new Step { T = "boss", N = 1 },
                    new Step { T = "talk", Scene = "beyond1" },
                } },
            new Chapter { Id = "p5_now", No = 16, TitleKo = "문 너머 무너진 도심", StageKo = "문 너머 무너진 도심", BlurbKo = "문 저편 둘째 땅 — 거꾸로 쓴 간판 아래 신호등이 켜질 때마다 그림자가 길을 건넌다.",
                Need = 30, After = "p5_past", Exp = 400000, Shards = 0, JobTitle = false,
                LegacyLevel = 999, LegacyTier = 4,
                Steps = new[]
                {
                    new Step { T = "kills", N = 60 },
                    new Step { T = "boss", N = 1 },
                    new Step { T = "talk", Scene = "beyond2" },
                } },
            new Chapter { Id = "p5_future", No = 17, TitleKo = "문 너머 궤도 기지", StageKo = "문 너머 궤도 기지", BlurbKo = "문 저편 마지막 땅 — 깨어 있는 궤도 기지에서 세 시대가 한 장에 담긴다.",
                Need = 30, After = "p5_now", Exp = 600000, Shards = 0, JobTitle = false,
                LegacyLevel = 999, LegacyTier = 4,
                Steps = new[]
                {
                    new Step { T = "kills", N = 60 },
                    new Step { T = "boss", N = 1 },
                    new Step { T = "talk", Scene = "beyond3", By = "gate" },
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
    }
}
