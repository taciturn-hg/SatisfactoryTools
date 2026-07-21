import '@/assets/styles/global.css'
import '@/assets/styles/dark.css'

import { createApp } from 'vue'
import { createPinia } from 'pinia'
import AntDesignVue from 'ant-design-vue'

import App from './App.vue'
import router from './router'

const app = createApp(App)

app.use(createPinia())
app.use(router)
app.use(AntDesignVue)

app.mount('#app')
