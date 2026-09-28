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

        // ---- PLAN.md 109-14-18 편성 여러 벌(웹 사가고 ⑲-18 `formation.js` presets) — 칸 넷, 칸마다 들판 셋 순서.
        // 지금 들판(FieldIds)이 늘 정본 — 지금 칸은 읽을 때마다 지금 들판으로 적힌다(넣기·빼기·앞 자리로·합류 어디서 바뀌든).
        // 이 트랙은 동행 전부가 명단이라 "비운 들판"이 없다 — 빈 칸을 고르면 지금 들판을 그대로 베껴 시작한다(웹은 나 혼자).
        public const int Presets = 4;
        private static readonly string[][] _presets = new string[Presets][];
        private static int _presetAt;

        private static void Sync()
        {
            if (_presetAt < 0 || _presetAt >= Presets) _presetAt = 0;
            _presets[_presetAt] = FieldIds().ToArray();
        }

        public static int PresetAt() { Sync(); return _presetAt; }

        /// <summary>칸 i 의 들판 셋(지금 칸이면 지금 들판, 빈 칸이면 빈 목록).</summary>
        public static IReadOnlyList<string> PresetOf(int i)
        {
            Sync();
            return i >= 0 && i < Presets && _presets[i] != null ? _presets[i] : Array.Empty<string>();
        }

        /// <summary>칸 목록을 들판으로 쓸 수 있게 — 가진 동행만·겹침 뺌·셋까지.</summary>
        public static List<string> Pick(IEnumerable<string> list)
        {
            var o = new List<string>();
            if (list != null)
                foreach (var id in list)
                    if (!string.IsNullOrEmpty(id) && Has(id) && !o.Contains(id) && o.Count < FieldSlots) o.Add(id);
            return o;
        }

        /// <summary>칸 i 로 바꾼다 — 지금 들판은 지금 칸에 남고 칸 i 가 들판이 된다(그 사람들을 순서 맨 뒤로). 같은 칸·싸우는 중이면 안 한다.</summary>
        public static bool UsePreset(int i, bool fighting, out string why)
        {
            why = null;
            if (i < 0 || i >= Presets) { why = GoLocalization.T("preset.none", "없는 편성"); return false; }
            Sync();
            if (i == _presetAt) return false;
            if (fighting) { why = GoLocalization.T("dex.form_fighting", "싸우는 중엔 편성을 바꿀 수 없다"); return false; }
            var next = Pick(_presets[i]);
            for (int k = next.Count - 1; k >= 0; k--) Move(next[k], Members.Count); // 첫 자리가 맨 뒤 = 둘째 자리
            _presetAt = i;
            Sync();
            return true;
        }

        /// <summary>세이브 — 칸마다 id 를 쉼표로(JsonUtility 가 겹 목록을 못 적는다).</summary>
        public static List<string> SnapshotPresets()
        {
            Sync();
            var o = new List<string>();
            foreach (var p in _presets) o.Add(p != null ? string.Join(",", p) : "");
            return o;
        }

        /// <summary>불러오기·새 게임 — 없으면(옛 세이브) 빈 칸 넷, 지금 칸 1번(= 지금 들판).</summary>
        public static void RestorePresets(List<string> saved, int at)
        {
            for (int i = 0; i < Presets; i++)
                _presets[i] = saved != null && i < saved.Count && !string.IsNullOrEmpty(saved[i]) ? saved[i].Split(',') : null;
            _presetAt = at >= 0 && at < Presets ? at : 0;
            Sync();
        }

        private static void Recompute()
        {
            Atk = BaseAtk + Members.Count * AtkPerMember;
            Def = BaseDef + Members.Count * DefPerMember;
        }
    }
}
