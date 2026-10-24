using System.Collections.Generic;
using UnityEngine;
using Saga.Go.Data;

namespace Saga.Go.Combat
{
    /// <summary>`FieldCombat` 의 일부(partial) — tasks U-0202 대치(고스트 오브 쓰시마 구조만 · 고돗 G-0343 `field_standoff.gd` 짝, 웹 없음).</summary>
    public partial class FieldCombat
    {
        // 쉬는 무리(전원 떠돎·체력 가득) 곁 어그로 거리 + 2m 안에 들면 "⚔ 대치": 무리가 멈춰 노려보고 1.0~2.2초 뒤 한 마리가 달려든다(0.25초 미끄러져 내 앞 1.3m).
        // 닿은 뒤 0.45초 창(이어질수록 ×0.85) 안에 평타 → 그 적 한 칼("일격!" — 방패 먼저 0, 전리품·경험 그대로) · 다음 놈이 이어 달려듦, 무리 전원까지.
        // 25% 는 헛몸짓(움찔만 0.5초). 달려들기 전·헛몸짓에 누르면 "성급했다!"(깨짐 — 평타는 그대로 나감) · 창을 놓치면 그 적 한 방 맞고 깨짐 ·
        // 맞선 자리에서 6m 넘게 벗어나면 조용히 풂. 깨지면 남은 무리 전원 쫓아옴. 한 번 깬(또는 푼) 무리는 60초 안 다시 안 맞섬.
        // 빼는 것: 말 위·자동 퀘스트·결투·싸울 수 없음(등반·낚시 등) · 인물·수호장·이야기·영역·주간 보스.
        public const float StandExtra = 2f, StandLeave = 6f, StandWaitMin = 1f, StandWaitMax = 2.2f, StandNextMin = 0.6f, StandNextMax = 1.2f,
            StandLungeSec = 0.25f, StandWindowSec = 0.45f, StandChain = 0.85f, StandFeintSec = 0.5f, StandCoolSec = 60f, StandFront = 1.3f, StandStrikeCd = 0.35f;

        public static bool StandoffOn = true;
        /// <summary>헛몸짓 확률(진단이 0 으로 둔다).</summary>
        public static float StandFeintChance = 0.25f;

        public enum StandPhase { None, Wait, Feint, Lunge, Window }

        public StandPhase Stand { get; private set; }
        public string StandGroup { get; private set; }
        public FieldEnemy StandFoe { get; private set; }
        public int StandKills { get; private set; }
        public float StandLeft { get; private set; }
        /// <summary>진단 — 마지막 일: "start" · "strike" · "rash" · "miss" · "leave" · "clear" · "busy".</summary>
        public string LastStand { get; private set; }
        public int StandStrikes { get; private set; }

        private readonly List<FieldEnemy> _standFoes = new List<FieldEnemy>();
        private readonly Dictionary<string, float> _standCool = new Dictionary<string, float>();
        private readonly List<string> _standKeys = new List<string>();
        private Vector3 _standAnchor;
        private System.Random _standRng = new System.Random(20260824);

        private static readonly Color StandGold = new Color(1f, 0.86f, 0.4f);

        public float StandWindowNow => StandWindowSec * Mathf.Pow(StandChain, StandKills);

        private bool StandBlocked() => !StandoffOn || !CanAct() || MountBlocks()
            || (Saga.Go.UI.GoAutoQuest.Instance != null && Saga.Go.UI.GoAutoQuest.Instance.Q != null && Saga.Go.UI.GoAutoQuest.Instance.Q.On);

        private void TickStandoff(float dt)
        {
            if (_standCool.Count > 0)
            {
                _standKeys.Clear();
                _standKeys.AddRange(_standCool.Keys); // 매 프레임 새 목록을 안 만든다(R-5)
                foreach (var k in _standKeys) { _standCool[k] -= dt; if (_standCool[k] <= 0f) _standCool.Remove(k); }
            }
            if (Stand == StandPhase.None) { ScanStandoff(); return; }

            _standFoes.RemoveAll(e => e == null || !e.Alive);
            if (_standFoes.Count == 0) { EndStandoff("clear", false); return; }
            if (_standFoes.Exists(e => e.Stand == FieldEnemy.StandPose.None || e.CurrentState != FieldEnemy.State.Wander)) { EndStandoff("hit", true); return; } // 맞거나 딴 길로 쫓기 시작
            if (StandBlocked()) { EndStandoff("busy", true); return; }
            if (Flat(transform.position - _standAnchor).magnitude > StandLeave) { EndStandoff("leave", false); return; }

            StandLeft -= dt;
            if (StandLeft > 0f) return;
            switch (Stand)
            {
                case StandPhase.Wait:
                    StandFoe = NearestStandFoe();
                    if (_standRng.NextDouble() < StandFeintChance) { Stand = StandPhase.Feint; StandLeft = StandFeintSec; StandFoe.StandCue(); }
                    else
                    {
                        Vector3 dir = Flat(StandFoe.transform.position - transform.position);
                        if (dir.sqrMagnitude < 0.01f) dir = Forward();
                        StandFoe.StandLunge(transform.position + dir.normalized * StandFront);
                        Stand = StandPhase.Lunge;
                        StandLeft = StandLungeSec;
                    }
                    break;
                case StandPhase.Feint:
                    StandFoe.StandGlare();
                    Stand = StandPhase.Wait;
                    StandLeft = Range(StandNextMin, StandNextMax);
                    break;
                case StandPhase.Lunge:
                    Stand = StandPhase.Window;
                    StandLeft = StandWindowNow;
                    FieldDamageText.Spawn(StandFoe.transform.position + Vector3.up * (StandFoe.BodyTop + 2f), "!", StandGold, 0.5f);
                    break;
                case StandPhase.Window:
                    var foe = StandFoe;
                    EndStandoff("miss", true);
                    if (foe != null && foe.Alive && CanBeTargeted) ReceiveStrike(foe.Atk, foe); // 놓침 — 그 적 한 방
                    break;
            }
        }

        private void ScanStandoff()
        {
            if (StandBlocked()) return;
            FieldEnemy best = null;
            float bestD = float.MaxValue;
            foreach (var e in FieldEnemy.All)
            {
                if (e == null || string.IsNullOrEmpty(e.GroupId) || !e.StandoffOk || _standCool.ContainsKey(e.GroupId)) continue;
                float d = Flat(e.transform.position - transform.position).magnitude;
                if (d < bestD) { bestD = d; best = e; }
            }
            if (best == null || bestD > FieldEnemy.DetectRadius + StandExtra) return;
            // 무리 전원이 쉬고 있어야(하나라도 쫓는 중이면 이미 싸움)
            _standFoes.Clear();
            foreach (var e in FieldEnemy.All)
            {
                if (e == null || !e.Alive || e.GroupId != best.GroupId) continue;
                if (!e.StandoffOk) { _standFoes.Clear(); return; }
                _standFoes.Add(e);
            }
            if (_standFoes.Count == 0) return;
            foreach (var e in _standFoes) e.StandGlare();
            StandGroup = best.GroupId;
            StandKills = 0;
            StandFoe = null;
            _standAnchor = transform.position;
            Stand = StandPhase.Wait;
            StandLeft = Range(StandWaitMin, StandWaitMax);
            LastStand = "start";
            FieldDamageText.Spawn(transform.position + Vector3.up * 4.4f, GoLocalization.T("field.standoff", "⚔ 대치"), StandGold, 1.4f);
        }

        /// <summary>`Attack` 첫머리 — 창 안이면 그 적 한 칼(true), 그 전이면 성급(깨짐). 평타는 어느 쪽이든 그대로 나간다.</summary>
        private bool TryStandoffStrike()
        {
            if (Stand == StandPhase.None) return false;
            if (Stand != StandPhase.Window || StandFoe == null || !StandFoe.Alive)
            {
                FieldDamageText.Spawn(transform.position + Vector3.up * 4.4f, GoLocalization.T("field.standoff_rash", "성급했다!"), new Color(1f, 0.55f, 0.45f), 1.2f);
                EndStandoff("rash", true);
                return false;
            }
            var foe = StandFoe;
            foe.StandRelease(false);
            if (foe.Shielded) foe.TakeRaw(foe.ShieldHp + 1f, StandGold);
            foe.TakeRaw(foe.Hp + 1f, StandGold);
            StandKills++;
            StandStrikes++;
            LastStand = "strike";
            Saga.Go.Audio.GoSfx.Play("sword_hit", 1.1f, 0.05f);
            FieldDamageText.Spawn(foe.transform.position + Vector3.up * (foe.BodyTop + 2.4f), GoLocalization.T("field.standoff_strike", "일격!"), StandGold, 1.4f);
            FieldRingFx.Spawn(foe.transform.position, 2.6f, StandGold, 0.3f);
            StandFoe = null;
            _standFoes.Remove(foe);
            if (_standFoes.Count == 0) { EndStandoff("clear", false); return true; }
            Stand = StandPhase.Wait;
            StandLeft = Range(StandNextMin, StandNextMax);
            return true;
        }

        private void EndStandoff(string why, bool chase)
        {
            foreach (var e in _standFoes) if (e != null) e.StandRelease(chase);
            _standFoes.Clear();
            if (!string.IsNullOrEmpty(StandGroup)) _standCool[StandGroup] = StandCoolSec;
            if (why != "strike") LastStand = why;
            Stand = StandPhase.None;
            StandFoe = null;
            StandLeft = 0f;
        }

        private FieldEnemy NearestStandFoe()
        {
            FieldEnemy best = null;
            float bd = float.MaxValue;
            foreach (var e in _standFoes)
            {
                float d = Flat(e.transform.position - transform.position).sqrMagnitude;
                if (d < bd) { bd = d; best = e; }
            }
            return best;
        }

        private float Range(float a, float b) => a + (float)_standRng.NextDouble() * (b - a);

        /// <summary>진단 — 대치 흐름만 dt 만큼(적 몸은 제 Update 가 움직인다).</summary>
        public void StepStandoffForTest(float dt) => TickStandoff(dt);

        private void ClearStandoff()
        {
            if (Stand != StandPhase.None) EndStandoff("reset", false);
            _standCool.Clear();
            StandGroup = null;
            LastStand = null;
            StandKills = StandStrikes = 0;
            _standRng = new System.Random(20260824);
        }
    }
}
