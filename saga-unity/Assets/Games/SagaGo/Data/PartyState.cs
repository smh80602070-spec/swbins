using System;
using System.Collections.Generic;

namespace Saga.Go.Data
{
    /// <summary>
    /// VERTICAL_SLICE.md 완료 조건(12단계 루프)의 "도적이 부대에 합류한다" ·
    /// "부대 전투력이 올랐다는 걸 화면에서 확인한다"를 위한 최소 구현.
    /// saga-godot의 project.godot [autoload] 싱글턴(party_state.gd)과 같은
    /// 역할 — Unity엔 오토로드가 없어 static 클래스로 대신한다(씬을 새로
    /// 열어도 값이 남는다는 뜻이 아니라, 어느 스크립트에서든 이름으로 바로
    /// 쓸 수 있다는 뜻만 같다). 이 클래스는 등용한 인원 수만 세고 그 수에
    /// 비례해 공격력/방어력을 올린다 — 캐릭터 레벨(PlayerStats.cs)·장비
    /// (Inventory.cs)는 별도 축으로 따로 관리하고, 실전투력은 BanditEncounter
    /// 가 셋을 합쳐 만든다.
    ///
    /// BaseAtk/BaseDef는 예전 BanditEncounter의 임시 상수와 같은 값이다 —
    /// 아직 아무도 등용하지 않았을 때 기존 전투 밸런스가 그대로 유지되도록
    /// 맞췄다.
    /// </summary>
    public static class PartyState
    {
        public const float BaseAtk = 60f;
        public const float BaseDef = 35f;
        public const float AtkPerMember = 18f;
        public const float DefPerMember = 10f;

        private static readonly List<string> Members = new List<string>();

        public static float Atk { get; private set; } = BaseAtk;
        public static float Def { get; private set; } = BaseDef;

        /// <summary>SaveState.cs가 저장할 때 읽는다 — 바깥에서 못 고친다.</summary>
        public static IReadOnlyList<string> MemberIds => Members;

        public static event Action<float, float> PowerChanged;

        public static void Recruit(string id)
        {
            Members.Add(id);
            BondState.EnsureMember(id); // PLAN.md 101-2 ⑥ "인연" — 등용 순간부터 인연이 쌓이기 시작한다.
            Recompute();
            PowerChanged?.Invoke(Atk, Def);
        }

        /// <summary>세이브 파일을 불러온 뒤 여기로 넘긴다 — Recruit()와 다르게
        /// 이미 정해진 목록을 통째로 앉히고 수치만 다시 계산한다(한 명씩
        /// 등용하며 이벤트를 여러 번 쏘지 않는다).</summary>
        public static void Restore(IEnumerable<string> savedMembers)
        {
            Members.Clear();
            Members.AddRange(savedMembers);
            foreach (var id in Members) BondState.EnsureMember(id);
            Recompute();
            PowerChanged?.Invoke(Atk, Def);
        }

        // ---- PLAN.md 109-14-15 편성(웹 사가고 ⑲-15 `formation.js`) — 들판 명단 = 주인공 + 동행 순서의 뒤 셋(가장 뒤 = 둘째 자리).
        // 순서가 곧 편성이라 세이브 칸이 새로 없다(`partyMembers` 순서 그대로). 등용하면 맨 뒤 = 들판에 바로 선다(예전과 같다).
        public const int FieldSlots = 3;

        /// <summary>들판에 서는 동행 — 둘째·셋째·넷째 자리 순서.</summary>
        public static List<string> FieldIds()
        {
            var list = new List<string>();
            for (int k = Members.Count - 1; k >= 0 && list.Count < FieldSlots; k--)
                if (!list.Contains(Members[k])) list.Add(Members[k]);
            return list;
        }

        public static int FieldSlotOf(string id) => FieldIds().IndexOf(id);

        private static bool Move(string id, int to)
        {
            int i = Members.IndexOf(id);
            if (i < 0) return false;
            Members.RemoveAt(i);
            Members.Insert(UnityEngine.Mathf.Clamp(to, 0, Members.Count), id);
            PowerChanged?.Invoke(Atk, Def);
            return true;
        }

        /// <summary>들판에 넣기 — 둘째 자리로(가장 오래 선 셋째가 빠진다).</summary>
        public static bool ToField(string id) => FieldSlotOf(id) != 0 && Move(id, Members.Count);

        /// <summary>들판에서 빼기 — 맨 앞으로(동행이 넷 이상일 때만 뺄 수 있다).</summary>
        public static bool Bench(string id) => Members.Count > FieldSlots && FieldSlotOf(id) >= 0 && Move(id, 0);

        /// <summary>◀ 앞 자리로 — 들판 명단 안에서 한 자리 앞(둘째 쪽)으로.</summary>
        public static bool MoveUp(string id)
        {
            int s = FieldSlotOf(id);
            if (s <= 0) return false;
            int i = Members.IndexOf(id), j = Members.IndexOf(FieldIds()[s - 1]);
            Members[i] = Members[j];
            Members[j] = id;
            PowerChanged?.Invoke(Atk, Def);
            return true;
        }

        public static bool Has(string id) => Members.Contains(id);

        private static void Recompute()
        {
            Atk = BaseAtk + Members.Count * AtkPerMember;
            Def = BaseDef + Members.Count * DefPerMember;
        }
    }
}
