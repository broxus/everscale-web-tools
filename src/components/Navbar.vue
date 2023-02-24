<script setup lang="ts">
import { ref, computed } from 'vue';
import { CURRENCY, convertAddress, fromNano } from '../common';

import { useEver } from '../providers/useEver';

import NavbarItem from './NavbarItem.vue';

const { hasProvider, selectedAccount, selectedAccountBalance, connectToWallet, changeAccount, disconnect } = useEver();

const isConnecting = ref(false);
const doConnectToWallet = async () => {
  isConnecting.value = true;
  connectToWallet().finally(() => (isConnecting.value = false));
};

const doChangeAccount = async () => {
  isConnecting.value = true;
  changeAccount().finally(() => (isConnecting.value = false));
};

const address = computed(() => convertAddress(selectedAccount.value?.address.toString()));
const balance = computed(() => fromNano(selectedAccountBalance.value));
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
      </div>
      <div class="navbar-end">
        <div class="navbar-item">
          <div class="buttons">
            <template v-if="hasProvider">
              <button
                v-if="selectedAccount == null"
                :class="['button is-primary', { 'is-loading': isConnecting }]"
                @click="doConnectToWallet"
              >
                <strong>Connect wallet</strong>
              </button>
              <template v-else>
                <button
                  v-if="selectedAccountBalance != null"
                  class="button is-white"
                  v-clipboard="selectedAccountBalance"
                >
                  {{ balance }} {{ CURRENCY }}
                </button>
                <div class="field has-addons">
                  <div class="control">
                    <button class="button is-light" v-clipboard="selectedAccount.address.toString()">
                      {{ address }}
                    </button>
                  </div>
                  <div class="control">
                    <button :class="['button', { 'is-loading': isConnecting }]" @click="doChangeAccount">
                      <span class="icon"><i class="fas fa-sync-alt" /></span>
                    </button>
                  </div>
                  <div class="control">
                    <button :class="['button', { 'is-loading': isConnecting }]" @click="disconnect">
                      <span class="icon"><i class="fas fa-sign-out-alt" /></span>
                    </button>
                  </div>
                </div>
              </template>
            </template>
            <template v-else>
              <a
                class="button is-light"
                target="_blank"
                href="https://chrome.google.com/webstore/detail/ever-wallet/cgeeodpfagjceefieflmdfphplkenlfk"
              >
                <strong>Install wallet</strong>
                <span class="icon"><i class="fa fa-external-link-alt" /></span>
              </a>
            </template>
          </div>
        </div>
      </div>
    </div>
  </nav>
</template>
