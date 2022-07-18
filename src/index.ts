import { createApp } from 'vue';
import { VueClipboard } from '@soerenmartius/vue3-clipboard';
import init from '@core';
import './common';

import App from './App.vue';
import router from './router';

const initPromise = init();

const app = createApp(App);
app.use(router);
app.use(VueClipboard);

initPromise.then(() => app.mount('#root'));
