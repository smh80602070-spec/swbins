using System.Collections.Generic;
using System.Linq;
using UnityEditor;
using UnityEditor.SceneManagement;
using UnityEngine;
using UnityEngine.Rendering;
using UnityEngine.Rendering.Universal;
using Saga.Core;

namespace Saga.EditorTools
{
    /// <summary>
    /// tasks U-0147 그래픽 기준선 값 점검(고돗 G-0249·웹 W-0291 짝) — 다섯 씬을 차례로 열어(Play 없이, 저장 안 함) 판마다:
    ///   ① 볼륨  GlobalVolume 에 `PlatformVolumeProfile` — PC(블룸·톤매핑·색보정)·폰(블룸·톤매핑·색보정) 프로파일이 다 있음
    ///   ② 톤    판별 `ToneVolume_<판>.asset` 을 쓰는 볼륨이 있음(`BuildGameToneLuts`)
    ///   ③ 그림자 방향광(해) 하나 이상이 Soft 그림자
    ///   ④ 하늘  `SkyPass.ModeFor(씬)` 이 기대값(1만리·3마을·4종횡 하늘+빛 · 5천하 빛만 · 2나락 없음)
    ///   ⑤ 땅    땅 재질이 툰(CelToon) 아님 — 네 판은 `PlaytestGroundLook` 규칙, 2나락은 방 빌더의 `floorMaterial`
    /// + 공통 ⑥ PC 렌더러에 SSAO(켜짐) — 폰 렌더러는 적기만(지금 없음, U-0145 측정).
    /// `-executeMethod Saga.EditorTools.PlaytestGraphicsBaseline.Run` → 판별 표 한 줄씩 + OK/FAIL, 결과 `docs/playcheck/graphics-baseline-<날짜>.json`.
    /// </summary>
    public static class PlaytestGraphicsBaseline
    {
        private struct Game { public string Key, Scene, Tone; public SkyPass.Mode Sky; }
        private static readonly Game[] Games =
        {
            new Game { Key = "1만리", Scene = "TestVillage", Tone = BuildGameToneLuts.GoProfilePath, Sky = SkyPass.Mode.SkyAndLight },
            new Game { Key = "2나락", Scene = "TestDungeon", Tone = BuildGameToneLuts.DungeonProfilePath, Sky = SkyPass.Mode.None },
            new Game { Key = "3마을", Scene = "TestVillageForest", Tone = BuildGameToneLuts.ForestProfilePath, Sky = SkyPass.Mode.SkyAndLight },
            new Game { Key = "4종횡", Scene = "TestField", Tone = BuildGameToneLuts.StoryProfilePath, Sky = SkyPass.Mode.SkyAndLight },
            new Game { Key = "5천하", Scene = "TestCity", Tone = BuildGameToneLuts.RealmProfilePath, Sky = SkyPass.Mode.LightOnly },
        };
        private const string PcRenderer = "Assets/Settings/PC_Renderer.asset", MobileRenderer = "Assets/Settings/Mobile_Renderer.asset";

        /// <summary>진단이 바꿔 볼 수 있게(FAIL 확인용) — 기대 하늘 방식을 덮는다.</summary>
        public static System.Func<string, SkyPass.Mode> ModeForOverride;

        [MenuItem("Saga/Playtest Graphics Baseline")]
        public static void Run()
        {
            PlaytestKit.Begin("[PlaytestGraphicsBaseline]");
            // FAIL 이 나는지 보려면 SAGA_GFX_BREAK=sky — 5천하 기대 하늘을 일부러 틀리게.
            if (System.Environment.GetEnvironmentVariable("SAGA_GFX_BREAK") == "sky") ModeForOverride = s => SkyPass.Mode.SkyAndLight;
            var rows = new List<string>();
            var json = new List<string>();
            using (PlaytestKit.ErrorCounter())
            {
                foreach (var g in Games) rows.Add(CheckGame(g, json));
                bool pcSsao = HasSsao(PcRenderer), mobSsao = HasSsao(MobileRenderer);
                PlaytestKit.Check(pcSsao, "PC 렌더러에 SSAO 없음");
                rows.Add($"SSAO PC {(pcSsao ? "○" : "×")}·폰 {(mobSsao ? "○" : "×")}");
                json.Add($"\"ssao\":{{\"pc\":{(pcSsao ? "true" : "false")},\"mobile\":{(mobSsao ? "true" : "false")}}}");
            }
            foreach (var r in rows) Debug.Log("[PlaytestGraphicsBaseline] " + r);
            WriteJson(json);
            PlaytestKit.Summary("PlaytestGraphicsBaseline");
            if (Application.isBatchMode) EditorApplication.Exit(PlaytestKit.Fails == 0 ? 0 : 1);
        }

        private static string CheckGame(Game g, List<string> json)
        {
            var scene = EditorSceneManager.OpenScene($"Assets/Scenes/{g.Scene}.unity");
            var roots = scene.GetRootGameObjects();

            // ① 볼륨
            var pv = roots.SelectMany(r => r.GetComponentsInChildren<PlatformVolumeProfile>(true)).FirstOrDefault();
            bool vol = pv != null && FullProfile(pv.pcProfile) && FullProfile(pv.mobileProfile);
            PlaytestKit.Check(vol, $"{g.Key}: GlobalVolume(PC·폰 블룸·톤매핑·색보정) 없음/빠짐");

            // ② 판별 톤
            bool tone = roots.SelectMany(r => r.GetComponentsInChildren<Volume>(true))
                .Any(v => v.sharedProfile != null && AssetDatabase.GetAssetPath(v.sharedProfile) == g.Tone);
            PlaytestKit.Check(tone, $"{g.Key}: 판별 톤 볼륨({System.IO.Path.GetFileName(g.Tone)}) 없음");

            // ③ 해 그림자
            var suns = roots.SelectMany(r => r.GetComponentsInChildren<Light>(true)).Where(l => l.type == LightType.Directional).ToList();
            bool soft = suns.Any(l => l.shadows == LightShadows.Soft);
            PlaytestKit.Check(soft, $"{g.Key}: Soft 그림자 방향광 없음(방향광 {suns.Count})");

            // ④ 하늘 방식
            var want = ModeForOverride != null ? ModeForOverride(g.Scene) : g.Sky;
            var mode = SkyPass.ModeFor(g.Scene);
            PlaytestKit.Check(mode == want, $"{g.Key}: 하늘 방식 {mode} ≠ {want}");

            // ⑤ 땅
            string ground = g.Scene == "TestDungeon" ? DungeonFloor(roots) : PlaytestGroundLook.GroundShadersIn(g.Scene);
            PlaytestKit.Check(!string.IsNullOrEmpty(ground) && !ground.Contains("Saga/CelToon"), $"{g.Key}: 땅 {ground}");

            json.Add($"\"{g.Scene}\":{{\"volume\":{B(vol)},\"tone\":{B(tone)},\"softSun\":{B(soft)},\"sky\":\"{mode}\",\"ground\":\"{ground}\"}}");
            return $"{g.Key} 볼륨 {(vol ? "○" : "×")} · 톤 {(tone ? "○" : "×")} · 해 그림자 {(soft ? "○" : "×")} · 하늘 {mode} · 땅 {ground}";
        }

        private static string B(bool v) => v ? "true" : "false";

        private static bool FullProfile(VolumeProfile p) =>
            p != null && p.Has<Bloom>() && p.Has<Tonemapping>() && p.Has<ColorAdjustments>();

        /// <summary>2나락 땅 — 방·통로 빌더가 들고 있는 floorMaterial(씬에 저장된 직렬화 필드)의 셰이더.</summary>
        private static string DungeonFloor(GameObject[] roots)
        {
            var set = new SortedSet<string>();
            foreach (var mb in roots.SelectMany(r => r.GetComponentsInChildren<MonoBehaviour>(true)))
            {
                if (mb == null) continue;
                var prop = new SerializedObject(mb).FindProperty("floorMaterial");
                if (prop != null && prop.propertyType == SerializedPropertyType.ObjectReference && prop.objectReferenceValue is Material m && m.shader != null)
                    set.Add(m.shader.name);
            }
            return string.Join(",", set);
        }

        private static bool HasSsao(string path)
        {
            var data = AssetDatabase.LoadAssetAtPath<ScriptableRendererData>(path);
            return data != null && data.rendererFeatures.Any(f => f != null && f.isActive && f.GetType().Name.Contains("ScreenSpaceAmbientOcclusion"));
        }

        private static void WriteJson(List<string> parts)
        {
            string day = System.DateTime.Now.ToString("yyyyMMdd");
            string dir = System.IO.Path.GetFullPath("docs/playcheck");
            System.IO.Directory.CreateDirectory(dir);
            System.IO.File.WriteAllText(System.IO.Path.Combine(dir, $"graphics-baseline-{day}.json"),
                "{\"ticket\":\"U-0147\",\"date\":\"" + System.DateTime.Now.ToString("yyyy-MM-dd") + "\",\"fails\":" + PlaytestKit.Fails + "," + string.Join(",", parts) + "}\n");
        }
    }
}
