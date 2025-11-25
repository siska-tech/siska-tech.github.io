// i18n.js
// 多言語対応モジュール

class I18n {
  constructor() {
    this.currentLanguage = 'ja'; // デフォルトは日本語
    this.translations = {
      ja: {
        // ヘッダー
        'settings': '設定',
        'file': 'ファイル',
        'fullscreen': '全画面',
        'header-minimize': 'ヘッダーを最小化',
        'header-expand': 'ヘッダーを展開',
        
        // コントロールバー
        'play': '再生',
        'pause': '一時停止',
        'speed-decrease': 'スクロール速度を遅くする',
        'speed-increase': 'スクロール速度を速くする',
        'speed-decrease-btn': '速度−',
        'speed-increase-btn': '速度＋',
        'reset': 'リセット',
        'control-bar-minimize': 'コントロールバーを最小化',
        'control-bar-expand': 'コントロールバーを展開',
        
        // 設定モーダル
        'settings-title': '設定',
        'close': '閉じる',
        'font-size': 'フォントサイズ',
        'scroll-speed': 'スクロール速度',
        'theme': 'テーマ',
        'line-height': '行間調整',
        'ruby-display': 'ふりがな表示',
        'language': '言語',
        
        // テーマ
        'theme-dark': 'ダーク',
        'theme-light': 'ライト',
        'theme-sepia': 'セピア',
        
        // フォントサイズ
        'font-small': '小',
        'font-normal': '標準',
        'font-large': '大',
        'font-xlarge': '最大',
        
        // スクロール速度
        'speed-slow': '遅い',
        'speed-slowish': 'やや遅い',
        'speed-normal': '標準',
        'speed-fastish': 'やや速い',
        'speed-fast': '速い',
        
        // 行間
        'line-narrow': '狭い',
        'line-narrowish': 'やや狭い',
        'line-normal': '標準',
        'line-wideish': 'やや広い',
        'line-wide': '広い',
        
        // 言語
        'lang-ja': '日本語',
        'lang-en': 'English',
        'lang-vi': 'Tiếng Việt',
        
        // プレースホルダー
        'placeholder': 'ファイルを選択して原稿を表示してください',
        
        // エラーメッセージ
        'error-file-type': 'Markdownファイルを選択してください。',
        'error-file-load': 'ファイルの読み込みに失敗しました。\nエラー: {error}',
        
        // アクセシビリティ
        'aria-settings-open': '設定画面を開く',
        'aria-file-select': 'ファイルを選択',
        'aria-fullscreen': '全画面表示',
        'aria-prompter-content': 'プロンプター原稿',
        'aria-controls': 'プロンプターコントロール'
      },
      en: {
        // Header
        'settings': 'Settings',
        'file': 'File',
        'fullscreen': 'Fullscreen',
        'header-minimize': 'Minimize header',
        'header-expand': 'Expand header',
        
        // Control bar
        'play': 'Play',
        'pause': 'Pause',
        'speed-decrease': 'Decrease scroll speed',
        'speed-increase': 'Increase scroll speed',
        'speed-decrease-btn': 'Speed−',
        'speed-increase-btn': 'Speed＋',
        'reset': 'Reset',
        'control-bar-minimize': 'Minimize control bar',
        'control-bar-expand': 'Expand control bar',
        
        // Settings modal
        'settings-title': 'Settings',
        'close': 'Close',
        'font-size': 'Font Size',
        'scroll-speed': 'Scroll Speed',
        'theme': 'Theme',
        'line-height': 'Line Height',
        'ruby-display': 'Ruby Display',
        'language': 'Language',
        
        // Themes
        'theme-dark': 'Dark',
        'theme-light': 'Light',
        'theme-sepia': 'Sepia',
        
        // Font sizes
        'font-small': 'Small',
        'font-normal': 'Normal',
        'font-large': 'Large',
        'font-xlarge': 'X-Large',
        
        // Scroll speeds
        'speed-slow': 'Slow',
        'speed-slowish': 'Somewhat Slow',
        'speed-normal': 'Normal',
        'speed-fastish': 'Somewhat Fast',
        'speed-fast': 'Fast',
        
        // Line heights
        'line-narrow': 'Narrow',
        'line-narrowish': 'Somewhat Narrow',
        'line-normal': 'Normal',
        'line-wideish': 'Somewhat Wide',
        'line-wide': 'Wide',
        
        // Languages
        'lang-ja': '日本語',
        'lang-en': 'English',
        'lang-vi': 'Tiếng Việt',
        
        // Placeholder
        'placeholder': 'Please select a file to display the script',
        
        // Error messages
        'error-file-type': 'Please select a Markdown file.',
        'error-file-load': 'Failed to load file.\nError: {error}',
        
        // Accessibility
        'aria-settings-open': 'Open settings',
        'aria-file-select': 'Select file',
        'aria-fullscreen': 'Fullscreen',
        'aria-prompter-content': 'Prompter script',
        'aria-controls': 'Prompter controls'
      },
      vi: {
        // Header
        'settings': 'Cài đặt',
        'file': 'Tệp',
        'fullscreen': 'Toàn màn hình',
        'header-minimize': 'Thu nhỏ tiêu đề',
        'header-expand': 'Mở rộng tiêu đề',
        
        // Control bar
        'play': 'Phát',
        'pause': 'Tạm dừng',
        'speed-decrease': 'Giảm tốc độ cuộn',
        'speed-increase': 'Tăng tốc độ cuộn',
        'speed-decrease-btn': 'Tốc độ−',
        'speed-increase-btn': 'Tốc độ＋',
        'reset': 'Đặt lại',
        'control-bar-minimize': 'Thu nhỏ thanh điều khiển',
        'control-bar-expand': 'Mở rộng thanh điều khiển',
        
        // Settings modal
        'settings-title': 'Cài đặt',
        'close': 'Đóng',
        'font-size': 'Cỡ chữ',
        'scroll-speed': 'Tốc độ cuộn',
        'theme': 'Giao diện',
        'line-height': 'Khoảng cách dòng',
        'ruby-display': 'Hiển thị ruby',
        'language': 'Ngôn ngữ',
        
        // Themes
        'theme-dark': 'Tối',
        'theme-light': 'Sáng',
        'theme-sepia': 'Sepia',
        
        // Font sizes
        'font-small': 'Nhỏ',
        'font-normal': 'Bình thường',
        'font-large': 'Lớn',
        'font-xlarge': 'Rất lớn',
        
        // Scroll speeds
        'speed-slow': 'Chậm',
        'speed-slowish': 'Hơi chậm',
        'speed-normal': 'Bình thường',
        'speed-fastish': 'Hơi nhanh',
        'speed-fast': 'Nhanh',
        
        // Line heights
        'line-narrow': 'Hẹp',
        'line-narrowish': 'Hơi hẹp',
        'line-normal': 'Bình thường',
        'line-wideish': 'Hơi rộng',
        'line-wide': 'Rộng',
        
        // Languages
        'lang-ja': '日本語',
        'lang-en': 'English',
        'lang-vi': 'Tiếng Việt',
        
        // Placeholder
        'placeholder': 'Vui lòng chọn tệp để hiển thị kịch bản',
        
        // Error messages
        'error-file-type': 'Vui lòng chọn tệp Markdown.',
        'error-file-load': 'Không thể tải tệp.\nLỗi: {error}',
        
        // Accessibility
        'aria-settings-open': 'Mở cài đặt',
        'aria-file-select': 'Chọn tệp',
        'aria-fullscreen': 'Toàn màn hình',
        'aria-prompter-content': 'Kịch bản prompter',
        'aria-controls': 'Điều khiển prompter'
      }
    };
    
    // ブラウザの言語設定を取得
    this.detectLanguage();
  }
  
  // ブラウザの言語を検出
  detectLanguage() {
    const browserLang = navigator.language || navigator.userLanguage;
    const langCode = browserLang.split('-')[0].toLowerCase();
    
    // サポートされている言語かチェック
    if (this.translations[langCode]) {
      this.currentLanguage = langCode;
    } else {
      // デフォルトは日本語
      this.currentLanguage = 'ja';
    }
    
    // LocalStorageから保存された言語設定を読み込む
    const savedLang = localStorage.getItem('prompter-language');
    if (savedLang && this.translations[savedLang]) {
      this.currentLanguage = savedLang;
    }
  }
  
  // 翻訳を取得
  t(key, params = {}) {
    const translation = this.translations[this.currentLanguage]?.[key] || 
                       this.translations['ja'][key] || 
                       key;
    
    // パラメータ置換
    let result = translation;
    Object.keys(params).forEach(param => {
      result = result.replace(`{${param}}`, params[param]);
    });
    
    return result;
  }
  
  // 言語を設定
  setLanguage(lang) {
    if (this.translations[lang]) {
      this.currentLanguage = lang;
      localStorage.setItem('prompter-language', lang);
      this.updateUI();
      return true;
    }
    return false;
  }
  
  // 現在の言語を取得
  getLanguage() {
    return this.currentLanguage;
  }
  
  // UIを更新（すべてのdata-i18n属性を持つ要素を更新）
  updateUI() {
    const elements = document.querySelectorAll('[data-i18n]');
    elements.forEach(element => {
      const key = element.getAttribute('data-i18n');
      const text = this.t(key);
      
      // select要素のoptionの場合は特別処理
      if (element.tagName === 'OPTION') {
        element.textContent = text;
      } else {
        // ボタンのテキスト要素を更新
        if (element.classList.contains('btn-text')) {
          element.textContent = text;
        } else {
          element.textContent = text;
        }
      }
      
      // aria-labelも更新
      if (element.hasAttribute('aria-label')) {
        const ariaKey = element.getAttribute('aria-label');
        if (ariaKey.startsWith('i18n:')) {
          element.setAttribute('aria-label', this.t(ariaKey.substring(5)));
        }
      }
    });
    
    // HTMLのlang属性を更新
    document.documentElement.setAttribute('lang', this.currentLanguage);
    
    // プレースホルダーテキストを更新
    const placeholder = document.querySelector('.placeholder-text');
    if (placeholder) {
      placeholder.textContent = this.t('placeholder');
    }
    
    // 言語変更イベントを発火
    window.dispatchEvent(new CustomEvent('languageChanged', {
      detail: { language: this.currentLanguage }
    }));
  }
  
  // 利用可能な言語リストを取得
  getAvailableLanguages() {
    return Object.keys(this.translations).map(lang => ({
      code: lang,
      name: this.translations[lang][`lang-${lang}`] || lang
    }));
  }
}

// シングルトンインスタンスをエクスポート
const i18n = new I18n();

