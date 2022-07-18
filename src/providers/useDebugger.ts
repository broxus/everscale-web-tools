import { shallowRef } from 'vue';
import init, * as wasm from '@debugger';

let startedLoading = false;
let debuggerModule = shallowRef<typeof wasm>();

export function useDebugger() {
  if (!startedLoading) {
    startedLoading = true;
    init().then(() => {
      debuggerModule.value = wasm;
    });
  }

  return {
    debuggerModule
  };
}
