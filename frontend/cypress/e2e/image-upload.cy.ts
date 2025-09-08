/// <reference types="cypress" />

describe('Issue Image Upload E2E Tests', () => {
  const TEST_API_URL = Cypress.env('backendUrl') || 'http://localhost:3001'
  const TEST_PROJECT_ID = 'test-project-123'
  const TEST_ISSUE_ID = 'test-issue-123'
  const TEST_USER = 'test-user@example.com'

  // Mock file data for testing
  const createMockFile = (name: string, type: string, size: number = 1024) => {
    const content = 'x'.repeat(size)
    return {
      contents: Cypress.Buffer.from(content),
      fileName: name,
      mimeType: type,
      lastModified: Date.now()
    }
  }

  const createMockImageFile = (name: string = 'test-image.png', size: number = 5120) => {
    // Create a simple PNG file header
    const pngHeader = new Uint8Array([137, 80, 78, 71, 13, 10, 26, 10])
    const content = new Uint8Array(size)
    content.set(pngHeader)
    
    return {
      contents: Cypress.Buffer.from(content),
      fileName: name,
      mimeType: 'image/png',
      lastModified: Date.now()
    }
  }

  beforeEach(() => {
    // Clean up test data before each test
    cy.cleanupTestData()
    
    // Intercept Upload API calls for monitoring
    cy.intercept('GET', `${TEST_API_URL}/api/projects/${TEST_PROJECT_ID}/issues/${TEST_ISSUE_ID}/uploads`).as('getUploads')
    cy.intercept('POST', `${TEST_API_URL}/api/projects/${TEST_PROJECT_ID}/issues/${TEST_ISSUE_ID}/uploads`).as('uploadFile')
    cy.intercept('DELETE', `${TEST_API_URL}/api/projects/${TEST_PROJECT_ID}/issues/${TEST_ISSUE_ID}/uploads/*`).as('deleteFile')
    cy.intercept('GET', `${TEST_API_URL}/api/projects/${TEST_PROJECT_ID}/issues/${TEST_ISSUE_ID}/uploads/*/download`).as('downloadFile')
    
    // Mock project authentication with editor role
    cy.mockApiResponse('POST', `${TEST_API_URL}/api/auth/project/${TEST_PROJECT_ID}/authenticate`, { 
      success: true, 
      role: 'editor' 
    })

    // Mock basic issue data
    const mockIssue = {
      id: TEST_ISSUE_ID,
      project_id: TEST_PROJECT_ID,
      title: 'Test Issue for File Upload',
      status: 'open',
      progress_pct: 0,
      is_blocked: false,
      labels: [],
      sort_order: 1,
      version: 1,
      created_at: '2024-01-01T00:00:00Z',
      updated_at: '2024-01-01T00:00:00Z',
      comments: [],
      changeLog: [],
      uploadedFiles: []
    }

    cy.mockApiResponse('GET', `${TEST_API_URL}/api/projects/${TEST_PROJECT_ID}/issues/${TEST_ISSUE_ID}/detail`, mockIssue)
  })

  describe('File Upload Display', () => {
    it('should display upload section correctly', () => {
      const mockFiles = [
        {
          id: 'file-1',
          issue_id: TEST_ISSUE_ID,
          original_name: 'screenshot.png',
          file_path: '/uploads/screenshot_123.png',
          file_size: 15420,
          mime_type: 'image/png',
          uploaded_by: TEST_USER,
          created_at: '2024-01-01T10:00:00Z'
        },
        {
          id: 'file-2',
          issue_id: TEST_ISSUE_ID,
          original_name: 'document.pdf',
          file_path: '/uploads/document_456.pdf',
          file_size: 204800,
          mime_type: 'application/pdf',
          uploaded_by: TEST_USER,
          created_at: '2024-01-01T11:00:00Z'
        }
      ]

      cy.mockApiResponse('GET', `${TEST_API_URL}/api/projects/${TEST_PROJECT_ID}/issues/${TEST_ISSUE_ID}/uploads`, { files: mockFiles })

      cy.visit(`/projects/${TEST_PROJECT_ID}/issues/${TEST_ISSUE_ID}`)
      cy.waitForApi('@getUploads')

      // Check upload section is visible
      cy.get('[data-testid="uploads-section"]').should('be.visible')
      cy.get('[data-testid="uploads-title"]').should('contain', 'ファイル')

      // Check file items
      cy.get('[data-testid="file-item"]').should('have.length', 2)

      // Check first file (image)
      cy.get('[data-testid="file-file-1"]').within(() => {
        cy.get('[data-testid="file-name"]').should('contain', 'screenshot.png')
        cy.get('[data-testid="file-size"]').should('contain', '15.4 KB')
        cy.get('[data-testid="file-type-icon"]').should('have.class', 'icon-image')
        cy.get('[data-testid="file-uploader"]').should('contain', TEST_USER)
        cy.get('[data-testid="download-btn"]').should('be.visible')
        cy.get('[data-testid="delete-btn"]').should('be.visible')
      })

      // Check second file (PDF)
      cy.get('[data-testid="file-file-2"]').within(() => {
        cy.get('[data-testid="file-name"]').should('contain', 'document.pdf')
        cy.get('[data-testid="file-size"]').should('contain', '200 KB')
        cy.get('[data-testid="file-type-icon"]').should('have.class', 'icon-pdf')
      })

      // Check upload button
      cy.get('[data-testid="upload-file-btn"]').should('be.visible')
    })

    it('should display empty state when no files exist', () => {
      cy.mockApiResponse('GET', `${TEST_API_URL}/api/projects/${TEST_PROJECT_ID}/issues/${TEST_ISSUE_ID}/uploads`, { files: [] })

      cy.visit(`/projects/${TEST_PROJECT_ID}/issues/${TEST_ISSUE_ID}`)
      cy.waitForApi('@getUploads')

      cy.get('[data-testid="uploads-section"]').should('be.visible')
      cy.get('[data-testid="no-files-message"]').should('contain', 'ファイルがアップロードされていません')
      cy.get('[data-testid="upload-file-btn"]').should('be.visible')
    })

    it('should display image previews for image files', () => {
      const imageFile = {
        id: 'image-file-1',
        issue_id: TEST_ISSUE_ID,
        original_name: 'preview-test.jpg',
        file_path: '/uploads/preview_test.jpg',
        file_size: 25600,
        mime_type: 'image/jpeg',
        uploaded_by: TEST_USER,
        created_at: '2024-01-01T10:00:00Z'
      }

      cy.mockApiResponse('GET', `${TEST_API_URL}/api/projects/${TEST_PROJECT_ID}/issues/${TEST_ISSUE_ID}/uploads`, { files: [imageFile] })

      // Mock image preview endpoint
      cy.intercept('GET', `${TEST_API_URL}/api/projects/${TEST_PROJECT_ID}/issues/${TEST_ISSUE_ID}/uploads/image-file-1/preview`, {
        fixture: 'test-image.jpg'
      }).as('getImagePreview')

      cy.visit(`/projects/${TEST_PROJECT_ID}/issues/${TEST_ISSUE_ID}`)
      cy.waitForApi('@getUploads')

      // Click on image to show preview
      cy.get('[data-testid="file-image-file-1"]').within(() => {
        cy.get('[data-testid="preview-btn"]').click()
      })

      // Should show image preview modal
      cy.get('[data-testid="image-preview-modal"]').should('be.visible')
      cy.get('[data-testid="preview-image"]').should('be.visible')
      cy.get('[data-testid="preview-filename"]').should('contain', 'preview-test.jpg')

      // Close preview
      cy.get('[data-testid="close-preview-btn"]').click()
      cy.get('[data-testid="image-preview-modal"]').should('not.exist')
    })
  })

  describe('File Upload', () => {
    it('should upload image file successfully', () => {
      const uploadResponse = {
        file: {
          id: 'new-file-123',
          issue_id: TEST_ISSUE_ID,
          original_name: 'uploaded-image.png',
          file_path: '/uploads/uploaded_image_123.png',
          file_size: 5120,
          mime_type: 'image/png',
          uploaded_by: TEST_USER,
          created_at: new Date().toISOString()
        }
      }

      cy.mockApiResponse('GET', `${TEST_API_URL}/api/projects/${TEST_PROJECT_ID}/issues/${TEST_ISSUE_ID}/uploads`, { files: [] })
      cy.mockApiResponse('POST', `${TEST_API_URL}/api/projects/${TEST_PROJECT_ID}/issues/${TEST_ISSUE_ID}/uploads`, uploadResponse)

      cy.visit(`/projects/${TEST_PROJECT_ID}/issues/${TEST_ISSUE_ID}`)
      cy.waitForApi('@getUploads')

      // Upload file
      const mockImageFile = createMockImageFile('uploaded-image.png', 5120)
      cy.get('[data-testid="file-upload-input"]').selectFile(mockImageFile, { force: true })

      cy.waitForApi('@uploadFile')

      // Should show success message
      cy.get('[data-testid="upload-success"]').should('be.visible')
      cy.get('[data-testid="upload-success"]').should('contain', 'ファイルをアップロードしました')

      // Should show new file in list
      cy.get('[data-testid="file-new-file-123"]').should('be.visible')
      cy.get('[data-testid="file-new-file-123"]').should('contain', 'uploaded-image.png')
    })

    it('should upload multiple files at once', () => {
      const uploadResponses = [
        {
          file: {
            id: 'multi-file-1',
            issue_id: TEST_ISSUE_ID,
            original_name: 'image1.png',
            file_path: '/uploads/image1_123.png',
            file_size: 3072,
            mime_type: 'image/png',
            uploaded_by: TEST_USER,
            created_at: new Date().toISOString()
          }
        },
        {
          file: {
            id: 'multi-file-2',
            issue_id: TEST_ISSUE_ID,
            original_name: 'image2.jpg',
            file_path: '/uploads/image2_456.jpg',
            file_size: 4096,
            mime_type: 'image/jpeg',
            uploaded_by: TEST_USER,
            created_at: new Date().toISOString()
          }
        }
      ]

      cy.mockApiResponse('GET', `${TEST_API_URL}/api/projects/${TEST_PROJECT_ID}/issues/${TEST_ISSUE_ID}/uploads`, { files: [] })
      
      // Mock multiple upload calls
      uploadResponses.forEach((response, index) => {
        cy.intercept('POST', `${TEST_API_URL}/api/projects/${TEST_PROJECT_ID}/issues/${TEST_ISSUE_ID}/uploads`, response).as(`uploadFile${index + 1}`)
      })

      cy.visit(`/projects/${TEST_PROJECT_ID}/issues/${TEST_ISSUE_ID}`)
      cy.waitForApi('@getUploads')

      // Upload multiple files
      const files = [
        createMockImageFile('image1.png', 3072),
        createMockFile('image2.jpg', 'image/jpeg', 4096)
      ]
      
      cy.get('[data-testid="file-upload-input"]').selectFile(files, { force: true })

      // Should show upload progress for multiple files
      cy.get('[data-testid="upload-progress"]').should('be.visible')
      cy.get('[data-testid="upload-progress-item"]').should('have.length', 2)

      // Wait for all uploads to complete
      cy.wait(['@uploadFile1', '@uploadFile2'])

      // Should show success for both files
      cy.get('[data-testid="upload-complete"]').should('contain', '2個のファイルをアップロードしました')
    })

    it('should show upload progress during file upload', () => {
      cy.mockApiResponse('GET', `${TEST_API_URL}/api/projects/${TEST_PROJECT_ID}/issues/${TEST_ISSUE_ID}/uploads`, { files: [] })

      // Mock slow upload with progress
      cy.intercept('POST', `${TEST_API_URL}/api/projects/${TEST_PROJECT_ID}/issues/${TEST_ISSUE_ID}/uploads`, (req) => {
        // Simulate slow upload
        req.reply({
          delay: 2000,
          statusCode: 200,
          body: {
            file: {
              id: 'progress-file-123',
              issue_id: TEST_ISSUE_ID,
              original_name: 'large-image.png',
              file_path: '/uploads/large_image_123.png',
              file_size: 1048576, // 1MB
              mime_type: 'image/png',
              uploaded_by: TEST_USER,
              created_at: new Date().toISOString()
            }
          }
        })
      }).as('uploadLargeFile')

      cy.visit(`/projects/${TEST_PROJECT_ID}/issues/${TEST_ISSUE_ID}`)

      // Upload large file
      const largeFile = createMockImageFile('large-image.png', 1048576)
      cy.get('[data-testid="file-upload-input"]').selectFile(largeFile, { force: true })

      // Should show upload progress
      cy.get('[data-testid="upload-progress"]').should('be.visible')
      cy.get('[data-testid="progress-bar"]').should('be.visible')
      cy.get('[data-testid="upload-filename"]').should('contain', 'large-image.png')
      cy.get('[data-testid="upload-size"]').should('contain', '1 MB')

      // Should show cancel button
      cy.get('[data-testid="cancel-upload-btn"]').should('be.visible')

      cy.waitForApi('@uploadLargeFile')

      // Progress should complete
      cy.get('[data-testid="upload-complete"]').should('be.visible')
    })

    it('should allow cancelling upload', () => {
      cy.mockApiResponse('GET', `${TEST_API_URL}/api/projects/${TEST_PROJECT_ID}/issues/${TEST_ISSUE_ID}/uploads`, { files: [] })

      cy.visit(`/projects/${TEST_PROJECT_ID}/issues/${TEST_ISSUE_ID}`)

      // Start upload
      const file = createMockImageFile('cancel-test.png')
      cy.get('[data-testid="file-upload-input"]').selectFile(file, { force: true })

      // Cancel upload
      cy.get('[data-testid="cancel-upload-btn"]').click()

      // Upload should be cancelled
      cy.get('[data-testid="upload-cancelled"]').should('be.visible')
      cy.get('[data-testid="upload-progress"]').should('not.exist')
    })
  })

  describe('File Upload Validation', () => {
    it('should validate file type restrictions', () => {
      cy.mockApiResponse('GET', `${TEST_API_URL}/api/projects/${TEST_PROJECT_ID}/issues/${TEST_ISSUE_ID}/uploads`, { files: [] })

      cy.visit(`/projects/${TEST_PROJECT_ID}/issues/${TEST_ISSUE_ID}`)

      // Try to upload restricted file type
      const executableFile = createMockFile('malware.exe', 'application/x-executable')
      cy.get('[data-testid="file-upload-input"]').selectFile(executableFile, { force: true })

      // Should show file type error
      cy.get('[data-testid="file-type-error"]').should('be.visible')
      cy.get('[data-testid="file-type-error"]').should('contain', 'このファイル形式はアップロードできません')
      cy.get('[data-testid="allowed-types"]').should('contain', '画像ファイル、PDF、テキストファイルのみ')
    })

    it('should validate file size limits', () => {
      cy.mockApiResponse('GET', `${TEST_API_URL}/api/projects/${TEST_PROJECT_ID}/issues/${TEST_ISSUE_ID}/uploads`, { files: [] })

      cy.visit(`/projects/${TEST_PROJECT_ID}/issues/${TEST_ISSUE_ID}`)

      // Try to upload oversized file (100MB)
      const oversizedFile = createMockImageFile('huge-image.png', 100 * 1024 * 1024)
      cy.get('[data-testid="file-upload-input"]').selectFile(oversizedFile, { force: true })

      // Should show file size error
      cy.get('[data-testid="file-size-error"]').should('be.visible')
      cy.get('[data-testid="file-size-error"]').should('contain', 'ファイルサイズが上限を超えています')
      cy.get('[data-testid="size-limit"]').should('contain', '最大 10MB まで')
    })

    it('should validate maximum number of files', () => {
      // Mock existing files near the limit
      const existingFiles = Array.from({ length: 18 }, (_, i) => ({
        id: `existing-file-${i}`,
        issue_id: TEST_ISSUE_ID,
        original_name: `file-${i}.png`,
        file_path: `/uploads/file_${i}.png`,
        file_size: 1024,
        mime_type: 'image/png',
        uploaded_by: TEST_USER,
        created_at: '2024-01-01T10:00:00Z'
      }))

      cy.mockApiResponse('GET', `${TEST_API_URL}/api/projects/${TEST_PROJECT_ID}/issues/${TEST_ISSUE_ID}/uploads`, { files: existingFiles })

      cy.visit(`/projects/${TEST_PROJECT_ID}/issues/${TEST_ISSUE_ID}`)
      cy.waitForApi('@getUploads')

      // Try to upload multiple files exceeding the limit
      const newFiles = [
        createMockImageFile('new-file-1.png'),
        createMockImageFile('new-file-2.png'),
        createMockImageFile('new-file-3.png') // This would exceed the limit of 20
      ]

      cy.get('[data-testid="file-upload-input"]').selectFile(newFiles, { force: true })

      // Should show file count error
      cy.get('[data-testid="file-count-error"]').should('be.visible')
      cy.get('[data-testid="file-count-error"]').should('contain', 'ファイル数が上限を超えています')
      cy.get('[data-testid="file-limit"]').should('contain', '最大 20ファイル まで')
    })

    it('should validate image file integrity', () => {
      cy.mockApiResponse('GET', `${TEST_API_URL}/api/projects/${TEST_PROJECT_ID}/issues/${TEST_ISSUE_ID}/uploads`, { files: [] })

      cy.visit(`/projects/${TEST_PROJECT_ID}/issues/${TEST_ISSUE_ID}`)

      // Try to upload corrupted image file
      const corruptedImage = createMockFile('corrupted.png', 'image/png', 1024)
      cy.get('[data-testid="file-upload-input"]').selectFile(corruptedImage, { force: true })

      // Should show file integrity error
      cy.get('[data-testid="file-integrity-error"]').should('be.visible')
      cy.get('[data-testid="file-integrity-error"]').should('contain', '画像ファイルが破損している可能性があります')
    })
  })

  describe('File Download', () => {
    it('should download file successfully', () => {
      const file = {
        id: 'download-file-123',
        issue_id: TEST_ISSUE_ID,
        original_name: 'download-test.png',
        file_path: '/uploads/download_test.png',
        file_size: 2048,
        mime_type: 'image/png',
        uploaded_by: TEST_USER,
        created_at: '2024-01-01T10:00:00Z'
      }

      cy.mockApiResponse('GET', `${TEST_API_URL}/api/projects/${TEST_PROJECT_ID}/issues/${TEST_ISSUE_ID}/uploads`, { files: [file] })

      // Mock download endpoint
      cy.intercept('GET', `${TEST_API_URL}/api/projects/${TEST_PROJECT_ID}/issues/${TEST_ISSUE_ID}/uploads/download-file-123/download`, {
        statusCode: 200,
        headers: {
          'content-type': 'image/png',
          'content-disposition': 'attachment; filename=download-test.png'
        },
        body: 'mock file content'
      }).as('downloadFile')

      cy.visit(`/projects/${TEST_PROJECT_ID}/issues/${TEST_ISSUE_ID}`)
      cy.waitForApi('@getUploads')

      // Click download button
      cy.get('[data-testid="file-download-file-123"]').within(() => {
        cy.get('[data-testid="download-btn"]').click()
      })

      cy.waitForApi('@downloadFile')

      // Should trigger download (browser behavior)
      // Note: In E2E tests, we can only verify the API call was made
      cy.get('[data-testid="download-initiated"]').should('be.visible')
    })

    it('should handle download errors', () => {
      const file = {
        id: 'error-download-123',
        issue_id: TEST_ISSUE_ID,
        original_name: 'error-test.png',
        file_path: '/uploads/error_test.png',
        file_size: 1024,
        mime_type: 'image/png',
        uploaded_by: TEST_USER,
        created_at: '2024-01-01T10:00:00Z'
      }

      cy.mockApiResponse('GET', `${TEST_API_URL}/api/projects/${TEST_PROJECT_ID}/issues/${TEST_ISSUE_ID}/uploads`, { files: [file] })

      // Mock download error
      cy.intercept('GET', `${TEST_API_URL}/api/projects/${TEST_PROJECT_ID}/issues/${TEST_ISSUE_ID}/uploads/error-download-123/download`, {
        statusCode: 404,
        body: { error: 'File not found' }
      }).as('downloadError')

      cy.visit(`/projects/${TEST_PROJECT_ID}/issues/${TEST_ISSUE_ID}`)
      cy.waitForApi('@getUploads')

      cy.get('[data-testid="file-error-download-123"]').within(() => {
        cy.get('[data-testid="download-btn"]').click()
      })

      cy.waitForApi('@downloadError')

      // Should show download error
      cy.get('[data-testid="download-error"]').should('contain', 'ファイルのダウンロードに失敗しました')
    })
  })

  describe('File Deletion', () => {
    it('should delete file with confirmation', () => {
      const file = {
        id: 'delete-file-123',
        issue_id: TEST_ISSUE_ID,
        original_name: 'delete-test.png',
        file_path: '/uploads/delete_test.png',
        file_size: 1024,
        mime_type: 'image/png',
        uploaded_by: TEST_USER,
        created_at: '2024-01-01T10:00:00Z'
      }

      cy.mockApiResponse('GET', `${TEST_API_URL}/api/projects/${TEST_PROJECT_ID}/issues/${TEST_ISSUE_ID}/uploads`, { files: [file] })
      cy.mockApiResponse('DELETE', `${TEST_API_URL}/api/projects/${TEST_PROJECT_ID}/issues/${TEST_ISSUE_ID}/uploads/delete-file-123`, { success: true })

      cy.window().then((win) => {
        win.localStorage.setItem('currentUser', TEST_USER)
      })

      cy.visit(`/projects/${TEST_PROJECT_ID}/issues/${TEST_ISSUE_ID}`)
      cy.waitForApi('@getUploads')

      // Click delete button
      cy.get('[data-testid="file-delete-file-123"]').within(() => {
        cy.get('[data-testid="delete-btn"]').click()
      })

      // Confirm deletion
      cy.get('[data-testid="delete-file-modal"]').should('be.visible')
      cy.get('[data-testid="delete-file-name"]').should('contain', 'delete-test.png')
      cy.get('[data-testid="confirm-delete-file-btn"]').click()

      cy.waitForApi('@deleteFile')

      // File should be removed
      cy.get('[data-testid="file-delete-file-123"]').should('not.exist')
      cy.get('[data-testid="file-deleted-success"]').should('be.visible')
    })

    it('should only show delete button for file uploader', () => {
      const myFile = {
        id: 'my-file',
        issue_id: TEST_ISSUE_ID,
        original_name: 'my-file.png',
        file_path: '/uploads/my_file.png',
        file_size: 1024,
        mime_type: 'image/png',
        uploaded_by: TEST_USER,
        created_at: '2024-01-01T10:00:00Z'
      }

      const otherFile = {
        id: 'other-file',
        issue_id: TEST_ISSUE_ID,
        original_name: 'other-file.png',
        file_path: '/uploads/other_file.png',
        file_size: 1024,
        mime_type: 'image/png',
        uploaded_by: 'other-user@example.com',
        created_at: '2024-01-01T11:00:00Z'
      }

      cy.mockApiResponse('GET', `${TEST_API_URL}/api/projects/${TEST_PROJECT_ID}/issues/${TEST_ISSUE_ID}/uploads`, { files: [myFile, otherFile] })

      cy.window().then((win) => {
        win.localStorage.setItem('currentUser', TEST_USER)
      })

      cy.visit(`/projects/${TEST_PROJECT_ID}/issues/${TEST_ISSUE_ID}`)
      cy.waitForApi('@getUploads')

      // Should show delete button for my file
      cy.get('[data-testid="file-my-file"]').within(() => {
        cy.get('[data-testid="delete-btn"]').should('be.visible')
      })

      // Should not show delete button for other user's file
      cy.get('[data-testid="file-other-file"]').within(() => {
        cy.get('[data-testid="delete-btn"]').should('not.exist')
      })
    })
  })

  describe('Permission-based Upload Features', () => {
    it('should allow file upload for editor role', () => {
      cy.mockApiResponse('POST', `${TEST_API_URL}/api/auth/project/${TEST_PROJECT_ID}/authenticate`, { 
        success: true, 
        role: 'editor' 
      })
      cy.mockApiResponse('GET', `${TEST_API_URL}/api/projects/${TEST_PROJECT_ID}/issues/${TEST_ISSUE_ID}/uploads`, { files: [] })

      cy.visit(`/projects/${TEST_PROJECT_ID}/issues/${TEST_ISSUE_ID}`)

      // Should show upload controls for editor
      cy.get('[data-testid="file-upload-input"]').should('exist')
      cy.get('[data-testid="upload-file-btn"]').should('be.visible')
      cy.get('[data-testid="drag-drop-area"]').should('be.visible')
    })

    it('should restrict file upload for viewer role', () => {
      cy.mockApiResponse('POST', `${TEST_API_URL}/api/auth/project/${TEST_PROJECT_ID}/authenticate`, { 
        success: true, 
        role: 'viewer' 
      })
      cy.mockApiResponse('GET', `${TEST_API_URL}/api/projects/${TEST_PROJECT_ID}/issues/${TEST_ISSUE_ID}/uploads`, { files: [] })

      cy.visit(`/projects/${TEST_PROJECT_ID}/issues/${TEST_ISSUE_ID}`)

      // Should not show upload controls for viewer
      cy.get('[data-testid="file-upload-input"]').should('not.exist')
      cy.get('[data-testid="upload-file-btn"]').should('not.exist')
      cy.get('[data-testid="drag-drop-area"]').should('not.exist')

      // Should show viewer restriction message
      cy.get('[data-testid="upload-viewer-restriction"]').should('contain', '閲覧者権限ではファイルをアップロードできません')
    })
  })

  describe('Drag and Drop Upload', () => {
    it('should upload files via drag and drop', () => {
      const uploadResponse = {
        file: {
          id: 'drag-drop-file-123',
          issue_id: TEST_ISSUE_ID,
          original_name: 'dragged-image.png',
          file_path: '/uploads/dragged_image_123.png',
          file_size: 3072,
          mime_type: 'image/png',
          uploaded_by: TEST_USER,
          created_at: new Date().toISOString()
        }
      }

      cy.mockApiResponse('GET', `${TEST_API_URL}/api/projects/${TEST_PROJECT_ID}/issues/${TEST_ISSUE_ID}/uploads`, { files: [] })
      cy.mockApiResponse('POST', `${TEST_API_URL}/api/projects/${TEST_PROJECT_ID}/issues/${TEST_ISSUE_ID}/uploads`, uploadResponse)

      cy.visit(`/projects/${TEST_PROJECT_ID}/issues/${TEST_ISSUE_ID}`)

      // Simulate drag and drop
      const mockFile = createMockImageFile('dragged-image.png', 3072)
      const dataTransfer = new DataTransfer()
      
      cy.get('[data-testid="drag-drop-area"]').trigger('dragenter', {
        dataTransfer
      })

      // Should show drag over state
      cy.get('[data-testid="drag-drop-area"]').should('have.class', 'drag-over')

      cy.get('[data-testid="drag-drop-area"]').trigger('drop', {
        dataTransfer: {
          files: [mockFile]
        }
      })

      cy.waitForApi('@uploadFile')

      // Should show success
      cy.get('[data-testid="upload-success"]').should('be.visible')
    })

    it('should show drag over visual feedback', () => {
      cy.mockApiResponse('GET', `${TEST_API_URL}/api/projects/${TEST_PROJECT_ID}/issues/${TEST_ISSUE_ID}/uploads`, { files: [] })

      cy.visit(`/projects/${TEST_PROJECT_ID}/issues/${TEST_ISSUE_ID}`)

      // Simulate drag enter
      cy.get('[data-testid="drag-drop-area"]').trigger('dragenter')

      // Should show visual feedback
      cy.get('[data-testid="drag-drop-area"]').should('have.class', 'drag-over')
      cy.get('[data-testid="drag-message"]').should('contain', 'ここにファイルをドロップしてください')

      // Simulate drag leave
      cy.get('[data-testid="drag-drop-area"]').trigger('dragleave')

      // Should remove visual feedback
      cy.get('[data-testid="drag-drop-area"]').should('not.have.class', 'drag-over')
    })
  })

  describe('File Error Handling', () => {
    it('should handle upload API errors', () => {
      cy.mockApiResponse('GET', `${TEST_API_URL}/api/projects/${TEST_PROJECT_ID}/issues/${TEST_ISSUE_ID}/uploads`, { files: [] })
      cy.intercept('POST', `${TEST_API_URL}/api/projects/${TEST_PROJECT_ID}/issues/${TEST_ISSUE_ID}/uploads`, {
        statusCode: 500,
        body: { error: 'Upload server error' }
      }).as('uploadError')

      cy.visit(`/projects/${TEST_PROJECT_ID}/issues/${TEST_ISSUE_ID}`)

      const file = createMockImageFile('error-test.png')
      cy.get('[data-testid="file-upload-input"]').selectFile(file, { force: true })

      cy.waitForApi('@uploadError')

      // Should show upload error
      cy.get('[data-testid="upload-error"]').should('contain', 'ファイルのアップロードに失敗しました')
      cy.get('[data-testid="retry-upload-btn"]').should('be.visible')
    })

    it('should handle file loading errors', () => {
      cy.intercept('GET', `${TEST_API_URL}/api/projects/${TEST_PROJECT_ID}/issues/${TEST_ISSUE_ID}/uploads`, {
        statusCode: 500,
        body: { error: 'Server error' }
      }).as('getUploadsError')

      cy.visit(`/projects/${TEST_PROJECT_ID}/issues/${TEST_ISSUE_ID}`)
      cy.waitForApi('@getUploadsError')

      cy.get('[data-testid="uploads-error"]').should('contain', 'ファイル一覧の読み込みに失敗しました')
      cy.get('[data-testid="retry-uploads-btn"]').should('be.visible')
    })

    it('should handle storage quota exceeded errors', () => {
      cy.mockApiResponse('GET', `${TEST_API_URL}/api/projects/${TEST_PROJECT_ID}/issues/${TEST_ISSUE_ID}/uploads`, { files: [] })
      cy.intercept('POST', `${TEST_API_URL}/api/projects/${TEST_PROJECT_ID}/issues/${TEST_ISSUE_ID}/uploads`, {
        statusCode: 413,
        body: { error: 'Storage quota exceeded' }
      }).as('quotaError')

      cy.visit(`/projects/${TEST_PROJECT_ID}/issues/${TEST_ISSUE_ID}`)

      const file = createMockImageFile('quota-test.png')
      cy.get('[data-testid="file-upload-input"]').selectFile(file, { force: true })

      cy.waitForApi('@quotaError')

      // Should show quota error
      cy.get('[data-testid="quota-error"]').should('contain', 'ストレージ容量が不足しています')
      cy.get('[data-testid="manage-storage-btn"]').should('be.visible')
    })
  })

  describe('File Organization and Search', () => {
    it('should filter files by type', () => {
      const files = [
        {
          id: 'image-file',
          original_name: 'screenshot.png',
          mime_type: 'image/png',
          issue_id: TEST_ISSUE_ID,
          file_path: '/uploads/screenshot.png',
          file_size: 1024,
          uploaded_by: TEST_USER,
          created_at: '2024-01-01T10:00:00Z'
        },
        {
          id: 'pdf-file',
          original_name: 'document.pdf',
          mime_type: 'application/pdf',
          issue_id: TEST_ISSUE_ID,
          file_path: '/uploads/document.pdf',
          file_size: 2048,
          uploaded_by: TEST_USER,
          created_at: '2024-01-01T11:00:00Z'
        }
      ]

      cy.mockApiResponse('GET', `${TEST_API_URL}/api/projects/${TEST_PROJECT_ID}/issues/${TEST_ISSUE_ID}/uploads`, { files })

      cy.visit(`/projects/${TEST_PROJECT_ID}/issues/${TEST_ISSUE_ID}`)
      cy.waitForApi('@getUploads')

      // Initially show all files
      cy.get('[data-testid="file-item"]').should('have.length', 2)

      // Filter by images only
      cy.get('[data-testid="file-type-filter"]').select('image')

      cy.get('[data-testid="file-item"]').should('have.length', 1)
      cy.get('[data-testid="file-image-file"]').should('be.visible')
      cy.get('[data-testid="file-pdf-file"]').should('not.exist')
    })

    it('should search files by name', () => {
      const files = [
        {
          id: 'search-file-1',
          original_name: 'important-screenshot.png',
          mime_type: 'image/png',
          issue_id: TEST_ISSUE_ID,
          file_path: '/uploads/important_screenshot.png',
          file_size: 1024,
          uploaded_by: TEST_USER,
          created_at: '2024-01-01T10:00:00Z'
        },
        {
          id: 'search-file-2',
          original_name: 'random-document.pdf',
          mime_type: 'application/pdf',
          issue_id: TEST_ISSUE_ID,
          file_path: '/uploads/random_document.pdf',
          file_size: 2048,
          uploaded_by: TEST_USER,
          created_at: '2024-01-01T11:00:00Z'
        }
      ]

      cy.mockApiResponse('GET', `${TEST_API_URL}/api/projects/${TEST_PROJECT_ID}/issues/${TEST_ISSUE_ID}/uploads`, { files })

      cy.visit(`/projects/${TEST_PROJECT_ID}/issues/${TEST_ISSUE_ID}`)
      cy.waitForApi('@getUploads')

      // Search for 'screenshot'
      cy.get('[data-testid="file-search-input"]').type('screenshot')

      cy.get('[data-testid="file-item"]').should('have.length', 1)
      cy.get('[data-testid="file-search-file-1"]').should('be.visible')
      cy.get('[data-testid="file-search-file-2"]').should('not.exist')
    })
  })
})