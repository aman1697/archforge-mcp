import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import type { Project } from './types.js';

const ID_RE = /^[a-z0-9][a-z0-9-]{0,60}$/;

export class Store {
  constructor(private dir: string) {
    fs.mkdirSync(dir, { recursive: true });
  }

  private file(id: string): string {
    if (!ID_RE.test(id)) throw new Error(`Invalid project id "${id}"`);
    return path.join(this.dir, `${id}.json`);
  }

  create(name: string, description: string): Project {
    const slug =
      name
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/^-+|-+$/g, '')
        .slice(0, 30) || 'project';
    const id = `${slug}-${crypto.randomBytes(2).toString('hex')}`;
    const now = new Date().toISOString();
    const p: Project = {
      id,
      name,
      description,
      createdAt: now,
      updatedAt: now,
      answers: {},
      skipped: [],
      answersVersion: 0,
      sections: {},
    };
    this.save(p);
    return p;
  }

  get(id: string): Project | undefined {
    try {
      return JSON.parse(fs.readFileSync(this.file(id), 'utf8')) as Project;
    } catch (e: any) {
      if (e?.code === 'ENOENT') return undefined;
      throw e;
    }
  }

  save(p: Project): void {
    p.updatedAt = new Date().toISOString();
    const f = this.file(p.id);
    const tmp = `${f}.${process.pid}.tmp`;
    fs.writeFileSync(tmp, JSON.stringify(p, null, 2));
    fs.renameSync(tmp, f);
  }

  list(): Project[] {
    return fs
      .readdirSync(this.dir)
      .filter((f) => f.endsWith('.json'))
      .map((f) => this.get(f.replace(/\.json$/, '')))
      .filter((p): p is Project => !!p)
      .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
  }
}
