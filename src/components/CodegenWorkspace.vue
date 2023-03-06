<script setup lang="ts">
import {ref, shallowRef, watchEffect} from 'vue';
import * as core from '@core';
import {AbiEntity} from '@core';
import Codegen from "./Codegen.vue";

import EntityBuilder from './EntityBuilder.vue';


const abiInput = ref<string>('');
const cellDescriptionInput = ref<string>('');
const state = shallowRef<{
  abi?: String;
  abiEntity?: AbiEntity
  cellDescription?: String,
  abiError?: undefined;
  cellError?: undefined;
}>({});

const checkJsonAbi = (text: string | undefined) => {
  if (!text) return;
  const parsed = JSON.parse(text);
  return JSON.stringify(parsed, undefined, 4);
}

watchEffect(() => {
  state.value = {
    abiEntity: undefined,
    cellDescription: undefined,
    abi: undefined,
    cellError: undefined
  };
});

const onChange = (_: Event) => {
  let text = cellDescriptionInput.value;
  try {
    const abiEntity = core.parse(text);
    state.value = {
      abiEntity: abiEntity,
      cellDescription: text,
      abi: undefined,
      cellError: undefined,
      abiError: undefined,
    }
  }
  catch (e: any) {
    state.value = {
      abiEntity: undefined,
      cellDescription: undefined,
      abi: undefined,
      cellError: undefined,
      abiError: e.toString(),
    }
  }

}

const onPaste = (e: Event) => {
  let pastedText = (e as ClipboardEvent).clipboardData.getData('text');
  try {
    abiInput.value = checkJsonAbi(pastedText);
    state.value = {
      abiEntity: undefined,
      cellDescription: undefined,
      abi: abiInput.value,
      abiError: undefined,
      cellError: undefined
    };
    e.preventDefault();
  } catch (e: any) {
    state.value = {
      abiEntity: undefined,
      cellDescription: undefined,
      abi: undefined,
      abiError: e.toString(),
      cellError: undefined
    };
  }
};
</script>

<template>
  <section class="section pb-0">
    <div class="container is-fluid">
      <div class="columns">

        <div class="column">
          <div class="columns">
            <div class="column">
              <label class="label">Paste ABI here:</label>
              <div class="control">
                <textarea
                    :class="['textarea', { 'is-danger': state.error != null }]"
                    spellcheck="false"
                    v-model="abiInput"
                    @paste="onPaste"
                    rows="5"
                />
              </div>
              <pre v-if="state.abiError != null" class="help is-danger">{{ state.abiError }}</pre>
            </div>
            <div class="column">
              <label class="label">Or type cell description here: </label>
              <div class="control">
                <textarea
                    :class="['textarea', { 'is-danger': state.error != null }]"
                    spellcheck="false"
                    v-model="cellDescriptionInput"
                    @input="onChange"
                    rows="5"
                />
              </div>
              <pre v-if="state.cellError != null" class="help is-danger">{{ state.cellError }}</pre>
            </div>
          </div>
          <div class="is-fluid">
            <EntityBuilder v-if="state.abiEntity != null" :abi="state.abiEntity" :show-cell-value="false" />
          </div>

        </div>

        <div class="column">
          <codegen :abi="state.abi" :cell-description="state.cellDescription"></codegen>
        </div>

      </div>
    </div>
  </section>



</template>



<style scoped>

</style>