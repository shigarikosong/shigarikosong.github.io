import fs from 'node:fs';
import vm from 'node:vm';
import { fileURLToPath } from 'node:url';

export function loadBrowserScripts(relativePaths, globals = {}) {
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
  relativePaths.forEach(relativePath => {
    const filename = fileURLToPath(new URL(`../${relativePath}`, import.meta.url));
    vm.runInContext(fs.readFileSync(filename, 'utf8'), context, { filename });
  });
  return context;
}

export function loadBrowserScript(relativePath, globals = {}) {
  return loadBrowserScripts([relativePath], globals);
}

export function toPlain(value) {
  return JSON.parse(JSON.stringify(value));
}
