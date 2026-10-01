using Saga.Core;
using System.Collections.Generic;

namespace Saga.Realm.Data
{
    /// <summary>
    /// PLAN.md 109-16 시나리오 「천하와 균열」 표(웹 사가국지 `js/data-scenario.js` · 정본 `scenario/saga-realm.md`) — 1막 중원의 난 셋 · 2막 대전 셋 · 3막 강 위 셋 · 4막 삼계 균열 셋 · 5막 먼 길 셋 · 6막 천하 하나 +
    /// 결말 뒤 곁가지 7막 틈의 끝 셋 = 열아홉 카드. **표 원본은 웹 파일에서 스크립트로 옮겼다**(한 자도 손으로 안 옮김). 이 트랙 다름: 웹 효과 `loyal`(책사 충성)은 이 트랙에 충성 축이 없어
    /// **수도 기술 +2n** 으로, `rel`(이웃 우호)는 외교 축이 없어 **화친(+n)은 수도 치안 +0.4n**·**선전(−n)은 뺐다**. 힌트 글은 효과에서 만든다(`RealmScenario.Hint`).
    /// 표 본문은 `Resources/scenario_realm.json`(tasks U-0009) — 고치려면 웹 표를 고치고 다시 내보낸다(`ScenarioJsonExport`).
    /// </summary>
    public static class RealmScenarioData
    {
        [System.Serializable]
        public struct Fx
        {
            /// <summary>gold · food · sec · train · tech · recruit(Id = 시간 틈 사람).</summary>
            public string T;
            public int N;
            public string Id;
            public Fx(string t, int n, string id = null) { T = t; N = n; Id = id; }
        }

        [System.Serializable]
        public sealed class Choice
        {
            /// <summary>atk · def · util = 사건 카드 선택 A · B · C.</summary>
            public string K, LabelKo, ResultKo;
            public int Cost;
            public Fx[] Fx;
        }

        [System.Serializable]
        public sealed class Card
        {
            public string Id, Emoji, TitleKo, TextKo, FromId;
            /// <summary>곁가지 카드(<see cref="RealmScenarioSideData"/>) — 그 시간 틈 사람. 카드 속 {책사} 가 이 사람이다.</summary>
            public string Who;
            public int No, Act, MinTurn, OrCities;
            /// <summary>승리 하나를 이룬 뒤에 뜬다(6막·7막) · 시간 틈 사람 아홉이 다 우리 사람이어야 뜬다(7막 첫 카드).</summary>
            public bool Victory, AllTime;
            /// <summary>6막 — 이룬 승리 종류별 글 · 7막 뒤 두 카드 — 앞 카드(<see cref="FromId"/>)에서 고른 답(atk·def·util)별 글.</summary>
            [System.NonSerialized] public Dictionary<string, string> TextByKo, TextByKKo;
            /// <summary>JSON 용 — `JsonUtility` 가 사전을 못 담아 위 둘을 키·값 쌍으로 쓴다(<see cref="ScenarioFile.Finish"/> 가 읽은 뒤 사전을 채운다).</summary>
            public Kv[] TextByKoList, TextByKKoList;

            public void SyncKv() { TextByKoList = ToKv(TextByKo); TextByKKoList = ToKv(TextByKKo); }
            public void BuildDicts() { TextByKo = FromKv(TextByKoList); TextByKKo = FromKv(TextByKKoList); }

            private static Kv[] ToKv(Dictionary<string, string> d)
            {
                if (d == null) return null;
                var a = new Kv[d.Count]; int i = 0;
                foreach (var e in d) a[i++] = new Kv { K = e.Key, V = e.Value };
                return a;
            }

            private static Dictionary<string, string> FromKv(Kv[] a)
            {
                if (a == null || a.Length == 0) return null;
                var d = new Dictionary<string, string>();
                foreach (var e in a) d[e.K] = e.V;
                return d;
            }
            public Choice[] Choices;
        }

        [System.Serializable]
        public struct Kv { public string K, V; }

        /// <summary>JSON 한 파일 모양(tasks U-0009) — `Resources/scenario_realm.json`(본 사슬 카드 + 곁가지).</summary>
        [System.Serializable]
        public sealed class ScenarioFile : IScenarioFile
        {
            public string[] timeFolk;
            public Card[] cards;
            public Card[] side;

            public void Finish()
            {
                if (cards != null) foreach (var c in cards) c.BuildDicts();
                if (side != null) foreach (var c in side) c.BuildDicts();
            }
        }

        public static ScenarioFile Snapshot()
        {
            foreach (var c in Cards) c.SyncKv();
            foreach (var c in RealmScenarioSideData.Side) c.SyncKv();
            return new ScenarioFile { timeFolk = TimeFolk, cards = Cards, side = RealmScenarioSideData.Side };
        }

        /// <summary>시간 틈 사람 아홉 — 7막이 열리는 조건.</summary>
        private static readonly ScenarioFile _file = ScenarioJson.Load<ScenarioFile>("scenario_realm");

        public static readonly string[] TimeFolk = _file.timeFolk ?? new string[0];

        public static readonly Card[] Cards = _file.cards ?? new Card[0];

        /// <summary>곁가지 카드(<see cref="RealmScenarioSideData"/>) — 같은 JSON 의 side.</summary>
        public static readonly Card[] SideCards = _file.side ?? new Card[0];

        public static Card Get(string id)
        {
            foreach (var c in Cards) if (c.Id == id) return c;
            return null;
        }
    }
}
