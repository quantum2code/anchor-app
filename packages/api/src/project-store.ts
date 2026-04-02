export type Project = {
  id: string;
  name: string;
  ownerId: string;
  createdAt: Date;
  updatedAt: Date;
};

export type CreateProjectInput = {
  name: string;
  ownerId: string;
};

export interface ProjectStore {
  create(input: CreateProjectInput): Promise<Project>;
  list(ownerId: string): Promise<Project[]>;
  getById(input: { id: string; ownerId: string }): Promise<Project | null>;
}

export function createInMemoryProjectStore(): ProjectStore {
  const projects = new Map<string, Project>();

  return {
    async create(input) {
      const now = new Date();
      const project: Project = {
        id: crypto.randomUUID(),
        name: input.name,
        ownerId: input.ownerId,
        createdAt: now,
        updatedAt: now,
      };

      projects.set(project.id, project);

      return project;
    },
    async list(ownerId) {
      return [...projects.values()]
        .filter((project) => project.ownerId === ownerId)
        .sort((left, right) => right.createdAt.getTime() - left.createdAt.getTime());
    },
    async getById({ id, ownerId }) {
      const project = projects.get(id);

      if (!project || project.ownerId !== ownerId) {
        return null;
      }

      return project;
    },
  };
}

export function createDatabaseProjectStore(): ProjectStore {
  async function loadDatabase() {
    const [{ db }, { project }] = await Promise.all([
      import("@anchor/db"),
      import("@anchor/db/schema/index"),
    ]);

    return { db, project };
  }

  return {
    async create(input) {
      const { db, project } = await loadDatabase();
      const [createdProject] = await db
        .insert(project)
        .values({
          id: crypto.randomUUID(),
          name: input.name,
          ownerId: input.ownerId,
        })
        .returning();

      if (!createdProject) {
        throw new Error("Project creation failed");
      }

      return createdProject;
    },
    async list(ownerId) {
      const { db } = await loadDatabase();
      const projects = await db.query.project.findMany({
        where: (projects, { eq: columnEquals }) => columnEquals(projects.ownerId, ownerId),
      });

      return projects.sort((left, right) => right.createdAt.getTime() - left.createdAt.getTime());
    },
    async getById({ id, ownerId }) {
      const { db } = await loadDatabase();
      return (
        (await db.query.project.findFirst({
          where: (projects, { and, eq: columnEquals }) =>
            and(columnEquals(projects.id, id), columnEquals(projects.ownerId, ownerId)),
        })) ?? null
      );
    },
  };
}
