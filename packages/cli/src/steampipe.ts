/**
 * SteamPipe build scripts (VDF) for steamcmd `+run_app_build`.
 * Docs: https://partner.steamgames.com/doc/sdk/uploading
 */
import * as fs from 'node:fs';
import * as path from 'node:path';
import type { Platform, ResolvedConfig } from './config.js';
import { KilnError } from './log.js';

export type VdfValue = string | number | VdfObject;
export interface VdfObject {
  [key: string]: VdfValue;
}

function quote(s: string): string {
  return `"${s.replace(/\\/g, '\\\\').replace(/"/g, '\\"')}"`;
}

/** Serialize a nested object as Valve KeyValues text. */
export function toVdf(obj: VdfObject, indent = 0): string {
  const pad = '\t'.repeat(indent);
  let out = '';
  for (const [k, v] of Object.entries(obj)) {
    if (typeof v === 'object') {
      out += `${pad}${quote(k)}\n${pad}{\n${toVdf(v, indent + 1)}${pad}}\n`;
    } else {
      out += `${pad}${quote(k)}\t\t${quote(String(v))}\n`;
    }
  }
  return out;
}

/** Steam accepts forward slashes on all platforms; they need no escapes. */
const slash = (p: string) => p.split(path.sep).join('/');

export interface UploadPlan {
  appBuildFile: string;
  files: { path: string; content: string }[];
  depots: { platform: Platform; depotId: number; contentRoot: string }[];
}

export interface PlanOptions {
  description: string;
  /** Beta branch to set live. Leave empty to upload without setting live. */
  branch?: string;
  /** Only these platforms (default: every built platform that has a depot). */
  platforms?: Platform[];
  preview?: boolean;
}

export function builtPlatforms(config: ResolvedConfig): Platform[] {
  const dir = path.join(config.outDir, 'build');
  return config.platforms.filter((p) => fs.existsSync(path.join(dir, p)));
}

export function planUpload(config: ResolvedConfig, opts: PlanOptions): UploadPlan {
  const appId = config.steam.appId;
  if (!appId) throw new KilnError('`steam.appId` is not set in the kiln config.');
  if (appId === 480) {
    throw new KilnError(
      'App 480 (Spacewar) is only for local tests. You cannot upload to it.',
      'Set `steam.appId` to your own App ID from https://partner.steamgames.com.',
    );
  }

  const built = builtPlatforms(config);
  const wanted = opts.platforms ?? built;
  const depots: UploadPlan['depots'] = [];
  for (const platform of wanted) {
    if (!built.includes(platform)) {
      throw new KilnError(`No ${platform} build found.`, `Run \`kiln build --platform ${platform}\` first.`);
    }
    const depotId = config.steam.depots[platform];
    if (!depotId) {
      throw new KilnError(
        `No depot for ${platform}.`,
        `Add \`steam.depots.${platform}\` to the kiln config (Steamworks › SteamPipe › Depots).`,
      );
    }
    depots.push({ platform, depotId, contentRoot: path.join(config.outDir, 'build', platform) });
  }
  if (!depots.length) {
    throw new KilnError('There is nothing to upload.', 'Run `kiln build` first.');
  }

  const dir = path.join(config.outDir, 'steampipe');
  const files: UploadPlan['files'] = [];
  const depotRefs: VdfObject = {};

  for (const d of depots) {
    const file = path.join(dir, `depot_${d.depotId}.vdf`);
    const vdf: VdfObject = {
      DepotBuild: {
        DepotID: d.depotId,
        ContentRoot: slash(d.contentRoot),
        FileMapping: { LocalPath: '*', DepotPath: '.', Recursive: 1 },
        FileExclusion: '*.pdb',
      },
    };
    files.push({ path: file, content: toVdf(vdf) });
    depotRefs[String(d.depotId)] = slash(file);
  }

  const appBuild: VdfObject = {
    AppID: appId,
    Desc: opts.description,
    BuildOutput: slash(path.join(dir, 'output')),
    ...(opts.preview ? { Preview: 1 } : {}),
    ...(opts.branch ? { SetLive: opts.branch } : {}),
    Depots: depotRefs,
  };
  const appBuildFile = path.join(dir, `app_build_${appId}.vdf`);
  files.push({ path: appBuildFile, content: toVdf({ AppBuild: appBuild }) });

  return { appBuildFile, files, depots };
}

export function writePlan(plan: UploadPlan): void {
  for (const f of plan.files) {
    fs.mkdirSync(path.dirname(f.path), { recursive: true });
    fs.writeFileSync(f.path, f.content);
  }
  fs.mkdirSync(path.join(path.dirname(plan.appBuildFile), 'output'), { recursive: true });
}
