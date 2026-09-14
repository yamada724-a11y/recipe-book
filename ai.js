const GEMINI_MODEL = 'gemini-2.0-flash';
const GEMINI_ENDPOINT = `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent`;

export const KEYS = {
  geminiApiKey: 'rb.geminiApiKey',
  userName: 'rb.userName',
  theme: 'rb.theme',
  familyEnabled: 'rb.familyEnabled',
};

export function getSetting(key) {
  return localStorage.getItem(key) || '';
}

export function setSetting(key, value) {
  if (value) localStorage.setItem(key, value);
  else localStorage.removeItem(key);
}

export class MissingKeyError extends Error {}

const SINGLE_SCHEMA = `{"title":"料理名","servings":"分量・人数（不明なら空文字）","ingredients":[{"name":"一般的な表記に正規化した材料名（『玉ねぎ』『鶏もも肉』のように。単位や商品名は含めない）","amount":"分量（不明なら空文字）"}],"steps":["手順を短い一文ずつに分割した配列（順序を保つ）"]}`;

const BULK_SCHEMA = `{"recipes":[${SINGLE_SCHEMA}]}`;

function buildPrompt(schema, transcript) {
  return [
    'あなたは料理レシピの構造化アシスタントです。',
    '以下はユーザーが音声入力またはメモとして書いた、料理レシピの粗い書き起こしです。',
    '次のJSON形式のみを出力してください（説明文やコードブロック記号は不要です）。',
    schema,
    '書き起こしの誤字・重複・言い直しは文脈から補正してください。情報が不足する項目は無理に埋めず空文字/空配列にしてください。',
    schema.includes('"recipes"') ? '複数のレシピが含まれる場合は、レシピごとに配列の要素を分けてください。' : '',
    `書き起こし: """${transcript}"""`,
  ].filter(Boolean).join('\n');
}

async function callGemini(parts) {
  const apiKey = getSetting(KEYS.geminiApiKey);
  if (!apiKey) throw new MissingKeyError();

  const url = new URL(GEMINI_ENDPOINT);
  url.searchParams.set('key', apiKey);

  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      contents: [{ parts }],
      generationConfig: { responseMimeType: 'application/json' },
    }),
  });

  if (!res.ok) {
    const detail = await res.json().catch(() => null);
    const reason = detail?.error?.message || '';
    throw new Error(`Gemini APIがエラーを返しました（${res.status}）${reason ? `：${reason}` : ''}`);
  }

  const data = await res.json();
  const text = data.candidates?.[0]?.content?.parts?.map((p) => p.text).join('') || '';
  try {
    return JSON.parse(text);
  } catch {
    throw new Error('AIの応答を読み取れませんでした。もう一度試してください。');
  }
}

function cleanIngredients(list) {
  return (Array.isArray(list) ? list : [])
    .map((item) => ({ name: (item?.name || '').trim(), amount: (item?.amount || '').trim() }))
    .filter((item) => item.name);
}

function cleanSteps(list) {
  return (Array.isArray(list) ? list : []).map((step) => (step || '').trim()).filter(Boolean);
}

function cleanRecipe(raw) {
  return {
    title: (raw?.title || '').trim(),
    servings: (raw?.servings || '').trim(),
    ingredients: cleanIngredients(raw?.ingredients),
    steps: cleanSteps(raw?.steps),
  };
}

export async function structureRecipe(transcript) {
  const raw = await callGemini([{ text: buildPrompt(SINGLE_SCHEMA, transcript) }]);
  return cleanRecipe(raw);
}

function buildBulkPrompt(text, hasImages) {
  return [
    'あなたは料理レシピの構造化アシスタントです。',
    hasImages
      ? 'SNSでブックマークした、料理レシピの画像' + (text ? 'とテキスト' : '') + 'を渡します。画像には、レシピカードのスクリーンショットや、手順が書かれた投稿、手書きメモの写真などが含まれます。'
      : '以下はSNSでブックマークした、料理レシピの投稿文です。',
    '複数のレシピが含まれる場合は、レシピごとに配列の要素を分けてください。画像が複数枚ある場合、1枚が1レシピとは限りません（同じレシピの続きの画像であることもあります）。内容から判断してください。',
    '次のJSON形式のみを出力してください（説明文やコードブロック記号は不要です）。',
    BULK_SCHEMA,
    '情報が不足する項目は無理に埋めず空文字/空配列にしてください。',
    text ? `テキスト: """${text}"""` : '',
  ].filter(Boolean).join('\n');
}

/* text: 貼り付けたテキスト（空文字可）。images: [{ mimeType, data(base64) }]（省略可）。 */
export async function structureRecipes(text, images = []) {
  const parts = [{ text: buildBulkPrompt(text, images.length > 0) }];
  for (const image of images) {
    parts.push({ inlineData: { mimeType: image.mimeType, data: image.data } });
  }
  const raw = await callGemini(parts);
  const list = Array.isArray(raw?.recipes) ? raw.recipes : [];
  return list.map(cleanRecipe).filter((recipe) => recipe.title || recipe.ingredients.length);
}
