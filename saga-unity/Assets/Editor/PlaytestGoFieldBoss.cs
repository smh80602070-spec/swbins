using System.Text.RegularExpressions;
using UnityEngine;
using Saga.Go.Combat;
using Saga.Go.Data;
using Saga.Go.Player;
using Saga.Go.World;

namespace Saga.EditorTools
{
    /// <summary>
    /// PLAN.md 109-14-10 "들판 보스"(웹 사가고 ⑲-10 진단 항목) — `PlaytestHeadless` 가 숨은 터 진단 뒤에 부른다.
    /// 첫 토벌(금·경험·꽃) · 꽃이 핀 동안 안 섬 · 카드(5.6m 안·★4·금) · 원기 모자라면 꽃이 남음 · 받기(원기 30·금 100 × 위험 3·★4 보패 하나) ·
    /// 149초엔 안 서고 150초에 섬 · 다시 쓰러뜨리면 금·경험 없이 꽃만 · 세이브 v27 왕복·v26 로드(쓰러뜨린 옛 세이브는 꽃이 핀 것으로).
    /// 시각은 진단이 붙든다. 끝나면 수호장 기록·원기·돈·레벨·보패·세이브 파일·자리를 되돌린다.
    /// </summary>
    public static class PlaytestGoFieldBoss
    {
        private static string _tag;
        private static bool _ok;

        public static bool Run(string tag)
        {
            _tag = tag;
            _ok = true;
            var fc = FieldCombat.Instance;
            var pc = fc != null ? fc.GetComponent<PlayerController>() : null;
            var bloom = GuardianBloom.Instance;
            var g = FieldEnemy.GuardianInstance;
            if (fc == null || pc == null || bloom == null || g == null) { Fail("FieldCombat/PlayerController/GuardianBloom/수호장 없음"); return false; }

            bool d0 = GuardianState.Defeated, b0 = GuardianState.Bloom;
            long p0 = GuardianState.PaidAt;
            var dom0 = DomainState.Snapshot();
            int gold0 = GoldState.Gold, lv0 = PlayerStats.Level, exp0 = PlayerStats.Exp;
            var arts0 = ArtifactState.Snapshot();
            int seq0 = ArtifactState.Seq, pol0 = ArtifactState.Polish;
            string savePath = System.IO.Path.Combine(Application.persistentDataPath, "save.json");
            string originalSave = System.IO.File.Exists(savePath) ? System.IO.File.ReadAllText(savePath) : null;
            try
            {
                GuardianState.NowForTest = 5_000_000;
                DomainState.NowForTest = 1_000_000_000;
                CheckFlow(fc, pc, bloom, g);
                CheckSave(savePath);
            }
            finally
            {
                if (originalSave != null) System.IO.File.WriteAllText(savePath, originalSave);
                else if (System.IO.File.Exists(savePath)) System.IO.File.Delete(savePath);
                GuardianState.NowForTest = -1;
                DomainState.NowForTest = -1;
                GuardianState.Restore(d0, b0, p0);
                DomainState.Restore(dom0.resin, dom0.t, dom0.claims, dom0.week, dom0.weekN);
                GoldState.Restore(gold0);
                PlayerStats.Restore(lv0, exp0);
                ArtifactState.Restore(arts0, seq0, pol0);
                if (!GuardianState.Standing && g.gameObject.activeSelf && g.Alive) g.gameObject.SetActive(false);
                bloom.Refresh();
                fc.ResetForTest();
                pc.Teleport(fc.SafePoint);
                foreach (var e in FieldEnemy.All) e.RestoreHomeForTest();
            }
            if (_ok) Debug.Log($"[{_tag}] field boss OK - 첫 토벌 금·경험·꽃 · 꽃 동안 안 섬 · 카드 · 원기 모자람 · 받기(원기 30·금 {GuardianBloom.GoldPerTier * 3}·★4) · 149초 안 섬·150초 섬 · 다시 잡으면 꽃만 · 세이브 v27 왕복·v26 로드");
            return _ok;
        }

        private static void Kill(FieldEnemy g)
        {
            for (int i = 0; i < 4 && g.Alive; i++)
            {
                if (g.Shielded) g.SetShieldForTest(0f);
                g.TakeRaw(g.Hp + 99999f, Color.white);
            }
        }

        private static void CheckFlow(FieldCombat fc, PlayerController pc, GuardianBloom bloom, FieldEnemy g)
        {
            GuardianState.Restore(false);
            bloom.Refresh();
            if (!g.gameObject.activeSelf || !g.Alive || bloom.FlowerShown) { Fail("안 쓰러뜨린 수호장이 안 섬·꽃"); return; }
            GoldState.Restore(0);
            PlayerStats.Restore(1, 0);
            int goldFirst = g.GuardianGoldNow;
            Kill(g);
            if (g.Alive || !GuardianState.Defeated || !GuardianState.Bloom || GuardianState.Standing) Fail("첫 토벌 기록·꽃");
            if (GoldState.Gold != goldFirst || (PlayerStats.Exp == 0 && PlayerStats.Level == 1)) Fail($"첫 토벌 금 {GoldState.Gold} ≠ {goldFirst}·경험");
            bloom.Refresh();
            if (!bloom.FlowerShown) Fail("꽃이 안 핌");
            g.Tick(GuardianState.BackSec + 60f);
            bloom.Refresh();
            if (g.Alive) Fail("꽃이 핀 동안 수호장이 섬");

            pc.Teleport(GuardianBloom.Spot + new Vector3(2f, 0.3f, 0f));
            DomainState.SetResinForTest(10);
            bloom.Refresh();
            if (!bloom.CardShown || !bloom.CardText.Contains("★4") || bloom.ClaimButton.interactable) Fail($"꽃 카드(원기 10) '{bloom.CardText}'");
            if (bloom.Claim(out _) != null || !GuardianState.Bloom) Fail("원기 10 으로 받음");
            DomainState.SetResinForTest(120);
            bloom.Refresh();
            int arts = ArtifactState.Count, gold = GoldState.Gold;
            bloom.ClaimButton.onClick.Invoke();
            var last = ArtifactState.All.Count > 0 ? ArtifactState.All[ArtifactState.All.Count - 1] : null;
            if (GuardianState.Bloom || GuardianState.PaidAt != GuardianState.Now || DomainState.Resin != 90) Fail($"받기 기록·원기 {DomainState.Resin}");
            if (GoldState.Gold != gold + GuardianBloom.GoldPerTier * 3 || ArtifactState.Count != arts + 1 || last == null || last.rarity != 4) Fail($"받기 보상 금 {GoldState.Gold - gold}·보패 {ArtifactState.Count - arts}");
            bloom.Refresh();
            if (bloom.FlowerShown || bloom.CardShown) Fail("받았는데 꽃·카드가 남음");

            GuardianState.NowForTest += GuardianState.BackSec - 1;
            bloom.Refresh();
            if (g.Alive) Fail("149초에 섬");
            GuardianState.NowForTest += 1;
            bloom.Refresh();
            if (!g.Alive || !g.gameObject.activeSelf) Fail("150초에 안 섬");

            gold = GoldState.Gold;
            int lv = PlayerStats.Level, exp = PlayerStats.Exp;
            Kill(g);
            if (GoldState.Gold != gold || PlayerStats.Level != lv || PlayerStats.Exp != exp || !GuardianState.Bloom) Fail("다시 잡았는데 금·경험이 나옴(꽃만이어야)");
            pc.Teleport(fc.SafePoint);
        }

        private static void CheckSave(string savePath)
        {
            GuardianState.Restore(true, true, 0);
            if (!SaveState.Save()) { Fail("SaveState.Save 실패"); return; }
            string json = System.IO.File.ReadAllText(savePath);
            if (!json.Contains("\"version\":29") || !json.Contains("\"guardianBloom\":true")) Fail("세이브 v27 에 꽃이 없다");
            GuardianState.Restore(true, false, 123);
            if (!SaveState.TryLoad() || !GuardianState.Bloom || GuardianState.PaidAt != 0) Fail("v27 왕복 뒤 꽃이 달라짐");
            string v26 = Regex.Replace(json.Replace("\"version\":29", "\"version\":26"), ",\"guardianBloom\":(true|false),\"guardianPaidAt\":\\d+", "");
            if (v26.Contains("guardianBloom")) { Fail("v26 가짜 파일 만들기 실패"); return; }
            System.IO.File.WriteAllText(savePath, v26);
            GuardianState.Restore(false);
            if (!SaveState.TryLoad() || !GuardianState.Defeated || !GuardianState.Bloom) Fail("v26(쓰러뜨림) 파일 — 꽃이 핀 것으로 안 읽힘");
        }

        private static void Fail(string msg)
        {
            _ok = false;
            Debug.LogError($"[{_tag}] field boss FAIL - {msg}");
        }
    }
}
