<script setup lang="ts">
import { computed } from 'vue';
import { Transaction } from 'everscale-inpage-provider';

import { useEver } from '../providers/useEver';
import { convertAddress, convertDate, convertHash, convertTons, transactionExplorerLink } from '../common';

const props = defineProps<{
  transaction: Transaction;
}>();

const { selectedNetwork } = useEver();

const displayedInfo = computed(() => ({
  createdAt: convertDate(props.transaction.createdAt),
  totalFees: convertTons(props.transaction.totalFees),
  explorerLink: transactionExplorerLink(selectedNetwork.value, props.transaction.id.hash),
  hash: convertHash(props.transaction.id.hash)
}));
</script>

<template>
  <div class="box">
    <div class="columns mb-0">
      <div class="column is-family-monospace">
        <p>{{ displayedInfo.createdAt }}</p>
        <p>Fees: {{ displayedInfo.totalFees }} EVER</p>
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
  </div>
</template>
