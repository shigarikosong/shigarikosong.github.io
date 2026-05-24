(() => {
  const dateLabels = Object.freeze({
    recent: "最近",
    year: "1年以内",
    old: "1年以上前"
  });

  window.TAG_CONFIG = Object.freeze({
    categoryOrder: Object.freeze(["ソロ", "コラボ", "あやかき"]),
    formatOrder: Object.freeze(["3D", "Shorts", "歌枠", "ライブ", "Full", "ハイライト", "アカペラ", "企画", "比較"]),
    roleOrder: Object.freeze(["VOCAL", "DANCE", "CHORUS", "MOVIE", "ILLUSTRATION", "PIANO", "EUPHONIUM", "KALIMBA"]),
    dateLabels,
    dateLabelToValue: Object.freeze(
      Object.fromEntries(Object.entries(dateLabels).map(([value, label]) => [label, value]))
    ),
    platformValues: Object.freeze(["youtube", "tiktok"])
  });
})();
