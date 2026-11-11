import { describe, expect, it } from 'vitest';
import { parseGpuStats, parseInterfaceCounters, parseLoopbackFlows } from '../server/parseNative';

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
