using System;
using System.Collections.Generic;
using System.Globalization;
using UnityEngine;

namespace Saga.Realm.Data
{
    /// <summary>
    /// PLAN.md 109-15 명마·비행 — 사가국지판(웹 사가국지 `js/mount.js` · SAGA-DESIGN §15, 코에이식 경영 = 명마는 장수에 장착, 비행은 국토 지도 둘러보기 카메라만).
    /// 열림은 **다스리는 성 수**(<see cref="RealmCityState.ActiveCityIds"/>): 농마 2 · 갈색 말 4 · 학 5 · 흰 말 7 · 푸른 용 9.
    /// **명마**(지상 셋)는 장수 카드에 **장착**한다 — 한 필은 한 사람만, 한 사람은 한 필만. 그 장수가 든 출진군은 **땅 위 싸움**(강가 = 수전 ✕)에서 부대의 힘이
    /// ×1.03·1.06·1.10 (<see cref="RealmWar.ArmyPower"/> 가 곱한다), 싸움터 컷에선 그 군이 <see cref="ChargeOf"/> = 1 + (mul−1)×3 배 빨리 달려 붙는다.
    /// 우리 세력 장수만 — 떠나거나(로스터에서 빠지면) 말은 저절로 마구간으로 돌아온다(장착 효과가 없어진다).
    /// **비행**(학 ×1.7 · 푸른 용 ×2.4)은 경영 판이라 싸움엔 안 쓰고 **국토 지도 카메라**만 바꾼다: H = 날기/내리기(지도를 보고 있을 때만) · Shift+H = 학·용 고르기.
    /// 나는 동안 카메라가 낮게 기울고 가까워지며 돌아보는 속도가 ×배율로 빨라지고, 자동으로 천천히 돌며 둘러본다. 세이브는 `mountSel`(비행 고르기)·장착 표(장수 → 말). 나는 상태는 저장 안 함.
    /// 판정 층은 순수(성 수·로스터만 읽는다). 손잡이 <see cref="OffForTest"/> 는 진단이 탈것을 끈다(웹 `mount.on`).
    /// </summary>
    public static class RealmMounts
    {
        public sealed class Mount
        {
            public string Id, NameKey, NameKo;
            /// <summary>다스리는 성 수 문턱.</summary>
            public int Cities;
            /// <summary>땅 싸움에서 부대의 힘 배율(명마) — 비행은 1.</summary>
            public float Mul;
            public bool IsFly;
            /// <summary>비행 — 나는 동안 지도 돌아보기 배율.</summary>
            public float Fly;
            public string Name => RealmLocalization.T(NameKey, NameKo);
        }

        private static Mount G(string id, string ko, int cities, float mul) => new Mount { Id = id, NameKey = "mount." + id, NameKo = ko, Cities = cities, Mul = mul };
        private static Mount F(string id, string ko, int cities, float fly) => new Mount { Id = id, NameKey = "mount." + id, NameKo = ko, Cities = cities, Mul = 1f, IsFly = true, Fly = fly };

        public static readonly Mount[] All =
        {
            G("mt_farm", "농마", 2, 1.03f), G("mt_brown", "갈색 말", 4, 1.06f), G("mt_white", "흰 말", 7, 1.10f),
            F("mt_crane", "학", 5, 1.7f), F("mt_dragon", "푸른 용", 9, 2.4f),
        };

        /// <summary>돌격 속도 = 1 + (mul−1) × ChargeK · 나는 동안 카메라 기울기(라디안)·거리 — 웹 수치 그대로(거리는 이 트랙 지도 반지름 120~420 에 맞춘 값).</summary>
        public const float ChargeK = 3f, FlyPitch = 0.34f, FlyRadius = 130f;

        /// <summary>진단 — 켜져 있으면 탈것이 없는 것처럼(장착도 효과 없음).</summary>
        public static bool OffForTest;
        /// <summary>진단 — 0 이상이면 다스리는 성 수 대신 이 값.</summary>
        public static int CitiesForTest = -1;

        private static string _sel = "";
        private static readonly Dictionary<string, string> Eq = new Dictionary<string, string>();
        public static Mount Flying { get; private set; }
        public static string Sel => _sel;
        public static event Action Changed;

        public static int CityCount() => CitiesForTest >= 0 ? CitiesForTest : RealmCityState.ActiveCityIds.Count;

        public static Mount Def(string id)
        {
            foreach (var m in All) if (m.Id == id) return m;
            return null;
        }

        public static bool Unlocked(Mount m) => !OffForTest && m != null && CityCount() >= m.Cities;

        public static List<Mount> UnlockedList()
        {
            var l = new List<Mount>();
            foreach (var m in All) if (Unlocked(m)) l.Add(m);
            return l;
        }

        /// <summary>날 탈것 고르기 — 저장된 것이 열려 있으면 그것, 아니면 열린 것 중 가장 빠른 것(없으면 null).</summary>
        public static Mount Selected()
        {
            var sel = Def(_sel);
            if (sel != null && sel.IsFly && Unlocked(sel)) return sel;
            Mount best = null;
            foreach (var m in All) if (m.IsFly && Unlocked(m) && (best == null || m.Fly > best.Fly)) best = m;
            return best;
        }

        // ---- 명마(장착) ----------------------------------------------------------------------------------------

        /// <summary>우리 세력(로스터) 장수인가 — 아니면 말이 효과를 못 낸다.</summary>
        public static bool Mine(string officerId)
        {
            if (string.IsNullOrEmpty(officerId)) return false;
            foreach (var id in RealmCityState.RosterIds) if (id == officerId) return true;
            return false;
        }

        /// <summary>이 장수가 탄 명마 — 없거나 못 쓰거나 우리 장수가 아니면 null.</summary>
        public static Mount MountOf(string officerId)
        {
            if (OffForTest || string.IsNullOrEmpty(officerId)) return null;
            if (!Eq.TryGetValue(officerId, out var id)) return null;
            var m = Def(id);
            return m == null || m.IsFly || !Unlocked(m) || !Mine(officerId) ? null : m;
        }

        public static string RiderOf(string mountId)
        {
            foreach (var kv in Eq) if (kv.Value == mountId) return kv.Key;
            return null;
        }

        /// <summary>이 장수에게 쓸 수 있는 명마 — 열려 있고 다른 사람이 안 탄 것(자기가 탄 것 포함).</summary>
        public static List<Mount> FreeFor(string officerId)
        {
            var l = new List<Mount>();
            foreach (var m in All)
            {
                if (m.IsFly || !Unlocked(m)) continue;
                var r = RiderOf(m.Id);
                if (r == null || r == officerId) l.Add(m);
            }
            return l;
        }

        /// <summary>장착 — mountId 가 null 이면 내려 준다. 성공하면 null, 실패하면 이유.</summary>
        public static string Equip(string officerId, string mountId)
        {
            if (OffForTest) return RealmLocalization.T("mount.off", "탈것이 꺼져 있다");
            if (!Mine(officerId)) return RealmLocalization.T("mount.not_mine", "우리 세력 장수만 말을 탄다");
            if (string.IsNullOrEmpty(mountId))
            {
                if (!Eq.Remove(officerId)) return RealmLocalization.T("mount.none_ridden", "탄 말이 없다");
                Changed?.Invoke();
                return null;
            }
            var m = Def(mountId);
            if (m == null || m.IsFly) return RealmLocalization.T("mount.only_horse", "장수에게 얹는 건 명마뿐이다");
            if (!Unlocked(m)) return string.Format(RealmLocalization.T("mount.locked", "아직 못 쓰는 말 — 다스리는 성 {0}곳이 되면 열린다"), m.Cities);
            var other = RiderOf(m.Id);
            if (other != null && other != officerId) return RealmLocalization.T("mount.taken", "이미 다른 장수가 탄 말이다");
            Eq[officerId] = m.Id;
            Changed?.Invoke();
            return null;
        }

        /// <summary>장수 카드의 말 단추 — 말 없음 → 쓸 수 있는 다음 말 → … → 말 없음. 성공하면 null, 실패하면 이유.</summary>
        public static string CycleEquip(string officerId)
        {
            var free = FreeFor(officerId);
            if (free.Count == 0) return string.Format(RealmLocalization.T("mount.no_horse", "쓸 수 있는 말이 없다 — 다스리는 성 {0}곳이 되면 첫 말이 열린다"), All[0].Cities);
            Eq.TryGetValue(officerId, out var cur);
            Mount next = null;
            if (string.IsNullOrEmpty(cur)) next = free[0];
            else
            {
                for (int i = 0; i < free.Count; i++)
                    if (free[i].Id == cur) { next = i + 1 < free.Count ? free[i + 1] : null; break; }
            }
            return Equip(officerId, next != null ? next.Id : null);
        }

        /// <summary>출진군(장수 id 목록)의 가장 좋은 명마와 그 주인 — 땅 싸움에서만. 없으면 (null, null).</summary>
        public static (Mount mount, string officerId) BestFor(IReadOnlyList<string> officerIds, bool water)
        {
            Mount best = null; string who = null;
            if (water || officerIds == null) return (null, null);
            foreach (var id in officerIds)
            {
                var m = MountOf(id);
                if (m != null && (best == null || m.Mul > best.Mul)) { best = m; who = id; }
            }
            return (best, who);
        }

        /// <summary>부대 힘 배율 — 안 탔으면 1(옛 계산과 같다).</summary>
        public static float PowerMul(IReadOnlyList<string> officerIds, bool water)
        {
            var (m, _) = BestFor(officerIds, water);
            return m != null ? m.Mul : 1f;
        }

        /// <summary>싸움터 컷에서 그 군이 달려 붙는 속도 배율 — 명마 id 로.</summary>
        public static float ChargeOf(string mountId)
        {
            var m = Def(mountId);
            return m != null && !m.IsFly && !OffForTest ? 1f + (m.Mul - 1f) * ChargeK : 1f;
        }

        /// <summary>싸움 기록 한 줄 — 없으면 "".</summary>
        public static string Note(IReadOnlyList<string> officerIds, bool water)
        {
            var (m, who) = BestFor(officerIds, water);
            if (m == null) return "";
            var o = RealmOfficerPool.Get(who);
            return string.Format(RealmLocalization.T("mount.note", "🐎 {0}이(가) {1}을(를) 타고 앞장선다 — 부대의 힘 ×{2}"), o != null ? o.Name : who, m.Name, m.Mul.ToString("0.##", CultureInfo.InvariantCulture));
        }

        // ---- 비행(런타임 — 저장 안 함) ---------------------------------------------------------------------------

        public static bool IsFlying => Flying != null;

        /// <summary>날 수 있나 — 고를 탈것이 있고, 국토 지도를 보고 있어야 한다. 이유를 돌려준다.</summary>
        public static bool CanFly(bool viewingMap, out string why)
        {
            why = null;
            if (Selected() == null) { why = string.Format(RealmLocalization.T("mount.no_fly", "아직 날 것이 없다 — 다스리는 성 {0}곳이 되면 학이 열린다"), Def("mt_crane").Cities); return false; }
            if (!viewingMap) { why = RealmLocalization.T("mount.map_only", "국토 지도에서만 난다"); return false; }
            return true;
        }

        public static bool TryFly(bool viewingMap, out string why)
        {
            if (!CanFly(viewingMap, out why)) return false;
            Flying = Selected();
            Changed?.Invoke();
            return true;
        }

        public static void Land()
        {
            if (Flying == null) return;
            Flying = null;
            Changed?.Invoke();
        }

        /// <summary>Shift+H — 열린 날 탈것을 차례로 돌려 고른다(나는 중이면 그 자리에서 바뀜). 없으면 null.</summary>
        public static Mount CycleFly()
        {
            var fl = new List<Mount>();
            foreach (var m in UnlockedList()) if (m.IsFly) fl.Add(m);
            if (fl.Count == 0) return null;
            var next = fl[(fl.IndexOf(Selected()) + 1) % fl.Count];
            _sel = next.Id;
            if (Flying != null) Flying = next;
            Changed?.Invoke();
            return next;
        }

        /// <summary>지도 돌아보기 배율 — 안 날면 1.</summary>
        public static float PanMul => Flying != null ? Flying.Fly : 1f;

        // ---- 세이브 --------------------------------------------------------------------------------------------

        public static string Snapshot() => _sel;

        public static void SnapshotEq(out string[] officers, out string[] mounts)
        {
            var o = new List<string>(); var m = new List<string>();
            foreach (var kv in Eq) { o.Add(kv.Key); m.Add(kv.Value); }
            officers = o.ToArray(); mounts = m.ToArray();
        }

        /// <summary>불러오기·새 게임·진단 — 모르는 id·중복 말은 버린다. 나는 채로는 불러오지 않는다.</summary>
        public static void Restore(string sel, string[] officers, string[] mounts)
        {
            _sel = Def(sel) != null && Def(sel).IsFly ? sel : "";
            Flying = null;
            Eq.Clear();
            if (officers != null && mounts != null)
            {
                int n = Math.Min(officers.Length, mounts.Length);
                for (int i = 0; i < n; i++)
                {
                    var m = Def(mounts[i]);
                    if (string.IsNullOrEmpty(officers[i]) || m == null || m.IsFly || RiderOf(m.Id) != null || Eq.ContainsKey(officers[i])) continue;
                    Eq[officers[i]] = m.Id;
                }
            }
            Changed?.Invoke();
        }

        public static void ResetForTest()
        {
            OffForTest = false;
            CitiesForTest = -1;
            Restore("", null, null);
        }
    }
}
