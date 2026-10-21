using UnityEngine;

namespace Saga.Realm.World
{
    /// <summary>
    /// tasks U-0149 5천하 맞힘 손맛 — 전술판(`RealmTacticsView`)·싸움터 컷(`RealmBattlefield`) 카메라에 붙는 짧은 흔들림 + 맞은 자리 불꽃(`HitSpark`).
    /// 2나락·4종횡 흔들림과 같은 결(판끼리 코드 안 나눔). 전술판은 위에서 내려다봐 칸이 흔들려 보이지 않게 작게(맞음 0.04·쓰러짐 0.09m).
    /// 카메라 처음 자리(local)를 기억해 그 둘레로만 흔든다 — 끝나면 제자리.
    /// </summary>
    public class RealmCamShake : MonoBehaviour
    {
        public const float HitMag = 0.04f, HitSec = 0.1f, DieMag = 0.09f, DieSec = 0.2f;

        private Vector3 _base;
        private float _mag, _left, _dur;

        /// <summary>진단 — 흔들림·불꽃을 건 횟수(이번 켬).</summary>
        public static int Count { get; private set; }
        public float Left => _left;

        public static RealmCamShake For(Camera cam)
        {
            if (cam == null) return null;
            var s = cam.GetComponent<RealmCamShake>();
            if (s == null) { s = cam.gameObject.AddComponent<RealmCamShake>(); s._base = cam.transform.localPosition; }
            return s;
        }

        /// <summary>맞음(big=false)·쓰러짐(big=true) — 불꽃을 그 자리에, 카메라를 흔든다.</summary>
        public static void Hit(Camera cam, Vector3 worldPos, bool big)
        {
            Count++;
            Saga.Core.HitSpark.Spawn(worldPos, big);
            var s = For(cam);
            if (s == null) return;
            s._mag = big ? DieMag : HitMag;
            s._left = s._dur = big ? DieSec : HitSec;
        }

        private void LateUpdate()
        {
            if (_left <= 0f) return;
            _left = Mathf.Max(0f, _left - Time.deltaTime);
            transform.localPosition = _left > 0f ? _base + Random.insideUnitSphere * (_mag * _left / Mathf.Max(_dur, 1e-4f)) : _base;
        }
    }
}
