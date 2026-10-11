using System;
using System.Linq;
using UnityEngine;
using Saga.Go.Data;
using Saga.Go.World;

namespace Saga.EditorTools
{
    /// <summary>
    /// tasks U-0096 사냥 의뢰(웹 사가만리 W-0101) 진단 — `PlaytestHeadless` 가 사냥 기록 뒤에 부른다(한 프레임 안, 날짜는 주입).
    /// ① 흔적 자리 결정적(두 번 지어도 같음)·전부 놓을 수 있는 땅(물·산·마을·가장자리 아님)·하나 이상 ② 하루 — 셋 읽으면 오늘의 큰 짐승·같은 흔적 두 번 안 셈·
    /// 날이 바뀌면(새벽 4시) 처음부터 ③ 처치 — 다른 보스 무시·맞는 보스 강화석 +2·하루 한 번 ④ 세이브 왕복(날·읽은 흔적·보스·끝)·옛 세이브 = 빈 채
    /// ⑤ 무기 빛 단계 단조 증가·양 끝 색 다름 ⑥ 들판 — 둘레 흔적이 서고 읽으면 사라짐 ⑦ 목표판 줄 ⑧ ko/en. 끝나면 세이브 JSON·날짜 시계를 시작 때로.
    /// </summary>
    public static class PlaytestGoTrack
    {
        private static bool _ok;
        private static string _tag;

        public static bool Run(string tag)
        {
            _ok = true; _tag = tag;
            string json0 = SaveState.ToJson();
            var now0 = GoTrack.NowFn;
            string m = "";
            try
            {
                // ① 자리
                var all = GoTrack.All;
                if (all.Count == 0) Fail("흔적이 하나도 없음");
                foreach (var t in all)
                {
                    bool frost = t.Region == GoFrost.RegionId;
                    if (frost ? !GoTrack.PlaceableFrost(t.Pos) : !GoTrack.Placeable(t.Pos)) { Fail($"{t.Key} 놓을 수 없는 땅"); break; }
                    if (frost != t.Key.StartsWith("f")) { Fail($"{t.Key} 키 접두와 지역이 안 맞음"); break; }
                }
                if (all.Select(t => t.Key).Distinct().Count() != all.Count) Fail("칸 키 겹침");
                // U-0103 — 마을 지도 쪽은 전과 같고(7곳, 앞에 온다), 고원에 12곳 이상·눈밭 바닥(y=0)·명소/곰왕/경계비 거리
                var village = all.Where(t => t.Region != GoFrost.RegionId).ToList();
                var frostAll = all.Where(t => t.Region == GoFrost.RegionId).ToList();
                if (village.Count != 7) Fail($"마을 지도 흔적 {village.Count} ≠ 7(전과 달라짐)");
                if (all.Take(village.Count).Any(t => t.Region == GoFrost.RegionId)) Fail("고원 흔적이 마을 흔적보다 앞에 섬");
                if (frostAll.Count < 12) Fail($"고원 흔적 {frostAll.Count} < 12");
                foreach (var t in frostAll)
                {
                    if (Mathf.Abs(t.Pos.y) > 0.001f) { Fail($"{t.Key} 높이 {t.Pos.y}"); break; }
                    if (t.Kind != GoTrack.Kind.Foot && t.Kind != GoTrack.Kind.Claw) { Fail($"{t.Key} 고원 흔적 종류 {t.Kind}"); break; }
                    if (Vector3.Distance(t.Pos, GoFrost.KingHome) < 20f) { Fail($"{t.Key} 곰왕 곁"); break; }
                }
                m += $" 마을 {village.Count}·고원 {frostAll.Count}곳 ·";
                var h1 = GoTrack.Hash(3, -2, 17); var h2 = GoTrack.Hash(3, -2, 17);
                if (h1 != h2 || h1 < 0f || h1 > 1f) Fail("해시가 결정적이 아님");
                m += $" 흔적 {all.Count}곳(종류 {all.Select(t => t.Kind).Distinct().Count()})";

                // ② 하루
                GoTrack.NowFn = () => new DateTime(2026, 10, 11, 12, 0, 0);
                GoTrack.Restore(null, null, null, 0);
                if (all.Count < 3) Fail("흔적이 셋 미만 — 의뢰를 못 엶");
                else
                {
                    GoTrack.Read(all[0].Key);
                    if (GoTrack.Read(all[0].Key) != null || GoTrack.ReadCount != 1) Fail("같은 흔적을 두 번 셈");
                    GoTrack.Read(all[1].Key);
                    if (GoTrack.Boss != null) Fail("둘째에 벌써 큰 짐승");
                    GoTrack.Read(all[2].Key);
                    if (GoTrack.Boss == null) Fail("셋째에 큰 짐승이 안 정해짐");
                    string boss = GoTrack.Boss;
                    var p = all[2].Pos;
                    string expect = (GoTrack.BossPos(GoTrack.BossFrost) - p).sqrMagnitude < (GoTrack.BossPos(GoTrack.BossGuardian) - p).sqrMagnitude ? GoTrack.BossFrost : GoTrack.BossGuardian;
                    if (boss != expect) Fail($"큰 짐승 {boss} ≠ 가장 가까운 {expect}");
                    string line = GoTrack.Line(p);
                    if (line == null || !line.Contains("m")) Fail($"목표판 줄 {line}");
                    m += $" · 셋 → {GoTrack.BossName(boss)}";

                    // ③ 처치
                    int ore = WeaponState.Ore;
                    if (GoTrack.OnBossDown(boss != GoTrack.BossFrost) != null) Fail("다른 보스로 의뢰가 끝남");
                    if (GoTrack.OnBossDown(boss == GoTrack.BossFrost) == null || WeaponState.Ore != ore + GoTrack.HuntOre || !GoTrack.Done) Fail($"맞는 보스 처치 — 강화석 {WeaponState.Ore - ore}");
                    if (GoTrack.OnBossDown(boss == GoTrack.BossFrost) != null || WeaponState.Ore != ore + GoTrack.HuntOre) Fail("하루 두 번 보상");
                    if (GoTrack.Line(p) != null) Fail("끝난 날에도 목표판 줄이 남음");

                    // ④ 세이브
                    string j = SaveState.ToJson();
                    GoTrack.Restore(null, null, null, 0);
                    SaveState.ApplyJson(j);
                    if (GoTrack.Day != "2026-10-11" || GoTrack.ReadCount != 3 || GoTrack.Boss != boss || !GoTrack.Done) Fail($"세이브 왕복 날 {GoTrack.Day}·읽음 {GoTrack.ReadCount}·보스 {GoTrack.Boss}·끝 {GoTrack.Done}");
                    // 날이 바뀜(새벽 4시 전은 어제)
                    GoTrack.NowFn = () => new DateTime(2026, 10, 12, 3, 30, 0);
                    if (GoTrack.ReadCount != 3) Fail("새벽 4시 전인데 날이 바뀜");
                    GoTrack.NowFn = () => new DateTime(2026, 10, 12, 4, 30, 0);
                    if (GoTrack.ReadCount != 0 || GoTrack.Boss != null || GoTrack.Done) Fail("새 날인데 어제 의뢰가 남음");
                    m += " · 강화석 +2·하루 한 번·세이브·새 날";
                }

                // U-0103 고원 셋 → 곰왕 · 세이브에 고원 키
                if (frostAll.Count >= 3)
                {
                    GoTrack.NowFn = () => new DateTime(2026, 10, 13, 12, 0, 0);
                    GoTrack.Restore(null, null, null, 0);
                    for (int i = 0; i < 3; i++) GoTrack.Read(frostAll[i].Key);
                    if (GoTrack.Boss != GoTrack.BossFrost) Fail($"고원 셋 → 큰 짐승 {GoTrack.Boss} ≠ 곰왕");
                    string j2 = SaveState.ToJson();
                    GoTrack.Restore(null, null, null, 0);
                    SaveState.ApplyJson(j2);
                    if (GoTrack.ReadCount != 3 || !GoTrack.IsRead(frostAll[0].Key) || GoTrack.Boss != GoTrack.BossFrost) Fail("고원 키 세이브 왕복");
                    m += $" · 고원 셋 → {GoTrack.BossName(GoTrack.BossFrost)}";
                }

                // ⑤ 무기 빛
                int prev = -1;
                for (int asc = 0; asc <= GoWeapons.MaxAsc; asc++)
                    for (int lv = 1; lv <= GoWeapons.MaxLv; lv++)
                    {
                        int t = GoTrack.GlowTier(lv, asc);
                        if (t < 0 || t > 11) Fail($"빛 단계 범위 {t}");
                    }
                for (int lv = 1; lv <= GoWeapons.MaxLv; lv++) { int t = GoTrack.GlowTier(lv, 0); if (t < prev) Fail("빛 단계가 줄어듦"); prev = t; }
                if (GoTrack.GlowColor(0) == GoTrack.GlowColor(11)) Fail("빛 양 끝 색이 같음");

                // ⑥ 들판
                var tf = TrackField.Instance;
                if (tf == null) Fail("TrackField 없음(WorldMapBuilder)");
                else if (all.Count > 0)
                {
                    GoTrack.Restore(null, null, null, 0);
                    tf.Tick(all[0].Pos);
                    int shown = tf.ShownCount;
                    if (shown == 0) Fail("흔적 곁인데 아무것도 안 섬");
                    tf.ReadAt(all[0].Key);
                    if (tf.ShownCount != shown - 1) Fail($"읽은 흔적이 안 사라짐 {shown}→{tf.ShownCount}");
                    if (GoTrack.Line(all[0].Pos) == null) Fail("하나 읽었는데 목표판 줄 없음");
                    m += $" · 들판 둘레 {shown}개·읽으면 사라짐";
                    if (frostAll.Count > 0)
                    {
                        GoTrack.Restore(null, null, null, 0);
                        tf.Tick(frostAll[0].Pos);
                        if (tf.ShownCount == 0) Fail("고원 흔적 곁인데 아무것도 안 섬");
                        m += $" · 고원 둘레 {tf.ShownCount}개";
                    }
                }

                // ⑧ ko/en
                foreach (var lang in new[] { "ko", "en" })
                {
                    var ta = Resources.Load<TextAsset>($"Localization/go_{lang}");
                    foreach (var k in new[] { "track.read", "track.hunt", "track.done", "track.line_hunt", "track.line_read", "track.hint", "track.boss_guardian", "track.boss_frost" })
                        if (ta == null || !ta.text.Contains($"\"{k}\"")) Fail($"{lang} 키 {k} 없음");
                }
            }
            finally
            {
                GoTrack.NowFn = now0;
                SaveState.ApplyJson(json0);
                TrackField.Instance?.Tick(Vector3.zero);
            }
            if (_ok) Debug.Log($"[{_tag}] track OK - 흔적 결정적·놓을 땅 · 셋 → 오늘의 큰 짐승(가장 가까운 보스) · 두 번 안 셈 · 처치 강화석 +2·하루 한 번 · 세이브·새벽 4시 · 무기 빛 단계 · 들판 세움·사라짐 · ko/en |{m}");
            return _ok;
        }

        private static void Fail(string why)
        {
            _ok = false;
            Debug.LogError($"[{_tag}] track FAIL - {why}");
        }
    }
}
