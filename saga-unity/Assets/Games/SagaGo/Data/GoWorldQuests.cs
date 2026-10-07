using UnityEngine;
using Saga.Go.Combat;

namespace Saga.Go.Data
{
    /// <summary>
    /// PLAN.md 109-14-21 세계 임무(곁가지) 셋 — 표만(웹 사가만리 ⑲-21 `worldquest.js`, saga-godot 106 ㊴). 진행은 이야기와 같은 단계 엔진(`StoryState`)의
    /// "따라가는 줄"(`StoryState.Track`) — 따라가는 것 하나만 목표·추적 줄·임무 적·금빛 기둥이 선다. 상태는 `WorldQuestState`, 인물은 `GoStory.Npcs`(wq_*).
    /// 전체 퓨전 — 임무마다 과거·현대·미래 인물이 한 사건에. 대사는 웹 그대로, 땅 이름만 이 판 이름. 보상은 웹 값(부대 경험은 이 트랙에 없어 뺀다).
    /// 괴물은 이 판 몸 다섯에 원소를 입혀 대신한다(14-1b 전까지 — 회오리매 = 풍 번개귀, 멧돼지 = 산적, 외계인 = 뇌 해골, 두꺼비 = 물귀신, 눈여우 = 빙 물귀신,
    /// 날쌘용 = 번개귀, 망자 = 해골, 덩굴 = 초 산적, 바위곰 = 암 물귀신).
    /// </summary>
    public static class GoWorldQuests
    {
        public class Quest
        {
            public string Id, NameKey, NameKo, PlaceKey, PlaceKo, Giver;
            /// <summary>여정 등급(= 부대 레벨)이 이만큼이어야 맡는다.</summary>
            public int Ar, Gold;
            /// <summary>`GoTalent.Mat` 순서(쪽지·교본·비전·매듭·비늘).</summary>
            public int[] Mats;
            public GoStory.Step[] Steps;
        }

        public static int IndexOf(string id)
        {
            for (int i = 0; i < Quests.Length; i++) if (Quests[i].Id == id) return i;
            return -1;
        }

        public static string Name(Quest w) => GoLocalization.T(w.NameKey, w.NameKo);
        public static string Place(Quest w) => GoLocalization.T(w.PlaceKey, w.PlaceKo);

        /// <summary>끝 보상 한 줄 — 이야기 장과 같은 꼴.</summary>
        public static string RewardText(Quest w)
        {
            var parts = new System.Collections.Generic.List<string> { string.Format(GoLocalization.T("story.gold", "금 +{0}"), w.Gold) };
            for (int i = 0; i < w.Mats.Length; i++) if (w.Mats[i] > 0) parts.Add($"{GoTalent.MatName((GoTalent.Mat)i)} +{w.Mats[i]}");
            return string.Join(" · ", parts);
        }

        public static readonly Quest[] Quests =
        {
            new Quest
            {
                Id = "wq_letters", NameKey = "wq.letters", NameKo = "바람에 흩어진 편지", PlaceKey = "wq.letters.place", PlaceKo = "청하 마을", Ar = 3, Giver = "wq_postmaster",
                Gold = 600, Mats = new[] { 0, 2, 0, 1, 0 },
                Steps = new[]
                {
                    new GoStory.Step { Type = GoStory.StepType.Talk, Npc = "wq_postmaster", TextKey = "wq.letters.s1", TextKo = "역참지기 묵호의 부탁 듣기",
                        Lines = new[]
                        {
                            GoStory.L("wq_postmaster", "wq.letters.s1.l1", "어이, 거기 젊은이! 돌개바람이 역참 편지 자루를 뒤집어 놨지 뭔가."),
                            GoStory.L("wq_postmaster", "wq.letters.s1.l2", "세 통이 날아갔어. 한 통은 배달꾼 다래가 주웠다더군. 그 애는 늘 마을 들판을 누비지."),
                            GoStory.Pick("wq.letters.s1.p", "찾아 드릴게요.", "편지가 그렇게 중요해요?"),
                            GoStory.L("wq_postmaster", "wq.letters.s1.l3", "먼 데서 온 편지는 사람을 살리기도 하지. 부탁하네."),
                        } },
                    new GoStory.Step { Type = GoStory.StepType.Talk, Npc = "wq_rider", TextKey = "wq.letters.s2", TextKo = "배달꾼 다래에게 편지 묻기",
                        Lines = new[]
                        {
                            GoStory.L("wq_rider", "wq.letters.s2.l1", "아, 역참 편지? 한 통은 내 짐칸에 있어. 근데 둘째는…"),
                            GoStory.L("wq_rider", "wq.letters.s2.l2", "배달 기계 둥실이가 물고 달아났어! 요즘 경로가 꼬였는지 아무거나 배달하려 들더라."),
                            GoStory.Pick("wq.letters.s2.p", "잡아 올게요!", "기계가 편지를요?"),
                            GoStory.L("wq_rider", "wq.letters.s2.l3", "저기 날아간다! 걸어선 못 잡아 — 달려!"),
                        } },
                    new GoStory.Step { Type = GoStory.StepType.Chase, Npc = "wq_dungsil", EnterKey = "wq.letters.flee", EnterKo = "🏃 둥실이가 편지를 물고 날아간다 — 달려라!", WinKey = "wq.letters.caught", WinKo = "🏃 둥실이를 붙잡았다 — 편지를 물고 있다", LostKey = "wq.letters.lost", LostKo = "💨 놓쳤다 — 둥실이가 처음 자리로 돌아갔다. 다시 가까이 가면 달아난다", TextKey = "wq.letters.s3", TextKo = "편지를 물고 달아나는 둥실이 따라잡기(달리기)" },
                    new GoStory.Step { Type = GoStory.StepType.Talk, Npc = "wq_dungsil", TextKey = "wq.letters.s4", TextKo = "붙잡힌 둥실이 달래기",
                        Lines = new[]
                        {
                            GoStory.L("wq_dungsil", "wq.letters.s4.l1", "삐빅 — 수신인 확인 불가. 편지 한 통 반환합니다."),
                            GoStory.L("wq_dungsil", "wq.letters.s4.l2", "셋째 편지 위치 기록: 북서쪽 숲 언덕. 돌개바람 괴물이 둥지로 가져감. 경고 — 위험."),
                            GoStory.Pick("wq.letters.s4.p", "고마워, 둥실아.", "괴물이라고?"),
                            GoStory.L("wq_rider", "wq.letters.s4.l3", "둥실이 경로는 내가 고쳐 둘게. 셋째 편지는 부탁해!"),
                        } },
                    new GoStory.Step { Type = GoStory.StepType.Kill, Gx = 0.45f, Gy = 1.75f, Foes = new[] { GoStory.F(FieldEnemy.Kind.StormWraith, GoElement.Anemo), GoStory.F(FieldEnemy.Kind.StormWraith, GoElement.Anemo), GoStory.F(FieldEnemy.Kind.Bandit) }, TextKey = "wq.letters.s5", TextKo = "북서쪽 숲 언덕의 돌개바람 둥지에서 편지 되찾기" },
                    new GoStory.Step { Type = GoStory.StepType.Talk, Npc = "wq_postmaster", TextKey = "wq.letters.s6", TextKo = "묵호에게 편지 세 통 돌려주기",
                        Lines = new[]
                        {
                            GoStory.L("wq_postmaster", "wq.letters.s6.l1", "세 통 다! 이 늙은이 체면이 섰네."),
                            GoStory.L("wq_postmaster", "wq.letters.s6.l2", "허허, 봉투를 보게 — 하나는 옛 파발 도장, 하나는 요즘 우편 도장, 하나는 빛으로 찍힌 도장이야. 시절이 뒤섞였구먼."),
                            GoStory.L("wq_postmaster", "wq.letters.s6.l3", "어느 시절에서 왔든 편지는 편지지. 고맙네. 약소하지만 받게."),
                        } },
                }
            },
            new Quest
            {
                Id = "wq_lighthouse", NameKey = "wq.lighthouse", NameKo = "세 시절의 등대", PlaceKey = "wq.lighthouse.place", PlaceKo = "강가 나루", Ar = 8, Giver = "wq_researcher",
                Gold = 750, Mats = new[] { 0, 3, 0, 1, 0 },
                Steps = new[]
                {
                    new GoStory.Step { Type = GoStory.StepType.Talk, Npc = "wq_researcher", TextKey = "wq.lighthouse.s1", TextKo = "바다 연구원 물결의 이야기 듣기",
                        Lines = new[]
                        {
                            GoStory.L("wq_researcher", "wq.lighthouse.s1.l1", "밤마다 동쪽 물가 끝에서 빛 신호가 와. 옛 봉수 무늬인데… 파형은 아주 새것이야."),
                            GoStory.L("wq_researcher", "wq.lighthouse.s1.l2", "거긴 옛 등대 터밖에 없거든. 같이 가서 봐 줄래?"),
                            GoStory.Pick("wq.lighthouse.s1.p", "가 볼게요.", "옛 봉수 무늬요?"),
                            GoStory.L("wq_researcher", "wq.lighthouse.s1.l3", "불 하나면 평안, 둘이면 적, 셋이면 싸움. 그런데 신호는 '불을 달라'야."),
                        } },
                    new GoStory.Step { Type = GoStory.StepType.Go, Gx = GoStory.LightGx, Gy = GoStory.LightGy, TextKey = "wq.lighthouse.s2", TextKo = "동쪽 물가 끝 옛 등대 터로" },
                    new GoStory.Step { Type = GoStory.StepType.Talk, Npc = "wq_hanbit", TextKey = "wq.lighthouse.s3", TextKo = "등대 터에 나타난 빛 사람과 이야기하기",
                        Lines = new[]
                        {
                            GoStory.L("wq_hanbit", "wq.lighthouse.s3.l1", "신원 확인. 등대 지기 한빛, 먼 뒷날의 이 등대를 지키는 기계입니다."),
                            GoStory.L("wq_hanbit", "wq.lighthouse.s3.l2", "시간 틈으로 신호만 겨우 닿고 있습니다. 옛 봉수 불씨가 켜지면 길이 이어집니다."),
                            GoStory.Pick("wq.lighthouse.s3.p", "불씨를 켤게요.", "먼 뒷날이라고요?"),
                            GoStory.L("wq_hanbit", "wq.lighthouse.s3.l3", "경고 — 불씨 둘레에 무리가 모여 있습니다. 불빛을 싫어하는 것들입니다."),
                        } },
                    new GoStory.Step { Type = GoStory.StepType.Kill, Gx = GoStory.LightGx - 0.1f, Gy = GoStory.LightGy - 0.12f, Foes = new[] { GoStory.F(FieldEnemy.Kind.Skeleton, GoElement.Electro), GoStory.F(FieldEnemy.Kind.DrownedGhost), GoStory.F(FieldEnemy.Kind.DrownedGhost) }, TextKey = "wq.lighthouse.s4", TextKo = "등대 터를 차지한 무리 물리치기" },
                    new GoStory.Step { Type = GoStory.StepType.Light, Gx = GoStory.LightGx, Gy = GoStory.LightGy, TextKey = "wq.lighthouse.s5", TextKo = "옛 봉수대에 원소 불 켜기" },
                    new GoStory.Step { Type = GoStory.StepType.Talk, Npc = "wq_researcher", TextKey = "wq.lighthouse.s6", TextKo = "물결에게 알리기",
                        Lines = new[]
                        {
                            GoStory.L("wq_researcher", "wq.lighthouse.s6.l1", "봤어? 불이 켜지자마자 등대 터에 빛 기둥이 섰다가 사라졌어!"),
                            GoStory.L("wq_researcher", "wq.lighthouse.s6.l2", "먼 뒷날의 등대 지기라니… 기록장이 모자라겠어. 이건 연구소에서 나온 사례금이야."),
                        } },
                }
            },
            new Quest
            {
                Id = "wq_rift", NameKey = "wq.rift", NameKo = "성터의 시간 틈", PlaceKey = "wq.rift.place", PlaceKo = "북쪽 산기슭", Ar = 12, Giver = "wq_byeori",
                Gold = 900, Mats = new[] { 0, 3, 2, 1, 0 },
                Steps = new[]
                {
                    new GoStory.Step { Type = GoStory.StepType.Talk, Npc = "wq_byeori", TextKey = "wq.rift.s1", TextKo = "시간 탐사대원 별이 돕기",
                        Lines = new[]
                        {
                            GoStory.L("wq_byeori", "wq.rift.s1.l1", "안녕! 난 먼 뒷날에서 온 탐사대원이야. 시간 틈을 재다가… 여기로 떨어졌어."),
                            GoStory.L("wq_byeori", "wq.rift.s1.l2", "돌아가려면 틈을 한 번 더 열어야 해. 틈 괴물들이 틈 조각을 삼켜 버렸지 뭐야."),
                            GoStory.Pick("wq.rift.s1.p", "되찾아 줄게요.", "틈 괴물?"),
                            GoStory.L("wq_byeori", "wq.rift.s1.l3", "동쪽 무너진 기둥 사이에 모여 있어. 조심해!"),
                        } },
                    new GoStory.Step { Type = GoStory.StepType.Kill, Gx = 4.6f, Gy = 1.6f, Foes = new[] { GoStory.F(FieldEnemy.Kind.DrownedGhost, GoElement.Cryo), GoStory.F(FieldEnemy.Kind.StormWraith), GoStory.F(FieldEnemy.Kind.EmberImp) }, TextKey = "wq.rift.s2", TextKo = "틈 괴물을 물리쳐 틈 조각 되찾기" },
                    new GoStory.Step { Type = GoStory.StepType.Talk, Npc = "wq_byeori", TextKey = "wq.rift.s3", TextKo = "별이에게 틈 조각 건네기",
                        Lines = new[]
                        {
                            GoStory.L("wq_byeori", "wq.rift.s3.l1", "조각 셋 다! 이제 틈을 열 자리가 필요한데… 이 성터 돌에 새긴 글이 내 기록이랑 맞아."),
                            GoStory.L("wq_byeori", "wq.rift.s3.l2", "서쪽 끝에 옛 석공이 서성이던데, 돌을 잘 아는 사람 같더라."),
                        } },
                    new GoStory.Step { Type = GoStory.StepType.Talk, Npc = "wq_dolsoe", TextKey = "wq.rift.s4", TextKo = "옛 석공 돌쇠에게 묻기",
                        Lines = new[]
                        {
                            GoStory.L("wq_dolsoe", "wq.rift.s4.l1", "이 돌 제단 말인가? 내가 쌓았지. 아니, 쌓을 참이지… 헷갈리는군. 날짜가 엉켰어."),
                            GoStory.L("wq_dolsoe", "wq.rift.s4.l2", "석등 셋을 달 → 해 → 별 차례로 밝히면 돌이 문이 된다네. 내 스승이 그리 일렀어."),
                            GoStory.Pick("wq.rift.s4.p", "해 볼게요.", "문이 되면요?"),
                            GoStory.L("wq_dolsoe", "wq.rift.s4.l3", "문이 열리는 동안 틈에서 뭔가 몰려나올 게야. 제단을 지키게."),
                        } },
                    new GoStory.Step { Type = GoStory.StepType.Seal, Gx = GoStory.RiftGx, Gy = GoStory.RiftGy, Order = new[] { "moon", "sun", "star" }, TextKey = "wq.rift.s5", TextKo = "틈 제단 석등을 차례대로 밝히기" },
                    new GoStory.Step { Type = GoStory.StepType.Defend, Gx = GoStory.RiftGx, Gy = GoStory.RiftGy, NameKey = "wq.rift.altar", NameKo = "틈 제단", Dirs = new[] { 0f, 72f, 144f, 216f, 288f },
                        Waves = new[] { new[] { GoStory.F(FieldEnemy.Kind.DrownedGhost, GoElement.Cryo), GoStory.F(FieldEnemy.Kind.StormWraith), GoStory.F(FieldEnemy.Kind.Skeleton) }, new[] { GoStory.F(FieldEnemy.Kind.EmberImp), GoStory.F(FieldEnemy.Kind.Bandit, GoElement.Dendro), GoStory.F(FieldEnemy.Kind.DrownedGhost, GoElement.Geo) } }, TextKey = "wq.rift.s6", TextKo = "틈이 열리는 동안 제단 지키기" },
                    new GoStory.Step { Type = GoStory.StepType.Talk, Npc = "wq_dolsoe", TextKey = "wq.rift.s7", TextKo = "돌쇠와 이야기하기",
                        Lines = new[]
                        {
                            GoStory.L("wq_dolsoe", "wq.rift.s7.l1", "허허, 문이 섰구먼. 이제 내 날짜도 제자리로 돌아가겠지."),
                            GoStory.L("wq_dolsoe", "wq.rift.s7.l2", "그 아이한테 전하게 — 돌은 오래 기다려 준다고."),
                        } },
                    new GoStory.Step { Type = GoStory.StepType.Talk, Npc = "wq_byeori", TextKey = "wq.rift.s8", TextKo = "별이 배웅하기",
                        Lines = new[]
                        {
                            GoStory.L("wq_byeori", "wq.rift.s8.l1", "틈이 열렸어! 이제 돌아갈 수 있어."),
                            GoStory.L("wq_byeori", "wq.rift.s8.l2", "먼 뒷날 이 성터는 공원이 돼. 네 이름도 안내판에 있을지 몰라 — 농담이야! 이건 탐사대 비상금."),
                            GoStory.Pick("wq.rift.s8.p", "잘 가요!", "또 만나요."),
                            GoStory.L("wq_byeori", "wq.rift.s8.l3", "시간 틈이 또 열리면, 그땐 내가 널 도우러 올게."),
                        } },
                }
            },
        };
    }
}
