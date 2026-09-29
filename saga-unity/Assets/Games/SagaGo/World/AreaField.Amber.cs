using System.Collections.Generic;
using UnityEngine;
using Saga.Go.Combat;
using Saga.Go.Data;
using Saga.Go.Player;

namespace Saga.Go.World
{
    /// <summary>
    /// PLAN.md 109-14-57 여덟째 지역 굳은 거리(웹 ⑲-57 `amber.js`·Godot `region8_amber.gd`) 도형 — 틈이 닫히던 날 호박빛으로 굳어 붙은 옛 번화가.
    /// 명소 일곱(고개 어귀·네거리·시계방·장터·부양탑·고가 선로·신상) + 작은 발견 열. 이야기가 바꾸는 부분(굳은 자리 셋·장터 결정 돔·부양탑 태엽 심장·신호등 빛·괘종시계 바늘)은
    /// `RefreshAmber` 가 `GoStory.Amber*` 상태에 맞춰 켜고 끈다(30~32장은 뒤 조각 — 그 전엔 굳은 채).
    /// </summary>
    public partial class AreaField
    {
        private struct Floater { public Transform T; public float Y, Phase; }
        private readonly List<Floater> _floaters = new List<Floater>();
        private readonly List<Material> _lampMats = new List<Material>();
        private float _amberT;

        /// <summary>속이 비치는 호박빛 유리(빛 안 받는 스프라이트 셰이더 — 잠긴 도읍 물판과 같은 방식).</summary>
        private Material Ghost(string key, Color c)
        {
            if (_mats.TryGetValue(key, out var m)) return m;
            m = new Material(Shader.Find("Sprites/Default")) { name = "Area_" + key + " (generated)", color = c };
            _mats[key] = m;
            return m;
        }

        private void Float(GameObject g, float phase) => _floaters.Add(new Floater { T = g.transform, Y = g.transform.localPosition.y, Phase = phase });

        private GameObject Lump(Transform t, string name, Vector3 local, Vector3 scale)
        {
            var g = P(PrimitiveType.Sphere, t, name, local, scale, Ghost("a_glass", new Color(1f, 0.68f, 0.22f, 0.5f)), false);
            g.GetComponent<MeshRenderer>().shadowCastingMode = UnityEngine.Rendering.ShadowCastingMode.Off;
            return g;
        }

        /// <summary>신호등 — 기둥·상자·빨간 등(등 재질은 모아 뒀다 32장 뒤 초록으로).</summary>
        private void AmberSignal(Transform t, Vector3 pos)
        {
            var steelDark = Mat("a_steel_dark", new Color(0.28f, 0.3f, 0.33f));
            var housing = Mat("a_housing", new Color(0.12f, 0.12f, 0.14f));
            P(PrimitiveType.Cylinder, t, "Signal_pole", pos + new Vector3(0f, 2.1f, 0f), new Vector3(0.18f, 2.1f, 0.18f), steelDark, false);
            P(PrimitiveType.Cube, t, "Signal_box", pos + new Vector3(0f, 4.3f, 0f), new Vector3(0.45f, 1.2f, 0.35f), housing, false);
            var lampMat = new Material(Shader.Find("Universal Render Pipeline/Lit")) { name = "Area_a_lamp (generated)", color = new Color(1f, 0.22f, 0.18f) };
            lampMat.EnableKeyword("_EMISSION");
            lampMat.SetColor("_EmissionColor", new Color(1f, 0.22f, 0.18f) * 1.8f);
            P(PrimitiveType.Cube, t, "Signal_lamp", pos + new Vector3(0f, 4.62f, 0f), new Vector3(0.3f, 0.3f, 0.38f), lampMat, false);
            _lampMats.Add(lampMat);
        }

        private void BuildAmberSite(Transform t, string id)
        {
            var amber = Mat("a_amber", new Color(1f, 0.68f, 0.22f), 1.0f, 0.6f);
            var asphalt = Mat("a_asphalt", new Color(0.26f, 0.26f, 0.28f));
            var concrete = Mat("a_concrete", new Color(0.66f, 0.65f, 0.62f));
            var steel = Mat("a_steel", new Color(0.62f, 0.65f, 0.68f), 0f, 0.6f, 0.5f);
            var steelDark = Mat("a_steel_dark", new Color(0.28f, 0.3f, 0.33f));
            var brick = Mat("a_brick", new Color(0.55f, 0.32f, 0.26f));
            var wood = Mat("a_wood", new Color(0.45f, 0.3f, 0.18f));
            var cloth = Mat("a_cloth", new Color(0.78f, 0.7f, 0.52f));
            var alloy = Mat("a_alloy", new Color(0.84f, 0.88f, 0.93f), 0f, 0.6f, 0.4f);
            var glow = Mat("a_glow", new Color(0.5f, 0.88f, 1f), 2.2f);
            var glass = Mat("a_win", new Color(0.55f, 0.75f, 0.85f), 0.3f, 0.8f);
            var red = Mat("a_red", new Color(0.85f, 0.18f, 0.14f));
            var yellow = Mat("a_yellow", new Color(0.95f, 0.72f, 0.15f));
            var person = Mat("a_person", new Color(0.35f, 0.3f, 0.28f));
            switch (id)
            {
                case "pass": // 북쪽 고개 결정 막 — 열린 뒤엔 옅은 테만: 호박빛 기둥 둘 + 들보 + 받침 돌(막 자체는 지도 쪽 돌기둥이 열릴 때 이미 풀린 뒤)
                    P(PrimitiveType.Cube, t, "Pass_base", new Vector3(0f, 0.3f, 0f), new Vector3(1.6f, 0.6f, 1.2f), Mat("a_stone", new Color(0.4f, 0.39f, 0.37f)), true);
                    P(PrimitiveType.Cube, t, "Pass_plate", new Vector3(0f, 1.7f, 0f), new Vector3(0.9f, 2.2f, 0.12f), amber, false);
                    foreach (float x in new[] { -GoStory.AmberPassHalf, GoStory.AmberPassHalf })
                        P(PrimitiveType.Cube, t, "Pass_pillar", new Vector3(x, 7f, 0f), new Vector3(0.6f, 14f, 0.6f), amber, true);
                    P(PrimitiveType.Cube, t, "Pass_lintel", new Vector3(0f, 14.2f, 0f), new Vector3(GoStory.AmberPassHalf * 2f + 0.6f, 0.5f, 0.6f), amber, false);
                    break;
                case "cross": // 네거리 — 건널목 줄 + 모서리 신호등 넷 + 굳은 자리 셋(결정 속 사람)
                    for (int i = 0; i < 6; i++) P(PrimitiveType.Cube, t, "Cross_zebra", new Vector3(-4f + i * 1.6f, 0.05f, -7.5f), new Vector3(0.7f, 0.03f, 5f), Mat("a_zebra", new Color(0.92f, 0.92f, 0.88f)), false);
                    foreach (var l in GoStory.AmberLights) AmberSignal(t, new Vector3(l.x, 0f, l.y));
                    for (int k = 0; k < 3; k++)
                    {
                        var o = GoStory.AmberCrystalAt[k];
                        var c = new GameObject("Amber_crystal" + k);
                        c.transform.SetParent(t, false);
                        c.transform.localPosition = new Vector3(o.x, 0f, o.y);
                        switch (k)
                        {
                            case 0: AmberSignal(c.transform, new Vector3(1.6f, 0f, 0f)); break;
                            case 1: // 버스 정류장 — 지붕 + 유리 벽 + 벤치
                                P(PrimitiveType.Cube, c.transform, "Bus_roof", new Vector3(0f, 2.5f, -0.6f), new Vector3(3.2f, 0.12f, 1.6f), alloy, false);
                                P(PrimitiveType.Cube, c.transform, "Bus_glass", new Vector3(0f, 1.25f, -1.35f), new Vector3(3.2f, 2.4f, 0.08f), glass, false);
                                P(PrimitiveType.Cube, c.transform, "Bus_bench", new Vector3(0f, 0.5f, -1f), new Vector3(2.4f, 0.08f, 0.5f), wood, false);
                                break;
                            default: // 우체통
                                P(PrimitiveType.Cube, c.transform, "Post_box", new Vector3(1.3f, 0.6f, 0f), new Vector3(0.7f, 1.2f, 0.6f), red, false);
                                P(PrimitiveType.Cube, c.transform, "Post_cap", new Vector3(1.3f, 1.25f, 0f), new Vector3(0.75f, 0.2f, 0.65f), Mat("a_red_dark", new Color(0.6f, 0.12f, 0.1f)), false);
                                break;
                        }
                        P(PrimitiveType.Capsule, c.transform, "Stuck_person", new Vector3(0f, 0.9f, 0f), new Vector3(0.64f, 0.85f, 0.64f), person, false);
                        Lump(c.transform, "Stuck_egg", new Vector3(0f, 1.1f, 0f), new Vector3(2.6f, 3.6f, 2.6f));
                        c.AddComponent<BoxCollider>().size = new Vector3(2.4f, 3f, 2.4f);
                        c.GetComponent<BoxCollider>().center = new Vector3(0f, 1.5f, 0f);
                        _parts["amber:crystal" + k] = c;
                    }
                    break;
                case "clock": // 시계방 — 벽돌 가게(충돌) + 지붕 + 진열창 + 차양 + 서쪽 앞 큰 괘종시계(바늘 하나)
                    P(PrimitiveType.Cube, t, "Shop_body", new Vector3(0f, 2.1f, 0f), new Vector3(5f, 4.2f, 5f), brick, true);
                    P(PrimitiveType.Cube, t, "Shop_roof", new Vector3(0f, 4.32f, 0f), new Vector3(5.4f, 0.25f, 5.4f), steelDark, false);
                    P(PrimitiveType.Cube, t, "Shop_window", new Vector3(-2.55f, 1.2f, 0f), new Vector3(0.1f, 1.8f, 3.2f), glass, false);
                    P(PrimitiveType.Cube, t, "Shop_awning", new Vector3(-3.1f, 3.2f, 0f), new Vector3(1.4f, 0.1f, 5.2f), Mat("a_awning", new Color(0.2f, 0.42f, 0.36f)), false, new Vector3(0f, 0f, 14f));
                    P(PrimitiveType.Cube, t, "Shop_clock", new Vector3(-3.6f, 1.3f, 2f), new Vector3(0.9f, 2.6f, 0.6f), wood, false);
                    P(PrimitiveType.Cylinder, t, "Shop_dial", new Vector3(-4.07f, 2.1f, 2f), new Vector3(0.76f, 0.03f, 0.76f), Mat("a_dial", new Color(0.98f, 0.94f, 0.8f), 0.6f), false, new Vector3(0f, 0f, 90f));
                    Part("amber:clock_hand", t, PrimitiveType.Cube, "Shop_clock_hand", new Vector3(-4.12f, 2.1f, 2f), new Vector3(0.05f, 0.5f, 0.06f), Mat("a_hand", new Color(0.1f, 0.1f, 0.12f)), false, new Vector3(35f, 0f, 0f));
                    break;
                case "market": // 호박 속 장터 — 좌판 셋(천막) + 굳은 장돌뱅이 + 결정 돔(31장 석등 뒤 깨짐)
                    for (int i = 0; i < 3; i++)
                    {
                        float a = Mathf.PI * 2f * i / 3f + 0.4f;
                        var st = new GameObject("Stall_" + i);
                        st.transform.SetParent(t, false);
                        st.transform.localPosition = new Vector3(Mathf.Cos(a), 0f, Mathf.Sin(a)) * 2.6f;
                        st.transform.localRotation = Quaternion.Euler(0f, -a * Mathf.Rad2Deg, 0f);
                        P(PrimitiveType.Cube, st.transform, "Stall_table", new Vector3(0f, 0.4f, 0f), new Vector3(1.8f, 0.8f, 1f), wood, false);
                        P(PrimitiveType.Cube, st.transform, "Stall_tent", new Vector3(0f, 2.1f, 0f), new Vector3(2f, 0.08f, 1.2f), cloth, false);
                        foreach (float x in new[] { -0.85f, 0.85f }) P(PrimitiveType.Cylinder, st.transform, "Stall_post", new Vector3(x, 1.05f, 0.5f), new Vector3(0.08f, 1.05f, 0.08f), wood, false);
                        for (int k = 0; k < 3; k++) P(PrimitiveType.Cube, st.transform, "Stall_goods", new Vector3(-0.5f + k * 0.5f, 0.92f, 0f), new Vector3(0.3f, 0.25f, 0.3f), Mat("a_goods" + k, k == 0 ? new Color(0.85f, 0.3f, 0.2f) : k == 1 ? new Color(0.9f, 0.75f, 0.3f) : new Color(0.4f, 0.6f, 0.3f)), false);
                    }
                    var dome = new GameObject("Market_crystal");
                    dome.transform.SetParent(t, false);
                    P(PrimitiveType.Capsule, dome.transform, "Market_man", new Vector3(0f, 0.9f, 0f), new Vector3(0.68f, 0.85f, 0.68f), Mat("a_man", new Color(0.5f, 0.4f, 0.3f)), false);
                    var shell = P(PrimitiveType.Sphere, dome.transform, "Market_dome", Vector3.zero, Vector3.one * GoStory.AmberDomeR * 2f, Ghost("a_dome", new Color(1f, 0.68f, 0.22f, 0.35f)), true);
                    shell.GetComponent<MeshRenderer>().shadowCastingMode = UnityEngine.Rendering.ShadowCastingMode.Off;
                    shell.AddComponent<NoClimb>();
                    for (int k = 0; k < 5; k++)
                    {
                        var mote = P(PrimitiveType.Cube, dome.transform, "Market_mote", new Vector3(Mathf.Cos(k * 1.3f) * 5.4f, 1.5f + k * 0.5f, Mathf.Sin(k * 1.3f) * 5.4f), Vector3.one * 0.25f, amber, false);
                        Float(mote, k);
                    }
                    _parts["amber:dome"] = dome;
                    break;
                case "tower": // 짓다 만 부양탑 — 심 기둥(충돌·옆면 타기) + 띠 + 꼭대기 시간 태엽 심장(호박 알) + 공중 층판 둘 + 크레인(보기만)
                    P(PrimitiveType.Cube, t, "Tower_core", new Vector3(0f, GoStory.AmberTowerHeight * 0.5f, 0f), new Vector3(GoStory.AmberTowerHalf * 2f, GoStory.AmberTowerHeight, GoStory.AmberTowerHalf * 2f), concrete, true);
                    foreach (float y in new[] { 3f, 6f, 9f }) P(PrimitiveType.Cube, t, "Tower_band", new Vector3(0f, y, 0f), new Vector3(6.1f, 0.25f, 6.1f), steelDark, false);
                    for (int i = 0; i < 4; i++)
                    {
                        float yaw = i * Mathf.PI * 0.5f;
                        P(PrimitiveType.Cube, t, "Tower_strip", new Vector3(Mathf.Sin(yaw) * 3.05f, GoStory.AmberTowerHeight * 0.5f, Mathf.Cos(yaw) * 3.05f), new Vector3(0.12f, GoStory.AmberTowerHeight - 1f, 0.12f), glow, false);
                    }
                    P(PrimitiveType.Cube, t, "Tower_cradle", new Vector3(0f, GoStory.AmberTowerHeight + 0.15f, 0f), new Vector3(1.2f, 0.3f, 1.2f), steelDark, false);
                    Part("amber:heart", t, PrimitiveType.Sphere, "Tower_heart", new Vector3(0f, GoStory.AmberTowerHeight + 1.3f, 0f), Vector3.one * 1.6f, Mat("a_heart", new Color(1f, 0.68f, 0.22f), 2.2f), false);
                    for (int i = 0; i < 2; i++)
                    {
                        var slab = new GameObject("Tower_slab" + i);
                        slab.transform.SetParent(t, false);
                        slab.transform.localPosition = new Vector3(0f, GoStory.AmberTowerHeight + 5f + i * 3.5f, 0f);
                        slab.transform.localRotation = Quaternion.Euler(3f * (i + 1), 23f * i, -2f);
                        P(PrimitiveType.Cube, slab.transform, "Slab_plate", Vector3.zero, new Vector3(7f, 0.4f, 7f), alloy, false);
                        P(PrimitiveType.Cube, slab.transform, "Slab_rim", new Vector3(0f, -0.25f, 0f), new Vector3(7.1f, 0.1f, 7.1f), glow, false);
                        Float(slab, i * 2f);
                    }
                    P(PrimitiveType.Cube, t, "Crane_mast", new Vector3(5.5f, 10f, -2f), new Vector3(0.6f, 20f, 0.6f), yellow, false);
                    P(PrimitiveType.Cube, t, "Crane_arm", new Vector3(1.5f, 20.2f, -2f), new Vector3(14f, 0.5f, 0.5f), yellow, false);
                    P(PrimitiveType.Cube, t, "Crane_cable", new Vector3(-4f, 17f, -2f), new Vector3(0.06f, 6f, 0.06f), steelDark, false);
                    break;
                case "rail": // 고가 선로 — 기둥 일곱 + 들보 + 멈춘 전철 한 칸(밑으로 걸어 지난다)
                    P(PrimitiveType.Cube, t, "Rail_beam", new Vector3(0f, 7f, 0f), new Vector3(150f, 0.8f, 3.2f), concrete, false);
                    for (int i = -3; i <= 3; i++) P(PrimitiveType.Cube, t, "Rail_pier", new Vector3(i * 22f, 3.5f, 0f), new Vector3(1f, 7f, 1f), Mat("a_pier", new Color(0.56f, 0.55f, 0.53f)), true);
                    P(PrimitiveType.Cube, t, "Rail_car", new Vector3(22f, 8.9f, 0f), new Vector3(16f, 3f, 2.8f), Mat("a_car", new Color(0.82f, 0.84f, 0.86f)), false);
                    P(PrimitiveType.Cube, t, "Rail_car_stripe", new Vector3(22f, 8.2f, 0f), new Vector3(16.05f, 0.5f, 2.85f), Mat("a_car_stripe", new Color(0.2f, 0.45f, 0.7f)), false);
                    for (int k = 0; k < 6; k++) P(PrimitiveType.Cube, t, "Rail_car_window", new Vector3(16f + k * 2.4f, 9.4f, 0f), new Vector3(1.6f, 1f, 2.9f), glass, false);
                    break;
                case "statue": // 거리의 신상 — 받침 + 도포 입은 몸 + 머리 + 든 등롱(이동 지점)
                    P(PrimitiveType.Cube, t, "Statue_base", new Vector3(0f, 0.5f, 0f), new Vector3(3.2f, 1f, 3.2f), Mat("a_stone2", new Color(0.55f, 0.53f, 0.5f)), true);
                    P(PrimitiveType.Cylinder, t, "Statue_body", new Vector3(0f, 2.6f, 0f), new Vector3(1.3f, 1.6f, 1.3f), Mat("a_stone3", new Color(0.6f, 0.58f, 0.54f)), false);
                    P(PrimitiveType.Sphere, t, "Statue_head", new Vector3(0f, 4.55f, 0f), Vector3.one * 0.8f, Mat("a_stone3", new Color(0.6f, 0.58f, 0.54f)), false);
                    P(PrimitiveType.Cube, t, "Statue_arm", new Vector3(0.9f, 3.4f, 0.3f), new Vector3(0.3f, 0.3f, 1.4f), Mat("a_stone3", new Color(0.6f, 0.58f, 0.54f)), false, new Vector3(-20f, 0f, 0f));
                    P(PrimitiveType.Sphere, t, "Statue_lantern", new Vector3(0.9f, 3.2f, 1.0f), Vector3.one * 0.45f, amber, false);
                    break;
                case "lamp": // 굳은 가로등 — 기둥 + 호박 든 등
                    P(PrimitiveType.Cylinder, t, "Lamp_pole", new Vector3(0f, 2.4f, 0f), new Vector3(0.16f, 2.4f, 0.16f), steelDark, false);
                    P(PrimitiveType.Sphere, t, "Lamp_bulb", new Vector3(0f, 4.9f, 0f), Vector3.one * 0.7f, Mat("a_bulb", new Color(1f, 0.92f, 0.6f), 1.6f), false);
                    Lump(t, "Lamp_amber", new Vector3(0f, 4.6f, 0f), new Vector3(1.4f, 2f, 1.4f));
                    break;
                case "bench": // 호박 든 벤치
                    P(PrimitiveType.Cube, t, "Bench_seat", new Vector3(0f, 0.5f, 0f), new Vector3(1.8f, 0.1f, 0.5f), wood, false);
                    P(PrimitiveType.Cube, t, "Bench_back", new Vector3(0f, 0.9f, -0.22f), new Vector3(1.8f, 0.5f, 0.06f), wood, false);
                    Lump(t, "Bench_amber", new Vector3(0f, 0.9f, 0f), new Vector3(2.4f, 1.8f, 1.4f));
                    break;
                case "vend": // 멈춘 자판기
                    P(PrimitiveType.Cube, t, "Vend_box", new Vector3(0f, 0.95f, 0f), new Vector3(1f, 1.9f, 0.8f), red, false);
                    P(PrimitiveType.Cube, t, "Vend_window", new Vector3(0f, 1.3f, 0.41f), new Vector3(0.7f, 1f, 0.05f), Mat("a_vend_glow", new Color(0.9f, 0.95f, 1f), 1.4f), false);
                    break;
                case "mailbox": // 굳은 우체통
                    P(PrimitiveType.Cube, t, "Mail_box", new Vector3(0f, 0.6f, 0f), new Vector3(0.7f, 1.2f, 0.6f), red, false);
                    Lump(t, "Mail_amber", new Vector3(0f, 0.7f, 0f), new Vector3(1.4f, 1.8f, 1.3f));
                    break;
                case "cart": // 멈춘 손수레
                    P(PrimitiveType.Cube, t, "Cart_bed", new Vector3(0f, 0.9f, 0f), new Vector3(2.6f, 0.4f, 1.6f), wood, false, new Vector3(0f, 0f, 6f));
                    P(PrimitiveType.Cylinder, t, "Cart_wheel_a", new Vector3(-0.9f, 0.5f, 0.9f), new Vector3(1f, 0.1f, 1f), wood, false, new Vector3(90f, 0f, 0f));
                    P(PrimitiveType.Cylinder, t, "Cart_wheel_b", new Vector3(0.9f, 0.5f, -0.9f), new Vector3(1f, 0.1f, 1f), wood, false, new Vector3(90f, 0f, 0f));
                    Lump(t, "Cart_amber", new Vector3(0f, 1f, 0f), new Vector3(1.8f, 1.2f, 1.4f));
                    break;
                case "jar": // 호박 속 옹기
                    P(PrimitiveType.Sphere, t, "Jar_body", new Vector3(0f, 0.6f, 0f), new Vector3(1.1f, 1.2f, 1.1f), Mat("a_jar", new Color(0.5f, 0.32f, 0.2f)), false);
                    P(PrimitiveType.Cylinder, t, "Jar_neck", new Vector3(0f, 1.3f, 0f), new Vector3(0.5f, 0.15f, 0.5f), Mat("a_jar", new Color(0.5f, 0.32f, 0.2f)), false);
                    Lump(t, "Jar_amber", new Vector3(0f, 0.8f, 0f), new Vector3(1.8f, 2f, 1.8f));
                    break;
                case "kite": // 허공에 굳은 연 — 마름모 + 꼬리 + 팽팽한 줄
                    P(PrimitiveType.Cube, t, "Kite_body", new Vector3(0f, 3.4f, 0f), new Vector3(1.2f, 1.2f, 0.05f), Mat("a_kite", new Color(0.85f, 0.25f, 0.2f)), false, new Vector3(0f, 20f, 45f));
                    P(PrimitiveType.Cube, t, "Kite_tail", new Vector3(0.5f, 2.2f, 0f), new Vector3(0.08f, 1.6f, 0.04f), Mat("a_kite_tail", new Color(0.9f, 0.85f, 0.7f)), false, new Vector3(0f, 0f, 20f));
                    P(PrimitiveType.Cube, t, "Kite_string", new Vector3(-0.9f, 1.6f, 0f), new Vector3(0.03f, 3.6f, 0.03f), Mat("a_string", new Color(0.9f, 0.9f, 0.85f)), false, new Vector3(0f, 0f, -30f));
                    Lump(t, "Kite_amber", new Vector3(0f, 3.2f, 0f), new Vector3(2f, 2.4f, 1.2f));
                    break;
                case "drone": // 떨어진 배달 드론
                    P(PrimitiveType.Sphere, t, "Drone_body", new Vector3(0f, 0.6f, 0f), new Vector3(1.2f, 0.7f, 1.2f), steel, false, new Vector3(0f, 0f, 14f));
                    for (int i = 0; i < 4; i++) P(PrimitiveType.Cylinder, t, "Drone_rotor", new Vector3(Mathf.Cos(i * 1.57f + 0.8f) * 0.9f, 0.7f, Mathf.Sin(i * 1.57f + 0.8f) * 0.9f), new Vector3(0.6f, 0.02f, 0.6f), steelDark, false);
                    P(PrimitiveType.Cube, t, "Drone_parcel", new Vector3(0.3f, 0.25f, 0.8f), new Vector3(0.6f, 0.5f, 0.6f), cloth, false, new Vector3(0f, 30f, 0f));
                    break;
                case "board": // 꺼진 안내판
                    P(PrimitiveType.Cube, t, "Board_post", new Vector3(0f, 1.2f, 0f), new Vector3(0.12f, 2.4f, 0.12f), steelDark, false);
                    P(PrimitiveType.Cube, t, "Board_panel", new Vector3(0f, 2.6f, 0f), new Vector3(2.2f, 1.3f, 0.1f), Mat("a_board", new Color(0.08f, 0.1f, 0.12f)), false, new Vector3(0f, 0f, -6f));
                    break;
                case "panel": // 금 간 태양 패널
                    P(PrimitiveType.Cube, t, "Panel_slab", new Vector3(0f, 0.9f, 0f), new Vector3(2.6f, 0.08f, 1.6f), Mat("a_panel", new Color(0.12f, 0.2f, 0.4f), 0f, 0.7f, 0.3f), false, new Vector3(35f, 0f, 0f));
                    P(PrimitiveType.Cube, t, "Panel_crack", new Vector3(0.2f, 0.95f, 0.05f), new Vector3(0.05f, 0.05f, 1.7f), glow, false, new Vector3(35f, 10f, 0f));
                    P(PrimitiveType.Cube, t, "Panel_leg", new Vector3(0f, 0.4f, 0.5f), new Vector3(0.1f, 0.8f, 0.1f), steelDark, false);
                    break;
            }
        }

        /// <summary>이야기 진행에 맞춰 굳은 자리·장터 돔·태엽 심장·신호등 빛을 바꾼다(`Refresh` 가 부른다). `OffForTest` 면 진행 전(굳은 채)으로 본다.</summary>
        private void RefreshAmber()
        {
            bool live = !StoryState.OffForTest;
            for (int i = 0; i < 3; i++)
                if (_parts.TryGetValue("amber:crystal" + i, out var c) && c != null) c.SetActive(!(live && GoStory.AmberCrystalOff(i)));
            if (_parts.TryGetValue("amber:dome", out var dome) && dome != null) dome.SetActive(!(live && GoStory.AmberDomeBroken));
            if (_parts.TryGetValue("amber:heart", out var heart) && heart != null) heart.SetActive(!(live && GoStory.AmberTowerMelted));
            _amberGreen = live && GoStory.AmberLightsGreen;
            var lamp = _amberGreen ? new Color(0.3f, 1f, 0.45f) : new Color(1f, 0.22f, 0.18f);
            foreach (var m in _lampMats) { m.color = lamp; m.SetColor("_EmissionColor", lamp * 1.8f); }
            _amberWinding = live && GoStory.AmberClockWinding;
        }

        private bool _amberGreen, _amberWinding;
        public bool AmberLampsGreen => _amberGreen;
        public bool AmberWinding => _amberWinding;
        public bool AmberPartOn(string key) => _parts.TryGetValue(key, out var g) && g != null && g.activeSelf;

        private void TickAmber(float dt)
        {
            _amberT += dt;
            foreach (var f in _floaters)
            {
                if (f.T == null) continue;
                var p = f.T.localPosition;
                p.y = f.Y + Mathf.Sin(_amberT * 0.35f + f.Phase) * 0.2f;
                f.T.localPosition = p;
            }
            if (_amberWinding && _parts.TryGetValue("amber:clock_hand", out var hand) && hand != null)
                hand.transform.localRotation = Quaternion.Euler(-_amberT * 230f, 0f, 0f);
        }
    }
}
