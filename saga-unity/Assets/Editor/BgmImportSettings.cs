using UnityEditor;
using UnityEngine;

namespace Saga.EditorTools
{
    /// <summary>
    /// 자체 배경음(tasks U-0021) 임포트 규칙 — `Assets/SagaCore/Resources/Audio/Bgm/` 아래 곡은 Vorbis·스트리밍으로 가져온다(한 곡 ≈ 1MB 인데
    /// "로드시 해제"면 메모리에 10MB 안팎으로 풀린다 — 폰 메모리·발열). 곡 파일을 새로 넣거나 다시 가져올 때마다 같은 설정이 걸린다.
    /// </summary>
    public sealed class BgmImportSettings : AssetPostprocessor
    {
        public const string Folder = "Assets/SagaCore/Resources/Audio/Bgm/";

        private void OnPreprocessAudio()
        {
            if (!assetPath.StartsWith(Folder)) return;
            var importer = (AudioImporter)assetImporter;
            var s = importer.defaultSampleSettings;
            s.loadType = AudioClipLoadType.Streaming;
            s.compressionFormat = AudioCompressionFormat.Vorbis;
            s.quality = 0.5f;
            s.preloadAudioData = false;
            importer.defaultSampleSettings = s;
            importer.loadInBackground = true;
        }
    }
}
