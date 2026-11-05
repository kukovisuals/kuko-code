// Placeholder until T17 builds the scene: shows whether the headers took effect.
const isolation = document.querySelector('#isolation');
if (isolation) {
  isolation.textContent = `crossOriginIsolated: ${self.crossOriginIsolated}`;
}
