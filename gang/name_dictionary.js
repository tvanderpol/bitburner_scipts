/** @param {NS} ns **/

import NF from "util/number_formatter.js"

export default class {
  constructor(ns, members) {
    this.ns = ns
    this.memberNames = members
      .map(m => m.name)
      .map(n => n.toLowerCase())
      .map(n => n.split(" ")[0]) // Ignore suffixes like II and such for now
    this.possibleNames = [
      'api',
      'assembly',
      'automata',
      'axis',
      'binary',
      'bitshift',
      'circuit',
      'closure',
      'compiler',
      'concat',
      'concurrency',
      'const',
      'contiguous',
      'dereference',
      'diffuse',
      'ellipsis',
      'endian',
      'eval',
      'exec',
      'factorial',
      'fractal',
      'function',
      'geometry',
      'hex',
      'iterate',
      'latency',
      'lexer',
      'manifold',
      'matrices',
      'meta',
      'modulo',
      'mutex',
      'node',
      'null',
      'octal',
      'operand',
      'parallax',
      'parser',
      'pointer',
      'polygon',
      'polymorphic',
      'pop',
      'procedure',
      'process',
      'push',
      'recurse',
      'regex',
      'scope',
      'scsi',
      'segfault',
      'sequencer',
      'shader',
      'socket',
      'stack',
      'stream',
      'syntax',
      'tessellation',
      'tuple',
      'unary',
      'undefined',
      'varchar',
      'vector',
      'vertex',
      'void',
      'voxel',
      'while',
      'xor',
    ]
  }

  get availableName() {
    let candidates = this.possibleNames.filter(n => !this.memberNames.includes(n))
    let name = candidates[Math.floor(Math.random() * candidates.length)];
    return name[0].toUpperCase() + name.substring(1);
  }
}