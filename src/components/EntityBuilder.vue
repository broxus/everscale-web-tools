<script setup lang="ts">
import {ref, watch, watchEffect} from 'vue';
import * as core from '@core';

import { useEver } from '../providers/useEver';
import { convertError, makeStructure, toPaddedHexString, Structure, EMPTY_CELL } from '../common';

import EntityBuilderItem from './EntityBuilderItem.vue';

const props = defineProps<{
  abi: core.AbiEntity;
}>();

const stateData = ref<object>();
const structure = ref<Structure[]>();
const state = ref<{ output?: string; error?: string }>({
  output: undefined,
  error: undefined
});
const { ever } = useEver();


watchEffect(() => {
  const abi = props.abi;

  const data = {};
  const handleParam = param => {
    const structure = makeStructure(param, {});
    data[structure.name] = structure.defaultValue;
    return structure;
  };

  if (abi.kind === 'cell') {
    structure.value = abi.structure.map(handleParam);
  } else if (abi.kind === 'function') {
    structure.value = abi.inputs.map(handleParam);
  }

  stateData.value = data;
});

watch(
  stateData,
  async (_old, _new, onCleanup) => {
    const abi = props.abi;

    if (abi.kind === 'empty') {
      return;
    }

    const localState = { abiChanged: false };
    onCleanup(() => (localState.abiChanged = true));

    const structure = abi.kind === 'cell' ? abi.structure : [{ name: '___functionid', type: 'uint32' }, ...abi.inputs];
    const data = abi.kind === 'cell' ? stateData.value : { ...stateData.value, ___functionid: abi.inputId };

    const result = { output: undefined, error: undefined };
    try {
      const { boc } = await ever.packIntoCell({ data, structure } as any);
      result.output = boc;
    } catch (e: any) {
      result.error = convertError(e);
    }

    if (!localState.abiChanged) {
      state.value = result;
    }
  },
  {
    immediate: true,
    deep: true
  }
);
</script>

<template>
  <div class="entity-builder">
    <div v-if="abi.kind !== 'empty'" class="entity-builder__inputs">
      <EntityBuilderItem
        v-for="(item, i) in structure"
        :key="i"
        :structure="item"
        :value="stateData[item.name]"
        @change="stateData[item.name] = $event"
      />
    </div>

    <template>
      <div class="entity-builder__output">
        <template v-if="abi.kind === 'empty'">
          <h1>Output (empty cell):</h1>
          <pre class="encoded-data">{{ EMPTY_CELL }}</pre>
        </template>
        <template v-else-if="abi.kind === 'cell'">
          <h1>Output (cell):</h1>
          <pre v-if="state.output != null" class="encoded-data">{{ state.output }}</pre>
          <pre v-if="state.error != null" class="error">{{ state.error }}</pre>
        </template>
        <template v-else-if="abi.kind === 'function'">
          <h1>Function ID:</h1>
          <pre>Input: 0x{{ toPaddedHexString(abi.inputId, 8) }}</pre>
          <pre>Output: 0x{{ toPaddedHexString(abi.outputId, 8) }}</pre>
          <br />
          <h1>Output (function call):</h1>
          <pre v-if="state.output != null" class="encoded-data">{{ state.output }}</pre>
          <pre v-if="state.error != null" class="error">{{ state.error }}</pre>
        </template>
      </div>
    </template>

  </div>
</template>

<style lang="scss">
.entity-builder {
  width: 100%;

  display: flex;
  flex-direction: row;

  &__inputs {
    width: 50%;
    padding: 0.5em;

    display: flex;
    flex-direction: column;
  }

  &__output {
    width: 50%;
    padding: 1em;

    &:first-child {
      padding: 0;
    }

    .encoded-data,
    .error {
      word-break: break-all;
      max-width: 30em;
    }
  }
}
</style>
