using System;
using System.Collections.Generic;

namespace Saga.Story.Data
{
    /// <summary>
    /// PLAN.md 109-15 탈것·비행 — 사가종횡판(웹 사가종횡 `js/mount.js` · SAGA-DESIGN §15, 메이플식 횡스크롤 = 탈것이 원작 문법 그대로).
    /// 지상 셋(농마 4 · 갈색 말 12 · 흰 말 22 — 모험 레벨이 되면 쓴다)은 **이동 속도 ×1.35·1.55·1.75 + 점프 ×1.06·1.10·1.14**,
    /// 날개 둘(학 16 · 푸른 용 30)은 땅에서 ×1.25·×1.5, **중력 ×0.22·낙하 속도 상한 2.8m/초(웹 140px)·공중에서 점프를 다시 누르면 날갯짓**(점프의 0.8배, 0.16초 쉼)으로 솟고
    /// 맨 위 천장(웹 20px = <see cref="FieldMapData.HeightOfPx"/>)에서 멎는다. **두목의 싸움터(X 14m 안·비경)에선 못 난다**(걷는 배율만 — 보스전은 땅에서. 이 판은 두목이 들판 끝에 늘 서 있어 '살아 있으면' 이면 영영 못 난다), 줄에 매달린 동안도 안 난다.
    /// **H = 타고 내리기 · Shift+H = 다른 탈것 고르기.** 저절로 내리는 때(메이플의 "탈것 위에선 못 싸운다"): 공격·무예(J·1~8·기합·기탄·횡소·소환)를 쓰면 · 맞으면 · 컷 동안 · 줄을 잡으면(지상 탈것).
    /// 세이브는 `mountSel` 한 칸(탄 채는 저장 안 함). 웹의 "도감에 등록한 펫" 열림은 이 판 도감이 없어 레벨만. 판정 층은 순수(레벨만 읽는다).
    /// </summary>
    public static class StoryMounts
    {
        public sealed class Mount
        {
            public string Id, NameKey, NameKo;
            public int Lv;
            /// <summary>걷는 속도 배율 · 점프 배율(지상 탈것만 1 이상).</summary>
            public float Mul, Jump;
            public bool IsFly;
            public string Name => StoryLocalization.T(NameKey, NameKo);
        }

        private static Mount G(string id, string ko, int lv, float mul, float jump) => new Mount { Id = id, NameKey = "mount." + id, NameKo = ko, Lv = lv, Mul = mul, Jump = jump };
        private static Mount F(string id, string ko, int lv, float mul) => new Mount { Id = id, NameKey = "mount." + id, NameKo = ko, Lv = lv, Mul = mul, Jump = 1f, IsFly = true };

        public static readonly Mount[] All =
        {
            G("mt_farm", "농마", 4, 1.35f, 1.06f), G("mt_brown", "갈색 말", 12, 1.55f, 1.10f), G("mt_white", "흰 말", 22, 1.75f, 1.14f),
            F("mt_crane", "학", 16, 1.25f), F("mt_dragon", "푸른 용", 30, 1.5f),
        };

        /// <summary>날개 탈것 — 중력 배율 · 낙하 속도 상한(m/초) · 날갯짓 세기(점프 대비)·쉼(초) · 천장(웹 y 픽셀).</summary>
        public const float FlyGrav = 0.22f, FlyFallCap = 140f * 0.02f, FlapVy = 0.8f, FlapCd = 0.16f, CeilPx = 20f;
        /// <summary>두목의 싸움터 반경(m, X) — 등장 컷 거리(9m)보다 조금 넓게. 들판 끝에 서 있는 두목이 살아 있는 동안 저 멀리에선 날 수 있다.</summary>
        public const float BossArenaM = 14f;

        /// <summary>진단 — 켜져 있으면 탈것이 없는 것처럼.</summary>
        public static bool OffForTest;
        /// <summary>두목이 살아 있는 사냥터인가 — `MountField` 가 매 프레임 채운다(진단은 직접 준다).</summary>
        public static bool BossHere;

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

        public static bool Unlocked(Mount m) => !OffForTest && m != null && StoryJobState.Level >= m.Lv;

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

        /// <summary>탈 수 있나 — 탈것이 없거나 줄에 매달려 있으면 안 된다. 이유를 돌려준다.</summary>
        public static bool CanRide(bool onRope, out string why)
        {
            why = null;
            if (Selected() == null) { why = string.Format(StoryLocalization.T("mount.none", "아직 탈것이 없다 — 레벨 {0} 에 첫 탈것"), All[0].Lv); return false; }
            if (onRope) { why = StoryLocalization.T("mount.no_rope", "줄에 매달린 채로는 못 탄다"); return false; }
            return true;
        }

        public static bool TryRide(bool onRope, out string why)
        {
            if (!CanRide(onRope, out why)) return false;
            Riding = Selected();
            Changed?.Invoke();
            return true;
        }

        public static void Dismount()
        {
            if (Riding == null) return;
            Riding = null;
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
            if (Riding != null) Riding = next;
            Changed?.Invoke();
            return next;
        }

        /// <summary>이동 속도 배율(안 탔으면 1) · 지상 탈것의 점프 배율(아니면 1).</summary>
        public static float SpeedMul => Riding != null ? Riding.Mul : 1f;
        public static float JumpMul => RidingGround ? Riding.Jump : 1f;

        /// <summary>지금 나는 중인가 — 날개 탈것이고, 두목이 없고, 줄에 안 매달렸다. (땅에 발이 닿아 있어도 '날 수 있는 상태'다 — 중력 ×0.22 는 늘 걸린다.)</summary>
        public static bool CanFlyNow(bool onRope) => RidingFly && !onRope && !BossHere;

        // ---- 세이브 --------------------------------------------------------------------------------------------

        public static string Snapshot() => _sel;

        /// <summary>불러오기·새 게임·진단 — 없거나 모르는 id 면 안 고른 채. 탄 채로는 불러오지 않는다.</summary>
        public static void Restore(string sel)
        {
            _sel = Def(sel) != null ? sel : "";
            Riding = null;
            Changed?.Invoke();
        }

        public static void ResetForTest()
        {
            OffForTest = false;
            BossHere = false;
            Restore("");
        }
    }
}
