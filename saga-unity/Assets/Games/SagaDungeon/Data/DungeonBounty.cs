using System;
using System.Collections.Generic;

namespace Saga.Dungeon.Data
{
    /// <summary>
    /// tasks U-0221 현상금(고돗 G-0372 `data/dungeon_bounty.gd` 이식 — 디아블로 3·4 처럼 판마다 걸린 의뢰를 같이 쫓는다).
    /// 판 = `DungeonRunRank` 와 같은 고리(한 층 — 첫 타격에 열고 계단으로 내려가면 살아 나옴·쓰러지면 덤 없음·건너뛰면 버림). 판이 열릴 때 다섯 중 셋을 건다
    /// (층 씨앗 <see cref="SeedOf"/> 로 고름 — 같은 층이면 같은 셋): 정예 2 · 처치 20 · 통 깨기 6(판 도중 셈) / 5번 넘게 안 맞기 · 6분 안(판 끝에서 등급 결과로 판정).
    /// 살아 나오면 채운 수 × 150 × 급 금 덤 — 급 = 난도(평 1·험 2·절 3) + 부적 층 1(고돗 "난도·부적"). 저장 없음(층 안에서만 — 불러오면 새 판).
    /// 판이 열리기 전에도 「오늘」 창 맨 위엔 이 층에 걸릴 셋을 미리 보인다. 손잡이 `SAGA_BOUNTY=0` 이면 안 건다.
    /// </summary>
    public static class DungeonBounty
    {
        public enum Id { Elite, Kills, Props, NoHit, Fast }

        private sealed class Def
        {
            public Id Id; public string Key, Ko; public int N; public bool Live;
        }

        private static readonly Def[] Pool =
        {
            new Def { Id = Id.Elite, Key = "elite", Ko = "정예 {0} 쓰러뜨리기", N = 2, Live = true },
            new Def { Id = Id.Kills, Key = "kills", Ko = "적 {0} 쓰러뜨리기", N = 20, Live = true },
            new Def { Id = Id.Props, Key = "props", Ko = "통·항아리 {0} 부수기", N = 6, Live = true },
            new Def { Id = Id.NoHit, Key = "nohit", Ko = "{0}번 넘게 맞지 않고 깨기", N = 5, Live = false },
            new Def { Id = Id.Fast, Key = "fast", Ko = "{0}분 안에 깨기", N = 360, Live = false },
        };

        public const int PickCount = 3, GoldPer = 150;

        /// <summary>끄면 안 건다(고돗 `SAGA_BOUNTY=0` 짝).</summary>
        public static bool On = Environment.GetEnvironmentVariable("SAGA_BOUNTY") != "0";

        public sealed class Row
        {
            public Id Id; public int N, Cur; public bool Live, Done;
        }

        public readonly struct Result
        {
            public readonly int Done, Of, Gold, Grade; public readonly bool Dead;
            public Result(int done, int of, int gold, int grade, bool dead) { Done = done; Of = of; Gold = gold; Grade = grade; Dead = dead; }
        }

        private static readonly List<Row> _active = new List<Row>();
        public static IReadOnlyList<Row> Active => _active;
        public static int Grade { get; private set; } = 1;
        public static int Floor { get; private set; }
        public static Result? Last { get; private set; }

        public static int SeedOf(int floor) => floor * 131 + 17;

        /// <summary>급 = 난도(평 1·험 2·절 3) + 부적 층 1.</summary>
        public static int GradeOf(int floor) => Math.Max(1, Array.IndexOf(DungeonMode.All, DungeonMode.Current) + 1) + (SigilState.IsSigilFloor(floor) ? 1 : 0);

        /// <summary>씨앗으로 셋을 고른다 — 다섯을 섞어 앞 셋, 표 순서대로(순수).</summary>
        public static List<Row> Pick(int seed)
        {
            var rng = new Random(seed);
            var ids = new List<Id>();
            foreach (var d in Pool) ids.Add(d.Id);
            for (int i = ids.Count - 1; i > 0; i--) { int j = rng.Next(i + 1); (ids[i], ids[j]) = (ids[j], ids[i]); }
            var take = ids.GetRange(0, PickCount);
            var out_ = new List<Row>();
            foreach (var d in Pool) if (take.Contains(d.Id)) out_.Add(new Row { Id = d.Id, N = d.N, Live = d.Live });
            return out_;
        }

        private static Def DefOf(Id id) { foreach (var d in Pool) if (d.Id == id) return d; return Pool[0]; }

        public static string Name(Id id)
        {
            var d = DefOf(id);
            return string.Format(DungeonLocalization.T("bounty." + d.Key, d.Ko), d.Id == Id.Fast ? d.N / 60 : d.N);
        }

        /// <summary>판이 열렸다 — 셋을 건다. 건 글(끄면 빈 글).</summary>
        public static string Begin(int floor)
        {
            _active.Clear();
            Floor = floor;
            Grade = GradeOf(floor);
            if (!On) return "";
            _active.AddRange(Pick(SeedOf(floor)));
            return BeginText();
        }

        public static void Cancel() => _active.Clear();

        private static string Bump(Id id)
        {
            foreach (var b in _active)
            {
                if (b.Id != id || b.Done || !b.Live) continue;
                b.Cur++;
                if (b.Cur >= b.N) { b.Done = true; return Name(id); }
            }
            return "";
        }

        /// <summary>적 하나(정예면 정예 셈도) — 이번에 채운 현상금 이름들.</summary>
        public static List<string> Kill(bool elite)
        {
            var out_ = new List<string>();
            string a = Bump(Id.Kills); if (a.Length > 0) out_.Add(a);
            if (elite) { string b = Bump(Id.Elite); if (b.Length > 0) out_.Add(b); }
            return out_;
        }

        public static string Prop() => Bump(Id.Props);

        /// <summary>판 끝 — 맞은 수·걸린 초로 끝 판정 둘을 매기고, 살아 나왔으면 덤 금을 준다. 건 게 없으면 null.</summary>
        public static Result? Finish(bool dead, int hits, float sec)
        {
            if (_active.Count == 0) return null;
            foreach (var b in _active)
            {
                if (b.Live) continue;
                b.Cur = b.Id == Id.NoHit ? hits : (int)Math.Round(sec);
                b.Done = !dead && b.Cur <= b.N;
            }
            int got = 0;
            foreach (var b in _active) if (b.Done) got++;
            int gold = dead ? 0 : got * GoldPer * Grade;
            if (gold > 0) HeroState.AddGold(gold);
            var r = new Result(got, _active.Count, gold, Grade, dead);
            _active.Clear();
            Last = r;
            return r;
        }

        public static string Text(Result r) => r.Gold > 0
            ? string.Format(DungeonLocalization.T("bounty.result", "📜 현상금 {0}/{1} — 금 +{2}"), r.Done, r.Of, r.Gold)
            : string.Format(DungeonLocalization.T("bounty.result_none", "📜 현상금 {0}/{1} — 덤 없음"), r.Done, r.Of);

        public static string BeginText()
        {
            if (_active.Count == 0) return "";
            var names = new List<string>();
            foreach (var b in _active) names.Add(Name(b.Id));
            return string.Format(DungeonLocalization.T("bounty.begin", "📜 이번 판 현상금 — {0}"), string.Join(" · ", names));
        }

        public static string FilledText(string name) => string.Format(DungeonLocalization.T("bounty.filled", "📜 현상금 채움 — {0}"), name);

        /// <summary>「오늘」 창 줄 — 판이 열렸으면 지금 셋, 아니면 이 층에 걸릴 셋(끝 판정 둘은 "마지막에"). 끄면 빈 목록.</summary>
        public static List<(string text, bool done)> Rows(int floor)
        {
            var l = new List<(string, bool)>();
            if (!On) return l;
            var rows = _active.Count > 0 ? (IReadOnlyList<Row>)_active : Pick(SeedOf(floor));
            foreach (var b in rows)
            {
                string t = b.Live
                    ? string.Format(DungeonLocalization.T("bounty.row", "📜 {0} {1}/{2}"), Name(b.Id), Math.Min(b.Cur, b.N), b.N)
                    : string.Format(DungeonLocalization.T("bounty.row_end", "📜 {0} (층을 깰 때)"), Name(b.Id));
                l.Add((t, b.Done));
            }
            return l;
        }

        /// <summary>진단 — 다섯을 다 건다(급은 그 층 그대로).</summary>
        public static void BeginAllForTest(int floor)
        {
            _active.Clear(); Floor = floor; Grade = GradeOf(floor);
            foreach (var d in Pool) _active.Add(new Row { Id = d.Id, N = d.N, Live = d.Live });
        }

        /// <summary>진단 — 판 상태를 비운다.</summary>
        public static void ClearForTest() { _active.Clear(); Last = null; }
    }
}
