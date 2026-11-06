import { h, defineComponent } from "vue";
import { Icon as IconifyIcon } from "@iconify/vue/dist/offline";
import type { IconifyIcon as IconData } from "@iconify/vue";

function isIconData(value: unknown): value is IconData {
  return (
    value !== null &&
    typeof value === "object" &&
    "body" in value &&
    typeof value.body === "string"
  );
}

// Iconify Icon在Vue里本地使用（用于内网环境）
export default defineComponent({
  name: "IconifyIconOffline",
  components: { IconifyIcon },
  props: {
    icon: {
      default: null
    }
  },
  render() {
    const attrs = this.$attrs;
    if (typeof this.icon === "string" || isIconData(this.icon)) {
      return h(
        IconifyIcon,
        {
          icon: this.icon,
          "aria-hidden": false,
          style: attrs?.style
            ? Object.assign(attrs.style, { outline: "none" })
            : { outline: "none" },
          ...attrs
        },
        {
          default: () => []
        }
      );
    } else {
      return h(
        this.icon,
        {
          "aria-hidden": false,
          style: attrs?.style
            ? Object.assign(attrs.style, { outline: "none" })
            : { outline: "none" },
          ...attrs
        },
        {
          default: () => []
        }
      );
    }
  }
});
