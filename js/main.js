// ── 메인 페이지 로직 (방 만들기) ─────────────────────────────────
document.addEventListener('DOMContentLoaded', () => {

  // ── DOM 참조 ──────────────────────────────────────────────────
  const openModalBtn   = document.getElementById('open-modal-btn');
  const modalOverlay   = document.getElementById('modal-overlay');
  const modalCloseBtn  = document.getElementById('modal-close-btn');
  const modalCancelBtn = document.getElementById('modal-cancel-btn');
  const calendarEl     = document.getElementById('calendar');
  const rangeHint      = document.getElementById('range-hint');
  const rangeDisplay   = document.getElementById('range-display');
  const rangeFromLabel = document.getElementById('range-from-label');
  const rangeToLabel   = document.getElementById('range-to-label');
  const rangeNights    = document.getElementById('range-nights');
  const createBtn      = document.getElementById('create-btn');

  // ── 상태 ──────────────────────────────────────────────────────
  let pendingFrom = null;
  let pendingTo   = null;

  // ── 달력 (rangeMode) ─────────────────────────────────────────
  const calendar = new Calendar(calendarEl, {
    mode: 'range',
    onRangeChange(from, to) {
      pendingFrom = from;
      pendingTo   = to;
      updateUI(from, to);
    },
  });

  // ── 모달 열기 / 닫기 ──────────────────────────────────────────
  function openModal() {
    modalOverlay.classList.add('open');
    document.body.style.overflow = 'hidden';
    calendar.render('calendar');
    updateUI(pendingFrom, pendingTo);
  }

  function closeModal() {
    modalOverlay.classList.remove('open');
    document.body.style.overflow = '';
  }

  openModalBtn.addEventListener('click', openModal);
  modalCloseBtn.addEventListener('click', closeModal);
  modalCancelBtn.addEventListener('click', closeModal);

  modalOverlay.addEventListener('click', (e) => {
    if (e.target === modalOverlay) closeModal();
  });

  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && modalOverlay.classList.contains('open')) closeModal();
  });

  // ── UI 업데이트 ───────────────────────────────────────────────
  function updateUI(from, to) {
    if (!from) {
      rangeHint.textContent = '시작 날짜를 선택하세요';
      rangeDisplay.hidden   = true;
      createBtn.disabled    = true;
      return;
    }
    if (!to) {
      rangeHint.textContent = '종료 날짜를 선택하세요';
      rangeDisplay.hidden   = true;
      createBtn.disabled    = true;
      return;
    }

    rangeHint.textContent      = '날짜 범위가 선택됐어요 ✓';
    rangeFromLabel.textContent = formatDate(from);
    rangeToLabel.textContent   = formatDate(to);

    const diff = dateDiff(from, to);
    rangeNights.textContent = diff === 0 ? '당일' : `${diff}일 간`;

    rangeDisplay.hidden = false;
    createBtn.disabled  = false;
  }

  // ── 방 생성 (Supabase INSERT) ─────────────────────────────────
  createBtn.addEventListener('click', async () => {
    if (!pendingFrom || !pendingTo) return;

    createBtn.disabled = true;
    createBtn.innerHTML = '<span class="spinner"></span> 생성 중…';

    try {
      // rooms 테이블에 INSERT → Supabase가 UUID를 생성
      const { data, error } = await window.db
        .from('rooms')
        .insert({ date_from: pendingFrom, date_to: pendingTo })
        .select('id')
        .single();

      if (error) throw error;

      const roomId  = data.id;
      const voteUrl = `${location.origin}/vote.html#${roomId}`;

      // 클립보드 복사
      try {
        await navigator.clipboard.writeText(voteUrl);
      } catch {
        const ta = document.createElement('textarea');
        ta.value = voteUrl;
        ta.style.cssText = 'position:fixed;opacity:0;pointer-events:none';
        document.body.appendChild(ta);
        ta.select();
        try { document.execCommand('copy'); } catch { /* silent */ }
        document.body.removeChild(ta);
      }

      showToast('링크가 복사되었습니다! 🎉');
      closeModal();

      // 토스트가 잠깐 보인 후 이동
      setTimeout(() => {
        window.location.href = `vote.html#${roomId}`;
      }, 700);

    } catch (err) {
      console.error('[createRoom]', err);
      showToast('방 생성에 실패했습니다. 다시 시도해주세요.', 'error');
      createBtn.disabled = false;
      createBtn.textContent = '방 생성하기';
      updateUI(pendingFrom, pendingTo);
    }
  });

  // ── Helpers ───────────────────────────────────────────────────
  function formatDate(str) {
    const [y, m, d] = str.split('-').map(Number);
    const days = ['일','월','화','수','목','금','토'];
    return `${m}월 ${d}일(${days[new Date(y, m-1, d).getDay()]})`;
  }

  function dateDiff(from, to) {
    return Math.round((new Date(to) - new Date(from)) / 86400000);
  }
});
