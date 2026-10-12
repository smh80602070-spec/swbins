using System.Collections.Generic;
using UnityEngine;
using Saga.Dungeon.Data;
using Saga.Dungeon.UI;
using Saga.Dungeon.World;

namespace Saga.EditorTools
{
    /// <summary>
    /// tasks U-0108 2나락 대상 적 카드 진단 — `PlaytestDungeonHeadless` 가 잡졸 명단(foes) 뒤에 부른다(한 프레임 안).
    /// 멀리 빈 자리(-7000, -7000)에 더미를 세우고 카드의 `Refresh(자리, 락온)` 를 직접 부른다:
    /// ① 적 없음 → 숨김 ② 5m 잡졸 → 보임·이름 = DisplayName·글자가 그려짐·보통 색·채움 1 ③ TakeDamage 뒤 채움 줄어듦 ④ 12m → 숨김 ·
    /// ⑤ 락온한 9m 적이 4m 적보다 먼저(락온 없으면 4m) ⑥ 정예 "정예 " + 푸른 이름 #6f6fff · 두목 노란 이름. 끝나면 더미를 지운다(락온은 건드리지 않음).
    /// </summary>
    public static class PlaytestDungeonFoeCard
    {
        private const string T = "[PlaytestDungeonHeadless] foecard";
        private static readonly Vector3 Far = new Vector3(-7000f, 0f, -7000f);
        private static bool _ok;
        private static readonly List<GameObject> Dummies = new List<GameObject>();

        public static bool Run()
        {
            _ok = true;
            var card = DungeonFoeCard.Instance != null ? DungeonFoeCard.Instance : DungeonFoeCard.Install();
            if (card == null) { Fail("카드 없음"); return false; }
            string m = "";
            try
            {
                // ① 적 없음
                card.Refresh(Far, null);
                if (card.IsShown || DungeonFoeCard.Pick(Far, null) != null) Fail("빈 자리인데 카드가 뜸");

                // ② 5m 잡졸
                var a = Dummy(Far + new Vector3(5f, 0f, 0f), "오랑캐 궁수", false);
                card.Refresh(Far, null);
                if (!card.IsShown || card.Target != a) Fail("5m 잡졸인데 카드가 안 뜸");
                if (card.NameText != a.DisplayName) Fail($"이름 {card.NameText} ≠ {a.DisplayName}");
                if (!Same(card.NameColor, DungeonFoeCard.NameNormal)) Fail($"보통 이름 색 {card.NameColor}");
                if (!Mathf.Approximately(card.Fill, 1f)) Fail($"채움 {card.Fill:0.00} ≠ 1");
                int ink = card.NameInkChars;
                if (ink == 0) Fail("이름 글자가 하나도 안 그려짐(줄 높이·넘침)");

                // ③ 맞으면 줄어듦
                a.TakeDamage(300f);
                card.Refresh(Far, null);
                float hurt = card.Fill;
                if (!(hurt < 0.999f) || Mathf.Abs(hurt - a.CurrentHp / a.MaxHp) > 1e-3f) Fail($"맞은 뒤 채움 {hurt:0.000}(체력 {a.CurrentHp}/{a.MaxHp})");

                // ④ 12m — 숨김
                Move(a, Far + new Vector3(12f, 0f, 0f));
                card.Refresh(Far, null);
                if (card.IsShown) Fail("12m 적인데 카드가 뜸");

                // ⑤ 락온 9m 가 4m 보다 먼저
                Move(a, Far + new Vector3(9f, 0f, 0f));
                var b = Dummy(Far + new Vector3(0f, 0f, 4f), "오랑캐 궁수", false);
                card.Refresh(Far, null);
                if (card.Target != b) Fail("락온 없을 때 4m 적이 아님");
                card.Refresh(Far, a);
                if (card.Target != a) Fail("락온한 9m 적보다 4m 적이 먼저");

                // ⑥ 정예·두목 색
                Object.DestroyImmediate(b.gameObject);
                var c = Dummy(Far + new Vector3(0f, 0f, 3f), "오랑캐 궁수", false);
                c.MarkElite();
                card.Refresh(Far, null);
                string elite = DungeonLocalization.T("foe.elite_prefix", "정예 ") + c.DisplayName;
                if (card.Target != c || card.NameText != elite || !Same(card.NameColor, DungeonFoeCard.NameElite)) Fail($"정예 {card.NameText}/{card.NameColor}");
                Object.DestroyImmediate(c.gameObject);
                var d = Dummy(Far + new Vector3(0f, 0f, 2f), "진단 두목", true);
                card.Refresh(Far, null);
                if (card.Target != d || !Same(card.NameColor, DungeonFoeCard.NameBoss)) Fail($"두목 색 {card.NameColor}");
                m = $" 글자 {ink}·채움 1→{hurt:0.00}·정예 {elite}";
            }
            finally
            {
                foreach (var g in Dummies) if (g != null) Object.DestroyImmediate(g);
                Dummies.Clear();
                card.Refresh(Far, null);
            }
            if (card.IsShown) Fail("더미를 지운 뒤에도 카드가 남음");
            if (_ok) Debug.Log($"{T} OK - 빈 자리 숨김·5m 보임(이름·글자 그려짐·색·채움 1)·맞으면 줄어듦·12m 숨김·락온 9m 먼저·정예 푸른 이름·두목 노란 이름 |{m}");
            return _ok;
        }

        private static DungeonEnemy Dummy(Vector3 at, string name, bool boss)
        {
            var go = new GameObject("FoeCardDummy");
            go.SetActive(false);
            go.transform.position = at;
            var e = go.AddComponent<DungeonEnemy>();
            e.SetSpawnContext("foecard_test", null);
            e.ConfigureCombat(1000f, 0f, 1, 1, null, null, boss, name, Color.white, 1f);
            go.SetActive(true);
            Dummies.Add(go);
            return e;
        }

        private static void Move(DungeonEnemy e, Vector3 p) => e.transform.position = p;

        private static bool Same(Color a, Color b) => Mathf.Abs(a.r - b.r) < 0.01f && Mathf.Abs(a.g - b.g) < 0.01f && Mathf.Abs(a.b - b.b) < 0.01f;

        private static void Fail(string why)
        {
            _ok = false;
            Debug.LogError($"{T} FAIL - {why}");
        }
    }
}
