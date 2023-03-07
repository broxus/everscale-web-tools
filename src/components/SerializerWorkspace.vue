<script setup lang="ts">
import {ref, shallowRef, watchEffect} from 'vue';
import * as core from '@core';

import EntityBuilder from './EntityBuilder.vue';

const input = ref<string>('');
const state = shallowRef<{
  abi?: core.AbiEntity;
  error?: undefined;
}>({});

watchEffect(() => {
  try {
    const abi = core.parse(input.value);
    state.value = {
      abi,
      error: undefined
    };
  } catch (e: any) {
    state.value = {
      abi: undefined,
      error: e.toString()
    };
  }
});

const onPaste = (e: Event) => {
  let pastedText = (e as ClipboardEvent).clipboardData.getData('text');
  try {
    const parsed = JSON.parse(pastedText);
    pastedText = JSON.stringify(parsed, undefined, 4);
    input.value = pastedText;
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
            :class="['textarea', { 'is-danger': state.error != null }]"
            spellcheck="false"
            v-model="input"
            @paste="onPaste"
            rows="5"
          />
        </div>
        <pre v-if="state.error != null" class="help is-danger">{{ state.error }}</pre>
      </div>
    </div>
  </section>

  <section class="section">
    <div class="container is-fluid">
      <EntityBuilder v-if="state.abi != null" :abi="state.abi" />
    </div>
  </section>
</template>
