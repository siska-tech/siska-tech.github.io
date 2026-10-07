// Busy-work on a slice of a SharedArrayBuffer: proves that several workers
// really run in parallel on shared memory (what wasm threads need).
self.onmessage = ({ data }) => {
  const { buffer, start, end, iterations } = data;
  const values = new Float64Array(buffer);
  const counter = new Int32Array(buffer, buffer.byteLength - 8, 1);
  const started = performance.now();
  for (let it = 0; it < iterations; it++) {
    for (let i = start; i < end; i++) {
      values[i] = Math.sqrt(values[i] * 1.000001 + i);
    }
  }
  Atomics.add(counter, 0, 1);
  Atomics.notify(counter, 0);
  self.postMessage({ ms: performance.now() - started });
};
