// Placeholder until T09 builds the recorder: shows whether the headers took effect.
const isolation = document.querySelector('#isolation');
if (isolation) {
  isolation.textContent = `crossOriginIsolated: ${self.crossOriginIsolated}`;
}
