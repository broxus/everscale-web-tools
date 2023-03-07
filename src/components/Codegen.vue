<script setup lang="ts">

import * as core from "@core";
import {ref, watchEffect} from "vue";

const props = defineProps<{
  abi?: string;
  cellDescription?: string,
}>();

const state = ref<{ output?: string; error?: string }>({
  output: undefined,
  error: undefined
});

watchEffect(() => {
  if (!props.abi && !props.cellDescription) return;

  if (props.abi) {
    try {
      const abi = props.abi;
      let output = core.generateRustCode(abi);
      state.value = {
        output,
        error: undefined
      };
    }
    catch (e: any) {
      state.value = {
        output: undefined,
        error: e.toString()
      }
    }
  }

  if (props.cellDescription) {
    try {
      const cellDescription = props.cellDescription;
      let output = core.generateRustCodeFromParams(cellDescription);
      state.value = {
        output,
        error: undefined
      };
    }
    catch (e: any) {
      state.value = {
        output: undefined,
        error: e.toString()
      }
    }
  }

});



</script>
<template>
  <label class="label">Output rust code:</label>
  <div class="control">
    <pre aria-hidden="true">
      <code class="language-html" id="highlighting-content">{{state.output}}</code>
    </pre>
  </div>

</template>
