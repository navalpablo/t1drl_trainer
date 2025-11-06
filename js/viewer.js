/**
 * T1-Dark Rim Lesion Viewer
 * - Slice navigation (keyboard, touch, mouse)
 * - Visible slider width & progress
 * - On-image slice indicator
 * - Eval scoring + local history
 * - Autosave/restore answers (progress)
 * - Prev/Next batch navigation (with warning)
 * - Back-to-menu & keyboard-help modal
 */

document.addEventListener("DOMContentLoaded", () => {
  const containers = document.querySelectorAll(".lesion-container");
  let currentFocusedContainer = null;

  addHelpButton();
  addBackToMenuButton();
  addBatchNavButtons();

  if (!containers.length) {
    return; // do nothing here
  }

  // Initialize each lesion container
  containers.forEach((c) => {
    // Reorganize for nicer layout (adds wrappers we will target)
    reorganizeContainer(c);

    const img    = c.querySelector("img");
    const slider = c.querySelector("input[type=range]");
    const files  = JSON.parse(c.dataset.slices);

    // Store for preloading
    c._files = files;
    c._currentIndex = Math.floor(files.length / 2);

    // Create an on-image slice indicator (overlay, bottom-right)
    const imageWrapper = c.querySelector('.lesion-image-wrapper');
    const indicator = document.createElement('div');
    indicator.className = 'slice-indicator';
    imageWrapper.appendChild(indicator);
    c._indicator = indicator;

    // Add min/max labels under the slider so width is obvious
    const sliderWrapper = c.querySelector('.slider-wrapper');
    const labels = document.createElement('div');
    labels.className = 'slider-labels';
    labels.innerHTML = `<span>0</span><span>${files.length - 1}</span>`;
    sliderWrapper.appendChild(labels);

    // Prepare slider
    slider.max = files.length - 1;

    // Start in the middle
    const mid = Math.floor(files.length / 2);
    slider.value = mid;

    // Add loading spinner before image loads
    img.classList.add('loading');
    img.src = files[mid];
    updateSliceIndicator(c, mid);
    setSliderProgress(slider, mid, files.length - 1);

    img.addEventListener('load', () => {
      img.classList.remove('loading');
    });

    // Preload neighbors
    preloadAdjacentImages(files, mid);

    // Slider handler
    slider.addEventListener("input", e => {
      const i = +e.target.value;
      updateSlice(c, i);
      setSliderProgress(slider, i, files.length - 1);
    });

    // Touch (swipe left/right to change slice)
    let touchStartX = 0;
    let touchEndX = 0;

    img.addEventListener('touchstart', e => {
      touchStartX = e.changedTouches[0].screenX;
    }, { passive: true });

    img.addEventListener('touchend', e => {
      touchEndX = e.changedTouches[0].screenX;
      handleSwipe(c);
    }, { passive: true });

    function handleSwipe(container) {
      const swipeThreshold = 50;
      const diff = touchStartX - touchEndX;

      const slider = container.querySelector("input[type=range]");
      const currentVal = +slider.value;
      const maxVal = +slider.max;

      if (Math.abs(diff) > swipeThreshold) {
        if (diff > 0 && currentVal < maxVal) {         // left → next
          slider.value = currentVal + 1;
          updateSlice(container, currentVal + 1);
          setSliderProgress(slider, currentVal + 1, maxVal);
        } else if (diff < 0 && currentVal > 0) {       // right → prev
          slider.value = currentVal - 1;
          updateSlice(container, currentVal - 1);
          setSliderProgress(slider, currentVal - 1, maxVal);
        }
      }
    }

    // Focus tracking for keyboard control
    slider.addEventListener('focus', () => {
      currentFocusedContainer = c;
    });

    img.addEventListener('click', () => {
      slider.focus();
      currentFocusedContainer = c;
    });
  });

  // Update slice image + indicator + preload
  function updateSlice(container, index) {
    const img = container.querySelector("img");
    const files = container._files;

    img.classList.add('loading');
    img.src = files[index];
    container._currentIndex = index;

    updateSliceIndicator(container, index);
    preloadAdjacentImages(files, index);
  }

  function updateSliceIndicator(container, index) {
    const files = container._files;
    const indicator = container._indicator;
    if (indicator) {
      indicator.textContent = `Slice ${index} / ${files.length - 1}`;
    }
    // If some pages still have the old span.slice-num, keep it in sync but don't rely on it
    const legacy = container.querySelector('.slice-num');
    if (legacy) legacy.textContent = `${index} / ${files.length - 1}`;
  }

  function preloadAdjacentImages(files, currentIndex) {
    [currentIndex - 1, currentIndex + 1].forEach(i => {
      if (i >= 0 && i < files.length) {
        const preloadImg = new Image();
        preloadImg.src = files[i];
      }
    });
  }

  // Paint the filled portion of the slider track so users see the width & position
  function setSliderProgress(slider, index, maxIndex) {
    const pct = maxIndex > 0 ? (index / maxIndex) * 100 : 0;
    // This gradient shows a filled track (brand color) up to the thumb
    slider.style.background = `linear-gradient(var(--brand), var(--brand)) 0/${pct}% 100% no-repeat, #ddd`;
  }

  // Global keyboard shortcuts
  document.addEventListener('keydown', e => {
    // Avoid interfering with radio inputs
    if (e.target.tagName === 'INPUT' && (e.target.type === 'radio' || e.target.type === 'text' || e.target.type === 'email')) return;

    const container = currentFocusedContainer || containers[0];
    const slider = container?.querySelector("input[type=range]");
    if (!slider) return;

    const currentVal = +slider.value;
    const maxVal = +slider.max;

    switch(e.key) {
      case 'ArrowLeft':
        e.preventDefault();
        if (currentVal > 0) {
          slider.value = currentVal - 1;
          updateSlice(container, currentVal - 1);
          setSliderProgress(slider, currentVal - 1, maxVal);
        }
        break;

      case 'ArrowRight':
        e.preventDefault();
        if (currentVal < maxVal) {
          slider.value = currentVal + 1;
          updateSlice(container, currentVal + 1);
          setSliderProgress(slider, currentVal + 1, maxVal);
        }
        break;

      case ' ': // Space → next lesion
        e.preventDefault();
        advanceToNextLesion(container);
        break;

      case '1': case 't': case 'T': // True
        e.preventDefault();
        selectAnswer(container, 'True');
        break;

      case '2': case 'f': case 'F': // False
        e.preventDefault();
        selectAnswer(container, 'False');
        break;
    }
  });

  function advanceToNextLesion(currentContainer) {
    const arr = Array.from(containers);
    const i = arr.indexOf(currentContainer);
    if (i < arr.length - 1) {
      const next = arr[i + 1];
      const nextSlider = next.querySelector("input[type=range]");
      next.scrollIntoView({ behavior: 'smooth', block: 'center' });
      setTimeout(() => {
        nextSlider?.focus();
        currentFocusedContainer = next;
      }, 300);
    }
  }

  function selectAnswer(container, value) {
    const radio = container.querySelector(`input[type=radio][value="${value}"]`);
    if (radio) {
      radio.checked = true;
      radio.dispatchEvent(new Event('change', { bubbles: true }));
    }
  }

  // Lazy loading: preload when a container comes into view
  if ('IntersectionObserver' in window) {
    const lazyLoadObserver = new IntersectionObserver((entries) => {
      entries.forEach(entry => {
        if (entry.isIntersecting) {
          const container = entry.target;
          const files = container._files;
          const idx = container._currentIndex;

          preloadAdjacentImages(files, idx);
          [idx - 2, idx + 2].forEach(i => {
            if (i >= 0 && i < files.length) {
              const preloadImg = new Image();
              preloadImg.src = files[i];
            }
          });
        }
      });
    }, { rootMargin: '200px' });

    containers.forEach(container => lazyLoadObserver.observe(container));
  }

  // ───────────────────────────────────────────────────────────────────────────
  // Eval mode: scoring + autosave answers + analytics history
  // ───────────────────────────────────────────────────────────────────────────
  const evalForm = document.getElementById('evalForm');
  if (evalForm) {
    // Restore autosaved progress
    restoreProgress();

    // Save progress on every change
    evalForm.addEventListener('change', (e) => {
      const target = e.target;
      if (target.matches('input[type=radio][name]')) {
        const batchName = getBatchName();
        const name = target.name;
        const val = target.value;
        const prog = JSON.parse(localStorage.getItem('lesionProgress') || '{}');
        if (!prog[batchName]) prog[batchName] = {};
        prog[batchName][name] = val;
        localStorage.setItem('lesionProgress', JSON.stringify(prog));
      }
    });

    evalForm.addEventListener('submit', e => {
      e.preventDefault();
      const boxes = document.querySelectorAll('.lesion-container');
      let tp = 0, tn = 0, fp = 0, fn = 0;

      boxes.forEach(c => {
        const gold = c.dataset.gold === 'True';
        const ans = c.querySelector('input[type=radio]:checked');
        const mark = c.querySelector('.result');
        if (!ans) { if (mark) mark.textContent = ''; return; }

        const given = ans.value === 'True';
        let wrong = false;

        if (given && gold) { tp++; if (mark){ mark.textContent = '✅'; mark.className = 'result right'; } }
        else if (!given && !gold) { tn++; if (mark){ mark.textContent = '✅'; mark.className = 'result right'; } }
        else if (given && !gold) { fp++; wrong = true; if (mark){ mark.textContent = '❌'; mark.className = 'result wrong'; } }
        else { fn++; wrong = true; if (mark){ mark.textContent = '❌'; mark.className = 'result wrong'; } }

        if (wrong) addShowAnswerButton(c, gold);
      });

      const tot = tp + tn + fp + fn;
      const acc = ((tp + tn) / tot * 100).toFixed(1);
      const sens = tp + fn ? (tp / (tp + fn) * 100).toFixed(1) : '–';
      const spec = tn + fp ? (tn / (tn + fp) * 100).toFixed(1) : '–';

      const scoreText = document.getElementById('scoreText');
      const detail = document.getElementById('detail');
      const card = document.getElementById('scoreCard');
      if (scoreText) scoreText.textContent = `Accuracy: ${acc}%  (TP ${tp} | TN ${tn} | FP ${fp} | FN ${fn})`;
      if (detail) detail.textContent = `Sensitivity: ${sens}%   Specificity: ${spec}%`;
      if (card) card.style.display = 'block';

      const batchName = getBatchName();
      saveAnalytics(batchName, {
        accuracy: parseFloat(acc),
        tp, tn, fp, fn,
        sensitivity: sens === '–' ? null : parseFloat(sens),
        specificity: spec === '–' ? null : parseFloat(spec)
      });

      displayAnalyticsHistory(batchName);
      window.scrollTo({ top: document.body.scrollHeight, behavior: 'smooth' });
    });
  }

  function getBatchName() {
    return document.title || 'Unknown batch';
  }

  // Show correct answer button when wrong
  function addShowAnswerButton(container, correctAnswer) {
    const resultSpan = container.querySelector('.result');
    if (!resultSpan) return;
    if (container.querySelector('.show-answer-btn')) return;

    const btn = document.createElement('button');
    btn.textContent = 'Show Answer';
    btn.className = 'show-answer-btn';
    btn.type = 'button';

    btn.addEventListener('click', () => {
      const answerText = document.createElement('span');
      answerText.className = correctAnswer ? 'badge true' : 'badge false';
      answerText.textContent = correctAnswer ? 'TRUE lesion' : 'FALSE lesion';
      answerText.style.marginLeft = '0.5rem';

      resultSpan.appendChild(answerText);
      btn.remove();
    });

    resultSpan.appendChild(btn);
  }

  // ───────────────────────────────────────────────────────────────────────────
  // Layout helpers
  // ───────────────────────────────────────────────────────────────────────────
  function reorganizeContainer(container) {
    const heading = container.querySelector('h3');
    const img = container.querySelector('img');
    const controls = container.querySelector('.controls');
    const radioLabels = container.querySelectorAll('label');
    const resultSpan = container.querySelector('.result');
    const hr = container.querySelector('hr');

    const containerContent = Array.from(container.children);
    container.innerHTML = '';

    if (heading) container.appendChild(heading);

    const contentWrapper = document.createElement('div');
    contentWrapper.className = 'lesion-content';

    const imageWrapper = document.createElement('div');
    imageWrapper.className = 'lesion-image-wrapper';
    if (img) imageWrapper.appendChild(img);

    if (controls) {
      const sliderWrapper = document.createElement('div');
      sliderWrapper.className = 'slider-wrapper';
      sliderWrapper.appendChild(controls);
      imageWrapper.appendChild(sliderWrapper);
    }

    const controlsWrapper = document.createElement('div');
    controlsWrapper.className = 'lesion-controls-wrapper';

    if (radioLabels.length > 0) {
      const answerGroup = document.createElement('div');
      answerGroup.className = 'answer-group';
      radioLabels.forEach(label => answerGroup.appendChild(label));
      controlsWrapper.appendChild(answerGroup);
    }

    if (resultSpan) controlsWrapper.appendChild(resultSpan);

    contentWrapper.appendChild(imageWrapper);
    contentWrapper.appendChild(controlsWrapper);
    container.appendChild(contentWrapper);

    if (hr) container.appendChild(hr);
  }

  // ───────────────────────────────────────────────────────────────────────────
  // Help button + modal (no export/email; only tips & clear data)
  // ───────────────────────────────────────────────────────────────────────────
  function addHelpButton() {
    const helpButton = document.createElement('button');
    helpButton.className = 'help-button';
    helpButton.innerHTML = '⌨️ Shortcuts';
    helpButton.title = 'View keyboard shortcuts';

    const modal = document.createElement('div');
    modal.className = 'help-modal';
    modal.innerHTML = `
      <div class="help-modal-content">
        <button class="close-modal" aria-label="Close">&times;</button>
        <h3>⌨️ Keyboard Shortcuts</h3>

        <table>
          <thead>
            <tr><th>Key</th><th>Action</th></tr>
          </thead>
          <tbody>
            <tr><td><kbd>←</kbd></td><td>Previous image slice</td></tr>
            <tr><td><kbd>→</kbd></td><td>Next image slice</td></tr>
            <tr><td><kbd>Space</kbd></td><td>Jump to next lesion</td></tr>
            <tr><td><kbd>1</kbd> or <kbd>T</kbd></td><td>Select "True"</td></tr>
            <tr><td><kbd>2</kbd> or <kbd>F</kbd></td><td>Select "False"</td></tr>
          </tbody>
        </table>

        <h3>💡 Tips</h3>
        <ul>
          <li>Click any image to focus it for keyboard control</li>
          <li>Your progress (answers) is saved automatically in your browser</li>
          <li>You can clear your stored analytics at any time</li>
        </ul>

        <h3 style="margin-top:1.25rem;">🗑️ Data Control</h3>
        <p style="font-size:0.9rem;margin-bottom:0.5rem;">
          Clear all stored analytics and saved answers from this device.
        </p>
        <button id="clearAnalytics" class="danger" style="background:var(--danger);padding:0.5rem 1rem;font-size:0.9rem;border-radius:.5rem;">
          Clear All Local Data
        </button>
      </div>
    `;

    document.body.appendChild(helpButton);
    document.body.appendChild(modal);

    // Open / close modal
    helpButton.addEventListener('click', () => modal.classList.add('show'));
    modal.querySelector('.close-modal').addEventListener('click', () => modal.classList.remove('show'));
    modal.addEventListener('click', (e) => { if (e.target === modal) modal.classList.remove('show'); });
    document.addEventListener('keydown', (e) => { if (e.key === 'Escape' && modal.classList.contains('show')) modal.classList.remove('show'); });

    // Clear all local data
    modal.querySelector('#clearAnalytics').addEventListener('click', () => {
      if (confirm('Are you sure you want to clear ALL analytics and saved answers? This cannot be undone.')) {
        localStorage.removeItem('lesionAnalytics');
        localStorage.removeItem('lesionProgress');
        alert('Local data cleared.');
        modal.classList.remove('show');
      }
    });
  }

  // Back to menu floating button
  function addBackToMenuButton() {
    // Avoid duplicating if index already has its own nav
    if (document.querySelector('.back-to-menu-button')) return;

    const backButton = document.createElement('a');
    backButton.href = 'index.html';
    backButton.className = 'back-to-menu-button';
    backButton.innerHTML = '← Menu';
    backButton.title = 'Back to main menu';
    document.body.appendChild(backButton);
  }

  // ───────────────────────────────────────────────────────────────────────────
  // Prev/Next batch navigation (with incomplete warning on eval)
  // ───────────────────────────────────────────────────────────────────────────
  function addBatchNavButtons() {
    const path = (location.pathname || '').split('/').pop() || 'index.html';
    const mTrain = path.match(/^train_(\d+)\.html$/i);
    const mEval  = path.match(/^eval_(\d+)\.html$/i);
    if (!mTrain && !mEval) return; // not a batch page

    const isEval = !!mEval;
    const curNum = parseInt((mTrain?.[1] || mEval?.[1] || '0'), 10);
    const prefix = mTrain ? 'train_' : 'eval_';

    // Define bounds per mode (so we don't link to non-existent batches)
    const bounds = mTrain
      ? { min: 1, max: 5 }   // training batches 1–5
      : { min: 6, max: 20 }; // self-eval batches 6–20

    const prevNum = curNum - 1;
    const nextNum = curNum + 1;

    const prevHref = prevNum >= bounds.min ? `${prefix}${String(prevNum)}.html` : null;
    const nextHref = nextNum <= bounds.max ? `${prefix}${String(nextNum)}.html` : null;

    const nav = document.createElement('div');
    nav.className = 'batch-nav';

    const prev = document.createElement('a');
    prev.textContent = '← Prev batch';
    prev.className = 'secondary';
    if (prevHref) prev.href = prevHref; else prev.setAttribute('aria-disabled', 'true');

    const next = document.createElement('a');
    next.textContent = 'Next batch →';
    if (nextHref) next.href = nextHref; else next.setAttribute('aria-disabled', 'true');

    if (isEval) {
      const guard = (e) => {
        if (!hasIncompleteAnswers()) return; // no warning needed
        const ok = confirm(
          'Some questions are unanswered.\n\nYour current selections are saved locally and you can return later.\n\nContinue to switch batches?'
        );
        if (!ok) e.preventDefault();
      };
      prev.addEventListener('click', guard);
      next.addEventListener('click', guard);
    }

    nav.appendChild(prev);
    nav.appendChild(next);
    document.body.appendChild(nav);
  }

  function hasIncompleteAnswers() {
    const form = document.getElementById('evalForm');
    if (!form) return false;
    const groups = new Set();
    form.querySelectorAll('input[type=radio][name]').forEach(i => groups.add(i.name));
    let answered = 0;
    groups.forEach(name => {
      if (form.querySelector(`input[type=radio][name="${CSS.escape(name)}"]:checked`)) answered++;
    });
    return answered < groups.size;
  }

  // ───────────────────────────────────────────────────────────────────────────
  // Autosave/restore progress (radio answers)
  // ───────────────────────────────────────────────────────────────────────────
  function restoreProgress() {
    const form = document.getElementById('evalForm');
    if (!form) return;
    const batchName = getBatchName();
    const prog = JSON.parse(localStorage.getItem('lesionProgress') || '{}')[batchName] || {};
    Object.entries(prog).forEach(([name, val]) => {
      const el = form.querySelector(`input[type=radio][name="${CSS.escape(name)}"][value="${CSS.escape(val)}"]`);
      if (el) el.checked = true;
    });
  }

  // ───────────────────────────────────────────────────────────────────────────
  // Analytics helpers
  // ───────────────────────────────────────────────────────────────────────────
  function saveAnalytics(batchName, score) {
    const analytics = JSON.parse(localStorage.getItem('lesionAnalytics') || '{}');
    if (!analytics[batchName]) analytics[batchName] = [];
    analytics[batchName].push({
      date: new Date().toISOString(),
      accuracy: score.accuracy,
      tp: score.tp, tn: score.tn, fp: score.fp, fn: score.fn,
      sensitivity: score.sensitivity,
      specificity: score.specificity
    });
    localStorage.setItem('lesionAnalytics', JSON.stringify(analytics));
  }

  function displayAnalyticsHistory(batchName) {
    const analytics = JSON.parse(localStorage.getItem('lesionAnalytics') || '{}');
    const history = analytics[batchName];
    if (!history || history.length === 0) return;

    const scoreCard = document.getElementById('scoreCard');
    if (!scoreCard) return;
    if (scoreCard.querySelector('.analytics-history')) return;

    const historyDiv = document.createElement('div');
    historyDiv.className = 'analytics-history';
    historyDiv.style.marginTop = '1.5rem';
    historyDiv.style.paddingTop = '1rem';
    historyDiv.style.borderTop = '1px solid #ddd';

    const title = document.createElement('h4');
    title.textContent = 'Your Previous Attempts:';
    historyDiv.appendChild(title);

    const list = document.createElement('ul');
    list.style.fontSize = '0.9rem';
    list.style.marginTop = '0.5rem';

    history.slice(-5).reverse().forEach((attempt, index) => {
      const li = document.createElement('li');
      const date = new Date(attempt.date).toLocaleDateString();
      li.textContent = `${date}: ${attempt.accuracy}% accuracy`;
      if (index === 0) li.style.fontWeight = 'bold';
      list.appendChild(li);
    });

    historyDiv.appendChild(list);
    scoreCard.appendChild(historyDiv);
  }

  function getAnalyticsFlat() {
    const raw = JSON.parse(localStorage.getItem('lesionAnalytics') || '{}');
    const out = [];
    Object.keys(raw).forEach(batch => {
      (raw[batch] || []).forEach(r => {
        out.push({
          batch,
          date: r.date,
          accuracy: r.accuracy,
          tp: r.tp, tn: r.tn, fp: r.fp, fn: r.fn,
          sensitivity: r.sensitivity,
          specificity: r.specificity
        });
      });
    });
    return out;
  }

  // ───────────────────────────────────────────────────────────────────────────
  // Index analytics summary
  // ───────────────────────────────────────────────────────────────────────────
  function renderIndexAnalyticsSummary() {
    const container = document.querySelector('.container');
    if (!container) return;

    const rows = getAnalyticsFlat();
    const wrap = document.createElement('section');
    wrap.className = 'analytics-summary';

    const title = document.createElement('h3');
    title.textContent = '📊 Your Analytics Summary';
    wrap.appendChild(title);

    if (!rows.length) {
      const p = document.createElement('p');
      p.className = 'small';
      p.textContent = 'No evaluation attempts found yet. Run any self-evaluation batch to see your stats here.';
      wrap.appendChild(p);
      container.insertBefore(wrap, container.firstChild?.nextSibling || container.firstChild);
      return;
    }

    // Aggregate
    const attempts = rows.length;
    const batches = Array.from(new Set(rows.map(r => r.batch)));
    const meanAcc = (rows.reduce((s,r)=>s+(+r.accuracy||0),0)/attempts).toFixed(1);
    const best = rows.reduce((m, r)=> (r.accuracy>m.accuracy? r : m), rows[0]);
    const lastByBatch = {};
    rows.forEach(r => {
      if (!lastByBatch[r.batch] || new Date(r.date) > new Date(lastByBatch[r.batch].date)) {
        lastByBatch[r.batch] = r;
      }
    });

    const meta = document.createElement('div');
    meta.className = 'meta';
    meta.textContent = `Attempts: ${attempts} · Batches with attempts: ${batches.length} · Mean accuracy: ${meanAcc}% · Best: ${best.accuracy}%`;
    wrap.appendChild(meta);

    // Table of last attempt per batch
    const tbl = document.createElement('table');
    const thead = document.createElement('thead');
    thead.innerHTML = `<tr><th>Batch</th><th>Date</th><th>Accuracy</th><th>TP</th><th>TN</th><th>FP</th><th>FN</th></tr>`;
    tbl.appendChild(thead);
    const tbody = document.createElement('tbody');
    Object.values(lastByBatch)
      .sort((a,b)=> a.batch.localeCompare(b.batch))
      .forEach(r=>{
        const tr = document.createElement('tr');
        const d = new Date(r.date);
        const accCl = (+r.accuracy>=80)?'good':(+r.accuracy<60?'warn':'');
        tr.innerHTML = `
          <td>${r.batch}</td>
          <td>${d.toLocaleDateString()} ${d.toLocaleTimeString([], {hour:'2-digit',minute:'2-digit'})}</td>
          <td class="${accCl}">${r.accuracy}%</td>
          <td>${r.tp}</td>
          <td>${r.tn}</td>
          <td>${r.fp}</td>
          <td>${r.fn}</td>
        `;
        tbody.appendChild(tr);
      });
    tbl.appendChild(tbody);
    wrap.appendChild(tbl);

    // Clear data button
    const clear = document.createElement('button');
    clear.textContent = 'Clear Analytics';
    clear.className = 'button danger';
    clear.style.marginTop = '.75rem';
    clear.addEventListener('click', ()=>{
      if (confirm('Clear all stored analytics from this device? This cannot be undone.')) {
        localStorage.removeItem('lesionAnalytics');
        location.reload();
      }
    });
    wrap.appendChild(clear);

    // Insert near top
    const anchor = container.querySelector('h2')?.nextSibling || container.firstChild;
    container.insertBefore(wrap, anchor);
  }
});
