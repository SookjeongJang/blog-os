const API_URL = "https://script.google.com/macros/s/AKfycbwCOyxrS93IRXDM-bKdmVeo2okUo_CudJx5GD0USHVZfy2JXOeLPEfOXdEMjvQpq89TPg/exec";

let ideas = [];
let activeCategory = '전체';
let draft = JSON.parse(localStorage.getItem('blogos_draft') || 'null');
let liveTopics = JSON.parse(localStorage.getItem('blogos_live_topics') || '[]');
let lastFactCheckResult = null;
let lastFactCheckProblems = [];

const panels = {
  home: document.getElementById('homePanel'),
  finder: document.getElementById('finderPanel'),
  ideas: document.getElementById('ideasPanel'),
  writer: document.getElementById('writerPanel'),
  preview: document.getElementById('previewPanel'),
  content: document.getElementById('contentPanel')
};

function showToast(message) {
  const toast = document.getElementById('toast');
  toast.textContent = message;
  toast.classList.add('show');
  clearTimeout(window.__toastTimer);
  window.__toastTimer = setTimeout(() => toast.classList.remove('show'), 1800);
}

function showView(view) {
  Object.entries(panels).forEach(([key,panel]) => panel.classList.toggle('active', key === view));
  const isHome = view === 'home';
  document.getElementById('homeView').classList.toggle('hidden', !isHome);
  document.getElementById('statsView').classList.toggle('hidden', !isHome);

  document.querySelectorAll('.nav-item').forEach(btn => {
    const navView = (view === 'writer' || view === 'preview') ? 'content' : view;
    btn.classList.toggle('active', btn.dataset.view === navView);
  });

  if (view === 'content') renderDraft();
  window.scrollTo({top:0,behavior:'smooth'});
}

function escapeHtml(v) {
  return String(v).replaceAll('&','&amp;').replaceAll('<','&lt;').replaceAll('>','&gt;').replaceAll('"','&quot;').replaceAll("'",'&#039;');
}

function normalizeIdea(row,index) {
  return {
    id:index,
    category:String(row['카테고리']||'기타').trim(),
    title:String(row['제목']||'제목 없음').trim(),
    subtitle:String(row['서브제목']||'').trim(),
    point:String(row['포인트']||'').trim(),
    status:String(row['상태']||'대기').trim(),
    priority:Number(row['우선순위'])||99
  };
}

function ideaCard(i) {
  return `<article class="idea-card">
    <div class="idea-top">
      <div>
        <div class="tag-row"><span class="tag">${escapeHtml(i.category)}</span><span class="tag">${escapeHtml(i.status)}</span></div>
        <h4>${escapeHtml(i.title)}</h4>
        ${i.subtitle?`<div class="subtitle">${escapeHtml(i.subtitle)}</div>`:''}
      </div>
      <div class="priority">${i.priority===99?'-':i.priority}</div>
    </div>
    <p>${escapeHtml(i.point||'핵심 포인트가 아직 입력되지 않았어요.')}</p>
    <button class="small-btn primary" onclick="startWriting(${i.id})">작성하기</button>
  </article>`;
}

function renderIdeas() {
  const sorted=[...ideas].sort((a,b)=>a.priority-b.priority||a.title.localeCompare(b.title,'ko'));
  document.getElementById('ideaCount').textContent=ideas.length;
  document.getElementById('waitingCount').textContent=ideas.filter(i=>i.status==='대기').length;
  document.getElementById('priorityCount').textContent=ideas.filter(i=>i.priority===1).length;
  document.getElementById('topIdeas').innerHTML=sorted.slice(0,3).map(ideaCard).join('')||'<div class="empty-card">아직 오늘의 글감이 없어요.</div>';

  const filtered=activeCategory==='전체'?sorted:sorted.filter(i=>i.category===activeCategory);
  document.getElementById('allIdeas').innerHTML=filtered.map(ideaCard).join('')||'<div class="empty-card">해당 카테고리의 글감이 없어요.</div>';

  const cats=['전체',...new Set(ideas.map(i=>i.category))];
  document.getElementById('categoryFilters').innerHTML=cats.map(c=>`<button class="filter-chip ${activeCategory===c?'active':''}" onclick="setCategory('${encodeURIComponent(c)}')">${escapeHtml(c)}</button>`).join('');
}

window.setCategory=function(encoded) {
  activeCategory=decodeURIComponent(encoded);
  renderIdeas();
};

window.startWriting=function(id) {
  const item=ideas.find(i=>i.id===id);
  if(!item) return;
  document.getElementById('writerCategory').value=item.category;
  document.getElementById('writerTitle').value=item.title;
  document.getElementById('writerPoint').value=item.point;
  document.getElementById('writerHtml').value='';
  hideAiError();
  showView('writer');
};

function getWriterDraft() {
  return {
    category:document.getElementById('writerCategory').value.trim(),
    title:document.getElementById('writerTitle').value.trim(),
    point:document.getElementById('writerPoint').value.trim(),
    html:document.getElementById('writerHtml').value
  };
}

function saveDraft() {
  draft=getWriterDraft();
  localStorage.setItem('blogos_draft',JSON.stringify(draft));
  showToast('초안을 저장했어요');
}

function renderDraft() {
  const card=document.getElementById('draftCard');
  const empty=document.getElementById('draftEmpty');

  if(!draft) {
    card.innerHTML='';
    empty.classList.remove('hidden');
    return;
  }

  empty.classList.add('hidden');
  card.innerHTML=`<article class="idea-card">
    <div class="tag-row"><span class="tag">${escapeHtml(draft.category||'기타')}</span></div>
    <h4>${escapeHtml(draft.title||'제목 없음')}</h4>
    <p>${escapeHtml(draft.point||'저장된 초안이 있어요.')}</p>
    <button class="small-btn primary" id="continueDraftBtn">계속 작성</button>
  </article>`;

  document.getElementById('continueDraftBtn').onclick=()=>{
    document.getElementById('writerCategory').value=draft.category||'';
    document.getElementById('writerTitle').value=draft.title||'';
    document.getElementById('writerPoint').value=draft.point||'';
    document.getElementById('writerHtml').value=draft.html||'';
    hideAiError();
    showView('writer');
  };
}

function renderPreview() {
  draft=getWriterDraft();
  localStorage.setItem('blogos_draft',JSON.stringify(draft));
  document.getElementById('previewCategory').textContent=draft.category||'기타';
  document.getElementById('previewTitle').textContent=draft.title||'제목 없음';
  document.getElementById('previewPoint').textContent=draft.point||'';
  document.getElementById('previewHtml').innerHTML=draft.html||'<p>HTML 본문이 아직 없어요.</p>';
}

function setAiLoading(on) {
  const btn=document.getElementById('generateAiBtn');
  btn.disabled=on;
  btn.textContent=on?'생성 중...':'AI 초안 생성';
  document.getElementById('aiProgress').classList.toggle('hidden',!on);
}

function showAiError(message) {
  const box=document.getElementById('aiError');
  box.textContent=message;
  box.classList.remove('hidden');
}

function hideAiError() {
  document.getElementById('aiError').classList.add('hidden');
}

async function generateAiDraft() {
  hideAiError();

  const category=document.getElementById('writerCategory').value.trim();
  const title=document.getElementById('writerTitle').value.trim();
  const point=document.getElementById('writerPoint').value.trim();

  if(!title) {
    showAiError('제목이 비어 있어요. 제목을 먼저 입력해 주세요.');
    return;
  }

  setAiLoading(true);

  try {
      const response = await fetch('/api/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          category,
          title,
          point,
          source_url: window.currentSourceUrl || '',
          source_name: window.currentSourceName || ''
        })
      });

    const data=await response.json().catch(()=>({}));

    if(!response.ok) {
      throw new Error(data.error||`AI 요청 실패 (${response.status})`);
    }

    if(!data.html) throw new Error('AI 응답에 HTML이 없어요.');

    document.getElementById('writerHtml').value=data.html;
    draft=getWriterDraft();
    localStorage.setItem('blogos_draft',JSON.stringify(draft));
    showToast('AI 초안이 완성됐어요 ✨');
  } catch(error) {
    console.error(error);
    showAiError(error.message||'AI 초안 생성 중 오류가 발생했어요.');
  } finally {
    setAiLoading(false);
  }
}


function setTopicLoading(on) {
  const btn = document.getElementById('runTopicSearchBtn');
  btn.disabled = on;
  btn.textContent = on ? '찾는 중...' : '오늘 글감 찾기';
  document.getElementById('topicProgress').classList.toggle('hidden', !on);
}

function showTopicError(message) {
  const box = document.getElementById('topicError');
  box.textContent = message;
  box.classList.remove('hidden');
}

function hideTopicError() {
  document.getElementById('topicError').classList.add('hidden');
}

function renderLiveTopics() {
  const list = document.getElementById('liveTopics');
  const empty = document.getElementById('topicEmpty');

  if (!Array.isArray(liveTopics) || !liveTopics.length) {
    list.innerHTML = '';
    empty.classList.remove('hidden');
    return;
  }

  empty.classList.add('hidden');

  list.innerHTML = liveTopics.map((t, index) => {
    const grade = String(t.grade || 'B').toUpperCase();

    const sourceLink = t.source_url
      ? `<a class="source-link" href="${escapeHtml(t.source_url)}" target="_blank" rel="noopener noreferrer">출처 확인 ↗</a>`
      : '';

    const verification =
      t.verification_status === 'verified'
        ? `<div class="verification-badge verified">
             ✓ 공식 출처 확인됨
             <small>${escapeHtml(t.verification_note || '')}</small>
           </div>`
        : t.verification_status === 'current_check'
        ? `<div class="verification-badge current-check">
             ⚠ 현재 상태 확인 필요
             <small>${escapeHtml(t.verification_note || '')}</small>
           </div>`
        : '';

    return `
      <article class="topic-card">
        <div class="topic-card-head">
          <div class="tag-row">
            <span class="grade-badge grade-${escapeHtml(grade)}">${escapeHtml(grade)}급</span>
            <span class="tag">${escapeHtml(t.category || '생활정보')}</span>
            ${t.freshness ? `<span class="tag">${escapeHtml(t.freshness)}</span>` : ''}
          </div>

          <div class="topic-score">${escapeHtml(t.score || '-')}</div>
        </div>

        <h4>${escapeHtml(t.title || '제목 없음')}</h4>

        <p class="topic-reason">
          ${escapeHtml(t.reason || '')}
        </p>

        <div class="topic-source">
          ${t.source_name ? `출처: ${escapeHtml(t.source_name)} ` : ''}
          ${sourceLink}
        </div>

        ${verification}

        <div class="topic-actions">
          <button
            class="small-btn primary"
            onclick="writeLiveTopic(${index})"
          >
            이 주제로 초안 만들기
          </button>
        </div>
      </article>
    `;
  }).join('');
}

window.writeLiveTopic = function(index) {
  const t = liveTopics[index];
  if (!t) return;

  window.currentSourceUrl = t.source_url || '';
  window.currentSourceName = t.source_name || '';
  
  document.getElementById('writerCategory').value = t.category || '';
  document.getElementById('writerTitle').value = t.title || '';
  document.getElementById('writerPoint').value = [
    t.reason || '',
    t.key_points || '',
    t.source_name ? `참고 출처: ${t.source_name}` : '',
  ].filter(Boolean).join('\n');
  document.getElementById('writerHtml').value = '';

  hideAiError();
  showView('writer');
};

async function findLiveTopics() {
  hideTopicError();
  setTopicLoading(true);
  const count = Number(document.getElementById('topicCount').value) || 3;

  try {
    const response = await fetch('/api/topics', {
      method: 'POST',
      headers: {'Content-Type':'application/json'},
      body: JSON.stringify({ count })
    });
    const data = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(data.error || `글감 검색 실패 (${response.status})`);
    if (!Array.isArray(data.topics)) throw new Error('글감 응답 형식이 올바르지 않아요.');

    liveTopics = data.topics;
    localStorage.setItem('blogos_live_topics', JSON.stringify(liveTopics));
    renderLiveTopics();
    showToast(`최신 글감 ${liveTopics.length}개를 찾았어요 🔥`);
  } catch (error) {
    console.error(error);
    showTopicError(error.message || '최신 글감 검색 중 오류가 발생했어요.');
  } finally {
    setTopicLoading(false);
  }
}

async function loadIdeas() {
  document.getElementById('homeLoading').classList.remove('hidden');
  document.getElementById('ideasLoading').classList.remove('hidden');

  try {
    const response=await fetch(API_URL,{cache:'no-store',redirect:'follow'});
    if(!response.ok) throw new Error(`HTTP ${response.status}`);
    const data=await response.json();

    ideas=(Array.isArray(data)?data:[])
      .filter(row=>Object.values(row).some(v=>String(v??'').trim()))
      .map(normalizeIdea);

    renderIdeas();
    document.getElementById('statusDot').className='status-dot good';
    document.getElementById('systemStatusText').textContent='Google Sheets와 정상 연결됐어요';
  } catch(error) {
    console.error(error);
    ideas=[];
    renderIdeas();
    document.getElementById('statusDot').className='status-dot bad';
    document.getElementById('systemStatusText').textContent='Google Sheets 연결을 확인해 주세요';
  } finally {
    document.getElementById('homeLoading').classList.add('hidden');
    document.getElementById('ideasLoading').classList.add('hidden');
  }
}

document.querySelectorAll('[data-view]').forEach(btn=>btn.addEventListener('click',()=>showView(btn.dataset.view)));
document.getElementById('findTopicsBtn').addEventListener('click',()=>showView('finder'));
document.getElementById('runTopicSearchBtn').addEventListener('click',findLiveTopics);
document.getElementById('refreshBtn').addEventListener('click',loadIdeas);
document.getElementById('generateAiBtn').addEventListener('click',generateAiDraft);
document.getElementById('saveDraftBtn').addEventListener('click',saveDraft);
document.getElementById('previewBtn').addEventListener('click',()=>{renderPreview();showView('preview');});

document.getElementById('themeBtn').addEventListener('click',()=>{
  document.body.classList.toggle('light');
  localStorage.setItem('blogos_theme',document.body.classList.contains('light')?'light':'dark');
});

if(localStorage.getItem('blogos_theme')==='light') document.body.classList.add('light');

renderDraft();
renderLiveTopics();
loadIdeas();

document.getElementById('copyTitleBtn')?.addEventListener('click', async () => {
  const title = document.getElementById('writerTitle')?.value || '';

  if (!title.trim()) {
    alert('복사할 제목이 없어요.');
    return;
  }

  await navigator.clipboard.writeText(title);

  const btn = document.getElementById('copyTitleBtn');
  const original = btn.textContent;

  btn.textContent = '✓ 제목 복사됨';

  setTimeout(() => {
    btn.textContent = original;
  }, 1500);
});


document.getElementById('copyHtmlBtn')?.addEventListener('click', async () => {
  const originalHtml = document.getElementById('writerHtml')?.value || '';

  if (!originalHtml.trim()) {
    alert('복사할 글이 없어요.');
    return;
  }

  const safeHtml = originalHtml
    .replace(
      /<div class="related-button">[\s\S]*?href="INTERNAL_LINK_[^"]*"[\s\S]*?<\/div>/gi,
      ''
    )
    .replace(
      /<a[^>]*href="INTERNAL_LINK_[^"]*"[^>]*>[\s\S]*?<\/a>/gi,
      ''
    )
    .trim();

  await navigator.clipboard.writeText(safeHtml);

  const btn = document.getElementById('copyHtmlBtn');
  const original = btn.textContent;

  btn.textContent = '✓ 발행용 HTML 복사됨';

  setTimeout(() => {
    btn.textContent = original;
  }, 1500);
});

function stripHtml(html) {
  const temp = document.createElement('div');
  temp.innerHTML = html;
  return temp.textContent || temp.innerText || '';
}

function runPublishCheck() {
  const title =
    document.getElementById('writerTitle')?.value.trim() || '';

  const html =
    document.getElementById('writerHtml')?.value || '';

  if (!html.trim()) {
    alert('먼저 AI 초안을 만들어 주세요.');
    return;
  }

  const text = stripHtml(html).replace(/\s+/g, ' ').trim();

  const checks = [];

  function addCheck(label, passed, points, note = '') {
    checks.push({
      label,
      passed,
      points: passed ? points : 0,
      max: points,
      note
    });
  }


  /* 1. 제목 */
  const titleGood =
    title.length >= 15 &&
    title.length <= 60;

  addCheck(
    '제목 길이',
    titleGood,
    10,
    titleGood
      ? '검색 결과에서 읽기 좋은 길이예요.'
      : '제목은 약 15~60자 정도가 좋아요.'
  );


  /* 2. 공식 출처 */
  const hasOfficialSource =
    html.includes('official-source') ||
    Boolean(window.currentSourceUrl);

  addCheck(
    '공식 출처',
    hasOfficialSource,
    15,
    hasOfficialSource
      ? '공식 출처가 연결되어 있어요.'
      : '공식 출처를 한 번 더 확인해 주세요.'
  );


  /* 3. 공식 행동 버튼 */
  const hasOfficialAction =
    html.includes('official-action');

  addCheck(
    '신청·예약·조회 버튼',
    hasOfficialAction || !window.currentSourceUrl,
    10,
    hasOfficialAction
      ? '공식 행동 버튼이 있어요.'
      : window.currentSourceUrl
      ? '공식 URL은 있지만 행동 버튼이 없어요.'
      : '이 글은 행동 버튼이 꼭 필요한 주제는 아닐 수 있어요.'
  );


  /* 4. 핵심 요약 */
  const hasSummary =
    html.includes('summary-box');

  addCheck(
    '핵심 요약',
    hasSummary,
    10,
    hasSummary
      ? '핵심 내용이 앞부분에 정리되어 있어요.'
      : '짧은 핵심 요약 박스가 있으면 읽기 쉬워져요.'
  );


  /* 5. 소제목 */
  const h2Count =
    (html.match(/<h2\b/gi) || []).length;

  addCheck(
    '소제목 구조',
    h2Count >= 2,
    10,
    h2Count >= 2
      ? `h2 소제목이 ${h2Count}개 있어요.`
      : 'h2 소제목을 2개 이상 사용해 주세요.'
  );


  /* 6. 글 길이 */
  const textLength = text.length;

  const lengthGood =
    textLength >= 600 &&
    textLength <= 1800;

  addCheck(
    '글 길이',
    lengthGood,
    10,
    lengthGood
      ? `약 ${textLength}자예요. 짧게 읽기 좋은 편이에요.`
      : textLength < 600
      ? `약 ${textLength}자예요. 핵심 설명이 너무 짧을 수 있어요.`
      : `약 ${textLength}자예요. 시리즈로 나눌 수 있는지 확인해 보세요.`
  );


  /* 7. FAQ */
  const hasFaq =
    /FAQ|자주 묻는 질문/i.test(html);

  addCheck(
    'FAQ',
    hasFaq,
    10,
    hasFaq
      ? '짧은 FAQ가 포함되어 있어요.'
      : 'FAQ 2~3개를 넣으면 검색 질문을 더 잘 받을 수 있어요.'
  );


  /* 8. 애드센스 자리 */
  const adCount =
    [
      'ADSENSE_TOP',
      'ADSENSE_MIDDLE',
      'ADSENSE_BOTTOM'
    ].filter(name => html.includes(name)).length;

  addCheck(
    '애드센스 자리',
    adCount >= 2,
    10,
    adCount >= 2
      ? `광고 자리표시자 ${adCount}개가 있어요.`
      : '광고 위치가 충분히 표시되어 있는지 확인해 주세요.'
  );


  /* 9. 미연결 내부링크 */
  const internalLinks =
    (html.match(/INTERNAL_LINK_/g) || []).length;

  addCheck(
    '내부 연결글',
    internalLinks === 0,
    5,
    internalLinks === 0
      ? '미연결 링크가 없어요.'
      : `연결 전 관련글 ${internalLinks}개가 있어요. HTML 복사할 때 자동 제거됩니다.`
  );


  /* 10. 긴 URL 노출 */
  const visibleUrl =
    /https?:\/\/[^\s<]{20,}/i.test(text);

  addCheck(
    '본문 URL 노출',
    !visibleUrl,
    10,
    !visibleUrl
      ? '긴 URL이 본문에 그대로 노출되지 않아요.'
      : '본문에 긴 URL 문자열이 보여요. 버튼으로 바꾸는 게 좋아요.'
  );


  const score =
    checks.reduce(
      (sum, item) => sum + item.points,
      0
    );

  const scoreEl =
    document.getElementById('publishScore');

  const statusEl =
    document.getElementById('publishStatus');

  const listEl =
    document.getElementById('publishChecks');

  const box =
    document.getElementById('publishCheckBox');


  scoreEl.textContent = `${score}점`;

  let status = '';

  if (score >= 90) {
    status = '발행 준비 완료 ✓';
  } else if (score >= 75) {
    status = '거의 준비됐어요';
  } else if (score >= 60) {
    status = '조금 더 확인해요';
  } else {
    status = '수정이 필요해요';
  }

  statusEl.textContent = status;


  listEl.innerHTML = checks.map(item => `
    <div class="publish-check-item ${item.passed ? 'passed' : 'warning'}">

      <div class="publish-check-icon">
        ${item.passed ? '✓' : '!'}
      </div>

      <div class="publish-check-text">
        <strong>${item.label}</strong>
        <small>${item.note}</small>
      </div>

      <span class="publish-check-point">
        ${item.points}/${item.max}
      </span>

    </div>
  `).join('');


  box.classList.remove('hidden');

  showToast(`발행 준비도 ${score}점`);
}


document
  .getElementById('checkPublishBtn')
  ?.addEventListener(
    'click',
    runPublishCheck
  );

function setFactCheckLoading(on) {
  const btn = document.getElementById('verifyFactsBtn');
  const loading = document.getElementById('factCheckLoading');

  if (btn) {
    btn.disabled = on;
    btn.textContent = on ? '검증 중...' : '🔍 사실 검증';
  }

  if (loading) {
    loading.classList.toggle('hidden', !on);
  }
}

function showFactCheckError(message) {
  const box = document.getElementById('factCheckError');

  if (!box) return;

  box.textContent = message;
  box.classList.remove('hidden');
}

function hideFactCheckError() {
  document
    .getElementById('factCheckError')
    ?.classList.add('hidden');
}

function renderFactCheck(result) {
    lastFactCheckResult = result;
  
  lastFactCheckProblems = Array.isArray(result.checks)
  ? result.checks.filter(
      item =>
        item.status === 'incorrect' ||
        item.status === 'needs_check'
    )
  : [];
  
  const box = document.getElementById('factCheckBox');
  const statusEl = document.getElementById('factCheckStatus');
  const summaryEl = document.getElementById('factCheckSummary');
  const resultsEl = document.getElementById('factCheckResults');

  if (!box || !statusEl || !summaryEl || !resultsEl) return;

  const checks = Array.isArray(result.checks)
    ? result.checks
    : [];

  const problems = checks.filter(
    item =>
      item.status === 'needs_check' ||
      item.status === 'incorrect'
  );

  const verified = checks.filter(
    item => item.status === 'verified'
  );

  /* 전체 판정 */
const incorrectCount = Number(result.incorrect_count || 0);
const needsCheckCount = Number(result.needs_check_count || 0);

if (incorrectCount > 0) {
  statusEl.textContent = '! 수정 후 발행';

} else if (needsCheckCount > 0) {
  statusEl.textContent = '⚠ 확인 후 발행';

} else {
  statusEl.textContent = '✓ 발행 가능';
}


/* 문제가 있을 때만 수정 버튼 표시 */

const fixActions =
  document.getElementById('factFixActions');

if (fixActions) {
  const hasProblem =
    incorrectCount > 0 ||
    needsCheckCount > 0;

  fixActions.classList.toggle(
    'hidden',
    !hasProblem
  );
}

  summaryEl.textContent =
    `확인 ${result.verified_count || 0} · ` +
    `확인 필요 ${result.needs_check_count || 0} · ` +
    `오류 ${result.incorrect_count || 0}`;

  let html = '';

  /* 문제가 있을 때만 먼저 표시 */
  if (problems.length) {
    html += `
      <div class="fact-problem-box">
        <strong>먼저 확인할 것</strong>
    `;

    problems.forEach(item => {
      const isWrong = item.status === 'incorrect';

      html += `
        <div class="fact-problem-item">
          <span>${isWrong ? '❌' : '⚠️'}</span>

          <div>
            <b>${escapeHtml(item.claim || '')}</b>
            <p>${escapeHtml(item.evidence || '')}</p>

            ${
              item.source_url
                ? `<a href="${escapeHtml(item.source_url)}"
                      target="_blank"
                      rel="noopener noreferrer">
                     ${escapeHtml(item.source_name || '공식 출처')} ↗
                   </a>`
                : ''
            }
          </div>
        </div>
      `;
    });

    html += `</div>`;
  } else {
    html += `
      <div class="fact-all-good">
        <strong>🟢 공식 자료와 대조 완료</strong>
        <p>
          핵심 사실 ${verified.length}개를 확인했고
          현재 발견된 오류가 없어요.
        </p>
      </div>
    `;
  }

  /* 정상 결과는 접어두기 */
  if (verified.length) {
    html += `
      <details class="fact-details">
        <summary>
          검증 상세보기 (${verified.length}개) ↓
        </summary>

        <div class="fact-details-list">
    `;

    verified.forEach(item => {
      html += `
        <div class="fact-detail-item">
          <div>
            <strong>✓ ${escapeHtml(item.claim || '')}</strong>
            <p>${escapeHtml(item.evidence || '')}</p>
          </div>

          ${
            item.source_url
              ? `<a href="${escapeHtml(item.source_url)}"
                    target="_blank"
                    rel="noopener noreferrer">
                   ${escapeHtml(item.source_name || '공식 출처')} ↗
                 </a>`
              : ''
          }
        </div>
      `;
    });

    html += `
        </div>
      </details>
    `;
  }

  resultsEl.innerHTML = html;

  box.classList.remove('hidden');
}

async function verifyFacts() {
  hideFactCheckError();

  const title =
    document.getElementById('writerTitle')?.value.trim() || '';

  const html =
    document.getElementById('writerHtml')?.value || '';

  if (!title) {
    alert('제목이 없어요.');
    return;
  }

  if (!html.trim()) {
    alert('먼저 AI 초안을 만들어 주세요.');
    return;
  }

  const box = document.getElementById('factCheckBox');
  box?.classList.remove('hidden');

  setFactCheckLoading(true);

  try {
    const response = await fetch('/api/verify', {
      method: 'POST',

      headers: {
        'Content-Type': 'application/json'
      },

      body: JSON.stringify({
        title,
        html,
        source_url: window.currentSourceUrl || '',
        source_name: window.currentSourceName || ''
      })
    });

    const data = await response.json().catch(() => ({}));

    if (!response.ok) {
      throw new Error(
        data.error ||
        `사실 검증 실패 (${response.status})`
      );
    }

    renderFactCheck(data);

    showToast('사실 검증이 끝났어요 🔍');

  } catch (error) {
    console.error(error);

    showFactCheckError(
      error.message ||
      '사실 검증 중 오류가 발생했어요.'
    );

  } finally {
    setFactCheckLoading(false);
  }
}

document
  .getElementById('verifyFactsBtn')
  ?.addEventListener(
    'click',
    verifyFacts
  );

async function fixVerifiedFacts() {
  if (!lastFactCheckResult) {
    alert('먼저 사실 검증을 해주세요.');
    return;
  }

  const title =
    document.getElementById('writerTitle')?.value.trim() || '';

  const html =
    document.getElementById('writerHtml')?.value || '';

  const btn = document.getElementById('fixFactsBtn');

  if (!html.trim()) {
    alert('수정할 글이 없어요.');
    return;
  }

  if (btn) {
    btn.disabled = true;
    btn.textContent = '✨ 수정하고 있어요...';
  }

  try {
    const response = await fetch('/api/fix', {
      method: 'POST',

      headers: {
        'Content-Type': 'application/json'
      },

      body: JSON.stringify({
        title,
        html,
        verification: lastFactCheckResult,
        source_url: window.currentSourceUrl || '',
        source_name: window.currentSourceName || ''
      })
    });

    const data = await response.json().catch(() => ({}));

    if (!response.ok) {
      throw new Error(
        data.error ||
        `수정 요청 실패 (${response.status})`
      );
    }

    if (!data.html) {
      throw new Error('수정된 글을 받지 못했어요.');
    }

    /* 수정된 HTML로 교체 */
    document.getElementById('writerHtml').value = data.html;

    /* 기존 검증 결과는 더 이상 유효하지 않음 */
    lastFactCheckResult = null;

    document
      .getElementById('factCheckBox')
      ?.classList.add('hidden');

    document
      .getElementById('factFixActions')
      ?.classList.add('hidden');

    showToast('검증 결과를 반영해서 수정했어요 ✨');

  } catch (error) {
    console.error(error);

    showFactCheckError(
      error.message ||
      '글을 수정하는 중 오류가 발생했어요.'
    );

  } finally {
    if (btn) {
      btn.disabled = false;
      btn.textContent = '✨ 검증 결과 반영해서 수정';
    }
  }
}


document
  .getElementById('fixFactsBtn')
  ?.addEventListener(
    'click',
    fixVerifiedFacts
  );
