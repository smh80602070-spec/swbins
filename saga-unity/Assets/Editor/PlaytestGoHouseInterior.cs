using UnityEngine;
using Saga.Go.Data;
using Saga.Go.World;

namespace Saga.EditorTools
{
    /// <summary>
    /// U-0039 GO 마을집 방 진단 — `PlaytestHeadless` 가 부른다. 방 크기(K-0026 규약 ×2)·입구/출구가 서로 반경 밖(왕복 튕김 없음)·바닥/벽 충돌체·점광·
    /// 포켓이 마을 좌표 밖 · 순간이동 왕복(들어가면 방 안·나오면 밖 복귀 자리)·방 안 저장 위치 치환 · 끝나면 플레이어를 원래 자리로 되돌린다.
    /// 방 GLB(`Resources/World/int_hanok_01`)나 `House_2` 가 없는 PC 는 건너뛴다(방이 안 서는 게 정상).
    /// </summary>
    public static class PlaytestGoHouseInterior
    {
        private static string _tag;
        private static bool _ok;

        public static bool Run(string tag)
        {
            _tag = tag;
            _ok = true;
            string m = "";
            int expected = 0;
            foreach (var (house, room) in GoHouseInterior.Houses)
            {
                if (GameObject.Find(house) == null || Resources.Load<GameObject>(room) == null) continue;   // 집·방 GLB 없는 PC 는 그 집만 건너뛴다
                expected++;
                var gi = GoHouseInterior.All.Find(g => g.HouseName == house);
                if (gi == null) { Fail($"{house} 집과 방 GLB({room})가 있는데 방이 안 섰다"); continue; }
                m += $" [{house}]" + CheckShape(gi) + CheckPocket(gi) + CheckRoundTrip(gi);
            }
            if (expected == 0) { Debug.Log($"[{_tag}] house interior skip - 집 또는 방 GLB 없음"); return _ok; }
            if (GoHouseInterior.All.Count != expected) Fail($"방 {GoHouseInterior.All.Count}개 (기대 {expected})");
            for (int i = 0; i < GoHouseInterior.All.Count; i++)
                for (int j = i + 1; j < GoHouseInterior.All.Count; j++)
                    if (GoHouseInterior.All[i].RoomBounds.Intersects(GoHouseInterior.All[j].RoomBounds)) Fail($"{GoHouseInterior.All[i].HouseName}·{GoHouseInterior.All[j].HouseName} 방이 겹친다");
            if (_ok) Debug.Log($"[{_tag}] house interior OK -{m}");
            return _ok;
        }

        private static string CheckShape(GoHouseInterior gi)
        {
            var b = gi.RoomBounds;
            if (b.size.x < 6f || b.size.x > 22f || b.size.z < 6f || b.size.z > 18f || b.size.y < 3f || b.size.y > 14f)
                Fail($"방 크기 {b.size.x:0.0}×{b.size.z:0.0}×{b.size.y:0.0} 가 규약(소 4×4~대 9×7 의 ×{GoHouseInterior.RoomScale}) 밖");
            if (Flat(gi.LandingIndoor - gi.ExitIndoor) < GoHouseInterior.ExitRadius + 0.5f) Fail($"들어온 자리가 출구에서 {Flat(gi.LandingIndoor - gi.ExitIndoor):0.0}m — 들어오자마자 나간다");
            if (Flat(gi.LandingOutdoor - gi.DoorOutdoor) < GoHouseInterior.EnterRadius + 0.5f) Fail($"나온 자리가 문 앞에서 {Flat(gi.LandingOutdoor - gi.DoorOutdoor):0.0}m — 나오자마자 또 들어간다");
            if (gi.LandingIndoor.x < b.min.x || gi.LandingIndoor.x > b.max.x || gi.LandingIndoor.z < b.min.z || gi.LandingIndoor.z > b.max.z) Fail("들어온 자리가 방 밖");
            if (gi.LightCount < 1) Fail("방에 점광이 없다");
            var colRoot = gi.transform.Find("RoomColliders");
            if (colRoot == null || colRoot.childCount != 5) Fail("바닥·벽 충돌체 5개가 아니다");
            else if (!Physics.Raycast(gi.LandingIndoor + Vector3.up * 3f, Vector3.down, out var hit, 6f, ~0, QueryTriggerInteraction.Ignore) || hit.collider.name != "Floor")
                Fail($"들어온 자리 발밑이 바닥 충돌체가 아니다({(hit.collider != null ? hit.collider.name : "안 맞음")})");
            return $" 방 {b.size.x:0.0}×{b.size.z:0.0}×{b.size.y:0.0}m·점광 {gi.LightCount}";
        }

        private static string CheckPocket(GoHouseInterior gi)
        {
            // 마을 격자(중심 원점, 칸 48m) 가장자리 + 칸 하나 + 여유 — 방이 그 밖에 서야 지형·적과 안 겹친다
            float edgeZ = Mathf.Abs(TestMapData.WorldPos(0f, 0f).z) + TestMapData.TileSize * 2f;
            if (gi.RoomBounds.min.z < edgeZ) Fail($"방이 마을 격자 안쪽에 선다(z {gi.RoomBounds.min.z:0}, 가장자리 {edgeZ:0})");
            if (!Physics.Raycast(gi.LandingOutdoor + Vector3.up * 3f, Vector3.down, 8f, ~0, QueryTriggerInteraction.Ignore)) Fail("나온 자리 밑에 땅이 없다");
            return " 포켓 마을 격자 밖·나온 자리 땅 있음";
        }

        private static string CheckRoundTrip(GoHouseInterior gi)
        {
            var player = GameObject.FindWithTag("Player");
            if (player == null) { Fail("플레이어 없음"); return ""; }
            Vector3 origin = player.transform.position;
            var pc = player.GetComponent<Saga.Go.Player.PlayerController>();
            if (gi.Inside) Fail("시험 시작 때 이미 방 안");
            if ((GoHouseInterior.SavePosition(origin) - origin).sqrMagnitude > 0.0001f) Fail("밖인데 저장 위치가 바뀐다");

            gi.Enter();
            if (!gi.Inside) Fail("Enter 뒤 안에 있지 않다");
            // 방 안 위치가 저장되면 밖 복귀 자리로 치환된다(불러오면 포켓 공간에 떨어지지 않게)
            if ((GoHouseInterior.SavePosition(player.transform.position) - gi.LandingOutdoor).sqrMagnitude > 0.0001f) Fail("방 안 저장 위치가 밖 복귀 자리가 아니다");
            if (Flat(player.transform.position - gi.LandingIndoor) > 0.6f) Fail($"들어온 자리와 {Flat(player.transform.position - gi.LandingIndoor):0.0}m 어긋남");
            gi.Exit();
            if (gi.Inside) Fail("Exit 뒤 아직 안에 있다");
            if (Flat(player.transform.position - gi.LandingOutdoor) > 0.6f) Fail($"나온 자리와 {Flat(player.transform.position - gi.LandingOutdoor):0.0}m 어긋남");

            if (pc != null) pc.Teleport(origin); else player.transform.position = origin;
            return " 순간이동 왕복·방 안 저장 치환";
        }

        private static float Flat(Vector3 v) => new Vector2(v.x, v.z).magnitude;

        private static void Fail(string msg)
        {
            _ok = false;
            Debug.LogError($"[{_tag}] house interior FAIL - {msg}");
        }
    }
}
