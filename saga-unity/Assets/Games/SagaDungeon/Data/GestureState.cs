using System.Collections.Generic;
using UnityEngine;

namespace Saga.Dungeon.Data
{
    /// <summary>
    /// PLAN.md 109-10-7 몸짓(身振, 웹 사가나락 §5.16 `gesture.js`) — 마을 사람·동행이 일과 명령에 맞춰 움직인다. **화면 층만**(판정·세이브 없음).
    ///
    ///   ① 인사   — 마을 사람에게 다가서면 손짓 + 👋 (1.0초)
    ///   ② 일     — 그 사람과 볼일을 보면(행상이 팔면) 제 일 몸짓 + 일 글자 (1.6초)
    ///   ③ 틈틈이 — 아무 일 없을 때도 사람마다 7~11초에 한 번 1.4초씩 제 일(글자 없음). 주기·어긋남은 키 해시(FNV-1a, 웹 그대로)
    ///   ④ 호응   — 동행 둘이 선두의 대기술(이 판엔 서명 무예가 없어 **회전베기**)에 맞춰 친다(❗ 호응 0.8초),
    ///              두목급(층 두목·미니보스·명소 주인·우두머리·시련 수호자·월드 보스)을 잡거나 레벨이 오르면 환호(🎉 1.4초, 통통 튐)
    ///
    /// 웹의 마을 사람 일곱(대장·야장·서생…)은 이 판에 없다 — 이 판 마을에 선 사람으로 표를 새로 짰다: 촌민(두 몸 번갈아)·행상(시대 행상 포함)·
    /// 시대 손님 넷(웹 ERA_FOLK 넷과 짝: 택배 기사 courier·회사원 officeworker→salaryman·시간 여행자 timetraveler→chrononaut·탐사 대원 explorer→surveyor).
    /// 걷거나 치는 중인 배우는 몸짓 대신 제 동작을 두고 글자만 띄운다. 웹 손잡이 `dungeon.gesture` 는 <see cref="Enabled"/>(끄면 예전 그대로).
    /// 5.17 동행 서명(109-10-8): 쓴 동행만 ✨ 서명 / ⚡ 합격 1.0초 — 몸은 서명 쪽(<c>AllySigCaster</c>)이 제 공격 클립을 틀어 여기선 글자만.
    /// </summary>
    public static class GestureState
    {
        /// <summary>몸짓 동작 — 웹 asset3d 슬롯 이름에 맞춘다.</summary>
        public enum Slot { Idle, Attack, Interaction, Wave, Jump, None }

        public struct Job
        {
            public string Key;      // 역할 키(키 해시의 앞머리)
            public Slot Work;       // 틈틈이·볼일 몸짓
            public string TextKey;  // 볼일 글자(그림 문자 + 말)
            public string TextKo;
        }

        /// <summary>마을 사람 일 — 그림 문자는 Noto Emoji 흑백 대체 글꼴에 있는 것만(변형 선택자 없이).</summary>
        public static readonly Job[] Jobs =
        {
            new Job { Key = "villager",   Work = Slot.Attack,      TextKey = "gesture.job.villager",   TextKo = "🌾 일손" },
            new Job { Key = "merchant",   Work = Slot.Interaction, TextKey = "gesture.job.merchant",   TextKo = "💰 흥정" },
            new Job { Key = "courier",    Work = Slot.Interaction, TextKey = "gesture.job.courier",    TextKo = "📦 배달" },
            new Job { Key = "salaryman",  Work = Slot.Interaction, TextKey = "gesture.job.salaryman",  TextKo = "📱 통화" },
            new Job { Key = "chrononaut", Work = Slot.Interaction, TextKey = "gesture.job.chrononaut", TextKo = "⌛ 좌표" },
            new Job { Key = "surveyor",   Work = Slot.Interaction, TextKey = "gesture.job.surveyor",   TextKo = "📡 측정" },
        };

        public enum Kind { None, Work, Greet, Serve, Rally, Cheer, Sig }

        private struct KindDef
        {
            public float Dur;
            public Slot Slot;        // Idle = 그 사람 일(Job.Work)
            public string TextKey, TextKo;
            public bool Bob;
        }

        private static readonly Dictionary<Kind, KindDef> Kinds = new Dictionary<Kind, KindDef>
        {
            { Kind.Greet, new KindDef { Dur = 1.0f, Slot = Slot.Wave, TextKey = "gesture.greet", TextKo = "👋" } },
            { Kind.Serve, new KindDef { Dur = 1.6f, Slot = Slot.Idle } },
            { Kind.Rally, new KindDef { Dur = 0.8f, Slot = Slot.Attack, TextKey = "gesture.rally", TextKo = "❗ 호응" } },
            { Kind.Cheer, new KindDef { Dur = 1.4f, Slot = Slot.Jump, TextKey = "gesture.cheer", TextKo = "🎉", Bob = true } },
            { Kind.Sig, new KindDef { Dur = 1.0f, Slot = Slot.None, TextKey = "gesture.sig", TextKo = "✨ 서명" } },
        };

        public const float WorkMin = 7f, WorkSpan = 5f, WorkDur = 1.4f;
        /// <summary>동행 둘이 같이 읽는 키(웹 'ally').</summary>
        public const string AllyKey = "ally";
        /// <summary>동행 하나만 읽는 키(서명은 쓴 쪽만) — <c>Gesturer</c> 는 제 키를 먼저 본다.</summary>
        public const string GuardKey = "ally.guard", MysticKey = "ally.mystic";

        /// <summary>웹 손잡이 `dungeon.gesture` — 끄면 몸짓·글자 없음.</summary>
        public static bool Enabled = true;

        /// <summary>진단이 시각을 넣는다(음수면 <see cref="Time.time"/>).</summary>
        public static float NowOverride = -1f;
        public static float Now => NowOverride >= 0f ? NowOverride : Time.time;

        public struct Cue
        {
            public Kind Kind;
            public float T0, Dur;
            public Slot Slot;
            public string Text;
            public bool Bob;
        }

        /// <summary>이번 프레임 한 배우의 몸짓.</summary>
        public struct Pose
        {
            public Kind Kind;
            public Slot Slot;
            public string Text;
            public float K;     // 0..1 진행
            public float Bob;   // 0..1 튐
            public float T0;    // 몸짓이 시작한 시각(트리거를 한 번만 걸려고)
        }

        private static readonly Dictionary<string, Cue> Cues = new Dictionary<string, Cue>();

        public static int CueCount => Cues.Count;

        public static void Reset() => Cues.Clear();

        /// <summary>키의 역할(키 = "역할@x,z").</summary>
        public static string RoleOf(string key)
        {
            if (string.IsNullOrEmpty(key)) return "";
            int at = key.IndexOf('@');
            return at < 0 ? key : key.Substring(0, at);
        }

        public static bool TryJob(string key, out Job job)
        {
            string role = RoleOf(key);
            foreach (var j in Jobs) if (j.Key == role) { job = j; return true; }
            job = default;
            return false;
        }

        public static string JobText(Job j) => DungeonLocalization.T(j.TextKey, j.TextKo);

        /// <summary>FNV-1a 32 — 웹 `hash` 그대로(UTF-16 코드 단위).</summary>
        public static uint Hash(string s)
        {
            uint h = 2166136261u;
            s = s ?? "";
            for (int i = 0; i < s.Length; i++) { h ^= s[i]; h = unchecked(h * 16777619u); }
            return h;
        }

        /// <summary>③ 틈틈이 — 이 사람의 주기(초)와 어긋남(초). 키가 같으면 늘 같다.</summary>
        public static void WorkCycle(string key, out float period, out float offset)
        {
            uint h = Hash(key);
            period = WorkMin + h % (uint)WorkSpan;
            offset = ((h >> 5) % 1000u) / 1000f * period;
        }

        public static bool InWork(string key, float now)
        {
            if (!TryJob(key, out _)) return false;
            WorkCycle(key, out float period, out float offset);
            float ph = Mathf.Repeat(now + offset, period);
            return ph < WorkDur;
        }

        /// <summary>몸짓 하나를 건다(같은 키의 앞 몸짓은 덮는다). 꺼져 있거나 키가 없으면 false.</summary>
        public static bool Start(string key, Kind kind, float now, string text = null)
        {
            if (!Enabled || string.IsNullOrEmpty(key) || !Kinds.TryGetValue(kind, out var def)) return false;
            bool hasJob = TryJob(key, out var job);
            Slot slot = def.Slot != Slot.Idle ? def.Slot : (hasJob ? job.Work : Slot.Interaction);
            string tx = text ?? (def.TextKey != null ? DungeonLocalization.T(def.TextKey, def.TextKo) : hasJob ? JobText(job) : "");
            Cues[key] = new Cue { Kind = kind, T0 = now, Dur = def.Dur, Slot = slot, Text = tx, Bob = def.Bob };
            return true;
        }

        public static bool TryActive(string key, float now, out Cue cue)
        {
            if (key != null && Cues.TryGetValue(key, out cue))
            {
                if (now >= cue.T0 && now < cue.T0 + cue.Dur) return true;
                if (now >= cue.T0 + cue.Dur) Cues.Remove(key);
            }
            cue = default;
            return false;
        }

        /// <summary>이번 프레임 이 배우의 몸짓 — 순수(주어진 now 로만 정한다). busy = 걷거나 치는 중(몸짓 대신 글자만).</summary>
        public static Pose Plan(string key, float now, bool busy, bool npc)
        {
            if (!Enabled) return new Pose { Slot = Slot.Idle, Text = "" };
            if (TryActive(key, now, out var c))
            {
                float k = (now - c.T0) / c.Dur;
                return new Pose
                {
                    Kind = c.Kind, Slot = busy ? Slot.Idle : c.Slot, Text = c.Text, K = k, T0 = c.T0,
                    Bob = c.Bob && !busy ? Mathf.Abs(Mathf.Sin(k * Mathf.PI * 3f)) : 0f,
                };
            }
            if (npc && !busy && TryJob(key, out var job) && InWork(key, now))
            {
                WorkCycle(key, out float period, out float offset);
                float ph = Mathf.Repeat(now + offset, period);
                return new Pose { Kind = Kind.Work, Slot = job.Work, Text = "", K = ph / WorkDur, T0 = now - ph };
            }
            return new Pose { Slot = Slot.Idle, Text = "" };
        }

        // ── 사건 → 몸짓(묶음 `GestureRunner` 가 부르고, 진단이 now 를 넣어 곧장 부른다) ──

        /// <summary>① 다가섬.</summary>
        public static bool OnGreet(string key, float now) => Start(key, Kind.Greet, now);

        /// <summary>② 볼일 — 이미 볼일 몸짓 중이면 다시 안 건다(웹 changed 가 연달아 와도 한 번).</summary>
        public static bool OnServe(string key, float now)
        {
            if (TryActive(key, now, out var cur) && cur.Kind == Kind.Serve) return false;
            return Start(key, Kind.Serve, now);
        }

        /// <summary>④ 선두 대기술(회전베기).</summary>
        public static bool OnLeadSignature(float now) => Start(AllyKey, Kind.Rally, now);

        public static bool OnLevelUp(float now) => Start(AllyKey, Kind.Cheer, now, DungeonLocalization.T("gesture.cheer_level", "🎉 경하"));

        /// <summary>동행 서명(109-10-8) — 쓴 동행 키에 ✨ 서명, 합격이면 ⚡ 합격.</summary>
        public static bool OnAllySig(string allyKey, bool combo, float now) =>
            Start(allyKey, Kind.Sig, now, combo ? DungeonLocalization.T("gesture.combo", "⚡ 합격") : null);

        /// <summary>두목급 처치만 — 잡졸은 null(false).</summary>
        public static bool OnKill(bool bossClass, float now) =>
            bossClass && Start(AllyKey, Kind.Cheer, now, DungeonLocalization.T("gesture.cheer_win", "🎉 이겼다"));
    }
}
