import { Test, TestingModule } from '@nestjs/testing';
import { ProjectsService } from './projects.service';
import { PrismaService } from '../database/prisma.service';
import { CreateProjectDto, UpdateProjectDto } from './dto';
import { ConflictException, NotFoundException } from '@nestjs/common';

describe('ProjectsService', () => {
  let service: ProjectsService;
  let prismaService: PrismaService;

  // テスト用のモックデータ
  const mockProject = {
    id: '1',
    name: 'Test Project',
    description_md: 'Test Description',
    shared_password_hash: null,
    is_deleted: false,
    created_at: new Date('2023-01-01T00:00:00Z'),
    updated_at: new Date('2023-01-01T00:00:00Z'),
  };

  const mockCreateProjectDto: CreateProjectDto = {
    name: 'New Project',
    description_md: 'New Description',
    shared_password_hash: null,
  };

  const mockUpdateProjectDto: UpdateProjectDto = {
    description_md: 'Updated Description',
  };

  const mockPrismaService = {
    project: {
      findFirst: jest.fn(),
      findMany: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
    },
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ProjectsService,
        {
          provide: PrismaService,
          useValue: mockPrismaService,
        },
      ],
    }).compile();

    service = module.get<ProjectsService>(ProjectsService);
    prismaService = module.get<PrismaService>(PrismaService);

    // モックのリセット
    jest.clearAllMocks();
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('create', () => {
    it('プロジェクトを正常に作成できること', async () => {
      // Arrange
      mockPrismaService.project.findFirst.mockResolvedValue(null); // 重複なし
      mockPrismaService.project.create.mockResolvedValue(mockProject);

      // Act
      const result = await service.create(mockCreateProjectDto);

      // Assert
      expect(result).toEqual({
        id: mockProject.id,
        name: mockProject.name,
        description_md: mockProject.description_md,
        created_at: mockProject.created_at,
        updated_at: mockProject.updated_at,
      });
      expect(mockPrismaService.project.findFirst).toHaveBeenCalledWith({
        where: {
          name: mockCreateProjectDto.name,
          is_deleted: false,
        },
      });
      expect(mockPrismaService.project.create).toHaveBeenCalledWith({
        data: mockCreateProjectDto,
      });
    });

    it('重複するプロジェクト名でConflictExceptionが発生すること', async () => {
      // Arrange
      mockPrismaService.project.findFirst.mockResolvedValue(mockProject); // 重複あり

      // Act & Assert
      await expect(service.create(mockCreateProjectDto)).rejects.toThrow(
        ConflictException,
      );
      expect(mockPrismaService.project.create).not.toHaveBeenCalled();
    });
  });

  describe('findAll', () => {
    it('プロジェクト一覧を正常に取得できること', async () => {
      // Arrange
      const mockProjects = [mockProject];
      mockPrismaService.project.findMany.mockResolvedValue(mockProjects);

      // Act
      const result = await service.findAll();

      // Assert
      expect(result).toHaveLength(1);
      expect(result[0]).toEqual({
        id: mockProject.id,
        name: mockProject.name,
        description_md: mockProject.description_md,
        created_at: mockProject.created_at,
        updated_at: mockProject.updated_at,
      });
      expect(mockPrismaService.project.findMany).toHaveBeenCalledWith({
        where: {
          is_deleted: false,
        },
        orderBy: [
          { updated_at: 'desc' },
          { created_at: 'desc' },
        ],
      });
    });

    it('空の配列を正常に取得できること', async () => {
      // Arrange
      mockPrismaService.project.findMany.mockResolvedValue([]);

      // Act
      const result = await service.findAll();

      // Assert
      expect(result).toHaveLength(0);
    });
  });

  describe('findOne', () => {
    it('指定されたIDのプロジェクトを正常に取得できること', async () => {
      // Arrange
      mockPrismaService.project.findFirst.mockResolvedValue(mockProject);

      // Act
      const result = await service.findOne('1');

      // Assert
      expect(result).toEqual({
        id: mockProject.id,
        name: mockProject.name,
        description_md: mockProject.description_md,
        created_at: mockProject.created_at,
        updated_at: mockProject.updated_at,
      });
      expect(mockPrismaService.project.findFirst).toHaveBeenCalledWith({
        where: {
          id: '1',
          is_deleted: false,
        },
      });
    });

    it('存在しないIDでNotFoundExceptionが発生すること', async () => {
      // Arrange
      mockPrismaService.project.findFirst.mockResolvedValue(null);

      // Act & Assert
      await expect(service.findOne('999')).rejects.toThrow(
        NotFoundException,
      );
    });
  });

  describe('update', () => {
    it('プロジェクトを正常に更新できること（名前以外の更新）', async () => {
      // Arrange
      const updatedProject = { ...mockProject, ...mockUpdateProjectDto };
      mockPrismaService.project.findFirst.mockResolvedValue(mockProject); // 存在確認のみ
      mockPrismaService.project.update.mockResolvedValue(updatedProject);

      // Act
      const result = await service.update('1', mockUpdateProjectDto);

      // Assert
      expect(result).toEqual({
        id: updatedProject.id,
        name: updatedProject.name,
        description_md: updatedProject.description_md,
        created_at: updatedProject.created_at,
        updated_at: updatedProject.updated_at,
      });
      expect(mockPrismaService.project.findFirst).toHaveBeenCalledTimes(1); // 存在確認のみ
      expect(mockPrismaService.project.update).toHaveBeenCalledWith({
        where: { id: '1' },
        data: {
          description_md: mockUpdateProjectDto.description_md,
        },
      });
    });

    it('プロジェクト名を更新できること', async () => {
      // Arrange
      const nameUpdateDto: UpdateProjectDto = {
        name: 'New Name',
      };
      const updatedProject = { ...mockProject, name: nameUpdateDto.name };
      
      mockPrismaService.project.findFirst
        .mockResolvedValueOnce(mockProject) // 存在確認
        .mockResolvedValueOnce(null); // 重複確認（重複なし）
      mockPrismaService.project.update.mockResolvedValue(updatedProject);

      // Act
      const result = await service.update('1', nameUpdateDto);

      // Assert
      expect(result.name).toBe(nameUpdateDto.name);
      expect(mockPrismaService.project.findFirst).toHaveBeenCalledTimes(2); // 存在確認 + 重複確認
    });

    it('存在しないIDでNotFoundExceptionが発生すること', async () => {
      // Arrange
      mockPrismaService.project.findFirst.mockResolvedValue(null);

      // Act & Assert
      await expect(service.update('999', mockUpdateProjectDto)).rejects.toThrow(
        NotFoundException,
      );
      expect(mockPrismaService.project.update).not.toHaveBeenCalled();
    });

    it('重複するプロジェクト名でConflictExceptionが発生すること', async () => {
      // Arrange
      const otherProject = { ...mockProject, id: '2', name: 'Other Project' };
      const nameUpdateDto: UpdateProjectDto = {
        name: 'Other Project',
      };
      
      mockPrismaService.project.findFirst
        .mockResolvedValueOnce(mockProject) // 存在確認
        .mockResolvedValueOnce(otherProject); // 重複確認（重複あり）

      // Act & Assert
      await expect(service.update('1', nameUpdateDto)).rejects.toThrow(
        ConflictException,
      );
      expect(mockPrismaService.project.update).not.toHaveBeenCalled();
    });
  });

  describe('remove', () => {
    it('プロジェクトを正常に論理削除できること', async () => {
      // Arrange
      mockPrismaService.project.findFirst.mockResolvedValue(mockProject);
      mockPrismaService.project.update.mockResolvedValue({
        ...mockProject,
        is_deleted: true,
      });

      // Act
      await service.remove('1');

      // Assert
      expect(mockPrismaService.project.update).toHaveBeenCalledWith({
        where: { id: '1' },
        data: {
          is_deleted: true,
        },
      });
    });

    it('存在しないIDでNotFoundExceptionが発生すること', async () => {
      // Arrange
      mockPrismaService.project.findFirst.mockResolvedValue(null);

      // Act & Assert
      await expect(service.remove('999')).rejects.toThrow(
        NotFoundException,
      );
      expect(mockPrismaService.project.update).not.toHaveBeenCalled();
    });
  });

  describe('エラーハンドリング', () => {
    it('データベースエラーが適切に伝播されること', async () => {
      // Arrange
      const dbError = new Error('Database connection failed');
      mockPrismaService.project.findMany.mockRejectedValue(dbError);

      // Act & Assert
      await expect(service.findAll()).rejects.toThrow(dbError);
    });
  });
});