using UnityEngine;
using Saga.Go.Combat;
using Saga.Go.Data;
using Saga.Go.Player;

namespace Saga.Go.World
{
    /// <summary>
    /// PLAN.md 109-14-65 열째 지역 세갈래 고을(웹 ⑲-65 `fork.js`·Godot `region10_fork.gd`) 도형 — 틈이 처음 찢어지던 순간째 굳은 옛 고을.
    /// 명소 일곱(성문·세갈래 길목·대장간·선로 공사장·멈춘 증기 기관차·종루·고을 신상)·작은 발견 열 + 격자 말뚝 둘·호박 장막(발견 아님, 이야기·벽 자리).
    /// 이야기가 바꾸는 부분(격자 말뚝 셋의 빛 틀·멈춘 별까마귀·하늘 틈과 호박 알갱이·호박 장막)은 `RefreshFork` 가 `GoStory.Fork*` 상태에 맞춰 켜고 끈다(36~38장은 뒤 조각 — 그 전엔 굳은 채).
    /// </summary>
    public partial class AreaField
    {
        /// <summary>격자 말뚝 하나 — 밑동 돌(1.4m 벽) + 6m 빛 틀. 이야기가 끄면(그룹을 끔) 틀만이 아니라 밑동 충돌도 함께 사라진다.</summary>
        private GameObject ForkLattice(Transform parent, string key, string name, Vector3 local)
        {
            var g = new GameObject(name);
            g.transform.SetParent(parent, false);
            g.transform.localPosition = local;
            var stone = Mat("f_stone", new Color(0.5f, 0.48f, 0.5f));
            var glow = Mat("f_glow", new Color(0.75f, 0.55f, 1f), 2.4f);
            P(PrimitiveType.Cube, g.transform, "Lat_base", new Vector3(0f, 0.7f, 0f), new Vector3(1.4f, 1.4f, 1.4f), stone, true);
            foreach (float x in new[] { -0.6f, 0.6f })
                foreach (float z in new[] { -0.6f, 0.6f })
                    P(PrimitiveType.Cube, g.transform, "Lat_post", new Vector3(x, 1.4f + ForkFrame() * 0.5f, z), new Vector3(0.1f, ForkFrame(), 0.1f), glow, false);
            P(PrimitiveType.Cube, g.transform, "Lat_cap", new Vector3(0f, 1.4f + ForkFrame(), 0f), new Vector3(1.4f, 0.1f, 1.4f), glow, false);
            _parts[key] = g;
            return g;
        }

        private static float ForkFrame() => GoStory.ForkLatticeH - 1.4f;

        /// <summary>땅 전체에 걸린 것 — 격자 말뚝 둘(땅)·호박 장막(서리봉 쪽 고개, 순간이 풀리면 걷힘).</summary>
        private void BuildForkExtras(Transform parent, GoAreas.Area a)
        {
            a.TrySite("lat0", out var l0);
            a.TrySite("lat1", out var l1);
            ForkLattice(parent, "fork:lat0", "Fork_lattice0", l0.Pos);
            ForkLattice(parent, "fork:lat1", "Fork_lattice1", l1.Pos);
            // 호박 장막 — 성문 남쪽 97m 가로 48m(보기만 — 이 판은 독립 땅이라 벽이 아니라 자리 표지)
            var veil = new GameObject("Fork_veil");
            veil.transform.SetParent(parent, false);
            veil.transform.position = a.Center + new Vector3(0f, 0f, 97.2f);
            var amber = Mat("f_amber", new Color(1f, 0.68f, 0.22f), 1.2f, 0.6f);
            var sheet = P(PrimitiveType.Cube, veil.transform, "Veil_sheet", new Vector3(0f, 7f, 0f), new Vector3(48f, 14f, 0.2f), Ghost("f_veil", new Color(1f, 0.68f, 0.22f, 0.35f)), false);
            sheet.GetComponent<MeshRenderer>().shadowCastingMode = UnityEngine.Rendering.ShadowCastingMode.Off;
            foreach (float x in new[] { -24f, 24f }) P(PrimitiveType.Cube, veil.transform, "Veil_post", new Vector3(x, 7f, 0f), new Vector3(0.6f, 14f, 0.6f), amber, false);
            _parts["fork:veil"] = veil;
        }

        private void BuildForkSite(Transform t, string id)
        {
            var stone = Mat("f_stone", new Color(0.5f, 0.48f, 0.5f));
            var dark = Mat("f_dark", new Color(0.16f, 0.15f, 0.2f));
            var wood = Mat("f_wood", new Color(0.42f, 0.28f, 0.17f));
            var brick = Mat("f_brick", new Color(0.55f, 0.32f, 0.26f));
            var iron = Mat("f_iron", new Color(0.3f, 0.32f, 0.36f), 0f, 0.6f, 0.6f);
            var steel = Mat("f_steel", new Color(0.62f, 0.65f, 0.68f), 0f, 0.6f, 0.5f);
            var glow = Mat("f_glow", new Color(0.75f, 0.55f, 1f), 2.4f);
            var amber = Mat("f_amber", new Color(1f, 0.68f, 0.22f), 1.2f, 0.6f);
            var glassAmber = Ghost("f_glass", new Color(1f, 0.68f, 0.22f, 0.45f));
            var cloth = Mat("f_cloth", new Color(0.78f, 0.7f, 0.52f));
            var red = Mat("f_red", new Color(0.75f, 0.2f, 0.15f));
            var yellow = Mat("f_yellow", new Color(0.95f, 0.72f, 0.15f));
            switch (id)
            {
                case "gate": // 고을 성문 — 문루 둘 3×6×3(가운데 5m 는 열림) + 짧은 성벽 둘 + 장승 둘
                    foreach (float x in new[] { -4f, 4f })
                    {
                        var tw = P(PrimitiveType.Cube, t, "Gate_tower", new Vector3(x, 3f, 0f), new Vector3(3f, 6f, 3f), stone, true);
                        tw.AddComponent<NoClimb>();
                        P(PrimitiveType.Cube, t, "Gate_tower_roof", new Vector3(x, 6.4f, 0f), new Vector3(4f, 0.8f, 4f), dark, false);
                    }
                    foreach (float x in new[] { -11.5f, 11.5f })
                    {
                        var w = P(PrimitiveType.Cube, t, "Gate_wall", new Vector3(x, 2f, 0f), new Vector3(12f, 4f, 1.4f), stone, true);
                        w.AddComponent<NoClimb>();
                    }
                    foreach (float x in new[] { -2f, 2f })
                    {
                        P(PrimitiveType.Cylinder, t, "Gate_jangseung", new Vector3(x, 1.8f, 3.5f), new Vector3(0.5f, 1.8f, 0.5f), wood, false);
                        P(PrimitiveType.Sphere, t, "Gate_jangseung_head", new Vector3(x, 3.9f, 3.5f), Vector3.one * 0.8f, wood, false);
                    }
                    break;
                case "junction": // 세갈래 길목 — 이정표 + 머리 위 하늘 틈(y42) + 멈춘 별까마귀(y20)
                {
                    P(PrimitiveType.Cylinder, t, "Junction_pole", new Vector3(0f, 1.6f, 0f), new Vector3(0.2f, 1.6f, 0.2f), wood, false);
                    for (int i = 0; i < 3; i++) P(PrimitiveType.Cube, t, "Junction_board", new Vector3(0.5f, 2.6f - i * 0.5f, 0f), new Vector3(1.4f, 0.3f, 0.06f), wood, false, new Vector3(0f, i * 40f - 40f, 0f));
                    var rift = new GameObject("Junction_rift");
                    rift.transform.SetParent(t, false);
                    for (int i = 0; i < 5; i++) // 보랏빛 금 다섯 마디
                        P(PrimitiveType.Cube, rift.transform, "Rift_seg", new Vector3((i - 2) * 4.5f, GoStory.ForkRiftY + (i % 2) * 2f, 0f), new Vector3(0.35f, 5f, 0.35f), glow, false, new Vector3(0f, 0f, (i % 2 == 0 ? 1f : -1f) * 25f));
                    var rng = new System.Random(65);
                    for (int i = 0; i < GoStory.ForkSpecks; i++) // 공중에 멈춘 호박 알갱이 48
                        P(PrimitiveType.Cube, rift.transform, "Rift_speck", new Vector3((float)(rng.NextDouble() * 2 - 1) * 45f, 4f + (float)rng.NextDouble() * 34f, (float)(rng.NextDouble() * 2 - 1) * 45f), Vector3.one * 0.35f, amber, false, new Vector3(i * 17f, i * 31f, 0f));
                    _parts["fork:rift"] = rift;
                    var crow = new GameObject("Junction_crow");
                    crow.transform.SetParent(t, false);
                    P(PrimitiveType.Sphere, crow.transform, "Crow_body", new Vector3(0f, GoStory.ForkCrowY, 0f), new Vector3(2.4f, 1.4f, 3.4f), dark, false);
                    foreach (float s in new[] { -1f, 1f }) P(PrimitiveType.Cube, crow.transform, "Crow_wing", new Vector3(s * 3.2f, GoStory.ForkCrowY + 0.6f, 0f), new Vector3(4.6f, 0.12f, 2.2f), dark, false, new Vector3(0f, s * 12f, s * -18f));
                    var shell = P(PrimitiveType.Sphere, crow.transform, "Crow_shell", new Vector3(0f, GoStory.ForkCrowY, 0f), new Vector3(9f, 5.5f, 9f), glassAmber, false);
                    shell.GetComponent<MeshRenderer>().shadowCastingMode = UnityEngine.Rendering.ShadowCastingMode.Off;
                    _parts["fork:crow"] = crow;
                    break;
                }
                case "forge": // 대장간 — 6×4×5 벽돌집 + 굴뚝 + 멈춘 화덕 불꽃 + 모루
                    P(PrimitiveType.Cube, t, "Forge_body", new Vector3(0f, 2f, 0f), new Vector3(6f, 4f, 5f), brick, true);
                    P(PrimitiveType.Cube, t, "Forge_roof", new Vector3(0f, 4.3f, 0f), new Vector3(6.6f, 0.6f, 5.6f), dark, false);
                    P(PrimitiveType.Cube, t, "Forge_chimney", new Vector3(2f, 6f, -1.5f), new Vector3(0.9f, 3.4f, 0.9f), brick, false);
                    P(PrimitiveType.Sphere, t, "Forge_flame", new Vector3(3.15f, 1.3f, 0f), new Vector3(0.6f, 1f, 0.6f), Mat("f_flame", new Color(1f, 0.55f, 0.15f), 2.2f), false);
                    P(PrimitiveType.Cube, t, "Forge_anvil", new Vector3(4.6f, 0.5f, 1.4f), new Vector3(0.6f, 0.5f, 1.1f), iron, false);
                    break;
                case "works": // 선로 공사장 — 천막 둘 + 공구 상자
                    foreach (float x in new[] { -4f, 3f })
                    {
                        P(PrimitiveType.Cube, t, "Works_tent_a", new Vector3(x - 0.9f, 1.6f, 0f), new Vector3(0.12f, 3.4f, 3.6f), cloth, false, new Vector3(0f, 0f, 22f));
                        P(PrimitiveType.Cube, t, "Works_tent_b", new Vector3(x + 0.9f, 1.6f, 0f), new Vector3(0.12f, 3.4f, 3.6f), cloth, false, new Vector3(0f, 0f, -22f));
                    }
                    for (int i = 0; i < 3; i++) P(PrimitiveType.Cube, t, "Works_toolbox", new Vector3(-1f + i * 1.2f, 0.4f, 3f), new Vector3(1f, 0.8f, 0.7f), i == 1 ? red : yellow, false, new Vector3(0f, i * 15f, 0f));
                    break;
                case "loco": // 멈춘 증기 기관차 — 8×3.6×3 몸통 + 굴뚝 + 바퀴 + 선로 140m + 멈춘 김
                    for (int i = -15; i <= 15; i++) P(PrimitiveType.Cube, t, "Loco_sleeper", new Vector3(i * 4.6f, 0.05f, 0f), new Vector3(0.4f, 0.1f, 2.6f), wood, false);
                    foreach (float z in new[] { -0.9f, 0.9f }) P(PrimitiveType.Cube, t, "Loco_rail", new Vector3(0f, 0.2f, z), new Vector3(140f, 0.15f, 0.2f), iron, false);
                    P(PrimitiveType.Cube, t, "Loco_body", new Vector3(0f, 2.1f, 0f), new Vector3(8f, 3.6f, 3f), Mat("f_loco", new Color(0.18f, 0.2f, 0.24f)), true);
                    P(PrimitiveType.Cylinder, t, "Loco_boiler", new Vector3(2.4f, 2.6f, 0f), new Vector3(2.4f, 2.4f, 2.4f), iron, false, new Vector3(0f, 0f, 90f));
                    P(PrimitiveType.Cylinder, t, "Loco_chimney", new Vector3(3.6f, 5.2f, 0f), new Vector3(0.9f, 0.9f, 0.9f), iron, false);
                    for (int i = 0; i < 3; i++) foreach (float z in new[] { -1.55f, 1.55f }) P(PrimitiveType.Cylinder, t, "Loco_wheel", new Vector3(-2.5f + i * 2.4f, 0.8f, z), new Vector3(1.4f, 0.12f, 1.4f), steel, false, new Vector3(90f, 0f, 0f));
                    P(PrimitiveType.Sphere, t, "Loco_steam", new Vector3(3.6f, 7.6f, 0f), new Vector3(3f, 2.4f, 3f), Ghost("f_steam", new Color(0.95f, 0.95f, 1f, 0.4f)), false);
                    break;
                case "tower": // 종루 — 5×10×5 벽 타기 기둥(윗면 5m 네모) + 멈춘 종 + 셋째 격자 말뚝(윗면)
                    P(PrimitiveType.Cube, t, "Tower_core", new Vector3(0f, GoStory.ForkTowerH * 0.5f, 0f), new Vector3(GoStory.ForkTowerW, GoStory.ForkTowerH, GoStory.ForkTowerW), stone, true);
                    P(PrimitiveType.Cube, t, "Tower_band", new Vector3(0f, 6f, 0f), new Vector3(GoStory.ForkTowerW + 0.2f, 0.3f, GoStory.ForkTowerW + 0.2f), dark, false);
                    P(PrimitiveType.Sphere, t, "Tower_bell", new Vector3(0f, 7.6f, GoStory.ForkTowerW * 0.5f + 0.6f), new Vector3(1.4f, 1.6f, 1.4f), Mat("f_bell", new Color(0.7f, 0.5f, 0.2f), 0f, 0.5f, 0.6f), false);
                    P(PrimitiveType.Cube, t, "Tower_bell_arm", new Vector3(0f, 8.7f, GoStory.ForkTowerW * 0.5f + 0.3f), new Vector3(0.2f, 0.2f, 1.4f), dark, false);
                    ForkLattice(t, "fork:lat2", "Fork_lattice2", new Vector3(0f, GoStory.ForkTowerH, 0f)).transform.localScale = Vector3.one;
                    break;
                case "statue": // 고을 신상 — 받침 + 도포 입은 몸 + 머리 + 창(이동 지점)
                    P(PrimitiveType.Cube, t, "Statue_base", new Vector3(0f, 0.5f, 0f), new Vector3(3.2f, 1f, 3.2f), stone, true);
                    P(PrimitiveType.Cylinder, t, "Statue_body", new Vector3(0f, 2.5f, 0f), new Vector3(1.2f, 1.5f, 1.2f), stone, false);
                    P(PrimitiveType.Sphere, t, "Statue_head", new Vector3(0f, 4.4f, 0f), Vector3.one * 0.8f, stone, false);
                    P(PrimitiveType.Cylinder, t, "Statue_spear", new Vector3(0.9f, 3.2f, 0f), new Vector3(0.1f, 2.6f, 0.1f), wood, false);
                    break;
                case "well": // 고을 우물
                    P(PrimitiveType.Cylinder, t, "Well_ring", new Vector3(0f, 0.5f, 0f), new Vector3(2f, 0.5f, 2f), stone, true);
                    P(PrimitiveType.Cube, t, "Well_beam", new Vector3(0f, 2.2f, 0f), new Vector3(0.15f, 0.15f, 2.4f), wood, false);
                    P(PrimitiveType.Cylinder, t, "Well_bucket", new Vector3(0f, 1.6f, 1.1f), new Vector3(0.5f, 0.3f, 0.5f), wood, false);
                    break;
                case "laundry": // 멈춘 빨래
                    P(PrimitiveType.Cube, t, "Laundry_line", new Vector3(0f, 2.4f, 0f), new Vector3(4f, 0.05f, 0.05f), wood, false);
                    foreach (float x in new[] { -2f, 2f }) P(PrimitiveType.Cylinder, t, "Laundry_pole", new Vector3(x, 1.2f, 0f), new Vector3(0.1f, 1.2f, 0.1f), wood, false);
                    for (int i = 0; i < 3; i++) P(PrimitiveType.Cube, t, "Laundry_cloth", new Vector3(-1.2f + i * 1.2f, 1.9f, 0f), new Vector3(0.8f, 1f, 0.05f), i == 1 ? red : cloth, false, new Vector3(0f, 0f, 8f - i * 8f));
                    break;
                case "kite": // 공중에 멈춘 방패연 — 9m 높이
                    P(PrimitiveType.Cube, t, "Kite_body", new Vector3(0f, 9f, 0f), new Vector3(1.5f, 1.2f, 0.05f), red, false, new Vector3(0f, 25f, 15f));
                    P(PrimitiveType.Cube, t, "Kite_tail", new Vector3(0.4f, 7.6f, 0f), new Vector3(0.08f, 1.6f, 0.04f), cloth, false, new Vector3(0f, 0f, 20f));
                    Lump(t, "Kite_amber", new Vector3(0f, 9f, 0f), new Vector3(2.4f, 2f, 1.2f));
                    break;
                case "tripod": // 측량 삼각대
                    for (int i = 0; i < 3; i++) { float a = i * 2.094f; P(PrimitiveType.Cylinder, t, "Tripod_leg", new Vector3(Mathf.Cos(a) * 0.4f, 0.8f, Mathf.Sin(a) * 0.4f), new Vector3(0.07f, 0.85f, 0.07f), iron, false, new Vector3(Mathf.Sin(a) * 14f, 0f, -Mathf.Cos(a) * 14f)); }
                    P(PrimitiveType.Cube, t, "Tripod_scope", new Vector3(0f, 1.7f, 0f), new Vector3(0.3f, 0.3f, 0.6f), yellow, false);
                    break;
                case "rails": // 깔다 만 레일 더미
                    for (int i = 0; i < 4; i++) P(PrimitiveType.Cube, t, "Rails_rail", new Vector3(-0.4f + (i % 2) * 0.8f, 0.2f + (i / 2) * 0.3f, 0f), new Vector3(0.2f, 0.15f, 4.5f), iron, false);
                    break;
                case "flag": // 측량 깃발
                    P(PrimitiveType.Cylinder, t, "Flag_pole", new Vector3(0f, 1.2f, 0f), new Vector3(0.06f, 1.2f, 0.06f), wood, false);
                    P(PrimitiveType.Cube, t, "Flag_cloth", new Vector3(0.4f, 2.1f, 0f), new Vector3(0.8f, 0.5f, 0.03f), red, false);
                    break;
                case "dronedn": // 떨어진 보관 드론
                    P(PrimitiveType.Sphere, t, "Down_body", new Vector3(0f, 0.6f, 0f), new Vector3(1.2f, 0.7f, 1.2f), steel, false, new Vector3(0f, 0f, 16f));
                    P(PrimitiveType.Cube, t, "Down_box", new Vector3(0.9f, 0.3f, 0.6f), new Vector3(0.7f, 0.5f, 0.7f), cloth, false, new Vector3(0f, 30f, 0f));
                    break;
                case "shard": // 부러진 격자 조각
                    for (int i = 0; i < 3; i++) P(PrimitiveType.Cube, t, "Shard", new Vector3(-0.7f + i * 0.7f, 0.5f, (i % 2) * 0.4f), new Vector3(0.1f, 1f + i * 0.3f, 0.1f), glow, false, new Vector3(20f * i, i * 30f, 30f - i * 20f));
                    break;
                case "rain": // 떨어지다 멈춘 빗방울
                {
                    var rng = new System.Random(9);
                    for (int i = 0; i < 10; i++) P(PrimitiveType.Sphere, t, "Rain_drop", new Vector3((float)(rng.NextDouble() * 2 - 1) * 2f, 0.6f + (float)rng.NextDouble() * 3f, (float)(rng.NextDouble() * 2 - 1) * 2f), new Vector3(0.12f, 0.3f, 0.12f), Ghost("f_rain", new Color(0.6f, 0.8f, 1f, 0.6f)), false);
                    break;
                }
                case "birds": // 날아오르다 멈춘 새 떼 — 호박 속
                    for (int i = 0; i < 5; i++) P(PrimitiveType.Sphere, t, "Bird", new Vector3(-1.4f + i * 0.7f, 2.2f + (i % 3) * 0.5f, (i % 2) * 0.6f), new Vector3(0.3f, 0.2f, 0.45f), dark, false);
                    Lump(t, "Birds_amber", new Vector3(0f, 2.6f, 0.3f), new Vector3(4.2f, 2.2f, 2f));
                    break;
            }
        }

        /// <summary>이야기 진행에 맞춰 격자 말뚝 빛 틀·별까마귀·하늘 틈과 알갱이·호박 장막을 바꾼다(`Refresh` 가 부른다). `OffForTest` 면 진행 전(굳은 채)으로 본다.</summary>
        private void RefreshFork()
        {
            bool live = !StoryState.OffForTest;
            for (int k = 0; k < 3; k++) SetPart("fork:lat" + k, !(live && GoStory.ForkLatticeOff(k)));
            SetPart("fork:crow", !live || GoStory.ForkCrowFrozen);
            bool free = live && GoStory.ForkMomentFree;
            SetPart("fork:rift", !free);
            SetPart("fork:veil", !free);
        }

        public bool ForkPartOn(string key) => AmberPartOn(key);
    }
}
