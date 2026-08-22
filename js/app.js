// ══════════════════════════════════════════════════════
// ANVIKSHIKI NEXUS — Application Logic
// Theme toggle, navigation, modals, forms, publications engine
// ══════════════════════════════════════════════════════

  // ══════════════════════════════════════════════════════
  // § ANALYTICS READINESS — no third-party network calls added
  // ══════════════════════════════════════════════════════
  window.ANX_ANALYTICS = { queue: [] };
  function trackEvent(name, data){
    window.ANX_ANALYTICS.queue.push({ name: name, data: data || {}, t: Date.now() });
    // Future: wire this queue to a real analytics provider (e.g. GA4/Plausible) once approved.
  }

  // ══════════════════════════════════════════════════════
  // § GLOBAL — Theme, Nav, Scroll Reveal, Mobile Menu
  // ══════════════════════════════════════════════════════

  function toggleTheme(){
    var html=document.documentElement;
    var knob=document.getElementById('tknob');
    var btn=document.getElementById('themeToggleBtn');
    var dark=html.getAttribute('data-theme')==='dark';
    html.setAttribute('data-theme',dark?'light':'dark');
    knob.textContent=dark?'☀️':'🌙';
    if(btn) btn.setAttribute('aria-pressed', dark?'false':'true');
    localStorage.setItem('anx-theme',dark?'light':'dark');
  }
  var saved=localStorage.getItem('anx-theme');
  if(saved==='dark'){
    document.documentElement.setAttribute('data-theme','dark');
    document.getElementById('tknob').textContent='🌙';
  }

  function toggleMob(){
    var open = document.getElementById('mobMenu').classList.toggle('open');
    var btn = document.getElementById('hamburgerBtn');
    if(btn) btn.setAttribute('aria-expanded', open ? 'true' : 'false');
  }
  function closeMob(){
    document.getElementById('mobMenu').classList.remove('open');
    var btn = document.getElementById('hamburgerBtn');
    if(btn) btn.setAttribute('aria-expanded', 'false');
  }

  // ══════════════════════════════════════════════════════
  // § PRIVACY / TERMS MODALS
  // ══════════════════════════════════════════════════════
  function openPrivacyModal(){ document.getElementById('privacyModalOverlay').classList.add('open'); }
  function closePrivacyModal(){ document.getElementById('privacyModalOverlay').classList.remove('open'); }
  function openTermsModal(){ document.getElementById('termsModalOverlay').classList.add('open'); }
  function closeTermsModal(){ document.getElementById('termsModalOverlay').classList.remove('open'); }
  document.addEventListener('keydown', function(e){
    if(e.key === 'Escape'){
      closeModal();
      closePrivacyModal();
      closeTermsModal();
    }
  });

  // ══════════════════════════════════════════════════════
  // § COMMUNITY — Stay Connected signup (Web3Forms, same pattern as existing forms)
  // ══════════════════════════════════════════════════════
  function submitCommunitySignup(e){
    e.preventDefault();
    var email = document.getElementById('communityEmail').value;
    if(!email || email.indexOf('@') === -1){ return; }
    fetch('https://api.web3forms.com/submit', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
      body: JSON.stringify({
        access_key: '28662f6e-07fd-42ec-a60a-019a72e9db2d',
        subject: 'New Community Sign-up — Anvikshiki Nexus',
        from_name: 'Anvikshiki Nexus Website',
        email: email,
        message: 'New community/updates sign-up: ' + email
      })
    }).then(function(){
      trackEvent('community_signup');
      showToast();
      document.getElementById('communityForm').reset();
    }).catch(function(){
      window.location.href = 'mailto:contact.anvikshikinexus@gmail.com?subject=Community Sign-up&body=Please add ' + encodeURIComponent(email) + ' to updates.';
    });
  }


  // ══════════════════════════════════════════════════════
  // § CONTACT — Tab Switcher
  // ══════════════════════════════════════════════════════
  function switchTab(tab){
    // Panels
    document.getElementById('panelConsultation').classList.toggle('active', tab==='consultation');
    document.getElementById('panelPublication').classList.toggle('active', tab==='publication');
    // Tabs
    document.getElementById('tabConsult').classList.toggle('active', tab==='consultation');
    document.getElementById('tabPub').classList.toggle('active', tab==='publication');
  }

  // ══════════════════════════════════════════════════════
  // § PUBLICATIONS ENGINE — Cards, Modal, Storage
  // ══════════════════════════════════════════════════════

  var publications = JSON.parse(localStorage.getItem('anx-pubs') || '[]').map(normalizePublication);
  var currentFilter = 'all';
  var currentType = 'blog';
  var currentRole = 'owner';
  var currentCite = 'bluebook';
  var pendingFile = null;

  var REVIEW_EMAIL = 'publication.anvikshikinexus@outlook.in'; // editorial review inbox // ← publication review inbox

  // § MEMBERSHIP READINESS (scaffold only — no restriction is active today)
  // Every publication object below could later carry a `tier: 'public'|'member'` field;
  // renderPubs() would then filter by an authenticated session before rendering member-only cards.
  // All current publications remain fully public.

    // ══════════════════════════════════════════════════════
  // § MODULE 1 — Publication Schema: Storage Model / Runtime View
  //
  //   Storage Model (canonical nested, persisted to localStorage)
  //        │  normalizePublication()   ← accepts legacy flat OR nested
  //        ▼
  //   Runtime View Model (flat, identical field names to pre-Module-1
  //   code — every consumer (renderCard, buildCitation, search/filter,
  //   downloadPub, deletePub, sendReviewEmail) works without change)
  //        │
  //        ▼
  //   Rendering / Search / Filtering / Download / Deletion / Citation
  //        │  toStorageModel()         ← called only by savePubs()
  //        ▼
  //   Persistence (localStorage key: anx-pubs)
  //
  // PUBLICATION_STATUS enumerates the complete future editorial
  // workflow. Only SUBMITTED and PUBLISHED are produced by today's UI.
  // The remaining states allow editorial/peer-review tooling to be
  // introduced later without any schema change.
  //
  // No shared references exist between the runtime view and the storage
  // model — normalizePublication() builds a new flat object; toStorageModel()
  // builds a new nested object. Mutating either does not affect the other.
  // ══════════════════════════════════════════════════════

  var PUBLICATION_STATUS = {
    SUBMITTED:          'submitted',
    EDITORIAL_REVIEW:   'editorial_review',
    PEER_REVIEW:        'peer_review',
    REVISION_REQUESTED: 'revision_requested',
    ACCEPTED:           'accepted',
    PUBLISHED:          'published',
    ARCHIVED:           'archived'
  };

  var SCHEMA_VERSION = 2;

  // ── Helpers ─────────────────────────────────────────────────────────
  function slugify(str){
    return String(str||'').toLowerCase().trim()
      .replace(/[^a-z0-9\s-]/g,'')
      .replace(/\s+/g,'-')
      .replace(/-+/g,'-')
      .replace(/^-|-$/g,'');
  }

  function estimateReadingTime(text){
    var words = String(text||'').trim().split(/\s+/).filter(Boolean).length;
    var mins  = Math.max(1, Math.ceil(words / 200));
    return mins + ' min read';
  }

  // ── Storage Model → Runtime View ─────────────────────────────────────
  // Accepts either a legacy flat object or a nested storage object and
  // always returns the canonical flat runtime view used by all consumers.
  function normalizePublication(raw){
    raw      = raw || {};
    var isNested = !!raw.article;
    var pubG  = isNested ? (raw.publication || {}) : {};
    var artG  = isNested ? (raw.article      || {}) : {};
    var authG = isNested ? (raw.author       || {}) : {};
    var citeG = isNested ? (raw.citation     || {}) : {};
    var mediaG= isNested ? (raw.media        || {}) : {};
    var seoG  = isNested ? (raw.seo          || {}) : {};
    var flat  = isNested ? {} : raw;

    function pick(nestedVal, flatVal){ return isNested ? nestedVal : flatVal; }

    var id    = pick(pubG.id,          flat.id)    || Date.now().toString();
    var title = pick(artG.title,       flat.title) || '';
    var desc  = pick(artG.abstract,    flat.desc)  || '';
    var type  = pick(artG.type,        flat.type)  || 'other';
    var isExt = !!pick(pubG.isExternal, flat.isExternal);
    var cDate = pick(pubG.createdDate, flat.date)  || new Date().toISOString();

    var tags  = pick(artG.tags,        flat.tags)  || [];
    if(!Array.isArray(tags)) tags = [];

    return {
      // Identity & workflow
      id:              id,
      status:          pick(pubG.status,         flat.status) ||
                       (isExt ? PUBLICATION_STATUS.SUBMITTED : PUBLICATION_STATUS.PUBLISHED),
      schemaVersion:   SCHEMA_VERSION,
      isExternal:      isExt,
      submitterEmail:  pick(pubG.submitterEmail,  flat.submitterEmail) || '',
      date:            cDate,
      updatedDate:     pick(pubG.updatedDate,     flat.updatedDate)    || cDate,
      featured:        !!pick(pubG.featured,      flat.featured),

      // Article metadata
      type:            type,
      category:        pick(artG.category,        flat.category)       || type,
      title:           title,
      subtitle:        pick(artG.subtitle,        flat.subtitle)       || '',
      slug:            pick(artG.slug,            flat.slug)           || slugify(title) || ('publication-' + id),
      desc:            desc,
      content:         pick(artG.content,         flat.content)        || '',
      keywords:        pick(artG.keywords,        flat.keywords)       || tags,
      tags:            tags,
      readingTime:     pick(artG.readingTime,     flat.readingTime)    || estimateReadingTime(desc),
      wordRange:       pick(artG.wordRange,       flat.wordRange)      || '',

      // Author
      author:          pick(authG.name,           flat.author)         || '',
      institution:     pick(authG.institution,    flat.institution)    || '',
      authorRole:      pick(authG.role,           flat.authorRole)     || '',
      year:            pick(authG.year,           flat.year)           || '',
      orcid:           pick(authG.orcid,          flat.orcid)          || '',

      // Citation
      citationStd:     pick(citeG.style,          flat.citationStd)   || 'Bluebook',
      citation:        pick(citeG.text,           flat.citation)       || '',
      journal:         pick(citeG.journal,        flat.journal)        || '',
      volume:          pick(citeG.volume,         flat.volume)         || '',
      pages:           pick(citeG.pages,          flat.pages)          || '',
      doi:             pick(citeG.doi,            flat.doi)            || '',
      references:      pick(citeG.references,     flat.references)     || [],
      citations:       pick(citeG.citations,      flat.citations)      || [],

      // Media
      filename:        pick(mediaG.filename,      flat.filename)       || '',
      fileData:        pick(mediaG.fileData,      flat.fileData)       || '',
      coverImage:      pick(mediaG.coverImage,    flat.coverImage)     || '',

      // SEO
      seoTitle:        pick(seoG.title,           flat.seoTitle)       || title,
      seoDescription:  pick(seoG.description,     flat.seoDescription) || desc.substring(0, 160)
    };
  }

  // ── Runtime View → Storage Model ────────────────────────────────────
  // Called exclusively by savePubs(). Builds a fresh nested object every
  // time — no references to the runtime view are retained.
  function toStorageModel(p){
    p = p || {};
    return {
      publication: {
        id:            p.id,
        status:        p.status,
        schemaVersion: SCHEMA_VERSION,
        isExternal:    p.isExternal,
        submitterEmail:p.submitterEmail,
        createdDate:   p.date,
        updatedDate:   p.updatedDate,
        featured:      p.featured
      },
      article: {
        type:        p.type,        category:    p.category,
        title:       p.title,       subtitle:    p.subtitle,
        slug:        p.slug,        abstract:    p.desc,
        content:     p.content,     keywords:    p.keywords,
        tags:        p.tags,        readingTime: p.readingTime,
        wordRange:   p.wordRange
      },
      author: {
        name:        p.author,      institution: p.institution,
        role:        p.authorRole,  year:        p.year,
        orcid:       p.orcid
      },
      citation: {
        style:       p.citationStd, text:        p.citation,
        journal:     p.journal,     volume:      p.volume,
        pages:       p.pages,       doi:         p.doi,
        references:  p.references,  citations:   p.citations
      },
      media: {
        filename:    p.filename,    fileData:    p.fileData,
        coverImage:  p.coverImage
      },
      seo: {
        title:       p.seoTitle,    description: p.seoDescription
      }
    };
  }

  var TYPE_META = {
    blog:     { label:'Blog Post',      wc:'1,500 – 2,500 words',   color:'#3b82f6' },
    journal:  { label:'Journal Article',wc:'4,000 – 6,000 words',   color:'#10b981' },
    research: { label:'Research Paper', wc:'6,000 – 8,000 words',   color:'#a855f7' },
    legal:    { label:'Legal Analysis', wc:'8,000 – 15,000 words',  color:'#ef4444' },
    case:     { label:'Case Comment',   wc:'2,000 – 3,000 words',   color:'#f59e0b' },
    other:    { label:'Other',          wc:'As accordingly',         color:'#6b7280' }
  };

  function savePubs(){ localStorage.setItem('anx-pubs', JSON.stringify(publications.map(toStorageModel))); }

  function setFilter(f, btn){
    currentFilter = f;
    document.querySelectorAll('.f-pill').forEach(function(p){ p.classList.remove('active'); });
    btn.classList.add('active');
    renderPubs();
  }

  function renderPubs(){
    var q = (document.getElementById('pubSearch').value || '').toLowerCase().trim();
    var list = publications.filter(function(p){
      var matchType = currentFilter === 'all' || p.type === currentFilter;
      var matchQ = !q ||
        (p.title||'').toLowerCase().includes(q) ||
        (p.author||'').toLowerCase().includes(q) ||
        (p.desc||'').toLowerCase().includes(q) ||
        (p.tags||[]).join(' ').toLowerCase().includes(q) ||
        (p.journal||'').toLowerCase().includes(q);
      return matchType && matchQ;
    });
    var grid = document.getElementById('pubGrid');
    var countEl = document.getElementById('pubCount');
    countEl.innerHTML = '<span>' + list.length + '</span> publication' + (list.length !== 1 ? 's' : '');
    if(list.length === 0){
      grid.innerHTML = '<div class="pub-empty"><span class="pub-empty-icon">📭</span><p>' +
        (publications.length === 0 ? 'No publications yet — upload your first one above' : 'No results match your search') +
        '</p></div>';
      return;
    }
    grid.innerHTML = '<div class="pub-grid">' + list.map(function(p){ return renderCard(p); }).join('') + '</div>';
  }

  function renderCard(p){
    var meta = TYPE_META[p.type] || TYPE_META.other;
    var dateStr = new Date(p.date).toLocaleDateString('en-IN',{day:'numeric',month:'short',year:'numeric'});
    var tagsHtml = (p.tags||[]).map(function(t){ return '<span class="pub-tag">'+esc(t.trim())+'</span>'; }).join('');
    var metaItems = [];
    if(p.wordRange) metaItems.push('📏 '+esc(p.wordRange));
    if(p.journal) metaItems.push('📰 '+esc(p.journal));
    if(p.volume) metaItems.push('📖 '+esc(p.volume));
    if(p.pages) metaItems.push('🔖 '+esc(p.pages));
    var metaHtml = metaItems.map(function(m){ return '<span class="pub-meta">'+m+'</span>'; }).join('');
    var citeHtml = '';
    if(p.citation){
      citeHtml = '<div class="pub-citation-box">' +
        '<span class="pub-citation-label">'+esc(p.citationStd||'Citation')+'</span>' +
        '<button class="copy-cite-btn" onclick="copyCite(event,\''+p.id+'\')">Copy</button>' +
        '<span id="cite-'+p.id+'">'+esc(p.citation)+'</span>' +
        '</div>';
    }
    var externalBadge = p.isExternal ? '<span class="review-badge">⏳ Under Review</span>' : '';
    return '<div class="pub-card" id="pc-'+p.id+'">' +
      '<div class="pub-card-top">' +
        '<div class="pub-type-row">' +
          '<span class="pub-badge '+p.type+'">'+meta.label+'</span>' +
          '<span class="pub-date">'+dateStr+'</span>' +
        '</div>' +
        (externalBadge ? '<div style="margin-bottom:.5rem">'+externalBadge+'</div>' : '') +
        '<h3>'+esc(p.title)+'</h3>' +
        (p.author ? '<div class="pub-author">'+esc(p.author)+(p.institution?' — '+esc(p.institution):'')+(p.year?', '+esc(p.year):'')+'</div>' : '') +
        (p.desc ? '<p class="pub-desc">'+esc(p.desc)+'</p>' : '') +
        (metaHtml ? '<div class="pub-meta-row">'+metaHtml+'</div>' : '') +
        (tagsHtml ? '<div class="pub-tags">'+tagsHtml+'</div>' : '') +
        citeHtml +
      '</div>' +
      '<div class="pub-card-foot">' +
        '<span class="pub-filename">'+(p.filename ? '📎 '+esc(p.filename) : '')+'</span>' +
        '<div class="pub-actions">' +
          (p.fileData ? '<button class="pub-btn" onclick="downloadPub(\''+p.id+'\')">↓ Download</button>' : '') +
          (!p.isExternal ? '<button class="pub-btn del" onclick="deletePub(\''+p.id+'\')">✕ Remove</button>' : '') +
        '</div>' +
      '</div>' +
    '</div>';
  }

  function esc(s){ return String(s||'').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;'); }

  function copyCite(e, id){
    e.stopPropagation();
    var el = document.getElementById('cite-'+id);
    if(!el) return;
    navigator.clipboard.writeText(el.textContent).then(function(){
      showToast('✓ Citation copied to clipboard');
    }).catch(function(){
      showToast('Citation: '+el.textContent.substring(0,60)+'…');
    });
  }

  // ── MODAL ──
  function openModal(){
    document.getElementById('modalOverlay').classList.add('open');
    resetModal();
  }
  function closeModal(){ document.getElementById('modalOverlay').classList.remove('open'); }
  function closeModalOutside(e){ if(e.target===document.getElementById('modalOverlay')) closeModal(); }

  function resetModal(){
    ['mTitle','mAuthor','mInstitution','mYear','mDesc','mTags','mJournal','mVolume','mPages','mDoi','mExtEmail'].forEach(function(id){
      var el = document.getElementById(id);
      if(el){ el.value=''; el.style.borderColor=''; }
    });
    document.getElementById('modalFileName').textContent='';
    document.getElementById('charN').textContent='0';
    document.getElementById('progWrap').classList.remove('show');
    document.getElementById('citeText').textContent='Fill in the fields above to generate citation…';
    document.getElementById('citeText').style.fontStyle='italic';
    document.getElementById('extEmailGroup').style.display='none';
    document.getElementById('modalSaveBtn').textContent='Publish →';
    pendingFile = null;
    currentType = 'blog';
    currentRole = 'owner';
    currentCite = 'bluebook';
    resetBtns('#typeRow .type-opt', 0);
    resetBtns('#roleRow .type-opt', 0);
    resetBtns('#citeRow .type-opt', 0);
    updateWcHint();
    updateRoleUI();
  }

  function resetBtns(sel, activeIdx){
    var btns = document.querySelectorAll(sel);
    btns.forEach(function(b,i){ b.classList.toggle('sel', i===activeIdx); });
  }

  function selectType(t, btn){
    currentType = t;
    document.querySelectorAll('#typeRow .type-opt').forEach(function(b){ b.classList.remove('sel'); });
    btn.classList.add('sel');
    updateWcHint();
    updateCitePreview();
  }

  function selectRole(r, btn){
    currentRole = r;
    document.querySelectorAll('#roleRow .type-opt').forEach(function(b){ b.classList.remove('sel'); });
    btn.classList.add('sel');
    updateRoleUI();
  }

  function updateRoleUI(){
    var ext = currentRole === 'external';
    document.getElementById('extEmailGroup').style.display = ext ? 'block' : 'none';
    document.getElementById('modalSaveBtn').textContent = ext ? 'Send for Review →' : 'Publish →';
    document.getElementById('modalHeading').textContent = ext ? 'Submit for Review' : 'Add Publication';
    var notice = document.getElementById('roleNotice');
    if(notice){
      notice.innerHTML = ext
        ? '<div class="info-note" style="margin:.6rem 0">As an External Contributor, your submission is reviewed before publication. By submitting, you retain authorship; Anvikshiki Nexus requests a non-exclusive license to review and, if accepted, publish your work with attribution.</div>'
        : '';
    }
  }

  function selectCite(c, btn){
    currentCite = c;
    document.querySelectorAll('#citeRow .type-opt').forEach(function(b){ b.classList.remove('sel'); });
    btn.classList.add('sel');
    updateCitePreview();
  }

  function updateWcHint(){
    var meta = TYPE_META[currentType]||TYPE_META.other;
    document.getElementById('wcHint').textContent = 'Word count: '+meta.wc;
  }

  function updateChar(){
    var v = (document.getElementById('mDesc').value||'').length;
    document.getElementById('charN').textContent = v;
    updateCitePreview();
  }

  // Live citation generation
  ['mTitle','mAuthor','mInstitution','mYear','mJournal','mVolume','mPages','mDoi'].forEach(function(id){
    var el = document.getElementById(id);
    if(el) el.addEventListener('input', updateCitePreview);
  });

  function updateCitePreview(){
    var title     = (document.getElementById('mTitle').value||'').trim();
    var author    = (document.getElementById('mAuthor').value||'').trim();
    var inst      = (document.getElementById('mInstitution').value||'').trim();
    var year      = (document.getElementById('mYear').value||'').trim();
    var journal   = (document.getElementById('mJournal').value||'').trim();
    var volume    = (document.getElementById('mVolume').value||'').trim();
    var pages     = (document.getElementById('mPages').value||'').trim();
    var doi       = (document.getElementById('mDoi').value||'').trim();
    var el        = document.getElementById('citeText');

    if(!title && !author){ el.textContent='Fill in the fields above to generate citation…'; el.style.fontStyle='italic'; return; }
    el.style.fontStyle='normal';

    var y = year || new Date().getFullYear();
    var authorFmt = author || 'Author';
    var titleFmt  = title  || 'Title';
    var cite = '';

    if(currentCite === 'bluebook'){
      // Bluebook 21st ed. — journal article: Author, Title, Vol Journal Pages (Year).
      if(journal){
        var vol = volume ? volume+' ' : '';
        var pg  = pages  ? ' '+pages  : '';
        cite = authorFmt+', '+titleFmt+', '+vol+(journal||'')+(pg ? pg+'' : '')+' ('+y+').';
      } else {
        cite = authorFmt+', '+titleFmt+' ('+y+').';
      }
    } else if(currentCite === 'oscola'){
      // OSCOLA: Author, 'Title' (Year) Vol Journal Pages
      if(journal){
        var vol2 = volume ? ' ('+y+') '+volume+' ' : ' ['+y+'] ';
        cite = authorFmt+", '"+titleFmt+"'"+vol2+(journal||'')+(pages?' '+pages:'')+(doi?' <'+doi+'>' : '')+'.';
      } else {
        cite = authorFmt+", '"+titleFmt+"' ("+y+').';
      }
    } else if(currentCite === 'apa'){
      // APA 7th: Author, A. A. (Year). Title. Journal Name, Vol(Issue), Pages. DOI
      var lastFirst = author ? author.split(' ').reverse().join(', ') : 'Author, A. A.';
      var volIssue = volume || '';
      cite = lastFirst+'. ('+y+'). '+titleFmt+'.'+(journal?' '+journal+','+(volIssue?' '+volIssue+',':''): '')+(pages?' '+pages+'.':'')+(doi?' https://doi.org/'+doi.replace('https://doi.org/','') : '');
    } else if(currentCite === 'mla'){
      // MLA 9th: Author. "Title." Journal, vol., no., Year, pp. Pages.
      cite = authorFmt+'. "'+titleFmt+'."'+(journal?' '+journal+','+(volume?' '+volume+',':''): '')+' '+y+(pages?', pp. '+pages : '')+'.';
    } else if(currentCite === 'ilt'){
      // Indian Law — ILT / SCC style: Author, 'Title' (Year) Institution/Journal Pages
      if(journal){
        cite = authorFmt+", '"+titleFmt+"' ("+y+') '+journal+(volume?' '+volume:'')+(pages?', '+pages:'')+(inst?' ('+inst+')':'')+'.';
      } else {
        cite = authorFmt+", '"+titleFmt+"' ("+y+')'+(inst?', '+inst:'')+'.';
      }
    }
    el.textContent = cite;
  }

  function buildCitation(p){
    var y = p.year || new Date().getFullYear();
    var cite = '';
    var std = p.citationStd || 'Bluebook';
    var au = p.author||'Author', ti = p.title||'', jo = p.journal||'', vo = p.volume||'', pg = p.pages||'';

    if(std==='Bluebook'){
      cite = jo ? au+', '+ti+', '+(vo?vo+' ':'')+jo+(pg?' '+pg:'')+' ('+y+').' : au+', '+ti+' ('+y+').';
    } else if(std==='OSCOLA'){
      cite = jo ? au+", '"+ti+"' "+(y ? '('+y+') ' : '')+(vo?vo+' ':'')+jo+(pg?' '+pg:'')+'.' : au+", '"+ti+"' ("+y+').';
    } else if(std==='APA 7th'){
      var lf = au.split(' ').reverse().join(', ');
      cite = lf+'. ('+y+'). '+ti+'.'+(jo?' '+jo+','+(vo?' '+vo+',':''): '')+(pg?' '+pg+'.':'');
    } else if(std==='MLA 9th'){
      cite = au+'. "'+ti+'."'+(jo?' '+jo+','+(vo?' '+vo+',':''): '')+' '+y+(pg?', pp. '+pg:'')+'.';
    } else if(std==='Indian Law (ILT)'){
      cite = jo ? au+", '"+ti+"' ("+y+') '+jo+(vo?' '+vo:'')+(pg?', '+pg:'')+'.' : au+", '"+ti+"' ("+y+').';
    }
    return cite;
  }

  function handleModalFile(input){
    var f = input.files[0];
    if(!f) return;
    document.getElementById('modalFileName').textContent = f.name;
    var wrap = document.getElementById('progWrap'), bar = document.getElementById('progBar');
    wrap.classList.add('show'); bar.style.width='0%';
    var r = new FileReader();
    r.onprogress = function(e){ if(e.lengthComputable) bar.style.width=Math.round(e.loaded/e.total*100)+'%'; };
    r.onload = function(e){ bar.style.width='100%'; pendingFile={name:f.name,data:e.target.result}; };
    r.readAsDataURL(f);
  }

  function handleMainDrop(files){
    if(!files||!files.length) return;
    openModal();
    setTimeout(function(){
      var f = files[0];
      if(!f) return;
      document.getElementById('modalFileName').textContent=f.name;
      var r = new FileReader();
      r.onload = function(e){ pendingFile={name:f.name,data:e.target.result}; };
      r.readAsDataURL(f);
    },150);
  }

  function savePublication(){
    var title  = (document.getElementById('mTitle').value||'').trim();
    var author = (document.getElementById('mAuthor').value||'').trim();
    var desc   = (document.getElementById('mDesc').value||'').trim();

    // Validation
    var valid = true;
    [['mTitle',title],['mAuthor',author]].forEach(function(pair){
      if(!pair[1]){
        document.getElementById(pair[0]).style.borderColor='#ef4444';
        document.getElementById(pair[0]).focus();
        valid=false;
      }
    });
    if(!valid) return;

    var originalChk = document.getElementById('mOriginal');
    if(originalChk && !originalChk.checked){
      alert('Please confirm this submission is your own original work before continuing.');
      return;
    }
    if(currentRole === 'external'){
      var agreeChk = document.getElementById('mContributorAgree');
      if(agreeChk && !agreeChk.checked){
        alert('Please confirm the contributor license agreement before submitting for review.');
        return;
      }
    }

    var citeStdMap = {bluebook:'Bluebook', oscola:'OSCOLA', apa:'APA 7th', mla:'MLA 9th', ilt:'Indian Law (ILT)'};
    var stdLabel = citeStdMap[currentCite]||'Bluebook';
    var meta = TYPE_META[currentType]||TYPE_META.other;
    var tags = (document.getElementById('mTags').value||'').split(',').map(function(t){return t.trim();}).filter(Boolean);

    var pub = {
      id: Date.now().toString(),
      type: currentType,
      title: title,
      author: author,
      institution: (document.getElementById('mInstitution').value||'').trim(),
      year: (document.getElementById('mYear').value||'').trim(),
      desc: desc,
      tags: tags,
      journal: (document.getElementById('mJournal').value||'').trim(),
      volume: (document.getElementById('mVolume').value||'').trim(),
      pages: (document.getElementById('mPages').value||'').trim(),
      doi: (document.getElementById('mDoi').value||'').trim(),
      citationStd: stdLabel,
      wordRange: meta.wc,
      date: new Date().toISOString(),
      filename: pendingFile ? pendingFile.name : '',
      fileData: pendingFile ? pendingFile.data : '',
      isExternal: currentRole === 'external'
    };
    pub.citation = buildCitation(pub);

    if(currentRole === 'external'){
      var extEmail = (document.getElementById('mExtEmail').value||'').trim();
      if(!extEmail || !extEmail.includes('@')){
        document.getElementById('mExtEmail').style.borderColor='#ef4444';
        document.getElementById('mExtEmail').focus();
        return;
      }
      pub.submitterEmail = extEmail;
      sendReviewEmail(pub);
      publications.unshift(normalizePublication(pub));
      savePubs(); closeModal(); renderPubs();
      showToast('✓ Submission sent for editorial review');
      trackEvent('publication_submitted_external');
      return;
    }

    publications.unshift(normalizePublication(pub));
    savePubs(); closeModal(); renderPubs();
    showToast('✓ Publication added successfully');
    trackEvent('publication_added_owner');
  }

  function sendReviewEmail(pub){
    var meta = TYPE_META[pub.type]||TYPE_META.other;
    var subject = encodeURIComponent('[Review Submission] '+pub.type.toUpperCase()+': '+pub.title);
    var body = encodeURIComponent(
      'ANVIKSHIKI NEXUS — EXTERNAL SUBMISSION FOR REVIEW\n\n'+
      '─────────────────────────────────────────\n'+
      'Type          : '+meta.label+'\n'+
      'Title         : '+pub.title+'\n'+
      'Author        : '+pub.author+'\n'+
      (pub.institution ? 'Institution   : '+pub.institution+'\n' : '')+
      (pub.year        ? 'Year          : '+pub.year+'\n'        : '')+
      (pub.journal     ? 'Journal       : '+pub.journal+'\n'     : '')+
      (pub.volume      ? 'Volume/Issue  : '+pub.volume+'\n'      : '')+
      (pub.pages       ? 'Pages         : '+pub.pages+'\n'       : '')+
      (pub.doi         ? 'DOI/URL       : '+pub.doi+'\n'         : '')+
      'Citation Std  : '+pub.citationStd+'\n'+
      'Word Range    : '+meta.wc+'\n'+
      '─────────────────────────────────────────\n'+
      'ABSTRACT:\n'+(pub.desc||'(none)')+'\n\n'+
      'KEYWORDS: '+(pub.tags.join(', ')||'(none)')+'\n\n'+
      'AUTO-CITATION:\n'+pub.citation+'\n\n'+
      '─────────────────────────────────────────\n'+
      'Submitter Email : '+pub.submitterEmail+'\n'+
      'Submitted on    : '+new Date().toLocaleString('en-IN')+'\n'+
      (pub.filename ? 'Attached File   : '+pub.filename+'\n' : '')+
      '─────────────────────────────────────────\n'+
      'Please review the submission and respond to the submitter at: '+pub.submitterEmail
    );
    var mailtoLink = 'mailto:'+REVIEW_EMAIL+'?subject='+subject+'&body='+body;
    var a = document.createElement('a');
    a.href = mailtoLink;
    document.body.appendChild(a); a.click(); document.body.removeChild(a);
  }

  function downloadPub(id){
    var p = publications.find(function(x){ return x.id===id; });
    if(!p||!p.fileData) return;
    var a = document.createElement('a');
    a.href=p.fileData; a.download=p.filename||'publication';
    document.body.appendChild(a); a.click(); document.body.removeChild(a);
  }

  function deletePub(id){
    if(!confirm('Remove this publication?')) return;
    publications = publications.filter(function(p){ return p.id!==id; });
    savePubs(); renderPubs();
    showToast('Publication removed');
  }

  // Drag events on main drop zone
  var mz = document.getElementById('mainDropZone');
  if(mz){
    mz.addEventListener('dragover',function(e){e.preventDefault();mz.classList.add('drag');});
    mz.addEventListener('dragleave',function(){mz.classList.remove('drag');});
    mz.addEventListener('drop',function(e){e.preventDefault();mz.classList.remove('drag');handleMainDrop(e.dataTransfer.files);});
  }
  var md2 = document.getElementById('modalDrop');
  if(md2){
    md2.addEventListener('dragover',function(e){e.preventDefault();md2.classList.add('drag');});
    md2.addEventListener('dragleave',function(){md2.classList.remove('drag');});
    md2.addEventListener('drop',function(e){
      e.preventDefault();md2.classList.remove('drag');
      var f=e.dataTransfer.files[0];
      if(f){var dt=new DataTransfer();dt.items.add(f);document.getElementById('modalFile').files=dt.files;handleModalFile(document.getElementById('modalFile'));}
    });
  }

  function showToast(msg){
    var t=document.getElementById('toast');
    t.textContent=msg; t.classList.add('show');
    setTimeout(function(){t.classList.remove('show');},4200);
  }

  renderPubs();


  /* ════════════════════════════════════════
     CONTACT: Tab switcher
     ════════════════════════════════════════ */
  function switchContact(panel) {
    document.getElementById('panelConsultation').style.display = panel === 'consultation' ? 'block' : 'none';
    document.getElementById('panelPublication').style.display  = panel === 'publication'  ? 'block' : 'none';
    document.getElementById('tabConsult').classList.toggle('active', panel === 'consultation');
    document.getElementById('tabPub').classList.toggle('active',     panel === 'publication');
  }
  // Init: show consultation panel
  switchContact('consultation');

  /* ════════════════════════════════════════
     CONTACT FORM 1: Consultation
     Target: contact.anvikshikinexus@gmail.com
     via Web3Forms API
     ════════════════════════════════════════ */
  async function submitConsult(e) {
    e.preventDefault();
    var name = document.getElementById('cName').value.trim();
    var email = document.getElementById('cEmail').value.trim();
    var msg  = document.getElementById('cMsg').value.trim();
    // Validate required fields
    var ok = true;
    [['cName',name],['cEmail',email],['cMsg',msg]].forEach(function(p){
      if(!p[1]){ document.getElementById(p[0]).style.borderColor='#ef4444'; ok=false; }
      else { document.getElementById(p[0]).style.borderColor=''; }
    });
    if(!ok) return;
    if(!email.includes('@')){ document.getElementById('cEmail').style.borderColor='#ef4444'; return; }

    var btn = document.getElementById('consultBtn');
    var txt = document.getElementById('consultBtnTxt');
    btn.disabled = true; txt.textContent = 'Sending…';

    try {
      var formData = new FormData(document.getElementById('consultForm'));
      var response = await fetch('https://api.web3forms.com/submit', {
        method: 'POST',
        body: formData
      });
      var data = await response.json();
      if(data.success) {
        document.getElementById('consultForm').style.display = 'none';
        document.getElementById('consultSuccess').style.display = 'block';
        trackEvent('consultation_submitted');
      } else {
        showToast('⚠ Submission error — please try emailing us directly.');
        btn.disabled = false; txt.textContent = 'Send Inquiry →';
      }
    } catch(err) {
      showToast('⚠ Network error — please email contact.anvikshikinexus@gmail.com directly.');
      btn.disabled = false; txt.textContent = 'Send Inquiry →';
    }
  }

  /* ════════════════════════════════════════
     CONTACT FORM 2: Publication Submission
     Target: publication.anvikshikinexus@outlook.in
     via Web3Forms API
     ════════════════════════════════════════ */
  async function submitPublication(e) {
    e.preventDefault();
    var name  = document.getElementById('pName').value.trim();
    var email = document.getElementById('pEmail').value.trim();
    var title = document.getElementById('pTitle').value.trim();
    var msg   = document.getElementById('pMsg').value.trim();
    var ok = true;
    [['pName',name],['pEmail',email],['pTitle',title],['pMsg',msg]].forEach(function(p){
      if(!p[1]){ document.getElementById(p[0]).style.borderColor='#ef4444'; ok=false; }
      else { document.getElementById(p[0]).style.borderColor=''; }
    });
    if(!ok) return;
    if(!email.includes('@')){ document.getElementById('pEmail').style.borderColor='#ef4444'; return; }

    var btn = document.getElementById('pubBtn');
    var txt = document.getElementById('pubBtnTxt');
    btn.disabled = true; txt.textContent = 'Submitting…';

    try {
      var formData = new FormData(document.getElementById('pubForm'));
      var response = await fetch('https://api.web3forms.com/submit', {
        method: 'POST',
        body: formData
      });
      var data = await response.json();
      if(data.success) {
        document.getElementById('pubForm').style.display = 'none';
        document.getElementById('pubSuccess').style.display = 'block';
        trackEvent('publication_form_submitted');
      } else {
        showToast('⚠ Submission error — please try emailing us directly.');
        btn.disabled = false; txt.textContent = 'Submit for Review →';
      }
    } catch(err) {
      showToast('⚠ Network error — please email publication.anvikshikinexus@outlook.in directly.');
      btn.disabled = false; txt.textContent = 'Submit for Review →';
    }
  }

  /* ════════════════════════════════════════
     SERVICES: Tab switcher
     ════════════════════════════════════════ */
  function showSrv(id, btn) {
    document.querySelectorAll('.srv-panel').forEach(function(p){ p.classList.remove('active'); });
    document.querySelectorAll('.srv-tab').forEach(function(b){ b.classList.remove('active'); });
    var panel = document.getElementById('srv-'+id);
    if(panel) panel.classList.add('active');
    if(btn)   btn.classList.add('active');
  }
