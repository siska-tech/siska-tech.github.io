// =============================================================================
// 薙刀式キーボードガイドの描画とハイライト
// =============================================================================
(function () {
  const SHIFT_CLASS = { small: 'shift-small', daku: 'shift-daku', handaku: 'shift-handaku' };

  function buildHalf(rows, side) {
    const half = document.createElement('div');
    half.className = `kb-half kb-${side}`;
    for (const row of rows) {
      const rowEl = document.createElement('div');
      rowEl.className = 'kb-row';
      for (const key of row) {
        const el = document.createElement('div');
        el.className = 'kb-key';
        if (key.fn) el.classList.add('kb-fn');
        if (key.shift) el.classList.add(SHIFT_CLASS[key.shift]);
        el.dataset.key = key.id;
        el.innerHTML =
          `<span class="kb-main">${key.main}</span>` +
          `<span class="kb-sub">${key.sub || ''}</span>` +
          `<span class="kb-qwerty">${key.id === ';' ? ';' : key.id.toUpperCase()}</span>`;
        rowEl.appendChild(el);
      }
      half.appendChild(rowEl);
    }
    // センターシフト(スペース)キー
    const spaceRow = document.createElement('div');
    spaceRow.className = 'kb-row kb-space-row';
    const space = document.createElement('div');
    space.className = 'kb-key kb-space shift-center';
    space.dataset.key = 'SP';
    space.innerHTML = '<span class="kb-main">シフト</span><span class="kb-qwerty">SPACE</span>';
    spaceRow.appendChild(space);
    half.appendChild(spaceRow);
    return half;
  }

  function renderKeyboard(container) {
    container.innerHTML = '';
    container.appendChild(buildHalf(KEYBOARD.left, 'left'));
    container.appendChild(buildHalf(KEYBOARD.right, 'right'));
  }

  // 現在の単位に必要なキーをハイライトする
  function highlightKeys(container, unit) {
    for (const el of container.querySelectorAll('.kb-key.hit')) {
      el.classList.remove('hit');
    }
    if (!unit) return;
    let keys = unit.keys;
    if (!keys) {
      // 結合単位がキー表に無い場合は先頭かなのキーで代用
      keys = KANA_KEYS[[...unit.text][0]] || [];
    }
    for (const k of keys) {
      for (const el of container.querySelectorAll(`.kb-key[data-key="${CSS.escape(k)}"]`)) {
        el.classList.add('hit');
      }
    }
  }

  Object.assign(globalThis, { renderKeyboard, highlightKeys });
})();
