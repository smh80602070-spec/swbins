using UnityEngine;

namespace Saga.Go.Data
{
    /// <summary>
    /// U-0049 사가고 무기 모양 → 자체툴(K-0030) 무기 GLB(`Resources/World/wpn_&lt;종류&gt;_&lt;등급&gt;`). 사가고 무기는 인물마다 종류가 정해져 있다(`GoWeapons.TypeOf`) —
    /// 검 → 검(sword)·대검(큰도끼) → 도끼(axe)·장대 → 창(spear)·서책 → 지팡이(staff)·활 → 활(bow). 등급은 무기 희귀도로: 1~2 = common · 3 = rare · 4~5 = legend.
    /// 소켓 규약(K-0030): `grip`(손바닥 중심 = 원점)·`tip`(조준축 끝) 빈 노드 — <see cref="Fit"/> 이 grip→tip 을 소켓 +Y 로 돌려 맞춘다. 모델이 없으면 호출한 쪽이 코드 칼날을 쓴다.
    /// DUNGEON `WeaponModels` 와 같은 로직(다섯 판은 각자 복사본 — 이 asmdef 는 SagaDungeon 을 참조하지 않는다).
    /// </summary>
    public static class GoWeaponModels
    {
        public static readonly string[] GradeNames = { "common", "rare", "legend" };

        public static string Kind(GoWeapons.Type t)
        {
            switch (t)
            {
                case GoWeapons.Type.Claymore: return "axe";
                case GoWeapons.Type.Polearm: return "spear";
                case GoWeapons.Type.Catalyst: return "staff";
                case GoWeapons.Type.Bow: return "bow";
                default: return "sword";
            }
        }

        public static int GradeOf(int rarity) => rarity >= 4 ? 2 : rarity >= 3 ? 1 : 0;

        public static string ModelName(GoWeapons.Type t, int rarity) => $"wpn_{Kind(t)}_{GradeNames[GradeOf(rarity)]}";

        /// <summary>이 판 사람(키 ≈3.4m, 보통 사람의 두 배)이 쥐는 무기 길이(m) — 종류마다.</summary>
        public static float Length(GoWeapons.Type t)
        {
            switch (t)
            {
                case GoWeapons.Type.Polearm: return 3.4f;
                case GoWeapons.Type.Catalyst: return 2.6f;
                case GoWeapons.Type.Bow: return 2.2f;
                case GoWeapons.Type.Claymore: return 1.9f;
                default: return 1.8f;
            }
        }

        /// <summary>U-0051 그 인물이 든 무기의 종류 — 장착 무기가 있으면 그 종류, 없으면 제 종류(`ModelFor` 와 같은 순서).</summary>
        public static GoWeapons.Type TypeFor(string memberId)
        {
            string wid = WeaponState.Equipped(memberId);
            if (GoWeapons.TryGet(wid, out var w)) return w.Type;
            return GoWeapons.TypeOf(memberId);
        }

        /// <summary>그 인물이 든 무기의 모델 이름 — 장착 무기(없으면 제 종류 수련용)의 종류·희귀도로.</summary>
        public static string ModelFor(string memberId)
        {
            string wid = WeaponState.Equipped(memberId);
            if (GoWeapons.TryGet(wid, out var w)) return ModelName(w.Type, w.Rarity);
            return ModelName(GoWeapons.TypeOf(memberId), 1);
        }

        /// <summary>모델 안에서 이름이 같은 가장 얕은 자식(없으면 null).</summary>
        public static Transform FindNode(Transform root, string name)
        {
            if (root.name == name) return root;
            foreach (Transform c in root)
            {
                var f = FindNode(c, name);
                if (f != null) return f;
            }
            return null;
        }

        /// <summary>모델을 소켓 +Y 축(grip→tip)·원점(grip)에 맞춘 지역 회전·위치·배율. 노드가 없으면 false. `targetLength` 는 지역 단위(소켓의 배율은 호출한 쪽이 나눈다).</summary>
        public static bool Fit(GameObject instance, float targetLength, out Quaternion rotation, out Vector3 position, out float scale)
        {
            rotation = Quaternion.identity; position = Vector3.zero; scale = 1f;
            var grip = FindNode(instance.transform, "grip");
            var tip = FindNode(instance.transform, "tip");
            if (grip == null || tip == null) return false;
            var g = instance.transform.InverseTransformPoint(grip.position);
            var t = instance.transform.InverseTransformPoint(tip.position);
            var dir = t - g;
            float len = dir.magnitude;
            if (len < 0.01f) return false;
            rotation = Quaternion.FromToRotation(dir, Vector3.up);
            scale = targetLength > 0f ? targetLength / len : 1f;
            position = -(rotation * g) * scale;
            return true;
        }
    }
}
