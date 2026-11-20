/**
 * Class strings saved in the database before the theme system (admin flyers,
 * announcement banners) still name raw Tailwind palette classes such as
 * "bg-gradient-to-r from-violet-600 to-indigo-600" or "text-yellow-300".
 * Those classes are no longer in the source, so Tailwind doesn't generate them.
 * `themeClasses()` rewrites them to the theme tokens at render time — the same
 * hue → role mapping the codebase migration used — so old content keeps its
 * colours and follows the user's theme. New content should store tokens.
 */

const HUE_ROLE: Record<string, string> = {
  lime: "primary", orange: "secondary", cyan: "accent",
  emerald: "success", green: "success", teal: "team",
  amber: "warning", yellow: "warning",
  red: "danger", rose: "danger",
  blue: "info", sky: "info", indigo: "info",
  violet: "individual", purple: "individual", pink: "individual", fuchsia: "individual",
};
const NEUTRAL = /^(slate|gray|zinc|neutral|stone)$/;

const CLASS_RE =
  /^((?:[\w-]+:)*)(bg|text|border|ring|from|via|to|fill|stroke|shadow|decoration)-(white|black|[a-z]+)(?:-(\d{2,3}))?(\/\d+)?$/;

function mapOne(cls: string): string {
  const m = cls.match(CLASS_RE);
  if (!m) return cls;
  const [, variants, util, hue, shadeStr, opacity = ""] = m;
  const shade = shadeStr ? Number(shadeStr) : null;
  const isText = util === "text" || util === "fill" || util === "stroke" || util === "decoration";

  if (hue === "white" || hue === "black" || NEUTRAL.test(hue)) {
    if (shadeStr == null && hue !== "white" && hue !== "black") return cls;
    const light = hue === "white" || (shade != null && shade <= 300);
    // On a flyer/banner fill, light ink becomes "on-accent"; dark ink and surfaces follow the theme.
    if (isText) return `${variants}${util}-${light ? "on-accent" : "foreground"}${opacity}`;
    if (util === "bg" || util === "from" || util === "via" || util === "to") {
      return `${variants}${util}-${light ? "card" : "background"}${opacity}`;
    }
    return `${variants}${util}-${light ? "foreground" : "border"}${opacity}`;
  }

  const role = HUE_ROLE[hue];
  if (!role || shade == null) return cls;
  if (isText) {
    // very light/dark shades of a hue were "ink on a coloured banner"
    return `${variants}${util}-${shade <= 200 || shade >= 800 ? "on-accent" : role}${opacity}`;
  }
  if (shade <= 200) return `${variants}${util}-${role}/15`;
  if (shade >= 800) return `${variants}${util}-${role}${opacity || "/40"}`;
  return `${variants}${util}-${role}${opacity}`;
}

/** Map any legacy palette classes in a stored class string to theme tokens. */
export function themeClasses(classString: string | null | undefined): string {
  if (!classString) return "";
  return classString.split(/\s+/).filter(Boolean).map(mapOne).join(" ");
}
