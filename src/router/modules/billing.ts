const Layout = () => import("@/layout/index.vue");
export default {
  path: "/billing",
  name: "ClosetBilling",
  component: Layout,
  redirect: "/billing/settings",
  meta: { title: "收费管理", icon: "ri/file-list-3-line", rank: 40 },
  children: [
    {
      path: "/billing/settings",
      name: "ClosetBillingSettings",
      component: () =>
        import("@/views/integrations/closet/billing/Settings.vue"),
      meta: { title: "总开关与能力开关", auths: ["closet:billing:read"] }
    },
    {
      path: "/billing/tiers",
      name: "ClosetBillingTiers",
      component: () => import("@/views/integrations/closet/billing/Tiers.vue"),
      meta: { title: "档位与成本", auths: ["closet:billing:read"] }
    },
    {
      path: "/billing/products",
      name: "ClosetBillingProducts",
      component: () =>
        import("@/views/integrations/closet/billing/Products.vue"),
      meta: { title: "商品与订单", auths: ["closet:billing:read"] }
    },
    {
      path: "/billing/redemptions",
      name: "ClosetBillingRedemptions",
      component: () =>
        import("@/views/integrations/closet/billing/Redemptions.vue"),
      meta: { title: "兑换码批次", auths: ["closet:billing:read"] }
    },
    {
      path: "/billing/margin",
      name: "ClosetBillingMargin",
      component: () => import("@/views/integrations/closet/billing/Margin.vue"),
      meta: { title: "利润报表", auths: ["closet:billing:read"] }
    }
  ]
} satisfies RouteConfigsTable;
