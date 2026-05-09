import { createApp } from 'vue';
import { createPinia } from 'pinia';
import router from './router/index.js';
import App from './App.vue';
import './assets/styles/variables.css';
import './assets/styles/base.css';

const app = createApp(App);
app.use(createPinia());
app.use(router);
app.mount('#app');
