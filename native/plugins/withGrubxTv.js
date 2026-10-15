/**
 * GrubX TV support config plugin (android only).
 *
 * Adds the LEANBACK feature + launcher intent so the APK also appears in the
 * Android TV launcher, while remaining installable on phones/tablets
 * (required=false). Applied automatically during `expo prebuild`; the ios/ and
 * android/ directories are never edited by hand (Continuous Native Generation).
 */

const { withAndroidManifest } = require("expo/config-plugins");

const LEANBACK_FEATURE = "android.software.leanback";
const LEANBACK_LAUNCHER = "android.intent.category.LEANBACK_LAUNCHER";
const MAIN_ACTION = "android.intent.action.MAIN";

const withGrubxTv = (config) =>
  withAndroidManifest(config, (current) => {
    const manifest = current.modResults;
    // Expo's modResults wraps the real <manifest> element in a root object:
    // { manifest: { ...application/intent data } }. Some Expo versions skip
    // the wrapper; support both shapes.
    const root = manifest.manifest ?? manifest;

    // uses-feature must be a direct child of <manifest>.
    root["uses-feature"] = (root["uses-feature"] ?? []).filter(
      (entry) => entry?.$?.name !== LEANBACK_FEATURE,
    );
    root["uses-feature"].unshift({
      $: { "android:name": LEANBACK_FEATURE, "android:required": "false" },
    });

    const application = Array.isArray(root.application) ? root.application[0] : root.application;
    if (!application) {
      return current;
    }

    // TV launchers expect a 320x180 banner next to the app label.
    if (!application.$?.["android:banner"]) {
      application.$ = { ...application.$, "android:banner": "@drawable/tv_banner" };
    }

    const activities = application.activity ?? [];
    for (const activity of activities) {
      const mainActivity = activity.$?.["android:name"]?.includes("MainActivity");
      if (!mainActivity) {
        continue;
      }

      const intentFilters = activity["intent-filter"] ?? [];
      let launcher = intentFilters.find((filter) =>
        (filter.category ?? []).some((entry) => entry.$?.name === LEANBACK_LAUNCHER),
      );
      if (!launcher) {
        launcher = { action: [], category: [] };
        intentFilters.push(launcher);
      }

      if (!launcher.action.some((entry) => entry.$?.name === MAIN_ACTION)) {
        launcher.action.push({ $: { "android:name": MAIN_ACTION } });
      }
      if (!launcher.category.some((entry) => entry.$?.name === "android.intent.category.DEFAULT")) {
        launcher.category.push({ $: { "android:name": "android.intent.category.DEFAULT" } });
      }
      if (!launcher.category.some((entry) => entry.$?.name === LEANBACK_LAUNCHER)) {
        launcher.category.push({ $: { "android:name": LEANBACK_LAUNCHER } });
      }

      activity["intent-filter"] = intentFilters;
    }

    application.activity = activities;
    return current;
  });

module.exports = withGrubxTv;
