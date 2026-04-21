// === ADMIZER V1 UI 프로토타입 ===

const D = window.ADMIZER_DATA;

// --- 포맷터 ---
const fmt = {
  krw(n) {
    n = Math.round(n || 0);
    if (n >= 100000000) return (n / 100000000).toFixed(1) + '억';
    if (n >= 10000) return (n / 10000).toFixed(0) + '만원';
    return n.toLocaleString() + '원';
  },
  krwFull: n => (Math.round(n || 0)).toLocaleString() + '원',
  pct(v, digits = 1) { return ((v || 0) * 100).toFixed(digits) + '%'; },
  num: n => (Math.round(n || 0)).toLocaleString(),
  roas: v => Math.round((v || 0) * 100) + '%',
};

function chip(severity) {
  return `<span class="chip chip-${severity}">${
    severity === 'critical' ? '🔴 긴급' :
    severity === 'warning' ? '🟡 주의' :
    '🟢 정보'
  }</span>`;
}

function barMini(pctVal) {
  const w = Math.min(100, Math.max(0, (pctVal || 0) * 100));
  return `<span class="bar-mini"><span class="bar-mini-fill" style="width:${w}%"></span></span>`;
}

// --- KPI ---
function renderKPIs() {
  const t = D.all_total;
  const pt = D.product_totals;
  const totalRev = pt.revenue || 0;
  const adRev = t.revenue || 0;
  const adSpend = t.spend || 0;

  // 광고 매출 비중
  const adRevPct = totalRev ? (adRev / totalRev) * 100 : 0;

  // 데모 delta (전주 대비) — 실제 기간 비교 API 붙기 전 플레이스홀더
  const deltaDemo = { sales: +0.082, adRev: +0.121, profit: -0.034 };

  // 원가 미입력 상품 집계 (spec 01 B: "원가 미입력 (N개 상품)" + CTA)
  const missingCogs = D.products.filter(p => !p.cogs_input).length;
  const totalProducts = D.products.length || 1;
  const cogsMissingRatio = missingCogs / totalProducts;
  const profitBlocked = cogsMissingRatio > 0.3;   // 30% 이상 미입력이면 CTA 표시

  // 예산 소진률: 데모 가정치 (쿠팡 일예산 API 연동 전)
  const utilization = 72;
  let budgetState = 'normal', budgetLabel = '정상';
  if (utilization > 95) { budgetState = 'bad'; budgetLabel = '초과 주의'; }
  else if (utilization < 60) { budgetState = 'warn'; budgetLabel = '집행 저조'; }

  // spec 01 순이익 계산: 광고매출 − 광고비 − (광고매출 × (원가율 + 수수료율))
  // 원가 없을 때는 차단, 있을 때는 수수료 15% + 원가율 40% 가정
  const estProfit = profitBlocked ? null : (adRev - adSpend - (adRev * 0.55));

  const html = `
    <div class="kpi">
      <div class="kpi-label">전체 매출</div>
      <div class="kpi-value">${fmt.krw(totalRev)}</div>
      <div class="kpi-delta up">↑ ${(deltaDemo.sales*100).toFixed(1)}% <span class="neutral" style="font-weight:400;">vs 전주</span></div>
    </div>
    <div class="kpi">
      <div class="kpi-label">광고매출</div>
      <div class="kpi-value">${fmt.krw(adRev)} <span style="font-size:13px; color:var(--c-text-muted); font-weight:500;">(${adRevPct.toFixed(1)}%)</span></div>
      <div class="kpi-delta up">↑ ${(deltaDemo.adRev*100).toFixed(1)}% <span class="neutral" style="font-weight:400;">vs 전주</span></div>
    </div>
    ${profitBlocked ? `
      <div class="kpi">
        <div class="kpi-label">광고 순이익 <span class="kpi-tooltip" title="부가세·쿠폰·프로모션·배송비·반품은 미반영. 실제 정산액과 차이가 날 수 있습니다.">ⓘ</span></div>
        <div class="kpi-value" style="font-size:18px; color:var(--c-text-muted); font-weight:600;">원가 미입력</div>
        <div class="kpi-delta neutral" style="margin-bottom:8px;">${missingCogs}개 상품 · 순이익 계산 불가</div>
        <button class="btn btn-primary" style="width:100%; padding:6px 0; font-size:12px;" onclick="switchView('rules'); alert('화면 05 설정 · 원가 관리로 이동 (프로토타입)');">원가 입력 →</button>
      </div>
    ` : `
      <div class="kpi">
        <div class="kpi-label">광고 순이익 <span class="kpi-tooltip" title="부가세·쿠폰·프로모션·배송비·반품은 미반영. 실제 정산액과 차이가 날 수 있습니다.">ⓘ</span></div>
        <div class="kpi-value ${estProfit < 0 ? 'bad' : ''}">${fmt.krw(estProfit)}</div>
        <div class="kpi-delta ${deltaDemo.profit >= 0 ? 'up' : 'down'}">${deltaDemo.profit >= 0 ? '↑' : '↓'} ${Math.abs(deltaDemo.profit*100).toFixed(1)}% <span class="neutral" style="font-weight:400;">vs 전주</span></div>
      </div>
    `}
    <div class="kpi">
      <div class="kpi-label">예산 소진률 <span class="kpi-tooltip" title="쿠팡 일예산 API 연동 전 데모값. 70~95% 정상, >95% 경고, <60% 저조.">ⓘ</span></div>
      <div class="kpi-value">${utilization}% <span style="font-size:12px; color:var(--c-text-muted); font-weight:500;">${budgetLabel}</span></div>
      <div class="kpi-bar"><div class="kpi-bar-fill kpi-bar-${budgetState}" style="width:${utilization}%"></div></div>
      <div class="kpi-delta neutral" style="margin-top:6px;">광고비 ${fmt.krw(adSpend)} · ROAS ${fmt.roas(t.roas)}</div>
    </div>
  `;
  document.getElementById('kpi-strip').innerHTML = html;
}

// --- 인사이트 카드 ---
function renderInsights() {
  const top5 = D.insights.slice(0, 5);
  const mode = document.body.classList.contains('mode-pro') ? 'pro' : 'simple';

  const html = top5.map(i => `
    <div class="insight-card">
      <div class="insight-card-head">
        ${chip(i.severity)}
        <span class="chip chip-type">${i.name}</span>
      </div>
      <div class="insight-body">${i.detail}</div>
      <div class="insight-target pro-only">▸ ${escapeHtml(i.campaign_short)}</div>
      <div class="insight-actions">
        <button class="btn btn-sm btn-primary" onclick='showModal("${i.code}", ${JSON.stringify(i.campaign_short).replace(/"/g,'&quot;')})'>자동 추천 받기</button>
        <button class="btn-link pro-only" onclick='goCampaign(${i.campaign_id})'>상세 분석 →</button>
      </div>
    </div>
  `).join('');
  document.getElementById('insight-grid').innerHTML = html ||
    '<div style="padding:20px; color:var(--c-text-muted);">매칭된 인사이트가 없습니다.</div>';
  document.getElementById('insight-total-count').textContent = D.insights.length;

  // 전체 리스트는 renderFullInsights() 가 담당 (spec 04 4섹션 구조)
}

// --- 순위 그리드 (spec 01 D: 2×3 고정 6카드) ---
function rankCard({ title, icon, items, formatter, bad, emptyNote, filterKey }) {
  if (!items || items.length === 0) {
    return `<div class="rank-card">
      <div class="rank-head"><span class="rank-title">${title}</span><span class="rank-icon">${icon}</span></div>
      <div class="rank-empty">${emptyNote || '해당 조건 캠페인 없음'}</div>
    </div>`;
  }
  const lis = items.slice(0, 3).map((it, i) => `
    <li>
      <span style="color:var(--c-text-muted); width:14px; display:inline-block;">${i+1}.</span>
      <span class="rank-name" title="${escapeHtml(it.name)}">${escapeHtml(it.name)}</span>
      <span class="rank-value ${bad ? 'bad' : ''}">${formatter(it.val)}</span>
    </li>
  `).join('');
  const extra = Math.max(0, items.length - 3);
  return `
    <div class="rank-card">
      <div class="rank-head"><span class="rank-title">${title}</span><span class="rank-icon">${icon}</span></div>
      <ul class="rank-list">${lis}</ul>
      <div class="rank-more">
        ${extra ? `<span class="pro-only" style="color:var(--c-text-muted); margin-right:8px;">외 ${extra}개</span>` : ''}
        <a onclick="goCampaign(${items[0].id})">상세보기 →</a>
      </div>
    </div>
  `;
}

function placeholderCard({ title, icon, hint, note, external }) {
  return `
    <div class="rank-card" style="border:1px dashed var(--c-border); background:#FCFDFE;">
      <div class="rank-head"><span class="rank-title" style="color:var(--c-text-muted);">${title}</span><span class="rank-icon">${icon}</span></div>
      <div style="padding:18px 0; text-align:center;">
        <div style="font-size:12px; color:var(--c-text-muted); margin-bottom:4px;">${hint}</div>
        <div style="font-size:11px; color:var(--c-text-muted); opacity:0.7;">${note}</div>
      </div>
      <div class="rank-more"><span style="color:var(--c-text-muted); font-size:11px;">${external ? '쿠팡 WING ↗' : 'V1 연동 예정'}</span></div>
    </div>
  `;
}

function renderRankings() {
  const r = D.rankings;
  // spec 01 D: 6개 고정 카드 (2행 × 3열)
  const html = [
    rankCard({ title: '검색영역 ROAS 탑3',  icon: '🔍', items: r.search_roas_top,    formatter: fmt.roas }),
    rankCard({ title: '비검색 ROAS 탑3',    icon: '📢', items: r.nonsearch_roas_top, formatter: fmt.roas }),
    placeholderCard({ title: '예산 부족',      icon: '⚠',  hint: '일예산 소진률 95% 이상', note: '쿠팡 일예산 API 연동 예정' }),
    placeholderCard({ title: '아이템위너 OFF', icon: '🏆', hint: '위너 이탈로 광고 OFF',   note: '아이템위너 상태 API 연동 예정' }),
    placeholderCard({ title: '재고 없음 OFF',  icon: '📦', hint: '재고 0 · 광고 OFF',      note: '쿠팡 WING 재고 연동 예정', external: true }),
    rankCard({ title: '광고수익율 관리',    icon: '📉', items: r.low_roas,           formatter: fmt.roas, bad: true, emptyNote: '저ROAS 캠페인 없음' }),
  ].join('');
  document.getElementById('rank-grid').innerHTML = html;
}

// --- 캠페인 리스트 ---
function renderCampaigns() {
  const rows = D.campaigns.map(c => {
    const t = c.total;
    const type = c.type && c.type.indexOf('매출') >= 0 ? '매최' : '수동';
    const roasClass = t.roas < 2 ? 'bad' : t.roas > 4 ? 'good' : '';
    const acos = t.revenue > 0 ? (t.spend / t.revenue) : 0;   // ACOS = spend/revenue
    return `
      <tr data-cid="${c.id}">
        <td><input type="checkbox" onclick="event.stopPropagation()"></td>
        <td class="camp-name"><span class="status-dot"></span>${escapeHtml(c.short_name || '-')}</td>
        <td><span class="chip chip-type">${type}</span></td>
        <td class="num">${fmt.krw(t.revenue)}</td>
        <td class="num">${fmt.krw(t.spend)}</td>
        <td class="num ${roasClass}">${fmt.roas(t.roas)}</td>
        <td class="num">${fmt.pct(t.cvr, 2)}</td>
        <td class="num pro-only">${fmt.num(t.cpc)}원</td>
        <td class="num pro-only">${fmt.num(t.impressions)}</td>
        <td class="num pro-only">${fmt.pct(t.ctr, 2)}</td>
        <td class="num pro-only">${fmt.pct(acos, 1)}</td>
        <td class="num pro-only">${fmt.num(t.qty)}</td>
      </tr>
    `;
  }).join('');
  document.getElementById('camp-tbody').innerHTML = rows;

  document.querySelectorAll('#camp-tbody tr').forEach(tr => {
    tr.addEventListener('click', () => {
      document.querySelectorAll('#camp-tbody tr').forEach(r => r.classList.remove('selected'));
      tr.classList.add('selected');
      diagnose(parseInt(tr.dataset.cid));
    });
  });

  document.getElementById('tab-diagnose-count').textContent = D.insights.filter(i => i.severity !== 'info').length;
}

// --- 진단 패널 ---
function diagnose(cid) {
  const c = D.campaigns.find(x => x.id === cid);
  if (!c) return;
  const t = c.total;
  const search = c.areas['검색'] || {};
  const nonsearch = c.areas['비검색'] || {};

  // 매칭된 인사이트
  const matched = D.insights.filter(i => i.campaign_id === cid);

  // 액션 플랜 4카드 (기본 진단) - PPT 슬라이드 6 구조
  const lowRoasKW = c.keywords.filter(k => k.spend > 0 && k.roas < 2.0).length;
  const lowCvrKW = c.keywords.filter(k => k.clicks > 10 && k.cvr < 0.02).length;
  const highCpcKW = c.keywords.filter(k => k.cpc > 1000).length;
  const lowCtrKW = c.keywords.filter(k => k.impressions > 100 && k.ctr < 0.005).length;

  // 상위 키워드 (클릭 많은 순)
  const topKeywords = c.keywords.slice(0, 10);

  const html = `
    <div class="diagnose-head">
      <h3>${escapeHtml(c.short_name || '')} <span class="chip chip-type" style="margin-left:6px;">${c.type || ''}</span></h3>
      <div class="diagnose-meta">캠페인 ID ${c.id} · 시작일 ${c.start_date} · 상품: ${escapeHtml((c.product || '').slice(0,50))}</div>
      <div class="diagnose-meta" style="margin-top:4px;">비노출 시간: <span style="color:var(--c-text);">02:00~06:30, 14:00~18:00</span> <span class="pro-only" style="color:var(--c-text-muted);">· 목표 ROAS ${fmt.roas(t.roas * 0.95)} · 일예산 ₩${Math.round(t.spend/30).toLocaleString()}</span></div>
    </div>

    ${matched.length > 0 ? `
      <div style="margin-bottom:14px;">
        <strong style="font-size:13px;">매칭된 인사이트 ${matched.length}건</strong>
        <div style="display:flex; gap:6px; flex-wrap:wrap; margin-top:6px;">
          ${matched.map(m => `${chip(m.severity)} <span class="chip chip-type">${m.name}</span>`).join(' ')}
        </div>
      </div>
    ` : ''}

    <table class="area-table">
      <thead>
        <tr>
          <th>영역</th>
          <th>매출</th><th>판매량</th><th>ROAS</th>
          <th>노출수</th><th>클릭률</th><th>전환율</th>
          <th>CPC</th><th>광고비</th>
        </tr>
      </thead>
      <tbody>
        <tr>
          <td>비검색</td>
          <td>${fmt.krw(nonsearch.revenue)}</td>
          <td>${fmt.num(nonsearch.qty)}</td>
          <td>${fmt.roas(nonsearch.roas)}</td>
          <td>${fmt.num(nonsearch.impressions)}</td>
          <td>${fmt.pct(nonsearch.ctr, 2)}</td>
          <td>${fmt.pct(nonsearch.cvr, 2)}</td>
          <td>${fmt.num(nonsearch.cpc)}원</td>
          <td>${fmt.krw(nonsearch.spend)}</td>
        </tr>
        <tr>
          <td>검색</td>
          <td>${fmt.krw(search.revenue)}</td>
          <td>${fmt.num(search.qty)}</td>
          <td>${fmt.roas(search.roas)}</td>
          <td>${fmt.num(search.impressions)}</td>
          <td>${fmt.pct(search.ctr, 2)}</td>
          <td>${fmt.pct(search.cvr, 2)}</td>
          <td>${fmt.num(search.cpc)}원</td>
          <td>${fmt.krw(search.spend)}</td>
        </tr>
        <tr style="font-weight:700; background:#F7FAFC;">
          <td>전체</td>
          <td>${fmt.krw(t.revenue)}</td>
          <td>${fmt.num(t.qty)}</td>
          <td>${fmt.roas(t.roas)}</td>
          <td>${fmt.num(t.impressions)}</td>
          <td>${fmt.pct(t.ctr, 2)}</td>
          <td>${fmt.pct(t.cvr, 2)}</td>
          <td>${fmt.num(t.cpc)}원</td>
          <td>${fmt.krw(t.spend)}</td>
        </tr>
      </tbody>
    </table>

    <div class="summary">
      ${summaryText(c, t, search, nonsearch)}
    </div>

    <!-- 액션 플랜 4카드 -->
    <div class="action-cards">
      ${actionCard('ROAS < 200%', lowRoasKW, 'roas-low')}
      ${actionCard('전환율 < 2%', lowCvrKW, 'cvr-low')}
      ${actionCard('CPC > 1,000원', highCpcKW, 'cpc-high')}
      ${actionCard('클릭률 < 0.5%', lowCtrKW, 'ctr-low')}
    </div>

    <div style="display:flex; gap:8px; margin-top:16px; padding-top:16px; border-top:1px solid var(--c-border);">
      <button class="btn" onclick="showModal('TARGET_ROAS', '${escapeHtml(c.short_name)}')">목표 ROAS 조정</button>
      <button class="btn" onclick="showModal('BUDGET', '${escapeHtml(c.short_name)}')">예산 설정</button>
      <button class="btn pro-only" onclick="alert('세부 조율 UI (수동광고 CPC 개별 편집 등)')">세부 조율</button>
    </div>

    ${topKeywords.length > 0 ? `
      <div style="margin-top:20px;">
        <div style="font-weight:700; margin-bottom:8px; font-size:13px;">주요 키워드 (상위 ${topKeywords.length}개, 클릭 순)</div>
        <table class="kw-table">
          <thead>
            <tr>
              <th>키워드</th>
              <th>노출</th><th>클릭</th><th>CTR</th>
              <th>CVR</th><th>CPC</th><th>ROAS</th><th>광고비</th>
            </tr>
          </thead>
          <tbody>
            ${topKeywords.map(k => `
              <tr>
                <td title="${escapeHtml(k.keyword)}">${escapeHtml(k.keyword)}</td>
                <td>${fmt.num(k.impressions)}</td>
                <td>${fmt.num(k.clicks)}</td>
                <td>${fmt.pct(k.ctr, 2)}</td>
                <td>${fmt.pct(k.cvr, 2)}</td>
                <td>${fmt.num(k.cpc)}원</td>
                <td class="${k.roas < 2 ? 'bad' : k.roas > 4 ? 'good' : ''}">${fmt.roas(k.roas)}</td>
                <td>${fmt.krw(k.spend)}</td>
              </tr>
            `).join('')}
          </tbody>
        </table>
      </div>
    ` : ''}

    <div class="v2-stub">
      <h4>🚧 V2 예정 <span class="v2-tag">V2</span></h4>
      <div style="margin-top:8px; display:grid; grid-template-columns:1fr 1fr; gap:12px;">
        <div style="padding:10px 12px; background:#FFF; border-radius:4px;">
          <div style="font-weight:600; color:var(--c-text); font-size:13px; margin-bottom:4px;">키워드별 노출 순위 추적</div>
          <div style="color:var(--c-text-muted); font-size:12px; margin-bottom:8px;">상품·키워드별 쿠팡 내 순위 변동을 일자별로 추적 (공식 API 지원 확인 중)</div>
          <button class="btn btn-sm" onclick="showToast('V2 준비 중 · 대기 등록됨')">V2 대기 등록</button>
        </div>
        <div style="padding:10px 12px; background:#FFF; border-radius:4px;">
          <div style="font-weight:600; color:var(--c-text); font-size:13px; margin-bottom:4px;">연관 키워드 2~3단계 트리 발굴</div>
          <div style="color:var(--c-text-muted); font-size:12px; margin-bottom:8px;">쿠팡 자동완성 기반 연관어 300개 자동 발굴 → 수동 캠페인 일괄 세팅</div>
          <button class="btn btn-sm" onclick="showToast('V2 준비 중 · 대기 등록됨')">V2 대기 등록</button>
        </div>
      </div>
    </div>
  `;

  const panel = document.getElementById('diagnose-panel');
  panel.innerHTML = html;
  panel.style.display = 'block';
  panel.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
}

function actionCard(title, count, code) {
  return `
    <div class="action-card">
      <h4>${title} 키워드</h4>
      <div class="count">${count}개</div>
      <div class="radio-group">
        <label><input type="radio" name="${code}"> 필수키워드 지정</label>
        <label><input type="radio" name="${code}" checked> 제외키워드</label>
        <label><input type="radio" name="${code}"> 제외 + 수동 이관</label>
      </div>
      <button class="btn btn-sm btn-primary" onclick="showModal('KW_ACTION', '${title} · ${count}개')">실행</button>
    </div>
  `;
}

function summaryText(c, t, s, n) {
  const parts = [];
  parts.push(`전체 ROAS <b>${fmt.roas(t.roas)}</b>, 광고비 <b>${fmt.krw(t.spend)}</b>, 광고매출 <b>${fmt.krw(t.revenue)}</b>.`);
  if (s.roas && n.roas) {
    if (s.roas > n.roas * 1.3) parts.push(`검색 영역 효율(${fmt.roas(s.roas)})이 비검색(${fmt.roas(n.roas)}) 대비 높음 — 키워드 확장 기회.`);
    else if (n.roas > s.roas * 1.3) parts.push(`비검색 영역 효율(${fmt.roas(n.roas)})이 검색(${fmt.roas(s.roas)}) 대비 높음 — 비검색 가중치 상향 고려.`);
  }
  if (t.roas < 2) parts.push('<span style="color:var(--c-critical);">⚠ ROAS 200% 미만 — 즉시 개선 필요.</span>');
  return parts.join(' ');
}

// --- 모달 (spec 공통패턴 §1: Slot A/B/C/D) ---
// common-patterns.md 기준 반영 시간 (PoC 결과):
//   예산 변경: 5~15분  | 목표 ROAS: 15~60분 | 키워드 CPC: 1~5분
//   키워드 제외: 10~30분 | 캠페인 ON/OFF: 1~5분
const MODAL_PRESETS = {
  'TARGET_ROAS': {
    title: '목표 ROAS 조정',
    summary: [
      { label: '목표 ROAS', before: '300%', after: '350%', delta: '+50%p', deltaClass: 'good' },
      { label: '예상 일예산 영향', value: '변동 없음', neutral: true },
    ],
    expected: '예상 ROAS 영향: <b>+18 ~ +32%</b> (7일 실측 기반)',
    rollout: '일반적으로 15분 ~ 1시간 내 반영',
  },
  'BUDGET': {
    title: '예산 설정',
    summary: [
      { label: '일예산', before: '₩50,000', after: '₩80,000', delta: '+₩30,000', deltaClass: 'good' },
      { label: '월 환산', before: '₩1,500,000', after: '₩2,400,000', delta: '+₩900,000', deltaClass: 'neutral' },
    ],
    expected: null,
    rollout: '일반적으로 15분 내 반영',
  },
  'KW_ACTION': {
    title: '키워드 액션 실행',
    summary: [
      { label: '제외 키워드', before: '23', after: '38', delta: '+15', deltaClass: 'good' },
      { label: '수동광고 키워드', before: '120', after: '135', delta: '+15', deltaClass: 'good' },
      { label: '예상 일예산 영향', value: '변동 없음', neutral: true },
    ],
    expected: '예상 ROAS 영향: <b>+18 ~ +32%</b>',
    rollout: '30분 내 반영 (키워드 변경)',
  },
  'APPLY_INSIGHT': {
    title: '인사이트 적용',
    summary: [
      { label: '추천 액션', value: '제외 키워드 추가 + 수동 이관', neutral: true },
      { label: '영향 키워드', before: '0', after: '18', delta: '+18', deltaClass: 'good' },
    ],
    expected: '예상 ROAS 영향: <b>+12 ~ +22%</b>',
    rollout: '30분 내 반영',
  },
  'SCHEDULE': {
    title: '노출시간 설정',
    summary: [
      { label: '비노출 구간', value: '02:00~06:30, 14:00~18:00', neutral: true },
      { label: '매출 최적화 ROAS', before: '-', after: '5,000%', delta: 'OFF 조건', deltaClass: 'good' },
      { label: '매출 최적화 예산', before: '-', after: '10,000원', delta: 'OFF 조건', deltaClass: 'good' },
      { label: '수동 성과형', value: 'CPC 100원 (OR)', neutral: true },
    ],
    expected: '예산 효율 2~3배 개선 기대 (테스트 권장)',
    rollout: '15분 내 반영 (예산 변경)',
  },
};

function showModal(actionCode, campName) {
  const preset = MODAL_PRESETS[actionCode] || MODAL_PRESETS['APPLY_INSIGHT'];

  // Slot A: 제목
  document.getElementById('modal-title').textContent =
    `${preset.title}${campName ? ' (' + campName + ')' : ''}`;

  // Slot B: 영향 요약 (변경 전 → 후 표)
  const rows = preset.summary.map(s => {
    if (s.neutral && !s.before) {
      return `
        <tr>
          <td style="color:var(--c-text-muted); padding:8px 0;">${s.label}</td>
          <td style="text-align:right; padding:8px 0;">${s.value || '-'}</td>
        </tr>`;
    }
    return `
      <tr>
        <td style="color:var(--c-text-muted); padding:8px 0; width:40%;">${s.label}</td>
        <td style="text-align:right; padding:8px 0; font-variant-numeric:tabular-nums;">
          <span style="color:var(--c-text-muted);">${s.before}</span>
          <span style="margin:0 6px;">→</span>
          <b>${s.after}</b>
          ${s.delta ? `<span class="${s.delta.startsWith('-') ? 'bad' : s.deltaClass || ''}" style="margin-left:6px; font-weight:600;">(${s.delta})</span>` : ''}
        </td>
      </tr>`;
  }).join('');

  // Slot C: 예상 결과 (옵션)
  const slotC = preset.expected
    ? `<div style="background:#EEF4FF; color:var(--c-primary); padding:10px 12px; border-radius:6px; margin-top:10px; font-size:13px;">${preset.expected}</div>`
    : '';

  // Slot D: 반영 시간 고지
  const slotD = `
    <div style="display:flex; gap:6px; align-items:flex-start; margin-top:12px; padding:8px 10px; background:var(--c-warn-bg); border-radius:4px; color:#B45309; font-size:12px;">
      <span>⚠</span>
      <span>${preset.rollout}</span>
    </div>`;

  document.getElementById('modal-body').innerHTML = `
    <p style="color:var(--c-text-muted); margin-bottom:12px;">이 작업은 쿠팡 API에 반영됩니다.</p>
    <div style="border:1px solid var(--c-border); border-radius:6px; overflow:hidden;">
      <div style="background:#F7FAFC; padding:8px 12px; font-size:12px; font-weight:600; color:var(--c-text-muted); border-bottom:1px solid var(--c-border);">변경 요약</div>
      <table style="width:100%; border-collapse:collapse; font-size:13px;">
        <tbody>${rows.replace(/padding:8px 0/g, 'padding:8px 12px')}</tbody>
      </table>
    </div>
    ${slotC}
    ${slotD}
  `;

  document.getElementById('modal-backdrop').classList.add('open');
}
function closeModal() {
  document.getElementById('modal-backdrop').classList.remove('open');
}

// --- 알림 벨 (spec 01 D-extra) ---
// 시간 표기: 같은 날이면 HH:MM, 어제면 "어제", 그 이전은 MM.DD
function relativeTime(date) {
  const now = new Date('2026-04-21T09:30:00');   // 프로토타입 기준 시각
  const d = date instanceof Date ? date : new Date(date);
  const diffMs = now - d;
  const diffDay = Math.floor(diffMs / 86400000);
  if (diffDay === 0) return d.toTimeString().slice(0, 5);
  if (diffDay === 1) return '어제';
  if (diffDay < 7)   return diffDay + '일 전';
  return (d.getMonth() + 1) + '.' + String(d.getDate()).padStart(2, '0');
}

function renderBell() {
  // 인사이트 상위 12건을 알림으로 변환 (프로토타입)
  const notifs = D.insights.slice(0, 12).map((n, i) => {
    // 각 인사이트에 가상 발생 시각 할당 (최근 2일 내 분포)
    const hoursAgo = [0.5, 1.5, 2, 3, 5, 8, 12, 18, 24, 28, 32, 40][i] || 2;
    const t = new Date('2026-04-21T09:30:00');
    t.setHours(t.getHours() - hoursAgo);
    return { ...n, ts: t };
  });

  const criticalCount = notifs.filter(n => n.severity === 'critical').length;
  document.getElementById('bell-count').textContent = criticalCount || notifs.length;
  document.getElementById('bell-count-text').textContent = notifs.length;
  document.getElementById('bell-list').innerHTML = notifs.map(n => `
    <div class="bell-item" onclick="goCampaign(${n.campaign_id}); closeBell();">
      <div style="display:flex; align-items:center; gap:6px; font-size:13px;">
        <span style="width:46px; flex-shrink:0; font-size:11px; color:var(--c-text-muted); font-variant-numeric:tabular-nums;">${relativeTime(n.ts)}</span>
        ${chip(n.severity)}
        <span style="font-weight:500;">${n.name}</span>
      </div>
      <div class="bell-ts" style="margin-left:52px;">${escapeHtml(n.campaign_short)}</div>
    </div>
  `).join('');
}
function closeBell() {
  document.getElementById('bell-popover').classList.remove('open');
}

// --- 토스트 ---
function showToast(msg) {
  let t = document.getElementById('toast-msg');
  if (!t) {
    t = document.createElement('div');
    t.id = 'toast-msg';
    t.style.cssText = 'position:fixed; bottom:56px; left:50%; transform:translateX(-50%); background:var(--c-text); color:#fff; padding:10px 18px; border-radius:20px; font-size:13px; z-index:400; box-shadow:var(--shadow-lg); opacity:0; transition:opacity .2s;';
    document.body.appendChild(t);
  }
  t.textContent = msg;
  t.style.opacity = '1';
  clearTimeout(showToast._timer);
  showToast._timer = setTimeout(() => (t.style.opacity = '0'), 2200);
}

// --- 기간 비교 (2.2) ---
function renderCompareTable() {
  const metrics = [
    { k: '노출수',   base: 375000, comp: 250000, unit: 'num', upGood: true  },
    { k: '클릭수',   base: 12400,  comp: 8900,   unit: 'num', upGood: true  },
    { k: '전환율',   base: 0.075,  comp: 0.052,  unit: 'pct', upGood: true  },
    { k: 'ROAS',     base: 3.5,    comp: 2.8,    unit: 'pct', upGood: true  },
    { k: 'CPC',      base: 423,    comp: 800,    unit: 'krw', upGood: false },
    { k: 'ACOS',     base: 0.285,  comp: 0.357,  unit: 'pct', upGood: false },
    { k: '매출',     base: 12500000, comp: 9800000, unit: 'krw', upGood: true },
    { k: '광고비',   base: 3500000,  comp: 3100000, unit: 'krw', upGood: true },
  ];

  const fmtByUnit = (v, u) =>
    u === 'num' ? fmt.num(v) :
    u === 'pct' ? fmt.pct(v, 1) :
    u === 'krw' ? fmt.krw(v) :
    v;

  const rows = metrics.map(m => {
    const delta = m.base - m.comp;
    const pctChange = m.comp ? (delta / m.comp) : 0;
    const improved = m.upGood ? delta > 0 : delta < 0;
    const arrow = delta > 0 ? '↑' : delta < 0 ? '↓' : '=';
    const colorClass = improved ? 'good' : (delta === 0 ? 'neutral' : 'bad');
    return `
      <tr>
        <td style="text-align:left;">${m.k}</td>
        <td>${fmtByUnit(m.base, m.unit)}</td>
        <td>${fmtByUnit(m.comp, m.unit)}</td>
        <td class="${colorClass}" style="font-weight:600;">${arrow} ${fmt.pct(Math.abs(pctChange), 1)}</td>
      </tr>
    `;
  }).join('');

  document.getElementById('compare-table').innerHTML = `
    <thead><tr><th>지표</th><th>기준 기간</th><th>비교 기간</th><th>증감</th></tr></thead>
    <tbody>${rows}</tbody>
  `;
}

// --- 변경 로그 (2.3) ---
function renderLogs() {
  // 프로토타입 목업 로그 (실제론 /api/logs)
  const now = new Date('2026-04-21T09:30:00');
  const mk = (h, cid, type, desc, perf) => {
    const camp = D.campaigns.find(c => c.id === cid) || {};
    const t = new Date(now); t.setHours(t.getHours() - h);
    return { ts: t, campaign: camp.short_name || `캠페인 ${cid}`, type, desc, perf };
  };
  const logs = [
    mk(2,   D.campaigns[0]?.id, '🤖', '목표ROAS 350% → 420%', 'ROAS +18% (7d)'),
    mk(20,  D.campaigns[1]?.id, '🤖', '제외 키워드 5개 추가', 'CPC -120원 (7d)'),
    mk(44,  D.campaigns[2]?.id, '✍',  '썸네일 변경', '—'),
    mk(70,  D.campaigns[0]?.id, '🤖', '일예산 50,000 → 80,000', '매출 +35% (7d/14d)'),
    mk(96,  D.campaigns[3]?.id, '📸', '이벤트 배너 변경 (외부)', '—'),
    mk(140, D.campaigns[4]?.id, '🔙', '롤백: 12.01 설정으로 복원', '복원 확인'),
  ];
  const rows = logs.map((l, idx) => `
    <tr onclick="showToast('로그 #${idx+1} 상세 (프로토타입)')">
      <td>${l.ts.getMonth()+1}.${String(l.ts.getDate()).padStart(2,'0')} ${l.ts.toTimeString().slice(0,5)}</td>
      <td class="camp-name" style="max-width:260px;">${escapeHtml(l.campaign)}</td>
      <td>${l.type}</td>
      <td>${escapeHtml(l.desc)}</td>
      <td class="num">${escapeHtml(l.perf)}</td>
      <td>
        ${l.type === '🔙' ? '' : `<button class="btn btn-sm" onclick="event.stopPropagation(); showModal('KW_ACTION','롤백 확인')">롤백</button>`}
      </td>
    </tr>
  `).join('');
  document.getElementById('logs-tbody').innerHTML = rows;
}

// --- 노출시간 히트맵 (2.4) ---
function renderHeatmap() {
  const hours = Array.from({length: 24}, (_, i) => i);
  const days  = ['월','화','수','목','금','토','일'];
  // 비노출 시간: 02~06:30, 14~18
  const isOff = (d, h) => (h >= 2 && h < 7) || (h >= 14 && h < 18);

  const headRow = `
    <div style="display:grid; grid-template-columns:40px repeat(24, 1fr); gap:2px; margin-bottom:4px; font-size:10px; color:var(--c-text-muted); font-variant-numeric:tabular-nums;">
      <div></div>
      ${hours.map(h => `<div style="text-align:center;">${String(h).padStart(2,'0')}</div>`).join('')}
    </div>
  `;
  const dayRows = days.map(d => `
    <div style="display:grid; grid-template-columns:40px repeat(24, 1fr); gap:2px; margin-bottom:2px; align-items:center;">
      <div style="font-size:12px; color:var(--c-text-muted); text-align:right; padding-right:4px;">${d}</div>
      ${hours.map(h => `
        <div title="${d} ${String(h).padStart(2,'0')}:00" style="height:22px; border-radius:2px; background:${isOff(d, h) ? 'var(--c-text-muted)' : 'var(--c-success)'}; opacity:${isOff(d, h) ? 0.4 : 0.85};"></div>
      `).join('')}
    </div>
  `).join('');

  document.getElementById('heatmap').innerHTML = `
    ${headRow}
    ${dayRows}
    <div style="display:flex; gap:14px; margin-top:10px; font-size:11px; color:var(--c-text-muted);">
      <span><span style="display:inline-block; width:12px; height:12px; background:var(--c-success); opacity:0.85; border-radius:2px; vertical-align:middle; margin-right:4px;"></span>광고 노출</span>
      <span><span style="display:inline-block; width:12px; height:12px; background:var(--c-text-muted); opacity:0.4; border-radius:2px; vertical-align:middle; margin-right:4px;"></span>비노출 구간</span>
    </div>
  `;
}

// --- 키워드 마스터 (3.3) ---
function renderKeywordsMaster() {
  // 실제 키워드 데이터는 D.campaigns[*].keywords에 있음. top 20을 표본으로.
  const kws = [];
  D.campaigns.forEach(c => {
    c.keywords.slice(0, 3).forEach(k => {
      // ROAS 낮은 키워드 = 제외, 높은 키워드 = 보호, 중간 = 필수 (분류 데모)
      const type = k.roas < 2 ? '제외' : k.roas > 5 ? '보호' : '필수';
      kws.push({
        keyword: k.keyword,
        type,
        campaign: c.short_name,
        added: `25.${(Math.floor(Math.random()*4)+9).toString().padStart(2,'0')}.${(Math.floor(Math.random()*28)+1).toString().padStart(2,'0')}`,
        source: type === '제외' ? '제외+수동' : '수동',
      });
    });
  });
  const top = kws.slice(0, 20);

  const typeColor = (t) => t === '보호' ? 'chip-info' : t === '제외' ? 'chip-critical' : 'chip-warning';
  const rows = top.map(k => `
    <tr>
      <td><input type="checkbox"></td>
      <td><b>${escapeHtml(k.keyword)}</b></td>
      <td><span class="chip ${typeColor(k.type)}">${k.type}</span></td>
      <td class="camp-name" style="max-width:240px;">${escapeHtml(k.campaign)}</td>
      <td>${k.added}</td>
      <td style="color:var(--c-text-muted); font-size:12px;">${k.source}</td>
      <td class="pro-only" style="color:var(--c-text-muted);">🔍 네이버 <span style="font-size:10px;">(V2)</span></td>
      <td><button class="btn btn-sm" onclick="showToast('${k.type} 키워드 제거')">제거</button></td>
    </tr>
  `).join('');
  document.getElementById('kw-tbody').innerHTML = rows;
  document.getElementById('kw-count').textContent = top.length;
}

// --- 시나리오 북 21 케이스 (4.2) ---
const SCENARIOS_21 = [
  { code:'HIGH_CTR_LOW_CVR',       cat:'traffic_quality', name:'빛 좋은 개살구',       sev:'warning',  hint:'CTR↑ · CVR↓' },
  { code:'HIGH_CVR_LOW_ROAS',      cat:'profitability',   name:'승자의 저주',          sev:'critical', hint:'CVR↑ · ROAS↓', score:9.2 },
  { code:'LOW_ROAS_HIGH_CTR',      cat:'profitability',   name:'고효율 저수익의 역설',  sev:'warning',  hint:'CTR↑ · ROAS↓' },
  { code:'LOW_CTR_LOW_ROAS',       cat:'reach',           name:'전면 재검토',          sev:'critical', hint:'CTR↓ · ROAS↓', score:8.8 },
  { code:'HIGH_ROAS_LOW_CTR',      cat:'profitability',   name:'숨겨진 보석',          sev:'info',     hint:'ROAS↑ · CTR↓' },
  { code:'HIGH_CVR_HIGH_CPA',      cat:'profitability',   name:'마진 점검 필요',        sev:'warning',  hint:'CVR↑ · CPA↑' },
  { code:'LOW_IMP_HIGH_CVR',       cat:'reach',           name:'우물 안 개구리',        sev:'info',     hint:'노출↓ · CVR↑' },
  { code:'HIGH_IMP_LOW_CTR',       cat:'traffic_quality', name:'외면받는 상품',        sev:'warning',  hint:'노출↑ · CTR↓' },
  { code:'BUDGET_SPARE_LOW_CVR',   cat:'budget',          name:'과잉 예산',            sev:'warning',  hint:'예산 소진↓' },
  { code:'BUDGET_TIGHT_HIGH_ROAS', cat:'budget',          name:'기회 손실',            sev:'critical', hint:'예산 부족 · ROAS↑' },
  { code:'PEAK_HOUR_MISMATCH',     cat:'budget',          name:'피크 타임 놓침',        sev:'warning',  hint:'시간대 미스매치' },
  { code:'ITEM_WINNER_LOST',       cat:'external',        name:'아이템위너 이탈',       sev:'critical', hint:'위너 상실' },
  { code:'OUT_OF_STOCK',           cat:'external',        name:'재고 소진',            sev:'critical', hint:'재고 = 0' },
  { code:'THUMBNAIL_CHANGE_PENDING', cat:'external',      name:'썸네일 변경 대기',      sev:'info',     hint:'반영 대기' },
  { code:'CPC_SPIKE',              cat:'cost',            name:'CPC 급등',             sev:'warning',  hint:'CPC 급증' },
  { code:'ROAS_DROP',              cat:'profitability',   name:'ROAS 급감',            sev:'critical', hint:'ROAS -30%' },
  { code:'SALES_SURGE',            cat:'budget',          name:'매출 급증',            sev:'info',     hint:'매출 +60%' },
  { code:'IMP_DROP',               cat:'reach',           name:'노출수 감소',          sev:'warning',  hint:'노출 -40%' },
  { code:'CVR_DROP',               cat:'profitability',   name:'전환율 급감',          sev:'critical', hint:'CVR -50%' },
  { code:'NON_SEARCH_HIGH',        cat:'reach',           name:'비검색 우위',          sev:'info',     hint:'비검색 ROAS↑' },
  { code:'SEARCH_HIGH',            cat:'reach',           name:'검색 우위',            sev:'info',     hint:'검색 ROAS↑' },
];

function renderScenarios() {
  const matchedCodes = new Set(D.insights.map(i => i.code));
  const html = SCENARIOS_21.map(s => {
    const sevIcon  = { critical:'🔴', warning:'🟡', info:'🟢' }[s.sev];
    const matched = matchedCodes.has(s.code);
    return `
      <div class="insight-card" style="padding:14px; cursor:pointer; position:relative; ${matched ? 'border-color:var(--c-primary); box-shadow:0 0 0 2px var(--c-primary-light);' : ''}" onclick="showToast('${s.name} 상세 (프로토타입)')">
        <div style="font-size:18px; margin-bottom:4px;">${sevIcon}</div>
        <div style="font-weight:700; font-size:14px; line-height:1.3; margin-bottom:4px;">${s.name}</div>
        <div style="font-size:11px; color:var(--c-text-muted); margin-bottom:8px;">${s.hint}</div>
        <div style="display:flex; gap:4px; flex-wrap:wrap;">
          <span class="chip chip-type" style="font-size:10px;">${s.cat}</span>
          ${s.score ? `<span class="chip chip-${s.sev}" style="font-size:10px;">임팩트 ${s.score}</span>` : ''}
        </div>
        ${matched ? `<div style="position:absolute; top:8px; right:10px; font-size:10px; color:var(--c-primary); font-weight:700;">● 내 캠페인</div>` : ''}
      </div>
    `;
  }).join('');
  document.getElementById('scenarios-grid').innerHTML = html;
}

// --- 오늘 리포트 전체 리스트 (4.1) ---
// spec 04: 현상 / 데이터인사이트 / 액션플랜 / 예상결과
function renderFullInsights() {
  const ACTION_PLANS = {
    HIGH_CVR_LOW_ROAS: [
      '목표 ROAS 300% → 380% 상향',
      'CPC > 1,500원 키워드를 수동으로 이관',
      '3단어 이상 롱테일 키워드 추가',
    ],
    LOW_CTR_LOW_ROAS: [
      '썸네일 A/B 테스트',
      '경쟁가 대비 판매가 조정 검토',
      '대표 키워드 교체 및 상품명 재설계',
    ],
    HIGH_IMP_LOW_CTR: [
      '썸네일 교체 + 판매가 검토',
      '전환 없는 키워드 제외',
      '비검색 노출 가중치 조정',
    ],
    HIGH_ROAS_LOW_CTR: [
      '일예산 20~30% 상향',
      '유사 키워드 발굴하여 수동 추가',
      '비검색 노출 가중치 상향',
    ],
    NON_SEARCH_HIGH: [
      '비검색 일예산 분리 + 가중치↑',
      '검색 영역 제외 키워드 보강',
    ],
    SEARCH_HIGH: [
      '연관 키워드 30개 발굴하여 수동 확장',
      '검색 영역 일예산 증액',
    ],
  };
  const FALLBACK = ['원인 재진단 실행', '최근 7일 로그 확인', '일예산·목표 ROAS 5~10% 단위 조정'];

  // 심각도 정렬 + 상위 10개
  const sevWeight = { critical: 3, warning: 2, info: 1 };
  const sorted = [...D.insights].sort((a, b) =>
    (sevWeight[b.severity] - sevWeight[a.severity]) || (b.priority - a.priority)
  );
  const top = sorted.slice(0, 10);

  document.getElementById('ins-today-count').textContent = top.length;

  const html = top.map((ins, idx) => {
    const sevIcon  = { critical:'🔴', warning:'🟡', info:'🟢' }[ins.severity];
    const actions = ACTION_PLANS[ins.code] || FALLBACK;
    const actionsHtml = actions.map((a, i) => `
      <div style="display:flex; align-items:center; gap:8px; padding:6px 0; border-bottom:1px dashed var(--c-border);">
        <span style="color:var(--c-text-muted); font-variant-numeric:tabular-nums; width:18px;">${['①','②','③','④','⑤','⑥'][i] || (i+1)}</span>
        <span style="flex:1; font-size:13px;">${escapeHtml(a)}</span>
        <button class="btn btn-sm btn-primary" onclick="showModal('APPLY_INSIGHT','${escapeHtml((ins.campaign_short || '').replace(/'/g,''))}')">적용</button>
      </div>
    `).join('');

    return `
      <div class="insight-card" style="margin-bottom:14px; padding:18px 20px; background:#FFF;">
        <div class="insight-card-head" style="margin-bottom:10px;">
          ${chip(ins.severity)}
          <span class="chip chip-type">${ins.name}</span>
          <span style="font-size:12px; color:var(--c-text-muted);">대상: ${escapeHtml(ins.campaign_short)}</span>
        </div>
        <div style="display:grid; grid-template-columns:1fr 1fr; gap:20px; margin-bottom:14px;">
          <div>
            <div style="font-size:11px; color:var(--c-text-muted); font-weight:700; letter-spacing:0.5px; margin-bottom:4px;">현상 진단</div>
            <div style="font-size:13px; line-height:1.6;">${humanizeInsight(ins)}</div>
          </div>
          <div class="pro-only">
            <div style="font-size:11px; color:var(--c-text-muted); font-weight:700; letter-spacing:0.5px; margin-bottom:4px;">데이터 인사이트</div>
            <div style="font-size:12px; color:var(--c-text); line-height:1.6;">${escapeHtml(ins.detail)}</div>
          </div>
        </div>
        <div style="border-top:1px solid var(--c-border); padding-top:10px;">
          <div style="font-size:11px; color:var(--c-text-muted); font-weight:700; letter-spacing:0.5px; margin-bottom:6px;">액션 플랜</div>
          ${actionsHtml}
        </div>
        <div class="pro-only" style="background:#F7FAFC; border-left:3px solid var(--c-success); padding:10px 12px; border-radius:4px; margin-top:12px;">
          <b style="color:var(--c-success); font-size:12px;">예상 결과</b>
          <span style="font-size:12px; margin-left:6px;">광고비 -25% · ROAS +60%p · 매출 -8% <span style="color:var(--c-success);">(순이익 +12%)</span></span>
        </div>
        <div class="pro-only" style="text-align:right; margin-top:8px;">
          <a class="btn-link" onclick="document.querySelector('[data-ins-tab=scenarios]').click()">전략 시나리오 북에서 원문 보기 →</a>
        </div>
      </div>
    `;
  }).join('');
  document.getElementById('insight-full-list').innerHTML = html;
}

// spec 04 현상 진단용 한 문장 매핑 (대시보드 인사이트 카드와 공유 가능)
function humanizeInsight(x) {
  const MAP = {
    HIGH_CVR_LOW_ROAS:  '전환율은 우수하나 높은 CPC로 마진이 잠식되고 있습니다.',
    LOW_ROAS_HIGH_CTR:  '클릭은 많지만 수익성이 낮아 입찰가 조정이 필요합니다.',
    LOW_CTR_LOW_ROAS:   '클릭도 매출도 낮아 상품·타겟팅 재검토가 시급합니다.',
    HIGH_ROAS_LOW_CTR:  '수익성 좋은 숨겨진 보석입니다 — 노출 확대 기회.',
    HIGH_IMP_LOW_CTR:   '노출은 많지만 클릭이 안 되는 캠페인 — 썸네일·가격 점검.',
    LOW_IMP_HIGH_CVR:   '전환율은 높은데 노출이 부족 — 예산 확대를 고려하세요.',
    NON_SEARCH_HIGH:    '비검색 영역 ROAS가 우위 — 비검색 가중치를 올려보세요.',
    SEARCH_HIGH:        '검색 영역 ROAS가 우위 — 키워드 확장 기회입니다.',
  };
  return MAP[x.code] || x.detail;
}

// --- 그 외 12가지 규칙 아코디언 ---
function renderRulesAll() {
  const rules = [
    { n: 1,  cond: 'ROAS 기준 이상',             act: '예산 ↑ / 목표ROAS ↓',  checked: true  },
    { n: 2,  cond: '매출 높음 + ROAS 낮음',      act: '예산 ↑ / 목표ROAS ↑',  checked: true  },
    { n: 3,  cond: '매출·ROAS 모두 낮음',        act: '예산 ↓ / 목표ROAS ↑',  checked: false },
    { n: 4,  cond: '전환율 높음 + CPC 낮음',     act: '예산 ↑ / 목표ROAS ↑',  checked: false },
    { n: 5,  cond: '비검색 ROAS 높음',           act: '노출수 증대 전략',       checked: false },
    { n: 6,  cond: '검색 ROAS 높음',             act: '추가 키워드 발굴',       checked: false },
    { n: 7,  cond: '주말 매출 우선',             act: '변함없이 진행',          checked: false },
    { n: 8,  cond: '주말 수익 우선',             act: '목표 ROAS 상향',         checked: false },
    { n: 9,  cond: '피크 타임 예산 부족',        act: '시간대 예산 상향',       checked: false },
    { n: 10, cond: 'CPC 급등 (>30%)',            act: '입찰가 -20% 하향',       checked: false },
    { n: 11, cond: '노출 급감 (-40%)',           act: '키워드 입찰가 상향',     checked: false },
    { n: 12, cond: '재고 임박 (7일 이하)',       act: '광고 강제 ON 유지',      checked: false },
    { n: 13, cond: '아이템위너 이탈',            act: '광고 자동 OFF + 알림',   checked: false },
    { n: 14, cond: '동일 키워드 30일 저성과',    act: '자동 제외 키워드 추가',  checked: false },
    { n: 15, cond: 'ROAS -30% 이상 급감',        act: '이전 설정 자동 롤백',    checked: false },
    { n: 16, cond: '목표 달성 초과 (120%)',      act: '일예산 10% 상향',        checked: false },
  ];
  document.getElementById('rules-all-list').innerHTML = rules.map(r => `
    <label style="display:grid; grid-template-columns:18px auto 1fr 1fr; gap:8px; padding:4px 0; font-size:13px; align-items:center;">
      <input type="checkbox" ${r.checked ? 'checked' : ''}>
      <span style="color:var(--c-text-muted); font-variant-numeric:tabular-nums;">${String(r.n).padStart(2,'0')}</span>
      <span>${r.cond}</span>
      <span style="color:var(--c-primary); font-weight:500;">→ ${r.act}</span>
    </label>
  `).join('');
}

// --- 네비게이션 ---
function switchView(view) {
  document.querySelectorAll('.gnb-nav a').forEach(a => a.classList.toggle('active', a.dataset.view === view));
  document.querySelectorAll('.view').forEach(v => v.classList.toggle('active', v.id === 'view-' + view));
}
function goCampaign(cid) {
  switchView('campaigns');
  setTimeout(() => {
    const tr = document.querySelector(`#camp-tbody tr[data-cid="${cid}"]`);
    if (tr) {
      tr.classList.add('selected');
      tr.scrollIntoView({ behavior: 'smooth', block: 'center' });
      diagnose(cid);
    }
  }, 50);
}

// --- 서브탭 (캠페인 분석·관리 2.1~2.4) ---
function switchSubtab(key) {
  // 같은 view 내 subtabs만 토글하도록 scope
  const root = document.getElementById('view-campaigns');
  root.querySelectorAll('.subtab').forEach(t => t.classList.toggle('active', t.dataset.subtab === key));
  ['diagnose','compare','logs','schedule'].forEach(k => {
    const el = document.getElementById('sub-' + k);
    if (el) el.style.display = (k === key ? 'block' : 'none');
  });
  // 탭 진입 시 지연 렌더 (컨텐츠가 무거운 경우)
  if (key === 'compare') renderCompareTable();
  if (key === 'logs')    renderLogs();
  if (key === 'schedule') renderHeatmap();
}

// --- 규칙 서브탭 (3.1~3.3) ---
function switchRuleTab(key) {
  const root = document.getElementById('view-rules');
  root.querySelectorAll('.subtab').forEach(t => t.classList.toggle('active', t.dataset.ruleTab === key));
  ['builder','channels','keywords'].forEach(k => {
    const el = document.getElementById('rule-sub-' + k);
    if (el) el.style.display = (k === key ? 'block' : 'none');
  });
  if (key === 'keywords') renderKeywordsMaster();
}

// --- 인사이트 서브탭 (4.1~4.3) ---
function switchInsTab(key) {
  const root = document.getElementById('view-insights');
  root.querySelectorAll('.subtab').forEach(t => t.classList.toggle('active', t.dataset.insTab === key));
  ['today','scenarios','learn'].forEach(k => {
    const el = document.getElementById('ins-sub-' + k);
    if (el) el.style.display = (k === key ? 'block' : 'none');
  });
  if (key === 'scenarios') renderScenarios();
}

// --- 모드 토글 ---
function switchMode(mode) {
  document.body.className = 'mode-' + mode;
  document.querySelectorAll('.mode-toggle button').forEach(b => b.classList.toggle('active', b.dataset.mode === mode));
  // 일부 재렌더 (모드별 show/hide 콘텐츠)
  renderInsights();
  renderFullInsights();
}

// --- 유틸 ---
function escapeHtml(s) {
  if (s == null) return '';
  return String(s).replace(/[&<>"']/g, c => ({
    '&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'
  }[c]));
}

// --- 이벤트 바인딩 ---
document.querySelectorAll('.gnb-nav a').forEach(a => {
  a.addEventListener('click', () => switchView(a.dataset.view));
});
document.querySelectorAll('.section-link').forEach(a => {
  if (a.dataset.view) a.addEventListener('click', () => switchView(a.dataset.view));
});
document.querySelectorAll('.subtab').forEach(t => {
  t.addEventListener('click', () => {
    if (t.dataset.subtab)  switchSubtab(t.dataset.subtab);
    if (t.dataset.ruleTab) switchRuleTab(t.dataset.ruleTab);
    if (t.dataset.insTab)  switchInsTab(t.dataset.insTab);
  });
});
// "그 외 12가지 규칙" 아코디언
document.addEventListener('click', (e) => {
  if (e.target.id === 'rules-show-all') {
    const el = document.getElementById('rules-all-list');
    const open = el.style.display === 'block';
    el.style.display = open ? 'none' : 'block';
    e.target.textContent = open ? '그 외 12가지 규칙 자세히 보기 →' : '접기 ↑';
  }
});
document.querySelectorAll('.mode-toggle button').forEach(b => {
  b.addEventListener('click', () => switchMode(b.dataset.mode));
});
document.getElementById('bell-btn').addEventListener('click', (e) => {
  e.stopPropagation();
  document.getElementById('bell-popover').classList.toggle('open');
});
document.addEventListener('click', (e) => {
  if (!e.target.closest('#bell-popover') && !e.target.closest('#bell-btn')) closeBell();
});
document.getElementById('modal-backdrop').addEventListener('click', (e) => {
  if (e.target.id === 'modal-backdrop') closeModal();
});

// --- 초기 렌더 ---
renderKPIs();
renderInsights();
renderRankings();
renderCampaigns();
renderBell();
renderFullInsights();   // 화면 04 · 오늘 리포트 (기본 진입 탭)
renderRulesAll();       // 화면 03 · "그 외 12가지 규칙" 리스트 (숨김 상태로 미리 렌더)
