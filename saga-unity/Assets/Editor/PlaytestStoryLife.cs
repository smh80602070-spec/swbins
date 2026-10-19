using UnityEngine;
using Saga.Story.Data;
using Saga.Story.World;

namespace Saga.EditorTools
{
    /// <summary>
    /// tasks U-0133 생활 기술 등급(채집, 웹 W-0283) 진단 — `PlaytestStorySlice` 판 등급 넓히기(runrank2) 뒤에 부른다(한 프레임 안).
    /// 다섯 줄: ① 단계 표(아홉 단계·누적 940·경계) ② F 는 덤 0·1급은 늘 덤 ③ 채집터 넷·곁 단추·캐면 재료·경험·쿨 8초 거절
    /// ④ 단계 오름(19→20 경험이면 E·토스트 한 줄) ⑤ 저장 왕복·옛 세이브(lifeJson 없음) = F·0. 끝나면 세이브 JSON·주인공 자리를 시작 때로.
    /// </summary>
    public static class PlaytestStoryLife
    {
        private const string T = "[PlaytestStorySlice] life";
        private static bool _ok, _step;

        public static bool Run()
        {
            _ok = true;
            string json0 = StorySaveState.ToJson();
            string life0 = StoryLife.Snapshot();
            var pl = GameObject.FindWithTag("Player");
            var cc = pl != null ? pl.GetComponent<CharacterController>() : null;
            Vector3 pos0 = pl != null ? pl.transform.position : Vector3.zero;
            var nodes = StoryGatherNode.Instance != null ? StoryGatherNode.Instance : StoryGatherNode.Install();
            try
            {
                StoryLife.Restore(null);

                // ① 단계 표
                Begin();
                if (StoryLife.Ranks.Length != 9 || StoryLife.TotalNeed != 940) Fail($"단계 {StoryLife.Ranks.Length}·누적 {StoryLife.TotalNeed} ≠ 9·940");
                if (StoryLife.RankIdx(19) != 0 || StoryLife.RankIdx(20) != 1 || StoryLife.RankIdx(939) != 7 || StoryLife.RankIdx(940) != 8 || StoryLife.RankIdx(5000) != 8) Fail("단계 경계");
                End("ranks OK - F·E·D·C·B·A·3·2·1 · 누적 940 · 경계 20/939/940");

                // ② 덤 확률
                Begin();
                var rng = new System.Random(20260824);
                StoryLife.SetXpForTest(0);
                int extra = 0;
                for (int i = 0; i < 30; i++) { StoryLife.SetXpForTest(0); if (StoryLife.Gather(rng, out _) > 1) extra++; }
                if (extra != 0 || StoryLife.ExtraChance != 0f) Fail($"F 인데 덤 {extra}");
                StoryLife.SetXpForTest(940);
                for (int i = 0; i < 10; i++) if (StoryLife.Gather(rng, out _) != 2) { Fail("1급인데 덤이 안 나옴"); break; }
                End("extra OK - F 덤 0(30번) · 1급 늘 덤(10번)");

                // ③ 채집터·쿨
                Begin();
                StoryLife.Restore(null);
                nodes.ResetCooldownsForTest();
                if (nodes.Count != 4) Fail($"채집터 {nodes.Count} ≠ 4");
                if (pl == null) Fail("주인공 없음");
                else
                {
                    Put(pl, cc, nodes.PosOf(0) + new Vector3(0.5f, 0.1f, 0f));
                    nodes.Sense();
                    if (!nodes.HintShown) Fail("채집터 곁인데 단추가 없음");
                    if (!nodes.Gather(0) || StoryLife.Mats != 1 || StoryLife.GatherXp != 1) Fail($"캐기 재료 {StoryLife.Mats}·경험 {StoryLife.GatherXp}");
                    if (nodes.Gather(0) || StoryLife.GatherXp != 1 || nodes.CooldownLeft(0) < StoryGatherNode.CooldownSec - 0.5f) Fail("쿨 8초 안에 또 캐짐");
                    if (!nodes.Gather(1) || StoryLife.GatherXp != 2) Fail("다른 채집터는 쿨과 따로가 아님");
                    Put(pl, cc, nodes.PosOf(0) + new Vector3(6f, 0.1f, 0f));
                    nodes.Sense();
                    if (nodes.HintShown) Fail("멀리서도 단추가 뜸");
                }
                End("node OK - 채집터 넷·곁 단추·재료 +1·경험 +1·쿨 8초 거절·채집터마다 따로");

                // ④ 단계 오름
                Begin();
                StoryLife.SetXpForTest(19);
                StoryLife.Gather(rng, out string up);
                if (up != "E" || StoryLife.GatherRankName != "E") Fail($"19→20 단계 {up}/{StoryLife.GatherRankName}");
                StoryLife.Gather(rng, out string up2);
                if (up2 != null) Fail("오르지 않았는데 토스트");
                if (!StoryLife.RankUpLine("E").Contains("E") || !StoryLife.HudLine().Contains("E")) Fail($"토스트·HUD 글 {StoryLife.HudLine()}");
                End("rankup OK - 경험 20 에 E·토스트 한 번·HUD 단계·진척");

                // ⑤ 저장
                Begin();
                StoryLife.SetXpForTest(123);
                int mats = StoryLife.Mats;
                string json = StorySaveState.ToJson();
                if (!json.Contains("\"lifeJson\"")) Fail("세이브에 lifeJson 없음");
                StoryLife.Restore(null);
                if (!StorySaveState.ApplyJson(json) || StoryLife.GatherXp != 123 || StoryLife.Mats != mats) Fail($"저장 왕복 경험 {StoryLife.GatherXp}·재료 {StoryLife.Mats}");
                string old = json.Replace("\"lifeJson\":", "\"lifeJsonX\":");
                if (!StorySaveState.ApplyJson(old) || StoryLife.GatherXp != 0 || StoryLife.Mats != 0 || StoryLife.GatherRankName != "F") Fail("옛 세이브(없음)인데 기록이 남음");
                End("save OK - lifeJson 왕복·옛 세이브 F·재료 0");
            }
            finally
            {
                StorySaveState.ApplyJson(json0);
                StoryLife.Restore(life0);
                nodes.ResetCooldownsForTest();
                if (pl != null) Put(pl, cc, pos0);
            }
            return _ok;
        }

        private static void Put(GameObject pl, CharacterController cc, Vector3 p)
        {
            if (cc != null) cc.enabled = false;
            pl.transform.position = p;
            if (cc != null) cc.enabled = true;
        }

        private static void Begin() => _step = true;
        private static void End(string line) { if (_step) Debug.Log($"{T} {line}"); }

        private static void Fail(string msg)
        {
            Debug.LogError($"{T}: {msg}");
            _ok = false;
            _step = false;
        }
    }
}
