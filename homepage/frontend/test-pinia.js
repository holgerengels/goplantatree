const { createPinia, defineStore } = require('pinia');
const { computed, ref } = require('vue');
const { createSSRApp } = require('vue');

const app = createSSRApp({});
const pinia = createPinia();
app.use(pinia);

const useStore = defineStore('main', () => {
  const token = ref('123');
  const authHeaders = computed(() => ({ Authorization: token.value }));
  return { authHeaders };
});

const store = useStore();
console.log(store.authHeaders);
console.log({ ...store.authHeaders });
