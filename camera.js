/* 手書きメモを撮るための画面内カメラ。
   ファイル選択だとアルバムが開き、先にメモを撮って保存しておく必要があるため、
   カメラをすぐ起動し、左下のボタンからアルバムの写真も選べるようにしている。 */

const MAX_WIDTH = 1600; // 手書き文字が潰れず、送信が重くなりすぎない大きさ
const LIVE_MESSAGE = 'メモ全体が入るように撮ってください';

let closeActive = null;

/* 画面を移動するときにカメラを止める。 */
export function closeCamera() {
  closeActive?.();
}

/* h, icon: app.js のDOMヘルパー
   onCapture({ mimeType, data }): 撮った写真で読み取るとき
   onPickFromAlbum(): 左下のボタンが押されたとき（タップの処理中に呼ぶので、そのままファイル選択を開ける） */
export function openCamera({ h, icon, onCapture, onPickFromAlbum }) {
  closeCamera();
  let stream = null;
  let captured = null;

  const video = h('video', { class: 'camera__media', autoplay: true, playsinline: true, muted: true });
  const still = h('img', { class: 'camera__media', alt: '', hidden: true });
  const message = h('p', { class: 'camera__message', text: LIVE_MESSAGE });

  const shutter = h('button', { class: 'camera__shutter', 'aria-label': '撮影する', disabled: true, onClick: shoot });
  const liveBar = h('div', { class: 'camera__bar' }, [
    h('button', {
      class: 'camera__album',
      'aria-label': 'アルバムから選ぶ',
      onClick: () => { close(); onPickFromAlbum(); },
    }, icon('album', 28)),
    shutter,
    h('span'),
  ]);
  const reviewBar = h('div', { class: 'camera__bar camera__bar--review', hidden: true }, [
    h('button', { class: 'camera__text-btn', text: '撮り直す', onClick: () => setReviewing(false) }),
    h('button', {
      class: 'camera__text-btn camera__text-btn--primary',
      text: 'この写真で読み取る',
      onClick: () => { const image = captured; close(); onCapture(image); },
    }),
  ]);

  const root = h('div', { class: 'camera', role: 'dialog', 'aria-label': 'メモを撮影' }, [
    h('div', { class: 'camera__top' }, [
      h('button', { class: 'camera__close', 'aria-label': '閉じる', onClick: () => close() }, icon('close', 26)),
      message,
    ]),
    h('div', { class: 'camera__view' }, [video, still]),
    liveBar,
    reviewBar,
  ]);

  function close() {
    stream?.getTracks().forEach((track) => track.stop());
    root.remove();
    if (closeActive === close) closeActive = null;
  }

  function setReviewing(reviewing) {
    video.hidden = reviewing;
    still.hidden = !reviewing;
    liveBar.hidden = reviewing;
    reviewBar.hidden = !reviewing;
    message.textContent = reviewing ? '文字がはっきり写っているか確認してください' : LIVE_MESSAGE;
  }

  function shoot() {
    if (!video.videoWidth) return;
    const scale = Math.min(1, MAX_WIDTH / video.videoWidth);
    const canvas = document.createElement('canvas');
    canvas.width = Math.round(video.videoWidth * scale);
    canvas.height = Math.round(video.videoHeight * scale);
    canvas.getContext('2d').drawImage(video, 0, 0, canvas.width, canvas.height);
    const dataUrl = canvas.toDataURL('image/jpeg', 0.85);
    captured = { mimeType: 'image/jpeg', data: dataUrl.split(',')[1] };
    still.src = dataUrl;
    setReviewing(true);
  }

  async function startStream() {
    try {
      if (!navigator.mediaDevices?.getUserMedia) throw new Error('unsupported');
      const media = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: 'environment', width: { ideal: 1920 }, height: { ideal: 1920 } },
        audio: false,
      });
      if (closeActive !== close) {
        // 許可を待っている間に閉じられた
        media.getTracks().forEach((track) => track.stop());
        return;
      }
      stream = media;
      video.srcObject = media;
      await video.play().catch(() => {});
      shutter.disabled = false;
    } catch (error) {
      message.textContent = error.name === 'NotAllowedError'
        ? 'カメラの使用が許可されていません。左下のボタンからアルバムの写真を選べます。'
        : 'カメラを起動できませんでした。左下のボタンからアルバムの写真を選べます。';
    }
  }

  closeActive = close;
  document.body.append(root);
  startStream();
}
