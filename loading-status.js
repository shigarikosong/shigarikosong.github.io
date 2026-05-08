(() => {
  const videoList = document.getElementById('videoList');
  if (!videoList || !window.fetch) return;

  const errorMessage = '動画リストを読み込めませんでした。\n時間をおいて再読み込みしてください。';

  const style = document.createElement('style');
  style.textContent = `
    .loading-status {
      margin: 20px 0;
      padding: 18px 20px;
      border: 1px solid #bfdbfe;
      border-radius: 14px;
      background: #eff6ff;
      color: #1e40af;
      font-size: 14px;
      font-weight: 700;
      text-align: center;
      white-space: pre-line;
    }

    .loading-status.is-error {
      border-color: #fecaca;
      background: #fef2f2;
      color: #b91c1c;
    }
  `;
  document.head.appendChild(style);

  let status = null;

  function setStatus(message, isError = false, force = false) {
    if (!status || !videoList.contains(status)) {
      if (!force) return;

      status = document.createElement('div');
      status.id = 'loadingStatus';
      status.className = 'loading-status';
      videoList.innerHTML = '';
      videoList.appendChild(status);
    }

    status.textContent = message;
    status.classList.toggle('is-error', isError);
    status.setAttribute('role', isError ? 'alert' : 'status');
    status.setAttribute('aria-live', 'polite');
  }

  function isVideoListRequest(input) {
    const url = String(input?.url || input || '');
    return url.includes('シート1') || url.includes('%E3%82%B7%E3%83%BC%E3%83%881');
  }

  function validateVideoListData(data) {
    if (!Array.isArray(data) || data.length === 0) {
      throw new Error('動画リストのデータが空です');
    }

    if (data.some(video => !video || !video.title || !video.videoId)) {
      throw new Error('動画リストに必要な項目が見つかりません');
    }
  }

  const originalFetch = window.fetch.bind(window);
  setStatus('動画リストを読み込んでいます...', false, true);

  window.fetch = (input, init) => {
    const shouldWatch = isVideoListRequest(input);

    if (shouldWatch) {
      setStatus('動画リストを読み込んでいます...', false, true);
    }

    return originalFetch(input, init)
      .then(response => {
        if (!shouldWatch) return response;

        if (!response.ok) {
          setStatus(errorMessage, true, true);
          return response;
        }

        return new Proxy(response, {
          get(target, prop) {
            if (prop === 'json') {
              return () => target.json()
                .then(data => {
                  validateVideoListData(data);
                  setStatus(`${data.length}件の動画を準備しています...`);

                  requestAnimationFrame(() => {
                    setStatus('リストを表示しています...');
                  });

                  return data;
                })
                .catch(error => {
                  console.error(error);
                  setStatus(errorMessage, true, true);
                  throw error;
                });
            }

            const value = target[prop];
            return typeof value === 'function' ? value.bind(target) : value;
          }
        });
      })
      .catch(error => {
        if (shouldWatch) {
          console.error(error);
          setStatus(errorMessage, true, true);
        }
        throw error;
      });
  };
})();
