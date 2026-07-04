/**
 * Fisher-Yates 洗牌取前 n。n >= pool.length 时返回全量副本。
 * 随机源用 crypto.getRandomValues（SW 与 document 均可用）。
 */
export function pickRandom<T>(pool: T[], n: number): T[] {
  if (pool.length === 0 || n <= 0) return [];
  const arr = [...pool];
  const k = Math.min(n, arr.length);
  // 标准前向部分洗牌（partial Fisher-Yates）：i 从 0 到 k-1，每次从 [i, length)
  // 随机选一个换到位置 i。结果 arr[0..k] 是 k 个互不相同的随机元素、是 pool 子集；
  // O(k) 而非 O(pool.length)，且不修改原 pool。
  for (let i = 0; i < k; i++) {
    const j = i + randomInt(arr.length - i);
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr.slice(0, k);
}

function randomInt(maxExclusive: number): number {
  if (maxExclusive <= 0) return 0;
  const buf = new Uint32Array(1);
  crypto.getRandomValues(buf);
  return buf[0] % maxExclusive;
}
