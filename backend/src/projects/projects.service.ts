import { Injectable, Logger, NotFoundException, ConflictException } from '@nestjs/common';
import { PrismaService } from '../database/prisma.service';
import { CreateProjectDto, UpdateProjectDto, ProjectResponseDto } from './dto';
import { Project } from '@prisma/client';
import { plainToClass } from 'class-transformer';

/**
 * ProjectsService - プロジェクトビジネスロジック
 * 
 * 機能:
 * - 全CRUD操作（作成、読み取り、更新、論理削除）
 * - バリデーションとエラーハンドリング
 * - 論理削除対応（is_deleted=true）
 * - レスポンスDTO変換
 */
@Injectable()
export class ProjectsService {
  private readonly logger = new Logger(ProjectsService.name);

  constructor(private readonly prisma: PrismaService) {}

  /**
   * プロジェクト作成
   * @param createProjectDto 作成データ
   * @returns 作成されたプロジェクト
   * @throws ConflictException プロジェクト名が重複している場合
   */
  async create(createProjectDto: CreateProjectDto): Promise<ProjectResponseDto> {
    this.logger.log(`Creating project: ${createProjectDto.name}`);

    try {
      // 論理削除されていないプロジェクトで名前の重複チェック
      const existingProject = await this.prisma.project.findFirst({
        where: {
          name: createProjectDto.name,
          is_deleted: false,
        },
      });

      if (existingProject) {
        throw new ConflictException('プロジェクト名は既に使用されています');
      }

      const project = await this.prisma.project.create({
        data: {
          name: createProjectDto.name,
          description_md: createProjectDto.description_md,
          shared_password_hash: createProjectDto.shared_password_hash,
        },
      });

      this.logger.log(`Project created successfully: ${project.id}`);
      return this.toResponseDto(project);
    } catch (error) {
      this.logger.error(`Failed to create project: ${error.message}`, error);
      throw error;
    }
  }

  /**
   * プロジェクト一覧取得（論理削除されていないもののみ）
   * @returns プロジェクト一覧
   */
  async findAll(): Promise<ProjectResponseDto[]> {
    this.logger.log('Fetching all projects');

    try {
      const projects = await this.prisma.project.findMany({
        where: {
          is_deleted: false,
        },
        orderBy: [
          { updated_at: 'desc' },
          { created_at: 'desc' },
        ],
      });

      this.logger.log(`Found ${projects.length} projects`);
      return projects.map(project => this.toResponseDto(project));
    } catch (error) {
      this.logger.error(`Failed to fetch projects: ${error.message}`, error);
      throw error;
    }
  }

  /**
   * プロジェクト詳細取得
   * @param id プロジェクトID
   * @returns プロジェクト詳細
   * @throws NotFoundException プロジェクトが存在しないまたは削除済みの場合
   */
  async findOne(id: string): Promise<ProjectResponseDto> {
    this.logger.log(`Fetching project: ${id}`);

    try {
      const project = await this.prisma.project.findFirst({
        where: {
          id,
          is_deleted: false,
        },
      });

      if (!project) {
        throw new NotFoundException('プロジェクトが見つかりません');
      }

      this.logger.log(`Project found: ${project.id}`);
      return this.toResponseDto(project);
    } catch (error) {
      this.logger.error(`Failed to fetch project ${id}: ${error.message}`, error);
      throw error;
    }
  }

  /**
   * プロジェクト更新
   * @param id プロジェクトID
   * @param updateProjectDto 更新データ
   * @returns 更新されたプロジェクト
   * @throws NotFoundException プロジェクトが存在しないまたは削除済みの場合
   * @throws ConflictException プロジェクト名が重複している場合
   */
  async update(id: string, updateProjectDto: UpdateProjectDto): Promise<ProjectResponseDto> {
    this.logger.log(`Updating project: ${id}`);

    try {
      // プロジェクトの存在確認
      const existingProject = await this.prisma.project.findFirst({
        where: {
          id,
          is_deleted: false,
        },
      });

      if (!existingProject) {
        throw new NotFoundException('プロジェクトが見つかりません');
      }

      // 名前の変更がある場合、重複チェック
      if (updateProjectDto.name && updateProjectDto.name !== existingProject.name) {
        const duplicateProject = await this.prisma.project.findFirst({
          where: {
            name: updateProjectDto.name,
            is_deleted: false,
            NOT: {
              id,
            },
          },
        });

        if (duplicateProject) {
          throw new ConflictException('プロジェクト名は既に使用されています');
        }
      }

      const updatedProject = await this.prisma.project.update({
        where: { id },
        data: {
          ...(updateProjectDto.name && { name: updateProjectDto.name }),
          ...(updateProjectDto.description_md !== undefined && { 
            description_md: updateProjectDto.description_md 
          }),
          ...(updateProjectDto.shared_password_hash !== undefined && { 
            shared_password_hash: updateProjectDto.shared_password_hash 
          }),
        },
      });

      this.logger.log(`Project updated successfully: ${updatedProject.id}`);
      return this.toResponseDto(updatedProject);
    } catch (error) {
      this.logger.error(`Failed to update project ${id}: ${error.message}`, error);
      throw error;
    }
  }

  /**
   * プロジェクト論理削除
   * @param id プロジェクトID
   * @throws NotFoundException プロジェクトが存在しないまたは既に削除済みの場合
   */
  async remove(id: string): Promise<void> {
    this.logger.log(`Removing project: ${id}`);

    try {
      // プロジェクトの存在確認
      const existingProject = await this.prisma.project.findFirst({
        where: {
          id,
          is_deleted: false,
        },
      });

      if (!existingProject) {
        throw new NotFoundException('プロジェクトが見つかりません');
      }

      // 論理削除の実行
      await this.prisma.project.update({
        where: { id },
        data: {
          is_deleted: true,
        },
      });

      this.logger.log(`Project removed successfully: ${id}`);
    } catch (error) {
      this.logger.error(`Failed to remove project ${id}: ${error.message}`, error);
      throw error;
    }
  }

  /**
   * ProjectをProjectResponseDTOに変換
   * @param project Projectエンティティ
   * @returns ProjectResponseDTO
   */
  private toResponseDto(project: Project): ProjectResponseDto {
    return plainToClass(ProjectResponseDto, {
      id: project.id,
      name: project.name,
      description_md: project.description_md,
      created_at: project.created_at,
      updated_at: project.updated_at,
    });
  }
}