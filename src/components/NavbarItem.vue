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
    draggable="false"
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

<style>
a {
  -webkit-user-select: none; /* Safari 3.1+ */
  -moz-user-select: none; /* Firefox 2+ */
  -ms-user-select: none; /* IE 10+ */
  user-select: none; /* Standard syntax */
  user-drag: none;
  -webkit-user-drag: none;
}
</style>
