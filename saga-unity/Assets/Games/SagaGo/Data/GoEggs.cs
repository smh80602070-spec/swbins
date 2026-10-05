using System;
using System.Collections.Generic;
using UnityEngine;

namespace Saga.Go.Data
{
    /// <summary>
    /// tasks U-0046 신수 알·동행 신수 표(saga-godot `data/eggs.gd`·`saga_core/data/pets.gd`) — 포켓몬GO 의 알 부화·파트너를 이 판 문법으로.
    /// 알은 상자·일과·숨은 터·주간 보스·꽃·주간 도전 완주에서 나와 주머니에 쌓이고, 부화기에 넣고 **걸은 거리(m)** 만큼 차면 신수 하나가 나온다.
    /// 동행 신수는 500m 마다 친밀 +1(최대 10), 친밀 10 에서 갈래별 최대 +8~14%(힘 = 공격 · 지혜 = 경험치 · 통솔 = 방어).
    /// 신수 이름은 한국 설화 속 존재라 이름 정책 대상이 아니다(고돗 파일 머리말). 동행 몸(3D)은 에셋이라 K-0075 로 요청했다.
    /// </summary>
    public static class GoEggs
    {
        public readonly struct Pet
        {
            public readonly string Id, NameKo, Stat, DescKo;
            public readonly int Rarity, Value;
            public Pet(string id, string nameKo, int rarity, string stat, int value, string descKo) { Id = id; NameKo = nameKo; Rarity = rarity; Stat = stat; Value = value; DescKo = descKo; }
            public string Name => GoLocalization.T("pet.name." + Id, NameKo);
            public string Desc => GoLocalization.T("pet.desc." + Id, DescKo);
            /// <summary>"atk" | "exp" | "def".</summary>
            public string Kind => Stat == "might" ? "atk" : Stat == "wisdom" ? "exp" : "def";
        }

        public static readonly Pet[] Pets =
        {
            new Pet("pt_samjogo", "삼족오", 5, "wisdom", 12, "고구려 벽화의 세 발 까마귀. 해를 품고 난다."),
            new Pet("pt_haetae", "해태", 5, "command", 12, "시비와 선악을 가리는 상상의 짐승."),
            new Pet("pt_cheongryong", "청룡", 5, "might", 14, "동방을 지키는 사신(四神)."),
            new Pet("pt_baekho", "백호", 5, "might", 13, "서방을 지키는 흰 범."),
            new Pet("pt_jujak", "주작", 5, "wisdom", 13, "남방을 지키는 붉은 새."),
            new Pet("pt_hyeonmu", "현무", 5, "command", 13, "북방을 지키는 거북과 뱀."),
            new Pet("pt_gumiho", "구미호", 4, "wisdom", 9, "꼬리 아홉의 여우. 사람 말을 알아듣는다."),
            new Pet("pt_dokkaebi", "도깨비", 4, "might", 9, "방망이 하나로 뭐든 만들어낸다."),
            new Pet("pt_bulgasari", "불가사리", 4, "command", 9, "쇠를 먹고 자라는 짐승."),
            new Pet("pt_jeoktoma", "홍염마", 5, "might", 11, "하루에 천 리를 달린다는 전설의 명마."),
            new Pet("pt_jeolyeong", "섬영마", 4, "command", 8, "위기에 빠진 주인을 태우고 홀로 달아났다는 준마."),
        };

        public static Pet? Find(string id) { foreach (var p in Pets) if (p.Id == id) return p; return null; }

        public readonly struct Tier
        {
            public readonly string Id, NameKo;
            public readonly float Need;
            public readonly string[] Pool;
            public Tier(string id, string nameKo, float need, params string[] pool) { Id = id; NameKo = nameKo; Need = need; Pool = pool; }
            public string Name => GoLocalization.T("egg.tier." + Id, NameKo);
        }

        /// <summary>알 종류 — Need = 부화까지 걸을 거리(m). 마을~고원 왕복이 대략 1km.</summary>
        public static readonly Tier[] Tiers =
        {
            new Tier("e_small", "작은 알", 300f, "pt_gumiho", "pt_dokkaebi", "pt_bulgasari", "pt_jeolyeong"),
            new Tier("e_mid", "큰 알", 800f, "pt_gumiho", "pt_dokkaebi", "pt_bulgasari", "pt_jeolyeong", "pt_jeoktoma", "pt_samjogo", "pt_haetae"),
            new Tier("e_rare", "빛나는 알", 1500f, "pt_jeoktoma", "pt_samjogo", "pt_haetae", "pt_cheongryong", "pt_baekho", "pt_jujak", "pt_hyeonmu"),
        };

        public static Tier? TierOf(string id) { foreach (var t in Tiers) if (t.Id == id) return t; return null; }

        public const int BagMax = 9;
        /// <summary>부화기 칸이 열리는 레벨(여정 등급).</summary>
        public static readonly int[] SlotRank = { 1, 4, 8 };
        public const float StepCapM = 3f, BuddyM = 400f, BuddyLevelM = 500f;
        public const int BuddyGold = 800, DupGold = 1500, DupExp = 30, BuddyMaxLevel = 10;

        /// <summary>알이 나오는 곳 — (확률, 알 종류). 굴림은 (곳, 열쇠) 해시라 같은 상자·같은 일과는 늘 같다.</summary>
        public static readonly Dictionary<string, (float chance, string tier)[]> Sources = new Dictionary<string, (float, string)[]>
        {
            ["chest:common"] = new[] { (0.12f, "e_small") },
            ["chest:exquisite"] = new[] { (0.25f, "e_small") },
            ["chest:precious"] = new[] { (0.5f, "e_mid") },
            ["chest:luxurious"] = new[] { (1.0f, "e_mid"), (0.3f, "e_rare") },
            ["commission"] = new[] { (1.0f, "e_small") },
            ["domain"] = new[] { (0.6f, "e_mid") },
            ["weekly"] = new[] { (1.0f, "e_rare") },
            ["bloom"] = new[] { (0.5f, "e_mid") },
            ["weekly_goal"] = new[] { (1.0f, "e_rare") },
        };

        public static int SlotsForRank(int rank) { int n = 0; foreach (int r in SlotRank) if (rank >= r) n++; return n; }

        /// <summary>안정 해시(저장 전후·PC 가 같다).</summary>
        public static int Hash(string s) { unchecked { int h = 17; foreach (char c in s) h = h * 31 + c; return h & 0x7fffffff; } }

        /// <summary>곳에서 나온 알 종류들(비었으면 빈 배열) — 굴림만, 주머니에 넣는 건 <see cref="EggState.Drop"/>.</summary>
        public static string[] Roll(string source, string key)
        {
            var list = new List<string>();
            if (Sources.TryGetValue(source, out var rows))
                for (int i = 0; i < rows.Length; i++)
                    if ((Hash($"{source}|{key}|{i}") % 1000) / 1000f < rows[i].chance) list.Add(rows[i].tier);
            return list.ToArray();
        }

        /// <summary>동행 몸 GLB 이름(`Resources/World/<이름>`) — 에셋은 K-0075 몫, 없으면 몸 없이 간다.</summary>
        public static string BodyName(string petId) => "pet_" + petId;

        public static string BonusLabel(Pet p)
        {
            string what = p.Kind == "atk" ? GoLocalization.T("egg.stat.atk", "공격력") : p.Kind == "exp" ? GoLocalization.T("egg.stat.exp", "경험치") : GoLocalization.T("egg.stat.def", "방어력");
            return string.Format(GoLocalization.T("egg.bonus", "{0} 최대 +{1}%"), what, p.Value);
        }
    }

    [Serializable]
    public class EggIncSave { public string tier; public float walked; }

    /// <summary>신수 알·동행 상태 — 세이브 필드 `eggBag` 외 일곱(`SaveState`, 버전 그대로, 옛 세이브는 빈 상태).</summary>
    public static class EggState
    {
        public struct Inc { public string Tier; public float Walked; }
        public struct Hatch { public string Tier, Pet; public bool Dup; }

        private static readonly List<string> _bag = new List<string>();
        private static readonly List<Inc> _inc = new List<Inc>();
        private static readonly Dictionary<string, float> _friend = new Dictionary<string, float>();
        private static readonly HashSet<string> _owned = new HashSet<string>();

        public static int Hatched { get; private set; }
        public static float WalkTotal { get; private set; }
        public static string Buddy { get; private set; } = "";
        private static float _buddyM;

        public static event Action Changed;

        public static int BagCount => _bag.Count;
        public static string BagAt(int i) => _bag[i];
        public static int IncCount => _inc.Count;
        public static Inc IncAt(int i) => _inc[i];
        public static int Slots => GoEggs.SlotsForRank(PlayerStats.Level);
        public static bool Owns(string petId) => _owned.Contains(petId);
        public static int OwnedCount { get { int n = 0; foreach (var p in GoEggs.Pets) if (_owned.Contains(p.Id)) n++; return n; } }

        /// <summary>도감에 올린다 — 처음이면 true.</summary>
        public static bool Discover(string petId) { bool added = _owned.Add(petId); if (added) Changed?.Invoke(); return added; }

        // ---- 알 ----

        /// <summary>곳에서 알이 나왔는지 굴려 주머니에 넣는다 — 알림 글(없으면 빈 글).</summary>
        public static string Drop(string source, string key)
        {
            var parts = new List<string>();
            foreach (var t in GoEggs.Roll(source, key))
            {
                var tier = GoEggs.TierOf(t).Value;
                if (_bag.Count >= GoEggs.BagMax) { parts.Add(GoLocalization.T("egg.lost", "알 주머니가 가득 차 알을 놓쳤다")); continue; }
                _bag.Add(t);
                parts.Add(string.Format(GoLocalization.T("egg.got", "{0}을 얻었다 (I)"), tier.Name));
            }
            if (parts.Count > 0) Changed?.Invoke();
            return string.Join(" · ", parts);
        }

        public static bool AddEgg(string tierId)
        {
            if (_bag.Count >= GoEggs.BagMax || GoEggs.TierOf(tierId) == null) return false;
            _bag.Add(tierId); Changed?.Invoke(); return true;
        }

        /// <summary>주머니 번 알을 부화기에 넣는다 — 오류 글(없으면 빈 글).</summary>
        public static string Start(int bagIndex)
        {
            if (bagIndex < 0 || bagIndex >= _bag.Count) return GoLocalization.T("egg.why.none", "그 알이 없다");
            if (_inc.Count >= Slots) return GoLocalization.T("egg.why.slots", "부화기 칸이 모자라다 (레벨로 열린다)");
            _inc.Add(new Inc { Tier = _bag[bagIndex], Walked = 0f });
            _bag.RemoveAt(bagIndex);
            Changed?.Invoke();
            return "";
        }

        /// <summary>부화기 칸의 알을 주머니로 되돌린다(걸음은 잃는다).</summary>
        public static string Stop(int idx)
        {
            if (idx < 0 || idx >= _inc.Count) return GoLocalization.T("egg.why.empty", "그 칸이 비었다");
            if (_bag.Count >= GoEggs.BagMax) return GoLocalization.T("egg.why.bag_full", "주머니가 가득 찼다");
            _bag.Add(_inc[idx].Tier);
            _inc.RemoveAt(idx);
            Changed?.Invoke();
            return "";
        }

        /// <summary>알 하나가 무엇으로 부화할지 — 안 가진 신수 우선, 굴림은 (알 종류, 지금까지 부화 수)로 정해 저장 전후가 같다.</summary>
        public static string PickPet(string tierId, int hatched)
        {
            var tier = GoEggs.TierOf(tierId);
            if (tier == null || tier.Value.Pool.Length == 0) return "";
            var fresh = new List<string>();
            foreach (var id in tier.Value.Pool) if (!_owned.Contains(id)) fresh.Add(id);
            var from = fresh.Count > 0 ? fresh.ToArray() : tier.Value.Pool;
            return from[GoEggs.Hash($"{tierId}|{hatched}") % from.Length];
        }

        // ---- 걸음 ----

        /// <summary>걸은 거리를 부화기에 준다 — 부화한 것들. 신수는 도감에 오르고 겹치면 금·경험치. 동행이 있으면 친밀·금도 쌓인다.</summary>
        public static List<Hatch> Walk(float meters)
        {
            var result = new List<Hatch>();
            if (meters <= 0f) return result;
            WalkTotal += meters;
            var keep = new List<Inc>(); var done = new List<Inc>();
            foreach (var e in _inc)
            {
                var n = new Inc { Tier = e.Tier, Walked = e.Walked + meters };
                if (n.Walked >= GoEggs.TierOf(n.Tier).Value.Need) done.Add(n); else keep.Add(n);
            }
            _inc.Clear(); _inc.AddRange(keep);
            foreach (var e in done)
            {
                string pet = PickPet(e.Tier, Hatched);
                Hatched++;
                bool dup = !_owned.Add(pet);
                if (dup) { GoldState.Add(GoEggs.DupGold); PlayerStats.AddExp(GoEggs.DupExp); }
                result.Add(new Hatch { Tier = e.Tier, Pet = pet, Dup = dup });
            }
            if (Buddy.Length > 0)
            {
                _friend.TryGetValue(Buddy, out float f);
                _friend[Buddy] = f + meters;
                _buddyM += meters;
                while (_buddyM >= GoEggs.BuddyM) { _buddyM -= GoEggs.BuddyM; GoldState.Add(GoEggs.BuddyGold); }
            }
            Changed?.Invoke();
            return result;
        }

        // ---- 동행 ----

        /// <summary>동행을 고른다("" = 내보냄) — 오류 글(없으면 빈 글).</summary>
        public static string SetBuddy(string petId)
        {
            if (petId.Length > 0 && !_owned.Contains(petId)) return GoLocalization.T("egg.why.unmet", "아직 만나지 못한 신수다");
            Buddy = petId; _buddyM = 0f;
            Changed?.Invoke();
            return "";
        }

        public static int BuddyLevelOf(string petId) => petId.Length == 0 ? 0 : Mathf.Min(GoEggs.BuddyMaxLevel, (int)(Friend(petId) / GoEggs.BuddyLevelM));
        public static int BuddyLevel => BuddyLevelOf(Buddy);
        public static float Friend(string petId) => _friend.TryGetValue(petId, out float f) ? f : 0f;

        /// <summary>kind: "atk" | "exp" | "def" — 동행 신수가 그 갈래를 주면 비율(0.05 = +5%), 아니면 0.</summary>
        public static float BuddyBonus(string kind)
        {
            if (Buddy.Length == 0) return 0f;
            var p = GoEggs.Find(Buddy);
            if (p == null || p.Value.Kind != kind) return 0f;
            return p.Value.Value * BuddyLevel / 10f / 100f;
        }

        // ---- 세이브 ----

        public static List<string> SnapshotBag() => new List<string>(_bag);
        public static List<EggIncSave> SnapshotInc() { var l = new List<EggIncSave>(); foreach (var e in _inc) l.Add(new EggIncSave { tier = e.Tier, walked = e.Walked }); return l; }
        public static float SnapshotBuddyM() => _buddyM;
        public static List<string> SnapshotOwned() { var l = new List<string>(_owned); l.Sort(string.CompareOrdinal); return l; }
        public static List<CookState.Entry> SnapshotFriend()
        {
            var l = new List<CookState.Entry>();
            foreach (var kv in _friend) l.Add(new CookState.Entry { id = kv.Key, n = Mathf.RoundToInt(kv.Value) });
            l.Sort((a, b) => string.CompareOrdinal(a.id, b.id));
            return l;
        }

        /// <summary>불러오기·새 게임·진단 — 없으면(옛 세이브) 빈 상태. 모르는 알·신수는 버리고 칸·주머니 수를 넘지 않게 자른다.</summary>
        public static void Restore(List<string> bag, List<EggIncSave> inc, int hatched, float walk, string buddy, float buddyM, List<CookState.Entry> friend, List<string> owned)
        {
            _bag.Clear(); _inc.Clear(); _friend.Clear(); _owned.Clear();
            Hatched = Mathf.Max(0, hatched); WalkTotal = Mathf.Max(0f, walk); _buddyM = Mathf.Max(0f, buddyM); Buddy = "";
            if (owned != null) foreach (var id in owned) if (GoEggs.Find(id) != null) _owned.Add(id);
            if (bag != null) foreach (var t in bag) if (GoEggs.TierOf(t) != null && _bag.Count < GoEggs.BagMax) _bag.Add(t);
            if (inc != null) foreach (var e in inc) if (e != null && GoEggs.TierOf(e.tier) != null && _inc.Count < GoEggs.SlotRank.Length) _inc.Add(new Inc { Tier = e.tier, Walked = Mathf.Max(0f, e.walked) });
            if (friend != null) foreach (var e in friend) if (GoEggs.Find(e.id) != null && e.n > 0) _friend[e.id] = e.n;
            if (!string.IsNullOrEmpty(buddy) && _owned.Contains(buddy)) Buddy = buddy;
            Changed?.Invoke();
        }

        public static void ResetForTest() => Restore(null, null, 0, 0f, "", 0f, null, null);
    }
}
