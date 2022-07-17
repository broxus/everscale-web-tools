<script setup lang="ts">
import { useEver } from '../providers/useEver';

import ExecutorSidebar from './ExecutorSidebar.vue';

const { hasProvider, selectedAccount } = useEver();
</script>

<template>
  <template v-if="hasProvider && selectedAccount != null">
    <div class="section executor-workspace">
      <div class="container is-fluid">
        <div class="columns">
          <div class="column is-4">
            <ExecutorSidebar />
          </div>
          <div class="column is-8"></div>
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
