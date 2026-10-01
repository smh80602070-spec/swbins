using System;
using UnityEngine;

namespace Saga.Core
{
    /// <summary>
    /// 배경음 장면 고르기(tasks U-0021) — 판이 준 판정 함수(`town`/`field`/`battle` 중 하나를 돌려준다)를 0.5초마다 불러 <see cref="Bgm.SetScene"/> 으로 넘긴다.
    /// 전투(`battle`)에서 다른 장면으로 돌아갈 땐 <see cref="BattleHoldSeconds"/> 동안 전투 곡을 붙들어 곡이 깜박이지 않게 한다.
    /// 곡 파일이 없는 장면은 `Bgm` 이 폴백 곡 그대로 둔다. 판의 부트스트랩이 <see cref="Attach"/> 로 붙인다(씬 재빌드 없음).
    /// </summary>
    public sealed class BgmSceneDriver : MonoBehaviour
    {
        public const float PollSeconds = 0.5f;
        public const float BattleHoldSeconds = 4f;
        public const string Battle = "battle";

        private Func<string> _pick;
        private float _wait;
        private float _holdUntil = -1f;
        private string _last;

        public static BgmSceneDriver Attach(GameObject go, Func<string> pick)
        {
            var d = go.GetComponent<BgmSceneDriver>();
            if (d == null) d = go.AddComponent<BgmSceneDriver>();
            d._pick = pick;
            return d;
        }

        /// <summary>한 번 판정해 장면을 바꾼다 — Update 와 진단이 부른다. now 는 `Time.unscaledTime`.</summary>
        public void Step(float now)
        {
            string scene = null;
            try { scene = _pick?.Invoke(); }
            catch (Exception e) { Debug.LogWarning($"[BgmSceneDriver] 장면 판정 실패: {e.Message}"); }
            if (string.IsNullOrEmpty(scene)) return;
            if (scene == Battle) _holdUntil = now + BattleHoldSeconds;
            else if (_last == Battle && now < _holdUntil) scene = Battle;
            _last = scene;
            Bgm.SetScene(scene);
        }

        private void Update()
        {
            _wait -= Time.unscaledDeltaTime;
            if (_wait > 0f) return;
            _wait = PollSeconds;
            Step(Time.unscaledTime);
        }
    }
}
