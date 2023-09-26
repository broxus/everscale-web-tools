<script setup lang="ts">
import { computed, ref, shallowRef, watchEffect } from 'vue';
import * as core from '@core';

const input = ref<string>('');
const selectedMethods = ref<number[]>([])
const state = shallowRef<{
  error?: undefined;
  methods: core.FunctionEntry[];
}>({
  methods: [],
});

watchEffect(() => {
  try {
    const methods = input.value.trim() != '' ? core.getContractFunctions(input.value) : [];

    selectedMethods.value = []
    state.value = {
      error: undefined,
      methods,
    }
  } catch (e: any) {
    state.value = {
      error: e.toString(),
      methods: [],
    };
  }
});

const interfaceId = computed(() => core.computeTip6InterfaceId(new Uint32Array(selectedMethods.value)));

function toggleAll() {
  selectedMethods.value = selectedMethods.value.length !== state.value.methods.length
    ? state.value.methods.map(item => item.id)
    : []
}
</script>

<template>
  <section class="section pb-0">
    <div class="container is-fluid">
      <div class="columns">
        <div class="column">
          <div class="field">
            <label class="label">Enter JSON ABI:</label>
            <div class="control mb-3">
              <textarea spellcheck="false" rows="5" :class="['textarea', { 'is-danger': state.error != null }]"
                v-model="input"></textarea>
            </div>

            <pre v-if="state.error != null" class="help is-danger">{{ state.error }}</pre>
          </div>

          <div class="field" v-if="state.methods.length > 0">
            <div class="label is-flex is-justify-content-space-between is-align-content-center">
              Methods:

              <button class="button is-small" :disabled="state.methods.length === 0" @click="toggleAll()">
                Toggle all
              </button>
            </div>

            <div class="mb-3" v-for="method in state.methods">
              <label class="button is-fullwidth is-justify-content-flex-start">
                <div class="checkbox">
                  <input type="checkbox" :id="method.name" :value="method.id" v-model="selectedMethods" />
                  <code class="m-3">0x{{ method.id.toString(16).padStart(8, '0') }}</code>
                  <span>{{ method.name }}</span>
                </div>
              </label>
            </div>
          </div>
        </div>
        <div class="column">
          <label class="label">Interface ID:</label>
          <pre class="encoded-data">0x{{ interfaceId.toString(16).padStart(8, '0') }}</pre>
        </div>
      </div>
    </div>
  </section>
</template>
