using System;
using System.Collections.Generic;
using UnityEngine;

namespace Saga.Forest.Data
{
    /// <summary>
    /// tasks U-0223 밭 작물(스타듀 밸리 결 · 참고작 격차 유니티 3마을 칸) — 제작대 창 「🌾 밭」으로 집 옆 **작은 밭 네 칸**을 짓고(열매 <see cref="FieldFruit"/>),
    /// 칸마다 씨(열매 <see cref="SeedFruit"/>)를 뿌려 하루 한 번 물을 주면 다음 아침 한 단계 자란다 — 물 준 날 <see cref="GrowDays"/>번째 아침에 다 자람 →
    /// 거두면 열매 <see cref="HarvestFruit"/>. 물 안 준 날은 안 자란다(시들기 없음 — 느긋한 3마을 결). 비가 오는 동안엔 실행기가 <see cref="RainWater"/> 로
    /// 씨 뿌린 칸에 저절로 물을 준다("물 줄 때 비면 자동" 으로 줄임 — 지난 날의 비는 셈하지 않는다).
    ///
    /// 가축(<see cref="ForestLivestock"/>, U-0173)과 같은 고리: 화폐 = 열매(<see cref="ForestState.AddFruit"/>/<see cref="ForestState.SpendFruit"/>) ·
    /// 날 바뀜은 <see cref="ForestVisitors.Today"/>(실제 날짜) · 처음 본 날은 적기만 · 빠진 날은 몰아 센다(첫 날만 어제 물을 보고, 나머지는 물 안 준 날).
    /// 값 = 밭 8(우리 12 보다 싸게) · 씨 1(먹이와 같음) · 거둠 4(산양젖과 같음 — 사흘 물 = 씨 1 → 4). 양조 재료로는 안 센다(주머니는 채집물만). 손잡이 <see cref="On"/>.
    /// </summary>
    public static class ForestCrops
    {
        public const int Plots = 4, FieldFruit = 8, SeedFruit = 1, HarvestFruit = 4, GrowDays = 3;
        public static bool On = true;

        /// <summary>칸 단계 — 빈 두둑 · 씨(두둑만) · 싹 · 자람 · 다 자람.</summary>
        public enum Stage { Empty, Seed, Sprout, Growing, Ripe }

        [Serializable] public class Plot { public bool sown, watered; public int grown; }
        [Serializable] private class Store { public bool field; public List<Plot> plots = new List<Plot>(); public int rolled = int.MinValue; }

        /// <summary>아침 굴림 결과 — 자란 칸 수·다 자란 칸 수.</summary>
        public class Morning
        {
            public int Grew, Ripened;
            public bool Any => Grew > 0;
        }

        private static Store _s = new Store();
        public static event Action Changed;

        public static bool HasField => _s.field;
        public static Plot PlotAt(int i) => i >= 0 && i < _s.plots.Count ? _s.plots[i] : null;

        public static Stage StageOf(int i)
        {
            var p = PlotAt(i);
            if (p == null || !p.sown) return Stage.Empty;
            if (p.grown >= GrowDays) return Stage.Ripe;
            return p.grown == 2 ? Stage.Growing : p.grown == 1 ? Stage.Sprout : Stage.Seed;
        }

        /// <summary>씨 뿌렸고 아직 안 다 자란 칸 수 / 그 중 오늘 물 받은 수 / 다 자란 수.</summary>
        public static int GrowingCount { get { int n = 0; for (int i = 0; i < _s.plots.Count; i++) { var st = StageOf(i); if (st != Stage.Empty && st != Stage.Ripe) n++; } return n; } }
        public static int WateredCount { get { int n = 0; for (int i = 0; i < _s.plots.Count; i++) { var st = StageOf(i); if (st != Stage.Empty && st != Stage.Ripe && _s.plots[i].watered) n++; } return n; } }
        public static int RipeCount { get { int n = 0; for (int i = 0; i < _s.plots.Count; i++) if (StageOf(i) == Stage.Ripe) n++; return n; } }

        /// <summary>밭 짓기 — 실패면 이유 키(crop.why_*), 되면 null.</summary>
        public static string Build()
        {
            if (!On) return "crop.why_off";
            if (_s.field) return "crop.why_one";
            if (!ForestState.SpendFruit(FieldFruit)) return "crop.why_fruit";
            _s.field = true;
            _s.plots = new List<Plot>();
            for (int i = 0; i < Plots; i++) _s.plots.Add(new Plot());
            Touch();
            return null;
        }

        public static string Sow(int i)
        {
            if (!On) return "crop.why_off";
            if (!_s.field) return "crop.why_no_field";
            var p = PlotAt(i);
            if (p == null) return "crop.why_none";
            if (p.sown) return "crop.why_sown";
            if (!ForestState.SpendFruit(SeedFruit)) return "crop.why_fruit";
            p.sown = true; p.grown = 0; p.watered = false;
            Touch();
            return null;
        }

        public static string Water(int i)
        {
            if (!On) return "crop.why_off";
            var p = PlotAt(i);
            if (p == null) return "crop.why_none";
            if (!p.sown) return "crop.why_bare";
            if (StageOf(i) == Stage.Ripe) return "crop.why_ripe";
            if (p.watered) return "crop.why_watered";
            p.watered = true;
            Touch();
            return null;
        }

        /// <summary>비 — 씨 뿌렸고 아직 물 안 받은 칸에 물. 새로 받은 칸 수.</summary>
        public static int RainWater()
        {
            if (!On || !_s.field) return 0;
            int n = 0;
            for (int i = 0; i < _s.plots.Count; i++)
            {
                var st = StageOf(i);
                if (st == Stage.Empty || st == Stage.Ripe || _s.plots[i].watered) continue;
                _s.plots[i].watered = true;
                n++;
            }
            if (n > 0) Touch();
            return n;
        }

        /// <summary>거두기 — 되면 null(열매 +<see cref="HarvestFruit"/>, 칸은 빈 두둑으로).</summary>
        public static string Harvest(int i)
        {
            if (!On) return "crop.why_off";
            var p = PlotAt(i);
            if (p == null) return "crop.why_none";
            if (StageOf(i) != Stage.Ripe) return "crop.why_unripe";
            p.sown = false; p.grown = 0; p.watered = false;
            ForestState.AddFruit(HarvestFruit);
            Touch();
            return null;
        }

        /// <summary>날이 넘어갔으면 굴린다 — 처음 본 날은 적기만. 빠진 날마다 한 번(첫 날만 어제 물을 보고, 나머지는 물 안 준 날).</summary>
        public static Morning Tick(int today)
        {
            var m = new Morning();
            if (!On) return m;
            if (_s.rolled == int.MinValue) { _s.rolled = today; Touch(); return m; }
            if (today <= _s.rolled) return m;
            int days = Mathf.Min(today - _s.rolled, GrowDays + 1);
            _s.rolled = today;
            for (int d = 0; d < days; d++)
            {
                for (int i = 0; i < _s.plots.Count; i++)
                {
                    var p = _s.plots[i];
                    if (p.sown && p.watered && p.grown < GrowDays)
                    {
                        p.grown++;
                        m.Grew++;
                        if (p.grown >= GrowDays) m.Ripened++;
                    }
                    p.watered = false;
                }
            }
            Touch();
            return m;
        }

        /// <summary>알림 한 줄(없으면 null).</summary>
        public static string Line(Morning m)
        {
            if (m == null || !m.Any) return null;
            string s = string.Format(ForestLocalization.T("crop.morning", "🌱 밭 — 물 준 칸이 밤새 자랐다 ({0})"), m.Grew);
            if (m.Ripened > 0) s += "\n" + string.Format(ForestLocalization.T("crop.ripe_morning", "🌾 다 자란 칸 {0} — 거두자"), m.Ripened);
            return s;
        }

        // ---- 저장 ----

        public static string Snapshot() => JsonUtility.ToJson(_s);

        public static void Restore(string json)
        {
            Store s = null;
            if (!string.IsNullOrEmpty(json)) { try { s = JsonUtility.FromJson<Store>(json); } catch (ArgumentException) { s = null; } }
            _s = s ?? new Store();
            if (_s.plots == null) _s.plots = new List<Plot>();
            _s.plots.RemoveAll(p => p == null);
            if (!_s.field) _s.plots.Clear();
            else while (_s.plots.Count < Plots) _s.plots.Add(new Plot());
            if (_s.plots.Count > Plots) _s.plots.RemoveRange(Plots, _s.plots.Count - Plots);
            foreach (var p in _s.plots) { p.grown = Mathf.Clamp(p.grown, 0, GrowDays); if (!p.sown) { p.grown = 0; p.watered = false; } }
            Touch();
        }

        public static void ResetForTest() => Restore(null);

        private static void Touch() => Changed?.Invoke();
    }
}
