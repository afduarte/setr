import { createRouter, createWebHistory } from "vue-router";
import MainLayout from "../layouts/MainLayout.vue";
import CSVView from "../views/CSVView.vue";
import ListView from "../views/ListView.vue";
import LoginView from "@/views/LoginView.vue";
import { auth0 } from "@/utils";
import { authGuard } from "@auth0/auth0-vue";
import { useStore } from "@/stores/store";
import SetsView from "../views/SetsView.vue";
import CollectionView from "../views/CollectionView.vue";

const router = createRouter({
  history: createWebHistory(import.meta.env.BASE_URL),
  routes: [
    {
      path: "/",
      name: "root",
      redirect: "/app/sets",
    },
    {
      path: "/app/",
      name: "setr",
      redirect: "/app/sets",
      component: MainLayout,
      beforeEnter: authGuard,
      children: [
        {
          path: "sets",
          name: "set list",
          component: SetsView,
          beforeEnter: async () => {
            const store = useStore();
            await store.getUserData();
          },
        },
        {
          path: "set/:id",
          name: "set editor",
          component: ListView,
          beforeEnter: async (to) => {
            const store = useStore();
            await store.getUserData();
            const set = store.userData.sets.find((s) => s.id == to.params.id);
            if (!set) return false;
            store.loadSet(set);
          },
        },
        {
          path: "collection",
          name: "collection",
          component: CollectionView,
          beforeEnter: async () => {
            const store = useStore();
            await store.getUserData();
          },
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
