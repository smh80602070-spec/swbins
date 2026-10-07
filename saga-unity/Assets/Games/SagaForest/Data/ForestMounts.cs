using System;
using System.Collections.Generic;
using UnityEngine;

namespace Saga.Forest.Data
{
    /// <summary>
    /// PLAN.md 109-15 탈것·비행 — 사가마을판(웹 사가마을 `js/mount.js` · SAGA-DESIGN §15, 사용자 2026-09-29 "탈것도 추가 가능할지, 날아다니는 것도").
    /// 지상 셋(사슴 ×1.4 · 갈색 말 ×1.7 · 흰 말 ×1.95)은 걷는 속도에 배율을 곱하고, 비행 둘(학 ×1.5 · 푸른 용 ×1.8)은 **마을 위를 낮게 떠서** 나무·바위·소품을 넘는다.
    /// **이 트랙 다름**: 이 판엔 모험 레벨이 없어(웹은 레벨 3·8·10·14·18) **마을 점수**(<see cref="ForestTownScore.Total"/> — 집 꾸미기·박물관 기증·눌러앉은 손님)로 연다:
    /// 사슴 20 · 갈색 말 60(★2) · 학 100(★3) · 흰 말 150(★4) · 푸른 용 200(★5) — 웹 레벨 순서(사슴 → 말 → 학 → 흰 말 → 용) 그대로, 별 경계(0/60/100/150/200)에 맞춘다.
    /// 뜬 동안엔 손이 닿는 일(줍기·말 걸기·집 문·좌판 — 전부 2.5m 안 근접)이 안 되게 <see cref="Hover"/> 2.8m 위로 뜬다 — 내리려면 H(웹 "먼저 내려앉는다").
    /// 마을 밖으로는 못 나간다(가장자리에서 미끄러짐 — 이 판엔 바다가 없다). 집에 들어가면 저절로 내린다. 달려 나가는 만큼 택배(깨지기 쉬움)는 지상 탈것이 달리기로 친다.
    /// **H = 타고 내리기 · Shift+H = 다른 탈것 고르기.** 세이브는 `mountSel` 한 칸(탄 채는 저장 안 함). 판정 층은 순수(마을 점수만 읽는다).
    /// </summary>
    public static class ForestMounts
    {
        public sealed class Mount
        {
            public string Id, NameKey, NameKo;
            /// <summary>마을 점수 문턱(웹 모험 레벨 대신).</summary>
            public int Score;
            /// <summary>걷는 속도 배율(비행도 같은 배율 — 웹 `mul`).</summary>
            public float Mul;
            public bool IsFly;
            public string Name => ForestLocalization.T(NameKey, NameKo);
        }

        private static Mount G(string id, string ko, int score, float mul) => new Mount { Id = id, NameKey = "mount." + id, NameKo = ko, Score = score, Mul = mul };
        private static Mount F(string id, string ko, int score, float mul) => new Mount { Id = id, NameKey = "mount." + id, NameKo = ko, Score = score, Mul = mul, IsFly = true };

        public static readonly Mount[] All =
        {
            G("mt_deer", "사슴", 20, 1.4f), G("mt_brown", "갈색 말", 60, 1.7f), G("mt_white", "흰 말", 150, 1.95f),
            F("mt_crane", "학", 100, 1.5f), F("mt_dragon", "푸른 용", 200, 1.8f),
        };

        /// <summary>뜬 높이(m — 손이 닿는 일의 반경 2.5m 밖) · 오르내리는 속도(m/초) · 마을 가장자리에서 들이는 안쪽 여백(m).</summary>
        public const float Hover = 2.8f, Rise = 6f, EdgeInset = 1f;
        /// <summary>집 안 — 마을 좌표와 안 겹치는 먼 자리(`ForestHouse.IndoorPocketOffset` z=500).</summary>
        public const float IndoorZ = 250f;

        /// <summary>진단 — 켜져 있으면 탈것이 없는 것처럼.</summary>
        public static bool OffForTest;
        /// <summary>진단 — 0 이상이면 마을 점수 대신 이 값(집 꾸미기·박물관을 채우지 않고 문턱을 재려고).</summary>
        public static int ScoreForTest = -1;

        private static string _sel = "";
        public static Mount Riding { get; private set; }
        public static string Sel => _sel;
        public static event Action Changed;

        public static bool RidingFly => Riding != null && Riding.IsFly;
        public static bool RidingGround => Riding != null && !Riding.IsFly;

        public static int Progress() => ScoreForTest >= 0 ? ScoreForTest : ForestTownScore.Total();

        public static Mount Def(string id)
        {
            foreach (var m in All) if (m.Id == id) return m;
            return null;
        }

        public static bool Unlocked(Mount m) => !OffForTest && m != null && Progress() >= m.Score;

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

        public static bool Indoors(Vector3 pos) => pos.z > IndoorZ;

        /// <summary>탈 수 있나 — 탈것이 없거나 집 안이면 안 된다. 이유를 돌려준다.</summary>
        public static bool CanRide(Vector3 pos, out string why)
        {
            why = null;
            if (Selected() == null) { why = string.Format(ForestLocalization.T("mount.none", "아직 탈것이 없다 — 마을 점수 {0}점에 첫 사슴"), All[0].Score); return false; }
            if (Indoors(pos)) { why = ForestLocalization.T("mount.no_house", "집 안에선 못 탄다"); return false; }
            return true;
        }

        public static bool TryRide(Vector3 pos, out string why)
        {
            if (!CanRide(pos, out why)) return false;
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

        /// <summary>걷는 속도 배율 — 탄 것의 배율(안 탔으면 1).</summary>
        public static float SpeedMul => Riding != null ? Riding.Mul : 1f;

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
            ScoreForTest = -1;
            Restore("");
        }
    }
}
