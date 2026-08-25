import fs from 'node:fs';
import vm from 'node:vm';
import { fileURLToPath } from 'node:url';

export function loadBrowserScript(relativePath, globals = {}) {
  const filename = fileURLToPath(new URL(`../${relativePath}`, import.meta.url));
  const contextGlobals = {
    console,
    Date,
    Map,
    Set,
    clearTimeout,
    setTimeout,
    ...globals
  };

  contextGlobals.window = contextGlobals;
  contextGlobals.globalThis = contextGlobals;
  contextGlobals.self = contextGlobals;

  const context = vm.createContext(contextGlobals);
  vm.runInContext(fs.readFileSync(filename, 'utf8'), context, { filename });
  return context;
}

export function toPlain(value) {
  return JSON.parse(JSON.stringify(value));
}
