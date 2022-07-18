<script setup lang="ts">
import { useRoute } from 'vue-router';

const route = useRoute();

defineProps({
  path: {
    type: String,
    required: true
  }
});
</script>

<template>
  <router-link
    :class="[
      'navbar-item',
      {
        'is-active': path === route.path,
        'is-primary': path === route.path
      }
    ]"
    :to="path"
  >
    <slot></slot>
  </router-link>
</template>
