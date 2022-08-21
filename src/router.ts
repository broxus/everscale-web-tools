import { createRouter, createWebHistory } from 'vue-router';

import ExecutorWorkspace from './components/ExecutorWorkspace.vue';
import VisualizerWorkspace from './components/VisualizerWorkspace.vue';
import SerializerWorkspace from './components/SerializerWorkspace.vue';
import DeserializerWorkspace from './components/DeserializerWorkspace.vue';
import SignerWorkspace from './components/SignerWorkspace.vue';
import DebuggerWorkspace from './components/DebuggerWorkspace.vue';
import MicrowaveWorkspace from './components/MicrowaveWorkspace.vue';

const router = createRouter({
  history: createWebHistory(),
  routes: [
    { path: '/', redirect: '/executor' },
    { path: '/executor', component: ExecutorWorkspace },
    { path: '/visualizer', component: VisualizerWorkspace },
    { path: '/serializer', component: SerializerWorkspace },
    { path: '/deserializer', component: DeserializerWorkspace },
    { path: '/signer', component: SignerWorkspace },
    { path: '/debugger', component: DebuggerWorkspace },
    { path: '/microwave', component: MicrowaveWorkspace }
  ]
});

export default router;
