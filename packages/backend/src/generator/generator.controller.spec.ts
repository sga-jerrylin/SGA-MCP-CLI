import type { Project } from '@sga/shared';
import { GeneratorController } from './generator.controller';
import { GeneratorService } from './generator.service';

describe('GeneratorController', () => {
  let controller: GeneratorController;

  beforeEach(() => {
    const service = {
      generateFromDoc: jest.fn().mockResolvedValue({
        archivePath: '/tmp/archive.tgz',
        manifestPath: '/tmp/manifest.json',
        sbomPath: '/tmp/sbom.json',
        signaturePath: '/tmp/signature.sig'
      })
    } as unknown as GeneratorService;
    controller = new GeneratorController(service);
  });

  it('returns paginated projects', () => {
    const response = controller.listProjects('1', '10');

    expect(response.code).toBe(0);
    expect(response.data.items.length).toBeGreaterThanOrEqual(1);
    expect(response.data.page).toBe(1);
    expect(response.data.pageSize).toBe(10);
  });

  it('creates a project from body and file', () => {
    const response = controller.createProject(
      { name: 'New Project', description: 'desc', docType: 'markdown' },
      { originalname: 'api.md' }
    );

    expect(response.code).toBe(0);
    expect(response.data.name).toBe('New Project');
    expect(response.data.docType).toBe('markdown');
  });

  it('returns project detail', () => {
    const created = controller.createProject({ name: 'Detail Project', docType: 'openapi' });
    const response = controller.getProject(created.data.id);

    expect(response.code).toBe(0);
    expect((response.data as Project).id).toBe(created.data.id);
  });

  it('starts project run', () => {
    const response = controller.startProject('proj-1');

    expect(response.code).toBe(0);
    expect(response.data.projectId).toBe('proj-1');
    expect(response.data.status).toBe('running');
  });

  it('returns artifacts list', () => {
    const response = controller.listArtifacts('proj-1');

    expect(response.code).toBe(0);
    expect(response.data.length).toBeGreaterThanOrEqual(1);
  });
});
