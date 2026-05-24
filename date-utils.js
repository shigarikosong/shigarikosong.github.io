(() => {
  function parseYmdToTime(raw) {
    const s = String(raw ?? "").trim();
    if (!s) return 0;

    // YYYY[/-.年]MM[/-.月]DD(可) 例: 2024/06/30, 2024-6-3, 2024.06.30, 2024年6月30日
    let m = s.match(/(\d{4})[\/\-.年](\d{1,2})[\/\-.月](\d{1,2})/);
    if (m) {
      const y = +m[1], mo = +m[2], d = +m[3];
      if (y && mo && d) return new Date(y, mo - 1, d).getTime();
    }

    // 年月だけ（公開月対策） 例: 2024/06, 2024-6, 2024年6月
    m = s.match(/(\d{4})[\/\-.年](\d{1,2})/);
    if (m) {
      const y = +m[1], mo = +m[2];
      if (y && mo) return new Date(y, mo - 1, 1).getTime(); // 日が無ければ1日で補完
    }

    // 最後の保険：Date.parse に賭ける（失敗なら 0）
    const t = Date.parse(s);
    return Number.isFinite(t) ? t : 0;
  }

  function getDateTagLabel(value) {
    return window.TAG_CONFIG.dateLabels[value] || value;
  }

  function getDateFilterMatch(selectedDateTag, videoTime, now) {
    if (!selectedDateTag) return true;

    const diffMonths = (now - videoTime) / (1000 * 60 * 60 * 24 * 30);

    return (
      (selectedDateTag === "recent" && diffMonths <= 3) ||
      (selectedDateTag === "year" && diffMonths <= 12) ||
      (selectedDateTag === "old" && diffMonths > 12)
    );
  }

  window.DATE_UTILS = Object.freeze({
    parseYmdToTime,
    getDateTagLabel,
    getDateFilterMatch
  });
})();
