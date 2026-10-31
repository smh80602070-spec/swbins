# K-0212 메모(상세) — 티켓 본문은 K-0212.md

(10-31 지포스, ① 라이선스 전수 — PyPI·GitHub 원문 확인)**:
| 도구 | 라이선스 | 판정 |
|---|---|---|
| nvdiffrast | NVIDIA Source Code License 1-Way Commercial §3.3 | **비상업 — 교체 대상** |
| diff-gaussian-rasterization(mip-splatting) | Inria Gaussian-Splatting License | **비상업 — 교체 대상** |
| TRELLIS 본체 | MIT | ○ |
| FlexiCubes (nv-tlabs 저장소 LICENSE) | Apache-2.0 | ○ (TRELLIS 사본 머리말은 확인 못 함 — 검색 한계, ② 전에 사본 파일 머리말 grep) |
| kaolin | Apache-2.0 | ○ (이미 대역으로 대체해 씀) |
| spconv | Apache-2.0 | ○ |
| xformers | BSD | ○ |
| utils3d | MIT | ○ |
| xatlas-python | MIT | ○ |
| pyvista · open3d · trimesh · rembg | MIT | ○ |
| lpips | BSD | ○ |
| **pymeshfix** | **AGPL-3.0** | 회색 — 굽기 중 메시 구멍 메우기에만 쓰고 결과 GLB 는 도구 산출물이라 보통 전염 없음. 사용자 판단 필요 |
| **igraph(python-igraph)** | **GPL** | 회색 — 위와 같음(내부 처리, 배포 안 함) |
이 PC: `tools/ai-art/_out/remote3d`(입력 그림) 없음 → 라데온 PC 에서 가져오거나 saga-assets `.license.json` 의 입력 출처로 복원해야 ② 가능. 다음: ② 곰 1종 대체 굽기 시험(gsplat Apache-2.0 + 상업 허용 UV 굽기).
- 10-31 지포스 ② 시작 전 막힘 확인: ⓐ 이 PC 에 Kaggle 토큰(`~/.kaggle`) 없음 ⓑ 시스템 파이썬에 torch 없음·remote3d README "이 PC 에 TRELLIS 설치 시도 금지" ⓒ 입력 그림 `_out/remote3d` 없음 ⓓ 기존 GLB 는 굽기 결과물이라 가우시안이 안 남아 있어 TRELLIS 재실행이 필요. 사람 몫: Kaggle 토큰을 이 PC 에 놓기(또는 라데온 PC 에서 `_out/remote3d` 복사). 그 뒤 곰 1종 ② 부터. 수신함 점검: 지포스·자체툴 해당 새 줄 없음(W-0444 줄은 웹 W-0444 끝으로 낡은 줄).
- 10-31 지포스 ⓪ 환경 시도: `C:\swbins3	rellis-venv`(py3.12, torch 2.4.1+cu121 CUDA ○) + TRELLIS 클론 `C:\swbins3	rellis-work\TRELLIS` + spconv-cu121·utils3d·xatlas ○. **막힘**: ⓐ xformers 0.0.28 윈도 3.12 바퀴 없음 → `ATTN_BACKEND=sdpa` ⓑ gsplat 1.5.3 은 nvcc·MSVC 없어 비활성이고, `gsplat.rendering._rasterization` 도 내부에서 CUDA 커널(`intersect_tile`)을 불러 순수 torch 로는 안 돎(실측 AttributeError). 갈래: (가) VS Build Tools+CUDA 12.1 설치(수 GB, 사용자 승인 필요) (나) 자체 순수 torch 가우시안 렌더+UV 투영 굽기(미분 불필요 — 다중 뷰 타깃을 UV 텍셀에 깊이 가림 검사로 투영) 직접 작성 (다) Kaggle 리눅스에서 gsplat 으로 굽기(토큰 필요). 4060 8GB 로 TRELLIS 본체가 올라가는지는 미시험.
- 10-31 커밋 막힘: precheck 가 다른 세션의 `tasks/gameplay/asset-tool-validation.md`(6428B)·`project-review-20261031.md`(9723B) 6KB 한도 초과로 모든 커밋을 막음 — 그 세션이 줄이면 이 메모 커밋.
- 10-31 지포스 ⓪ 끝: **TRELLIS-image-large 가 4060 8GB 에서 돈다** — 곰 1장 로딩 35초 + 생성 41초(총 76초, 최대 할당 11.3GB 는 윈도 공유 메모리로 넘침), 가우시안 `.ply` 저장 ○(`C:\swbins3\trellis-work\run_bear.py`, 입력 `in\bear.png` = `gen.py k96_views_B --only bear`, 씨앗 3366493335 라 옛 곰과 씨앗이 다름). 풀린 막힘: xformers 는 PyPI `0.0.27.post2` cp312 바퀴를 `--no-deps` 로(sparse 어텐션은 sdpa 불가, xformers/flash_attn 만) · open3d 설치 · kaolin 대역(`stub/kaolin`) · 모델은 `snapshot_download` 로 로컬(`trellis-work\model`). FlexiCubes 사본 머리말 Apache-2.0 확인(① 표의 미확인 해소). 주의: Bash 백그라운드 작업에서 켠 ComfyUI 는 작업이 끝나면 같이 죽음 → PowerShell `Start-Process` 로 분리해 켠다.
  **다음 = ②**: 메시(`out['mesh']`)와 가우시안을 저장하고, gsplat·nvdiffrast 없이 순수 torch 로 다중 뷰 렌더 → UV 텍셀 투영(깊이 가림) 굽기를 쓴다(`postprocessing_utils.to_glb` 의 렌더·래스터 두 곳 대체).
- 10-31 지포스 **② 곰 1종 ○**: 새 `tools/ai-art/remote3d/bake_free.py`(순수 torch — 삼각형 z-버퍼 `rasterize`·가우시안 스플래팅 `render_gaussians`·UV 투영 `bake_texture`. 의존 torch·numpy·opencv·xatlas·pyvista 뿐, nvdiffrast·diff-gaussian-rasterization·gsplat 없음). 곰 `bear_v03`(씨앗 3366493337 = 옛 곰 입력과 같은 씨앗): 가우시안 36만·메시 1.3만 점/2.6만 면, 100뷰 1024px 렌더 29초 + 굽기 3초. 시트 `tasks/sheets/k212_bear_free_vs_gs.png`(위 가우시안 렌더 / 아래 굽은 메시, 네 방향) 눈 ○. 굽기는 옛 'opt'(Adam 2500스텝) 대신 가중 평균 + inpaint. **빠진 것**: `postprocess_mesh` fill_holes(보이지 않는 면 제거 — utils3d 래스터가 nvdiffrast 백엔드라 못 씀 → `bake_free.rasterize` 로 보임 세기를 직접 구현). 시험 스크립트 `C:\swbins3	rellis-work\{run_bear_save,bake_bear,cmp_bear}.py`(PC 로컬). 입력 그림은 `gen.py <k96 배치> --only <id> --variants N` 씨앗 재현(옛 곰과 같은 씨앗이면 같은 그림).
- 10-31 지포스 **③ 시작(곰으로 끝까지 ○)**: `bake_free.py` 에 `remove_invisible`(fill_holes 대체 — 200뷰 래스터로 안 보이는 면만 지움, **igraph·pymeshfix 안 씀**)·`to_glb_free` 추가, 새 `tools/ai-art/remote3d/trellis_local.py`(입력 폴더 <id>.png → TRELLIS 생성 + 굽기 → <출력>/<id>.glb, 있으면 건너뜀) — 곰 한 마리 **199초**(생성+굽기), 메시 감축 1.3만→0.9만 면(안 보이는 속 면 제거), 질감 점유율 0.61. 시트 `tasks/sheets/k212_bear_local_pipeline.png`(위 가우시안 / 아래 새 GLB) 눈 ○. 이로써 회색 둘(igraph GPL·pymeshfix AGPL)도 이 경로에선 안 쓴다 — 단 소구멍 메우기(fill_small_boundaries)는 빠짐. 실행: `C:\swbins3\trellis-venv\Scripts\python.exe tools\ai-art\remote3d\trellis_local.py <입력> <출력>`(백그라운드 Bash 말고 PowerShell Start-Process 로 — 안 그러면 끝날 때 같이 죽음).
