<script setup lang="ts">
import { reactive } from 'vue';
import { convertError } from '../common';
import { useTvmConnect } from '../providers/useTvmConnect';

const { tvmConnect, tvmConnectState } = useTvmConnect()

const state = reactive({
  data: '',
  output: '',
  inProgress: false,
  error: undefined
});

const submit = async () => {
  const provider = tvmConnect.getProvider()

  if (state.inProgress || !tvmConnectState.value.account || !provider) {
    return;
  }

  state.inProgress = true;
  state.error = undefined;

  try {
    const encoded = encodeURIComponent(state.data).replace(/%([\dA-F]{2})/g, (_match, p1: any) =>
      String.fromCharCode(('0x' + p1) as any)
    );

    const output = await provider.signData({
      data: window.btoa(encoded),
      publicKey: tvmConnectState.value.account.publicKey,
    });

    state.inProgress = false;
    state.output = JSON.stringify(output, undefined, 4);
  } catch (e: any) {
    state.error = convertError(e.message);
  } finally {
    state.inProgress = false;
  }
};
</script>

<template>
  <section class="section">
    <div class="container is-fluid">
      <div class="field">
        <label class="label">Enter data to sign:</label>
        <div class="control">
          <textarea class="textarea" spellcheck="false" v-model="state.data" rows="5" />
        </div>
      </div>
      <div class="field">
        <div class="control">
          <button :disabled="state.inProgress" class="button is-primary" @click="submit">Sign</button>
        </div>
      </div>
    </div>
    <br />
    <div class="container is-fluid">
      <h5 class="title is-size-5">Output:</h5>
      <pre>{{ state.error ? state.error : state.output }}</pre>
    </div>
  </section>
</template>
