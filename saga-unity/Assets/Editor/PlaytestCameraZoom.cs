using UnityEngine;

namespace Saga.EditorTools
{
    /// <summary>
    /// tasks U-0161(웹 W-0324 · 고돗 G-0294) 휠 줌 한계 — 판 진단이 자기 판 이름으로 부른다(한 프레임 안).
    /// 진짜 카메라를 끝까지 당겨·물려 한계에 서는지, 시작 줌으로 되돌리는지만 본다. 레벨업 컷은 옛 끝(1만리 4 · 2나락 3) 그대로.
    /// </summary>
    public static class PlaytestCameraZoom
    {
        public static bool Run(string tag, string game)
        {
            string T = $"[{tag}] zoom";
            string why = null, info = "";
            switch (game)
            {
                case "go":
                {
                    var rig = Object.FindFirstObjectByType<Saga.Go.Player.CameraRig>();
                    if (rig == null) { why = "CameraRig 없음"; break; }
                    float z0 = rig.CurrentZoom;
                    for (int i = 0; i < 40; i++) rig.ZoomForTest(-1f);
                    float near = rig.CurrentZoom;
                    for (int i = 0; i < 40; i++) rig.ZoomForTest(1f);
                    float far = rig.CurrentZoom;
                    rig.ZoomForTest(z0 - far);
                    if (!Mathf.Approximately(near, Saga.Go.Player.CameraRig.MinZoom) || !Mathf.Approximately(far, Saga.Go.Player.CameraRig.MaxZoom) || near > 2.5f || far < 20f) why = $"1만리 {near}~{far}";
                    else if (!Mathf.Approximately(rig.CurrentZoom, z0)) why = $"1만리 되돌림 {rig.CurrentZoom} ≠ {z0}";
                    info = $"1만리 {near}~{far}(레벨업 {Saga.Go.Player.CameraRig.LevelUpZoom})";
                    break;
                }
                case "dungeon":
                {
                    var rig = Object.FindFirstObjectByType<Saga.Dungeon.Player.CameraRig>();
                    if (rig == null) { why = "CameraRig 없음"; break; }
                    float z0 = rig.CurrentZoom;
                    for (int i = 0; i < 40; i++) rig.ZoomForTest(-1f);
                    float near = rig.CurrentZoom;
                    for (int i = 0; i < 40; i++) rig.ZoomForTest(1f);
                    float far = rig.CurrentZoom;
                    rig.ZoomForTest(z0 - far);
                    if (!Mathf.Approximately(near, Saga.Dungeon.Player.CameraRig.MinZoom) || !Mathf.Approximately(far, Saga.Dungeon.Player.CameraRig.MaxZoom) || near > 2f || far < 14f) why = $"2나락 {near}~{far}";
                    else if (!Mathf.Approximately(rig.CurrentZoom, z0)) why = $"2나락 되돌림 {rig.CurrentZoom} ≠ {z0}";
                    info = $"2나락 {near}~{far}(레벨업 {Saga.Dungeon.Player.CameraRig.LevelUpZoom})";
                    break;
                }
                case "forest":
                {
                    var rig = Object.FindFirstObjectByType<Saga.Forest.Player.CameraRig>();
                    if (rig == null) { why = "CameraRig 없음"; break; }
                    float s0 = rig.Spring;
                    rig.ZoomBy(-40);
                    float near = rig.Spring;
                    rig.ZoomBy(80);
                    float far = rig.Spring;
                    rig.ResetZoom();
                    var cam = rig.GetComponentInChildren<Camera>();
                    float camZ = cam != null ? -cam.transform.localPosition.z : -1f;
                    if (Mathf.Abs(near / s0 - Saga.Forest.Player.CameraRig.MinMul) > 0.01f || Mathf.Abs(far / s0 - Saga.Forest.Player.CameraRig.MaxMul) > 0.01f) why = $"3마을 {near}~{far}";
                    else if (Mathf.Abs(rig.Spring - s0) > 0.01f || Mathf.Abs(camZ - s0) > 0.01f) why = $"3마을 되돌림 {rig.Spring}·카메라 {camZ} ≠ {s0}";
                    info = $"3마을 {near:0.0}~{far:0.0}m";
                    break;
                }
                case "story":
                {
                    var f = Saga.Story.World.StoryCameraFollow.Instance;
                    if (f == null) { why = "StoryCameraFollow 없음"; break; }
                    f.ResetZoomForTest(); // 앞 진단의 레벨업 컷이 돌고 있으면 끊는다
                    float z0 = f.ZDistance, e0 = f.EyeOffset;
                    f.ZoomBy(-40);
                    float near = f.ZDistance, eNear = f.EyeOffset;
                    f.ZoomBy(80);
                    float far = f.ZDistance, eFar = f.EyeOffset;
                    f.ResetZoomForTest();
                    const float Base = 16f;
                    if (Mathf.Abs(near / Base - Saga.Story.World.StoryCameraFollow.MinZMul) > 0.01f || Mathf.Abs(far / Base - Saga.Story.World.StoryCameraFollow.MaxZMul) > 0.01f) why = $"4종횡 {near}~{far}";
                    else if (eNear >= eFar - 0.5f || Mathf.Abs(eNear - Saga.Story.World.StoryCameraFollow.CloseYOffset) > 0.01f) why = $"4종횡 눈높이 {eNear}·{eFar}";
                    else if (Mathf.Abs(f.ZDistance - z0) > 0.01f || Mathf.Abs(f.EyeOffset - e0) > 0.01f) why = $"4종횡 되돌림 {f.ZDistance} ≠ {z0}";
                    info = $"4종횡 {near:0.0}~{far:0.0}m(눈높이 {eNear}~{eFar})";
                    break;
                }
                default: why = "모르는 판 " + game; break;
            }
            if (why != null) { Debug.LogError($"{T} FAIL - {why}"); return false; }
            Debug.Log($"{T} OK - 휠 끝까지 당김·물림 한계 · 시작 줌으로 되돌림 | {info}");
            return true;
        }
    }
}
