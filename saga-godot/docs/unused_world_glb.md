# assets/world 안 쓰이는 GLB (생성물 — 손으로 고치지 않는다)

`python saga-godot/tools/unused_world_glb.py` 가 덮어쓴다(G-0058). 직접 = 이름이 코드·씬에 그대로 · 조립 = 접두어 조립 꼴(`"mon_" + id` 등) · 안 씀 = 둘 다 아님.

| 묶음 | 전체 | 직접 | 조립 | 안 씀 |
|---|---|---|---|---|
| `mon_` | 20 | 0 | 0 | 20 |
| `boss_` | 12 | 0 | 0 | 12 |
| `eq_` | 54 | 0 | 0 | 54 |
| `acc_` | 33 | 0 | 0 | 33 |
| `wpn_` | 27 | 0 | 27 | 0 |
| `cave_` | 16 | 1 | 0 | 15 |
| `int_` | 12 | 0 | 0 | 12 |
| `dungeon_` | 11 | 10 | 1 | 0 |
| `loot_` | 20 | 20 | 0 | 0 |
| `rock_` | 5 | 4 | 0 | 1 |
| `tree_` | 9 | 8 | 0 | 1 |
| 그 밖(4개 이하 묶음) | 121 | 55 | 1 | 65 |
| **합계** | **340** | **98** | **29** | **213** |

## 안 쓰는 이름

- `mon_` 20 — mon_cons_01 · mon_cons_02 · mon_cons_03 · mon_cons_04 · mon_quad_01 · mon_quad_02 · mon_quad_03 · mon_quad_04 · mon_serp_01 · mon_serp_02 · mon_serp_03 · mon_serp_04 · mon_spir_01 · mon_spir_02 · mon_spir_03 · mon_spir_04 · mon_wing_01 · mon_wing_02 · mon_wing_03 · mon_wing_04
- `boss_` 12 — boss_01 · boss_02 · boss_03 · boss_04 · boss_05 · boss_06 · boss_07 · boss_08 · boss_09 · boss_10 · boss_11 · boss_12
- `eq_` 54 — eq_future_1_arm · eq_future_1_boot · eq_future_1_chest · eq_future_1_head · eq_future_1_leg · eq_future_1_shoulder · eq_future_2_arm · eq_future_2_boot · eq_future_2_chest · eq_future_2_head · eq_future_2_leg · eq_future_2_shoulder · eq_future_3_arm · eq_future_3_boot · eq_future_3_chest · eq_future_3_head · eq_future_3_leg · eq_future_3_shoulder · eq_past_1_arm · eq_past_1_boot · eq_past_1_chest · eq_past_1_head · eq_past_1_leg · eq_past_1_shoulder · eq_past_2_arm · eq_past_2_boot · eq_past_2_chest · eq_past_2_head · eq_past_2_leg · eq_past_2_shoulder · eq_past_3_arm · eq_past_3_boot · eq_past_3_chest · eq_past_3_head · eq_past_3_leg · eq_past_3_shoulder · eq_present_1_arm · eq_present_1_boot · eq_present_1_chest · eq_present_1_head · eq_present_1_leg · eq_present_1_shoulder · eq_present_2_arm · eq_present_2_boot · eq_present_2_chest · eq_present_2_head · eq_present_2_leg · eq_present_2_shoulder · eq_present_3_arm · eq_present_3_boot · eq_present_3_chest · eq_present_3_head · eq_present_3_leg · eq_present_3_shoulder
- `acc_` 33 — acc_antenna · acc_backpack · acc_belt_pouch · acc_cap · acc_cape_long · acc_cape_short · acc_crown · acc_ear_cat · acc_ear_elf · acc_earring · acc_eyepatch · acc_glasses_round · acc_goggles · acc_halo · acc_hat_pointed · acc_hat_wide · acc_headband · acc_holo_visor · acc_horns · acc_jetpack_small · acc_mask_half · acc_necklace · acc_pauldron_spike · acc_quiver · acc_ribbon · acc_sash · acc_scarf · acc_shoulder_fur · acc_shoulder_gem · acc_tail_cat · acc_tail_fox · acc_wings_small · acc_wrist_band
- `cave_` 15 — cave_corner_01_dirt · cave_corner_01_lava · cave_corner_01_limestone · cave_corridor_01_dirt · cave_corridor_01_lava · cave_corridor_01_limestone · cave_floor_01 · cave_gate_01_lava · cave_gate_01_limestone · cave_room_01_dirt · cave_room_01_lava · cave_room_01_limestone · cave_stairs_01_dirt · cave_stairs_01_lava · cave_stairs_01_limestone
- `int_` 12 — int_barn_01 · int_chinese_hall_01 · int_dungeon_gate_01 · int_eu_house_01 · int_forest_cottage_01 · int_future_dome_01 · int_hanok_01 · int_inn_01 · int_jp_minka_01 · int_modern_block_01 · int_silkroad_house_01 · int_stone_tower_01
- `altar_` 1 — altar_base_01
- `armor_` 1 — armor_stand_01
- `bamboo_` 1 — bamboo_clump_01
- `banner_` 1 — banner_pole_01
- `barn_` 1 — barn_01
- `bars_` 1 — bars_door_01
- `bed_` 2 — bed_futon_01 · bed_wood_01
- `bookshelf_` 1 — bookshelf_01
- `cabinet_` 1 — cabinet_low_01
- `campfire_` 1 — campfire_logs_01
- `caravan_` 1 — caravan_wagon_01
- `chair_` 1 — chair_wood_01
- `chinese_` 1 — chinese_hall_01
- `city_` 1 — city_wall_segment_01
- `cliff_` 1 — cliff_ledge_01
- `counter_` 1 — counter_01
- `desk_` 1 — desk_01
- `display_` 1 — display_stand_01
- `dune_` 1 — dune_01
- `future_` 1 — future_dome_01
- `globe_` 1 — globe_stand_01
- `hanging_` 1 — hanging_lantern_01
- `hearth_` 1 — hearth_stone_01
- `hill_` 1 — hill_slope_01
- `hologram_` 1 — hologram_globe_01
- `inn_` 1 — inn_01
- `jp_` 1 — jp_minka_01
- `kitchen_` 1 — kitchen_pot_01
- `map_` 1 — map_table_01
- `meadow_` 1 — meadow_01
- `mirror_` 1 — mirror_stand_01
- `mountain_` 1 — mountain_01
- `oil_` 1 — oil_lamp_01
- `plank_` 1 — plank_bridge_01
- `pond_` 1 — pond_01
- `raft_` 1 — raft_01
- `ridge_` 1 — ridge_01
- `river_` 1 — river_bend_01
- `road_` 1 — road_plain_01
- `rock_` 1 — rock_outcrop_01
- `rug_` 2 — rug_rect_01 · rug_round_01
- `sail_` 1 — sail_boat_01
- `shelf_` 1 — shelf_wall_01
- `signpost_` 1 — signpost_01
- `silkroad_` 1 — silkroad_house_01
- `sofa_` 1 — sofa_01
- `spinning_` 1 — spinning_wheel_01
- `stool_` 1 — stool_01
- `stove_` 1 — stove_iron_01
- `table_` 3 — table_lamp_01 · table_round_01 · table_wood_01
- `tatami_` 1 — tatami_mat_01
- `temple_` 1 — temple_roof_01
- `tent_` 2 — tent_large_01 · tent_small_01
- `torch_` 1 — torch_stand_01
- `tree_` 1 — tree_pine_01_snow
- `vase_` 1 — vase_tall_01
- `wall_` 2 — wall_block_01 · wall_piece_01
- `wardrobe_` 1 — wardrobe_01
- `weapon_` 1 — weapon_rack_01
- `wheat_` 2 — wheat_growing_01 · wheat_sprout_01
