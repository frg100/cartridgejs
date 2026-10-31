#!/usr/bin/env node
import { createRequire } from 'node:module';
import { parseArgs } from 'node:util';
import { build, parsePlatforms } from './commands/build.js';
import { doctor } from './commands/doctor.js';
import { init } from './commands/init.js';
import { dev, preview } from './commands/run.js';
import { upload } from './commands/upload.js';
import { c, KilnError, log } from './log.js';

const require = createRequire(import.meta.url);
const VERSION = (require('../package.json') as { version: string }).version;

const HELP = `${c.bold('kiln')} ${c.dim(VERSION)} — ship your three.js / WebGL game to Steam

${c.bold('Usage')}
  kiln <command> [options]

${c.bold('Commands')}
  init                Add kiln to the game in this folder
      --ci            Also add a GitHub Actions workflow for Steam releases
      --install       Install @kiln/cli and @kiln/steam
      --force         Replace files that are already there
  dev                 Start your dev server and open the game in a desktop window
      --url <url>     Use this dev server URL (default: web.devUrl)
      --no-steam      Do not start Steam
  preview             Open the built game (web.dir) in a desktop window
      --build         Build the web game first
      --no-steam      Do not start Steam
  build               Make desktop builds in .kiln/build/<platform>/
      --platform <p>  windows, macos, linux, all, or a list: windows,linux
      --skip-web      Do not run the web build command
  upload              Upload the builds to Steam with steamcmd
      --branch <name> Set the build live on this beta branch
      --desc <text>   Build description in Steamworks
      --user <name>   Steam builder account (or STEAM_USERNAME)
      --platform <p>  Upload only these platforms
      --preview       Steam preview mode: check the files, upload nothing
      --dry-run       Write the SteamPipe scripts and print them only
  doctor              Check the project for release problems

  -h, --help          Show this help
  -v, --version       Show the version
`;

async function main(argv: string[]): Promise<number> {
  const { values, positionals } = parseArgs({
    args: argv,
    allowPositionals: true,
    strict: true,
    options: {
      help: { type: 'boolean', short: 'h' },
      version: { type: 'boolean', short: 'v' },
      ci: { type: 'boolean' },
      install: { type: 'boolean' },
      force: { type: 'boolean' },
      url: { type: 'string' },
      'no-steam': { type: 'boolean' },
      build: { type: 'boolean' },
      platform: { type: 'string', short: 'p' },
      'skip-web': { type: 'boolean' },
      branch: { type: 'string' },
      desc: { type: 'string' },
      user: { type: 'string' },
      preview: { type: 'boolean' },
      'dry-run': { type: 'boolean' },
    },
  });

  if (values.version) {
    console.log(VERSION);
    return 0;
  }
  const command = positionals[0];
  if (values.help || !command) {
    console.log(HELP);
    return command || values.help ? 0 : 1;
  }

  switch (command) {
    case 'init':
      await init({ ci: !!values.ci, install: !!values.install, force: !!values.force });
      return 0;
    case 'dev':
      return dev({ noSteam: !!values['no-steam'], url: values.url });
    case 'preview':
      return preview({ noSteam: !!values['no-steam'], build: !!values.build });
    case 'build':
      await build({ platforms: parsePlatforms(values.platform), skipWeb: !!values['skip-web'] });
      return 0;
    case 'upload':
      await upload({
        platforms: parsePlatforms(values.platform),
        branch: values.branch,
        description: values.desc,
        user: values.user,
        dryRun: !!values['dry-run'],
        preview: !!values.preview,
      });
      return 0;
    case 'doctor':
      return (await doctor()) > 0 ? 1 : 0;
    default:
      throw new KilnError(`Unknown command "${command}".`, 'Run `kiln --help` to see the commands.');
  }
}

main(process.argv.slice(2)).then(
  (code) => process.exit(code),
  (err: unknown) => {
    if (err instanceof KilnError) {
      log.error(err.message);
      if (err.hint) log.info(c.dim(err.hint));
    } else if (err instanceof Error && (err as NodeJS.ErrnoException).code?.startsWith('ERR_PARSE_ARGS')) {
      log.error(err.message);
      log.info(c.dim('Run `kiln --help` to see the options.'));
    } else {
      console.error(err);
    }
    process.exit(1);
  },
);
