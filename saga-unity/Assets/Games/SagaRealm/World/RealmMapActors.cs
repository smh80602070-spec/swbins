using System.Collections.Generic;
using UnityEngine;
using Saga.Realm.Data;

namespace Saga.Realm.World
{
    /// <summary>
    /// PLAN.md 109-13-2 "지도 위 실제 인물·모션" — 월드맵에 `RealmActorPlan` 배우를 세운다(웹 사가천하 §5-10 ②·④).
    /// 태수는 성 표지 앞(성문 자리)에서 이 달 명령 몸짓, 재야는 제 성 둘레를 느리게 걷는다. 몸은 `RealmBodies`(사실 몸), 표가 없으면 대역 도형(`RealmFigure`).
    /// 지도 축척(카메라 120~420m)에 맞춰 말 크기로 4m. `RealmWorldMap.Rebuild()` 가 끝에 부른다(표지와 같이 다시 짓는다 —
    /// 동작은 시각으로만 정해 다시 지어도 끊기지 않는다). 월드맵이 꺼지면(디오라마 보기) 이 물체도 꺼져 Update 가 안 돈다.
    /// </summary>
    public class RealmMapActors : MonoBehaviour
    {
        public const float FigureHeight = 4f;
        public const float WanderRadius = 3.6f;
        public const float WanderLap = 28f;
        public static readonly Vector3 GovernorOffset = new Vector3(2.2f, 0f, -1.8f);

        private static readonly Color GovernorRobe = new Color(0.2f, 0.36f, 0.7f);
        private static readonly Color WandererRobe = new Color(0.55f, 0.5f, 0.42f);

        private readonly List<RealmFigure> _wanderers = new List<RealmFigure>();
        public int Count { get; private set; }

        /// <summary>배우 층을 다시 짓는다 — `parent` 는 월드맵(표지와 같은 좌표계).</summary>
        public void Rebuild(Transform parent, float centerX, float centerY)
        {
            _wanderers.Clear();
            var plan = RealmActorPlan.FromState();
            Count = 0;
            for (int i = 0; i < plan.Count; i++)
            {
                var a = plan[i];
                var def = RealmCityData.Get(a.CityId);
                if (def == null) continue;
                var at = RealmWorldMap.WorldPos(def, centerX, centerY);
                if (a.Kind == RealmActorPlan.Kind.Governor)
                {
                    // 성문 앞에서 카메라 쪽(-z)을 본다
                    var f = RealmFigure.Create($"Actor_Gov_{a.CityId}", parent, at + GovernorOffset, 180f, GovernorRobe, FigureHeight, i * 0.37f,
                        RealmBodies.Role.Officer, a.OfficerId);
                    f.Play(a.Clip);
                }
                else
                {
                    var f = RealmFigure.Create($"Actor_Wan_{a.OfficerId}", parent, at, 0f, WandererRobe, FigureHeight * 0.95f, i * 0.37f,
                        RealmBodies.Role.Wanderer, a.OfficerId);
                    f.Play("walk");
                    _wanderers.Add(f);
                }
                Count++;
            }
            Tick(Time.time);
        }

        private void Update() => Tick(Time.time);

        private void Tick(float t)
        {
            foreach (var f in _wanderers)
                if (f != null) f.Wander(t, WanderRadius, WanderLap);
        }
    }
}
