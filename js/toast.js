// ── Toast 알림 컴포넌트 ─────────────────────────────────────────
(function () {
  // 컨테이너가 없으면 body에 주입
  function getContainer() {
    let el = document.getElementById('toast-container');
    if (!el) {
      el = document.createElement('div');
      el.id = 'toast-container';
      el.className = 'toast-container';
      document.body.appendChild(el);
    }
    return el;
  }

  const ICONS = {
    success: '✓',
    error:   '✕',
    info:    'ℹ',
  };

  /**
   * showToast(message, type)
   * @param {string} message  - 표시할 메시지
   * @param {'success'|'error'|'info'} type - 알림 종류 (기본: 'success')
   */
  function showToast(message, type = 'success') {
    const container = getContainer();

    const toast = document.createElement('div');
    toast.className = `toast toast-${type}`;
    toast.innerHTML = `
      <span class="toast-icon">${ICONS[type] ?? ICONS.info}</span>
      <span class="toast-message">${message}</span>
    `;

    container.appendChild(toast);

    // fade-in (다음 프레임에서 class 추가)
    requestAnimationFrame(() => {
      requestAnimationFrame(() => toast.classList.add('show'));
    });

    // 2.5초 후 fade-out → DOM 제거
    const DURATION   = 2500;
    const TRANSITION = 300;

    setTimeout(() => {
      toast.classList.remove('show');
      toast.classList.add('hide');
      setTimeout(() => toast.remove(), TRANSITION);
    }, DURATION);
  }

  // 전역으로 노출
  window.showToast = showToast;
})();
