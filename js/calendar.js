// ── Calendar 컴포넌트 ─────────────────────────────────────────────
// 모드 A: mode='range'  — 범위 선택 (메인 페이지)
//   options.onRangeChange(from, to)  — 매 클릭마다 호출 (to=null이면 start만 선택된 상태)
//
// 모드 B: mode='multi'  — 다중 토글 선택 (투표 페이지)
//   options.onDateToggle(Set<string>) — 토글 시 호출
//   cal.highlightMap({ 'YYYY-MM-DD': count }) — 히트맵 색상 적용
//
// 공통
//   cal.render()  또는  cal.render('containerId')
//   최대 탐색 연도: 2027

class Calendar {
  constructor(containerOrId, options = {}) {
    this._resolveContainer(containerOrId);

    this.mode    = options.mode    ?? 'range';
    this.minDate = options.minDate ?? this._toStr(new Date());
    this.maxYear = 2027;

    // ── Range 상태
    this._rangeFrom  = null;
    this._rangeTo    = null;
    this._hoverDate  = null;

    // ── Multi 상태
    this.selectedDates = options.selectedDates instanceof Set
      ? options.selectedDates
      : new Set(options.selectedDates ?? []);

    // ── Heatmap (highlightMap 호출로 설정)
    this._heatMap = new Map();

    // ── Legacy (vote.js 호환)
    this.votableDates = options.votableDates instanceof Map
      ? options.votableDates
      : new Map(Object.entries(options.votableDates ?? {}));
    this.maxVotes  = options.maxVotes  ?? 0;
    this.onSelect  = options.onSelect  ?? null;

    // ── 선택 허용 날짜 (multi 모드: 이 Set 밖 날짜는 비활성화)
    this.allowedDates = options.allowedDates
      ? (options.allowedDates instanceof Set ? options.allowedDates : new Set(options.allowedDates))
      : null;

    // ── Callbacks
    this.onRangeChange = options.onRangeChange ?? null;
    this.onDateToggle  = options.onDateToggle  ?? null;

    // ── 현재 표시 월
    const now    = new Date();
    this.year    = options.year  ?? now.getFullYear();
    this.month   = options.month ?? now.getMonth();   // 0-indexed
    this._today  = this._toStr(now);
  }

  // ─── Public API ───────────────────────────────────────────────

  /** render() 또는 render('calendar') 로 호출 가능 */
  render(containerIdOrEl) {
    if (containerIdOrEl !== undefined) this._resolveContainer(containerIdOrEl);
    if (!this.container) return;

    this.container.innerHTML = '';
    this.container.className = 'calendar-wrapper';
    this.container.appendChild(this._buildNav());
    this.container.appendChild(this._buildGrid());
  }

  /** 히트맵 적용 — { 'YYYY-MM-DD': 투표수(0~4+) }
   *  0=흰색, 1=#bbf7d0, 2=#4ade80, 3=#16a34a, 4=#14532d */
  highlightMap(map) {
    this._heatMap = map instanceof Map
      ? map
      : new Map(Object.entries(map).map(([k, v]) => [k, Number(v)]));
    this.render();
  }

  /** 현재 선택 범위 반환 */
  getRange() {
    return { from: this._rangeFrom, to: this._rangeTo };
  }

  /** 범위 완성 여부 */
  hasRange() {
    return !!(this._rangeFrom && this._rangeTo);
  }

  /** multi 모드: 선택 날짜 Set 반환 */
  getSelectedDates() {
    return new Set(this.selectedDates);
  }

  setSelectedDates(dates) {
    this.selectedDates = dates instanceof Set ? dates : new Set(dates);
    this.render();
  }

  // legacy
  setVotableDates(map) {
    this.votableDates = map instanceof Map ? map : new Map(Object.entries(map));
    this._recalcMax();
    this.render();
  }

  // ─── Internal ─────────────────────────────────────────────────

  _resolveContainer(c) {
    if (!c) return;
    this.container = typeof c === 'string'
      ? (document.getElementById(c) ?? document.querySelector(c))
      : c;
  }

  _buildNav() {
    const nav = document.createElement('div');
    nav.className = 'calendar-nav';

    const prevBtn = this._makeNavBtn('‹', '이전 달', () => this._prevMonth());
    const nextBtn = this._makeNavBtn('›', '다음 달', () => this._nextMonth());

    // 이전 달 제한: minDate 월 이하
    const minD = new Date(this.minDate);
    if (this.year < minD.getFullYear() ||
        (this.year === minD.getFullYear() && this.month <= minD.getMonth())) {
      prevBtn.disabled = true;
    }

    // 다음 달 제한: maxYear 12월
    if (this.year >= this.maxYear && this.month === 11) {
      nextBtn.disabled = true;
    }

    const label = document.createElement('span');
    label.className = 'month-label';
    label.textContent = `${this.year}년 ${this.month + 1}월`;

    nav.append(prevBtn, label, nextBtn);
    return nav;
  }

  _makeNavBtn(text, label, onClick) {
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'btn btn-ghost btn-sm';
    btn.textContent = text;
    btn.setAttribute('aria-label', label);
    btn.addEventListener('click', onClick);
    return btn;
  }

  _buildGrid() {
    const grid = document.createElement('div');
    grid.className = 'calendar-grid';

    // 요일 헤더
    ['일','월','화','수','목','금','토'].forEach((h, i) => {
      const el = document.createElement('div');
      el.className = 'calendar-day-header';
      if (i === 0) el.style.color = '#ef4444';
      if (i === 6) el.style.color = '#3b82f6';
      el.textContent = h;
      grid.appendChild(el);
    });

    const firstDow    = new Date(this.year, this.month, 1).getDay();
    const daysInMonth = new Date(this.year, this.month + 1, 0).getDate();

    for (let i = 0; i < firstDow; i++) {
      const empty = document.createElement('div');
      empty.className = 'calendar-day empty';
      grid.appendChild(empty);
    }

    for (let d = 1; d <= daysInMonth; d++) {
      grid.appendChild(this._buildDay(d));
    }

    return grid;
  }

  _buildDay(d) {
    const dateStr = `${this.year}-${String(this.month + 1).padStart(2,'0')}-${String(d).padStart(2,'0')}`;
    const dow     = new Date(this.year, this.month, d).getDay();
    const isPast  = dateStr < this.minDate;

    const el = document.createElement('div');
    el.className = 'calendar-day';
    el.textContent = d;
    el.dataset.date = dateStr;

    if (dow === 0) el.classList.add('sun');
    if (dow === 6) el.classList.add('sat');
    if (dateStr === this._today) el.classList.add('today');

    // ── range 모드
    if (this.mode === 'range') {
      if (isPast) {
        el.classList.add('disabled');
      } else {
        this._applyRangeClass(el, dateStr);
        el.addEventListener('click', () => this._handleRangeClick(dateStr));
        el.addEventListener('mouseenter', () => {
          if (this._rangeFrom && !this._rangeTo) {
            this._hoverDate = dateStr;
            this.render();
          }
        });
        el.addEventListener('mouseleave', () => {
          if (this._hoverDate) {
            this._hoverDate = null;
            this.render();
          }
        });
      }
    }

    // ── multi 모드
    if (this.mode === 'multi') {
      const heat = this._heatMap.has(dateStr) ? Math.min(4, this._heatMap.get(dateStr)) : -1;
      if (heat >= 0) el.classList.add(`heat-${heat}`);
      if (this.selectedDates.has(dateStr)) el.classList.add('selected');

      const isAllowed = !this.allowedDates || this.allowedDates.has(dateStr);
      if (!isAllowed || isPast) {
        el.classList.add('disabled');
        if (!isAllowed) el.classList.add('out-of-range');
      } else {
        el.addEventListener('click', () => this._handleMultiClick(dateStr, el));
      }
    }

    // ── legacy: select
    if (this.mode === 'select') {
      if (isPast) el.classList.add('disabled');
      else {
        if (this.selectedDates.has(dateStr)) el.classList.add('selected');
        el.addEventListener('click', () => this._toggleLegacy(dateStr, el));
      }
    }

    // ── legacy: heatmap
    if (this.mode === 'heatmap') {
      el.classList.add(`heat-${this._legacyHeatLevel(this.votableDates.get(dateStr) ?? 0)}`);
    }

    // ── legacy: vote
    if (this.mode === 'vote') {
      if (this.votableDates.has(dateStr)) {
        el.classList.add('votable');
        el.classList.add(`heat-${this._legacyHeatLevel(this.votableDates.get(dateStr) ?? 0)}`);
        if (this.selectedDates.has(dateStr)) el.classList.add('voted');
        el.addEventListener('click', () => this._toggleLegacy(dateStr, el));
      } else {
        el.classList.add('disabled');
      }
    }

    return el;
  }

  // ─── Range 로직 ───────────────────────────────────────────────

  _applyRangeClass(el, dateStr) {
    const { from, to } = { from: this._rangeFrom, to: this._rangeTo };
    const hover = this._hoverDate;

    if (!from) return;

    if (from && to) {
      // 완성된 범위
      const lo = from <= to ? from : to;
      const hi = from <= to ? to   : from;
      if (dateStr === lo)                    { el.classList.add('range-start'); return; }
      if (dateStr === hi)                    { el.classList.add('range-end');   return; }
      if (dateStr > lo && dateStr < hi)      { el.classList.add('range-in');    return; }
      return;
    }

    // 시작만 선택된 상태
    if (dateStr === from) {
      el.classList.add('range-start');
      return;
    }

    if (hover && hover !== from) {
      const lo = from <= hover ? from  : hover;
      const hi = from <= hover ? hover : from;
      if (dateStr === lo)               { el.classList.add('range-start');   return; }
      if (dateStr === hi)               { el.classList.add('range-preview'); return; }
      if (dateStr > lo && dateStr < hi) { el.classList.add('range-preview'); return; }
    }
  }

  _handleRangeClick(dateStr) {
    // 완성 후 재클릭 → 처음부터
    if (this._rangeFrom && this._rangeTo) {
      this._rangeFrom = dateStr;
      this._rangeTo   = null;
      this._hoverDate = null;
      this.render();
      this._emitRangeChange();
      return;
    }

    // 첫 번째 클릭
    if (!this._rangeFrom) {
      this._rangeFrom = dateStr;
      this._hoverDate = null;
      this.render();
      this._emitRangeChange();
      return;
    }

    // 같은 날짜 재클릭 → 초기화
    if (dateStr === this._rangeFrom) {
      this._rangeFrom = null;
      this._hoverDate = null;
      this.render();
      this._emitRangeChange();
      return;
    }

    // 두 번째 클릭 → 범위 완성
    const lo = this._rangeFrom <= dateStr ? this._rangeFrom : dateStr;
    const hi = this._rangeFrom <= dateStr ? dateStr : this._rangeFrom;
    this._rangeFrom = lo;
    this._rangeTo   = hi;
    this._hoverDate = null;
    this.render();
    this._emitRangeChange();
  }

  _emitRangeChange() {
    if (this.onRangeChange) this.onRangeChange(this._rangeFrom, this._rangeTo);
  }

  // ─── Multi 로직 ───────────────────────────────────────────────

  _handleMultiClick(dateStr, el) {
    if (this.selectedDates.has(dateStr)) {
      this.selectedDates.delete(dateStr);
      el.classList.remove('selected');
    } else {
      this.selectedDates.add(dateStr);
      el.classList.add('selected');
    }
    if (this.onDateToggle) this.onDateToggle(new Set(this.selectedDates));
  }

  // ─── Legacy ───────────────────────────────────────────────────

  _toggleLegacy(dateStr, el) {
    if (this.selectedDates.has(dateStr)) {
      this.selectedDates.delete(dateStr);
      el.classList.remove('selected', 'voted');
    } else {
      this.selectedDates.add(dateStr);
      el.classList.add(this.mode === 'vote' ? 'voted' : 'selected');
    }
    if (this.onSelect) this.onSelect(dateStr, new Set(this.selectedDates));
  }

  _legacyHeatLevel(count) {
    if (!count) return 0;
    const max   = this.maxVotes || 1;
    const ratio = count / max;
    if (ratio <= 0.25) return 1;
    if (ratio <= 0.5)  return 2;
    if (ratio <= 0.75) return 3;
    return 4;
  }

  _recalcMax() {
    this.maxVotes = this.votableDates.size
      ? Math.max(...this.votableDates.values())
      : 0;
  }

  // ─── Navigation ───────────────────────────────────────────────

  _prevMonth() {
    if (this.month === 0) { this.year--; this.month = 11; }
    else this.month--;
    this.render();
  }

  _nextMonth() {
    if (this.month === 11) { this.year++; this.month = 0; }
    else this.month++;
    this.render();
  }

  _toStr(date) {
    return `${date.getFullYear()}-${String(date.getMonth()+1).padStart(2,'0')}-${String(date.getDate()).padStart(2,'0')}`;
  }
}

window.Calendar = Calendar;
