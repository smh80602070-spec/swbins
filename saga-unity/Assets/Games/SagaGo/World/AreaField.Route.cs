using System.Collections.Generic;
using UnityEngine;
using Saga.Go.Data;
using Saga.Go.Player;

namespace Saga.Go.World
{
    /// <summary>
    /// PLAN.md 109-14-48 구름 위 항로(웹 사가고 ⑲-48 `skyroute.js`) — 잠긴 도읍 옛 등대 서쪽 하늘에 뜬 섬 셋(하늘 사당·비행선 잔해·궤도 정거장 조각)과 바람 기둥 셋.
    /// 23장 등롱 불(`GoStory.LighthouseLit`) 뒤에만 서고, 기둥은 24장(등대→사당·사당→잔해)·25장(잔해→정거장)을 마친 뒤 열린다. 그림은 코드 도형(SAGA-DESIGN §7).
    /// </summary>
    public partial class AreaField
    {
        private GameObject _routeRoot;
        private readonly GameObject[] _routePillars = new GameObject[3];
        private readonly List<LineRenderer>[] _routeRings = { new List<LineRenderer>(), new List<LineRenderer>(), new List<LineRenderer>() };
        private readonly PlayerController.DraftCol[] _routeCols = new PlayerController.DraftCol[3];
        private readonly bool[] _routeReg = new bool[3];
        private float _routeT;
        public bool RouteShown => _routeRoot != null && _routeRoot.activeSelf;
        public bool RoutePillarOn(int i) => _routeReg[i];

        private void UnregisterRoute()
        {
            for (int i = 0; i < 3; i++) if (_routeReg[i]) { PlayerController.ExtraDrafts.Remove(_routeCols[i]); _routeReg[i] = false; }
        }

        private void BuildRoute(Transform parent)
        {
            var stone = Mat("r_stone", new Color(0.55f, 0.55f, 0.6f));
            var grass = Mat("r_grass", new Color(0.36f, 0.5f, 0.32f));
            var dark = Mat("r_dark", new Color(0.16f, 0.15f, 0.2f));
            var roof = Mat("r_roof", new Color(0.24f, 0.3f, 0.34f));
            var wood = Mat("r_wood", new Color(0.4f, 0.28f, 0.18f));
            var rust = Mat("r_rust", new Color(0.5f, 0.32f, 0.22f));
            var balloon = Mat("r_balloon", new Color(0.62f, 0.2f, 0.18f));
            var metal = Mat("r_metal", new Color(0.7f, 0.74f, 0.8f), 0f, 0.65f, 0.6f);
            var solar = Mat("r_solar", new Color(0.12f, 0.2f, 0.5f), 0.4f, 0.8f, 0.5f);
            var glow = Mat("r_glow", new Color(0.7f, 0.9f, 1f), 2.4f);
            var bell = Mat("r_bell", new Color(0.9f, 0.75f, 0.3f), 0.6f, 0.6f, 0.6f);
            _routeRoot = new GameObject("Route_isles");
            _routeRoot.transform.SetParent(parent, false);
            for (int i = 0; i < 3; i++)
            {
                var isle = new GameObject("Route_" + GoAreas.RouteIds[i]);
                isle.transform.SetParent(_routeRoot.transform, false);
                Vector3 c = GoStory.RouteCenter(i);
                float r = GoAreas.RouteR[i], slab = GoAreas.RouteSlab[i];
                var disc = P(PrimitiveType.Cylinder, isle.transform, "Route_disc", c - Vector3.up * (slab * 0.5f), new Vector3(r * 2f, slab * 0.5f, r * 2f), i == 0 ? grass : stone, true);
                disc.AddComponent<NoClimb>();
                P(PrimitiveType.Sphere, isle.transform, "Route_horn", c - Vector3.up * (slab + 8f), new Vector3(r * 1.2f, 14f, r * 1.2f), stone, false);
                const int seg = 28;
                float rr = r - 0.7f, len = 2f * Mathf.PI * rr / seg + 0.2f;
                for (int k = 0; k < seg; k++)
                {
                    float a = (k + 0.5f) * Mathf.PI * 2f / seg;
                    var w = P(PrimitiveType.Cube, isle.transform, "Route_rail", c + new Vector3(Mathf.Sin(a) * rr, GoStory.SkyRail * 0.5f, Mathf.Cos(a) * rr), new Vector3(len, GoStory.SkyRail, 0.5f), i == 0 ? wood : stone, true, new Vector3(0f, a * Mathf.Rad2Deg, 0f));
                    w.AddComponent<NoClimb>();
                }
                if (i == 0) // 하늘 사당 — 북쪽 기와 사당 + 바람 방울 장대 넷(가운데 8m 비움)
                {
                    P(PrimitiveType.Cube, isle.transform, "Shrine_hall", c + new Vector3(0f, 2.5f, -12f), new Vector3(10f, 5f, 6f), wood, true);
                    P(PrimitiveType.Cube, isle.transform, "Shrine_roof", c + new Vector3(0f, 5.6f, -12f), new Vector3(12.5f, 1.2f, 8.5f), roof, false);
                    for (int k = 0; k < 4; k++)
                    {
                        float a = (k * 90f + 45f) * Mathf.Deg2Rad;
                        Vector3 pole = c + new Vector3(Mathf.Sin(a) * 10f, 0f, -Mathf.Cos(a) * 10f);
                        P(PrimitiveType.Cylinder, isle.transform, "Shrine_pole", pole + Vector3.up * 3f, new Vector3(0.3f, 3f, 0.3f), wood, false);
                        P(PrimitiveType.Sphere, isle.transform, "Shrine_bell", pole + Vector3.up * 6.2f, Vector3.one * 0.9f, bell, false);
                    }
                }
                else if (i == 1) // 비행선 잔해 — 조종실·찢어진 기낭·꼬리 날개·프로펠러·풍향계
                {
                    P(PrimitiveType.Cube, isle.transform, "Wreck_cockpit", c + new Vector3(5f, 1.6f, -4f), new Vector3(4f, 3.2f, 5f), rust, true);
                    P(PrimitiveType.Cube, isle.transform, "Wreck_cockpit_glass", c + new Vector3(5f, 2.4f, -1.45f), new Vector3(3f, 1.2f, 0.1f), Mat("r_glass", new Color(0.6f, 0.85f, 0.95f), 0.4f, 0.8f), false);
                    P(PrimitiveType.Sphere, isle.transform, "Wreck_balloon", c + new Vector3(-6f, 2.2f, 2f), new Vector3(9f, 4.4f, 6f), balloon, false, new Vector3(0f, 25f, 10f));
                    P(PrimitiveType.Cube, isle.transform, "Wreck_tail", c + new Vector3(-8f, 3f, -7f), new Vector3(0.4f, 5f, 4f), rust, false, new Vector3(0f, 20f, 8f));
                    Part("route:propeller", isle.transform, PrimitiveType.Cube, "Wreck_propeller", c + new Vector3(5f, 1.8f, -6.8f), new Vector3(0.3f, 3.6f, 0.15f), dark, false);
                    P(PrimitiveType.Cylinder, isle.transform, "Wreck_vane_pole", c + new Vector3(12f, 2f, 5f), new Vector3(0.15f, 2f, 0.15f), metal, false);
                    P(PrimitiveType.Cube, isle.transform, "Wreck_vane", c + new Vector3(12f, 4.1f, 5f), new Vector3(1.4f, 0.5f, 0.1f), balloon, false);
                }
                else // 궤도 정거장 조각 — 태양 날개·9m 안테나·구름 씨앗 장치 셋(반지름 9m)
                {
                    P(PrimitiveType.Cube, isle.transform, "Orbit_hub", c + new Vector3(0f, 1.2f, 0f), new Vector3(3f, 2.4f, 3f), metal, true);
                    P(PrimitiveType.Cube, isle.transform, "Orbit_solar_e", c + new Vector3(10f, 3f, -3f), new Vector3(0.2f, 5f, 9f), solar, false, new Vector3(0f, 0f, 15f));
                    P(PrimitiveType.Cube, isle.transform, "Orbit_solar_w", c + new Vector3(-10f, 3f, -3f), new Vector3(0.2f, 5f, 9f), solar, false, new Vector3(0f, 0f, -15f));
                    P(PrimitiveType.Cylinder, isle.transform, "Orbit_antenna", c + new Vector3(3f, 4.5f, 3f), new Vector3(0.25f, 4.5f, 0.25f), metal, false);
                    var seeds = new[] { new Vector2(7.8f, 4.5f), new Vector2(0f, -9f), new Vector2(-7.8f, 4.5f) };
                    for (int k = 0; k < 3; k++)
                    {
                        P(PrimitiveType.Cylinder, isle.transform, "Orbit_seeder_" + k, c + new Vector3(seeds[k].x, 0.6f, seeds[k].y), new Vector3(1.4f, 0.6f, 1.4f), dark, false);
                        Part("route:seeder" + k, isle.transform, PrimitiveType.Sphere, "Orbit_seeder_lamp_" + k, c + new Vector3(seeds[k].x, 1.6f, seeds[k].y), Vector3.one * 1.1f, glow, false);
                    }
                }
            }
            // 바람 기둥 고리 — 기둥마다 여덟
            var lineMat = new Material(Shader.Find("Sprites/Default")) { name = "RoutePillar (generated)" };
            for (int i = 0; i < 3; i++)
            {
                _routePillars[i] = new GameObject("Route_pillar_" + i);
                _routePillars[i].transform.SetParent(_routeRoot.transform, false);
                _routeRings[i].Clear();
                for (int n = 0; n < 8; n++)
                {
                    var go = new GameObject("Route_ring");
                    go.transform.SetParent(_routePillars[i].transform, false);
                    var lr = go.AddComponent<LineRenderer>();
                    lr.useWorldSpace = false;
                    lr.loop = true;
                    lr.positionCount = 32;
                    lr.widthMultiplier = 0.25f;
                    lr.material = lineMat;
                    lr.startColor = lr.endColor = new Color(0.8f, 0.95f, 1f, 0.6f);
                    lr.shadowCastingMode = UnityEngine.Rendering.ShadowCastingMode.Off;
                    for (int k = 0; k < 32; k++)
                    {
                        float a = k * Mathf.PI * 2f / 32f;
                        lr.SetPosition(k, new Vector3(Mathf.Cos(a) * GoStory.DraftR, 0f, Mathf.Sin(a) * GoStory.DraftR));
                    }
                    _routeRings[i].Add(lr);
                }
            }
            _routeRoot.SetActive(false);
            Physics.SyncTransforms();
        }

        private void RefreshRoute()
        {
            bool on = !StoryState.OffForTest && GoStory.RouteOn;
            if (_routeRoot != null) _routeRoot.SetActive(on);
            UnregisterRoute();
            if (!on) return;
            for (int i = 0; i < 3; i++)
            {
                bool open = GoStory.RoutePillarOpen(i);
                if (_routePillars[i] != null) _routePillars[i].SetActive(open);
                if (!open) continue;
                _routeCols[i] = new PlayerController.DraftCol { Base = GoStory.RoutePillarPos(i), R = GoStory.DraftR, Top = GoStory.RoutePillarTop(i) };
                PlayerController.ExtraDrafts.Add(_routeCols[i]);
                _routeReg[i] = true;
            }
        }

        private void TickRoute(float dt)
        {
            if (_routeRoot == null || !_routeRoot.activeSelf) return;
            _routeT += dt;
            for (int i = 0; i < 3; i++)
            {
                if (_routePillars[i] == null || !_routePillars[i].activeSelf) continue;
                Vector3 b = GoStory.RoutePillarPos(i);
                float h = GoStory.RoutePillarTop(i) - b.y;
                for (int k = 0; k < _routeRings[i].Count; k++)
                {
                    float f = Mathf.Repeat(_routeT * GoStory.DraftRise / h + k / (float)_routeRings[i].Count, 1f);
                    _routeRings[i][k].transform.position = b + Vector3.up * (f * h);
                }
            }
        }
    }
}
