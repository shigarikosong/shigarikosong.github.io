(() => {
  const dateLabels = Object.freeze({
    recent: "最近",
    year: "1年以内",
    old: "1年以上前"
  });
  const platformLabels = Object.freeze({
    youtube: "YouTube",
    tiktok: "TikTok"
  });

  function getPlatformLabel(value) {
    const normalized = String(value || "").trim().toLowerCase();
    return platformLabels[normalized] || value;
  }

  window.TAG_CONFIG = Object.freeze({
    categoryOrder: Object.freeze(["ソロ", "コラボ", "あやかき"]),
    formatOrder: Object.freeze(["3D", "Shorts", "歌枠", "ライブ", "Full", "ハイライト", "アカペラ", "企画", "比較", "イラスト"]),
    roleOrder: Object.freeze(["VOCAL", "DANCE", "CHORUS", "MOVIE", "ILLUSTRATION", "PIANO", "EUPHONIUM", "KALIMBA"]),
    dateLabels,
    dateLabelToValue: Object.freeze(
      Object.fromEntries(Object.entries(dateLabels).map(([value, label]) => [label, value]))
    ),
    platformValues: Object.freeze(["youtube", "tiktok"]),
    platformLabels,
    getPlatformLabel
  });
})();
