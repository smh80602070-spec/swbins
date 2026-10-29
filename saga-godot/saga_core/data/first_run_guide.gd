extends RefCounted
## Ordered, save-compatible first-run guide shared by the four game tracks.

static func ids(missions: Array) -> Array[String]:
	var out: Array[String] = []
	for item: Dictionary in missions:
		out.append(String(item.id))
	return out


static func current(missions: Array, done: Array) -> Dictionary:
	for item: Dictionary in missions:
		if not done.has(item.id):
			return item
	return {}


static func line(missions: Array, done: Array) -> String:
	var item := current(missions, done)
	if item.is_empty():
		return ""
	var completed := 0
	for mission: Dictionary in missions:
		if done.has(mission.id):
			completed += 1
	return "첫걸음 %d/5 %s: %s" % [completed, String(item.name), String(item.hint)]


static func complete_next(missions: Array, done: Array, id: String) -> bool:
	var item := current(missions, done)
	if item.is_empty() or String(item.id) != id:
		return false
	done.append(id)
	return true


static func legacy_complete(missions: Array) -> Array[String]:
	return ids(missions)


static func restore(missions: Array, stored: Variant) -> Array[String]:
	if stored == null:
		return legacy_complete(missions)
	var out: Array[String] = []
	if not stored is Array:
		return out
	for value: Variant in stored:
		if not complete_next(missions, out, String(value)):
			break
	return out
