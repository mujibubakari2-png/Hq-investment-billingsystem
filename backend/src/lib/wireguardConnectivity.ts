import { execFile } from 'child_process';
import { promisify } from 'util';
import net from 'net';

const execFileAsync = promisify(execFile);

export interface ConnectivityCheckResult {
    ok: boolean;
    output: string;
    reason: 'success' | 'missing-tool' | 'failed';
}

type ExecFileRunner = (command: string, args: string[], options?: { timeout: number }) => Promise<{ stdout?: string; stderr?: string }>;

type TcpProbeRunner = (targetIp: string, ports: number[], timeoutMs: number) => Promise<{ ok: boolean; output: string }>;

function tryTcpPorts(targetIp: string, ports: number[], timeoutMs: number): Promise<{ ok: boolean; output: string }> {
    return new Promise((resolve) => {
        const results: string[] = [];

        const attempts = ports.map((port) => new Promise<void>((innerResolve) => {
            const socket = new net.Socket();
            const timer = setTimeout(() => {
                socket.destroy();
                innerResolve();
            }, timeoutMs);

            socket.once('connect', () => {
                clearTimeout(timer);
                socket.destroy();
                results.push(`TCP connect succeeded on port ${port}`);
                innerResolve();
            });

            socket.once('error', () => {
                clearTimeout(timer);
                innerResolve();
            });

            socket.connect(port, targetIp);
        }));

        void Promise.all(attempts).then(() => {
            if (results.length > 0) {
                resolve({ ok: true, output: results.join('; ') });
            } else {
                resolve({ ok: false, output: `TCP connect timed out on ports ${ports.join(',')}` });
            }
        });
    });
}

export async function checkWireGuardReachability(
    targetIp: string | string[],
    runner: ExecFileRunner = execFileAsync,
    tcpProbe: TcpProbeRunner = tryTcpPorts,
): Promise<ConnectivityCheckResult> {
    const targets = Array.isArray(targetIp) ? targetIp : [targetIp];

    for (const currentTarget of targets) {
        try {
            const pingArgs = process.platform === 'win32'
                ? ['-n', '3', '-w', '3000', currentTarget]
                : ['-c', '3', '-W', '3', currentTarget];
            const { stdout, stderr } = await runner('ping', pingArgs, { timeout: 10000 });
            const output = `${stdout ?? ''}${stderr ?? ''}`.trim();
            return {
                ok: true,
                output: output || `Ping to ${currentTarget} succeeded.`,
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

            const tcpResult = await tcpProbe(currentTarget, [80, 443, 8728, 8291], 2000);
            if (tcpResult.ok) {
                return {
                    ok: true,
                    output: `${message}\n${tcpResult.output}`,
                    reason: 'success',
                };
            }

            if (currentTarget !== targets[targets.length - 1]) {
                continue;
            }

            return {
                ok: false,
                output: `${message}\n${tcpResult.output}`,
                reason: 'failed',
            };
        }
    }

    return {
        ok: false,
        output: `No reachable WireGuard target found for ${targets.join(', ')}`,
        reason: 'failed',
    };
}
