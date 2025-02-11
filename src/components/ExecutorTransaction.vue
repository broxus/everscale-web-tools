<script setup lang="ts">
import { computed, watch, shallowRef } from 'vue';
import { Message, Transaction, serializeTransaction } from 'everscale-inpage-provider';

import {
  CURRENCY,
  deepCopy,
  accountExplorerLink,
  convertAddress,
  convertDate,
  convertHash,
  fromNano,
  transactionExplorerLink
} from '../common';
import { useTvmConnect } from '../providers/useTvmConnect';

const props = defineProps<{
  transaction: Transaction;
  abi?: string;
  methods?: string[];
}>();

const { tvmConnectState, tvmConnect } = useTvmConnect()

const parsed = shallowRef<{ functionData?: string; eventsData?: string[] }>({});

function displayInMessageInfo(msg: Message): {
  src?: { address: string; executorLink: string; explorerLink: string };
  value: string;
  bounced: boolean;
} {
  return {
    src:
      msg.src != null
        ? {
            address: convertAddress(msg.src.toString()),
            executorLink: `/executor/${msg.src.toString()}`,
            explorerLink: accountExplorerLink(tvmConnectState.value.networkId, msg.src)
          }
        : undefined,
    value: msg.src != null ? fromNano(msg.value) : '0',
    bounced: msg.bounced
  };
}

function displayOutMessageInfo(msg: Message): {
  dst?: { address: string; executorLink?: string; explorerLink: string };
  value: string;
  bounce: boolean;
  bounced: boolean;
} {
  return {
    dst:
      msg.dst != null
        ? {
            address: convertAddress(msg.dst.toString()),
            executorLink: `/executor/${msg.dst.toString()}`,
            explorerLink: accountExplorerLink(tvmConnectState.value.networkId, msg.dst)
          }
        : undefined,
    value: msg.dst != null ? fromNano(msg.value) : '0',
    bounce: msg.bounce,
    bounced: msg.bounced
  };
}

const displayedInfo = computed(() => ({
  createdAt: convertDate(props.transaction.createdAt),
  totalFees: fromNano(props.transaction.totalFees),
  explorerLink: transactionExplorerLink(tvmConnectState.value.networkId, props.transaction.id.hash),
  hash: convertHash(props.transaction.id.hash),
  inMsg: displayInMessageInfo(props.transaction.inMessage),
  outMsgs: props.transaction.outMessages.map(displayOutMessageInfo)
}));

watch(
  [() => props.transaction, () => props.abi, () => props.methods, () => tvmConnectState.value.isReady],
  async ([transaction, abi, methods, isReady], _, onCleanup) => {
    const provider = tvmConnect.getProvider()

    if (abi == null || methods == null || !isReady || !provider) {
      return;
    }

    const localState = { abiChanged: false };
    onCleanup(() => {
      localState.abiChanged = true;
      parsed.value = {};
    });

    const [fn, { events }] = await provider.ensureInitialized().then(() => {
      const tx = deepCopy(serializeTransaction(transaction));
      return Promise.all([
        provider.rawApi.decodeTransaction({
          abi,
          transaction: tx,
          method: methods
        }),
        provider.rawApi.decodeTransactionEvents({
          abi,
          transaction: tx
        })
      ]);
    });
    if (localState.abiChanged) {
      return;
    }
    parsed.value = {
      functionData: fn != null ? JSON.stringify(fn, undefined, 2) : undefined,
      eventsData: events != null ? events.map(event => JSON.stringify(event, undefined, 2)) : undefined
    };
  },
  {
    immediate: true
  }
);
</script>

<template>
  <div class="box">
    <div class="columns mb-0">
      <div class="column is-family-monospace">
        <p>{{ displayedInfo.createdAt }}</p>
        <p class="help">Fees: {{ displayedInfo.totalFees }} {{ CURRENCY }}</p>
      </div>
      <div class="column is-narrow-fullhd">
        <div class="field is-grouped is-grouped-multiline">
          <div v-if="transaction.aborted" class="control">
            <div class="tags has-addons">
              <div class="tag is-danger">aborted</div>
            </div>
          </div>

          <div v-if="transaction.exitCode != null" class="control">
            <div class="tags has-addons">
              <span class="tag is-dark">exit code</span>
              <span class="tag is-info">{{ transaction.exitCode }}</span>
            </div>
          </div>

          <div v-if="transaction.resultCode != null && transaction.resultCode !== 0" class="control">
            <div class="tags has-addons">
              <span class="tag is-dark">result code</span>
              <span class="tag is-info">{{ transaction.resultCode }}</span>
            </div>
          </div>

          <div class="control">
            <div class="tags has-addons">
              <span class="tag is-dark is-button" v-clipboard="transaction.id.hash"
                ><span class="icon"><i class="fas fa-copy" /></span
              ></span>
              <a :href="displayedInfo.explorerLink" target="_blank" class="tag is-link">
                {{ displayedInfo.hash }}&nbsp;<span class="icon"><i class="fa fa-external-link-alt" /></span>
              </a>
            </div>
          </div>
        </div>
      </div>
    </div>

    <template v-if="parsed.functionData != null">
      <div class="divider mt-1 mb-1">function:</div>
      <pre class="help">{{ parsed.functionData }}</pre>
    </template>

    <template v-if="parsed.eventsData != null && parsed.eventsData.length > 0">
      <div class="divider mt-1 mb-1">events:</div>
      <pre v-for="(event, i) in parsed.eventsData" :key="i" class="help">{{ event }}</pre>
    </template>

    <div class="divider mt-1 mb-1">in:</div>
    <div :class="['message mb-0', { 'is-success': displayedInfo.inMsg.src != null }]">
      <div class="message-body pt-2 pb-2 pr-2">
        <div class="columns">
          <div class="column is-family-monospace">
            <template v-if="displayedInfo.inMsg.src != null">
              <p>{{ displayedInfo.inMsg.value }} {{ CURRENCY }}</p>
              <p class="help noselect">
                From:&nbsp;<router-link :to="displayedInfo.inMsg.src.executorLink" class="address-link"
                  >{{ displayedInfo.inMsg.src.address }} </router-link
                >&nbsp;
                <span class="tag is-button is-text" v-clipboard="transaction.inMessage.src"
                  ><span class="icon has-text-success-dark"><i class="fas fa-copy" /></span
                ></span>
                <a :href="displayedInfo.inMsg.src.explorerLink" target="_blank" class="tag is-button is-text ml-1">
                  <span class="icon has-text-success-dark"><i class="fa fa-external-link-alt" /></span>
                </a>
              </p>
            </template>
            <p v-else class="help">External in</p>
          </div>
          <div class="column is-narrow">
            <div class="field is-grouped is-grouped-multiline">
              <div v-if="displayedInfo.inMsg.bounced" class="control">
                <div class="tags has-addons">
                  <span class="tag is-warning">bounced</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>

    <div v-if="displayedInfo.outMsgs.length > 0" class="divider mt-1 mb-1">out:</div>
    <div v-for="(msg, i) in displayedInfo.outMsgs" :key="i" :class="['message mb-1', { 'is-danger': msg.dst != null }]">
      <div class="message-body pt-2 pb-2 pr-2">
        <div class="columns">
          <div class="column is-family-monospace">
            <template v-if="msg.dst != null">
              <p>{{ msg.value }} {{ CURRENCY }}</p>
              <p class="help noselect">
                To:&nbsp;<router-link :to="msg.dst.executorLink" class="address-link"
                  >{{ msg.dst.address }} </router-link
                >&nbsp;
                <span class="tag is-button is-text" v-clipboard="transaction.outMessages[i].dst"
                  ><span class="icon has-text-danger-dark"><i class="fas fa-copy" /></span
                ></span>
                <a :href="msg.dst.explorerLink" target="_blank" class="tag is-button is-text ml-1">
                  <span class="icon has-text-danger-dark"><i class="fa fa-external-link-alt" /></span>
                </a>
              </p>
            </template>
            <p v-else class="help">External out</p>
          </div>
          <div class="column is-narrow">
            <div class="field is-grouped is-grouped-multiline">
              <div v-if="msg.bounced" class="control">
                <div class="tags has-addons">
                  <span class="tag is-warning">bounced</span>
                </div>
              </div>
              <div v-if="msg.bounce" class="control">
                <div class="tags has-addons">
                  <span class="tag is-info">bounce</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<style lang="scss">
a.address-link {
  &:hover {
    font-weight: bold;
  }
}

a.tag.is-button {
  text-decoration: none;
}

.tag.is-button {
  cursor: pointer;

  &.is-text {
    background-color: transparent;
  }

  &.is-text:hover {
    background-color: rgba(0, 0, 0, 0.1);
  }

  &.is-text:active {
    background-color: rgba(0, 0, 0, 0.2);
  }

  &.is-dark:hover {
    box-shadow: 0 0 0 0.125em rgba(54, 54, 54, 0.25);
  }

  &.is-dark:active {
    background-color: #292929;
  }
}
</style>
