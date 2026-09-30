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

        public sealed class Scene { public string Id, ChapterId; public Line[] Lines; }

        /// <summary>talk · mission(q_field 첫 사냥 · q_boss1 두목의 목) · job(n차 전직) · gate(관문 대장을 한 번이라도 이겼다) · rift(비경을 이 단계가 시작된 뒤 한 번 끝까지).</summary>
        public sealed class Step { public string T, Scene, Key; public int N; }

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
            new Chapter { Id = "p2_cave", No = 4, TitleKo = "한중 굴혈", StageKo = "한중 굴혈", BlurbKo = "위군 도독의 진 깊은 곳에서 탐사 대원 이음을 구한다. 둘째 스승에게 2차 전직을 배운다.",
                Need = 15, After = "p2_port", Exp = 4000, Shards = 0, JobTitle = true,
                LegacyLevel = 25, LegacyTier = 2,
                Steps = new[]
                {
                    new Step { T = "talk", Scene = "cave1" },
                    new Step { T = "job", N = 2 },
                    new Step { T = "talk", Scene = "cave2" },
                } },
            new Chapter { Id = "p3_labyrinth", No = 5, TitleKo = "비경의 기억", StageKo = "비경", BlurbKo = "이음이 여는 5층 비경. 관문 수호장을 치면 잃은 기억 조각이 나온다 — 떠돌이도 문에서 떨어졌다.",
                Need = 30, After = "p2_cave", Exp = 30000, Shards = 3, JobTitle = false,
                LegacyLevel = 45, LegacyTier = 3,
                Steps = new[]
                {
                    new Step { T = "talk", Scene = "lab1" },
                    new Step { T = "rift" },
                    new Step { T = "talk", Scene = "lab2" },
                } },
            new Chapter { Id = "p3_job", No = 6, TitleKo = "셋째 스승", StageKo = "허도", BlurbKo = "허도의 스승이 \"네 이름은 문 너머에 두고 왔구나\" 하며 3차 전직을 준다.",
                Need = 30, After = "p3_labyrinth", Exp = 40000, Shards = 0, JobTitle = true,
                LegacyLevel = 45, LegacyTier = 3,
                Steps = new[]
                {
                    new Step { T = "talk", Scene = "job31" },
                    new Step { T = "job", N = 3 },
                    new Step { T = "talk", Scene = "job32" },
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
