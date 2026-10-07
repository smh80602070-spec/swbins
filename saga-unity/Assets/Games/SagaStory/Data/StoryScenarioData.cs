using Saga.Core;

namespace Saga.Story.Data
{
    /// <summary>
    /// PLAN.md 109-16 사가종횡 시나리오 「이름 없는 떠돌이」 표(웹 사가종횡 `js/data-scenario.js` · 정본 `scenario/saga-story.md`) — 이 트랙엔 사냥터가 들판 하나와 비경뿐이라
    /// 트랙 메모대로 **들판(p1_field)·첫 전직(p1_job)·비경(p3_labyrinth) 셋**만 넣는다(표 원본은 웹 파일에서 스크립트로 옮김). 웹 `stage` 단계는 뺐고(이미 들판),
    /// 돈·두루마리 보상은 이 트랙에 없어 뺐다. 나머지 장은 사냥터가 생긴 뒤 같은 생성기에 장 id 를 더한다.
    /// 표 본문은 `Resources/scenario_story.json`(tasks U-0009) — 고치려면 웹 표를 고치고 다시 내보낸다(`ScenarioJsonExport`). 글은 `story_*.json` 의 `sscen.*` 키.
    /// </summary>
    public static class StoryScenarioData
    {
        [System.Serializable]
        public sealed class Cast { public string Id, NameKo, Emoji; }

        [System.Serializable]
        public struct Line
        {

            /// <summary>말하는 이 — `me`(주인공) 또는 <see cref="Casts"/> 의 id.</summary>
            public string Who, Ko;
            public Line(string who, string ko) { Who = who; Ko = ko; }
        }

        [System.Serializable]
        public sealed class ChoiceOption { public string Key, LabelKo, TitleKo; }

        /// <summary>장면 끝 고르기(웹 `choice`) — 고른 답은 <see cref="StoryScenario.ChoiceOf"/> 에 남고, 답에 칭호가 있으면 칭호가 된다.</summary>
        [System.Serializable]
        public sealed class Choice { public string Id, PromptKo; public ChoiceOption[] Options; }

        [System.Serializable]
        public sealed class Scene { public string Id, ChapterId; public Line[] Lines; public Choice Choice; }

        /// <summary>talk(`By` 가 있으면 그 고르기의 답에 따라 `장면_답`) · mission(q_field 첫 사냥 · q_boss1 두목의 목) · job(n차 전직) · gate(관문 대장을 한 번이라도 이겼다) · kills(이 단계가 시작된 뒤 잡졸 N) · boss(이 단계가 시작된 뒤 두목 N) · rift(비경을 이 단계가 시작된 뒤 한 번 끝까지).</summary>
        [System.Serializable]
        public sealed class Step { public string T, Scene, Key, By; public int N; }

        [System.Serializable]
        public sealed class Chapter
        {
            public string Id, TitleKo, StageKo, BlurbKo, After;
            public int No, Need, Exp, Shards, LegacyLevel, LegacyTier;
            /// <summary>칭호 = "이름 없는 " + 방금 고른 직업 이름.</summary>
            public bool JobTitle;
            public Step[] Steps;
        }

        /// <summary>JSON 한 파일 모양(tasks U-0009) — `Resources/scenario_story.json`.</summary>
        [System.Serializable]
        public sealed class ScenarioFile { public Cast[] casts; public Scene[] scenes; public Chapter[] chapters; }

        public static ScenarioFile Snapshot() => new ScenarioFile { casts = Casts, scenes = Scenes, chapters = Chapters };

        private static readonly ScenarioFile _file = ScenarioJson.Load<ScenarioFile>("scenario_story");

        public static readonly Cast[] Casts = _file.casts ?? new Cast[0];
        public static readonly Scene[] Scenes = _file.scenes ?? new Scene[0];
        public static readonly Chapter[] Chapters = _file.chapters ?? new Chapter[0];

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
