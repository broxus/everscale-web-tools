<script setup lang="ts">
import { ref, watch, onMounted, onBeforeUnmount } from 'vue';
import { useRouter } from 'vue-router';
import { TokensObject } from 'everscale-inpage-provider';

import { useEver } from '../providers/useEver';
import { CURRENCY, makeStructure, convertError, deepCopy, toNano, checkAddress, rewriteAbiUrl } from '../common';

import ExecutorSidebar from './ExecutorSidebar.vue';
import ExecutorAbiForm from './ExecutorAbiForm.vue';
import EntityBuilderItem from './EntityBuilderItem.vue';
import ConnectWalletStub from './ConnectWalletStub.vue';
import TextArea from './TextArea.vue';

enum Action {
  RUN_LOCAL,
  SEND_EXTERNAL,
  SEND_INTERNAL
}

type FunctionState = {
  name: string;
  structure: any[]; // `Structure` type here will make typescript cry
  input: TokensObject<string>;
  jsonInput: string;
  collapsed: boolean;
  asJson: boolean;
  inProgress: boolean;
  responsible: boolean;
  withSignature: boolean;
  attached: string;
  bounce: boolean;
  output?: string;
  error?: string;
};

type FieldsState = {
  collapsed: boolean;
  inProgress: boolean;
  allowPartial: boolean;
  output?: string;
  error?: string;
};

const { ever, selectedAccount } = useEver();
const { push, currentRoute } = useRouter();

const address = ref<string>();
const codeHash = ref<string>();
const abi = ref<string>();

const filter = ref<string>('');
const filterField = ref<HTMLDivElement>();

const functions = ref<FunctionState[]>([]);
const fields = ref<FieldsState>();

function formatJson(data: any): string {
  return JSON.stringify(data, undefined, 2);
}

watch(
  () => [currentRoute.value.params, currentRoute.value.query],
  ([newParams, newQuery], old) => {
    const defaultAbi = newQuery['abi'];
    if (typeof defaultAbi === 'string' && abi.value == null) {
      try {
        const abiUrl = rewriteAbiUrl(new URL(defaultAbi));
        if (abiUrl.protocol != 'https:') {
          throw new Error('Only https requests are allowed for `abi` param');
        }

        fetch(abiUrl.toString(), {})
          .then(res => res.text())
          .then(text => {
            if (abi.value == null) {
              abi.value = text;
            }
          })
          .catch(console.error);
      } catch (e: any) {
        console.error(e);
      }
    }

    const newAddress = newParams['address'] as string;
    if (newAddress != old?.[0]?.['address']) {
      address.value = newAddress != null && checkAddress(newAddress) ? newAddress : undefined;
    }
  },
  {
    immediate: true
  }
);

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
          jsonInput: formatJson(input),
          collapsed: true,
          asJson: false,
          inProgress: false,
          responsible: false,
          withSignature: true,
          attached: '1',
          bounce: false
        } as FunctionState;
      });

      const oldFields = fields.value;
      fields.value =
        parsed.fields != null
          ? {
              collapsed: oldFields != null ? oldFields.collapsed : true,
              allowPartial: oldFields != null ? oldFields.allowPartial : false,
              inProgress: false,
              output: undefined,
              error: undefined
            }
          : undefined;
    } catch (e) {
      functions.value = [];
    }
  },
  { immediate: true }
);

async function execute(f: FunctionState, action: Action) {
  if (f.inProgress || abi.value == null || address.value == null) {
    return;
  }
  f.inProgress = true;
  try {
    await ever.ensureInitialized();

    const functionCall = {
      abi: abi.value,
      method: f.name,
      params: f.asJson ? JSON.parse(f.jsonInput) : deepCopy(f.input)
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
          amount: toNano(f.attached),
          bounce: f.bounce,
          payload: functionCall
        });
        break;
      }
    }
    f.output = formatJson(res);
    f.error = undefined;
  } catch (e) {
    f.output = undefined;
    f.error = convertError(e);
  } finally {
    f.inProgress = false;
  }
}

async function updateFields() {
  const f = fields.value;
  if (f == null || f.inProgress || abi.value == null || address.value == null) {
    return;
  }

  f.inProgress = true;
  try {
    await ever.ensureInitialized();
    const { fields } = await ever.rawApi.getContractFields({
      address: address.value,
      abi: abi.value,
      allowPartial: f.allowPartial
    });
    f.output = formatJson(fields);
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

function toggleJsonInput(state: FunctionState) {
  state.asJson = !state.asJson;
  state.collapsed = false;
  if (state.asJson) {
    state.jsonInput = formatJson(state.input);
  } else {
    try {
      state.input = JSON.parse(state.jsonInput);
    } catch (e) {}
  }
}

function resetJsonInput(state: FunctionState) {
  const input = {};
  for (const item of state.structure) {
    input[item.name] = item.defaultValue;
  }
  state.jsonInput = formatJson(input);
}

function openAccount(address: string) {
  push({ name: 'executor', params: { address } });
}

onMounted(() => {
  document.addEventListener('keydown', focusFilterField, false);
});
onBeforeUnmount(() => {
  document.removeEventListener('keydown', focusFilterField, false);
});
</script>

<template>
  <ConnectWalletStub>
    <div class="section executor-workspace">
      <div class="container is-fluid">
        <div class="columns">
          <div class="column is-4">
            <ExecutorSidebar
              :address="address"
              :abi="abi"
              @update:address="openAccount($event)"
              @update:codeHash="codeHash = $event"
            />
          </div>
          <div class="column is-8">
            <ExecutorAbiForm
              :address="address"
              :code-hash="codeHash"
              @change="abi = $event"
            />

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

              <div class="function-item box" v-if="fields != null">
                <div :class="['label', { 'mb-0': fields.collapsed }]">
                  <div class="clickable" @click="fields.collapsed = !fields.collapsed">
                    <span class="icon mr-3" style="cursor: pointer">
                      <i :class="['fa', fields.collapsed ? 'fa-chevron-right' : 'fa-chevron-down']" />
                    </span>
                    <span class="function-name">Contract Fields</span>
                  </div>
                </div>

                <div v-show="!fields.collapsed">
                  <div class="buttons">
                    <div class="field mb-0 mr-2 has-addons">
                      <div class="control is-unselectable">
                        <button
                          class="button"
                          :disabled="fields.inProgress"
                          @click="fields.allowPartial = !fields.allowPartial"
                        >
                          <label class="checkbox">
                            <input
                              type="checkbox"
                              :disabled="fields.inProgress"
                              :checked="fields.allowPartial"
                              @change.prevent="" /></label
                          >&nbsp;Allow partial
                        </button>
                      </div>
                      <div class="control">
                        <button class="button is-success" :disabled="fields.inProgress" @click="updateFields">
                          Unpack
                        </button>
                      </div>
                    </div>

                    <button class="button" @click="fields.output = undefined">Clear output</button>
                  </div>

                  <template v-if="fields.output != null || fields.error != null">
                    <div class="divider mt-1 mb-1">output:</div>
                    <pre v-if="fields.output != null" class="help">{{ fields.output }}</pre>
                    <p v-if="fields.error != null" class="help is-danger">{{ fields.error }}</p>
                  </template>
                </div>
              </div>

              <div
                v-for="(f, i) in functions"
                :key="i"
                v-show="f.name.toLowerCase().includes(filter.toLowerCase())"
                class="function-item box"
              >
                <div :class="['label', { 'mb-0': f.collapsed }]">
                  <div class="clickable" @click="f.collapsed = !f.collapsed">
                    <span class="icon mr-3" style="cursor: pointer">
                      <i :class="['fa', f.collapsed ? 'fa-chevron-right' : 'fa-chevron-down']" />
                    </span>
                    <span class="function-name">{{ f.name }}</span>
                  </div>
                  <button :class="['button is-small', { 'is-info': f.asJson }]" @click="toggleJsonInput(f)">
                    JSON
                  </button>
                </div>

                <div v-show="!f.collapsed">
                  <div class="field">
                    <div class="control json-input" v-if="f.asJson">
                      <div class="is-flex is-flex-direction-row">
                        <span class="tag mb-0">JSON input:</span>
                        <a class="tag is-delete mb-0" @click="resetJsonInput(f)" />
                      </div>
                      <TextArea
                        class="textarea is-small is-family-monospace"
                        spellcheck="false"
                        rows="5"
                        v-model="f.jsonInput"
                      />
                    </div>
                    <div class="control" v-else>
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
                          :placeholder="`Amount, ${CURRENCY}`"
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
  </ConnectWalletStub>
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
    & > .label {
      position: relative;
      display: flex;
      flex-direction: row;
      align-items: center;

      margin-bottom: 1em;

      .clickable {
        display: flex;
        flex-direction: row;
        align-items: center;

        width: 100%;
      }

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

    .json-input {
      .tag {
        border-bottom-left-radius: 0;
        border-bottom-right-radius: 0;
      }
    }
  }
}
</style>
