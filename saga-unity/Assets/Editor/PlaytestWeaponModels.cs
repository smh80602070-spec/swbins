using UnityEditor;
using UnityEngine;
using Saga.Dungeon.Data;

namespace Saga.EditorTools
{
    /// <summary>
    /// U-0038 A 진단 — 무기 모양 셋(검·창·장갑) × 등급 셋 = 9벌이 `Resources/World/wpn_*` 에서 읽히고, 소켓 노드 `grip`·`tip` 이 있으며,
    /// `WeaponModels.Fit` 이 grip→tip 을 소켓 +Y 로 돌려 grip 을 원점에 둔다(회전 뒤 tip 이 위·grip 은 원점) · 배율이 상식 범위.
    /// `-executeMethod Saga.EditorTools.PlaytestWeaponModels.Run` → "[PlaytestWeaponModels] OK/FAIL".
    /// </summary>
    public static class PlaytestWeaponModels
    {
        [MenuItem("Saga/Playtest Weapon Models")]
        public static void Run()
        {
            PlaytestKit.Begin("[PlaytestWeaponModels]");
            using (PlaytestKit.ErrorCounter())
            {
                foreach (ItemData.WeaponShape shape in System.Enum.GetValues(typeof(ItemData.WeaponShape)))
                    for (int grade = 0; grade < 3; grade++)
                    {
                        string name = WeaponModels.ModelName(shape, grade);
                        var prefab = WeaponModels.Load(shape, grade);
                        if (prefab == null) { PlaytestKit.Fail($"{name} 모델을 못 읽음"); continue; }
                        var go = Object.Instantiate(prefab);
                        bool fit = WeaponModels.Fit(go, 0.7f, out var rot, out var pos, out var sc);
                        PlaytestKit.Check(fit, $"{name}: grip·tip 노드가 없거나 같다");
                        if (fit)
                        {
                            go.transform.SetPositionAndRotation(Vector3.zero, Quaternion.identity);
                            go.transform.localRotation = rot; go.transform.localScale = Vector3.one * sc; go.transform.localPosition = pos;
                            var grip = WeaponModels.FindNode(go.transform, "grip").position;
                            var tip = WeaponModels.FindNode(go.transform, "tip").position;
                            var d = (tip - grip);
                            PlaytestKit.Check(grip.magnitude < 0.01f, $"{name}: grip 이 원점에 안 놓임 {grip}");
                            PlaytestKit.Check(Vector3.Dot(d.normalized, Vector3.up) > 0.99f, $"{name}: grip→tip 이 +Y 가 아님 {d.normalized}");
                            PlaytestKit.Check(Mathf.Abs(d.magnitude - 0.7f) < 0.01f, $"{name}: 길이 {d.magnitude:0.00} ≠ 0.70");
                            PlaytestKit.Check(sc > 0.05f && sc < 10f, $"{name}: 배율 이상 {sc:0.00}");
                            Debug.Log($"[PlaytestWeaponModels] {name}: 배율 {sc:0.00}");
                        }
                        Object.DestroyImmediate(go);
                    }
            }
            PlaytestKit.Summary("PlaytestWeaponModels");
            if (Application.isBatchMode) EditorApplication.Exit(PlaytestKit.Fails == 0 ? 0 : 1);
        }
    }
}
