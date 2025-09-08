import ProjectSettings from '@/components/projects/ProjectSettings';

interface ProjectSettingsPageProps {
  params: Promise<{
    id: string;
  }>;
}

export default async function ProjectSettingsPage({ params }: ProjectSettingsPageProps) {
  const { id } = await params;
  return <ProjectSettings projectId={id} />;
}

export async function generateMetadata({ params }: ProjectSettingsPageProps) {
  const { id } = await params;
  return {
    title: 'プロジェクト設定 - Gantt Chart Web UI',
    description: `プロジェクト設定画面`,
  };
}