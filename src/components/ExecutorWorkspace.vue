<script setup lang="ts">
import { ref, watch, onMounted, onBeforeUnmount } from 'vue';
import { TokensObject } from 'everscale-inpage-provider';

import { useEver } from '../providers/useEver';
import { makeStructure, convertError, deepCopy, convertFromTons, Structure } from '../common';

import ExecutorSidebar from './ExecutorSidebar.vue';
import ExecutorAbiForm from './ExecutorAbiForm.vue';
import EntityBuilderItem from './EntityBuilderItem.vue';

enum Action {
  RUN_LOCAL,
  SEND_EXTERNAL,
  SEND_INTERNAL
}

type Function = {
  name: string;
  structure: Structure[];
  input: TokensObject<string>;
  collapsed: boolean;
  inProgress: boolean;
  responsible: boolean;
  withSignature: boolean;
  attached: string;
  bounce: boolean;
  output?: string;
  error?: string;
};

const { ever, hasProvider, selectedAccount } = useEver();

const address = ref<string>();
const codeHash = ref<string>();
const abi = ref<string>();

const filter = ref<string>('');
const filterField = ref<HTMLDivElement>();

const functions = ref<Function[]>([]);

watch(
  abi,
  abi => {
    if (abi == null) {
      functions.value = [];
      return;
    }

    try {
      const parsed = JSON.parse(abi);
      functions.value = parsed.functions.map(f => {
        const input = {};
        const handleParam = param => {
          const structure = makeStructure(param, {});
          input[structure.name] = structure.defaultValue;
          return structure;
        };

        return {
          name: f.name,
          structure: f.inputs.map(handleParam),
          input,
          collapsed: true,
          inProgress: false,
          responsible: false,
          withSignature: true,
          attached: '1',
          bounce: false
        };
      });
    } catch (e) {
      functions.value = [];
    }
  },
  { immediate: true }
);

async function execute(f: Function, action: Action) {
  if (f.inProgress || abi.value == null || address.value == null) {
    return;
  }
  f.inProgress = true;
  try {
    await ever.ensureInitialized();

    const functionCall = {
      abi: abi.value,
      method: f.name,
      params: deepCopy(f.input)
    };

    let res: any;
    switch (action) {
      case Action.RUN_LOCAL: {
        res = await ever.rawApi.runLocal({
          address: address.value,
          functionCall,
          responsible: f.responsible
        });
        break;
      }
      case Action.SEND_EXTERNAL: {
        res = await (f.withSignature ? ever.rawApi.sendExternalMessage : ever.rawApi.sendUnsignedExternalMessage)({
          publicKey: selectedAccount.value.publicKey,
          recipient: address.value,
          payload: functionCall
        });
        break;
      }
      case Action.SEND_INTERNAL: {
        res = await ever.rawApi.sendMessage({
          sender: selectedAccount.value.address.toString(),
          recipient: address.value,
          amount: convertFromTons(f.attached),
          bounce: f.bounce,
          payload: functionCall
        });
        break;
      }
    }
    f.output = JSON.stringify(res, undefined, 2);
    f.error = undefined;
  } catch (e) {
    f.output = undefined;
    f.error = convertError(e);
  } finally {
    f.inProgress = false;
  }
}

function focusFilterField(event: KeyboardEvent) {
  if (event.keyCode === 27) {
    filterField.value?.focus();
  }
}

onMounted(() => {
  document.addEventListener('keydown', focusFilterField, false);
});
onBeforeUnmount(() => {
  document.removeEventListener('keydown', focusFilterField, false);
});
</script>

<template>
  <template v-if="hasProvider && selectedAccount != null">
    <div class="section executor-workspace">
      <div class="container is-fluid">
        <div class="columns">
          <div class="column is-4">
            <ExecutorSidebar :abi="abi" @update:address="address = $event" @update:codeHash="codeHash = $event" />
          </div>
          <div class="column is-8">
            <ExecutorAbiForm :code-hash="codeHash" @change="abi = $event" />

            <div v-if="abi != null && address != null" class="block">
              <div class="box field has-addons function-search pb-3">
                <div class="control is-expanded">
                  <input class="input" type="text" spellcheck="false" v-model="filter" ref="filterField" />
                  <p class="help">Function name</p>
                </div>
                <div class="control">
                  <button class="button" @click="filter = ''">Clear</button>
                </div>
              </div>

              <div
                v-for="(f, i) in functions"
                :key="i"
                v-show="f.name.toLowerCase().includes(filter.toLowerCase())"
                class="function-item box"
              >
                <label :class="['label', { 'mb-0': f.collapsed }]" @click="f.collapsed = !f.collapsed">
                  <span class="icon" style="cursor: pointer">
                    <i :class="['fa', f.collapsed ? 'fa-chevron-right' : 'fa-chevron-down']" />
                  </span>
                  <span class="function-name">{{ f.name }}</span>
                </label>

                <div v-show="!f.collapsed">
                  <div class="field">
                    <div class="control">
                      <EntityBuilderItem
                        v-for="(item, j) in f.structure"
                        :key="j"
                        :structure="item"
                        :value="f.input[item.name]"
                        @change="f.input[item.name] = $event"
                      />
                    </div>
                  </div>

                  <div class="buttons">
                    <div class="field mb-0 mr-2 has-addons">
                      <div class="control is-unselectable">
                        <button class="button" :disabled="f.inProgress" @click="f.responsible = !f.responsible">
                          <label class="checkbox">
                            <input
                              type="checkbox"
                              :disabled="f.inProgress"
                              :checked="f.responsible"
                              @change.prevent="" /></label
                          >&nbsp;Responsible
                        </button>
                      </div>
                      <div class="control">
                        <button
                          class="button is-success"
                          :disabled="f.inProgress"
                          @click="execute(f, Action.RUN_LOCAL)"
                        >
                          Run local
                        </button>
                      </div>
                    </div>

                    <div class="field mb-0 mr-2 has-addons">
                      <div class="control is-unselectable">
                        <button class="button" :disabled="f.inProgress" @click="f.withSignature = !f.withSignature">
                          <label class="checkbox">
                            <input
                              type="checkbox"
                              :disabled="f.inProgress"
                              :checked="f.withSignature"
                              @change.prevent="" /></label
                          >&nbsp;With signature
                        </button>
                      </div>
                      <div class="control">
                        <button
                          class="button is-success"
                          :disabled="f.inProgress"
                          @click="execute(f, Action.SEND_EXTERNAL)"
                        >
                          Send external
                        </button>
                      </div>
                    </div>

                    <div class="field mb-0 mr-2 has-addons">
                      <div class="control">
                        <input
                          class="input"
                          type="text"
                          placeholder="Amount, EVER"
                          :disabled="f.inProgress"
                          v-model="f.attached"
                        />
                      </div>
                      <div class="control is-unselectable">
                        <button class="button" :disabled="f.inProgress" @click="f.bounce = !f.bounce">
                          <label class="checkbox">
                            <input
                              type="checkbox"
                              :disabled="f.inProgress"
                              :checked="f.bounce"
                              @change.prevent="" /></label
                          >&nbsp;Bounce
                        </button>
                      </div>
                      <div class="control">
                        <button
                          class="button is-info"
                          :disabled="f.inProgress"
                          @click="execute(f, Action.SEND_INTERNAL)"
                        >
                          Send
                        </button>
                      </div>
                    </div>

                    <button class="button" @click="f.output = undefined">Clear output</button>
                  </div>

                  <template v-if="f.output != null || f.error != null">
                    <div class="divider mt-1 mb-1">output:</div>
                    <pre v-if="f.output != null" class="help">{{ f.output }}</pre>
                    <p v-if="f.error != null" class="help is-danger">{{ f.error }}</p>
                  </template>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  </template>
  <template v-else>
    <div class="hero is-fullheight-with-navbar">
      <div class="hero-body is-justify-content-center">
        <div>
          <p class="title">{{ hasProvider ? 'Wallet not connected' : 'Wallet not installed' }}</p>
        </div>
      </div>
    </div>
  </template>
</template>

<style lang="scss">
.executor-workspace {
  .function-search {
    position: sticky;
    top: 0.5em;
    background-color: white;

    z-index: 10;
  }

  .function-item {
    & > label {
      position: relative;
      display: flex;
      flex-direction: row;
      align-items: center;

      margin-bottom: 1em;

      .icon {
        position: absolute;

        width: 2em;
        height: 2em;

        cursor: pointer;
        background-color: whitesmoke;
        border-radius: 6px;

        &:hover {
          background-color: #eeeeee;
        }

        &:active {
          background-color: #e8e8e8;
        }
      }

      .function-name {
        margin-left: 2.5em;
      }
    }
  }
}
</style>
