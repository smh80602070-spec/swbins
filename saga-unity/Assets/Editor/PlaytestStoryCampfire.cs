using UnityEngine;
using Saga.Story.Data;
using Saga.Story.World;

namespace Saga.EditorTools
{
    /// <summary>
    /// tasks U-0170 모닥불에 모여 쉬기(웹 W-0300) 진단 — `PlaytestStorySlice` 채집(life) 뒤에 부른다(한 프레임 안).
    /// ① 선봉 = 첫 타 ×1.1 한 번 · 체력 가득 ② 유격 = 기운 가득 ③ 호법 = 최대 체력 ×1.1 ④ 판 중엔 못 앉음 · 판이 닫히면 온기 사라짐
    /// ⑤ 들머리 불(곁에 서면 앉음 · 안 나가면 다시 안 앉음 · 멀리 다녀오면 다시) ⑥ 저장 왕복·모르는 id 버림. 끝나면 세이브 JSON·교대·자리를 시작 때로.
    /// </summary>
    public static class PlaytestStoryCampfire
    {
        private const string T = "[PlaytestStorySlice] campfire";
        private static bool _ok;

        public static bool Run()
        {
            _ok = true;
            string json0 = StorySaveState.ToJson();
            int party0 = StoryPartyState.ActiveIndex;
            var pl = GameObject.FindWithTag("Player");
            var cc = pl != null ? pl.GetComponent<CharacterController>() : null;
            Vector3 pos0 = pl != null ? pl.transform.position : Vector3.zero;
            var spot = StoryCampfireSpot.Instance != null ? StoryCampfireSpot.Instance : StoryCampfireSpot.Install();
            string m = "";
            try
            {
                StoryRunRank.ClearForTest();
                StoryCampfire.Restore(null);
                float baseMax = StoryPlayerHp.HpMax;

                // ① 선봉
                StoryPartyState.Restore(0);
                if (!StoryCampfire.Sit() || StoryCampfire.Warmth != "vanguard") Fail($"선봉 앉기 {StoryCampfire.Warmth}");
                if (Mathf.Abs(StoryPlayerHp.Hp - StoryPlayerHp.HpMax) > 0.01f) Fail("앉아도 체력이 안 참");
                float a = StoryCampfire.TakeFirstHitMul(), b = StoryCampfire.TakeFirstHitMul();
                if (Mathf.Abs(a - 1.1f) > 1e-4f || Mathf.Abs(b - 1f) > 1e-4f) Fail($"첫 타 {a}·둘째 {b} ≠ 1.1·1");
                if (StoryCampfire.Line().Length == 0) Fail("한마디 빔");

                // ② 유격
                StoryPartyState.Restore(1);
                StoryCombat.TrySpendMp(40f);
                if (!StoryCampfire.Sit() || Mathf.Abs(StoryCombat.Mp - StoryCombat.MpMaxCurrent) > 0.01f) Fail($"유격 기운 {StoryCombat.Mp}/{StoryCombat.MpMaxCurrent}");
                if (Mathf.Abs(StoryCampfire.TakeFirstHitMul() - 1f) > 1e-4f) Fail("유격인데 첫 타 배율");

                // ③ 호법
                StoryPartyState.Restore(2);
                if (!StoryCampfire.Sit() || Mathf.Abs(StoryPlayerHp.HpMax - baseMax * 1.1f) > 0.05f) Fail($"호법 최대 체력 {StoryPlayerHp.HpMax} ≠ {baseMax * 1.1f}");

                // ④ 판 중 · 판 닫힘
                StoryRunRank.OnHit(100f);
                StoryPartyState.Restore(0);
                if (StoryCampfire.Sit() || StoryCampfire.Warmth != "guardian") Fail("판 중에 앉아짐");
                StoryRunRank.Finish(110f);
                if (StoryCampfire.HasWarmth || Mathf.Abs(StoryPlayerHp.HpMax - baseMax) > 0.05f) Fail("판이 닫혀도 온기 남음");
                m += $" 기본 체력 {baseMax:F0}";

                // ⑤ 들머리 불
                if (pl == null) Fail("주인공 없음");
                else
                {
                    spot.ArmForTest();
                    StoryPartyState.Restore(1);
                    Put(pl, cc, new Vector3(StoryCampfireSpot.FireX + 0.5f, 0.1f, 0f));
                    if (!spot.Sense() || StoryCampfire.Warmth != "skirmisher") Fail("불 곁인데 안 앉음");
                    if (spot.Sense()) Fail("안 나갔는데 또 앉음");
                    Put(pl, cc, new Vector3(StoryCampfireSpot.FireX + StoryCampfireSpot.LeaveX + 1f, 0.1f, 0f));
                    if (spot.Sense() || !spot.Armed) Fail("멀리 가도 다시 안 켜짐");
                    Put(pl, cc, new Vector3(StoryCampfireSpot.FireX - 0.4f, 0.1f, 0f));
                    if (!spot.Sense()) Fail("다녀와서 다시 안 앉음");
                    m += $" 불 x {StoryCampfireSpot.FireX}";
                }

                // ⑥ 저장
                StoryPartyState.Restore(0);
                StoryCampfire.Sit();
                string json = StorySaveState.ToJson();
                if (!json.Contains("\"campWarmth\":\"vanguard\"")) Fail("세이브에 온기 칸 없음");
                StoryCampfire.Restore(null);
                if (!StorySaveState.ApplyJson(json) || StoryCampfire.Warmth != "vanguard") Fail($"저장 왕복 {StoryCampfire.Warmth}");
                StoryCampfire.Restore("zz");
                if (StoryCampfire.HasWarmth) Fail("모르는 id 를 안 버림");
            }
            finally
            {
                StoryRunRank.ClearForTest();
                StorySaveState.ApplyJson(json0);
                StoryPartyState.Restore(party0);
                if (pl != null) Put(pl, cc, pos0);
            }
            if (_ok) Debug.Log($"{T} OK - 선봉 첫 타 ×1.1 한 번·체력 가득 · 유격 기운 가득 · 호법 체력 ×1.1 · 판 중 못 앉음·판 닫히면 사라짐 · 들머리 불(곁·다시 안 앉음·다녀오면) · 저장 |{m}");
            return _ok;
        }

        private static void Put(GameObject pl, CharacterController cc, Vector3 p)
        {
            if (cc != null) cc.enabled = false;
            pl.transform.position = p;
            if (cc != null) cc.enabled = true;
        }

        private static void Fail(string why)
        {
            _ok = false;
            Debug.LogError($"{T} FAIL - {why}");
        }
    }
}
