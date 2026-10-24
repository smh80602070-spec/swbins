using System;
using System.Collections.Generic;
using UnityEngine;

namespace Saga.Story.Data
{
    /// <summary>
    /// tasks U-0222 괴물 카드 도감(고돗 G-0374 `data/story_monster_book.gd` 이식 — 메이플스토리 몬스터 컬렉션).
    /// 적을 쓰러뜨리면 그 종 카드 한 장 — 잡몹 5% · 관문 대장 50% · 숨은 우두머리·두목 확정. 종마다 다섯 장 = 다 모음(알림 한 번, 여섯째는 안 나옴),
    /// 다 모은 종 하나마다 공격 ×(1 + 0.2%)(`StoryPartyState.AtkMultiplier` 가 곱한다). 종 = 이 판에 있는 것만 <see cref="Species"/> 열일곱:
    /// 과거 잡몹 "황건적" · 세 시대 적 표 여덟(`StoryEras.Foes`, id = NameKey) · 두목 = 고유 기술 주인(들판 황건 두목·비경 관문 수호장·주마다 바뀌는 관문 대장 다섯) · 숨은 우두머리.
    /// 굴림은 제 System.Random — 전역 `UnityEngine.Random` 흐름(전투 진단 재현)은 안 건드린다. 세이브 `cardsJson`(버전 그대로, null = 0).
    /// 손잡이 `SAGA_MONSTER_BOOK=0` 이면 안 셈·곱 1. 카드 그림 없음(글 줄만).
    /// </summary>
    public static class StoryMonsterBook
    {
        public const float GruntChance = 0.05f, ChampionChance = 0.5f, BossChance = 1f;
        public const int Set = 5;
        public const float AtkPer = 0.002f;
        public const string Grunt = "hwanggeon", Hidden = "hidden";

        private static bool _on = true;
        /// <summary>끄면 안 셈·곱 1(진단 손잡이 · 환경 `SAGA_MONSTER_BOOK=0`).</summary>
        public static bool On
        {
            get => _on && Environment.GetEnvironmentVariable("SAGA_MONSTER_BOOK") != "0";
            set => _on = value;
        }

        /// <summary>도감 종 — 잡몹 · 세 시대 여덟 · 두목(고유 기술 주인) · 숨은 우두머리.</summary>
        public static readonly string[] Species = BuildSpecies();

        private static string[] BuildSpecies()
        {
            var l = new List<string> { Grunt };
            for (int t = 0; t < StoryEras.Foes.GetLength(0); t++)
                for (int e = 0; e < StoryEras.Foes.GetLength(1); e++)
                    if (!l.Contains(StoryEras.Foes[t, e].NameKey)) l.Add(StoryEras.Foes[t, e].NameKey);
            foreach (var id in new[] { "hwanggeon_chief", "gate_guardian" }) if (!l.Contains(id)) l.Add(id);
            foreach (var id in StoryBossPattern.GateCaptains) if (!l.Contains(id)) l.Add(id);
            l.Add(Hidden);
            return l.ToArray();
        }

        /// <summary>적 → 종(순수). 모르는 종이면 빈 글(카드 없음).</summary>
        public static string SpeciesOf(bool hidden, bool boss, string sigId, StoryEra era, string eraKey)
        {
            string k = hidden ? Hidden : boss ? sigId : era == StoryEra.Past ? Grunt : eraKey;
            return !string.IsNullOrEmpty(k) && Array.IndexOf(Species, k) >= 0 ? k : "";
        }

        /// <summary>한 장 나올 확률 — 숨은 우두머리 확정 · 관문 대장 50% · 두목 확정 · 잡몹 5%.</summary>
        public static float Chance(bool hidden, bool boss, bool champion) => hidden ? BossChance : champion ? ChampionChance : boss ? BossChance : GruntChance;

        public static string Name(string sp)
        {
            if (sp == Grunt) return StoryLocalization.T("enemy.hwanggeon", "황건적");
            if (sp == Hidden) return StoryLocalization.T("hidden.name", "숨은 우두머리");
            int si = StoryBossPattern.SigIndex(sp);
            if (si >= 0) return StoryBossPattern.SigBoss(si);
            for (int t = 0; t < StoryEras.Foes.GetLength(0); t++)
                for (int e = 0; e < StoryEras.Foes.GetLength(1); e++)
                    if (StoryEras.Foes[t, e].NameKey == sp) return StoryEras.FoeName(StoryEras.Foes[t, e]);
            return sp;
        }

        [Serializable] private class Row { public string id; public int n; }
        [Serializable] private class Store { public List<Row> rows = new List<Row>(); }
        private static Store _s = new Store();
        private static System.Random _rng = new System.Random();

        /// <summary>진단 — 굴림 씨앗 고정.</summary>
        public static void SeedForTest(int seed) => _rng = new System.Random(seed);

        public static int Count(string sp)
        {
            foreach (var r in _s.rows) if (r.id == sp) return r.n;
            return 0;
        }

        public static int CompleteCount() { int n = 0; foreach (var sp in Species) if (Count(sp) >= Set) n++; return n; }
        public static int FoundCount() { int n = 0; foreach (var sp in Species) if (Count(sp) > 0) n++; return n; }

        public static float AtkMul => On ? 1f + AtkPer * CompleteCount() : 1f;

        public readonly struct Card
        {
            public readonly string Species; public readonly int N; public readonly bool SetDone;
            public Card(string sp, int n, bool done) { Species = sp; N = n; SetDone = done; }
        }

        /// <summary>한 마리 — 카드가 나오면 그 카드, 안 나오면 null. 다 모은 종은 더 안 나온다. 끄면·모르는 종이면 굴리지도 않는다.</summary>
        public static Card? OnKill(string sp, float chance)
        {
            if (!On || string.IsNullOrEmpty(sp) || Array.IndexOf(Species, sp) < 0 || Count(sp) >= Set) return null;
            if (_rng.NextDouble() >= chance) return null;
            Row row = null;
            foreach (var r in _s.rows) if (r.id == sp) { row = r; break; }
            if (row == null) { row = new Row { id = sp }; _s.rows.Add(row); }
            row.n++;
            return new Card(sp, row.n, row.n >= Set);
        }

        /// <summary>알림 글 — 다섯째면 "다 모음".</summary>
        public static string ToastText(Card c) => c.SetDone
            ? string.Format(StoryLocalization.T("book.set", "🃏 {0} 카드 다 모음! 공격 +{1:0.0}%"), Name(c.Species), AtkPer * 100f)
            : string.Format(StoryLocalization.T("book.card", "🃏 {0} 카드 {1}/{2}"), Name(c.Species), c.N, Set);

        /// <summary>「오늘」 둘째 묶음 줄 — "카드 도감 n/종 수 · 다 모음 m".</summary>
        public static string Line() => string.Format(StoryLocalization.T("book.line", "🃏 카드 도감 {0}/{1} · 다 모음 {2}"), FoundCount(), Species.Length, CompleteCount());

        // ---- 세이브 ----

        public static string Snapshot() => JsonUtility.ToJson(_s);

        public static void Restore(string json)
        {
            Store s = null;
            if (!string.IsNullOrEmpty(json)) { try { s = JsonUtility.FromJson<Store>(json); } catch (ArgumentException) { s = null; } }
            _s = s ?? new Store();
            var keep = new List<Row>();
            foreach (var r in _s.rows ?? new List<Row>())
                if (r != null && Array.IndexOf(Species, r.id) >= 0 && r.n > 0) { r.n = Mathf.Min(r.n, Set); keep.Add(r); }
            _s.rows = keep;
        }

        public static void ResetForTest() => Restore(null);
    }
}
