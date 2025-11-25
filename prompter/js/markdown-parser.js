/**
 * Markdownパーサーモジュール
 * MarkdownテキストをHTMLに変換し、ふりがな（ルビ）の拡張構文にも対応する
 */

class MarkdownParser {
  constructor() {
    // marked.jsが読み込まれているかチェック
    if (typeof marked === 'undefined') {
      console.error('marked.js が読み込まれていません。');
      throw new Error('marked.js が必要です。');
    }

    this.marked = marked;
    this.protectedRubyTags = [];
    this.setupMarkedOptions();
  }

  /**
   * MarkdownテキストをHTMLに変換
   * @param {string} markdownText - 変換するMarkdownテキスト
   * @returns {string} 変換されたHTML
   */
  parse(markdownText) {
    if (!markdownText || typeof markdownText !== 'string') {
      console.warn('MarkdownParser.parse: 無効な入力が渡されました。');
      return '';
    }

    try {
      // 保護用の配列を初期化
      this.protectedRubyTags = [];
      
      // 1. HTML <ruby>タグを保護
      let processed = this.protectRubyTags(markdownText);
      
      // 2. 拡張構文をプレースホルダーに変換
      processed = this.convertRubySyntaxToPlaceholders(processed);
      
      // 3. Markdownをパース
      const html = this.marked.parse(processed);
      
      // 4. プレースホルダーをルビタグに変換
      const restored = this.convertPlaceholdersToRubyTags(html);
      
      // 6. プロンプター表示用に最適化
      return this.optimizeForPrompter(restored);
    } catch (error) {
      console.error('MarkdownParser.parse: パースエラーが発生しました。', error);
      // エラーが発生しても可能な限り結果を返す
      return this.handleParseError(markdownText, error);
    }
  }

  /**
   * 拡張構文をプレースホルダーに変換
   * {漢字|かんじ} 形式と 漢字{かんじ} 形式をプレースホルダーに変換
   * @param {string} text - 変換するテキスト
   * @returns {string} 変換後のテキスト
   */
  convertRubySyntaxToPlaceholders(text) {
    if (!text) return text;

    try {
      // 形式1: {漢字|かんじ}
      text = text.replace(/\{([^|{}]+)\|([^}]+)\}/g, (match, kanji, ruby) => {
        // 空白をトリム
        kanji = kanji.trim();
        ruby = ruby.trim();
        
        if (!kanji || !ruby) {
          console.warn(`MarkdownParser: 不正なルビ構文を検出しました: ${match}`);
          return match; // 変換しない
        }
        
        // プレースホルダーとして保存（HTMLエスケープを適用）
        const placeholder = `__RUBY_TAG_${this.protectedRubyTags.length}__`;
        this.protectedRubyTags.push(`<ruby>${this.escapeHtml(kanji)}<rt>${this.escapeHtml(ruby)}</rt></ruby>`);
        return placeholder;
      });
      
      // 形式2: 漢字{かんじ}
      // 漢字範囲: [々〇〻\u3400-\u9FFF\uF900-\uFAFF] (CJK統合漢字、互換漢字等)
      text = text.replace(/([々〇〻\u3400-\u9FFF\uF900-\uFAFF]+)\{([^}]+)\}/g, (match, kanji, ruby) => {
        ruby = ruby.trim();
        
        if (!ruby) {
          console.warn(`MarkdownParser: 不正なルビ構文を検出しました: ${match}`);
          return match; // 変換しない
        }
        
        // プレースホルダーとして保存（HTMLエスケープを適用）
        const placeholder = `__RUBY_TAG_${this.protectedRubyTags.length}__`;
        this.protectedRubyTags.push(`<ruby>${this.escapeHtml(kanji)}<rt>${this.escapeHtml(ruby)}</rt></ruby>`);
        return placeholder;
      });
      
      return text;
    } catch (error) {
      console.error('MarkdownParser.convertRubySyntaxToPlaceholders: 変換エラーが発生しました。', error);
      return text; // エラーが発生しても元のテキストを返す
    }
  }

  /**
   * プレースホルダーをルビタグに変換
   * @param {string} html - 変換するHTML
   * @returns {string} 変換後のHTML
   */
  convertPlaceholdersToRubyTags(html) {
    if (!html || !this.protectedRubyTags || this.protectedRubyTags.length === 0) {
      return html;
    }

    try {
      // 逆順に置換することで、インデックスの問題を回避
      for (let i = this.protectedRubyTags.length - 1; i >= 0; i--) {
        const placeholder = `__RUBY_TAG_${i}__`;
        const tag = this.protectedRubyTags[i];
        
        // すべての出現を置換（正規表現を使用）
        // エスケープされたプレースホルダーも処理（&lt; や &gt; など）
        const escapedPlaceholder = this.escapeRegex(placeholder);
        const regex = new RegExp(escapedPlaceholder, 'g');
        html = html.replace(regex, tag);
        
        // HTMLエンティティとしてエスケープされた場合も処理
        const htmlEntityPlaceholder = placeholder
          .replace(/_/g, '&#95;')
          .replace(/</g, '&lt;')
          .replace(/>/g, '&gt;');
        if (html.includes(htmlEntityPlaceholder)) {
          html = html.replace(new RegExp(this.escapeRegex(htmlEntityPlaceholder), 'g'), tag);
        }
      }
      
      // 保護用の配列をクリア
      this.protectedRubyTags = [];
      
      return html;
    } catch (error) {
      console.error('MarkdownParser.convertPlaceholdersToRubyTags: 変換エラーが発生しました。', error);
      return html;
    }
  }

  /**
   * HTML <ruby>タグの保護
   * Markdownパース時に既存のHTMLタグが壊れないように保護する
   * @param {string} text - 保護するテキスト
   * @param {boolean} reset - 保護配列をリセットするかどうか（デフォルト: true）
   * @returns {string} 保護後のテキスト
   */
  protectRubyTags(text, reset = true) {
    if (!text) return text;

    if (reset) {
      this.protectedRubyTags = [];
    }
    
    try {
      // <ruby>タグを一時的に置換して保護
      // ネストされたタグにも対応（非貪欲マッチ）
      text = text.replace(/<ruby>[\s\S]*?<\/ruby>/gi, (match) => {
        const id = `__RUBY_TAG_${this.protectedRubyTags.length}__`;
        this.protectedRubyTags.push(match);
        return id;
      });
      
      return text;
    } catch (error) {
      console.error('MarkdownParser.protectRubyTags: 保護処理エラーが発生しました。', error);
      return text;
    }
  }

  /**
   * 正規表現の特殊文字をエスケープ
   * @param {string} string - エスケープする文字列
   * @returns {string} エスケープ後の文字列
   */
  escapeRegex(string) {
    return string.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  }

  /**
   * プロンプター表示用の最適化
   * @param {string} html - 最適化するHTML
   * @returns {string} 最適化後のHTML
   */
  optimizeForPrompter(html) {
    if (!html) return html;

    try {
      // 連続する空行を削除（<p></p> や <br><br> など）
      html = html.replace(/(<p[^>]*>\s*<\/p>\s*)+/gi, '');
      html = html.replace(/(<br\s*\/?>\s*){3,}/gi, '<br><br>');
      
      // 不要な空白を削除（ただし、ルビタグ内とプレースホルダーは保護するため、一時的に保護）
      const protectedItems = [];
      
      // まず、プレースホルダー（__RUBY_TAG_0__ など）を保護
      html = html.replace(/__RUBY_TAG_\d+__/g, (match) => {
        const placeholder = `__RUBY_PLACEHOLDER_${protectedItems.length}__`;
        protectedItems.push(match);
        return placeholder;
      });
      
      // 次に、<ruby>タグを保護
      html = html.replace(/<ruby>[\s\S]*?<\/ruby>/gi, (match) => {
        const placeholder = `__RUBY_PLACEHOLDER_${protectedItems.length}__`;
        protectedItems.push(match);
        return placeholder;
      });
      
      // 空白を削除
      html = html.replace(/>\s+</g, '><');
      
      // 保護したアイテムを復元（逆順に復元）
      for (let i = protectedItems.length - 1; i >= 0; i--) {
        html = html.replace(`__RUBY_PLACEHOLDER_${i}__`, protectedItems[i]);
      }
      
      // セマンティックなHTMLの確保（既にカスタムレンダラーで処理済み）
      
      return html.trim();
    } catch (error) {
      console.error('MarkdownParser.optimizeForPrompter: 最適化処理エラーが発生しました。', error);
      return html;
    }
  }

  /**
   * marked.jsのオプション設定
   */
  setupMarkedOptions() {
    try {
      this.marked.setOptions({
        breaks: true,  // 改行を<br>に変換
        gfm: true,     // GitHub Flavored Markdown
        headerIds: false, // 見出しにIDを自動付与しない（プロンプターでは不要）
        mangle: false, // メールアドレスの難読化を無効化
      });

      // カスタムレンダラー
      const renderer = new this.marked.Renderer();

      // 見出しのカスタマイズ
      renderer.heading = (text, level) => {
        return `<h${level} class="prompter-heading prompter-h${level}">${text}</h${level}>`;
      };

      // 段落のカスタマイズ
      renderer.paragraph = (text) => {
        // 空の段落はスキップ
        if (!text || text.trim() === '') {
          return '';
        }
        return `<p class="prompter-paragraph">${text}</p>`;
      };

      // リストのカスタマイズ
      renderer.list = (body, ordered, start) => {
        const tag = ordered ? 'ol' : 'ul';
        const startAttr = ordered && start !== 1 ? ` start="${start}"` : '';
        return `<${tag} class="prompter-list${ordered ? ' prompter-list-ordered' : ' prompter-list-unordered'}"${startAttr}>${body}</${tag}>`;
      };

      renderer.listitem = (text) => {
        return `<li class="prompter-list-item">${text}</li>`;
      };

      // 強調のカスタマイズ
      renderer.strong = (text) => {
        return `<strong class="prompter-strong">${text}</strong>`;
      };

      renderer.em = (text) => {
        return `<em class="prompter-em">${text}</em>`;
      };

      // コードブロックのカスタマイズ
      renderer.code = (code, language) => {
        const langClass = language ? ` language-${language}` : '';
        return `<pre class="prompter-code-block"><code class="prompter-code${langClass}">${this.escapeHtml(code)}</code></pre>`;
      };

      renderer.codespan = (code) => {
        return `<code class="prompter-code-inline">${this.escapeHtml(code)}</code>`;
      };

      // リンクのカスタマイズ
      renderer.link = (href, title, text) => {
        const titleAttr = title ? ` title="${this.escapeHtml(title)}"` : '';
        return `<a href="${this.escapeHtml(href)}" class="prompter-link"${titleAttr}>${text}</a>`;
      };

      // 画像のカスタマイズ
      renderer.image = (href, title, text) => {
        const titleAttr = title ? ` title="${this.escapeHtml(title)}"` : '';
        const altAttr = text ? ` alt="${this.escapeHtml(text)}"` : '';
        return `<img src="${this.escapeHtml(href)}" class="prompter-image"${altAttr}${titleAttr}>`;
      };

      // 水平線のカスタマイズ
      renderer.hr = () => {
        return '<hr class="prompter-hr">';
      };

      // ブロッククォートのカスタマイズ
      renderer.blockquote = (quote) => {
        return `<blockquote class="prompter-blockquote">${quote}</blockquote>`;
      };

      this.marked.setOptions({ renderer });
    } catch (error) {
      console.error('MarkdownParser.setupMarkedOptions: 設定エラーが発生しました。', error);
    }
  }

  /**
   * HTMLエスケープ
   * @param {string} text - エスケープするテキスト
   * @returns {string} エスケープ後のテキスト
   */
  escapeHtml(text) {
    if (!text) return '';
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
  }

  /**
   * パースエラーのハンドリング
   * @param {string} markdownText - 元のMarkdownテキスト
   * @param {Error} error - エラーオブジェクト
   * @returns {string} エラーメッセージを含むHTML
   */
  handleParseError(markdownText, error) {
    console.error('MarkdownParser: パースエラー', error);
    
    // 可能な限り部分的なパースを試みる
    try {
      // エスケープしてそのまま表示
      const escaped = this.escapeHtml(markdownText);
      return `<div class="prompter-error">
        <p class="prompter-paragraph">パースエラーが発生しました。原稿を確認してください。</p>
        <pre class="prompter-code-block"><code>${escaped}</code></pre>
      </div>`;
    } catch (e) {
      return '<div class="prompter-error"><p class="prompter-paragraph">原稿の読み込みに失敗しました。</p></div>';
    }
  }
}

// グローバルにインスタンスをエクスポート
const markdownParser = new MarkdownParser();

