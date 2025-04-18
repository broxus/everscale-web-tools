<script setup lang="ts">
import { disasmToFift } from "@tychosdk/disasm";
import { ref, shallowRef, watchEffect } from 'vue';

const input = ref<string>('');
const state = shallowRef<{
  generatedCode?: string;
  error?: string;
}>({});

const shared: { idx: number } = { idx: 0 };
watchEffect(() => {
  const idx = ++shared.idx;
  disasmToFift(input.value).then((generatedCode) => {
    if (idx !== shared.idx) {
      return;
    }
    state.value = {
      generatedCode,
      error: undefined
    };
  }).catch((e: any) => {
    if (idx !== shared.idx) {
      return;
    }
    state.value = {
      generatedCode: undefined,
      error: e.toString()
    };
  });
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
            <label class="label">Enter contract code BOC:</label>
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
      <label class="label">Disassembled code:</label>
      <div class="control">
        <pre
          aria-hidden="true"><code class="language-html" id="highlighting-content">{{ state.generatedCode }}</code></pre>
      </div>
    </div>
  </section>
</template>
