<script setup lang="ts">
import { ref, shallowRef, watchEffect } from 'vue';
import * as core from '@core';

import Codegen from "./Codegen.vue";

const ABI_TYPE: { [K in core.AbiType]: string } = {
  cell: "Cell",
  contract: "Contract",
}

const abiTypeVisible = ref<boolean>(false);
const selectedAbiType = ref<core.AbiType>('contract');

const input = ref<string>('');
const state = shallowRef<{
  generatedCode?: string;
  error?: string;
}>({});

watchEffect(() => {
  try {
    const generatedCode = core.generateRustCode(input.value, selectedAbiType.value);
    state.value = {
      generatedCode,
      error: undefined
    };
  } catch (e: any) {
    state.value = {
      generatedCode: undefined,
      error: e.toString()
    };
  }
});

const onPaste = (e: Event) => {
  const pastedText = (e as ClipboardEvent).clipboardData.getData('text');
  input.value = pastedText;
  e.preventDefault();
};
</script>

<template>
  <section class="section pb-0">
    <div class="container is-fluid">
      <div class="columns">

        <div class="column">
          <div class="field">
            <label class="label">Select structure:</label>
            <div :class="['dropdown', { 'is-active': abiTypeVisible }]">
              <div class="dropdown-trigger">
                <button class="button" aria-haspopup="true" aria-controls="select-abi-dropdown"
                  @click="abiTypeVisible = !abiTypeVisible" @blur="abiTypeVisible = false">
                  <span>{{ selectedAbiType == null ? 'Select Structure...' : ABI_TYPE[selectedAbiType] }}</span>
                  <span class="icon is-small">
                    <i :class="['fas', abiTypeVisible ? 'fa-angle-up' : 'fa-angle-down']" aria-hidden="true" />
                  </span>
                </button>
              </div>
              <div class="dropdown-menu" id="select-abi-dropdown" role="menu">
                <div class="dropdown-content">
                  <a v-for="(name, value) in ABI_TYPE" :key="value"
                    class="dropdown-item is-flex is-align-items-center pr-4" @mousedown="selectedAbiType = value">
                    <span class="mr-5">{{ name }}</span>
                  </a>
                </div>
              </div>
            </div>
          </div>

          <div class="field">
            <label class="label">Enter contract or cell ABI:</label>
            <div class="control">
              <textarea :class="['textarea', { 'is-danger': state.error != null }]" spellcheck="false" v-model="input"
                @paste="onPaste" rows="5" />
            </div>
            <pre v-if="state.error != null" class="help is-danger">{{ state.error }}</pre>
          </div>
        </div>
      </div>
    </div>
  </section>

  <section class="section">
    <div class="container is-fluid">
      <label class="label">Output rust code:</label>
      <div class="control">
        <pre
          aria-hidden="true"><code class="language-html" id="highlighting-content">{{ state.generatedCode }}</code></pre>
      </div>
    </div>
  </section>
</template>
