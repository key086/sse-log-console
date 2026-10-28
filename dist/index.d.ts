#!/usr/bin/env node
export interface Args {
    files: string[];
    command?: string;
    port: number;
    host: string;
}
