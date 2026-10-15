/**
 * GrubX lightweight localization.
 *
 * No i18n framework dependency: a flat dictionary per locale, a `t()` with
 * `{placeholder}` interpolation (never string concatenation, so translations
 * stay word-order correct), `Intl` wrappers for locale-aware dates/times and
 * compact numbers, and an RTL map. `formatX` helpers keep every screen on the
 * browser's own timezone unless a source explicitly carries one.
 *
 * Pure module (no DOM access) so tests and native code can import it freely.
 */

export type LocaleCode =
  | "system"
  | "en"
  | "es"
  | "fr"
  | "de"
  | "pt-BR"
  | "ar"
  | "ja";

/** Full-column dictionaries. Keys are stable identifiers, never English text. */
export const MESSAGES = {
  en: {
    "nav.home": "Home",
    "nav.movies": "Movies",
    "nav.tv": "TV Shows",
    "nav.anime": "Anime",
    "nav.manga": "Manga",
    "nav.live": "Live TV",
    "nav.mylist": "My List",
    "nav.search": "Search",
    "nav.settings": "Settings",
    "nav.download": "Download",
    "nav.openMenu": "Open navigation",
    "nav.closeMenu": "Close navigation",
    "nav.label": "Primary navigation",
    "nav.drawerLabel": "Section menu",
    "a11y.skipToContent": "Skip to content",
    "a11y.loading": "Loading…",
    "app.offlineBanner": "You're offline — showing saved pages and your locally stored library.",
    "app.offlineRetry": "Retry connection",
    "app.reconnected": "Back online — queued progress and list changes are syncing.",
    "app.offlineCatalogue": "Saved catalogue data is shown below. Playback needs a connection.",
    "settings.locale": "Language",
    "settings.localeSystem": "Match system",
  },
  es: {
    "nav.home": "Inicio",
    "nav.movies": "Películas",
    "nav.tv": "Series",
    "nav.anime": "Anime",
    "nav.manga": "Manga",
    "nav.live": "TV en vivo",
    "nav.mylist": "Mi lista",
    "nav.search": "Buscar",
    "nav.settings": "Ajustes",
    "nav.download": "Descargar",
    "nav.openMenu": "Abrir navegación",
    "nav.closeMenu": "Cerrar navegación",
    "nav.label": "Navegación principal",
    "nav.drawerLabel": "Menú de secciones",
    "a11y.skipToContent": "Saltar al contenido",
    "a11y.loading": "Cargando…",
    "app.offlineBanner": "Sin conexión — se muestran páginas guardadas y tu biblioteca local.",
    "app.offlineRetry": "Reintentar conexión",
    "app.reconnected": "De nuevo en línea — se están sincronizando los cambios en cola.",
    "app.offlineCatalogue": "Se muestra el catálogo guardado. Reproducir requiere conexión.",
    "settings.locale": "Idioma",
    "settings.localeSystem": "Igual al sistema",
  },
  fr: {
    "nav.home": "Accueil",
    "nav.movies": "Films",
    "nav.tv": "Séries",
    "nav.anime": "Animés",
    "nav.manga": "Mangas",
    "nav.live": "TV en direct",
    "nav.mylist": "Ma liste",
    "nav.search": "Recherche",
    "nav.settings": "Réglages",
    "nav.download": "Télécharger",
    "nav.openMenu": "Ouvrir la navigation",
    "nav.closeMenu": "Fermer la navigation",
    "nav.label": "Navigation principale",
    "nav.drawerLabel": "Menu des sections",
    "a11y.skipToContent": "Aller au contenu",
    "a11y.loading": "Chargement…",
    "app.offlineBanner": "Hors ligne — pages enregistrées et bibliothèque locale affichées.",
    "app.offlineRetry": "Réessayer la connexion",
    "app.reconnected": "De nouveau en ligne — les modifications en attente se synchronisent.",
    "app.offlineCatalogue": "Catalogue enregistré ci-dessous. La lecture exige une connexion.",
    "settings.locale": "Langue",
    "settings.localeSystem": "Selon le système",
  },
  de: {
    "nav.home": "Start",
    "nav.movies": "Filme",
    "nav.tv": "Serien",
    "nav.anime": "Anime",
    "nav.manga": "Manga",
    "nav.live": "Live-TV",
    "nav.mylist": "Meine Liste",
    "nav.search": "Suche",
    "nav.settings": "Einstellungen",
    "nav.download": "Download",
    "nav.openMenu": "Navigation öffnen",
    "nav.closeMenu": "Navigation schließen",
    "nav.label": "Hauptnavigation",
    "nav.drawerLabel": "Bereichsmenü",
    "a11y.skipToContent": "Zum Inhalt springen",
    "a11y.loading": "Lädt…",
    "app.offlineBanner": "Offline — gespeicherte Seiten und Ihre lokale Bibliothek werden angezeigt.",
    "app.offlineRetry": "Verbindung erneut versuchen",
    "app.reconnected": "Wieder online — in der Warteschlange liegende Änderungen werden synchronisiert.",
    "app.offlineCatalogue": "Gespeicherter Katalog unten. Wiedergabe benötigt eine Verbindung.",
    "settings.locale": "Sprache",
    "settings.localeSystem": "System übernehmen",
  },
  "pt-BR": {
    "nav.home": "Início",
    "nav.movies": "Filmes",
    "nav.tv": "Séries",
    "nav.anime": "Animes",
    "nav.manga": "Mangás",
    "nav.live": "TV ao vivo",
    "nav.mylist": "Minha lista",
    "nav.search": "Buscar",
    "nav.settings": "Configurações",
    "nav.download": "Baixar",
    "nav.openMenu": "Abrir navegação",
    "nav.closeMenu": "Fechar navegação",
    "nav.label": "Navegação principal",
    "nav.drawerLabel": "Menu de seções",
    "a11y.skipToContent": "Ir para o conteúdo",
    "a11y.loading": "Carregando…",
    "app.offlineBanner": "Você está offline — mostrando páginas salvas e sua biblioteca local.",
    "app.offlineRetry": "Tentar reconexão",
    "app.reconnected": "De volta on-line — sincronizando alterações enfileiradas.",
    "app.offlineCatalogue": "Catálogo salvo exibido abaixo. Reprodução exige conexão.",
    "settings.locale": "Idioma",
    "settings.localeSystem": "Igual ao sistema",
  },
  ar: {
    "nav.home": "الرئيسية",
    "nav.movies": "أفلام",
    "nav.tv": "مسلسلات",
    "nav.anime": "أنمي",
    "nav.manga": "مانغا",
    "nav.live": "بث مباشر",
    "nav.mylist": "قائمتي",
    "nav.search": "بحث",
    "nav.settings": "الإعدادات",
    "nav.download": "تحميل",
    "nav.openMenu": "فتح القائمة",
    "nav.closeMenu": "إغلاق القائمة",
    "nav.label": "التنقل الرئيسي",
    "nav.drawerLabel": "قائمة الأقسام",
    "a11y.skipToContent": "الانتقال إلى المحتوى",
    "a11y.loading": "جارٍ التحميل…",
    "app.offlineBanner": "أنت غير متصل — تُعرض الصفحات المحفوظة ومكتبتك المحلية.",
    "app.offlineRetry": "إعادة محاولة الاتصال",
    "app.reconnected": "تمت إعادة الاتصال — تتم مزامنة التغييرات المنتظرة.",
    "app.offlineCatalogue": "يُعرض الكتالوج المحفوظ أدناه. التشغيل يتطلب اتصالاً.",
    "settings.locale": "اللغة",
    "settings.localeSystem": "لغة النظام",
  },
  ja: {
    "nav.home": "ホーム",
    "nav.movies": "映画",
    "nav.tv": "TV番組",
    "nav.anime": "アニメ",
    "nav.manga": "漫画",
    "nav.live": "ライブTV",
    "nav.mylist": "マイリスト",
    "nav.search": "検索",
    "nav.settings": "設定",
    "nav.download": "ダウンロード",
    "nav.openMenu": "ナビゲーションを開く",
    "nav.closeMenu": "ナビゲーションを閉じる",
    "nav.label": "メインナビゲーション",
    "nav.drawerLabel": "セクションメニュー",
    "a11y.skipToContent": "本文へスキップ",
    "a11y.loading": "読み込み中…",
    "app.offlineBanner": "オフラインです — 保存済みページとローカルライブラリを表示しています。",
    "app.offlineRetry": "接続を再試行",
    "app.reconnected": "オンラインに戻りました — 待機中の変更を同期しています。",
    "app.offlineCatalogue": "保存済みカタログを表示中。再生には接続が必要です。",
    "settings.locale": "言語",
    "settings.localeSystem": "システムに合わせる",
  },
} as const satisfies Record<Exclude<LocaleCode, "system">, Record<string, string>>;

export type MessageKey = keyof typeof MESSAGES.en;

export const TRANSLATED_LOCALES = Object.keys(MESSAGES).filter(
  (key) => key !== "en",
) as Exclude<LocaleCode, "system" | "en">[];

/** Validation helper for settings persistence: value must be a dictionary id. */
export const isSupportedLocale = (value: unknown): value is Exclude<LocaleCode, "system"> =>
  typeof value === "string" && value in MESSAGES;

/** Locales rendered right-to-left when translated. */
const RTL_LANGS = new Set(["ar", "he", "fa", "ur"]);

export const isRtlLocale = (lang: string) => {
  const base = lang.toLowerCase().split(/[-_]/)[0];
  return RTL_LANGS.has(base);
};

/**
 * Pick the active locale. "system" resolves against the browser preferences
 * with an English fallback; a stored per-device choice always wins.
 */
export const resolveLocale = (
  preferred: string | undefined,
  candidates: readonly string[] = [],
): LocaleCode => {
  if (preferred && preferred !== "system" && preferred in MESSAGES) {
    return preferred as LocaleCode;
  }
  for (const candidate of candidates) {
    if (candidate in MESSAGES) {
      return candidate as LocaleCode;
    }
    const base = candidate.toLowerCase().split(/[-_]/)[0];
    const exact = Object.keys(MESSAGES).find((key) => key.toLowerCase() === base);
    if (exact) {
      return exact as LocaleCode;
    }
  }
  return "en";
};

export type Translate = {
  (key: MessageKey): string;
  (key: MessageKey, vars: Record<string, string | number>): string;
};

/**
 * Create a translator bound to a locale. Interpolation is `{name}` tokens —
 * translators control surrounding word order, so translated sentences can
 * rearrange or omit nothing. Missing keys fall back to English so a partial
 * locale never renders an empty label.
 */
export const createTranslator = (locale: LocaleCode): Translate => {
  const messages = (MESSAGES as Record<string, Record<MessageKey, string>>)[locale] ?? MESSAGES.en;
  return ((key: MessageKey, vars?: Record<string, string | number>) => {
    const template = messages[key] ?? MESSAGES.en[key] ?? key;
    if (!vars) {
      return template;
    }
    return template.replace(/\{(\w+)\}/g, (match: string, name: string) =>
      name in vars ? String(vars[name]) : match,
    );
  }) as Translate;
};

// ---------------------------------------------------------------------------
// Locale-aware formatting
// ---------------------------------------------------------------------------

const formatLocale = (locale: LocaleCode) => locale.replace(/[ _]/g, "-");

export const formatDate = (
  locale: LocaleCode,
  value: string | number | Date,
  options: Intl.DateTimeFormatOptions = { year: "numeric", month: "long", day: "numeric" },
) => {
  try {
    return new Intl.DateTimeFormat(formatLocale(locale), options).format(new Date(value));
  } catch {
    return String(value);
  }
};

export const formatTime = (
  locale: LocaleCode,
  value: string | number | Date,
  options: Intl.DateTimeFormatOptions = { hour: "numeric", minute: "2-digit" },
) => {
  try {
    return new Intl.DateTimeFormat(formatLocale(locale), options).format(new Date(value));
  } catch {
    return String(value);
  }
};

/** Compact ratings/views ("1.2K") that stay correct in every locale. */
export const formatCompact = (locale: LocaleCode, value: number) => {
  try {
    return new Intl.NumberFormat(formatLocale(locale), {
      notation: "compact",
      maximumFractionDigits: 1,
    }).format(value);
  } catch {
    return String(value);
  }
};

/** Relative "2h ago" style strings that are translateable when needed. */
export const formatRelative = (
  locale: LocaleCode,
  value: string | number | Date,
  now: string | number | Date = Date.now(),
) => {
  try {
    const relativeFormat = new Intl.RelativeTimeFormat(formatLocale(locale), { numeric: "auto" });
    const diffMs = new Date(value).getTime() - new Date(now).getTime();
    const units: Array<[Intl.RelativeTimeFormatUnit, number]> = [
      ["year", 31_536_000_000],
      ["month", 2_592_000_000],
      ["week", 604_800_000],
      ["day", 86_400_000],
      ["hour", 3_600_000],
      ["minute", 60_000],
    ];
    for (const [unit, ms] of units) {
      if (Math.abs(diffMs) >= ms) {
        return relativeFormat.format(Math.round(diffMs / ms), unit);
      }
    }
    return relativeFormat.format(Math.round(diffMs / 1000), "second");
  } catch {
    return String(value);
  }
};
