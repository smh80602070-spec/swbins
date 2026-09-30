using System;

namespace Saga.Core
{
    /// <summary>
    /// 세이브 버전 검사·단계 마이그레이션 공유(tasks U-0005) — GO `SaveState.Migrate` 루프를 올린 것.
    /// `*SaveState` 는 static class·`SaveData` 는 private 중첩이라 인터페이스 대신 델리게이트로 받는다.
    /// </summary>
    public static class SaveMigrator
    {
        /// <summary>이 빌드보다 나중 버전(다운그레이드)인가 — 반쯤 바뀐 채로 적용하지 않으려고 거른다.</summary>
        public static bool IsFuture(int version, int current) => version > current;

        /// <summary>
        /// 버전이 current 보다 낮으면 step(from, data) 를 한 단계씩 적용해 최신 모양으로 돌려준다(딱 맞으면 그대로).
        /// 경로가 없어 step 이 null 을 주거나 미래 버전이면 null.
        /// </summary>
        public static T Run<T>(T data, int current, Func<T, int> getVersion, Func<int, T, T> step) where T : class
        {
            int version = getVersion(data);
            while (version < current)
            {
                T stepped = step(version, data);
                if (stepped == null) return null;
                data = stepped;
                version = getVersion(data);
            }
            return IsFuture(version, current) ? null : data;
        }
    }
}
