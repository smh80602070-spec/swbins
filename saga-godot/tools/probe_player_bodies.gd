extends SceneTree
## player_bodies 점검의 러너 래퍼 — 오토로드가 필요해 씬 호스트(tools/scene_probe_host.tscn)를 새 프로세스로 띄워 결과 줄을 그대로 전한다.
## 본체 tools/scene_probes/player_bodies.gd. 끝에 "PROBE player_bodies OK" 또는 "PROBE player_bodies FAIL n".

func _initialize() -> void:
	var out: Array = []
	var rc := OS.execute(OS.get_executable_path(), ["--headless", "--path", ProjectSettings.globalize_path("res://"), "res://tools/scene_probe_host.tscn", "--", "res://tools/scene_probes/player_bodies.gd"], out, true)
	for chunk in out:
		for line in String(chunk).split("\n"):
			if line.begins_with("PROBE ") or line.begins_with("  FAIL") or line.contains("SCRIPT ERROR"):
				print(line)
	if rc != 0 and not "\n".join(PackedStringArray(out)).contains("PROBE player_bodies"):
		print("PROBE player_bodies FAIL 1 (호스트 종료 코드 %d, 결과 줄 없음)" % rc)
	quit(rc)
