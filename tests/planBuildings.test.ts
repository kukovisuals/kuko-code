import { describe, expect, it } from 'vitest';
import { heightFromMs } from '../src/city/heightScale';
import { planBuildings } from '../src/city/planBuildings';
import { buildPlaceholderRecording } from '../src/city/placeholderRecording';
import { rowsForStop } from '../src/city/stopRows';
import type { Recording } from '../src/shared/types';

const buildingFor = (recording: Recording, stop: number) =>
  planBuildings(recording).find((building) => building.stops.some((entry) => entry.stop === stop))!;

describe('planBuildings', () => {
  const recording = buildPlaceholderRecording('built-in');

  it('makes heights match the recording values', () => {
    const lane = buildingFor(recording, 5).lanes[0];
    expect(lane.totalMs).toBe(60);
    expect(lane.totalHeight).toBeCloseTo(heightFromMs(60));
    expect(lane.floors.map((floor) => floor.metric.id)).toEqual(['linkMs', 'firstDrawMs']);
  });

  it('keeps stops 2 and 3 as one building with a lane per trip', () => {
    const building = buildingFor(recording, 2);
    expect(buildingFor(recording, 3).title).toBe(building.title);
    expect(building.stops.map((stop) => stop.stop)).toEqual([2, 3]);
    const [build, frame] = building.lanes;
    expect(build.trip).toBe('build');
    expect(build.floors.map((floor) => floor.metric.id)).toEqual(['buildCallsMs', 'roundTripMs']);
    expect(frame.trip).toBe('frame');
    expect(frame.floors.map((floor) => floor.metric.id)).toEqual(['frameCallsMs', 'roundTripMs']);
  });

  it('gives stops 7 and 8 no time-based height', () => {
    for (const stop of [7, 8]) {
      const building = buildingFor(recording, stop);
      expect(building.lanes).toEqual([]);
      expect(building.noHeightReason).toBeTruthy();
    }
  });

  it('ignores floors on stops 7 and 8, so GPU time is never counted twice', () => {
    const tampered = structuredClone(recording);
    const stop7 = tampered.stops.find((stop) => stop.stop === 7)!;
    stop7.metrics.push({ id: 'fakeMs', value: 9, unit: 'ms', status: 'modeled', source: 'test' });
    stop7.floors = ['fakeMs'];
    expect(buildingFor(tampered, 7).lanes).toEqual([]);
  });

  it('turns a null value into a missing floor, never a zero-height one', () => {
    const withNull = structuredClone(recording);
    withNull.stops.find((stop) => stop.stop === 5)!.metrics[1].value = null;
    const lane = buildingFor(withNull, 5).lanes[0];
    expect(lane.floors.map((floor) => floor.metric.id)).toEqual(['linkMs']);
    expect(lane.missing.map((metric) => metric.id)).toEqual(['firstDrawMs']);
    expect(lane.totalHeight).toBeCloseTo(heightFromMs(20));
  });
});

describe('rowsForStop', () => {
  it('shows native imports beside browser values without replacing them', () => {
    const recording = buildPlaceholderRecording('built-in');
    const stop = recording.stops[0];
    const rows = rowsForStop(stop, [
      {
        tool: 'tshark',
        stop: 1,
        metrics: [{ id: 'fetchMs', value: 99, unit: 'ms', status: 'measured', source: 'tshark summary' }],
      },
      {
        tool: 'instruments',
        stop: 6,
        metrics: [{ id: 'gpuMs', value: 5, unit: 'ms', status: 'measured', source: 'Instruments summary' }],
      },
    ]);
    expect(rows.map((row) => [row.name, row.value])).toEqual([
      ['fetchMs', 2],
      ['tshark: fetchMs', 99],
    ]);
  });
});
