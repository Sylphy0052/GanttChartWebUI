import { Test, TestingModule } from '@nestjs/testing';
import { IssuesService } from './issues.service';
import { PrismaService } from '../database/prisma.service';
import { NotFoundException, BadRequestException, ConflictException } from '@nestjs/common';

describe('IssuesService', () => {
  let service: IssuesService;
  let prismaService: PrismaService;

  const mockPrismaService = {
    project: {
      findFirst: jest.fn(),
    },
    issue: {
      findFirst: jest.fn(),
      findMany: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
    },
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        IssuesService,
        {
          provide: PrismaService,
          useValue: mockPrismaService,
        },
      ],
    }).compile();

    service = module.get<IssuesService>(IssuesService);
    prismaService = module.get<PrismaService>(PrismaService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('create', () => {
    const createIssueDto = {
      project_id: 'project-1',
      title: 'Test Issue',
      description_md: 'Test description',
      status: 'open' as const,
    };

    const mockProject = {
      id: 'project-1',
      name: 'Test Project',
      is_deleted: false,
    };

    const mockCreatedIssue = {
      id: 'issue-1',
      project_id: 'project-1',
      parent_id: null,
      title: 'Test Issue',
      description_md: 'Test description',
      assignee: null,
      status: 'open',
      start_date: null,
      end_date: null,
      progress_pct: 0,
      effort_hours: null,
      is_blocked: false,
      sort_order: 0,
      labels: [],
      version: 1,
      is_deleted: false,
      deleted_at: null,
      created_at: new Date(),
      updated_at: new Date(),
    };

    beforeEach(() => {
      jest.clearAllMocks();
    });

    it('should create an issue successfully', async () => {
      mockPrismaService.project.findFirst.mockResolvedValue(mockProject);
      mockPrismaService.issue.create.mockResolvedValue(mockCreatedIssue);

      const result = await service.create(createIssueDto);

      expect(mockPrismaService.project.findFirst).toHaveBeenCalledWith({
        where: {
          id: createIssueDto.project_id,
          is_deleted: false,
        },
      });
      expect(mockPrismaService.issue.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          project_id: createIssueDto.project_id,
          title: createIssueDto.title,
          status: 'open',
          progress_pct: 0,
        }),
      });
      expect(result.id).toBe(mockCreatedIssue.id);
      expect(result.title).toBe(createIssueDto.title);
    });

    it('should throw NotFoundException when project does not exist', async () => {
      mockPrismaService.project.findFirst.mockResolvedValue(null);

      await expect(service.create(createIssueDto)).rejects.toThrow(
        NotFoundException,
      );
      expect(mockPrismaService.issue.create).not.toHaveBeenCalled();
    });

    it('should validate parent_id when provided', async () => {
      const createWithParentDto = {
        ...createIssueDto,
        parent_id: 'parent-issue-1',
      };

      const mockParentIssue = {
        id: 'parent-issue-1',
        project_id: 'project-1',
        is_deleted: false,
      };

      mockPrismaService.project.findFirst.mockResolvedValue(mockProject);
      mockPrismaService.issue.findFirst.mockResolvedValue(mockParentIssue);
      mockPrismaService.issue.create.mockResolvedValue({
        ...mockCreatedIssue,
        parent_id: 'parent-issue-1',
      });

      const result = await service.create(createWithParentDto);

      expect(mockPrismaService.issue.findFirst).toHaveBeenCalledWith({
        where: {
          id: createWithParentDto.parent_id,
          project_id: createWithParentDto.project_id,
          is_deleted: false,
        },
      });
      expect(result.parent_id).toBe('parent-issue-1');
    });

    it('should throw BadRequestException when parent issue does not exist', async () => {
      const createWithParentDto = {
        ...createIssueDto,
        parent_id: 'nonexistent-parent',
      };

      mockPrismaService.project.findFirst.mockResolvedValue(mockProject);
      mockPrismaService.issue.findFirst.mockResolvedValue(null);

      await expect(service.create(createWithParentDto)).rejects.toThrow(
        BadRequestException,
      );
      expect(mockPrismaService.issue.create).not.toHaveBeenCalled();
    });
  });

  describe('findAll', () => {
    const projectId = 'project-1';
    const mockProject = { id: projectId, is_deleted: false };
    const mockIssues = [
      { id: 'issue-1', title: 'Issue 1', project_id: projectId },
      { id: 'issue-2', title: 'Issue 2', project_id: projectId },
    ];

    beforeEach(() => {
      jest.clearAllMocks();
    });

    it('should return all issues for a project', async () => {
      mockPrismaService.project.findFirst.mockResolvedValue(mockProject);
      mockPrismaService.issue.findMany.mockResolvedValue(mockIssues);

      const result = await service.findAll(projectId);

      expect(mockPrismaService.project.findFirst).toHaveBeenCalledWith({
        where: { id: projectId, is_deleted: false },
      });
      expect(mockPrismaService.issue.findMany).toHaveBeenCalledWith({
        where: { project_id: projectId, is_deleted: false },
        include: expect.objectContaining({ children: expect.any(Object), parent: true }),
        orderBy: expect.any(Array),
      });
      expect(result).toHaveLength(2);
    });

    it('should throw NotFoundException when project does not exist', async () => {
      mockPrismaService.project.findFirst.mockResolvedValue(null);

      await expect(service.findAll(projectId)).rejects.toThrow(NotFoundException);
      expect(mockPrismaService.issue.findMany).not.toHaveBeenCalled();
    });
  });

  describe('findOne', () => {
    const issueId = 'issue-1';
    const mockIssue = { id: issueId, title: 'Test Issue', is_deleted: false };

    beforeEach(() => {
      jest.clearAllMocks();
    });

    it('should return an issue by id', async () => {
      mockPrismaService.issue.findFirst.mockResolvedValue(mockIssue);

      const result = await service.findOne(issueId);

      expect(mockPrismaService.issue.findFirst).toHaveBeenCalledWith({
        where: { id: issueId, is_deleted: false },
        include: expect.objectContaining({ children: expect.any(Object), parent: true }),
      });
      expect(result.id).toBe(issueId);
    });

    it('should throw NotFoundException when issue does not exist', async () => {
      mockPrismaService.issue.findFirst.mockResolvedValue(null);

      await expect(service.findOne(issueId)).rejects.toThrow(NotFoundException);
    });
  });

  describe('update', () => {
    const issueId = 'issue-1';
    const updateDto = { title: 'Updated Title' };
    const mockExistingIssue = { id: issueId, version: 1, project_id: 'project-1' };
    const mockUpdatedIssue = { ...mockExistingIssue, title: 'Updated Title', version: 2 };

    beforeEach(() => {
      jest.clearAllMocks();
    });

    it('should update an issue successfully', async () => {
      mockPrismaService.issue.findFirst.mockResolvedValue(mockExistingIssue);
      mockPrismaService.issue.update.mockResolvedValue(mockUpdatedIssue);

      const result = await service.update(issueId, updateDto);

      expect(mockPrismaService.issue.update).toHaveBeenCalledWith({
        where: { id: issueId, version: mockExistingIssue.version },
        data: expect.objectContaining({ title: updateDto.title, version: { increment: 1 } }),
      });
      expect(result.title).toBe(updateDto.title);
    });

    it('should throw NotFoundException when issue does not exist', async () => {
      mockPrismaService.issue.findFirst.mockResolvedValue(null);

      await expect(service.update(issueId, updateDto)).rejects.toThrow(NotFoundException);
      expect(mockPrismaService.issue.update).not.toHaveBeenCalled();
    });

    it('should throw ConflictException on optimistic locking error', async () => {
      mockPrismaService.issue.findFirst.mockResolvedValue(mockExistingIssue);
      mockPrismaService.issue.update.mockRejectedValue({ code: 'P2025' });

      await expect(service.update(issueId, updateDto)).rejects.toThrow(ConflictException);
    });
  });

  describe('remove', () => {
    const issueId = 'issue-1';
    const mockExistingIssue = { id: issueId, children: [] };

    beforeEach(() => {
      jest.clearAllMocks();
    });

    it('should remove an issue successfully', async () => {
      mockPrismaService.issue.findFirst.mockResolvedValue(mockExistingIssue);
      mockPrismaService.issue.update.mockResolvedValue({});

      const result = await service.remove(issueId);

      expect(mockPrismaService.issue.update).toHaveBeenCalledWith({
        where: { id: issueId },
        data: expect.objectContaining({
          is_deleted: true,
          deleted_at: expect.any(Date),
          version: { increment: 1 },
        }),
      });
      expect(result.message).toContain('削除されました');
    });

    it('should throw NotFoundException when issue does not exist', async () => {
      mockPrismaService.issue.findFirst.mockResolvedValue(null);

      await expect(service.remove(issueId)).rejects.toThrow(NotFoundException);
      expect(mockPrismaService.issue.update).not.toHaveBeenCalled();
    });

    it('should throw ConflictException when issue has children', async () => {
      const mockIssueWithChildren = { ...mockExistingIssue, children: [{ id: 'child-1' }] };
      mockPrismaService.issue.findFirst.mockResolvedValue(mockIssueWithChildren);

      await expect(service.remove(issueId)).rejects.toThrow(ConflictException);
      expect(mockPrismaService.issue.update).not.toHaveBeenCalled();
    });
  });
});