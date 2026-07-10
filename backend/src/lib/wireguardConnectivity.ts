import { execFile } from 'child_process';
import { promisify } from 'util';

const execFileAsync = promisify(execFile);

export interface ConnectivityCheckResult {
    ok: boolean;
    output: string;
    reason: 'success' | 'missing-tool' | 'failed';
}

type ExecFileRunner = (command: string, args: string[], options?: { timeout: number }) => Promise<{ stdout?: string; stderr?: string }>;

export async function checkWireGuardReachability(
    targetIp: string,
    runner: ExecFileRunner = execFileAsync,
): Promise<ConnectivityCheckResult> {
    try {
        const { stdout, stderr } = await runner('ping', ['-c', '3', '-W', '3', targetIp], { timeout: 10000 });
        const output = `${stdout ?? ''}${stderr ?? ''}`.trim();
        return {
            ok: true,
            output: output || `Ping to ${targetIp} succeeded.`,
            reason: 'success',
        };
    } catch (error: any) {
        const message = [error?.stdout, error?.stderr].filter(Boolean).join('\n').trim() || error?.message || 'Ping failed';
        if (error?.code === 'ENOENT' || /not found|No such file|command not found/i.test(message)) {
            return {
                ok: false,
                output: `Ping utility is unavailable in this runtime; WireGuard handshake is the reliable verification signal.`,
                reason: 'missing-tool',
            };
        }

        return {
            ok: false,
            output: message,
            reason: 'failed',
        };
    }
}
