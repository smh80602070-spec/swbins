using UnityEditor;
using UnityEngine;
using Saga.Core;

namespace Saga.EditorTools
{
    /// <summary>
    /// 배경음 공통 재생 진단(tasks U-0014) — 가짜 곡(`AudioClip.Create`)과 주입 `Bgm.Loader` 로: 폴백 시작·음량 제공자·장면 전환(곡 없음=그대로 /
    /// 곡 있음=교차 페이드)·되돌리기·끄기(음량 0)·곡이 아예 없을 때 오류 0·소리원이 사라진 뒤 다시 시작.
    /// `-executeMethod Saga.EditorTools.PlaytestBgm.Run` → "[PlaytestBgm] OK/FAIL".
    /// </summary>
    public static class PlaytestBgm
    {
        [MenuItem("Saga/Playtest Bgm")]
        public static void Run()
        {
            PlaytestKit.Begin("[PlaytestBgm]");
            using (PlaytestKit.ErrorCounter())
            {
                try { Checks(); ChecksSongs(); ChecksDriver(); }
                finally { Bgm.ResetForTest(); }
            }
            PlaytestKit.Summary("PlaytestBgm");
            if (Application.isBatchMode) EditorApplication.Exit(PlaytestKit.Fails == 0 ? 0 : 1);
        }

        private static bool Near(float a, float b) => Mathf.Abs(a - b) < 0.02f;

        private static void Checks()
        {
            Bgm.ResetForTest();
            var a = AudioClip.Create("bgmA", 4410, 1, 44100, false);
            var b = AudioClip.Create("bgmB", 4410, 1, 44100, false);
            float vol = 0.5f;
            Bgm.Loader = key => null;

            // ① 폴백만 있을 때 — 바로 시작(페이드 없음), 음량 = 제공자
            Bgm.Play("test", "main", a, () => vol);
            PlaytestKit.Check(Bgm.CurrentClip == a && Bgm.CurrentKey == "test-main", $"폴백 시작 clip={Bgm.CurrentClip} key={Bgm.CurrentKey}");
            PlaytestKit.Check(!Bgm.Fading && Near(Bgm.ActiveVolume, 0.5f), $"첫 시작이 바로 제공자 음량이 아님 {Bgm.ActiveVolume}");

            // ② 장면을 바꿨는데 곡 파일이 없다 — 그대로(오류 0), 키만 바뀜
            Bgm.SetScene("battle");
            PlaytestKit.Check(Bgm.CurrentClip == a && !Bgm.Fading && Bgm.CurrentKey == "test-battle", "곡 없는 장면 전환이 곡을 바꿈");

            // ③ 곡이 생기면 교차 페이드
            Bgm.Loader = key => key == "test-battle" ? b : null;
            Bgm.SetScene("battle");
            PlaytestKit.Check(Bgm.CurrentClip == b && Bgm.Fading, "곡이 있는 장면 전환이 페이드를 안 시작함");
            Bgm.Tick(Bgm.FadeSeconds * 0.5f);
            PlaytestKit.Check(Near(Bgm.ActiveVolume, 0.25f) && Near(Bgm.FadingOutVolume, 0.25f), $"페이드 절반 {Bgm.ActiveVolume}/{Bgm.FadingOutVolume} ≠ 0.25/0.25");
            Bgm.Tick(Bgm.FadeSeconds);
            PlaytestKit.Check(!Bgm.Fading && Near(Bgm.ActiveVolume, 0.5f) && Near(Bgm.FadingOutVolume, 0f), $"페이드 끝 {Bgm.ActiveVolume}/{Bgm.FadingOutVolume}");

            // 같은 장면을 또 부르면 안 바뀜
            Bgm.SetScene("battle");
            PlaytestKit.Check(!Bgm.Fading && Bgm.CurrentClip == b, "같은 곡인데 페이드가 다시 시작됨");

            // ④ 되돌리기 — main 은 곡 파일이 없어 폴백 a
            Bgm.SetScene("main");
            Bgm.Tick(Bgm.FadeSeconds * 2f);
            PlaytestKit.Check(Bgm.CurrentClip == a && !Bgm.Fading, "main 으로 되돌아오지 못함");

            // ⑤ 끄기 — 제공자 0 → 소리 0, 켜면 복원
            vol = 0f; Bgm.RefreshVolume();
            PlaytestKit.Check(Near(Bgm.ActiveVolume, 0f), $"끄기 뒤 음량 {Bgm.ActiveVolume}");
            vol = 1f; Bgm.RefreshVolume();
            PlaytestKit.Check(Near(Bgm.ActiveVolume, 1f), $"켜기 뒤 음량 {Bgm.ActiveVolume}");

            // ⑥ 소리원이 사라진 뒤(씬 닫힘) 같은 곡이어도 다시 시작
            var bgmGo = GameObject.Find("SagaBgm");
            PlaytestKit.Check(bgmGo != null, "SagaBgm 소리원 오브젝트가 없음");
            if (bgmGo != null) Object.DestroyImmediate(bgmGo);
            Bgm.Play("test", "main", a, () => vol);
            PlaytestKit.Check(Bgm.CurrentClip == a && Near(Bgm.ActiveVolume, 1f), $"소리원이 사라진 뒤 다시 시작하지 못함 {Bgm.ActiveVolume}");

            // ⑦ 폴백도 곡도 없다 — 조용, 오류 0
            Bgm.ResetForTest();
            Bgm.Loader = key => null;
            Bgm.Play("empty", "main", null, null);
            Bgm.SetScene("battle");
            PlaytestKit.Check(Bgm.CurrentClip == null, "곡이 없는데 CurrentClip 이 null 이 아님");
        }

        // ── tasks U-0021 — 자체 곡 15 + 판별 장면 판정 + 전투 곡 붙들기 ──
        private static readonly string[] Games = { "go", "dungeon", "forest", "story", "realm" };
        private static readonly string[] Scenes = { "town", "field", "battle" };

        private static void ChecksSongs()
        {
            Bgm.ResetForTest(); // 기본 Loader(Resources) 로 되돌린다
            foreach (var g in Games)
                foreach (var s in Scenes)
                {
                    string key = g + "-" + s;
                    var clip = Bgm.Loader(key);
                    PlaytestKit.Check(clip != null && clip.length > 10f, $"곡 {key} 을 Resources 에서 못 찾았거나 너무 짧음");
                    var imp = AssetImporter.GetAtPath(BgmImportSettings.Folder + key + ".ogg") as AudioImporter;
                    PlaytestKit.Check(imp != null && imp.defaultSampleSettings.loadType == AudioClipLoadType.Streaming, $"곡 {key} 가 스트리밍 임포트가 아님");
                }
        }

        private static void ChecksDriver()
        {
            Bgm.ResetForTest();
            // 판별 장면 판정 — 월드가 없을 때의 기본값(사가만리·사가종횡는 플레이어가 없어 판정 보류 = null)
            PlaytestKit.Check(Saga.Go.World.GoBgmScene.Pick() == null, "GO: 플레이어 없는데 장면이 나옴");
            PlaytestKit.Check(Saga.Dungeon.World.DungeonBgmScene.Pick() == "field", "DUNGEON: 지역 추적기 없으면 field");
            PlaytestKit.Check(Saga.Forest.World.ForestBgmScene.Pick() == "town", "FOREST: 존 추적기 없으면 town");
            PlaytestKit.Check(Saga.Realm.World.RealmBgmScene.Pick() == "town", "REALM: 디오라마(지도 안 봄)는 town");
            PlaytestKit.Check(Saga.Story.World.StoryBgmScene.Pick() == null, "STORY: 플레이어 없는데 장면이 나옴");

            // 드라이버 — 전투 곡 붙들기(4초)와 곡 없는 장면
            var a = AudioClip.Create("bgmA", 4410, 1, 44100, false);
            var t = AudioClip.Create("bgmT", 4410, 1, 44100, false);
            var f = AudioClip.Create("bgmF", 4410, 1, 44100, false);
            var bt = AudioClip.Create("bgmB", 4410, 1, 44100, false);
            Bgm.Loader = key => key == "drv-town" ? t : key == "drv-field" ? f : key == "drv-battle" ? bt : null;
            Bgm.Play("drv", "town", a, () => 1f);
            string scene = "town";
            var go = new GameObject("BgmDriverTest");
            try
            {
                var d = BgmSceneDriver.Attach(go, () => scene);
                d.Step(0f);
                PlaytestKit.Check(Bgm.CurrentKey == "drv-town" && Bgm.CurrentClip == t, $"마을 곡 key={Bgm.CurrentKey}");
                scene = "battle"; d.Step(1f);
                PlaytestKit.Check(Bgm.CurrentKey == "drv-battle" && Bgm.CurrentClip == bt, $"전투 곡 key={Bgm.CurrentKey}");
                scene = "field"; d.Step(2f);
                PlaytestKit.Check(Bgm.CurrentKey == "drv-battle", $"전투가 끝난 직후 곡이 바로 바뀜 key={Bgm.CurrentKey}");
                d.Step(1f + BgmSceneDriver.BattleHoldSeconds + 0.1f);
                PlaytestKit.Check(Bgm.CurrentKey == "drv-field" && Bgm.CurrentClip == f, $"붙들기가 끝났는데 들판 곡이 아님 key={Bgm.CurrentKey}");
                scene = null; d.Step(20f);
                PlaytestKit.Check(Bgm.CurrentKey == "drv-field", "판정이 null 인데 장면이 바뀜");
                Bgm.Loader = key => null; scene = "town"; d.Step(30f);
                PlaytestKit.Check(Bgm.CurrentKey == "drv-town" && Bgm.CurrentClip == a, $"곡 없는 장면은 폴백이어야 함 clip={Bgm.CurrentClip}");
            }
            finally { Object.DestroyImmediate(go); Bgm.ResetForTest(); }
        }
    }
}
