<script setup lang="ts">
import { ref, shallowRef, watch, watchEffect } from 'vue';
import * as core from '@core';

import { useEver } from '../providers/useEver';
import { convertError } from '../common';

const abiInput = ref<string>('');
const abiState = shallowRef<{
  abi?: core.AbiEntity;
  error?: undefined;
}>({});

const partial = ref<boolean>(false);

const bocInput = ref<string>('');
const bocState = shallowRef<{
  decoded?: string;
  error?: string;
}>({});

const { ever } = useEver();

watchEffect(() => {
  try {
    const abi = core.parse(abiInput.value);
    abiState.value = {
      abi,
      error: undefined
    };
  } catch (e: any) {
    abiState.value = {
      abi: undefined,
      error: e.toString()
    };
  }
});

watch([bocInput, abiState, partial], async ([bocInput, { abi }, partial], _, onCleanup) => {
  if (abi == null) {
    bocState.value = {
      decoded: undefined,
      error: undefined
    };
    return;
  }

  const state = { abiChanged: false };
  onCleanup(() => {
    state.abiChanged = true;
  });

  let result;
  if (abi.kind === 'function') {
    const contractAbi = {
      'ABI version': abi.version.major,
      version: `${abi.version.major}.${abi.version.minor}`,
      functions: [
        {
          name: abi.name,
          inputs: abi.inputs,
          outputs: abi.outputs,
          id: abi.inputId
        }
      ],
      events: []
    };

    try {
      const decoded = await ever.ensureInitialized().then(async () =>
        ever.rawApi.decodeInput({
          abi: JSON.stringify(contractAbi),
          body: bocInput,
          method: abi.name,
          internal: true
        })
      );

      if (decoded == null) {
        throw new Error('Invalid body');
      }
      result = {
        decoded: JSON.stringify(decoded.input, undefined, 4),
        error: undefined
      };
    } catch (e: any) {
      result = {
        decoded: undefined,
        error: convertError(e)
      };
    }
  } else {
    const structure = abi.kind === 'empty' ? [] : abi.structure;

    try {
      const { data } = await ever.unpackFromCell({
        boc: bocInput,
        structure,
        allowPartial: partial
      });
      result = {
        decoded: JSON.stringify(data, undefined, 4),
        error: undefined
      };
    } catch (e: any) {
      result = {
        decoded: undefined,
        error: convertError(e)
      };
    }
  }

  if (!state.abiChanged) {
    bocState.value = result;
  }
});

const onPaste = (e: Event) => {
  let pastedText = (e as ClipboardEvent).clipboardData.getData('text');
  try {
    const parsed = JSON.parse(pastedText);
    pastedText = JSON.stringify(parsed, undefined, 4);
    abiInput.value = pastedText;
    e.preventDefault();
  } catch (e: any) {}
};
</script>

<template>
  <section class="section pb-0">
    <div class="container is-fluid">
      <div class="field">
        <label class="label">Enter function signature or cell ABI:</label>
        <div class="control">
          <textarea
            :class="['textarea', { 'is-danger': abiState.error != null }]"
            spellcheck="false"
            v-model="abiInput"
            @paste="onPaste"
            rows="5"
          />
        </div>
        <pre v-if="abiState.error != null" class="help is-danger">{{ abiState.error }}</pre>
      </div>
      <label class="checkbox" v-if="abiState.error == null && abiState.abi?.kind !== 'function'">
        Allow partial
        <input type="checkbox" v-model="partial" />
      </label>
    </div>
  </section>

  <section class="section pb-0">
    <div class="container is-fluid">
      <div class="field">
        <label class="label">Enter base64 encoded BOC:</label>
        <div class="control">
          <textarea
            :class="['textarea', { 'is-danger': bocState.error != null }]"
            spellcheck="false"
            v-model="bocInput"
            rows="5"
          />
        </div>
        <p v-if="bocState.error != null" class="help is-danger">{{ bocState.error }}</p>
      </div>
    </div>
  </section>

  <section class="section">
    <div class="container is-fluid">
      <h5 class="title is-size-5">Output:</h5>
      <pre>{{ bocState.decoded }}</pre>
    </div>
  </section>
</template>
