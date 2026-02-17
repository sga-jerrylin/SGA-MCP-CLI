import { SessionLog } from './session-log';

describe('SessionLog', () => {
  it('supports append/entries/clear', () => {
    const log = new SessionLog();
    log.append('a');
    log.append('b');

    expect(log.entries()).toEqual(['a', 'b']);

    log.clear();
    expect(log.entries()).toEqual([]);
  });
});
