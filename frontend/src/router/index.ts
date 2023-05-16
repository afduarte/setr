import { createRouter, createWebHistory } from "vue-router";
import MainLayout from "../layouts/MainLayout.vue";
import CSVView from "../views/CSVView.vue";
import ListView from "../views/ListView.vue";
import LoginView from "@/views/LoginView.vue";
import { auth0 } from "@/utils";
import { authGuard } from "@auth0/auth0-vue";

const router = createRouter({
  history: createWebHistory(import.meta.env.BASE_URL),
  routes: [
    {
      path: "/",
      name: "root",
      redirect: "/app/",
    },
    {
      path: "/app/",
      name: "setr",
      component: MainLayout,
      beforeEnter: authGuard,
      children: [
        {
          path: "",
          name: "home",
          component: ListView,
        },
        {
          path: "csv",
          name: "csv",
          component: CSVView,
        },
      ],
    },
    {
      path: "/login",
      name: "Login",
      component: LoginView,
    },
    {
      path: "/logout",
      name: "Logout",
      component: LoginView,
      beforeEnter: () => {
        auth0.logout({ logoutParams: { returnTo: window.location.origin } });
        return { name: "Login" };
      },
    },
  ],
});

export default router;
