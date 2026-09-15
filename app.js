import {
  createRecipe, listRecipes, getRecipe, saveRecipe, deleteRecipe, onChange, normalizeSearchTerm,
  signIn, signOutUser, onAuthChange, currentUser, startSync, stopSync,
} from './firebase.js';
import { KEYS, getSetting, setSetting, structureRecipe, structureRecipes, MissingKeyError } from './ai.js';

const app = document.getElementById('app');

let searchQuery = '';

/* ---------- DOM helper ---------- */

function h(tag, props = {}, children = []) {
  const node = document.createElement(tag);
  for (const [key, value] of Object.entries(props)) {
    if (value === null || value === undefined || value === false) continue;
    if (key === 'class') node.className = value;
    else if (key === 'text') node.textContent = value;
    else if (key === 'style') {
      for (const [prop, val] of Object.entries(value)) {
        if (prop.startsWith('--')) node.style.setProperty(prop, val);
        else node.style[prop] = val;
      }
    } else if (key.startsWith('on')) node.addEventListener(key.slice(2).toLowerCase(), value);
    else node.setAttribute(key, value === true ? '' : value);
  }
  for (const child of [].concat(children)) {
    if (child === null || child === undefined || child === false) continue;
    node.append(child);
  }
  return node;
}

const ICONS = {
  add: 'M11 13H5v-2h6V5h2v6h6v2h-6v6h-2z',
  back: 'M20 11H7.83l5.59-5.59L12 4l-8 8 8 8 1.41-1.41L7.83 13H20v-2z',
  settings: 'M19.14,12.94c0.04,-0.3 0.06,-0.61 0.06,-0.94c0,-0.32 -0.02,-0.64 -0.07,-0.94l2.03,-1.58c0.18,-0.14 0.23,-0.41 0.12,-0.61l-1.92,-3.32c-0.12,-0.22 -0.37,-0.29 -0.59,-0.22l-2.39,0.96c-0.5,-0.38 -1.03,-0.7 -1.62,-0.94L14.4,2.81c-0.04,-0.24 -0.24,-0.41 -0.48,-0.41h-3.84c-0.24,0 -0.43,0.17 -0.47,0.41L9.25,5.35C8.66,5.59 8.12,5.92 7.63,6.29L5.24,5.33c-0.22,-0.08 -0.47,0 -0.59,0.22L2.74,8.87C2.62,9.08 2.66,9.34 2.86,9.48l2.03,1.58C4.84,11.36 4.8,11.69 4.8,12s0.02,0.64 0.07,0.94l-2.03,1.58c-0.18,0.14 -0.23,0.41 -0.12,0.61l1.92,3.32c0.12,0.22 0.37,0.29 0.59,0.22l2.39,-0.96c0.5,0.38 1.03,0.7 1.62,0.94l0.36,2.54c0.05,0.24 0.24,0.41 0.48,0.41h3.84c0.24,0 0.44,-0.17 0.47,-0.41l0.36,-2.54c0.59,-0.24 1.13,-0.56 1.62,-0.94l2.39,0.96c0.22,0.08 0.47,0 0.59,-0.22l1.92,-3.32c0.12,-0.22 0.07,-0.47 -0.12,-0.61L19.14,12.94zM12,15.6c-1.98,0 -3.6,-1.62 -3.6,-3.6s1.62,-3.6 3.6,-3.6s3.6,1.62 3.6,3.6S13.98,15.6 12,15.6z',
  mic: 'M12 14c1.66 0 3-1.34 3-3V5c0-1.66-1.34-3-3-3S9 3.34 9 5v6c0 1.66 1.34 3 3 3zm5-3c0 2.76-2.24 5-5 5s-5-2.24-5-5H5c0 3.53 2.61 6.43 6 6.92V21h2v-3.08c3.39-.49 6-3.39 6-6.92h-2z',
  stop: 'M6 6h12v12H6z',
  close: 'M19,6.41L17.59,5 12,10.59 6.41,5 5,6.41 10.59,12 5,17.59 6.41,19 12,13.41 17.59,19 19,17.59 13.41,12z',
  upload: 'M9,16h6v-6h4l-7,-7 -7,7h4zM5,18h14v2H5z',
  sparkle: 'M19,9l1.25,-2.75L23,5l-2.75,-1.25L19,1l-1.25,2.75L15,5l2.75,1.25L19,9zM11.5,9.5L9,4L6.5,9.5L1,12l5.5,2.5L9,20l2.5,-5.5L17,12L11.5,9.5zM19,15l-1.25,2.75L15,19l2.75,1.25L19,23l1.25,-2.75L23,19l-2.75,-1.25L19,15z',
  restaurant: 'M8.1,13.34l2.83,-2.83L3.91,3.5c-1.56,1.56 -1.56,4.09 0,5.66l4.19,4.18zm6.78,-1.81c1.53,0.71 3.68,0.21 5.27,-1.38c1.91,-1.91 2.28,-4.65 0.81,-6.12c-1.46,-1.46 -4.2,-1.1 -6.12,0.81c-1.59,1.59 -2.09,3.74 -1.38,5.27L2.71,20.85l1.41,1.41L11,15.41l6.88,6.88l1.41,-1.41L12.41,14l2.47,-2.47z',
};

function icon(name, size = 24) {
  const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
  svg.setAttribute('viewBox', '0 0 24 24');
  svg.setAttribute('width', size);
  svg.setAttribute('height', size);
  svg.setAttribute('aria-hidden', 'true');
  const path = document.createElementNS('http://www.w3.org/2000/svg', 'path');
  path.setAttribute('d', ICONS[name]);
  svg.append(path);
  return svg;
}

function toast(message) {
  document.querySelector('.toast')?.remove();
  const node = h('div', { class: 'toast', text: message });
  document.body.append(node);
  setTimeout(() => node.remove(), 2000);
}

function go(path) {
  location.hash = path;
}

/* ---------- Speech ---------- */

const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
let activeRecognition = null;
let allowRecognitionRestart = false;

const SPEECH_ERRORS = {
  'not-allowed': 'マイクの使用が許可されていません。ブラウザの設定を確認してください。',
  'service-not-allowed': 'この端末では音声入力が使えませんでした。',
  'no-speech': '音声が聞き取れませんでした。',
  network: '通信できませんでした。',
};

const FATAL_SPEECH_ERRORS = new Set(['not-allowed', 'service-not-allowed', 'audio-capture']);

function stopRecognition() {
  allowRecognitionRestart = false;
  activeRecognition?.abort();
}

/* ---------- Theme ---------- */

function applyTheme() {
  const theme = getSetting(KEYS.theme);
  if (theme) document.documentElement.dataset.theme = theme;
  else delete document.documentElement.dataset.theme;
}

/* ---------- App bar ---------- */

function backButton(onClick) {
  return h('button', { class: 'icon-btn', 'aria-label': 'もどる', onClick }, icon('back'));
}

function bar({ title = '', left, right, titleIcon }) {
  return h('header', { class: 'bar' }, [
    left,
    h('div', { class: 'bar__title-group' }, [
      titleIcon,
      h('h1', { class: 'bar__title', text: title }),
    ]),
    ...[].concat(right),
  ]);
}

/* ---------- Source labels ---------- */

const SOURCE_LABEL = {
  manual: '手入力',
  voice: '音声入力',
  notion: 'Notion',
  twitter: 'Twitterのブックマーク',
};

function creditLine(recipe) {
  const created = recipe.createdBy ? `${recipe.createdBy}が登録` : '登録者不明';
  const updated = (recipe.updatedAt || '').slice(0, 10);
  return updated ? `${created}・最終更新 ${updated}` : created;
}

/* ---------- List ---------- */

function recipeCard(recipe) {
  const tinted = recipe.creator === 'Akemi';
  return h('button', { class: `recipe${tinted ? ' recipe--red' : ''}`, onClick: () => go(`/recipe/${recipe.id}`) }, [
    recipe.photoUrl && h('div', { class: 'recipe__thumb' }, h('img', { src: recipe.photoUrl, alt: '', loading: 'lazy' })),
    h('div', { class: 'recipe__body' }, [
      h('p', { class: 'recipe__title', text: recipe.title || '（タイトルなし）' }),
      [recipe.servings, recipe.tags.join('、')].filter(Boolean).join(' ・ ') &&
        h('p', { class: 'recipe__meta', text: [recipe.servings, recipe.tags.join('、')].filter(Boolean).join(' ・ ') }),
      recipe.ingredients.length &&
        h('p', { class: 'recipe__ingredients', text: recipe.ingredients.map((i) => i.name).join('、') }),
    ]),
  ]);
}

function emptyState(text) {
  return h('div', { class: 'empty' }, [
    h('div', { class: 'empty__icon' }, icon('restaurant', 28)),
    h('p', { class: 'empty__text', text }),
  ]);
}

async function viewList() {
  const all = await listRecipes();
  const resultsBox = h('div', {});

  function draw() {
    const query = normalizeSearchTerm(searchQuery);
    const lowerQuery = searchQuery.trim().toLowerCase();
    const shown = query
      ? all.filter((r) => r.ingredientNames.some((n) => n.includes(query)) || (r.title || '').toLowerCase().includes(lowerQuery))
      : all;

    resultsBox.replaceChildren(
      shown.length
        ? h('div', { class: 'recipes' }, shown.map(recipeCard))
        : emptyState(all.length ? '見つかりませんでした。別の材料名でも試してみてください。' : 'まだレシピが登録されていません')
    );
  }

  const searchInput = h('input', {
    type: 'search',
    value: searchQuery,
    placeholder: '材料名や料理名で探す（例：卵、豚肉）',
    enterkeyhint: 'search',
    autocomplete: 'off',
    onInput: (e) => {
      searchQuery = e.target.value;
      draw();
    },
  });

  draw();

  return [
    bar({
      title: 'レシピ帳',
      titleIcon: h('img', { class: 'bar__icon', src: 'icons/icon-192.png', alt: '' }),
      right: [
        h('button', { class: 'icon-btn', 'aria-label': 'まとめてインポート', title: 'まとめてインポート', onClick: () => go('/import') }, icon('upload')),
        h('button', { class: 'icon-btn', 'aria-label': '設定', onClick: () => go('/settings') }, icon('settings')),
      ],
    }),
    h('main', {}, [
      h('div', { class: 'search' }, [searchInput]),
      resultsBox,
    ]),
    h('button', { class: 'fab', 'aria-label': 'レシピを追加', onClick: () => go('/new') }, icon('add', 28)),
  ];
}

/* ---------- Recipe form fields ---------- */

function ingredientsField(draft) {
  const rows = h('div', { class: 'rows' });

  function renderRows() {
    rows.replaceChildren(
      ...draft.ingredients.map((ing, index) =>
        h('div', { class: 'row' }, [
          h('input', {
            type: 'text',
            placeholder: '材料名',
            value: ing.name,
            onInput: (e) => { draft.ingredients[index].name = e.target.value; },
          }),
          h('input', {
            type: 'text',
            placeholder: '分量',
            value: ing.amount,
            onInput: (e) => { draft.ingredients[index].amount = e.target.value; },
          }),
          h('button', {
            class: 'row__remove',
            'aria-label': 'この材料を削除',
            onClick: () => { draft.ingredients.splice(index, 1); renderRows(); },
          }, icon('close', 18)),
        ])
      )
    );
  }
  renderRows();

  return {
    node: h('div', { class: 'field' }, [
      h('label', { class: 'field__label', text: '材料' }),
      rows,
      h('button', {
        class: 'tonal',
        text: '＋ 材料を追加',
        onClick: () => { draft.ingredients.push({ name: '', amount: '' }); renderRows(); },
      }),
    ]),
    refresh: renderRows,
  };
}

function stepsField(draft) {
  const rows = h('div', { class: 'rows' });

  function renderRows() {
    rows.replaceChildren(
      ...draft.steps.map((step, index) =>
        h('div', { class: 'row row--step' }, [
          h('span', { class: 'row__num', text: String(index + 1) }),
          h('textarea', {
            rows: '2',
            placeholder: `手順 ${index + 1}`,
            onInput: (e) => { draft.steps[index] = e.target.value; },
          }, step),
          h('button', {
            class: 'row__remove',
            'aria-label': 'この手順を削除',
            onClick: () => { draft.steps.splice(index, 1); renderRows(); },
          }, icon('close', 18)),
        ])
      )
    );
  }
  renderRows();

  return {
    node: h('div', { class: 'field' }, [
      h('label', { class: 'field__label', text: '手順' }),
      rows,
      h('button', {
        class: 'tonal',
        text: '＋ 手順を追加',
        onClick: () => { draft.steps.push(''); renderRows(); },
      }),
    ]),
    refresh: renderRows,
  };
}

/* ---------- Add / Edit ---------- */

async function viewRecipeForm(id) {
  const isNew = !id;
  let draft;
  if (isNew) {
    const userName = getSetting(KEYS.userName);
    draft = createRecipe({ createdBy: userName, updatedBy: userName });
  } else {
    const existing = await getRecipe(id);
    if (!existing) return viewMissing();
    draft = {
      ...existing,
      ingredients: existing.ingredients.map((i) => ({ ...i })),
      steps: [...existing.steps],
      tags: [...existing.tags],
    };
  }

  const transcriptArea = h('textarea', {
    rows: '5',
    placeholder: '例：じゃがいも3個、豚バラ200グラム、しょうゆ大さじ2……材料と手順をざっくり話してください',
  });
  const aiStatus = h('p', { class: 'field__note' });

  function setMicState(live) {
    micButton.classList.toggle('tonal--live', live);
    micButton.replaceChildren(
      icon(live ? 'stop' : 'mic', 20),
      h('span', { text: live ? '聞いています…' : '音声で入力' })
    );
  }

  // Androidでは同じ確定結果がevent.resultIndexをまたいで再送されることがあり、
  // 単純に加算していくと同じ単語が何度も重複してしまう。直前の確定文言と
  // 発生時刻を覚えておき、極端に短い間隔で同一文言が来た場合は重複として無視する。
  let lastFinalChunk = '';
  let lastFinalAt = 0;

  function listen() {
    const recognition = new SpeechRecognition();
    recognition.lang = 'ja-JP';
    recognition.interimResults = true;
    // Android版Chromeはcontinuous:trueにすると数秒の無音で認識が打ち切られ、
    // 続きが復元されないまま話した内容の大半が失われる不具合があるため、
    // 1発話ごとに区切ってonendで再開する方式にする。
    recognition.continuous = false;

    const base = transcriptArea.value;
    const separator = base && !/\s$/.test(base) ? '\n' : '';
    // Android版ChromeはresultIndexが信頼できず、確定結果を何度も再送してくることがあるため、
    // 差分を加算するのではなく「直近の1件」だけを毎回の発話結果として扱う。
    let finalized = '';

    function applyText(interim) {
      transcriptArea.value = base + separator + finalized + interim;
      transcriptArea.scrollTop = transcriptArea.scrollHeight;
    }

    recognition.onstart = () => {
      activeRecognition = recognition;
      allowRecognitionRestart = true;
      setMicState(true);
      aiStatus.textContent = '';
    };
    recognition.onresult = (event) => {
      const last = event.results[event.results.length - 1];
      const text = last[0].transcript;
      if (last.isFinal) {
        const now = Date.now();
        const isEcho = text === lastFinalChunk && now - lastFinalAt < 1500;
        if (!isEcho) {
          finalized = text;
          lastFinalChunk = text;
          lastFinalAt = now;
        }
        applyText('');
      } else {
        applyText(text);
      }
    };
    recognition.onerror = (event) => {
      if (FATAL_SPEECH_ERRORS.has(event.error)) allowRecognitionRestart = false;
      if (event.error !== 'no-speech' && event.error !== 'aborted') {
        aiStatus.textContent = SPEECH_ERRORS[event.error] || '音声入力に失敗しました。';
      }
    };
    recognition.onend = () => {
      activeRecognition = null;
      if (allowRecognitionRestart) {
        // 直後に再開すると、直前の発話の余韻(残響)を同じ言葉として再度拾ってしまう
        // ことがあるため、わずかに間を空けてから次の認識を開始する。
        setTimeout(() => { if (allowRecognitionRestart) listen(); }, 300);
      } else {
        setMicState(false);
      }
    };
    recognition.start();
  }

  const micButton = SpeechRecognition && h('button', {
    class: 'tonal',
    onClick: () => {
      if (activeRecognition) {
        allowRecognitionRestart = false;
        activeRecognition.stop();
      } else {
        listen();
      }
    },
  }, [icon('mic', 20), h('span', { text: '音声で入力' })]);

  const titleInput = h('input', {
    type: 'text',
    value: draft.title,
    placeholder: '例：肉じゃが',
    onInput: (e) => { draft.title = e.target.value; },
  });

  const servingsInput = h('input', {
    type: 'text',
    value: draft.servings,
    placeholder: '例：2人分',
    onInput: (e) => { draft.servings = e.target.value; },
  });

  const ingredients = ingredientsField(draft);
  const steps = stepsField(draft);

  const tagsInput = h('input', {
    type: 'text',
    value: draft.tags.join('、'),
    placeholder: '例：和食、下味冷凍（読点で区切る）',
    onInput: (e) => { draft.tags = e.target.value.split(/[、,]/).map((s) => s.trim()).filter(Boolean); },
  });

  const memoInput = h('textarea', {
    rows: '3',
    placeholder: 'メモ（アレンジ・コツなど）',
    onInput: (e) => { draft.memo = e.target.value; },
  }, draft.memo);

  const aiButton = h('button', {
    class: 'tonal',
    onClick: async () => {
      const transcript = transcriptArea.value.trim();
      if (!transcript) { aiStatus.textContent = 'まず内容を話すか入力してください。'; return; }
      aiButton.disabled = true;
      aiStatus.textContent = 'AIが整形しています…';
      try {
        const result = await structureRecipe(transcript, {
          onRetry: (attempt, max) => {
            aiStatus.textContent = `混雑のため再試行しています…（${attempt}/${max}）`;
          },
        });
        if (result.title) { draft.title = result.title; titleInput.value = draft.title; }
        if (result.servings) { draft.servings = result.servings; servingsInput.value = draft.servings; }
        if (result.ingredients.length) { draft.ingredients = result.ingredients; ingredients.refresh(); }
        if (result.steps.length) { draft.steps = result.steps; steps.refresh(); }
        if (isNew) draft.sourceType = 'voice';
        aiStatus.textContent = '整形しました。内容を確認して保存してください。';
      } catch (error) {
        if (error instanceof MissingKeyError) {
          aiStatus.replaceChildren(
            'Gemini APIキーが未設定です。',
            h('button', { class: 'link', text: '設定を開く', onClick: () => go('/settings') })
          );
        } else {
          aiStatus.textContent = error.message;
        }
      } finally {
        aiButton.disabled = false;
      }
    },
  }, [icon('sparkle', 20), h('span', { text: 'AIで整形する' })]);

  const save = async () => {
    if (!draft.title.trim()) { toast('タイトルを入力してください'); return; }
    const userName = getSetting(KEYS.userName);
    draft.updatedBy = userName || draft.updatedBy;
    if (isNew) draft.createdBy = userName || draft.createdBy;
    await saveRecipe(draft);
    toast('保存しました');
    go(`/recipe/${draft.id}`);
  };

  return [
    bar({
      title: isNew ? 'レシピを追加' : 'レシピを編集',
      left: backButton(() => (isNew ? go('/') : history.back())),
    }),
    h('main', {}, [
      h('div', { class: 'card' }, [
        h('p', { class: 'card__label', text: '話す・書く（下書き）' }),
        transcriptArea,
        h('div', { class: 'row-inline' }, [micButton, aiButton].filter(Boolean)),
        aiStatus,
      ]),
      h('div', { class: 'card' }, [
        h('div', { class: 'field' }, [h('label', { class: 'field__label', text: '料理名' }), titleInput]),
        h('div', { class: 'field', style: { marginBottom: '0' } }, [h('label', { class: 'field__label', text: '分量・人数' }), servingsInput]),
      ]),
      photoField(draft),
      h('div', { class: 'card' }, [ingredients.node]),
      h('div', { class: 'card' }, [steps.node]),
      h('div', { class: 'card' }, [
        h('div', { class: 'field' }, [h('label', { class: 'field__label', text: 'タグ' }), tagsInput]),
        h('div', { class: 'field', style: { marginBottom: '0' } }, [h('label', { class: 'field__label', text: 'メモ' }), memoInput]),
      ]),
      h('button', { class: 'btn', text: '保存する', onClick: save }),
    ]),
  ];
}

/* ---------- Detail ---------- */

async function viewDetail(id) {
  const recipe = await getRecipe(id);
  if (!recipe) return viewMissing();

  const subtitle = [recipe.servings, recipe.tags.join('、')].filter(Boolean).join(' ・ ');

  return [
    bar({
      left: backButton(() => go('/')),
      right: h('button', { class: 'text-btn', text: '編集', onClick: () => go(`/edit/${recipe.id}`) }),
    }),
    h('main', {}, [
      recipe.photoUrl && h('img', { class: 'detail__photo', src: recipe.photoUrl, alt: '' }),
      h('h2', { class: 'detail__title', text: recipe.title || '（タイトルなし）' }),
      subtitle && h('p', { class: 'detail__sub', text: subtitle }),
      recipe.creator && h('p', {
        class: `detail__creator${recipe.creator === 'Akemi' ? ' detail__creator--red' : ''}`,
        text: `製作者：${recipe.creator}`,
      }),
      h('div', { class: 'card' }, [
        h('p', { class: 'card__label', text: '材料' }),
        recipe.ingredients.length
          ? h('ul', { class: 'ingredient-list' }, recipe.ingredients.map((i) =>
              h('li', {}, [
                h('span', { class: 'ingredient-list__name', text: i.name }),
                h('span', { class: 'ingredient-list__amount', text: i.amount }),
              ])
            ))
          : h('p', { class: 'field__note', text: '材料が登録されていません' }),
      ]),
      h('div', { class: 'card' }, [
        h('p', { class: 'card__label', text: '手順' }),
        recipe.steps.length
          ? h('ol', { class: 'steps' }, recipe.steps.map((s) => h('li', { text: s })))
          : h('p', { class: 'field__note', text: '手順が登録されていません' }),
      ]),
      recipe.memo && h('div', { class: 'card' }, [
        h('p', { class: 'card__label', text: 'メモ' }),
        h('p', { class: 'memo-text', text: recipe.memo }),
      ]),
      recipe.sourceUrl && h('div', { class: 'card' }, [
        h('p', { class: 'card__label', text: '出典' }),
        h('p', { class: 'field__note', text: SOURCE_LABEL[recipe.sourceType] || '' }),
        h('a', { class: 'link', href: recipe.sourceUrl, target: '_blank', rel: 'noopener', text: recipe.sourceUrl }),
      ]),
      h('p', { class: 'field__note credit', text: creditLine(recipe) }),
      h('button', {
        class: 'btn btn--quiet',
        text: 'このレシピを削除',
        onClick: async () => {
          if (!confirm(`「${recipe.title}」を削除します。よろしいですか？`)) return;
          await deleteRecipe(recipe.id);
          toast('削除しました');
          go('/');
        },
      }),
    ]),
  ];
}

/* ---------- Bulk import ---------- */

function readImageAsBase64(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve({ mimeType: file.type, data: reader.result.split(',')[1] });
    reader.onerror = () => reject(new Error('画像を読み込めませんでした。'));
    reader.readAsDataURL(file);
  });
}

/* Firestoreの1ドキュメントは1MBまでのため、写真は縮小・圧縮したJPEGをdata URLとして
   photoUrlフィールドに直接保存する（別ストレージを用意しない、いちばん手軽な方法）。 */
function readAndCompressImage(file, maxWidth = 900, quality = 0.75) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const img = new Image();
      img.onload = () => {
        const scale = Math.min(1, maxWidth / img.width);
        const canvas = document.createElement('canvas');
        canvas.width = Math.round(img.width * scale);
        canvas.height = Math.round(img.height * scale);
        canvas.getContext('2d').drawImage(img, 0, 0, canvas.width, canvas.height);
        resolve(canvas.toDataURL('image/jpeg', quality));
      };
      img.onerror = () => reject(new Error('画像を読み込めませんでした。'));
      img.src = reader.result;
    };
    reader.onerror = () => reject(new Error('画像を読み込めませんでした。'));
    reader.readAsDataURL(file);
  });
}

function photoField(draft) {
  const preview = h('img', { class: 'photo-field__preview', hidden: !draft.photoUrl, src: draft.photoUrl || '', alt: '' });
  const status = h('p', { class: 'field__note' });

  const removeButton = h('button', {
    class: 'tonal',
    hidden: !draft.photoUrl,
    text: '写真を削除',
    onClick: () => {
      draft.photoUrl = '';
      preview.hidden = true;
      removeButton.hidden = true;
      status.textContent = '';
    },
  });

  const fileInput = h('input', {
    type: 'file',
    accept: 'image/*',
    hidden: true,
    onChange: async (e) => {
      const file = e.target.files[0];
      if (!file) return;
      status.textContent = '読み込んでいます…';
      try {
        draft.photoUrl = await readAndCompressImage(file);
        preview.src = draft.photoUrl;
        preview.hidden = false;
        removeButton.hidden = false;
        status.textContent = '';
      } catch (error) {
        status.textContent = error.message;
      } finally {
        e.target.value = '';
      }
    },
  });

  const pickButton = h('button', {
    class: 'tonal',
    text: draft.photoUrl ? '写真を変更' : '写真を選択',
    onClick: () => fileInput.click(),
  });

  return h('div', { class: 'card' }, [
    h('p', { class: 'card__label', text: '写真' }),
    preview,
    h('div', { class: 'row-inline' }, [pickButton, removeButton]),
    fileInput,
    status,
  ]);
}

function viewImport() {
  const textArea = h('textarea', {
    rows: '10',
    placeholder: 'Notionのページやツイートの本文を貼り付けてください（複数レシピをまとめて貼ってもOK）。画像だけでも構いません。',
  });

  const imageStatus = h('p', { class: 'field__note' });
  const imageInput = h('input', {
    type: 'file',
    accept: 'image/*',
    multiple: true,
    hidden: true,
    onChange: () => {
      const count = imageInput.files.length;
      imageStatus.textContent = count ? `${count}枚の画像を選択中` : '';
    },
  });
  const imageButton = h('button', {
    class: 'tonal',
    text: '画像を選択（レシピカードやメモの写真など）',
    onClick: () => imageInput.click(),
  });

  const sourceTypeSelect = h('select', {}, [
    h('option', { value: 'notion', text: 'Notion' }),
    h('option', { value: 'twitter', text: 'Twitterのブックマーク' }),
    h('option', { value: 'manual', text: 'その他' }),
  ]);

  const status = h('p', { class: 'field__note' });
  const preview = h('div', {});
  let candidates = [];

  const saveButton = h('button', {
    class: 'btn',
    text: '選んだ分を保存する',
    hidden: true,
    onClick: async () => {
      const chosen = candidates.filter((c) => c.selected);
      if (!chosen.length) { toast('保存する項目を選んでください'); return; }
      const userName = getSetting(KEYS.userName);
      for (const c of chosen) {
        const recipe = createRecipe({
          title: c.title,
          servings: c.servings,
          ingredients: c.ingredients,
          steps: c.steps,
          sourceType: sourceTypeSelect.value,
          createdBy: userName,
          updatedBy: userName,
        });
        await saveRecipe(recipe);
      }
      toast(`${chosen.length}件を保存しました`);
      go('/');
    },
  });

  function drawPreview() {
    preview.replaceChildren(
      ...candidates.map((c, index) =>
        h('label', { class: 'import-card' }, [
          h('input', {
            type: 'checkbox',
            checked: c.selected,
            onChange: (e) => { candidates[index].selected = e.target.checked; },
          }),
          h('div', { class: 'import-card__body' }, [
            h('p', { class: 'import-card__title', text: c.title || '（タイトルなし）' }),
            h('p', { class: 'import-card__meta', text: c.ingredients.map((i) => i.name).join('、') || '材料なし' }),
          ]),
        ])
      )
    );
    saveButton.hidden = candidates.length === 0;
  }

  const convertButton = h('button', {
    class: 'btn',
    text: 'AIで変換する',
    onClick: async () => {
      const text = textArea.value.trim();
      const files = [...imageInput.files];
      if (!text && !files.length) { status.textContent = 'テキストを貼り付けるか、画像を選んでください。'; return; }
      convertButton.disabled = true;
      status.textContent = files.length ? '画像を読み込んでいます…' : 'AIが変換しています…';
      try {
        const images = await Promise.all(files.map(readImageAsBase64));
        status.textContent = 'AIが変換しています…';
        const results = await structureRecipes(text, images, {
          onRetry: (attempt, max) => {
            status.textContent = `混雑のため再試行しています…（${attempt}/${max}）`;
          },
        });
        if (!results.length) {
          status.textContent = 'レシピを読み取れませんでした。文章を見直してもう一度試してください。';
          candidates = [];
          drawPreview();
          return;
        }
        candidates = results.map((r) => ({ ...r, selected: true }));
        status.textContent = `${candidates.length}件のレシピを見つけました。登録する分だけ選んでください。`;
        drawPreview();
      } catch (error) {
        if (error instanceof MissingKeyError) {
          status.replaceChildren(
            'Gemini APIキーが未設定です。',
            h('button', { class: 'link', text: '設定を開く', onClick: () => go('/settings') })
          );
        } else {
          status.textContent = error.message;
        }
      } finally {
        convertButton.disabled = false;
      }
    },
  });

  return [
    bar({ title: 'まとめてインポート', left: backButton(() => go('/')) }),
    h('main', {}, [
      h('div', { class: 'card' }, [
        h('p', { class: 'card__label', text: '取り込み元' }),
        sourceTypeSelect,
      ]),
      h('div', { class: 'card' }, [
        h('p', { class: 'card__label', text: 'テキスト・画像' }),
        textArea,
        h('div', { class: 'row-inline' }, [imageButton]),
        imageInput,
        imageStatus,
        convertButton,
        status,
      ]),
      preview,
      saveButton,
    ]),
  ];
}

/* ---------- Settings ---------- */

function familyCard() {
  const user = currentUser();
  return h('div', { class: 'card' }, [
    h('p', { class: 'card__label', text: '家族との同期' }),
    h('p', { class: 'field__note', text: user ? `${user.email} でログイン中です。` : 'ログインしていません。' }),
    h('button', {
      class: 'tonal',
      style: { width: '100%', justifyContent: 'center' },
      text: 'ログアウト',
      onClick: async () => {
        await signOutUser();
        go('/');
      },
    }),
  ]);
}

function viewSettings() {
  const nameInput = h('input', {
    type: 'text',
    value: getSetting(KEYS.userName),
    placeholder: '例：さき',
    autocomplete: 'off',
  });

  const apiKeyInput = h('input', {
    type: 'password',
    value: getSetting(KEYS.geminiApiKey),
    autocomplete: 'off',
    placeholder: 'Gemini APIキー',
  });

  const reveal = h('button', {
    class: 'link',
    text: '表示する',
    onClick: () => {
      const hidden = apiKeyInput.type === 'password';
      apiKeyInput.type = hidden ? 'text' : 'password';
      reveal.textContent = hidden ? '隠す' : '表示する';
    },
  });

  const themes = { '': '自動', light: '明るい', dark: '暗い' };
  const themePills = h('div', { class: 'pills' },
    Object.entries(themes).map(([key, label]) =>
      h('button', {
        class: 'pill',
        'aria-pressed': String(key === getSetting(KEYS.theme)),
        text: label,
        onClick: (e) => {
          for (const pill of e.currentTarget.parentElement.children) {
            pill.setAttribute('aria-pressed', String(pill === e.currentTarget));
          }
          setSetting(KEYS.theme, key);
          applyTheme();
        },
      })
    )
  );

  return [
    bar({
      title: '設定',
      left: backButton(() => go('/')),
      right: h('button', {
        class: 'text-btn',
        text: '保存',
        onClick: () => {
          setSetting(KEYS.userName, nameInput.value.trim());
          setSetting(KEYS.geminiApiKey, apiKeyInput.value.trim());
          toast('保存しました');
          go('/');
        },
      }),
    }),
    h('main', {}, [
      h('div', { class: 'card' }, [
        h('p', { class: 'card__label', text: 'あなたの名前' }),
        nameInput,
        h('p', { class: 'field__note', text: 'レシピの登録者・更新者として記録されます。' }),
      ]),
      h('div', { class: 'card' }, [
        h('p', { class: 'card__label', text: 'Gemini API（音声入力のAI整形に使用）' }),
        apiKeyInput,
        h('p', { class: 'field__note' }, [
          'この端末の中だけに保存され、レシピの整形リクエスト以外には送られません。無料枠のキーは ',
          h('a', { class: 'link', href: 'https://aistudio.google.com/apikey', target: '_blank', rel: 'noopener', text: 'Google AI Studio' }),
          ' から取得できます。　',
          reveal,
        ]),
      ]),
      h('div', { class: 'card' }, [
        h('p', { class: 'card__label', text: '画面の明るさ' }),
        themePills,
      ]),
      familyCard(),
    ]),
  ];
}

function viewMissing() {
  return [
    bar({ left: backButton(() => go('/')) }),
    h('main', {}, emptyState('このレシピは見つかりませんでした')),
  ];
}

function viewLogin() {
  return h('div', { class: 'login' }, [
    h('img', { class: 'login__icon', src: 'icons/icon-192.png', alt: '' }),
    h('h1', { class: 'login__title', text: 'レシピ帳' }),
    h('p', { class: 'login__text', text: '家族で使うレシピ帳です。Googleアカウントでログインしてください。' }),
    h('button', {
      class: 'btn',
      text: 'Googleでログイン',
      onClick: async (e) => {
        e.currentTarget.disabled = true;
        try {
          await signIn();
        } catch (error) {
          toast('ログインできませんでした：' + error.message);
          e.currentTarget.disabled = false;
        }
      },
    }),
  ]);
}

/* ---------- Router ---------- */

async function render() {
  stopRecognition();

  if (!currentUser()) {
    app.replaceChildren(viewLogin());
    window.scrollTo(0, 0);
    return;
  }

  const path = location.hash.slice(1) || '/';
  const [, section, param] = path.split('/');

  let nodes;
  if (section === 'recipe' && param) nodes = await viewDetail(param);
  else if (section === 'edit' && param) nodes = await viewRecipeForm(param);
  else if (section === 'new') nodes = await viewRecipeForm();
  else if (section === 'import') nodes = viewImport();
  else if (section === 'settings') nodes = viewSettings();
  else nodes = await viewList();

  app.replaceChildren(...[].concat(nodes));
  window.scrollTo(0, 0);
}

applyTheme();
window.addEventListener('hashchange', render);
onChange(render);
onAuthChange((user) => {
  if (user) startSync();
  else stopSync();
  render();
});

if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => navigator.serviceWorker.register('./sw.js'));
}

navigator.storage?.persist?.();
