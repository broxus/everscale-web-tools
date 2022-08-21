<script setup lang="ts">
import Navbar from './components/Navbar.vue';
</script>

<template>
  <Navbar />
  <div class="container is-fluid">
    <router-view />
  </div>
</template>

<style lang="scss" src="./styles/main.scss" />
