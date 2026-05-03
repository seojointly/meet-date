// ── 투표 페이지 로직 (Supabase 연동) ─────────────────────────────
document.addEventListener('DOMContentLoaded', () => {

  // ─── 1. roomId 파싱 ─────────────────────────────────────────────
  const roomId = location.hash.slice(1);
  if (!roomId) { showError('유효하지 않은 링크예요.'); return; }

  // ─── 2. 앱 상태 ─────────────────────────────────────────────────
  let userName      = localStorage.getItem('voter_name') ?? '';
  let room          = null;   // { id, date_from, date_to, confirmed_date }
  let allVotes      = [];     // [{ user_name: string, dates: string[] }]
  let confirmedDate = null;
  let allowedDates  = null;   // Set<string>
  let calendar      = null;
  let pollTimer     = null;
  let rtChannel     = null;

  // ─── 3. DOM 참조 ────────────────────────────────────────────────
  const errorStateEl      = document.getElementById('error-state');
  const nameModalEl       = document.getElementById('name-modal-overlay');
  const nameInputEl       = document.getElementById('name-input');
  const nameErrorEl       = document.getElementById('name-error');
  const nameFormEl        = document.getElementById('name-form');
  const voteContentEl     = document.getElementById('vote-content');
  const calendarEl        = document.getElementById('calendar');
  const saveVoteBtnEl     = document.getElementById('save-vote-btn');
  const rankListEl        = document.getElementById('rank-list');
  const rankDescEl        = document.getElementById('rank-desc');
  const confirmedBannerEl = document.getElementById('confirmed-banner');
  const confirmedTextEl   = document.getElementById('confirmed-text');
  const cancelConfirmEl   = document.getElementById('cancel-confirm-btn');
  const myVoteBadgeEl     = document.getElementById('my-vote-badge');
  const voterDisplayEl    = document.getElementById('voter-name-display');
  const changeNameBtnEl   = document.getElementById('change-name-btn');
  const dateRangeEl       = document.getElementById('date-range-display');
  const tooltipEl         = document.getElementById('cal-tooltip');

  // ─── 4. 이름 모달 ───────────────────────────────────────────────
  if (userName) {
    initPage();
  } else {
    nameModalEl.classList.add('open');
    requestAnimationFrame(() => nameInputEl.focus());
  }

  nameFormEl.addEventListener('submit', (e) => {
    e.preventDefault();
    const name = nameInputEl.value.trim();
    if (!name) {
      nameErrorEl.style.display = 'block';
      nameInputEl.focus();
      return;
    }
    nameErrorEl.style.display = 'none';
    const isFirstTime = voteContentEl.hidden;
    userName = name;
    localStorage.setItem('voter_name', name);
    nameModalEl.classList.remove('open');

    if (isFirstTime) {
      initPage();
    } else {
      // 이름 변경: 해당 유저의 기존 선택 날짜로 달력 갱신
      const myVote  = allVotes.find(v => v.user_name === userName);
      const myDates = myVote ? new Set(myVote.dates) : new Set();
      calendar.setSelectedDates(myDates);
      applyHeatmap();
      updateSaveBtn();
      updateMyVoteBadge();
      updateVoterInfo();
      showToast(`${userName}으로 변경됐어요.`, 'info');
    }
  });

  nameInputEl.addEventListener('input', () => {
    if (nameInputEl.value.trim()) nameErrorEl.style.display = 'none';
  });

  changeNameBtnEl.addEventListener('click', () => {
    nameInputEl.value = userName;
    nameErrorEl.style.display = 'none';
    nameModalEl.classList.add('open');
    requestAnimationFrame(() => nameInputEl.focus());
  });

  // ─── 5. 페이지 초기화 ───────────────────────────────────────────
  async function initPage() {
    // 콘텐츠 영역을 먼저 노출 후 스켈레톤 표시
    voteContentEl.hidden = false;
    showCalendarSkeleton();
    showRankSkeleton();

    try {
      // ── room 조회
      const { data: roomData, error: roomErr } = await window.db
        .from('rooms')
        .select('*')
        .eq('id', roomId)
        .single();

      if (roomErr || !roomData) {
        voteContentEl.hidden = true;
        showError('존재하지 않는 방입니다.');
        return;
      }

      room          = roomData;
      confirmedDate = room.confirmed_date ?? null;
      allowedDates  = new Set(datesInRange(room.date_from, room.date_to));

      dateRangeEl.textContent =
        `${formatDateMedium(room.date_from)} ~ ${formatDateMedium(room.date_to)}`;

      // ── votes 조회
      await fetchVotes();

      // ── 달력 초기화 (multiMode)
      const myVote  = allVotes.find(v => v.user_name === userName);
      const myDates = myVote ? new Set(myVote.dates) : new Set();

      const [fromY, fromM] = room.date_from.split('-').map(Number);
      calendar = new Calendar(calendarEl, {
        mode:          'multi',
        year:          fromY,
        month:         fromM - 1,
        minDate:       room.date_from,  // 범위 시작일 이전은 비활성화
        allowedDates,
        selectedDates: myDates,
        onDateToggle() {
          updateSaveBtn();
          updateMyVoteBadge();
        },
      });

      // 히트맵 적용이 calendar.render()를 포함 → skeleton 교체
      applyHeatmap();
      renderRankList();
      updateConfirmedBanner();
      updateVoterInfo();
      setupTooltip();
      subscribeRealtime();

    } catch (err) {
      console.error('[initPage]', err);
      voteContentEl.hidden = true;
      showError('데이터를 불러오지 못했어요. 잠시 후 다시 시도해주세요.');
    }
  }

  // ─── 6. Supabase 데이터 조회 ────────────────────────────────────
  async function fetchVotes() {
    const { data, error } = await window.db
      .from('votes')
      .select('user_name, dates')
      .eq('room_id', roomId);
    if (error) throw error;
    allVotes = data ?? [];
  }

  async function refreshVotes() {
    try {
      await fetchVotes();
      applyHeatmap();
      renderRankList();
    } catch (err) {
      console.error('[refreshVotes]', err);
    }
  }

  // ─── 7. 히트맵 ──────────────────────────────────────────────────
  function applyHeatmap() {
    if (!calendar || !allowedDates) return;
    const countMap = buildCountMap();
    const heatObj  = {};
    countMap.forEach((n, d) => { heatObj[d] = Math.min(4, n); });
    calendar.highlightMap(heatObj); // 내부에서 calendar.render() 호출
  }

  function buildCountMap() {
    const map = new Map();
    allowedDates.forEach(d => map.set(d, 0));
    allVotes.forEach(v => {
      (v.dates ?? []).forEach(d => {
        if (map.has(d)) map.set(d, map.get(d) + 1);
      });
    });
    return map;
  }

  // ─── 8. 툴팁 (event delegation) ─────────────────────────────────
  function setupTooltip() {
    calendarEl.addEventListener('mouseover', (e) => {
      const day = e.target.closest('[data-date]');
      if (!day || day.classList.contains('empty') || day.classList.contains('disabled')) {
        tooltipEl.classList.remove('show'); return;
      }
      const date = day.dataset.date;
      if (!allowedDates?.has(date)) { tooltipEl.classList.remove('show'); return; }

      const voters = allVotes
        .filter(v => (v.dates ?? []).includes(date))
        .map(v => v.user_name);

      if (!voters.length) { tooltipEl.classList.remove('show'); return; }

      tooltipEl.textContent = voters.join(', ') + ' 가능';
      const rect = day.getBoundingClientRect();
      tooltipEl.style.left = (rect.left + rect.width / 2) + 'px';
      tooltipEl.style.top  = rect.top + 'px';
      tooltipEl.classList.add('show');
    });

    calendarEl.addEventListener('mouseout', (e) => {
      if (!calendarEl.contains(e.relatedTarget)) tooltipEl.classList.remove('show');
    });

    window.addEventListener('scroll', () => tooltipEl.classList.remove('show'), { passive: true });
  }

  // ─── 9. 투표 저장 (Supabase UPSERT) ────────────────────────────
  saveVoteBtnEl.addEventListener('click', async () => {
    const dates = [...calendar.getSelectedDates()].sort();
    if (!dates.length) return;

    setBtnLoading(saveVoteBtnEl, true, '저장 중…');

    try {
      const { error } = await window.db
        .from('votes')
        .upsert(
          { room_id: roomId, user_name: userName, dates },
          { onConflict: 'room_id,user_name' }
        );
      if (error) throw error;

      await refreshVotes();
      showToast(`${userName}님의 투표가 저장됐어요!`, 'success');
    } catch (err) {
      console.error('[saveVote]', err);
      showToast('저장에 실패했어요. 다시 시도해주세요.', 'error');
    } finally {
      setBtnLoading(saveVoteBtnEl, false, '투표 저장');
      updateSaveBtn();
    }
  });

  // ─── 10. 순위 리스트 ─────────────────────────────────────────────
  function renderRankList() {
    const countMap = buildCountMap();
    const total    = allVotes.length;

    if (total === 0) {
      rankDescEl.textContent = '아직 투표한 사람이 없어요.';
      rankListEl.innerHTML   = '';
      return;
    }

    rankDescEl.textContent = `${total}명이 참여했어요.`;

    const ranked = [...countMap.entries()]
      .filter(([, n]) => n > 0)
      .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]));

    if (!ranked.length) {
      rankListEl.innerHTML = '<p class="rank-empty">선택된 날짜가 없어요.</p>';
      return;
    }

    rankListEl.innerHTML = '';
    let rank = 1;

    ranked.forEach(([date, count], i) => {
      if (i > 0 && count < ranked[i - 1][1]) rank = i + 1;

      const voters      = allVotes.filter(v => (v.dates ?? []).includes(date)).map(v => v.user_name);
      const isConfirmed = date === confirmedDate;
      const badgeHTML   = rank <= 3
        ? ['🥇', '🥈', '🥉'][rank - 1]
        : `<span class="num">${rank}</span>`;

      const item = document.createElement('div');
      item.className = `rank-item${isConfirmed ? ' is-confirmed' : ''}`;
      item.innerHTML = `
        <span class="rank-badge">${badgeHTML}</span>
        <div class="rank-info">
          <div class="rank-date">${formatDateLong(date)}</div>
          <div class="rank-names">${escHtml(voters.join(', '))}</div>
        </div>
        <div class="rank-right">
          <span class="rank-count">${count}/${total}명</span>
          ${isConfirmed
            ? `<span class="confirmed-chip">✅ 확정</span>`
            : `<button class="btn btn-sm btn-outline confirm-btn" data-date="${escAttr(date)}">이 날로 확정</button>`
          }
        </div>
      `;

      if (!isConfirmed) {
        item.querySelector('.confirm-btn').addEventListener('click', () => confirmDate(date));
      }
      rankListEl.appendChild(item);
    });
  }

  // ─── 11. 날짜 확정 (Supabase UPDATE) ────────────────────────────
  async function confirmDate(date) {
    try {
      const { error } = await window.db
        .from('rooms')
        .update({ confirmed_date: date })
        .eq('id', roomId);
      if (error) throw error;

      confirmedDate = date;
      updateConfirmedBanner();
      renderRankList();
      showToast(`${formatDateLong(date)}로 확정됐어요! 🎉`, 'success');
    } catch (err) {
      console.error('[confirmDate]', err);
      showToast('확정에 실패했어요. 다시 시도해주세요.', 'error');
    }
  }

  cancelConfirmEl.addEventListener('click', async () => {
    try {
      const { error } = await window.db
        .from('rooms')
        .update({ confirmed_date: null })
        .eq('id', roomId);
      if (error) throw error;

      confirmedDate = null;
      updateConfirmedBanner();
      renderRankList();
      showToast('확정이 취소됐어요.', 'info');
    } catch (err) {
      console.error('[cancelConfirm]', err);
      showToast('취소에 실패했어요. 다시 시도해주세요.', 'error');
    }
  });

  function updateConfirmedBanner() {
    if (confirmedDate && allowedDates?.has(confirmedDate)) {
      confirmedTextEl.textContent = `${formatDateLong(confirmedDate)}로 확정되었습니다!`;
      confirmedBannerEl.hidden    = false;
    } else {
      confirmedBannerEl.hidden = true;
    }
  }

  // ─── 12. Supabase Realtime 구독 ──────────────────────────────────
  function subscribeRealtime() {
    rtChannel = window.db
      .channel(`room-${roomId}-votes`)
      .on(
        'postgres_changes',
        {
          event:  '*',           // INSERT / UPDATE / DELETE
          schema: 'public',
          table:  'votes',
          filter: `room_id=eq.${roomId}`,
        },
        () => { refreshVotes(); }
      )
      .subscribe((status) => {
        if (status === 'SUBSCRIBED') {
          stopPolling(); // Realtime 정상 연결 → 폴링 불필요
        } else if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT') {
          startPolling(); // 연결 실패 → 5초 폴링으로 fallback
        }
      });
  }

  // ─── 13. 폴링 fallback ──────────────────────────────────────────
  function startPolling() {
    if (pollTimer) return;
    console.info('[vote] Realtime unavailable → polling every 5s');
    pollTimer = setInterval(refreshVotes, 5000);
  }

  function stopPolling() {
    if (!pollTimer) return;
    clearInterval(pollTimer);
    pollTimer = null;
  }

  // 페이지 이탈 시 정리
  window.addEventListener('pagehide', () => {
    stopPolling();
    if (rtChannel) window.db.removeChannel(rtChannel);
  });

  // ─── 14. 스켈레톤 로더 ──────────────────────────────────────────
  function showCalendarSkeleton() {
    calendarEl.innerHTML = `
      <div class="skeleton-nav">
        <div class="skeleton" style="width:32px;height:32px;border-radius:var(--radius-md)"></div>
        <div class="skeleton" style="width:90px;height:20px;border-radius:4px"></div>
        <div class="skeleton" style="width:32px;height:32px;border-radius:var(--radius-md)"></div>
      </div>
      <div class="skeleton-cal-grid">
        ${Array(7).fill('<div class="skeleton skeleton-cal-hdr"></div>').join('')}
        ${Array(35).fill('<div class="skeleton skeleton-cal-cell"></div>').join('')}
      </div>
    `;
  }

  function showRankSkeleton() {
    rankListEl.innerHTML =
      Array(3).fill('<div class="skeleton skeleton-rank-row"></div>').join('');
  }

  // ─── 15. UI 보조 ────────────────────────────────────────────────
  function updateSaveBtn() {
    saveVoteBtnEl.disabled = !calendar || calendar.getSelectedDates().size === 0;
  }

  function updateMyVoteBadge() {
    const n = calendar ? calendar.getSelectedDates().size : 0;
    myVoteBadgeEl.textContent = `${n}개 선택`;
  }

  function updateVoterInfo() {
    voterDisplayEl.textContent = `투표자: ${userName}`;
  }

  function setBtnLoading(btn, loading, label) {
    btn.disabled = loading;
    btn.innerHTML = loading ? `<span class="spinner"></span> ${label}` : label;
  }

  function showError(msg) {
    const msgEl = errorStateEl.querySelector('p');
    if (msgEl) msgEl.textContent = msg;
    errorStateEl.hidden = false;
  }

  // ─── Helpers ────────────────────────────────────────────────────
  function datesInRange(from, to) {
    const result = [];
    const cur = new Date(from + 'T00:00:00');
    const end = new Date(to   + 'T00:00:00');
    while (cur <= end) {
      result.push(toDateStr(cur));
      cur.setDate(cur.getDate() + 1);
    }
    return result;
  }

  function toDateStr(d) {
    return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
  }

  function formatDateLong(str) {
    const [y, m, d] = str.split('-').map(Number);
    const days = ['일','월','화','수','목','금','토'];
    return `${m}월 ${d}일 ${days[new Date(y, m-1, d).getDay()]}요일`;
  }

  function formatDateMedium(str) {
    const [, m, d] = str.split('-').map(Number);
    return `${m}월 ${d}일`;
  }

  function escHtml(s) {
    return s.replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
  }
  function escAttr(s) { return escHtml(s); }
});
