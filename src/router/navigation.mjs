/**
 * Convert server-controlled menu records into route records.
 * Leaf pages deliberately omit `children`: the sidebar treats `children: []`
 * as an empty directory and hides it.
 */
export function toAsyncRouteRecords(routes, registry, directoryComponent) {
  return routes.flatMap(route => {
    const children = toAsyncRouteRecords(route.children ?? [], registry, directoryComponent);
    const component = route.componentKey
      ? registry[route.componentKey]
      : children.length > 0
        ? directoryComponent
        : undefined;
    if (!component) return [];
    const record = {
      path: route.path,
      name: route.code,
      component,
      meta: {
        backstage: true,
        title: route.title,
        icon: route.icon || undefined,
        rank: route.rank,
        keepAlive: route.keepAlive,
        auths: route.requiredPermission ? [route.requiredPermission] : undefined
      }
    };
    if (children.length > 0) {
      record.redirect = children[0].path;
      record.children = children;
    }
    return [record];
  });
}

/** Do not duplicate static route paths in the dynamic sidebar tree. */
export function filterRegisteredRoutePaths(routes, registeredPaths) {
  return routes.flatMap(route => {
    if (registeredPaths.has(route.path)) return [];
    const record = { ...route };
    if (record.children) {
      record.children = filterRegisteredRoutePaths(record.children, registeredPaths);
    }
    return [record];
  });
}
