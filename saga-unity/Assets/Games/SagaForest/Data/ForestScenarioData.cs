using Saga.Core;

namespace Saga.Forest.Data
{
    /// <summary>
    /// PLAN.md 109-16 사가의숲 시나리오 「하늘 금 우체통」 표(웹 사가의숲 `js/data-scenario.js` · 정본 `scenario/saga-forest.md`) — 사계절 열여섯 장 + 둘째 해 열여섯 장 중 **29장**(표 원본은 웹 파일에서 스크립트로 옮김).
    /// 이 트랙에 물이 없어(방문객 「낚시 명인」의 대사 그대로) 낚시·조개 장 셋(su_sailor · y2_album · y2_record)은 뺐다. 매핑: 웹 숲 다섯 → 구역 넷(솔숲·억새 = 꽃밭 · 요정골 = 버섯숲 · 거인 고개 = 바위 지대 · 반딧불 = 어둑숲) ·
    /// 폭포·동굴·폐허 자리 → 명소(이끼 돌제단 · 거인 선돌 · 옛 돌기둥터) · 곤충 = 곤충 채집 · 광석 = 화석 채집 · 기증 = 박물관 도감(갈래당 셋이라 최대 3) · 행사 일곱 → 이 트랙 행사 셋의 **기념 놀이**
    /// (세배 · 꽃놀이 · 소원 — 그날이 아니어도 그 단계 동안 열림). 금 ÷ 50 → 과일, 공적 → 과일 그대로(경험치는 이 판에 없음). 표 본문은 `Resources/scenario_forest.json`(tasks U-0009) — 고치려면 웹 표를 고치고 다시 내보낸다(`ScenarioJsonExport`).
    /// </summary>
    public static class ForestScenarioData
    {
        [System.Serializable]
        public sealed class Cast { public string Id, NameKo, Emoji; }

        [System.Serializable]
        public struct Line
        {
            public string Who, Ko;
            public Line(string who, string ko) { Who = who; Ko = ko; }
        }

        [System.Serializable]
        public sealed class Option { public string Key, LabelKo; }
        [System.Serializable]
        public sealed class Choice { public string Id, PromptKo; public Option[] Options; }
        [System.Serializable]
        public sealed class Scene { public string Id, ChapterId; public Line[] Lines; public Choice Choice; }

        /// <summary>talk · place · deliver · forest(Key = 구역) · go(Key = 구역의 명소, N = 서는 횟수) · gather(Key = 갈래, N) · fest(Key = 행사 종류) · heart · donate(Key = 갈래, N) · settle.</summary>
        [System.Serializable]
        public sealed class Step { public string T, Scene, Key, By; public int N; }

        [System.Serializable]
        public sealed class Chapter
        {
            public string Id, Season, TitleKo, BlurbKo, After, AwardKo;
            public int No, Gold, Feat;
            public Step[] Steps;
        }

        /// <summary>JSON 한 파일 모양(tasks U-0009) — `Resources/scenario_forest.json`.</summary>
        [System.Serializable]
        public sealed class ScenarioFile { public string[] seasons; public Cast[] casts; public Scene[] scenes; public Chapter[] chapters; }

        public static ScenarioFile Snapshot() => new ScenarioFile { seasons = Seasons, casts = Casts, scenes = Scenes, chapters = Chapters };

        private static readonly ScenarioFile _file = ScenarioJson.Load<ScenarioFile>("scenario_forest");

        public static readonly string[] Seasons = _file.seasons ?? new string[0];
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

        public static Choice ChoiceOf(string id)
        {
            foreach (var s in Scenes) if (s.Choice != null && s.Choice.Id == id) return s.Choice;
            return null;
        }
    }
}
