import { defineConfig } from "wxt";
import { EXTENSION_VERSION } from "./src/lib/release";

export default defineConfig({
  modules: ["@wxt-dev/module-react"],
  manifest: {
    name: "JavRanking",
    description: "JavRanking browser extension",
    version: EXTENSION_VERSION,
    icons: {
      16: "icons/icon-16.png",
      32: "icons/icon-32.png",
      48: "icons/icon-48.png",
      128: "icons/icon-128.png",
    },
    action: {
      default_title: "JavRanking",
      default_icon: {
        16: "icons/icon-16.png",
        32: "icons/icon-32.png",
        48: "icons/icon-48.png",
        128: "icons/icon-128.png",
      },
    },
    permissions: ["activeTab", "scripting", "tabs"],
    host_permissions: ["https://javranking.top/*", "*://*/*"],
    browser_specific_settings: {
      gecko: {
        id: "extension@javranking.top",
        data_collection_permissions: {
          required: ["none"],
        },
      },
    },
  },
});
