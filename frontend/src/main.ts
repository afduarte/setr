import { createApp } from "vue";
import { createPinia } from "pinia";
import { auth0 } from "@/utils";

import App from "./App.vue";
import router from "./router";

import "./assets/main.css";

const app = createApp(App);

app.use(createPinia());

// Router must be registered before the Auth0 SDK
app.use(router);

// Auth0 Login
app.use(auth0);

app.mount("#app");

export default app;
