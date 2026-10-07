#!/usr/bin/env node
/**
 * 부품 합치기 — 노드·메시가 부품마다 따로인 GLB(킷배싱 조립품 등)를 **같은 재질끼리 한 프리미티브로** 묶는다.
 *
 * 왜: three 는 프리미티브 하나가 그리기 호출 하나다. 사가천하 동양풍 탑(`city_t2_asian` 20부품·`city_t3_asian`
 * 40부품, 재질 4)이 성마다 서 있어 첫 화면 그리기 호출 892번 중 수백을 먹었다(2026-09-25 폰 점검).
 * 합치면 탑 하나가 재질 수(4)만큼만 그린다. 노드 변환을 정점에 구워 넣으므로 **모양·UV·색은 그대로**다.
 *
 * 어떻게: flatten(노드 계층 펴기) → join(같은 재질·같은 속성끼리 합치기) → dedup·prune(빈 노드·쓰지 않는 것 걷기).
 * 스킨·모프·애니가 든 GLB 에는 쓰지 않는다(join 이 건너뛰긴 하지만 뜻이 없다).
 *
 * 사용법: node join-parts.mjs <in.glb> <out.glb>     (in = out 이면 제자리)
 */
import { NodeIO } from '@gltf-transform/core';
import { ALL_EXTENSIONS } from '@gltf-transform/extensions';
import { dedup, flatten, join, prune } from '@gltf-transform/functions';
import { MeshoptDecoder, MeshoptEncoder } from 'meshoptimizer';

const [src, dst] = process.argv.slice(2);
if (!src || !dst) { console.error('사용법: node join-parts.mjs <in.glb> <out.glb>'); process.exit(1); }

await MeshoptDecoder.ready; await MeshoptEncoder.ready;
const io = new NodeIO().registerExtensions(ALL_EXTENSIONS)
  .registerDependencies({ 'meshopt.decoder': MeshoptDecoder, 'meshopt.encoder': MeshoptEncoder });
const doc = await io.read(src);
const count = () => doc.getRoot().listMeshes().reduce((a, m) => a + m.listPrimitives().length, 0);
const before = count();
await doc.transform(dedup(), flatten(), join({ keepNamed: false }), prune());
await io.write(dst, doc);
console.log(`${src.split(/[\\/]/).pop()}: 프리미티브 ${before} → ${count()} · 재질 ${doc.getRoot().listMaterials().length}`);
