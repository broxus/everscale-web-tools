<script setup lang="ts">
import { ref, shallowRef, watch, watchEffect } from 'vue';
import * as core from '@core';

import { useEver } from '../providers/useEver';
import { convertError } from '../common';

enum Tabs {
  ABI = 'ABI',
  BlockStructures = 'Block structures',
}

const activeTab = ref<Tabs>(Tabs.ABI);

const abiInput = ref<string>('');
const abiState = shallowRef<{
  abi?: core.AbiEntity;
  error?: undefined;
}>({});

const partial = ref<boolean>(false);

const STRUCTURE_NAME: { [K in core.StructureType]: string } = {
  block: 'Block',
  message: 'Message',
  transaction: 'Transaction',
  account: 'Account',
};

function onSelectStructure(value: core.StructureType) {
  selectedStructure.value = value != null ? value : undefined;
}

const structureSelectorVisible = ref<boolean>(false);
const selectedStructure = ref<core.StructureType>(undefined);

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

watch([bocInput, abiState, partial, selectedStructure], async ([bocInput, { abi }, partial, selectedStructure], _, onCleanup) => {
  if (activeTab.value === Tabs.BlockStructures) {
    try {
      let r = JSON.parse(core.deserialize(bocInput, selectedStructure));
      bocState.value = {
        decoded: JSON.stringify(r, (key, value) =>
          typeof value === 'bigint'
            ? value.toString()
            : value,
          4
        ),
        error: undefined
      };
    } catch (e: any) {
      bocState.value = {
        decoded: undefined,
        error: e.toString()
      };
    }
    return;
  }
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
  } catch (e: any) { }
};
</script>

<template>
  <div class="container is-fluid">
    <div class="tabs is-centered is-boxed is-fullwidth">
      <ul>
        <li v-for="(name, i) in Tabs" :key="i" :class="{ 'is-active': name === activeTab }" @click="activeTab = name">
          <a>{{ name }}</a>
        </li>
      </ul>
    </div>
  </div>
  <div v-if="activeTab === Tabs.ABI">
    <section class="section pb-0">
      <div class="container is-fluid">
        <div class="field">
          <label class="label">Enter function signature or cell ABI:</label>
          <div class="control">
            <textarea :class="['textarea', { 'is-danger': abiState.error != null }]" spellcheck="false"
              v-model="abiInput" @paste="onPaste" rows="5" />
          </div>
          <pre v-if="abiState.error != null" class="help is-danger">{{ abiState.error }}</pre>
        </div>
        <label class="checkbox" v-if="abiState.error == null && abiState.abi?.kind !== 'function'">
          Allow partial
          <input type="checkbox" v-model="partial" />
        </label>
      </div>
    </section>
  </div>
  <div v-if="activeTab === Tabs.BlockStructures">
    <section class="section pb-0">
      <div class="container is-fluid">
        <label class="label">Select structure:</label>
        <div :class="['dropdown', { 'is-active': structureSelectorVisible }]">
          <div class="dropdown-trigger">
            <button class="button" aria-haspopup="true" aria-controls="select-abi-dropdown"
              @click="structureSelectorVisible = !structureSelectorVisible" @blur="structureSelectorVisible = false">
              <span>{{ selectedStructure == null ? 'Select Structure...' : STRUCTURE_NAME[selectedStructure] }}</span>
              <span class="icon is-small">
                <i :class="['fas', structureSelectorVisible ? 'fa-angle-up' : 'fa-angle-down']" aria-hidden="true" />
              </span>
            </button>
          </div>
          <div class="dropdown-menu" id="select-abi-dropdown" role="menu">
            <div class="dropdown-content">
              <a v-for="(name, value) in STRUCTURE_NAME" :key="value"
                class="dropdown-item is-flex is-align-items-center pr-4" @mousedown="onSelectStructure(value)">
                <span class="mr-5">{{ name }}</span>
              </a>
            </div>
          </div>
        </div>
      </div>
    </section>
  </div>

  <section class="section pb-0">
    <div class="container is-fluid">
      <div class="field">
        <label class="label">Enter base64 encoded BOC:</label>
        <div class="control">
          <textarea :class="['textarea', { 'is-danger': bocState.error != null }]" spellcheck="false" v-model="bocInput"
            rows="5" />
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
