using Saga.Core;
using Saga.Forest.Data;
using Saga.Forest.UI;
using UnityEngine;
using UnityEngine.UI;

namespace Saga.Forest.World
{
    /// <summary>
    /// tasks U-0229 런타임 — ① 별똥별: 밤(`ForestStars.IsNight`)에 마을 밖(`ForestZoneTracker.CurrentZone` ≥ 0)이면 그 밤·순번으로 정한 25~60초마다
    /// 하늘에 빛줄기(트레일 렌더러 — 새 에셋 없음) + 3초 「🌠 소원 빌기」 단추. 마을로 들어오면(존 ≥0 → −1) 지난 밤 소원을 열매로 받음.
    /// ② 생일 아침 토스트 — 판을 켠 날(날이 바뀌면 다시) 오늘 생일인 주민을 한 줄. `ForestBootstrap.Start` 가 붙인다.
    /// </summary>
    public class ForestStarSky : MonoBehaviour
    {
        public static ForestStarSky Instance { get; private set; }

        public int Streaks { get; private set; }
        public bool ButtonShown => _btn != null && _btn.gameObject.activeSelf;
        public int LastClaim { get; private set; }

        private float _next = -1f, _btnLeft;
        private int _night = int.MinValue, _n, _lastZone = int.MinValue, _toastDay = int.MinValue;
        private Button _btn;

        public static ForestStarSky Install()
        {
            if (Instance != null) return Instance;
            var go = new GameObject("ForestStarSky");
            return go.AddComponent<ForestStarSky>();
        }

        private void Awake()
        {
            Instance = this;
            var canvas = SagaUi.NewHudCanvas("StarWishCanvas", 30, transform);
            _btn = SagaUi.NewButton(canvas.transform, "Btn_Wish", ForestLocalization.T("stars.wish", "🌠 소원 빌기"),
                new Vector2(0.5f, 0f), new Vector2(0f, 230f), new Vector2(340f, 96f), SagaUi.ButtonAccent);
            _btn.onClick.AddListener(PressWish);
            _btn.gameObject.SetActive(false);
        }

        private void OnDestroy() { if (Instance == this) Instance = null; }

        private void Update()
        {
            int zone = ForestZoneTracker.Instance != null ? ForestZoneTracker.Instance.CurrentZone : -1;
            Step(Time.deltaTime, zone);
        }

        /// <summary>한 프레임(진단은 시간·존을 넘겨 직접 부른다).</summary>
        public void Step(float dt, int zone)
        {
            // 생일 아침 토스트(그날 한 번)
            int today = ForestVisitors.Today;
            if (_toastDay != today)
            {
                _toastDay = today;
                var bd = ForestBirthdays.Today(today);
                if (bd.Count > 0) DialogueLabel.Instance?.Show(string.Format(ForestLocalization.T("birthday.toast", "🎂 오늘은 {0} 생일 — 말을 걸어 축하해 주자"), string.Join(" · ", bd.ConvertAll(ForestBirthdays.Name))), 4f);
            }
            // 마을로 들어옴 → 지난 밤 소원
            if (zone < 0 && (_lastZone >= 0 || _lastZone == int.MinValue))
            {
                LastClaim = ForestStars.ClaimOnVillage();
                if (LastClaim > 0) DialogueLabel.Instance?.Show(string.Format(ForestLocalization.T("stars.claim", "🌠 지난밤 소원이 이루어졌다 — 열매 +{0}"), LastClaim), 4f);
            }
            _lastZone = zone;

            if (_btnLeft > 0f) { _btnLeft -= dt; if (_btnLeft <= 0f) _btn.gameObject.SetActive(false); }
            var now = ForestStars.NowFn();
            if (!ForestStars.On || !ForestStars.IsNight(now) || zone < 0) { _next = -1f; return; }
            int key = ForestStars.NightKey(now);
            if (key != _night) { _night = key; _n = 0; _next = -1f; }
            if (_next < 0f) _next = ForestStars.GapOf(_night, _n);
            _next -= dt;
            if (_next > 0f) return;
            _n++; _next = -1f;
            Shoot();
        }

        /// <summary>별똥별 하나 — 빛줄기 + 3초 단추(이 밤 다섯을 다 빌었으면 줄기만).</summary>
        public void Shoot()
        {
            Streaks++;
            var cam = Camera.main;
            if (cam != null)
            {
                var go = new GameObject("ShootingStar");
                var a = cam.transform.position + cam.transform.forward * 60f + cam.transform.right * -25f + Vector3.up * 35f;
                go.transform.position = a;
                var tr = go.AddComponent<TrailRenderer>();
                tr.time = 0.6f; tr.startWidth = 0.6f; tr.endWidth = 0f;
                tr.material = new Material(Shader.Find("Sprites/Default")) { name = "ShootingStar (generated)" };
                tr.startColor = new Color(1f, 0.95f, 0.8f, 1f); tr.endColor = new Color(0.7f, 0.8f, 1f, 0f);
                go.AddComponent<StarFlight>().Init(a, a + cam.transform.right * 50f + Vector3.down * 15f, 1.2f);
            }
            if (ForestStars.WishesTonight < ForestStars.MaxWishes) { _btn.gameObject.SetActive(true); _btnLeft = ForestStars.ButtonSec; }
        }

        /// <summary>단추 누름(진단도 부른다).</summary>
        public void PressWish()
        {
            if (!ButtonShown) return;
            if (ForestStars.Wish()) DialogueLabel.Instance?.Show(string.Format(ForestLocalization.T("stars.wished", "🌠 소원을 빌었다 ({0}/{1}) — 내일 마을에서"), ForestStars.WishesTonight, ForestStars.MaxWishes), 2.5f);
            _btn.gameObject.SetActive(false); _btnLeft = 0f;
        }

        private sealed class StarFlight : MonoBehaviour
        {
            private Vector3 _a, _b; private float _t, _dur;
            public void Init(Vector3 a, Vector3 b, float dur) { _a = a; _b = b; _dur = dur; }
            private void Update()
            {
                _t += Time.deltaTime;
                transform.position = Vector3.Lerp(_a, _b, _t / _dur);
                if (_t > _dur + 0.7f) Destroy(gameObject);
            }
        }
    }
}
