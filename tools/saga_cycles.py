"""Cycles device switch shared by the Blender scripts under tools/ (K-0211).

Default is CPU, same as before. SAGA_CYCLES=HIP turns on the HIP devices (Radeon) and renders on the GPU;
use it only when ComfyUI and other GPU jobs are idle (VRAM fights otherwise).
"""
import os


def use(scene):
    scene.cycles.device = 'CPU'
    if os.environ.get('SAGA_CYCLES', '').upper() != 'HIP':
        return
    import bpy
    prefs = bpy.context.preferences.addons['cycles'].preferences
    prefs.compute_device_type = 'HIP'
    prefs.get_devices()
    gpus = [d for d in prefs.devices if d.type == 'HIP']
    if not gpus:
        print('SAGA_CYCLES=HIP but no HIP device found, staying on CPU')
        return
    for d in prefs.devices:
        d.use = d.type == 'HIP'
    scene.cycles.device = 'GPU'
