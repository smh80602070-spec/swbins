namespace Saga.Forest.Data
{
    /// <summary>
    /// PLAN.md 109-16 사가의숲 시나리오 「하늘 금 우체통」 표(웹 사가의숲 `js/data-scenario.js` · 정본 `scenario/saga-forest.md`) — 사계절 열여섯 장 + 둘째 해 열여섯 장 중 **29장**(표 원본은 웹 파일에서 스크립트로 옮김).
    /// 이 트랙에 물이 없어(방문객 「낚시 명인」의 대사 그대로) 낚시·조개 장 셋(su_sailor · y2_album · y2_record)은 뺐다. 매핑: 웹 숲 다섯 → 구역 넷(솔숲·억새 = 꽃밭 · 요정골 = 버섯숲 · 거인 고개 = 바위 지대 · 반딧불 = 어둑숲) ·
    /// 폭포·동굴·폐허 자리 → 명소(이끼 돌제단 · 거인 선돌 · 옛 돌기둥터) · 곤충 = 곤충 채집 · 광석 = 화석 채집 · 기증 = 박물관 도감(갈래당 셋이라 최대 3) · 행사 일곱 → 이 트랙 행사 셋의 **기념 놀이**
    /// (세배 · 꽃놀이 · 소원 — 그날이 아니어도 그 단계 동안 열림). 금 ÷ 50 → 과일, 공적 → 과일 그대로(경험치는 이 판에 없음). 생성물 — 고치려면 웹 표를 고치고 다시 옮긴다.
    /// </summary>
    public static class ForestScenarioData
    {
        public sealed class Cast { public string Id, NameKo, Emoji; }

        public readonly struct Line
        {
            public readonly string Who, Ko;
            public Line(string who, string ko) { Who = who; Ko = ko; }
        }

        public sealed class Option { public string Key, LabelKo; }
        public sealed class Choice { public string Id, PromptKo; public Option[] Options; }
        public sealed class Scene { public string Id, ChapterId; public Line[] Lines; public Choice Choice; }

        /// <summary>talk · place · deliver · forest(Key = 구역) · go(Key = 구역의 명소, N = 서는 횟수) · gather(Key = 갈래, N) · fest(Key = 행사 종류) · heart · donate(Key = 갈래, N) · settle.</summary>
        public sealed class Step { public string T, Scene, Key, By; public int N; }

        public sealed class Chapter
        {
            public string Id, Season, TitleKo, BlurbKo, After, AwardKo;
            public int No, Gold, Feat;
            public Step[] Steps;
        }

        public static readonly string[] Seasons = { "spring", "summer", "autumn", "winter", "spring2", "summer2", "autumn2", "winter2" };

        public static readonly Cast[] Casts =
        {
            new Cast { Id = "keeper", NameKo = "숲지기 솔바람", Emoji = "🌲" },
            new Cast { Id = "dareum", NameKo = "택배 기사 달음", Emoji = "📦" },
            new Cast { Id = "hoyeon", NameKo = "여우 화상 호연", Emoji = "🦊" },
            new Cast { Id = "k7", NameKo = "시간 여행자 K-7", Emoji = "⌛" },
            new Cast { Id = "pungnang", NameKo = "난파 선원 풍랑", Emoji = "⚓" },
            new Cast { Id = "chalna", NameKo = "사진작가 찰나", Emoji = "📷" },
            new Cast { Id = "explorer", NameKo = "탐험가", Emoji = "🧭" },
            new Cast { Id = "bandi", NameKo = "도깨비불 반디", Emoji = "🔥" },
            new Cast { Id = "dudu", NameKo = "도깨비 대장 두두", Emoji = "👹" },
            new Cast { Id = "rumi", NameKo = "불시착 탐사원 루미", Emoji = "🧑‍🚀" },
            new Cast { Id = "nabi", NameKo = "곤충 박사 나비", Emoji = "🦋" },
        };

        public static readonly Scene[] Scenes =
        {
            new Scene { Id = "move1", ChapterId = "sp_move",
                Lines = new[] {
                    new Line("keeper", "이사 온 첫 밤이 저물었구려. 짐은 다 풀었소? 이 숲은 초가 지붕 사이로 별이 잘 들어오는 곳이라오."),
                    new Line("me", "짐을 풀다 보니 저 하늘에 가느다란 금이 하나 보입니다. 별똥별이 지나간 자국인가요?"),
                    new Line("keeper", "금이라니… 이 늙은이는 처음 보오. 우선 집에 가구 하나라도 놓고 보시오. 집이 서야 마음이 놓이지.") },
                Choice = null },
            new Scene { Id = "move2", ChapterId = "sp_move",
                Lines = new[] {
                    new Line("dareum", "으아아! 여기가 어디죠? 택배 기사 달음입니다! 금이 쫙 갈라지더니 이 소포와 함께 떨어졌어요."),
                    new Line("dareum", "받는 이가 \"이 마을 새 이웃\"인데, 보낸 날짜가 먼 앞날이에요. 상자 속에서 빛 편지가 새어 나오고요."),
                    new Line("keeper", "먼 앞날에서 온 소포라니. 접수대에 알려 배달 일부터 해 보시오. 그 길에 뭔가 보일 게요.") },
                Choice = null },
            new Scene { Id = "post1", ChapterId = "sp_postbox",
                Lines = new[] {
                    new Line("keeper", "빛 편지가 가리키는 곳이 있소 — 탑성 폐허의 옛 우체통이오. 오래전 이곳을 오가던 편지가 지금도 쌓여 있다 하오."),
                    new Line("dareum", "억새 바람벌을 지나서 폐허까지 가면 된대요! 폐허 옆에는 오래된 공중전화가 서 있다던데, 우체통이 왜 전화 곁에 있을까요.") },
                Choice = null },
            new Scene { Id = "post2", ChapterId = "sp_postbox",
                Lines = new[] {
                    new Line("me", "우체통이 정말 있었습니다. 안에는 붓글씨 편지, 택배 송장, 빛나는 홀로그램 도장이 찍힌 편지까지 섞여 있어요."),
                    new Line("keeper", "여러 시대의 편지가 한 통에 쌓였구려. 이 우체통이 버려진 채 오래 되어 시대 사이 우체통이 된 모양이오."),
                    new Line("dareum", "그럼 하늘의 금은 이 우체통이 부른 길이에요? 이 편지들을 마을로 배달해 봐요!") },
                Choice = null },
            new Scene { Id = "fox1", ChapterId = "sp_fox",
                Lines = new[] {
                    new Line("hoyeon", "어이쿠, 금 사이로 넘어와 버렸군. 여우 화상 호연이오. 시대를 잃은 물건을 파는 장사꾼이지. 이 빛 부채는 앞날 것이고, 저 옛 방울은 이 땅 것이오."),
                    new Line("me", "삼짇날 꽃놀이를 연다는 소문이 있던데요, 장터를 그날 맞춰 열 수 있을까요?"),
                    new Line("hoyeon", "꽃 다섯 송이만 모아 오시오. 꽃놀이에 쓸 꽃 좌판을 내가 펼치겠소.") },
                Choice = null },
            new Scene { Id = "fox2", ChapterId = "sp_fox",
                Lines = new[] {
                    new Line("hoyeon", "꽃놀이 안내판 곁에 좌판을 폈소. 확성기가 딸린 장터라 소리가 멀리 가지. 꽃놀이를 마치면 이 마을에서 장사를 해도 되겠소?"),
                    new Line("keeper", "이 마을에는 새 이웃이 반갑소. 호연 좌판은 마을 상점 칸에 내주지.") },
                Choice = null },
            new Scene { Id = "fox3", ChapterId = "sp_fox",
                Lines = new[] {
                    new Line("hoyeon", "꽃놀이가 끝났구려. 빛 부채가 한 자루 남았소, 선물로 받아 두시오."),
                    new Line("me", "한 주민과 마음이 통했습니다. 이 마을이 좋아지고 있어요.") },
                Choice = null },
            new Scene { Id = "mus1", ChapterId = "sp_museum",
                Lines = new[] {
                    new Line("k7", "…착륙 성공. 시간 여행자 K-7, 기록원입니다. 저는 앞날의 기록을 들고 왔어요. 이 숲의 기록 칸은 \"사라진 숲\"입니다."),
                    new Line("me", "사라진 숲이라니요? 이 마을이 없어진다는 뜻입니까?"),
                    new Line("k7", "잊힌 곳은 앞날에서 지워집니다. 사고에 화석을 채우면 그 줄이 흐려지는 걸 확인했어요. 화석 세 점만 넣어 보시겠습니까?") },
                Choice = null },
            new Scene { Id = "mus2", ChapterId = "sp_museum",
                Lines = new[] {
                    new Line("k7", "기록판의 \"사라진 숲\"이 한 줄 흐려졌습니다! 이 마을이 기억되기 시작했다는 뜻이에요. 그런데 부탁이 하나 있습니다."),
                    new Line("k7", "앞날 기록에 이 마을 이름을 적어 두고 싶습니다. 알려 주시겠어요?"),
                    new Line("me", "마을 이름을 알려 주는 건 이 마을의 미래를 맡기는 일이지요. 정하겠습니다.") },
                Choice = new Choice { Id = "name", PromptKo = "K-7 에게 마을 이름을 알려 줄까", Options = new[] { new Option { Key = "tell", LabelKo = "알려 준다" }, new Option { Key = "secret", LabelKo = "비밀로 한다" } } } },
            new Scene { Id = "photo1", ChapterId = "su_photo",
                Lines = new[] {
                    new Line("chalna", "안녕하세요! 사진작가 찰나예요. 앞날 기록에서 이 숲은 \"사라진 숲\"이라고 하더라고요. 사라지기 전에 찍어 두려고요."),
                    new Line("chalna", "숲 여덟을 다 돌 순 없으니 네 곳만요 — 푸른 솔숲, 버섯 요정골, 거인 바위 고개, 마지막으로 반딧불 참나무숲의 밤 사진이요."),
                    new Line("me", "거인 바위 고개의 선돌은 아주 오래된 것이라 들었습니다. 같이 가 봅시다.") },
                Choice = null },
            new Scene { Id = "photo2", ChapterId = "su_photo",
                Lines = new[] {
                    new Line("chalna", "반딧불 사이에서 작은 드론이 떠다니는 게 찍혔어요! 다른 시대 것이 이 숲을 기록하고 있나 봐요."),
                    new Line("me", "찰나 씨의 사진기와 드론이 같은 곳을 찍고 있었군요. 이 숲이 기억되고 있다는 뜻일지도요."),
                    new Line("chalna", "사진 액자를 넷 만들어 드릴게요. 마을 벽에 걸어 두면 숲이 사라지지 않을 거예요.") },
                Choice = null },
            new Scene { Id = "fall1", ChapterId = "su_waterfall",
                Lines = new[] {
                    new Line("explorer", "폭포 너머엔 뭐가 있는지 아무도 몰라. 이 폭포 뒤엔 굴이 있고 굴 벽에는 옛 글씨가, 바닥에는 미래의 발자국이 있다는 소문이 있지."),
                    new Line("me", "손전등은 제가 준비하겠습니다. 폭포 곁부터 가 보지요.") },
                Choice = null },
            new Scene { Id = "fall2", ChapterId = "su_waterfall",
                Lines = new[] {
                    new Line("explorer", "굴 벽에 옛 글씨가 가득이더군. 발자국 옆에는 빛 표식까지. 여러 시대 사람이 같은 굴을 지나갔다는 뜻이야."),
                    new Line("me", "편지 다발도 벽 틈에 꽂혀 있었습니다. 옛 우체통과 이어진 길일지도 모르겠어요."),
                    new Line("explorer", "도감에 \"폭포 뒤 굴\"을 적어 두자고. 또 새 수수께끼를 찾아 떠나야겠군.") },
                Choice = null },
            new Scene { Id = "star1", ChapterId = "su_star",
                Lines = new[] {
                    new Line("bandi", "칠석이라고 별에 소원 빌러 몰려왔어! 나는 도깨비불 반디야. 밤길 안내는 내가 할게."),
                    new Line("dudu", "도깨비 대장 두두다! 오작교 등도 달고 주운 손전등도 켜 놓았지. 꼬마들아 줄 서라!"),
                    new Line("me", "이 밤에 별에 소원을 빌고 나면 그 소원이 금으로 올라간다지요. 저도 빌어 보겠습니다.") },
                Choice = null },
            new Scene { Id = "star2", ChapterId = "su_star",
                Lines = new[] {
                    new Line("dudu", "소원이 하늘 금으로 스르르 올라갔어! 재밌다! 이 마을 정말 살아 볼 만하겠는데?"),
                    new Line("bandi", "두두는 말썽만 피워서 걱정이야. 대신 내가 잘 이끌게. 이 마을에 살아도 될까?"),
                    new Line("me", "함께 지낼 손님이 있으면 마을이 더 밝아지겠지요.") },
                Choice = null },
            new Scene { Id = "rumi1", ChapterId = "au_rumi",
                Lines = new[] {
                    new Line("rumi", "탐사원 루미예요. 우주기지에 불시착했는데, 구조 신호가 닿으려면 300년이 걸린대요. 무전기는 이 땅 것이라 옛 봉투에 넣어야 신호가 가고."),
                    new Line("me", "봉투에 신호를? 옛 우체통이 신호를 앞날로 부치는 길이라는 말씀이지요?"),
                    new Line("rumi", "네! 우선 기지 광석 세 개로 송신기를 고치고 싶어요. 도와주실 수 있어요?") },
                Choice = null },
            new Scene { Id = "rumi2", ChapterId = "au_rumi",
                Lines = new[] {
                    new Line("rumi", "신호가 우체통으로 들어갔어요! 옛 봉투에 담긴 신호가 300년 뒤에 닿는다니… 이제 기다릴 수 있어요."),
                    new Line("me", "탐사차 택배는 앞당겨서 오게 하겠습니다. 편지로 소식을 전해 주세요.") },
                Choice = null },
            new Scene { Id = "ins1", ChapterId = "au_insect",
                Lines = new[] {
                    new Line("nabi", "곤충 박사 나비예요! 반딧불이가 해마다 줄어드는 까닭을 찾고 있어요. 금 너머에서 새는 빛이 밤을 밝혀서 짝짓기를 방해하는 것 같아요."),
                    new Line("me", "채집망을 빌려 주시면 곤충을 다섯 마리 잡아 보겠습니다."),
                    new Line("nabi", "기록용으로 사고에도 기증해 주세요. 옛 정원 돌담 곁에서 반딧불이 정원을 다시 만들어 볼게요.") },
                Choice = null },
            new Scene { Id = "ins2", ChapterId = "au_insect",
                Lines = new[] {
                    new Line("nabi", "기증하신 곤충 덕에 빛 공해의 가설이 맞는지 확인했어요. 금에서 새는 빛이 문제였네요."),
                    new Line("me", "금을 닫을 수는 없어도 빛이 덜 새게 할 수는 있겠군요.") },
                Choice = null },
            new Scene { Id = "har1", ChapterId = "au_harvest",
                Lines = new[] {
                    new Line("keeper", "한가위에는 받은 답장에 답례하는 법이오. 마을 사람 하나와 마음을 깊이 나눈 뒤에 잔치를 엽시다."),
                    new Line("dareum", "저는 송편 배달을 맡을게요. 시대마다 송편 모양이 다르다는 걸 알았어요!") },
                Choice = null },
            new Scene { Id = "har2", ChapterId = "au_harvest",
                Lines = new[] {
                    new Line("rumi", "보름달이 이렇게 큰 줄 몰랐어요. 모선에서 본 달은 작았는데요."),
                    new Line("keeper", "달은 보는 자리에 따라 커지는 법이오. 그대가 이 마을에 뿌리를 내렸다는 뜻이기도 하고.") },
                Choice = null },
            new Scene { Id = "cave1", ChapterId = "au_cave",
                Lines = new[] {
                    new Line("keeper", "북쪽 동굴 끝까지 가 보시오. 벽화가 있고 그 끝에 빛나는 결정이 박혀 있다 하오."),
                    new Line("explorer", "밧줄은 내가 걸어 두었지. 조심해서 들어가 봐.") },
                Choice = null },
            new Scene { Id = "cave2", ChapterId = "au_cave",
                Lines = new[] {
                    new Line("k7", "이 결정은 금의 조각입니다. 금은 우체통이 부르는 길이었어요. 결정을 만지면 금이 더 벌어질 수도, 잠잠해질 수도 있습니다."),
                    new Line("me", "금을 활짝 열어 두면 여러 시대 손님이 더 올 것이고, 조용히 해 달라면 밤이 고요해지겠지요.") },
                Choice = new Choice { Id = "crack", PromptKo = "금을 어떻게 할 것인가", Options = new[] { new Option { Key = "open", LabelKo = "금을 활짝 열어 둔다" }, new Option { Key = "quiet", LabelKo = "조용히 해 달라 한다" } } } },
            new Scene { Id = "let1", ChapterId = "wi_letters",
                Lines = new[] {
                    new Line("keeper", "옛 우체통에 앞날의 답장이 쌓였다오. 고맙다는 편지를 주민마다 전해 주시겠소?"),
                    new Line("dareum", "붓글씨 편지에 택배 상자에 빛 편지까지, 한 상자에 세 시대가 담겼어요! 제가 나눠 실을게요.") },
                Choice = null },
            new Scene { Id = "let2", ChapterId = "wi_letters",
                Lines = new[] {
                    new Line("keeper", "주민들이 편지를 읽고 웃었소. 편지꽂이 하나를 마련해 드리리다."),
                    new Line("me", "앞날의 이웃이 이 마을을 기억하고 있다는 편지였습니다.") },
                Choice = null },
            new Scene { Id = "dong1", ChapterId = "wi_dongji",
                Lines = new[] {
                    new Line("keeper", "동지 팥죽을 쑬 때가 되었소. 팥죽 솥 곁에 주민과 손님이 모이면 잔치가 차오르오."),
                    new Line("rumi", "온열 장치도 가져왔어요! 팥죽이 식지 않게요.") },
                Choice = null },
            new Scene { Id = "dong2", ChapterId = "wi_dongji",
                Lines = new[] {
                    new Line("keeper", "살러 온 손님이 둘이 되니 잔치가 찼구려. 이 마을이 참 따뜻해졌소.") },
                Choice = null },
            new Scene { Id = "ny1", ChapterId = "wi_newyear",
                Lines = new[] {
                    new Line("keeper", "설날이오. 한복 입은 주민마다 세배를 돌아 새해 인사를 나누시오. 복주머니를 드리겠소."),
                    new Line("k7", "새해 기록도 남기겠습니다. 이 마을의 새해 인사가 앞날 기록에 들어가요.") },
                Choice = null },
            new Scene { Id = "moon1", ChapterId = "wi_moon",
                Lines = new[] {
                    new Line("keeper", "대보름이오. 달집에 불을 놓으면 하늘 금이 옛 우체통 위로 내려온다는 말이 있소."),
                    new Line("chalna", "마지막 사진을 찍을게요. 달집 불빛이 금에 닿는 순간이요!"),
                    new Line("k7", "기록판이 바뀌고 있습니다… \"사라진 숲\" 글자가 흐려지고 있어요.") },
                Choice = null },
            new Scene { Id = "moon2_open", ChapterId = "wi_moon",
                Lines = new[] {
                    new Line("k7", "\"이어진 숲\"! 기록판 글자가 바뀌었습니다. 금이 열려 있어서 여러 시대 손님이 모두 모였고, 별 우체통이 되어 하늘에 걸렸어요."),
                    new Line("keeper", "이제 이 마을은 잊히지 않소. 별 우체통을 마을 명소로 삼읍시다. 그대는 이어진 숲의 이웃이오.") },
                Choice = null },
            new Scene { Id = "moon2_quiet", ChapterId = "wi_moon",
                Lines = new[] {
                    new Line("k7", "\"이어진 숲\"! 기록판 글자가 바뀌었습니다. 금이 조용히 내려앉아 별 우체통이 고요한 밤에 걸렸어요."),
                    new Line("keeper", "조용한 밤이 이 마을에 어울리오. 별 우체통은 마을 명소요. 그대는 이어진 숲의 이웃이오.") },
                Choice = null },
            new Scene { Id = "rep1", ChapterId = "y2_reply",
                Lines = new[] {
                    new Line("keeper", "눈 녹은 아침에 별 우체통이 저 혼자 덜컹거렸소. 지난겨울 부친 편지에 답이 온 모양이오."),
                    new Line("dareum", "배달 왔습니다! 소인이 찍힌 데가 한 곳이 아니에요. 붓글씨 봉투, 택배 영수증 도장, 빛 도장까지 세 시대 답장이 한꺼번에요."),
                    new Line("me", "이걸 마을 사람들에게 하나씩 전해 드리면 되겠군요.") },
                Choice = null },
            new Scene { Id = "rep2", ChapterId = "y2_reply",
                Lines = new[] {
                    new Line("dareum", "전해 주셔서 고맙습니다. 받은 분들 얼굴이 봄꽃 같더군요. 아직 우체통 안쪽에 답장이 한 통 더 남았는데 — 겉에 여우 그림이 그려져 있어요."),
                    new Line("keeper", "여우 그림이라면 호연이오. 그 사람 답장은 직접 받으러 가는 게 예의라오.") },
                Choice = null },
            new Scene { Id = "hoy1", ChapterId = "y2_hoyeon",
                Lines = new[] {
                    new Line("hoyeon", "답장은 우체통에 넣기 전에 얼굴 보고 전하는 게 장사꾼 예의요. 지난해 좌판을 내주어 고마웠소. 올해는 내가 대접하겠소."),
                    new Line("me", "대접이라니요. 저야 꽃 몇 송이 모았을 뿐인데요."),
                    new Line("hoyeon", "꽃 다섯 송이만 더 모아 오시오. 시대를 잃은 물건 중에 이 마을에 어울리는 걸 하나 골라 두었소.") },
                Choice = null },
            new Scene { Id = "hoy2", ChapterId = "y2_hoyeon",
                Lines = new[] {
                    new Line("hoyeon", "꽃이 곱구려. 이 옛 방울에 꽃잎을 달아 두면 봄바람에 절로 울지. 마을 이웃 마음이 이만큼 통하면 방울도 제 소리를 낸다오."),
                    new Line("keeper", "마을 사람과 정이 여섯 하트쯤 쌓이면 방울이 제 목소리를 낼 게요.") },
                Choice = null },
            new Scene { Id = "hoy3", ChapterId = "y2_hoyeon",
                Lines = new[] {
                    new Line("hoyeon", "방울이 우는구려! 옛 땅 방울 소리와 앞날 빛 부채 바람이 한자리에서 섞였소. 이게 답장이오. 이 마을은 시대가 오가는 길목이 되었소."),
                    new Line("me", "아직 모자란 이웃인데도 답장을 이렇게 받아도 되나요?"),
                    new Line("hoyeon", "답장은 받는 이가 아니라 부친 이가 정하는 법이오. 부친 이는 그대였소.") },
                Choice = null },
            new Scene { Id = "reb1", ChapterId = "y2_ruin",
                Lines = new[] {
                    new Line("k7", "기록판이 갱신됐어요. \"이어진 숲\" 밑에 새 줄이 생겼는데 — \"옛 우체통 복원 미완\"."),
                    new Line("keeper", "탑성 폐허의 옛 우체통은 별 우체통과 한 쌍이오. 한쪽만 서 있으면 답장이 길을 잃는다오."),
                    new Line("me", "폐허에 가서 무너진 자리를 살펴보겠습니다.") },
                Choice = null },
            new Scene { Id = "reb2", ChapterId = "y2_ruin",
                Lines = new[] {
                    new Line("dareum", "폐허 돌 위에 안전모 하나가 놓여 있었죠? 현대 공사장 물건이에요. 누군가 이미 쌓기 시작했다는 뜻이에요."),
                    new Line("k7", "설계도 홀로그램 조각도 나왔어요. 앞날 사람과 옛사람이 함께 쌓는 우체통이라니, 기록에 없던 일입니다."),
                    new Line("me", "편지 한 통만 더 배달하면 첫 돌을 놓을 수 있겠어요.") },
                Choice = null },
            new Scene { Id = "ans1", ChapterId = "y2_bloom",
                Lines = new[] {
                    new Line("keeper", "옛 우체통에 첫 돌이 놓였소. 이제 삼짇날 꽃놀이를 열어 새 우체통을 알리면 좋겠구려."),
                    new Line("hoyeon", "방울을 꽃가지에 달고 나가겠소. 이번 꽃전은 내가 빚소."),
                    new Line("dareum", "저는 답장 엽서를 한 장씩 돌리겠습니다. 이 마을 소인이 찍힌 엽서예요!") },
                Choice = null },
            new Scene { Id = "ans2", ChapterId = "y2_bloom",
                Lines = new[] {
                    new Line("k7", "꽃놀이가 끝났군요. 기록판 새 줄이 바뀌었어요 — \"복원 미완\"이 \"이어 쌓는 중\"으로요."),
                    new Line("keeper", "이 마을은 이제 편지를 받기만 하는 곳이 아니라 답장을 보내는 곳이오. 그대는 답장을 받는 이웃이오."),
                    new Line("me", "내년에도, 그다음에도 이 마을에서 편지를 부치겠습니다.") },
                Choice = null },
            new Scene { Id = "lens1", ChapterId = "y2_lens",
                Lines = new[] {
                    new Line("chalna", "제 카메라를 잠깐 빌려 드릴게요. 솔숲과 요정골, 두 숲의 여름을 찍어 오시면 답장 사진첩이 완성돼요."),
                    new Line("me", "카메라는 처음인데요. 어디를 찍으면 좋을까요?"),
                    new Line("chalna", "눈에 띄는 것 말고, 제일 조용한 곳을 찍으세요. 조용한 곳에 시대가 겹쳐 보여요.") },
                Choice = null },
            new Scene { Id = "lens2", ChapterId = "y2_lens",
                Lines = new[] {
                    new Line("chalna", "솔숲의 그늘, 요정골의 버섯 불빛… 잘 찍으셨네요! 이 그늘 속에 옛 나무꾼이 지나가고, 저 불빛 속에 앞날 사람의 손전등이 겹쳐 있어요."),
                    new Line("pungnang", "허허, 내 젊은 날 뱃전에서 보던 등대불도 사진 한 장으로 남을 수 있소? 다음엔 나도 찍어 주오.") },
                Choice = null },
            new Scene { Id = "night1", ChapterId = "y2_night",
                Lines = new[] {
                    new Line("chalna", "여름 사진의 마지막은 밤이에요. 반딧불 참나무숲의 불빛은 오래 노출해야 찍혀요. 반딧불이 세 마리만 앞에 앉히면 돼요."),
                    new Line("dareum", "저는 삼각대를 들게요! 배달 짐 중에 가장 가벼운 짐이 제일 든든하지요.") },
                Choice = null },
            new Scene { Id = "night2", ChapterId = "y2_night",
                Lines = new[] {
                    new Line("chalna", "한 장 찍는 데 밤이 다 갔네요. 그런데 인화해 보니 반딧불 사이에 낯선 작은 불빛들이 줄지어 있어요 — 여러 시대가 보낸 답장 불빛 같아요."),
                    new Line("me", "반딧불과 답장이 한 장에 담겼군요.") },
                Choice = null },
            new Scene { Id = "end1", ChapterId = "y2_star",
                Lines = new[] {
                    new Line("keeper", "칠석날 밤에는 견우직녀가 하늘 금을 건넌다고들 하오. 사진첩을 별 우체통 앞에 펼쳐 놓읍시다."),
                    new Line("chalna", "답장 사진첩 마지막 장은 마을 사람 모두가 등불을 들고 서는 사진이에요. 함께 찍어요!") },
                Choice = null },
            new Scene { Id = "end2", ChapterId = "y2_star",
                Lines = new[] {
                    new Line("chalna", "찍었어요! 등불 든 사람들 사이에 옛 화공도, 앞날 사람도 서 있는 것 같지 않나요? 이 사진이 이 여름의 답장이에요."),
                    new Line("k7", "기록판이 갱신됐어요. \"사진으로 남은 숲\" — 앞날 기록에 사진 한 줄이 새로 생겼습니다."),
                    new Line("keeper", "그대는 이 마을의 사진 이웃이오. 사진첩은 마을 서고에 꽂아 두겠소.") },
                Choice = null },
            new Scene { Id = "rum1", ChapterId = "y2_rumi",
                Lines = new[] {
                    new Line("rumi", "모선 교신이 다시 잡혔어요! 지난가을 부친 편지가 우주기지 안테나에 닿았대요. 답신 상자 열쇠는 광석 세 덩이로 만든 열쇠래요."),
                    new Line("keeper", "광석이라면 이끼 돌너덜과 동굴에 넉넉하오."),
                    new Line("me", "광석 세 덩이를 모아 오겠습니다.") },
                Choice = null },
            new Scene { Id = "rum2", ChapterId = "y2_rumi",
                Lines = new[] {
                    new Line("rumi", "열쇠가 맞아요! 답신 상자에서 옛 붓 편지, 도하의 사진 편지, 빛 편지 세 통이 함께 나왔어요. 한 통은 배달해야 뜯을 수 있다고 적혀 있고요."),
                    new Line("dareum", "배달이라면 제 일이죠! 받는 이가 이 마을이라 소인을 마을 걸로 찍어 줄게요.") },
                Choice = null },
            new Scene { Id = "ccv1", ChapterId = "y2_cavebox",
                Lines = new[] {
                    new Line("k7", "마지막 답장 상자는 북쪽 동굴 끝에 있다고 기록에 나옵니다. 지난해 금 조각을 찾은 그 자리 뒤쪽이에요."),
                    new Line("me", "동굴에 다시 들어가 보겠습니다.") },
                Choice = null },
            new Scene { Id = "ccv2", ChapterId = "y2_cavebox",
                Lines = new[] {
                    new Line("k7", "답장 상자가 열렸어요. 안에 편지 한 통 — \"이 숲을 잊지 않겠다. 앞날에서.\" 서명은 없는데 글씨는 이 마을 주민 글씨를 닮았어요."),
                    new Line("keeper", "앞날의 우리가 보낸 편지인지도 모르겠소. 그대는 앞날의 답장을 여는 이웃이오.") },
                Choice = null },
            new Scene { Id = "wl1", ChapterId = "y2_wletter",
                Lines = new[] {
                    new Line("keeper", "겨울이 왔소. 올해는 편지를 받기만 하지 말고 이쪽에서 먼저 돌립시다. 배달 다섯을 마쳐 주시오."),
                    new Line("dareum", "눈길 배달은 발자국이 남아서 좋아요. 발자국이 길이 되니까요.") },
                Choice = null },
            new Scene { Id = "wl2", ChapterId = "y2_wletter",
                Lines = new[] {
                    new Line("dareum", "다 돌렸네요! 받은 사람 얼굴이 하나같이 밝아서 제 배달 가방도 가벼워졌어요."),
                    new Line("keeper", "먼저 부친 편지에는 답장이 세 시대에서 다시 올 것이오.") },
                Choice = null },
            new Scene { Id = "wd1", ChapterId = "y2_wdongji",
                Lines = new[] {
                    new Line("keeper", "동지 팥죽을 쑤어 지난해 잔치에 못 온 이웃도 부릅시다. 주민과 마음이 여덟은 깊어져야 잔치가 참 잔치요."),
                    new Line("chalna", "저는 팥죽 김이 오르는 사진을 찍을게요. 김 속에 시대가 겹쳐 보이거든요.") },
                Choice = null },
            new Scene { Id = "wd2", ChapterId = "y2_wdongji",
                Lines = new[] {
                    new Line("hoyeon", "팥죽 한 그릇에 옛 방울 소리가 은은하게 어울리는구려. 이웃이 이만큼 모였으니 이 마을은 이제 가게 열 만하오."),
                    new Line("pungnang", "뱃사람의 동지는 배를 묶어 두고 팥죽을 나누는 날이라오. 오늘은 마을에 배를 묶겠소.") },
                Choice = null },
            new Scene { Id = "wy1", ChapterId = "y2_wyear",
                Lines = new[] {
                    new Line("keeper", "설날 세배는 지난해와 같소. 다만 올해는 세배 돌이에 편지 한 통씩을 들고 갑시다."),
                    new Line("dareum", "새해 첫 배달! 소인은 이 마을 우체통 도장으로 찍겠습니다.") },
                Choice = null },
            new Scene { Id = "wy2", ChapterId = "y2_wyear",
                Lines = new[] {
                    new Line("k7", "설날 편지가 여러 시대로 나갔어요. 기록판에 처음 보는 이름들이 답장을 쓰기 시작했습니다."),
                    new Line("rumi", "모선에서도 새해 편지가 온다고 했어요. 이 숲의 소인이 인기래요!") },
                Choice = null },
            new Scene { Id = "wm1", ChapterId = "y2_wmoon",
                Lines = new[] {
                    new Line("keeper", "대보름달이 다시 떴소. 별 우체통과 옛 우체통이 나란히 섰으니 달집을 두 곳에 짓읍시다."),
                    new Line("k7", "기록판에 미완이던 줄이 하나 남았어요. \"옛 우체통 복원\". 오늘 밤 마무리하면 됩니다.") },
                Choice = null },
            new Scene { Id = "wm2", ChapterId = "y2_wmoon",
                Lines = new[] {
                    new Line("k7", "\"이어 쌓는 중\"이 \"이어진 우체통\"으로 바뀌었어요! 기록판에 더 쓸 줄이 없습니다 — 이 숲은 이제 기록이 아니라 이야기가 되었어요."),
                    new Line("keeper", "두 해를 함께 살았구려. 그대는 두 해째의 이어진 숲의 이웃이오. 내년에도 우체통은 열려 있을 것이오."),
                    new Line("me", "내년에도, 그다음에도 이 마을에서 편지를 부치겠습니다.") },
                Choice = null },
        };

        public static readonly Chapter[] Chapters =
        {
            new Chapter { Id = "sp_move", No = 1, Season = "spring", TitleKo = "이사 오던 날", BlurbKo = "짐을 풀던 밤, 하늘에 금이 가고 택배 기사 달음이 소포와 함께 떨어진다.",
                After = null, Gold = 300, Feat = 0, AwardKo = "",
                Steps = new[]
                {
                    new Step { T = "talk", Scene = "move1", By = "" },
                    new Step { T = "place", N = 1 },
                    new Step { T = "talk", Scene = "move2", By = "" },
                    new Step { T = "deliver", N = 1 },
                } },
            new Chapter { Id = "sp_postbox", No = 2, Season = "spring", TitleKo = "폐허의 옛 우체통", BlurbKo = "빛 편지가 가리키는 곳 — 탑성 폐허의 옛 우체통. 안에 여러 시대 편지가 쌓여 있다.",
                After = "sp_move", Gold = 400, Feat = 0, AwardKo = "",
                Steps = new[]
                {
                    new Step { T = "talk", Scene = "post1", By = "" },
                    new Step { T = "forest", Key = "flower_field" },
                    new Step { T = "go", Key = "flower_field", N = 1 },
                    new Step { T = "talk", Scene = "post2", By = "" },
                    new Step { T = "deliver", N = 1 },
                } },
            new Chapter { Id = "sp_fox", No = 3, Season = "spring", TitleKo = "여우 화상의 봄 장터", BlurbKo = "호연이 금으로 넘어와 \"시대를 잃은 물건\"을 판다. 삼짇날 꽃놀이로 장터를 연다.",
                After = "sp_postbox", Gold = 500, Feat = 10, AwardKo = "",
                Steps = new[]
                {
                    new Step { T = "talk", Scene = "fox1", By = "" },
                    new Step { T = "gather", Key = "Flower", N = 5 },
                    new Step { T = "talk", Scene = "fox2", By = "" },
                    new Step { T = "fest", Key = "FlowerHunt" },
                    new Step { T = "heart", N = 1 },
                    new Step { T = "talk", Scene = "fox3", By = "" },
                } },
            new Chapter { Id = "sp_museum", No = 4, Season = "spring", TitleKo = "사고를 채우다", BlurbKo = "K-7 이 떨어져 \"사라진 숲\" 기록을 보인다. 사고에 화석을 채우면 기록 한 줄이 흐려진다.",
                After = "sp_fox", Gold = 600, Feat = 15, AwardKo = "",
                Steps = new[]
                {
                    new Step { T = "talk", Scene = "mus1", By = "" },
                    new Step { T = "donate", Key = "Fossil", N = 3 },
                    new Step { T = "talk", Scene = "mus2", By = "" },
                } },
            new Chapter { Id = "su_photo", No = 5, Season = "summer", TitleKo = "숲 여덟의 사진", BlurbKo = "찰나가 \"사라지기 전에 찍어 두자\"며 숲을 돈다. 반딧불 참나무숲 밤 사진이 마지막.",
                After = "sp_museum", Gold = 800, Feat = 10, AwardKo = "",
                Steps = new[]
                {
                    new Step { T = "talk", Scene = "photo1", By = "" },
                    new Step { T = "forest", Key = "flower_field" },
                    new Step { T = "forest", Key = "mushroom_forest" },
                    new Step { T = "forest", Key = "rocky" },
                    new Step { T = "forest", Key = "dark_forest" },
                    new Step { T = "talk", Scene = "photo2", By = "" },
                } },
            new Chapter { Id = "su_waterfall", No = 6, Season = "summer", TitleKo = "폭포 너머", BlurbKo = "탐험가의 수수께끼 — 폭포 뒤 굴에 옛 편지 다발과 미래의 발자국.",
                After = "su_photo", Gold = 900, Feat = 0, AwardKo = "",
                Steps = new[]
                {
                    new Step { T = "talk", Scene = "fall1", By = "" },
                    new Step { T = "go", Key = "dark_forest", N = 1 },
                    new Step { T = "go", Key = "rocky", N = 1 },
                    new Step { T = "talk", Scene = "fall2", By = "" },
                } },
            new Chapter { Id = "su_star", No = 7, Season = "summer", TitleKo = "칠석, 별에 소원", BlurbKo = "도깨비불 반디와 두두 패가 칠석 밤에 몰려온다. 손님 하나를 마을에 살게 한다.",
                After = "su_waterfall", Gold = 1000, Feat = 20, AwardKo = "",
                Steps = new[]
                {
                    new Step { T = "talk", Scene = "star1", By = "" },
                    new Step { T = "fest", Key = "Wish" },
                    new Step { T = "settle", N = 1 },
                    new Step { T = "talk", Scene = "star2", By = "" },
                } },
            new Chapter { Id = "au_rumi", No = 8, Season = "autumn", TitleKo = "우주기지의 불시착", BlurbKo = "탐사원 루미 — 구조 신호가 300년 뒤에 닿는다. 옛 우체통으로 신호를 \"부치자\".",
                After = "su_star", Gold = 1100, Feat = 0, AwardKo = "",
                Steps = new[]
                {
                    new Step { T = "talk", Scene = "rumi1", By = "" },
                    new Step { T = "gather", Key = "Fossil", N = 3 },
                    new Step { T = "deliver", N = 1 },
                    new Step { T = "talk", Scene = "rumi2", By = "" },
                } },
            new Chapter { Id = "au_insect", No = 9, Season = "autumn", TitleKo = "반딧불이 정원", BlurbKo = "곤충 박사 나비가 반딧불이가 줄어드는 까닭을 찾는다 — 금 너머 빛 공해.",
                After = "au_rumi", Gold = 1200, Feat = 0, AwardKo = "",
                Steps = new[]
                {
                    new Step { T = "talk", Scene = "ins1", By = "" },
                    new Step { T = "gather", Key = "Insect", N = 5 },
                    new Step { T = "donate", Key = "Insect", N = 3 },
                    new Step { T = "talk", Scene = "ins2", By = "" },
                } },
            new Chapter { Id = "au_harvest", No = 10, Season = "autumn", TitleKo = "한가위 줄다리기", BlurbKo = "주민·손님 모두 두 편으로 — 줄다리기 뒤 달 아래 잔치.",
                After = "au_insect", Gold = 1300, Feat = 15, AwardKo = "",
                Steps = new[]
                {
                    new Step { T = "talk", Scene = "har1", By = "" },
                    new Step { T = "fest", Key = "Sebae" },
                    new Step { T = "heart", N = 3 },
                    new Step { T = "talk", Scene = "har2", By = "" },
                } },
            new Chapter { Id = "au_cave", No = 11, Season = "autumn", TitleKo = "북쪽 동굴의 조각", BlurbKo = "숲지기 부탁 \"동굴의 보물\" — 동굴 끝에 금의 조각. K-7: \"금은 우체통이 부르는 길\".",
                After = "au_harvest", Gold = 1400, Feat = 0, AwardKo = "",
                Steps = new[]
                {
                    new Step { T = "talk", Scene = "cave1", By = "" },
                    new Step { T = "go", Key = "rocky", N = 1 },
                    new Step { T = "talk", Scene = "cave2", By = "" },
                } },
            new Chapter { Id = "wi_letters", No = 12, Season = "winter", TitleKo = "편지가 쌓이는 겨울", BlurbKo = "앞날의 주민들에게서 답장이 온다 — 고맙다는 편지를 주민마다 전한다.",
                After = "au_cave", Gold = 1500, Feat = 0, AwardKo = "",
                Steps = new[]
                {
                    new Step { T = "talk", Scene = "let1", By = "" },
                    new Step { T = "deliver", N = 5 },
                    new Step { T = "heart", N = 5 },
                    new Step { T = "talk", Scene = "let2", By = "" },
                } },
            new Chapter { Id = "wi_dongji", No = 13, Season = "winter", TitleKo = "동지 팥죽 나눔", BlurbKo = "팥죽을 쑤어 손님·주민에게 — 살러 온 손님이 둘 이상이어야 잔치가 찬다.",
                After = "wi_letters", Gold = 1600, Feat = 0, AwardKo = "",
                Steps = new[]
                {
                    new Step { T = "talk", Scene = "dong1", By = "" },
                    new Step { T = "fest", Key = "Sebae" },
                    new Step { T = "settle", N = 2 },
                    new Step { T = "talk", Scene = "dong2", By = "" },
                } },
            new Chapter { Id = "wi_newyear", No = 14, Season = "winter", TitleKo = "설날 세배 돌기", BlurbKo = "주민·살러 온 손님 모두에게 세배.",
                After = "wi_dongji", Gold = 1700, Feat = 0, AwardKo = "",
                Steps = new[]
                {
                    new Step { T = "talk", Scene = "ny1", By = "" },
                    new Step { T = "fest", Key = "Sebae" },
                } },
            new Chapter { Id = "wi_moon", No = 15, Season = "winter", TitleKo = "대보름, 별 우체통", BlurbKo = "달집을 태우는 밤, 하늘 금이 우체통 위로 내려와 별 우체통이 된다. \"사라진 숲\"이 \"이어진 숲\"으로.",
                After = "wi_newyear", Gold = 3000, Feat = 50, AwardKo = "이어진 숲의 이웃",
                Steps = new[]
                {
                    new Step { T = "talk", Scene = "moon1", By = "" },
                    new Step { T = "fest", Key = "Wish" },
                    new Step { T = "go", Key = "flower_field", N = 1 },
                    new Step { T = "talk", Scene = "moon2", By = "crack" },
                } },
            new Chapter { Id = "y2_reply", No = 16, Season = "spring2", TitleKo = "별 우체통의 첫 답장", BlurbKo = "눈 녹은 아침, 지난겨울 부친 편지에 세 시대의 답장이 한꺼번에 도착한다.",
                After = "wi_moon", Gold = 800, Feat = 0, AwardKo = "",
                Steps = new[]
                {
                    new Step { T = "talk", Scene = "rep1", By = "" },
                    new Step { T = "deliver", N = 2 },
                    new Step { T = "talk", Scene = "rep2", By = "" },
                } },
            new Chapter { Id = "y2_hoyeon", No = 17, Season = "spring2", TitleKo = "호연의 답장", BlurbKo = "여우 화상 호연이 지난해 좌판의 답례로 옛 방울을 내놓는다. 이웃과 정이 쌓여야 방울이 운다.",
                After = "y2_reply", Gold = 900, Feat = 10, AwardKo = "",
                Steps = new[]
                {
                    new Step { T = "talk", Scene = "hoy1", By = "" },
                    new Step { T = "gather", Key = "Flower", N = 5 },
                    new Step { T = "talk", Scene = "hoy2", By = "" },
                    new Step { T = "heart", N = 6 },
                    new Step { T = "talk", Scene = "hoy3", By = "" },
                } },
            new Chapter { Id = "y2_ruin", No = 18, Season = "spring2", TitleKo = "다시 쌓는 옛 우체통", BlurbKo = "기록판에 \"옛 우체통 복원 미완\" 줄이 생긴다. 폐허에서 옛사람과 앞날 사람이 함께 쌓은 흔적을 찾는다.",
                After = "y2_hoyeon", Gold = 1000, Feat = 10, AwardKo = "",
                Steps = new[]
                {
                    new Step { T = "talk", Scene = "reb1", By = "" },
                    new Step { T = "go", Key = "flower_field", N = 1 },
                    new Step { T = "talk", Scene = "reb2", By = "" },
                    new Step { T = "deliver", N = 1 },
                } },
            new Chapter { Id = "y2_bloom", No = 19, Season = "spring2", TitleKo = "답장이 온 봄", BlurbKo = "옛 우체통에 첫 돌이 놓인 날, 삼짇날 꽃놀이로 새 우체통을 알린다. 기록판 줄이 \"이어 쌓는 중\"으로.",
                After = "y2_ruin", Gold = 3500, Feat = 60, AwardKo = "답장을 받는 이웃",
                Steps = new[]
                {
                    new Step { T = "talk", Scene = "ans1", By = "" },
                    new Step { T = "fest", Key = "FlowerHunt" },
                    new Step { T = "talk", Scene = "ans2", By = "" },
                } },
            new Chapter { Id = "y2_lens", No = 20, Season = "summer2", TitleKo = "빌려 준 카메라", BlurbKo = "찰나가 카메라를 빌려 준다. 조용한 두 숲의 여름을 찍는다.",
                After = "y2_bloom", Gold = 1200, Feat = 10, AwardKo = "",
                Steps = new[]
                {
                    new Step { T = "talk", Scene = "lens1", By = "" },
                    new Step { T = "forest", Key = "flower_field" },
                    new Step { T = "forest", Key = "mushroom_forest" },
                    new Step { T = "talk", Scene = "lens2", By = "" },
                } },
            new Chapter { Id = "y2_night", No = 21, Season = "summer2", TitleKo = "반딧불 야간 촬영", BlurbKo = "오래 노출해서 찍은 반딧불 사진에 여러 시대가 보낸 답장 불빛이 줄지어 선다.",
                After = "y2_lens", Gold = 1300, Feat = 10, AwardKo = "",
                Steps = new[]
                {
                    new Step { T = "talk", Scene = "night1", By = "" },
                    new Step { T = "forest", Key = "dark_forest" },
                    new Step { T = "gather", Key = "Insect", N = 3 },
                    new Step { T = "talk", Scene = "night2", By = "" },
                } },
            new Chapter { Id = "y2_star", No = 22, Season = "summer2", TitleKo = "칠석, 한여름의 답장", BlurbKo = "칠석날 밤 등불 든 마을 사람들이 별 우체통 앞에서 함께 찍는 사진이 이 여름의 답장이 된다.",
                After = "y2_night", Gold = 3800, Feat = 70, AwardKo = "한여름의 사진 이웃",
                Steps = new[]
                {
                    new Step { T = "talk", Scene = "end1", By = "" },
                    new Step { T = "fest", Key = "Wish" },
                    new Step { T = "talk", Scene = "end2", By = "" },
                } },
            new Chapter { Id = "y2_rumi", No = 23, Season = "autumn2", TitleKo = "루미의 답신", BlurbKo = "우주기지 안테나에 닿은 답신 상자 — 광석으로 만든 열쇠로 열고, 한 통은 배달해야 뜯는다.",
                After = "y2_star", Gold = 1400, Feat = 0, AwardKo = "",
                Steps = new[]
                {
                    new Step { T = "talk", Scene = "rum1", By = "" },
                    new Step { T = "gather", Key = "Fossil", N = 3 },
                    new Step { T = "talk", Scene = "rum2", By = "" },
                    new Step { T = "deliver", N = 1 },
                } },
            new Chapter { Id = "y2_moon", No = 24, Season = "autumn2", TitleKo = "한가위 답례", BlurbKo = "받은 답장에 답례하는 한가위 — 마을 사람과 마음을 깊이 나눈 뒤 잔치를 연다.",
                After = "y2_rumi", Gold = 1600, Feat = 10, AwardKo = "",
                Steps = new[]
                {
                    new Step { T = "talk", Scene = "har1", By = "" },
                    new Step { T = "heart", N = 8 },
                    new Step { T = "fest", Key = "Sebae" },
                    new Step { T = "talk", Scene = "har2", By = "" },
                } },
            new Chapter { Id = "y2_cavebox", No = 25, Season = "autumn2", TitleKo = "동굴 끝의 답장 상자", BlurbKo = "북쪽 동굴 끝의 마지막 답장 상자 — 앞날의 누군가가 보낸 편지 한 통.",
                After = "y2_moon", Gold = 4200, Feat = 80, AwardKo = "앞날의 답장을 여는 이웃",
                Steps = new[]
                {
                    new Step { T = "talk", Scene = "ccv1", By = "" },
                    new Step { T = "go", Key = "rocky", N = 1 },
                    new Step { T = "talk", Scene = "ccv2", By = "" },
                } },
            new Chapter { Id = "y2_wletter", No = 26, Season = "winter2", TitleKo = "겨울 편지 답례", BlurbKo = "올해는 이쪽에서 먼저 편지를 돌린다. 배달 다섯.",
                After = "y2_cavebox", Gold = 1800, Feat = 0, AwardKo = "",
                Steps = new[]
                {
                    new Step { T = "talk", Scene = "wl1", By = "" },
                    new Step { T = "deliver", N = 5 },
                    new Step { T = "talk", Scene = "wl2", By = "" },
                } },
            new Chapter { Id = "y2_wdongji", No = 27, Season = "winter2", TitleKo = "동지 답례", BlurbKo = "마음이 여덟 이상 깊어진 이웃과 동지 팥죽을 나눈다.",
                After = "y2_wletter", Gold = 1900, Feat = 10, AwardKo = "",
                Steps = new[]
                {
                    new Step { T = "talk", Scene = "wd1", By = "" },
                    new Step { T = "heart", N = 8 },
                    new Step { T = "fest", Key = "Sebae" },
                    new Step { T = "talk", Scene = "wd2", By = "" },
                } },
            new Chapter { Id = "y2_wyear", No = 28, Season = "winter2", TitleKo = "설날, 새 편지", BlurbKo = "세배 돌이에 편지 한 통씩을 들고 간다.",
                After = "y2_wdongji", Gold = 2000, Feat = 10, AwardKo = "",
                Steps = new[]
                {
                    new Step { T = "talk", Scene = "wy1", By = "" },
                    new Step { T = "fest", Key = "Sebae" },
                    new Step { T = "talk", Scene = "wy2", By = "" },
                } },
            new Chapter { Id = "y2_wmoon", No = 29, Season = "winter2", TitleKo = "두 번째 대보름", BlurbKo = "별 우체통과 옛 우체통이 나란히 선 밤, 기록판 \"복원 미완\" 줄이 \"이어진 우체통\"이 된다.",
                After = "y2_wyear", Gold = 6000, Feat = 120, AwardKo = "두 해째의 이어진 숲의 이웃",
                Steps = new[]
                {
                    new Step { T = "talk", Scene = "wm1", By = "" },
                    new Step { T = "fest", Key = "Wish" },
                    new Step { T = "go", Key = "flower_field", N = 1 },
                    new Step { T = "talk", Scene = "wm2", By = "" },
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

        public static Choice ChoiceOf(string id)
        {
            foreach (var s in Scenes) if (s.Choice != null && s.Choice.Id == id) return s.Choice;
            return null;
        }
    }
}
