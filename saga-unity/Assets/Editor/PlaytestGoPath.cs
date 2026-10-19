using System;
using System.Linq;
using UnityEngine;
using Saga.Go.Combat;
using Saga.Go.Data;
using Saga.Go.Player;
using Saga.Go.World;

namespace Saga.EditorTools
{
    /// <summary>
    /// tasks U-0130 길 행동(웹 W-0276) 진단 — `PlaytestHeadless` 가 사냥 의뢰 뒤에 부른다(한 프레임 안, 날짜·굴림은 주입, 시간은 `Tick`).
    /// ① 셋 고르기(가장 높은 축·같으면 지→무→통)·곁 주민 ② 하루 한 번·거절 -1·새 날 풀림·세이브 왕복·옛 세이브 빈 채
    /// ③ 조사 = 가장 가까운 숨은 터 방위·거리 ④ 이끌기 = 40m 넘는 길목으로 앞장·30초 뒤 귀가 ⑤ 도발 = 체력 공격 ×14·이기면 경험 +30·60초 넘기면 거절·결투 중 금지.
    /// 끝나면 세이브 JSON·날짜·굴림·플레이어 자리를 시작 때로.
    /// </summary>
    public static class PlaytestGoPath
    {
        private static bool _ok;
        private static string _tag;

        public static bool Run(string tag)
        {
            _ok = true; _tag = tag;
            string json0 = SaveState.ToJson();
            var now0 = GoPath.NowFn;
            var rng0 = GoPath.Rng;
            var fc = FieldCombat.Instance;
            var pc = fc != null ? fc.GetComponent<PlayerController>() : null;
            var pa = PathActions.Ensure();
            try
            {
                if (fc == null || pc == null) { Fail("FieldCombat/PlayerController 없음"); return false; }
                var vs = VillagerTalk.All.Where(v => v != null && v.isActiveAndEnabled).ToList();
                if (vs.Count < 2) { Fail($"주민 {vs.Count} < 2"); return false; }
                var v0 = vs[0];
                GoPath.NowFn = () => new DateTime(2026, 10, 19, 12, 0, 0);
                GoPath.Restore(null, null);
                DuelGate.ResetForTest();

                // ① 셋 고르기
                if (GoPath.ActOf(50, 90, 60) != GoPath.Act.Probe || GoPath.ActOf(90, 50, 60) != GoPath.Act.Provoke || GoPath.ActOf(50, 60, 90) != GoPath.Act.Lead) Fail("가장 높은 축이 아님");
                if (GoPath.ActOf(80, 80, 80) != GoPath.Act.Probe || GoPath.ActOf(80, 70, 80) != GoPath.Act.Provoke) Fail("같을 때 지→무→통 순이 아님");
                string hP = Pick(GoPath.Act.Probe), hV = Pick(GoPath.Act.Provoke), hL = Pick(GoPath.Act.Lead);
                if (hP == null || hV == null || hL == null) { Fail("세 성향 인물을 못 찾음"); return false; }
                PartyState.Restore(new string[0]);
                if (GoPath.Current(out _) != GoPath.Act.None) Fail("동행 없는데 길 행동이 있음");
                Lead(hP);
                if (GoPath.Current(out string cur) != GoPath.Act.Probe || cur != hP) Fail($"선두 {cur} 성향이 조사 아님");
                pc.Teleport(v0.Root.position + new Vector3(3f, 0.5f, 0f));
                if (PathActions.Near() == null) Fail("주민 3m 곁인데 곁 주민 없음");
                if (VillagerTalk.Nearest(v0.Root.position + new Vector3(60f, 0f, 0f), GoPath.NearRadius) == v0) Fail("60m 밖 주민이 곁으로 잡힘");
                if (_ok) Debug.Log($"[{_tag}] path pick OK - 지력 조사·무력 도발·통솔 이끌기·같으면 지→무→통 · 동행 없으면 없음 · 곁 주민 {vs.Count}명 중 14m 안");

                // ② 하루 한 번·거절·새 날·세이브
                GoPath.Rng = () => 0.99f;
                if (pa.Do(v0) != GoPath.Act.Probe || GoPath.Used(v0.Id) != 1) Fail($"첫 조사 안 됨({pa.LastResult})");
                if (pa.Do(v0) != GoPath.Act.None || pa.LastResult != "used") Fail("같은 날 두 번 됨");
                GoPath.Rng = () => 0f;
                var v1 = vs[1];
                if (pa.Do(v1) != GoPath.Act.None || pa.LastResult != "refused" || GoPath.Used(v1.Id) != -1) Fail($"30% 거절 -1 안 됨({pa.LastResult}, {GoPath.Used(v1.Id)})");
                GoPath.Rng = () => 0.99f;
                if (pa.Do(v1) != GoPath.Act.None || pa.LastResult != "used") Fail("거절한 사람이 그날 다시 말함");
                string j = SaveState.ToJson();
                GoPath.Restore(null, null);
                SaveState.ApplyJson(j);
                if (GoPath.Used(v0.Id) != 1 || GoPath.Used(v1.Id) != -1 || GoPath.Day != "2026-10-19") Fail($"세이브 왕복 {GoPath.Used(v0.Id)}/{GoPath.Used(v1.Id)}/{GoPath.Day}");
                string oldSave = j.Replace("\"goPathDay\"", "\"goPathDayX\"").Replace("\"goPathUsed\"", "\"goPathUsedX\"");
                SaveState.ApplyJson(oldSave);
                if (GoPath.Used(v0.Id) != 0) Fail("옛 세이브(칸 없음)인데 기록이 남음");
                SaveState.ApplyJson(j);
                Lead(hP);
                GoPath.NowFn = () => new DateTime(2026, 10, 20, 3, 30, 0);
                if (GoPath.Used(v0.Id) != 1) Fail("새벽 4시 전인데 풀림");
                GoPath.NowFn = () => new DateTime(2026, 10, 20, 4, 30, 0);
                if (GoPath.Used(v0.Id) != 0 || GoPath.Used(v1.Id) != 0) Fail("새 날인데 어제 기록이 남음");
                if (_ok) Debug.Log($"[{_tag}] path day OK - 사람마다 하루 한 번 · 거절 -1(그날 말 안 섞음) · 세이브 왕복·옛 세이브 빈 채 · 새벽 4시 새 날");

                // ③ 조사
                GoPath.Restore(null, null);
                Vector3 p = fc.transform.position;
                if (pa.Do(v0) != GoPath.Act.Probe) Fail($"조사 안 됨({pa.LastResult})");
                if (GoPath.NearestGate(p, out var site, out float gd))
                {
                    foreach (var s in GoDomain.Gates()) { var q = s.Pos; if (new Vector2(q.x - p.x, q.z - p.z).magnitude < gd - 0.01f) Fail($"{s.Id} 가 더 가까움"); }
                    string dir = GoPath.Compass(p, site.Pos);
                    if (pa.LastText == null || !pa.LastText.Contains(site.Name) || !pa.LastText.Contains(dir) || !pa.LastText.Contains(Mathf.RoundToInt(gd) + "m")) Fail($"조사 줄 {pa.LastText}");
                    if (GoPath.Compass(Vector3.zero, new Vector3(0f, 0f, -10f)) != GoLocalization.T("path.dir.n", "북") || GoPath.Compass(Vector3.zero, new Vector3(10f, 0f, 0f)) != GoLocalization.T("path.dir.e", "동")) Fail("방위(북 = -z)");
                    if (_ok) Debug.Log($"[{_tag}] path probe OK - 가장 가까운 숨은 터 {site.Id} {dir}쪽 {Mathf.RoundToInt(gd)}m · 북 = -z");
                }
                else Fail("숨은 터가 하나도 없음");

                // ④ 이끌기
                GoPath.Restore(null, null);
                Lead(hL);
                Vector3 home = v0.Root.position;
                p = fc.transform.position;
                if (pa.Do(v0) != GoPath.Act.Lead || pa.LastResult != "lead") Fail($"이끌기 안 됨({pa.LastResult})");
                else
                {
                    Vector3 tgt = pa.LastTarget;
                    float td = new Vector2(tgt.x - p.x, tgt.z - p.z).magnitude;
                    if (td <= GoPath.LeadMinDist) Fail($"길목 {td:0}m ≤ 40m");
                    foreach (var w in GoWorldMap.Waypoints) { var q = GoWorldMap.WaypointPos(w); float d = new Vector2(q.x - p.x, q.z - p.z).magnitude; if (d > GoPath.LeadMinDist && d < td - 0.01f) Fail($"{w.Id} 가 더 가까운 길목"); }
                    if (!pa.Leading(v0)) Fail("이끄는 중이 아님");
                    float d0 = Flat(home, tgt);
                    pa.Tick(10f);
                    float d1 = Flat(v0.Root.position, tgt);
                    if (d1 > d0 - Mathf.Min(d0, 10f * GoPath.LeadSpeed) + 1f) Fail($"10초에 앞장서 걷지 않음 {d0:0}→{d1:0}m");
                    for (int i = 0; i < 25; i++) pa.Tick(1f);
                    if (!pa.Leading(v0) && Flat(v0.Root.position, home) > 0.5f) Fail("30초 뒤 집으로 안 감");
                    for (int i = 0; i < 400 && pa.Leading(v0); i++) pa.Tick(1f);
                    if (pa.Leading(v0) || Flat(v0.Root.position, home) > 0.5f) Fail($"귀가 안 끝남({Flat(v0.Root.position, home):0.0}m)");
                    var fw = v0.Root.GetComponent<FolkWalker>();
                    if (fw != null && !fw.enabled) Fail("오가기가 다시 안 켜짐");
                    if (_ok) Debug.Log($"[{_tag}] path lead OK - 40m 넘는 가장 가까운 길목 {td:0}m · 10초에 {d0 - d1:0}m 앞장 · 30초 뒤 귀가");
                }

                // ⑤ 도발
                GoPath.Restore(null, null);
                Lead(hV);
                DuelGate.Report(true);
                if (pa.Do(v0) != GoPath.Act.None || pa.LastResult != "busy" || GoPath.Used(v0.Id) != 0) Fail("결투 중인데 도발됨");
                DuelGate.ResetForTest();
                GoPath.Rng = () => 0f; // 도발은 굴림 거절이 없다
                long exp0 = PlayerStats.Exp; int lv0 = PlayerStats.Level;
                if (pa.Do(v0) != GoPath.Act.Provoke || pa.Foe == null) Fail($"도발 안 됨({pa.LastResult})");
                else
                {
                    float want = GoPath.ProvokeHp(fc.Atk);
                    if (Mathf.Abs(pa.Foe.MaxHp - want) > 0.5f || pa.Foe.EnemyKind != FieldEnemy.Kind.Bandit) Fail($"도발 적 {pa.Foe.EnemyKind} 체력 {pa.Foe.MaxHp} ≠ 공격 {fc.Atk:0}×14");
                    var foe = pa.Foe;
                    for (int i = 0; i < 400 && foe.Alive; i++) foe.TakeHit(10f, GoElement.Physical, foe.MaxHp, out _);
                    bool gained = PlayerStats.Level > lv0 || PlayerStats.Exp == exp0 + GoPath.ProvokeExp;
                    if (foe.Alive || !gained || pa.LastResult != "won" || pa.Foe != null) Fail($"이겨도 경험 +30 아님(Exp {exp0}→{PlayerStats.Exp}, {pa.LastResult})");
                    if (GoPath.Used(v0.Id) != 1) Fail("이긴 뒤 기록이 1 이 아님");
                    var v1b = vs[1];
                    if (pa.Do(v1b) != GoPath.Act.Provoke || pa.Foe == null) Fail("둘째 도발 안 됨");
                    else
                    {
                        pa.Tick(GoPath.ProvokeLimitSec + 1f);
                        if (pa.Foe != null || GoPath.Used(v1b.Id) != -1 || pa.LastResult != "refused") Fail($"60초 넘겨도 거절 아님({GoPath.Used(v1b.Id)}, {pa.LastResult})");
                    }
                    if (_ok) Debug.Log($"[{_tag}] path provoke OK - 산적 체력 {want:0}(공격×14) · 이기면 경험 +{GoPath.ProvokeExp} · 60초 넘기면 거절 · 결투 중 금지");
                }

                foreach (var lang in new[] { "ko", "en" })
                {
                    var ta = Resources.Load<TextAsset>($"Localization/go_{lang}");
                    foreach (var k in new[] { "path.btn", "path.refuse", "path.probe_hit", "path.lead_go", "path.provoke_go", "path.provoke_win", "help.fight.9" })
                        if (ta == null || !ta.text.Contains($"\"{k}\"")) Fail($"{lang} 키 {k} 없음");
                }
            }
            finally
            {
                pa.ResetForTest();
                DuelGate.ResetForTest();
                GoPath.NowFn = now0;
                GoPath.Rng = rng0;
                SaveState.ApplyJson(json0);
                if (fc != null && pc != null) pc.Teleport(fc.SafePoint);
            }
            return _ok;
        }

        private static float Flat(Vector3 a, Vector3 b) => new Vector2(a.x - b.x, a.z - b.z).magnitude;

        private static void Lead(string heroId) => PartyState.Restore(new[] { heroId });

        private static string Pick(GoPath.Act a)
        {
            foreach (var h in GoHeroes.All) if (GoPath.ActOf(h.Might, h.Wisdom, h.Command) == a) return h.Id;
            return null;
        }

        private static void Fail(string why)
        {
            _ok = false;
            Debug.LogError($"[{_tag}] path FAIL - {why}");
        }
    }
}
