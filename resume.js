// ============================================================
//  Resume — background effects, reveal, nav, tweaks
// ============================================================

(() => {
  const root = document.documentElement;
  const body = document.body;

  // ----------------- tweak state -----------------
  function applyTweaks(t){
    root.style.setProperty('--static-opacity', String(t.staticIntensity));
    root.style.setProperty('--accent', t.accent);
    body.classList.toggle('no-scanlines', !t.scanlines);
    body.dataset.font = t.fontPair;
    // update tweaks panel UI if open
    syncTweaksUI(t);
  }
  function setTweak(patch){
    Object.assign(window.__TWEAKS, patch);
    applyTweaks(window.__TWEAKS);
    try{
      window.parent.postMessage({type:'__edit_mode_set_keys', edits: patch}, '*');
    }catch(e){}
  }

  // ----------------- static noise canvas -----------------
  const canvas = document.getElementById('static-canvas');
  const ctx = canvas.getContext('2d', { alpha: true });
  let W=0, H=0, buf=null, imgData=null;
  function sizeCanvas(){
    const scale = 0.55; // downscale for perf, then CSS upscales
    W = Math.max(2, Math.floor(window.innerWidth * scale));
    H = Math.max(2, Math.floor(window.innerHeight * scale));
    canvas.width = W; canvas.height = H;
    imgData = ctx.createImageData(W, H);
    buf = new Uint32Array(imgData.data.buffer);
  }
  sizeCanvas();
  window.addEventListener('resize', sizeCanvas);

  let rafId=0, frame=0;
  function renderNoise(){
    frame++;
    // render every other frame to save CPU
    if(frame % 2 === 0){
      const len = buf.length;
      for(let i=0;i<len;i++){
        const v = (Math.random()*255)|0;
        // alpha noise: random darkish or near-transparent
        const a = (Math.random()*200)|0;
        // AABBGGRR little-endian
        buf[i] = (a<<24) | (v<<16) | (v<<8) | v;
      }
      ctx.putImageData(imgData, 0, 0);
    }
    rafId = requestAnimationFrame(renderNoise);
  }
  renderNoise();

  // ----------------- drifting ascii icons -----------------
  (function seedDrift(){
    const layer = document.getElementById('drift-layer');
    const glyphs = [
      `┌────┐\n│ ░▒▓ │\n│ DAT │\n└─●●─┘`,
      `╔═══╗\n║ A ║\n║ ║ ║\n╚═══╝`,
      `[ ▣ ▣ ▣ ]\n ══════\n  IBM`,
      `/dev/null\n> _`,
      `█▓▒░\nTV-03`,
      `┌──┐\n│◉◉│\n└──┘`,
      `C:\\>_`,
      `╭─╮\n│■│\nFDD`,
      `REC●`,
      `CH 04`,
      `░░░░░\n100%`,
    ];
    const count = 18;
    for(let i=0;i<count;i++){
      const el = document.createElement('pre');
      el.className='glyph';
      el.textContent = glyphs[(Math.random()*glyphs.length)|0];
      el.style.left = (Math.random()*100) + 'vw';
      el.style.top = (Math.random()*100 + 10) + 'vh';
      el.style.animationDuration = (40 + Math.random()*40) + 's';
      el.style.animationDelay = (-Math.random()*40) + 's';
      el.style.fontSize = (10 + Math.random()*6) + 'px';
      el.style.opacity = 0.04 + Math.random()*0.06;
      layer.appendChild(el);
    }
  })();

  // ----------------- clock -----------------
  (function clock(){
    const el = document.getElementById('clock');
    function tick(){
      const d = new Date();
      const hh = String(d.getHours()).padStart(2,'0');
      const mm = String(d.getMinutes()).padStart(2,'0');
      const ss = String(d.getSeconds()).padStart(2,'0');
      el.textContent = `${hh}:${mm}:${ss}`;
    }
    tick(); setInterval(tick, 1000);
  })();

  // ----------------- character-by-character reveal -----------------
  // Split each .tt element into <span class="char">X</span> pieces, keeping whitespace
  function splitTT(){
    const nodes = document.querySelectorAll('.tt');
    nodes.forEach(n => {
      if(n.dataset.split === '1') return;
      n.dataset.split = '1';
      // preserve interior structure: walk text nodes only
      const walker = document.createTreeWalker(n, NodeFilter.SHOW_TEXT);
      const textNodes = [];
      while(walker.nextNode()) textNodes.push(walker.currentNode);
      textNodes.forEach(tn => {
        const text = tn.nodeValue;
        if(!text) return;
        const frag = document.createDocumentFragment();
        for(let i=0;i<text.length;i++){
          const ch = text[i];
          if(ch === ' ' || ch === '\n' || ch === '\t'){
            frag.appendChild(document.createTextNode(ch));
          } else {
            const span = document.createElement('span');
            span.className = 'char';
            span.textContent = ch;
            frag.appendChild(span);
          }
        }
        tn.parentNode.replaceChild(frag, tn);
      });
    });
  }
  // ----------------- YAML data → DOM -----------------
  const _escNode = document.createElement('div');
  function esc(str) {
    _escNode.textContent = str;
    return _escNode.innerHTML;
  }

  async function loadResume() {
    const response = await fetch('resume.yaml');
    const text = await response.text();
    return jsyaml.load(text);
  }

  function populateDOM(data) {
    document.title = `${data.name.first} ${data.name.last} — ${data.title}`;

    document.getElementById('kicker-text').textContent =
      data.title + ' · ' + data.tagline;

    document.getElementById('hero-name').innerHTML =
      `${esc(data.name.first)} <em>${esc(data.name.last)}</em>`;

    const roleHtml = data.role
      .map(r => `<span>${esc(r)}</span>`)
      .concat(`<span class="loc">${esc(data.location)}</span>`)
      .join('<span class="sep">/</span>');
    document.getElementById('hero-role').innerHTML = roleHtml;

    const aboutEl = document.getElementById('about-content');
    data.about.forEach(text => {
      const p = document.createElement('p');
      p.className = 'tt';
      p.dataset.tt = '';
      p.textContent = text;
      aboutEl.appendChild(p);
    });
    const sig = document.createElement('div');
    sig.className = 'sig tt';
    sig.dataset.tt = '';
    sig.textContent = data.signature;
    aboutEl.appendChild(sig);

    const expEl = document.getElementById('experience-list');
    data.experience.forEach(job => {
      const article = document.createElement('article');
      article.className = 'job';
      let html = `<div class="job-head">
        <div class="company glitch tt" data-tt>${esc(job.company)}</div>
        <div class="when tt" data-tt>${esc(job.period)}</div>
      </div>
      <div class="title tt" data-tt>${esc(job.title)}</div>`;
      if (job.description) {
        html += `<p class="desc tt" data-tt>${esc(job.description)}</p>`;
      }
      if (job.highlights && job.highlights.length) {
        html += '<ul class="hits">' +
          job.highlights.map(h => `<li class="tt" data-tt>${esc(h)}</li>`).join('') +
          '</ul>';
      }
      article.innerHTML = html;
      expEl.appendChild(article);
    });

    const skillsEl = document.getElementById('skills-grid');
    data.skills.forEach(cat => {
      const count = String(cat.items.length).padStart(2, '0');
      const div = document.createElement('div');
      div.className = 'skill-cat';
      div.innerHTML =
        `<div class="cat-label"><span>${esc(cat.category)}</span><span class="n">${count}</span></div>` +
        '<div class="items">' +
        cat.items.map(item => `<span class="tt" data-tt>${esc(item)}</span>`).join('') +
        '</div>';
      skillsEl.appendChild(div);
    });

    if (data.contact) {
      const contactEl = document.getElementById('hero-contact');
      const parts = [];
      if (data.contact.email)
        parts.push(`<a href="mailto:${esc(data.contact.email)}">${esc(data.contact.email)}</a>`);
      if (data.contact.linkedin)
        parts.push(`<a href="https://linkedin.com/in/${esc(data.contact.linkedin)}" target="_blank" rel="noopener">linkedin/${esc(data.contact.linkedin)}</a>`);
      contactEl.innerHTML = parts.join('<span class="sep" style="opacity:.25">·</span>');
    }

    if (data.education) {
      const eduEl = document.getElementById('education-list');
      data.education.forEach(edu => {
        const article = document.createElement('article');
        article.className = 'job';
        let html = `<div class="job-head">
          <div class="company glitch tt" data-tt>${esc(edu.institution)}</div>
          <div class="when tt" data-tt>${esc(edu.period)}</div>
        </div>
        <div class="title tt" data-tt>${esc(edu.degree)}</div>`;
        if (edu.note) {
          html += `<p class="desc tt" data-tt>${esc(edu.note)}</p>`;
        }
        article.innerHTML = html;
        eduEl.appendChild(article);
      });
    }

    const footLeft = document.getElementById('foot-left');
    footLeft.innerHTML = esc(data.footer.left) + '<span class="cursor"></span>';
    document.getElementById('foot-right').textContent = data.footer.right;
  }

  const INTRO_MS = 5200;
  function revealAll(durationMs = INTRO_MS){
    body.classList.add('intro');
    // animate static opacity down from ~0.85 to tweak value
    const targetOpacity = window.__TWEAKS.staticIntensity;
    const startOpacity = 0.85;
    const t0 = performance.now();
    function step(t){
      const p = Math.min(1,(t-t0)/durationMs);
      const eased = 1 - Math.pow(1-p, 2.2);
      root.style.setProperty('--static-opacity', String(startOpacity + (targetOpacity-startOpacity)*eased));
      if(p<1) requestAnimationFrame(step);
      else body.classList.remove('intro');
    }
    requestAnimationFrame(step);

    // gather all .tt.char spans in document order
    const all = Array.from(document.querySelectorAll('.tt'));
    all.forEach(el => el.classList.add('revealed'));
    const chars = Array.from(document.querySelectorAll('.tt .char'));
    // reset first
    chars.forEach(c => c.classList.remove('on'));
    const total = chars.length;
    const durPerChar = durationMs / Math.max(total, 1);
    // jitter within small window so it feels organic
    chars.forEach((c, i) => {
      const jitter = (Math.random() - 0.5) * durPerChar * 2;
      const delay = Math.max(0, i * durPerChar + jitter);
      setTimeout(() => c.classList.add('on'), delay);
    });
  }

  // occasional glitch frames
  function occasionalGlitch(){
    const page = document.getElementById('page');
    function fire(){
      if(body.classList.contains('intro')) return schedule();
      const dur = 90 + Math.random()*80;
      page.style.transform = `translate3d(${(Math.random()-0.5)*3}px, ${(Math.random()-0.5)*2}px, 0)`;
      page.style.filter = `hue-rotate(${(Math.random()-0.5)*6}deg)`;
      const prev = root.style.getPropertyValue('--static-opacity') || window.__TWEAKS.staticIntensity;
      root.style.setProperty('--static-opacity', String(Math.min(0.9, parseFloat(prev)+0.35)));
      setTimeout(() => {
        page.style.transform = '';
        page.style.filter = '';
        root.style.setProperty('--static-opacity', String(window.__TWEAKS.staticIntensity));
        schedule();
      }, dur);
    }
    function schedule(){
      setTimeout(fire, 4500 + Math.random()*9000);
    }
    schedule();
  }
  occasionalGlitch();

  // ----------------- arrow-key channel nav -----------------
  const sections = () => Array.from(document.querySelectorAll('section.block'));
  let curIdx = 0;
  function goTo(idx){
    const list = sections();
    if(!list.length) return;
    curIdx = (idx + list.length) % list.length;
    const target = list[curIdx];
    // channel flash
    const flash = document.getElementById('channel-flash');
    flash.classList.remove('go'); void flash.offsetWidth; flash.classList.add('go');
    // scroll target to top with margin
    const y = target.getBoundingClientRect().top + window.scrollY - 80;
    window.scrollTo({top: y, behavior: 'smooth'});
    list.forEach(s => s.classList.remove('focus'));
    target.classList.add('focus');
  }
  window.addEventListener('keydown', (e) => {
    if(e.target.matches('input,textarea')) return;
    if(e.key === 'ArrowRight' || e.key === 'ArrowDown'){ e.preventDefault(); goTo(curIdx + 1); }
    else if(e.key === 'ArrowLeft' || e.key === 'ArrowUp'){ e.preventDefault(); goTo(curIdx - 1); }
    else if(e.key === 'r' || e.key === 'R'){ revealAll(INTRO_MS); }
  });

  // ----------------- tweaks panel wiring -----------------
  function syncTweaksUI(t){
    const intensity = document.getElementById('t-intensity');
    if(intensity && intensity.value !== String(t.staticIntensity)) intensity.value = t.staticIntensity;
    document.querySelectorAll('#t-accent button').forEach(b => {
      b.classList.toggle('on', b.dataset.c.toLowerCase() === t.accent.toLowerCase());
    });
    document.querySelectorAll('#t-scan button').forEach(b => {
      b.classList.toggle('on', (b.dataset.v === 'true') === !!t.scanlines);
    });
    document.querySelectorAll('#t-font button').forEach(b => {
      b.classList.toggle('on', b.dataset.v === t.fontPair);
    });
  }
  document.getElementById('t-intensity').addEventListener('input', e => {
    setTweak({staticIntensity: parseFloat(e.target.value)});
  });
  document.querySelectorAll('#t-accent button').forEach(b => {
    b.addEventListener('click', () => setTweak({accent: b.dataset.c}));
  });
  document.querySelectorAll('#t-scan button').forEach(b => {
    b.addEventListener('click', () => setTweak({scanlines: b.dataset.v === 'true'}));
  });
  document.querySelectorAll('#t-font button').forEach(b => {
    b.addEventListener('click', () => setTweak({fontPair: b.dataset.v}));
  });
  document.getElementById('t-replay').addEventListener('click', () => revealAll(INTRO_MS));

  // ----------------- edit mode protocol -----------------
  window.addEventListener('message', (ev) => {
    const d = ev.data || {};
    if(d.type === '__activate_edit_mode'){
      document.getElementById('tweaks').classList.add('open');
    } else if(d.type === '__deactivate_edit_mode'){
      document.getElementById('tweaks').classList.remove('open');
    }
  });
  try{ window.parent.postMessage({type:'__edit_mode_available'}, '*'); }catch(e){}

  // ----------------- boot -----------------
  applyTweaks(window.__TWEAKS);

  loadResume().then(data => {
    populateDOM(data);
    splitTT();
    const triggerReveal = () => setTimeout(() => revealAll(INTRO_MS), 150);
    if (document.fonts && document.fonts.ready) {
      document.fonts.ready.then(triggerReveal);
    } else {
      triggerReveal();
    }
  });

})();
