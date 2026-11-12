// The one panel section that shows by default: frameSummary's rows. Everything else sits behind "All numbers".
import type { Recording } from '../../shared/types';
import { note, numberRow, rowsBox } from '../buildLabels';
import type { PanelSection } from '../numbersPanel';
import { KEY_SECTION } from '../numbersPanel';
import { frameSummary } from './frameSummary';

const CAVEAT = 'Live, with the city drawing on the same GPU. Press "All numbers" for every stop, block and process.';

export function createKeyNumbersView() {
  const body = rowsBox();
  const section: PanelSection = { id: KEY_SECTION, title: 'One frame against its budget', body, open: true };
  const clear = (text: string) => body.replaceChildren(note(text));
  clear('Waiting for the program to report its first frames.');

  return {
    section,
    clear,
    update(recording: Recording) {
      body.replaceChildren(...frameSummary(recording).map(numberRow), note(CAVEAT));
    },
  };
}
