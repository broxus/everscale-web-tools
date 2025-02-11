<script setup lang="ts">
import { useTvmConnect } from '../providers/useTvmConnect';

const { tvmConnectState } = useTvmConnect()
</script>

<template>
  <template v-if="tvmConnectState.account">
    <slot></slot>
  </template>
  <template v-else>
    <div class="hero is-fullheight-with-navbar">
      <div class="hero-body is-justify-content-center">
        <div>
          <p class="title">Wallet not connected</p>
        </div>
      </div>
    </div>
  </template>
</template>
