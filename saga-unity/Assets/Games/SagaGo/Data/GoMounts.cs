using System;
using System.Collections.Generic;
using Saga.Go.Combat;

namespace Saga.Go.Data
{
    /// <summary>
    /// PLAN.md 109-15 탈것·비행(웹 사가고 `js/mount.js` T1·T2 · SAGA-DESIGN §15, 사용자 2026-09-29 "탈것도 추가 가능할지, 날아다니는 것도") — 이 판(Unity GO)의 이동 규칙 위에 따로 얹는다.
    /// 지상 말 셋(농마 5·갈색 말 15·흰 말 30 — 모험 레벨이 되면 쓴다)은 걷는 속도에 배율을 곱하고, 비행 탈것 둘(학 20·푸른 용 40)은 Space 로 오르고 Z 로 내려 높이 한도까지 뜬다.
    /// **H = 타고 내리기 · Shift+H = 다른 탈것 고르기**(비행은 Shift+H 로 고른다 — 안 골랐을 땐 지상 탈것 중 가장 빠른 것). 세이브는 `mountSel` 한 칸(탄 채는 저장 안 함).
    /// 저절로 내리는 때: 싸움이 붙으면 · 뛰면(지상 탈것) · 벽을 붙잡거나 헤엄·활공하면 · 비행은 이야기 임무의 오르기·섬·배·따라가기·쫓기·보스·지키기·무리 단계(그 단계엔 못 날고, 떠 있으면 천천히 내려와 땅에 닿을 때 내림).
    /// 판정 층(`Unlocked`·`Selected`·`GroundMul`·`StoryBlocked`)은 순수(레벨·이야기 진행만 읽는다). 웹의 "도감에 등록한 말" 열림은 이 판 도감이 인물이라 없다(레벨만).
    /// </summary>
    public static class GoMounts
    {
        public sealed class Mount
        {
            public string Id, NameKey, NameKo;
            public int Lv;
            /// <summary>걷는 속도 배율(지상 탈것 = 달릴 때, 비행 탈것 = 땅에서).</summary>
            public float Mul;
            public bool IsFly;
            /// <summary>비행 — 뜬 동안 걷는 속도 배율 · 오를 수 있는 높이(지면 위 m).</summary>
            public float Fly, Ceil;
            public string Name => GoLocalization.T(NameKey, NameKo);
        }

        private static Mount G(string id, string ko, int lv, float mul) => new Mount { Id = id, NameKey = "mount." + id, NameKo = ko, Lv = lv, Mul = mul };
        private static Mount F(string id, string ko, int lv, float mul, float fly, float ceil) => new Mount { Id = id, NameKey = "mount." + id, NameKo = ko, Lv = lv, Mul = mul, IsFly = true, Fly = fly, Ceil = ceil };

        public static readonly Mount[] All =
        {
            G("mt_farm", "농마", 5, 1.6f), G("mt_brown", "갈색 말", 15, 1.85f), G("mt_white", "흰 말", 30, 2.1f),
            F("mt_crane", "학", 20, 1.5f, 2.6f, 40f), F("mt_dragon", "푸른 용", 40, 1.7f, 3.4f, 70f),
        };

        /// <summary>오르는·내리는 속도(m/초) · 뜬 것으로 치는 높이 · 지붕을 넘는 높이 · 이야기 구간에서 내려오는 속도 · 싸움이 가라앉은 뒤 다시 탈 수 있는 초.</summary>
        public const float Rise = 10f, Fall = 14f, AirMin = 2f, RoofH = 6f, LandRate = 14f, CombatCalmSec = 3f;

        /// <summary>진단 — 켜져 있으면 탈것이 없는 것처럼(옛 진단이 속도를 잴 때 흔들리지 않게).</summary>
        public static bool OffForTest;
        /// <summary>오르내림 입력(−1 내림·0 멈춤·1 오름) — `MountField` 가 키·단추로 채운다.</summary>
        public static float Lift;
        /// <summary>마지막으로 싸운 때(`Time.time`) — `MountField` 가 채운다(싸움 직후엔 못 탄다).</summary>
        public static float LastCombatAt = -999f;

        private static string _sel = "";
        public static Mount Riding { get; private set; }
        public static string Sel => _sel;
        public static event Action Changed;

        public static bool RidingFly => Riding != null && Riding.IsFly;
        public static bool RidingGround => Riding != null && !Riding.IsFly;

        public static Mount Def(string id)
        {
            foreach (var m in All) if (m.Id == id) return m;
            return null;
        }

        public static bool Unlocked(Mount m) => !OffForTest && m != null && PlayerStats.Level >= m.Lv;

        public static List<Mount> UnlockedList()
        {
            var l = new List<Mount>();
            foreach (var m in All) if (Unlocked(m)) l.Add(m);
            return l;
        }

        /// <summary>고른 탈것 — 안 골랐거나 못 쓰면 쓸 수 있는 것 중 지상 탈것 가장 빠른 것(없으면 첫 것, 아무것도 없으면 null).</summary>
        public static Mount Selected()
        {
            var sel = Def(_sel);
            if (sel != null && Unlocked(sel)) return sel;
            Mount bestGround = null, first = null;
            foreach (var m in All)
            {
                if (!Unlocked(m)) continue;
                if (first == null) first = m;
                if (!m.IsFly && (bestGround == null || m.Mul > bestGround.Mul)) bestGround = m;
            }
            return bestGround ?? first;
        }

        /// <summary>이야기 임무가 날면 안 되는 단계인가 — 오르기·섬·배·따라가기·쫓기·보스·지키기·무리.</summary>
        public static bool StoryBlocked
        {
            get
            {
                var st = StoryState.StoryCurrent;
                if (st == null) return false;
                switch (st.Type)
                {
                    case GoStory.StepType.Sky: case GoStory.StepType.Climb: case GoStory.StepType.Sail: case GoStory.StepType.Follow:
                    case GoStory.StepType.Chase: case GoStory.StepType.Duel: case GoStory.StepType.Defend: case GoStory.StepType.Kill: return true;
                    default: return false;
                }
            }
        }

        /// <summary>탈 수 있나 — 없거나 싸우는 중·싸움 직후면 안 된다. 이유를 돌려준다.</summary>
        public static bool CanRide(float now, out string why)
        {
            why = null;
            if (Selected() == null) { why = GoLocalization.T("mount.none", "아직 탈것이 없다 — 모험 레벨 5 에 첫 탈것"); return false; }
            var fc = FieldCombat.Instance;
            if ((fc != null && fc.InCombat()) || now - LastCombatAt < CombatCalmSec) { why = GoLocalization.T("mount.no_combat", "싸우는 중엔 탈 수 없다"); return false; }
            return true;
        }

        public static bool TryRide(float now, out string why)
        {
            if (!CanRide(now, out why)) return false;
            Riding = Selected();
            Lift = 0f;
            Changed?.Invoke();
            return true;
        }

        public static void Dismount()
        {
            if (Riding == null) return;
            Riding = null;
            Lift = 0f;
            Changed?.Invoke();
        }

        /// <summary>Shift+H — 쓸 수 있는 탈것을 차례로 돌려 고른다(타고 있으면 그 자리에서 바꿈). 고른 것을 돌려준다(없으면 null).</summary>
        public static Mount Cycle()
        {
            var l = UnlockedList();
            if (l.Count == 0) return null;
            int i = l.IndexOf(Selected());
            var next = l[(i + 1) % l.Count];
            _sel = next.Id;
            if (Riding != null) { Riding = next; Lift = 0f; }
            Changed?.Invoke();
            return next;
        }

        /// <summary>지상에서 걷는 속도 배율 — 탄 것의 배율(안 탔으면 1).</summary>
        public static float GroundMul => Riding != null ? Riding.Mul : 1f;

        /// <summary>뜬 동안 걷는 속도 배율(비행 탈것) — 아니면 1.</summary>
        public static float FlyMul => RidingFly ? Riding.Fly : 1f;

        /// <summary>땅에서 이 높이면 뜬 것으로 친다(`AirMin` 넘게).</summary>
        public static bool Airborne(float heightAboveGround) => heightAboveGround > AirMin;

        // ---- 세이브 --------------------------------------------------------------------------------------------

        public static string Snapshot() => _sel;

        /// <summary>불러오기·새 게임·진단 — 없거나 모르는 id 면 안 고른 채. 탄 채로는 불러오지 않는다.</summary>
        public static void Restore(string sel)
        {
            _sel = Def(sel) != null ? sel : "";
            Riding = null;
            Lift = 0f;
            Changed?.Invoke();
        }

        public static void ResetForTest()
        {
            OffForTest = false;
            LastCombatAt = -999f;
            Restore("");
        }
    }
}
