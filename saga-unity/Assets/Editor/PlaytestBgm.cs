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
                try { Checks(); }
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
    }
}
