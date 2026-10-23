using System.Reflection;
using UnityEngine;
using Saga.Core;
using Saga.Dungeon.Data;

namespace Saga.EditorTools
{
    /// <summary>
    /// tasks U-0201 2나락 부대 우정(고돗 G-0341 짝) 진단 — `PlaytestDungeonHeadless` 가 신의 가호 뒤에 부른다(한 프레임 안).
    /// ① 공용 단계(Friendship — 0·20·50 경계·Lv 10 상한·묶음) ② 방 깸 +5·층 내려감 +10(둘 다) · 단 오름 알림 ③ 지기 처음 금 +500(한 번)
    /// ④ HUD 꼬리표 ⑤ 세이브 칸·왕복·옛 세이브 ⑥ 손잡이. 끝나면 우정·금을 시작 때로.
    /// </summary>
    public static class PlaytestDungeonBond
    {
        private const string T = "[PlaytestDungeonHeadless] bond";
        private static bool _ok, _step;

        public static bool Run()
        {
            _ok = true;
            string bond0 = DungeonBond.Snapshot();
            int gold0 = HeroState.Gold, earned0 = HeroState.GoldEarned;
            try
            {
                // ① 단계
                Begin();
                float[] pts = { 0, 19, 20, 50, 89, 650, 9999 };
                int[] lv = { 0, 0, 1, 2, 2, 10, 10 };
                for (int i = 0; i < pts.Length; i++) if (Friendship.LevelOf(pts[i]) != lv[i]) Fail($"{pts[i]}점 = Lv {Friendship.LevelOf(pts[i])} ≠ {lv[i]}");
                if (Friendship.TierOf(2) != 0 || Friendship.TierOf(3) != 1 || Friendship.TierOf(6) != 2 || Friendship.TierOf(9) != 3) Fail("묶음");
                if (Friendship.ToNext(25) != 25 || Friendship.ToNext(650) != 0) Fail("다음까지");
                End("tier OK - 20·50 경계 · Lv 10 상한 · 묶음 3·6·9 · 다음까지");

                // ② 방·층
                Begin();
                DungeonBond.ResetForTest();
                if (DungeonBond.Tag(PartyRole.Guard).Length != 0) Fail("0점인데 꼬리표");
                string r1 = "";
                for (int i = 0; i < 4; i++) r1 = DungeonBond.OnRoomCleared();
                if (DungeonBond.Pts(PartyRole.Guard) != 20f || DungeonBond.Pts(PartyRole.Mystic) != 20f) Fail($"방 넷 {DungeonBond.Pts(PartyRole.Guard)}·{DungeonBond.Pts(PartyRole.Mystic)}");
                if (!r1.Contains("Lv.1") || !r1.Contains("\n")) Fail($"넷째 방 알림「{r1}」");
                string f1 = DungeonBond.OnFloorDone();
                if (DungeonBond.Pts(PartyRole.Guard) != 30f || f1.Length != 0) Fail($"층 +10 → {DungeonBond.Pts(PartyRole.Guard)} · 알림「{f1}」");
                End($"room OK - 방 +5 · 층 +10(둘 다) · 넷째 방 Lv.1 알림「{r1.Split('\n')[0]}」");

                // ③ 지기 금
                Begin();
                int g = HeroState.Gold;
                string up = "";
                while (DungeonBond.Level(PartyRole.Guard) < 9) up = DungeonBond.OnFloorDone();
                if (HeroState.Gold != g + DungeonBond.KnotGold * 2) Fail($"지기 금 {HeroState.Gold - g}");
                if (!up.Contains("500")) Fail($"지기 알림「{up}」");
                int g2 = HeroState.Gold;
                while (DungeonBond.Level(PartyRole.Guard) < 10) DungeonBond.OnFloorDone();
                if (HeroState.Gold != g2) Fail("금 두 번");
                End($"knot OK - 지기 처음 금 +{DungeonBond.KnotGold}(둘 다 한 번) · 「{up.Split('\n')[0]}」");

                // ④ 꼬리표
                Begin();
                string tag = DungeonBond.Tag(PartyRole.Mystic);
                if (tag != " 💞10") Fail($"꼬리표「{tag}」");
                End($"hud OK - 술사 꼬리표「{tag}」");

                // ⑤ 세이브
                Begin();
                DungeonBond.ResetForTest();
                DungeonBond.OnRoomCleared();
                string snap = DungeonBond.Snapshot();
                if (!SaveState.ToJson().Contains("\"bondJson\"")) Fail("세이브에 bondJson 없음");
                DungeonBond.Restore(null);
                if (DungeonBond.Pts(PartyRole.Guard) != 0f) Fail("옛 세이브인데 점수");
                DungeonBond.Restore(snap);
                if (DungeonBond.Pts(PartyRole.Mystic) != 5f) Fail("왕복");
                DungeonBond.Restore("{\"pts\":[5],\"knot\":[false]}");
                if (DungeonBond.Pts(PartyRole.Guard) != 0f) Fail("길이 틀린 세이브를 받음");
                End("save OK - bondJson 왕복·옛 세이브 0·길이 틀리면 버림");

                // ⑥ 손잡이
                Begin();
                DungeonBond.ResetForTest();
                DungeonBond.On = false;
                DungeonBond.OnRoomCleared();
                if (DungeonBond.Pts(PartyRole.Guard) != 0f || DungeonBond.Tag(PartyRole.Guard).Length != 0) Fail("껐는데 우정");
                End("off OK - 끄면 점수·꼬리표 없음");
            }
            finally
            {
                DungeonBond.On = true;
                DungeonBond.Restore(bond0);
                SetProp("Gold", gold0);
                SetProp("GoldEarned", earned0);
            }
            return _ok;
        }

        private static void SetProp(string name, int v) =>
            typeof(HeroState).GetProperty(name, BindingFlags.Public | BindingFlags.Static).SetValue(null, v);

        private static void Begin() => _step = true;
        private static void End(string line) { if (_step) Debug.Log($"{T} {line}"); }

        private static void Fail(string why)
        {
            _ok = false;
            _step = false;
            Debug.LogError($"{T} FAIL - {why}");
        }
    }
}
