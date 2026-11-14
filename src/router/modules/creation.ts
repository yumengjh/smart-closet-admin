const Layout = () => import("@/layout/index.vue");
export default {
  path: "/creation",
  name: "ClosetCreation",
  component: Layout,
  redirect: "/creation/templates",
  meta: { title: "穿搭创作", icon: "ri/image-line", rank: 39 },
  children: [
    {
      path: "/creation/templates",
      name: "ClosetCreationTemplates",
      component: () =>
        import("@/views/integrations/closet/creation/Templates.vue"),
      meta: { title: "模板", auths: ["closet:creation:read"] }
    },
    {
      path: "/creation/capabilities",
      name: "ClosetCreationCapabilities",
      component: () =>
        import("@/views/integrations/closet/creation/Capabilities.vue"),
      meta: { title: "模型能力", auths: ["closet:creation:read"] }
    },
    {
      path: "/creation/usage",
      name: "ClosetCreationUsage",
      component: () => import("@/views/integrations/closet/creation/Usage.vue"),
      meta: { title: "用量", auths: ["closet:creation:read"] }
    }
  ]
} satisfies RouteConfigsTable;
