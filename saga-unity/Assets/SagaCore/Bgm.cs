using System;
using System.Collections.Generic;
using UnityEngine;

namespace Saga.Core
{
    /// <summary>
    /// 배경음 공통 재생(tasks U-0014) — 다섯 판 `*Audio.PlayBgm`(곡 하나 반복)이 복사해 갖던 것을 합치고 장면별 곡·교차 페이드를 더했다.
    /// 곡 고르기: <see cref="Loader"/>(`<판>-<장면>` → 기본 `Resources/Audio/Bgm/<판>-<장면>`) → 없으면 그 판의 폴백(부트스트랩이 주던 곡) →
    /// 없으면 조용(오류 없음). 곡이 바뀌면 두 AudioSource 가 <see cref="FadeSeconds"/> 동안 교차 페이드, 같은 곡이면 안 바꾼다.
    /// 최종 음량 = 판이 준 제공자 값(`Master×Bgm` — PlayerPrefs 키·설정 UI 는 판별 `*Audio` 그대로).
    /// 소리원은 씬에 속한다(예전과 같다) — 씬이 닫히면 음악도 끝나고, 새 씬의 `Play` 가 다시 시작한다.
    /// </summary>
    public static class Bgm
    {
        public const float FadeSeconds = 1.5f;

        /// <summary>곡 찾기 — 키는 `<판>-<장면>`. 진단이 바꾼다.</summary>
        public static Func<string, AudioClip> Loader = key => Resources.Load<AudioClip>("Audio/Bgm/" + key);

        private sealed class GameInfo
        {
            public AudioClip Fallback;
            public Func<float> Volume = () => 1f;
        }

        private static readonly Dictionary<string, GameInfo> Games = new Dictionary<string, GameInfo>();
        private static string _game, _scene;
        private static AudioSource _a, _b, _cur, _old;
        private static float _fade = 1f;

        /// <summary>마지막으로 부탁한 키(`<판>-<장면>`) — 곡이 없어 폴백/무음이어도 이 키는 바뀐다.</summary>
        public static string CurrentKey => _game == null ? null : _game + "-" + _scene;

        /// <summary>지금 틀려는 곡(없으면 null = 무음).</summary>
        public static AudioClip CurrentClip { get; private set; }

        public static bool Fading => _fade < 1f;

        /// <summary>지금 곡 소리원의 음량(진단용).</summary>
        public static float ActiveVolume => _cur != null ? _cur.volume : 0f;

        /// <summary>사라지는 중인 이전 곡의 음량(진단용).</summary>
        public static float FadingOutVolume => _old != null ? _old.volume : 0f;

        /// <summary>판의 부트스트랩이 부른다 — 폴백 곡·음량 제공자를 기록하고 장면을 시작한다.</summary>
        public static void Play(string game, string scene, AudioClip fallback, Func<float> volume)
        {
            if (string.IsNullOrEmpty(game)) return;
            if (!Games.TryGetValue(game, out var info)) Games[game] = info = new GameInfo();
            if (fallback != null) info.Fallback = fallback;
            info.Volume = volume ?? (() => 1f);
            _game = game;
            EnsureSources();
            Switch(scene);
        }

        /// <summary>장면을 바꾼다(곡 파일이 없으면 폴백 그대로라 아무 일도 안 일어난다).</summary>
        public static void SetScene(string scene)
        {
            if (_game == null || _a == null || _b == null) return;
            Switch(scene);
        }

        /// <summary>설정에서 BGM 켜기/끄기를 눌렀을 때 — 이미 도는 곡에 바로 반영.</summary>
        public static void RefreshVolume() => Tick(0f);

        /// <summary>구동자 Update(와 진단)가 부른다 — 페이드를 진행하고 음량을 맞춘다.</summary>
        public static void Tick(float dt)
        {
            if (_game == null || _cur == null) return;
            float target = Mathf.Clamp01(Games[_game].Volume());
            if (_fade < 1f) _fade = Mathf.Min(1f, _fade + dt / FadeSeconds);
            if (CurrentClip != null) _cur.volume = target * _fade;
            if (_old != null)
            {
                _old.volume = target * (1f - _fade);
                if (_fade >= 1f) { _old.Stop(); _old.clip = null; _old = null; }
            }
        }

        /// <summary>진단용 — 소리원·상태를 비운다.</summary>
        public static void ResetForTest()
        {
            foreach (var s in new[] { _a, _b }) if (s != null) UnityEngine.Object.DestroyImmediate(s.gameObject);
            _a = _b = _cur = _old = null;
            CurrentClip = null; _game = _scene = null; _fade = 1f;
            Games.Clear();
            Loader = key => Resources.Load<AudioClip>("Audio/Bgm/" + key);
        }

        private static void EnsureSources()
        {
            if (_a != null && _b != null) return;
            // 씬이 닫혀 소리원이 사라졌다 — 새로 만들고 상태를 비운다(그래서 같은 곡이어도 새 씬에서 다시 시작한다).
            var go = new GameObject("SagaBgm");
            _a = Make(go); _b = Make(go);
            go.AddComponent<BgmDriver>();
            _cur = _a; _old = null; CurrentClip = null; _fade = 1f;
        }

        private static AudioSource Make(GameObject go)
        {
            var s = go.AddComponent<AudioSource>();
            s.playOnAwake = false;
            s.loop = true;
            s.volume = 0f;
            return s;
        }

        private static AudioClip Resolve(string game, string scene)
        {
            AudioClip c = null;
            try { c = Loader?.Invoke(game + "-" + scene); }
            catch (Exception e) { Debug.LogWarning($"[Bgm] 곡 찾기 실패 {game}-{scene}: {e.Message}"); }
            return c != null ? c : Games[game].Fallback;
        }

        private static void Switch(string scene)
        {
            _scene = scene;
            var clip = Resolve(_game, scene);
            if (clip == CurrentClip) { Tick(0f); return; }
            bool instant = CurrentClip == null || clip == null;     // 처음 시작하거나 끝낼 땐 페이드 없이
            if (_old != null) { _old.Stop(); _old.clip = null; _old = null; }
            var prev = _cur;
            _cur = _cur == _a ? _b : _a;
            CurrentClip = clip;
            if (clip != null) { _cur.clip = clip; _cur.volume = 0f; _cur.Play(); }
            else _cur.Stop();
            if (instant)
            {
                prev.Stop(); prev.clip = null; _old = null; _fade = 1f;
            }
            else { _old = prev; _fade = 0f; }
            Tick(0f);
        }

        private sealed class BgmDriver : MonoBehaviour
        {
            private void Update() => Tick(Time.unscaledDeltaTime);
        }
    }
}
