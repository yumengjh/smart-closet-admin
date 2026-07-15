export const userStatusPayload = status => ({ status });
export const rolePayload = (code, displayName) => ({ code, displayName });
export const roleCodeError = code =>
  /^[A-Z_]{2,64}$/.test(code)
    ? undefined
    : "角色编码只能使用 2–64 位大写字母和下划线";
