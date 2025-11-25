// app.js
// プロンプターアプリのメインアプリケーションロジック

class PrompterApp {
  constructor() {
    // DOM要素の参照
    this.fileInput = document.getElementById('file-input');
    this.main = document.getElementById('main'); // スクロール対象（実際にスクロールする要素）
    this.content = document.getElementById('prompter-content'); // コンテンツ表示要素
    this.header = document.getElementById('header');
    this.controlBar = document.getElementById('control-bar');
    this.settingsModal = document.getElementById('settings-modal');
    
    // ボタン要素
    this.settingsBtn = document.getElementById('settings-btn');
    this.fileBtn = document.getElementById('file-btn');
    this.fullscreenBtn = document.getElementById('fullscreen-btn');
    this.headerToggle = document.getElementById('header-toggle');
    this.playBtn = document.getElementById('play-btn');
    this.pauseBtn = document.getElementById('pause-btn');
    this.speedDecreaseBtn = document.getElementById('speed-decrease-btn');
    this.speedIncreaseBtn = document.getElementById('speed-increase-btn');
    this.resetBtn = document.getElementById('reset-btn');
    this.controlBarToggle = document.getElementById('control-bar-toggle');
    this.settingsCloseBtn = document.getElementById('settings-close-btn');
    
    // 設定モーダルのUI要素
    this.fontSizeSlider = document.getElementById('font-size-slider');
    this.scrollSpeedSlider = document.getElementById('scroll-speed-slider');
    this.themeRadios = document.querySelectorAll('input[name="theme"]');
    this.textAlignRadios = document.querySelectorAll('input[name="text-align"]');
    this.lineHeightSlider = document.getElementById('line-height-slider');
    this.rubyDisplayToggle = document.getElementById('ruby-display-toggle');
    this.languageSelect = document.getElementById('language-select');
    
    // アプリケーション状態
    this.isPlaying = false;
    this.scrollSpeed = 50; // ピクセル/秒
    this.animationFrameId = null;
    this.scrollStartTime = null;
    this.scrollStartPosition = 0;
    this.wakeLock = null;
    this.highlightInterval = null;
    this.currentHighlightElement = null;
    this.scrollInterval = null; // フォールバック用のsetInterval
    this.lastUpdateTime = null; // 最後の更新時刻
    
    // スクロール速度の段階設定（ピクセル/秒）
    this.speedLevels = [10, 25, 50, 75, 100]; // 遅い、やや遅い、標準、やや速い、速い
    this.currentSpeedLevel = 2; // 標準（インデックス2）
    
    // 依存モジュールの確認
    if (typeof markdownParser === 'undefined') {
      console.error('markdownParser が読み込まれていません');
    }
    if (typeof settingsManager === 'undefined') {
      console.error('settingsManager が読み込まれていません');
    }
    if (typeof i18n === 'undefined') {
      console.error('i18n が読み込まれていません');
    }
    
    // 初期化
    this.initializeUI();
    this.setupEventListeners();
    this.loadSettings();
    this.updateUIFromSettings();
    this.initializeLanguage();
  }

  // UI初期化
  initializeUI() {
    // 設定モーダルは初期状態で非表示
    if (this.settingsModal) {
      this.settingsModal.classList.add('hidden');
    }
    
    // 再生/一時停止ボタンの初期状態
    if (this.playBtn) {
      this.playBtn.classList.remove('hidden');
    }
    if (this.pauseBtn) {
      this.pauseBtn.classList.add('hidden');
    }
  }

  // イベントリスナーの設定
  setupEventListeners() {
    // ファイル関連
    if (this.fileBtn) {
      this.fileBtn.addEventListener('click', () => {
        this.fileInput?.click();
      });
    }
    
    if (this.fileInput) {
      this.fileInput.addEventListener('change', (e) => {
        const file = e.target.files[0];
        if (file) {
          this.loadFile(file);
        }
      });
    }

    // ヘッダー関連
    if (this.settingsBtn) {
      this.settingsBtn.addEventListener('click', () => {
        this.openSettingsModal();
      });
    }

    if (this.fullscreenBtn) {
      this.fullscreenBtn.addEventListener('click', () => {
        this.toggleFullscreen();
      });
    }

    if (this.headerToggle) {
      this.headerToggle.addEventListener('click', () => {
        this.toggleHeader();
      });
    }

    // コントロールバー関連
    if (this.playBtn) {
      this.playBtn.addEventListener('click', () => {
        this.startAutoScroll();
      });
    }

    if (this.pauseBtn) {
      this.pauseBtn.addEventListener('click', () => {
        this.stopAutoScroll();
      });
    }

    if (this.speedDecreaseBtn) {
      this.speedDecreaseBtn.addEventListener('click', () => {
        this.decreaseSpeed();
      });
    }

    if (this.speedIncreaseBtn) {
      this.speedIncreaseBtn.addEventListener('click', () => {
        this.increaseSpeed();
      });
    }

    if (this.resetBtn) {
      this.resetBtn.addEventListener('click', () => {
        this.resetScrollPosition();
      });
    }

    if (this.controlBarToggle) {
      this.controlBarToggle.addEventListener('click', () => {
        this.toggleControlBar();
      });
    }

    // 設定モーダル関連
    if (this.settingsCloseBtn) {
      this.settingsCloseBtn.addEventListener('click', () => {
        this.closeSettingsModal();
      });
    }

    // 設定モーダルのオーバーレイクリックで閉じる
    const overlay = document.querySelector('.settings-modal-overlay');
    if (overlay) {
      overlay.addEventListener('click', () => {
        this.closeSettingsModal();
      });
    }

    // 設定スライダー/トグルの変更イベント
    if (this.fontSizeSlider) {
      this.fontSizeSlider.addEventListener('input', (e) => {
        this.updateFontSize(e.target.value);
      });
    }

    if (this.scrollSpeedSlider) {
      this.scrollSpeedSlider.addEventListener('input', (e) => {
        this.updateScrollSpeedFromSlider(e.target.value);
      });
    }

    if (this.themeRadios.length > 0) {
      this.themeRadios.forEach(radio => {
        radio.addEventListener('change', (e) => {
          if (e.target.checked) {
            this.updateTheme(e.target.value);
          }
        });
      });
    }

    if (this.textAlignRadios.length > 0) {
      this.textAlignRadios.forEach(radio => {
        radio.addEventListener('change', (e) => {
          if (e.target.checked) {
            this.updateTextAlign(e.target.value);
          }
        });
      });
    }

    if (this.lineHeightSlider) {
      this.lineHeightSlider.addEventListener('input', (e) => {
        this.updateLineHeight(e.target.value);
      });
    }

    if (this.rubyDisplayToggle) {
      this.rubyDisplayToggle.addEventListener('change', (e) => {
        this.updateRubyDisplay(e.target.checked);
      });
    }

    // 言語選択
    if (this.languageSelect) {
      this.languageSelect.addEventListener('change', (e) => {
        this.updateLanguage(e.target.value);
      });
    }

    // 言語変更イベントをリッスン
    window.addEventListener('languageChanged', (e) => {
      this.onLanguageChanged(e.detail.language);
    });

    // キーボードショートカット
    document.addEventListener('keydown', (e) => {
      this.handleKeyboardShortcut(e);
    });

    // 手動スクロール検知（自動スクロールを一時停止）
    if (this.main) {
      let scrollTimeout;
      this.main.addEventListener('scroll', () => {
        if (this.isPlaying) {
          // 手動スクロールが検知された場合は一時停止（オプション）
          // この動作は要件により異なるため、コメントアウト
          // this.stopAutoScroll();
        }
        
        // スクロール終了を検知（デバウンス）
        clearTimeout(scrollTimeout);
        scrollTimeout = setTimeout(() => {
          // スクロール終了時の処理（必要に応じて）
        }, 150);
      });
    }

    // フルスクリーン状態の変更を監視
    document.addEventListener('fullscreenchange', () => {
      this.updateFullscreenButton();
    });
    document.addEventListener('webkitfullscreenchange', () => {
      this.updateFullscreenButton();
    });
    document.addEventListener('mozfullscreenchange', () => {
      this.updateFullscreenButton();
    });
    document.addEventListener('MSFullscreenChange', () => {
      this.updateFullscreenButton();
    });

    // 設定変更イベントをリッスン
    window.addEventListener('settingsChanged', (e) => {
      this.onSettingsChanged(e.detail.settings);
    });
    
    // Page Visibility API: ページが非表示になった場合でもスクロールを継続
    document.addEventListener('visibilitychange', () => {
      if (this.isPlaying) {
        if (document.hidden) {
          // ページが非表示になった場合、lastUpdateTimeをリセットして正確な時間計算を維持
          this.lastUpdateTime = null;
        } else {
          // ページが再表示された場合、スクロール位置を再計算
          if (this.main) {
            const currentTime = performance.now();
            const elapsed = (currentTime - this.scrollStartTime) / 1000;
            const scrollDistance = this.scrollSpeed * elapsed;
            const targetScrollTop = this.scrollStartPosition + scrollDistance;
            const maxScrollTop = this.main.scrollHeight - this.main.clientHeight;
            
            if (targetScrollTop < maxScrollTop) {
              this.main.scrollTop = targetScrollTop;
            } else {
              this.main.scrollTop = maxScrollTop;
            }
            
            this.lastUpdateTime = currentTime;
          }
        }
      }
    });
  }

  // ファイル読み込み
  async loadFile(file) {
    if (!file) {
      const message = typeof i18n !== 'undefined' ? i18n.t('error-file-type') : 'ファイルを選択してください。';
      alert(message);
      return;
    }
    
    // .md または .txt ファイルのみ受け付ける
    const isValidFile = file.name.toLowerCase().endsWith('.md') || file.name.toLowerCase().endsWith('.txt');
    if (!isValidFile) {
      const message = typeof i18n !== 'undefined' ? i18n.t('error-file-type') : 'Markdownファイルまたはテキストファイルを選択してください。';
      alert(message);
      return;
    }
    
    const isTextFile = file.name.toLowerCase().endsWith('.txt');

    // PromiseベースのFileReaderラッパー
    const readFileAsText = (file) => {
      return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = (e) => resolve(e.target.result);
        reader.onerror = () => reject(new Error('ファイル読み込みエラー'));
        // エンコーディングを指定しない（ブラウザのデフォルト動作に任せる）
        reader.readAsText(file);
      });
    };

    try {
      let markdownText;
      
      // 方法1: FileReader APIを使用（Firefoxで動作する方法）
      try {
        markdownText = await readFileAsText(file);
        console.log('FileReader APIで読み込み成功');
      } catch (e) {
        console.warn('FileReader APIで読み込み失敗、Blob APIを試行:', e);
        
        // 方法2: Blob API + TextDecoderを使用（フォールバック）
        const arrayBuffer = await file.arrayBuffer();
        const uint8Array = new Uint8Array(arrayBuffer);
        
        // BOM（Byte Order Mark）の検出と除去
        let startIndex = 0;
        
        // UTF-8 BOM: EF BB BF
        if (uint8Array.length >= 3 && uint8Array[0] === 0xEF && uint8Array[1] === 0xBB && uint8Array[2] === 0xBF) {
          startIndex = 3;
        }
        
        // BOM以降のデータを取得
        const dataWithoutBOM = startIndex > 0 ? uint8Array.slice(startIndex) : uint8Array;
        
        // UTF-8でデコード
        const decoder = new TextDecoder('UTF-8', { fatal: false });
        markdownText = decoder.decode(dataWithoutBOM);
        console.log('Blob API + TextDecoderで読み込み成功');
      }
      
      // デバッグ用: 最初の100文字をログ出力
      console.log('読み込んだテキスト（最初の100文字）:', markdownText.substring(0, 100));
      console.log('文字列長:', markdownText.length);
      console.log('最初の文字のコードポイント:', markdownText.charCodeAt(0));
      
      // 文字化けの検出（一般的な日本語文字の範囲をチェック）
      const hasValidJapanese = /[\u3040-\u309F\u30A0-\u30FF\u4E00-\u9FAF]/.test(markdownText.substring(0, 500));
      if (!hasValidJapanese && markdownText.length > 0) {
        console.warn('日本語文字が検出されませんでした。文字化けの可能性があります。');
      }
      
      // テキストファイルの場合は、プレーンテキストとして表示
      if (isTextFile) {
        // 改行を <br> に変換して、プレーンテキストとして表示
        // HTMLの特殊文字をエスケープ
        const escapedText = markdownText
          .replace(/&/g, '&amp;')
          .replace(/</g, '&lt;')
          .replace(/>/g, '&gt;')
          .replace(/"/g, '&quot;')
          .replace(/'/g, '&#39;');
        
        // 改行を <br> に変換し、段落として表示
        const html = '<p>' + escapedText.replace(/\n/g, '</p><p>') + '</p>';
        this.renderContent(html);
        // スクロール位置を先頭に戻す
        this.resetScrollPosition();
        return;
      }
      
      // Markdownファイルの場合は、markdownParserを使用
      // markdownParserが利用可能かチェック
      if (typeof markdownParser === 'undefined' || !markdownParser.parse) {
        // フォールバック: プレーンテキストとして表示
        console.warn('markdownParser が利用できません。プレーンテキストとして表示します。');
        this.renderContent(markdownText.replace(/\n/g, '<br>'));
        return;
      }
      
      const html = markdownParser.parse(markdownText);
      this.renderContent(html);
      
      // スクロール位置を先頭に戻す
      this.resetScrollPosition();
    } catch (error) {
      console.error('ファイル読み込みエラー:', error);
      const message = typeof i18n !== 'undefined' 
        ? i18n.t('error-file-load', { error: error.message })
        : 'ファイルの読み込みに失敗しました。\nエラー: ' + error.message;
      alert(message);
    }
  }

  // コンテンツをレンダリング
  renderContent(html) {
    if (!this.content) return;
    
    // プレースホルダーテキストを削除
    const placeholder = this.content.querySelector('.placeholder-text');
    if (placeholder) {
      placeholder.remove();
    }
    
    this.content.innerHTML = html;
    
    // 設定を再適用（ルビ表示など）
    if (typeof settingsManager !== 'undefined') {
      settingsManager.applyToDOM();
    }
    
    // レイアウトが完了するまで待つ（スクロール計算のため）
    // 複数回requestAnimationFrameを使って確実にレイアウト完了を待つ
    requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        setTimeout(() => {
          // レイアウト完了後にスクロール位置をリセット
          if (this.main) {
            this.main.scrollTop = 0;
            // デバッグ: レンダリング後の高さを確認
            console.log('レンダリング完了: scrollHeight=', this.main.scrollHeight, 'clientHeight=', this.main.clientHeight);
          }
        }, 50);
      });
    });
  }

  // 自動スクロール開始
  startAutoScroll() {
    if (this.isPlaying || !this.main) return;
    
    // レイアウトが完了するまで待つ（スクロール計算のため）
    requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        // さらに少し待ってレイアウトを確実に完了させる
        setTimeout(() => {
          // スクロール可能かどうかをチェック
          const maxScrollTop = this.main.scrollHeight - this.main.clientHeight;
          console.log('スクロールチェック: scrollHeight=', this.main.scrollHeight, 'clientHeight=', this.main.clientHeight, 'maxScrollTop=', maxScrollTop);
          
          if (maxScrollTop <= 0) {
            console.warn('スクロールするコンテンツがありません。ファイルを読み込んでください。');
            console.log('詳細: scrollHeight:', this.main.scrollHeight, 'clientHeight:', this.main.clientHeight);
            console.log('content要素の高さ:', this.content ? this.content.scrollHeight : 'N/A');
            return;
          }
      
      // 既に最後までスクロールしている場合は先頭に戻す
      if (this.main.scrollTop >= maxScrollTop) {
        this.main.scrollTop = 0;
      }
      
      this.isPlaying = true;
      this.scrollStartTime = performance.now();
      this.scrollStartPosition = this.main.scrollTop;
      this.lastUpdateTime = null; // リセット
      
      // 画面ロック防止
      this.requestWakeLock();
      
      // UI更新
      if (this.playBtn) {
        this.playBtn.classList.add('hidden');
      }
      if (this.pauseBtn) {
        this.pauseBtn.classList.remove('hidden');
      }
      
          // ハイライト機能を有効化
          this.startHighlight();
          
          // フォールバック用のsetIntervalを開始（requestAnimationFrameが停止した場合の保険）
          this.startScrollFallback();
          
          // アニメーション開始
          this.animateScroll();
        }, 100); // 100ms待つ
      });
    });
  }

  // 自動スクロール停止
  stopAutoScroll() {
    if (!this.isPlaying) return;
    
    this.isPlaying = false;
    this.lastUpdateTime = null;
    
    // 画面ロック解除
    this.releaseWakeLock();
    
    if (this.animationFrameId) {
      cancelAnimationFrame(this.animationFrameId);
      this.animationFrameId = null;
    }
    
    // フォールバック用のsetIntervalを停止
    this.stopScrollFallback();
    
    // ハイライト機能を停止
    this.stopHighlight();
    
    // UI更新
    if (this.playBtn) {
      this.playBtn.classList.remove('hidden');
    }
    if (this.pauseBtn) {
      this.pauseBtn.classList.add('hidden');
    }
  }
  
  // フォールバック用のスクロール（requestAnimationFrameが停止した場合の保険）
  startScrollFallback() {
    // 既に開始されている場合は停止
    this.stopScrollFallback();
    
    // 16ms間隔（約60fps）でスクロール位置を更新
    // これはrequestAnimationFrameが停止した場合のフォールバック
    this.scrollInterval = setInterval(() => {
      if (!this.isPlaying || !this.main) {
        this.stopScrollFallback();
        return;
      }
      
      // ページが非表示の場合は、時間ベースでスクロールを継続
      const currentTime = performance.now();
      const elapsed = (currentTime - this.scrollStartTime) / 1000; // 秒
      const scrollDistance = this.scrollSpeed * elapsed;
      const targetScrollTop = this.scrollStartPosition + scrollDistance;
      
      const maxScrollTop = this.main.scrollHeight - this.main.clientHeight;
      
      if (maxScrollTop <= 0) {
        this.stopAutoScroll();
        return;
      }
      
      if (targetScrollTop < maxScrollTop) {
        this.main.scrollTop = targetScrollTop;
      } else {
        this.main.scrollTop = maxScrollTop;
        this.stopAutoScroll();
      }
    }, 16); // 約60fps
  }
  
  // フォールバック用のスクロールを停止
  stopScrollFallback() {
    if (this.scrollInterval) {
      clearInterval(this.scrollInterval);
      this.scrollInterval = null;
    }
  }

  // スクロールアニメーション
  animateScroll() {
    if (!this.isPlaying || !this.main) {
      return;
    }
    
    const currentTime = performance.now();
    
    // ページが非表示の場合でも、時間ベースでスクロールを継続
    // 最後の更新時刻を記録
    if (this.lastUpdateTime === null) {
      this.lastUpdateTime = currentTime;
    }
    
    // ページが非表示になっている場合、経過時間を正確に計算
    const timeDelta = currentTime - this.lastUpdateTime;
    this.lastUpdateTime = currentTime;
    
    // 経過時間に基づいてスクロール距離を計算（ミリ秒単位）
    const elapsed = (currentTime - this.scrollStartTime) / 1000; // 秒
    const scrollDistance = this.scrollSpeed * elapsed;
    const targetScrollTop = this.scrollStartPosition + scrollDistance;
    
    // 最大スクロール位置を超えないように
    const maxScrollTop = this.main.scrollHeight - this.main.clientHeight;
    
    if (maxScrollTop <= 0) {
      // スクロールするコンテンツがない場合
      this.stopAutoScroll();
      return;
    }
    
    if (targetScrollTop < maxScrollTop) {
      // スクロールを続ける
      this.main.scrollTop = targetScrollTop;
      this.animationFrameId = requestAnimationFrame(() => this.animateScroll());
    } else {
      // スクロール終了（最後まで到達）
      this.main.scrollTop = maxScrollTop;
      this.stopAutoScroll();
    }
    
    // ハイライトを更新（スクロールに合わせて）
    this.updateHighlight();
  }

  // ハイライト機能を開始
  startHighlight() {
    if (!this.main || !this.content) return;
    
    // 定期的にハイライトを更新
    this.highlightInterval = setInterval(() => {
      if (this.isPlaying) {
        this.updateHighlight();
      }
    }, 100); // 100msごとに更新
    
    // 最初のハイライトを適用
    this.updateHighlight();
  }

  // ハイライト機能を停止
  stopHighlight() {
    if (this.highlightInterval) {
      clearInterval(this.highlightInterval);
      this.highlightInterval = null;
    }
    
    // 現在のハイライトを解除
    if (this.currentHighlightElement) {
      this.currentHighlightElement.classList.remove('prompter-highlight');
      this.currentHighlightElement = null;
    }
  }

  // ハイライトを更新（現在のスクロール位置に基づく）
  updateHighlight() {
    if (!this.main || !this.content || !this.isPlaying) return;
    
    // 画面中央の位置（ビューポート相対）を計算
    const mainRect = this.main.getBoundingClientRect();
    const viewportCenterY = mainRect.top + (mainRect.height / 2);
    
    // すべての段落要素を取得
    const paragraphs = this.content.querySelectorAll('p, h1, h2, h3, h4, h5, h6');
    
    let targetElement = null;
    let minDistance = Infinity;
    
    // 画面中央に最も近い要素を見つける
    paragraphs.forEach(element => {
      const rect = element.getBoundingClientRect();
      
      // 要素が画面内にあるかチェック
      if (rect.bottom >= mainRect.top && rect.top <= mainRect.bottom) {
        // 要素の中心点を計算
        const elementCenterY = rect.top + (rect.height / 2);
        
        // 画面中央からの距離を計算
        const distance = Math.abs(elementCenterY - viewportCenterY);
        
        if (distance < minDistance) {
          minDistance = distance;
          targetElement = element;
        }
      }
    });
    
    // ハイライトを更新
    if (this.currentHighlightElement && this.currentHighlightElement !== targetElement) {
      this.currentHighlightElement.classList.remove('prompter-highlight');
    }
    
    if (targetElement && targetElement !== this.currentHighlightElement) {
      targetElement.classList.add('prompter-highlight');
      this.currentHighlightElement = targetElement;
    }
  }

  // スクロール速度を増やす
  increaseSpeed() {
    if (this.currentSpeedLevel < this.speedLevels.length - 1) {
      this.currentSpeedLevel++;
      this.scrollSpeed = this.speedLevels[this.currentSpeedLevel];
      
      // 設定に保存
      if (typeof settingsManager !== 'undefined') {
        settingsManager.set('scrollSpeed', this.scrollSpeed);
      }
      
      // スクロール中の場合は再開始
      if (this.isPlaying && this.main) {
        this.scrollStartTime = performance.now();
        this.scrollStartPosition = this.main.scrollTop;
        this.lastUpdateTime = null;
      }
      
      console.log(`スクロール速度: ${this.scrollSpeed} px/s`);
    }
  }

  // スクロール速度を減らす
  decreaseSpeed() {
    if (this.currentSpeedLevel > 0) {
      this.currentSpeedLevel--;
      this.scrollSpeed = this.speedLevels[this.currentSpeedLevel];
      
      // 設定に保存
      if (typeof settingsManager !== 'undefined') {
        settingsManager.set('scrollSpeed', this.scrollSpeed);
      }
      
      // スクロール中の場合は再開始
      if (this.isPlaying && this.main) {
        this.scrollStartTime = performance.now();
        this.scrollStartPosition = this.main.scrollTop;
        this.lastUpdateTime = null;
      }
      
      console.log(`スクロール速度: ${this.scrollSpeed} px/s`);
    }
  }

  // スクロール位置をリセット
  resetScrollPosition() {
    if (this.main) {
      this.main.scrollTop = 0;
    }
    this.stopAutoScroll();
    // ハイライトも解除
    this.stopHighlight();
  }

  // フルスクリーン表示の切り替え
  toggleFullscreen() {
    if (!document.fullscreenElement &&
        !document.webkitFullscreenElement &&
        !document.mozFullScreenElement &&
        !document.msFullscreenElement) {
      // フルスクリーンに入る
      this.enterFullscreen();
    } else {
      // フルスクリーンから出る
      this.exitFullscreen();
    }
  }

  // フルスクリーンに入る
  enterFullscreen() {
    const element = document.documentElement;
    
    if (element.requestFullscreen) {
      element.requestFullscreen();
    } else if (element.webkitRequestFullscreen) {
      element.webkitRequestFullscreen();
    } else if (element.mozRequestFullScreen) {
      element.mozRequestFullScreen();
    } else if (element.msRequestFullscreen) {
      element.msRequestFullscreen();
    }
  }

  // フルスクリーンから出る
  exitFullscreen() {
    if (document.exitFullscreen) {
      document.exitFullscreen();
    } else if (document.webkitExitFullscreen) {
      document.webkitExitFullscreen();
    } else if (document.mozCancelFullScreen) {
      document.mozCancelFullScreen();
    } else if (document.msExitFullscreen) {
      document.msExitFullscreen();
    }
  }

  // フルスクリーンボタンの状態を更新
  updateFullscreenButton() {
    // フルスクリーン状態に応じてボタンの表示を更新
    const isFullscreen = !!(document.fullscreenElement ||
                           document.webkitFullscreenElement ||
                           document.mozFullScreenElement ||
                           document.msFullscreenElement);
    
    // 必要に応じてボタンのテキストやアイコンを変更
    // ここではUIに応じた処理を実装
  }

  // ヘッダーの表示/非表示を切り替え
  toggleHeader() {
    if (!this.header || !this.headerToggle) return;
    
    const isExpanded = this.headerToggle.getAttribute('aria-expanded') === 'true';
    
    if (isExpanded) {
      this.header.classList.add('minimized');
      document.body.classList.add('header-minimized');
      this.headerToggle.setAttribute('aria-expanded', 'false');
      const icon = this.headerToggle.querySelector('.toggle-icon');
      if (icon) icon.textContent = '+';
      if (typeof i18n !== 'undefined') {
        this.headerToggle.setAttribute('aria-label', i18n.t('header-expand'));
      }
      // トグルボタンをbodyに移動して、親要素の影響を受けないようにする
      this.headerToggle.classList.add('floating-toggle');
      document.body.appendChild(this.headerToggle);
    } else {
      this.header.classList.remove('minimized');
      document.body.classList.remove('header-minimized');
      this.headerToggle.setAttribute('aria-expanded', 'true');
      const icon = this.headerToggle.querySelector('.toggle-icon');
      if (icon) icon.textContent = '−';
      if (typeof i18n !== 'undefined') {
        this.headerToggle.setAttribute('aria-label', i18n.t('header-minimize'));
      }
      // トグルボタンを元の位置に戻す
      this.headerToggle.classList.remove('floating-toggle');
      const headerContent = this.header.querySelector('.header-content');
      if (headerContent) {
        headerContent.appendChild(this.headerToggle);
      }
    }
  }

  // コントロールバーの表示/非表示を切り替え
  toggleControlBar() {
    if (!this.controlBar || !this.controlBarToggle) return;
    
    const isExpanded = this.controlBarToggle.getAttribute('aria-expanded') === 'true';
    
    if (isExpanded) {
      this.controlBar.classList.add('minimized');
      document.body.classList.add('control-bar-minimized');
      this.controlBarToggle.setAttribute('aria-expanded', 'false');
      const icon = this.controlBarToggle.querySelector('.toggle-icon');
      if (icon) icon.textContent = '+';
      if (typeof i18n !== 'undefined') {
        this.controlBarToggle.setAttribute('aria-label', i18n.t('control-bar-expand'));
      }
      // トグルボタンをbodyに移動して、親要素の影響を受けないようにする
      this.controlBarToggle.classList.add('floating-toggle');
      document.body.appendChild(this.controlBarToggle);
    } else {
      this.controlBar.classList.remove('minimized');
      document.body.classList.remove('control-bar-minimized');
      this.controlBarToggle.setAttribute('aria-expanded', 'true');
      const icon = this.controlBarToggle.querySelector('.toggle-icon');
      if (icon) icon.textContent = '−';
      if (typeof i18n !== 'undefined') {
        this.controlBarToggle.setAttribute('aria-label', i18n.t('control-bar-minimize'));
      }
      // トグルボタンを元の位置に戻す
      this.controlBarToggle.classList.remove('floating-toggle');
      const controlBarContent = this.controlBar.querySelector('.control-bar-content');
      if (controlBarContent) {
        controlBarContent.appendChild(this.controlBarToggle);
      }
    }
  }

  // 設定モーダルを開く
  openSettingsModal() {
    if (!this.settingsModal) return;
    
    this.settingsModal.classList.remove('hidden');
    this.settingsModal.setAttribute('aria-hidden', 'false');
    
    // 現在の設定値をUIに反映
    this.updateUIFromSettings();
  }

  // 設定モーダルを閉じる
  closeSettingsModal() {
    if (!this.settingsModal) return;
    
    this.settingsModal.classList.add('hidden');
    this.settingsModal.setAttribute('aria-hidden', 'true');
  }

  // 設定を読み込む
  loadSettings() {
    if (typeof settingsManager === 'undefined') return;
    
    // スクロール速度を設定から取得
    const savedSpeed = settingsManager.get('scrollSpeed');
    if (savedSpeed && typeof savedSpeed === 'number') {
      // 保存された速度に最も近いレベルを探す
      const closestLevel = this.speedLevels.reduce((prev, curr, index) => {
        return Math.abs(curr - savedSpeed) < Math.abs(this.speedLevels[prev] - savedSpeed) ? index : prev;
      }, this.currentSpeedLevel);
      
      this.currentSpeedLevel = closestLevel;
      this.scrollSpeed = this.speedLevels[this.currentSpeedLevel];
    }
  }

  // 設定変更時にUIを更新
  updateUIFromSettings() {
    if (typeof settingsManager === 'undefined') return;
    
    // フォントサイズスライダー
    if (this.fontSizeSlider) {
      const fontSize = settingsManager.get('fontSize');
      const fontSizeMap = { 'small': 1, 'normal': 2, 'large': 3, 'xlarge': 4, 'xxlarge': 5, 'xxxlarge': 6 };
      this.fontSizeSlider.value = fontSizeMap[fontSize] || 2;
    }
    
    // スクロール速度スライダー
    if (this.scrollSpeedSlider) {
      this.scrollSpeedSlider.value = this.currentSpeedLevel + 1; // 1-5の範囲
    }
    
    // テーマラジオボタン
    if (this.themeRadios.length > 0) {
      const theme = settingsManager.get('theme');
      this.themeRadios.forEach(radio => {
        radio.checked = (radio.value === theme);
      });
    }
    
    // テキスト配置ラジオボタン
    if (this.textAlignRadios.length > 0) {
      const textAlign = settingsManager.get('textAlign');
      this.textAlignRadios.forEach(radio => {
        radio.checked = (radio.value === textAlign);
      });
    }
    
    // 行間スライダー
    if (this.lineHeightSlider) {
      const lineHeight = settingsManager.get('lineHeight');
      const lineHeightMap = { 'small': 1, 'normal': 3, 'large': 5 };
      this.lineHeightSlider.value = lineHeightMap[lineHeight] || 3;
    }
    
    // ふりがな表示トグル
    if (this.rubyDisplayToggle) {
      const showRuby = settingsManager.get('showRuby');
      this.rubyDisplayToggle.checked = showRuby !== false;
    }
    
    // 言語選択
    if (this.languageSelect && typeof i18n !== 'undefined') {
      const language = settingsManager.get('language');
      if (language) {
        this.languageSelect.value = language;
        i18n.setLanguage(language);
      }
    }
  }

  // 設定変更時の処理
  onSettingsChanged(settings) {
    // スクロール速度が変更された場合
    if (settings.scrollSpeed && typeof settings.scrollSpeed === 'number') {
      const closestLevel = this.speedLevels.reduce((prev, curr, index) => {
        return Math.abs(curr - settings.scrollSpeed) < Math.abs(this.speedLevels[prev] - settings.scrollSpeed) ? index : prev;
      }, this.currentSpeedLevel);
      
      this.currentSpeedLevel = closestLevel;
      this.scrollSpeed = this.speedLevels[this.currentSpeedLevel];
      
      // スクロール中の場合は再開始
      if (this.isPlaying && this.main) {
        this.scrollStartTime = performance.now();
        this.scrollStartPosition = this.main.scrollTop;
        this.lastUpdateTime = null;
      }
    }
  }

  // フォントサイズを更新
  updateFontSize(value) {
    if (typeof settingsManager === 'undefined') return;
    
    const fontSizeMap = { '1': 'small', '2': 'normal', '3': 'large', '4': 'xlarge', '5': 'xxlarge', '6': 'xxxlarge' };
    const fontSize = fontSizeMap[value] || 'normal';
    settingsManager.set('fontSize', fontSize);
  }

  // スクロール速度をスライダーから更新
  updateScrollSpeedFromSlider(value) {
    const level = parseInt(value, 10) - 1; // 0-4の範囲
    if (level >= 0 && level < this.speedLevels.length) {
      this.currentSpeedLevel = level;
      this.scrollSpeed = this.speedLevels[level];
      
      if (typeof settingsManager !== 'undefined') {
        settingsManager.set('scrollSpeed', this.scrollSpeed);
      }
      
      // スクロール中の場合は再開始
      if (this.isPlaying && this.main) {
        this.scrollStartTime = performance.now();
        this.scrollStartPosition = this.main.scrollTop;
        this.lastUpdateTime = null;
      }
    }
  }

  // テーマを更新
  updateTheme(theme) {
    if (typeof settingsManager === 'undefined') return;
    settingsManager.set('theme', theme);
  }

  // テキスト配置を更新
  updateTextAlign(textAlign) {
    if (typeof settingsManager === 'undefined') return;
    settingsManager.set('textAlign', textAlign);
  }

  // 行間を更新
  updateLineHeight(value) {
    if (typeof settingsManager === 'undefined') return;
    
    const lineHeightMap = { '1': 'small', '2': 'small', '3': 'normal', '4': 'large', '5': 'large' };
    const lineHeight = lineHeightMap[value] || 'normal';
    settingsManager.set('lineHeight', lineHeight);
  }

  // ふりがな表示を更新
  updateRubyDisplay(show) {
    if (typeof settingsManager === 'undefined') return;
    settingsManager.set('showRuby', show);
  }

  // 言語を初期化
  initializeLanguage() {
    if (typeof i18n === 'undefined') return;
    
    // 言語選択の初期値を設定
    if (this.languageSelect) {
      this.languageSelect.value = i18n.getLanguage();
    }
    
    // UIを更新
    i18n.updateUI();
  }

  // 言語を更新
  updateLanguage(lang) {
    if (typeof i18n === 'undefined') return;
    
    if (i18n.setLanguage(lang)) {
      // 設定に保存
      if (typeof settingsManager !== 'undefined') {
        settingsManager.set('language', lang);
      }
    }
  }

  // 言語変更時の処理
  onLanguageChanged(language) {
    // 言語選択の値を更新
    if (this.languageSelect) {
      this.languageSelect.value = language;
    }
    
    // aria-labelを更新
    this.updateAriaLabels();
  }

  // aria-labelを更新
  updateAriaLabels() {
    if (typeof i18n === 'undefined') return;
    
    const elements = document.querySelectorAll('[aria-label^="i18n:"]');
    elements.forEach(element => {
      const ariaKey = element.getAttribute('aria-label').substring(5);
      element.setAttribute('aria-label', i18n.t(ariaKey));
    });
    
    // ヘッダーとコントロールバーのトグルボタンのaria-labelを更新
    if (this.headerToggle) {
      const isExpanded = this.headerToggle.getAttribute('aria-expanded') === 'true';
      this.headerToggle.setAttribute('aria-label', 
        isExpanded ? i18n.t('header-minimize') : i18n.t('header-expand'));
    }
    
    if (this.controlBarToggle) {
      const isExpanded = this.controlBarToggle.getAttribute('aria-expanded') === 'true';
      this.controlBarToggle.setAttribute('aria-label', 
        isExpanded ? i18n.t('control-bar-minimize') : i18n.t('control-bar-expand'));
    }
  }

  // キーボードショートカット
  handleKeyboardShortcut(e) {
    // Space: 再生/一時停止
    if (e.code === 'Space' && e.target.tagName !== 'INPUT' && e.target.tagName !== 'TEXTAREA') {
      e.preventDefault();
      if (this.isPlaying) {
        this.stopAutoScroll();
      } else {
        this.startAutoScroll();
      }
    }
    
    // 矢印キー: スクロール速度調整
    if (e.code === 'ArrowUp' && e.target.tagName !== 'INPUT' && e.target.tagName !== 'TEXTAREA') {
      e.preventDefault();
      this.increaseSpeed();
    }
    
    if (e.code === 'ArrowDown' && e.target.tagName !== 'INPUT' && e.target.tagName !== 'TEXTAREA') {
      e.preventDefault();
      this.decreaseSpeed();
    }
    
    // ESC: 設定モーダルを閉じる
    if (e.code === 'Escape') {
      if (this.settingsModal && !this.settingsModal.classList.contains('hidden')) {
        this.closeSettingsModal();
      }
    }
  }

  // Wake Lock APIを使用して画面ロックを防止
  async requestWakeLock() {
    if ('wakeLock' in navigator) {
      try {
        this.wakeLock = await navigator.wakeLock.request('screen');
        
        // Wake Lockが解放された場合の処理
        this.wakeLock.addEventListener('release', () => {
          console.log('Wake Lockが解放されました');
        });
      } catch (error) {
        console.warn('Wake Lock APIが利用できません:', error);
      }
    }
  }

  // Wake Lockを解放
  async releaseWakeLock() {
    if (this.wakeLock) {
      try {
        await this.wakeLock.release();
        this.wakeLock = null;
      } catch (error) {
        console.warn('Wake Lockの解放に失敗:', error);
      }
    }
  }
}

// DOMContentLoaded後にアプリケーションを初期化
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', () => {
    window.prompterApp = new PrompterApp();
  });
} else {
  // DOMContentLoadedが既に発火している場合
  window.prompterApp = new PrompterApp();
}

