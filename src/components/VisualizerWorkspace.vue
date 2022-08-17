<script setup lang="ts">
import { ref } from 'vue';
import * as core from '@core';

const input = ref('');
const state = ref({ decoded: undefined, error: undefined });

const decode = (e: Event) => {
  const boc = (e.target as HTMLInputElement).value;
  try {
    state.value = {
      decoded: core.visualize(boc),
      error: undefined
    };
  } catch (e: any) {
    state.value = {
      decoded: undefined,
      error: e.toString()
    };
  }
};
</script>

<template>
  <section class="section pb-0">
    <div class="container is-fluid">
      <div class="field">
        <label class="label">Enter base64 encoded BOC:</label>
        <div class="control">
          <textarea
            :class="['textarea', { 'is-danger': state.error != null }]"
            spellcheck="false"
            v-model="input"
            rows="5"
            @input="decode"
          />
        </div>
        <p v-if="state.error != null" class="help is-danger">{{ state.error }}</p>
      </div>
    </div>
  </section>
  <section class="section">
    <div class="container is-fluid">
      <h5 class="title is-size-5">Output:</h5>
      <pre>{{ state.decoded }}</pre>
    </div>
  </section>
</template>
