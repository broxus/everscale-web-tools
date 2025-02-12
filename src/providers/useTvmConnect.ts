import { shallowRef } from 'vue';
import { TvmConnectState, TvmConnectUI, everWallet, sparxWallet, venomWallet } from '@broxus/tvm-connect-ui';

import '@broxus/tvm-connect-ui/dist/styles.css';

const tvmConnect = new TvmConnectUI({
  providers: [sparxWallet(), everWallet(), venomWallet()],
});

const tvmConnectState = shallowRef<TvmConnectState>(tvmConnect.getState());

tvmConnect.subscribe(state => {
  tvmConnectState.value = state;
})

export function useTvmConnect() {
  return {
    tvmConnectState,
    tvmConnect,
  };
}
