extends RefCounted

## 마을 NPC 몸 — 색 캡슐 대신 GO 의 VRoid 몸(vroid_body.gd)을 인물 도감에서 이름 해시로 골라 입힌다.
## 같은 key 는 늘 같은 인물 몸(머리·옷 색 고정). 몸은 +Z(카메라 쪽)를 본다.

const VroidBody := preload("res://saga_core/world/vroid_body.gd")
const Characters := preload("res://saga_core/data/characters.gd")


static func build(key: String, rarity_cap: int = 3) -> Node3D:
	var pool: Array = []
	for h in Characters.HEROES:
		if int(h.rarity) <= rarity_cap:
			pool.append(h)
	var pick: Dictionary = pool[absi(key.hash()) % pool.size()]
	return VroidBody.build(String(pick.id), int(pick.rarity))
