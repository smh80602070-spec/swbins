# assets/world 안 쓰이는 GLB (생성물 — 손으로 고치지 않는다)

`python saga-godot/tools/unused_world_glb.py` 가 덮어쓴다(G-0058). 직접 = 이름이 코드·씬에 그대로 · 조립 = 접두어 조립 꼴(`"mon_" + id` 등) · 안 씀 = 둘 다 아님.

| 묶음 | 전체 | 직접 | 조립 | 안 씀 |
|---|---|---|---|---|
| `mon_` | 44 | 0 | 44 | 0 |
| `boss_` | 12 | 12 | 0 | 0 |
| `eq_` | 54 | 2 | 52 | 0 |
| `acc_` | 33 | 6 | 0 | 27 |
| `wpn_` | 27 | 0 | 27 | 0 |
| `cave_` | 16 | 4 | 12 | 0 |
| `int_` | 12 | 12 | 0 | 0 |
| `dungeon_` | 11 | 10 | 1 | 0 |
| `loot_` | 20 | 20 | 0 | 0 |
| `pet_` | 11 | 0 | 11 | 0 |
| `rock_` | 5 | 4 | 0 | 1 |
| `tree_` | 9 | 8 | 0 | 1 |
| 그 밖(4개 이하 묶음) | 122 | 89 | 0 | 33 |
| **합계** | **376** | **167** | **147** | **62** |

## 안 쓰는 이름

- `acc_` 27 — acc_antenna · acc_backpack · acc_belt_pouch · acc_cap · acc_cape_short · acc_ear_cat · acc_ear_elf · acc_earring · acc_eyepatch · acc_glasses_round · acc_goggles · acc_halo · acc_holo_visor · acc_horns · acc_jetpack_small · acc_mask_half · acc_necklace · acc_pauldron_spike · acc_quiver · acc_sash · acc_scarf · acc_shoulder_fur · acc_shoulder_gem · acc_tail_cat · acc_tail_fox · acc_wings_small · acc_wrist_band
- `altar_` 1 — altar_base_01
- `armor_` 1 — armor_stand_01
- `bars_` 1 — bars_door_01
- `city_` 1 — city_wall_segment_01
- `cliff_` 1 — cliff_ledge_01
- `counter_` 1 — counter_01
- `display_` 1 — display_stand_01
- `dune_` 1 — dune_01
- `globe_` 1 — globe_stand_01
- `hanging_` 1 — hanging_lantern_01
- `hearth_` 1 — hearth_stone_01
- `hill_` 1 — hill_slope_01
- `kitchen_` 1 — kitchen_pot_01
- `meadow_` 1 — meadow_01
- `mirror_` 1 — mirror_stand_01
- `mountain_` 1 — mountain_01
- `plank_` 1 — plank_bridge_01
- `pond_` 1 — pond_01
- `raft_` 1 — raft_01
- `ridge_` 1 — ridge_01
- `river_` 1 — river_bend_01
- `road_` 1 — road_plain_01
- `rock_` 1 — rock_outcrop_01
- `sail_` 1 — sail_boat_01
- `shelf_` 1 — shelf_wall_01
- `sofa_` 1 — sofa_01
- `spinning_` 1 — spinning_wheel_01
- `table_` 1 — table_wood_01
- `tatami_` 1 — tatami_mat_01
- `temple_` 1 — temple_roof_01
- `tree_` 1 — tree_pine_01_snow
- `wall_` 2 — wall_block_01 · wall_piece_01
- `wardrobe_` 1 — wardrobe_01
- `weapon_` 1 — weapon_rack_01
