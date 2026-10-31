const color = process.stdout.isTTY && !process.env.NO_COLOR;
const wrap = (code: number) => (s: string) => (color ? `\x1b[${code}m${s}\x1b[0m` : s);

export const c = {
  bold: wrap(1),
  dim: wrap(2),
  red: wrap(31),
  green: wrap(32),
  yellow: wrap(33),
  cyan: wrap(36),
};

export const log = {
  step: (msg: string) => console.log(`${c.cyan('›')} ${msg}`),
  ok: (msg: string) => console.log(`${c.green('✔')} ${msg}`),
  warn: (msg: string) => console.warn(`${c.yellow('!')} ${msg}`),
  error: (msg: string) => console.error(`${c.red('✖')} ${msg}`),
  info: (msg: string) => console.log(`  ${msg}`),
  plain: (msg = '') => console.log(msg),
};

/** An error with a message for the user (no stack trace). */
export class CartridgeError extends Error {
  constructor(message: string, public hint?: string) {
    super(message);
  }
}
