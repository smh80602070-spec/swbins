using UnityEngine;

namespace Saga.Dungeon.Data
{
    /// <summary>
    /// PLAN.md 109-10-6 "지역 사연(事緣) 사슬" — 웹 사가블로 §5.14 결(코드 공유 없음, 웹 `data-quest.js` CHAINS·chainStep·CHAIN_ALL 의 글·수치를 옮겼다).
    /// 지역에 처음 들어서면(들어섬 배너) 그 지역 사슬이 열리고, 네 걸음을 **순서대로만**: ① 토벌 → ② 흔적 → ③ 정예 → ④ 우두머리(§5.13).
    /// ④에 닿으면 쉬던 우두머리의 쉼을 지운다. 우두머리를 먼저 잡아도 걸음은 안 건너뛴다. 넷째를 마치면 평정, 아홉 다 평정하면 구주 평정 한 번.
    /// 수치(L = 지역 기본 위험도): 토벌 10 + 2L · 정예 3(중원 2) · 금 60+30L / 80+40L / 100+50L / 400+200L · 경험 10+5L / 15+5L / 20+8L / 60+20L ·
    /// 평정 공적 20 + L(공적 화폐가 없어 × 50 냥) · 구주 평정 금 20000·경험 1000·공적 100.
    /// **이 트랙 다름**: 웹 들판엔 몬스터가 늘 돌지만 이 트랙 칸(마을·갈림길)엔 적이 없다 → ①·③ 걸음 동안만 그 칸 **사냥터**에 지역 무리가 선다
    /// (① 잡졸 셋 · ③ 정예 = 남은 수만큼, 지역 시대 몸 · 위험도 층 공식 — §5.13 명단 결). 칸을 떠나면 물러나고 돌아오면 다시 선다.
    /// ① 은 그 지역에서 쓰러진 적 누구든 센다(처치 자리로 판정 — 던전 층·시련/난입 방은 지역 밖이라 안 셈), ③ 은 정예 표시가 된 적(사냥터 정예·우두머리 호위)과 우두머리.
    /// ② 흔적 = 칸 방 안 고정 자리(우두머리 표식·사냥터와 4m 넘게 떨어짐), 그 걸음일 때만 빛나는 작은 흔적이 서고 1.6m 안에 닿으면 찾음.
    /// 웹 흔적 이름 앞 그림 문자(🚩🪨🪧 …)는 대체 글꼴에 없는 것이 섞여 뺐다(🔍 하나로).
    /// </summary>
    public static class DungeonRegionSagas
    {
        public const int Steps = 4;
        public const float ClueRadius = 1.6f;
        public const int HuntPack = 3;
        public const float HuntRespawnSec = 3f;
        public const int AllGold = 20000;
        public const int AllExp = 1000;
        public const int AllMerit = 100;

        public struct Saga
        {
            public string TitleKo, GiverKo, IntroKo, ClueKo, FoundKo, EliteKo, DoneKo;
            /// <summary>흔적 자리·사냥터(세계 좌표) — 칸 방 안, 우두머리 표식과 방 가운데를 두고 돌려 놓은 자리(겹침·문길·꾸밈 모서리 비킴).</summary>
            public Vector3 Clue, Hunt;
        }

        /// <summary>`DungeonWorldMap.All` 순서 — 웹 CHAINS 글 그대로.</summary>
        public static readonly Saga[] All =
        {
            new Saga { TitleKo = "흑기 도적의 밤", GiverKo = "벌판 역참지기",
                IntroKo = "밤마다 검은 깃발 무리가 역참을 턴다 — 벌판부터 조용히 시켜 달라",
                ClueKo = "불탄 역참 깃발", FoundKo = "깃발 밑에 끼인 약탈 장부 — 두목의 진지가 적혀 있다",
                EliteKo = "도적 무리의 정예 척후", DoneKo = "벌판 길에 다시 수레가 다닌다",
                Clue = new Vector3(6.4f, 0f, -5.6f), Hunt = new Vector3(-5.6f, 0f, 4.9f) },
            new Saga { TitleKo = "멈춘 공장의 심장", GiverKo = "고물 줍는 아이",
                IntroKo = "공장 쪽에서 쇠 긁는 소리가 밤새 난다 — 무서워서 못 가겠다",
                ClueKo = "깜빡이는 비상등 상자", FoundKo = "상자 속 기록기가 \"둥지\" 라는 말과 좌표를 되풀이한다",
                EliteKo = "공장을 지키는 강철 정예", DoneKo = "굴뚝 아래가 조용해졌다 — 아이가 고철을 한 아름 들고 온다",
                Clue = new Vector3(35.2f, 0f, 5.2f), Hunt = new Vector3(25.45f, 0f, -4.55f) },
            new Saga { TitleKo = "물 빠진 바다의 노래", GiverKo = "염전 늙은 뱃사공",
                IntroKo = "썰물 때마다 갯벌 밑에서 무언가 운다 — 배가 셋이나 사라졌다",
                ClueKo = "녹슨 관측탑 일지", FoundKo = "마지막 장 — \"촉수, 물길 셋째 갈래 아래\" 라고 적혀 있다",
                EliteKo = "갯벌의 정예 괴물", DoneKo = "밀물이 제 소리로 돌아왔다 — 뱃사공이 소금 한 섬을 내민다",
                Clue = new Vector3(35.2f, 0f, -26.8f), Hunt = new Vector3(25.45f, 0f, -32.8f) },
            new Saga { TitleKo = "갈라진 땅의 문지기", GiverKo = "떠돌이 퇴마사",
                IntroKo = "균열이 해마다 한 뼘씩 넓어진다 — 새어 나오는 것들부터 막아야 한다",
                ClueKo = "금 간 봉인비", FoundKo = "비문의 마지막 글자가 불에 녹았다 — 문지기가 안에서 깼다",
                EliteKo = "균열에서 나온 정예 원귀", DoneKo = "봉인비에 새 글자가 새겨졌다 — 균열이 멈췄다",
                Clue = new Vector3(6.8f, 0f, -27.2f), Hunt = new Vector3(-4.55f, 0f, -32.8f) },
            new Saga { TitleKo = "과열된 태양로", GiverKo = "개척지 정비공",
                IntroKo = "태양로 온도가 계속 오른다 — 주변 기계들이 미쳐 날뛴다",
                ClueKo = "꺼진 제어 단말", FoundKo = "마지막 기록 — \"냉각 실패. 거신 기동\" 이 붉게 떠 있다",
                EliteKo = "폭주한 기계 정예", DoneKo = "태양판 위로 다시 새가 앉는다 — 개척지에 불이 들어왔다",
                Clue = new Vector3(-26f, 0f, -34f), Hunt = new Vector3(-33.5f, 0f, -26.5f) },
            new Saga { TitleKo = "끊긴 대상 길", GiverKo = "대상 우두머리",
                IntroKo = "서역 길목이 막힌 지 석 달 — 낙타도 짐도 돌아오지 않는다",
                ClueKo = "모래에 묻힌 낙타 방울", FoundKo = "방울 곁에 거대한 뿔 자국 — 발자국이 모래바다 쪽으로 이어진다",
                EliteKo = "길목을 지키는 정예 짐승", DoneKo = "방울 소리가 다시 들린다 — 대상이 비단 한 필을 남기고 떠난다",
                Clue = new Vector3(-33.2f, 0f, -5.2f), Hunt = new Vector3(-27.2f, 0f, 4.55f) },
            new Saga { TitleKo = "칼을 든 수호장", GiverKo = "사당지기 도사",
                IntroKo = "하늘 사당의 수호장이 사당을 버렸다 — 그 칼끝이 이제 우리를 향한다",
                ClueKo = "빛이 꺼진 홀로그램 비석", FoundKo = "비석에 남은 마지막 빛 — 수호장의 맹세가 거꾸로 새겨져 있다",
                EliteKo = "타락을 따른 정예", DoneKo = "비석에 빛이 돌아왔다 — 도사가 향을 사른다",
                Clue = new Vector3(-25.2f, 0f, 26f), Hunt = new Vector3(-34.2f, 0f, 33.5f) },
            new Saga { TitleKo = "산성의 거한", GiverKo = "케이블카 기사",
                IntroKo = "산성 폐허에 누가 눌러앉아 케이블카가 끊겼다 — 골짜기가 고립됐다",
                ClueKo = "멈춘 케이블카 칸", FoundKo = "칸 안에 얼어붙은 커다란 손자국 — 산성 꼭대기로 이어진다",
                EliteKo = "설산의 정예 짐승", DoneKo = "케이블카가 다시 움직인다 — 골짜기에 불빛이 켜졌다",
                Clue = new Vector3(-5.2f, 0f, 85.2f), Hunt = new Vector3(4.55f, 0f, 94.2f) },
            new Saga { TitleKo = "스스로 일어선 고철", GiverKo = "떠돌이 수리 로봇",
                IntroKo = "쓰러진 기계들이 하나씩 사라진다 — 누군가 그것들을 모으고 있다",
                ClueKo = "반쯤 묻힌 조립 설계도", FoundKo = "설계도 가장자리에 거대한 몸의 도면 — 이미 완성됐다고 적혀 있다",
                EliteKo = "고철 거신의 정예 부품", DoneKo = "황무지의 기계들이 잠들었다 — 수리 로봇이 나사 한 줌을 건넨다",
                Clue = new Vector3(28f, 0f, 37f), Hunt = new Vector3(25f, 0f, 33f) },
        };

        private static string K(int r) => DungeonWorldMap.All[r].Key;
        public static string Title(int r) => DungeonLocalization.T($"saga.{K(r)}.title", All[r].TitleKo);
        public static string Giver(int r) => DungeonLocalization.T($"saga.{K(r)}.giver", All[r].GiverKo);
        public static string Intro(int r) => DungeonLocalization.T($"saga.{K(r)}.intro", All[r].IntroKo);
        public static string Clue(int r) => DungeonLocalization.T($"saga.{K(r)}.clue", All[r].ClueKo);
        public static string Found(int r) => DungeonLocalization.T($"saga.{K(r)}.found", All[r].FoundKo);
        public static string Elite(int r) => DungeonLocalization.T($"saga.{K(r)}.elite", All[r].EliteKo);
        public static string Done(int r) => DungeonLocalization.T($"saga.{K(r)}.done", All[r].DoneKo);

        public static string StepName(int step) => step switch
        {
            0 => DungeonLocalization.T("saga.step.hunt", "토벌"),
            1 => DungeonLocalization.T("saga.step.clue", "흔적"),
            2 => DungeonLocalization.T("saga.step.elite", "정예"),
            _ => DungeonLocalization.T("saga.step.boss", "우두머리"),
        };

        /// <summary>그 걸음에 채울 수 — 웹 chainStep.need.</summary>
        public static int Need(int r, int step)
        {
            int L = DungeonRegionFoes.Danger[r];
            return step == 0 ? 10 + 2 * L : step == 2 ? (L > 0 ? 3 : 2) : 1;
        }

        public static int RewardGold(int r, int step)
        {
            int L = DungeonRegionFoes.Danger[r];
            return step switch { 0 => 60 + 30 * L, 1 => 80 + 40 * L, 2 => 100 + 50 * L, _ => 400 + 200 * L };
        }

        public static int RewardExp(int r, int step)
        {
            int L = DungeonRegionFoes.Danger[r];
            return step switch { 0 => 10 + 5 * L, 1 => 15 + 5 * L, 2 => 20 + 8 * L, _ => 60 + 20 * L };
        }

        /// <summary>평정 공적 금 — (20 + L) × 50 냥.</summary>
        public static int MeritGold(int r) => (20 + DungeonRegionFoes.Danger[r]) * DungeonRegionFoes.GoldPerMerit;
        public static int AllMeritGold => AllMerit * DungeonRegionFoes.GoldPerMerit;

        /// <summary>걸음 설명 — 웹 chainStep.desc.</summary>
        public static string StepDesc(int r, int step)
        {
            int n = Need(r, step);
            return step switch
            {
                0 => string.Format(DungeonLocalization.T("saga.desc.hunt", "{0}에서 적 {1}마리를 처치하라 (🚩 사냥터 깃발을 밟으면 무리가 나온다)"), DungeonWorldMap.Name(r), n),
                1 => string.Format(DungeonLocalization.T("saga.desc.clue", "🔍 {0}을(를) 찾아라 (M 지도 🔍)"), Clue(r)),
                2 => string.Format(DungeonLocalization.T("saga.desc.elite", "{0} {1}마리를 쓰러뜨려라 (🚩 사냥터 깃발)"), Elite(r), n),
                _ => string.Format(DungeonLocalization.T("saga.desc.boss", "☠ {0}을(를) 토벌하라"), DungeonRegionFoes.BossName(r)),
            };
        }
    }
}
