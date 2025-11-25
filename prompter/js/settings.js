// settings.js
class SettingsManager {
  constructor() {
    this.storageKey = 'prompter-settings';
    this.defaults = {
      fontSize: 'normal',
      scrollSpeed: 50,
      theme: 'dark',
      lineHeight: 'normal',
      showRuby: true,
      language: 'ja',
      version: '1.0'
    };
    this.settings = {};
    this.load();
  }

  // 設定を読み込む
  load() {
    try {
      const stored = localStorage.getItem(this.storageKey);
      if (stored) {
        const parsed = JSON.parse(stored);
        this.settings = { ...this.defaults, ...parsed };
        this.validate();
      } else {
        this.settings = { ...this.defaults };
      }
      
      // 言語設定をi18nモジュールに適用
      if (typeof i18n !== 'undefined' && this.settings.language) {
        i18n.setLanguage(this.settings.language);
      }
    } catch (error) {
      console.error('設定の読み込みに失敗:', error);
      this.settings = { ...this.defaults };
    }
    return this.settings;
  }

  // 設定を保存する
  save() {
    try {
      localStorage.setItem(this.storageKey, JSON.stringify(this.settings));
      this.fireChangeEvent();
      return true;
    } catch (error) {
      console.error('設定の保存に失敗:', error);
      return false;
    }
  }

  // 設定値を取得
  get(key) {
    return this.settings[key] !== undefined 
      ? this.settings[key] 
      : this.defaults[key];
  }

  // 設定値を設定
  set(key, value) {
    if (this.validateValue(key, value)) {
      this.settings[key] = value;
      this.save();
      this.applyToDOM();
      
      // 言語設定が変更された場合はi18nモジュールに適用
      if (key === 'language' && typeof i18n !== 'undefined') {
        i18n.setLanguage(value);
      }
      
      return true;
    }
    return false;
  }

  // すべての設定を取得
  getAll() {
    return { ...this.settings };
  }

  // すべての設定を設定
  setAll(settings) {
    this.settings = { ...this.defaults, ...settings };
    this.validate();
    this.save();
    this.applyToDOM();
  }

  // 設定値を検証
  validateValue(key, value) {
    switch (key) {
      case 'fontSize':
        return ['small', 'normal', 'large', 'xlarge', 'xxlarge', 'xxxlarge'].includes(value);
      case 'scrollSpeed':
        return typeof value === 'number' && value >= 10 && value <= 200;
      case 'theme':
        return ['dark', 'light', 'sepia'].includes(value);
      case 'lineHeight':
        return ['small', 'normal', 'large'].includes(value);
      case 'showRuby':
        return typeof value === 'boolean';
      case 'language':
        return ['ja', 'en', 'vi'].includes(value);
      default:
        return false;
    }
  }

  // すべての設定を検証
  validate() {
    Object.keys(this.defaults).forEach(key => {
      if (key === 'version') return; // versionは検証しない
      if (!this.validateValue(key, this.settings[key])) {
        this.settings[key] = this.defaults[key];
      }
    });
  }

  // デフォルト値にリセット
  reset() {
    this.settings = { ...this.defaults };
    this.save();
    this.applyToDOM();
  }

  // DOMに適用
  applyToDOM() {
    const body = document.body;
    const content = document.getElementById('prompter-content');
    
    if (!body || !content) return;

    // テーマクラス
    body.className = body.className.replace(/theme-\w+/g, '');
    body.classList.add(`theme-${this.get('theme')}`);

    // フォントサイズクラス
    content.className = content.className.replace(/font-\w+/g, '');
    content.classList.add(`font-${this.get('fontSize')}`);

    // 行間クラス
    content.className = content.className.replace(/line-height-\w+/g, '');
    content.classList.add(`line-height-${this.get('lineHeight')}`);

    // ふりがな表示
    if (this.get('showRuby')) {
      content.classList.remove('hide-ruby');
    } else {
      content.classList.add('hide-ruby');
    }
  }

  // 設定変更イベントを発火
  fireChangeEvent() {
    const event = new CustomEvent('settingsChanged', {
      detail: { settings: this.getAll() }
    });
    window.dispatchEvent(event);
  }
}

// シングルトンインスタンスをエクスポート
const settingsManager = new SettingsManager();

