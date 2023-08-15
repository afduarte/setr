import { createApp } from "vue";
import { createPinia } from "pinia";
import { auth0 } from "@/utils";

import App from "./App.vue";
import router from "./router";

import "./assets/main.css";

import { library } from "@fortawesome/fontawesome-svg-core";
import { FontAwesomeIcon } from "@fortawesome/vue-fontawesome";
/* import specific icons */
import {
  faPencil,
  faTrash,
  faPlus,
  faClock,
  faMusic,
} from "@fortawesome/free-solid-svg-icons";

/* add icons to the library */
library.add(faPencil, faTrash, faPlus, faClock, faMusic);

/* add font awesome icon component */

const app = createApp(App);

app.use(createPinia());

// Router must be registered before the Auth0 SDK
app.use(router);

// Auth0 Login
app.use(auth0);

app.component("fa-icon", FontAwesomeIcon);

app.mount("#app");

export default app;
