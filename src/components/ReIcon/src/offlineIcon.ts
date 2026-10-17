// 这里存放本地图标，在 src/layout/index.vue 文件中加载，避免在首启动加载
import { getSvgInfo } from "@pureadmin/utils";
import { addIcon } from "@iconify/vue/dist/offline";

// https://icon-sets.iconify.design/ep/?keyword=ep
import EpHomeFilled from "~icons/ep/home-filled?raw";

// https://icon-sets.iconify.design/ri/?keyword=ri
import RiSettings3Line from "~icons/ri/settings-3-line?raw";
import RiUserSettingsLine from "~icons/ri/user-settings-line?raw";
import RiShieldKeyholeLine from "~icons/ri/shield-keyhole-line?raw";
import RiMenuLine from "~icons/ri/menu-line?raw";
import RiToolsLine from "~icons/ri/tools-line?raw";
import RiGlobalLine from "~icons/ri/global-line?raw";
import RiFileList3Line from "~icons/ri/file-list-3-line?raw";
import RiDeleteBinLine from "~icons/ri/delete-bin-line?raw";
import RiTerminalBoxLine from "~icons/ri/terminal-box-line?raw";
import RiArticleLine from "~icons/ri/article-line?raw";
import RiNotification3Line from "~icons/ri/notification-3-line?raw";
import RiUser3Line from "~icons/ri/user-3-line?raw";
import RiLockPasswordLine from "~icons/ri/lock-password-line?raw";
import RiTShirtLine from "~icons/ri/t-shirt-line?raw";
import RiBarChartBoxLine from "~icons/ri/bar-chart-box-line?raw";
import RiPulseLine from "~icons/ri/pulse-line?raw";
import RiComputerLine from "~icons/ri/computer-line?raw";
import RiDownload2Line from "~icons/ri/download-2-line?raw";
import RiCheckboxMultipleLine from "~icons/ri/checkbox-multiple-line?raw";
import RiGroupLine from "~icons/ri/group-line?raw";
import RiSearchLine from "~icons/ri/search-line?raw";

// 后端菜单的 icon 字段使用这里注册的 key（如 ri/pulse-line），新增菜单图标需在此补充
const icons = [
  // Element Plus Icon: https://github.com/element-plus/element-plus-icons
  ["ep/home-filled", EpHomeFilled],
  // Remix Icon: https://github.com/Remix-Design/RemixIcon
  ["ri/settings-3-line", RiSettings3Line],
  ["ri/user-settings-line", RiUserSettingsLine],
  ["ri/shield-keyhole-line", RiShieldKeyholeLine],
  ["ri/menu-line", RiMenuLine],
  ["ri/tools-line", RiToolsLine],
  ["ri/global-line", RiGlobalLine],
  ["ri/file-list-3-line", RiFileList3Line],
  ["ri/delete-bin-line", RiDeleteBinLine],
  ["ri/terminal-box-line", RiTerminalBoxLine],
  ["ri/article-line", RiArticleLine],
  ["ri/notification-3-line", RiNotification3Line],
  ["ri/user-3-line", RiUser3Line],
  ["ri/lock-password-line", RiLockPasswordLine],
  ["ri/t-shirt-line", RiTShirtLine],
  ["ri/bar-chart-box-line", RiBarChartBoxLine],
  ["ri/pulse-line", RiPulseLine],
  ["ri/computer-line", RiComputerLine],
  ["ri/download-2-line", RiDownload2Line],
  ["ri/checkbox-multiple-line", RiCheckboxMultipleLine],
  ["ri/group-line", RiGroupLine],
  ["ri/search-line", RiSearchLine]
];

icons.forEach(([name, icon]) => {
  addIcon(name as string, getSvgInfo(icon as string));
});
