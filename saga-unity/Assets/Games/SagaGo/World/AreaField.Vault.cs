using System.Collections.Generic;
using UnityEngine;
using Saga.Go.Combat;
using Saga.Go.Data;
using Saga.Go.Player;

namespace Saga.Go.World
{
    /// <summary>
    /// PLAN.md 109-14-61 아홉째 지역 갈무리 벌(웹 ⑲-61 `vault.js`·Godot `region9_vault.gd`) 도형 — 세 시대가 저마다 쌓아 두던 벌판이 한데 붙은 곳.
    /// 명소 일곱(고개 어귀·시간 씨앗 금고·동력 기둥 둘·곳간 마을·물류 야적장·벌 신상) + 작은 발견 열 + 운반 드론 셋(보기만). 이야기가 바꾸는 부분(곳간 문·동력 기둥 빛 알·금고 남쪽 문·갈무리의 핵·해미 진열장·가장 깊은 진열장)은
    /// `RefreshVault` 가 `GoStory.Vault*` 상태에 맞춰 켜고 끈다(33~35장·11부는 뒤 조각 — 그 전엔 닫힌 채).
    /// </summary>
    public partial class AreaField
    {
        private struct VaultDrone { public Transform T; public Vector3 A, B; public float Phase; }
        private readonly List<VaultDrone> _vaultDrones = new List<VaultDrone>();
        private float _vaultT;

        private static Vector3 VaultRing(float deg, float r) { float a = deg * Mathf.Deg2Rad; return new Vector3(-Mathf.Sin(a) * r, 0f, Mathf.Cos(a) * r); }

        /// <summary>진열장 하나 — 받침 + 속 물건 + 유리(보기만).</summary>
        private void VaultCase(Transform parent, string name, Vector3 local, string shape, Material alloy, Material glass, Material glow)
        {
            var c = new GameObject(name);
            c.transform.SetParent(parent, false);
            c.transform.localPosition = local;
            P(PrimitiveType.Cylinder, c.transform, "Case_base", new Vector3(0f, 0.4f, 0f), new Vector3(1.6f, 0.4f, 1.6f), alloy, false);
            var wood = Mat("v_wood", new Color(0.45f, 0.3f, 0.18f));
            switch (shape)
            {
                case "feast": // 청하 잔치 — 상 + 그릇 셋
                    P(PrimitiveType.Cube, c.transform, "Case_table", new Vector3(0f, 1.0f, 0f), new Vector3(1.1f, 0.12f, 0.7f), wood, false);
                    for (int i = 0; i < 3; i++) P(PrimitiveType.Sphere, c.transform, "Case_bowl", new Vector3(-0.3f + i * 0.3f, 1.15f, 0f), Vector3.one * 0.2f, Mat("v_bowl" + i, i == 0 ? new Color(0.85f, 0.3f, 0.2f) : i == 1 ? new Color(0.9f, 0.75f, 0.3f) : new Color(0.4f, 0.6f, 0.3f)), false);
                    break;
                case "ship": // 별배가 떨어지던 밤 — 기운 배
                    P(PrimitiveType.Sphere, c.transform, "Case_ship", new Vector3(0f, 1.3f, 0f), new Vector3(0.5f, 0.35f, 1.2f), Mat("v_ship", new Color(0.7f, 0.74f, 0.8f), 0f, 0.6f, 0.5f), false, new Vector3(20f, 0f, 12f));
                    P(PrimitiveType.Cube, c.transform, "Case_fin", new Vector3(0f, 1.6f, -0.4f), new Vector3(0.06f, 0.4f, 0.4f), glow, false, new Vector3(20f, 0f, 12f));
                    break;
                case "train": // 막차가 떠나던 역 — 객차
                    P(PrimitiveType.Cube, c.transform, "Case_car", new Vector3(0f, 1.1f, 0f), new Vector3(0.5f, 0.4f, 1.3f), Mat("v_car", new Color(0.82f, 0.84f, 0.86f)), false);
                    P(PrimitiveType.Cube, c.transform, "Case_stripe", new Vector3(0f, 1.0f, 0f), new Vector3(0.52f, 0.1f, 1.32f), Mat("v_car_stripe", new Color(0.2f, 0.45f, 0.7f)), false);
                    break;
                case "palace": // 잠기던 궁궐 — 기와 지붕 집
                    P(PrimitiveType.Cube, c.transform, "Case_hall", new Vector3(0f, 1.05f, 0f), new Vector3(0.9f, 0.4f, 0.7f), Mat("v_rust", new Color(0.42f, 0.27f, 0.18f)), false);
                    P(PrimitiveType.Cube, c.transform, "Case_roof", new Vector3(0f, 1.35f, 0f), new Vector3(1.1f, 0.15f, 0.9f), Mat("v_dark", new Color(0.13f, 0.16f, 0.2f)), false);
                    break;
                case "signal": // 굳은 네거리 — 신호등 + 호박
                    P(PrimitiveType.Cylinder, c.transform, "Case_pole", new Vector3(0f, 1.3f, 0f), new Vector3(0.08f, 0.8f, 0.08f), Mat("v_steel_dark", new Color(0.28f, 0.3f, 0.33f)), false);
                    P(PrimitiveType.Sphere, c.transform, "Case_lamp", new Vector3(0f, 2.05f, 0f), Vector3.one * 0.22f, Mat("v_lamp_red", new Color(0.9f, 0.2f, 0.15f), 1.6f), false);
                    break;
                case "deep": // 가장 깊은 진열장 — 속은 비어 있고 순간 구슬만(금고 도형이 따로 얹는다)
                    break;
                default: // haemi — 해미
                    P(PrimitiveType.Capsule, c.transform, "Case_person", new Vector3(0f, 1.3f, 0f), new Vector3(0.4f, 0.55f, 0.4f), Mat("v_person", new Color(0.35f, 0.5f, 0.42f)), false);
                    break;
            }
            P(PrimitiveType.Cube, c.transform, "Case_glass", new Vector3(0f, 1.5f, 0f), new Vector3(1.5f, 1.9f, 1.5f), glass, false);
        }

        private void BuildVaultSite(Transform t, string id)
        {
            var alloy = Mat("v_alloy", new Color(0.84f, 0.88f, 0.93f), 0f, 0.6f, 0.4f);
            var steel = Mat("v_steel", new Color(0.6f, 0.64f, 0.68f), 0f, 0.6f, 0.5f);
            var steelDark = Mat("v_steel_dark", new Color(0.28f, 0.3f, 0.33f));
            var glow = Mat("v_glow", new Color(0.45f, 0.85f, 1f), 2f);
            var seed = Mat("v_seed", new Color(0.55f, 1f, 0.6f), 1.8f);
            var wood = Mat("v_wood", new Color(0.45f, 0.3f, 0.18f));
            var thatch = Mat("v_thatch", new Color(0.72f, 0.6f, 0.34f));
            var stone = Mat("v_stone", new Color(0.52f, 0.5f, 0.47f));
            var concrete = Mat("v_concrete", new Color(0.62f, 0.62f, 0.6f));
            var rust = Mat("v_rust", new Color(0.62f, 0.34f, 0.2f));
            var glass = Ghost("v_glass", new Color(0.6f, 0.9f, 1f, 0.22f));
            var yellow = Mat("v_yellow", new Color(0.95f, 0.72f, 0.15f));
            var red = Mat("v_red", new Color(0.7f, 0.2f, 0.15f));
            switch (id)
            {
                case "pass": // 갈무리 벌 어귀 — 장승 둘 + 빛 울타리 기둥(열린 뒤엔 옅은 테만)
                    foreach (float z in new[] { -6f, 6f })
                    {
                        P(PrimitiveType.Cylinder, t, "Pass_jangseung", new Vector3(0f, 2f, z), new Vector3(0.6f, 2f, 0.6f), wood, true);
                        P(PrimitiveType.Sphere, t, "Pass_jangseung_head", new Vector3(0f, 4.3f, z), new Vector3(0.9f, 0.9f, 0.9f), wood, false);
                        P(PrimitiveType.Cube, t, "Pass_jangseung_band", new Vector3(0f, 3.4f, z), new Vector3(0.7f, 0.15f, 0.7f), Mat("v_band", new Color(0.75f, 0.15f, 0.1f)), false);
                    }
                    for (int i = -3; i <= 3; i++) P(PrimitiveType.Cube, t, "Pass_fence_post", new Vector3(0f, 1.5f, i * 8f), new Vector3(0.25f, 3f, 0.25f), glow, false);
                    break;
                case "vault": // 시간 씨앗 금고 — 열여섯 조각 둥근 벽(남쪽 한 조각이 문) + 지붕 + 반투명 돔 + 진열장 + 기록 기둥·핵
                {
                    float segW = 2f * GoStory.VaultR * Mathf.Sin(Mathf.PI / GoStory.VaultSegs) + 0.5f;
                    for (int i = 0; i < GoStory.VaultSegs; i++)
                    {
                        float ang = i * 360f / GoStory.VaultSegs;
                        Vector3 p = VaultRing(ang, GoStory.VaultR);
                        var seg = new GameObject(i == 0 ? "Vault_door" : "Vault_wall");
                        seg.transform.SetParent(t, false);
                        seg.transform.localPosition = p;
                        seg.transform.localRotation = Quaternion.Euler(0f, -ang, 0f);
                        if (i == 0)
                        {
                            var door = P(PrimitiveType.Cube, seg.transform, "Door_slab", new Vector3(0f, GoStory.VaultH * 0.5f, 0f), new Vector3(GoStory.VaultDoorW, GoStory.VaultH, 0.7f), steel, true);
                            door.AddComponent<NoClimb>();
                            P(PrimitiveType.Cube, seg.transform, "Door_ring", new Vector3(0f, 3.5f, 0.05f), new Vector3(GoStory.VaultDoorW * 0.7f, 0.2f, 0.75f), glow, false);
                            _parts["vault:door"] = seg;
                            // 문 옆 벽 — 문 폭을 뺀 나머지
                            float side = (segW - GoStory.VaultDoorW) * 0.5f;
                            if (side > 0.05f)
                                foreach (float sx in new[] { -1f, 1f })
                                {
                                    var s2 = P(PrimitiveType.Cube, t, "Vault_wall_side", p + new Vector3(0f, GoStory.VaultH * 0.5f, 0f) + Quaternion.Euler(0f, -ang, 0f) * new Vector3(sx * (GoStory.VaultDoorW * 0.5f + side * 0.5f), 0f, 0f), new Vector3(side, GoStory.VaultH, 0.7f), alloy, true, new Vector3(0f, -ang, 0f));
                                    s2.AddComponent<NoClimb>();
                                }
                            continue;
                        }
                        var w = P(PrimitiveType.Cube, seg.transform, "Wall_slab", new Vector3(0f, GoStory.VaultH * 0.5f, 0f), new Vector3(segW, GoStory.VaultH, 0.7f), alloy, true);
                        w.AddComponent<NoClimb>();
                        P(PrimitiveType.Cube, seg.transform, "Wall_band", new Vector3(0f, GoStory.VaultH - 1f, 0f), new Vector3(segW, 0.25f, 0.75f), glow, false);
                    }
                    var roof = P(PrimitiveType.Cylinder, t, "Vault_roof", new Vector3(0f, GoStory.VaultH + 0.25f, 0f), new Vector3((GoStory.VaultR + 0.3f) * 2f, 0.25f, (GoStory.VaultR + 0.3f) * 2f), alloy, true);
                    roof.AddComponent<NoClimb>();
                    var dome = P(PrimitiveType.Sphere, t, "Vault_dome", new Vector3(0f, GoStory.VaultH + 0.5f, 0f), Vector3.one * GoStory.VaultR * 1.6f, glass, false);
                    dome.GetComponent<MeshRenderer>().shadowCastingMode = UnityEngine.Rendering.ShadowCastingMode.Off;
                    P(PrimitiveType.Cylinder, t, "Vault_floor", new Vector3(0f, 0.05f, 0f), new Vector3(GoStory.VaultR * 2f - 1f, 0.05f, GoStory.VaultR * 2f - 1f), concrete, false);
                    // 진열장 다섯 + 해미 진열장 + 가장 깊은 진열장
                    var caseDeg = new[] { 60f, 120f, 240f, 300f, 210f };
                    var caseShape = new[] { "feast", "ship", "train", "palace", "signal" };
                    for (int i = 0; i < 5; i++) VaultCase(t, "Vault_case" + i, VaultRing(caseDeg[i], GoStory.VaultCaseR), caseShape[i], alloy, glass, glow);
                    var haemi = new GameObject("Vault_haemi");
                    haemi.transform.SetParent(t, false);
                    VaultCase(haemi.transform, "Haemi_case", VaultRing(GoStory.VaultHaemiDeg, GoStory.VaultCaseR), "haemi", alloy, glass, glow);
                    _parts["vault:haemi"] = haemi;
                    var deep = new GameObject("Vault_deep");
                    deep.transform.SetParent(t, false);
                    VaultCase(deep.transform, "Deep_case", new Vector3(0f, 0f, -GoStory.VaultDeepR), "deep", alloy, Ghost("v_glass_deep", new Color(0.7f, 0.95f, 1f, 0.12f)), glow);
                    P(PrimitiveType.Sphere, deep.transform, "Deep_moment", new Vector3(0f, 1.4f, -GoStory.VaultDeepR), Vector3.one * 0.5f, Mat("v_moment", new Color(1f, 0.9f, 0.5f), 2.4f), false);
                    _parts["vault:deep"] = deep;
                    // 기록 기둥 + 갈무리의 핵
                    P(PrimitiveType.Cube, t, "Vault_pillar", new Vector3(0f, GoStory.VaultPillarH * 0.5f, 0f), new Vector3(GoStory.VaultPillarW, GoStory.VaultPillarH, GoStory.VaultPillarW), concrete, true);
                    for (int i = 0; i < 4; i++)
                    {
                        float yaw = i * Mathf.PI * 0.5f;
                        P(PrimitiveType.Cube, t, "Pillar_strip", new Vector3(Mathf.Sin(yaw) * (GoStory.VaultPillarW * 0.5f + 0.05f), GoStory.VaultPillarH * 0.5f, Mathf.Cos(yaw) * (GoStory.VaultPillarW * 0.5f + 0.05f)), new Vector3(0.1f, GoStory.VaultPillarH - 1f, 0.1f), glow, false);
                    }
                    Part("vault:core", t, PrimitiveType.Sphere, "Vault_core", new Vector3(0f, GoStory.VaultPillarH + 1.4f, 0f), Vector3.one * 1.6f, Mat("v_core", new Color(0.55f, 1f, 0.6f), 2.6f), false);
                    break;
                }
                case "pylon0":
                case "pylon1": // 동력 기둥 — 10m 기둥 + 꼭대기 빛 알(34장 5·6째 단계부터 꺼짐)
                    P(PrimitiveType.Cube, t, "Pylon_shaft", new Vector3(0f, GoStory.VaultPylonH * 0.5f, 0f), new Vector3(1.2f, GoStory.VaultPylonH, 1.2f), steel, true);
                    foreach (float y in new[] { 2.5f, 5f, 7.5f }) P(PrimitiveType.Cube, t, "Pylon_band", new Vector3(0f, y, 0f), new Vector3(1.4f, 0.2f, 1.4f), steelDark, false);
                    Part("vault:" + id + "orb", t, PrimitiveType.Sphere, "Pylon_orb", new Vector3(0f, GoStory.VaultPylonH + 1f, 0f), Vector3.one * 1.4f, seed, false);
                    break;
                case "granary": // 곳간 마을 — 다락 곳간(앞문 자물쇠는 34장 2째 단계부터 열림) + 볏짚 지붕
                    P(PrimitiveType.Cube, t, "Granary_body", new Vector3(0f, 2.1f, 0f), new Vector3(5f, 4.2f, 4f), wood, true);
                    P(PrimitiveType.Cube, t, "Granary_roof", new Vector3(0f, 4.6f, 0f), new Vector3(6f, 0.6f, 5f), thatch, false);
                    for (int i = 0; i < 4; i++) P(PrimitiveType.Cylinder, t, "Granary_stilt", new Vector3(-2f + (i % 2) * 4f, 0.2f, -1.4f + (i / 2) * 2.8f), new Vector3(0.3f, 0.2f, 0.3f), stone, false);
                    Part("vault:granary_door", t, PrimitiveType.Cube, "Granary_lock", new Vector3(0f, 1.3f, 2.05f), new Vector3(1.4f, 2.2f, 0.12f), Mat("v_lock", new Color(0.6f, 0.55f, 0.3f), 0.8f), false);
                    break;
                case "yard": // 갈무리 물류 야적장 — 창고 12×7×8 + 컨테이너 더미 셋 + 갠트리 크레인
                    P(PrimitiveType.Cube, t, "Yard_warehouse", new Vector3(0f, 3.5f, 0f), new Vector3(12f, 7f, 8f), concrete, true);
                    P(PrimitiveType.Cube, t, "Yard_roof", new Vector3(0f, 7.15f, 0f), new Vector3(12.4f, 0.3f, 8.4f), steelDark, false);
                    var ccol = new[] { new Color(0.7f, 0.25f, 0.2f), new Color(0.2f, 0.4f, 0.65f), new Color(0.8f, 0.6f, 0.15f) };
                    var coff = new[] { new Vector2(-24f, -19f), new Vector2(17f, -17f), new Vector2(19f, 19f) };
                    for (int i = 0; i < 3; i++)
                    {
                        P(PrimitiveType.Cube, t, "Yard_container", new Vector3(coff[i].x, 1.3f, coff[i].y), new Vector3(6f, 2.6f, 2.4f), Mat("v_ct" + i, ccol[i]), true, new Vector3(0f, i * 25f, 0f));
                        P(PrimitiveType.Cube, t, "Yard_container_top", new Vector3(coff[i].x + 0.4f, 3.9f, coff[i].y + 0.2f), new Vector3(6f, 2.6f, 2.4f), Mat("v_ct" + ((i + 1) % 3), ccol[(i + 1) % 3]), true, new Vector3(0f, i * 25f + 8f, 0f));
                    }
                    P(PrimitiveType.Cube, t, "Yard_gantry_leg_a", new Vector3(-6f, 5f, -19f), new Vector3(0.6f, 10f, 0.6f), yellow, false);
                    P(PrimitiveType.Cube, t, "Yard_gantry_leg_b", new Vector3(6f, 5f, -19f), new Vector3(0.6f, 10f, 0.6f), yellow, false);
                    P(PrimitiveType.Cube, t, "Yard_gantry_beam", new Vector3(0f, 10.2f, -19f), new Vector3(13f, 0.6f, 0.8f), yellow, false);
                    // 운반 드론 셋 — 야적장 ↔ 금고 문 앞을 오간다(보기만)
                    GoAreas.Vault.TrySite("vault", out var vs);
                    Vector3 a = t.position + new Vector3(0f, 3f, -8f), b = vs.Pos + new Vector3(0f, 3f, GoStory.VaultR + 3f);
                    for (int i = 0; i < 3; i++)
                    {
                        var d = new GameObject("Yard_carrier" + i);
                        d.transform.SetParent(t, false);
                        P(PrimitiveType.Sphere, d.transform, "Carrier_body", Vector3.zero, new Vector3(1.2f, 0.7f, 1.2f), steel, false);
                        P(PrimitiveType.Cube, d.transform, "Carrier_box", new Vector3(0f, -0.6f, 0f), new Vector3(0.7f, 0.5f, 0.7f), Mat("v_parcel", new Color(0.78f, 0.7f, 0.52f)), false);
                        P(PrimitiveType.Sphere, d.transform, "Carrier_eye", new Vector3(0f, 0.05f, 0.55f), new Vector3(0.4f, 0.2f, 0.2f), glow, false);
                        _vaultDrones.Add(new VaultDrone { T = d.transform, A = a, B = b, Phase = i * 2.1f });
                    }
                    break;
                case "statue": // 벌 신상 — 받침 + 벼 이삭을 안은 돌 사람(이동 지점)
                    P(PrimitiveType.Cube, t, "Statue_base", new Vector3(0f, 0.5f, 0f), new Vector3(3.2f, 1f, 3.2f), stone, true);
                    P(PrimitiveType.Cylinder, t, "Statue_body", new Vector3(0f, 2.5f, 0f), new Vector3(1.2f, 1.5f, 1.2f), stone, false);
                    P(PrimitiveType.Sphere, t, "Statue_head", new Vector3(0f, 4.4f, 0f), Vector3.one * 0.8f, stone, false);
                    P(PrimitiveType.Cube, t, "Statue_sheaf", new Vector3(0f, 3.3f, 0.7f), new Vector3(0.9f, 0.3f, 0.5f), thatch, false, new Vector3(-15f, 0f, 0f));
                    break;
                case "haystack": // 볏가리
                    P(PrimitiveType.Cylinder, t, "Hay_base", new Vector3(0f, 0.9f, 0f), new Vector3(2.2f, 0.9f, 2.2f), thatch, false);
                    P(PrimitiveType.Sphere, t, "Hay_top", new Vector3(0f, 2.1f, 0f), new Vector3(2f, 1.6f, 2f), thatch, false);
                    break;
                case "jars": // 장독대
                    for (int i = 0; i < 3; i++) P(PrimitiveType.Sphere, t, "Jar", new Vector3(-1.1f + i * 1.1f, 0.6f, (i % 2) * 0.6f), new Vector3(0.9f, 1.1f, 0.9f), Mat("v_jar" + i, new Color(0.5f, 0.32f, 0.2f)), false);
                    break;
                case "mortar": // 디딜방아
                    P(PrimitiveType.Cube, t, "Mortar_log", new Vector3(0f, 0.9f, 0f), new Vector3(0.4f, 0.3f, 3.6f), wood, false, new Vector3(-8f, 0f, 0f));
                    P(PrimitiveType.Cylinder, t, "Mortar_stone", new Vector3(0f, 0.3f, 1.7f), new Vector3(0.9f, 0.3f, 0.9f), stone, false);
                    P(PrimitiveType.Cube, t, "Mortar_post", new Vector3(0f, 0.5f, 0f), new Vector3(0.3f, 1f, 0.3f), wood, false);
                    break;
                case "sotdae": // 솟대
                    P(PrimitiveType.Cylinder, t, "Sotdae_pole", new Vector3(0f, 2.6f, 0f), new Vector3(0.15f, 2.6f, 0.15f), wood, false);
                    P(PrimitiveType.Sphere, t, "Sotdae_bird", new Vector3(0f, 5.4f, 0f), new Vector3(0.5f, 0.4f, 0.8f), Mat("v_bird", new Color(0.85f, 0.85f, 0.8f)), false);
                    break;
                case "forklift": // 멈춘 지게차
                    P(PrimitiveType.Cube, t, "Fork_body", new Vector3(0f, 0.8f, 0f), new Vector3(1.4f, 1f, 2.2f), yellow, false);
                    P(PrimitiveType.Cube, t, "Fork_mast", new Vector3(0f, 1.6f, 1.2f), new Vector3(0.2f, 2.4f, 0.2f), steelDark, false);
                    P(PrimitiveType.Cube, t, "Fork_tine", new Vector3(0f, 0.3f, 1.9f), new Vector3(0.9f, 0.08f, 1.2f), steelDark, false);
                    break;
                case "parcels": // 택배 상자 더미
                    for (int i = 0; i < 4; i++) P(PrimitiveType.Cube, t, "Parcel", new Vector3(-0.7f + (i % 2) * 1.2f, 0.4f + (i / 2) * 0.8f, (i % 3) * 0.3f), new Vector3(1f, 0.8f, 0.9f), Mat("v_parcel", new Color(0.78f, 0.7f, 0.52f)), false, new Vector3(0f, i * 17f, 0f));
                    break;
                case "container": // 문 열린 컨테이너
                    P(PrimitiveType.Cube, t, "Cont_body", new Vector3(0f, 1.3f, 0f), new Vector3(6f, 2.6f, 2.4f), Mat("v_ct1", new Color(0.2f, 0.4f, 0.65f)), false);
                    P(PrimitiveType.Cube, t, "Cont_door", new Vector3(3.5f, 1.3f, 1.4f), new Vector3(0.1f, 2.4f, 1.2f), rust, false, new Vector3(0f, 60f, 0f));
                    break;
                case "seedpod": // 떨어진 씨앗 캡슐
                    P(PrimitiveType.Capsule, t, "Pod_body", new Vector3(0f, 0.6f, 0f), new Vector3(0.9f, 0.8f, 0.9f), alloy, false, new Vector3(0f, 0f, 70f));
                    P(PrimitiveType.Sphere, t, "Pod_seed", new Vector3(0.2f, 0.7f, 0f), Vector3.one * 0.5f, seed, false);
                    break;
                case "dronedown": // 떨어진 운반 드론
                    P(PrimitiveType.Sphere, t, "Down_body", new Vector3(0f, 0.6f, 0f), new Vector3(1.2f, 0.7f, 1.2f), steel, false, new Vector3(0f, 0f, 16f));
                    P(PrimitiveType.Cube, t, "Down_box", new Vector3(0.9f, 0.3f, 0.6f), new Vector3(0.7f, 0.5f, 0.7f), Mat("v_parcel", new Color(0.78f, 0.7f, 0.52f)), false, new Vector3(0f, 30f, 0f));
                    break;
                case "caseshard": // 깨진 진열장 조각
                    for (int i = 0; i < 4; i++) P(PrimitiveType.Cube, t, "Shard", new Vector3(-0.8f + i * 0.5f, 0.5f + (i % 2) * 0.3f, (i % 2) * 0.5f), new Vector3(0.9f, 0.05f, 0.7f), Ghost("v_shard", new Color(0.7f, 0.95f, 1f, 0.4f)), false, new Vector3(20f + i * 15f, i * 30f, 40f - i * 10f));
                    break;
            }
        }

        /// <summary>이야기 진행에 맞춰 곳간 문·동력 기둥 알·금고 문·핵·진열장을 바꾼다(`Refresh` 가 부른다). `OffForTest` 면 진행 전(닫힌 채)으로 본다.</summary>
        private void RefreshVault()
        {
            bool live = !StoryState.OffForTest;
            SetPart("vault:granary_door", !(live && GoStory.VaultGranaryOpen));
            for (int k = 0; k < 2; k++) SetPart("vault:pylon" + k + "orb", !(live && GoStory.VaultPylonOff(k)));
            SetPart("vault:door", !(live && GoStory.VaultDoorOpen));
            SetPart("vault:core", !(live && GoStory.VaultCoreDim));
            SetPart("vault:haemi", !(live && GoStory.VaultHaemiFree));
            SetPart("vault:deep", live && GoStory.VaultDeepShown);
        }

        private void SetPart(string key, bool on)
        {
            if (_parts.TryGetValue(key, out var g) && g != null && g.activeSelf != on) g.SetActive(on);
        }

        public bool VaultPartOn(string key) => AmberPartOn(key);

        private void TickVault(float dt)
        {
            _vaultT += dt;
            foreach (var d in _vaultDrones)
            {
                if (d.T == null) continue;
                float u = 0.5f - 0.5f * Mathf.Cos(_vaultT * 0.18f + d.Phase);
                Vector3 p = Vector3.Lerp(d.A, d.B, u);
                p.y += Mathf.Sin(u * Mathf.PI) * 6f;
                d.T.position = p;
            }
        }
    }
}
