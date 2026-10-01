using System.Linq;
using System.Reflection;
using System.Text.RegularExpressions;
using UnityEngine;
using Saga.Go.Combat;
using Saga.Go.Data;
using Saga.Go.Player;
using Saga.Go.UI;
using Saga.Go.World;

namespace Saga.EditorTools
{
    /// <summary>`PlaytestGoStory` 의 일부(partial) — tasks U-0010 분할.</summary>
    public static partial class PlaytestGoStory
    {
        private static void CheckChapter29(FieldCombat fc, PlayerController pc, StoryField field, StoryUi ui)
        {
            _ch29 = "29장 중단";
            StoryState.OffForTest = false;
            PlayerStats.Restore(64, 0);
            StoryState.Restore(28, 0);
            var kf = KnotField.Instance;
            if (kf == null) { Fail("KnotField 없음"); return; }
            var party0 = new System.Collections.Generic.List<string>(PartyState.MemberIds);
            try
            {
                kf.Refresh();
                field.Refresh();
                Vector3 D(string n) => field.NpcBody(n).transform.position;
                if (!kf.EyeShown || !kf.PillarOn || !kf.SwirlShown || kf.MeadowShown) Fail("29장 앞: 먹구름 눈·기둥이 서고 소용돌이가 돌아야");
                for (int j = 0; j < 6; j++) if (kf.BeamNow(j) != 2) Fail($"29장 앞 매듭 {j} 줄이 눈 등불로 안 감");
                PartyState.Restore(new[] { "story_wanderer", "story_scholar" });
                Talk(pc, ui, "elder", "29장 촌장");
                Expect(28, 1, "촌장 뒤");                                                        // → 1 party 편성
                field.Check(pc.transform.position);
                Expect(28, 1, "두 시대뿐인데 편성 시험이 넘어감");
                ui.Refresh();
                if (!ui.TrackText.Contains("✗") || !ui.TrackText.Contains("✔")) Fail($"편성 줄에 시대 ✔/✗ 가 없음 '{ui.TrackText}'");
                PartyState.Restore(new[] { "story_wanderer", "story_scholar", "story_hanbyeol" });
                field.Check(pc.transform.position);
                Expect(28, 2, "세 시대 편성");                                                   // → 2 sky 눈
                StoryField.Target(out Vector3 st, out _);
                if (GoStory.Flat(st, GoStory.EyePillarPos) > 0.5f) Fail("sky 화살표가 구름섬 서쪽 눈 기둥이 아님");
                pc.Teleport(GoStory.GridPos(3f, 3f) + Vector3.up * 0.4f);
                field.Check(pc.transform.position);
                Expect(28, 2, "땅에서 눈 단계가 넘어감");
                pc.Teleport(GoStory.SkyCenter + Vector3.up * 0.3f);
                field.Check(pc.transform.position);
                Expect(28, 2, "구름섬 위에서 눈 단계가 넘어감");
                float reach = (GoStory.EyePillarTop - GoStory.EyeCenter.y) / PlayerController.GlideFallSpeed * PlayerController.GlideSpeed;
                if (reach < Mathf.Abs(GoStory.EyeCenter.x - GoStory.EyePillarPos.x) - (GoStory.EyeR - 1.5f)) Fail("눈 기둥 활공이 눈에 못 닿음");
                pc.Teleport(GoStory.EyePos(new Vector2(0f, 8f)) + Vector3.up * 0.3f);
                field.Check(pc.transform.position);
                Expect(28, 3, "먹구름 눈 윗면");                                                 // → 3 talk 임금
                field.Refresh();
                if (!field.NpcShown("gamyeon") || GoStory.Flat(D("gamyeon"), GoStory.EyePos(GoStory.EyeKing)) > 0.6f || !GoStory.OnEyeTop(D("gamyeon") + Vector3.up * 0.1f)) Fail("임금이 눈 북쪽에 안 섬");
                if (GoStory.NpcName("gamyeon") != GoLocalization.T("story.npc.king", "먹구름 임금") || GoStory.NpcShort("gamyeon") != GoLocalization.T("story.npc.king", "먹구름 임금")) Fail($"임금 이름 '{GoStory.NpcName("gamyeon")}'·'{GoStory.NpcShort("gamyeon")}'");
                Talk(pc, ui, "gamyeon", "29장 임금");
                Expect(28, 4, "임금 뒤");                                                        // → 4 defend 등불
                Vector3 lamp = GoStory.EyePos(Vector2.zero);
                pc.Teleport(lamp + new Vector3(0f, 0.3f, -GoStory.DefendStart - 5f));
                field.DefendTick(pc.transform.position, 0.1f);
                if (field.DefendWave != -1 || field.Squad.Count != 0) Fail("멀리서 물결이 옴");
                pc.Teleport(lamp + new Vector3(0f, 0.3f, 3f));
                field.DefendTick(pc.transform.position, 0.1f);
                if (field.DefendWave != 0 || field.Squad.Count != 3) { Fail($"등불 첫 물결 {field.DefendWave}·{field.Squad.Count}"); return; }
                foreach (var e in field.Squad) if (!GoStory.OnEyeTop(e.transform.position) && GoStory.Flat(e.transform.position, GoStory.EyeCenter) > GoStory.EyeR - 0.5f) Fail("물결이 눈 밖에서 나옴");
                for (int guard = 0; guard < 40 && StoryState.StepIndex == 4; guard++)
                {
                    field.DefendTick(pc.transform.position, 0.1f);
                    foreach (var e in new System.Collections.Generic.List<FieldEnemy>(field.Squad)) if (e.Alive) Kill(e);
                }
                Expect(28, 5, "등불 물결 셋");                                                   // → 5 duel 참몸
                field.Check(pc.transform.position);
                if (field.Squad.Count != 1) { Fail($"먹구름 임금 참몸 {field.Squad.Count}"); return; }
                var king = field.Squad[0];
                if (!king.IsStoryBoss || king.DisplayName != GoLocalization.T("story.boss.kingtrue", "먹구름 임금") || king.CurrentMove != FieldEnemy.BossMove.Slam) Fail($"참몸 이름·첫 수 {king.DisplayName}·{king.CurrentMove}");
                if (GoStory.Flat(king.transform.position, GoStory.EyePos(GoStory.EyeDuel)) > 3f || !GoStory.OnSkyLayer(king.transform.position)) Fail("참몸이 눈 남쪽에 안 섬");
                king.SetShieldForTest(0f);
                king.TakeRaw(king.Hp - king.MaxHp * 0.45f, Color.white);
                field.DuelTickForTest();
                if (!king.Shielded || field.Squad.Count != 3) Fail($"2단계 뇌 방패·졸개 {field.Squad.Count}");
                foreach (var e in field.Squad) if (!GoStory.OnSkyLayer(e.transform.position)) Fail("졸개가 눈 밖");
                Kill(king);
                Expect(28, 6, "먹구름 임금 참몸");                                              // → 6 talk 해솔
                kf.Refresh();
                if (kf.SwirlShown || !kf.MeadowShown) Fail("보스 뒤 소용돌이가 걷혀 맑은 뜰이어야");
                for (int j = 0; j < 6; j++) if (kf.BeamNow(j) != 0 || !kf.FireShown(j)) Fail($"보스 뒤 매듭 {j}: 줄을 거두고 불만 남아야");
                field.Refresh();
                if (!field.NpcShown("haesol") || GoStory.Flat(D("haesol"), GoStory.EyePos(GoStory.EyeHaesol)) > 0.6f) Fail("해솔이 눈 북동쪽에 안 섬");
                if (field.NpcShown("gamyeon")) Fail("보스 뒤 임금이 남음");
                Talk(pc, ui, "haesol", "29장 해솔");
                Expect(28, 7, "해솔 뒤");                                                        // → 7 go 광장
                Vector3 plaza = GoStory.GridPos(1.2f, 3.2f);
                pc.Teleport(GoStory.EyePos(Vector2.zero) + Vector3.up * 0.3f);
                field.Check(pc.transform.position);
                Expect(28, 7, "눈 위에서 광장 단계가 넘어감");
                pc.Teleport(plaza + Vector3.up * 0.4f);
                field.Check(pc.transform.position);
                Expect(28, 8, "청하 광장");                                                      // → 8 talk 촌장
                int gold = GoldState.Gold, knot = TalentState.Count(GoTalent.Mat.Knot), guide = TalentState.Count(GoTalent.Mat.Guide), secret = TalentState.Count(GoTalent.Mat.Secret);
                Talk(pc, ui, "elder", "29장 끝 촌장");
                if (StoryState.Ch != 29 || GoldState.Gold != gold + 12000 || TalentState.Count(GoTalent.Mat.Knot) != knot + 10 || TalentState.Count(GoTalent.Mat.Guide) != guide + 10 || TalentState.Count(GoTalent.Mat.Secret) != secret + 8) Fail("29장 끝·보상(금 12000·교본 10·비급 8·매듭 10)");
                if (StoryState.Done || !StoryState.Locked) Fail("29장 뒤 30장이 여정 등급 66 에 열리는 잠김이어야 함(1차 결말 — 9부가 이어진다)");
                kf.Refresh();
                if (kf.SwirlShown || !kf.MeadowShown) Fail("29장 뒤 눈이 맑은 뜰로 남아야");
                _ch29 = "29장 편성 시험(두 시대 ✕·세 시대 ○·줄에 시대 ✔/✗)·눈 기둥 sky(땅·구름섬 ✕·눈 윗면 ○)·임금 이름 덮음·등불 지키기 물결 셋(눈 안)·참몸 뇌 2단계 방패(눈 남쪽)·소용돌이 걷힘·줄 거둠·해솔 눈 북동쪽·광장 go(눈 위 ✕)·보상(🪢 10)·이야기 표 끝";
            }
            finally { PartyState.Restore(party0); }
        }

        // ---- 30장 ---------------------------------------------------------------------------------------------

        private static void CheckChapter30(FieldCombat fc, PlayerController pc, StoryField field, StoryUi ui)
        {
            _ch30 = "30장 중단";
            StoryState.OffForTest = false;
            PlayerStats.Restore(66, 0);
            var area = AreaField.Instance;
            var am = GoAreas.Amber;
            if (area == null) { Fail("AreaField 없음"); return; }
            StoryState.Restore(28, 0);
            field.Refresh();
            if (field.NpcShown("chorong")) Fail("30장 앞인데 초롱이 섬");
            StoryState.Restore(29, 0);
            area.Refresh();
            field.Refresh();
            if (StoryState.Done) Fail("30장 앞이 끝으로 셈");
            Vector3 D(string id) => field.NpcBody(id).transform.position;
            if (!field.NpcShown("hanbyeol") || GoStory.Flat(D("hanbyeol"), GoStory.AreaPos("skyport:port", GoStory.SunkPortHanbyeol)) > 0.6f) Fail("30장 첫 단계: 한별이 은하 나루 별배 곁에 안 섬");
            if (!field.NpcShown("bandi") || GoStory.Flat(D("bandi"), GoStory.AreaPos("skyport:port", GoStory.PortBandi)) > 0.6f) Fail("30장 첫 단계: 반디가 착륙판에 안 섬");
            if (!field.NpcShown("chorong") || GoStory.Flat(D("chorong"), GoStory.AreaPos("amber:clock", GoStory.ChorongAt)) > 0.6f || !am.Contains(D("chorong"))) Fail("초롱이 시계방 서쪽 앞에 안 섬");
            for (int i = 0; i < 3; i++) if (!area.AmberPartOn("amber:crystal" + i)) Fail($"30장 앞인데 굳은 자리 {i} 가 녹아 있음");
            Talk(pc, ui, "hanbyeol", "30장 한별");
            Expect(29, 1, "한별 뒤");                                                            // → 1 go 고개 어귀
            field.Refresh();
            if (GoStory.Flat(D("bandi"), GoStory.AreaPos("amber:clock", GoStory.ChorongBandi)) > 0.6f) Fail("한별 뒤 반디가 시계방 남서쪽으로 안 옮김");
            Vector3 mouth = GoStory.AreaPos("amber:pass", GoStory.AmberPassGo);
            if (!am.Contains(mouth) || GoStory.Flat(mouth, am.GateSiteObj.Pos) < 20f) Fail("고개 어귀 자리가 땅 안·경계비 곁이 아님");
            pc.Teleport(GoAreas.Skyport.Center + new Vector3(0f, 0.4f, 0f));
            field.Check(pc.transform.position);
            Expect(29, 1, "은하 나루에서 어귀 단계가 넘어감");
            pc.Teleport(am.ArrivalPos + new Vector3(0f, 0.4f, 0f));
            field.Check(pc.transform.position);
            Expect(29, 1, "돌기둥으로 막 들어섰는데 어귀 단계가 넘어감(경계비 곁은 어귀가 아님)");
            pc.Teleport(mouth + new Vector3(0f, 0.4f, 0f));
            field.Check(pc.transform.position);
            Expect(29, 2, "고개 어귀");                                                          // → 2 kill 네거리
            Vector3 cross = GoStory.AreaPos("amber:cross", GoStory.AmberCrossKill);
            pc.Teleport(cross + new Vector3(0f, 0.4f, GoStory.KillNear - 15f));
            field.Check(pc.transform.position);
            if (field.Squad.Count != 4 || field.Squad.Any(e => !am.Contains(e.transform.position))) Fail($"네거리 무리 {field.Squad.Count}");
            foreach (var e in new System.Collections.Generic.List<FieldEnemy>(field.Squad)) Kill(e);
            Expect(29, 3, "네거리 결정 짐승");                                                   // → 3 talk 초롱
            Talk(pc, ui, "chorong", "30장 초롱");
            Expect(29, 4, "초롱 뒤");                                                            // → 4 light 신호등 앞
            for (int i = 0; i < 3; i++)
            {
                Vector3 spot = GoStory.AreaPos("amber:cross", GoStory.AmberCrystalAt[i]);
                if (GoStory.Flat(GoStory.TargetOf(StoryState.Current, out _), spot) > 0.1f) Fail($"굳은 자리 {i} 단계 목표 자리");
                area.Refresh();
                for (int k = 0; k < 3; k++) if (area.AmberPartOn("amber:crystal" + k) != (k >= i)) Fail($"굳은 자리 {i} 앞인데 결정 {k} 상태 {area.AmberPartOn("amber:crystal" + k)}");
                pc.Teleport(spot + new Vector3(4f, 0.4f, 0f));
                Pulse(spot + new Vector3(12f, 0f, 0f), 3f);                                      // 멀리서 쏜 원소는 안 닿는다
                Expect(29, 4 + i, $"굳은 자리 {i} — 멀리서 쏜 원소로 녹음");
                Pulse(spot, 3f);
                Expect(29, 5 + i, $"굳은 자리 {i} 녹임");
                area.Refresh();
                if (area.AmberPartOn("amber:crystal" + i)) Fail($"굳은 자리 {i} 를 녹였는데 결정이 남음");
                for (int k = i + 1; k < 3; k++) if (!area.AmberPartOn("amber:crystal" + k)) Fail($"굳은 자리 {i} 뒤에 결정 {k} 가 미리 녹음");
            }
            if (area.AmberLampsGreen || !area.AmberPartOn("amber:dome") || !area.AmberPartOn("amber:heart")) Fail("굳은 자리 셋 뒤 신호등·돔·심장이 벌써 풀림(다음 장 몫)");
            Expect(29, 7, "굳은 자리 셋 뒤");                                                    // → 7 talk 초롱
            field.Refresh();
            int gold = GoldState.Gold, knot = TalentState.Count(GoTalent.Mat.Knot), guide = TalentState.Count(GoTalent.Mat.Guide), secret = TalentState.Count(GoTalent.Mat.Secret);
            Talk(pc, ui, "chorong", "30장 끝 초롱");
            if (StoryState.Ch != 30 || GoldState.Gold != gold + 7750 || TalentState.Count(GoTalent.Mat.Knot) != knot + 7 || TalentState.Count(GoTalent.Mat.Guide) != guide + 7 || TalentState.Count(GoTalent.Mat.Secret) != secret + 6) Fail("30장 끝·보상(금 7750·교본 7·비급 6·매듭 7)");
            field.Refresh();
            if (!field.NpcShown("chorong") || !field.NpcShown("bandi") || !field.NpcShown("hanbyeol")) Fail("30장 뒤 초롱·반디·한별이 안 섬");
            if (GoStory.Flat(D("chorong"), GoStory.AreaPos("amber:clock", GoStory.ChorongAt)) > 0.6f || GoStory.Flat(D("bandi"), GoStory.AreaPos("amber:clock", GoStory.ChorongBandi)) > 0.6f) Fail("30장 뒤 초롱·반디 자리");
            _ch30 = "30장 한별 나루 곁·반디 착륙판→시계방·고개 어귀 go(나루·경계비 곁에선 안 넘어감)·네거리 무리 넷(땅 안)·초롱 시계방 서쪽·굳은 자리 셋 차례로 녹음(멀리서 쏜 원소 ✕·다음 결정 미리 안 녹음)·신호등·돔·심장 그대로·보상";
        }

        // ---- 31장 ---------------------------------------------------------------------------------------------

        private static void CheckChapter31(FieldCombat fc, PlayerController pc, StoryField field, StoryUi ui)
        {
            _ch31 = "31장 중단";
            StoryState.OffForTest = false;
            PlayerStats.Restore(68, 0);
            StoryState.Restore(30, 0);
            var area = AreaField.Instance;
            var am = GoAreas.Amber;
            if (area == null) { Fail("AreaField 없음"); return; }
            area.Refresh();
            field.Refresh();
            Vector3 D(string id) => field.NpcBody(id).transform.position;
            Vector3 market = GoStory.AreaPos("amber:market", Vector2.zero);
            if (!field.NpcShown("chorong") || GoStory.Flat(D("chorong"), GoStory.AreaPos("amber:clock", GoStory.ChorongAt)) > 0.6f) Fail("31장 첫 단계: 초롱이 시계방 앞에 안 섬");
            if (field.NpcShown("neoul") || field.NpcShown("partthief")) Fail("31장 앞인데 너울·도둑이 섬");
            if (!area.AmberPartOn("amber:dome") || area.AmberLampsGreen || area.AmberWinding) Fail("31장 앞 돔·신호등·바늘 처음 모습");
            Talk(pc, ui, "chorong", "31장 초롱");
            Expect(30, 1, "초롱 뒤");                                                            // → 1 seal 석등
            field.Refresh();
            if (GoStory.Flat(D("chorong"), GoStory.AreaPos("amber:market", GoStory.ChorongMarket)) > 0.6f) Fail("초롱이 장터 동쪽 앞으로 안 옮김");
            if (!field.SealCenterOf(30).gameObject.activeSelf || field.SealLampOf(30, 0).Lit) Fail("장터 석등이 꺼진 채 안 섬");
            for (int i = 0; i < 3; i++)
            {
                Vector3 lp = field.SealLampOf(30, i).transform.position;
                if (GoStory.Flat(lp, market) > GoStory.SealR + 1f || GoStory.Flat(lp, market) < GoStory.AmberDomeR + 2f || !am.Contains(lp)) Fail($"장터 석등 {i} 자리(돔 밖 고리) {GoStory.Flat(lp, market):0.0}m");
            }
            int Lamp(string id) => System.Array.IndexOf(GoStory.SealLayout, id);
            Vector3 L(string id) => field.SealLampOf(30, Lamp(id)).transform.position;
            Pulse(L("star"), 1f);                                                                // 틀림(첫째는 해)
            if (StoryState.Progress != 0 || field.SealLampOf(30, Lamp("star")).Lit) Fail("차례 틀린 별이 켜짐(해·달·별)");
            Pulse(L("sun"), 1f);
            Pulse(L("moon"), 1f);
            Expect(30, 1, "둘 켰는데 넘어감");
            Pulse(L("star"), 1f);
            Expect(30, 2, "해·달·별");                                                           // → 2 talk 너울(돔이 깨진다)
            area.Refresh();
            field.Refresh();
            if (area.AmberPartOn("amber:dome") || !area.AmberPartOn("amber:heart") || area.AmberLampsGreen) Fail("석등을 켠 뒤 돔만 깨져야(심장·신호등은 그대로)");
            if (!field.NpcShown("neoul") || GoStory.Flat(D("neoul"), GoStory.AreaPos("amber:market", GoStory.NeoulAt)) > 0.6f) Fail("너울이 장터 가운데에 안 섬");
            Talk(pc, ui, "neoul", "31장 너울");
            Expect(30, 3, "너울 뒤");                                                            // → 3 chase 조각 도둑
            field.Refresh();
            if (!field.NpcShown("partthief")) Fail("조각 도둑이 안 보임");
            float len = 0f;
            for (int i = 1; i < GoStory.AmberThiefPath.Length; i++) len += GoStory.Flat(GoStory.RunPoint("partthief", i - 1), GoStory.RunPoint("partthief", i));
            float avg = len / (len / GoStory.ChaseSpeed + GoStory.ChasePause * (GoStory.AmberThiefPath.Length - 2));
            if (avg <= 6f || avg >= 10f) Fail($"도둑 평균 {avg:0.0}m/초");
            Physics.SyncTransforms();
            for (int i = 0; i < GoStory.AmberThiefPath.Length; i++)
            {
                Vector3 a0 = GoStory.RunPoint("partthief", i), a1 = GoStory.RunPoint("partthief", (i + 1) % GoStory.AmberThiefPath.Length);
                if (!am.Contains(a0)) Fail($"도둑 길 {i} 이 땅 밖");
                for (float f = 0f; f <= 1f; f += 0.05f)
                {
                    Vector3 pt = Vector3.Lerp(a0, a1, f);
                    if (Physics.CheckSphere(pt + Vector3.up * 1.6f, 0.9f)) { Fail($"도둑 길 {i} 곁에 충돌(시계방·신상·결정·장터…) {pt}"); break; }
                }
            }
            Vector3 t0 = GoStory.RunPoint("partthief", 0);
            Vector3 me = t0 + new Vector3(3f, 0f, 8f);
            if (RunAfter(field, ref me, 6f) || StoryState.StepIndex != 3) Fail("걸어서 쫓았는데 잡음");
            me = t0 + new Vector3(3f, 0f, 8f);
            field.ChaseTick(me, 0.05f);
            if (!field.ChaseRunning) Fail("가까이 갔는데 도둑이 안 달아남");
            if (!RunAfter(field, ref me, 10f)) Fail("달렸는데 도둑을 못 잡음");
            Expect(30, 4, "도둑 잡음");                                                          // → 4 talk 너울
            field.Refresh();
            if (field.NpcShown("partthief")) Fail("잡은 뒤 도둑이 남음");
            Talk(pc, ui, "neoul", "31장 너울 저울추");
            Expect(30, 5, "너울 저울추");                                                        // → 5 defend 괘종시계
            area.Refresh();
            if (!area.AmberWinding) Fail("괘종시계 지키기 중인데 바늘이 안 돎");
            Vector3 clockAlt = GoStory.AreaPos("amber:clock", GoStory.ClockDefend);
            pc.Teleport(clockAlt + new Vector3(0f, 0.3f, -GoStory.DefendStart - 5f));
            field.DefendTick(pc.transform.position, 0.1f);
            if (field.DefendWave != -1 || field.Squad.Count != 0) Fail("멀리서 물결이 옴");
            pc.Teleport(clockAlt + new Vector3(0f, 0.3f, 2f));
            field.DefendTick(pc.transform.position, 0.1f);
            if (field.DefendWave != 0 || field.Squad.Count != 3) { Fail($"괘종시계 첫 물결 {field.DefendWave}·{field.Squad.Count}"); return; }
            foreach (var e in field.Squad)
            {
                Vector3 d = e.transform.position - clockAlt;
                float bearing = Mathf.Repeat(Mathf.Atan2(d.x, -d.z) * Mathf.Rad2Deg, 360f);
                if (!am.Contains(e.transform.position)) Fail("물결이 굳은 거리 밖에서 나옴");
                if (bearing > 50f && bearing < 130f) Fail($"물결이 시계방 쪽(동)에서 나옴 {bearing:0}°");
            }
            for (int guard = 0; guard < 40 && StoryState.StepIndex == 5; guard++)
            {
                field.DefendTick(pc.transform.position, 0.1f);
                foreach (var e in new System.Collections.Generic.List<FieldEnemy>(field.Squad)) if (e.Alive) Kill(e);
            }
            Expect(30, 6, "괘종시계 물결 셋");                                                   // → 6 talk 초롱
            area.Refresh();
            field.Refresh();
            if (area.AmberWinding) Fail("지킨 뒤에도 바늘이 돎");
            if (GoStory.Flat(D("chorong"), GoStory.AreaPos("amber:clock", GoStory.ChorongAt)) > 0.6f) Fail("초롱이 시계방 앞에 안 돌아옴");
            int gold = GoldState.Gold, knot = TalentState.Count(GoTalent.Mat.Knot), guide = TalentState.Count(GoTalent.Mat.Guide), secret = TalentState.Count(GoTalent.Mat.Secret);
            Talk(pc, ui, "chorong", "31장 끝 초롱");
            if (StoryState.Ch != 31 || GoldState.Gold != gold + 8000 || TalentState.Count(GoTalent.Mat.Knot) != knot + 7 || TalentState.Count(GoTalent.Mat.Guide) != guide + 7 || TalentState.Count(GoTalent.Mat.Secret) != secret + 6) Fail("31장 끝·보상(금 8000·교본 7·비급 6·매듭 7)");
            area.Refresh();
            field.Refresh();
            if (area.AmberPartOn("amber:dome") || !area.AmberPartOn("amber:heart") || area.AmberLampsGreen) Fail("31장 뒤 돔은 깨진 채·심장·신호등은 그대로");
            if (!field.NpcShown("neoul") || !field.NpcShown("chorong") || GoStory.Flat(D("neoul"), GoStory.AreaPos("amber:market", GoStory.NeoulAt)) > 0.6f) Fail("31장 뒤 너울·초롱 자리");
            _ch31 = "31장 초롱 시계방→장터 동쪽·장터 석등 해·달·별(틀린 차례 ✕·돔 밖 고리)·돔 깨짐·너울 장터 가운데·조각 도둑 길(11점 땅 안·충돌 없음·평균 속도)·걸어선 못 잡고 달려서 잡음·괘종시계 지키기 물결 셋(동쪽 뺌·굳은 거리 안)·바늘 돎(그 단계만)·보상";
        }

        // ---- 32장 ---------------------------------------------------------------------------------------------

        private static void CheckChapter32(FieldCombat fc, PlayerController pc, StoryField field, StoryUi ui)
        {
            _ch32 = "32장 중단";
            StoryState.OffForTest = false;
            PlayerStats.Restore(70, 0);
            StoryState.Restore(31, 0);
            var area = AreaField.Instance;
            var am = GoAreas.Amber;
            if (area == null) { Fail("AreaField 없음"); return; }
            area.Refresh();
            field.Refresh();
            Vector3 D(string id) => field.NpcBody(id).transform.position;
            Vector3 towerPos = GoStory.AreaPos("amber:tower", Vector2.zero);
            if (!field.NpcShown("saegil") || GoStory.Flat(D("saegil"), GoStory.AreaPos("amber:tower", GoStory.SaegilAt)) > 0.6f) Fail("새길이 탑 발치 남쪽에 안 섬");
            if (!area.AmberPartOn("amber:heart") || area.AmberLampsGreen) Fail("32장 앞 심장·신호등 처음 모습");
            Talk(pc, ui, "saegil", "32장 새길");
            Expect(31, 1, "새길 뒤");                                                            // → 1 climb 탑
            Physics.SyncTransforms();
            Vector3 top = GoStory.ClimbTopOf("amber:tower");
            var core = area.SiteObject("amber", "tower").transform.Find("Tower_core");
            if (Mathf.Abs(top.y - GoStory.AmberTowerHeight - towerPos.y) > 0.1f) Fail("탑 꼭대기 높이 표");
            if (core == null || core.GetComponent<Collider>() == null || Mathf.Abs(core.GetComponent<Collider>().bounds.max.y - top.y) > 0.1f) Fail("부양탑 심 충돌·윗면이 꼭대기 표와 안 맞음");
            if (!Physics.Raycast(top + new Vector3(-GoStory.AmberTowerHalf - 4f, -6f, 0f), Vector3.right, 4f)) Fail("부양탑이 곧은 벽이 아니다");
            pc.Teleport(towerPos + new Vector3(8f, 0.4f, 0f));
            field.Check(pc.transform.position);
            Expect(31, 1, "땅에서 탑 오르기 단계가 넘어감");
            pc.Teleport(top + new Vector3(0f, 0.3f, 0f));
            field.Check(pc.transform.position);
            Expect(31, 2, "탑 꼭대기");                                                          // → 2 light 태엽 심장
            pc.Teleport(towerPos + new Vector3(8f, 0.4f, 0f));                                   // 땅에서는 불이 안 닿는다
            Pulse(towerPos, 4f);
            Expect(31, 2, "땅에서 쏜 원소로 태엽 심장이 녹음");
            area.Refresh();
            if (!area.AmberPartOn("amber:heart")) Fail("땅에서 쏘았는데 심장이 녹음");
            pc.Teleport(top + new Vector3(0f, 0.3f, 0f));
            Pulse(towerPos, 1f);
            Expect(31, 3, "꼭대기에서 태엽 심장");                                               // → 3 talk 새길
            area.Refresh();
            field.Refresh();
            if (area.AmberPartOn("amber:heart") || area.AmberLampsGreen) Fail("심장을 녹인 뒤 심장만 꺼지고 신호등은 아직 빨강이어야");
            Talk(pc, ui, "saegil", "32장 새길 발치");
            Expect(31, 4, "새길 발치");                                                          // → 4 duel 거북
            field.Check(pc.transform.position);
            if (field.Squad.Count != 1) { Fail($"호박 등딱지 거북 {field.Squad.Count}"); return; }
            var turtle = field.Squad[0];
            if (!turtle.IsStoryBoss || turtle.DisplayName != GoLocalization.T("story.boss.turtle", "호박 등딱지 거북") || turtle.Element != GoElement.Geo || turtle.CurrentMove != FieldEnemy.BossMove.Slam) Fail($"거북 이름·암·첫 수 {turtle.DisplayName}·{turtle.Element}·{turtle.CurrentMove}");
            if (!am.Contains(turtle.transform.position) || GoStory.Flat(turtle.transform.position, GoStory.AreaPos("amber:tower", GoStory.AmberTurtleAt)) > 12f) Fail("거북이 탑 밑 광장이 아님");
            turtle.SetShieldForTest(0f);
            turtle.TakeRaw(turtle.Hp - turtle.MaxHp * 0.45f, Color.white);
            field.DuelTickForTest();
            if (!turtle.Shielded || turtle.Element != GoElement.Geo || field.Squad.Count != 3) Fail($"2단계 암 방패·졸개 {turtle.Element}·{field.Squad.Count}");
            Kill(turtle);
            Expect(31, 5, "호박 등딱지 거북");                                                   // → 5 talk 초롱
            area.Refresh();
            field.Refresh();
            if (!area.AmberLampsGreen) Fail("거북을 쓰러뜨린 뒤 신호등이 초록이 안 됨");
            if (!field.NpcShown("chorong") || GoStory.Flat(D("chorong"), GoStory.AreaPos("amber:tower", GoStory.ChorongTower)) > 0.6f) Fail("초롱이 탑 밑 광장에 안 섬");
            int gold = GoldState.Gold, knot = TalentState.Count(GoTalent.Mat.Knot), guide = TalentState.Count(GoTalent.Mat.Guide), secret = TalentState.Count(GoTalent.Mat.Secret);
            Talk(pc, ui, "chorong", "32장 끝 초롱");
            if (StoryState.Ch != 32 || GoldState.Gold != gold + 9000 || TalentState.Count(GoTalent.Mat.Knot) != knot + 8 || TalentState.Count(GoTalent.Mat.Guide) != guide + 8 || TalentState.Count(GoTalent.Mat.Secret) != secret + 7) Fail("32장 끝·보상(금 9000·교본 8·비급 7·매듭 8)");
            if (!PartyState.Has("story_chorong")) Fail("초롱이 합류 안 함");
            bool ko = GoKits.OffForTest;
            GoKits.OffForTest = false;
            var kit = GoKits.KitOf("story_chorong", GoElement.Geo);
            GoKits.OffForTest = ko;
            if (!GoHeroes.TryGet("story_chorong", out var hh) || hh.Era != HeroEra.Story || hh.Rarity != 4 || GoHeroes.ElementOf(hh) != GoElement.Geo || hh.Trait != HeroTrait.Wisdom || GoWeapons.TypeOf("story_chorong") != GoWeapons.Type.Catalyst || GoStory.MemberEra("story_chorong") != GoEra.Modern) Fail("초롱 표(★4 암 법구 지략·현대)");
            if (kit == null || !kit.Sig || kit.Skill.Type != KitSkillType.Zone || kit.Burst.Type != KitBurstType.Rain || Mathf.Abs(kit.Skill.R - 5f) > 0.01f) Fail("초롱 한 벌(태엽 괘종 zone·되감은 시간 rain)");
            area.Refresh();
            field.Refresh();
            if (area.AmberPartOn("amber:heart") || !area.AmberLampsGreen) Fail("9부 뒤 태엽 심장은 꺼지고 신호등은 초록이어야");
            if (!field.NpcShown("saegil") || !field.NpcShown("chorong") || !field.NpcShown("neoul") || !field.NpcShown("bandi") || !field.NpcShown("hanbyeol")) Fail("9부 뒤 새길·초롱·너울·반디·한별이 안 섬");
            _ch32 = "32장 새길 탑 발치·부양탑 12m 벽/꼭대기(땅에선 안 넘어감)·태엽 심장은 꼭대기에서만(땅에서 쏘면 안 녹음)·심장 꺼짐(신호등은 아직 빨강)·호박 등딱지 거북 암 2단계 방패·신호등 초록·초롱 탑 밑 광장·초롱 합류(★4 암 법구 zone·rain)·보상";
        }

        // ---- 33장 ---------------------------------------------------------------------------------------------

        private static void CheckChapter33(FieldCombat fc, PlayerController pc, StoryField field, StoryUi ui)
        {
            _ch33 = "33장 중단";
            StoryState.OffForTest = false;
            PlayerStats.Restore(72, 0);
            StoryState.Restore(32, 0);
            var area = AreaField.Instance;
            var vt = GoAreas.Vault;
            if (area == null) { Fail("AreaField 없음"); return; }
            area.Refresh();
            field.Refresh();
            Vector3 D(string id) => field.NpcBody(id).transform.position;
            if (!field.NpcShown("bandi") || GoStory.Flat(D("bandi"), GoStory.AreaPos("amber:clock", GoStory.ChorongBandi)) > 0.6f) Fail("33장 첫 단계: 반디가 굳은 거리 시계방 곁에 안 섬");
            if (!field.NpcShown("maru") || GoStory.Flat(D("maru"), GoStory.AreaPos("vault:yard", GoStory.MaruAt)) > 0.6f || !vt.Contains(D("maru"))) Fail("마루가 야적장 창고 앞에 안 섬");
            if (field.NpcShown("carrier") || field.NpcShown("haram")) Fail("33장 첫 단계인데 드론·하람이 섬");
            if (!vt.Open()) Fail("9부 뒤인데 갈무리 벌이 안 열림");
            Talk(pc, ui, "bandi", "33장 반디");
            Expect(32, 1, "반디 뒤");                                                            // → 1 talk 하람
            field.Refresh();
            if (!field.NpcShown("haram") || GoStory.Flat(D("haram"), GoStory.FrostPos(GoStory.HaramObs)) > 0.6f || !GoFrost.Contains(D("haram"))) Fail("하람이 고원 관측소에 안 섬");
            if (GoStory.Flat(D("bandi"), GoStory.FrostPos(GoStory.BandiObs)) > 0.6f) Fail("반디가 하람 곁에 안 섬");
            Talk(pc, ui, "haram", "33장 하람");
            Expect(32, 2, "하람 뒤");                                                            // → 2 go 벌 어귀
            field.Refresh();
            if (GoStory.Flat(D("bandi"), GoStory.AreaPos("vault:yard", GoStory.VaultBandi)) > 0.6f) Fail("반디가 벌 창고 앞에 안 섬");
            Vector3 mouth = GoStory.AreaPos("vault:pass", GoStory.VaultPassGo);
            if (!vt.Contains(mouth) || GoStory.Flat(mouth, vt.ArrivalPos) < GoStory.GoR + 2f) Fail("벌 어귀 자리가 땅 안·돌기둥 도착 자리에서 걸어갈 거리가 아님");
            pc.Teleport(GoFrost.Center + new Vector3(0f, 0.4f, 0f));
            field.Check(pc.transform.position);
            Expect(32, 2, "고원에서 어귀 단계가 넘어감");
            pc.Teleport(vt.ArrivalPos + new Vector3(0f, 0.4f, 0f));
            field.Check(pc.transform.position);
            Expect(32, 2, "돌기둥으로 막 들어섰는데 어귀 단계가 넘어감");
            pc.Teleport(mouth + new Vector3(0f, 0.4f, 0f));
            field.Check(pc.transform.position);
            Expect(32, 3, "벌 어귀");                                                            // → 3 kill 야적장
            Vector3 yardKill = GoStory.AreaPos("vault:yard", GoStory.VaultYardKill);
            pc.Teleport(yardKill + new Vector3(0f, 0.4f, GoStory.KillNear - 15f));
            field.Check(pc.transform.position);
            if (field.Squad.Count != 4 || field.Squad.Any(e => !vt.Contains(e.transform.position))) Fail($"야적장 무리 {field.Squad.Count}");
            foreach (var e in new System.Collections.Generic.List<FieldEnemy>(field.Squad)) Kill(e);
            Expect(32, 4, "야적장 결정 짐승");                                                   // → 4 chase 운반 드론
            field.Refresh();
            if (!field.NpcShown("carrier")) Fail("운반 드론이 야적장에 안 섬");
            float len = 0f;
            for (int i = 1; i < GoStory.VaultDronePath.Length; i++) len += GoStory.Flat(GoStory.RunPoint("carrier", i - 1), GoStory.RunPoint("carrier", i));
            float avg = len / (len / GoStory.ChaseSpeed + GoStory.ChasePause * (GoStory.VaultDronePath.Length - 2));
            if (avg <= 6f || avg >= 10f) Fail($"드론 평균 {avg:0.0}m/초");
            Physics.SyncTransforms();
            for (int i = 0; i + 1 < GoStory.VaultDronePath.Length; i++)
            {
                Vector3 a0 = GoStory.RunPoint("carrier", i), a1 = GoStory.RunPoint("carrier", i + 1);
                if (!vt.Contains(a0)) Fail($"드론 길 {i} 이 땅 밖");
                for (float f = 0f; f <= 1f; f += 0.05f)
                {
                    Vector3 pt = Vector3.Lerp(a0, a1, f);
                    if (Physics.CheckSphere(pt + Vector3.up * 1.6f, 0.9f)) { Fail($"드론 길 {i} 곁에 충돌(창고·컨테이너·동력 기둥·금고 벽…) {pt}"); break; }
                }
            }
            vt.TrySite("vault", out var vaultSite);
            if (GoStory.Flat(GoStory.RunPoint("carrier", GoStory.VaultDronePath.Length - 1), vaultSite.Pos + new Vector3(0f, 0f, GoStory.VaultR)) > 6f) Fail("드론 길 끝이 금고 문 앞이 아님");
            Vector3 t0 = GoStory.RunPoint("carrier", 0);
            Vector3 me = t0 + new Vector3(3f, 0f, 8f);
            if (RunAfter(field, ref me, 6f) || StoryState.StepIndex != 4) Fail("걸어서 쫓았는데 잡음");
            me = t0 + new Vector3(3f, 0f, 8f);
            field.ChaseTick(me, 0.05f);
            if (!field.ChaseRunning) Fail("가까이 갔는데 드론이 안 달아남");
            if (!RunAfter(field, ref me, 10f)) Fail("달렸는데 드론을 못 잡음");
            Expect(32, 5, "드론 잡음");                                                          // → 5 talk 마루
            field.Refresh();
            if (field.NpcShown("carrier")) Fail("잡은 뒤 드론이 남음");
            int gold = GoldState.Gold, knot = TalentState.Count(GoTalent.Mat.Knot), guide = TalentState.Count(GoTalent.Mat.Guide), secret = TalentState.Count(GoTalent.Mat.Secret);
            Talk(pc, ui, "maru", "33장 끝 마루");
            if (StoryState.Ch != 33 || GoldState.Gold != gold + 8500 || TalentState.Count(GoTalent.Mat.Knot) != knot + 8 || TalentState.Count(GoTalent.Mat.Guide) != guide + 8 || TalentState.Count(GoTalent.Mat.Secret) != secret + 6) Fail("33장 끝·보상(금 8500·교본 8·비급 6·매듭 8)");
            area.Refresh();
            field.Refresh();
            if (!field.NpcShown("maru") || !field.NpcShown("bandi") || !field.NpcShown("chorong") || !field.NpcShown("neoul") || !field.NpcShown("saegil") || !field.NpcShown("hanbyeol")) Fail("33장 뒤 마루·반디·초롱·너울·새길·한별이 안 섬(장 이어 서기 ChTo)");
            if (GoStory.Flat(D("bandi"), GoStory.AreaPos("vault:yard", GoStory.VaultBandi)) > 0.6f || GoStory.Flat(D("maru"), GoStory.AreaPos("vault:yard", GoStory.MaruAt)) > 0.6f) Fail("33장 뒤 반디·마루 자리");
            _ch33 = "33장 반디 굳은 거리→고원 관측소(하람 곁)→벌 창고 앞·하람 관측소·벌 어귀 go(고원·돌기둥 도착 자리에선 안 넘어감)·야적장 무리 넷(땅 안)·운반 드론 길(11점 땅 안·충돌 없음·끝 = 금고 문 앞·평균 속도)·걸어선 못 잡고 달려서 잡음·마루 창고 앞·보상·9부 인물이 장을 이어 섬";
        }

        // ---- 34장 ---------------------------------------------------------------------------------------------

        private static void CheckChapter34(FieldCombat fc, PlayerController pc, StoryField field, StoryUi ui)
        {
            _ch34 = "34장 중단";
            StoryState.OffForTest = false;
            PlayerStats.Restore(74, 0);
            StoryState.Restore(33, 0);
            var area = AreaField.Instance;
            var vt = GoAreas.Vault;
            if (area == null) { Fail("AreaField 없음"); return; }
            area.Refresh();
            field.Refresh();
            Vector3 D(string id) => field.NpcBody(id).transform.position;
            if (!field.NpcShown("maru") || GoStory.Flat(D("maru"), GoStory.AreaPos("vault:yard", GoStory.MaruAt)) > 0.6f) Fail("34장 첫 단계: 마루가 야적장 창고 앞에 안 섬");
            if (field.NpcShown("sodam")) Fail("34장 앞인데 소담이 섬");
            foreach (var k in new[] { "vault:granary_door", "vault:pylon0orb", "vault:pylon1orb", "vault:door" }) if (!area.VaultPartOn(k)) Fail($"34장 처음 모습: {k} 가 없음");
            Talk(pc, ui, "maru", "34장 마루");
            Expect(33, 1, "마루 뒤");                                                            // → 1 seal 곳간 석등
            field.Refresh();
            Vector3 granary = GoStory.AreaPos("vault:granary", Vector2.zero);
            if (GoStory.Flat(D("maru"), GoStory.AreaPos("vault:granary", GoStory.MaruGranary)) > 0.6f) Fail("마루가 곳간 동남쪽에 안 섬");
            if (!field.SealCenterOf(33).gameObject.activeSelf || field.SealLampOf(33, 0).Lit) Fail("곳간 석등이 꺼진 채 안 섬");
            for (int i = 0; i < 3; i++)
            {
                Vector3 lp = field.SealLampOf(33, i).transform.position;
                if (GoStory.Flat(lp, granary) > GoStory.SealR + 1f || GoStory.Flat(lp, granary) < 5f || !vt.Contains(lp)) Fail($"곳간 석등 {i} 자리 {GoStory.Flat(lp, granary):0.0}m");
            }
            int Lamp(string id) => System.Array.IndexOf(GoStory.SealLayout, id);
            Vector3 L(string id) => field.SealLampOf(33, Lamp(id)).transform.position;
            Pulse(L("sun"), 1f);                                                                 // 틀림(첫째는 별)
            if (StoryState.Progress != 0 || field.SealLampOf(33, Lamp("sun")).Lit) Fail("차례 틀린 해가 켜짐(별·해·달)");
            Pulse(L("star"), 1f);
            Pulse(L("sun"), 1f);
            Expect(33, 1, "둘 켰는데 넘어감");
            Pulse(L("moon"), 1f);
            Expect(33, 2, "별·해·달");                                                           // → 2 talk 소담(곳간 문이 열린다)
            area.Refresh();
            field.Refresh();
            if (area.VaultPartOn("vault:granary_door") || !area.VaultPartOn("vault:pylon0orb") || !area.VaultPartOn("vault:door")) Fail("석등을 켠 뒤 곳간 문만 열려야(동력 기둥·금고 문은 그대로)");
            if (!field.NpcShown("sodam") || GoStory.Flat(D("sodam"), GoStory.AreaPos("vault:granary", GoStory.SodamGranary)) > 0.6f) Fail("소담이 곳간 문 앞 서쪽에 안 섬");
            Talk(pc, ui, "sodam", "34장 소담");
            Expect(33, 3, "소담 뒤");                                                            // → 3 defend 곳간
            Vector3 alt = GoStory.AreaPos("vault:granary", GoStory.GranaryDefend);
            pc.Teleport(alt + new Vector3(0f, 0.3f, -GoStory.DefendStart - 5f));
            field.DefendTick(pc.transform.position, 0.1f);
            if (field.DefendWave != -1 || field.Squad.Count != 0) Fail("멀리서 물결이 옴");
            pc.Teleport(alt + new Vector3(0f, 0.3f, 2f));
            field.DefendTick(pc.transform.position, 0.1f);
            if (field.DefendWave != 0 || field.Squad.Count != 3) { Fail($"곳간 첫 물결 {field.DefendWave}·{field.Squad.Count}"); return; }
            foreach (var e in field.Squad)
            {
                Vector3 d = e.transform.position - alt;
                float bearing = Mathf.Repeat(Mathf.Atan2(d.x, -d.z) * Mathf.Rad2Deg, 360f);
                if (!vt.Contains(e.transform.position)) Fail("물결이 갈무리 벌 밖에서 나옴");
                if (bearing < 40f || bearing > 320f) Fail($"물결이 곳간(북) 쪽에서 나옴 {bearing:0}°");
            }
            for (int guard = 0; guard < 40 && StoryState.StepIndex == 3; guard++)
            {
                field.DefendTick(pc.transform.position, 0.1f);
                foreach (var e in new System.Collections.Generic.List<FieldEnemy>(field.Squad)) if (e.Alive) Kill(e);
            }
            Expect(33, 4, "곳간 물결 셋");                                                       // → 4 light 서쪽 동력 기둥
            for (int p = 0; p < 2; p++)
            {
                Vector3 spot = GoStory.AreaPos("vault:pylon" + p, Vector2.zero);
                area.Refresh();
                if (area.VaultPartOn("vault:pylon" + (1 - p) + "orb") != (p == 0)) Fail($"동력 기둥 {p} 앞 알 상태");
                pc.Teleport(spot + new Vector3(4f, 0.4f, 0f));
                Pulse(spot + new Vector3(12f, 0f, 0f), 3f);                                      // 멀리서 쏜 원소는 안 닿는다
                Expect(33, 4 + p, $"동력 기둥 {p} — 멀리서 쏜 원소로 꺼짐");
                Pulse(spot, 3f);
                Expect(33, 5 + p, $"동력 기둥 {p} 끔");
                area.Refresh();
                if (area.VaultPartOn("vault:pylon" + p + "orb")) Fail($"동력 기둥 {p} 를 껐는데 알이 남음");
            }
            Expect(33, 6, "동력 기둥 둘 뒤");                                                    // → 6 talk 소담(금고 문이 열린다)
            field.Refresh();
            if (area.VaultPartOn("vault:pylon0orb") || area.VaultPartOn("vault:pylon1orb") || area.VaultPartOn("vault:door")) Fail("동력 기둥 둘을 끈 뒤 알 둘·금고 문이 사라져야");
            if (!area.VaultPartOn("vault:core") || !area.VaultPartOn("vault:haemi") || area.VaultPartOn("vault:deep")) Fail("34장에 핵·해미 진열장·깊은 진열장이 바뀜(35장 몫)");
            vt.TrySite("vault", out var vs);
            Physics.SyncTransforms();
            if (Physics.Raycast(vs.Pos + new Vector3(1.5f, 1.5f, 20f), Vector3.back, 9f)) Fail("금고 문이 열렸는데 충돌이 남음");
            if (!field.NpcShown("sodam") || GoStory.Flat(D("sodam"), GoStory.AreaPos("vault:vault", GoStory.SodamDoor)) > 0.6f) Fail("소담이 금고 문 앞에 안 섬");
            int gold = GoldState.Gold, knot = TalentState.Count(GoTalent.Mat.Knot), guide = TalentState.Count(GoTalent.Mat.Guide), secret = TalentState.Count(GoTalent.Mat.Secret);
            Talk(pc, ui, "sodam", "34장 끝 소담");
            if (StoryState.Ch != 34 || GoldState.Gold != gold + 8750 || TalentState.Count(GoTalent.Mat.Knot) != knot + 8 || TalentState.Count(GoTalent.Mat.Guide) != guide + 8 || TalentState.Count(GoTalent.Mat.Secret) != secret + 6) Fail("34장 끝·보상(금 8750·교본 8·비급 6·매듭 8)");
            area.Refresh();
            field.Refresh();
            if (area.VaultPartOn("vault:door") || area.VaultPartOn("vault:pylon0orb") || !area.VaultPartOn("vault:core")) Fail("34장 뒤 금고 문은 열린 채·핵은 그대로");
            if (!field.NpcShown("sodam") || !field.NpcShown("maru") || GoStory.Flat(D("maru"), GoStory.AreaPos("vault:yard", GoStory.MaruAt)) > 0.6f) Fail("34장 뒤 소담·마루 자리");
            _ch34 = "34장 마루 곳간 동남쪽·곳간 석등 별·해·달(틀린 차례 ✕·둘 켠 채 안 넘어감)·곳간 문 열림·소담 곳간 서쪽→금고 문 앞·곳간 지키기 물결 셋(곳간 북쪽 뺌·갈무리 벌 안)·동력 기둥 둘 차례로 끔(멀리서 쏜 원소 ✕·알 사라짐)·금고 문 열림(충돌 사라짐)·핵·해미·깊은 진열장 그대로·보상";
        }

        // ---- 35장 ---------------------------------------------------------------------------------------------

        private static void CheckChapter35(FieldCombat fc, PlayerController pc, StoryField field, StoryUi ui)
        {
            _ch35 = "35장 중단";
            StoryState.OffForTest = false;
            PlayerStats.Restore(76, 0);
            StoryState.Restore(34, 0);
            var area = AreaField.Instance;
            var vt = GoAreas.Vault;
            if (area == null) { Fail("AreaField 없음"); return; }
            area.Refresh();
            field.Refresh();
            Vector3 D(string id) => field.NpcBody(id).transform.position;
            vt.TrySite("vault", out var vs);
            Vector3 vp = vs.Pos;
            if (!field.NpcShown("sodam") || GoStory.Flat(D("sodam"), GoStory.AreaPos("vault:vault", GoStory.SodamDoor)) > 0.6f) Fail("35장 첫 단계: 소담이 금고 문 앞에 안 섬");
            if (field.NpcShown("haemi") || field.NpcShown("garmuri")) Fail("35장 첫 단계인데 해미·갈무리가 섬");
            if (area.VaultPartOn("vault:door") || !area.VaultPartOn("vault:core") || !area.VaultPartOn("vault:haemi") || area.VaultPartOn("vault:deep")) Fail("35장 처음 모습: 문 열림·핵·해미 진열장 그대로·깊은 진열장 없음");
            Talk(pc, ui, "sodam", "35장 소담");
            Expect(34, 1, "소담 뒤");                                                            // → 1 go 금고 안
            field.Refresh();
            if (GoStory.Flat(D("sodam"), GoStory.AreaPos("vault:vault", GoStory.SodamVault)) > 0.6f) Fail("소담이 금고 안으로 안 들어감");
            Vector3 inside = GoStory.AreaPos("vault:vault", GoStory.VaultGoIn);
            pc.Teleport(vp + new Vector3(0f, 0.4f, 15f));                                        // 문 앞
            field.Check(pc.transform.position);
            Expect(34, 1, "문 앞에서 금고 안 단계가 넘어감");
            pc.Teleport(inside + new Vector3(0f, 0.4f, 0f));
            field.Check(pc.transform.position);
            Expect(34, 2, "금고 안");                                                            // → 2 talk 해미
            field.Refresh();
            if (!field.NpcShown("haemi") || GoStory.Flat(D("haemi"), GoStory.AreaPos("vault:vault", GoStory.VaultHaemiAt)) > 0.6f) Fail("해미가 진열장 속에 안 섬");
            Talk(pc, ui, "haemi", "35장 해미");
            Expect(34, 3, "해미 뒤");                                                            // → 3 climb 기록 기둥
            Physics.SyncTransforms();
            Vector3 top = GoStory.ClimbTopOf("vault:vault");
            var pillar = area.SiteObject("vault", "vault").transform.Find("Vault_pillar");
            if (Mathf.Abs(top.y - GoStory.VaultPillarH - vp.y) > 0.1f) Fail("기록 기둥 꼭대기 높이 표");
            if (pillar == null || pillar.GetComponent<Collider>() == null || Mathf.Abs(pillar.GetComponent<Collider>().bounds.max.y - top.y) > 0.1f) Fail("기록 기둥 충돌·윗면이 꼭대기 표와 안 맞음");
            if (!Physics.Raycast(top + new Vector3(-GoStory.VaultPillarW * 0.5f - 3f, -4f, 0f), Vector3.right, 3f)) Fail("기록 기둥이 곧은 벽이 아니다");
            pc.Teleport(vp + new Vector3(6f, 0.4f, 0f));
            field.Check(pc.transform.position);
            Expect(34, 3, "땅에서 기둥 오르기 단계가 넘어감");
            pc.Teleport(top + new Vector3(0f, 0.3f, 0f));
            field.Check(pc.transform.position);
            Expect(34, 4, "기둥 꼭대기");                                                        // → 4 talk 갈무리
            field.Refresh();
            if (!field.NpcShown("garmuri") || GoStory.Flat(D("garmuri"), GoStory.AreaPos("vault:vault", GoStory.VaultGarmuriAt)) > 0.6f) Fail("갈무리가 기둥 곁에 안 섬");
            if (GoStory.Flat(top, D("garmuri")) > GoStory.TalkR) Fail("기둥 꼭대기에서 갈무리 대화 거리 밖");
            if (!area.VaultPartOn("vault:core")) Fail("갈무리와 이야기하기 전에 핵이 꺼짐");
            Talk(pc, ui, "garmuri", "35장 갈무리");
            Expect(34, 5, "갈무리 뒤");                                                          // → 5 duel 여왕
            area.Refresh();
            field.Refresh();
            if (area.VaultPartOn("vault:core") || !area.VaultPartOn("vault:haemi")) Fail("갈무리 뒤 핵만 꺼지고 해미 진열장은 그대로여야");
            if (field.NpcShown("garmuri")) Fail("갈무리 대화 뒤 갈무리가 남음");
            field.Check(pc.transform.position);
            if (field.Squad.Count != 1) { Fail($"금고 파수 드론 여왕 {field.Squad.Count}"); return; }
            var queen = field.Squad[0];
            if (!queen.IsStoryBoss || queen.DisplayName != GoLocalization.T("story.boss.queen", "금고 파수 드론 여왕") || queen.Element != GoElement.Anemo || queen.CurrentMove != FieldEnemy.BossMove.Slam) Fail($"여왕 이름·풍·첫 수 {queen.DisplayName}·{queen.Element}·{queen.CurrentMove}");
            if (!vt.Contains(queen.transform.position) || GoStory.Flat(queen.transform.position, GoStory.AreaPos("vault:vault", GoStory.VaultQueenAt)) > 14f) Fail("여왕이 금고 문 앞 광장이 아님");
            queen.SetShieldForTest(0f);
            queen.TakeRaw(queen.Hp - queen.MaxHp * 0.45f, Color.white);
            field.DuelTickForTest();
            if (!queen.Shielded || queen.Element != GoElement.Anemo || field.Squad.Count != 3) Fail($"2단계 풍 방패·졸개 {queen.Element}·{field.Squad.Count}");
            Kill(queen);
            Expect(34, 6, "금고 파수 드론 여왕");                                                // → 6 talk 해미(진열장이 깨진다)
            area.Refresh();
            field.Refresh();
            if (area.VaultPartOn("vault:haemi") || area.VaultPartOn("vault:core")) Fail("여왕을 쓰러뜨린 뒤 해미 진열장이 깨지고 핵은 꺼진 채여야");
            if (!field.NpcShown("haemi")) Fail("진열장이 깨졌는데 해미가 안 섬");
            int gold = GoldState.Gold, knot = TalentState.Count(GoTalent.Mat.Knot), guide = TalentState.Count(GoTalent.Mat.Guide), secret = TalentState.Count(GoTalent.Mat.Secret);
            Talk(pc, ui, "haemi", "35장 끝 해미");
            if (StoryState.Ch != 35 || GoldState.Gold != gold + 9750 || TalentState.Count(GoTalent.Mat.Knot) != knot + 9 || TalentState.Count(GoTalent.Mat.Guide) != guide + 9 || TalentState.Count(GoTalent.Mat.Secret) != secret + 7) Fail("35장 끝·보상(금 9750·교본 9·비급 7·매듭 9)");
            if (!PartyState.Has("story_haemi")) Fail("해미가 합류 안 함");
            bool ko = GoKits.OffForTest;
            GoKits.OffForTest = false;
            var kit = GoKits.KitOf("story_haemi", GoElement.Dendro);
            GoKits.OffForTest = ko;
            if (!GoHeroes.TryGet("story_haemi", out var hh) || hh.Era != HeroEra.Story || hh.Rarity != 4 || GoHeroes.ElementOf(hh) != GoElement.Dendro || hh.Trait != HeroTrait.Command || GoWeapons.TypeOf("story_haemi") != GoWeapons.Type.Sword || GoStory.MemberEra("story_haemi") != GoEra.Future) Fail("해미 표(★4 초 한손검 통솔·미래)");
            if (kit == null || !kit.Sig || kit.Skill.Type != KitSkillType.Dash || kit.Burst.Type != KitBurstType.Infuse || Mathf.Abs(kit.Skill.Len - 5f) > 0.01f) Fail("해미 한 벌(씨앗 가르기 dash·싹 틔우는 칼 infuse)");
            area.Refresh();
            field.Refresh();
            if (!area.VaultPartOn("vault:deep") || area.VaultPartOn("vault:haemi") || area.VaultPartOn("vault:core") || area.VaultPartOn("vault:door")) Fail("10부 뒤 가장 깊은 진열장이 드러나고 해미 진열장·핵·문은 열린 채여야");
            if (!field.NpcShown("haemi") || GoStory.Flat(D("haemi"), GoStory.AreaPos("vault:vault", GoStory.VaultHaemiDeep)) > 0.6f || field.NpcShown("garmuri")) Fail("10부 뒤 해미는 가장 깊은 진열장 곁(36장 첫 단계 자리)·갈무리는 없음");
            if (!field.NpcShown("sodam") || !field.NpcShown("maru")) Fail("10부 뒤 소담·마루가 안 섬");
            _ch35 = "35장 소담 금고 문 앞→안·금고 안 go(문 앞에선 안 넘어감)·해미 진열장 속·기록 기둥 9m 벽/꼭대기(땅에선 안 넘어감)·갈무리 기둥 곁(꼭대기에서 대화 거리 안)·핵 꺼짐(갈무리 뒤)·금고 파수 드론 여왕 풍 2단계 방패·해미 진열장 깨짐·해미 합류(★4 초 한손검 dash·infuse)·깊은 진열장 드러남·보상";
        }

        // ---- 36장 ---------------------------------------------------------------------------------------------

        private static void CheckChapter36(FieldCombat fc, PlayerController pc, StoryField field, StoryUi ui)
        {
            _ch36 = "36장 중단";
            StoryState.OffForTest = false;
            PlayerStats.Restore(78, 0);
            StoryState.Restore(35, 0);
            var area = AreaField.Instance;
            var vt = GoAreas.Vault;
            var fk = GoAreas.Fork;
            if (area == null) { Fail("AreaField 없음"); return; }
            area.Refresh();
            field.Refresh();
            Vector3 D(string id) => field.NpcBody(id).transform.position;
            vt.TrySite("vault", out var vs);
            fk.TrySite("gate", out var gate);
            if (!field.NpcShown("haemi") || GoStory.Flat(D("haemi"), GoStory.AreaPos("vault:vault", GoStory.VaultHaemiDeep)) > 0.6f) Fail("36장 첫 단계: 해미가 가장 깊은 진열장 곁에 안 섬");
            if (!area.VaultPartOn("vault:deep")) Fail("10부 뒤 가장 깊은 진열장이 안 드러남");
            if (GoStory.Flat(D("haemi"), vs.Pos + new Vector3(0f, 0f, -GoStory.VaultDeepR)) > 8f) Fail("해미가 가장 깊은 진열장에서 너무 멂");
            if (!field.NpcShown("byeori") || GoStory.Flat(D("byeori"), GoStory.AreaPos("fork:gate", GoStory.ByeoriGate)) > 0.6f) Fail("벼리가 성문 안쪽에 안 섬");
            Talk(pc, ui, "haemi", "36장 해미");
            Expect(35, 1, "해미 뒤");                                                            // → 1 sail 진열장 속으로
            Talk(pc, ui, "haemi", "36장 진열장 속으로");
            Expect(35, 2, "진열장 속으로");                                                      // → 2 talk 벼리
            if (!fk.Contains(pc.transform.position) || GoStory.Flat(pc.transform.position, fk.ArrivalPos) > 6f) Fail($"진열장 속에서 성문 남쪽에 안 내림 {pc.transform.position}");
            field.Refresh();
            if (GoStory.Flat(D("byeori"), GoStory.AreaPos("fork:gate", GoStory.ByeoriGate)) > 0.6f) Fail("벼리가 성문 안쪽에 안 섬");
            Talk(pc, ui, "byeori", "36장 벼리");
            Expect(35, 3, "벼리 뒤");                                                            // → 3 kill 성문 앞
            Vector3 killAt = GoStory.AreaPos("fork:gate", GoStory.ForkGateKill);
            pc.Teleport(killAt + new Vector3(0f, 0.4f, GoStory.KillNear - 15f));
            field.Check(pc.transform.position);
            if (field.Squad.Count != 4 || field.Squad.Any(e => !fk.Contains(e.transform.position))) Fail($"성문 앞 무리 {field.Squad.Count}");
            foreach (var e in new System.Collections.Generic.List<FieldEnemy>(field.Squad)) Kill(e);
            Expect(35, 4, "성문 앞 결정 짐승");                                                  // → 4 follow 대장간
            field.Refresh();
            var n = GoStory.NpcOf("byeori");
            float len = GoStory.PathLength(n);
            fk.TrySite("forge", out var forge);
            if (GoStory.Flat(D("byeori"), forge.Pos + new Vector3(GoStory.ForkForgePath[0].x, 0f, GoStory.ForkForgePath[0].y)) > 0.6f) Fail("따라가기 전 벼리가 길 시작점에 안 섬");
            if (GoStory.Flat(GoStory.NpcPos("byeori"), gate.Pos) > 12f) Fail("길 시작점이 성문 안쪽이 아님");
            Physics.SyncTransforms();
            for (int i = 0; i + 1 < GoStory.ForkForgePath.Length; i++)
            {
                Vector3 a0 = GoStory.AreaPos("fork:forge", GoStory.ForkForgePath[i]), a1 = GoStory.AreaPos("fork:forge", GoStory.ForkForgePath[i + 1]);
                for (float f = 0f; f <= 1f; f += 0.05f)
                {
                    Vector3 pt = Vector3.Lerp(a0, a1, f);
                    if (Physics.CheckSphere(pt + Vector3.up * 1.6f, 0.9f)) { Fail($"벼리 길 {i} 곁에 충돌(성문·성벽·대장간·우물…) {pt}"); break; }
                }
            }
            if (Mathf.Abs(len - 35.7f) > 1f) Fail($"벼리 길이 {len:0.0}m");
            pc.Teleport(GoStory.NpcPos("byeori") + new Vector3(0f, 0.4f, -GoStory.FollowLost - 10f));
            field.Follow(pc.transform.position, 2f);
            if (StoryState.FollowDist > 0f) Fail("멀리 있는데 벼리가 걸음");
            for (int i = 0; i < 400 && StoryState.StepIndex == 4; i++)
            {
                Near(pc, GoStory.NpcPos("byeori"), 3f);
                float before = StoryState.FollowDist;
                field.Follow(pc.transform.position, 1f);
                if (StoryState.StepIndex == 4 && Mathf.Abs(StoryState.FollowDist - before - GoStory.FollowSpeed) > 0.01f && StoryState.FollowDist < len - 0.01f)
                { Fail($"따라가기 한 걸음 {StoryState.FollowDist - before}"); break; }
            }
            Expect(35, 5, "대장간 화덕 앞");                                                     // → 5 talk 벼리
            field.Refresh();
            if (GoStory.Flat(D("byeori"), GoStory.PathPos(n, float.MaxValue)) > 0.6f || GoStory.Flat(D("byeori"), forge.Pos) > 9f) Fail("벼리가 화덕 앞에 안 섬");
            int gold = GoldState.Gold, knot = TalentState.Count(GoTalent.Mat.Knot), guide = TalentState.Count(GoTalent.Mat.Guide), secret = TalentState.Count(GoTalent.Mat.Secret);
            Talk(pc, ui, "byeori", "36장 끝 벼리");
            if (StoryState.Ch != 36 || GoldState.Gold != gold + 9000 || TalentState.Count(GoTalent.Mat.Knot) != knot + 9 || TalentState.Count(GoTalent.Mat.Guide) != guide + 9 || TalentState.Count(GoTalent.Mat.Secret) != secret + 6) Fail("36장 끝·보상(금 9000·교본 9·비급 6·매듭 9)");
            field.Refresh();
            if (!field.NpcShown("byeori") || GoStory.Flat(D("byeori"), forge.Pos) > 9f) Fail("36장 뒤 벼리가 화덕 앞에 안 섬");
            if (!field.NpcShown("haemi") || GoStory.Flat(D("haemi"), GoStory.AreaPos("vault:vault", GoStory.VaultHaemiAt)) > 0.6f) Fail("36장 뒤 해미가 깨진 진열장 자리에 안 섬");
            _ch36 = "36장 해미 가장 깊은 진열장 곁·진열장 속으로 sail(성문 남쪽 도착)·벼리 성문 안쪽·성문 앞 무리 넷(고을 안)·벼리 따라 대장간(길 다섯 점 충돌 없음·길이·멀면 안 걸음·한 걸음 속도)·화덕 앞·보상·해미 진열장 자리 복귀";
        }

        // ---- 37장 ---------------------------------------------------------------------------------------------

        private static void CheckChapter37(FieldCombat fc, PlayerController pc, StoryField field, StoryUi ui)
        {
            _ch37 = "37장 중단";
            StoryState.OffForTest = false;
            PlayerStats.Restore(80, 0);
            StoryState.Restore(36, 0);
            var area = AreaField.Instance;
            var fk = GoAreas.Fork;
            if (area == null) { Fail("AreaField 없음"); return; }
            area.Refresh();
            field.Refresh();
            Vector3 D(string id) => field.NpcBody(id).transform.position;
            fk.TrySite("forge", out var forge);
            fk.TrySite("tower", out var tower);
            fk.TrySite("loco", out var loco);
            if (!field.NpcShown("byeori") || GoStory.Flat(D("byeori"), GoStory.PathPos(GoStory.NpcOf("byeori"), float.MaxValue)) > 0.6f || GoStory.Flat(D("byeori"), forge.Pos) > 9f) Fail("37장 첫 단계: 벼리가 화덕 앞에 안 섬");
            if (field.NpcShown("narae")) Fail("37장 앞인데 나래가 섬");
            foreach (var k in new[] { "fork:lat0", "fork:lat1", "fork:lat2", "fork:crow", "fork:rift", "fork:veil" }) if (!area.ForkPartOn(k)) Fail($"37장 처음 모습: {k} 가 없음");
            Talk(pc, ui, "byeori", "37장 벼리");
            Expect(36, 1, "벼리 뒤");                                                            // → 1 light 역참길 말뚝
            field.Refresh();
            fk.TrySite("junction", out var junc);
            if (GoStory.Flat(D("byeori"), GoStory.AreaPos("fork:junction", GoStory.ByeoriJunction)) > 0.6f || GoStory.Flat(D("byeori"), junc.Pos) > 14f) Fail("벼리가 길목 동남쪽에 안 섬");
            // 격자 말뚝 셋 차례로(0 역참길·1 선로 — 땅, 2 종루 위 — 꼭대기에서만)
            void Lattice(int k, string label)
            {
                string at = k == 2 ? "fork:tower" : "fork:lat" + k;
                Vector3 spot = GoStory.AreaPos(at, Vector2.zero);
                area.Refresh();
                for (int q = 0; q < 3; q++) if (area.ForkPartOn("fork:lat" + q) != (q >= k)) Fail($"{label} 앞인데 말뚝 {q} 상태 {area.ForkPartOn("fork:lat" + q)}");
                if (k < 2) pc.Teleport(spot + new Vector3(4f, 0.4f, 0f));
                int step0 = StoryState.StepIndex;
                Pulse(spot + new Vector3(12f, 0f, 0f), 3f);                                      // 멀리서 쏜 원소는 안 닿는다
                Expect(36, step0, $"{label} — 멀리서 쏜 원소로 꺼짐");
                Pulse(spot, 3f);
                Expect(36, step0 + 1, $"{label} 끔");
                area.Refresh();
                if (area.ForkPartOn("fork:lat" + k)) Fail($"{label} 를 껐는데 빛 틀이 남음");
            }
            Lattice(0, "역참길 말뚝");
            Expect(36, 2, "역참길 말뚝 뒤");                                                     // → 2 talk 나래
            field.Refresh();
            if (!field.NpcShown("narae") || GoStory.Flat(D("narae"), GoStory.AreaPos("fork:works", GoStory.NaraeWorks)) > 0.6f) Fail("나래가 공사장에 안 섬");
            Talk(pc, ui, "narae", "37장 나래");
            Expect(36, 3, "나래 뒤");                                                            // → 3 defend 기관차
            field.Refresh();
            if (GoStory.Flat(D("narae"), GoStory.AreaPos("fork:loco", GoStory.NaraeLoco)) > 0.6f) Fail("나래가 기관차 서쪽 끝에 안 섬");
            Vector3 alt = GoStory.AreaPos("fork:loco", GoStory.ForkLocoDefend);
            pc.Teleport(alt + new Vector3(0f, 0.3f, -GoStory.DefendStart - 5f));
            field.DefendTick(pc.transform.position, 0.1f);
            if (field.DefendWave != -1 || field.Squad.Count != 0) Fail("멀리서 물결이 옴");
            pc.Teleport(alt + new Vector3(0f, 0.3f, 2f));
            field.DefendTick(pc.transform.position, 0.1f);
            if (field.DefendWave != 0 || field.Squad.Count != 3) { Fail($"기관차 첫 물결 {field.DefendWave}·{field.Squad.Count}"); return; }
            foreach (var e in field.Squad)
            {
                Vector3 d = e.transform.position - alt;
                float bearing = Mathf.Repeat(Mathf.Atan2(d.x, -d.z) * Mathf.Rad2Deg, 360f);
                if (!fk.Contains(e.transform.position)) Fail("물결이 세갈래 고을 밖에서 나옴");
                if (bearing < 40f || bearing > 320f) Fail($"물결이 기관차(북) 쪽에서 나옴 {bearing:0}°");
            }
            for (int guard = 0; guard < 40 && StoryState.StepIndex == 3; guard++)
            {
                field.DefendTick(pc.transform.position, 0.1f);
                foreach (var e in new System.Collections.Generic.List<FieldEnemy>(field.Squad)) if (e.Alive) Kill(e);
            }
            Expect(36, 4, "기관차 물결 셋");                                                     // → 4 light 선로 말뚝
            Lattice(1, "선로 말뚝");
            Expect(36, 5, "선로 말뚝 뒤");                                                       // → 5 climb 종루
            Physics.SyncTransforms();
            Vector3 top = GoStory.ClimbTopOf("fork:tower");
            if (Mathf.Abs(top.y - GoStory.ForkTowerH - tower.Pos.y) > 0.1f) Fail("종루 꼭대기 높이 표");
            pc.Teleport(tower.Pos + new Vector3(6f, 0.4f, 0f));
            field.Check(pc.transform.position);
            Expect(36, 5, "땅에서 종루 오르기 단계가 넘어감");
            pc.Teleport(top + new Vector3(0f, 0.3f, 0f));
            field.Check(pc.transform.position);
            Expect(36, 6, "종루 꼭대기");                                                        // → 6 light 종루 말뚝
            // 종루 말뚝은 땅에서 쏘면 안 붙는다(꼭대기에서만)
            Vector3 lat2 = GoStory.AreaPos("fork:tower", Vector2.zero);
            pc.Teleport(tower.Pos + new Vector3(6f, 0.4f, 0f));
            Pulse(lat2, 4f);
            Expect(36, 6, "땅에서 쏜 원소로 종루 말뚝이 꺼짐");
            area.Refresh();
            if (!area.ForkPartOn("fork:lat2")) Fail("땅에서 쏘았는데 종루 말뚝이 꺼짐");
            pc.Teleport(top + new Vector3(0f, 0.3f, 0f));
            Pulse(lat2, 1f);
            Expect(36, 7, "꼭대기에서 종루 말뚝");                                               // → 7 talk 벼리
            area.Refresh();
            field.Refresh();
            if (area.ForkPartOn("fork:lat0") || area.ForkPartOn("fork:lat1") || area.ForkPartOn("fork:lat2")) Fail("말뚝 셋을 껐는데 빛 틀이 남음");
            if (!area.ForkPartOn("fork:crow") || !area.ForkPartOn("fork:rift") || !area.ForkPartOn("fork:veil")) Fail("37장에서 별까마귀·하늘 틈·장막이 바뀜(38장 몫)");
            int gold = GoldState.Gold, knot = TalentState.Count(GoTalent.Mat.Knot), guide = TalentState.Count(GoTalent.Mat.Guide), secret = TalentState.Count(GoTalent.Mat.Secret);
            Talk(pc, ui, "byeori", "37장 끝 벼리");
            if (StoryState.Ch != 37 || GoldState.Gold != gold + 9250 || TalentState.Count(GoTalent.Mat.Knot) != knot + 9 || TalentState.Count(GoTalent.Mat.Guide) != guide + 9 || TalentState.Count(GoTalent.Mat.Secret) != secret + 6) Fail("37장 끝·보상(금 9250·교본 9·비급 6·매듭 9)");
            area.Refresh();
            field.Refresh();
            if (!field.NpcShown("byeori") || !field.NpcShown("narae") || GoStory.Flat(D("narae"), GoStory.AreaPos("fork:loco", GoStory.NaraeLoco)) > 0.6f) Fail("37장 뒤 벼리·나래 자리");
            if (area.ForkPartOn("fork:lat0") || area.ForkPartOn("fork:lat2") || !area.ForkPartOn("fork:crow")) Fail("37장 뒤 말뚝은 꺼진 채·별까마귀는 그대로");
            _ch37 = "37장 벼리 화덕 앞→길목 동남쪽·격자 말뚝 셋 차례로 끔(멀리서 쏜 원소 ✕·종루 말뚝은 땅에서 ✕)·나래 공사장→기관차 서쪽·기관차 지키기 물결 셋(기관차 북쪽 뺌·고을 안)·종루 10m 벽 타기(땅에선 안 넘어감)·별까마귀·하늘 틈·장막 그대로·보상";
        }

        // ---- 38장 ---------------------------------------------------------------------------------------------

        private static void CheckChapter38(FieldCombat fc, PlayerController pc, StoryField field, StoryUi ui)
        {
            _ch38 = "38장 중단";
            StoryState.OffForTest = false;
            PlayerStats.Restore(82, 0);
            StoryState.Restore(37, 0);
            var area = AreaField.Instance;
            var fk = GoAreas.Fork;
            if (area == null) { Fail("AreaField 없음"); return; }
            GoStory.ForkPassForTest = false;
            area.Refresh();
            field.Refresh();
            Vector3 D(string id) => field.NpcBody(id).transform.position;
            fk.TrySite("junction", out var junc);
            if (!field.NpcShown("byeori") || GoStory.Flat(D("byeori"), GoStory.AreaPos("fork:junction", GoStory.ByeoriJunction)) > 0.6f) Fail("38장 첫 단계: 벼리가 길목 동남쪽에 안 섬");
            if (field.NpcShown("garmuri")) Fail("38장 첫 단계인데 갈무리가 섬");
            if (!area.ForkPartOn("fork:crow") || !area.ForkPartOn("fork:rift") || !area.ForkPartOn("fork:veil") || fk.Open()) Fail("38장 처음 모습: 별까마귀 모형·하늘 틈·장막이 서 있고 고개는 닫힘");
            Talk(pc, ui, "byeori", "38장 벼리");
            Expect(37, 1, "벼리 뒤");                                                            // → 1 duel 처음의 별까마귀
            area.Refresh();
            if (area.ForkPartOn("fork:crow")) Fail("별까마귀 싸움이 시작됐는데 멈춘 모형이 남음");
            if (!area.ForkPartOn("fork:rift") || !area.ForkPartOn("fork:veil")) Fail("별까마귀 싸움 중인데 하늘 틈·장막이 벌써 걷힘");
            field.Check(pc.transform.position);
            if (field.Squad.Count != 1) { Fail($"처음의 별까마귀 {field.Squad.Count}"); return; }
            var crow = field.Squad[0];
            if (!crow.IsStoryBoss || crow.DisplayName != GoLocalization.T("story.boss.firstcrow", "처음의 별까마귀") || crow.Element != GoElement.Electro || crow.CurrentMove != FieldEnemy.BossMove.Slam) Fail($"별까마귀 이름·뇌·첫 수 {crow.DisplayName}·{crow.Element}·{crow.CurrentMove}");
            if (!fk.Contains(crow.transform.position) || GoStory.Flat(crow.transform.position, GoStory.AreaPos("fork:junction", GoStory.ForkCrowAt)) > 14f) Fail("별까마귀가 길목 남쪽이 아님");
            crow.SetShieldForTest(0f);
            crow.TakeRaw(crow.Hp - crow.MaxHp * 0.45f, Color.white);
            field.DuelTickForTest();
            if (!crow.Shielded || crow.Element != GoElement.Electro || field.Squad.Count != 3) Fail($"2단계 뇌 방패·졸개 {crow.Element}·{field.Squad.Count}");
            Kill(crow);
            Expect(37, 2, "처음의 별까마귀");                                                    // → 2 talk 갈무리
            field.Refresh();
            if (!field.NpcShown("garmuri") || GoStory.Flat(D("garmuri"), GoStory.AreaPos("fork:junction", GoStory.GarmuriJunction)) > 0.6f) Fail("갈무리가 길목 위에 안 섬");
            Talk(pc, ui, "garmuri", "38장 갈무리");
            Expect(37, 3, "갈무리 뒤");                                                          // → 3 duel 갈무리 참몸
            field.Check(pc.transform.position);
            if (field.Squad.Count != 1) { Fail($"갈무리 참몸 {field.Squad.Count}"); return; }
            var body = field.Squad[0];
            if (!body.IsStoryBoss || body.DisplayName != GoLocalization.T("story.boss.garmuritrue", "갈무리 참몸") || body.Element != GoElement.Geo || body.CurrentMove != FieldEnemy.BossMove.Slam) Fail($"참몸 이름·암·첫 수 {body.DisplayName}·{body.Element}·{body.CurrentMove}");
            body.SetShieldForTest(0f);
            body.TakeRaw(body.Hp - body.MaxHp * 0.45f, Color.white);
            field.DuelTickForTest();
            if (!body.Shielded || body.Element != GoElement.Geo || field.Squad.Count != 3) Fail($"2단계 암 방패·졸개 {body.Element}·{field.Squad.Count}");
            area.Refresh();
            if (!area.ForkPartOn("fork:rift") || !area.ForkPartOn("fork:veil") || fk.Open()) Fail("참몸을 쓰러뜨리기 전에 순간이 풀림");
            Kill(body);
            Expect(37, 4, "갈무리 참몸");                                                        // → 4 talk 해미(순간이 풀렸다)
            area.Refresh();
            field.Refresh();
            if (area.ForkPartOn("fork:rift") || area.ForkPartOn("fork:veil") || !fk.Open()) Fail("참몸을 쓰러뜨린 뒤 하늘 틈·호박 장막이 걷히고 고개가 열려야");
            if (area.ForkPartOn("fork:crow") || area.ForkPartOn("fork:lat0") || area.ForkPartOn("fork:lat1") || area.ForkPartOn("fork:lat2")) Fail("38장 뒤 별까마귀 모형·격자 말뚝이 남음");
            if (!GoStory.VaultMomentFree) Fail("고을 순간이 풀렸는데 금고 깊은 진열장 유리가 안 깨짐(같은 때)");
            if (!field.NpcShown("haemi") || GoStory.Flat(D("haemi"), GoStory.AreaPos("fork:junction", GoStory.HaemiJunction)) > 0.6f) Fail("해미가 길목 서쪽에 안 섬");
            Talk(pc, ui, "haemi", "38장 해미");
            Expect(37, 5, "해미 뒤");                                                            // → 5 go 서리봉 고개
            Vector3 mouth = GoStory.FrostPos(GoStory.FrostNorthGo);
            if (!GoFrost.Contains(mouth) || GoStory.Flat(mouth, fk.MapGate()) < 12f + 5f) Fail("고원 고개 자리가 서리봉 안·돌기둥에서 걸어갈 거리가 아님");
            pc.Teleport(fk.ArrivalPos + new Vector3(0f, 0.4f, 0f));
            field.Check(pc.transform.position);
            Expect(37, 5, "고을에서 고원 고개 단계가 넘어감");
            var stTarget = GoStory.TargetOf(StoryState.Current, pc.transform.position, out _);
            if (GoStory.Flat(stTarget, fk.SteleGround) > 0.5f) Fail($"고을 안에서 안내 화살표가 나가는 돌기둥이 아님 {stTarget}");
            pc.Teleport(fk.MapGate() + new Vector3(0f, 0.4f, 5f));
            field.Check(pc.transform.position);
            Expect(37, 5, "돌기둥으로 나온 자리에서 고원 고개 단계가 넘어감");
            pc.Teleport(mouth + new Vector3(0f, 0.4f, 0f));
            field.Check(pc.transform.position);
            Expect(37, 6, "서리봉 고원 고개");                                                   // → 6 talk 촌장
            int gold = GoldState.Gold, knot = TalentState.Count(GoTalent.Mat.Knot), guide = TalentState.Count(GoTalent.Mat.Guide), secret = TalentState.Count(GoTalent.Mat.Secret);
            Talk(pc, ui, "elder", "38장 끝 촌장");
            if (StoryState.Ch != 38 || GoldState.Gold != gold + 12000 || TalentState.Count(GoTalent.Mat.Knot) != knot + 10 || TalentState.Count(GoTalent.Mat.Guide) != guide + 10 || TalentState.Count(GoTalent.Mat.Secret) != secret + 8) Fail("38장 끝·보상(금 12000·교본 10·비급 8·매듭 10)");
            if (StoryState.Done) Fail("12부(39~41장)가 이어지는데 이야기가 끝으로 셈");
            if (!PartyState.Has("story_byeori")) Fail("벼리가 합류 안 함");
            bool ko = GoKits.OffForTest;
            GoKits.OffForTest = false;
            var kit = GoKits.KitOf("story_byeori", GoElement.Pyro);
            GoKits.OffForTest = ko;
            if (!GoHeroes.TryGet("story_byeori", out var hh) || hh.Era != HeroEra.Story || hh.Rarity != 4 || GoHeroes.ElementOf(hh) != GoElement.Pyro || hh.Trait != HeroTrait.Might || GoWeapons.TypeOf("story_byeori") != GoWeapons.Type.Claymore || GoStory.MemberEra("story_byeori") != GoEra.Past) Fail("벼리 표(★4 화 양손검 무용·과거)");
            if (kit == null || !kit.Sig || kit.Skill.Type != KitSkillType.Updraft || kit.Burst.Type != KitBurstType.Rally || Mathf.Abs(kit.Skill.Lift - 12f) > 0.01f) Fail("벼리 한 벌(담금질 올려베기 updraft·처음의 불 rally)");
            area.Refresh();
            field.Refresh();
            if (area.ForkPartOn("fork:rift") || area.ForkPartOn("fork:veil") || area.ForkPartOn("fork:crow") || !fk.Open()) Fail("2차 결말 뒤 고을이 풀린 채여야");
            if (!field.NpcShown("byeori") || !field.NpcShown("haemi") || !field.NpcShown("narae")) Fail("2차 결말 뒤 벼리·해미·나래가 안 섬");
            _ch38 = "38장 벼리 길목→처음의 별까마귀(뇌 2단계 방패·시작하면 멈춘 모형 사라짐)→갈무리 길목 위→갈무리 참몸(암 2단계 방패·쓰러뜨리기 전엔 하늘 틈·장막 그대로)→순간이 풀림(하늘 틈·알갱이·장막 걷힘·고개 열림·금고 유리 같은 때)→해미 길목 서쪽·고원 고개 go(고을·돌기둥 도착 자리에선 안 넘어감·안내 화살표는 나가는 돌기둥)·촌장 보상·벼리 합류(★4 화 양손검 updraft·rally)·이야기 끝";
        }

        // ---- 39장 (12부 「돌아가는 별배」 — 웹 ⑲-70) ----------------------------------------------------------

        private static void CheckChapter39(FieldCombat fc, PlayerController pc, StoryField field, StoryUi ui)
        {
            _ch39 = "39장 중단";
            StoryState.OffForTest = false;
            PlayerStats.Restore(83, 0);
            StoryState.Restore(38, 0);
            var area = AreaField.Instance;
            if (area == null) { Fail("AreaField 없음"); return; }
            area.Refresh();
            field.Refresh();
            Vector3 D(string id) => field.NpcBody(id).transform.position;
            Talk(pc, ui, "elder", "39장 촌장");
            Expect(38, 1, "촌장 뒤");                                                            // → 1 talk 하람
            Talk(pc, ui, "haram", "39장 하람");
            Expect(38, 2, "하람 뒤");                                                            // → 2 talk 반디(별배 곁)
            field.Refresh();
            Vector3 ship = GoStory.FrostPos(GoStory.BandiShip);
            if (!field.NpcShown("bandi") || GoStory.Flat(D("bandi"), ship) > 0.6f) Fail("39장 3째: 반디가 고원 별배 곁에 안 섬");
            Talk(pc, ui, "bandi", "39장 반디");
            Expect(38, 3, "반디 뒤");                                                            // → 3 kill 결정 짐승
            Vector3 killAt = GoStory.StepPos(StoryState.Current);
            if (!GoFrost.Contains(killAt) || GoStory.Flat(killAt, ship) > 25f) Fail("결정 짐승 자리가 고원 별배 곁이 아님");
            pc.Teleport(killAt + new Vector3(0f, 0.4f, GoStory.KillNear + 15f));
            field.Check(pc.transform.position);
            if (field.Squad.Count != 0) Fail("멀리서 결정 짐승 무리가 섬");
            pc.Teleport(killAt + new Vector3(0f, 0.4f, GoStory.KillNear - 15f));
            field.Check(pc.transform.position);
            if (field.Squad.Count != 4 || field.Squad.Any(e => !GoFrost.Contains(e.transform.position))) { Fail($"결정 짐승 무리 {field.Squad.Count}"); return; }
            var els = new System.Collections.Generic.HashSet<GoElement>();
            foreach (var e in field.Squad) els.Add(e.Element);
            if (!els.Contains(GoElement.Geo) || !els.Contains(GoElement.Cryo) || !els.Contains(GoElement.Electro) || !els.Contains(GoElement.Anemo)) Fail("결정 짐승 원소(암·빙·뇌·풍)");
            foreach (var e in new System.Collections.Generic.List<FieldEnemy>(field.Squad)) Kill(e);
            Expect(38, 4, "결정 짐승");                                                          // → 4 talk 한별
            field.Refresh();
            area.Refresh();
            if (!field.NpcShown("hanbyeol") || GoStory.Flat(D("hanbyeol"), GoStory.AreaPos("skyport:port", GoStory.SunkPortHanbyeol)) > 0.6f) Fail("한별이 은하 나루 착륙판 곁에 안 섬");
            int gold = GoldState.Gold, knot = TalentState.Count(GoTalent.Mat.Knot), guide = TalentState.Count(GoTalent.Mat.Guide), secret = TalentState.Count(GoTalent.Mat.Secret);
            Talk(pc, ui, "hanbyeol", "39장 끝 한별");
            if (StoryState.Ch != 39 || GoldState.Gold != gold + 9500 || TalentState.Count(GoTalent.Mat.Knot) != knot + 6 || TalentState.Count(GoTalent.Mat.Guide) != guide + 6 || TalentState.Count(GoTalent.Mat.Secret) != secret + 6) Fail("39장 끝·보상(금 9500·교본 6·비급 6·매듭 6)");
            _ch39 = "39장 촌장→하람→반디 별배 곁→결정 짐승 넷(고원·암빙뇌풍)→한별 착륙판 곁·보상";
        }

        // ---- 40장 ---------------------------------------------------------------------------------------------

        private static void CheckChapter40(FieldCombat fc, PlayerController pc, StoryField field, StoryUi ui)
        {
            _ch40 = "40장 중단";
            StoryState.OffForTest = false;
            PlayerStats.Restore(84, 0);
            StoryState.Restore(39, 0);
            var area = AreaField.Instance;
            if (area == null) { Fail("AreaField 없음"); return; }
            var fk = GoAreas.Fork;
            area.Refresh();
            field.Refresh();
            Vector3 D(string id) => field.NpcBody(id).transform.position;
            Vector3 ship = GoStory.FrostPos(GoStory.BandiShip);
            Talk(pc, ui, "hanbyeol", "40장 한별");
            Expect(39, 1, "한별 뒤");                                                            // → 1 go 나침 제단
            Vector3 altar = GoStory.StepPos(StoryState.Current);
            if (!GoFrost.Contains(altar) || GoStory.Flat(altar, ship) > 12f || GoStory.Flat(altar, GoStory.StepPos(GoStory.Chapters[38].Steps[3])) < 8f) Fail("나침 제단 자리(고원 별배 곁·결정 짐승 자리와 떨어짐)");
            pc.Teleport(altar + new Vector3(0f, 0.4f, 40f));
            field.Check(pc.transform.position);
            Expect(39, 1, "멀리서 나침 제단 단계가 넘어감");
            pc.Teleport(altar + new Vector3(0f, 0.4f, 2f));
            field.Check(pc.transform.position);
            Expect(39, 2, "나침 제단");                                                          // → 2 defend
            pc.Teleport(altar + new Vector3(0f, 0.3f, -GoStory.DefendStart - 5f));
            field.DefendTick(pc.transform.position, 0.1f);
            if (field.DefendWave != -1 || field.Squad.Count != 0) Fail("멀리서 물결이 옴");
            pc.Teleport(altar + new Vector3(0f, 0.3f, 2f));
            field.DefendTick(pc.transform.position, 0.1f);
            if (field.DefendWave != 0 || field.Squad.Count != 3) { Fail($"나침 제단 첫 물결 {field.DefendWave}·{field.Squad.Count}"); return; }
            foreach (var e in field.Squad) if (!GoFrost.Contains(e.transform.position)) Fail("물결이 서리봉 고원 밖에서 나옴");
            int[] sizes = { 3, 4, 5 };
            int wave = 0;
            for (int guard = 0; guard < 60 && StoryState.StepIndex == 2; guard++)
            {
                field.DefendTick(pc.transform.position, 0.1f);
                if (field.DefendWave > wave) { wave = field.DefendWave; if (wave < 3 && field.Squad.Count(e => e.Alive) != sizes[wave]) Fail($"물결 {wave + 1} 수 {field.Squad.Count(e => e.Alive)}"); }
                foreach (var e in new System.Collections.Generic.List<FieldEnemy>(field.Squad)) if (e.Alive) Kill(e);
            }
            Expect(39, 3, "나침 제단 물결 셋");                                                  // → 3 talk 반디(나침을 살핀 뒤)
            field.Refresh();
            if (!field.NpcShown("bandi") || GoStory.Flat(D("bandi"), ship) > 0.6f) Fail("40장 4째: 반디가 별배 곁에 안 섬");
            Talk(pc, ui, "bandi", "40장 반디");
            Expect(39, 4, "반디 뒤");                                                            // → 4 talk 나래
            field.Refresh();
            fk.TrySite("loco", out var loco);
            if (!field.NpcShown("narae") || GoStory.Flat(D("narae"), GoStory.AreaPos("fork:loco", GoStory.NaraeLoco)) > 0.6f) Fail("나래가 기관차 서쪽 끝에 안 섬");
            int gold = GoldState.Gold, knot = TalentState.Count(GoTalent.Mat.Knot), guide = TalentState.Count(GoTalent.Mat.Guide), secret = TalentState.Count(GoTalent.Mat.Secret);
            Talk(pc, ui, "narae", "40장 끝 나래");
            if (StoryState.Ch != 40 || GoldState.Gold != gold + 10250 || TalentState.Count(GoTalent.Mat.Knot) != knot + 7 || TalentState.Count(GoTalent.Mat.Guide) != guide + 7 || TalentState.Count(GoTalent.Mat.Secret) != secret + 6) Fail("40장 끝·보상(금 10250·교본 7·비급 6·매듭 7)");
            if (!PartyState.Has("story_narae")) Fail("나래가 합류 안 함");
            bool ko = GoKits.OffForTest;
            GoKits.OffForTest = false;
            var kit = GoKits.KitOf("story_narae", GoElement.Hydro);
            GoKits.OffForTest = ko;
            if (!GoHeroes.TryGet("story_narae", out var hh) || hh.Era != HeroEra.Story || hh.Rarity != 4 || GoHeroes.ElementOf(hh) != GoElement.Hydro || hh.Trait != HeroTrait.Wisdom || GoWeapons.TypeOf("story_narae") != GoWeapons.Type.Catalyst || GoStory.MemberEra("story_narae") != GoEra.Modern) Fail("나래 표(★4 수 법구 지혜·현대)");
            if (kit == null || !kit.Sig || kit.Skill.Type != KitSkillType.Zone || kit.Burst.Type != KitBurstType.Lore || Mathf.Abs(kit.Burst.RMul - 1.4f) > 0.001f) Fail("나래 한 벌(측량선 긋기 zone·삼각측량 lore)");
            _ch40 = "40장 한별→나침 제단 가기(멀리서 안 넘어감)·지키기 물결 셋(3·4·5, 고원 안)→반디 별배 곁→나래 기관차 서쪽·합류(수 법구 zone·lore)·보상";
        }

        // ---- 41장 ---------------------------------------------------------------------------------------------

        private static void CheckChapter41(FieldCombat fc, PlayerController pc, StoryField field, StoryUi ui)
        {
            _ch41 = "41장 중단";
            StoryState.OffForTest = false;
            PlayerStats.Restore(85, 0);
            StoryState.Restore(40, 0);
            var area = AreaField.Instance;
            if (area == null) { Fail("AreaField 없음"); return; }
            var fk = GoAreas.Fork;
            area.Refresh();
            field.Refresh();
            Vector3 D(string id) => field.NpcBody(id).transform.position;
            if (!field.NpcShown("haemi") || GoStory.Flat(D("haemi"), GoStory.AreaPos("fork:junction", GoStory.HaemiJunction)) > 0.6f) Fail("41장 첫 단계: 해미가 길목 서쪽에 안 섬");
            Talk(pc, ui, "haemi", "41장 해미");
            Expect(40, 1, "해미 뒤");                                                            // → 1 talk 소담(곳간 마을)
            field.Refresh();
            if (!field.NpcShown("sodam") || GoStory.Flat(D("sodam"), GoStory.AreaPos("vault:granary", GoStory.SodamGranary40)) > 0.6f) Fail("41장 2째: 소담이 곳간 문 앞에 안 섬");
            Talk(pc, ui, "sodam", "41장 소담");
            Expect(40, 2, "소담 뒤");                                                            // → 2 go 고을 마당
            field.Refresh();
            if (GoStory.Flat(D("sodam"), GoStory.AreaPos("fork:junction", GoStory.SodamJunction)) > 0.6f) Fail("41장 3째: 소담이 같이 고을 길목에 안 섬");
            Vector3 go = GoStory.StepPos(StoryState.Current);
            if (!fk.Contains(go)) Fail("고을 마당 가기 자리가 세갈래 고을 안이 아님");
            pc.Teleport(go + new Vector3(0f, 0.4f, 30f));
            field.Check(pc.transform.position);
            Expect(40, 2, "멀리서 고을 마당 단계가 넘어감");
            pc.Teleport(go + new Vector3(0f, 0.4f, 1f));
            field.Check(pc.transform.position);
            Expect(40, 3, "고을 마당");                                                          // → 3 duel 갈무리의 싹
            field.Check(pc.transform.position);
            if (field.Squad.Count != 1) { Fail($"갈무리의 싹 {field.Squad.Count}"); return; }
            var sprout = field.Squad[0];
            if (!sprout.IsStoryBoss || sprout.DisplayName != GoLocalization.T("story.boss.seedgiant", "갈무리의 싹") || sprout.Element != GoElement.Dendro || sprout.CurrentMove != FieldEnemy.BossMove.Slam) Fail($"싹 이름·초·첫 수 {sprout.DisplayName}·{sprout.Element}·{sprout.CurrentMove}");
            if (!fk.Contains(sprout.transform.position) || GoStory.Flat(sprout.transform.position, GoStory.AreaPos("fork:junction", GoStory.ForkCrowAt)) > 14f) Fail("싹이 고을 마당(길목 남쪽)이 아님");
            sprout.SetShieldForTest(0f);
            sprout.TakeRaw(sprout.Hp - sprout.MaxHp * 0.45f, Color.white);
            field.DuelTickForTest();
            if (!sprout.Shielded || sprout.Element != GoElement.Dendro || field.Squad.Count != 3) Fail($"2단계 초 방패·졸개 {sprout.Element}·{field.Squad.Count}");
            Kill(sprout);
            Expect(40, 4, "갈무리의 싹");                                                        // → 4 talk 벼리
            field.Refresh();
            if (!field.NpcShown("byeori") || GoStory.Flat(D("byeori"), GoStory.AreaPos("fork:junction", GoStory.ByeoriJunction)) > 0.6f) Fail("벼리가 길목 동남쪽에 안 섬");
            Talk(pc, ui, "byeori", "41장 벼리");
            Expect(40, 5, "벼리 뒤");                                                            // → 5 talk 촌장
            field.Refresh();
            if (!field.NpcShown("sodam") || GoStory.Flat(D("sodam"), GoStory.GridPos(0.94f, 3.03f)) > 0.6f) Fail("소담이 촌장 곁에 안 섬");
            int gold = GoldState.Gold, knot = TalentState.Count(GoTalent.Mat.Knot), guide = TalentState.Count(GoTalent.Mat.Guide), secret = TalentState.Count(GoTalent.Mat.Secret);
            Talk(pc, ui, "elder", "41장 끝 촌장");
            if (StoryState.Ch != 41 || GoldState.Gold != gold + 12500 || TalentState.Count(GoTalent.Mat.Knot) != knot + 10 || TalentState.Count(GoTalent.Mat.Guide) != guide + 10 || TalentState.Count(GoTalent.Mat.Secret) != secret + 8) Fail("41장 끝·보상(금 12500·교본 10·비급 8·매듭 10)");
            if (!StoryState.Done) Fail("이야기 표 끝(3차 결말)인데 Done 이 아님");
            if (!PartyState.Has("story_sodam")) Fail("소담이 합류 안 함");
            bool ko = GoKits.OffForTest;
            GoKits.OffForTest = false;
            var kit = GoKits.KitOf("story_sodam", GoElement.Anemo);
            GoKits.OffForTest = ko;
            if (!GoHeroes.TryGet("story_sodam", out var hh) || hh.Era != HeroEra.Story || hh.Rarity != 4 || GoHeroes.ElementOf(hh) != GoElement.Anemo || hh.Trait != HeroTrait.Virtue || GoWeapons.TypeOf("story_sodam") != GoWeapons.Type.Catalyst || GoStory.MemberEra("story_sodam") != GoEra.Past) Fail("소담 표(★4 풍 법구 덕·과거)");
            if (kit == null || !kit.Sig || kit.Skill.Type != KitSkillType.Shells || kit.Burst.Type != KitBurstType.Vortex || kit.Skill.N != 4) Fail("소담 한 벌(낟알 흩뿌리기 shells·곳간 노래 vortex)");
            if (GoHeroes.Story.Length != 16) Fail($"이야기 동료 {GoHeroes.Story.Length} ≠ 16");
            _ch41 = "41장 해미 길목 서쪽→소담 곳간 문 앞→고을 마당 가기(멀리서 안 넘어감)→갈무리의 싹(초 2단계 방패·졸개 둘)→벼리→촌장·소담 합류(풍 법구 shells·vortex)·이야기 끝";
        }

        // ---- 글 흘러나옴·대화 카메라 -------------------------------------------------------------------------

        private static void CheckReveal(PlayerController pc, StoryUi ui)
        {
            var rig = Object.FindFirstObjectByType<CameraRig>();
            StoryState.Restore(0, 0);
            PlayerStats.Restore(1, 0);
            StoryUi.RevealCps = GoStory.RevealCps;
            Near(pc, GoStory.NpcPos("elder"));
            ui.Refresh();
            float zoom0 = rig != null ? rig.CurrentZoom : 0f;
            if (!ui.StartTalk()) { Fail("대화가 안 열림(흘러나옴)"); return; }
            if (!ui.Revealing) Fail("글이 한 번에 다 나옴");
            if (rig != null && (!rig.TalkShot || Mathf.Abs(rig.CurrentZoom - CameraRig.TalkZoom) > 0.01f)) Fail("대화 카메라가 안 붙음");
            string first = ui.LineText;
            ui.Next(-1);
            if (ui.Revealing || ui.LineText != first) Fail("한 번 누르면 줄 전체가 나와야");
            ui.Next(-1);
            if (ui.LineText == first) Fail("두 번째 누르면 다음 줄");
            ui.ResetForTest();
            if (StoryState.Talking || (rig != null && (rig.TalkShot || Mathf.Abs(rig.CurrentZoom - zoom0) > 0.01f))) Fail("대화를 닫아도 카메라가 안 돌아옴");
            StoryUi.RevealCps = 0f;
        }

        private static void CheckBossAlreadyDown(StoryField field)
        {
            StoryState.Restore(0, 2);
            GuardianState.Restore(true, true, 0);
            field.Check(FieldCombat.Instance.transform.position);
            Expect(0, 3, "이미 쓰러진 수호장");
            GuardianState.Restore(false);
            GuardianBloom.Instance?.Refresh();
        }

        private static void CheckIdle(PlayerController pc, StoryField field)
        {
            StoryState.Restore(0, 0);
            field.ResetForTest();
            Near(pc, GoStory.NpcPos("ferryman"));
            field.Check(pc.transform.position);
            if (field.LastIdleNpc != "ferryman") Fail("버들 혼잣말이 없다");
            StoryState.Restore(0, 3);
            field.ResetForTest();
            field.Check(pc.transform.position);
            if (field.LastIdleNpc != null) Fail("버들과 이야기할 단계인데 혼잣말");
        }

        private static void CheckSave(string savePath)
        {
            StoryState.Restore(1, 2);
            if (!SaveState.Save()) { Fail("SaveState.Save 실패"); return; }
            string json = System.IO.File.ReadAllText(savePath);
            if (!json.Contains("\"version\":28") || !json.Contains("\"storyCh\":1,\"storyStep\":2")) Fail("세이브 v28 에 이야기가 없다");
            StoryState.Restore(0, 0);
            if (!SaveState.TryLoad() || StoryState.Ch != 1 || StoryState.StepIndex != 2) Fail("v28 왕복 뒤 이야기가 달라짐");
            string v27 = Regex.Replace(json.Replace("\"version\":28", "\"version\":27"), ",\"storyCh\":\\d+,\"storyStep\":\\d+", "");
            if (v27.Contains("storyCh")) { Fail("v27 가짜 파일 만들기 실패"); return; }
            System.IO.File.WriteAllText(savePath, v27);
            StoryState.Restore(1, 2);
            if (!SaveState.TryLoad() || StoryState.Ch != 0 || StoryState.StepIndex != 0) Fail("v27 파일 — 1장 처음으로 안 읽힘");
        }
    }
}
