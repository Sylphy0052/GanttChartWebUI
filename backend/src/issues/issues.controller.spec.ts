import { Test, TestingModule } from '@nestjs/testing';
import { BadRequestException, NotFoundException, ConflictException } from '@nestjs/common';
import { IssuesController } from './issues.controller';
import { IssuesService } from './issues.service';
import { CreateIssueDto, UpdateIssueDto, IssueResponseDto } from './dto';
import { RoleGuard } from '../common/guards/role.guard';
import { ExecutionContext } from '@nestjs/common';

/**
 * IssuesControllerの統合テスト
 * 
 * テスト範囲:
 * - HTTP エンドポイントの動作確認
 * - バリデーションの確認
 * - 権限ガードの動作
 * - エラーレスポンスの確認
 * - DTOの変換確認
 */
describe('IssuesController', () => {
  let controller: IssuesController;
  let issuesService: IssuesService;

  const mockIssuesService = {
    create: jest.fn(),
    findAll: jest.fn(),
    findOne: jest.fn(),
    update: jest.fn(),
    remove: jest.fn(),
  };

  const mockRoleGuard = {
    canActivate: jest.fn((context: ExecutionContext) => true),
  };

  const mockIssueResponse: IssueResponseDto = {
    id: 'issue-1',
    project_id: 'project-1',
    parent_id: null,
    title: 'Test Issue',
    description_md: 'Test description',
    assignee: 'test-user',
    status: 'open',
    start_date: new Date('2024-01-01'),
    end_date: new Date('2024-12-31'),
    progress_pct: 0,
    effort_hours: 8,
    is_blocked: false,
    sort_order: 0,
    labels: ['bug', 'high-priority'],
    version: 1,
    is_deleted: false, // 必須フィールドを追加
    created_at: new Date(),
    updated_at: new Date(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [IssuesController],
      providers: [
        {
          provide: IssuesService,
          useValue: mockIssuesService,
        },
      ],
    })
      .overrideGuard(RoleGuard)
      .useValue(mockRoleGuard)
      .compile();

    controller = module.get<IssuesController>(IssuesController);
    issuesService = module.get<IssuesService>(IssuesService);
  });

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });

  describe('create (POST /projects/:projectId/issues)', () => {
    const projectId = 'project-1';
    const createIssueDto = {
      title: 'Test Issue',
      description_md: 'Test description',
      assignee: 'test-user',
      status: 'open' as const,
      start_date: '2024-01-01',
      end_date: '2024-12-31',
      progress_pct: 0,
      effort_hours: 8,
      is_blocked: false,
      sort_order: 0,
      labels: ['bug'],
      parent_id: null,
      project_id: 'project-1',
    };

    it('should create an issue successfully', async () => {
      mockIssuesService.create.mockResolvedValue(mockIssueResponse);

      const result = await controller.create(projectId, createIssueDto);

      expect(mockIssuesService.create).toHaveBeenCalledWith({
        ...createIssueDto,
        project_id: projectId,
      });
      expect(result).toEqual(mockIssueResponse);
    });

    it('should handle service validation errors', async () => {
      const validationError = new BadRequestException('Invalid parent issue');
      mockIssuesService.create.mockRejectedValue(validationError);

      await expect(controller.create(projectId, createIssueDto)).rejects.toThrow(
        BadRequestException,
      );
      expect(mockIssuesService.create).toHaveBeenCalledWith({
        ...createIssueDto,
        project_id: projectId,
      });
    });

    it('should handle project not found errors', async () => {
      const notFoundError = new NotFoundException('Project not found');
      mockIssuesService.create.mockRejectedValue(notFoundError);

      await expect(controller.create(projectId, createIssueDto)).rejects.toThrow(
        NotFoundException,
      );
    });

    it('should map projectId from URL parameter to DTO', async () => {
      mockIssuesService.create.mockResolvedValue(mockIssueResponse);

      await controller.create(projectId, createIssueDto);

      expect(mockIssuesService.create).toHaveBeenCalledWith(
        expect.objectContaining({
          project_id: projectId,
        }),
      );
    });
  });

  describe('findAll (GET /projects/:projectId/issues)', () => {
    const projectId = 'project-1';
    const mockIssues = [mockIssueResponse];

    it('should return all issues for a project', async () => {
      mockIssuesService.findAll.mockResolvedValue(mockIssues);

      const result = await controller.findAll(projectId);

      expect(mockIssuesService.findAll).toHaveBeenCalledWith(projectId);
      expect(result).toEqual(mockIssues);
    });

    it('should return empty array when no issues found', async () => {
      mockIssuesService.findAll.mockResolvedValue([]);

      const result = await controller.findAll(projectId);

      expect(result).toEqual([]);
    });

    it('should handle project not found errors', async () => {
      const notFoundError = new NotFoundException('Project not found');
      mockIssuesService.findAll.mockRejectedValue(notFoundError);

      await expect(controller.findAll(projectId)).rejects.toThrow(
        NotFoundException,
      );
    });
  });

  describe('findOne (GET /projects/:projectId/issues/:id)', () => {
    const projectId = 'project-1';
    const issueId = 'issue-1';

    it('should return a single issue', async () => {
      mockIssuesService.findOne.mockResolvedValue(mockIssueResponse);

      const result = await controller.findOne(projectId, issueId);

      expect(mockIssuesService.findOne).toHaveBeenCalledWith(issueId);
      expect(result).toEqual(mockIssueResponse);
    });

    it('should handle issue not found errors', async () => {
      const notFoundError = new NotFoundException('Issue not found');
      mockIssuesService.findOne.mockRejectedValue(notFoundError);

      await expect(controller.findOne(projectId, issueId)).rejects.toThrow(
        NotFoundException,
      );
    });

    it('should not validate projectId (service handles validation)', async () => {
      mockIssuesService.findOne.mockResolvedValue(mockIssueResponse);

      await controller.findOne(projectId, issueId);

      // プロジェクトIDの検証はServiceで実行されるため、controllerではissueIdのみ渡される
      expect(mockIssuesService.findOne).toHaveBeenCalledWith(issueId);
    });
  });

  describe('update (PUT /projects/:projectId/issues/:id)', () => {
    const projectId = 'project-1';
    const issueId = 'issue-1';
    const updateIssueDto: UpdateIssueDto = {
      title: 'Updated Title',
      status: 'in_progress',
      progress_pct: 50,
    };

    it('should update an issue successfully', async () => {
      const updatedIssue = { ...mockIssueResponse, ...updateIssueDto };
      mockIssuesService.update.mockResolvedValue(updatedIssue);

      const result = await controller.update(projectId, issueId, updateIssueDto);

      expect(mockIssuesService.update).toHaveBeenCalledWith(issueId, updateIssueDto);
      expect(result).toEqual(updatedIssue);
    });

    it('should handle partial updates', async () => {
      const partialUpdate = { title: 'Partially Updated' };
      const updatedIssue = { ...mockIssueResponse, title: partialUpdate.title };
      mockIssuesService.update.mockResolvedValue(updatedIssue);

      const result = await controller.update(projectId, issueId, partialUpdate);

      expect(mockIssuesService.update).toHaveBeenCalledWith(issueId, partialUpdate);
      expect(result).toEqual(updatedIssue);
    });

    it('should handle issue not found errors', async () => {
      const notFoundError = new NotFoundException('Issue not found');
      mockIssuesService.update.mockRejectedValue(notFoundError);

      await expect(
        controller.update(projectId, issueId, updateIssueDto),
      ).rejects.toThrow(NotFoundException);
    });

    it('should handle optimistic locking conflicts', async () => {
      const conflictError = new ConflictException('Issue was updated by another user');
      mockIssuesService.update.mockRejectedValue(conflictError);

      await expect(
        controller.update(projectId, issueId, updateIssueDto),
      ).rejects.toThrow(ConflictException);
    });

    it('should handle invalid parent_id errors', async () => {
      const invalidParentDto = { parent_id: 'invalid-parent' };
      const badRequestError = new BadRequestException('Invalid parent issue');
      mockIssuesService.update.mockRejectedValue(badRequestError);

      await expect(
        controller.update(projectId, issueId, invalidParentDto),
      ).rejects.toThrow(BadRequestException);
    });
  });

  describe('remove (DELETE /projects/:projectId/issues/:id)', () => {
    const projectId = 'project-1';
    const issueId = 'issue-1';

    it('should delete an issue successfully', async () => {
      mockIssuesService.remove.mockResolvedValue({ message: 'Issue deleted successfully' });

      await controller.remove(projectId, issueId);

      expect(mockIssuesService.remove).toHaveBeenCalledWith(issueId);
    });

    it('should handle issue not found errors', async () => {
      const notFoundError = new NotFoundException('Issue not found');
      mockIssuesService.remove.mockRejectedValue(notFoundError);

      await expect(controller.remove(projectId, issueId)).rejects.toThrow(
        NotFoundException,
      );
    });

    it('should handle conflicts when issue has children', async () => {
      const conflictError = new ConflictException('Issue has child issues');
      mockIssuesService.remove.mockRejectedValue(conflictError);

      await expect(controller.remove(projectId, issueId)).rejects.toThrow(
        ConflictException,
      );
    });

    it('should return void on successful deletion', async () => {
      mockIssuesService.remove.mockResolvedValue({ message: 'Issue deleted' });

      const result = await controller.remove(projectId, issueId);

      expect(result).toBeUndefined();
    });
  });

  describe('Role Guard Integration', () => {
    it('should apply RoleGuard to all endpoints', () => {
      const guards = Reflect.getMetadata('__guards__', IssuesController);
      expect(guards).toContain(RoleGuard);
    });

    it('should require editor role for create', async () => {
      const metadata = Reflect.getMetadata(
        '__require-role__',
        controller.create,
      );
      expect(metadata).toBe('editor');
    });

    it('should require editor role for update', async () => {
      const metadata = Reflect.getMetadata(
        '__require-role__',
        controller.update,
      );
      expect(metadata).toBe('editor');
    });

    it('should require editor role for remove', async () => {
      const metadata = Reflect.getMetadata(
        '__require-role__',
        controller.remove,
      );
      expect(metadata).toBe('editor');
    });

    it('should require viewer role for findAll', async () => {
      const metadata = Reflect.getMetadata(
        '__require-role__',
        controller.findAll,
      );
      expect(metadata).toBe('viewer');
    });

    it('should require viewer role for findOne', async () => {
      const metadata = Reflect.getMetadata(
        '__require-role__',
        controller.findOne,
      );
      expect(metadata).toBe('viewer');
    });
  });

  describe('Error Handling', () => {
    it('should propagate service errors without modification', async () => {
      const serviceError = new Error('Service error');
      mockIssuesService.findAll.mockRejectedValue(serviceError);

      await expect(controller.findAll('project-1')).rejects.toThrow('Service error');
    });

    it('should handle unexpected errors gracefully', async () => {
      mockIssuesService.create.mockRejectedValue(new Error('Unexpected error'));

      await expect(
        controller.create('project-1', { title: 'Test' } as any),
      ).rejects.toThrow('Unexpected error');
    });
  });
});