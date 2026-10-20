using System;
using Saga.Dungeon.World;

namespace Saga.Dungeon.Data
{
    /// <summary>
    /// tasks U-0137 난도 평·험·절(웹 `src/dungeon/02-run.js` MODES·고돗 G-0247) — 원작 노멀·나이트메어·헬 자리. 가장 깊이 10층이면 험, 20층이면 절이 열리고,
    /// 들머리(앞 방들·2층)에서만 바꾼다 — 더 내려간 뒤엔 회차 고정. 층 진행기의 방 적·정예·두목만 배율(체력·피해·경험·금)을 받고,
    /// 난입·월드 보스는 평(고돗과 같음). 웹 bias(드랍 등급)·resist 는 이 트랙에 굴림 표·저항 칸이 없어 뺐다. 부적 층 배율과 곱한다.
    /// </summary>
    public static class DungeonMode
    {
        public class Mode
        {
            public string Key, Ko, Hanja;
            public int Need;
            public float Hp, Dmg, Gold, Exp;
            public string Name => DungeonLocalization.T("mode." + Key, Ko);
        }

        public static readonly Mode[] All =
        {
            new Mode { Key = "normal", Ko = "평", Hanja = "平", Need = 0, Hp = 1f, Dmg = 1f, Gold = 1f, Exp = 1f },
            new Mode { Key = "hard", Ko = "험", Hanja = "險", Need = 10, Hp = 1.8f, Dmg = 1.5f, Gold = 1.6f, Exp = 1.5f },
            new Mode { Key = "hell", Ko = "절", Hanja = "絕", Need = 20, Hp = 3.2f, Dmg = 2.2f, Gold = 2.4f, Exp = 2.2f },
        };

        private static string _key = "normal";

        public static event Action Changed;

        public static Mode Get(string key) => Array.Find(All, m => m.Key == key) ?? All[0];
        public static Mode Current => Get(_key);
        public static float Hp => Current.Hp;
        public static float Dmg => Current.Dmg;
        public static int Gold(int g) => (int)Math.Round(g * Current.Gold, MidpointRounding.AwayFromZero);
        public static int Exp(int e) => (int)Math.Round(e * Current.Exp, MidpointRounding.AwayFromZero);

        /// <summary>가장 깊이 내려간 층(시나리오 기록) — 문턱.</summary>
        public static int Best => BestForTest ?? DungeonScenario.BestFloor;
        /// <summary>진단 — 가장 깊이를 정해 둔다(null = 실제 기록).</summary>
        public static int? BestForTest;
        public static bool IsOpen(Mode m) => Best >= m.Need;
        /// <summary>회차 들머리 — 층 진행은 2층부터(1층 = 앞 방들), 2층 이하에서만 바꾼다.</summary>
        public static bool AtStart => (DungeonFloorRunner.Instance?.CurrentFloor ?? 1) <= 2;

        /// <summary>못 고르는 이유(null = 됨): locked·deep.</summary>
        public static string Why(string key)
        {
            var m = Get(key);
            if (!IsOpen(m)) return "locked";
            if (m.Key != _key && !AtStart) return "deep";
            return null;
        }

        public static bool Choose(string key)
        {
            if (Why(key) != null) return false;
            _key = Get(key).Key;
            Changed?.Invoke();
            return true;
        }

        /// <summary>다음 열린 난도(평→험→절→평) — 설정 창 단추 한 번.</summary>
        public static string NextOpen()
        {
            int i = Array.FindIndex(All, m => m.Key == _key);
            for (int k = 1; k <= All.Length; k++)
            {
                var m = All[(i + k) % All.Length];
                if (IsOpen(m)) return m.Key;
            }
            return _key;
        }

        /// <summary>목표판 줄 끝(평이면 빈 글).</summary>
        public static string HudSuffix => _key == "normal" ? "" : " · " + Current.Name + "(" + Current.Hanja + ")";

        public static string Snapshot() => _key;
        public static void Restore(string key) { _key = Get(key).Key; Changed?.Invoke(); }
    }
}
