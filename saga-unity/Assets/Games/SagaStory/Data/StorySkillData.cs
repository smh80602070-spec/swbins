using System.Collections.Generic;

namespace Saga.Story.Data
{
    /// <summary>
    /// PLAN.md 101-2 STORY 5-2 "무예 유파" 1단계 — 유파(세트 효과)를 얹기 전에
    /// 그 밑바탕인 **1차 직업 무예 + SP 투자**부터 들인다(2026-09-23 사용자 결정
    /// "무예 트리부터"). 값은 웹판 `saga-web/saga-story/js/data-job.js` SKILLS의
    /// job:warrior/archer/rogue/mage 항목 그대로(원문 상수 안 바꿈), 픽셀 값(r·dist)만
    /// `FieldMapData.ScaleMPerPx`로 미터 환산. `School`은 2단계(유파 세트)가 쓸 자리 —
    /// 웹판 태그 그대로 미리 옮겨 둔다.
    ///
    /// **재해석 — 빠진 것**: 이 트랙 플레이어는 피격당하지 않아(`StoryCombat.StartHp`
    /// 주석) 체력 축이 없다. 그래서 heal 무예 둘(무사 생기결·방사 치유)은 옮기지 않고,
    /// 철갑의 guard(덜 맞음)·은신보/축지의 invuln(무적)도 뺀다 — 적용할 축이 없는 효과를
    /// 약속하지 않는다(`StoryJobTrainer`가 전직 메시지에서 체력+N을 빼는 것과 같은 판단).
    /// 부적의 regen(기력 회복 배율)은 이 트랙에도 기력이 있어 그대로 옮긴다.
    ///
    /// **재해석 — 퇴보사**: 웹판 코드는 dash를 늘 바라보는 쪽으로 밀지만(`side.js`
    /// castBody), 이름·설명("뒤로 물러나며 화살을 놓는다")은 후퇴다 — 이 트랙은 설명대로
    /// 뒤로 민다(<see cref="Skill.Backward"/>).
    ///
    /// **2단계(2026-09-23, 사용자 결정 "2차 전직부터")** — 1차만으론 유파마다 무예가 하나라
    /// 무예 칸에 같은 유파 둘을 놓을 수 없었다. 2차 넷(장군·신궁·자객·도사)의 무예 20개 중
    /// 회복(회천결) 하나를 뺀 19개를 같은 규칙으로 옮겼다 — 막기(철벽·호신부 guard)·무적
    /// (그림자밟기·축지술 invuln)은 1차처럼 빼고 설명도 실제 효과에 맞췄다. 2차 무예는 같은
    /// 유파 1차 무예 5가 먼저다(<see cref="Skill.Need"/>). 새 효과는 `rain`(전우·천뢰) 하나.
    /// 유파 세트 표는 <see cref="Schools"/>(웹판 `SCHOOLS` 24행 그대로).
    ///
    /// **3단계(2026-09-23)** — 3·4차 여덟 자리의 무예 48개 중 회복 넷(불사결·재생결·회춘·환생)을
    /// 뺀 44개를 같은 규칙으로 옮겼다(무적 넷은 invuln만 빼고 돌진은 그대로, 답공사·익보사는
    /// 퇴보사처럼 후퇴). 막연한 북돋움 설명엔 실제 효과를 괄호로 붙였다. 새 효과는 없다.
    /// 무사 질(疾)은 2차 무예가 없어 최대 3개라 4세트가 안 되는 것도 웹판 그대로다.
    /// </summary>
    public static class StorySkillData
    {
        public enum Effect { Melee, Aoe, Bolt, Arrow, Volley, Dash, Buff, Rain }

        public sealed class Skill
        {
            public string Key;
            public string Job;
            public string School;
            public string Name;
            public string Desc;
            public float Cost;
            public float Cooldown;
            public int Max = 10;
            public Effect Effect;
            public float MulBase;
            public float MulPerLevel;
            public float RadiusM;
            public float DistM;
            public bool Backward;
            public int Hits = 1;
            public int Shots = 2;
            public float BuffSec;
            public float BuffAtk = 1f;
            public float BuffSpeed = 1f;
            public float BuffRegen = 1f;
            /// <summary>먼저 익혀야 하는 무예와 레벨(웹판 `need`) — 없으면 null.</summary>
            public string Need;
            public int NeedLv;
            /// <summary>자리 차수 — 무예 칸은 윗자리 무예부터 채운다(웹판 bar()).</summary>
            public int Tier => StoryCombat.TryGetJob(Job, out var info) ? info.Tier : 0;
        }

        /// <summary>유파 세트 효과가 어디에 곱하는지 — 웹판 `SCHOOLS.kind`(새 효과가 아니다).</summary>
        public enum SchoolKind { Dmg, Aoe, Dash, Buff, Heal, Volley }

        public sealed class School
        {
            public string Id;
            public string Name;
            public SchoolKind Kind;
            public float V2;
            public float V4;
        }

        /// <summary>data-job.js SCHOOLS 24행 그대로. 칸에 같은 유파 2개 → V2, 4개 → V4.
        /// 생(生) 둘은 회복 무예뿐이라 이 트랙엔 무예가 없어 켜질 일이 없다(표는 원문대로 둔다).</summary>
        public static readonly School[] Schools =
        {
            new School { Id = "w_jung", Name = "정(正)", Kind = SchoolKind.Dmg, V2 = 1.15f, V4 = 1.35f },
            new School { Id = "w_pae", Name = "패(覇)", Kind = SchoolKind.Aoe, V2 = 1.15f, V4 = 1.35f },
            new School { Id = "w_jil", Name = "질(疾)", Kind = SchoolKind.Dash, V2 = 0.8f, V4 = 1f },
            new School { Id = "w_su", Name = "수(守)", Kind = SchoolKind.Buff, V2 = 1.15f, V4 = 1.35f },
            new School { Id = "w_pa", Name = "파(破)", Kind = SchoolKind.Dmg, V2 = 1.15f, V4 = 1.35f },
            new School { Id = "w_saeng", Name = "생(生)", Kind = SchoolKind.Heal, V2 = 1.15f, V4 = 1.35f },

            new School { Id = "a_u", Name = "우(雨)", Kind = SchoolKind.Dmg, V2 = 1.15f, V4 = 1.35f },
            new School { Id = "a_gwan", Name = "관(貫)", Kind = SchoolKind.Dmg, V2 = 1.15f, V4 = 1.35f },
            new School { Id = "a_yeon", Name = "연(連)", Kind = SchoolKind.Volley, V2 = 1f, V4 = 2f },
            new School { Id = "a_an", Name = "안(眼)", Kind = SchoolKind.Buff, V2 = 1.15f, V4 = 1.35f },
            new School { Id = "a_toe", Name = "퇴(退)", Kind = SchoolKind.Dash, V2 = 0.8f, V4 = 1f },
            new School { Id = "a_hwan", Name = "환(環)", Kind = SchoolKind.Aoe, V2 = 1.15f, V4 = 1.35f },

            new School { Id = "r_cham", Name = "참(斬)", Kind = SchoolKind.Dmg, V2 = 1.15f, V4 = 1.35f },
            new School { Id = "r_hwa", Name = "화(花)", Kind = SchoolKind.Volley, V2 = 1f, V4 = 2f },
            new School { Id = "r_bo", Name = "보(步)", Kind = SchoolKind.Dash, V2 = 0.8f, V4 = 1f },
            new School { Id = "r_hon", Name = "혼(魂)", Kind = SchoolKind.Buff, V2 = 1.15f, V4 = 1.35f },
            new School { Id = "r_pung", Name = "풍(風)", Kind = SchoolKind.Aoe, V2 = 1.15f, V4 = 1.35f },
            new School { Id = "r_pyo", Name = "표(鏢)", Kind = SchoolKind.Dmg, V2 = 1.15f, V4 = 1.35f },

            new School { Id = "m_seong", Name = "성(星)", Kind = SchoolKind.Dmg, V2 = 1.15f, V4 = 1.35f },
            new School { Id = "m_jin", Name = "진(震)", Kind = SchoolKind.Aoe, V2 = 1.15f, V4 = 1.35f },
            new School { Id = "m_saeng", Name = "생(生)", Kind = SchoolKind.Heal, V2 = 1.15f, V4 = 1.35f },
            new School { Id = "m_bu", Name = "부(符)", Kind = SchoolKind.Buff, V2 = 1.15f, V4 = 1.35f },
            new School { Id = "m_chuk", Name = "축(縮)", Kind = SchoolKind.Dash, V2 = 0.8f, V4 = 1f },
            new School { Id = "m_tan", Name = "탄(彈)", Kind = SchoolKind.Volley, V2 = 1f, V4 = 2f },
        };

        public static School GetSchool(string id)
        {
            foreach (var s in Schools) if (s.Id == id) return s;
            return null;
        }

        private const float Px = FieldMapData.ScaleMPerPx;

        public static readonly Skill[] All =
        {
            // 무사(武士)
            new Skill { Key = "w_cut", Job = "warrior", School = "w_jung", Name = "참격(斬擊)", Desc = "앞을 깊게 벤다",
                Cost = 6, Cooldown = 0.5f, Effect = Effect.Melee, MulBase = 1.15f, MulPerLevel = 0.09f },
            new Skill { Key = "w_whirl", Job = "warrior", School = "w_pae", Name = "선풍(旋風)", Desc = "몸을 돌려 주위를 쓸어 벤다",
                Cost = 20, Cooldown = 3.6f, Effect = Effect.Aoe, MulBase = 1.6f, MulPerLevel = 0.14f, RadiusM = 128 * Px },
            new Skill { Key = "w_rush", Job = "warrior", School = "w_jil", Name = "돌진(突進)", Desc = "앞으로 밀고 나가며 벤다",
                Cost = 24, Cooldown = 6f, Effect = Effect.Dash, MulBase = 1.8f, MulPerLevel = 0.16f, DistM = 210 * Px },
            new Skill { Key = "w_iron", Job = "warrior", School = "w_su", Name = "철갑(鐵甲)", Desc = "9초간 공격 +20%",
                Cost = 28, Cooldown = 16f, Effect = Effect.Buff, BuffSec = 9f, BuffAtk = 1.2f },
            new Skill { Key = "w_edge", Job = "warrior", School = "w_pa", Name = "파공검(破空劍)", Desc = "벤 기운을 앞으로 쏘아 보낸다 · 관통",
                Cost = 18, Cooldown = 5f, Effect = Effect.Bolt, MulBase = 1.6f, MulPerLevel = 0.14f },

            // 궁수(弓手)
            new Skill { Key = "a_shot", Job = "archer", School = "a_u", Name = "사격(射擊)", Desc = "화살 하나를 날린다",
                Cost = 8, Cooldown = 0.6f, Effect = Effect.Arrow, MulBase = 1.3f, MulPerLevel = 0.11f },
            new Skill { Key = "a_double", Job = "archer", School = "a_yeon", Name = "연사(連射)", Desc = "화살 셋을 잇달아 쏜다",
                Cost = 22, Cooldown = 3.4f, Effect = Effect.Volley, MulBase = 1.1f, MulPerLevel = 0.08f, Shots = 3 },
            new Skill { Key = "a_pierce", Job = "archer", School = "a_gwan", Name = "관통시(貫通矢)", Desc = "줄지어 선 것을 꿰뚫는다",
                Cost = 26, Cooldown = 6f, Effect = Effect.Bolt, MulBase = 2.0f, MulPerLevel = 0.18f },
            new Skill { Key = "a_eye", Job = "archer", School = "a_an", Name = "응안(鷹眼)", Desc = "9초간 공격 +40%",
                Cost = 30, Cooldown = 16f, Effect = Effect.Buff, BuffSec = 9f, BuffAtk = 1.4f },
            new Skill { Key = "a_retreat", Job = "archer", School = "a_toe", Name = "퇴보사(退步射)", Desc = "뒤로 물러나며 화살을 놓는다",
                Cost = 20, Cooldown = 6f, Effect = Effect.Dash, MulBase = 1.3f, MulPerLevel = 0.11f, DistM = 180 * Px, Backward = true },
            new Skill { Key = "a_burst", Job = "archer", School = "a_hwan", Name = "환시(環矢)", Desc = "사방으로 화살을 흩놓는다",
                Cost = 20, Cooldown = 5f, Effect = Effect.Aoe, MulBase = 1.4f, MulPerLevel = 0.12f, RadiusM = 110 * Px },

            // 협객(俠客)
            new Skill { Key = "r_twin", Job = "rogue", School = "r_cham", Name = "쌍참(雙斬)", Desc = "앞을 두 번 긋는다",
                Cost = 7, Cooldown = 0.42f, Effect = Effect.Melee, MulBase = 0.72f, MulPerLevel = 0.06f, Hits = 2 },
            new Skill { Key = "r_knife", Job = "rogue", School = "r_hwa", Name = "비도(飛刀)", Desc = "표창 둘을 던진다",
                Cost = 18, Cooldown = 2.6f, Effect = Effect.Volley, MulBase = 1.0f, MulPerLevel = 0.09f, Shots = 2 },
            new Skill { Key = "r_step", Job = "rogue", School = "r_bo", Name = "은신보(隱身步)", Desc = "한 걸음에 빠져나가며 벤다",
                Cost = 22, Cooldown = 7f, Effect = Effect.Dash, MulBase = 1.2f, MulPerLevel = 0.1f, DistM = 260 * Px },
            new Skill { Key = "r_vital", Job = "rogue", School = "r_hon", Name = "급소(急所)", Desc = "8초간 공격 +55%",
                Cost = 26, Cooldown = 15f, Effect = Effect.Buff, BuffSec = 8f, BuffAtk = 1.55f },
            new Skill { Key = "r_whirl", Job = "rogue", School = "r_pung", Name = "선풍각(旋風脚)", Desc = "몸을 낮춰 주위를 걷어찬다",
                Cost = 20, Cooldown = 5f, Effect = Effect.Aoe, MulBase = 1.4f, MulPerLevel = 0.12f, RadiusM = 110 * Px },
            new Skill { Key = "r_dart", Job = "rogue", School = "r_pyo", Name = "관통표(貫通鏢)", Desc = "표창을 꿰뚫듯 던진다 · 관통",
                Cost = 18, Cooldown = 5f, Effect = Effect.Bolt, MulBase = 1.6f, MulPerLevel = 0.14f },

            // 방사(方士)
            new Skill { Key = "m_fire", Job = "mage", School = "m_seong", Name = "화구(火球)", Desc = "불덩이를 굴린다 · 관통",
                Cost = 12, Cooldown = 0.9f, Effect = Effect.Bolt, MulBase = 1.5f, MulPerLevel = 0.13f },
            new Skill { Key = "m_bolt", Job = "mage", School = "m_jin", Name = "뇌전(雷電)", Desc = "벼락이 주위에 떨어진다",
                Cost = 26, Cooldown = 4f, Effect = Effect.Aoe, MulBase = 1.9f, MulPerLevel = 0.17f, RadiusM = 165 * Px },
            new Skill { Key = "m_talis", Job = "mage", School = "m_bu", Name = "부적(符籍)", Desc = "10초간 공격 +25% · 기력이 빨리 찬다",
                Cost = 30, Cooldown = 16f, Effect = Effect.Buff, BuffSec = 10f, BuffAtk = 1.25f, BuffRegen = 2.6f },
            new Skill { Key = "m_step", Job = "mage", School = "m_chuk", Name = "축지(縮地)", Desc = "땅을 접어 순식간에 나아간다",
                Cost = 22, Cooldown = 7f, Effect = Effect.Dash, MulBase = 1.2f, MulPerLevel = 0.1f, DistM = 220 * Px },
            new Skill { Key = "m_orb", Job = "mage", School = "m_tan", Name = "마탄(魔彈)", Desc = "기운 구슬 셋을 잇달아 놓는다",
                Cost = 22, Cooldown = 3.4f, Effect = Effect.Volley, MulBase = 1.1f, MulPerLevel = 0.08f, Shots = 3 },

            // ── 2차(2026-09-23) — data-job.js tier 2 그대로(회천결 heal 제외) ──
            // 장군(將軍)
            new Skill { Key = "g_smash", Job = "general", School = "w_jung", Name = "패왕격(霸王擊)", Desc = "앞을 두 번 내리친다 — 참격 5",
                Cost = 40, Cooldown = 9f, Effect = Effect.Melee, MulBase = 3.4f, MulPerLevel = 0.3f, Hits = 2, Need = "w_cut", NeedLv = 5 },
            new Skill { Key = "g_roar", Job = "general", School = "w_pae", Name = "함성(喊聲)", Desc = "고함으로 사방을 친다 — 선풍 5",
                Cost = 34, Cooldown = 14f, Effect = Effect.Aoe, MulBase = 2.4f, MulPerLevel = 0.2f, RadiusM = 190 * Px, Need = "w_whirl", NeedLv = 5 },
            new Skill { Key = "g_wall", Job = "general", School = "w_su", Name = "철벽(鐵壁)", Desc = "11초간 공격 +15% — 철갑 5",
                Cost = 38, Cooldown = 20f, Effect = Effect.Buff, BuffSec = 11f, BuffAtk = 1.15f, Need = "w_iron", NeedLv = 5 },
            new Skill { Key = "g_edge", Job = "general", School = "w_pa", Name = "벽공검(劈空劍)", Desc = "기운이 더 멀리, 더 세게 뻗는다 — 파공검 5",
                Cost = 32, Cooldown = 7f, Effect = Effect.Bolt, MulBase = 2.8f, MulPerLevel = 0.24f, Need = "w_edge", NeedLv = 5 },

            // 신궁(神弓)
            new Skill { Key = "s_rain", Job = "sniper", School = "a_u", Name = "전우(箭雨)", Desc = "앞쪽에 화살을 쏟는다 — 사격 5",
                Cost = 42, Cooldown = 10f, Effect = Effect.Rain, MulBase = 2.6f, MulPerLevel = 0.24f, Need = "a_shot", NeedLv = 5 },
            new Skill { Key = "s_snipe", Job = "sniper", School = "a_gwan", Name = "일점사(一點射)", Desc = "한 발에 힘을 모은다 — 관통시 5",
                Cost = 36, Cooldown = 8f, Effect = Effect.Bolt, MulBase = 4.0f, MulPerLevel = 0.34f, Need = "a_pierce", NeedLv = 5 },
            new Skill { Key = "s_split", Job = "sniper", School = "a_yeon", Name = "분시(分矢)", Desc = "화살 넷이 갈라져 난다 — 연사 5",
                Cost = 34, Cooldown = 5f, Effect = Effect.Volley, MulBase = 1.5f, MulPerLevel = 0.12f, Shots = 4, Need = "a_double", NeedLv = 5 },
            new Skill { Key = "s_retreat", Job = "sniper", School = "a_toe", Name = "활보사(闊步射)", Desc = "더 크게 물러나며 쏜다 — 퇴보사 5",
                Cost = 34, Cooldown = 7f, Effect = Effect.Dash, MulBase = 2.3f, MulPerLevel = 0.2f, DistM = 240 * Px, Backward = true, Need = "a_retreat", NeedLv = 5 },
            new Skill { Key = "s_burst", Job = "sniper", School = "a_hwan", Name = "광환시(廣環矢)", Desc = "고리가 더 넓게 퍼진다 — 환시 5",
                Cost = 34, Cooldown = 6f, Effect = Effect.Aoe, MulBase = 2.4f, MulPerLevel = 0.21f, RadiusM = 140 * Px, Need = "a_burst", NeedLv = 5 },

            // 자객(刺客)
            new Skill { Key = "x_storm", Job = "assassin", School = "r_cham", Name = "난무(亂舞)", Desc = "앞을 네 번 긋는다 — 쌍참 5",
                Cost = 38, Cooldown = 8f, Effect = Effect.Melee, MulBase = 1.5f, MulPerLevel = 0.13f, Hits = 4, Need = "r_twin", NeedLv = 5 },
            new Skill { Key = "x_fan", Job = "assassin", School = "r_hwa", Name = "만천화우(滿天花雨)", Desc = "표창 다섯을 흩뿌린다 — 비도 5",
                Cost = 40, Cooldown = 9f, Effect = Effect.Volley, MulBase = 1.4f, MulPerLevel = 0.12f, Shots = 5, Need = "r_knife", NeedLv = 5 },
            new Skill { Key = "x_shadow", Job = "assassin", School = "r_bo", Name = "그림자밟기", Desc = "그림자를 밟고 지나간다 — 은신보 5",
                Cost = 32, Cooldown = 6f, Effect = Effect.Dash, MulBase = 2.0f, MulPerLevel = 0.17f, DistM = 300 * Px, Need = "r_step", NeedLv = 5 },
            new Skill { Key = "x_whirl", Job = "assassin", School = "r_pung", Name = "질풍각(疾風脚)", Desc = "더 빠르게, 더 넓게 휩쓴다 — 선풍각 5",
                Cost = 34, Cooldown = 6f, Effect = Effect.Aoe, MulBase = 2.4f, MulPerLevel = 0.21f, RadiusM = 140 * Px, Need = "r_whirl", NeedLv = 5 },
            new Skill { Key = "x_dart", Job = "assassin", School = "r_pyo", Name = "암습표(暗襲鏢)", Desc = "어둠 속에서 꿰뚫는다 — 관통표 5",
                Cost = 32, Cooldown = 7f, Effect = Effect.Bolt, MulBase = 2.8f, MulPerLevel = 0.24f, Need = "r_dart", NeedLv = 5 },

            // 도사(道士)
            new Skill { Key = "p_quake", Job = "sage", School = "m_jin", Name = "지진(地震)", Desc = "땅을 흔든다 — 뇌전 5",
                Cost = 44, Cooldown = 10f, Effect = Effect.Aoe, MulBase = 3.2f, MulPerLevel = 0.28f, RadiusM = 230 * Px, Need = "m_bolt", NeedLv = 5 },
            new Skill { Key = "p_beam", Job = "sage", School = "m_seong", Name = "천뢰(天雷)", Desc = "앞쪽에 벼락을 쏟는다 — 화구 5",
                Cost = 40, Cooldown = 9f, Effect = Effect.Rain, MulBase = 3.0f, MulPerLevel = 0.26f, Need = "m_fire", NeedLv = 5 },
            new Skill { Key = "p_ward", Job = "sage", School = "m_bu", Name = "호신부(護身符)", Desc = "12초간 공격 +10% · 기력이 샘솟는다 — 부적 5",
                Cost = 36, Cooldown = 18f, Effect = Effect.Buff, BuffSec = 12f, BuffAtk = 1.1f, BuffRegen = 3.2f, Need = "m_talis", NeedLv = 5 },
            new Skill { Key = "p_step", Job = "sage", School = "m_chuk", Name = "축지술(縮地術)", Desc = "땅을 더 크게 접는다 — 축지 5",
                Cost = 36, Cooldown = 8f, Effect = Effect.Dash, MulBase = 2.0f, MulPerLevel = 0.17f, DistM = 280 * Px, Need = "m_step", NeedLv = 5 },
            new Skill { Key = "p_orb", Job = "sage", School = "m_tan", Name = "연환탄(連環彈)", Desc = "구슬 넷이 고리처럼 잇는다 — 마탄 5",
                Cost = 34, Cooldown = 5f, Effect = Effect.Volley, MulBase = 1.5f, MulPerLevel = 0.12f, Shots = 4, Need = "m_orb", NeedLv = 5 },

            // ── 3차(2026-09-23, 5-2 3단계) — data-job.js tier 3 그대로(불사결·회춘 heal 제외, 허공답보·이형보 invuln 뺌) ──
            // 원수(元帥)
            new Skill { Key = "n_heaven", Job = "marshal", School = "w_jung", Name = "천붕격(天崩擊)", Desc = "앞을 세 번 내리찍는다 — 패왕격 5",
                Cost = 58, Cooldown = 11f, Effect = Effect.Melee, MulBase = 4.6f, MulPerLevel = 0.42f, Hits = 3, Need = "g_smash", NeedLv = 5 },
            new Skill { Key = "n_quake", Job = "marshal", School = "w_pae", Name = "진각(震脚)", Desc = "땅을 밟아 사방을 흔든다 — 함성 5",
                Cost = 52, Cooldown = 12f, Effect = Effect.Aoe, MulBase = 3.6f, MulPerLevel = 0.32f, RadiusM = 264 * Px, Need = "g_roar", NeedLv = 5 },
            new Skill { Key = "n_charge", Job = "marshal", School = "w_jil", Name = "철기돌격(鐵騎突擊)", Desc = "한달음에 가르며 벤다 — 돌진 5",
                Cost = 48, Cooldown = 9f, Effect = Effect.Dash, MulBase = 3.2f, MulPerLevel = 0.28f, DistM = 330 * Px, Need = "w_rush", NeedLv = 5 },
            new Skill { Key = "n_banner", Job = "marshal", School = "w_su", Name = "대장기(大將旗)", Desc = "13초간 삼군이 따른다(공격 +55% · 기력이 빨리 찬다) — 철벽 5",
                Cost = 56, Cooldown = 24f, Effect = Effect.Buff, BuffSec = 13f, BuffAtk = 1.55f, BuffRegen = 1.8f, Need = "g_wall", NeedLv = 5 },
            new Skill { Key = "n_edge", Job = "marshal", School = "w_pa", Name = "천단검(天斷劍)", Desc = "장수의 기백이 검 끝에 실린다 — 벽공검 5",
                Cost = 44, Cooldown = 9f, Effect = Effect.Bolt, MulBase = 4.0f, MulPerLevel = 0.35f, Need = "g_edge", NeedLv = 5 },

            // 비장(飛將)
            new Skill { Key = "f_storm", Job = "flier", School = "a_u", Name = "시우(矢雨)", Desc = "앞쪽 하늘을 화살로 덮는다 — 전우 5",
                Cost = 60, Cooldown = 12f, Effect = Effect.Rain, MulBase = 4.2f, MulPerLevel = 0.38f, Need = "s_rain", NeedLv = 5 },
            new Skill { Key = "f_pierce", Job = "flier", School = "a_gwan", Name = "파천시(破天矢)", Desc = "한 발이 줄지어 선 것을 다 꿴다 — 일점사 5",
                Cost = 54, Cooldown = 9f, Effect = Effect.Bolt, MulBase = 6.4f, MulPerLevel = 0.55f, Need = "s_snipe", NeedLv = 5 },
            new Skill { Key = "f_volley", Job = "flier", School = "a_yeon", Name = "만시(萬矢)", Desc = "화살 여덟을 한 손으로 놓는다 — 분시 5",
                Cost = 50, Cooldown = 7f, Effect = Effect.Volley, MulBase = 1.9f, MulPerLevel = 0.16f, Shots = 8, Need = "s_split", NeedLv = 5 },
            new Skill { Key = "f_focus", Job = "flier", School = "a_an", Name = "정심(定心)", Desc = "12초간 공격 +75% — 응안 5",
                Cost = 46, Cooldown = 22f, Effect = Effect.Buff, BuffSec = 12f, BuffAtk = 1.75f, BuffSpeed = 1.15f, Need = "a_eye", NeedLv = 5 },
            new Skill { Key = "f_retreat", Job = "flier", School = "a_toe", Name = "답공사(踏空射)", Desc = "허공을 딛듯 물러나며 꿰뚫는다 — 활보사 5",
                Cost = 46, Cooldown = 8f, Effect = Effect.Dash, MulBase = 3.5f, MulPerLevel = 0.3f, DistM = 300 * Px, Backward = true, Need = "s_retreat", NeedLv = 5 },
            new Skill { Key = "f_burst", Job = "flier", School = "a_hwan", Name = "천환시(天環矢)", Desc = "하늘 전체가 고리로 뒤덮인다 — 광환시 5",
                Cost = 46, Cooldown = 7f, Effect = Effect.Aoe, MulBase = 3.6f, MulPerLevel = 0.31f, RadiusM = 175 * Px, Need = "s_burst", NeedLv = 5 },

            // 귀영(鬼影)
            new Skill { Key = "v_blur", Job = "wraith", School = "r_cham", Name = "잔영(殘影)", Desc = "몸이 남기 전에 여섯 번 긋는다 — 난무 5",
                Cost = 52, Cooldown = 8f, Effect = Effect.Melee, MulBase = 2.2f, MulPerLevel = 0.19f, Hits = 6, Need = "x_storm", NeedLv = 5 },
            new Skill { Key = "v_petal", Job = "wraith", School = "r_hwa", Name = "낙화(落花)", Desc = "표창 일곱이 꽃잎처럼 진다 — 만천화우 5",
                Cost = 54, Cooldown = 9f, Effect = Effect.Volley, MulBase = 1.8f, MulPerLevel = 0.15f, Shots = 7, Need = "x_fan", NeedLv = 5 },
            new Skill { Key = "v_void", Job = "wraith", School = "r_bo", Name = "허공답보(虛空踏步)", Desc = "허공을 밟고 건너간다 — 그림자밟기 5",
                Cost = 44, Cooldown = 7f, Effect = Effect.Dash, MulBase = 3.0f, MulPerLevel = 0.26f, DistM = 360 * Px, Need = "x_shadow", NeedLv = 5 },
            new Skill { Key = "v_mark", Job = "wraith", School = "r_hon", Name = "사혼(死魂)", Desc = "10초간 공격 +95% — 급소 5",
                Cost = 48, Cooldown = 20f, Effect = Effect.Buff, BuffSec = 10f, BuffAtk = 1.95f, Need = "r_vital", NeedLv = 5 },
            new Skill { Key = "v_whirl", Job = "wraith", School = "r_pung", Name = "광풍각(狂風脚)", Desc = "미친 듯이 휘돌아 찬다 — 질풍각 5",
                Cost = 46, Cooldown = 7f, Effect = Effect.Aoe, MulBase = 3.6f, MulPerLevel = 0.31f, RadiusM = 175 * Px, Need = "x_whirl", NeedLv = 5 },
            new Skill { Key = "v_dart", Job = "wraith", School = "r_pyo", Name = "귀표(鬼鏢)", Desc = "귀신 들린 듯 파고든다 — 암습표 5",
                Cost = 44, Cooldown = 9f, Effect = Effect.Bolt, MulBase = 4.0f, MulPerLevel = 0.35f, Need = "x_dart", NeedLv = 5 },

            // 진인(眞人)
            new Skill { Key = "i_meteor", Job = "immortal", School = "m_seong", Name = "유성(流星)", Desc = "앞쪽에 별을 떨군다 — 천뢰 5",
                Cost = 64, Cooldown = 12f, Effect = Effect.Rain, MulBase = 4.8f, MulPerLevel = 0.42f, Need = "p_beam", NeedLv = 5 },
            new Skill { Key = "i_abyss", Job = "immortal", School = "m_jin", Name = "천붕지열(天崩地裂)", Desc = "하늘이 무너지고 땅이 갈라진다 — 지진 5",
                Cost = 68, Cooldown = 14f, Effect = Effect.Aoe, MulBase = 5.0f, MulPerLevel = 0.44f, RadiusM = 300 * Px, Need = "p_quake", NeedLv = 5 },
            new Skill { Key = "i_tao", Job = "immortal", School = "m_bu", Name = "태극(太極)", Desc = "14초간 음양이 돈다(공격 +50% · 기력이 샘솟는다) — 호신부 5",
                Cost = 58, Cooldown = 22f, Effect = Effect.Buff, BuffSec = 14f, BuffAtk = 1.5f, BuffRegen = 4.0f, Need = "p_ward", NeedLv = 5 },
            new Skill { Key = "i_step", Job = "immortal", School = "m_chuk", Name = "이형보(移形步)", Desc = "형체를 옮기듯 건너간다 — 축지술 5",
                Cost = 48, Cooldown = 9f, Effect = Effect.Dash, MulBase = 3.0f, MulPerLevel = 0.26f, DistM = 340 * Px, Need = "p_step", NeedLv = 5 },
            new Skill { Key = "i_orb", Job = "immortal", School = "m_tan", Name = "유성탄(流星彈)", Desc = "별 여섯이 한 손에서 쏟아진다 — 연환탄 5",
                Cost = 50, Cooldown = 7f, Effect = Effect.Volley, MulBase = 1.9f, MulPerLevel = 0.16f, Shots = 6, Need = "p_orb", NeedLv = 5 },

            // ── 4차 — data-job.js tier 4 그대로(재생결·환생 heal 제외, 명계보·신행보 invuln 뺌) ──
            // 전신(戰神)
            new Skill { Key = "o_ruin", Job = "warlord", School = "w_jung", Name = "파멸격(破滅擊)", Desc = "앞을 네 번 내리찍어 부순다 — 천붕격 5",
                Cost = 62, Cooldown = 12f, Effect = Effect.Melee, MulBase = 6.2f, MulPerLevel = 0.57f, Hits = 4, Need = "n_heaven", NeedLv = 5 },
            new Skill { Key = "o_tremor", Job = "warlord", School = "w_pae", Name = "지열(地裂)", Desc = "땅이 갈라지도록 흔든다 — 진각 5",
                Cost = 58, Cooldown = 14f, Effect = Effect.Aoe, MulBase = 4.9f, MulPerLevel = 0.44f, RadiusM = 340 * Px, Need = "n_quake", NeedLv = 5 },
            new Skill { Key = "o_smite", Job = "warlord", School = "w_jil", Name = "벽력돌(霹靂突)", Desc = "번개처럼 꿰뚫고 지나간다 — 철기돌격 5",
                Cost = 54, Cooldown = 10f, Effect = Effect.Dash, MulBase = 4.5f, MulPerLevel = 0.4f, DistM = 410 * Px, Need = "n_charge", NeedLv = 5 },
            new Skill { Key = "o_conquer", Job = "warlord", School = "w_su", Name = "패천기(覇天旗)", Desc = "15초간 온 전장을 호령한다(공격 +80% · 기력이 빨리 찬다) — 대장기 5",
                Cost = 62, Cooldown = 26f, Effect = Effect.Buff, BuffSec = 15f, BuffAtk = 1.8f, BuffRegen = 2.4f, Need = "n_banner", NeedLv = 5 },
            new Skill { Key = "o_edge", Job = "warlord", School = "w_pa", Name = "파천검(破天劍)", Desc = "전신의 검기가 하늘까지 닿는다 — 천단검 5",
                Cost = 58, Cooldown = 11f, Effect = Effect.Bolt, MulBase = 5.6f, MulPerLevel = 0.5f, Need = "n_edge", NeedLv = 5 },

            // 궁성(弓聖)
            new Skill { Key = "h_tempest", Job = "falcon", School = "a_u", Name = "천사우(天射雨)", Desc = "하늘 전체가 화살비로 뒤덮인다 — 시우 5",
                Cost = 66, Cooldown = 13f, Effect = Effect.Rain, MulBase = 5.6f, MulPerLevel = 0.5f, Need = "f_storm", NeedLv = 5 },
            new Skill { Key = "h_ray", Job = "falcon", School = "a_gwan", Name = "광시(光矢)", Desc = "빛살 하나가 모든 것을 꿰뚫는다 — 파천시 5",
                Cost = 60, Cooldown = 10f, Effect = Effect.Bolt, MulBase = 8.4f, MulPerLevel = 0.7f, Need = "f_pierce", NeedLv = 5 },
            new Skill { Key = "h_swarm", Job = "falcon", School = "a_yeon", Name = "십이시(十二矢)", Desc = "화살 열둘이 한 손에서 갈라진다 — 만시 5",
                Cost = 56, Cooldown = 8f, Effect = Effect.Volley, MulBase = 2.4f, MulPerLevel = 0.2f, Shots = 12, Need = "f_volley", NeedLv = 5 },
            new Skill { Key = "h_zenith", Job = "falcon", School = "a_an", Name = "궁천합(弓天合)", Desc = "14초간 활이 하늘과 하나가 된다(공격 +100%) — 정심 5",
                Cost = 52, Cooldown = 24f, Effect = Effect.Buff, BuffSec = 14f, BuffAtk = 2.0f, BuffSpeed = 1.2f, Need = "f_focus", NeedLv = 5 },
            new Skill { Key = "h_retreat", Job = "falcon", School = "a_toe", Name = "익보사(翼步射)", Desc = "날개 돋친 듯 물러나며 하늘을 꿴다 — 답공사 5",
                Cost = 58, Cooldown = 9f, Effect = Effect.Dash, MulBase = 5.0f, MulPerLevel = 0.44f, DistM = 360 * Px, Backward = true, Need = "f_retreat", NeedLv = 5 },
            new Skill { Key = "h_burst", Job = "falcon", School = "a_hwan", Name = "극환시(極環矢)", Desc = "고리 끝에 하늘이 걸린다 — 천환시 5",
                Cost = 58, Cooldown = 8f, Effect = Effect.Aoe, MulBase = 5.2f, MulPerLevel = 0.44f, RadiusM = 210 * Px, Need = "f_burst", NeedLv = 5 },

            // 명왕(冥王)
            new Skill { Key = "d_carve", Job = "reaper", School = "r_cham", Name = "팔도(八刀)", Desc = "여덟 번 긋고 나서야 멈춘다 — 잔영 5",
                Cost = 60, Cooldown = 9f, Effect = Effect.Melee, MulBase = 3.0f, MulPerLevel = 0.26f, Hits = 8, Need = "v_blur", NeedLv = 5 },
            new Skill { Key = "d_bloom", Job = "reaper", School = "r_hwa", Name = "구화만개(九花滿開)", Desc = "표창 아홉이 지지 않고 흩날린다 — 낙화 5",
                Cost = 62, Cooldown = 10f, Effect = Effect.Volley, MulBase = 2.2f, MulPerLevel = 0.18f, Shots = 9, Need = "v_petal", NeedLv = 5 },
            new Skill { Key = "d_veil", Job = "reaper", School = "r_bo", Name = "명계보(冥界步)", Desc = "저승 문턱을 밟고 되돌아온다 — 허공답보 5",
                Cost = 50, Cooldown = 8f, Effect = Effect.Dash, MulBase = 3.8f, MulPerLevel = 0.32f, DistM = 420 * Px, Need = "v_void", NeedLv = 5 },
            new Skill { Key = "d_curse", Job = "reaper", School = "r_hon", Name = "명왕부(冥王符)", Desc = "12초간 죽음의 기운을 두른다(공격 +130%) — 사혼 5",
                Cost = 56, Cooldown = 22f, Effect = Effect.Buff, BuffSec = 12f, BuffAtk = 2.3f, Need = "v_mark", NeedLv = 5 },
            new Skill { Key = "d_whirl", Job = "reaper", School = "r_pung", Name = "절명풍(絶命風)", Desc = "휘도는 바람이 목숨을 끊는다 — 광풍각 5",
                Cost = 58, Cooldown = 8f, Effect = Effect.Aoe, MulBase = 5.2f, MulPerLevel = 0.44f, RadiusM = 210 * Px, Need = "v_whirl", NeedLv = 5 },
            new Skill { Key = "d_dart", Job = "reaper", School = "r_pyo", Name = "명표(冥鏢)", Desc = "저승의 기운이 표창 끝에 실린다 — 귀표 5",
                Cost = 58, Cooldown = 11f, Effect = Effect.Bolt, MulBase = 5.6f, MulPerLevel = 0.5f, Need = "v_dart", NeedLv = 5 },

            // 천존(天尊)
            new Skill { Key = "z_starfall", Job = "ascendant", School = "m_seong", Name = "낙성우(落星雨)", Desc = "별들이 통째로 떨어진다 — 유성 5",
                Cost = 70, Cooldown = 13f, Effect = Effect.Rain, MulBase = 6.5f, MulPerLevel = 0.56f, Need = "i_meteor", NeedLv = 5 },
            new Skill { Key = "z_collapse", Job = "ascendant", School = "m_jin", Name = "건곤붕(乾坤崩)", Desc = "하늘과 땅이 함께 무너진다 — 천붕지열 5",
                Cost = 74, Cooldown = 15f, Effect = Effect.Aoe, MulBase = 6.8f, MulPerLevel = 0.58f, RadiusM = 330 * Px, Need = "i_abyss", NeedLv = 5 },
            new Skill { Key = "z_eternity", Job = "ascendant", School = "m_bu", Name = "무극(無極)", Desc = "16초간 하늘과 땅을 몸에 두른다(공격 +65% · 기력이 샘솟는다) — 태극 5",
                Cost = 64, Cooldown = 24f, Effect = Effect.Buff, BuffSec = 16f, BuffAtk = 1.65f, BuffRegen = 4.8f, Need = "i_tao", NeedLv = 5 },
            new Skill { Key = "z_step", Job = "ascendant", School = "m_chuk", Name = "신행보(神行步)", Desc = "신선의 걸음으로 세상을 건넌다 — 이형보 5",
                Cost = 62, Cooldown = 10f, Effect = Effect.Dash, MulBase = 4.2f, MulPerLevel = 0.36f, DistM = 400 * Px, Need = "i_step", NeedLv = 5 },
            new Skill { Key = "z_orb", Job = "ascendant", School = "m_tan", Name = "성라탄(星羅彈)", Desc = "별자리 여덟이 한꺼번에 쏟아진다 — 유성탄 5",
                Cost = 56, Cooldown = 8f, Effect = Effect.Volley, MulBase = 2.4f, MulPerLevel = 0.2f, Shots = 8, Need = "i_orb", NeedLv = 5 },

            // ── 5차 각성기(tasks U-0025, data-job.js 5차) — 갈래마다 둘, 4차 사슬 하나의 끝(Need 5)에 붙고 그 유파를 그대로 쓴다.
            // 웹 8개 중 태허의 만상환생(heal)은 뺀다(회복 무예를 안 옮기는 규칙), 군신강림의 guard·유명문의 invuln 도 뺀다 — 4차와 같은 규칙. ──
            // 군신(軍神)
            new Skill { Key = "p_wrath", Job = "godwar", School = "w_jung", Name = "천멸격(天滅擊)", Desc = "앞을 다섯 번 내리쳐 하늘을 무너뜨린다 — 파멸격 5",
                Cost = 74, Cooldown = 13f, Effect = Effect.Melee, MulBase = 8.4f, MulPerLevel = 0.76f, Hits = 5, Need = "o_ruin", NeedLv = 5 },
            new Skill { Key = "p_banner", Job = "godwar", School = "w_su", Name = "군신강림(軍神降臨)", Desc = "20초간 전장의 이름을 몸에 둘렀다(공격 +120% · 기력이 빨리 찬다) — 패천기 5",
                Cost = 72, Cooldown = 32f, Effect = Effect.Buff, BuffSec = 20f, BuffAtk = 2.2f, BuffRegen = 3.4f, Need = "o_conquer", NeedLv = 5 },

            // 천궁(天弓)
            new Skill { Key = "p_stars", Job = "skybow", School = "a_yeon", Name = "성궁만천(星弓滿天)", Desc = "화살 열여섯이 별처럼 흩어진다 — 십이시 5",
                Cost = 68, Cooldown = 9f, Effect = Effect.Volley, MulBase = 2.9f, MulPerLevel = 0.24f, Shots = 16, Need = "h_swarm", NeedLv = 5 },
            new Skill { Key = "p_sun", Job = "skybow", School = "a_gwan", Name = "일월시(日月矢)", Desc = "해와 달을 한 살에 꿴다 — 광시 5",
                Cost = 72, Cooldown = 11f, Effect = Effect.Bolt, MulBase = 10.5f, MulPerLevel = 0.85f, Need = "h_ray", NeedLv = 5 },

            // 무영(無影)
            new Skill { Key = "p_afterimage", Job = "noshadow", School = "r_cham", Name = "무영참(無影斬)", Desc = "열두 번 그은 뒤에야 모습이 남는다 — 팔도 5",
                Cost = 72, Cooldown = 10f, Effect = Effect.Melee, MulBase = 3.6f, MulPerLevel = 0.3f, Hits = 12, Need = "d_carve", NeedLv = 5 },
            new Skill { Key = "p_gate", Job = "noshadow", School = "r_bo", Name = "유명문(幽冥門)", Desc = "문을 열고 닫는 사이에 건너간다 — 명계보 5",
                Cost = 62, Cooldown = 9f, Effect = Effect.Dash, MulBase = 4.6f, MulPerLevel = 0.38f, DistM = 460 * Px, Need = "d_veil", NeedLv = 5 },

            // 태허(太虛) — 만상환생(heal)은 뺐다
            new Skill { Key = "p_void", Job = "voidsage", School = "m_jin", Name = "태허붕(太虛崩)", Desc = "비어 있던 자리가 한꺼번에 무너져 내린다 — 건곤붕 5",
                Cost = 88, Cooldown = 16f, Effect = Effect.Aoe, MulBase = 8.2f, MulPerLevel = 0.68f, RadiusM = 380 * Px, Need = "z_collapse", NeedLv = 5 },
        };

        private static Dictionary<string, Skill> _byKey;

        public static Skill Get(string key)
        {
            if (_byKey == null)
            {
                _byKey = new Dictionary<string, Skill>();
                foreach (var s in All) _byKey[s.Key] = s;
            }
            return key != null && _byKey.TryGetValue(key, out var skill) ? skill : null;
        }

        /// <summary>지금 자리 사슬(1차~지금 자리)의 무예, 표 순서 — 웹판 skillsOf(). 무예 패널 줄 순서.</summary>
        public static List<Skill> OfChain()
        {
            var list = new List<Skill>();
            foreach (var s in All)
            {
                if (StoryJobState.InChain(s.Job)) list.Add(s);
            }
            return list;
        }

        public static List<Skill> OfJob(string job)
        {
            var list = new List<Skill>();
            foreach (var s in All)
            {
                if (s.Job == job) list.Add(s);
            }
            return list;
        }
    }
}
