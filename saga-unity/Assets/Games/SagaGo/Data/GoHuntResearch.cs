using System;
using System.Collections.Generic;
using UnityEngine;
using Saga.Go.Combat;

namespace Saga.Go.Data
{
    /// <summary>
    /// tasks U-0220 종 연구 과제(고돗 G-0371 `data/hunt_research.gd` 이식 — 레전드 아르세우스처럼 마릿수만 아니라 "어떻게 잡았나"를 종마다 센다).
    /// 사냥 기록(<see cref="HuntState"/>)의 곁가지: 과제 넷 = 급소 막타(치명타로 쓰러뜨림) · 원소 반응 막타 · 쳐낸 적 처치(그 목숨 동안 한 번이라도 쳐냄) ·
    /// 던져서 처치(그 목숨 동안 던짐 — 우두머리는 못 잡아 빼고 셋). 과제마다 3번(우두머리 1) 채우면 그 자리에서 덤(금 800 + 무예 쪽지 1),
    /// 종의 과제를 다 채우면 "연구 완료" 덤(금 3000 + 무예 교본 1) 하나 더. 막타 표식은 `FieldEnemy.TakeHit` 이 `ApplyDamage` 둘레에만 세우고,
    /// 쳐냄은 `FieldEnemy.Parried`, 던짐은 `FieldCombat.Land` 가 남긴다 — `FieldEnemy.Die` 가 읽고 지운다. 세이브 `huntResearch`(Json, 버전 그대로 — 옛 세이브 null = 0).
    /// 손잡이 `SAGA_HUNT_RESEARCH=0` 이면 안 센다. 마릿수 기록·사냥 기록 덤은 그대로.
    /// </summary>
    public static class GoHuntResearch
    {
        [Flags] public enum Tag { None = 0, Weak = 1, React = 2, Parried = 4, Thrown = 8 }

        public static readonly Tag[] Tasks = { Tag.Weak, Tag.React, Tag.Parried, Tag.Thrown };
        public const int Goal = 3, BossGoal = 1;
        public const int TaskGold = 800, DoneGold = 3000;
        public const int TaskNote = 1, DoneGuide = 1;

        /// <summary>끄면 안 센다(고돗 `SAGA_HUNT_RESEARCH=0` 짝).</summary>
        public static bool On = Environment.GetEnvironmentVariable("SAGA_HUNT_RESEARCH") != "0";

        [Serializable] private class Row { public string id; public int[] n = new int[4]; }
        [Serializable] private class Store { public List<Row> rows = new List<Row>(); }
        private static Store _s = new Store();

        private static int Index(Tag t) => t == Tag.Weak ? 0 : t == Tag.React ? 1 : t == Tag.Parried ? 2 : t == Tag.Thrown ? 3 : -1;

        /// <summary>그 종에 걸린 과제 — 우두머리는 던질 수 없어 셋.</summary>
        public static List<Tag> TasksOf(FieldEnemy.Kind k)
        {
            var l = new List<Tag>();
            foreach (var t in Tasks) if (!(t == Tag.Thrown && GoHunt.IsBoss(k))) l.Add(t);
            return l;
        }

        public static int GoalOf(FieldEnemy.Kind k) => GoHunt.IsBoss(k) ? BossGoal : Goal;

        public static string TaskName(Tag t) => t switch
        {
            Tag.Weak => GoLocalization.T("research.weak", "급소로 쓰러뜨리기"),
            Tag.React => GoLocalization.T("research.react", "원소 반응으로 쓰러뜨리기"),
            Tag.Parried => GoLocalization.T("research.parried", "쳐낸 적 쓰러뜨리기"),
            Tag.Thrown => GoLocalization.T("research.thrown", "던진 적 쓰러뜨리기"),
            _ => t.ToString(),
        };

        private static Row Find(FieldEnemy.Kind k, bool make)
        {
            string id = k.ToString();
            foreach (var r in _s.rows) if (r.id == id) return r;
            if (!make) return null;
            var nr = new Row { id = id };
            _s.rows.Add(nr);
            return nr;
        }

        public static int Count(FieldEnemy.Kind k, Tag t)
        {
            var r = Find(k, false); int i = Index(t);
            return r == null || i < 0 || r.n == null || i >= r.n.Length ? 0 : r.n[i];
        }

        /// <summary>채운 과제 수.</summary>
        public static int DoneCount(FieldEnemy.Kind k)
        {
            int n = 0;
            foreach (var t in TasksOf(k)) if (Count(k, t) >= GoalOf(k)) n++;
            return n;
        }

        public static bool Complete(FieldEnemy.Kind k) => DoneCount(k) >= TasksOf(k).Count;

        private static int[] Mats(int note, int guide)
        {
            var m = new int[5];
            m[(int)GoTalent.Mat.Note] = note; m[(int)GoTalent.Mat.Guide] = guide;
            return m;
        }

        /// <summary>한 마리 — 태그마다 횟수를 올리고 이번에 채운 과제를 돌려준다(덤은 그 자리에서). 연구 완료면 끝에 <see cref="Tag.None"/> 이 붙는다.</summary>
        public static List<Tag> Record(FieldEnemy.Kind k, Tag tags)
        {
            var fresh = new List<Tag>();
            if (!On || tags == Tag.None || !Enum.IsDefined(typeof(FieldEnemy.Kind), k)) return fresh;
            bool wasComplete = Complete(k);
            int goal = GoalOf(k);
            Row row = null;
            foreach (var t in TasksOf(k))
            {
                if ((tags & t) == 0) continue;
                row ??= Find(k, true);
                if (row.n == null || row.n.Length < 4) row.n = new int[4];
                int i = Index(t), before = row.n[i];
                row.n[i] = before + 1;
                if (before < goal && before + 1 >= goal)
                {
                    fresh.Add(t);
                    GoldState.Add(TaskGold);
                    TalentState.Add(Mats(TaskNote, 0));
                }
            }
            if (!wasComplete && Complete(k))
            {
                fresh.Add(Tag.None);
                GoldState.Add(DoneGold);
                TalentState.Add(Mats(0, DoneGuide));
            }
            return fresh;
        }

        /// <summary>알림 글 — 과제 하나마다 한 줄(연구 완료 줄 포함). 없으면 빈 글.</summary>
        public static string NoticeText(FieldEnemy.Kind k, List<Tag> fresh)
        {
            if (fresh == null || fresh.Count == 0) return "";
            var lines = new List<string>();
            string name = FieldEnemy.KindName(k);
            foreach (var t in fresh)
            {
                if (t == Tag.None)
                    lines.Add(string.Format(GoLocalization.T("research.done", "종 연구 완료 — {0} (금 {1} · {2} {3})"), name, DoneGold, GoTalent.MatName(GoTalent.Mat.Guide), DoneGuide));
                else
                    lines.Add(string.Format(GoLocalization.T("research.task", "종 연구 — {0} 「{1}」 달성 (금 {2} · {3} {4})"), name, TaskName(t), TaskGold, GoTalent.MatName(GoTalent.Mat.Note), TaskNote));
            }
            return string.Join("\n", lines);
        }

        /// <summary>들판 처치 뒤 — 기록하고 알린다(`FieldEnemy.Die`). 이번에 채운 과제.</summary>
        public static List<Tag> OnKill(FieldEnemy.Kind k, Tag tags)
        {
            var fresh = Record(k, tags);
            string s = NoticeText(k, fresh);
            if (s.Length > 0 && Saga.Go.UI.DialogueLabel.Instance != null) Saga.Go.UI.DialogueLabel.Instance.Show(s, 3.5f);
            return fresh;
        }

        /// <summary>사냥 기록 줄 끝 — "연구 2/4" · 다 채우면 "연구 완료". 끄면 빈 글.</summary>
        public static string RowText(FieldEnemy.Kind k)
        {
            if (!On) return "";
            return Complete(k) ? GoLocalization.T("research.row_done", "연구 완료")
                : string.Format(GoLocalization.T("research.row", "연구 {0}/{1}"), DoneCount(k), TasksOf(k).Count);
        }

        // ---- 세이브 ----

        public static string Snapshot() => JsonUtility.ToJson(_s);

        public static void Restore(string json)
        {
            Store s = null;
            if (!string.IsNullOrEmpty(json)) { try { s = JsonUtility.FromJson<Store>(json); } catch (ArgumentException) { s = null; } }
            _s = s ?? new Store();
            var keep = new List<Row>();
            foreach (var r in _s.rows ?? new List<Row>())
            {
                if (r == null || string.IsNullOrEmpty(r.id)) continue;
                bool known = false;
                foreach (var k in GoHunt.Species) if (k.ToString() == r.id) { known = true; break; }
                if (!known) continue;
                var n = new int[4];
                for (int i = 0; r.n != null && i < 4 && i < r.n.Length; i++) n[i] = Mathf.Max(0, r.n[i]);
                r.n = n;
                keep.Add(r);
            }
            _s.rows = keep;
        }

        public static void ResetForTest() => Restore(null);
    }
}
