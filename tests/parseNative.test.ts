import { describe, expect, it } from 'vitest';
import { parseGpuStats, parseInterfaceCounters, parseLoopbackFlows, parseProcessTimes } from '../server/parseNative';
import { processLoads } from '../server/processSampler';
import { shaderFileName } from '../server/shaderFiles';

describe('parseGpuStats', () => {
  it('reads only the named numbers', () => {
    const text = '"PerformanceStatistics" = {"In use system memory"=881704960,"Tiler Utilization %"=69,"Renderer Utilization %"=68,"Device Utilization %"=70}';
    expect(parseGpuStats(text)).toEqual({ devicePercent: 70, rendererPercent: 68, tilerPercent: 69, inUseMemoryBytes: 881704960 });
  });

  it('gives null rather than a guess when a number is missing', () => {
    expect(parseGpuStats('"Device Utilization %"=70')).toBeNull();
  });
});

describe('parseInterfaceCounters', () => {
  const table = [
    'Name  Mtu   Network       Address            Ipkts Ierrs     Ibytes    Opkts Oerrs     Obytes  Coll',
    'lo0   16384 <Link#1>                         100     0       2000      300     0       4000     0',
    'lo0   16384 127           127.0.0.1          1       0       2         3       0       4        0',
    'en0   1500  <Link#11>     aa:bb:cc:dd:ee:ff  500     0       6000      700     0       8000     0',
  ].join('\n');

  it('reads a row without an address column', () => {
    expect(parseInterfaceCounters(table, 'lo0')).toEqual({ inPackets: 100, inBytes: 2000, outPackets: 300, outBytes: 4000 });
  });

  it('reads a row with an address column, and the result holds no address', () => {
    const counters = parseInterfaceCounters(table, 'en0');
    expect(counters).toEqual({ inPackets: 500, inBytes: 6000, outPackets: 700, outBytes: 8000 });
    expect(JSON.stringify(counters)).not.toContain('aa:bb');
  });

  it('gives null for an interface that is not there', () => {
    expect(parseInterfaceCounters(table, 'en9')).toBeNull();
  });
});

describe('parseLoopbackFlows', () => {
  const text = [
    ',state,bytes_in,bytes_out,',
    'node.85550,,1,2,',
    'tcp4 10.0.0.113:51484<->10.0.0.125:51738,Established,244580,137015,',
    'tcp6 ::1.5173<->*.*,Listen,,,',
    'tcp6 ::1.5173<->::1.52182,Established,1259,185,',
    'tcp6 ::1.52182<->::1.5173,Established,185,1259,',
    'tcp4 127.0.0.1:5173<->127.0.0.1:50000,Established,10,20,',
    'tcp6 ::1.5199<->::1.60000,Established,5,5,',
  ].join('\n');

  it("keeps only the server's side of its own loopback connections", () => {
    expect(parseLoopbackFlows(text, 5173)).toEqual([
      { clientPort: 52182, inBytes: 1259, outBytes: 185 },
      { clientPort: 50000, inBytes: 10, outBytes: 20 },
    ]);
  });
});

describe('parseProcessTimes', () => {
  const chrome = '/Applications/Google Chrome.app/Contents/Frameworks/Google Chrome Framework.framework/Helpers';
  const text = [
    `  101  77:41.60 ${chrome}/Google Chrome Helper.app/Contents/MacOS/Google Chrome Helper --type=gpu-process --user-data-dir=/Users/someone/Library/Chrome`,
    `  102   0:10.84 ${chrome}/Google Chrome Helper (Renderer).app/Contents/MacOS/Google Chrome Helper (Renderer) --type=renderer --lang=en-US`,
    `  103 1:02:03.50 ${chrome}/Google Chrome Helper (Renderer).app/Contents/MacOS/Google Chrome Helper (Renderer) --type=renderer`,
    `  104   0:01.00 ${chrome}/Google Chrome Helper.app/Contents/MacOS/Google Chrome Helper --type=utility --utility-sub-type=network`,
    '  105   0:09.00 /Applications/Visual Studio Code.app/Contents/Frameworks/Code Helper.app/Contents/MacOS/Code Helper --type=gpu-process',
    '  106   0:02.00 node /Users/someone/dev/project/node_modules/.bin/vite',
  ].join('\n');
  const times = parseProcessTimes(text);

  it("keeps only Chrome's renderer and GPU processes, with CPU time in seconds", () => {
    expect(times).toEqual([
      { pid: 101, kind: 'chrome-gpu', cpuSeconds: 77 * 60 + 41.6 },
      { pid: 102, kind: 'chrome-renderer', cpuSeconds: 10.84 },
      { pid: 103, kind: 'chrome-renderer', cpuSeconds: 3600 + 2 * 60 + 3.5 },
    ]);
  });

  it('lets no path, flag or user name out of the parser', () => {
    const out = JSON.stringify(times);
    ['/', 'Users', 'someone', '--', 'Chrome'].forEach((leak) => expect(out).not.toContain(leak));
  });

  it('turns two samples into shares of one core, and sends the page no pid or path', () => {
    const later = times.map((entry) => ({ ...entry, cpuSeconds: entry.cpuSeconds + (entry.pid === 101 ? 0.1 : entry.pid === 102 ? 0.25 : 0) }));
    const loads = processLoads(times, [...later, { pid: 200, kind: 'chrome-renderer', cpuSeconds: 50 }], 0.5, 3);
    expect(loads.nodePercent).toBe(3);
    expect(loads.gpuProcessPercent).toBeCloseTo(20);
    expect(loads.rendererCount).toBe(3);
    expect(loads.renderersPercent).toBeCloseTo(50);
    expect(loads.busiestRendererPercent).toBeCloseTo(50);
    expect(Object.keys(loads).sort()).toEqual(['busiestRendererPercent', 'gpuProcessPercent', 'nodePercent', 'rendererCount', 'renderersPercent']);
  });

  it('gives null for the GPU process when ps shows none', () => {
    expect(processLoads([], [], 0.5, 0).gpuProcessPercent).toBeNull();
  });
});

describe('shaderFileName', () => {
  it('matches one plain file in ./shaders and nothing else', () => {
    expect(shaderFileName('/shaders/day442-image.glsl')).toBe('day442-image.glsl');
    expect(shaderFileName('/shaders/day442-image.glsl?raw')).toBeNull();
    expect(shaderFileName('/shaders/../package.json')).toBeNull();
    expect(shaderFileName('/shaders/a/b.glsl')).toBeNull();
    expect(shaderFileName('/shaders/..%2Fsecret.glsl')).toBeNull();
    expect(shaderFileName(undefined)).toBeNull();
  });
});
