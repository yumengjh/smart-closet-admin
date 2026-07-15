import { reactive } from "vue";
import type { FormRules } from "element-plus";

/** 登录校验 */
const loginRules = reactive<FormRules>({
  password: [
    {
      required: true,
      min: 10,
      max: 128,
      message: "密码长度为 10-128 位",
      trigger: "blur"
    }
  ]
});

export { loginRules };
