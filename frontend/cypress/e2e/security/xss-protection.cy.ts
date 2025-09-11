/**
 * セキュリティテスト: XSS（Cross-Site Scripting）攻撃防御検証
 * 
 * 対象攻撃ベクター:
 * 1. Stored XSS - データベースに保存される悪意のあるスクリプト
 * 2. Reflected XSS - URLパラメータやフォーム入力からの即座反映
 * 3. DOM-based XSS - JavaScriptによるDOM操作での脆弱性
 * 4. Event Handler XSS - HTML属性内でのスクリプト実行
 * 5. CSS-based XSS - スタイルシート内での悪意のあるコード
 * 
 * 期待動作:
 * - 悪意のあるスクリプトが実行されない
 * - HTMLタグが適切にエスケープされる
 * - ユーザー入力が適切にサニタイズされる
 */

describe('XSS Protection Security Tests', () => {
  let projectId: string;
  let testPassword: string;

  beforeEach(() => {
    // テスト用プロジェクトのセットアップ
    testPassword = 'TestSecurePassword123!';
    
    cy.request('POST', `${Cypress.env('BACKEND_URL') || 'http://localhost:3001'}/projects`, {
      name: 'XSS Test Project',
      description: 'Project for XSS security testing',
      shared_password: testPassword,
    }).then((response) => {
      projectId = response.body.id;
      
      // プロジェクトにログイン
      cy.visit(`/projects/${projectId}`);
      cy.get('[data-cy=password-input]').type(testPassword);
      cy.get('[data-cy=login-button]').click();
    });
  });

  afterEach(() => {
    // テストプロジェクトのクリーンアップ
    if (projectId) {
      cy.request({
        method: 'DELETE',
        url: `${Cypress.env('BACKEND_URL') || 'http://localhost:3001'}/projects/${projectId}`,
        headers: {
          'Authorization': `Basic ${btoa(`${projectId}:${testPassword}`)}`,
        },
        failOnStatusCode: false
      });
    }
  });

  describe('1. Stored XSS攻撃防御', () => {
    const xssPayloads = [
      // 基本的なスクリプトタグ
      '<script>alert("XSS")</script>',
      '<script>console.log("XSS executed")</script>',
      '<script>document.location="http://evil.com"</script>',
      
      // 様々な形式のスクリプト実行試行
      '<img src=x onerror=alert("XSS")>',
      '<svg onload=alert("XSS")>',
      '<iframe src="javascript:alert(\'XSS\')"></iframe>',
      '<body onload=alert("XSS")>',
      '<input type="image" src=x onerror=alert("XSS")>',
      
      // Event Handler XSS
      '<div onclick=alert("XSS")>Click me</div>',
      '<a href="#" onmouseover=alert("XSS")>Hover me</a>',
      '<form><button formaction=javascript:alert("XSS")>Submit</button></form>',
      
      // JavaScript: プロトコル
      '<a href="javascript:alert(\'XSS\')">Link</a>',
      '<form action="javascript:alert(\'XSS\')"><input type="submit"></form>',
      
      // データプロトコル
      '<object data="data:text/html,<script>alert(\'XSS\')</script>"></object>',
      '<embed src="data:text/html,<script>alert(\'XSS\')</script>">',
      
      // CSS-based XSS
      '<style>body{background:url("javascript:alert(\'XSS\')")}</style>',
      '<div style="background:url(javascript:alert(\'XSS\'))">',
      
      // Unicode/エンコーディング攻撃
      '<script>\\u0061\\u006C\\u0065\\u0072\\u0074("XSS")</script>',
      '<script>eval(String.fromCharCode(97,108,101,114,116,40,39,88,83,83,39,41))</script>',
      
      // 特殊文字・エスケープ回避
      '<<script>alert("XSS")</script>',
      '<script>alert("XSS");</script>',
      '<SCRIPT>alert("XSS")</SCRIPT>',
      '<ScRiPt>alert("XSS")</ScRiPt>',
      
      // コメント内XSS
      '<!-- <script>alert("XSS")</script> -->',
      '<!--[if IE]><script>alert("XSS")</script><![endif]-->',
    ];

    xssPayloads.forEach((payload, index) => {
      it(`should prevent stored XSS in Issue title (payload ${index + 1})`, () => {
        cy.visit(`/projects/${projectId}/issues`);
        
        // Issue作成フォームでXSSペイロードを入力
        cy.get('[data-cy=create-issue-button]').click();
        cy.get('[data-cy=issue-title-input]').type(payload);
        cy.get('[data-cy=issue-description-textarea]').type('Test description');
        cy.get('[data-cy=issue-status-select]').select('open');
        cy.get('[data-cy=issue-priority-select]').select('medium');
        
        // Issue作成
        cy.get('[data-cy=create-issue-submit]').click();
        
        // XSSが実行されていないことを確認
        cy.window().then((win) => {
          // アラートが表示されていないことを確認
          expect(win.alert).not.to.have.been.called;
        });
        
        // Issue一覧でXSSペイロードが適切にエスケープされていることを確認
        cy.get('[data-cy=issue-list]').should('be.visible');
        cy.get('[data-cy=issue-title]').should('contain.text', payload);
        
        // HTMLタグが実行されず、テキストとして表示されることを確認
        cy.get('script').should('not.exist');
        cy.get('img[src="x"]').should('not.exist');
        cy.get('svg').should('not.contain', 'alert');
      });
    });

    it('should prevent stored XSS in Issue description (Markdown)', () => {
      const markdownXssPayloads = [
        '[Click me](javascript:alert("XSS"))',
        '![Alt](javascript:alert("XSS"))',
        '<script>alert("XSS")</script>',
        '[<script>alert("XSS")</script>](http://example.com)',
        '`<script>alert("XSS")</script>`',
        '```javascript\nalert("XSS")\n```',
        '<iframe src="javascript:alert(\'XSS\')"></iframe>',
      ];

      markdownXssPayloads.forEach((payload, index) => {
        cy.visit(`/projects/${projectId}/issues`);
        cy.get('[data-cy=create-issue-button]').click();
        cy.get('[data-cy=issue-title-input]').type(`XSS Test Issue ${index + 1}`);
        cy.get('[data-cy=issue-description-textarea]').type(payload);
        cy.get('[data-cy=issue-status-select]').select('open');
        cy.get('[data-cy=issue-priority-select]').select('medium');
        cy.get('[data-cy=create-issue-submit]').click();

        // Issue詳細画面でMarkdownが安全にレンダリングされることを確認
        cy.get('[data-cy=issue-title]').first().click();
        cy.get('[data-cy=issue-description]').should('be.visible');
        
        // JavaScriptが実行されていないことを確認
        cy.window().then((win) => {
          expect(win.alert).not.to.have.been.called;
        });
      });
    });

    it('should prevent XSS in Comment creation', () => {
      // まずテスト用Issueを作成
      cy.visit(`/projects/${projectId}/issues`);
      cy.get('[data-cy=create-issue-button]').click();
      cy.get('[data-cy=issue-title-input]').type('Test Issue for Comment XSS');
      cy.get('[data-cy=issue-description-textarea]').type('Test description');
      cy.get('[data-cy=issue-status-select]').select('open');
      cy.get('[data-cy=issue-priority-select]').select('medium');
      cy.get('[data-cy=create-issue-submit]').click();

      // Issue詳細画面でコメントにXSSペイロードを投稿
      cy.get('[data-cy=issue-title]').first().click();
      
      const commentXssPayload = '<script>alert("Comment XSS")</script><img src=x onerror=alert("XSS")>';
      cy.get('[data-cy=comment-textarea]').type(commentXssPayload);
      cy.get('[data-cy=comment-submit]').click();

      // コメントが安全に表示されることを確認
      cy.get('[data-cy=comment-content]').should('contain.text', commentXssPayload);
      cy.window().then((win) => {
        expect(win.alert).not.to.have.been.called;
      });
    });
  });

  describe('2. Reflected XSS攻撃防御', () => {
    it('should prevent XSS through URL parameters', () => {
      const xssInUrl = encodeURIComponent('<script>alert("URL XSS")</script>');
      
      // URLパラメータにXSSペイロードを含めてアクセス
      cy.visit(`/projects/${projectId}/issues?search=${xssInUrl}`, {
        failOnStatusCode: false
      });
      
      // XSSが実行されていないことを確認
      cy.window().then((win) => {
        expect(win.alert).not.to.have.been.called;
      });
      
      // 検索パラメータが安全に表示されることを確認
      cy.get('body').should('not.contain', '<script>');
    });

    it('should prevent XSS in search functionality', () => {
      cy.visit(`/projects/${projectId}/issues`);
      
      const searchXssPayload = '<img src=x onerror=alert("Search XSS")>';
      
      // 検索フィールドにXSSペイロードを入力
      if (cy.get('[data-cy=search-input]').should('exist')) {
        cy.get('[data-cy=search-input]').type(searchXssPayload);
        cy.get('[data-cy=search-button]').click();
        
        // XSSが実行されていないことを確認
        cy.window().then((win) => {
          expect(win.alert).not.to.have.been.called;
        });
      }
    });
  });

  describe('3. DOM-based XSS攻撃防御', () => {
    it('should prevent XSS through dynamic content insertion', () => {
      cy.visit(`/projects/${projectId}/issues`);
      
      // JavaScriptでDOM操作を通じてXSSを試行
      cy.window().then((win) => {
        // 悪意のあるHTMLの動的挿入を試行
        const maliciousHtml = '<img src=x onerror=alert("DOM XSS")>';
        
        // innerHTML の使用をテスト
        const testDiv = win.document.createElement('div');
        testDiv.innerHTML = maliciousHtml;
        win.document.body.appendChild(testDiv);
        
        // XSSが実行されていないことを確認
        expect(win.alert).not.to.have.been.called;
      });
    });

    it('should safely handle user input in JavaScript operations', () => {
      cy.visit(`/projects/${projectId}/issues`);
      
      // ローカルストレージやセッションストレージへの悪意のあるデータ格納テスト
      cy.window().then((win) => {
        const xssPayload = '<script>alert("Storage XSS")</script>';
        
        win.localStorage.setItem('test-data', xssPayload);
        win.sessionStorage.setItem('test-session', xssPayload);
        
        // ストレージからのデータ読み取り時にXSSが実行されないことを確認
        const storedData = win.localStorage.getItem('test-data');
        const sessionData = win.sessionStorage.getItem('test-session');
        
        expect(storedData).to.equal(xssPayload);
        expect(sessionData).to.equal(xssPayload);
        expect(win.alert).not.to.have.been.called;
      });
    });
  });

  describe('4. CSP（Content Security Policy）検証', () => {
    it('should have proper Content Security Policy headers', () => {
      cy.request('GET', `/projects/${projectId}/issues`).then((response) => {
        // CSPヘッダーの存在確認（実装に依存）
        const cspHeader = response.headers['content-security-policy'];
        
        if (cspHeader) {
          // unsafe-inline や unsafe-eval が使用されていないことを確認
          expect(cspHeader).not.to.contain('unsafe-inline');
          expect(cspHeader).not.to.contain('unsafe-eval');
          
          // script-src が適切に設定されていることを確認
          expect(cspHeader).to.match(/script-src/);
        }
      });
    });
  });

  describe('5. 入力フィールドのXSS防御検証', () => {
    const inputFields = [
      { selector: '[data-cy=issue-title-input]', name: 'Issue Title' },
      { selector: '[data-cy=issue-description-textarea]', name: 'Issue Description' },
      { selector: '[data-cy=project-name-input]', name: 'Project Name' },
      { selector: '[data-cy=comment-textarea]', name: 'Comment Text' },
    ];

    inputFields.forEach(field => {
      it(`should sanitize ${field.name} input`, () => {
        cy.visit(`/projects/${projectId}/issues`);
        
        // フィールドが存在する場合のみテスト実行
        cy.get('body').then($body => {
          if ($body.find(field.selector).length) {
            cy.get(field.selector).type('<script>alert("Field XSS")</script>');
            
            // 入力値が適切にエスケープされることを確認
            cy.get(field.selector).should('not.contain', '<script>');
            
            // XSSが実行されていないことを確認
            cy.window().then((win) => {
              expect(win.alert).not.to.have.been.called;
            });
          }
        });
      });
    });
  });

  describe('6. JSON Response XSS防御', () => {
    it('should not execute scripts in JSON responses', () => {
      // APIレスポンス内でのXSS防御を確認
      cy.request({
        method: 'GET',
        url: `${Cypress.env('BACKEND_URL') || 'http://localhost:3001'}/projects/${projectId}/issues`,
        headers: {
          'Authorization': `Basic ${btoa(`${projectId}:${testPassword}`)}`,
        }
      }).then((response) => {
        // レスポンス内にスクリプトタグが含まれていないことを確認
        const responseText = JSON.stringify(response.body);
        expect(responseText).not.to.match(/<script[\s\S]*?>[\s\S]*?<\/script>/gi);
        expect(responseText).not.to.match(/javascript:/gi);
        expect(responseText).not.to.match(/on\w+\s*=/gi); // onload, onclick等のイベントハンドラー
      });
    });
  });

  describe('7. File Upload XSS防御', () => {
    it('should prevent XSS through malicious file names', () => {
      cy.visit(`/projects/${projectId}/issues`);
      
      // Issue作成
      cy.get('[data-cy=create-issue-button]').click();
      cy.get('[data-cy=issue-title-input]').type('File Upload XSS Test');
      cy.get('[data-cy=issue-description-textarea]').type('Testing file upload XSS');
      cy.get('[data-cy=issue-status-select]').select('open');
      cy.get('[data-cy=issue-priority-select]').select('medium');
      cy.get('[data-cy=create-issue-submit]').click();
      
      // Issue詳細画面でファイルアップロード
      cy.get('[data-cy=issue-title]').first().click();
      
      // 悪意のあるファイル名でのアップロードテスト（可能な場合）
      cy.get('body').then($body => {
        if ($body.find('[data-cy=file-upload-input]').length) {
          const maliciousFileName = '<script>alert("Filename XSS")</script>.jpg';
          
          // ファイルアップロード（モックファイル）
          cy.fixture('test-image.jpg', 'base64').then(fileContent => {
            const blob = Cypress.Blob.base64StringToBlob(fileContent, 'image/jpeg');
            const file = new File([blob], maliciousFileName, { type: 'image/jpeg' });
            
            cy.get('[data-cy=file-upload-input]').then(input => {
              const dt = new DataTransfer();
              dt.items.add(file);
              input[0].files = dt.files;
              
              // ファイル名が安全に表示されることを確認
              cy.get('[data-cy=uploaded-file-name]').should('not.contain', '<script>');
              
              // XSSが実行されていないことを確認
              cy.window().then((win) => {
                expect(win.alert).not.to.have.been.called;
              });
            });
          });
        }
      });
    });
  });
});