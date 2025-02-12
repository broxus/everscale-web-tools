<script setup lang="ts">
import { computed } from 'vue';
import { CURRENCY, convertAddress, fromNano } from '../common';

import NavbarItem from './NavbarItem.vue';
import { useTvmConnect } from '../providers/useTvmConnect';

const { tvmConnect, tvmConnectState } = useTvmConnect();

const address = computed(() => convertAddress(tvmConnectState.value.address));
const balance = computed(() => fromNano(tvmConnectState.value.balance));
</script>

<template>
  <nav class="navbar is-spaced" role="navigation" aria-label="main navigation">
    <div class="navbar-brand">
      <router-link class="navbar-item" to="/"> 💎</router-link>
    </div>

    <div id="navbarBasicExample" class="navbar-menu">
      <div class="navbar-start">
        <NavbarItem path="/executor">Executor</NavbarItem>
        <NavbarItem path="/visualizer">Visualizer</NavbarItem>
        <NavbarItem path="/serializer">Serializer</NavbarItem>
        <NavbarItem path="/deserializer">Deserializer</NavbarItem>
        <NavbarItem path="/signer">Signer</NavbarItem>
        <NavbarItem path="/debugger">Debugger</NavbarItem>
        <NavbarItem path="/microwave">Microwave</NavbarItem>
        <NavbarItem path="/tip3">TIP3</NavbarItem>
        <NavbarItem path="/tip6">TIP6</NavbarItem>
        <NavbarItem path="/codegen">Codegen</NavbarItem>
      </div>
      <div class="navbar-end">
        <div class="navbar-item">
          <div class="wallet">
            <button
              v-if="!tvmConnectState.isReady"
              :class="['button is-primary', { 'is-loading': tvmConnectState.isLoading }]"
              @click="() => tvmConnect.connect()"
            >
              <strong>Connect wallet</strong>
            </button>
            <template v-else>
              <div class="tag is-white is-medium">
                Network ID: {{ tvmConnectState.networkId }}
              </div>
              <button
                class="button is-white"
                @click="() => tvmConnect.connect()"
              >
                {{ tvmConnectState.providerId }}
              </button>
              <button
                v-if="tvmConnectState.balance != null"
                class="button is-white"
                v-clipboard="tvmConnectState.balance"
              >
                {{ balance }} {{ CURRENCY }}
              </button>
              <div class="field has-addons">
                <div class="control">
                  <button class="button is-light" v-clipboard="tvmConnectState.address">
                    {{ address }}
                  </button>
                </div>
                <div class="control">
                  <button :class="['button', { 'is-loading': tvmConnectState.isLoading }]" @click="tvmConnect.changeAccount">
                    <span class="icon"><i class="fas fa-sync-alt" /></span>
                  </button>
                </div>
                <div class="control">
                  <button :class="['button', { 'is-loading': tvmConnectState.isLoading }]" @click="tvmConnect.disconnect">
                    <span class="icon"><i class="fas fa-sign-out-alt" /></span>
                  </button>
                </div>
              </div>
            </template>
          </div>
        </div>
      </div>
    </div>
  </nav>
</template>

<style scoped>
  .wallet {
    display: flex;
    align-items: center;
  }
</style>
