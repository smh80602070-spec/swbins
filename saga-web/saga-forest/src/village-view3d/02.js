  /** 물 재질(PLAN 12절 "파동·반사") — 나머지 여덟 칸(MeshLambertMaterial)과
   *  달리 `MeshStandardMaterial`을 쓴다. **반사**는 새 렌더패스 없이 공짜로
   *  얻는다 — `scene.environment`(위 HDRI, `loadEnvironment()`)를 three.js가
   *  PBR 재질에 자동으로 물려 준다, 따로 envMap 을 지정할 필요가 없다.
   *  **파동**은 `onBeforeCompile`로 정점 셰이더에 한 줄 얹는다 — `waterWaveY()`와
   *  **같은 식**(주파수·속도·진폭 상수까지)을 GLSL로 그대로 옮겨, 반짝임 점
   *  (`syncWaterRipple`)과 실제 파도가 어긋나지 않게 한다. `instanceMatrix[3].xz`
   *  는 three.js 가 InstancedMesh 용으로 셰이더에 자동으로 얹어 주는 그 칸의
   *  월드 좌표라 새 유니폼 없이 칸마다 다른 위상을 낼 수 있다.
   *  **일부러 안 고친 것** — 칸마다 위상이 달라 이웃 물 칸과 맞닿는 가장자리가
   *  완전히 안 맞물린다(진폭이 4.5cm 뿐이라 눈에 크게 띄진 않는다). 물 전체를
   *  하나의 큰 평면으로 잇는 편이 이음매는 없겠지만 지금의 칸별 InstancedMesh
   *  구조를 갈아엎어야 해서 이번엔 안 건드렸다 */
  /** 물비늘 반짝임(2026-09-19, "고품질 셀 셰이딩급" 요청 이어서 §"물 재질도 다시 검토") —
   *  **재질 자체(PBR+HDRI 반사)는 그대로 둔다**, "반사는 공짜로 얻는다"는
   *  기존 이유가 여전히 맞다(§waterMaterial 머리말). 대신 같은 `onBeforeCompile`
   *  자리에 프래그먼트 항 하나만 더해 — 월드 xz 를 격자로 잘라 칸마다
   *  해시 난수를 뽑고, 문턱값을 넘는 칸만 `uTime`에 따라 반짝이게 한다
   *  (셀 셰이딩 애니메풍 스타일라이즈드 물의 "표면에 잔별처럼 반짝이는" 인상). 손잡이
   *  `village3d.waterSparkle`(기본 1) — 꺼지면 예전 그대로 순수 PBR 반사뿐. */
  function WATER_SPARKLE_ON() { return C().tuned('village3d.waterSparkle', 1) ? true : false; }
  function waterMaterial(t, color, map) {
    var mat = new t.MeshStandardMaterial({ color: color, map: map, roughness: 0.18, metalness: 0.25 });
    var amp = WATER_WAVE_AMP(), freq = WATER_WAVE_FREQ(), speed = WATER_WAVE_SPEED();
    var sparkle = WATER_SPARKLE_ON();
    mat.onBeforeCompile = function (shader) {
      shader.uniforms.uTime = { value: 0 };
      shader.vertexShader = 'uniform float uTime;\n' + shader.vertexShader.replace(
        '#include <begin_vertex>',
        '#include <begin_vertex>\n' +
        '  transformed.y += sin((instanceMatrix[3].x + instanceMatrix[3].z) * ' + freq.toFixed(4) +
        ' + uTime * ' + speed.toFixed(4) + ') * ' + amp.toFixed(4) + ';'
      );
      if (sparkle) {
        shader.vertexShader = shader.vertexShader.replace(
          '#include <common>',
          '#include <common>\nvarying vec2 vSparkleXZ;'
        ).replace(
          '#include <worldpos_vertex>',
          '#include <worldpos_vertex>\nvSparkleXZ = ( modelMatrix * vec4( transformed, 1.0 ) ).xz;'
        );
        shader.fragmentShader = shader.fragmentShader.replace(
          '#include <common>',
          '#include <common>\nuniform float uTime;\nvarying vec2 vSparkleXZ;\nfloat sparkleHash( vec2 p ) { return fract( sin( dot( p, vec2( 12.9898, 78.233 ) ) ) * 43758.5453 ); }'
        ).replace(
          '#include <dithering_fragment>',
          'vec2 sparkleCell = floor( vSparkleXZ * 3.0 );\n' +
          'float sparkleN = sparkleHash( sparkleCell + floor( uTime * 1.6 ) );\n' +
          'float sparkleGlint = step( 0.985, sparkleN ) * ( 0.5 + 0.5 * sin( uTime * 20.0 + sparkleN * 40.0 ) );\n' +
          'gl_FragColor.rgb += sparkleGlint * vec3( 1.0, 0.98, 0.85 ) * 0.6;\n' +
          '#include <dithering_fragment>'
        );
      }
      waterShader = shader;
    };
    return mat;
  }

  /** 종류별 InstancedMesh 를 미리 만들어 둔다 — 칸 수는 매 프레임 늘렸다 줄였다 한다 */
  function initTerrain() {
    var t = three();
    var colors = terrainColors(), k, tileM = tileMeters();
    var geo = new t.PlaneGeometry(tileM, tileM);
    geo.rotateX(-Math.PI / 2);
    /* 물만 잘게 나눈다(4×4) — 파동이 칸 하나를 통째로 기울이지 않고
       칸 안에서도 부드럽게 굽이치게. 나머지 여덟 칸은 안 바뀐 것과 같은 4각형 */
    var waterGeo = new t.PlaneGeometry(tileM, tileM, 4, 4);
    waterGeo.rotateX(-Math.PI / 2);
    var r = GROUND_TILE_R();
    terrainCap = (2 * r + 1) * (2 * r + 1);
    for (k in colors) {
      if (!Object.prototype.hasOwnProperty.call(colors, k)) { continue; }
      var mat = k === 'water' ?
        waterMaterial(t, new t.Color(colors[k]), tileTexture(k)) :
        (global.DG.toon3d ?
          global.DG.toon3d.lambertLike({ color: new t.Color(colors[k]), map: tileTexture(k) }) :
          new t.MeshLambertMaterial({ color: new t.Color(colors[k]), map: tileTexture(k) }));
      var im = new t.InstancedMesh(k === 'water' ? waterGeo : geo, mat, terrainCap);
      im.count = 0;
      scene.add(im);
      terrainMesh[k] = im;
    }
    buildWaterRipple(t);
  }

  /** 마을 좌표 한 타일(`V.TILE`)이 3D 로 몇 미터인지 — village.js 가 없으면(진단 등) 3.2m 기본값 */
  function tileMeters() {
    var V = global.DG.village;
    return (V ? V.TILE : 40) * WORLD_SCALE();
  }

  function resize() {
    if (!renderer || !camera) { return; }
    var w = global.innerWidth, h = global.innerHeight;
    renderer.setSize(w, h, false);
    camera.aspect = w / (h || 1);
    camera.updateProjectionMatrix();
  }

  /** 2D 캔버스와 3D 캔버스는 **하나만 보인다** — 다른 화면의 두 배 켠 자리와 같은 원칙 */
  function syncVisibility() {
    var map2d = document.getElementById('map');
    if (!canvas) { return; }
    var on = active();
    canvas.style.display = on ? 'block' : 'none';
    if (map2d) { map2d.style.display = on ? 'none' : 'block'; }
  }

  function toggle() {
    if (!available()) { return false; }
    C().setTune('village3d.on', ON() ? 0 : 1);
    syncVisibility();
    return ON();
  }

  function buildPlayer() {
    var save = C().save;
    var heroId = (save.party && save.party[0]) || null;
    asset3d().build('hero', { id: heroId || 'me' }, function (g) {   // 동료가 아직 없으면 'me' — 빌린 몸(W-0074)이 고정 한 벌을 준다
      if (!g || !scene) { return; }
      player.group = g;
      player.mixer = g.userData.mixer || null;
      player.actions = g.userData.actions || null;
      player.clipMap = g.userData.clipMap || null;
      g.scale.setScalar(PLAYER_H());
      scene.add(g);
      playAction(player, 'idle');
    });
  }

  /** entity(player 또는 npc3d 한 칸)의 몸짓을 slot(idle/walk 등)으로 바꾼다 */
  function playAction(entity, slot) {
    if (!entity.actions || !entity.clipMap) { return; }
    var name = entity.clipMap[slot];
    if (!name || !entity.actions[name]) { return; }
    var act = entity.actions[name];
    if (entity.action === act) { return; }
    if (entity.action) { entity.action.fadeOut(0.15); }
    act.reset().fadeIn(0.15).play();
    entity.action = act;
  }

  /** 2026-09-10 "더 자연스럽게" — 여태 인물은 걷기·멈춤(idle) 둘만 오갔다.
   *  나무를 흔들거나 낚싯대를 던지거나 상자를 열어도 화면엔 아무 몸짓이 없이
   *  그냥 서 있었다 — `ui.js`의 `doInteract()`가 손을 쓴 순간마다 이 함수를
   *  불러 몸짓을 한 번 튼다. 남은 초(`actionTimer`)는 `syncCamera()`가
   *  매 프레임 줄이며, 그동안은 idle/walk 로 안 덮어쓴다(재생 도중 끊기지
   *  않는다) — 한 번 다 튼 뒤엔 저절로 걷기/멈춤으로 돌아온다. */
  var actionTimer = 0;

  /** §5.8① 낚시 성공 줌 인 — 0.2초 동안 카메라를 살짝 당겼다 되돌린다.
   *  `userZoom`(사람이 손으로 정한 배율)은 그대로 두고, 그 위에 잠깐
   *  덧씌우는 펄스라 손 배율과 안 부딪힌다. */
  var FISH_ZOOM_DUR = 0.2, FISH_ZOOM_PEAK = 0.18;
  var fishZoomTimer = 0;
  function triggerFishZoom() { fishZoomTimer = FISH_ZOOM_DUR; }

  function triggerAction() {
    if (!player.actions || !player.clipMap) { return; }
    var name = player.clipMap.interaction || player.clipMap.attack;
    if (!name || !player.actions[name]) { return; }
    var t = three(), act = player.actions[name];
    if (player.action && player.action !== act) { player.action.fadeOut(0.1); }
    act.reset();
    if (t && t.LoopOnce) { act.setLoop(t.LoopOnce, 1); act.clampWhenFinished = true; }
    act.fadeIn(0.1).play();
    player.action = act;
    var clip = act.getClip();
    actionTimer = (clip && clip.duration) ? clip.duration : 0.6;
  }

  /**
   * 카메라 자리 — **순수 함수다**(사가블로 dungeon3d.js 의 camAim/camAim3rd 와 같은 결이되,
   * 여기는 둘을 딱 자르지 않고 `t`(camTiltMix, 0~1)로 이어 붙인다 — **따로 켜는 버튼이
   * 없다**(2026-09-02 사용자 요청). t=0(어깨너머 3인칭)은 걷는 방향(facingYaw) 뒤를
   * 그대로 따라 돈다. t=1(3/4 부감/쿼터뷰)은 facingYaw 기여가 0 이 되어 걸어도 화면이
   * 안 돌아가는 원작 쿼터뷰가 된다 — 그 사이는 반지름·높이·방위 모두 선형으로 섞는다.
   * 인물은 늘 원점(0,0,0)이라 lookAt 은 호출부에서 고정값 하나로 처리한다.
   */
  function camPose(t, facingYaw, mouseYaw, radius0, height0, radius1, height1) {
    var radius = radius0 + (radius1 - radius0) * t;
    var height = height0 + (height1 - height0) * t;
    var az = mouseYaw + (1 - t) * (facingYaw + Math.PI);
    return { x: Math.sin(az) * radius, y: height, z: Math.cos(az) * radius };
  }

  /** 걸어갈 목표 고리 — village.js moveTarget() 이 있으면 그 땅에 금빛 고리(2D 의 타원과 같은 뜻),
   *  도착·키 입력으로 목표가 지워지면 숨긴다 */
  var walkMark = null;
  function syncWalkMark() {
    var t = three(), V = global.DG.village;
    if (!t || !scene || !V || !V.moveTarget) { return; }
    var mt = V.moveTarget();
    if (!mt) { if (walkMark) { walkMark.visible = false; } return; }
    if (!walkMark) {
      walkMark = new t.Mesh(new t.RingGeometry(0.42, 0.6, 32),
        new t.MeshBasicMaterial({ color: 0xffe296, transparent: true, opacity: 0.9, depthWrite: false, side: t.DoubleSide }));
      walkMark.rotation.x = -Math.PI / 2;
      walkMark.renderOrder = 5;
      scene.add(walkMark);
    }
    var raw = V.raw(), s = WORLD_SCALE(), k = 1 + Math.sin(Date.now() / 140) * 0.14;
    walkMark.position.set((mt.x - raw.player.x) * s, 0.06, (mt.y - raw.player.y) * s);
    walkMark.scale.set(k, k, k);
    walkMark.visible = true;
  }

  /** 화각도 t 로 섞는다 — 순수 함수. 좁아질수록(정사영에 가까워질수록) 원근 왜곡이 준다 */
  function camFov(t, fov0, fov1) { return fov0 + (fov1 - fov0) * t; }

  /** 순수 함수 — 각 a 를 목표 각 b 쪽으로 k(0~1)만큼 **최단 방향**으로 끌어당긴다.
   *  단순히 `a + (b-a)*k` 를 쓰면 -179°→+179° 처럼 경계를 넘는 회전이 반대
   *  방향(먼 길)으로 돌아버린다 — 각 차를 먼저 -π~π 로 접어(wrap) 최단 회전만
   *  고른다. `2026-09-10 "움직이는 모션을 더 자연스럽게"`로 신설 */
  /** 탈것(mount.js) — 발밑에 펫 몸을 세우고 나를 등 높이에 앉힌다. 떠서 가는 탈것은 HOVER 만큼 떠서 출렁인다 */
  function syncMount(dt, moving) {
    var MT = global.DG.mount, ref = MT && MT.petRef ? MT.petRef() : null, sc = scene;
    if (!sc || !player.group) { return; }
    if (mount3.group && (!ref || mount3.id !== ref.id)) {
      sc.remove(mount3.group); mount3.group = null; mount3.id = null; mount3.mixer = null; mount3.actions = null; mount3.clipMap = null; mount3.action = null; mount3.gen++;
    }
    if (!ref) { player.group.position.y = 0; return; }
    if (!mount3.group && mount3.id !== ref.id) {
      var gen = ++mount3.gen; mount3.id = ref.id;
      asset3d().build('pet', ref, function (g) {
        if (!g || gen !== mount3.gen || !scene) { return; }
        g.scale.setScalar(PLAYER_H() * MT.SCALE);
        mount3.group = g; mount3.mixer = g.userData.mixer || null; mount3.actions = g.userData.actions || null; mount3.clipMap = g.userData.clipMap || null;
        scene.add(g);
      });
    }
    var fly = MT.flying(), t = Date.now() / 1000, hover = fly ? PLAYER_H() * MT.HOVER + Math.sin(t * 3) * 0.08 : 0;
    player.group.position.y = PLAYER_H() * MT.RIDER_LIFT + hover;
    if (mount3.group) {
      mount3.group.position.set(0, hover, 0);
      mount3.group.rotation.y = facingYaw;
      if (mount3.actions && mount3.clipMap) {
        var slot = (moving || fly) ? 'walk' : 'idle', name = mount3.clipMap[slot] || mount3.clipMap.walk, act = name ? mount3.actions[name] : null;
        if (act && mount3.action !== act) { if (mount3.action) { mount3.action.fadeOut(0.15); } act.reset().fadeIn(0.15).play(); mount3.action = act; }
      }
      if (mount3.mixer) { mount3.mixer.update(dt); }
    }
  }

  function angleLerp(a, b, k) {
    var d = ((b - a + Math.PI) % (Math.PI * 2) + Math.PI * 2) % (Math.PI * 2) - Math.PI;
    return a + d * k;
  }
  /** 순수 함수 — dt초 동안 TURN_RATE 로 지수감쇠한 보간 계수(0~1). 프레임이
   *  들쭉날쭉해도(저사양 폰) 같은 실제 시간엔 같은 만큼 돈다 */
  function turnLerpK(dt) { return 1 - Math.exp(-TURN_RATE() * Math.max(dt, 0)); }

  /** 걸음 방향 → 카메라가 뒤에서 도는 각. 마을 좌표(x,y) → 3D(x,-z 앞) */
  function syncCamera(dt) {
    var V = global.DG.village;
    if (!V) { return; }
    var raw = V.raw();
    var px = raw.player.x, py = raw.player.y;
    if (!haveLast) { lastPX = px; lastPY = py; haveLast = true; }
    var dx = px - lastPX, dy = py - lastPY;
    var moved = Math.hypot(dx, dy);
    var targetYaw = facingYaw;
    if (moved > MOVE_EPS() * (1 / 60)) {
      targetYaw = Math.atan2(dx, dy);
      if (actionTimer <= 0) { playAction(player, 'walk'); }
    } else if (actionTimer <= 0) {
      playAction(player, 'idle');
    }
    if (actionTimer > 0) { actionTimer = Math.max(0, actionTimer - dt); }
    lastPX = px; lastPY = py;
    /* 목표각으로 한 프레임 만에 스냅하지 않고 부드럽게 돈다 — 카메라(camPose)도
       이 같은 facingYaw 를 물려 쓰므로 몸과 시점이 같이, 같은 속도로 돈다 */
    facingYaw = angleLerp(facingYaw, targetYaw, turnLerpK(dt));

    if (player.group) { player.group.rotation.y = facingYaw; }
    syncMount(dt, moved > MOVE_EPS() * (1 / 60));

    /* userZoom 이 커질수록(확대) 거리를 좁힌다 — 그래서 여기선 나눈다.
       iso 쪽 끝값은 ISO_DIST()·ISO_TILT() 를 camPose 가 쓰던 (수평 반지름, 높이) 짝으로
       미리 풀어 둔다 — camPose 자체는 그 둘의 뜻(거리·기울기)을 몰라도 된다 */
    if (fishZoomTimer > 0) { fishZoomTimer = Math.max(0, fishZoomTimer - dt); }
    var zoomPulse = 1 + FISH_ZOOM_PEAK * (fishZoomTimer / FISH_ZOOM_DUR);
    var radius0 = CAM_DIST() / userZoom / zoomPulse, height0 = CAM_HIGH() / userZoom / zoomPulse;
    var isoDist = ISO_DIST(), isoTilt = ISO_TILT();
    var radius1 = (isoDist * isoTilt) / userZoom / zoomPulse,
        height1 = (isoDist * (1 - isoTilt * 0.55)) / userZoom / zoomPulse;
    var pos = camPose(camTiltMix, facingYaw, mouseYaw, radius0, height0, radius1, height1);
    camera.position.set(pos.x, pos.y, pos.z);
    camera.lookAt(0, PLAYER_H() * 0.75, 0);

    /* 화각도 거리·높이와 함께 섞는다 — 좁아질수록(정사영에 가까워질수록) 핵앤슬래시류
       특유의 평평한 쿼터뷰가 된다. fov 가 안 바뀐 프레임엔 updateProjectionMatrix
       를 또 부르지 않는다(third 에 머물 때 매 프레임 헛일하지 않게) */
    var fov = camFov(camTiltMix, FOV(), ISO_FOV());
    if (Math.abs(camera.fov - fov) > 1e-6) {
      camera.fov = fov;
      camera.updateProjectionMatrix();
    }
  }

  /**
   * 나무·바위·꽃·잡초를 인물 둘레에 세운다 (PLAN 9절 ForestDecorator).
   * **새로 흩뿌리지 않는다** — `V.raw().props` 를 그대로 읽으므로 2D 에서
   * 보던 그 나무가 3D 에서도 같은 자리에 선다. 가깝지만 아직 없으면 짓고
   * (한 프레임에 `MAX_BUILD_PER_STEP()` 개까지만), 멀어지면 치운다.
   */
  function syncScatter(dt) {
    var V = global.DG.village;
    if (!V || !scene) { return; }
    syncTreeSeason();
    var raw = V.raw(), props = raw.props.concat(raw.animals || []), px = raw.player.x, py = raw.player.y;
    var scale = WORLD_SCALE(), renderU = RENDER_R() / scale, cullU = CULL_R() / scale;
    var within = {}, budget = MAX_BUILD_PER_STEP();
    var i, p, key, ent, d;

    for (i = 0; i < props.length; i++) {
      p = props[i];
      if (INST_KIND[p.kind]) { continue; }             // InstancedMesh 경로(syncInstScatter)가 대신 세운다
      key = seasonalTreeKey(SCATTER_KIND[p.kind]);
      if (!key) { continue; }
      d = Math.hypot(p.x - px, p.y - py);
      if (d > cullU) { continue; }                    // 완전히 멀다 — 후보에서도 뺀다
      within[p.id] = true;
      ent = scatter[p.id];
      if (ent && ent.group) {
        ent.group.position.set((p.x - px) * scale, 0, (p.y - py) * scale);
        if (ent.mixer) { ent.mixer.update(dt); }
        /* 짐승만 걷는 쪽으로 몸을 튼다(TURNING_KIND) — 이전 프레임 자리와
           비교해 방향을 잡고, 인물과 같은 지수감쇠로 부드럽게 돈다. 나무처럼
           안 움직이는 건 lastX/lastY 가 애초에 없어 여기 안 들어온다.
           **2026-09-10 마저 — 원본 GLB에 몸짓이 있으면(짐승은 보통 Idle·Walk
           를 갖고 있다) 걷는 동안만 walk 로 틀어 준다**(`asset3d.js`가 이제
           mixer·actions 를 실어 준다, 인물·NPC 와 같은 `playAction()`을 그대로
           쓴다) — 회전만 부드러워지고 다리는 안 움직이던 것까지 마저 고친다 */
        if (TURNING_KIND[p.kind] && ent.lastX != null) {
          var mdx = p.x - ent.lastX, mdy = p.y - ent.lastY;
          var movedNow = Math.hypot(mdx, mdy) > 0.01;
          if (movedNow) {
            ent.yaw = angleLerp(ent.yaw || 0, Math.atan2(mdx, mdy), turnLerpK(dt));
            ent.group.rotation.y = ent.yaw;
          }
          if (ent.actions) { playAction(ent, movedNow ? 'walk' : 'idle'); }
          ent.lastX = p.x; ent.lastY = p.y;
        }
        applyShadowLOD(ent, d);
        continue;
      }
      if (d > renderU) { continue; }                  // cull 과 render 사이 — 있으면 두고, 새로 안 짓는다
      if (ent && ent.building) { continue; }           // 이미 요청해 둔 것 — 또 부르지 않는다

      /* Object Pool(PLAN 40절 PHASE 7) — 같은 kind 를 쌓아 둔 게 있으면 새로
         짓지 않고 그대로 꺼내 쓴다. 예산(budget)을 안 쓴다 — 비동기 build() 가
         아니라 이미 다 만들어진 그룹을 자리만 옮기는 것이라 공짜에 가깝다 */
      var pooled = poolTake(p.kind);
      if (pooled) {
        pooled.scale.setScalar(SCATTER_H[p.kind] || 1);
        pooled.position.set((p.x - px) * scale, 0, (p.y - py) * scale);
        pooled.rotation.y = 0;
        ent = scatter[p.id] = {
          group: pooled, kind: p.kind, building: false, meshes: pooled.userData.lodMeshes, shadowOn: null,
          yaw: 0, lastX: TURNING_KIND[p.kind] ? p.x : null, lastY: TURNING_KIND[p.kind] ? p.y : null,
          /* 몸짓 — 창고 자리도 `asset3d.js`가 그룹의 userData 에 실어 둔 걸 그대로 물려받는다 */
          mixer: pooled.userData.mixer || null, actions: pooled.userData.actions || null,
          clipMap: pooled.userData.clipMap || null, action: null
        };
        if (scene && pooled.parent !== scene) { scene.add(pooled); }
        applyShadowLOD(ent, d);
        continue;
      }

      if (budget <= 0) { continue; }                   // 이번 프레임 몫을 다 썼다
      budget--;
      ent = scatter[p.id] = {
        group: null, kind: p.kind, building: true, meshes: null, shadowOn: null,
        yaw: 0, lastX: TURNING_KIND[p.kind] ? p.x : null, lastY: TURNING_KIND[p.kind] ? p.y : null,
        mixer: null, actions: null, clipMap: null, action: null
      };
      (function (id, kind, wx, wy, dist) {
        asset3d().build(key, { id: id }, function (g) {
          var cur = scatter[id];
          if (!cur) { return; }                        // 그새 멀어져 치워졌다
          cur.building = false;
          if (!g || !scene) { return; }
          g.scale.setScalar(SCATTER_H[kind] || 1);
          g.position.set((wx - px) * scale, 0, (wy - py) * scale);
          g.userData.lodMeshes = collectMeshes(g);
          cur.group = g;
          cur.meshes = g.userData.lodMeshes;
          cur.mixer = g.userData.mixer || null;
          cur.actions = g.userData.actions || null;
          cur.clipMap = g.userData.clipMap || null;
          applyShadowLOD(cur, dist);
          scene.add(g);
        });
      })(p.id, p.kind, p.x, p.y, d);
    }

    /* cullU 밖으로 나간 것만 치운다 — renderU~cullU 사이는 그대로 둔다(경계 깜빡임 방지) */
    for (key in scatter) {
      if (!Object.prototype.hasOwnProperty.call(scatter, key) || within[key]) { continue; }
      ent = scatter[key];
      if (ent.group) { poolGive(ent.kind, ent.group); }
      delete scatter[key];
    }
  }

  var instMesh = {};       // "url|primIdx" → InstancedMesh(재질 하나 몫)
  var instDummy = null;    // 행렬 조립용 임시 Object3D — terrainMesh 의 dummy 와 같은 결
  function instKey(url, i) { return url + '|' + i; }

  /** InstancedMesh 하나를 확보한다 — 자리가 모자라면(need > 지금 칸 수) 두 배로 새로 짓는다.
   *  순수하지 않다(scene·three 를 쓴다) — 자가진단은 instKey 처럼 순수한 조각만 검사한다. */
  function ensureInstMesh(key, geo, mat, need) {
    var im = instMesh[key];
    if (im && im.instanceMatrix.count >= need) { return im; }
    var t = three();
    var cap = Math.max(need, 8, im ? im.instanceMatrix.count * 2 : 0);
    var next = new t.InstancedMesh(geo, mat, cap);
    next.count = 0;
    /* 작은 장식물(잔디·꽃·버섯 등, 0.2~0.8m)이라 스스로 그림자를 드리우진
       않는다(InstancedMesh는 개별 인스턴스 그림자 on/off를 못 준다 — 켜면
       전부, 끄면 전부다. `applyShadowLOD`가 하던 거리별 개별 조절을 대신 못 하니
       아예 끈다. CLAUDE.md 최적화 순서 7번째 "shadow 조절"에 해당하는 선택이다).
       다른 사물의 그림자는 그대로 받는다(receiveShadow=true) — 바닥처럼 어색하지 않다 */
    next.castShadow = false;
    next.receiveShadow = true;
    if (im) { scene.remove(im); im.dispose(); }
    scene.add(next);
    instMesh[key] = next;
    return next;
  }

  /**
   * 잔디·꽃·버섯 등 여덟 종(PLAN 40절 PHASE 7, 위 INST_KIND)을 InstancedMesh로
   * 세운다. `syncScatter()`와 달리 Object Pool도, 예산(budget)도 없다 — 이미
   * 다 구운 지오메트리 자리만 갱신하는 것이라 비동기 build() 비용 자체가 없다.
   * `asset3d.partsFor()`가 아직 못 준 변종(로딩 중)은 이번 프레임엔 그냥
   * 건너뛴다 — 다음 프레임에 다시 물어보면 실린 뒤엔 나온다.
   */
  function syncInstScatter() {
    var V = global.DG.village, t = three();
    if (!V || !scene || !t) { return; }
    if (!instDummy) { instDummy = new t.Object3D(); }
    var raw = V.raw(), px = raw.player.x, py = raw.player.y;
    var scale = WORLD_SCALE(), renderU = RENDER_R() / scale;
    var props = raw.props, i, p, key3d, d, rec;
    var byUrl = {};   // url → { parts, items:[{x,z,h}] }

    for (i = 0; i < props.length; i++) {
      p = props[i];
      if (!INST_KIND[p.kind]) { continue; }
      key3d = SCATTER_KIND[p.kind];
      if (!key3d) { continue; }
      d = Math.hypot(p.x - px, p.y - py);
      if (d > renderU) { continue; }
      rec = asset3d().partsFor(key3d, { id: p.id });
      if (!rec) { continue; }        // 아직 안 실렸다
      var g = byUrl[rec.url] || (byUrl[rec.url] = { parts: rec.parts, items: [] });
      g.items.push({ x: (p.x - px) * scale, z: (p.y - py) * scale, h: SCATTER_H[p.kind] || 1 });
    }

    var url, grp, parts, j, part, im, idx, item, key;
    for (url in byUrl) {
      if (!Object.prototype.hasOwnProperty.call(byUrl, url)) { continue; }
      grp = byUrl[url];
      parts = grp.parts;
      /* 발열(2026-09-24) — 가만히 서 있어도 매 프레임 행렬을 다시 짜 GPU 로 통째로 다시 보냈다. 이번 자리 목록의
         지문이 지난번과 같으면(같은 메시·같은 개수) 건너뛴다 — 뽑거나 베어 목록이 바뀌면 지문이 바뀐다 */
      var sig = grp.items.length;
      for (idx = 0; idx < grp.items.length; idx++) {
        item = grp.items[idx];
        sig = (sig * 31 + item.x * 7.13 + item.z * 3.71 + item.h) % 1e9;
      }
      for (j = 0; j < parts.length; j++) {
        part = parts[j];
        key = instKey(url, j);
        im = ensureInstMesh(key, part.geometry, part.material, grp.items.length);
        if (im.userData.instSig === sig && im.count === grp.items.length) { continue; }
        im.userData.instSig = sig;
        for (idx = 0; idx < grp.items.length; idx++) {
          item = grp.items[idx];
          instDummy.position.set(item.x, 0, item.z);
          instDummy.scale.setScalar(item.h);
          instDummy.rotation.set(0, 0, 0);
          instDummy.updateMatrix();
          im.setMatrixAt(idx, instDummy.matrix);
        }
        im.count = grp.items.length;
        im.instanceMatrix.needsUpdate = true;
      }
    }
    /* 이번 프레임에 하나도 안 쓰인 변종(플레이어가 아예 멀어진 경우)은
       count 를 0 으로 낮춰야 유령처럼 남지 않는다 */
    for (key in instMesh) {
      if (!Object.prototype.hasOwnProperty.call(instMesh, key)) { continue; }
      if (usedInstKey(key, byUrl)) { continue; }
      instMesh[key].count = 0;
      instMesh[key].userData.instSig = null;
    }
  }
  /** 순수 함수 — key("url|idx")의 url이 이번 프레임 byUrl에 있었는지 */
  function usedInstKey(key, byUrl) {
    var url = key.slice(0, key.lastIndexOf('|'));
    return Object.prototype.hasOwnProperty.call(byUrl, url);
  }

  /**
   * 숲 NPC(PLAN 40절 PHASE 4, 2026-09-10부터 여섯)를 플레이어와 같은
   * GLB(`asset3d` 의 'hero' 표, Quaternius RPG Character Pack)로 세운다.
   * 자리가 고정이고 `V.raw().npcs`를 그대로 도는 구조라 늘어도 이 함수는
   * 안 건드린다 — 스캐터처럼 컬링·예산을 두지 않는다(수가 적어서 괜찮다).
   * 없으면 한 번만 짓고, 있으면 자리만 갱신.
   */
  function syncNpcs(dt) {
    var V = global.DG.village;
    if (!V || !scene) { return; }
    var raw = V.raw(), px = raw.player.x, py = raw.player.y, scale = WORLD_SCALE();
    var npcs = (raw.npcs || []).concat(raw.visitors || []), i, npc, slot, seenNpc = {};   // 방문객(§5.9)도 같은 길
    for (i = 0; i < npcs.length; i++) { seenNpc[npcs[i].id] = true; }
    /* 날이 바뀌어 떠난 방문객은 치운다 — 안 치우면 옛 자리(내 기준 상대 좌표)에 남아 나를 따라다닌다 */
    for (var oid in npc3d) {
      if (Object.prototype.hasOwnProperty.call(npc3d, oid) && !seenNpc[oid]) {
        if (npc3d[oid].group && scene) { scene.remove(npc3d[oid].group); }
        delete npc3d[oid];
      }
    }
    for (i = 0; i < npcs.length; i++) {
      npc = npcs[i];
      slot = npc3d[npc.id];
      if (!slot) {
        slot = npc3d[npc.id] = { group: null, mixer: null, actions: null, clipMap: null, action: null, building: true };
        (function (id, body) {
          /* §5.13 — 손님은 제 몸(body: 로봇·우주복·유령·도깨비·작업복)이 있으면 그것으로 선다 */
          asset3d().build('hero', body ? { id: id, body: body } : { id: id }, function (g) {
            var cur = npc3d[id];
            if (!cur) { return; }
            cur.building = false;
            if (!g || !scene) { return; }
            cur.group = g;
            cur.mixer = g.userData.mixer || null;
            cur.actions = g.userData.actions || null;
            cur.clipMap = g.userData.clipMap || null;
            g.scale.setScalar(PLAYER_H());
            scene.add(g);
            playAction(cur, 'idle');
          });
        })(npc.id, npc.body || null);
        continue;
      }
      if (!slot.group) { continue; }   // 아직 짓는 중
      slot.group.position.set((npc.x - px) * scale, 0, (npc.y - py) * scale);
      if (npc.gesture) { visitorGesture(slot, npc, px, py, dt); }
      if (slot.mixer) { slot.mixer.update(dt); }
    }
  }

  /**
   * 방문객 몸짓(§5.10) — 곁(2.2칸)에 오면 나를 돌아보고 4초마다 손짓(interaction 클립 한 번),
   * 부탁을 다 들어준 날(gesture 'dance')은 제자리에서 깡충 뛰며 천천히 돈다. 꼬마는 작게.
   */
  function visitorGesture(slot, npc, px, py, dt) {
    var V = global.DG.village, TL = V.TILE || 32, t = three();
    var dx = px - npc.x, dy = py - npc.y, near = Math.hypot(dx, dy) < TL * 2.2;
    slot.gT = (slot.gT || 0) + dt;
    if (npc.kid) { slot.group.scale.setScalar(PLAYER_H() * 0.7); }
    if (npc.gesture === 'dance') {
      slot.group.position.y = Math.abs(Math.sin(slot.gT * 5.5)) * 0.35 * PLAYER_H();
      slot.yaw = (slot.yaw || 0) + dt * 1.6;
      slot.group.rotation.y = slot.yaw;
      if (slot.actions) { playAction(slot, 'walk'); }
      return;
    }
    if (!near) {
      slot.waveCd = 0.6;
      if (npc.faceX !== undefined) {   // 수다(§5.11) — 상대를 본다
        slot.yaw = angleLerp(slot.yaw || 0, Math.atan2(npc.faceX - npc.x, npc.faceY - npc.y), turnLerpK(dt));
        slot.group.rotation.y = slot.yaw;
      }
      if (slot.waveT > 0) { slot.waveT -= dt; } else { playAction(slot, 'idle'); }
      return;
    }
    slot.yaw = angleLerp(slot.yaw || 0, Math.atan2(dx, dy), turnLerpK(dt));
    slot.group.rotation.y = slot.yaw;
    slot.waveCd = (slot.waveCd === undefined ? 0.6 : slot.waveCd) - dt;
    if (slot.waveT > 0) { slot.waveT -= dt; return; }
    if (slot.waveCd > 0 || !slot.actions || !slot.clipMap) { playAction(slot, 'idle'); return; }
    slot.waveCd = 4;
    var name = slot.clipMap.interaction || slot.clipMap.attack, act = name && slot.actions[name];
    if (!act) { return; }
    if (slot.action && slot.action !== act) { slot.action.fadeOut(0.12); }
    act.reset();
    if (t && t.LoopOnce) { act.setLoop(t.LoopOnce, 1); act.clampWhenFinished = true; }
    act.fadeIn(0.12).play();
    slot.action = act;
    var clip = act.getClip();
    slot.waveT = clip && clip.duration ? clip.duration : 0.8;
  }

  /**
   * 마을 주민(residents, `buildResidents()`가 HEROES 로스터에서 다섯 명을 뽑아
   * 마을 안에 흩어 놓는다 — `folk.js`가 매 프레임 어슬렁거리게 걸음도 준다)을
   * 세운다. **2026-09-11 발견 — 이 함수가 아예 없었다**: `syncNpcs()`는 숲
   * 고정 NPC 여섯(§44)만 다루고, 정작 마을 한복판에서 어슬렁대는 다섯 주민은
   * 2D(`village-view.js`의 `drawResident()`)에만 그려지고 3D에는 한 번도
   * 안 세워졌다 — "3D에서 NPC가 안 보인다" 신고가 안개·거리를 고친 뒤에도
   * 이어진 진짜 이유. 자리 갱신 방식은 `syncNpcs()`와 같되, 주민은 실제로
   * 걸어 다니므로(`folk.js`가 매 프레임 자리를 옮긴다) 걷는 쪽으로 몸을
   * 트는 것만 `syncScatter()`의 짐승 처리(TURNING_KIND)와 같은 결로 보탰다.
   */
  function syncResidents(dt) {
    var V = global.DG.village;
    if (!V || !scene) { return; }
    var raw = V.raw(), px = raw.player.x, py = raw.player.y, scale = WORLD_SCALE();
    var residents = raw.residents || [], i, res, slot;
    for (i = 0; i < residents.length; i++) {
      res = residents[i];
      slot = res3d[res.id];
      if (!slot) {
        slot = res3d[res.id] = {
          group: null, mixer: null, actions: null, clipMap: null, action: null,
          building: true, yaw: 0, lastX: res.x, lastY: res.y
        };
        (function (id) {
          asset3d().build('hero', { id: id }, function (g) {
            var cur = res3d[id];
            if (!cur) { return; }
            cur.building = false;
            if (!g || !scene) { return; }
            cur.group = g;
            cur.mixer = g.userData.mixer || null;
            cur.actions = g.userData.actions || null;
            cur.clipMap = g.userData.clipMap || null;
            g.scale.setScalar(PLAYER_H());
            scene.add(g);
            playAction(cur, 'idle');
          });
        })(res.id);
        continue;
      }
      if (!slot.group) { continue; }   // 아직 짓는 중
      slot.group.position.set((res.x - px) * scale, 0, (res.y - py) * scale);
      if (slot.mixer) { slot.mixer.update(dt); }
      var mdx = res.x - slot.lastX, mdy = res.y - slot.lastY;
      var movedNow = Math.hypot(mdx, mdy) > 0.01;
      if (movedNow) {
        slot.yaw = angleLerp(slot.yaw, Math.atan2(mdx, mdy), turnLerpK(dt));
        slot.group.rotation.y = slot.yaw;
      }
      if (slot.actions) { playAction(slot, movedNow ? 'walk' : 'idle'); }
      slot.lastX = res.x; slot.lastY = res.y;
    }
  }

  var dummy = null;
  var lastTermPx = null, lastTermPy = null, lastTermR = null, lastTermScale = null;

  /**
   * 인물 둘레 타일에 색을 입힌다 (PLAN 7절 지형 다양화 · PLAN 40절 Terrain).
   * `V.tileAt()` 을 그대로 읽으므로 2D 에서 보던 흙길·모래·물이 3D 에서도
   * 같은 자리에 있다 — 여기서도 새 지형을 만들지 않는다.
   */
  function syncTerrain() {
    var V = global.DG.village, t = three();
    if (!V || !scene || !t) { return; }
    var colors = terrainColors(), k;
    if (!Object.keys(colors).length) { return; }     // villageData 가 아직이면 예전 초록 한 장 그대로
    if (!dummy) { dummy = new t.Object3D(); }

    var raw = V.raw(), px = raw.player.x, py = raw.player.y, TILE = V.TILE;
    var scale = WORLD_SCALE();
    var r = GROUND_TILE_R();
    /* 인물이 조금도 안 움직였으면(제자리 idle) 841칸(반경14 기준)을 다시
       돌며 InstancedMesh 버퍼 9개를 통째로 GPU 로 재전송할 필요가 없다 —
       타일 색은 인물 위치만으로 정해지므로 자리가 그대로면 결과도 그대로다
       (감사로 찾은 최우선 낭비, 2026-09-08) */
    if (px === lastTermPx && py === lastTermPy && r === lastTermR && scale === lastTermScale) { return; }
    lastTermPx = px; lastTermPy = py; lastTermR = r; lastTermScale = scale;
    var ptx = Math.floor(px / TILE), pty = Math.floor(py / TILE);

    var idx = {}, kind, tx, ty, wx, wy, im, y;
    for (k in colors) { idx[k] = 0; }
    var rippleCap = WATER_RIPPLE_CAP(), rippleN = 0;

    for (ty = pty - r; ty <= pty + r; ty++) {
      for (tx = ptx - r; tx <= ptx + r; tx++) {
        kind = V.tileAt(tx, ty);
        im = terrainMesh[kind];
        if (!im || idx[kind] >= terrainCap) { continue; }   // 방 안 타일(floor)이나 자리가 다 찬 종류
        wx = tx * TILE + TILE * 0.5;
        wy = ty * TILE + TILE * 0.5;
        y = kind === 'water' ? -WATER_DEPTH() : 0;
        dummy.position.set((wx - px) * scale, y, (wy - py) * scale);
        dummy.updateMatrix();
        im.setMatrixAt(idx[kind]++, dummy.matrix);
        /* 물결 반짝임(PLAN 12절) — 물 칸을 세우는 김에 그 자리를 최대
           rippleCap 개까지만 같이 받아 둔다(새 순회를 더 만들지 않는다) */
        if (kind === 'water' && waterRipplePos && rippleN < rippleCap) {
          waterRipplePos[rippleN * 2] = (wx - px) * scale;
          waterRipplePos[rippleN * 2 + 1] = (wy - py) * scale;
          rippleN++;
        }
      }
    }
    for (k in terrainMesh) {
      if (!Object.prototype.hasOwnProperty.call(terrainMesh, k)) { continue; }
      terrainMesh[k].count = idx[k] || 0;
      terrainMesh[k].instanceMatrix.needsUpdate = true;
    }
    waterRippleCount = rippleN;
  }

  function step(dt) {
    /* 실내 출입은 이벤트를 새로 안 걸었다 — 매 프레임 이미 도는 이 자리에서
       active() 를 다시 재 보는 것만으로 충분하고(들고 나는 순간을 한 프레임
       안에 잡는다), syncVisibility() 자체도 같은 값을 다시 대입하면 그냥
       넘어가는 싸구려 대입이라 매번 불러도 비용이 없다 */
    syncVisibility();
    if (!active() || !renderer || !scene || !camera) { return; }
    /* 그림자 on/off 는 매 프레임 다시 먹인다(사가블로 dungeon3d.js 와 같은 요령) —
       설정 화면에서 등급을 바꿔도 3D 를 껐다 켤 필요 없이 곧바로 듣는다.
       같은 값을 매번 대입해도 three.js 쪽에서 그냥 넘어가므로 "바뀔 때만"을
       따로 가리지 않았다 */
    var q = QUALITY_PRESET[tier()];
    renderer.shadowMap.enabled = q.shadow;
    if (sunLight) { sunLight.castShadow = q.shadow; }
    if (player.mixer) { player.mixer.update(dt); }
    syncCamera(dt);
    syncWalkMark();
    syncTerrain();
    syncWaterRipple(dt);
    syncScatter(dt);
    syncInstScatter();
    syncNpcs(dt);
    syncResidents(dt);
    syncSky();
    syncWeatherFX(dt);
    syncMeteor();
    renderer.render(scene, camera);
  }

  global.DG = global.DG || {};
  global.DG.villageView3d = {
    init: init, resize: resize, step: step, toggle: toggle,
    active: active, available: available, on: ON,
    /** ui.js 의 doInteract() 가 손을 쓴 순간마다 부른다 — 나무 흔들기·낚시
     *  던지기·상자 열기 등에 몸짓 한 번(interaction/attack 클립). 그런 클립이
     *  없는 조합이면 조용히 아무 일도 안 한다 */
    triggerAction: triggerAction, triggerFishZoom: triggerFishZoom,
    /** 진단 전용 — 지금 한 번짜리 몸짓이 재생 중이면 남은 초(순수 상태 조회) */
    actionTimer: function () { return actionTimer; },
    fishZoomTimer: function () { return fishZoomTimer; },
    /** 진단·QA 전용 — 세로 드래그로 잇는 시점 높이(0 어깨너머~1 부감), 진단용 순수 함수 */
    camTiltMix: function () { return camTiltMix; },
    setCamTiltMix: setCamTiltMix,
    camPose: camPose, camFov: camFov,
    /** 진단 전용 — 2026-09-10 "움직이는 모션을 더 자연스럽게": 각도 보간·감쇠 순수 함수 */
    angleLerp: angleLerp, turnLerpK: turnLerpK,
    /** 진단 전용 — 지금 화면에 세워진 짐승이 걷는 쪽으로 몸을 트는 표 */
    turningKind: function () { return TURNING_KIND; },
    /** 진단 전용 — 표(순수 함수)와 지금 세운 개수 */
    scatterKind: function () { return SCATTER_KIND; },
    scatterCount: function () { return Object.keys(scatter).length; },
    /** 진단 전용 — 계절이 'tree' 겉모습을 바꾸는 표(가을·눈·자작나무) */
    seasonalTreeKey: seasonalTreeKey,
    /** 진단 전용 — PLAN 40절 PHASE 7: InstancedMesh 로 옮긴 장식물 표·개수 */
    instKind: function () { return INST_KIND; },
    instKey: instKey,
    usedInstKey: usedInstKey,
    instMeshCount: function () { return Object.keys(instMesh).length; },
    terrainColors: terrainColors,
    terrainCount: function (kind) {
      var im = terrainMesh[kind];
      return im ? im.count : 0;
    },
    /** 진단 전용 — 지금 하늘·안개에 먹인 바이옴 색 표 */
    fogColors: function () { return FOG_COLOR; },
    /** 진단 전용 — PLAN 40절 PHASE 5 Day/Night: 시간대별 밝기·조명 표, hex 어둡히기 순수 함수 */
    phaseLight: function () { return { dark: PHASE_DARK, sun: PHASE_SUN, hemi: PHASE_HEMI }; },
    darken: darken,
    /** 진단 전용 — PLAN 40절 PHASE 5 Weather/Ambient: 날씨→파티클, 밤 반딧불이, 낙하 감기(모두 순수 함수) */
    weatherShows: weatherShows,
    fireflyVisible: fireflyVisible,
    fireflyPlotOf: fireflyPlotOf,
    /** 진단 전용 — village.js 사물 kind 가 3D 에 서는가(표에 든 asset3d 키·눈높이) */
    scatterOf: function (kind) { return SCATTER_KIND[kind] ? { asset: SCATTER_KIND[kind], h: SCATTER_H[kind] } : null; },
    wrapY: wrapY,
    skyDark: skyDark,
    weatherFog: function (wk) { return WEATHER_FOG[wk] != null ? WEATHER_FOG[wk] : 1; },
    /** 진단 전용 — PLAN 40절 PHASE 6 Mobile 품질: 등급표(순수)와 기기 점수→등급 순수 함수 */
    qualityPreset: function () { return QUALITY_PRESET; },
    deviceScore: deviceScore,
    tierFor: tierFor,
    /** 설정 화면(⚙️) — 지금 실제로 도는 등급(low/medium/high), 손잡이 원값('auto' 포함), 고르기 */
    quality: tier, qualityRaw: QUALITY, setQuality: setQuality,
    fogOn: FOG_ON, setFogOn: setFogOn,
    /** 진단 전용 — 하늘 그라디언트 구(§ SKY_ON), 손잡이·인스턴스 조회 */
    skyOn: SKY_ON, setSkyOn: setSkyOn,
    skyDome: function () { return skyDome; },
    /** 진단 전용 — 물 반짝임 손잡이(재질 생성 시점 값이라 되돌리려면 3D 를 다시 켜야 한다) */
    waterSparkleOn: WATER_SPARKLE_ON,
    /** 진단 전용 — 2026-09-10 "실내에선 3D를 끈 것처럼" 고침: ready 와 무관하게
     *  지금 집·동굴 안이라 3D가 눌려 있는지만 순수하게 본다 */
    indoorSuppressed: indoorSuppressed,
    /** 진단 전용 — PLAN 40절 PHASE 7 Object Pool: kind별 재사용 창고(순수 함수, mock group 으로도 확인됨) */
    poolTake: poolTake,
    poolGive: poolGive,
    poolSize: poolSize,
    scatterPoolCap: function () { return SCATTER_POOL_CAP; },
    /** 진단 전용 — PLAN 40절 PHASE 7 LOD: 거리 기반 그림자 켜고 끄기 순수 함수 */
    wantShadowAt: wantShadowAt,
    /** 진단·QA 전용 — 사람이 핀치·휠로 조절한 확대 배율 */
    userZoom: function () { return userZoom; },
    setUserZoom: setUserZoom,
    /** 진단·QA 전용 — 사람이 드래그로 돌린 시점 덧각(라디안) */
    mouseYaw: function () { return mouseYaw; },
    setMouseYaw: function (y) { mouseYaw = y; },
    /** Q12 — 카메라 방위(키·조이스틱을 돌리는 각)와 화면 한 점이 짚는 땅(마을 좌표). 진단·확인용으로도 쓴다 */
    camAz: camAz, groundAt: groundAt,
    /** 진단 전용 — PLAN 12절 물 표현: 파동 순수 함수와 반짝임 점 상태 */
    waterWaveY: waterWaveY,
    waterWaveAmp: WATER_WAVE_AMP, waterWaveSpeed: WATER_WAVE_SPEED,
    waterRippleCount: function () { return waterRippleCount; },
    /** 진단 전용 — 숲 NPC 3D 인물이 지금 몇 명 세워졌나(scene 에 실제로 올라간 group 수) */
    npcMeshCount: function () {
      var k, n = 0;
      for (k in npc3d) { if (Object.prototype.hasOwnProperty.call(npc3d, k) && npc3d[k].group) { n++; } }
      return n;
    },
    /** 진단 전용 — 2026-09-11 신설: 마을 주민(residents) 3D 인물이 지금 몇 명 세워졌나 */
    residentMeshCount: function () {
      var k, n = 0;
      for (k in res3d) { if (Object.prototype.hasOwnProperty.call(res3d, k) && res3d[k].group) { n++; } }
      return n;
    },
    /** 진단 전용 — camera 가 지금 원점(플레이어)에서 얼마나 떨어져 있나(world 단위) */
    camDistNow: function () { return camera ? camera.position.length() : null; },
    /** 진단 전용 — PLAN 20절 랜덤 이벤트(유성): town.starNow() → 3D 자리·방향·밝기 순수 함수 */
    meteorPose: meteorPose,
    meteorVisible: function () { return meteorGroup ? meteorGroup.visible : false; }
  };
})(typeof window !== 'undefined' ? window : this);
