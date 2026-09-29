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

        /// <summary>talk · mission(q_field 첫 사냥 · q_boss1 두목의 목) · job(n차 전직) · rift(비경을 이 단계가 시작된 뒤 한 번 끝까지).</summary>
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
            new Chapter { Id = "p3_labyrinth", No = 3, TitleKo = "비경의 기억", StageKo = "비경", BlurbKo = "이음이 여는 5층 비경. 관문 수호장을 치면 잃은 기억 조각이 나온다 — 떠돌이도 문에서 떨어졌다.",
                Need = 30, After = "p1_job", Exp = 30000, Shards = 3, JobTitle = false,
                LegacyLevel = 45, LegacyTier = 3,
                Steps = new[]
                {
                    new Step { T = "talk", Scene = "lab1" },
                    new Step { T = "rift" },
                    new Step { T = "talk", Scene = "lab2" },
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
