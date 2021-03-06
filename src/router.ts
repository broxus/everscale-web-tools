import { createRouter, createWebHistory } from 'vue-router';

import ExecutorWorkspace from './components/ExecutorWorkspace.vue';
import VisualizerWorkspace from './components/VisualizerWorkspace.vue';
import SerializerWorkspace from './components/SerializerWorkspace.vue';
import SignerWorkspace from './components/SignerWorkspace.vue';
import DebuggerWorkspace from './components/DebuggerWorkspace.vue';

const router = createRouter({
  history: createWebHistory(),
  routes: [
    { path: '/', redirect: '/executor' },
    { path: '/executor', component: ExecutorWorkspace },
    { path: '/visualizer', component: VisualizerWorkspace },
    { path: '/serializer', component: SerializerWorkspace },
    { path: '/signer', component: SignerWorkspace },
    { path: '/debugger', component: DebuggerWorkspace }
  ]
});

export default router;
