<script setup lang="ts">
import { useEver } from '../providers/useEver';

const { hasProvider, selectedAccount } = useEver();
</script>

<template>
  <template v-if="hasProvider && selectedAccount != null">
    <slot></slot>
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
