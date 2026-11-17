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
      meta: {
        title: "创作效果",
        icon: "ri/image-line",
        auths: ["closet:creation:read"]
      }
    },
    {
      path: "/creation/showcases",
      name: "ClosetCreationShowcases",
      component: () =>
        import("@/views/integrations/closet/creation/Showcases.vue"),
      meta: {
        title: "官方素材",
        icon: "ri/gallery-line",
        auths: ["closet:showcase:read"]
      }
    },
    {
      path: "/creation/usage",
      name: "ClosetCreationUsage",
      component: () => import("@/views/integrations/closet/creation/Usage.vue"),
      meta: {
        title: "用量",
        icon: "ri/bar-chart-line",
        auths: ["closet:creation:read"]
      }
    },
    {
      path: "/creation/capabilities",
      name: "ClosetCreationCapabilities",
      component: () =>
        import("@/views/integrations/closet/creation/Capabilities.vue"),
      meta: {
        title: "模型高级设置",
        icon: "ri/settings-3-line",
        showLink: false,
        auths: ["closet:creation:read"]
      }
    }
  ]
} satisfies RouteConfigsTable;
