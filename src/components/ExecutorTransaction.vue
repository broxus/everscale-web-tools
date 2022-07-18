<script setup lang="ts">
import { computed, watch, shallowRef } from 'vue';
import { Message, Transaction, serializeTransaction } from 'everscale-inpage-provider';

import { useEver } from '../providers/useEver';
import {
  deepCopy,
  accountExplorerLink,
  convertAddress,
  convertDate,
  convertHash,
  convertTons,
  transactionExplorerLink
} from '../common';

const props = defineProps<{
  transaction: Transaction;
  abi?: string;
  methods?: string[];
}>();

const { ever, selectedNetwork } = useEver();

const parsed = shallowRef<{ functionData?: string; eventsData?: string[] }>({});

function displayInMessageInfo(msg: Message): {
  src?: { address: string; link: string };
  value: string;
  bounced: boolean;
} {
  return {
    src:
      msg.src != null
        ? {
            address: convertAddress(msg.src.toString()),
            link: accountExplorerLink(selectedNetwork.value, msg.src)
          }
        : undefined,
    value: msg.src != null ? convertTons(msg.value) : '0',
    bounced: msg.bounced
  };
}

function displayOutMessageInfo(msg: Message): {
  dst?: { address: string; link: string };
  value: string;
  bounce: boolean;
  bounced: boolean;
} {
  return {
    dst:
      msg.dst != null
        ? {
            address: convertAddress(msg.dst.toString()),
            link: accountExplorerLink(selectedNetwork.value, msg.dst)
          }
        : undefined,
    value: msg.dst != null ? convertTons(msg.value) : '0',
    bounce: msg.bounce,
    bounced: msg.bounced
  };
}

const displayedInfo = computed(() => ({
  createdAt: convertDate(props.transaction.createdAt),
  totalFees: convertTons(props.transaction.totalFees),
  explorerLink: transactionExplorerLink(selectedNetwork.value, props.transaction.id.hash),
  hash: convertHash(props.transaction.id.hash),
  inMsg: displayInMessageInfo(props.transaction.inMessage),
  outMsgs: props.transaction.outMessages.map(displayOutMessageInfo)
}));

watch(
  [() => props.transaction, () => props.abi, () => props.methods],
  async ([transaction, abi, methods], _, onCleanup) => {
    if (abi == null || methods == null) {
      return;
    }

    const localState = { abiChanged: false };
    onCleanup(() => {
      localState.abiChanged = true;
      parsed.value = {};
    });

    const [fn, { events }] = await ever.ensureInitialized().then(() => {
      const tx = deepCopy(serializeTransaction(transaction));
      return Promise.all([
        ever.rawApi.decodeTransaction({
          abi,
          transaction: tx,
          method: methods
        }),
        ever.rawApi.decodeTransactionEvents({
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
        <p class="help">Fees: {{ displayedInfo.totalFees }} EVER</p>
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

          <a :href="displayedInfo.explorerLink" target="_blank" class="tag is-link">
            {{ displayedInfo.hash }}&nbsp;<span class="icon"><i class="fa fa-external-link-alt" /></span>
          </a>
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
              <p>{{ displayedInfo.inMsg.value }} EVER</p>
              <p class="help">
                From:&nbsp;<a :href="displayedInfo.inMsg.src.link" target="_blank">{{
                  displayedInfo.inMsg.src.address
                }}</a>
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
              <p>{{ msg.value }} EVER</p>
              <p class="help">
                To:&nbsp;<a :href="msg.dst.link" target="_blank">{{ msg.dst.address }}</a>
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
