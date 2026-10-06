import type { Command } from 'commander';
import type * as core from '../core';

export type Core = typeof core;

/** Every command module exposes a register function. */
export type CommandModule = (program: Command, core: Core) => void;
