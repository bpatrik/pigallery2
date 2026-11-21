/**
 * Mocha root hook: once all tests ran, the process should exit on its own. If something a test left open
 * (a server, a socket, a timer, a child process) still keeps it alive, list it, so a run that hangs
 * after its last test shows the cause in its log (instead of hiding it with mocha --exit).
 */
const WAIT_MS = 10 * 1000;

interface Handle {
  constructor: { name: string };
  listening?: boolean;
  address?: () => unknown;
  remoteAddress?: string;
  remotePort?: number;
  spawnargs?: string[];
  _idleTimeout?: number;
  _onTimeout?: unknown;
  hasRef?: () => boolean;
}

const describeHandle = (h: Handle): string => {
  const name = h.constructor.name;
  switch (name) {
    case 'Server':
      return `Server listening=${h.listening} address=${JSON.stringify(h.address?.())}`;
    case 'Socket':
      return `Socket to ${h.remoteAddress}:${h.remotePort}`;
    case 'ChildProcess':
      return `ChildProcess ${(h.spawnargs ?? []).join(' ').slice(0, 200)}`;
    case 'Timeout':
      return `Timeout ${h._idleTimeout} ms ref=${h.hasRef?.()} ${String(h._onTimeout).replace(/\s+/g, ' ').slice(0, 300)}`;
    default:
      return name;
  }
};

export const mochaHooks = {
  afterAll(): void {
    setTimeout((): void => {
      console.error(`\nThe tests ended ${WAIT_MS / 1000} s ago, but the process is still running. Open resources:`);
      console.error('  ' + process.getActiveResourcesInfo().join(', '));
      // undocumented, but the only way to see which server, socket or timer it is
      const handles = (process as unknown as { _getActiveHandles?: () => Handle[] })._getActiveHandles?.() ?? [];
      for (const h of handles.filter(h => ![process.stdin, process.stdout, process.stderr].includes(h as never))) {
        console.error('  ' + describeHandle(h));
      }
    }, WAIT_MS).unref();
  }
};
