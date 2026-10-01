using Saga.Core;

namespace Saga.Dungeon.Data
{
    /// <summary>
    /// PLAN.md 109-16 사가블로 시나리오 「이름이 지워지는 나라」 표(웹 사가블로 `js/data-scenario.js` · 정본 `scenario/saga-dungeon.md`) — 1막 중원의 난 셋 · 2막 잿빛과 소금 셋 ·
    /// 3막 불타는 남쪽 넷 · 4막 모래와 눈과 고철 넷 · 5막 이름 없는 곳 둘 · 6막 비석 너머 셋 = 열아홉 장, 장면 41. **표 원본은 웹 파일에서 스크립트로 옮겼다**(한 자도 손으로 안 옮김).
    /// 이 트랙 다름: 층 주인 이름을 이 트랙 것으로(옥관 수릉장·잿빛 성주·비늘 수문장·구름 천장), 웹 명소 키 `heaven` 은 이 트랙 `cloud`.
    /// 표 본문은 `Resources/scenario_dungeon.json`(tasks U-0009) — 고치려면 웹 표를 고치고 다시 내보낸다(`ScenarioJsonExport`). 영어·한국어 글은 `dungeon_*.json` 의 `dscen.*` 키.
    /// </summary>
    public static class DungeonScenarioData
    {
        [System.Serializable]
        public sealed class Cast { public string Id, NameKo, Emoji; }

        [System.Serializable]
        public struct Line
        {

            /// <summary>말하는 이 — `me`(부대 선두) 또는 <see cref="Casts"/> 의 id.</summary>
            public string Who, Ko;
            public Line(string who, string ko) { Who = who; Ko = ko; }
        }

        [System.Serializable]
        public sealed class Option { public string Key, LabelKo; public int Feat, Gold; }

        [System.Serializable]
        public sealed class Choice { public string Id, PromptKo; public Option[] Options; }

        [System.Serializable]
        public sealed class Scene
        {
            public string Id, ChapterId;
            public Line[] Lines;
            /// <summary>마지막 줄 뒤 고르기(망루성 성주의 이름).</summary>
            public Choice Choice;
        }

        /// <summary>talk · kill · floor · chain · landmark · rescue · region — 웹 단계 종류 그대로.</summary>
        [System.Serializable]
        public sealed class Step { public string T, Scene, Key, By; public int N; }

        [System.Serializable]
        public sealed class Chapter
        {
            public string Id, TitleKo, StageKo, BlurbKo, After, AwardKo;
            public int No, Act, Exp, Gold, Feat;
            public Step[] Steps;
        }

        /// <summary>JSON 한 파일 모양(tasks U-0009) — `Resources/scenario_dungeon.json`.</summary>
        [System.Serializable]
        public sealed class ScenarioFile { public Cast[] casts; public Scene[] scenes; public Chapter[] chapters; }

        public static ScenarioFile Snapshot() => new ScenarioFile { casts = Casts, scenes = Scenes, chapters = Chapters };

        private static readonly ScenarioFile _file = ScenarioJson.Load<ScenarioFile>("scenario_dungeon");

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

        /// <summary>그 고르기 id 가 든 고르기(없으면 null).</summary>
        public static Choice ChoiceOf(string id)
        {
            foreach (var s in Scenes) if (s.Choice != null && s.Choice.Id == id) return s.Choice;
            return null;
        }
    }
}
