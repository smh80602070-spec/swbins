using System;
using System.Collections.Generic;
using UnityEngine;

namespace Saga.Forest.Data
{
    /// <summary>
    /// tasks U-0177 유적 발굴·복원 — 웹 사가마을 W-0309 `relics.js` · 고돗 G-0315 `forest_relics.gd` 짝(코랄 아일랜드 유물 복원 — 구조만).
    /// 바위 지대 화석 채집 자리(`ForestCollectSpot` 화석 갈래)를 하루 첫 번 캘 때 <see cref="Chance"/> 로 유적 조각(옛 그릇·옛 비석·옛 망와, 각 <see cref="Pieces"/>조각)이
    /// 나온다(날로 결정적). 넷이 모이면 그 자리에서 복원돼 화석 자리 곁에 전시대가 서고 열매 +<see cref="RestoreFruit"/>, 셋 다 되살리면 옛터 잔치 열매 +<see cref="FeastFruit"/> 한 번.
    ///
    /// **이 트랙 다름**: 사고 건물·창이 없어(`ForestMuseumState` 머리말 — 채집 = 기증) 복원은 넷째 조각에서 저절로. 화폐는 열매뿐이라 웹 명성 +150/+300
    /// (고돗 금 +300/+600)을 웹 능금 40벨 = 열매 1(U-0173 과 같은 셈)로 열매 +8/+15. 화석 자리는 2초마다 다시 캘 수 있어 굴림은 하루 한 번(고돗 "한 자리·하루 한 번" 과 같은 0.5).
    /// 손잡이 <see cref="On"/>.
    /// </summary>
    public static class ForestRelics
    {
        public const int Pieces = 4, RestoreFruit = 8, FeastFruit = 15;
        public const float Chance = 0.5f;
        public static bool On = true;

        public class Set
        {
            public string Key, Ko, Emoji;
            public string Name => ForestLocalization.T("relic.set." + Key, Ko);
        }

        public static readonly Set[] Sets =
        {
            new Set { Key = "bowl", Ko = "옛 그릇", Emoji = "🏺" },
            new Set { Key = "stele", Ko = "옛 비석", Emoji = "🪦" },
            new Set { Key = "tile", Ko = "옛 망와", Emoji = "🏯" },
        };

        [Serializable]
        private class Store
        {
            public List<string> gotKeys = new List<string>();
            public List<int> gotN = new List<int>();
            public List<string> restored = new List<string>();
            public bool feast;
            public int rolled = int.MinValue;
        }

        private static Store _s = new Store();
        public static event Action Changed;

        public static Set Find(string key) => Array.Find(Sets, s => s.Key == key);
        public static int Got(string key) { int i = _s.gotKeys.IndexOf(key); return i < 0 ? 0 : _s.gotN[i]; }
        public static bool IsRestored(string key) => _s.restored.Contains(key);
        public static IReadOnlyList<string> Restored => _s.restored;
        public static bool Feasted => _s.feast;

        /// <summary>그날 조각이 나오나(순수) — 나오면 아직 다 안 모은 갈래 중 하나, 아니면 null.</summary>
        public static string RollPiece(int day)
        {
            var open = new List<Set>();
            foreach (var s in Sets) if (!IsRestored(s.Key) && Got(s.Key) < Pieces) open.Add(s);
            if (open.Count == 0) return null;
            if (H01(day, 77) >= Chance) return null;
            return open[Mathf.Min(open.Count - 1, (int)(H01(day, 78) * open.Count))].Key;
        }

        /// <summary>채집 한 번(`ForestCollectSpot`) — 화석 갈래·그날 첫 번만 굴린다. 알림 글(없으면 null).</summary>
        public static string OnGather(ForestMuseumState.Category c, int today)
        {
            if (!On || c != ForestMuseumState.Category.Fossil || _s.rolled == today) return null;
            _s.rolled = today;
            string key = RollPiece(today);
            if (key == null) { Touch(); return null; }
            var S = Find(key);
            int n = AddPiece(key);
            string line = string.Format(ForestLocalization.T("relic.piece", "{0} 유적 조각 — {1} {2}/{3}"), S.Emoji, S.Name, n, Pieces);
            if (n >= Pieces)
            {
                string r = RestoreSet(key);
                if (r != null) line += "\n" + r;
            }
            Touch();
            return line;
        }

        private static int AddPiece(string key)
        {
            int i = _s.gotKeys.IndexOf(key);
            if (i < 0) { _s.gotKeys.Add(key); _s.gotN.Add(0); i = _s.gotKeys.Count - 1; }
            _s.gotN[i] = Mathf.Min(Pieces, _s.gotN[i] + 1);
            return _s.gotN[i];
        }

        /// <summary>넷 모인 갈래를 되살린다 — 열매·(셋째면) 잔치. 알림 글, 안 되면 null.</summary>
        public static string RestoreSet(string key)
        {
            var S = Find(key);
            if (!On || S == null || IsRestored(key) || Got(key) < Pieces) return null;
            _s.restored.Add(key);
            ForestState.AddFruit(RestoreFruit);
            string line = string.Format(ForestLocalization.T("relic.restored", "{0} {1} 복원! 화석 자리 곁에 전시대가 섰다 — 열매 +{2}"), S.Emoji, S.Name, RestoreFruit);
            if (!_s.feast && _s.restored.Count >= Sets.Length)
            {
                _s.feast = true;
                ForestState.AddFruit(FeastFruit);
                line += "\n" + string.Format(ForestLocalization.T("relic.feast", "🎉 옛터 잔치 — 유적 셋을 모두 되살렸다! 열매 +{0}"), FeastFruit);
            }
            Touch();
            return line;
        }

        private static float H01(int day, int salt)
        {
            unchecked
            {
                uint h = (uint)day * 2654435761u ^ (uint)salt * 40503u;
                h ^= h >> 15; h *= 2246822519u; h ^= h >> 13; h *= 3266489917u; h ^= h >> 16;
                return (h & 0xFFFFFF) / 16777216f;
            }
        }

        // ---- 저장(버전 그대로 — 옛 세이브는 null → 빈 것)

        public static string Snapshot() => JsonUtility.ToJson(_s);

        public static void Restore(string json)
        {
            Store s = null;
            if (!string.IsNullOrEmpty(json)) { try { s = JsonUtility.FromJson<Store>(json); } catch (ArgumentException) { s = null; } }
            _s = s ?? new Store();
            if (_s.gotKeys == null || _s.gotN == null || _s.gotKeys.Count != _s.gotN.Count) { _s.gotKeys = new List<string>(); _s.gotN = new List<int>(); }
            for (int i = _s.gotKeys.Count - 1; i >= 0; i--)
                if (Find(_s.gotKeys[i]) == null) { _s.gotKeys.RemoveAt(i); _s.gotN.RemoveAt(i); }
                else _s.gotN[i] = Mathf.Clamp(_s.gotN[i], 0, Pieces);
            if (_s.restored == null) _s.restored = new List<string>();
            _s.restored.RemoveAll(k => Find(k) == null);
            Touch();
        }

        public static void ResetForTest() => Restore(null);

        private static void Touch() => Changed?.Invoke();
    }
}
