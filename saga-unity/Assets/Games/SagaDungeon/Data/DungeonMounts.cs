using System;
using System.Collections.Generic;
using UnityEngine;

namespace Saga.Dungeon.Data
{
    /// <summary>
    /// PLAN.md 109-15 탈것·비행 — 사가블로판(웹 사가블로 `js/mount.js` · SAGA-DESIGN §15, 사용자 2026-09-29 "탈것도 추가 가능할지, 날아다니는 것도").
    /// 이 트랙의 바깥 세상은 30m 간격 3×3 칸(`DungeonWorldMap`)이라 **열린 세계 = 그 칸 안**, 던전 층 방·능묘 속·난입·시련 방은 칸 밖이다.
    /// 지상 말 셋(농마 5·갈색 말 14·흰 말 26 — 모험 레벨이 되면 쓴다)은 걷는 속도에 배율(×1.5·1.75·2.0)을 곱하고,
    /// 비행 탈것 둘(학 18·푸른 용 34)은 땅에서 ×1.3·×1.4, 뜨면 ×1.6·×1.9 로 X 로 오르고 Z 로 내려 높이 한도(3.2·3.8m)까지 뜬다 — 웹은 소품을 넘어 뜨는
    /// 낮은 비행이라, 이 트랙도 **방 벽(4m)은 못 넘는 높이**로 잡았다(벽 너머는 바닥이 없는 빈 곳이라 넘으면 끝없이 떨어진다). 낮은 발판·틈·징검돌·선반을 넘는다.
    /// 뜬 채로도 칸 밖(던전 문·바깥 벽)으로는 못 나간다.
    /// **H = 타고 내리기 · Shift+H = 다른 탈것 고르기**(안 골랐을 땐 지상 탈것 중 가장 빠른 것). 세이브는 `mountSel` 한 칸(탄 채는 저장 안 함).
    /// 저절로 내리는 때: 적을 치면 · 맞으면 · 칸 밖(던전)으로 나가면 · 뛰거나 벽을 붙잡으면(지상 탈것) · 컷 동안. 손잡이 <see cref="OffForTest"/> 는 진단이 탈것을 끈다(웹 `mount.on`).
    /// 판정 층(<see cref="Unlocked"/>·<see cref="Selected"/>·<see cref="GroundMul"/>)은 순수(레벨만 읽는다). 웹의 "도감에 등록한 말" 열림은 이 판 도감이 괴물이라 없다(레벨만).
    /// </summary>
    public static class DungeonMounts
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
            public string Name => DungeonLocalization.T(NameKey, NameKo);
        }

        private static Mount G(string id, string ko, int lv, float mul) => new Mount { Id = id, NameKey = "mount." + id, NameKo = ko, Lv = lv, Mul = mul };
        private static Mount F(string id, string ko, int lv, float mul, float fly, float ceil) => new Mount { Id = id, NameKey = "mount." + id, NameKo = ko, Lv = lv, Mul = mul, IsFly = true, Fly = fly, Ceil = ceil };

        public static readonly Mount[] All =
        {
            G("mt_farm", "농마", 5, 1.5f), G("mt_brown", "갈색 말", 14, 1.75f), G("mt_white", "흰 말", 26, 2.0f),
            F("mt_crane", "학", 18, 1.3f, 1.6f, 3.2f), F("mt_dragon", "푸른 용", 34, 1.4f, 1.9f, 3.8f),
        };

        /// <summary>오르는·내리는 속도(m/초) · 뜬 것으로 치는 높이(지면 위 m).</summary>
        public const float Rise = 5f, Fall = 7f, AirMin = 1f;

        /// <summary>진단 — 켜져 있으면 탈것이 없는 것처럼(옛 진단이 속도를 잴 때 흔들리지 않게).</summary>
        public static bool OffForTest;
        /// <summary>오르내림 입력(−1 내림·0 멈춤·1 오름) — `MountField` 가 키·단추로 채운다.</summary>
        public static float Lift;

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

        public static bool Unlocked(Mount m) => !OffForTest && m != null && HeroState.Level >= m.Lv;

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

        /// <summary>열린 세계(마을·갈림길·던전 길 — 칸 안)에 서 있나. 던전 층 방·능묘 속·난입·시련 방은 칸 밖이라 아니다.</summary>
        public static bool InOpenWorld(Vector3 pos) => DungeonWorldMap.IndexAt(pos) >= 0;

        /// <summary>탈 수 있나 — 탈것이 없거나 칸 밖(던전 안)이면 안 된다. 이유를 돌려준다.</summary>
        public static bool CanRide(Vector3 pos, out string why)
        {
            why = null;
            if (Selected() == null) { why = DungeonLocalization.T("mount.none", "아직 탈것이 없다 — 모험 레벨 5 에 첫 탈것"); return false; }
            if (!InOpenWorld(pos)) { why = DungeonLocalization.T("mount.no_dungeon", "마을·들판에서만 탈 수 있다(던전 안 ✕)"); return false; }
            return true;
        }

        public static bool TryRide(Vector3 pos, out string why)
        {
            if (!CanRide(pos, out why)) return false;
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

        /// <summary>땅에서 걷는 속도 배율 — 탄 것의 배율(안 탔으면 1).</summary>
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
            Restore("");
        }
    }
}
