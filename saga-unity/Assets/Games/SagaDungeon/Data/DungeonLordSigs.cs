using System.Collections.Generic;
using UnityEngine;

namespace Saga.Dungeon.Data
{
    /// <summary>
    /// PLAN.md 109-10-9 명소 층 주인 고유 수(웹 사가블로 §5.18 `guard.sig`·`guardZones`) — 여섯 주인이 저마다 다른 한 수.
    /// 이 판 주인은 빌린 몸 하나에 강타 하나라 여섯이 같은 싸움이었다 → 층 키(<see cref="DungeonLandmarkData"/> 와 같은 여섯)마다 수 하나:
    /// tomb 순장 호령(체력 ⅔·⅓ 에 졸개 둘) · fort 망루 화살비(내 자리+양옆 원 셋, 시전마다 방향이 돈다) · bandit 흑풍 삼연돌(내 자리로 세 번) ·
    /// palace 심연 소용돌이(예고 동안 끌어당기고 둘레 폭발, 구르면 안 끌림) · hellgate 업화 장판(터진 자리에 불바닥 6초, 0.5초마다, 넷까지) ·
    /// cloud 천뢰 십자(줄 넷 × 원 다섯, + 와 × 번갈아). 이름·수치는 웹 그대로(이름은 원래 지어낸 것), 거리는 웹 px 을 회전베기 비(24px = 1m)로.
    /// 판정은 주인·나 자리와 시전 횟수로만(무작위 없음). 웹 원소(빙·화·뇌)는 이 판에 원소 피해가 없어 모양·빛깔만. 손잡이 `dungeon.guardSig` = <see cref="Enabled"/>.
    /// </summary>
    public static class DungeonLordSigs
    {
        public enum Kind { Summon, Rain, Hops, Vortex, Pool, Cross }

        public const float PxPerMeter = 24f;
        public const float FirstSec = 3f;
        public const float PoolTickSec = 0.5f;
        /// <summary>웹 P_R 13 — 원에 닿았나 볼 때 내 몸 반지름을 더한다.</summary>
        public const float PlayerRadius = 13f / PxPerMeter;
        /// <summary>소용돌이가 이만큼 가까워지면 더 안 끈다(웹 en.r + P_R + 4 의 주인 몸 몫).</summary>
        public const float VortexStop = 1.2f;

        public struct Sig
        {
            public string Key;        // 명소 층 키
            public Kind Kind;
            public string NameKo, LineKo;
            public float Cd, Warn, R, Mul;
            public int N;             // 화살비 원 수 · 소환 졸개 수
            public float Spread;      // 화살비 원 사이
            public int Hops;
            public float Pull;        // m/s
            public float Last, PoolMul;
            public int MaxPools;
            public int Arms, Count;
            public float Gap;
            public float[] At;        // 소환 체력 문턱
            public Color Color;
        }

        private static float M(float px) => px / PxPerMeter;

        public static readonly Sig[] All =
        {
            new Sig { Key = "tomb", Kind = Kind.Summon, NameKo = "순장 호령", LineKo = "순장된 병사들이 무덤에서 일어난다",
                At = new[] { 0.66f, 0.33f }, N = 2, Color = new Color(0.85f, 0.82f, 0.69f) },
            new Sig { Key = "fort", Kind = Kind.Rain, NameKo = "망루 화살비",
                Cd = 7f, Warn = 0.9f, R = M(42f), N = 3, Spread = M(55f), Mul = 1.2f, Color = new Color(0.85f, 0.76f, 0.48f) },
            new Sig { Key = "bandit", Kind = Kind.Hops, NameKo = "흑풍 삼연돌",
                Cd = 8f, Warn = 0.45f, R = M(34f), Hops = 3, Mul = 0.9f, Color = new Color(0.69f, 0.6f, 0.35f) },
            new Sig { Key = "palace", Kind = Kind.Vortex, NameKo = "심연 소용돌이",
                Cd = 9f, Warn = 1.2f, R = M(95f), Pull = M(60f), Mul = 1.4f, Color = new Color(0.35f, 0.7f, 1f) },
            new Sig { Key = "hellgate", Kind = Kind.Pool, NameKo = "업화 장판",
                Cd = 6f, Warn = 0.8f, R = M(46f), Mul = 0.6f, Last = 6f, PoolMul = 0.2f, MaxPools = 4, Color = new Color(1f, 0.42f, 0.16f) },
            // 31층(tasks U-0028) — 웹 `summon` at [0.66, 0.33] n 3. 부르는 졸개는 층 졸개 그대로(세 시대 모습은 졸개 쪽 규칙을 따른다).
            new Sig { Key = "nameless", Kind = Kind.Summon, NameKo = "삼킨 이름들", LineKo = "삼킨 이름들이 세 시대의 모습으로 일어난다",
                At = new[] { 0.66f, 0.33f }, N = 3, Color = new Color(0.55f, 0.55f, 0.7f) },
            new Sig { Key = "cloud", Kind = Kind.Cross, NameKo = "천뢰 십자",
                Cd = 8f, Warn = 1.0f, R = M(22f), Arms = 4, Count = 5, Gap = M(48f), Mul = 1.3f, Color = new Color(0.79f, 0.72f, 1f) },
        };

        /// <summary>웹 손잡이 `dungeon.guardSig` — 끄면 주인은 강타만.</summary>
        public static bool Enabled = true;

        /// <summary>명소 층 번호(<see cref="DungeonLandmarkData.All"/> 순) → 그 주인의 수. 없으면 false.</summary>
        public static bool TryFor(int landmark, out Sig sig)
        {
            sig = default;
            if (landmark < 0 || landmark >= DungeonLandmarkData.All.Length) return false;
            string key = DungeonLandmarkData.All[landmark].Key;
            foreach (var s in All) if (s.Key == key) { sig = s; return true; }
            return false;
        }

        public static string Name(Sig s) => DungeonLocalization.T($"lordsig.{s.Key}", s.NameKo);
        public static string Line(Sig s) => DungeonLocalization.T($"lordsig.{s.Key}.line", s.LineKo ?? "");

        public struct Zone
        {
            public Vector3 C;
            public float R;
        }

        /// <summary>고유 수가 칠 원들 — 순수(웹 guardZones). lord 주인 자리, player 나 자리, step 몇 번째 시전. y 는 나 자리 높이.</summary>
        public static List<Zone> Zones(Sig sig, Vector3 lord, Vector3 player, int step)
        {
            var o = new List<Zone>();
            float y = player.y;
            switch (sig.Kind)
            {
                case Kind.Rain:
                {
                    float a = step * 1.1f;
                    o.Add(new Zone { C = player, R = sig.R });
                    for (int i = 1; i < Mathf.Max(1, sig.N); i++)
                    {
                        float sgn = i % 2 == 1 ? 1f : -1f, m = Mathf.Ceil(i / 2f) * sig.Spread;
                        o.Add(new Zone { C = new Vector3(player.x + Mathf.Cos(a) * m * sgn, y, player.z + Mathf.Sin(a) * m * sgn), R = sig.R });
                    }
                    break;
                }
                case Kind.Hops:
                case Kind.Pool:
                    o.Add(new Zone { C = player, R = sig.R });
                    break;
                case Kind.Vortex:
                    o.Add(new Zone { C = new Vector3(lord.x, y, lord.z), R = sig.R });
                    break;
                case Kind.Cross:
                {
                    float b = step % 2 == 1 ? Mathf.PI / 4f : 0f;
                    for (int i = 0; i < sig.Arms; i++)
                    {
                        float a = b + i * Mathf.PI * 2f / sig.Arms;
                        for (int k = 1; k <= sig.Count; k++)
                            o.Add(new Zone { C = new Vector3(lord.x + Mathf.Cos(a) * sig.Gap * k, y, lord.z + Mathf.Sin(a) * sig.Gap * k), R = sig.R });
                    }
                    break;
                }
            }
            return o;
        }

        /// <summary>내 자리가 원 하나라도에 닿나(바닥 거리 ≤ r + 내 몸).</summary>
        public static bool InZones(List<Zone> zones, Vector3 p)
        {
            if (zones == null) return false;
            foreach (var z in zones)
            {
                float dx = p.x - z.C.x, dz = p.z - z.C.z;
                if (Mathf.Sqrt(dx * dx + dz * dz) <= z.R + PlayerRadius) return true;
            }
            return false;
        }
    }
}
