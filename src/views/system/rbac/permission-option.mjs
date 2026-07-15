export const permissionOptionLabel = permission =>
  permission.description?.trim() || permission.code;

export const permissionOptionTooltip = permission =>
  `${permissionOptionLabel(permission)}（${permission.code}）`;
