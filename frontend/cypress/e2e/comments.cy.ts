/// <reference types="cypress" />

describe('Issue Comments E2E Tests', () => {
  const TEST_API_URL = Cypress.env('backendUrl') || 'http://localhost:3001'
  const TEST_PROJECT_ID = 'test-project-123'
  const TEST_ISSUE_ID = 'test-issue-123'
  const TEST_COMMENT_BODY = 'This is a test comment with **markdown** formatting and `code`'
  const TEST_UPDATED_COMMENT_BODY = 'This is an updated comment with *emphasis*'
  const TEST_AUTHOR = 'test-user@example.com'
  const OTHER_USER = 'other-user@example.com'

  beforeEach(() => {
    // Clean up test data before each test
    cy.cleanupTestData()
    
    // Intercept Comment API calls for monitoring
    cy.intercept('GET', `${TEST_API_URL}/api/projects/${TEST_PROJECT_ID}/issues/${TEST_ISSUE_ID}/comments`).as('getComments')
    cy.intercept('POST', `${TEST_API_URL}/api/projects/${TEST_PROJECT_ID}/issues/${TEST_ISSUE_ID}/comments`).as('createComment')
    cy.intercept('PUT', `${TEST_API_URL}/api/projects/${TEST_PROJECT_ID}/issues/${TEST_ISSUE_ID}/comments/*`).as('updateComment')
    cy.intercept('DELETE', `${TEST_API_URL}/api/projects/${TEST_PROJECT_ID}/issues/${TEST_ISSUE_ID}/comments/*`).as('deleteComment')
    
    // Mock project authentication with editor role
    cy.mockApiResponse('POST', `${TEST_API_URL}/api/auth/project/${TEST_PROJECT_ID}/authenticate`, { 
      success: true, 
      role: 'editor' 
    })

    // Mock basic issue data
    const mockIssue = {
      id: TEST_ISSUE_ID,
      project_id: TEST_PROJECT_ID,
      title: 'Test Issue for Comments',
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

  describe('Comment Display', () => {
    it('should display existing comments correctly', () => {
      const mockComments = [
        {
          id: 'comment-1',
          issue_id: TEST_ISSUE_ID,
          author: TEST_AUTHOR,
          body_md: 'First comment with **bold** text',
          created_at: '2024-01-01T10:00:00Z',
          updated_at: '2024-01-01T10:00:00Z',
          is_edited: false
        },
        {
          id: 'comment-2',
          issue_id: TEST_ISSUE_ID,
          author: OTHER_USER,
          body_md: 'Second comment with *italic* text',
          created_at: '2024-01-01T11:00:00Z',
          updated_at: '2024-01-01T11:30:00Z',
          is_edited: true
        }
      ]

      cy.mockApiResponse('GET', `${TEST_API_URL}/api/projects/${TEST_PROJECT_ID}/issues/${TEST_ISSUE_ID}/comments`, mockComments)

      cy.visit(`/projects/${TEST_PROJECT_ID}/issues/${TEST_ISSUE_ID}`)
      cy.waitForApi('@getComments')

      // Check comments section is visible
      cy.get('[data-testid="comments-section"]').should('be.visible')
      cy.get('[data-testid="comments-title"]').should('contain', 'コメント')

      // Check individual comments
      cy.get('[data-testid="comment-comment-1"]').should('be.visible')
      cy.get('[data-testid="comment-comment-1"]').within(() => {
        cy.get('[data-testid="comment-author"]').should('contain', TEST_AUTHOR)
        cy.get('[data-testid="comment-body"]').should('contain', 'First comment')
        cy.get('[data-testid="comment-timestamp"]').should('contain', '2024/1/1')
        cy.get('[data-testid="comment-edited-indicator"]').should('not.exist')
      })

      cy.get('[data-testid="comment-comment-2"]').should('be.visible')
      cy.get('[data-testid="comment-comment-2"]').within(() => {
        cy.get('[data-testid="comment-author"]').should('contain', OTHER_USER)
        cy.get('[data-testid="comment-body"]').should('contain', 'Second comment')
        cy.get('[data-testid="comment-edited-indicator"]').should('contain', '編集済み')
      })
    })

    it('should display empty state when no comments exist', () => {
      cy.mockApiResponse('GET', `${TEST_API_URL}/api/projects/${TEST_PROJECT_ID}/issues/${TEST_ISSUE_ID}/comments`, [])

      cy.visit(`/projects/${TEST_PROJECT_ID}/issues/${TEST_ISSUE_ID}`)
      cy.waitForApi('@getComments')

      cy.get('[data-testid="comments-section"]').should('be.visible')
      cy.get('[data-testid="no-comments-message"]').should('contain', 'まだコメントがありません')
      cy.get('[data-testid="first-comment-prompt"]').should('contain', '最初のコメントを追加してください')
    })

    it('should render markdown in comments correctly', () => {
      const markdownComment = {
        id: 'markdown-comment',
        issue_id: TEST_ISSUE_ID,
        author: TEST_AUTHOR,
        body_md: '**Bold text**, *italic text*, `code`, and [link](https://example.com)',
        created_at: '2024-01-01T10:00:00Z',
        updated_at: '2024-01-01T10:00:00Z',
        is_edited: false
      }

      cy.mockApiResponse('GET', `${TEST_API_URL}/api/projects/${TEST_PROJECT_ID}/issues/${TEST_ISSUE_ID}/comments`, [markdownComment])

      cy.visit(`/projects/${TEST_PROJECT_ID}/issues/${TEST_ISSUE_ID}`)
      cy.waitForApi('@getComments')

      cy.get('[data-testid="comment-markdown-comment"]').within(() => {
        // Check markdown rendering
        cy.get('[data-testid="comment-body"]').within(() => {
          cy.get('strong').should('contain', 'Bold text')
          cy.get('em').should('contain', 'italic text')
          cy.get('code').should('contain', 'code')
          cy.get('a[href="https://example.com"]').should('contain', 'link')
        })
      })
    })
  })

  describe('Comment Creation', () => {
    it('should create a new comment successfully', () => {
      const newComment = {
        id: 'new-comment-123',
        issue_id: TEST_ISSUE_ID,
        author: TEST_AUTHOR,
        body_md: TEST_COMMENT_BODY,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
        is_edited: false
      }

      cy.mockApiResponse('GET', `${TEST_API_URL}/api/projects/${TEST_PROJECT_ID}/issues/${TEST_ISSUE_ID}/comments`, [])
      cy.mockApiResponse('POST', `${TEST_API_URL}/api/projects/${TEST_PROJECT_ID}/issues/${TEST_ISSUE_ID}/comments`, newComment)

      cy.visit(`/projects/${TEST_PROJECT_ID}/issues/${TEST_ISSUE_ID}`)
      cy.waitForApi('@getComments')

      // Fill in comment form
      cy.get('[data-testid="new-comment-textarea"]').type(TEST_COMMENT_BODY)
      
      // Submit comment
      cy.get('[data-testid="submit-comment-btn"]').click()

      cy.waitForApi('@createComment')
      
      // Should show success message
      cy.get('[data-testid="comment-created-success"]').should('be.visible')
      
      // Comment form should be cleared
      cy.get('[data-testid="new-comment-textarea"]').should('have.value', '')

      // New comment should appear in list
      cy.get('[data-testid="comment-new-comment-123"]').should('be.visible')
      cy.get('[data-testid="comment-new-comment-123"]').should('contain', TEST_COMMENT_BODY.replace('**', '').replace('**', ''))
    })

    it('should show preview of markdown in comment form', () => {
      cy.mockApiResponse('GET', `${TEST_API_URL}/api/projects/${TEST_PROJECT_ID}/issues/${TEST_ISSUE_ID}/comments`, [])

      cy.visit(`/projects/${TEST_PROJECT_ID}/issues/${TEST_ISSUE_ID}`)

      // Type markdown in textarea
      cy.get('[data-testid="new-comment-textarea"]').type('**Bold** and *italic* and `code`')
      
      // Switch to preview mode
      cy.get('[data-testid="preview-mode-btn"]').click()
      
      // Check preview rendering
      cy.get('[data-testid="comment-preview"]').should('be.visible')
      cy.get('[data-testid="comment-preview"]').within(() => {
        cy.get('strong').should('contain', 'Bold')
        cy.get('em').should('contain', 'italic')
        cy.get('code').should('contain', 'code')
      })

      // Switch back to edit mode
      cy.get('[data-testid="edit-mode-btn"]').click()
      cy.get('[data-testid="new-comment-textarea"]').should('be.visible')
    })

    it('should validate comment input', () => {
      cy.mockApiResponse('GET', `${TEST_API_URL}/api/projects/${TEST_PROJECT_ID}/issues/${TEST_ISSUE_ID}/comments`, [])

      cy.visit(`/projects/${TEST_PROJECT_ID}/issues/${TEST_ISSUE_ID}`)

      // Try to submit empty comment
      cy.get('[data-testid="submit-comment-btn"]').click()
      cy.get('[data-testid="comment-validation-error"]').should('contain', 'コメントを入力してください')

      // Try to submit comment that's too short
      cy.get('[data-testid="new-comment-textarea"]').type('a')
      cy.get('[data-testid="submit-comment-btn"]').click()
      cy.get('[data-testid="comment-validation-error"]').should('contain', '2文字以上で入力してください')
    })

    it('should handle comment creation errors', () => {
      cy.mockApiResponse('GET', `${TEST_API_URL}/api/projects/${TEST_PROJECT_ID}/issues/${TEST_ISSUE_ID}/comments`, [])
      cy.intercept('POST', `${TEST_API_URL}/api/projects/${TEST_PROJECT_ID}/issues/${TEST_ISSUE_ID}/comments`, {
        statusCode: 400,
        body: { error: 'Comment creation failed' }
      }).as('createCommentError')

      cy.visit(`/projects/${TEST_PROJECT_ID}/issues/${TEST_ISSUE_ID}`)

      cy.get('[data-testid="new-comment-textarea"]').type(TEST_COMMENT_BODY)
      cy.get('[data-testid="submit-comment-btn"]').click()

      cy.waitForApi('@createCommentError')
      cy.get('[data-testid="comment-creation-error"]').should('contain', 'コメントの作成に失敗しました')
    })
  })

  describe('Comment Editing', () => {
    it('should edit existing comment successfully', () => {
      const originalComment = {
        id: 'edit-comment-123',
        issue_id: TEST_ISSUE_ID,
        author: TEST_AUTHOR,
        body_md: TEST_COMMENT_BODY,
        created_at: '2024-01-01T10:00:00Z',
        updated_at: '2024-01-01T10:00:00Z',
        is_edited: false
      }

      const updatedComment = {
        ...originalComment,
        body_md: TEST_UPDATED_COMMENT_BODY,
        updated_at: new Date().toISOString(),
        is_edited: true
      }

      cy.mockApiResponse('GET', `${TEST_API_URL}/api/projects/${TEST_PROJECT_ID}/issues/${TEST_ISSUE_ID}/comments`, [originalComment])
      cy.mockApiResponse('PUT', `${TEST_API_URL}/api/projects/${TEST_PROJECT_ID}/issues/${TEST_ISSUE_ID}/comments/edit-comment-123`, updatedComment)

      cy.visit(`/projects/${TEST_PROJECT_ID}/issues/${TEST_ISSUE_ID}`)
      cy.waitForApi('@getComments')

      // Start editing comment
      cy.get('[data-testid="comment-edit-comment-123"]').within(() => {
        cy.get('[data-testid="edit-comment-btn"]').click()
      })

      // Edit form should appear
      cy.get('[data-testid="edit-comment-form"]').should('be.visible')
      cy.get('[data-testid="edit-comment-textarea"]').should('have.value', TEST_COMMENT_BODY)

      // Update comment content
      cy.get('[data-testid="edit-comment-textarea"]').clear().type(TEST_UPDATED_COMMENT_BODY)
      cy.get('[data-testid="save-comment-btn"]').click()

      cy.waitForApi('@updateComment')

      // Should show success message
      cy.get('[data-testid="comment-updated-success"]').should('be.visible')

      // Comment should show updated content
      cy.get('[data-testid="comment-edit-comment-123"]').should('contain', TEST_UPDATED_COMMENT_BODY.replace('*', '').replace('*', ''))
      cy.get('[data-testid="comment-edited-indicator"]').should('contain', '編集済み')
    })

    it('should cancel comment editing', () => {
      const comment = {
        id: 'cancel-edit-comment',
        issue_id: TEST_ISSUE_ID,
        author: TEST_AUTHOR,
        body_md: TEST_COMMENT_BODY,
        created_at: '2024-01-01T10:00:00Z',
        updated_at: '2024-01-01T10:00:00Z',
        is_edited: false
      }

      cy.mockApiResponse('GET', `${TEST_API_URL}/api/projects/${TEST_PROJECT_ID}/issues/${TEST_ISSUE_ID}/comments`, [comment])

      cy.visit(`/projects/${TEST_PROJECT_ID}/issues/${TEST_ISSUE_ID}`)
      cy.waitForApi('@getComments')

      // Start editing
      cy.get('[data-testid="comment-cancel-edit-comment"]').within(() => {
        cy.get('[data-testid="edit-comment-btn"]').click()
      })

      // Make some changes
      cy.get('[data-testid="edit-comment-textarea"]').clear().type('Changed text')
      
      // Cancel editing
      cy.get('[data-testid="cancel-edit-btn"]').click()

      // Should return to original state
      cy.get('[data-testid="edit-comment-form"]').should('not.exist')
      cy.get('[data-testid="comment-cancel-edit-comment"]').should('contain', TEST_COMMENT_BODY.replace('**', '').replace('**', ''))
    })

    it('should only show edit button for comment author', () => {
      const myComment = {
        id: 'my-comment',
        issue_id: TEST_ISSUE_ID,
        author: TEST_AUTHOR,
        body_md: 'My comment',
        created_at: '2024-01-01T10:00:00Z',
        updated_at: '2024-01-01T10:00:00Z',
        is_edited: false
      }

      const otherComment = {
        id: 'other-comment',
        issue_id: TEST_ISSUE_ID,
        author: OTHER_USER,
        body_md: 'Other user comment',
        created_at: '2024-01-01T11:00:00Z',
        updated_at: '2024-01-01T11:00:00Z',
        is_edited: false
      }

      cy.mockApiResponse('GET', `${TEST_API_URL}/api/projects/${TEST_PROJECT_ID}/issues/${TEST_ISSUE_ID}/comments`, [myComment, otherComment])

      // Mock current user
      cy.window().then((win) => {
        win.localStorage.setItem('currentUser', TEST_AUTHOR)
      })

      cy.visit(`/projects/${TEST_PROJECT_ID}/issues/${TEST_ISSUE_ID}`)
      cy.waitForApi('@getComments')

      // Should show edit button for my comment
      cy.get('[data-testid="comment-my-comment"]').within(() => {
        cy.get('[data-testid="edit-comment-btn"]').should('be.visible')
        cy.get('[data-testid="delete-comment-btn"]').should('be.visible')
      })

      // Should not show edit button for other user's comment
      cy.get('[data-testid="comment-other-comment"]').within(() => {
        cy.get('[data-testid="edit-comment-btn"]').should('not.exist')
        cy.get('[data-testid="delete-comment-btn"]').should('not.exist')
      })
    })
  })

  describe('Comment Deletion', () => {
    it('should delete comment with confirmation', () => {
      const comment = {
        id: 'delete-comment-123',
        issue_id: TEST_ISSUE_ID,
        author: TEST_AUTHOR,
        body_md: 'Comment to delete',
        created_at: '2024-01-01T10:00:00Z',
        updated_at: '2024-01-01T10:00:00Z',
        is_edited: false
      }

      cy.mockApiResponse('GET', `${TEST_API_URL}/api/projects/${TEST_PROJECT_ID}/issues/${TEST_ISSUE_ID}/comments`, [comment])
      cy.mockApiResponse('DELETE', `${TEST_API_URL}/api/projects/${TEST_PROJECT_ID}/issues/${TEST_ISSUE_ID}/comments/delete-comment-123`, { success: true })

      cy.window().then((win) => {
        win.localStorage.setItem('currentUser', TEST_AUTHOR)
      })

      cy.visit(`/projects/${TEST_PROJECT_ID}/issues/${TEST_ISSUE_ID}`)
      cy.waitForApi('@getComments')

      // Click delete button
      cy.get('[data-testid="comment-delete-comment-123"]').within(() => {
        cy.get('[data-testid="delete-comment-btn"]').click()
      })

      // Confirm deletion
      cy.get('[data-testid="delete-comment-modal"]').should('be.visible')
      cy.get('[data-testid="confirm-delete-comment-btn"]').click()

      cy.waitForApi('@deleteComment')

      // Comment should be removed
      cy.get('[data-testid="comment-delete-comment-123"]').should('not.exist')
      cy.get('[data-testid="comment-deleted-success"]').should('be.visible')
    })

    it('should cancel comment deletion', () => {
      const comment = {
        id: 'cancel-delete-comment',
        issue_id: TEST_ISSUE_ID,
        author: TEST_AUTHOR,
        body_md: 'Comment not to delete',
        created_at: '2024-01-01T10:00:00Z',
        updated_at: '2024-01-01T10:00:00Z',
        is_edited: false
      }

      cy.mockApiResponse('GET', `${TEST_API_URL}/api/projects/${TEST_PROJECT_ID}/issues/${TEST_ISSUE_ID}/comments`, [comment])

      cy.window().then((win) => {
        win.localStorage.setItem('currentUser', TEST_AUTHOR)
      })

      cy.visit(`/projects/${TEST_PROJECT_ID}/issues/${TEST_ISSUE_ID}`)
      cy.waitForApi('@getComments')

      // Click delete button
      cy.get('[data-testid="comment-cancel-delete-comment"]').within(() => {
        cy.get('[data-testid="delete-comment-btn"]').click()
      })

      // Cancel deletion
      cy.get('[data-testid="delete-comment-modal"]').should('be.visible')
      cy.get('[data-testid="cancel-delete-comment-btn"]').click()

      // Modal should close and comment should remain
      cy.get('[data-testid="delete-comment-modal"]').should('not.exist')
      cy.get('[data-testid="comment-cancel-delete-comment"]').should('be.visible')
    })
  })

  describe('Permission-based Comment Features', () => {
    it('should allow comments for editor role', () => {
      cy.mockApiResponse('POST', `${TEST_API_URL}/api/auth/project/${TEST_PROJECT_ID}/authenticate`, { 
        success: true, 
        role: 'editor' 
      })
      cy.mockApiResponse('GET', `${TEST_API_URL}/api/projects/${TEST_PROJECT_ID}/issues/${TEST_ISSUE_ID}/comments`, [])

      cy.visit(`/projects/${TEST_PROJECT_ID}/issues/${TEST_ISSUE_ID}`)

      // Should show comment form for editor
      cy.get('[data-testid="new-comment-textarea"]').should('be.visible')
      cy.get('[data-testid="submit-comment-btn"]').should('be.visible')
    })

    it('should restrict comments for viewer role', () => {
      cy.mockApiResponse('POST', `${TEST_API_URL}/api/auth/project/${TEST_PROJECT_ID}/authenticate`, { 
        success: true, 
        role: 'viewer' 
      })
      cy.mockApiResponse('GET', `${TEST_API_URL}/api/projects/${TEST_PROJECT_ID}/issues/${TEST_ISSUE_ID}/comments`, [])

      cy.visit(`/projects/${TEST_PROJECT_ID}/issues/${TEST_ISSUE_ID}`)

      // Should not show comment form for viewer
      cy.get('[data-testid="new-comment-textarea"]').should('not.exist')
      cy.get('[data-testid="submit-comment-btn"]').should('not.exist')

      // Should show viewer restriction message
      cy.get('[data-testid="comment-viewer-restriction"]').should('contain', '閲覧者権限ではコメントできません')
    })
  })

  describe('Real-time Comment Updates', () => {
    it('should receive real-time new comments via WebSocket', () => {
      const initialComments = [
        {
          id: 'existing-comment',
          issue_id: TEST_ISSUE_ID,
          author: TEST_AUTHOR,
          body_md: 'Existing comment',
          created_at: '2024-01-01T10:00:00Z',
          updated_at: '2024-01-01T10:00:00Z',
          is_edited: false
        }
      ]

      cy.mockApiResponse('GET', `${TEST_API_URL}/api/projects/${TEST_PROJECT_ID}/issues/${TEST_ISSUE_ID}/comments`, initialComments)

      cy.visit(`/projects/${TEST_PROJECT_ID}/issues/${TEST_ISSUE_ID}`)
      cy.waitForApi('@getComments')

      // Initial state
      cy.get('[data-testid="comment-item"]').should('have.length', 1)

      // Simulate WebSocket new comment
      cy.window().then((win) => {
        win.dispatchEvent(new CustomEvent('websocket-message', {
          detail: JSON.stringify({
            type: 'comment_added',
            data: {
              id: 'new-realtime-comment',
              issue_id: TEST_ISSUE_ID,
              author: OTHER_USER,
              body_md: 'New comment added via WebSocket',
              created_at: new Date().toISOString(),
              updated_at: new Date().toISOString(),
              is_edited: false
            }
          })
        }))
      })

      // Should show new comment notification
      cy.get('[data-testid="new-comment-notification"]').should('be.visible')
      cy.get('[data-testid="new-comment-notification"]').should('contain', OTHER_USER)

      // Click to refresh and show new comment
      cy.get('[data-testid="refresh-comments-btn"]').click()
      cy.get('[data-testid="comment-item"]').should('have.length', 2)
      cy.contains('New comment added via WebSocket').should('be.visible')
    })

    it('should receive real-time comment updates via WebSocket', () => {
      const comment = {
        id: 'update-realtime-comment',
        issue_id: TEST_ISSUE_ID,
        author: TEST_AUTHOR,
        body_md: 'Original comment',
        created_at: '2024-01-01T10:00:00Z',
        updated_at: '2024-01-01T10:00:00Z',
        is_edited: false
      }

      cy.mockApiResponse('GET', `${TEST_API_URL}/api/projects/${TEST_PROJECT_ID}/issues/${TEST_ISSUE_ID}/comments`, [comment])

      cy.visit(`/projects/${TEST_PROJECT_ID}/issues/${TEST_ISSUE_ID}`)
      cy.waitForApi('@getComments')

      // Initial state
      cy.get('[data-testid="comment-update-realtime-comment"]').should('contain', 'Original comment')

      // Simulate WebSocket comment update
      cy.window().then((win) => {
        win.dispatchEvent(new CustomEvent('websocket-message', {
          detail: JSON.stringify({
            type: 'comment_updated',
            data: {
              ...comment,
              body_md: 'Updated comment via WebSocket',
              updated_at: new Date().toISOString(),
              is_edited: true
            }
          })
        }))
      })

      // Should show update indicator
      cy.get('[data-testid="comment-update-indicator"]').should('be.visible')
      cy.get('[data-testid="refresh-comment-btn"]').click()

      // Comment should be updated
      cy.get('[data-testid="comment-update-realtime-comment"]').should('contain', 'Updated comment via WebSocket')
      cy.get('[data-testid="comment-edited-indicator"]').should('contain', '編集済み')
    })

    it('should handle WebSocket connection errors gracefully', () => {
      cy.mockApiResponse('GET', `${TEST_API_URL}/api/projects/${TEST_PROJECT_ID}/issues/${TEST_ISSUE_ID}/comments`, [])

      cy.visit(`/projects/${TEST_PROJECT_ID}/issues/${TEST_ISSUE_ID}`)

      // Simulate WebSocket connection error
      cy.window().then((win) => {
        win.dispatchEvent(new CustomEvent('websocket-error', {
          detail: { message: 'Connection lost' }
        }))
      })

      // Should show connection error message
      cy.get('[data-testid="websocket-error"]').should('be.visible')
      cy.get('[data-testid="websocket-error"]').should('contain', 'リアルタイム更新が無効です')
      cy.get('[data-testid="manual-refresh-btn"]').should('be.visible')
    })
  })

  describe('Comment Formatting and Mentions', () => {
    it('should support @ mentions in comments', () => {
      const commentWithMention = {
        id: 'mention-comment',
        issue_id: TEST_ISSUE_ID,
        author: TEST_AUTHOR,
        body_md: `@${OTHER_USER} please review this issue`,
        created_at: '2024-01-01T10:00:00Z',
        updated_at: '2024-01-01T10:00:00Z',
        is_edited: false
      }

      cy.mockApiResponse('GET', `${TEST_API_URL}/api/projects/${TEST_PROJECT_ID}/issues/${TEST_ISSUE_ID}/comments`, [commentWithMention])

      cy.visit(`/projects/${TEST_PROJECT_ID}/issues/${TEST_ISSUE_ID}`)
      cy.waitForApi('@getComments')

      // Check mention is highlighted
      cy.get('[data-testid="comment-mention-comment"]').within(() => {
        cy.get('[data-testid="comment-body"]').within(() => {
          cy.get('[data-testid="mention"]').should('contain', `@${OTHER_USER}`)
          cy.get('[data-testid="mention"]').should('have.class', 'mention-highlight')
        })
      })
    })

    it('should provide autocomplete for mentions while typing', () => {
      const users = [TEST_AUTHOR, OTHER_USER, 'another-user@example.com']
      
      cy.mockApiResponse('GET', `${TEST_API_URL}/api/projects/${TEST_PROJECT_ID}/users`, users)
      cy.mockApiResponse('GET', `${TEST_API_URL}/api/projects/${TEST_PROJECT_ID}/issues/${TEST_ISSUE_ID}/comments`, [])

      cy.visit(`/projects/${TEST_PROJECT_ID}/issues/${TEST_ISSUE_ID}`)

      // Start typing mention
      cy.get('[data-testid="new-comment-textarea"]').type('Hey @o')

      // Should show autocomplete
      cy.get('[data-testid="mention-autocomplete"]').should('be.visible')
      cy.get('[data-testid="mention-suggestion"]').should('contain', OTHER_USER)

      // Select from autocomplete
      cy.get(`[data-testid="mention-option-${OTHER_USER}"]`).click()

      // Should insert the mention
      cy.get('[data-testid="new-comment-textarea"]').should('have.value', `Hey @${OTHER_USER} `)
    })

    it('should support emoji reactions to comments', () => {
      const comment = {
        id: 'reaction-comment',
        issue_id: TEST_ISSUE_ID,
        author: OTHER_USER,
        body_md: 'Great work on this!',
        created_at: '2024-01-01T10:00:00Z',
        updated_at: '2024-01-01T10:00:00Z',
        is_edited: false,
        reactions: [
          { emoji: '👍', users: [TEST_AUTHOR], count: 1 },
          { emoji: '❤️', users: ['user3@example.com'], count: 1 }
        ]
      }

      cy.mockApiResponse('GET', `${TEST_API_URL}/api/projects/${TEST_PROJECT_ID}/issues/${TEST_ISSUE_ID}/comments`, [comment])
      cy.intercept('POST', `${TEST_API_URL}/api/projects/${TEST_PROJECT_ID}/issues/${TEST_ISSUE_ID}/comments/reaction-comment/reactions`).as('addReaction')

      cy.visit(`/projects/${TEST_PROJECT_ID}/issues/${TEST_ISSUE_ID}`)
      cy.waitForApi('@getComments')

      // Check existing reactions
      cy.get('[data-testid="comment-reaction-comment"]').within(() => {
        cy.get('[data-testid="reaction-👍"]').should('contain', '1')
        cy.get('[data-testid="reaction-❤️"]').should('contain', '1')
      })

      // Add new reaction
      cy.get('[data-testid="add-reaction-btn"]').click()
      cy.get('[data-testid="emoji-picker"]').should('be.visible')
      cy.get('[data-testid="emoji-🚀"]').click()

      cy.waitForApi('@addReaction')
      cy.get('[data-testid="reaction-🚀"]').should('contain', '1')
    })
  })

  describe('Comment Error Handling', () => {
    it('should handle comment loading errors', () => {
      cy.intercept('GET', `${TEST_API_URL}/api/projects/${TEST_PROJECT_ID}/issues/${TEST_ISSUE_ID}/comments`, {
        statusCode: 500,
        body: { error: 'Server error' }
      }).as('getCommentsError')

      cy.visit(`/projects/${TEST_PROJECT_ID}/issues/${TEST_ISSUE_ID}`)
      cy.waitForApi('@getCommentsError')

      cy.get('[data-testid="comments-error"]').should('contain', 'コメントの読み込みに失敗しました')
      cy.get('[data-testid="retry-comments-btn"]').should('be.visible')
    })

    it('should handle comment update errors', () => {
      const comment = {
        id: 'error-comment',
        issue_id: TEST_ISSUE_ID,
        author: TEST_AUTHOR,
        body_md: 'Original comment',
        created_at: '2024-01-01T10:00:00Z',
        updated_at: '2024-01-01T10:00:00Z',
        is_edited: false
      }

      cy.mockApiResponse('GET', `${TEST_API_URL}/api/projects/${TEST_PROJECT_ID}/issues/${TEST_ISSUE_ID}/comments`, [comment])
      cy.intercept('PUT', `${TEST_API_URL}/api/projects/${TEST_PROJECT_ID}/issues/${TEST_ISSUE_ID}/comments/error-comment`, {
        statusCode: 403,
        body: { error: 'Permission denied' }
      }).as('updateCommentError')

      cy.window().then((win) => {
        win.localStorage.setItem('currentUser', TEST_AUTHOR)
      })

      cy.visit(`/projects/${TEST_PROJECT_ID}/issues/${TEST_ISSUE_ID}`)
      cy.waitForApi('@getComments')

      // Try to edit comment
      cy.get('[data-testid="comment-error-comment"]').within(() => {
        cy.get('[data-testid="edit-comment-btn"]').click()
      })

      cy.get('[data-testid="edit-comment-textarea"]').clear().type('Updated content')
      cy.get('[data-testid="save-comment-btn"]').click()

      cy.waitForApi('@updateCommentError')
      cy.get('[data-testid="comment-update-error"]').should('contain', 'コメントの更新に失敗しました')
    })
  })
})