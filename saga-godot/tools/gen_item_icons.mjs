// G-0016 — 정본 아이콘 표(assets/icons/map.json, K-0035)에서 games/saga_go/data/item_icons.gd 의 표를 만든다. 손으로 고치지 않는다.
//   node saga-godot/tools/gen_item_icons.mjs        (map.json 이 바뀌면 다시 돌린다)
// 대응: 무기 = saga_go-godot:equip:<무기 id> · 재료 = saga-go:material:<id> · 소모품 = saga-go:consumable:<id>
//       성유물 세트 = saga-go:artifact:<번호>(번호 = Artifacts.SET_IDS 순서).
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const map = JSON.parse(fs.readFileSync(path.join(ROOT, 'assets/icons/map.json'), 'utf8'));
const E = map.entries;
const SET_IDS = ['gladiator', 'crimson', 'viridescent', 'emblem', 'depth']; // data/artifacts.gd SET_IDS 와 같아야 한다

const pick = (prefix, strip = (k) => k) => {
  const out = {};
  for (const [k, v] of Object.entries(E)) {
    if (!k.startsWith(prefix) || !v || !v.key) continue;
    out[strip(k.slice(prefix.length))] = [v.key, v.grade];
  }
  return out;
};
const weapon = pick('saga_go-godot:equip:');
const material = pick('saga-go:material:');
const consumable = pick('saga-go:consumable:');
const artifactByNo = pick('saga-go:artifact:');
const artifact = {};
SET_IDS.forEach((id, i) => { if (artifactByNo[String(i)]) artifact[id] = artifactByNo[String(i)]; });
// 재료의 숫자 id(0·1·2 — 옛 표기)는 이름 id 와 같은 그림이라 버린다
for (const k of Object.keys(material)) if (/^\d+$/.test(k)) delete material[k];

const dict = (o) => '{\n' + Object.entries(o).map(([k, [key, g]]) => `\t"${k}": ["${key}", ${g}],`).join('\n') + '\n}';
const out = `## 무기·재료·소모품·성유물 세트 → 아이콘 그림(K-0035). 자동 생성 — 손으로 고치지 않는다.
## 만든 도구: tools/gen_item_icons.mjs (정본 assets/icons/map.json). 값 = [그림 키, 등급(틀 0~4)].
## 그림 파일: res://assets/icons/icon128/<키>_g<등급>.png (등급 틀이 합성된 128px). 표에 없거나 파일이 없으면 null — 화면은 글자만 보인다.
extends RefCounted

const DIR := "res://assets/icons/icon128/"

const WEAPON := ${dict(weapon)}

const MATERIAL := ${dict(material)}

const CONSUMABLE := ${dict(consumable)}

const ARTIFACT_SET := ${dict(artifact)}

static var _cache: Dictionary = {}


static func _entry(kind: String, id: String) -> Array:
	var t: Dictionary
	match kind:
		"weapon": t = WEAPON
		"material": t = MATERIAL
		"consumable": t = CONSUMABLE
		"artifact_set": t = ARTIFACT_SET
		_: return []
	return t.get(id, []) as Array


## 아이콘 한 장(없으면 null). kind = weapon·material·consumable·artifact_set.
static func icon_for(kind: String, id: String) -> Texture2D:
	var e := _entry(kind, id)
	if e.is_empty():
		return null
	var path := "%s%s_g%d.png" % [DIR, String(e[0]), int(e[1])]
	if _cache.has(path):
		return _cache[path]
	var tex: Texture2D = load(path) as Texture2D if ResourceLoader.exists(path) else null
	_cache[path] = tex
	return tex


## 화면에 붙일 TextureRect(px 정사각). 아이콘이 없으면 null.
static func make_rect(kind: String, id: String, px: int) -> TextureRect:
	var tex := icon_for(kind, id)
	if tex == null:
		return null
	var r := TextureRect.new()
	r.texture = tex
	r.custom_minimum_size = Vector2(px, px)
	r.expand_mode = TextureRect.EXPAND_IGNORE_SIZE
	r.stretch_mode = TextureRect.STRETCH_KEEP_ASPECT_CENTERED
	r.mouse_filter = Control.MOUSE_FILTER_IGNORE
	return r


## 빈 TextureRect(px 정사각, 숨김) — 화면을 만들 때 자리만 잡고 _refresh 에서 apply 로 채운다.
static func blank_rect(px: int) -> TextureRect:
	var r := TextureRect.new()
	r.custom_minimum_size = Vector2(px, px)
	r.expand_mode = TextureRect.EXPAND_IGNORE_SIZE
	r.stretch_mode = TextureRect.STRETCH_KEEP_ASPECT_CENTERED
	r.mouse_filter = Control.MOUSE_FILTER_IGNORE
	r.visible = false
	return r


## 이미 만든 TextureRect 의 그림을 바꾼다 — 없으면 숨긴다(자리는 비움).
static func apply(rect: TextureRect, kind: String, id: String) -> void:
	if rect == null:
		return
	var tex := icon_for(kind, id)
	rect.texture = tex
	rect.visible = tex != null
`;
fs.writeFileSync(path.join(ROOT, 'games/saga_go/data/item_icons.gd'), Buffer.from(out.replace(/\n/g, '\r\n'), 'utf8'));
console.log('무기', Object.keys(weapon).length, '재료', Object.keys(material).length, '소모품', Object.keys(consumable).length, '성유물', Object.keys(artifact).length);
