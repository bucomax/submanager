/** next-themes init antes da hidratação — espelha `ThemeProvider` (attribute class, storageKey next-theme). */
(function applyStoredTheme(
  attribute,
  storageKey,
  defaultTheme,
  forcedTheme,
  themes,
  valueMap,
  enableSystem,
  enableColorScheme,
) {
  var root = document.documentElement;
  var colorSchemes = ["light", "dark"];

  function applyColorScheme(theme) {
    if (enableColorScheme && colorSchemes.indexOf(theme) !== -1) {
      root.style.colorScheme = theme;
    }
  }

  function applyTheme(theme) {
    var attributes = Array.isArray(attribute) ? attribute : [attribute];
    attributes.forEach(function (attr) {
      if (attr !== "class") {
        root.setAttribute(attr, theme);
        return;
      }
      var classNames = valueMap
        ? themes.map(function (name) {
            return valueMap[name] || name;
          })
        : themes;
      root.classList.remove.apply(root.classList, classNames);
      root.classList.add(valueMap && valueMap[theme] ? valueMap[theme] : theme);
    });
    applyColorScheme(theme);
  }

  function systemTheme() {
    return window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light";
  }

  if (forcedTheme) {
    applyTheme(forcedTheme);
    return;
  }

  try {
    var stored = localStorage.getItem(storageKey) || defaultTheme;
    applyTheme(enableSystem && stored === "system" ? systemTheme() : stored);
  } catch {
    /* localStorage indisponível (modo restrito): mantém o tema padrão do documento */
  }
})("class", "next-theme", "system", null, ["light", "dark"], null, true, true);
