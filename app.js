const API_URL = "https://script.google.com/macros/s/AKfycbwCOyxrS93IRXDM-bKdmVeo2okUo_CudJx5GD0USHVZfy2JXOeLPEfOXdEMjvQpq89TPg/exec";

let ideas = [];
let selectedIdea = null;
let activeCategory = '전체';
let draft = JSON.parse(localStorage.getItem('blogos_draft') || 'null');

const panels = {
  home: document.getElementById('homePanel'),
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
  Object.entries(panels).forEach(([key, panel]) => panel.classList.toggle('active', key === view));

  const showHomeExtras = view === 'home';
  document.getElementById('homeView').classList.toggle('hidden', !showHomeExtras);
  document.getElementById('statsView').classList.toggle('hidden', !showHomeExtras);

  document.querySelectorAll('.nav-item').forEach(btn => {
    const navView = (view === 'writer' || view === 'preview') ? 'content' : view;
    btn.classList.toggle('active', btn.dataset.view === navView);
  });

  if (view === 'content') renderDraft();
  window.scrollTo({ top: 0, behavior: 'smooth' });
}

function normalizeIdea(row, index) {
  return {
    id: index,
    category: String(row['카테고리'] || '기타').trim(),
    title: String(row['제목'] || '제목 없음').trim(),
    subtitle: String(row['서브제목'] || '').trim(),
    point: String(row['포인트'] || '').trim(),
    status: String(row['상태'] || '대기').trim(),
    priority: Number(row['우선순위']) || 99
  };
}

function ideaCard(item) {
  return `
    <article class="idea-card">
      <div class="idea-top">
        <div>
          <div class="tag-row">
            <span class="tag">${escapeHtml(item.category)}</span>
            <span class="tag">${escapeHtml(item.status)}</span>
          </div>
          <h4>${escapeHtml(item.title)}</h4>
          ${item.subtitle ? `<div class="subtitle">${escapeHtml(item.subtitle)}</div>` : ''}
        </div>
        <div class="priority">${item.priority === 99 ? '-' : item.priority}</div>
      </div>
      <p>${escapeHtml(item.point || '핵심 포인트가 아직 입력되지 않았어요.')}</p>
      <button class="small-btn primary" onclick="startWriting(${item.id})">작성하기</button>
    </article>
  `;
}

function escapeHtml(value) {
  return String(value)
    .replaceAll('&','&amp;')
    .replaceAll('<','&lt;')
    .replaceAll('>','&gt;')
    .replaceAll('"','&quot;')
    .replaceAll("'",'&#039;');
}

function renderIdeas() {
  const sorted = [...ideas].sort((a,b) => a.priority - b.priority || a.title.localeCompare(b.title, 'ko'));

  document.getElementById('ideaCount').textContent = ideas.length;
  document.getElementById('waitingCount').textContent = ideas.filter(i => i.status === '대기').length;
  document.getElementById('priorityCount').textContent = ideas.filter(i => i.priority === 1).length;

  document.getElementById('topIdeas').innerHTML =
    sorted.slice(0,3).map(ideaCard).join('') ||
    '<div class="empty-card">아직 오늘의 글감이 없어요.</div>';

  const filtered = activeCategory === '전체'
    ? sorted
    : sorted.filter(i => i.category === activeCategory);

  document.getElementById('allIdeas').innerHTML =
    filtered.map(ideaCard).join('') ||
    '<div class="empty-card">해당 카테고리의 글감이 없어요.</div>';

  renderCategoryFilters();
}

function renderCategoryFilters() {
  const cats = ['전체', ...new Set(ideas.map(i => i.category))];
  document.getElementById('categoryFilters').innerHTML = cats.map(cat => `
    <button class="filter-chip ${activeCategory === cat ? 'active' : ''}" onclick="setCategory('${encodeURIComponent(cat)}')">
      ${escapeHtml(cat)}
    </button>
  `).join('');
}

window.setCategory = function(encoded) {
  activeCategory = decodeURIComponent(encoded);
  renderIdeas();
}

window.startWriting = function(id) {
  selectedIdea = ideas.find(i => i.id === id);
  if (!selectedIdea) return;

  document.getElementById('writerCategory').value = selectedIdea.category;
  document.getElementById('writerTitle').value = selectedIdea.title;
  document.getElementById('writerPoint').value = selectedIdea.point;
  document.getElementById('writerHtml').value = '';
  showView('writer');
}

function getWriterDraft() {
  return {
    category: document.getElementById('writerCategory').value.trim(),
    title: document.getElementById('writerTitle').value.trim(),
    point: document.getElementById('writerPoint').value.trim(),
    html: document.getElementById('writerHtml').value
  };
}

function saveDraft() {
  draft = getWriterDraft();
  localStorage.setItem('blogos_draft', JSON.stringify(draft));
  showToast('초안을 저장했어요');
}

function renderPreview() {
  draft = getWriterDraft();
  localStorage.setItem('blogos_draft', JSON.stringify(draft));

  document.getElementById('previewCategory').textContent = draft.category || '기타';
  document.getElementById('previewTitle').textContent = draft.title || '제목 없음';
  document.getElementById('previewPoint').textContent = draft.point || '';
  document.getElementById('previewHtml').innerHTML = draft.html || '<p>HTML 본문이 아직 없어요.</p>';
}

function renderDraft() {
  const card = document.getElementById('draftCard');
  const empty = document.getElementById('draftEmpty');

  if (!draft) {
    card.innerHTML = '';
    empty.classList.remove('hidden');
    return;
  }

  empty.classList.add('hidden');
  card.innerHTML = `
    <article class="idea-card">
      <div class="tag-row"><span class="tag">${escapeHtml(draft.category || '기타')}</span></div>
      <h4>${escapeHtml(draft.title || '제목 없음')}</h4>
      <p>${escapeHtml(draft.point || '저장된 초안이 있어요.')}</p>
      <button class="small-btn primary" id="continueDraftBtn">계속 작성</button>
    </article>
  `;

  document.getElementById('continueDraftBtn').addEventListener('click', () => {
    selectedIdea = null;
    document.getElementById('writerCategory').value = draft.category || '';
    document.getElementById('writerTitle').value = draft.title || '';
    document.getElementById('writerPoint').value = draft.point || '';
    document.getElementById('writerHtml').value = draft.html || '';
    showView('writer');
  });
}

function setConnectionState(state) {
  const dot = document.getElementById('statusDot');
  const text = document.getElementById('systemStatusText');

  dot.classList.remove('good','bad');

  if (state === 'ok') {
    dot.classList.add('good');
    text.textContent = 'Google Sheets와 정상 연결됐어요';
  } else if (state === 'error') {
    dot.classList.add('bad');
    text.textContent = 'Google Sheets 연결을 확인해 주세요';
  } else {
    text.textContent = 'Google Sheets 연결 확인 중...';
  }
}

function setLoading(isLoading) {
  document.getElementById('homeLoading').classList.toggle('hidden', !isLoading);
  document.getElementById('ideasLoading').classList.toggle('hidden', !isLoading);
}

async function loadIdeas() {
  setLoading(true);
  setConnectionState('loading');

  try {
    const response = await fetch(API_URL, { cache: 'no-store', redirect: 'follow' });
    if (!response.ok) throw new Error(`HTTP ${response.status}`);

    const data = await response.json();
    ideas = (Array.isArray(data) ? data : [])
      .filter(row => Object.values(row).some(v => String(v ?? '').trim()))
      .map(normalizeIdea);

    renderIdeas();
    setConnectionState('ok');
    showToast(`글감 ${ideas.length}개를 불러왔어요`);
  } catch (error) {
    console.error(error);
    ideas = [];
    renderIdeas();
    setConnectionState('error');
    showToast('시트 연결을 확인해 주세요');
  } finally {
    setLoading(false);
  }
}

document.querySelectorAll('[data-view]').forEach(btn => {
  btn.addEventListener('click', () => showView(btn.dataset.view));
});

document.getElementById('refreshBtn').addEventListener('click', loadIdeas);
document.getElementById('saveDraftBtn').addEventListener('click', saveDraft);
document.getElementById('previewBtn').addEventListener('click', () => {
  renderPreview();
  showView('preview');
});

document.getElementById('themeBtn').addEventListener('click', () => {
  document.body.classList.toggle('light');
  localStorage.setItem('blogos_theme', document.body.classList.contains('light') ? 'light' : 'dark');
});

if (localStorage.getItem('blogos_theme') === 'light') {
  document.body.classList.add('light');
}

renderDraft();
loadIdeas();
