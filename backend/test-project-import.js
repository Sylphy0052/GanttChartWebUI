/**
 * プロジェクトインポート機能のテストファイル
 * 
 * テスト手順:
 * 1. 既存のプロジェクトをエクスポート
 * 2. エクスポートしたZIPからdata.jsonを抽出
 * 3. data.jsonをインポート機能でテスト
 */

const fs = require('fs');
const path = require('path');

async function testProjectImport() {
    const baseURL = 'http://localhost:3000';
    
    console.log('=== プロジェクトインポート機能テスト開始 ===');

    try {
        // 1. プロジェクト一覧を取得して適切なプロジェクトを選択
        console.log('1. プロジェクト一覧取得中...');
        const projectsResponse = await fetch(`${baseURL}/api/projects`, {
            headers: {
                'x-user-role': 'editor',
            },
        });

        if (!projectsResponse.ok) {
            throw new Error(`プロジェクト一覧取得失敗: ${projectsResponse.status}`);
        }

        const projects = await projectsResponse.json();
        console.log(`利用可能なプロジェクト数: ${projects.length}`);

        if (projects.length === 0) {
            throw new Error('テスト用のプロジェクトが存在しません');
        }

        // 最初のプロジェクトを使用
        const sourceProject = projects[0];
        console.log(`ソースプロジェクト: ${sourceProject.name} (ID: ${sourceProject.id})`);

        // 2. プロジェクトエクスポート（ZIPファイル）
        console.log('\n2. プロジェクトエクスポート実行中...');
        const exportResponse = await fetch(`${baseURL}/api/backup/export/${sourceProject.id}`, {
            method: 'POST',
            headers: {
                'x-user-role': 'editor',
            },
        });

        if (!exportResponse.ok) {
            throw new Error(`エクスポート失敗: ${exportResponse.status} - ${exportResponse.statusText}`);
        }

        const zipBuffer = await exportResponse.arrayBuffer();
        console.log(`エクスポート完了: ${zipBuffer.byteLength} bytes`);

        // 3. ZIPファイルを保存（確認用）
        const exportZipPath = path.join(__dirname, `export-test-${Date.now()}.zip`);
        fs.writeFileSync(exportZipPath, Buffer.from(zipBuffer));
        console.log(`ZIPファイル保存: ${exportZipPath}`);

        // 4. data.jsonをJSON形式でテスト（暫定実装）
        // 実際のプロジェクトでは、ZIPファイルからdata.jsonを抽出する必要があります
        console.log('\n4. 暫定実装: エクスポートデータの一部をJSON形式でテスト');
        
        const testData = {
            metadata: {
                exportedAt: new Date().toISOString(),
                version: '1.0.0',
                projectId: sourceProject.id,
                projectName: sourceProject.name,
            },
            project: {
                id: sourceProject.id,
                name: sourceProject.name,
                description_md: sourceProject.description_md || 'テスト用プロジェクト',
                created_at: new Date(),
                updated_at: new Date(),
            },
            issues: [
                {
                    id: 'test-issue-1',
                    project_id: sourceProject.id,
                    parent_id: null,
                    title: 'テスト課題 1',
                    description_md: 'インポートテスト用の課題です',
                    assignee: 'テストユーザー',
                    status: 'Todo',
                    start_date: null,
                    end_date: null,
                    progress_pct: 0,
                    effort_hours: 8,
                    is_blocked: false,
                    sort_order: 1,
                    labels: ['テスト'],
                    version: 1,
                    created_at: new Date(),
                    updated_at: new Date(),
                },
                {
                    id: 'test-issue-2',
                    project_id: sourceProject.id,
                    parent_id: 'test-issue-1',
                    title: 'テスト課題 2（子課題）',
                    description_md: 'インポートテスト用の子課題です',
                    assignee: 'テストユーザー',
                    status: 'InProgress',
                    start_date: new Date(),
                    end_date: null,
                    progress_pct: 50,
                    effort_hours: 4,
                    is_blocked: false,
                    sort_order: 2,
                    labels: ['テスト', '子課題'],
                    version: 1,
                    created_at: new Date(),
                    updated_at: new Date(),
                }
            ],
            comments: [
                {
                    id: 'test-comment-1',
                    issue_id: 'test-issue-1',
                    author: 'テストユーザー',
                    body_md: 'これはテスト用のコメントです。',
                    edited: false,
                    created_at: new Date(),
                    updated_at: new Date(),
                }
            ],
            dependencies: [
                {
                    id: 'test-dep-1',
                    project_id: sourceProject.id,
                    predecessor_issue_id: 'test-issue-1',
                    successor_issue_id: 'test-issue-2',
                    type: 'FinishToStart',
                    created_at: new Date(),
                }
            ],
            changeLogs: [],
            imagePaths: [],
        };

        // 5. インポート実行
        console.log('\n5. プロジェクトインポート実行中...');
        
        const formData = new FormData();
        const jsonBlob = new Blob([JSON.stringify(testData, null, 2)], { type: 'application/json' });
        formData.append('file', jsonBlob, 'test-import.json');
        formData.append('projectName', `${sourceProject.name} (Import Test)`);

        const importResponse = await fetch(`${baseURL}/api/backup/import`, {
            method: 'POST',
            headers: {
                'x-user-role': 'editor',
            },
            body: formData,
        });

        if (!importResponse.ok) {
            const errorText = await importResponse.text();
            throw new Error(`インポート失敗: ${importResponse.status} - ${errorText}`);
        }

        const importResult = await importResponse.json();
        console.log('インポート成功:', importResult);

        // 6. インポートしたプロジェクトの確認
        console.log('\n6. インポートしたプロジェクトの確認...');
        const newProjectResponse = await fetch(`${baseURL}/api/projects/${importResult.projectId}`, {
            headers: {
                'x-user-role': 'editor',
            },
        });

        if (newProjectResponse.ok) {
            const newProject = await newProjectResponse.json();
            console.log(`新しいプロジェクト: ${newProject.name} (ID: ${newProject.id})`);

            // Issues確認
            const issuesResponse = await fetch(`${baseURL}/api/projects/${importResult.projectId}/issues`, {
                headers: {
                    'x-user-role': 'viewer',
                },
            });

            if (issuesResponse.ok) {
                const issues = await issuesResponse.json();
                console.log(`インポートされた課題数: ${issues.length}`);
                issues.forEach((issue, index) => {
                    console.log(`  ${index + 1}. ${issue.title} (${issue.status}) - ${issue.progress_pct}%`);
                });
            }
        }

        console.log('\n=== インポートテスト成功 ===');

    } catch (error) {
        console.error('テスト失敗:', error.message);
        console.error(error.stack);
        process.exit(1);
    }
}

// Node.js環境での実行
if (typeof window === 'undefined') {
    // FormDataが利用できない場合のポリフィル
    global.FormData = require('form-data');
    global.Blob = class Blob {
        constructor(parts, options) {
            this.data = Buffer.concat(parts.map(part => 
                typeof part === 'string' ? Buffer.from(part) : part
            ));
            this.type = options?.type || 'application/octet-stream';
        }
    };

    global.fetch = require('node-fetch');
    testProjectImport();
}