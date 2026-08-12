const API_URL = "https://script.google.com/macros/s/AKfycbwCOyxrS93IRXDM-bKdmVeo2okUo_CudJx5GD0USHVZfy2JXOeLPEfOXdEMjvQpq89TPg/exec";

let ideas = [];
let activeCategory = '전체';
let draft = JSON.parse(localStorage.getItem('blogos_draft') || 'null');
let liveTopics = JSON.parse(localStorage.getItem('blogos_live_topics') || '[]');

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
  const count = Number(document.getElementById('topicCount').value) || 8;

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
  const html = document.getElementById('writerHtml')?.value || '';

  if (!html.trim()) {
    alert('복사할 글이 없어요.');
    return;
  }

  await navigator.clipboard.writeText(html);

  const btn = document.getElementById('copyHtmlBtn');
  const original = btn.textContent;

  btn.textContent = '✓ HTML 복사됨';

  setTimeout(() => {
    btn.textContent = original;
  }, 1500);
});
